function isWhitespace(char: number) {
	// ' ', '\n', '\r', '\t'
	return char === 32 || char === 10 || char === 13 || char === 9;
}

function isNumber(char: number) {
	// 0123456789.-
	return (char >= 48 && char <= 57) || char === 46 || char === 45;
}

export function parseEngineData(data: number[] | Uint8Array) {
	let index = 0;

	function skipWhitespace() {
		while (index < data.length && isWhitespace(data[index])) {
			index++;
		}
	}

	function getTextByte() {
		let byte = data[index];
		index++;

		if (byte === 92) { // \
			byte = data[index];
			index++;
		}

		return byte;
	}

	function getText() {
		let result = '';

		if (data[index] === 41) { // )
			index++;
			return result;
		}

		// Strings start with utf-16 BOM
		if (data[index] !== 0xFE || data[index + 1] !== 0xFF) {
			throw new Error('Invalid utf-16 BOM');
		}

		index += 2;

		// ), ( and \ characters are escaped in ascii manner, remove the escapes before interpreting
		// the bytes as utf-16
		while (index < data.length && data[index] !== 41) { // )
			const high = getTextByte();
			const low = getTextByte();
			const char = (high << 8) | low;
			result += String.fromCharCode(char);
		}

		index++;
		return result;
	}

	let root: any = null;
	const stack: any[] = [];

	function pushContainer(value: any) {
		if (!stack.length) {
			stack.push(value);
			root = value;
		} else {
			pushValue(value);
			stack.push(value);
		}
	}

	function pushValue(value: any) {
		if (!stack.length) throw new Error('Invalid data');

		const top = stack[stack.length - 1];

		if (typeof top === 'string') {
			stack[stack.length - 2][top] = value;
			pop();
		} else if (Array.isArray(top)) {
			top.push(value);
		} else {
			throw new Error('Invalid data');
		}
	}

	function pushProperty(name: string) {
		if (!stack.length) pushContainer({});

		const top = stack[stack.length - 1];

		if (top && typeof top === 'string') {
			if (name === 'nil') {
				pushValue(null);
			} else {
				pushValue(`/${name}`);
			}
		} else if (top && typeof top === 'object') {
			stack.push(name);
		} else {
			throw new Error('Invalid data');
		}
	}

	function pop() {
		if (!stack.length) throw new Error('Invalid data');
		stack.pop();
	}

	skipWhitespace();

	let dataLength = data.length;

	while (dataLength > 0 && data[dataLength - 1] === 0) dataLength--; // trim 0 bytes from end

	while (index < dataLength) {
		const i = index;
		const char = data[i];

		if (char === 60 && data[i + 1] === 60) { // <<
			index += 2;
			pushContainer({});
		} else if (char === 62 && data[i + 1] === 62) { // >>
			index += 2;
			pop();
		} else if (char === 47) { // /
			index += 1;
			const start = index;

			while (index < data.length && !isWhitespace(data[index])) {
				index++;
			}

			let name = '';

			for (let i = start; i < index; i++) {
				name += String.fromCharCode(data[i]);
			}

			pushProperty(name);
		} else if (char === 40) { // (
			index += 1;
			pushValue(getText());
		} else if (char === 91) { // [
			index += 1;
			pushContainer([]);
		} else if (char === 93) { // ]
			index += 1;
			pop();
		} else if (char === 110 && data[i + 1] === 117 && data[i + 2] === 108 && data[i + 3] === 108) { // null
			index += 4;
			pushValue(null);
		} else if (char === 116 && data[i + 1] === 114 && data[i + 2] === 117 && data[i + 3] === 101) { // true
			index += 4;
			pushValue(true);
		} else if (char === 102 && data[i + 1] === 97 && data[i + 2] === 108 && data[i + 3] === 115 && data[i + 4] === 101) { // false
			index += 5;
			pushValue(false);
		} else if (isNumber(char)) {
			let value = '';

			while (index < data.length && isNumber(data[index])) {
				value += String.fromCharCode(data[index]);
				index++;
			}

			pushValue(parseFloat(value));
		} else {
			index += 1;
			console.log(`Invalid token '${String.fromCharCode(char)}' (${char}) at ${index}`
				// + ` near '${String.fromCharCode.apply(null, data.slice(index - 10, index + 20) as any)}'`
				// + ` data [${Array.from(data.slice(index - 10, index + 20)).join(', ')}]`
			);
			// throw new Error(`Invalid token ${String.fromCharCode(char)} at ${index}`);
		}

		skipWhitespace();
	}

	return root;
}

