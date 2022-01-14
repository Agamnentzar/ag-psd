import { createEnum } from './helpers';
import { readSignature, readUnicodeString, readUint32, readUint8, readFloat64, readBytes, readAsciiString, readInt32, readFloat32, readInt32LE, readUnicodeStringWithLength } from './psdReader';
import { writeSignature, writeBytes, writeUint32, writeFloat64, writeUint8, writeUnicodeStringWithPadding, writeInt32, writeFloat32, writeUnicodeString } from './psdWriter';
function revMap(map) {
    var result = {};
    Object.keys(map).forEach(function (key) { return result[map[key]] = key; });
    return result;
}
var unitsMap = {
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
var unitsMapRev = revMap(unitsMap);
var logErrors = false;
export function setLogErrors(value) {
    logErrors = value;
}
function makeType(name, classID) {
    return { name: name, classID: classID };
}
var fieldToExtType = {
    strokeStyleContent: makeType('', 'solidColorLayer'),
    // printProofSetup: makeType('校样设置', 'proofSetup'), // TESTING
    printProofSetup: makeType('Proof Setup', 'proofSetup'),
    patternFill: makeType('', 'patternFill'),
    Grad: makeType('Gradient', 'Grdn'),
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
    frameStep: makeType('', 'null'),
    duration: makeType('', 'null'),
    bounds: makeType('', 'Rctn'),
    customEnvelopeWarp: makeType('', 'customEnvelopeWarp'),
    warp: makeType('', 'warp'),
    'Sz  ': makeType('', 'Pnt '),
    origin: makeType('', 'Pnt '),
    autoExpandOffset: makeType('', 'Pnt '),
    keyOriginShapeBBox: makeType('', 'unitRect'),
    Vrsn: makeType('', 'null'),
    psVersion: makeType('', 'null'),
    docDefaultNewArtboardBackgroundColor: makeType('', 'RGBC'),
    artboardRect: makeType('', 'classFloatRect'),
    keyOriginRRectRadii: makeType('', 'radii'),
    keyOriginBoxCorners: makeType('', 'null'),
    rectangleCornerA: makeType('', 'Pnt '),
    rectangleCornerB: makeType('', 'Pnt '),
    rectangleCornerC: makeType('', 'Pnt '),
    rectangleCornerD: makeType('', 'Pnt '),
    compInfo: makeType('', 'null'),
    Trnf: makeType('Transform', 'Trnf'),
    quiltWarp: makeType('', 'quiltWarp'),
    generatorSettings: makeType('', 'null'),
    crema: makeType('', 'null'),
};
var fieldToArrayExtType = {
    'Crv ': makeType('', 'CrPt'),
    Clrs: makeType('', 'Clrt'),
    Trns: makeType('', 'TrnS'),
    keyDescriptorList: makeType('', 'null'),
    solidFillMulti: makeType('', 'SoFi'),
    gradientFillMulti: makeType('', 'GrFl'),
    dropShadowMulti: makeType('', 'DrSh'),
    innerShadowMulti: makeType('', 'IrSh'),
    frameFXMulti: makeType('', 'FrFX'),
};
var typeToField = {
    'TEXT': [
        'Txt ', 'printerName', 'Nm  ', 'Idnt', 'blackAndWhitePresetFileName', 'LUT3DFileName',
        'presetFileName', 'curvesPresetFileName', 'mixerPresetFileName', 'placed', 'description', 'reason',
        'artboardPresetName', 'json',
    ],
    'tdta': ['EngineData', 'LUT3DFileData'],
    'long': [
        'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion', 'LaID', 'Vrsn', 'Cnt ',
        'Brgh', 'Cntr', 'means', 'vibrance', 'Strt', 'bwPresetKind', 'presetKind', 'comp', 'compID', 'originalCompID',
        'curvesPresetKind', 'mixerPresetKind', 'uOrder', 'vOrder', 'PgNm', 'totalPages', 'Crop',
        'numerator', 'denominator', 'frameCount', 'Annt', 'keyOriginType', 'unitValueQuadVersion',
        'keyOriginIndex', 'major', 'minor', 'fix', 'docDefaultNewArtboardBackgroundType', 'artboardBackgroundType',
        'numModifyingFX', 'deformNumRows', 'deformNumCols',
    ],
    'enum': [
        'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
        'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'glwS', 'GrdF', 'GlwT',
        'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
        'strokeStyleBlendMode', 'PntT', 'Styl', 'lookupType', 'LUTFormat', 'dataOrder',
        'tableOrder', 'enableCompCore', 'enableCompCoreGPU', 'compCoreSupport', 'compCoreGPUSupport', 'Engn',
        'enableCompCoreThreads',
    ],
    'bool': [
        'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss',
        'useShape', 'useTexture', 'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape',
        'useTexture', 'Algn', 'Rvrs', 'Dthr', 'Invr', 'VctC', 'ShTr', 'layerConceals',
        'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock', 'strokeStyleStrokeAdjust',
        'hardProof', 'MpBl', 'paperWhite', 'useLegacy', 'Auto', 'Lab ', 'useTint', 'keyShapeInvalidated',
        'autoExpandEnabled', 'autoNestEnabled', 'autoPositionEnabled', 'shrinkwrapOnSaveEnabled',
        'present', 'showInDialog', 'overprint',
    ],
    'doub': [
        'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr', 'Wdth', 'Hght',
        'strokeStyleMiterLimit', 'strokeStyleResolution', 'layerTime', 'keyOriginResolution',
        'xx', 'xy', 'yx', 'yy', 'tx', 'ty',
    ],
    'UntF': [
        'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl',
        'Ckmt', 'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset',
        'strokeStyleOpacity', 'H   ', 'Top ', 'Left', 'Btom', 'Rght', 'Rslt',
        'topRight', 'topLeft', 'bottomLeft', 'bottomRight',
    ],
    'VlLs': [
        'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet', 'FrLs',
        'LaSt', 'Trnf', 'nonAffineTransform', 'keyDescriptorList', 'guideIndeces', 'gradientFillMulti',
        'solidFillMulti', 'frameFXMulti', 'innerShadowMulti', 'dropShadowMulti',
    ],
    'ObAr': ['meshPoints', 'quiltSliceX', 'quiltSliceY'],
    'obj ': ['null'],
};
var channels = [
    'Rd  ', 'Grn ', 'Bl  ', 'Yllw', 'Ylw ', 'Cyn ', 'Mgnt', 'Blck', 'Gry ', 'Lmnc', 'A   ', 'B   ',
];
var fieldToArrayType = {
    'Mnm ': 'long',
    'Mxm ': 'long',
    'FrLs': 'long',
    'strokeStyleLineDashSet': 'UntF',
    'Trnf': 'doub',
    'nonAffineTransform': 'doub',
    'keyDescriptorList': 'Objc',
    'gradientFillMulti': 'Objc',
    'solidFillMulti': 'Objc',
    'frameFXMulti': 'Objc',
    'innerShadowMulti': 'Objc',
    'dropShadowMulti': 'Objc',
};
var fieldToType = {};
for (var _i = 0, _a = Object.keys(typeToField); _i < _a.length; _i++) {
    var type = _a[_i];
    for (var _b = 0, _c = typeToField[type]; _b < _c.length; _b++) {
        var field = _c[_b];
        fieldToType[field] = type;
    }
}
for (var _d = 0, _e = Object.keys(fieldToExtType); _d < _e.length; _d++) {
    var field = _e[_d];
    if (!fieldToType[field])
        fieldToType[field] = 'Objc';
}
for (var _f = 0, _g = Object.keys(fieldToArrayExtType); _f < _g.length; _f++) {
    var field = _g[_f];
    fieldToArrayType[field] = 'Objc';
}
function getTypeByKey(key, value, root) {
    if (key === 'Sz  ') {
        return ('Wdth' in value) ? 'Objc' : (('units' in value) ? 'UntF' : 'doub');
    }
    else if (key === 'Type') {
        return typeof value === 'string' ? 'enum' : 'long';
    }
    else if (key === 'AntA') {
        return typeof value === 'string' ? 'enum' : 'bool';
    }
    else if (key === 'Hrzn' || key === 'Vrtc' || key === 'Top ' || key === 'Left' || key === 'Btom' || key === 'Rght') {
        return typeof value === 'number' ? 'doub' : 'UntF';
    }
    else if (key === 'Vrsn') {
        return typeof value === 'number' ? 'long' : 'Objc';
    }
    else if (key === 'Rd  ' || key === 'Grn ' || key === 'Bl  ') {
        return root === 'artd' ? 'long' : 'doub';
    }
    else if (key === 'Trnf') {
        return Array.isArray(value) ? 'VlLs' : 'Objc';
    }
    else {
        return fieldToType[key];
    }
}
export function readAsciiStringOrClassId(reader) {
    var length = readInt32(reader);
    return readAsciiString(reader, length || 4);
}
function writeAsciiStringOrClassId(writer, value) {
    if (value.length === 4 && value !== 'warp') {
        // write classId
        writeInt32(writer, 0);
        writeSignature(writer, value);
    }
    else {
        // write ascii string
        writeInt32(writer, value.length);
        for (var i = 0; i < value.length; i++) {
            writeUint8(writer, value.charCodeAt(i));
        }
    }
}
export function readDescriptorStructure(reader) {
    var object = {};
    // object.__struct =
    readClassStructure(reader);
    var itemsCount = readUint32(reader);
    for (var i = 0; i < itemsCount; i++) {
        var key = readAsciiStringOrClassId(reader);
        var type = readSignature(reader);
        // console.log(`> '${key}' '${type}'`);
        var data = readOSType(reader, type);
        // if (!getTypeByKey(key, data)) console.log(`> '${key}' '${type}'`, data);
        object[key] = data;
    }
    // console.log('//', struct);
    return object;
}
export function writeDescriptorStructure(writer, name, classId, value, root) {
    if (logErrors && !classId)
        console.log('Missing classId for: ', name, classId, value);
    // write class structure
    writeUnicodeStringWithPadding(writer, name);
    writeAsciiStringOrClassId(writer, classId);
    var keys = Object.keys(value);
    writeUint32(writer, keys.length);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var type = getTypeByKey(key, value[key], root);
        var extType = fieldToExtType[key];
        if ((key === 'Strt' || key === 'Brgh') && 'H   ' in value) {
            type = 'doub';
        }
        else if (channels.indexOf(key) !== -1) {
            type = (classId === 'RGBC' && root !== 'artd') ? 'doub' : 'long';
        }
        else if (key === 'profile') {
            type = classId === 'printOutput' ? 'TEXT' : 'tdta';
        }
        else if (key === 'strokeStyleContent') {
            if (value[key]['Clr ']) {
                extType = makeType('', 'solidColorLayer');
            }
            else if (value[key].Grad) {
                extType = makeType('', 'gradientLayer');
            }
            else if (value[key].Ptrn) {
                extType = makeType('', 'patternLayer');
            }
            else {
                logErrors && console.log('Invalid strokeStyleContent value', value[key]);
            }
        }
        else if (key === 'bounds' && root === 'quiltWarp') {
            extType = makeType('', 'classFloatRect');
        }
        if (extType && extType.classID === 'RGBC') {
            if ('H   ' in value[key])
                extType = { classID: 'HSBC', name: '' };
            // TODO: other color spaces
        }
        writeAsciiStringOrClassId(writer, key);
        writeSignature(writer, type || 'long');
        writeOSType(writer, type || 'long', value[key], key, extType, root);
        if (logErrors && !type)
            console.log("Missing descriptor field type for: '" + key + "' in", value);
    }
}
function readOSType(reader, type) {
    switch (type) {
        case 'obj ': // Reference
            return readReferenceStructure(reader);
        case 'Objc': // Descriptor
        case 'GlbO': // GlobalObject same as Descriptor
            return readDescriptorStructure(reader);
        case 'VlLs': { // List
            var length_1 = readInt32(reader);
            var items = [];
            for (var i = 0; i < length_1; i++) {
                var type_1 = readSignature(reader);
                // console.log('  >', type);
                items.push(readOSType(reader, type_1));
            }
            return items;
        }
        case 'doub': // Double
            return readFloat64(reader);
        case 'UntF': { // Unit double
            var units = readSignature(reader);
            var value = readFloat64(reader);
            if (!unitsMap[units])
                throw new Error("Invalid units: " + units);
            return { units: unitsMap[units], value: value };
        }
        case 'UnFl': { // Unit float
            var units = readSignature(reader);
            var value = readFloat32(reader);
            if (!unitsMap[units])
                throw new Error("Invalid units: " + units);
            return { units: unitsMap[units], value: value };
        }
        case 'TEXT': // String
            return readUnicodeString(reader);
        case 'enum': { // Enumerated
            var type_2 = readAsciiStringOrClassId(reader);
            var value = readAsciiStringOrClassId(reader);
            return type_2 + "." + value;
        }
        case 'long': // Integer
            return readInt32(reader);
        case 'comp': { // Large Integer
            var low = readUint32(reader);
            var high = readUint32(reader);
            return { low: low, high: high };
        }
        case 'bool': // Boolean
            return !!readUint8(reader);
        case 'type': // Class
        case 'GlbC': // Class
            return readClassStructure(reader);
        case 'alis': { // Alias
            var length_2 = readInt32(reader);
            return readAsciiString(reader, length_2);
        }
        case 'tdta': { // Raw Data
            var length_3 = readInt32(reader);
            return readBytes(reader, length_3);
        }
        case 'ObAr': { // Object array
            readInt32(reader); // version: 16
            readUnicodeString(reader); // name: ''
            readAsciiStringOrClassId(reader); // 'rationalPoint'
            var length_4 = readInt32(reader);
            var items = [];
            for (var i = 0; i < length_4; i++) {
                var type1 = readAsciiStringOrClassId(reader); // type Hrzn | Vrtc
                readSignature(reader); // UnFl
                readSignature(reader); // units ? '#Pxl'
                var valuesCount = readInt32(reader);
                var values = [];
                for (var j = 0; j < valuesCount; j++) {
                    values.push(readFloat64(reader));
                }
                items.push({ type: type1, values: values });
            }
            return items;
        }
        case 'Pth ': { // File path
            /*const length =*/ readInt32(reader);
            var sig = readSignature(reader);
            /*const pathSize =*/ readInt32LE(reader);
            var charsCount = readInt32LE(reader);
            var path = readUnicodeStringWithLength(reader, charsCount);
            return { sig: sig, path: path };
        }
        default:
            throw new Error("Invalid TySh descriptor OSType: " + type + " at " + reader.offset.toString(16));
    }
}
var ObArTypes = {
    meshPoints: 'rationalPoint',
    quiltSliceX: 'UntF',
    quiltSliceY: 'UntF',
};
function writeOSType(writer, type, value, key, extType, root) {
    switch (type) {
        case 'obj ': // Reference
            writeReferenceStructure(writer, key, value);
            break;
        case 'Objc': // Descriptor
        case 'GlbO': // GlobalObject same as Descriptor
            if (!extType)
                throw new Error("Missing ext type for: '" + key + "' (" + JSON.stringify(value) + ")");
            writeDescriptorStructure(writer, extType.name, extType.classID, value, root);
            break;
        case 'VlLs': // List
            writeInt32(writer, value.length);
            for (var i = 0; i < value.length; i++) {
                var type_3 = fieldToArrayType[key];
                writeSignature(writer, type_3 || 'long');
                writeOSType(writer, type_3 || 'long', value[i], '', fieldToArrayExtType[key], root);
                if (logErrors && !type_3)
                    console.log("Missing descriptor array type for: '" + key + "' in", value);
            }
            break;
        case 'doub': // Double
            writeFloat64(writer, value);
            break;
        case 'UntF': // Unit double
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units + " in " + key);
            writeSignature(writer, unitsMapRev[value.units]);
            writeFloat64(writer, value.value);
            break;
        case 'UnFl': // Unit float
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units + " in " + key);
            writeSignature(writer, unitsMapRev[value.units]);
            writeFloat32(writer, value.value);
            break;
        case 'TEXT': // String
            writeUnicodeStringWithPadding(writer, value);
            break;
        case 'enum': { // Enumerated
            var _a = value.split('.'), _type = _a[0], val = _a[1];
            writeAsciiStringOrClassId(writer, _type);
            writeAsciiStringOrClassId(writer, val);
            break;
        }
        case 'long': // Integer
            writeInt32(writer, value);
            break;
        // case 'comp': // Large Integer
        // 	writeLargeInteger(reader);
        case 'bool': // Boolean
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
            var type_4 = ObArTypes[key];
            if (!type_4)
                throw new Error("Not implemented ObArType for: " + key);
            writeAsciiStringOrClassId(writer, type_4);
            writeInt32(writer, value.length);
            for (var i = 0; i < value.length; i++) {
                writeAsciiStringOrClassId(writer, value[i].type); // Hrzn | Vrtc
                writeSignature(writer, 'UnFl');
                writeSignature(writer, '#Pxl');
                writeInt32(writer, value[i].values.length);
                for (var j = 0; j < value[i].values.length; j++) {
                    writeFloat64(writer, value[i].values[j]);
                }
            }
            break;
        }
        // case 'Pth ': // File path
        // 	writeFilePath(reader);
        default:
            throw new Error("Not implemented descriptor OSType: " + type);
    }
}
function readReferenceStructure(reader) {
    var itemsCount = readInt32(reader);
    var items = [];
    for (var i = 0; i < itemsCount; i++) {
        var type = readSignature(reader);
        switch (type) {
            case 'prop': { // Property
                readClassStructure(reader);
                var keyID = readAsciiStringOrClassId(reader);
                items.push(keyID);
                break;
            }
            case 'Clss': // Class
                items.push(readClassStructure(reader));
                break;
            case 'Enmr': { // Enumerated Reference
                readClassStructure(reader);
                var typeID = readAsciiStringOrClassId(reader);
                var value = readAsciiStringOrClassId(reader);
                items.push(typeID + "." + value);
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
                throw new Error("Invalid descriptor reference type: " + type);
        }
    }
    return items;
}
function writeReferenceStructure(writer, _key, items) {
    writeInt32(writer, items.length);
    for (var i = 0; i < items.length; i++) {
        var value = items[i];
        var type = 'unknown';
        if (typeof value === 'string') {
            if (/^[a-z]+\.[a-z]+$/i.test(value)) {
                type = 'Enmr';
            }
            else {
                type = 'name';
            }
        }
        writeSignature(writer, type);
        switch (type) {
            // case 'prop': // Property
            // case 'Clss': // Class
            case 'Enmr': { // Enumerated Reference
                var _a = value.split('.'), typeID = _a[0], enumValue = _a[1];
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
                throw new Error("Invalid descriptor reference type: " + type);
        }
    }
    return items;
}
function readClassStructure(reader) {
    var name = readUnicodeString(reader);
    var classID = readAsciiStringOrClassId(reader);
    // console.log({ name, classID });
    return { name: name, classID: classID };
}
function writeClassStructure(writer, name, classID) {
    writeUnicodeString(writer, name);
    writeAsciiStringOrClassId(writer, classID);
}
export function readVersionAndDescriptor(reader) {
    var version = readUint32(reader);
    if (version !== 16)
        throw new Error("Invalid descriptor version: " + version);
    var desc = readDescriptorStructure(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    return desc;
}
export function writeVersionAndDescriptor(writer, name, classID, descriptor, root) {
    if (root === void 0) { root = ''; }
    writeUint32(writer, 16); // version
    writeDescriptorStructure(writer, name, classID, descriptor, root);
}
export function parseAngle(x) {
    if (x === undefined)
        return 0;
    if (x.units !== 'Angle')
        throw new Error("Invalid units: " + x.units);
    return x.value;
}
export function parsePercent(x) {
    if (x === undefined)
        return 1;
    if (x.units !== 'Percent')
        throw new Error("Invalid units: " + x.units);
    return x.value / 100;
}
export function parsePercentOrAngle(x) {
    if (x === undefined)
        return 1;
    if (x.units === 'Percent')
        return x.value / 100;
    if (x.units === 'Angle')
        return x.value / 360;
    throw new Error("Invalid units: " + x.units);
}
export function parseUnits(_a) {
    var units = _a.units, value = _a.value;
    if (units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
        units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density') {
        throw new Error("Invalid units: " + JSON.stringify({ units: units, value: value }));
    }
    return { value: value, units: units };
}
export function parseUnitsOrNumber(value, units) {
    if (units === void 0) { units = 'Pixels'; }
    if (typeof value === 'number')
        return { value: value, units: units };
    return parseUnits(value);
}
export function parseUnitsToNumber(_a, expectedUnits) {
    var units = _a.units, value = _a.value;
    if (units !== expectedUnits)
        throw new Error("Invalid units: " + JSON.stringify({ units: units, value: value }));
    return value;
}
export function unitsAngle(value) {
    return { units: 'Angle', value: value || 0 };
}
export function unitsPercent(value) {
    return { units: 'Percent', value: Math.round((value || 0) * 100) };
}
export function unitsValue(x, key) {
    if (x == null)
        return { units: 'Pixels', value: 0 };
    if (typeof x !== 'object')
        throw new Error("Invalid value: " + JSON.stringify(x) + " (key: " + key + ") (should have value and units)");
    var units = x.units, value = x.value;
    if (typeof value !== 'number')
        throw new Error("Invalid value in " + JSON.stringify(x) + " (key: " + key + ")");
    if (units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
        units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density') {
        throw new Error("Invalid units in " + JSON.stringify(x) + " (key: " + key + ")");
    }
    return { units: units, value: value };
}
export var textGridding = createEnum('textGridding', 'none', {
    none: 'None',
    round: 'Rnd ',
});
export var Ornt = createEnum('Ornt', 'horizontal', {
    horizontal: 'Hrzn',
    vertical: 'Vrtc',
});
export var Annt = createEnum('Annt', 'sharp', {
    none: 'Anno',
    sharp: 'antiAliasSharp',
    crisp: 'AnCr',
    strong: 'AnSt',
    smooth: 'AnSm',
    platform: 'antiAliasPlatformGray',
    platformLCD: 'antiAliasPlatformLCD',
});
export var warpStyle = createEnum('warpStyle', 'none', {
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
    custom: 'warpCustom',
});
export var BlnM = createEnum('BlnM', 'normal', {
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
export var BESl = createEnum('BESl', 'inner bevel', {
    'inner bevel': 'InrB',
    'outer bevel': 'OtrB',
    'emboss': 'Embs',
    'pillow emboss': 'PlEb',
    'stroke emboss': 'strokeEmboss',
});
export var bvlT = createEnum('bvlT', 'smooth', {
    'smooth': 'SfBL',
    'chisel hard': 'PrBL',
    'chisel soft': 'Slmt',
});
export var BESs = createEnum('BESs', 'up', {
    up: 'In  ',
    down: 'Out ',
});
export var BETE = createEnum('BETE', 'softer', {
    softer: 'SfBL',
    precise: 'PrBL',
});
export var IGSr = createEnum('IGSr', 'edge', {
    edge: 'SrcE',
    center: 'SrcC',
});
export var GrdT = createEnum('GrdT', 'linear', {
    linear: 'Lnr ',
    radial: 'Rdl ',
    angle: 'Angl',
    reflected: 'Rflc',
    diamond: 'Dmnd',
});
export var ClrS = createEnum('ClrS', 'rgb', {
    rgb: 'RGBC',
    hsb: 'HSBl',
    lab: 'LbCl',
});
export var FStl = createEnum('FStl', 'outside', {
    outside: 'OutF',
    center: 'CtrF',
    inside: 'InsF'
});
export var FrFl = createEnum('FrFl', 'color', {
    color: 'SClr',
    gradient: 'GrFl',
    pattern: 'Ptrn',
});
export var strokeStyleLineCapType = createEnum('strokeStyleLineCapType', 'butt', {
    butt: 'strokeStyleButtCap',
    round: 'strokeStyleRoundCap',
    square: 'strokeStyleSquareCap',
});
export var strokeStyleLineJoinType = createEnum('strokeStyleLineJoinType', 'miter', {
    miter: 'strokeStyleMiterJoin',
    round: 'strokeStyleRoundJoin',
    bevel: 'strokeStyleBevelJoin',
});
export var strokeStyleLineAlignment = createEnum('strokeStyleLineAlignment', 'inside', {
    inside: 'strokeStyleAlignInside',
    center: 'strokeStyleAlignCenter',
    outside: 'strokeStyleAlignOutside',
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDM0IsU0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQy9CLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUM5QixNQUFNLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDNUIsa0JBQWtCLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxvQkFBb0IsQ0FBQztJQUN0RCxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzVCLE1BQU0sRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUM1QixnQkFBZ0IsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUN0QyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLFVBQVUsQ0FBQztJQUM1QyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsU0FBUyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQy9CLG9DQUFvQyxFQUFFLFFBQVEsQ0FBQyxFQUFF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QUFLLE1BQU0sRUFBRTtRQUNuQixPQUFPLENBQUMsTUFBTSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDM0U7U0FBTSxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUU7UUFDMUIsT0FBTyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0tBQ25EO1NBQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFO1FBQzFCLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztLQUNuRDtTQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxJQUFJLEdBQUcsS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUU7UUFDcEgsT0FBTyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO0tBQ25EO1NBQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFO1FBQzFCLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztLQUNuRDtTQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUU7UUFDOUQsT0FBTyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztLQUN6QztTQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtRQUMx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RSxzQkFBc0I7Q0FDN0IsQ0FBQyxDQUFDO0FBRUgsTUFBTSxDQUFDLElBQU0sd0JBQXdCLEdBQUcsVUFBVSxDQUFnQiwwQkFBMEIsRUFBRSxRQUFRLEVBQUU7SUFDdkcsTUFBTSxFQUFFLHdCQUF3QjtJQUNoQyxNQUFNLEVBQUUsd0JBQXdCO0lBQ2hDLE9BQU8sRUFBRSx5QkFBeUI7Q0FDbEMsQ0FBQyxDQUFDIiwiZmlsZSI6ImRlc2NyaXB0b3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVFbnVtIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHtcclxuXHRBbnRpQWxpYXMsIEJldmVsRGlyZWN0aW9uLCBCZXZlbFN0eWxlLCBCZXZlbFRlY2huaXF1ZSwgQmxlbmRNb2RlLCBHbG93U291cmNlLCBHbG93VGVjaG5pcXVlLCBHcmFkaWVudFN0eWxlLFxyXG5cdExpbmVBbGlnbm1lbnQsIExpbmVDYXBUeXBlLCBMaW5lSm9pblR5cGUsIE9yaWVudGF0aW9uLCBUZXh0R3JpZGRpbmcsIFVuaXRzLCBVbml0c1ZhbHVlLCBXYXJwU3R5bGVcclxufSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7XHJcblx0UHNkUmVhZGVyLCByZWFkU2lnbmF0dXJlLCByZWFkVW5pY29kZVN0cmluZywgcmVhZFVpbnQzMiwgcmVhZFVpbnQ4LCByZWFkRmxvYXQ2NCxcclxuXHRyZWFkQnl0ZXMsIHJlYWRBc2NpaVN0cmluZywgcmVhZEludDMyLCByZWFkRmxvYXQzMiwgcmVhZEludDMyTEUsIHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aFxyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcclxuaW1wb3J0IHtcclxuXHRQc2RXcml0ZXIsIHdyaXRlU2lnbmF0dXJlLCB3cml0ZUJ5dGVzLCB3cml0ZVVpbnQzMiwgd3JpdGVGbG9hdDY0LCB3cml0ZVVpbnQ4LFxyXG5cdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nLCB3cml0ZUludDMyLCB3cml0ZUZsb2F0MzIsIHdyaXRlVW5pY29kZVN0cmluZ1xyXG59IGZyb20gJy4vcHNkV3JpdGVyJztcclxuXHJcbmludGVyZmFjZSBEaWN0IHsgW2tleTogc3RyaW5nXTogc3RyaW5nOyB9XHJcbmludGVyZmFjZSBOYW1lQ2xhc3NJRCB7IG5hbWU6IHN0cmluZzsgY2xhc3NJRDogc3RyaW5nOyB9XHJcbmludGVyZmFjZSBFeHRUeXBlRGljdCB7IFtrZXk6IHN0cmluZ106IE5hbWVDbGFzc0lEOyB9XHJcblxyXG5mdW5jdGlvbiByZXZNYXAobWFwOiBEaWN0KSB7XHJcblx0Y29uc3QgcmVzdWx0OiBEaWN0ID0ge307XHJcblx0T2JqZWN0LmtleXMobWFwKS5mb3JFYWNoKGtleSA9PiByZXN1bHRbbWFwW2tleV1dID0ga2V5KTtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5jb25zdCB1bml0c01hcDogRGljdCA9IHtcclxuXHQnI0FuZyc6ICdBbmdsZScsXHJcblx0JyNSc2wnOiAnRGVuc2l0eScsXHJcblx0JyNSbHQnOiAnRGlzdGFuY2UnLFxyXG5cdCcjTm5lJzogJ05vbmUnLFxyXG5cdCcjUHJjJzogJ1BlcmNlbnQnLFxyXG5cdCcjUHhsJzogJ1BpeGVscycsXHJcblx0JyNNbG0nOiAnTWlsbGltZXRlcnMnLFxyXG5cdCcjUG50JzogJ1BvaW50cycsXHJcblx0J1JyUGknOiAnUGljYXMnLFxyXG5cdCdSckluJzogJ0luY2hlcycsXHJcblx0J1JyQ20nOiAnQ2VudGltZXRlcnMnLFxyXG59O1xyXG5cclxuY29uc3QgdW5pdHNNYXBSZXYgPSByZXZNYXAodW5pdHNNYXApO1xyXG5sZXQgbG9nRXJyb3JzID0gZmFsc2U7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0TG9nRXJyb3JzKHZhbHVlOiBib29sZWFuKSB7XHJcblx0bG9nRXJyb3JzID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1ha2VUeXBlKG5hbWU6IHN0cmluZywgY2xhc3NJRDogc3RyaW5nKSB7XHJcblx0cmV0dXJuIHsgbmFtZSwgY2xhc3NJRCB9O1xyXG59XHJcblxyXG5jb25zdCBmaWVsZFRvRXh0VHlwZTogRXh0VHlwZURpY3QgPSB7XHJcblx0c3Ryb2tlU3R5bGVDb250ZW50OiBtYWtlVHlwZSgnJywgJ3NvbGlkQ29sb3JMYXllcicpLFxyXG5cdC8vIHByaW50UHJvb2ZTZXR1cDogbWFrZVR5cGUoJ+agoeagt+iuvue9ricsICdwcm9vZlNldHVwJyksIC8vIFRFU1RJTkdcclxuXHRwcmludFByb29mU2V0dXA6IG1ha2VUeXBlKCdQcm9vZiBTZXR1cCcsICdwcm9vZlNldHVwJyksXHJcblx0cGF0dGVybkZpbGw6IG1ha2VUeXBlKCcnLCAncGF0dGVybkZpbGwnKSxcclxuXHRHcmFkOiBtYWtlVHlwZSgnR3JhZGllbnQnLCAnR3JkbicpLFxyXG5cdGViYmw6IG1ha2VUeXBlKCcnLCAnZWJibCcpLFxyXG5cdFNvRmk6IG1ha2VUeXBlKCcnLCAnU29GaScpLFxyXG5cdEdyRmw6IG1ha2VUeXBlKCcnLCAnR3JGbCcpLFxyXG5cdHNkd0M6IG1ha2VUeXBlKCcnLCAnUkdCQycpLFxyXG5cdGhnbEM6IG1ha2VUeXBlKCcnLCAnUkdCQycpLFxyXG5cdCdDbHIgJzogbWFrZVR5cGUoJycsICdSR0JDJyksXHJcblx0J3RpbnRDb2xvcic6IG1ha2VUeXBlKCcnLCAnUkdCQycpLFxyXG5cdE9mc3Q6IG1ha2VUeXBlKCcnLCAnUG50ICcpLFxyXG5cdENoRlg6IG1ha2VUeXBlKCcnLCAnQ2hGWCcpLFxyXG5cdE1wZ1M6IG1ha2VUeXBlKCcnLCAnU2hwQycpLFxyXG5cdERyU2g6IG1ha2VUeXBlKCcnLCAnRHJTaCcpLFxyXG5cdElyU2g6IG1ha2VUeXBlKCcnLCAnSXJTaCcpLFxyXG5cdE9yR2w6IG1ha2VUeXBlKCcnLCAnT3JHbCcpLFxyXG5cdElyR2w6IG1ha2VUeXBlKCcnLCAnSXJHbCcpLFxyXG5cdFRyblM6IG1ha2VUeXBlKCcnLCAnU2hwQycpLFxyXG5cdFB0cm46IG1ha2VUeXBlKCcnLCAnUHRybicpLFxyXG5cdEZyRlg6IG1ha2VUeXBlKCcnLCAnRnJGWCcpLFxyXG5cdHBoYXNlOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRmcmFtZVN0ZXA6IG1ha2VUeXBlKCcnLCAnbnVsbCcpLFxyXG5cdGR1cmF0aW9uOiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRib3VuZHM6IG1ha2VUeXBlKCcnLCAnUmN0bicpLFxyXG5cdGN1c3RvbUVudmVsb3BlV2FycDogbWFrZVR5cGUoJycsICdjdXN0b21FbnZlbG9wZVdhcnAnKSxcclxuXHR3YXJwOiBtYWtlVHlwZSgnJywgJ3dhcnAnKSxcclxuXHQnU3ogICc6IG1ha2VUeXBlKCcnLCAnUG50ICcpLFxyXG5cdG9yaWdpbjogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0YXV0b0V4cGFuZE9mZnNldDogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0a2V5T3JpZ2luU2hhcGVCQm94OiBtYWtlVHlwZSgnJywgJ3VuaXRSZWN0JyksXHJcblx0VnJzbjogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0cHNWZXJzaW9uOiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRkb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kQ29sb3I6IG1ha2VUeXBlKCcnLCAnUkdCQycpLFxyXG5cdGFydGJvYXJkUmVjdDogbWFrZVR5cGUoJycsICdjbGFzc0Zsb2F0UmVjdCcpLFxyXG5cdGtleU9yaWdpblJSZWN0UmFkaWk6IG1ha2VUeXBlKCcnLCAncmFkaWknKSxcclxuXHRrZXlPcmlnaW5Cb3hDb3JuZXJzOiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRyZWN0YW5nbGVDb3JuZXJBOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRyZWN0YW5nbGVDb3JuZXJCOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRyZWN0YW5nbGVDb3JuZXJDOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRyZWN0YW5nbGVDb3JuZXJEOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRjb21wSW5mbzogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0VHJuZjogbWFrZVR5cGUoJ1RyYW5zZm9ybScsICdUcm5mJyksXHJcblx0cXVpbHRXYXJwOiBtYWtlVHlwZSgnJywgJ3F1aWx0V2FycCcpLFxyXG5cdGdlbmVyYXRvclNldHRpbmdzOiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRjcmVtYTogbWFrZVR5cGUoJycsICdudWxsJyksXHJcbn07XHJcblxyXG5jb25zdCBmaWVsZFRvQXJyYXlFeHRUeXBlOiBFeHRUeXBlRGljdCA9IHtcclxuXHQnQ3J2ICc6IG1ha2VUeXBlKCcnLCAnQ3JQdCcpLFxyXG5cdENscnM6IG1ha2VUeXBlKCcnLCAnQ2xydCcpLFxyXG5cdFRybnM6IG1ha2VUeXBlKCcnLCAnVHJuUycpLFxyXG5cdGtleURlc2NyaXB0b3JMaXN0OiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRzb2xpZEZpbGxNdWx0aTogbWFrZVR5cGUoJycsICdTb0ZpJyksXHJcblx0Z3JhZGllbnRGaWxsTXVsdGk6IG1ha2VUeXBlKCcnLCAnR3JGbCcpLFxyXG5cdGRyb3BTaGFkb3dNdWx0aTogbWFrZVR5cGUoJycsICdEclNoJyksXHJcblx0aW5uZXJTaGFkb3dNdWx0aTogbWFrZVR5cGUoJycsICdJclNoJyksXHJcblx0ZnJhbWVGWE11bHRpOiBtYWtlVHlwZSgnJywgJ0ZyRlgnKSxcclxufTtcclxuXHJcbmNvbnN0IHR5cGVUb0ZpZWxkOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdOyB9ID0ge1xyXG5cdCdURVhUJzogW1xyXG5cdFx0J1R4dCAnLCAncHJpbnRlck5hbWUnLCAnTm0gICcsICdJZG50JywgJ2JsYWNrQW5kV2hpdGVQcmVzZXRGaWxlTmFtZScsICdMVVQzREZpbGVOYW1lJyxcclxuXHRcdCdwcmVzZXRGaWxlTmFtZScsICdjdXJ2ZXNQcmVzZXRGaWxlTmFtZScsICdtaXhlclByZXNldEZpbGVOYW1lJywgJ3BsYWNlZCcsICdkZXNjcmlwdGlvbicsICdyZWFzb24nLFxyXG5cdFx0J2FydGJvYXJkUHJlc2V0TmFtZScsICdqc29uJyxcclxuXHRdLFxyXG5cdCd0ZHRhJzogWydFbmdpbmVEYXRhJywgJ0xVVDNERmlsZURhdGEnXSxcclxuXHQnbG9uZyc6IFtcclxuXHRcdCdUZXh0SW5kZXgnLCAnUm5kUycsICdNZHBuJywgJ1NtdGgnLCAnTGN0bicsICdzdHJva2VTdHlsZVZlcnNpb24nLCAnTGFJRCcsICdWcnNuJywgJ0NudCAnLFxyXG5cdFx0J0JyZ2gnLCAnQ250cicsICdtZWFucycsICd2aWJyYW5jZScsICdTdHJ0JywgJ2J3UHJlc2V0S2luZCcsICdwcmVzZXRLaW5kJywgJ2NvbXAnLCAnY29tcElEJywgJ29yaWdpbmFsQ29tcElEJyxcclxuXHRcdCdjdXJ2ZXNQcmVzZXRLaW5kJywgJ21peGVyUHJlc2V0S2luZCcsICd1T3JkZXInLCAndk9yZGVyJywgJ1BnTm0nLCAndG90YWxQYWdlcycsICdDcm9wJyxcclxuXHRcdCdudW1lcmF0b3InLCAnZGVub21pbmF0b3InLCAnZnJhbWVDb3VudCcsICdBbm50JywgJ2tleU9yaWdpblR5cGUnLCAndW5pdFZhbHVlUXVhZFZlcnNpb24nLFxyXG5cdFx0J2tleU9yaWdpbkluZGV4JywgJ21ham9yJywgJ21pbm9yJywgJ2ZpeCcsICdkb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZScsICdhcnRib2FyZEJhY2tncm91bmRUeXBlJyxcclxuXHRcdCdudW1Nb2RpZnlpbmdGWCcsICdkZWZvcm1OdW1Sb3dzJywgJ2RlZm9ybU51bUNvbHMnLFxyXG5cdF0sXHJcblx0J2VudW0nOiBbXHJcblx0XHQndGV4dEdyaWRkaW5nJywgJ09ybnQnLCAnd2FycFN0eWxlJywgJ3dhcnBSb3RhdGUnLCAnSW50ZScsICdCbHRuJywgJ0NsclMnLFxyXG5cdFx0J3Nkd00nLCAnaGdsTScsICdidmxUJywgJ2J2bFMnLCAnYnZsRCcsICdNZCAgJywgJ2dsd1MnLCAnR3JkRicsICdHbHdUJyxcclxuXHRcdCdzdHJva2VTdHlsZUxpbmVDYXBUeXBlJywgJ3N0cm9rZVN0eWxlTGluZUpvaW5UeXBlJywgJ3N0cm9rZVN0eWxlTGluZUFsaWdubWVudCcsXHJcblx0XHQnc3Ryb2tlU3R5bGVCbGVuZE1vZGUnLCAnUG50VCcsICdTdHlsJywgJ2xvb2t1cFR5cGUnLCAnTFVURm9ybWF0JywgJ2RhdGFPcmRlcicsXHJcblx0XHQndGFibGVPcmRlcicsICdlbmFibGVDb21wQ29yZScsICdlbmFibGVDb21wQ29yZUdQVScsICdjb21wQ29yZVN1cHBvcnQnLCAnY29tcENvcmVHUFVTdXBwb3J0JywgJ0VuZ24nLFxyXG5cdFx0J2VuYWJsZUNvbXBDb3JlVGhyZWFkcycsXHJcblx0XSxcclxuXHQnYm9vbCc6IFtcclxuXHRcdCdQc3RTJywgJ3ByaW50U2l4dGVlbkJpdCcsICdtYXN0ZXJGWFN3aXRjaCcsICdlbmFiJywgJ3VnbGcnLCAnYW50aWFsaWFzR2xvc3MnLFxyXG5cdFx0J3VzZVNoYXBlJywgJ3VzZVRleHR1cmUnLCAnbWFzdGVyRlhTd2l0Y2gnLCAndWdsZycsICdhbnRpYWxpYXNHbG9zcycsICd1c2VTaGFwZScsXHJcblx0XHQndXNlVGV4dHVyZScsICdBbGduJywgJ1J2cnMnLCAnRHRocicsICdJbnZyJywgJ1ZjdEMnLCAnU2hUcicsICdsYXllckNvbmNlYWxzJyxcclxuXHRcdCdzdHJva2VFbmFibGVkJywgJ2ZpbGxFbmFibGVkJywgJ3N0cm9rZVN0eWxlU2NhbGVMb2NrJywgJ3N0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0JyxcclxuXHRcdCdoYXJkUHJvb2YnLCAnTXBCbCcsICdwYXBlcldoaXRlJywgJ3VzZUxlZ2FjeScsICdBdXRvJywgJ0xhYiAnLCAndXNlVGludCcsICdrZXlTaGFwZUludmFsaWRhdGVkJyxcclxuXHRcdCdhdXRvRXhwYW5kRW5hYmxlZCcsICdhdXRvTmVzdEVuYWJsZWQnLCAnYXV0b1Bvc2l0aW9uRW5hYmxlZCcsICdzaHJpbmt3cmFwT25TYXZlRW5hYmxlZCcsXHJcblx0XHQncHJlc2VudCcsICdzaG93SW5EaWFsb2cnLCAnb3ZlcnByaW50JyxcclxuXHRdLFxyXG5cdCdkb3ViJzogW1xyXG5cdFx0J3dhcnBWYWx1ZScsICd3YXJwUGVyc3BlY3RpdmUnLCAnd2FycFBlcnNwZWN0aXZlT3RoZXInLCAnSW50cicsICdXZHRoJywgJ0hnaHQnLFxyXG5cdFx0J3N0cm9rZVN0eWxlTWl0ZXJMaW1pdCcsICdzdHJva2VTdHlsZVJlc29sdXRpb24nLCAnbGF5ZXJUaW1lJywgJ2tleU9yaWdpblJlc29sdXRpb24nLFxyXG5cdFx0J3h4JywgJ3h5JywgJ3l4JywgJ3l5JywgJ3R4JywgJ3R5JyxcclxuXHRdLFxyXG5cdCdVbnRGJzogW1xyXG5cdFx0J1NjbCAnLCAnc2R3TycsICdoZ2xPJywgJ2xhZ2wnLCAnTGFsZCcsICdzcmdSJywgJ2JsdXInLCAnU2Z0bicsICdPcGN0JywgJ0RzdG4nLCAnQW5nbCcsXHJcblx0XHQnQ2ttdCcsICdOb3NlJywgJ0lucHInLCAnU2hkTicsICdzdHJva2VTdHlsZUxpbmVXaWR0aCcsICdzdHJva2VTdHlsZUxpbmVEYXNoT2Zmc2V0JyxcclxuXHRcdCdzdHJva2VTdHlsZU9wYWNpdHknLCAnSCAgICcsICdUb3AgJywgJ0xlZnQnLCAnQnRvbScsICdSZ2h0JywgJ1JzbHQnLFxyXG5cdFx0J3RvcFJpZ2h0JywgJ3RvcExlZnQnLCAnYm90dG9tTGVmdCcsICdib3R0b21SaWdodCcsXHJcblx0XSxcclxuXHQnVmxMcyc6IFtcclxuXHRcdCdDcnYgJywgJ0NscnMnLCAnTW5tICcsICdNeG0gJywgJ1RybnMnLCAncGF0aExpc3QnLCAnc3Ryb2tlU3R5bGVMaW5lRGFzaFNldCcsICdGckxzJyxcclxuXHRcdCdMYVN0JywgJ1RybmYnLCAnbm9uQWZmaW5lVHJhbnNmb3JtJywgJ2tleURlc2NyaXB0b3JMaXN0JywgJ2d1aWRlSW5kZWNlcycsICdncmFkaWVudEZpbGxNdWx0aScsXHJcblx0XHQnc29saWRGaWxsTXVsdGknLCAnZnJhbWVGWE11bHRpJywgJ2lubmVyU2hhZG93TXVsdGknLCAnZHJvcFNoYWRvd011bHRpJyxcclxuXHRdLFxyXG5cdCdPYkFyJzogWydtZXNoUG9pbnRzJywgJ3F1aWx0U2xpY2VYJywgJ3F1aWx0U2xpY2VZJ10sXHJcblx0J29iaiAnOiBbJ251bGwnXSxcclxufTtcclxuXHJcbmNvbnN0IGNoYW5uZWxzID0gW1xyXG5cdCdSZCAgJywgJ0dybiAnLCAnQmwgICcsICdZbGx3JywgJ1lsdyAnLCAnQ3luICcsICdNZ250JywgJ0JsY2snLCAnR3J5ICcsICdMbW5jJywgJ0EgICAnLCAnQiAgICcsXHJcbl07XHJcblxyXG5jb25zdCBmaWVsZFRvQXJyYXlUeXBlOiBEaWN0ID0ge1xyXG5cdCdNbm0gJzogJ2xvbmcnLFxyXG5cdCdNeG0gJzogJ2xvbmcnLFxyXG5cdCdGckxzJzogJ2xvbmcnLFxyXG5cdCdzdHJva2VTdHlsZUxpbmVEYXNoU2V0JzogJ1VudEYnLFxyXG5cdCdUcm5mJzogJ2RvdWInLFxyXG5cdCdub25BZmZpbmVUcmFuc2Zvcm0nOiAnZG91YicsXHJcblx0J2tleURlc2NyaXB0b3JMaXN0JzogJ09iamMnLFxyXG5cdCdncmFkaWVudEZpbGxNdWx0aSc6ICdPYmpjJyxcclxuXHQnc29saWRGaWxsTXVsdGknOiAnT2JqYycsXHJcblx0J2ZyYW1lRlhNdWx0aSc6ICdPYmpjJyxcclxuXHQnaW5uZXJTaGFkb3dNdWx0aSc6ICdPYmpjJyxcclxuXHQnZHJvcFNoYWRvd011bHRpJzogJ09iamMnLFxyXG59O1xyXG5cclxuY29uc3QgZmllbGRUb1R5cGU6IERpY3QgPSB7fTtcclxuXHJcbmZvciAoY29uc3QgdHlwZSBvZiBPYmplY3Qua2V5cyh0eXBlVG9GaWVsZCkpIHtcclxuXHRmb3IgKGNvbnN0IGZpZWxkIG9mIHR5cGVUb0ZpZWxkW3R5cGVdKSB7XHJcblx0XHRmaWVsZFRvVHlwZVtmaWVsZF0gPSB0eXBlO1xyXG5cdH1cclxufVxyXG5cclxuZm9yIChjb25zdCBmaWVsZCBvZiBPYmplY3Qua2V5cyhmaWVsZFRvRXh0VHlwZSkpIHtcclxuXHRpZiAoIWZpZWxkVG9UeXBlW2ZpZWxkXSkgZmllbGRUb1R5cGVbZmllbGRdID0gJ09iamMnO1xyXG59XHJcblxyXG5mb3IgKGNvbnN0IGZpZWxkIG9mIE9iamVjdC5rZXlzKGZpZWxkVG9BcnJheUV4dFR5cGUpKSB7XHJcblx0ZmllbGRUb0FycmF5VHlwZVtmaWVsZF0gPSAnT2JqYyc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFR5cGVCeUtleShrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgcm9vdDogc3RyaW5nKSB7XHJcblx0aWYgKGtleSA9PT0gJ1N6ICAnKSB7XHJcblx0XHRyZXR1cm4gKCdXZHRoJyBpbiB2YWx1ZSkgPyAnT2JqYycgOiAoKCd1bml0cycgaW4gdmFsdWUpID8gJ1VudEYnIDogJ2RvdWInKTtcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ1R5cGUnKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/ICdlbnVtJyA6ICdsb25nJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ0FudEEnKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/ICdlbnVtJyA6ICdib29sJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ0hyem4nIHx8IGtleSA9PT0gJ1ZydGMnIHx8IGtleSA9PT0gJ1RvcCAnIHx8IGtleSA9PT0gJ0xlZnQnIHx8IGtleSA9PT0gJ0J0b20nIHx8IGtleSA9PT0gJ1JnaHQnKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyA/ICdkb3ViJyA6ICdVbnRGJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ1Zyc24nKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyA/ICdsb25nJyA6ICdPYmpjJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ1JkICAnIHx8IGtleSA9PT0gJ0dybiAnIHx8IGtleSA9PT0gJ0JsICAnKSB7XHJcblx0XHRyZXR1cm4gcm9vdCA9PT0gJ2FydGQnID8gJ2xvbmcnIDogJ2RvdWInO1xyXG5cdH0gZWxzZSBpZiAoa2V5ID09PSAnVHJuZicpIHtcclxuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKSA/ICdWbExzJyA6ICdPYmpjJztcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZpZWxkVG9UeXBlW2tleV07XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgbGVuZ3RoID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0cmV0dXJuIHJlYWRBc2NpaVN0cmluZyhyZWFkZXIsIGxlbmd0aCB8fCA0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IHN0cmluZykge1xyXG5cdGlmICh2YWx1ZS5sZW5ndGggPT09IDQgJiYgdmFsdWUgIT09ICd3YXJwJykge1xyXG5cdFx0Ly8gd3JpdGUgY2xhc3NJZFxyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDApO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCB2YWx1ZSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdC8vIHdyaXRlIGFzY2lpIHN0cmluZ1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlLmxlbmd0aCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgdmFsdWUuY2hhckNvZGVBdChpKSk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZERlc2NyaXB0b3JTdHJ1Y3R1cmUocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCBvYmplY3Q6IGFueSA9IHt9O1xyXG5cdC8vIG9iamVjdC5fX3N0cnVjdCA9XHJcblx0cmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0Y29uc3QgaXRlbXNDb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtc0NvdW50OyBpKyspIHtcclxuXHRcdGNvbnN0IGtleSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0Y29uc3QgdHlwZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKGA+ICcke2tleX0nICcke3R5cGV9J2ApO1xyXG5cdFx0Y29uc3QgZGF0YSA9IHJlYWRPU1R5cGUocmVhZGVyLCB0eXBlKTtcclxuXHRcdC8vIGlmICghZ2V0VHlwZUJ5S2V5KGtleSwgZGF0YSkpIGNvbnNvbGUubG9nKGA+ICcke2tleX0nICcke3R5cGV9J2AsIGRhdGEpO1xyXG5cdFx0b2JqZWN0W2tleV0gPSBkYXRhO1xyXG5cdH1cclxuXHQvLyBjb25zb2xlLmxvZygnLy8nLCBzdHJ1Y3QpO1xyXG5cdHJldHVybiBvYmplY3Q7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURlc2NyaXB0b3JTdHJ1Y3R1cmUod3JpdGVyOiBQc2RXcml0ZXIsIG5hbWU6IHN0cmluZywgY2xhc3NJZDogc3RyaW5nLCB2YWx1ZTogYW55LCByb290OiBzdHJpbmcpIHtcclxuXHRpZiAobG9nRXJyb3JzICYmICFjbGFzc0lkKSBjb25zb2xlLmxvZygnTWlzc2luZyBjbGFzc0lkIGZvcjogJywgbmFtZSwgY2xhc3NJZCwgdmFsdWUpO1xyXG5cclxuXHQvLyB3cml0ZSBjbGFzcyBzdHJ1Y3R1cmVcclxuXHR3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXIsIG5hbWUpO1xyXG5cdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCBjbGFzc0lkKTtcclxuXHJcblx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIGtleXMubGVuZ3RoKTtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xyXG5cdFx0bGV0IHR5cGUgPSBnZXRUeXBlQnlLZXkoa2V5LCB2YWx1ZVtrZXldLCByb290KTtcclxuXHRcdGxldCBleHRUeXBlID0gZmllbGRUb0V4dFR5cGVba2V5XTtcclxuXHJcblx0XHRpZiAoKGtleSA9PT0gJ1N0cnQnIHx8IGtleSA9PT0gJ0JyZ2gnKSAmJiAnSCAgICcgaW4gdmFsdWUpIHtcclxuXHRcdFx0dHlwZSA9ICdkb3ViJztcclxuXHRcdH0gZWxzZSBpZiAoY2hhbm5lbHMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xyXG5cdFx0XHR0eXBlID0gKGNsYXNzSWQgPT09ICdSR0JDJyAmJiByb290ICE9PSAnYXJ0ZCcpID8gJ2RvdWInIDogJ2xvbmcnO1xyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdwcm9maWxlJykge1xyXG5cdFx0XHR0eXBlID0gY2xhc3NJZCA9PT0gJ3ByaW50T3V0cHV0JyA/ICdURVhUJyA6ICd0ZHRhJztcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnc3Ryb2tlU3R5bGVDb250ZW50Jykge1xyXG5cdFx0XHRpZiAodmFsdWVba2V5XVsnQ2xyICddKSB7XHJcblx0XHRcdFx0ZXh0VHlwZSA9IG1ha2VUeXBlKCcnLCAnc29saWRDb2xvckxheWVyJyk7XHJcblx0XHRcdH0gZWxzZSBpZiAodmFsdWVba2V5XS5HcmFkKSB7XHJcblx0XHRcdFx0ZXh0VHlwZSA9IG1ha2VUeXBlKCcnLCAnZ3JhZGllbnRMYXllcicpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlW2tleV0uUHRybikge1xyXG5cdFx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ3BhdHRlcm5MYXllcicpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGxvZ0Vycm9ycyAmJiBjb25zb2xlLmxvZygnSW52YWxpZCBzdHJva2VTdHlsZUNvbnRlbnQgdmFsdWUnLCB2YWx1ZVtrZXldKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdib3VuZHMnICYmIHJvb3QgPT09ICdxdWlsdFdhcnAnKSB7XHJcblx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ2NsYXNzRmxvYXRSZWN0Jyk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGV4dFR5cGUgJiYgZXh0VHlwZS5jbGFzc0lEID09PSAnUkdCQycpIHtcclxuXHRcdFx0aWYgKCdIICAgJyBpbiB2YWx1ZVtrZXldKSBleHRUeXBlID0geyBjbGFzc0lEOiAnSFNCQycsIG5hbWU6ICcnIH07XHJcblx0XHRcdC8vIFRPRE86IG90aGVyIGNvbG9yIHNwYWNlc1xyXG5cdFx0fVxyXG5cclxuXHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCBrZXkpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCB0eXBlIHx8ICdsb25nJyk7XHJcblx0XHR3cml0ZU9TVHlwZSh3cml0ZXIsIHR5cGUgfHwgJ2xvbmcnLCB2YWx1ZVtrZXldLCBrZXksIGV4dFR5cGUsIHJvb3QpO1xyXG5cdFx0aWYgKGxvZ0Vycm9ycyAmJiAhdHlwZSkgY29uc29sZS5sb2coYE1pc3NpbmcgZGVzY3JpcHRvciBmaWVsZCB0eXBlIGZvcjogJyR7a2V5fScgaW5gLCB2YWx1ZSk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkT1NUeXBlKHJlYWRlcjogUHNkUmVhZGVyLCB0eXBlOiBzdHJpbmcpIHtcclxuXHRzd2l0Y2ggKHR5cGUpIHtcclxuXHRcdGNhc2UgJ29iaiAnOiAvLyBSZWZlcmVuY2VcclxuXHRcdFx0cmV0dXJuIHJlYWRSZWZlcmVuY2VTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdGNhc2UgJ09iamMnOiAvLyBEZXNjcmlwdG9yXHJcblx0XHRjYXNlICdHbGJPJzogLy8gR2xvYmFsT2JqZWN0IHNhbWUgYXMgRGVzY3JpcHRvclxyXG5cdFx0XHRyZXR1cm4gcmVhZERlc2NyaXB0b3JTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdGNhc2UgJ1ZsTHMnOiB7IC8vIExpc3RcclxuXHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGl0ZW1zOiBhbnlbXSA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJyAgPicsIHR5cGUpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2gocmVhZE9TVHlwZShyZWFkZXIsIHR5cGUpKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGl0ZW1zO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnZG91Yic6IC8vIERvdWJsZVxyXG5cdFx0XHRyZXR1cm4gcmVhZEZsb2F0NjQocmVhZGVyKTtcclxuXHRcdGNhc2UgJ1VudEYnOiB7IC8vIFVuaXQgZG91YmxlXHJcblx0XHRcdGNvbnN0IHVuaXRzID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRcdGlmICghdW5pdHNNYXBbdW5pdHNdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7dW5pdHN9YCk7XHJcblx0XHRcdHJldHVybiB7IHVuaXRzOiB1bml0c01hcFt1bml0c10sIHZhbHVlIH07XHJcblx0XHR9XHJcblx0XHRjYXNlICdVbkZsJzogeyAvLyBVbml0IGZsb2F0XHJcblx0XHRcdGNvbnN0IHVuaXRzID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRGbG9hdDMyKHJlYWRlcik7XHJcblx0XHRcdGlmICghdW5pdHNNYXBbdW5pdHNdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7dW5pdHN9YCk7XHJcblx0XHRcdHJldHVybiB7IHVuaXRzOiB1bml0c01hcFt1bml0c10sIHZhbHVlIH07XHJcblx0XHR9XHJcblx0XHRjYXNlICdURVhUJzogLy8gU3RyaW5nXHJcblx0XHRcdHJldHVybiByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdFx0Y2FzZSAnZW51bSc6IHsgLy8gRW51bWVyYXRlZFxyXG5cdFx0XHRjb25zdCB0eXBlID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IHZhbHVlID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7XHJcblx0XHRcdHJldHVybiBgJHt0eXBlfS4ke3ZhbHVlfWA7XHJcblx0XHR9XHJcblx0XHRjYXNlICdsb25nJzogLy8gSW50ZWdlclxyXG5cdFx0XHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRjYXNlICdjb21wJzogeyAvLyBMYXJnZSBJbnRlZ2VyXHJcblx0XHRcdGNvbnN0IGxvdyA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgaGlnaCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmV0dXJuIHsgbG93LCBoaWdoIH07XHJcblx0XHR9XHJcblx0XHRjYXNlICdib29sJzogLy8gQm9vbGVhblxyXG5cdFx0XHRyZXR1cm4gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdGNhc2UgJ3R5cGUnOiAvLyBDbGFzc1xyXG5cdFx0Y2FzZSAnR2xiQyc6IC8vIENsYXNzXHJcblx0XHRcdHJldHVybiByZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdGNhc2UgJ2FsaXMnOiB7IC8vIEFsaWFzXHJcblx0XHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRyZXR1cm4gcmVhZEFzY2lpU3RyaW5nKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRcdH1cclxuXHRcdGNhc2UgJ3RkdGEnOiB7IC8vIFJhdyBEYXRhXHJcblx0XHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRyZXR1cm4gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRcdH1cclxuXHRcdGNhc2UgJ09iQXInOiB7IC8vIE9iamVjdCBhcnJheVxyXG5cdFx0XHRyZWFkSW50MzIocmVhZGVyKTsgLy8gdmVyc2lvbjogMTZcclxuXHRcdFx0cmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTsgLy8gbmFtZTogJydcclxuXHRcdFx0cmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7IC8vICdyYXRpb25hbFBvaW50J1xyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgaXRlbXM6IGFueVtdID0gW107XHJcblxyXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0Y29uc3QgdHlwZTEgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTsgLy8gdHlwZSBIcnpuIHwgVnJ0Y1xyXG5cdFx0XHRcdHJlYWRTaWduYXR1cmUocmVhZGVyKTsgLy8gVW5GbFxyXG5cclxuXHRcdFx0XHRyZWFkU2lnbmF0dXJlKHJlYWRlcik7IC8vIHVuaXRzID8gJyNQeGwnXHJcblx0XHRcdFx0Y29uc3QgdmFsdWVzQ291bnQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2YWx1ZXM6IG51bWJlcltdID0gW107XHJcblx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPCB2YWx1ZXNDb3VudDsgaisrKSB7XHJcblx0XHRcdFx0XHR2YWx1ZXMucHVzaChyZWFkRmxvYXQ2NChyZWFkZXIpKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGl0ZW1zLnB1c2goeyB0eXBlOiB0eXBlMSwgdmFsdWVzIH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gaXRlbXM7XHJcblx0XHR9XHJcblx0XHRjYXNlICdQdGggJzogeyAvLyBGaWxlIHBhdGhcclxuXHRcdFx0Lypjb25zdCBsZW5ndGggPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBzaWcgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcGF0aFNpemUgPSovIHJlYWRJbnQzMkxFKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGNoYXJzQ291bnQgPSByZWFkSW50MzJMRShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBwYXRoID0gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlciwgY2hhcnNDb3VudCk7XHJcblx0XHRcdHJldHVybiB7IHNpZywgcGF0aCB9O1xyXG5cdFx0fVxyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFR5U2ggZGVzY3JpcHRvciBPU1R5cGU6ICR7dHlwZX0gYXQgJHtyZWFkZXIub2Zmc2V0LnRvU3RyaW5nKDE2KX1gKTtcclxuXHR9XHJcbn1cclxuXHJcbmNvbnN0IE9iQXJUeXBlczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7IH0gPSB7XHJcblx0bWVzaFBvaW50czogJ3JhdGlvbmFsUG9pbnQnLFxyXG5cdHF1aWx0U2xpY2VYOiAnVW50RicsXHJcblx0cXVpbHRTbGljZVk6ICdVbnRGJyxcclxufTtcclxuXHJcbmZ1bmN0aW9uIHdyaXRlT1NUeXBlKHdyaXRlcjogUHNkV3JpdGVyLCB0eXBlOiBzdHJpbmcsIHZhbHVlOiBhbnksIGtleTogc3RyaW5nLCBleHRUeXBlOiBOYW1lQ2xhc3NJRCB8IHVuZGVmaW5lZCwgcm9vdDogc3RyaW5nKSB7XHJcblx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRjYXNlICdvYmogJzogLy8gUmVmZXJlbmNlXHJcblx0XHRcdHdyaXRlUmVmZXJlbmNlU3RydWN0dXJlKHdyaXRlciwga2V5LCB2YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnT2JqYyc6IC8vIERlc2NyaXB0b3JcclxuXHRcdGNhc2UgJ0dsYk8nOiAvLyBHbG9iYWxPYmplY3Qgc2FtZSBhcyBEZXNjcmlwdG9yXHJcblx0XHRcdGlmICghZXh0VHlwZSkgdGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGV4dCB0eXBlIGZvcjogJyR7a2V5fScgKCR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfSlgKTtcclxuXHRcdFx0d3JpdGVEZXNjcmlwdG9yU3RydWN0dXJlKHdyaXRlciwgZXh0VHlwZS5uYW1lLCBleHRUeXBlLmNsYXNzSUQsIHZhbHVlLCByb290KTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHRjYXNlICdWbExzJzogLy8gTGlzdFxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUubGVuZ3RoKTtcclxuXHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRjb25zdCB0eXBlID0gZmllbGRUb0FycmF5VHlwZVtrZXldO1xyXG5cdFx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdHlwZSB8fCAnbG9uZycpO1xyXG5cdFx0XHRcdHdyaXRlT1NUeXBlKHdyaXRlciwgdHlwZSB8fCAnbG9uZycsIHZhbHVlW2ldLCAnJywgZmllbGRUb0FycmF5RXh0VHlwZVtrZXldLCByb290KTtcclxuXHRcdFx0XHRpZiAobG9nRXJyb3JzICYmICF0eXBlKSBjb25zb2xlLmxvZyhgTWlzc2luZyBkZXNjcmlwdG9yIGFycmF5IHR5cGUgZm9yOiAnJHtrZXl9JyBpbmAsIHZhbHVlKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ2RvdWInOiAvLyBEb3VibGVcclxuXHRcdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1VudEYnOiAvLyBVbml0IGRvdWJsZVxyXG5cdFx0XHRpZiAoIXVuaXRzTWFwUmV2W3ZhbHVlLnVuaXRzXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3ZhbHVlLnVuaXRzfSBpbiAke2tleX1gKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCB1bml0c01hcFJldlt2YWx1ZS51bml0c10pO1xyXG5cdFx0XHR3cml0ZUZsb2F0NjQod3JpdGVyLCB2YWx1ZS52YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnVW5GbCc6IC8vIFVuaXQgZmxvYXRcclxuXHRcdFx0aWYgKCF1bml0c01hcFJldlt2YWx1ZS51bml0c10pIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt2YWx1ZS51bml0c30gaW4gJHtrZXl9YCk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKTtcclxuXHRcdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgdmFsdWUudmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1RFWFQnOiAvLyBTdHJpbmdcclxuXHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCB2YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnZW51bSc6IHsgLy8gRW51bWVyYXRlZFxyXG5cdFx0XHRjb25zdCBbX3R5cGUsIHZhbF0gPSB2YWx1ZS5zcGxpdCgnLicpO1xyXG5cdFx0XHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgX3R5cGUpO1xyXG5cdFx0XHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgdmFsKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRjYXNlICdsb25nJzogLy8gSW50ZWdlclxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdC8vIGNhc2UgJ2NvbXAnOiAvLyBMYXJnZSBJbnRlZ2VyXHJcblx0XHQvLyBcdHdyaXRlTGFyZ2VJbnRlZ2VyKHJlYWRlcik7XHJcblx0XHRjYXNlICdib29sJzogLy8gQm9vbGVhblxyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgdmFsdWUgPyAxIDogMCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Ly8gY2FzZSAndHlwZSc6IC8vIENsYXNzXHJcblx0XHQvLyBjYXNlICdHbGJDJzogLy8gQ2xhc3NcclxuXHRcdC8vIFx0d3JpdGVDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdFx0Ly8gY2FzZSAnYWxpcyc6IC8vIEFsaWFzXHJcblx0XHQvLyBcdHdyaXRlQWxpYXNTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdGNhc2UgJ3RkdGEnOiAvLyBSYXcgRGF0YVxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUuYnl0ZUxlbmd0aCk7XHJcblx0XHRcdHdyaXRlQnl0ZXMod3JpdGVyLCB2YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnT2JBcic6IHsgLy8gT2JqZWN0IGFycmF5XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCAxNik7IC8vIHZlcnNpb25cclxuXHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCAnJyk7IC8vIG5hbWVcclxuXHRcdFx0Y29uc3QgdHlwZSA9IE9iQXJUeXBlc1trZXldO1xyXG5cdFx0XHRpZiAoIXR5cGUpIHRocm93IG5ldyBFcnJvcihgTm90IGltcGxlbWVudGVkIE9iQXJUeXBlIGZvcjogJHtrZXl9YCk7XHJcblx0XHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCB0eXBlKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlLmxlbmd0aCk7XHJcblxyXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIHZhbHVlW2ldLnR5cGUpOyAvLyBIcnpuIHwgVnJ0Y1xyXG5cdFx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ1VuRmwnKTtcclxuXHRcdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICcjUHhsJyk7XHJcblx0XHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlW2ldLnZhbHVlcy5sZW5ndGgpO1xyXG5cclxuXHRcdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8IHZhbHVlW2ldLnZhbHVlcy5sZW5ndGg7IGorKykge1xyXG5cdFx0XHRcdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdmFsdWVbaV0udmFsdWVzW2pdKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHQvLyBjYXNlICdQdGggJzogLy8gRmlsZSBwYXRoXHJcblx0XHQvLyBcdHdyaXRlRmlsZVBhdGgocmVhZGVyKTtcclxuXHRcdGRlZmF1bHQ6XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm90IGltcGxlbWVudGVkIGRlc2NyaXB0b3IgT1NUeXBlOiAke3R5cGV9YCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkUmVmZXJlbmNlU3RydWN0dXJlKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgaXRlbXNDb3VudCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGl0ZW1zOiBhbnlbXSA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1zQ291bnQ7IGkrKykge1xyXG5cdFx0Y29uc3QgdHlwZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRzd2l0Y2ggKHR5cGUpIHtcclxuXHRcdFx0Y2FzZSAncHJvcCc6IHsgLy8gUHJvcGVydHlcclxuXHRcdFx0XHRyZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBrZXlJRCA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2goa2V5SUQpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ0Nsc3MnOiAvLyBDbGFzc1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2gocmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcikpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICdFbm1yJzogeyAvLyBFbnVtZXJhdGVkIFJlZmVyZW5jZVxyXG5cdFx0XHRcdHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHR5cGVJRCA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7XHJcblx0XHRcdFx0aXRlbXMucHVzaChgJHt0eXBlSUR9LiR7dmFsdWV9YCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAncmVsZSc6IHsgLy8gT2Zmc2V0XHJcblx0XHRcdFx0Ly8gY29uc3QgeyBuYW1lLCBjbGFzc0lEIH0gPVxyXG5cdFx0XHRcdHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2gocmVhZFVpbnQzMihyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdJZG50JzogLy8gSWRlbnRpZmllclxyXG5cdFx0XHRcdGl0ZW1zLnB1c2gocmVhZEludDMyKHJlYWRlcikpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICdpbmR4JzogLy8gSW5kZXhcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRJbnQzMihyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnbmFtZSc6IHsgLy8gTmFtZVxyXG5cdFx0XHRcdHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2gocmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZGVzY3JpcHRvciByZWZlcmVuY2UgdHlwZTogJHt0eXBlfWApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGl0ZW1zO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVJlZmVyZW5jZVN0cnVjdHVyZSh3cml0ZXI6IFBzZFdyaXRlciwgX2tleTogc3RyaW5nLCBpdGVtczogYW55W10pIHtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgaXRlbXMubGVuZ3RoKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0Y29uc3QgdmFsdWUgPSBpdGVtc1tpXTtcclxuXHRcdGxldCB0eXBlID0gJ3Vua25vd24nO1xyXG5cclxuXHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdGlmICgvXlthLXpdK1xcLlthLXpdKyQvaS50ZXN0KHZhbHVlKSkge1xyXG5cdFx0XHRcdHR5cGUgPSAnRW5tcic7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dHlwZSA9ICduYW1lJztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdHlwZSk7XHJcblxyXG5cdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdC8vIGNhc2UgJ3Byb3AnOiAvLyBQcm9wZXJ0eVxyXG5cdFx0XHQvLyBjYXNlICdDbHNzJzogLy8gQ2xhc3NcclxuXHRcdFx0Y2FzZSAnRW5tcic6IHsgLy8gRW51bWVyYXRlZCBSZWZlcmVuY2VcclxuXHRcdFx0XHRjb25zdCBbdHlwZUlELCBlbnVtVmFsdWVdID0gdmFsdWUuc3BsaXQoJy4nKTtcclxuXHRcdFx0XHR3cml0ZUNsYXNzU3RydWN0dXJlKHdyaXRlciwgJ1xcMCcsIHR5cGVJRCk7XHJcblx0XHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIHR5cGVJRCk7XHJcblx0XHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIGVudW1WYWx1ZSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gY2FzZSAncmVsZSc6IC8vIE9mZnNldFxyXG5cdFx0XHQvLyBjYXNlICdJZG50JzogLy8gSWRlbnRpZmllclxyXG5cdFx0XHQvLyBjYXNlICdpbmR4JzogLy8gSW5kZXhcclxuXHRcdFx0Y2FzZSAnbmFtZSc6IHsgLy8gTmFtZVxyXG5cdFx0XHRcdHdyaXRlQ2xhc3NTdHJ1Y3R1cmUod3JpdGVyLCAnXFwwJywgJ0x5ciAnKTtcclxuXHRcdFx0XHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCB2YWx1ZSArICdcXDAnKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBkZXNjcmlwdG9yIHJlZmVyZW5jZSB0eXBlOiAke3R5cGV9YCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gaXRlbXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IG5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdGNvbnN0IGNsYXNzSUQgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHQvLyBjb25zb2xlLmxvZyh7IG5hbWUsIGNsYXNzSUQgfSk7XHJcblx0cmV0dXJuIHsgbmFtZSwgY2xhc3NJRCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUNsYXNzU3RydWN0dXJlKHdyaXRlcjogUHNkV3JpdGVyLCBuYW1lOiBzdHJpbmcsIGNsYXNzSUQ6IHN0cmluZykge1xyXG5cdHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXIsIG5hbWUpO1xyXG5cdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCBjbGFzc0lEKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24gIT09IDE2KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZGVzY3JpcHRvciB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblx0Y29uc3QgZGVzYyA9IHJlYWREZXNjcmlwdG9yU3RydWN0dXJlKHJlYWRlcik7XHJcblx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0cmV0dXJuIGRlc2M7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlcjogUHNkV3JpdGVyLCBuYW1lOiBzdHJpbmcsIGNsYXNzSUQ6IHN0cmluZywgZGVzY3JpcHRvcjogYW55LCByb290ID0gJycpIHtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDE2KTsgLy8gdmVyc2lvblxyXG5cdHdyaXRlRGVzY3JpcHRvclN0cnVjdHVyZSh3cml0ZXIsIG5hbWUsIGNsYXNzSUQsIGRlc2NyaXB0b3IsIHJvb3QpO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBEZXNjcmlwdG9yVW5pdHMgPSAnQW5nbGUnIHwgJ0RlbnNpdHknIHwgJ0Rpc3RhbmNlJyB8ICdOb25lJyB8ICdQZXJjZW50JyB8ICdQaXhlbHMnIHxcclxuXHQnTWlsbGltZXRlcnMnIHwgJ1BvaW50cycgfCAnUGljYXMnIHwgJ0luY2hlcycgfCAnQ2VudGltZXRlcnMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB7XHJcblx0dW5pdHM6IERlc2NyaXB0b3JVbml0cztcclxuXHR2YWx1ZTogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBEZXNjcmlwdG9yQ29sb3IgPSB7XHJcblx0J1JkICAnOiBudW1iZXI7XHJcblx0J0dybiAnOiBudW1iZXI7XHJcblx0J0JsICAnOiBudW1iZXI7XHJcbn0gfCB7XHJcblx0J0ggICAnOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRTdHJ0OiBudW1iZXI7XHJcblx0QnJnaDogbnVtYmVyO1xyXG59IHwge1xyXG5cdCdDeW4gJzogbnVtYmVyO1xyXG5cdE1nbnQ6IG51bWJlcjtcclxuXHQnWWx3ICc6IG51bWJlcjtcclxuXHRCbGNrOiBudW1iZXI7XHJcbn0gfCB7XHJcblx0J0dyeSAnOiBudW1iZXI7XHJcbn0gfCB7XHJcblx0TG1uYzogbnVtYmVyO1xyXG5cdCdBICAgJzogbnVtYmVyO1xyXG5cdCdCICAgJzogbnVtYmVyO1xyXG59O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEZXNjaXB0b3JQYXR0ZXJuIHtcclxuXHQnTm0gICc6IHN0cmluZztcclxuXHRJZG50OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIERlc2NpcHRvckdyYWRpZW50ID0ge1xyXG5cdCdObSAgJzogc3RyaW5nO1xyXG5cdEdyZEY6ICdHcmRGLkNzdFMnO1xyXG5cdEludHI6IG51bWJlcjtcclxuXHRDbHJzOiB7XHJcblx0XHQnQ2xyICc6IERlc2NyaXB0b3JDb2xvcjtcclxuXHRcdFR5cGU6ICdDbHJ5LlVzclMnO1xyXG5cdFx0TGN0bjogbnVtYmVyO1xyXG5cdFx0TWRwbjogbnVtYmVyO1xyXG5cdH1bXTtcclxuXHRUcm5zOiB7XHJcblx0XHRPcGN0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdExjdG46IG51bWJlcjtcclxuXHRcdE1kcG46IG51bWJlcjtcclxuXHR9W107XHJcbn0gfCB7XHJcblx0R3JkRjogJ0dyZEYuQ2xOcyc7XHJcblx0U210aDogbnVtYmVyO1xyXG5cdCdObSAgJzogc3RyaW5nO1xyXG5cdENsclM6IHN0cmluZztcclxuXHRSbmRTOiBudW1iZXI7XHJcblx0VmN0Qz86IGJvb2xlYW47XHJcblx0U2hUcj86IGJvb2xlYW47XHJcblx0J01ubSAnOiBudW1iZXJbXTtcclxuXHQnTXhtICc6IG51bWJlcltdO1xyXG59O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEZXNjcmlwdG9yQ29sb3JDb250ZW50IHtcclxuXHQnQ2xyICc6IERlc2NyaXB0b3JDb2xvcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEZXNjcmlwdG9yR3JhZGllbnRDb250ZW50IHtcclxuXHRHcmFkOiBEZXNjaXB0b3JHcmFkaWVudDtcclxuXHRUeXBlOiBzdHJpbmc7XHJcblx0RHRocj86IGJvb2xlYW47XHJcblx0UnZycz86IGJvb2xlYW47XHJcblx0QW5nbD86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdCdTY2wgJz86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdEFsZ24/OiBib29sZWFuO1xyXG5cdE9mc3Q/OiB7IEhyem46IERlc2NyaXB0b3JVbml0c1ZhbHVlOyBWcnRjOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTsgfTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQge1xyXG5cdFB0cm46IERlc2NpcHRvclBhdHRlcm47XHJcblx0TG5rZD86IGJvb2xlYW47XHJcblx0cGhhc2U/OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9O1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBEZXNjcmlwdG9yVmVjdG9yQ29udGVudCA9IERlc2NyaXB0b3JDb2xvckNvbnRlbnQgfCBEZXNjcmlwdG9yR3JhZGllbnRDb250ZW50IHwgRGVzY3JpcHRvclBhdHRlcm5Db250ZW50O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTdHJva2VEZXNjcmlwdG9yIHtcclxuXHRzdHJva2VTdHlsZVZlcnNpb246IG51bWJlcjtcclxuXHRzdHJva2VFbmFibGVkOiBib29sZWFuO1xyXG5cdGZpbGxFbmFibGVkOiBib29sZWFuO1xyXG5cdHN0cm9rZVN0eWxlTGluZVdpZHRoOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRzdHJva2VTdHlsZUxpbmVEYXNoT2Zmc2V0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRzdHJva2VTdHlsZU1pdGVyTGltaXQ6IG51bWJlcjtcclxuXHRzdHJva2VTdHlsZUxpbmVDYXBUeXBlOiBzdHJpbmc7XHJcblx0c3Ryb2tlU3R5bGVMaW5lSm9pblR5cGU6IHN0cmluZztcclxuXHRzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQ6IHN0cmluZztcclxuXHRzdHJva2VTdHlsZVNjYWxlTG9jazogYm9vbGVhbjtcclxuXHRzdHJva2VTdHlsZVN0cm9rZUFkanVzdDogYm9vbGVhbjtcclxuXHRzdHJva2VTdHlsZUxpbmVEYXNoU2V0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZVtdO1xyXG5cdHN0cm9rZVN0eWxlQmxlbmRNb2RlOiBzdHJpbmc7XHJcblx0c3Ryb2tlU3R5bGVPcGFjaXR5OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRzdHJva2VTdHlsZUNvbnRlbnQ6IERlc2NyaXB0b3JWZWN0b3JDb250ZW50O1xyXG5cdHN0cm9rZVN0eWxlUmVzb2x1dGlvbjogbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRleHREZXNjcmlwdG9yIHtcclxuXHQnVHh0ICc6IHN0cmluZztcclxuXHR0ZXh0R3JpZGRpbmc6IHN0cmluZztcclxuXHRPcm50OiBzdHJpbmc7XHJcblx0QW50QTogc3RyaW5nO1xyXG5cdFRleHRJbmRleDogbnVtYmVyO1xyXG5cdEVuZ2luZURhdGE/OiBVaW50OEFycmF5O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFdhcnBEZXNjcmlwdG9yIHtcclxuXHR3YXJwU3R5bGU6IHN0cmluZztcclxuXHR3YXJwVmFsdWU6IG51bWJlcjtcclxuXHR3YXJwUGVyc3BlY3RpdmU6IG51bWJlcjtcclxuXHR3YXJwUGVyc3BlY3RpdmVPdGhlcjogbnVtYmVyO1xyXG5cdHdhcnBSb3RhdGU6IHN0cmluZztcclxuXHRib3VuZHM/OiB7XHJcblx0XHQnVG9wICc6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0TGVmdDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRCdG9tOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFJnaHQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdH07XHJcblx0dU9yZGVyOiBudW1iZXI7XHJcblx0dk9yZGVyOiBudW1iZXI7XHJcblx0Y3VzdG9tRW52ZWxvcGVXYXJwPzoge1xyXG5cdFx0bWVzaFBvaW50czoge1xyXG5cdFx0XHR0eXBlOiAnSHJ6bicgfCAnVnJ0Yyc7XHJcblx0XHRcdHZhbHVlczogbnVtYmVyW107XHJcblx0XHR9W107XHJcblx0fTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBRdWlsdFdhcnBEZXNjcmlwdG9yIGV4dGVuZHMgV2FycERlc2NyaXB0b3Ige1xyXG5cdGRlZm9ybU51bVJvd3M6IG51bWJlcjtcclxuXHRkZWZvcm1OdW1Db2xzOiBudW1iZXI7XHJcblx0Y3VzdG9tRW52ZWxvcGVXYXJwOiB7XHJcblx0XHRxdWlsdFNsaWNlWDoge1xyXG5cdFx0XHR0eXBlOiAncXVpbHRTbGljZVgnO1xyXG5cdFx0XHR2YWx1ZXM6IG51bWJlcltdO1xyXG5cdFx0fVtdO1xyXG5cdFx0cXVpbHRTbGljZVk6IHtcclxuXHRcdFx0dHlwZTogJ3F1aWx0U2xpY2VZJztcclxuXHRcdFx0dmFsdWVzOiBudW1iZXJbXTtcclxuXHRcdH1bXTtcclxuXHRcdG1lc2hQb2ludHM6IHtcclxuXHRcdFx0dHlwZTogJ0hyem4nIHwgJ1ZydGMnO1xyXG5cdFx0XHR2YWx1ZXM6IG51bWJlcltdO1xyXG5cdFx0fVtdO1xyXG5cdH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUFuZ2xlKHg6IERlc2NyaXB0b3JVbml0c1ZhbHVlKSB7XHJcblx0aWYgKHggPT09IHVuZGVmaW5lZCkgcmV0dXJuIDA7XHJcblx0aWYgKHgudW5pdHMgIT09ICdBbmdsZScpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt4LnVuaXRzfWApO1xyXG5cdHJldHVybiB4LnZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQZXJjZW50KHg6IERlc2NyaXB0b3JVbml0c1ZhbHVlIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKHggPT09IHVuZGVmaW5lZCkgcmV0dXJuIDE7XHJcblx0aWYgKHgudW5pdHMgIT09ICdQZXJjZW50JykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3gudW5pdHN9YCk7XHJcblx0cmV0dXJuIHgudmFsdWUgLyAxMDA7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBlcmNlbnRPckFuZ2xlKHg6IERlc2NyaXB0b3JVbml0c1ZhbHVlIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKHggPT09IHVuZGVmaW5lZCkgcmV0dXJuIDE7XHJcblx0aWYgKHgudW5pdHMgPT09ICdQZXJjZW50JykgcmV0dXJuIHgudmFsdWUgLyAxMDA7XHJcblx0aWYgKHgudW5pdHMgPT09ICdBbmdsZScpIHJldHVybiB4LnZhbHVlIC8gMzYwO1xyXG5cdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt4LnVuaXRzfWApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VVbml0cyh7IHVuaXRzLCB2YWx1ZSB9OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSk6IFVuaXRzVmFsdWUge1xyXG5cdGlmIChcclxuXHRcdHVuaXRzICE9PSAnUGl4ZWxzJyAmJiB1bml0cyAhPT0gJ01pbGxpbWV0ZXJzJyAmJiB1bml0cyAhPT0gJ1BvaW50cycgJiYgdW5pdHMgIT09ICdOb25lJyAmJlxyXG5cdFx0dW5pdHMgIT09ICdQaWNhcycgJiYgdW5pdHMgIT09ICdJbmNoZXMnICYmIHVuaXRzICE9PSAnQ2VudGltZXRlcnMnICYmIHVuaXRzICE9PSAnRGVuc2l0eSdcclxuXHQpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHtKU09OLnN0cmluZ2lmeSh7IHVuaXRzLCB2YWx1ZSB9KX1gKTtcclxuXHR9XHJcblx0cmV0dXJuIHsgdmFsdWUsIHVuaXRzIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVVuaXRzT3JOdW1iZXIodmFsdWU6IERlc2NyaXB0b3JVbml0c1ZhbHVlIHwgbnVtYmVyLCB1bml0czogVW5pdHMgPSAnUGl4ZWxzJyk6IFVuaXRzVmFsdWUge1xyXG5cdGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSByZXR1cm4geyB2YWx1ZSwgdW5pdHMgfTtcclxuXHRyZXR1cm4gcGFyc2VVbml0cyh2YWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVVuaXRzVG9OdW1iZXIoeyB1bml0cywgdmFsdWUgfTogRGVzY3JpcHRvclVuaXRzVmFsdWUsIGV4cGVjdGVkVW5pdHM6IHN0cmluZyk6IG51bWJlciB7XHJcblx0aWYgKHVuaXRzICE9PSBleHBlY3RlZFVuaXRzKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7SlNPTi5zdHJpbmdpZnkoeyB1bml0cywgdmFsdWUgfSl9YCk7XHJcblx0cmV0dXJuIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5pdHNBbmdsZSh2YWx1ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogRGVzY3JpcHRvclVuaXRzVmFsdWUge1xyXG5cdHJldHVybiB7IHVuaXRzOiAnQW5nbGUnLCB2YWx1ZTogdmFsdWUgfHwgMCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5pdHNQZXJjZW50KHZhbHVlOiBudW1iZXIgfCB1bmRlZmluZWQpOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB7XHJcblx0cmV0dXJuIHsgdW5pdHM6ICdQZXJjZW50JywgdmFsdWU6IE1hdGgucm91bmQoKHZhbHVlIHx8IDApICogMTAwKSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdW5pdHNWYWx1ZSh4OiBVbml0c1ZhbHVlIHwgdW5kZWZpbmVkLCBrZXk6IHN0cmluZyk6IERlc2NyaXB0b3JVbml0c1ZhbHVlIHtcclxuXHRpZiAoeCA9PSBudWxsKSByZXR1cm4geyB1bml0czogJ1BpeGVscycsIHZhbHVlOiAwIH07XHJcblxyXG5cdGlmICh0eXBlb2YgeCAhPT0gJ29iamVjdCcpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWU6ICR7SlNPTi5zdHJpbmdpZnkoeCl9IChrZXk6ICR7a2V5fSkgKHNob3VsZCBoYXZlIHZhbHVlIGFuZCB1bml0cylgKTtcclxuXHJcblx0Y29uc3QgeyB1bml0cywgdmFsdWUgfSA9IHg7XHJcblxyXG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdudW1iZXInKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlIGluICR7SlNPTi5zdHJpbmdpZnkoeCl9IChrZXk6ICR7a2V5fSlgKTtcclxuXHJcblx0aWYgKFxyXG5cdFx0dW5pdHMgIT09ICdQaXhlbHMnICYmIHVuaXRzICE9PSAnTWlsbGltZXRlcnMnICYmIHVuaXRzICE9PSAnUG9pbnRzJyAmJiB1bml0cyAhPT0gJ05vbmUnICYmXHJcblx0XHR1bml0cyAhPT0gJ1BpY2FzJyAmJiB1bml0cyAhPT0gJ0luY2hlcycgJiYgdW5pdHMgIT09ICdDZW50aW1ldGVycycgJiYgdW5pdHMgIT09ICdEZW5zaXR5J1xyXG5cdCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzIGluICR7SlNPTi5zdHJpbmdpZnkoeCl9IChrZXk6ICR7a2V5fSlgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7IHVuaXRzLCB2YWx1ZSB9O1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgdGV4dEdyaWRkaW5nID0gY3JlYXRlRW51bTxUZXh0R3JpZGRpbmc+KCd0ZXh0R3JpZGRpbmcnLCAnbm9uZScsIHtcclxuXHRub25lOiAnTm9uZScsXHJcblx0cm91bmQ6ICdSbmQgJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgT3JudCA9IGNyZWF0ZUVudW08T3JpZW50YXRpb24+KCdPcm50JywgJ2hvcml6b250YWwnLCB7XHJcblx0aG9yaXpvbnRhbDogJ0hyem4nLFxyXG5cdHZlcnRpY2FsOiAnVnJ0YycsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEFubnQgPSBjcmVhdGVFbnVtPEFudGlBbGlhcz4oJ0FubnQnLCAnc2hhcnAnLCB7XHJcblx0bm9uZTogJ0Fubm8nLFxyXG5cdHNoYXJwOiAnYW50aUFsaWFzU2hhcnAnLFxyXG5cdGNyaXNwOiAnQW5DcicsXHJcblx0c3Ryb25nOiAnQW5TdCcsXHJcblx0c21vb3RoOiAnQW5TbScsXHJcblx0cGxhdGZvcm06ICdhbnRpQWxpYXNQbGF0Zm9ybUdyYXknLFxyXG5cdHBsYXRmb3JtTENEOiAnYW50aUFsaWFzUGxhdGZvcm1MQ0QnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCB3YXJwU3R5bGUgPSBjcmVhdGVFbnVtPFdhcnBTdHlsZT4oJ3dhcnBTdHlsZScsICdub25lJywge1xyXG5cdG5vbmU6ICd3YXJwTm9uZScsXHJcblx0YXJjOiAnd2FycEFyYycsXHJcblx0YXJjTG93ZXI6ICd3YXJwQXJjTG93ZXInLFxyXG5cdGFyY1VwcGVyOiAnd2FycEFyY1VwcGVyJyxcclxuXHRhcmNoOiAnd2FycEFyY2gnLFxyXG5cdGJ1bGdlOiAnd2FycEJ1bGdlJyxcclxuXHRzaGVsbExvd2VyOiAnd2FycFNoZWxsTG93ZXInLFxyXG5cdHNoZWxsVXBwZXI6ICd3YXJwU2hlbGxVcHBlcicsXHJcblx0ZmxhZzogJ3dhcnBGbGFnJyxcclxuXHR3YXZlOiAnd2FycFdhdmUnLFxyXG5cdGZpc2g6ICd3YXJwRmlzaCcsXHJcblx0cmlzZTogJ3dhcnBSaXNlJyxcclxuXHRmaXNoZXllOiAnd2FycEZpc2hleWUnLFxyXG5cdGluZmxhdGU6ICd3YXJwSW5mbGF0ZScsXHJcblx0c3F1ZWV6ZTogJ3dhcnBTcXVlZXplJyxcclxuXHR0d2lzdDogJ3dhcnBUd2lzdCcsXHJcblx0Y3VzdG9tOiAnd2FycEN1c3RvbScsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEJsbk0gPSBjcmVhdGVFbnVtPEJsZW5kTW9kZT4oJ0Jsbk0nLCAnbm9ybWFsJywge1xyXG5cdCdub3JtYWwnOiAnTnJtbCcsXHJcblx0J2Rpc3NvbHZlJzogJ0RzbHYnLFxyXG5cdCdkYXJrZW4nOiAnRHJrbicsXHJcblx0J211bHRpcGx5JzogJ01sdHAnLFxyXG5cdCdjb2xvciBidXJuJzogJ0NCcm4nLFxyXG5cdCdsaW5lYXIgYnVybic6ICdsaW5lYXJCdXJuJyxcclxuXHQnZGFya2VyIGNvbG9yJzogJ2RhcmtlckNvbG9yJyxcclxuXHQnbGlnaHRlbic6ICdMZ2huJyxcclxuXHQnc2NyZWVuJzogJ1Njcm4nLFxyXG5cdCdjb2xvciBkb2RnZSc6ICdDRGRnJyxcclxuXHQnbGluZWFyIGRvZGdlJzogJ2xpbmVhckRvZGdlJyxcclxuXHQnbGlnaHRlciBjb2xvcic6ICdsaWdodGVyQ29sb3InLFxyXG5cdCdvdmVybGF5JzogJ092cmwnLFxyXG5cdCdzb2Z0IGxpZ2h0JzogJ1NmdEwnLFxyXG5cdCdoYXJkIGxpZ2h0JzogJ0hyZEwnLFxyXG5cdCd2aXZpZCBsaWdodCc6ICd2aXZpZExpZ2h0JyxcclxuXHQnbGluZWFyIGxpZ2h0JzogJ2xpbmVhckxpZ2h0JyxcclxuXHQncGluIGxpZ2h0JzogJ3BpbkxpZ2h0JyxcclxuXHQnaGFyZCBtaXgnOiAnaGFyZE1peCcsXHJcblx0J2RpZmZlcmVuY2UnOiAnRGZybicsXHJcblx0J2V4Y2x1c2lvbic6ICdYY2x1JyxcclxuXHQnc3VidHJhY3QnOiAnYmxlbmRTdWJ0cmFjdGlvbicsXHJcblx0J2RpdmlkZSc6ICdibGVuZERpdmlkZScsXHJcblx0J2h1ZSc6ICdIICAgJyxcclxuXHQnc2F0dXJhdGlvbic6ICdTdHJ0JyxcclxuXHQnY29sb3InOiAnQ2xyICcsXHJcblx0J2x1bWlub3NpdHknOiAnTG1ucycsXHJcblx0Ly8gdXNlZCBpbiBBQlJcclxuXHQnbGluZWFyIGhlaWdodCc6ICdsaW5lYXJIZWlnaHQnLFxyXG5cdCdoZWlnaHQnOiAnSGdodCcsXHJcblx0J3N1YnRyYWN0aW9uJzogJ1NidHInLCAvLyAybmQgdmVyc2lvbiBvZiBzdWJ0cmFjdCA/XHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEJFU2wgPSBjcmVhdGVFbnVtPEJldmVsU3R5bGU+KCdCRVNsJywgJ2lubmVyIGJldmVsJywge1xyXG5cdCdpbm5lciBiZXZlbCc6ICdJbnJCJyxcclxuXHQnb3V0ZXIgYmV2ZWwnOiAnT3RyQicsXHJcblx0J2VtYm9zcyc6ICdFbWJzJyxcclxuXHQncGlsbG93IGVtYm9zcyc6ICdQbEViJyxcclxuXHQnc3Ryb2tlIGVtYm9zcyc6ICdzdHJva2VFbWJvc3MnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBidmxUID0gY3JlYXRlRW51bTxCZXZlbFRlY2huaXF1ZT4oJ2J2bFQnLCAnc21vb3RoJywge1xyXG5cdCdzbW9vdGgnOiAnU2ZCTCcsXHJcblx0J2NoaXNlbCBoYXJkJzogJ1ByQkwnLFxyXG5cdCdjaGlzZWwgc29mdCc6ICdTbG10JyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQkVTcyA9IGNyZWF0ZUVudW08QmV2ZWxEaXJlY3Rpb24+KCdCRVNzJywgJ3VwJywge1xyXG5cdHVwOiAnSW4gICcsXHJcblx0ZG93bjogJ091dCAnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBCRVRFID0gY3JlYXRlRW51bTxHbG93VGVjaG5pcXVlPignQkVURScsICdzb2Z0ZXInLCB7XHJcblx0c29mdGVyOiAnU2ZCTCcsXHJcblx0cHJlY2lzZTogJ1ByQkwnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBJR1NyID0gY3JlYXRlRW51bTxHbG93U291cmNlPignSUdTcicsICdlZGdlJywge1xyXG5cdGVkZ2U6ICdTcmNFJyxcclxuXHRjZW50ZXI6ICdTcmNDJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgR3JkVCA9IGNyZWF0ZUVudW08R3JhZGllbnRTdHlsZT4oJ0dyZFQnLCAnbGluZWFyJywge1xyXG5cdGxpbmVhcjogJ0xuciAnLFxyXG5cdHJhZGlhbDogJ1JkbCAnLFxyXG5cdGFuZ2xlOiAnQW5nbCcsXHJcblx0cmVmbGVjdGVkOiAnUmZsYycsXHJcblx0ZGlhbW9uZDogJ0RtbmQnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBDbHJTID0gY3JlYXRlRW51bTwncmdiJyB8ICdoc2InIHwgJ2xhYic+KCdDbHJTJywgJ3JnYicsIHtcclxuXHRyZ2I6ICdSR0JDJyxcclxuXHRoc2I6ICdIU0JsJyxcclxuXHRsYWI6ICdMYkNsJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgRlN0bCA9IGNyZWF0ZUVudW08J2luc2lkZScgfCAnY2VudGVyJyB8ICdvdXRzaWRlJz4oJ0ZTdGwnLCAnb3V0c2lkZScsIHtcclxuXHRvdXRzaWRlOiAnT3V0RicsXHJcblx0Y2VudGVyOiAnQ3RyRicsXHJcblx0aW5zaWRlOiAnSW5zRidcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgRnJGbCA9IGNyZWF0ZUVudW08J2NvbG9yJyB8ICdncmFkaWVudCcgfCAncGF0dGVybic+KCdGckZsJywgJ2NvbG9yJywge1xyXG5cdGNvbG9yOiAnU0NscicsXHJcblx0Z3JhZGllbnQ6ICdHckZsJyxcclxuXHRwYXR0ZXJuOiAnUHRybicsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IHN0cm9rZVN0eWxlTGluZUNhcFR5cGUgPSBjcmVhdGVFbnVtPExpbmVDYXBUeXBlPignc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZScsICdidXR0Jywge1xyXG5cdGJ1dHQ6ICdzdHJva2VTdHlsZUJ1dHRDYXAnLFxyXG5cdHJvdW5kOiAnc3Ryb2tlU3R5bGVSb3VuZENhcCcsXHJcblx0c3F1YXJlOiAnc3Ryb2tlU3R5bGVTcXVhcmVDYXAnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBzdHJva2VTdHlsZUxpbmVKb2luVHlwZSA9IGNyZWF0ZUVudW08TGluZUpvaW5UeXBlPignc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUnLCAnbWl0ZXInLCB7XHJcblx0bWl0ZXI6ICdzdHJva2VTdHlsZU1pdGVySm9pbicsXHJcblx0cm91bmQ6ICdzdHJva2VTdHlsZVJvdW5kSm9pbicsXHJcblx0YmV2ZWw6ICdzdHJva2VTdHlsZUJldmVsSm9pbicsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IHN0cm9rZVN0eWxlTGluZUFsaWdubWVudCA9IGNyZWF0ZUVudW08TGluZUFsaWdubWVudD4oJ3N0cm9rZVN0eWxlTGluZUFsaWdubWVudCcsICdpbnNpZGUnLCB7XHJcblx0aW5zaWRlOiAnc3Ryb2tlU3R5bGVBbGlnbkluc2lkZScsXHJcblx0Y2VudGVyOiAnc3Ryb2tlU3R5bGVBbGlnbkNlbnRlcicsXHJcblx0b3V0c2lkZTogJ3N0cm9rZVN0eWxlQWxpZ25PdXRzaWRlJyxcclxufSk7XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
