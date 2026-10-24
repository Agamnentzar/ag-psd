import { Inflate } from 'pako';
import { Psd, Layer, ColorMode, SectionDividerType, LayerAdditionalInfo, ReadOptions, LayerMaskData, Color, PatternInfo, GlobalLayerMaskInfo, RGB, PixelData, PixelArray, ChannelID, Compression } from './psd';
import { resetImageData, offsetForChannel, decodeBitmap, createImageData, toBlendMode, LayerMaskFlags, MaskParams, ColorSpace, largeAdditionalInfoKeys, largeAdditionalInfoKeysObserved, imageDataToCanvas, normalizeLabAB } from './helpers';
import { infoHandlersMap } from './additionalInfo';
import { decodeString } from './utf8';
import { InternalImageResources, resourceHandlersMap } from './imageResources';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

export const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB, ColorMode.Indexed, ColorMode.CMYK];
const colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', '', '', 'multichannel', 'duotone', 'lab'];

function setupGrayscale(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let i = 0; i < size; i += 4) {
		const c = data.data[i];
		data.data[i + 1] = c;
		data.data[i + 2] = c;
	}
}

export interface PsdReader extends ReadOptions {
	offset: number;
	view: DataView;
	large: boolean;
	globalAlpha: boolean;
	layersInGlobalInfo?: boolean; // layers were read from Lr16/Lr32/Layr global additional info
	log(...args: any[]): void;
	// text decoders, created lazily (null if not supported)
	utf8Decoder?: TextDecoder | null;
	utf8StrictDecoder?: TextDecoder | null;
	gbkDecoder?: TextDecoder | null;
}

function createTextDecoder(label: string, options?: TextDecoderOptions) {
	try {
		return typeof TextDecoder !== 'undefined' ? new TextDecoder(label, options) : null;
	} catch {
		return null; // encoding not supported
	}
}

// non-fatal UTF-8 decoder, malformed byte sequences are replaced with U+FFFD
export function getUtf8Decoder(reader: PsdReader) {
	if (reader.utf8Decoder === undefined) reader.utf8Decoder = createTextDecoder('utf-8', { ignoreBOM: true });
	return reader.utf8Decoder;
}

// UTF-8 decoder that throws on malformed byte sequences
export function getUtf8StrictDecoder(reader: PsdReader) {
	if (reader.utf8StrictDecoder === undefined) reader.utf8StrictDecoder = createTextDecoder('utf-8', { ignoreBOM: true, fatal: true });
	return reader.utf8StrictDecoder;
}

// GBK decoder that throws on malformed byte sequences
export function getGbkStrictDecoder(reader: PsdReader) {
	if (reader.gbkDecoder === undefined) reader.gbkDecoder = createTextDecoder('gbk', { fatal: true });
	return reader.gbkDecoder;
}

export function decodeUtf8(reader: PsdReader, buffer: Uint8Array) {
	// native decoder is faster only for longer strings
	const decoder = buffer.byteLength > 1000 ? getUtf8Decoder(reader) : null;
	return decoder ? decoder.decode(buffer) : decodeString(buffer);
}