const floatKeys = [
	'Axis', 'XY', 'Zone', 'WordSpacing', 'FirstLineIndent', 'GlyphSpacing', 'StartIndent', 'EndIndent', 'SpaceBefore',
	'SpaceAfter', 'LetterSpacing', 'Values', 'GridSize', 'GridLeading', 'PointBase', 'BoxBounds', 'TransformPoint0', 'TransformPoint1',
	'TransformPoint2', 'FontSize', 'Leading', 'HorizontalScale', 'VerticalScale', 'BaselineShift', 'Tsume',
	'OutlineWidth', 'AutoLeading',
];

const intArrays = ['RunLengthArray'];

// TODO: handle /nil
export function serializeEngineData(data: any, condensed = false) {
	let buffer = new Uint8Array(1024);
	let offset = 0;
	let indent = 0;

	function write(value: number) {
		if (offset >= buffer.length) {
			const newBuffer = new Uint8Array(buffer.length * 2);
			newBuffer.set(buffer);
			buffer = newBuffer;
		}

		buffer[offset] = value;
		offset++;
	}

	function writeString(value: string) {
		for (let i = 0; i < value.length; i++) {
			write(value.charCodeAt(i));
		}
	}

	function writeIndent() {
		if (condensed) {
			writeString(' ');
		} else {
			for (let i = 0; i < indent; i++) {
				writeString('\t');
			}
		}
	}

	function writeProperty(key: string, value: any) {
		writeIndent();
		writeString(`/${key}`);
		writeValue(value, key, true);
		if (!condensed) writeString('\n');
	}

	function serializeInt(value: number) {
		return value.toString();
	}

	function serializeFloat(value: number) {
		return value.toFixed(5)
			.replace(/(\d)0+$/g, '$1')
			.replace(/^0+\.([1-9])/g, '.$1')
			.replace(/^-0+\.0(\d)/g, '-.0$1');
	}

	function serializeNumber(value: number, key?: string) {
		const isFloat = (key && floatKeys.indexOf(key) !== -1) || (value | 0) !== value;
		return isFloat ? serializeFloat(value) : serializeInt(value);
	}

	function getKeys(value: any) {
		const keys = Object.keys(value);

		if (keys.indexOf('98') !== -1)
			keys.unshift(...keys.splice(keys.indexOf('99'), 1));

		if (keys.indexOf('99') !== -1)
			keys.unshift(...keys.splice(keys.indexOf('99'), 1));

		return keys;
	}

	function writeStringByte(value: number) {
		if (value === 40 || value === 41 || value === 92) { // ( ) \
			write(92); // \
		}

		write(value);
	}

	function writeValue(value: any, key?: string, inProperty = false) {
		function writePrefix() {
			if (inProperty) {
				writeString(' ');
			} else {
				writeIndent();
			}
		}

		if (value === null) {
			writePrefix();
			writeString(condensed ? '/nil' : 'null');
		} else if (typeof value === 'number') {
			writePrefix();
			writeString(serializeNumber(value, key));
		} else if (typeof value === 'boolean') {
			writePrefix();
			writeString(value ? 'true' : 'false');
		} else if (typeof value === 'string') {
			writePrefix();

			if ((key === '99' || key === '98') && value.charAt(0) === '/') {
				writeString(value);
			} else {
				writeString('(');
				write(0xfe);
				write(0xff);

				for (let i = 0; i < value.length; i++) {
					const code = value.charCodeAt(i);
					writeStringByte((code >> 8) & 0xff);
					writeStringByte(code & 0xff);
				}

				writeString(')');
			}
		} else if (Array.isArray(value)) {
			writePrefix();

			if (value.every(x => typeof x === 'number')) {
				writeString('[');

				const intArray = intArrays.indexOf(key!) !== -1;

				for (const x of value) {
					writeString(' ');
					writeString(intArray ? serializeNumber(x) : serializeFloat(x));
				}

				writeString(' ]');
			} else {
				writeString('[');
				if (!condensed) writeString('\n');

				for (const x of value) {
					writeValue(x, key);
					if (!condensed) writeString('\n');
				}

				writeIndent();
				writeString(']');
			}
		} else if (typeof value === 'object') {
			if (inProperty && !condensed) writeString('\n');

			writeIndent();
			writeString('<<');

			if (!condensed) writeString('\n');

			indent++;

			for (const key of getKeys(value)) {
				writeProperty(key, value[key]);
			}

			indent--;
			writeIndent();
			writeString('>>');
		}

		return undefined;
	}

	if (condensed) {
		if (typeof data === 'object') {
			for (const key of getKeys(data)) {
				writeProperty(key, data[key]);
			}
		}
	} else {
		writeString('\n\n');
		writeValue(data);
	}

	return buffer.slice(0, offset);
}
