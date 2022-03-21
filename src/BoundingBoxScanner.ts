/**
 * A tool for finding the bounding box around a set of colored pixels
 */
import {Layer, LayerMaskData} from './psd';
import {createCanvas} from './helpers';

export interface IBoundingBox {
	left: number | undefined;
	top: number | undefined;
	right: number | undefined;
	bottom: number | undefined;
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
		const imageData = layer.canvas?.getContext('2d')?.getImageData(0, 0, layer.canvas?.width, layer.canvas?.height)?.data.buffer;
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
		const imageData = layer.canvas?.getContext('2d')?.getImageData(0, 0, layer.canvas?.width, layer.canvas?.height)?.data.buffer;
		if (imageData && layer.canvas) {
			return this.scan(new Uint8ClampedArray(imageData), layer.canvas.width, layer.canvas.height, channel);
		} else {
			return undefined;
		}
	}

	public cropLayerToBoundingBox(layer: Layer): void {
		const boundingBox: IBoundingBox | undefined = this.scanLayerTransparency(layer);
		if (boundingBox) {
			const width: number = boundingBox.right! - boundingBox.left!;
			const height: number = boundingBox.bottom! - boundingBox.top!;
			const newCanvas = createCanvas(width, height);
			const ctx: CanvasRenderingContext2D = newCanvas.getContext('2d') as CanvasRenderingContext2D;
			ctx.drawImage(layer.canvas!, boundingBox.left!, boundingBox.top!, width, height, 0, 0, width, height);
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
	public scan(data: Uint8ClampedArray, w: number, _h: number, scanOffset: number = BoundingBoxScan.SCAN_OFFSET_ALPHA): IBoundingBox {
		if (scanOffset === void 0) {
			scanOffset = BoundingBoxScan.SCAN_OFFSET_ALPHA;
		}
		let l = data.length,
			i,
			bound: IBoundingBox = {
				top: undefined,
				left: undefined,
				right: undefined,
				bottom: undefined
			},
			x, y;

		// Iterate over every pixel to find the highest
		// and where it ends on every axis ()
		for (i = 0; i < l; i += 4) {
			if (data[i + scanOffset] > 10) {
				x = (i / 4) % w;
				y = ~~((i / 4) / w);
				if (bound.top === undefined) {
					bound.top = y;
				}
				if (bound.left === undefined) {
					bound.left = x;
				} else if (x < bound.left) {
					bound.left = x;
				}
				if (bound.right === undefined) {
					bound.right = x;
				} else if (bound.right < x) {
					bound.right = x;
				}
				if (bound.bottom === undefined) {
					bound.bottom = y;
				} else if (bound.bottom < y) {
					bound.bottom = y;
				}
			}
		}
		return <any>bound as IBoundingBox;
	}
}
