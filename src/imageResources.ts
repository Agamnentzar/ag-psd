import { toByteArray } from 'base64-js';
import { BlendMode, HalftoneScreen, ImageResources, KeyDescriptorItem, PrintTransferFunction, RenderingIntent, SavedPath } from './psd';
import { KeyDescriptorListDescriptor, parseKeyDescriptorList, readVectorMask, serializeKeyDescriptorList, writeVectorMask } from './additionalInfo';
import { PsdReader, readUnicodeString, readUint32, readUint16, readUint8, readFloat64, readBytes, skipBytes, readFloat32, readInt16, readFixedPoint32, readSignature, checkSignature, readSection, readColor, readInt32, readAsciiString, decodeUtf8, getUtf8StrictDecoder, getGbkStrictDecoder } from './psdReader';
import { PsdWriter, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16, writeBytes, writeInt16, writeFloat32, writeFixedPoint32, writeUnicodeStringWithPadding, writeColor, writeSignature, writeSection, writeInt32, writeAsciiString, writeZeros } from './psdWriter';
import { clamp, ColorSpace, createCanvasFromData, createEnum, createImageData, imageDataToCanvas, MOCK_HANDLERS } from './helpers';
import { encodeString } from './utf8';
import { ESliceBGColorType, ESliceHorzAlign, ESliceOrigin, ESliceType, ESliceVertAlign, frac, FractionDescriptor, parseTrackList, pathSelectionStateToReference, DescriptorReferenceItem, readVersionAndDescriptor, serializeTrackList, TimelineTrackDescriptor, TimeScopeDescriptor, writeVersionAndDescriptor, DescriptorColor, DescriptorUnitsValue, parseColor, serializeColor, parseUnits, unitsValue, parsePercent, unitsPercentF , outputSettingsRoot } from './descriptor';

export interface InternalImageResources extends ImageResources {
	layersGroup?: number[];
	layerGroupsEnabledId?: number[];
	savedPathsOrigination?: KeyDescriptorItem[][];
}

export interface ResourceDocumentInfo {
	width: number;
	height: number;
}

export interface ResourceInfo extends ResourceDocumentInfo {
	signature: string; // '8BIM', or 'MeSa' etc. for resources from other applications
	id: number;
	name: Uint8Array; // raw pascal string bytes
}

export interface ResourceHandler {
	key: number;
	keyCount: number; // number of consecutive resource ids handled, starting at `key` (index is added to `key` when writing)
	has: (target: InternalImageResources) => boolean | number;
	read: (reader: PsdReader, target: InternalImageResources, left: () => number, info: ResourceInfo) => void;
	write: (writer: PsdWriter, target: InternalImageResources, index: number, document: ResourceDocumentInfo) => void;
	name?: (target: InternalImageResources, index: number) => string;
}

export const resourceHandlers: ResourceHandler[] = [];
export const resourceHandlersMap: { [key: number]: ResourceHandler } = {};

function addHandler(
	key: number,
	has: (target: InternalImageResources) => boolean | number,
	read: (reader: PsdReader, target: InternalImageResources, left: () => number, info: ResourceInfo) => void,
	write: (writer: PsdWriter, target: InternalImageResources, index: number, document: ResourceDocumentInfo) => void,
	options: { keyCount?: number; name?: (target: InternalImageResources, index: number) => string; } = {},
) {
	const handler: ResourceHandler = { key, keyCount: options.keyCount ?? 1, has, read, write, name: options.name };
	resourceHandlers.push(handler);
	for (let i = 0; i < handler.keyCount; i++) resourceHandlersMap[handler.key + i] = handler;
}

const LOG_MOCK_HANDLERS = false;
const RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
const MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];
const hex = '0123456789abcdef';

function charToNibble(code: number) {
	if (code <= 57) return code - 48; // '0'-'9'
	if (code >= 97) return code - 87; // 'a'-'f'
	return code - 55; // 'A'-'F'
}

function byteAt(value: string, index: number) {
	return (charToNibble(value.charCodeAt(index)) << 4) | charToNibble(value.charCodeAt(index + 1));
}

function readUtf8String(reader: PsdReader, length: number) {
	const buffer = readBytes(reader, length);
	return decodeUtf8(reader, buffer);
}

function writeUtf8String(writer: PsdWriter, value: string) {
	const buffer = encodeString(value);
	writeBytes(writer, buffer);
}

function readEncodedString(reader: PsdReader) {
	const length = readUint8(reader);
	const buffer = readBytes(reader, length);
	return decodeEncodedString(reader, buffer);
}

