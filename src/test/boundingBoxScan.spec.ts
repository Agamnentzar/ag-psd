import {readPsdFromFile} from './common';
import * as path from 'path';
import {Psd, ReadOptions} from '../psd';
import {BoundingBoxScan, IBoundingBox} from '../BoundingBoxScanner';
import { expect } from 'chai';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'read');
const opts: ReadOptions = {
	throwForMissingFeatures: true,
	logMissingFeatures: true,
};

describe('BoundingBoxScan', () => {
	const psd: Psd = readPsdFromFile(path.join(readFilesPath, 'bounding-box-scan', 'src.psd'), {...opts});
	it('reads width and height properly', () => {
		expect(psd.width).equal(300);
		expect(psd.height).equal(432);
	});
	it('scans bounding transparency of a layer correctly', () => {
		const boundingBoxScan: BoundingBoxScan = new BoundingBoxScan();
		const boundingBox: IBoundingBox = boundingBoxScan.scanLayerTransparency((<any>psd).children[0]) as IBoundingBox;
		console.log('######################################');
		console.log(boundingBox);
		expect(boundingBox).to.be.exist;
		expect(boundingBox.left).to.equal(88);
		expect(boundingBox.right).to.equal(211);
		expect(boundingBox.top).to.equal(92);
		expect(boundingBox.bottom).to.equal(239);
	});
});
