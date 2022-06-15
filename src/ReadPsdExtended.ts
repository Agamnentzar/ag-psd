import {ReadOptions} from 'ag-psd/dist/psd';
import {LayerExtended, PsdExtended} from './ExtendedTypes';
import {readPsd} from 'ag-psd';
interface BufferLike {
	buffer: ArrayBuffer;
	byteOffset: number;
	byteLength: number;
}

export const recurseChildren = (layers: LayerExtended[]) => {
	for (const layer of layers) {
		const children = layer.children;
		if (children) {
			for (const child of children) {
				child.parentId = layer.id;
				if (child.children) {
					recurseChildren(child.children);
				}
			}
		}
	}
};

export const readPsdExtended = (buffer: ArrayBuffer | BufferLike, options?: ReadOptions): PsdExtended => {
	const psd: PsdExtended = readPsd(buffer, options) as unknown as PsdExtended;
	if (psd.children) {
		recurseChildren(psd.children);
	}
	return psd;
};

