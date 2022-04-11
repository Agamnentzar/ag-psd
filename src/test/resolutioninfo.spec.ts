import {expect} from 'chai';
import {createCanvas, createCanvasFromData, initializeCanvas} from '../helpers';
import {Psd} from '../psd';
import {readPsdFromFile} from './common';

initializeCanvas(createCanvas, createCanvasFromData);

describe('When opening a PSD file', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/resolutioninfo.psd');
	});
	it('Should not return imageResources', async () => {
		expect(psd.imageResources).to.be.undefined;
	});
	it('Should not return resolutionInfo', async () => {
		expect(psd.imageResources?.resolutionInfo).to.be.undefined;
	});
});
