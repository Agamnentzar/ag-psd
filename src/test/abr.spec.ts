import { createCanvas } from 'canvas';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { readAbr } from '../abr';
import { writeAsciiStringOrClassId } from '../descriptor';
import { createWriter, getWriterBuffer, PsdWriter, writeFloat64, writeInt32, writeSignature, writeUint32, writeUint8, writeUnicodeString } from '../psdWriter';
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
		expect(Array.from(abr.samples[0].alpha)).eql([0x12, 0xfe]);
	});

	it('reads 16bit brush sample using 0-32768 range', () => {
		// 1 row: length 5, literal run of 4 bytes (0x8000, 0x4000)
		const abr = readAbr(createAbr(2, 1, 16, [0, 5, 3, 0x80, 0x00, 0x40, 0x00]));
		expect(Array.from(abr.samples[0].alpha)).eql([0xff, 0x80]);
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

	const uint16 = (v: number) => [(v >>> 8) & 0xff, v & 0xff];
	const uint32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

	function legacyBrush(type: number, data: number[]) {
		return [...uint16(type), ...uint32(data.length), ...data];
	}

	function legacySampledBrush(name: string | undefined, spacing: number, w: number, h: number, data: number[]) {
		const nameData = name === undefined ? [] : [...uint32(name.length + 1), ...[...name, '\0'].flatMap(c => uint16(c.charCodeAt(0)))];
		const bounds = [...uint32(10), ...uint32(20), ...uint32(10 + h), ...uint32(20 + w)]; // top, left, bottom, right
		return legacyBrush(2, [...uint32(0), ...uint16(spacing), ...nameData, 1, ...new Array(8).fill(0), ...bounds, ...uint16(8), ...data]);
	}

	it('reads ABR version 1 sampled and computed brushes', () => {
		// 2x2 sample, RLE compressed: row lengths, then each row as a literal run of 2 bytes
		const sampled = legacySampledBrush(undefined, 25, 2, 2, [1, ...uint16(3), ...uint16(3), 1, 0x10, 0x20, 1, 0x30, 0x40]);
		const computed = legacyBrush(1, [...uint32(0), ...uint16(0), ...uint16(19), ...uint16(50), ...uint16(-45 & 0xffff), ...uint16(80)]);
		const abr = readAbr(new Uint8Array([...uint16(1), ...uint16(2), ...sampled, ...computed]), { throwForMissingFeatures: true });

		expect(abr.samples.length).equal(1);
		expect(abr.samples[0].id).equal('brush-1');
		expect(abr.samples[0].bounds).eql({ x: 20, y: 10, w: 2, h: 2 });
		expect(Array.from(abr.samples[0].alpha)).eql([0x10, 0x20, 0x30, 0x40]);
		expect(abr.brushes).eql([
			{
				name: '',
				shape: {
					type: 'sampled', size: 2, angle: 0, roundness: 1, spacingOn: true, spacing: 0.25,
					flipX: false, flipY: false, name: '', sampledData: 'brush-1',
				},
				spacing: 1, wetEdges: false, noise: false, buildUp: false, useBrushSize: true,
			},
			{
				name: '',
				shape: {
					type: 'computed', size: 19, angle: -45, roundness: 0.5, spacingOn: false, spacing: 0,
					flipX: false, flipY: false, hardness: 0.8,
				},
				spacing: 1, wetEdges: false, noise: false, buildUp: false, useBrushSize: true,
			},
		]);
	});

	it('reads ABR version 2 sampled brush with name', () => {
		const sampled = legacySampledBrush('Splat', 10, 3, 1, [0, 1, 2, 3]); // raw data
		const abr = readAbr(new Uint8Array([...uint16(2), ...uint16(1), ...sampled]), { throwForMissingFeatures: true });

		expect(Array.from(abr.samples[0].alpha)).eql([1, 2, 3]);
		expect(abr.brushes[0].name).equal('Splat');
		expect(abr.brushes[0].shape).include({ type: 'sampled', name: 'Splat', size: 3, spacing: 0.1 });
	});

	it('reads brushes before truncated ABR version 1 brush', () => {
		const sampled = legacySampledBrush(undefined, 25, 1, 1, [0, 0xff]);
		const truncated = legacyBrush(2, [1, 2, 3]).slice(0, 8);
		const data = new Uint8Array([...uint16(1), ...uint16(2), ...sampled, ...truncated]);

		expect(readAbr(data).brushes.length).equal(1);
		expect(() => readAbr(data, { throwForMissingFeatures: true })).throw('Brush data out of bounds');
	});

	it('throws for empty file', () => {
		expect(() => readAbr(new Uint8Array(0))).throw('Invalid ABR file');
		expect(() => readAbr(new Uint8Array([0, 6]))).throw('Invalid ABR file');
	});

	// descriptor with explicit value types (descriptor writer can't infer types of brush descriptor keys)
	type DescValue = ['long', number] | ['bool', boolean] | ['TEXT', string] | ['UntF', string, number] | ['Objc', string, DescFields] | ['VlLs', DescValue[]];
	type DescFields = [string, DescValue][];

	function writeDescObject(writer: PsdWriter, classId: string, fields: DescFields) {
		writeUnicodeString(writer, '');
		writeAsciiStringOrClassId(writer, classId);
		writeUint32(writer, fields.length);

		for (const [key, value] of fields) {
			writeAsciiStringOrClassId(writer, key);
			writeDescValue(writer, value);
		}
	}

	function writeDescValue(writer: PsdWriter, value: DescValue) {
		writeSignature(writer, value[0]);

		switch (value[0]) {
			case 'long': writeInt32(writer, value[1]); break;
			case 'bool': writeUint8(writer, value[1] ? 1 : 0); break;
			case 'TEXT': writeUnicodeString(writer, value[1]); break;
			case 'UntF': writeSignature(writer, value[1]); writeFloat64(writer, value[2]); break;
			case 'Objc': writeDescObject(writer, value[1], value[2]); break;
			case 'VlLs': writeUint32(writer, value[1].length); value[1].forEach(v => writeDescValue(writer, v)); break;
		}
	}

	function createAbrWithBrushes(brushes: DescFields[]) {
		const writer = createWriter();
		writeUint32(writer, 16); // descriptor version
		writeDescObject(writer, 'null', [['Brsh', ['VlLs', brushes.map(b => ['Objc', 'brushPreset', b] as DescValue)]]]);
		const desc = Array.from(new Uint8Array(getWriterBuffer(writer)));
		return new Uint8Array([0, 6, 0, 2, ...Buffer.from('8BIMdesc', 'latin1'), ...uint32(desc.length), ...desc]);
	}

	it('reads transfer dynamics without wetness and mix dynamics (older Photoshop versions)', () => {
		const dynamics: DescValue = ['Objc', 'brVr', [
			['bVTy', ['long', 2]], ['fStp', ['long', 25]], ['jitter', ['UntF', '#Prc', 10]], ['Mnm ', ['UntF', '#Prc', 0]],
		]];
		const abr = readAbr(createAbrWithBrushes([[
			['Nm  ', ['TEXT', 'Brush']],
			['Brsh', ['Objc', 'computedBrush', [
				['Dmtr', ['UntF', '#Pxl', 10]], ['Hrdn', ['UntF', '#Prc', 100]], ['Angl', ['UntF', '#Ang', 0]],
				['Rndn', ['UntF', '#Prc', 100]], ['Spcn', ['UntF', '#Prc', 25]], ['Intr', ['bool', true]],
				['flipX', ['bool', false]], ['flipY', ['bool', false]],
			]]],
			['usePaintDynamics', ['bool', true]],
			['prVr', dynamics],
			['opVr', dynamics],
			['Wtdg', ['bool', false]], ['Nose', ['bool', false]], ['Rpt ', ['bool', false]], ['useBrushSize', ['bool', true]],
		]]), { throwForMissingFeatures: true });

		const expectedDynamics = { control: 'pen pressure', steps: 25, jitter: 0.1, minimum: 0 };
		expect(abr.brushes[0].transfer).eql({ flowDynamics: expectedDynamics, opacityDynamics: expectedDynamics });
	});

	it('skips unknown sections and invalid samples', () => {
		const int32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		const lPdc = [...Buffer.from('8BIMlPdc', 'latin1'), ...int32(4), 1, 2, 3, 4];
		const valid = createAbr(2, 1, 16, [0, 5, 3, 0x12, 0x34, 0xff, 0x00]).slice(4);
		const invalid = createAbr(10000, 10000, 8, new Array(100).fill(0)).slice(4);
		const abr = readAbr(new Uint8Array([0, 6, 0, 2, ...lPdc, ...invalid, ...valid]));
		expect(abr.samples.length).equal(1);
		expect(Array.from(abr.samples[0].alpha)).eql([0x12, 0xfe]);
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
