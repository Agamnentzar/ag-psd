import { Psd, Layer, ColorMode, SectionDividerType, LayerAdditionalInfo, ReadOptions, LayerMaskData, Color, PatternInfo } from './psd';
import {
	resetImageData, offsetForChannel, decodeBitmap, PixelData, createCanvas, createImageData,
	toBlendMode, ChannelID, Compression, LayerMaskFlags, MaskParams, ColorSpace
} from './helpers';
import { infoHandlersMap } from './additionalInfo';
import { resourceHandlersMap } from './imageResources';
import { readVersionAndDescriptor } from './descriptor';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

export const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB];
const colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];

const RAW_IMAGE_DATA = false;

function setupGrayscale(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let i = 0; i < size; i += 4) {
		data.data[i + 1] = data.data[i];
		data.data[i + 2] = data.data[i];
	}
}

export interface PsdReader {
	offset: number;
	view: DataView;
}

export function createReader(buffer: ArrayBuffer, offset?: number, length?: number): PsdReader {
	const view = new DataView(buffer, offset, length);
	return { view, offset: 0 };
}

export function readUint8(reader: PsdReader) {
	reader.offset += 1;
	return reader.view.getUint8(reader.offset - 1);
}

export function peekUint8(reader: PsdReader) {
	return reader.view.getUint8(reader.offset);
}

export function readInt16(reader: PsdReader) {
	reader.offset += 2;
	return reader.view.getInt16(reader.offset - 2, false);
}

export function readUint16(reader: PsdReader) {
	reader.offset += 2;
	return reader.view.getUint16(reader.offset - 2, false);
}

export function readInt32(reader: PsdReader) {
	reader.offset += 4;
	return reader.view.getInt32(reader.offset - 4, false);
}

export function readInt32LE(reader: PsdReader) {
	reader.offset += 4;
	return reader.view.getInt32(reader.offset - 4, true);
}

export function readUint32(reader: PsdReader) {
	reader.offset += 4;
	return reader.view.getUint32(reader.offset - 4, false);
}

export function readFloat32(reader: PsdReader) {
	reader.offset += 4;
	return reader.view.getFloat32(reader.offset - 4, false);
}

export function readFloat64(reader: PsdReader) {
	reader.offset += 8;
	return reader.view.getFloat64(reader.offset - 8, false);
}

// 32-bit fixed-point number 16.16
export function readFixedPoint32(reader: PsdReader): number {
	return readInt32(reader) / (1 << 16);
}

// 32-bit fixed-point number 8.24
export function readFixedPointPath32(reader: PsdReader): number {
	return readInt32(reader) / (1 << 24);
}

export function readBytes(reader: PsdReader, length: number) {
	reader.offset += length;
	return new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset - length, length);
}

export function readSignature(reader: PsdReader) {
	return readShortString(reader, 4);
}

export function readPascalString(reader: PsdReader, padTo: number) {
	let length = readUint8(reader);
	const text = readShortString(reader, length);

	while (++length % padTo) {
		skipBytes(reader, 1);
	}

	return text;
}

export function readUnicodeString(reader: PsdReader) {
	const length = readUint32(reader);
	return readUnicodeStringWithLength(reader, length);
}

export function readUnicodeStringWithLength(reader: PsdReader, length: number) {
	let text = '';

	while (length--) {
		const value = readUint16(reader);

		if (value || length > 0) { // remove trailing \0
			text += String.fromCharCode(value);
		}
	}

	return text;
}

export function readAsciiString(reader: PsdReader, length: number) {
	let text = '';

	while (length--) {
		text += String.fromCharCode(readUint8(reader));
	}

	return text;
}

export function skipBytes(reader: PsdReader, count: number) {
	reader.offset += count;
}

export function checkSignature(reader: PsdReader, a: string, b?: string) {
	const offset = reader.offset;
	const signature = readSignature(reader);

	if (signature !== a && signature !== b) {
		throw new Error(`Invalid signature: '${signature}' at 0x${offset.toString(16)}`);
	}
}

