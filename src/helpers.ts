import { PsdReader, readBytes, readUint16 } from './psdReader';
import { Layer, ChannelID, Compression } from './psd';
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

	for (let i = 0; i < value.length; i++)
		result[i] = value[i];

	return result;
}

export function readColor(reader: PsdReader) {
	return toArray(readBytes(reader, 10));
}

export function hasAlpha(data: PixelData) {
	const size = data.width * data.height;

	for (let i = 0; i < size; i++) {
		if (data.data[i * 4 + 3] !== 255)
			return true;
	}

	return false;
}

function trimData(data: PixelData) {
	let top = 0;
	let left = 0;
	let right = data.width;
	let bottom = data.height;

	function isEmpty(x: number, y: number) {
		return data.data[(y * data.width + x) * 4 + 3] === 0;
	}

	function isRowEmpty(y: number) {
		for (let x = left; x < right; x++) {
			if (!isEmpty(x, y))
				return false;
		}
		return true;
	}

	function isColEmpty(x: number) {
		for (let y = top; y < bottom; y++) {
			if (!isEmpty(x, y))
				return false;
		}
		return true;
	}

	while (top < bottom && isRowEmpty(top))
		top++;
	while (bottom > top && isRowEmpty(bottom - 1))
		bottom--;
	while (left < right && isColEmpty(left))
		left++;
	while (right > left && isColEmpty(right - 1))
		right--;

	return { top, left, right, bottom };
}

export function getChannels(layer: Layer, background: boolean) {
	if (typeof layer.top === 'undefined') layer.top = 0;
	if (typeof layer.left === 'undefined') layer.left = 0;
	if (typeof layer.right === 'undefined') layer.right = layer.canvas ? layer.canvas.width : layer.left;
	if (typeof layer.bottom === 'undefined') layer.bottom = layer.canvas ? layer.canvas.height : layer.top;

	const canvas = layer.canvas;
	let layerWidth = layer.right - layer.left;
	let layerHeight = layer.bottom - layer.top;
	let result: ChannelData[] = [{
		channelId: ChannelID.Transparency,
		compression: Compression.RawData,
		buffer: undefined,
		length: 2,
	}];

	if (!canvas || !layerWidth || !layerHeight)
		return result;

	const context = canvas.getContext('2d')!;
	let data = context.getImageData(layer.left, layer.top, layerWidth, layerHeight);
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

		data = context.getImageData(layer.left, layer.top, layerWidth, layerHeight);
	}

	result = [];

	const channels = [
		ChannelID.Red,
		ChannelID.Green,
		ChannelID.Blue,
	];

	if (!background || layerWidth !== canvas.width || layerHeight !== canvas.height || hasAlpha(data))
		channels.unshift(ChannelID.Transparency);

	for (let channel of channels) {
		const offset = offsetForChannel(channel);
		const buffer = writeDataRLE(data, layerWidth, layerHeight, [offset])!;

		result.push({
			channelId: channel,
			compression: Compression.RleCompressed,
			buffer: buffer,
			length: 2 + buffer.length,
		});
	}

	return result;
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

	for (let i = 0; i < array.length; i++)
		array[i] = data.data[i * 4 + offset];

	return array;
}

export function readDataRaw(reader: PsdReader, data: PixelData | undefined, offset: number, width: number, height: number) {
	const size = width * height;
	const buffer = readBytes(reader, size);

	if (data && offset < 4) {
		for (let i = 0; i < size; i++) {
			data.data[i * 4 + offset] = buffer[i];
		}
	}
}

export function writeDataRLE(imageData: PixelData, width: number, height: number, offsets: number[]) {
	if (!width || !height)
		return undefined;

	const data = imageData.data;
	const channels: { lengths: number[]; lines: number[][]; offset: number; }[] = [];
	let totalLength = 0;

	for (let i = 0; i < offsets.length; i++) {
		const lengths: number[] = [];
		const lines: number[][] = [];
		const offset = offsets[i];

		for (let y = 0, p = 0; y < height; y++ , p += width) {
			const line: number[] = [];
			let length = 0;
			let last2 = -1;
			let last = data[p * 4 + offset];
			let count = 1;
			let same = false;

			for (let x = 1; x < width; x++) {
				let v = data[(p + x) * 4 + offset];

				if (count === 2)
					same = last === v && last2 === v;

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
			lengths.push(length);
			totalLength += 2 + length;
		}

		channels.push({ lengths, lines, offset });
	}

	const buffer = new Uint8Array(totalLength);
	let o = 0;

	for (let channel of channels) {
		for (let length of channel.lengths) {
			buffer[o++] = (length >> 8) & 0xff;
			buffer[o++] = length & 0xff;
		}
	}

	for (let channel of channels) {
		for (let y = 0, p = 0; y < height; y++ , p += width) {
			const line = channel.lines[y];
			const offset = channel.offset;
			let x = 0;

			for (let i = 0; i < line.length; i++) {
				const v = data[(p + x) * 4 + offset];
				const same = line[i] > 2 && v === data[(p + x + 1) * 4 + offset] && v === data[(p + x + 2) * 4 + offset];

				if (same) {
					buffer[o++] = 1 - line[i];
					buffer[o++] = v;
				} else {
					buffer[o++] = line[i] - 1;

					for (let j = 0; j < line[i]; j++)
						buffer[o++] = data[(p + x + j) * 4 + offset];
				}

				x += line[i];
			}
		}
	}

	return buffer;
}

export function readDataRLE(reader: PsdReader, data: PixelData | undefined, step: number, _width: number, height: number, offsets: number[]) {
	const lengths: number[][] = [];

	for (let c = 0; c < offsets.length; c++) {
		lengths[c] = [];

		for (let y = 0; y < height; y++) {
			lengths[c][y] = readUint16(reader);
		}
	}

	for (let c = 0; c < offsets.length; c++) {
		const channelLengths = lengths[c];
		const extra = c > 3 || offsets[c] > 3;
		let p = offsets[c];

		for (let y = 0; y < height; y++) {
			const length = channelLengths[y];
			const buffer = readBytes(reader, length);

			for (let i = 0; i < length; i++) {
				let header = buffer[i];

				if (header >= 128) {
					const value = buffer[++i];
					header = 256 - header;

					for (let j = 0; j <= header; j++) {
						if (data && !extra) {
							data.data[p] = value;
						}

						p += step;
					}
				} else if (header < 128) {
					for (let j = 0; j <= header; j++) {
						i++;

						if (data && !extra) {
							data.data[p] = buffer[i];
						}

						p += step;
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

export let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};

export let createCanvasFromData: (data: Uint8Array) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
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
) {
	createCanvas = createCanvasMethod;
	createCanvasFromData = createCanvasFromDataMethod || createCanvasFromData;
}
