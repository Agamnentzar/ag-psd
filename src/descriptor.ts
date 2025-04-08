import { createEnum } from './helpers';
import {
	AntiAlias, BevelDirection, BevelStyle, BevelTechnique, BlendMode, Color, EffectContour,
	EffectNoiseGradient, EffectPattern, EffectSolidGradient, ExtraGradientInfo, ExtraPatternInfo,
	GlowSource, GlowTechnique, GradientStyle, InterpolationMethod, LayerEffectBevel,
	LayerEffectGradientOverlay, LayerEffectInnerGlow, LayerEffectPatternOverlay,
	LayerEffectSatin, LayerEffectShadow, LayerEffectsInfo, LayerEffectSolidFill,
	LayerEffectsOuterGlow, LayerEffectStroke, LineAlignment, LineCapType, LineJoinType,
	Orientation, TextGridding, TimelineKey, TimelineKeyInterpolation, TimelineTrack, TimelineTrackType,
	Units, UnitsBounds, UnitsValue, VectorContent, WarpStyle
} from './psd';
import {
	PsdReader, readSignature, readUnicodeString, readUint32, readUint8, readFloat64,
	readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLengthLE
} from './psdReader';
import {
	PsdWriter, writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8,
	writeUnicodeStringWithPadding, writeInt32, writeFloat32, writeUnicodeString, writeInt32LE,
	writeUnicodeStringWithoutLengthLE
} from './psdWriter';

interface Dict { [key: string]: string; }
interface NameClassID { name: string; classID: string; }
interface ExtTypeDict { [key: string]: NameClassID; }

function revMap(map: Dict) {
	const result: Dict = {};
	Object.keys(map).forEach(key => result[map[key]] = key);
	return result;
}

const unitsMap: Dict = {
	'#Ang': 'Angle',
	'#Rsl': 'Density',
	'#Rlt': 'Distance',
	'#Nne': 'None',
	'#Prc': 'Percent',
	'#Pxl': 'Pixels',
	'#Mlm': 'Millimeters',
	'#Pnt': 'Points',
	'RrPi': 'Picas',
	'RrIn': 'Inches',
	'RrCm': 'Centimeters',
};

const unitsMapRev = revMap(unitsMap);
let logErrors = false;

export function setLogErrors(value: boolean) {
	logErrors = value;
}

function makeType(name: string, classID: string) {
	return { name, classID };
}

const nullType = makeType('', 'null');

const USE_CHINESE = false; // Testing

const fieldToExtType: ExtTypeDict = {
	strokeStyleContent: makeType('', 'solidColorLayer'),
	printProofSetup: makeType(USE_CHINESE ? '校样设置' : 'Proof Setup', 'proofSetup'),
	Grad: makeType(USE_CHINESE ? '渐变' : 'Gradient', 'Grdn'),
	Trnf: makeType(USE_CHINESE ? '变换' : 'Transform', 'Trnf'),
	patternFill: makeType('', 'patternFill'),
	ebbl: makeType('', 'ebbl'),
	SoFi: makeType('', 'SoFi'),
	GrFl: makeType('', 'GrFl'),
	sdwC: makeType('', 'RGBC'),
	hglC: makeType('', 'RGBC'),
	'Clr ': makeType('', 'RGBC'),
	'tintColor': makeType('', 'RGBC'),
	Ofst: makeType('', 'Pnt '),
	ChFX: makeType('', 'ChFX'),
	MpgS: makeType('', 'ShpC'),
	DrSh: makeType('', 'DrSh'),
	IrSh: makeType('', 'IrSh'),
	OrGl: makeType('', 'OrGl'),
	IrGl: makeType('', 'IrGl'),
	TrnS: makeType('', 'ShpC'),
	Ptrn: makeType('', 'Ptrn'),
	FrFX: makeType('', 'FrFX'),
	phase: makeType('', 'Pnt '),
	frameStep: nullType,
	duration: nullType,
	workInTime: nullType,
	workOutTime: nullType,
	audioClipGroupList: nullType,
	bounds: makeType('', 'Rctn'),
	customEnvelopeWarp: makeType('', 'customEnvelopeWarp'),
	warp: makeType('', 'warp'),
	'Sz  ': makeType('', 'Pnt '),
	origin: makeType('', 'Pnt '),
	autoExpandOffset: makeType('', 'Pnt '),
	keyOriginShapeBBox: makeType('', 'unitRect'),
	Vrsn: nullType,
	psVersion: nullType,
	docDefaultNewArtboardBackgroundColor: makeType('', 'RGBC'),
	artboardRect: makeType('', 'classFloatRect'),
	keyOriginRRectRadii: makeType('', 'radii'),
	keyOriginBoxCorners: nullType,
	rectangleCornerA: makeType('', 'Pnt '),
	rectangleCornerB: makeType('', 'Pnt '),
	rectangleCornerC: makeType('', 'Pnt '),
	rectangleCornerD: makeType('', 'Pnt '),
	compInfo: nullType,
	quiltWarp: makeType('', 'quiltWarp'),
	generatorSettings: nullType,
	crema: nullType,
	FrIn: nullType,
	blendOptions: nullType,
	FXRf: nullType,
	Lefx: nullType,
	time: nullType,
	animKey: nullType,
	timeScope: nullType,
	inTime: nullType,
	outTime: nullType,
	sheetStyle: nullType,
	translation: nullType,
	Skew: nullType,
	boundingBox: makeType('', 'boundingBox'),
	'Lnk ': makeType('', 'ExternalFileLink'),
	frameReader: makeType('', 'FrameReader'),
	effectParams: makeType('', 'motionTrackEffectParams'),
	Impr: makeType('None', 'none'),
	Anch: makeType('', 'Pnt '),
	'Fwd ': makeType('', 'Pnt '),
	'Bwd ': makeType('', 'Pnt '),
	FlrC: makeType('', 'Pnt '),
	meshBoundaryPath: makeType('', 'pathClass'),
	filterFX: makeType('', 'filterFXStyle'),
	Fltr: makeType('', 'rigidTransform'),
	FrgC: makeType('', 'RGBC'),
	BckC: makeType('', 'RGBC'),
	sdwM: makeType('Parameters', 'adaptCorrectTones'),
	hglM: makeType('Parameters', 'adaptCorrectTones'),
	customShape: makeType('', 'customShape'),
	origFXRefPoint: nullType,
	FXRefPoint: nullType,
	ClMg: makeType('', 'ClMg'),
};

const fieldToArrayExtType: ExtTypeDict = {
	'Crv ': makeType('', 'CrPt'),
	Clrs: makeType('', 'Clrt'),
	Trns: makeType('', 'TrnS'),
	keyDescriptorList: nullType,
	solidFillMulti: makeType('', 'SoFi'),
	gradientFillMulti: makeType('', 'GrFl'),
	dropShadowMulti: makeType('', 'DrSh'),
	innerShadowMulti: makeType('', 'IrSh'),
	frameFXMulti: makeType('', 'FrFX'),
	FrIn: nullType,
	FSts: nullType,
	LaSt: nullType,
	sheetTimelineOptions: nullType,
	trackList: makeType('', 'animationTrack'),
	globalTrackList: makeType('', 'animationTrack'),
	keyList: nullType,
	audioClipGroupList: nullType,
	audioClipList: nullType,
	countObjectList: makeType('', 'countObject'),
	countGroupList: makeType('', 'countGroup'),
	slices: makeType('', 'slice'),
	'Pts ': makeType('', 'Pthp'),
	SbpL: makeType('', 'SbpL'),
	pathComponents: makeType('', 'PaCm'),
	filterFXList: makeType('', 'filterFX'),
	puppetShapeList: makeType('', 'puppetShape'),
	channelDenoise: makeType('', 'channelDenoiseParams'),
	ShrP: makeType('', 'Pnt '),
	layerSettings: nullType,
	list: nullType,
	Adjs: makeType('', 'CrvA'),
};

