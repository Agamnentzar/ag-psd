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

  function createAse(minorVersion: number, blocks: { type: number; data: number[]; }[]) {
    const uint16 = (v: number) => [(v >>> 8) & 0xff, v & 0xff];
    const uint32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    const bytes = [...Buffer.from('ASEF', 'latin1'), ...uint16(1), ...uint16(minorVersion), ...uint32(blocks.length)];
    for (const block of blocks) bytes.push(...uint16(block.type), ...uint32(block.data.length), ...block.data);
    return new Uint8Array(bytes);
  }

  function colorBlock(mode: string, values: number[], type?: number) {
    const data = [0, 2, 0, 65, 0, 0, ...Buffer.from(mode, 'latin1')]; // name "A"
    for (const v of values) {
      const b = Buffer.alloc(4);
      b.writeFloatBE(v);
      data.push(...b);
    }
    if (type !== undefined) data.push(0, type);
    return { type: 1, data };
  }

  it('skips unknown blocks and colors with unknown color mode', () => {
    const ase = readAse(createAse(1, [
      { type: 0x1234, data: [1, 2, 3] },
      colorBlock('XYZ ', [1, 2, 3], 2),
      colorBlock('RGB ', [1, 0.5, NaN], 5),
      colorBlock('Gray', [0.5]), // missing color type
    ]));
    expect(ase).eql({
      colors: [
        { name: 'A', color: { r: 1, g: 0.5, b: 0, type: 'normal' } },
        { name: 'A', color: { k: 0.5, type: 'normal' } },
      ],
    });
    expect(() => readAse(createAse(0, [{ type: 0x1234, data: [] }]), { throwForMissingFeatures: true })).throw('Invalid block type');
  });
});
