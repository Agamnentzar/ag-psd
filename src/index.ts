import {Layer, LayerMaskData, Psd, ReadOptions, WriteOptions} from './psd';
import { PsdWriter, writePsd as writePsdInternal, getWriterBuffer, createWriter, getWriterBufferNoCopy } from './psdWriter';
import { PsdReader, readPsd as readPsdInternal, createReader } from './psdReader';
export * from './abr';
export * from './csh';
export { initializeCanvas } from './helpers';
export * from './psd';
import { fromByteArray } from 'base64-js';
import {BoundingBoxScan, IBoundingBox} from './BoundingBoxScanner';
export { PsdReader, PsdWriter };
import { createCanvas } from './canvas/Canvas';
import {_flattenPsd} from './flatten';
import {Canvas} from 'skia-canvas/lib';

interface BufferLike {
	buffer: ArrayBuffer;
	byteOffset: number;
	byteLength: number;
}

export const byteArrayToBase64 = fromByteArray;
export const boundingBoxScanner = new BoundingBoxScan();

export function readPsd(buffer: ArrayBuffer | BufferLike, options?: ReadOptions): Psd {
	const reader = 'buffer' in buffer ?
		createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
		createReader(buffer);
	return readPsdInternal(reader, options);
}

export function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return getWriterBuffer(writer);
}

export function writePsdUint8Array(psd: Psd, options?: WriteOptions): Uint8Array {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return getWriterBufferNoCopy(writer);
}

export function writePsdBuffer(psd: Psd, options?: WriteOptions): Buffer {
	if (typeof Buffer === 'undefined') {
		throw new Error('Buffer not supported on this platform');
	}
	return Buffer.from(writePsdUint8Array(psd, options));
}

export function getLayerOrMaskContentBoundingBox(layer: Layer | LayerMaskData): IBoundingBox | undefined {
	return boundingBoxScanner.scanLayerTransparency(layer);
}

export function getLayerOrMaskChannelBoundingBox(layer: Layer | LayerMaskData, channel: number = BoundingBoxScan.SCAN_OFFSET_RED): IBoundingBox | undefined {
	return boundingBoxScanner.scanLayerChannel(layer, channel);
}

export interface IPSRectangle {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export const flattenPsd = _flattenPsd;

export const resizeLayerToMask = (layer: Layer, psd: Psd, maskMargin: number = 0) => {
	const layerBoundingBox = getMaskedLayerSize(layer, maskMargin, psd);
	// Create new layer of correct size
	const layerCanvas = layer.canvas;
	const layerImageData = layerCanvas!
		.getContext('2d')
		.getImageData(
			layerBoundingBox.left - layer.left!,
			layerBoundingBox.top - layer.top!,
			layerBoundingBox.right - layerBoundingBox.left,
			layerBoundingBox.bottom - layerBoundingBox.top,
		);
	// Apply new layer
	const newLayerCanvas = new Canvas(
		layerBoundingBox.right - layerBoundingBox.left,
		layerBoundingBox.bottom - layerBoundingBox.top,
	);
	newLayerCanvas.getContext('2d').putImageData(layerImageData, 0, 0);
	// eslint-disable-next-line no-param-reassign
	layer.canvas = <any>newLayerCanvas;
	// eslint-disable-next-line no-param-reassign
	layer.left = layerBoundingBox.left;
	// eslint-disable-next-line no-param-reassign
	layer.right = layerBoundingBox.right;
	// eslint-disable-next-line no-param-reassign
	layer.top = layerBoundingBox.top;
	// eslint-disable-next-line no-param-reassign
	layer.bottom = layerBoundingBox.bottom;
};

export const getMaskedLayerSize = (layer: Layer, margin: number = 0, psd: Psd): IPSRectangle => {
	const { right, left, bottom, top } = layer;
	const mask: LayerMaskData = layer.mask!;
	// Place the layer on the canvas
	// Mask the layer using the mask
	if (mask) {

		// First, create a canvas PSD size
		const compCanvas = createCanvas(psd.width, psd.height);
		const compCtx = compCanvas.getContext('2d');
		const maskCanvas = createCanvas(psd.width, psd.height);
		const maskCtx = maskCanvas.getContext('2d');

		maskCtx!.drawImage(layer.mask!.canvas!, layer.mask!.left!, layer.mask!.top!);
		compCtx!.drawImage(layer.canvas!, layer.left!, layer.top!);

		const compImageData = compCtx!.getImageData(
			0,
			0,
			psd.width,
			psd.height,
		);

		const maskImageData = maskCtx!.getImageData(
			0,
			0,
			psd.width,
			psd.height,
		);

		/*
		this is getting the raw pixel data, which is an array of uint8's, out of the ImageData instances.
		You end up with a raw array that is sorted in RGBARGBARGBA.... fashion.
		Hence looping through it in steps of 4.
		We then need the Alpha (4th byte in each 4-byte block) of the image layer,
		and we pick the Red (1st byte) of the mask layer, since the mask layer is black-and-white at this point.
		(R===G===B in that case, so we can pick any of these).
		 */

		const compImageDataArray = compImageData.data;
		const maskImageDataArray = maskImageData.data;

		for (let i = 0; i < compImageDataArray.length; i += 4) {
			// On the mask, white (R,G,B is 255) equals opaque, black (R,G,B is 0) equals transparent.
			const maskBrightness = maskImageDataArray[i];
			// On the image layer, we get the Alpha channel
			const alphaFromLayer = compImageDataArray[i + 3];
			// The alpha of the masked layer equals the multiplied brightness value of the mask and the image layer's alpha
			const concatValue = Math.ceil(
				(maskBrightness * alphaFromLayer) / 255,
			);
			compImageDataArray[i + 3] = concatValue;
		}

		compCanvas.width = psd.width; // Reset
		compCtx!.putImageData(compImageData, 0, 0);

		let maskBoundingBox: IBoundingBox = boundingBoxScanner.scan(compImageDataArray, psd.width, psd.height);
		if (!maskBoundingBox) {
			maskBoundingBox = {
				left: 0,
				top: 0,
				right: mask.right! - mask.left!,
				bottom: mask.bottom! - mask.top!,
			};
		}
		const layerLeft = maskBoundingBox.left! - margin;
		const layerRight = maskBoundingBox.right! + margin;
		const layerTop = maskBoundingBox.top! - margin;
		const layerBottom = maskBoundingBox.bottom! + margin;
		return {
			left: layerLeft,
			right: layerRight,
			top: layerTop,
			bottom: layerBottom,
		};
	}
	return <IPSRectangle> {
		left,
		right,
		top,
		bottom,
	};
};
