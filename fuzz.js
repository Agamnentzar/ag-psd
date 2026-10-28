// Coverage guided mutation fuzzer for PSD (and ABR, CSH, ASE) decoding
//
// Mutates sample files from the repository (and resources/), generated documents and previously saved corpus,
// decodes them in worker threads and reports inputs that cause bugs: unexpected exception types (TypeError,
// RangeError other than out of bounds reads, ...), hangs, out of memory crashes, memory limit bypasses and files
// written by the library that can't be read back. Inputs reaching new code (V8 block coverage) are added to corpus.
//
// usage: npx tsc -p tsconfig.json && node fuzz.js [options]
//   --format <name>    psd, abr, csh or ase (default psd)
//   --time <s>         run time in seconds, 0 = unlimited (default 60)
//   --iterations <n>   number of mutated inputs to run, 0 = unlimited (default 0)
//   --workers <n>      number of worker threads (default number of CPUs - 1, max 8)
//   --seed <n>         random seed (default random, printed at start)
//   --timeout <ms>     time limit for decoding single input (default 5000)
//   --heap <mb>        heap size limit of worker threads (default 1024)
//   --memory <mb>      totalMemoryLimit read option (default 128)
//   --max-size <kb>    skip seed files larger than this (default 1024)
//   --filter <text>    only use seed files with path containing text
//   --roundtrip <0|1>  write successfully read documents and read them back (default 1)
//   --coverage <0|1>   use coverage to grow the corpus (default 1)
//   --replay <file>    run single file and print findings
//   --minimize <file>  shrink file while it still produces the same finding (saved as <file>.min.<ext>)
//
// Findings are saved to results/fuzz/<format>/findings (smallest input for each unique finding with .txt
// description), inputs reaching new code are saved to results/fuzz/<format>/corpus and reused in later runs.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const root = __dirname;
const excludedDirs = ['node_modules', 'dist', 'dist-es', 'results', 'coverage', 'coverage-remapped', '.git'];
const extensions = { psd: /\.ps[db]$/i, abr: /\.abr$/i, csh: /\.csh$/i, ase: /\.ase$/i };

// errors that are expected for malformed input (everything else thrown by the library is an Error with a message)
function isBug(e) {
	if (!(e instanceof Error)) return true;
	if (e instanceof TypeError || e instanceof ReferenceError || e instanceof SyntaxError || e instanceof EvalError) return true;
	if (e instanceof RangeError) return e.message !== 'Offset is outside the bounds of the DataView';
	return /Maximum call stack|out of memory|allocation failed/i.test(e.message);
}

// worker

