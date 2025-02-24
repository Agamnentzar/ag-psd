import { fromByteArray } from 'base64-js';
import { deflate as deflateSync } from 'pako';
import { Layer, BlendMode, LayerColor, PixelData, PixelArray } from './psd';

export const MOCK_HANDLERS = false;
export const RAW_IMAGE_DATA = false;

export const fromBlendMode: { [key: string]: string } = {};
export const toBlendMode: { [key: string]: BlendMode } = {
	'pass': 'pass through',
	'norm': 'normal',
	'diss': 'dissolve',
	'dark': 'darken',
	'mul ': 'multiply',
	'idiv': 'color burn',
	'lbrn': 'linear burn',
	'dkCl': 'darker color',
	'lite': 'lighten',
	'scrn': 'screen',
	'div ': 'color dodge',
	'lddg': 'linear dodge',
	'lgCl': 'lighter color',
	'over': 'overlay',
	'sLit': 'soft light',
	'hLit': 'hard light',
	'vLit': 'vivid light',
	'lLit': 'linear light',
	'pLit': 'pin light',
	'hMix': 'hard mix',
	'diff': 'difference',
	'smud': 'exclusion',
	'fsub': 'subtract',
	'fdiv': 'divide',
	'hue ': 'hue',
	'sat ': 'saturation',
	'colr': 'color',
	'lum ': 'luminosity',
};

Object.keys(toBlendMode).forEach(key => fromBlendMode[toBlendMode[key]] = key);

export const layerColors: LayerColor[] = [
	'none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'
];

export const largeAdditionalInfoKeys = [
	// from documentation
	'LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD',
	// from guessing
	'cinf',
];

export interface Dict {
	[key: string]: string;
}

export function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

export function createEnum<T>(prefix: string, def: string, map: Dict) {
	const rev = revMap(map);
	const decode = (val: string): T => {
		const value = val.split('.')[1];
		if (value && !rev[value]) throw new Error(`Unrecognized value for enum: '${val}'`);
		return (rev[value] as any) || def;
	};
	const encode = (val: T | undefined): string => {
		if (val && !map[val as any]) throw new Error(`Invalid value for enum: '${val}'`);
		return `${prefix}.${map[val as any] || map[def]}`;
	};
	return { decode, encode };
}

export const enum ColorSpace {
	RGB = 0,
	HSB = 1,
	CMYK = 2,
	Lab = 7,
	Grayscale = 8,
}

export const enum LayerMaskFlags {
	PositionRelativeToLayer = 1,
	LayerMaskDisabled = 2,
	InvertLayerMaskWhenBlending = 4, // obsolete
	LayerMaskFromRenderingOtherData = 8,
	MaskHasParametersAppliedToIt = 16,
}

export const enum MaskParams {
	UserMaskDensity = 1,
	UserMaskFeather = 2,
	VectorMaskDensity = 4,
	VectorMaskFeather = 8,
}

export const enum ChannelID {
	Color0 = 0, // red (rgb) / cyan (cmyk)
	Color1 = 1, // green (rgb) / magenta (cmyk)
	Color2 = 2, // blue (rgb) / yellow (cmyk)
	Color3 = 3, // - (rgb) / black (cmyk)
	Transparency = -1,
	UserMask = -2,
	RealUserMask = -3,
}

export const enum Compression {
	RawData = 0,
	RleCompressed = 1,
	ZipWithoutPrediction = 2,
	ZipWithPrediction = 3,
}

export interface ChannelData {
	channelId: ChannelID;
	compression: Compression;
	buffer: Uint8Array | undefined;
	length: number;
}

export interface Bounds {
	top: number;
	left: number;
	right: number;
	bottom: number;
}

export interface LayerChannelData {
	layer: Layer;
	channels: ChannelData[];
	top: number;
	left: number;
	right: number;
	bottom: number;
	mask?: Bounds;
	realMask?: Bounds;
}

