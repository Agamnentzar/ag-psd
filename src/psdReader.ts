import { inflate as inflateSync } from 'pako';
import { Psd, Layer, ColorMode, SectionDividerType, LayerAdditionalInfo, ReadOptions, LayerMaskData, Color, PatternInfo, GlobalLayerMaskInfo, RGB, PixelData, PixelArray } from './psd';
import { resetImageData, offsetForChannel, decodeBitmap, createImageData, toBlendMode, ChannelID, Compression, LayerMaskFlags, MaskParams, ColorSpace, RAW_IMAGE_DATA, largeAdditionalInfoKeys, imageDataToCanvas } from './helpers';
import { infoHandlersMap } from './additionalInfo';
import { InternalImageResources, resourceHandlersMap } from './imageResources';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

export const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB, ColorMode.Indexed];
const colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];

function setupGrayscale(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let i = 0; i < size; i += 4) {
		data.data[i + 1] = data.data[i];
		data.data[i + 2] = data.data[i];
	}
}

export interface PsdReader extends ReadOptions {
	offset: number;
	view: DataView;
	large: boolean;
	globalAlpha: boolean;
	log(...args: any[]): void;
}

export function createReader(buffer: ArrayBuffer, offset?: number, length?: number): PsdReader {
	const view = new DataView(buffer, offset, length);
	return { view, offset: 0, strict: false, debug: false, large: false, globalAlpha: false, log: console.log };
}

export function warnOrThrow(reader: PsdReader, message: string) {
	if (reader.strict) throw new Error(message);
	if (reader.debug) reader.log(message);
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

export function readUint16LE(reader: PsdReader) {
	reader.offset += 2;
	return reader.view.getUint16(reader.offset - 2, true);
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
	const start = reader.view.byteOffset + reader.offset;
	reader.offset += length;

	if ((start + length) > reader.view.buffer.byteLength) {
		// fix for broken PSD files that are missing part of file at the end
		warnOrThrow(reader, 'Reading bytes exceeding buffer length');
		if (length > (100 * 1024 * 1024)) throw new Error('Reading past end of file'); // limit to 100MB
		const result = new Uint8Array(length);
		const len = Math.min(length, reader.view.byteLength - start);
		if (len > 0) result.set(new Uint8Array(reader.view.buffer, start, len));
		return result;
	} else {
		return new Uint8Array(reader.view.buffer, start, length);
	}
}

export function readSignature(reader: PsdReader) {
	return readShortString(reader, 4);
}

export function validSignatureAt(reader: PsdReader, offset: number) {
	const sig = String.fromCharCode(reader.view.getUint8(offset))
		+ String.fromCharCode(reader.view.getUint8(offset + 1))
		+ String.fromCharCode(reader.view.getUint8(offset + 2))
		+ String.fromCharCode(reader.view.getUint8(offset + 3));
	return sig == '8BIM' || sig == '8B64';
}

export function readPascalString(reader: PsdReader, padTo: number) {
	let length = readUint8(reader);
	const text = length ? readShortString(reader, length) : '';

	while (++length % padTo) { // starts with length + 1 so we count the size byte too
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

export function readUnicodeStringWithLengthLE(reader: PsdReader, length: number) {
	let text = '';

	while (length--) {
		const value = readUint16LE(reader);

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

export function readPsd(reader: PsdReader, readOptions: ReadOptions = {}) {
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

	if (width > maxSize || height > maxSize) throw new Error(`Invalid size: ${width}x${height}`);
	if (channels > 16) throw new Error(`Invalid channel count: ${channels}`);
	if (![1, 8, 16, 32].includes(bitsPerChannel)) throw new Error(`Invalid bitsPerChannel: ${bitsPerChannel}`);
	if (supportedColorModes.indexOf(colorMode) === -1) throw new Error(`Color mode not supported: ${colorModes[colorMode] ?? colorMode}`);

	const psd: Psd = { width, height, channels, bitsPerChannel, colorMode };

	Object.assign(reader, readOptions);
	reader.large = version === 2;
	reader.globalAlpha = false;

	const fixOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];

	// color mode data
	readSection(reader, 1, left => {
		if (!left()) return;

		if (colorMode === ColorMode.Indexed) {
			// should have 256 colors here saved as 8bit channels RGB
			if (left() != 768) throw new Error('Invalid color palette size');

			psd.palette = [];
			for (let i = 0; i < 256; i++) psd.palette.push({ r: readUint8(reader), g: 0, b: 0 });
			for (let i = 0; i < 256; i++) psd.palette[i].g = readUint8(reader);
			for (let i = 0; i < 256; i++) psd.palette[i].b = readUint8(reader);
		} else {
			// TODO: unknown format for duotone, also seems to have some data here for 32bit colors
			// if (options.throwForMissingFeatures) throw new Error('Color mode data not supported');
		}

		skipBytes(reader, left());
	});

	// image resources

	const imageResources: InternalImageResources = {};

	readSection(reader, 1, left => {
		while (left() > 0) {
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
				const skip = id === 1036 && !!reader.skipThumbnail;

				if (handler && !skip) {
					try {
						handler.read(reader, imageResources, left);
					} catch (e) {
						if (reader.throwForMissingFeatures) throw e;
						skipBytes(reader, left());
					}
				} else {
					// options.logMissingFeatures && console.log(`Unhandled image resource: ${id} (${left()})`);
					skipBytes(reader, left());
				}
			});
		}
	});

	const { layersGroup, layerGroupsEnabledId, ...rest } = imageResources;

	if (Object.keys(rest)) {
		psd.imageResources = rest;
	}

	// layer and mask info
	readSection(reader, 1, left => {
		readSection(reader, 2, left => {
			readLayerInfo(reader, psd, imageResources);
			skipBytes(reader, left());
		}, undefined, reader.large);

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
				readAdditionalLayerInfo(reader, psd, psd, imageResources);
			} else {
				// opt.logMissingFeatures && console.log('skipping leftover bytes', left());
				skipBytes(reader, left());
			}
		}
	}, undefined, reader.large);

	const hasChildren = psd.children && psd.children.length;
	const skipComposite = reader.skipCompositeImageData && (reader.skipLayerImageData || hasChildren);

	if (!skipComposite) {
		readImageData(reader, psd);
	}

	// TODO: show converted color mode instead of original PSD file color mode
	//       but add option to preserve file color mode (need to return image data instead of canvas in that case)
	// psd.colorMode = ColorMode.RGB; // we convert all color modes to RGB

	return psd;
}

