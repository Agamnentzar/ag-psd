import { toByteArray } from 'base64-js';
import { ImageResources, ReadOptions, RenderingIntent } from './psd';
import {
	PsdReader, readPascalString, readUnicodeString, readUint32, readUint16, readUint8, readFloat64,
	readBytes, skipBytes, readFloat32, readInt16, readFixedPoint32, readSignature, checkSignature,
	readSection, readColor
} from './psdReader';
import {
	PsdWriter, writePascalString, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16,
	writeBytes, writeInt16, writeFloat32, writeFixedPoint32, writeUnicodeStringWithPadding, writeColor,
} from './psdWriter';
import { createCanvasFromData, createEnum, MOCK_HANDLERS } from './helpers';
import { decodeString, encodeString } from './utf8';
import { readVersionAndDescriptor, writeVersionAndDescriptor } from './descriptor';

export interface ResourceHandler {
	key: number;
	has: (target: ImageResources) => boolean;
	read: (reader: PsdReader, target: ImageResources, left: () => number, options: ReadOptions) => void;
	write: (writer: PsdWriter, target: ImageResources) => void;
}

export const resourceHandlers: ResourceHandler[] = [];
export const resourceHandlersMap: { [key: number]: ResourceHandler } = {};

function addHandler(
	key: number,
	has: (target: ImageResources) => boolean,
	read: (reader: PsdReader, target: ImageResources, left: () => number, options: ReadOptions) => void,
	write: (writer: PsdWriter, target: ImageResources) => void,
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
	(reader, target, left) => target.xmpMetadata = readUtf8String(reader, left()),
	(writer, target) => writeUtf8String(writer, target.xmpMetadata!),
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
		target.alphaChannelNames = [];

		while (left()) {
			const value = readPascalString(reader, 1);
			target.alphaChannelNames.push(value);
		}
	},
	(writer, target) => {
		for (const name of target.alphaChannelNames!) {
			writePascalString(writer, name, 1);
		}
	},
);

