import { fromByteArray } from 'base64-js';
import { Layer, Color, BlendMode } from './psd';
import { PsdReader, readBytes, readUint16, skipBytes } from './psdReader';
import { PsdWriter, writeUint16 } from './psdWriter';

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

export const enum ChannelID {
	Red = 0,
	Green = 1,
	Blue = 2,
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

export interface LayerChannelData {
	layer: Layer;
	channels: ChannelData[];
	top: number;
	left: number;
	right: number;
	bottom: number;
	mask?: {
		top: number;
		left: number;
		right: number;
		bottom: number;
	};
}

export type PixelArray = Uint8ClampedArray | Uint8Array;

export interface PixelData {
	data: PixelArray;
	width: number;
	height: number;
}

export function offsetForChannel(channelId: ChannelID) {
	switch (channelId) {
		case ChannelID.Red: return 0;
		case ChannelID.Green: return 1;
		case ChannelID.Blue: return 2;
		case ChannelID.Transparency: return 3;
		default: return channelId + 1;
	}
}

export function clamp(value: number, min: number, max: number) {
	return value < min ? min : (value > max ? max : value);
}

export function toArray(value: Uint8Array) {
	const result = new Array(value.length);

	for (let i = 0; i < value.length; i++) {
		result[i] = value[i];
	}

	return result;
}

export function readColor(reader: PsdReader) {
	const colorSpace = readUint16(reader);
	if (colorSpace !== 0) console.log('Invalid color space');
	const r = Math.round(readUint16(reader) / 257);
	const g = Math.round(readUint16(reader) / 257);
	const b = Math.round(readUint16(reader) / 257);
	const a = Math.round(readUint16(reader) / 257);
	return [r, g, b, a];
}

export function writeColor(writer: PsdWriter, color: number[] | undefined) {
	if (!color) color = [0, 0, 0, 0];
	writeUint16(writer, 0);
	writeUint16(writer, Math.round(color[0] * 257));
	writeUint16(writer, Math.round(color[1] * 257));
	writeUint16(writer, Math.round(color[2] * 257));
	writeUint16(writer, Math.round(color[3] * 257));
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

export function resetImageData({ width, height, data }: PixelData) {
	const size = (width * height) | 0;
	const buffer = new Uint32Array(data.buffer);

	for (let p = 0; p < size; p = (p + 1) | 0) {
		buffer[p] = 0xff000000;
	}
}

export function decodeBitmap(input: PixelArray, output: PixelArray, width: number, height: number) {
	for (let y = 0, p = 0, o = 0; y < height; y++) {
		for (let x = 0; x < width;) {
			let b = input[o++];

			for (let i = 0; i < 8 && x < width; i++ , x++) {
				const v = b & 0x80 ? 0 : 255;
				b = b << 1;
				output[p++] = v;
				output[p++] = v;
				output[p++] = v;
				output[p++] = 255;
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

export function readDataRaw(reader: PsdReader, pixelData: PixelData | undefined, offset: number, width: number, height: number) {
	const size = width * height;
	const buffer = readBytes(reader, size);

	if (pixelData && offset < 4) {
		const data = pixelData.data;

		for (let i = 0, p = offset | 0; i < size; i++ , p = (p + 4) | 0) {
			data[p] = buffer[i];
		}
	}
}

export function writeDataRLE(buffer: Uint8Array, { data }: PixelData, width: number, height: number, offsets: number[]) {
	if (!width || !height)
		return undefined;

	const stride = (4 * width) | 0;

	let ol = 0;
	let o = (offsets.length * 2 * height) | 0;

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
			buffer[ol++] = (length >> 8) & 0xff;
			buffer[ol++] = length & 0xff;
		}
	}

	return buffer.slice(0, o);
}

export function readDataRLE(
	reader: PsdReader, pixelData: PixelData | undefined, _width: number, height: number, step: number, offsets: number[]
) {
	const lengths = new Uint16Array(offsets.length * height);
	const data = pixelData && pixelData.data;

	for (let o = 0, li = 0; o < offsets.length; o++) {
		for (let y = 0; y < height; y++ , li++) {
			lengths[li] = readUint16(reader);
		}
	}

	for (let c = 0, li = 0; c < offsets.length; c++) {
		const offset = offsets[c] | 0;
		const extra = c > 3 || offset > 3;

		if (!data || extra) {
			for (let y = 0; y < height; y++ , li++) {
				skipBytes(reader, lengths[li]);
			}
		} else {
			for (let y = 0, p = offset | 0; y < height; y++ , li++) {
				const length = lengths[li];
				const buffer = readBytes(reader, length);

				for (let i = 0; i < length; i++) {
					let header = buffer[i];

					if (header >= 128) {
						const value = buffer[++i];
						header = (256 - header) | 0;

						for (let j = 0; j <= header; j = (j + 1) | 0) {
							data[p] = value;
							p = (p + step) | 0;
						}
					} else { // header < 128
						for (let j = 0; j <= header; j = (j + 1) | 0) {
							data[p] = buffer[++i];
							p = (p + step) | 0;
						}
					}

					/* istanbul ignore if */
					if (i >= length) {
						throw new Error(`Invalid RLE data: exceeded buffer size ${i}/${length}`);
					}
				}
			}
		}
	}
}

// h = <0, 360>; s, v = <0, 100>
export function hsv2rgb(h: number, s: number, v: number): Color {
	h = Math.max(0, Math.min(360, h === 360 ? 0 : h));
	s = Math.max(0, Math.min(1, s / 100));
	v = Math.max(0, Math.min(1, v / 100));

	let r = v;
	let g = v;
	let b = v;

	if (s !== 0) {
		h /= 60;
		const i = Math.floor(h);
		const f = h - i;
		const p = v * (1 - s);
		const q = v * (1 - s * f);
		const t = v * (1 - s * (1 - f));

		switch (i) {
			case 0:
				r = v;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = v;
				b = p;
				break;
			case 2:
				r = p;
				g = v;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = v;
				break;
			case 4:
				r = t;
				g = p;
				b = v;
				break;
			default:
				r = v;
				g = p;
				b = q;
		}
	}

	return [
		r * 255,
		g * 255,
		b * 255,
		255,
	];
}

/* istanbul ignore next */
export let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};

/* istanbul ignore next */
export let createCanvasFromData: (data: Uint8Array) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};

let tempCanvas: HTMLCanvasElement | undefined = undefined;

export let createImageData: (width: number, height: number) => ImageData = (width, height) => {
	if (!tempCanvas) tempCanvas = createCanvas(1, 1);
	return tempCanvas.getContext('2d')!.createImageData(width, height);
};

/* istanbul ignore if */
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
	createCanvasFromData = createCanvasFromDataMethod ?? createCanvasFromData;
	createImageData = createImageDataMethod ?? createImageData;
}