const typeToField: { [key: string]: string[]; } = {
	'TEXT': [
		'Txt ', 'printerName', 'Nm  ', 'Idnt', 'blackAndWhitePresetFileName', 'LUT3DFileName',
		'presetFileName', 'curvesPresetFileName', 'mixerPresetFileName', 'placed', 'description', 'reason',
		'artboardPresetName', 'json', 'clipID', 'relPath', 'fullPath', 'mediaDescriptor', 'Msge',
		'altTag', 'url', 'cellText', 'preset', 'KnNm', 'FPth', 'comment', 'originalPath',
	],
	'tdta': [
		'EngineData', 'LUT3DFileData', 'indexArray', 'originalVertexArray', 'deformedVertexArray',
		'LqMe',
	],
	'long': [
		'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion', 'LaID', 'Vrsn', 'Cnt ',
		'Brgh', 'Cntr', 'means', 'vibrance', 'Strt', 'bwPresetKind', 'comp', 'compID', 'originalCompID',
		'curvesPresetKind', 'mixerPresetKind', 'uOrder', 'vOrder', 'PgNm', 'totalPages', 'Crop',
		'numerator', 'denominator', 'frameCount', 'Annt', 'keyOriginType', 'unitValueQuadVersion',
		'keyOriginIndex', 'major', 'minor', 'fix', 'docDefaultNewArtboardBackgroundType', 'artboardBackgroundType',
		'numModifyingFX', 'deformNumRows', 'deformNumCols', 'FrID', 'FrDl', 'FsID', 'LCnt', 'AFrm', 'AFSt',
		'numBefore', 'numAfter', 'Spcn', 'minOpacity', 'maxOpacity', 'BlnM', 'sheetID', 'gblA', 'globalAltitude',
		'descVersion', 'frameReaderType', 'LyrI', 'zoomOrigin', 'fontSize', 'Rds ', 'sliceID',
		'topOutset', 'leftOutset', 'bottomOutset', 'rightOutset', 'filterID', 'meshQuality',
		'meshExpansion', 'meshRigidity', 'VrsM', 'VrsN', 'NmbG', 'WLMn', 'WLMx', 'AmMn', 'AmMx', 'SclH', 'SclV',
		'Lvl ', 'TlNm', 'TlOf', 'FlRs', 'Thsh', 'ShrS', 'ShrE', 'FlRs', 'Vrnc', 'Strg', 'ExtS', 'ExtD',
		'HrzS', 'VrtS', 'NmbR', 'EdgF', 'Ang1', 'Ang2', 'Ang3', 'Ang4', 'lastAppliedComp', 'capturedInfo',
	],
	'enum': [
		'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS', 'BlrQ',
		'bvlT', 'bvlS', 'bvlD', 'Md  ', 'glwS', 'GrdF', 'GlwT', 'RplS', 'BlrM', 'SmBM',
		'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
		'strokeStyleBlendMode', 'PntT', 'Styl', 'lookupType', 'LUTFormat', 'dataOrder',
		'tableOrder', 'enableCompCore', 'enableCompCoreGPU', 'compCoreSupport', 'compCoreGPUSupport', 'Engn',
		'enableCompCoreThreads', 'gs99', 'FrDs', 'trackID', 'animInterpStyle', 'horzAlign',
		'vertAlign', 'bgColorType', 'shapeOperation', 'UndA', 'Wvtp', 'Drct', 'WndM', 'Edg ', 'FlCl', 'IntE',
		'IntC', 'Cnvr', 'Fl  ', 'Dstr', 'MztT', 'Lns ', 'ExtT', 'DspM', 'ExtR', 'ZZTy', 'SphM', 'SmBQ', 'placedLayerOCIOConversion', 'gradientsInterpolationMethod',
	],
	'bool': [
		'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss',
		'useShape', 'useTexture', 'uglg', 'antialiasGloss', 'useShape', 'Vsbl',
		'useTexture', 'Algn', 'Rvrs', 'Dthr', 'Invr', 'VctC', 'ShTr', 'layerConceals',
		'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock', 'strokeStyleStrokeAdjust',
		'hardProof', 'MpBl', 'paperWhite', 'useLegacy', 'Auto', 'Lab ', 'useTint', 'keyShapeInvalidated',
		'autoExpandEnabled', 'autoNestEnabled', 'autoPositionEnabled', 'shrinkwrapOnSaveEnabled',
		'present', 'showInDialog', 'overprint', 'sheetDisclosed', 'lightsDisclosed', 'meshesDisclosed',
		'materialsDisclosed', 'hasMotion', 'muted', 'Effc', 'selected', 'autoScope', 'fillCanvas',
		'cellTextIsHTML', 'Smoo', 'Clsp', 'validAtPosition', 'rigidType', 'hasoptions', 'filterMaskEnable',
		'filterMaskLinked', 'filterMaskExtendWithWhite', 'removeJPEGArtifact', 'Mnch', 'ExtF', 'ExtM',
		'moreAccurate', 'GpuY', 'LIWy', 'Cnty',
	],
	'doub': [
		'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Wdth', 'Hght',
		'strokeStyleMiterLimit', 'strokeStyleResolution', 'layerTime', 'keyOriginResolution',
		'xx', 'xy', 'yx', 'yy', 'tx', 'ty', 'FrGA', 'frameRate', 'audioLevel', 'rotation',
		'X   ', 'Y   ', 'redFloat', 'greenFloat', 'blueFloat', 'imageResolution',
		'PuX0', 'PuX1', 'PuX2', 'PuX3', 'PuY0', 'PuY1', 'PuY2', 'PuY3'
	],
	'UntF': [
		'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl',
		'Ckmt', 'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset',
		'strokeStyleOpacity', 'H   ', 'Top ', 'Left', 'Btom', 'Rght', 'Rslt',
		'topRight', 'topLeft', 'bottomLeft', 'bottomRight', 'ClNs', 'Shrp',
	],
	'VlLs': [
		'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet', 'FrLs', 'slices',
		'LaSt', 'Trnf', 'nonAffineTransform', 'keyDescriptorList', 'guideIndeces', 'gradientFillMulti',
		'solidFillMulti', 'frameFXMulti', 'innerShadowMulti', 'dropShadowMulti', 'FrIn', 'FSts', 'FsFr',
		'sheetTimelineOptions', 'audioClipList', 'trackList', 'globalTrackList', 'keyList', 'audioClipList',
		'warpValues', 'selectedPin', 'Pts ', 'SbpL', 'pathComponents', 'pinOffsets', 'posFinalPins',
		'pinVertexIndices', 'PinP', 'PnRt', 'PnOv', 'PnDp', 'filterFXList', 'puppetShapeList', 'ShrP',
		'channelDenoise', 'Mtrx', 'layerSettings', 'list', 'compList', 'Adjs',
	],
	'ObAr': ['meshPoints', 'quiltSliceX', 'quiltSliceY'],
	'obj ': ['null', 'Chnl'],
	'Pth ': ['DspF'],
};

const channels = [
	'Rd  ', 'Grn ', 'Bl  ', 'Yllw', 'Ylw ', 'Cyn ', 'Mgnt', 'Blck', 'Gry ', 'Lmnc', 'A   ', 'B   ',
];

const fieldToArrayType: Dict = {
	'Mnm ': 'long',
	'Mxm ': 'long',
	FrLs: 'long',
	strokeStyleLineDashSet: 'UntF',
	Trnf: 'doub',
	nonAffineTransform: 'doub',
	keyDescriptorList: 'Objc',
	gradientFillMulti: 'Objc',
	solidFillMulti: 'Objc',
	frameFXMulti: 'Objc',
	innerShadowMulti: 'Objc',
	dropShadowMulti: 'Objc',
	LaSt: 'Objc',
	FrIn: 'Objc',
	FSts: 'Objc',
	FsFr: 'long',
	blendOptions: 'Objc',
	sheetTimelineOptions: 'Objc',
	keyList: 'Objc',
	warpValues: 'doub',
	selectedPin: 'long',
	'Pts ': 'Objc',
	SbpL: 'Objc',
	pathComponents: 'Objc',
	pinOffsets: 'doub',
	posFinalPins: 'doub',
	pinVertexIndices: 'long',
	PinP: 'doub',
	PnRt: 'long',
	PnOv: 'bool',
	PnDp: 'doub',
	filterFXList: 'Objc',
	puppetShapeList: 'Objc',
	ShrP: 'Objc',
	channelDenoise: 'Objc',
	Mtrx: 'long',
	compList: 'long',
	Chnl: 'enum',
};

const fieldToType: Dict = {};

for (const type of Object.keys(typeToField)) {
	for (const field of typeToField[type]) {
		fieldToType[field] = type;
	}
}

for (const field of Object.keys(fieldToExtType)) {
	if (!fieldToType[field]) fieldToType[field] = 'Objc';
}

for (const field of Object.keys(fieldToArrayExtType)) {
	fieldToArrayType[field] = 'Objc';
}

