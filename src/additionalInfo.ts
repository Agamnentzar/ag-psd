import { fromByteArray, toByteArray } from 'base64-js';
import { readEffects, writeEffects } from './effectsHelpers';
import { clamp, createEnum, layerColors, MOCK_HANDLERS } from './helpers';
import {
	LayerAdditionalInfo, LayerEffectShadow, LayerEffectsOuterGlow, LayerEffectInnerGlow, LayerEffectBevel,
	LayerEffectSolidFill, LayerEffectPatternOverlay, LayerEffectGradientOverlay, LayerEffectSatin, EffectContour,
	EffectNoiseGradient, BezierPath, Psd, VectorContent, LayerEffectStroke, ExtraGradientInfo, EffectPattern,
	ExtraPatternInfo, ReadOptions, BrightnessAdjustment, ExposureAdjustment, VibranceAdjustment,
	ColorBalanceAdjustment, BlackAndWhiteAdjustment, PhotoFilterAdjustment, ChannelMixerChannel,
	ChannelMixerAdjustment, PosterizeAdjustment, ThresholdAdjustment, GradientMapAdjustment, CMYK,
	SelectiveColorAdjustment, ColorLookupAdjustment, LevelsAdjustmentChannel, LevelsAdjustment,
	CurvesAdjustment, CurvesAdjustmentChannel, HueSaturationAdjustment, HueSaturationAdjustmentChannel,
	PresetInfo, Color, ColorBalanceValues, WriteOptions, LinkedFile, PlacedLayerType, Warp, EffectSolidGradient,
	KeyDescriptorItem, BooleanOperation, LayerEffectsInfo, Annotation,
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readInt16, checkSignature, readFloat32, readFixedPointPath32, readSection, readColor, readInt32,
	readPascalString, readUnicodeStringWithLength, readAsciiString,
} from './psdReader';
import {
	PsdWriter, writeZeros, writeSignature, writeBytes, writeUint32, writeUint16, writeFloat64, writeUint8,
	writeInt16, writeFloat32, writeFixedPointPath32, writeUnicodeString, writeSection, writeUnicodeStringWithPadding,
	writeColor, writePascalString, writeInt32,
} from './psdWriter';
import {
	Annt, BESl, BESs, BETE, BlnM, bvlT, ClrS, DesciptorGradient, DescriptorColor, DescriptorGradientContent,
	DescriptorPatternContent, DescriptorUnitsValue, DescriptorVectorContent, FrFl, FStl, GrdT, IGSr, Ornt,
	parseAngle, parsePercent, parsePercentOrAngle, parseUnits, parseUnitsOrNumber, QuiltWarpDescriptor, readVersionAndDescriptor, StrokeDescriptor,
	strokeStyleLineAlignment, strokeStyleLineCapType, strokeStyleLineJoinType, TextDescriptor, textGridding,
	unitsAngle, unitsPercent, unitsValue, WarpDescriptor, warpStyle, writeVersionAndDescriptor
} from './descriptor';
import { serializeEngineData, parseEngineData } from './engineData';
import { encodeEngineData, decodeEngineData } from './text';

export interface ExtendedWriteOptions extends WriteOptions {
	layerIds: number[];
}

type HasMethod = (target: LayerAdditionalInfo) => boolean;
type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd, options: ReadOptions) => void;
type WriteMethod = (writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: ExtendedWriteOptions) => void;

export interface InfoHandler {
	key: string;
	has: HasMethod;
	read: ReadMethod;
	write: WriteMethod;
}

export const infoHandlers: InfoHandler[] = [];
export const infoHandlersMap: { [key: string]: InfoHandler } = {};

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

		if (readInt16(reader) !== 1) throw new Error(`Invalid TySh warp version`);
		const warp: WarpDescriptor = readVersionAndDescriptor(reader);

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

		if (text.EngineData) {
			const engineData = decodeEngineData(parseEngineData(text.EngineData));

			// const before = parseEngineData(text.EngineData);
			// const after = encodeEngineData(engineData);
			// require('fs').writeFileSync('before.txt', require('util').inspect(before, false, 99, false), 'utf8');
			// require('fs').writeFileSync('after.txt', require('util').inspect(after, false, 99, false), 'utf8');

			// console.log(require('util').inspect(parseEngineData(text.EngineData), false, 99, true));
			target.text = { ...target.text, ...engineData };
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
			TextIndex: text.index || 0,
			EngineData: serializeEngineData(encodeEngineData(text)),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i]);
		}

		writeInt16(writer, 50); // text version
		writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor);

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