addHandler(
	1045,
	target => target.alphaChannelNames !== undefined,
	(reader, target, left) => {
		target.alphaChannelNames = [];

		while (left()) {
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
	(reader, target) => target.globalAngle = readUint32(reader),
	(writer, target) => writeUint32(writer, target.globalAngle!),
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

		while (left()) {
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

		while (left()) {
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

addHandler(
	1054,
	target => target.urlsList !== undefined,
	(reader, target, _, options) => {
		const count = readUint32(reader);

		if (count) {
			if (!options.throwForMissingFeatures) return;
			throw new Error('Not implemented: URL List');
		}

		// TODO: read actual URL list
		target.urlsList = [];
	},
	(writer, target) => {
		writeUint32(writer, target.urlsList!.length);

		// TODO: write actual URL list
		if (target.urlsList!.length) {
			throw new Error('Not implemented: URL List');
		}
	},
);

MOCK_HANDLERS && addHandler(
	1050, // Slices
	target => (target as any)._ir1050 !== undefined,
	(reader, target, left) => {
		LOG_MOCK_HANDLERS && console.log('image resource 1050', left());
		(target as any)._ir1050 = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir1050);
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
	(reader, target, left, options) => {
		const format = readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
		const width = readUint32(reader);
		const height = readUint32(reader);
		readUint32(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
		readUint32(reader); // totalSize = widthBytes * height * planes
		readUint32(reader); // sizeAfterCompression
		const bitsPerPixel = readUint16(reader); // 24
		const planes = readUint16(reader); // 1

		if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
			options.logMissingFeatures && console.log(`Invalid thumbnail data (format: ${format}, bitsPerPixel: ${bitsPerPixel}, planes: ${planes})`);
			skipBytes(reader, left());
			return;
		}

		const size = left();
		const data = readBytes(reader, size);

		if (options.useRawThumbnail) {
			target.thumbnailRaw = { width, height, data };
		} else if (data.byteLength) {
			target.thumbnail = createCanvasFromData(data);
		}
	},
	(writer, target) => {
		let width = 0;
		let height = 0;
		let data: Uint8Array;

		if (target.thumbnailRaw) {
			width = target.thumbnailRaw.width;
			height = target.thumbnailRaw.height;
			data = target.thumbnailRaw.data;
		} else {
			const dataUrl = target.thumbnail!.toDataURL('image/jpeg', 1)?.substring('data:image/jpeg;base64,'.length);

			if (dataUrl) {
				width = target.thumbnail!.width;
				height = target.thumbnail!.height;
				data = toByteArray(dataUrl);
			} else {
				data = new Uint8Array(0);
			}
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
		// console.log(require('util').inspect(desc, false, 99, true));
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

interface AnimationDescriptor {
	AFSt: number;
	FrIn: {
		FrID: number;
		FrDl: number;
		FrDs: string;
		FrGA?: number;
	}[];
	FSts: {
		FsID: number;
		AFrm: number;
		FsFr: number[];
		LCnt: number;
	}[];
}

interface Animations {
	frames: {
		id: number;
		delay: number;
		dispose?: 'auto' | 'none' | 'dispose';
	}[];
	animations: {
		id: number;
		frames: number[];
		repeats?: number;
	}[];
}

// TODO: Unfinished
MOCK_HANDLERS && addHandler(
	4000, // Plug-In resource(s)
	target => (target as any)._ir4000 !== undefined,
	(reader, target, left, { logMissingFeatures, logDevFeatures }) => {
		if (MOCK_HANDLERS) {
			LOG_MOCK_HANDLERS && console.log('image resource 4000', left());
			(target as any)._ir4000 = readBytes(reader, left());
			return;
		}

		const key = readSignature(reader);

		if (key === 'mani') {
			checkSignature(reader, 'IRFR');
			readSection(reader, 1, left => {
				while (left()) {
					checkSignature(reader, '8BIM');
					const key = readSignature(reader);

					readSection(reader, 1, left => {
						if (key === 'AnDs') {
							const desc = readVersionAndDescriptor(reader) as AnimationDescriptor;
							// console.log('AnDs', desc);
							logDevFeatures && console.log('#4000 AnDs', desc);
							// logDevFeatures && console.log('#4000 AnDs', require('util').inspect(desc, false, 99, true));

							const result: Animations = {
								// desc.AFSt ???
								frames: desc.FrIn.map(x => ({
									id: x.FrID,
									delay: x.FrDl / 100,
									dispose: x.FrDs ? FrmD.decode(x.FrDs) : 'auto', // missing == auto
									// x.FrGA ???
								})),
								animations: desc.FSts.map(x => ({
									id: x.FsID,
									frames: x.FsFr,
									repeats: x.LCnt,
									// x.AFrm ???
								})),
							};

							logDevFeatures && console.log('#4000 AnDs:result', result);
							// logDevFeatures && console.log('#4000 AnDs:result', require('util').inspect(result, false, 99, true));
						} else if (key === 'Roll') {
							const bytes = readBytes(reader, left());
							logDevFeatures && console.log('#4000 Roll', bytes);
						} else {
							logMissingFeatures && console.log('Unhandled subsection in #4000', key);
						}
					});
				}
			});
		} else if (key === 'mopt') {
			const bytes = readBytes(reader, left());
			logDevFeatures && console.log('#4000 mopt', bytes);
		} else {
			logMissingFeatures && console.log('Unhandled key in #4000:', key);
			return;
		}
	},
	(writer, target) => {
		writeBytes(writer, (target as any)._ir4000);
	},
);

// TODO: Unfinished
MOCK_HANDLERS && addHandler(
	4001, // Plug-In resource(s)
	target => (target as any)._ir4001 !== undefined,
	(reader, target, left, { logMissingFeatures, logDevFeatures }) => {
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
			logDevFeatures && console.log('mfri', bytes);
		} else if (key === 'mset') {
			const desc = readVersionAndDescriptor(reader);
			logDevFeatures && console.log('mset', desc);
		} else {
			logMissingFeatures && console.log('Unhandled key in #4001', key);
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
