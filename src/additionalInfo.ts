import { fromByteArray, toByteArray } from 'base64-js';
import { readEffects, writeEffects } from './effectsHelpers';
import { clamp, createEnum, layerColors, MOCK_HANDLERS } from './helpers';
import { LayerAdditionalInfo, BezierPath, Psd, BrightnessAdjustment, ExposureAdjustment, VibranceAdjustment, ColorBalanceAdjustment, BlackAndWhiteAdjustment, PhotoFilterAdjustment, ChannelMixerChannel, ChannelMixerAdjustment, PosterizeAdjustment, ThresholdAdjustment, GradientMapAdjustment, CMYK, SelectiveColorAdjustment, ColorLookupAdjustment, LevelsAdjustmentChannel, LevelsAdjustment, CurvesAdjustment, CurvesAdjustmentChannel, HueSaturationAdjustment, HueSaturationAdjustmentChannel, PresetInfo, Color, ColorBalanceValues, WriteOptions, LinkedFile, PlacedLayerType, Warp, KeyDescriptorItem, BooleanOperation, LayerEffectsInfo, Annotation, LayerVectorMask, AnimationFrame, Timeline, PlacedLayerFilter, UnitsValue, Filter, PlacedLayer, ReadOptions, Layer } from './psd';
import { PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16, readBytes, readInt16, checkSignature, readFloat32, readFixedPointPath32, readSection, readColor, readInt32, readPascalString, readUnicodeStringWithLength, readAsciiString, readPattern, readLayerInfo } from './psdReader';
import { PsdWriter, writeZeros, writeSignature, writeBytes, writeUint32, writeUint16, writeFloat64, writeUint8, writeInt16, writeFloat32, writeFixedPointPath32, writeUnicodeString, writeSection, writeUnicodeStringWithPadding, writeColor, writePascalString, writeInt32 } from './psdWriter';
import { Annt, BlnM, DescriptorColor, DescriptorUnitsValue, parsePercent, parseUnits, parseUnitsOrNumber, QuiltWarpDescriptor, strokeStyleLineAlignment, strokeStyleLineCapType, strokeStyleLineJoinType, TextDescriptor, textGridding, unitsPercent, unitsValue, WarpDescriptor, warpStyle, writeVersionAndDescriptor, readVersionAndDescriptor, StrokeDescriptor, Ornt, horzVrtcToXY, LmfxDescriptor, Lfx2Descriptor, FrameListDescriptor, TimelineDescriptor, FrameDescriptor, xyToHorzVrtc, serializeEffects, parseEffects, parseColor, serializeColor, serializeVectorContent, parseVectorContent, parseTrackList, serializeTrackList, FractionDescriptor, BlrM, BlrQ, SmBQ, SmBM, DspM, UndA, Cnvr, RplS, SphM, Wvtp, ZZTy, Dstr, Chnl, MztT, Lns, blurType, DfsM, ExtT, ExtR, FlCl, CntE, WndM, Drct, IntE, IntC, FlMd, unitsPercentF, frac, ClrS, descBoundsToBounds, boundsToDescBounds, presetKindType } from './descriptor';
import { serializeEngineData, parseEngineData } from './engineData';
import { encodeEngineData, decodeEngineData } from './text';
import { decodeEngineData2 } from './engineData2';
import type { InternalImageResources } from './imageResources';

export interface ExtendedWriteOptions extends WriteOptions {
	layerIds: Set<number>;
	layerToId: Map<any, number>;
}

type HasMethod = (target: LayerAdditionalInfo) => boolean;
type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd, imageResources: InternalImageResources) => void;
type WriteMethod = (writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: ExtendedWriteOptions) => void;

export interface InfoHandler {
	key: string;
	has: HasMethod;
	read: ReadMethod;
	write: WriteMethod;
}

const fromAtoZ = 'abcdefghijklmnopqrstuvwxyz';
export const infoHandlers: InfoHandler[] = [];
export const infoHandlersMap: { [key: string]: InfoHandler; } = {};

function addHandler(key: string, has: HasMethod, read: ReadMethod, write: WriteMethod) {
	const handler: InfoHandler = { key, has, read, write };
	infoHandlers.push(handler);
	infoHandlersMap[handler.key] = handler;
}

function addHandlerAlias(key: string, target: string) {
	infoHandlersMap[key] = infoHandlersMap[target];
}

function hasKey(key: keyof LayerAdditionalInfo) {
	return (target: LayerAdditionalInfo) => target[key] !== undefined;
}

function readLength64(reader: PsdReader) {
	if (readUint32(reader)) throw new Error(`Resource size above 4 GB limit at ${reader.offset.toString(16)}`);
	return readUint32(reader);
}

function writeLength64(writer: PsdWriter, length: number) {
	writeUint32(writer, 0);
	writeUint32(writer, length);
}

addHandler(
	'TySh',
	hasKey('text'),
	(reader, target, leftBytes) => {
		if (readInt16(reader) !== 1) throw new Error(`Invalid TySh version`);

		const transform: number[] = [];
		for (let i = 0; i < 6; i++) transform.push(readFloat64(reader));

		if (readInt16(reader) !== 50) throw new Error(`Invalid TySh text version`);
		const text: TextDescriptor = readVersionAndDescriptor(reader);
		// console.log(require('util').inspect(text, false, 99, false), 'utf8');

		if (readInt16(reader) !== 1) throw new Error(`Invalid TySh warp version`);
		const warp: WarpDescriptor = readVersionAndDescriptor(reader);
		// console.log(require('util').inspect(warp, false, 99, false), 'utf8');

		target.text = {
			transform,
			left: readFloat32(reader),
			top: readFloat32(reader),
			right: readFloat32(reader),
			bottom: readFloat32(reader),
			text: text['Txt '].replace(/\r/g, '\n'),
			index: text.TextIndex || 0,
			gridding: textGridding.decode(text.textGridding),
			antiAlias: Annt.decode(text.AntA),
			orientation: Ornt.decode(text.Ornt),
			warp: {
				style: warpStyle.decode(warp.warpStyle),
				value: warp.warpValue || 0,
				perspective: warp.warpPerspective || 0,
				perspectiveOther: warp.warpPerspectiveOther || 0,
				rotate: Ornt.decode(warp.warpRotate),
			},
		};

		if (text.bounds) target.text.bounds = descBoundsToBounds(text.bounds);
		if (text.boundingBox) target.text.boundingBox = descBoundsToBounds(text.boundingBox);

		if (text.EngineData) {
			const engineData = parseEngineData(text.EngineData);
			const textData = decodeEngineData(engineData);
			// console.log(require('util').inspect(engineData, false, 99, false), 'utf8');

			// require('fs').writeFileSync(`layer-${target.name}.txt`, require('util').inspect(engineData, false, 99, false), 'utf8');
			// const before = parseEngineData(text.EngineData);
			// const after = encodeEngineData(engineData);
			// require('fs').writeFileSync('before.txt', require('util').inspect(before, false, 99, false), 'utf8');
			// require('fs').writeFileSync('after.txt', require('util').inspect(after, false, 99, false), 'utf8');

			// console.log(require('util').inspect(parseEngineData(text.EngineData), false, 99, true));
			target.text = { ...target.text, ...textData };
			// console.log(require('util').inspect(target.text, false, 99, true));
		}

		skipBytes(reader, leftBytes());
	},
	(writer, target) => {
		const text = target.text!;
		const warp = text.warp || {};
		const transform = text.transform || [1, 0, 0, 1, 0, 0];

		const textDescriptor: TextDescriptor = {
			'Txt ': (text.text || '').replace(/\r?\n/g, '\r'),
			textGridding: textGridding.encode(text.gridding),
			Ornt: Ornt.encode(text.orientation),
			AntA: Annt.encode(text.antiAlias),
			...(text.bounds ? { bounds: boundsToDescBounds(text.bounds) } : {}),
			...(text.boundingBox ? { boundingBox: boundsToDescBounds(text.boundingBox) } : {}),
			TextIndex: text.index || 0,
			EngineData: serializeEngineData(encodeEngineData(text)),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i]);
		}

		writeInt16(writer, 50); // text version
		writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor, 'text');

		writeInt16(writer, 1); // warp version
		writeVersionAndDescriptor(writer, '', 'warp', encodeWarp(warp));

		writeFloat32(writer, text.left!);
		writeFloat32(writer, text.top!);
		writeFloat32(writer, text.right!);
		writeFloat32(writer, text.bottom!);

		// writeZeros(writer, 2);
	},
);

// vector fills

addHandler(
	'SoCo',
	target => target.vectorFill !== undefined && target.vectorStroke === undefined &&
		target.vectorFill.type === 'color',
	(reader, target) => {
		const descriptor = readVersionAndDescriptor(reader);
		target.vectorFill = parseVectorContent(descriptor);
	},
	(writer, target) => {
		const { descriptor } = serializeVectorContent(target.vectorFill!);
		writeVersionAndDescriptor(writer, '', 'null', descriptor);
	},
);

addHandler(
	'GdFl',
	target => target.vectorFill !== undefined && target.vectorStroke === undefined &&
		(target.vectorFill.type === 'solid' || target.vectorFill.type === 'noise'),
	(reader, target, left) => {
		const descriptor = readVersionAndDescriptor(reader);
		target.vectorFill = parseVectorContent(descriptor);
		skipBytes(reader, left());
	},
	(writer, target) => {
		const { descriptor } = serializeVectorContent(target.vectorFill!);
		writeVersionAndDescriptor(writer, '', 'null', descriptor);
	},
);

addHandler(
	'PtFl',
	target => target.vectorFill !== undefined && target.vectorStroke === undefined &&
		target.vectorFill.type === 'pattern',
	(reader, target) => {
		const descriptor = readVersionAndDescriptor(reader);
		target.vectorFill = parseVectorContent(descriptor);
	},
	(writer, target) => {
		const { descriptor } = serializeVectorContent(target.vectorFill!);
		writeVersionAndDescriptor(writer, '', 'null', descriptor);
	},
);

addHandler(
	'vscg',
	target => target.vectorFill !== undefined && target.vectorStroke !== undefined,
	(reader, target, left) => {
		readSignature(reader); // key
		const desc = readVersionAndDescriptor(reader);
		target.vectorFill = parseVectorContent(desc);
		skipBytes(reader, left());
	},
	(writer, target) => {
		const { descriptor, key } = serializeVectorContent(target.vectorFill!);
		writeSignature(writer, key);
		writeVersionAndDescriptor(writer, '', 'null', descriptor);
	},
);

export function readBezierKnot(reader: PsdReader, width: number, height: number) {
	const y0 = readFixedPointPath32(reader) * height;
	const x0 = readFixedPointPath32(reader) * width;
	const y1 = readFixedPointPath32(reader) * height;
	const x1 = readFixedPointPath32(reader) * width;
	const y2 = readFixedPointPath32(reader) * height;
	const x2 = readFixedPointPath32(reader) * width;
	return [x0, y0, x1, y1, x2, y2];
}

function writeBezierKnot(writer: PsdWriter, points: number[], width: number, height: number) {
	writeFixedPointPath32(writer, points[1] / height); // y0
	writeFixedPointPath32(writer, points[0] / width); // x0
	writeFixedPointPath32(writer, points[3] / height); // y1
	writeFixedPointPath32(writer, points[2] / width); // x1
	writeFixedPointPath32(writer, points[5] / height); // y2
	writeFixedPointPath32(writer, points[4] / width); // x2
}

export const booleanOperations: BooleanOperation[] = ['exclude', 'combine', 'subtract', 'intersect'];

export function readVectorMask(reader: PsdReader, vectorMask: LayerVectorMask, width: number, height: number, size: number) {
	const end = reader.offset + size;
	const paths = vectorMask.paths;
	let path: BezierPath | undefined = undefined;

	while ((end - reader.offset) >= 26) {
		const selector = readUint16(reader);

		switch (selector) {
			case 0: // Closed subpath length record
			case 3: { // Open subpath length record
				readUint16(reader); // count
				const boolOp = readInt16(reader);
				const flags = readUint16(reader); // bit 1 always 1 ?
				skipBytes(reader, 18);
				path = {
					open: selector === 3,
					knots: [],
					fillRule: flags === 2 ? 'non-zero' : 'even-odd',
				};
				if (boolOp !== -1) path.operation = booleanOperations[boolOp];
				paths.push(path);
				break;
			}
			case 1: // Closed subpath Bezier knot, linked
			case 2: // Closed subpath Bezier knot, unlinked
			case 4: // Open subpath Bezier knot, linked
			case 5: // Open subpath Bezier knot, unlinked
				path!.knots.push({ linked: (selector === 1 || selector === 4), points: readBezierKnot(reader, width, height) });
				break;
			case 6: // Path fill rule record
				skipBytes(reader, 24);
				break;
			case 7: { // Clipboard record
				// TODO: check if these need to be multiplied by document size
				const top = readFixedPointPath32(reader);
				const left = readFixedPointPath32(reader);
				const bottom = readFixedPointPath32(reader);
				const right = readFixedPointPath32(reader);
				const resolution = readFixedPointPath32(reader);
				skipBytes(reader, 4);
				vectorMask.clipboard = { top, left, bottom, right, resolution };
				break;
			}
			case 8: // Initial fill rule record
				vectorMask.fillStartsWithAllPixels = !!readUint16(reader);
				skipBytes(reader, 22);
				break;
			default: throw new Error('Invalid vmsk section');
		}
	}

	return paths;
}

addHandler(
	'vmsk',
	hasKey('vectorMask'),
	(reader, target, left, { width, height }) => {
		if (readUint32(reader) !== 3) throw new Error('Invalid vmsk version');

		target.vectorMask = { paths: [] };
		const vectorMask = target.vectorMask;

		const flags = readUint32(reader);
		vectorMask.invert = (flags & 1) !== 0;
		vectorMask.notLink = (flags & 2) !== 0;
		vectorMask.disable = (flags & 4) !== 0;

		readVectorMask(reader, vectorMask, width, height, left());

		// drawBezierPaths(vectorMask.paths, width, height, 'out.png');

		skipBytes(reader, left());
	},
	(writer, target, { width, height }) => {
		const vectorMask = target.vectorMask!;
		const flags =
			(vectorMask.invert ? 1 : 0) |
			(vectorMask.notLink ? 2 : 0) |
			(vectorMask.disable ? 4 : 0);

		writeUint32(writer, 3); // version
		writeUint32(writer, flags);

		// initial entry
		writeUint16(writer, 6);
		writeZeros(writer, 24);

		const clipboard = vectorMask.clipboard;
		if (clipboard) {
			writeUint16(writer, 7);
			writeFixedPointPath32(writer, clipboard.top);
			writeFixedPointPath32(writer, clipboard.left);
			writeFixedPointPath32(writer, clipboard.bottom);
			writeFixedPointPath32(writer, clipboard.right);
			writeFixedPointPath32(writer, clipboard.resolution);
			writeZeros(writer, 4);
		}

		if (vectorMask.fillStartsWithAllPixels !== undefined) {
			writeUint16(writer, 8);
			writeUint16(writer, vectorMask.fillStartsWithAllPixels ? 1 : 0);
			writeZeros(writer, 22);
		}

		for (const path of vectorMask.paths) {
			writeUint16(writer, path.open ? 3 : 0);
			writeUint16(writer, path.knots.length);
			writeUint16(writer, path.operation ? booleanOperations.indexOf(path.operation) : -1); // -1 for undefined
			writeUint16(writer, path.fillRule === 'non-zero' ? 2 : 1);
			writeZeros(writer, 18); // TODO: these are sometimes non-zero

			const linkedKnot = path.open ? 4 : 1;
			const unlinkedKnot = path.open ? 5 : 2;

			for (const { linked, points } of path.knots) {
				writeUint16(writer, linked ? linkedKnot : unlinkedKnot);
				writeBezierKnot(writer, points, width, height);
			}
		}
	},
);

// TODO: need to write vmsk if has outline ?
addHandlerAlias('vsms', 'vmsk');
// addHandlerAlias('vmsk', 'vsms');

addHandler(
	'vowv', // something with vectors?
	hasKey('vowv'),
	(reader, target) => {
		target.vowv = readUint32(reader); // always 2 ????
	},
	(writer, target) => {
		writeUint32(writer, target.vowv!);
	},
);

interface VogkDescriptor {
	keyDescriptorList: {
		keyShapeInvalidated?: boolean;
		keyOriginType?: number;
		keyOriginResolution?: number;
		keyOriginRRectRadii?: {
			unitValueQuadVersion: number;
			topRight: DescriptorUnitsValue;
			topLeft: DescriptorUnitsValue;
			bottomLeft: DescriptorUnitsValue;
			bottomRight: DescriptorUnitsValue;
		};
		keyOriginShapeBBox?: {
			unitValueQuadVersion: number;
			'Top ': DescriptorUnitsValue | number;
			Left: DescriptorUnitsValue | number;
			Btom: DescriptorUnitsValue | number;
			Rght: DescriptorUnitsValue | number;
		};
		keyOriginBoxCorners?: {
			rectangleCornerA: { Hrzn: number; Vrtc: number; };
			rectangleCornerB: { Hrzn: number; Vrtc: number; };
			rectangleCornerC: { Hrzn: number; Vrtc: number; };
			rectangleCornerD: { Hrzn: number; Vrtc: number; };
		};
		Trnf?: { xx: number; xy: number; yx: number; yy: number; tx: number; ty: number; },
		keyOriginIndex: number;
	}[];
}

