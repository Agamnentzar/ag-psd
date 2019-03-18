import './common';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { parseEngineData, serializeEngineData } from '../engineData';

const testsPath = path.join(__dirname, '..', '..', 'test');

describe('engineData', () => {
	const dataBin = fs.readFileSync(path.join(testsPath, 'engineData.bin'));
	const dataBinExpected = fs.readFileSync(path.join(testsPath, 'engineDataExpected.bin'));
	const dataJSON = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData.json'), 'utf8'));

	it('parses engine data', () => {
		const result = parseEngineData(dataBin);

		expect(result).eql(dataJSON);
	});

	it('serializes engine data', () => {
		const result = serializeEngineData(dataJSON);
		const length = Math.max(result.length, dataBinExpected.length);

		for (let i = 0; i < length; i++) {
			if (result[i] !== dataBinExpected[i]) {
				fs.writeFileSync(path.join(__dirname, '..', '..', 'results', 'serialized.bin'), result);
				throw new Error(`Different byte at 0x${i.toString(16)}`);
			}
		}
	});

	it.skip('parses engine data (no whitespace)', () => {
		const dataBin2 = fs.readFileSync(path.join(testsPath, 'engineData2.bin'));
		const dataJSON = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData2.json'), 'utf8'));
		const result = parseEngineData(dataBin2);

		fs.writeFileSync(
			path.join(__dirname, '..', '..', 'results', 'engineData2.json'),
			JSON.stringify(result, null, 2), 'utf8');

		expect(result).eql(dataJSON);
	});
});
