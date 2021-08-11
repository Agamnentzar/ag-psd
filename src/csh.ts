import { readVectorMask } from './additionalInfo';
import { LayerVectorMask } from './psd';
import { readUint32, checkSignature, createReader, readPascalString, readUnicodeString } from './psdReader';

export interface Csh {
	shapes: (LayerVectorMask & {
		name: string;
		id: string;
		width: number;
		height: number;
	})[];
}

export function readCsh(buffer: ArrayBufferView): Csh {
	const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	const csh: Csh = { shapes: [] };

	checkSignature(reader, 'cush');
	if (readUint32(reader) !== 2) throw new Error('Invalid version');
	const count = readUint32(reader);

	for (let i = 0; i < count; i++) {
		const name = readUnicodeString(reader);
		while (reader.offset % 4) reader.offset++; // pad to 4byte bounds
		if (readUint32(reader) !== 1) throw new Error('Invalid shape version');
		const size = readUint32(reader);
		const end = reader.offset + size;
		const id = readPascalString(reader, 1);
		// this might not be correct ???
		const y1 = readUint32(reader);
		const x1 = readUint32(reader);
		const y2 = readUint32(reader);
		const x2 = readUint32(reader);
		const width = x2 - x1;
		const height = y2 - y1;
		const mask: LayerVectorMask = { paths: [] };
		readVectorMask(reader, mask, width, height, end - reader.offset);
		csh.shapes.push({ name, id, width, height, ...mask });

		reader.offset = end;
	}

	return csh;
}
