/// <reference path="../../typings/node/node.d.ts" />
/// <reference path="../../typings/mocha/mocha.d.ts" />
/// <reference path="../../typings/chai/chai.d.ts" />
/// <reference path="../../typings/my/canvas.d.ts" />

require('source-map-support').install();

import * as fs from 'fs';
import * as path from 'path';
import * as Canvas from 'canvas';
import BufferPsdReader from '../bufferPsdReader';
import { Psd } from '../psd';

const testsPath = path.join(__dirname, '..', '..', 'test');
const resultsPath = path.join(__dirname, '..', '..', 'results');

export type ImageMap = { [key: string]: HTMLCanvasElement };

export function toArrayBuffer(buffer: Buffer) {
	let ab = new ArrayBuffer(buffer.length);
	let view = new Uint8Array(ab);

	for (let i = 0; i < buffer.length; ++i)
		view[i] = buffer[i];

	return ab;
}

export function toBuffer(ab: ArrayBuffer) {
	let buffer = new Buffer(ab.byteLength);
	let view = new Uint8Array(ab);

	for (let i = 0; i < buffer.length; ++i)
		buffer[i] = view[i];

	return buffer;
}

export function importPSD(dirName: string): Psd {
	let dataPath = path.join(dirName, 'data.json');

	if (!fs.existsSync(dataPath))
		return null;

	return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

export function importPSDImages(dirName: string) {
	let images: ImageMap = {};

	fs.readdirSync(dirName)
		.filter(f => /\.png$/.test(f))
		.forEach(f => images[f] = loadCanvasFromFile(path.join(dirName, f)));

	return images;
}

export function readPSD(fileName: string): Psd {
	let buffer = fs.readFileSync(fileName);
	let reader = new BufferPsdReader(buffer);
	return reader.readPsd();
}

export function extractPSD(filePath: string, psd: Psd) {
	let basePath = path.join(resultsPath, filePath);

	if (!fs.existsSync(basePath))
		fs.mkdirSync(basePath);

	if (psd.canvas) {
		fs.writeFileSync(path.join(basePath, 'canvas.png'), psd.canvas.toBuffer());
		psd.canvas = null;
	}

	psd.children.forEach((l, i) => {
		if (l.canvas) {
			fs.writeFileSync(path.join(basePath, `layer-${i}.png`), l.canvas.toBuffer());
			l.canvas = null;
		}
	});

	fs.writeFileSync(path.join(basePath, 'data.json'), JSON.stringify(psd, null, 2));
}

export function ensureDirectory(dirName: string) {
	if (!fs.existsSync(dirName))
		fs.mkdirSync(dirName);
}

export function saveCanvas(fileName: string, canvas: HTMLCanvasElement) {
	if (canvas)
		fs.writeFileSync(fileName, canvas.toBuffer());
}

export function loadCanvasFromFile(filePath: string) {
	let img = new Canvas.Image();
	img.src = fs.readFileSync(filePath);
	let canvas = new Canvas(img.width, img.height);
	canvas.getContext('2d').drawImage(img, 0, 0);
	return canvas;
}

export function compareCanvases(expected: HTMLCanvasElement, actual: HTMLCanvasElement, name: string) {
	if (expected === actual)
		return;
	if (!expected)
		throw new Error(`Expected canvas is null (${name})`);
	if (!actual)
		throw new Error(`Actual canvas is null (${name})`);
	if (expected.width !== actual.width || expected.height !== actual.height)
		throw new Error(`Canvas size is different than expected (${name})`);

	let expectedData = expected.getContext('2d').getImageData(0, 0, expected.width, expected.height);
	let actualData = actual.getContext('2d').getImageData(0, 0, actual.width, actual.height);
	let length = expectedData.width * expectedData.height * 4;

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