addHandler(
	'vogk',
	hasKey('vectorOrigination'),
	(reader, target, left) => {
		if (readInt32(reader) !== 1) throw new Error(`Invalid vogk version`);
		const desc = readVersionAndDescriptor(reader) as VogkDescriptor;
		// console.log(require('util').inspect(desc, false, 99, true));

		target.vectorOrigination = { keyDescriptorList: [] };

		for (const i of desc.keyDescriptorList) {
			const item: KeyDescriptorItem = {};

			if (i.keyShapeInvalidated != null) item.keyShapeInvalidated = i.keyShapeInvalidated;
			if (i.keyOriginType != null) item.keyOriginType = i.keyOriginType;
			if (i.keyOriginResolution != null) item.keyOriginResolution = i.keyOriginResolution;
			if (i.keyOriginShapeBBox) {
				item.keyOriginShapeBoundingBox = {
					top: parseUnitsOrNumber(i.keyOriginShapeBBox['Top ']),
					left: parseUnitsOrNumber(i.keyOriginShapeBBox.Left),
					bottom: parseUnitsOrNumber(i.keyOriginShapeBBox.Btom),
					right: parseUnitsOrNumber(i.keyOriginShapeBBox.Rght),
				};
			}
			const rectRadii = i.keyOriginRRectRadii;
			if (rectRadii) {
				item.keyOriginRRectRadii = {
					topRight: parseUnits(rectRadii.topRight),
					topLeft: parseUnits(rectRadii.topLeft),
					bottomLeft: parseUnits(rectRadii.bottomLeft),
					bottomRight: parseUnits(rectRadii.bottomRight),
				};
			}
			const corners = i.keyOriginBoxCorners;
			if (corners) {
				item.keyOriginBoxCorners = [
					{ x: corners.rectangleCornerA.Hrzn, y: corners.rectangleCornerA.Vrtc },
					{ x: corners.rectangleCornerB.Hrzn, y: corners.rectangleCornerB.Vrtc },
					{ x: corners.rectangleCornerC.Hrzn, y: corners.rectangleCornerC.Vrtc },
					{ x: corners.rectangleCornerD.Hrzn, y: corners.rectangleCornerD.Vrtc },
				];
			}
			const trnf = i.Trnf;
			if (trnf) {
				item.transform = [trnf.xx, trnf.xy, trnf.xy, trnf.yy, trnf.tx, trnf.ty];
			}

			target.vectorOrigination.keyDescriptorList.push(item);
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		target;
		const orig = target.vectorOrigination!;
		const desc: VogkDescriptor = { keyDescriptorList: [] };

		for (let i = 0; i < orig.keyDescriptorList.length; i++) {
			const item = orig.keyDescriptorList[i];

			desc.keyDescriptorList.push({} as any); // we're adding keyOriginIndex at the end

			const out = desc.keyDescriptorList[desc.keyDescriptorList.length - 1];

			if (item.keyOriginType != null) out.keyOriginType = item.keyOriginType;
			if (item.keyOriginResolution != null) out.keyOriginResolution = item.keyOriginResolution;

			const radii = item.keyOriginRRectRadii;
			if (radii) {
				out.keyOriginRRectRadii = {
					unitValueQuadVersion: 1,
					topRight: unitsValue(radii.topRight, 'topRight'),
					topLeft: unitsValue(radii.topLeft, 'topLeft'),
					bottomLeft: unitsValue(radii.bottomLeft, 'bottomLeft'),
					bottomRight: unitsValue(radii.bottomRight, 'bottomRight'),
				};
			}

			const box = item.keyOriginShapeBoundingBox;
			if (box) {
				out.keyOriginShapeBBox = {
					unitValueQuadVersion: 1,
					'Top ': unitsValue(box.top, 'top'),
					Left: unitsValue(box.left, 'left'),
					Btom: unitsValue(box.bottom, 'bottom'),
					Rght: unitsValue(box.right, 'right'),
				};
			}

			const corners = item.keyOriginBoxCorners;
			if (corners && corners.length === 4) {
				out.keyOriginBoxCorners = {
					rectangleCornerA: { Hrzn: corners[0].x, Vrtc: corners[0].y },
					rectangleCornerB: { Hrzn: corners[1].x, Vrtc: corners[1].y },
					rectangleCornerC: { Hrzn: corners[2].x, Vrtc: corners[2].y },
					rectangleCornerD: { Hrzn: corners[3].x, Vrtc: corners[3].y },
				};
			}

			const transform = item.transform;
			if (transform && transform.length === 6) {
				out.Trnf = {
					xx: transform[0],
					xy: transform[1],
					yx: transform[2],
					yy: transform[3],
					tx: transform[4],
					ty: transform[5],
				};
			}

			if (item.keyShapeInvalidated != null) out.keyShapeInvalidated = item.keyShapeInvalidated;
			out.keyOriginIndex = i;
		}

		writeInt32(writer, 1); // version
		writeVersionAndDescriptor(writer, '', 'null', desc);
	}
);

addHandler(
	'lmfx',
	target => target.effects !== undefined && hasMultiEffects(target.effects),
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error('Invalid lmfx version');

		const desc: LmfxDescriptor = readVersionAndDescriptor(reader);
		// console.log('READ', require('util').inspect(desc, false, 99, true));

		// discard if read in 'lrFX' or 'lfx2' section
		target.effects = parseEffects(desc, !!reader.logMissingFeatures);

		skipBytes(reader, left());
	},
	(writer, target, _, options) => {
		const desc = serializeEffects(target.effects!, !!options.logMissingFeatures, true);
		// console.log('WRITE', require('util').inspect(desc, false, 99, true));

		writeUint32(writer, 0); // version
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

addHandler(
	'lrFX',
	hasKey('effects'),
	(reader, target, left) => {
		if (!target.effects) target.effects = readEffects(reader);

		skipBytes(reader, left());
	},
	(writer, target) => {
		writeEffects(writer, target.effects!);
	},
);

addHandler(
	'luni',
	hasKey('name'),
	(reader, target, left) => {
		if (left() > 4) {
			const length = readUint32(reader);

			if (left() >= (length * 2)) {
				target.name = readUnicodeStringWithLength(reader, length);
			} else {
				if (reader.logDevFeatures) reader.log('name in luni section is too long');
			}
		} else {
			if (reader.logDevFeatures) reader.log('empty luni section');
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		writeUnicodeString(writer, target.name!);
		// writeUint16(writer, 0); // padding (but not extending string length)
	},
);

addHandler(
	'lnsr',
	hasKey('nameSource'),
	(reader, target) => target.nameSource = readSignature(reader),
	(writer, target) => writeSignature(writer, target.nameSource!),
);

addHandler(
	'lyid',
	hasKey('id'),
	(reader, target) => {
		target.id = readUint32(reader);
	},
	(writer, target, _psd, options) => {
		let id = target.id!;
		while (options.layerIds.has(id)) id += 100; // make sure we don't have duplicate layer ids
		writeUint32(writer, id);
		options.layerIds.add(id);
		options.layerToId.set(target, id);
	},
);

addHandler(
	'lsct',
	hasKey('sectionDivider'),
	(reader, target, left) => {
		target.sectionDivider = { type: readUint32(reader) };

		if (left()) {
			checkSignature(reader, '8BIM');
			target.sectionDivider.key = readSignature(reader);
		}

		if (left()) {
			target.sectionDivider.subType = readUint32(reader);
		}
	},
	(writer, target) => {
		writeUint32(writer, target.sectionDivider!.type);

		if (target.sectionDivider!.key) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, target.sectionDivider!.key);

			if (target.sectionDivider!.subType !== undefined) {
				writeUint32(writer, target.sectionDivider!.subType);
			}
		}
	},
);

// it seems lsdk is used when there's a layer is nested more than 6 levels, but I don't know why?
// maybe some limitation of old version of PS?
addHandlerAlias('lsdk', 'lsct');

addHandler(
	'clbl',
	hasKey('blendClippendElements'),
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
	hasKey('blendInteriorElements'),
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
	hasKey('knockout'),
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
	'lmgm',
	hasKey('layerMaskAsGlobalMask'),
	(reader, target) => {
		target.layerMaskAsGlobalMask = !!readUint8(reader);
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.layerMaskAsGlobalMask ? 1 : 0);
		writeZeros(writer, 3);
	},
);

addHandler(
	'lspf',
	hasKey('protected'),
	(reader, target) => {
		const flags = readUint32(reader);
		target.protected = {
			transparency: (flags & 0x01) !== 0,
			composite: (flags & 0x02) !== 0,
			position: (flags & 0x04) !== 0,
		};

		if (flags & 0x08) target.protected.artboards = true;
	},
	(writer, target) => {
		const flags =
			(target.protected!.transparency ? 0x01 : 0) |
			(target.protected!.composite ? 0x02 : 0) |
			(target.protected!.position ? 0x04 : 0) |
			(target.protected!.artboards ? 0x08 : 0);

		writeUint32(writer, flags);
	},
);

addHandler(
	'lclr',
	hasKey('layerColor'),
	(reader, target) => {
		const color = readUint16(reader);
		skipBytes(reader, 6);
		target.layerColor = layerColors[color];
	},
	(writer, target) => {
		const index = layerColors.indexOf(target.layerColor!);
		writeUint16(writer, index === -1 ? 0 : index);
		writeZeros(writer, 6);
	},
);

interface CustomDescriptor {
	layerTime?: number;
}

interface CmlsDescriptor {
	origFXRefPoint?: { Hrzn: number; Vrtc: number; };
	LyrI: number;
	layerSettings: {
		enab?: boolean;
		Ofst?: { Hrzn: number; Vrtc: number; };
		FXRefPoint?: { Hrzn: number; Vrtc: number; };
		compList: number[];
	}[];
}

addHandler(
	'shmd', // Metadata setting
	target => target.timestamp !== undefined || target.animationFrames !== undefined || target.animationFrameFlags !== undefined || target.timeline !== undefined || target.comps !== undefined,
	(reader, target, left) => {
		const count = readUint32(reader);

		for (let i = 0; i < count; i++) {
			checkSignature(reader, '8BIM');
			const key = readSignature(reader);
			readUint8(reader); // copy
			skipBytes(reader, 3);

			readSection(reader, 1, left => {
				if (key === 'cust') {
					const desc = readVersionAndDescriptor(reader) as CustomDescriptor;
					// console.log('cust', target.name, require('util').inspect(desc, false, 99, true));
					if (desc.layerTime !== undefined) target.timestamp = desc.layerTime;
				} else if (key === 'mlst') {
					const desc = readVersionAndDescriptor(reader) as FrameListDescriptor;
					// console.log('mlst', target.name, require('util').inspect(desc, false, 99, true));

					target.animationFrames = [];

					for (let i = 0; i < desc.LaSt.length; i++) {
						const f = desc.LaSt[i];
						const frame: AnimationFrame = { frames: f.FrLs };
						if (f.enab !== undefined) frame.enable = f.enab;
						if (f.Ofst) frame.offset = horzVrtcToXY(f.Ofst);
						if (f.FXRf) frame.referencePoint = horzVrtcToXY(f.FXRf);
						if (f.Lefx) frame.effects = parseEffects(f.Lefx, !!reader.logMissingFeatures);
						if (f.blendOptions && f.blendOptions.Opct) frame.opacity = parsePercent(f.blendOptions.Opct);
						target.animationFrames.push(frame);
					}
				} else if (key === 'mdyn') {
					// frame flags
					readUint16(reader); // unknown
					const propagate = readUint8(reader);
					const flags = readUint8(reader);

					target.animationFrameFlags = {
						propagateFrameOne: !propagate,
						unifyLayerPosition: (flags & 1) !== 0,
						unifyLayerStyle: (flags & 2) !== 0,
						unifyLayerVisibility: (flags & 4) !== 0,
					};
				} else if (key === 'tmln') {
					const desc = readVersionAndDescriptor(reader) as TimelineDescriptor;
					const timeScope = desc.timeScope;
					// console.log('tmln', target.name, target.id, require('util').inspect(desc, false, 99, true));

					const timeline: Timeline = {
						start: frac(timeScope.Strt),
						duration: frac(timeScope.duration),
						inTime: frac(timeScope.inTime),
						outTime: frac(timeScope.outTime),
						autoScope: desc.autoScope,
						audioLevel: desc.audioLevel,
					};

					if (desc.trackList) {
						timeline.tracks = parseTrackList(desc.trackList, !!reader.logMissingFeatures);
					}

					target.timeline = timeline;
					// console.log('tmln:result', target.name, target.id, require('util').inspect(timeline, false, 99, true));
				} else if (key === 'cmls') {
					const desc = readVersionAndDescriptor(reader) as CmlsDescriptor;
					// console.log('cmls', require('util').inspect(desc, false, 99, true));

					target.comps = {
						settings: [],
					};

					if (desc.origFXRefPoint) target.comps.originalEffectsReferencePoint = { x: desc.origFXRefPoint.Hrzn, y: desc.origFXRefPoint.Vrtc };

					for (const item of desc.layerSettings) {
						target.comps.settings.push({ compList: item.compList });
						const t = target.comps.settings[target.comps.settings.length - 1];
						if ('enab' in item) t.enabled = item.enab;
						if (item.Ofst) t.offset = { x: item.Ofst.Hrzn, y: item.Ofst.Vrtc };
						if (item.FXRefPoint) t.effectsReferencePoint = { x: item.FXRefPoint.Hrzn, y: item.FXRefPoint.Vrtc };
					}
				} else if (key === 'extn') {
					interface ExtnDescriptor {
						generatorSettings: {
							exportAs: {
								exportOption: string;
							};
							layerTime: number;
						};
					}

					const desc = readVersionAndDescriptor(reader) as ExtnDescriptor;
					// console.log(require('util').inspect(desc, false, 99, true));
					desc; // TODO: save this
					reader.logMissingFeatures && reader.log('Unhandled "shmd" section key', key);
				} else {
					reader.logMissingFeatures && reader.log('Unhandled "shmd" section key', key);
				}

				skipBytes(reader, left());
			});
		}

		skipBytes(reader, left());
	},
	(writer, target, _, options) => {
		const { animationFrames, animationFrameFlags, timestamp, timeline, comps } = target;

		let count = 0;
		if (animationFrames) count++;
		if (animationFrameFlags) count++;
		if (timeline) count++;
		if (timestamp !== undefined) count++;
		if (comps) count++;
		writeUint32(writer, count);

		if (animationFrames) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, 'mlst');
			writeUint8(writer, 0); // copy (always false)
			writeZeros(writer, 3);
			writeSection(writer, 2, () => {
				const desc: FrameListDescriptor = {
					LaID: target.id ?? 0,
					LaSt: [],
				};

				for (let i = 0; i < animationFrames.length; i++) {
					const f = animationFrames[i];
					const frame: FrameDescriptor = {} as any;
					if (f.enable !== undefined) frame.enab = f.enable;
					frame.FrLs = f.frames;
					if (f.offset) frame.Ofst = xyToHorzVrtc(f.offset);
					if (f.referencePoint) frame.FXRf = xyToHorzVrtc(f.referencePoint);
					if (f.effects) frame.Lefx = serializeEffects(f.effects, false, false);
					if (f.opacity !== undefined) frame.blendOptions = { Opct: unitsPercent(f.opacity) };
					desc.LaSt.push(frame);
				}

				writeVersionAndDescriptor(writer, '', 'null', desc);
			}, true);
		}

		if (animationFrameFlags) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, 'mdyn');
			writeUint8(writer, 0); // copy (always false)
			writeZeros(writer, 3);
			writeSection(writer, 2, () => {
				writeUint16(writer, 0); // unknown
				writeUint8(writer, animationFrameFlags.propagateFrameOne ? 0x0 : 0xf);
				writeUint8(writer,
					(animationFrameFlags.unifyLayerPosition ? 1 : 0) |
					(animationFrameFlags.unifyLayerStyle ? 2 : 0) |
					(animationFrameFlags.unifyLayerVisibility ? 4 : 0));
			});
		}

		if (timeline) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, 'tmln');
			writeUint8(writer, 0); // copy (always false)
			writeZeros(writer, 3);
			writeSection(writer, 2, () => {
				const desc: TimelineDescriptor = {
					Vrsn: 1,
					timeScope: {
						Vrsn: 1,
						Strt: timeline.start,
						duration: timeline.duration,
						inTime: timeline.inTime,
						outTime: timeline.outTime,
					},
					autoScope: timeline.autoScope,
					audioLevel: timeline.audioLevel,
				} as any;

				if (timeline.tracks) {
					desc.trackList = serializeTrackList(timeline.tracks);
				}

				const id = options.layerToId.get(target) || target.id;
				if (!id) throw new Error('You need to provide layer.id value whan writing document with animations');
				desc.LyrI = id;

				// console.log('WRITE:tmln', target.name, target.id, require('util').inspect(desc, false, 99, true));
				writeVersionAndDescriptor(writer, '', 'null', desc, 'anim');
			}, true);
		}

		if (timestamp !== undefined) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, 'cust');
			writeUint8(writer, 0); // copy (always false)
			writeZeros(writer, 3);
			writeSection(writer, 2, () => {
				const desc: CustomDescriptor = {
					layerTime: timestamp,
				};
				writeVersionAndDescriptor(writer, '', 'metadata', desc);
			}, true);
		}

		if (comps) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, 'cmls');
			writeUint8(writer, 0); // copy (always false)
			writeZeros(writer, 3);
			writeSection(writer, 2, () => {
				const id = options.layerToId.get(target) || target.id;
				if (!id) throw new Error('You need to provide layer.id value whan writing document with layer comps');

				const desc: CmlsDescriptor = {} as any;

				if (comps.originalEffectsReferencePoint) {
					desc.origFXRefPoint = { Hrzn: comps.originalEffectsReferencePoint.x, Vrtc: comps.originalEffectsReferencePoint.y };
				}

				desc.LyrI = id;
				desc.layerSettings = [];

				for (const item of comps.settings) {
					const t: CmlsDescriptor['layerSettings'][0] = {} as any;
					if (item.enabled !== undefined) t.enab = item.enabled;
					if (item.offset) t.Ofst = { Hrzn: item.offset.x, Vrtc: item.offset.y };
					if (item.effectsReferencePoint) t.FXRefPoint = { Hrzn: item.effectsReferencePoint.x, Vrtc: item.effectsReferencePoint.y };
					t.compList = item.compList;
					desc.layerSettings.push(t);
				}

				// console.log('cmls', require('util').inspect(desc, false, 99, true));
				writeVersionAndDescriptor(writer, '', 'null', desc);
			}, true);
		}
	},
);

addHandler(
	'vstk',
	hasKey('vectorStroke'),
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as StrokeDescriptor;
		// console.log(require('util').inspect(desc, false, 99, true));

		target.vectorStroke = {
			strokeEnabled: desc.strokeEnabled,
			fillEnabled: desc.fillEnabled,
			lineWidth: parseUnits(desc.strokeStyleLineWidth),
			lineDashOffset: parseUnits(desc.strokeStyleLineDashOffset),
			miterLimit: desc.strokeStyleMiterLimit,
			lineCapType: strokeStyleLineCapType.decode(desc.strokeStyleLineCapType),
			lineJoinType: strokeStyleLineJoinType.decode(desc.strokeStyleLineJoinType),
			lineAlignment: strokeStyleLineAlignment.decode(desc.strokeStyleLineAlignment),
			scaleLock: desc.strokeStyleScaleLock,
			strokeAdjust: desc.strokeStyleStrokeAdjust,
			lineDashSet: desc.strokeStyleLineDashSet.map(parseUnits),
			blendMode: BlnM.decode(desc.strokeStyleBlendMode),
			opacity: parsePercent(desc.strokeStyleOpacity),
			content: parseVectorContent(desc.strokeStyleContent),
			resolution: desc.strokeStyleResolution,
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const stroke = target.vectorStroke!;
		const desc: StrokeDescriptor = {
			strokeStyleVersion: 2,
			strokeEnabled: !!stroke.strokeEnabled,
			fillEnabled: !!stroke.fillEnabled,
			strokeStyleLineWidth: stroke.lineWidth || { value: 3, units: 'Points' },
			strokeStyleLineDashOffset: stroke.lineDashOffset || { value: 0, units: 'Points' },
			strokeStyleMiterLimit: stroke.miterLimit ?? 100,
			strokeStyleLineCapType: strokeStyleLineCapType.encode(stroke.lineCapType),
			strokeStyleLineJoinType: strokeStyleLineJoinType.encode(stroke.lineJoinType),
			strokeStyleLineAlignment: strokeStyleLineAlignment.encode(stroke.lineAlignment),
			strokeStyleScaleLock: !!stroke.scaleLock,
			strokeStyleStrokeAdjust: !!stroke.strokeAdjust,
			strokeStyleLineDashSet: stroke.lineDashSet || [],
			strokeStyleBlendMode: BlnM.encode(stroke.blendMode),
			strokeStyleOpacity: unitsPercent(stroke.opacity ?? 1),
			strokeStyleContent: serializeVectorContent(
				stroke.content || { type: 'color', color: { r: 0, g: 0, b: 0 } }).descriptor,
			strokeStyleResolution: stroke.resolution ?? 72,
		};

		writeVersionAndDescriptor(writer, '', 'strokeStyle', desc);
	},
);

interface ArtbDescriptor {
	artboardRect: { 'Top ': number; Left: number; Btom: number; Rght: number; };
	guideIndeces: any[];
	artboardPresetName: string;
	'Clr ': DescriptorColor;
	artboardBackgroundType: number;
}

addHandler(
	'artb', // per-layer arboard info
	hasKey('artboard'),
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as ArtbDescriptor;
		const rect = desc.artboardRect;
		target.artboard = {
			rect: { top: rect['Top '], left: rect.Left, bottom: rect.Btom, right: rect.Rght },
			guideIndices: desc.guideIndeces,
			presetName: desc.artboardPresetName,
			color: parseColor(desc['Clr ']),
			backgroundType: desc.artboardBackgroundType,
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const artboard = target.artboard!;
		const rect = artboard.rect;
		const desc: ArtbDescriptor = {
			artboardRect: { 'Top ': rect.top, Left: rect.left, Btom: rect.bottom, Rght: rect.right },
			guideIndeces: artboard.guideIndices || [],
			artboardPresetName: artboard.presetName || '',
			'Clr ': serializeColor(artboard.color),
			artboardBackgroundType: artboard.backgroundType ?? 1,
		};

		writeVersionAndDescriptor(writer, '', 'artboard', desc);
	},
);

addHandler(
	'sn2P',
	hasKey('usingAlignedRendering'),
	(reader, target) => target.usingAlignedRendering = !!readUint32(reader),
	(writer, target) => writeUint32(writer, target.usingAlignedRendering ? 1 : 0),
);

const placedLayerTypes: PlacedLayerType[] = ['unknown', 'vector', 'raster', 'image stack'];

function parseWarp(warp: WarpDescriptor & QuiltWarpDescriptor): Warp {
	const result: Warp = {
		style: warpStyle.decode(warp.warpStyle),
		...(warp.warpValues ? { values: warp.warpValues } : { value: warp.warpValue || 0 }),
		perspective: warp.warpPerspective || 0,
		perspectiveOther: warp.warpPerspectiveOther || 0,
		rotate: Ornt.decode(warp.warpRotate),
		bounds: warp.bounds && {
			top: parseUnitsOrNumber(warp.bounds['Top ']),
			left: parseUnitsOrNumber(warp.bounds.Left),
			bottom: parseUnitsOrNumber(warp.bounds.Btom),
			right: parseUnitsOrNumber(warp.bounds.Rght),
		},
		uOrder: warp.uOrder,
		vOrder: warp.vOrder,
	};

	if (warp.deformNumRows != null || warp.deformNumCols != null) {
		result.deformNumRows = warp.deformNumRows;
		result.deformNumCols = warp.deformNumCols;
	}

	const envelopeWarp = warp.customEnvelopeWarp;
	if (envelopeWarp) {
		result.customEnvelopeWarp = {
			meshPoints: [],
		};

		const xs = envelopeWarp.meshPoints.find(i => i.type === 'Hrzn')?.values || [];
		const ys = envelopeWarp.meshPoints.find(i => i.type === 'Vrtc')?.values || [];

		for (let i = 0; i < xs.length; i++) {
			result.customEnvelopeWarp!.meshPoints.push({ x: xs[i], y: ys[i] });
		}

		if (envelopeWarp.quiltSliceX || envelopeWarp.quiltSliceY) {
			result.customEnvelopeWarp.quiltSliceX = envelopeWarp.quiltSliceX?.[0]?.values || [];
			result.customEnvelopeWarp.quiltSliceY = envelopeWarp.quiltSliceY?.[0]?.values || [];
		}
	}

	return result;
}

function isQuiltWarp(warp: Warp) {
	return warp.deformNumCols != null || warp.deformNumRows != null ||
		warp.customEnvelopeWarp?.quiltSliceX || warp.customEnvelopeWarp?.quiltSliceY;
}

