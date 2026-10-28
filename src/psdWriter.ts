import { Psd, Layer, LayerAdditionalInfo, ColorMode, SectionDividerType, WriteOptions, Color, GlobalLayerMaskInfo, PixelData, LayerMaskData, Compression, ChannelID, PatternInfo } from './psd';
import { hasAlpha, createCanvas, writeDataRLE, LayerChannelData, ChannelData, offsetForChannel, createImageData, fromBlendMode, clamp, LayerMaskFlags, MaskParams, ColorSpace, Bounds, largeAdditionalInfoKeys, writeDataZipWithoutPrediction, imageDataToCanvas, denormalizeLabAB, PlanarData, planarToBytes, writeDataRLEBytes, writeDataZipWithPrediction, rgbToCmykValues } from './helpers';
import { deflate as deflateSync } from 'pako';
import { ExtendedWriteOptions, infoHandlers, infoHandlersMap } from './additionalInfo';
import { InternalImageResources, resourceHandlers } from './imageResources';
import { getCompositeImageData, getLayerImageData, getLayerMaskImageData, getLayerRealMaskImageData } from './psdReader';

export interface PsdWriter {
	offset: number;
	buffer: ArrayBuffer;
	view: DataView;
	tempBuffer: Uint8Array | undefined;
	logMissingFeatures?: boolean;
	log(...args: any[]): void;
}

export function createWriter(size = 4096): PsdWriter {
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	const offset = 0;
	return { buffer, view, offset, tempBuffer: undefined, log: console.log };
}

export function getWriterBuffer(writer: PsdWriter) {
	return writer.buffer.slice(0, writer.offset);
}

export function getWriterBufferNoCopy(writer: PsdWriter) {
	return new Uint8Array(writer.buffer, 0, writer.offset);
}

export function writeUint8(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 1);
	writer.view.setUint8(offset, value);
}

export function writeInt16(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 2);
	writer.view.setInt16(offset, value, false);
}

export function writeUint16(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 2);
	writer.view.setUint16(offset, value, false);
}

export function writeUint16LE(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 2);
	writer.view.setUint16(offset, value, true);
}

export function writeInt32(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setInt32(offset, value, false);
}

export function writeInt32LE(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setInt32(offset, value, true);
}

export function writeUint32(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setUint32(offset, value, false);
}

export function writeFloat32(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setFloat32(offset, value, false);
}

export function writeFloat64(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 8);
	writer.view.setFloat64(offset, value, false);
}

// 32-bit fixed-point number 16.16
export function writeFixedPoint32(writer: PsdWriter, value: number) {
	writeInt32(writer, value * (1 << 16));
}

// 32-bit fixed-point number 8.24
export function writeFixedPointPath32(writer: PsdWriter, value: number) {
	writeInt32(writer, value * (1 << 24));
}

export function writeBytes(writer: PsdWriter, buffer: Uint8Array | undefined) {
	if (buffer) {
		ensureSize(writer, writer.offset + buffer.length);
		const bytes = new Uint8Array(writer.buffer);
		bytes.set(buffer, writer.offset);
		writer.offset += buffer.length;
	}
}

export function writeZeros(writer: PsdWriter, count: number) {
	for (let i = 0; i < count; i++) {
		writeUint8(writer, 0);
	}
}

export function writeSignature(writer: PsdWriter, signature: string) {
	if (signature.length !== 4) throw new Error(`Invalid signature: '${signature}'`);

	for (let i = 0; i < 4; i++) {
		writeUint8(writer, signature.charCodeAt(i));
	}
}

export function writeAsciiString(writer: PsdWriter, text: string) {
	for (let i = 0; i < text.length; i++) {
		writeUint8(writer, text.charCodeAt(i));
	}
}

export function writePascalString(writer: PsdWriter, text: string, padTo: number) {
	let length = text.length;
	if (length > 255) throw new Error(`String too long`);

	writeUint8(writer, length);

	for (let i = 0; i < length; i++) {
		const code = text.charCodeAt(i);
		// writeUint8(writer, code); // for testing
		writeUint8(writer, code < 128 ? code : '?'.charCodeAt(0));
	}

	while (++length % padTo) {
		writeUint8(writer, 0);
	}
}

export function writeUnicodeStringWithoutLength(writer: PsdWriter, text: string) {
	for (let i = 0; i < text.length; i++) {
		writeUint16(writer, text.charCodeAt(i));
	}
}

export function writeUnicodeStringWithoutLengthLE(writer: PsdWriter, text: string) {
	for (let i = 0; i < text.length; i++) {
		writeUint16LE(writer, text.charCodeAt(i));
	}
}

export function writeUnicodeString(writer: PsdWriter, text: string) {
	writeUint32(writer, text.length);
	writeUnicodeStringWithoutLength(writer, text);
}

export function writeUnicodeStringWithPadding(writer: PsdWriter, text: string) {
	writeUint32(writer, text.length + 1);

	for (let i = 0; i < text.length; i++) {
		writeUint16(writer, text.charCodeAt(i));
	}

	writeUint16(writer, 0);
}

// Worst-case size of writeDataRLE output for a single channel: per row the byte count (2 bytes, 4 for PSB)
// plus PackBits data, which in the worst case is all literal runs of up to 128 bytes, each with 1 header byte.
export function getRLEChannelBound(width: number, height: number, large: boolean) {
	return height * ((large ? 4 : 2) + width + Math.ceil(width / 128));
}

function getLargestLayerSize(layers: Layer[] = [], large: boolean): number {
	let max = 0;

	for (const layer of layers) {
		for (const target of [layer, layer.mask, layer.realMask]) {
			if (target) {
				const { width, height } = getLayerDimentions(target);
				max = Math.max(max, getRLEChannelBound(width, height, large));
			}
		}

		if (layer.children) {
			max = Math.max(max, getLargestLayerSize(layer.children, large));
		}
	}

	return max;
}

export function writeUint64(writer: PsdWriter, value: number) {
	writeUint32(writer, Math.floor(value / 0x100000000));
	writeUint32(writer, value >>> 0);
}

