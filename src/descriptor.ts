import { createEnum } from './helpers';
import {
	AntiAlias, BevelDirection, BevelStyle, BevelTechnique, BlendMode, GlowSource, GlowTechnique, GradientStyle,
	LineAlignment, LineCapType, LineJoinType, Orientation, TextGridding, Units, UnitsValue, WarpStyle
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32, writeFloat32, writeUnicodeString
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
	// printProofSetup: makeType('校样设置', 'proofSetup'), // TESTING
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
	origin: makeType('', 'Pnt '),
	autoExpandOffset: makeType('', 'Pnt '),
	keyOriginShapeBBox: makeType('', 'unitRect'),
	Vrsn: makeType('', 'null'),
	psVersion: makeType('', 'null'),
	docDefaultNewArtboardBackgroundColor: makeType('', 'RGBC'),
	artboardRect: makeType('', 'classFloatRect'),
	keyOriginRRectRadii: makeType('', 'radii'),
	keyOriginBoxCorners: makeType('', 'null'),
	rectangleCornerA: makeType('', 'Pnt '),
	rectangleCornerB: makeType('', 'Pnt '),
	rectangleCornerC: makeType('', 'Pnt '),
	rectangleCornerD: makeType('', 'Pnt '),
	compInfo: makeType('', 'null'),
	Trnf: makeType('Transform', 'Trnf'),
	quiltWarp: makeType('', 'quiltWarp'),
	generatorSettings: makeType('', 'null'),
	crema: makeType('', 'null'),
};

const fieldToArrayExtType: ExtTypeDict = {
	'Crv ': makeType('', 'CrPt'),
	Clrs: makeType('', 'Clrt'),
	Trns: makeType('', 'TrnS'),
	keyDescriptorList: makeType('', 'null'),
	solidFillMulti: makeType('', 'SoFi'),
	gradientFillMulti: makeType('', 'GrFl'),
	dropShadowMulti: makeType('', 'DrSh'),
	innerShadowMulti: makeType('', 'IrSh'),
	frameFXMulti: makeType('', 'FrFX'),
};

const typeToField: { [key: string]: string[]; } = {
	'TEXT': [
		'Txt ', 'printerName', 'Nm  ', 'Idnt', 'blackAndWhitePresetFileName', 'LUT3DFileName',
		'presetFileName', 'curvesPresetFileName', 'mixerPresetFileName', 'placed', 'description', 'reason',
		'artboardPresetName', 'json',
	],
	'tdta': ['EngineData', 'LUT3DFileData'],
	'long': [
		'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion', 'LaID', 'Vrsn', 'Cnt ',
		'Brgh', 'Cntr', 'means', 'vibrance', 'Strt', 'bwPresetKind', 'presetKind', 'comp', 'compID', 'originalCompID',
		'curvesPresetKind', 'mixerPresetKind', 'uOrder', 'vOrder', 'PgNm', 'totalPages', 'Crop',
		'numerator', 'denominator', 'frameCount', 'Annt', 'keyOriginType', 'unitValueQuadVersion',
		'keyOriginIndex', 'major', 'minor', 'fix', 'docDefaultNewArtboardBackgroundType', 'artboardBackgroundType',
		'numModifyingFX', 'deformNumRows', 'deformNumCols',
	],
	'enum': [
		'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
		'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'glwS', 'GrdF', 'GlwT',
		'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
		'strokeStyleBlendMode', 'PntT', 'Styl', 'lookupType', 'LUTFormat', 'dataOrder',
		'tableOrder', 'enableCompCore', 'enableCompCoreGPU', 'compCoreSupport', 'compCoreGPUSupport', 'Engn',
		'enableCompCoreThreads',
	],
	'bool': [
		'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss',
		'useShape', 'useTexture', 'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape',
		'useTexture', 'Algn', 'Rvrs', 'Dthr', 'Invr', 'VctC', 'ShTr', 'layerConceals',
		'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock', 'strokeStyleStrokeAdjust',
		'hardProof', 'MpBl', 'paperWhite', 'useLegacy', 'Auto', 'Lab ', 'useTint', 'keyShapeInvalidated',
		'autoExpandEnabled', 'autoNestEnabled', 'autoPositionEnabled', 'shrinkwrapOnSaveEnabled',
		'present', 'showInDialog', 'overprint',
	],
	'doub': [
		'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Wdth', 'Hght',
		'strokeStyleMiterLimit', 'strokeStyleResolution', 'layerTime', 'keyOriginResolution',
		'xx', 'xy', 'yx', 'yy', 'tx', 'ty',
	],
	'UntF': [
		'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl',
		'Ckmt', 'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset',
		'strokeStyleOpacity', 'H   ', 'Top ', 'Left', 'Btom', 'Rght', 'Rslt',
		'topRight', 'topLeft', 'bottomLeft', 'bottomRight',
	],
	'VlLs': [
		'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet', 'FrLs',
		'LaSt', 'Trnf', 'nonAffineTransform', 'keyDescriptorList', 'guideIndeces', 'gradientFillMulti',
		'solidFillMulti', 'frameFXMulti', 'innerShadowMulti', 'dropShadowMulti',
	],
	'ObAr': ['meshPoints', 'quiltSliceX', 'quiltSliceY'],
	'obj ': ['null'],
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
	'keyDescriptorList': 'Objc',
	'gradientFillMulti': 'Objc',
	'solidFillMulti': 'Objc',
	'frameFXMulti': 'Objc',
	'innerShadowMulti': 'Objc',
	'dropShadowMulti': 'Objc',
};

