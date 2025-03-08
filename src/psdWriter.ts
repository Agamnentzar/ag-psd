import { Psd, Layer, LayerAdditionalInfo, ColorMode, SectionDividerType, WriteOptions, Color, GlobalLayerMaskInfo, PixelData, LayerMaskData } from './psd';
import { hasAlpha, createCanvas, writeDataRLE, LayerChannelData, ChannelData, offsetForChannel, createImageData, fromBlendMode, ChannelID, Compression, clamp, LayerMaskFlags, MaskParams, ColorSpace, Bounds, largeAdditionalInfoKeys, RAW_IMAGE_DATA, writeDataZipWithoutPrediction, imageDataToCanvas } from './helpers';
import { ExtendedWriteOptions, infoHandlers } from './additionalInfo';
import { InternalImageResources, resourceHandlers } from './imageResources';

export interface PsdWriter {
	offset: number;
	buffer: ArrayBuffer;
	view: DataView;
	tempBuffer: Uint8Array | undefined;
}

export function createWriter(size = 4096): PsdWriter {
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	const offset = 0;
	return { buffer, view, offset, tempBuffer: undefined };
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

export function writeSection(writer: PsdWriter, round: number, func: () => void, writeTotalLength = false, large = false) {
	if (large) writeUint32(writer, 0);
	const offset = writer.offset;
	writeUint32(writer, 0);

	func();

	let length = writer.offset - offset - 4;
	let len = length;

	while ((len % round) !== 0) {
		writeUint8(writer, 0);
		len++;
	}

	// while ((writer.offset % round) !== 0) {
	// 	writeUint8(writer, 0);
	// 	len++;
	// }

	if (writeTotalLength) {
		length = len;
	}

	writer.view.setUint32(offset, length, false);
}

function verifyBitCount(target: Psd | Layer) {
	target.children?.forEach(verifyBitCount);

	const data = target.imageData;
	if (data && (data.data instanceof Uint32Array || data.data instanceof Uint16Array)) {
		throw new Error('imageData has incorrect bitDepth');
	}

	if ('mask' in target && target.mask) {
		const data = target.mask.imageData;
		if (data && (data.data instanceof Uint32Array || data.data instanceof Uint16Array)) {
			throw new Error('mask imageData has incorrect bitDepth');
		}
	}
}

export function writePsd(writer: PsdWriter, psd: Psd, options: WriteOptions = {}) {
	if (!(+psd.width > 0 && +psd.height > 0))
		throw new Error('Invalid document size');

	if ((psd.width > 30000 || psd.height > 30000) && !options.psb)
		throw new Error('Document size is too large (max is 30000x30000, use PSB format instead)');

	const bitsPerChannel = psd.bitsPerChannel ?? 8;

	if (bitsPerChannel !== 8)
		throw new Error('bitsPerChannel other than 8 are not supported for writing');

	verifyBitCount(psd);

	const imageResources: InternalImageResources = { ...psd.imageResources };
	const opt: ExtendedWriteOptions = { ...options, layerIds: new Set(), layerToId: new Map() };

	if (opt.generateThumbnail) {
		imageResources.thumbnail = createThumbnail(psd);
	}

	let imageData = psd.imageData;

	if (!imageData && psd.canvas) {
		imageData = psd.canvas.getContext('2d')!.getImageData(0, 0, psd.canvas.width, psd.canvas.height);
	}

	if (imageData && (psd.width !== imageData.width || psd.height !== imageData.height))
		throw new Error('Document canvas must have the same size as document');

	const globalAlpha = !!imageData && hasAlpha(imageData);
	const maxBufferSize = Math.max(getLargestLayerSize(psd.children), 4 * 2 * psd.width * psd.height + 2 * psd.height);
	writer.tempBuffer = new Uint8Array(maxBufferSize);

	// header
	writeSignature(writer, '8BPS');
	writeUint16(writer, options.psb ? 2 : 1); // version
	writeZeros(writer, 6);
	writeUint16(writer, globalAlpha ? 4 : 3); // channels
	writeUint32(writer, psd.height);
	writeUint32(writer, psd.width);
	writeUint16(writer, bitsPerChannel); // bits per channel
	writeUint16(writer, ColorMode.RGB); // we only support saving RGB right now

	// color mode data
	writeSection(writer, 1, () => {
		if (psd.palette) {
			for (let i = 0; i < 256; i++) writeUint8(writer, psd.palette[i]?.r || 0);
			for (let i = 0; i < 256; i++) writeUint8(writer, psd.palette[i]?.g || 0);
			for (let i = 0; i < 256; i++) writeUint8(writer, psd.palette[i]?.b || 0);
		}

		// TODO: other data?
	});

	const layers: Layer[] = [];
	addChildren(layers, psd.children);
	if (!layers.length) layers.push({});

	// image resources

	imageResources.layersGroup = layers.map(l => l.linkGroup || 0);
	imageResources.layerGroupsEnabledId = layers.map(l => l.linkGroupEnabled == false ? 0 : 1);

	writeSection(writer, 1, () => {
		for (const handler of resourceHandlers) {
			const has = handler.has(imageResources);
			const count = has === false ? 0 : (has === true ? 1 : has);
			for (let i = 0; i < count; i++) {
				writeSignature(writer, '8BIM');
				writeUint16(writer, handler.key);
				writePascalString(writer, '', 2);
				writeSection(writer, 2, () => handler.write(writer, imageResources, i));
			}
		}
	});

	// layer and mask info
	writeSection(writer, 2, () => {
		writeLayerInfo(writer, layers, psd, globalAlpha, opt);
		writeGlobalLayerMaskInfo(writer, psd.globalLayerMaskInfo);
		writeAdditionalLayerInfo(writer, psd, psd, opt);
	}, undefined, !!opt.psb);

	// image data
	const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
	const width = imageData ? imageData.width : psd.width;
	const height = imageData ? imageData.height : psd.height;
	const data: PixelData = { data: new Uint8Array(width * height * 4), width, height };

	writeUint16(writer, Compression.RleCompressed); // Photoshop doesn't support zip compression of composite image data

	if (RAW_IMAGE_DATA && (psd as any).imageDataRaw) {
		console.log('writing raw image data');
		writeBytes(writer, (psd as any).imageDataRaw);
	} else {
		if (imageData) data.data.set(new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength));

		// add weird white matte
		if (globalAlpha) {
			const size = data.width * data.height * 4;
			const p = data.data;
			for (let i = 0; i < size; i += 4) {
				const pa = p[i + 3];
				if (pa != 0 && pa != 255) {
					const a = pa / 255;
					const ra = 255 * (1 - a);
					p[i + 0] = p[i + 0] * a + ra;
					p[i + 1] = p[i + 1] * a + ra;
					p[i + 2] = p[i + 2] * a + ra;
				}
			}
		}

		writeBytes(writer, writeDataRLE(writer.tempBuffer, data, channels, !!options.psb));
	}
}