function workerMain() {
	const { format, memoryLimit, roundtrip, coverage } = workerData;
	try { require('source-map-support').install(); } catch { }

	const v8 = require('v8');
	const vm = require('vm');
	const limit = memoryLimit * 1024 * 1024;
	const noop = () => { };
	let gc = undefined;
	let lib = undefined, decodeJpeg = undefined; // loaded after coverage is enabled
	let findings = [];
	let strict = false;
	let recorded = new WeakSet(); // errors already recorded by inner handler

	try {
		v8.setFlagsFromString('--expose-gc');
		gc = vm.runInNewContext('gc');
	} catch { }

	const toFinding = (kind, stage, e) => ({
		kind,
		stage,
		name: e && e.name,
		message: `${e && e.message || e}`.slice(0, 500),
		stack: `${e && e.stack || ''}`.split('\n').slice(0, 12).join('\n'),
	});

	const record = (kind, stage, e) => {
		if (e && typeof e === 'object') {
			if (recorded.has(e)) return;
			recorded.add(e);
		}

		findings.push(toFinding(kind, stage, e));
	};

	// errors in additional info and image resource handlers are swallowed by the reader (unless throwForMissingFeatures
	// is set), the data is silently dropped, record the ones that are bugs
	function wrapHandlers(map, prefix) {
		for (const handler of new Set(Object.values(map))) {
			const read = handler.read;
			handler.read = function (...args) {
				try {
					return read.apply(this, args);
				} catch (e) {
					if (isBug(e)) record(strict ? 'strict' : 'swallowed', `${prefix} ${handler.key}`, e);
					throw e;
				}
			};
		}
	}

	function run(buffer) {
		findings = [];
		recorded = new WeakSet();
		const times = {};
		const check = (stage, fn, allErrors = false) => {
			const start = performance.now();
			strict = stage === 'read-strict';

			try {
				return fn();
			} catch (e) {
				if (isBug(e)) {
					record(strict ? 'strict' : 'exception', stage, e);
				} else if (allErrors) {
					record('roundtrip', stage, e);
				}
				return undefined;
			} finally {
				strict = false;
				times[stage] = (times[stage] || 0) + performance.now() - start;
			}
		};
		const checkRetained = (stage, value) => {
			const used = process.memoryUsage().arrayBuffers - baseline;
			if (used < limit * 2 + buffer.byteLength * 4 + 64 * 1024 * 1024) return;
			if (gc) gc();
			const retained = process.memoryUsage().arrayBuffers - baseline;
			if (value !== undefined && retained >= limit * 2 + buffer.byteLength * 4 + 64 * 1024 * 1024) {
				findings.push({ kind: 'memory', stage, message: `retained ${Math.round(retained / 1024 / 1024)} MB with ${memoryLimit} MB memory limit` });
			}
		};
		const baseline = process.memoryUsage().arrayBuffers;

		if (format === 'psd') {
			const options = { useImageData: true, useRawThumbnail: true, totalMemoryLimit: limit, logMissingFeatures: true, log: noop };
			const psd = check('read', () => lib.readPsd(buffer, options));
			checkRetained('read', psd);

			if (psd) {
				const thumbnail = psd.imageResources && psd.imageResources.thumbnailRaw;

				if (thumbnail && thumbnail.data && thumbnail.width * thumbnail.height * 4 <= limit) {
					check('jpeg', () => decodeJpeg(thumbnail.data, (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) })));
				}

				if (roundtrip) {
					const written = check('write', () => lib.writePsdUint8Array(psd, { psb: buffer[5] === 2, logMissingFeatures: true, log: noop }));
					if (written) check('reread', () => lib.readPsd(written, options), true);
				}
			}

			// raw data and helper functions for decoding it later (sizes are checked first, as README recommends)
			const raw = check('read-raw', () => lib.readPsd(buffer, { useRawData: true, skipThumbnail: true, totalMemoryLimit: limit, log: noop }));

			if (raw) {
				const fits = (width, height) => width * height * 10 * Math.max(1, (raw.bitsPerChannel || 8) / 8) <= limit;
				if (fits(raw.width, raw.height)) check('raw-composite', () => lib.getCompositeImageData(raw));

				const layers = [];
				const addLayers = list => (list || []).forEach(l => { layers.push(l); addLayers(l.children); });
				addLayers(raw.children);

				for (const layer of layers.slice(0, 100)) {
					const size = l => !l || fits(Math.max(0, (l.right | 0) - (l.left | 0)), Math.max(0, (l.bottom | 0) - (l.top | 0)));
					if (size(layer)) check('raw-layer', () => lib.getLayerImageData(layer));
					if (size(layer.mask)) check('raw-mask', () => lib.getLayerMaskImageData(layer));
					if (size(layer.realMask)) check('raw-real-mask', () => lib.getLayerRealMaskImageData(layer));
				}
			}

			// strict mode goes through different code paths (it throws instead of skipping unsupported data)
			check('read-strict', () => lib.readPsd(buffer, { ...options, throwForMissingFeatures: true, skipLayerImageData: true, skipCompositeImageData: true }));
		} else if (format === 'abr') {
			const abr = check('read', () => lib.readAbr(buffer, { totalMemoryLimit: limit, logMissingFeatures: true, log: noop }));
			checkRetained('read', abr);
			check('read-strict', () => lib.readAbr(buffer, { totalMemoryLimit: limit, throwForMissingFeatures: true }));
		} else if (format === 'csh') {
			check('read', () => lib.readCsh(buffer));
		} else if (format === 'ase') {
			check('read', () => lib.readAse(buffer));
			check('read-strict', () => lib.readAse(buffer, { throwForMissingFeatures: true }));
		}

		return { findings, times };
	}

	// coverage

	let session = undefined;
	const post = (method, params) => new Promise((resolve, reject) => {
		session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
	});
	const scriptIds = new Map();
	const seen = new Set();
	const bucket = count => count < 2 ? 1 : (count < 4 ? 2 : (count < 16 ? 3 : (count < 256 ? 4 : 5)));

	function collectCoverage(result) {
		const keys = [];

		for (const script of result.result) {
			if (!/[\\/]dist[\\/](?!test[\\/])[^\\/]+\.js$/.test(script.url.replace(/^file:\/\/\//, ''))) continue;

			let id = scriptIds.get(script.url);
			if (id === undefined) scriptIds.set(script.url, id = path.basename(script.url));

			for (const fn of script.functions) {
				for (const range of fn.ranges) {
					if (range.count === 0) continue;
					const key = `${id}:${range.startOffset}:${range.endOffset}:${bucket(range.count)}`;

					if (!seen.has(key)) {
						seen.add(key);
						keys.push(key);
					}
				}
			}
		}

		return keys;
	}

	async function main() {
		if (coverage) {
			const inspector = require('inspector');
			session = new inspector.Session();
			session.connect();
			await post('Profiler.enable');
			await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
		}

		lib = require(path.join(root, 'dist', 'index.js'));
		decodeJpeg = require(path.join(root, 'dist', 'jpeg.js')).decodeJpeg;
		wrapHandlers(require(path.join(root, 'dist', 'additionalInfo.js')).infoHandlersMap, 'additional info');
		wrapHandlers(require(path.join(root, 'dist', 'imageResources.js')).resourceHandlersMap, 'image resource');

		parentPort.on('message', async job => {
			if (session) await post('Profiler.takePreciseCoverage'); // resets counters
			const start = performance.now();
			const { findings, times } = run(new Uint8Array(job.buffer));
			const time = performance.now() - start;
			const keys = session ? collectCoverage(await post('Profiler.takePreciseCoverage')) : [];
			parentPort.postMessage({ id: job.id, findings, keys, time, times });
		});

		parentPort.postMessage({ ready: true });
	}

	main().catch(e => { throw e; });
}

// main thread

function parseArgs() {
	const args = {
		format: 'psd', time: 60, iterations: 0, workers: Math.max(1, Math.min(8, os.cpus().length - 1)),
		seed: (Math.random() * 0x7fffffff) | 0, timeout: 5000, heap: 1024, memory: 128, 'max-size': 1024, filter: '',
		roundtrip: 1, coverage: 1, replay: '', minimize: '',
	};
	const argv = process.argv.slice(2);

	for (let i = 0; i < argv.length; i++) {
		const key = argv[i].replace(/^--/, '');
		if (!(key in args)) throw new Error(`Unknown option: ${argv[i]}`);
		const value = argv[++i];
		if (value === undefined) throw new Error(`Missing value for: ${argv[i - 1]}`);
		args[key] = typeof args[key] === 'number' ? +value : value;
	}

	if (!extensions[args.format]) throw new Error(`Unknown format: ${args.format}`);
	return args;
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

function createRandom(seed) {
	let state = seed >>> 0;

	// mulberry32
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	return {
		next,
		int: max => Math.floor(next() * max),
		pick: array => array[Math.floor(next() * array.length)],
	};
}

function findFiles(dir, pattern, result = []) {
	if (!fs.existsSync(dir)) return result;

	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (!excludedDirs.includes(entry.name)) findFiles(fullPath, pattern, result);
		} else if (pattern.test(entry.name)) {
			result.push(fullPath);
		}
	}

	return result;
}

// small documents in all supported color modes and bit depths, mutating small files is faster
function generateSeeds() {
	const { writePsdUint8Array } = require(path.join(root, 'dist', 'index.js'));
	const seeds = [];
	const pixels = (width, height, ArrayType, max) => {
		const data = new ArrayType(width * height * 4);
		for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? (i % 8 === 3 ? max : max / 2) : ((i * 37) % 101) / 100 * max;
		return { width, height, data };
	};

	const configs = [
		{ colorMode: 3, bitsPerChannel: 8, ArrayType: Uint8ClampedArray, max: 255 },
		{ colorMode: 3, bitsPerChannel: 16, ArrayType: Uint16Array, max: 65535 },
		{ colorMode: 3, bitsPerChannel: 32, ArrayType: Float32Array, max: 1 },
		{ colorMode: 1, bitsPerChannel: 8, ArrayType: Uint8ClampedArray, max: 255 },
		{ colorMode: 1, bitsPerChannel: 16, ArrayType: Uint16Array, max: 65535 },
		{ colorMode: 4, bitsPerChannel: 8, ArrayType: Uint8ClampedArray, max: 255 },
		{ colorMode: 4, bitsPerChannel: 16, ArrayType: Uint16Array, max: 65535 },
	];

	for (const { colorMode, bitsPerChannel, ArrayType, max } of configs) {
		for (const options of [{}, { psb: true }, { compress: true }]) {
			const psd = {
				width: 8, height: 6, colorMode, bitsPerChannel,
				imageData: pixels(8, 6, ArrayType, max),
				children: [
					{ name: 'layer', left: 1, top: 1, imageData: pixels(5, 4, ArrayType, max), mask: { left: 0, top: 0, imageData: pixels(3, 3, ArrayType, max) } },
					{ name: 'group', opened: true, children: [{ name: 'text', text: { text: 'Text', style: { fontSize: 12 } } }] },
					{ name: 'adjustment', adjustment: { type: 'levels', channels: [{ shadowInput: 10, highlightInput: 200, shadowOutput: 0, highlightOutput: 255, midtoneInput: 1.2 }] } },
				],
			};

			try {
				seeds.push({ name: `generated/mode${colorMode}-${bitsPerChannel}bit${options.psb ? '-psb' : ''}${options.compress ? '-zip' : ''}`, buffer: writePsdUint8Array(psd, options) });
			} catch (e) {
				console.warn(`Failed to generate seed (mode ${colorMode}, ${bitsPerChannel} bit): ${e.message}`);
			}
		}
	}

	const palette = Array.from({ length: 256 }, (_, i) => ({ r: i, g: 255 - i, b: (i * 7) & 0xff }));
	seeds.push({ name: 'generated/indexed', buffer: writePsdUint8Array({ width: 8, height: 6, colorMode: 2, palette, imageData: pixels(8, 6, Uint8ClampedArray, 255) }) });
	seeds.push({ name: 'generated/bitmap', buffer: writePsdUint8Array({ width: 13, height: 6, colorMode: 0, imageData: pixels(13, 6, Uint8ClampedArray, 255) }) });
	return seeds;
}

function loadSeeds(args, corpusDir) {
	const pattern = extensions[args.format];
	const files = [
		...findFiles(path.join(root, 'test'), pattern),
		...findFiles(path.join(root, 'resources', args.format === 'psd' ? 'psd-files' : ''), pattern),
		...findFiles(corpusDir, pattern),
	];
	const hashes = new Set();
	const seeds = [];
	let skipped = 0;

	const add = (name, buffer) => {
		const hash = sha1(buffer);
		if (hashes.has(hash)) return;
		hashes.add(hash);
		seeds.push({ name, buffer, hash });
	};

	for (const file of files) {
		const name = path.relative(root, file).replace(/\\/g, '/');
		if (args.filter && !name.includes(args.filter)) continue;

		if (fs.statSync(file).size > args['max-size'] * 1024) {
			skipped++;
			continue;
		}

		add(name, new Uint8Array(fs.readFileSync(file)));
	}

	if (args.format === 'psd' && !args.filter) {
		for (const seed of generateSeeds()) add(seed.name, seed.buffer);
	}

	return { seeds, skipped };
}

const sha1 = buffer => crypto.createHash('sha1').update(buffer).digest('hex');

// offsets of length and count fields, signatures and other values that are likely to change decoding
function findStructureOffsets(buffer) {
	const offsets = [2, 4, 12, 14, 18, 22, 24, 26];
	const text = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).toString('latin1');
	const markers = /8BIM|8B64|long|doub|TEXT|Objc|VlLs|UntF|enum|tdta|obj |8BPT|samp|desc/g;
	let match;

	while ((match = markers.exec(text)) && offsets.length < 4000) {
		offsets.push(match.index + 4); // value, length or key following the marker
		if (match[0] === '8BIM' || match[0] === '8B64') offsets.push(match.index + 8);
	}

	if (buffer.byteLength >= 30) {
		// color mode data, image resources and layer and mask info section lengths
		let offset = 26;

		for (let i = 0; i < 3 && offset + 4 <= buffer.byteLength; i++) {
			offsets.push(offset);
			offset += 4 + Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).readUInt32BE(offset);
		}
	}

	return offsets.filter(o => o < buffer.byteLength);
}