function decodeEncodedString(reader: PsdReader, buffer: Uint8Array) {
	let notAscii = false;
	for (let i = 0; i < buffer.byteLength; i++) {
		if (buffer[i] & 0x80) {
			notAscii = true;
			break;
		}
	}

	if (notAscii) {
		// encoding is ambiguous, many GBK strings are also valid UTF-8 and vice versa, GBK is preferred,
		// UTF-8 is only used if the string is not valid GBK
		for (const decoder of [getGbkStrictDecoder(reader), getUtf8StrictDecoder(reader)]) {
			if (decoder) {
				try {
					return decoder.decode(buffer);
				} catch { }
			}
		}
	}

	return decodeUtf8(reader, buffer);
}

function toShortAsciiString(value: string) {
	let ascii = '';

	for (let i = 0; i < value.length;) {
		const code = value.codePointAt(i)!;
		ascii += code > 0x7f ? '?' : String.fromCharCode(code);
		i += code > 0xffff ? 2 : 1; // skip low surrogate of astral characters
	}

	// length is stored in a single byte
	return ascii.length > 255 ? ascii.substring(0, 255) : ascii;
}

function writeEncodedString(writer: PsdWriter, value: string) {
	const buffer = encodeString(toShortAsciiString(value));
	writeUint8(writer, buffer.byteLength);
	writeBytes(writer, buffer);
}

addHandler(
	1028, // IPTC-NAA record
	target => target.iptcData !== undefined,
	(reader, target, left) => {
		target.iptcData = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, target.iptcData!);
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
	1085, // Windows DEVMODE. Variable OS specific info for Windows.
	target => target.windowsDevMode !== undefined,
	(reader, target, left) => {
		target.windowsDevMode = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, target.windowsDevMode!);
	}
);

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
		if (desc.ClrS === 'ClrS.Grys') info.printerProfileColorSpace = 'grayscale';
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
			desc.ClrS = info.printerProfileColorSpace === 'grayscale' ? 'ClrS.Grys' : 'ClrS.RGBC';
			if (info.printerProfile !== undefined) desc['Nm  '] = info.printerProfile;
		}

		desc.Inte = Inte.encode(info.renderingIntent);

		if (!info.printerManagesColors && info.blackPointCompensation !== undefined) desc.MpBl = !!info.blackPointCompensation;

		desc.printSixteenBit = !!info.printSixteenBit;
		desc.printerName = info.printerName || '';

		if (info.proofSetup && 'profile' in info.proofSetup) {
			desc.printProofSetup = {
				profile: info.proofSetup.profile || '',
				Inte: Inte.encode(info.proofSetup.renderingIntent),
				MpBl: !!info.proofSetup.blackPointCompensation,
				paperWhite: !!info.proofSetup.paperWhite,
			};
		} else if (info.proofSetup) {
			desc.printProofSetup = {
				Bltn: `builtinProof.${info.proofSetup.builtin || 'proofCMYK'}`,
			};
		}

		writeVersionAndDescriptor(writer, '', 'printOutput', desc);
	},
);

interface PrintStyleDescriptor {
	Cptn: boolean;
	Clbr: boolean;
	RgsM: boolean;
	CrnC: boolean;
	CntC: boolean;
	Lbls: boolean;
	Ngtv: boolean;
	EmlD: boolean;
	Intr: boolean;
	Bckg: DescriptorColor;
	BrdT: DescriptorUnitsValue;
	'Bld ': DescriptorUnitsValue;
	Rslt: DescriptorUnitsValue;
	vectorData: boolean;
	PgPs: string;
	Left: DescriptorUnitsValue;
	'Top ': DescriptorUnitsValue;
	'Scl ': DescriptorUnitsValue;
	cropWhenPrinting?: boolean;
	cropRectBottom?: number;
	cropRectLeft?: number;
	cropRectRight?: number;
	cropRectTop?: number;
}

