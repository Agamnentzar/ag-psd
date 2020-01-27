import { toByteArray } from 'base64-js';
import { ImageResources, ReadOptions } from './psd';
import {
	PsdReader, readPascalString, readUnicodeString, readUint32, readUint16, readUint8, readFloat64,
	readBytes, skipBytes, readFloat32, readInt16, readFixedPoint32
} from './psdReader';
import {
	PsdWriter, writePascalString, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16,
	writeBytes, writeInt16, writeFloat32, writeFixedPoint32,
} from './psdWriter';
import { createCanvasFromData } from './helpers';

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

const RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
const MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];
const hex = '0123456789abcdef';

function charToNibble(code: number) {
	return code <= 57 ? code - 48 : code - 87;
}

function byteAt(value: string, index: number) {
	return (charToNibble(value.charCodeAt(index)) << 4) | charToNibble(value.charCodeAt(index + 1));
}

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

// addHandler(
// 	1060,
// 	target => target.xmpMetadata !== undefined,
// 	(reader, target, left) => {
// 		target.xmpMetadata = readUtf8String(reader, left());
// 	},
// 	(writer, target) => {
// 		writeUtf8String(writer, target.xmpMetadata!);
// 	},
// );

// addHandler(
// 	1082,
// 	target => target.printInformation !== undefined,
// 	(reader, target) => {
// 		const descriptorVersion = readInt32(reader);

// 		if (descriptorVersion !== 16) {
// 			throw new Error(`Invalid descriptor version`);
// 		}

// 		const value = readDescriptorStructure(reader);

// 		target.printInformation = {
// 			printerName: value.printerName,
// 		};
// 	},
// 	(writer, target) => {
// 		const value = target.printInformation!;

// 		writeInt32(writer, 16); // descriptor version
// 		writeDescriptorStructure(writer, '', 'printOutput', {
// 			PstS: true,
// 			Inte: 'Inte.Clrm',
// 			printSixteenBit: false,
// 			printerName: value.printerName || '',
// 			printProofSetup: {
// 				Bltn: 'builtinProof.proofCMYK',
// 			},
// 		});
// 	},
// );

// addHandler(
// 	1083,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1083] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1083]); target;
// 	},
// );

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
			target.alphaChannelNames.push(readPascalString(reader, 1));
		}
	},
	(writer, target) => {
		for (const name of target.alphaChannelNames!) {
			writePascalString(writer, name);
		}
	},
);

addHandler(
	1037,
	target => target.globalAngle !== undefined,
	(reader, target) => {
		target.globalAngle = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.globalAngle!);
	},
);

addHandler(
	1049,
	target => target.globalAltitude !== undefined,
	(reader, target) => {
		target.globalAltitude = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.globalAltitude!);
	},
);

// addHandler(
// 	1011,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1011] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1011]); target;
// 	},
// );

// addHandler(
// 	10000,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[10000] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[10000]); target;
// 	},
// );

// addHandler(
// 	1013,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1013] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1013]); target;
// 	},
// );

// addHandler(
// 	1016,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1016] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1016]); target;
// 	},
// );

addHandler(
	1024,
	target => target.layerState !== undefined,
	(reader, target) => {
		target.layerState = readUint16(reader);
	},
	(writer, target) => {
		writeUint16(writer, target.layerState!);
	},
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
	1045,
	target => target.unicodeAlphaNames !== undefined,
	(reader, target, left) => {
		target.unicodeAlphaNames = [];

		while (left()) {
			target.unicodeAlphaNames.push(readUnicodeString(reader));
		}
	},
	(writer, target) => {
		for (const name of target.unicodeAlphaNames!) {
			writeUnicodeString(writer, name);
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
	1054,
	target => target.urlsList !== undefined,
	(reader, target, _, options) => {
		const count = readUint32(reader);

		if (count) {
			if (!options.throwForMissingFeatures) return;
			throw new Error('Not implemented: URL List');
		}

		target.urlsList = [];
	},
	(writer, target) => {
		writeUint32(writer, target.urlsList!.length);

		if (target.urlsList!.length)
			throw new Error('Not implemented: URL List');
	},
);

// addHandler(
// 	1050,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1050] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1050]); target;
// 	},
// );

addHandler(
	1064,
	target => target.pixelAspectRatio !== undefined,
	(reader, target) => {
		const version = readUint32(reader);
		if (version > 2) throw new Error('Invalid pixelAspectRatio version');

		target.pixelAspectRatio = { aspect: readFloat64(reader) };
	},
	(writer, target) => {
		writeUint32(writer, 2); // version
		writeFloat64(writer, target.pixelAspectRatio!.aspect);
	},
);

// addHandler(
// 	1039,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1039] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1039]); target;
// 	},
// );

// addHandler(
// 	1044,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1044] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1044]); target;
// 	},
// );

addHandler(
	1036,
	target => target.thumbnail !== undefined,
	(reader, target, left) => {
		const format = readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
		const width = readUint32(reader);
		const height = readUint32(reader);
		const widthBytes = readUint32(reader); // = (width * bits_per_pixel + 31) / 32 * 4.
		const totalSize = readUint32(reader); // = widthBytes * height * planes
		const sizeAfterCompression = readUint32(reader);
		const bitsPerPixel = readUint16(reader); // 24
		const planes = readUint16(reader); // 1

		if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
			console.log(`invalid thumbnail data (format: ${format}, bitsPerPixel: ${bitsPerPixel}, planes: ${planes})`);
			skipBytes(reader, left());
			return;
		}

		width;
		height;
		widthBytes;
		totalSize;
		sizeAfterCompression;

		const size = left();
		const bytes = readBytes(reader, size);
		target.thumbnail = createCanvasFromData(bytes);
	},
	(writer, target) => {
		const thumb = target.thumbnail!;
		const data = toByteArray(thumb.toDataURL('image/jpeg', 1).substr('data:image/jpeg;base64,'.length));
		const bitsPerPixel = 24;
		const widthBytes = (thumb.width * bitsPerPixel + 31) / 32 * 4;
		const planes = 1;
		const totalSize = widthBytes * thumb.height * planes;
		const sizeAfterCompression = data.length;

		writeUint32(writer, 1); // 1 = kJpegRGB
		writeUint32(writer, thumb.width);
		writeUint32(writer, thumb.height);
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

// addHandler(
// 	1058,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1058] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1058]); target;
// 	},
// );
