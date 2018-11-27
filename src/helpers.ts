import { PsdReader, readBytes, readUint16 } from './psdReader';
import { Layer, ChannelID, Compression, WriteOptions } from './psd';
import { fromByteArray } from 'base64-js';

export interface ChannelData {
	channelId: ChannelID;
	compression: Compression;
	buffer: ArrayBuffer | undefined;
	length: number;
}

export interface PixelArray {
	[index: number]: number;
	length: number;
}

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

export function getChannels(layer: Layer, background: boolean, options: WriteOptions) {
	let canvas = layer.canvas;

	if (typeof layer.top === 'undefined') {
		layer.top = 0;
	}

	if (typeof layer.left === 'undefined') {
		layer.left = 0;
	}

	if (typeof layer.right === 'undefined') {
		layer.right = canvas ? canvas.width + layer.left : layer.left;
	}

	if (typeof layer.bottom === 'undefined') {
		layer.bottom = canvas ? canvas.height + layer.top : layer.top;
	}

	if (layer.right < layer.left) {
		layer.right = layer.left;
	}

	if (layer.bottom < layer.top) {
		layer.bottom = layer.top;
	}

	const result: ChannelData[] = [
		{
			channelId: ChannelID.Transparency,
			compression: Compression.RawData,
			buffer: undefined,
			length: 2,
		}
	];

	if (!canvas)
		return result;

	let layerWidth = layer.right - layer.left;
	let layerHeight = layer.bottom - layer.top;

	if (options.trimImageData) {
		layerWidth = Math.min(layerWidth, canvas.width);
		layerHeight = Math.min(layerHeight, canvas.height);
	} else if (layerWidth > canvas.width || layerHeight > canvas.height) {
		canvas = createCanvas(layerWidth, layerHeight);
		canvas.getContext('2d')!.drawImage(layer.canvas!, 0, 0);
	}

	if (!layerWidth || !layerHeight)
		return result;

	layer.right = layer.left + layerWidth;
	layer.bottom = layer.top + layerHeight;

	const context = canvas.getContext('2d')!;
	let data = context.getImageData(0, 0, layerWidth, layerHeight);

	if (options.trimImageData) {
		const { left, top, right, bottom } = trimData(data);

		if (left !== 0 || top !== 0 || right !== data.width || bottom !== data.height) {
			layer.left += left;
			layer.top += top;
			layer.right -= (data.width - right);
			layer.bottom -= (data.height - bottom);
			layerWidth = layer.right - layer.left;
			layerHeight = layer.bottom - layer.top;

			if (!layerWidth || !layerHeight)
				return result;

			data = context.getImageData(left, top, layerWidth, layerHeight);
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
		const buffer = writeDataRLE(data, layerWidth, layerHeight, [offset])!;

		return {
			channelId: channel,
			compression: Compression.RleCompressed,
			buffer: buffer,
			length: 2 + buffer.length,
		};
	});
}

export function resetCanvas(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let p = 0; p < size;) {
		data.data[p++] = 0;
		data.data[p++] = 0;
		data.data[p++] = 0;
		data.data[p++] = 255;
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

// TODO: use scratch buffer (max possible size -> .slice(0, offset))
export function writeDataRLE({ data }: PixelData, width: number, height: number, offsets: number[]) {
	if (!width || !height)
		return undefined;

	const stride = (4 * width) | 0;
	const channels: { lines: number[][]; offset: number; }[] = [];
	let totalLength = 0;

	const lengthsBuffer = new Uint8Array(offsets.length * height * 2);
	let o = 0;

	for (let i = 0; i < offsets.length; i++) {
		const lines: number[][] = [];
		const offset = offsets[i];

		for (let y = 0, p = offset | 0; y < height; y++ , p = (p + stride) | 0) {
			const line: number[] = [];
			let length = 0;
			let last2 = -1;
			let last = data[p];
			let count = 1;
			let same = false;

			for (let x = 4 | 0; x < stride; x = (x + 4) | 0) {
				let v = data[p + x];

				if (count === 2) {
					same = last === v && last2 === v;
				}

				if (same && last !== v) {
					length += 2;
					line.push(count);
					count = 0;
					same = false;
				} else if (!same && count > 2 && v === last && v === last2) {
					length += count - 1;
					line.push(count - 2);
					count = 2;
					same = true;
				} else if (count === 128) {
					length += same ? 2 : count + 1;
					line.push(count);
					count = 0;
					same = false;
				}

				last2 = last;
				last = v;
				count++;
			}

			length += same ? 2 : 1 + count;

			line.push(count);
			lines.push(line);

			lengthsBuffer[o++] = (length >> 8) & 0xff;
			lengthsBuffer[o++] = length & 0xff;

			totalLength += 2 + length;
		}

		channels.push({ lines, offset });
	}

	const buffer = new Uint8Array(totalLength);
	buffer.set(lengthsBuffer);

	for (const { offset, lines } of channels) {
		for (let y = 0, p = offset | 0; y < height; y++ , p = (p + stride) | 0) {
			const line = lines[y];
			let x = 0;

			for (let i = 0; i < line.length; i++) {
				const idx = (p + x * 4) | 0;
				const v = data[idx];
				const same = line[i] > 2 && v === data[(idx + 4) | 0] && v === data[(idx + 8) | 0];

				if (same) {
					buffer[o++] = 1 - line[i];
					buffer[o++] = v;
				} else {
					buffer[o++] = line[i] - 1;

					for (let j = 0; j < line[i]; j++) {
						buffer[o++] = data[(idx + j * 4) | 0];
					}
				}

				x += line[i];
			}
		}
	}

	return buffer;
}

export function readDataRLE(reader: PsdReader, pixelData: PixelData | undefined, step: number, _width: number, height: number, offsets: number[]) {
	const lengths: number[][] = [];

	for (let c = 0; c < offsets.length; c++) {
		lengths[c] = [];

		for (let y = 0; y < height; y++) {
			lengths[c][y] = readUint16(reader);
		}
	}

	const data = pixelData && pixelData.data;

	for (let c = 0; c < offsets.length; c++) {
		const channelLengths = lengths[c];
		const extra = c > 3 || offsets[c] > 3;
		const readData = !!data && !extra;
		let p = offsets[c] | 0;

		for (let y = 0; y < height; y++) {
			const length = channelLengths[y];
			const buffer = readBytes(reader, length);

			for (let i = 0; i < length; i++) {
				let header = buffer[i];

				if (header >= 128) {
					const value = buffer[++i];
					header = 256 - header;

					if (readData) {
						for (let j = 0; j <= header; j++) {
							data![p] = value;
							p = (p + step) | 0;
						}
					} else {
						for (let j = 0; j <= header; j++) {
							p = (p + step) | 0;
						}
					}
				} else { // header < 128
					if (readData) {
						for (let j = 0; j <= header; j++) {
							i++;
							data![p] = buffer[i];
							p = (p + step) | 0;
						}
					} else {
						for (let j = 0; j <= header; j++) {
							i++;
							p = (p + step) | 0;
						}
					}
				}

				/* istanbul ignore if */
				if (i >= length) {
					throw new Error(`Exceeded buffer size ${i}/${length}`);
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
