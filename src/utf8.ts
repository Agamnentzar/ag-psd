function charLengthInBytes(code: number): number {
	if ((code & 0xffffff80) === 0) {
		return 1;
	} else if ((code & 0xfffff800) === 0) {
		return 2;
	} else if ((code & 0xffff0000) === 0) {
		return 3;
	} else {
		return 4;
	}
}

// Returns scalar value at index `i` (combining surrogate pairs), replacing unpaired surrogates with U+FFFD,
// matching how TextEncoder converts a string to a sequence of Unicode scalar values.
// Values above 0xffff always take 2 UTF-16 code units.
function codePointAt(value: string, i: number): number {
	const code = value.charCodeAt(i);

	if (code < 0xd800 || code > 0xdfff) return code;

	// high surrogate
	if (code <= 0xdbff && (i + 1) < value.length) {
		const extra = value.charCodeAt(i + 1);

		// low surrogate
		if (extra >= 0xdc00 && extra <= 0xdfff) {
			return ((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
		}
	}

	// unpaired surrogate (lone high or lone low)
	return 0xfffd;
}

export function stringLengthInBytes(value: string): number {
	let result = 0;

	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);

		if (code < 0x80) {
			result += 1;
		} else if (code < 0x800) {
			result += 2;
		} else {
			const scalar = codePointAt(value, i);

			if (scalar > 0xffff) {
				result += 4;
				i++;
			} else {
				result += 3;
			}
		}
	}

	return result;
}

function writeCharacter(buffer: Uint8Array | Buffer, offset: number, code: number): number {
	const length = charLengthInBytes(code);

	switch (length) {
		case 1:
			buffer[offset] = code;
			break;
		case 2:
			buffer[offset] = ((code >> 6) & 0x1f) | 0xc0;
			buffer[offset + 1] = (code & 0x3f) | 0x80;
			break;
		case 3:
			buffer[offset] = ((code >> 12) & 0x0f) | 0xe0;
			buffer[offset + 1] = ((code >> 6) & 0x3f) | 0x80;
			buffer[offset + 2] = (code & 0x3f) | 0x80;
			break;
		default:
			buffer[offset] = ((code >> 18) & 0x07) | 0xf0;
			buffer[offset + 1] = ((code >> 12) & 0x3f) | 0x80;
			buffer[offset + 2] = ((code >> 6) & 0x3f) | 0x80;
			buffer[offset + 3] = (code & 0x3f) | 0x80;
			break;
	}

	return length;
}

export function encodeStringTo(buffer: Uint8Array | Buffer, offset: number, value: string): number {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);

		if (code < 0x80) {
			buffer[offset++] = code;
		} else {
			const scalar = codePointAt(value, i);
			if (scalar > 0xffff) i++;
			offset += writeCharacter(buffer, offset, scalar);
		}
	}

	return offset;
}

export function encodeString(value: string): Uint8Array {
	if (value.length > 1000 && typeof TextEncoder !== 'undefined') {
		return (new TextEncoder()).encode(value);
	}

	const buffer = new Uint8Array(stringLengthInBytes(value));
	encodeStringTo(buffer, 0, value);
	return buffer;
}

// UTF-8 decoder implementing the WHATWG Encoding Standard's non-fatal error handling,
// so malformed byte sequences are replaced with U+FFFD instead of throwing, matching TextDecoder.
export function decodeString(value: Uint8Array): string {
	if (value.byteLength > 1000 && typeof TextDecoder !== 'undefined') {
		return (new TextDecoder()).decode(value);
	}

	const result: string[] = [];

	function pushCodePoint(code: number) {
		if (code > 0xffff) {
			code -= 0x10000;
			result.push(String.fromCharCode((code >>> 10 & 0x3ff) | 0xd800));
			code = 0xdc00 | (code & 0x3ff);
		}

		result.push(String.fromCharCode(code));
	}

	let codePoint = 0;
	let bytesSeen = 0;
	let bytesNeeded = 0;
	let lowerBoundary = 0x80;
	let upperBoundary = 0xbf;

	for (let i = 0; i < value.length; i++) {
		const byte = value[i];

		if (bytesNeeded === 0) {
			if (byte <= 0x7f) {
				pushCodePoint(byte);
			} else if (byte >= 0xc2 && byte <= 0xdf) {
				bytesNeeded = 1;
				codePoint = byte & 0x1f;
			} else if (byte >= 0xe0 && byte <= 0xef) {
				if (byte === 0xe0) lowerBoundary = 0xa0;
				if (byte === 0xed) upperBoundary = 0x9f;
				bytesNeeded = 2;
				codePoint = byte & 0x0f;
			} else if (byte >= 0xf0 && byte <= 0xf4) {
				if (byte === 0xf0) lowerBoundary = 0x90;
				if (byte === 0xf4) upperBoundary = 0x8f;
				bytesNeeded = 3;
				codePoint = byte & 0x07;
			} else {
				// invalid leading byte
				pushCodePoint(0xfffd);
			}

			continue;
		}

		if (byte < lowerBoundary || byte > upperBoundary) {
			// invalid continuation byte: emit replacement and reprocess this byte as a new sequence start
			codePoint = 0;
			bytesNeeded = 0;
			bytesSeen = 0;
			lowerBoundary = 0x80;
			upperBoundary = 0xbf;
			pushCodePoint(0xfffd);
			i--;
			continue;
		}

		lowerBoundary = 0x80;
		upperBoundary = 0xbf;
		codePoint = (codePoint << 6) | (byte & 0x3f);
		bytesSeen++;

		if (bytesSeen !== bytesNeeded) continue;

		pushCodePoint(codePoint);
		codePoint = 0;
		bytesNeeded = 0;
		bytesSeen = 0;
	}

	// truncated sequence at end of input
	if (bytesNeeded !== 0) {
		pushCodePoint(0xfffd);
	}

	return result.join('');
}
