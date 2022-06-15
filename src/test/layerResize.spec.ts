import {expect} from 'chai';
import {getMaskedLayerSize, PsdExtended} from '../index';
import {createCanvas, readPsdFromFile} from './common';
import {initializeCanvas} from 'ag-psd';
import {createCanvasFromData} from 'ag-psd/dist/helpers';

const psdFileToTest = './test-manual/masked_layer_size_2.psd';
initializeCanvas(createCanvas, createCanvasFromData);

describe('When getting the size of a layer mask that extends to the left of the border', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile(psdFileToTest);
	});
	it('Should crop layer size correctly', async () => {
		const layer = psd.children![4];
		const layerSize = getMaskedLayerSize(layer, 10, psd);
		expect(psd.width).to.equal(1000);
		expect(psd.height).to.equal(1000);
		expect(layerSize.left).to.equal(50);
		expect(layerSize.right).to.equal(317);
		expect(layerSize.top).to.equal(670);
		expect(layerSize.bottom).to.equal(910);
	});
});
