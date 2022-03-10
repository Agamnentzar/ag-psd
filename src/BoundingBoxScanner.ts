/**
 * A tool for finding the bounding box around a set of colored pixels
 */
import {Layer, LayerMaskData} from './psd';
import {createCanvas} from './helpers';

export interface IBoundingBox {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export class BoundingBoxScan {
	public static SCAN_OFFSET_RED: number = 0;
	public static SCAN_OFFSET_GREEN: number = 1;
	public static SCAN_OFFSET_BLUE: number = 2;
	public static SCAN_OFFSET_ALPHA: number = 3;

	/**
	 * Find the bounding box of the layer's transparency
	 */
	public scanLayerTransparency(layer: Layer | LayerMaskData): IBoundingBox | undefined {
		const imageData = layer.canvas?.getContext('2d')?.getImageData(0,0,layer.canvas?.width, layer.canvas?.height)?.data.buffer;
		if (imageData && layer.canvas) {
			return this.scan(new Uint8ClampedArray(imageData), layer.canvas.width, layer.canvas.height);
		} else {
			return undefined;
		}
	}

	/**
	 * Find the bounding box of the layer's channel
	 */
	public scanLayerChannel(layer: Layer | LayerMaskData, channel: number = BoundingBoxScan.SCAN_OFFSET_RED): IBoundingBox | undefined {
		const imageData = layer.canvas?.getContext('2d')?.getImageData(0,0,layer.canvas?.width, layer.canvas?.height)?.data.buffer;
		if (imageData && layer.canvas) {
			return this.scan(new Uint8ClampedArray(imageData), layer.canvas.width, layer.canvas.height, channel);
		} else {
			return undefined;
		}
	}

	public cropLayerToBoundingBox(layer: Layer): void {
		const boundingBox: IBoundingBox | undefined = this.scanLayerTransparency(layer);
		if (boundingBox) {
			const width: number = boundingBox.right - boundingBox.left;
			const height: number = boundingBox.bottom - boundingBox.top;
			const newCanvas = createCanvas(width, height);
			const ctx: CanvasRenderingContext2D = newCanvas.getContext('2d') as CanvasRenderingContext2D;
			ctx.drawImage(layer.canvas!, boundingBox.left, boundingBox.top, width, height, 0, 0, width, height);
			layer.canvas = newCanvas;
			layer.top = boundingBox.top;
			layer.bottom = boundingBox.bottom;
			layer.left = boundingBox.left;
			layer.right = boundingBox.right;
			layer.imageData = ctx.getImageData(0, 0, width, height);
		}
	}

	/**
	 * Scan the entire image for a rectangle in the set channel
	 */
	private scan(d: Uint8ClampedArray, w: number, h: number, scanOffset: number = BoundingBoxScan.SCAN_OFFSET_ALPHA): IBoundingBox {
		let x: number;
		let y: number;
		let ptr: number;
		const output: IBoundingBox = {
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
		};
		for (x = 0; x < w; x += 1) {
			for (y = 0; y < h; y += 1) {
				ptr = (x + (y * w)) * 4;
				if (d[ptr + scanOffset] > 250) {
					if (output.left === 0) {
						output.left = x;
					}
					if (output.top === 0) {
						output.top = y;
					}
					output.right = Math.max(output.right, x);
					output.bottom = Math.max(output.bottom, y);
				}
			}
		}
		return output;
	}

}
