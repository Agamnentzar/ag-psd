interface HTMLCanvasElement {
	toBuffer(callback: (err: any, buffer: Buffer) => void): void;
	toBuffer(): Buffer;
}

interface NodeCanvasImage extends HTMLImageElement {
	src: any;
}

interface NodeStaticImage {
	new(width?: number, height?: number): NodeCanvasImage;
}

declare module "canvas" {
	export function createCanvas(width: number, height: number): HTMLCanvasElement;
	export const Image: NodeStaticImage;
}
