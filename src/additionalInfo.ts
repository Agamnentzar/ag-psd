import { readEffects, writeEffects } from './effectsHelpers';
import { readColor, toArray } from './helpers';
import { LayerAdditionalInfo, TextGridding, Orientation, WarpStyle, Antialias } from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readInt32, readInt16
} from './psdReader';
import {
	PsdWriter, writeZeros, writeUnicodeString, writeSignature, writeBytes, writeUint32, writeUint16,
	writeFloat64, writeUint8, writeInt16, writeInt32
} from './psdWriter';
import { readDescriptorStructure, writeDescriptorStructure } from './descriptor';

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

interface TextDescriptor {
	'Txt ': string;
	textGridding: string;
	Ornt: string;
	AntA: string;
	TextIndex: number;
	EngineData?: Uint8Array;
}

interface WarpDescriptor {
	warpStyle: string;
	warpValue: number;
	warpPerspective: number;
	warpPerspectiveOther: number;
	warpRotate: string;
}

interface Dict {
	[key: string]: string;
}

function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

// textGridding.None
const textGridding: Dict = {
	none: 'None',
};

const textGriddingRev = revMap(textGridding);

function toTextGridding(value: string): TextGridding {
	return (textGriddingRev[value.split('.')[1]] as any) || 'none';
}

function fromTextGridding(value: TextGridding | undefined) {
	return `textGridding.${textGridding[value!] || 'None'}`;
}

// Ornt.Hrzn | Ornt.Vrtc
const Ornt: Dict = {
	horizontal: 'Hrzn',
	vertical: 'Vrtc',
};

const OrntRev = revMap(Ornt);

function toOrientation(value: string): Orientation {
	return (OrntRev[value.split('.')[1]] as any) || 'horizontal';
}

function fromOrientation(value: Orientation | undefined) {
	return `textGridding.${Ornt[value!] || 'Hrzn'}`;
}

// Annt.antiAliasSharp | Annt.Anno | Annt.AnCr | Annt.AnSt | Annt.AnSm
const Annt: Dict = {
	none: 'Anno',
	sharp: 'antiAliasSharp',
	crisp: 'AnCr',
	strong: 'AnSt',
	smooth: 'AnSm',
};

const AnntRev = revMap(Annt);

function toAntialias(value: string): Antialias {
	return (AnntRev[value.split('.')[1]] as any) || 'none';
}

function fromAntialias(value: Antialias | undefined) {
	return `Annt.${Annt[value!] || 'Anno'}`;
}

// warpStyle.warpNone | warpStyle.warpArc | warpStyle.warpArcLower | warpStyle.warpArcUpper | warpStyle.warpArch
// warpStyle.warpBulge | warpStyle.warpShellLower | warpStyle.warpShellUpper | warpStyle.warpFlag
// warpStyle.warpWave | warpStyle.warpFish | warpStyle.warpRise | warpStyle.warpFisheye |
// warpStyle.warpInflate | warpStyle.warpSqueeze | warpStyle.warpTwist
const warpStyle: Dict = {
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
};

const warpStyleRev = revMap(warpStyle);

function toWarpStyle(value: string): WarpStyle {
	return (warpStyleRev[value.split('.')[1]] as any) || 'none';
}

function fromWarpStyle(value: WarpStyle | undefined) {
	return `warpStyle.${warpStyle[value!] || 'warpNone'}`;
}

