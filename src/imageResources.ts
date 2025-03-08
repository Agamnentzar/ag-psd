import { toByteArray } from 'base64-js';
import { BlendMode, ImageResources, RenderingIntent } from './psd';
import { PsdReader, readUnicodeString, readUint32, readUint16, readUint8, readFloat64, readBytes, skipBytes, readFloat32, readInt16, readFixedPoint32, readSignature, checkSignature, readSection, readColor, readInt32 } from './psdReader';
import { PsdWriter, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16, writeBytes, writeInt16, writeFloat32, writeFixedPoint32, writeUnicodeStringWithPadding, writeColor, writeSignature, writeSection, writeInt32, } from './psdWriter';
import { createCanvasFromData, createEnum, MOCK_HANDLERS } from './helpers';
import { decodeString, encodeString } from './utf8';
import { ESliceBGColorType, ESliceHorzAlign, ESliceOrigin, ESliceType, ESliceVertAlign, frac, FractionDescriptor, parseTrackList, readVersionAndDescriptor, serializeTrackList, TimelineTrackDescriptor, TimeScopeDescriptor, writeVersionAndDescriptor } from './descriptor';

export interface InternalImageResources extends ImageResources {
	layersGroup?: number[];
	layerGroupsEnabledId?: number[];
}

export interface ResourceHandler {
	key: number;
	has: (target: InternalImageResources) => boolean | number;
	read: (reader: PsdReader, target: InternalImageResources, left: () => number) => void;
	write: (writer: PsdWriter, target: InternalImageResources, index: number) => void;
}

export const resourceHandlers: ResourceHandler[] = [];
export const resourceHandlersMap: { [key: number]: ResourceHandler } = {};

function addHandler(
	key: number,
	has: (target: InternalImageResources) => boolean | number,
	read: (reader: PsdReader, target: InternalImageResources, left: () => number) => void,
	write: (writer: PsdWriter, target: InternalImageResources, index: number) => void,
) {
	const handler: ResourceHandler = { key, has, read, write };
	resourceHandlers.push(handler);
	resourceHandlersMap[handler.key] = handler;
}

const LOG_MOCK_HANDLERS = false;
const RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
const MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];
const hex = '0123456789abcdef';

function charToNibble(code: number) {
	return code <= 57 ? code - 48 : code - 87;
}

function byteAt(value: string, index: number) {
	return (charToNibble(value.charCodeAt(index)) << 4) | charToNibble(value.charCodeAt(index + 1));
}

function readUtf8String(reader: PsdReader, length: number) {
	const buffer = readBytes(reader, length);
	return decodeString(buffer);
}

function writeUtf8String(writer: PsdWriter, value: string) {
	const buffer = encodeString(value);
	writeBytes(writer, buffer);
}

function readEncodedString(reader: PsdReader) {
	const length = readUint8(reader);
	const buffer = readBytes(reader, length);

	let notAscii = false;
	for (let i = 0; i < buffer.byteLength; i++) {
		if (buffer[i] & 0x80) {
			notAscii = true;
			break;
		}
	}

	if (notAscii) {
		const decoder = new TextDecoder('gbk');
		return decoder.decode(buffer)
	} else {
		return decodeString(buffer);
	}
}

function writeEncodedString(writer: PsdWriter, value: string) {
	let ascii = '';

	for (let i = 0, code = value.codePointAt(i++); code !== undefined; code = value.codePointAt(i++)) {
		ascii += code > 0x7f ? '?' : String.fromCodePoint(code);
	}

	const buffer = encodeString(ascii);
	writeUint8(writer, buffer.byteLength);
	writeBytes(writer, buffer);
}

MOCK_HANDLERS && addHandler(
	1028, // IPTC-NAA record
	target => (target as any)._ir1028 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1028', left());
		(target as any)._ir1028 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1028);
	},
);

addHandler(
	1061,
	target => target.captionDigest !== undefined,
	(reader, target) => {
		let captionDigest = '';

		for (let i = 0; i < 16; i++) {
			const byte = readUint8(reader);
			captionDigest += hex[byte >> 4];
			captionDigest += hex[byte & 0xf];
		}

		target.captionDigest = captionDigest;
	},
	(writer, target) => {
		for (let i = 0; i < 16; i++) {
			writeUint8(writer, byteAt(target.captionDigest!, i * 2));
		}
	},
);

addHandler(
	1060,
	target => target.xmpMetadata !== undefined,
	(reader, target, left) => {
		target.xmpMetadata = readUtf8String(reader, left());
	},
	(writer, target) => {
		writeUtf8String(writer, target.xmpMetadata!);
	},
);

const Inte = createEnum<RenderingIntent>('Inte', 'perceptual', {
	'perceptual': 'Img ',
	'saturation': 'Grp ',
	'relative colorimetric': 'Clrm',
	'absolute colorimetric': 'AClr',
});

interface PrintInformationDescriptor {
	'Nm  '?: string;
	ClrS?: string;
	PstS?: boolean;
	MpBl?: boolean;
	Inte?: string;
	hardProof?: boolean;
	printSixteenBit?: boolean;
	printerName?: string;
	printProofSetup?: {
		Bltn: string;
	} | {
		profile: string;
		Inte: string;
		MpBl: boolean;
		paperWhite: boolean;
	};
}

