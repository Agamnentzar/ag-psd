import { Psd, Layer, LayerAdditionalInfo, ColorMode, SectionDividerType, WriteOptions, Color } from './psd';
import {
	hasAlpha, createCanvas, writeDataRLE, PixelData, LayerChannelData, ChannelData,
	offsetForChannel, createImageData, fromBlendMode, ChannelID, Compression, clamp,
	LayerMaskFlags, MaskParams, ColorSpace, Bounds
} from './helpers';
import { infoHandlers } from './additionalInfo';
import { resourceHandlers } from './imageResources';

const RAW_IMAGE_DATA = false;

export interface PsdWriter {
	offset: number;
	buffer: ArrayBuffer;
	view: DataView;
}

export function createWriter(size = 4096): PsdWriter {
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	const offset = 0;
	return { buffer, view, offset };
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

export function writeInt32(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setInt32(offset, value, false);
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

export function writePascalString(writer: PsdWriter, text: string, padTo: number) {
	let length = text.length;
	writeUint8(writer, length);

	for (let i = 0; i < length; i++) {
		const code = text.charCodeAt(i);
		writeUint8(writer, code < 128 ? code : '?'.charCodeAt(0));
	}

	while (++length % padTo) {
		writeUint8(writer, 0);
	}
}

export function writeUnicodeString(writer: PsdWriter, text: string) {
	writeUint32(writer, text.length);

	for (let i = 0; i < text.length; i++) {
		writeUint16(writer, text.charCodeAt(i));
	}
}

export function writeUnicodeStringWithPadding(writer: PsdWriter, text: string) {
	writeUint32(writer, text.length + 1);

	for (let i = 0; i < text.length; i++) {
		writeUint16(writer, text.charCodeAt(i));
	}

	writeUint16(writer, 0);
}

function getLargestLayerSize(layers: Layer[] = []): number {
	let max = 0;

	for (const layer of layers) {
		if (layer.canvas || layer.imageData) {
			const { width, height } = getLayerDimentions(layer);
			max = Math.max(max, 2 * height + 2 * width * height);
		}

		if (layer.children) {
			max = Math.max(max, getLargestLayerSize(layer.children));
		}
	}

	return max;
}

export function writeSection(writer: PsdWriter, round: number, func: () => void, writeTotalLength = false) {
	const offset = writer.offset;
	writeInt32(writer, 0);

	func();

	let length = writer.offset - offset - 4;
	let len = length;

	while ((len % round) !== 0) {
		writeUint8(writer, 0);
		len++;
	}

	if (writeTotalLength) {
		length = len;
	}

	writer.view.setInt32(offset, length, false);
}

export function writePsd(writer: PsdWriter, psd: Psd, options: WriteOptions = {}) {
	if (!(+psd.width > 0 && +psd.height > 0))
		throw new Error('Invalid document size');

	let imageResources = psd.imageResources || {};

	if (options.generateThumbnail) {
		imageResources = { ...imageResources, thumbnail: createThumbnail(psd) };
	}

	let imageData = psd.imageData;

	if (!imageData && psd.canvas) {
		imageData = psd.canvas.getContext('2d')!.getImageData(0, 0, psd.canvas.width, psd.canvas.height);
	}

	if (imageData && (psd.width !== imageData.width || psd.height !== imageData.height))
		throw new Error('Document canvas must have the same size as document');

	const globalAlpha = !!imageData && hasAlpha(imageData);
	const maxBufferSize = Math.max(getLargestLayerSize(psd.children), 4 * 2 * psd.width * psd.height + 2 * psd.height);
	const tempBuffer = new Uint8Array(maxBufferSize);

	// header
	writeSignature(writer, '8BPS');
	writeUint16(writer, 1); // version
	writeZeros(writer, 6);
	writeUint16(writer, globalAlpha ? 4 : 3); // channels
	writeUint32(writer, psd.height);
	writeUint32(writer, psd.width);
	writeUint16(writer, 8); // bits per channel
	writeUint16(writer, ColorMode.RGB);

	// color mode data
	writeSection(writer, 1, () => {
		// TODO: implement
	});

	// image resources
	writeSection(writer, 1, () => {
		for (const handler of resourceHandlers) {
			if (handler.has(imageResources)) {
				writeSignature(writer, '8BIM');
				writeUint16(writer, handler.key);
				writePascalString(writer, '', 2);
				writeSection(writer, 2, () => handler.write(writer, imageResources));
			}
		}
	});

	// layer and mask info
	writeSection(writer, 2, () => {
		writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options);
		writeGlobalLayerMaskInfo(writer);
		writeAdditionalLayerInfo(writer, psd, psd, options);
	});

	// image data
	const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
	const data: PixelData = imageData || {
		data: new Uint8Array(4 * psd.width * psd.height),
		width: psd.width,
		height: psd.height,
	};

	writeUint16(writer, Compression.RleCompressed);

	if (RAW_IMAGE_DATA && (psd as any).imageDataRaw) {
		console.log('writing raw image data');
		writeBytes(writer, (psd as any).imageDataRaw);
	} else {
		writeBytes(writer, writeDataRLE(tempBuffer, data, psd.width, psd.height, channels));
	}
}

function writeLayerInfo(tempBuffer: Uint8Array, writer: PsdWriter, psd: Psd, globalAlpha: boolean, options: WriteOptions) {
	writeSection(writer, 4, () => {
		const layers: Layer[] = [];

		addChildren(layers, psd.children);

		if (!layers.length) layers.push({});

		writeInt16(writer, globalAlpha ? -layers.length : layers.length);

		const layersData = layers.map((l, i) => getChannels(tempBuffer, l, i === 0, options));

		// layer records
		for (const layerData of layersData) {
			const { layer, top, left, bottom, right, channels } = layerData;

			writeInt32(writer, top);
			writeInt32(writer, left);
			writeInt32(writer, bottom);
			writeInt32(writer, right);
			writeUint16(writer, channels.length);

			for (const c of channels) {
				writeInt16(writer, c.channelId);
				writeInt32(writer, c.length);
			}

			writeSignature(writer, '8BIM');
			writeSignature(writer, fromBlendMode[layer.blendMode!] || 'norm');
			writeUint8(writer, Math.round(clamp(layer.opacity ?? 1, 0, 1) * 255));
			writeUint8(writer, layer.clipping ? 1 : 0);

			let flags = 0x08; // 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
			if (layer.transparencyProtected) flags |= 0x01;
			if (layer.hidden) flags |= 0x02;
			if (layer.vectorMask || (layer.sectionDivider && layer.sectionDivider.type !== SectionDividerType.Other)) {
				flags |= 0x10; // pixel data irrelevant to appearance of document
			}

			writeUint8(writer, flags);
			writeUint8(writer, 0); // filler
			writeSection(writer, 1, () => {
				writeLayerMaskData(writer, layer, layerData);
				writeLayerBlendingRanges(writer, psd);
				writePascalString(writer, layer.name || '', 4);
				writeAdditionalLayerInfo(writer, layer, psd, options);
			});
		}

		// layer channel image data
		for (const layerData of layersData) {
			for (const channel of layerData.channels) {
				writeUint16(writer, channel.compression);

				if (channel.buffer) {
					writeBytes(writer, channel.buffer);
				}
			}
		}

		// writeUint16(writer, 0);
	}, true);
}

function writeLayerMaskData(writer: PsdWriter, { mask, vectorMask }: Layer, layerData: LayerChannelData) {
	writeSection(writer, 1, () => {
		if (!mask) return;

		const m = layerData.mask || {} as Partial<Bounds>;
		writeInt32(writer, m.top!);
		writeInt32(writer, m.left!);
		writeInt32(writer, m.bottom!);
		writeInt32(writer, m.right!);
		writeUint8(writer, mask.defaultColor!);

		let params = 0;
		if (mask.userMaskDensity !== undefined) params |= MaskParams.UserMaskDensity;
		if (mask.userMaskFeather !== undefined) params |= MaskParams.UserMaskFeather;
		if (mask.vectorMaskDensity !== undefined) params |= MaskParams.VectorMaskDensity;
		if (mask.vectorMaskFeather !== undefined) params |= MaskParams.VectorMaskFeather;

		let flags = 0;
		if (mask.disabled) flags |= LayerMaskFlags.LayerMaskDisabled;
		if (mask.positionRelativeToLayer) flags |= LayerMaskFlags.PositionRelativeToLayer;
		if (vectorMask) flags |= LayerMaskFlags.LayerMaskFromRenderingOtherData;
		if (params) flags |= LayerMaskFlags.MaskHasParametersAppliedToIt;

		writeUint8(writer, flags);

		if (params) {
			writeUint8(writer, params);

			if (mask.userMaskDensity !== undefined) writeUint8(writer, Math.round(mask.userMaskDensity * 0xff));
			if (mask.userMaskFeather !== undefined) writeFloat64(writer, mask.userMaskFeather);
			if (mask.vectorMaskDensity !== undefined) writeUint8(writer, Math.round(mask.vectorMaskDensity * 0xff));
			if (mask.vectorMaskFeather !== undefined) writeFloat64(writer, mask.vectorMaskFeather);
		}

		// TODO: handle rest of the fields

		writeZeros(writer, 2);
	});
}

function writeLayerBlendingRanges(writer: PsdWriter, psd: Psd) {
	writeSection(writer, 1, () => {
		writeUint32(writer, 65535);
		writeUint32(writer, 65535);

		// TODO: use always 4 instead ?
		const channels = psd.channels || 0;

		for (let i = 0; i < channels; i++) {
			writeUint32(writer, 65535);
			writeUint32(writer, 65535);
		}
	});
}

function writeGlobalLayerMaskInfo(writer: PsdWriter) {
	writeSection(writer, 1, () => {
		// TODO: implement
	});
}

function writeAdditionalLayerInfo(writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: WriteOptions) {
	for (const handler of infoHandlers) {
		const key = handler.key;

		if (key === 'Txt2' && options.invalidateTextLayers) continue;

		if (handler.has(target)) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, key);

			const align = (key === 'Txt2' || key === 'luni' || key === 'vmsk' || key === 'artb' || key === 'artd' ||
				key === 'vogk' || key === 'SoLd' || key === 'lnk2') ? 4 : 2;
			writeSection(writer, align, () => handler.write(writer, target, psd, options), key !== 'Txt2');
		}
	}
}

