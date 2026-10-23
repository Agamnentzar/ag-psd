import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { expect } from 'chai';
import { loadCanvasFromFile, compareBuffers, createCanvas, compareCanvases } from './common';
import { Psd, WriteOptions, ReadOptions, PatternInfo, PixelData, LayerMaskData } from '../psd';
import { writePsd, writeSignature, getWriterBuffer, createWriter, writePattern, getRLEChannelBound } from '../psdWriter';
import { readPsd, createReader, readPattern } from '../psdReader';
import { writePsdBuffer, writePsdUint8Array, readPsd as readPsdBuffer } from '../index';

const layerImagesPath = path.join(__dirname, '..', '..', 'test', 'layer-images');
const writeFilesPath = path.join(__dirname, '..', '..', 'test', 'write');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

function writeAndRead(psd: Psd, writeOptions: WriteOptions = {}, readOptions: ReadOptions = {}) {
	const writer = createWriter();
	writePsd(writer, psd, writeOptions);
	const buffer = getWriterBuffer(writer);
	const reader = createReader(buffer);
	return readPsd(reader, { ...readOptions, throwForMissingFeatures: true, logMissingFeatures: true });
}

function tryLoadCanvasFromFile(filePath: string) {
	try {
		return loadCanvasFromFile(filePath);
	} catch {
		return undefined;
	}
}

function loadPsdFromJSONAndPNGFiles(basePath: string) {
	const psd: Psd = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));
	psd.canvas = loadCanvasFromFile(path.join(basePath, 'canvas.png'));
	psd.children!.forEach((l, i) => {
		if (!l.children) {
			l.canvas = tryLoadCanvasFromFile(path.join(basePath, `layer-${i}.png`));

			if (l.mask) {
				l.mask.canvas = tryLoadCanvasFromFile(path.join(basePath, `layer-${i}-mask.png`));
			}
		}
	});
	psd.linkedFiles?.forEach(f => {
		try {
			f.data = fs.readFileSync(path.join(basePath, f.name));
		} catch (e) { }
	});
	return psd;
}

function createPixels(width: number, height: number, alpha: boolean, seed = 1): PixelData {
	const data = new Uint8ClampedArray(width * height * 4);
	let s = seed;
	const next = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) >> 16;

	for (let i = 0; i < data.length; i += 4) {
		// random noise is the worst case for RLE
		data[i + 0] = next() & 0xff;
		data[i + 1] = next() & 0xff;
		data[i + 2] = next() & 0xff;
		data[i + 3] = alpha ? ((next() & 1) ? 255 : 0) : 255; // no semi-transparency, it would be altered by white matte
	}

	return { width, height, data };
}

function bytes(data: PixelData['data']) {
	return Array.from(data as Uint8ClampedArray);
}

function findBytes(haystack: Uint8Array, needle: number[]) {
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return i;
	}
	return -1;
}

