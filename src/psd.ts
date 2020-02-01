export type BlendMode = 'pass through' | 'normal' | 'dissolve' | 'darken' | 'multiply' |
	'color burn' | 'linear burn' | 'darker color' | 'lighten' | 'screen' | 'color dodge' |
	'linear dodge' | 'lighter color' | 'overlay' | 'soft light' | 'hard light' |
	'vivid light' | 'linear light' | 'pin light' | 'hard mix' | 'difference' | 'exclusion'
	| 'subtract' | 'divide' | 'hue' | 'saturation' | 'color' | 'luminosity';

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
	size: UnitsValue;
	angle: number;
	distance: UnitsValue;
	color: Color;
	blendMode: BlendMode;
	enabled: boolean;
	opacity: number;
	useGlobalLight?: boolean;
	antialiased?: boolean;
	contour?: EffectContour;
	layerConceals?: boolean; // only drop shadow
}

export interface LayerEffectsOuterGlow {
	size: UnitsValue;
	color: Color;
	blendMode: BlendMode;
	enabled: boolean;
	opacity: number;

	source?: GlowSource;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: UnitsValue;
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectsInnerGlow {
	size: UnitsValue;
	color: Color;
	blendMode: BlendMode;
	enabled: boolean;
	opacity: number;

	source?: GlowSource;
	technique?: GlowTechnique;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: UnitsValue;
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectsBevel {
	size: UnitsValue;
	angle: number;
	strength: number; // depth
	highlightBlendMode: BlendMode;
	shadowBlendMode: BlendMode;
	highlightColor: Color;
	shadowColor: Color;
	style: BevelStyle;
	highlightOpacity: number;
	shadowOpacity: number;
	enabled: boolean;
	soften?: UnitsValue;
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
	blendMode: BlendMode;
	color: Color;
	opacity: number;
	enabled: boolean;
}

export interface LayerEffectSatin {
	size?: UnitsValue;
	enabled?: boolean;
	blendMode?: BlendMode;
	color?: Color;
	antialiased?: boolean;
	opacity?: number;
	distance?: UnitsValue;
	invert?: boolean;
	angle?: number;
	contour?: EffectContour;
}

// not supported yet because of `Patt` section not implemented
export interface LayerEffectPatternOverlay {
	enabled?: boolean;
	blendMode?: BlendMode;
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
	type?: GradientStyle;
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
	imageData?: ImageData;
}

export type TextGridding = 'none'; // TODO: other values
export type Orientation = 'horizontal' | 'vertical';
export type AntiAlias = 'none' | 'sharp' | 'crisp' | 'strong' | 'smooth';
export type WarpStyle =
	'none' | 'arc' | 'arcLower' | 'arcUpper' | 'arch' | 'bulge' | 'shellLower' | 'shellUpper' | 'flag' |
	'wave' | 'fish' | 'rise' | 'fisheye' | 'inflate' | 'squeeze' | 'twist';
export type BevelStyle = 'outer bevel' | 'inner bevel' | 'emboss' | 'pillow emboss' | 'stroke emboss';
export type BevelTechnique = 'smooth' | 'chisel hard' | 'chisel soft';
export type BevelDirection = 'up' | 'down';
export type GlowTechnique = 'softer' | 'precise';
export type GlowSource = 'edge' | 'center';
export type GradientStyle = 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
export type Justification = 'left' | 'right' | 'center';
export type LineCapType = 'butt' | 'round' | 'square';
export type LineJoinType = 'miter' | 'round' | 'bevel';
export type LineAlignment = 'inside' | 'center' | 'outside';

export interface LayerTextWarp {
	style?: WarpStyle;
	value?: number;
	perspective?: number;
	perspectiveOther?: number;
	rotate?: Orientation;
}

export interface Font {
	name: string;
	script?: number;
	type?: number;
	synthetic?: number;
}

export interface ParagraphStyle {
	justification?: Justification;
	firstLineIndent?: number;
	startIndent?: number;
	endIndent?: number;
	spaceBefore?: number;
	spaceAfter?: number;
	autoHyphenate?: boolean;
	hyphenatedWordSize?: number;
	preHyphen?: number;
	postHyphen?: number;
	consecutiveHyphens?: number;
	zone?: number;
	wordSpacing?: number[];
	letterSpacing?: number[];
	glyphSpacing?: number[];
	autoLeading?: number;
	leadingType?: number;
	hanging?: boolean;
	burasagari?: boolean;
	kinsokuOrder?: number;
	everyLineComposer?: boolean;
}

export interface ParagraphStyleRun {
	length: number;
	style: ParagraphStyle;
}

export interface TextStyle {
	font?: Font;
	fontSize?: number;
	fauxBold?: boolean;
	fauxItalic?: boolean;
	autoLeading?: boolean;
	leading?: number;
	horizontalScale?: number;
	verticalScale?: number;
	tracking?: number;
	autoKerning?: boolean;
	kerning?: number;
	baselineShift?: number;
	fontCaps?: number; // 0 - none, 1 - small caps, 2 - all caps
	fontBaseline?: number; // 0 - normal, 1 - superscript, 2 - subscript
	underline?: boolean;
	strikethrough?: boolean;
	ligatures?: boolean;
	dLigatures?: boolean;
	baselineDirection?: number;
	tsume?: number;
	styleRunAlignment?: number;
	language?: number;
	noBreak?: boolean;
	fillColor?: Color;
	strokeColor?: Color;
	fillFlag?: boolean;
	strokeFlag?: boolean;
	fillFirst?: boolean;
	yUnderline?: number;
	outlineWidth?: number;
	characterDirection?: number;
	hindiNumbers?: boolean;
	kashida?: number;
	diacriticPos?: number;
}

export interface TextStyleRun {
	length: number;
	style: TextStyle;
}

export interface TextGridInfo {
	isOn?: boolean;
	show?: boolean;
	size?: number;
	leading?: number;
	color?: Color;
	leadingFillColor?: Color;
	alignLineHeightToGridFlags?: boolean;
}

export interface LayerTextData {
	text: string;
	transform?: number[];
	antiAlias?: AntiAlias;
	gridding?: TextGridding;
	orientation?: Orientation;
	index?: number;
	warp?: LayerTextWarp;
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;

	gridInfo?: TextGridInfo;
	useFractionalGlyphWidths?: boolean;
	style?: TextStyle; // base style
	styleRuns?: TextStyleRun[]; // spans of different style
	paragraphStyle?: ParagraphStyle; // base paragraph style
	paragraphStyleRuns?: ParagraphStyleRun[]; // style for each line

	superscriptSize?: number;
	superscriptPosition?: number;
	subscriptSize?: number;
	subscriptPosition?: number;
	smallCapSize?: number;
}

export interface PatternInfo {
	name: string;
	id: string;
	colorMode: ColorMode;
	x: number;
	y: number;
}

export interface BezierKnot {
	linked: boolean;
	points: number[]; // x0, y0, x1, y1, x2, y2
}

export interface BezierPath {
	open: boolean;
	knots: BezierKnot[];
}

export interface ExtraContentInfo {
	style?: GradientStyle;
	scale?: number;
	angle?: number;
	dither?: boolean;
	reverse?: boolean;
}

export type VectorContent = { type: 'color'; color: Color; } |
	(EffectSolidGradient & ExtraContentInfo) |
	(EffectNoiseGradient & ExtraContentInfo) |
	(EffectPattern & { type: 'pattern'; });

export type Units = 'Pixels' | 'Points' | 'Picas' | 'Millimeters' | 'Centimeters' | 'Inches' | 'None';

export interface UnitsValue {
	units: Units;
	value: number;
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
		subType?: number;
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
	text?: LayerTextData;
	patterns?: PatternInfo[]; // not supported yet
	vectorFill?: VectorContent;
	vectorStroke?: {
		strokeEnabled?: boolean;
		fillEnabled?: boolean;
		lineWidth?: UnitsValue;
		lineDashOffset?: UnitsValue;
		miterLimit?: number;
		lineCapType?: LineCapType;
		lineJoinType?: LineJoinType;
		lineAlignment?: LineAlignment;
		scaleLock?: boolean;
		strokeAdjust?: boolean;
		lineDashSet?: UnitsValue[];
		blendMode?: BlendMode;
		opacity?: number;
		content?: VectorContent;
		resolution?: number;
	};
	vectorMask?: {
		invert?: boolean;
		notLink?: boolean;
		disable?: boolean;
		fillStartsWithAllPixels?: boolean;
		clipboard?: {
			top: number;
			left: number;
			bottom: number;
			right: number;
			resolution: number;
		};
		paths: BezierPath[];
	};
	usingAlignedRendering?: boolean;
	pathList?: {
	}[];

	// Base64 encoded raw EngineData, currently just kept in original state to support
	// loading and modifying PSD file without breaking text layers.
	engineData?: string;
}

export interface ImageResources {
	layerState?: number;
	layersGroup?: number[];
	layerSelectionIds?: number[];
	layerGroupsEnabledId?: number[];
	versionInfo?: {
		hasRealMergedData: boolean;
		writerName: string;
		readerName: string;
		fileVersion: number;
	};
	alphaIdentifiers?: number[];
	alphaChannelNames?: string[];
	unicodeAlphaNames?: string[]; // TODO: remove
	globalAngle?: number;
	globalAltitude?: number;
	pixelAspectRatio?: {
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
		horizontalResolutionUnit: 'PPI' | 'PPCM';
		widthUnit: 'Inches' | 'Centimeters' | 'Points' | 'Picas' | 'Columns';
		verticalResolution: number;
		verticalResolutionUnit: 'PPI' | 'PPCM';
		heightUnit: 'Inches' | 'Centimeters' | 'Points' | 'Picas' | 'Columns';
	};
	thumbnail?: HTMLCanvasElement;
	thumbnailRaw?: { width: number; height: number; data: Uint8Array; };
	captionDigest?: string;
	xmpMetadata?: string;
	printScale?: {
		style?: 'centered' | 'size to fit' | 'user defined';
		x?: number;
		y?: number;
		scale?: number;
	};
	// printInformation?: {
	// 	printerName?: string;
	//  psts?: boolean;
	//  inte?: string;
	//  printSixteenBit?: boolean;
	//  bltn?: string;
	// };
	backgroundColor?: Color;
	idsSeedNumber?: number;
	printFlags?: {
		labels?: boolean;
		cropMarks?: boolean;
		colorBars?: boolean;
		registrationMarks?: boolean;
		negative?: boolean;
		flip?: boolean;
		interpolate?: boolean;
		caption?: boolean;
		printFlags?: boolean;
	};
}

export interface Layer extends LayerAdditionalInfo {
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
	blendMode?: BlendMode;
	opacity?: number;
	transparencyProtected?: boolean;
	hidden?: boolean;
	clipping?: boolean;
	canvas?: HTMLCanvasElement;
	imageData?: ImageData;
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
	imageData?: ImageData;
	imageResources?: ImageResources;
}

export interface ReadOptions {
	/** Does not load layer image data. */
	skipLayerImageData?: boolean;
	/** Does not load composite image data. */
	skipCompositeImageData?: boolean;
	/** Does not load thumbnail. */
	skipThumbnail?: boolean;
	/** Throws exception if features are missing. */
	throwForMissingFeatures?: boolean;
	/** Logs if features are missing. */
	logMissingFeatures?: boolean;
	/** Keep image data as byte array instead of canvas.
	 * (image data will appear in `imageData` fields instead of `canvas` fields)
	 * This avoids issues with canvas premultiplied alpha corrupting image data. */
	useImageData?: boolean;
	/** Loads thumbnail raw data instead of decoding it's content into canvas. 
	 * `thumnailRaw` field is used instead. */
	useRawThumbnail?: boolean;
}

export interface WriteOptions {
	/** Automatically generates thumbnail from composite image. */
	generateThumbnail?: boolean;
	/** Trims transparent pixels from layer image data. */
	trimImageData?: boolean;
	/** Invalidates text layer data, forcing Photoshop to redraw them on load.
	 *  Use this option if you're updating loaded text layer properties. */
	invalidateTextLayers?: boolean;
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