addHandler(
	1082,
	target => target.printInformation !== undefined,
	(reader, target) => {
		const desc: PrintInformationDescriptor = readVersionAndDescriptor(reader);

		target.printInformation = {
			printerName: desc.printerName || '',
			renderingIntent: Inte.decode(desc.Inte ?? 'Inte.Img '),
		};

		const info = target.printInformation;

		if (desc.PstS !== undefined) info.printerManagesColors = desc.PstS;
		if (desc['Nm  '] !== undefined) info.printerProfile = desc['Nm  '];
		if (desc.MpBl !== undefined) info.blackPointCompensation = desc.MpBl;
		if (desc.printSixteenBit !== undefined) info.printSixteenBit = desc.printSixteenBit;
		if (desc.hardProof !== undefined) info.hardProof = desc.hardProof;
		if (desc.printProofSetup) {
			if ('Bltn' in desc.printProofSetup) {
				info.proofSetup = { builtin: desc.printProofSetup.Bltn.split('.')[1] };
			} else {
				info.proofSetup = {
					profile: desc.printProofSetup.profile,
					renderingIntent: Inte.decode(desc.printProofSetup.Inte ?? 'Inte.Img '),
					blackPointCompensation: !!desc.printProofSetup.MpBl,
					paperWhite: !!desc.printProofSetup.paperWhite,
				};
			}
		}
	},
	(writer, target) => {
		const info = target.printInformation!;
		const desc: PrintInformationDescriptor = {};

		if (info.printerManagesColors) {
			desc.PstS = true;
		} else {
			if (info.hardProof !== undefined) desc.hardProof = !!info.hardProof;
			desc.ClrS = 'ClrS.RGBC'; // TODO: ???
			desc['Nm  '] = info.printerProfile ?? 'CIE RGB';
		}

		desc.Inte = Inte.encode(info.renderingIntent);

		if (!info.printerManagesColors) desc.MpBl = !!info.blackPointCompensation;

		desc.printSixteenBit = !!info.printSixteenBit;
		desc.printerName = info.printerName || '';

		if (info.proofSetup && 'profile' in info.proofSetup) {
			desc.printProofSetup = {
				profile: info.proofSetup.profile || '',
				Inte: Inte.encode(info.proofSetup.renderingIntent),
				MpBl: !!info.proofSetup.blackPointCompensation,
				paperWhite: !!info.proofSetup.paperWhite,
			};
		} else {
			desc.printProofSetup = {
				Bltn: info.proofSetup?.builtin ? `builtinProof.${info.proofSetup.builtin}` : 'builtinProof.proofCMYK',
			};
		}

		writeVersionAndDescriptor(writer, '', 'printOutput', desc);
	},
);

MOCK_HANDLERS && addHandler(
	1083, // Print style
	target => (target as any)._ir1083 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1083', left());
		(target as any)._ir1083 = readBytes(reader, left());

		// TODO:
		// const desc = readVersionAndDescriptor(reader);
		// console.log('1083', require('util').inspect(desc, false, 99, true));
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1083);
	},
);

addHandler(
	1005,
	target => target.resolutionInfo !== undefined,
	(reader, target) => {
		const horizontalResolution = readFixedPoint32(reader);
		const horizontalResolutionUnit = readUint16(reader);
		const widthUnit = readUint16(reader);
		const verticalResolution = readFixedPoint32(reader);
		const verticalResolutionUnit = readUint16(reader);
		const heightUnit = readUint16(reader);

		target.resolutionInfo = {
			horizontalResolution,
			horizontalResolutionUnit: RESOLUTION_UNITS[horizontalResolutionUnit] || 'PPI' as any,
			widthUnit: MEASUREMENT_UNITS[widthUnit] || 'Inches' as any,
			verticalResolution,
			verticalResolutionUnit: RESOLUTION_UNITS[verticalResolutionUnit] || 'PPI' as any,
			heightUnit: MEASUREMENT_UNITS[heightUnit] || 'Inches' as any,
		};
	},
	(writer, target) => {
		const info = target.resolutionInfo!;

		writeFixedPoint32(writer, info.horizontalResolution || 0);
		writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
		writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
		writeFixedPoint32(writer, info.verticalResolution || 0);
		writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
		writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
	},
);

const printScaleStyles = ['centered', 'size to fit', 'user defined'];

addHandler(
	1062,
	target => target.printScale !== undefined,
	(reader, target) => {
		target.printScale = {
			style: printScaleStyles[readInt16(reader)] as any,
			x: readFloat32(reader),
			y: readFloat32(reader),
			scale: readFloat32(reader),
		};
	},
	(writer, target) => {
		const { style, x, y, scale } = target.printScale!;
		writeInt16(writer, Math.max(0, printScaleStyles.indexOf(style!)));
		writeFloat32(writer, x || 0);
		writeFloat32(writer, y || 0);
		writeFloat32(writer, scale || 0);
	},
);

addHandler(
	1006,
	target => target.alphaChannelNames !== undefined,
	(reader, target, left) => {
		if (!target.alphaChannelNames) { // skip if the unicode versions are already read
			target.alphaChannelNames = [];

			while (left() > 0) {
				const value = readEncodedString(reader);
				// const value = readPascalString(reader, 1);
				target.alphaChannelNames.push(value);
			}
		} else {
			skipBytes(reader, left());
		}
	},
	(writer, target) => {
		for (const name of target.alphaChannelNames!) {
			writeEncodedString(writer, name);
			// writePascalString(writer, name, 1);
		}
	},
);

addHandler(
	1045,
	target => target.alphaChannelNames !== undefined,
	(reader, target, left) => {
		target.alphaChannelNames = [];

		while (left() > 0) {
			target.alphaChannelNames.push(readUnicodeString(reader));
		}
	},
	(writer, target) => {
		for (const name of target.alphaChannelNames!) {
			writeUnicodeStringWithPadding(writer, name);
		}
	},
);

MOCK_HANDLERS && addHandler(
	1077,
	target => (target as any)._ir1077 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1077', left());
		(target as any)._ir1077 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1077);
	},
);

addHandler(
	1053,
	target => target.alphaIdentifiers !== undefined,
	(reader, target, left) => {
		target.alphaIdentifiers = [];

		while (left() >= 4) {
			target.alphaIdentifiers.push(readUint32(reader));
		}
	},
	(writer, target) => {
		for (const id of target.alphaIdentifiers!) {
			writeUint32(writer, id);
		}
	},
);

addHandler(
	1010,
	target => target.backgroundColor !== undefined,
	(reader, target) => target.backgroundColor = readColor(reader),
	(writer, target) => writeColor(writer, target.backgroundColor!),
);

