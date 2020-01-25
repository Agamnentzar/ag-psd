import { readEffects, writeEffects } from './effectsHelpers';
import { readColor, toArray, writeColor } from './helpers';
import {
	LayerAdditionalInfo, TextGridding, Orientation, WarpStyle, Antialias, BevelStyle, BevelTechnique,
	LayerEffectsShadow, LayerEffectsOuterGlow, LayerEffectsInnerGlow, LayerEffectsBevel,
	LayerEffectsSolidFill, BevelDirection, GlowTechnique, GlowSource, LayerEffectPatternOverlay,
	LayerEffectGradientOverlay, LayerEffectSatin, GradientType, EffectContour, EffectSolidGradient,
	EffectNoiseGradient
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16,
	readBytes, readInt32, readInt16, checkSignature
} from './psdReader';
import {
	PsdWriter, writeZeros, writeUnicodeString, writeSignature, writeBytes, writeUint32, writeUint16,
	writeFloat64, writeUint8, writeInt16, writeInt32,
} from './psdWriter';
import { readDescriptorStructure, writeDescriptorStructure } from './descriptor';

export interface InfoHandler {
	key: string;
	has: (target: LayerAdditionalInfo) => boolean;
	read: (reader: PsdReader, target: LayerAdditionalInfo, left: () => number) => void;
	write: (writer: PsdWriter, target: LayerAdditionalInfo) => void;
}

export const infoHandlers: InfoHandler[] = [];
export const infoHandlersMap: { [key: string]: InfoHandler } = {};

