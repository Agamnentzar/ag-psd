import {expect} from 'chai';
import {createCanvas, createCanvasFromData, initializeCanvas} from '../helpers';
import {Layer, Psd} from '../psd';
import {readPsdFromFile} from './common';
import {flattenPsd} from '../flatten';

const psdFileToTest = './test-manual/flatten_test_nomask.psd';
initializeCanvas(createCanvas, createCanvasFromData);

describe('When flattening a PSD file', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile(psdFileToTest);
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: Psd = flattenPsd(psd);
		// Enable next lines to view test output
		// const buffer = writePsdBuffer(flattenedPsd);
		// fs.writeFileSync('flattenedtest.psd', buffer);
		const children: Layer[] = flattenedPsd.children!;
		expect(children.length).to.equal(8);
		expect(children[2].name).to.equal('4');
		expect(children[3].name).to.equal('More text');
		expect(children[4].name).to.equal('7');
		expect(children[5].name).to.equal('Group 1');
	});
});