function getTypeByKey(key: string, value: any, root: string, parent: any) {
	if (key === 'presetKind') {
		return typeof value === 'string' ? 'enum' : 'long';
	} if (key === 'null' && root === 'slices') {
		return 'TEXT';
	} else if (key === 'groupID') {
		return root === 'slices' ? 'long' : 'TEXT';
	} else if (key === 'Sz  ') {
		return ('Wdth' in value) ? 'Objc' : (('units' in value) ? 'UntF' : 'doub');
	} else if (key === 'Type') {
		return typeof value === 'string' ? 'enum' : 'long';
	} else if (key === 'AntA') {
		return typeof value === 'string' ? 'enum' : 'bool';
	} else if ((key === 'Hrzn' || key === 'Vrtc') && (parent.Type === 'keyType.Pstn' || parent._classID === 'Ofst')) {
		return 'long';
	} else if (key === 'Hrzn' || key === 'Vrtc' || key === 'Top ' || key === 'Left' || key === 'Btom' || key === 'Rght') {
		if (root === 'slices') return 'long';
		return typeof value === 'number' ? 'doub' : 'UntF';
	} else if (key === 'Vrsn') {
		return typeof value === 'number' ? 'long' : 'Objc';
	} else if (key === 'Rd  ' || key === 'Grn ' || key === 'Bl  ') {
		return root === 'artd' ? 'long' : 'doub';
	} else if (key === 'Trnf') {
		return Array.isArray(value) ? 'VlLs' : 'Objc';
	} else {
		return fieldToType[key];
	}
}

export function readAsciiStringOrClassId(reader: PsdReader) {
	const length = readInt32(reader);
	return readAsciiString(reader, length || 4);
}

function writeAsciiStringOrClassId(writer: PsdWriter, value: string) {
	if (value.length === 4 && value !== 'warp' && value !== 'time' && value !== 'hold' && value !== 'list') {
		// write classId
		writeInt32(writer, 0);
		writeSignature(writer, value);
	} else {
		// write ascii string
		writeInt32(writer, value.length);

		for (let i = 0; i < value.length; i++) {
			writeUint8(writer, value.charCodeAt(i));
		}
	}
}

export function readDescriptorStructure(reader: PsdReader, includeClass: boolean) {
	const struct = readClassStructure(reader);
	const object: any = includeClass ? { _name: struct.name, _classID: struct.classID } : {};
	// console.log('>> ', struct);
	const itemsCount = readUint32(reader);

	for (let i = 0; i < itemsCount; i++) {
		const key = readAsciiStringOrClassId(reader);
		const type = readSignature(reader);
		// console.log(`> '${key}' '${type}'`);
		const data = readOSType(reader, type, includeClass);
		// if (!getTypeByKey(key, data)) console.log(`> '${key}' '${type}'`, data);
		object[key] = data;
	}

	return object;
}

export function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any, root: string) {
	if (logErrors && !classId) console.log('Missing classId for: ', name, classId, value);

	// write class structure
	writeUnicodeStringWithPadding(writer, name);
	writeAsciiStringOrClassId(writer, classId);

	const keys = Object.keys(value);
	let keyCount = keys.length;
	if ('_name' in value) keyCount--;
	if ('_classID' in value) keyCount--;

	writeUint32(writer, keyCount);

	for (const key of keys) {
		if (key === '_name' || key === '_classID') continue;

		let type = getTypeByKey(key, value[key], root, value);
		let extType = fieldToExtType[key];

		if (key === 'bounds' && root === 'text') {
			extType = makeType('', 'bounds');
		} else if (key === 'origin') {
			type = root === 'slices' ? 'enum' : 'Objc';
		} else if ((key === 'Cyn ' || key === 'Mgnt' || key === 'Ylw ' || key === 'Blck') && value._classID === 'CMYC') {
			type = 'doub';
		} else if (/^PN[a-z][a-z]$/.test(key)) {
			type = 'TEXT';
		} else if (/^PT[a-z][a-z]$/.test(key)) {
			type = 'long';
		} else if (/^PF[a-z][a-z]$/.test(key)) {
			type = 'doub';
		} else if ((key === 'Rds ' || key === 'Thsh') && typeof value[key] === 'number' && value._classID === 'SmrB') {
			type = 'doub';
		} else if (key === 'ClSz' || key === 'Rds ' || key === 'Amnt') {
			type = typeof value[key] === 'number' ? 'long' : 'UntF';
		} else if ((key === 'sdwM' || key === 'hglM') && typeof value[key] === 'string') {
			type = 'enum';
		} else if (key === 'blur' && typeof value[key] === 'string') {
			type = 'enum';
		} else if (key === 'Hght' && typeof value[key] === 'number' && value._classID === 'Embs') {
			type = 'long';
		} else if (key === 'Angl' && typeof value[key] === 'number' && (value._classID === 'Embs' || value._classID === 'smartSharpen' || value._classID === 'Twrl' || value._classID === 'MtnB')) {
			type = 'long';
		} else if (key === 'Angl' && typeof value[key] === 'number') {
			type = 'doub'; // ???
		} else if (key === 'bounds' && root === 'slices') {
			type = 'Objc';
			extType = makeType('', 'Rct1');
		} else if (key === 'Scl ') {
			if (typeof value[key] === 'object' && 'Hrzn' in value[key]) {
				type = 'Objc';
				extType = nullType;
			} else if (typeof value[key] === 'number') {
				type = 'long';
			} else {
				type = 'UntF';
			}
		} else if (key === 'audioClipGroupList' && keys.length === 1) {
			type = 'VlLs';
		} else if ((key === 'Strt' || key === 'Brgh') && 'H   ' in value) {
			type = 'doub';
		} else if (key === 'Wdth' && typeof value[key] === 'object') {
			type = 'UntF';
		} else if (key === 'Ofst' && typeof value[key] === 'number') {
			type = 'long';
		} else if (key === 'Strt' && typeof value[key] === 'object') {
			type = 'Objc';
			extType = nullType;
		} else if (channels.indexOf(key) !== -1) {
			type = (classId === 'RGBC' && root !== 'artd') ? 'doub' : 'long';
		} else if (key === 'profile') {
			type = classId === 'printOutput' ? 'TEXT' : 'tdta';
		} else if (key === 'strokeStyleContent') {
			if (value[key]['Clr ']) {
				extType = makeType('', 'solidColorLayer');
			} else if (value[key].Grad) {
				extType = makeType('', 'gradientLayer');
			} else if (value[key].Ptrn) {
				extType = makeType('', 'patternLayer');
			} else {
				logErrors && console.log('Invalid strokeStyleContent value', value[key]);
			}
		} else if (key === 'bounds' && root === 'quiltWarp') {
			extType = makeType('', 'classFloatRect');
		}

		if (extType && extType.classID === 'RGBC') {
			if ('H   ' in value[key]) extType = { classID: 'HSBC', name: '' };
			// TODO: other color spaces
		}

		writeAsciiStringOrClassId(writer, key);
		writeSignature(writer, type || 'long');
		writeOSType(writer, type || 'long', value[key], key, extType, root);
		if (logErrors && !type) console.log(`Missing descriptor field type for: '${key}' in`, value);
	}
}

function readOSType(reader: PsdReader, type: string, includeClass: boolean) {
	switch (type) {
		case 'obj ': // Reference
			return readReferenceStructure(reader);
		case 'Objc': // Descriptor
		case 'GlbO': // GlobalObject same as Descriptor
			return readDescriptorStructure(reader, includeClass);
		case 'VlLs': { // List
			const length = readInt32(reader);
			const items: any[] = [];

			for (let i = 0; i < length; i++) {
				const itemType = readSignature(reader);
				// console.log('  >', itemType);
				items.push(readOSType(reader, itemType, includeClass));
			}

			return items;
		}
		case 'doub': // Double
			return readFloat64(reader);
		case 'UntF': { // Unit double
			const units = readSignature(reader);
			const value = readFloat64(reader);
			if (!unitsMap[units]) throw new Error(`Invalid units: ${units}`);
			return { units: unitsMap[units], value };
		}
		case 'UnFl': { // Unit float
			const units = readSignature(reader);
			const value = readFloat32(reader);
			if (!unitsMap[units]) throw new Error(`Invalid units: ${units}`);
			return { units: unitsMap[units], value };
		}
		case 'TEXT': // String
			return readUnicodeString(reader);
		case 'enum': { // Enumerated
			const enumType = readAsciiStringOrClassId(reader);
			const value = readAsciiStringOrClassId(reader);
			return `${enumType}.${value}`;
		}
		case 'long': // Integer
			return readInt32(reader);
		case 'comp': { // Large Integer
			const low = readUint32(reader);
			const high = readUint32(reader);
			return { low, high };
		}
		case 'bool': // Boolean
			return !!readUint8(reader);
		case 'type': // Class
		case 'GlbC': // Class
			return readClassStructure(reader);
		case 'alis': { // Alias
			const length = readInt32(reader);
			return readAsciiString(reader, length);
		}
		case 'tdta': { // Raw Data
			const length = readInt32(reader);
			return readBytes(reader, length);
		}
		case 'ObAr': { // Object array
			readInt32(reader); // version: 16
			readUnicodeString(reader); // name: ''
			readAsciiStringOrClassId(reader); // 'rationalPoint'
			const length = readInt32(reader);
			const items: any[] = [];

			for (let i = 0; i < length; i++) {
				const type1 = readAsciiStringOrClassId(reader); // type Hrzn | Vrtc
				readSignature(reader); // UnFl

				readSignature(reader); // units ? '#Pxl'
				const valuesCount = readInt32(reader);
				const values: number[] = [];
				for (let j = 0; j < valuesCount; j++) {
					values.push(readFloat64(reader));
				}

				items.push({ type: type1, values });
			}

			return items;
		}
		case 'Pth ': { // File path
			/*const length =*/ readInt32(reader); // total size of all fields below
			const sig = readSignature(reader);
			/*const pathSize =*/ readInt32LE(reader); // the same as length
			const charsCount = readInt32LE(reader);
			const path = readUnicodeStringWithLengthLE(reader, charsCount);
			return { sig, path };
		}
		default:
			throw new Error(`Invalid TySh descriptor OSType: ${type} at ${reader.offset.toString(16)}`);
	}
}

