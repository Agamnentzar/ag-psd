import {Psd} from '../psd';
import {readPsdFromFile} from './common';
import {flattenPsd} from '../flatten';
import {getMaskedLayerSize} from '../index';
import {expect} from 'chai';

describe('When flattening a deep nesting complex PSD file with groups that can be flattened', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/group_mask_deep_nesting.psd');
	});
	it('Should create the correct bounding boxes', async () => {
		const flattenedPsd: Psd = flattenPsd(psd) as Psd;
		let layerBoundingBox = getMaskedLayerSize(flattenedPsd.children![2], 10, flattenedPsd);
		expect(layerBoundingBox.left).to.equal(-10);
	});
});