describe('PsdWriter', () => {
	it('does not throw if writing psd with empty canvas', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: 300,
			height: 200
		};

		writePsd(writer, psd);
	});

	it('throws if passed invalid signature', () => {
		const writer = createWriter();

		for (const s of ['a', 'ab', 'abcde']) {
			expect(() => writeSignature(writer, s), s).throw(`Invalid signature: '${s}'`);
		}
	});

	it('throws exception if has layer with both children and canvas properties set', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: 300,
			height: 200,
			children: [{ children: [], canvas: createCanvas(300, 300) }]
		};

		expect(() => writePsd(writer, psd)).throw(`Invalid layer, cannot have both 'canvas' and 'children' properties`);
	});

	it('throws exception if has layer with both children and imageData properties set', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: 300,
			height: 200,
			children: [{ children: [], imageData: {} as any }]
		};

		expect(() => writePsd(writer, psd)).throw(`Invalid layer, cannot have both 'imageData' and 'children' properties`);
	});

	it('throws if psd has invalid width or height', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: -5,
			height: 0,
		};

		expect(() => writePsd(writer, psd)).throw(`Invalid document size`);
	});

	it('round-trips a pattern through writePattern/readPattern', () => {
		const w = 5, h = 3;
		const data = new Uint8Array(w * h * 4);
		for (let i = 0; i < w * h; i++) {
			data[i * 4 + 0] = i * 10;
			data[i * 4 + 1] = i * 5;
			data[i * 4 + 2] = i * 2;
			data[i * 4 + 3] = 255;
		}
		const pattern: PatternInfo = { id: 'abc123', name: 'mypat', x: 1, y: 2, bounds: { x: 0, y: 0, w, h }, data };

		const writer = createWriter();
		writePattern(writer, pattern);
		const buffer = getWriterBuffer(writer);
		const result = readPattern(createReader(buffer));

		expect(result.id).equal(pattern.id);
		expect(result.name).equal(pattern.name);
		expect(result.x).equal(pattern.x);
		expect(result.y).equal(pattern.y);
		expect(result.bounds).eql(pattern.bounds);
		expect(Array.from(result.data)).eql(Array.from(data));
	});

	const fullImage = loadCanvasFromFile(path.join(layerImagesPath, 'full.png'));
	const transparentImage = loadCanvasFromFile(path.join(layerImagesPath, 'transparent.png'));
	const trimmedImage = loadCanvasFromFile(path.join(layerImagesPath, 'trimmed.png'));
	// const croppedImage = loadCanvasFromFile(path.join(layerImagesPath, 'cropped.png'));
	// const paddedImage = loadCanvasFromFile(path.join(layerImagesPath, 'padded.png'));

	describe('layer left, top, right, bottom handling', () => {
		it('handles undefined left, top, right, bottom with layer image the same size as document', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'full-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(300);
			expect(layer.bottom).equal(200);
		});

		it('handles layer image larger than document', () => {
			const psd: Psd = {
				width: 100,
				height: 50,
				children: [
					{
						name: 'test',
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'oversized-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(300);
			expect(layer.bottom).equal(200);
		});

		it('aligns layer image to top left if layer image is smaller than document', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						canvas: trimmedImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(trimmedImage, layer.canvas, 'smaller-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(192);
			expect(layer.bottom).equal(68);
		});

		it('does not trim transparent layer image if trim option is not passed', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						canvas: transparentImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(transparentImage, layer.canvas, 'transparent-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(300);
			expect(layer.bottom).equal(200);
		});

		it('trims transparent layer image if trim option is set', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						canvas: transparentImage,
					},
				],
			};

			const result = writeAndRead(psd, { trimImageData: true });

			const layer = result.children![0];
			compareCanvases(trimmedImage, layer.canvas, 'trimmed-layer-image.png');
			expect(layer.left).equal(51);
			expect(layer.top).equal(65);
			expect(layer.right).equal(243);
			expect(layer.bottom).equal(133);
		});

		it('positions the layer at given left/top offsets', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						left: 50,
						top: 30,
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'left-top-layer-image.png');
			expect(layer.left).equal(50);
			expect(layer.top).equal(30);
			expect(layer.right).equal(350);
			expect(layer.bottom).equal(230);
		});

		it('ignores right/bottom values', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						right: 200,
						bottom: 100,
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'cropped-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(300);
			expect(layer.bottom).equal(200);
		});

		it('ignores larger right/bottom values', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						right: 400,
						bottom: 250,
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'padded-layer-image.png');
			expect(layer.left).equal(0);
			expect(layer.top).equal(0);
			expect(layer.right).equal(300);
			expect(layer.bottom).equal(200);
		});

		it('ignores right/bottom values if they do not match canvas size', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						left: 50,
						top: 50,
						right: 50,
						bottom: 50,
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
			expect(layer.left).equal(50);
			expect(layer.top).equal(50);
			expect(layer.right).equal(350);
			expect(layer.bottom).equal(250);
		});

		it('ignores right/bottom values if they amount to negative size', () => {
			const psd: Psd = {
				width: 300,
				height: 200,
				children: [
					{
						name: 'test',
						left: 50,
						top: 50,
						right: 0,
						bottom: 0,
						canvas: fullImage,
					},
				],
			};

			const result = writeAndRead(psd);

			const layer = result.children![0];
			compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
			expect(layer.left).equal(50);
			expect(layer.top).equal(50);
			expect(layer.right).equal(350);
			expect(layer.bottom).equal(250);
		});
	});

	it.skip('placedLayer with transform', () => {
		const w = 300;
		const h = 200;
		const psd: Psd = {
			width: 1000,
			height: 1000,
			canvas: createCanvas(1000, 1000),
			children: [
				{
					name: 'canvas.png',
					left: 200,
					top: 200,
					canvas: createCanvas(600, 600),
					placedLayer: {
						id: '20953ddb-9391-11ec-b4f1-c15674f50bc4',
						placed: 'aaa',
						type: 'raster',
						transform: [200, 200, 800, 200, 800, 800, 200, 800],
						width: w,
						height: h,
					},
				},
			],
			linkedFiles: [
				{
					id: '20953ddb-9391-11ec-b4f1-c15674f50bc4',
					name: 'canvas.png',
					data: fs.readFileSync(path.join('test', 'write', 'simple', 'canvas.png')),
				},
			],
		};

		const buffer = writePsdBuffer(psd);
		fs.writeFileSync(path.join(resultsFilesPath, `placedLayer-with-transform.psd`), buffer);

		// TODO: need to test the file here

		const psd2 = readPsdBuffer(buffer, { throwForMissingFeatures: true, logMissingFeatures: true });
		console.log(require('util').inspect(psd2, false, 99, false), 'utf8');
	});

	it.skip('vectorMaskFeather', () => {
		const psd: Psd = {
			width: 821,
			height: 523,
			children: [
				{
					name: 'Circle',
					mask: { fromVectorData: true, vectorMaskFeather: 5 },
					vectorFill: { type: 'color', color: { r: 0, g: 0, b: 255 } },
					vectorMask: {
						paths: [
							{
								fillRule: 'even-odd',
								open: true,
								operation: 'combine',
								knots: [
									{ points: [78, 162.1389086942608, 78, 124.02013999999997, 78, 85.90136716453082], linked: false },
									{ points: [108.90136716453082, 55, 147.02013999999997, 55, 185.13890869426086, 55], linked: false },
									{ points: [216.04027999999994, 85.90136716453082, 216.04027999999994, 124.02013999999997, 216.04027999999994, 162.1389086942608], linked: false },
									{ points: [185.13890869426086, 193.04028, 147.02013999999997, 193.04028, 108.90136716453082, 193.04028], linked: false },
								],
							},
						],
					},
				},
				{
					name: 'Image',
					left: 296,
					top: 271,
					right: 476,
					bottom: 361,
					canvas: loadCanvasFromFile('test/gradient.png'),
				},
			],
		};

		const buffer = writePsdBuffer(psd);
		fs.writeFileSync(path.join(resultsFilesPath, `vectorMaskFeather.psd`), buffer);
		fs.writeFileSync(path.join(resultsFilesPath, `vectorMaskFeather.bin`), buffer);

		const psd2 = readPsdBuffer(buffer, { throwForMissingFeatures: true, logMissingFeatures: true });
		if (0) console.log(require('util').inspect(psd2, false, 99, false), 'utf8');
	});

	// fs.readdirSync(writeFilesPath).filter(f => /float-size/.test(f)).forEach(f => {
	fs.readdirSync(writeFilesPath).filter(f => !/pattern/.test(f)).forEach(f => {
		it(`writes PSD file (${f})`, () => {
			const compress = f.includes('-compress');

			const basePath = path.join(writeFilesPath, f);
			const psd = loadPsdFromJSONAndPNGFiles(basePath);

			const before = JSON.stringify(psd, replacer);
			const buffer = writePsdBuffer(psd, { generateThumbnail: false, trimImageData: true, logMissingFeatures: true, compress });
			const after = JSON.stringify(psd, replacer);

			expect(before).equal(after, 'psd object mutated');

			const resultsDir = path.join(resultsFilesPath, 'write', f);
			fs.mkdirSync(resultsDir, { recursive: true });
			fs.writeFileSync(path.join(resultsDir, `expected.psd`), buffer);
			// fs.writeFileSync(path.join(resultsDir, `expected.bin`), buffer); // TEMP

			const reader = createReader(buffer.buffer);
			const result = readPsd(reader, { skipLayerImageData: true, logMissingFeatures: true, throwForMissingFeatures: true });
			fs.writeFileSync(path.join(resultsDir, `composite.png`), result.canvas!.toBuffer());
			//compareCanvases(psd.canvas, result.canvas, 'composite image');

			const expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
			compareBuffers(buffer, expected, `ArrayBufferPsdWriter`, 0);
		});
	});

	it.skip('test', () => {
		const canvas = createCanvas(5000, 5000);
		const context = canvas.getContext('2d')!;
		context.fillStyle = 'pink';
		context.fillRect(0, 0, canvas.width, canvas.height);

		const canvas2 = createCanvas(300, 200);
		const context2 = canvas2.getContext('2d')!;
		context2.fillStyle = 'orange';
		context2.fillRect(0, 0, canvas.width, canvas.height);

		const canvas3 = createCanvas(300, 200);
		const context3 = canvas3.getContext('2d')!;
		context3.fillStyle = 'red';
		context3.fillRect(0, 0, canvas.width, canvas.height);

		const psd: Psd = {
			width: 5000,
			height: 5000,
			canvas: canvas,
			children: [
				{
					name: 'bg',
					canvas: canvas3,
				},
			],
			imageResources: {
				thumbnail: canvas2,
			},
		};

		const buffer = writePsdBuffer(psd, { generateThumbnail: false });
		fs.writeFileSync(path.join(resultsFilesPath, `thumb_test.psd`), buffer);
	});

	describe('RLE buffer bounds for narrow images', () => {
		for (const psb of [false, true]) {
			for (const alpha of [false, true]) {
				for (const [width, height] of [[1, 1], [1, 100], [2, 100], [3, 100], [100, 1], [129, 3]]) {
					it(`round-trips ${width}x${height} ${alpha ? 'RGBA' : 'RGB'} composite and layer (psb: ${psb})`, () => {
						const imageData = createPixels(width, height, alpha, width * 1000 + height);
						const layerData = createPixels(width, height, alpha, width * 7 + height * 3);
						const psd: Psd = {
							width, height,
							imageData: imageData as ImageData,
							children: [
								{ name: 'background', imageData: createPixels(width, height, false, 5) as ImageData },
								{ name: 'layer', imageData: layerData as ImageData },
							],
						};

						const buffer = writePsdUint8Array(psd, { psb });
						const result = readPsdBuffer(buffer, { useImageData: true });

						expect(result.width).equal(width);
						expect(result.height).equal(height);
						expect(bytes(result.imageData!.data)).eql(bytes(imageData.data));
						expect(bytes(result.children![0].imageData!.data)).eql(bytes(psd.children![0].imageData!.data));
						expect(bytes(result.children![1].imageData!.data)).eql(bytes(layerData.data));
					});
				}
			}
		}

		it('round-trips layer mask on narrow layer', () => {
			const mask = createPixels(1, 100, false, 3);
			const psd: Psd = {
				width: 1, height: 100,
				children: [{ name: 'layer', imageData: createPixels(1, 100, true, 4) as ImageData, mask: { imageData: mask as ImageData } }],
			};

			const result = readPsdBuffer(writePsdUint8Array(psd, { psb: true }), { useImageData: true });
			const expected: number[] = [];
			for (let i = 0; i < mask.data.length; i += 4) expected.push(mask.data[i], mask.data[i], mask.data[i], 255);

			expect(bytes(result.children![0].mask!.imageData!.data)).eql(expected);
		});

		it('computes exact worst-case RLE size', () => {
			expect(getRLEChannelBound(1, 1, false)).equal(1 * (2 + 1 + 1));
			expect(getRLEChannelBound(2, 10, false)).equal(10 * (2 + 2 + 1));
			expect(getRLEChannelBound(128, 1, true)).equal(4 + 128 + 1);
			expect(getRLEChannelBound(129, 1, false)).equal(2 + 129 + 2);
		});
	});

	describe('writePattern', () => {
		for (const [w, h] of [[128, 2000], [1, 100], [2, 50], [129, 7]]) {
			it(`round-trips ${w}x${h} noise pattern`, () => {
				// opaque, readPattern does not read the alpha channel
				const data = new Uint8Array(createPixels(w, h, false, w + h).data.buffer);
				const pattern: PatternInfo = { id: 'id', name: 'noise', x: 0, y: 0, bounds: { x: 0, y: 0, w, h }, data };

				const writer = createWriter();
				writePattern(writer, pattern);
				const result = readPattern(createReader(getWriterBuffer(writer)));

				expect(result.bounds).eql(pattern.bounds);
				expect(Array.from(result.data)).eql(Array.from(data));
			});
		}
	});

	describe('layer mask parameters', () => {
		function roundTripMask(maskParams: Partial<LayerMaskData>, realMask = false) {
			const psd: Psd = {
				width: 10, height: 10,
				children: [{
					name: 'layer',
					imageData: createPixels(10, 10, true, 1) as ImageData,
					mask: { top: 0, left: 0, imageData: createPixels(10, 10, false, 2) as ImageData, ...maskParams },
					realMask: realMask ? { top: 1, left: 1, imageData: createPixels(5, 5, false, 3) as ImageData, defaultColor: 255 } : undefined,
				}],
			};

			return readPsdBuffer(writePsdUint8Array(psd), { useImageData: true }).children![0];
		}

		it('round-trips user and vector mask feather without real mask', () => {
			const layer = roundTripMask({ userMaskFeather: 2.5, vectorMaskFeather: 1.5 });

			expect(layer.mask!.userMaskFeather).equal(2.5);
			expect(layer.mask!.vectorMaskFeather).equal(1.5);
			expect(layer.realMask).undefined;
		});

		it('round-trips mask densities and one feather', () => {
			const layer = roundTripMask({ userMaskDensity: 0.4, vectorMaskDensity: 0.6, userMaskFeather: 3 });

			expect(layer.mask!.userMaskDensity).closeTo(0.4, 0.01);
			expect(layer.mask!.vectorMaskDensity).closeTo(0.6, 0.01);
			expect(layer.mask!.userMaskFeather).equal(3);
			expect(layer.realMask).undefined;
		});

		it('round-trips all mask parameters without real mask', () => {
			const layer = roundTripMask({ userMaskDensity: 0.4, userMaskFeather: 2.5, vectorMaskDensity: 0.6, vectorMaskFeather: 1.5 });

			expect(layer.mask!.userMaskDensity).closeTo(0.4, 0.01);
			expect(layer.mask!.userMaskFeather).equal(2.5);
			expect(layer.mask!.vectorMaskDensity).closeTo(0.6, 0.01);
			expect(layer.mask!.vectorMaskFeather).equal(1.5);
			expect(layer.realMask).undefined;
			expect(bytes(layer.imageData!.data)).eql(bytes(createPixels(10, 10, true, 1).data));
		});

		// returns lengths of layer mask data sections of all layer records
		function getMaskDataLengths(buffer: Uint8Array) {
			const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			let offset = 26;
			offset += 4 + view.getUint32(offset); // color mode data
			offset += 4 + view.getUint32(offset); // image resources
			offset += 4 + 4; // layer and mask info length, layer info length
			const count = Math.abs(view.getInt16(offset));
			offset += 2;
			const lengths: number[] = [];

			for (let i = 0; i < count; i++) {
				offset += 16; // bounds
				offset += 2 + view.getUint16(offset) * 6; // channels
				offset += 4 + 4 + 4; // signature, blend mode, opacity, clipping, flags, filler
				const extraLength = view.getUint32(offset);
				lengths.push(view.getUint32(offset + 4));
				offset += 4 + extraLength;
			}

			return lengths;
		}

		it('pads layer mask data to multiple of 4 bytes', () => {
			const cases: [Partial<LayerMaskData>, boolean, number][] = [
				[{}, false, 20],
				[{}, true, 36],
				[{ userMaskFeather: 1 }, false, 28],
				[{ userMaskFeather: 1, vectorMaskFeather: 1 }, false, 36],
				[{ userMaskDensity: 0.5, userMaskFeather: 1, vectorMaskDensity: 0.5, vectorMaskFeather: 1 }, false, 40],
				[{ userMaskDensity: 0.5, userMaskFeather: 1, vectorMaskDensity: 0.5, vectorMaskFeather: 1 }, true, 56],
			];

			for (const [params, realMask, expected] of cases) {
				const psd: Psd = {
					width: 10, height: 10,
					children: [{
						imageData: createPixels(10, 10, true, 1) as ImageData,
						mask: { top: 0, left: 0, imageData: createPixels(10, 10, false, 2) as ImageData, ...params },
						realMask: realMask ? { top: 1, left: 1, imageData: createPixels(5, 5, false, 3) as ImageData } : undefined,
					}],
				};
				expect(getMaskDataLengths(writePsdUint8Array(psd)), JSON.stringify(params)).eql([expected]);
			}
		});

		it('writes layer mask data with the same size as photoshop', () => {
			const src = fs.readFileSync(path.join(__dirname, '..', '..', 'test', 'read-write', 'masks', 'src.psd'));
			const psd = readPsdBuffer(src, { useImageData: true });
			const output = writePsdUint8Array(psd);
			expect(getMaskDataLengths(output)).eql(getMaskDataLengths(src));
		});

		it('round-trips all mask parameters with real mask', () => {
			const layer = roundTripMask({ userMaskDensity: 0.4, userMaskFeather: 2.5, vectorMaskDensity: 0.6, vectorMaskFeather: 1.5 }, true);

			expect(layer.mask!.userMaskFeather).equal(2.5);
			expect(layer.mask!.vectorMaskFeather).equal(1.5);
			expect(layer.realMask).eql({
				top: 1, left: 1, bottom: 6, right: 6, defaultColor: 255,
				positionRelativeToLayer: false, disabled: false, fromVectorData: false,
				imageData: layer.realMask!.imageData,
			});
		});
	});

	describe('bit depth verification', () => {
		it('accepts 8-bit image data from another realm', () => {
			const data = vm.runInNewContext('new Uint8ClampedArray(4 * 4 * 4)');
			expect(data instanceof Uint8ClampedArray).false;
			const psd: Psd = { width: 4, height: 4, imageData: { width: 4, height: 4, data } };
			expect(() => writePsdUint8Array(psd)).not.throw();
		});

		it('rejects Float32Array composite image data', () => {
			const psd: Psd = { width: 2, height: 2, imageData: { width: 2, height: 2, data: new Float32Array(16) } as any };
			expect(() => writePsdUint8Array(psd)).throw(/imageData has incorrect bitDepth/);
		});

		it('rejects Float32Array layer image data', () => {
			const psd: Psd = { width: 2, height: 2, children: [{ imageData: { width: 2, height: 2, data: new Float32Array(16) } as any }] };
			expect(() => writePsdUint8Array(psd)).throw(/imageData has incorrect bitDepth/);
		});

		it('rejects Uint16Array realMask image data', () => {
			const psd: Psd = {
				width: 2, height: 2,
				children: [{ realMask: { imageData: { width: 2, height: 2, data: new Uint16Array(16) } as any } }],
			};
			expect(() => writePsdUint8Array(psd)).throw(/realMask imageData has incorrect bitDepth/);
		});

		it('accepts Uint8Array image data', () => {
			const psd: Psd = { width: 2, height: 2, imageData: { width: 2, height: 2, data: new Uint8Array(16) } as any };
			expect(() => writePsdUint8Array(psd)).not.throw();
		});
	});

	describe('thumbnail', () => {
		for (const [width, height] of [[2000, 1], [1, 2000]]) {
			it(`generates thumbnail for extreme aspect ratio ${width}x${height}`, () => {
				const canvas = createCanvas(width, height);
				const psd: Psd = { width, height, canvas };
				const result = readPsdBuffer(writePsdUint8Array(psd, { generateThumbnail: true }), { useRawThumbnail: true });
				const thumb = result.imageResources!.thumbnailRaw!;

				expect(thumb.width).greaterThan(0);
				expect(thumb.height).greaterThan(0);
			});
		}
	});

	describe('writePsdBuffer', () => {
		it('returns buffer that is not larger than the file', () => {
			// large enough to not use node's buffer pool
			const buffer = writePsdBuffer({ width: 100, height: 100, imageData: createPixels(100, 100, false) as ImageData });
			expect(buffer.length).greaterThan(8192);
			expect(buffer.buffer.byteLength).equal(buffer.length);
		});

		it('does not grow writer buffer much past the size of the file', () => {
			// composite image reserves worst case RLE size in the writer buffer
			const data = writePsdUint8Array({ width: 300, height: 300, imageData: createPixels(300, 300, false) as ImageData });
			expect(data.buffer.byteLength).lessThan(data.byteLength * 1.1);
		});
	});

	describe('global layer mask info', () => {
		it('writes opacity in 0-100 range', () => {
			for (const [opacity, expected] of [[0.5, 50], [1, 100], [0, 0], [2, 100], [-1, 0], [0.333, 33]]) {
				const psd: Psd = {
					width: 1, height: 1,
					globalLayerMaskInfo: {
						overlayColorSpace: 0x1234, colorSpace1: 0x5678, colorSpace2: 0x9abc, colorSpace3: 0xdef0, colorSpace4: 0x4321,
						opacity, kind: 128,
					},
				};
				const buffer = writePsdUint8Array(psd);
				const index = findBytes(buffer, [0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x43, 0x21]);
				expect(index).greaterThan(0);
				expect((buffer[index + 10] << 8) | buffer[index + 11], `opacity ${opacity}`).equal(expected);
				expect(buffer[index + 12]).equal(128);

				// reader keeps the other values
				const result = readPsdBuffer(buffer).globalLayerMaskInfo!;
				expect(result.colorSpace4).equal(0x4321);
				expect(result.kind).equal(128);
			}
		});
	});
});

function replacer(key: string, value: any) {
	if (key === 'canvas') {
		return '<canvas>';
	} else {
		return value;
	}
}
