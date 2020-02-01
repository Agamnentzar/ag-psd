import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32, writeFloat32
} from './psdWriter';

interface Dict { [key: string]: string; }
interface NameClassID { name: string; classID: string; };
interface ExtTypeDict { [key: string]: NameClassID; };

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
	'RrPi': 'Picas',
	'RrIn': 'Inches',
	'RrCm': 'Centimeters',
};

const unitsMapRev = revMap(unitsMap);

const fieldToExtType: ExtTypeDict = {
	printProofSetup: { name: 'Proof Setup', classID: 'proofSetup' },
	Grad: { name: 'Gradient', classID: 'Grdn' },
	ebbl: { name: '', classID: 'ebbl' },
	SoFi: { name: '', classID: 'SoFi' },
	GrFl: { name: '', classID: 'GrFl' },
	sdwC: { name: '', classID: 'RGBC' },
	hglC: { name: '', classID: 'RGBC' },
	'Clr ': { name: '', classID: 'RGBC' },
	Ofst: { name: '', classID: 'Pnt ' },
	ChFX: { name: '', classID: 'ChFX' },
	MpgS: { name: '', classID: 'ShpC' },
	DrSh: { name: '', classID: 'DrSh' },
	IrSh: { name: '', classID: 'IrSh' },
	OrGl: { name: '', classID: 'OrGl' },
	IrGl: { name: '', classID: 'IrGl' },
	TrnS: { name: '', classID: 'ShpC' },
	Ptrn: { name: '', classID: 'Ptrn' },
	FrFX: { name: '', classID: 'FrFX' },
	strokeStyleContent: { name: '', classID: 'solidColorLayer' },
	patternFill: { name: '', classID: 'patternFill' },
	phase: { name: '', classID: 'Pnt ' },
};

const fieldToArrayExtType: ExtTypeDict = {
	'Crv ': { name: '', classID: 'CrPt' },
	'Clrs': { name: '', classID: 'Clrt' },
	'Trns': { name: '', classID: 'TrnS' },
};

const typeToField: { [key: string]: string[]; } = {
	'TEXT': ['Txt ', 'printerName', 'Nm  ', 'Idnt'],
	'tdta': ['EngineData'],
	'long': [
		'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion',
	],
	'enum': [
		'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
		'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'Type', 'glwS', 'GrdF', 'GlwT',
		'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
		'strokeStyleBlendMode', 'PntT', 'Styl',
	],
	'bool': [
		'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss', 'useShape', 'useTexture',
		'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape', 'useTexture', 'Algn', 'Rvrs', 'Dthr',
		'Invr', 'VctC', 'ShTr', 'layerConceals', 'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock',
		'strokeStyleStrokeAdjust',
	],
	'doub': [
		'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Rd  ', 'Grn ', 'Bl  ',
		'strokeStyleMiterLimit', 'strokeStyleResolution',
	],
	'UntF': [
		'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl', 'Ckmt',
		'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset', 'strokeStyleOpacity',
		'Sz  ',
	],
	'VlLs': [
		'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet',
	],
};

const fieldToArrayType: Dict = {
	'Mnm ': 'long',
	'Mxm ': 'long',
	'strokeStyleLineDashSet': 'UntF',
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

for (const field of Object.keys(fieldToArrayExtType)) {
	fieldToArrayType[field] = 'Objc';
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
	// const struct =
	readClassStructure(reader);
	// console.log(struct);
	const itemsCount = readUint32(reader);
	const object: any = {};

	for (let i = 0; i < itemsCount; i++) {
		const key = readAsciiStringOrClassId(reader);
		const type = readSignature(reader);
		// console.log('>', key, type);
		const data = readOSType(reader, type);
		object[key] = data;
	}

	// console.log('//', struct);

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

		let extType = fieldToExtType[key];

		if (key === 'strokeStyleContent') {
			if (value[key]['Clr ']) {
				extType = { name: '', classID: 'solidColorLayer' };
			} else if (value[key].Grad) {
				extType = { name: '', classID: 'gradientLayer' };
			} else if (value[key].Ptrn) {
				extType = { name: '', classID: 'patternLayer' };
			} else {
				console.log('Invalid strokeStyleContent value', value[key]);
			}
		}

		writeOSType(writer, type || 'long', value[key], key, extType);
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
				// console.log('  >', type);
				items.push(readOSType(reader, type));

				// if (typeof items[items.length - 1] === 'object' && 'units' in items[items.length - 1])
				// 	console.log('[]', items[items.length - 1]);
			}

			return items;
		}
		case 'doub': // Double
			return readFloat64(reader);
		case 'UntF': { // Unit double
			const units = readSignature(reader);
			const value = readFloat64(reader);
			if (!unitsMap[units]) throw new Error(`Invalid units: ${units}`);
			return { units: unitsMap[units], value };
		}
		case 'UnFl': { // Unit float
			const units = readSignature(reader);
			const value = readFloat32(reader);
			if (!unitsMap[units]) throw new Error(`Invalid units: ${units}`);
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

function writeOSType(writer: PsdWriter, type: string, value: any, key: string, extType?: NameClassID) {
	switch (type) {
		// case 'obj ': // Reference
		// 	writeReferenceStructure(reader);
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			if (!extType) throw new Error(`Missing ext type for: ${key} (${JSON.stringify(value)})`);
			writeDescriptorStructure(writer, extType.name, extType.classID, value);
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
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units}`);
			writeSignature(writer, unitsMapRev[value.units]);
			writeFloat64(writer, value.value);
			break;
		case 'UnFl': // Unit float
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units}`);
			writeSignature(writer, unitsMapRev[value.units]);
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

export function readVersionAndDescriptor(reader: PsdReader) {
	const version = readUint32(reader);
	if (version !== 16) throw new Error('Invalid descriptor version');
	return readDescriptorStructure(reader);
}

export function writeVersionAndDescriptor(writer: PsdWriter, name: string, classID: string, descriptor: any) {
	writeUint32(writer, 16); // version
	writeDescriptorStructure(writer, name, classID, descriptor);
}
