import { BlnM, DescriptorUnitsValue, parseAngle, parsePercent, parseUnitsToNumber, readVersionAndDescriptor } from './descriptor';
import { BlendMode, PatternInfo } from './psd';
import { checkSignature, consumeMemory, createReader, PsdReader, readBytes, readDataRLE, readInt16, readInt32, readPascalString, readPatternSafe, readSignature, readUint16, readUint32, readUint8, readUnicodeString, skipBytes } from './psdReader';

export interface Abr {
	brushes: Brush[];
	samples: SampleInfo[];
	patterns: PatternInfo[];
}

export interface SampleInfo {
	id: string;
	bounds: { x: number; y: number; w: number; h: number; };
	alpha: Uint8Array;
}

export interface BrushDynamics {
	control: 'off' | 'fade' | 'pen pressure' | 'pen tilt' | 'stylus wheel' | 'initial direction' | 'direction' | 'initial rotation' | 'rotation';
	steps: number; // for fade
	jitter: number;
	minimum: number;
}

const dynamicsControl = ['off', 'fade', 'pen pressure', 'pen tilt', 'stylus wheel', 'initial direction', 'direction', 'initial rotation', 'rotation'];

type DynamicBrushShapeShape = 'round point' | 'round blunt' | 'round curve' | 'round angle' | 'round fan' | 'flat point' | 'flat blunt' | 'flat curve' | 'flat angle' | 'flat fan';

const dynamicBrushShapeShapes: DynamicBrushShapeShape[] = ['round point', 'round blunt', 'round curve', 'round angle', 'round fan', 'flat point', 'flat blunt', 'flat curve', 'flat angle', 'flat fan'];

type TipsBrushShapeShape = 'erodible point' | 'erodible flat' | 'erodible round' | 'erodible square' | 'erodible triangle' | 'custom';

const tipsBrushShapeShapes: TipsBrushShapeShape[] = ['erodible point', 'erodible flat', 'erodible round', 'erodible square', 'erodible triangle', 'custom'];

export type BrushShape = ComputedBrushShape | SampledBrushShape | TipsBrushShape | DynamicBrushShape;

interface ComputedBrushShape {
	type: 'computed';
	size: number;
	angle: number;
	roundness: number;
	hardness: number;
	spacingOn: boolean;
	spacing: number;
	flipX: boolean;
	flipY: boolean;
}

interface SampledBrushShape {
	type: 'sampled';
	name: string;
	size: number;
	angle: number;
	roundness: number;
	spacingOn: boolean;
	spacing: number;
	flipX: boolean;
	flipY: boolean;
	sampledData: string;
}

interface TipsBrushShape {
	type: 'tips';
	angle: number;
	size: number;
	shape: DynamicBrushShapeShape;
	physics: boolean;
	spacing: number,
	spacingOn: boolean;
	flipX: boolean;
	flipY: boolean;
	tipsType: TipsBrushShapeShape;
	tipsLengthRatio: number;
	tipsHardness: number;
	tipsGridSize?: number;
	tipsErodibleTipHeightMap?: number[];
	tipsAirbrushCutoffAngle: number;
	tipsAirbrushGranularity: number;
	tipsAirbrushStreakiness: number;
	tipsAirbrushSplatSize: number;
	tipsAirbrushSplatCount: number;
}

interface DynamicBrushShape {
	type: 'dynamic';
	size: number;
	angle: number;
	shape: DynamicBrushShapeShape;
	density: number;
	length: number;
	clumping: number; // bristles
	thickness: number;
	stiffness: number;
	physics: boolean;
	spacing: number;
	spacingOn: boolean;
	flipX: boolean;
	flipY: boolean;
}

