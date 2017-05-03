/// <reference path="../../typings/chai.d.ts" />
/// <reference path="../../typings/canvas.d.ts" />

require('source-map-support').install();

import * as fs from 'fs';
import * as path from 'path';
import * as Canvas from 'canvas';
import { BufferPsdReader } from '../bufferPsdReader';
import { Psd, ReadOptions, initializeCanvas } from '../index';

const testsPath = path.join(__dirname, '..', '..', 'test');
const resultsPath = path.join(__dirname, '..', '..', 'results');

initializeCanvas((width, height) => new Canvas(width, height));

export type ImageMap = { [key: string]: HTMLCanvasElement };

export function toArrayBuffer(buffer: Buffer) {
	const ab = new ArrayBuffer(buffer.length);
	const view = new Uint8Array(ab);

	for (let i = 0; i < buffer.length; ++i)
		view[i] = buffer[i];

	return ab;
}

export function toBuffer(ab: ArrayBuffer) {
	const buffer = new Buffer(ab.byteLength);
	const view = new Uint8Array(ab);

	for (let i = 0; i < buffer.length; ++i)
		buffer[i] = view[i];

	return buffer;
}

export function importPSD(dirName: string): Psd | undefined {
	const dataPath = path.join(dirName, 'data.json');

	if (!fs.existsSync(dataPath))
		return void 0;

	return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

export function importPSDImages(dirName: string) {
	const images: ImageMap = {};

	fs.readdirSync(dirName)
		.filter(f => /\.png$/.test(f))
		.forEach(f => images[f] = loadCanvasFromFile(path.join(dirName, f)));

	return images;
}

export function readPSD(fileName: string, options?: ReadOptions): Psd {
	const buffer = fs.readFileSync(fileName);
	const reader = new BufferPsdReader(buffer);
	return reader.readPsd(options);
}

export function extractPSD(filePath: string, psd: Psd) {
	const basePath = path.join(resultsPath, filePath);

	if (!fs.existsSync(basePath))
		fs.mkdirSync(basePath);

	if (psd.canvas) {
		fs.writeFileSync(path.join(basePath, 'canvas.png'), psd.canvas.toBuffer());
		psd.canvas = void 0;
	}

	psd.children!.forEach((l, i) => {
		if (l.canvas) {
			fs.writeFileSync(path.join(basePath, `layer-${i}.png`), l.canvas.toBuffer());
			l.canvas = void 0;
		}
	});

	fs.writeFileSync(path.join(basePath, 'data.json'), JSON.stringify(psd, null, 2));
}

export function saveCanvas(fileName: string, canvas: HTMLCanvasElement | undefined) {
	if (canvas) {
		fs.writeFileSync(fileName, canvas.toBuffer());
	}
}

export function loadCanvasFromFile(filePath: string) {
	const img = new Canvas.Image();
	img.src = fs.readFileSync(filePath);
	const canvas = new Canvas(img.width, img.height);
	canvas.getContext('2d')!.drawImage(img, 0, 0);
	return canvas;
}

export function compareCanvases(expected: HTMLCanvasElement | undefined, actual: HTMLCanvasElement | undefined, name: string) {
	if (expected === actual)
		return;
	if (!expected)
		throw new Error(`Expected canvas is null (${name})`);
	if (!actual)
		throw new Error(`Actual canvas is null (${name})`);
	if (expected.width !== actual.width || expected.height !== actual.height)
		throw new Error(`Canvas size is different than expected (${name})`);

	const expectedData = expected.getContext('2d')!.getImageData(0, 0, expected.width, expected.height);
	const actualData = actual.getContext('2d')!.getImageData(0, 0, actual.width, actual.height);
	const length = expectedData.width * expectedData.height * 4;

	for (let i = 0; i < length; i++) {
		if (expectedData.data[i] !== actualData.data[i])
			throw new Error(`Actual canvas different than expected (${name})`);
	}
}

export function compareBuffers(actual: Buffer, expected: Buffer, test: string) {
	if (!actual)
		throw new Error(`Actual buffer is null or undefined (${test})`);
	if (!expected)
		throw new Error(`Expected buffer is null or undefined (${test})`);
	if (actual.length !== expected.length)
		throw new Error(`Buffers differ in size actual: ${actual.length} expected: ${expected.length} (${test})`);

	for (let i = 0; i < actual.length; i++) {
		if (actual[i] !== expected[i])
			throw new Error(`Buffers differ at byte: ${i} actual: ${actual[i]} expected: ${expected[i]} (${test})`);
	}
}