const interesting8 = [0, 1, 2, 0x7f, 0x80, 0xfe, 0xff];
const interesting16 = [0, 1, 2, 3, 4, 8, 16, 32, 255, 256, 0x7fff, 0x8000, 0xfffe, 0xffff, 30000, 30001];
const interesting32 = [0, 1, 2, 4, 16, 255, 256, 0xffff, 0x10000, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff, 0x40000000, 0x1000000];

function mutate(entry, corpus, rng) {
	let data = entry.buffer.slice();
	const offsets = entry.offsets || (entry.offsets = findStructureOffsets(entry.buffer));
	const count = 1 << rng.int(4);
	const applied = [];

	const set16 = (pos, value) => { if (pos + 2 <= data.length) { data[pos] = value >>> 8; data[pos + 1] = value; } };
	const set32 = (pos, value) => { if (pos + 4 <= data.length) { for (let i = 0; i < 4; i++) data[pos + i] = value >>> (24 - i * 8); } };
	const get32 = pos => pos + 4 <= data.length ? ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0 : 0;
	const structurePos = () => offsets.length ? rng.pick(offsets) : rng.int(data.length);
	const chunkLength = () => 1 + rng.int(rng.next() < 0.8 ? 16 : 1024);

	for (let i = 0; i < count && data.length; i++) {
		const pos = rng.int(data.length);
		const op = rng.int(13);

		switch (op) {
			case 0: data[pos] ^= 1 << rng.int(8); break;
			case 1: data[pos] = rng.int(256); break;
			case 2: data[pos] = rng.pick(interesting8); break;
			case 3: set16(pos, rng.pick(interesting16)); break;
			case 4: set32(pos, rng.pick(interesting32)); break;
			case 5: { const p = structurePos(); set32(p, get32(p) + rng.pick([-8, -4, -2, -1, 1, 2, 4, 8, 0x10000])); break; }
			case 6: set32(structurePos(), rng.pick(interesting32)); break;
			case 7: data = data.slice(0, Math.max(1, rng.next() < 0.5 ? rng.int(data.length) : data.length - 1 - rng.int(64))); break;
			case 8: { const length = chunkLength(); data = concat(data.subarray(0, pos), data.subarray(pos + length)); break; }
			case 9: { const length = chunkLength(); const target = rng.int(data.length); data = concat(data.subarray(0, target), data.subarray(pos, pos + length), data.subarray(target)); break; }
			case 10: { const bytes = new Uint8Array(chunkLength()).map(() => rng.next() < 0.5 ? rng.pick(interesting8) : rng.int(256)); data = concat(data.subarray(0, pos), bytes, data.subarray(pos)); break; }
			case 11: { // overwrite with data from another input at the same offset (keeps structure aligned)
				const other = rng.pick(corpus).buffer;
				const length = chunkLength();
				if (pos < other.length) data.set(other.subarray(pos, Math.min(pos + length, other.length, data.length)), pos);
				break;
			}
			case 12: { // header fields
				if (data.length < 26) break;
				const field = rng.int(5);
				if (field === 0) set16(12, rng.pick([0, 1, 2, 3, 4, 5, 6, 56, 57, 0xffff])); // channels
				if (field === 1) set32(14, rng.pick([0, 1, 2, 30000, 30001, 300000, 0x7fffffff])); // height
				if (field === 2) set32(18, rng.pick([0, 1, 2, 30000, 30001, 300000, 0x7fffffff])); // width
				if (field === 3) set16(22, rng.pick([0, 1, 8, 16, 32, 64])); // bits per channel
				if (field === 4) set16(24, rng.pick([0, 1, 2, 3, 4, 7, 8, 9, 10])); // color mode
				break;
			}
		}

		applied.push(op);
	}

	if (data.length > 16 * 1024 * 1024) data = data.slice(0, 16 * 1024 * 1024);
	return { buffer: data, mutations: applied };
}

