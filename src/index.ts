import { Psd, ReadOptions, WriteOptions } from './psd';
import { PsdWriter, writePsd as writePsdInternal, getWriterBuffer, createWriter } from './psdWriter';
import { PsdReader, readPsd as readPsdInternal, createReader } from './psdReader';
export { initializeCanvas } from './helpers';
export {
	ColorMode, ChannelID, Compression, SectionDividerType, Color, LayerEffectsShadowInfo, LayerEffectsOuterGlowInfo,
	LayerEffectsInnerGlowInfo, LayerEffectsBevelInfo, LayerEffectsSolidFillInfo, LayerEffectsInfo, LayerAdditionalInfo,
	ResolutionUnit, SizeUnit, ImageResources, Layer, Psd, ReadOptions, WriteOptions
} from './psd';
export { PsdReader, PsdWriter };

interface BufferLike {
	buffer: ArrayBuffer;
	byteOffset: number;
	byteLength: number;
}

export function readPsd(buffer: ArrayBuffer | BufferLike, options?: ReadOptions): Psd {
	const reader = 'buffer' in buffer ?
		createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
		createReader(buffer);
	return readPsdInternal(reader, options);
}

export function writePsd(psd: Psd, options?: WriteOptions): Buffer {
	const writer = createWriter();
	writePsdInternal(writer, psd, options);
	return new Buffer(getWriterBuffer(writer));
}
