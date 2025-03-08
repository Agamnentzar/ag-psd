export type BlendMode = 'pass through' | 'normal' | 'dissolve' | 'darken' | 'multiply' |
	'color burn' | 'linear burn' | 'darker color' | 'lighten' | 'screen' | 'color dodge' |
	'linear dodge' | 'lighter color' | 'overlay' | 'soft light' | 'hard light' |
	'vivid light' | 'linear light' | 'pin light' | 'hard mix' | 'difference' | 'exclusion' |
	'subtract' | 'divide' | 'hue' | 'saturation' | 'color' | 'luminosity';

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

export type RGBA = { r: number; g: number; b: number; a: number; }; // values from 0 to 255
export type RGB = { r: number; g: number; b: number; }; // values from 0 to 255
export type FRGB = { fr: number; fg: number; fb: number; }; // values from 0 to 1 (can be above 1, can be negative)
export type HSB = { h: number; s: number; b: number; }; // values from 0 to 1
export type CMYK = { c: number; m: number; y: number; k: number; }; // values from 0 to 255
export type LAB = { l: number; a: number; b: number; }; // values `l` from 0 to 1; `a` and `b` from -1 to 1
export type Grayscale = { k: number }; // values from 0 to 255
export type Color = RGBA | RGB | FRGB | HSB | CMYK | LAB | Grayscale;

export interface EffectContour {
	name: string;
	curve: { x: number; y: number; }[];
}

export interface EffectPattern {
	name: string;
	id: string;
	// TODO: add fields
}

export interface LayerEffectShadow {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	size?: UnitsValue;
	angle?: number;
	distance?: UnitsValue;
	color?: Color;
	blendMode?: BlendMode;
	opacity?: number;
	useGlobalLight?: boolean;
	antialiased?: boolean;
	contour?: EffectContour;
	choke?: UnitsValue; // spread
	layerConceals?: boolean; // only drop shadow
}

export interface LayerEffectsOuterGlow {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	size?: UnitsValue;
	color?: Color;
	blendMode?: BlendMode;
	opacity?: number;
	source?: GlowSource;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: UnitsValue;
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectInnerGlow {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	size?: UnitsValue;
	color?: Color;
	blendMode?: BlendMode;
	opacity?: number;
	source?: GlowSource;
	technique?: GlowTechnique;
	antialiased?: boolean;
	noise?: number;
	range?: number;
	choke?: UnitsValue; // spread
	jitter?: number;
	contour?: EffectContour;
}

export interface LayerEffectBevel {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	size?: UnitsValue;
	angle?: number;
	strength?: number; // depth
	highlightBlendMode?: BlendMode;
	shadowBlendMode?: BlendMode;
	highlightColor?: Color;
	shadowColor?: Color;
	style?: BevelStyle;
	highlightOpacity?: number;
	shadowOpacity?: number;
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

export interface LayerEffectSolidFill {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	blendMode?: BlendMode;
	color?: Color;
	opacity?: number;
}

export interface LayerEffectStroke {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	overprint?: boolean;
	size?: UnitsValue;
	position?: 'inside' | 'center' | 'outside';
	fillType?: 'color' | 'gradient' | 'pattern';
	blendMode?: BlendMode;
	opacity?: number;
	color?: Color;
	gradient?: (EffectSolidGradient | EffectNoiseGradient) & ExtraGradientInfo;
	pattern?: EffectPattern & {}; // TODO: additional pattern info
}

export interface LayerEffectSatin {
	present?: boolean;
	showInDialog?: boolean;
	enabled?: boolean;
	size?: UnitsValue;
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
	present?: boolean;
	showInDialog?: boolean;
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
	colorStops: ColorStop[];
	opacityStops: OpacityStop[];
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
	present?: boolean;
	showInDialog?: boolean;
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
	interpolationMethod?: InterpolationMethod;
	angle?: number; // degrees
}

export interface LayerEffectsInfo {
	disabled?: boolean;
	scale?: number;
	dropShadow?: LayerEffectShadow[];
	innerShadow?: LayerEffectShadow[];
	outerGlow?: LayerEffectsOuterGlow;
	innerGlow?: LayerEffectInnerGlow;
	bevel?: LayerEffectBevel;
	solidFill?: LayerEffectSolidFill[];
	satin?: LayerEffectSatin;
	stroke?: LayerEffectStroke[];
	gradientOverlay?: LayerEffectGradientOverlay[];
	patternOverlay?: LayerEffectPatternOverlay; // not supported yet because of `Patt` section not implemented
}

export type PixelArray = Uint8ClampedArray | Uint8Array | Uint16Array | Float32Array;

export interface PixelData {
	data: PixelArray; // type depends on document bit depth
	width: number;
	height: number;
}

export interface LayerMaskData {
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
	defaultColor?: number;
	disabled?: boolean;
	positionRelativeToLayer?: boolean;
	fromVectorData?: boolean; // set to true if the mask is generated from vector data, false if it's a bitmap provided by user
	userMaskDensity?: number;
	userMaskFeather?: number; // px
	vectorMaskDensity?: number;
	vectorMaskFeather?: number;
	canvas?: HTMLCanvasElement;
	imageData?: PixelData;
}

export type TextGridding = 'none' | 'round'; // TODO: other values (no idea where to set it up in Photoshop)
export type Orientation = 'horizontal' | 'vertical';
export type AntiAlias = 'none' | 'sharp' | 'crisp' | 'strong' | 'smooth' | 'platform' | 'platformLCD';
export type WarpStyle =
	'none' | 'arc' | 'arcLower' | 'arcUpper' | 'arch' | 'bulge' | 'shellLower' | 'shellUpper' | 'flag' |
	'wave' | 'fish' | 'rise' | 'fisheye' | 'inflate' | 'squeeze' | 'twist' | 'custom' | 'cylinder';
export type BevelStyle = 'outer bevel' | 'inner bevel' | 'emboss' | 'pillow emboss' | 'stroke emboss';
export type BevelTechnique = 'smooth' | 'chisel hard' | 'chisel soft';
export type BevelDirection = 'up' | 'down';
export type GlowTechnique = 'softer' | 'precise';
export type GlowSource = 'edge' | 'center';
export type GradientStyle = 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
export type Justification = 'left' | 'right' | 'center' | 'justify-left' | 'justify-right' | 'justify-center' | 'justify-all';
export type LineCapType = 'butt' | 'round' | 'square';
export type LineJoinType = 'miter' | 'round' | 'bevel';
export type LineAlignment = 'inside' | 'center' | 'outside';
export type InterpolationMethod = 'classic' | 'perceptual' | 'linear' | 'smooth';

export interface Warp {
	style?: WarpStyle;
	value?: number;
	values?: number[];
	perspective?: number;
	perspectiveOther?: number;
	rotate?: Orientation;
	// for custom warps
	bounds?: { top: UnitsValue; left: UnitsValue; bottom: UnitsValue; right: UnitsValue; };
	uOrder?: number;
	vOrder?: number;
	deformNumRows?: number;
	deformNumCols?: number;
	customEnvelopeWarp?: {
		quiltSliceX?: number[];
		quiltSliceY?: number[];
		// 16 points from top left to bottom right, rows first, all points are relative to the first point
		meshPoints: { x: number; y: number; }[];
	};
}

export interface Animations {
	frames: {
		id: number;
		delay: number;
		dispose?: 'auto' | 'none' | 'dispose';
	}[];
	animations: {
		id: number;
		frames: number[];
		repeats?: number;
		activeFrame?: number;
	}[];
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

export interface UnitsBounds {
	top: UnitsValue;
	left: UnitsValue;
	right: UnitsValue;
	bottom: UnitsValue;
}

export interface TextPath {
	name?: number[]; // TODO: this is probably not a name
	bezierCurve?: {
		controlPoints: number[]; // 8 values per bezier curve
	};
	data: {
		// TODO: other fields
		type?: number;
		orientation?: number;
		frameMatrix: number[];
		textRange: number[];
		rowGutter?: number;
		columnGutter?: number;
		BaselineAlignment?: {
			flag?: number;
			min?: number;
		};
		pathData: {
			// TODO: other fields
			reversed?: boolean;
			spacing?: number;
		};
	};
	uuid?: string;
}

export interface LayerTextData {
	text: string;
	transform?: number[]; // 2d transform matrix [xx, xy, yx, yy, tx, ty]
	antiAlias?: AntiAlias;
	gridding?: TextGridding;
	orientation?: Orientation;
	index?: number; // index of Editor in extra editor data related to this layer
	warp?: Warp;
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

