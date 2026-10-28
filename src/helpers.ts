import { deflate as deflateSync } from 'pako';
import { Layer, BlendMode, LayerColor, PixelData, PixelArray, ChannelID, Compression } from './psd';
import { decodeJpeg } from './jpeg';
import { PsdReader } from './psdReader';

export const MOCK_HANDLERS = false;

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
	'none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray', 'seafoam', 'indigo', 'magenta', 'fuchsia',
];

// keys not listed in documentation that Photoshop writes with 64bit length in PSB files (with 8B64 signature)
export const largeAdditionalInfoKeysObserved = ['lnk3', 'lnkE', 'pths', 'extd', 'extn', 'FELS', 'artd'];

export const largeAdditionalInfoKeys = [
	// from documentation
	'LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD',
	// from guessing
	'cinf',
	...largeAdditionalInfoKeysObserved,
];

export interface Dict {
	[key: string]: string;
}

export function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

export function createEnum<T extends string>(prefix: string, def: T, map: { [K in T]: string; }) {
	const rev = revMap(map);

	const decode = (val: string): T => {
		const value = val.split('.')[1];
		if (value && !rev[value]) {
			// Photoshop 2026 writes the long-form enum value instead of the historical 4-char code
			// (the map VALUE, e.g. 'BlnM.Nrml'). Two long-form shapes occur:
			//  - single-word modes use the map KEY verbatim:        'BlnM.normal'
			//  - multi-word modes use a camelCase id whose map key is space-separated:
			//    'BlnM.colorBurn' -> 'color burn'; normalize camelCase before giving up.
			if (Object.prototype.hasOwnProperty.call(map, value)) return value as any;
			const spaced = value.replace(/([A-Z])/g, ' $1').toLowerCase();
			if (Object.prototype.hasOwnProperty.call(map, spaced)) return spaced as any;
			throw new Error(`Unrecognized value for enum: '${val}'`);
		}
		return (rev[value] as any) || def;
	};

	const encode = (val: T | undefined): string => {
		if (val && !map[val]) throw new Error(`Invalid value for enum: '${val}'`);
		return `${prefix}.${val ? map[val] : map[def]}`;
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

export interface ChannelData {
	id: ChannelID;
	compression: Compression;
	data: Uint8Array | undefined;
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

// Lab a/b components are stored in -128..127 range (multiplied by scale), normalized values are in -1..1 range
export function normalizeLabAB(value: number, scale = 1) {
	return value < 0 ? (value / (128 * scale)) : (value / (127 * scale));
}

export function denormalizeLabAB(value: number, scale = 1) {
	return value < 0 ? (value * (128 * scale)) : (value * (127 * scale));
}

export function clamp(value: number, min: number, max: number) {
	return value < min ? min : (value > max ? max : value);
}

export function hasAlpha(data: PixelData) {
	const size = data.width * data.height * 4;
	const max = data.data instanceof Float32Array ? 1 : (data.data instanceof Uint16Array ? 0xffff : 0xff);

	for (let i = 3; i < size; i += 4) {
		if (data.data[i] !== max) {
			return true;
		}
	}

	return false;
}

// Polynomial approximation of U.S. Web Coated (SWOP) v2 CMYK to RGB conversion (default CMYK profile of Photoshop).
// Coefficients are taken from pdf.js (DeviceCmykCS in src/core/colorspace.js, https://github.com/mozilla/pdf.js),
// Copyright 2012 Mozilla Foundation, licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0)
// c, m, y, k - ink values (0 - 1), output - RGB values (0 - 255, not rounded or clamped)
export function cmykToRgbValues(c: number, m: number, y: number, k: number, out: number[]) {
	out[0] = 255 +
		c * (-4.387332384609988 * c + 54.48615194189176 * m + 18.82290502165302 * y + 212.25662451639585 * k - 285.2331026137004) +
		m * (1.7149763477362134 * m - 5.6096736904047315 * y - 17.873870861415444 * k - 5.497006427196366) +
		y * (-2.5217340131683033 * y - 21.248923337353073 * k + 17.5119270841813) +
		k * (-21.86122147463605 * k - 189.48180835922747);
	out[1] = 255 +
		c * (8.841041422036149 * c + 60.118027045597366 * m + 6.871425592049007 * y + 31.159100130055922 * k - 79.2970844816548) +
		m * (-15.310361306967817 * m + 17.575251261109482 * y + 131.35250912493976 * k - 190.9453302588951) +
		y * (4.444339102852739 * y + 9.8632861493405 * k - 24.86741582555878) +
		k * (-20.737325471181034 * k - 187.80453709719578);
	out[2] = 255 +
		c * (0.8842522430003296 * c + 8.078677503112928 * m + 30.89978309703729 * y - 0.23883238689178934 * k - 14.183576799673286) +
		m * (10.49593273432072 * m + 63.02378494754052 * y + 50.606957656360734 * k - 112.23884253719248) +
		y * (0.03296041114873217 * y + 115.60384449646641 * k - 193.58209356861505) +
		k * (-22.33816807309886 * k - 180.12613974708367);
}

const clamp01 = (v: number) => v < 0 ? 0 : (v > 1 ? 1 : v);

// finds c, m, y (with fixed k) for given RGB color using Gauss-Newton method, returns squared error
function solveCmy(r: number, g: number, b: number, k: number, x: number[]) {
	const f = [0, 0, 0], f2 = [0, 0, 0], e = [0, 0, 0];
	const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
	const h = 1e-4;

	for (let iteration = 0; iteration < 20; iteration++) {
		cmykToRgbValues(x[0], x[1], x[2], k, f);
		e[0] = f[0] - r; e[1] = f[1] - g; e[2] = f[2] - b;
		if ((e[0] * e[0] + e[1] * e[1] + e[2] * e[2]) < 1e-6) break;

		for (let j = 0; j < 3; j++) {
			const s = x[j];
			x[j] = s + h;
			cmykToRgbValues(x[0], x[1], x[2], k, f2);
			x[j] = s;
			for (let i = 0; i < 3; i++) J[i][j] = (f2[i] - f[i]) / h;
		}

		const [[a, b_, c], [d, e_, f_], [g_, h_, i_]] = J;
		const det = a * (e_ * i_ - f_ * h_) - b_ * (d * i_ - f_ * g_) + c * (d * h_ - e_ * g_);
		if (Math.abs(det) < 1e-12) break;

		const inverse = [
			[(e_ * i_ - f_ * h_), (c * h_ - b_ * i_), (b_ * f_ - c * e_)],
			[(f_ * g_ - d * i_), (a * i_ - c * g_), (c * d - a * f_)],
			[(d * h_ - e_ * g_), (b_ * g_ - a * h_), (a * e_ - b_ * d)],
		];

		let changed = 0;

		for (let j = 0; j < 3; j++) {
			const delta = -(inverse[j][0] * e[0] + inverse[j][1] * e[1] + inverse[j][2] * e[2]) / det;
			const value = clamp01(x[j] + delta);
			changed += Math.abs(value - x[j]);
			x[j] = value;
		}

		if (changed < 1e-9) break;
	}

	cmykToRgbValues(x[0], x[1], x[2], k, f);
	return (f[0] - r) * (f[0] - r) + (f[1] - g) * (f[1] - g) + (f[2] - b) * (f[2] - b);
}

// finds CMYK ink values (0 - 1) for RGB color (0 - 255), out of gamut colors are approximated
function rgbToCmykExact(r: number, g: number, b: number, out: number[]) {
	const max = Math.max(r, g, b) / 255;
	const blackGeneration = Math.pow(clamp01((1 - max - 0.2) / 0.8), 1.3);
	const x = [0, 0, 0];
	let bestScore = Infinity, bestError = Infinity;

	const tryBlack = (k: number) => {
		x[0] = clamp01(1 - r / 255 - k);
		x[1] = clamp01(1 - g / 255 - k);
		x[2] = clamp01(1 - b / 255 - k);
		const error = solveCmy(r, g, b, k, x);
		// prefer solutions close to black generation value if the error is small enough
		const score = Math.max(error, 0.1) + Math.abs(k - blackGeneration) * 0.01;

		if (score < bestScore) {
			bestScore = score;
			bestError = error;
			out[0] = x[0]; out[1] = x[1]; out[2] = x[2]; out[3] = k;
		}
	};

	tryBlack(blackGeneration);

	if (bestError > 0.1) {
		for (let i = 0; i <= 10; i++) tryBlack(i / 10);
	}

	if (bestError > 0.1) {
		const k = out[3];
		for (let i = -5; i <= 5; i++) tryBlack(clamp01(k + i / 100));
	}
}

const cmykLutSize = 33;
let cmykLut: Float32Array | undefined;

function getCmykLut() {
	if (!cmykLut) {
		const n = cmykLutSize;
		const lut = new Float32Array(n * n * n * 4);
		const out = [0, 0, 0, 0];

		for (let r = 0, o = 0; r < n; r++) {
			for (let g = 0; g < n; g++) {
				for (let b = 0; b < n; b++, o += 4) {
					rgbToCmykExact(r * 255 / (n - 1), g * 255 / (n - 1), b * 255 / (n - 1), out);
					lut[o] = out[0]; lut[o + 1] = out[1]; lut[o + 2] = out[2]; lut[o + 3] = out[3];
				}
			}
		}

		cmykLut = lut;
	}

	return cmykLut;
}

// inverse of cmykToRgbValues, r, g, b - RGB values (0 - 1), output - CMYK ink values (0 - 1)
export function rgbToCmykValues(r: number, g: number, b: number, out: number[]) {
	const lut = getCmykLut();
	const n1 = cmykLutSize - 1;
	const fr = clamp01(r) * n1, fg = clamp01(g) * n1, fb = clamp01(b) * n1;
	const r0 = Math.min(n1 - 1, Math.floor(fr)), g0 = Math.min(n1 - 1, Math.floor(fg)), b0 = Math.min(n1 - 1, Math.floor(fb));
	const dr = fr - r0, dg = fg - g0, db = fb - b0;
	out[0] = out[1] = out[2] = out[3] = 0;

	for (let i = 0; i < 8; i++) {
		const ir = i >> 2, ig = (i >> 1) & 1, ib = i & 1;
		const w = (ir ? dr : 1 - dr) * (ig ? dg : 1 - dg) * (ib ? db : 1 - db);
		const o = (((r0 + ir) * cmykLutSize + g0 + ig) * cmykLutSize + b0 + ib) * 4;
		out[0] += w * lut[o];
		out[1] += w * lut[o + 1];
		out[2] += w * lut[o + 2];
		out[3] += w * lut[o + 3];
	}
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

// returns view into the buffer, the buffer has to fit worst case size (see getRLEChannelBound), throws if it doesn't
export function writeDataRLE(buffer: Uint8Array, { data, width, height }: PixelData, offsets: number[], large: boolean) {
	if (!width || !height) return buffer.subarray(0, 0);

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

			// writes past the end of typed array are ignored, so it's enough to check the size after each row
			if (o > buffer.length) throw new Error(`RLE buffer too small (${buffer.length})`);

			const length = o - startOffset;

			if (large) {
				buffer[ol++] = (length >> 24) & 0xff;
				buffer[ol++] = (length >> 16) & 0xff;
			}

			buffer[ol++] = (length >> 8) & 0xff;
			buffer[ol++] = length & 0xff;
		}
	}

	// returns view of the buffer, copy the data if the buffer is going to be reused
	return buffer.subarray(0, o);
}

// single channel of image data (8bit, 16bit or 32bit values)
export type PlanarData = Uint8Array | Uint16Array | Float32Array;

// converts channel values to big-endian bytes
export function planarToBytes(values: PlanarData): Uint8Array {
	if (values instanceof Uint8Array) return values;

	const bytes = new Uint8Array(values.byteLength);
	const view = new DataView(bytes.buffer);

	if (values instanceof Uint16Array) {
		for (let i = 0; i < values.length; i++) view.setUint16(i * 2, values[i], false);
	} else {
		for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i], false);
	}

	return bytes;
}

