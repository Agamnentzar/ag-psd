import { ArrayBufferPsdReader } from './arrayBufferPsdReader';
import { ArrayBufferPsdWriter } from './arrayBufferPsdWriter';
import { Psd, ReadOptions, WriteOptions } from './psd';
export * from './psd';
export { PsdReader } from './psdReader';
export { PsdWriter } from './psdWriter';

export function readPsd(buffer: ArrayBuffer, options?: ReadOptions): Psd {
	const reader = new ArrayBufferPsdReader(buffer);
	return reader.readPsd(options);
}

export function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer {
	const writer = new ArrayBufferPsdWriter();
	writer.writePsd(psd, options);
	return writer.getBuffer();
}
