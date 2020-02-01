import { readEffects, writeEffects } from './effectsHelpers';
import { readColor, toArray, writeColor, hsv2rgb, clamp } from './helpers';
import {
	LayerAdditionalInfo, TextGridding, Orientation, WarpStyle, AntiAlias, BevelStyle, BevelTechnique,
	LayerEffectShadow, LayerEffectsOuterGlow, LayerEffectInnerGlow, LayerEffectBevel,
	LayerEffectSolidFill, BevelDirection, GlowTechnique, GlowSource, LayerEffectPatternOverlay,
	LayerEffectGradientOverlay, LayerEffectSatin, GradientStyle, EffectContour, EffectSolidGradient,
	EffectNoiseGradient, BezierPath, Psd, BlendMode, LineCapType, LineJoinType, LineAlignment, VectorContent, UnitsValue, Color, LayerEffectStroke, ExtraGradientInfo, EffectPattern, ExtraPatternInfo
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readInt16, checkSignature, readFloat32, readFixedPointPath32
} from './psdReader';
import {
	PsdWriter, writeZeros, writeSignature, writeBytes, writeUint32, writeUint16, writeFloat64, writeUint8,
	writeInt16, writeFloat32, writeFixedPointPath32, writeUnicodeString,
} from './psdWriter';
import { readVersionAndDescriptor, writeVersionAndDescriptor } from './descriptor';
import { serializeEngineData, parseEngineData } from './engineData';
import { encodeEngineData, decodeEngineData } from './text';
import { fromByteArray, toByteArray } from 'base64-js';

const MOCK_HANDLERS = false;

type HasMethod = (target: LayerAdditionalInfo) => boolean;
type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd) => void;
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

interface Dict {
	[key: string]: string;
}

function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