export function createReader(buffer: ArrayBufferLike, offset?: number, length?: number): PsdReader {
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

// NOTE: returned array may alias the reader's underlying buffer, never write into it
export function readBytes(reader: PsdReader, length: number) {
	const start = reader.offset;
	const viewLength = reader.view.byteLength;
	reader.offset += length;

	if ((start + length) > viewLength) {
		// fix for broken PSD files that are missing part of file at the end
		warnOrThrow(reader, 'Reading bytes exceeding buffer length');
		if (length > (100 * 1024 * 1024)) throw new Error('Reading past end of file'); // limit to 100MB
		const result = new Uint8Array(length);
		const len = Math.min(length, viewLength - start);
		if (len > 0) result.set(new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, len));
		return result;
	} else {
		return new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, length);
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

const STRING_CHUNK_SIZE = 0x2000;

function checkReadBounds(reader: PsdReader, size: number) {
	if (reader.offset < 0 || (reader.offset + size) > reader.view.byteLength) {
		throw new RangeError('Offset is outside the bounds of the DataView');
	}
}

function readUtf16String(reader: PsdReader, length: number, littleEndian: boolean) {
	if (!(length > 0)) return '';

	checkReadBounds(reader, length * 2);

	const view = reader.view;
	const codes = new Uint16Array(Math.min(length, STRING_CHUNK_SIZE));
	let offset = reader.offset;
	let text = '';

	for (let i = 0; i < length; i += STRING_CHUNK_SIZE) {
		const count = Math.min(STRING_CHUNK_SIZE, length - i);

		for (let j = 0; j < count; j++, offset += 2) {
			codes[j] = view.getUint16(offset, littleEndian);
		}

		text += String.fromCharCode.apply(null, (count === codes.length ? codes : codes.subarray(0, count)) as any);
	}

	reader.offset = offset;

	// remove trailing \0
	if (text.charCodeAt(text.length - 1) === 0) text = text.substring(0, text.length - 1);

	return text;
}

function bytesToString(bytes: Uint8Array) {
	let text = '';

	for (let i = 0; i < bytes.length; i += STRING_CHUNK_SIZE) {
		text += String.fromCharCode.apply(null, bytes.subarray(i, i + STRING_CHUNK_SIZE) as any);
	}

	return text;
}

export function readUnicodeStringWithLength(reader: PsdReader, length: number) {
	return readUtf16String(reader, length, false);
}

export function readUnicodeStringWithLengthLE(reader: PsdReader, length: number) {
	return readUtf16String(reader, length, true);
}

export function readAsciiString(reader: PsdReader, length: number) {
	if (!(length > 0)) return '';
	checkReadBounds(reader, length);
	const text = bytesToString(new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, length));
	reader.offset += length;
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
	return bytesToString(readBytes(reader, length));
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
	// up to 56 channels plus transparency of composite image (Photoshop CS3 writes 57 channels for 53 alpha channels)
	if (channels < 1 || channels > 57) throw new Error(`Invalid channel count: ${channels}`);
	if (![1, 8, 16, 32].includes(bitsPerChannel)) throw new Error(`Invalid bitsPerChannel: ${bitsPerChannel}`);
	if (supportedColorModes.indexOf(colorMode) === -1) throw new Error(`Color mode not supported: ${colorModes[colorMode] ?? colorMode}`);

	const psd: Psd = { width, height, channels, bitsPerChannel, colorMode };

	Object.assign(reader, readOptions);
	reader.large = version === 2;
	reader.globalAlpha = false;
	reader.layersInGlobalInfo = false;
	if (!('totalMemoryLimit' in reader)) { // setting totalMemoryLimit to undefined explicitly disables memory limit
		reader.totalMemoryLimit = 2 * 1024 * 1024 * 1024; // default 2GB memory limit
	}

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
	let unreadResourceBytes = 0;

	readSection(reader, 1, left => {
		// stop if there's not enough data left for resource header (some files have few trailing bytes in this section)
		while (left() >= 12) {
			const signature = realignWithSignature(reader, isValidSignature);
			const id = readUint16(reader);
			const nameLength = readUint8(reader);
			const name = readBytes(reader, nameLength);
			skipBytes(reader, (nameLength + 1) % 2); // pad to even size

			readSection(reader, 2, left => {
				const handler = resourceHandlersMap[id];
				const skip = id === 1036 && !!reader.skipThumbnail;

				if (handler && !skip) {
					try {
						handler.read(reader, imageResources, left, { signature, id, name, width, height });
					} catch (e) {
						if (reader.throwForMissingFeatures) throw e;
						skipBytes(reader, left());
					}
				} else {
					reader.logMissingFeatures && reader.log(`Unhandled image resource: ${id} (${left()})`);
					skipBytes(reader, left());
				}
			});
		}

		unreadResourceBytes = left();
		skipBytes(reader, left());
	});

	// some files have image resources section length few bytes larger than the data, layer and mask info section
	// starts right after the last resource in that case
	if (unreadResourceBytes && !sectionFits(reader, reader.offset) && sectionFits(reader, reader.offset - unreadResourceBytes)) {
		reader.offset -= unreadResourceBytes;
	}

	const { layersGroup, layerGroupsEnabledId, savedPathsOrigination, ...rest } = imageResources;

	if (Object.keys(rest).length) {
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
		if (reader.useRawData) {
			const rawOffset = Math.min(reader.offset, reader.view.byteLength);
			const rawCompositeData = new Uint8Array(reader.view.buffer, reader.view.byteOffset + rawOffset, reader.view.byteLength - rawOffset);
			psd.rawCompositeData = rawCompositeData;
			psd.rawCompositeDataInfo = { large: reader.large, globalAlpha: reader.globalAlpha };
			if (reader.layersInGlobalInfo) psd.rawCompositeDataInfo.layersInGlobalInfo = true;
		} else {
			const imageData = readImageData(reader, psd);
			if (reader.useImageData) {
				psd.imageData = imageData;
			} else {
				psd.canvas = imageDataToCanvas(imageData);
			}
		}
	}

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

	for (let i = 0; i < layerCount; i++) {
		readLayerChannelImageData(reader, psd, layers[i], layerChannels[i]);
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
			// ignore unmatched section dividers, never pop the root
			if (stack.length > 1) stack.pop();
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
	if (!isValidBoxSize(layer, reader)) throw new Error('Invalid layer size');

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
	if (!toBlendMode[blendMode]) {
		if (reader.throwForMissingFeatures) throw new Error(`Invalid blend mode: '${blendMode}'`);
		reader.logMissingFeatures && reader.log(`Unknown blend mode: '${blendMode}', using normal blend mode`);
	}
	layer.blendMode = toBlendMode[blendMode] || 'normal';

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

// negative sizes are treated as empty (Photoshop writes them for some empty layers, like 0,0,-1,0 bounds of fill layer)
// checks if length of section (layer and mask info) at given offset fits in the file
function sectionFits(reader: PsdReader, offset: number) {
	const lengthSize = reader.large ? 8 : 4;
	if (offset < 0 || offset + lengthSize > reader.view.byteLength) return false;
	const length = reader.large ? reader.view.getUint32(offset) * 0x100000000 + reader.view.getUint32(offset + 4) : reader.view.getUint32(offset);
	return offset + lengthSize + length <= reader.view.byteLength;
}

function isValidBoxSize(box: { top?: number; left?: number; bottom?: number; right?: number; }, reader: PsdReader) {
	const width = (box.right || 0) - (box.left || 0);
	const height = (box.bottom || 0) - (box.top || 0);
	const maxSize = reader.large ? 300000 : 30000;
	return width <= maxSize && height <= maxSize;
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
		if (!isValidBoxSize(mask, reader)) throw new Error('Invalid mask size');

		mask.defaultColor = readUint8(reader);

		const flags = readUint8(reader);
		mask.positionRelativeToLayer = (flags & LayerMaskFlags.PositionRelativeToLayer) !== 0;
		mask.disabled = (flags & LayerMaskFlags.LayerMaskDisabled) !== 0;
		mask.fromVectorData = (flags & LayerMaskFlags.LayerMaskFromRenderingOtherData) !== 0;

		if (hasRealMaskData(reader, flags, left())) {
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
			if (!isValidBoxSize(realMask, reader)) throw new Error('Invalid realMask size');
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

function maskParamsSize(params: number) {
	return 1 +
		((params & MaskParams.UserMaskDensity) ? 1 : 0) +
		((params & MaskParams.UserMaskFeather) ? 8 : 0) +
		((params & MaskParams.VectorMaskDensity) ? 1 : 0) +
		((params & MaskParams.VectorMaskFeather) ? 8 : 0);
}

// checks if data at offset is mask parameters followed by up to 3 bytes of zero padding, ending exactly at offset + left
function isMaskParamsLayout(view: DataView, offset: number, left: number) {
	if (left < 1) return false;

	const params = view.getUint8(offset);
	if (params === 0 || (params & ~0x0f)) return false; // only 4 parameter flags exist

	const size = maskParamsSize(params);
	if (left < size || left - size > 3) return false;

	for (let i = size; i < left; i++) {
		if (view.getUint8(offset + i) !== 0) return false;
	}

	return true;
}

// real mask data (18 bytes) is followed by mask parameters (if flag is set) and padding
function hasRealMaskData(reader: PsdReader, flags: number, left: number) {
	if (left < 18) return false;
	if (!(flags & LayerMaskFlags.MaskHasParametersAppliedToIt)) return true;

	const { view, offset } = reader;
	if (isMaskParamsLayout(view, offset, left)) return false;
	if (isMaskParamsLayout(view, offset + 18, left - 18)) return true;

	// unknown layout, assume real mask if there's enough data for it (and mask parameters)
	return left === 18 || left - 18 >= maskParamsSize(view.getUint8(offset + 18));
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
	if (reader.skipLayerImageData) return;

	const { colorMode = ColorMode.RGB, bitsPerChannel = 8 } = psd;
	layer.rawData = { colorMode, bitsPerChannel, channels: [], large: reader.large };

	for (const channel of channels) {
		const start = reader.offset;

		let compression = Compression.RawData;
		let data: Uint8Array | undefined = undefined;

		if (channel.length === 1) throw new Error('Invalid channel length');
		if (channel.length) {
			compression = readUint16(reader) as Compression;
			// try to fix broken files where there's 1 byte shift of channel
			if (compression > 3) {
				reader.offset -= 1;
				compression = readUint16(reader) as Compression;
			}

			// try to fix broken files where there's 1 byte shift of channel (in the other direction)
			if (compression > 3) {
				reader.offset -= 4;
				compression = readUint16(reader) as Compression;
			}

			if (compression > 3) throw new Error(`Invalid compression: ${compression}`);

			if (channel.length > 2) {
				data = readBytes(reader, channel.length - 2);
			}
		}

		reader.offset = start + channel.length;
		layer.rawData.channels.push({ id: channel.id, compression, data });
	}

	if (!reader.useRawData) {
		decodeLayerImageData(layer, reader);
	}
}

function resetAlpha({ data }: PixelData, cmyk: boolean) {
	const alpha = (data instanceof Float32Array) ? 1.0 : ((data instanceof Uint16Array) ? 0xffff : 0xff);
	const offset = (cmyk ? 4 : 3) | 0;
	const length = data.length | 0;
	const step = (cmyk ? 5 : 4) | 0;

	for (let p = offset; p < length; p = (p + step) | 0) {
		data[p] = alpha;
	}
}

export function getCompositeImageData(psd: Psd) {
	const data = psd.rawCompositeData;
	if (!data) return undefined;

	const reader = createReader(data.buffer, data.byteOffset, data.byteLength);
	const info = psd.rawCompositeDataInfo;

	if (info) {
		reader.large = info.large;
		reader.globalAlpha = info.globalAlpha;
		reader.layersInGlobalInfo = !!info.layersInGlobalInfo;
	}

	return readImageData(reader, psd);
}

export function getCompositeCanvas(psd: Psd) {
	return imageDataToCanvasSafe(getCompositeImageData(psd));
}

export function getLayerImageData(layer: Layer) {
	return getDataFromLayer(layer, LayerDataType.Layer, false, undefined);
}

export function getLayerMaskImageData(layer: Layer) {
	return getDataFromLayer(layer, LayerDataType.Mask, false, undefined);
}

export function getLayerRealMaskImageData(layer: Layer) {
	return getDataFromLayer(layer, LayerDataType.RealMask, false, undefined);
}

export function getLayerCanvas(layer: Layer) {
	return imageDataToCanvasSafe(getLayerImageData(layer));
}

export function getLayerMaskCanvas(layer: Layer) {
	return imageDataToCanvasSafe(getLayerMaskImageData(layer));
}

export function getLayerRealMaskCanvas(layer: Layer) {
	return imageDataToCanvasSafe(getLayerRealMaskImageData(layer));
}

function imageDataToCanvasSafe(imageData: PixelData | undefined) {
	return imageData && imageDataToCanvas(imageData);
}

function setImageDataOrCanvas(obj: Layer | LayerMaskData, imageData: PixelData | undefined, useImageData: boolean | undefined) {
	if (!imageData) return;

	if (useImageData) {
		obj.imageData = imageData;
	} else {
		obj.canvas = imageDataToCanvas(imageData);
	}
}

export function decodeLayerPixels(layer: Layer, useImageData?: boolean) {
	decodeLayerImageData(layer, { useImageData });
}

type LogOptions = Pick<ReadOptions, 'debug' | 'log'>;

function decodeLayerImageData(layer: Layer, options: Pick<ReadOptions, 'useImageData' | 'throwForMissingFeatures' | 'totalMemoryLimit' | 'debug' | 'log'>) {
	let { throwForMissingFeatures, useImageData } = options;

	const imageData = getDataFromLayer(layer, LayerDataType.Layer, throwForMissingFeatures, options.totalMemoryLimit, options);
	setImageDataOrCanvas(layer, imageData, useImageData);
	if (options.totalMemoryLimit !== undefined) options.totalMemoryLimit -= imageData?.data.byteLength ?? 0;

	if (layer.mask) {
		const maskData = getDataFromLayer(layer, LayerDataType.Mask, throwForMissingFeatures, options.totalMemoryLimit, options);
		setImageDataOrCanvas(layer.mask, maskData, useImageData);
		if (options.totalMemoryLimit !== undefined) options.totalMemoryLimit -= maskData?.data.byteLength ?? 0;
	}

	if (layer.realMask) {
		const maskData = getDataFromLayer(layer, LayerDataType.RealMask, throwForMissingFeatures, options.totalMemoryLimit, options);
		setImageDataOrCanvas(layer.realMask, maskData, useImageData);
		if (options.totalMemoryLimit !== undefined) options.totalMemoryLimit -= maskData?.data.byteLength ?? 0;
	}

	delete layer.rawData;
}

enum LayerDataType {
	Layer,
	Mask,
	RealMask,
}

function getDataFromLayer(layer: Layer, read: LayerDataType, throwForMissingFeatures?: boolean, memoryLimit?: number, logOptions?: LogOptions) {
	if (!layer.rawData) return undefined;

	const { colorMode, bitsPerChannel, channels, large } = layer.rawData;
	const layerWidth = Math.max(0, (layer.right || 0) - (layer.left || 0));
	const layerHeight = Math.max(0, (layer.bottom || 0) - (layer.top || 0));
	const cmyk = colorMode === ColorMode.CMYK;

	let imageData: PixelData | undefined;
	let maskData: PixelData | undefined;
	let initializedAlpha = false;

	if (layerWidth && layerHeight && read === LayerDataType.Layer) {
		if (cmyk) {
			if (bitsPerChannel !== 8 && bitsPerChannel !== 16) throw new Error('bitsPerChannel not supported');
			imageData = createImageDataBitDepth(layerWidth, layerHeight, bitsPerChannel, 5, memoryLimit);
		} else {
			imageData = createImageDataBitDepth(layerWidth, layerHeight, bitsPerChannel, 4, memoryLimit);
		}
	}

	for (const { id, compression, data } of channels) {
		if (!data) continue;

		const dataReader = createReader(data.buffer, data.byteOffset, data.byteLength);
		dataReader.debug = !!logOptions?.debug;
		if (logOptions?.log) dataReader.log = logOptions.log;
		if (memoryLimit !== undefined) dataReader.totalMemoryLimit = Math.max(0, memoryLimit - (imageData?.data.byteLength ?? 0));

		if (id === ChannelID.UserMask || id === ChannelID.RealUserMask) {
			if (id === ChannelID.UserMask && read !== LayerDataType.Mask) continue;
			if (id === ChannelID.RealUserMask && read !== LayerDataType.RealMask) continue;

			const mask = id === ChannelID.UserMask ? layer.mask : layer.realMask;
			if (!mask) throw new Error(`Missing layer ${id === ChannelID.UserMask ? 'mask' : 'real mask'} data`);

			const maskWidth = Math.max(0, (mask.right || 0) - (mask.left || 0));
			const maskHeight = Math.max(0, (mask.bottom || 0) - (mask.top || 0));

			if (maskWidth && maskHeight) {
				maskData = createImageDataBitDepth(maskWidth, maskHeight, bitsPerChannel, 4, memoryLimit);
				if (memoryLimit !== undefined) dataReader.totalMemoryLimit = Math.max(0, dataReader.totalMemoryLimit! - maskData.data.byteLength);
				readData(dataReader, data.byteLength, maskData, compression, maskWidth, maskHeight, bitsPerChannel, 0, large, 4);
				setupGrayscale(maskData);
				resetAlpha(maskData, false);
			}
		} else {
			if (read !== LayerDataType.Layer) continue;

			const offset = offsetForChannel(id, cmyk);
			let targetData = imageData;

			if (offset < 0) {
				targetData = undefined;

				if (throwForMissingFeatures) {
					throw new Error(`Channel not supported: ${id}`);
				}
			}

			readData(dataReader, data.byteLength, targetData, compression, layerWidth, layerHeight, bitsPerChannel, offset, large, cmyk ? 5 : 4);
		}

		if (id === ChannelID.Transparency) {
			initializedAlpha = true;
		}
	}

	if (imageData) {
		if (colorMode === ColorMode.Grayscale) setupGrayscale(imageData);
		if (!initializedAlpha) resetAlpha(imageData, cmyk);

		if (cmyk) {
			const cmykData = imageData;
			const rgbMemoryLimit = memoryLimit === undefined ? undefined : Math.max(0, memoryLimit - cmykData.data.byteLength);
			imageData = createImageDataBitDepth(cmykData.width, cmykData.height, bitsPerChannel, 4, rgbMemoryLimit);
			cmykToRgb(cmykData, imageData, false);
		}
	}

	return read === LayerDataType.Layer ? imageData : maskData;
}

function readData(reader: PsdReader, length: number, pixels: PixelData | undefined, compression: Compression, width: number, height: number, bitDepth: number, offset: number, large: boolean, step: number) {
	if (!length) return;

	if (compression === Compression.RawData) {
		if (length !== (width * height * Math.floor(bitDepth / 8))) {
			warnOrThrow(reader, `Invalid length (${length}, ${width * height * Math.floor(bitDepth / 8)})`);
		}
		const data = readBytes(reader, length);
		readDataRaw(data, pixels, bitDepth, step, offset);
	} else if (compression === Compression.RleCompressed) {
		// const reader = createReader(data.buffer, data.byteOffset, data.byteLength);
		readDataRLE(reader, pixels, width, height, bitDepth, step, [offset], large);
	} else if (compression === Compression.ZipWithoutPrediction) {
		const data = readBytes(reader, length);
		readDataZip(data, pixels, width, height, bitDepth, step, offset, false, reader);
	} else if (compression === Compression.ZipWithPrediction) {
		const data = readBytes(reader, length);
		readDataZip(data, pixels, width, height, bitDepth, step, offset, true, reader);
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
		const opacity = readUint16(reader) / 100; // 0 - 100
		const kind = readUint8(reader);
		skipBytes(reader, left()); // 3 bytes of padding ?
		return { overlayColorSpace, colorSpace1, colorSpace2, colorSpace3, colorSpace4, opacity, kind };
	});
}

const fixOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];

function realignWithSignature(reader: PsdReader, isValid: (sig: string) => boolean) {
	const sigOffset = reader.offset;
	let sig = '';

	// attempt to fix broken document by realigning with the signature
	for (const offset of fixOffsets) {
		try {
			reader.offset = sigOffset + offset;
			sig = readSignature(reader);
		} catch { }
		if (isValid(sig)) break;
	}

	if (!isValid(sig)) {
		throw new Error(`Invalid signature: '${sig}' at 0x${(sigOffset).toString(16)}`);
	}

	return sig;
}

function isValidAdditionalInfoSignature(sig: string) {
	return sig === '8BIM' || sig === '8B64';
}

export function readAdditionalLayerInfo(reader: PsdReader, target: LayerAdditionalInfo, psd: Psd, imageResources: InternalImageResources) {
	const sig = realignWithSignature(reader, isValidAdditionalInfoSignature);
	const key = readSignature(reader);

	// `largeAdditionalInfoKeys` fallback, because some keys don't have 8B64 signature even when they are 64bit
	let u64 = sig === '8B64' || (reader.large && largeAdditionalInfoKeys.indexOf(key) !== -1);

	// these keys were written by older versions of this library with 32bit length and 8BIM signature,
	// 64bit length always has high 32bits set to 0 (lengths over 4GB are not supported)
	if (reader.large && sig === '8BIM' && largeAdditionalInfoKeysObserved.indexOf(key) !== -1) {
		// 32bit length of 0 is followed by signature of the next block, 64bit length would continue with its low 32bits
		const next = reader.offset + 8 <= reader.view.byteLength ? reader.view.getUint32(reader.offset + 4) : 0;
		const nextIsSignature = next === 0x3842494d /* 8BIM */ || next === 0x38423634 /* 8B64 */;
		u64 = reader.view.getUint32(reader.offset) === 0 && !nextIsSignature;
	}

	readSection(reader, 2, left => {
		const handler = infoHandlersMap[key];

		if (handler) {
			try {
				handler.read(reader, target, left, psd, imageResources);
			} catch (e) {
				if (reader.throwForMissingFeatures) throw e;
			}
		} else {
			reader.logMissingFeatures && key !== 'GenI' && key !== 'OCIO' && key !== 'CAI ' && reader.log(`Unhandled additional info: ${key}`);
			skipBytes(reader, left());
		}

		if (left()) {
			reader.logMissingFeatures && reader.log(`Unread ${left()} bytes left for additional info: ${key}`);
			skipBytes(reader, left());
		}
	}, false, u64);
}

function createImageDataBitDepth(width: number, height: number, bitDepth: number, channels: number, memoryLimit: number | undefined): PixelData {
	const sizeInBytes = width * height * channels * Math.max(1, bitDepth / 8);
	if (memoryLimit !== undefined && sizeInBytes > memoryLimit) throw new Error('Exceeded memory limit');

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
	const { width, height } = psd;

	if (supportedColorModes.indexOf(psd.colorMode!) === -1)
		throw new Error(`Color mode not supported: ${psd.colorMode}`);

	if (compression !== Compression.RawData && compression !== Compression.RleCompressed)
		throw new Error(`Compression type not supported: ${compression}`);

	const imageData = createImageDataBitDepth(width, height, bitsPerChannel, 4, reader.totalMemoryLimit);
	if (reader.totalMemoryLimit !== undefined) reader.totalMemoryLimit -= imageData.data.byteLength;
	resetImageData(imageData);

	switch (psd.colorMode) {
		case ColorMode.Bitmap: {
			if (bitsPerChannel !== 1) throw new Error('Invalid bitsPerChannel for bitmap color mode');

			const rowBytes = Math.ceil(width / 8);
			let bytes: Uint8Array;

			if (compression === Compression.RawData) {
				bytes = readBytes(reader, rowBytes * height);
			} else {
				bytes = new Uint8Array(rowBytes * height);
				readDataRLE(reader, { data: bytes, width: rowBytes, height }, rowBytes, height, 8, 1, [0], reader.large);
			}

			decodeBitmap(bytes, imageData.data, width, height);
			break;
		}
		case ColorMode.RGB:
		case ColorMode.Grayscale: {
			const colorChannels = psd.colorMode === ColorMode.Grayscale ? 1 : 3;
			const offsets = compositeChannelOffsets(reader, psd, colorChannels, 3);
			readCompositeChannels(reader, compression, imageData, bitsPerChannel, 4, offsets);

			if (psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(imageData);
			}
			break;
		}
		case ColorMode.Indexed: {
			if (bitsPerChannel !== 8) throw new Error('bitsPerChannel not supported');
			if (!psd.palette) throw new Error('Missing color palette');

			const offsets = compositeChannelOffsets(reader, psd, 1, -1);
			const indexedImageData: PixelData = { width, height, data: new Uint8Array(width * height) };
			readCompositeChannels(reader, compression, indexedImageData, 8, 1, offsets);
			indexedToRgb(indexedImageData, imageData, psd.palette, psd.imageResources?.transparencyIndex ?? -1);
			break;
		}
		case ColorMode.CMYK: {
			if (bitsPerChannel !== 8 && bitsPerChannel !== 16) throw new Error('bitsPerChannel not supported');

			const offsets = compositeChannelOffsets(reader, psd, 4, 4);
			const cmykImageData = createImageDataBitDepth(width, height, bitsPerChannel, 5, reader.totalMemoryLimit);

			resetAlpha(cmykImageData, true);
			readCompositeChannels(reader, compression, cmykImageData, bitsPerChannel, 5, offsets);
			cmykToRgb(cmykImageData, imageData, !!reader.globalAlpha);
			break;
		}
		default: throw new Error(`Color mode not supported: ${psd.colorMode}`);
	}

	// remove weird white matte (already removed when converting from CMYK)
	if (reader.globalAlpha && psd.colorMode !== ColorMode.CMYK) {
		removeWhiteMatte(imageData);
	}

	return imageData;
}

// returns target offset for each of the composite image channels stored in the file, -1 for channels that are skipped
function compositeChannelOffsets(reader: PsdReader, psd: Psd, colorChannels: number, alphaOffset: number) {
	const channelCount = psd.channels ?? (colorChannels + (reader.globalAlpha ? 1 : 0));
	if (channelCount < colorChannels) throw new Error(`Invalid channel count: ${channelCount}`);

	// First extra channel is transparency if document has global alpha (negative layer count). Some non-Photoshop
	// applications write transparency channel without setting global alpha, in that case extra channel is not
	// listed in alpha channel names (Photoshop names all user alpha channels / saved selections).
	// Photoshop also lists merged transparency as first alpha channel named "Transparency" (in documents marked with
	// Mtrn/Mt16/Mt32 additional info, or in some 16bit documents with layers stored in Lr16 without any other mark)
	const alphaNames = psd.imageResources?.alphaChannelNames ?? [];
	const namedChannels = alphaNames.length;
	const namedTransparency = !!reader.layersInGlobalInfo && alphaNames[0] === 'Transparency' && namedChannels === channelCount - colorChannels;
	const hasTransparency = reader.globalAlpha || namedTransparency || (channelCount - colorChannels) > namedChannels;
	const offsets: number[] = [];

	for (let i = 0; i < channelCount; i++) {
		if (i < colorChannels) {
			offsets.push(i);
		} else if (i === colorChannels && hasTransparency && alphaOffset >= 0) {
			offsets.push(alphaOffset);
		} else {
			// TODO: store these channels (alpha channels / saved selections, spot colors) in additional image data
			offsets.push(-1);
		}
	}

	return offsets;
}

function readCompositeChannels(reader: PsdReader, compression: Compression, pixelData: PixelData, bitsPerChannel: number, step: number, offsets: number[]) {
	if (compression === Compression.RawData) {
		const channelSize = pixelData.width * pixelData.height * bytesPerValue(bitsPerChannel);

		for (const offset of offsets) {
			if (offset < 0) {
				skipBytes(reader, channelSize);
			} else {
				readDataRaw(readBytes(reader, channelSize), pixelData, bitsPerChannel, step, offset);
			}
		}
	} else if (compression === Compression.RleCompressed) {
		readDataRLE(reader, pixelData, pixelData.width, pixelData.height, bitsPerChannel, step, offsets, reader.large);
	} else {
		throw new Error(`Compression not supported: ${compression}`);
	}
}

// un-premultiplies colors from white matte, used for composite image of documents with global alpha
function removeWhiteMatte({ data, width, height }: PixelData) {
	const size = width * height * 4;

	if (data instanceof Float32Array) {
		for (let i = 0; i < size; i += 4) {
			const a = data[i + 3];

			if (a > 0 && a < 1) {
				const ra = 1 / a;
				const invA = 1 - ra;

				for (let j = 0; j < 3; j++) {
					const v = data[i + j] * ra + invA;
					data[i + j] = v < 0 ? 0 : v;
				}
			}
		}
	} else if (data instanceof Uint16Array) {
		for (let i = 0; i < size; i += 4) {
			const pa = data[i + 3];

			if (pa !== 0 && pa !== 0xffff) {
				const ra = 0xffff / pa;
				const invA = 0xffff * (1 - ra);

				for (let j = 0; j < 3; j++) {
					const v = Math.round(data[i + j] * ra + invA);
					data[i + j] = v < 0 ? 0 : (v > 0xffff ? 0xffff : v);
				}
			}
		}
	} else {
		// Uint8ClampedArray clamps and rounds values on assignment
		for (let i = 0; i < size; i += 4) {
			const pa = data[i + 3];

			if (pa != 0 && pa != 255) {
				const a = pa / 255;
				const ra = 1 / a;
				const invA = 255 * (1 - ra);
				data[i + 0] = data[i + 0] * ra + invA;
				data[i + 1] = data[i + 1] * ra + invA;
				data[i + 2] = data[i + 2] * ra + invA;
			}
		}
	}
}

// converts value in 0-255 range to target range, rounding and clamping it
function toRange(value: number, max: number) {
	value = Math.round(value * (max / 255));
	return value <= 0 ? 0 : (value >= max ? max : value);
}

// Polynomial approximation of U.S. Web Coated (SWOP) v2 CMYK to RGB conversion (default CMYK profile of Photoshop).
// Coefficients are taken from pdf.js (DeviceCmykCS in src/core/colorspace.js, https://github.com/mozilla/pdf.js),
// Copyright 2012 Mozilla Foundation, licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0)
// cmyk - 8 or 16 bit data with 5 channels (cmyka), rgb - 8 or 16 bit data with 4 channels (rgba)
// removeMatte - colors are blended with white (no ink), used for composite image of documents with global alpha
function cmykToRgb(cmyk: PixelData, rgb: PixelData, removeMatte: boolean) {
	const size = rgb.width * rgb.height * 4;
	const srcData = cmyk.data;
	const dstData = rgb.data;
	const srcMax = srcData instanceof Uint16Array ? 0xffff : 0xff;
	const dstMax = dstData instanceof Uint16Array ? 0xffff : 0xff;

	for (let src = 0, dst = 0; dst < size; src += 5, dst += 4) {
		const a = srcData[src + 4];

		// image data stores inverted values (0 = 100% ink)
		let c = 1 - srcData[src] / srcMax;
		let m = 1 - srcData[src + 1] / srcMax;
		let y = 1 - srcData[src + 2] / srcMax;
		let k = 1 - srcData[src + 3] / srcMax;

		if (removeMatte && a > 0 && a < srcMax) {
			const ra = srcMax / a;
			c = Math.min(1, c * ra);
			m = Math.min(1, m * ra);
			y = Math.min(1, y * ra);
			k = Math.min(1, k * ra);
		}

		dstData[dst] = toRange(255 +
			c * (-4.387332384609988 * c + 54.48615194189176 * m + 18.82290502165302 * y + 212.25662451639585 * k - 285.2331026137004) +
			m * (1.7149763477362134 * m - 5.6096736904047315 * y - 17.873870861415444 * k - 5.497006427196366) +
			y * (-2.5217340131683033 * y - 21.248923337353073 * k + 17.5119270841813) +
			k * (-21.86122147463605 * k - 189.48180835922747), dstMax);
		dstData[dst + 1] = toRange(255 +
			c * (8.841041422036149 * c + 60.118027045597366 * m + 6.871425592049007 * y + 31.159100130055922 * k - 79.2970844816548) +
			m * (-15.310361306967817 * m + 17.575251261109482 * y + 131.35250912493976 * k - 190.9453302588951) +
			y * (4.444339102852739 * y + 9.8632861493405 * k - 24.86741582555878) +
			k * (-20.737325471181034 * k - 187.80453709719578), dstMax);
		dstData[dst + 2] = toRange(255 +
			c * (0.8842522430003296 * c + 8.078677503112928 * m + 30.89978309703729 * y - 0.23883238689178934 * k - 14.183576799673286) +
			m * (10.49593273432072 * m + 63.02378494754052 * y + 50.606957656360734 * k - 112.23884253719248) +
			y * (0.03296041114873217 * y + 115.60384449646641 * k - 193.58209356861505) +
			k * (-22.33816807309886 * k - 180.12613974708367), dstMax);
		dstData[dst + 3] = srcMax === dstMax ? a : Math.round(a * dstMax / srcMax);
	}
}

// transparencyIndex - palette index of transparent color (-1 if there's none)
function indexedToRgb(indexed: PixelData, rgb: PixelData, palette: RGB[], transparencyIndex: number) {
	const size = indexed.width * indexed.height;
	const srcData = indexed.data;
	const dstData = rgb.data;

	for (let src = 0, dst = 0; src < size; src++, dst += 4) {
		const index = srcData[src];
		const c = palette[index];
		dstData[dst + 0] = c.r;
		dstData[dst + 1] = c.g;
		dstData[dst + 2] = c.b;
		dstData[dst + 3] = index === transparencyIndex ? 0 : 255;
	}
}

// number of bytes used to store single channel value, 1-bit data is handled as bytes
function bytesPerValue(bitDepth: number) {
	switch (bitDepth) {
		case 1:
		case 8: return 1;
		case 16: return 2;
		case 32: return 4;
		default: throw new Error(`Invalid bitDepth (${bitDepth})`);
	}
}

function verifyArrayType(data: PixelArray, bytesPerValue: number) {
	if (data.BYTES_PER_ELEMENT !== bytesPerValue) {
		throw new Error('Invalid array types');
	}
}

// NOTE: `buffer` may alias input file data, it must not be modified here
function readDataRaw(buffer: Uint8Array, pixelData: PixelData | undefined, bitDepth: number, step: number, offset: number) {
	const bpv = bytesPerValue(bitDepth);

	if (!pixelData || offset < 0 || offset >= step) return;

	const data = pixelData.data;
	verifyArrayType(data, bpv);
	const size = Math.min(pixelData.width * pixelData.height, Math.floor(buffer.byteLength / bpv)) | 0;

	if (bpv === 1) {
		for (let i = 0, p = offset | 0; i < size; i++, p = (p + step) | 0) {
			data[p] = buffer[i];
		}
	} else if (bpv === 2) {
		for (let i = 0, j = 0, p = offset | 0; i < size; i++, j += 2, p = (p + step) | 0) {
			data[p] = (buffer[j] << 8) | buffer[j + 1];
		}
	} else {
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

		for (let i = 0, j = 0, p = offset | 0; i < size; i++, j += 4, p = (p + step) | 0) {
			data[p] = view.getFloat32(j, false);
		}
	}
}

function decodePredicted(data: Uint8Array, width: number, height: number) {
	for (let y = 0; y < height; y++) {
		const offset = y * width;

		for (let x = 1, o = offset + 1; x < width; x++, o++) {
			data[o] = data[o - 1] + data[o]; // Uint8Array wraps values on assignment
		}
	}
}

const zipOverflow = new Error('Decompressed data exceeds expected size');

// inflates data, stopping when output exceeds expected size (protects against zip bombs)
function inflateLimited(compressed: Uint8Array, expectedSize: number, reader: PsdReader | undefined) {
	const output = new Uint8Array(expectedSize);
	let position = 0;
	let overflow = false;

	const inflator = new Inflate({ chunkSize: Math.max(1024, Math.min(expectedSize, 0x10000)) });
	inflator.onData = (chunk: any) => {
		const data = chunk as Uint8Array;
		const count = Math.min(data.length, expectedSize - position);
		if (count > 0) output.set(count === data.length ? data : data.subarray(0, count), position);
		position += count;

		if (count < data.length) {
			overflow = true;
			throw zipOverflow;
		}
	};
	inflator.onEnd = (status: number) => {
		// default handler collects all the chunks into result, we only need the error status
		inflator.err = status;
		inflator.msg = (inflator as any).strm?.msg || '';
	};

	try {
		inflator.push(compressed, true);
	} catch (e) {
		if (e !== zipOverflow) throw e;
	}

	if (overflow) {
		if (reader) warnOrThrow(reader, zipOverflow.message);
	} else if (inflator.err) {
		throw new Error(`Invalid zip data: ${inflator.msg}`);
	}

	return output;
}

export function readDataZip(
	compressed: Uint8Array, pixelData: PixelData | undefined, width: number, height: number, bitDepth: number, step: number,
	offset: number, prediction: boolean, reader?: PsdReader
) {
	const bpv = bytesPerValue(bitDepth);

	if (!pixelData || offset < 0 || offset >= step) return;

	const data = pixelData.data;
	verifyArrayType(data, bpv);

	const expectedSize = width * height * bpv;
	if (reader) consumeMemory(reader, expectedSize);

	try {
		const decompressed = inflateLimited(compressed, expectedSize, reader);

		if (bpv === 1) {
			for (let y = 0, i = 0; y < height; y++) {
				let prev = 0;

				for (let x = 0, p = offset + y * width * step; x < width; x++, i++, p += step) {
					let v = decompressed[i];
					if (prediction) v = prev = (prev + v) & 0xff;
					data[p] = v;
				}
			}
		} else if (bpv === 2) {
			for (let y = 0, i = 0; y < height; y++) {
				let prev = 0;

				for (let x = 0, p = offset + y * width * step; x < width; x++, i += 2, p += step) {
					let v = (decompressed[i] << 8) | decompressed[i + 1];
					if (prediction) v = prev = (prev + v) & 0xffff;
					data[p] = v;
				}
			}
		} else {
			const dst = new Uint32Array(data.buffer, data.byteOffset, data.length);

			if (prediction) {
				// bytes are delta encoded per row and stored in planar order (all 1st bytes, all 2nd bytes, ...)
				decodePredicted(decompressed, width * 4, height);

				for (let y = 0, di = offset; y < height; y++) {
					let a = width * 4 * y;

					for (let x = 0; x < width; x++, a++, di += step) {
						const b = a + width;
						const c = b + width;
						const d = c + width;
						dst[di] = ((decompressed[a] << 24) | (decompressed[b] << 16) | (decompressed[c] << 8) | decompressed[d]) >>> 0;
					}
				}
			} else {
				const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);

				for (let i = 0, j = 0, di = offset, size = width * height; i < size; i++, j += 4, di += step) {
					dst[di] = view.getUint32(j, false);
				}
			}
		}
	} finally {
		if (reader) recoverMemory(reader, expectedSize);
	}
}

// decodes single PackBits row, returns number of decoded values
function decodeRLERow(src: Uint8Array, i: number, end: number, dst: PixelArray, p: number, step: number, count: number) {
	let x = 0;

	while (i < end && x < count) {
		const header = src[i++];

		if (header > 128) {
			if (i >= end) break;

			const value = src[i++];
			let n = 257 - header;
			if (n > count - x) n = count - x;
			x += n;

			for (; n > 0; n--, p += step) {
				dst[p] = value;
			}
		} else if (header < 128) {
			let n = header + 1;
			if (n > count - x) n = count - x;
			if (n > end - i) n = end - i;
			x += n;

			for (; n > 0; n--, p += step) {
				dst[p] = src[i++];
			}
		} else {
			// ignore 128
		}
	}

	return x;
}

// converts big-endian 16/32-bit values from bytes and writes them to `data` starting at `p` with `step`
function scatterValues(bytes: Uint8Array, count: number, bpv: number, data: PixelArray, p: number, step: number) {
	if (bpv === 2) {
		for (let x = 0, i = 0; x < count; x++, i += 2, p += step) {
			data[p] = (bytes[i] << 8) | bytes[i + 1];
		}
	} else {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

		for (let x = 0, i = 0; x < count; x++, i += 4, p += step) {
			data[p] = view.getFloat32(i, false);
		}
	}
}

// decodes RLE rows of single channel, each row starts at the beginning of the image row
function decodeRLEChannel(
	src: Uint8Array, lengths: Uint16Array | Uint32Array, li: number, pos: number, width: number, height: number,
	data: PixelArray, offset: number, step: number, bpv: number, row: Uint8Array | undefined
) {
	const srcEnd = src.length;
	const rowSize = width * bpv;

	for (let y = 0; y < height; y++, li++) {
		const rowStart = pos < srcEnd ? pos : srcEnd;
		pos += lengths[li];
		const rowEnd = pos < srcEnd ? pos : srcEnd;

		if (rowStart >= rowEnd) continue;

		if (bpv === 1) {
			decodeRLERow(src, rowStart, rowEnd, data, offset + y * width * step, step, width);
		} else {
			const decoded = decodeRLERow(src, rowStart, rowEnd, row!, 0, 1, rowSize);
			scatterValues(row!, Math.floor(decoded / bpv), bpv, data, offset + y * width * step, step);
		}
	}
}

export function readDataRLE(reader: PsdReader, pixelData: PixelData | undefined, width: number, height: number, bitDepth: number, step: number, offsets: number[], large: boolean) {
	const data = pixelData && pixelData.data;
	const rows = offsets.length * height;
	const lengthSize = large ? 4 : 2;

	consumeMemory(reader, rows * lengthSize);

	try {
		if ((reader.offset + rows * lengthSize) > reader.view.byteLength) {
			throw new Error('RLE row lengths exceed buffer length');
		}

		const lengths = large ? new Uint32Array(rows) : new Uint16Array(rows);
		let total = 0;

		if (large) {
			for (let i = 0; i < rows; i++) total += (lengths[i] = readUint32(reader));
		} else {
			for (let i = 0; i < rows; i++) total += (lengths[i] = readUint16(reader));
		}

		const start = reader.offset;
		const srcEnd = reader.view.byteLength;

		if (total > (srcEnd - start)) {
			// broken or truncated file, decode only data that is available
			warnOrThrow(reader, 'RLE data exceeds buffer length');
		}

		const bpv = bytesPerValue(bitDepth);
		if (data) verifyArrayType(data, bpv);

		const src = new Uint8Array(reader.view.buffer, reader.view.byteOffset, srcEnd);
		const row = (data && bpv > 1) ? new Uint8Array(width * bpv) : undefined;
		let pos = start;

		for (let c = 0, li = 0; c < offsets.length; c++, li += height) {
			const offset = offsets[c] | 0;
			const channelStart = pos;

			for (let y = 0; y < height; y++) pos += lengths[li + y];

			if (data && offset >= 0 && offset < step) {
				decodeRLEChannel(src, lengths, li, channelStart, width, height, data, offset, step, bpv, row);
			}
		}

		reader.offset = pos;
	} finally {
		recoverMemory(reader, rows * lengthSize);
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

	while (length % round) { length++; end++; }
	// while (end % round) end++;

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
		case ColorSpace.CMYK: { // 0 = 100% ink
			const c = (0xffff - readUint16(reader)) / 257;
			const m = (0xffff - readUint16(reader)) / 257;
			const y = (0xffff - readUint16(reader)) / 257;
			const k = (0xffff - readUint16(reader)) / 257;
			return { c, m, y, k };
		}
		case ColorSpace.Lab: {
			const l = readInt16(reader) / 10000;
			const ta = readInt16(reader);
			const tb = readInt16(reader);
			const a = normalizeLabAB(ta, 100);
			const b = normalizeLabAB(tb, 100);
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

const MAX_PATTERN_SIZE = 30000;

// reads pattern, unsupported or invalid patterns are skipped (returns undefined) unless throwForMissingFeatures is set
export function readPatternSafe(reader: PsdReader): PatternInfo | undefined {
	let length = reader.view.getUint32(reader.offset);
	while (length % 4) length++;
	const end = reader.offset + 4 + length;

	try {
		return readPattern(reader);
	} catch (e) {
		if (reader.throwForMissingFeatures) throw e;
		reader.logMissingFeatures && reader.log(`Skipped pattern: ${(e as Error).message}`);
		reader.offset = end;
		return undefined;
	}
}

export function readPattern(reader: PsdReader): PatternInfo {
	let length = readUint32(reader);
	while (length % 4) length++;
	const end = reader.offset + length;
	const version = readUint32(reader);
	if (version !== 1) throw new Error(`Invalid pattern version: ${version}`);

	const colorMode = readUint32(reader) as ColorMode;
	const x = readInt16(reader);
	const y = readInt16(reader);

	// we only support RGB, grayscale, indexed and CMYK for now
	if (colorMode !== ColorMode.RGB && colorMode !== ColorMode.Grayscale && colorMode !== ColorMode.Indexed && colorMode !== ColorMode.CMYK) {
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

		// some writers follow the palette with 4 extra bytes (unknown)
		if (reader.view.getUint32(reader.offset) !== 3) skipBytes(reader, 4);
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
	if (width < 0 || height < 0) throw new Error('Invalid pattern bounds');
	if (width > MAX_PATTERN_SIZE || height > MAX_PATTERN_SIZE) throw new Error(`Pattern too large (${width}x${height})`);
	if (channelsCount > 64) throw new Error(`Invalid pattern channel count: ${channelsCount}`);
	// channels cover whole pattern, each 2 bytes of RLE data can produce at most 128 bytes
	if (width * height > (Math.min(end, reader.view.byteLength) - reader.offset) * 64) throw new Error('Pattern data out of bounds');
	const size = width * height * 4;
	consumeMemory(reader, size);
	const data = new Uint8Array(size);

	for (let i = 3; i < data.byteLength; i += 4) {
		data[i] = 255;
	}

	// first written arrays are color channels, next one is transparency (Photoshop stores it in the last, sheet mask, array)
	const colorChannels = colorMode === ColorMode.RGB ? 3 : (colorMode === ColorMode.CMYK ? 4 : 1);
	// CMYK channels are decoded into separate buffer (5 values per pixel, inverted, 0 = 100% ink) and converted to RGB at the end
	const cmyk = colorMode === ColorMode.CMYK ? new Uint8Array(width * height * 5).fill(255) : undefined;
	if (cmyk) consumeMemory(reader, cmyk.byteLength);
	const alphaTarget = cmyk ? 4 : 3;

	for (let i = 0, ch = 0; i < (channelsCount + 2) && reader.offset + 4 <= end; i++) {
		const has = readUint32(reader);
		if (!has) continue;

		const length = readUint32(reader);
		if (!length) continue;
		if (length < 23) throw new Error('Invalid pattern channel length');

		const pixelDepth = readUint32(reader);
		const ctop = readUint32(reader);
		const cleft = readUint32(reader);
		const cbottom = readUint32(reader);
		const cright = readUint32(reader);
		const pixelDepth2 = readUint16(reader);
		const compressionMode = readUint8(reader); // 0 - raw, 1 - rle
		const cdata = readBytes(reader, length - 23);
		const depth = (pixelDepth2 === 8 || pixelDepth2 === 16 || pixelDepth2 === 32) ? pixelDepth2 : pixelDepth;

		if (depth !== 8 && depth !== 16 && depth !== 32) throw new Error(`Unsupported pattern pixel depth: ${depth}`);

		if (ctop < top || cleft < left || cbottom > bottom || cright > right || cbottom < ctop || cright < cleft) {
			throw new Error('Pattern channel bounds outside of pattern bounds');
		}

		const target = ch < colorChannels ? ch : (ch === colorChannels ? alphaTarget : -1);
		ch++;

		if (target === -1) continue;

		const w = cright - cleft;
		const h = cbottom - ctop;
		const rowBytes = w * (depth / 8);
		const channelSize = rowBytes * h;
		let bytes: Uint8Array;

		if (compressionMode === 0) {
			if (cdata.byteLength < channelSize) throw new Error('Pattern channel data out of bounds');
			bytes = cdata;
		} else if (compressionMode === 1) {
			// each 2 bytes of RLE data can produce at most 128 bytes
			if (channelSize > cdata.byteLength * 64) throw new Error('Pattern channel data out of bounds');

			consumeMemory(reader, channelSize);
			bytes = new Uint8Array(channelSize);
			const cdataReader = createReader(cdata.buffer, cdata.byteOffset, cdata.byteLength);
			readDataRLE(cdataReader, { data: bytes, width: rowBytes, height: h }, rowBytes, h, 8, 1, [0], false);
		} else {
			throw new Error('Invalid pattern compression mode');
		}

		const ox = cleft - left;
		const oy = ctop - top;

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const src = x + y * w;
				const dst = (ox + x + (y + oy) * width) * 4;
				const value = depth === 8 ? bytes[src] : patternValueTo8bit(bytes, src, depth);

				if (cmyk) {
					cmyk[(ox + x + (y + oy) * width) * 5 + target] = value;
				} else if (target === 3) {
					data[dst + 3] = value;
				} else if (colorMode === ColorMode.Indexed) {
					const color = palette[value];
					data[dst + 0] = color.r;
					data[dst + 1] = color.g;
					data[dst + 2] = color.b;
				} else if (colorMode === ColorMode.Grayscale) {
					data[dst + 0] = value;
					data[dst + 1] = value;
					data[dst + 2] = value;
				} else {
					data[dst + target] = value;
				}
			}
		}

		if (compressionMode === 1) recoverMemory(reader, channelSize);
	}

	if (cmyk) {
		cmykToRgb({ width, height, data: cmyk }, { width, height, data }, false);
		recoverMemory(reader, cmyk.byteLength);
	}

	reader.offset = end;

	return { id, name, x, y, bounds: { x: left, y: top, w: width, h: height }, data };
}

// converts big-endian 16bit or 32bit (float) value at given index to 8bit value
function patternValueTo8bit(bytes: Uint8Array, index: number, depth: number) {
	if (depth === 16) {
		return Math.round(((bytes[index * 2] << 8) | bytes[index * 2 + 1]) / 257);
	} else {
		const view = new DataView(bytes.buffer, bytes.byteOffset + index * 4, 4);
		const value = view.getFloat32(0, false);
		return value > 0 ? (value < 1 ? Math.round(value * 255) : 255) : 0;
	}
}

export function consumeMemory(reader: PsdReader, size: number) {
	if (!(size >= 0)) throw new Error('Invalid size');

	if (reader.totalMemoryLimit !== undefined) {
		if (reader.totalMemoryLimit < size) throw new Error('Exceeded memory limit');
		reader.totalMemoryLimit -= size;
	}
}

function recoverMemory(reader: PsdReader, size: number) {
	if (reader.totalMemoryLimit !== undefined) {
		reader.totalMemoryLimit += size;
	}
}
