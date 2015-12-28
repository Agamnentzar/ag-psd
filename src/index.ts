import BufferPsdReader from './bufferPsdReader';
import BufferPsdWriter from './bufferPsdWriter';
import { Psd, ReadOptions, WriteOptions } from './psd';
export * from './psd';
export { default as PsdReader } from './psdReader';
export { default as PsdWriter } from './psdWriter';

export function readPsd(buffer: Buffer, options?: ReadOptions): Psd {
	let reader = new BufferPsdReader(buffer);
	return reader.readPsd(options);
}

export function writePsd(psd: Psd, options?: WriteOptions): Buffer {
	let writer = new BufferPsdWriter();
	writer.writePsd(psd, options);
	return writer.getBuffer();
}
