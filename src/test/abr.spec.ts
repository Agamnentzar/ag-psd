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
		// fs.readdirSync(readFilesPath).filter(f => /s/.test(f)).forEach(f => {
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

	it.skip('test', () => {
		const fileName = `E:\\Downloads\\Fire_Brushes_-_Pixivu.abr`;
		const abr = readAbr(fs.readFileSync(fileName), { logMissingFeatures: true });
		console.log(require('util').inspect(abr, false, 99, true));
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
	})
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
