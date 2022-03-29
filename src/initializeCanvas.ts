import { createCanvas } from './canvas/Canvas';
import {Image} from 'skia-canvas/lib';
import { initializeCanvas } from './index';

function createCanvasFromData(data: Uint8Array) {
	const image = new Image();
	image.src = <any>Buffer.from(data);
	const canvas = createCanvas(image.width, image.height);
	canvas.getContext('2d')!.drawImage(image, 0, 0);
	return canvas;
}

initializeCanvas(createCanvas, createCanvasFromData);
