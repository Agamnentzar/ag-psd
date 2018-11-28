import { readEffects, writeEffects } from './effectsHelpers';
import { readColor, toArray } from './helpers';
import { LayerAdditionalInfo } from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readAsciiString, readInt32
} from './psdReader';
import {
	PsdWriter, writeZeros, writeUnicodeString, writeSignature, writeBytes, writeUint32, writeUint16,
	writeFloat64, writeUint8
} from './psdWriter';

export interface InfoHandler {
	key: string;
	has: (target: LayerAdditionalInfo) => boolean;
	read: (reader: PsdReader, target: LayerAdditionalInfo, left: () => number) => void;
	write: (writer: PsdWriter, target: LayerAdditionalInfo) => void;
}

const handlers: InfoHandler[] = [];
const handlersMap: { [key: string]: InfoHandler } = {};

function addHandler(
	key: string,
	has: (target: LayerAdditionalInfo) => boolean,
	read: (reader: PsdReader, target: LayerAdditionalInfo, left: () => number) => void,
	write: (writer: PsdWriter, target: LayerAdditionalInfo) => void,
) {
	const handler: InfoHandler = { key, has, read, write };
	handlers.push(handler);
	handlersMap[handler.key] = handler;
}

export function getHandler(key: string) {
	return handlersMap[key];
}

export function getHandlers() {
	return handlers;
}

addHandler(
	'luni',
	target => typeof target.name !== 'undefined',
	(reader, target, left) => {
		target.name = readUnicodeString(reader);
		skipBytes(reader, left()); // TEMP: skipping
	},
	(writer, target) => {
		writeUnicodeString(writer, target.name!);
	}
);

addHandler(
	'lnsr',
	target => typeof target.nameSource !== 'undefined',
	(reader, target) => target.nameSource = readSignature(reader),
	(writer, target) => writeSignature(writer, target.nameSource!),
);

addHandler(
	'lyid',
	target => typeof target.id !== 'undefined',
	(reader, target) => target.id = readUint32(reader),
	(writer, target) => writeUint32(writer, target.id!),
);

addHandler(
	'clbl',
	target => typeof target.blendClippendElements !== 'undefined',
	(reader, target) => {
		target.blendClippendElements = !!readUint8(reader);
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.blendClippendElements ? 1 : 0);
		writeZeros(writer, 3);
	},
);

addHandler(
	'infx',
	target => typeof target.blendInteriorElements !== 'undefined',
	(reader, target) => {
		target.blendInteriorElements = !!readUint8(reader);
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.blendInteriorElements ? 1 : 0);
		writeZeros(writer, 3);
	},
);

addHandler(
	'knko',
	target => typeof target.knockout !== 'undefined',
	(reader, target) => {
		target.knockout = !!readUint8(reader);
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.knockout ? 1 : 0);
		writeZeros(writer, 3);
	},
);

addHandler(
	'lspf',
	target => typeof target.protected !== 'undefined',
	(reader, target) => {
		const flags = readUint32(reader);
		target.protected = {
			transparency: (flags & 0x01) !== 0,
			composite: (flags & 0x02) !== 0,
			position: (flags & 0x04) !== 0,
		};
	},
	(writer, target) => {
		const flags =
			(target.protected!.transparency ? 0x01 : 0) |
			(target.protected!.composite ? 0x02 : 0) |
			(target.protected!.position ? 0x04 : 0);

		writeUint32(writer, flags);
	},
);

addHandler(
	'lclr',
	target => typeof target.sheetColors !== 'undefined',
	(reader, target) => {
		target.sheetColors = {
			color1: readUint32(reader),
			color2: readUint32(reader),
		};
	},
	(writer, target) => {
		writeUint32(writer, target.sheetColors!.color1);
		writeUint32(writer, target.sheetColors!.color2);
	},
);

addHandler(
	'fxrp',
	target => typeof target.referencePoint !== 'undefined',
	(reader, target) => {
		target.referencePoint = {
			x: readFloat64(reader),
			y: readFloat64(reader),
		};
	},
	(writer, target) => {
		writeFloat64(writer, target.referencePoint!.x);
		writeFloat64(writer, target.referencePoint!.y);
	},
);