export interface Brush {
	name: string;
	group?: string[]; // names of brush groups (folders in brushes panel) the brush is in, from outermost to innermost
	shape: BrushShape;
	shapeDynamics?: {
		sizeDynamics: BrushDynamics;
		minimumDiameter: number;
		tiltScale: number;
		angleDynamics: BrushDynamics; // jitter 0-1 -> 0-360 deg ?
		roundnessDynamics: BrushDynamics;
		minimumRoundness: number;
		flipX: boolean;
		flipY: boolean;
		brushProjection: boolean;
	};
	scatter?: {
		bothAxes: boolean;
		scatterDynamics: BrushDynamics;
		countDynamics: BrushDynamics;
		count: number;
	};
	texture?: {
		id: string;
		name: string;
		invert: boolean;
		scale: number;
		brightness: number;
		contrast: number;
		blendMode: BlendMode;
		depth: number;
		depthMinimum: number;
		depthDynamics: BrushDynamics;
		textureEachTip: boolean;
	};
	dualBrush?: {
		flip: boolean;
		shape: BrushShape;
		blendMode: BlendMode;
		useScatter: boolean;
		spacing: number;
		count: number;
		bothAxes: boolean;
		countDynamics: BrushDynamics;
		scatterDynamics: BrushDynamics;
	};
	colorDynamics?: {
		foregroundBackground: BrushDynamics;
		hue: number;
		saturation: number;
		brightness: number;
		purity: number;
		perTip: boolean;
	};
	transfer?: {
		flowDynamics: BrushDynamics;
		opacityDynamics: BrushDynamics;
		wetnessDynamics?: BrushDynamics; // missing in brushes from older Photoshop versions
		mixDynamics?: BrushDynamics;
	};
	brushPose?: {
		overrideAngle: boolean;
		overrideTiltX: boolean;
		overrideTiltY: boolean;
		overridePressure: boolean;
		pressure: number;
		tiltX: number;
		tiltY: number;
		angle: number;
	};
	noise: boolean;
	wetEdges: boolean;
	buildUp: boolean;
	// smoothing option is stored in toolOptions.smoothing
	protectTexture?: boolean;
	spacing: number;
	brushGroup?: undefined; // ?
	interpretation?: boolean; // ?
	useBrushSize: boolean; // ?
	toolOptions?: {
		type: 'brush' | 'mixer brush' | 'smudge brush';
		brushPreset: boolean;
		flow: number; // 0-100
		wetness?: number; // 0-100
		dryness?: number; // 0-100
		mix?: number; // 0-100
		smooth: number; // ?
		mode: BlendMode;
		opacity: number; // 0-100
		smoothing: boolean;
		smoothingValue: number;
		smoothingRadiusMode: boolean;
		smoothingCatchup: boolean;
		smoothingCatchupAtEnd: boolean;
		smoothingZoomCompensation: boolean;
		pressureSmoothing: boolean;
		usePressureOverridesSize: boolean;
		usePressureOverridesOpacity: boolean;
		useLegacy: boolean;
		autoFill?: boolean;
		autoClean?: boolean;
		loadSolidColorOnly?: boolean;
		sampleAllLayers?: boolean;
		flowDynamics?: BrushDynamics;
		opacityDynamics?: BrushDynamics;
		sizeDynamics?: BrushDynamics;
		smudgeFingerPainting?: boolean;
		smudgeSampleAllLayers?: boolean;
		strength?: number; // 0-100
	};
}

// internal

interface PhryDescriptor {
	hierarchy?: ({
		_classID: 'preset' | 'groupEnd';
	} | {
		_classID: 'Grup';
		'Nm  ': string;
		zuid: string;
	})[];
}

interface DynamicsDescriptor {
	bVTy: number;
	fStp: number;
	jitter: DescriptorUnitsValue;
	'Mnm ': DescriptorUnitsValue;
}

type BrushShapeDescriptor = ComputedBrushDescriptor | SampledBrushDescriptor | TipsBrushDescriptor | DynamicBrushDescriptor;

interface ComputedBrushDescriptor {
	_name: '';
	_classID: 'computedBrush',
	Dmtr: DescriptorUnitsValue,
	Hrdn: DescriptorUnitsValue,
	Angl: DescriptorUnitsValue,
	Rndn: DescriptorUnitsValue,
	Spcn: DescriptorUnitsValue,
	Intr: boolean,
	flipX: boolean,
	flipY: boolean,
}

interface SampledBrushDescriptor {
	_name: '';
	_classID: 'sampledBrush';
	Dmtr: DescriptorUnitsValue;
	Angl: DescriptorUnitsValue;
	Rndn: DescriptorUnitsValue;
	'Nm  ': string;
	Spcn: DescriptorUnitsValue;
	Intr: boolean;
	flipX: boolean;
	flipY: boolean;
	sampledData: string;
}

