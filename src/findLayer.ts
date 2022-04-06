import {Layer, Psd} from './psd';

export function findPsdLayerById(id: number, psdObject: Psd | Layer): Layer | null {
	if (id === undefined) {
		return null;
	}
	if (id === psdObject.id) {
		return psdObject;
	}
	if (psdObject.children) {
		for (let i = 0; i < psdObject.children.length; i += 1) {
			const found = findPsdLayerById(id, psdObject.children[i]);
			if (found) {
				return found;
			}
		}
	}
	return null;
}
