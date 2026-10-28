// Measures decoding speed of all PSD/PSB files in the repository and resources/psd-files
// and saves the summary to results/perf/perf-<version>[-<tag>].json
//
// usage: npx tsc -p tsconfig.json && node perf.js [options]
//   --iterations <n>   timed runs per file, after one warmup run (default 3)
//   --filter <text>    only measure files with path containing text
//   --tag <name>       appended to summary file name (perf-<version>-<name>.json)
//   --compare <file>   summary file (or version/tag, e.g. 33.0.0) to compare with,
//                      defaults to most recently modified other summary in results/perf
//   --threshold <n>    relative change reported as regression/improvement (default 0.1 = 10%)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const v8 = require('v8');
const vm = require('vm');

const root = __dirname;
const perfDir = path.join(root, 'results', 'perf');
const excludedDirs = ['node_modules', 'dist', 'dist-es', 'results', 'resources', 'coverage', 'coverage-remapped', '.git'];
const readOptions = { useImageData: true, log: () => { } };
const minDiffMs = 2; // ignore smaller absolute changes as noise

function parseArgs() {
	const args = { iterations: 3, filter: '', tag: '', compare: '', threshold: 0.1 };
	const argv = process.argv.slice(2);

	for (let i = 0; i < argv.length; i++) {
		const key = argv[i].replace(/^--/, '');
		if (!(key in args)) throw new Error(`Unknown option: ${argv[i]}`);
		const value = argv[++i];
		if (value === undefined) throw new Error(`Missing value for: ${argv[i - 1]}`);
		args[key] = typeof args[key] === 'number' ? +value : value;
	}

	return args;
}

function findFiles(dir, result = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!excludedDirs.includes(entry.name)) findFiles(fullPath, result);
		} else if (/\.ps[db]$/i.test(entry.name)) {
			result.push(fullPath);
		}
	}

	return result;
}

function collectFiles(filter) {
	const repoFiles = findFiles(root).sort();
	const resourcesDir = path.join(root, 'resources', 'psd-files');
	const resourceFiles = fs.existsSync(resourcesDir) ? findFiles(resourcesDir).sort() : [];
	const hashes = new Set();
	const files = [];

	for (const file of [...repoFiles, ...resourceFiles]) {
		const relative = path.relative(root, file).replace(/\\/g, '/');
		if (filter && !relative.includes(filter)) continue;

		const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
		if (hashes.has(hash)) continue; // same file exists in both locations

		hashes.add(hash);
		files.push({ path: relative, fullPath: file, hash });
	}

	return files;
}

function checkBuild() {
	const index = path.join(root, 'dist', 'index.js');

	if (!fs.existsSync(index)) {
		console.error('dist/index.js not found, build first: npx tsc -p tsconfig.json');
		process.exit(1);
	}

	const buildTime = fs.statSync(index).mtimeMs;
	const stale = fs.readdirSync(path.join(root, 'src'))
		.filter(f => f.endsWith('.ts') && fs.statSync(path.join(root, 'src', f)).mtimeMs > buildTime);

	if (stale.length) console.warn(`WARNING: dist/ is older than source files (${stale.join(', ')}), rebuild first: npx tsc -p tsconfig.json\n`);
}

function getGC() {
	v8.setFlagsFromString('--expose-gc');
	return vm.runInNewContext('gc');
}

