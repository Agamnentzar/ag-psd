import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import { expect } from 'chai';
import { loadCanvasFromFile, compareBuffers, createCanvas } from './common';
import { Psd } from '../psd';
import { writePsd, writeSignature, getWriterBuffer, createWriter } from '../psdWriter';
import { readPsd, createReader } from '../psdReader';

const writeFilesPath = path.join(__dirname, '..', '..', 'test', 'write');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

function loadPsdFromJSONAndPNGFiles(basePath: string) {
	const psd: Psd = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));
	psd.canvas = loadCanvasFromFile(path.join(basePath, 'canvas.png'));
	psd.children!.forEach((l, i) => {
		if (!l.children) {
			l.canvas = loadCanvasFromFile(path.join(basePath, `layer-${i}.png`));
		}
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

		for (const s of [undefined, null, 'a', 'ab', 'abcde'])
			expect(() => writeSignature(writer, s as any), s as any).throw(`Invalid signature: '${s}'`);
	});

	it('throws exception if has layer with both children and canvas properties set', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: 300,
			height: 200,
			children: [
				{
					children: [],
					canvas: createCanvas(300, 300),
				}
			]
		};

		expect(() => writePsd(writer, psd)).throw(`Invalid layer: cannot have both 'canvas' and 'children' properties set`);
	});

	it('throws if psd has invalid width or height', () => {
		const writer = createWriter();
		const psd: Psd = {
			width: -5,
			height: 0,
		};

		expect(() => writePsd(writer, psd)).throw(`Invalid document size`);
	});

	fs.readdirSync(writeFilesPath).forEach(f => {
		it(`writes PSD file (${f})`, () => {
			const basePath = path.join(writeFilesPath, f);
			const psd = loadPsdFromJSONAndPNGFiles(basePath);
			const writer = createWriter(2048);

			writePsd(writer, psd, { generateThumbnail: true });

			const buffer = new Buffer(getWriterBuffer(writer));

			mkdirp.sync(resultsFilesPath);
			fs.writeFileSync(path.join(resultsFilesPath, `${f}.psd`), buffer);

			const reader = createReader(buffer.buffer);
			const result = readPsd(reader, { skipLayerImageData: true });
			fs.writeFileSync(path.join(resultsFilesPath, f + '-composite.png'), result.canvas!.toBuffer());
			//compareCanvases(psd.canvas, result.canvas, 'composite image');

			const expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
			compareBuffers(buffer, expected, `ArrayBufferPsdWriter`);
		});
	});
});