function addHandler(
	key: string,
	has: (target: LayerAdditionalInfo) => boolean,
	read: (reader: PsdReader, target: LayerAdditionalInfo, left: () => number) => void,
	write: (writer: PsdWriter, target: LayerAdditionalInfo) => void,
) {
	const handler: InfoHandler = { key, has, read, write };
	infoHandlers.push(handler);
	infoHandlersMap[handler.key] = handler;
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

interface Dict {
	[key: string]: string;
}

function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

// textGridding.None
const textGridding: Dict = {
	none: 'None',
};

const textGriddingRev = revMap(textGridding);

function toTextGridding(value: string): TextGridding {
	return (textGriddingRev[value.split('.')[1]] as any) || 'none';
}

function fromTextGridding(value: TextGridding | undefined) {
	return `textGridding.${textGridding[value!] || 'None'}`;
}

// Ornt.Hrzn | Ornt.Vrtc
const Ornt: Dict = {
	horizontal: 'Hrzn',
	vertical: 'Vrtc',
};

const OrntRev = revMap(Ornt);

function toOrientation(value: string): Orientation {
	return (OrntRev[value.split('.')[1]] as any) || 'horizontal';
}

function fromOrientation(value: Orientation | undefined) {
	return `textGridding.${Ornt[value!] || 'Hrzn'}`;
}

// Annt.antiAliasSharp | Annt.Anno | ...
const Annt: Dict = {
	none: 'Anno',
	sharp: 'antiAliasSharp',
	crisp: 'AnCr',
	strong: 'AnSt',
	smooth: 'AnSm',
};

const AnntRev = revMap(Annt);

function toAntialias(value: string): Antialias {
	return (AnntRev[value.split('.')[1]] as any) || 'none';
}

function fromAntialias(value: Antialias | undefined) {
	return `Annt.${Annt[value!] || 'Anno'}`;
}

// warpStyle.warpNone | warpStyle.warpArc | ...
const warpStyle: Dict = {
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
};

const warpStyleRev = revMap(warpStyle);

function toWarpStyle(value: string): WarpStyle {
	return (warpStyleRev[value.split('.')[1]] as any) || 'none';
}

function fromWarpStyle(value: WarpStyle | undefined) {
	return `warpStyle.${warpStyle[value!] || 'warpNone'}`;
}

// BlnM.Mltp | BlnM.Nrml | ...
const BlnM: Dict = {
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
};

const BlnMRev = revMap(BlnM);

function toBlendMode(value: string): string {
	return (BlnMRev[value.split('.')[1]] as any) || 'normal';
}

function fromBlendMode(value: string | undefined) {
	return `BlnM.${BlnM[value!] || 'Nrml'}`;
}

// BESl.InrB | BESl.OtrB | ...
const BESl: Dict = {
	'inner bevel': 'InrB',
	'outer bevel': 'OtrB',
	'emboss': 'Embs',
	'pillow emboss': 'PlEb',
	'stroke emboss': 'strokeEmboss',
};

const BESlRev = revMap(BESl);

function toBevelStyle(value: string): BevelStyle {
	return (BESlRev[value.split('.')[1]] as any) || 'inner bevel';
}

function fromBevelStyle(value: BevelStyle | undefined) {
	return `BESl.${BESl[value!] || 'InrB'}`;
}

// bvlT.SfBL | bvlT.PrBL | ...
const bvlT: Dict = {
	'smooth': 'SfBL',
	'chisel hard': 'PrBL',
	'chisel soft': 'Slmt',
};

const bvlTRev = revMap(bvlT);

function toBevelTechnique(value: string): BevelTechnique {
	return (bvlTRev[value.split('.')[1]] as any) || 'smooth';
}

function fromBevelTechnique(value: BevelTechnique | undefined) {
	return `bvlT.${bvlT[value!] || 'SfBL'}`;
}

// BESs.In | BESs.Out
const BESs: Dict = {
	'up': 'In  ',
	'down': 'Out ',
};

const BESsRev = revMap(BESs);

function toBevelDirection(value: string): BevelDirection {
	return (BESsRev[value.split('.')[1]] as any) || 'up';
}

function fromBevelDirection(value: BevelTechnique | undefined) {
	return `BESs.${BESs[value!] || 'In  '}`;
}

// BETE.SfBL | BETE.PrBL
const BETE: Dict = {
	'softer': 'SfBL',
	'precise': 'PrBL',
};

const BETERev = revMap(BETE);

function toGlowTechnique(value: string): GlowTechnique {
	return (BETERev[value.split('.')[1]] as any) || 'softer';
}

function fromGlowTechnique(value: GlowTechnique | undefined) {
	return `BETE.${BETE[value!] || 'SfBL'}`;
}

// IGSr.SrcE | IGSr.SrcC
const IGSr: Dict = {
	'edge': 'SrcE',
	'center': 'SrcC',
};

const IGSrRev = revMap(IGSr);

function toGlowSource(value: string): GlowSource {
	return (IGSrRev[value.split('.')[1]] as any) || 'edge';
}

function fromGlowSource(value: GlowSource | undefined) {
	return `IGSr.${IGSr[value!] || 'SrcE'}`;
}

const GrdT: Dict = {
	'linear': 'Lnr ',
	'radial': 'Rdl ',
	'angle': 'Angl',
	'reflected': 'Rflc',
	'diamond': 'Dmnd',
};

const GrdTRev = revMap(GrdT);

function toGradientType(value: string): GradientType {
	return (GrdTRev[value.split('.')[1]] as any) || 'linear';
}

function fromGradientType(value: GradientType | undefined) {
	return `GrdT.${GrdT[value!] || 'Lnr '}`;
}

const ClrS: Dict = {
	'rgb': 'ClrS.RGBC',
	'hsb': 'ClrS.HSBl',
	'lab': 'ClrS.LbCl',
};

const ClrSRev = revMap(ClrS);

const GrdF: Dict = {
	'solid': 'GrdF.CstS',
	'noise': 'GrdF.ClNs',
}

const GrdFRev = revMap(GrdF);

addHandler(
	'TySh',
	target => target.text !== undefined,
	(reader, target) => {
		const version = readInt16(reader);

		if (version !== 1) {
			throw new Error(`Invalid TySh version: ${version}`);
		}

		const transform = [
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
			readFloat64(reader),
		];

		const textVersion = readInt16(reader);
		const descriptorVersion = readInt32(reader);

		if (textVersion !== 50 || descriptorVersion !== 16) {
			throw new Error(`Invalid TySh text version: ${textVersion}/${descriptorVersion}`);
		}

		const text: TextDescriptor = readDescriptorStructure(reader);

		// console.log('EngineData:', JSON.stringify(parseEngineData(text.EngineData), null, 2), '\n');

		const warpVersion = readInt16(reader);
		const warpDescriptorVersion = readInt32(reader);

		if (warpVersion !== 1 || warpDescriptorVersion !== 16) {
			throw new Error(`Invalid TySh warp version: ${warpVersion} ${warpDescriptorVersion}`);
		}

		const warp: WarpDescriptor = readDescriptorStructure(reader);

		const left = readInt32(reader);
		const top = readInt32(reader);
		const right = readInt32(reader);
		const bottom = readInt32(reader);

		target.text = {
			transform, left, top, right, bottom,
			text: text['Txt '],
			index: text.TextIndex || 0,
			gridding: toTextGridding(text.textGridding),
			antialias: toAntialias(text.AntA),
			orientation: toOrientation(text.Ornt),
			warp: {
				style: toWarpStyle(warp.warpStyle),
				value: warp.warpValue || 0,
				perspective: warp.warpPerspective || 0,
				perspectiveOther: warp.warpPerspectiveOther || 0,
				rotate: toOrientation(warp.warpRotate),
			},
		};
	},
	(writer, target) => {
		const text = target.text!;
		const warp = text.warp || {};
		const transform = text.transform || [1, 0, 0, 1, 0, 0];

		const textDescriptor: TextDescriptor = {
			'Txt ': text.text,
			textGridding: fromTextGridding(text.gridding),
			Ornt: fromOrientation(text.orientation),
			AntA: fromAntialias(text.antialias),
			TextIndex: text.index || 0,
		};

		const warpDescriptor: WarpDescriptor = {
			warpStyle: fromWarpStyle(warp.style),
			warpValue: warp.value || 0,
			warpPerspective: warp.perspective || 0,
			warpPerspectiveOther: warp.perspectiveOther || 0,
			warpRotate: fromOrientation(warp.rotate),
		};

		writeInt16(writer, 1); // version

		for (let i = 0; i < 6; i++) {
			writeFloat64(writer, transform[i] || 0);
		}

		writeInt16(writer, 50); // text version
		writeInt32(writer, 16); // text descriptor version

		writeDescriptorStructure(writer, '', 'TxLr', textDescriptor);

		writeInt16(writer, 1); // warp version
		writeInt32(writer, 16); // warp descriptor version

		writeDescriptorStructure(writer, '', 'warp', warpDescriptor);

		writeInt32(writer, text.left || 0);
		writeInt32(writer, text.top || 0);
		writeInt32(writer, text.right || 0);
		writeInt32(writer, text.bottom || 0);
	},
);

addHandler(
	'luni',
	target => target.name !== undefined,
	(reader, target, left) => {
		target.name = readUnicodeString(reader);
		skipBytes(reader, left()); // TEMP: skipping
	},
	(writer, target) => {
		writeUnicodeString(writer, target.name!);
	}
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
			const signature = readSignature(reader);

			if (signature !== '8BIM')
				throw new Error(`Invalid signature: '${signature}'`);

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
		const item: any = {};

		item.type = readUint32(reader);

		if (left()) {
			checkSignature(reader, '8BIM');
			item.key = readSignature(reader);
		}

		if (left()) {
			// 0 = normal
			// 1 = scene group, affects the animation timeline.
			item.subType = readUint32(reader);
		}

		target.sectionDivider = item;
	},
	(writer, target) => {
		writeUint32(writer, target.sectionDivider!.type);

		if (target.sectionDivider!.key) {
			writeSignature(writer, '8BIM');
			writeSignature(writer, target.sectionDivider!.key!);

			if (target.sectionDivider!.subtype !== undefined) {
				writeUint32(writer, target.sectionDivider!.subtype!);
			}
		}
	},
);

