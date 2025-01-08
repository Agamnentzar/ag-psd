import { Psd, ReadOptions, WriteOptions } from './psd';
import { PsdWriter, writePsd as writePsdInternal, getWriterBuffer, createWriter, getWriterBufferNoCopy } from './psdWriter';
import { PsdReader, readPsd as readPsdInternal, createReader } from './psdReader';
import { fromByteArray } from 'base64-js';

export * from './abr';
export * from './csh';
export { initializeCanvas } from './helpers';
export * from './psd';
export type { PsdReader, PsdWriter };

interface BufferLike {
	buffer: ArrayBuffer;
	byteOffset: number;
	byteLength: number;
}

export const byteArrayToBase64 = fromByteArray;

export function readPsd(buffer: ArrayBuffer | BufferLike, options?: ReadOptions): Psd {
	const reader = 'buffer' in buffer ?
		createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
		createReader(buffer);
	return readPsdInternal(reader, options);
}

export function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return getWriterBuffer(writer);
}

export function writePsdUint8Array(psd: Psd, options?: WriteOptions): Uint8Array {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return getWriterBufferNoCopy(writer);
}

export function writePsdBuffer(psd: Psd, options?: WriteOptions): Buffer {
	if (typeof Buffer === 'undefined') {
		throw new Error('Buffer not supported on this platform');
	}

	return Buffer.from(writePsdUint8Array(psd, options));
}
