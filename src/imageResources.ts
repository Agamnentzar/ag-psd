import { ImageResources } from './psd';
import { PsdReader, readPascalString, readUnicodeString, readUint32, readUint16, readUint8, readFloat64 } from './psdReader';
import { PsdWriter, writePascalString, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16 } from './psdWriter';

export interface ResourceHandler {
	key: number;
	has: (target: ImageResources) => boolean;
	read: (reader: PsdReader, target: ImageResources, left: () => number) => void;
	write: (writer: PsdWriter, target: ImageResources) => void;
}

const handlers: ResourceHandler[] = [];
const handlersMap: { [key: number]: ResourceHandler } = {};

function addHandler(
	key: number,
	has: (target: ImageResources) => boolean,
	read: (reader: PsdReader, target: ImageResources, left: () => number) => void,
	write: (writer: PsdWriter, target: ImageResources) => void,
) {
	const handler: ResourceHandler = { key, has, read, write };
	handlers.push(handler);
	handlersMap[handler.key] = handler;
}

export function getHandler(key: number, _name?: string) {
	return handlersMap[key];
}

export function getHandlers() {
	return handlers;
}

// 32-bit fixed-point number 16.16
function readFixedPoint32(reader: PsdReader): number {
	return readUint32(reader) / (1 << 16);
}

// 32-bit fixed-point number 16.16
function writeFixedPoint32(writer: PsdWriter, value: number) {
	writeUint32(writer, value * (1 << 16));
}

const RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
const MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];

addHandler(
	1005,
	target => typeof target.resolutionInfo !== 'undefined',
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

addHandler(
	1006,
	target => typeof target.alphaChannelNames !== 'undefined',
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
	1024,
	target => typeof target.layerState !== 'undefined',
	(reader, target) => {
		target.layerState = readUint16(reader);
	},
	(writer, target) => {
		writeUint16(writer, target.layerState!);
	},
);

addHandler(
	1026,
	target => typeof target.layersGroup !== 'undefined',
	(reader, target, left) => {
		target.layersGroup = [];

		while (left()) {
			target.layersGroup.push(readUint16(reader));
		}
	},
	(writer, target) => {
		for (const g of target.layersGroup!) {
			writeUint32(writer, g);
		}
	},
);

addHandler(
	1032,
	target => typeof target.gridAndGuidesInformation !== 'undefined',
	(reader, target) => {
		target.gridAndGuidesInformation = {
			version: readUint32(reader),
			grid: {
				horizontal: readUint32(reader),
				vertical: readUint32(reader),
			},
			guides: [],
		};

		let count = readUint32(reader);

		while (count--) {
			target.gridAndGuidesInformation.guides!.push({
				location: readUint32(reader) / 32,
				direction: readUint8(reader) ? 'horizontal' : 'vertical'
			});
		}
	},
	(writer, target) => {
		const info = target.gridAndGuidesInformation!;
		const version = info.version || 1;
		const grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
		const guides = info.guides || [];

		writeUint32(writer, version);
		writeUint32(writer, grid.horizontal);
		writeUint32(writer, grid.vertical);
		writeUint32(writer, guides.length);

		guides.forEach(g => {
			writeUint32(writer, g.location * 32);
			writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
		});
	},
);

addHandler(
	1037,
	target => typeof target.globalAngle !== 'undefined',
	(reader, target) => {
		target.globalAngle = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.globalAngle!);
	},
);

addHandler(
	1045,
	target => typeof target.unicodeAlphaNames !== 'undefined',
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
	1049,
	target => typeof target.globalAltitude !== 'undefined',
	(reader, target) => {
		target.globalAltitude = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.globalAltitude!);
	},
);

addHandler(
	1053,
	target => typeof target.alphaIdentifiers !== 'undefined',
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
	target => typeof target.urlsList !== 'undefined',
	(reader, target) => {
		const count = readUint32(reader);
		target.urlsList = [];

		if (count)
			throw new Error('Not implemented: URL List');
	},
	(writer, target) => {
		writeUint32(writer, target.urlsList!.length);

		if (target.urlsList!.length)
			throw new Error('Not implemented: URL List');
	},
);

addHandler(
	1057,
	target => typeof target.versionInfo !== 'undefined',
	(reader, target) => {
		target.versionInfo = {
			version: readUint32(reader),
			hasRealMergedData: !!readUint8(reader),
			writerName: readUnicodeString(reader),
			readerName: readUnicodeString(reader),
			fileVersion: readUint32(reader),
		};
	},
	(writer, target) => {
		const versionInfo = target.versionInfo!;
		writeUint32(writer, versionInfo.version);
		writeUint8(writer, versionInfo.hasRealMergedData ? 1 : 0);
		writeUnicodeString(writer, versionInfo.writerName);
		writeUnicodeString(writer, versionInfo.readerName);
		writeUint32(writer, versionInfo.fileVersion);
	},
);

addHandler(
	1064,
	target => typeof target.pixelAspectRatio !== 'undefined',
	(reader, target) => {
		target.pixelAspectRatio = {
			version: readUint32(reader),
			aspect: readFloat64(reader),
		};
	},
	(writer, target) => {
		writeUint32(writer, target.pixelAspectRatio!.version);
		writeFloat64(writer, target.pixelAspectRatio!.aspect);
	},
);

addHandler(
	1069,
	target => typeof target.layerSelectionIds !== 'undefined',
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
	1072,
	target => typeof target.layerGroupsEnabledId !== 'undefined',
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

//private writeThumbnailResource(thumb: HTMLCanvasElement) {
// this.writeSignature('8BIM');
// this.writeUint16(1036); // resource ID
// this.writeUint16(0); // name (pascal string)
// this.section(2,() => { // size
//     this.writeUint32(0); // format (1 = kJpegRGB; 0 = kRawRGB)
//     this.writeUint32(thumb.width); // width
//     this.writeUint32(thumb.height); // height
//     // Widthbytes: Padded row bytes = (width * bits per pixel + 31) / 32 * 4
//     this.writeUint32((((thumb.width * 8 * 4 + 31) / 32) | 0) * 4);
//     var compressedSizeOffset = writer.getOffset();
//     this.writeUint32(0); // size after compression
//     this.writeUint16(24); // bits per pixel
//     this.writeUint16(1); // number of planes
//     // TODO: actual JFIF thumbnail data here
//
//     const array = new Uint8Array(thumbData);
//
//     for (let i = 0; i < array.length; i++)
//         this.writeUint8(array[i]);
// });
//}
