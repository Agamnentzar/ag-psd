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

export function stringLengthInBytes(value: string): number {
	let result = 0;

	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);

		// high surrogate
		if (code >= 0xd800 && code <= 0xdbff) {
			if ((i + 1) < value.length) {
				const extra = value.charCodeAt(i + 1);

				// low surrogate
				if ((extra & 0xfc00) === 0xdc00) {
					i++;
					result += charLengthInBytes(((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
				}
			}
		} else {
			result += charLengthInBytes(code);
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

		// high surrogate
		if (code >= 0xd800 && code <= 0xdbff) {
			if ((i + 1) < value.length) {
				const extra = value.charCodeAt(i + 1);

				// low surrogate
				if ((extra & 0xfc00) === 0xdc00) {
					i++;
					const fullCode = ((code & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
					offset += writeCharacter(buffer, offset, fullCode);
				}
			}
		} else {
			offset += writeCharacter(buffer, offset, code);
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

function continuationByte(buffer: Uint8Array, index: number): number {
	if (index >= buffer.length) {
		throw Error('Invalid byte index');
	}

	const continuationByte = buffer[index];

	if ((continuationByte & 0xC0) === 0x80) {
		return continuationByte & 0x3F;
	} else {
		throw Error('Invalid continuation byte');
	}
}

export function decodeString(value: Uint8Array): string {
	if (value.byteLength > 1000 && typeof TextDecoder !== 'undefined') {
		return (new TextDecoder()).decode(value);
	}

	let result: string[] = [];

	for (let i = 0; i < value.length;) {
		const byte1 = value[i++];
		let code: number;

		if ((byte1 & 0x80) === 0) {
			code = byte1;
		} else if ((byte1 & 0xe0) === 0xc0) {
			const byte2 = continuationByte(value, i++);
			code = ((byte1 & 0x1f) << 6) | byte2;

			if (code < 0x80) {
				throw Error('Invalid continuation byte');
			}
		} else if ((byte1 & 0xf0) === 0xe0) {
			const byte2 = continuationByte(value, i++);
			const byte3 = continuationByte(value, i++);
			code = ((byte1 & 0x0f) << 12) | (byte2 << 6) | byte3;

			if (code < 0x0800) {
				throw Error('Invalid continuation byte');
			}

			if (code >= 0xd800 && code <= 0xdfff) {
				throw Error(`Lone surrogate U+${code.toString(16).toUpperCase()} is not a scalar value`);
			}
		} else if ((byte1 & 0xf8) === 0xf0) {
			const byte2 = continuationByte(value, i++);
			const byte3 = continuationByte(value, i++);
			const byte4 = continuationByte(value, i++);
			code = ((byte1 & 0x0f) << 0x12) | (byte2 << 0x0c) | (byte3 << 0x06) | byte4;

			if (code < 0x010000 || code > 0x10ffff) {
				throw Error('Invalid continuation byte');
			}
		} else {
			throw Error('Invalid UTF-8 detected');
		}

		if (code > 0xffff) {
			code -= 0x10000;
			result.push(String.fromCharCode(code >>> 10 & 0x3ff | 0xd800));
			code = 0xdc00 | code & 0x3ff;
		}

		result.push(String.fromCharCode(code));
	}

	return result.join('');
}
