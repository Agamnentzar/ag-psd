import { expect } from 'chai';
import { writeDataRLE, writeDataRaw, readDataRLE, offsetForChannel } from '../helpers';
import ArrayBufferPsdReader from '../arrayBufferPsdReader';

const rleTests: ImageData[] = require('../../test/rle.json');

function toData(data: number[]) {
	let result: number[] = [];

	for (let i = 0; i < data.length; i++)
		result.push(data[i], data[i], data[i], data[i]);

	return result;
}

function fromData(data: number[]) {
	let result: number[] = [];

	for (let i = 0; i < data.length; i += 4)
		result.push(data[i]);

	return result;
}

describe('helpers', function () {
	describe('writeDataRaw()', function () {
		it('should return null for 0 size', function () {
			expect(writeDataRaw(null, 0, 0, 0)).null;
			expect(writeDataRaw(null, 0, 0, 100)).null;
			expect(writeDataRaw(null, 0, 100, 0)).null;
		});
	});

	describe('writeDataRLE()', function () {
		it('sould return null for 0 size', function () {
			expect(writeDataRLE(null, 0, 0, [0])).null;
			expect(writeDataRLE(null, 0, 100, [0])).null;
			expect(writeDataRLE(null, 100, 0, [0])).null;
		});

		rleTests.forEach((image, i) => {
			it(`should correctly write & read RLE image (${i})`, function () {
				let array: Uint8Array;
				let result: number[];

				try {
					let input: ImageData = {
						width: image.width,
						height: image.height,
						data: toData(image.data),
					};
					let output: ImageData = {
						width: image.width,
						height: image.height,
						data: [],
					};

					array = writeDataRLE(input, image.width, image.height, [0]);
					//console.log(`buffer: [${array}]`);

					let reader = new ArrayBufferPsdReader(array.buffer);
					readDataRLE(reader, output, 4, image.width, image.height, [0]);
					result = fromData(output.data);
				} catch (e) {
					throw new Error(`Error for image: ${i} [${array}] ${e.stack}`);
				}

				expect(result, `image: ${i} [${array}]`).eql(image.data);
			});
		});
	});

	describe('offsetForChannel()', function () {
		it('should return -1 for invalid channelId', function () {
			expect(offsetForChannel(<any>999)).equal(-1);
		});
	});
});