function readShortString(reader: PsdReader, length: number) {
	const buffer: any = readBytes(reader, length);
	return String.fromCharCode(...buffer);
}

export function readPsd(reader: PsdReader, options: ReadOptions = {}) {
	// header
	checkSignature(reader, '8BPS');
	const version = readUint16(reader);
	if (version !== 1) throw new Error(`Invalid PSD file version: ${version}`);

	skipBytes(reader, 6);
	const channels = readUint16(reader);
	const height = readUint32(reader);
	const width = readUint32(reader);
	const bitsPerChannel = readUint16(reader);
	const colorMode = readUint16(reader);

	if (supportedColorModes.indexOf(colorMode) === -1)
		throw new Error(`Color mode not supported: ${colorModes[colorMode] ?? colorMode}`);

	const psd: Psd = { width, height, channels, bitsPerChannel, colorMode };

	// color mode data
	readSection(reader, 1, left => {
		if (options.throwForMissingFeatures) throw new Error('Color mode data not supported');
		skipBytes(reader, left());
	});

	// image resources
	readSection(reader, 1, left => {
		while (left()) {
			checkSignature(reader, '8BIM');

			const id = readUint16(reader);
			readPascalString(reader, 2); // name

			readSection(reader, 2, left => {
				const handler = resourceHandlersMap[id];
				const skip = id === 1036 && !!options.skipThumbnail;

				if (!psd.imageResources) {
					psd.imageResources = {};
				}

				if (handler && !skip) {
					try {
						handler.read(reader, psd.imageResources, left, options);
					} catch (e) {
						if (options.throwForMissingFeatures) throw e;
						skipBytes(reader, left());
					}
				} else {
					// console.log(`Unhandled image resource: ${id}`);
					skipBytes(reader, left());
				}
			});
		}
	});

	// layer and mask info
	let globalAlpha = false;

	readSection(reader, 1, left => {
		globalAlpha = readLayerInfo(reader, psd, options);

		// SAI does not include this section
		if (left() > 0) {
			readGlobalLayerMaskInfo(reader);
		} else {
			// revert back to end of section if exceeded section limits
			// options.logMissingFeatures && console.log('reverting to end of section');
			skipBytes(reader, left());
		}

		while (left() > 0) {
			// sometimes there are empty bytes here
			while (left() && peekUint8(reader) === 0) {
				// options.logMissingFeatures && console.log('skipping 0 byte');
				skipBytes(reader, 1);
			}

			if (left() >= 12) {
				readAdditionalLayerInfo(reader, psd, psd, options);
			} else {
				// options.logMissingFeatures && console.log('skipping leftover bytes', left());
				skipBytes(reader, left());
			}
		}
	});

	const hasChildren = psd.children && psd.children.length;
	const skipComposite = options.skipCompositeImageData && (options.skipLayerImageData || hasChildren);

	if (!skipComposite) {
		readImageData(reader, psd, globalAlpha, options);
	}

	return psd;
}

function readLayerInfo(reader: PsdReader, psd: Psd, options: ReadOptions) {
	let globalAlpha = false;

	readSection(reader, 2, left => {
		let layerCount = readInt16(reader);

		if (layerCount < 0) {
			globalAlpha = true;
			layerCount = -layerCount;
		}

		const layers: Layer[] = [];
		const layerChannels: ChannelInfo[][] = [];

		for (let i = 0; i < layerCount; i++) {
			const { layer, channels } = readLayerRecord(reader, psd, options);
			layers.push(layer);
			layerChannels.push(channels);
		}

		if (!options.skipLayerImageData) {
			for (let i = 0; i < layerCount; i++) {
				readLayerChannelImageData(reader, psd, layers[i], layerChannels[i], options);
			}
		}

		skipBytes(reader, left());

		if (!psd.children) {
			psd.children = [];
		}

		const stack: (Layer | Psd)[] = [psd];

		for (let i = layers.length - 1; i >= 0; i--) {
			const l = layers[i];
			const type = l.sectionDivider ? l.sectionDivider.type : SectionDividerType.Other;

			if (type === SectionDividerType.OpenFolder || type === SectionDividerType.ClosedFolder) {
				l.opened = type === SectionDividerType.OpenFolder;
				l.children = [];
				stack[stack.length - 1].children!.unshift(l);
				stack.push(l);
			} else if (type === SectionDividerType.BoundingSectionDivider) {
				stack.pop();
			} else {
				stack[stack.length - 1].children!.unshift(l);
			}
		}
	});

	return globalAlpha;
}

