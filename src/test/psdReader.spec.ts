import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { deflate } from 'pako';
import { readPsdFromFile, importPSD, loadImagesFromDirectory, compareCanvases, saveCanvas, createReaderFromBuffer, compareBuffers, compareTwoFiles } from './common';
import { Layer, ReadOptions, Psd, ColorMode, PixelData } from '../psd';
import { byteArrayToBase64, readPsd, writePsdBuffer, getLayerImageData, getCompositeImageData, readAse } from '../index';
import { readPsd as readPsdInternal, readPattern, readDataRLE, createReader, readBytes, readDataZip, readAdditionalLayerInfo } from '../psdReader';
import { createWriter, getWriterBuffer, writePattern } from '../psdWriter';
import { infoHandlers, infoHandlersMap } from '../additionalInfo';
import { decodeEngineData2 } from '../engineData2';
import { imageDataToCanvas } from '../helpers';

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

function u8(...values: number[]) { return Buffer.from(values); }
function u16(value: number) { const b = Buffer.alloc(2); b.writeUInt16BE(value, 0); return b; }
function i16(value: number) { const b = Buffer.alloc(2); b.writeInt16BE(value, 0); return b; }
function u32(value: number) { const b = Buffer.alloc(4); b.writeUInt32BE(value, 0); return b; }
function f32(value: number) { const b = Buffer.alloc(4); b.writeFloatBE(value, 0); return b; }
function ascii(value: string) { return Buffer.from(value, 'ascii'); }

interface TestLayer {
	sectionDividerType?: number;
	maskData?: Buffer;
}

function layerRecord({ sectionDividerType, maskData }: TestLayer) {
	const extra: Buffer[] = [
		maskData ? Buffer.concat([u32(maskData.length), maskData]) : u32(0), // mask data
		u32(0), // blending ranges
		u8(0, 0, 0, 0), // name (padded to 4)
	];

	if (sectionDividerType !== undefined) {
		extra.push(ascii('8BIMlsct'), u32(4), u32(sectionDividerType));
	}

	const extraData = Buffer.concat(extra);

	return Buffer.concat([
		u32(0), u32(0), u32(0), u32(0), // top, left, bottom, right
		u16(0), // channel count
		ascii('8BIMnorm'),
		u8(255, 0, 0, 0), // opacity, clipping, flags, filler
		u32(extraData.length),
		extraData,
	]);
}

function layerSection(layers: TestLayer[], globalAlpha: boolean, large: boolean) {
	const len = (value: number) => large ? Buffer.concat([u32(0), u32(value)]) : u32(value);
	if (!layers.length) return len(0);
	let layerInfo = Buffer.concat([i16(globalAlpha ? -layers.length : layers.length), ...layers.map(layerRecord)]);
	if (layerInfo.length % 2) layerInfo = Buffer.concat([layerInfo, u8(0)]);
	const layerInfoSection = Buffer.concat([len(layerInfo.length), layerInfo]);
	return Buffer.concat([len(layerInfoSection.length), layerInfoSection]);
}

function alphaNamesResource(names: string[]) {
	const data = Buffer.concat(names.map(name => Buffer.concat([u32(name.length), Buffer.from(name, 'utf16le').swap16()])));
	return Buffer.concat([ascii('8BIM'), u16(1045), u8(0, 0), u32(data.length), data, u8(...(data.length % 2 ? [0] : []))]);
}

interface TestPsd {
	width: number;
	height: number;
	channels: number;
	bits?: number;
	colorMode?: ColorMode;
	version?: number;
	colorModeData?: Buffer;
	resources?: Buffer;
	layers?: TestLayer[];
	globalAlpha?: boolean;
	composite: Buffer; // including compression
}

function buildPsd({ width, height, channels, bits = 8, colorMode = ColorMode.RGB, version = 1, colorModeData, resources, layers, globalAlpha = false, composite }: TestPsd) {
	if (globalAlpha && !layers?.length) layers = [{}];

	return Buffer.concat([
		ascii('8BPS'), u16(version), Buffer.alloc(6), u16(channels), u32(height), u32(width), u16(bits), u16(colorMode),
		u32(colorModeData?.length ?? 0), colorModeData ?? Buffer.alloc(0),
		u32(resources?.length ?? 0), resources ?? Buffer.alloc(0),
		layerSection(layers ?? [], globalAlpha, version === 2),
		composite,
	]);
}

// encodes every row as literal runs, rows: [channel][row] -> bytes
function rleComposite(rows: number[][][], large = false) {
	const encoded = rows.map(channel => channel.map(row => {
		const parts: number[] = [];
		for (let i = 0; i < row.length; i += 128) {
			const chunk = row.slice(i, i + 128);
			parts.push(chunk.length - 1, ...chunk);
		}
		return Buffer.from(parts);
	}));
	const lengths = encoded.map(channel => channel.map(row => large ? u32(row.length) : u16(row.length)));
	return Buffer.concat([u16(1), ...([] as Buffer[]).concat(...lengths), ...([] as Buffer[]).concat(...encoded)]);
}

const strictOpts = { useImageData: true, strict: true };

