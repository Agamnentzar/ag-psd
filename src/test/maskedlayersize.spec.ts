import {readPsdFromFile} from './common';
import {flattenPsd} from '../flatten';
import {expect} from 'chai';
import {PsdExtended} from '../ExtendedTypes';
import {getMaskedLayerSize} from '../layerSize';

describe('When flattening a deep nesting complex PSD file with groups that can be flattened', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/group_mask_deep_nesting.psd');
	});
	it('Should create the correct bounding boxes', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		let layerBoundingBox = getMaskedLayerSize(flattenedPsd.children![2], 10, flattenedPsd);
		expect(layerBoundingBox.left).to.equal(-10);
	});
});