function readLayerRecord(reader: PsdReader, psd: Psd, options: ReadOptions) {
	const layer: Layer = {};
	layer.top = readInt32(reader);
	layer.left = readInt32(reader);
	layer.bottom = readInt32(reader);
	layer.right = readInt32(reader);

	const channelCount = readUint16(reader);
	const channels: ChannelInfo[] = [];

	for (let i = 0; i < channelCount; i++) {
		const channelID = readInt16(reader) as ChannelID;
		const channelLength = readInt32(reader);
		channels.push({ id: channelID, length: channelLength });
	}

	checkSignature(reader, '8BIM');
	const blendMode = readSignature(reader);
	if (!toBlendMode[blendMode]) throw new Error(`Invalid blend mode: '${blendMode}'`);
	layer.blendMode = toBlendMode[blendMode];

	layer.opacity = readUint8(reader) / 0xff;
	layer.clipping = readUint8(reader) === 1;

	const flags = readUint8(reader);
	layer.transparencyProtected = (flags & 0x01) !== 0;
	layer.hidden = (flags & 0x02) !== 0;

	skipBytes(reader, 1);

	readSection(reader, 1, left => {
		const mask = readLayerMaskData(reader, options);

		if (mask) layer.mask = mask;

		/*const blendingRanges =*/ readLayerBlendingRanges(reader);
		layer.name = readPascalString(reader, 4);

		while (left()) {
			readAdditionalLayerInfo(reader, layer, psd, options);
		}
	});

	return { layer, channels };
}

function readLayerMaskData(reader: PsdReader, options: ReadOptions) {
	return readSection<LayerMaskData | undefined>(reader, 1, left => {
		if (!left()) return undefined;

		const mask: LayerMaskData = {};
		mask.top = readInt32(reader);
		mask.left = readInt32(reader);
		mask.bottom = readInt32(reader);
		mask.right = readInt32(reader);
		mask.defaultColor = readUint8(reader);

		const flags = readUint8(reader);
		mask.positionRelativeToLayer = (flags & LayerMaskFlags.PositionRelativeToLayer) !== 0;
		mask.disabled = (flags & LayerMaskFlags.LayerMaskDisabled) !== 0;

		if (flags & LayerMaskFlags.MaskHasParametersAppliedToIt) {
			const params = readUint8(reader);
			if (params & MaskParams.UserMaskDensity) mask.userMaskDensity = readUint8(reader) / 0xff;
			if (params & MaskParams.UserMaskFeather) mask.userMaskFeather = readFloat64(reader);
			if (params & MaskParams.VectorMaskDensity) mask.vectorMaskDensity = readUint8(reader) / 0xff;
			if (params & MaskParams.VectorMaskFeather) mask.vectorMaskFeather = readFloat64(reader);
		}

		if (left() > 2) {
			options.logMissingFeatures && console.log('Unhandled extra mask params');
			// TODO: handle these values
			/*const realFlags =*/ readUint8(reader);
			/*const realUserMaskBackground =*/ readUint8(reader);
			/*const top2 =*/ readInt32(reader);
			/*const left2 =*/ readInt32(reader);
			/*const bottom2 =*/ readInt32(reader);
			/*const right2 =*/ readInt32(reader);
		}

		skipBytes(reader, left());
		return mask;
	});
}

