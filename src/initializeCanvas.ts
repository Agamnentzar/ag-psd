import {Canvas, Image} from 'skia-canvas/lib';
import { initializeCanvas } from './index';

function createCanvasFromData(data: Uint8Array) {
	const image = new Image();
	image.src = <any>Buffer.from(data);
	const canvas = new Canvas(image.width, image.height);
	canvas.getContext('2d')!.drawImage(image, 0, 0);
	return canvas;
}

function createCanvas(width: number, height: number): Canvas {
	return new Canvas(width, height);
}

initializeCanvas(createCanvas, createCanvasFromData);