interface TipsBrushDescriptor {
	_name: '';
	_classID: 'dTips';
	Angl: DescriptorUnitsValue;
	Dmtr: DescriptorUnitsValue;
	dtipsType: number;
	'Shp ': number;
	dtipsLengthRatio: DescriptorUnitsValue;
	dtipsHardness: DescriptorUnitsValue;
	dtipsGridSize: number;
	dtipsErodibleTipHeightMap?: Uint8Array;
	physics: boolean;
	dtipsAirbrushCutoffAngle: number;
	dtipsAirbrushGranularity: DescriptorUnitsValue;
	dtipsAirbrushStreakiness: DescriptorUnitsValue;
	dtipsAirbrushSplatSize: DescriptorUnitsValue;
	dtipsAirbrushSplatCount: number;
	Spcn: DescriptorUnitsValue,
	Intr: boolean;
	flipX: boolean;
	flipY: boolean;
}

interface DynamicBrushDescriptor {
	_name: '';
	_classID: 'dBrush';
	'Shp ': number;
	Angl: DescriptorUnitsValue;
	Dmtr: DescriptorUnitsValue;
	Dnst: DescriptorUnitsValue;
	Lngt: DescriptorUnitsValue;
	clumping: DescriptorUnitsValue;
	thickness: DescriptorUnitsValue;
	stiffness: DescriptorUnitsValue;
	physics: boolean;
	Spcn: DescriptorUnitsValue;
	Intr: boolean;
	flipX: boolean;
	flipY: boolean;
}

interface DescDescriptor {
	Brsh: {
		'Nm  ': string;
		Brsh: BrushShapeDescriptor;
		useTipDynamics: boolean;
		flipX: boolean;
		flipY: boolean;
		brushProjection: boolean;
		minimumDiameter: DescriptorUnitsValue;
		minimumRoundness: DescriptorUnitsValue;
		tiltScale: DescriptorUnitsValue;
		szVr: DynamicsDescriptor;
		angleDynamics: DynamicsDescriptor;
		roundnessDynamics: DynamicsDescriptor;
		useScatter: boolean;
		Spcn: DescriptorUnitsValue;
		'Cnt ': number;
		bothAxes: boolean;
		countDynamics: DynamicsDescriptor;
		scatterDynamics: DynamicsDescriptor;
		dualBrush: { useDualBrush: false; } | {
			useDualBrush: true;
			Flip: boolean;
			Brsh: BrushShapeDescriptor;
			BlnM: string;
			useScatter: boolean;
			Spcn: DescriptorUnitsValue;
			'Cnt ': number;
			bothAxes: boolean;
			countDynamics: DynamicsDescriptor;
			scatterDynamics: DynamicsDescriptor;
		};
		brushGroup: { useBrushGroup: false; };
		useTexture: boolean;
		TxtC: boolean;
		interpretation: boolean;
		textureBlendMode: string;
		textureDepth: DescriptorUnitsValue;
		minimumDepth: DescriptorUnitsValue;
		textureDepthDynamics: DynamicsDescriptor;
		Txtr?: {
			'Nm  ': string;
			Idnt: string;
		};
		textureScale: DescriptorUnitsValue;
		InvT: boolean;
		protectTexture: boolean;
		textureBrightness: number;
		textureContrast: number;
		usePaintDynamics: boolean;
		prVr?: DynamicsDescriptor;
		opVr?: DynamicsDescriptor;
		wtVr?: DynamicsDescriptor;
		mxVr?: DynamicsDescriptor;
		useColorDynamics: boolean;
		clVr?: DynamicsDescriptor;
		'H   '?: DescriptorUnitsValue;
		Strt?: DescriptorUnitsValue;
		Brgh?: DescriptorUnitsValue;
		purity?: DescriptorUnitsValue;
		colorDynamicsPerTip?: true;
		Wtdg: boolean;
		Nose: boolean;
		'Rpt ': boolean;
		useBrushSize: boolean;
		useBrushPose: boolean;
		overridePoseAngle?: boolean;
		overridePoseTiltX?: boolean;
		overridePoseTiltY?: boolean;
		overridePosePressure?: boolean;
		brushPosePressure?: DescriptorUnitsValue;
		brushPoseTiltX?: number;
		brushPoseTiltY?: number;
		brushPoseAngle?: number;
		toolOptions?: {
			_classID: string;
			brushPreset: boolean;
			flow?: number;
			wetness?: number;
			dryness?: number;
			mix?: number;
			Smoo?: number;
			'Md  ': string;
			Opct?: number;
			smoothing?: boolean;
			smoothingValue?: number;
			smoothingRadiusMode?: boolean;
			smoothingCatchup?: boolean;
			smoothingCatchupAtEnd?: boolean;
			smoothingZoomCompensation?: boolean;
			pressureSmoothing?: boolean;
			usePressureOverridesSize?: boolean;
			usePressureOverridesOpacity?: boolean;
			useLegacy: boolean;
			autoFill?: boolean;
			autoClean?: boolean;
			loadSolidColorOnly?: boolean;
			sampleAllLayers?: boolean;
			'Prs '?: number;
			MgcE?: boolean; // TODO: ???
			ErsB?: number; // TODO: ???
			prVr?: DynamicsDescriptor;
			opVr?: DynamicsDescriptor;
			szVr?: DynamicsDescriptor;
			SmdF?: boolean;
			SmdS?: boolean;
		};
	}[];
}