function encodeWarp(warp: Warp): WarpDescriptor {
	const bounds = warp.bounds;
	const desc: WarpDescriptor = {
		warpStyle: warpStyle.encode(warp.style),
		...(warp.values ? { warpValues: warp.values } : { warpValue: warp.value || 0 }),
		warpPerspective: warp.perspective || 0,
		warpPerspectiveOther: warp.perspectiveOther || 0,
		warpRotate: Ornt.encode(warp.rotate),
		bounds: /*1 ? { // testing
			_classID: 'classFloatRect',
			'Top ': bounds && bounds.top && bounds.top.value || 0,
			Left: bounds && bounds.left && bounds.left.value || 0,
			Btom: bounds && bounds.bottom && bounds.bottom.value || 0,
			Rght: bounds && bounds.right && bounds.right.value || 0,
		} :*/ {
			'Top ': unitsValue(bounds && bounds.top || { units: 'Pixels', value: 0 }, 'bounds.top'),
			Left: unitsValue(bounds && bounds.left || { units: 'Pixels', value: 0 }, 'bounds.left'),
			Btom: unitsValue(bounds && bounds.bottom || { units: 'Pixels', value: 0 }, 'bounds.bottom'),
			Rght: unitsValue(bounds && bounds.right || { units: 'Pixels', value: 0 }, 'bounds.right'),
		},
		uOrder: warp.uOrder || 0,
		vOrder: warp.vOrder || 0,
	};

	const isQuilt = isQuiltWarp(warp);

	if (isQuilt) {
		const desc2 = desc as QuiltWarpDescriptor;
		desc2.deformNumRows = warp.deformNumRows || 0;
		desc2.deformNumCols = warp.deformNumCols || 0;
	}

	const customEnvelopeWarp = warp.customEnvelopeWarp;
	if (customEnvelopeWarp) {
		const meshPoints = customEnvelopeWarp.meshPoints || [];

		if (isQuilt) {
			const desc2 = desc as QuiltWarpDescriptor;
			desc2.customEnvelopeWarp = {
				_name: '',
				_classID: 'customEnvelopeWarp',
				quiltSliceX: [{
					type: 'quiltSliceX',
					values: customEnvelopeWarp.quiltSliceX || [],
				}],
				quiltSliceY: [{
					type: 'quiltSliceY',
					values: customEnvelopeWarp.quiltSliceY || [],
				}],
				meshPoints: [
					{ type: 'Hrzn', values: meshPoints.map(p => p.x) },
					{ type: 'Vrtc', values: meshPoints.map(p => p.y) },
				],
			};
		} else {
			desc.customEnvelopeWarp = {
				_name: '',
				_classID: 'customEnvelopeWarp',
				meshPoints: [
					{ type: 'Hrzn', values: meshPoints.map(p => p.x) },
					{ type: 'Vrtc', values: meshPoints.map(p => p.y) },
				],
			};
		}
	}

	return desc;
}

addHandler(
	'PlLd',
	hasKey('placedLayer'),
	(reader, target, left) => {
		if (readSignature(reader) !== 'plcL') throw new Error(`Invalid PlLd signature`);
		if (readInt32(reader) !== 3) throw new Error(`Invalid PlLd version`);
		const id = readPascalString(reader, 1);
		const pageNumber = readInt32(reader);
		const totalPages = readInt32(reader); // TODO: check how this works ?
		readInt32(reader); // anitAliasPolicy 16
		const placedLayerType = readInt32(reader); // 0 = unknown, 1 = vector, 2 = raster, 3 = image stack
		if (!placedLayerTypes[placedLayerType]) throw new Error('Invalid PlLd type');
		const transform: number[] = [];
		for (let i = 0; i < 8; i++) transform.push(readFloat64(reader)); // x, y of 4 corners of the transform
		const warpVersion = readInt32(reader);
		if (warpVersion !== 0) throw new Error(`Invalid Warp version ${warpVersion}`);
		const warp: WarpDescriptor & QuiltWarpDescriptor = readVersionAndDescriptor(reader);

		target.placedLayer = target.placedLayer || { // skip if SoLd already set it
			id,
			type: placedLayerTypes[placedLayerType],
			pageNumber,
			totalPages,
			transform,
			warp: parseWarp(warp),
		};

		// console.log('PlLd warp', require('util').inspect(warp, false, 99, true));
		// console.log('PlLd', require('util').inspect(target.placedLayer, false, 99, true));

		skipBytes(reader, left());
	},
	(writer, target) => {
		const placed = target.placedLayer!;
		writeSignature(writer, 'plcL');
		writeInt32(writer, 3); // version
		if (!placed.id || typeof placed.id !== 'string' || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(placed.id)) {
			throw new Error('Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)');
		}
		writePascalString(writer, placed.id, 1);
		writeInt32(writer, 1); // pageNumber
		writeInt32(writer, 1); // totalPages
		writeInt32(writer, 16); // anitAliasPolicy
		if (placedLayerTypes.indexOf(placed.type) === -1) throw new Error('Invalid placedLayer type');
		writeInt32(writer, placedLayerTypes.indexOf(placed.type));
		for (let i = 0; i < 8; i++) writeFloat64(writer, placed.transform[i]);
		writeInt32(writer, 0); // warp version
		const warp = getWarpFromPlacedLayer(placed);
		const isQuilt = isQuiltWarp(warp);
		const type = isQuilt ? 'quiltWarp' : 'warp';
		writeVersionAndDescriptor(writer, '', type, encodeWarp(warp), type);
	},
);

interface HrznVrtcDescriptor {
	_name: '';
	_classID: 'Pnt ';
	Hrzn: DescriptorUnitsValue;
	Vrtc: DescriptorUnitsValue;
}
/*
interface K3DLight {
	'Nm  ': string;
	'Rd  ': number;
	'Grn ': number;
	'Bl  ': number;
	hots: number;
	FlOf: number;
	shdw: number;
	attn: boolean;
	attt: number;
	atta: number;
	attb: number;
	attc: number;
	orad: number;
	irad: number;
	mult: number;
	Type: number;
	ison: boolean;
	ssml: number;
	afon: boolean;
	afpw: number;
	key3DMatrix: {
		key3DMatrixData: Uint8Array;
	},
	'X   ': number;
	'Y   ': number;
	'Z   ': number;
	tarx: number;
	tary: number;
	tarz: number;
	key3DPosition: {
		key3DXPos: number;
		key3DYPos: number;
		key3DZPos: number;
		key3DXAngle: number;
		key3DYAngle: number;
		key3DZAngle: number;
	};
}
*/

