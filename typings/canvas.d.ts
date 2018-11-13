/// <reference types="node" />

interface HTMLCanvasElement {
	toBuffer(callback: (err: any, buffer: Buffer) => void): void;
	toBuffer(): Buffer;
}

interface NodeCanvasImage extends HTMLImageElement {
	src: any;
}

interface NodeCanvas extends HTMLCanvasElement {
	new(width?: number, height?: number): NodeCanvas;
}

interface NodeStaticImage {
	new(width?: number, height?: number): NodeCanvasImage;
}

declare module "canvas" {
	export function createCanvas(width: number, height: number): HTMLCanvasElement;
	export type Canvas = HTMLCanvasElement;
	export const Image: NodeStaticImage;
}