export function writeSection(writer: PsdWriter, round: number, func: () => void, writeTotalLength = false, large = false) {
	const offset = writer.offset;
	if (large) writeUint32(writer, 0);
	writeUint32(writer, 0);
	const start = writer.offset;

	func();

	let length = writer.offset - start;
	let len = length;

	while (len % round) {
		writeUint8(writer, 0);
		len++;
	}

	if (writeTotalLength) {
		length = len;
	}

	if (large) {
		writer.view.setUint32(offset, Math.floor(length / 0x100000000), false);
		writer.view.setUint32(offset + 4, length >>> 0, false);
	} else {
		if (length > 0xffffffff) throw new Error('Section too large, use PSB format instead');
		writer.view.setUint32(offset, length, false);
	}
}

function verifyPixelData(data: PixelData | undefined, name: string) {
	// check element size instead of instanceof, so arrays from other realms (iframes, workers, vm) are accepted
	const bytesPerElement = data && (data.data as any).BYTES_PER_ELEMENT;
	if (bytesPerElement !== undefined && bytesPerElement !== 1 && bytesPerElement !== 2 && !(data!.data instanceof Float32Array)) {
		throw new Error(`${name} has incorrect bitDepth (only Uint8Array, Uint8ClampedArray, Uint16Array and Float32Array data is supported for writing)`);
	}
}

// supported bit depths for each color mode
const writeBitDepths: { [colorMode: number]: number[] | undefined; } = {
	[ColorMode.Bitmap]: [1],
	[ColorMode.Grayscale]: [8, 16, 32],
	[ColorMode.Indexed]: [8],
	[ColorMode.RGB]: [8, 16, 32],
	[ColorMode.CMYK]: [8, 16],
};

const colorModeNames: { [colorMode: number]: string; } = {
	[ColorMode.Bitmap]: 'Bitmap', [ColorMode.Grayscale]: 'Grayscale', [ColorMode.Indexed]: 'Indexed', [ColorMode.RGB]: 'RGB',
	[ColorMode.CMYK]: 'CMYK', [ColorMode.Multichannel]: 'Multichannel', [ColorMode.Duotone]: 'Duotone', [ColorMode.Lab]: 'Lab',
};

function colorChannelsCount(colorMode: ColorMode) {
	return colorMode === ColorMode.RGB ? 3 : (colorMode === ColorMode.CMYK ? 4 : 1);
}

// HDR toning settings that Photoshop stores in color mode data of 32bit documents (default values of new document),
// Photoshop refuses to open 32bit documents without them
const hdrToningData = [
	104, 100, 114, 116, 0, 0, 0, 3, 62, 107, 133, 31, 0, 0, 0, 2, 0, 0, 0, 7, 0, 76, 0, 105, 0, 110, 0, 101, 0, 97, 0, 114, 0, 0,
	0, 2, 0, 2, 0, 0, 0, 0, 0, 255, 0, 255, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 65, 128, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 63, 128, 0, 0,
	104, 100, 114, 97, 0, 0, 0, 6, 0, 0, 0, 0, 65, 160, 0, 0, 65, 240, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 63, 128, 0, 0, 0, 0, 0, 0,
	0, 0,
];

function verifyBitCount(target: Psd | Layer) {
	target.children?.forEach(verifyBitCount);

	verifyPixelData(target.imageData, 'imageData');

	if ('mask' in target) verifyPixelData(target.mask?.imageData, 'mask imageData');
	if ('realMask' in target) verifyPixelData(target.realMask?.imageData, 'realMask imageData');
}

