export function parseEngineData(data: number[] | Uint8Array) {
	let index = 0;

	function isWhitespace(char: number) {
		// ' ', '\n', '\r', '\t'
		return char === 32 || char === 10 || char === 13 || char === 9;
	}

	function isNumber(char: number) {
		// 0123456789.-
		return (char >= 48 && char <= 57) || char == 46 || char == 45;
	}

	function skipWhitespace() {
		while (index < data.length && isWhitespace(data[index])) {
			index++;
		}
	}

	function getToken() {
		const i = index;
		const char = data[i];

		if (char === 60 && data[i + 1] === 60) { // <<
			index += 2;
			return '<<';
		} else if (char === 62 && data[i + 1] === 62) { // >>
			index += 2;
			return '>>';
		} else if (char === 47 || char === 40 || char === 91 || char === 93) { // / ( [ ]
			index += 1;
			return String.fromCharCode(char);
		} else if (char === 110 && data[i + 1] == 117 && data[i + 2] == 108 && data[i + 3] == 108) { // null
			index += 4;
			return 'null';
		} else if (char === 116 && data[i + 1] == 114 && data[i + 2] == 117 && data[i + 3] == 101) { // true
			index += 4;
			return 'true';
		} else if (char === 102 && data[i + 1] == 97 && data[i + 2] == 108 && data[i + 3] == 115 && data[i + 4] == 101) { // false
			index += 5;
			return 'false';
		} else if (isNumber(char)) {
			return '0';
		} else {
			index += 1;
			return `invalid token ${String.fromCharCode(char)} at ${index}`/* +
				` near ${String.fromCharCode.apply(null, data.slice(index - 10, index + 20) as any)}` +
				`data [${Array.from(data.slice(index - 10, index + 20)).join(', ')}]`*/;
		}
	}

	function getName() {
		const start = index;

		while (index < data.length && !isWhitespace(data[index])) {
			index++;
		}

		// TODO: proper decode
		return String.fromCharCode.apply(null, data.slice(start, index) as any); // text.substring(start, index);
	}

	function getText() {
		let result = '';

		if (data[index] == 41) { // )
			index++;
			return result;
		}

		// Strings start with utf-16 BOM
		if (data[index] != 0xFE || data[index + 1] != 0xFF) {
			throw new Error('Invalid utf-16 BOM');
		}

		index += 2;
		const begin = index;

		while (index < data.length && data[index] !== 41) { // )
			const high = data[index];
			let char = data[index + 1];

			// utf-16be encoded strings have escaped closing parentheses:
			//       FE FF 00 \ ) 00 ] 00 { ...
			// which breaks encoding by shifting it by 1 byte.

			// Sometimes they also have space before escape character instead of 00 high byte:
			//       FE FF 32 \ ) 00 ] 00 { ...

			if (index === begin && high == 32 && char === 92) { // " \"
				result += ' ';
			} else {
				char |= high << 8;
			}

			index += 2;

			if (char === 92) { // \
				result += String.fromCharCode(data[index]); // escaped characters are single byte
				index++;
			} else {
				result += String.fromCharCode(char);
			}
		}

		index++;
		return result;
	}

	function getNumber() {
		let value = '';

		while (index < data.length && isNumber(data[index])) {
			value += String.fromCharCode(data[index]);
			index++;
		}

		return parseFloat(value);
	}

	skipWhitespace();

	let root: any = null;
	const stack: any[] = [];

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

	function pushContainer(value: any) {
		if (!stack.length) {
			stack.push(value);
			root = value;
		} else {
			pushValue(value);
			stack.push(value);
		}
	}

	function pushProperty(name: string) {
		if (!stack.length) pushContainer({});

		const top = stack[stack.length - 1];

		if (top && typeof top === 'string') {
			pushValue(`/${name}`);
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

	while (index < data.length) {
		const token = getToken();

		switch (token) {
			case '<<': pushContainer({}); break;
			case '>>': pop(); break;
			case '/': pushProperty(getName()); break;
			case '(': pushValue(getText()); break;
			case '[': pushContainer([]); break;
			case ']': pop(); break;
			case '0': pushValue(getNumber()); break;
			case 'null': pushValue(null); break;
			case 'true': pushValue(true); break;
			case 'false': pushValue(false); break;
			default: console.log('unhandled token', token);
		}

		skipWhitespace();
	}

	return root;
}

const floatKeys = [
	'Axis', 'XY', 'Zone', 'WordSpacing', 'FirstLineIndent', 'GlyphSpacing', 'StartIndent', 'EndIndent', 'SpaceBefore',
	'SpaceAfter', 'LetterSpacing', 'Values', 'GridSize', 'GridLeading', 'PointBase', 'TransformPoint0', 'TransformPoint1',
	'TransformPoint2', 'FontSize', 'Leading', 'HorizontalScale', 'VerticalScale', 'BaselineShift', 'Tsume',
	'OutlineWidth',
];

// TODO: noWhitespace option
// TODO: write without root object
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
		return value.toFixed(3).replace(/(\d)0+$/g, '$1').replace(/^0+\.([1-9])/g, '.$1');
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

	function writeValue(value: any, key?: string, inProperty = false) {
		function writePrefix() {
			if (inProperty) {
				writeString(' ');
			} else {
				writeIndent();
			}
		}

		if (typeof value === null) {
			writePrefix();
			writeString('null');
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

					if (code === 40 || code === 41) { // ( )
						write(0);
						write(92); // \
						write(code);
					} else {
						write((code >> 8) & 0xff);
						write(code & 0xff);
					}
				}

				writeString(')');
			}
		} else if (Array.isArray(value)) {
			writePrefix();

			if (value.every(x => typeof x === 'number')) {
				writeString('[');

				for (const x of value) {
					writeString(' ');
					writeString(serializeNumber(x, key));
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