function readBezierKnot(reader: PsdReader, width: number, height: number) {
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

const booleanOperations: BooleanOperation[] = ['exclude', 'combine', 'subtract', 'intersect'];

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

		const paths = vectorMask.paths;
		let path: BezierPath | undefined = undefined;

		while (left() >= 26) {
			const selector = readUint16(reader);

			switch (selector) {
				case 0: // Closed subpath length record
				case 3: { // Open subpath length record
					readUint16(reader); // count
					const boolOp = readUint16(reader);
					readUint16(reader); // always 1 ?
					skipBytes(reader, 18);
					path = { open: selector === 3, operation: booleanOperations[boolOp], knots: [] };
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
			writeUint16(writer, Math.abs(booleanOperations.indexOf(path.operation))); // default to 1 if not found
			writeUint16(writer, 1);
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
			'Top ': DescriptorUnitsValue;
			Left: DescriptorUnitsValue;
			Btom: DescriptorUnitsValue;
			Rght: DescriptorUnitsValue;
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
					top: parseUnits(i.keyOriginShapeBBox['Top ']),
					left: parseUnits(i.keyOriginShapeBBox.Left),
					bottom: parseUnits(i.keyOriginShapeBBox.Btom),
					right: parseUnits(i.keyOriginShapeBBox.Rght),
				};
			}
			if (i.keyOriginRRectRadii) {
				item.keyOriginRRectRadii = {
					topRight: parseUnits(i.keyOriginRRectRadii.topRight),
					topLeft: parseUnits(i.keyOriginRRectRadii.topLeft),
					bottomLeft: parseUnits(i.keyOriginRRectRadii.bottomLeft),
					bottomRight: parseUnits(i.keyOriginRRectRadii.bottomRight),
				};
			}
			if (i.keyOriginBoxCorners) {
				item.keyOriginBoxCorners = [
					{ x: i.keyOriginBoxCorners.rectangleCornerA.Hrzn, y: i.keyOriginBoxCorners.rectangleCornerA.Vrtc },
					{ x: i.keyOriginBoxCorners.rectangleCornerB.Hrzn, y: i.keyOriginBoxCorners.rectangleCornerB.Vrtc },
					{ x: i.keyOriginBoxCorners.rectangleCornerC.Hrzn, y: i.keyOriginBoxCorners.rectangleCornerC.Vrtc },
					{ x: i.keyOriginBoxCorners.rectangleCornerD.Hrzn, y: i.keyOriginBoxCorners.rectangleCornerD.Vrtc },
				];
			}
			if (i.Trnf) {
				item.transform = [i.Trnf.xx, i.Trnf.xy, i.Trnf.xy, i.Trnf.yy, i.Trnf.tx, i.Trnf.ty];
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

			if (item.keyShapeInvalidated) {
				desc.keyDescriptorList.push({ keyShapeInvalidated: true, keyOriginIndex: i });
			} else {
				desc.keyDescriptorList.push({
					keyOriginType: item.keyOriginType ?? 4,
					keyOriginResolution: item.keyOriginResolution ?? 72,
				} as any);

				const out = desc.keyDescriptorList[desc.keyDescriptorList.length - 1];

				if (item.keyOriginRRectRadii) {
					out.keyOriginRRectRadii = {
						unitValueQuadVersion: 1,
						topRight: unitsValue(item.keyOriginRRectRadii.topRight, 'topRight'),
						topLeft: unitsValue(item.keyOriginRRectRadii.topLeft, 'topLeft'),
						bottomLeft: unitsValue(item.keyOriginRRectRadii.bottomLeft, 'bottomLeft'),
						bottomRight: unitsValue(item.keyOriginRRectRadii.bottomRight, 'bottomRight'),
					};
				}

				if (item.keyOriginShapeBoundingBox) {
					out.keyOriginShapeBBox = {
						unitValueQuadVersion: 1,
						'Top ': unitsValue(item.keyOriginShapeBoundingBox.top, 'top'),
						Left: unitsValue(item.keyOriginShapeBoundingBox.left, 'left'),
						Btom: unitsValue(item.keyOriginShapeBoundingBox.bottom, 'bottom'),
						Rght: unitsValue(item.keyOriginShapeBoundingBox.right, 'right'),
					};
				}

				if (item.keyOriginBoxCorners && item.keyOriginBoxCorners.length === 4) {
					out.keyOriginBoxCorners = {
						rectangleCornerA: { Hrzn: item.keyOriginBoxCorners[0].x, Vrtc: item.keyOriginBoxCorners[0].y },
						rectangleCornerB: { Hrzn: item.keyOriginBoxCorners[1].x, Vrtc: item.keyOriginBoxCorners[1].y },
						rectangleCornerC: { Hrzn: item.keyOriginBoxCorners[2].x, Vrtc: item.keyOriginBoxCorners[2].y },
						rectangleCornerD: { Hrzn: item.keyOriginBoxCorners[3].x, Vrtc: item.keyOriginBoxCorners[3].y },
					};
				}

				if (item.transform && item.transform.length === 6) {
					out.Trnf = {
						xx: item.transform[0],
						xy: item.transform[1],
						yx: item.transform[2],
						yy: item.transform[3],
						tx: item.transform[4],
						ty: item.transform[5],
					};
				}

				out.keyOriginIndex = i;
			}
		}

		writeInt32(writer, 1); // version
		writeVersionAndDescriptor(writer, '', 'null', desc);
	}
);

addHandler(
	'lmfx',
	target => target.effects !== undefined && hasMultiEffects(target.effects),
	(reader, target, left, _, options) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error('Invalid lmfx version');

		const desc: LmfxDescriptor = readVersionAndDescriptor(reader);
		// console.log(require('util').inspect(info, false, 99, true));

		// discard if read in 'lrFX' or 'lfx2' section
		target.effects = parseEffects(desc, !!options.logMissingFeatures);

		skipBytes(reader, left());
	},
	(writer, target, _, options) => {
		const desc = serializeEffects(target.effects!, !!options.logMissingFeatures, true);

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
		target.name = readUnicodeString(reader);
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
	(reader, target) => target.id = readUint32(reader),
	(writer, target, _psd, options) => {
		let id = target.id!;
		while (options.layerIds.indexOf(id) !== -1) id += 100; // make sure we don't have duplicate layer ids
		writeUint32(writer, id);
		options.layerIds.push(id);
	},
);