addHandler(
	'lyvr',
	target => target.version !== undefined,
	(reader, target) => {
		target.version = readUint32(reader);
	},
	(writer, target) => {
		writeUint32(writer, target.version!);
	},
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

/*addHandler(
	'Txt2',
	target => !!(target as any)['__Txt2'], // target.text !== undefined,
	(reader, target, left) => {
		const data = readBytes(reader, left());
		const engineData = parseEngineData(data);
		(target as any)['__Txt2'] = engineData;
		// (target as any)['__Txt2'] = Array.from(textEngineData);
		// const ed2 = require('parse-engine-data')(textEngineData);
		// console.log(ed2);

		// require('fs').writeFileSync('test_data.json', JSON.stringify(ed, null, 2), 'utf8');
		// require('fs').writeFileSync('test_data2.json', JSON.stringify(ed2, null, 2), 'utf8');
		
		if (!Date.now()) console.log('Txt2:textEngineData', JSON.stringify(engineData, null, 2));
	},
	(writer, target) => {
		// const buffer = new Uint8Array((target as any)['__Txt2']);
		const buffer = serializeEngineData((target as any)['__Txt2'], true);
		writeBytes(writer, buffer);
	},
);*/

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
		writeColor(writer, target.filterMask!.colorSpace || [0, 0, 0, 0]);
		writeUint16(writer, (target.filterMask!.opacity || 0) * 0xff);
	},
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

