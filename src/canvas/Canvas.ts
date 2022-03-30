import { Canvas } from 'skia-canvas/lib';

export const createCanvas = (width: number, height: number) => {
	return new Canvas(width, height);
};

export class HTMLCanvasElement extends Canvas {
	constructor(width: number, height: number) {
		super(width, height);
	}
}