function addChildren(layers: Layer[], children: Layer[] | undefined) {
	if (!children) return;

	for (const c of children) {
		if (c.children && c.canvas) throw new Error(`Invalid layer, cannot have both 'canvas' and 'children' properties`);
		if (c.children && c.imageData) throw new Error(`Invalid layer, cannot have both 'imageData' and 'children' properties`);

		if (c.children) {
			layers.push({
				name: '</Layer group>',
				sectionDivider: {
					type: SectionDividerType.BoundingSectionDivider,
				},
				// TESTING
				// nameSource: 'lset',
				// id: [4, 0, 0, 8, 11, 0, 0, 0, 0, 14][layers.length] || 0,
				// layerColor: 'none',
				// timestamp: [1611346817.349021, 0, 0, 1611346817.349175, 1611346817.3491833, 0, 0, 0, 0, 1611346817.349832][layers.length] || 0,
				// protected: {},
				// referencePoint: { x: 0, y: 0 },
			});
			addChildren(layers, c.children);
			layers.push({
				sectionDivider: {
					type: c.opened === false ? SectionDividerType.ClosedFolder : SectionDividerType.OpenFolder,
					key: 'pass',
					subType: 0,
				},
				...c,
			});
		} else {
			layers.push({ ...c });
		}
	}
}

