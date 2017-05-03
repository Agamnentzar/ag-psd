import { PsdReader } from './psdReader';

function toUint8Array(buffer: Buffer) {
	const view = new Uint8Array(buffer.length);

	for (let i = 0; i < buffer.length; ++i)
		view[i] = buffer[i];

	return view;
}

let createCanvas: (width: number, height: number) => HTMLCanvasElement = () => {
	throw new Error('Canvas not initialized, use initializeCanvas method to set up canvas creation method');
};

export function initializeCanvas(createCanvasMethod: (width: number, height: number) => HTMLCanvasElement) {
	createCanvas = createCanvasMethod;
}

export class BufferPsdReader extends PsdReader {
	constructor(private buffer: Buffer) {
		super();
	}
	readInt8() {
		this.offset += 1;
		return this.buffer.readInt8(this.offset - 1);
	}
	readUint8() {
		this.offset += 1;
		return this.buffer.readUInt8(this.offset - 1);
	}
	readInt16() {
		this.offset += 2;
		return this.buffer.readInt16BE(this.offset - 2, false);
	}
	readUint16() {
		this.offset += 2;
		return this.buffer.readUInt16BE(this.offset - 2, false);
	}
	readInt32() {
		this.offset += 4;
		return this.buffer.readInt32BE(this.offset - 4, false);
	}
	readUint32() {
		this.offset += 4;
		return this.buffer.readUInt32BE(this.offset - 4, false);
	}
	readFloat32() {
		this.offset += 4;
		return this.buffer.readFloatBE(this.offset - 4, false);
	}
	readFloat64() {
		this.offset += 8;
		return this.buffer.readDoubleBE(this.offset - 8, false);
	}
	readBytes(length: number) {
		this.offset += length;
		return toUint8Array(this.buffer.slice(this.offset - length, this.offset));
	}
	createCanvas(width: number, height: number) {
		return createCanvas(width, height);
	}
}
