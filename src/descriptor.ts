import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32, writeFloat32
} from './psdWriter';

interface Dict { [key: string]: string; }
interface NameClassID { name: string; classID: string; }
interface ExtTypeDict { [key: string]: NameClassID; }

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
let logErrors = false;

export function setLogErrors(value: boolean) {
	logErrors = value;
}

function makeType(name: string, classID: string) {
	return { name, classID };
}

const fieldToExtType: ExtTypeDict = {
	strokeStyleContent: makeType('', 'solidColorLayer'),
	printProofSetup: makeType('Proof Setup', 'proofSetup'),
	patternFill: makeType('', 'patternFill'),
	Grad: makeType('Gradient', 'Grdn'),
	ebbl: makeType('', 'ebbl'),
	SoFi: makeType('', 'SoFi'),
	GrFl: makeType('', 'GrFl'),
	sdwC: makeType('', 'RGBC'),
	hglC: makeType('', 'RGBC'),
	'Clr ': makeType('', 'RGBC'),
	'tintColor': makeType('', 'RGBC'),
	Ofst: makeType('', 'Pnt '),
	ChFX: makeType('', 'ChFX'),
	MpgS: makeType('', 'ShpC'),
	DrSh: makeType('', 'DrSh'),
	IrSh: makeType('', 'IrSh'),
	OrGl: makeType('', 'OrGl'),
	IrGl: makeType('', 'IrGl'),
	TrnS: makeType('', 'ShpC'),
	Ptrn: makeType('', 'Ptrn'),
	FrFX: makeType('', 'FrFX'),
	phase: makeType('', 'Pnt '),
	frameStep: makeType('', 'null'),
	duration: makeType('', 'null'),
	bounds: makeType('', 'Rctn'),
	customEnvelopeWarp: makeType('', 'customEnvelopeWarp'),
	warp: makeType('', 'warp'),
	'Sz  ': makeType('', 'Pnt '),
};

const fieldToArrayExtType: ExtTypeDict = {
	'Crv ': makeType('', 'CrPt'),
	'Clrs': makeType('', 'Clrt'),
	'Trns': makeType('', 'TrnS'),
};

const typeToField: { [key: string]: string[]; } = {
	'TEXT': [
		'Txt ', 'printerName', 'Nm  ', 'Idnt', 'blackAndWhitePresetFileName', 'LUT3DFileName',
		'presetFileName', 'curvesPresetFileName', 'mixerPresetFileName', 'placed',
	],
	'tdta': ['EngineData', 'LUT3DFileData'],
	'long': [
		'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion', 'LaID', 'Vrsn',
		'Brgh', 'Cntr', 'means', 'vibrance', 'Strt', 'bwPresetKind', 'presetKind',
		'curvesPresetKind', 'mixerPresetKind', 'uOrder', 'vOrder', 'PgNm', 'totalPages',
		'numerator', 'denominator', 'frameCount', 'Annt',
	],
	'enum': [
		'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
		'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'glwS', 'GrdF', 'GlwT',
		'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
		'strokeStyleBlendMode', 'PntT', 'Styl', 'lookupType', 'LUTFormat', 'dataOrder',
		'tableOrder',
	],
	'bool': [
		'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss',
		'useShape', 'useTexture', 'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape',
		'useTexture', 'Algn', 'Rvrs', 'Dthr', 'Invr', 'VctC', 'ShTr', 'layerConceals',
		'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock', 'strokeStyleStrokeAdjust',
		'hardProof', 'MpBl', 'paperWhite', 'useLegacy', 'Auto', 'Lab ', 'useTint',
	],
	'doub': [
		'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Wdth', 'Hght',
		'strokeStyleMiterLimit', 'strokeStyleResolution', 'layerTime',
	],
	'UntF': [
		'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl',
		'Ckmt', 'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset',
		'strokeStyleOpacity', 'H   ', 'Top ', 'Left', 'Btom', 'Rght', 'Rslt',
	],
	'VlLs': [
		'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet', 'FrLs',
		'LaSt', 'Trnf', 'nonAffineTransform',
	],
	'ObAr': ['meshPoints'],
};

const channels = [
	'Rd  ', 'Grn ', 'Bl  ', 'Yllw', 'Ylw ', 'Cyn ', 'Mgnt', 'Blck', 'Gry ', 'Lmnc', 'A   ', 'B   ',
];