function readLayerBlendingRanges(reader: PsdReader) {
	return readSection(reader, 1, left => {
		const compositeGrayBlendSource = readUint32(reader);
		const compositeGraphBlendDestinationRange = readUint32(reader);
		const ranges = [];

		while (left()) {
			const sourceRange = readUint32(reader);
			const destRange = readUint32(reader);
			ranges.push({ sourceRange, destRange });
		}

		return { compositeGrayBlendSource, compositeGraphBlendDestinationRange, ranges };
	});
}

function readLayerChannelImageData(reader: PsdReader, psd: Psd, layer: Layer, channels: ChannelInfo[], options: ReadOptions) {
	const layerWidth = (layer.right || 0) - (layer.left || 0);
	const layerHeight = (layer.bottom || 0) - (layer.top || 0);

	let imageData: ImageData | undefined;

	if (layerWidth && layerHeight) {
		imageData = createImageData(layerWidth, layerHeight);
		resetImageData(imageData);
	}

	if (RAW_IMAGE_DATA) {
		(layer as any).imageDataRaw = [];
	}

	for (const channel of channels) {
		const compression = readUint16(reader) as Compression;

		if (channel.id === ChannelID.UserMask) {
			const mask = layer.mask;

			if (!mask) throw new Error(`Missing layer mask data`);

			const maskWidth = (mask.right || 0) - (mask.left || 0);
			const maskHeight = (mask.bottom || 0) - (mask.top || 0);

			if (maskWidth && maskHeight) {
				const maskData = createImageData(maskWidth, maskHeight);
				resetImageData(maskData);
				readData(reader, maskData, compression, maskWidth, maskHeight, 0);
				setupGrayscale(maskData);

				if (options.useImageData) {
					mask.imageData = maskData;
				} else {
					mask.canvas = createCanvas(maskWidth, maskHeight);
					mask.canvas.getContext('2d')!.putImageData(maskData, 0, 0);
				}
			}
		} else {
			const offset = offsetForChannel(channel.id);
			let targetData = imageData;

			if (offset < 0) {
				targetData = undefined;

				if (options.throwForMissingFeatures) {
					throw new Error(`Channel not supported: ${channel.id}`);
				}
			}

			const start = reader.offset;
			readData(reader, targetData, compression, layerWidth, layerHeight, offset);

			if (RAW_IMAGE_DATA) {
				(layer as any).imageDataRaw[channel.id] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}

			if (targetData && psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(targetData);
			}
		}
	}

	if (imageData) {
		if (options.useImageData) {
			layer.imageData = imageData;
		} else {
			layer.canvas = createCanvas(layerWidth, layerHeight);
			layer.canvas.getContext('2d')!.putImageData(imageData, 0, 0);
		}
	}
}

function readData(
	reader: PsdReader, data: ImageData | undefined, compression: Compression, width: number, height: number,
	offset: number
) {
	if (compression === Compression.RawData) {
		readDataRaw(reader, data, offset, width, height);
	} else if (compression === Compression.RleCompressed) {
		readDataRLE(reader, data, width, height, 4, [offset]);
	} else {
		throw new Error(`Compression type not supported: ${compression}`);
	}
}

function readGlobalLayerMaskInfo(reader: PsdReader) {
	return readSection(reader, 1, left => {
		if (left()) {
			const overlayColorSpace = readUint16(reader);
			const colorSpace1 = readUint16(reader);
			const colorSpace2 = readUint16(reader);
			const colorSpace3 = readUint16(reader);
			const colorSpace4 = readUint16(reader);
			const opacity = readUint16(reader) / 0xff;
			const kind = readUint8(reader);
			skipBytes(reader, left());
			return { overlayColorSpace, colorSpace1, colorSpace2, colorSpace3, colorSpace4, opacity, kind };
		}
	});
}