function parseUnitsValue({ units, value }: { units: string; value: number; }) {
	return units === 'Percent' ? value / 100 : value;
}

function unitsValue(units: string, value: number) {
	return {
		units,
		value: units === 'Percent' ? Math.round(value * 100) : value,
	};
}

function parseColor(value: any) {
	return [
		value['Rd  '] || 0,
		value['Grn '] || 0,
		value['Bl  '] || 0,
		255,
	];
}

function serializeColor(value: number[]) {
	return {
		'Rd  ': value[0] || 0,
		'Grn ': value[1] || 0,
		'Bl  ': value[2] || 0,
	};
}

type AllEffects = LayerEffectsShadow & LayerEffectsOuterGlow &
	LayerEffectsInnerGlow & LayerEffectsBevel & LayerEffectsSolidFill &
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
			case 'Md  ': result.blendMode = toBlendMode(val); break;
			case 'hglM': result.highlightBlendMode = toBlendMode(val); break;
			case 'sdwM': result.shadowBlendMode = toBlendMode(val); break;
			case 'bvlS': result.style = toBevelStyle(val); break;
			case 'bvlD': result.direction = toBevelDirection(val); break;
			case 'bvlT': result.technique = toBevelTechnique(val) as any; break;
			case 'GlwT': result.technique = toGlowTechnique(val) as any; break;
			case 'glwS': result.source = toGlowSource(val); break;
			case 'Type': result.type = toGradientType(val); break;
			case 'Opct': result.opacity = parseUnitsValue(val); break;
			case 'hglO': result.highlightOpacity = parseUnitsValue(val); break;
			case 'sdwO': result.shadowOpacity = parseUnitsValue(val); break;
			case 'lagl': result.angle = parseUnitsValue(val); break;
			case 'Angl': result.angle = parseUnitsValue(val); break;
			case 'Lald': result.altitude = parseUnitsValue(val); break;
			case 'Sftn': result.soften = parseUnitsValue(val); break;
			case 'srgR': result.strength = parseUnitsValue(val); break;
			case 'blur': result.size = parseUnitsValue(val); break;
			case 'Nose': result.noise = parseUnitsValue(val); break;
			case 'Inpr': result.range = parseUnitsValue(val); break;
			case 'Ckmt': result.choke = parseUnitsValue(val); break;
			case 'ShdN': result.jitter = parseUnitsValue(val); break;
			case 'Dstn': result.distance = parseUnitsValue(val); break;
			case 'Scl ': result.scale = parseUnitsValue(val); break;
			case 'Ptrn': result.pattern = { name: val['Nm  '], id: val['Idnt'] }; break;
			case 'phase': result.phase = { x: val['Hrzn'], y: val['Vrtc'] }; break;
			case 'Ofst':
				result.offset = {
					x: parseUnitsValue(val['Hrzn']),
					y: parseUnitsValue(val['Vrtc'])
				};
				break;
			case 'MpgS':
			case 'TrnS': {
				result.contour = {
					name: val['Nm  '],
					curve: (val['Crv '] as any[]).map(p => ({ x: p.Hrzn, y: p.Vrtc })),
				};
				break;
			}
			case 'Grad': {
				const name = val['Nm  '];
				const type = GrdFRev[val['GrdF']];

				if (type === 'solid') {
					const samples: number = val.Intr || 4096;
					const gradient: EffectSolidGradient = {
						name,
						type,
						smoothness: val.Intr / 4096,
						colorStops: (val['Clrs'] as any[]).map(s => ({
							color: parseColor(s['Clr ']),
							location: s['Lctn'] / samples,
							midpoint: s['Mdpn'] / 100,
						})),
						opacityStops: (val['Trns'] as any[]).map(s => ({
							opacity: parseUnitsValue(s.Opct),
							location: s['Lctn'] / samples,
							midpoint: s['Mdpn'] / 100,
						})),
					};
					result.gradient = gradient;
				} else if (type === 'noise') {
					const gradient: EffectNoiseGradient = {
						name,
						type,
						roughness: val.Smth / 4096,
						colorModel: ClrSRev[val['ClrS']] as any,
						randomSeed: val['RndS'],
						restrictColors: !!val['VctC'],
						addTransparency: !!val['ShTr'],
						min: (val['Mnm '] as number[]).map(x => x / 100),
						max: (val['Mxm '] as number[]).map(x => x / 100),
					}
					result.gradient = gradient;
				} else {
					console.log(`Invalid gradient type: ${val['GrdF']}`);
				}
				break;
			}
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
			case 'enabled': result['enab'] = !!val; break;
			case 'useGlobalLight': result['uglg'] = !!val; break;
			case 'antialiased': result['AntA'] = !!val; break;
			case 'align': result['Algn'] = !!val; break;
			case 'dither': result['Dthr'] = !!val; break;
			case 'invert': result['Invr'] = !!val; break;
			case 'reverse': result['Rvrs'] = !!val; break;
			case 'color': result['Clr '] = serializeColor(val); break;
			case 'highlightColor': result['hglC'] = serializeColor(val); break;
			case 'shadowColor': result['sdwC'] = serializeColor(val); break;
			case 'blendMode': result['Md  '] = fromBlendMode(val); break;
			case 'highlightBlendMode': result['hglM'] = fromBlendMode(val); break;
			case 'shadowBlendMode': result['sdwM'] = fromBlendMode(val); break;
			case 'style': result['bvlS'] = fromBevelStyle(val); break;
			case 'direction': result['bvlD'] = fromBevelDirection(val); break;
			case 'technique':
				if (objName === 'bevel') {
					result['bvlT'] = fromBevelTechnique(val);
				} else {
					result['GlwT'] = fromGlowTechnique(val);
				}
				break;
			case 'source': result['glwS'] = fromGlowSource(val); break;
			case 'type': result['Type'] = fromGradientType(val); break;
			case 'opacity': result['Opct'] = unitsValue('Percent', val); break;
			case 'highlightOpacity': result['hglO'] = unitsValue('Percent', val); break;
			case 'shadowOpacity': result['sdwO'] = unitsValue('Percent', val); break;
			case 'angle':
				if (objName === 'gradientOverlay') {
					result['Angl'] = unitsValue('Angle', val);
				} else {
					result['lagl'] = unitsValue('Angle', val);
				}
				break;
			case 'altitude': result['Lald'] = unitsValue('Angle', val); break;
			case 'soften': result['Sftn'] = unitsValue('Pixels', val); break;
			case 'strength': result['srgR'] = unitsValue('Percent', val); break;
			case 'size': result['blur'] = unitsValue('Pixels', val); break;
			case 'noise': result['Nose'] = unitsValue('Percent', val); break;
			case 'range': result['Inpr'] = unitsValue('Percent', val); break;
			case 'choke': result['Ckmt'] = unitsValue('Pixels', val); break;
			case 'jitter': result['ShdN'] = unitsValue('Percent', val); break;
			case 'distance': result['Dstn'] = unitsValue('Pixels', val); break;
			case 'scale': result['Scl '] = unitsValue('Percent', val); break;
			case 'pattern': result['Ptrn'] = { name: val['Nm  '], id: val['Idnt'] }; break;
			case 'phase': result['phase'] = { x: val['Hrzn'], y: val['Vrtc'] }; break;
			case 'offset':
				result['Ofst'] = {
					Hrzn: unitsValue('Percent', val.x),
					Vrtc: unitsValue('Percent', val.y),
				};
				break;
			case 'contour': {
				result[objName === 'satin' ? 'MpgS' : 'TrnS'] = {
					'Nm  ': (val as EffectContour).name,
					'Crv ': (val as EffectContour).curve.map(p => ({ Hrzn: p.x, Vrtc: p.y })),
				};
				break;
			}
			case 'gradient': {
				const grad = val as EffectSolidGradient | EffectNoiseGradient;

				if (grad.type === 'solid') {
					const samples = Math.round((grad.smoothness ?? 1) * 4096);

					result['Grad'] = {
						'Nm  ': grad.name,
						GrdF: GrdF['solid'],
						Intr: samples,
						Clrs: grad.colorStops.map(s => ({
							'Clr ': serializeColor(s.color || [0, 0, 0, 0]),
							Type: 'Clry.UsrS',
							Lctn: Math.round(s.location * samples),
							Mdpn: Math.round((s.midpoint ?? 0.5) * 100),
						})),
						Trns: grad.opacityStops.map(s => ({
							Opct: unitsValue('Percent', s.opacity),
							Lctn: Math.round(s.location * samples),
							Mdpn: Math.round((s.midpoint ?? 0.5) * 100),
						})),
					};
				} else if (grad.type === 'noise') {
					result['Grad'] = {
						'Nm  ': grad.name,
						GrdF: GrdF['noise'],
						ShTr: !!grad.addTransparency,
						VctC: !!grad.restrictColors,
						ClrS: ClrS[grad.colorModel || 'rgb'],
						RndS: grad.randomSeed || 0,
						Smth: Math.round((grad.roughness ?? 1) * 4096),
						'Mnm ': (grad.min || [0, 0, 0, 0]).map((x: number) => x * 100),
						'Mxm ': (grad.max || [1, 1, 1, 1]).map((x: number) => x * 100),
					}
				}
				break;
			}
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