addHandler(
	1037,
	target => target.globalAngle !== undefined,
	(reader, target) => target.globalAngle = readInt32(reader),
	(writer, target) => writeInt32(writer, target.globalAngle!),
);

addHandler(
	1049,
	target => target.globalAltitude !== undefined,
	(reader, target) => target.globalAltitude = readUint32(reader),
	(writer, target) => writeUint32(writer, target.globalAltitude!),
);

addHandler(
	1011,
	target => target.printFlags !== undefined,
	(reader, target) => {
		target.printFlags = {
			labels: !!readUint8(reader),
			cropMarks: !!readUint8(reader),
			colorBars: !!readUint8(reader),
			registrationMarks: !!readUint8(reader),
			negative: !!readUint8(reader),
			flip: !!readUint8(reader),
			interpolate: !!readUint8(reader),
			caption: !!readUint8(reader),
			printFlags: !!readUint8(reader),
		};
	},
	(writer, target) => {
		const flags = target.printFlags!;
		writeUint8(writer, flags.labels ? 1 : 0);
		writeUint8(writer, flags.cropMarks ? 1 : 0);
		writeUint8(writer, flags.colorBars ? 1 : 0);
		writeUint8(writer, flags.registrationMarks ? 1 : 0);
		writeUint8(writer, flags.negative ? 1 : 0);
		writeUint8(writer, flags.flip ? 1 : 0);
		writeUint8(writer, flags.interpolate ? 1 : 0);
		writeUint8(writer, flags.caption ? 1 : 0);
		writeUint8(writer, flags.printFlags ? 1 : 0);
	},
);

MOCK_HANDLERS && addHandler(
	10000, // Print flags
	target => (target as any)._ir10000 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 10000', left());
		(target as any)._ir10000 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir10000);
	},
);

MOCK_HANDLERS && addHandler(
	1013, // Color halftoning
	target => (target as any)._ir1013 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1013', left());
		(target as any)._ir1013 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1013);
	},
);

MOCK_HANDLERS && addHandler(
	1016, // Color transfer functions
	target => (target as any)._ir1016 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1016', left());
		(target as any)._ir1016 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1016);
	},
);

interface CountInformationDesc {
	Vrsn: 1;
	countGroupList: {
		'Rd  ': number; // 0-255
		'Grn ': number;
		'Bl  ': number;
		'Nm  ': string;
		'Rds ': number; // Marker size
		fontSize: number;
		Vsbl: boolean;
		countObjectList: {
			'X   ': number;
			'Y   ': number;
		}[];
	}[];
}

addHandler(
	1080, // Count Information
	target => target.countInformation !== undefined,
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader) as CountInformationDesc;
		target.countInformation = desc.countGroupList.map(g => ({
			color: { r: g['Rd  '], g: g['Grn '], b: g['Bl  '] },
			name: g['Nm  '],
			size: g['Rds '],
			fontSize: g.fontSize,
			visible: g.Vsbl,
			points: g.countObjectList.map(p => ({ x: p['X   '], y: p['Y   '] })),
		}));
	},
	(writer, target) => {
		const desc: CountInformationDesc = {
			Vrsn: 1,
			countGroupList: target.countInformation!.map(g => ({
				'Rd  ': g.color.r,
				'Grn ': g.color.g,
				'Bl  ': g.color.b,
				'Nm  ': g.name,
				'Rds ': g.size,
				fontSize: g.fontSize,
				Vsbl: g.visible,
				countObjectList: g.points.map(p => ({ 'X   ': p.x, 'Y   ': p.y })),
			})),
		};
		writeVersionAndDescriptor(writer, '', 'Cnt ', desc);
	},
);

addHandler(
	1024,
	target => target.layerState !== undefined,
	(reader, target) => target.layerState = readUint16(reader),
	(writer, target) => writeUint16(writer, target.layerState!),
);

addHandler(
	1026,
	target => target.layersGroup !== undefined,
	(reader, target, left) => {
		target.layersGroup = [];

		while (left() > 0) {
			target.layersGroup.push(readUint16(reader));
		}
	},
	(writer, target) => {
		for (const g of target.layersGroup!) {
			writeUint16(writer, g);
		}
	},
);

addHandler(
	1072,
	target => target.layerGroupsEnabledId !== undefined,
	(reader, target, left) => {
		target.layerGroupsEnabledId = [];

		while (left() > 0) {
			target.layerGroupsEnabledId.push(readUint8(reader));
		}
	},
	(writer, target) => {
		for (const id of target.layerGroupsEnabledId!) {
			writeUint8(writer, id);
		}
	},
);

addHandler(
	1069,
	target => target.layerSelectionIds !== undefined,
	(reader, target) => {
		let count = readUint16(reader);
		target.layerSelectionIds = [];

		while (count--) {
			target.layerSelectionIds.push(readUint32(reader));
		}
	},
	(writer, target) => {
		writeUint16(writer, target.layerSelectionIds!.length);

		for (const id of target.layerSelectionIds!) {
			writeUint32(writer, id);
		}
	},
);

addHandler(
	1032,
	target => target.gridAndGuidesInformation !== undefined,
	(reader, target) => {
		const version = readUint32(reader);
		const horizontal = readUint32(reader);
		const vertical = readUint32(reader);
		const count = readUint32(reader);

		if (version !== 1) throw new Error(`Invalid 1032 resource version: ${version}`);

		target.gridAndGuidesInformation = {
			grid: { horizontal, vertical },
			guides: [],
		};

		for (let i = 0; i < count; i++) {
			target.gridAndGuidesInformation.guides!.push({
				location: readUint32(reader) / 32,
				direction: readUint8(reader) ? 'horizontal' : 'vertical'
			});
		}
	},
	(writer, target) => {
		const info = target.gridAndGuidesInformation!;
		const grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
		const guides = info.guides || [];

		writeUint32(writer, 1);
		writeUint32(writer, grid.horizontal);
		writeUint32(writer, grid.vertical);
		writeUint32(writer, guides.length);

		for (const g of guides) {
			writeUint32(writer, g.location * 32);
			writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
		}
	},
);

