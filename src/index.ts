import BufferPsdReader from './bufferPsdReader';
import BufferPsdWriter from './bufferPsdWriter';
import { Psd } from './psd';
export * from './psd';
export { default as PsdReader } from './psdReader';
export { default as PsdWriter } from './psdWriter';

export function readPsd(buffer: Buffer): Psd {
	let reader = new BufferPsdReader(buffer);
	return reader.readPsd();
}

export function writePsd(psd: Psd): Buffer {
	let writer = new BufferPsdWriter();
	writer.writePsd(psd);
	return writer.getBuffer();
}
