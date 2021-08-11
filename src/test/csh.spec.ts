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
});
