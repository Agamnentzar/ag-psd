export const fromBlendMode: { [key: string]: string } = {};
export const toBlendMode: { [key: string]: string } = {
	'pass': 'pass through',
	'norm': 'normal',
	'diss': 'dissolve',
	'dark': 'darken',
	'mul ': 'multiply',
	'idiv': 'color burn',
	'lbrn': 'linear burn',
	'dkCl': 'darker color',
	'lite': 'lighten',
	'scrn': 'screen',
	'div ': 'color dodge',
	'lddg': 'linear dodge',
	'lgCl': 'lighter color',
	'over': 'overlay',
	'sLit': 'soft light',
	'hLit': 'hard light',
	'vLit': 'vivid light',
	'lLit': 'linear light',
	'pLit': 'pin light',
	'hMix': 'hard mix',
	'diff': 'difference',
	'smud': 'exclusion',
	'fsub': 'subtract',
	'fdiv': 'divide',
	'hue ': 'hue',
	'sat ': 'saturation',
	'colr': 'color',
	'lum ': 'luminosity',
};

Object.keys(toBlendMode).forEach(key => fromBlendMode[toBlendMode[key]] = key);

// export const enum ColorSpace {
// 	RGB = 0,
// 	HSB = 1,
// 	CMYK = 2,
// 	Lab = 7,
// 	Grayscale = 8,
// }

export const enum ColorMode {
	Bitmap = 0,
	Grayscale = 1,
	Indexed = 2,
	RGB = 3,
	CMYK = 4,
	Multichannel = 7,
	Duotone = 8,
	Lab = 9,
}

export const enum ChannelID {
	Red = 0,
	Green = 1,
	Blue = 2,
	Transparency = -1,
	UserMask = -2,
	RealUserMask = -3,
}

export const enum Compression {
	RawData = 0,
	RleCompressed = 1,
	ZipWithoutPrediction = 2,
	ZipWithPrediction = 3,
}

export const enum SectionDividerType {
	Other = 0,
	OpenFolder = 1,
	ClosedFolder = 2,
	BoundingSectionDivider = 3,
}

export type Color = number[]; // [r, g, b, a]

export interface EffectContour {
	name: string;
	curve: { x: number; y: number; }[];
}

export interface EffectPattern {
	name: string;
	id: string;
}

export interface LayerEffectsShadow {
	size: number;
	angle: number;
	distance: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	opacity: number;
	useGlobalLight?: boolean;
	antialiased?: boolean;
	contour?: EffectContour;
	layerConceals?: boolean; // only drop shadow
}

export interface LayerEffectsOuterGlow {
	size: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	opacity: number;

