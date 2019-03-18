import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32
} from './psdWriter';

function readAsciiStringOrClassId(reader: PsdReader) {
	const length = readInt32(reader);
	const result = length === 0 ? readSignature(reader) : readAsciiString(reader, length);
	return result;
}

function writeAsciiString(writer: PsdWriter, value: string) {
	writeInt32(writer, value.length);

	for (let i = 0; i < value.length; i++) {
		writeUint8(writer, value.charCodeAt(i));
	}
}

function writeClassId(writer: PsdWriter, value: string) {
	writeInt32(writer, 0);
	writeSignature(writer, value);
}

function writeAsciiStringOrClassId(writer: PsdWriter, value: string) {
	if (value.length === 4) {
		writeClassId(writer, value);
	} else {
		writeAsciiString(writer, value);
	}
}

export function readDescriptorStructure(reader: PsdReader) {
	readClassStructure(reader);
	const itemsCount = readUint32(reader);
	const object: any = {};

	for (let i = 0; i < itemsCount; i++) {
		const key = readAsciiStringOrClassId(reader);
		const type = readSignature(reader);
		const data = readOSType(reader, type);
		// console.log('>', `"${key}"`, type);
		object[key] = data;
	}

	return object;
}

const fieldToType: { [key: string]: string; } = {
	'Txt ': 'TEXT',
	textGridding: 'enum',
	Ornt: 'enum',
	AntA: 'enum',
	TextIndex: 'long',
	warpStyle: 'enum',
	warpValue: 'doub',
	warpPerspective: 'doub',
	warpPerspectiveOther: 'doub',
	warpRotate: 'enum',
	EngineData: 'tdta',
	PstS: 'bool',
	Inte: 'enum',
	printSixteenBit: 'bool',
	printerName: 'TEXT',
	printProofSetup: 'Objc',
	Bltn: 'enum',
};

const fieldToExtType: { [key: string]: { name: string; classId: string; }; } = {
	printProofSetup: { name: 'Proof Setup', classId: 'proofSetup' },
};

export function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any) {
	writeClassStructure(writer, name, classId);

	const keys = Object.keys(value);

	writeUint32(writer, keys.length);

	for (const key of keys) {
		const type = fieldToType[key];

		writeAsciiStringOrClassId(writer, key);
		writeSignature(writer, type || 'long');
		writeOSType(writer, type || 'long', value[key], fieldToExtType[key]);

		if (!type) {
			console.log('missing descriptor field type for', key);
		}
	}
}

function readOSType(reader: PsdReader, type: string) {
	switch (type) {
		case 'obj ': // Reference
			return readReferenceStructure(reader);
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			return readDescriptorStructure(reader);
		case 'VlLs': // List
			return readListStructure(reader);
		case 'doub': // Double
			return readFloat64(reader);
		case 'UntF': // Unit double
			return readUnitDoubleStructure(reader);
		case 'UnFl': // Unit float
			return readUnitFloatStructure(reader);
		case 'TEXT': // String
			return readUnicodeString(reader);
		case 'enum': // Enumerated
			return readEnumerated(reader);
		case 'long': // Integer
			return readInt32(reader);
		case 'comp': // Large Integer
			return readLargeInteger(reader);
		case 'bool': // Boolean
			return !!readUint8(reader);
		case 'type': // Class
		case 'GlbC': // Class
			return readClassStructure(reader);
		case 'alis': // Alias
			return readAliasStructure(reader);
		case 'tdta': // Raw Data
			return readRawData(reader);
		case 'ObAr': // Object array
			throw new Error('not implemented: ObAr');
		case 'Pth ': // File path
			return readFilePath(reader);
		default:
			throw new Error(`Invalid TySh descriptor OSType: ${type} at ${reader.offset.toString(16)}`);
	}
}

function writeOSType(writer: PsdWriter, type: string, value: any, extType?: { name: string; classId: string; }) {
	switch (type) {
		// case 'obj ': // Reference
		// 	return readReferenceStructure(reader);
		case 'Objc': // Descriptor
			// case 'GlbO': // GlobalObject same as Descriptor
			writeDescriptorStructure(writer, extType!.name, extType!.classId, value);
			break;
		// case 'VlLs': // List
		// 	return readListStructure(reader);
		case 'doub': // Double
			writeFloat64(writer, value);
			break;
		// case 'UntF': // Unit double
		// 	return readUnitDoubleStructure(reader);
		// case 'UnFl': // Unit float
		// 	return readUnitFloatStructure(reader);
		case 'TEXT': // String
			writeUnicodeStringWithPadding(writer, value);
			break;
		case 'enum': // Enumerated
			writeEnumerated(writer, value);
			break;
		case 'long': // Integer
			writeInt32(writer, value);
			break;
		// case 'comp': // Large Integer
		// 	return readLargeInteger(reader);
		case 'bool': // Boolean
			writeUint8(writer, value ? 1 : 0);
			break;
		// case 'type': // Class
		// case 'GlbC': // Class
		// 	return readClassStructure(reader);
		// case 'alis': // Alias
		// 	return readAliasStructure(reader);
		case 'tdta': // Raw Data
			writeRawData(writer, value);
			break;
		// case 'ObAr': // Object array
		// 	throw new Error('not implemented: ObAr');
		// case 'Pth ': // File path
		// 	return readFilePath(reader);
		default:
			throw new Error(`Not implemented TySh descriptor OSType: ${type}`);
	}
}