const ObArTypes: { [key: string]: string | undefined; } = {
	meshPoints: 'rationalPoint',
	quiltSliceX: 'UntF',
	quiltSliceY: 'UntF',
};

function writeOSType(writer: PsdWriter, type: string, value: any, key: string, extType: NameClassID | undefined, root: string) {
	switch (type) {
		case 'obj ': // Reference
			writeReferenceStructure(writer, key, value);
			break;
		case 'Objc': // Descriptor
		case 'GlbO': { // GlobalObject same as Descriptor
			if (typeof value !== 'object') throw new Error(`Invalid struct value: ${JSON.stringify(value)}, key: ${key}`);
			if (!extType) throw new Error(`Missing ext type for: '${key}' (${JSON.stringify(value)})`);
			const name = value._name || extType.name;
			const classID = value._classID || extType.classID;
			writeDescriptorStructure(writer, name, classID, value, root);
			break;
		}
		case 'VlLs': // List
			if (!Array.isArray(value)) throw new Error(`Invalid list value: ${JSON.stringify(value)}, key: ${key}`);
			writeInt32(writer, value.length);

			for (let i = 0; i < value.length; i++) {
				const type = fieldToArrayType[key];
				writeSignature(writer, type || 'long');
				writeOSType(writer, type || 'long', value[i], `${key}[]`, fieldToArrayExtType[key], root);
				if (logErrors && !type) console.log(`Missing descriptor array type for: '${key}' in`, value);
			}
			break;
		case 'doub': // Double
			if (typeof value !== 'number') throw new Error(`Invalid number value: ${JSON.stringify(value)}, key: ${key}`);
			writeFloat64(writer, value);
			break;
		case 'UntF': // Unit double
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units} in ${key}`);
			writeSignature(writer, unitsMapRev[value.units]);
			writeFloat64(writer, value.value);
			break;
		case 'UnFl': // Unit float
			if (!unitsMapRev[value.units]) throw new Error(`Invalid units: ${value.units} in ${key}`);
			writeSignature(writer, unitsMapRev[value.units]);
			writeFloat32(writer, value.value);
			break;
		case 'TEXT': // String
			writeUnicodeStringWithPadding(writer, value);
			break;
		case 'enum': { // Enumerated
			if (typeof value !== 'string') throw new Error(`Invalid enum value: ${JSON.stringify(value)}, key: ${key}`);
			const [_type, val] = value.split('.');
			writeAsciiStringOrClassId(writer, _type);
			writeAsciiStringOrClassId(writer, val);
			break;
		}
		case 'long': // Integer
			if (typeof value !== 'number') throw new Error(`Invalid integer value: ${JSON.stringify(value)}, key: ${key}`);
			writeInt32(writer, value);
			break;
		// case 'comp': // Large Integer
		// 	writeLargeInteger(reader);
		case 'bool': // Boolean
			if (typeof value !== 'boolean') throw new Error(`Invalid boolean value: ${JSON.stringify(value)}, key: ${key}`);
			writeUint8(writer, value ? 1 : 0);
			break;
		// case 'type': // Class
		// case 'GlbC': // Class
		// 	writeClassStructure(reader);
		// case 'alis': // Alias
		// 	writeAliasStructure(reader);
		case 'tdta': // Raw Data
			writeInt32(writer, value.byteLength);
			writeBytes(writer, value);
			break;
		case 'ObAr': { // Object array
			writeInt32(writer, 16); // version
			writeUnicodeStringWithPadding(writer, ''); // name
			const type = ObArTypes[key];
			if (!type) throw new Error(`Not implemented ObArType for: ${key}`);
			writeAsciiStringOrClassId(writer, type);
			writeInt32(writer, value.length);

			for (let i = 0; i < value.length; i++) {
				writeAsciiStringOrClassId(writer, value[i].type); // Hrzn | Vrtc
				writeSignature(writer, 'UnFl');
				writeSignature(writer, '#Pxl');
				writeInt32(writer, value[i].values.length);

				for (let j = 0; j < value[i].values.length; j++) {
					writeFloat64(writer, value[i].values[j]);
				}
			}
			break;
		}
		case 'Pth ': { // File path
			const length = 4 + 4 + 4 + value.path.length * 2;
			writeInt32(writer, length);
			writeSignature(writer, value.sig);
			writeInt32LE(writer, length);
			writeInt32LE(writer, value.path.length);
			writeUnicodeStringWithoutLengthLE(writer, value.path);
			break;
		}
		default:
			throw new Error(`Not implemented descriptor OSType: ${type}`);
	}
}

function readReferenceStructure(reader: PsdReader) {
	const itemsCount = readInt32(reader);
	const items: any[] = [];

	for (let i = 0; i < itemsCount; i++) {
		const type = readSignature(reader);

		switch (type) {
			case 'prop': { // Property
				readClassStructure(reader);
				const keyID = readAsciiStringOrClassId(reader);
				items.push(keyID);
				break;
			}
			case 'Clss': // Class
				items.push(readClassStructure(reader));
				break;
			case 'Enmr': { // Enumerated Reference
				readClassStructure(reader);
				const typeID = readAsciiStringOrClassId(reader);
				const value = readAsciiStringOrClassId(reader);
				items.push(`${typeID}.${value}`);
				break;
			}
			case 'rele': { // Offset
				// const { name, classID } =
				readClassStructure(reader);
				items.push(readUint32(reader));
				break;
			}
			case 'Idnt': // Identifier
				items.push(readInt32(reader));
				break;
			case 'indx': // Index
				items.push(readInt32(reader));
				break;
			case 'name': { // Name
				readClassStructure(reader);
				items.push(readUnicodeString(reader));
				break;
			}
			default:
				throw new Error(`Invalid descriptor reference type: ${type}`);
		}
	}

	return items;
}

function writeReferenceStructure(writer: PsdWriter, _key: string, items: any[]) {
	writeInt32(writer, items.length);

	for (let i = 0; i < items.length; i++) {
		const value = items[i];
		let type = 'unknown';

		if (typeof value === 'string') {
			if (/^[a-z ]+\.[a-z ]+$/i.test(value)) {
				type = 'Enmr';
			} else {
				type = 'name';
			}
		}

		writeSignature(writer, type);

		switch (type) {
			// case 'prop': // Property
			// case 'Clss': // Class
			case 'Enmr': { // Enumerated Reference
				const [typeID, enumValue] = value.split('.');
				writeClassStructure(writer, '\0', typeID);
				writeAsciiStringOrClassId(writer, typeID);
				writeAsciiStringOrClassId(writer, enumValue);
				break;
			}
			// case 'rele': // Offset
			// case 'Idnt': // Identifier
			// case 'indx': // Index
			case 'name': { // Name
				writeClassStructure(writer, '\0', 'Lyr ');
				writeUnicodeString(writer, value + '\0');
				break;
			}
			default:
				throw new Error(`Invalid descriptor reference type: ${type}`);
		}
	}

	return items;
}

function readClassStructure(reader: PsdReader) {
	const name = readUnicodeString(reader);
	const classID = readAsciiStringOrClassId(reader);
	return { name, classID };
}

function writeClassStructure(writer: PsdWriter, name: string, classID: string) {
	writeUnicodeString(writer, name);
	writeAsciiStringOrClassId(writer, classID);
}

export function readVersionAndDescriptor(reader: PsdReader, includeClass = false) {
	const version = readUint32(reader);
	if (version !== 16) throw new Error(`Invalid descriptor version: ${version}`);
	const desc = readDescriptorStructure(reader, includeClass);
	// console.log(require('util').inspect(desc, false, 99, true));
	return desc;
}

export function writeVersionAndDescriptor(writer: PsdWriter, name: string, classID: string, descriptor: any, root = '') {
	writeUint32(writer, 16); // version
	writeDescriptorStructure(writer, name, classID, descriptor, root);
}

export type DescriptorUnits = 'Angle' | 'Density' | 'Distance' | 'None' | 'Percent' | 'Pixels' |
	'Millimeters' | 'Points' | 'Picas' | 'Inches' | 'Centimeters';

export interface DescriptorUnitsValue {
	units: DescriptorUnits;
	value: number;
}

export type DescriptorColor = {
	_name: '';
	_classID: 'RGBC';
	'Rd  ': number;
	'Grn ': number;
	'Bl  ': number;
} | {
	_name: '';
	_classID: 'HSBC'; // ???
	'H   ': DescriptorUnitsValue;
	Strt: number;
	Brgh: number;
} | {
	_name: '';
	_classID: 'CMYC';
	'Cyn ': number;
	Mgnt: number;
	'Ylw ': number;
	Blck: number;
} | {
	_name: '';
	_classID: 'GRYC'; // ???
	'Gry ': number;
} | {
	_name: '';
	_classID: 'LABC'; // ???
	Lmnc: number;
	'A   ': number;
	'B   ': number;
} | {
	_name: '';
	_classID: 'RGBC';
	redFloat: number;
	greenFloat: number;
	blueFloat: number;
};

export interface DesciptorPattern {
	'Nm  ': string;
	Idnt: string;
}

export type DesciptorGradient = {
	'Nm  ': string;
	GrdF: 'GrdF.CstS';
	Intr: number;
	Clrs: {
		'Clr ': DescriptorColor;
		Type: 'Clry.UsrS';
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

export interface DescriptorColorContent {
	'Clr ': DescriptorColor;
}

export interface DescriptorGradientContent {
	Dthr?: boolean;
	gradientsInterpolationMethod?: string; // 'gradientInterpolationMethodType.Smoo'
	Angl?: DescriptorUnitsValue;
	Type: string;
	Grad: DesciptorGradient;
	Rvrs?: boolean;
	'Scl '?: DescriptorUnitsValue;
	Algn?: boolean;
	Ofst?: { Hrzn: DescriptorUnitsValue; Vrtc: DescriptorUnitsValue; };
}

export interface DescriptorPatternContent {
	Ptrn: DesciptorPattern;
	Lnkd?: boolean;
	phase?: { Hrzn: number; Vrtc: number; };
}

export type DescriptorVectorContent = DescriptorColorContent | DescriptorGradientContent | DescriptorPatternContent;

export interface StrokeDescriptor {
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

export interface BoundsDescriptor {
	Left: DescriptorUnitsValue;
	'Top ': DescriptorUnitsValue;
	Rght: DescriptorUnitsValue;
	Btom: DescriptorUnitsValue;
}

export interface TextDescriptor {
	'Txt ': string;
	textGridding: string;
	Ornt: string;
	AntA: string;
	bounds?: BoundsDescriptor;
	boundingBox?: BoundsDescriptor;
	TextIndex: number;
	EngineData?: Uint8Array;
}

export interface WarpDescriptor {
	warpStyle: string;
	warpValue?: number;
	warpValues?: number[]
	warpPerspective: number;
	warpPerspectiveOther: number;
	warpRotate: string;
	bounds?: {
		'Top ': DescriptorUnitsValue;
		Left: DescriptorUnitsValue;
		Btom: DescriptorUnitsValue;
		Rght: DescriptorUnitsValue;
	} | {
		_classID: 'classFloatRect',
		'Top ': number,
		Left: number,
		Btom: number,
		Rght: number,
	},
	uOrder: number;
	vOrder: number;
	customEnvelopeWarp?: {
		_name: '';
		_classID: 'customEnvelopeWarp';
		meshPoints: {
			type: 'Hrzn' | 'Vrtc';
			values: number[];
		}[];
	};
}

export interface QuiltWarpDescriptor extends WarpDescriptor {
	deformNumRows: number;
	deformNumCols: number;
	customEnvelopeWarp: {
		_name: '';
		_classID: 'customEnvelopeWarp';
		quiltSliceX: {
			type: 'quiltSliceX';
			values: number[];
		}[];
		quiltSliceY: {
			type: 'quiltSliceY';
			values: number[];
		}[];
		meshPoints: {
			type: 'Hrzn' | 'Vrtc';
			values: number[];
		}[];
	};
}

export interface FractionDescriptor {
	numerator: number;
	denominator: number;
}

export interface HrznVrtcDescriptor {
	Hrzn: number;
	Vrtc: number;
}

export interface FrameDescriptor {
	FrLs: number[];
	enab?: boolean;
	IMsk?: { Ofst: HrznVrtcDescriptor };
	VMsk?: { Ofst: HrznVrtcDescriptor };
	Ofst?: HrznVrtcDescriptor;
	FXRf?: HrznVrtcDescriptor;
	Lefx?: Lfx2Descriptor;
	blendOptions?: { Opct: DescriptorUnitsValue; };
}

export interface FrameListDescriptor {
	LaID: number; // layer ID
	LaSt: FrameDescriptor[];
}

export function horzVrtcToXY(hv: HrznVrtcDescriptor): { x: number; y: number; } {
	return { x: hv.Hrzn, y: hv.Vrtc };
}

export function xyToHorzVrtc(xy: { x: number; y: number; }): HrznVrtcDescriptor {
	return { Hrzn: xy.x, Vrtc: xy.y };
}

export function descBoundsToBounds(desc: BoundsDescriptor): UnitsBounds {
	return {
		top: parseUnits(desc['Top ']),
		left: parseUnits(desc.Left),
		right: parseUnits(desc.Rght),
		bottom: parseUnits(desc.Btom),
	};
}

export function boundsToDescBounds(bounds: UnitsBounds): BoundsDescriptor {
	return {
		Left: unitsValue(bounds.left, 'bounds.left'),
		['Top ']: unitsValue(bounds.top, 'bounds.top'),
		Rght: unitsValue(bounds.right, 'bounds.right'),
		Btom: unitsValue(bounds.bottom, 'bounds.bottom'),
	};
}

export type TimelineAnimKeyDescriptor = {
	Type: 'keyType.Opct';
	Opct: DescriptorUnitsValue;
} | {
	Type: 'keyType.Trnf';
	'Scl ': HrznVrtcDescriptor;
	Skew: HrznVrtcDescriptor;
	rotation: number;
	translation: HrznVrtcDescriptor;
} | {
	Type: 'keyType.Pstn';
	Hrzn: number;
	Vrtc: number;
} | {
	Type: 'keyType.sheetStyle';
	sheetStyle: {
		Vrsn: number;
		Lefx?: Lfx2Descriptor;
		blendOptions: {};
	};
} | {
	Type: 'keyType.globalLighting';
	gblA: number;
	globalAltitude: number;
};

export interface TimelineKeyDescriptor {
	Vrsn: 1;
	animInterpStyle: 'animInterpStyle.Lnr ' | 'animInterpStyle.hold';
	time: FractionDescriptor;
	animKey: TimelineAnimKeyDescriptor;
	selected: boolean;
}

export interface TimelineTrackDescriptor {
	trackID: 'stdTrackID.globalLightingTrack' | 'stdTrackID.opacityTrack' | 'stdTrackID.styleTrack' | 'stdTrackID.sheetTransformTrack' | 'stdTrackID.sheetPositionTrack';
	Vrsn: 1;
	enab: boolean;
	Effc: boolean;
	effectParams?: {
		keyList: TimelineKeyDescriptor[];
		fillCanvas: boolean;
		zoomOrigin: number;
	};
	keyList: TimelineKeyDescriptor[];
}

export interface TimeScopeDescriptor {
	Vrsn: 1;
	Strt: FractionDescriptor;
	duration: FractionDescriptor;
	inTime: FractionDescriptor;
	outTime: FractionDescriptor;
}

export interface TimelineDescriptor {
	Vrsn: 1;
	timeScope: TimeScopeDescriptor;
	autoScope: boolean;
	audioLevel: number;
	LyrI: number;
	trackList?: TimelineTrackDescriptor[];
}

export interface EffectDescriptor extends Partial<DescriptorGradientContent>, Partial<DescriptorPatternContent> {
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

export interface Lfx2Descriptor {
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

export interface LmfxDescriptor {
	'Scl '?: DescriptorUnitsValue;
	masterFXSwitch?: boolean;
	dropShadowMulti?: EffectDescriptor[];
	innerShadowMulti?: EffectDescriptor[];
	OrGl?: EffectDescriptor;
	solidFillMulti?: EffectDescriptor[];
	gradientFillMulti?: EffectDescriptor[];
	patternFill?: EffectDescriptor; // ???
	frameFXMulti?: EffectDescriptor[];
	IrGl?: EffectDescriptor;
	ebbl?: EffectDescriptor;
	ChFX?: EffectDescriptor;
	numModifyingFX?: number;
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

export function serializeEffects(e: LayerEffectsInfo, log: boolean, multi: boolean) {
	const info: Lfx2Descriptor & LmfxDescriptor = multi ? {
		'Scl ': unitsPercentF(e.scale ?? 1),
		masterFXSwitch: !e.disabled,
	} : {
		masterFXSwitch: !e.disabled,
		'Scl ': unitsPercentF(e.scale ?? 1),
	};

	const arrayKeys: (keyof LayerEffectsInfo)[] = ['dropShadow', 'innerShadow', 'solidFill', 'gradientOverlay', 'stroke'];
	for (const key of arrayKeys) {
		if (e[key] && !Array.isArray(e[key])) throw new Error(`${key} should be an array`);
	}

	const useMulti = <T>(arr: undefined | T[]): arr is T[] => !!arr && arr.length > 1 && multi;
	const useSingle = <T>(arr: undefined | T[]): arr is T[] => !!arr && arr.length >= 1 && (!multi || arr.length === 1);

	if (useSingle(e.dropShadow)) info.DrSh = serializeEffectObject(e.dropShadow[0], 'dropShadow', log);
	if (useMulti(e.dropShadow)) info.dropShadowMulti = e.dropShadow.map(i => serializeEffectObject(i, 'dropShadow', log));
	if (useSingle(e.innerShadow)) info.IrSh = serializeEffectObject(e.innerShadow[0], 'innerShadow', log);
	if (useMulti(e.innerShadow)) info.innerShadowMulti = e.innerShadow.map(i => serializeEffectObject(i, 'innerShadow', log));
	if (e.outerGlow) info.OrGl = serializeEffectObject(e.outerGlow, 'outerGlow', log);
	if (useMulti(e.solidFill)) info.solidFillMulti = e.solidFill.map(i => serializeEffectObject(i, 'solidFill', log));
	if (useMulti(e.gradientOverlay)) info.gradientFillMulti = e.gradientOverlay.map(i => serializeEffectObject(i, 'gradientOverlay', log));
	if (useMulti(e.stroke)) info.frameFXMulti = e.stroke.map(i => serializeFxObject(i));
	if (e.innerGlow) info.IrGl = serializeEffectObject(e.innerGlow, 'innerGlow', log);
	if (e.bevel) info.ebbl = serializeEffectObject(e.bevel, 'bevel', log);
	if (useSingle(e.solidFill)) info.SoFi = serializeEffectObject(e.solidFill[0], 'solidFill', log);
	if (e.patternOverlay) info.patternFill = serializeEffectObject(e.patternOverlay, 'patternOverlay', log);
	if (useSingle(e.gradientOverlay)) info.GrFl = serializeEffectObject(e.gradientOverlay[0], 'gradientOverlay', log);
	if (e.satin) info.ChFX = serializeEffectObject(e.satin, 'satin', log);
	if (useSingle(e.stroke)) info.FrFX = serializeFxObject(e.stroke?.[0]);

	if (multi) {
		info.numModifyingFX = 0;

		for (const key of Object.keys(e)) {
			const value = (e as any)[key];
			if (Array.isArray(value)) {
				for (const effect of value) {
					if (effect.enabled) info.numModifyingFX++;
				}
			} else if (value.enabled) {
				info.numModifyingFX++;
			}
		}
	}

	return info;
}

export function parseEffects(info: Lfx2Descriptor & LmfxDescriptor, log: boolean) {
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

function parseKeyList(keyList: TimelineKeyDescriptor[], logMissingFeatures: boolean) {
	const keys: TimelineKey[] = [];

	for (let j = 0; j < keyList.length; j++) {
		const key = keyList[j];
		const { time: { denominator, numerator }, selected, animKey } = key;
		const time = { numerator, denominator };
		const interpolation = animInterpStyleEnum.decode(key.animInterpStyle);

		switch (animKey.Type) {
			case 'keyType.Opct':
				keys.push({ interpolation, time, selected, type: 'opacity', value: parsePercent(animKey.Opct) });
				break;
			case 'keyType.Pstn':
				keys.push({ interpolation, time, selected, type: 'position', x: animKey.Hrzn, y: animKey.Vrtc });
				break;
			case 'keyType.Trnf':
				keys.push({
					interpolation, time, selected, type: 'transform',
					scale: horzVrtcToXY(animKey['Scl ']), skew: horzVrtcToXY(animKey.Skew), rotation: animKey.rotation, translation: horzVrtcToXY(animKey.translation)
				});
				break;
			case 'keyType.sheetStyle': {
				const key: TimelineKey = { interpolation, time, selected, type: 'style' };
				if (animKey.sheetStyle.Lefx) key.style = parseEffects(animKey.sheetStyle.Lefx, logMissingFeatures);
				keys.push(key);
				break;
			}
			case 'keyType.globalLighting': {
				keys.push({
					interpolation, time, selected, type: 'globalLighting',
					globalAngle: animKey.gblA, globalAltitude: animKey.globalAltitude
				});
				break;
			}
			default: throw new Error(`Unsupported keyType value`);
		}
	}

	return keys;
}

function serializeKeyList(keys: TimelineKey[]): TimelineKeyDescriptor[] {
	const keyList: TimelineKeyDescriptor[] = [];

	for (let j = 0; j < keys.length; j++) {
		const key = keys[j];
		const { time, selected = false, interpolation } = key;
		const animInterpStyle = animInterpStyleEnum.encode(interpolation) as 'animInterpStyle.Lnr ' | 'animInterpStyle.hold';
		let animKey: TimelineAnimKeyDescriptor;

		switch (key.type) {
			case 'opacity':
				animKey = { Type: 'keyType.Opct', Opct: unitsPercent(key.value) };
				break;
			case 'position':
				animKey = { Type: 'keyType.Pstn', Hrzn: key.x, Vrtc: key.y };
				break;
			case 'transform':
				animKey = { Type: 'keyType.Trnf', 'Scl ': xyToHorzVrtc(key.scale), Skew: xyToHorzVrtc(key.skew), rotation: key.rotation, translation: xyToHorzVrtc(key.translation) };
				break;
			case 'style':
				animKey = { Type: 'keyType.sheetStyle', sheetStyle: { Vrsn: 1, blendOptions: {} } };
				if (key.style) animKey.sheetStyle = { Vrsn: 1, Lefx: serializeEffects(key.style, false, false), blendOptions: {} };
				break;
			case 'globalLighting': {
				animKey = { Type: 'keyType.globalLighting', gblA: key.globalAngle, globalAltitude: key.globalAltitude };
				break;
			}
			default: throw new Error(`Unsupported keyType value`);
		}

		keyList.push({ Vrsn: 1, animInterpStyle, time, animKey, selected });
	}

	return keyList;
}

export function parseTrackList(trackList: TimelineTrackDescriptor[], logMissingFeatures: boolean) {
	const tracks: TimelineTrack[] = [];

	for (let i = 0; i < trackList.length; i++) {
		const tr = trackList[i];
		const track: TimelineTrack = {
			type: stdTrackID.decode(tr.trackID),
			enabled: tr.enab,
			keys: parseKeyList(tr.keyList, logMissingFeatures),
		};

		if (tr.effectParams) {
			track.effectParams = {
				fillCanvas: tr.effectParams.fillCanvas,
				zoomOrigin: tr.effectParams.zoomOrigin,
				keys: parseKeyList(tr.effectParams.keyList, logMissingFeatures),
			};
		}

		tracks.push(track);
	}

	return tracks;
}

export function serializeTrackList(tracks: TimelineTrack[]): TimelineTrackDescriptor[] {
	const trackList: TimelineTrackDescriptor[] = [];

	for (let i = 0; i < tracks.length; i++) {
		const t = tracks[i];
		trackList.push({
			trackID: stdTrackID.encode(t.type) as any,
			Vrsn: 1,
			enab: !!t.enabled,
			Effc: !!t.effectParams,
			...(t.effectParams ? {
				effectParams: {
					keyList: serializeKeyList(t.keys),
					fillCanvas: t.effectParams.fillCanvas,
					zoomOrigin: t.effectParams.zoomOrigin,
				}
			} : {}),
			keyList: serializeKeyList(t.keys),
		});
	}

	return trackList;
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
			case 'gs99': result.interpolationMethod = gradientInterpolationMethodType.decode(val); break;
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
			case '_name':
			case '_classID':
				break;
			default:
				reportErrors && console.log(`Invalid effect key: '${key}', value:`, val);
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
			case 'interpolationMethod': result.gs99 = gradientInterpolationMethodType.encode(val); break;
			case 'opacity': result.Opct = unitsPercent(val); break;
			case 'highlightOpacity': result.hglO = unitsPercent(val); break;
			case 'shadowOpacity': result.sdwO = unitsPercent(val); break;
			case 'angle':
				if (objName === 'gradientOverlay' || objName === 'patternFill') {
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
				reportErrors && console.log(`Invalid effect key: '${key}', value:`, val);
		}
	}

	return result;
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
	if (descriptor.gradientsInterpolationMethod !== undefined) result.interpolationMethod = gradientInterpolationMethodType.decode(descriptor.gradientsInterpolationMethod);
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


export function parseVectorContent(descriptor: DescriptorVectorContent): VectorContent {
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
	if (content.interpolationMethod !== undefined) result.gradientsInterpolationMethod = gradientInterpolationMethodType.encode(content.interpolationMethod);
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

export function serializeVectorContent(content: VectorContent): { descriptor: DescriptorVectorContent; key: string; } {
	if (content.type === 'color') {
		return { key: 'SoCo', descriptor: { 'Clr ': serializeColor(content.color) } };
	} else if (content.type === 'pattern') {
		return { key: 'PtFl', descriptor: serializePatternContent(content) };
	} else {
		return { key: 'GdFl', descriptor: serializeGradientContent(content) };
	}
}

export function parseColor(color: DescriptorColor): Color {
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
	} else if ('redFloat' in color) {
		return { fr: color.redFloat, fg: color.greenFloat, fb: color.blueFloat };
	} else {
		throw new Error('Unsupported color descriptor');
	}
}

export function serializeColor(color: Color | undefined): DescriptorColor {
	if (!color) {
		return { _name: '', _classID: 'RGBC', 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
	} else if ('r' in color) {
		return { _name: '', _classID: 'RGBC', 'Rd  ': color.r || 0, 'Grn ': color.g || 0, 'Bl  ': color.b || 0 };
	} else if ('fr' in color) {
		return { _name: '', _classID: 'RGBC', redFloat: color.fr, greenFloat: color.fg, blueFloat: color.fb };
	} else if ('h' in color) {
		return { _name: '', _classID: 'HSBC', 'H   ': unitsAngle(color.h * 360), Strt: color.s || 0, Brgh: color.b || 0 };
	} else if ('c' in color) {
		return { _name: '', _classID: 'CMYC', 'Cyn ': color.c || 0, Mgnt: color.m || 0, 'Ylw ': color.y || 0, Blck: color.k || 0 };
	} else if ('l' in color) {
		return { _name: '', _classID: 'LABC', Lmnc: color.l || 0, 'A   ': color.a || 0, 'B   ': color.b || 0 };
	} else if ('k' in color) {
		return { _name: '', _classID: 'GRYC', 'Gry ': color.k };
	} else {
		throw new Error('Invalid color value');
	}
}

export function parseAngle(x: DescriptorUnitsValue) {
	if (x === undefined) return 0;
	if (x.units !== 'Angle') throw new Error(`Invalid units: ${x.units}`);
	return x.value;
}

export function parsePercent(x: DescriptorUnitsValue | undefined) {
	if (x === undefined) return 1;
	if (x.units !== 'Percent') throw new Error(`Invalid units: ${x.units}`);
	return x.value / 100;
}

export function parsePercentOrAngle(x: DescriptorUnitsValue | undefined) {
	if (x === undefined) return 1;
	if (x.units === 'Percent') return x.value / 100;
	if (x.units === 'Angle') return x.value / 360;
	throw new Error(`Invalid units: ${x.units}`);
}

export function parseUnits({ units, value }: DescriptorUnitsValue): UnitsValue {
	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density'
	) {
		throw new Error(`Invalid units: ${JSON.stringify({ units, value })}`);
	}
	return { value, units };
}

export function parseUnitsOrNumber(value: DescriptorUnitsValue | number, units: Units = 'Pixels'): UnitsValue {
	if (typeof value === 'number') return { value, units };
	return parseUnits(value);
}

export function parseUnitsToNumber({ units, value }: DescriptorUnitsValue, expectedUnits: string): number {
	if (units !== expectedUnits) throw new Error(`Invalid units: ${JSON.stringify({ units, value })}`);
	return value;
}

export function unitsAngle(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Angle', value: value || 0 };
}

export function unitsPercent(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Percent', value: Math.round((value || 0) * 100) };
}

export function unitsPercentF(value: number | undefined): DescriptorUnitsValue {
	return { units: 'Percent', value: (value || 0) * 100 };
}

export function unitsValue(x: UnitsValue | undefined, key: string): DescriptorUnitsValue {
	if (x == null) return { units: 'Pixels', value: 0 };

	if (typeof x !== 'object')
		throw new Error(`Invalid value: ${JSON.stringify(x)} (key: ${key}) (should have value and units)`);

	const { units, value } = x;

	if (typeof value !== 'number')
		throw new Error(`Invalid value in ${JSON.stringify(x)} (key: ${key})`);

	if (
		units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
		units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density'
	) {
		throw new Error(`Invalid units in ${JSON.stringify(x)} (key: ${key})`);
	}

	return { units, value };
}

export function frac({ numerator, denominator }: FractionDescriptor) {
	return { numerator, denominator };
}

export const textGridding = createEnum<TextGridding>('textGridding', 'none', {
	none: 'None',
	round: 'Rnd ',
});

export const Ornt = createEnum<Orientation>('Ornt', 'horizontal', {
	horizontal: 'Hrzn',
	vertical: 'Vrtc',
});

export const Annt = createEnum<AntiAlias>('Annt', 'sharp', {
	none: 'Anno',
	sharp: 'antiAliasSharp',
	crisp: 'AnCr',
	strong: 'AnSt',
	smooth: 'AnSm',
	platform: 'antiAliasPlatformGray',
	platformLCD: 'antiAliasPlatformLCD',
});

export const warpStyle = createEnum<WarpStyle>('warpStyle', 'none', {
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
	cylinder: 'warpCylinder',
	custom: 'warpCustom',
});

export const BlnM = createEnum<BlendMode>('BlnM', 'normal', {
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
	// used in ABR
	'linear height': 'linearHeight',
	'height': 'Hght',
	'subtraction': 'Sbtr', // 2nd version of subtract ?
});

export const BESl = createEnum<BevelStyle>('BESl', 'inner bevel', {
	'inner bevel': 'InrB',
	'outer bevel': 'OtrB',
	'emboss': 'Embs',
	'pillow emboss': 'PlEb',
	'stroke emboss': 'strokeEmboss',
});

export const bvlT = createEnum<BevelTechnique>('bvlT', 'smooth', {
	'smooth': 'SfBL',
	'chisel hard': 'PrBL',
	'chisel soft': 'Slmt',
});

export const BESs = createEnum<BevelDirection>('BESs', 'up', {
	up: 'In  ',
	down: 'Out ',
});

export const BETE = createEnum<GlowTechnique>('BETE', 'softer', {
	softer: 'SfBL',
	precise: 'PrBL',
});

export const IGSr = createEnum<GlowSource>('IGSr', 'edge', {
	edge: 'SrcE',
	center: 'SrcC',
});

export const GrdT = createEnum<GradientStyle>('GrdT', 'linear', {
	linear: 'Lnr ',
	radial: 'Rdl ',
	angle: 'Angl',
	reflected: 'Rflc',
	diamond: 'Dmnd',
});

export const animInterpStyleEnum = createEnum<TimelineKeyInterpolation>('animInterpStyle', 'linear', {
	linear: 'Lnr ',
	hold: 'hold',
});

export const stdTrackID = createEnum<TimelineTrackType>('stdTrackID', 'opacity', {
	opacity: 'opacityTrack',
	style: 'styleTrack',
	sheetTransform: 'sheetTransformTrack',
	sheetPosition: 'sheetPositionTrack',
	globalLighting: 'globalLightingTrack',
});

export const gradientInterpolationMethodType = createEnum<InterpolationMethod>('gradientInterpolationMethodType', 'perceptual', {
	perceptual: 'Perc',
	linear: 'Lnr ',
	classic: 'Gcls',
	smooth: 'Smoo',
});

export const ClrS = createEnum<'rgb' | 'hsb' | 'lab'>('ClrS', 'rgb', {
	rgb: 'RGBC',
	hsb: 'HSBl',
	lab: 'LbCl',
	hsl: 'HSLC',
});

export const FStl = createEnum<'inside' | 'center' | 'outside'>('FStl', 'outside', {
	outside: 'OutF',
	center: 'CtrF',
	inside: 'InsF'
});

export const FrFl = createEnum<'color' | 'gradient' | 'pattern'>('FrFl', 'color', {
	color: 'SClr',
	gradient: 'GrFl',
	pattern: 'Ptrn',
});

export const ESliceType = createEnum<'image' | 'noImage'>('ESliceType', 'image', {
	image: 'Img ',
	noImage: 'noImage',
});

export const ESliceHorzAlign = createEnum<'default'>('ESliceHorzAlign', 'default', {
	default: 'default',
});

export const ESliceVertAlign = createEnum<'default'>('ESliceVertAlign', 'default', {
	default: 'default',
});

export const ESliceOrigin = createEnum<'userGenerated' | 'autoGenerated' | 'layer'>('ESliceOrigin', 'userGenerated', {
	userGenerated: 'userGenerated',
	autoGenerated: 'autoGenerated',
	layer: 'layer',
});

export const ESliceBGColorType = createEnum<'none' | 'matte' | 'color'>('ESliceBGColorType', 'none', {
	none: 'None',
	matte: 'matte',
	color: 'Clr ',
});

export const strokeStyleLineCapType = createEnum<LineCapType>('strokeStyleLineCapType', 'butt', {
	butt: 'strokeStyleButtCap',
	round: 'strokeStyleRoundCap',
	square: 'strokeStyleSquareCap',
});

export const strokeStyleLineJoinType = createEnum<LineJoinType>('strokeStyleLineJoinType', 'miter', {
	miter: 'strokeStyleMiterJoin',
	round: 'strokeStyleRoundJoin',
	bevel: 'strokeStyleBevelJoin',
});

export const strokeStyleLineAlignment = createEnum<LineAlignment>('strokeStyleLineAlignment', 'inside', {
	inside: 'strokeStyleAlignInside',
	center: 'strokeStyleAlignCenter',
	outside: 'strokeStyleAlignOutside',
});

export const BlrM = createEnum<'spin' | 'zoom'>('BlrM', 'ispinmage', {
	spin: 'Spn ',
	zoom: 'Zm  ',
});

export const BlrQ = createEnum<'draft' | 'good' | 'best'>('BlrQ', 'good', {
	draft: 'Drft',
	good: 'Gd  ',
	best: 'Bst ',
});

export const SmBM = createEnum<'normal' | 'edge only' | 'overlay edge'>('SmBM', 'normal', {
	normal: 'SBMN',
	'edge only': 'SBME',
	'overlay edge': 'SBMO',
});

export const SmBQ = createEnum<'low' | 'medium' | 'high'>('SmBQ', 'medium', {
	low: 'SBQL',
	medium: 'SBQM',
	high: 'SBQH',
});

export const DspM = createEnum<'stretch to fit' | 'tile'>('DspM', 'stretch to fit', {
	'stretch to fit': 'StrF',
	'tile': 'Tile',
});

export const UndA = createEnum<'wrap around' | 'repeat edge pixels'>('UndA', 'repeat edge pixels', {
	'wrap around': 'WrpA',
	'repeat edge pixels': 'RptE',
});

export const Cnvr = createEnum<'rectangular to polar' | 'polar to rectangular'>('Cnvr', 'rectangular to polar', {
	'rectangular to polar': 'RctP',
	'polar to rectangular': 'PlrR',
});

export const RplS = createEnum<'small' | 'medium' | 'large'>('RplS', 'medium', {
	small: 'Sml ',
	medium: 'Mdm ',
	large: 'Lrg ',
});

export const SphM = createEnum<'normal' | 'horizontal only' | 'vertical only'>('SphM', 'normal', {
	'normal': 'Nrml',
	'horizontal only': 'HrzO',
	'vertical only': 'VrtO',
});

export const Wvtp = createEnum<'sine' | 'triangle' | 'square'>('Wvtp', 'sine', {
	sine: 'WvSn',
	triangle: 'WvTr',
	square: 'WvSq',
});

export const ZZTy = createEnum<'around center' | 'out from center' | 'pond ripples'>('ZZTy', 'pond ripples', {
	'around center': 'ArnC',
	'out from center': 'OtFr',
	'pond ripples': 'PndR',
});

export const Dstr = createEnum<'uniform' | 'gaussian'>('Dstr', 'uniform', {
	uniform: 'Unfr',
	gaussian: 'Gsn ',
});

export const Chnl = createEnum<'red' | 'green' | 'blue' | 'composite'>('Chnl', 'composite', {
	red: 'Rd  ',
	green: 'Grn ',
	blue: 'Bl  ',
	composite: 'Cmps',
});

export const MztT = createEnum<'fine dots' | 'medium dots' | 'grainy dots' | 'coarse dots' | 'short lines' | 'medium lines' | 'long lines' | 'short strokes' | 'medium strokes' | 'long strokes'>('MztT', 'fine dots', {
	'fine dots': 'FnDt',
	'medium dots': 'MdmD',
	'grainy dots': 'GrnD',
	'coarse dots': 'CrsD',
	'short lines': 'ShrL',
	'medium lines': 'MdmL',
	'long lines': 'LngL',
	'short strokes': 'ShSt',
	'medium strokes': 'MdmS',
	'long strokes': 'LngS',
});

export const Lns = createEnum<'50-300mm zoom' | '32mm prime' | '105mm prime' | 'movie prime'>('Lns ', '50-300mm zoom', {
	'50-300mm zoom': 'Zm  ',
	'32mm prime': 'Nkn ',
	'105mm prime': 'Nkn1',
	'movie prime': 'PnVs',
});

export const blurType = createEnum<'gaussian blur' | 'lens blur' | 'motion blur'>('blurType', 'gaussian blur', {
	'gaussian blur': 'GsnB',
	'lens blur': 'lensBlur',
	'motion blur': 'MtnB',
});

export const DfsM = createEnum<'normal' | 'darken only' | 'lighten only' | 'anisotropic'>('DfsM', 'normal', {
	'normal': 'Nrml',
	'darken only': 'DrkO',
	'lighten only': 'LghO',
	'anisotropic': 'anisotropic',
});

export const ExtT = createEnum<'blocks' | 'pyramids'>('ExtT', 'blocks', {
	blocks: 'Blks',
	pyramids: 'Pyrm',
});

export const ExtR = createEnum<'random' | 'level-based'>('ExtR', 'random', {
	random: 'Rndm',
	'level-based': 'LvlB',
});

export const FlCl = createEnum<'background color' | 'foreground color' | 'inverse image' | 'unaltered image'>('FlCl', 'background color', {
	'background color': 'FlBc',
	'foreground color': 'FlFr',
	'inverse image': 'FlIn',
	'unaltered image': 'FlSm',
});

export const CntE = createEnum<'lower' | 'upper'>('CntE', 'upper', {
	lower: 'Lwr ',
	upper: 'Upr ',
});

export const WndM = createEnum<'wind' | 'blast' | 'stagger'>('WndM', 'wind', {
	wind: 'Wnd ',
	blast: 'Blst',
	stagger: 'Stgr',
});

export const Drct = createEnum<'left' | 'right'>('Drct', 'from the right', {
	left: 'Left',
	right: 'Rght',
});

export const IntE = createEnum<'odd lines' | 'even lines'>('IntE', 'odd lines', {
	'odd lines': 'ElmO',
	'even lines': 'ElmE',
});

export const IntC = createEnum<'duplication' | 'interpolation'>('IntC', 'interpolation', {
	duplication: 'CrtD',
	interpolation: 'CrtI',
});

export const FlMd = createEnum<'set to transparent' | 'repeat edge pixels' | 'wrap around'>('FlMd', 'wrap around', {
	'set to transparent': 'Bckg',
	'repeat edge pixels': 'Rpt ',
	'wrap around': 'Wrp ',
});

export const prjM = createEnum<'fisheye' | 'perspective' | 'auto' | 'full spherical'>('prjM', 'fisheye', {
	'fisheye': 'fisP',
	'perspective': 'perP',
	'auto': 'auto',
	'full spherical': 'fusP',
});

export const presetKindType = createEnum<'custom' | 'default'>('presetKindType', 'presetKindCustom', {
	custom: 'presetKindCustom',
	default: 'presetKindDefault',
});