export function writePsd(writer: PsdWriter, psd: Psd, options: WriteOptions = {}) {
	if (!(+psd.width > 0 && +psd.height > 0))
		throw new Error('Invalid document size');

	if ((psd.width > 30000 || psd.height > 30000) && !options.psb)
		throw new Error('Document size is too large (max is 30000x30000, use PSB format instead)');

	const colorMode = psd.colorMode ?? ColorMode.RGB;
	const bitsPerChannel = psd.bitsPerChannel ?? (colorMode === ColorMode.Bitmap ? 1 : 8);
	const bitDepths = writeBitDepths[colorMode];

	if (!bitDepths)
		throw new Error(`${colorModeNames[colorMode] ?? colorMode} color mode is not supported for writing`);

	if (bitDepths.indexOf(bitsPerChannel) === -1)
		throw new Error(`bitsPerChannel ${bitsPerChannel} is not supported for writing in ${colorModeNames[colorMode]} color mode`);

	// Photoshop doesn't support layers in bitmap and indexed color modes
	const layersAllowed = colorMode !== ColorMode.Bitmap && colorMode !== ColorMode.Indexed;

	if (!layersAllowed && psd.children?.length)
		throw new Error(`Layers are not supported in ${colorModeNames[colorMode]} color mode`);

	if (colorMode === ColorMode.Indexed && !psd.palette)
		throw new Error('Missing color palette for Indexed color mode');

	if (options.log) writer.log = options.log;
	if (options.logMissingFeatures) writer.logMissingFeatures = true;

	const layers: Layer[] = [];
	addChildren(layers, psd.children);
	if (!layers.length && layersAllowed) layers.push({});

	verifyBitCount(psd);

	const imageResources: InternalImageResources = { ...psd.imageResources };
	const opt: ExtendedWriteOptions = { ...options, layerIds: new Set(), layerToId: new Map(), colorMode, bitsPerChannel };
	// 16 and 32 bit documents store layers in Lr16 / Lr32 section of global additional info
	const layersInGlobalInfo = bitsPerChannel === 16 || bitsPerChannel === 32;

	if (opt.generateThumbnail) {
		imageResources.thumbnail = createThumbnail(psd);
	}

	let imageData = psd.imageData;

	if (!imageData && psd.canvas) {
		imageData = psd.canvas.getContext('2d')!.getImageData(0, 0, psd.canvas.width, psd.canvas.height);
	}

	if (!imageData && psd.rawCompositeData) { // read with `useRawData` option
		imageData = getCompositeImageData(psd);
	}

	if (imageData && (psd.width !== imageData.width || psd.height !== imageData.height))
		throw new Error('Document canvas must have the same size as document');

	const globalAlpha = !!imageData && layersAllowed && hasAlpha(imageData);
	// only used for encoding a single layer channel at a time, composite image is encoded directly into the writer buffer
	writer.tempBuffer = new Uint8Array(getLargestLayerSize(psd.children, !!options.psb));

	// header
	writeSignature(writer, '8BPS');
	writeUint16(writer, options.psb ? 2 : 1); // version
	writeZeros(writer, 6);
	writeUint16(writer, colorChannelsCount(colorMode) + (globalAlpha ? 1 : 0)); // channels
	writeUint32(writer, psd.height);
	writeUint32(writer, psd.width);
	writeUint16(writer, bitsPerChannel); // bits per channel
	writeUint16(writer, colorMode);

	// color mode data
	writeSection(writer, 1, () => {
		if (colorMode === ColorMode.Indexed) {
			const palette = psd.palette!;
			for (let i = 0; i < 256; i++) writeUint8(writer, palette[i]?.r ?? 0);
			for (let i = 0; i < 256; i++) writeUint8(writer, palette[i]?.g ?? 0);
			for (let i = 0; i < 256; i++) writeUint8(writer, palette[i]?.b ?? 0);
		} else if (bitsPerChannel === 32) {
			writeBytes(writer, new Uint8Array(hdrToningData));
		}
	});

	// image resources

	imageResources.layersGroup = layers.map(l => l.linkGroup || 0);
	imageResources.layerGroupsEnabledId = layers.map(l => l.linkGroupEnabled == false ? 0 : 1);

	writeSection(writer, 1, () => {
		for (const handler of resourceHandlers) {
			const has = handler.has(imageResources);
			const count = has === false ? 0 : (has === true ? 1 : has);
			for (let i = 0; i < count; i++) {
				const id = handler.keyCount > 1 ? handler.key + i : handler.key;
				const name = handler.name ? handler.name(imageResources, i) : '';
				writeSignature(writer, '8BIM');
				writeUint16(writer, id);
				writePascalString(writer, name, 2);
				writeSection(writer, 2, () => handler.write(writer, imageResources, i, psd));
			}
		}
	});

	// layer and mask info
	writeSection(writer, 2, () => {
		if (layersInGlobalInfo || !layersAllowed) {
			writeSection(writer, 4, () => { }, true, opt.psb); // empty layer info
		} else {
			writeLayerInfo(writer, layers, psd, globalAlpha, opt);
		}

		writeGlobalLayerMaskInfo(writer, psd.globalLayerMaskInfo);

		if (layersInGlobalInfo) {
			if (globalAlpha) writeGlobalInfoSection(writer, bitsPerChannel === 16 ? 'Mt16' : 'Mt32', !!opt.psb, () => { });
			writeGlobalInfoSection(writer, bitsPerChannel === 16 ? 'Lr16' : 'Lr32', !!opt.psb, () => {
				writeLayerInfoData(writer, layers, psd, globalAlpha, opt);
			});
		}

		writeAdditionalLayerInfo(writer, psd, psd, opt);
	}, undefined, !!opt.psb);

	writer.tempBuffer = undefined;

	// image data
	if (colorMode === ColorMode.RGB && bitsPerChannel === 8 && (!imageData || is8bit(imageData))) {
		writeUint16(writer, Compression.RleCompressed); // Photoshop doesn't support zip compression of composite image data

		const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
		const data = getCompositeData(imageData, psd.width, psd.height, globalAlpha);

		// encode directly into the writer buffer
		const maxSize = channels.length * getRLEChannelBound(data.width, data.height, !!options.psb);
		ensureSize(writer, writer.offset + maxSize);
		const buffer = new Uint8Array(writer.buffer, writer.offset, maxSize);
		writer.offset += writeDataRLE(buffer, data, channels, !!options.psb).length;
	} else {
		writeCompositeImageData(writer, psd, imageData, colorMode, bitsPerChannel, globalAlpha, !!options.psb);
	}
}

function writeGlobalInfoSection(writer: PsdWriter, key: string, psb: boolean, func: () => void) {
	writeSignature(writer, psb ? '8B64' : '8BIM');
	writeSignature(writer, key);
	writeSection(writer, 4, func, false, psb);
}

function is8bit(data: PixelData) {
	return (data.data as any).BYTES_PER_ELEMENT === 1;
}

// converts image data (8, 16 or 32 bit RGBA data) to channels of the document color mode and bit depth
function getPlanarChannels(imageData: PixelData, colorMode: ColorMode, bitsPerChannel: number, matte: boolean) {
	const { data, width, height } = imageData;
	const size = width * height;
	const srcFloat = data instanceof Float32Array;
	const srcMax = srcFloat ? 1 : (data instanceof Uint16Array ? 0xffff : 0xff);
	const dstFloat = bitsPerChannel === 32;
	const dstMax = dstFloat ? 1 : (bitsPerChannel === 16 ? 0xffff : 0xff);
	const colorCount = colorChannelsCount(colorMode);
	const create = () => dstFloat ? new Float32Array(size) : (bitsPerChannel === 16 ? new Uint16Array(size) : new Uint8Array(size));
	const colors: PlanarData[] = [];
	for (let i = 0; i < colorCount; i++) colors.push(create());
	const alpha = create();

	// color values are gamma corrected when converting between float (linear) and integer values (same as imageDataToCanvas)
	const toNormalized = (v: number) => srcFloat ? Math.pow(clamp(v, 0, 1), 1 / 2.2) : v / srcMax;
	const fromNormalized = (v: number) => dstFloat ? Math.pow(v, 2.2) : Math.round(clamp(v, 0, 1) * dstMax);
	const sameType = srcFloat === dstFloat && srcMax === dstMax;
	const convertColor = (v: number) => sameType ? (dstFloat ? v : Math.round(v)) : fromNormalized(toNormalized(v));
	const convertAlpha = (v: number) => sameType ? v : (dstFloat ? v / srcMax : Math.round(clamp(v / srcMax, 0, 1) * dstMax));
	const cmyk = [0, 0, 0, 0];

	for (let i = 0, p = 0; i < size; i++, p += 4) {
		const a = data[p + 3];
		const alphaValue = convertAlpha(a);
		alpha[i] = alphaValue;
		// composite image colors are blended with white (or no ink) for documents with transparency
		const blend = matte && a !== srcMax && a > 0 ? clamp(a / srcMax, 0, 1) : 1;

		if (colorMode === ColorMode.CMYK) {
			rgbToCmykValues(toNormalized(data[p]), toNormalized(data[p + 1]), toNormalized(data[p + 2]), cmyk);

			for (let j = 0; j < 4; j++) {
				colors[j][i] = Math.round((1 - clamp(cmyk[j] * blend, 0, 1)) * dstMax); // stored inverted (0 = 100% ink)
			}
		} else {
			for (let j = 0; j < colorCount; j++) {
				let value: number;

				if (colorMode === ColorMode.RGB) {
					value = convertColor(data[p + j]);
				} else {
					const r = data[p], g = data[p + 1], b = data[p + 2];
					value = convertColor((r === g && g === b) ? r : (0.299 * r + 0.587 * g + 0.114 * b));
				}

				if (blend !== 1) value = dstFloat ? value * blend + 1 - blend : Math.round(value * blend + dstMax * (1 - blend));
				colors[j][i] = value;
			}
		}
	}

	return { colors, alpha };
}