addHandler(
	'lsct',
	target => typeof target.sectionDivider !== 'undefined',
	(reader, target, left) => {
		const item: any = {};

		item.type = readUint32(reader);

		if (left()) {
			const signature = readSignature(reader);

			if (signature !== '8BIM')
				throw new Error(`Invalid signature: '${signature}'`);

			item.key = readSignature(reader);
		}

		if (left()) {
			// 0 = normal
			// 1 = scene group, affects the animation timeline.
			item.subType = readUint32(reader);
		}

		target.sectionDivider = item;
	},
	(writer, target) => {
		writeUint32(writer, target.sectionDivider!.type);

		if (target.sectionDivider!.key) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, target.sectionDivider!.key!);

			if (typeof target.sectionDivider!.subtype !== 'undefined')
				writeUint32(writer, target.sectionDivider!.subtype!);
		}
	},
);

addHandler(
	'FMsk',
	target => typeof target.filterMask !== 'undefined',
	(reader, target) => {
		target.filterMask = {
			colorSpace: readColor(reader),
			opacity: readUint16(reader),
		};
	},
	(writer, target) => {
		writeBytes(writer, new Uint8Array(target.filterMask!.colorSpace));
		writeUint16(writer, target.filterMask!.opacity);
	},
);

addHandler(
	'shmd',
	target => typeof target.metadata !== 'undefined',
	(reader, target) => {
		const count = readUint32(reader);
		target.metadata = [];

		for (let i = 0; i < count; i++) {
			const signature = readSignature(reader);

			if (signature !== '8BIM')
				throw new Error(`Invalid signature: '${signature}'`);

			const key = readSignature(reader);
			const copy = !!readUint8(reader);
			skipBytes(reader, 3);
			const length = readUint32(reader);
			const data = toArray(readBytes(reader, length));
			target.metadata.push({ key, copy, data });
		}
	},
	(writer, target) => {
		writeUint32(writer, target.metadata!.length);

		for (let i = 0; i < target.metadata!.length; i++) {
			const item = target.metadata![i];
			writeSignature(writer, '8BIM');
			writeSignature(writer, item.key);
			writeUint8(writer, item.copy ? 1 : 0);
			writeZeros(writer, 3);
			writeUint32(writer, item.data.length);
			writeBytes(writer, new Uint8Array(item.data));
		}
	},
);

addHandler(
	'lyvr',
	target => typeof target.version !== 'undefined',
	(reader, target) => {
		target.version = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.version!);
	},
);

addHandler(
	'lrFX',
	target => typeof target.effects !== 'undefined',
	(reader, target, left) => {
		target.effects = readEffects(reader);
		skipBytes(reader, left()); // TEMP: skipping
	},
	(writer, target) => {
		writeEffects(writer, target.effects!);
	},
);
/*
addHandler(
	'TySh',
	_target => false, // typeof target.effects !== 'undefined',
	(reader, target) => {
		const version = readUint16(reader);

		if (version !== 1) {
			throw new Error(`Invalid TySh version: ${version}`);
		}

		const transform = [
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
		];

		const textVersion = readUint16(reader);
		const descriptorVersion = readUint32(reader);

		if (textVersion !== 50 || descriptorVersion !== 16) {
			throw new Error(`Invalid TySh text version: ${textVersion}/${descriptorVersion}`);
		}

		const text = readDescriptorStructure(reader);

		const warpVersion = readUint16(reader);
		const warpDescriptorVersion = readUint32(reader);

		if (warpVersion !== 1 || warpDescriptorVersion !== 16) {
			throw new Error(`Invalid TySh warp version: ${warpVersion} ${warpDescriptorVersion}`);
		}

		const warp = readDescriptorStructure(reader);

		const left = readInt32(reader);
		const top = readInt32(reader);
		const right = readInt32(reader);
		const bottom = readInt32(reader);

		target.typeToolObjectSetting = { transform, text, warp, left, top, right, bottom };
	},
	(_writer, _target) => {
		throw new Error('not implemented');
	},
);

addHandler(
	'Txt2',
	target => typeof target.textEngineData !== 'undefined',
	(reader, target, left) => {
		target.textEngineData = Array.from(readBytes(reader, left()));
	},
	(writer, target) => {
		writeBytes(writer, new Uint8Array(target.textEngineData!));
	},
);
*/
addHandler(
	'lfx2',
	target => typeof target.objectBasedEffectsLayerInfo !== 'undefined',
	(reader, _target, left) => {
		skipBytes(reader, left());
		// const version = readUint32(reader);
		// const descriptorVersion = readUint32(reader);

		// const name = reader.readUnicodeString();
		// const classId = readStringOrClassId(reader);
		// const itemsCount = readUint32(reader);

		//for (let i = 0; i < itemsCount; i++) {
		//	console.log('read item');
		//	const key = readStringOrClassId(reader);
		//	console.log('key', [key]);

		//}

		//target.objectBasedEffectsLayerInfo = {
		//	version,
		//	descriptorVersion,
		//	descriptor: {
		//		name,
		//		classId,
		//		//...
		//	},
		//};
	},
	(_writer, _target) => {
		//...
	},
);

