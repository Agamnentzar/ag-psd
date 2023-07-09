import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import {
	readPsdFromFile, importPSD, loadImagesFromDirectory, compareCanvases, saveCanvas,
	createReaderFromBuffer, compareBuffers, compareTwoFiles
} from './common';
import { Layer, ReadOptions, Psd } from '../psd';
import { byteArrayToBase64, readPsd, writePsdBuffer } from '../index';
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
		// fs.readdirSync(readFilesPath).filter(f => /ignore-smart-filter/.test(f)).forEach(f => {
		it(`reads PSD file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const fileName = fs.existsSync(path.join(basePath, 'src.psb')) ? 'src.psb' : 'src.psd';
			const psd = readPsdFromFile(path.join(basePath, fileName), {
				...opts,
				// logDevFeatures: true, logMissingFeatures: true,
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
						compareFiles.push({ name: file.name, data: file.data });
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
		// fs.readdirSync(readWriteFilesPath).filter(f => /smart-filters-2/.test(f)).forEach(f => {
		it(`reads-writes PSD file (${f})`, () => {
			const ext = fs.existsSync(path.join(readWriteFilesPath, f, 'src.psb')) ? 'psb' : 'psd';
			const psd = readPsdFromFile(path.join(readWriteFilesPath, f, `src.${ext}`), {
				...opts, useImageData: true, useRawThumbnail: true, throwForMissingFeatures: true,
				// logDevFeatures: true, logMissingFeatures: true,
			});
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
			compareBuffers(actual, expected, `read-write-${f}`, 0x25584);
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