function encodeChannel(values: PlanarData, width: number, height: number, options: WriteOptions) {
	if (!(values instanceof Uint8Array)) {
		return { data: writeDataZipWithPrediction(values, width, height), compression: Compression.ZipWithPrediction };
	} else if (options.compress) {
		return { data: deflateSync(values), compression: Compression.ZipWithoutPrediction };
	} else {
		return { data: writeDataRLEBytes(values, width, height, !!options.psb), compression: Compression.RleCompressed };
	}
}

function writeCompositeImageData(
	writer: PsdWriter, psd: Psd, imageData: PixelData | undefined, colorMode: ColorMode, bitsPerChannel: number, globalAlpha: boolean, psb: boolean
) {
	const { width, height } = psd;
	const data = imageData ?? { data: new Uint8Array(width * height * 4), width, height };
	const parts: Uint8Array[] = [];

	if (colorMode === ColorMode.Bitmap || colorMode === ColorMode.Indexed) {
		const values = colorMode === ColorMode.Bitmap ?
			getBitmapData(data) :
			getIndexedData(data, psd.palette!, psd.imageResources?.transparencyIndex);
		const rowBytes = colorMode === ColorMode.Bitmap ? Math.ceil(width / 8) : width;

		if (colorMode === ColorMode.Bitmap) {
			writeUint16(writer, Compression.RawData);
			parts.push(values);
		} else {
			writeUint16(writer, Compression.RleCompressed);
			parts.push(writeDataRLEBytes(values, rowBytes, height, psb));
		}
	} else {
		const { colors, alpha } = getPlanarChannels(data, colorMode, bitsPerChannel, globalAlpha);
		const channels = globalAlpha ? [...colors, alpha] : colors;

		if (bitsPerChannel === 8) {
			// row byte counts for all channels are stored before data of all channels
			const encoded = channels.map(c => writeDataRLEBytes(c as Uint8Array, width, height, psb));
			const countsSize = height * (psb ? 4 : 2);
			writeUint16(writer, Compression.RleCompressed);
			for (const e of encoded) parts.push(e.subarray(0, countsSize));
			for (const e of encoded) parts.push(e.subarray(countsSize));
		} else {
			writeUint16(writer, Compression.RawData); // Photoshop writes 16 and 32 bit composite image without compression
			for (const c of channels) parts.push(planarToBytes(c));
		}
	}

	for (const part of parts) writeBytes(writer, part);
}

