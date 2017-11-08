import { Psd, Layer, ChannelID, ColorMode, toBlendMode, Compression, SectionDividerType, LayerAdditionalInfo, ReadOptions } from './psd';
import { resetCanvas, offsetForChannel, readDataRLE, decodeBitmap, readDataRaw, PixelData, PixelArray } from './helpers';
import { getHandler } from './additionalInfo';
import { getHandler as getResourceHandler } from './imageResources';

interface ChannelInfo {
	id: ChannelID;
	length: number;
}

const supportedColorModes = [ColorMode.Bitmap, ColorMode.Grayscale, ColorMode.RGB];

function setupGrayscale(data: PixelData) {
	const size = data.width * data.height * 4;

	for (let i = 0; i < size; i += 4) {
		data.data[i + 1] = data.data[i];
		data.data[i + 2] = data.data[i];
	}
}

export class PsdReader {
	protected offset = 0;
	readInt8(): number { throw new Error('Not implemented'); }
	readUint8(): number { throw new Error('Not implemented'); }
	readInt16(): number { throw new Error('Not implemented'); }
	readUint16(): number { throw new Error('Not implemented'); }
	readInt32(): number { throw new Error('Not implemented'); }
	readUint32(): number { throw new Error('Not implemented'); }
	readFloat32(): number { throw new Error('Not implemented'); }
	readFloat64(): number { throw new Error('Not implemented'); }
	readBytes(_length: number): Uint8Array { throw new Error('Not implemented'); }
	createCanvas(_width: number, _height: number): HTMLCanvasElement { throw new Error('Not implemented'); }
	skip(count: number) {
		this.offset += count;
	}
	private readString(length: number) {
		const buffer: any = this.readBytes(length);
		return String.fromCharCode(...buffer);
	}
	readSignature() {
		return this.readString(4);
	}
	readPascalString(padTo = 2) {
		let length = this.readUint8();
		const text = this.readString(length);

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
	readSection<T>(round: number, func: (left: () => number) => T): T | undefined {
		const length = this.readUint32();
		let end = this.offset + length;
		let result: T | undefined;

		if (length > 0)
			result = func(() => end - this.offset);

		/* istanbul ignore if */
		if (this.offset > end)
			throw new Error('Exceeded section limits');

		/* istanbul ignore if */
		if (this.offset !== end)
			throw new Error(`Unread section data: ${end - this.offset} bytes at 0x${this.offset.toString(16)}`);

		while (end % round)
			end++;

		this.offset = end;
		return result;
	}
	checkSignature(...expected: string[]) {
		const offset = this.offset;
		const signature = this.readSignature();

		/* istanbul ignore if */
		if (expected.indexOf(signature) === -1)
			throw new Error(`Invalid signature: '${signature}' at 0x${offset.toString(16)}`);
	}
	readPsd(options?: ReadOptions) {
		const opt = options || {};
		const psd = this.readHeader();
		this.readColorModeData(psd);
		this.readImageResources(psd);
		const globalAlpha = this.readLayerAndMaskInfo(psd, !!opt.skipLayerImageData);
		const hasChildren = psd.children && psd.children.length;
		const skipComposite = opt.skipCompositeImageData && (opt.skipLayerImageData || hasChildren);

		if (!skipComposite)
			this.readImageData(psd, globalAlpha);

		return psd;
	}
	private readHeader(): Psd {
		this.checkSignature('8BPS');

		const version = this.readUint16();

		/* istanbul ignore if */
		if (version !== 1)
			throw new Error(`Invalid PSD file version: ${version}`);

		this.skip(6);
		const channels = this.readUint16();
		const height = this.readUint32();
		const width = this.readUint32();
		const bitsPerChannel = this.readUint16();
		const colorMode = this.readUint16();

		/* istanbul ignore if */
		if (supportedColorModes.indexOf(colorMode) === -1)
			throw new Error(`Color mode not supported: ${colorMode}`);

		return { width, height, channels, bitsPerChannel, colorMode };
	}
	private readColorModeData(_psd: Psd) {
		this.readSection(1, () => {
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

		const id = this.readUint16();
		const name = this.readPascalString();

		this.readSection(2, left => {
			const handler = getResourceHandler(id, name);

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
	private readLayerAndMaskInfo(psd: Psd, skipImageData: boolean) {
		let globalAlpha = false;

		this.readSection(1, left => {
			globalAlpha = this.readLayerInfo(psd, skipImageData);
			this.readGlobalLayerMaskInfo();

			while (left()) {
				if (left() > 2) {
					this.readAdditionalLayerInfo(psd);
				} else {
					this.skip(left());
				}
			}
		});

		return globalAlpha;
	}
	private readLayerInfo(psd: Psd, skipImageData: boolean) {
		let globalAlpha = false;

		this.readSection(2, left => {
			let layerCount = this.readInt16();

			if (layerCount < 0) {
				globalAlpha = true;
				layerCount = -layerCount;
			}

			const layers: Layer[] = [];
			const layerChannels: ChannelInfo[][] = [];

			for (let i = 0; i < layerCount; i++) {
				const { layer, channels } = this.readLayerRecord();
				layers.push(layer);
				layerChannels.push(channels);
			}

			if (!skipImageData) {
				for (let i = 0; i < layerCount; i++)
					this.readLayerChannelImageData(psd, layers[i], layerChannels[i]);
			}

			this.skip(left());

			if (!psd.children)
				psd.children = [];

			const stack: (Layer | Psd)[] = [psd];

			for (let i = layers.length - 1; i >= 0; i--) {
				const l = layers[i];
				const type = l.sectionDivider ? l.sectionDivider.type : SectionDividerType.Other;

				if (type === SectionDividerType.OpenFolder || type === SectionDividerType.ClosedFolder) {
					l.opened = type === SectionDividerType.OpenFolder;
					l.children = [];
					stack[stack.length - 1].children!.unshift(l);
					stack.push(l);
				} else if (type === SectionDividerType.BoundingSectionDivider) {
					stack.pop();
				} else {
					stack[stack.length - 1].children!.unshift(l);
				}
			}
		});

		return globalAlpha;
	}
	private readLayerRecord() {
		const layer: Layer = <any>{};
		layer.top = this.readInt32();
		layer.left = this.readInt32();
		layer.bottom = this.readInt32();
		layer.right = this.readInt32();

		const channelCount = this.readUint16();
		const channels: ChannelInfo[] = [];

		for (let i = 0; i < channelCount; i++) {
			const channelID = <ChannelID>this.readInt16();
			const channelLength = this.readUint32();
			channels.push({ id: channelID, length: channelLength });
		}

		this.checkSignature('8BIM');

		const blendMode = this.readSignature();

		/* istanbul ignore if */
		if (!toBlendMode[blendMode])
			throw new Error(`Invalid blend mode: '${blendMode}'`);

		layer.blendMode = toBlendMode[blendMode];
		layer.opacity = this.readUint8();
		layer.clipping = this.readUint8() === 1;

		const flags = this.readUint8();
		layer.transparencyProtected = (flags & 0x01) !== 0;
		layer.hidden = (flags & 0x02) !== 0;

		this.readUint8(); // filler

		this.readSection(1, left => {
			this.readLayerMaskData();
			this.readLayerBlendingRanges();
			layer.name = this.readPascalString();

			let last = 0;

			while (left() && (last = this.readUint8()) === 0)
				;

			if (last !== 0)
				this.offset--;

			while (left() > 4)
				this.readAdditionalLayerInfo(layer);
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
		return this.readSection(1, left => {
			const compositeGrayBlendSource = this.readUint32();
			const compositeGraphBlendDestinationRange = this.readUint32();
			const ranges = [];

			while (left()) {
				const sourceRange = this.readUint32();
				const destRange = this.readUint32();
				ranges.push({ sourceRange, destRange });
			}

			return { compositeGrayBlendSource, compositeGraphBlendDestinationRange, ranges };
		});
	}
	private readLayerChannelImageData(psd: Psd, layer: Layer, channels: ChannelInfo[]) {
		const layerWidth = layer.right! - layer.left!;
		const layerHeight = layer.bottom! - layer.top!;
		let canvas: HTMLCanvasElement | undefined;
		let context: CanvasRenderingContext2D | undefined;
		let data: ImageData | undefined;

		if (layerWidth && layerHeight) {
			canvas = this.createCanvas(layerWidth, layerHeight);
			context = canvas.getContext('2d')!;
			data = context.createImageData(layerWidth, layerHeight);
			resetCanvas(data);
		}

		for (let channel of channels) {
			const compression = <Compression>this.readUint16();
			const offset = offsetForChannel(channel.id);

			/* istanbul ignore if */
			if (offset < 0) {
				throw new Error(`Channel not supported: ${channel.id}`);
			}

			if (compression === Compression.RawData) {
				readDataRaw(this, data, offset, layerWidth, layerHeight);
			} else if (compression === Compression.RleCompressed) {
				readDataRLE(this, data, 4, layerWidth, layerHeight, [offset]);
			} else {
				throw new Error(`Compression type not supported: ${compression}`);
			}

			if (data && psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(data);
			}
		}

		if (context && data) {
			context.putImageData(data, 0, 0);
			layer.canvas = canvas;
		}
	}
	private readGlobalLayerMaskInfo() {
		return this.readSection(1, left => {
			if (left()) {
				const overlayColorSpace = this.readUint16();
				const colorSpace1 = this.readUint16();
				const colorSpace2 = this.readUint16();
				const colorSpace3 = this.readUint16();
				const colorSpace4 = this.readUint16();
				const opacity = this.readUint16();
				const kind = this.readUint8();
				this.skip(left());
				return { overlayColorSpace, colorSpace1, colorSpace2, colorSpace3, colorSpace4, opacity, kind };
			}
		});
	}
	private readAdditionalLayerInfo(target: LayerAdditionalInfo) {
		this.checkSignature('8BIM', '8B64');
		const key = this.readSignature();

		this.readSection(2, left => {
			const handler = getHandler(key);

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
	private readImageData(psd: Psd, globalAlpha: boolean) {
		const compression = <Compression>this.readUint16();

		if (supportedColorModes.indexOf(psd.colorMode!) === -1)
			throw new Error(`Color mode not supported: ${psd.colorMode}`);

		if (compression !== Compression.RawData && compression !== Compression.RleCompressed)
			throw new Error(`Compression type not supported: ${compression}`);

		const canvas = this.createCanvas(psd.width, psd.height);
		const context = canvas.getContext('2d')!;
		const data = context.createImageData(psd.width, psd.height);
		resetCanvas(data);

		if (psd.colorMode === ColorMode.Bitmap) {
			let bytes: PixelArray = [];

			if (compression === Compression.RawData) {
				bytes = this.readBytes(Math.ceil(psd.width / 8) * psd.height);
			} else if (compression === Compression.RleCompressed) {
				readDataRLE(this, { data: bytes, width: psd.width, height: psd.height }, 1, psd.width, psd.height, [0]);
			}

			decodeBitmap(bytes, data.data, psd.width, psd.height);
		} else { // Grayscale | RGB
			const channels = psd.colorMode === ColorMode.RGB ? [0, 1, 2] : [0];

			if (psd.channels && psd.channels > 3) {
				for (let i = 3; i < psd.channels; i++) {
					channels.push(i);
				}
			} else if (globalAlpha) {
				channels.push(3);
			}

			if (compression === Compression.RawData) {
				for (let i = 0; i < channels.length; i++) {
					readDataRaw(this, data, channels[i], psd.width, psd.height);
				}
			} else if (compression === Compression.RleCompressed) {
				readDataRLE(this, data, 4, psd.width, psd.height, channels);
			}

			if (psd.colorMode === ColorMode.Grayscale) {
				setupGrayscale(data);
			}
		}

		context.putImageData(data, 0, 0);
		psd.canvas = canvas;
	}
}