export function readLayerInfo(reader: PsdReader, psd: Psd, imageResources: InternalImageResources) {
	const { layersGroup = [], layerGroupsEnabledId = [] } = imageResources;

	let layerCount = readInt16(reader);

	if (layerCount < 0) {
		reader.globalAlpha = true;
		layerCount = -layerCount;
	}

	const layers: Layer[] = [];
	const layerChannels: ChannelInfo[][] = [];

	for (let i = 0; i < layerCount; i++) {
		const { layer, channels } = readLayerRecord(reader, psd, imageResources);
		if (layersGroup[i] !== undefined) layer.linkGroup = layersGroup[i];
		if (layerGroupsEnabledId[i] !== undefined) layer.linkGroupEnabled = !!layerGroupsEnabledId[i];
		layers.push(layer);
		layerChannels.push(channels);
	}

	if (!reader.skipLayerImageData) {
		for (let i = 0; i < layerCount; i++) {
			readLayerChannelImageData(reader, psd, layers[i], layerChannels[i]);
		}
	}

	if (!psd.children) psd.children = [];

	const stack: (Layer | Psd)[] = [psd];

	for (let i = layers.length - 1; i >= 0; i--) {
		const l = layers[i];
		const type = l.sectionDivider ? l.sectionDivider.type : SectionDividerType.Other;

		if (type === SectionDividerType.OpenFolder || type === SectionDividerType.ClosedFolder) {
			l.opened = type === SectionDividerType.OpenFolder;
			l.children = [];

			if (l.sectionDivider?.key) {
				l.blendMode = toBlendMode[l.sectionDivider.key] ?? l.blendMode;
			}

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
}

function readLayerRecord(reader: PsdReader, psd: Psd, imageResources: InternalImageResources) {
	const layer: Layer = {};
	layer.top = readInt32(reader);
	layer.left = readInt32(reader);
	layer.bottom = readInt32(reader);
	layer.right = readInt32(reader);

	const channelCount = readUint16(reader);
	const channels: ChannelInfo[] = [];

	for (let i = 0; i < channelCount; i++) {
		let id = readInt16(reader) as ChannelID;
		let length = readUint32(reader);

		if (reader.large) {
			if (length !== 0) throw new Error('Sizes larger than 4GB are not supported');
			length = readUint32(reader);
		}

		channels.push({ id, length });
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
	if (flags & 0x20) layer.effectsOpen = true;
	// 0x04 - obsolete
	// 0x08 - 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
	// 0x10 - pixel data irrelevant to appearance of document
	// 0x20 - effects/filters panel is expanded

	skipBytes(reader, 1);

	readSection(reader, 1, left => {
		readLayerMaskData(reader, layer);

		const blendingRanges = readLayerBlendingRanges(reader);
		if (blendingRanges) layer.blendingRanges = blendingRanges;
		layer.name = readPascalString(reader, 1); // should be padded to 4, but is not sometimes

		// HACK: fix for sometimes layer.name string not being padded correctly, just skip until we get valid signature
		while (left() > 4 && !validSignatureAt(reader, reader.offset)) reader.offset++;

		while (left() >= 12) readAdditionalLayerInfo(reader, layer, psd, imageResources);

		skipBytes(reader, left());
	});

	return { layer, channels };
}

function readLayerMaskData(reader: PsdReader, layer: Layer) {
	return readSection<LayerMaskData | undefined>(reader, 1, left => {
		if (!left()) return undefined;

		const mask: LayerMaskData = {};
		layer.mask = mask;

		mask.top = readInt32(reader);
		mask.left = readInt32(reader);
		mask.bottom = readInt32(reader);
		mask.right = readInt32(reader);
		mask.defaultColor = readUint8(reader);

		const flags = readUint8(reader);
		mask.positionRelativeToLayer = (flags & LayerMaskFlags.PositionRelativeToLayer) !== 0;
		mask.disabled = (flags & LayerMaskFlags.LayerMaskDisabled) !== 0;
		mask.fromVectorData = (flags & LayerMaskFlags.LayerMaskFromRenderingOtherData) !== 0;

		if (left() >= 18) {
			const realMask: LayerMaskData = {};
			layer.realMask = realMask;

			const realFlags = readUint8(reader);
			realMask.positionRelativeToLayer = (realFlags & LayerMaskFlags.PositionRelativeToLayer) !== 0;
			realMask.disabled = (realFlags & LayerMaskFlags.LayerMaskDisabled) !== 0;
			realMask.fromVectorData = (realFlags & LayerMaskFlags.LayerMaskFromRenderingOtherData) !== 0;

			realMask.defaultColor = readUint8(reader); // Real user mask background. 0 or 255.
			realMask.top = readInt32(reader);
			realMask.left = readInt32(reader);
			realMask.bottom = readInt32(reader);
			realMask.right = readInt32(reader);
		}

		if (flags & LayerMaskFlags.MaskHasParametersAppliedToIt) {
			const params = readUint8(reader);
			if (params & MaskParams.UserMaskDensity) mask.userMaskDensity = readUint8(reader) / 0xff;
			if (params & MaskParams.UserMaskFeather) mask.userMaskFeather = readFloat64(reader);
			if (params & MaskParams.VectorMaskDensity) mask.vectorMaskDensity = readUint8(reader) / 0xff;
			if (params & MaskParams.VectorMaskFeather) mask.vectorMaskFeather = readFloat64(reader);
		}

		skipBytes(reader, left());
	});
}

function readBlendingRange(reader: PsdReader) {
	return [readUint8(reader), readUint8(reader), readUint8(reader), readUint8(reader)];
}

function readLayerBlendingRanges(reader: PsdReader) {
	return readSection(reader, 1, left => {
		const compositeGrayBlendSource = readBlendingRange(reader);
		const compositeGraphBlendDestinationRange = readBlendingRange(reader);
		const ranges: { sourceRange: number[]; destRange: number[]; }[] = [];

		while (left() > 0) {
			const sourceRange = readBlendingRange(reader);
			const destRange = readBlendingRange(reader);
			ranges.push({ sourceRange, destRange });
		}

		return { compositeGrayBlendSource, compositeGraphBlendDestinationRange, ranges };
	});
}

function readLayerChannelImageData(reader: PsdReader, psd: Psd, layer: Layer, channels: ChannelInfo[]) {
	const layerWidth = (layer.right || 0) - (layer.left || 0);
	const layerHeight = (layer.bottom || 0) - (layer.top || 0);
	const cmyk = psd.colorMode === ColorMode.CMYK;

	let imageData: PixelData | undefined;

	if (layerWidth && layerHeight) {
		if (cmyk) {
			if (psd.bitsPerChannel !== 8) throw new Error('bitsPerChannel Not supproted');
			imageData = { width: layerWidth, height: layerHeight, data: new Uint8ClampedArray(layerWidth * layerHeight * 5) } as any as ImageData;
			for (let p = 4; p < imageData.data.byteLength; p += 5) imageData.data[p] = 255;
		} else {
			imageData = createImageDataBitDepth(layerWidth, layerHeight, psd.bitsPerChannel ?? 8);
			resetImageData(imageData);
		}
	}

	if (RAW_IMAGE_DATA) {
		(layer as any).imageDataRaw = [];
		(layer as any).imageDataRawCompression = [];
	}

	for (const channel of channels) {
		if (channel.length === 0) continue;
		if (channel.length < 2) throw new Error('Invalid channel length');

		const start = reader.offset;

		let compression = readUint16(reader) as Compression;

		// try to fix broken files where there's 1 byte shift of channel
		if (compression > 3) {
			reader.offset -= 1;
			compression = readUint16(reader) as Compression;
		}

		// try to fix broken files where there's 1 byte shift of channel
		if (compression > 3) {
			reader.offset -= 3;
			compression = readUint16(reader) as Compression;
		}

		if (compression > 3) throw new Error(`Invalid compression: ${compression}`);

		if (channel.id === ChannelID.UserMask || channel.id === ChannelID.RealUserMask) {
			const mask = channel.id === ChannelID.UserMask ? layer.mask : layer.realMask;
			if (!mask) throw new Error(`Missing layer ${channel.id === ChannelID.UserMask ? 'mask' : 'real mask'} data`);

			const maskWidth = (mask.right || 0) - (mask.left || 0);
			const maskHeight = (mask.bottom || 0) - (mask.top || 0);
			if (maskWidth < 0 || maskHeight < 0 || maskWidth > 30000 || maskHeight > 30000) throw new Error('Invalid mask size');

			if (maskWidth && maskHeight) {
				const maskData = createImageDataBitDepth(maskWidth, maskHeight, psd.bitsPerChannel ?? 8);
				resetImageData(maskData);

				const start = reader.offset;
				readData(reader, channel.length, maskData, compression, maskWidth, maskHeight, psd.bitsPerChannel ?? 8, 0, reader.large, 4);

				if (RAW_IMAGE_DATA) {
					if (channel.id === ChannelID.UserMask) {
						(layer as any).maskDataRawCompression = compression;
						(layer as any).maskDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
					} else {
						(layer as any).realMaskDataRawCompression = compression;
						(layer as any).realMaskDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
					}
				}

				setupGrayscale(maskData);

				if (reader.useImageData) {
					mask.imageData = maskData;
				} else {
					mask.canvas = imageDataToCanvas(maskData);
				}
			}
		} else {
			const offset = offsetForChannel(channel.id, cmyk);
			let targetData = imageData;

			if (offset < 0) {
				targetData = undefined;

				if (reader.throwForMissingFeatures) {
					throw new Error(`Channel not supported: ${channel.id}`);
				}
			}

			readData(reader, channel.length, targetData, compression, layerWidth, layerHeight, psd.bitsPerChannel ?? 8, offset, reader.large, cmyk ? 5 : 4);

			if (RAW_IMAGE_DATA) {
				(layer as any).imageDataRawCompression[channel.id] = compression;
				(layer as any).imageDataRaw[channel.id] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start + 2, channel.length - 2);
			}

			reader.offset = start + channel.length;

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

		if (reader.useImageData) {
			layer.imageData = imageData;
		} else {
			layer.canvas = imageDataToCanvas(imageData);
		}
	}
}

export function readData(reader: PsdReader, length: number, data: PixelData | undefined, compression: Compression, width: number, height: number, bitDepth: number, offset: number, large: boolean, step: number) {
	if (compression === Compression.RawData) {
		readDataRaw(reader, data, width, height, bitDepth, step, offset);
	} else if (compression === Compression.RleCompressed) {
		readDataRLE(reader, data, width, height, bitDepth, step, [offset], large);
	} else if (compression === Compression.ZipWithoutPrediction) {
		readDataZip(reader, length, data, width, height, bitDepth, step, offset, false);
	} else if (compression === Compression.ZipWithPrediction) {
		readDataZip(reader, length, data, width, height, bitDepth, step, offset, true);
	} else {
		throw new Error(`Invalid Compression type: ${compression}`);
	}
}

export function readGlobalLayerMaskInfo(reader: PsdReader) {
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

export function readAdditionalLayerInfo(reader: PsdReader, target: LayerAdditionalInfo, psd: Psd, imageResources: InternalImageResources) {
	const sig = readSignature(reader);
	if (sig !== '8BIM' && sig !== '8B64') throw new Error(`Invalid signature: '${sig}' at 0x${(reader.offset - 4).toString(16)}`);
	const key = readSignature(reader);

	// `largeAdditionalInfoKeys` fallback, because some keys don't have 8B64 signature even when they are 64bit
	const u64 = sig === '8B64' || (reader.large && largeAdditionalInfoKeys.indexOf(key) !== -1);

	readSection(reader, 2, left => {
		const handler = infoHandlersMap[key];

		if (handler) {
			try {
				handler.read(reader, target, left, psd, imageResources);
			} catch (e) {
				if (reader.throwForMissingFeatures) throw e;
			}
		} else {
			reader.logMissingFeatures && reader.log(`Unhandled additional info: ${key}`);
			skipBytes(reader, left());
		}

		if (left()) {
			reader.logMissingFeatures && reader.log(`Unread ${left()} bytes left for additional info: ${key}`);
			skipBytes(reader, left());
		}
	}, false, u64);
}

export function createImageDataBitDepth(width: number, height: number, bitDepth: number, channels = 4): PixelData {
	if (bitDepth === 1 || bitDepth === 8) {
		if (channels === 4) {
			return createImageData(width, height);
		} else {
			return { width, height, data: new Uint8ClampedArray(width * height * channels) };
		}
	} else if (bitDepth === 16) {
		return { width, height, data: new Uint16Array(width * height * channels) };
	} else if (bitDepth === 32) {
		return { width, height, data: new Float32Array(width * height * channels) };
	} else {
		throw new Error(`Invalid bitDepth (${bitDepth})`);
	}
}

function readImageData(reader: PsdReader, psd: Psd) {
	const compression = readUint16(reader) as Compression;
	const bitsPerChannel = psd.bitsPerChannel ?? 8;

	if (supportedColorModes.indexOf(psd.colorMode!) === -1)
		throw new Error(`Color mode not supported: ${psd.colorMode}`);

	if (compression !== Compression.RawData && compression !== Compression.RleCompressed)
		throw new Error(`Compression type not supported: ${compression}`);

	const imageData = createImageDataBitDepth(psd.width, psd.height, bitsPerChannel);
	resetImageData(imageData);

	switch (psd.colorMode) {
		case ColorMode.Bitmap: {
			if (bitsPerChannel !== 1) throw new Error('Invalid bitsPerChannel for bitmap color mode');

			let bytes: Uint8Array;

			if (compression === Compression.RawData) {
				bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
			} else if (compression === Compression.RleCompressed) {
				bytes = new Uint8Array(psd.width * psd.height);
				readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 8, 1, [0], reader.large);
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
			} else if (reader.globalAlpha) {
				channels.push(3);
			}

			if (compression === Compression.RawData) {
				for (let i = 0; i < channels.length; i++) {
					readDataRaw(reader, imageData, psd.width, psd.height, bitsPerChannel, 4, channels[i]);
				}
			} else if (compression === Compression.RleCompressed) {
				const start = reader.offset;
				readDataRLE(reader, imageData, psd.width, psd.height, bitsPerChannel, 4, channels, reader.large);
				if (RAW_IMAGE_DATA) (psd as any).imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			}

			if (psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(imageData);
			}
			break;
		}
		case ColorMode.Indexed: {
			if (bitsPerChannel !== 8) throw new Error('bitsPerChannel Not supproted');
			if (psd.channels !== 1) throw new Error('Invalid channel count');
			if (!psd.palette) throw new Error('Missing color palette');

			if (compression === Compression.RawData) {
				throw new Error(`Not implemented`);
			} else if (compression === Compression.RleCompressed) {
				const indexedImageData: PixelData = {
					width: imageData.width,
					height: imageData.height,
					data: new Uint8Array(imageData.width * imageData.height),
				};
				readDataRLE(reader, indexedImageData, psd.width, psd.height, bitsPerChannel, 1, [0], reader.large);
				indexedToRgb(indexedImageData, imageData, psd.palette);
			} else {
				throw new Error(`Not implemented`);
			}

			break;
		}
		case ColorMode.CMYK: {
			if (bitsPerChannel !== 8) throw new Error('bitsPerChannel Not supproted');
			if (psd.channels !== 4) throw new Error(`Invalid channel count`);

			const channels = [0, 1, 2, 3];
			if (reader.globalAlpha) channels.push(4);

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
				readDataRLE(reader, cmykImageData, psd.width, psd.height, bitsPerChannel, 5, channels, reader.large);
				cmykToRgb(cmykImageData, imageData, true);

				if (RAW_IMAGE_DATA) (psd as any).imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
			} else {
				throw new Error(`Not implemented`);
			}

			break;
		}
		default: throw new Error(`Color mode not supported: ${psd.colorMode}`);
	}

	// remove weird white matte
	if (reader.globalAlpha) {
		if (psd.bitsPerChannel !== 8) throw new Error('bitsPerChannel Not supproted');
		const p = imageData.data;
		const size = imageData.width * imageData.height * 4;
		for (let i = 0; i < size; i += 4) {
			const pa = p[i + 3];
			if (pa != 0 && pa != 255) {
				const a = pa / 255;
				const ra = 1 / a;
				const invA = 255 * (1 - ra);
				p[i + 0] = p[i + 0] * ra + invA;
				p[i + 1] = p[i + 1] * ra + invA;
				p[i + 2] = p[i + 2] * ra + invA;
			}
		}
	}

	if (reader.useImageData) {
		psd.imageData = imageData;
	} else {
		psd.canvas = imageDataToCanvas(imageData);
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

function indexedToRgb(indexed: PixelData, rgb: PixelData, palette: RGB[]) {
	const size = indexed.width * indexed.height;
	const srcData = indexed.data;
	const dstData = rgb.data;

	for (let src = 0, dst = 0; src < size; src++, dst += 4) {
		const c = palette[srcData[src]];
		dstData[dst + 0] = c.r;
		dstData[dst + 1] = c.g;
		dstData[dst + 2] = c.b;
		dstData[dst + 3] = 255;
	}
}

function verifyCompatible(a: PixelArray, b: PixelArray) {
	if ((a.byteLength / a.length) !== (b.byteLength / b.length)) {
		throw new Error('Invalid array types');
	}
}

function bytesToArray(bytes: Uint8Array, bitDepth: number) {
	if (bitDepth === 8) {
		return bytes;
	} else if (bitDepth === 16) {
		if (bytes.byteOffset % 2) {
			const result = new Uint16Array(bytes.byteLength / 2);
			new Uint8Array(result.buffer, result.byteOffset, result.byteLength).set(bytes);
			return result;
		} else {
			return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
		}
	} else if (bitDepth === 32) {
		if (bytes.byteOffset % 4) {
			const result = new Float32Array(bytes.byteLength / 4);
			new Uint8Array(result.buffer, result.byteOffset, result.byteLength).set(bytes);
			return result;
		} else {
			return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
		}
	} else {
		throw new Error(`Invalid bitDepth (${bitDepth})`)
	}
}

function copyChannelToPixelData(pixelData: PixelData, channel: PixelArray, offset: number, step: number) {
	verifyCompatible(pixelData.data, channel);
	const size = pixelData.width * pixelData.height;
	const data = pixelData.data;
	for (let i = 0, p = offset | 0; i < size; i++, p = (p + step) | 0) {
		data[p] = channel[i];
	}
}

function readDataRaw(reader: PsdReader, pixelData: PixelData | undefined, width: number, height: number, bitDepth: number, step: number, offset: number) {
	const buffer = readBytes(reader, width * height * Math.floor(bitDepth / 8));

	if (bitDepth == 32) {
		for (let i = 0; i < buffer.byteLength; i += 4) {
			const a = buffer[i + 0];
			const b = buffer[i + 1];
			const c = buffer[i + 2];
			const d = buffer[i + 3];
			buffer[i + 0] = d;
			buffer[i + 1] = c;
			buffer[i + 2] = b;
			buffer[i + 3] = a;
		}
	}

	const array = bytesToArray(buffer, bitDepth);

	if (pixelData && offset < step) {
		copyChannelToPixelData(pixelData, array, offset, step);
	}
}

function decodePredicted(data: Uint8Array | Uint16Array, width: number, height: number, mod: number) {
	for (let y = 0; y < height; y++) {
		const offset = y * width;

		for (let x = 1, o = offset + 1; x < width; x++, o++) {
			data[o] = (data[o - 1] + data[o]) % mod;
		}
	}
}

export function readDataZip(reader: PsdReader, length: number, pixelData: PixelData | undefined, width: number, height: number, bitDepth: number, step: number, offset: number, prediction: boolean) {
	const compressed = readBytes(reader, length);
	const decompressed = inflateSync(compressed);

	if (pixelData && offset < step) {
		const array = bytesToArray(decompressed, bitDepth);

		if (bitDepth === 8) {
			if (prediction) decodePredicted(decompressed, width, height, 0x100);
			copyChannelToPixelData(pixelData, decompressed, offset, step);
		} else if (bitDepth === 16) {
			if (prediction) decodePredicted(array as Uint16Array, width, height, 0x10000);
			copyChannelToPixelData(pixelData, array, offset, step);
		} else if (bitDepth === 32) {
			if (prediction) decodePredicted(decompressed, width * 4, height, 0x100);

			let di = offset;
			const dst = new Uint32Array(pixelData.data.buffer, pixelData.data.byteOffset, pixelData.data.length);

			for (let y = 0; y < height; y++) {
				let a = width * 4 * y;

				for (let x = 0; x < width; x++, a++, di += step) {
					const b = a + width;
					const c = b + width;
					const d = c + width;
					dst[di] = ((decompressed[a] << 24) | (decompressed[b] << 16) | (decompressed[c] << 8) | decompressed[d]) >>> 0;
				}
			}
		} else {
			throw new Error('Invalid bitDepth');
		}
	}
}

export function readDataRLE(reader: PsdReader, pixelData: PixelData | undefined, width: number, height: number, bitDepth: number, step: number, offsets: number[], large: boolean) {
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

	if (bitDepth !== 1 && bitDepth !== 8) throw new Error(`Invalid bit depth (${bitDepth})`);

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

				for (let i = 0, x = 0; i < length; i++) {
					let header = buffer[i];

					if (header > 128) {
						const value = buffer[++i];
						header = (256 - header) | 0;

						for (let j = 0; j <= header && x < width; j = (j + 1) | 0, x = (x + 1) | 0) {
							data[p] = value;
							p = (p + step) | 0;
						}
					} else if (header < 128) {
						for (let j = 0; j <= header && x < width; j = (j + 1) | 0, x = (x + 1) | 0) {
							data[p] = buffer[++i];
							p = (p + step) | 0;
						}
					} else {
						// ignore 128
					}

					// This showed up on some images from non-photoshop programs, ignoring it seems to work just fine.
					// if (i >= length) throw new Error(`Invalid RLE data: exceeded buffer size ${i}/${length}`);
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

	if (reader.offset !== end) {
		if (reader.offset > end) {
			warnOrThrow(reader, 'Exceeded section limits');
		} else {
			warnOrThrow(reader, `Unread section data`); // : ${end - reader.offset} bytes at 0x${reader.offset.toString(16)}`);
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
			reader.log('Unsupported pattern compression');
			name += ' (failed to decode)';
		} else {
			throw new Error('Invalid pattern compression mode');
		}

		ch++;
	}

	// TODO: use canvas instead of data ?

	return { id, name, x, y, bounds: { x: left, y: top, w: width, h: height }, data };
}
