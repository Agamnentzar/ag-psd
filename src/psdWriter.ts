import { Psd, Layer, fromBlendMode, Compression, LayerAdditionalInfo, ColorMode, SectionDividerType, WriteOptions, ImageResources } from './psd';
import { ChannelData, getChannels, hasAlpha, createCanvas, writeDataRLE, PixelData, getLayerDimentions } from './helpers';
import { getHandlers } from './additionalInfo';
import { getHandlers as getImageResourceHandlers } from './imageResources';

export interface PsdWriter {
	offset: number;
	buffer: ArrayBuffer;
	view: DataView;
}

export function createWriter(size = 1024): PsdWriter {
	const buffer = new ArrayBuffer(size);
	const view = new DataView(buffer);
	const offset = 0;
	return { buffer, view, offset };
}

export function getWriterBuffer(writer: PsdWriter) {
	return writer.buffer.slice(0, writer.offset);
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

export function writeUint32(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 4);
	writer.view.setUint32(offset, value, false);
}

export function writeFloat64(writer: PsdWriter, value: number) {
	const offset = addSize(writer, 8);
	writer.view.setFloat64(offset, value, false);
}

export function writeBytes(writer: PsdWriter, buffer: Uint8Array | undefined) {
	if (buffer) {
		ensureSize(writer, writer.offset + buffer.length);
		const bytes = new Uint8Array(writer.buffer);
		bytes.set(buffer, writer.offset);
		writer.offset += buffer.length;
	}
}

export function writeSignature(writer: PsdWriter, signature: string) {
	if (!signature || signature.length !== 4) {
		throw new Error(`Invalid signature: '${signature}'`);
	}

	for (let i = 0; i < 4; i++) {
		writeUint8(writer, signature.charCodeAt(i));
	}
}

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

function getLayerSize(layer: Layer) {
	if (layer.canvas) {
		const { width, height } = getLayerDimentions(layer);
		return 2 * height + 2 * width * height;
	} else {
		return 0;
	}
}

function getLargestLayerSize(layers: Layer[] = []): number {
	return layers.reduce((max, layer) => Math.max(max, getLayerSize(layer), getLargestLayerSize(layer.children)), 0);
}

export function writePsd(writer: PsdWriter, psd: Psd, options: WriteOptions = {}) {
	if (!(+psd.width > 0 && +psd.height > 0))
		throw new Error('Invalid document size');

	let imageResources = psd.imageResources || {};

	if (options.generateThumbnail) {
		imageResources = { ...imageResources, thumbnail: createThumbnail(psd) };
	}

	const canvas = psd.canvas;
	const globalAlpha = !!canvas && hasAlpha(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height));
	const maxBufferSize = Math.max(getLargestLayerSize(psd.children), 4 * 2 * psd.width * psd.height + 2 * psd.height);
	const tempBuffer = new Uint8Array(maxBufferSize);

	writeHeader(writer, psd, globalAlpha);
	writeColorModeData(writer, psd);
	writeImageResources(writer, imageResources);
	writeLayerAndMaskInfo(tempBuffer, writer, psd, globalAlpha, options);
	writeImageData(tempBuffer, writer, psd, globalAlpha);
}

export function writeBuffer(writer: PsdWriter, buffer: Uint8Array | undefined) {
	if (buffer) {
		writeBytes(writer, buffer);
	}
}

export function writeZeros(writer: PsdWriter, count: number) {
	for (let i = 0; i < count; i++) {
		writeUint8(writer, 0);
	}
}

function writeSection(writer: PsdWriter, round: number, func: () => void) {
	const offset = writer.offset;
	writeUint32(writer, 0);

	func();

	let length = writer.offset - offset - 4;

	while ((length % round) !== 0) {
		writeUint8(writer, 0);
		length++;
	}

	const temp = writer.offset;
	writer.offset = offset;
	writeUint32(writer, length);
	writer.offset = temp;
}

function writeHeader(writer: PsdWriter, psd: Psd, globalAlpha: boolean) {
	writeSignature(writer, '8BPS');
	writeUint16(writer, 1); // version
	writeZeros(writer, 6);
	writeUint16(writer, globalAlpha ? 4 : 3); // channels
	writeUint32(writer, psd.height);
	writeUint32(writer, psd.width);
	writeUint16(writer, 8); // bits per channel
	writeUint16(writer, ColorMode.RGB);
}

function writeColorModeData(writer: PsdWriter, _psd: Psd) {
	writeSection(writer, 1, () => { });
}