// RLE (PackBits) compression of rows of bytes, prefixed with byte counts of each row
export function writeDataRLEBytes(bytes: Uint8Array, rowBytes: number, height: number, large: boolean) {
	const countSize = large ? 4 : 2;
	const buffer = new Uint8Array(height * (countSize + rowBytes + Math.ceil(rowBytes / 128)));
	let o = countSize * height;

	for (let y = 0; y < height; y++) {
		const start = o;
		const rowStart = y * rowBytes;
		const rowEnd = rowStart + rowBytes;
		let i = rowStart;

		while (i < rowEnd) {
			let run = 1;
			while (i + run < rowEnd && run < 128 && bytes[i + run] === bytes[i]) run++;

			if (run > 1) {
				buffer[o++] = 257 - run;
				buffer[o++] = bytes[i];
				i += run;
			} else {
				// literal bytes until a run of at least 3 equal bytes
				const countIndex = o++;
				let count = 0;

				while (i < rowEnd && count < 128) {
					if (i + 2 < rowEnd && bytes[i] === bytes[i + 1] && bytes[i] === bytes[i + 2]) break;
					buffer[o++] = bytes[i++];
					count++;
				}

				buffer[countIndex] = count - 1;
			}
		}

		const length = o - start;

		for (let j = 0; j < countSize; j++) {
			buffer[y * countSize + j] = (length >>> ((countSize - j - 1) * 8)) & 0xff;
		}
	}

	return buffer.subarray(0, o);
}

