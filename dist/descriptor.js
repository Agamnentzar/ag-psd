"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeVersionAndDescriptor = exports.readVersionAndDescriptor = exports.writeDescriptorStructure = exports.readDescriptorStructure = exports.readAsciiStringOrClassId = exports.setLogErrors = void 0;
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
};
var fieldToArrayExtType = {
    'Crv ': makeType('', 'CrPt'),
    'Clrs': makeType('', 'Clrt'),
    'Trns': makeType('', 'TrnS'),
};
var typeToField = {
    'TEXT': [
        'Txt ', 'printerName', 'Nm  ', 'Idnt', 'blackAndWhitePresetFileName', 'LUT3DFileName',
        'presetFileName', 'curvesPresetFileName', 'mixerPresetFileName',
    ],
    'tdta': ['EngineData', 'LUT3DFileData'],
    'long': [
        'TextIndex', 'RndS', 'Mdpn', 'Smth', 'Lctn', 'strokeStyleVersion', 'LaID', 'Vrsn',
        'Brgh', 'Cntr', 'means', 'vibrance', 'Strt', 'bwPresetKind', 'presetKind',
        'curvesPresetKind', 'mixerPresetKind',
    ],
    'enum': [
        'textGridding', 'Ornt', 'warpStyle', 'warpRotate', 'Inte', 'Bltn', 'ClrS',
        'sdwM', 'hglM', 'bvlT', 'bvlS', 'bvlD', 'Md  ', 'Type', 'glwS', 'GrdF', 'GlwT',
        'strokeStyleLineCapType', 'strokeStyleLineJoinType', 'strokeStyleLineAlignment',
        'strokeStyleBlendMode', 'PntT', 'Styl', 'lookupType', 'LUTFormat', 'dataOrder',
        'tableOrder'
    ],
    'bool': [
        'PstS', 'printSixteenBit', 'masterFXSwitch', 'enab', 'uglg', 'antialiasGloss',
        'useShape', 'useTexture', 'masterFXSwitch', 'uglg', 'antialiasGloss', 'useShape',
        'useTexture', 'Algn', 'Rvrs', 'Dthr', 'Invr', 'VctC', 'ShTr', 'layerConceals',
        'strokeEnabled', 'fillEnabled', 'strokeStyleScaleLock', 'strokeStyleStrokeAdjust',
        'hardProof', 'MpBl', 'paperWhite', 'useLegacy', 'Auto', 'Lab ', 'useTint',
    ],
    'doub': [
        'warpValue', 'warpPerspective', 'warpPerspectiveOther', 'Intr',
        'strokeStyleMiterLimit', 'strokeStyleResolution', 'layerTime',
    ],
    'UntF': [
        'Scl ', 'sdwO', 'hglO', 'lagl', 'Lald', 'srgR', 'blur', 'Sftn', 'Opct', 'Dstn', 'Angl',
        'Ckmt', 'Nose', 'Inpr', 'ShdN', 'strokeStyleLineWidth', 'strokeStyleLineDashOffset',
        'strokeStyleOpacity', 'Sz  ', 'H   ',
    ],
    'VlLs': [
        'Crv ', 'Clrs', 'Mnm ', 'Mxm ', 'Trns', 'pathList', 'strokeStyleLineDashSet', 'FrLs',
        'LaSt',
    ],
};
var channels = [
    'Rd  ', 'Grn ', 'Bl  ', 'Yllw', 'Ylw ', 'Cyn ', 'Mgnt', 'Blck', 'Gry ', 'Lmnc', 'A   ', 'B   ',
];
var fieldToArrayType = {
    'Mnm ': 'long',
    'Mxm ': 'long',
    'FrLs': 'long',
    'strokeStyleLineDashSet': 'UntF',
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
    fieldToType[field] = 'Objc';
}
for (var _f = 0, _g = Object.keys(fieldToArrayExtType); _f < _g.length; _f++) {
    var field = _g[_f];
    fieldToArrayType[field] = 'Objc';
}
function getTypeByKey(key, value) {
    if (key === 'AntA') {
        return typeof value === 'string' ? 'enum' : 'bool';
    }
    else if (key === 'Hrzn' || key === 'Vrtc') {
        return typeof value === 'number' ? 'doub' : 'UntF';
    }
    else {
        return fieldToType[key];
    }
}
function readAsciiStringOrClassId(reader) {
    var length = psdReader_1.readInt32(reader);
    var result = length === 0 ? psdReader_1.readSignature(reader) : psdReader_1.readAsciiString(reader, length);
    return result;
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
    // const struct =
    readClassStructure(reader);
    // console.log(struct);
    var itemsCount = psdReader_1.readUint32(reader);
    var object = {};
    for (var i = 0; i < itemsCount; i++) {
        var key = readAsciiStringOrClassId(reader);
        var type = psdReader_1.readSignature(reader);
        // console.log('>', key, type);
        var data = readOSType(reader, type);
        object[key] = data;
    }
    // console.log('//', struct);
    return object;
}
exports.readDescriptorStructure = readDescriptorStructure;
function writeDescriptorStructure(writer, name, classId, value) {
    if (logErrors && !classId)
        console.log('Missing classId for: ', name, classId, value);
    // write class structure
    psdWriter_1.writeUnicodeStringWithPadding(writer, name);
    writeAsciiStringOrClassId(writer, classId);
    var keys = Object.keys(value);
    psdWriter_1.writeUint32(writer, keys.length);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var type = getTypeByKey(key, value[key]);
        var extType = fieldToExtType[key];
        if (channels.indexOf(key) !== -1) {
            type = classId === 'RGBC' ? 'doub' : 'long';
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
        writeAsciiStringOrClassId(writer, key);
        psdWriter_1.writeSignature(writer, type || 'long');
        writeOSType(writer, type || 'long', value[key], key, extType);
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
                // if (typeof items[items.length - 1] === 'object' && 'units' in items[items.length - 1])
                // 	console.log('[]', items[items.length - 1]);
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
        case 'ObAr': // Object array
            throw new Error('not implemented: ObAr');
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
function writeOSType(writer, type, value, key, extType) {
    switch (type) {
        // case 'obj ': // Reference
        // 	writeReferenceStructure(reader);
        case 'Objc': // Descriptor
        case 'GlbO': // GlobalObject same as Descriptor
            if (!extType)
                throw new Error("Missing ext type for: " + key + " (" + JSON.stringify(value) + ")");
            writeDescriptorStructure(writer, extType.name, extType.classID, value);
            break;
        case 'VlLs': // List
            psdWriter_1.writeInt32(writer, value.length);
            for (var i = 0; i < value.length; i++) {
                var type_3 = fieldToArrayType[key];
                psdWriter_1.writeSignature(writer, type_3 || 'long');
                writeOSType(writer, type_3 || 'long', value[i], '', fieldToArrayExtType[key]);
                if (logErrors && !type_3)
                    console.log("Missing descriptor array type for: '" + key + "' in", value);
            }
            break;
        case 'doub': // Double
            psdWriter_1.writeFloat64(writer, value);
            break;
        case 'UntF': // Unit double
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units);
            psdWriter_1.writeSignature(writer, unitsMapRev[value.units]);
            psdWriter_1.writeFloat64(writer, value.value);
            break;
        case 'UnFl': // Unit float
            if (!unitsMapRev[value.units])
                throw new Error("Invalid units: " + value.units);
            psdWriter_1.writeSignature(writer, unitsMapRev[value.units]);
            psdWriter_1.writeFloat32(writer, value.value);
            break;
        case 'TEXT': // String
            psdWriter_1.writeUnicodeStringWithPadding(writer, value);
            break;
        case 'enum': { // Enumerated
            var _a = value.split('.'), type_4 = _a[0], val = _a[1];
            writeAsciiStringOrClassId(writer, type_4);
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
        // case 'ObAr': // Object array
        // 	throw new Error('not implemented: ObAr');
        // case 'Pth ': // File path
        // 	writeFilePath(reader);
        default:
            throw new Error("Not implemented TySh descriptor OSType: " + type);
    }
}
function readReferenceStructure(reader) {
    var itemsCount = psdReader_1.readInt32(reader);
    var items = [];
    for (var i = 0; i < itemsCount; i++) {
        var type = psdReader_1.readSignature(reader);
        switch (type) {
            case 'prop': { // Property
                var _a = readClassStructure(reader), name_1 = _a.name, classID = _a.classID;
                var keyID = readAsciiStringOrClassId(reader);
                items.push({ name: name_1, classID: classID, keyID: keyID });
                break;
            }
            case 'Clss': // Class
                items.push(readClassStructure(reader));
                break;
            case 'Enmr': { // Enumerated Reference
                var _b = readClassStructure(reader), name_2 = _b.name, classID = _b.classID;
                var TypeID = readAsciiStringOrClassId(reader);
                var value = readAsciiStringOrClassId(reader);
                items.push({ name: name_2, classID: classID, TypeID: TypeID, value: value });
                break;
            }
            case 'rele': { // Offset
                var _c = readClassStructure(reader), name_3 = _c.name, classID = _c.classID;
                var value = psdReader_1.readUint32(reader);
                items.push({ name: name_3, classID: classID, value: value });
                break;
            }
            case 'Idnt': // Identifier
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'indx': // Index
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'name': // Name
                items.push(psdReader_1.readUnicodeString(reader));
                break;
            default:
                throw new Error("Invalid TySh descriptor Reference type: " + type);
        }
    }
    return items;
}
function readClassStructure(reader) {
    var name = psdReader_1.readUnicodeString(reader);
    var classID = readAsciiStringOrClassId(reader);
    return { name: name, classID: classID };
}
function readVersionAndDescriptor(reader) {
    var version = psdReader_1.readUint32(reader);
    if (version !== 16)
        throw new Error('Invalid descriptor version');
    return readDescriptorStructure(reader);
}
exports.readVersionAndDescriptor = readVersionAndDescriptor;
function writeVersionAndDescriptor(writer, name, classID, descriptor) {
    psdWriter_1.writeUint32(writer, 16); // version
    writeDescriptorStructure(writer, name, classID, descriptor);
}
exports.writeVersionAndDescriptor = writeVersionAndDescriptor;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImRlc2NyaXB0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUNBR3FCO0FBQ3JCLHlDQUdxQjtBQU1yQixTQUFTLE1BQU0sQ0FBQyxHQUFTO0lBQ3hCLElBQU0sTUFBTSxHQUFTLEVBQUUsQ0FBQztJQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLEdBQUcsSUFBSSxPQUFBLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEVBQXRCLENBQXNCLENBQUMsQ0FBQztJQUN4RCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxJQUFNLFFBQVEsR0FBUztJQUN0QixNQUFNLEVBQUUsT0FBTztJQUNmLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLE1BQU0sRUFBRSxVQUFVO0lBQ2xCLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxFQUFFLFNBQVM7SUFDakIsTUFBTSxFQUFFLFFBQVE7SUFDaEIsTUFBTSxFQUFFLGFBQWE7SUFDckIsTUFBTSxFQUFFLFFBQVE7SUFDaEIsTUFBTSxFQUFFLE9BQU87SUFDZixNQUFNLEVBQUUsUUFBUTtJQUNoQixNQUFNLEVBQUUsYUFBYTtDQUNyQixDQUFDO0FBRUYsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3JDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztBQUV0QixTQUFnQixZQUFZLENBQUMsS0FBYztJQUMxQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBQ25CLENBQUM7QUFGRCxvQ0FFQztBQUVELFNBQVMsUUFBUSxDQUFDLElBQVksRUFBRSxPQUFlO0lBQzlDLE9BQU8sRUFBRSxJQUFJLE1BQUEsRUFBRSxPQUFPLFNBQUEsRUFBRSxDQUFDO0FBQzFCLENBQUM7QUFFRCxJQUFNLGNBQWMsR0FBZ0I7SUFDbkMsa0JBQWtCLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQztJQUNuRCxlQUFlLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUM7SUFDdEQsV0FBVyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsYUFBYSxDQUFDO0lBQ3hDLElBQUksRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQztJQUNsQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLE1BQU0sRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUM1QixXQUFXLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDakMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO0lBQzFCLElBQUksRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQztJQUMxQixJQUFJLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7SUFDMUIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxFQUFF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QUFDeEMsQ0FBQztBQUpELDREQUlDO0FBRUQsU0FBZ0IseUJBQXlCLENBQUMsTUFBaUIsRUFBRSxJQUFZLEVBQUUsT0FBZSxFQUFFLFVBQWU7SUFDMUcsdUJBQVcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVO0lBQ25DLHdCQUF3QixDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzdELENBQUM7QUFIRCw4REFHQyIsImZpbGUiOiJkZXNjcmlwdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcclxuXHRQc2RSZWFkZXIsIHJlYWRTaWduYXR1cmUsIHJlYWRVbmljb2RlU3RyaW5nLCByZWFkVWludDMyLCByZWFkVWludDgsIHJlYWRGbG9hdDY0LFxyXG5cdHJlYWRCeXRlcywgcmVhZEFzY2lpU3RyaW5nLCByZWFkSW50MzIsIHJlYWRGbG9hdDMyLCByZWFkSW50MzJMRSwgcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoXHJcbn0gZnJvbSAnLi9wc2RSZWFkZXInO1xyXG5pbXBvcnQge1xyXG5cdFBzZFdyaXRlciwgd3JpdGVTaWduYXR1cmUsIHdyaXRlQnl0ZXMsIHdyaXRlVWludDMyLCB3cml0ZUZsb2F0NjQsIHdyaXRlVWludDgsXHJcblx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcsIHdyaXRlSW50MzIsIHdyaXRlRmxvYXQzMlxyXG59IGZyb20gJy4vcHNkV3JpdGVyJztcclxuXHJcbmludGVyZmFjZSBEaWN0IHsgW2tleTogc3RyaW5nXTogc3RyaW5nOyB9XHJcbmludGVyZmFjZSBOYW1lQ2xhc3NJRCB7IG5hbWU6IHN0cmluZzsgY2xhc3NJRDogc3RyaW5nOyB9XHJcbmludGVyZmFjZSBFeHRUeXBlRGljdCB7IFtrZXk6IHN0cmluZ106IE5hbWVDbGFzc0lEOyB9XHJcblxyXG5mdW5jdGlvbiByZXZNYXAobWFwOiBEaWN0KSB7XHJcblx0Y29uc3QgcmVzdWx0OiBEaWN0ID0ge307XHJcblx0T2JqZWN0LmtleXMobWFwKS5mb3JFYWNoKGtleSA9PiByZXN1bHRbbWFwW2tleV1dID0ga2V5KTtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5jb25zdCB1bml0c01hcDogRGljdCA9IHtcclxuXHQnI0FuZyc6ICdBbmdsZScsXHJcblx0JyNSc2wnOiAnRGVuc2l0eScsXHJcblx0JyNSbHQnOiAnRGlzdGFuY2UnLFxyXG5cdCcjTm5lJzogJ05vbmUnLFxyXG5cdCcjUHJjJzogJ1BlcmNlbnQnLFxyXG5cdCcjUHhsJzogJ1BpeGVscycsXHJcblx0JyNNbG0nOiAnTWlsbGltZXRlcnMnLFxyXG5cdCcjUG50JzogJ1BvaW50cycsXHJcblx0J1JyUGknOiAnUGljYXMnLFxyXG5cdCdSckluJzogJ0luY2hlcycsXHJcblx0J1JyQ20nOiAnQ2VudGltZXRlcnMnLFxyXG59O1xyXG5cclxuY29uc3QgdW5pdHNNYXBSZXYgPSByZXZNYXAodW5pdHNNYXApO1xyXG5sZXQgbG9nRXJyb3JzID0gZmFsc2U7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2V0TG9nRXJyb3JzKHZhbHVlOiBib29sZWFuKSB7XHJcblx0bG9nRXJyb3JzID0gdmFsdWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1ha2VUeXBlKG5hbWU6IHN0cmluZywgY2xhc3NJRDogc3RyaW5nKSB7XHJcblx0cmV0dXJuIHsgbmFtZSwgY2xhc3NJRCB9O1xyXG59XHJcblxyXG5jb25zdCBmaWVsZFRvRXh0VHlwZTogRXh0VHlwZURpY3QgPSB7XHJcblx0c3Ryb2tlU3R5bGVDb250ZW50OiBtYWtlVHlwZSgnJywgJ3NvbGlkQ29sb3JMYXllcicpLFxyXG5cdHByaW50UHJvb2ZTZXR1cDogbWFrZVR5cGUoJ1Byb29mIFNldHVwJywgJ3Byb29mU2V0dXAnKSxcclxuXHRwYXR0ZXJuRmlsbDogbWFrZVR5cGUoJycsICdwYXR0ZXJuRmlsbCcpLFxyXG5cdEdyYWQ6IG1ha2VUeXBlKCdHcmFkaWVudCcsICdHcmRuJyksXHJcblx0ZWJibDogbWFrZVR5cGUoJycsICdlYmJsJyksXHJcblx0U29GaTogbWFrZVR5cGUoJycsICdTb0ZpJyksXHJcblx0R3JGbDogbWFrZVR5cGUoJycsICdHckZsJyksXHJcblx0c2R3QzogbWFrZVR5cGUoJycsICdSR0JDJyksXHJcblx0aGdsQzogbWFrZVR5cGUoJycsICdSR0JDJyksXHJcblx0J0NsciAnOiBtYWtlVHlwZSgnJywgJ1JHQkMnKSxcclxuXHQndGludENvbG9yJzogbWFrZVR5cGUoJycsICdSR0JDJyksXHJcblx0T2ZzdDogbWFrZVR5cGUoJycsICdQbnQgJyksXHJcblx0Q2hGWDogbWFrZVR5cGUoJycsICdDaEZYJyksXHJcblx0TXBnUzogbWFrZVR5cGUoJycsICdTaHBDJyksXHJcblx0RHJTaDogbWFrZVR5cGUoJycsICdEclNoJyksXHJcblx0SXJTaDogbWFrZVR5cGUoJycsICdJclNoJyksXHJcblx0T3JHbDogbWFrZVR5cGUoJycsICdPckdsJyksXHJcblx0SXJHbDogbWFrZVR5cGUoJycsICdJckdsJyksXHJcblx0VHJuUzogbWFrZVR5cGUoJycsICdTaHBDJyksXHJcblx0UHRybjogbWFrZVR5cGUoJycsICdQdHJuJyksXHJcblx0RnJGWDogbWFrZVR5cGUoJycsICdGckZYJyksXHJcblx0cGhhc2U6IG1ha2VUeXBlKCcnLCAnUG50ICcpLFxyXG59O1xyXG5cclxuY29uc3QgZmllbGRUb0FycmF5RXh0VHlwZTogRXh0VHlwZURpY3QgPSB7XHJcblx0J0NydiAnOiBtYWtlVHlwZSgnJywgJ0NyUHQnKSxcclxuXHQnQ2xycyc6IG1ha2VUeXBlKCcnLCAnQ2xydCcpLFxyXG5cdCdUcm5zJzogbWFrZVR5cGUoJycsICdUcm5TJyksXHJcbn07XHJcblxyXG5jb25zdCB0eXBlVG9GaWVsZDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXTsgfSA9IHtcclxuXHQnVEVYVCc6IFtcclxuXHRcdCdUeHQgJywgJ3ByaW50ZXJOYW1lJywgJ05tICAnLCAnSWRudCcsICdibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWUnLCAnTFVUM0RGaWxlTmFtZScsXHJcblx0XHQncHJlc2V0RmlsZU5hbWUnLCAnY3VydmVzUHJlc2V0RmlsZU5hbWUnLCAnbWl4ZXJQcmVzZXRGaWxlTmFtZScsXHJcblx0XSxcclxuXHQndGR0YSc6IFsnRW5naW5lRGF0YScsICdMVVQzREZpbGVEYXRhJ10sXHJcblx0J2xvbmcnOiBbXHJcblx0XHQnVGV4dEluZGV4JywgJ1JuZFMnLCAnTWRwbicsICdTbXRoJywgJ0xjdG4nLCAnc3Ryb2tlU3R5bGVWZXJzaW9uJywgJ0xhSUQnLCAnVnJzbicsXHJcblx0XHQnQnJnaCcsICdDbnRyJywgJ21lYW5zJywgJ3ZpYnJhbmNlJywgJ1N0cnQnLCAnYndQcmVzZXRLaW5kJywgJ3ByZXNldEtpbmQnLFxyXG5cdFx0J2N1cnZlc1ByZXNldEtpbmQnLCAnbWl4ZXJQcmVzZXRLaW5kJyxcclxuXHRdLFxyXG5cdCdlbnVtJzogW1xyXG5cdFx0J3RleHRHcmlkZGluZycsICdPcm50JywgJ3dhcnBTdHlsZScsICd3YXJwUm90YXRlJywgJ0ludGUnLCAnQmx0bicsICdDbHJTJyxcclxuXHRcdCdzZHdNJywgJ2hnbE0nLCAnYnZsVCcsICdidmxTJywgJ2J2bEQnLCAnTWQgICcsICdUeXBlJywgJ2dsd1MnLCAnR3JkRicsICdHbHdUJyxcclxuXHRcdCdzdHJva2VTdHlsZUxpbmVDYXBUeXBlJywgJ3N0cm9rZVN0eWxlTGluZUpvaW5UeXBlJywgJ3N0cm9rZVN0eWxlTGluZUFsaWdubWVudCcsXHJcblx0XHQnc3Ryb2tlU3R5bGVCbGVuZE1vZGUnLCAnUG50VCcsICdTdHlsJywgJ2xvb2t1cFR5cGUnLCAnTFVURm9ybWF0JywgJ2RhdGFPcmRlcicsXHJcblx0XHQndGFibGVPcmRlcidcclxuXHRdLFxyXG5cdCdib29sJzogW1xyXG5cdFx0J1BzdFMnLCAncHJpbnRTaXh0ZWVuQml0JywgJ21hc3RlckZYU3dpdGNoJywgJ2VuYWInLCAndWdsZycsICdhbnRpYWxpYXNHbG9zcycsXHJcblx0XHQndXNlU2hhcGUnLCAndXNlVGV4dHVyZScsICdtYXN0ZXJGWFN3aXRjaCcsICd1Z2xnJywgJ2FudGlhbGlhc0dsb3NzJywgJ3VzZVNoYXBlJyxcclxuXHRcdCd1c2VUZXh0dXJlJywgJ0FsZ24nLCAnUnZycycsICdEdGhyJywgJ0ludnInLCAnVmN0QycsICdTaFRyJywgJ2xheWVyQ29uY2VhbHMnLFxyXG5cdFx0J3N0cm9rZUVuYWJsZWQnLCAnZmlsbEVuYWJsZWQnLCAnc3Ryb2tlU3R5bGVTY2FsZUxvY2snLCAnc3Ryb2tlU3R5bGVTdHJva2VBZGp1c3QnLFxyXG5cdFx0J2hhcmRQcm9vZicsICdNcEJsJywgJ3BhcGVyV2hpdGUnLCAndXNlTGVnYWN5JywgJ0F1dG8nLCAnTGFiICcsICd1c2VUaW50JyxcclxuXHRdLFxyXG5cdCdkb3ViJzogW1xyXG5cdFx0J3dhcnBWYWx1ZScsICd3YXJwUGVyc3BlY3RpdmUnLCAnd2FycFBlcnNwZWN0aXZlT3RoZXInLCAnSW50cicsXHJcblx0XHQnc3Ryb2tlU3R5bGVNaXRlckxpbWl0JywgJ3N0cm9rZVN0eWxlUmVzb2x1dGlvbicsICdsYXllclRpbWUnLFxyXG5cdF0sXHJcblx0J1VudEYnOiBbXHJcblx0XHQnU2NsICcsICdzZHdPJywgJ2hnbE8nLCAnbGFnbCcsICdMYWxkJywgJ3NyZ1InLCAnYmx1cicsICdTZnRuJywgJ09wY3QnLCAnRHN0bicsICdBbmdsJyxcclxuXHRcdCdDa210JywgJ05vc2UnLCAnSW5wcicsICdTaGROJywgJ3N0cm9rZVN0eWxlTGluZVdpZHRoJywgJ3N0cm9rZVN0eWxlTGluZURhc2hPZmZzZXQnLFxyXG5cdFx0J3N0cm9rZVN0eWxlT3BhY2l0eScsICdTeiAgJywgJ0ggICAnLFxyXG5cdF0sXHJcblx0J1ZsTHMnOiBbXHJcblx0XHQnQ3J2ICcsICdDbHJzJywgJ01ubSAnLCAnTXhtICcsICdUcm5zJywgJ3BhdGhMaXN0JywgJ3N0cm9rZVN0eWxlTGluZURhc2hTZXQnLCAnRnJMcycsXHJcblx0XHQnTGFTdCcsXHJcblx0XSxcclxufTtcclxuXHJcbmNvbnN0IGNoYW5uZWxzID0gW1xyXG5cdCdSZCAgJywgJ0dybiAnLCAnQmwgICcsICdZbGx3JywgJ1lsdyAnLCAnQ3luICcsICdNZ250JywgJ0JsY2snLCAnR3J5ICcsICdMbW5jJywgJ0EgICAnLCAnQiAgICcsXHJcbl07XHJcblxyXG5jb25zdCBmaWVsZFRvQXJyYXlUeXBlOiBEaWN0ID0ge1xyXG5cdCdNbm0gJzogJ2xvbmcnLFxyXG5cdCdNeG0gJzogJ2xvbmcnLFxyXG5cdCdGckxzJzogJ2xvbmcnLFxyXG5cdCdzdHJva2VTdHlsZUxpbmVEYXNoU2V0JzogJ1VudEYnLFxyXG59O1xyXG5cclxuY29uc3QgZmllbGRUb1R5cGU6IERpY3QgPSB7fTtcclxuXHJcbmZvciAoY29uc3QgdHlwZSBvZiBPYmplY3Qua2V5cyh0eXBlVG9GaWVsZCkpIHtcclxuXHRmb3IgKGNvbnN0IGZpZWxkIG9mIHR5cGVUb0ZpZWxkW3R5cGVdKSB7XHJcblx0XHRmaWVsZFRvVHlwZVtmaWVsZF0gPSB0eXBlO1xyXG5cdH1cclxufVxyXG5cclxuZm9yIChjb25zdCBmaWVsZCBvZiBPYmplY3Qua2V5cyhmaWVsZFRvRXh0VHlwZSkpIHtcclxuXHRmaWVsZFRvVHlwZVtmaWVsZF0gPSAnT2JqYyc7XHJcbn1cclxuXHJcbmZvciAoY29uc3QgZmllbGQgb2YgT2JqZWN0LmtleXMoZmllbGRUb0FycmF5RXh0VHlwZSkpIHtcclxuXHRmaWVsZFRvQXJyYXlUeXBlW2ZpZWxkXSA9ICdPYmpjJztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0VHlwZUJ5S2V5KGtleTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XHJcblx0aWYgKGtleSA9PT0gJ0FudEEnKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/ICdlbnVtJyA6ICdib29sJztcclxuXHR9IGVsc2UgaWYgKGtleSA9PT0gJ0hyem4nIHx8IGtleSA9PT0gJ1ZydGMnKSB7XHJcblx0XHRyZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyA/ICdkb3ViJyA6ICdVbnRGJztcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZpZWxkVG9UeXBlW2tleV07XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgbGVuZ3RoID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgcmVzdWx0ID0gbGVuZ3RoID09PSAwID8gcmVhZFNpZ25hdHVyZShyZWFkZXIpIDogcmVhZEFzY2lpU3RyaW5nKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogc3RyaW5nKSB7XHJcblx0aWYgKHZhbHVlLmxlbmd0aCA9PT0gNCAmJiB2YWx1ZSAhPT0gJ3dhcnAnKSB7XHJcblx0XHQvLyB3cml0ZSBjbGFzc0lkXHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgMCk7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHZhbHVlKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0Ly8gd3JpdGUgYXNjaWkgc3RyaW5nXHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUubGVuZ3RoKTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCB2YWx1ZS5jaGFyQ29kZUF0KGkpKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRGVzY3JpcHRvclN0cnVjdHVyZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdC8vIGNvbnN0IHN0cnVjdCA9XHJcblx0cmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0Ly8gY29uc29sZS5sb2coc3RydWN0KTtcclxuXHRjb25zdCBpdGVtc0NvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IG9iamVjdDogYW55ID0ge307XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbXNDb3VudDsgaSsrKSB7XHJcblx0XHRjb25zdCBrZXkgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnPicsIGtleSwgdHlwZSk7XHJcblx0XHRjb25zdCBkYXRhID0gcmVhZE9TVHlwZShyZWFkZXIsIHR5cGUpO1xyXG5cdFx0b2JqZWN0W2tleV0gPSBkYXRhO1xyXG5cdH1cclxuXHQvLyBjb25zb2xlLmxvZygnLy8nLCBzdHJ1Y3QpO1xyXG5cdHJldHVybiBvYmplY3Q7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURlc2NyaXB0b3JTdHJ1Y3R1cmUod3JpdGVyOiBQc2RXcml0ZXIsIG5hbWU6IHN0cmluZywgY2xhc3NJZDogc3RyaW5nLCB2YWx1ZTogYW55KSB7XHJcblx0aWYgKGxvZ0Vycm9ycyAmJiAhY2xhc3NJZCkgY29uc29sZS5sb2coJ01pc3NpbmcgY2xhc3NJZCBmb3I6ICcsIG5hbWUsIGNsYXNzSWQsIHZhbHVlKTtcclxuXHJcblx0Ly8gd3JpdGUgY2xhc3Mgc3RydWN0dXJlXHJcblx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBuYW1lKTtcclxuXHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwgY2xhc3NJZCk7XHJcblxyXG5cdGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBrZXlzLmxlbmd0aCk7XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcclxuXHRcdGxldCB0eXBlID0gZ2V0VHlwZUJ5S2V5KGtleSwgdmFsdWVba2V5XSk7XHJcblx0XHRsZXQgZXh0VHlwZSA9IGZpZWxkVG9FeHRUeXBlW2tleV07XHJcblxyXG5cdFx0aWYgKGNoYW5uZWxzLmluZGV4T2Yoa2V5KSAhPT0gLTEpIHtcclxuXHRcdFx0dHlwZSA9IGNsYXNzSWQgPT09ICdSR0JDJyA/ICdkb3ViJyA6ICdsb25nJztcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAncHJvZmlsZScpIHtcclxuXHRcdFx0dHlwZSA9IGNsYXNzSWQgPT09ICdwcmludE91dHB1dCcgPyAnVEVYVCcgOiAndGR0YSc7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ3N0cm9rZVN0eWxlQ29udGVudCcpIHtcclxuXHRcdFx0aWYgKHZhbHVlW2tleV1bJ0NsciAnXSkge1xyXG5cdFx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ3NvbGlkQ29sb3JMYXllcicpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHZhbHVlW2tleV0uR3JhZCkge1xyXG5cdFx0XHRcdGV4dFR5cGUgPSBtYWtlVHlwZSgnJywgJ2dyYWRpZW50TGF5ZXInKTtcclxuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZVtrZXldLlB0cm4pIHtcclxuXHRcdFx0XHRleHRUeXBlID0gbWFrZVR5cGUoJycsICdwYXR0ZXJuTGF5ZXInKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRsb2dFcnJvcnMgJiYgY29uc29sZS5sb2coJ0ludmFsaWQgc3Ryb2tlU3R5bGVDb250ZW50IHZhbHVlJywgdmFsdWVba2V5XSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZUFzY2lpU3RyaW5nT3JDbGFzc0lkKHdyaXRlciwga2V5KTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdHlwZSB8fCAnbG9uZycpO1xyXG5cdFx0d3JpdGVPU1R5cGUod3JpdGVyLCB0eXBlIHx8ICdsb25nJywgdmFsdWVba2V5XSwga2V5LCBleHRUeXBlKTtcclxuXHRcdGlmIChsb2dFcnJvcnMgJiYgIXR5cGUpIGNvbnNvbGUubG9nKGBNaXNzaW5nIGRlc2NyaXB0b3IgZmllbGQgdHlwZSBmb3I6ICcke2tleX0nIGluYCwgdmFsdWUpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZE9TVHlwZShyZWFkZXI6IFBzZFJlYWRlciwgdHlwZTogc3RyaW5nKSB7XHJcblx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRjYXNlICdvYmogJzogLy8gUmVmZXJlbmNlXHJcblx0XHRcdHJldHVybiByZWFkUmVmZXJlbmNlU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdPYmpjJzogLy8gRGVzY3JpcHRvclxyXG5cdFx0Y2FzZSAnR2xiTyc6IC8vIEdsb2JhbE9iamVjdCBzYW1lIGFzIERlc2NyaXB0b3JcclxuXHRcdFx0cmV0dXJuIHJlYWREZXNjcmlwdG9yU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdWbExzJzogeyAvLyBMaXN0XHJcblx0XHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBpdGVtczogYW55W10gPSBbXTtcclxuXHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCcgID4nLCB0eXBlKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRPU1R5cGUocmVhZGVyLCB0eXBlKSk7XHJcblxyXG5cdFx0XHRcdC8vIGlmICh0eXBlb2YgaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0gPT09ICdvYmplY3QnICYmICd1bml0cycgaW4gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0pXHJcblx0XHRcdFx0Ly8gXHRjb25zb2xlLmxvZygnW10nLCBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBpdGVtcztcclxuXHRcdH1cclxuXHRcdGNhc2UgJ2RvdWInOiAvLyBEb3VibGVcclxuXHRcdFx0cmV0dXJuIHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRjYXNlICdVbnRGJzogeyAvLyBVbml0IGRvdWJsZVxyXG5cdFx0XHRjb25zdCB1bml0cyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0XHRpZiAoIXVuaXRzTWFwW3VuaXRzXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3VuaXRzfWApO1xyXG5cdFx0XHRyZXR1cm4geyB1bml0czogdW5pdHNNYXBbdW5pdHNdLCB2YWx1ZSB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnVW5GbCc6IHsgLy8gVW5pdCBmbG9hdFxyXG5cdFx0XHRjb25zdCB1bml0cyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSByZWFkRmxvYXQzMihyZWFkZXIpO1xyXG5cdFx0XHRpZiAoIXVuaXRzTWFwW3VuaXRzXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3VuaXRzfWApO1xyXG5cdFx0XHRyZXR1cm4geyB1bml0czogdW5pdHNNYXBbdW5pdHNdLCB2YWx1ZSB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnVEVYVCc6IC8vIFN0cmluZ1xyXG5cdFx0XHRyZXR1cm4gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdGNhc2UgJ2VudW0nOiB7IC8vIEVudW1lcmF0ZWRcclxuXHRcdFx0Y29uc3QgdHlwZSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRyZXR1cm4gYCR7dHlwZX0uJHt2YWx1ZX1gO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnbG9uZyc6IC8vIEludGVnZXJcclxuXHRcdFx0cmV0dXJuIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0Y2FzZSAnY29tcCc6IHsgLy8gTGFyZ2UgSW50ZWdlclxyXG5cdFx0XHRjb25zdCBsb3cgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGhpZ2ggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdHJldHVybiB7IGxvdywgaGlnaCB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnYm9vbCc6IC8vIEJvb2xlYW5cclxuXHRcdFx0cmV0dXJuICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRjYXNlICd0eXBlJzogLy8gQ2xhc3NcclxuXHRcdGNhc2UgJ0dsYkMnOiAvLyBDbGFzc1xyXG5cdFx0XHRyZXR1cm4gcmVhZENsYXNzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICdhbGlzJzogeyAvLyBBbGlhc1xyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmV0dXJuIHJlYWRBc2NpaVN0cmluZyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0XHR9XHJcblx0XHRjYXNlICd0ZHRhJzogeyAvLyBSYXcgRGF0YVxyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmV0dXJuIHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0XHR9XHJcblx0XHRjYXNlICdPYkFyJzogLy8gT2JqZWN0IGFycmF5XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkOiBPYkFyJyk7XHJcblx0XHRjYXNlICdQdGggJzogeyAvLyBGaWxlIHBhdGhcclxuXHRcdFx0Lypjb25zdCBsZW5ndGggPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBzaWcgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcGF0aFNpemUgPSovIHJlYWRJbnQzMkxFKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGNoYXJzQ291bnQgPSByZWFkSW50MzJMRShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBwYXRoID0gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlciwgY2hhcnNDb3VudCk7XHJcblx0XHRcdHJldHVybiB7IHNpZywgcGF0aCB9O1xyXG5cdFx0fVxyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFR5U2ggZGVzY3JpcHRvciBPU1R5cGU6ICR7dHlwZX0gYXQgJHtyZWFkZXIub2Zmc2V0LnRvU3RyaW5nKDE2KX1gKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlT1NUeXBlKHdyaXRlcjogUHNkV3JpdGVyLCB0eXBlOiBzdHJpbmcsIHZhbHVlOiBhbnksIGtleTogc3RyaW5nLCBleHRUeXBlPzogTmFtZUNsYXNzSUQpIHtcclxuXHRzd2l0Y2ggKHR5cGUpIHtcclxuXHRcdC8vIGNhc2UgJ29iaiAnOiAvLyBSZWZlcmVuY2VcclxuXHRcdC8vIFx0d3JpdGVSZWZlcmVuY2VTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdGNhc2UgJ09iamMnOiAvLyBEZXNjcmlwdG9yXHJcblx0XHRjYXNlICdHbGJPJzogLy8gR2xvYmFsT2JqZWN0IHNhbWUgYXMgRGVzY3JpcHRvclxyXG5cdFx0XHRpZiAoIWV4dFR5cGUpIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBleHQgdHlwZSBmb3I6ICR7a2V5fSAoJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9KWApO1xyXG5cdFx0XHR3cml0ZURlc2NyaXB0b3JTdHJ1Y3R1cmUod3JpdGVyLCBleHRUeXBlLm5hbWUsIGV4dFR5cGUuY2xhc3NJRCwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1ZsTHMnOiAvLyBMaXN0XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZS5sZW5ndGgpO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdGNvbnN0IHR5cGUgPSBmaWVsZFRvQXJyYXlUeXBlW2tleV07XHJcblx0XHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCB0eXBlIHx8ICdsb25nJyk7XHJcblx0XHRcdFx0d3JpdGVPU1R5cGUod3JpdGVyLCB0eXBlIHx8ICdsb25nJywgdmFsdWVbaV0sICcnLCBmaWVsZFRvQXJyYXlFeHRUeXBlW2tleV0pO1xyXG5cdFx0XHRcdGlmIChsb2dFcnJvcnMgJiYgIXR5cGUpIGNvbnNvbGUubG9nKGBNaXNzaW5nIGRlc2NyaXB0b3IgYXJyYXkgdHlwZSBmb3I6ICcke2tleX0nIGluYCwgdmFsdWUpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnZG91Yic6IC8vIERvdWJsZVxyXG5cdFx0XHR3cml0ZUZsb2F0NjQod3JpdGVyLCB2YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnVW50Ric6IC8vIFVuaXQgZG91YmxlXHJcblx0XHRcdGlmICghdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7dmFsdWUudW5pdHN9YCk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKTtcclxuXHRcdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdmFsdWUudmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1VuRmwnOiAvLyBVbml0IGZsb2F0XHJcblx0XHRcdGlmICghdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdW5pdHM6ICR7dmFsdWUudW5pdHN9YCk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdW5pdHNNYXBSZXZbdmFsdWUudW5pdHNdKTtcclxuXHRcdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgdmFsdWUudmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdGNhc2UgJ1RFWFQnOiAvLyBTdHJpbmdcclxuXHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCB2YWx1ZSk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0Y2FzZSAnZW51bSc6IHsgLy8gRW51bWVyYXRlZFxyXG5cdFx0XHRjb25zdCBbdHlwZSwgdmFsXSA9IHZhbHVlLnNwbGl0KCcuJyk7XHJcblx0XHRcdHdyaXRlQXNjaWlTdHJpbmdPckNsYXNzSWQod3JpdGVyLCB0eXBlKTtcclxuXHRcdFx0d3JpdGVBc2NpaVN0cmluZ09yQ2xhc3NJZCh3cml0ZXIsIHZhbCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSAnbG9uZyc6IC8vIEludGVnZXJcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlKTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHQvLyBjYXNlICdjb21wJzogLy8gTGFyZ2UgSW50ZWdlclxyXG5cdFx0Ly8gXHR3cml0ZUxhcmdlSW50ZWdlcihyZWFkZXIpO1xyXG5cdFx0Y2FzZSAnYm9vbCc6IC8vIEJvb2xlYW5cclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZhbHVlID8gMSA6IDApO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdC8vIGNhc2UgJ3R5cGUnOiAvLyBDbGFzc1xyXG5cdFx0Ly8gY2FzZSAnR2xiQyc6IC8vIENsYXNzXHJcblx0XHQvLyBcdHdyaXRlQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdC8vIGNhc2UgJ2FsaXMnOiAvLyBBbGlhc1xyXG5cdFx0Ly8gXHR3cml0ZUFsaWFzU3RydWN0dXJlKHJlYWRlcik7XHJcblx0XHRjYXNlICd0ZHRhJzogLy8gUmF3IERhdGFcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlLmJ5dGVMZW5ndGgpO1xyXG5cdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgdmFsdWUpO1xyXG5cdFx0XHRicmVhaztcclxuXHRcdC8vIGNhc2UgJ09iQXInOiAvLyBPYmplY3QgYXJyYXlcclxuXHRcdC8vIFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQ6IE9iQXInKTtcclxuXHRcdC8vIGNhc2UgJ1B0aCAnOiAvLyBGaWxlIHBhdGhcclxuXHRcdC8vIFx0d3JpdGVGaWxlUGF0aChyZWFkZXIpO1xyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOb3QgaW1wbGVtZW50ZWQgVHlTaCBkZXNjcmlwdG9yIE9TVHlwZTogJHt0eXBlfWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZFJlZmVyZW5jZVN0cnVjdHVyZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IGl0ZW1zQ291bnQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBpdGVtczogYW55W10gPSBbXTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtc0NvdW50OyBpKyspIHtcclxuXHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdGNhc2UgJ3Byb3AnOiB7IC8vIFByb3BlcnR5XHJcblx0XHRcdFx0Y29uc3QgeyBuYW1lLCBjbGFzc0lEIH0gPSByZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBrZXlJRCA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRcdGl0ZW1zLnB1c2goeyBuYW1lLCBjbGFzc0lELCBrZXlJRCB9KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdDbHNzJzogLy8gQ2xhc3NcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnRW5tcic6IHsgLy8gRW51bWVyYXRlZCBSZWZlcmVuY2VcclxuXHRcdFx0XHRjb25zdCB7IG5hbWUsIGNsYXNzSUQgfSA9IHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IFR5cGVJRCA9IHJlYWRBc2NpaVN0cmluZ09yQ2xhc3NJZChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gcmVhZEFzY2lpU3RyaW5nT3JDbGFzc0lkKHJlYWRlcik7XHJcblx0XHRcdFx0aXRlbXMucHVzaCh7IG5hbWUsIGNsYXNzSUQsIFR5cGVJRCwgdmFsdWUgfSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAncmVsZSc6IHsgLy8gT2Zmc2V0XHJcblx0XHRcdFx0Y29uc3QgeyBuYW1lLCBjbGFzc0lEIH0gPSByZWFkQ2xhc3NTdHJ1Y3R1cmUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHsgbmFtZSwgY2xhc3NJRCwgdmFsdWUgfSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnSWRudCc6IC8vIElkZW50aWZpZXJcclxuXHRcdFx0XHRpdGVtcy5wdXNoKHJlYWRJbnQzMihyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnaW5keCc6IC8vIEluZGV4XHJcblx0XHRcdFx0aXRlbXMucHVzaChyZWFkSW50MzIocmVhZGVyKSk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ25hbWUnOiAvLyBOYW1lXHJcblx0XHRcdFx0aXRlbXMucHVzaChyZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVHlTaCBkZXNjcmlwdG9yIFJlZmVyZW5jZSB0eXBlOiAke3R5cGV9YCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gaXRlbXM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRDbGFzc1N0cnVjdHVyZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IG5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdGNvbnN0IGNsYXNzSUQgPSByZWFkQXNjaWlTdHJpbmdPckNsYXNzSWQocmVhZGVyKTtcclxuXHRyZXR1cm4geyBuYW1lLCBjbGFzc0lEIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uICE9PSAxNikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGRlc2NyaXB0b3IgdmVyc2lvbicpO1xyXG5cdHJldHVybiByZWFkRGVzY3JpcHRvclN0cnVjdHVyZShyZWFkZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXI6IFBzZFdyaXRlciwgbmFtZTogc3RyaW5nLCBjbGFzc0lEOiBzdHJpbmcsIGRlc2NyaXB0b3I6IGFueSkge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgMTYpOyAvLyB2ZXJzaW9uXHJcblx0d3JpdGVEZXNjcmlwdG9yU3RydWN0dXJlKHdyaXRlciwgbmFtZSwgY2xhc3NJRCwgZGVzY3JpcHRvcik7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
