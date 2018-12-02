export function parseEngineData(data: number[]) {
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

	const lines = text.split(/\n/g);
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

	type Instruction = { regex: RegExp; parse: (match: RegExpMatchArray) => void; };

	const instructions: Instruction[] = [
		{ // HashStart
			regex: /^<<$/,
			parse() {
				nodeStack.push(node);
				propertyStack.push(property);
				node = {};
				property = undefined;
			}
		},
		{ // HashEnd
			regex: /^>>$/,
			parse() {
				const nodeValue = nodeStack.pop();
				const propertyValue = propertyStack.pop();

				if (nodeValue) {
					updateNode(propertyValue!, nodeValue);
					node = nodeValue;
				}
			},
		},
		{ // SingleLineArray
			regex: /^\[(.*)\]$/,
			parse(match) {
				const trimmed = match[1].trim();
				return trimmed ? trimmed.split(/ /g).map(parseTokens) : [];
			}
		},
		{ // MultiLineArrayStart,
			regex: /^\/(\w+) \[$/,
			parse(match) {
				nodeStack.push(node);
				propertyStack.push(match[1]);
				node = [];
				property = undefined;
			}
		},
		{ // MultiLineArrayEnd,
			regex: /^\]$/,
			parse() {
				const nodeValue = nodeStack.pop();
				const propertyValue = propertyStack.pop();
				updateNode(propertyValue!, nodeValue);
				node = nodeValue;
			}
		},
		{ // Property
			regex: /^\/([A-Z0-9]+)$/i,
			parse(match) {
				property = match[1];
			}
		},
		{ // PropertyWithData,
			regex: /^\/([A-Z0-9]+) ([^]*)$/i,
			parse(match) {
				property = match[1];
				const data = parseTokens(match[2]);

				if (Array.isArray(node)) {
					node.push(data);
				} else if (node) {
					node[property] = data;
				}

				return data;
			}
		},
		{ // String
			regex: /^\(([^]*)\)$/m,
			parse(match) {
				return match[1]; // .trim();
			}
		},
		{ // NumberWithDecimal
			regex: /^(-?\d*\.\d+)$/,
			parse(match) {
				return parseFloat(match[1]);
			}
		},
		{ // Number
			regex: /^(-?\d+)$/,
			parse(match) {
				return parseInt(match[1], 10);
			}
		},
		{ // Boolean
			regex: /^(true|false)$/,
			parse(match) {
				return match[1] === 'true';
			}
		},
		{ // Noop
			regex: /^$/,
			parse() {
			}
		},
	];

	for (const line of lines) {
		const cleaned = line.replace(/\t/g, '').trim();
		parseTokens(cleaned);
	}

	function parseTokens(line: string) {
		for (const { regex, parse } of instructions) {
			const match = regex.exec(line);

			if (match) {
				return parse(match);
			}
		}

		throw new Error(`Unparsed engine data line: ${line}`);
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