export function offsetForChannel(channelId: ChannelID, cmyk: boolean) {
	switch (channelId) {
		case ChannelID.Color0: return 0;
		case ChannelID.Color1: return 1;
		case ChannelID.Color2: return 2;
		case ChannelID.Color3: return cmyk ? 3 : channelId + 1;
		case ChannelID.Transparency: return cmyk ? 4 : 3;
		default: return channelId + 1;
	}
}

export function clamp(value: number, min: number, max: number) {
	return value < min ? min : (value > max ? max : value);
}

export function hasAlpha(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let i = 3; i < size; i += 4) {
		if (data.data[i] !== 255) {
			return true;
		}
	}

	return false;
}

export function resetImageData({ data }: PixelData) {
	const alpha = (data instanceof Float32Array) ? 1.0 : ((data instanceof Uint16Array) ? 0xffff : 0xff);

	for (let p = 0, size = data.length | 0; p < size; p = (p + 4) | 0) {
		data[p + 0] = 0;
		data[p + 1] = 0;
		data[p + 2] = 0;
		data[p + 3] = alpha;
	}
}

export function imageDataToCanvas(pixelData: PixelData) {
	const canvas = createCanvas(pixelData.width, pixelData.height);
	let imageData: ImageData;

	if (pixelData.data instanceof Uint8ClampedArray) {
		imageData = pixelData as ImageData;
	} else {
		imageData = createImageData(pixelData.width, pixelData.height);
		const src = pixelData.data;
		const dst = imageData.data;

		if (src instanceof Float32Array) {
			for (let i = 0, size = src.length; i < size; i += 4) {
				dst[i + 0] = Math.round(Math.pow(src[i + 0], 1.0 / 2.2) * 255);
				dst[i + 1] = Math.round(Math.pow(src[i + 1], 1.0 / 2.2) * 255);
				dst[i + 2] = Math.round(Math.pow(src[i + 2], 1.0 / 2.2) * 255);
				dst[i + 3] = Math.round(src[i + 3] * 255);
			}
		} else {
			const shift = (src instanceof Uint16Array) ? 8 : 0;

			for (let i = 0, size = src.length; i < size; i++) {
				dst[i] = src[i] >>> shift;
			}
		}
	}

	canvas.getContext('2d')!.putImageData(imageData, 0, 0);
	return canvas;
}

export function decodeBitmap(input: PixelArray, output: PixelArray, width: number, height: number) {
	if (!(input instanceof Uint8Array || input instanceof Uint8ClampedArray)) throw new Error('Invalid bit depth');

	for (let y = 0, p = 0, o = 0; y < height; y++) {
		for (let x = 0; x < width;) {
			let b = input[o++];

			for (let i = 0; i < 8 && x < width; i++, x++, p += 4) {
				const v = b & 0x80 ? 0 : 255;
				b = b << 1;
				output[p + 0] = v;
				output[p + 1] = v;
				output[p + 2] = v;
				output[p + 3] = 255;
			}
		}
	}
}

export function writeDataRaw(data: PixelData, offset: number, width: number, height: number) {
	if (!width || !height)
		return undefined;

	const array = new Uint8Array(width * height);

	for (let i = 0; i < array.length; i++) {
		array[i] = data.data[i * 4 + offset];
	}

	return array;
}

