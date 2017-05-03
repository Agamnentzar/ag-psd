import { PsdReader } from './psdReader';

/* istanbul ignore next */
export class ArrayBufferPsdReader extends PsdReader {
	private view: DataView;
	constructor(private buffer: ArrayBuffer) {
		super();
		this.view = new DataView(this.buffer);
	}
	readInt8() {
		this.offset += 1;
		return this.view.getInt8(this.offset - 1);
	}
	readUint8() {
		this.offset += 1;
		return this.view.getUint8(this.offset - 1);
	}
	readInt16() {
		this.offset += 2;
		return this.view.getInt16(this.offset - 2, false);
	}
	readUint16() {
		this.offset += 2;
		return this.view.getUint16(this.offset - 2, false);
	}
	readInt32() {
		this.offset += 4;
		return this.view.getInt32(this.offset - 4, false);
	}
	readUint32() {
		this.offset += 4;
		return this.view.getUint32(this.offset - 4, false);
	}
	readFloat32() {
		this.offset += 4;
		return this.view.getFloat32(this.offset - 4, false);
	}
	readFloat64() {
		this.offset += 8;
		return this.view.getFloat64(this.offset - 8, false);
	}
	readBytes(length: number) {
		this.offset += length;
		return new Uint8Array(this.view.buffer, this.offset - length, length);
	}
	createCanvas(width: number, height: number) {
		let canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}
}
