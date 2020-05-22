import { readEffects, writeEffects } from './effectsHelpers';
import { clamp, createEnum, layerColors } from './helpers';
import {
	LayerAdditionalInfo, TextGridding, Orientation, WarpStyle, AntiAlias, BevelStyle, BevelTechnique,
	LayerEffectShadow, LayerEffectsOuterGlow, LayerEffectInnerGlow, LayerEffectBevel,
	LayerEffectSolidFill, BevelDirection, GlowTechnique, GlowSource, LayerEffectPatternOverlay,
	LayerEffectGradientOverlay, LayerEffectSatin, GradientStyle, EffectContour, EffectSolidGradient,
	EffectNoiseGradient, BezierPath, Psd, BlendMode, LineCapType, LineJoinType, LineAlignment,
	VectorContent, UnitsValue, LayerEffectStroke, ExtraGradientInfo, EffectPattern,
	ExtraPatternInfo, ReadOptions, BrightnessAdjustment, ExposureAdjustment, VibranceAdjustment,
	ColorBalanceAdjustment, BlackAndWhiteAdjustment, PhotoFilterAdjustment, ChannelMixerChannel,
	ChannelMixerAdjustment, PosterizeAdjustment, ThresholdAdjustment, GradientMapAdjustment, CMYK,
	SelectiveColorAdjustment, ColorLookupAdjustment, LevelsAdjustmentChannel, LevelsAdjustment,
	CurvesAdjustment, CurvesAdjustmentChannel, HueSaturationAdjustment, HueSaturationAdjustmentChannel,
	PresetInfo, Color, ColorBalanceValues,
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readInt16, checkSignature, readFloat32, readFixedPointPath32, readSection, readColor, readInt32
} from './psdReader';
import {
	PsdWriter, writeZeros, writeSignature, writeBytes, writeUint32, writeUint16, writeFloat64, writeUint8,
	writeInt16, writeFloat32, writeFixedPointPath32, writeUnicodeString, writeSection, writeUnicodeStringWithPadding, writeColor,
} from './psdWriter';
import { readVersionAndDescriptor, writeVersionAndDescriptor } from './descriptor';
import { serializeEngineData, parseEngineData } from './engineData';
import { encodeEngineData, decodeEngineData } from './text';
import { fromByteArray, toByteArray } from 'base64-js';

const MOCK_HANDLERS = false;

type HasMethod = (target: LayerAdditionalInfo) => boolean;
type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd, options: ReadOptions) => void;
type WriteMethod = (writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd) => void;

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

const textGridding = createEnum<TextGridding>('textGridding', 'none', {
	none: 'None',
});

const Ornt = createEnum<Orientation>('Ornt', 'horizontal', {
	horizontal: 'Hrzn',
	vertical: 'Vrtc',
});

const Annt = createEnum<AntiAlias>('Annt', 'sharp', {
	none: 'Anno',
	sharp: 'antiAliasSharp',
	crisp: 'AnCr',
	strong: 'AnSt',
	smooth: 'AnSm',
});

const warpStyle = createEnum<WarpStyle>('warpStyle', 'none', {
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
});

const BlnM = createEnum<BlendMode>('BlnM', 'normal', {
	'normal': 'Nrml',
	'dissolve': 'Dslv',
	'darken': 'Drkn',
	'multiply': 'Mltp',
	'color burn': 'CBrn',
	'linear burn': 'linearBurn',
	'darker color': 'darkerColor',
	'lighten': 'Lghn',
	'screen': 'Scrn',
	'color dodge': 'CDdg',
	'linear dodge': 'linearDodge',
	'lighter color': 'lighterColor',
	'overlay': 'Ovrl',
	'soft light': 'SftL',
	'hard light': 'HrdL',
	'vivid light': 'vividLight',
	'linear light': 'linearLight',
	'pin light': 'pinLight',
	'hard mix': 'hardMix',
	'difference': 'Dfrn',
	'exclusion': 'Xclu',
	'subtract': 'blendSubtraction',
	'divide': 'blendDivide',
	'hue': 'H   ',
	'saturation': 'Strt',
	'color': 'Clr ',
	'luminosity': 'Lmns',
});