interface LayerCompsDescriptor {
	list: {
		_classID: 'Comp';
		'Nm  ': string;
		compID: number;
		capturedInfo: number;
		comment?: string;
	}[];
	lastAppliedComp?: number;
}

addHandler(
	1065, // Layer Comps
	target => target.layerComps !== undefined,
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader, true) as LayerCompsDescriptor;
		// console.log('CompList', require('util').inspect(desc, false, 99, true));

		target.layerComps = { list: [] };

		for (const item of desc.list) {
			target.layerComps.list.push({
				id: item.compID,
				name: item['Nm  '],
				capturedInfo: item.capturedInfo,
			});

			if ('comment' in item) target.layerComps.list[target.layerComps.list.length - 1].comment = item.comment;
		}

		if ('lastAppliedComp' in desc) target.layerComps.lastApplied = desc.lastAppliedComp;
	},
	(writer, target) => {
		const layerComps = target.layerComps!;
		const desc: LayerCompsDescriptor = { list: [] };

		for (const item of layerComps.list) {
			const t: LayerCompsDescriptor['list'][0] = {} as any;
			t._classID = 'Comp';
			t['Nm  '] = item.name;
			if ('comment' in item) t.comment = item.comment;
			t.compID = item.id;
			t.capturedInfo = item.capturedInfo;
			desc.list.push(t);
		}

		if ('lastApplied' in layerComps) desc.lastAppliedComp = layerComps.lastApplied;

		// console.log('CompList', require('util').inspect(desc, false, 99, true));
		writeVersionAndDescriptor(writer, '', 'CompList', desc);
	},
);

MOCK_HANDLERS && addHandler(
	1092, // ???
	target => (target as any)._ir1092 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1092', left());
		// 16 bytes, seems to be 4 integers
		(target as any)._ir1092 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1092);
	},
);

interface OnionSkinsDescriptor {
	Vrsn: 1;
	enab: boolean;
	numBefore: number;
	numAfter: number;
	Spcn: number;
	minOpacity: number;
	maxOpacity: number;
	BlnM: number;
}

// 0 - normal, 7 - multiply, 8 - screen, 23 - difference
const onionSkinsBlendModes: (BlendMode | undefined)[] = [
	'normal', undefined, undefined, undefined, undefined, undefined, undefined, 'multiply',
	'screen', undefined, undefined, undefined, undefined, undefined, undefined, undefined,
	undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'difference',
];

addHandler(
	1078, // Onion Skins
	target => target.onionSkins !== undefined,
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader) as OnionSkinsDescriptor;
		// console.log('1078', require('util').inspect(desc, false, 99, true));

		target.onionSkins = {
			enabled: desc.enab,
			framesBefore: desc.numBefore,
			framesAfter: desc.numAfter,
			frameSpacing: desc.Spcn,
			minOpacity: desc.minOpacity / 100,
			maxOpacity: desc.maxOpacity / 100,
			blendMode: onionSkinsBlendModes[desc.BlnM] || 'normal',
		};
	},
	(writer, target) => {
		const onionSkins = target.onionSkins!;
		const desc: OnionSkinsDescriptor = {
			Vrsn: 1,
			enab: onionSkins.enabled,
			numBefore: onionSkins.framesBefore,
			numAfter: onionSkins.framesAfter,
			Spcn: onionSkins.frameSpacing,
			minOpacity: (onionSkins.minOpacity * 100) | 0,
			maxOpacity: (onionSkins.maxOpacity * 100) | 0,
			BlnM: Math.max(0, onionSkinsBlendModes.indexOf(onionSkins.blendMode)),
		};

		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

interface TimelineAudioClipDescriptor {
	clipID: string;
	timeScope: TimeScopeDescriptor;
	frameReader: {
		frameReaderType: number;
		descVersion: 1;
		'Lnk ': {
			descVersion: 1;
			'Nm  ': string;
			fullPath: string;
			relPath: string;
		},
		mediaDescriptor: string;
	},
	muted: boolean;
	audioLevel: number;
}

interface TimelineAudioClipGroupDescriptor {
	groupID: string;
	muted: boolean;
	audioClipList: TimelineAudioClipDescriptor[];
}

interface TimelineInformationDescriptor {
	Vrsn: 1;
	enab: boolean;
	frameStep: FractionDescriptor;
	frameRate: number;
	time: FractionDescriptor;
	duration: FractionDescriptor;
	workInTime: FractionDescriptor;
	workOutTime: FractionDescriptor;
	LCnt: number;
	globalTrackList: TimelineTrackDescriptor[];
	audioClipGroupList?: {
		audioClipGroupList?: TimelineAudioClipGroupDescriptor[];
	},
	hasMotion: boolean;
}

addHandler(
	1075, // Timeline Information
	target => target.timelineInformation !== undefined,
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader) as TimelineInformationDescriptor;

		target.timelineInformation = {
			enabled: desc.enab,
			frameStep: frac(desc.frameStep),
			frameRate: desc.frameRate,
			time: frac(desc.time),
			duration: frac(desc.duration),
			workInTime: frac(desc.workInTime),
			workOutTime: frac(desc.workOutTime),
			repeats: desc.LCnt,
			hasMotion: desc.hasMotion,
			globalTracks: parseTrackList(desc.globalTrackList, !!reader.logMissingFeatures),
		};

		if (desc.audioClipGroupList?.audioClipGroupList?.length) {
			target.timelineInformation.audioClipGroups = desc.audioClipGroupList.audioClipGroupList.map(g => ({
				id: g.groupID,
				muted: g.muted,
				audioClips: g.audioClipList.map(({ clipID, timeScope, muted, audioLevel, frameReader }) => ({
					id: clipID,
					start: frac(timeScope.Strt),
					duration: frac(timeScope.duration),
					inTime: frac(timeScope.inTime),
					outTime: frac(timeScope.outTime),
					muted: muted,
					audioLevel: audioLevel,
					frameReader: {
						type: frameReader.frameReaderType,
						mediaDescriptor: frameReader.mediaDescriptor,
						link: {
							name: frameReader['Lnk ']['Nm  '],
							fullPath: frameReader['Lnk '].fullPath,
							relativePath: frameReader['Lnk '].relPath,
						},
					},
				})),
			}));
		}
	},
	(writer, target) => {
		const timeline = target.timelineInformation!;
		const desc: TimelineInformationDescriptor = {
			Vrsn: 1,
			enab: timeline.enabled,
			frameStep: timeline.frameStep,
			frameRate: timeline.frameRate,
			time: timeline.time,
			duration: timeline.duration,
			workInTime: timeline.workInTime,
			workOutTime: timeline.workOutTime,
			LCnt: timeline.repeats,
			globalTrackList: serializeTrackList(timeline.globalTracks),
			audioClipGroupList: {
				audioClipGroupList: timeline.audioClipGroups?.map(a => ({
					groupID: a.id,
					muted: a.muted,
					audioClipList: a.audioClips.map<TimelineAudioClipDescriptor>(c => ({
						clipID: c.id,
						timeScope: {
							Vrsn: 1,
							Strt: c.start,
							duration: c.duration,
							inTime: c.inTime,
							outTime: c.outTime,
						},
						frameReader: {
							frameReaderType: c.frameReader.type,
							descVersion: 1,
							'Lnk ': {
								descVersion: 1,
								'Nm  ': c.frameReader.link.name,
								fullPath: c.frameReader.link.fullPath,
								relPath: c.frameReader.link.relativePath,
							},
							mediaDescriptor: c.frameReader.mediaDescriptor,
						},
						muted: c.muted,
						audioLevel: c.audioLevel,
					})),
				})),
			},
			hasMotion: timeline.hasMotion,
		};

		writeVersionAndDescriptor(writer, '', 'null', desc, 'anim');
	},
);