function readReferenceStructure(reader: PsdReader) {
	const itemsCount = readInt32(reader);
	const items: any[] = [];

	for (let i = 0; i < itemsCount; i++) {
		const type = readSignature(reader);

		switch (type) {
			case 'prop': // Property
				items.push(readPropertyStructure(reader));
				break;
			case 'Clss': // Class
				items.push(readClassStructure(reader));
				break;
			case 'Enmr': // Enumerated Reference
				items.push(readEnumeratedReference(reader));
				break;
			case 'rele': // Offset
				items.push(readOffsetStructure(reader));
				break;
			case 'Idnt': // Identifier
				items.push(readInt32(reader));
				break;
			case 'indx': // Index
				items.push(readInt32(reader));
				break;
			case 'name': // Name
				items.push(readUnicodeString(reader));
				break;
			default:
				throw new Error(`Invalid TySh descriptor Reference type: ${type}`);
		}
	}

	return items;
}

function readPropertyStructure(reader: PsdReader) {
	const { name, classID } = readClassStructure(reader);
	const keyID = readAsciiStringOrClassId(reader);
	return { name, classID, keyID };
}

const unitsMap: { [key: string]: string; } = {
	'#Ang': 'Angle',
	'#Rsl': 'Density',
	'#Rlt': 'Distance',
	'#Nne': 'None',
	'#Prc': 'Percent',
	'#Pxl': 'Pixels',
	'#Mlm': 'Millimeters',
	'#Pnt': 'Points',
};

function readUnitDoubleStructure(reader: PsdReader) {
	const units = readSignature(reader);
	const value = readFloat64(reader);
	return { units: unitsMap[units], value };
}

function readUnitFloatStructure(reader: PsdReader) {
	const units = readSignature(reader);
	const value = readFloat32(reader);
	return { units: unitsMap[units], value };
}

function readClassStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	return { name, classID };
}

function writeClassStructure(writer: PsdWriter, name: string, classID: string) {
	writeUnicodeStringWithPadding(writer, name);
	writeAsciiStringOrClassId(writer, classID);
}

function readEnumeratedReference(reader: PsdReader) {
	const { name, classID } = readClassStructure(reader);
	const TypeID = readAsciiStringOrClassId(reader);
	const value = readAsciiStringOrClassId(reader);
	return { name, classID, TypeID, value };
}

function readOffsetStructure(reader: PsdReader) {
	const { name, classID } = readClassStructure(reader);
	const value = readUint32(reader);
	return { name, classID, value };
}

function readAliasStructure(reader: PsdReader) {
	const length = readInt32(reader);
	return readAsciiString(reader, length);
}

function readListStructure(reader: PsdReader) {
	const length = readInt32(reader);
	const type = readSignature(reader);
	const items: any[] = [];

	for (let i = 0; i < length; i++) {
		items.push(readOSType(reader, type));
	}

	return items;
}

function readLargeInteger(reader: PsdReader) {
	const low = readUint32(reader);
	const high = readUint32(reader);
	return { low, high };
}

function readEnumerated(reader: PsdReader) {
	const type = readAsciiStringOrClassId(reader);
	const value = readAsciiStringOrClassId(reader);
	return `${type}.${value}`;
}

function writeEnumerated(writer: PsdWriter, full: string) {
	const [type, value] = full.split('.');
	writeAsciiStringOrClassId(writer, type);
	writeAsciiStringOrClassId(writer, value);
}

function readRawData(reader: PsdReader) {
	const length = readInt32(reader);
	return readBytes(reader, length);
}

function writeRawData(writer: PsdWriter, value: Uint8Array) {
	writeInt32(writer, value.byteLength);
	writeBytes(writer, value);
}

function readFilePath(reader: PsdReader) {
	const length = readInt32(reader);
	const sig = readSignature(reader);
	const pathSize = readInt32LE(reader);
	const charsCount = readInt32LE(reader);
	const path = readUnicodeStringWithLength(reader, charsCount);

	length;
	pathSize;

	return { sig, path };
}
