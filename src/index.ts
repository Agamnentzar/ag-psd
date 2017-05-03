import { BufferPsdReader } from './bufferPsdReader';
import { BufferPsdWriter } from './bufferPsdWriter';
import { Psd, ReadOptions, WriteOptions } from './psd';
export { initializeCanvas } from './bufferPsdReader';
export * from './psd';
export { PsdReader } from './psdReader';
export { PsdWriter } from './psdWriter';

export function readPsd(buffer: Buffer, options?: ReadOptions): Psd {
	const reader = new BufferPsdReader(buffer);
	return reader.readPsd(options);
}

export function writePsd(psd: Psd, options?: WriteOptions): Buffer {
	const writer = new BufferPsdWriter();
	writer.writePsd(psd, options);
	return writer.getBuffer();
}
