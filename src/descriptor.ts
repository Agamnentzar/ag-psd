import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32, writeFloat32
} from './psdWriter';

interface Dict {
	[key: string]: string;
}

function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

const unitsMap: Dict = {
	'#Ang': 'Angle',
	'#Rsl': 'Density',
	'#Rlt': 'Distance',
	'#Nne': 'None',
	'#Prc': 'Percent',
	'#Pxl': 'Pixels',
	'#Mlm': 'Millimeters',
	'#Pnt': 'Points',
};

const unitsMapRev = revMap(unitsMap);

type ExtTypeDict = { [key: string]: { name: string; classId: string; }; };

const fieldToExtType: ExtTypeDict = {
	printProofSetup: { name: 'Proof Setup', classId: 'proofSetup' },
	Grad: { name: 'Gradient', classId: 'Grdn' },
	ebbl: { name: '', classId: 'ebbl' },
	SoFi: { name: '', classId: 'SoFi' },
	GrFl: { name: '', classId: 'GrFl' },
	sdwC: { name: '', classId: 'RGBC' },
	hglC: { name: '', classId: 'RGBC' },
	'Clr ': { name: '', classId: 'RGBC' },
	Ofst: { name: '', classId: 'Pnt ' },
	ChFX: { name: '', classId: 'ChFX' },
	MpgS: { name: '', classId: 'ShpC' },
	DrSh: { name: '', classId: 'DrSh' },
	IrSh: { name: '', classId: 'IrSh' },
	OrGl: { name: '', classId: 'OrGl' },
	IrGl: { name: '', classId: 'IrGl' },
	TrnS: { name: '', classId: 'ShpC' },
};

const fieldToArrayExtType: ExtTypeDict = {
	'Crv ': { name: '', classId: 'CrPt' },
	'Clrs': { name: '', classId: 'Clrt' },
	'Trns': { name: '', classId: 'TrnS' },
};

const typeToField: { [key: string]: string[]; } = {
	'TEXT': ['Txt ', 'printerName', 'Nm  '],
	'tdta': ['EngineData'],
	'long': [
		'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn',
	],
	'enum': [
		'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
		'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'Type', 'glwS', 'GrdF', 'GlwT',
	],
	'bool': [
		'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss', 'useShape', 'useTexture',
		'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape', 'useTexture', 'Algn', 'Rvrs', 'Dthr',
		'Invr', 'VctC', 'ShTr', 'layerConceals',
	],
	'doub': [
		'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Rd  ', 'Grn ', 'Bl  ',
	],
	'UntF': [
		'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl', 'Ckmt',
		'Nose', 'Inpr', 'ShdN',
	],
	'VlLs': ['Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns'],
};

// special handling for: 'AntA', 'Hrzn', 'Vrtc'

const fieldToArrayType: Dict = {
	'Crv ': 'Objc',
	'Clrs': 'Objc',
	'Trns': 'Objc',
	'Mnm ': 'long',
	'Mxm ': 'long',
};

const fieldToType: Dict = {};

for (const type of Object.keys(typeToField)) {
	for (const field of typeToField[type]) {
		fieldToType[field] = type;
	}
}

for (const field of Object.keys(fieldToExtType)) {
	fieldToType[field] = 'Objc';
}

function getTypeByKey(key: string, value: any) {
	if (key === 'AntA') {
		return typeof value === 'string' ? 'enum' : 'bool';
	} else if (key === 'Hrzn' || key === 'Vrtc') {
		return typeof value === 'number' ? 'doub' : 'UntF';
	} else {
		return fieldToType[key];
	}
}

export function readAsciiStringOrClassId(reader: PsdReader) {
	const length = readInt32(reader);
	const result = length === 0 ? readSignature(reader) : readAsciiString(reader, length);
	return result;
}

function writeAsciiStringOrClassId(writer: PsdWriter, value: string) {
	if (value.length === 4) {
		// write classId
		writeInt32(writer, 0);
		writeSignature(writer, value);
	} else {
		// write ascii string
		writeInt32(writer, value.length);

		for (let i = 0; i < value.length; i++) {
			writeUint8(writer, value.charCodeAt(i));
		}
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
		object[key] = data;
	}

	return object;
}

export function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any) {
	if (!classId) console.log('Missing classId for: ', name, classId, value);

	// write class structure
	writeUnicodeStringWithPadding(writer, name);
	writeAsciiStringOrClassId(writer, classId);

	const keys = Object.keys(value);
	writeUint32(writer, keys.length);

	for (const key of keys) {
		const type = getTypeByKey(key, value[key]);
		writeAsciiStringOrClassId(writer, key);
		writeSignature(writer, type || 'long');
		writeOSType(writer, type || 'long', value[key], key, fieldToExtType[key]);
		if (!type) console.log(`Missing descriptor field type for: '${key}' in`, value);
	}
}