function createEnum<T>(prefix: string, def: string, map: Dict) {
	const rev = revMap(map);
	const decode = (val: string): T => (rev[val.split('.')[1]] as any) || def;
	const encode = (val: T | undefined): string => `${prefix}.${map[val as any] || map[def]}`;
	return { decode, encode };
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

const ClrS = createEnum<'rgb' | 'hsb' | 'lab'>('ClrS', 'rgb', {
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

addHandler(
	'TySh',
	target => target.text !== undefined,
	(reader, target, leftBytes) => {
		const version = readInt16(reader);
		if (version !== 1) throw new Error(`Invalid TySh version`);

		const transform = [
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
		];

		const textVersion = readInt16(reader);
		if (textVersion !== 50) throw new Error(`Invalid TySh text version`);

		const text: TextDescriptor = readVersionAndDescriptor(reader);

		const warpVersion = readInt16(reader);
		if (warpVersion !== 1) throw new Error(`Invalid TySh warp version`);

		const warp: WarpDescriptor = readVersionAndDescriptor(reader);

		const left = readFloat32(reader);
		const top = readFloat32(reader);
		const right = readFloat32(reader);
		const bottom = readFloat32(reader);

		target.text = {
			transform, left, top, right, bottom,
			text: text['Txt '].replace(/\r/g, '\n'),
			index: text.TextIndex ?? 0,
			gridding: textGridding.decode(text.textGridding),
			antiAlias: Annt.decode(text.AntA),
			orientation: Ornt.decode(text.Ornt),
			warp: {
				style: warpStyle.decode(warp.warpStyle),
				value: warp.warpValue ?? 0,
				perspective: warp.warpPerspective ?? 0,
				perspectiveOther: warp.warpPerspectiveOther ?? 0,
				rotate: Ornt.decode(warp.warpRotate),
			},
		};

		if (text.EngineData) {
			const engineData = decodeEngineData(parseEngineData(text.EngineData));
			// console.log(require('util').inspect(parseEngineData(text.EngineData), false, 99, true));
			target.text = { ...target.text, ...engineData };
			// console.log(require('util').inspect(target.text, false, 99, true));
		}

		skipBytes(reader, leftBytes());
	},
	(writer, target) => {
		const text = target.text!;
		const warp = text.warp ?? {};
		const transform = text.transform ?? [1, 0, 0, 1, 0, 0];

		const textDescriptor: TextDescriptor = {
			'Txt ': (text.text ?? '').replace(/\r?\n/g, '\r'),
			textGridding: textGridding.encode(text.gridding),
			Ornt: Ornt.encode(text.orientation),
			AntA: Annt.encode(text.antiAlias),
			TextIndex: text.index ?? 0,
			EngineData: serializeEngineData(encodeEngineData(text)),
		};

		const warpDescriptor: WarpDescriptor = {
			warpStyle: warpStyle.encode(warp.style),
			warpValue: warp.value ?? 0,
			warpPerspective: warp.perspective ?? 0,
			warpPerspectiveOther: warp.perspectiveOther ?? 0,
			warpRotate: Ornt.encode(warp.rotate),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i] ?? 0);
		}

		writeInt16(writer, 50); // text version
		writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor);

		writeInt16(writer, 1); // warp version
		writeVersionAndDescriptor(writer, '', 'warp', warpDescriptor);

		writeFloat32(writer, text.left ?? 0);
		writeFloat32(writer, text.top ?? 0);
		writeFloat32(writer, text.right ?? 0);
		writeFloat32(writer, text.bottom ?? 0);

		writeZeros(writer, 2);
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
	target => target.vectorMask !== undefined,
	(reader, target, left, { width, height }) => {
		const version = readUint32(reader);
		if (version !== 3) throw new Error('Invalid vmsk version');

		target.vectorMask = { paths: [] };

		const flags = readUint32(reader);
		target.vectorMask.invert = (flags & 1) !== 0;
		target.vectorMask.notLink = (flags & 2) !== 0;
		target.vectorMask.disable = (flags & 4) !== 0;

		const paths = target.vectorMask.paths;
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
					target.vectorMask.clipboard = { top, left, bottom, right, resolution };
					break;
				}
				case 8: // Initial fill rule record
					target.vectorMask.fillStartsWithAllPixels = !!readUint16(reader);
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

		if (vectorMask.clipboard) {
			writeUint16(writer, 7);
			writeFixedPointPath32(writer, vectorMask.clipboard.top);
			writeFixedPointPath32(writer, vectorMask.clipboard.left);
			writeFixedPointPath32(writer, vectorMask.clipboard.bottom);
			writeFixedPointPath32(writer, vectorMask.clipboard.right);
			writeFixedPointPath32(writer, vectorMask.clipboard.resolution);
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

			for (const knot of path.knots) {
				writeUint16(writer, knot.linked ? linkedKnot : unlinkedKnot);
				writeFixedPointPath32(writer, knot.points[1] / width); // y0
				writeFixedPointPath32(writer, knot.points[0] / height); // x0
				writeFixedPointPath32(writer, knot.points[3] / width); // y1
				writeFixedPointPath32(writer, knot.points[2] / height); // x1
				writeFixedPointPath32(writer, knot.points[5] / width); // y2
				writeFixedPointPath32(writer, knot.points[4] / height); // x2
			}
		}
	},
);

// TODO: need to write vmsk if has outline ?
addHandlerAlias('vsms', 'vmsk');

addHandler(
	'luni',
	target => target.name !== undefined,
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
	target => target.nameSource !== undefined,
	(reader, target) => target.nameSource = readSignature(reader),
	(writer, target) => writeSignature(writer, target.nameSource!),
);

addHandler(
	'lyid',
	target => target.id !== undefined,
	(reader, target) => target.id = readUint32(reader),
	(writer, target) => writeUint32(writer, target.id!),
);

