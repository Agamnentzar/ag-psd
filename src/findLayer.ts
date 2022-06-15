import {LayerExtended, PsdExtended} from './ExtendedTypes';

export function findPsdLayerById(id: number, psdObject: PsdExtended | LayerExtended): LayerExtended | null {
	if (id === undefined) {
		return null;
	}
	if (id === psdObject.id) {
		return psdObject;
	}
	if (psdObject.children) {
		for (let i = 0; i < psdObject.children.length; i += 1) {
			const found = findPsdLayerById(id, (<LayerExtended[]>psdObject.children)[i]);
			if (found) {
				return found;
			}
		}
	}
	return null;
}