function readOSType(reader: PsdReader, type: string) {
	switch (type) {
		case 'obj ': // Reference
			return readReferenceStructure(reader);
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			return readDescriptorStructure(reader);
		case 'VlLs': { // List
			const length = readInt32(reader);
			const items: any[] = [];

			for (let i = 0; i < length; i++) {
				const type = readSignature(reader);
				items.push(readOSType(reader, type));
			}

			return items;
		}
		case 'doub': // Double
			return readFloat64(reader);
		case 'UntF': { // Unit double
			const units = readSignature(reader);
			const value = readFloat64(reader);
			return { units: unitsMap[units], value };
		}
		case 'UnFl': { // Unit float
			const units = readSignature(reader);
			const value = readFloat32(reader);
			return { units: unitsMap[units], value };
		}
		case 'TEXT': // String
			return readUnicodeString(reader);
		case 'enum': { // Enumerated
			const type = readAsciiStringOrClassId(reader);
			const value = readAsciiStringOrClassId(reader);
			return `${type}.${value}`;
		}
		case 'long': // Integer
			return readInt32(reader);
		case 'comp': { // Large Integer
			const low = readUint32(reader);
			const high = readUint32(reader);
			return { low, high };
		}
		case 'bool': // Boolean
			return !!readUint8(reader);
		case 'type': // Class
		case 'GlbC': // Class
			return readClassStructure(reader);
		case 'alis': { // Alias
			const length = readInt32(reader);
			return readAsciiString(reader, length);
		}
		case 'tdta': { // Raw Data
			const length = readInt32(reader);
			return readBytes(reader, length);
		}
		case 'ObAr': // Object array
			throw new Error('not implemented: ObAr');
		case 'Pth ': { // File path
			/*const length =*/ readInt32(reader);
			const sig = readSignature(reader);
			/*const pathSize =*/ readInt32LE(reader);
			const charsCount = readInt32LE(reader);
			const path = readUnicodeStringWithLength(reader, charsCount);
			return { sig, path };
		}
		default:
			throw new Error(`Invalid TySh descriptor OSType: ${type} at ${reader.offset.toString(16)}`);
	}
}

function writeOSType(writer: PsdWriter, type: string, value: any, key: string, extType?: { name: string; classId: string; }) {
	switch (type) {
		// case 'obj ': // Reference
		// 	writeReferenceStructure(reader);
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			if (!extType) throw new Error(`Missing ext type for: ${key} (${JSON.stringify(value)})`);
			writeDescriptorStructure(writer, extType.name, extType.classId, value);
			break;
		case 'VlLs': // List
			writeInt32(writer, value.length);

			for (let i = 0; i < value.length; i++) {
				const type = fieldToArrayType[key];
				writeSignature(writer, type || 'long');
				writeOSType(writer, type || 'long', value[i], '', fieldToArrayExtType[key]);
				if (!type) console.log(`Missing descriptor array type for: '${key}' in`, value);
			}
			break;
		case 'doub': // Double
			writeFloat64(writer, value);
			break;
		case 'UntF': // Unit double
			writeSignature(writer, unitsMapRev[value.units] || '#Nne');
			writeFloat64(writer, value.value);
			break;
		case 'UnFl': // Unit float
			writeSignature(writer, unitsMapRev[value.units] || '#Nne');
			writeFloat32(writer, value.value);
			break;
		case 'TEXT': // String
			writeUnicodeStringWithPadding(writer, value);
			break;
		case 'enum': { // Enumerated
			const [type, val] = value.split('.');
			writeAsciiStringOrClassId(writer, type);
			writeAsciiStringOrClassId(writer, val);
			break;
		}
		case 'long': // Integer
			writeInt32(writer, value);
			break;
		// case 'comp': // Large Integer
		// 	writeLargeInteger(reader);
		case 'bool': // Boolean
			writeUint8(writer, value ? 1 : 0);
			break;
		// case 'type': // Class
		// case 'GlbC': // Class
		// 	writeClassStructure(reader);
		// case 'alis': // Alias
		// 	writeAliasStructure(reader);
		case 'tdta': // Raw Data
			writeInt32(writer, value.byteLength);
			writeBytes(writer, value);
			break;
		// case 'ObAr': // Object array
		// 	throw new Error('not implemented: ObAr');
		// case 'Pth ': // File path
		// 	writeFilePath(reader);
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
			case 'prop': { // Property
				const { name, classID } = readClassStructure(reader);
				const keyID = readAsciiStringOrClassId(reader);
				items.push({ name, classID, keyID });
				break;
			}
			case 'Clss': // Class
				items.push(readClassStructure(reader));
				break;
			case 'Enmr': { // Enumerated Reference
				const { name, classID } = readClassStructure(reader);
				const TypeID = readAsciiStringOrClassId(reader);
				const value = readAsciiStringOrClassId(reader);
				items.push({ name, classID, TypeID, value });
				break;
			}
			case 'rele': { // Offset
				const { name, classID } = readClassStructure(reader);
				const value = readUint32(reader);
				items.push({ name, classID, value });
				break;
			}
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

function readClassStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	return { name, classID };
}