// sanity limits for brush sample dimensions (Photoshop brushes are limited to 5000px)
const MAX_BRUSH_SIZE = 10000;

const toBrushType: { [key: string]: 'brush' | 'mixer brush' | 'smudge brush'; } = {
	_: 'brush',
	MixB: 'mixer brush',
	SmTl: 'smudge brush',
	// PbTl
	// ErTl
};

function parseDynamics(desc: DynamicsDescriptor): BrushDynamics {
	return {
		control: dynamicsControl[desc.bVTy] as any,
		steps: desc.fStp,
		jitter: parsePercent(desc.jitter),
		minimum: parsePercent(desc['Mnm ']),
	};
}

function parseBrushShape(desc: BrushShapeDescriptor): BrushShape {
	switch (desc._classID) {
		case 'computedBrush': {
			return {
				type: 'computed',
				size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
				angle: parseAngle(desc.Angl),
				roundness: parsePercent(desc.Rndn),
				spacingOn: desc.Intr,
				spacing: parsePercent(desc.Spcn),
				flipX: desc.flipX,
				flipY: desc.flipY,
				hardness: parsePercent(desc.Hrdn),
			};
		}
		case 'sampledBrush': {
			return {
				type: 'sampled',
				size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
				angle: parseAngle(desc.Angl),
				roundness: parsePercent(desc.Rndn),
				spacingOn: desc.Intr,
				spacing: parsePercent(desc.Spcn),
				flipX: desc.flipX,
				flipY: desc.flipY,
				name: desc['Nm  '],
				sampledData: desc.sampledData,
			};
		}
		case 'dBrush':
			return {
				type: 'dynamic',
				shape: dynamicBrushShapeShapes[desc['Shp ']],
				angle: parseAngle(desc.Angl),
				size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
				density: parsePercent(desc.Dnst),
				length: parsePercent(desc.Lngt),
				clumping: parsePercent(desc.clumping),
				thickness: parsePercent(desc.thickness),
				stiffness: parsePercent(desc.stiffness),
				physics: desc.physics,
				spacing: parsePercent(desc.Spcn),
				spacingOn: desc.Intr,
				flipX: desc.flipX,
				flipY: desc.flipY,
			};
		case 'dTips': {
			return {
				type: 'tips',
				angle: parseAngle(desc.Angl),
				size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
				shape: dynamicBrushShapeShapes[desc['Shp ']],
				physics: desc.physics,
				spacing: parsePercent(desc.Spcn),
				spacingOn: desc.Intr,
				flipX: desc.flipX,
				flipY: desc.flipY,
				// tips:
				tipsType: tipsBrushShapeShapes[desc.dtipsType],
				tipsLengthRatio: parsePercent(desc.dtipsLengthRatio),
				tipsHardness: parsePercent(desc.dtipsHardness),
				...((desc.dtipsGridSize && desc.dtipsErodibleTipHeightMap) ? {
					tipsGridSize: desc.dtipsGridSize,
					tipsErodibleTipHeightMap: parseHeightmap(desc.dtipsErodibleTipHeightMap),
				} : {}),
				// airbrush
				tipsAirbrushCutoffAngle: desc.dtipsAirbrushCutoffAngle,
				tipsAirbrushGranularity: parsePercent(desc.dtipsAirbrushGranularity),
				tipsAirbrushStreakiness: parsePercent(desc.dtipsAirbrushStreakiness),
				tipsAirbrushSplatSize: parsePercent(desc.dtipsAirbrushSplatSize),
				tipsAirbrushSplatCount: desc.dtipsAirbrushSplatCount,
			};
		}
		default:
			// console.log(require('util').inspect(desc, false, 99, true));
			throw new Error(`Unknown brush classId: ${(desc as any)._classID}`);
	}
}

