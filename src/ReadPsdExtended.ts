import {ReadOptions} from 'ag-psd/dist/psd';
import {LayerExtended, PsdExtended} from './ExtendedTypes';
import {PsdReader} from 'ag-psd';
import {readPsd} from 'ag-psd/dist/psdReader';

export const recurseChildren = (layers: LayerExtended[], parent: LayerExtended | PsdExtended) => {
	for (const layer of layers) {
		layer.parentId = parent.id;
		if (layer.children) {
			recurseChildren(layer.children, layer);
		}
	}
};

export const readPsdExtended = (reader: PsdReader, options?: ReadOptions): PsdExtended => {
	const psd: PsdExtended = readPsd(reader, options) as unknown as PsdExtended;
	if (psd.children) {
		recurseChildren(psd.children, psd);
	}
	return psd;
};