addHandler(
	'TySh',
	target => target.text !== undefined,
	(reader, target) => {
		const version = readInt16(reader);

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

		const textVersion = readInt16(reader);
		const descriptorVersion = readInt32(reader);

		if (textVersion !== 50 || descriptorVersion !== 16) {
			throw new Error(`Invalid TySh text version: ${textVersion}/${descriptorVersion}`);
		}

		const text: TextDescriptor = readDescriptorStructure(reader);

		// console.log('EngineData:', JSON.stringify(parseEngineData(text.EngineData), null, 2), '\n');

		const warpVersion = readInt16(reader);
		const warpDescriptorVersion = readInt32(reader);

		if (warpVersion !== 1 || warpDescriptorVersion !== 16) {
			throw new Error(`Invalid TySh warp version: ${warpVersion} ${warpDescriptorVersion}`);
		}

		const warp: WarpDescriptor = readDescriptorStructure(reader);

		const left = readInt32(reader);
		const top = readInt32(reader);
		const right = readInt32(reader);
		const bottom = readInt32(reader);

		target.text = {
			transform, left, top, right, bottom,
			text: text['Txt '],
			index: text.TextIndex || 0,
			gridding: toTextGridding(text.textGridding),
			antialias: toAntialias(text.AntA),
			orientation: toOrientation(text.Ornt),
			warp: {
				style: toWarpStyle(warp.warpStyle),
				value: warp.warpValue || 0,
				perspective: warp.warpPerspective || 0,
				perspectiveOther: warp.warpPerspectiveOther || 0,
				rotate: toOrientation(warp.warpRotate),
			},
		};
	},
	(writer, target) => {
		const text = target.text!;
		const warp = text.warp || {};
		const transform = text.transform || [1, 0, 0, 1, 0, 0];

		const textDescriptor: TextDescriptor = {
			'Txt ': text.text,
			textGridding: fromTextGridding(text.gridding),
			Ornt: fromOrientation(text.orientation),
			AntA: fromAntialias(text.antialias),
			TextIndex: text.index || 0,
		};

		const warpDescriptor: WarpDescriptor = {
			warpStyle: fromWarpStyle(warp.style),
			warpValue: warp.value || 0,
			warpPerspective: warp.perspective || 0,
			warpPerspectiveOther: warp.perspectiveOther || 0,
			warpRotate: fromOrientation(warp.rotate),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i] || 0);
		}

		writeInt16(writer, 50); // text version
		writeInt32(writer, 16); // text descriptor version

		writeDescriptorStructure(writer, '', 'TxLr', textDescriptor);

		writeInt16(writer, 1); // warp version
		writeInt32(writer, 16); // warp descriptor version

		writeDescriptorStructure(writer, '', 'warp', warpDescriptor);

		writeInt32(writer, text.left || 0);
		writeInt32(writer, text.top || 0);
		writeInt32(writer, text.right || 0);
		writeInt32(writer, text.bottom || 0);
	},
);

addHandler(
	'luni',
	target => target.name !== undefined,
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
	target => target.nameSource !== undefined,
	(reader, target) => target.nameSource = readSignature(reader),
	(writer, target) => writeSignature(writer, target.nameSource!),
);

addHandler(
	'lyid',
	target => target.id !== undefined,
	(reader, target) => target.id = readUint32(reader),
	(writer, target) => writeUint32(writer, target.id!),
);

addHandler(
	'clbl',
	target => target.blendClippendElements !== undefined,
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
	target => target.blendInteriorElements !== undefined,
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
	target => target.knockout !== undefined,
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
	target => target.protected !== undefined,
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
	target => target.sheetColors !== undefined,
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
	'shmd',
	target => target.metadata !== undefined,
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
	'fxrp',
	target => target.referencePoint !== undefined,
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
	target => target.sectionDivider !== undefined,
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

			if (target.sectionDivider!.subtype !== undefined)
				writeUint32(writer, target.sectionDivider!.subtype!);
		}
	},
);

addHandler(
	'lyvr',
	target => target.version !== undefined,
	(reader, target) => {
		target.version = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.version!);
	},
);

addHandler(
	'lrFX',
	target => target.effects !== undefined,
	(reader, target, left) => {
		target.effects = readEffects(reader);
		skipBytes(reader, left()); // TEMP: skipping
	},
	(writer, target) => {
		writeEffects(writer, target.effects!);
	},
);

// addHandler(
// 	'Txt2',
// 	target => !!(target as any)['__Txt2'], // target.text !== undefined,
// 	(reader, target, left) => {
// 		const textEngineData = readBytes(reader, left());
// 		(target as any)['__Txt2'] = Array.from(textEngineData);
// 		console.log('Txt2:textEngineData', parseEngineData(textEngineData));
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, new Uint8Array((target as any)['__Txt2'])); // new Uint8Array(target.textEngineData!));
// 	},
// );

addHandler(
	'FMsk',
	target => target.filterMask !== undefined,
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

// TODO: implement
addHandler(
	'lfx2',
	target => !target, // target.objectBasedEffectsLayerInfo !== undefined,
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