function readAdditionalLayerInfo(reader: PsdReader, target: LayerAdditionalInfo, psd: Psd, options: ReadOptions) {
	checkSignature(reader, '8BIM', '8B64');
	const key = readSignature(reader);

	readSection(reader, 2, left => {
		const handler = infoHandlersMap[key];

		if (handler) {
			try {
				handler.read(reader, target, left, psd, options);
			} catch (e) {
				if (options.throwForMissingFeatures) throw e;
			}
		} else {
			options.logMissingFeatures && console.log(`Unhandled additional info: ${key}`);
			skipBytes(reader, left());
		}

		if (left()) {
			options.logMissingFeatures && console.log(`Unread ${left()} bytes left for tag: ${key}`);
			skipBytes(reader, left());
		}
	}, false);
}

function readImageData(reader: PsdReader, psd: Psd, globalAlpha: boolean, options: ReadOptions) {
	const compression = readUint16(reader) as Compression;

	if (supportedColorModes.indexOf(psd.colorMode!) === -1)
		throw new Error(`Color mode not supported: ${psd.colorMode}`);

	if (compression !== Compression.RawData && compression !== Compression.RleCompressed)
		throw new Error(`Compression type not supported: ${compression}`);

	const imageData = createImageData(psd.width, psd.height);
	resetImageData(imageData);

	if (psd.colorMode === ColorMode.Bitmap) {
		let bytes: Uint8Array;

		if (compression === Compression.RawData) {
			bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
		} else if (compression === Compression.RleCompressed) {
			bytes = new Uint8Array(psd.width * psd.height);
			readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 1, [0]);
		} else {
			throw new Error(`Bitmap compression not supported: ${compression}`);
		}

		decodeBitmap(bytes, imageData.data, psd.width, psd.height);
	} else {
		const channels = psd.colorMode === ColorMode.Grayscale ? [0] : [0, 1, 2];

		if (psd.channels && psd.channels > 3) {
			for (let i = 3; i < psd.channels; i++) {
				// TODO: store these channels in additional image data
				channels.push(i);
			}
		} else if (globalAlpha) {
			channels.push(3);
		}

		if (compression === Compression.RawData) {
			for (let i = 0; i < channels.length; i++) {
				readDataRaw(reader, imageData, channels[i], psd.width, psd.height);
			}
		} else if (compression === Compression.RleCompressed) {
			const start = reader.offset;
			readDataRLE(reader, imageData, psd.width, psd.height, 4, channels);

			if (RAW_IMAGE_DATA) {
				(psd as any).imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}
		}

		if (psd.colorMode === ColorMode.Grayscale) {
			setupGrayscale(imageData);
		}
	}

	if (options.useImageData) {
		psd.imageData = imageData;
	} else {
		psd.canvas = createCanvas(psd.width, psd.height);
		psd.canvas.getContext('2d')!.putImageData(imageData, 0, 0);
	}
}

function readDataRaw(reader: PsdReader, pixelData: PixelData | undefined, offset: number, width: number, height: number) {
	const size = width * height;
	const buffer = readBytes(reader, size);

	if (pixelData && offset < 4) {
		const data = pixelData.data;

		for (let i = 0, p = offset | 0; i < size; i++, p = (p + 4) | 0) {
			data[p] = buffer[i];
		}
	}
}

