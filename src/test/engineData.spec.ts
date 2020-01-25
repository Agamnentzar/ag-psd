import './common';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { parseEngineData, serializeEngineData } from '../engineData';

const testsPath = path.join(__dirname, '..', '..', 'test');

function expectBuffersEqual(actual: Uint8Array, expected: Uint8Array, name: string) {
	const length = Math.max(actual.length, expected.length);

	for (let i = 0; i < length; i++) {
		if (actual[i] !== expected[i]) {
			fs.writeFileSync(path.join(__dirname, '..', '..', 'results', name), actual);
			throw new Error(`Different byte at 0x${i.toString(16)} in (${name})`);
		}
	}
}

describe('engineData', () => {
	const dataBin = fs.readFileSync(path.join(testsPath, 'engineData.bin'));
	const dataJSON = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData.json'), 'utf8'));
	const dataBin2 = fs.readFileSync(path.join(testsPath, 'engineData2.bin'));
	const dataJSON2 = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData2.json'), 'utf8'));

	it('parses engine data', () => {
		const result = parseEngineData(dataBin);

		expect(result).eql(dataJSON);
	});

	it('parses engine data (2)', () => {
		const result = parseEngineData(dataBin2);
		fs.writeFileSync(path.join(__dirname, '..', '..', 'results', 'engineData2.json'), JSON.stringify(result, null, 2), 'utf8');

		expect(result).eql(dataJSON2);
	});

	it('serializes engine data', () => {
		const result = serializeEngineData(dataJSON);
		
		expectBuffersEqual(result, dataBin, 'serialized.bin');
	});

	// TODO: floats encoded as integers in some fields (no way to use keys because they are all numeric)
	it.skip('serializes engine data (2)', () => {
		const result = serializeEngineData(dataJSON2, true);
		
		expectBuffersEqual(result, dataBin2, 'serialized2.bin');
	});
});
