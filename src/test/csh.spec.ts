import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { readCsh } from '../csh';
import { drawBezierPaths } from './utils';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'csh-read');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

describe('CSH', () => {
	fs.readdirSync(readFilesPath).forEach(f => {
		it(`reads CSH file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const baseResults = path.join(resultsFilesPath, 'csh', f);
			const fileName = path.join(basePath, 'src.csh');
			const csh = readCsh(fs.readFileSync(fileName));

			fs.mkdirSync(baseResults, { recursive: true });

			for (const shape of csh.shapes) {
				drawBezierPaths(shape.paths, shape.width, shape.height, path.join(baseResults, `shape-${shape.name}.png`));
			}

			fs.writeFileSync(path.join(baseResults, `data.json`), JSON.stringify(csh, null, 2));

			// console.log(require('util').inspect(csh, false, 99, true));

			const expected = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));

			expect(csh).eql(expected, f);
		});
	});

	it('throws regular error for bezier knot without subpath length record', () => {
		const bytes: number[] = [];
		const u32 = (v: number) => bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
		bytes.push(...Buffer.from('cush', 'latin1'));
		u32(2); // version
		u32(1); // count
		u32(0); // empty name (already aligned to 4 bytes)
		u32(1); // shape version
		u32(1 + 16 + 26); // size
		bytes.push(0); // empty id
		u32(0); u32(0); u32(10); u32(10); // bounds
		bytes.push(0, 1, ...new Array(24).fill(0)); // closed subpath bezier knot, linked
		expect(() => readCsh(new Uint8Array(bytes))).throw(Error, 'Bezier knot record without subpath length record');
	});
});