// Helpers

function readAsciiStringOrClassId(reader: PsdReader) {
	const length = readUint32(reader);
	return length === 0 ? readSignature(reader) : readAsciiString(reader, length);
}

function readDescriptorStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	const itemsCount = readUint32(reader);
	const object: any = {};

	for (let i = 0; i < itemsCount; i++) {
		const key = readAsciiStringOrClassId(reader);
		const type = readSignature(reader);
		const data = readOSType(reader, type);
		object[key] = data;
	}

	name;
	classID;

	return object;
}

function readOSType(reader: PsdReader, type: string) {
	switch (type) {
		case 'obj ': // Reference
			return readReferenceStructure(reader);
		case 'Objc': // Descriptor
			return readDescriptorStructure(reader);
		case 'VlLs': // List
			return readListStructure(reader);
		case 'doub': // Double
			return readFloat64(reader);
		case 'UntF': // Unit float
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
		case 'GlbO': // GlobalObject same as Descriptor
			return readDescriptorStructure(reader);
		case 'type': // Class
		case 'GlbC': // Class
			return readClassStructure(reader);
		case 'alis': // Alias
			return readAliasStructure(reader);
		case 'tdta': // Raw Data
			return readRawData(reader);
		default:
			throw new Error(`Invalid TySh descriptor OSType: ${type} at ${reader.offset.toString(16)}`);
	}
}

function readReferenceStructure(reader: PsdReader) {
	const itemsCount = readUint32(reader);
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
			case 'rele': // Offset
				items.push(readOffsetStructure(reader));
				break;
			case 'Idnt': // Identifier
				throw new Error(`Not implemented: Idnt`);
			case 'indx': // Index
				throw new Error(`Not implemented: indx`);
			case 'name': // Name
				throw new Error(`Not implemented: name`);
			default:
				throw new Error(`Invalid TySh descriptor Reference type: ${type}`);
		}
	}

	return items;
}

function readPropertyStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	const keyID = readAsciiStringOrClassId(reader);
	return { name, classID, keyID };
}

function readUnitFloatStructure(reader: PsdReader) {
	const units = readSignature(reader);
	const value = readFloat64(reader);
	return { units, value };
}

function readClassStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	return { name, classID };
}

function readEnumeratedReference(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	const TypeID = readAsciiStringOrClassId(reader);
	const enumValue = readAsciiStringOrClassId(reader);
	return { name, classID, TypeID, enumValue };
}

function readOffsetStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	const value = readUint32(reader);
	return { name, classID, value };
}

function readAliasStructure(reader: PsdReader) {
	const length = readUint32(reader);
	return Array.from(readBytes(reader, length));
}

function readListStructure(reader: PsdReader) {
	const length = readUint32(reader);
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

function readRawData(reader: PsdReader) {
	const length = readUint32(reader);
	return Array.from(readBytes(reader, length));
}
