import ArrayBufferPsdReader from './arrayBufferPsdReader';
import ArrayBufferPsdWriter from './arrayBufferPsdWriter';
import { Psd, ReadOptions, WriteOptions } from './psd';
export * from './psd';
export { default as PsdReader } from './psdReader';
export { default as PsdWriter } from './psdWriter';

export function readPsd(buffer: ArrayBuffer, options?: ReadOptions): Psd {
	let reader = new ArrayBufferPsdReader(buffer);
	return reader.readPsd(options);
}

export function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer {
	let writer = new ArrayBufferPsdWriter();
	writer.writePsd(psd, options);
	return writer.getBuffer();
}
