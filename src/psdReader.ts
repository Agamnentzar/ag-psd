import { Psd, Layer, ChannelID, ColorMode, toBlendMode, Compression, SectionDividerType, LayerAdditionalInfo } from './psd';
import { resetCanvas, offsetForChannel, readDataRLE, decodeBitmap, readDataRaw } from './helpers';
import { getImageResourceName } from './imageResources';
import { getHandler } from './additionalInfo';
import { getHandler as getResourceHandler } from './imageResources';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB];

export default class PsdReader {
	protected offset = 0;
	readInt8(): number { throw new Error('Not implemented'); }
	readUint8(): number { throw new Error('Not implemented'); }
	readInt16(): number { throw new Error('Not implemented'); }
	readUint16(): number { throw new Error('Not implemented'); }
	readInt32(): number { throw new Error('Not implemented'); }
	readUint32(): number { throw new Error('Not implemented'); }
	readFloat32(): number { throw new Error('Not implemented'); }
	readFloat64(): number { throw new Error('Not implemented'); }
	readBytes(length: number): Uint8Array { throw new Error('Not implemented'); }
	createCanvas(width: number, height: number): HTMLCanvasElement { throw new Error('Not implemented'); }
	skip(count: number) {
		this.offset += count;
	}
	private readString(length: number) {
		let buffer: any = this.readBytes(length);
		return String.fromCharCode(...buffer);
	}
	readSignature() {
		return this.readString(4);
	}
	readPascalString(padTo = 2) {
		let length = this.readUint8();
		let text = this.readString(length);

		while (++length % padTo)
			this.skip(1);

		return text;
	}
	readUnicodeString() {
		let length = this.readUint32();
		let text = '';

		while (length--)
			text += String.fromCharCode(this.readUint16());

		return text;
	}
	readSection(round: number, func: (left?: () => number) => void) {
		let length = this.readUint32();
		let end = this.offset + length;

		if (length > 0)
			func(() => end - this.offset);

		/* istanbul ignore if */
		if (this.offset > end)
			throw new Error('Exceeded section limits');

		/* istanbul ignore if */
		if (this.offset !== end)
			throw new Error(`Unread section data: ${end - this.offset} bytes at ${this.offset.toString(16)}`);

		while (end % round)
			end++;

		this.offset = end;
	}
	readPsd() {
		let psd = this.readHeader();
		this.readColorModeData(psd);
		this.readImageResources(psd);
		this.readLayerAndMaskInfo(psd);
		this.readImageData(psd);
		return psd;
	}
	private readHeader(): Psd {
		this.checkSignature('8BPS');

		let version = this.readUint16();

		/* istanbul ignore if */
		if (version !== 1)
			throw new Error(`Invalid PSD file version: '${version}'`);

		this.skip(6);
		let channels = this.readUint16();
		let height = this.readUint32();
		let width = this.readUint32();
		let bitsPerChannel = this.readUint16();
		let colorMode = this.readUint16();

		/* istanbul ignore if */
		if (supportedColorModes.indexOf(colorMode) === -1)
			throw new Error(`Color mode not supported: ${colorMode}`);

		return { width, height, channels, bitsPerChannel, colorMode };
	}
	private readColorModeData(psd: Psd) {
		this.readSection(1, left => {
			throw new Error('Not Implemented: color mode data');
		});
	}
	private readImageResources(psd: Psd) {
		this.readSection(1, left => {
			while (left())
				this.readImageResource(psd);
		});
	}
	private readImageResource(psd: Psd) {
		this.checkSignature('8BIM');

		let id = this.readUint16();
		let name = this.readPascalString();

		this.readSection(2, left => {
			var handler = getResourceHandler(id);

			if (!psd.imageResources)
				psd.imageResources = {};

			if (handler) {
				handler.read(this, psd.imageResources, left);
			} else {
				//console.log(`Image resource: ${id} ${name} ${getImageResourceName(id).substr(0, 90) }`);
				this.skip(left());
			}
		});
	}
	private readLayerAndMaskInfo(psd: Psd) {
		this.readSection(2, left => {
			this.readLayerInfo(psd);
			this.readGlobalLayerMaskInfo(psd);

			while (left()) {
				if (left() > 2) {
					this.readAdditionalLayerInfo(psd);
				} else {
					this.skip(left());
				}
			}
		});
	}
	private readLayerInfo(psd: Psd) {
		this.readSection(2, left => {
			let layerCount = this.readInt16();
			let absoluteAlpha = false;

			// If it is a negative number, its absolute value is the number of layers and
			// the first alpha channel contains the transparency data for the merged result.
			if (layerCount < 0) {
				absoluteAlpha = true;
				layerCount = -layerCount;
			}

			let layers: Layer[] = [];
			let layerChannels: ChannelInfo[][] = [];

			for (let i = 0; i < layerCount; i++) {
				let { layer, channels } = this.readLayerRecord();
				layers.push(layer);
				layerChannels.push(channels);
			}

			for (let i = 0; i < layerCount; i++)
				this.readLayerChannelImageData(psd, layers[i], layerChannels[i]);

			this.skip(left());

			if (!psd.children)
				psd.children = [];

			let stack: (Layer | Psd)[] = [psd];

			for (let i = layers.length - 1; i >= 0; i--) {
				var l = layers[i];
				let type = l.sectionDivider ? l.sectionDivider.type : SectionDividerType.Other;

				if (type === SectionDividerType.OpenFolder || type === SectionDividerType.ClosedFolder) {
					l.opened = type === SectionDividerType.OpenFolder;
					l.children = [];
					stack[stack.length - 1].children.unshift(l);
					stack.push(l);
				} else if (type === SectionDividerType.BoundingSectionDivider) {
					stack.pop();
				} else {
					stack[stack.length - 1].children.unshift(l);
				}
			}
		});
	}
	private readLayerRecord() {
		let layer: Layer = <any>{};
		layer.top = this.readUint32();
		layer.left = this.readUint32();
		layer.bottom = this.readUint32();
		layer.right = this.readUint32();

		let channelCount = this.readUint16();
		let channels: ChannelInfo[] = [];

		for (var i = 0; i < channelCount; i++) {
			var channelID = <ChannelID>this.readInt16();
			var channelLength = this.readUint32();
			channels.push({ id: channelID, length: channelLength });
		}

		this.checkSignature('8BIM');

		let blendMode = this.readSignature();

		/* istanbul ignore if */
		if (!toBlendMode[blendMode])
			throw new Error(`Invalid blend mode: '${blendMode}'`);

		layer.blendMode = toBlendMode[blendMode];
		layer.opacity = this.readUint8();
		layer.clipping = this.readUint8() === 1;

		var flags = this.readUint8();
		layer.transparencyProtected = (flags & 0x01) !== 0;
		layer.hidden = (flags & 0x02) !== 0;

		this.readUint8(); // filler

		this.readSection(1, left => {
			this.readLayerMaskData();
			this.readLayerBlendingRanges();
			layer.name = this.readPascalString();

			while (left() && !this.readUint8())
				;

			this.offset--;

			while (left()) {
				this.readAdditionalLayerInfo(layer);
			}
		});

		return { layer, channels };
	}
	private readLayerMaskData() {
		this.readSection(1, left => {
			/* istanbul ignore if */
			if (left())
				throw new Error(`Not Implemented: layer mask data`);
		});
	}
	private readLayerBlendingRanges() {
		this.readSection(1, left => {
			let compositeGrayBlendSource = this.readUint32();
			let compositeGraphBlendDestinationRange = this.readUint32();

			while (left()) {
				let sourceRange = this.readUint32();
				let destRange = this.readUint32();
			}
		});
	}
	private readLayerChannelImageData(psd: Psd, layer: Layer, channels: ChannelInfo[]) {
		let layerWidth = layer.right - layer.left;
		let layerHeight = layer.bottom - layer.top;
		let canvas: HTMLCanvasElement = null;
		let context: CanvasRenderingContext2D = null;
		let data: ImageData = null;

		if (layerWidth && layerHeight) {
			canvas = this.createCanvas(psd.width, psd.height);
			context = canvas.getContext('2d');
			data = context.createImageData(layerWidth, layerHeight);
			resetCanvas(data);
		}

		for (let channel of channels) {
			let compression = <Compression>this.readUint16();
			let offset = offsetForChannel(channel.id);

			/* istanbul ignore if */
			if (offset < 0)
				throw new Error(`Channel not supported: ${channel.id}`);

			if (compression === Compression.RawData)
				readDataRaw(this, data, offset, layerWidth, layerHeight);
			else if (compression === Compression.RleCompressed)
				readDataRLE(this, data, offset, 4, layerWidth, layerHeight);
			else
				throw new Error(`Compression type not supported: ${compression}`);

			if (data && psd.colorMode === ColorMode.Grayscale) {
				let size = data.width * data.height * 4;

				for (let i = 0; i < size; i += 4) {
					data.data[i + 1] = data.data[i];
					data.data[i + 2] = data.data[i];
				}
			}
		}

		if (canvas) {
			context.putImageData(data, layer.left, layer.top);
			layer.canvas = canvas;
		}
	}
	private readGlobalLayerMaskInfo(psd: Psd) {
		this.readSection(1, left => {
			if (left())
				throw new Error(`Not Implemented: global layer mask info`);
		});
	}
	checkSignature(...expected: string[]) {
		let offset = this.offset;
		let signature = this.readSignature();

		/* istanbul ignore if */
		if (expected.indexOf(signature) === -1)
			throw new Error(`Invalid signature: '${signature}' at ${offset.toString(16)}`);
	}
	private readAdditionalLayerInfo(target: LayerAdditionalInfo) {
		this.checkSignature('8BIM', '8B64');
		let key = this.readSignature();

		this.readSection(2, left => {
			let handler = getHandler(key);

			if (handler) {
				handler.read(this, target, left);
			} else {
				console.log(`Unhandled additional info: ${key}`);
				this.skip(left());
			}

			if (left()) {
				console.log(`Unread ${left()} bytes left for tag: ${key}`);
				this.skip(left());
			}
		});
	}
	private readImageData(psd: Psd) {
		if (psd.colorMode === ColorMode.Bitmap) {
			let compression = <Compression>this.readUint16();
			let canvas = this.createCanvas(psd.width, psd.height);
			let context = canvas.getContext('2d');
			let data = context.createImageData(psd.width, psd.height);
			resetCanvas(data);

			if (compression === Compression.RawData) {
				let bitmapBytes = <any>this.readBytes(Math.ceil(psd.width / 8) * psd.height);
				decodeBitmap(bitmapBytes, data.data, psd.width, psd.height);
			} else if (compression === Compression.RleCompressed) {
				let bitmapData: ImageData = {
					data: [],
					width: psd.width,
					height: psd.height,
				};

				readDataRLE(this, bitmapData, 0, 1, psd.width, psd.height);
				decodeBitmap(bitmapData.data, data.data, psd.width, psd.height);
			} else {
				throw new Error(`Compression flag not supported: ${compression}`);
			}

			context.putImageData(data, 0, 0);
			psd.canvas = canvas;
		}
	}
}