	shapeType?: 'point' | 'box';
	pointBase?: number[];
	boxBounds?: number[];
	bounds?: UnitsBounds;
	boundingBox?: UnitsBounds;

	/** This is read-only field, any changes will not be saved */
	textPath?: TextPath;
}

export interface PatternInfo {
	name: string;
	id: string;
	x: number;
	y: number;
	bounds: { x: number; y: number; w: number, h: number; };
	data: Uint8Array;
}

export interface BezierKnot {
	linked: boolean;
	points: number[]; // x0, y0, x1, y1, x2, y2
}

export type BooleanOperation = 'exclude' | 'combine' | 'subtract' | 'intersect';

export interface BezierPath {
	open: boolean;
	operation?: BooleanOperation;
	knots: BezierKnot[];
	fillRule: 'even-odd' | 'non-zero';
}

export interface ExtraGradientInfo {
	style?: GradientStyle;
	scale?: number;
	angle?: number;
	dither?: boolean;
	interpolationMethod?: InterpolationMethod;
	reverse?: boolean;
	align?: boolean;
	offset?: { x: number; y: number; };
}

export interface ExtraPatternInfo {
	linked?: boolean;
	phase?: { x: number; y: number; };
}

export type VectorContent = { type: 'color'; color: Color; } |
	(EffectSolidGradient & ExtraGradientInfo) |
	(EffectNoiseGradient & ExtraGradientInfo) |
	(EffectPattern & { type: 'pattern'; } & ExtraPatternInfo);

export type RenderingIntent = 'perceptual' | 'saturation' | 'relative colorimetric' | 'absolute colorimetric';

export type Units = 'Pixels' | 'Points' | 'Picas' | 'Millimeters' | 'Centimeters' | 'Inches' | 'None' | 'Density';

export interface UnitsValue {
	units: Units;
	value: number;
}

export interface BrightnessAdjustment {
	type: 'brightness/contrast';
	brightness?: number;
	contrast?: number;
	meanValue?: number;
	useLegacy?: boolean;
	labColorOnly?: boolean;
	auto?: boolean;
}

export interface LevelsAdjustmentChannel {
	shadowInput: number;
	highlightInput: number;
	shadowOutput: number;
	highlightOutput: number;
	midtoneInput: number;
}

export interface PresetInfo {
	presetKind?: number;
	presetFileName?: string;
}

export interface LevelsAdjustment extends PresetInfo {
	type: 'levels';
	rgb?: LevelsAdjustmentChannel;
	red?: LevelsAdjustmentChannel;
	green?: LevelsAdjustmentChannel;
	blue?: LevelsAdjustmentChannel;
}

export type CurvesAdjustmentChannel = { input: number; output: number; }[];

export interface CurvesAdjustment extends PresetInfo {
	type: 'curves';
	rgb?: CurvesAdjustmentChannel;
	red?: CurvesAdjustmentChannel;
	green?: CurvesAdjustmentChannel;
	blue?: CurvesAdjustmentChannel;
}

export interface ExposureAdjustment extends PresetInfo {
	type: 'exposure';
	exposure?: number;
	offset?: number;
	gamma?: number;
}

export interface VibranceAdjustment {
	type: 'vibrance';
	vibrance?: number;
	saturation?: number;
}

export interface HueSaturationAdjustmentChannel {
	a: number;
	b: number;
	c: number;
	d: number;
	hue: number;
	saturation: number;
	lightness: number;
}

export interface HueSaturationAdjustment extends PresetInfo {
	type: 'hue/saturation';
	master?: HueSaturationAdjustmentChannel;
	reds?: HueSaturationAdjustmentChannel;
	yellows?: HueSaturationAdjustmentChannel;
	greens?: HueSaturationAdjustmentChannel;
	cyans?: HueSaturationAdjustmentChannel;
	blues?: HueSaturationAdjustmentChannel;
	magentas?: HueSaturationAdjustmentChannel;
}

export interface ColorBalanceValues {
	cyanRed: number;
	magentaGreen: number;
	yellowBlue: number;
}

export interface ColorBalanceAdjustment {
	type: 'color balance';
	shadows?: ColorBalanceValues;
	midtones?: ColorBalanceValues;
	highlights?: ColorBalanceValues;
	preserveLuminosity?: boolean;
}

export interface BlackAndWhiteAdjustment extends PresetInfo {
	type: 'black & white';
	reds?: number;
	yellows?: number;
	greens?: number;
	cyans?: number;
	blues?: number;
	magentas?: number;
	useTint?: boolean;
	tintColor?: Color;
}

export interface PhotoFilterAdjustment {
	type: 'photo filter';
	color?: Color;
	density?: number;
	preserveLuminosity?: boolean;
}

export interface ChannelMixerChannel {
	red: number;
	green: number;
	blue: number;
	constant: number;
}

export interface ChannelMixerAdjustment extends PresetInfo {
	type: 'channel mixer';
	monochrome?: boolean;
	red?: ChannelMixerChannel;
	green?: ChannelMixerChannel;
	blue?: ChannelMixerChannel;
	gray?: ChannelMixerChannel;
}

export interface ColorLookupAdjustment {
	type: 'color lookup';
	lookupType?: '3dlut' | 'abstractProfile' | 'deviceLinkProfile';
	name?: string;
	dither?: boolean;
	profile?: Uint8Array;
	lutFormat?: 'look' | 'cube' | '3dl';
	dataOrder?: 'rgb' | 'bgr';
	tableOrder?: 'rgb' | 'bgr';
	lut3DFileData?: Uint8Array;
	lut3DFileName?: string;
}

export interface InvertAdjustment {
	type: 'invert';
}

export interface PosterizeAdjustment {
	type: 'posterize';
	levels?: number;
}

export interface ThresholdAdjustment {
	type: 'threshold';
	level?: number;
}

export interface ColorStop {
	color: Color;
	location: number;
	midpoint: number;
}

export interface OpacityStop {
	opacity: number;
	location: number;
	midpoint: number;
}

export interface GradientMapAdjustment {
	type: 'gradient map';
	name?: string;
	gradientType: 'solid' | 'noise';
	dither?: boolean;
	reverse?: boolean;
	// solid
	smoothness?: number;
	colorStops?: ColorStop[];
	opacityStops?: OpacityStop[];
	// noise
	roughness?: number;
	colorModel?: 'rgb' | 'hsb' | 'lab';
	randomSeed?: number;
	restrictColors?: boolean;
	addTransparency?: boolean;
	min?: number[];
	max?: number[];
}

export interface SelectiveColorAdjustment {
	type: 'selective color';
	mode?: 'relative' | 'absolute';
	reds?: CMYK;
	yellows?: CMYK;
	greens?: CMYK;
	cyans?: CMYK;
	blues?: CMYK;
	magentas?: CMYK;
	whites?: CMYK;
	neutrals?: CMYK;
	blacks?: CMYK;
}

export type LinkedFile = {
	id: string; // must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)
	name: string;
	type?: string;
	creator?: string;
	data?: Uint8Array;
	time?: string; // for external files
	descriptor?: {
		compInfo: { compID: number; originalCompID: number; };
	};
	childDocumentID?: string;
	assetModTime?: number;
	assetLockedState?: number;

	// external files
	linkedFile?: {
		fileSize: number;
		name: string;
		fullPath: string;
		originalPath: string;
		relativePath: string;
	};
}

type FilterVariant = {
	type: 'average' | 'blur' | 'blur more';
} | {
	type: 'box blur';
	filter: {
		radius: UnitsValue;
	};
} | {
	type: 'gaussian blur';
	filter: {
		radius: UnitsValue;
	};
} | {
	type: 'motion blur';
	filter: {
		angle: number; // in degrees
		distance: UnitsValue;
	};
} | {
	type: 'radial blur';
	filter: {
		amount: number;
		method: 'spin' | 'zoom';
		quality: 'draft' | 'good' | 'best';
	};
} | {
	type: 'shape blur';
	filter: {
		radius: UnitsValue;
		customShape: { name: string; id: string };
	};
} | {
	type: 'smart blur';
	filter: {
		radius: number;
		threshold: number;
		quality: 'low' | 'medium' | 'high';
		mode: 'normal' | 'edge only' | 'overlay edge';
	};
} | {
	type: 'surface blur';
	filter: {
		radius: UnitsValue;
		threshold: number;
	};
} | {
	type: 'displace';
	filter: {
		horizontalScale: number;
		verticalScale: number;
		displacementMap: 'stretch to fit' | 'tile';
		undefinedAreas: 'wrap around' | 'repeat edge pixels';
		displacementFile: {
			signature: string;
			path: string;
		};
	};
} | {
	type: 'pinch';
	filter: {
		amount: number;
	};
} | {
	type: 'polar coordinates';
	filter: {
		conversion: 'rectangular to polar' | 'polar to rectangular';
	};
} | {
	type: 'ripple';
	filter: {
		amount: number;
		size: 'small' | 'medium' | 'large';
	};
} | {
	type: 'shear';
	filter: {
		shearPoints: { x: number; y: number }[];
		shearStart: number;
		shearEnd: number;
		undefinedAreas: 'wrap around' | 'repeat edge pixels';
	};
} | {
	type: 'spherize';
	filter: {
		amount: number;
		mode: 'normal' | 'horizontal only' | 'vertical only';
	};
} | {
	type: 'twirl';
	filter: {
		angle: number; // degrees
	};
} | {
	type: 'wave';
	filter: {
		numberOfGenerators: number;
		type: 'sine' | 'triangle' | 'square';
		wavelength: { min: number; max: number };
		amplitude: { min: number; max: number };
		scale: { x: number; y: number };
		randomSeed: number;
		undefinedAreas: 'wrap around' | 'repeat edge pixels';
	};
} | {
	type: 'zigzag';
	filter: {
		amount: number;
		ridges: number;
		style: 'around center' | 'out from center' | 'pond ripples';
	};
} | {
	type: 'add noise';
	filter: {
		amount: number; // 0..1
		distribution: 'uniform' | 'gaussian';
		monochromatic: boolean;
		randomSeed: number;
	};
} | {
	type: 'despeckle';
} | {
	type: 'dust and scratches';
	filter: {
		radius: number; // pixels
		threshold: number; // levels
	};
} | {
	type: 'median';
	filter: {
		radius: UnitsValue;
	};
} | {
	type: 'reduce noise';
	filter: {
		preset: string;
		removeJpegArtifact: boolean;
		reduceColorNoise: number; // 0..1
		sharpenDetails: number; // 0..1
		channelDenoise: {
			channels: ('red' | 'green' | 'blue' | 'composite')[];
			amount: number;
			preserveDetails?: number; // percent
		}[];
	};
} | {
	type: 'color halftone';
	filter: {
		radius: number; // pixels
		angle1: number; // degrees
		angle2: number; // degrees
		angle3: number; // degrees
		angle4: number; // degrees
	};
} | {
	type: 'crystallize';
	filter: {
		cellSize: number;
		randomSeed: number;
	};
} | {
	type: 'facet' | 'fragment';
} | {
	type: 'mezzotint';
	filter: {
		type: 'fine dots' | 'medium dots' | 'grainy dots' | 'coarse dots' | 'short lines' | 'medium lines' | 'long lines' | 'short strokes' | 'medium strokes' | 'long strokes';
		randomSeed: number;
	};
} | {
	type: 'mosaic';
	filter: {
		cellSize: UnitsValue;
	};
} | {
	type: 'pointillize';
	filter: {
		cellSize: number;
		randomSeed: number;
	};
} | {
	type: 'clouds';
	filter: {
		randomSeed: number;
	};
} | {
	type: 'difference clouds';
	filter: {
		randomSeed: number;
	};
} | {
	type: 'fibers';
	filter: {
		variance: number;
		strength: number;
		randomSeed: number;
	};
} | {
	type: 'lens flare';
	filter: {
		brightness: number; // percent
		position: { x: number; y: number; };
		lensType: '50-300mm zoom' | '32mm prime' | '105mm prime' | 'movie prime';
	};
} /*| {
	type: 'lighting effects';
	filter: {
		lights: Light3D;
		cameraPosition: Position3D;
		gloss: number;
		metallic: number;
		exposure: number;
		ambience: number;
		ambientColor: Color;
		// TODO: BmpA, BmpC / Hotspot / color ?
		width: number;
		height: number;
	};
}*/ | {
	type: 'sharpen' | 'sharpen edges' | 'sharpen more';
} | {
	type: 'smart sharpen';
	filter: {
		amount: number; // 0..1
		radius: UnitsValue;
		threshold: number;
		angle: number; // degrees
		moreAccurate: boolean;
		blur: 'gaussian blur' | 'lens blur' | 'motion blur';
		preset: string;
		shadow: {
			fadeAmount: number; // 0..1
			tonalWidth: number; // 0..1
			radius: number; // px
		};
		highlight: {
			fadeAmount: number; // 0..1
			tonalWidth: number; // 0..1
			radius: number; // px
		};
	};
} | {
	type: 'unsharp mask';
	filter: {
		amount: number; // 0..1
		radius: UnitsValue;
		threshold: number; // levels
	};
} | {
	type: 'diffuse';
	filter: {
		mode: 'normal' | 'darken only' | 'lighten only' | 'anisotropic';
		randomSeed: number;
	};
} | {
	type: 'emboss';
	filter: {
		angle: number; // degrees
		height: number; // pixels
		amount: number; // percent
	};
} | {
	type: 'extrude';
	filter: {
		type: 'blocks' | 'pyramids';
		size: number; // pixels
		depth: number;
		depthMode: 'random' | 'level-based';
		randomSeed: number;
		solidFrontFaces: boolean;
		maskIncompleteBlocks: boolean;
	};
} | {
	type: 'find edges' | 'solarize';
} | {
	type: 'tiles';
	filter: {
		numberOfTiles: number;
		maximumOffset: number; // percent
		fillEmptyAreaWith: 'background color' | 'foreground color' | 'inverse image' | 'unaltered image';
		randomSeed: number;
	};
} | {
	type: 'trace contour';
	filter: {
		level: number;
		edge: 'lower' | 'upper';
	};
} | {
	type: 'wind';
	filter: {
		method: 'wind' | 'blast' | 'stagger';
		direction: 'left' | 'right';
	};
} | {
	type: 'de-interlace';
	filter: {
		eliminate: 'odd lines' | 'even lines';
		newFieldsBy: 'duplication' | 'interpolation';
	};
} | {
	type: 'ntsc colors';
} | {
	type: 'custom';
	filter: {
		scale: number;
		offset: number;
		matrix: number[];
	};
} | {
	type: 'high pass' | 'maximum' | 'minimum';
	filter: {
		radius: UnitsValue;
	};
} | {
	type: 'offset';
	filter: {
		horizontal: number; // pixels
		vertical: number; // pixels
		undefinedAreas: 'set to transparent' | 'repeat edge pixels' | 'wrap around';
	};
} | {
	type: 'puppet';
	filter: {
		rigidType: boolean;
		bounds: { x: number; y: number; }[];
		puppetShapeList: {
			rigidType: boolean;
			// VrsM: number;
			// VrsN: number;
			originalVertexArray: { x: number; y: number; }[];
			deformedVertexArray: { x: number; y: number; }[];
			indexArray: number[];
			pinOffsets: { x: number; y: number; }[];
			posFinalPins: { x: number; y: number; }[];
			pinVertexIndices: number[];
			selectedPin: number[];
			pinPosition: { x: number; y: number; }[];
			pinRotation: number[]; // in degrees
			pinOverlay: boolean[];
			pinDepth: number[];
			meshQuality: number;
			meshExpansion: number;
			meshRigidity: number;
			imageResolution: number;
			meshBoundaryPath: {
				pathComponents: {
					shapeOperation: string;
					paths: {
						closed: boolean;
						points: {
							anchor: { x: UnitsValue; y: UnitsValue; };
							forward: { x: UnitsValue; y: UnitsValue; };
							backward: { x: UnitsValue; y: UnitsValue; };
							smooth: boolean;
						}[];
					}[];
				}[];
			};
		}[];
	};
} | {
	type: 'oil paint plugin';
	filter: {
		name: string;
		gpu: boolean;
		lighting: boolean;
		// FPth ???
		parameters: {
			name: string;
			value: number;
		}[];
	};
} /*| {
	type: 'lens correction';
	filter: {
		profile: string;
		
	};
}*//* | {
	type: 'adaptive wide angle';
	filter: {
		correction: 'fisheye' | 'perspective' | 'auto' | 'full spherical';
		focalLength: number;
		cropFactor: number;
		imageScale: number;
		imageX: number;
		imageY: number;
	};
}*//* | {
	type: 'filter gallery';
	filter: {
		filter: 'colored pencil';
		pencilWidth: number;
		strokePressure: number;
		paperBrightness: number;
	} | ...;
}*/ | {
	type: 'hsb/hsl';
	filter: {
		inputMode: 'rgb' | 'hsb' | 'hsl';
		rowOrder: 'rgb' | 'hsb' | 'hsl';
	};
} | {
	type: 'oil paint';
	filter: {
		lightingOn: boolean;
		stylization: number;
		cleanliness: number;
		brushScale: number;
		microBrush: number;
		lightDirection: number; // degrees
		specularity: number;
	};
} | {
	type: 'liquify';
	filter: {
		liquifyMesh: Uint8Array;
	};
} | {
	type: 'perspective warp';
	filter: {
		quads: number[][]; // quad indices
		vertices: { x: UnitsValue; y: UnitsValue; }[];
		warpedVertices: { x: UnitsValue; y: UnitsValue; }[];
	};
} | {
	type: 'curves';
	filter: {
		presetKind: 'custom' | 'default';
		adjustments: ({
			channels: ('composite' | 'red' | 'green' | 'blue')[];
			curve: { x: number; y: number; curved?: boolean; }[];
		} | {
			channels: ('composite' | 'red' | 'green' | 'blue')[];
			values: number[];
		})[];
	};
};

/*
export interface Position3D {
	x: number;
	y: number;
	z: number;
	angleX: number;
	angleY: number;
	angleZ: number;
}

export interface Light3D {
	name: string;
	type: 'point' | 'spot' | 'infinite';
	red: number; // 0..1
	green: number; // 0..1
	blue: number; // 0..1
	// TODO: hots
	falloff: number;
	shadow: number;
	// TODO: attn
	// TODO: attt atta, attb, attc, orad, irad, mult, Type
	// ...
}
*/

export type Filter = FilterVariant & {
	name: string;
	opacity: number;
	blendMode: BlendMode;
	enabled: boolean;
	hasOptions: boolean;
	foregroundColor: Color;
	backgroundColor: Color;
}

export interface PlacedLayerFilter {
	enabled: boolean;
	validAtPosition: boolean;
	maskEnabled: boolean;
	maskLinked: boolean;
	maskExtendWithWhite: boolean;
	list: Filter[];
}

export type PlacedLayerType = 'unknown' | 'vector' | 'raster' | 'image stack';

export interface PlacedLayer {
	id: string; // id of linked image file (psd.linkedFiles), must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)
	placed?: string; // unique id
	type: PlacedLayerType;
	pageNumber?: number;
	totalPages?: number;
	frameStep?: { numerator: number; denominator: number; };
	duration?: { numerator: number; denominator: number; };
	frameCount?: number;
	transform: number[]; // x, y of 4 corners of the transform
	nonAffineTransform?: number[]; // x, y of 4 corners of the transform
	width?: number; // width of the linked image
	height?: number; // height of the linked image
	resolution?: UnitsValue;
	// antialias ?
	warp?: Warp; // warp coordinates are relative to the linked image size
	crop?: number;
	comp?: number;
	compInfo?: { compID: number; originalCompID: number; };
	filter?: PlacedLayerFilter;
}

export type AdjustmentLayer = BrightnessAdjustment | LevelsAdjustment | CurvesAdjustment |
	ExposureAdjustment | VibranceAdjustment | HueSaturationAdjustment | ColorBalanceAdjustment |
	BlackAndWhiteAdjustment | PhotoFilterAdjustment | ChannelMixerAdjustment | ColorLookupAdjustment |
	InvertAdjustment | PosterizeAdjustment | ThresholdAdjustment | GradientMapAdjustment |
	SelectiveColorAdjustment;

export type LayerColor = 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray';

export interface KeyDescriptorItem {
	keyShapeInvalidated?: boolean;
	keyOriginType?: number;
	keyOriginResolution?: number;
	keyOriginRRectRadii?: {
		topRight: UnitsValue;
		topLeft: UnitsValue;
		bottomLeft: UnitsValue;
		bottomRight: UnitsValue;
	};
	keyOriginShapeBoundingBox?: {
		top: UnitsValue;
		left: UnitsValue;
		bottom: UnitsValue;
		right: UnitsValue;
	};
	keyOriginBoxCorners?: { x: number; y: number; }[];
	transform?: number[]; // 2d transform matrix [xx, xy, yx, yy, tx, ty]
}

export interface LayerVectorMask {
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
}

export interface AnimationFrame {
	frames: number[]; // IDs of frames that this modifiers applies to
	enable?: boolean;
	offset?: { x: number; y: number; };
	referencePoint?: { x: number; y: number; };
	opacity?: number;
	effects?: LayerEffectsInfo;
}

export interface Fraction {
	numerator: number;
	denominator: number;
}

export type TimelineKeyInterpolation = 'linear' | 'hold';

export type TimelineKey = {
	interpolation: TimelineKeyInterpolation;
	time: Fraction;
	selected?: boolean;
} & ({
	type: 'opacity';
	value: number;
} | {
	type: 'position';
	x: number;
	y: number;
} | {
	type: 'transform';
	scale: { x: number; y: number; };
	skew: { x: number; y: number; };
	rotation: number;
	translation: { x: number; y: number; };
} | {
	type: 'style';
	style?: LayerEffectsInfo;
} | {
	type: 'globalLighting';
	globalAngle: number;
	globalAltitude: number;
});

export type TimelineTrackType = 'opacity' | 'style' | 'sheetTransform' | 'sheetPosition' | 'globalLighting';

export interface TimelineTrack {
	type: TimelineTrackType;
	enabled?: boolean;
	effectParams?: {
		keys: TimelineKey[];
		fillCanvas: boolean;
		zoomOrigin: number;
	};
	keys: TimelineKey[];
}

export interface Timeline {
	start: Fraction;
	duration: Fraction;
	inTime: Fraction;
	outTime: Fraction;
	autoScope: boolean;
	audioLevel: number;
	tracks?: TimelineTrack[];
}

export interface LayerAdditionalInfo {
	name?: string; // layer name
	nameSource?: string; // layer name source
	id?: number; // layer id
	version?: number; // layer version
	mask?: LayerMaskData;
	realMask?: LayerMaskData;
	blendClippendElements?: boolean; // has to be set to `true` when using `color burn` blend mode (otherwise `transparencyShapesLayer` is set incorrectly)
	blendInteriorElements?: boolean;
	knockout?: boolean;
	layerMaskAsGlobalMask?: boolean;
	protected?: {
		transparency?: boolean;
		composite?: boolean;
		position?: boolean;
		artboards?: boolean;
	};
	layerColor?: LayerColor;
	referencePoint?: {
		x: number;
		y: number;
	};
	sectionDivider?: {
		type: SectionDividerType;
		key?: string;
		subType?: number; // 0 = normal, 1 = scene group, affects the animation timeline.
	};
	filterMask?: {
		colorSpace: Color;
		opacity: number;
	};
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
	vectorMask?: LayerVectorMask;
	usingAlignedRendering?: boolean;
	timestamp?: number; // seconds
	pathList?: {
		// TODO: ...
	}[];
	adjustment?: AdjustmentLayer;
	placedLayer?: PlacedLayer;
	vectorOrigination?: {
		keyDescriptorList: KeyDescriptorItem[];
	};
	compositorUsed?: {
		version?: { major: number; minor: number; fix: number; };
		photoshopVersion?: { major: number; minor: number; fix: number; };
		description: string;
		reason: string;
		engine: string;
		enableCompCore?: string;
		enableCompCoreGPU?: string;
		enableCompCoreThreads?: string;
		compCoreSupport?: string;
		compCoreGPUSupport?: string;
	};
	artboard?: {
		rect: { top: number; left: number; bottom: number; right: number; };
		guideIndices?: any[];
		presetName?: string;
		color?: Color;
		backgroundType?: number;
	};
	fillOpacity?: number;
	transparencyShapesLayer?: boolean;
	channelBlendingRestrictions?: number[];
	animationFrames?: AnimationFrame[];
	animationFrameFlags?: {
		propagateFrameOne?: boolean;
		unifyLayerPosition?: boolean;
		unifyLayerStyle?: boolean;
		unifyLayerVisibility?: boolean;
	};
	timeline?: Timeline;
	filterEffectsMasks?: {
		id: string;
		top: number;
		left: number;
		bottom: number;
		right: number;
		depth: number;
		channels: ({
			compressionMode: number;
			data: Uint8Array;
		} | undefined)[];
		extra?: {
			top: number;
			left: number;
			bottom: number;
			right: number;
			compressionMode: number;
			data: Uint8Array;
		};
	}[];
	comps?: {
		originalEffectsReferencePoint?: { x: number; y: number; };
		settings: {
			enabled?: boolean;
			compList: number[];
			offset?: { x: number; y: number; };
			effectsReferencePoint?: { x: number; y: number; };
		}[];
	};
	userMask?: {
		colorSpace: Color;
		opacity: number;
	};
	blendingRanges?: {
		compositeGrayBlendSource: number[];
		compositeGraphBlendDestinationRange: number[];
		ranges: { sourceRange: number[]; destRange: number[]; }[];
	};
	vowv?: number; // ???

