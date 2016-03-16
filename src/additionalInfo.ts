import { readEffects, writeEffects } from './effectsHelpers';
import { readColor, toArray } from './helpers';
import { LayerAdditionalInfo } from './psd';
import PsdReader from './psdReader';
import PsdWriter from './psdWriter';

export interface InfoHandler {
	key: string;
	has: (target: LayerAdditionalInfo) => boolean;
	read: (reader: PsdReader, target: LayerAdditionalInfo, left: () => number) => void;
	write: (writer: PsdWriter, target: LayerAdditionalInfo) => void;
}

let handlers: InfoHandler[] = [];
let handlersMap: { [key: string]: InfoHandler } = {};

function addHandler(handler: InfoHandler) {
	handlers.push(handler);
	handlersMap[handler.key] = handler;
}

export function getHandler(key: string) {
	return handlersMap[key];
}

export function getHandlers() {
	return handlers;
}

addHandler({
	key: 'luni',
	has: target => typeof target.name !== 'undefined',
	read: (reader, target, left) => {
		target.name = reader.readUnicodeString();
		reader.skip(left()); // TEMP: skipping
	},
	write: (writer, target) => {
		writer.writeUnicodeString(target.name);
	}
});

addHandler({
	key: 'lnsr',
	has: target => typeof target.nameSource !== 'undefined',
	read: (reader, target) => target.nameSource = reader.readSignature(),
	write: (writer, target) => writer.writeSignature(target.nameSource),
});

addHandler({
	key: 'lyid',
	has: target => typeof target.id !== 'undefined',
	read: (reader, target) => target.id = reader.readUint32(),
	write: (writer, target) => writer.writeUint32(target.id),
});

addHandler({
	key: 'clbl',
	has: target => typeof target.blendClippendElements !== 'undefined',
	read: (reader, target) => {
		target.blendClippendElements = !!reader.readUint8();
		reader.skip(3);
	},
	write: (writer, target) => {
		writer.writeUint8(target.blendClippendElements ? 1 : 0);
		writer.writeZeros(3);
	},
});

addHandler({
	key: 'infx',
	has: target => typeof target.blendInteriorElements !== 'undefined',
	read: (reader, target) => {
		target.blendInteriorElements = !!reader.readUint8();
		reader.skip(3);
	},
	write: (writer, target) => {
		writer.writeUint8(target.blendInteriorElements ? 1 : 0);
		writer.writeZeros(3);
	},
});

addHandler({
	key: 'knko',
	has: target => typeof target.knockout !== 'undefined',
	read: (reader, target) => {
		target.knockout = !!reader.readUint8();
		reader.skip(3);
	},
	write: (writer, target) => {
		writer.writeUint8(target.knockout ? 1 : 0);
		writer.writeZeros(3);
	},
});

addHandler({
	key: 'lspf',
	has: target => typeof target.protected !== 'undefined',
	read: (reader, target) => {
		let flags = reader.readUint32();
		target.protected = {
			transparency: (flags & 0x01) !== 0,
			composite: (flags & 0x02) !== 0,
			position: (flags & 0x04) !== 0,
		};
	},
	write: (writer, target) => {
		let flags =
			(target.protected.transparency ? 0x01 : 0) |
			(target.protected.composite ? 0x02 : 0) |
			(target.protected.position ? 0x04 : 0);

		writer.writeUint32(flags);
	},
});

addHandler({
	key: 'lclr',
	has: target => typeof target.sheetColors !== 'undefined',
	read: (reader, target) => {
		target.sheetColors = {
			color1: reader.readUint32(),
			color2: reader.readUint32(),
		};
	},
	write: (writer, target) => {
		writer.writeUint32(target.sheetColors.color1);
		writer.writeUint32(target.sheetColors.color2);
	},
});

addHandler({
	key: 'fxrp',
	has: target => typeof target.referencePoint !== 'undefined',
	read: (reader, target) => {
		target.referencePoint = {
			x: reader.readFloat64(),
			y: reader.readFloat64(),
		};
	},
	write: (writer, target) => {
		writer.writeFloat64(target.referencePoint.x);
		writer.writeFloat64(target.referencePoint.y);
	},
});