const fieldToArrayType: Dict = {
	'Mnm ': 'long',
	'Mxm ': 'long',
	'FrLs': 'long',
	'strokeStyleLineDashSet': 'UntF',
	'Trnf': 'doub',
	'nonAffineTransform': 'doub',
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
	if (key === 'Sz  ') {
		return ('Wdth' in value) ? 'Objc' : (('units' in value) ? 'UntF' : 'doub');
	} else if (key === 'Type') {
		return typeof value === 'string' ? 'enum' : 'long';
	} else if (key === 'AntA') {
		return typeof value === 'string' ? 'enum' : 'bool';
	} else if (key === 'Hrzn' || key === 'Vrtc') {
		return typeof value === 'number' ? 'doub' : 'UntF';
	} else {
		return fieldToType[key];
	}
}

export function readAsciiStringOrClassId(reader: PsdReader) {
	const length = readInt32(reader);
	return readAsciiString(reader, length || 4);
}

function writeAsciiStringOrClassId(writer: PsdWriter, value: string) {
	if (value.length === 4 && value !== 'warp') {
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
	const object: any = {};
	// object.__struct =
	readClassStructure(reader);
	const itemsCount = readUint32(reader);

	for (let i = 0; i < itemsCount; i++) {
		const key = readAsciiStringOrClassId(reader);
		const type = readSignature(reader);
		// console.log(`> '${key}' '${type}'`);
		const data = readOSType(reader, type);
		// if (!getTypeByKey(key, data)) console.log(`> '${key}' '${type}'`, data);
		object[key] = data;
	}
	// console.log('//', struct);
	return object;
}

export function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any) {
	if (logErrors && !classId) console.log('Missing classId for: ', name, classId, value);

	// write class structure
	writeUnicodeStringWithPadding(writer, name);
	writeAsciiStringOrClassId(writer, classId);

	const keys = Object.keys(value);
	writeUint32(writer, keys.length);

	for (const key of keys) {
		let type = getTypeByKey(key, value[key]);
		let extType = fieldToExtType[key];

		if (channels.indexOf(key) !== -1) {
			type = classId === 'RGBC' ? 'doub' : 'long';
		} else if (key === 'profile') {
			type = classId === 'printOutput' ? 'TEXT' : 'tdta';
		} else if (key === 'strokeStyleContent') {
			if (value[key]['Clr ']) {
				extType = makeType('', 'solidColorLayer');
			} else if (value[key].Grad) {
				extType = makeType('', 'gradientLayer');
			} else if (value[key].Ptrn) {
				extType = makeType('', 'patternLayer');
			} else {
				logErrors && console.log('Invalid strokeStyleContent value', value[key]);
			}
		}

		writeAsciiStringOrClassId(writer, key);
		writeSignature(writer, type || 'long');
		writeOSType(writer, type || 'long', value[key], key, extType);
		if (logErrors && !type) console.log(`Missing descriptor field type for: '${key}' in`, value);
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
		case 'ObAr': { // Object array
			readInt32(reader); // version: 16
			readUnicodeString(reader); // name: ''
			readAsciiStringOrClassId(reader); // 'rationalPoint'
			const length = readInt32(reader);
			const items: any[] = [];

			for (let i = 0; i < length; i++) {
				const type1 = readAsciiStringOrClassId(reader); // type Hrzn | Vrtc
				readSignature(reader); // UnFl

				readSignature(reader); // units ? '#Pxl'
				const valuesCount = readInt32(reader);
				const values: number[] = [];
				for (let j = 0; j < valuesCount; j++) {
					values.push(readFloat64(reader));
				}

				items.push({ type: type1, values });
			}

			return items;
		}
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
				if (logErrors && !type) console.log(`Missing descriptor array type for: '${key}' in`, value);
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
			const [_type, val] = value.split('.');
			writeAsciiStringOrClassId(writer, _type);
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
		case 'ObAr': // Object array
			writeInt32(writer, 16); // version
			writeUnicodeStringWithPadding(writer, ''); // name
			writeAsciiStringOrClassId(writer, 'rationalPoint');
			writeInt32(writer, value.length);

			for (let i = 0; i < value.length; i++) {
				writeAsciiStringOrClassId(writer, value[i].type); // Hrzn | Vrtc
				writeSignature(writer, 'UnFl');
				writeSignature(writer, '#Pxl');
				writeInt32(writer, value[i].values.length);

				for (let j = 0; j < value[i].values.length; j++) {
					writeFloat64(writer, value[i].values[j]);
				}
			}
			break;
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