interface SheetDisclosureDescriptor {
	Vrsn: 1;
	sheetTimelineOptions?: {
		Vrsn: 2;
		sheetID: number;
		sheetDisclosed: boolean;
		lightsDisclosed: boolean;
		meshesDisclosed: boolean;
		materialsDisclosed: boolean;
	}[];
}

addHandler(
	1076, // Sheet Disclosure
	target => target.sheetDisclosure !== undefined,
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader) as SheetDisclosureDescriptor;

		target.sheetDisclosure = {};

		if (desc.sheetTimelineOptions) {
			target.sheetDisclosure.sheetTimelineOptions = desc.sheetTimelineOptions.map(o => ({
				sheetID: o.sheetID,
				sheetDisclosed: o.sheetDisclosed,
				lightsDisclosed: o.lightsDisclosed,
				meshesDisclosed: o.meshesDisclosed,
				materialsDisclosed: o.materialsDisclosed,
			}));
		}
	},
	(writer, target) => {
		const disclosure = target.sheetDisclosure!;
		const desc: SheetDisclosureDescriptor = { Vrsn: 1 };

		if (disclosure.sheetTimelineOptions) {
			desc.sheetTimelineOptions = disclosure.sheetTimelineOptions.map(d => ({
				Vrsn: 2,
				sheetID: d.sheetID,
				sheetDisclosed: d.sheetDisclosed,
				lightsDisclosed: d.lightsDisclosed,
				meshesDisclosed: d.meshesDisclosed,
				materialsDisclosed: d.materialsDisclosed,
			}));
		}

		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

addHandler(
	1054, // URL List
	target => target.urlsList !== undefined,
	(reader, target) => {
		const count = readUint32(reader);
		target.urlsList = [];

		for (let i = 0; i < count; i++) {
			const long = readSignature(reader);
			if (long !== 'slic' && reader.throwForMissingFeatures) throw new Error('Unknown long');
			const id = readUint32(reader);
			const url = readUnicodeString(reader);
			target.urlsList.push({ id, url, ref: 'slice' });
		}
	},
	(writer, target) => {
		const list = target.urlsList!;
		writeUint32(writer, list.length);

		for (let i = 0; i < list.length; i++) {
			writeSignature(writer, 'slic');
			writeUint32(writer, list[i].id);
			writeUnicodeString(writer, list[i].url);
		}
	},
);

interface BoundsDesc {
	'Top ': number;
	Left: number;
	Btom: number;
	Rght: number;
}

interface SlicesSliceDesc {
	sliceID: number;
	groupID: number;
	origin: string;
	'Nm  '?: string;
	Type: string;
	bounds: BoundsDesc;
	url: string;
	null: string;
	Msge: string;
	altTag: string;
	cellTextIsHTML: boolean;
	cellText: string;
	horzAlign: string;
	vertAlign: string;
	bgColorType: string;
	bgColor?: { 'Rd  ': number; 'Grn ': number; 'Bl  ': number; alpha: number; };
	topOutset?: number;
	leftOutset?: number;
	bottomOutset?: number;
	rightOutset?: number;
}

interface SlicesDesc {
	bounds: BoundsDesc;
	slices: SlicesSliceDesc[];
}

interface SlicesDesc7 extends SlicesDesc {
	baseName: string;
}

function boundsToBounds(bounds: { left: number; top: number; right: number; bottom: number }): BoundsDesc {
	return { 'Top ': bounds.top, Left: bounds.left, Btom: bounds.bottom, Rght: bounds.right };
}

function boundsFromBounds(bounds: BoundsDesc): { left: number; top: number; right: number; bottom: number } {
	return { top: bounds['Top '], left: bounds.Left, bottom: bounds.Btom, right: bounds.Rght };
}

function clamped<T>(array: T[], index: number) {
	return array[Math.max(0, Math.min(array.length - 1, index))];
}

const sliceOrigins: ('userGenerated' | 'autoGenerated' | 'layer')[] = ['autoGenerated', 'layer', 'userGenerated'];
const sliceTypes: ('image' | 'noImage')[] = ['noImage', 'image'];
const sliceAlignments: ('default')[] = ['default'];

addHandler(
	1050, // Slices
	target => target.slices ? target.slices.length : 0,
	(reader, target) => {
		const version = readUint32(reader);

		if (version === 6) {
			if (!target.slices) target.slices = [];

			const top = readInt32(reader);
			const left = readInt32(reader);
			const bottom = readInt32(reader);
			const right = readInt32(reader);
			const groupName = readUnicodeString(reader);
			const count = readUint32(reader);
			target.slices.push({ bounds: { top, left, bottom, right }, groupName, slices: [] });
			const slices = target.slices[target.slices.length - 1].slices;

			for (let i = 0; i < count; i++) {
				const id = readUint32(reader);
				const groupId = readUint32(reader);
				const origin = clamped(sliceOrigins, readUint32(reader));
				const associatedLayerId = origin == 'layer' ? readUint32(reader) : 0;
				const name = readUnicodeString(reader);
				const type = clamped(sliceTypes, readUint32(reader));
				const left = readInt32(reader);
				const top = readInt32(reader);
				const right = readInt32(reader);
				const bottom = readInt32(reader);
				const url = readUnicodeString(reader);
				const target = readUnicodeString(reader);
				const message = readUnicodeString(reader);
				const altTag = readUnicodeString(reader);
				const cellTextIsHTML = !!readUint8(reader);
				const cellText = readUnicodeString(reader);
				const horizontalAlignment = clamped(sliceAlignments, readUint32(reader));
				const verticalAlignment = clamped(sliceAlignments, readUint32(reader));
				const a = readUint8(reader);
				const r = readUint8(reader);
				const g = readUint8(reader);
				const b = readUint8(reader);
				const backgroundColorType = ((a + r + g + b) === 0) ? 'none' : (a === 0 ? 'matte' : 'color');
				slices.push({
					id, groupId, origin, associatedLayerId, name, target, message, altTag, cellTextIsHTML, cellText,
					horizontalAlignment, verticalAlignment, type, url,
					bounds: { top, left, bottom, right },
					backgroundColorType, backgroundColor: { r, g, b, a },
				});
			}
			const desc = readVersionAndDescriptor(reader) as SlicesDesc;
			desc.slices.forEach(d => {
				const slice = slices.find(s => d.sliceID == s.id);
				if (slice) {
					slice.topOutset = d.topOutset;
					slice.leftOutset = d.leftOutset;
					slice.bottomOutset = d.bottomOutset;
					slice.rightOutset = d.rightOutset;
				}
			});
		} else if (version === 7 || version === 8) {
			const desc = readVersionAndDescriptor(reader) as SlicesDesc7;

			if (!target.slices) target.slices = [];
			target.slices.push({
				groupName: desc.baseName,
				bounds: boundsFromBounds(desc.bounds),
				slices: desc.slices.map(s => ({
					...(s['Nm  '] ? { name: s['Nm  '] } : {}),
					id: s.sliceID,
					groupId: s.groupID,
					associatedLayerId: 0,
					origin: ESliceOrigin.decode(s.origin),
					type: ESliceType.decode(s.Type),
					bounds: boundsFromBounds(s.bounds),
					url: s.url,
					target: s.null,
					message: s.Msge,
					altTag: s.altTag,
					cellTextIsHTML: s.cellTextIsHTML,
					cellText: s.cellText,
					horizontalAlignment: ESliceHorzAlign.decode(s.horzAlign),
					verticalAlignment: ESliceVertAlign.decode(s.vertAlign),
					backgroundColorType: ESliceBGColorType.decode(s.bgColorType),
					backgroundColor: s.bgColor ? { r: s.bgColor['Rd  '], g: s.bgColor['Grn '], b: s.bgColor['Bl  '], a: s.bgColor.alpha } : { r: 0, g: 0, b: 0, a: 0 },
					topOutset: s.topOutset || 0,
					leftOutset: s.leftOutset || 0,
					bottomOutset: s.bottomOutset || 0,
					rightOutset: s.rightOutset || 0,
				})),
			});
		} else {
			throw new Error(`Invalid slices version (${version})`);
		}
	},
	(writer, target, index) => {
		const { bounds, groupName, slices } = target.slices![index];

		writeUint32(writer, 6); // version
		writeInt32(writer, bounds.top);
		writeInt32(writer, bounds.left);
		writeInt32(writer, bounds.bottom);
		writeInt32(writer, bounds.right);
		writeUnicodeString(writer, groupName);
		writeUint32(writer, slices.length);

		for (let i = 0; i < slices.length; i++) {
			const slice = slices[i];
			let { a, r, g, b } = slice.backgroundColor;

			if (slice.backgroundColorType === 'none') {
				a = r = g = b = 0;
			} else if (slice.backgroundColorType === 'matte') {
				a = 0;
				r = g = b = 255;
			}

			writeUint32(writer, slice.id);
			writeUint32(writer, slice.groupId);
			writeUint32(writer, sliceOrigins.indexOf(slice.origin));
			if (slice.origin === 'layer') writeUint32(writer, slice.associatedLayerId);
			writeUnicodeString(writer, slice.name || '');
			writeUint32(writer, sliceTypes.indexOf(slice.type));
			writeInt32(writer, slice.bounds.left);
			writeInt32(writer, slice.bounds.top);
			writeInt32(writer, slice.bounds.right);
			writeInt32(writer, slice.bounds.bottom);
			writeUnicodeString(writer, slice.url);
			writeUnicodeString(writer, slice.target);
			writeUnicodeString(writer, slice.message);
			writeUnicodeString(writer, slice.altTag);
			writeUint8(writer, slice.cellTextIsHTML ? 1 : 0);
			writeUnicodeString(writer, slice.cellText);
			writeUint32(writer, sliceAlignments.indexOf(slice.horizontalAlignment));
			writeUint32(writer, sliceAlignments.indexOf(slice.verticalAlignment));
			writeUint8(writer, a);
			writeUint8(writer, r);
			writeUint8(writer, g);
			writeUint8(writer, b);
		}

		const desc: SlicesDesc = {
			bounds: boundsToBounds(bounds),
			slices: [],
		};

		slices.forEach(s => {
			const slice: SlicesSliceDesc = {
				sliceID: s.id,
				groupID: s.groupId,
				origin: ESliceOrigin.encode(s.origin),
				Type: ESliceType.encode(s.type),
				bounds: boundsToBounds(s.bounds),
				...(s.name ? { 'Nm  ': s.name } : {}),
				url: s.url,
				null: s.target,
				Msge: s.message,
				altTag: s.altTag,
				cellTextIsHTML: s.cellTextIsHTML,
				cellText: s.cellText,
				horzAlign: ESliceHorzAlign.encode(s.horizontalAlignment),
				vertAlign: ESliceVertAlign.encode(s.verticalAlignment),
				bgColorType: ESliceBGColorType.encode(s.backgroundColorType),
			};

			if (s.backgroundColorType === 'color') {
				const { r, g, b, a } = s.backgroundColor;
				slice.bgColor = { 'Rd  ': r, 'Grn ': g, 'Bl  ': b, alpha: a };
			}

			slice.topOutset = s.topOutset || 0;
			slice.leftOutset = s.leftOutset || 0;
			slice.bottomOutset = s.bottomOutset || 0;
			slice.rightOutset = s.rightOutset || 0;
			desc.slices.push(slice);
		});

		writeVersionAndDescriptor(writer, '', 'null', desc, 'slices');
	},
);

addHandler(
	1064,
	target => target.pixelAspectRatio !== undefined,
	(reader, target) => {
		if (readUint32(reader) > 2) throw new Error('Invalid pixelAspectRatio version');
		target.pixelAspectRatio = { aspect: readFloat64(reader) };
	},
	(writer, target) => {
		writeUint32(writer, 2); // version
		writeFloat64(writer, target.pixelAspectRatio!.aspect);
	},
);

addHandler(
	1041,
	target => target.iccUntaggedProfile !== undefined,
	(reader, target) => {
		target.iccUntaggedProfile = !!readUint8(reader);
	},
	(writer, target) => {
		writeUint8(writer, target.iccUntaggedProfile ? 1 : 0);
	},
);

MOCK_HANDLERS && addHandler(
	1039, // ICC Profile
	target => (target as any)._ir1039 !== undefined,
	(reader, target, left) => {
		// TODO: this is raw bytes, just return as a byte array
		LOG_MOCK_HANDLERS && console.log('image resource 1039', left());
		(target as any)._ir1039 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1039);
	},
);

