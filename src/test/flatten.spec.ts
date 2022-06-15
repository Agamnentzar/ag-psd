import {expect} from 'chai';
import {flattenPsd} from '../flatten';
import * as fs from 'fs';
import {LayerExtended, PsdExtended} from '../ExtendedTypes';
import {initializeCanvas} from 'ag-psd';
import {createCanvas, readPsdFromFile} from './common';
import {createCanvasFromData} from 'ag-psd/dist/helpers';

initializeCanvas(createCanvas, createCanvasFromData);

describe('When flattening a PSD file', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/flatten.psd') ;
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'flatten.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(5);
		expect(children[2].name).to.equal('Layer 1 copy 2');
		expect(children[3].name).to.equal('Layer 2');
		expect(children[4].name).to.equal('TEXT LAYER 2 ');
	});
});

describe('When flattening a PSD file with groups', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/flatten_groups.psd') ;
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'flatten_groups.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(2);

	});
});

describe('When flattening a PSD file with groups that can be flattened', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/flatten_groups_2.psd');
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'flatten_groups_2.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(3);
	});
});

describe('When flattening a complex PSD file with groups that can be flattened', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/group_mask.psd') ;
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'group_mask.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(7);
	});
});

describe('When flattening a deep nesting complex PSD file with groups that can be flattened', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/group_mask.psd') ;
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'group_mask_deep_nesting.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(7);
	});
});

describe('When flattening a complex PSD file with clipped and nonclipped layers', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/clipped_vs_nonclipped_layer.psd') ;
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'clipped_vs_nonclipped_layer.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(3);
	});
});

describe('When flattening a complex PSD file', () => {
	let psd: PsdExtended;
	beforeEach(async () => {
		psd = readPsdFromFile('./test-manual/PUE444_cropped2.psd');
	});
	it('Should create the correct PSD structure', async () => {
		const flattenedPsd: PsdExtended = flattenPsd(psd) as PsdExtended;
		writeLayers(flattenedPsd, 'PUE444_cropped2.png');
		const children: LayerExtended[] = flattenedPsd.children!;
		expect(children.length).to.equal(20);
	});
});

function writeLayers(psd: PsdExtended, filename: string) {
	for (let i = 0; i < psd.children!.length; i++) {
		const canvas = psd.children![i].canvas;
		if (canvas) {
			const canvasData = canvas.toBuffer();
			fs.writeFileSync(`CANVAS_${i}_${filename}`, canvasData);
		}
		if (psd.children![i].mask) {
			const maskCanvas = psd.children![i].mask!.canvas!;
			if (maskCanvas) {
				const canvasData = maskCanvas.toBuffer();
				fs.writeFileSync(`MASK_${i}_${filename}`, canvasData);
			}
		}
	}
}
