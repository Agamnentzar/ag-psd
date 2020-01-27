import {
	Psd, Layer, fromBlendMode, Compression, LayerAdditionalInfo, ColorMode, SectionDividerType,
	WriteOptions, LayerMaskFlags, MaskParameters
} from './psd';
import { getChannels, hasAlpha, createCanvas, writeDataRLE, PixelData, getLayerDimentions, LayerChannelData } from './helpers';
import { infoHandlers } from './additionalInfo';
import { resourceHandlers } from './imageResources';

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

export function writeInt32At(writer: PsdWriter, value: number, offset: number) {
	writer.view.setInt32(offset, value, false);
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
	writeUint32(writer, value * (1 << 16));
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
	if (signature.length !== 4) {
		throw new Error(`Invalid signature: '${signature}'`);
	}

	for (let i = 0; i < 4; i++) {
		writeUint8(writer, signature.charCodeAt(i));
	}
}

// export function writeUtf8String(writer: PsdWriter, value: string) {
// 	const buffer = encodeString(value);
// 	writeBytes(writer, buffer);
// }

export function writePascalString(writer: PsdWriter, text: string, padTo = 2) {
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
		if (layer.canvas) {
			const { width, height } = getLayerDimentions(layer);
			max = Math.max(max, 2 * height + 2 * width * height);
		}

		if (layer.children) {
			max = Math.max(max, getLargestLayerSize(layer.children));
		}
	}

	return max;
}

function writeSection(writer: PsdWriter, round: number, func: () => void) {
	const offset = writer.offset;
	writeInt32(writer, 0);

	func();

	let length = writer.offset - offset - 4;

	while ((length % round) !== 0) {
		writeUint8(writer, 0);
		length++;
	}

	writeInt32At(writer, length, offset);
}

export function writePsd(writer: PsdWriter, psd: Psd, options: WriteOptions = {}) {
	if (!(+psd.width > 0 && +psd.height > 0))
		throw new Error('Invalid document size');

	let imageResources = psd.imageResources || {};

	if (options.generateThumbnail) {
		imageResources = { ...imageResources, thumbnail: createThumbnail(psd) };
	}

	const canvas = psd.canvas;

	if (canvas && (psd.width !== canvas.width || psd.height !== canvas.height))
		throw new Error('Document canvas must have the same size as document');

	const imageData = canvas && canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
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
				writePascalString(writer, '');
				writeSection(writer, 2, () => handler.write(writer, imageResources));
			}
		}
	});

	// layer and mask info
	writeSection(writer, 2, () => {
		writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options);
		writeGlobalLayerMaskInfo(writer);
		writeAdditionalLayerInfo(writer, psd, options);
	});

	// image data
	const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
	const data: PixelData = imageData || {
		data: new Uint8Array(4 * psd.width * psd.height),
		width: psd.width,
		height: psd.height,
	};

	writeUint16(writer, Compression.RleCompressed);
	writeBytes(writer, writeDataRLE(tempBuffer, data, psd.width, psd.height, channels));
}

function writeLayerInfo(tempBuffer: Uint8Array, writer: PsdWriter, psd: Psd, globalAlpha: boolean, options: WriteOptions) {
	writeSection(writer, 2, () => {
		const layers: Layer[] = [];

		addChildren(layers, psd.children);

		if (!layers.length) {
			layers.push({});
		}

		writeInt16(writer, globalAlpha ? -layers.length : layers.length);

		const layerData = layers.map((l, i) => getChannels(tempBuffer, l, i === 0, options));

		for (const l of layerData) writeLayerRecord(writer, psd, l, options);
		for (const l of layerData) writeLayerChannelImageData(writer, l);
	});
}

const enum LayerFlags {
	TransparencyProtected = 1,
	Hidden = 2,
	Obsolete = 4, // obsolete
	HasRelevantBit4 = 8,
	PixelDataIrrelevantToAppearanceOfDocument = 16,
}

