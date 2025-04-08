import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { readPsdFromFile, importPSD, loadImagesFromDirectory, compareCanvases, saveCanvas, createReaderFromBuffer, compareBuffers, compareTwoFiles } from './common';
import { Layer, ReadOptions, Psd } from '../psd';
import { byteArrayToBase64, readPsd, writePsdBuffer } from '../index';
import { readPsd as readPsdInternal } from '../psdReader';
import { decodeEngineData2 } from '../engineData2';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'read');
const readWriteFilesPath = path.join(testFilesPath, 'read-write');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');
const opts: ReadOptions = {
	throwForMissingFeatures: true,
	logMissingFeatures: true,
	strict: false,
	debug: true,
};

describe('PsdReader', () => {
	it('reads width and height properly', () => {
		const psd = readPsdFromFile(path.join(readFilesPath, 'blend-mode', 'src.psd'), { ...opts });
		expect(psd.width).equal(300);
		expect(psd.height).equal(200);
	});

	it('skips composite image data', () => {
		const psd = readPsdFromFile(path.join(readFilesPath, 'layers', 'src.psd'), { ...opts, skipCompositeImageData: true });
		expect(psd.canvas).not.ok;
	});

	it('skips layer image data', () => {
		const psd = readPsdFromFile(path.join(readFilesPath, 'layers', 'src.psd'), { ...opts, skipLayerImageData: true });
		expect(psd.children![0].canvas).not.ok;
	});

	it('reads PSD from Buffer with offset', () => {
		const file = fs.readFileSync(path.join(readFilesPath, 'layers', 'src.psd'));
		const outer = Buffer.alloc(file.byteLength + 100);
		file.copy(outer, 100);
		const inner = Buffer.from(outer.buffer, 100, file.byteLength);

		const psd = readPsd(inner, opts);

		expect(psd.width).equal(300);
	});

	it.skip('duplicate smart', () => {
		const psd = readPsdFromFile(path.join('resources', 'src.psd'), { ...opts });

		const child = psd.children![1].children![0];
		psd.children![1].children!.push(child);

		// const child = psd.children![0];
		// delete child.id;
		// psd.children!.push(child);

		fs.writeFileSync('output.psd', writePsdBuffer(psd, {
			trimImageData: false,
			generateThumbnail: true,
			noBackground: true
		}));

		const psd2 = readPsdFromFile(path.join('output.psd'), { ...opts });

		console.log(psd2.width);
	});

	// skipping "pattern" test because it requires zip cimpression of patterns
	// skipping "cmyk" test because we can't convert CMYK to RGB
	fs.readdirSync(readFilesPath).filter(f => !/pattern|cmyk/.test(f)).forEach(f => {
		// fs.readdirSync(readFilesPath).filter(f => /ignore-text-curve/.test(f)).forEach(f => {
		it(`reads PSD file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const fileName = fs.existsSync(path.join(basePath, 'src.psb')) ? 'src.psb' : 'src.psd';
			const psd = readPsdFromFile(path.join(basePath, fileName), {
				...opts,
				// logDevFeatures: true,
				log: (...args: any[]) => console.log(`[${f}]`, ...args),
			});
			const expected = importPSD(basePath);
			const images = loadImagesFromDirectory(basePath);
			const compare: { name: string; canvas: HTMLCanvasElement | undefined; skip?: boolean; }[] = [];
			const compareFiles: { name: string; data: Uint8Array; }[] = [];

			compare.push({ name: `canvas.png`, canvas: psd.canvas });
			psd.canvas = undefined;
			delete psd.imageData;
			if (psd.imageResources) delete psd.imageResources.xmpMetadata;

			let i = 0;

			function pushLayerCanvases(layers: Layer[]) {
				for (const l of layers) {
					const layerId = i;

					if (!l.children || l.mask) i++;

					if (l.children) {
						pushLayerCanvases(l.children);
					} else {
						compare.push({ name: `layer-${layerId}.png`, canvas: l.canvas });
						l.canvas = undefined;
						delete l.imageData;
					}

					if (l.mask) {
						compare.push({ name: `layer-${layerId}-mask.png`, canvas: l.mask.canvas });
						delete l.mask.canvas;
						delete l.mask.imageData;
					}

					if (l.realMask) {
						compare.push({ name: `layer-${layerId}-real-mask.png`, canvas: l.realMask.canvas });
						delete l.realMask.canvas;
						delete l.realMask.imageData;
					}

					// if (l.vectorMask) {
					// 	const canvas = createCanvas(l.right! - l.left!, l.bottom! - l.top!);
					// 	const context = canvas.getContext('2d')!;
					// 	context.translate(-l.left!, -l.top!);
					// 	const knots = l.vectorMask.paths[0].knots;
					// 	context.beginPath();
					// 	context.moveTo(knots[knots.length - 1].points[2], knots[knots.length - 1].points[3]);
					// 	for (let i = 0; i < knots.length; i++) {
					// 		const prev = i ? knots[i - 1].points : knots[knots.length - 1].points;
					// 		const points = knots[i].points;
					// 		context.bezierCurveTo(prev[4], prev[5], points[0], points[1], points[2], points[3]);
					// 	}
					// 	context.closePath();
					// 	context.fill();
					// 	fs.writeFileSync('test.png', canvas.toBuffer());
					// }
				}
			}

			function convertUint8ArraysToBase64(layers: Layer[]) {
				for (const layer of layers) {
					if (layer.adjustment?.type == 'color lookup') {
						if (layer.adjustment.lut3DFileData) {
							layer.adjustment.lut3DFileData = byteArrayToBase64(layer.adjustment.lut3DFileData) as any;
						}

						if (layer.adjustment.profile) {
							layer.adjustment.profile = byteArrayToBase64(layer.adjustment.profile) as any;
						}
					}

					if (layer.children) {
						convertUint8ArraysToBase64(layer.children);
					}

					const item = layer.placedLayer?.filter?.list[0];
					if (item && item.type === 'liquify') {
						item.filter.liquifyMesh = byteArrayToBase64(item.filter.liquifyMesh) as any;
					}
				}
			}

			if (psd.linkedFiles) {
				for (const file of psd.linkedFiles) {
					if (file.data) {
						let { name, data } = file;
						while (compareFiles.some(f => f.name === name)) {
							name = 'x' + name;
						}
						compareFiles.push({ name, data });
						delete file.data;
					}
				}
			}

			if (psd.filterEffectsMasks) {
				for (const mask of psd.filterEffectsMasks) {
					for (let i = 0; i < mask.channels.length; i++) {
						if (mask.channels[i]) {
							mask.channels[i]!.data = byteArrayToBase64(mask.channels[i]!.data) as any;
						} else {
							mask.channels[i] = null as any;
						}
					}

					if (mask.extra?.data) {
						mask.extra!.data = byteArrayToBase64(mask.extra!.data) as any;
					}
				}
			}

			pushLayerCanvases(psd.children || []);
			convertUint8ArraysToBase64(psd.children || []);

			const resultsDir = path.join(resultsFilesPath, 'read', f);
			fs.mkdirSync(resultsDir, { recursive: true });

			if (psd.imageResources?.thumbnail) {
				compare.push({ name: 'thumb.png', canvas: psd.imageResources.thumbnail, skip: true });
				delete psd.imageResources.thumbnail;
			}

			if (psd.imageResources) delete psd.imageResources.thumbnailRaw;

			compare.forEach(i => saveCanvas(path.join(resultsDir, i.name), i.canvas));
			compareFiles.forEach(i => fs.writeFileSync(path.join(resultsDir, i.name), i.data));

			fs.writeFileSync(path.join(resultsDir, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');

			clearEmptyCanvasFields(psd);
			clearEmptyCanvasFields(expected);

			expect(psd).eql(expected, f);

			compare.forEach(i => i.skip || compareCanvases(images[i.name], i.canvas, `${f}/${i.name}`));
			compareFiles.forEach(i => compareTwoFiles(path.join(basePath, i.name), i.data, `${f}/${i.name}`));
		});
	});

	fs.readdirSync(readWriteFilesPath).forEach(f => {
		// fs.readdirSync(readWriteFilesPath).filter(f => /smart-filters$/.test(f)).forEach(f => {
		it(`reads-writes PSD file (${f})`, () => {
			const ext = fs.existsSync(path.join(readWriteFilesPath, f, 'src.psb')) ? 'psb' : 'psd';
			const psd = readPsdFromFile(path.join(readWriteFilesPath, f, `src.${ext}`), {
				...opts, useImageData: true, useRawThumbnail: true, throwForMissingFeatures: true,
				// skipCompositeImageData: true, skipLayerImageData: true, skipThumbnail: true,
				// logDevFeatures: true, logMissingFeatures: true,
			});

			// console.log(psd.children![0].text);
			// psd.children![0].text!.text = 'f';
			// psd.children![0].text!.style!.font!.name = 'ArialMT';
			// const actual = writePsdBuffer(psd, { logMissingFeatures: true, psb: ext === 'psb', invalidateTextLayers: true });

			const actual = writePsdBuffer(psd, { logMissingFeatures: true, psb: ext === 'psb' });
			const resultsDir = path.join(resultsFilesPath, 'read-write', f);
			fs.mkdirSync(resultsDir, { recursive: true });
			fs.writeFileSync(path.join(resultsDir, `expected.${ext}`), actual);
			fs.writeFileSync(path.join(resultsDir, `expected.bin`), actual);
			// console.log(require('util').inspect(psd, false, 99, true));

			// const psd2 = readPsdFromFile(path.join(resultsDir, `raw.psd`), { ...opts, useImageData: true, useRawThumbnail: true });
			// fs.writeFileSync('temp.txt', require('util').inspect(psd, false, 99, false), 'utf8');
			// fs.writeFileSync('temp2.txt', require('util').inspect(psd2, false, 99, false), 'utf8');

			const expected = fs.readFileSync(path.join(readWriteFilesPath, f, `expected.${ext}`));
			compareBuffers(actual, expected, `read-write-${f}`, 0x0);
		});
	});

	it.skip('generate file', () => {
		fs.writeFileSync('test.psd', writePsdBuffer({
			width: 100,
			height: 100,
			children: [
				{
					name: 'test',
					blendMode: 'color burn',
					blendClippendElements: true,
					// blendInteriorElements: false,
				},
			]
		}));
	});

	it.skip('write text layer test', () => {
		const psd: Psd = {
			width: 200,
			height: 200,
			children: [
				{
					name: 'text layer',
					text: {
						text: 'Hello World\n• c • tiny!\r\ntest',
						// orientation: 'vertical',
						transform: [1, 0, 0, 1, 70, 70],
						style: {
							font: { name: 'ArialMT' },
							fontSize: 30,
							fillColor: { r: 0, g: 128, b: 0 },
						},
						styleRuns: [
							{ length: 12, style: { fillColor: { r: 255, g: 0, b: 0 } } },
							{ length: 12, style: { fillColor: { r: 0, g: 0, b: 255 } } },
							{ length: 4, style: { underline: true } },
						],
						paragraphStyle: {
							justification: 'center',
						},
						warp: {
							style: 'arc',
							value: 50,
							perspective: 0,
							perspectiveOther: 0,
							rotate: 'horizontal',
						},
					},
				},
				{
					name: '2nd layer',
					text: {
						text: 'Aaaaa',
						transform: [1, 0, 0, 1, 70, 70],
					},
				},
			],
		};

		fs.writeFileSync(path.join(resultsFilesPath, '_TEXT2.psd'), writePsdBuffer(psd, { logMissingFeatures: true }));
	});

	it.skip('read text layer test', () => {
		const psd = readPsdFromFile(path.join(testFilesPath, 'text-test.psd'), opts);
		// const layer = psd.children![1];

		// layer.text!.text = 'Foo bar';
		const buffer = writePsdBuffer(psd, { logMissingFeatures: true });
		fs.writeFileSync(path.join(resultsFilesPath, '_TEXT.psd'), buffer);

		// console.log(require('util').inspect(psd.children![0].text, false, 99, true));
		// console.log(require('util').inspect(psd.children![1].text, false, 99, true));
		// console.log(require('util').inspect(psd.engineData, false, 99, true));
	});

	it.skip('READ TEST', () => {
		const originalBuffer = fs.readFileSync(path.join(testFilesPath, 'test.psd'));

		console.log('READING ORIGINAL');
		const opts = {
			logMissingFeatures: true,
			throwForMissingFeatures: true,
			useImageData: true,
			useRawThumbnail: true,
			logDevFeatures: true,
		};
		const originalPsd = readPsdInternal(createReaderFromBuffer(originalBuffer), opts);

		console.log('WRITING');
		const buffer = writePsdBuffer(originalPsd, { logMissingFeatures: true });
		fs.writeFileSync('temp.psd', buffer);
		// fs.writeFileSync('temp.bin', buffer);
		// fs.writeFileSync('temp.json', JSON.stringify(originalPsd, null, 2), 'utf8');
		// fs.writeFileSync('temp.xml', originalPsd.imageResources?.xmpMetadata, 'utf8');

		console.log('READING WRITTEN');
		const psd = readPsdInternal(
			createReaderFromBuffer(buffer), { logMissingFeatures: true, throwForMissingFeatures: true });

		clearCanvasFields(originalPsd);
		clearCanvasFields(psd);
		delete originalPsd.imageResources!.thumbnail;
		delete psd.imageResources!.thumbnail;
		delete originalPsd.imageResources!.thumbnailRaw;
		delete psd.imageResources!.thumbnailRaw;
		// console.log(require('util').inspect(originalPsd, false, 99, true));

		// fs.writeFileSync('original.json', JSON.stringify(originalPsd, null, 2));
		// fs.writeFileSync('after.json', JSON.stringify(psd, null, 2));

		compareBuffers(buffer, originalBuffer, 'test');

		expect(psd).eql(originalPsd);
	});

	it.skip('decode engine data 2', () => {
		// const fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Vertical.txt'));
		const fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Simple.txt'));
		const func = new Function(`return ${fileData};`);
		const data = func();
		const result = decodeEngineData2(data);
		fs.writeFileSync(
			path.join(__dirname, '..', '..', 'resources', 'temp.js'),
			'var x = ' + require('util').inspect(result, false, 99, false), 'utf8');
	});

	it.skip('test.psd', () => {
		const buffer = fs.readFileSync('test.psd');
		const psd = readPsdInternal(createReaderFromBuffer(buffer), {
			skipCompositeImageData: true,
			skipLayerImageData: true,
			skipThumbnail: true,
			throwForMissingFeatures: true,
			logDevFeatures: true,
		});
		delete psd.engineData;
		psd.imageResources = {};
		console.log(require('util').inspect(psd, false, 99, true));
	});

	it.skip('test', () => {
		const psd = readPsdInternal(createReaderFromBuffer(fs.readFileSync(`test/read-write/text-box/src.psd`)), {
			// skipCompositeImageData: true,
			// skipLayerImageData: true,
			// skipThumbnail: true,
			throwForMissingFeatures: true,
			logDevFeatures: true,
			useRawThumbnail: true,
		});
		fs.writeFileSync('text_rect_out.psd', writePsdBuffer(psd, { logMissingFeatures: true }));
		fs.writeFileSync('text_rect_out.bin', writePsdBuffer(psd, { logMissingFeatures: true }));
		// const psd2 = readPsdInternal(createReaderFromBuffer(fs.readFileSync(`text_rect_out.psd`)), {
		// 	// skipCompositeImageData: true,
		// 	// skipLayerImageData: true,
		// 	// skipThumbnail: true,
		// 	throwForMissingFeatures: true,
		// 	logDevFeatures: true,
		// });
		// psd2;
		const original = fs.readFileSync(`test/read-write/text-box/src.psd`);
		const output = fs.readFileSync(`text_rect_out.psd`);
		compareBuffers(output, original, '-', 0x65d8); // , 0x8ce8, 0x8fca - 0x8ce8);
	});

	it.skip('compare test', () => {
		for (const name of ['text_point', 'text_rect']) {
			const psd = readPsdInternal(createReaderFromBuffer(fs.readFileSync(`${name}.psd`)), {
				skipCompositeImageData: true,
				skipLayerImageData: true,
				skipThumbnail: true,
				throwForMissingFeatures: true,
				logDevFeatures: true,
			});
			// psd.imageResources = {};
			fs.writeFileSync(`${name}.txt`, require('util').inspect(psd, false, 99, false), 'utf8');

			// const engineData = parseEngineData(toByteArray(psd.engineData!));
			// fs.writeFileSync(`${name}_enginedata.txt`, require('util').inspect(engineData, false, 99, false), 'utf8');
		}
	});

	it.skip('text-replace.psd', () => {
		{
			const buffer = fs.readFileSync('text-replace2.psd');
			const psd = readPsdInternal(createReaderFromBuffer(buffer), {});
			psd.children![1]!.text!.text = 'Foo bar';
			const output = writePsdBuffer(psd, { invalidateTextLayers: true, logMissingFeatures: true });
			fs.writeFileSync('out.psd', output);
		}

		{
			const buffer = fs.readFileSync('text-replace.psd');
			const psd = readPsdInternal(createReaderFromBuffer(buffer), {
				skipCompositeImageData: true,
				skipLayerImageData: true,
				skipThumbnail: true,
				throwForMissingFeatures: true,
				logDevFeatures: true,
			});
			delete psd.engineData;
			psd.imageResources = {};
			psd.children?.splice(0, 1);
			fs.writeFileSync('input.txt', require('util').inspect(psd, false, 99, false), 'utf8');
		}

		{
			const buffer = fs.readFileSync('out.psd');
			const psd = readPsdInternal(createReaderFromBuffer(buffer), {
				skipCompositeImageData: true,
				skipLayerImageData: true,
				skipThumbnail: true,
				throwForMissingFeatures: true,
				logDevFeatures: true,
			});
			delete psd.engineData;
			psd.imageResources = {};
			psd.children?.splice(0, 1);
			fs.writeFileSync('output.txt', require('util').inspect(psd, false, 99, false), 'utf8');
		}
	});
});

function clearEmptyCanvasFields(layer: Layer | undefined) {
	if (layer) {
		if ('canvas' in layer && !layer.canvas) delete layer.canvas;
		if ('imageData' in layer && !layer.imageData) delete layer.imageData;
		layer.children?.forEach(clearEmptyCanvasFields);
	}
}

function clearCanvasFields(layer: Layer | undefined) {
	if (layer) {
		delete layer.canvas;
		delete layer.imageData;
		if (layer.mask) delete layer.mask.canvas;
		if (layer.mask) delete layer.mask.imageData;
		layer.children?.forEach(clearCanvasFields);
	}
}
