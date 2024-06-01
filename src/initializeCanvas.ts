import { createCanvas } from 'canvas';
import { initializeCanvas } from './index';
import { decodeJpeg } from './jpeg';

function createCanvasFromData(data: Uint8Array) {
	const canvas = createCanvas(100, 100);

	try {
		const context = canvas.getContext('2d')!;
		const imageData = decodeJpeg(data, (w, h) => context.createImageData(w, h) as any);
		canvas.width = imageData.width;
		canvas.height = imageData.height;
		context.putImageData(imageData, 0, 0);
	} catch (e: any) {
		console.error('JPEG decompression error', e.message);
	}

	return canvas;
}

initializeCanvas(createCanvas as any, createCanvasFromData as any);

export function initialize() {
	initializeCanvas(createCanvas as any, createCanvasFromData as any);
}
