import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { loadCanvasFromFile, compareBuffers, createCanvas, compareCanvases } from './common';
import { Psd, WriteOptions, ReadOptions, } from '../psd';
import { writePsd, writeSignature, getWriterBuffer, createWriter } from '../psdWriter';
import { readPsd, createReader } from '../psdReader';
import { writePsdBuffer, readPsd as readPsdBuffer } from '../index';

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
						referencePoint: {
							x: 200,
							y: 200,
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
});

function replacer(key: string, value: any) {
	if (key === 'canvas') {
		return '<canvas>';
	} else {
		return value;
	}
}
