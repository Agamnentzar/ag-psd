import {expect} from 'chai';
import {createCanvas, createCanvasFromData, initializeCanvas} from '../helpers';
import {Layer, Psd} from '../psd';
import {readPsdFromFile} from './common';
import {flattenPsd} from '../flatten';
// import {writePsdBuffer} from '../index';
// import * as fs from 'fs';

initializeCanvas(createCanvas, createCanvasFromData);

describe('When flattening a PSD file', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/flatten.psd');
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: Psd = flattenPsd(psd);
		// Enable next lines to view test output
		//const buffer = writePsdBuffer(flattenedPsd);
		//fs.writeFileSync('flattenedtest.psd', buffer);
		const children: Layer[] = flattenedPsd.children!;
		expect(children.length).to.equal(5);
		expect(children[2].name).to.equal('Layer 1 copy 2');
		expect(children[3].name).to.equal('Layer 2');
		expect(children[4].name).to.equal('TEXT LAYER 2 ');
	});
});

describe('When flattening a PSD file with groups', () => {
	let psd: Psd;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/flatten_groups.psd');
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: Psd = flattenPsd(psd);
		// Enable next lines to view test output
		//const buffer = writePsdBuffer(flattenedPsd);
		//fs.writeFileSync('flattenedtest.psd', buffer);
		const children: Layer[] = flattenedPsd.children!;
		expect(children.length).to.equal(1);
		expect(children[0].children!.length).to.equal(2);
	});
});