	source?: GlowSource;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: number;
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectsInnerGlow {
	size: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	opacity: number;

	source?: GlowSource;
	technique?: GlowTechnique;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: number;
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectsBevel {
	angle: number;
	strength: number; // depth (rename ?)
	size: number;
	highlightBlendMode: string;
	shadowBlendMode: string;
	highlightColor: Color;
	shadowColor: Color;
	style: BevelStyle;
	highlightOpacity: number;
	shadowOpacity: number;
	enabled: boolean;

	soften?: number;
	useGlobalLight?: boolean;
	altitude?: number;
	technique?: BevelTechnique;
	direction?: BevelDirection;
	useTexture?: boolean;
	useShape?: boolean;
	antialiasGloss?: boolean;
	contour?: EffectContour;
}

export interface LayerEffectsSolidFill {
	blendMode: string;
	color: Color;
	opacity: number;
	enabled: boolean;
}

export interface LayerEffectSatin {
	enabled?: boolean;
	blendMode?: string;
	color?: Color;
	antialiased?: boolean;
	opacity?: number;
	distance?: number;
	size?: number;
	invert?: boolean;
	angle?: number;
	contour?: EffectContour;
}

// not supported yet because of `Patt` section not implemented
export interface LayerEffectPatternOverlay {
	enabled?: boolean;
	blendMode?: string;
	opacity?: number;
	scale?: number;
	pattern?: EffectPattern;
	phase?: { x: number; y: number; };
	align?: boolean;
}

export interface EffectSolidGradient {
	name: string;
	type: 'solid';
	smoothness?: number;
	colorStops: { color: Color; location: number; midpoint: number; }[];
	opacityStops: { opacity: number; location: number; midpoint: number; }[];
}

export interface EffectNoiseGradient {
	name: string;
	type: 'noise';
	roughness?: number;
	colorModel?: 'rgb' | 'hsb' | 'lab';
	randomSeed?: number;
	restrictColors?: boolean;
	addTransparency?: boolean;
	min: number[];
	max: number[];
}

export interface LayerEffectGradientOverlay {
	enabled?: boolean;
	blendMode?: string;
	opacity?: number;
	align?: boolean;
	scale?: number;
	dither?: boolean;
	reverse?: boolean;
	type?: GradientType;
	offset?: { x: number; y: number; };
	gradient?: EffectSolidGradient | EffectNoiseGradient;
}

export interface LayerEffectsInfo {
	disabled?: boolean;
	scale?: number;
	dropShadow?: LayerEffectsShadow;
	innerShadow?: LayerEffectsShadow;
	outerGlow?: LayerEffectsOuterGlow;
	innerGlow?: LayerEffectsInnerGlow;
	bevel?: LayerEffectsBevel;
	solidFill?: LayerEffectsSolidFill;
	satin?: LayerEffectSatin;
	gradientOverlay?: LayerEffectGradientOverlay;
	patternOverlay?: LayerEffectPatternOverlay; // not supported yet because of `Patt` section not implemented
}

export interface LayerMaskData {
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
	defaultColor?: number;
	disabled?: boolean;
	positionRelativeToLayer?: boolean;
	userMaskDensity?: number;
	userMaskFeather?: number;
	vectorMaskDensity?: number;
	vectorMaskFeather?: number;
	canvas?: HTMLCanvasElement;
}

export type TextGridding = 'none';
export type Orientation = 'horizontal' | 'vertical';
export type Antialias = 'none' | 'sharp' | 'crisp' | 'strong' | 'smooth';
export type WarpStyle =
	'none' | 'arc' | 'arcLower' | 'arcUpper' | 'arch' | 'bulge' | 'shellLower' | 'shellUpper' | 'flag' |
	'wave' | 'fish' | 'rise' | 'fisheye' | 'inflate' | 'squeeze' | 'twist';
export type BevelStyle = 'outer bevel' | 'inner bevel' | 'emboss' | 'pillow emboss' | 'stroke emboss';
export type BevelTechnique = 'smooth' | 'chisel hard' | 'chisel soft';
export type BevelDirection = 'up' | 'down';
export type GlowTechnique = 'softer' | 'precise';
export type GlowSource = 'edge' | 'center';
export type GradientType = 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';

export interface LayerTextWarp {
	style?: WarpStyle;
	value?: number;
	perspective?: number;
	perspectiveOther?: number;
	rotate?: Orientation;
}

export interface LayerTextData {
	transform?: number[];
	text: string;
	gridding?: TextGridding;
	orientation?: Orientation;
	antialias?: Antialias;
	index?: number;
	warp?: LayerTextWarp;
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
}

export interface PatternInfo {
	name: string;
	id: string;
	colorMode: ColorMode;
	x: number;
	y: number;
}

export interface LayerAdditionalInfo {
	name?: string; // layer name
	nameSource?: string; // layer name source
	id?: number; // layer id
	version?: number; // layer version
	mask?: LayerMaskData;
	blendClippendElements?: boolean;
	blendInteriorElements?: boolean;
	knockout?: boolean;
	protected?: {
		transparency?: boolean;
		composite?: boolean;
		position?: boolean;
	};
	sheetColors?: {
		color1: number;
		color2: number;
	};
	referencePoint?: {
		x: number;
		y: number;
	};
	sectionDivider?: {
		type: SectionDividerType;
		key?: string;
		subtype?: number;
	};
	filterMask?: {
		colorSpace: Color;
		opacity: number;
	};
	metadata?: {
		key: string;
		copy: boolean;
		data: number[];
	}[];
	effects?: LayerEffectsInfo;
	text?: LayerTextData; // not supported yet
	patterns?: PatternInfo[]; // not supported yet
}

export type ResolutionUnit = 'PPI' | 'PPCM';
export type SizeUnit = 'Inches' | 'Centimeters' | 'Points' | 'Picas' | 'Columns';

export interface ImageResources {
	layerState?: number;
	layersGroup?: number[];
	layerSelectionIds?: number[];
	layerGroupsEnabledId?: number[];
	versionInfo?: {
		version: number;
		hasRealMergedData: boolean;
		writerName: string;
		readerName: string;
		fileVersion: number;
	};
	alphaIdentifiers?: number[];
	alphaChannelNames?: string[];
	unicodeAlphaNames?: string[];
	globalAngle?: number;
	globalAltitude?: number;
	pixelAspectRatio?: {
		version: number;
		aspect: number;
	};
	urlsList?: any[];
	gridAndGuidesInformation?: {
		grid?: {
			horizontal: number;
			vertical: number;
		},
		guides?: {
			location: number;
			direction: 'horizontal' | 'vertical';
		}[];
	};
	resolutionInfo?: {
		horizontalResolution: number;
		horizontalResolutionUnit: ResolutionUnit;
		widthUnit: SizeUnit;
		verticalResolution: number;
		verticalResolutionUnit: ResolutionUnit;
		heightUnit: SizeUnit;
	};
	thumbnail?: HTMLCanvasElement;
	captionDigest?: string;
	xmpMetadata?: string;
	printScale?: {
		style?: 'centered' | 'size to fit' | 'user defined';
		x?: number;
		y?: number;
		scale?: number;
	};
	// printInformation?: {
	// 	// psts?: boolean;
	// 	// inte?: string;
	// 	// printSixteenBit?: boolean;
	// 	printerName?: string;
	// 	// bltn?: string;
	// };
}

export interface Layer extends LayerAdditionalInfo {
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
	blendMode?: string;
	opacity?: number;
	transparencyProtected?: boolean;
	hidden?: boolean;
	clipping?: boolean;
	canvas?: HTMLCanvasElement;
	children?: Layer[];
	/** applies only for layer groups */
	opened?: boolean;
}

export interface Psd extends LayerAdditionalInfo {
	width: number;
	height: number;
	channels?: number;
	bitsPerChannel?: number;
	colorMode?: ColorMode;
	children?: Layer[];
	canvas?: HTMLCanvasElement;
	imageResources?: ImageResources;
}

export interface ReadOptions {
	/** does not load layer image data */
	skipLayerImageData?: boolean;
	/** does not load composite image data */
	skipCompositeImageData?: boolean;
	/** does not load thumbnail */
	skipThumbnail?: boolean;
	/** throws exception if features are missing */
	throwForMissingFeatures?: boolean;
	/** logs if features are missing */
	logMissingFeatures?: boolean;
}

export interface WriteOptions {
	/** automatically generates thumbnail from composite image */
	generateThumbnail?: boolean;
	/** trims transparent pixels from layer image data */
	trimImageData?: boolean;
}

export const enum LayerMaskFlags {
	PositionRelativeToLayer = 1,
	LayerMaskDisabled = 2,
	InvertLayerMaskWhenBlending = 4, // obsolete
	LayerMaskFromRenderingOtherData = 8,
	MaskHasParametersAppliedToIt = 16,
}

export const enum MaskParameters {
	UserMaskDensity = 1,
	UserMaskFeather = 2,
	VectorMaskDensity = 4,
	VectorMaskFeather = 8,
}
