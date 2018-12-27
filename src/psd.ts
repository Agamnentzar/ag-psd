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

export type Color = number[]; // TEMP: add color parsing into better structure

export interface LayerEffectsShadowInfo {
	blur: number;
	intensity: number;
	angle: number;
	distance: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	useAngleInAllEffects: boolean;
	opacity: number;
	nativeColor?: Color;
}

export interface LayerEffectsOuterGlowInfo {
	blur: number;
	intensity: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	opacity: number;
	nativeColor?: Color;
}

export interface LayerEffectsInnerGlowInfo {
	blur: number;
	intensity: number;
	color: Color;
	blendMode: string;
	enabled: boolean;
	opacity: number;
	invert?: boolean;
	nativeColor?: Color;
}

export interface LayerEffectsBevelInfo {
	angle: number;
	strength: number;
	blur: number;
	highlightBlendMode: string;
	shadowBlendMode: string;
	highlightColor: Color;
	shadowColor: Color;
	bevelStyle: number;
	highlightOpacity: number;
	shadowOpacity: number;
	enabled: boolean;
	useAngleInAllEffects: boolean;
	up: boolean;
	realHighlightColor?: Color;
	realShadowColor?: Color;
}

export interface LayerEffectsSolidFillInfo {
	blendMode: string;
	color: Color;
	opacity: number;
	enabled: boolean;
	nativeColor?: Color;
}

export interface LayerEffectsInfo {
	dropShadow?: LayerEffectsShadowInfo;
	innerShadow?: LayerEffectsShadowInfo;
	outerGlow?: LayerEffectsOuterGlowInfo;
	innerGlow?: LayerEffectsInnerGlowInfo;
	bevel?: LayerEffectsBevelInfo;
	solidFill?: LayerEffectsSolidFillInfo;
}

export interface LayerAdditionalInfo {
	name?: string; // layer name
	nameSource?: string; // layer name source
	id?: number; // layer id
	version?: number; // layer version
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
	objectBasedEffectsLayerInfo?: any;
	// typeToolObjectSetting?: any;
	// textEngineData?: number[];
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
		version?: number;
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
}

export interface WriteOptions {
	/** automatically generates thumbnail from composite image */
	generateThumbnail?: boolean;
	/** trims transparent pixels from layer image data */
	trimImageData?: boolean;
}