// some kind of ID ? ignore
addHandler(
	'lsdk',
	target => (target as any)._lsdk !== undefined,
	(reader, target) => {
		const id = readInt32(reader);
		if (MOCK_HANDLERS) (target as any)._lsdk = id;
	},
	(writer, target) => {
		if (MOCK_HANDLERS) writeInt32(writer, (target as any)._lsdk);
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
			// 0 = normal
			// 1 = scene group, affects the animation timeline.
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

interface FrameListDescriptor {
	LaID: number;
	LaSt: {
		enab?: boolean;
		IMsk?: { Ofst: { Hrzn: number; Vrtc: number; } };
		VMsk?: { Ofst: { Hrzn: number; Vrtc: number; } };
		FXRf?: { Hrzn: number; Vrtc: number; };
		FrLs: number[];
	}[];
}

addHandler(
	'shmd',
	hasKey('timestamp'),
	(reader, target, left, _, options) => {
		const count = readUint32(reader);

		for (let i = 0; i < count; i++) {
			checkSignature(reader, '8BIM');
			const key = readSignature(reader);
			readUint8(reader); // copy
			skipBytes(reader, 3);

			readSection(reader, 1, left => {
				if (key === 'cust') {
					const desc = readVersionAndDescriptor(reader) as CustomDescriptor;
					if (desc.layerTime !== undefined) target.timestamp = desc.layerTime;
				} else if (key === 'mlst') {
					const desc = readVersionAndDescriptor(reader) as FrameListDescriptor;
					options.logDevFeatures && console.log('mlst', desc);
					// options.logDevFeatures && console.log('mlst', require('util').inspect(desc, false, 99, true));
				} else if (key === 'mdyn') {
					// frame flags
					const unknown = readUint16(reader);
					const propagate = readUint8(reader);
					const flags = readUint8(reader);
					const unifyLayerPosition = (flags & 1) !== 0;
					const unifyLayerStyle = (flags & 2) !== 0;
					const unifyLayerVisibility = (flags & 4) !== 0;
					options.logDevFeatures && console.log(
						'mdyn', 'unknown:', unknown, 'propagate:', propagate,
						'flags:', flags, { unifyLayerPosition, unifyLayerStyle, unifyLayerVisibility });

					// const desc = readVersionAndDescriptor(reader) as FrameListDescriptor;
					// console.log('mdyn', require('util').inspect(desc, false, 99, true));
				} else {
					options.logDevFeatures && console.log('Unhandled metadata', key);
				}

				skipBytes(reader, left());
			});
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		const desc: CustomDescriptor = {
			layerTime: target.timestamp!,
		};

		writeUint32(writer, 1); // count

		writeSignature(writer, '8BIM');
		writeSignature(writer, 'cust');
		writeUint8(writer, 0); // copy (always false)
		writeZeros(writer, 3);
		writeSection(writer, 2, () => writeVersionAndDescriptor(writer, '', 'metadata', desc), true);
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
		const descriptor: StrokeDescriptor = {
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

		writeVersionAndDescriptor(writer, '', 'strokeStyle', descriptor);
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
		target.artboard = {
			rect: { top: desc.artboardRect['Top '], left: desc.artboardRect.Left, bottom: desc.artboardRect.Btom, right: desc.artboardRect.Rght },
			guideIndices: desc.guideIndeces,
			presetName: desc.artboardPresetName,
			color: parseColor(desc['Clr ']),
			backgroundType: desc.artboardBackgroundType,
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const artb = target.artboard!;
		const desc: ArtbDescriptor = {
			artboardRect: { 'Top ': artb.rect.top, Left: artb.rect.left, Btom: artb.rect.bottom, Rght: artb.rect.right },
			guideIndeces: artb.guideIndices || [],
			artboardPresetName: artb.presetName || '',
			'Clr ': serializeColor(artb.color),
			artboardBackgroundType: artb.backgroundType ?? 1,
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
		value: warp.warpValue || 0,
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

	if (warp.customEnvelopeWarp) {
		result.customEnvelopeWarp = {
			meshPoints: [],
		};

		const xs = warp.customEnvelopeWarp!.meshPoints.find(i => i.type === 'Hrzn')?.values || [];
		const ys = warp.customEnvelopeWarp!.meshPoints.find(i => i.type === 'Vrtc')?.values || [];

		for (let i = 0; i < xs.length; i++) {
			result.customEnvelopeWarp!.meshPoints.push({ x: xs[i], y: ys[i] });
		}

		if (warp.customEnvelopeWarp.quiltSliceX || warp.customEnvelopeWarp.quiltSliceY) {
			result.customEnvelopeWarp.quiltSliceX = warp.customEnvelopeWarp.quiltSliceX?.[0]?.values || [];
			result.customEnvelopeWarp.quiltSliceY = warp.customEnvelopeWarp.quiltSliceY?.[0]?.values || [];
		}
	}

	return result;
}

function isQuiltWarp(warp: Warp) {
	return warp.deformNumCols != null || warp.deformNumRows != null ||
		warp.customEnvelopeWarp?.quiltSliceX || warp.customEnvelopeWarp?.quiltSliceY;
}

function encodeWarp(warp: Warp): WarpDescriptor {
	const desc: WarpDescriptor = {
		warpStyle: warpStyle.encode(warp.style),
		warpValue: warp.value || 0,
		warpPerspective: warp.perspective || 0,
		warpPerspectiveOther: warp.perspectiveOther || 0,
		warpRotate: Ornt.encode(warp.rotate),
		bounds: {
			'Top ': unitsValue(warp.bounds?.top || { units: 'Pixels', value: 0 }, 'bounds.top'),
			Left: unitsValue(warp.bounds?.left || { units: 'Pixels', value: 0 }, 'bounds.left'),
			Btom: unitsValue(warp.bounds?.bottom || { units: 'Pixels', value: 0 }, 'bounds.bottom'),
			Rght: unitsValue(warp.bounds?.right || { units: 'Pixels', value: 0 }, 'bounds.right'),
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

	if (warp.customEnvelopeWarp) {
		const meshPoints = warp.customEnvelopeWarp.meshPoints || [];

		if (isQuilt) {
			const desc2 = desc as QuiltWarpDescriptor;
			desc2.customEnvelopeWarp = {
				quiltSliceX: [{
					type: 'quiltSliceX',
					values: warp.customEnvelopeWarp.quiltSliceX || [],
				}],
				quiltSliceY: [{
					type: 'quiltSliceY',
					values: warp.customEnvelopeWarp.quiltSliceY || [],
				}],
				meshPoints: [
					{ type: 'Hrzn', values: meshPoints.map(p => p.x) },
					{ type: 'Vrtc', values: meshPoints.map(p => p.y) },
				],
			};
		} else {
			desc.customEnvelopeWarp = {
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
		readInt32(reader); // pageNumber
		readInt32(reader); // totalPages, TODO: check how this works ?
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
			// pageNumber,
			// totalPages,
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
		writePascalString(writer, placed.id, 1);
		writeInt32(writer, 1); // pageNumber
		writeInt32(writer, 1); // totalPages
		writeInt32(writer, 16); // anitAliasPolicy
		if (placedLayerTypes.indexOf(placed.type) === -1) throw new Error('Invalid placedLayer type');
		writeInt32(writer, placedLayerTypes.indexOf(placed.type));
		for (let i = 0; i < 8; i++) writeFloat64(writer, placed.transform[i]);
		writeInt32(writer, 0); // warp version
		const isQuilt = placed.warp && isQuiltWarp(placed.warp);
		const type = isQuilt ? 'quiltWarp' : 'warp';
		writeVersionAndDescriptor(writer, '', type, encodeWarp(placed.warp || {}), type);
	},
);

interface SoLdDescriptor {
	Idnt: string;
	placed: string;
	PgNm: number;
	totalPages: number;
	Crop?: number;
	frameStep: { numerator: number; denominator: number; };
	duration: { numerator: number; denominator: number; };
	frameCount: number;
	Annt: number;
	Type: number;
	Trnf: number[];
	nonAffineTransform: number[];
	quiltWarp?: QuiltWarpDescriptor;
	warp: WarpDescriptor;
	'Sz  ': { Wdth: number; Hght: number; };
	Rslt: DescriptorUnitsValue;
	comp?: number;
	compInfo?: { compID: number; originalCompID: number; };
}

addHandler(
	'SoLd',
	hasKey('placedLayer'),
	(reader, target, left) => {
		if (readSignature(reader) !== 'soLD') throw new Error(`Invalid SoLd type`);
		if (readInt32(reader) !== 4) throw new Error(`Invalid SoLd version`);
		const desc: SoLdDescriptor = readVersionAndDescriptor(reader);
		// console.log('SoLd', require('util').inspect(desc, false, 99, true));
		// console.log('SoLd.warp', require('util').inspect(desc.warp, false, 99, true));
		// console.log('SoLd.quiltWarp', require('util').inspect(desc.quiltWarp, false, 99, true));

		target.placedLayer = {
			id: desc.Idnt,
			placed: desc.placed,
			type: placedLayerTypes[desc.Type],
			// pageNumber: info.PgNm,
			// totalPages: info.totalPages,
			// frameStep: info.frameStep,
			// duration: info.duration,
			// frameCount: info.frameCount,
			transform: desc.Trnf,
			width: desc['Sz  '].Wdth,
			height: desc['Sz  '].Hght,
			resolution: parseUnits(desc.Rslt),
			warp: parseWarp((desc.quiltWarp || desc.warp) as any),
		};

		if (desc.Crop) target.placedLayer.crop = desc.Crop;
		if (desc.comp) target.placedLayer.comp = desc.comp;
		if (desc.compInfo) target.placedLayer.compInfo = desc.compInfo;

		skipBytes(reader, left()); // HACK
	},
	(writer, target) => {
		writeSignature(writer, 'soLD');
		writeInt32(writer, 4); // version

		const placed = target.placedLayer!;
		const desc: SoLdDescriptor = {
			Idnt: placed.id,
			placed: placed.placed ?? placed.id, // ???
			PgNm: 1,
			totalPages: 1,
			...(placed.crop ? { Crop: placed.crop } : {}),
			frameStep: {
				numerator: 0,
				denominator: 600
			},
			duration: {
				numerator: 0,
				denominator: 600
			},
			frameCount: 1,
			Annt: 16,
			Type: placedLayerTypes.indexOf(placed.type),
			Trnf: placed.transform,
			nonAffineTransform: placed.transform,
			quiltWarp: {} as any,
			warp: encodeWarp(placed.warp || {}),
			'Sz  ': {
				Wdth: placed.width || 0, // TODO: find size ?
				Hght: placed.height || 0, // TODO: find size ?
			},
			Rslt: placed.resolution ? unitsValue(placed.resolution, 'resolution') : { units: 'Density', value: 72 },
		};

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
			target;

			// if (!target.patterns) target.patterns = [];
			// target.patterns.push(readPattern(reader));
			// skipBytes(reader, left());
		},
		(_writer, _target) => {
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

addHandler(
	'lnk2',
	(target: any) => !!(target as Psd).linkedFiles && (target as Psd).linkedFiles!.length > 0,
	(reader, target, left, _, options) => {
		const psd = target as Psd;
		psd.linkedFiles = [];

		while (left() > 8) {
			let size = readLength64(reader); // size
			const startOffset = reader.offset;
			const type = readSignature(reader) as 'liFD' | 'liFE' | 'liFA';
			const version = readInt32(reader);
			const id = readPascalString(reader, 1);
			const name = readUnicodeString(reader);
			const fileType = readSignature(reader).trim(); // '    ' if empty
			const fileCreator = readSignature(reader).trim(); // '    ' or '\0\0\0\0' if empty
			const dataSize = readLength64(reader);
			const hasFileOpenDescriptor = readUint8(reader);
			const fileOpenDescriptor = hasFileOpenDescriptor ? readVersionAndDescriptor(reader) as FileOpenDescriptor : undefined;
			const linkedFileDescriptor = type === 'liFE' ? readVersionAndDescriptor(reader) : undefined;
			const file: LinkedFile = { id, name, data: undefined };

			if (fileType) file.type = fileType;
			if (fileCreator) file.creator = fileCreator;
			if (fileOpenDescriptor) file.descriptor = fileOpenDescriptor;

			if (type === 'liFE' && version > 3) {
				const year = readInt32(reader);
				const month = readUint8(reader);
				const day = readUint8(reader);
				const hour = readUint8(reader);
				const minute = readUint8(reader);
				const seconds = readFloat64(reader);
				const wholeSeconds = Math.floor(seconds);
				const ms = (seconds - wholeSeconds) * 1000;
				file.time = new Date(year, month, day, hour, minute, wholeSeconds, ms);
			}

			const fileSize = type === 'liFE' ? readLength64(reader) : 0;
			if (type === 'liFA') skipBytes(reader, 8);
			if (type === 'liFD') file.data = readBytes(reader, dataSize);
			if (version >= 5) file.childDocumentID = readUnicodeString(reader);
			if (version >= 6) file.assetModTime = readFloat64(reader);
			if (version >= 7) file.assetLockedState = readUint8(reader);
			if (type === 'liFE') file.data = readBytes(reader, fileSize);

			if (options.skipLinkedFilesData) file.data = undefined;

			psd.linkedFiles.push(file);
			linkedFileDescriptor;

			while (size % 4) size++;
			reader.offset = startOffset + size;
		}

		skipBytes(reader, left()); // ?
	},
	(writer, target) => {
		const psd = target as Psd;

		for (const file of psd.linkedFiles!) {
			let version = 2;

			if (file.assetLockedState != null) version = 7;
			else if (file.assetModTime != null) version = 6;
			else if (file.childDocumentID != null) version = 5;
			// TODO: else if (file.time != null) version = 3; (only for liFE)

			writeUint32(writer, 0);
			writeUint32(writer, 0); // size
			const sizeOffset = writer.offset;
			writeSignature(writer, file.data ? 'liFD' : 'liFA');
			writeInt32(writer, version);
			writePascalString(writer, file.id || '', 1);
			writeUnicodeStringWithPadding(writer, file.name || '');
			writeSignature(writer, file.type ? `${file.type}    `.substr(0, 4) : '    ');
			writeSignature(writer, file.creator ? `${file.creator}    `.substr(0, 4) : '\0\0\0\0');
			writeLength64(writer, file.data ? file.data.byteLength : 0);

			if (file.descriptor && file.descriptor.compInfo) {
				const desc: FileOpenDescriptor = {
					compInfo: file.descriptor.compInfo,
				};

				writeUint8(writer, 1);
				writeVersionAndDescriptor(writer, '', 'null', desc);
			} else {
				writeUint8(writer, 0);
			}

			if (file.data) writeBytes(writer, file.data);
			else writeLength64(writer, 0);
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
addHandlerAlias('lnkD', 'lnk2');
addHandlerAlias('lnk3', 'lnk2');

// this seems to just be zero size block, ignore it
addHandler(
	'lnkE',
	target => (target as any)._lnkE !== undefined,
	(reader, target, left, _psds, options) => {
		if (options.logMissingFeatures && left()) {
			console.log(`Non-empty lnkE layer info (${left()} bytes)`);
		}

		if (MOCK_HANDLERS) {
			(target as any)._lnkE = readBytes(reader, left());
		}
	},
	(writer, target) => MOCK_HANDLERS && writeBytes(writer, (target as any)._lnkE),
);

interface ExtensionDesc {
	generatorSettings: {
		generator_45_assets: { json: string; };
		layerTime: number;
	};
}

addHandler(
	'pths',
	hasKey('pathList'),
	(reader, target) => {
		const descriptor = readVersionAndDescriptor(reader);

		target.pathList = []; // TODO: read paths (find example with non-empty list)

		descriptor;
		// console.log('pths', descriptor); // TODO: remove this
	},
	(writer, _target) => {
		const descriptor = {
			pathList: [], // TODO: write paths
		};

		writeVersionAndDescriptor(writer, '', 'pathsDataClass', descriptor);
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

addHandler(
	'Txt2',
	hasKey('engineData'),
	(reader, target, left) => {
		const data = readBytes(reader, left());
		target.engineData = fromByteArray(data);
		// const engineData = parseEngineData(data);
		// console.log(require('util').inspect(engineData, false, 99, true));
		// require('fs').writeFileSync('resources/engineData2Simple.txt', require('util').inspect(engineData, false, 99, false), 'utf8');
		// require('fs').writeFileSync('test_data.json', JSON.stringify(ed, null, 2), 'utf8');
	},
	(writer, target) => {
		const buffer = toByteArray(target.engineData!);
		writeBytes(writer, buffer);
	},
);

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
	shrinkwrapOnSaveEnabled: boolean;
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
			shrinkwrapOnSaveEnabled: desc.shrinkwrapOnSaveEnabled,
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

interface EffectDescriptor extends Partial<DescriptorGradientContent>, Partial<DescriptorPatternContent> {
	enab?: boolean;
	Styl: string;
	PntT?: string;
	'Md  '?: string;
	Opct?: DescriptorUnitsValue;
	'Sz  '?: DescriptorUnitsValue;
	'Clr '?: DescriptorColor;
	present?: boolean;
	showInDialog?: boolean;
	overprint?: boolean;
}

interface Lfx2Descriptor {
	'Scl '?: DescriptorUnitsValue;
	masterFXSwitch?: boolean;
	DrSh?: EffectDescriptor;
	IrSh?: EffectDescriptor;
	OrGl?: EffectDescriptor;
	IrGl?: EffectDescriptor;
	ebbl?: EffectDescriptor;
	SoFi?: EffectDescriptor;
	patternFill?: EffectDescriptor;
	GrFl?: EffectDescriptor;
	ChFX?: EffectDescriptor;
	FrFX?: EffectDescriptor;
}

interface LmfxDescriptor {
	'Scl '?: DescriptorUnitsValue;
	masterFXSwitch?: boolean;
	numModifyingFX?: number;
	OrGl?: EffectDescriptor;
	IrGl?: EffectDescriptor;
	ebbl?: EffectDescriptor;
	ChFX?: EffectDescriptor;
	dropShadowMulti?: EffectDescriptor[];
	innerShadowMulti?: EffectDescriptor[];
	solidFillMulti?: EffectDescriptor[];
	gradientFillMulti?: EffectDescriptor[];
	frameFXMulti?: EffectDescriptor[];
	patternFill?: EffectDescriptor; // ???
}

function parseFxObject(fx: EffectDescriptor) {
	const stroke: LayerEffectStroke = {
		enabled: !!fx.enab,
		position: FStl.decode(fx.Styl),
		fillType: FrFl.decode(fx.PntT!),
		blendMode: BlnM.decode(fx['Md  ']!),
		opacity: parsePercent(fx.Opct),
		size: parseUnits(fx['Sz  ']!),
	};

	if (fx.present !== undefined) stroke.present = fx.present;
	if (fx.showInDialog !== undefined) stroke.showInDialog = fx.showInDialog;
	if (fx.overprint !== undefined) stroke.overprint = fx.overprint;
	if (fx['Clr ']) stroke.color = parseColor(fx['Clr ']);
	if (fx.Grad) stroke.gradient = parseGradientContent(fx as any);
	if (fx.Ptrn) stroke.pattern = parsePatternContent(fx as any);

	return stroke;
}

function serializeFxObject(stroke: LayerEffectStroke) {
	let FrFX: EffectDescriptor = {} as any;
	FrFX.enab = !!stroke.enabled;
	if (stroke.present !== undefined) FrFX.present = !!stroke.present;
	if (stroke.showInDialog !== undefined) FrFX.showInDialog = !!stroke.showInDialog;
	FrFX.Styl = FStl.encode(stroke.position);
	FrFX.PntT = FrFl.encode(stroke.fillType);
	FrFX['Md  '] = BlnM.encode(stroke.blendMode);
	FrFX.Opct = unitsPercent(stroke.opacity);
	FrFX['Sz  '] = unitsValue(stroke.size, 'size');
	if (stroke.color) FrFX['Clr '] = serializeColor(stroke.color);
	if (stroke.gradient) FrFX = { ...FrFX, ...serializeGradientContent(stroke.gradient) };
	if (stroke.pattern) FrFX = { ...FrFX, ...serializePatternContent(stroke.pattern) };
	if (stroke.overprint !== undefined) FrFX.overprint = !!stroke.overprint;
	return FrFX;
}

function parseEffects(info: Lfx2Descriptor & LmfxDescriptor, log: boolean) {
	const effects: LayerEffectsInfo = {};
	if (!info.masterFXSwitch) effects.disabled = true;
	if (info['Scl ']) effects.scale = parsePercent(info['Scl ']);
	if (info.DrSh) effects.dropShadow = [parseEffectObject(info.DrSh, log)];
	if (info.dropShadowMulti) effects.dropShadow = info.dropShadowMulti.map(i => parseEffectObject(i, log));
	if (info.IrSh) effects.innerShadow = [parseEffectObject(info.IrSh, log)];
	if (info.innerShadowMulti) effects.innerShadow = info.innerShadowMulti.map(i => parseEffectObject(i, log));
	if (info.OrGl) effects.outerGlow = parseEffectObject(info.OrGl, log);
	if (info.IrGl) effects.innerGlow = parseEffectObject(info.IrGl, log);
	if (info.ebbl) effects.bevel = parseEffectObject(info.ebbl, log);
	if (info.SoFi) effects.solidFill = [parseEffectObject(info.SoFi, log)];
	if (info.solidFillMulti) effects.solidFill = info.solidFillMulti.map(i => parseEffectObject(i, log));
	if (info.patternFill) effects.patternOverlay = parseEffectObject(info.patternFill, log);
	if (info.GrFl) effects.gradientOverlay = [parseEffectObject(info.GrFl, log)];
	if (info.gradientFillMulti) effects.gradientOverlay = info.gradientFillMulti.map(i => parseEffectObject(i, log));
	if (info.ChFX) effects.satin = parseEffectObject(info.ChFX, log);
	if (info.FrFX) effects.stroke = [parseFxObject(info.FrFX)];
	if (info.frameFXMulti) effects.stroke = info.frameFXMulti.map(i => parseFxObject(i));
	return effects;
}

function serializeEffects(e: LayerEffectsInfo, log: boolean, multi: boolean) {
	const info: Lfx2Descriptor & LmfxDescriptor = multi ? {
		'Scl ': unitsPercent(e.scale ?? 1),
		masterFXSwitch: !e.disabled,
	} : {
		masterFXSwitch: !e.disabled,
		'Scl ': unitsPercent(e.scale ?? 1),
	};

	const arrayKeys: (keyof LayerEffectsInfo)[] = ['dropShadow', 'innerShadow', 'solidFill', 'gradientOverlay', 'stroke'];
	for (const key of arrayKeys) {
		if (e[key] && !Array.isArray(e[key])) throw new Error(`${key} should be an array`);
	}

	if (e.dropShadow?.[0] && !multi) info.DrSh = serializeEffectObject(e.dropShadow[0], 'dropShadow', log);
	if (e.dropShadow?.[0] && multi) info.dropShadowMulti = e.dropShadow.map(i => serializeEffectObject(i, 'dropShadow', log));
	if (e.innerShadow?.[0] && !multi) info.IrSh = serializeEffectObject(e.innerShadow[0], 'innerShadow', log);
	if (e.innerShadow?.[0] && multi) info.innerShadowMulti = e.innerShadow.map(i => serializeEffectObject(i, 'innerShadow', log));
	if (e.outerGlow) info.OrGl = serializeEffectObject(e.outerGlow, 'outerGlow', log);
	if (e.solidFill?.[0] && multi) info.solidFillMulti = e.solidFill.map(i => serializeEffectObject(i, 'solidFill', log));
	if (e.gradientOverlay?.[0] && multi) info.gradientFillMulti = e.gradientOverlay.map(i => serializeEffectObject(i, 'gradientOverlay', log));
	if (e.stroke?.[0] && multi) info.frameFXMulti = e.stroke.map(i => serializeFxObject(i));
	if (e.innerGlow) info.IrGl = serializeEffectObject(e.innerGlow, 'innerGlow', log);
	if (e.bevel) info.ebbl = serializeEffectObject(e.bevel, 'bevel', log);
	if (e.solidFill?.[0] && !multi) info.SoFi = serializeEffectObject(e.solidFill[0], 'solidFill', log);
	if (e.patternOverlay) info.patternFill = serializeEffectObject(e.patternOverlay, 'patternOverlay', log);
	if (e.gradientOverlay?.[0] && !multi) info.GrFl = serializeEffectObject(e.gradientOverlay[0], 'gradientOverlay', log);
	if (e.satin) info.ChFX = serializeEffectObject(e.satin, 'satin', log);
	if (e.stroke?.[0] && !multi) info.FrFX = serializeFxObject(e.stroke?.[0]);

	if (multi) {
		info.numModifyingFX = 0;

		for (const key of Object.keys(e)) {
			const value = (e as any)[key];
			if (Array.isArray(value)) {
				for (const effect of value) {
					if (effect.enabled) info.numModifyingFX++;
				}
			}
		}
	}

	return info;
}

export function hasMultiEffects(effects: LayerEffectsInfo) {
	return Object.keys(effects).map(key => (effects as any)[key]).some(v => Array.isArray(v) && v.length > 1);
}

addHandler(
	'lfx2',
	target => target.effects !== undefined && !hasMultiEffects(target.effects),
	(reader, target, left, _, options) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error(`Invalid lfx2 version`);

		const desc: Lfx2Descriptor = readVersionAndDescriptor(reader);
		// console.log(require('util').inspect(desc, false, 99, true));

		// TODO: don't discard if we got it from lmfx
		// discard if read in 'lrFX' section
		target.effects = parseEffects(desc, !!options.logMissingFeatures);

		skipBytes(reader, left());
	},
	(writer, target, _, options) => {
		const desc = serializeEffects(target.effects!, !!options.logMissingFeatures, false);
		// console.log(require('util').inspect(desc, false, 99, true));

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
	enableCompCore: string; // 'enable.feature';
	enableCompCoreGPU: string; // 'enable.feature';
	enableCompCoreThreads?: string; // 'enable.feature';
	compCoreSupport: string; // 'reason.supported';
	compCoreGPUSupport: string; // 'reason.featureDisabled';
}

addHandler(
	'cinf',
	hasKey('compositorUsed'),
	(reader, target, left) => {
		const desc = readVersionAndDescriptor(reader) as CinfDescriptor;
		// console.log(require('util').inspect(desc, false, 99, true));

		target.compositorUsed = {
			description: desc.description,
			reason: desc.reason,
			engine: desc.Engn.split('.')[1],
			enableCompCore: desc.enableCompCore.split('.')[1],
			enableCompCoreGPU: desc.enableCompCoreGPU.split('.')[1],
			compCoreSupport: desc.compCoreSupport.split('.')[1],
			compCoreGPUSupport: desc.compCoreGPUSupport.split('.')[1],
		};

		skipBytes(reader, left());
	},
	(writer, target) => {
		const cinf = target.compositorUsed!;
		const desc: CinfDescriptor = {
			Vrsn: { major: 1, minor: 0, fix: 0 }, // TEMP
			// psVersion: { major: 22, minor: 3, fix: 1 }, // TESTING
			description: cinf.description,
			reason: cinf.reason,
			Engn: `Engn.${cinf.engine}`,
			enableCompCore: `enable.${cinf.enableCompCore}`,
			enableCompCoreGPU: `enable.${cinf.enableCompCoreGPU}`,
			// enableCompCoreThreads: `enable.feature`, // TESTING
			compCoreSupport: `reason.${cinf.compCoreSupport}`,
			compCoreGPUSupport: `reason.${cinf.compCoreGPUSupport}`,
		};
		writeVersionAndDescriptor(writer, '', 'null', desc);
	},
);

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

// descriptor helpers

function parseGradient(grad: DesciptorGradient): EffectSolidGradient | EffectNoiseGradient {
	if (grad.GrdF === 'GrdF.CstS') {
		const samples: number = grad.Intr || 4096;

		return {
			type: 'solid',
			name: grad['Nm  '],
			smoothness: grad.Intr / 4096,
			colorStops: grad.Clrs.map(s => ({
				color: parseColor(s['Clr ']),
				location: s.Lctn / samples,
				midpoint: s.Mdpn / 100,
			})),
			opacityStops: grad.Trns.map(s => ({
				opacity: parsePercent(s.Opct),
				location: s.Lctn / samples,
				midpoint: s.Mdpn / 100,
			})),
		};
	} else {
		return {
			type: 'noise',
			name: grad['Nm  '],
			roughness: grad.Smth / 4096,
			colorModel: ClrS.decode(grad.ClrS),
			randomSeed: grad.RndS,
			restrictColors: !!grad.VctC,
			addTransparency: !!grad.ShTr,
			min: grad['Mnm '].map(x => x / 100),
			max: grad['Mxm '].map(x => x / 100),
		};
	}
}

function serializeGradient(grad: EffectSolidGradient | EffectNoiseGradient): DesciptorGradient {
	if (grad.type === 'solid') {
		const samples = Math.round((grad.smoothness ?? 1) * 4096);
		return {
			'Nm  ': grad.name || '',
			GrdF: 'GrdF.CstS',
			Intr: samples,
			Clrs: grad.colorStops.map(s => ({
				'Clr ': serializeColor(s.color),
				Type: 'Clry.UsrS',
				Lctn: Math.round(s.location * samples),
				Mdpn: Math.round((s.midpoint ?? 0.5) * 100),
			})),
			Trns: grad.opacityStops.map(s => ({
				Opct: unitsPercent(s.opacity),
				Lctn: Math.round(s.location * samples),
				Mdpn: Math.round((s.midpoint ?? 0.5) * 100),
			})),
		};
	} else {
		return {
			GrdF: 'GrdF.ClNs',
			'Nm  ': grad.name || '',
			ShTr: !!grad.addTransparency,
			VctC: !!grad.restrictColors,
			ClrS: ClrS.encode(grad.colorModel),
			RndS: grad.randomSeed || 0,
			Smth: Math.round((grad.roughness ?? 1) * 4096),
			'Mnm ': (grad.min || [0, 0, 0, 0]).map(x => x * 100),
			'Mxm ': (grad.max || [1, 1, 1, 1]).map(x => x * 100),
		};
	}
}

function parseGradientContent(descriptor: DescriptorGradientContent) {
	const result = parseGradient(descriptor.Grad) as (EffectSolidGradient | EffectNoiseGradient) & ExtraGradientInfo;
	result.style = GrdT.decode(descriptor.Type);
	if (descriptor.Dthr !== undefined) result.dither = descriptor.Dthr;
	if (descriptor.Rvrs !== undefined) result.reverse = descriptor.Rvrs;
	if (descriptor.Angl !== undefined) result.angle = parseAngle(descriptor.Angl);
	if (descriptor['Scl '] !== undefined) result.scale = parsePercent(descriptor['Scl ']);
	if (descriptor.Algn !== undefined) result.align = descriptor.Algn;
	if (descriptor.Ofst !== undefined) {
		result.offset = {
			x: parsePercent(descriptor.Ofst.Hrzn),
			y: parsePercent(descriptor.Ofst.Vrtc)
		};
	}
	return result;
}

function parsePatternContent(descriptor: DescriptorPatternContent) {
	const result: EffectPattern & ExtraPatternInfo = {
		name: descriptor.Ptrn['Nm  '],
		id: descriptor.Ptrn.Idnt,
	};
	if (descriptor.Lnkd !== undefined) result.linked = descriptor.Lnkd;
	if (descriptor.phase !== undefined) result.phase = { x: descriptor.phase.Hrzn, y: descriptor.phase.Vrtc };
	return result;
}

function parseVectorContent(descriptor: DescriptorVectorContent): VectorContent {
	if ('Grad' in descriptor) {
		return parseGradientContent(descriptor);
	} else if ('Ptrn' in descriptor) {
		return { type: 'pattern', ...parsePatternContent(descriptor) };
	} else if ('Clr ' in descriptor) {
		return { type: 'color', color: parseColor(descriptor['Clr ']) };
	} else {
		throw new Error('Invalid vector content');
	}
}

function serializeGradientContent(content: (EffectSolidGradient | EffectNoiseGradient) & ExtraGradientInfo) {
	const result: DescriptorGradientContent = {} as any;
	if (content.dither !== undefined) result.Dthr = content.dither;
	if (content.reverse !== undefined) result.Rvrs = content.reverse;
	if (content.angle !== undefined) result.Angl = unitsAngle(content.angle);
	result.Type = GrdT.encode(content.style);
	if (content.align !== undefined) result.Algn = content.align;
	if (content.scale !== undefined) result['Scl '] = unitsPercent(content.scale);
	if (content.offset) {
		result.Ofst = {
			Hrzn: unitsPercent(content.offset.x),
			Vrtc: unitsPercent(content.offset.y),
		};
	}
	result.Grad = serializeGradient(content);
	return result;
}

function serializePatternContent(content: EffectPattern & ExtraPatternInfo) {
	const result: DescriptorPatternContent = {
		Ptrn: {
			'Nm  ': content.name || '',
			Idnt: content.id || '',
		}
	};
	if (content.linked !== undefined) result.Lnkd = !!content.linked;
	if (content.phase !== undefined) result.phase = { Hrzn: content.phase.x, Vrtc: content.phase.y };
	return result;
}

function serializeVectorContent(content: VectorContent): { descriptor: DescriptorVectorContent; key: string; } {
	if (content.type === 'color') {
		return { key: 'SoCo', descriptor: { 'Clr ': serializeColor(content.color) } };
	} else if (content.type === 'pattern') {
		return { key: 'PtFl', descriptor: serializePatternContent(content) };
	} else {
		return { key: 'GdFl', descriptor: serializeGradientContent(content) };
	}
}

function parseColor(color: DescriptorColor): Color {
	if ('H   ' in color) {
		return { h: parsePercentOrAngle(color['H   ']), s: color.Strt, b: color.Brgh };
	} else if ('Rd  ' in color) {
		return { r: color['Rd  '], g: color['Grn '], b: color['Bl  '] };
	} else if ('Cyn ' in color) {
		return { c: color['Cyn '], m: color.Mgnt, y: color['Ylw '], k: color.Blck };
	} else if ('Gry ' in color) {
		return { k: color['Gry '] };
	} else if ('Lmnc' in color) {
		return { l: color.Lmnc, a: color['A   '], b: color['B   '] };
	} else {
		throw new Error('Unsupported color descriptor');
	}
}

function serializeColor(color: Color | undefined): DescriptorColor {
	if (!color) {
		return { 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
	} else if ('r' in color) {
		return { 'Rd  ': color.r || 0, 'Grn ': color.g || 0, 'Bl  ': color.b || 0 };
	} else if ('h' in color) {
		return { 'H   ': unitsAngle(color.h * 360), Strt: color.s || 0, Brgh: color.b || 0 };
	} else if ('c' in color) {
		return { 'Cyn ': color.c || 0, Mgnt: color.m || 0, 'Ylw ': color.y || 0, Blck: color.k || 0 };
	} else if ('l' in color) {
		return { Lmnc: color.l || 0, 'A   ': color.a || 0, 'B   ': color.b || 0 };
	} else if ('k' in color) {
		return { 'Gry ': color.k };
	} else {
		throw new Error('Invalid color value');
	}
}

type AllEffects = LayerEffectShadow & LayerEffectsOuterGlow & LayerEffectStroke &
	LayerEffectInnerGlow & LayerEffectBevel & LayerEffectSolidFill &
	LayerEffectPatternOverlay & LayerEffectSatin & LayerEffectGradientOverlay;

function parseEffectObject(obj: any, reportErrors: boolean) {
	const result: AllEffects = {} as any;

	for (const key of Object.keys(obj)) {
		const val = obj[key];

		switch (key) {
			case 'enab': result.enabled = !!val; break;
			case 'uglg': result.useGlobalLight = !!val; break;
			case 'AntA': result.antialiased = !!val; break;
			case 'Algn': result.align = !!val; break;
			case 'Dthr': result.dither = !!val; break;
			case 'Invr': result.invert = !!val; break;
			case 'Rvrs': result.reverse = !!val; break;
			case 'Clr ': result.color = parseColor(val); break;
			case 'hglC': result.highlightColor = parseColor(val); break;
			case 'sdwC': result.shadowColor = parseColor(val); break;
			case 'Styl': result.position = FStl.decode(val); break;
			case 'Md  ': result.blendMode = BlnM.decode(val); break;
			case 'hglM': result.highlightBlendMode = BlnM.decode(val); break;
			case 'sdwM': result.shadowBlendMode = BlnM.decode(val); break;
			case 'bvlS': result.style = BESl.decode(val); break;
			case 'bvlD': result.direction = BESs.decode(val); break;
			case 'bvlT': result.technique = bvlT.decode(val) as any; break;
			case 'GlwT': result.technique = BETE.decode(val) as any; break;
			case 'glwS': result.source = IGSr.decode(val); break;
			case 'Type': result.type = GrdT.decode(val); break;
			case 'Opct': result.opacity = parsePercent(val); break;
			case 'hglO': result.highlightOpacity = parsePercent(val); break;
			case 'sdwO': result.shadowOpacity = parsePercent(val); break;
			case 'lagl': result.angle = parseAngle(val); break;
			case 'Angl': result.angle = parseAngle(val); break;
			case 'Lald': result.altitude = parseAngle(val); break;
			case 'Sftn': result.soften = parseUnits(val); break;
			case 'srgR': result.strength = parsePercent(val); break;
			case 'blur': result.size = parseUnits(val); break;
			case 'Nose': result.noise = parsePercent(val); break;
			case 'Inpr': result.range = parsePercent(val); break;
			case 'Ckmt': result.choke = parseUnits(val); break;
			case 'ShdN': result.jitter = parsePercent(val); break;
			case 'Dstn': result.distance = parseUnits(val); break;
			case 'Scl ': result.scale = parsePercent(val); break;
			case 'Ptrn': result.pattern = { name: val['Nm  '], id: val.Idnt }; break;
			case 'phase': result.phase = { x: val.Hrzn, y: val.Vrtc }; break;
			case 'Ofst': result.offset = { x: parsePercent(val.Hrzn), y: parsePercent(val.Vrtc) }; break;
			case 'MpgS':
			case 'TrnS':
				result.contour = {
					name: val['Nm  '],
					curve: (val['Crv '] as any[]).map(p => ({ x: p.Hrzn, y: p.Vrtc })),
				};
				break;
			case 'Grad': result.gradient = parseGradient(val); break;
			case 'useTexture':
			case 'useShape':
			case 'layerConceals':
			case 'present':
			case 'showInDialog':
			case 'antialiasGloss': result[key] = val; break;
			default:
				reportErrors && console.log(`Invalid effect key: '${key}':`, val);
		}
	}

	return result;
}

function serializeEffectObject(obj: any, objName: string, reportErrors: boolean) {
	const result: any = {};

	for (const objKey of Object.keys(obj)) {
		const key: keyof AllEffects = objKey as any;
		const val = obj[key];

		switch (key) {
			case 'enabled': result.enab = !!val; break;
			case 'useGlobalLight': result.uglg = !!val; break;
			case 'antialiased': result.AntA = !!val; break;
			case 'align': result.Algn = !!val; break;
			case 'dither': result.Dthr = !!val; break;
			case 'invert': result.Invr = !!val; break;
			case 'reverse': result.Rvrs = !!val; break;
			case 'color': result['Clr '] = serializeColor(val); break;
			case 'highlightColor': result.hglC = serializeColor(val); break;
			case 'shadowColor': result.sdwC = serializeColor(val); break;
			case 'position': result.Styl = FStl.encode(val); break;
			case 'blendMode': result['Md  '] = BlnM.encode(val); break;
			case 'highlightBlendMode': result.hglM = BlnM.encode(val); break;
			case 'shadowBlendMode': result.sdwM = BlnM.encode(val); break;
			case 'style': result.bvlS = BESl.encode(val); break;
			case 'direction': result.bvlD = BESs.encode(val); break;
			case 'technique':
				if (objName === 'bevel') {
					result.bvlT = bvlT.encode(val);
				} else {
					result.GlwT = BETE.encode(val);
				}
				break;
			case 'source': result.glwS = IGSr.encode(val); break;
			case 'type': result.Type = GrdT.encode(val); break;
			case 'opacity': result.Opct = unitsPercent(val); break;
			case 'highlightOpacity': result.hglO = unitsPercent(val); break;
			case 'shadowOpacity': result.sdwO = unitsPercent(val); break;
			case 'angle':
				if (objName === 'gradientOverlay') {
					result.Angl = unitsAngle(val);
				} else {
					result.lagl = unitsAngle(val);
				}
				break;
			case 'altitude': result.Lald = unitsAngle(val); break;
			case 'soften': result.Sftn = unitsValue(val, key); break;
			case 'strength': result.srgR = unitsPercent(val); break;
			case 'size': result.blur = unitsValue(val, key); break;
			case 'noise': result.Nose = unitsPercent(val); break;
			case 'range': result.Inpr = unitsPercent(val); break;
			case 'choke': result.Ckmt = unitsValue(val, key); break;
			case 'jitter': result.ShdN = unitsPercent(val); break;
			case 'distance': result.Dstn = unitsValue(val, key); break;
			case 'scale': result['Scl '] = unitsPercent(val); break;
			case 'pattern': result.Ptrn = { 'Nm  ': val.name, Idnt: val.id }; break;
			case 'phase': result.phase = { Hrzn: val.x, Vrtc: val.y }; break;
			case 'offset': result.Ofst = { Hrzn: unitsPercent(val.x), Vrtc: unitsPercent(val.y) }; break;
			case 'contour': {
				result[objName === 'satin' ? 'MpgS' : 'TrnS'] = {
					'Nm  ': (val as EffectContour).name,
					'Crv ': (val as EffectContour).curve.map(p => ({ Hrzn: p.x, Vrtc: p.y })),
				};
				break;
			}
			case 'gradient': result.Grad = serializeGradient(val); break;
			case 'useTexture':
			case 'useShape':
			case 'layerConceals':
			case 'present':
			case 'showInDialog':
			case 'antialiasGloss':
				result[key] = val;
				break;
			default:
				reportErrors && console.log(`Invalid effect key: '${key}' value:`, val);
		}
	}

	return result;
}
