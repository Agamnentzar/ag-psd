import { Psd, Layer, fromBlendMode, Compression, LayerAdditionalInfo, ColorMode, SectionDividerType, WriteOptions } from './psd';
import { ChannelData, getChannels, writeDataRLE, hasAlpha } from './helpers';
import { getHandlers } from './additionalInfo';
import { getHandlers as getImageResourceHandlers } from './imageResources';

function addChildren(layers: Layer[], children: Layer[] | undefined) {
	if (!children)
		return;

	for (let c of children) {
		if (c.children && c.canvas)
			throw new Error(`Invalid layer: cannot have both 'canvas' and 'children' properties set`);

		if (c.children) {
			c.sectionDivider = {
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
			layers.push(c);
		} else {
			layers.push(c);
		}
	}
}

export class PsdWriter {
	protected offset = 0;
	writeInt8(_value: number) { throw new Error('Not implemented'); }
	writeUint8(_value: number) { throw new Error('Not implemented'); }
	writeInt16(_value: number) { throw new Error('Not implemented'); }
	writeUint16(_value: number) { throw new Error('Not implemented'); }
	writeInt32(_value: number) { throw new Error('Not implemented'); }
	writeUint32(_value: number) { throw new Error('Not implemented'); }
	writeFloat32(_value: number) { throw new Error('Not implemented'); }
	writeFloat64(_value: number) { throw new Error('Not implemented'); }
	writeBytes(_buffer: Uint8Array | undefined) { throw new Error('Not implemented'); }
	writeBuffer(buffer: ArrayBuffer | undefined) {
		if (buffer) {
			this.writeBytes(new Uint8Array(buffer));
		}
	}
	writeSignature(signature: string) {
		if (!signature || signature.length !== 4)
			throw new Error(`Invalid signature: '${signature}'`);

		for (let i = 0; i < 4; i++)
			this.writeUint8(signature.charCodeAt(i));
	}
	writeZeros(count: number) {
		for (let i = 0; i < count; i++)
			this.writeUint8(0);
	}
	writePascalString(text: string, padTo = 2) {
		let length = text.length;
		this.writeUint8(length);

		for (let i = 0; i < length; i++) {
			const code = text.charCodeAt(i);
			this.writeUint8(code < 128 ? code : '?'.charCodeAt(0));
		}

		while (++length % padTo)
			this.writeUint8(0);
	}
	writeUnicodeString(text: string) {
		this.writeUint32(text.length);

		for (let i = 0; i < text.length; i++)
			this.writeUint16(text.charCodeAt(i));
	}
	writeSection(round: number, func: Function) {
		const offset = this.offset;
		this.writeUint32(0);

		func();

		let length = this.offset - offset - 4;

		while ((length % round) !== 0) {
			this.writeUint8(0);
			length++;
		}

		const temp = this.offset;
		this.offset = offset;
		this.writeUint32(length);
		this.offset = temp;
	}
	writePsd(psd: Psd, _options?: WriteOptions) {
		if (!(+psd.width > 0 && +psd.height > 0))
			throw new Error('Invalid document size');

		const canvas = psd.canvas;
		const globalAlpha = !!canvas && hasAlpha(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height));

		this.writeHeader(psd, globalAlpha);
		this.writeColorModeData(psd);
		this.writeImageResources(psd);
		this.writeLayerAndMaskInfo(psd, globalAlpha);
		this.writeImageData(psd, globalAlpha);
	}
	private writeHeader(psd: Psd, globalAlpha: boolean) {
		this.writeSignature('8BPS');
		this.writeUint16(1); // version
		this.writeZeros(6);
		this.writeUint16(globalAlpha ? 4 : 3); // channels
		this.writeUint32(psd.height);
		this.writeUint32(psd.width);
		this.writeUint16(8); // bits per channel
		this.writeUint16(ColorMode.RGB);
	}
	private writeColorModeData(_psd: Psd) {
		this.writeSection(1, () => {
		});
	}
	private writeImageResources(psd: Psd) {
		this.writeSection(1, () => {
			const imageResources = psd.imageResources;

			if (imageResources) {
				for (let handler of getImageResourceHandlers()) {
					if (handler.has(imageResources)) {
						this.writeSignature('8BIM');
						this.writeUint16(handler.key);
						this.writePascalString('');
						this.writeSection(2, () => handler.write(this, imageResources));
					}
				}
			}
		});
	}
	private writeLayerAndMaskInfo(psd: Psd, globalAlpha: boolean) {
		this.writeSection(2, () => {
			this.writeLayerInfo(psd, globalAlpha);
			this.writeGlobalLayerMaskInfo();
			this.writeAdditionalLayerInfo(psd);
		});
	}
	private writeLayerInfo(psd: Psd, globalAlpha: boolean) {
		this.writeSection(2, () => {
			const layers: Layer[] = [];

			addChildren(layers, psd.children);

			if (!layers.length)
				layers.push({});

			const channels = layers.map((l, i) => getChannels(l, i === 0));

			this.writeInt16(globalAlpha ? -layers.length : layers.length);
			layers.forEach((l, i) => this.writeLayerRecord(psd, l, channels[i]));
			channels.forEach(c => this.writeLayerChannelImageData(c));
		});
	}
	private writeLayerRecord(psd: Psd, layer: Layer, channels: ChannelData[]) {
		this.writeUint32(layer.top || 0);
		this.writeUint32(layer.left || 0);
		this.writeUint32(layer.bottom || 0);
		this.writeUint32(layer.right || 0);
		this.writeUint16(channels.length);

		for (let c of channels) {
			this.writeInt16(c.channelId);
			this.writeUint32(c.length);
		}

		this.writeSignature('8BIM');
		this.writeSignature(fromBlendMode[layer.blendMode || 'normal']);
		this.writeUint8(typeof layer.opacity !== 'undefined' ? layer.opacity : 255);
		this.writeUint8(layer.clipping ? 1 : 0);

		let flags = 0;

		if (layer.transparencyProtected)
			flags = flags | 0x01;
		if (layer.hidden)
			flags = flags | 0x02;

		this.writeUint8(flags);
		this.writeUint8(0); // filler
		this.writeSection(1, () => {
			this.writeLayerMaskData();
			this.writeLayerBlendingRanges(psd);
			this.writePascalString(layer.name || '', 4);
			this.writeAdditionalLayerInfo(layer);
		});
	}
	private writeLayerMaskData() {
		this.writeSection(1, () => {
		});
	}
	private writeLayerBlendingRanges(psd: Psd) {
		this.writeSection(1, () => {
			this.writeUint32(65535);
			this.writeUint32(65535);

			const channels = psd.channels || 0;

			for (let i = 0; i < channels; i++) {
				this.writeUint32(65535);
				this.writeUint32(65535);
			}
		});
	}
	private writeLayerChannelImageData(channels: ChannelData[]) {
		for (let channel of channels) {
			this.writeUint16(channel.compression);

			if (channel.buffer)
				this.writeBuffer(channel.buffer);
		}
	}
	private writeGlobalLayerMaskInfo() {
		this.writeSection(1, () => {
		});
	}
	private writeAdditionalLayerInfo(target: LayerAdditionalInfo) {
		for (let handler of getHandlers()) {
			if (handler.has(target)) {
				this.writeSignature('8BIM');
				this.writeSignature(handler.key);
				this.writeSection(2, () => handler.write(this, target));
			}
		}
	}
	private writeImageData(psd: Psd, globalAlpha: boolean) {
		const channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
		let data: ImageData;

		if (psd.canvas) {
			data = psd.canvas.getContext('2d')!.getImageData(0, 0, psd.width, psd.height);
		} else {
			data = {
				data: new Uint8Array(4 * psd.width * psd.height) as any,
				width: psd.width,
				height: psd.height,
			};
		}

		this.writeUint16(Compression.RleCompressed);
		this.writeBytes(writeDataRLE(data, psd.width, psd.height, channels));
	}
}
