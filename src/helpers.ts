import { PsdReader, readBytes, readUint16, skipBytes } from './psdReader';
import { Layer, ChannelID, Compression, WriteOptions } from './psd';
import { fromByteArray } from 'base64-js';

export interface ChannelData {
	channelId: ChannelID;
	compression: Compression;
	buffer: Uint8Array | undefined;
	length: number;
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

export function toArray(value: Uint8Array) {
	const result = new Array(value.length);

	for (let i = 0; i < value.length; i++) {
		result[i] = value[i];
	}

	return result;
}

export function readColor(reader: PsdReader) {
	return toArray(readBytes(reader, 10));
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

function isRowEmpty({ data, width }: PixelData, y: number, left: number, right: number) {
	const start = ((y * width + left) * 4 + 3) | 0;
	const end = (start + (right - left) * 4) | 0;

	for (let i = start; i < end; i = (i + 4) | 0) {
		if (data[i] !== 0) {
			return false;
		}
	}

	return true;
}

function isColEmpty({ data, width }: PixelData, x: number, top: number, bottom: number) {
	const stride = (width * 4) | 0;
	const start = (top * stride + x * 4 + 3) | 0;

	for (let y = top, i = start; y < bottom; y++ , i = (i + stride) | 0) {
		if (data[i] !== 0) {
			return false;
		}
	}

	return true;
}

function trimData(data: PixelData) {
	let top = 0;
	let left = 0;
	let right = data.width;
	let bottom = data.height;

	while (top < bottom && isRowEmpty(data, top, left, right))
		top++;
	while (bottom > top && isRowEmpty(data, bottom - 1, left, right))
		bottom--;
	while (left < right && isColEmpty(data, left, top, bottom))
		left++;
	while (right > left && isColEmpty(data, right - 1, top, bottom))
		right--;

	return { top, left, right, bottom };
}

export function getLayerDimentions(layer: Layer) {
	const { canvas } = layer;

	if (canvas && canvas.width && canvas.height) {
		return { width: canvas.width, height: canvas.height };
	} else {
		return { width: 0, height: 0 };
	}
}

export function getChannels(tempBuffer: Uint8Array, layer: Layer, background: boolean, options: WriteOptions): ChannelData[] {
	let canvas = layer.canvas;

	if (typeof layer.top === 'undefined') {
		layer.top = 0;
	}

	if (typeof layer.left === 'undefined') {
		layer.left = 0;
	}

	const result: ChannelData[] = [
		{
			channelId: ChannelID.Transparency,
			compression: Compression.RawData,
			buffer: undefined,
			length: 2,
		}
	];

	let { width, height } = getLayerDimentions(layer);

	if (!canvas || !width || !height) {
		layer.right = layer.left;
		layer.bottom = layer.top;
		return result;
	}

	layer.right = layer.left + width;
	layer.bottom = layer.top + height;

	const context = canvas.getContext('2d')!;
	let data = context.getImageData(0, 0, width, height);

	if (options.trimImageData) {
		const { left, top, right, bottom } = trimData(data);

		if (left !== 0 || top !== 0 || right !== data.width || bottom !== data.height) {
			layer.left += left;
			layer.top += top;
			layer.right -= (data.width - right);
			layer.bottom -= (data.height - bottom);
			width = layer.right - layer.left;
			height = layer.bottom - layer.top;

			if (!width || !height)
				return result;

			data = context.getImageData(left, top, width, height);
		}
	}

	const channels = [
		ChannelID.Red,
		ChannelID.Green,
		ChannelID.Blue,
	];

	if (!background || hasAlpha(data)) {
		channels.unshift(ChannelID.Transparency);
	}

	return channels.map(channel => {
		const offset = offsetForChannel(channel);
		const buffer = writeDataRLE(tempBuffer, data, width, height, [offset])!;

		return {
			channelId: channel,
			compression: Compression.RleCompressed,
			buffer: buffer,
			length: 2 + buffer.length,
		};
	});
}

export function resetCanvas({ width, height, data }: PixelData) {
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

/* istanbul ignore next */
export let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};

/* istanbul ignore next */
export let createCanvasFromData: (data: Uint8Array) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
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
) {
	createCanvas = createCanvasMethod;
	createCanvasFromData = createCanvasFromDataMethod || createCanvasFromData;
}