function getBitmapData({ data, width, height }: PixelData) {
	const rowBytes = Math.ceil(width / 8);
	const result = new Uint8Array(rowBytes * height);
	const max = data instanceof Float32Array ? 1 : (data instanceof Uint16Array ? 0xffff : 0xff);

	for (let y = 0, p = 0; y < height; y++) {
		for (let x = 0; x < width; x++, p += 4) {
			const a = data[p + 3] / max;
			const value = ((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / max) * a + (1 - a); // blend with white
			if (value < 0.5) result[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7); // 1 = black
		}
	}

	return result;
}

function getIndexedData({ data, width, height }: PixelData, palette: { r: number; g: number; b: number; }[], transparencyIndex: number | undefined) {
	const size = width * height;
	const result = new Uint8Array(size);
	const shift = data instanceof Uint16Array ? 8 : 0;
	const cache = new Map<number, number>();

	for (let i = 0; i < palette.length && i < 256; i++) {
		const key = (palette[i].r << 16) | (palette[i].g << 8) | palette[i].b;
		if (i !== transparencyIndex && !cache.has(key)) cache.set(key, i);
	}

	for (let i = 0, p = 0; i < size; i++, p += 4) {
		const read = (v: number) => data instanceof Float32Array ? Math.round(Math.pow(clamp(v, 0, 1), 1 / 2.2) * 255) : (v >>> shift);
		const a = data instanceof Float32Array ? data[p + 3] * 255 : (data[p + 3] >>> shift);

		if (transparencyIndex !== undefined && transparencyIndex >= 0 && a < 128) {
			result[i] = transparencyIndex;
			continue;
		}

		const r = read(data[p]), g = read(data[p + 1]), b = read(data[p + 2]);
		const key = (r << 16) | (g << 8) | b;
		let index = cache.get(key);

		if (index === undefined) {
			// use closest color from the palette
			let best = Infinity;
			index = 0;

			for (let j = 0; j < palette.length && j < 256; j++) {
				if (j === transparencyIndex) continue;
				const dr = palette[j].r - r, dg = palette[j].g - g, db = palette[j].b - b;
				const distance = dr * dr + dg * dg + db * db;
				if (distance < best) { best = distance; index = j; }
			}

			cache.set(key, index);
		}

		result[i] = index;
	}

	return result;
}

function getCompositeData(imageData: PixelData | undefined, width: number, height: number, globalAlpha: boolean): PixelData {
	if (!imageData) return { data: new Uint8Array(width * height * 4), width, height };

	const size = width * height * 4;
	const src = imageData.data;
	let dst: Uint8Array | undefined = undefined;

	// add weird white matte (copy the data only if there are semi-transparent pixels)
	if (globalAlpha) {
		for (let i = 0; i < size; i += 4) {
			const pa = src[i + 3];
			if (pa != 0 && pa != 255) {
				if (!dst) dst = new Uint8Array(src.buffer, src.byteOffset, size).slice();
				const a = pa / 255;
				const ra = 255 * (1 - a);
				dst[i + 0] = src[i + 0] * a + ra;
				dst[i + 1] = src[i + 1] * a + ra;
				dst[i + 2] = src[i + 2] * a + ra;
			}
		}
	}

	return dst ? { data: dst, width, height } : imageData;
}

function writeLayerInfo(writer: PsdWriter, layers: Layer[], psd: Psd, globalAlpha: boolean, options: ExtendedWriteOptions) {
	writeSection(writer, 4, () => writeLayerInfoData(writer, layers, psd, globalAlpha, options), true, options.psb);
}

function writeLayerInfoData(writer: PsdWriter, layers: Layer[], psd: Psd, globalAlpha: boolean, options: ExtendedWriteOptions) {
	writeInt16(writer, globalAlpha ? -layers.length : layers.length);

	const layersData = layers.map((l, i) => getChannels(writer, l, i === 0, options));

	// layer records
	for (const layerData of layersData) {
		const { layer, top, left, bottom, right, channels } = layerData;

		writeInt32(writer, top);
		writeInt32(writer, left);
		writeInt32(writer, bottom);
		writeInt32(writer, right);
		writeUint16(writer, channels.length);

		for (const c of channels) {
			writeInt16(writer, c.id);
			if (options.psb) {
				writeUint64(writer, c.length);
			} else {
				writeUint32(writer, c.length);
			}
		}

		writeSignature(writer, '8BIM');
		writeSignature(writer, fromBlendMode[layer.blendMode!] || 'norm');
		writeUint8(writer, Math.round(clamp(layer.opacity ?? 1, 0, 1) * 255));
		writeUint8(writer, layer.clipping ? 1 : 0);

		let flags = 0x08; // 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
		if (layer.transparencyProtected) flags |= 0x01;
		if (layer.hidden) flags |= 0x02;
		if (layer.vectorMask || (layer.sectionDivider && layer.sectionDivider.type !== SectionDividerType.Other) || layer.adjustment) {
			flags |= 0x10; // pixel data irrelevant to appearance of document
		}
		if (layer.effectsOpen) flags |= 0x20;

		writeUint8(writer, flags);
		writeUint8(writer, 0); // filler
		writeSection(writer, 1, () => {
			writeLayerMaskData(writer, layer, layerData);
			writeLayerBlendingRanges(writer, layer);
			writePascalString(writer, (layer.name || '').substring(0, 255), 4);
			writeAdditionalLayerInfo(writer, layer, psd, options);
		});
	}

	// layer channel image data
	for (const layerData of layersData) {
		for (const channel of layerData.channels) {
			writeUint16(writer, channel.compression);

			if (channel.data) {
				writeBytes(writer, channel.data);
			}
		}
	}
}

// real mask is only stored separately if layer has both vector and pixel masks, otherwise it's stored as the main mask
function getMasks(layer: Layer) {
	return layer.mask ? { mask: layer.mask, realMask: layer.realMask } : { mask: layer.realMask, realMask: undefined };
}

function writeLayerMaskData(writer: PsdWriter, layer: Layer, layerData: LayerChannelData) {
	const { mask, realMask } = getMasks(layer);

	writeSection(writer, 4, () => {
		if (!mask && !realMask) return;

		let params = 0, flags = 0, realFlags = 0;

		if (mask) {
			if (mask.userMaskDensity !== undefined) params |= MaskParams.UserMaskDensity;
			if (mask.userMaskFeather !== undefined) params |= MaskParams.UserMaskFeather;
			if (mask.vectorMaskDensity !== undefined) params |= MaskParams.VectorMaskDensity;
			if (mask.vectorMaskFeather !== undefined) params |= MaskParams.VectorMaskFeather;

			if (mask.disabled) flags |= LayerMaskFlags.LayerMaskDisabled;
			if (mask.positionRelativeToLayer) flags |= LayerMaskFlags.PositionRelativeToLayer;
			if (mask.fromVectorData) flags |= LayerMaskFlags.LayerMaskFromRenderingOtherData;
			if (params) flags |= LayerMaskFlags.MaskHasParametersAppliedToIt;
		}

		const m = layerData.mask || {} as Partial<Bounds>;
		writeInt32(writer, m.top || 0);
		writeInt32(writer, m.left || 0);
		writeInt32(writer, m.bottom || 0);
		writeInt32(writer, m.right || 0);
		writeUint8(writer, mask && mask.defaultColor || 0);
		writeUint8(writer, flags);

		if (realMask) {
			if (realMask.disabled) realFlags |= LayerMaskFlags.LayerMaskDisabled;
			if (realMask.positionRelativeToLayer) realFlags |= LayerMaskFlags.PositionRelativeToLayer;
			if (realMask.fromVectorData) realFlags |= LayerMaskFlags.LayerMaskFromRenderingOtherData;

			const r = layerData.realMask || {} as Partial<Bounds>;
			writeUint8(writer, realFlags);
			writeUint8(writer, realMask.defaultColor || 0);
			writeInt32(writer, r.top || 0);
			writeInt32(writer, r.left || 0);
			writeInt32(writer, r.bottom || 0);
			writeInt32(writer, r.right || 0);
		}

		if (params && mask) {
			writeUint8(writer, params);
			if (mask.userMaskDensity !== undefined) writeUint8(writer, Math.round(mask.userMaskDensity * 0xff));
			if (mask.userMaskFeather !== undefined) writeFloat64(writer, mask.userMaskFeather);
			if (mask.vectorMaskDensity !== undefined) writeUint8(writer, Math.round(mask.vectorMaskDensity * 0xff));
			if (mask.vectorMaskFeather !== undefined) writeFloat64(writer, mask.vectorMaskFeather);
		}
	}, true); // photoshop pads mask data to multiple of 4 bytes and includes padding in the length
}

function writerBlendingRange(writer: PsdWriter, range: number[]) {
	writeUint8(writer, range[0]);
	writeUint8(writer, range[1]);
	writeUint8(writer, range[2]);
	writeUint8(writer, range[3]);
}

function writeLayerBlendingRanges(writer: PsdWriter, layer: Layer) {
	writeSection(writer, 1, () => {
		const ranges = layer.blendingRanges;

		if (ranges) {
			writerBlendingRange(writer, ranges.compositeGrayBlendSource);
			writerBlendingRange(writer, ranges.compositeGraphBlendDestinationRange);

			for (const r of ranges.ranges) {
				writerBlendingRange(writer, r.sourceRange);
				writerBlendingRange(writer, r.destRange);
			}
		}
	});
}

function writeGlobalLayerMaskInfo(writer: PsdWriter, info: GlobalLayerMaskInfo | undefined) {
	writeSection(writer, 1, () => {
		if (info) {
			writeUint16(writer, info.overlayColorSpace);
			writeUint16(writer, info.colorSpace1);
			writeUint16(writer, info.colorSpace2);
			writeUint16(writer, info.colorSpace3);
			writeUint16(writer, info.colorSpace4);
			writeUint16(writer, Math.round(clamp(info.opacity, 0, 1) * 100)); // 0-100
			writeUint8(writer, info.kind);
			writeZeros(writer, 3);
		}
	});
}

function writeAdditionalLayerInfo(writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: ExtendedWriteOptions) {
	for (const handler of infoHandlers) {
		let key = handler.key;

		if (key === 'Txt2' && options.invalidateTextLayers) continue;
		if (key === 'vmsk' && infoHandlersMap['vscg'].has(target)) key = 'vsms'; // Photoshop uses 'vsms' for layers with vector stroke

		if (handler.has(target)) {
			const large = options.psb && largeAdditionalInfoKeys.indexOf(key) !== -1;
			const writeTotalLength = key !== 'Txt2' && key !== 'cinf' && key !== 'extn' && key !== 'CAI ' && key !== 'OCIO';
			const fourBytes = key === 'levl' || key === 'Txt2' || key === 'luni' || key === 'vmsk' || key === 'artb' || key === 'artd' ||
				key === 'vogk' || key === 'SoLd' || key === 'SoLE' || key === 'lnk2' || key === 'vscg' || key === 'vsms' || key === 'GdFl' ||
				key === 'lmfx' || key === 'lrFX' || key === 'cinf' || key === 'PlLd' || key === 'Anno' || key === 'CAI ' || key === 'OCIO' || key === 'GenI' || key === 'FEid' || key === 'curv' || key === 'CgEd' || key === 'vibA' || key === 'blwh' || key === 'grdm';

			writeSignature(writer, large ? '8B64' : '8BIM');
			writeSignature(writer, key);
			writeSection(writer, fourBytes ? 4 : 2, () => {
				handler.write(writer, target, psd, options);
			}, writeTotalLength, large);
		}
	}
}

function addChildren(layers: Layer[], children: Layer[] | undefined) {
	if (!children) return;

	// const layerIds: number[] = [2];
	// const timestamps: number[] = [1740120767.0230637];

	for (const c of children) {
		if (c.children && c.canvas) throw new Error(`Invalid layer, cannot have both 'canvas' and 'children' properties`);
		if (c.children && c.imageData) throw new Error(`Invalid layer, cannot have both 'imageData' and 'children' properties`);

		if (c.children) {
			layers.push({
				name: '</Layer group>',
				sectionDivider: {
					type: SectionDividerType.BoundingSectionDivider,
				},
				// blendingRanges: children[0].blendingRanges,
				// nameSource: 'lset',
				// id: layerIds.shift(),
				// protected: {
				// 	transparency: false,
				// 	composite: false,
				// 	position: false,
				// },
				// layerColor: 'red',
				// timestamp: timestamps.shift(),
				// referencePoint: { x: 0, y: 0 },
			});
			addChildren(layers, c.children);
			layers.push({
				...c,
				blendMode: c.blendMode === 'pass through' ? 'normal' : c.blendMode,
				sectionDivider: {
					type: c.opened === false ? SectionDividerType.ClosedFolder : SectionDividerType.OpenFolder,
					key: fromBlendMode[c.blendMode!] || 'pass',
					subType: 0,
				},
			});
		} else {
			layers.push({ ...c });
		}
	}
}

function resizeBuffer(writer: PsdWriter, size: number) {
	// grow at least 2x to keep small writes fast, but don't overshoot large reservations (like composite image data)
	const newLength = Math.max(writer.buffer.byteLength * 2, size);

	const newBuffer = new ArrayBuffer(newLength);
	const newBytes = new Uint8Array(newBuffer);
	const oldBytes = new Uint8Array(writer.buffer);
	newBytes.set(oldBytes);
	writer.buffer = newBuffer;
	writer.view = new DataView(writer.buffer);
}

function ensureSize(writer: PsdWriter, size: number) {
	if (size > writer.buffer.byteLength) {
		resizeBuffer(writer, size);
	}
}

function addSize(writer: PsdWriter, size: number) {
	const offset = writer.offset;
	ensureSize(writer, writer.offset += size);
	return offset;
}

function createThumbnail(psd: Psd) {
	const canvas = createCanvas(10, 10);
	let scale = 1;

	if (psd.width > psd.height) {
		canvas.width = 160;
		canvas.height = Math.max(1, Math.floor(psd.height * (canvas.width / psd.width)));
		scale = canvas.width / psd.width;
	} else {
		canvas.height = 160;
		canvas.width = Math.max(1, Math.floor(psd.width * (canvas.height / psd.height)));
		scale = canvas.height / psd.height;
	}

	const context = canvas.getContext('2d')!;
	context.scale(scale, scale);

	if (psd.imageData) {
		context.drawImage(imageDataToCanvas(psd.imageData), 0, 0);
	} else if (psd.canvas) {
		context.drawImage(psd.canvas, 0, 0);
	}

	return canvas;
}

function getMaskChannels(tempBuffer: Uint8Array, layerData: LayerChannelData, mask: LayerMaskData, options: WriteOptions, realMask: boolean) {
	let top = (mask.top as any) | 0;
	let left = (mask.left as any) | 0;
	let right = (mask.right as any) | 0;
	let bottom = (mask.bottom as any) | 0;
	let { width, height } = getLayerDimentions(mask);
	let imageData = mask.imageData;

	if (!imageData && mask.canvas && width && height) {
		imageData = mask.canvas.getContext('2d')!.getImageData(0, 0, width, height);
	}

	if (imageData && (imageData.width !== width || imageData.height !== height)) {
		throw new Error('Invalid imageData dimentions');
	}

	right = left + width;
	bottom = top + height;

	let buffer: Uint8Array;
	let compression: Compression;
	const bitsPerChannel = (options as ExtendedWriteOptions).bitsPerChannel ?? 8;

	if (!imageData) {
		buffer = new Uint8Array(0);
		compression = Compression.RleCompressed;
	} else if (bitsPerChannel !== 8 || !is8bit(imageData)) {
		const { colors } = getPlanarChannels(imageData, ColorMode.RGB, bitsPerChannel, false);
		({ data: buffer, compression } = encodeChannel(colors[0], width, height, options));
	} else if (options.compress) {
		buffer = writeDataZipWithoutPrediction(imageData, [0]);
		compression = Compression.ZipWithoutPrediction;
	} else {
		buffer = writeDataRLE(tempBuffer, imageData, [0], !!options.psb).slice(); // copy, temp buffer is reused
		compression = Compression.RleCompressed;
	}

	layerData.channels.push({ id: realMask ? ChannelID.RealUserMask : ChannelID.UserMask, compression, data: buffer, length: 2 + buffer.length });

	layerData[realMask ? 'realMask' : 'mask'] = { top, left, right, bottom };
}

function bounds(obj: { top?: number; left?: number; bottom?: number; right?: number; } | undefined) {
	return obj ? {
		top: obj.top || 0,
		left: obj.left || 0,
		right: obj.right || 0,
		bottom: obj.bottom || 0,
	} : undefined;
}

function getChannels(writer: PsdWriter, layer: Layer, background: boolean, options: WriteOptions): LayerChannelData {
	let source = layer;

	if (layer.rawData) {
		const { colorMode, bitsPerChannel, large } = layer.rawData;
		const opt = options as ExtendedWriteOptions;

		if (large === !!options.psb && colorMode === (opt.colorMode ?? ColorMode.RGB) && bitsPerChannel === (opt.bitsPerChannel ?? 8)) {
			// same mask mapping as in writeLayerMaskData
			const { mask, realMask } = getMasks(layer);
			return {
				layer,
				channels: layer.rawData.channels.map(c => ({ ...c, length: 2 + (c.data?.byteLength ?? 0) })),
				...bounds(layer)!,
				mask: bounds(mask),
				realMask: bounds(realMask),
			};
		}

		// raw data is in different format than the one we're writing, decode it so it can be re-encoded
		source = {
			...layer,
			rawData: undefined,
			canvas: undefined,
			imageData: getLayerImageData(layer),
			mask: layer.mask && { ...layer.mask, canvas: undefined, imageData: getLayerMaskImageData(layer) },
			realMask: layer.realMask && { ...layer.realMask, canvas: undefined, imageData: getLayerRealMaskImageData(layer) },
		};

		// temp buffer is sized only for layers with image data, grow it and keep it for following layers
		const size = getLargestLayerSize([{ ...source, children: undefined }], !!options.psb);
		if (writer.tempBuffer!.byteLength < size) writer.tempBuffer = new Uint8Array(size);
	}

	const tempBuffer = writer.tempBuffer!;
	const { mask, realMask } = getMasks(source);
	const layerData = getLayerChannels(tempBuffer, source, background, options);
	if (mask) getMaskChannels(tempBuffer, layerData, mask, options, false);
	if (realMask) getMaskChannels(tempBuffer, layerData, realMask, options, true);
	layerData.layer = layer;
	return layerData;
}

function getLayerDimentions({ canvas, imageData }: Layer): { width: number; height: number; } {
	// this way in case canvas/imageData are incorrect objects without width/height properties
	const width = imageData?.width ?? canvas?.width ?? 0;
	const height = imageData?.height ?? canvas?.height ?? 0;
	return { width, height };
}

function cropImageData(data: PixelData, left: number, top: number, width: number, height: number) {
	const croppedData: PixelData = is8bit(data) ? createImageData(width, height) :
		{ width, height, data: new (data.data.constructor as any)(width * height * 4) };
	const srcData = data.data;
	const dstData = croppedData.data;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let src = ((x + left) + (y + top) * data.width) * 4;
			let dst = (x + y * width) * 4;
			dstData[dst] = srcData[src];
			dstData[dst + 1] = srcData[src + 1];
			dstData[dst + 2] = srcData[src + 2];
			dstData[dst + 3] = srcData[src + 3];
		}
	}

	return croppedData;
}