addHandler(
	'clbl',
	target => target.blendClippendElements !== undefined,
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
	target => target.blendInteriorElements !== undefined,
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
	target => target.knockout !== undefined,
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
	target => target.protected !== undefined,
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
	target => target.sheetColors !== undefined,
	(reader, target) => {
		// TODO: is this 32bit color or color index ?
		target.sheetColors = {
			color1: readUint32(reader),
			color2: readUint32(reader),
		};
	},
	(writer, target) => {
		writeUint32(writer, target.sheetColors!.color1);
		writeUint32(writer, target.sheetColors!.color2);
	},
);

addHandler(
	'shmd',
	target => target.metadata !== undefined,
	(reader, target) => {
		const count = readUint32(reader);
		target.metadata = [];

		for (let i = 0; i < count; i++) {
			checkSignature(reader, '8BIM');
			const key = readSignature(reader);
			const copy = !!readUint8(reader);
			skipBytes(reader, 3);
			const length = readUint32(reader);
			const data = toArray(readBytes(reader, length));
			target.metadata.push({ key, copy, data });
		}
	},
	(writer, target) => {
		writeUint32(writer, target.metadata!.length);

		for (let i = 0; i < target.metadata!.length; i++) {
			const item = target.metadata![i];
			writeSignature(writer, '8BIM');
			writeSignature(writer, item.key);
			writeUint8(writer, item.copy ? 1 : 0);
			writeZeros(writer, 3);
			writeUint32(writer, item.data.length);
			writeBytes(writer, new Uint8Array(item.data));
		}
	},
);

addHandler(
	'sn2P',
	target => target.usingAlignedRendering !== undefined,
	(reader, target) => target.usingAlignedRendering = !!readUint32(reader),
	(writer, target) => writeUint32(writer, target.usingAlignedRendering ? 1 : 0),
);

addHandler(
	'fxrp',
	target => target.referencePoint !== undefined,
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
	target => target.sectionDivider !== undefined,
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
/*addHandler(
	'Patt', // TODO: handle also Pat2 & Pat3
	target => !target,
	(reader, target, left) => {
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
	},
	(_writer, _target) => {
	},
);*/

addHandler(
	'pths',
	target => target.pathList !== undefined,
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
	target => target.version !== undefined,
	(reader, target) => target.version = readUint32(reader),
	(writer, target) => writeUint32(writer, target.version!),
);

addHandler(
	'lrFX',
	target => target.effects !== undefined,
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

addHandler(
	'Txt2',
	target => target.engineData !== undefined,
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
	target => target.filterMask !== undefined,
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
	target => target.vectorStroke !== undefined,
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
			strokeStyleLineWidth: stroke.lineWidth ?? { value: 3, units: 'Points' },
			strokeStyleLineDashOffset: stroke.lineDashOffset ?? { value: 0, units: 'Points' },
			strokeStyleMiterLimit: stroke.miterLimit ?? 100,
			strokeStyleLineCapType: strokeStyleLineCapType.encode(stroke.lineCapType),
			strokeStyleLineJoinType: strokeStyleLineJoinType.encode(stroke.lineJoinType),
			strokeStyleLineAlignment: strokeStyleLineAlignment.encode(stroke.lineAlignment),
			strokeStyleScaleLock: !!stroke.scaleLock,
			strokeStyleStrokeAdjust: !!stroke.strokeAdjust,
			strokeStyleLineDashSet: stroke.lineDashSet ?? [],
			strokeStyleBlendMode: BlnM.encode(stroke.blendMode),
			strokeStyleOpacity: unitsPercent(stroke.opacity ?? 1),
			strokeStyleContent: serializeVectorContent(
				stroke.content ?? { type: 'color', color: [0, 0, 0, 0] }).descriptor,
			strokeStyleResolution: stroke.resolution ?? 72,
		};

		writeVersionAndDescriptor(writer, '', 'strokeStyle', descriptor);
	},
);