function parseHeightmap(array: Uint8Array) {
	const result: number[] = [];
	for (let i = 0; i < array.byteLength; i++) {
		result.push(array[i]);
	}
	return result;
	// const view = new DataView(array.buffer, array.byteOffset, array.byteLength);
	// const result: number[] = [];
	// for (let i = 0, len = (array.byteLength / 4) | 0; i < len; i++) {
	// 	result.push(view.getInt32(i * 4)); ????
	// }
	// return result;
}

export interface ReadAbrOptions {
	logMissingFeatures?: boolean;
	/** Throw on unsupported or invalid parts of the file instead of skipping them */
	throwForMissingFeatures?: boolean;
	/** Memory limit for decoded data in bytes (2GB by default), set to `undefined` explicitly to disable */
	totalMemoryLimit?: number;
}

export function readAbr(buffer: ArrayBufferView, options: ReadAbrOptions = {}): Abr {
	const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	reader.logMissingFeatures = options.logMissingFeatures;
	reader.throwForMissingFeatures = options.throwForMissingFeatures;
	reader.totalMemoryLimit = 'totalMemoryLimit' in options ? options.totalMemoryLimit : 2 * 1024 * 1024 * 1024;

	// skips invalid or unsupported part of the file
	const skip = (e: unknown, what: string) => {
		if (options.throwForMissingFeatures) throw e;
		options.logMissingFeatures && reader.log(`Skipped ${what}: ${(e as Error).message}`);
	};

	if (reader.view.byteLength < 4) throw new Error('Invalid ABR file');

	const version = readInt16(reader);
	const samples: SampleInfo[] = [];
	const brushes: Brush[] = [];
	const patterns: PatternInfo[] = [];
	const brushByPreset: (Brush | undefined)[] = []; // brush for each preset in 'desc' section (brushes that fail to parse are skipped)
	let hierarchy: PhryDescriptor['hierarchy'];

	if (version === 1 || version === 2) {
		readLegacyBrushes(reader, version, samples, brushes, skip);
	} else if (version === 6 || version === 7 || version === 9 || version === 10) {
		const minorVersion = readInt16(reader);
		if (minorVersion !== 1 && minorVersion !== 2) throw new Error('Unsupported ABR minor version');

		// section header is 12 bytes, ignore any shorter trailing data
		while (reader.offset + 12 <= reader.view.byteLength) {
			checkSignature(reader, '8BIM');
			const type = readSignature(reader) as 'samp' | 'desc' | 'patt' | 'phry';
			const size = readUint32(reader);
			const end = Math.min(reader.offset + size, reader.view.byteLength);

			try {
				switch (type) {
					case 'samp': {
						while (reader.offset + 4 <= end) {
							let brushLength = readUint32(reader);
							while (brushLength & 0b11) brushLength++; // pad to 4 byte alignment
							const brushEnd = Math.min(reader.offset + brushLength, end);

							try {
								const sample = readSample(reader, brushEnd, minorVersion);
								samples.push(sample);
							} catch (e) {
								skip(e, 'brush sample');
							}

							reader.offset = brushEnd;
						}
						break;
					}
					case 'desc': {
						const desc: DescDescriptor = readVersionAndDescriptor(reader, true);

						for (const [index, brush] of (desc.Brsh || []).entries()) {
							try {
								const parsed = parseBrush(brush);
								brushes.push(parsed);
								brushByPreset[index] = parsed;
							} catch (e) {
								skip(e, `brush "${brush['Nm  ']}"`);
							}
						}
						break;
					}
					case 'patt': {
						while (reader.offset + 4 <= end) {
							const pattern = readPatternSafe(reader);
							if (pattern) patterns.push(pattern);
						}
						break;
					}
					case 'phry': { // brush groups (folders in brushes panel)
						// flat list of group starts, presets (in the same order as in 'desc' section) and group ends
						const desc: PhryDescriptor = readVersionAndDescriptor(reader, true);
						hierarchy = desc.hierarchy;
						break;
					}
					default:
						// 'lPdc' (tool presets) and other unknown sections
						options.logMissingFeatures && reader.log(`Unhandled brush section: ${type}`);
						break;
				}
			} catch (e) {
				skip(e, `brush section ${type}`);
			}

			// skip any unread data in the section and align to 4 bytes
			reader.offset = end;
			while (reader.offset % 4) reader.offset++;
		}
	} else {
		throw new Error(`Unsupported ABR version (${version})`);
	}

	if (hierarchy) {
		const groups: string[] = [];
		let presetIndex = 0;

		for (const item of hierarchy) {
			if (item._classID === 'Grup') {
				groups.push(item['Nm  ']);
			} else if (item._classID === 'groupEnd') {
				groups.pop();
			} else if (item._classID === 'preset') {
				const brush = brushByPreset[presetIndex];
				if (brush && groups.length) brush.group = groups.slice();
				presetIndex++;
			}
		}
	}

	return { samples, patterns, brushes };
}

