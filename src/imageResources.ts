import { ImageResources } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';

export interface ResourceHandler {
	key: number;
	has: (target: ImageResources) => boolean;
	read: (reader: PsdReader, target: ImageResources, left: () => number) => void;
	write: (writer: PsdWriter, target: ImageResources) => void;
}

let handlers: ResourceHandler[] = [];
let handlersMap: { [key: number]: ResourceHandler } = {};

function addHandler(handler: ResourceHandler) {
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
	return reader.readUint32() / (1 << 16);
}

// 32-bit fixed-point number 16.16
function writeFixedPoint32(writer: PsdWriter, value: number) {
	writer.writeUint32(value * (1 << 16));
}

const RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
const MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];

addHandler({
	key: 1005,
	has: target => typeof target.resolutionInfo !== 'undefined',
	read: (reader, target) => {
		const horizontalResolution = readFixedPoint32(reader);
		const horizontalResolutionUnit = reader.readUint16();
		const widthUnit = reader.readUint16();
		const verticalResolution = readFixedPoint32(reader);
		const verticalResolutionUnit = reader.readUint16();
		const heightUnit = reader.readUint16();

		target.resolutionInfo = {
			horizontalResolution,
			horizontalResolutionUnit: RESOLUTION_UNITS[horizontalResolutionUnit] || 'PPI' as any,
			widthUnit: MEASUREMENT_UNITS[widthUnit] || 'Inches' as any,
			verticalResolution,
			verticalResolutionUnit: RESOLUTION_UNITS[verticalResolutionUnit] || 'PPI' as any,
			heightUnit: MEASUREMENT_UNITS[heightUnit] || 'Inches' as any,
		};
	},
	write: (writer, target) => {
		const info = target.resolutionInfo!;

		writeFixedPoint32(writer, info.horizontalResolution || 0);
		writer.writeUint16(Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
		writer.writeUint16(Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
		writeFixedPoint32(writer, info.verticalResolution || 0);
		writer.writeUint16(Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
		writer.writeUint16(Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
	},
});

addHandler({
	key: 1006,
	has: target => typeof target.alphaChannelNames !== 'undefined',
	read: (reader, target, left) => {
		target.alphaChannelNames = [];

		while (left()) {
			target.alphaChannelNames.push(reader.readPascalString(1));
		}
	},
	write: (writer, target) => {
		for (let name of target.alphaChannelNames!) {
			writer.writePascalString(name);
		}
	},
});

addHandler({
	key: 1024,
	has: target => typeof target.layerState !== 'undefined',
	read: (reader, target) => {
		target.layerState = reader.readUint16();
	},
	write: (writer, target) => {
		writer.writeUint16(target.layerState!);
	},
});

addHandler({
	key: 1026,
	has: target => typeof target.layersGroup !== 'undefined',
	read: (reader, target, left) => {
		target.layersGroup = [];

		while (left())
			target.layersGroup.push(reader.readUint16());
	},
	write: (writer, target) => {
		for (let g of target.layersGroup!)
			writer.writeUint32(g);
	},
});

addHandler({
	key: 1032,
	has: target => typeof target.gridAndGuidesInformation !== 'undefined',
	read: (reader, target) => {
		target.gridAndGuidesInformation = {
			version: reader.readUint32(),
			grid: {
				horizontal: reader.readUint32(),
				vertical: reader.readUint32(),
			},
			guides: [],
		};

		let count = reader.readUint32();

		while (count--) {
			target.gridAndGuidesInformation.guides!.push({
				location: reader.readUint32() / 32,
				direction: reader.readUint8() ? 'horizontal' : 'vertical'
			});
		}
	},
	write: (writer, target) => {
		const info = target.gridAndGuidesInformation!;
		const version = info.version || 1;
		const grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
		const guides = info.guides || [];

		writer.writeUint32(version);
		writer.writeUint32(grid.horizontal);
		writer.writeUint32(grid.vertical);
		writer.writeUint32(guides.length);

		guides.forEach(g => {
			writer.writeUint32(g.location * 32);
			writer.writeUint8(g.direction === 'horizontal' ? 1 : 0);
		});
	},
});

addHandler({
	key: 1037,
	has: target => typeof target.globalAngle !== 'undefined',
	read: (reader, target) => {
		target.globalAngle = reader.readUint32();
	},
	write: (writer, target) => {
		writer.writeUint32(target.globalAngle!);
	},
});

addHandler({
	key: 1045,
	has: target => typeof target.unicodeAlphaNames !== 'undefined',
	read: (reader, target, left) => {
		target.unicodeAlphaNames = [];

		while (left())
			target.unicodeAlphaNames.push(reader.readUnicodeString());
	},
	write: (writer, target) => {
		for (let name of target.unicodeAlphaNames!)
			writer.writeUnicodeString(name);
	},
});

addHandler({
	key: 1049,
	has: target => typeof target.globalAltitude !== 'undefined',
	read: (reader, target) => {
		target.globalAltitude = reader.readUint32();
	},
	write: (writer, target) => {
		writer.writeUint32(target.globalAltitude!);
	},
});

addHandler({
	key: 1053,
	has: target => typeof target.alphaIdentifiers !== 'undefined',
	read: (reader, target, left) => {
		target.alphaIdentifiers = [];

		while (left() >= 4)
			target.alphaIdentifiers.push(reader.readUint32());
	},
	write: (writer, target) => {
		for (let id of target.alphaIdentifiers!)
			writer.writeUint32(id);
	},
});

addHandler({
	key: 1054,
	has: target => typeof target.urlsList !== 'undefined',
	read: (reader, target) => {
		let count = reader.readUint32();
		target.urlsList = [];

		if (count)
			throw new Error('Not implemented: URL List');
	},
	write: (writer, target) => {
		writer.writeUint32(target.urlsList!.length);

		if (target.urlsList!.length)
			throw new Error('Not implemented: URL List');
	},
});

addHandler({
	key: 1057,
	has: target => typeof target.versionInfo !== 'undefined',
	read: (reader, target) => {
		target.versionInfo = {
			version: reader.readUint32(),
			hasRealMergedData: !!reader.readUint8(),
			writerName: reader.readUnicodeString(),
			readerName: reader.readUnicodeString(),
			fileVersion: reader.readUint32(),
		};
	},
	write: (writer, target) => {
		const versionInfo = target.versionInfo!;
		writer.writeUint32(versionInfo.version);
		writer.writeUint8(versionInfo.hasRealMergedData ? 1 : 0);
		writer.writeUnicodeString(versionInfo.writerName);
		writer.writeUnicodeString(versionInfo.readerName);
		writer.writeUint32(versionInfo.fileVersion);
	},
});

addHandler({
	key: 1064,
	has: target => typeof target.pixelAspectRatio !== 'undefined',
	read: (reader, target) => {
		target.pixelAspectRatio = {
			version: reader.readUint32(),
			aspect: reader.readFloat64(),
		};
	},
	write: (writer, target) => {
		writer.writeUint32(target.pixelAspectRatio!.version);
		writer.writeFloat64(target.pixelAspectRatio!.aspect);
	},
});

addHandler({
	key: 1069,
	has: target => typeof target.layerSelectionIds !== 'undefined',
	read: (reader, target) => {
		let count = reader.readUint16();
		target.layerSelectionIds = [];

		while (count--)
			target.layerSelectionIds.push(reader.readUint32());
	},
	write: (writer, target) => {
		writer.writeUint16(target.layerSelectionIds!.length);

		for (let id of target.layerSelectionIds!)
			writer.writeUint32(id);
	},
});

addHandler({
	key: 1072,
	has: target => typeof target.layerGroupsEnabledId !== 'undefined',
	read: (reader, target, left) => {
		target.layerGroupsEnabledId = [];

		while (left())
			target.layerGroupsEnabledId.push(reader.readUint8());
	},
	write: (writer, target) => {
		for (let id of target.layerGroupsEnabledId!)
			writer.writeUint8(id);
	},
});

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
//     let array = new Uint8Array(thumbData);
//
//     for (let i = 0; i < array.length; i++)
//         this.writeUint8(array[i]);
// });
//}