const fieldToType: Dict = {};

for (const type of Object.keys(typeToField)) {
	for (const field of typeToField[type]) {
		fieldToType[field] = type;
	}
}

for (const field of Object.keys(fieldToExtType)) {
	if (!fieldToType[field]) fieldToType[field] = 'Objc';
}

for (const field of Object.keys(fieldToArrayExtType)) {
	fieldToArrayType[field] = 'Objc';
}

function getTypeByKey(key: string, value: any, root: string) {
	if (key === 'Sz  ') {
		return ('Wdth' in value) ? 'Objc' : (('units' in value) ? 'UntF' : 'doub');
	} else if (key === 'Type') {
		return typeof value === 'string' ? 'enum' : 'long';
	} else if (key === 'AntA') {
		return typeof value === 'string' ? 'enum' : 'bool';
	} else if (key === 'Hrzn' || key === 'Vrtc' || key === 'Top ' || key === 'Left' || key === 'Btom' || key === 'Rght') {
		return typeof value === 'number' ? 'doub' : 'UntF';
	} else if (key === 'Vrsn') {
		return typeof value === 'number' ? 'long' : 'Objc';
	} else if (key === 'Rd  ' || key === 'Grn ' || key === 'Bl  ') {
		return root === 'artd' ? 'long' : 'doub';
	} else if (key === 'Trnf') {
		return Array.isArray(value) ? 'VlLs' : 'Objc';
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

export function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any, root: string) {
	if (logErrors && !classId) console.log('Missing classId for: ', name, classId, value);

	// write class structure
	writeUnicodeStringWithPadding(writer, name);
	writeAsciiStringOrClassId(writer, classId);

	const keys = Object.keys(value);
	writeUint32(writer, keys.length);

	for (const key of keys) {
		let type = getTypeByKey(key, value[key], root);
		let extType = fieldToExtType[key];

		if ((key === 'Strt' || key === 'Brgh') && 'H   ' in value) {
			type = 'doub';
		} else if (channels.indexOf(key) !== -1) {
			type = (classId === 'RGBC' && root !== 'artd') ? 'doub' : 'long';
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
		} else if (key === 'bounds' && root === 'quiltWarp') {
			extType = makeType('', 'classFloatRect');
		}

		if (extType && extType.classID === 'RGBC') {
			if ('H   ' in value[key]) extType = { classID: 'HSBC', name: '' };
			// TODO: other color spaces
		}

		writeAsciiStringOrClassId(writer, key);
		writeSignature(writer, type || 'long');
		writeOSType(writer, type || 'long', value[key], key, extType, root);
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

const ObArTypes: { [key: string]: string | undefined; } = {
	meshPoints: 'rationalPoint',
	quiltSliceX: 'UntF',
	quiltSliceY: 'UntF',
};

function writeOSType(writer: PsdWriter, type: string, value: any, key: string, extType: NameClassID | undefined, root: string) {
	switch (type) {
		case 'obj ': // Reference
			writeReferenceStructure(writer, key, value);
			break;
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			if (!extType) throw new Error(`Missing ext type for: '${key}' (${JSON.stringify(value)})`);
			writeDescriptorStructure(writer, extType.name, extType.classID, value, root);
			break;
		case 'VlLs': // List
			writeInt32(writer, value.length);

			for (let i = 0; i < value.length; i++) {
				const type = fieldToArrayType[key];
				writeSignature(writer, type || 'long');
				writeOSType(writer, type || 'long', value[i], '', fieldToArrayExtType[key], root);
				if (logErrors && !type) console.log(`Missing descriptor array type for: '${key}' in`, value);
			}
			break;
		case 'doub': // Double
			writeFloat64(writer, value);
			break;
		case 'UntF': // Unit double
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units} in ${key}`);
			writeSignature(writer, unitsMapRev[value.units]);
			writeFloat64(writer, value.value);
			break;
		case 'UnFl': // Unit float
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units} in ${key}`);
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
		case 'ObAr': { // Object array
			writeInt32(writer, 16); // version
			writeUnicodeStringWithPadding(writer, ''); // name
			const type = ObArTypes[key];
			if (!type) throw new Error(`Not implemented ObArType for: ${key}`);
			writeAsciiStringOrClassId(writer, type);
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
		}
		// case 'Pth ': // File path
		// 	writeFilePath(reader);
		default:
			throw new Error(`Not implemented descriptor OSType: ${type}`);
	}
}

function readReferenceStructure(reader: PsdReader) {
	const itemsCount = readInt32(reader);
	const items: any[] = [];

	for (let i = 0; i < itemsCount; i++) {
		const type = readSignature(reader);

		switch (type) {
			case 'prop': { // Property
				readClassStructure(reader);
				const keyID = readAsciiStringOrClassId(reader);
				items.push(keyID);
				break;
			}
			case 'Clss': // Class
				items.push(readClassStructure(reader));
				break;
			case 'Enmr': { // Enumerated Reference
				readClassStructure(reader);
				const typeID = readAsciiStringOrClassId(reader);
				const value = readAsciiStringOrClassId(reader);
				items.push(`${typeID}.${value}`);
				break;
			}
			case 'rele': { // Offset
				// const { name, classID } =
				readClassStructure(reader);
				items.push(readUint32(reader));
				break;
			}
			case 'Idnt': // Identifier
				items.push(readInt32(reader));
				break;
			case 'indx': // Index
				items.push(readInt32(reader));
				break;
			case 'name': { // Name
				readClassStructure(reader);
				items.push(readUnicodeString(reader));
				break;
			}
			default:
				throw new Error(`Invalid descriptor reference type: ${type}`);
		}
	}

	return items;
}

function writeReferenceStructure(writer: PsdWriter, _key: string, items: any[]) {
	writeInt32(writer, items.length);

	for (let i = 0; i < items.length; i++) {
		const value = items[i];
		let type = 'unknown';

		if (typeof value === 'string') {
			if (/^[a-z]+\.[a-z]+$/i.test(value)) {
				type = 'Enmr';
			} else {
				type = 'name';
			}
		}

		writeSignature(writer, type);

		switch (type) {
			// case 'prop': // Property
			// case 'Clss': // Class
			case 'Enmr': { // Enumerated Reference
				const [typeID, enumValue] = value.split('.');
				writeClassStructure(writer, '\0', typeID);
				writeAsciiStringOrClassId(writer, typeID);
				writeAsciiStringOrClassId(writer, enumValue);
				break;
			}
			// case 'rele': // Offset
			// case 'Idnt': // Identifier
			// case 'indx': // Index
			case 'name': { // Name
				writeClassStructure(writer, '\0', 'Lyr ');
				writeUnicodeString(writer, value + '\0');
				break;
			}
			default:
				throw new Error(`Invalid descriptor reference type: ${type}`);
		}
	}

	return items;
}

function readClassStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	// console.log({ name, classID });
	return { name, classID };
}

