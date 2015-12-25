import ArrayBufferPsdReader from './arrayBufferPsdReader';
import ArrayBufferPsdWriter from './arrayBufferPsdWriter';
import { Psd } from './psd';
export * from './psd';
export { default as PsdReader } from './psdReader';
export { default as PsdWriter } from './psdWriter';

export function readPsd(buffer: ArrayBuffer): Psd {
	let reader = new ArrayBufferPsdReader(buffer);
	return reader.readPsd();
}

export function writePsd(psd: Psd): ArrayBuffer {
	let writer = new ArrayBufferPsdWriter();
	writer.writePsd(psd);
	return writer.getBuffer();
}