function resizeBuffer(writer: PsdWriter, size: number) {
	let newLength = writer.buffer.byteLength;

	do {
		newLength *= 2;
	} while (size > newLength);

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
		canvas.height = Math.floor(psd.height * (canvas.width / psd.width));
		scale = canvas.width / psd.width;
	} else {
		canvas.height = 160;
		canvas.width = Math.floor(psd.width * (canvas.height / psd.height));
		scale = canvas.height / psd.height;
	}

	const context = canvas.getContext('2d')!;
	context.scale(scale, scale);

	if (psd.imageData) {
		const temp = createCanvas(psd.imageData.width, psd.imageData.height);
		temp.getContext('2d')!.putImageData(psd.imageData, 0, 0);
		context.drawImage(temp, 0, 0);
	} else if (psd.canvas) {
		context.drawImage(psd.canvas, 0, 0);
	}

	return canvas;
}

function getChannels(
	tempBuffer: Uint8Array, layer: Layer, background: boolean, options: WriteOptions
): LayerChannelData {
	const layerData = getLayerChannels(tempBuffer, layer, background, options);
	const mask = layer.mask;

	if (mask) {
		let { top = 0, left = 0, right = 0, bottom = 0 } = mask;
		let { width, height } = getLayerDimentions(mask);
		let imageData = mask.imageData;

		if (!imageData && mask.canvas && width && height) {
			imageData = mask.canvas.getContext('2d')!.getImageData(0, 0, width, height);
		}

		if (width && height && imageData) {
			right = left + width;
			bottom = top + height;

			const buffer = writeDataRLE(tempBuffer, imageData, width, height, [0])!;
			layerData.mask = { top, left, right, bottom };
			layerData.channels.push({
				channelId: ChannelID.UserMask,
				compression: Compression.RleCompressed,
				buffer: buffer,
				length: 2 + buffer.length,
			});
		} else {
			layerData.mask = { top: 0, left: 0, right: 0, bottom: 0 };
			layerData.channels.push({
				channelId: ChannelID.UserMask,
				compression: Compression.RawData,
				buffer: new Uint8Array(0),
				length: 0,
			});
		}
	}

	return layerData;
}