addHandler({
	key: 'lsct',
	has: target => typeof target.sectionDivider !== 'undefined',
	read: (reader, target, left) => {
		let item: any = {};

		item.type = reader.readUint32();

		if (left()) {
			let signature = reader.readSignature();

			if (signature !== '8BIM')
				throw new Error(`Invalid signature: '${signature}'`);

			item.key = reader.readSignature();
		}

		if (left()) {
			// 0 = normal
			// 1 = scene group, affects the animation timeline.
			item.subType = reader.readUint32();
		}

		target.sectionDivider = item;
	},
	write: (writer, target) => {
		writer.writeUint32(target.sectionDivider.type);

		if (target.sectionDivider.key) {
			writer.writeSignature('8BIM');
			writer.writeSignature(target.sectionDivider.key);

			if (typeof target.sectionDivider.subtype !== 'undefined')
				writer.writeUint32(target.sectionDivider.subtype);
		}
	},
});

addHandler({
	key: 'FMsk',
	has: target => typeof target.filterMask !== 'undefined',
	read: (reader, target) => {
		target.filterMask = {
			colorSpace: readColor(reader),
			opacity: reader.readUint16(),
		};
	},
	write: (writer, target) => {
		writer.writeBytes(new Uint8Array(target.filterMask.colorSpace));
		writer.writeUint16(target.filterMask.opacity);
	},
});

addHandler({
	key: 'shmd',
	has: target => typeof target.metadata !== 'undefined',
	read: (reader, target) => {
		let count = reader.readUint32();
		target.metadata = [];

		for (let i = 0; i < count; i++) {
			let signature = reader.readSignature();

			if (signature !== '8BIM')
				throw new Error(`Invalid signature: '${signature}'`);

			let key = reader.readSignature();
			let copy = !!reader.readUint8();
			reader.skip(3);
			let length = reader.readUint32();
			let data = toArray(reader.readBytes(length));
			target.metadata.push({ key, copy, data });
		}
	},
	write: (writer, target) => {
		writer.writeUint32(target.metadata.length);

		for (let i = 0; i < target.metadata.length; i++) {
			let item = target.metadata[i];
			writer.writeSignature('8BIM');
			writer.writeSignature(item.key);
			writer.writeUint8(item.copy ? 1 : 0);
			writer.writeZeros(3);
			writer.writeUint32(item.data.length);
			writer.writeBytes(new Uint8Array(item.data));
		}
	},
});

addHandler({
	key: 'lyvr',
	has: target => typeof target.version !== 'undefined',
	read: (reader, target) => {
		target.version = reader.readUint32();
	},
	write: (writer, target) => {
		writer.writeUint32(target.version);
	},
});

addHandler({
	key: 'lrFX',
	has: target => typeof target.effects !== 'undefined',
	read: (reader, target, left) => {
		target.effects = readEffects(reader);
		reader.skip(left()); // TEMP: skipping
	},
	write: (writer, target) => {
		writeEffects(writer, target.effects);
	},
});

function readStringOrClassId(reader: PsdReader) {
	let text = reader.readUnicodeString();
	return text.length === 0 ? reader.readSignature() : text;
}

function readStringOrClassId2(reader: PsdReader) {
	let text = reader.readPascalString();
	return text.length === 0 ? reader.readSignature() : text;
}

addHandler({
	key: 'lfx2',
	has: target => typeof target.objectBasedEffectsLayerInfo !== 'undefined',
	read: (reader, target) => {
		let version = reader.readUint32();
		let descriptorVersion = reader.readUint32();

		let name = reader.readUnicodeString();
		let classId = readStringOrClassId(reader);
		let itemsCount = reader.readUint32();

		//for (let i = 0; i < itemsCount; i++) {
		//	console.log('read item');
		//	let key = readStringOrClassId(reader);
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
	write: (writer, target) => {
		//...
	},
});
