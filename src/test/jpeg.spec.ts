import { expect } from 'chai';
import { decodeJpeg } from '../jpeg';

describe('jpeg', () => {
	const flat = (arrays: number[][]) => ([] as number[]).concat(...arrays);
	const createImageData = (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as any as ImageData;

	const SOI = [0xff, 0xd8];
	const EOI = [0xff, 0xd9];
	const DQT = [0xff, 0xdb, 0x00, 0x43, 0x00, ...new Array(64).fill(1)];
	// DC table 0: '0' -> 0, '10' -> 4; AC table 0: '0' -> EOB
	const DHT = [
		0xff, 0xc4, 0x00, 39,
		0x00, 1, 1, ...new Array(14).fill(0), 0, 4,
		0x10, 1, ...new Array(15).fill(0), 0,
	];
	const sof = (components: number[][]) => [
		0xff, 0xc0, 0x00, 8 + 3 * components.length, 8, 0x00, 0x08, 0x00, 0x08, components.length,
		...flat(components.map(([id, hv]) => [id, hv, 0])),
	];
	const sos = (ids: number[]) => [0xff, 0xda, 0x00, 6 + 2 * ids.length, ids.length, ...flat(ids.map(id => [id, 0x00])), 0, 63, 0];
	const adobe = (transformCode: number) => [0xff, 0xee, 0x00, 14, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0, 0, 0, 0, transformCode];
	// component 1: DC diff 15 ('10' + '1111'), EOB ('0'); components 2, 3: DC 0 ('0'), EOB ('0')
	const scan3 = [0xbc, 0x1f];
	// single component: DC 0, EOB
	const scan1 = [0x3f];

	const valid3 = (extra: number[] = []) => new Uint8Array([
		...SOI, ...extra, ...DQT, ...sof([[1, 0x11], [2, 0x11], [3, 0x11]]), ...DHT, ...sos([1, 2, 3]), ...scan3, ...EOI,
	]);

	it('decodes valid minimal jpeg', () => {
		const result = decodeJpeg(new Uint8Array([...SOI, ...DQT, ...sof([[1, 0x11]]), ...DHT, ...sos([1]), ...scan1, ...EOI]), createImageData);
		expect(result.width).equal(8);
		expect(result.data[0]).equal(128);
	});

	it('throws instead of hanging on zero sampling factors', function () {
		this.timeout(2000);
		for (const hv of [0x00, 0x01, 0x10, 0x51]) {
			const data = new Uint8Array([...SOI, ...DQT, ...sof([[1, hv]]), ...DHT, ...sos([1]), ...scan1, ...EOI]);
			expect(() => decodeJpeg(data, createImageData), hv.toString(16)).throw(/invalid sampling factors/);
		}
	});

	it('throws on frame without components', () => {
		const data = new Uint8Array([...SOI, ...DQT, ...sof([]), ...EOI]);
		expect(() => decodeJpeg(data, createImageData)).throw(/no components/);
	});

	it('throws on SOS before SOF', () => {
		const data = new Uint8Array([...SOI, ...DQT, ...DHT, ...sos([1]), ...scan1, ...EOI]);
		expect(() => decodeJpeg(data, createImageData)).throw(/scan before frame header/);
	});

	it('throws on SOS with unknown component', () => {
		const data = new Uint8Array([...SOI, ...DQT, ...sof([[1, 0x11]]), ...DHT, ...sos([9]), ...scan1, ...EOI]);
		expect(() => decodeJpeg(data, createImageData)).throw(/component 9 not found/);
	});

	it('throws on missing huffman tables', () => {
		const data = new Uint8Array([...SOI, ...DQT, ...sof([[1, 0x11]]), ...sos([1]), ...scan1, ...EOI]);
		expect(() => decodeJpeg(data, createImageData)).throw(/Missing Huffman table/);
	});

	it('throws on missing quantization tables', () => {
		const data = new Uint8Array([...SOI, ...sof([[1, 0x11]]), ...DHT, ...sos([1]), ...scan1, ...EOI]);
		expect(() => decodeJpeg(data, createImageData)).throw(/Missing quantization table/);
	});

	it('applies YCbCr transform for 3 components by default', () => {
		const { data } = decodeJpeg(valid3(), createImageData);
		expect(data[0]).not.equal(128);
		expect(data[0]).equal(data[1]);
		expect(data[0]).equal(data[2]);
	});

	it('respects Adobe transformCode 0 for 3 components (RGB)', () => {
		const { data } = decodeJpeg(valid3(adobe(0)), createImageData);
		expect(data[0]).not.equal(128);
		expect(data[1]).equal(128);
		expect(data[2]).equal(128);
	});

	it('respects Adobe transformCode 1 for 3 components (YCbCr)', () => {
		const { data } = decodeJpeg(valid3(adobe(1)), createImageData);
		expect(data[0]).equal(data[1]);
		expect(data[0]).equal(data[2]);
	});
});