function writeLayerRecord(writer: PsdWriter, psd: Psd, layerData: LayerChannelData, options: WriteOptions) {
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
	writeSignature(writer, fromBlendMode[layer.blendMode || 'normal']);
	writeUint8(writer, Math.round((layer.opacity ?? 1) * 255));
	writeUint8(writer, layer.clipping ? 1 : 0);

	const flags = 0 |
		(layer.transparencyProtected ? LayerFlags.TransparencyProtected : 0) |
		(layer.hidden ? LayerFlags.Hidden : 0) |
		LayerFlags.HasRelevantBit4;

	writeUint8(writer, flags);
	writeUint8(writer, 0); // filler
	writeSection(writer, 1, () => {
		writeLayerMaskData(writer, layer, layerData);
		writeLayerBlendingRanges(writer, psd);
		writePascalString(writer, layer.name || '', 4);
		writeAdditionalLayerInfo(writer, layer, options);
	});
}

function writeLayerMaskData(writer: PsdWriter, { mask }: Layer, layerData: LayerChannelData) {
	writeSection(writer, 4, () => {
		if (mask && layerData.mask) {
			writeInt32(writer, layerData.mask.top);
			writeInt32(writer, layerData.mask.left);
			writeInt32(writer, layerData.mask.bottom);
			writeInt32(writer, layerData.mask.right);
			writeUint8(writer, mask.defaultColor || 0);

			const flags = 0 |
				(mask.disabled ? LayerMaskFlags.LayerMaskDisabled : 0) |
				(mask.positionRelativeToLayer ? LayerMaskFlags.PositionRelativeToLayer : 0);

			writeUint8(writer, flags);

			const parameters = 0 |
				(mask.userMaskDensity !== undefined ? MaskParameters.UserMaskDensity : 0) |
				(mask.userMaskFeather !== undefined ? MaskParameters.UserMaskFeather : 0) |
				(mask.vectorMaskDensity !== undefined ? MaskParameters.UserMaskDensity : 0) |
				(mask.vectorMaskFeather !== undefined ? MaskParameters.UserMaskFeather : 0);

			if (parameters) {
				writeUint8(writer, parameters);

				if (mask.userMaskDensity !== undefined)
					writeUint8(writer, mask.userMaskDensity);
				if (mask.userMaskFeather !== undefined)
					writeFloat64(writer, mask.userMaskFeather);
				if (mask.vectorMaskDensity !== undefined)
					writeUint8(writer, mask.vectorMaskDensity);
				if (mask.vectorMaskFeather !== undefined)
					writeFloat64(writer, mask.vectorMaskFeather);
			}

			// TODO: handle rest of the fields

			// writeZeros(writer, 2);
		}
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

function writeLayerChannelImageData(writer: PsdWriter, { channels }: LayerChannelData) {
	for (const channel of channels) {
		writeUint16(writer, channel.compression);

		if (channel.buffer) {
			writeBytes(writer, channel.buffer);
		}
	}
}

function writeGlobalLayerMaskInfo(writer: PsdWriter) {
	writeSection(writer, 1, () => {
		// TODO: implement
	});
}

function writeAdditionalLayerInfo(writer: PsdWriter, target: LayerAdditionalInfo, options: WriteOptions) {
	for (const handler of infoHandlers) {
		if (handler.key === 'Txt2' && options.invalidateTextLayers) continue;

		if (handler.has(target)) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, handler.key);
			writeSection(writer, 4, () => handler.write(writer, target));
		}
	}
}

function addChildren(layers: Layer[], children: Layer[] | undefined) {
	if (!children)
		return;

	for (const c of children) {
		if (c.children && c.canvas) {
			throw new Error(`Invalid layer: cannot have both 'canvas' and 'children' properties set`);
		}

		if (c.children) {
			const sectionDivider = {
				type: c.opened === false ? SectionDividerType.ClosedFolder : SectionDividerType.OpenFolder,
				key: 'pass',
				subtype: 0,
			};
			layers.push({
				name: '</Layer group>',
				sectionDivider: {
					type: SectionDividerType.BoundingSectionDivider,
				},
			});
			addChildren(layers, c.children);
			layers.push({ ...c, sectionDivider });
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

	if (psd.canvas) {
		context.drawImage(psd.canvas, 0, 0);
	}

	return canvas;
}
