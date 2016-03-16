import { ImageResources } from './psd';
import PsdReader from './psdReader';
import PsdWriter from './psdWriter';

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

export function getHandler(key: number) {
	return handlersMap[key];
}

export function getHandlers() {
	return handlers;
}

addHandler({
	key: 1006,
	has: target => typeof target.alphaChannelNames !== 'undefined',
	read: (reader, target, left) => {
		target.alphaChannelNames = [];

		if (left())
			target.alphaChannelNames.push(reader.readPascalString(1));
	},
	write: (writer, target) => {
		for (let name of target.alphaChannelNames)
			writer.writePascalString(name);
	},
});

addHandler({
	key: 1024,
	has: target => typeof target.layerState !== 'undefined',
	read: (reader, target) => {
		target.layerState = reader.readUint16();
	},
	write: (writer, target) => {
		writer.writeUint16(target.layerState);
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
		for (let g of target.layersGroup)
			writer.writeUint32(g);
	},
});

addHandler({
	key: 1037,
	has: target => typeof target.globalAngle !== 'undefined',
	read: (reader, target) => {
		target.globalAngle = reader.readUint32();
	},
	write: (writer, target) => {
		writer.writeUint32(target.globalAngle);
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
		for (let name of target.unicodeAlphaNames)
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
		writer.writeUint32(target.globalAltitude);
	},
});

addHandler({
	key: 1053,
	has: target => typeof target.alphaIdentifiers !== 'undefined',
	read: (reader, target) => {
		let count = reader.readUint32();
		target.alphaIdentifiers = [];

		while (count--)
			target.alphaIdentifiers.push(reader.readUint32());
	},
	write: (writer, target) => {
		writer.writeUint32(target.alphaIdentifiers.length);

		for (let id of target.alphaIdentifiers)
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
		writer.writeUint32(target.urlsList.length);

		if (target.urlsList.length)
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
		writer.writeUint32(target.versionInfo.version);
		writer.writeUint8(target.versionInfo.hasRealMergedData ? 1 : 0);
		writer.writeUnicodeString(target.versionInfo.writerName);
		writer.writeUnicodeString(target.versionInfo.readerName);
		writer.writeUint32(target.versionInfo.fileVersion);
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
		writer.writeUint32(target.pixelAspectRatio.version);
		writer.writeFloat64(target.pixelAspectRatio.aspect);
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
		writer.writeUint16(target.layerSelectionIds.length);

		for (let id of target.layerSelectionIds)
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
		for (let id of target.layerGroupsEnabledId)
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