addHandler(
	1044,
	target => target.idsSeedNumber !== undefined,
	(reader, target) => target.idsSeedNumber = readUint32(reader),
	(writer, target) => writeUint32(writer, target.idsSeedNumber!),
);

addHandler(
	1036,
	target => target.thumbnail !== undefined || target.thumbnailRaw !== undefined,
	(reader, target, left) => {
		const format = readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
		const width = readUint32(reader);
		const height = readUint32(reader);
		readUint32(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
		readUint32(reader); // totalSize = widthBytes * height * planes
		readUint32(reader); // sizeAfterCompression
		const bitsPerPixel = readUint16(reader); // 24
		const planes = readUint16(reader); // 1

		if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
			reader.logMissingFeatures && reader.log(`Invalid thumbnail data (format: ${format}, bitsPerPixel: ${bitsPerPixel}, planes: ${planes})`);
			skipBytes(reader, left());
			return;
		}

		const size = left();
		const data = readBytes(reader, size);

		if (reader.useRawThumbnail) {
			target.thumbnailRaw = { width, height, data };
		} else if (data.byteLength) {
			target.thumbnail = createCanvasFromData(data);
		}
	},
	(writer, target) => {
		let width = 0;
		let height = 0;
		let data = new Uint8Array(0);

		if (target.thumbnailRaw) {
			width = target.thumbnailRaw.width;
			height = target.thumbnailRaw.height;
			data = target.thumbnailRaw.data;
		} else {
			try {
				const dataUrl = target.thumbnail!.toDataURL('image/jpeg', 1)?.substring('data:image/jpeg;base64,'.length);

				if (dataUrl) {
					data = toByteArray(dataUrl); // this sometimes fails for some reason, maybe some browser bugs
					width = target.thumbnail!.width;
					height = target.thumbnail!.height;
				}
			} catch { }
		}

		const bitsPerPixel = 24;
		const widthBytes = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
		const planes = 1;
		const totalSize = widthBytes * height * planes;
		const sizeAfterCompression = data.length;

		writeUint32(writer, 1); // 1 = kJpegRGB
		writeUint32(writer, width);
		writeUint32(writer, height);
		writeUint32(writer, widthBytes);
		writeUint32(writer, totalSize);
		writeUint32(writer, sizeAfterCompression);
		writeUint16(writer, bitsPerPixel);
		writeUint16(writer, planes);
		writeBytes(writer, data);
	},
);