export function readDataRLE(
	reader: PsdReader, pixelData: PixelData | undefined, _width: number, height: number, step: number, offsets: number[]
) {
	const lengths = new Uint16Array(offsets.length * height);
	const data = pixelData && pixelData.data;

	for (let o = 0, li = 0; o < offsets.length; o++) {
		for (let y = 0; y < height; y++, li++) {
			lengths[li] = readUint16(reader);
		}
	}

	for (let c = 0, li = 0; c < offsets.length; c++) {
		const offset = offsets[c] | 0;
		const extra = c > 3 || offset > 3;

		if (!data || extra) {
			for (let y = 0; y < height; y++, li++) {
				skipBytes(reader, lengths[li]);
			}
		} else {
			for (let y = 0, p = offset | 0; y < height; y++, li++) {
				const length = lengths[li];
				const buffer = readBytes(reader, length);

				for (let i = 0; i < length; i++) {
					let header = buffer[i];

					if (header > 128) {
						const value = buffer[++i];
						header = (256 - header) | 0;

						for (let j = 0; j <= header; j = (j + 1) | 0) {
							data[p] = value;
							p = (p + step) | 0;
						}
					} else if (header < 128) {
						for (let j = 0; j <= header; j = (j + 1) | 0) {
							data[p] = buffer[++i];
							p = (p + step) | 0;
						}
					} else {
						// ignore 128
					}

					if (i >= length) {
						throw new Error(`Invalid RLE data: exceeded buffer size ${i}/${length}`);
					}
				}
			}
		}
	}
}

export function readSection<T>(reader: PsdReader, round: number, func: (left: () => number) => T, skipEmpty = true): T | undefined {
	const length = readInt32(reader);

	if (length <= 0 && skipEmpty) return undefined;

	let end = reader.offset + length;
	const result = func(() => end - reader.offset);

	if (reader.offset > end)
		throw new Error('Exceeded section limits');

	if (reader.offset !== end)
		throw new Error(`Unread section data: ${end - reader.offset} bytes at 0x${reader.offset.toString(16)}`);

	while (end % round) end++;

	reader.offset = end;
	return result;
}

export function readColor(reader: PsdReader): Color {
	const colorSpace = readUint16(reader) as ColorSpace;

	switch (colorSpace) {
		case ColorSpace.RGB: {
			const r = readUint16(reader) / 257;
			const g = readUint16(reader) / 257;
			const b = readUint16(reader) / 257;
			skipBytes(reader, 2);
			return { r, g, b };
		}
		case ColorSpace.Lab: {
			const l = readInt16(reader) / 100;
			const a = readInt16(reader) / 100;
			const b = readInt16(reader) / 100;
			skipBytes(reader, 2);
			return { l, a, b };
		}
		case ColorSpace.CMYK: {
			const c = readInt16(reader);
			const m = readInt16(reader);
			const y = readInt16(reader);
			const k = readInt16(reader);
			return { c, m, y, k };
		}
		case ColorSpace.Grayscale: {
			const k = readInt16(reader);
			skipBytes(reader, 6);
			return { k };
		}
		case ColorSpace.HSB: {
			const h = readInt16(reader);
			const s = readInt16(reader);
			const b = readInt16(reader);
			skipBytes(reader, 2);
			return { h, s, b };
		}
		default:
			throw new Error('Invalid color space');
	}
}

