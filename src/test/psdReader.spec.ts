import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import {
	readPsdFromFile, importPSD, loadImagesFromDirectory, compareCanvases, saveCanvas,
	createReaderFromBuffer,
	compareBuffers
} from './common';
import { Layer, ReadOptions, Psd } from '../psd';
import { readPsd, writePsdBuffer } from '../index';
import { readPsd as readPsdInternal } from '../psdReader';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'read');
const readWriteFilesPath = path.join(testFilesPath, 'read-write');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');
const opts: ReadOptions = {
	throwForMissingFeatures: true,
	logMissingFeatures: true,
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

	it.skip('can read a PSD with layer masks (only if throw on missing features is not set)', () => {
		const psd = readPsdFromFile(path.join(readFilesPath, '..', 'layer-mask', 'src.psd'));
		expect(psd.children![0].canvas).ok;
	});

	it('reads PSD from Buffer with offset', () => {
		const file = fs.readFileSync(path.join(readFilesPath, 'layers', 'src.psd'));
		const outer = Buffer.alloc(file.byteLength + 100);
		file.copy(outer, 100);
		const inner = Buffer.from(outer.buffer, 100, file.byteLength);

		const psd = readPsd(inner, opts);

		expect(psd.width).equal(300);
	});

	fs.readdirSync(readFilesPath).filter(f => !/pattern/.test(f)).forEach(f => {
		it(`reads PSD file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const psd = readPsdFromFile(path.join(basePath, 'src.psd'), { ...opts });
			const expected = importPSD(basePath);
			const images = loadImagesFromDirectory(basePath);
			const compare: { name: string; canvas: HTMLCanvasElement | undefined; skip?: boolean; }[] = [];

			compare.push({ name: `canvas.png`, canvas: psd.canvas });
			psd.canvas = undefined;
			delete psd.imageData;
			delete psd.imageResources!.xmpMetadata;

			let i = 0;

			function pushLayerCanvases(layers: Layer[]) {
				for (const l of layers) {
					if (l.children) {
						pushLayerCanvases(l.children);
					} else {
						const layerId = i++;
						compare.push({ name: `layer-${layerId}.png`, canvas: l.canvas });
						l.canvas = undefined;
						delete l.imageData;

						if (l.mask) {
							compare.push({ name: `layer-${layerId}-mask.png`, canvas: l.mask.canvas });
							delete l.mask.canvas;
							delete l.mask.imageData;
						}
					}
				}
			}

			pushLayerCanvases(psd.children || []);
			fs.mkdirSync(path.join(resultsFilesPath, f), { recursive: true });

			if (psd.imageResources?.thumbnail) {
				compare.push({ name: 'thumb.png', canvas: psd.imageResources.thumbnail, skip: true });
				delete psd.imageResources.thumbnail;
			}

			if (psd.imageResources) delete psd.imageResources.thumbnailRaw;

			compare.forEach(i => saveCanvas(path.join(resultsFilesPath, f, i.name), i.canvas));

			fs.writeFileSync(path.join(resultsFilesPath, f, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');

			clearEmptyCanvasFields(psd);
			clearEmptyCanvasFields(expected);

			expect(psd).eql(expected, f);
			compare.forEach(i => i.skip || compareCanvases(images[i.name], i.canvas, `${f}/${i.name}`));
		});
	});

	fs.readdirSync(readWriteFilesPath).forEach(f => {
		it(`reads-writes PSD file (${f})`, () => {
			const psd = readPsdFromFile(path.join(readWriteFilesPath, f, 'src.psd'), { ...opts, useImageData: true, useRawThumbnail: true });
			const actual = writePsdBuffer(psd);
			const expected = fs.readFileSync(path.join(readWriteFilesPath, f, 'expected.psd'));
			fs.writeFileSync(path.join(resultsFilesPath, `read-write-${f}.psd`), actual);
			compareBuffers(actual, expected, `read-write-${f}`);
		});
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

		fs.writeFileSync(path.join(resultsFilesPath, '_TEXT2.psd'), writePsdBuffer(psd));
	});

	it.skip('read text layer test', () => {
		const psd = readPsdFromFile(path.join(testFilesPath, 'text-test.psd'), opts);
		// const layer = psd.children![1];

		// layer.text!.text = 'Foo bar';
		const buffer = writePsdBuffer(psd);
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
		const buffer = writePsdBuffer(originalPsd);
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
		fs.writeFileSync('text_rect_out.psd', writePsdBuffer(psd));
		fs.writeFileSync('text_rect_out.bin', writePsdBuffer(psd));
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
			const output = writePsdBuffer(psd, { invalidateTextLayers: true });
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

/// Engine data 2 experiments
// /test/engineData2.json:1109 is character codes

const keysColor = {
	'0': {
		uproot: true,
		children: {
			'0': { name: 'Type' },
			'1': { name: 'Values' },
		},
	},
};

const keysStyleSheet = {
	'0': { name: 'Font' },
	'1': { name: 'FontSize' },
	'2': { name: 'FauxBold' },
	'3': { name: 'FauxItalic' },
	'4': { name: 'AutoLeading' },
	'5': { name: 'Leading' },
	'6': { name: 'HorizontalScale' },
	'7': { name: 'VerticalScale' },
	'8': { name: 'Tracking' },
	'9': { name: 'BaselineShift' },

	'11': { name: 'Kerning?' }, // different value than EngineData
	'12': { name: 'FontCaps' },
	'13': { name: 'FontBaseline' },

	'15': { name: 'Strikethrough?' }, // number instead of bool
	'16': { name: 'Underline?' }, // number instead of bool

	'18': { name: 'Ligatures' },
	'19': { name: 'DLigatures' },

	'23': { name: 'Fractions' }, // not present in EngineData
	'24': { name: 'Ordinals' }, // not present in EngineData

	'28': { name: 'StylisticAlternates' }, // not present in EngineData

	'30': { name: 'OldStyle?' }, // OpenType > OldStyle, number instead of bool, not present in EngineData

	'35': { name: 'BaselineDirection' },

	'38': { name: 'Language' },

	'52': { name: 'NoBreak' },
	'53': { name: 'FillColor', children: keysColor },
};

const keysParagraph = {
	'0': { name: 'Justification' },
	'1': { name: 'FirstLineIndent' },
	'2': { name: 'StartIndent' },
	'3': { name: 'EndIndent' },
	'4': { name: 'SpaceBefore' },
	'5': { name: 'SpaceAfter' },

	'7': { name: 'AutoLeading' },

	'9': { name: 'AutoHyphenate' },
	'10': { name: 'HyphenatedWordSize' },
	'11': { name: 'PreHyphen' },
	'12': { name: 'PostHyphen' },
	'13': { name: 'ConsecutiveHyphens?' }, // different value than EngineData
	'14': { name: 'Zone' },
	'15': { name: 'HypenateCapitalizedWords' }, // not present in EngineData

	'17': { name: 'WordSpacing' },
	'18': { name: 'LetterSpacing' },
	'19': { name: 'GlyphSpacing' },

	'32': { name: 'StyleSheet', children: keysStyleSheet },
};

const keysStyleSheetData = {
	name: 'StyleSheetData',
	children: keysStyleSheet,
};

const keys = {
	'0': {
		name: 'ResourceDict',
		children: {
			'1': {
				name: 'FontSet',
				children: {
					'0': {
						uproot: true,
						children: {
							'0': {
								uproot: true,
								children: {
									'0': {
										uproot: true,
										children: {
											'0': { name: 'Name' },
											'2': { name: 'FontType' },
										},
									},
								},
							}
						},
					},
				},
			},
			'2': {
				name: '2',
				children: {},
			},
			'3': {
				name: 'MojiKumiSet',
				children: {
					'0': {
						uproot: true,
						children: {
							'0': {
								uproot: true,
								children: {
									'0': { name: 'InternalName' },
								},
							},
						},
					},
				},
			},
			'4': {
				name: 'KinsokuSet',
				children: {
					'0': {
						uproot: true,
						children: {
							'0': {
								uproot: true,
								children: {
									'0': { name: 'Name' },
									'5': {
										uproot: true,
										children: {
											'0': { name: 'NoStart' },
											'1': { name: 'NoEnd' },
											'2': { name: 'Keep' },
											'3': { name: 'Hanging' },
										},
									},
								},
							},
						},
					},
				},
			},
			'5': {
				name: 'StyleSheetSet',
				children: {
					'0': {
						uproot: true,
						children: {
							'0': {
								uproot: true,
								children: {
									'0': { name: 'Name' },
									'6': keysStyleSheetData,
								},
							},
						},
					},
				},
			},
			'6': {
				name: 'ParagraphSheetSet',
				children: {
					'0': {
						uproot: true,
						children: {
							'0': {
								uproot: true,
								children: {
									'0': { name: 'Name' },
									'5': {
										name: 'Properties',
										children: keysParagraph,
									},
									'6': { name: 'DefaultStyleSheet' },
								},
							},
						},
					},
				},
			},
			'8': {
				name: '8',
				children: {},
			},
			'9': {
				name: 'Predefined',
				children: {},
			},
		},
	},
	'1': {
		name: 'EngineDict',
		children: {
			'0': {
				name: '0',
				children: {
					'0': {
						name: '0',
						children: {
						},
					},
					'3': { name: 'SuperscriptSize' },
					'4': { name: 'SuperscriptPosition' },
					'5': { name: 'SubscriptSize' },
					'6': { name: 'SubscriptPosition' },
					'7': { name: 'SmallCapSize' },
					'8': { name: 'UseFractionalGlyphWidths' }, // ???
				},
			},
			'1': {
				name: 'Editors?',
				children: {
					'0': {
						name: 'Editor',
						children: {
							'0': { name: 'Text' },
							'5': {
								name: 'ParagraphRun',
								children: {
									'0': {
										name: 'RunArray',
										children: {
											'0': {
												name: 'ParagraphSheet',
												children: {
													'0': {
														uproot: true,
														children: {
															'0': { name: '0' },
															'5': {
																name: '5',
																children: keysParagraph,
															},
															'6': { name: '6' },
														},
													},
												},
											},
											'1': { name: 'RunLength' },
										},
									},
								},
							},
							'6': {
								name: 'StyleRun',
								children: {
									'0': {
										name: 'RunArray',
										children: {
											'0': {
												name: 'StyleSheet',
												children: {
													'0': {
														uproot: true,
														children: {
															'6': keysStyleSheetData,
														},
													},
												},
											},
											'1': { name: 'RunLength' },
										},
									},
								},
							},
						},
					},
					'1': {
						name: 'FontVectorData ???',
					},
				},
			},
			'2': {
				name: 'StyleSheet',
				children: keysStyleSheet,
			},
			'3': {
				name: 'ParagraphSheet',
				children: keysParagraph,
			},
		},
	},
};

function decodeObj(obj: any, keys: any): any {
	if (obj === null || !keys) return obj;

	if (Array.isArray(obj)) {
		return obj.map(x => decodeObj(x, keys));
	}

	if (typeof obj !== 'object') return obj;

	const result: any = {};

	for (const key of Object.keys(obj)) {
		if (keys[key]) {
			if (keys[key].uproot) {
				return decodeObj(obj[key], keys[key].children);
			} else {
				result[keys[key].name] = decodeObj(obj[key], keys[key].children);
			}
		} else {
			result[key] = obj[key];
		}
	}

	return result;
}

function decodeEngineData2(data: any) {
	return decodeObj(data, keys);
}