function writeClassStructure(writer: PsdWriter, name: string, classID: string) {
	writeUnicodeString(writer, name);
	writeAsciiStringOrClassId(writer, classID);
}

export function readVersionAndDescriptor(reader: PsdReader) {
	const version = readUint32(reader);
	if (version !== 16) throw new Error(`Invalid descriptor version: ${version}`);
	const desc = readDescriptorStructure(reader);
	// console.log(require('util').inspect(desc, false, 99, true));
	return desc;
}

export function writeVersionAndDescriptor(writer: PsdWriter, name: string, classID: string, descriptor: any, root = '') {
	writeUint32(writer, 16); // version
	writeDescriptorStructure(writer, name, classID, descriptor, root);
}

export type DescriptorUnits = 'Angle' | 'Density' | 'Distance' | 'None' | 'Percent' | 'Pixels' |
	'Millimeters' | 'Points' | 'Picas' | 'Inches' | 'Centimeters';

export interface DescriptorUnitsValue {
	units: DescriptorUnits;
	value: number;
}

export type DescriptorColor = {
	'Rd  ': number;
	'Grn ': number;
	'Bl  ': number;
} | {
	'H   ': DescriptorUnitsValue;
	Strt: number;
	Brgh: number;
} | {
	'Cyn ': number;
	Mgnt: number;
	'Ylw ': number;
	Blck: number;
} | {
	'Gry ': number;
} | {
	Lmnc: number;
	'A   ': number;
	'B   ': number;
};

