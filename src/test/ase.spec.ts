import { expect } from "chai";
import { readAse } from "../ase";
import * as fs from 'fs';
import * as path from 'path';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'ase-read');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

describe('ASE', () => {
  fs.readdirSync(readFilesPath).forEach(f => {
    // fs.readdirSync(readFilesPath).filter(f => /s/.test(f)).forEach(f => {
    it(`reads ASE file (${f})`, () => {
      const basePath = path.join(readFilesPath, f);
      const fileName = path.join(basePath, 'src.ase');
      const ase = readAse(fs.readFileSync(fileName));

      const resultsPath = path.join(resultsFilesPath, 'ase', f);
      fs.mkdirSync(resultsPath, { recursive: true });

      // console.log(require('util').inspect(ase, false, 99, false));

      fs.writeFileSync(path.join(resultsPath, 'data.json'), JSON.stringify(ase, null, 2), 'utf8');
      const expected = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));

      expect(ase).eql(expected, f);
    });
  });
});
