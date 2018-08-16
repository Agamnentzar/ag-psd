import { PsdWriter } from './psdWriter';

export class BufferPsdWriter extends PsdWriter {
	private buffer: Buffer;
	constructor(size = 1024) {
		super();
		this.buffer = new Buffer(size);
	}
	private ensureSize(size: number) {
		if (size > this.buffer.length) {
			let newLength = this.buffer.length;

			do {
				newLength *= 2;
			} while (size > newLength);

			const newBuffer = new Buffer(newLength);
			this.buffer.copy(newBuffer);
			this.buffer = newBuffer;
		}
	}
	private addSize(size: number) {
		const offset = this.offset;
		this.ensureSize(this.offset += size);
		return offset;
	}
	writeInt8(value: number) {
		const offset = this.addSize(1);
		this.buffer.writeInt8(value, offset);
	}
	writeUint8(value: number) {
		const offset = this.addSize(1);
		this.buffer.writeUInt8(value, offset);
	}
	writeInt16(value: number) {
		const offset = this.addSize(2);
		this.buffer.writeInt16BE(value, offset);
	}
	writeUint16(value: number) {
		const offset = this.addSize(2);
		this.buffer.writeUInt16BE(value, offset);
	}
	writeInt32(value: number) {
		const offset = this.addSize(4);
		this.buffer.writeInt32BE(value, offset);
	}
	writeUint32(value: number) {
		const offset = this.addSize(4);
		this.buffer.writeUInt32BE(value, offset);
	}
	writeFloat32(value: number) {
		const offset = this.addSize(4);
		this.buffer.writeFloatBE(value, offset);
	}
	writeFloat64(value: number) {
		const offset = this.addSize(8);
		this.buffer.writeDoubleBE(value, offset);
	}
	writeBytes(buffer: Uint8Array | undefined) {
		if (buffer) {
			const offset = this.offset;
			this.ensureSize(this.offset += buffer.length);

			for (let i = 0; i < buffer.length; i++)
				this.buffer[i + offset] = buffer[i];
		}
	}
	getBuffer() {
		return this.buffer.slice(0, this.offset);
	}
}