function getLayerChannels(tempBuffer: Uint8Array, layer: Layer, background: boolean, options: WriteOptions): LayerChannelData {
	let top = (layer.top as any) | 0;
	let left = (layer.left as any) | 0;
	let right = (layer.right as any) | 0;
	let bottom = (layer.bottom as any) | 0;
	let channels: ChannelData[] = [
		{ id: ChannelID.Transparency, compression: Compression.RawData, data: undefined, length: 2 },
		{ id: ChannelID.Color0, compression: Compression.RawData, data: undefined, length: 2 },
		{ id: ChannelID.Color1, compression: Compression.RawData, data: undefined, length: 2 },
		{ id: ChannelID.Color2, compression: Compression.RawData, data: undefined, length: 2 },
	];
	let { width, height } = getLayerDimentions(layer);

	if (!(layer.canvas || layer.imageData) || !width || !height) {
		// layer without image data is empty, keep inverted (negative size) bounds from some files as they are
		if (layer.right === undefined || right > left) right = left;
		if (layer.bottom === undefined || bottom > top) bottom = top;
		return { layer, top, left, right, bottom, channels };
	}

	right = left + width;
	bottom = top + height;

	let imageData = layer.imageData || layer.canvas!.getContext('2d')!.getImageData(0, 0, width, height);

	if (options.trimImageData) {
		const trimmed = trimData(imageData);

		if (trimmed.left !== 0 || trimmed.top !== 0 || trimmed.right !== imageData.width || trimmed.bottom !== imageData.height) {
			left += trimmed.left;
			top += trimmed.top;
			right -= (imageData.width - trimmed.right);
			bottom -= (imageData.height - trimmed.bottom);
			width = right - left;
			height = bottom - top;

			if (!width || !height) return { layer, top, left, right, bottom, channels };

			imageData = cropImageData(imageData, trimmed.left, trimmed.top, width, height);
		}
	}

	const channelIds = [
		ChannelID.Color0,
		ChannelID.Color1,
		ChannelID.Color2,
	];

	if (!background || options.noBackground || layer.mask || hasAlpha(imageData)) {
		channelIds.unshift(ChannelID.Transparency);
	}

	const colorMode = (options as ExtendedWriteOptions).colorMode ?? ColorMode.RGB;
	const bitsPerChannel = (options as ExtendedWriteOptions).bitsPerChannel ?? 8;

	if (colorMode !== ColorMode.RGB || bitsPerChannel !== 8 || !is8bit(imageData)) {
		const { colors, alpha } = getPlanarChannels(imageData, colorMode, bitsPerChannel, false);
		const ids = channelIds[0] === ChannelID.Transparency ? [ChannelID.Transparency] : [];
		for (let i = 0; i < colors.length; i++) ids.push(i as ChannelID);

		channels = ids.map(id => {
			const { data, compression } = encodeChannel(id === ChannelID.Transparency ? alpha : colors[id], width, height, options);
			return { id, compression, data, length: 2 + data.length };
		});

		return { layer, top, left, right, bottom, channels };
	}

	channels = channelIds.map(id => {
		const offset = offsetForChannel(id, false); // image data is always RGBA
		let data: Uint8Array;
		let compression: Compression;

		if (options.compress) {
			data = writeDataZipWithoutPrediction(imageData, [offset]);
			compression = Compression.ZipWithoutPrediction;
		} else {
			data = writeDataRLE(tempBuffer, imageData, [offset], !!options.psb).slice(); // copy, temp buffer is reused
			compression = Compression.RleCompressed;
		}

		return { id, compression, data, length: 2 + data.length };
	});

	return { layer, top, left, right, bottom, channels };
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

	for (let y = top, i = start; y < bottom; y++, i = (i + stride) | 0) {
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

export function writeColor(writer: PsdWriter, color: Color | undefined) {
	if (!color) {
		writeUint16(writer, ColorSpace.RGB);
		writeZeros(writer, 8);
	} else if ('r' in color) {
		writeUint16(writer, ColorSpace.RGB);
		writeUint16(writer, Math.round(color.r * 257));
		writeUint16(writer, Math.round(color.g * 257));
		writeUint16(writer, Math.round(color.b * 257));
		writeUint16(writer, 0);
	} else if ('fr' in color) {
		writeUint16(writer, ColorSpace.RGB);
		writeUint16(writer, Math.round(color.fr * 255 * 257));
		writeUint16(writer, Math.round(color.fg * 255 * 257));
		writeUint16(writer, Math.round(color.fb * 255 * 257));
		writeUint16(writer, 0);
	} else if ('l' in color) {
		writeUint16(writer, ColorSpace.Lab);
		writeInt16(writer, Math.round(color.l * 10000));
		writeInt16(writer, Math.round(denormalizeLabAB(color.a, 100)));
		writeInt16(writer, Math.round(denormalizeLabAB(color.b, 100)));
		writeUint16(writer, 0);
	} else if ('h' in color) {
		writeUint16(writer, ColorSpace.HSB);
		writeUint16(writer, Math.round(color.h * 0xffff));
		writeUint16(writer, Math.round(color.s * 0xffff));
		writeUint16(writer, Math.round(color.b * 0xffff));
		writeUint16(writer, 0);
	} else if ('c' in color) {
		// 0 = 100% ink
		writeUint16(writer, ColorSpace.CMYK);
		writeUint16(writer, 0xffff - Math.round(clamp(color.c, 0, 255) * 257));
		writeUint16(writer, 0xffff - Math.round(clamp(color.m, 0, 255) * 257));
		writeUint16(writer, 0xffff - Math.round(clamp(color.y, 0, 255) * 257));
		writeUint16(writer, 0xffff - Math.round(clamp(color.k, 0, 255) * 257));
	} else {
		writeUint16(writer, ColorSpace.Grayscale);
		writeUint16(writer, Math.round(color.k * 10000 / 255));
		writeZeros(writer, 6);
	}
}

// ponytail: only round-trips RGB 8-bit patterns; source colorMode (16-bit/Indexed) is not preserved,
// since readPattern already converted everything to RGBA. Upgrade if pattern colorMode must survive write.
export function writePattern(writer: PsdWriter, pattern: PatternInfo) {
	const width = pattern.bounds.w;
	const height = pattern.bounds.h;
	const pixelData: PixelData = { width, height, data: pattern.data };

	writeUint32(writer, 0); // length, fixed up below
	const pattsOffset = writer.offset;

	writeUint32(writer, 1); // version
	writeUint32(writer, ColorMode.RGB); // color mode - rgb only

	writeInt16(writer, pattern.x);
	writeInt16(writer, pattern.y);

	writeUnicodeString(writer, pattern.name + '\0'); // name
	writePascalString(writer, pattern.id, 1); // id

	// virtual memory array list
	writeUint32(writer, 3); // version
	writeUint32(writer, 0); // length, fixed up below
	const vlOffset = writer.offset;

	const top = pattern.bounds.y;
	const left = pattern.bounds.x;
	const bottom = top + height;
	const right = left + width;

	writeUint32(writer, top);
	writeUint32(writer, left);
	writeUint32(writer, bottom);
	writeUint32(writer, right);

	writeUint32(writer, 24); // channels count

	// ponytail: pattern channels always use small (2-byte) RLE scanline headers, matching
	// readPattern which reads them as non-large
	const buffer = new Uint8Array(getRLEChannelBound(width, height, false));

	// channels: RGB at indices 0,1,2 and alpha at index 25
	for (let i = 0; i < 24 + 2; i++) {
		const offset = i < 3 ? i : (i === 25 ? 3 : -1);

		if (offset < 0) {
			writeUint32(writer, 0); // has
			continue;
		}

		const data = writeDataRLE(buffer, pixelData, [offset], false);

		writeUint32(writer, 1); // has
		writeUint32(writer, data.length + 4 + 16 + 2 + 1); // length
		writeUint32(writer, 8); // pixelDepth
		writeUint32(writer, top);
		writeUint32(writer, left);
		writeUint32(writer, bottom);
		writeUint32(writer, right);
		writeUint16(writer, 8); // pixelDepth2
		writeUint8(writer, 1); // compressionMode - rle
		writeBytes(writer, data);
	}

	const vlLength = writer.offset - vlOffset;
	let pattsLength = writer.offset - pattsOffset;

	while (pattsLength % 4) {
		writeZeros(writer, 1);
		pattsLength++;
	}

	writer.view.setUint32(vlOffset - 4, vlLength, false);
	writer.view.setUint32(pattsOffset - 4, pattsLength, false);
}