function readSample(reader: PsdReader, brushEnd: number, minorVersion: number): SampleInfo {
	const id = readPascalString(reader, 1);

	// v1 - Skip the Int16 bounds rectangle and the unknown Int16.
	// v2 - Skip the unknown bytes.
	skipBytes(reader, minorVersion === 1 ? 10 : 264);

	return readSampleBitmap(reader, brushEnd, id);
}

// bounds, bit depth, compression and image data of brush sample
function readSampleBitmap(reader: PsdReader, brushEnd: number, id: string): SampleInfo {
	const y = readInt32(reader);
	const x = readInt32(reader);
	const h = readInt32(reader) - y;
	const w = readInt32(reader) - x;
	if (w <= 0 || h <= 0) throw new Error('Invalid bounds');
	if (w > MAX_BRUSH_SIZE || h > MAX_BRUSH_SIZE) {
		throw new Error(`Brush sample too large (${w}x${h})`);
	}

	const bithDepth = readInt16(reader);
	const compression = readUint8(reader); // 0 - raw, 1 - RLE
	if (bithDepth !== 8 && bithDepth !== 16) throw new Error('Invalid depth');
	if (compression !== 0 && compression !== 1) throw new Error('Invalid compression');
	const rowSize = w * (bithDepth === 16 ? 2 : 1);
	// RLE needs at least 2 bytes for row length and 2 bytes per each 128 byte run
	const minDataSize = compression === 0 ? h * rowSize : h * (2 + Math.ceil(rowSize / 128) * 2);
	if (minDataSize > brushEnd - reader.offset) {
		throw new Error('Brush sample data out of bounds');
	}

	consumeMemory(reader, w * h * (compression === 1 && bithDepth === 16 ? 3 : 1));
	const alpha = new Uint8Array(w * h);

	if (bithDepth === 8) {
		if (compression === 0) {
			alpha.set(readBytes(reader, alpha.byteLength));
		} else if (compression === 1) {
			readDataRLE(reader, { width: w, height: h, data: alpha }, w, h, bithDepth, 1, [0], false);
		} else {
			throw new Error('Invalid compression');
		}
	} else if (bithDepth === 16) {
		if (compression === 0) {
			for (let i = 0; i < alpha.byteLength; i++) {
				alpha[i] = readUint16(reader) >> 8; // convert to 8bit values
			}
		} else if (compression === 1) {
			const data = new Uint16Array(w * h);
			readDataRLE(reader, { width: w, height: h, data }, w, h, bithDepth, 1, [0], false);
			for (let i = 0; i < alpha.byteLength; i++) {
				alpha[i] = data[i] >> 8; // convert to 8bit values
			}
		} else {
			throw new Error('Invalid compression');
		}
	} else {
		throw new Error('Invalid depth');
	}

	return { id, bounds: { x, y, w, h }, alpha };
}

