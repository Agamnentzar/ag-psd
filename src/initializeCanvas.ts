import { createCanvas } from 'canvas';
import { initializeCanvas } from './index';

initializeCanvas(createCanvas as any);

export function initialize() {
	initializeCanvas(createCanvas as any);
}