addHandler(
	'lfx2',
	target => target.effects !== undefined,
	(reader, target, left) => {
		const version = readUint32(reader);
		const descriptorVersion = readUint32(reader);

		if (version !== 0 || descriptorVersion !== 16) {
			throw new Error(`Invalid lfx2 version: ${version} ${descriptorVersion}`);
		}

		target.effects = {}; // discard if read in 'lrFX' section

		const info = readDescriptorStructure(reader);

		if (!info.masterFXSwitch) target.effects.disabled = true;
		if (info['Scl ']) target.effects.scale = parseUnitsValue(info['Scl ']);
		if (info.DrSh) target.effects.dropShadow = parseEffectObject(info.DrSh);
		if (info.IrSh) target.effects.innerShadow = parseEffectObject(info.IrSh);
		if (info.OrGl) target.effects.outerGlow = parseEffectObject(info.OrGl);
		if (info.IrGl) target.effects.innerGlow = parseEffectObject(info.IrGl);
		if (info.ebbl) target.effects.bevel = parseEffectObject(info.ebbl);
		if (info.SoFi) target.effects.solidFill = parseEffectObject(info.SoFi);
		if (info.patternFill) target.effects.patternOverlay = parseEffectObject(info.patternFill);
		if (info.GrFl) target.effects.gradientOverlay = parseEffectObject(info.GrFl);
		if (info.ChFX) target.effects.satin = parseEffectObject(info.ChFX);

		skipBytes(reader, left());
	},
	(writer, target) => {
		writeUint32(writer, 0); // version
		writeUint32(writer, 16); // descriptorVersion

		const effects = target.effects!;
		const info: any = {
			masterFXSwitch: !effects.disabled,
			'Scl ': unitsValue('Percent', effects.scale ?? 1),
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

		writeDescriptorStructure(writer, '', 'null', info);
	},
);
