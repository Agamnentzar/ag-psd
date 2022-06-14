import {
	Psd, Layer, ColorMode, SectionDividerType, LayerAdditionalInfo, ReadOptions, LayerMaskData, Color,
	PatternInfo, GlobalLayerMaskInfo, RGB
} from './psd';
import {
	resetImageData, offsetForChannel, decodeBitmap, PixelData, createCanvas, createImageData,
	toBlendMode, ChannelID, Compression, LayerMaskFlags, MaskParams, ColorSpace, RAW_IMAGE_DATA, largeAdditionalInfoKeys
} from './helpers';
import { infoHandlersMap } from './additionalInfo';
import { resourceHandlersMap } from './imageResources';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

interface ReadOptionsExt extends ReadOptions {
	large: boolean;
}

export const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB];
const colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];

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
	strict: boolean;
}

export function createReader(buffer: ArrayBuffer, offset?: number, length?: number): PsdReader {
	const view = new DataView(buffer, offset, length);
	return { view, offset: 0, strict: false };
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
	const text = length ? readShortString(reader, length) : '';

	while (++length % padTo) {
		reader.offset++;
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
	const buffer = readBytes(reader, length);
	let result = '';

	for (let i = 0; i < buffer.length; i++) {
		result += String.fromCharCode(buffer[i]);
	}

	return result;
}

function isValidSignature(sig: string) {
	return sig === '8BIM' || sig === 'MeSa' || sig === 'AgHg' || sig === 'PHUT' || sig === 'DCSR';
}

export function readPsd(reader: PsdReader, options: ReadOptions = {}) {
	// header
	checkSignature(reader, '8BPS');
	const version = readUint16(reader);
	if (version !== 1 && version !== 2) throw new Error(`Invalid PSD file version: ${version}`);

	skipBytes(reader, 6);
	const channels = readUint16(reader);
	const height = readUint32(reader);
	const width = readUint32(reader);
	const bitsPerChannel = readUint16(reader);
	const colorMode = readUint16(reader);
	const maxSize = version === 1 ? 30000 : 300000;

	if (width > maxSize || height > maxSize) throw new Error(`Invalid size`);
	if (channels > 16) throw new Error(`Invalid channel count`);
	if (bitsPerChannel > 32) throw new Error(`Invalid bitsPerChannel count`);
	if (supportedColorModes.indexOf(colorMode) === -1)
		throw new Error(`Color mode not supported: ${colorModes[colorMode] ?? colorMode}`);

	const psd: Psd = { width, height, channels, bitsPerChannel, colorMode };
	const opt: ReadOptionsExt = { ...options, large: version === 2 };
	const fixOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];

	// color mode data
	readSection(reader, 1, left => {
		if (opt.throwForMissingFeatures) throw new Error('Color mode data not supported');
		skipBytes(reader, left());
	});

	// image resources
	readSection(reader, 1, left => {
		while (left()) {
			const sigOffset = reader.offset;
			let sig = '';

			// attempt to fix broken document by realigning with the signature
			for (const offset of fixOffsets) {
				try {
					reader.offset = sigOffset + offset;
					sig = readSignature(reader);
				} catch { }
				if (isValidSignature(sig)) break;
			}

			if (!isValidSignature(sig)) {
				throw new Error(`Invalid signature: '${sig}' at 0x${(sigOffset).toString(16)}`);
			}

			const id = readUint16(reader);
			readPascalString(reader, 2); // name

			readSection(reader, 2, left => {
				const handler = resourceHandlersMap[id];
				const skip = id === 1036 && !!opt.skipThumbnail;

				if (!psd.imageResources) {
					psd.imageResources = {};
				}

				if (handler && !skip) {
					try {
						handler.read(reader, psd.imageResources, left, opt);
					} catch (e) {
						if (opt.throwForMissingFeatures) throw e;
						skipBytes(reader, left());
					}
				} else {
					// options.logMissingFeatures && console.log(`Unhandled image resource: ${id}`);
					skipBytes(reader, left());
				}
			});
		}
	});

	// layer and mask info
	let globalAlpha = false;

	readSection(reader, 1, left => {
		globalAlpha = readLayerInfo(reader, psd, opt);

		// SAI does not include this section
		if (left() > 0) {
			const globalLayerMaskInfo = readGlobalLayerMaskInfo(reader);
			if (globalLayerMaskInfo) psd.globalLayerMaskInfo = globalLayerMaskInfo;
		} else {
			// revert back to end of section if exceeded section limits
			// opt.logMissingFeatures && console.log('reverting to end of section');
			skipBytes(reader, left());
		}

		while (left() > 0) {
			// sometimes there are empty bytes here
			while (left() && peekUint8(reader) === 0) {
				// opt.logMissingFeatures && console.log('skipping 0 byte');
				skipBytes(reader, 1);
			}

			if (left() >= 12) {
				readAdditionalLayerInfo(reader, psd, psd, opt);
			} else {
				// opt.logMissingFeatures && console.log('skipping leftover bytes', left());
				skipBytes(reader, left());
			}
		}
	}, undefined, opt.large);

	const hasChildren = psd.children && psd.children.length;
	const skipComposite = opt.skipCompositeImageData && (opt.skipLayerImageData || hasChildren);

	if (!skipComposite) {
		readImageData(reader, psd, globalAlpha, opt);
	}

	// TODO: show converted color mode instead of original PSD file color mode
	//       but add option to preserve file color mode (need to return image data instead of canvas in that case)
	// psd.colorMode = ColorMode.RGB; // we convert all color modes to RGB

	return psd;
}