describe('PsdReader', () => {
	it('throws for pattern with negative size without changing memory limit', () => {
		const words = [0, 1, ColorMode.RGB, 0, 0, 3, 0, 0, 1000000, 0, 0, 0]; // length, version, color mode, x/y, name, VMAL version, length, bounds, channels
		const buffer = new Uint8Array(words.length * 4 + 1);
		const view = new DataView(buffer.buffer);
		let offset = 0;
		for (const [index, word] of words.entries()) {
			if (index === 3) { // x, y
				offset += 4;
			} else {
				view.setUint32(offset, word); offset += 4;
			}
			if (index === 4) offset++; // empty pascal string id
		}

		const reader = createReader(buffer.buffer);
		reader.totalMemoryLimit = 100;
		expect(() => readPattern(reader)).throw('Invalid pattern bounds');
		expect(reader.totalMemoryLimit).equal(100);
	});

	it.skip('reads width and height properly', () => {
		// malicious file 
		const buffer = Buffer.from('OEJQUwABAAAAAAAAAA0AADcuAAA58wAgAAMAAAAAAAAAAAAAAAAAAdEgNZv+i9bc9ygd2A==', 'base64');
		readPsd(buffer);
	});

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

	// it.only('test', () => {
	// 	const psd = readPsdFromFile('D:\\Downloads\\temp.psd');

	// 	psd.children![2]!.text!.text = "NEW TEXT HERE";
	// 	psd.children![2]!.name = "NEW NAME";
	// 	psd.children![2]!.canvas = undefined;

	// 	const buffer = writePsdBuffer(psd, { invalidateTextLayers: true });
	// 	fs.writeFileSync('output.psd', buffer);
	// });

	fs.readdirSync(readFilesPath).forEach(f => {
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

			function cleanupLayerFields(layers: Layer[]) {
				for (const layer of layers) {
					if (layer.adjustment?.type == 'color lookup') {
						if (layer.adjustment.lut3DFileData) {
							layer.adjustment.lut3DFileData = byteArrayToBase64(layer.adjustment.lut3DFileData) as any;
						}

						if (layer.adjustment.profile) {
							layer.adjustment.profile = byteArrayToBase64(layer.adjustment.profile) as any;
						}
					}

					if (layer.pixelSource) {
						layer.pixelSource.interpretation.profile = byteArrayToBase64(layer.pixelSource.interpretation.profile) as any;
					}

					if (layer.children) {
						cleanupLayerFields(layer.children);
					}

					const item = layer.placedLayer?.filter?.list[0];
					if (item && item.type === 'liquify') {
						item.filter.liquifyMesh = byteArrayToBase64(item.filter.liquifyMesh) as any;
					}

					delete layer.rawData;
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

			if (psd.patterns) {
				for (const pattern of psd.patterns) {
					if (pattern.data) {
						const canvas = imageDataToCanvas({ width: pattern.bounds.w, height: pattern.bounds.h, data: pattern.data });
						compare.push({ name: `pattern-${pattern.id}.png`, canvas });
						delete (pattern as any).data;
					}
				}
			}

			pushLayerCanvases(psd.children || []);
			cleanupLayerFields(psd.children || []);

			const resultsDir = path.join(resultsFilesPath, 'read', f);
			fs.mkdirSync(resultsDir, { recursive: true });

			if (psd.imageResources?.thumbnail) {
				compare.push({ name: 'thumb.png', canvas: psd.imageResources.thumbnail, skip: true });
				delete psd.imageResources.thumbnail;
			}

			delete psd.rawCompositeData;
			if (psd.imageResources) delete psd.imageResources.thumbnailRaw;
			if (psd.imageResources?.iccProfile) psd.imageResources.iccProfile = byteArrayToBase64(psd.imageResources.iccProfile) as any;
			if (psd.imageResources?.exifData) psd.imageResources.exifData = byteArrayToBase64(psd.imageResources.exifData) as any;
			if (psd.imageResources?.iptcData) psd.imageResources.iptcData = byteArrayToBase64(psd.imageResources.iptcData) as any;
			if (psd.imageResources?.windowsDevMode) psd.imageResources.windowsDevMode = byteArrayToBase64(psd.imageResources.windowsDevMode) as any;

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

	describe('memory-safety against malicious files', () => {
		it('rejects a pattern with huge dimensions instead of attempting a massive allocation', () => {
			// crafted pattern block: width/height come straight from unvalidated uint32 bounds
			// (bottom - top) / (right - left), which used to be used unchecked to size a
			// `new Uint8Array(width * height * 4)` allocation.
			const buf = Buffer.alloc(49);
			let o = 0;
			buf.writeUInt32BE(100, o); o += 4; // pattern block length (irrelevant to this check)
			buf.writeUInt32BE(1, o); o += 4;   // version
			buf.writeUInt32BE(3, o); o += 4;   // colorMode = RGB
			buf.writeInt16BE(0, o); o += 2;    // x
			buf.writeInt16BE(0, o); o += 2;    // y
			buf.writeUInt32BE(0, o); o += 4;   // unicode name length = 0
			buf.writeUInt8(0, o); o += 1;      // pascal string id length = 0
			buf.writeUInt32BE(3, o); o += 4;   // VMAL version
			buf.writeUInt32BE(0, o); o += 4;   // length (unused)
			buf.writeUInt32BE(0, o); o += 4;          // top
			buf.writeUInt32BE(0, o); o += 4;          // left
			buf.writeUInt32BE(0xffffffff, o); o += 4; // bottom -> height ~4.29e9
			buf.writeUInt32BE(0xffffffff, o); o += 4; // right -> width ~4.29e9
			buf.writeUInt32BE(0, o); o += 4;   // channelsCount = 0

			const reader = createReaderFromBuffer(buf);
			reader.totalMemoryLimit = 2 * 1024 * 1024 * 1024; // same default readPsd uses

			expect(() => readPattern(reader)).to.throw('Pattern too large');
		});

		it('rejects pattern channel outside of pattern bounds', () => {
			const buf = buildPattern(1, 1, [{ depth: 8, rect: [0, 0, 30000, 30000], data: [1] }]);
			expect(() => readPattern(createReaderFromBuffer(buf))).to.throw('Pattern channel bounds outside of pattern bounds');
		});

		it('checks pattern memory limit before allocating image data', () => {
			// 100x1 RLE channels, each row is a single run of 100 values (image data 400 bytes + 100 bytes RLE decode buffer)
			const rle = (value: number) => ({ depth: 8, compression: 1, data: [0, 2, 0x9d, value] });
			const buf = buildPattern(100, 1, [rle(1), rle(2), rle(3)]);

			const limited = createReaderFromBuffer(buf);
			limited.totalMemoryLimit = 450;
			expect(() => readPattern(limited)).to.throw('Exceeded memory limit');
			expect(limited.totalMemoryLimit).equal(450);

			const reader = createReaderFromBuffer(buf);
			reader.totalMemoryLimit = 500;
			const pattern = readPattern(reader);
			expect(Array.from(pattern.data.slice(-4))).eql([1, 2, 3, 255]);
			expect(reader.totalMemoryLimit).equal(100);
		});

		it('does not reduce memory limit when pattern fails to decode', () => {
			// 10x2 RLE channel with data too short for its row lengths
			const buf = buildPattern(10, 2, [{ depth: 8, compression: 1, data: [0, 2] }]);
			const reader = createReaderFromBuffer(buf);
			reader.totalMemoryLimit = 1000;
			expect(() => readPattern(reader)).to.throw('RLE row lengths exceed buffer length');
			expect(reader.totalMemoryLimit).equal(1000);
		});
	});

	describe('patterns', () => {
		it('reads pattern transparency', () => {
			const data = new Uint8Array([10, 20, 30, 0, 40, 50, 60, 128]);
			const writer = createWriter();
			writePattern(writer, { id: 'id', name: 'p', x: 0, y: 0, bounds: { x: 0, y: 0, w: 2, h: 1 }, data });
			const pattern = readPattern(createReader(getWriterBuffer(writer)));
			expect(Array.from(pattern.data)).eql(Array.from(data));
		});

		it('reads 16bit grayscale pattern with transparency', () => {
			const buf = buildPattern(2, 1, [
				{ depth: 16, data: [0x00, 0x00, 0xff, 0xff] }, // gray
				{ depth: 16, data: [0xff, 0xff, 0x80, 0x00] }, // alpha
			], ColorMode.Grayscale);
			const pattern = readPattern(createReaderFromBuffer(buf));
			expect(Array.from(pattern.data)).eql([0, 0, 0, 255, 255, 255, 255, 128]);
		});

		it('reads CMYK pattern', () => {
			// values are inverted (255 = 0% ink), first pixel - no ink, second pixel - 100% black at 50% opacity
			const buf = buildPattern(2, 1, [
				{ depth: 8, data: [255, 255] },
				{ depth: 8, data: [255, 255] },
				{ depth: 8, data: [255, 255] },
				{ depth: 8, data: [255, 0] },
				{ depth: 8, data: [255, 128] },
			], ColorMode.CMYK);
			const pattern = readPattern(createReaderFromBuffer(buf));
			expect(Array.from(pattern.data.slice(0, 4))).eql([255, 255, 255, 255]);
			expect(pattern.data[7]).equal(128);
			expect(pattern.data[4]).lessThan(64); // dark
		});

		it('skips unsupported patterns and reads following ones', () => {
			const unsupported = buildPattern(1, 1, [{ depth: 8, data: [1] }], ColorMode.Lab);
			const valid = buildPattern(1, 1, [{ depth: 8, data: [1] }, { depth: 8, data: [2] }, { depth: 8, data: [3] }]);
			const block = Buffer.concat([unsupported, valid]);
			const target: any = {};
			const reader = createReaderFromBuffer(block);
			infoHandlersMap['Patt'].read(reader, target, () => block.byteLength - reader.offset, { width: 1, height: 1 }, {});
			expect(target.patterns.length).equal(1);
			expect(Array.from(target.patterns[0].data)).eql([1, 2, 3, 255]);
		});
	});

	describe('fixes', () => {
		it('exports readAse from main module', () => {
			expect(readAse).a('function');
		});

		it('reads layer channel with invalid length of 1', () => {
			const buffer = writePsdBuffer({ width: 2, height: 2, children: [{ name: 'a' }, { name: 'b' }] });
			// channel info of first layer (transparency, red, green, blue with 2 bytes for compression type)
			const info = Buffer.from([0xff, 0xff, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 2, 0, 2, 0, 0, 0, 2]);
			const offset = buffer.indexOf(info);
			expect(offset).greaterThan(0);
			buffer.writeUInt32BE(1, offset + 20);
			const psd = readPsd(buffer, { skipCompositeImageData: true });
			expect(psd.children!.map(c => c.name)).eql(['a', 'b']);
		});

		it('reads rest of the file when image data of one layer is corrupted', () => {
			const data = new Uint8ClampedArray(4 * 4 * 4).map((_, i) => i * 7);
			const buffer = writePsdBuffer({
				width: 4, height: 4,
				children: [{ name: 'a', imageData: { width: 4, height: 4, data } }, { name: 'b', imageData: { width: 4, height: 4, data } }],
			}, { compress: true });
			const offset = buffer.indexOf(Buffer.from([0x78, 0x9c])); // zip header of first channel of first layer
			expect(offset).greaterThan(0);
			buffer[offset] = 0;
			const psd = readPsd(buffer, { useImageData: true, skipCompositeImageData: true });
			expect(psd.children!.map(c => c.name)).eql(['a', 'b']);
			expect(psd.children![0].imageData).undefined;
			expect(Array.from(psd.children![1].imageData!.data)).eql(Array.from(data));
			expect(() => readPsd(buffer, { useImageData: true, throwForMissingFeatures: true })).throw(/Invalid zip data/);
		});

		it('clamps global layer mask opacity out of 0-100 range', () => {
			const globalLayerMaskInfo = { overlayColorSpace: 0x1234, colorSpace1: 0x5678, colorSpace2: 0x9abc, colorSpace3: 0xdef0, colorSpace4: 0x4321, opacity: 1, kind: 128 };
			const buffer = writePsdBuffer({ width: 1, height: 1, globalLayerMaskInfo });
			const offset = buffer.indexOf(Buffer.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x43, 0x21]));
			buffer.writeUInt16BE(355, offset + 10);
			expect(readPsd(buffer).globalLayerMaskInfo!.opacity).equal(1);
		});

		it('writes empty layer with inverted bounds', () => {
			const psd = readPsd(writePsdBuffer({ width: 10, height: 10, children: [{ name: 'a', left: 2, top: 3, right: 2, bottom: -1 }, { name: 'b', left: 1, top: 1 }] }));
			expect(psd.children![0]).include({ left: 2, top: 3, right: 2, bottom: -1 });
			expect(psd.children![1]).include({ left: 1, top: 1, right: 1, bottom: 1 });
		});

		it('reads layer with negative size as empty layer', () => {
			const buffer = writePsdBuffer({ width: 10, height: 10, children: [{ name: 'a', left: 7, top: 5 }] });
			// find layer record bounds (top, left, bottom, right) and make the layer -1 pixel wide
			const bounds = Buffer.from([0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0, 5, 0, 0, 0, 7]);
			const offset = buffer.indexOf(bounds);
			expect(offset).greaterThan(0);
			buffer.writeInt32BE(6, offset + 12);
			const psd = readPsd(buffer, { useImageData: true, skipCompositeImageData: true });
			expect(psd.children![0]).include({ name: 'a', left: 7, top: 5, right: 6, bottom: 5 });
		});

		it('reads composite image transparency marked with Mtrn', () => {
			const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 255]);
			const psd: Psd = { width: 2, height: 1, imageData: { width: 2, height: 1, data }, imageResources: { alphaChannelNames: ['Transparency'] } };
			const handler = infoHandlers.find(h => h.key === 'Mtrn')!;
			const has = handler.has;
			handler.has = (target: any) => target === psd;
			let buffer: Buffer;

			try {
				buffer = writePsdBuffer(psd);
			} finally {
				handler.has = has;
			}

			const result = readPsd(buffer, { useImageData: true });
			expect(Array.from(result.imageData!.data).filter((_, i) => i % 4 === 3)).eql([0, 255]);
		});

		it('writes color mode specific image resources for documents in other color modes than RGB', () => {
			const imageResources: Psd['imageResources'] = {
				iccProfile: new Uint8Array([1, 2, 3]),
				indexedColorCount: 2,
				transparencyIndex: 1,
				alphaChannelDisplayInfo: [{ color: { r: 255, g: 0, b: 0 }, opacity: 0.5, kind: 'protected' }],
				grayscaleTransferFunctions: [{ curve: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1000], override: false }],
				globalAngle: 30,
			};
			const read = (colorMode: ColorMode) => readPsd(writePsdBuffer({ width: 1, height: 1, colorMode, imageResources }), { skipCompositeImageData: true }).imageResources!;
			expect(read(ColorMode.RGB)).deep.include(imageResources);
			expect(read(ColorMode.CMYK)).deep.include(imageResources);
			expect(read(ColorMode.Grayscale)).deep.include(imageResources);
		});

		it('decodes raw composite data with transparency named in alpha channel names when layers are in Lr16', () => {
			// 1x1 RGB with 1 extra channel named "Transparency", raw compression
			const psd: Psd = {
				width: 1, height: 1, channels: 4, bitsPerChannel: 8, colorMode: ColorMode.RGB,
				imageResources: { alphaChannelNames: ['Transparency'] },
				rawCompositeData: new Uint8Array([0, 0, 10, 20, 30, 128]),
				rawCompositeDataInfo: { large: false, globalAlpha: false, layersInGlobalInfo: true },
			};
			expect(Array.from(getCompositeImageData(psd)!.data)).eql([10, 20, 30, 128]);
			psd.rawCompositeDataInfo!.layersInGlobalInfo = false;
			expect(Array.from(getCompositeImageData(psd)!.data)).eql([10, 20, 30, 255]);
		});

		it('reads 32bit zero length of keys written with 8BIM signature in PSB files by older versions', () => {
			// 'pths' written by older version with 32bit length of 0, followed by next block
			const buffer = Buffer.concat([ascii('8BIMpths'), u32(0), ascii('8BIMlspf'), u32(4), u32(0x80000000)]);
			const reader = createReaderFromBuffer(buffer);
			reader.large = true;
			const layer: Layer = {};
			readAdditionalLayerInfo(reader, layer, { width: 1, height: 1 }, {});
			expect(reader.offset).equal(12);
			readAdditionalLayerInfo(reader, layer, { width: 1, height: 1 }, {});
			expect(layer.protected).eql({ transparency: false, composite: false, position: false, all: true });
		});

		it('reads files with trailing bytes in image resources section', () => {
			const globalAngle = Buffer.concat([ascii('8BIM'), u16(1037), u16(0), u32(4), u32(30)]);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 3, resources: Buffer.concat([globalAngle, Buffer.alloc(2)]), composite: Buffer.concat([u16(0), u8(1, 2, 3)]) }), strictOpts);
			expect(psd.imageResources!.globalAngle).equal(30);
		});

		it('reads files with image resources section length larger than the data', () => {
			// Photoshop CS2 file with section length 2 bytes larger than resources (layer info starts right after last resource)
			const buffer = writePsdBuffer({ width: 10, height: 10, imageResources: { globalAngle: 30 }, children: [{ name: 'a' }] });
			const offset = 26 + 4 + buffer.readUInt32BE(26);
			buffer.writeUInt32BE(buffer.readUInt32BE(offset) + 2, offset);
			const psd = readPsd(buffer, { skipCompositeImageData: true, skipThumbnail: true });
			expect(psd.imageResources!.globalAngle).equal(30);
			expect(psd.children!.map(c => c.name)).eql(['a']);
		});

		it('reads layers with unknown blend mode as normal', () => {
			const buffer = writePsdBuffer({ width: 10, height: 10, children: [{ name: 'a', blendMode: 'multiply' }] });
			const offset = buffer.indexOf('8BIMmul ');
			expect(offset).greaterThan(0);
			buffer.write('BoEF', offset + 4, 'latin1');
			expect(readPsd(buffer, { skipCompositeImageData: true }).children![0].blendMode).equal('normal');
			expect(() => readPsd(buffer, { skipCompositeImageData: true, throwForMissingFeatures: true })).throw(`Invalid blend mode: 'BoEF'`);
		});

		it('writes keys that Photoshop writes with 64bit length in PSB files with 8B64 signature', () => {
			const buffer = writePsdBuffer({ width: 10, height: 10, artboards: { count: 1 } }, { psb: true });
			expect(buffer.indexOf('8B64artd')).greaterThan(0);
			expect(readPsd(buffer).artboards!.count).equal(1);
		});

		it('rejects a layer whose bounding box exceeds the document size limit', () => {
			// left === right (width 0) but bottom - top is huge: used to skip the
			// memory-limit-guarded image data allocation entirely while still driving an
			// unbounded RLE row-length table allocation from the huge height.
			const buf = Buffer.alloc(60);
			let o = 0;
			buf.write('8BPS', o, 'ascii'); o += 4;
			buf.writeUInt16BE(1, o); o += 2; // version
			o += 6; // reserved
			buf.writeUInt16BE(3, o); o += 2;  // channels
			buf.writeUInt32BE(10, o); o += 4; // height
			buf.writeUInt32BE(10, o); o += 4; // width
			buf.writeUInt16BE(8, o); o += 2;  // bitsPerChannel
			buf.writeUInt16BE(3, o); o += 2;  // colorMode = RGB

			buf.writeUInt32BE(0, o); o += 4; // color mode data section length
			buf.writeUInt32BE(0, o); o += 4; // image resources section length

			buf.writeUInt32BE(22, o); o += 4; // layer & mask info section length
			buf.writeUInt32BE(18, o); o += 4; // layer info section length
			buf.writeInt16BE(1, o); o += 2;   // layer count = 1

			buf.writeInt32BE(0, o); o += 4;             // top
			buf.writeInt32BE(100, o); o += 4;           // left
			buf.writeInt32BE(2_000_000_000, o); o += 4; // bottom -> height 2,000,000,000
			buf.writeInt32BE(100, o); o += 4;           // right -> width 0 (left === right)

			const reader = createReaderFromBuffer(buf);

			expect(() => readPsdInternal(reader, { throwForMissingFeatures: false })).to.throw('Invalid layer size');
		});

		it('rejects an RLE row-length table sized from an unvalidated dimension', () => {
			// direct unit test for the readDataRLE guard, independent of the layer bounding
			// box check above, since it protects other callers (e.g. composite image data) too.
			const reader = createReaderFromBuffer(Buffer.alloc(16));
			reader.totalMemoryLimit = 2 * 1024 * 1024 * 1024;

			expect(() => readDataRLE(reader, undefined, 0, 2_000_000_000, 8, 4, [0], false))
				.to.throw('Exceeded memory limit');
		});
	});

	describe('16/32-bit RLE', () => {
		it('decodes 16-bit RLE composite with correct values (white = 65535)', () => {
			const psd = readPsd(fs.readFileSync(path.join(readFilesPath, '16bits', 'src.psd')), { useImageData: true });
			const data = psd.imageData!.data;
			expect(data).instanceOf(Uint16Array);
			expect(Array.from(data.slice(0, 4))).eql([65535, 65535, 65535, 65535]);
		});

		it('decodes 16-bit big-endian values', () => {
			// 2x1 image, one channel: literal run of 4 bytes
			const buffer = Buffer.concat([u16(5), u8(3, 0x12, 0x34, 0xff, 0xfe)]);
			const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const pixels: PixelData = { width: 2, height: 1, data: new Uint16Array(8) };
			readDataRLE(reader, pixels, 2, 1, 16, 4, [1], false);
			expect(Array.from(pixels.data)).eql([0, 0x1234, 0, 0, 0, 0xfffe, 0, 0]);
			expect(reader.offset).equal(buffer.byteLength);
		});

		it('decodes 32-bit big-endian float values', () => {
			const values = Buffer.concat([f32(1), f32(0.25)]);
			const buffer = Buffer.concat([u16(9), u8(7), values]);
			const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const pixels: PixelData = { width: 2, height: 1, data: new Float32Array(8) };
			readDataRLE(reader, pixels, 2, 1, 32, 4, [0], false);
			expect(Array.from(pixels.data)).eql([1, 0, 0, 0, 0.25, 0, 0, 0]);
		});

		it('starts every RLE row at the start of image row', () => {
			// 3x2 image, first row is short (only 1 value)
			const buffer = Buffer.concat([u16(2), u16(4), u8(0, 7), u8(2, 1, 2, 3)]);
			const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const pixels: PixelData = { width: 3, height: 2, data: new Uint8Array(6) };
			readDataRLE(reader, pixels, 3, 2, 8, 1, [0], false);
			expect(Array.from(pixels.data)).eql([7, 0, 0, 1, 2, 3]);
		});
	});

	describe('input buffer', () => {
		const file = fs.readFileSync(path.join(readFilesPath, '32bits', 'src.psd'));

		it('is not mutated by reading and repeated parse gives identical results', () => {
			const buffer = Buffer.from(file);
			const psd1 = readPsd(buffer, { useImageData: true });
			expect(buffer.equals(file)).true;
			const psd2 = readPsd(buffer, { useImageData: true });
			expect(buffer.equals(file)).true;

			expect(psd1.imageData!.data).instanceOf(Float32Array);
			expect(Array.from(psd2.imageData!.data)).eql(Array.from(psd1.imageData!.data));
			expect(psd1.children!.length).greaterThan(0);

			for (let i = 0; i < psd1.children!.length; i++) {
				const a = psd1.children![i].imageData, b = psd2.children![i].imageData;
				expect(!!a).equal(!!b);
				if (a && b) expect(Buffer.from(b.data.buffer).equals(Buffer.from(a.data.buffer))).true;
			}
		});

		it('is not mutated when decoding raw data multiple times', () => {
			const buffer = Buffer.from(file);
			const psd = readPsd(buffer, { useImageData: true, useRawData: true });

			const layers: Layer[] = [];
			(function collect(list: Layer[]) { for (const l of list) { layers.push(l); if (l.children) collect(l.children); } })(psd.children!);

			for (const layer of layers) {
				const a = getLayerImageData(layer);
				const b = getLayerImageData(layer);
				expect(!!a).equal(!!b);
				if (a && b) expect(Array.from(b.data)).eql(Array.from(a.data));
			}

			const c1 = getCompositeImageData(psd)!;
			const c2 = getCompositeImageData(psd)!;
			expect(Array.from(c2.data)).eql(Array.from(c1.data));
			expect(buffer.equals(file)).true;
		});

		it('reads raw 16-bit data from unaligned offsets', () => {
			const composite = Buffer.concat([u16(0), u16(0x1234), u16(0x5678), u16(0x9abc)]);
			const data = buildPsd({ width: 1, height: 1, channels: 3, bits: 16, composite });
			const outer = Buffer.alloc(data.length + 1);
			data.copy(outer, 1);
			const psd = readPsd(Buffer.from(outer.buffer, outer.byteOffset + 1, data.length), strictOpts);
			expect(Array.from(psd.imageData!.data)).eql([0x1234, 0x5678, 0x9abc, 0xffff]);
			expect(outer.subarray(1).equals(data)).true;
		});
	});

	describe('layer groups', () => {
		it('does not crash on unmatched group end divider', () => {
			const data = buildPsd({
				width: 1, height: 1, channels: 3, layers: [{}, { sectionDividerType: 3 }],
				composite: Buffer.concat([u16(0), u8(1, 2, 3)]),
			});
			const psd = readPsd(data, strictOpts);
			expect(psd.children!.length).equal(1);
		});
	});

	describe('readBytes()', () => {
		it('checks bounds against view instead of whole buffer', () => {
			const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

			const reader = createReader(buffer.buffer, 2, 6); // 3..8
			reader.offset = 2;
			const bytes = readBytes(reader, 6);
			expect(Array.from(bytes)).eql([5, 6, 7, 8, 0, 0]);
			expect(reader.offset).equal(8);

			const strictReader = createReader(buffer.buffer, 2, 6);
			strictReader.strict = true;
			strictReader.offset = 2;
			expect(() => readBytes(strictReader, 6)).throw('Reading bytes exceeding buffer length');

			const okReader = createReader(buffer.buffer, 2, 6);
			okReader.strict = true;
			okReader.offset = 1;
			expect(Array.from(readBytes(okReader, 5))).eql([4, 5, 6, 7, 8]);
		});

		it('limits raw composite data to the view', () => {
			const data = buildPsd({ width: 1, height: 1, channels: 3, composite: Buffer.concat([u16(0), u8(10, 20, 30)]) });
			const outer = Buffer.concat([data, Buffer.alloc(100, 0xff)]);
			const psd = readPsd(Buffer.from(outer.buffer, outer.byteOffset, data.length), { useRawData: true });
			expect(psd.rawCompositeData!.byteLength).equal(5);
			expect(Array.from(getCompositeImageData(psd)!.data)).eql([10, 20, 30, 255]);
		});
	});

	describe('channel count', () => {
		it('accepts up to 56 channels', () => {
			const channels = Array.from({ length: 56 }, (_, i) => i < 3 ? (i + 1) * 10 : 255);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 56, composite: Buffer.concat([u16(0), u8(...channels)]) }), strictOpts);
			expect(psd.channels).equal(56);
			expect(Array.from(psd.imageData!.data)).eql([10, 20, 30, 255]);
		});

		it('reads 56 channels with transparency (57 channels) and rejects more', () => {
			const channels = Array.from({ length: 57 }, (_, i) => i < 3 ? (i + 1) * 10 : 255);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 57, globalAlpha: true, composite: Buffer.concat([u16(0), u8(...channels)]) }), strictOpts);
			expect(psd.channels).equal(57);
			expect(Array.from(psd.imageData!.data)).eql([10, 20, 30, 255]);
			expect(() => readPsd(buildPsd({ width: 1, height: 1, channels: 58, composite: u16(0) }), strictOpts)).throw('Invalid channel count');
		});
	});

	describe('global alpha', () => {
		it('removes white matte from 16-bit composite', () => {
			const composite = Buffer.concat([u16(0), u16(0xffff), u16(0x8000), u16(0), u16(0x8000)]);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 4, bits: 16, globalAlpha: true, composite }), strictOpts);
			const data = Array.from(psd.imageData!.data);
			expect(data[0]).equal(0xffff);
			expect(data[1]).within(0, 4);
			expect(data[2]).equal(0);
			expect(data[3]).equal(0x8000);
		});

		it('removes white matte from 32-bit composite', () => {
			const composite = Buffer.concat([u16(0), f32(1), f32(0.75), f32(0.25), f32(0.5)]);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 4, bits: 32, globalAlpha: true, composite }), strictOpts);
			expect(Array.from(psd.imageData!.data)).eql([1, 0.5, 0, 0.5]);
		});
	});

	describe('composite channels', () => {
		it('uses first extra channel as transparency for global alpha', () => {
			const composite = Buffer.concat([u16(0), u8(10, 20, 30, 0, 99)]);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 5, globalAlpha: true, composite }), strictOpts);
			expect(Array.from(psd.imageData!.data)).eql([10, 20, 30, 0]);
		});

		it('does not use named alpha channel as transparency without global alpha', () => {
			const composite = Buffer.concat([u16(0), u8(10, 20, 30, 0)]);
			const resources = alphaNamesResource(['Alpha 1']);
			const psd = readPsd(buildPsd({ width: 1, height: 1, channels: 4, resources, layers: [{}], composite }), strictOpts);
			expect(psd.imageResources!.alphaChannelNames).eql(['Alpha 1']);
			expect(Array.from(psd.imageData!.data)).eql([10, 20, 30, 255]);
		});

		it('reads RLE lengths for all grayscale channels', () => {
			const composite = rleComposite([[[10, 20]], [[255, 0]], [[1, 2]]]);
			const resources = alphaNamesResource(['Transparency', 'Alpha 1']);
			const psd = readPsd(buildPsd({ width: 2, height: 1, channels: 3, colorMode: ColorMode.Grayscale, globalAlpha: true, resources, composite }), strictOpts);
			expect(Array.from(psd.imageData!.data)).eql([10, 10, 10, 255, 20, 20, 20, 0]);
		});

		it('reads indexed composite with raw compression', () => {
			const palette = Buffer.alloc(768);
			palette[1] = 100; palette[256 + 1] = 150; palette[512 + 1] = 200;
			const psd = readPsd(buildPsd({
				width: 2, height: 1, channels: 1, colorMode: ColorMode.Indexed, colorModeData: palette,
				composite: Buffer.concat([u16(0), u8(1, 0)]),
			}), strictOpts);
			expect(Array.from(psd.imageData!.data)).eql([100, 150, 200, 255, 0, 0, 0, 255]);
		});

		it('reads bitmap RLE composite', () => {
			// 10x2 bitmap, 2 bytes per row
			const composite = rleComposite([[[0b10100000, 0b01000000], [0xff, 0x00]]]);
			const psd = readPsd(buildPsd({ width: 10, height: 2, channels: 1, bits: 1, colorMode: ColorMode.Bitmap, composite }), strictOpts);
			const values = [];
			for (let i = 0; i < 20; i++) values.push(psd.imageData!.data[i * 4]);
			expect(values).eql([
				0, 255, 0, 255, 255, 255, 255, 255, 255, 0,
				0, 0, 0, 0, 0, 0, 0, 0, 255, 255,
			]);
		});
	});

	describe('getCompositeImageData()', () => {
		it('uses global alpha and large flags of the document', () => {
			const composite = rleComposite([[[10]], [[20]], [[30]], [[0]]], true);
			const data = buildPsd({ width: 1, height: 1, channels: 4, version: 2, globalAlpha: true, composite });
			const expected = readPsd(data, strictOpts).imageData!;
			expect(Array.from(expected.data)).eql([10, 20, 30, 0]);
			const psd = readPsd(data, { ...strictOpts, useRawData: true });
			expect(Array.from(getCompositeImageData(psd)!.data)).eql(Array.from(expected.data));

			// works with copy of the document and its data
			const copy: Psd = { ...psd, rawCompositeData: psd.rawCompositeData!.slice() };
			expect(Array.from(getCompositeImageData(copy)!.data)).eql(Array.from(expected.data));
		});
	});

	describe('layer mask', () => {
		it('does not detect real mask when all mask parameters are present', () => {
			const psd: Psd = {
				width: 4, height: 4,
				children: [{
					name: 'layer',
					imageData: { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(255) },
					top: 0, left: 0,
					mask: {
						top: 0, left: 0, bottom: 4, right: 4, defaultColor: 0,
						imageData: { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(255) },
						userMaskDensity: 0.5, userMaskFeather: 5, vectorMaskDensity: 0.25, vectorMaskFeather: 2,
					},
				}],
			};
			const result = readPsd(writePsdBuffer(psd), { useImageData: true, skipCompositeImageData: true });
			const layer = result.children![0];
			expect(layer.realMask).undefined;
			expect(layer.mask!.userMaskFeather).equal(5);
			expect(layer.mask!.vectorMaskFeather).equal(2);
			expect(layer.mask!.userMaskDensity).closeTo(0.5, 0.01);
			expect(layer.mask!.vectorMaskDensity).closeTo(0.25, 0.01);
		});

		const maskBase = Buffer.concat([u32(0), u32(0), u32(2), u32(2), u8(0), u8(0x10)]); // rect, default color, flags (has params)
		const allParams = Buffer.concat([u8(0x0f), u8(128), Buffer.alloc(8), u8(64), Buffer.alloc(8)]); // 19 bytes
		const realMaskData = Buffer.concat([u8(0x02), u8(255), u32(0), u32(0), u32(1), u32(1)]); // 18 bytes

		function readMask(maskData: Buffer) {
			const data = buildPsd({ width: 1, height: 1, channels: 3, layers: [{ maskData }], composite: Buffer.concat([u16(0), u8(1, 2, 3)]) });
			return readPsd(data, strictOpts).children![0];
		}

		it('reads mask parameters without real mask (with and without padding)', () => {
			for (const padding of [Buffer.alloc(0), Buffer.alloc(2)]) {
				const layer = readMask(Buffer.concat([maskBase, allParams, padding]));
				expect(layer.realMask).undefined;
				expect(layer.mask!.userMaskDensity).closeTo(128 / 255, 0.001);
				expect(layer.mask!.vectorMaskDensity).closeTo(64 / 255, 0.001);
			}
		});

		it('reads real mask followed by mask parameters', () => {
			for (const params of [Buffer.concat([u8(0x01), u8(128)]), allParams]) {
				const layer = readMask(Buffer.concat([maskBase, realMaskData, params, Buffer.alloc(2)]));
				expect(layer.realMask).not.undefined;
				expect(layer.realMask!.disabled).true;
				expect(layer.realMask!.bottom).equal(1);
				expect(layer.mask!.userMaskDensity).closeTo(128 / 255, 0.001);
			}
		});

		it('reads all mask parameters without real mask when last parameter byte is not 0', () => {
			const feather = Buffer.alloc(8);
			feather.writeDoubleBE(1 / 3); // last byte is 0x55
			const params = Buffer.concat([u8(0x0f), u8(128), Buffer.alloc(8), u8(64), feather]);
			const layer = readMask(Buffer.concat([maskBase, params, Buffer.alloc(3)]));
			expect(layer.realMask).undefined;
			expect(layer.mask!.vectorMaskFeather).equal(1 / 3);
			expect(layer.mask!.vectorMaskDensity).closeTo(64 / 255, 0.001);
		});

		it('round-trips mask parameters with any feather values', () => {
			for (const feather of [1 / 3, 0.1, 2.2]) {
				const psd: Psd = {
					width: 2, height: 2,
					children: [{
						imageData: { width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4).fill(255) },
						mask: {
							top: 0, left: 0, imageData: { width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4).fill(255) },
							userMaskDensity: 0.5, userMaskFeather: feather, vectorMaskDensity: 0.5, vectorMaskFeather: feather,
						},
					}],
				};
				const layer = readPsd(writePsdBuffer(psd), strictOpts).children![0];
				expect(layer.realMask).undefined;
				expect(layer.mask!.userMaskFeather).equal(feather);
				expect(layer.mask!.vectorMaskFeather).equal(feather);
			}
		});

		it('reads real mask with flags that look like mask parameters', () => {
			// real mask flags 0x0f read as mask parameters flags would match size of all mask parameters
			const realMask = Buffer.concat([u8(0x0f), u8(255), u32(0), u32(0), u32(1), u32(1)]);
			const layer = readMask(Buffer.concat([maskBase, realMask, u8(0x01), u8(128), Buffer.alloc(2)]));
			expect(layer.realMask).not.undefined;
			expect(layer.realMask!.disabled).true;
			expect(layer.realMask!.bottom).equal(1);
			expect(layer.mask!.userMaskDensity).closeTo(128 / 255, 0.001);
		});

		it('reads global layer mask opacity in 0-100 range', () => {
			const psd = readPsd(fs.readFileSync(path.join(readFilesPath, 'layer-mask', 'src.psd')), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
			expect(psd.globalLayerMaskInfo!.opacity).equal(0.5);
		});
	});

	describe('malformed data', () => {
		it('handles RLE row lengths past end of data quickly', () => {
			const height = 30000;
			const buffer = Buffer.concat([Buffer.alloc(height * 2, 0xff), u8(0, 1)]);
			const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const pixels: PixelData = { width: 30000, height, data: new Uint8Array(1) };
			const start = Date.now();
			readDataRLE(reader, pixels, 30000, height, 8, 1, [0], false);
			expect(Date.now() - start).lessThan(1000);

			const strictReader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			strictReader.strict = true;
			expect(() => readDataRLE(strictReader, pixels, 30000, height, 8, 1, [0], false)).throw('RLE data exceeds buffer length');
		});

		it('ignores RLE data past row width', () => {
			const row = [0x7f, ...Array.from({ length: 128 }, (_, i) => i), 0x81, 5];
			const buffer = Buffer.concat([u16(row.length), u16(2), Buffer.from(row), u8(0, 9)]);
			const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const pixels: PixelData = { width: 2, height: 2, data: new Uint8Array(4) };
			readDataRLE(reader, pixels, 2, 2, 8, 1, [0], false);
			expect(Array.from(pixels.data)).eql([0, 1, 9, 0]);
			expect(reader.offset).equal(buffer.byteLength);
		});

		it('throws on corrupted zip data', () => {
			const data = new Uint8Array(400);
			for (let i = 0; i < data.length; i++) data[i] = (i * 7) & 0xff;
			const compressed = deflate(data);
			for (let i = 4; i < 12; i++) compressed[i] = 0xff;
			const pixels: PixelData = { width: 10, height: 10, data: new Uint8Array(400) };

			expect(() => readDataZip(compressed, pixels, 10, 10, 8, 4, 0, false)).throw(/Invalid zip data/);
		});

		it('limits size of decompressed zip data', () => {
			const compressed = deflate(new Uint8Array(10 * 1024 * 1024));
			const pixels: PixelData = { width: 10, height: 10, data: new Uint8Array(400).fill(1) };

			const reader = createReader(new ArrayBuffer(0));
			reader.strict = true;
			expect(() => readDataZip(compressed, pixels, 10, 10, 8, 4, 0, false, reader)).throw('Decompressed data exceeds expected size');

			const lenient = createReader(new ArrayBuffer(0));
			readDataZip(compressed, pixels, 10, 10, 8, 4, 0, false, lenient);
			expect(pixels.data[0]).equal(0);
			expect(pixels.data[1]).equal(1);

			const limited = createReader(new ArrayBuffer(0));
			limited.totalMemoryLimit = 50;
			expect(() => readDataZip(compressed, pixels, 10, 10, 8, 4, 0, false, limited)).throw('Exceeded memory limit');
		});

		it('decodes zip with prediction for 16-bit data', () => {
			const raw = Buffer.concat([u16(1000), u16(65535), u16(2)]); // deltas: 1000, -1 (wraps), +2 -> 1000, 999, 1001
			const compressed = deflate(raw);
			const pixels: PixelData = { width: 3, height: 1, data: new Uint16Array(12) };
			readDataZip(compressed, pixels, 3, 1, 16, 4, 0, true);
			expect([pixels.data[0], pixels.data[4], pixels.data[8]]).eql([1000, 999, 1001]);
		});
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

function buildPattern(width: number, height: number, channels: { depth: number; rect?: number[]; data: number[]; compression?: number; }[], colorMode = ColorMode.RGB) {
	const uint32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
	const arrays: number[] = [];

	for (const c of channels) {
		const [top, left, bottom, right] = c.rect ?? [0, 0, height, width];
		arrays.push(...uint32(1), ...uint32(23 + c.data.length), ...uint32(c.depth), ...uint32(top), ...uint32(left), ...uint32(bottom), ...uint32(right), 0, c.depth, c.compression ?? 0, ...c.data);
	}

	arrays.push(...uint32(0), ...uint32(0)); // user mask and sheet mask
	const vmal = [...uint32(0), ...uint32(0), ...uint32(height), ...uint32(width), ...uint32(channels.length), ...arrays];
	const body = [...uint32(1), ...uint32(colorMode), 0, 0, 0, 0, ...uint32(0), 0, ...uint32(3), ...uint32(vmal.length), ...vmal];
	while (body.length % 4) body.push(0);
	return Buffer.from([...uint32(body.length), ...body]);
}