export interface DesciptorPattern {
	'Nm  ': string;
	Idnt: string;
}

export type DesciptorGradient = {
	'Nm  ': string;
	GrdF: 'GrdF.CstS';
	Intr: number;
	Clrs: {
		'Clr ': DescriptorColor;
		Type: 'Clry.UsrS';
		Lctn: number;
		Mdpn: number;
	}[];
	Trns: {
		Opct: DescriptorUnitsValue;
		Lctn: number;
		Mdpn: number;
	}[];
} | {
	GrdF: 'GrdF.ClNs';
	Smth: number;
	'Nm  ': string;
	ClrS: string;
	RndS: number;
	VctC?: boolean;
	ShTr?: boolean;
	'Mnm ': number[];
	'Mxm ': number[];
};

export interface DescriptorColorContent {
	'Clr ': DescriptorColor;
}

export interface DescriptorGradientContent {
	Grad: DesciptorGradient;
	Type: string;
	Dthr?: boolean;
	Rvrs?: boolean;
	Angl?: DescriptorUnitsValue;
	'Scl '?: DescriptorUnitsValue;
	Algn?: boolean;
	Ofst?: { Hrzn: DescriptorUnitsValue; Vrtc: DescriptorUnitsValue; };
}

export interface DescriptorPatternContent {
	Ptrn: DesciptorPattern;
	Lnkd?: boolean;
	phase?: { Hrzn: number; Vrtc: number; };
}

export type DescriptorVectorContent = DescriptorColorContent | DescriptorGradientContent | DescriptorPatternContent;

export interface StrokeDescriptor {
	strokeStyleVersion: number;
	strokeEnabled: boolean;
	fillEnabled: boolean;
	strokeStyleLineWidth: DescriptorUnitsValue;
	strokeStyleLineDashOffset: DescriptorUnitsValue;
	strokeStyleMiterLimit: number;
	strokeStyleLineCapType: string;
	strokeStyleLineJoinType: string;
	strokeStyleLineAlignment: string;
	strokeStyleScaleLock: boolean;
	strokeStyleStrokeAdjust: boolean;
	strokeStyleLineDashSet: DescriptorUnitsValue[];
	strokeStyleBlendMode: string;
	strokeStyleOpacity: DescriptorUnitsValue;
	strokeStyleContent: DescriptorVectorContent;
	strokeStyleResolution: number;
}

export interface TextDescriptor {
	'Txt ': string;
	textGridding: string;
	Ornt: string;
	AntA: string;
	TextIndex: number;
	EngineData?: Uint8Array;
}