function median(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round = (value, digits = 2) => +value.toFixed(digits);

function formatSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function measure(readPsd, file, iterations, gc) {
	const buffer = fs.readFileSync(file.fullPath);
	const result = { path: file.path, hash: file.hash, size: buffer.byteLength, status: 'ok' };
	const times = [];

	for (let i = 0; i <= iterations; i++) {
		gc();
		const start = performance.now();
		let psd;

		try {
			psd = readPsd(buffer, readOptions);
		} catch (e) {
			result.status = 'error';
			result.error = `${e.message || e}`.split('\n')[0].slice(0, 200);
		}

		const time = performance.now() - start;
		if (i > 0) times.push(time); // first run is warmup

		if (psd && i === 0) {
			result.width = psd.width;
			result.height = psd.height;
			result.layers = countLayers(psd);
		}

		psd = undefined;
	}

	result.min = round(Math.min(...times), 3);
	result.median = round(median(times), 3);
	result.times = times.map(t => round(t, 3));
	return result;
}

function countLayers(parent) {
	let count = 0;

	for (const child of parent.children || []) {
		count += 1 + countLayers(child);
	}

	return count;
}

function summarize(results, elapsed) {
	const ok = results.filter(r => r.status === 'ok');
	const totalBytes = ok.reduce((sum, r) => sum + r.size, 0);
	const totalMin = ok.reduce((sum, r) => sum + r.min, 0);
	const totalMedian = ok.reduce((sum, r) => sum + r.median, 0);

	return {
		files: results.length,
		ok: ok.length,
		failed: results.length - ok.length,
		totalBytes,
		totalMinMs: round(totalMin),
		totalMedianMs: round(totalMedian),
		throughputMBps: round(totalBytes / (1024 * 1024) / (totalMin / 1000)),
		failedTotalMinMs: round(results.filter(r => r.status !== 'ok').reduce((sum, r) => sum + r.min, 0)),
		elapsedMs: round(elapsed),
	};
}

function findCompareFile(compare, outputFile) {
	if (compare) {
		const candidates = [compare, path.join(perfDir, compare), path.join(perfDir, `perf-${compare}.json`)];
		const found = candidates.find(f => fs.existsSync(f) && fs.statSync(f).isFile());
		if (!found) throw new Error(`Summary to compare not found: ${compare}`);
		return found;
	}

	if (!fs.existsSync(perfDir)) return undefined;

	return fs.readdirSync(perfDir)
		.filter(f => /^perf-.*\.json$/.test(f))
		.map(f => path.join(perfDir, f))
		.filter(f => path.resolve(f) !== path.resolve(outputFile))
		.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function printTable(rows, columns) {
	const widths = columns.map((c, i) => Math.max(c.length, ...rows.map(r => `${r[i]}`.length)));
	const line = cells => cells.map((c, i) => i === 0 ? `${c}`.padEnd(widths[i]) : `${c}`.padStart(widths[i])).join('  ');
	console.log(line(columns));
	for (const row of rows) console.log(line(row));
}

function compareSummaries(current, previousFile, threshold) {
	const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
	const previousByHash = new Map(previous.results.map(r => [r.hash, r]));
	const changes = [];
	const statusChanges = [];
	let currentTotal = 0, previousTotal = 0, logRatioSum = 0;

	for (const r of current.results) {
		const p = previousByHash.get(r.hash);
		if (!p) continue;

		if (p.status !== r.status) {
			statusChanges.push(`${r.path}: ${p.status} -> ${r.status}${r.error ? ` (${r.error})` : ''}`);
			continue;
		}

		if (r.status !== 'ok') continue;

		currentTotal += r.min;
		previousTotal += p.min;
		logRatioSum += Math.log(Math.max(r.min, 0.001) / Math.max(p.min, 0.001));
		changes.push({ path: r.path, before: p.min, after: r.min, ratio: r.min / Math.max(p.min, 0.001) });
	}

	const significant = c => Math.abs(c.after - c.before) >= minDiffMs && Math.abs(c.ratio - 1) >= threshold;
	const regressions = changes.filter(c => c.ratio > 1 && significant(c)).sort((a, b) => (b.after - b.before) - (a.after - a.before));
	const improvements = changes.filter(c => c.ratio < 1 && significant(c)).sort((a, b) => (a.after - a.before) - (b.after - b.before));
	const percent = ratio => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;
	const toRows = list => list.slice(0, 20).map(c => [c.path, c.before.toFixed(2), c.after.toFixed(2), percent(c.ratio)]);

	console.log(`\nComparison with ${path.relative(root, previousFile)} (version ${previous.version}${previous.tag ? `-${previous.tag}` : ''}, ${previous.date})`);
	console.log(`  common files:  ${changes.length}`);
	console.log(`  total (min):   ${previousTotal.toFixed(1)} ms -> ${currentTotal.toFixed(1)} ms (${percent(currentTotal / Math.max(previousTotal, 0.001))})`);
	console.log(`  geometric mean of per-file ratios: ${percent(Math.exp(logRatioSum / Math.max(changes.length, 1)))}`);

	if (previous.node !== current.node || previous.cpu !== current.cpu) {
		console.log(`  NOTE: different environment (${previous.node}, ${previous.cpu})`);
	}

	if (statusChanges.length) {
		console.log(`\nStatus changes (${statusChanges.length}):`);
		for (const s of statusChanges) console.log(`  ${s}`);
	}

	if (regressions.length) {
		console.log(`\nRegressions (${regressions.length}, showing top 20 by ms):`);
		printTable(toRows(regressions), ['file', 'before', 'after', 'change']);
	}

	if (improvements.length) {
		console.log(`\nImprovements (${improvements.length}, showing top 20 by ms):`);
		printTable(toRows(improvements), ['file', 'before', 'after', 'change']);
	}

	if (!regressions.length && !improvements.length && !statusChanges.length) {
		console.log(`\nNo significant changes (threshold ${threshold * 100}%, ${minDiffMs} ms)`);
	}
}

function main() {
	const args = parseArgs();
	checkBuild();

	require('./dist/initializeCanvas');
	const { readPsd } = require('./dist/index');
	const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	const outputFile = path.join(perfDir, `perf-${version}${args.tag ? `-${args.tag}` : ''}${args.filter ? '-filtered' : ''}.json`);
	const gc = getGC();
	const files = collectFiles(args.filter);
	const results = [];
	const start = performance.now();

	console.log(`ag-psd ${version}, ${files.length} files, ${args.iterations} iterations, node ${process.version}`);

	for (let i = 0; i < files.length; i++) {
		if (process.stdout.isTTY) {
			process.stdout.write(`\r[${i + 1}/${files.length}] ${files[i].path}`.slice(0, process.stdout.columns - 1).padEnd(process.stdout.columns - 1));
		}

		results.push(measure(readPsd, files[i], args.iterations, gc));
	}

	if (process.stdout.isTTY) process.stdout.write('\r'.padEnd(process.stdout.columns - 1) + '\r');

	const summary = {
		version,
		tag: args.tag || undefined,
		filter: args.filter || undefined,
		date: new Date().toISOString(),
		node: process.version,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model.trim(),
		iterations: args.iterations,
		readOptions: { useImageData: true },
		total: summarize(results, performance.now() - start),
		results,
	};

	fs.mkdirSync(perfDir, { recursive: true });
	fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2), 'utf8');

	const { total } = summary;
	console.log(`\nfiles:      ${total.files} (${total.ok} ok, ${total.failed} failed)`);
	console.log(`total size: ${formatSize(total.totalBytes)}`);
	console.log(`total time: ${total.totalMinMs.toFixed(1)} ms (min), ${total.totalMedianMs.toFixed(1)} ms (median)`);
	console.log(`throughput: ${total.throughputMBps} MB/s`);
	console.log(`elapsed:    ${(total.elapsedMs / 1000).toFixed(1)} s`);

	console.log('\nSlowest files:');
	const slowest = results.filter(r => r.status === 'ok').sort((a, b) => b.min - a.min).slice(0, 10);
	printTable(slowest.map(r => [r.path, formatSize(r.size), r.min.toFixed(2), r.median.toFixed(2)]), ['file', 'size', 'min ms', 'median ms']);

	console.log(`\nSummary saved to ${path.relative(root, outputFile)}`);

	const compareFile = findCompareFile(args.compare, outputFile);
	if (compareFile) compareSummaries(summary, compareFile, args.threshold);
}

main();