// ABR versions 1 and 2 (Photoshop 6 and earlier) contain a list of brushes with brush tips in them
function readLegacyBrushes(reader: PsdReader, version: number, samples: SampleInfo[], brushes: Brush[], skip: (e: unknown, what: string) => void) {
	const count = readUint16(reader);

	for (let i = 0; i < count; i++) {
		const type = readUint16(reader);
		const size = readUint32(reader);
		const end = reader.offset + size;

		if (end > reader.view.byteLength) { // truncated file
			skip(new Error('Brush data out of bounds'), `brush ${i + 1}`);
			break;
		}

		try {
			if (type === 1) { // computed brush
				skipBytes(reader, 4); // misc
				const spacing = readUint16(reader);
				const diameter = readUint16(reader);
				const roundness = readUint16(reader);
				const angle = readInt16(reader);
				const hardness = readUint16(reader);
				if (reader.offset > end) throw new Error('Brush data out of bounds');

				brushes.push(createLegacyBrush('', {
					type: 'computed',
					size: diameter,
					angle,
					roundness: roundness / 100,
					spacingOn: spacing !== 0,
					spacing: spacing / 100,
					flipX: false,
					flipY: false,
					hardness: hardness / 100,
				}));
			} else if (type === 2) { // sampled brush
				skipBytes(reader, 4); // misc
				const spacing = readUint16(reader);
				const name = version === 2 ? readUnicodeString(reader) : '';
				skipBytes(reader, 1 + 8); // antialiasing, Int16 bounds rectangle (same as Int32 one)

				// legacy brushes don't have sample ids
				const sample = readSampleBitmap(reader, end, `brush-${i + 1}`);
				samples.push(sample);
				brushes.push(createLegacyBrush(name, {
					type: 'sampled',
					size: Math.max(sample.bounds.w, sample.bounds.h),
					angle: 0,
					roundness: 1,
					spacingOn: spacing !== 0,
					spacing: spacing / 100,
					flipX: false,
					flipY: false,
					name,
					sampledData: sample.id,
				}));
			} else {
				throw new Error(`Unknown brush type: ${type}`);
			}
		} catch (e) {
			skip(e, `brush ${i + 1}`);
		}

		reader.offset = end;
	}
}

function createLegacyBrush(name: string, shape: BrushShape): Brush {
	return { name, shape, spacing: 1, wetEdges: false, noise: false, buildUp: false, useBrushSize: true };
}