function getLayerDimentions({ canvas, imageData }: Layer): { width: number; height: number; } {
	return imageData || canvas || { width: 0, height: 0 };
}

function cropImageData(data: ImageData, left: number, top: number, width: number, height: number) {
	const croppedData = createImageData(width, height);
	const srcData = data.data;
	const dstData = croppedData.data;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let src = ((x + left) + (y + top) * width) * 4;
			let dst = (x + y * width) * 4;
			dstData[dst] = srcData[src];
			dstData[dst + 1] = srcData[src + 1];
			dstData[dst + 2] = srcData[src + 2];
			dstData[dst + 3] = srcData[src + 3];
		}
	}

	return croppedData;
}

function getLayerChannels(
	tempBuffer: Uint8Array, layer: Layer, background: boolean, options: WriteOptions
): LayerChannelData {
	let { top = 0, left = 0, right = 0, bottom = 0 } = layer;
	let channels: ChannelData[] = [
		{ channelId: ChannelID.Transparency, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Red, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Green, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Blue, compression: Compression.RawData, buffer: undefined, length: 2 },
	];

	let { width, height } = getLayerDimentions(layer);

	if (!(layer.canvas || layer.imageData) || !width || !height) {
		right = left;
		bottom = top;
		return { layer, top, left, right, bottom, channels };
	}

	right = left + width;
	bottom = top + height;

	let data = layer.imageData || layer.canvas!.getContext('2d')!.getImageData(0, 0, width, height);

	if (options.trimImageData) {
		const trimmed = trimData(data);

		if (trimmed.left !== 0 || trimmed.top !== 0 || trimmed.right !== data.width || trimmed.bottom !== data.height) {
			left += trimmed.left;
			top += trimmed.top;
			right -= (data.width - trimmed.right);
			bottom -= (data.height - trimmed.bottom);
			width = right - left;
			height = bottom - top;

			if (!width || !height) {
				return { layer, top, left, right, bottom, channels };
			}

			if (layer.imageData) {
				data = cropImageData(data, trimmed.left, trimmed.top, width, height);
			} else {
				data = layer.canvas!.getContext('2d')!.getImageData(trimmed.left, trimmed.top, width, height);
			}
		}
	}

	const channelIds = [
		ChannelID.Red,
		ChannelID.Green,
		ChannelID.Blue,
	];

	if (!background || hasAlpha(data) || layer.mask || (RAW_IMAGE_DATA && (layer as any).imageDataRaw?.['-1'])) {
		channelIds.unshift(ChannelID.Transparency);
	}

	channels = channelIds.map(channel => {
		const offset = offsetForChannel(channel);
		let buffer = writeDataRLE(tempBuffer, data, width, height, [offset])!;

		if (RAW_IMAGE_DATA && (layer as any).imageDataRaw) {
			// console.log('written raw layer image data');
			buffer = (layer as any).imageDataRaw[channel];
		}

		return {
			channelId: channel,
			compression: Compression.RleCompressed,
			buffer: buffer,
			length: 2 + buffer.length,
		};
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
	} else if ('l' in color) {
		writeUint16(writer, ColorSpace.Lab);
		writeUint16(writer, Math.round(color.l * 100));
		writeUint16(writer, Math.round(color.a * 100));
		writeUint16(writer, Math.round(color.b * 100));
		writeUint16(writer, 0);
	} else if ('h' in color) {
		writeUint16(writer, ColorSpace.HSB);
		writeUint16(writer, Math.round(color.h));
		writeUint16(writer, Math.round(color.s));
		writeUint16(writer, Math.round(color.b));
		writeUint16(writer, 0);
	} else if ('c' in color) {
		writeUint16(writer, ColorSpace.CMYK);
		writeUint16(writer, Math.round(color.c));
		writeUint16(writer, Math.round(color.m));
		writeUint16(writer, Math.round(color.y));
		writeUint16(writer, Math.round(color.k));
	} else {
		writeUint16(writer, ColorSpace.Grayscale);
		writeUint16(writer, Math.round(color.k));
		writeZeros(writer, 6);
	}
}
