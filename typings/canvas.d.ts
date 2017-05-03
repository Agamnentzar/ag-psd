/// <reference types="node" />

interface HTMLCanvasElement {
	toBuffer(): Buffer;
	toBuffer(callback: (err: any, buffer: Buffer) => void): void;
}

interface NodeCanvasImage extends HTMLImageElement {
	src: any;
}

interface NodeCanvas extends HTMLCanvasElement {
	new (width?: number, height?: number): NodeCanvas;
}

interface NodeStaticImage {
	new (width?: number, height?: number): NodeCanvasImage;
}

interface NodeStaticCanvas {
	new (width?: number, height?: number): NodeCanvas;
	Image: NodeStaticImage;
}

declare var nodeStaticCanvas: NodeStaticCanvas;

declare module "canvas" {
	export = nodeStaticCanvas;
}
