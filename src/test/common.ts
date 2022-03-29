/// <reference types="mocha" />
/// <reference path="../../typings/chai.d.ts" />
import {HTMLCanvasElement} from '../canvas/canvas';
import {Image} from 'skia-canvas/lib';

require('source-map-support').install();

import * as fs from 'fs';
import * as path from 'path';
import '../initializeCanvas';
import { Psd, ReadOptions } from '../index';
import { readPsd, createReader } from '../psdReader';
import { setLogErrors } from '../descriptor';
import {Canvas} from 'skia-canvas/lib';

setLogErrors(true);

const resultsPath = path.join(__dirname, '..', '..', 'results');

export type ImageMap = { [key: string]: HTMLCanvasElement };

export function toArrayBuffer(buffer: Buffer) {
	const ab = new ArrayBuffer(buffer.length);
	const view = new Uint8Array(ab);

	for (let i = 0; i < buffer.length; ++i) {
		view[i] = buffer[i];
	}

	return ab;
}

export function repeat<T>(times: number, ...values: T[]): T[] {
	if (!values.length) {
		throw new Error('missing values');
	}

	const array: T[] = [];

	for (let i = 0; i < times; i++) {
		array.push(...values);
	}

	return array;
}

export function range(start: number, length: number): number[] {
	const array: number[] = [];

	for (let i = 0; i < length; i++) {
		array.push(start + i);
	}

	return array;
}

export function importPSD(dirName: string): Psd | undefined {
	const dataPath = path.join(dirName, 'data.json');

	if (!fs.existsSync(dataPath))
		return undefined;

	return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

export function loadImagesFromDirectory(dirName: string) {
	const images: ImageMap = {};

	fs.readdirSync(dirName)
		.filter(f => /\.png$/.test(f))
		.forEach(f => images[f] = loadCanvasFromFile(path.join(dirName, f)));

	return images;
}

export function createReaderFromBuffer(buffer: Buffer) {
	const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	reader.strict = true; // for testing
	return reader;
}

export function readPsdFromFile(fileName: string, options?: ReadOptions): Psd {
	const buffer = fs.readFileSync(fileName);
	const reader = createReaderFromBuffer(buffer);
	return readPsd(reader, options);
}

export function extractPSD(filePath: string, psd: Psd) {
	const basePath = path.join(resultsPath, filePath);

	if (!fs.existsSync(basePath))
		fs.mkdirSync(basePath);

	if (psd.canvas) {
		fs.writeFileSync(path.join(basePath, 'canvas.png'), psd.canvas.toBufferSync('png'));
		psd.canvas = undefined;
	}

	psd.children!.forEach((l, i) => {
		if (l.canvas) {
			fs.writeFileSync(path.join(basePath, `layer-${i}.png`), l.canvas.toBufferSync('png'));
			l.canvas = undefined;
		}
	});

	fs.writeFileSync(path.join(basePath, 'data.json'), JSON.stringify(psd, null, 2));
}

export function saveCanvas(fileName: string, canvas: HTMLCanvasElement | undefined) {
	if (canvas) {
		fs.writeFileSync(fileName, canvas.toBufferSync('png'));
	}
}

export function loadCanvasFromFile(filePath: string) {
	const img = new Image();
	img.src = <any>fs.readFileSync(filePath);
	const canvas = new Canvas(img.width, img.height);
	canvas.getContext('2d')!.drawImage(img, 0, 0);
	return canvas;
}

export function compareTwoFiles(expectedPath: string, actual: Uint8Array, name: string) {
	const expectedBuffer = fs.readFileSync(expectedPath);
	const expected = new Uint8Array(expectedBuffer.buffer, expectedBuffer.byteOffset, expectedBuffer.byteLength);

	if (expected.byteLength !== actual.byteLength) {
		throw new Error(`File size is different than expected (${name})`);
	}

	for (let i = 0; i < expected.byteLength; i++) {
		if (expected[i] !== actual[i]) {
			throw new Error(`Actual file different than expected at index ${i}: actual ${actual[i]}, expected ${expected[i]}`);
		}
	}
}

export function compareCanvases(expected: HTMLCanvasElement | undefined, actual: HTMLCanvasElement | undefined, name: string) {
	const saveFailure = () => {
		const failuresDir = path.join(resultsPath, 'failures');
		if (!fs.existsSync(failuresDir)) {
			fs.mkdirSync(failuresDir);
		}
		fs.writeFileSync(path.join(failuresDir, `${name.replace(/[\\/]/, '-')}`), actual!.toBufferSync('png'));
	};

	if (expected === actual)
		return;
	if (!expected)
		throw new Error(`Expected canvas is null (${name})`);
	if (!actual)
		throw new Error(`Actual canvas is null (${name})`);

	if (expected.width !== actual.width || expected.height !== actual.height) {
		saveFailure();
		throw new Error(`Canvas size is different than expected (${name})`);
	}

	const expectedData = expected.getContext('2d')!.getImageData(0, 0, expected.width, expected.height);
	const actualData = actual.getContext('2d')!.getImageData(0, 0, actual.width, actual.height);
	const length = expectedData.width * expectedData.height * 4;

	for (let i = 0; i < length; i++) {
		if (expectedData.data[i] !== actualData.data[i]) {
			saveFailure();
			const expectedNumBytes = expectedData.data.length;
			const actualNumBytes = actualData.data.length;
			throw new Error(
				`Actual canvas (${actualNumBytes} bytes) different ` +
				`than expected (${name}: ${expectedNumBytes} bytes) ` +
				`at index ${i}: actual ${actualData.data[i]} vs. expected ${expectedData.data[i]}`
			);
		}
	}
}

export function compareBuffers(actual: Buffer, expected: Buffer, test: string, start = 0, offset = 0) {
	if (!actual)
		throw new Error(`Actual buffer is null or undefined (${test})`);
	if (!expected)
		throw new Error(`Expected buffer is null or undefined (${test})`);

	for (let i = start; i < expected.length; i++) {
		if (expected[i] !== actual[i + offset]) {
			throw new Error(`Buffers differ ` +
				`expected: 0x${expected[i].toString(16)} at [0x${i.toString(16)}] ` +
				`actual: 0x${actual[i + offset].toString(16)} at [0x${(i + offset).toString(16)}] (${test})`);
		}
	}

	if (actual.length !== expected.length)
		throw new Error(`Buffers differ in size actual: ${actual.length} expected: ${expected.length} (${test})`);
}


export function expectBuffersEqual(actual: Uint8Array, expected: Uint8Array, name: string) {
	const length = Math.max(actual.length, expected.length);

	for (let i = 0; i < length; i++) {
		if (actual[i] !== expected[i]) {
			fs.writeFileSync(path.join(__dirname, '..', '..', 'results', name), Buffer.from(actual));
			throw new Error(`Different byte at 0x${i.toString(16)} in (${name})`);
		}
	}
}