function readLayerInfo(reader: PsdReader, psd: Psd, options: ReadOptionsExt) {
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

		if (!psd.children) psd.children = [];

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
				// this was workaround because I didn't know what `lsdk` section was, now it's probably not needed anymore
				// } else if (l.name === '</Layer group>' && !l.sectionDivider && !l.top && !l.left && !l.bottom && !l.right) {
				// 	// sometimes layer group terminator doesn't have sectionDivider, so we just guess here (PS bug ?)
				// 	stack.pop();
			} else {
				stack[stack.length - 1].children!.unshift(l);
			}
		}
	}, undefined, options.large);

	return globalAlpha;
}

function readLayerRecord(reader: PsdReader, psd: Psd, options: ReadOptionsExt) {
	const layer: Layer = {};
	layer.top = readInt32(reader);
	layer.left = readInt32(reader);
	layer.bottom = readInt32(reader);
	layer.right = readInt32(reader);

	const channelCount = readUint16(reader);
	const channels: ChannelInfo[] = [];

	for (let i = 0; i < channelCount; i++) {
		let channelID = readInt16(reader) as ChannelID;
		let channelLength = readUint32(reader);

		if (options.large) {
			if (channelLength !== 0) throw new Error('Sizes larger than 4GB are not supported');
			channelLength = readUint32(reader);
		}

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
	// 0x04 - obsolete
	// 0x08 - 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
	// 0x10 - pixel data irrelevant to appearance of document
	// 0x20 - ???
	// if (flags & 0x20) (layer as any)._2 = true; // TEMP !!!!

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
		mask.fromVectorData = (flags & LayerMaskFlags.LayerMaskFromRenderingOtherData) !== 0;

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

function readLayerChannelImageData(
	reader: PsdReader, psd: Psd, layer: Layer, channels: ChannelInfo[], options: ReadOptionsExt
) {
	const layerWidth = (layer.right || 0) - (layer.left || 0);
	const layerHeight = (layer.bottom || 0) - (layer.top || 0);
	const cmyk = psd.colorMode === ColorMode.CMYK;

	let imageData: ImageData | undefined;

	if (layerWidth && layerHeight) {
		if (cmyk) {
			imageData = { width: layerWidth, height: layerHeight, data: new Uint8ClampedArray(layerWidth * layerHeight * 5) } as any as ImageData;
			for (let p = 4; p < imageData.data.byteLength; p += 5) imageData.data[p] = 255;
		} else {
			imageData = createImageData(layerWidth, layerHeight);
			resetImageData(imageData);
		}
	}

	if (RAW_IMAGE_DATA) (layer as any).imageDataRaw = [];

	for (const channel of channels) {
		if (channel.length === 0) continue;
		if (channel.length < 2) throw new Error('Invalid channel length');

		const compression = readUint16(reader) as Compression;

		if (channel.id === ChannelID.UserMask) {
			const mask = layer.mask;

			if (!mask) throw new Error(`Missing layer mask data`);

			const maskWidth = (mask.right || 0) - (mask.left || 0);
			const maskHeight = (mask.bottom || 0) - (mask.top || 0);

			if (maskWidth && maskHeight) {
				const maskData = createImageData(maskWidth, maskHeight);
				resetImageData(maskData);

				const start = reader.offset;
				readData(reader, maskData, compression, maskWidth, maskHeight, 0, options.large, 4);

				if (RAW_IMAGE_DATA) {
					(layer as any).maskDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
				}

				setupGrayscale(maskData);

				if (options.useImageData) {
					mask.imageData = maskData;
				} else {
					mask.canvas = createCanvas(maskWidth, maskHeight);
					mask.canvas.getContext('2d')!.putImageData(maskData, 0, 0);
				}
			}
		} else {
			const offset = offsetForChannel(channel.id, cmyk);
			let targetData = imageData;

			if (offset < 0) {
				targetData = undefined;

				if (options.throwForMissingFeatures) {
					throw new Error(`Channel not supported: ${channel.id}`);
				}
			}

			const start = reader.offset;
			readData(reader, targetData, compression, layerWidth, layerHeight, offset, options.large, cmyk ? 5 : 4);

			if (RAW_IMAGE_DATA) {
				(layer as any).imageDataRaw[channel.id] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}

			reader.offset = start + channel.length - 2; // 2 bytes for compression

			if (targetData && psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(targetData);
			}
		}
	}

	if (imageData) {
		if (cmyk) {
			const cmykData = imageData;
			imageData = createImageData(cmykData.width, cmykData.height);
			cmykToRgb(cmykData, imageData, false);
		}

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
	offset: number, large: boolean, step: number
) {
	if (compression === Compression.RawData) {
		readDataRaw(reader, data, offset, width, height, step);
	} else if (compression === Compression.RleCompressed) {
		readDataRLE(reader, data, width, height, step, [offset], large);
	} else {
		throw new Error(`Compression type not supported: ${compression}`);
	}
}

function readGlobalLayerMaskInfo(reader: PsdReader) {
	return readSection<GlobalLayerMaskInfo | undefined>(reader, 1, left => {
		if (!left()) return undefined;

		const overlayColorSpace = readUint16(reader);
		const colorSpace1 = readUint16(reader);
		const colorSpace2 = readUint16(reader);
		const colorSpace3 = readUint16(reader);
		const colorSpace4 = readUint16(reader);
		const opacity = readUint16(reader) / 0xff;
		const kind = readUint8(reader);
		skipBytes(reader, left()); // 3 bytes of padding ?
		return { overlayColorSpace, colorSpace1, colorSpace2, colorSpace3, colorSpace4, opacity, kind };
	});
}

function readAdditionalLayerInfo(reader: PsdReader, target: LayerAdditionalInfo, psd: Psd, options: ReadOptionsExt) {
	const sig = readSignature(reader);
	if (sig !== '8BIM' && sig !== '8B64') throw new Error(`Invalid signature: '${sig}' at 0x${(reader.offset - 4).toString(16)}`);
	const key = readSignature(reader);

	// `largeAdditionalInfoKeys` fallback, because some keys don't have 8B64 signature even when they are 64bit
	const u64 = sig === '8B64' || (options.large && largeAdditionalInfoKeys.indexOf(key) !== -1);

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
			options.logMissingFeatures && console.log(`Unread ${left()} bytes left for additional info: ${key}`);
			skipBytes(reader, left());
		}
	}, false, u64);
}