function concat(...arrays) {
	const result = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
	let offset = 0;

	for (const a of arrays) {
		result.set(a, offset);
		offset += a.length;
	}

	return result;
}

// runs inputs in a worker thread, restarts it after hangs and crashes
class Runner {
	constructor(args) {
		this.args = args;
		this.nextId = 0;
		this.start();
	}

	start() {
		const { format, memory, roundtrip, coverage, heap } = this.args;
		this.pending = undefined;
		this.worker = new Worker(__filename, {
			workerData: { format, memoryLimit: memory, roundtrip: !!roundtrip, coverage: !!coverage },
			resourceLimits: { maxOldGenerationSizeMb: heap },
			stdout: true, // library and worker logs are not shown
			stderr: true,
		});
		this.worker.stdout.resume();
		this.worker.stderr.resume();
		this.ready = new Promise(resolve => this.resolveReady = resolve);
		this.worker.on('message', message => {
			if (message.ready) return this.resolveReady();
			if (this.pending && this.pending.id === message.id) this.finish(message);
		});
		this.worker.on('error', error => this.fail(error.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'oom' : 'crash', `${error.message || error}`));
		this.worker.on('exit', code => this.fail('crash', `worker exited with code ${code}`));
	}

	finish(result) {
		const pending = this.pending;
		if (!pending) return;
		this.pending = undefined;
		clearTimeout(pending.timer);
		pending.resolve(result);
	}