addHandler(
	1057,
	target => target.versionInfo !== undefined,
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 1) throw new Error('Invalid versionInfo version');

		target.versionInfo = {
			hasRealMergedData: !!readUint8(reader),
			writerName: readUnicodeString(reader),
			readerName: readUnicodeString(reader),
			fileVersion: readUint32(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const versionInfo = target.versionInfo!;
		writeUint32(writer, 1); // version
		writeUint8(writer, versionInfo.hasRealMergedData ? 1 : 0);
		writeUnicodeString(writer, versionInfo.writerName);
		writeUnicodeString(writer, versionInfo.readerName);
		writeUint32(writer, versionInfo.fileVersion);
	},
);

MOCK_HANDLERS && addHandler(
	1058, // EXIF data 1.
	target => (target as any)._ir1058 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1058', left());
		(target as any)._ir1058 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1058);
	},
);

addHandler(
	7000,
	target => target.imageReadyVariables !== undefined,
	(reader, target, left) => {
		target.imageReadyVariables = readUtf8String(reader, left());
	},
	(writer, target) => {
		writeUtf8String(writer, target.imageReadyVariables!);
	},
);

addHandler(
	7001,
	target => target.imageReadyDataSets !== undefined,
	(reader, target, left) => {
		target.imageReadyDataSets = readUtf8String(reader, left());
	},
	(writer, target) => {
		writeUtf8String(writer, target.imageReadyDataSets!);
	},
);