addHandler(
	'lfx2',
	target => target.effects !== undefined,
	(reader, target, left) => {
		const version = readUint32(reader);
		if (version !== 0) throw new Error(`Invalid lfx2 version`);

		const info = readVersionAndDescriptor(reader);

		target.effects = {}; // discard if read in 'lrFX' section

		if (!info.masterFXSwitch) target.effects.disabled = true;
		if (info['Scl ']) target.effects.scale = parsePercent(info['Scl ']);
		if (info.DrSh) target.effects.dropShadow = parseEffectObject(info.DrSh);
		if (info.IrSh) target.effects.innerShadow = parseEffectObject(info.IrSh);
		if (info.OrGl) target.effects.outerGlow = parseEffectObject(info.OrGl);
		if (info.IrGl) target.effects.innerGlow = parseEffectObject(info.IrGl);
		if (info.ebbl) target.effects.bevel = parseEffectObject(info.ebbl);
		if (info.SoFi) target.effects.solidFill = parseEffectObject(info.SoFi);
		if (info.patternFill) target.effects.patternOverlay = parseEffectObject(info.patternFill);
		if (info.GrFl) target.effects.gradientOverlay = parseEffectObject(info.GrFl);
		if (info.ChFX) target.effects.satin = parseEffectObject(info.ChFX);
		if (info.FrFX) {
			target.effects.stroke = {
				enabled: !!info.FrFX.enab,
				position: FStl.decode(info.FrFX.Styl),
				fillType: FrFl.decode(info.FrFX.PntT),
				blendMode: BlnM.decode(info.FrFX['Md  ']),
				opacity: parsePercent(info.FrFX.Opct),
				size: parseUnits(info.FrFX['Sz  ']),
			};

			if (info.FrFX['Clr ']) target.effects.stroke.color = parseColor(info.FrFX['Clr ']);
			if (info.FrFX.Grad) target.effects.stroke.gradient = parseGradientContent(info.FrFX);
			if (info.FrFX.Ptrn) target.effects.stroke.pattern = parsePatternContent(info.FrFX);
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
		if (effects.stroke) {
			info.FrFX = {
				enab: !!effects.stroke.enabled,
				Styl: FStl.encode(effects.stroke.position),
				PntT: FrFl.encode(effects.stroke.fillType),
				'Md  ': BlnM.encode(effects.stroke.blendMode),
				Opct: unitsPercent(effects.stroke.opacity),
				'Sz  ': unitsValue(effects.stroke.size, 'size'),
			};

			if (effects.stroke.color)
				info.FrFX['Clr '] = serializeColor(effects.stroke.color);
			if (effects.stroke.gradient)
				info.FrFX = { ...info.FrFX, ...serializeGradientContent(effects.stroke.gradient) };
			if (effects.stroke.pattern)
				info.FrFX = { ...info.FrFX, ...serializePatternContent(effects.stroke.pattern) };
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
				'Clr ': serializeColor(s.color || [0, 0, 0, 0]),
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
			RndS: grad.randomSeed ?? 0,
			Smth: Math.round((grad.roughness ?? 1) * 4096),
			'Mnm ': (grad.min ?? [0, 0, 0, 0]).map(x => x * 100),
			'Mxm ': (grad.max ?? [1, 1, 1, 1]).map(x => x * 100),
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
			'Nm  ': content.name ?? '',
			Idnt: content.id ?? '',
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
	return { units: 'Angle', value: value ?? 0 };
}

function unitsPercent(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Percent', value: Math.round(clamp(value ?? 0, 0, 1) * 100) };
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

function parseColor(value: DescriptorColor): Color {
	if ('H   ' in value) {
		return hsv2rgb(parsePercent(value['H   ']), value.Strt, value.Brgh);
	} else if ('Rd  ' in value) {
		return [value['Rd  '], value['Grn '], value['Bl  '], 255];
	} else {
		throw new Error('Unsupported color descriptor');
	}
}

function serializeColor(value: number[] | undefined): DescriptorColor {
	if (!value) value = [0, 0, 0, 0];
	return { 'Rd  ': value[0] || 0, 'Grn ': value[1] || 0, 'Bl  ': value[2] || 0 };
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