const BESl = createEnum<BevelStyle>('BESl', 'inner bevel', {
	'inner bevel': 'InrB',
	'outer bevel': 'OtrB',
	'emboss': 'Embs',
	'pillow emboss': 'PlEb',
	'stroke emboss': 'strokeEmboss',
});

const bvlT = createEnum<BevelTechnique>('bvlT', 'smooth', {
	'smooth': 'SfBL',
	'chisel hard': 'PrBL',
	'chisel soft': 'Slmt',
});

const BESs = createEnum<BevelDirection>('BESs', 'up', {
	up: 'In  ',
	down: 'Out ',
});

const BETE = createEnum<GlowTechnique>('BETE', 'softer', {
	softer: 'SfBL',
	precise: 'PrBL',
});

const IGSr = createEnum<GlowSource>('IGSr', 'edge', {
	edge: 'SrcE',
	center: 'SrcC',
});

const GrdT = createEnum<GradientStyle>('GrdT', 'linear', {
	linear: 'Lnr ',
	radial: 'Rdl ',
	angle: 'Angl',
	reflected: 'Rflc',
	diamond: 'Dmnd',
});

export const ClrS = createEnum<'rgb' | 'hsb' | 'lab'>('ClrS', 'rgb', {
	rgb: 'RGBC',
	hsb: 'HSBl',
	lab: 'LbCl',
});

const FStl = createEnum<'inside' | 'center' | 'outside'>('FStl', 'outside', {
	outside: 'OutF',
	center: 'CtrF',
	inside: 'InsF'
});

const FrFl = createEnum<'color' | 'gradient' | 'pattern'>('FrFl', 'color', {
	color: 'SClr',
	gradient: 'GrFl',
	pattern: 'Ptrn',
});

const strokeStyleLineCapType = createEnum<LineCapType>('strokeStyleLineCapType', 'butt', {
	butt: 'strokeStyleButtCap',
	round: 'strokeStyleRoundCap',
	square: 'strokeStyleSquareCap',
});

const strokeStyleLineJoinType = createEnum<LineJoinType>('strokeStyleLineJoinType', 'miter', {
	miter: 'strokeStyleMiterJoin',
	round: 'strokeStyleRoundJoin',
	bevel: 'strokeStyleBevelJoin',
});

const strokeStyleLineAlignment = createEnum<LineAlignment>('strokeStyleLineAlignment', 'inside', {
	inside: 'strokeStyleAlignInside',
	center: 'strokeStyleAlignCenter',
	outside: 'strokeStyleAlignOutside',
});

function hasKey(key: keyof LayerAdditionalInfo) {
	return (target: LayerAdditionalInfo) => target[key] !== undefined;
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

		const warpDescriptor: WarpDescriptor = {
			warpStyle: warpStyle.encode(warp.style),
			warpValue: warp.value || 0,
			warpPerspective: warp.perspective || 0,
			warpPerspectiveOther: warp.perspectiveOther || 0,
			warpRotate: Ornt.encode(warp.rotate),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i]);
		}

		writeInt16(writer, 50); // text version
		writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor);

		writeInt16(writer, 1); // warp version
		writeVersionAndDescriptor(writer, '', 'warp', warpDescriptor);

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
		const descriptor = readVersionAndDescriptor(reader);
		target.vectorFill = parseVectorContent(descriptor);
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
					readUint16(reader); // count
					skipBytes(reader, 22);
					path = { open: false, knots: [] };
					paths.push(path);
					break;
				case 1: // Closed subpath Bezier knot, linked
				case 4: // Open subpath Bezier knot, linked
					path!.knots.push({ linked: true, points: readBezierKnot(reader, width, height) });
					break;
				case 2: // Closed subpath Bezier knot, unlinked
				case 5: // Open subpath Bezier knot, unlinked
					path!.knots.push({ linked: false, points: readBezierKnot(reader, width, height) });
					break;
				case 3: // Open subpath length record
					readUint16(reader); // count
					skipBytes(reader, 22);
					path = { open: true, knots: [] };
					paths.push(path);
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
			writeUint16(writer, 1);
			writeUint16(writer, 1);
			writeZeros(writer, 18);

			const linkedKnot = path.open ? 4 : 1;
			const unlinkedKnot = path.open ? 5 : 2;

			for (const { linked, points } of path.knots) {
				writeUint16(writer, linked ? linkedKnot : unlinkedKnot);
				writeFixedPointPath32(writer, points[1] / width); // y0
				writeFixedPointPath32(writer, points[0] / height); // x0
				writeFixedPointPath32(writer, points[3] / width); // y1
				writeFixedPointPath32(writer, points[2] / height); // x1
				writeFixedPointPath32(writer, points[5] / width); // y2
				writeFixedPointPath32(writer, points[4] / height); // x2
			}
		}
	},
);

