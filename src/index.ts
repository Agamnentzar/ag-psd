import { Psd, ReadOptions, WriteOptions } from './psd';
import { PsdWriter, writePsd as writePsdInternal, getWriterBuffer, createWriter } from './psdWriter';
import { PsdReader, readPsd as readPsdInternal, createReader } from './psdReader';
export { initializeCanvas } from './helpers';
export * from './psd';
export { PsdReader, PsdWriter };

export function readPsd(buffer: Buffer | ArrayBuffer, options?: ReadOptions): Psd {
	const reader = createReader('buffer' in buffer ? buffer.buffer : buffer);
	return readPsdInternal(reader, options);
}

export function writePsd(psd: Psd, options?: WriteOptions): Buffer {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return new Buffer(getWriterBuffer(writer));
}
