import { expect } from 'chai';
import { writeDataRLE, writeDataRaw, readDataRLE, offsetForChannel, PixelData, PixelArray } from '../helpers';
import { createReader } from '../psdReader';

const rleTests: PixelData[] = require('../../test/rle.json');

function toData(data: PixelArray) {
	const result: number[] = [];

	for (let i = 0; i < data.length; i++) {
		result.push(data[i], data[i], data[i], data[i]);
	}

	return result;
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
	});

	describe('writeDataRLE()', () => {
		it('returns undefined for 0 size', () => {
			expect(writeDataRLE({} as any, 0, 0, [0])).undefined;
			expect(writeDataRLE({} as any, 0, 100, [0])).undefined;
			expect(writeDataRLE({} as any, 100, 0, [0])).undefined;
		});

		rleTests.forEach((image, i) => {
			it(`correctly writes & reads RLE image (${i})`, () => {
				let array: Uint8Array | undefined;
				let result: number[];

				try {
					const input: PixelData = {
						width: image.width,
						height: image.height,
						data: toData(image.data),
					};
					const output: PixelData = {
						width: image.width,
						height: image.height,
						data: [],
					};

					array = writeDataRLE(input, image.width, image.height, [0]);
					//console.log(`buffer: [${array}]`);

					const reader = createReader(array!.buffer);
					readDataRLE(reader, output, 4, image.width, image.height, [0]);
					result = fromData(output.data);
				} catch (e) {
					throw new Error(`Error for image: ${i} [${array}] ${e.stack}`);
				}

				expect(result, `image: ${i} [${array}]`).eql(image.data);
			});
		});
	});

	describe('offsetForChannel()', () => {
		it('returns offset for other channelId', () => {
			expect(offsetForChannel(10)).equal(11);
		});
	});
});