export function readAbr(buffer: ArrayBufferView) {
	const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const version = readInt16(reader);
	const brushes: any[] = [];

	if (version === 1 || version === 2) {
		throw new Error('not implemented (version 1/2)'); // TODO: ...
	} else if (version === 6 || version === 7 || version === 10) {
		const minorVersion = readInt16(reader);
		if (minorVersion !== 1 && minorVersion !== 2) throw new Error('Unsupported ABR version');

		while (reader.offset < reader.view.byteLength) {
			// console.log('left', reader.view.byteLength - reader.offset, 'at', reader.offset.toString(16));
			checkSignature(reader, '8BIM');
			const type = readSignature(reader); // samp | desc | patt | phry
			const size = readUint32(reader);
			const end = reader.offset + size;

			switch (type) {
				case 'samp': {
					while (reader.offset < end) {
						let brushLength = readUint32(reader);
						while (brushLength & 0b11) brushLength++; // pad to 4 byte alignment
						const brushEnd = reader.offset + brushLength;

						const id = readPascalString(reader, 1);

						// v1 - Skip the Int16 bounds rectangle and the unknown Int16.
						// v2 - Skip the unknown bytes.
						skipBytes(reader, minorVersion === 1 ? 10 : 264);

						const y = readInt32(reader);
						const x = readInt32(reader);
						const h = readInt32(reader) - y;
						const w = readInt32(reader) - x;
						if (w <= 0 || h <= 0) throw new Error('Invalid bounds');

						const depth = readInt16(reader);
						const compression = readUint8(reader); // 0 - raw, 1 - RLE
						const alpha = new Uint8Array(w * h);

						if (depth === 8) {
							if (compression === 0) {
								alpha.set(readBytes(reader, alpha.byteLength));
							} else if (compression === 1) {
								readDataRLE(reader, { width: w, height: h, data: alpha }, w, h, 1, [0]);
							} else {
								throw new Error('Invalid compression');
							}
						} else if (depth === 16) {
							if (compression === 0) {
								for (let i = 0; i < alpha.byteLength; i++) {
									alpha[i] = readUint16(reader) >> 8; // convert to 8bit values
								}
							} else if (compression === 1) {
								throw new Error('not implemented (16bit RLE)'); // TODO: ...
							} else {
								throw new Error('Invalid compression');
							}
						} else {
							throw new Error('Invalid depth');
						}

						brushes.push({ id, bounds: { x, y, w, h }, alpha });
						reader.offset = brushEnd;
					}
					break;
				}
				case 'desc': {
					brushes.push(readVersionAndDescriptor(reader));
					break;
				}
				case 'patt': {
					const pattern = readPattern(reader);
					brushes.push({ pattern });
					console.log('skipping `patt`');
					reader.offset = end;
					break;
				}
				case 'phry': {
					brushes.push(readVersionAndDescriptor(reader));
					break;
				}
				default:
					throw new Error(`Invalid brush type: ${type}`);
			}
		}
	} else {
		throw new Error('Unsupported ABR version');
	}

	return brushes;
}

export function readPattern(reader: PsdReader): PatternInfo {
	readUint32(reader); // length
	const version = readUint32(reader);
	if (version !== 1) throw new Error(`Invalid Patt version: ${version}`);

	const colorMode = readUint32(reader) as ColorMode;
	const x = readInt16(reader);
	const y = readInt16(reader);

	if (supportedColorModes.indexOf(colorMode) === -1)
		throw new Error(`Invalid Patt color mode: ${colorMode}`);

	const name = readUnicodeString(reader);
	const id = readPascalString(reader, 1);

	// TODO: index color table here (only for indexed color mode, not supported right now)

	// virtual memory array list
	const version2 = readUint32(reader);
	if (version2 !== 3) throw new Error(`Invalid Patt:VMAL version: ${version2}`);

	readUint32(reader); // length
	const top = readUint32(reader);
	const left = readUint32(reader);
	const bottom = readUint32(reader);
	const right = readUint32(reader);
	const channelsCount = readUint32(reader);
	const bounds = { x: left, y: top, w: right - left, h: bottom - top };
	const channels: any[] = [];

	for (let i = 0; i < (channelsCount + 2); i++) {
		const has = readUint32(reader);

		if (has) {
			const length = readUint32(reader);
			const pixelDepth = readUint32(reader);
			const top = readUint32(reader);
			const left = readUint32(reader);
			const bottom = readUint32(reader);
			const right = readUint32(reader);
			const pixelDepth2 = readUint16(reader);
			const compressionMode = readUint8(reader); // 0 - raw, 1 - zip
			const dataLength = length - (4 + 16 + 2 + 1);
			const data = readBytes(reader, dataLength);

			if (pixelDepth !== 8 || pixelDepth2 !== 8) throw new Error('16bit pixel depth not supported in palettes');
			if (compressionMode !== 0) throw new Error('zip compression not supported in palettes');

			channels.push({ top, left, bottom, right, data });
		}
	}

	return { name, id, colorMode, x, y, bounds, channels } as any;
}