export interface WarpDescriptor {
	warpStyle: string;
	warpValue: number;
	warpPerspective: number;
	warpPerspectiveOther: number;
	warpRotate: string;
	bounds?: {
		'Top ': DescriptorUnitsValue;
		Left: DescriptorUnitsValue;
		Btom: DescriptorUnitsValue;
		Rght: DescriptorUnitsValue;
	};
	uOrder: number;
	vOrder: number;
	customEnvelopeWarp?: {
		meshPoints: {
			type: 'Hrzn' | 'Vrtc';
			values: number[];
		}[];
	};
}

export interface QuiltWarpDescriptor extends WarpDescriptor {
	deformNumRows: number;
	deformNumCols: number;
	customEnvelopeWarp: {
		quiltSliceX: {
			type: 'quiltSliceX';
			values: number[];
		}[];
		quiltSliceY: {
			type: 'quiltSliceY';
			values: number[];
		}[];
		meshPoints: {
			type: 'Hrzn' | 'Vrtc';
			values: number[];
		}[];
	};
}

export function parseAngle(x: DescriptorUnitsValue) {
	if (x === undefined) return 0;
	if (x.units !== 'Angle') throw new Error(`Invalid units: ${x.units}`);
	return x.value;
}

export function parsePercent(x: DescriptorUnitsValue | undefined) {
	if (x === undefined) return 1;
	if (x.units !== 'Percent') throw new Error(`Invalid units: ${x.units}`);
	return x.value / 100;
}

export function parsePercentOrAngle(x: DescriptorUnitsValue | undefined) {
	if (x === undefined) return 1;
	if (x.units === 'Percent') return x.value / 100;
	if (x.units === 'Angle') return x.value / 360;
	throw new Error(`Invalid units: ${x.units}`);
}

export function parseUnits({ units, value }: DescriptorUnitsValue): UnitsValue {
	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density'
	) {
		throw new Error(`Invalid units: ${JSON.stringify({ units, value })}`);
	}
	return { value, units };
}

export function parseUnitsOrNumber(value: DescriptorUnitsValue | number, units: Units = 'Pixels'): UnitsValue {
	if (typeof value === 'number') return { value, units };
	return parseUnits(value);
}

export function parseUnitsToNumber({ units, value }: DescriptorUnitsValue, expectedUnits: string): number {
	if (units !== expectedUnits) throw new Error(`Invalid units: ${JSON.stringify({ units, value })}`);
	return value;
}

export function unitsAngle(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Angle', value: value || 0 };
}

export function unitsPercent(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Percent', value: Math.round((value || 0) * 100) };
}

export function unitsValue(x: UnitsValue | undefined, key: string): DescriptorUnitsValue {
	if (x == null) return { units: 'Pixels', value: 0 };

	if (typeof x !== 'object')
		throw new Error(`Invalid value: ${JSON.stringify(x)} (key: ${key}) (should have value and units)`);

	const { units, value } = x;

	if (typeof value !== 'number')
		throw new Error(`Invalid value in ${JSON.stringify(x)} (key: ${key})`);

	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density'
	) {
		throw new Error(`Invalid units in ${JSON.stringify(x)} (key: ${key})`);
	}

	return { units, value };
}

export const textGridding = createEnum<TextGridding>('textGridding', 'none', {
	none: 'None',
	round: 'Rnd ',
});

export const Ornt = createEnum<Orientation>('Ornt', 'horizontal', {
	horizontal: 'Hrzn',
	vertical: 'Vrtc',
});

export const Annt = createEnum<AntiAlias>('Annt', 'sharp', {
	none: 'Anno',
	sharp: 'antiAliasSharp',
	crisp: 'AnCr',
	strong: 'AnSt',
	smooth: 'AnSm',
	platform: 'antiAliasPlatformGray',
	platformLCD: 'antiAliasPlatformLCD',
});

