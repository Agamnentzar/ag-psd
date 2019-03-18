export function parseEngineData(data: number[] | Uint8Array) {
	const openBracket = '('.charCodeAt(0);
	const closeBracket = ')'.charCodeAt(0);
	let text = '';

	for (let i = 0; i < data.length; i++) {
		if (i < data.length - 3 && data[i] === openBracket && data[i + 1] === 0xfe && data[i + 2] === 0xff) {
			text += String.fromCharCode(data[i]);

			for (i += 3; i < (data.length - 1) && data[i] !== closeBracket; i += 2) {
				text += String.fromCharCode((data[i] << 8) | data[i + 1]);
			}

			i--;
		} else {
			text += String.fromCharCode(data[i]);
		}
	}

	const nodeStack: any[] = [];
	const propertyStack: (string | undefined)[] = [];

	let node: any = undefined;
	let property: string | undefined;

	function updateNode(propertyValue: string, nodeValue: any) {
		if (Array.isArray(nodeValue)) {
			nodeValue.push(node);
		} else if (nodeValue) {
			nodeValue[propertyValue!] = node;
		}
	}

	let index = 0;

	function isWhitespace(char: string) {
		return char === ' ' || char === '\n' || char === '\r' || char === '\t';
	}

	function skipWhitespace() {
		while (index < text.length && isWhitespace(text.charAt(index))) {
			index++;
		}
	}

	function getToken() {
		const char = text.charAt(index);

		if (char === '<' && text.charAt(index + 1) === '<') {
			index += 2;
			return '<<';
		} else if (char === '>' && text.charAt(index + 1) === '>') {
			index += 2;
			return '>>';
		} else if (char === '/' || char === '(' || char === '[' || char === ']') {
			index += 1;
			return char;
		} else if (char === 't' && text.substr(index, 4) === 'true') {
			index += 4;
			return 'true';
		} else if (char === 'f' && text.substr(index, 5) === 'false') {
			index += 5;
			return 'false';
		} else if (/[0-9.-]/.test(char)) {
			return '0';
		} else {
			index += 1;
			return `invalid token "${char}" at ${index} around "${text.substring(index - 10, index + 10)}"`;
		}
	}

	function getName() {
		const start = index;

		while (index < text.length && !isWhitespace(text.charAt(index))) {
			index++;
		}

		return text.substring(start, index);
	}

	function getText() {
		const start = index;

		while (index < text.length && text.charAt(index) !== ')') {
			if (text.charAt(index) === '\\') {
				index++;
			}

			index++;
		}

		index++;

		return text.substring(start, index - 1);
	}

	function getNumber() {
		const start = index;

		while (index < text.length && /[0-9.-]/.test(text.charAt(index))) {
			index++;
		}

		return parseFloat(text.substring(start, index));
	}

	function addValue(value: any) {
		if (Array.isArray(node)) {
			node.push(value);
		} else if (node) {
			node[property!] = value;
		}
	}

	skipWhitespace();

	while (index < text.length) {
		const token = getToken();

		switch (token) {
			case '<<': {
				nodeStack.push(node);
				propertyStack.push(property);
				node = {};
				property = undefined;
				break;
			}
			case '>>': {
				const nodeValue = nodeStack.pop();
				const propertyValue = propertyStack.pop();

				if (nodeValue) {
					updateNode(propertyValue!, nodeValue);
					node = nodeValue;
				}
				break;
			}
			case '/': {
				property = getName();
				break;
			}
			case '(': {
				const text = getText();
				addValue(text);
				break;
			}
			case '[': {
				nodeStack.push(node);
				propertyStack.push(property);
				node = [];
				property = undefined;
				break;
			}
			case ']': {
				const nodeValue = nodeStack.pop();
				const propertyValue = propertyStack.pop();
				updateNode(propertyValue!, nodeValue);
				node = nodeValue;
				break;
			}
			case '0': {
				addValue(getNumber());
				break;
			}
			case 'true':
			case 'false': {
				addValue(token === 'true');
				break;
			}
			default:
				console.log('# unhandled token', token);
		}

		skipWhitespace();
	}

	// console.log(JSON.stringify(node, null, 2)); // .substr(0, 1000));
	// require('fs').writeFileSync('engineData.json', JSON.stringify(node, null, 2), 'utf8');

	return node;
}

export function serializeEngineData(data: any) {
	let indent = '';
	let lines: string[] = ['', ''];

	function serializeProperty(key: string, value: any) {
		const index = lines.length;
		lines.push(`${indent}/${key}`);
		const serialized = serializeValue(value);

		if (serialized) {
			lines[index] += ' ' + serialized;
		}
	}

	function serializeNumber(value: number) {
		if ((value | 0) === value) {
			return value.toString();
		} else {
			return value.toFixed(3).replace(/(\d)0+$/g, '$1');
		}
	}

	function serializeValue(value: any) {
		if (typeof value === 'number') {
			return serializeNumber(value);
		} else if (typeof value === 'boolean') {
			return value ? 'true' : 'false';
		} else if (typeof value === 'string') {
			let encoded = '\u00fe\u00ff';

			for (let i = 0; i < value.length; i++) {
				const charCode = value.charCodeAt(i);
				encoded += `${String.fromCharCode(charCode >> 8)}${String.fromCharCode(charCode & 0xff)}`;
			}

			return `(${encoded})`;
		} else if (Array.isArray(value)) {
			if (value.every(x => typeof x === 'number')) {
				return `[ ${value.map(serializeNumber).join(' ')} ]`;
			} else {
				const temp = indent;
				indent = indent + '\t';

				for (let i = 0; i < value.length; i++) {
					const serialized = serializeValue(value[i]);

					if (serialized) {
						lines.push(`${indent}${serialized}`);
					}
				}

				indent = temp;
				lines.push(`${indent}]`);
				return '[';
			}
		} else if (typeof value === 'object') {
			lines.push(`${indent}<<`);
			const temp = indent;
			indent = indent + '\t';

			for (const key of Object.keys(value)) {
				serializeProperty(key, value[key]);
			}

			indent = temp;
			lines.push(`${indent}>>`);
		}

		return undefined;
	}

	serializeValue(data);

	const buffer = new Uint8Array(lines.reduce((sum, line) => sum + line.length + 1, 0) - 1);
	let offset = 0;

	for (const line of lines) {
		for (let i = 0; i < line.length; i++ , offset++) {
			buffer[offset] = line.charCodeAt(i);
		}

		buffer[offset] = '\n'.charCodeAt(0);
		offset++;
	}

	// console.log('serialized:\n', lines.join('\n'));

	return buffer;
}
