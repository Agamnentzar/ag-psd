"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strokeStyleLineAlignment = exports.strokeStyleLineJoinType = exports.strokeStyleLineCapType = exports.FrFl = exports.FStl = exports.ClrS = exports.GrdT = exports.IGSr = exports.BETE = exports.BESs = exports.bvlT = exports.BESl = exports.BlnM = exports.warpStyle = exports.Annt = exports.Ornt = exports.textGridding = exports.unitsValue = exports.unitsPercent = exports.unitsAngle = exports.parseUnitsToNumber = exports.parseUnitsOrNumber = exports.parseUnits = exports.parsePercentOrAngle = exports.parsePercent = exports.parseAngle = exports.writeVersionAndDescriptor = exports.readVersionAndDescriptor = exports.writeDescriptorStructure = exports.readDescriptorStructure = exports.readAsciiStringOrClassId = exports.setLogErrors = void 0;
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
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
function setLogErrors(value) {
    logErrors = value;
}
exports.setLogErrors = setLogErrors;
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
function readAsciiStringOrClassId(reader) {
    var length = psdReader_1.readInt32(reader);
    return psdReader_1.readAsciiString(reader, length || 4);
}
exports.readAsciiStringOrClassId = readAsciiStringOrClassId;
function writeAsciiStringOrClassId(writer, value) {
    if (value.length === 4 && value !== 'warp') {
        // write classId
        psdWriter_1.writeInt32(writer, 0);
        psdWriter_1.writeSignature(writer, value);
    }
    else {
        // write ascii string
        psdWriter_1.writeInt32(writer, value.length);
        for (var i = 0; i < value.length; i++) {
            psdWriter_1.writeUint8(writer, value.charCodeAt(i));
        }
    }
}
function readDescriptorStructure(reader) {
    var object = {};
    // object.__struct =
    readClassStructure(reader);
    var itemsCount = psdReader_1.readUint32(reader);
    for (var i = 0; i < itemsCount; i++) {
        var key = readAsciiStringOrClassId(reader);
        var type = psdReader_1.readSignature(reader);
        // console.log(`> '${key}' '${type}'`);
        var data = readOSType(reader, type);
        // if (!getTypeByKey(key, data)) console.log(`> '${key}' '${type}'`, data);
        object[key] = data;
    }
    // console.log('//', struct);
    return object;
}
exports.readDescriptorStructure = readDescriptorStructure;
function writeDescriptorStructure(writer, name, classId, value, root) {
    if (logErrors && !classId)
        console.log('Missing classId for: ', name, classId, value);
    // write class structure
    psdWriter_1.writeUnicodeStringWithPadding(writer, name);
    writeAsciiStringOrClassId(writer, classId);
    var keys = Object.keys(value);
    psdWriter_1.writeUint32(writer, keys.length);
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
        psdWriter_1.writeSignature(writer, type || 'long');
        writeOSType(writer, type || 'long', value[key], key, extType, root);
        if (logErrors && !type)
            console.log("Missing descriptor field type for: '" + key + "' in", value);
    }
}
exports.writeDescriptorStructure = writeDescriptorStructure;
function readOSType(reader, type) {
    switch (type) {
        case 'obj ': // Reference
            return readReferenceStructure(reader);
        case 'Objc': // Descriptor
        case 'GlbO': // GlobalObject same as Descriptor
            return readDescriptorStructure(reader);
        case 'VlLs': { // List
            var length_1 = psdReader_1.readInt32(reader);
            var items = [];
            for (var i = 0; i < length_1; i++) {
                var type_1 = psdReader_1.readSignature(reader);
                // console.log('  >', type);
                items.push(readOSType(reader, type_1));
            }
            return items;
        }
        case 'doub': // Double
            return psdReader_1.readFloat64(reader);
        case 'UntF': { // Unit double
            var units = psdReader_1.readSignature(reader);
            var value = psdReader_1.readFloat64(reader);
            if (!unitsMap[units])
                throw new Error("Invalid units: " + units);
            return { units: unitsMap[units], value: value };
        }
        case 'UnFl': { // Unit float
            var units = psdReader_1.readSignature(reader);
            var value = psdReader_1.readFloat32(reader);
            if (!unitsMap[units])
                throw new Error("Invalid units: " + units);
            return { units: unitsMap[units], value: value };
        }
        case 'TEXT': // String
            return psdReader_1.readUnicodeString(reader);
        case 'enum': { // Enumerated
            var type_2 = readAsciiStringOrClassId(reader);
            var value = readAsciiStringOrClassId(reader);
            return type_2 + "." + value;
        }
        case 'long': // Integer
            return psdReader_1.readInt32(reader);
        case 'comp': { // Large Integer
            var low = psdReader_1.readUint32(reader);
            var high = psdReader_1.readUint32(reader);
            return { low: low, high: high };
        }
        case 'bool': // Boolean
            return !!psdReader_1.readUint8(reader);
        case 'type': // Class
        case 'GlbC': // Class
            return readClassStructure(reader);
        case 'alis': { // Alias
            var length_2 = psdReader_1.readInt32(reader);
            return psdReader_1.readAsciiString(reader, length_2);
        }
        case 'tdta': { // Raw Data
            var length_3 = psdReader_1.readInt32(reader);
            return psdReader_1.readBytes(reader, length_3);
        }
        case 'ObAr': { // Object array
            psdReader_1.readInt32(reader); // version: 16
            psdReader_1.readUnicodeString(reader); // name: ''
            readAsciiStringOrClassId(reader); // 'rationalPoint'
            var length_4 = psdReader_1.readInt32(reader);
            var items = [];
            for (var i = 0; i < length_4; i++) {
                var type1 = readAsciiStringOrClassId(reader); // type Hrzn | Vrtc
                psdReader_1.readSignature(reader); // UnFl
                psdReader_1.readSignature(reader); // units ? '#Pxl'
                var valuesCount = psdReader_1.readInt32(reader);
                var values = [];
                for (var j = 0; j < valuesCount; j++) {
                    values.push(psdReader_1.readFloat64(reader));
                }
                items.push({ type: type1, values: values });
            }
            return items;
        }
        case 'Pth ': { // File path
            /*const length =*/ psdReader_1.readInt32(reader);
            var sig = psdReader_1.readSignature(reader);
            /*const pathSize =*/ psdReader_1.readInt32LE(reader);
            var charsCount = psdReader_1.readInt32LE(reader);
            var path = psdReader_1.readUnicodeStringWithLength(reader, charsCount);
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
            psdWriter_1.writeInt32(writer, value.length);
            for (var i = 0; i < value.length; i++) {
                var type_3 = fieldToArrayType[key];
                psdWriter_1.writeSignature(writer, type_3 || 'long');
                writeOSType(writer, type_3 || 'long', value[i], '', fieldToArrayExtType[key], root);
                if (logErrors && !type_3)
                    console.log("Missing descriptor array type for: '" + key + "' in", value);
            }
            break;
        case 'doub': // Double
            psdWriter_1.writeFloat64(writer, value);
            break;
        case 'UntF': // Unit double
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units + " in " + key);
            psdWriter_1.writeSignature(writer, unitsMapRev[value.units]);
            psdWriter_1.writeFloat64(writer, value.value);
            break;
        case 'UnFl': // Unit float
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units + " in " + key);
            psdWriter_1.writeSignature(writer, unitsMapRev[value.units]);
            psdWriter_1.writeFloat32(writer, value.value);
            break;
        case 'TEXT': // String
            psdWriter_1.writeUnicodeStringWithPadding(writer, value);
            break;
        case 'enum': { // Enumerated
            var _a = value.split('.'), _type = _a[0], val = _a[1];
            writeAsciiStringOrClassId(writer, _type);
            writeAsciiStringOrClassId(writer, val);
            break;
        }
        case 'long': // Integer
            psdWriter_1.writeInt32(writer, value);
            break;
        // case 'comp': // Large Integer
        // 	writeLargeInteger(reader);
        case 'bool': // Boolean
            psdWriter_1.writeUint8(writer, value ? 1 : 0);
            break;
        // case 'type': // Class
        // case 'GlbC': // Class
        // 	writeClassStructure(reader);
        // case 'alis': // Alias
        // 	writeAliasStructure(reader);
        case 'tdta': // Raw Data
            psdWriter_1.writeInt32(writer, value.byteLength);
            psdWriter_1.writeBytes(writer, value);
            break;
        case 'ObAr': { // Object array
            psdWriter_1.writeInt32(writer, 16); // version
            psdWriter_1.writeUnicodeStringWithPadding(writer, ''); // name
            var type_4 = ObArTypes[key];
            if (!type_4)
                throw new Error("Not implemented ObArType for: " + key);
            writeAsciiStringOrClassId(writer, type_4);
            psdWriter_1.writeInt32(writer, value.length);
            for (var i = 0; i < value.length; i++) {
                writeAsciiStringOrClassId(writer, value[i].type); // Hrzn | Vrtc
                psdWriter_1.writeSignature(writer, 'UnFl');
                psdWriter_1.writeSignature(writer, '#Pxl');
                psdWriter_1.writeInt32(writer, value[i].values.length);
                for (var j = 0; j < value[i].values.length; j++) {
                    psdWriter_1.writeFloat64(writer, value[i].values[j]);
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
    var itemsCount = psdReader_1.readInt32(reader);
    var items = [];
    for (var i = 0; i < itemsCount; i++) {
        var type = psdReader_1.readSignature(reader);
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
                items.push(psdReader_1.readUint32(reader));
                break;
            }
            case 'Idnt': // Identifier
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'indx': // Index
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'name': { // Name
                readClassStructure(reader);
                items.push(psdReader_1.readUnicodeString(reader));
                break;
            }
            default:
                throw new Error("Invalid descriptor reference type: " + type);
        }
    }
    return items;
}
function writeReferenceStructure(writer, _key, items) {
    psdWriter_1.writeInt32(writer, items.length);
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
        psdWriter_1.writeSignature(writer, type);
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
                psdWriter_1.writeUnicodeString(writer, value + '\0');
                break;
            }
            default:
                throw new Error("Invalid descriptor reference type: " + type);
        }
    }
    return items;
}
function readClassStructure(reader) {
    var name = psdReader_1.readUnicodeString(reader);
    var classID = readAsciiStringOrClassId(reader);
    // console.log({ name, classID });
    return { name: name, classID: classID };
}
function writeClassStructure(writer, name, classID) {
    psdWriter_1.writeUnicodeString(writer, name);
    writeAsciiStringOrClassId(writer, classID);
}
function readVersionAndDescriptor(reader) {
    var version = psdReader_1.readUint32(reader);
    if (version !== 16)
        throw new Error("Invalid descriptor version: " + version);
    var desc = readDescriptorStructure(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    return desc;
}
exports.readVersionAndDescriptor = readVersionAndDescriptor;
function writeVersionAndDescriptor(writer, name, classID, descriptor, root) {
    if (root === void 0) { root = ''; }
    psdWriter_1.writeUint32(writer, 16); // version
    writeDescriptorStructure(writer, name, classID, descriptor, root);
}
exports.writeVersionAndDescriptor = writeVersionAndDescriptor;
function parseAngle(x) {
    if (x === undefined)
        return 0;
    if (x.units !== 'Angle')
        throw new Error("Invalid units: " + x.units);
    return x.value;
}
exports.parseAngle = parseAngle;
function parsePercent(x) {
    if (x === undefined)
        return 1;
    if (x.units !== 'Percent')
        throw new Error("Invalid units: " + x.units);
    return x.value / 100;
}
exports.parsePercent = parsePercent;
function parsePercentOrAngle(x) {
    if (x === undefined)
        return 1;
    if (x.units === 'Percent')
        return x.value / 100;
    if (x.units === 'Angle')
        return x.value / 360;
    throw new Error("Invalid units: " + x.units);
}
exports.parsePercentOrAngle = parsePercentOrAngle;
function parseUnits(_a) {
    var units = _a.units, value = _a.value;
    if (units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
        units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters' && units !== 'Density') {
        throw new Error("Invalid units: " + JSON.stringify({ units: units, value: value }));
    }
    return { value: value, units: units };
}
exports.parseUnits = parseUnits;
function parseUnitsOrNumber(value, units) {
    if (units === void 0) { units = 'Pixels'; }
    if (typeof value === 'number')
        return { value: value, units: units };
    return parseUnits(value);
}
exports.parseUnitsOrNumber = parseUnitsOrNumber;
function parseUnitsToNumber(_a, expectedUnits) {
    var units = _a.units, value = _a.value;
    if (units !== expectedUnits)
        throw new Error("Invalid units: " + JSON.stringify({ units: units, value: value }));
    return value;
}
exports.parseUnitsToNumber = parseUnitsToNumber;
function unitsAngle(value) {
    return { units: 'Angle', value: value || 0 };
}
exports.unitsAngle = unitsAngle;
function unitsPercent(value) {
    return { units: 'Percent', value: Math.round((value || 0) * 100) };
}
exports.unitsPercent = unitsPercent;
function unitsValue(x, key) {
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
exports.unitsValue = unitsValue;
exports.textGridding = helpers_1.createEnum('textGridding', 'none', {
    none: 'None',
    round: 'Rnd ',
});
exports.Ornt = helpers_1.createEnum('Ornt', 'horizontal', {
    horizontal: 'Hrzn',
    vertical: 'Vrtc',
});
exports.Annt = helpers_1.createEnum('Annt', 'sharp', {
    none: 'Anno',
    sharp: 'antiAliasSharp',
    crisp: 'AnCr',
    strong: 'AnSt',
    smooth: 'AnSm',
    platform: 'antiAliasPlatformGray',
    platformLCD: 'antiAliasPlatformLCD',
});
exports.warpStyle = helpers_1.createEnum('warpStyle', 'none', {
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
exports.BlnM = helpers_1.createEnum('BlnM', 'normal', {
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
exports.BESl = helpers_1.createEnum('BESl', 'inner bevel', {
    'inner bevel': 'InrB',
    'outer bevel': 'OtrB',
    'emboss': 'Embs',
    'pillow emboss': 'PlEb',
    'stroke emboss': 'strokeEmboss',
});
exports.bvlT = helpers_1.createEnum('bvlT', 'smooth', {
    'smooth': 'SfBL',
    'chisel hard': 'PrBL',
    'chisel soft': 'Slmt',
});
exports.BESs = helpers_1.createEnum('BESs', 'up', {
    up: 'In  ',
    down: 'Out ',
});
exports.BETE = helpers_1.createEnum('BETE', 'softer', {
    softer: 'SfBL',
    precise: 'PrBL',
});
exports.IGSr = helpers_1.createEnum('IGSr', 'edge', {
    edge: 'SrcE',
    center: 'SrcC',
});
exports.GrdT = helpers_1.createEnum('GrdT', 'linear', {
    linear: 'Lnr ',
    radial: 'Rdl ',
    angle: 'Angl',
    reflected: 'Rflc',
    diamond: 'Dmnd',
});
exports.ClrS = helpers_1.createEnum('ClrS', 'rgb', {
    rgb: 'RGBC',
    hsb: 'HSBl',
    lab: 'LbCl',
});
exports.FStl = helpers_1.createEnum('FStl', 'outside', {
    outside: 'OutF',
    center: 'CtrF',
    inside: 'InsF'
});
exports.FrFl = helpers_1.createEnum('FrFl', 'color', {
    color: 'SClr',
    gradient: 'GrFl',
    pattern: 'Ptrn',
});
exports.strokeStyleLineCapType = helpers_1.createEnum('strokeStyleLineCapType', 'butt', {
    butt: 'strokeStyleButtCap',
    round: 'strokeStyleRoundCap',
    square: 'strokeStyleSquareCap',
});
exports.strokeStyleLineJoinType = helpers_1.createEnum('strokeStyleLineJoinType', 'miter', {
    miter: 'strokeStyleMiterJoin',
    round: 'strokeStyleRoundJoin',
    bevel: 'strokeStyleBevelJoin',
});
exports.strokeStyleLineAlignment = helpers_1.createEnum('strokeStyleLineAlignment', 'inside', {
    inside: 'strokeStyleAlignInside',
    center: 'strokeStyleAlignCenter',
    outside: 'strokeStyleAlignOutside',
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImRlc2NyaXB0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXVDO0FBS3ZDLHlDQUdxQjtBQUNyQix5Q0FHcUI7QUFNckIsU0FBUyxNQUFNLENBQUMsR0FBUztJQUN4QixJQUFNLE1BQU0sR0FBUyxFQUFFLENBQUM7SUFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUF0QixDQUFzQixDQUFDLENBQUM7SUFDeEQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsSUFBTSxRQUFRLEdBQVM7SUFDdEIsTUFBTSxFQUFFLE9BQU87SUFDZixNQUFNLEVBQUUsU0FBUztJQUNqQixNQUFNLEVBQUUsVUFBVTtJQUNsQixNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLE1BQU0sRUFBRSxRQUFRO0lBQ2hCLE1BQU0sRUFBRSxhQUFhO0lBQ3JCLE1BQU0sRUFBRSxRQUFRO0lBQ2hCLE1BQU0sRUFBRSxPQUFPO0lBQ2YsTUFBTSxFQUFFLFFBQVE7SUFDaEIsTUFBTSxFQUFFLGFBQWE7Q0FDckIsQ0FBQztBQUVGLElBQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyQyxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFFdEIsU0FBZ0IsWUFBWSxDQUFDLEtBQWM7SUFDMUMsU0FBUyxHQUFHLEtBQUssQ0FBQztBQUNuQixDQUFDO0FBRkQsb0NBRUM7QUFFRCxTQUFTLFFBQVEsQ0FBQyxJQUFZLEVBQUUsT0FBZTtJQUM5QyxPQUFPLEVBQUUsSUFBSSxNQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsQ0FBQztBQUMxQixDQUFDO0FBRUQsSUFBTSxjQUFjLEdBQWdCO0lBQ25DLGtCQUFrQixFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLENBQUM7SUFDbkQsOERBQThEO0lBQzlELGVBQWUsRUFBRSxRQUFRLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQztJQUN0RCxXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxhQUFhLENBQUM7SUFDeEMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDO0lBQ2xDLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzVCLFdBQVcsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUNqQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMx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Q0FDZixDQUFDLENBQUM7QUFFVSxRQUFBLElBQUksR0FBRyxvQkFBVSxDQUF3QixNQUFNLEVBQUUsS0FBSyxFQUFFO0lBQ3BFLEdBQUcsRUFBRSxNQUFNO0lBQ1gsR0FBRyxFQUFFLE1BQU07SUFDWCxHQUFHLEVBQUUsTUFBTTtDQUNYLENBQUMsQ0FBQztBQUVVLFFBQUEsSUFBSSxHQUFHLG9CQUFVLENBQWtDLE1BQU0sRUFBRSxTQUFTLEVBQUU7SUFDbEYsT0FBTyxFQUFFLE1BQU07SUFDZixNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sRUFBRSxNQUFNO0NBQ2QsQ0FBQyxDQUFDO0FBRVUsUUFBQSxJQUFJLEdBQUcsb0JBQVUsQ0FBbUMsTUFBTSxFQUFFLE9BQU8sRUFBRTtJQUNqRixLQUFLLEVBQUUsTUFBTTtJQUNiLFFBQVEsRUFBRSxNQUFNO0lBQ2hCLE9BQU8sRUFBRSxNQUFNO0NBQ2YsQ0FBQyxDQUFDO0FBRVUsUUFBQSxzQkFBc0IsR0FBRyxvQkFBVSxDQUFjLHdCQUF3QixFQUFFLE1BQU0sRUFBRTtJQUMvRixJQUFJLEVBQUUsb0JBQW9CO0lBQzFCLEtBQUssRUFBRSxxQkFBcUI7SUFDNUIsTUFBTSxFQUFFLHNCQUFzQjtDQUM5QixDQUFDLENBQUM7QUFFVSxRQUFBLHVCQUF1QixHQUFHLG9CQUFVLENBQWUseUJBQXlCLEVBQUUsT0FBTyxFQUFFO0lBQ25HLEtBQUssRUFBRSxzQkFBc0I7SUFDN0IsS0FBSyxFQUFFLHNCQUFzQjtJQUM3QixLQUFLLEVBQUUsc0JBQXNCO0NBQzdCLENBQUMsQ0FBQztBQUVVLFFBQUEsd0JBQXdCLEdBQUcsb0JBQVUsQ0FBZ0IsMEJBQTBCLEVBQUUsUUFBUSxFQUFFO0lBQ3ZHLE1BQU0sRUFBRSx3QkFBd0I7SUFDaEMsTUFBTSxFQUFFLHdCQUF3QjtJQUNoQyxPQUFPLEVBQUUseUJBQXlCO0NBQ2xDLENBQUMsQ0FBQyIsImZpbGUiOiJkZXNjcmlwdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlRW51bSB9IGZyb20gJy4vaGVscGVycyc7XHJcbmltcG9ydCB7XHJcblx0QW50aUFsaWFzLCBCZXZlbERpcmVjdGlvbiwgQmV2ZWxTdHlsZSwgQmV2ZWxUZWNobmlxdWUsIEJsZW5kTW9kZSwgR2xvd1NvdXJjZSwgR2xvd1RlY2huaXF1ZSwgR3JhZGllbnRTdHlsZSxcclxuXHRMaW5lQWxpZ25tZW50LCBMaW5lQ2FwVHlwZSwgTGluZUpvaW5UeXBlLCBPcmllbnRhdGlvbiwgVGV4dEdyaWRkaW5nLCBVbml0cywgVW5pdHNWYWx1ZSwgV2FycFN0eWxlXHJcbn0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdFBzZFJlYWRlciwgcmVhZFNpZ25hdHVyZSwgcmVhZFVuaWNvZGVTdHJpbmcsIHJlYWRVaW50MzIsIHJlYWRVaW50OCwgcmVhZEZsb2F0NjQsXHJcblx0cmVhZEJ5dGVzLCByZWFkQXNjaWlTdHJpbmcsIHJlYWRJbnQzMiwgcmVhZEZsb2F0MzIsIHJlYWRJbnQzMkxFLCByZWFkVW5pY29kZVN0cmluZ1dpdGhMZW5ndGhcclxufSBmcm9tICcuL3BzZFJlYWRlcic7XHJcbmltcG9ydCB7XHJcblx0UHNkV3JpdGVyLCB3cml0ZVNpZ25hdHVyZSwgd3JpdGVCeXRlcywgd3JpdGVVaW50MzIsIHdyaXRlRmxvYXQ2NCwgd3JpdGVVaW50OCxcclxuXHR3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZywgd3JpdGVJbnQzMiwgd3JpdGVGbG9hdDMyLCB3cml0ZVVuaWNvZGVTdHJpbmdcclxufSBmcm9tICcuL3BzZFdyaXRlcic7XHJcblxyXG5pbnRlcmZhY2UgRGljdCB7IFtrZXk6IHN0cmluZ106IHN0cmluZzsgfVxyXG5pbnRlcmZhY2UgTmFtZUNsYXNzSUQgeyBuYW1lOiBzdHJpbmc7IGNsYXNzSUQ6IHN0cmluZzsgfVxyXG5pbnRlcmZhY2UgRXh0VHlwZURpY3QgeyBba2V5OiBzdHJpbmddOiBOYW1lQ2xhc3NJRDsgfVxyXG5cclxuZnVuY3Rpb24gcmV2TWFwKG1hcDogRGljdCkge1xyXG5cdGNvbnN0IHJlc3VsdDogRGljdCA9IHt9O1xyXG5cdE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChrZXkgPT4gcmVzdWx0W21hcFtrZXldXSA9IGtleSk7XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuY29uc3QgdW5pdHNNYXA6IERpY3QgPSB7XHJcblx0JyNBbmcnOiAnQW5nbGUnLFxyXG5cdCcjUnNsJzogJ0RlbnNpdHknLFxyXG5cdCcjUmx0JzogJ0Rpc3RhbmNlJyxcclxuXHQnI05uZSc6ICdOb25lJyxcclxuXHQnI1ByYyc6ICdQZXJjZW50JyxcclxuXHQnI1B4bCc6ICdQaXhlbHMnLFxyXG5cdCcjTWxtJzogJ01pbGxpbWV0ZXJzJyxcclxuXHQnI1BudCc6ICdQb2ludHMnLFxyXG5cdCdSclBpJzogJ1BpY2FzJyxcclxuXHQnUnJJbic6ICdJbmNoZXMnLFxyXG5cdCdSckNtJzogJ0NlbnRpbWV0ZXJzJyxcclxufTtcclxuXHJcbmNvbnN0IHVuaXRzTWFwUmV2ID0gcmV2TWFwKHVuaXRzTWFwKTtcclxubGV0IGxvZ0Vycm9ycyA9IGZhbHNlO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNldExvZ0Vycm9ycyh2YWx1ZTogYm9vbGVhbikge1xyXG5cdGxvZ0Vycm9ycyA9IHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWtlVHlwZShuYW1lOiBzdHJpbmcsIGNsYXNzSUQ6IHN0cmluZykge1xyXG5cdHJldHVybiB7IG5hbWUsIGNsYXNzSUQgfTtcclxufVxyXG5cclxuY29uc3QgZmllbGRUb0V4dFR5cGU6IEV4dFR5cGVEaWN0ID0ge1xyXG5cdHN0cm9rZVN0eWxlQ29udGVudDogbWFrZVR5cGUoJycsICdzb2xpZENvbG9yTGF5ZXInKSxcclxuXHQvLyBwcmludFByb29mU2V0dXA6IG1ha2VUeXBlKCfmoKHmoLforr7nva4nLCAncHJvb2ZTZXR1cCcpLCAvLyBURVNUSU5HXHJcblx0cHJpbnRQcm9vZlNldHVwOiBtYWtlVHlwZSgnUHJvb2YgU2V0dXAnLCAncHJvb2ZTZXR1cCcpLFxyXG5cdHBhdHRlcm5GaWxsOiBtYWtlVHlwZSgnJywgJ3BhdHRlcm5GaWxsJyksXHJcblx0R3JhZDogbWFrZVR5cGUoJ0dyYWRpZW50JywgJ0dyZG4nKSxcclxuXHRlYmJsOiBtYWtlVHlwZSgnJywgJ2ViYmwnKSxcclxuXHRTb0ZpOiBtYWtlVHlwZSgnJywgJ1NvRmknKSxcclxuXHRHckZsOiBtYWtlVHlwZSgnJywgJ0dyRmwnKSxcclxuXHRzZHdDOiBtYWtlVHlwZSgnJywgJ1JHQkMnKSxcclxuXHRoZ2xDOiBtYWtlVHlwZSgnJywgJ1JHQkMnKSxcclxuXHQnQ2xyICc6IG1ha2VUeXBlKCcnLCAnUkdCQycpLFxyXG5cdCd0aW50Q29sb3InOiBtYWtlVHlwZSgnJywgJ1JHQkMnKSxcclxuXHRPZnN0OiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRDaEZYOiBtYWtlVHlwZSgnJywgJ0NoRlgnKSxcclxuXHRNcGdTOiBtYWtlVHlwZSgnJywgJ1NocEMnKSxcclxuXHREclNoOiBtYWtlVHlwZSgnJywgJ0RyU2gnKSxcclxuXHRJclNoOiBtYWtlVHlwZSgnJywgJ0lyU2gnKSxcclxuXHRPckdsOiBtYWtlVHlwZSgnJywgJ09yR2wnKSxcclxuXHRJckdsOiBtYWtlVHlwZSgnJywgJ0lyR2wnKSxcclxuXHRUcm5TOiBtYWtlVHlwZSgnJywgJ1NocEMnKSxcclxuXHRQdHJuOiBtYWtlVHlwZSgnJywgJ1B0cm4nKSxcclxuXHRGckZYOiBtYWtlVHlwZSgnJywgJ0ZyRlgnKSxcclxuXHRwaGFzZTogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0ZnJhbWVTdGVwOiBtYWtlVHlwZSgnJywgJ251bGwnKSxcclxuXHRkdXJhdGlvbjogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0Ym91bmRzOiBtYWtlVHlwZSgnJywgJ1JjdG4nKSxcclxuXHRjdXN0b21FbnZlbG9wZVdhcnA6IG1ha2VUeXBlKCcnLCAnY3VzdG9tRW52ZWxvcGVXYXJwJyksXHJcblx0d2FycDogbWFrZVR5cGUoJycsICd3YXJwJyksXHJcblx0J1N6ICAnOiBtYWtlVHlwZSgnJywgJ1BudCAnKSxcclxuXHRvcmlnaW46IG1ha2VUeXBlKCcnLCAnUG50ICcpLFxyXG5cdGF1dG9FeHBhbmRPZmZzZXQ6IG1ha2VUeXBlKCcnLCAnUG50ICcpLFxyXG5cdGtleU9yaWdpblNoYXBlQkJveDogbWFrZVR5cGUoJycsICd1bml0UmVjdCcpLFxyXG5cdFZyc246IG1ha2VUeXBlKCcnLCAnbnVsbCcpLFxyXG5cdHBzVmVyc2lvbjogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yOiBtYWtlVHlwZSgnJywgJ1JHQkMnKSxcclxuXHRhcnRib2FyZFJlY3Q6IG1ha2VUeXBlKCcnLCAnY2xhc3NGbG9hdFJlY3QnKSxcclxuXHRrZXlPcmlnaW5SUmVjdFJhZGlpOiBtYWtlVHlwZSgnJywgJ3JhZGlpJyksXHJcblx0a2V5T3JpZ2luQm94Q29ybmVyczogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0cmVjdGFuZ2xlQ29ybmVyQTogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0cmVjdGFuZ2xlQ29ybmVyQjogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0cmVjdGFuZ2xlQ29ybmVyQzogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0cmVjdGFuZ2xlQ29ybmVyRDogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0Y29tcEluZm86IG1ha2VUeXBlKCcnLCAnbnVsbCcpLFxyXG5cdFRybmY6IG1ha2VUeXBlKCdUcmFuc2Zvcm0nLCAnVHJuZicpLFxyXG5cdHF1aWx0V2FycDogbWFrZVR5cGUoJycsICdxdWlsdFdhcnAnKSxcclxuXHRnZW5lcmF0b3JTZXR0aW5nczogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0Y3JlbWE6IG1ha2VUeXBlKCcnLCAnbnVsbCcpLFxyXG59O1xyXG5cclxuY29uc3QgZmllbGRUb0FycmF5RXh0VHlwZTogRXh0VHlwZURpY3QgPSB7XHJcblx0J0NydiAnOiBtYWtlVHlwZSgnJywgJ0NyUHQnKSxcclxuXHRDbHJzOiBtYWtlVHlwZSgnJywgJ0NscnQnKSxcclxuXHRUcm5zOiBtYWtlVHlwZSgnJywgJ1RyblMnKSxcclxuXHRrZXlEZXNjcmlwdG9yTGlzdDogbWFrZVR5cGUoJycsICdudWxsJyksXHJcblx0c29saWRGaWxsTXVsdGk6IG1ha2VUeXBlKCcnLCAnU29GaScpLFxyXG5cdGdyYWRpZW50RmlsbE11bHRpOiBtYWtlVHlwZSgnJywgJ0dyRmwnKSxcclxuXHRkcm9wU2hhZG93TXVsdGk6IG1ha2VUeXBlKCcnLCAnRHJTaCcpLFxyXG5cdGlubmVyU2hhZG93TXVsdGk6IG1ha2VUeXBlKCcnLCAnSXJTaCcpLFxyXG5cdGZyYW1lRlhNdWx0aTogbWFrZVR5cGUoJycsICdGckZYJyksXHJcbn07XHJcblxyXG5jb25zdCB0eXBlVG9GaWVsZDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXTsgfSA9IHtcclxuXHQnVEVYVCc6IFtcclxuXHRcdCdUeHQgJywgJ3ByaW50ZXJOYW1lJywgJ05tICAnLCAnSWRudCcsICdibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWUnLCAnTFVUM0RGaWxlTmFtZScsXHJcblx0XHQncHJlc2V0RmlsZU5hbWUnLCAnY3VydmVzUHJlc2V0RmlsZU5hbWUnLCAnbWl4ZXJQcmVzZXRGaWxlTmFtZScsICdwbGFjZWQnLCAnZGVzY3JpcHRpb24nLCAncmVhc29uJyxcclxuXHRcdCdhcnRib2FyZFByZXNldE5hbWUnLCAnanNvbicsXHJcblx0XSxcclxuXHQndGR0YSc6IFsnRW5naW5lRGF0YScsICdMVVQzREZpbGVEYXRhJ10sXHJcblx0J2xvbmcnOiBbXHJcblx0XHQnVGV4dEluZGV4JywgJ1JuZFMnLCAnTWRwbicsICdTbXRoJywgJ0xjdG4nLCAnc3Ryb2tlU3R5bGVWZXJzaW9uJywgJ0xhSUQnLCAnVnJzbicsICdDbnQgJyxcclxuXHRcdCdCcmdoJywgJ0NudHInLCAnbWVhbnMnLCAndmlicmFuY2UnLCAnU3RydCcsICdid1ByZXNldEtpbmQnLCAncHJlc2V0S2luZCcsICdjb21wJywgJ2NvbXBJRCcsICdvcmlnaW5hbENvbXBJRCcsXHJcblx0XHQnY3VydmVzUHJlc2V0S2luZCcsICdtaXhlclByZXNldEtpbmQnLCAndU9yZGVyJywgJ3ZPcmRlcicsICdQZ05tJywgJ3RvdGFsUGFnZXMnLCAnQ3JvcCcsXHJcblx0XHQnbnVtZXJhdG9yJywgJ2Rlbm9taW5hdG9yJywgJ2ZyYW1lQ291bnQnLCAnQW5udCcsICdrZXlPcmlnaW5UeXBlJywgJ3VuaXRWYWx1ZVF1YWRWZXJzaW9uJyxcclxuXHRcdCdrZXlPcmlnaW5JbmRleCcsICdtYWpvcicsICdtaW5vcicsICdmaXgnLCAnZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGUnLCAnYXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZScsXHJcblx0XHQnbnVtTW9kaWZ5aW5nRlgnLCAnZGVmb3JtTnVtUm93cycsICdkZWZvcm1OdW1Db2xzJyxcclxuXHRdLFxyXG5cdCdlbnVtJzogW1xyXG5cdFx0J3RleHRHcmlkZGluZycsICdPcm50JywgJ3dhcnBTdHlsZScsICd3YXJwUm90YXRlJywgJ0ludGUnLCAnQmx0bicsICdDbHJTJyxcclxuXHRcdCdzZHdNJywgJ2hnbE0nLCAnYnZsVCcsICdidmxTJywgJ2J2bEQnLCAnTWQgICcsICdnbHdTJywgJ0dyZEYnLCAnR2x3VCcsXHJcblx0XHQnc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZScsICdzdHJva2VTdHlsZUxpbmVKb2luVHlwZScsICdzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQnLFxyXG5cdFx0J3N0cm9rZVN0eWxlQmxlbmRNb2RlJywgJ1BudFQnLCAnU3R5bCcsICdsb29rdXBUeXBlJywgJ0xVVEZvcm1hdCcsICdkYXRhT3JkZXInLFxyXG5cdFx0J3RhYmxlT3JkZXInLCAnZW5hYmxlQ29tcENvcmUnLCAnZW5hYmxlQ29tcENvcmVHUFUnLCAnY29tcENvcmVTdXBwb3J0JywgJ2NvbXBDb3JlR1BVU3VwcG9ydCcsICdFbmduJyxcclxuXHRcdCdlbmFibGVDb21wQ29yZVRocmVhZHMnLFxyXG5cdF0sXHJcblx0J2Jvb2wnOiBbXHJcblx0XHQnUHN0UycsICdwcmludFNpeHRlZW5CaXQnLCAnbWFzdGVyRlhTd2l0Y2gnLCAnZW5hYicsICd1Z2xnJywgJ2FudGlhbGlhc0dsb3NzJyxcclxuXHRcdCd1c2VTaGFwZScsICd1c2VUZXh0dXJlJywgJ21hc3RlckZYU3dpdGNoJywgJ3VnbGcnLCAnYW50aWFsaWFzR2xvc3MnLCAndXNlU2hhcGUnLFxyXG5cdFx0J3VzZVRleHR1cmUnLCAnQWxnbicsICdSdnJzJywgJ0R0aHInLCAnSW52cicsICdWY3RDJywgJ1NoVHInLCAnbGF5ZXJDb25jZWFscycsXHJcblx0XHQnc3Ryb2tlRW5hYmxlZCcsICdmaWxsRW5hYmxlZCcsICdzdHJva2VTdHlsZVNjYWxlTG9jaycsICdzdHJva2VTdHlsZVN0cm9rZUFkanVzdCcsXHJcblx0XHQnaGFyZFByb29mJywgJ01wQmwnLCAncGFwZXJXaGl0ZScsICd1c2VMZWdhY3knLCAnQXV0bycsICdMYWIgJywgJ3VzZVRpbnQnLCAna2V5U2hhcGVJbnZhbGlkYXRlZCcsXHJcblx0XHQnYXV0b0V4cGFuZEVuYWJsZWQnLCAnYXV0b05lc3RFbmFibGVkJywgJ2F1dG9Qb3NpdGlvbkVuYWJsZWQnLCAnc2hyaW5rd3JhcE9uU2F2ZUVuYWJsZWQnLFxyXG5cdFx0J3ByZXNlbnQnLCAnc2hvd0luRGlhbG9nJywgJ292ZXJwcmludCcsXHJcblx0XSxcclxuXHQnZG91Yic6IFtcclxuXHRcdCd3YXJwVmFsdWUnLCAnd2FycFBlcnNwZWN0aXZlJywgJ3dhcnBQZXJzcGVjdGl2ZU90aGVyJywgJ0ludHInLCAnV2R0aCcsICdIZ2h0JyxcclxuXHRcdCdzdHJva2VTdHlsZU1pdGVyTGltaXQnLCAnc3Ryb2tlU3R5bGVSZXNvbHV0aW9uJywgJ2xheWVyVGltZScsICdrZXlPcmlnaW5SZXNvbHV0aW9uJyxcclxuXHRcdCd4eCcsICd4eScsICd5eCcsICd5eScsICd0eCcsICd0eScsXHJcblx0XSxcclxuXHQnVW50Ric6IFtcclxuXHRcdCdTY2wgJywgJ3Nkd08nLCAnaGdsTycsICdsYWdsJywgJ0xhbGQnLCAnc3JnUicsICdibHVyJywgJ1NmdG4nLCAnT3BjdCcsICdEc3RuJywgJ0FuZ2wnLFxyXG5cdFx0J0NrbXQnLCAnTm9zZScsICdJbnByJywgJ1NoZE4nLCAnc3Ryb2tlU3R5bGVMaW5lV2lkdGgnLCAnc3Ryb2tlU3R5bGVMaW5lRGFzaE9mZnNldCcsXHJcblx0XHQnc3Ryb2tlU3R5bGVPcGFjaXR5JywgJ0ggICAnLCAnVG9wICcsICdMZWZ0JywgJ0J0b20nLCAnUmdodCcsICdSc2x0JyxcclxuXHRcdCd0b3BSaWdodCcsICd0b3BMZWZ0JywgJ2JvdHRvbUxlZnQnLCAnYm90dG9tUmlnaHQnLFxyXG5cdF0sXHJcblx0J1ZsTHMnOiBbXHJcblx0XHQnQ3J2ICcsICdDbHJzJywgJ01ubSAnLCAnTXhtICcsICdUcm5zJywgJ3BhdGhMaXN0JywgJ3N0cm9rZVN0eWxlTGluZURhc2hTZXQnLCAnRnJMcycsXHJcblx0XHQnTGFTdCcsICdUcm5mJywgJ25vbkFmZmluZVRyYW5zZm9ybScsICdrZXlEZXNjcmlwdG9yTGlzdCcsICdndWlkZUluZGVjZXMnLCAnZ3JhZGllbnRGaWxsTXVsdGknLFxyXG5cdFx0J3NvbGlkRmlsbE11bHRpJywgJ2ZyYW1lRlhNdWx0aScsICdpbm5lclNoYWRvd011bHRpJywgJ2Ryb3BTaGFkb3dNdWx0aScsXHJcblx0XSxcclxuXHQnT2JBcic6IFsnbWVzaFBvaW50cycsICdxdWlsdFNsaWNlWCcsICdxdWlsdFNsaWNlWSddLFxyXG5cdCdvYmogJzogWydudWxsJ10sXHJcbn07XHJcblxyXG5jb25zdCBjaGFubmVscyA9IFtcclxuXHQnUmQgICcsICdHcm4gJywgJ0JsICAnLCAnWWxsdycsICdZbHcgJywgJ0N5biAnLCAnTWdudCcsICdCbGNrJywgJ0dyeSAnLCAnTG1uYycsICdBICAgJywgJ0IgICAnLFxyXG5dO1xyXG5cclxuY29uc3QgZmllbGRUb0FycmF5VHlwZTogRGljdCA9IHtcclxuXHQnTW5tICc6ICdsb25nJyxcclxuXHQnTXhtICc6ICdsb25nJyxcclxuXHQnRnJMcyc6ICdsb25nJyxcclxuXHQnc3Ryb2tlU3R5bGVMaW5lRGFzaFNldCc6ICdVbnRGJyxcclxuXHQnVHJuZic6ICdkb3ViJyxcclxuXHQnbm9uQWZmaW5lVHJhbnNmb3JtJzogJ2RvdWInLFxyXG5cdCdrZXlEZXNjcmlwdG9yTGlzdCc6ICdPYmpjJyxcclxuXHQnZ3JhZGllbnRGaWxsTXVsdGknOiAnT2JqYycsXHJcblx0J3NvbGlkRmlsbE11bHRpJzogJ09iamMnLFxyXG5cdCdmcmFtZUZYTXVsdGknOiAnT2JqYycsXHJcblx0J2lubmVyU2hhZG93TXVsdGknOiAnT2JqYycsXHJcblx0J2Ryb3BTaGFkb3dNdWx0aSc6ICdPYmpjJyxcclxufTtcclxuXHJcbmNvbnN0IGZpZWxkVG9UeXBlOiBEaWN0ID0ge307XHJcblxyXG5mb3IgKGNvbnN0IHR5cGUgb2YgT2JqZWN0LmtleXModHlwZVRvRmllbGQpKSB7XHJcblx0Zm9yIChjb25zdCBmaWVsZCBvZiB0eXBlVG9GaWVsZFt0eXBlXSkge1xyXG5cdFx0ZmllbGRUb1R5cGVbZmllbGRdID0gdHlwZTtcclxuXHR9XHJcbn1cclxuXHJcbmZvciAoY29uc3QgZmllbGQgb2YgT2JqZWN0LmtleXMoZmllbGRUb0V4dFR5cGUpKSB7XHJcblx0aWYgKCFmaWVsZFRvVHlwZVtmaWVsZF0pIGZpZWxkVG9UeXBlW2ZpZWxkXSA9ICdPYmpjJztcclxufVxyXG5cclxuZm9yIChjb25zdCBmaWVsZCBvZiBPYmplY3Qua2V5cyhmaWVsZFRvQXJyYXlFeHRUeXBlKSkge1xyXG5cdGZpZWxkVG9BcnJheVR5cGVbZmllbGRdID0gJ09iamMnO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRUeXBlQnlLZXkoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHJvb3Q6IHN0cmluZykge1xyXG5cdGlmIChrZXkgPT09ICdTeiAgJykge1xyXG5cdFx0cmV0dXJuICgnV2R0aCcgaW4gdmFsdWUpID8gJ09iamMnIDogKCgndW5pdHMnIGluIHZhbHVlKSA/ICdVbnRGJyA6ICdkb3ViJyk7XHJcblx0fSBlbHNlIGlmIChrZXkgPT09ICdUeXBlJykge1xyXG5cdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyAnZW51bScgOiAnbG9uZyc7XHJcblx0fSBlbHNlIGlmIChrZXkgPT09ICdBbnRBJykge1xyXG5cdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyAnZW51bScgOiAnYm9vbCc7XHJcblx0fSBlbHNlIGlmIChrZXkgPT09ICdIcnpuJyB8fCBrZXkgPT09ICdWcnRjJyB8fCBrZXkgPT09ICdUb3AgJyB8fCBrZXkgPT09ICdMZWZ0JyB8fCBrZXkgPT09ICdCdG9tJyB8fCBrZXkgPT09ICdSZ2h0Jykge1xyXG5cdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgPyAnZG91YicgOiAnVW50Ric7XHJcblx0fSBlbHNlIGlmIChrZXkgPT09ICdWcnNuJykge1xyXG5cdFx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgPyAnbG9uZycgOiAnT2JqYyc7XHJcblx0fSBlbHNlIGlmIChrZXkgPT09ICdSZCAgJyB8fCBrZXkgPT09ICdHcm4gJyB8fCBrZXkgPT09ICdCbCAgJykge1xyXG5cdFx0cmV0dXJuIHJvb3QgPT09ICdhcnRkJyA/ICdsb25nJyA6ICdkb3ViJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ1RybmYnKSB7XHJcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyAnVmxMcycgOiAnT2JqYyc7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmaWVsZFRvVHlwZVtrZXldO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IGxlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdHJldHVybiByZWFkQXNjaWlTdHJpbmcocmVhZGVyLCBsZW5ndGggfHwgNCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBzdHJpbmcpIHtcclxuXHRpZiAodmFsdWUubGVuZ3RoID09PSA0ICYmIHZhbHVlICE9PSAnd2FycCcpIHtcclxuXHRcdC8vIHdyaXRlIGNsYXNzSWRcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCAwKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdmFsdWUpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQvLyB3cml0ZSBhc2NpaSBzdHJpbmdcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZS5sZW5ndGgpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZhbHVlLmNoYXJDb2RlQXQoaSkpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWREZXNjcmlwdG9yU3RydWN0dXJlKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3Qgb2JqZWN0OiBhbnkgPSB7fTtcclxuXHQvLyBvYmplY3QuX19zdHJ1Y3QgPVxyXG5cdHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdGNvbnN0IGl0ZW1zQ291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXNDb3VudDsgaSsrKSB7XHJcblx0XHRjb25zdCBrZXkgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhgPiAnJHtrZXl9JyAnJHt0eXBlfSdgKTtcclxuXHRcdGNvbnN0IGRhdGEgPSByZWFkT1NUeXBlKHJlYWRlciwgdHlwZSk7XHJcblx0XHQvLyBpZiAoIWdldFR5cGVCeUtleShrZXksIGRhdGEpKSBjb25zb2xlLmxvZyhgPiAnJHtrZXl9JyAnJHt0eXBlfSdgLCBkYXRhKTtcclxuXHRcdG9iamVjdFtrZXldID0gZGF0YTtcclxuXHR9XHJcblx0Ly8gY29uc29sZS5sb2coJy8vJywgc3RydWN0KTtcclxuXHRyZXR1cm4gb2JqZWN0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVEZXNjcmlwdG9yU3RydWN0dXJlKHdyaXRlcjogUHNkV3JpdGVyLCBuYW1lOiBzdHJpbmcsIGNsYXNzSWQ6IHN0cmluZywgdmFsdWU6IGFueSwgcm9vdDogc3RyaW5nKSB7XHJcblx0aWYgKGxvZ0Vycm9ycyAmJiAhY2xhc3NJZCkgY29uc29sZS5sb2coJ01pc3NpbmcgY2xhc3NJZCBmb3I6ICcsIG5hbWUsIGNsYXNzSWQsIHZhbHVlKTtcclxuXHJcblx0Ly8gd3JpdGUgY2xhc3Mgc3RydWN0dXJlXHJcblx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBuYW1lKTtcclxuXHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgY2xhc3NJZCk7XHJcblxyXG5cdGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBrZXlzLmxlbmd0aCk7XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcclxuXHRcdGxldCB0eXBlID0gZ2V0VHlwZUJ5S2V5KGtleSwgdmFsdWVba2V5XSwgcm9vdCk7XHJcblx0XHRsZXQgZXh0VHlwZSA9IGZpZWxkVG9FeHRUeXBlW2tleV07XHJcblxyXG5cdFx0aWYgKChrZXkgPT09ICdTdHJ0JyB8fCBrZXkgPT09ICdCcmdoJykgJiYgJ0ggICAnIGluIHZhbHVlKSB7XHJcblx0XHRcdHR5cGUgPSAnZG91Yic7XHJcblx0XHR9IGVsc2UgaWYgKGNoYW5uZWxzLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcclxuXHRcdFx0dHlwZSA9IChjbGFzc0lkID09PSAnUkdCQycgJiYgcm9vdCAhPT0gJ2FydGQnKSA/ICdkb3ViJyA6ICdsb25nJztcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAncHJvZmlsZScpIHtcclxuXHRcdFx0dHlwZSA9IGNsYXNzSWQgPT09ICdwcmludE91dHB1dCcgPyAnVEVYVCcgOiAndGR0YSc7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ3N0cm9rZVN0eWxlQ29udGVudCcpIHtcclxuXHRcdFx0aWYgKHZhbHVlW2tleV1bJ0NsciAnXSkge1xyXG5cdFx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ3NvbGlkQ29sb3JMYXllcicpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlW2tleV0uR3JhZCkge1xyXG5cdFx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ2dyYWRpZW50TGF5ZXInKTtcclxuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZVtrZXldLlB0cm4pIHtcclxuXHRcdFx0XHRleHRUeXBlID0gbWFrZVR5cGUoJycsICdwYXR0ZXJuTGF5ZXInKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRsb2dFcnJvcnMgJiYgY29uc29sZS5sb2coJ0ludmFsaWQgc3Ryb2tlU3R5bGVDb250ZW50IHZhbHVlJywgdmFsdWVba2V5XSk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnYm91bmRzJyAmJiByb290ID09PSAncXVpbHRXYXJwJykge1xyXG5cdFx0XHRleHRUeXBlID0gbWFrZVR5cGUoJycsICdjbGFzc0Zsb2F0UmVjdCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChleHRUeXBlICYmIGV4dFR5cGUuY2xhc3NJRCA9PT0gJ1JHQkMnKSB7XHJcblx0XHRcdGlmICgnSCAgICcgaW4gdmFsdWVba2V5XSkgZXh0VHlwZSA9IHsgY2xhc3NJRDogJ0hTQkMnLCBuYW1lOiAnJyB9O1xyXG5cdFx0XHQvLyBUT0RPOiBvdGhlciBjb2xvciBzcGFjZXNcclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwga2V5KTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdHlwZSB8fCAnbG9uZycpO1xyXG5cdFx0d3JpdGVPU1R5cGUod3JpdGVyLCB0eXBlIHx8ICdsb25nJywgdmFsdWVba2V5XSwga2V5LCBleHRUeXBlLCByb290KTtcclxuXHRcdGlmIChsb2dFcnJvcnMgJiYgIXR5cGUpIGNvbnNvbGUubG9nKGBNaXNzaW5nIGRlc2NyaXB0b3IgZmllbGQgdHlwZSBmb3I6ICcke2tleX0nIGluYCwgdmFsdWUpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZE9TVHlwZShyZWFkZXI6IFBzZFJlYWRlciwgdHlwZTogc3RyaW5nKSB7XHJcblx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRjYXNlICdvYmogJzogLy8gUmVmZXJlbmNlXHJcblx0XHRcdHJldHVybiByZWFkUmVmZXJlbmNlU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdPYmpjJzogLy8gRGVzY3JpcHRvclxyXG5cdFx0Y2FzZSAnR2xiTyc6IC8vIEdsb2JhbE9iamVjdCBzYW1lIGFzIERlc2NyaXB0b3JcclxuXHRcdFx0cmV0dXJuIHJlYWREZXNjcmlwdG9yU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdWbExzJzogeyAvLyBMaXN0XHJcblx0XHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBpdGVtczogYW55W10gPSBbXTtcclxuXHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCcgID4nLCB0eXBlKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRPU1R5cGUocmVhZGVyLCB0eXBlKSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBpdGVtcztcclxuXHRcdH1cclxuXHRcdGNhc2UgJ2RvdWInOiAvLyBEb3VibGVcclxuXHRcdFx0cmV0dXJuIHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRjYXNlICdVbnRGJzogeyAvLyBVbml0IGRvdWJsZVxyXG5cdFx0XHRjb25zdCB1bml0cyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0XHRpZiAoIXVuaXRzTWFwW3VuaXRzXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3VuaXRzfWApO1xyXG5cdFx0XHRyZXR1cm4geyB1bml0czogdW5pdHNNYXBbdW5pdHNdLCB2YWx1ZSB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnVW5GbCc6IHsgLy8gVW5pdCBmbG9hdFxyXG5cdFx0XHRjb25zdCB1bml0cyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSByZWFkRmxvYXQzMihyZWFkZXIpO1xyXG5cdFx0XHRpZiAoIXVuaXRzTWFwW3VuaXRzXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3VuaXRzfWApO1xyXG5cdFx0XHRyZXR1cm4geyB1bml0czogdW5pdHNNYXBbdW5pdHNdLCB2YWx1ZSB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnVEVYVCc6IC8vIFN0cmluZ1xyXG5cdFx0XHRyZXR1cm4gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdGNhc2UgJ2VudW0nOiB7IC8vIEVudW1lcmF0ZWRcclxuXHRcdFx0Y29uc3QgdHlwZSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRyZXR1cm4gYCR7dHlwZX0uJHt2YWx1ZX1gO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnbG9uZyc6IC8vIEludGVnZXJcclxuXHRcdFx0cmV0dXJuIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0Y2FzZSAnY29tcCc6IHsgLy8gTGFyZ2UgSW50ZWdlclxyXG5cdFx0XHRjb25zdCBsb3cgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGhpZ2ggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdHJldHVybiB7IGxvdywgaGlnaCB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnYm9vbCc6IC8vIEJvb2xlYW5cclxuXHRcdFx0cmV0dXJuICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRjYXNlICd0eXBlJzogLy8gQ2xhc3NcclxuXHRcdGNhc2UgJ0dsYkMnOiAvLyBDbGFzc1xyXG5cdFx0XHRyZXR1cm4gcmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdhbGlzJzogeyAvLyBBbGlhc1xyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmV0dXJuIHJlYWRBc2NpaVN0cmluZyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0XHR9XHJcblx0XHRjYXNlICd0ZHRhJzogeyAvLyBSYXcgRGF0YVxyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmV0dXJuIHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0XHR9XHJcblx0XHRjYXNlICdPYkFyJzogeyAvLyBPYmplY3QgYXJyYXlcclxuXHRcdFx0cmVhZEludDMyKHJlYWRlcik7IC8vIHZlcnNpb246IDE2XHJcblx0XHRcdHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7IC8vIG5hbWU6ICcnXHJcblx0XHRcdHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpOyAvLyAncmF0aW9uYWxQb2ludCdcclxuXHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGl0ZW1zOiBhbnlbXSA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdGNvbnN0IHR5cGUxID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7IC8vIHR5cGUgSHJ6biB8IFZydGNcclxuXHRcdFx0XHRyZWFkU2lnbmF0dXJlKHJlYWRlcik7IC8vIFVuRmxcclxuXHJcblx0XHRcdFx0cmVhZFNpZ25hdHVyZShyZWFkZXIpOyAvLyB1bml0cyA/ICcjUHhsJ1xyXG5cdFx0XHRcdGNvbnN0IHZhbHVlc0NvdW50ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmFsdWVzOiBudW1iZXJbXSA9IFtdO1xyXG5cdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgdmFsdWVzQ291bnQ7IGorKykge1xyXG5cdFx0XHRcdFx0dmFsdWVzLnB1c2gocmVhZEZsb2F0NjQocmVhZGVyKSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpdGVtcy5wdXNoKHsgdHlwZTogdHlwZTEsIHZhbHVlcyB9KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGl0ZW1zO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnUHRoICc6IHsgLy8gRmlsZSBwYXRoXHJcblx0XHRcdC8qY29uc3QgbGVuZ3RoID0qLyByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0Y29uc3Qgc2lnID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IHBhdGhTaXplID0qLyByZWFkSW50MzJMRShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBjaGFyc0NvdW50ID0gcmVhZEludDMyTEUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgcGF0aCA9IHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aChyZWFkZXIsIGNoYXJzQ291bnQpO1xyXG5cdFx0XHRyZXR1cm4geyBzaWcsIHBhdGggfTtcclxuXHRcdH1cclxuXHRcdGRlZmF1bHQ6XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIGRlc2NyaXB0b3IgT1NUeXBlOiAke3R5cGV9IGF0ICR7cmVhZGVyLm9mZnNldC50b1N0cmluZygxNil9YCk7XHJcblx0fVxyXG59XHJcblxyXG5jb25zdCBPYkFyVHlwZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkOyB9ID0ge1xyXG5cdG1lc2hQb2ludHM6ICdyYXRpb25hbFBvaW50JyxcclxuXHRxdWlsdFNsaWNlWDogJ1VudEYnLFxyXG5cdHF1aWx0U2xpY2VZOiAnVW50RicsXHJcbn07XHJcblxyXG5mdW5jdGlvbiB3cml0ZU9TVHlwZSh3cml0ZXI6IFBzZFdyaXRlciwgdHlwZTogc3RyaW5nLCB2YWx1ZTogYW55LCBrZXk6IHN0cmluZywgZXh0VHlwZTogTmFtZUNsYXNzSUQgfCB1bmRlZmluZWQsIHJvb3Q6IHN0cmluZykge1xyXG5cdHN3aXRjaCAodHlwZSkge1xyXG5cdFx0Y2FzZSAnb2JqICc6IC8vIFJlZmVyZW5jZVxyXG5cdFx0XHR3cml0ZVJlZmVyZW5jZVN0cnVjdHVyZSh3cml0ZXIsIGtleSwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ09iamMnOiAvLyBEZXNjcmlwdG9yXHJcblx0XHRjYXNlICdHbGJPJzogLy8gR2xvYmFsT2JqZWN0IHNhbWUgYXMgRGVzY3JpcHRvclxyXG5cdFx0XHRpZiAoIWV4dFR5cGUpIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBleHQgdHlwZSBmb3I6ICcke2tleX0nICgke0pTT04uc3RyaW5naWZ5KHZhbHVlKX0pYCk7XHJcblx0XHRcdHdyaXRlRGVzY3JpcHRvclN0cnVjdHVyZSh3cml0ZXIsIGV4dFR5cGUubmFtZSwgZXh0VHlwZS5jbGFzc0lELCB2YWx1ZSwgcm9vdCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnVmxMcyc6IC8vIExpc3RcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlLmxlbmd0aCk7XHJcblxyXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0Y29uc3QgdHlwZSA9IGZpZWxkVG9BcnJheVR5cGVba2V5XTtcclxuXHRcdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHR5cGUgfHwgJ2xvbmcnKTtcclxuXHRcdFx0XHR3cml0ZU9TVHlwZSh3cml0ZXIsIHR5cGUgfHwgJ2xvbmcnLCB2YWx1ZVtpXSwgJycsIGZpZWxkVG9BcnJheUV4dFR5cGVba2V5XSwgcm9vdCk7XHJcblx0XHRcdFx0aWYgKGxvZ0Vycm9ycyAmJiAhdHlwZSkgY29uc29sZS5sb2coYE1pc3NpbmcgZGVzY3JpcHRvciBhcnJheSB0eXBlIGZvcjogJyR7a2V5fScgaW5gLCB2YWx1ZSk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHRjYXNlICdkb3ViJzogLy8gRG91YmxlXHJcblx0XHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHZhbHVlKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHRjYXNlICdVbnRGJzogLy8gVW5pdCBkb3VibGVcclxuXHRcdFx0aWYgKCF1bml0c01hcFJldlt2YWx1ZS51bml0c10pIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt2YWx1ZS51bml0c30gaW4gJHtrZXl9YCk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKTtcclxuXHRcdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdmFsdWUudmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1VuRmwnOiAvLyBVbml0IGZsb2F0XHJcblx0XHRcdGlmICghdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7dmFsdWUudW5pdHN9IGluICR7a2V5fWApO1xyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHVuaXRzTWFwUmV2W3ZhbHVlLnVuaXRzXSk7XHJcblx0XHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHZhbHVlLnZhbHVlKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHRjYXNlICdURVhUJzogLy8gU3RyaW5nXHJcblx0XHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ2VudW0nOiB7IC8vIEVudW1lcmF0ZWRcclxuXHRcdFx0Y29uc3QgW190eXBlLCB2YWxdID0gdmFsdWUuc3BsaXQoJy4nKTtcclxuXHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIF90eXBlKTtcclxuXHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIHZhbCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnbG9uZyc6IC8vIEludGVnZXJcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHQvLyBjYXNlICdjb21wJzogLy8gTGFyZ2UgSW50ZWdlclxyXG5cdFx0Ly8gXHR3cml0ZUxhcmdlSW50ZWdlcihyZWFkZXIpO1xyXG5cdFx0Y2FzZSAnYm9vbCc6IC8vIEJvb2xlYW5cclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZhbHVlID8gMSA6IDApO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdC8vIGNhc2UgJ3R5cGUnOiAvLyBDbGFzc1xyXG5cdFx0Ly8gY2FzZSAnR2xiQyc6IC8vIENsYXNzXHJcblx0XHQvLyBcdHdyaXRlQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdC8vIGNhc2UgJ2FsaXMnOiAvLyBBbGlhc1xyXG5cdFx0Ly8gXHR3cml0ZUFsaWFzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICd0ZHRhJzogLy8gUmF3IERhdGFcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlLmJ5dGVMZW5ndGgpO1xyXG5cdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ09iQXInOiB7IC8vIE9iamVjdCBhcnJheVxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgMTYpOyAvLyB2ZXJzaW9uXHJcblx0XHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgJycpOyAvLyBuYW1lXHJcblx0XHRcdGNvbnN0IHR5cGUgPSBPYkFyVHlwZXNba2V5XTtcclxuXHRcdFx0aWYgKCF0eXBlKSB0aHJvdyBuZXcgRXJyb3IoYE5vdCBpbXBsZW1lbnRlZCBPYkFyVHlwZSBmb3I6ICR7a2V5fWApO1xyXG5cdFx0XHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgdHlwZSk7XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZS5sZW5ndGgpO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCB2YWx1ZVtpXS50eXBlKTsgLy8gSHJ6biB8IFZydGNcclxuXHRcdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdVbkZsJyk7XHJcblx0XHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnI1B4bCcpO1xyXG5cdFx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZVtpXS52YWx1ZXMubGVuZ3RoKTtcclxuXHJcblx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPCB2YWx1ZVtpXS52YWx1ZXMubGVuZ3RoOyBqKyspIHtcclxuXHRcdFx0XHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHZhbHVlW2ldLnZhbHVlc1tqXSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Ly8gY2FzZSAnUHRoICc6IC8vIEZpbGUgcGF0aFxyXG5cdFx0Ly8gXHR3cml0ZUZpbGVQYXRoKHJlYWRlcik7XHJcblx0XHRkZWZhdWx0OlxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vdCBpbXBsZW1lbnRlZCBkZXNjcmlwdG9yIE9TVHlwZTogJHt0eXBlfWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZFJlZmVyZW5jZVN0cnVjdHVyZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IGl0ZW1zQ291bnQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBpdGVtczogYW55W10gPSBbXTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtc0NvdW50OyBpKyspIHtcclxuXHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdGNhc2UgJ3Byb3AnOiB7IC8vIFByb3BlcnR5XHJcblx0XHRcdFx0cmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qga2V5SUQgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKGtleUlEKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdDbHNzJzogLy8gQ2xhc3NcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnRW5tcic6IHsgLy8gRW51bWVyYXRlZCBSZWZlcmVuY2VcclxuXHRcdFx0XHRyZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB0eXBlSUQgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2goYCR7dHlwZUlEfS4ke3ZhbHVlfWApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ3JlbGUnOiB7IC8vIE9mZnNldFxyXG5cdFx0XHRcdC8vIGNvbnN0IHsgbmFtZSwgY2xhc3NJRCB9ID1cclxuXHRcdFx0XHRyZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRVaW50MzIocmVhZGVyKSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnSWRudCc6IC8vIElkZW50aWZpZXJcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRJbnQzMihyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnaW5keCc6IC8vIEluZGV4XHJcblx0XHRcdFx0aXRlbXMucHVzaChyZWFkSW50MzIocmVhZGVyKSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ25hbWUnOiB7IC8vIE5hbWVcclxuXHRcdFx0XHRyZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcikpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGRlc2NyaXB0b3IgcmVmZXJlbmNlIHR5cGU6ICR7dHlwZX1gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBpdGVtcztcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVSZWZlcmVuY2VTdHJ1Y3R1cmUod3JpdGVyOiBQc2RXcml0ZXIsIF9rZXk6IHN0cmluZywgaXRlbXM6IGFueVtdKSB7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIGl0ZW1zLmxlbmd0aCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXMubGVuZ3RoOyBpKyspIHtcclxuXHRcdGNvbnN0IHZhbHVlID0gaXRlbXNbaV07XHJcblx0XHRsZXQgdHlwZSA9ICd1bmtub3duJztcclxuXHJcblx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xyXG5cdFx0XHRpZiAoL15bYS16XStcXC5bYS16XSskL2kudGVzdCh2YWx1ZSkpIHtcclxuXHRcdFx0XHR0eXBlID0gJ0VubXInO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHR5cGUgPSAnbmFtZSc7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHR5cGUpO1xyXG5cclxuXHRcdHN3aXRjaCAodHlwZSkge1xyXG5cdFx0XHQvLyBjYXNlICdwcm9wJzogLy8gUHJvcGVydHlcclxuXHRcdFx0Ly8gY2FzZSAnQ2xzcyc6IC8vIENsYXNzXHJcblx0XHRcdGNhc2UgJ0VubXInOiB7IC8vIEVudW1lcmF0ZWQgUmVmZXJlbmNlXHJcblx0XHRcdFx0Y29uc3QgW3R5cGVJRCwgZW51bVZhbHVlXSA9IHZhbHVlLnNwbGl0KCcuJyk7XHJcblx0XHRcdFx0d3JpdGVDbGFzc1N0cnVjdHVyZSh3cml0ZXIsICdcXDAnLCB0eXBlSUQpO1xyXG5cdFx0XHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCB0eXBlSUQpO1xyXG5cdFx0XHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCBlbnVtVmFsdWUpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIGNhc2UgJ3JlbGUnOiAvLyBPZmZzZXRcclxuXHRcdFx0Ly8gY2FzZSAnSWRudCc6IC8vIElkZW50aWZpZXJcclxuXHRcdFx0Ly8gY2FzZSAnaW5keCc6IC8vIEluZGV4XHJcblx0XHRcdGNhc2UgJ25hbWUnOiB7IC8vIE5hbWVcclxuXHRcdFx0XHR3cml0ZUNsYXNzU3RydWN0dXJlKHdyaXRlciwgJ1xcMCcsICdMeXIgJyk7XHJcblx0XHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlciwgdmFsdWUgKyAnXFwwJyk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZGVzY3JpcHRvciByZWZlcmVuY2UgdHlwZTogJHt0eXBlfWApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGl0ZW1zO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCBuYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRjb25zdCBjbGFzc0lEID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7XHJcblx0Ly8gY29uc29sZS5sb2coeyBuYW1lLCBjbGFzc0lEIH0pO1xyXG5cdHJldHVybiB7IG5hbWUsIGNsYXNzSUQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVDbGFzc1N0cnVjdHVyZSh3cml0ZXI6IFBzZFdyaXRlciwgbmFtZTogc3RyaW5nLCBjbGFzc0lEOiBzdHJpbmcpIHtcclxuXHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCBuYW1lKTtcclxuXHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgY2xhc3NJRCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uICE9PSAxNikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGRlc2NyaXB0b3IgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cdGNvbnN0IGRlc2MgPSByZWFkRGVzY3JpcHRvclN0cnVjdHVyZShyZWFkZXIpO1xyXG5cdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdHJldHVybiBkZXNjO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXI6IFBzZFdyaXRlciwgbmFtZTogc3RyaW5nLCBjbGFzc0lEOiBzdHJpbmcsIGRlc2NyaXB0b3I6IGFueSwgcm9vdCA9ICcnKSB7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCAxNik7IC8vIHZlcnNpb25cclxuXHR3cml0ZURlc2NyaXB0b3JTdHJ1Y3R1cmUod3JpdGVyLCBuYW1lLCBjbGFzc0lELCBkZXNjcmlwdG9yLCByb290KTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRGVzY3JpcHRvclVuaXRzID0gJ0FuZ2xlJyB8ICdEZW5zaXR5JyB8ICdEaXN0YW5jZScgfCAnTm9uZScgfCAnUGVyY2VudCcgfCAnUGl4ZWxzJyB8XHJcblx0J01pbGxpbWV0ZXJzJyB8ICdQb2ludHMnIHwgJ1BpY2FzJyB8ICdJbmNoZXMnIHwgJ0NlbnRpbWV0ZXJzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzY3JpcHRvclVuaXRzVmFsdWUge1xyXG5cdHVuaXRzOiBEZXNjcmlwdG9yVW5pdHM7XHJcblx0dmFsdWU6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRGVzY3JpcHRvckNvbG9yID0ge1xyXG5cdCdSZCAgJzogbnVtYmVyO1xyXG5cdCdHcm4gJzogbnVtYmVyO1xyXG5cdCdCbCAgJzogbnVtYmVyO1xyXG59IHwge1xyXG5cdCdIICAgJzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0U3RydDogbnVtYmVyO1xyXG5cdEJyZ2g6IG51bWJlcjtcclxufSB8IHtcclxuXHQnQ3luICc6IG51bWJlcjtcclxuXHRNZ250OiBudW1iZXI7XHJcblx0J1lsdyAnOiBudW1iZXI7XHJcblx0QmxjazogbnVtYmVyO1xyXG59IHwge1xyXG5cdCdHcnkgJzogbnVtYmVyO1xyXG59IHwge1xyXG5cdExtbmM6IG51bWJlcjtcclxuXHQnQSAgICc6IG51bWJlcjtcclxuXHQnQiAgICc6IG51bWJlcjtcclxufTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzY2lwdG9yUGF0dGVybiB7XHJcblx0J05tICAnOiBzdHJpbmc7XHJcblx0SWRudDogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBEZXNjaXB0b3JHcmFkaWVudCA9IHtcclxuXHQnTm0gICc6IHN0cmluZztcclxuXHRHcmRGOiAnR3JkRi5Dc3RTJztcclxuXHRJbnRyOiBudW1iZXI7XHJcblx0Q2xyczoge1xyXG5cdFx0J0NsciAnOiBEZXNjcmlwdG9yQ29sb3I7XHJcblx0XHRUeXBlOiAnQ2xyeS5Vc3JTJztcclxuXHRcdExjdG46IG51bWJlcjtcclxuXHRcdE1kcG46IG51bWJlcjtcclxuXHR9W107XHJcblx0VHJuczoge1xyXG5cdFx0T3BjdDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRMY3RuOiBudW1iZXI7XHJcblx0XHRNZHBuOiBudW1iZXI7XHJcblx0fVtdO1xyXG59IHwge1xyXG5cdEdyZEY6ICdHcmRGLkNsTnMnO1xyXG5cdFNtdGg6IG51bWJlcjtcclxuXHQnTm0gICc6IHN0cmluZztcclxuXHRDbHJTOiBzdHJpbmc7XHJcblx0Um5kUzogbnVtYmVyO1xyXG5cdFZjdEM/OiBib29sZWFuO1xyXG5cdFNoVHI/OiBib29sZWFuO1xyXG5cdCdNbm0gJzogbnVtYmVyW107XHJcblx0J014bSAnOiBudW1iZXJbXTtcclxufTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzY3JpcHRvckNvbG9yQ29udGVudCB7XHJcblx0J0NsciAnOiBEZXNjcmlwdG9yQ29sb3I7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzY3JpcHRvckdyYWRpZW50Q29udGVudCB7XHJcblx0R3JhZDogRGVzY2lwdG9yR3JhZGllbnQ7XHJcblx0VHlwZTogc3RyaW5nO1xyXG5cdER0aHI/OiBib29sZWFuO1xyXG5cdFJ2cnM/OiBib29sZWFuO1xyXG5cdEFuZ2w/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHQnU2NsICc/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRBbGduPzogYm9vbGVhbjtcclxuXHRPZnN0PzogeyBIcnpuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTsgVnJ0YzogRGVzY3JpcHRvclVuaXRzVmFsdWU7IH07XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVzY3JpcHRvclBhdHRlcm5Db250ZW50IHtcclxuXHRQdHJuOiBEZXNjaXB0b3JQYXR0ZXJuO1xyXG5cdExua2Q/OiBib29sZWFuO1xyXG5cdHBoYXNlPzogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRGVzY3JpcHRvclZlY3RvckNvbnRlbnQgPSBEZXNjcmlwdG9yQ29sb3JDb250ZW50IHwgRGVzY3JpcHRvckdyYWRpZW50Q29udGVudCB8IERlc2NyaXB0b3JQYXR0ZXJuQ29udGVudDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3Ryb2tlRGVzY3JpcHRvciB7XHJcblx0c3Ryb2tlU3R5bGVWZXJzaW9uOiBudW1iZXI7XHJcblx0c3Ryb2tlRW5hYmxlZDogYm9vbGVhbjtcclxuXHRmaWxsRW5hYmxlZDogYm9vbGVhbjtcclxuXHRzdHJva2VTdHlsZUxpbmVXaWR0aDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0c3Ryb2tlU3R5bGVMaW5lRGFzaE9mZnNldDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0c3Ryb2tlU3R5bGVNaXRlckxpbWl0OiBudW1iZXI7XHJcblx0c3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZTogc3RyaW5nO1xyXG5cdHN0cm9rZVN0eWxlTGluZUpvaW5UeXBlOiBzdHJpbmc7XHJcblx0c3Ryb2tlU3R5bGVMaW5lQWxpZ25tZW50OiBzdHJpbmc7XHJcblx0c3Ryb2tlU3R5bGVTY2FsZUxvY2s6IGJvb2xlYW47XHJcblx0c3Ryb2tlU3R5bGVTdHJva2VBZGp1c3Q6IGJvb2xlYW47XHJcblx0c3Ryb2tlU3R5bGVMaW5lRGFzaFNldDogRGVzY3JpcHRvclVuaXRzVmFsdWVbXTtcclxuXHRzdHJva2VTdHlsZUJsZW5kTW9kZTogc3RyaW5nO1xyXG5cdHN0cm9rZVN0eWxlT3BhY2l0eTogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0c3Ryb2tlU3R5bGVDb250ZW50OiBEZXNjcmlwdG9yVmVjdG9yQ29udGVudDtcclxuXHRzdHJva2VTdHlsZVJlc29sdXRpb246IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBUZXh0RGVzY3JpcHRvciB7XHJcblx0J1R4dCAnOiBzdHJpbmc7XHJcblx0dGV4dEdyaWRkaW5nOiBzdHJpbmc7XHJcblx0T3JudDogc3RyaW5nO1xyXG5cdEFudEE6IHN0cmluZztcclxuXHRUZXh0SW5kZXg6IG51bWJlcjtcclxuXHRFbmdpbmVEYXRhPzogVWludDhBcnJheTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBXYXJwRGVzY3JpcHRvciB7XHJcblx0d2FycFN0eWxlOiBzdHJpbmc7XHJcblx0d2FycFZhbHVlOiBudW1iZXI7XHJcblx0d2FycFBlcnNwZWN0aXZlOiBudW1iZXI7XHJcblx0d2FycFBlcnNwZWN0aXZlT3RoZXI6IG51bWJlcjtcclxuXHR3YXJwUm90YXRlOiBzdHJpbmc7XHJcblx0Ym91bmRzPzoge1xyXG5cdFx0J1RvcCAnOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdExlZnQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0QnRvbTogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRSZ2h0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHR9O1xyXG5cdHVPcmRlcjogbnVtYmVyO1xyXG5cdHZPcmRlcjogbnVtYmVyO1xyXG5cdGN1c3RvbUVudmVsb3BlV2FycD86IHtcclxuXHRcdG1lc2hQb2ludHM6IHtcclxuXHRcdFx0dHlwZTogJ0hyem4nIHwgJ1ZydGMnO1xyXG5cdFx0XHR2YWx1ZXM6IG51bWJlcltdO1xyXG5cdFx0fVtdO1xyXG5cdH07XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUXVpbHRXYXJwRGVzY3JpcHRvciBleHRlbmRzIFdhcnBEZXNjcmlwdG9yIHtcclxuXHRkZWZvcm1OdW1Sb3dzOiBudW1iZXI7XHJcblx0ZGVmb3JtTnVtQ29sczogbnVtYmVyO1xyXG5cdGN1c3RvbUVudmVsb3BlV2FycDoge1xyXG5cdFx0cXVpbHRTbGljZVg6IHtcclxuXHRcdFx0dHlwZTogJ3F1aWx0U2xpY2VYJztcclxuXHRcdFx0dmFsdWVzOiBudW1iZXJbXTtcclxuXHRcdH1bXTtcclxuXHRcdHF1aWx0U2xpY2VZOiB7XHJcblx0XHRcdHR5cGU6ICdxdWlsdFNsaWNlWSc7XHJcblx0XHRcdHZhbHVlczogbnVtYmVyW107XHJcblx0XHR9W107XHJcblx0XHRtZXNoUG9pbnRzOiB7XHJcblx0XHRcdHR5cGU6ICdIcnpuJyB8ICdWcnRjJztcclxuXHRcdFx0dmFsdWVzOiBudW1iZXJbXTtcclxuXHRcdH1bXTtcclxuXHR9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBbmdsZSh4OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSkge1xyXG5cdGlmICh4ID09PSB1bmRlZmluZWQpIHJldHVybiAwO1xyXG5cdGlmICh4LnVuaXRzICE9PSAnQW5nbGUnKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7eC51bml0c31gKTtcclxuXHRyZXR1cm4geC52YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUGVyY2VudCh4OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICh4ID09PSB1bmRlZmluZWQpIHJldHVybiAxO1xyXG5cdGlmICh4LnVuaXRzICE9PSAnUGVyY2VudCcpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt4LnVuaXRzfWApO1xyXG5cdHJldHVybiB4LnZhbHVlIC8gMTAwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQZXJjZW50T3JBbmdsZSh4OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICh4ID09PSB1bmRlZmluZWQpIHJldHVybiAxO1xyXG5cdGlmICh4LnVuaXRzID09PSAnUGVyY2VudCcpIHJldHVybiB4LnZhbHVlIC8gMTAwO1xyXG5cdGlmICh4LnVuaXRzID09PSAnQW5nbGUnKSByZXR1cm4geC52YWx1ZSAvIDM2MDtcclxuXHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7eC51bml0c31gKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVW5pdHMoeyB1bml0cywgdmFsdWUgfTogRGVzY3JpcHRvclVuaXRzVmFsdWUpOiBVbml0c1ZhbHVlIHtcclxuXHRpZiAoXHJcblx0XHR1bml0cyAhPT0gJ1BpeGVscycgJiYgdW5pdHMgIT09ICdNaWxsaW1ldGVycycgJiYgdW5pdHMgIT09ICdQb2ludHMnICYmIHVuaXRzICE9PSAnTm9uZScgJiZcclxuXHRcdHVuaXRzICE9PSAnUGljYXMnICYmIHVuaXRzICE9PSAnSW5jaGVzJyAmJiB1bml0cyAhPT0gJ0NlbnRpbWV0ZXJzJyAmJiB1bml0cyAhPT0gJ0RlbnNpdHknXHJcblx0KSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7SlNPTi5zdHJpbmdpZnkoeyB1bml0cywgdmFsdWUgfSl9YCk7XHJcblx0fVxyXG5cdHJldHVybiB7IHZhbHVlLCB1bml0cyB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VVbml0c09yTnVtYmVyKHZhbHVlOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB8IG51bWJlciwgdW5pdHM6IFVuaXRzID0gJ1BpeGVscycpOiBVbml0c1ZhbHVlIHtcclxuXHRpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykgcmV0dXJuIHsgdmFsdWUsIHVuaXRzIH07XHJcblx0cmV0dXJuIHBhcnNlVW5pdHModmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VVbml0c1RvTnVtYmVyKHsgdW5pdHMsIHZhbHVlIH06IERlc2NyaXB0b3JVbml0c1ZhbHVlLCBleHBlY3RlZFVuaXRzOiBzdHJpbmcpOiBudW1iZXIge1xyXG5cdGlmICh1bml0cyAhPT0gZXhwZWN0ZWRVbml0cykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke0pTT04uc3RyaW5naWZ5KHsgdW5pdHMsIHZhbHVlIH0pfWApO1xyXG5cdHJldHVybiB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVuaXRzQW5nbGUodmFsdWU6IG51bWJlciB8IHVuZGVmaW5lZCk6IERlc2NyaXB0b3JVbml0c1ZhbHVlIHtcclxuXHRyZXR1cm4geyB1bml0czogJ0FuZ2xlJywgdmFsdWU6IHZhbHVlIHx8IDAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVuaXRzUGVyY2VudCh2YWx1ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogRGVzY3JpcHRvclVuaXRzVmFsdWUge1xyXG5cdHJldHVybiB7IHVuaXRzOiAnUGVyY2VudCcsIHZhbHVlOiBNYXRoLnJvdW5kKCh2YWx1ZSB8fCAwKSAqIDEwMCkgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVuaXRzVmFsdWUoeDogVW5pdHNWYWx1ZSB8IHVuZGVmaW5lZCwga2V5OiBzdHJpbmcpOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB7XHJcblx0aWYgKHggPT0gbnVsbCkgcmV0dXJuIHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogMCB9O1xyXG5cclxuXHRpZiAodHlwZW9mIHggIT09ICdvYmplY3QnKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlOiAke0pTT04uc3RyaW5naWZ5KHgpfSAoa2V5OiAke2tleX0pIChzaG91bGQgaGF2ZSB2YWx1ZSBhbmQgdW5pdHMpYCk7XHJcblxyXG5cdGNvbnN0IHsgdW5pdHMsIHZhbHVlIH0gPSB4O1xyXG5cclxuXHRpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJylcclxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZSBpbiAke0pTT04uc3RyaW5naWZ5KHgpfSAoa2V5OiAke2tleX0pYCk7XHJcblxyXG5cdGlmIChcclxuXHRcdHVuaXRzICE9PSAnUGl4ZWxzJyAmJiB1bml0cyAhPT0gJ01pbGxpbWV0ZXJzJyAmJiB1bml0cyAhPT0gJ1BvaW50cycgJiYgdW5pdHMgIT09ICdOb25lJyAmJlxyXG5cdFx0dW5pdHMgIT09ICdQaWNhcycgJiYgdW5pdHMgIT09ICdJbmNoZXMnICYmIHVuaXRzICE9PSAnQ2VudGltZXRlcnMnICYmIHVuaXRzICE9PSAnRGVuc2l0eSdcclxuXHQpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0cyBpbiAke0pTT04uc3RyaW5naWZ5KHgpfSAoa2V5OiAke2tleX0pYCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4geyB1bml0cywgdmFsdWUgfTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHRleHRHcmlkZGluZyA9IGNyZWF0ZUVudW08VGV4dEdyaWRkaW5nPigndGV4dEdyaWRkaW5nJywgJ25vbmUnLCB7XHJcblx0bm9uZTogJ05vbmUnLFxyXG5cdHJvdW5kOiAnUm5kICcsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IE9ybnQgPSBjcmVhdGVFbnVtPE9yaWVudGF0aW9uPignT3JudCcsICdob3Jpem9udGFsJywge1xyXG5cdGhvcml6b250YWw6ICdIcnpuJyxcclxuXHR2ZXJ0aWNhbDogJ1ZydGMnLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBBbm50ID0gY3JlYXRlRW51bTxBbnRpQWxpYXM+KCdBbm50JywgJ3NoYXJwJywge1xyXG5cdG5vbmU6ICdBbm5vJyxcclxuXHRzaGFycDogJ2FudGlBbGlhc1NoYXJwJyxcclxuXHRjcmlzcDogJ0FuQ3InLFxyXG5cdHN0cm9uZzogJ0FuU3QnLFxyXG5cdHNtb290aDogJ0FuU20nLFxyXG5cdHBsYXRmb3JtOiAnYW50aUFsaWFzUGxhdGZvcm1HcmF5JyxcclxuXHRwbGF0Zm9ybUxDRDogJ2FudGlBbGlhc1BsYXRmb3JtTENEJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3Qgd2FycFN0eWxlID0gY3JlYXRlRW51bTxXYXJwU3R5bGU+KCd3YXJwU3R5bGUnLCAnbm9uZScsIHtcclxuXHRub25lOiAnd2FycE5vbmUnLFxyXG5cdGFyYzogJ3dhcnBBcmMnLFxyXG5cdGFyY0xvd2VyOiAnd2FycEFyY0xvd2VyJyxcclxuXHRhcmNVcHBlcjogJ3dhcnBBcmNVcHBlcicsXHJcblx0YXJjaDogJ3dhcnBBcmNoJyxcclxuXHRidWxnZTogJ3dhcnBCdWxnZScsXHJcblx0c2hlbGxMb3dlcjogJ3dhcnBTaGVsbExvd2VyJyxcclxuXHRzaGVsbFVwcGVyOiAnd2FycFNoZWxsVXBwZXInLFxyXG5cdGZsYWc6ICd3YXJwRmxhZycsXHJcblx0d2F2ZTogJ3dhcnBXYXZlJyxcclxuXHRmaXNoOiAnd2FycEZpc2gnLFxyXG5cdHJpc2U6ICd3YXJwUmlzZScsXHJcblx0ZmlzaGV5ZTogJ3dhcnBGaXNoZXllJyxcclxuXHRpbmZsYXRlOiAnd2FycEluZmxhdGUnLFxyXG5cdHNxdWVlemU6ICd3YXJwU3F1ZWV6ZScsXHJcblx0dHdpc3Q6ICd3YXJwVHdpc3QnLFxyXG5cdGN1c3RvbTogJ3dhcnBDdXN0b20nLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBCbG5NID0gY3JlYXRlRW51bTxCbGVuZE1vZGU+KCdCbG5NJywgJ25vcm1hbCcsIHtcclxuXHQnbm9ybWFsJzogJ05ybWwnLFxyXG5cdCdkaXNzb2x2ZSc6ICdEc2x2JyxcclxuXHQnZGFya2VuJzogJ0Rya24nLFxyXG5cdCdtdWx0aXBseSc6ICdNbHRwJyxcclxuXHQnY29sb3IgYnVybic6ICdDQnJuJyxcclxuXHQnbGluZWFyIGJ1cm4nOiAnbGluZWFyQnVybicsXHJcblx0J2RhcmtlciBjb2xvcic6ICdkYXJrZXJDb2xvcicsXHJcblx0J2xpZ2h0ZW4nOiAnTGdobicsXHJcblx0J3NjcmVlbic6ICdTY3JuJyxcclxuXHQnY29sb3IgZG9kZ2UnOiAnQ0RkZycsXHJcblx0J2xpbmVhciBkb2RnZSc6ICdsaW5lYXJEb2RnZScsXHJcblx0J2xpZ2h0ZXIgY29sb3InOiAnbGlnaHRlckNvbG9yJyxcclxuXHQnb3ZlcmxheSc6ICdPdnJsJyxcclxuXHQnc29mdCBsaWdodCc6ICdTZnRMJyxcclxuXHQnaGFyZCBsaWdodCc6ICdIcmRMJyxcclxuXHQndml2aWQgbGlnaHQnOiAndml2aWRMaWdodCcsXHJcblx0J2xpbmVhciBsaWdodCc6ICdsaW5lYXJMaWdodCcsXHJcblx0J3BpbiBsaWdodCc6ICdwaW5MaWdodCcsXHJcblx0J2hhcmQgbWl4JzogJ2hhcmRNaXgnLFxyXG5cdCdkaWZmZXJlbmNlJzogJ0Rmcm4nLFxyXG5cdCdleGNsdXNpb24nOiAnWGNsdScsXHJcblx0J3N1YnRyYWN0JzogJ2JsZW5kU3VidHJhY3Rpb24nLFxyXG5cdCdkaXZpZGUnOiAnYmxlbmREaXZpZGUnLFxyXG5cdCdodWUnOiAnSCAgICcsXHJcblx0J3NhdHVyYXRpb24nOiAnU3RydCcsXHJcblx0J2NvbG9yJzogJ0NsciAnLFxyXG5cdCdsdW1pbm9zaXR5JzogJ0xtbnMnLFxyXG5cdC8vIHVzZWQgaW4gQUJSXHJcblx0J2xpbmVhciBoZWlnaHQnOiAnbGluZWFySGVpZ2h0JyxcclxuXHQnaGVpZ2h0JzogJ0hnaHQnLFxyXG5cdCdzdWJ0cmFjdGlvbic6ICdTYnRyJywgLy8gMm5kIHZlcnNpb24gb2Ygc3VidHJhY3QgP1xyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBCRVNsID0gY3JlYXRlRW51bTxCZXZlbFN0eWxlPignQkVTbCcsICdpbm5lciBiZXZlbCcsIHtcclxuXHQnaW5uZXIgYmV2ZWwnOiAnSW5yQicsXHJcblx0J291dGVyIGJldmVsJzogJ090ckInLFxyXG5cdCdlbWJvc3MnOiAnRW1icycsXHJcblx0J3BpbGxvdyBlbWJvc3MnOiAnUGxFYicsXHJcblx0J3N0cm9rZSBlbWJvc3MnOiAnc3Ryb2tlRW1ib3NzJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgYnZsVCA9IGNyZWF0ZUVudW08QmV2ZWxUZWNobmlxdWU+KCdidmxUJywgJ3Ntb290aCcsIHtcclxuXHQnc21vb3RoJzogJ1NmQkwnLFxyXG5cdCdjaGlzZWwgaGFyZCc6ICdQckJMJyxcclxuXHQnY2hpc2VsIHNvZnQnOiAnU2xtdCcsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEJFU3MgPSBjcmVhdGVFbnVtPEJldmVsRGlyZWN0aW9uPignQkVTcycsICd1cCcsIHtcclxuXHR1cDogJ0luICAnLFxyXG5cdGRvd246ICdPdXQgJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQkVURSA9IGNyZWF0ZUVudW08R2xvd1RlY2huaXF1ZT4oJ0JFVEUnLCAnc29mdGVyJywge1xyXG5cdHNvZnRlcjogJ1NmQkwnLFxyXG5cdHByZWNpc2U6ICdQckJMJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgSUdTciA9IGNyZWF0ZUVudW08R2xvd1NvdXJjZT4oJ0lHU3InLCAnZWRnZScsIHtcclxuXHRlZGdlOiAnU3JjRScsXHJcblx0Y2VudGVyOiAnU3JjQycsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEdyZFQgPSBjcmVhdGVFbnVtPEdyYWRpZW50U3R5bGU+KCdHcmRUJywgJ2xpbmVhcicsIHtcclxuXHRsaW5lYXI6ICdMbnIgJyxcclxuXHRyYWRpYWw6ICdSZGwgJyxcclxuXHRhbmdsZTogJ0FuZ2wnLFxyXG5cdHJlZmxlY3RlZDogJ1JmbGMnLFxyXG5cdGRpYW1vbmQ6ICdEbW5kJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQ2xyUyA9IGNyZWF0ZUVudW08J3JnYicgfCAnaHNiJyB8ICdsYWInPignQ2xyUycsICdyZ2InLCB7XHJcblx0cmdiOiAnUkdCQycsXHJcblx0aHNiOiAnSFNCbCcsXHJcblx0bGFiOiAnTGJDbCcsXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEZTdGwgPSBjcmVhdGVFbnVtPCdpbnNpZGUnIHwgJ2NlbnRlcicgfCAnb3V0c2lkZSc+KCdGU3RsJywgJ291dHNpZGUnLCB7XHJcblx0b3V0c2lkZTogJ091dEYnLFxyXG5cdGNlbnRlcjogJ0N0ckYnLFxyXG5cdGluc2lkZTogJ0luc0YnXHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IEZyRmwgPSBjcmVhdGVFbnVtPCdjb2xvcicgfCAnZ3JhZGllbnQnIHwgJ3BhdHRlcm4nPignRnJGbCcsICdjb2xvcicsIHtcclxuXHRjb2xvcjogJ1NDbHInLFxyXG5cdGdyYWRpZW50OiAnR3JGbCcsXHJcblx0cGF0dGVybjogJ1B0cm4nLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBzdHJva2VTdHlsZUxpbmVDYXBUeXBlID0gY3JlYXRlRW51bTxMaW5lQ2FwVHlwZT4oJ3N0cm9rZVN0eWxlTGluZUNhcFR5cGUnLCAnYnV0dCcsIHtcclxuXHRidXR0OiAnc3Ryb2tlU3R5bGVCdXR0Q2FwJyxcclxuXHRyb3VuZDogJ3N0cm9rZVN0eWxlUm91bmRDYXAnLFxyXG5cdHNxdWFyZTogJ3N0cm9rZVN0eWxlU3F1YXJlQ2FwJyxcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3Qgc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUgPSBjcmVhdGVFbnVtPExpbmVKb2luVHlwZT4oJ3N0cm9rZVN0eWxlTGluZUpvaW5UeXBlJywgJ21pdGVyJywge1xyXG5cdG1pdGVyOiAnc3Ryb2tlU3R5bGVNaXRlckpvaW4nLFxyXG5cdHJvdW5kOiAnc3Ryb2tlU3R5bGVSb3VuZEpvaW4nLFxyXG5cdGJldmVsOiAnc3Ryb2tlU3R5bGVCZXZlbEpvaW4nLFxyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQgPSBjcmVhdGVFbnVtPExpbmVBbGlnbm1lbnQ+KCdzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQnLCAnaW5zaWRlJywge1xyXG5cdGluc2lkZTogJ3N0cm9rZVN0eWxlQWxpZ25JbnNpZGUnLFxyXG5cdGNlbnRlcjogJ3N0cm9rZVN0eWxlQWxpZ25DZW50ZXInLFxyXG5cdG91dHNpZGU6ICdzdHJva2VTdHlsZUFsaWduT3V0c2lkZScsXHJcbn0pO1xyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
