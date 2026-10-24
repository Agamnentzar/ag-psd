import { expect } from 'chai';
import { encodeString, encodeStringTo, decodeString, stringLengthInBytes } from '../utf8';
import { createReader, decodeUtf8 } from '../psdReader';

function bytes(...values: number[]) {
	return new Uint8Array(values);
}

function toArray(value: Uint8Array) {
	return Array.from(value);
}

describe('utf8', () => {
	describe('stringLengthInBytes()', () => {
		it('returns 0 for empty string', () => {
			expect(stringLengthInBytes('')).equal(0);
		});

		it('counts ascii characters as 1 byte each', () => {
			expect(stringLengthInBytes('Hello')).equal(5);
		});

		it('counts polish diacritics as 2 bytes each', () => {
			expect(stringLengthInBytes('ą')).equal(2);
			expect(stringLengthInBytes('ąćęłńóśźż')).equal(9 * 2);
		});

		it('counts chinese characters as 3 bytes each', () => {
			expect(stringLengthInBytes('你好世界')).equal(4 * 3);
		});

		it('counts japanese characters as 3 bytes each', () => {
			expect(stringLengthInBytes('こんにちは')).equal(5 * 3);
			expect(stringLengthInBytes('カタカナ')).equal(4 * 3);
			expect(stringLengthInBytes('漢字')).equal(2 * 3);
		});

		it('counts emoji (surrogate pairs) as 4 bytes', () => {
			expect(stringLengthInBytes('😀')).equal(4);
			expect(stringLengthInBytes('😀🎉👍')).equal(3 * 4);
		});

		it('counts a lone surrogate as a replacement character (3 bytes)', () => {
			expect(stringLengthInBytes('\ud800')).equal(3);
			expect(stringLengthInBytes('\udc00')).equal(3);
		});

		it('matches the byte length produced by encodeString()', () => {
			const samples = ['Hello', 'Zażółć gęślą jaźń', '你好，世界', 'こんにちは世界', '😀🎉👨‍👩‍👧‍👦'];

			for (const sample of samples) {
				expect(stringLengthInBytes(sample)).equal(encodeString(sample).length, sample);
			}
		});
	});

	describe('encodeString() / decodeString() round-trip', () => {
		const samples: { name: string; value: string; }[] = [
			{ name: 'empty string', value: '' },
			{ name: 'ascii', value: 'The quick brown fox jumps over the lazy dog.' },
			{ name: 'polish', value: 'Zażółć gęślą jaźń' },
			{ name: 'chinese', value: '你好，世界！这是一段中文文本。' },
			{ name: 'japanese (hiragana/katakana/kanji)', value: 'こんにちは世界、これは日本語のテキストです。' },
			{ name: 'emoji', value: '😀🎉👍🍕🚀' },
			{ name: 'emoji with skin tone modifier', value: '👍🏽' },
			{ name: 'emoji with ZWJ sequence (family)', value: '👨‍👩‍👧‍👦' },
			{ name: 'mixed scripts and emoji', value: 'Hello Zażółć 你好 こんにちは 😀' },
		];

		samples.forEach(({ name, value }) => {
			it(`round-trips ${name}`, () => {
				const encoded = encodeString(value);
				expect(decodeString(encoded)).equal(value);
			});

			it(`matches native TextEncoder output for ${name}`, () => {
				const encoded = encodeString(value);
				const expected = new TextEncoder().encode(value);
				expect(toArray(encoded)).eql(toArray(expected));
			});

			it(`matches native TextDecoder output for ${name}`, () => {
				const encoded = encodeString(value);
				expect(decodeString(encoded)).equal(new TextDecoder().decode(encoded));
			});
		});
	});

	describe('encodeStringTo()', () => {
		it('writes encoded bytes at the given offset and returns the new offset', () => {
			const buffer = new Uint8Array(20).fill(0xff);
			const offset = encodeStringTo(buffer, 3, 'ą😀');
			const untouchedTail = Array.from({ length: 11 }, () => 0xff);

			// 'ą' -> 2 bytes, '😀' -> 4 bytes
			expect(offset).equal(3 + 2 + 4);
			expect(toArray(buffer.subarray(0, 3))).eql([0xff, 0xff, 0xff]);
			expect(toArray(buffer.subarray(9))).eql(untouchedTail);
		});
	});

	describe('malformed input handling (matches native TextEncoder/TextDecoder)', () => {
		it('replaces a lone high surrogate with U+FFFD when encoding', () => {
			const value = 'a\ud800b';
			expect(toArray(encodeString(value))).eql(toArray(new TextEncoder().encode(value)));
			expect(decodeString(encodeString(value))).equal('a�b');
		});

		it('replaces a lone low surrogate with U+FFFD when encoding', () => {
			const value = 'a\udc00b';
			expect(toArray(encodeString(value))).eql(toArray(new TextEncoder().encode(value)));
			expect(decodeString(encodeString(value))).equal('a�b');
		});

		it('replaces an invalid leading byte with U+FFFD when decoding', () => {
			const input = bytes(0x61, 0xff, 0x62); // 'a', invalid byte, 'b'
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
			expect(decodeString(input)).equal('a�b');
		});

		it('replaces an invalid continuation byte with U+FFFD and resyncs', () => {
			const input = bytes(0x61, 0xe2, 0x28, 0xa1); // 'a', invalid 3-byte sequence
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
		});

		it('replaces a truncated multi-byte sequence at the end of input', () => {
			const input = bytes(0x61, 0xe2, 0x82); // 'a' + incomplete 3-byte sequence
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
			expect(decodeString(input)).equal('a�');
		});

		it('replaces an overlong 2-byte encoding with a replacement character', () => {
			const input = bytes(0xc0, 0x80); // overlong encoding of NUL
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
		});

		it('replaces a UTF-8-encoded surrogate code point with a replacement character', () => {
			const input = bytes(0xed, 0xa0, 0x80); // encodes U+D800 (a surrogate, not a scalar value)
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
		});

		it('replaces an out-of-range 4-byte sequence with a replacement character', () => {
			const input = bytes(0xf4, 0x90, 0x80, 0x80); // encodes U+110000, beyond U+10FFFF
			expect(decodeString(input)).equal(new TextDecoder().decode(input));
		});
	});

	describe('long strings/buffers (crossing the >1000 native fast-path threshold)', () => {
		it('encodes a long string with an unpaired surrogate the same as a short one', () => {
			const short = 'x'.repeat(10) + '\ud800' + 'y'.repeat(10);
			const long = 'x'.repeat(2000) + '\ud800' + 'y'.repeat(10);

			expect(toArray(encodeString(short))).eql(toArray(new TextEncoder().encode(short)));
			expect(toArray(encodeString(long))).eql(toArray(new TextEncoder().encode(long)));
		});

		it('decodes a long malformed buffer the same way as a short one', () => {
			const shortBytes = bytes(0x61, 0xff, 0x62);
			const longBytes = new Uint8Array([...new TextEncoder().encode('x'.repeat(2000)), 0xff, 0x62]);

			expect(decodeString(shortBytes)).equal(new TextDecoder().decode(shortBytes));
			expect(decodeString(longBytes)).equal(new TextDecoder().decode(longBytes));
		});

		it('round-trips a long multi-script string the same way native APIs do', () => {
			// sliced to a length that may cut a surrogate pair in half, producing an unpaired surrogate
			const value = ('Zażółć 你好 こんにちは 😀 '.repeat(60)).slice(0, 1500);
			const nativeRoundTrip = new TextDecoder().decode(new TextEncoder().encode(value));

			expect(decodeString(encodeString(value))).equal(nativeRoundTrip);
		});
	});

	it('keeps leading BOM regardless of string length', () => {
		const reader = createReader(new ArrayBuffer(0));
		const short = new Uint8Array([0xef, 0xbb, 0xbf, 0x41]);
		const long = new Uint8Array(2000).fill(0x41);
		long.set([0xef, 0xbb, 0xbf]);

		expect(decodeString(short)).equal('﻿A');
		expect(decodeUtf8(reader, short)).equal('﻿A');
		expect(decodeUtf8(reader, long)).equal('﻿' + 'A'.repeat(1997));
		expect(reader.utf8Decoder).not.undefined; // created lazily for long strings
	});
});