type SoLdDescriptorFilterItem = {
	_name: '',
	_classID: 'filterFX',
	'Nm  ': string;
	blendOptions: {
		_name: '';
		_classID: 'blendOptions';
		Opct: DescriptorUnitsValue;
		'Md  ': string; // blend mode
	};
	enab: boolean;
	hasoptions: boolean;
	FrgC: DescriptorColor;
	BckC: DescriptorColor;
} & ({
	filterID: 1098281575; // average
} | {
	filterID: 1114403360; // blur
} | {
	filterID: 1114403405; // blur more
} | {
	filterID: 697;
	Fltr: {
		_name: 'Box Blur';
		_classID: 'boxblur';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 1198747202;
	Fltr: {
		_name: 'Gaussian Blur' | '高斯模糊';
		_classID: 'GsnB';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 1299476034;
	Fltr: {
		_name: 'Motion Blur';
		_classID: 'MtnB';
		Angl: number;
		Dstn: DescriptorUnitsValue;
	};
} | {
	filterID: 1382313026;
	Fltr: {
		_name: 'Radial Blur';
		_classID: 'RdlB';
		Amnt: number;
		BlrM: string;
		BlrQ: string;
	};
} | {
	filterID: 702;
	Fltr: {
		_name: 'Shape Blur';
		_classID: 'shapeBlur';
		'Rds ': DescriptorUnitsValue;
		customShape: {
			_name: '';
			_classID: 'customShape';
			'Nm  ': string;
			Idnt: string;
		};
	};
} | {
	filterID: 1399681602;
	Fltr: {
		_name: 'Smart Blur';
		_classID: 'SmrB';
		'Rds ': number;
		Thsh: number;
		SmBQ: string;
		SmBM: string;
	};
} | {
	filterID: 701;
	Fltr: {
		_name: 'Surface Blur';
		_classID: 'surfaceBlur';
		'Rds ': DescriptorUnitsValue;
		Thsh: number;
	};
} | {
	filterID: 1148416108;
	Fltr: {
		_name: 'Displace';
		_classID: 'Dspl';
		HrzS: number;
		VrtS: number;
		DspM: string;
		UndA: string;
		DspF: {
			sig: string;
			path: string;
		};
	};
} | {
	filterID: 1349411688;
	Fltr: {
		_name: 'Pinch';
		_classID: 'Pnch';
		Amnt: number;
	};
} | {
	filterID: 1349284384;
	Fltr: {
		_name: 'Polar Coordinates';
		_classID: 'Plr ';
		Cnvr: string;
	};
} | {
	filterID: 1383099493;
	Fltr: {
		_name: 'Ripple';
		_classID: 'Rple';
		Amnt: number;
		RplS: string;
	};
} | {
	filterID: 1399353888;
	Fltr: {
		_name: 'Shear';
		_classID: 'Shr ';
		ShrP: { _name: '', _classID: 'Pnt ', Hrzn: number; Vrtc: number; }[];
		UndA: string;
		ShrS: number;
		ShrE: number;
	};
} | {
	filterID: 1399875698;
	Fltr: {
		_name: 'Spherize';
		_classID: 'Sphr';
		Amnt: number;
		SphM: string;
	};
} | {
	filterID: 1417114220;
	Fltr: {
		_name: 'Twirl';
		_classID: 'Twrl';
		Angl: number;
	};
} | {
	filterID: 1466005093;
	Fltr: {
		_name: 'Wave';
		_classID: 'Wave';
		Wvtp: string;
		NmbG: number;
		WLMn: number;
		WLMx: number;
		AmMn: number;
		AmMx: number;
		SclH: number;
		SclV: number;
		UndA: string;
		RndS: number;
	};
} | {
	filterID: 1516722791;
	Fltr: {
		_name: 'ZigZag';
		_classID: 'ZgZg';
		Amnt: number;
		NmbR: number;
		ZZTy: string;
	};
} | {
	filterID: 1097092723;
	Fltr: {
		_name: 'Add Noise';
		_classID: 'AdNs';
		Dstr: string;
		Nose: DescriptorUnitsValue;
		Mnch: boolean;
		FlRs: number;
	};
} | {
	filterID: 1148416099;
} | {
	filterID: 1148417107;
	Fltr: {
		_name: 'Dust & Scratches';
		_classID: 'DstS';
		'Rds ': number;
		Thsh: number;
	};
} | {
	filterID: 1298427424;
	Fltr: {
		_name: 'Median';
		_classID: 'Mdn ';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 633;
	Fltr: {
		_name: 'Reduce Noise';
		_classID: 'denoise';
		ClNs: DescriptorUnitsValue; // percent
		Shrp: DescriptorUnitsValue; // percent
		removeJPEGArtifact: boolean;
		channelDenoise: {
			_name: '';
			_classID: 'channelDenoiseParams';
			Chnl: string[];
			Amnt: number;
			EdgF?: number;
		}[];
		preset: string;
	};
} | {
	filterID: 1131180616;
	Fltr: {
		_name: 'Color Halftone';
		_classID: 'ClrH';
		'Rds ': number;
		Ang1: number;
		Ang2: number;
		Ang3: number;
		Ang4: number;
	};
} | {
	filterID: 1131574132;
	Fltr: {
		_name: 'Crystallize';
		_classID: 'Crst';
		ClSz: number;
		FlRs: number;
	};
} | {
	filterID: 1180922912;
} | {
	filterID: 1181902701;
} | {
	filterID: 1299870830;
	Fltr: {
		_name: 'Mezzotint';
		_classID: 'Mztn';
		MztT: string;
		FlRs: number;
	};
} | {
	filterID: 1299407648;
	Fltr: {
		_name: 'Mosaic';
		_classID: 'Msc ';
		ClSz: DescriptorUnitsValue;
	};
} | {
	filterID: 1349416044;
	Fltr: {
		_name: 'Pointillize';
		_classID: 'Pntl';
		ClSz: number;
		FlRs: number;
	};
} | {
	filterID: 1131177075;
	Fltr: {
		_name: 'Clouds';
		_classID: 'Clds';
		FlRs: number;
	};
} | {
	filterID: 1147564611;
	Fltr: {
		_name: 'Difference Clouds',
		_classID: 'DfrC',
		FlRs: number;
	};
} | {
	filterID: 1180856947;
	Fltr: {
		_name: 'Fibers';
		_classID: 'Fbrs';
		Vrnc: number;
		Strg: number;
		RndS: number;
	};
} | {
	filterID: 1282306886;
	Fltr: {
		_name: 'Lens Flare';
		_classID: 'LnsF';
		Brgh: number;
		FlrC: { _name: ''; _classID: 'Pnt '; Hrzn: number; Vrtc: number; };
		'Lns ': string;
	};
} /*| {
	filterID: 587;
	Fltr: {
		k3DLights: K3DLight[];
		key3DCurrentCameraPosition: {
			key3DXPos: number;
			key3DYPos: number;
			key3DZPos: number;
			key3DXAngle: number;
			key3DYAngle: number;
			key3DZAngle: number;
		},
		Glos: number;
		Mtrl: number;
		Exps: number;
		AmbB: number;
		AmbC: DescriptorColor;
		BmpA: number;
		BmpC: string[];
		Wdth: number;
		Hght: number;
	};
}*/ | {
	filterID: 1399353968 | 1399353925 | 1399353933;
} | {
	filterID: 698;
	Fltr: {
		_name: 'Smart Sharpen';
		_classID: 'smartSharpen';
		Amnt: DescriptorUnitsValue; // %
		'Rds ': DescriptorUnitsValue;
		Thsh: number;
		Angl: number;
		moreAccurate: boolean;
		blur: string;
		preset: string;
		sdwM: {
			_name: 'Parameters',
			_classID: 'adaptCorrectTones',
			Amnt: DescriptorUnitsValue; // %
			Wdth: DescriptorUnitsValue; // %
			'Rds ': number;
		};
		hglM: {
			_name: 'Parameters',
			_classID: 'adaptCorrectTones',
			Amnt: DescriptorUnitsValue; // %
			Wdth: DescriptorUnitsValue; // %
			'Rds ': number;
		};
	};
} | {
	filterID: 1433301837;
	Fltr: {
		_name: 'Unsharp Mask';
		_classID: 'UnsM';
		Amnt: DescriptorUnitsValue; // %
		'Rds ': DescriptorUnitsValue;
		Thsh: number;
	};
} | {
	filterID: 1147564832;
	Fltr: {
		_name: 'Diffuse';
		_classID: 'Dfs ';
		'Md  ': string;
		FlRs: number;
	};
} | {
	filterID: 1164796531;
	Fltr: {
		_name: 'Emboss';
		_classID: 'Embs';
		Angl: number;
		Hght: number;
		Amnt: number;
	};
} | {
	filterID: 1165522034;
	Fltr: {
		_name: 'Extrude';
		_classID: 'Extr';
		ExtS: number;
		ExtD: number;
		ExtF: boolean;
		ExtM: boolean;
		ExtT: string;
		ExtR: string;
		FlRs: number;
	};
} | {
	filterID: 1181639749 | 1399616122;
} | {
	filterID: 1416393504;
	Fltr: {
		_name: 'Tiles';
		_classID: 'Tls ';
		TlNm: number;
		TlOf: number;
		FlCl: string;
		FlRs: number;
	};
} | {
	filterID: 1416782659;
	Fltr: {
		_name: 'Trace Contour';
		_classID: 'TrcC';
		'Lvl ': number;
		'Edg ': string;
	};
} | {
	filterID: 1466852384;
	Fltr: {
		_name: 'Wind';
		_classID: 'Wnd ';
		WndM: string;
		Drct: string;
	};
} | {
	filterID: 1148089458;
	Fltr: {
		_name: 'De-Interlace';
		_classID: 'Dntr';
		IntE: string;
		IntC: string;
	};
} | {
	filterID: 1314149187;
} | {
	filterID: 1131639917;
	Fltr: {
		_name: 'Custom';
		_classID: 'Cstm';
		'Scl ': number;
		Ofst: number;
		Mtrx: number[];
	};
} | {
	filterID: 1214736464;
	Fltr: {
		_name: 'High Pass';
		_classID: 'HghP';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 1299737888;
	Fltr: {
		_name: 'Maximum';
		_classID: 'Mxm ';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 1299082528;
	Fltr: {
		_name: 'Minimum';
		_classID: 'Mnm ';
		'Rds ': DescriptorUnitsValue;
	};
} | {
	filterID: 1332114292;
	Fltr: {
		_name: 'Offset';
		_classID: 'Ofst';
		Hrzn: number;
		Vrtc: number;
		'Fl  ': string;
	};
} | {
	filterID: 991 | 943; // TODO: why 2 different IDs? do we need to handle them separately?
	Fltr: {
		_name: 'Rigid Transform';
		_classID: 'rigidTransform';
		'null': string[]; // [Ordn.Trgt]
		rigidType: boolean;
		puppetShapeList?: {
			_name: '';
			_classID: 'puppetShape';
			rigidType: boolean;
			VrsM: number;
			VrsN: number;
			originalVertexArray: Uint8Array;
			deformedVertexArray: Uint8Array;
			indexArray: Uint8Array;
			pinOffsets: number[];
			posFinalPins: number[];
			pinVertexIndices: number[];
			PinP: number[];
			PnRt: number[];
			PnOv: boolean[];
			PnDp: number[];
			meshQuality: number;
			meshExpansion: number;
			meshRigidity: number;
			imageResolution: number;
			meshBoundaryPath: {
				_name: '';
				_classID: 'pathClass';
				pathComponents: {
					_name: '';
					_classID: 'PaCm';
					shapeOperation: string; // shapeOperation.xor
					SbpL: {
						_name: '';
						_classID: 'Sbpl';
						Clsp: boolean;
						'Pts ': {
							_name: '';
							_classID: 'Pthp';
							Anch: HrznVrtcDescriptor;
							'Fwd ': HrznVrtcDescriptor;
							'Bwd ': HrznVrtcDescriptor;
							Smoo: boolean;
						}[];
					}[];
				}[];
			};
			selectedPin: number[];
		}[];
		PuX0: number;
		PuX1: number;
		PuX2: number;
		PuX3: number;
		PuY0: number;
		PuY1: number;
		PuY2: number;
		PuY3: number;
	}
} | {
	filterID: 1348620396;
	Fltr: {
		_name: 'Oil Paint Plugin';
		_classID: 'PbPl';
		KnNm: string;
		GpuY: boolean;
		LIWy: boolean;
		FPth: string;
		// PNaa: string;
		// PTaa: number;
		// PFaa: number;
		// PNab: string;
		// PTab: number;
		// PFab: number;
		// ...
	};
} /*| {
	filterID: 1282294642;
	Fltr: {
		_name: 'Lens Correction',
		_classID: 'LnCr',
		LnAg: boolean;
		LnAc: boolean;
		LnAv: boolean;
		LnAs: boolean;
		LnIp: boolean;
		LnFo: number;
		LnPr: string;
		LnIa: number;
		LnI0: number;
		LnI1: number;
		LnI2: number;
		LnI3: number;
		LnRa: number;
		LnVp: number;
		LnHp: number;
		LnSi: number;
		LnFt: number;
		LnSb: number;
		LnSt: number;
		LnRc: number;
		LnGm: number;
		LnBy: number;
		LnNa: number;
		LnIh: number;
		LnIv: number;
		LnIs: DescriptorColor;
		LnNm: boolean;
	};
}*//* | {
	filterID: 2089;
	Fltr: {
		_name: 'Adaptive Wide Angle';
		_classID: '22C3EEBF-A978-4ca9-91DF-E4F0CCEE5ACE';
		actV: number;
		cnsD?: Uint8Array;
		prjM: string;
		regM: string;
		focL: number;
		PhyF: number;
		CrpF: number;
		imgS: number;
		imgX: number;
		imgY: number;
	};
}*//* | {
	filterID: 1195730531;
	Fltr: {
			_name: 'Filter Gallery';
			_classID: 'GEfc';
		} & ({
			GEfk: string;
			Pncl: number;
			StrP: number;
			PprB: number;
		} | ...);
	};
}*/ | {
	filterID: 1215521360;
	Fltr: {
		_name: 'HSB/HSL',
		_classID: 'HsbP',
		Inpt: string;
		Otpt: string;
	};
} | {
	filterID: 1122;
	Fltr: {
		_name: 'Oil Paint';
		_classID: 'oilPaint';
		lightingOn: boolean;
		stylization: number;
		cleanliness: number;
		brushScale: number;
		microBrush: number;
		LghD: number;
		specularity: number;
	};
} | {
	filterID: 1282492025;
	Fltr: {
		_name: 'Liquify';
		_classID: 'LqFy';
		LqMe: Uint8Array;
	};
} | {
	filterID: 442;
	Fltr: {
		_name: 'Perspective Warp';
		_classID: 'perspectiveWarpTransform';
		quads: { indices: number[]; }[];
		vertices: HrznVrtcDescriptor[];
		warpedVertices: HrznVrtcDescriptor[];
	};
} | {
	filterID: 1131574899;
	Fltr: {
		_name: 'Curves';
		_classID: 'Crvs';
		presetKind: string; // 'presetKindType.presetKindCustom';
		Adjs: {
			_name: '';
			_classID: 'CrvA';
			Chnl: string[]; // 'Chnl.Cmps' | 'Chnl.Rd  ' | 'Chnl.Grn ' | 'Chnl.Bl  '
			'Crv '?: FilterCurvesCurvePoint[];
			Mpng?: number[];
		}[];
	};
});

interface FilterCurvesCurvePoint {
	_name: '';
	_classID: 'Pnt ';
	Hrzn: 0;
	Vrtc: 0;
	Cnty?: boolean;
}

interface SoLdDescriptorFilter {
	_name: '',
	_classID: 'filterFXStyle',
	enab: boolean,
	validAtPosition: boolean,
	filterMaskEnable: boolean,
	filterMaskLinked: boolean,
	filterMaskExtendWithWhite: boolean,
	filterFXList: SoLdDescriptorFilterItem[];
}

function uint8ToFloat32(array: Uint8Array) {
	return new Float32Array(array.buffer.slice(array.byteOffset), 0, array.byteLength / 4);
}

function uint8ToUint32(array: Uint8Array) {
	return new Uint32Array(array.buffer.slice(array.byteOffset), 0, array.byteLength / 4);
}

function toUint8(array: Uint32Array | Float32Array) {
	return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

function arrayToPoints(array: number[] | Uint32Array | Float32Array) {
	const points: { x: number; y: number }[] = [];

	for (let i = 0; i < array.length; i += 2) {
		points.push({ x: array[i], y: array[i + 1] });
	}

	return points;
}

function pointsToArray(points: { x: number; y: number }[]) {
	const array: number[] = [];
	for (let i = 0; i < points.length; i++) {
		array.push(points[i].x, points[i].y);
	}
	return array;
}

function uint8ToPoints(array: Uint8Array) {
	return arrayToPoints(uint8ToFloat32(array));
}

function hrznVrtcToPoint(desc: HrznVrtcDescriptor) {
	return {
		x: parseUnits(desc.Hrzn),
		y: parseUnits(desc.Vrtc),
	};
}

function pointToHrznVrtc(point: { x: UnitsValue; y: UnitsValue; }): HrznVrtcDescriptor {
	return {
		_name: '',
		_classID: 'Pnt ',
		Hrzn: unitsValue(point.x, 'x'),
		Vrtc: unitsValue(point.y, 'y'),
	};
}

function parseFilterFXItem(f: SoLdDescriptorFilterItem, options: ReadOptions): Filter | undefined {
	const base: Omit<Filter, 'type' | 'filter'> = {
		name: f['Nm  '],
		opacity: parsePercent(f.blendOptions.Opct),
		blendMode: BlnM.decode(f.blendOptions['Md  ']),
		enabled: f.enab,
		hasOptions: f.hasoptions,
		foregroundColor: parseColor(f.FrgC),
		backgroundColor: parseColor(f.BckC),
	};

	if ('Fltr' in f) {
		switch (f.Fltr._classID) {
			case 'boxblur': return {
				...base,
				type: 'box blur',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'GsnB': return {
				...base,
				type: 'gaussian blur',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'MtnB': return {
				...base,
				type: 'motion blur',
				filter: {
					angle: f.Fltr.Angl,
					distance: parseUnits(f.Fltr.Dstn),
				},
			};
			case 'RdlB': return {
				...base,
				type: 'radial blur',
				filter: {
					amount: f.Fltr.Amnt,
					method: BlrM.decode(f.Fltr.BlrM),
					quality: BlrQ.decode(f.Fltr.BlrQ),
				},
			};
			case 'shapeBlur': return {
				...base,
				type: 'shape blur',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
					customShape: { name: f.Fltr.customShape['Nm  '], id: f.Fltr.customShape.Idnt },
				},
			};
			case 'SmrB': return {
				...base,
				type: 'smart blur',
				filter: {
					radius: f.Fltr['Rds '],
					threshold: f.Fltr.Thsh,
					quality: SmBQ.decode(f.Fltr.SmBQ),
					mode: SmBM.decode(f.Fltr.SmBM),
				},
			};
			case 'surfaceBlur': return {
				...base,
				type: 'surface blur',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
					threshold: f.Fltr.Thsh,
				},
			};
			case 'Dspl': return {
				...base,
				type: 'displace',
				filter: {
					horizontalScale: f.Fltr.HrzS,
					verticalScale: f.Fltr.VrtS,
					displacementMap: DspM.decode(f.Fltr.DspM),
					undefinedAreas: UndA.decode(f.Fltr.UndA),
					displacementFile: {
						signature: f.Fltr.DspF.sig,
						path: f.Fltr.DspF.path, // TODO: this is decoded incorrectly ???
					},
				},
			};
			case 'Pnch': return {
				...base,
				type: 'pinch',
				filter: {
					amount: f.Fltr.Amnt,
				},
			};
			case 'Plr ': return {
				...base,
				type: 'polar coordinates',
				filter: {
					conversion: Cnvr.decode(f.Fltr.Cnvr),
				},
			};
			case 'Rple': return {
				...base,
				type: 'ripple',
				filter: {
					amount: f.Fltr.Amnt,
					size: RplS.decode(f.Fltr.RplS),
				},
			};
			case 'Shr ': return {
				...base,
				type: 'shear',
				filter: {
					shearPoints: f.Fltr.ShrP.map(p => ({ x: p.Hrzn, y: p.Vrtc })),
					shearStart: f.Fltr.ShrS,
					shearEnd: f.Fltr.ShrE,
					undefinedAreas: UndA.decode(f.Fltr.UndA),
				},
			};
			case 'Sphr': return {
				...base,
				type: 'spherize',
				filter: {
					amount: f.Fltr.Amnt,
					mode: SphM.decode(f.Fltr.SphM),
				},
			};
			case 'Twrl': return {
				...base,
				type: 'twirl',
				filter: {
					angle: f.Fltr.Angl,
				},
			};
			case 'Wave': return {
				...base,
				type: 'wave',
				filter: {
					numberOfGenerators: f.Fltr.NmbG,
					type: Wvtp.decode(f.Fltr.Wvtp),
					wavelength: { min: f.Fltr.WLMn, max: f.Fltr.WLMx },
					amplitude: { min: f.Fltr.AmMn, max: f.Fltr.AmMx },
					scale: { x: f.Fltr.SclH, y: f.Fltr.SclV },
					randomSeed: f.Fltr.RndS,
					undefinedAreas: UndA.decode(f.Fltr.UndA),
				},
			};
			case 'ZgZg': return {
				...base,
				type: 'zigzag',
				filter: {
					amount: f.Fltr.Amnt,
					ridges: f.Fltr.NmbR,
					style: ZZTy.decode(f.Fltr.ZZTy),
				},
			};
			case 'AdNs': return {
				...base,
				type: 'add noise',
				filter: {
					amount: parsePercent(f.Fltr.Nose),
					distribution: Dstr.decode(f.Fltr.Dstr),
					monochromatic: f.Fltr.Mnch,
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'DstS': return {
				...base,
				type: 'dust and scratches',
				filter: {
					radius: f.Fltr['Rds '],
					threshold: f.Fltr.Thsh,
				},
			};
			case 'Mdn ': return {
				...base,
				type: 'median',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'denoise': return {
				...base,
				type: 'reduce noise',
				filter: {
					preset: f.Fltr.preset,
					removeJpegArtifact: f.Fltr.removeJPEGArtifact,
					reduceColorNoise: parsePercent(f.Fltr.ClNs),
					sharpenDetails: parsePercent(f.Fltr.Shrp),
					channelDenoise: f.Fltr.channelDenoise.map(c => ({
						channels: c.Chnl.map(i => Chnl.decode(i)),
						amount: c.Amnt,
						...(c.EdgF ? { preserveDetails: c.EdgF } : {}),
					})),
				},
			};
			case 'ClrH': return {
				...base,
				type: 'color halftone',
				filter: {
					radius: f.Fltr['Rds '],
					angle1: f.Fltr.Ang1,
					angle2: f.Fltr.Ang2,
					angle3: f.Fltr.Ang3,
					angle4: f.Fltr.Ang4,
				},
			};
			case 'Crst': return {
				...base,
				type: 'crystallize',
				filter: {
					cellSize: f.Fltr.ClSz,
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'Mztn': return {
				...base,
				type: 'mezzotint',
				filter: {
					type: MztT.decode(f.Fltr.MztT),
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'Msc ': return {
				...base,
				type: 'mosaic',
				filter: {
					cellSize: parseUnits(f.Fltr.ClSz),
				},
			};
			case 'Pntl': return {
				...base,
				type: 'pointillize',
				filter: {
					cellSize: f.Fltr.ClSz,
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'Clds': return {
				...base,
				type: 'clouds',
				filter: {
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'DfrC': return {
				...base,
				type: 'difference clouds',
				filter: {
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'Fbrs': return {
				...base,
				type: 'fibers',
				filter: {
					variance: f.Fltr.Vrnc,
					strength: f.Fltr.Strg,
					randomSeed: f.Fltr.RndS,
				},
			};
			case 'LnsF': return {
				...base,
				type: 'lens flare',
				filter: {
					brightness: f.Fltr.Brgh,
					position: { x: f.Fltr.FlrC.Hrzn, y: f.Fltr.FlrC.Vrtc },
					lensType: Lns.decode(f.Fltr['Lns ']),
				},
			};
			case 'smartSharpen': return {
				...base,
				type: 'smart sharpen',
				filter: {
					amount: parsePercent(f.Fltr.Amnt),
					radius: parseUnits(f.Fltr['Rds ']),
					threshold: f.Fltr.Thsh,
					angle: f.Fltr.Angl,
					moreAccurate: f.Fltr.moreAccurate,
					blur: blurType.decode(f.Fltr.blur),
					preset: f.Fltr.preset,
					shadow: {
						fadeAmount: parsePercent(f.Fltr.sdwM.Amnt),
						tonalWidth: parsePercent(f.Fltr.sdwM.Wdth),
						radius: f.Fltr.sdwM['Rds '],
					},
					highlight: {
						fadeAmount: parsePercent(f.Fltr.hglM.Amnt),
						tonalWidth: parsePercent(f.Fltr.hglM.Wdth),
						radius: f.Fltr.hglM['Rds '],
					},
				},
			};
			case 'UnsM': return {
				...base,
				type: 'unsharp mask',
				filter: {
					amount: parsePercent(f.Fltr.Amnt),
					radius: parseUnits(f.Fltr['Rds ']),
					threshold: f.Fltr.Thsh,
				},
			};
			case 'Dfs ': return {
				...base,
				type: 'diffuse',
				filter: {
					mode: DfsM.decode(f.Fltr['Md  ']),
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'Embs': return {
				...base,
				type: 'emboss',
				filter: {
					angle: f.Fltr.Angl,
					height: f.Fltr.Hght,
					amount: f.Fltr.Amnt,
				},
			};
			case 'Extr': return {
				...base,
				type: 'extrude',
				filter: {
					type: ExtT.decode(f.Fltr.ExtT),
					size: f.Fltr.ExtS,
					depth: f.Fltr.ExtD,
					depthMode: ExtR.decode(f.Fltr.ExtR),
					randomSeed: f.Fltr.FlRs,
					solidFrontFaces: f.Fltr.ExtF,
					maskIncompleteBlocks: f.Fltr.ExtM,
				},
			};
			case 'Tls ': return {
				...base,
				type: 'tiles',
				filter: {
					numberOfTiles: f.Fltr.TlNm,
					maximumOffset: f.Fltr.TlOf,
					fillEmptyAreaWith: FlCl.decode(f.Fltr.FlCl),
					randomSeed: f.Fltr.FlRs,
				},
			};
			case 'TrcC': return {
				...base,
				type: 'trace contour',
				filter: {
					level: f.Fltr['Lvl '],
					edge: CntE.decode(f.Fltr['Edg ']),
				},
			};
			case 'Wnd ': return {
				...base,
				type: 'wind',
				filter: {
					method: WndM.decode(f.Fltr.WndM),
					direction: Drct.decode(f.Fltr.Drct),
				},
			};
			case 'Dntr': return {
				...base,
				type: 'de-interlace',
				filter: {
					eliminate: IntE.decode(f.Fltr.IntE),
					newFieldsBy: IntC.decode(f.Fltr.IntC),
				},
			};
			case 'Cstm': return {
				...base,
				type: 'custom',
				filter: {
					scale: f.Fltr['Scl '],
					offset: f.Fltr.Ofst,
					matrix: f.Fltr.Mtrx,
				},
			};
			case 'HghP': return {
				...base,
				type: 'high pass',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'Mxm ': return {
				...base,
				type: 'maximum',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'Mnm ': return {
				...base,
				type: 'minimum',
				filter: {
					radius: parseUnits(f.Fltr['Rds ']),
				},
			};
			case 'Ofst': return {
				...base,
				type: 'offset',
				filter: {
					horizontal: f.Fltr.Hrzn,
					vertical: f.Fltr.Vrtc,
					undefinedAreas: FlMd.decode(f.Fltr['Fl  ']),
				},
			};
			case 'rigidTransform': return {
				...base,
				type: 'puppet',
				filter: {
					rigidType: f.Fltr.rigidType,
					bounds: [
						{ x: f.Fltr.PuX0, y: f.Fltr.PuY0, },
						{ x: f.Fltr.PuX1, y: f.Fltr.PuY1, },
						{ x: f.Fltr.PuX2, y: f.Fltr.PuY2, },
						{ x: f.Fltr.PuX3, y: f.Fltr.PuY3, },
					],
					puppetShapeList: f.Fltr.puppetShapeList!.map(p => ({
						rigidType: p.rigidType,
						// TODO: VrsM
						// TODO: VrsN
						originalVertexArray: uint8ToPoints(p.originalVertexArray),
						deformedVertexArray: uint8ToPoints(p.deformedVertexArray),
						indexArray: Array.from(uint8ToUint32(p.indexArray)),
						pinOffsets: arrayToPoints(p.pinOffsets),
						posFinalPins: arrayToPoints(p.posFinalPins),
						pinVertexIndices: p.pinVertexIndices,
						selectedPin: p.selectedPin,
						pinPosition: arrayToPoints(p.PinP),
						pinRotation: p.PnRt,
						pinOverlay: p.PnOv,
						pinDepth: p.PnDp,
						meshQuality: p.meshQuality,
						meshExpansion: p.meshExpansion,
						meshRigidity: p.meshRigidity,
						imageResolution: p.imageResolution,
						meshBoundaryPath: {
							pathComponents: p.meshBoundaryPath.pathComponents.map(c => ({
								shapeOperation: c.shapeOperation.split('.')[1],
								paths: c.SbpL.map(t => ({
									closed: t.Clsp,
									points: t['Pts '].map(pt => ({
										anchor: hrznVrtcToPoint(pt.Anch),
										forward: hrznVrtcToPoint(pt['Fwd ']),
										backward: hrznVrtcToPoint(pt['Bwd ']),
										smooth: pt.Smoo,
									})),
								})),
							})),
						},
					})),
				},
			};
			case 'PbPl': {
				const parameters: { name: string; value: number; }[] = [];
				const Flrt = f.Fltr as any;

				for (let i = 0; i < fromAtoZ.length; i++) {
					if (!Flrt[`PN${fromAtoZ[i]}a`]) break;

					for (let j = 0; j < fromAtoZ.length; j++) {
						if (!Flrt[`PN${fromAtoZ[i]}${fromAtoZ[j]}`]) break;

						parameters.push({
							name: Flrt[`PN${fromAtoZ[i]}${fromAtoZ[j]}`],
							value: Flrt[`PF${fromAtoZ[i]}${fromAtoZ[j]}`]
						});
					}
				}

				return {
					...base,
					type: 'oil paint plugin',
					filter: {
						name: f.Fltr.KnNm,
						gpu: f.Fltr.GpuY,
						lighting: f.Fltr.LIWy,
						parameters,
					},
				}
			}
			// case 2089: return {
			// 	...base,
			// 	type: 'adaptive wide angle',
			// 	params: {
			// 		correction: prjM.decode(f.Fltr.prjM),
			// 		focalLength: f.Fltr.focL,
			// 		cropFactor: f.Fltr.CrpF,
			// 		imageScale: f.Fltr.imgS,
			// 		imageX: f.Fltr.imgX,
			// 		imageY: f.Fltr.imgY,
			// 	},
			// };
			case 'HsbP': return {
				...base,
				type: 'hsb/hsl',
				filter: {
					inputMode: ClrS.decode(f.Fltr.Inpt) as any,
					rowOrder: ClrS.decode(f.Fltr.Otpt) as any,
				},
			};
			case 'oilPaint': return {
				...base,
				type: 'oil paint',
				filter: {
					lightingOn: f.Fltr.lightingOn,
					stylization: f.Fltr.stylization,
					cleanliness: f.Fltr.cleanliness,
					brushScale: f.Fltr.brushScale,
					microBrush: f.Fltr.microBrush,
					lightDirection: f.Fltr.LghD,
					specularity: f.Fltr.specularity,
				},
			};
			case 'LqFy': {
				return {
					...base,
					type: 'liquify',
					filter: {
						liquifyMesh: f.Fltr.LqMe,
					},
				};
			};
			case 'perspectiveWarpTransform': {
				return {
					...base,
					type: 'perspective warp',
					filter: {
						vertices: f.Fltr.vertices.map(hrznVrtcToPoint),
						warpedVertices: f.Fltr.warpedVertices.map(hrznVrtcToPoint),
						quads: f.Fltr.quads.map(q => q.indices),
					},
				};
			};
			case 'Crvs': {
				return {
					...base,
					type: 'curves',
					filter: {
						presetKind: presetKindType.decode(f.Fltr.presetKind),
						adjustments: f.Fltr.Adjs.map(a => {
							const channels = a.Chnl.map(c => Chnl.decode(c));

							if (a['Crv ']) {
								return {
									channels,
									curve: a['Crv '].map(c => {
										const point: { x: number; y: number; curved?: boolean; } = { x: c.Hrzn, y: c.Vrtc };
										if (c.Cnty) point.curved = true;
										return point;
									}),
								};
							} else if (a.Mpng) {
								return { channels, values: a.Mpng };
							} else {
								throw new Error(`Unknown curve adjustment`);
							}
						}),
					},
				};
			};
			default:
				if (options.throwForMissingFeatures) {
					throw new Error(`Unknown filter classId: ${(f as any).Fltr._classID}`);
				}
				return undefined;
		}
	} else {
		switch (f.filterID) {
			case 1098281575: return { ...base, type: 'average' };
			case 1114403360: return { ...base, type: 'blur' };
			case 1114403405: return { ...base, type: 'blur more' };
			case 1148416099: return { ...base, type: 'despeckle' };
			case 1180922912: return { ...base, type: 'facet' };
			case 1181902701: return { ...base, type: 'fragment' };
			case 1399353968: return { ...base, type: 'sharpen' };
			case 1399353925: return { ...base, type: 'sharpen edges' };
			case 1399353933: return { ...base, type: 'sharpen more' };
			case 1181639749: return { ...base, type: 'find edges' };
			case 1399616122: return { ...base, type: 'solarize' };
			case 1314149187: return { ...base, type: 'ntsc colors' };
			default:
				if (options.throwForMissingFeatures) {
					// console.log('FILTER', require('util').inspect(f, false, 99, true));
					throw new Error(`Unknown filterID: ${(f as any).filterID}`);
				}
		}
	}
}

function parseFilterFX(desc: SoLdDescriptorFilter, options: ReadOptions): PlacedLayerFilter {
	return {
		enabled: desc.enab,
		validAtPosition: desc.validAtPosition,
		maskEnabled: desc.filterMaskEnable,
		maskLinked: desc.filterMaskLinked,
		maskExtendWithWhite: desc.filterMaskExtendWithWhite,
		list: desc.filterFXList.map(x => parseFilterFXItem(x, options)).filter((x): x is Filter => !!x),
	};
}

function uvRadius(t: { radius: UnitsValue; }) {
	return unitsValue(t.radius, 'radius');
}

function serializeFilterFXItem(f: Filter): SoLdDescriptorFilterItem {
	const base: Omit<SoLdDescriptorFilterItem, 'filterID' | 'filter'> = {
		_name: '',
		_classID: 'filterFX',
		'Nm  ': f.name,
		blendOptions: {
			_name: '',
			_classID: 'blendOptions',
			Opct: unitsPercentF(f.opacity),
			'Md  ': BlnM.encode(f.blendMode),
		},
		enab: f.enabled,
		hasoptions: f.hasOptions,
		FrgC: serializeColor(f.foregroundColor),
		BckC: serializeColor(f.backgroundColor),
	};

	switch (f.type) {
		case 'average': return { ...base, filterID: 1098281575 };
		case 'blur': return { ...base, filterID: 1114403360 };
		case 'blur more': return { ...base, filterID: 1114403405 };
		case 'box blur': return {
			...base,
			Fltr: {
				_name: 'Box Blur',
				_classID: 'boxblur',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 697,
		};
		case 'gaussian blur': return {
			...base,
			Fltr: {
				// _name: '高斯模糊', // Testing
				_name: 'Gaussian Blur',
				_classID: 'GsnB',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 1198747202,
		};
		case 'motion blur': return {
			...base,
			Fltr: {
				_name: 'Motion Blur',
				_classID: 'MtnB',
				Angl: f.filter.angle,
				Dstn: unitsValue(f.filter.distance, 'distance'),
			},
			filterID: 1299476034,
		};
		case 'radial blur': return {
			...base,
			Fltr: {
				_name: 'Radial Blur',
				_classID: 'RdlB',
				Amnt: f.filter.amount,
				BlrM: BlrM.encode(f.filter.method),
				BlrQ: BlrQ.encode(f.filter.quality),
			},
			filterID: 1382313026,
		};
		case 'shape blur': return {
			...base,
			Fltr: {
				_name: 'Shape Blur',
				_classID: 'shapeBlur',
				'Rds ': uvRadius(f.filter),
				customShape: {
					_name: '',
					_classID: 'customShape',
					'Nm  ': f.filter.customShape.name,
					Idnt: f.filter.customShape.id,
				}
			},
			filterID: 702,
		};
		case 'smart blur': return {
			...base,
			Fltr: {
				_name: 'Smart Blur',
				_classID: 'SmrB',
				'Rds ': f.filter.radius,
				Thsh: f.filter.threshold,
				SmBQ: SmBQ.encode(f.filter.quality),
				SmBM: SmBM.encode(f.filter.mode),
			},
			filterID: 1399681602,
		};
		case 'surface blur': return {
			...base,
			Fltr: {
				_name: 'Surface Blur',
				_classID: 'surfaceBlur',
				'Rds ': uvRadius(f.filter),
				Thsh: f.filter.threshold,
			},
			filterID: 701,
		};
		case 'displace': return {
			...base,
			Fltr: {
				_name: 'Displace',
				_classID: 'Dspl',
				HrzS: f.filter.horizontalScale,
				VrtS: f.filter.verticalScale,
				DspM: DspM.encode(f.filter.displacementMap),
				UndA: UndA.encode(f.filter.undefinedAreas),
				DspF: {
					sig: f.filter.displacementFile.signature,
					path: f.filter.displacementFile.path,
				},
			},
			filterID: 1148416108,
		};
		case 'pinch': return {
			...base,
			Fltr: {
				_name: 'Pinch',
				_classID: 'Pnch',
				Amnt: f.filter.amount,
			},
			filterID: 1349411688,
		};
		case 'polar coordinates': return {
			...base,
			Fltr: {
				_name: 'Polar Coordinates',
				_classID: 'Plr ',
				Cnvr: Cnvr.encode(f.filter.conversion),
			},
			filterID: 1349284384,
		};
		case 'ripple': return {
			...base,
			Fltr: {
				_name: 'Ripple',
				_classID: 'Rple',
				Amnt: f.filter.amount,
				RplS: RplS.encode(f.filter.size),
			},
			filterID: 1383099493,
		};
		case 'shear': return {
			...base,
			Fltr: {
				_name: 'Shear',
				_classID: 'Shr ',
				ShrP: f.filter.shearPoints.map(p => ({ _name: '', _classID: 'Pnt ', Hrzn: p.x, Vrtc: p.y })),
				UndA: UndA.encode(f.filter.undefinedAreas),
				ShrS: f.filter.shearStart,
				ShrE: f.filter.shearEnd,
			},
			filterID: 1399353888,
		};
		case 'spherize': return {
			...base,
			Fltr: {
				_name: 'Spherize',
				_classID: 'Sphr',
				Amnt: f.filter.amount,
				SphM: SphM.encode(f.filter.mode),
			},
			filterID: 1399875698,
		};
		case 'twirl': return {
			...base,
			Fltr: {
				_name: 'Twirl',
				_classID: 'Twrl',
				Angl: f.filter.angle,
			},
			filterID: 1417114220,
		};
		case 'wave': return {
			...base,
			Fltr: {
				_name: 'Wave',
				_classID: 'Wave',
				Wvtp: Wvtp.encode(f.filter.type),
				NmbG: f.filter.numberOfGenerators,
				WLMn: f.filter.wavelength.min,
				WLMx: f.filter.wavelength.max,
				AmMn: f.filter.amplitude.min,
				AmMx: f.filter.amplitude.max,
				SclH: f.filter.scale.x,
				SclV: f.filter.scale.y,
				UndA: UndA.encode(f.filter.undefinedAreas),
				RndS: f.filter.randomSeed,
			},
			filterID: 1466005093,
		};
		case 'zigzag': return {
			...base,
			Fltr: {
				_name: 'ZigZag',
				_classID: 'ZgZg',
				Amnt: f.filter.amount,
				NmbR: f.filter.ridges,
				ZZTy: ZZTy.encode(f.filter.style),
			},
			filterID: 1516722791,
		};
		case 'add noise': return {
			...base,
			Fltr: {
				_name: 'Add Noise',
				_classID: 'AdNs',
				Dstr: Dstr.encode(f.filter.distribution),
				Nose: unitsPercentF(f.filter.amount),
				Mnch: f.filter.monochromatic,
				FlRs: f.filter.randomSeed,
			},
			filterID: 1097092723,
		};
		case 'despeckle': return { ...base, filterID: 1148416099 };
		case 'dust and scratches': return {
			...base,
			Fltr: {
				_name: 'Dust & Scratches',
				_classID: 'DstS',
				'Rds ': f.filter.radius,
				Thsh: f.filter.threshold,
			},
			filterID: 1148417107,
		};
		case 'median': return {
			...base,
			Fltr: {
				_name: 'Median',
				_classID: 'Mdn ',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 1298427424,
		};
		case 'reduce noise': return {
			...base,
			Fltr: {
				_name: 'Reduce Noise',
				_classID: 'denoise',
				ClNs: unitsPercentF(f.filter.reduceColorNoise),
				Shrp: unitsPercentF(f.filter.sharpenDetails),
				removeJPEGArtifact: f.filter.removeJpegArtifact,
				channelDenoise: f.filter.channelDenoise.map(c => ({
					_name: '',
					_classID: 'channelDenoiseParams',
					Chnl: c.channels.map(i => Chnl.encode(i)),
					Amnt: c.amount,
					...(c.preserveDetails ? { EdgF: c.preserveDetails } : {}),
				})),
				preset: f.filter.preset,
			},
			filterID: 633,
		};
		case 'color halftone': return {
			...base,
			Fltr: {
				_name: 'Color Halftone',
				_classID: 'ClrH',
				'Rds ': f.filter.radius,
				Ang1: f.filter.angle1,
				Ang2: f.filter.angle2,
				Ang3: f.filter.angle3,
				Ang4: f.filter.angle4,
			},
			filterID: 1131180616,
		};
		case 'crystallize': return {
			...base,
			Fltr: {
				_name: 'Crystallize',
				_classID: 'Crst',
				ClSz: f.filter.cellSize,
				FlRs: f.filter.randomSeed,
			},
			filterID: 1131574132,
		};
		case 'facet': return { ...base, filterID: 1180922912 };
		case 'fragment': return { ...base, filterID: 1181902701 };
		case 'mezzotint': return {
			...base,
			Fltr: {
				_name: 'Mezzotint',
				_classID: 'Mztn',
				MztT: MztT.encode(f.filter.type),
				FlRs: f.filter.randomSeed,
			},
			filterID: 1299870830,
		};
		case 'mosaic': return {
			...base,
			Fltr: {
				_name: 'Mosaic',
				_classID: 'Msc ',
				ClSz: unitsValue(f.filter.cellSize, 'cellSize'),
			},
			filterID: 1299407648,
		};
		case 'pointillize': return {
			...base,
			Fltr: {
				_name: 'Pointillize',
				_classID: 'Pntl',
				ClSz: f.filter.cellSize,
				FlRs: f.filter.randomSeed,
			},
			filterID: 1349416044,
		};
		case 'clouds': return {
			...base,
			Fltr: {
				_name: 'Clouds',
				_classID: 'Clds',
				FlRs: f.filter.randomSeed,
			},
			filterID: 1131177075,
		};
		case 'difference clouds': return {
			...base,
			Fltr: {
				_name: 'Difference Clouds',
				_classID: 'DfrC',
				FlRs: f.filter.randomSeed,
			},
			filterID: 1147564611,
		};
		case 'fibers': return {
			...base,
			Fltr: {
				_name: 'Fibers',
				_classID: 'Fbrs',
				Vrnc: f.filter.variance,
				Strg: f.filter.strength,
				RndS: f.filter.randomSeed,
			},
			filterID: 1180856947,
		};
		case 'lens flare': return {
			...base,
			Fltr: {
				_name: 'Lens Flare',
				_classID: 'LnsF',
				Brgh: f.filter.brightness,
				FlrC: {
					_name: '',
					_classID: 'Pnt ',
					Hrzn: f.filter.position.x,
					Vrtc: f.filter.position.y,
				},
				'Lns ': Lns.encode(f.filter.lensType),
			},
			filterID: 1282306886,
		};
		case 'sharpen': return { ...base, filterID: 1399353968 };
		case 'sharpen edges': return { ...base, filterID: 1399353925 };
		case 'sharpen more': return { ...base, filterID: 1399353933 };
		case 'smart sharpen': return {
			...base,
			Fltr: {
				_name: 'Smart Sharpen',
				_classID: 'smartSharpen',
				Amnt: unitsPercentF(f.filter.amount),
				'Rds ': uvRadius(f.filter),
				Thsh: f.filter.threshold,
				Angl: f.filter.angle,
				moreAccurate: f.filter.moreAccurate,
				blur: blurType.encode(f.filter.blur),
				preset: f.filter.preset,
				sdwM: {
					_name: 'Parameters',
					_classID: 'adaptCorrectTones',
					Amnt: unitsPercentF(f.filter.shadow.fadeAmount),
					Wdth: unitsPercentF(f.filter.shadow.tonalWidth),
					'Rds ': f.filter.shadow.radius,
				},
				hglM: {
					_name: 'Parameters',
					_classID: 'adaptCorrectTones',
					Amnt: unitsPercentF(f.filter.highlight.fadeAmount),
					Wdth: unitsPercentF(f.filter.highlight.tonalWidth),
					'Rds ': f.filter.highlight.radius,
				},
			},
			filterID: 698,
		};
		case 'unsharp mask': return {
			...base,
			Fltr: {
				_name: 'Unsharp Mask',
				_classID: 'UnsM',
				Amnt: unitsPercentF(f.filter.amount),
				'Rds ': uvRadius(f.filter),
				Thsh: f.filter.threshold,
			},
			filterID: 1433301837,
		};
		case 'diffuse': return {
			...base,
			Fltr: {
				_name: 'Diffuse',
				_classID: 'Dfs ',
				'Md  ': DfsM.encode(f.filter.mode),
				FlRs: f.filter.randomSeed,
			},
			filterID: 1147564832,
		};
		case 'emboss': return {
			...base,
			Fltr: {
				_name: 'Emboss',
				_classID: 'Embs',
				Angl: f.filter.angle,
				Hght: f.filter.height,
				Amnt: f.filter.amount,
			},
			filterID: 1164796531,
		};
		case 'extrude': return {
			...base,
			Fltr: {
				_name: 'Extrude',
				_classID: 'Extr',
				ExtS: f.filter.size,
				ExtD: f.filter.depth,
				ExtF: f.filter.solidFrontFaces,
				ExtM: f.filter.maskIncompleteBlocks,
				ExtT: ExtT.encode(f.filter.type),
				ExtR: ExtR.encode(f.filter.depthMode),
				FlRs: f.filter.randomSeed,
			},
			filterID: 1165522034,
		};
		case 'find edges': return { ...base, filterID: 1181639749 };
		case 'solarize': return { ...base, filterID: 1399616122 };
		case 'tiles': return {
			...base,
			Fltr: {
				_name: 'Tiles',
				_classID: 'Tls ',
				TlNm: f.filter.numberOfTiles,
				TlOf: f.filter.maximumOffset,
				FlCl: FlCl.encode(f.filter.fillEmptyAreaWith),
				FlRs: f.filter.randomSeed,
			},
			filterID: 1416393504,
		};
		case 'trace contour': return {
			...base,
			Fltr: {
				_name: 'Trace Contour',
				_classID: 'TrcC',
				'Lvl ': f.filter.level,
				'Edg ': CntE.encode(f.filter.edge),
			},
			filterID: 1416782659,
		};
		case 'wind': return {
			...base,
			Fltr: {
				_name: 'Wind',
				_classID: 'Wnd ',
				WndM: WndM.encode(f.filter.method),
				Drct: Drct.encode(f.filter.direction),
			},
			filterID: 1466852384,
		};
		case 'de-interlace': return {
			...base,
			Fltr: {
				_name: 'De-Interlace',
				_classID: 'Dntr',
				IntE: IntE.encode(f.filter.eliminate),
				IntC: IntC.encode(f.filter.newFieldsBy),
			},
			filterID: 1148089458,
		};
		case 'ntsc colors': return { ...base, filterID: 1314149187 };
		case 'custom': return {
			...base,
			Fltr: {
				_name: 'Custom',
				_classID: 'Cstm',
				'Scl ': f.filter.scale,
				Ofst: f.filter.offset,
				Mtrx: f.filter.matrix,
			},
			filterID: 1131639917,
		};
		case 'high pass': return {
			...base,
			Fltr: {
				_name: 'High Pass',
				_classID: 'HghP',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 1214736464,
		};
		case 'maximum': return {
			...base,
			Fltr: {
				_name: 'Maximum',
				_classID: 'Mxm ',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 1299737888,
		};
		case 'minimum': return {
			...base,
			Fltr: {
				_name: 'Minimum',
				_classID: 'Mnm ',
				'Rds ': uvRadius(f.filter),
			},
			filterID: 1299082528,
		};
		case 'offset': return {
			...base,
			Fltr: {
				_name: 'Offset',
				_classID: 'Ofst',
				Hrzn: f.filter.horizontal,
				Vrtc: f.filter.vertical,
				'Fl  ': FlMd.encode(f.filter.undefinedAreas),
			},
			filterID: 1332114292,
		};
		case 'puppet': return {
			...base,
			Fltr: {
				_name: 'Rigid Transform',
				_classID: 'rigidTransform',
				'null': ['Ordn.Trgt'], // TODO: ???
				rigidType: f.filter.rigidType,
				puppetShapeList: f.filter.puppetShapeList.map(p => ({
					_name: '',
					_classID: 'puppetShape',
					rigidType: p.rigidType,
					VrsM: 1, // TODO: ???
					VrsN: 0, // TODO: ???
					originalVertexArray: toUint8(new Float32Array(pointsToArray(p.originalVertexArray))),
					deformedVertexArray: toUint8(new Float32Array(pointsToArray(p.deformedVertexArray))),
					indexArray: toUint8(new Uint32Array(p.indexArray)),
					pinOffsets: pointsToArray(p.pinOffsets),
					posFinalPins: pointsToArray(p.posFinalPins),
					pinVertexIndices: p.pinVertexIndices,
					PinP: pointsToArray(p.pinPosition),
					PnRt: p.pinRotation,
					PnOv: p.pinOverlay,
					PnDp: p.pinDepth,
					meshQuality: p.meshQuality,
					meshExpansion: p.meshExpansion,
					meshRigidity: p.meshRigidity,
					imageResolution: p.imageResolution,
					meshBoundaryPath: {
						_name: '',
						_classID: 'pathClass',
						pathComponents: p.meshBoundaryPath.pathComponents.map(c => ({
							_name: '',
							_classID: 'PaCm',
							shapeOperation: `shapeOperation.${c.shapeOperation}`,
							SbpL: c.paths.map(path => ({
								_name: '',
								_classID: 'Sbpl',
								Clsp: path.closed,
								'Pts ': path.points.map(pt => ({
									_name: '',
									_classID: 'Pthp',
									Anch: pointToHrznVrtc(pt.anchor),
									'Fwd ': pointToHrznVrtc(pt.forward),
									'Bwd ': pointToHrznVrtc(pt.backward),
									Smoo: pt.smooth,
								})),
							})),
						})),
					},
					selectedPin: p.selectedPin,
				})),
				PuX0: f.filter.bounds[0].x,
				PuX1: f.filter.bounds[1].x,
				PuX2: f.filter.bounds[2].x,
				PuX3: f.filter.bounds[3].x,
				PuY0: f.filter.bounds[0].y,
				PuY1: f.filter.bounds[1].y,
				PuY2: f.filter.bounds[2].y,
				PuY3: f.filter.bounds[3].y,
			},
			filterID: 991,
		};
		case 'oil paint plugin': {
			const params: any = {};

			for (let i = 0; i < f.filter.parameters.length; i++) {
				const { name, value } = f.filter.parameters[i];
				const suffix = `${fromAtoZ[Math.floor(i / fromAtoZ.length)]}${fromAtoZ[i % fromAtoZ.length]}`;
				params[`PN${suffix}`] = name;
				params[`PT${suffix}`] = 0;
				params[`PF${suffix}`] = value;
			}

			return {
				...base,
				Fltr: {
					_name: 'Oil Paint Plugin',
					_classID: 'PbPl',
					KnNm: f.filter.name,
					GpuY: f.filter.gpu,
					LIWy: f.filter.lighting,
					FPth: '1',
					...params,
				},
				filterID: 1348620396,
			};
		}
		case 'oil paint': return {
			...base,
			Fltr: {
				_name: 'Oil Paint',
				_classID: 'oilPaint',
				lightingOn: f.filter.lightingOn,
				stylization: f.filter.stylization,
				cleanliness: f.filter.cleanliness,
				brushScale: f.filter.brushScale,
				microBrush: f.filter.microBrush,
				LghD: f.filter.lightDirection,
				specularity: f.filter.specularity,
			},
			filterID: 1122,
		};
		case 'liquify': return {
			...base,
			Fltr: {
				_name: 'Liquify',
				_classID: 'LqFy',
				LqMe: f.filter.liquifyMesh,
			},
			filterID: 1282492025,
		};
		case 'perspective warp': return {
			...base,
			Fltr: {
				_name: 'Perspective Warp',
				_classID: 'perspectiveWarpTransform',
				vertices: f.filter.vertices.map(pointToHrznVrtc),
				warpedVertices: f.filter.warpedVertices.map(pointToHrznVrtc),
				quads: f.filter.quads.map(indices => ({ indices })),
			},
			filterID: 442,
		};
		case 'curves': return {
			...base,
			Fltr: {
				_name: 'Curves',
				_classID: 'Crvs',
				presetKind: presetKindType.encode(f.filter.presetKind),
				Adjs: f.filter.adjustments.map(a => 'curve' in a ? {
					_name: '',
					_classID: 'CrvA',
					Chnl: a.channels.map(c => Chnl.encode(c)),
					'Crv ': a.curve.map(c => ({
						_name: '',
						_classID: 'Pnt ',
						Hrzn: c.x,
						Vrtc: c.y,
						...(c.curved ? { Cnty: true } : {}),
					}) as FilterCurvesCurvePoint),
				} : {
					_name: '',
					_classID: 'CrvA',
					Chnl: a.channels.map(c => Chnl.encode(c)),
					Mpng: a.values,
				}),
			},
			filterID: 1131574899,
		};
		// case 'hsb/hsl': return {
		// TODO: ...
		// };
		default: throw new Error(`Unknow filter type: ${(f as any).type}`);
	}
}

interface SoLdDescriptor {
	Idnt: string;
	placed: string;
	PgNm: number;
	totalPages: number;
	Crop?: number;
	frameStep: FractionDescriptor;
	duration: FractionDescriptor;
	frameCount: number;
	Annt: number;
	Type: number;
	Trnf: number[];
	nonAffineTransform: number[];
	quiltWarp?: QuiltWarpDescriptor;
	warp: WarpDescriptor;
	'Sz  ': { _name: '', _classID: 'Pnt ', Wdth: number; Hght: number; };
	Rslt: DescriptorUnitsValue;
	filterFX?: SoLdDescriptorFilter;
	comp?: number; // TODO: support this ?
	compInfo?: { compID: number; originalCompID: number; }; // TODO: support this ?
	Impr?: {}; // ???
	ClMg?: { // TODO: support this ?
		_name: '';
		_classID: 'ClMg';
		placedLayerOCIOConversion: string; // 'placedLayerOCIOConversion.placedLayerOCIOConvertEmbedded'
	};
}

// let t: any;

function getWarpFromPlacedLayer(placed: PlacedLayer): Warp {
	if (placed.warp) return placed.warp;

	if (!placed.width || !placed.height) throw new Error('You must provide width and height of the linked image in placedLayer');

	const w = placed.width;
	const h = placed.height;
	const x0 = 0, x1 = w / 3, x2 = w * 2 / 3, x3 = w;
	const y0 = 0, y1 = h / 3, y2 = h * 2 / 3, y3 = h;

	return {
		style: 'custom',
		value: 0,
		perspective: 0,
		perspectiveOther: 0,
		rotate: 'horizontal',
		bounds: {
			top: { value: 0, units: 'Pixels' },
			left: { value: 0, units: 'Pixels' },
			bottom: { value: h, units: 'Pixels' },
			right: { value: w, units: 'Pixels' },
		},
		uOrder: 4,
		vOrder: 4,
		customEnvelopeWarp: {
			meshPoints: [
				{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x2, y: y0 }, { x: x3, y: y0 },
				{ x: x0, y: y1 }, { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x3, y: y1 },
				{ x: x0, y: y2 }, { x: x1, y: y2 }, { x: x2, y: y2 }, { x: x3, y: y2 },
				{ x: x0, y: y3 }, { x: x1, y: y3 }, { x: x2, y: y3 }, { x: x3, y: y3 },
			],
		},
	};
}

addHandler(
	'SoLd',
	hasKey('placedLayer'),
	(reader, target, left) => {
		if (readSignature(reader) !== 'soLD') throw new Error(`Invalid SoLd type`);
		const version = readInt32(reader);
		if (version !== 4 && version !== 5) throw new Error(`Invalid SoLd version`);
		const desc: SoLdDescriptor = readVersionAndDescriptor(reader, true);
		// console.log('SoLd', require('util').inspect(desc, false, 99, true));
		// console.log('SoLd.warp', require('util').inspect(desc.warp, false, 99, true));
		// console.log('SoLd.quiltWarp', require('util').inspect(desc.quiltWarp, false, 99, true));
		// desc.filterFX!.filterFXList[0].Fltr.puppetShapeList[0].meshBoundaryPath.pathComponents[0].SbpL[0]['Pts '] = [];
		// console.log('read', require('util').inspect(desc.filterFX, false, 99, true));
		// console.log('filterFXList[0]', require('util').inspect((desc as any).filterFX.filterFXList[0], false, 99, true));
		// t = desc;

		target.placedLayer = {
			id: desc.Idnt,
			placed: desc.placed,
			type: placedLayerTypes[desc.Type],
			pageNumber: desc.PgNm,
			totalPages: desc.totalPages,
			frameStep: frac(desc.frameStep),
			duration: frac(desc.duration),
			frameCount: desc.frameCount,
			transform: desc.Trnf,
			width: desc['Sz  '].Wdth,
			height: desc['Sz  '].Hght,
			resolution: parseUnits(desc.Rslt),
			warp: parseWarp((desc.quiltWarp || desc.warp) as any),
		};

		if (desc.nonAffineTransform && desc.nonAffineTransform.some((x, i) => x !== desc.Trnf[i])) {
			target.placedLayer.nonAffineTransform = desc.nonAffineTransform;
		}

		if (desc.Crop) target.placedLayer.crop = desc.Crop;
		if (desc.comp) target.placedLayer.comp = desc.comp;
		if (desc.compInfo) {
			target.placedLayer.compInfo = {
				compID: desc.compInfo.compID,
				originalCompID: desc.compInfo.originalCompID,
			};
		}
		if (desc.filterFX) target.placedLayer.filter = parseFilterFX(desc.filterFX, reader);

		// console.log('filter', require('util').inspect(target.placedLayer.filter, false, 99, true));

		skipBytes(reader, left()); // HACK
	},
	(writer, target) => {
		writeSignature(writer, 'soLD');
		writeInt32(writer, 4); // version

		const placed = target.placedLayer!;

		if (!placed.id || typeof placed.id !== 'string' || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(placed.id)) {
			throw new Error('Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)');
		}

		const desc: SoLdDescriptor = {
			Idnt: placed.id,
			placed: placed.placed ?? placed.id,
			PgNm: placed.pageNumber || 1,
			totalPages: placed.totalPages || 1,
			...(placed.crop ? { Crop: placed.crop } : {}),
			frameStep: placed.frameStep || { numerator: 0, denominator: 600 },
			duration: placed.duration || { numerator: 0, denominator: 600 },
			frameCount: placed.frameCount || 0,
			Annt: 16,
			Type: placedLayerTypes.indexOf(placed.type),
			Trnf: placed.transform,
			nonAffineTransform: placed.nonAffineTransform ?? placed.transform,
			// quiltWarp: {} as any,
			warp: encodeWarp(getWarpFromPlacedLayer(placed)),
			'Sz  ': {
				_name: '',
				_classID: 'Pnt ',
				Wdth: placed.width || 0, // TODO: find size ?
				Hght: placed.height || 0, // TODO: find size ?
			},
			Rslt: placed.resolution ? unitsValue(placed.resolution, 'resolution') : { units: 'Density', value: 72 },
		};

		if (placed.filter) {
			desc.filterFX = {
				_name: '',
				_classID: 'filterFXStyle',
				enab: placed.filter.enabled,
				validAtPosition: placed.filter.validAtPosition,
				filterMaskEnable: placed.filter.maskEnabled,
				filterMaskLinked: placed.filter.maskLinked,
				filterMaskExtendWithWhite: placed.filter.maskExtendWithWhite,
				filterFXList: placed.filter.list.map(f => serializeFilterFXItem(f)),
			};
		}

		// TODO:
		// desc.comp = -1;
		// desc.compInfo = { _name: '', _classID: 'null', compID: -1, originalCompID: -1 } as any;
		// desc.ClMg = {
		// 	_name: '',
		// 	_classID: 'ClMg',
		// 	placedLayerOCIOConversion: 'placedLayerOCIOConversion.placedLayerOCIOConvertEmbedded'
		// } as any;

		// if (JSON.stringify(t) !== JSON.stringify(desc)) {
		// 	console.log('read', require('util').inspect(t, false, 99, true));
		// 	console.log('write', require('util').inspect(desc, false, 99, true));
		// 	console.error('DIFFERENT');
		// 	// throw new Error('DIFFERENT');
		// }

		if (placed.warp && isQuiltWarp(placed.warp)) {
			const quiltWarp = encodeWarp(placed.warp) as QuiltWarpDescriptor;
			desc.quiltWarp = quiltWarp;
			desc.warp = {
				warpStyle: 'warpStyle.warpNone',
				warpValue: quiltWarp.warpValue,
				warpPerspective: quiltWarp.warpPerspective,
				warpPerspectiveOther: quiltWarp.warpPerspectiveOther,
				warpRotate: quiltWarp.warpRotate,
				bounds: quiltWarp.bounds,
				uOrder: quiltWarp.uOrder,
				vOrder: quiltWarp.vOrder,
			};
		} else {
			delete desc.quiltWarp;
		}

		if (placed.comp) desc.comp = placed.comp;
		if (placed.compInfo) desc.compInfo = placed.compInfo;

		writeVersionAndDescriptor(writer, '', 'null', desc, desc.quiltWarp ? 'quiltWarp' : 'warp');
	},
);

addHandlerAlias('SoLE', 'SoLd');

addHandler(
	'fxrp',
	hasKey('referencePoint'),
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
	'Lr16',
	() => false,
	(reader, _target, _left, psd, imageResources) => {
		readLayerInfo(reader, psd, imageResources);
	},
	(_writer, _target) => {
	},
);

addHandler(
	'Lr32',
	() => false,
	(reader, _target, _left, psd, imageResources) => {
		readLayerInfo(reader, psd, imageResources);
	},
	(_writer, _target) => {
	},
);

addHandler(
	'LMsk',
	hasKey('userMask'),
	(reader, target) => {
		target.userMask = {
			colorSpace: readColor(reader),
			opacity: readUint16(reader) / 0xff,
		};
		const flag = readUint8(reader);
		if (flag !== 128) throw new Error('Invalid flag value');
		skipBytes(reader, 1);
	},
	(writer, target) => {
		const userMask = target.userMask!;
		writeColor(writer, userMask.colorSpace);
		writeUint16(writer, clamp(userMask.opacity, 0, 1) * 0xff);
		writeUint8(writer, 128);
		writeZeros(writer, 1);
	},
);

if (MOCK_HANDLERS) {
	addHandler(
		'Patt',
		target => (target as any)._Patt !== undefined,
		(reader, target, left) => {
			// console.log('additional info: Patt');
			(target as any)._Patt = readBytes(reader, left());
		},
		(writer, target) => false && writeBytes(writer, (target as any)._Patt),
	);
} else {
	addHandler(
		'Patt', // TODO: handle also Pat2 & Pat3
		target => !target,
		(reader, target, left) => {
			if (!left()) return;

			skipBytes(reader, left()); return; // not supported yet
			target; readPattern;

			// if (!target.patterns) target.patterns = [];
			// target.patterns.push(readPattern(reader));
			// skipBytes(reader, left());
		},
		(_writer, _target) => {
		},
	);
}

/*
interface CAIDesc {
	enab: boolean;
	generationalGuid: string;
}

addHandler(
	'CAI ', // content credentials ? something to do with generative tech
	() => false,
	(reader, _target, left) => {
		const version = readUint32(reader); // 3
		const desc = readVersionAndDescriptor(reader) as CAIDesc;
		console.log('CAI', require('util').inspect(desc, false, 99, true));
		console.log('CAI', { version });
		console.log('CAI left', readBytes(reader, left())); // 8 bytes left, all zeroes
	},
	(_writer, _target) => {
	},
);
*/

if (MOCK_HANDLERS) {
	addHandler(
		'CAI ',
		target => (target as any)._CAI_ !== undefined,
		(reader, target, left) => {
			(target as any)._CAI_ = readBytes(reader, left());
		},
		(writer, target) => {
			writeBytes(writer, (target as any)._CAI_);
		},
	);
}

if (MOCK_HANDLERS) {
	addHandler(
		'OCIO', // generative tech?
		target => (target as any)._OCIO !== undefined,
		(reader, target, left) => {
			(target as any)._OCIO = readBytes(reader, left());
		},
		(writer, target) => {
			writeBytes(writer, (target as any)._OCIO);
		},
	);
}

// interface GenIDesc {
// 	isUsingGenTech: number;
// }

if (MOCK_HANDLERS) {
	addHandler(
		'GenI', // generative tech
		target => (target as any)._GenI !== undefined,
		(reader, target, left) => {
			(target as any)._GenI = readBytes(reader, left());
			// const desc = readVersionAndDescriptor(reader) as GenIDesc;
			// console.log('GenI', require('util').inspect(desc, false, 99, true));
		},
		(writer, target) => {
			writeBytes(writer, (target as any)._GenI);
		},
	);
}

function readRect(reader: PsdReader) {
	const top = readInt32(reader);
	const left = readInt32(reader);
	const bottom = readInt32(reader);
	const right = readInt32(reader);
	return { top, left, bottom, right };
}

function writeRect(writer: PsdWriter, rect: { left: number; top: number; right: number; bottom: number }) {
	writeInt32(writer, rect.top);
	writeInt32(writer, rect.left);
	writeInt32(writer, rect.bottom);
	writeInt32(writer, rect.right);
}

addHandler(
	'Anno',
	target => (target as Psd).annotations !== undefined,
	(reader, target, left) => {
		const major = readUint16(reader);
		const minor = readUint16(reader);
		if (major !== 2 || minor !== 1) throw new Error('Invalid Anno version');
		const count = readUint32(reader);
		const annotations: Annotation[] = [];

		for (let i = 0; i < count; i++) {
			/*const length =*/ readUint32(reader);
			const type = readSignature(reader);
			const open = !!readUint8(reader);
			/*const flags =*/ readUint8(reader); // always 28
			/*const optionalBlocks =*/ readUint16(reader);
			const iconLocation = readRect(reader);
			const popupLocation = readRect(reader);
			const color = readColor(reader);
			const author = readPascalString(reader, 2);
			const name = readPascalString(reader, 2);
			const date = readPascalString(reader, 2);
			/*const contentLength =*/ readUint32(reader);
			/*const dataType =*/ readSignature(reader);
			const dataLength = readUint32(reader);
			let data: string | Uint8Array;

			if (type === 'txtA') {
				if (dataLength >= 2 && readUint16(reader) === 0xfeff) {
					data = readUnicodeStringWithLength(reader, (dataLength - 2) / 2);
				} else {
					reader.offset -= 2;
					data = readAsciiString(reader, dataLength);
				}

				data = data.replace(/\r/g, '\n');
			} else if (type === 'sndA') {
				data = readBytes(reader, dataLength);
			} else {
				throw new Error('Unknown annotation type');
			}

			annotations.push({
				type: type === 'txtA' ? 'text' : 'sound', open, iconLocation, popupLocation, color, author, name, date, data,
			});
		}

		(target as Psd).annotations = annotations;
		skipBytes(reader, left());
	},
	(writer, target) => {
		const annotations = (target as Psd).annotations!;

		writeUint16(writer, 2);
		writeUint16(writer, 1);
		writeUint32(writer, annotations.length);

		for (const annotation of annotations) {
			const sound = annotation.type === 'sound';

			if (sound && !(annotation.data instanceof Uint8Array)) throw new Error('Sound annotation data should be Uint8Array');
			if (!sound && typeof annotation.data !== 'string') throw new Error('Text annotation data should be string');

			const lengthOffset = writer.offset;
			writeUint32(writer, 0); // length
			writeSignature(writer, sound ? 'sndA' : 'txtA');
			writeUint8(writer, annotation.open ? 1 : 0);
			writeUint8(writer, 28);
			writeUint16(writer, 1);
			writeRect(writer, annotation.iconLocation);
			writeRect(writer, annotation.popupLocation);
			writeColor(writer, annotation.color);
			writePascalString(writer, annotation.author || '', 2);
			writePascalString(writer, annotation.name || '', 2);
			writePascalString(writer, annotation.date || '', 2);
			const contentOffset = writer.offset;
			writeUint32(writer, 0); // content length
			writeSignature(writer, sound ? 'sndM' : 'txtC');
			writeUint32(writer, 0); // data length
			const dataOffset = writer.offset;

			if (sound) {
				writeBytes(writer, annotation.data as Uint8Array);
			} else {
				writeUint16(writer, 0xfeff); // unicode string indicator
				const text = (annotation.data as string).replace(/\n/g, '\r');
				for (let i = 0; i < text.length; i++) writeUint16(writer, text.charCodeAt(i));
			}

			writer.view.setUint32(lengthOffset, writer.offset - lengthOffset, false);
			writer.view.setUint32(contentOffset, writer.offset - contentOffset, false);
			writer.view.setUint32(dataOffset - 4, writer.offset - dataOffset, false);
		}
	}
);

interface FileOpenDescriptor {
	compInfo: { compID: number; originalCompID: number; };
}

interface LinkedFileDescriptor {
	descVersion: 2;
	'Nm  ': string;
	fullPath: string;
	originalPath: string;
	relPath: string;
}

function createLnkHandler(tag: string) {
	addHandler(
		tag,
		(target: any) => {
			const psd = target as Psd;
			if (!psd.linkedFiles || !psd.linkedFiles.length) return false;
			if (tag === 'lnkE' && !psd.linkedFiles.some(f => f.linkedFile)) return false;
			return true;
		},
		(reader, target, left, _psd) => {
			const psd = target as Psd;
			psd.linkedFiles = psd.linkedFiles || [];

			while (left() > 8) {
				let size = readLength64(reader);
				const startOffset = reader.offset;
				const type = readSignature(reader) as 'liFD' | 'liFE' | 'liFA';
				// liFD - linked file data
				// liFE - linked file external
				// liFA - linked file alias
				const version = readInt32(reader);
				const id = readPascalString(reader, 1);
				const name = readUnicodeString(reader);

				const fileType = readSignature(reader).trim(); // '    ' if empty
				const fileCreator = readSignature(reader).trim(); // '    ' or '\0\0\0\0' if empty
				const dataSize = readLength64(reader);
				const hasFileOpenDescriptor = readUint8(reader);
				const fileOpenDescriptor = hasFileOpenDescriptor ? readVersionAndDescriptor(reader) as FileOpenDescriptor : undefined;
				const linkedFileDescriptor = type === 'liFE' ? readVersionAndDescriptor(reader) as LinkedFileDescriptor : undefined;
				const file: LinkedFile = { id, name };

				if (fileType) file.type = fileType;
				if (fileCreator) file.creator = fileCreator;

				if (fileOpenDescriptor) {
					file.descriptor = {
						compInfo: {
							compID: fileOpenDescriptor.compInfo.compID,
							originalCompID: fileOpenDescriptor.compInfo.originalCompID,
						}
					};
				}

				if (type === 'liFE' && version > 3) {
					const year = readInt32(reader);
					const month = readUint8(reader);
					const day = readUint8(reader);
					const hour = readUint8(reader);
					const minute = readUint8(reader);
					const seconds = readFloat64(reader);
					const wholeSeconds = Math.floor(seconds);
					const ms = (seconds - wholeSeconds) * 1000;
					file.time = (new Date(Date.UTC(year, month, day, hour, minute, wholeSeconds, ms))).toISOString();
				}

				const fileSize = type === 'liFE' ? readLength64(reader) : 0;

				if (type === 'liFA') skipBytes(reader, 8);
				if (type === 'liFD') file.data = readBytes(reader, dataSize); // seems to be a typo in docs
				if (version >= 5) file.childDocumentID = readUnicodeString(reader);
				if (version >= 6) file.assetModTime = readFloat64(reader);
				if (version >= 7) file.assetLockedState = readUint8(reader);
				if (type === 'liFE' && version === 2) file.data = readBytes(reader, fileSize);

				if (reader.skipLinkedFilesData) file.data = undefined;

				if (tag === 'lnkE') {
					file.linkedFile = {
						fileSize,
						name: linkedFileDescriptor?.['Nm  '] || '',
						fullPath: linkedFileDescriptor?.fullPath || '',
						originalPath: linkedFileDescriptor?.originalPath || '',
						relativePath: linkedFileDescriptor?.relPath || '',
					};
				}

				psd.linkedFiles.push(file);

				while (size % 4) size++;
				reader.offset = startOffset + size;
			}

			skipBytes(reader, left()); // ?
		},
		(writer, target) => {
			const psd = target as Psd;

			for (const file of psd.linkedFiles!) {
				if ((tag === 'lnkE') !== !!file.linkedFile) continue;

				let version = 2;

				if (file.assetLockedState != null) version = 7;
				else if (file.assetModTime != null) version = 6;
				else if (file.childDocumentID != null) version = 5;
				else if (tag == 'lnkE') version = 3;

				writeLength64(writer, 0);

				const sizeOffset = writer.offset;
				writeSignature(writer, (tag === 'lnkE') ? 'liFE' : (file.data ? 'liFD' : 'liFA'));
				writeInt32(writer, version);
				if (!file.id || typeof file.id !== 'string' || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(file.id)) {
					throw new Error('Linked file ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)');
				}
				writePascalString(writer, file.id, 1);
				writeUnicodeStringWithPadding(writer, file.name || '');
				writeSignature(writer, file.type ? `${file.type}    `.substring(0, 4) : '    ');
				writeSignature(writer, file.creator ? `${file.creator}    `.substring(0, 4) : '\0\0\0\0');
				writeLength64(writer, file.data ? file.data.byteLength : 0);

				if (file.descriptor && file.descriptor.compInfo) {
					const desc: FileOpenDescriptor = {
						compInfo: {
							compID: file.descriptor.compInfo.compID,
							originalCompID: file.descriptor.compInfo.originalCompID,
						},
					};

					writeUint8(writer, 1);
					writeVersionAndDescriptor(writer, '', 'null', desc);
				} else {
					writeUint8(writer, 0);
				}

				if (tag === 'lnkE') {
					const desc: LinkedFileDescriptor = {
						descVersion: 2,
						'Nm  ': file.linkedFile?.name ?? '',
						fullPath: file.linkedFile?.fullPath ?? '',
						originalPath: file.linkedFile?.originalPath ?? '',
						relPath: file.linkedFile?.relativePath ?? '',
					};

					writeVersionAndDescriptor(writer, '', 'ExternalFileLink', desc);

					const time = file.time ? new Date(file.time) : new Date();
					writeInt32(writer, time.getUTCFullYear());
					writeUint8(writer, time.getUTCMonth());
					writeUint8(writer, time.getUTCDate());
					writeUint8(writer, time.getUTCHours());
					writeUint8(writer, time.getUTCMinutes());
					writeFloat64(writer, time.getUTCSeconds() + time.getUTCMilliseconds() / 1000);
				}

				if (file.data) {
					writeBytes(writer, file.data);
				} else {
					writeLength64(writer, file.linkedFile?.fileSize || 0);
				}

				if (version >= 5) writeUnicodeStringWithPadding(writer, file.childDocumentID || '');
				if (version >= 6) writeFloat64(writer, file.assetModTime || 0);
				if (version >= 7) writeUint8(writer, file.assetLockedState || 0);

				let size = writer.offset - sizeOffset;
				writer.view.setUint32(sizeOffset - 4, size, false); // write size

				while (size % 4) {
					size++;
					writeUint8(writer, 0);
				}
			}
		},
	);
}

createLnkHandler('lnk2');
createLnkHandler('lnkE');

addHandlerAlias('lnkD', 'lnk2');
addHandlerAlias('lnk3', 'lnk2');

interface PthsDescriptor {
	pathList: {
		_classID: 'pathInfoClass';
		pathUnicodeName: string;
		pathSymmetryClass: {
			_classID: 'pathSymmetryClass';
			pathSymmetryMode: string; // 'pathSymmetryModeEnum.pathSymmetryModeBasicPath'
		};
	}[];
}

addHandler(
	'pths',
	hasKey('pathList'),
	(reader, target) => {
		const desc = readVersionAndDescriptor(reader, true) as PthsDescriptor;
		// console.log(require('util').inspect(desc, false, 99, true));
		// if (options.throwForMissingFeatures && desc?.pathList?.length) throw new Error('non-empty pathList in `pths`');
		desc;
		target.pathList = []; // TODO: read paths
	},
	(writer, _target) => {
		const desc: PthsDescriptor = {
			pathList: [], // TODO: write paths
		};

		writeVersionAndDescriptor(writer, '', 'pathsDataClass', desc);
	},
);

addHandler(
	'lyvr',
	hasKey('version'),
	(reader, target) => target.version = readUint32(reader),
	(writer, target) => writeUint32(writer, target.version!),
);

function adjustmentType(type: string) {
	return (target: LayerAdditionalInfo) => !!target.adjustment && target.adjustment.type === type;
}

addHandler(
	'brit',
	adjustmentType('brightness/contrast'),
	(reader, target, left) => {
		if (!target.adjustment) { // ignore if got one from CgEd block
			target.adjustment = {
				type: 'brightness/contrast',
				brightness: readInt16(reader),
				contrast: readInt16(reader),
				meanValue: readInt16(reader),
				labColorOnly: !!readUint8(reader),
				useLegacy: true,
			};
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as BrightnessAdjustment;
		writeInt16(writer, info.brightness || 0);
		writeInt16(writer, info.contrast || 0);
		writeInt16(writer, info.meanValue ?? 127);
		writeUint8(writer, info.labColorOnly ? 1 : 0);
		writeZeros(writer, 1);
	},
);

function readLevelsChannel(reader: PsdReader): LevelsAdjustmentChannel {
	const shadowInput = readInt16(reader);
	const highlightInput = readInt16(reader);
	const shadowOutput = readInt16(reader);
	const highlightOutput = readInt16(reader);
	const midtoneInput = readInt16(reader) / 100;
	return { shadowInput, highlightInput, shadowOutput, highlightOutput, midtoneInput };
}

function writeLevelsChannel(writer: PsdWriter, channel: LevelsAdjustmentChannel) {
	writeInt16(writer, channel.shadowInput);
	writeInt16(writer, channel.highlightInput);
	writeInt16(writer, channel.shadowOutput);
	writeInt16(writer, channel.highlightOutput);
	writeInt16(writer, Math.round(channel.midtoneInput * 100));
}

addHandler(
	'levl',
	adjustmentType('levels'),
	(reader, target, left) => {
		if (readUint16(reader) !== 2) throw new Error('Invalid levl version');

		target.adjustment = {
			...target.adjustment as PresetInfo,
			type: 'levels',
			rgb: readLevelsChannel(reader),
			red: readLevelsChannel(reader),
			green: readLevelsChannel(reader),
			blue: readLevelsChannel(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as LevelsAdjustment;
		const defaultChannel = {
			shadowInput: 0,
			highlightInput: 255,
			shadowOutput: 0,
			highlightOutput: 255,
			midtoneInput: 1,
		};

		writeUint16(writer, 2); // version
		writeLevelsChannel(writer, info.rgb || defaultChannel);
		writeLevelsChannel(writer, info.red || defaultChannel);
		writeLevelsChannel(writer, info.blue || defaultChannel);
		writeLevelsChannel(writer, info.green || defaultChannel);
		for (let i = 0; i < 59; i++) writeLevelsChannel(writer, defaultChannel);
	},
);

function readCurveChannel(reader: PsdReader) {
	const nodes = readUint16(reader);
	const channel: CurvesAdjustmentChannel = [];

	for (let j = 0; j < nodes; j++) {
		const output = readInt16(reader);
		const input = readInt16(reader);
		channel.push({ input, output });
	}

	return channel;
}

function writeCurveChannel(writer: PsdWriter, channel: CurvesAdjustmentChannel) {
	writeUint16(writer, channel.length);

	for (const n of channel) {
		writeUint16(writer, n.output);
		writeUint16(writer, n.input);
	}
}

addHandler(
	'curv',
	adjustmentType('curves'),
	(reader, target, left) => {
		readUint8(reader);
		if (readUint16(reader) !== 1) throw new Error('Invalid curv version');
		readUint16(reader);
		const channels = readUint16(reader);
		const info: CurvesAdjustment = { type: 'curves' };

		if (channels & 1) info.rgb = readCurveChannel(reader);
		if (channels & 2) info.red = readCurveChannel(reader);
		if (channels & 4) info.green = readCurveChannel(reader);
		if (channels & 8) info.blue = readCurveChannel(reader);

		target.adjustment = {
			...target.adjustment as PresetInfo,
			...info,
		};

		// ignoring, duplicate information
		// checkSignature(reader, 'Crv ');

		// const cVersion = readUint16(reader);
		// readUint16(reader);
		// const channelCount = readUint16(reader);

		// for (let i = 0; i < channelCount; i++) {
		// 	const index = readUint16(reader);
		// 	const nodes = readUint16(reader);

		// 	for (let j = 0; j < nodes; j++) {
		// 		const output = readInt16(reader);
		// 		const input = readInt16(reader);
		// 	}
		// }

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as CurvesAdjustment;
		const { rgb, red, green, blue } = info;
		let channels = 0;
		let channelCount = 0;

		if (rgb && rgb.length) { channels |= 1; channelCount++; }
		if (red && red.length) { channels |= 2; channelCount++; }
		if (green && green.length) { channels |= 4; channelCount++; }
		if (blue && blue.length) { channels |= 8; channelCount++; }

		writeUint8(writer, 0);
		writeUint16(writer, 1); // version
		writeUint16(writer, 0);
		writeUint16(writer, channels);

		if (rgb && rgb.length) writeCurveChannel(writer, rgb);
		if (red && red.length) writeCurveChannel(writer, red);
		if (green && green.length) writeCurveChannel(writer, green);
		if (blue && blue.length) writeCurveChannel(writer, blue);

		writeSignature(writer, 'Crv ');
		writeUint16(writer, 4); // version
		writeUint16(writer, 0);
		writeUint16(writer, channelCount);

		if (rgb && rgb.length) { writeUint16(writer, 0); writeCurveChannel(writer, rgb); }
		if (red && red.length) { writeUint16(writer, 1); writeCurveChannel(writer, red); }
		if (green && green.length) { writeUint16(writer, 2); writeCurveChannel(writer, green); }
		if (blue && blue.length) { writeUint16(writer, 3); writeCurveChannel(writer, blue); }

		writeZeros(writer, 2);
	},
);

addHandler(
	'expA',
	adjustmentType('exposure'),
	(reader, target, left) => {
		if (readUint16(reader) !== 1) throw new Error('Invalid expA version');

		target.adjustment = {
			...target.adjustment as PresetInfo,
			type: 'exposure',
			exposure: readFloat32(reader),
			offset: readFloat32(reader),
			gamma: readFloat32(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as ExposureAdjustment;
		writeUint16(writer, 1); // version
		writeFloat32(writer, info.exposure!);
		writeFloat32(writer, info.offset!);
		writeFloat32(writer, info.gamma!);
		writeZeros(writer, 2);
	},
);

interface VibranceDescriptor {
	vibrance?: number;
	Strt?: number;
}

addHandler(
	'vibA',
	adjustmentType('vibrance'),
	(reader, target, left) => {
		const desc: VibranceDescriptor = readVersionAndDescriptor(reader);
		target.adjustment = { type: 'vibrance' };
		if (desc.vibrance !== undefined) target.adjustment.vibrance = desc.vibrance;
		if (desc.Strt !== undefined) target.adjustment.saturation = desc.Strt;

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as VibranceAdjustment;
		const desc: VibranceDescriptor = {};
		if (info.vibrance !== undefined) desc.vibrance = info.vibrance;
		if (info.saturation !== undefined) desc.Strt = info.saturation;

		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

function readHueChannel(reader: PsdReader): HueSaturationAdjustmentChannel {
	return {
		a: readInt16(reader),
		b: readInt16(reader),
		c: readInt16(reader),
		d: readInt16(reader),
		hue: readInt16(reader),
		saturation: readInt16(reader),
		lightness: readInt16(reader),
	};
}

function writeHueChannel(writer: PsdWriter, channel: HueSaturationAdjustmentChannel | undefined) {
	const c = channel || {} as Partial<HueSaturationAdjustmentChannel>;
	writeInt16(writer, c.a || 0);
	writeInt16(writer, c.b || 0);
	writeInt16(writer, c.c || 0);
	writeInt16(writer, c.d || 0);
	writeInt16(writer, c.hue || 0);
	writeInt16(writer, c.saturation || 0);
	writeInt16(writer, c.lightness || 0);
}

addHandler(
	'hue2',
	adjustmentType('hue/saturation'),
	(reader, target, left) => {
		if (readUint16(reader) !== 2) throw new Error('Invalid hue2 version');

		target.adjustment = {
			...target.adjustment as PresetInfo,
			type: 'hue/saturation',
			master: readHueChannel(reader),
			reds: readHueChannel(reader),
			yellows: readHueChannel(reader),
			greens: readHueChannel(reader),
			cyans: readHueChannel(reader),
			blues: readHueChannel(reader),
			magentas: readHueChannel(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as HueSaturationAdjustment;

		writeUint16(writer, 2); // version
		writeHueChannel(writer, info.master);
		writeHueChannel(writer, info.reds);
		writeHueChannel(writer, info.yellows);
		writeHueChannel(writer, info.greens);
		writeHueChannel(writer, info.cyans);
		writeHueChannel(writer, info.blues);
		writeHueChannel(writer, info.magentas);
	},
);

function readColorBalance(reader: PsdReader): ColorBalanceValues {
	return {
		cyanRed: readInt16(reader),
		magentaGreen: readInt16(reader),
		yellowBlue: readInt16(reader),
	};
}

function writeColorBalance(writer: PsdWriter, value: Partial<ColorBalanceValues>) {
	writeInt16(writer, value.cyanRed || 0);
	writeInt16(writer, value.magentaGreen || 0);
	writeInt16(writer, value.yellowBlue || 0);
}

addHandler(
	'blnc',
	adjustmentType('color balance'),
	(reader, target, left) => {
		target.adjustment = {
			type: 'color balance',
			shadows: readColorBalance(reader),
			midtones: readColorBalance(reader),
			highlights: readColorBalance(reader),
			preserveLuminosity: !!readUint8(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as ColorBalanceAdjustment;
		writeColorBalance(writer, info.shadows || {});
		writeColorBalance(writer, info.midtones || {});
		writeColorBalance(writer, info.highlights || {});
		writeUint8(writer, info.preserveLuminosity ? 1 : 0);
		writeZeros(writer, 1);
	},
);

interface BlackAndWhiteDescriptor {
	'Rd  ': number;
	Yllw: number;
	'Grn ': number;
	'Cyn ': number;
	'Bl  ': number;
	Mgnt: number;
	useTint: boolean;
	tintColor?: DescriptorColor;
	bwPresetKind: number;
	blackAndWhitePresetFileName: string;
}

addHandler(
	'blwh',
	adjustmentType('black & white'),
	(reader, target, left) => {
		const desc: BlackAndWhiteDescriptor = readVersionAndDescriptor(reader);
		target.adjustment = {
			type: 'black & white',
			reds: desc['Rd  '],
			yellows: desc.Yllw,
			greens: desc['Grn '],
			cyans: desc['Cyn '],
			blues: desc['Bl  '],
			magentas: desc.Mgnt,
			useTint: !!desc.useTint,
			presetKind: desc.bwPresetKind,
			presetFileName: desc.blackAndWhitePresetFileName,
		};

		if (desc.tintColor !== undefined) target.adjustment.tintColor = parseColor(desc.tintColor);

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as BlackAndWhiteAdjustment;
		const desc: BlackAndWhiteDescriptor = {
			'Rd  ': info.reds || 0,
			Yllw: info.yellows || 0,
			'Grn ': info.greens || 0,
			'Cyn ': info.cyans || 0,
			'Bl  ': info.blues || 0,
			Mgnt: info.magentas || 0,
			useTint: !!info.useTint,
			tintColor: serializeColor(info.tintColor),
			bwPresetKind: info.presetKind || 0,
			blackAndWhitePresetFileName: info.presetFileName || '',
		};

		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

addHandler(
	'phfl',
	adjustmentType('photo filter'),
	(reader, target, left) => {
		const version = readUint16(reader);
		if (version !== 2 && version !== 3) throw new Error('Invalid phfl version');

		let color: Color;

		if (version === 2) {
			color = readColor(reader);
		} else { // version 3
			// TODO: test this, this is probably wrong
			color = {
				l: readInt32(reader) / 100,
				a: readInt32(reader) / 100,
				b: readInt32(reader) / 100,
			};
		}

		target.adjustment = {
			type: 'photo filter',
			color,
			density: readUint32(reader) / 100,
			preserveLuminosity: !!readUint8(reader),
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as PhotoFilterAdjustment;
		writeUint16(writer, 2); // version
		writeColor(writer, info.color || { l: 0, a: 0, b: 0 });
		writeUint32(writer, (info.density || 0) * 100);
		writeUint8(writer, info.preserveLuminosity ? 1 : 0);
		writeZeros(writer, 3);
	},
);

function readMixrChannel(reader: PsdReader): ChannelMixerChannel {
	const red = readInt16(reader);
	const green = readInt16(reader);
	const blue = readInt16(reader);
	skipBytes(reader, 2);
	const constant = readInt16(reader);
	return { red, green, blue, constant };
}

function writeMixrChannel(writer: PsdWriter, channel: ChannelMixerChannel | undefined) {
	const c = channel || {} as Partial<ChannelMixerChannel>;
	writeInt16(writer, c.red!);
	writeInt16(writer, c.green!);
	writeInt16(writer, c.blue!);
	writeZeros(writer, 2);
	writeInt16(writer, c.constant!);
}

addHandler(
	'mixr',
	adjustmentType('channel mixer'),
	(reader, target, left) => {
		if (readUint16(reader) !== 1) throw new Error('Invalid mixr version');

		const adjustment: ChannelMixerAdjustment = target.adjustment = {
			...target.adjustment as PresetInfo,
			type: 'channel mixer',
			monochrome: !!readUint16(reader),
		};

		if (!adjustment.monochrome) {
			adjustment.red = readMixrChannel(reader);
			adjustment.green = readMixrChannel(reader);
			adjustment.blue = readMixrChannel(reader);
		}

		adjustment.gray = readMixrChannel(reader);

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as ChannelMixerAdjustment;
		writeUint16(writer, 1); // version
		writeUint16(writer, info.monochrome ? 1 : 0);

		if (info.monochrome) {
			writeMixrChannel(writer, info.gray);
			writeZeros(writer, 3 * 5 * 2);
		} else {
			writeMixrChannel(writer, info.red);
			writeMixrChannel(writer, info.green);
			writeMixrChannel(writer, info.blue);
			writeMixrChannel(writer, info.gray);
		}
	},
);

const colorLookupType = createEnum<'3dlut' | 'abstractProfile' | 'deviceLinkProfile'>('colorLookupType', '3DLUT', {
	'3dlut': '3DLUT',
	abstractProfile: 'abstractProfile',
	deviceLinkProfile: 'deviceLinkProfile',
});

const LUTFormatType = createEnum<'look' | 'cube' | '3dl'>('LUTFormatType', 'look', {
	look: 'LUTFormatLOOK',
	cube: 'LUTFormatCUBE',
	'3dl': 'LUTFormat3DL',
});

const colorLookupOrder = createEnum<'rgb' | 'bgr'>('colorLookupOrder', 'rgb', {
	rgb: 'rgbOrder',
	bgr: 'bgrOrder',
});

interface ColorLookupDescriptor {
	lookupType?: string;
	'Nm  '?: string;
	Dthr?: boolean;
	profile?: Uint8Array;
	LUTFormat?: string;
	dataOrder?: string;
	tableOrder?: string;
	LUT3DFileData?: Uint8Array;
	LUT3DFileName?: string;
}

addHandler(
	'clrL',
	adjustmentType('color lookup'),
	(reader, target, left) => {
		if (readUint16(reader) !== 1) throw new Error('Invalid clrL version');

		const desc: ColorLookupDescriptor = readVersionAndDescriptor(reader);
		target.adjustment = { type: 'color lookup' };
		const info = target.adjustment;

		if (desc.lookupType !== undefined) info.lookupType = colorLookupType.decode(desc.lookupType);
		if (desc['Nm  '] !== undefined) info.name = desc['Nm  '];
		if (desc.Dthr !== undefined) info.dither = desc.Dthr;
		if (desc.profile !== undefined) info.profile = desc.profile;
		if (desc.LUTFormat !== undefined) info.lutFormat = LUTFormatType.decode(desc.LUTFormat);
		if (desc.dataOrder !== undefined) info.dataOrder = colorLookupOrder.decode(desc.dataOrder);
		if (desc.tableOrder !== undefined) info.tableOrder = colorLookupOrder.decode(desc.tableOrder);
		if (desc.LUT3DFileData !== undefined) info.lut3DFileData = desc.LUT3DFileData;
		if (desc.LUT3DFileName !== undefined) info.lut3DFileName = desc.LUT3DFileName;

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as ColorLookupAdjustment;
		const desc: ColorLookupDescriptor = {};

		if (info.lookupType !== undefined) desc.lookupType = colorLookupType.encode(info.lookupType);
		if (info.name !== undefined) desc['Nm  '] = info.name;
		if (info.dither !== undefined) desc.Dthr = info.dither;
		if (info.profile !== undefined) desc.profile = info.profile;
		if (info.lutFormat !== undefined) desc.LUTFormat = LUTFormatType.encode(info.lutFormat);
		if (info.dataOrder !== undefined) desc.dataOrder = colorLookupOrder.encode(info.dataOrder);
		if (info.tableOrder !== undefined) desc.tableOrder = colorLookupOrder.encode(info.tableOrder);
		if (info.lut3DFileData !== undefined) desc.LUT3DFileData = info.lut3DFileData;
		if (info.lut3DFileName !== undefined) desc.LUT3DFileName = info.lut3DFileName;

		writeUint16(writer, 1); // version
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

addHandler(
	'nvrt',
	adjustmentType('invert'),
	(reader, target, left) => {
		target.adjustment = { type: 'invert' };
		skipBytes(reader, left());
	},
	() => {
		// nothing to write here
	},
);

addHandler(
	'post',
	adjustmentType('posterize'),
	(reader, target, left) => {
		target.adjustment = {
			type: 'posterize',
			levels: readUint16(reader),
		};
		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as PosterizeAdjustment;
		writeUint16(writer, info.levels ?? 4);
		writeZeros(writer, 2);
	},
);

addHandler(
	'thrs',
	adjustmentType('threshold'),
	(reader, target, left) => {
		target.adjustment = {
			type: 'threshold',
			level: readUint16(reader),
		};
		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment as ThresholdAdjustment;
		writeUint16(writer, info.level ?? 128);
		writeZeros(writer, 2);
	},
);

const grdmColorModels = ['', '', '', 'rgb', 'hsb', '', 'lab'];

addHandler(
	'grdm',
	adjustmentType('gradient map'),
	(reader, target, left) => {
		if (readUint16(reader) !== 1) throw new Error('Invalid grdm version');

		const info: GradientMapAdjustment = {
			type: 'gradient map',
			gradientType: 'solid',
		};

		info.reverse = !!readUint8(reader);
		info.dither = !!readUint8(reader);
		info.name = readUnicodeString(reader);
		info.colorStops = [];
		info.opacityStops = [];

		const stopsCount = readUint16(reader);

		for (let i = 0; i < stopsCount; i++) {
			info.colorStops.push({
				location: readUint32(reader),
				midpoint: readUint32(reader) / 100,
				color: readColor(reader),
			});
			skipBytes(reader, 2);
		}

		const opacityStopsCount = readUint16(reader);

		for (let i = 0; i < opacityStopsCount; i++) {
			info.opacityStops.push({
				location: readUint32(reader),
				midpoint: readUint32(reader) / 100,
				opacity: readUint16(reader) / 0xff,
			});
		}

		const expansionCount = readUint16(reader);
		if (expansionCount !== 2) throw new Error('Invalid grdm expansion count');

		const interpolation = readUint16(reader);
		info.smoothness = interpolation / 4096;

		const length = readUint16(reader);
		if (length !== 32) throw new Error('Invalid grdm length');

		info.gradientType = readUint16(reader) ? 'noise' : 'solid';
		info.randomSeed = readUint32(reader);
		info.addTransparency = !!readUint16(reader);
		info.restrictColors = !!readUint16(reader);
		info.roughness = readUint32(reader) / 4096;
		info.colorModel = (grdmColorModels[readUint16(reader)] || 'rgb') as 'rgb' | 'hsb' | 'lab';

		info.min = [
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
		];

		info.max = [
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
			readUint16(reader) / 0x8000,
		];

		skipBytes(reader, left());

		for (const s of info.colorStops) s.location /= interpolation;
		for (const s of info.opacityStops) s.location /= interpolation;

		target.adjustment = info;
	},
	(writer, target) => {
		const info = target.adjustment as GradientMapAdjustment;

		writeUint16(writer, 1); // version
		writeUint8(writer, info.reverse ? 1 : 0);
		writeUint8(writer, info.dither ? 1 : 0);
		writeUnicodeStringWithPadding(writer, info.name || '');
		writeUint16(writer, info.colorStops && info.colorStops.length || 0);

		const interpolation = Math.round((info.smoothness ?? 1) * 4096);

		for (const s of info.colorStops || []) {
			writeUint32(writer, Math.round(s.location * interpolation));
			writeUint32(writer, Math.round(s.midpoint * 100));
			writeColor(writer, s.color);
			writeZeros(writer, 2);
		}

		writeUint16(writer, info.opacityStops && info.opacityStops.length || 0);

		for (const s of info.opacityStops || []) {
			writeUint32(writer, Math.round(s.location * interpolation));
			writeUint32(writer, Math.round(s.midpoint * 100));
			writeUint16(writer, Math.round(s.opacity * 0xff));
		}

		writeUint16(writer, 2); // expansion count
		writeUint16(writer, interpolation);
		writeUint16(writer, 32); // length
		writeUint16(writer, info.gradientType === 'noise' ? 1 : 0);
		writeUint32(writer, info.randomSeed || 0);
		writeUint16(writer, info.addTransparency ? 1 : 0);
		writeUint16(writer, info.restrictColors ? 1 : 0);
		writeUint32(writer, Math.round((info.roughness ?? 1) * 4096));
		const colorModel = grdmColorModels.indexOf(info.colorModel ?? 'rgb');
		writeUint16(writer, colorModel === -1 ? 3 : colorModel);

		for (let i = 0; i < 4; i++)
			writeUint16(writer, Math.round((info.min && info.min[i] || 0) * 0x8000));

		for (let i = 0; i < 4; i++)
			writeUint16(writer, Math.round((info.max && info.max[i] || 0) * 0x8000));

		writeZeros(writer, 4);
	},
);

function readSelectiveColors(reader: PsdReader): CMYK {
	return {
		c: readInt16(reader),
		m: readInt16(reader),
		y: readInt16(reader),
		k: readInt16(reader),
	};
}

function writeSelectiveColors(writer: PsdWriter, cmyk: CMYK | undefined) {
	const c = cmyk || {} as Partial<CMYK>;
	writeInt16(writer, c.c!);
	writeInt16(writer, c.m!);
	writeInt16(writer, c.y!);
	writeInt16(writer, c.k!);
}

addHandler(
	'selc',
	adjustmentType('selective color'),
	(reader, target) => {
		if (readUint16(reader) !== 1) throw new Error('Invalid selc version');

		const mode = readUint16(reader) ? 'absolute' : 'relative';
		skipBytes(reader, 8);

		target.adjustment = {
			type: 'selective color',
			mode,
			reds: readSelectiveColors(reader),
			yellows: readSelectiveColors(reader),
			greens: readSelectiveColors(reader),
			cyans: readSelectiveColors(reader),
			blues: readSelectiveColors(reader),
			magentas: readSelectiveColors(reader),
			whites: readSelectiveColors(reader),
			neutrals: readSelectiveColors(reader),
			blacks: readSelectiveColors(reader),
		};
	},
	(writer, target) => {
		const info = target.adjustment as SelectiveColorAdjustment;

		writeUint16(writer, 1); // version
		writeUint16(writer, info.mode === 'absolute' ? 1 : 0);
		writeZeros(writer, 8);
		writeSelectiveColors(writer, info.reds);
		writeSelectiveColors(writer, info.yellows);
		writeSelectiveColors(writer, info.greens);
		writeSelectiveColors(writer, info.cyans);
		writeSelectiveColors(writer, info.blues);
		writeSelectiveColors(writer, info.magentas);
		writeSelectiveColors(writer, info.whites);
		writeSelectiveColors(writer, info.neutrals);
		writeSelectiveColors(writer, info.blacks);
	},
);

interface BrightnessContrastDescriptor {
	Vrsn: number;
	Brgh: number;
	Cntr: number;
	means: number;
	'Lab ': boolean;
	useLegacy: boolean;
	Auto: boolean;
}

interface PresetDescriptor {
	Vrsn: number;
	presetKind: number;
	presetFileName: string;
}

interface CurvesPresetDescriptor {
	Vrsn: number;
	curvesPresetKind: number;
	curvesPresetFileName: string;
}

interface MixerPresetDescriptor {
	Vrsn: number;
	mixerPresetKind: number;
	mixerPresetFileName: string;
}

addHandler(
	'CgEd',
	target => {
		const a = target.adjustment;

		if (!a) return false;

		return (a.type === 'brightness/contrast' && !a.useLegacy) ||
			((a.type === 'levels' || a.type === 'curves' || a.type === 'exposure' || a.type === 'channel mixer' ||
				a.type === 'hue/saturation') && a.presetFileName !== undefined);
	},
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as
			BrightnessContrastDescriptor | PresetDescriptor | CurvesPresetDescriptor | MixerPresetDescriptor;
		if (desc.Vrsn !== 1) throw new Error('Invalid CgEd version');

		// this section can specify preset file name for other adjustment types
		if ('presetFileName' in desc) {
			target.adjustment = {
				...target.adjustment as LevelsAdjustment | ExposureAdjustment | HueSaturationAdjustment,
				presetKind: desc.presetKind,
				presetFileName: desc.presetFileName,
			};
		} else if ('curvesPresetFileName' in desc) {
			target.adjustment = {
				...target.adjustment as CurvesAdjustment,
				presetKind: desc.curvesPresetKind,
				presetFileName: desc.curvesPresetFileName,
			};
		} else if ('mixerPresetFileName' in desc) {
			target.adjustment = {
				...target.adjustment as CurvesAdjustment,
				presetKind: desc.mixerPresetKind,
				presetFileName: desc.mixerPresetFileName,
			};
		} else {
			target.adjustment = {
				type: 'brightness/contrast',
				brightness: desc.Brgh,
				contrast: desc.Cntr,
				meanValue: desc.means,
				useLegacy: !!desc.useLegacy,
				labColorOnly: !!desc['Lab '],
				auto: !!desc.Auto,
			};
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		const info = target.adjustment!;

		if (info.type === 'levels' || info.type === 'exposure' || info.type === 'hue/saturation') {
			const desc: PresetDescriptor = {
				Vrsn: 1,
				presetKind: info.presetKind ?? 1,
				presetFileName: info.presetFileName || '',
			};
			writeVersionAndDescriptor(writer, '', 'null', desc);
		} else if (info.type === 'curves') {
			const desc: CurvesPresetDescriptor = {
				Vrsn: 1,
				curvesPresetKind: info.presetKind ?? 1,
				curvesPresetFileName: info.presetFileName || '',
			};
			writeVersionAndDescriptor(writer, '', 'null', desc);
		} else if (info.type === 'channel mixer') {
			const desc: MixerPresetDescriptor = {
				Vrsn: 1,
				mixerPresetKind: info.presetKind ?? 1,
				mixerPresetFileName: info.presetFileName || '',
			};
			writeVersionAndDescriptor(writer, '', 'null', desc);
		} else if (info.type === 'brightness/contrast') {
			const desc: BrightnessContrastDescriptor = {
				Vrsn: 1,
				Brgh: info.brightness || 0,
				Cntr: info.contrast || 0,
				means: info.meanValue ?? 127,
				'Lab ': !!info.labColorOnly,
				useLegacy: !!info.useLegacy,
				Auto: !!info.auto,
			};
			writeVersionAndDescriptor(writer, '', 'null', desc);
		} else {
			throw new Error('Unhandled CgEd case');
		}
	},
);

function getTextLayersSortedByIndex(psd: Psd) {
	const layers: (Layer | undefined)[] = [];

	function collect(layer: Layer | Psd) {
		if (layer.children) {
			for (const child of layer.children) {
				if (child.text?.index !== undefined) {
					layers[child.text.index] = child;
				}
				collect(child);
			}
		}
	}

	collect(psd);
	return layers;
}

addHandler(
	'Txt2',
	hasKey('engineData'),
	(reader, target, left, psd) => {
		const data = readBytes(reader, left());
		target.engineData = fromByteArray(data);

		const layersByIndex = getTextLayersSortedByIndex(psd);
		const engineData = parseEngineData(data);
		const engineData2 = decodeEngineData2(engineData);
		const TextFrameSet = engineData2.ResourceDict.TextFrameSet;

		if (TextFrameSet) {
			for (let i = 0; i < TextFrameSet.length; i++) {
				const layer = layersByIndex[i];
				if (TextFrameSet[i].path && layer?.text) {
					layer.text.textPath = TextFrameSet[i].path;
				}
			}
		}

		// console.log(require('util').inspect(engineData, false, 99, true));
		// require('fs').writeFileSync('test_data.bin', data);
		// require('fs').writeFileSync('test_data.txt', require('util').inspect(engineData, false, 99, false), 'utf8');
		// require('fs').writeFileSync('test_data.json', JSON.stringify(engineData2, null, 2), 'utf8');
	},
	(writer, target) => {
		const buffer = toByteArray(target.engineData!);
		writeBytes(writer, buffer);
	},
);

addHandler(
	'FEid',
	hasKey('filterEffectsMasks'),
	(reader, target, leftBytes) => {
		const version = readInt32(reader);
		if (version < 1 || version > 3) throw new Error(`Invalid filterEffects version ${version}`);

		target.filterEffectsMasks = [];

		while (leftBytes() > 8) {
			if (readUint32(reader)) throw new Error('filterEffects: 64 bit length is not supported');
			const length = readUint32(reader);
			const end = reader.offset + length;

			const id = readPascalString(reader, 1);

			const effectVersion = readInt32(reader);
			if (effectVersion !== 1) throw new Error(`Invalid filterEffect version ${effectVersion}`);

			if (readUint32(reader)) throw new Error('filterEffect: 64 bit length is not supported');
			/*const effectLength =*/ readUint32(reader);
			// const endOfEffect = reader.offset + effectLength;

			const top = readInt32(reader);
			const left = readInt32(reader);
			const bottom = readInt32(reader);
			const right = readInt32(reader);
			const depth = readInt32(reader);
			const maxChannels = readInt32(reader);
			const channels: ({ compressionMode: number; data: Uint8Array; } | undefined)[] = [];

			// 0 -> R, 1 -> G, 2 -> B, 25 -> A
			for (let i = 0; i < (maxChannels + 2); i++) { // channels + user mask + sheet mask
				const exists = readInt32(reader);
				if (exists) {
					if (readUint32(reader)) throw new Error('filterEffect: 64 bit length is not supported');
					const channelLength = readUint32(reader);
					if (!channelLength) throw new Error('filterEffect: Empty channel');
					const compressionMode = readUint16(reader);
					const data = readBytes(reader, channelLength - 2);
					channels.push({ compressionMode, data });
				} else {
					channels.push(undefined);
				}
			}

			target.filterEffectsMasks.push({ id, top, left, bottom, right, depth, channels });

			if (reader.offset < end && readUint8(reader)) {
				const top = readInt32(reader);
				const left = readInt32(reader);
				const bottom = readInt32(reader);
				const right = readInt32(reader);
				if (readUint32(reader)) throw new Error('filterEffect: 64 bit length is not supported');
				const extraLength = readUint32(reader);
				const compressionMode = readUint16(reader);
				const data = readBytes(reader, extraLength - 2);
				target.filterEffectsMasks[target.filterEffectsMasks.length - 1].extra = { top, left, bottom, right, compressionMode, data };
			}

			reader.offset = end;
			let len = length;
			while (len % 4) {
				reader.offset++;
				len++;
			}
		}
	},
	(writer, target) => {
		writeInt32(writer, 3); // version

		for (const mask of target.filterEffectsMasks!) {
			writeUint32(writer, 0);
			writeUint32(writer, 0);
			const lengthOffset = writer.offset;

			writePascalString(writer, mask.id, 1);
			writeInt32(writer, 1); // version

			writeUint32(writer, 0);
			writeUint32(writer, 0);
			const length2Offset = writer.offset;

			writeInt32(writer, mask.top);
			writeInt32(writer, mask.left);
			writeInt32(writer, mask.bottom);
			writeInt32(writer, mask.right);
			writeInt32(writer, mask.depth);
			const maxChannels = Math.max(0, mask.channels.length - 2);
			writeInt32(writer, maxChannels);

			for (let i = 0; i < (maxChannels + 2); i++) {
				const channel = mask.channels[i];
				writeInt32(writer, channel ? 1 : 0);
				if (channel) {
					writeUint32(writer, 0);
					writeUint32(writer, channel.data.length + 2);
					writeUint16(writer, channel.compressionMode);
					writeBytes(writer, channel.data);
				}
			}

			writer.view.setUint32(length2Offset - 4, writer.offset - length2Offset, false);

			const extra = target.filterEffectsMasks![target.filterEffectsMasks!.length - 1]?.extra;
			if (extra) {
				writeUint8(writer, 1);
				writeInt32(writer, extra.top);
				writeInt32(writer, extra.left);
				writeInt32(writer, extra.bottom);
				writeInt32(writer, extra.right);
				writeUint32(writer, 0);
				writeUint32(writer, extra.data.byteLength + 2);
				writeUint16(writer, extra.compressionMode);
				writeBytes(writer, extra.data);
			}

			let length = writer.offset - lengthOffset;
			writer.view.setUint32(lengthOffset - 4, length, false);

			while (length % 4) {
				writeZeros(writer, 1);
				length++;
			}
		}
	},
);

addHandlerAlias('FXid', 'FEid');

addHandler(
	'FMsk',
	hasKey('filterMask'),
	(reader, target) => {
		target.filterMask = {
			colorSpace: readColor(reader),
			opacity: readUint16(reader) / 0xff,
		};
	},
	(writer, target) => {
		writeColor(writer, target.filterMask!.colorSpace);
		writeUint16(writer, clamp(target.filterMask!.opacity ?? 1, 0, 1) * 0xff);
	},
);

interface ArtdDescriptor {
	'Cnt ': number;
	autoExpandOffset: { Hrzn: number; Vrtc: number; };
	origin: { Hrzn: number; Vrtc: number; };
	autoExpandEnabled: boolean;
	autoNestEnabled: boolean;
	autoPositionEnabled: boolean;
	shrinkwrapOnSaveEnabled?: boolean;
	docDefaultNewArtboardBackgroundColor: DescriptorColor;
	docDefaultNewArtboardBackgroundType: number;
}

addHandler(
	'artd', // document-wide artboard info
	target => (target as Psd).artboards !== undefined,
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as ArtdDescriptor;
		(target as Psd).artboards = {
			count: desc['Cnt '],
			autoExpandOffset: { horizontal: desc.autoExpandOffset.Hrzn, vertical: desc.autoExpandOffset.Vrtc },
			origin: { horizontal: desc.origin.Hrzn, vertical: desc.origin.Vrtc },
			autoExpandEnabled: desc.autoExpandEnabled,
			autoNestEnabled: desc.autoNestEnabled,
			autoPositionEnabled: desc.autoPositionEnabled,
			shrinkwrapOnSaveEnabled: !!desc.shrinkwrapOnSaveEnabled,
			docDefaultNewArtboardBackgroundColor: parseColor(desc.docDefaultNewArtboardBackgroundColor),
			docDefaultNewArtboardBackgroundType: desc.docDefaultNewArtboardBackgroundType,
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const artb = (target as Psd).artboards!;
		const desc: ArtdDescriptor = {
			'Cnt ': artb.count,
			autoExpandOffset: artb.autoExpandOffset ? { Hrzn: artb.autoExpandOffset.horizontal, Vrtc: artb.autoExpandOffset.vertical } : { Hrzn: 0, Vrtc: 0 },
			origin: artb.origin ? { Hrzn: artb.origin.horizontal, Vrtc: artb.origin.vertical } : { Hrzn: 0, Vrtc: 0 },
			autoExpandEnabled: artb.autoExpandEnabled ?? true,
			autoNestEnabled: artb.autoNestEnabled ?? true,
			autoPositionEnabled: artb.autoPositionEnabled ?? true,
			shrinkwrapOnSaveEnabled: artb.shrinkwrapOnSaveEnabled ?? true,
			docDefaultNewArtboardBackgroundColor: serializeColor(artb.docDefaultNewArtboardBackgroundColor),
			docDefaultNewArtboardBackgroundType: artb.docDefaultNewArtboardBackgroundType ?? 1,
		};
		writeVersionAndDescriptor(writer, '', 'null', desc, 'artd');
	},
);

export function hasMultiEffects(effects: LayerEffectsInfo) {
	return Object.keys(effects).map(key => (effects as any)[key]).some(v => Array.isArray(v) && v.length > 1);
}

addHandler(
	'lfx2',
	target => target.effects !== undefined && !hasMultiEffects(target.effects),
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error(`Invalid lfx2 version`);

		const desc: Lfx2Descriptor & LmfxDescriptor = readVersionAndDescriptor(reader);
		// console.log('READ', require('util').inspect(desc, false, 99, true));

		// TODO: don't discard if we got it from lmfx
		// discard if read in 'lrFX' section
		target.effects = parseEffects(desc, !!reader.logMissingFeatures);

		skipBytes(reader, left());
	},
	(writer, target, _, options) => {
		const desc = serializeEffects(target.effects!, !!options.logMissingFeatures, true);
		// console.log('WRITE', require('util').inspect(desc, false, 99, true));

		writeUint32(writer, 0); // version
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

interface CinfDescriptor {
	Vrsn: { major: number; minor: number; fix: number; };
	psVersion?: { major: number; minor: number; fix: number; };
	description: string;
	reason: string;
	Engn: string; // 'Engn.compCore';
	enableCompCore?: string; // 'enable.feature';
	enableCompCoreGPU?: string; // 'enable.feature';
	enableCompCoreThreads?: string; // 'enable.feature';
	compCoreSupport?: string; // 'reason.supported';
	compCoreGPUSupport?: string; // 'reason.featureDisabled';
}

addHandler(
	'cinf',
	hasKey('compositorUsed'),
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as CinfDescriptor;
		// console.log(require('util').inspect(desc, false, 99, true));

		function enumValue(desc: string): string {
			return desc.split('.')[1];
		}

		target.compositorUsed = {
			description: desc.description,
			reason: desc.reason,
			engine: enumValue(desc.Engn)!,
		};

		if (desc.Vrsn) target.compositorUsed.version = desc.Vrsn;
		if (desc.psVersion) target.compositorUsed.photoshopVersion = desc.psVersion;
		if (desc.enableCompCore) target.compositorUsed.enableCompCore = enumValue(desc.enableCompCore);
		if (desc.enableCompCoreGPU) target.compositorUsed.enableCompCoreGPU = enumValue(desc.enableCompCoreGPU);
		if (desc.enableCompCoreThreads) target.compositorUsed.enableCompCoreThreads = enumValue(desc.enableCompCoreThreads);
		if (desc.compCoreSupport) target.compositorUsed.compCoreSupport = enumValue(desc.compCoreSupport);
		if (desc.compCoreGPUSupport) target.compositorUsed.compCoreGPUSupport = enumValue(desc.compCoreGPUSupport);

		skipBytes(reader, left());
	},
	(writer, target) => {
		const cinf = target.compositorUsed!;
		const desc: CinfDescriptor = {
			Vrsn: cinf.version || { major: 1, minor: 0, fix: 0 },
		} as any;

		if (cinf.photoshopVersion) desc.psVersion = cinf.photoshopVersion;
		desc.description = cinf.description;
		desc.reason = cinf.reason;
		desc.Engn = `Engn.${cinf.engine}`;
		if (cinf.enableCompCore) desc.enableCompCore = `enable.${cinf.enableCompCore}`;
		if (cinf.enableCompCoreGPU) desc.enableCompCoreGPU = `enable.${cinf.enableCompCoreGPU}`;
		if (cinf.enableCompCoreThreads) desc.enableCompCoreThreads = `enable.${cinf.enableCompCoreThreads}`;
		if (cinf.compCoreSupport) desc.compCoreSupport = `reason.${cinf.compCoreSupport}`;
		if (cinf.compCoreGPUSupport) desc.compCoreGPUSupport = `reason.${cinf.compCoreGPUSupport}`;

		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

interface ExtensionDesc {
	generatorSettings: {
		generator_45_assets: { json: string; };
		layerTime: number;
	};
}

// extension settings ?, ignore it
addHandler(
	'extn',
	target => (target as any)._extn !== undefined,
	(reader, target) => {
		const desc: ExtensionDesc = readVersionAndDescriptor(reader);
		// console.log(require('util').inspect(desc, false, 99, true));

		if (MOCK_HANDLERS) (target as any)._extn = desc;
	},
	(writer, target) => {
		// TODO: need to add correct types for desc fields (resources/src.psd)
		if (MOCK_HANDLERS) writeVersionAndDescriptor(writer, '', 'null', (target as any)._extn);
	},
);

addHandler(
	'iOpa',
	hasKey('fillOpacity'),
	(reader, target) => {
		target.fillOpacity = readUint8(reader) / 0xff;
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.fillOpacity! * 0xff);
		writeZeros(writer, 3);
	},
);

addHandler(
	'brst',
	hasKey('channelBlendingRestrictions'),
	(reader, target, left) => {
		target.channelBlendingRestrictions = [];

		while (left() > 4) {
			target.channelBlendingRestrictions.push(readInt32(reader));
		}
	},
	(writer, target) => {
		for (const channel of target.channelBlendingRestrictions!) {
			writeInt32(writer, channel);
		}
	},
);

addHandler(
	'tsly',
	hasKey('transparencyShapesLayer'),
	(reader, target) => {
		target.transparencyShapesLayer = !!readUint8(reader);
		skipBytes(reader, 3);
	},
	(writer, target) => {
		writeUint8(writer, target.transparencyShapesLayer ? 1 : 0);
		writeZeros(writer, 3);
	},
);