function writeImageResources(writer: PsdWriter, imageResources: ImageResources) {
	writeSection(writer, 1, () => {
		for (const handler of getImageResourceHandlers()) {
			if (handler.has(imageResources)) {
				writeSignature(writer, '8BIM');
				writeUint16(writer, handler.key);
				writePascalString(writer, '');
				writeSection(writer, 2, () => handler.write(writer, imageResources));
			}
		}
	});
}

function writeLayerAndMaskInfo(tempBuffer: Uint8Array, writer: PsdWriter, psd: Psd, globalAlpha: boolean, options: WriteOptions) {
	writeSection(writer, 2, () => {
		writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options);
		writeGlobalLayerMaskInfo(writer);
		writeAdditionalLayerInfo(writer, psd);
	});
}

function writeLayerInfo(tempBuffer: Uint8Array, writer: PsdWriter, psd: Psd, globalAlpha: boolean, options: WriteOptions) {
	writeSection(writer, 2, () => {
		const layers: Layer[] = [];

		addChildren(layers, psd.children);

		if (!layers.length) {
			layers.push({});
		}

		const channels = layers.map((l, i) => getChannels(tempBuffer, l, i === 0, options));

		writeInt16(writer, globalAlpha ? -layers.length : layers.length);
		layers.forEach((l, i) => writeLayerRecord(writer, psd, l, channels[i]));
		channels.forEach(c => writeLayerChannelImageData(writer, c));
	});
}

function writeLayerRecord(writer: PsdWriter, psd: Psd, layer: Layer, channels: ChannelData[]) {
	writeUint32(writer, layer.top || 0);
	writeUint32(writer, layer.left || 0);
	writeUint32(writer, layer.bottom || 0);
	writeUint32(writer, layer.right || 0);
	writeUint16(writer, channels.length);

	for (const c of channels) {
		writeInt16(writer, c.channelId);
		writeUint32(writer, c.length);
	}

	writeSignature(writer, '8BIM');
	writeSignature(writer, fromBlendMode[layer.blendMode || 'normal']);
	writeUint8(writer, typeof layer.opacity !== 'undefined' ? layer.opacity : 255);
	writeUint8(writer, layer.clipping ? 1 : 0);

	let flags = 0;

	if (layer.transparencyProtected) {
		flags = flags | 0x01;
	}

	if (layer.hidden) {
		flags = flags | 0x02;
	}

	writeUint8(writer, flags);
	writeUint8(writer, 0); // filler
	writeSection(writer, 1, () => {
		writeLayerMaskData(writer);
		writeLayerBlendingRanges(writer, psd);
		writePascalString(writer, layer.name || '', 4);
		writeAdditionalLayerInfo(writer, layer);
	});
}

function writeLayerMaskData(writer: PsdWriter) {
	writeSection(writer, 1, () => { });
}

function writeLayerBlendingRanges(writer: PsdWriter, psd: Psd) {
	writeSection(writer, 1, () => {
		writeUint32(writer, 65535);
		writeUint32(writer, 65535);

		const channels = psd.channels || 0;

		for (let i = 0; i < channels; i++) {
			writeUint32(writer, 65535);
			writeUint32(writer, 65535);
		}
	});
}

function writeLayerChannelImageData(writer: PsdWriter, channels: ChannelData[]) {
	for (const channel of channels) {
		writeUint16(writer, channel.compression);

		if (channel.buffer) {
			writeBuffer(writer, channel.buffer);
		}
	}
}

function writeGlobalLayerMaskInfo(writer: PsdWriter) {
	writeSection(writer, 1, () => { });
}

function writeAdditionalLayerInfo(writer: PsdWriter, target: LayerAdditionalInfo) {
	for (const handler of getHandlers()) {
		if (handler.has(target)) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, handler.key);
			writeSection(writer, 2, () => handler.write(writer, target));
		}
	}
}

function writeImageData(tempBuffer: Uint8Array, writer: PsdWriter, psd: Psd, globalAlpha: boolean) {
	const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
	let data: PixelData;

	if (psd.canvas) {
		data = psd.canvas.getContext('2d')!.getImageData(0, 0, psd.width, psd.height);
	} else {
		data = {
			data: new Uint8Array(4 * psd.width * psd.height),
			width: psd.width,
			height: psd.height,
		};
	}

	writeUint16(writer, Compression.RleCompressed);
	writeBytes(writer, writeDataRLE(tempBuffer, data, psd.width, psd.height, channels));
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

function ensureSize(writer: PsdWriter, size: number) {
	if (size > writer.buffer.byteLength) {
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