export const warpStyle = createEnum<WarpStyle>('warpStyle', 'none', {
	none: 'warpNone',
	arc: 'warpArc',
	arcLower: 'warpArcLower',
	arcUpper: 'warpArcUpper',
	arch: 'warpArch',
	bulge: 'warpBulge',
	shellLower: 'warpShellLower',
	shellUpper: 'warpShellUpper',
	flag: 'warpFlag',
	wave: 'warpWave',
	fish: 'warpFish',
	rise: 'warpRise',
	fisheye: 'warpFisheye',
	inflate: 'warpInflate',
	squeeze: 'warpSqueeze',
	twist: 'warpTwist',
	custom: 'warpCustom',
});

export const BlnM = createEnum<BlendMode>('BlnM', 'normal', {
	'normal': 'Nrml',
	'dissolve': 'Dslv',
	'darken': 'Drkn',
	'multiply': 'Mltp',
	'color burn': 'CBrn',
	'linear burn': 'linearBurn',
	'darker color': 'darkerColor',
	'lighten': 'Lghn',
	'screen': 'Scrn',
	'color dodge': 'CDdg',
	'linear dodge': 'linearDodge',
	'lighter color': 'lighterColor',
	'overlay': 'Ovrl',
	'soft light': 'SftL',
	'hard light': 'HrdL',
	'vivid light': 'vividLight',
	'linear light': 'linearLight',
	'pin light': 'pinLight',
	'hard mix': 'hardMix',
	'difference': 'Dfrn',
	'exclusion': 'Xclu',
	'subtract': 'blendSubtraction',
	'divide': 'blendDivide',
	'hue': 'H   ',
	'saturation': 'Strt',
	'color': 'Clr ',
	'luminosity': 'Lmns',
});

export const BESl = createEnum<BevelStyle>('BESl', 'inner bevel', {
	'inner bevel': 'InrB',
	'outer bevel': 'OtrB',
	'emboss': 'Embs',
	'pillow emboss': 'PlEb',
	'stroke emboss': 'strokeEmboss',
});

export const bvlT = createEnum<BevelTechnique>('bvlT', 'smooth', {
	'smooth': 'SfBL',
	'chisel hard': 'PrBL',
	'chisel soft': 'Slmt',
});

export const BESs = createEnum<BevelDirection>('BESs', 'up', {
	up: 'In  ',
	down: 'Out ',
});

export const BETE = createEnum<GlowTechnique>('BETE', 'softer', {
	softer: 'SfBL',
	precise: 'PrBL',
});

export const IGSr = createEnum<GlowSource>('IGSr', 'edge', {
	edge: 'SrcE',
	center: 'SrcC',
});

export const GrdT = createEnum<GradientStyle>('GrdT', 'linear', {
	linear: 'Lnr ',
	radial: 'Rdl ',
	angle: 'Angl',
	reflected: 'Rflc',
	diamond: 'Dmnd',
});

export const ClrS = createEnum<'rgb' | 'hsb' | 'lab'>('ClrS', 'rgb', {
	rgb: 'RGBC',
	hsb: 'HSBl',
	lab: 'LbCl',
});

export const FStl = createEnum<'inside' | 'center' | 'outside'>('FStl', 'outside', {
	outside: 'OutF',
	center: 'CtrF',
	inside: 'InsF'
});

export const FrFl = createEnum<'color' | 'gradient' | 'pattern'>('FrFl', 'color', {
	color: 'SClr',
	gradient: 'GrFl',
	pattern: 'Ptrn',
});

export const strokeStyleLineCapType = createEnum<LineCapType>('strokeStyleLineCapType', 'butt', {
	butt: 'strokeStyleButtCap',
	round: 'strokeStyleRoundCap',
	square: 'strokeStyleSquareCap',
});

export const strokeStyleLineJoinType = createEnum<LineJoinType>('strokeStyleLineJoinType', 'miter', {
	miter: 'strokeStyleMiterJoin',
	round: 'strokeStyleRoundJoin',
	bevel: 'strokeStyleBevelJoin',
});

export const strokeStyleLineAlignment = createEnum<LineAlignment>('strokeStyleLineAlignment', 'inside', {
	inside: 'strokeStyleAlignInside',
	center: 'strokeStyleAlignCenter',
	outside: 'strokeStyleAlignOutside',
});
