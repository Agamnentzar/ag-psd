import { expect } from 'chai';
import { writeDataRaw, offsetForChannel, PixelData, PixelArray, writeDataRLE } from '../helpers';
import { createReader, readDataRLE } from '../psdReader';
import { range, repeat } from './common';

function toData(data: number[]) {
	const result: number[] = [];

	for (let i = 0; i < data.length; i++) {
		result.push(data[i], data[i], data[i], data[i]);
	}

	return new Uint8Array(result);
}

function fromData(data: PixelArray) {
	const result: number[] = [];

	for (let i = 0; i < data.length; i += 4) {
		result.push(data[i]);
	}

	return result;
}

describe('helpers', () => {
	describe('writeDataRaw()', () => {
		it('returns undefined for 0 size', () => {
			expect(writeDataRaw({} as any, 0, 0, 0)).undefined;
			expect(writeDataRaw({} as any, 0, 0, 100)).undefined;
			expect(writeDataRaw({} as any, 0, 100, 0)).undefined;
		});

		it('writes data', () => {
			writeDataRaw({ data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 }, 0, 16, 16);
		});
	});

	describe('writeDataRLE()', () => {
		it('returns undefined for 0 size', () => {
			expect(writeDataRLE(new Uint8Array(1), { width: 0, height: 0, data: [] } as any, [0], false)).undefined;
			expect(writeDataRLE(new Uint8Array(1), { width: 0, height: 100, data: [] } as any, [0], false)).undefined;
			expect(writeDataRLE(new Uint8Array(1), { width: 100, height: 0, data: [] } as any, [0], false)).undefined;
		});

		const rleTests: { name: string; width: number; height: number; data: number[]; }[] = [
			{ name: '1', width: 1, height: 1, data: [1] },
			{ name: '1 1', width: 2, height: 1, data: [1, 1] },
			{ name: '1 2', width: 2, height: 1, data: [1, 2] },
			{ name: '3 x 1', width: 3, height: 1, data: [1, 1, 1] },
			{ name: '1 2 3', width: 3, height: 1, data: [1, 2, 3] },
			{ name: '1 1 1 3 2 1', width: 6, height: 1, data: [1, 1, 1, 3, 2, 1] },
			{ name: '1 2 3 1 1 1', width: 6, height: 1, data: [1, 2, 3, 1, 1, 1] },
			{ name: '1 1 1 1 1 0', width: 6, height: 1, data: [1, 1, 1, 1, 1, 0] },
			{ name: '3x2 1 1 1 3 2 1', width: 3, height: 2, data: [1, 1, 1, 3, 2, 1] },
			{ name: '3x2 1 2 3 1 1 1', width: 3, height: 2, data: [1, 2, 3, 1, 1, 1] },
			{ name: '3x3 1 1 1 1 2 2 2 1 1', width: 3, height: 3, data: [1, 1, 1, 1, 2, 2, 2, 1, 1] },
			{ name: '3x3 upper range', width: 3, height: 3, data: [255, 255, 255, 254, 254, 254, 1, 1, 0] },
			{ name: '128 x 1', width: 128, height: 1, data: repeat(128, 1) },
			{ name: '130 x 1', width: 130, height: 1, data: repeat(130, 1) },
			{ name: '130 x 1 2', width: 130, height: 1, data: repeat(130 / 2, 1, 2) },
			{ name: '150 x 1', width: 150, height: 1, data: repeat(150, 1) },
			{ name: '100 x 1', width: 200, height: 1, data: repeat(200, 1) },
			{ name: '300 x 1', width: 300, height: 1, data: repeat(300, 1) },
			{ name: '500 x 1', width: 500, height: 1, data: repeat(500, 1) },
			{ name: '100x5 only 1', width: 100, height: 5, data: repeat(5 * 100, 1) },
			{
				name: 'large list of 1s with some random numbers in it', width: 100, height: 5, data: [
					...repeat(10, 1), 3, 3, 3, ...repeat(164, 1), 3, ...repeat(9, 1), 5, ...repeat(5, 1), 3, 3, 3, ...repeat(304, 1)
				]
			},
			{
				name: 'smal batch in sea of 0s', width: 146, height: 1, data: [
					...repeat(50, 0),
					1, 13, 30, 42, 54, 64, 72, 77, 82, 86, 89, 90, 93, 94, 94, 95, 95, 95, 96, 96, 96, 96, 95, 95, 95, 94,
					93, 92, 91, 89, 87, 84, 82, 80, 76, 72, 67, 62, 57, 49, 42, 34, 26, 19, 12, 5,
					...repeat(50, 0)
				]
			},
			{
				name: 'from broken psd', width: 141, height: 1, data: [
					237, 234, 233, 233, 233, 232, 233, 236, 238, 239, 239, 240, 241, 241, 238, 220, 217, 217, 215, 212,
					205, 201, 203, 207, 208, 210, 218, 226, 234, 236, 236, 238, 240, 234, 228, 208, 180, 163, 178, 189,
					205, 218, 219, 214, 214, 213, 205, 181, 171, 154, 132, 133, 163, 177, 179, 173, 76, 122, 168, 174,
					143, 116, 117, 133, 181, 130, 172, 190, 159, 4, 0, 45, 179, 190, 177, 167, 18, 44, 110, 174, 212,
					223, 229, 228, 213, 210, 170, 88, 200, 222, 210, 152, 152, 151, 190, 198, 210, 179, 183, 188, 189,
					189, 187, 187, 186, 186, 184, 193, 213, 222, 229, 232, 231, 228, 229, 233, 237, 240, 240, 238, 236,
					231, 226, 228, 230, 229, 222, 211, 201, 193, 189, 187, 186, 186, 186, 185, 184, 184, 186, 193, 198,
				]
			},
			{ name: '127 different + 3 repeated', width: 127 + 3, height: 1, data: [...range(0, 127), 1, 1, 1] },
		];

		rleTests.forEach(({ width, height, data, name }) => {
			it(`correctly writes & reads RLE image (${name})`, () => {
				if ((width * height) !== data.length) {
					throw new Error(`Invalid image data size ${width * height} !== ${data.length}`);
				}

				let array: Uint8Array | undefined;
				let result: number[];

				try {
					const input: PixelData = { width, height, data: toData(data) };
					const output: PixelData = { width, height, data: new Uint8Array(width * height * 4) };

					const buffer = new Uint8Array(16 * 1024 * 1024);
					array = writeDataRLE(buffer, input, [0], false)!;

					const reader = createReader(array!.buffer);
					readDataRLE(reader, output, width, height, 4, [0], false);
					result = fromData(output.data);
				} catch (e) {
					throw new Error(`Error for image: [${array}] ${e.stack}`);
				}

				expect(result, `image: [${array}]`).eql(data);
			});
		});
	});

	describe('offsetForChannel()', () => {
		it('returns offset for other channelId', () => {
			expect(offsetForChannel(10, false)).equal(11);
		});
	});
});