	fail(kind, message) {
		const pending = this.pending;
		this.worker.removeAllListeners('exit');
		this.worker.removeAllListeners('error');
		this.worker.terminate();
		this.start();
		if (pending) this.finish.call({ pending }, { id: pending.id, findings: [{ kind, stage: 'worker', message }], keys: [], time: 0 });
	}

	// inputs are run one at a time
	run(buffer) {
		const result = (this.queue || Promise.resolve()).then(() => this.runNow(buffer));
		this.queue = result.catch(() => { });
		return result;
	}

	async runNow(buffer) {
		await this.ready;
		const id = this.nextId++;
		const copy = buffer.slice();

		return new Promise(resolve => {
			this.pending = {
				id, resolve,
				timer: setTimeout(() => this.fail('timeout', `decoding took more than ${this.args.timeout} ms`), this.args.timeout),
			};
			this.worker.postMessage({ id, buffer: copy.buffer }, [copy.buffer]);
		});
	}

	close() {
		this.worker.removeAllListeners('exit');
		return this.worker.terminate();
	}
}

// kinds of exceptions, the same exception can be found in different ways, the most severe one is reported:
// exception - thrown to the caller, swallowed - thrown in additional info or image resource handler and silently ignored
// by the reader (data is lost), strict - thrown only with throwForMissingFeatures option
const exceptionKinds = ['exception', 'swallowed', 'strict'];
const severity = kind => exceptionKinds.includes(kind) ? exceptionKinds.length - exceptionKinds.indexOf(kind) : 10;