	// Base64 encoded raw EngineData, currently just kept in original state to support
	// loading and modifying PSD file without breaking text layers.
	engineData?: string;
}

export enum LayerCompCapturedInfo {
	None = 0,
	Visibility = 1,
	Position = 2,
	Appearance = 4,
}

export interface ImageResources {
	layerState?: number;
	layerSelectionIds?: number[];
	versionInfo?: {
		hasRealMergedData: boolean;
		writerName: string;
		readerName: string;
		fileVersion: number;
	};
	alphaIdentifiers?: number[];
	alphaChannelNames?: string[];
	globalAngle?: number;
	globalAltitude?: number;
	pixelAspectRatio?: {
		aspect: number;
	};
	urlsList?: {
		id: number;
		ref: 'slice';
		url: string;
	}[];
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
	printInformation?: {
		printerManagesColors?: boolean;
		printerName?: string;
		printerProfile?: string;
		printSixteenBit?: boolean;
		renderingIntent?: RenderingIntent;
		hardProof?: boolean;
		blackPointCompensation?: boolean;
		proofSetup?: {
			builtin: string;
		} | {
			profile: string;
			renderingIntent?: RenderingIntent;
			blackPointCompensation?: boolean;
			paperWhite?: boolean;
		};
	};
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
	iccUntaggedProfile?: boolean;
	pathSelectionState?: string[];
	imageReadyVariables?: string;
	imageReadyDataSets?: string;
	animations?: Animations;
	onionSkins?: {
		enabled: boolean;
		framesBefore: number;
		framesAfter: number;
		frameSpacing: number;
		minOpacity: number;
		maxOpacity: number;
		blendMode: BlendMode;
	};
	timelineInformation?: {
		enabled: boolean;
		frameStep: Fraction;
		frameRate: number;
		time: Fraction;
		duration: Fraction;
		workInTime: Fraction;
		workOutTime: Fraction;
		repeats: number;
		hasMotion: boolean;
		globalTracks: TimelineTrack[];
		audioClipGroups?: {
			id: string;
			muted: boolean;
			audioClips: {
				id: string;
				start: Fraction;
				duration: Fraction;
				inTime: Fraction;
				outTime: Fraction;
				muted: boolean;
				audioLevel: number;
				frameReader: {
					type: number;
					mediaDescriptor: string;
					link: {
						name: string;
						fullPath: string;
						relativePath: string;
					};
				};
			}[];
		}[];
	};
	sheetDisclosure?: {
		sheetTimelineOptions?: {
			sheetID: number;
			sheetDisclosed: boolean;
			lightsDisclosed: boolean;
			meshesDisclosed: boolean;
			materialsDisclosed: boolean;
		}[];
	};
	countInformation?: {
		color: RGB;
		name: string;
		size: number;
		fontSize: number;
		visible: boolean;
		points: { x: number; y: number }[];
	}[];
	slices?: {
		bounds: { left: number; top: number; right: number; bottom: number };
		groupName: string;
		slices: {
			id: number;
			groupId: number;
			origin: 'userGenerated' | 'autoGenerated' | 'layer';
			associatedLayerId: number;
			name?: string;
			type: 'image' | 'noImage';
			bounds: { left: number; top: number; right: number; bottom: number };
			url: string;
			target: string;
			message: string;
			altTag: string;
			cellTextIsHTML: boolean;
			cellText: string;
			horizontalAlignment: 'default';
			verticalAlignment: 'default';
			backgroundColorType: 'none' | 'matte' | 'color';
			backgroundColor: RGBA;
			topOutset?: number;
			leftOutset?: number;
			bottomOutset?: number;
			rightOutset?: number;
		}[];
	}[];
	layerComps?: {
		list: {
			id: number;
			name: string;
			comment?: string;
			capturedInfo: LayerCompCapturedInfo;
		}[];
		lastApplied?: number;
	};
}

export interface GlobalLayerMaskInfo {
	overlayColorSpace: number;
	colorSpace1: number;
	colorSpace2: number;
	colorSpace3: number;
	colorSpace4: number;
	opacity: number;
	kind: number;
}

export interface Annotation {
	type: 'text' | 'sound';
	open: boolean;
	iconLocation: { left: number; top: number; right: number; bottom: number };
	popupLocation: { left: number; top: number; right: number; bottom: number };
	color: Color;
	author: string;
	name: string;
	date: string;
	data: string | Uint8Array;
}

export interface Layer extends LayerAdditionalInfo {
	top?: number;
	left?: number;
	bottom?: number;
	right?: number;
	blendMode?: BlendMode;
	opacity?: number;
	transparencyProtected?: boolean;
	effectsOpen?: boolean; // effects/filters panel is expanded
	hidden?: boolean;
	clipping?: boolean;
	canvas?: HTMLCanvasElement;
	imageData?: PixelData;
	children?: Layer[];
	/** Applies only for layer groups. */
	opened?: boolean;
	linkGroup?: number;
	linkGroupEnabled?: boolean;
}

export interface Psd extends LayerAdditionalInfo {
	width: number;
	height: number;
	channels?: number;
	bitsPerChannel?: number;
	colorMode?: ColorMode;
	palette?: RGB[]; // colors for indexed color mode
	children?: Layer[];
	canvas?: HTMLCanvasElement;
	imageData?: PixelData;
	imageResources?: ImageResources;
	linkedFiles?: LinkedFile[]; // used in smart objects
	artboards?: {
		count: number; // number of artboards in the document
		autoExpandOffset?: { horizontal: number; vertical: number; };
		origin?: { horizontal: number; vertical: number; };
		autoExpandEnabled?: boolean;
		autoNestEnabled?: boolean;
		autoPositionEnabled?: boolean;
		shrinkwrapOnSaveEnabled?: boolean;
		docDefaultNewArtboardBackgroundColor?: Color;
		docDefaultNewArtboardBackgroundType?: number;
	};
	globalLayerMaskInfo?: GlobalLayerMaskInfo;
	annotations?: Annotation[];
}

export interface ReadOptions {
	/** Does not load layer image data. */
	skipLayerImageData?: boolean;
	/** Does not load composite image data. */
	skipCompositeImageData?: boolean;
	/** Does not load thumbnail. */
	skipThumbnail?: boolean;
	/** Does not load linked files (used in smart-objects). */
	skipLinkedFilesData?: boolean;
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

	/** Used only for development. */
	logDevFeatures?: boolean;
	/** Used only for development. */
	strict?: boolean;
	/** Used only for development. */
	debug?: boolean;
	/** Used only for development. */
	log?: (...args: any[]) => void;
}

export interface WriteOptions {
	/** Automatically generates thumbnail from composite image. */
	generateThumbnail?: boolean;
	/** Trims transparent pixels from layer image data. */
	trimImageData?: boolean;
	/** Invalidates text layer data, forcing Photoshop to redraw them on load.
	 *  Use this option if you're updating loaded text layer properties. */
	invalidateTextLayers?: boolean;
	/** Logs if features are missing. */
	logMissingFeatures?: boolean;
	/** Forces bottom layer to be treated as layer and not background even when it's missing any transparency
	 * 	(by default Photoshop treats bottom layer as background it it doesn't have any transparent pixels). */
	noBackground?: boolean;
	/** Saves document as PSB (Large Document Format) file. */
	psb?: boolean;
	/** Uses zip compression when writing PSD file, will result in smaller file size but may be incompatible
	 *  with some software. It may also be significantly slower. */
	compress?: boolean;
}
