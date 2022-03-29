import {expect} from 'chai';
import {createCanvas, createCanvasFromData, initializeCanvas} from '../helpers';
import {Psd} from '../psd';
import {flattenPsd, writePsdBuffer} from '../index';
import {readPsdFromFile} from './common';
import * as fs from 'fs';

const psdFileToTest = './test-manual/flatten_test_nomask.psd';
initializeCanvas(createCanvas, createCanvasFromData);

describe('When flattening a PSD file', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile(psdFileToTest);
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: Psd = flattenPsd(psd);
		const buffer = writePsdBuffer(flattenedPsd);
		fs.writeFileSync('flattenedtest.psd', buffer);
		expect(flattenedPsd.children?.length).to.equal(3);
	});
});