function readImageData(reader: PsdReader, psd: Psd, globalAlpha: boolean, options: ReadOptionsExt) {
	const compression = readUint16(reader) as Compression;

	if (supportedColorModes.indexOf(psd.colorMode!) === -1)
		throw new Error(`Color mode not supported: ${psd.colorMode}`);

	if (compression !== Compression.RawData && compression !== Compression.RleCompressed)
		throw new Error(`Compression type not supported: ${compression}`);

	const imageData = createImageData(psd.width, psd.height);
	resetImageData(imageData);

	switch (psd.colorMode) {
		case ColorMode.Bitmap: {
			let bytes: Uint8Array;

			if (compression === Compression.RawData) {
				bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
			} else if (compression === Compression.RleCompressed) {
				bytes = new Uint8Array(psd.width * psd.height);
				readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 1, [0], options.large);
			} else {
				throw new Error(`Bitmap compression not supported: ${compression}`);
			}

			decodeBitmap(bytes, imageData.data, psd.width, psd.height);
			break;
		}
		case ColorMode.RGB:
		case ColorMode.Grayscale: {
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
					readDataRaw(reader, imageData, channels[i], psd.width, psd.height, 4);
				}
			} else if (compression === Compression.RleCompressed) {
				const start = reader.offset;
				readDataRLE(reader, imageData, psd.width, psd.height, 4, channels, options.large);
				if (RAW_IMAGE_DATA) (psd as any).imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}

			if (psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(imageData);
			}
			break;
		}
		case ColorMode.CMYK: {
			if (psd.channels !== 4) throw new Error(`Invalid channel count`);

			const channels = [0, 1, 2, 3];
			if (globalAlpha) channels.push(4);

			if (compression === Compression.RawData) {
				throw new Error(`Not implemented`);
				// TODO: ...
				// for (let i = 0; i < channels.length; i++) {
				// 	readDataRaw(reader, imageData, channels[i], psd.width, psd.height);
				// }
			} else if (compression === Compression.RleCompressed) {
				const cmykImageData: PixelData = {
					width: imageData.width,
					height: imageData.height,
					data: new Uint8Array(imageData.width * imageData.height * 5),
				};

				const start = reader.offset;
				readDataRLE(reader, cmykImageData, psd.width, psd.height, 5, channels, options.large);
				cmykToRgb(cmykImageData, imageData, true);

				if (RAW_IMAGE_DATA) (psd as any).imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}

			break;
		}
		default: throw new Error(`Color mode not supported: ${psd.colorMode}`);
	}

	if (options.useImageData) {
		psd.imageData = imageData;
	} else {
		psd.canvas = createCanvas(psd.width, psd.height);
		psd.canvas.getContext('2d')!.putImageData(imageData, 0, 0);
	}
}