// TODO: need to write vmsk if has outline ?
addHandlerAlias('vsms', 'vmsk');

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
	(writer, target) => writeUint32(writer, target.id!),
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
					options.logDevFeatures && console.log('mlst', require('util').inspect(desc, false, 99, true));
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
		writeSection(writer, 2, () => writeVersionAndDescriptor(writer, '', 'metadata', desc));
	},
);

addHandler(
	'sn2P',
	hasKey('usingAlignedRendering'),
	(reader, target) => target.usingAlignedRendering = !!readUint32(reader),
	(writer, target) => writeUint32(writer, target.usingAlignedRendering ? 1 : 0),
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

MOCK_HANDLERS && addHandler(
	'Patt',
	target => 'children' in target, // (target as any)._Patt !== undefined,
	(reader, target, left) => {
		console.log('additional info: Patt');
		(target as any)._Patt = readBytes(reader, left());
	},
	(writer, target) => false && writeBytes(writer, (target as any)._Patt),
);

addHandler(
	'Patt', // TODO: handle also Pat2 & Pat3
	target => !target,
	(reader, _target, left) => {
		if (!left()) return;

		skipBytes(reader, left()); return; // not supported yet
		/*
		const length = readUint32(reader);
		const version = readUint32(reader);

		if (version !== 1) throw new Error(`Invalid Patt version: ${version}`);

		const colorMode = readUint32(reader) as ColorMode;
		const x = readInt16(reader);
		const y = readInt16(reader);

		if (supportedColorModes.indexOf(colorMode) == -1) {
			throw new Error(`Invalid Patt color mode: ${colorMode}`);
		}

		const name = readUnicodeString(reader);
		const id = readPascalString(reader, 1);

		// TODO: index color table here (only for indexed color mode, not supported right now)
		console.log('patt', length, colorMode, x, y, name, id);

		// virtual memory array list
		{
			const version = readUint32(reader);

			if (version !== 3) throw new Error(`Invalid Patt:VMAL version: ${version}`);

			const length = readUint32(reader);
			const top = readUint32(reader);
			const left = readUint32(reader);
			const bottom = readUint32(reader);
			const right = readUint32(reader);
			const channels = readUint32(reader);

			console.log('VMAL', length, top, left, bottom, right, channels);

			for (let i = 0; i < (channels + 2); i++) {
				const has = readUint32(reader);

				if (has) {
					const length = readUint32(reader);
					const pixelDepth = readUint32(reader);
					const top = readUint32(reader);
					const left = readUint32(reader);
					const bottom = readUint32(reader);
					const right = readUint32(reader);
					const pixelDepth2 = readUint16(reader);
					const compressionMode = readUint8(reader); // 1 - zip

					// TODO: decompress data ...

					skipBytes(reader, length - (4 + 16 + 2 + 1));

					console.log('channel', length, pixelDepth, top, left, bottom, right, pixelDepth2, compressionMode);
				} else {
					console.log('SKIP');
				}
			}
		}

		if (!target.patterns) target.patterns = [];

		target.patterns.push({ name, id, colorMode, x, y });

		skipBytes(reader, left());
		*/
	},
	(_writer, _target) => {
	},
);

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

addHandler(
	'lrFX',
	hasKey('effects'),
	(reader, target, left) => {
		if (!target.effects) {
			target.effects = readEffects(reader);
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		writeEffects(writer, target.effects!);
	},
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

addHandler(
	'vstk',
	hasKey('vectorStroke'),
	(reader, target, left) => {
		const descriptor = readVersionAndDescriptor(reader) as StrokeDescriptor;

		target.vectorStroke = {
			strokeEnabled: descriptor.strokeEnabled,
			fillEnabled: descriptor.fillEnabled,
			lineWidth: parseUnits(descriptor.strokeStyleLineWidth),
			lineDashOffset: parseUnits(descriptor.strokeStyleLineDashOffset),
			miterLimit: descriptor.strokeStyleMiterLimit,
			lineCapType: strokeStyleLineCapType.decode(descriptor.strokeStyleLineCapType),
			lineJoinType: strokeStyleLineJoinType.decode(descriptor.strokeStyleLineJoinType),
			lineAlignment: strokeStyleLineAlignment.decode(descriptor.strokeStyleLineAlignment),
			scaleLock: descriptor.strokeStyleScaleLock,
			strokeAdjust: descriptor.strokeStyleStrokeAdjust,
			lineDashSet: descriptor.strokeStyleLineDashSet.map(parseUnits),
			blendMode: BlnM.decode(descriptor.strokeStyleBlendMode),
			opacity: parsePercent(descriptor.strokeStyleOpacity),
			content: parseVectorContent(descriptor.strokeStyleContent),
			resolution: descriptor.strokeStyleResolution,
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

addHandler(
	'lfx2',
	hasKey('effects'),
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error(`Invalid lfx2 version`);

		const info = readVersionAndDescriptor(reader);

		target.effects = {}; // discard if read in 'lrFX' section
		const effects = target.effects;

		if (!info.masterFXSwitch) effects.disabled = true;
		if (info['Scl ']) effects.scale = parsePercent(info['Scl ']);
		if (info.DrSh) effects.dropShadow = parseEffectObject(info.DrSh);
		if (info.IrSh) effects.innerShadow = parseEffectObject(info.IrSh);
		if (info.OrGl) effects.outerGlow = parseEffectObject(info.OrGl);
		if (info.IrGl) effects.innerGlow = parseEffectObject(info.IrGl);
		if (info.ebbl) effects.bevel = parseEffectObject(info.ebbl);
		if (info.SoFi) effects.solidFill = parseEffectObject(info.SoFi);
		if (info.patternFill) effects.patternOverlay = parseEffectObject(info.patternFill);
		if (info.GrFl) effects.gradientOverlay = parseEffectObject(info.GrFl);
		if (info.ChFX) effects.satin = parseEffectObject(info.ChFX);
		if (info.FrFX) {
			effects.stroke = {
				enabled: !!info.FrFX.enab,
				position: FStl.decode(info.FrFX.Styl),
				fillType: FrFl.decode(info.FrFX.PntT),
				blendMode: BlnM.decode(info.FrFX['Md  ']),
				opacity: parsePercent(info.FrFX.Opct),
				size: parseUnits(info.FrFX['Sz  ']),
			};

			if (info.FrFX['Clr ']) effects.stroke.color = parseColor(info.FrFX['Clr ']);
			if (info.FrFX.Grad) effects.stroke.gradient = parseGradientContent(info.FrFX);
			if (info.FrFX.Ptrn) effects.stroke.pattern = parsePatternContent(info.FrFX);
		}

		skipBytes(reader, left());
	},
	(writer, target) => {
		const effects = target.effects!;
		const info: any = {
			masterFXSwitch: !effects.disabled,
			'Scl ': unitsPercent(effects.scale ?? 1),
		};

		if (effects.dropShadow) info.DrSh = serializeEffectObject(effects.dropShadow, 'dropShadow');
		if (effects.innerShadow) info.IrSh = serializeEffectObject(effects.innerShadow, 'innerShadow');
		if (effects.outerGlow) info.OrGl = serializeEffectObject(effects.outerGlow, 'outerGlow');
		if (effects.innerGlow) info.IrGl = serializeEffectObject(effects.innerGlow, 'innerGlow');
		if (effects.bevel) info.ebbl = serializeEffectObject(effects.bevel, 'bevel');
		if (effects.solidFill) info.SoFi = serializeEffectObject(effects.solidFill, 'solidFill');
		if (effects.patternOverlay) info.patternFill = serializeEffectObject(effects.patternOverlay, 'patternOverlay');
		if (effects.gradientOverlay) info.GrFl = serializeEffectObject(effects.gradientOverlay, 'gradientOverlay');
		if (effects.satin) info.ChFX = serializeEffectObject(effects.satin, 'satin');

		const stroke = effects.stroke;

		if (stroke) {
			info.FrFX = {
				enab: !!stroke.enabled,
				Styl: FStl.encode(stroke.position),
				PntT: FrFl.encode(stroke.fillType),
				'Md  ': BlnM.encode(stroke.blendMode),
				Opct: unitsPercent(stroke.opacity),
				'Sz  ': unitsValue(stroke.size, 'size'),
			};

			if (stroke.color)
				info.FrFX['Clr '] = serializeColor(stroke.color);
			if (stroke.gradient)
				info.FrFX = { ...info.FrFX, ...serializeGradientContent(stroke.gradient) };
			if (stroke.pattern)
				info.FrFX = { ...info.FrFX, ...serializePatternContent(stroke.pattern) };
		}

		writeUint32(writer, 0); // version
		writeVersionAndDescriptor(writer, '', 'null', info);
	},
);

// addHandler(
// 	'lmfx',
// 	target => !target,
// 	(reader, _target) => {
// 		const version = readUint32(reader);
// 		if (version !== 0) throw new Error('Invalid lmfx version');

// 		const descriptor = readVersionAndDescriptor(reader);
// 		console.log(require('util').inspect(descriptor, false, 99, true));
// 	},
// 	(_writer, _target) => {
// 	},
// );

// addHandler(
// 	'cinf',
// 	target => !target,
// 	(reader, _target) => {
// 		const descriptor = readVersionAndDescriptor(reader);
// 		console.log(require('util').inspect(descriptor, false, 99, true));
// 	},
// 	(_writer, _target) => {
// 	},
// );

// descriptor helpers

type DescriptorUnits = 'Angle' | 'Density' | 'Distance' | 'None' | 'Percent' | 'Pixels' |
	'Millimeters' | 'Points' | 'Picas' | 'Inches' | 'Centimeters';

interface DescriptorUnitsValue {
	units: DescriptorUnits;
	value: number;
}

type DescriptorColor = {
	'Rd  ': number;
	'Grn ': number;
	'Bl  ': number;
} | {
	'H   ': DescriptorUnitsValue;
	Strt: number;
	Brgh: number;
} | {
	'Cyn ': number;
	Mgnt: number;
	'Ylw ': number;
	Blck: number;
} | {
	'Gry ': number;
} | {
	Lmnc: number;
	'A   ': number;
	'B   ': number;
};

interface DesciptorPattern {
	'Nm  ': string;
	Idnt: string;
}

type DesciptorGradient = {
	GrdF: 'GrdF.CstS';
	Intr: number;
	'Nm  ': string;
	Clrs: {
		'Clr ': DescriptorColor;
		Lctn: number;
		Mdpn: number;
	}[];
	Trns: {
		Opct: DescriptorUnitsValue;
		Lctn: number;
		Mdpn: number;
	}[];
} | {
	GrdF: 'GrdF.ClNs';
	Smth: number;
	'Nm  ': string;
	ClrS: string;
	RndS: number;
	VctC?: boolean;
	ShTr?: boolean;
	'Mnm ': number[];
	'Mxm ': number[];
};

interface DescriptorColorContent {
	'Clr ': DescriptorColor;
}

interface DescriptorGradientContent {
	Grad: DesciptorGradient;
	Type: string;
	Dthr?: boolean;
	Rvrs?: boolean;
	Angl?: DescriptorUnitsValue;
	'Scl '?: DescriptorUnitsValue;
	Algn?: boolean;
	Ofst?: { Hrzn: DescriptorUnitsValue; Vrtc: DescriptorUnitsValue; };
}

interface DescriptorPatternContent {
	Ptrn: DesciptorPattern;
	Lnkd?: boolean;
	phase?: { Hrzn: number; Vrtc: number; };
}

type DescriptorVectorContent = DescriptorColorContent | DescriptorGradientContent | DescriptorPatternContent;

interface StrokeDescriptor {
	strokeStyleVersion: number;
	strokeEnabled: boolean;
	fillEnabled: boolean;
	strokeStyleLineWidth: DescriptorUnitsValue;
	strokeStyleLineDashOffset: DescriptorUnitsValue;
	strokeStyleMiterLimit: number;
	strokeStyleLineCapType: string;
	strokeStyleLineJoinType: string;
	strokeStyleLineAlignment: string;
	strokeStyleScaleLock: boolean;
	strokeStyleStrokeAdjust: boolean;
	strokeStyleLineDashSet: DescriptorUnitsValue[];
	strokeStyleBlendMode: string;
	strokeStyleOpacity: DescriptorUnitsValue;
	strokeStyleContent: DescriptorVectorContent;
	strokeStyleResolution: number;
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
			GrdF: 'GrdF.CstS',
			'Nm  ': grad.name,
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
			'Nm  ': grad.name,
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
	const result: DescriptorGradientContent = {
		Grad: serializeGradient(content),
		Type: GrdT.encode(content.style),
	};
	if (content.dither !== undefined) result.Dthr = content.dither;
	if (content.reverse !== undefined) result.Rvrs = content.reverse;
	if (content.angle !== undefined) result.Angl = unitsAngle(content.angle);
	if (content.scale !== undefined) result['Scl '] = unitsPercent(content.scale);
	if (content.align !== undefined) result.Algn = content.align;
	if (content.offset) {
		result.Ofst = {
			Hrzn: unitsPercent(content.offset.x),
			Vrtc: unitsPercent(content.offset.y),
		};
	}
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

function parseAngle(x: DescriptorUnitsValue) {
	if (x === undefined) return 0;
	if (x.units !== 'Angle') throw new Error(`Invalid units: ${x.units}`);
	return x.value;
}

function parsePercent(x: DescriptorUnitsValue | undefined) {
	if (x === undefined) return 1;
	if (x.units !== 'Percent') throw new Error(`Invalid units: ${x.units}`);
	return x.value / 100;
}

function parseUnits({ units, value }: DescriptorUnitsValue): UnitsValue {
	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters'
	) {
		throw new Error(`Invalid units: ${JSON.stringify({ units, value })}`);
	}
	return { value, units };
}

function unitsAngle(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Angle', value: value || 0 };
}

function unitsPercent(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Percent', value: Math.round(clamp(value || 0, 0, 1) * 100) };
}

function unitsValue(x: UnitsValue | undefined, key: string): DescriptorUnitsValue {
	if (x == null) return { units: 'Pixels', value: 0 };

	if (typeof x !== 'object')
		throw new Error(`Invalid value: ${JSON.stringify(x)} (key: ${key}) (should have value and units)`);

	const { units, value } = x;

	if (typeof value !== 'number')
		throw new Error(`Invalid value in ${JSON.stringify(x)} (key: ${key})`);

	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters'
	) {
		throw new Error(`Invalid units in ${JSON.stringify(x)} (key: ${key})`);
	}

	return { units, value };
}

function parseColor(color: DescriptorColor): Color {
	if ('H   ' in color) {
		return { h: parsePercent(color['H   ']), s: color.Strt, b: color.Brgh };
	} else if ('Rd  ' in color) {
		return { r: color['Rd  '], g: color['Grn '], b: color['Bl  '] };
	} else if ('Cyn ' in color) {
		return { c: color['Cyn '], m: color.Mgnt, y: color['Ylw '], k: color.Blck };
	} else if ('Gry ' in color) {
		return { k: color['Gry '] };
	} else if ('Lmnc' in color) {
		console.log({ l: color.Lmnc, a: color['A   '], b: color['B   '] });
		return { l: color.Lmnc, a: color['A   '], b: color['B   '] };
	} else {
		console.log(color);
		throw new Error('Unsupported color descriptor');
	}
}

function serializeColor(color: Color | undefined): DescriptorColor {
	if (!color) {
		return { 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
	} else if ('r' in color) {
		return { 'Rd  ': color.r || 0, 'Grn ': color.g || 0, 'Bl  ': color.b || 0 };
	} else if ('h' in color) {
		return { 'H   ': unitsPercent(color.h), Strt: color.s || 0, Brgh: color.b || 0 };
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

function parseEffectObject(obj: any) {
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
			case 'antialiasGloss': result[key] = val; break;
			default: console.log(`Invalid effect key: '${key}':`, val);
		}
	}

	return result;
}

function serializeEffectObject(obj: any, objName: string) {
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
			case 'antialiasGloss':
				result[key] = val;
				break;
			default:
				console.log(`Invalid effect key: '${key}' value:`, val);
		}
	}

	return result;
}
