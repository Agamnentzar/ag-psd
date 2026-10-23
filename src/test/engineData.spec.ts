import './common';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { parseEngineData, serializeEngineData } from '../engineData';
import { decodeEngineData2 } from '../engineData2';
import { expectBuffersEqual } from './common';

const testsPath = path.join(__dirname, '..', '..', 'test');

function parseString(value: string) {
	return parseEngineData(Array.from(value).map(c => c.charCodeAt(0)), { log() { } });
}

describe('engineData', () => {
	const dataBin = fs.readFileSync(path.join(testsPath, 'engineData.bin'));
	const dataJSON = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData.json'), 'utf8'));
	const dataBin2 = fs.readFileSync(path.join(testsPath, 'engineData2b.bin'));
	const dataJSON2 = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData2.json'), 'utf8'));

	it('parses engine data', () => {
		const result = parseEngineData(dataBin, { log() { } });

		expect(result).eql(dataJSON);
	});

	it('parses engine data (2)', () => {
		const result = parseEngineData(dataBin2, { log() { } });
		fs.writeFileSync(path.join(__dirname, '..', '..', 'results', 'engineData2.json'), JSON.stringify(result, null, 2), 'utf8');

		expect(result).eql(dataJSON2);
	});

	it('serializes engine data', () => {
		const result = serializeEngineData(dataJSON);

		expectBuffersEqual(result, dataBin, 'serialized.bin');
	});

	// TODO: floats encoded as integers in some fields (no way to use keys because they are all numeric)
	it('serializes engine data (2)', () => {
		const result = serializeEngineData(dataJSON2, true);

		expectBuffersEqual(result, dataBin2, 'serialized2.bin');
	});

	it('parses /nil inside arrays', () => {
		expect(parseString('<< /A [ /nil /nil ] >>')).eql({ A: [null, null] });
		expect(parseString('<< /A [ /nil ] /B 1 >>')).eql({ A: [null], B: 1 });
		expect(parseString('<< /A [ /Name 1 ] >>')).eql({ A: ['/Name', 1] });
	});

	it('round-trips null, undefined and non-finite numbers', () => {
		const data = { A: null, B: undefined, C: NaN, D: Infinity, E: [null, undefined, 1], F: [NaN, 1], G: 2 };
		const expected = { A: null, C: 0, D: 0, E: [null, null, 1], F: [0, 1], G: 2 };

		expect(parseEngineData(serializeEngineData({ root: data }, false), { log() { } })).eql({ root: expected });
		expect(parseEngineData(serializeEngineData({ root: data }, true), { log() { } })).eql({ root: expected });
	});

	it('does not set prototype from __proto__ key', () => {
		const result = parseString('<< /__proto__ << /polluted 1 >> >>');

		expect(Object.getPrototypeOf(result)).equal(Object.prototype);
		expect(({} as any).polluted).undefined;
	});
});

describe('engineData2', () => {
	it('handles primitive uprooted values with type', () => {
		const result: any = decodeEngineData2({ '0': { '1': { '0': 5, '99': '/Type' } } });

		expect(result.ResourceDict.FontSet).equal(5);
	});

	it('keeps sibling keys of uprooted objects', () => {
		const result: any = decodeEngineData2({ '0': { '5': { '0': { '0': { '0': 'name' }, '1': 2 } } } });

		expect(result.ResourceDict.StyleSheetSet).eql({ Name: 'name', '1': 2 });
	});

	it('returns safe value for invalid data', () => {
		expect(decodeEngineData2(null).ResourceDict).not.undefined;
		expect(decodeEngineData2(5).ResourceDict).not.undefined;
		expect(decodeEngineData2({}).ResourceDict.TextFrameSet).undefined;
	});

	it('returns new objects for invalid data', () => {
		const a = decodeEngineData2(null);
		a.ResourceDict.FontSet.push({} as any);
		expect(decodeEngineData2(null).ResourceDict.FontSet).eql([]);
		expect(decodeEngineData2({}).ResourceDict.FontSet).eql([]);
	});

	it('throws on too deeply nested data', () => {
		let data: any = {};
		for (let i = 0; i < 1000; i++) data = { '1': data };
		expect(() => decodeEngineData2(data)).throw(/nested too deeply/);
	});
});