function writeLayerInfo(writer: PsdWriter, layers: Layer[], psd: Psd, globalAlpha: boolean, options: ExtendedWriteOptions) {
	writeSection(writer, 4, () => {
		writeInt16(writer, globalAlpha ? -layers.length : layers.length);

		const layersData = layers.map((l, i) => getChannels(writer.tempBuffer!, l, i === 0, options));

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
				if (options.psb) writeUint32(writer, 0);
				writeUint32(writer, c.length);
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

				if (channel.buffer) {
					writeBytes(writer, channel.buffer);
				}
			}
		}
	}, true, options.psb);
}

function writeLayerMaskData(writer: PsdWriter, { mask, realMask }: Layer, layerData: LayerChannelData) {
	writeSection(writer, 1, () => {
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

		writeZeros(writer, 2);
	});
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
			writeUint16(writer, info.opacity * 0xff);
			writeUint8(writer, info.kind);
			writeZeros(writer, 3);
		}
	});
}

function writeAdditionalLayerInfo(writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: ExtendedWriteOptions) {
	for (const handler of infoHandlers) {
		let key = handler.key;

		if (key === 'Txt2' && options.invalidateTextLayers) continue;
		if (key === 'vmsk' && options.psb) key = 'vsms';

		if (handler.has(target)) {
			const large = options.psb && largeAdditionalInfoKeys.indexOf(key) !== -1;
			const writeTotalLength = key !== 'Txt2' && key !== 'cinf' && key !== 'extn' && key !== 'CAI ' && key !== 'OCIO';
			const fourBytes = key === 'Txt2' || key === 'luni' || key === 'vmsk' || key === 'artb' || key === 'artd' ||
				key === 'vogk' || key === 'SoLd' || key === 'lnk2' || key === 'vscg' || key === 'vsms' || key === 'GdFl' ||
				key === 'lmfx' || key === 'lrFX' || key === 'cinf' || key === 'PlLd' || key === 'Anno' || key === 'CAI ' || key === 'OCIO' || key === 'GenI' || key === 'FEid';

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
		context.drawImage(imageDataToCanvas(psd.imageData), 0, 0);
	} else if (psd.canvas) {
		context.drawImage(psd.canvas, 0, 0);
	}

	return canvas;
}

function getMaskChannels(tempBuffer: Uint8Array, layerData: LayerChannelData, layer: Layer, mask: LayerMaskData, options: WriteOptions, realMask: boolean) {
	let top = (mask.top as any) | 0;
	let left = (mask.left as any) | 0;
	let right = (mask.right as any) | 0;
	let bottom = (mask.bottom as any) | 0;
	let { width, height } = getLayerDimentions(mask);
	let imageData = mask.imageData;

	if (!imageData && mask.canvas && width && height) {
		imageData = mask.canvas.getContext('2d')!.getImageData(0, 0, width, height);
	}

	if (width && height && imageData) {
		right = left + width;
		bottom = top + height;

		if (imageData.width !== width || imageData.height !== height) {
			throw new Error('Invalid imageData dimentions');
		}

		let buffer: Uint8Array;
		let compression: Compression;

		if (RAW_IMAGE_DATA && (layer as any)[realMask ? 'realMaskDataRaw' : 'maskDataRaw']) {
			buffer = (layer as any)[realMask ? 'realMaskDataRaw' : 'maskDataRaw'];
			compression = (layer as any)[realMask ? 'realMaskDataRawCompression' : 'maskDataRawCompression'];
		} else if (options.compress) {
			buffer = writeDataZipWithoutPrediction(imageData, [0]);
			compression = Compression.ZipWithoutPrediction;
		} else {
			buffer = writeDataRLE(tempBuffer, imageData, [0], !!options.psb)!;
			compression = Compression.RleCompressed;
		}

		layerData.channels.push({ channelId: realMask ? ChannelID.RealUserMask : ChannelID.UserMask, compression, buffer, length: 2 + buffer.length });
	}

	layerData[realMask ? 'realMask' : 'mask'] = { top, left, right, bottom };
}

function getChannels(tempBuffer: Uint8Array, layer: Layer, background: boolean, options: WriteOptions): LayerChannelData {
	const layerData = getLayerChannels(tempBuffer, layer, background, options);
	if (layer.mask) getMaskChannels(tempBuffer, layerData, layer, layer.mask, options, false);
	if (layer.realMask) getMaskChannels(tempBuffer, layerData, layer, layer.realMask, options, true);
	return layerData;
}

function getLayerDimentions({ canvas, imageData }: Layer): { width: number; height: number; } {
	return imageData || canvas || { width: 0, height: 0 };
}

function cropImageData(data: PixelData, left: number, top: number, width: number, height: number) {
	if (data.data instanceof Uint32Array || data.data instanceof Uint16Array) {
		throw new Error('imageData has incorrect bit depth');
	}

	const croppedData = createImageData(width, height);
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
		{ channelId: ChannelID.Transparency, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Color0, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Color1, compression: Compression.RawData, buffer: undefined, length: 2 },
		{ channelId: ChannelID.Color2, compression: Compression.RawData, buffer: undefined, length: 2 },
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

			if (!width || !height) return { layer, top, left, right, bottom, channels };

			data = cropImageData(data, trimmed.left, trimmed.top, width, height);
		}
	}

	const channelIds = [
		ChannelID.Color0,
		ChannelID.Color1,
		ChannelID.Color2,
	];

	if (!background || options.noBackground || layer.mask || hasAlpha(data) || (RAW_IMAGE_DATA && (layer as any).imageDataRaw?.['-1'])) {
		channelIds.unshift(ChannelID.Transparency);
	}

	channels = channelIds.map(channelId => {
		const offset = offsetForChannel(channelId, false); // TODO: psd.colorMode === ColorMode.CMYK);
		let buffer: Uint8Array;
		let compression: Compression;

		if (RAW_IMAGE_DATA && (layer as any).imageDataRaw) {
			// console.log('written raw layer image data');
			buffer = (layer as any).imageDataRaw[channelId];
			compression = (layer as any).imageDataRawCompression[channelId];
		} else if (options.compress) {
			buffer = writeDataZipWithoutPrediction(data, [offset]);
			compression = Compression.ZipWithoutPrediction;
		} else {
			buffer = writeDataRLE(tempBuffer, data, [offset], !!options.psb)!;
			compression = Compression.RleCompressed;
		}

		return { channelId, compression, buffer, length: 2 + buffer.length };
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
		writeInt16(writer, Math.round(color.a < 0 ? (color.a * 12800) : (color.a * 12700)));
		writeInt16(writer, Math.round(color.b < 0 ? (color.b * 12800) : (color.b * 12700)));
		writeUint16(writer, 0);
	} else if ('h' in color) {
		writeUint16(writer, ColorSpace.HSB);
		writeUint16(writer, Math.round(color.h * 0xffff));
		writeUint16(writer, Math.round(color.s * 0xffff));
		writeUint16(writer, Math.round(color.b * 0xffff));
		writeUint16(writer, 0);
	} else if ('c' in color) {
		writeUint16(writer, ColorSpace.CMYK);
		writeUint16(writer, Math.round(color.c * 257));
		writeUint16(writer, Math.round(color.m * 257));
		writeUint16(writer, Math.round(color.y * 257));
		writeUint16(writer, Math.round(color.k * 257));
	} else {
		writeUint16(writer, ColorSpace.Grayscale);
		writeUint16(writer, Math.round(color.k * 10000 / 255));
		writeZeros(writer, 6);
	}
}
