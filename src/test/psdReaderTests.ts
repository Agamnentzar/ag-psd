import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import { expect } from 'chai';
import { readPSD, importPSD, importPSDImages, compareCanvases, saveCanvas } from './common';
import { Layer } from '../psd';
import { PsdReader } from '../psdReader';
import { ArrayBufferPsdReader } from '../arrayBufferPsdReader';
import { BufferPsdReader } from '../bufferPsdReader';

const readFilesPath = path.join(__dirname, '..', '..', 'test', 'read');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

describe('PsdReader', () => {
	it('should throw exceptions for all read methods in base class', () => {
		const reader = new PsdReader();
		expect(() => reader.readInt8(), 'readInt8').throw('Not implemented');
		expect(() => reader.readUint8(), 'readUint8').throw('Not implemented');
		expect(() => reader.readInt16(), 'readInt16').throw('Not implemented');
		expect(() => reader.readUint16(), 'readUint16').throw('Not implemented');
		expect(() => reader.readInt32(), 'readInt32').throw('Not implemented');
		expect(() => reader.readUint32(), 'readUint32').throw('Not implemented');
		expect(() => reader.readFloat32(), 'readFloat32').throw('Not implemented');
		expect(() => reader.readFloat64(), 'readFloat64').throw('Not implemented');
		expect(() => reader.readBytes(1), 'readBytes').throw('Not implemented');
		expect(() => reader.createCanvas(1, 1), 'createCanvas').throw('Not implemented');
	});

	[new ArrayBufferPsdReader(new ArrayBuffer(1000)), new BufferPsdReader(new Buffer(1000))].forEach(reader => {
		it(`should work for all overloaded methods (${(<any>reader.constructor).name})`, () => {
			reader.readInt8();
			reader.readUint8();
			reader.readInt16();
			reader.readUint16();
			reader.readInt32();
			reader.readUint32();
			reader.readFloat32();
			reader.readFloat64();
			reader.readBytes(1);
		});
	});

	it('should read width and height properly', () => {
		const psd = readPSD(path.join(readFilesPath, 'blend-mode', 'src.psd'));
		expect(psd.width).equal(300);
		expect(psd.height).equal(200);
	});

	it('should skip composite image data', () => {
		const psd = readPSD(path.join(readFilesPath, 'layers', 'src.psd'), { skipCompositeImageData: true });
		expect(psd.canvas).not.ok;
	});

	it('should skip layer image data', () => {
		const psd = readPSD(path.join(readFilesPath, 'layers', 'src.psd'), { skipLayerImageData: true });
		expect(psd.children![0].canvas).not.ok;
	});

	fs.readdirSync(readFilesPath).forEach(f => {
		it(`should properly read PSD file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const psd = readPSD(path.join(basePath, 'src.psd'));
			const expected = importPSD(basePath);
			const images = importPSDImages(basePath);
			const compare: { name: string; canvas: HTMLCanvasElement | undefined; }[] = [];

			compare.push({ name: `canvas.png`, canvas: psd.canvas });
			psd.canvas = undefined;

			let i = 0;

			function pushLayerCanvases(layers: Layer[]) {
				layers.forEach(l => {
					if (l.children) {
						pushLayerCanvases(l.children);
					} else {
						compare.push({ name: `layer-${i++}.png`, canvas: l.canvas });
						l.canvas = undefined;
					}
				});
			}

			pushLayerCanvases(psd.children || []);
			mkdirp.sync(path.join(resultsFilesPath, f));
			compare.forEach(i => saveCanvas(path.join(resultsFilesPath, f, i.name), i.canvas));
			fs.writeFileSync(path.join(resultsFilesPath, f, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');

			clearEmptyCanvasFields(psd);
			clearEmptyCanvasFields(expected);

			expect(psd).eql(expected, f);
			compare.forEach(i => compareCanvases(images[i.name], i.canvas, `${f}/${i.name}`));
		});
	});
});

function clearEmptyCanvasFields(layer: Layer | undefined) {
	if (layer) {
		if ('canvas' in layer && !layer.canvas) {
			delete layer.canvas;
		}

		if (layer.children) {
			layer.children.forEach(clearEmptyCanvasFields);
		}
	}
}
