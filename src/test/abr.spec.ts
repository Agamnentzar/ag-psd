import { createCanvas } from 'canvas';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { readAbr } from '../abr';
import { compareCanvases, loadImagesFromDirectory } from './common';

const testFilesPath = path.join(__dirname, '..', '..', 'test');
const readFilesPath = path.join(testFilesPath, 'abr-read');
const resultsFilesPath = path.join(__dirname, '..', '..', 'results');

describe('ABR', () => {
	fs.readdirSync(readFilesPath).forEach(f => {
		// fs.readdirSync(readFilesPath).filter(f => /special/.test(f)).forEach(f => {
		it(`reads ABR file (${f})`, () => {
			const basePath = path.join(readFilesPath, f);
			const fileName = path.join(basePath, 'src.abr');
			const abr = readAbr(fs.readFileSync(fileName), { logMissingFeatures: true });

			const resultsPath = path.join(resultsFilesPath, 'abr', f);
			fs.mkdirSync(resultsPath, { recursive: true });

			const images = loadImagesFromDirectory(basePath);
			const compare: { name: string; canvas: HTMLCanvasElement | undefined; }[] = [];

			for (const sample of abr.samples) {
				const canvas = alphaToCanvas(sample.alpha, sample.bounds.w, sample.bounds.h);
				delete (sample as any).alpha;
				const name = `sample-${sample.id}.png`;
				fs.writeFileSync(path.join(resultsPath, name), canvas.toBuffer());
				compare.push({ name, canvas });
			}

			for (const pattern of abr.patterns) {
				const canvas = rgbToCanvas(pattern.data, pattern.bounds.w, pattern.bounds.h);
				delete (pattern as any).data;
				const name = `pattern-${pattern.id}.png`;
				fs.writeFileSync(path.join(resultsPath, name), canvas.toBuffer());
				compare.push({ name, canvas });
			}

			// console.log(require('util').inspect(abr, false, 99, true));

			fs.writeFileSync(path.join(resultsPath, 'data.json'), JSON.stringify(abr, null, 2), 'utf8');
			const expected = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));

			expect(abr).eql(expected, f);
			compare.forEach(i => compareCanvases(images[i.name], i.canvas, `${f}/${i.name}`));
		});
	});

	it.skip('test', function () {
		this.timeout(60 * 1000);

		const basePath = `E:\\Downloads\\Brushes-20211231T151021Z-001\\Brushes`;
		const outputPath = `E:\\Downloads\\output`;

		for (const dir of fs.readdirSync(basePath)) {
			const dirPath = path.join(basePath, dir);

			for (const file of fs.readdirSync(dirPath)) {
				if (!/\.abr$/.test(file)) continue;

				const filePath = path.join(basePath, dir, file);

				console.log(filePath);
				const abr = readAbr(fs.readFileSync(filePath));
				console.log(require('util').inspect(abr, false, 99, true));

				if (0) {
					fs.rmSync(path.join(outputPath, file), { recursive: true, force: true });
					fs.mkdirSync(path.join(outputPath, file));

					for (const sample of abr.samples) {
						const canvas = alphaToCanvas(sample.alpha, sample.bounds.w, sample.bounds.h);
						fs.writeFileSync(path.join(outputPath, file, 'sample-' + sample.id + '.png'), canvas.toBuffer());
						delete (sample as any).alpha;
					}

					for (const pattern of abr.patterns) {
						const canvas = rgbToCanvas(pattern.data, pattern.bounds.w, pattern.bounds.h);
						fs.writeFileSync(path.join(outputPath, file, 'pattern-' + pattern.id + '.png'), canvas.toBuffer());
						delete (pattern as any).data;
					}

					fs.writeFileSync(path.join(outputPath, file, 'info.json'), JSON.stringify(abr, null, 2), 'utf8');
				}
			}
		}
	});

	function createAbr(w: number, h: number, depth: number, data: number[]) {
		const body = [0, ...new Array(264).fill(0)]; // empty id, unknown bytes
		const int32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		body.push(...int32(0), ...int32(0), ...int32(h), ...int32(w), 0, depth, 1, ...data); // bounds, depth, RLE compression
		const brushLength = body.length;
		while (body.length % 4) body.push(0);
		const samp = [...int32(brushLength), ...body];
		return new Uint8Array([0, 6, 0, 2, ...Buffer.from('8BIMsamp', 'latin1'), ...int32(samp.length), ...samp]);
	}

	it('reads 16bit RLE compressed brush sample', () => {
		// 1 row: length 5, literal run of 4 bytes (0x1234, 0xff00)
		const abr = readAbr(createAbr(2, 1, 16, [0, 5, 3, 0x12, 0x34, 0xff, 0x00]));
		expect(Array.from(abr.samples[0].alpha)).eql([0x12, 0xff]);
	});

	it('skips RLE compressed brush sample larger than its data', () => {
		const abr = createAbr(10000, 10000, 8, new Array(100).fill(0));
		expect(readAbr(abr).samples).eql([]);
		expect(() => readAbr(abr, { throwForMissingFeatures: true })).throw('Brush sample data out of bounds');
	});

	it('does not read brush sample data past the end of the file', () => {
		// raw 8bit sample of 1000x1000 pixels with sample and section lengths claiming the data is there
		const int32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		const body = [0, ...new Array(264).fill(0), ...int32(0), ...int32(0), ...int32(1000), ...int32(1000), 0, 8, 0];
		const samp = [...int32(1000 * 1000 + body.length), ...body];
		const abr = new Uint8Array([0, 6, 0, 2, ...Buffer.from('8BIMsamp', 'latin1'), ...int32(0x7fffffff), ...samp]);
		expect(readAbr(abr).samples).eql([]);
		expect(() => readAbr(abr, { throwForMissingFeatures: true })).throw('Brush sample data out of bounds');
	});

	it('skips unknown sections and invalid samples', () => {
		const int32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		const lPdc = [...Buffer.from('8BIMlPdc', 'latin1'), ...int32(4), 1, 2, 3, 4];
		const valid = createAbr(2, 1, 16, [0, 5, 3, 0x12, 0x34, 0xff, 0x00]).slice(4);
		const invalid = createAbr(10000, 10000, 8, new Array(100).fill(0)).slice(4);
		const abr = readAbr(new Uint8Array([0, 6, 0, 2, ...lPdc, ...invalid, ...valid]));
		expect(abr.samples.length).equal(1);
		expect(Array.from(abr.samples[0].alpha)).eql([0x12, 0xff]);
	});
});

function alphaToCanvas(alpha: Uint8Array, width: number, height: number) {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d')!;
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

	for (let src = 0, dst = 0; src < alpha.length; src++, dst += 4) {
		imageData.data[dst + 0] = 255;
		imageData.data[dst + 1] = 255;
		imageData.data[dst + 2] = 255;
		imageData.data[dst + 3] = alpha[src];
	}

	context.putImageData(imageData, 0, 0);
	return canvas;
}

function rgbToCanvas(rgb: Uint8Array, width: number, height: number) {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d')!;
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	imageData.data.set(rgb);
	context.putImageData(imageData, 0, 0);
	return canvas;
}