function cmykToRgb(cmyk: PixelData, rgb: PixelData, reverseAlpha: boolean) {
	const size = rgb.width * rgb.height * 4;
	const srcData = cmyk.data;
	const dstData = rgb.data;

	for (let src = 0, dst = 0; dst < size; src += 5, dst += 4) {
		const c = srcData[src];
		const m = srcData[src + 1];
		const y = srcData[src + 2];
		const k = srcData[src + 3];
		dstData[dst] = ((((c * k) | 0) / 255) | 0);
		dstData[dst + 1] = ((((m * k) | 0) / 255) | 0);
		dstData[dst + 2] = ((((y * k) | 0) / 255) | 0);
		dstData[dst + 3] = reverseAlpha ? 255 - srcData[src + 4] : srcData[src + 4];
	}

	// for (let src = 0, dst = 0; dst < size; src += 5, dst += 4) {
	// 	const c = 1 - (srcData[src + 0] / 255);
	// 	const m = 1 - (srcData[src + 1] / 255);
	// 	const y = 1 - (srcData[src + 2] / 255);
	// 	// const k = srcData[src + 3] / 255;
	// 	dstData[dst + 0] = ((1 - c * 0.8) * 255) | 0;
	// 	dstData[dst + 1] = ((1 - m * 0.8) * 255) | 0;
	// 	dstData[dst + 2] = ((1 - y * 0.8) * 255) | 0;
	// 	dstData[dst + 3] = reverseAlpha ? 255 - srcData[src + 4] : srcData[src + 4];
	// }
}