function parseBrush(brush: DescDescriptor['Brsh'][number]): Brush {
	const b: Brush = {
		name: brush['Nm  '],
		shape: parseBrushShape(brush.Brsh),
		spacing: parsePercent(brush.Spcn),
		wetEdges: brush.Wtdg,
		noise: brush.Nose,
		buildUp: !!brush['Rpt '],
		useBrushSize: brush.useBrushSize, // ???
	};

	if (brush.interpretation != null) b.interpretation = brush.interpretation;
	if (brush.protectTexture != null) b.protectTexture = brush.protectTexture;

	if (brush.useTipDynamics) {
		b.shapeDynamics = {
			tiltScale: parsePercent(brush.tiltScale),
			sizeDynamics: parseDynamics(brush.szVr),
			angleDynamics: parseDynamics(brush.angleDynamics),
			roundnessDynamics: parseDynamics(brush.roundnessDynamics),
			flipX: brush.flipX,
			flipY: brush.flipY,
			brushProjection: brush.brushProjection,
			minimumDiameter: parsePercent(brush.minimumDiameter),
			minimumRoundness: parsePercent(brush.minimumRoundness),
		};
	}

	if (brush.useScatter) {
		b.scatter = {
			count: brush['Cnt '],
			bothAxes: brush.bothAxes,
			countDynamics: parseDynamics(brush.countDynamics),
			scatterDynamics: parseDynamics(brush.scatterDynamics),
		};
	}

	if (brush.useTexture && brush.Txtr) {
		b.texture = {
			id: brush.Txtr.Idnt,
			name: brush.Txtr['Nm  '],
			blendMode: BlnM.decode(brush.textureBlendMode),
			depth: parsePercent(brush.textureDepth),
			depthMinimum: parsePercent(brush.minimumDepth),
			depthDynamics: parseDynamics(brush.textureDepthDynamics),
			scale: parsePercent(brush.textureScale),
			invert: brush.InvT,
			brightness: brush.textureBrightness,
			contrast: brush.textureContrast,
			textureEachTip: !!brush.TxtC,
		};
	}

	const db = brush.dualBrush;
	if (db && db.useDualBrush) {
		b.dualBrush = {
			flip: db.Flip,
			shape: parseBrushShape(db.Brsh),
			blendMode: BlnM.decode(db.BlnM),
			useScatter: db.useScatter,
			spacing: parsePercent(db.Spcn),
			count: db['Cnt '],
			bothAxes: db.bothAxes,
			countDynamics: parseDynamics(db.countDynamics),
			scatterDynamics: parseDynamics(db.scatterDynamics),
		};
	}

	if (brush.useColorDynamics) {
		b.colorDynamics = {
			foregroundBackground: parseDynamics(brush.clVr!),
			hue: parsePercent(brush['H   ']!),
			saturation: parsePercent(brush.Strt!),
			brightness: parsePercent(brush.Brgh!),
			purity: parsePercent(brush.purity!),
			perTip: brush.colorDynamicsPerTip!,
		};
	}

	if (brush.usePaintDynamics) {
		b.transfer = {
			flowDynamics: parseDynamics(brush.prVr!),
			opacityDynamics: parseDynamics(brush.opVr!),
		};

		if (brush.wtVr) b.transfer.wetnessDynamics = parseDynamics(brush.wtVr);
		if (brush.mxVr) b.transfer.mixDynamics = parseDynamics(brush.mxVr);
	}

	if (brush.useBrushPose) {
		b.brushPose = {
			overrideAngle: brush.overridePoseAngle!,
			overrideTiltX: brush.overridePoseTiltX!,
			overrideTiltY: brush.overridePoseTiltY!,
			overridePressure: brush.overridePosePressure!,
			pressure: parsePercent(brush.brushPosePressure!),
			tiltX: brush.brushPoseTiltX!,
			tiltY: brush.brushPoseTiltY!,
			angle: brush.brushPoseAngle!,
		};
	}

	const to = brush.toolOptions;
	if (to) {
		b.toolOptions = {
			type: toBrushType[to._classID] || 'brush',
			brushPreset: to.brushPreset,
			flow: to.flow ?? 100,
			smooth: to.Smoo ?? 0,
			mode: BlnM.decode(to['Md  '] || 'BlnM.Nrml'), // sometimes mode is missing
			opacity: to.Opct ?? 100,
			smoothing: !!to.smoothing,
			smoothingValue: to.smoothingValue || 0,
			smoothingRadiusMode: !!to.smoothingRadiusMode,
			smoothingCatchup: !!to.smoothingCatchup,
			smoothingCatchupAtEnd: !!to.smoothingCatchupAtEnd,
			smoothingZoomCompensation: !!to.smoothingZoomCompensation,
			pressureSmoothing: !!to.pressureSmoothing,
			usePressureOverridesSize: !!to.usePressureOverridesSize,
			usePressureOverridesOpacity: !!to.usePressureOverridesOpacity,
			useLegacy: !!to.useLegacy,
		};

		if (to.prVr) b.toolOptions.flowDynamics = parseDynamics(to.prVr);
		if (to.opVr) b.toolOptions.opacityDynamics = parseDynamics(to.opVr);
		if (to.szVr) b.toolOptions.sizeDynamics = parseDynamics(to.szVr);
		if ('wetness' in to) b.toolOptions.wetness = to.wetness;
		if ('dryness' in to) b.toolOptions.dryness = to.dryness;
		if ('mix' in to) b.toolOptions.mix = to.mix;
		if ('autoFill' in to) b.toolOptions.autoFill = to.autoFill;
		if ('autoClean' in to) b.toolOptions.autoClean = to.autoClean;
		if ('loadSolidColorOnly' in to) b.toolOptions.loadSolidColorOnly = to.loadSolidColorOnly;
		if ('sampleAllLayers' in to) b.toolOptions.sampleAllLayers = to.sampleAllLayers;
		if ('SmdF' in to) b.toolOptions.smudgeFingerPainting = to.SmdF;
		if ('SmdS' in to) b.toolOptions.smudgeSampleAllLayers = to.SmdS;
		if ('Prs ' in to) b.toolOptions.strength = to['Prs '];
	}

	return b;
}
