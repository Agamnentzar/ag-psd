import {expect} from 'chai';
import {createCanvas, createCanvasFromData, initializeCanvas} from '../helpers';
import {Psd} from '../psd';
import {getMaskedLayerSize} from '../index';
import {readPsdFromFile} from './common';
import * as fs from 'fs';

const psdFileToTest = './test-manual/masked_layer_size_2.psd';
initializeCanvas(createCanvas, createCanvasFromData);

describe('When getting the size of a layer mask that extends to the left of the border', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile(psdFileToTest);
	});
	it('Should crop layer size correctly', async () => {
		const layer = psd.children![4];
		const imageContent = await (<any>layer).canvas.toBuffer();
		fs.writeFileSync(
			`test1.png`,
			imageContent,
		);
		const maskContent = await (<any>layer).mask.canvas.toBuffer();
		fs.writeFileSync(
			`test1_mask.png`,
			maskContent,
		);
		const layerSize = getMaskedLayerSize(psd.children![4], 10, psd);
		expect(psd.width).to.equal(1000);
		expect(psd.height).to.equal(1000);
		expect(layerSize.left).to.equal(50);
		expect(layerSize.right).to.equal(317);
		expect(layerSize.top).to.equal(670);
		expect(layerSize.bottom).to.equal(910);
	});
});