// unique identifier of a finding: error type, message (without numbers) and the place it was thrown in
function signature(finding) {
	const base = root.replace(/\\/g, '/') + '/';
	const frame = (finding.stack || '').split('\n').slice(1)
		.map(line => line.trim().replace(/\\/g, '/'))
		.find(line => line.includes(base) && !line.includes('/node_modules/') && !line.includes('/fuzz.js')) || '';
	const location = frame.replace(/^at /, '').replace(base, '').replace('(', '').replace(/:\d+\)?$/, '');
	const message = (finding.message || '').replace(/\d+/g, 'N').slice(0, 120);
	const kind = exceptionKinds.includes(finding.kind) ? 'exception' : finding.kind;
	const stage = finding.kind === 'roundtrip' || finding.kind === 'memory' ? finding.stage : '';
	return [kind, stage, finding.name || '', message, location].filter(x => x).join(' | ');
}

function describe(finding) {
	return [
		`kind: ${finding.kind}`,
		finding.stage && `stage: ${finding.stage}`,
		`message: ${finding.name ? `${finding.name}: ` : ''}${finding.message}`,
		finding.stack && `stack:\n${finding.stack.split('\n').slice(1).join('\n')}`,
	].filter(x => x).join('\n');
}

function formatTime(seconds) {
	return seconds < 60 ? `${seconds.toFixed(0)}s` : `${Math.floor(seconds / 60)}m${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
}

async function replay(args) {
	const runner = new Runner(args);
	const result = await runner.run(new Uint8Array(fs.readFileSync(args.replay)));
	await runner.close();

	// the same error is often found in several stages, show it once (in its most severe kind)
	const unique = new Map();

	for (const finding of result.findings) {
		const sig = signature(finding);
		const existing = unique.get(sig);
		if (existing) existing.stages.push(finding.stage);
		if (!existing || severity(finding.kind) > severity(existing.finding.kind)) unique.set(sig, { finding, stages: [...(existing ? existing.stages : []), ...(existing ? [] : [finding.stage])] });
	}

	for (const { finding, stages } of unique.values()) console.log(`${describe({ ...finding, stage: [...new Set(stages)].join(', ') })}\n`);
	if (result.findings.length) process.exitCode = 1;

	const times = Object.entries(result.times || {}).map(([stage, time]) => `${stage} ${time.toFixed(1)} ms`).join(', ');
	console.log(`${unique.size || 'No'} findings, total ${result.time.toFixed(1)} ms${times ? ` (${times})` : ''}`);
}

async function minimize(args) {
	const runner = new Runner({ ...args, coverage: 0 });
	let best = new Uint8Array(fs.readFileSync(args.minimize));
	const initial = await runner.run(best);
	if (!initial.findings.length) {
		console.log('File doesn\'t produce any findings');
		return runner.close();
	}

	const target = signature(initial.findings[0]);
	const maxRuns = initial.findings[0].kind === 'timeout' ? 200 : 5000;
	const reproduces = async candidate => (await runner.run(candidate)).findings.some(f => signature(f) === target);
	let runs = 0;

	console.log(`Minimizing ${best.length} bytes: ${target}`);

	// remove chunks of decreasing size (starting with truncation of the end)
	for (let chunk = best.length >> 1; chunk >= 1 && runs < maxRuns; chunk >>= 1) {
		for (let pos = best.length - chunk; pos >= 0 && runs < maxRuns; pos -= chunk) {
			const candidate = concat(best.subarray(0, pos), best.subarray(pos + chunk));
			runs++;

			if (await reproduces(candidate)) best = candidate;
		}

		console.log(`  chunk ${chunk}: ${best.length} bytes`);
	}

	const ext = path.extname(args.minimize);
	const output = args.minimize.slice(0, args.minimize.length - ext.length) + '.min' + ext;
	fs.writeFileSync(output, best);
	console.log(`Saved ${best.length} bytes (${runs} runs) to ${output}`);
	await runner.close();
}

async function fuzz(args) {
	const outputDir = path.join(root, 'results', 'fuzz', args.format);
	const corpusDir = path.join(outputDir, 'corpus');
	const findingsDir = path.join(outputDir, 'findings');
	fs.mkdirSync(corpusDir, { recursive: true });
	fs.mkdirSync(findingsDir, { recursive: true });

	const { seeds, skipped } = loadSeeds(args, corpusDir);
	if (!seeds.length) throw new Error('No seed files found');

	const rng = createRandom(args.seed);
	const corpus = [];
	const coverage = new Set();
	const findings = new Map(); // signature -> { finding, size, count, file }
	const startTime = Date.now();
	const ext = args.format === 'psd' ? 'psd' : args.format;
	let execs = 0, lastExecs = 0, lastReport = startTime, timeouts = 0;

	console.log(`Fuzzing ${args.format} decoding with ${seeds.length} seed files${skipped ? ` (${skipped} skipped, larger than ${args['max-size']} KB)` : ''}, ` +
		`${args.workers} workers, seed ${args.seed}${args.time ? `, ${args.time}s` : ''}`);

	const record = (input, result, origin) => {
		execs++;
		let newCoverage = false;

		for (const key of result.keys) {
			if (!coverage.has(key)) {
				coverage.add(key);
				newCoverage = true;
			}
		}

		for (const finding of result.findings) {
			if (finding.kind === 'timeout') timeouts++;
			const sig = signature(finding);
			const existing = findings.get(sig);
			const moreSevere = existing && severity(finding.kind) > severity(existing.finding.kind);

			if (!existing || moreSevere || (input.length < existing.size && finding.kind === existing.finding.kind)) {
				// file name doesn't include kind, so it stays the same when more severe kind is found
				const name = sha1(sig).slice(0, 10);
				const file = path.join(findingsDir, `${name}.${ext}`);
				fs.writeFileSync(file, input);
				fs.writeFileSync(path.join(findingsDir, `${name}.txt`), `${sig}\n\n${describe(finding)}\n\norigin: ${origin}\nsize: ${input.length}\n`);
				const time = formatTime((Date.now() - startTime) / 1000);
				if (!existing || moreSevere) console.log(`\n[${time}] ${existing ? 'NOW ' : 'NEW '}${finding.kind}: ${sig}\n  ${path.relative(root, file)} (from ${origin})`);
				findings.set(sig, { finding, size: input.length, count: (existing ? existing.count : 0) + 1, file });
			} else {
				existing.count++;
			}
		}

		return newCoverage;
	};

	const runners = Array.from({ length: args.workers }, () => new Runner(args));

	// coverage makes decoding several times slower, timeouts are verified without it
	let verifier = undefined;
	const run = async (runner, buffer) => {
		const result = await runner.run(buffer);

		if (args.coverage && result.findings.some(f => f.kind === 'timeout')) {
			verifier = verifier || new Runner({ ...args, coverage: 0 });
			const verified = await verifier.run(buffer);
			if (!verified.findings.some(f => f.kind === 'timeout')) result.findings = result.findings.filter(f => f.kind !== 'timeout');
		}

		return result;
	};

	// initial pass over seed files (also finds bugs in seed files and collects baseline coverage)
	let seedIndex = 0;
	await Promise.all(runners.map(async runner => {
		while (seedIndex < seeds.length) {
			const seed = seeds[seedIndex++];
			const result = await run(runner, seed.buffer);
			record(seed.buffer, result, seed.name);
			if (!result.findings.some(f => f.kind === 'timeout' || f.kind === 'oom')) corpus.push({ ...seed, time: result.time });
		}
	}));

	console.log(`Seeds done: ${corpus.length} in corpus, ${coverage.size} coverage keys, ${findings.size} findings`);

	const done = () => (args.time && Date.now() - startTime > args.time * 1000) || (args.iterations && execs - seeds.length >= args.iterations);
	let stopping = false;
	process.on('SIGINT', () => {
		if (stopping) process.exit(1);
		stopping = true;
		console.log('\nStopping...');
	});

	await Promise.all(runners.map(async runner => {
		while (!done() && !stopping) {
			// prefer small and fast inputs (they're mutated more efficiently)
			let parent = rng.pick(corpus);
			const other = rng.pick(corpus);
			if (other.buffer.length * (other.time + 1) < parent.buffer.length * (parent.time + 1) && rng.next() < 0.5) parent = other;

			const { buffer, mutations } = mutate(parent, corpus, rng);
			const result = await run(runner, buffer);

			if (record(buffer, result, `${parent.name} + [${mutations.join(',')}]`) && !result.findings.some(f => f.kind === 'timeout' || f.kind === 'oom')) {
				const hash = sha1(buffer);
				const name = path.relative(root, path.join(corpusDir, `${hash}.${ext}`)).replace(/\\/g, '/');
				fs.writeFileSync(path.join(root, name), buffer);
				corpus.push({ name, buffer, hash, time: result.time });
			}

			if (Date.now() - lastReport > 10000) {
				const now = Date.now();
				const rate = (execs - lastExecs) / ((now - lastReport) / 1000);
				console.log(`[${formatTime((now - startTime) / 1000)}] execs ${execs} (${rate.toFixed(0)}/s), corpus ${corpus.length}, ` +
					`coverage ${coverage.size}, findings ${findings.size}, timeouts ${timeouts}`);
				lastReport = now;
				lastExecs = execs;
			}
		}
	}));

	await Promise.all([...runners, ...(verifier ? [verifier] : [])].map(r => r.close()));

	console.log(`\nDone in ${formatTime((Date.now() - startTime) / 1000)}: ${execs} execs, corpus ${corpus.length}, coverage ${coverage.size}`);

	if (findings.size) {
		console.log(`\n${findings.size} unique findings (saved in ${path.relative(root, findingsDir)}):`);
		const sorted = [...findings].sort((a, b) => (severity(b[1].finding.kind) - severity(a[1].finding.kind)) || (b[1].count - a[1].count));

		for (const [sig, { count, size, file, finding }] of sorted) {
			console.log(`  ${String(count).padStart(5)}x  ${finding.kind.padEnd(9)}  ${sig}\n          ${path.relative(root, file)} (${size} bytes)`);
		}
		process.exitCode = 1;
	} else {
		console.log('No findings');
	}
}

if (isMainThread) {
	const args = parseArgs();
	checkBuild();
	const task = args.replay ? replay(args) : (args.minimize ? minimize(args) : fuzz(args));
	task.catch(e => {
		console.error(e);
		process.exit(1);
	});
} else {
	workerMain();
}