// zip compression with prediction (values are delta encoded per row, 32bit values are split into byte planes first)
export function writeDataZipWithPrediction(values: PlanarData, width: number, height: number) {
	let bytes: Uint8Array;

	if (values instanceof Uint8Array) {
		bytes = new Uint8Array(width * height);

		for (let y = 0, i = 0; y < height; y++) {
			for (let x = 0, prev = 0; x < width; x++, i++) {
				bytes[i] = values[i] - prev; // Uint8Array wraps values on assignment
				prev = values[i];
			}
		}
	} else if (values instanceof Uint16Array) {
		bytes = new Uint8Array(width * height * 2);

		for (let y = 0, i = 0; y < height; y++) {
			for (let x = 0, prev = 0; x < width; x++, i++) {
				const delta = (values[i] - prev) & 0xffff;
				bytes[i * 2] = delta >> 8;
				bytes[i * 2 + 1] = delta & 0xff;
				prev = values[i];
			}
		}
	} else {
		const rowBytes = width * 4;
		const source = planarToBytes(values);
		bytes = new Uint8Array(rowBytes * height);

		for (let y = 0; y < height; y++) {
			const row = y * rowBytes;

			for (let x = 0; x < width; x++) {
				for (let b = 0; b < 4; b++) {
					bytes[row + b * width + x] = source[row + x * 4 + b];
				}
			}

			for (let x = rowBytes - 1; x > 0; x--) {
				bytes[row + x] -= bytes[row + x - 1];
			}
		}
	}

	return deflateSync(bytes);
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

export function createCanvasFromData(data: Uint8Array, reader: Pick<PsdReader, 'log'>): HTMLCanvasElement {
	const canvas = createCanvas(100, 100);

	try {
		const context = canvas.getContext('2d')!;
		const imageData = decodeJpeg(data, (w, h) => context.createImageData(w, h) as any);
		canvas.width = imageData.width;
		canvas.height = imageData.height;
		context.putImageData(imageData, 0, 0);
	} catch (e: any) {
		reader.log('JPEG decompression error', e.message);
	}

	return canvas;
}

export let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
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
}

export function initializeCanvas(
	createCanvasMethod: (width: number, height: number) => HTMLCanvasElement,
	createImageDataMethod?: (width: number, height: number) => ImageData
) {
	createCanvas = createCanvasMethod;
	createImageData = createImageDataMethod || createImageData;
}