function readDataRaw(reader: PsdReader, pixelData: PixelData | undefined, offset: number, width: number, height: number, step: number) {
	const size = width * height;
	const buffer = readBytes(reader, size);

	if (pixelData && offset < step) {
		const data = pixelData.data;

		for (let i = 0, p = offset | 0; i < size; i++, p = (p + step) | 0) {
			data[p] = buffer[i];
		}
	}
}

export function readDataRLE(
	reader: PsdReader, pixelData: PixelData | undefined, _width: number, height: number, step: number, offsets: number[],
	large: boolean
) {
	const data = pixelData && pixelData.data;
	let lengths: Uint16Array | Uint32Array;

	if (large) {
		lengths = new Uint32Array(offsets.length * height);

		for (let o = 0, li = 0; o < offsets.length; o++) {
			for (let y = 0; y < height; y++, li++) {
				lengths[li] = readUint32(reader);
			}
		}
	} else {
		lengths = new Uint16Array(offsets.length * height);

		for (let o = 0, li = 0; o < offsets.length; o++) {
			for (let y = 0; y < height; y++, li++) {
				lengths[li] = readUint16(reader);
			}
		}
	}

	const extraLimit = (step - 1) | 0; // 3 for rgb, 4 for cmyk

	for (let c = 0, li = 0; c < offsets.length; c++) {
		const offset = offsets[c] | 0;
		const extra = c > extraLimit || offset > extraLimit;

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

export function readSection<T>(
	reader: PsdReader, round: number, func: (left: () => number) => T, skipEmpty = true, eightBytes = false
): T | undefined {
	let length = readUint32(reader);

	if (eightBytes) {
		if (length !== 0) throw new Error('Sizes larger than 4GB are not supported');
		length = readUint32(reader);
	}

	if (length <= 0 && skipEmpty) return undefined;

	let end = reader.offset + length;
	if (end > reader.view.byteLength) throw new Error('Section exceeds file size');

	const result = func(() => end - reader.offset);

	if (reader.offset !== end && reader.strict) {
		if (reader.offset > end) {
			// throw new Error('Exceeded section limits');
			console.warn('Exceeded section limits');
		} else {
			// throw new Error(`Unread section data: ${end - reader.offset} bytes at 0x${reader.offset.toString(16)}`);
			console.warn('Unread section data');
		}
	}

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
		case ColorSpace.HSB: {
			const h = readUint16(reader) / 0xffff;
			const s = readUint16(reader) / 0xffff;
			const b = readUint16(reader) / 0xffff;
			skipBytes(reader, 2);
			return { h, s, b };
		}
		case ColorSpace.CMYK: {
			const c = readUint16(reader) / 257;
			const m = readUint16(reader) / 257;
			const y = readUint16(reader) / 257;
			const k = readUint16(reader) / 257;
			return { c, m, y, k };
		}
		case ColorSpace.Lab: {
			const l = readInt16(reader) / 10000;
			const ta = readInt16(reader);
			const tb = readInt16(reader);
			const a = ta < 0 ? (ta / 12800) : (ta / 12700);
			const b = tb < 0 ? (tb / 12800) : (tb / 12700);
			skipBytes(reader, 2);
			return { l, a, b };
		}
		case ColorSpace.Grayscale: {
			const k = readUint16(reader) * 255 / 10000;
			skipBytes(reader, 6);
			return { k };
		}
		default:
			throw new Error('Invalid color space');
	}
}

export function readPattern(reader: PsdReader): PatternInfo {
	readUint32(reader); // length
	const version = readUint32(reader);
	if (version !== 1) throw new Error(`Invalid pattern version: ${version}`);

	const colorMode = readUint32(reader) as ColorMode;
	const x = readInt16(reader);
	const y = readInt16(reader);

	// we only support RGB and grayscale for now
	if (colorMode !== ColorMode.RGB && colorMode !== ColorMode.Grayscale && colorMode !== ColorMode.Indexed) {
		throw new Error(`Unsupported pattern color mode: ${colorMode}`);
	}

	let name = readUnicodeString(reader);
	const id = readPascalString(reader, 1);
	const palette: RGB[] = [];

	if (colorMode === ColorMode.Indexed) {
		for (let i = 0; i < 256; i++) {
			palette.push({
				r: readUint8(reader),
				g: readUint8(reader),
				b: readUint8(reader),
			})
		}

		skipBytes(reader, 4); // no idea what this is
	}

	// virtual memory array list
	const version2 = readUint32(reader);
	if (version2 !== 3) throw new Error(`Invalid pattern VMAL version: ${version2}`);

	readUint32(reader); // length
	const top = readUint32(reader);
	const left = readUint32(reader);
	const bottom = readUint32(reader);
	const right = readUint32(reader);
	const channelsCount = readUint32(reader);
	const width = right - left;
	const height = bottom - top;
	const data = new Uint8Array(width * height * 4);

	for (let i = 3; i < data.byteLength; i += 4) {
		data[i] = 255;
	}

	for (let i = 0, ch = 0; i < (channelsCount + 2); i++) {
		const has = readUint32(reader);
		if (!has) continue;

		const length = readUint32(reader);
		const pixelDepth = readUint32(reader);
		const ctop = readUint32(reader);
		const cleft = readUint32(reader);
		const cbottom = readUint32(reader);
		const cright = readUint32(reader);
		const pixelDepth2 = readUint16(reader);
		const compressionMode = readUint8(reader); // 0 - raw, 1 - zip
		const dataLength = length - (4 + 16 + 2 + 1);
		const cdata = readBytes(reader, dataLength);

		if (pixelDepth !== 8 || pixelDepth2 !== 8) {
			throw new Error('16bit pixel depth not supported for patterns');
		}

		const w = cright - cleft;
		const h = cbottom - ctop;
		const ox = cleft - left;
		const oy = ctop - top;

		if (compressionMode === 0) {
			if (colorMode === ColorMode.RGB && ch < 3) {
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						const src = x + y * w;
						const dst = (ox + x + (y + oy) * width) * 4;
						data[dst + ch] = cdata[src];
					}
				}
			}

			if (colorMode === ColorMode.Grayscale && ch < 1) {
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						const src = x + y * w;
						const dst = (ox + x + (y + oy) * width) * 4;
						const value = cdata[src];
						data[dst + 0] = value;
						data[dst + 1] = value;
						data[dst + 2] = value;
					}
				}
			}

			if (colorMode === ColorMode.Indexed) {
				// TODO:
				throw new Error('Indexed pattern color mode not implemented');
			}
		} else if (compressionMode === 1) {
			// console.log({ colorMode });
			// require('fs').writeFileSync('zip.bin', Buffer.from(cdata));
			// const data = require('zlib').inflateRawSync(cdata);
			// const data = require('zlib').unzipSync(cdata);
			// console.log(data);
			// throw new Error('Zip compression not supported for pattern');
			// throw new Error('Unsupported pattern compression');
			console.error('Unsupported pattern compression');
			name += ' (failed to decode)';
		} else {
			throw new Error('Invalid pattern compression mode');
		}

		ch++;
	}

	// TODO: use canvas instead of data ?

	return { id, name, x, y, bounds: { x: left, y: top, w: width, h: height }, data };
}