addHandler(
	1083, // Print style
	target => target.printStyle !== undefined,
	(reader, target) => {
		const desc: PrintStyleDescriptor = readVersionAndDescriptor(reader);

		target.printStyle = {
			caption: desc.Cptn,
			calibrationBars: desc.Clbr,
			registrationMarks: desc.RgsM,
			cornerCropMarks: desc.CrnC,
			centerCropMarks: desc.CntC,
			labels: desc.Lbls,
			negative: desc.Ngtv,
			emulsionDown: desc.EmlD,
			interpolate: desc.Intr,
			backgroundColor: parseColor(desc.Bckg),
			border: parseUnits(desc.BrdT),
			bleed: parseUnits(desc['Bld ']),
			resolution: parseUnits(desc.Rslt),
			vectorData: desc.vectorData,
			pagePosition: desc.PgPs === 'PgPs.PgPC' ? 'centered' : desc.PgPs,
			left: parseUnits(desc.Left),
			top: parseUnits(desc['Top ']),
			scale: parsePercent(desc['Scl ']),
		};

		if (desc.cropWhenPrinting !== undefined) {
			target.printStyle.cropWhenPrinting = desc.cropWhenPrinting;
			target.printStyle.cropRect = {
				top: desc.cropRectTop || 0,
				left: desc.cropRectLeft || 0,
				bottom: desc.cropRectBottom || 0,
				right: desc.cropRectRight || 0,
			};
		}
	},
	(writer, target) => {
		const style = target.printStyle!;
		const desc: PrintStyleDescriptor = {
			Cptn: !!style.caption,
			Clbr: !!style.calibrationBars,
			RgsM: !!style.registrationMarks,
			CrnC: !!style.cornerCropMarks,
			CntC: !!style.centerCropMarks,
			Lbls: !!style.labels,
			Ngtv: !!style.negative,
			EmlD: !!style.emulsionDown,
			Intr: !!style.interpolate,
			Bckg: serializeColor(style.backgroundColor || { r: 255, g: 255, b: 255 }),
			BrdT: unitsValue(style.border || { units: 'Distance', value: 0 }, 'border'),
			'Bld ': unitsValue(style.bleed || { units: 'Distance', value: 0 }, 'bleed'),
			Rslt: unitsValue(style.resolution || { units: 'Pixels', value: 72 }, 'resolution'),
			vectorData: style.vectorData ?? true,
			PgPs: (!style.pagePosition || style.pagePosition === 'centered') ? 'PgPs.PgPC' : style.pagePosition,
			Left: unitsValue(style.left || { units: 'Distance', value: 0 }, 'left'),
			'Top ': unitsValue(style.top || { units: 'Distance', value: 0 }, 'top'),
			'Scl ': unitsPercentF(style.scale ?? 1),
		};

		if (style.cropWhenPrinting !== undefined || style.cropRect) {
			desc.cropWhenPrinting = !!style.cropWhenPrinting;
			desc.cropRectBottom = style.cropRect?.bottom ?? 0;
			desc.cropRectLeft = style.cropRect?.left ?? 0;
			desc.cropRectRight = style.cropRect?.right ?? 0;
			desc.cropRectTop = style.cropRect?.top ?? 0;
		}

		writeVersionAndDescriptor(writer, '', 'printOutputOptions', desc);
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

const displayInfoKinds = ['selected', 'protected', 'spot'] as const;
const supportedColorSpaces: number[] = [ColorSpace.RGB, ColorSpace.HSB, ColorSpace.CMYK, ColorSpace.Lab, ColorSpace.Grayscale];

function readDisplayInfo(reader: PsdReader) {
	const info: NonNullable<ImageResources['alphaChannelDisplayInfo']>[number] = { opacity: 0, kind: 'selected' };
	const colorSpace = reader.view.getUint16(reader.offset);

	if (supportedColorSpaces.indexOf(colorSpace) !== -1) {
		info.color = readColor(reader);
	} else {
		// keep color in unknown color space as it is, so the channel info is not lost or misaligned
		skipBytes(reader, 2);
		info.rawColor = { colorSpace, values: [readUint16(reader), readUint16(reader), readUint16(reader), readUint16(reader)] };
	}

	info.opacity = readUint16(reader) / 100;
	const kind = displayInfoKinds[readUint8(reader)];
	if (!kind) throw new Error('Invalid display info kind');
	info.kind = kind;
	return info;
}

addHandler(
	1007, // Display info (obsolete, replaced by 1077), written back as 1077
	() => false,
	(reader, target, left) => {
		const info: NonNullable<ImageResources['alphaChannelDisplayInfo']> = [];

		while (left() >= 14) {
			info.push(readDisplayInfo(reader));
			skipBytes(reader, 1); // padding
		}

		// 1077 resource has more precise data and is used if present
		if (!target.alphaChannelDisplayInfo) target.alphaChannelDisplayInfo = info;
	},
	() => { },
);

addHandler(
	1077, // Display info (alpha and spot channels)
	target => target.alphaChannelDisplayInfo !== undefined,
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 1) throw new Error(`Invalid display info version: ${version}`);

		target.alphaChannelDisplayInfo = [];

		while (left() >= 13) {
			target.alphaChannelDisplayInfo.push(readDisplayInfo(reader));
		}
	},
	(writer, target) => {
		writeUint32(writer, 1); // version

		for (const info of target.alphaChannelDisplayInfo!) {
			if (!info.color && info.rawColor) {
				writeUint16(writer, info.rawColor.colorSpace);
				for (let i = 0; i < 4; i++) writeUint16(writer, info.rawColor.values[i] | 0);
			} else {
				writeColor(writer, info.color || { r: 255, g: 0, b: 0 });
			}

			writeUint16(writer, Math.round(clamp(info.opacity, 0, 1) * 100));
			writeUint8(writer, Math.max(0, displayInfoKinds.indexOf(info.kind)));
		}
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
	(reader, target, left) => {
		target.printFlags = {
			labels: !!readUint8(reader),
			cropMarks: !!readUint8(reader),
			colorBars: !!readUint8(reader),
			registrationMarks: !!readUint8(reader),
			negative: !!readUint8(reader),
			flip: !!readUint8(reader),
			interpolate: !!readUint8(reader),
			caption: !!readUint8(reader),
			printFlags: left() ? !!readUint8(reader) : false,
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

addHandler(
	1034, // Copyright flag
	target => target.copyrighted !== undefined,
	(reader, target) => {
		target.copyrighted = !!readUint8(reader);
	},
	(writer, target) => {
		writeUint8(writer, target.copyrighted ? 1 : 0);
	},
);

addHandler(
	1035, // URL
	target => target.url !== undefined,
	(reader, target, left) => {
		target.url = readAsciiString(reader, left());
	},
	(writer, target) => {
		writeAsciiString(writer, target.url!);
	},
);

addHandler(
	10000, // Print flags information
	target => target.printFlagsInfo !== undefined,
	(reader, target) => {
		const version = readUint16(reader);
		if (version !== 1) throw new Error(`Invalid print flags information version: ${version}`);
		const centerCropMarks = !!readUint8(reader);
		skipBytes(reader, 1);
		const bleedWidth = readUint32(reader);
		const bleedWidthScale = readUint16(reader);
		target.printFlagsInfo = { centerCropMarks, bleedWidth, bleedWidthScale };
	},
	(writer, target) => {
		const info = target.printFlagsInfo!;
		writeUint16(writer, 1); // version
		writeUint8(writer, info.centerCropMarks ? 1 : 0);
		writeUint8(writer, 0);
		writeUint32(writer, info.bleedWidth | 0);
		writeUint16(writer, info.bleedWidthScale | 0);
	},
);

addHandler(
	1046, // Indexed color table count
	target => target.indexedColorCount !== undefined,
	(reader, target) => {
		target.indexedColorCount = readUint16(reader);
	},
	(writer, target) => {
		writeUint16(writer, target.indexedColorCount!);
	},
);

addHandler(
	1047, // Transparency index
	target => target.transparencyIndex !== undefined,
	(reader, target) => {
		target.transparencyIndex = readUint16(reader);
	},
	(writer, target) => {
		writeUint16(writer, target.transparencyIndex!);
	},
);

const halftoneFrequencyUnits: HalftoneScreen['frequencyUnits'][] = ['lines/inch', 'lines/cm']; // 1, 2
const halftoneShapes: (HalftoneScreen['shape'] | undefined)[] = ['round', 'ellipse', 'line', 'square', 'cross', undefined, 'diamond']; // 0 - 6

function readHalftoneScreens(reader: PsdReader, left: () => number) {
	const screens: HalftoneScreen[] = [];

	while (left() >= 18) {
		const frequency = readFixedPoint32(reader);
		const frequencyUnits = halftoneFrequencyUnits[readUint16(reader) - 1];
		if (!frequencyUnits) throw new Error('Invalid halftone screen frequency units');
		const angle = readFixedPoint32(reader);
		const shape = halftoneShapes[readInt16(reader)];
		if (!shape) throw new Error('Invalid halftone screen shape');
		skipBytes(reader, 4);
		const accurateScreens = !!readUint8(reader);
		const printerDefaultScreens = !!readUint8(reader);
		screens.push({ frequency, frequencyUnits, angle, shape, accurateScreens, printerDefaultScreens });
	}

	return screens;
}

function writeHalftoneScreens(writer: PsdWriter, screens: HalftoneScreen[]) {
	for (const screen of screens) {
		writeFixedPoint32(writer, screen.frequency);
		writeUint16(writer, Math.max(0, halftoneFrequencyUnits.indexOf(screen.frequencyUnits)) + 1);
		writeFixedPoint32(writer, screen.angle);
		writeInt16(writer, Math.max(0, halftoneShapes.indexOf(screen.shape)));
		writeZeros(writer, 4);
		writeUint8(writer, screen.accurateScreens ? 1 : 0);
		writeUint8(writer, screen.printerDefaultScreens ? 1 : 0);
	}
}

addHandler(
	1012, // Grayscale and multichannel halftoning information
	target => target.grayscaleHalftoneScreens !== undefined,
	(reader, target, left) => target.grayscaleHalftoneScreens = readHalftoneScreens(reader, left),
	(writer, target) => writeHalftoneScreens(writer, target.grayscaleHalftoneScreens!),
);

addHandler(
	1013, // Color halftoning information
	target => target.colorHalftoneScreens !== undefined,
	(reader, target, left) => target.colorHalftoneScreens = readHalftoneScreens(reader, left),
	(writer, target) => writeHalftoneScreens(writer, target.colorHalftoneScreens!),
);

function readTransferFunctions(reader: PsdReader, left: () => number) {
	const functions: PrintTransferFunction[] = [];

	while (left() >= 28) {
		const curve: number[] = [];
		for (let i = 0; i < 13; i++) curve.push(readInt16(reader));
		const override = !!readUint16(reader);
		functions.push({ curve, override });
	}

	return functions;
}

function writeTransferFunctions(writer: PsdWriter, functions: PrintTransferFunction[]) {
	for (const f of functions) {
		for (let i = 0; i < 13; i++) writeInt16(writer, f.curve[i] ?? -1);
		writeUint16(writer, f.override ? 1 : 0);
	}
}

addHandler(
	1015, // Grayscale and multichannel transfer function
	target => target.grayscaleTransferFunctions !== undefined,
	(reader, target, left) => target.grayscaleTransferFunctions = readTransferFunctions(reader, left),
	(writer, target) => writeTransferFunctions(writer, target.grayscaleTransferFunctions!),
);

addHandler(
	1016, // Color transfer functions
	target => target.colorTransferFunctions !== undefined,
	(reader, target, left) => target.colorTransferFunctions = readTransferFunctions(reader, left),
	(writer, target) => writeTransferFunctions(writer, target.colorTransferFunctions!),
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

		const previous = target.gridAndGuidesInformation?.guides; // in case guides were already read from 1092
		const guides: Guide[] = [];

		for (let i = 0; i < count; i++) {
			const guide: Guide = {
				location: readInt32(reader) / 32,
				direction: readUint8(reader) ? 'horizontal' : 'vertical'
			};
			if (previous?.length === count && previous[i].color) guide.color = previous[i].color;
			if (previous?.length === count && previous[i].id) guide.id = previous[i].id;
			guides.push(guide);
		}

		target.gridAndGuidesInformation = { grid: { horizontal, vertical }, guides };
	},
	(writer, target) => {
		const info = target.gridAndGuidesInformation!;
		const grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
		const guides = info.guides || [];

		writeUint32(writer, 1);
		writeUint32(writer, Math.round(grid.horizontal));
		writeUint32(writer, Math.round(grid.vertical));
		writeUint32(writer, guides.length);

		for (const g of guides) {
			writeInt32(writer, Math.round(g.location * 32));
			writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
		}
	},
);

type Guide = NonNullable<NonNullable<ImageResources['gridAndGuidesInformation']>['guides']>[number];

const defaultGuideColor = { r: 74, g: 255, b: 255 }; // Photoshop default (cyan)

addHandler(
	1092, // Grid and guides information with guide colors (same as 1032 with color of each guide)
	target => target.gridAndGuidesInformation !== undefined,
	(reader, target) => {
		const version = readUint32(reader);
		if (version !== 2) throw new Error(`Invalid 1092 resource version: ${version}`);
		const horizontal = readUint32(reader);
		const vertical = readUint32(reader);
		const count = readUint32(reader);
		const guides: Guide[] = [];

		for (let i = 0; i < count; i++) {
			const location = readInt32(reader) / 32;
			const direction = readUint8(reader) ? 'horizontal' : 'vertical';
			skipBytes(reader, 1);
			const color = { r: readUint8(reader), g: readUint8(reader), b: readUint8(reader) };
			guides.push({ location, direction, color });
		}

		const existing = target.gridAndGuidesInformation?.guides;

		if (existing && existing.length === count) {
			existing.forEach((guide, i) => guide.color = guides[i].color);
		} else {
			target.gridAndGuidesInformation = { grid: { horizontal, vertical }, guides };
		}
	},
	(writer, target) => {
		const info = target.gridAndGuidesInformation!;
		const grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
		const guides = info.guides || [];

		writeUint32(writer, 2); // version
		writeUint32(writer, Math.round(grid.horizontal));
		writeUint32(writer, Math.round(grid.vertical));
		writeUint32(writer, guides.length);

		for (const g of guides) {
			const color = g.color || defaultGuideColor;
			writeInt32(writer, Math.round(g.location * 32));
			writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
			writeUint8(writer, 0);
			writeUint8(writer, Math.round(color.r));
			writeUint8(writer, Math.round(color.g));
			writeUint8(writer, Math.round(color.b));
		}
	},
);

const emptyGuid = '00000000-0000-0000-0000-000000000000';

addHandler(
	1097, // Guide ids
	target => !!target.gridAndGuidesInformation && (target.gridAndGuidesInformation.guides || []).every(g => g.id),
	(reader, target) => {
		const count = readUint32(reader);
		const ids: string[] = [];

		for (let i = 0; i < count; i++) {
			ids.push(readAsciiString(reader, readUint32(reader)));
			readUint32(reader); // unknown, always 0
			readAsciiString(reader, readUint32(reader)); // unknown, always empty guid
		}

		const guides = target.gridAndGuidesInformation?.guides;
		if (guides && guides.length === count) guides.forEach((guide, i) => guide.id = ids[i]);
	},
	(writer, target) => {
		const guides = target.gridAndGuidesInformation!.guides || [];
		writeUint32(writer, guides.length);

		for (const g of guides) {
			writeUint32(writer, g.id!.length);
			writeAsciiString(writer, g.id!);
			writeUint32(writer, 0);
			writeUint32(writer, emptyGuid.length);
			writeAsciiString(writer, emptyGuid);
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

			if (item.comment !== undefined) target.layerComps.list[target.layerComps.list.length - 1].comment = item.comment;
		}

		if (desc.lastAppliedComp !== undefined) target.layerComps.lastApplied = desc.lastAppliedComp;
	},
	(writer, target) => {
		const layerComps = target.layerComps!;
		const desc: LayerCompsDescriptor = { list: [] };

		for (const item of layerComps.list) {
			const t: LayerCompsDescriptor['list'][0] = {} as any;
			t._classID = 'Comp';
			t['Nm  '] = item.name;
			if (item.comment !== undefined) t.comment = item.comment;
			t.compID = item.id;
			t.capturedInfo = item.capturedInfo;
			desc.list.push(t);
		}

		if (layerComps.lastApplied !== undefined) desc.lastAppliedComp = layerComps.lastApplied;

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
			minOpacity: Math.round(onionSkins.minOpacity * 100),
			maxOpacity: Math.round(onionSkins.maxOpacity * 100),
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
				audioClipGroupList: (timeline.audioClipGroups ?? []).map(a => ({
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
	(reader, target, leftBytes) => {
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
			if (leftBytes()) {
				const desc = readVersionAndDescriptor(reader) as SlicesDesc;
				const slicesById = new Map<number, typeof slices[0]>();
				for (const s of slices) {
					if (!slicesById.has(s.id)) slicesById.set(s.id, s);
				}

				desc.slices.forEach(d => {
					const slice = slicesById.get(d.sliceID);
					if (slice) {
						slice.topOutset = d.topOutset;
						slice.leftOutset = d.leftOutset;
						slice.bottomOutset = d.bottomOutset;
						slice.rightOutset = d.rightOutset;
					}
				});
			}
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

addHandler(
	1039, // ICC Profile
	target => target.iccProfile !== undefined,
	(reader, target, left) => {
		target.iccProfile = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, target.iccProfile!);
	},
);

addHandler(
	1044,
	target => target.idsSeedNumber !== undefined,
	(reader, target) => target.idsSeedNumber = readUint32(reader),
	(writer, target) => writeUint32(writer, target.idsSeedNumber!),
);

addHandler(
	1038, // Color samplers (Photoshop 5.0, replaced by 1073 in CS3)
	target => target.colorSamplers !== undefined,
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 1) throw new Error(`Invalid color samplers version: ${version}`);
		const count = readUint32(reader);
		target.colorSamplers = [];

		for (let i = 0; i < count && left() >= 10; i++) {
			// vertical and horizontal position in 1/16 pixel (inferred from sample files, the specification describes
			// these values as horizontal and vertical fixed point numbers)
			const y = readInt32(reader) / 16;
			const x = readInt32(reader) / 16;
			const colorSpace = readInt16(reader);
			target.colorSamplers.push({ x, y, colorSpace });
		}
	},
	(writer, target) => {
		writeUint32(writer, 1); // version
		writeUint32(writer, target.colorSamplers!.length);

		for (const sampler of target.colorSamplers!) {
			writeInt32(writer, Math.round(sampler.y * 16));
			writeInt32(writer, Math.round(sampler.x * 16));
			writeInt16(writer, sampler.colorSpace);
		}
	},
);

addHandler(
	1042, // Effects visible (only present when effects are hidden)
	target => target.effectsVisible !== undefined,
	(reader, target) => {
		target.effectsVisible = !!readUint8(reader);
	},
	(writer, target) => {
		writeUint8(writer, target.effectsVisible ? 1 : 0);
	},
);

addHandler(
	1036,
	target => target.thumbnail !== undefined || target.thumbnailRaw !== undefined,
	(reader, target, left) => {
		const format = readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
		const width = readUint32(reader);
		const height = readUint32(reader);
		const widthBytes = readUint32(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
		readUint32(reader); // totalSize = widthBytes * height * planes
		readUint32(reader); // sizeAfterCompression
		const bitsPerPixel = readUint16(reader); // 24
		readUint16(reader); // planes, should be 1 (some applications write 3)

		if (format === 0 && bitsPerPixel === 24 && widthBytes >= width * 3 && widthBytes * height <= left()) {
			// raw RGB data, rows are padded to 4 bytes
			if (reader.useRawThumbnail) {
				reader.logMissingFeatures && reader.log('Raw thumbnail data is not supported with useRawThumbnail option');
				skipBytes(reader, left());
				return;
			}

			const data = readBytes(reader, widthBytes * height);
			const imageData = createImageData(width, height);

			for (let y = 0, dst = 0; y < height; y++) {
				for (let x = 0, src = y * widthBytes; x < width; x++, src += 3, dst += 4) {
					imageData.data[dst + 0] = data[src + 0];
					imageData.data[dst + 1] = data[src + 1];
					imageData.data[dst + 2] = data[src + 2];
					imageData.data[dst + 3] = 255;
				}
			}

			target.thumbnail = imageDataToCanvas(imageData);
			skipBytes(reader, left());
			return;
		}

		if (format !== 1 || bitsPerPixel !== 24) {
			reader.logMissingFeatures && reader.log(`Invalid thumbnail data (format: ${format}, bitsPerPixel: ${bitsPerPixel})`);
			skipBytes(reader, left());
			return;
		}

		const size = left();
		const data = readBytes(reader, size);

		if (reader.useRawThumbnail) {
			target.thumbnailRaw = { width, height, data };
		} else if (data.byteLength) {
			target.thumbnail = createCanvasFromData(data, reader);
		}
	},
	(writer, target) => {
		let width = 0;
		let height = 0;
		let data = new Uint8Array(0);

		if (target.thumbnailRaw) {
			width = target.thumbnailRaw.width;
			height = target.thumbnailRaw.height;
			data = target.thumbnailRaw.data as any;
		} else {
			try {
				const dataUrl = target.thumbnail!.toDataURL('image/jpeg', 1)?.substring('data:image/jpeg;base64,'.length);

				if (dataUrl) {
					data = toByteArray(dataUrl) as any; // this sometimes fails for some reason, maybe some browser bugs
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

addHandler(
	1058, // EXIF data 1
	target => target.exifData !== undefined,
	(reader, target, left) => {
		target.exifData = readBytes(reader, left());
	},
	(writer, target) => {
		writeBytes(writer, target.exifData!);
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

interface Descriptor1088Read {
	'null': string[];
}

interface Descriptor1088Write {
	'null': DescriptorReferenceItem[];
}

addHandler(
	1088,
	target => target.pathSelectionState !== undefined,
	(reader, target, _left) => {
		const desc: Descriptor1088Read = readVersionAndDescriptor(reader);
		target.pathSelectionState = desc['null'];
	},
	(writer, target) => {
		const desc: Descriptor1088Write = { 'null': pathSelectionStateToReference(target.pathSelectionState!) };
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

addHandler(
	1025, // Work path
	target => target.workPath !== undefined,
	(reader, target, left, { width, height }) => {
		target.workPath = { paths: [] };
		readVectorMask(reader, target.workPath, width, height, left());
		skipBytes(reader, left());
	},
	(writer, target, _index, { width, height }) => {
		writeVectorMask(writer, target.workPath!, width, height);
	},
);

const MAX_SAVED_PATHS = 999; // ids 2000-2998

addHandler(
	2000, // Saved paths (one resource for each path, named after the path)
	target => target.savedPaths ? Math.min(target.savedPaths.length, MAX_SAVED_PATHS) : 0,
	(reader, target, left, { signature, id, name, width, height }) => {
		if (signature !== '8BIM') { // ImageReady ('MeSa') resources use the same ids for other data
			reader.logMissingFeatures && reader.log(`Unhandled image resource: ${signature} ${id}`);
			skipBytes(reader, left());
			return;
		}

		const savedPaths = target.savedPaths ??= [];
		const path: SavedPath = { name: decodeEncodedString(reader, name), paths: [] };
		readVectorMask(reader, path, width, height, left());
		skipBytes(reader, left());

		const keyDescriptorList = target.savedPathsOrigination?.[savedPaths.length];
		if (keyDescriptorList) path.vectorOrigination = { keyDescriptorList };

		savedPaths.push(path);
	},
	(writer, target, index, { width, height }) => {
		writeVectorMask(writer, target.savedPaths![index], width, height);
	},
	{ keyCount: MAX_SAVED_PATHS, name: (target, index) => toShortAsciiString(target.savedPaths![index].name) },
);

interface OriginPathInfoDescriptor {
	keyRootDescriptorList: KeyDescriptorListDescriptor[];
}

addHandler(
	3000, // Origin path info (origination data of saved paths)
	target => !!target.savedPaths?.some(path => path.vectorOrigination),
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as OriginPathInfoDescriptor;

		desc.keyRootDescriptorList.forEach((item, i) => {
			const keyDescriptorList = parseKeyDescriptorList(item);
			if (!keyDescriptorList.length) return; // written for paths without origination data

			const path = target.savedPaths?.[i];

			if (path) {
				path.vectorOrigination = { keyDescriptorList };
			} else { // saved paths are stored after this resource
				(target.savedPathsOrigination ??= [])[i] = keyDescriptorList;
			}
		});

		skipBytes(reader, left());
	},
	(writer, target) => {
		const desc: OriginPathInfoDescriptor = {
			keyRootDescriptorList: target.savedPaths!.slice(0, MAX_SAVED_PATHS)
				.map(path => serializeKeyDescriptorList(path.vectorOrigination?.keyDescriptorList ?? [])),
		};
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
	{ name: () => 'OriginDataIRB' },
);

addHandler(
	2999, // Clipping path
	target => target.clippingPath !== undefined,
	(reader, target, left) => {
		const name = readEncodedString(reader);
		const flatness = readFixedPoint32(reader);
		skipBytes(reader, left()); // fill rule (ignored by Photoshop)
		target.clippingPath = { name, flatness };
	},
	(writer, target) => {
		writeEncodedString(writer, target.clippingPath!.name);
		writeFixedPoint32(writer, target.clippingPath!.flatness);
		writeUint16(writer, 1); // fill rule (ignored by Photoshop)
	},
);

const FrmD = createEnum<'auto' | 'none' | 'dispose'>('FrmD', 'auto', {
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

// plug-in resources are written with consecutive ids starting at 4000, in the same order as Photoshop writes them
function pluginResourceKeys(target: InternalImageResources) {
	const keys: string[] = [];
	if (target.outputSettings !== undefined) keys.push('mset');
	if (target.animations !== undefined) keys.push('mani', 'mfri');
	return keys;
}

addHandler(
	4000, // Plug-In resource(s), identified by key stored in the data (ids 4000-4999)
	target => pluginResourceKeys(target).length,
	(reader, target, left) => {
		const key = readSignature(reader);

		if (key === 'mset') {
			// Save for Web output settings
			target.outputSettings = readVersionAndDescriptor(reader, true);
			skipBytes(reader, left());
		} else if (key === 'mfri') {
			// frame count, active frame and animation count, same data as in animations (mani)
			skipBytes(reader, left());
		} else if (key === 'mani') {
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
							skipBytes(reader, left()); // padding
						} else if (key === 'Roll') {
							const bytes = readBytes(reader, left());
							reader.logDevFeatures && reader.log('#4000 Roll', bytes);
						} else {
							reader.logMissingFeatures && reader.log('Unhandled subsection in #4000', key);
							skipBytes(reader, left());
						}
					});
				}
			});

			skipBytes(reader, left()); // unknown data after animations section
		} else if (key === 'mopt') {
			const bytes = readBytes(reader, left());
			reader.logDevFeatures && reader.log('#4000 mopt', bytes);
		} else {
			reader.logMissingFeatures && reader.log(`Unhandled plug-in resource key: ${key}`);
			skipBytes(reader, left());
		}
	},
	(writer, target, index) => {
		const key = pluginResourceKeys(target)[index];

		if (key === 'mset') {
			writeSignature(writer, 'mset');
			writeVersionAndDescriptor(writer, '', 'null', target.outputSettings, outputSettingsRoot);
		} else if (key === 'mfri') {
			const animations = target.animations!;
			writeSignature(writer, 'mfri');
			writeUint32(writer, 2); // version
			writeUint32(writer, 16); // length
			writeUint32(writer, animations.frames.length);
			writeUint32(writer, animations.animations[0]?.activeFrame ?? 0);
			writeUint32(writer, animations.animations.length);
			writeUint32(writer, 0);
		} else if (key === 'mani') {
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
						if (f.delay) frame.FrDl = Math.round(f.delay * 100);
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
	{ keyCount: 1000 },
);