interface Descriptor1088 {
	'null': string[];
}

addHandler(
	1088,
	target => target.pathSelectionState !== undefined,
	(reader, target, _left) => {
		const desc: Descriptor1088 = readVersionAndDescriptor(reader);
		target.pathSelectionState = desc['null'];
	},
	(writer, target) => {
		const desc: Descriptor1088 = { 'null': target.pathSelectionState! };
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

MOCK_HANDLERS && addHandler(
	1025,
	target => (target as any)._ir1025 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1025', left());
		(target as any)._ir1025 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1025);
	},
);

const FrmD = createEnum<'auto' | 'none' | 'dispose'>('FrmD', '', {
	auto: 'Auto',
	none: 'None',
	dispose: 'Disp',
});

interface AnimationFrameDescriptor {
	FrID: number;
	FrDl?: number;
	FrDs: string;
	FrGA?: number;
}

interface AnimationDescriptor {
	FsID: number;
	AFrm?: number;
	FsFr: number[];
	LCnt: number;
}

interface AnimationsDescriptor {
	AFSt?: number;
	FrIn: AnimationFrameDescriptor[];
	FSts: AnimationDescriptor[];
}

addHandler(
	4000, // Plug-In resource(s)
	target => target.animations !== undefined,
	(reader, target, left) => {
		const key = readSignature(reader);

		if (key === 'mani') {
			checkSignature(reader, 'IRFR');
			readSection(reader, 1, left => {
				while (left() > 0) {
					checkSignature(reader, '8BIM');
					const key = readSignature(reader);

					readSection(reader, 1, left => {
						if (key === 'AnDs') {
							const desc = readVersionAndDescriptor(reader) as AnimationsDescriptor;
							target.animations = {
								// desc.AFSt ???
								frames: desc.FrIn.map(x => ({
									id: x.FrID,
									delay: (x.FrDl || 0) / 100,
									dispose: x.FrDs ? FrmD.decode(x.FrDs) : 'auto', // missing == auto
									// x.FrGA ???
								})),
								animations: desc.FSts.map(x => ({
									id: x.FsID,
									frames: x.FsFr,
									repeats: x.LCnt,
									activeFrame: x.AFrm || 0,
								})),
							};

							// console.log('#4000 AnDs', require('util').inspect(desc, false, 99, true));
							// console.log('#4000 AnDs:result', require('util').inspect(target.animations, false, 99, true));
						} else if (key === 'Roll') {
							const bytes = readBytes(reader, left());
							reader.logDevFeatures && reader.log('#4000 Roll', bytes);
						} else {
							reader.logMissingFeatures && reader.log('Unhandled subsection in #4000', key);
						}
					});
				}
			});
		} else if (key === 'mopt') {
			const bytes = readBytes(reader, left());
			reader.logDevFeatures && reader.log('#4000 mopt', bytes);
		} else {
			reader.logMissingFeatures && reader.log('Unhandled key in #4000:', key);
		}
	},
	(writer, target) => {
		if (target.animations) {
			writeSignature(writer, 'mani');
			writeSignature(writer, 'IRFR');
			writeSection(writer, 1, () => {
				writeSignature(writer, '8BIM');
				writeSignature(writer, 'AnDs');
				writeSection(writer, 1, () => {
					const desc: AnimationsDescriptor = {
						// AFSt: 0, // ???
						FrIn: [],
						FSts: [],
					};

					for (let i = 0; i < target.animations!.frames.length; i++) {
						const f = target.animations!.frames[i];
						const frame: AnimationFrameDescriptor = {
							FrID: f.id,
						} as any;
						if (f.delay) frame.FrDl = (f.delay * 100) | 0;
						frame.FrDs = FrmD.encode(f.dispose);
						// if (i === 0) frame.FrGA = 30; // ???
						desc.FrIn.push(frame);
					}

					for (let i = 0; i < target.animations!.animations.length; i++) {
						const a = target.animations!.animations[i];
						const anim: AnimationDescriptor = {
							FsID: a.id,
							AFrm: a.activeFrame! | 0,
							FsFr: a.frames,
							LCnt: a.repeats! | 0,
						};
						desc.FSts.push(anim);
					}

					writeVersionAndDescriptor(writer, '', 'null', desc);
				});

				// writeSignature(writer, '8BIM');
				// writeSignature(writer, 'Roll');
				// writeSection(writer, 1, () => {
				// 	writeZeros(writer, 8);
				// });
			});
		}
	},
);

// TODO: Unfinished
MOCK_HANDLERS && addHandler(
	4001, // Plug-In resource(s)
	target => (target as any)._ir4001 !== undefined,
	(reader, target, left) => {
		if (MOCK_HANDLERS) {
			LOG_MOCK_HANDLERS && console.log('image resource 4001', left());
			(target as any)._ir4001 = readBytes(reader, left());
			return;
		}

		const key = readSignature(reader);

		if (key === 'mfri') {
			const version = readUint32(reader);
			if (version !== 2) throw new Error('Invalid mfri version');

			const length = readUint32(reader);
			const bytes = readBytes(reader, length);
			reader.logDevFeatures && reader.log('mfri', bytes);
		} else if (key === 'mset') {
			const desc = readVersionAndDescriptor(reader);
			reader.logDevFeatures && reader.log('mset', desc);
		} else {
			reader.logMissingFeatures && reader.log('Unhandled key in #4001', key);
		}
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir4001);
	},
);

// TODO: Unfinished
MOCK_HANDLERS && addHandler(
	4002, // Plug-In resource(s)
	target => (target as any)._ir4002 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 4002', left());
		(target as any)._ir4002 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir4002);
	},
);
