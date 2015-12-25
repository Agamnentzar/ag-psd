import { Psd, Layer, fromBlendMode, Compression, LayerAdditionalInfo, ColorMode, SectionDividerType } from './psd';
import { ChannelData, getChannels, writeDataRaw, writeDataRLE } from './helpers';
import { getHandlers } from './additionalInfo';
import { getHandlers as getImageResourceHandlers } from './imageResources';

function addChildren(layers: Layer[], children: Layer[]) {
	for (let c of children) {
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

export default class PsdWriter {
	protected offset = 0;
	writeInt8(value: number) { throw new Error('Not implemented'); }
	writeUint8(value: number) { throw new Error('Not implemented'); }
	writeInt16(value: number) { throw new Error('Not implemented'); }
	writeUint16(value: number) { throw new Error('Not implemented'); }
	writeInt32(value: number) { throw new Error('Not implemented'); }
	writeUint32(value: number) { throw new Error('Not implemented'); }
	writeFloat32(value: number) { throw new Error('Not implemented'); }
	writeFloat64(value: number) { throw new Error('Not implemented'); }
	writeBytes(buffer: Uint8Array) { throw new Error('Not implemented'); }
	writeBuffer(buffer: ArrayBuffer) {
		if (buffer)
			this.writeBytes(new Uint8Array(buffer));
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
			let code = text.charCodeAt(i);
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
		let offset = this.offset;
		this.writeUint32(0);

		func();

		let length = this.offset - offset - 4;

		while ((length % round) !== 0) {
			this.writeUint8(0);
			length++;
		}

		let temp = this.offset;
		this.offset = offset;
		this.writeUint32(length);
		this.offset = temp;
	}
	writePsd(psd: Psd) {
		if (!(+psd.width > 0 && +psd.height > 0))
			throw new Error('Invalid document size');

		this.writeHeader(psd);
		this.writeColorModeData(psd);
		this.writeImageResources(psd);
		this.writeLayerAndMaskInfo(psd);
		this.writeImageData(psd);
	}
	private writeHeader(psd: Psd) {
		this.writeSignature('8BPS');
		this.writeUint16(1); // version
		this.writeZeros(6);
		this.writeUint16(psd.channels || 3);
		this.writeUint32(psd.height);
		this.writeUint32(psd.width);
		this.writeUint16(psd.bitsPerChannel || 8);
		this.writeUint16(typeof psd.colorMode !== 'undefined' ? psd.colorMode : ColorMode.RGB);
	}
	private writeColorModeData(psd: Psd) {
		this.writeSection(1, () => {
		});
	}
	private writeImageResources(psd: Psd) {
		this.writeSection(1, () => {
			if (psd.imageResources) {
				for (var handler of getImageResourceHandlers()) {
					if (handler.has(psd.imageResources)) {
						this.writeSignature('8BIM');
						this.writeUint16(handler.key);
						this.writePascalString('');
						this.writeSection(2, () => handler.write(this, psd.imageResources));
					}
				}
			}
		});
	}
	private writeLayerAndMaskInfo(psd: Psd) {
		this.writeSection(2, () => {
			this.writeLayerInfo(psd);
			this.writeGlobalLayerMaskInfo();
			this.writeAdditionalLayerInfo(psd);
		});
	}
	private writeLayerInfo(psd: Psd) {
		this.writeSection(2, () => {
			let layers: Layer[] = [];

			addChildren(layers, psd.children);

			if (!layers.length)
				layers.push({});

			let channels = layers.map((l, i) => getChannels(l, i === 0));

			// TODO: handle negative length for absolute alpha
			this.writeInt16(layers.length);
			layers.forEach((l, i) => this.writeLayerRecord(psd, l, channels[i]));
			channels.forEach(c => this.writeLayerChannelImageData(c));
		});
	}
	private writeLayerRecord(psd: Psd, layer: Layer, channels: ChannelData[]) {
		this.writeUint32(layer.top);
		this.writeUint32(layer.left);
		this.writeUint32(layer.bottom);
		this.writeUint32(layer.right);
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

			for (let i = 0; i < psd.channels; i++) {
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
		for (var handler of getHandlers()) {
			if (handler.has(target)) {
				this.writeSignature('8BIM');
				this.writeSignature(handler.key);
				this.writeSection(2, () => handler.write(this, target));
			}
		}
	}
	private writeImageData(psd: Psd) {
		let data = psd.canvas.getContext('2d').getImageData(0, 0, psd.width, psd.height);

		for (let i = 0; i < 3; i++) {
			this.writeUint16(Compression.RawData);
			this.writeBytes(writeDataRaw(data, i, psd.width, psd.height));
		}
	}
}