export function writeDataRLE(buffer: Uint8Array, { data, width, height }: PixelData, offsets: number[], large: boolean) {
	if (!width || !height) return undefined;

	const stride = (4 * width) | 0;

	let ol = 0;
	let o = (offsets.length * (large ? 4 : 2) * height) | 0;

	for (const offset of offsets) {
		for (let y = 0, p = offset | 0; y < height; y++) {
			const strideStart = (y * stride) | 0;
			const strideEnd = (strideStart + stride) | 0;
			const lastIndex = (strideEnd + offset - 4) | 0;
			const lastIndex2 = (lastIndex - 4) | 0;
			const startOffset = o;

			for (p = (strideStart + offset) | 0; p < strideEnd; p = (p + 4) | 0) {
				if (p < lastIndex2) {
					let value1 = data[p];
					p = (p + 4) | 0;
					let value2 = data[p];
					p = (p + 4) | 0;
					let value3 = data[p];

					if (value1 === value2 && value1 === value3) {
						let count = 3;

						while (count < 128 && p < lastIndex && data[(p + 4) | 0] === value1) {
							count = (count + 1) | 0;
							p = (p + 4) | 0;
						}

						buffer[o++] = 1 - count;
						buffer[o++] = value1;
					} else {
						const countIndex = o;
						let writeLast = true;
						let count = 1;
						buffer[o++] = 0;
						buffer[o++] = value1;

						while (p < lastIndex && count < 128) {
							p = (p + 4) | 0;
							value1 = value2;
							value2 = value3;
							value3 = data[p];

							if (value1 === value2 && value1 === value3) {
								p = (p - 12) | 0;
								writeLast = false;
								break;
							} else {
								count++;
								buffer[o++] = value1;
							}
						}

						if (writeLast) {
							if (count < 127) {
								buffer[o++] = value2;
								buffer[o++] = value3;
								count += 2;
							} else if (count < 128) {
								buffer[o++] = value2;
								count++;
								p = (p - 4) | 0;
							} else {
								p = (p - 8) | 0;
							}
						}

						buffer[countIndex] = count - 1;
					}
				} else if (p === lastIndex) {
					buffer[o++] = 0;
					buffer[o++] = data[p];
				} else { // p === lastIndex2
					buffer[o++] = 1;
					buffer[o++] = data[p];
					p = (p + 4) | 0;
					buffer[o++] = data[p];
				}
			}

			const length = o - startOffset;

			if (large) {
				buffer[ol++] = (length >> 24) & 0xff;
				buffer[ol++] = (length >> 16) & 0xff;
			}

			buffer[ol++] = (length >> 8) & 0xff;
			buffer[ol++] = length & 0xff;
		}
	}

	return buffer.slice(0, o);
}

export function writeDataZipWithoutPrediction({ data, width, height }: PixelData, offsets: number[]) {
	const size = width * height;
	const channel = new Uint8Array(size);
	const buffers: Uint8Array[] = [];
	let totalLength = 0;

	for (const offset of offsets) {
		for (let i = 0, o = offset; i < size; i++, o += 4) {
			channel[i] = data[o];
		}

		const buffer = deflateSync(channel);
		buffers.push(buffer);
		totalLength += buffer.byteLength;
	}

	if (buffers.length > 0) {
		const buffer = new Uint8Array(totalLength);
		let offset = 0;

		for (const b of buffers) {
			buffer.set(b, offset);
			offset += b.byteLength;
		}

		return buffer;
	} else {
		return buffers[0];
	}
}

export let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};

export let createCanvasFromData: (data: Uint8Array) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};

let tempCanvas: HTMLCanvasElement | undefined = undefined;

export let createImageData: (width: number, height: number) => ImageData = (width, height) => {
	if (!tempCanvas) tempCanvas = createCanvas(1, 1);
	return tempCanvas.getContext('2d')!.createImageData(width, height);
};

if (typeof document !== 'undefined') {
	createCanvas = (width, height) => {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	};

	createCanvasFromData = (data) => {
		const image = new Image();
		image.src = 'data:image/jpeg;base64,' + fromByteArray(data);
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		canvas.getContext('2d')!.drawImage(image, 0, 0);
		return canvas;
	};
}

export function initializeCanvas(
	createCanvasMethod: (width: number, height: number) => HTMLCanvasElement,
	createCanvasFromDataMethod?: (data: Uint8Array) => HTMLCanvasElement,
	createImageDataMethod?: (width: number, height: number) => ImageData
) {
	createCanvas = createCanvasMethod;
	createCanvasFromData = createCanvasFromDataMethod || createCanvasFromData;
	createImageData = createImageDataMethod || createImageData;
}
