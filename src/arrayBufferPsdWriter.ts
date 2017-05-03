import { PsdWriter } from './psdWriter';

export class ArrayBufferPsdWriter extends PsdWriter {
	private buffer: ArrayBuffer;
	private view: DataView;
	constructor(size = 1024) {
		super();
		this.buffer = new ArrayBuffer(size);
		this.view = new DataView(this.buffer);
	}
	private ensureSize(size: number) {
		if (size > this.buffer.byteLength) {
			var newLength = this.buffer.byteLength;

			do {
				newLength *= 2;
			} while (size > newLength);

			var newBuffer = new ArrayBuffer(newLength);
			var newBytes = new Uint8Array(newBuffer);
			var oldBytes = new Uint8Array(this.buffer);
			newBytes.set(oldBytes);
			this.buffer = newBuffer;
			this.view = new DataView(this.buffer);
		}
	}
	private addSize(size: number) {
		var offset = this.offset;
		this.ensureSize(this.offset += size);
		return offset;
	}
	writeInt8(value: number) {
		var offset = this.addSize(1);
		this.view.setInt8(offset, value);
	}
	writeUint8(value: number) {
		var offset = this.addSize(1);
		this.view.setUint8(offset, value);
	}
	writeInt16(value: number) {
		var offset = this.addSize(2);
		this.view.setInt16(offset, value, false);
	}
	writeUint16(value: number) {
		var offset = this.addSize(2);
		this.view.setUint16(offset, value, false);
	}
	writeInt32(value: number) {
		var offset = this.addSize(4);
		this.view.setInt32(offset, value, false);
	}
	writeUint32(value: number) {
		var offset = this.addSize(4);
		this.view.setUint32(offset, value, false);
	}
	writeFloat32(value: number) {
		var offset = this.addSize(4);
		this.view.setFloat32(offset, value, false);
	}
	writeFloat64(value: number) {
		var offset = this.addSize(8);
		this.view.setFloat64(offset, value, false);
	}
	writeBytes(buffer: Uint8Array | undefined) {
		if (buffer) {
			this.ensureSize(this.offset + buffer.length);
			var bytes = new Uint8Array(this.buffer);
			bytes.set(buffer, this.offset);
			this.offset += buffer.length;
		}
	}
	getBuffer() {
		return this.buffer.slice(0, this.offset);
	}
}
