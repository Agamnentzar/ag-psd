import { toByteArray } from 'base64-js';
import { readPascalString, readUnicodeString, readUint32, readUint16, readUint8, readFloat64, readBytes, skipBytes, readFloat32, readInt16, readFixedPoint32, readSignature, checkSignature, readSection, readColor } from './psdReader';
import { writePascalString, writeUnicodeString, writeUint32, writeUint8, writeFloat64, writeUint16, writeBytes, writeInt16, writeFloat32, writeFixedPoint32, writeUnicodeStringWithPadding, writeColor, } from './psdWriter';
import { createCanvasFromData, createEnum, MOCK_HANDLERS } from './helpers';
import { decodeString, encodeString } from './utf8';
import { readVersionAndDescriptor, writeVersionAndDescriptor } from './descriptor';
export var resourceHandlers = [];
export var resourceHandlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    resourceHandlers.push(handler);
    resourceHandlersMap[handler.key] = handler;
}
var LOG_MOCK_HANDLERS = false;
var RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
var MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];
var hex = '0123456789abcdef';
function charToNibble(code) {
    return code <= 57 ? code - 48 : code - 87;
}
function byteAt(value, index) {
    return (charToNibble(value.charCodeAt(index)) << 4) | charToNibble(value.charCodeAt(index + 1));
}
function readUtf8String(reader, length) {
    var buffer = readBytes(reader, length);
    return decodeString(buffer);
}
function writeUtf8String(writer, value) {
    var buffer = encodeString(value);
    writeBytes(writer, buffer);
}
MOCK_HANDLERS && addHandler(1028, // IPTC-NAA record
function (// IPTC-NAA record
target) { return target._ir1028 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1028', left());
    target._ir1028 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1028);
});
addHandler(1061, function (target) { return target.captionDigest !== undefined; }, function (reader, target) {
    var captionDigest = '';
    for (var i = 0; i < 16; i++) {
        var byte = readUint8(reader);
        captionDigest += hex[byte >> 4];
        captionDigest += hex[byte & 0xf];
    }
    target.captionDigest = captionDigest;
}, function (writer, target) {
    for (var i = 0; i < 16; i++) {
        writeUint8(writer, byteAt(target.captionDigest, i * 2));
    }
});
addHandler(1060, function (target) { return target.xmpMetadata !== undefined; }, function (reader, target, left) { return target.xmpMetadata = readUtf8String(reader, left()); }, function (writer, target) { return writeUtf8String(writer, target.xmpMetadata); });
var Inte = createEnum('Inte', 'perceptual', {
    'perceptual': 'Img ',
    'saturation': 'Grp ',
    'relative colorimetric': 'Clrm',
    'absolute colorimetric': 'AClr',
});
addHandler(1082, function (target) { return target.printInformation !== undefined; }, function (reader, target) {
    var _a, _b;
    var desc = readVersionAndDescriptor(reader);
    target.printInformation = {
        printerName: desc.printerName || '',
        renderingIntent: Inte.decode((_a = desc.Inte) !== null && _a !== void 0 ? _a : 'Inte.Img '),
    };
    var info = target.printInformation;
    if (desc.PstS !== undefined)
        info.printerManagesColors = desc.PstS;
    if (desc['Nm  '] !== undefined)
        info.printerProfile = desc['Nm  '];
    if (desc.MpBl !== undefined)
        info.blackPointCompensation = desc.MpBl;
    if (desc.printSixteenBit !== undefined)
        info.printSixteenBit = desc.printSixteenBit;
    if (desc.hardProof !== undefined)
        info.hardProof = desc.hardProof;
    if (desc.printProofSetup) {
        if ('Bltn' in desc.printProofSetup) {
            info.proofSetup = { builtin: desc.printProofSetup.Bltn.split('.')[1] };
        }
        else {
            info.proofSetup = {
                profile: desc.printProofSetup.profile,
                renderingIntent: Inte.decode((_b = desc.printProofSetup.Inte) !== null && _b !== void 0 ? _b : 'Inte.Img '),
                blackPointCompensation: !!desc.printProofSetup.MpBl,
                paperWhite: !!desc.printProofSetup.paperWhite,
            };
        }
    }
}, function (writer, target) {
    var _a, _b;
    var info = target.printInformation;
    var desc = {};
    if (info.printerManagesColors) {
        desc.PstS = true;
    }
    else {
        if (info.hardProof !== undefined)
            desc.hardProof = !!info.hardProof;
        desc.ClrS = 'ClrS.RGBC'; // TODO: ???
        desc['Nm  '] = (_a = info.printerProfile) !== null && _a !== void 0 ? _a : 'CIE RGB';
    }
    desc.Inte = Inte.encode(info.renderingIntent);
    if (!info.printerManagesColors)
        desc.MpBl = !!info.blackPointCompensation;
    desc.printSixteenBit = !!info.printSixteenBit;
    desc.printerName = info.printerName || '';
    if (info.proofSetup && 'profile' in info.proofSetup) {
        desc.printProofSetup = {
            profile: info.proofSetup.profile || '',
            Inte: Inte.encode(info.proofSetup.renderingIntent),
            MpBl: !!info.proofSetup.blackPointCompensation,
            paperWhite: !!info.proofSetup.paperWhite,
        };
    }
    else {
        desc.printProofSetup = {
            Bltn: ((_b = info.proofSetup) === null || _b === void 0 ? void 0 : _b.builtin) ? "builtinProof." + info.proofSetup.builtin : 'builtinProof.proofCMYK',
        };
    }
    writeVersionAndDescriptor(writer, '', 'printOutput', desc);
});
MOCK_HANDLERS && addHandler(1083, // Print style
function (// Print style
target) { return target._ir1083 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1083', left());
    target._ir1083 = readBytes(reader, left());
    // TODO:
    // const desc = readVersionAndDescriptor(reader);
    // console.log('1083', require('util').inspect(desc, false, 99, true));
}, function (writer, target) {
    writeBytes(writer, target._ir1083);
});
addHandler(1005, function (target) { return target.resolutionInfo !== undefined; }, function (reader, target) {
    var horizontalResolution = readFixedPoint32(reader);
    var horizontalResolutionUnit = readUint16(reader);
    var widthUnit = readUint16(reader);
    var verticalResolution = readFixedPoint32(reader);
    var verticalResolutionUnit = readUint16(reader);
    var heightUnit = readUint16(reader);
    target.resolutionInfo = {
        horizontalResolution: horizontalResolution,
        horizontalResolutionUnit: RESOLUTION_UNITS[horizontalResolutionUnit] || 'PPI',
        widthUnit: MEASUREMENT_UNITS[widthUnit] || 'Inches',
        verticalResolution: verticalResolution,
        verticalResolutionUnit: RESOLUTION_UNITS[verticalResolutionUnit] || 'PPI',
        heightUnit: MEASUREMENT_UNITS[heightUnit] || 'Inches',
    };
}, function (writer, target) {
    var info = target.resolutionInfo;
    writeFixedPoint32(writer, info.horizontalResolution || 0);
    writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
    writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
    writeFixedPoint32(writer, info.verticalResolution || 0);
    writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
    writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
});
var printScaleStyles = ['centered', 'size to fit', 'user defined'];
addHandler(1062, function (target) { return target.printScale !== undefined; }, function (reader, target) {
    target.printScale = {
        style: printScaleStyles[readInt16(reader)],
        x: readFloat32(reader),
        y: readFloat32(reader),
        scale: readFloat32(reader),
    };
}, function (writer, target) {
    var _a = target.printScale, style = _a.style, x = _a.x, y = _a.y, scale = _a.scale;
    writeInt16(writer, Math.max(0, printScaleStyles.indexOf(style)));
    writeFloat32(writer, x || 0);
    writeFloat32(writer, y || 0);
    writeFloat32(writer, scale || 0);
});
addHandler(1006, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        var value = readPascalString(reader, 1);
        target.alphaChannelNames.push(value);
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_1 = _a[_i];
        writePascalString(writer, name_1, 1);
    }
});
addHandler(1045, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        target.alphaChannelNames.push(readUnicodeString(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_2 = _a[_i];
        writeUnicodeStringWithPadding(writer, name_2);
    }
});
MOCK_HANDLERS && addHandler(1077, function (target) { return target._ir1077 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1077', left());
    target._ir1077 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1077);
});
addHandler(1053, function (target) { return target.alphaIdentifiers !== undefined; }, function (reader, target, left) {
    target.alphaIdentifiers = [];
    while (left() >= 4) {
        target.alphaIdentifiers.push(readUint32(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaIdentifiers; _i < _a.length; _i++) {
        var id = _a[_i];
        writeUint32(writer, id);
    }
});
addHandler(1010, function (target) { return target.backgroundColor !== undefined; }, function (reader, target) { return target.backgroundColor = readColor(reader); }, function (writer, target) { return writeColor(writer, target.backgroundColor); });
addHandler(1037, function (target) { return target.globalAngle !== undefined; }, function (reader, target) { return target.globalAngle = readUint32(reader); }, function (writer, target) { return writeUint32(writer, target.globalAngle); });
addHandler(1049, function (target) { return target.globalAltitude !== undefined; }, function (reader, target) { return target.globalAltitude = readUint32(reader); }, function (writer, target) { return writeUint32(writer, target.globalAltitude); });
addHandler(1011, function (target) { return target.printFlags !== undefined; }, function (reader, target) {
    target.printFlags = {
        labels: !!readUint8(reader),
        cropMarks: !!readUint8(reader),
        colorBars: !!readUint8(reader),
        registrationMarks: !!readUint8(reader),
        negative: !!readUint8(reader),
        flip: !!readUint8(reader),
        interpolate: !!readUint8(reader),
        caption: !!readUint8(reader),
        printFlags: !!readUint8(reader),
    };
}, function (writer, target) {
    var flags = target.printFlags;
    writeUint8(writer, flags.labels ? 1 : 0);
    writeUint8(writer, flags.cropMarks ? 1 : 0);
    writeUint8(writer, flags.colorBars ? 1 : 0);
    writeUint8(writer, flags.registrationMarks ? 1 : 0);
    writeUint8(writer, flags.negative ? 1 : 0);
    writeUint8(writer, flags.flip ? 1 : 0);
    writeUint8(writer, flags.interpolate ? 1 : 0);
    writeUint8(writer, flags.caption ? 1 : 0);
    writeUint8(writer, flags.printFlags ? 1 : 0);
});
MOCK_HANDLERS && addHandler(10000, // Print flags
function (// Print flags
target) { return target._ir10000 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 10000', left());
    target._ir10000 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir10000);
});
MOCK_HANDLERS && addHandler(1013, // Color halftoning
function (// Color halftoning
target) { return target._ir1013 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1013', left());
    target._ir1013 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1013);
});
MOCK_HANDLERS && addHandler(1016, // Color transfer functions
function (// Color transfer functions
target) { return target._ir1016 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1016', left());
    target._ir1016 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1016);
});
addHandler(1024, function (target) { return target.layerState !== undefined; }, function (reader, target) { return target.layerState = readUint16(reader); }, function (writer, target) { return writeUint16(writer, target.layerState); });
addHandler(1026, function (target) { return target.layersGroup !== undefined; }, function (reader, target, left) {
    target.layersGroup = [];
    while (left()) {
        target.layersGroup.push(readUint16(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layersGroup; _i < _a.length; _i++) {
        var g = _a[_i];
        writeUint16(writer, g);
    }
});
addHandler(1072, function (target) { return target.layerGroupsEnabledId !== undefined; }, function (reader, target, left) {
    target.layerGroupsEnabledId = [];
    while (left()) {
        target.layerGroupsEnabledId.push(readUint8(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layerGroupsEnabledId; _i < _a.length; _i++) {
        var id = _a[_i];
        writeUint8(writer, id);
    }
});
addHandler(1069, function (target) { return target.layerSelectionIds !== undefined; }, function (reader, target) {
    var count = readUint16(reader);
    target.layerSelectionIds = [];
    while (count--) {
        target.layerSelectionIds.push(readUint32(reader));
    }
}, function (writer, target) {
    writeUint16(writer, target.layerSelectionIds.length);
    for (var _i = 0, _a = target.layerSelectionIds; _i < _a.length; _i++) {
        var id = _a[_i];
        writeUint32(writer, id);
    }
});
addHandler(1032, function (target) { return target.gridAndGuidesInformation !== undefined; }, function (reader, target) {
    var version = readUint32(reader);
    var horizontal = readUint32(reader);
    var vertical = readUint32(reader);
    var count = readUint32(reader);
    if (version !== 1)
        throw new Error("Invalid 1032 resource version: " + version);
    target.gridAndGuidesInformation = {
        grid: { horizontal: horizontal, vertical: vertical },
        guides: [],
    };
    for (var i = 0; i < count; i++) {
        target.gridAndGuidesInformation.guides.push({
            location: readUint32(reader) / 32,
            direction: readUint8(reader) ? 'horizontal' : 'vertical'
        });
    }
}, function (writer, target) {
    var info = target.gridAndGuidesInformation;
    var grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
    var guides = info.guides || [];
    writeUint32(writer, 1);
    writeUint32(writer, grid.horizontal);
    writeUint32(writer, grid.vertical);
    writeUint32(writer, guides.length);
    for (var _i = 0, guides_1 = guides; _i < guides_1.length; _i++) {
        var g = guides_1[_i];
        writeUint32(writer, g.location * 32);
        writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
    }
});
addHandler(1054, function (target) { return target.urlsList !== undefined; }, function (reader, target, _, options) {
    var count = readUint32(reader);
    if (count) {
        if (!options.throwForMissingFeatures)
            return;
        throw new Error('Not implemented: URL List');
    }
    // TODO: read actual URL list
    target.urlsList = [];
}, function (writer, target) {
    writeUint32(writer, target.urlsList.length);
    // TODO: write actual URL list
    if (target.urlsList.length) {
        throw new Error('Not implemented: URL List');
    }
});
MOCK_HANDLERS && addHandler(1050, // Slices
function (// Slices
target) { return target._ir1050 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1050', left());
    target._ir1050 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1050);
});
addHandler(1064, function (target) { return target.pixelAspectRatio !== undefined; }, function (reader, target) {
    if (readUint32(reader) > 2)
        throw new Error('Invalid pixelAspectRatio version');
    target.pixelAspectRatio = { aspect: readFloat64(reader) };
}, function (writer, target) {
    writeUint32(writer, 2); // version
    writeFloat64(writer, target.pixelAspectRatio.aspect);
});
addHandler(1041, function (target) { return target.iccUntaggedProfile !== undefined; }, function (reader, target) {
    target.iccUntaggedProfile = !!readUint8(reader);
}, function (writer, target) {
    writeUint8(writer, target.iccUntaggedProfile ? 1 : 0);
});
MOCK_HANDLERS && addHandler(1039, // ICC Profile
function (// ICC Profile
target) { return target._ir1039 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1039', left());
    target._ir1039 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1039);
});
addHandler(1044, function (target) { return target.idsSeedNumber !== undefined; }, function (reader, target) { return target.idsSeedNumber = readUint32(reader); }, function (writer, target) { return writeUint32(writer, target.idsSeedNumber); });
addHandler(1036, function (target) { return target.thumbnail !== undefined || target.thumbnailRaw !== undefined; }, function (reader, target, left, options) {
    var format = readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
    var width = readUint32(reader);
    var height = readUint32(reader);
    readUint32(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
    readUint32(reader); // totalSize = widthBytes * height * planes
    readUint32(reader); // sizeAfterCompression
    var bitsPerPixel = readUint16(reader); // 24
    var planes = readUint16(reader); // 1
    if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
        options.logMissingFeatures && console.log("Invalid thumbnail data (format: " + format + ", bitsPerPixel: " + bitsPerPixel + ", planes: " + planes + ")");
        skipBytes(reader, left());
        return;
    }
    var size = left();
    var data = readBytes(reader, size);
    if (options.useRawThumbnail) {
        target.thumbnailRaw = { width: width, height: height, data: data };
    }
    else {
        target.thumbnail = createCanvasFromData(data);
    }
}, function (writer, target) {
    var width = 0;
    var height = 0;
    var data;
    if (target.thumbnailRaw) {
        width = target.thumbnailRaw.width;
        height = target.thumbnailRaw.height;
        data = target.thumbnailRaw.data;
    }
    else {
        if (!target.thumbnail)
            throw new Error('Missing thumbnail');
        width = target.thumbnail.width;
        height = target.thumbnail.height;
        data = toByteArray(target.thumbnail.toDataURL('image/jpeg', 1).substr('data:image/jpeg;base64,'.length));
    }
    var bitsPerPixel = 24;
    var widthBytes = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
    var planes = 1;
    var totalSize = widthBytes * height * planes;
    var sizeAfterCompression = data.length;
    writeUint32(writer, 1); // 1 = kJpegRGB
    writeUint32(writer, width);
    writeUint32(writer, height);
    writeUint32(writer, widthBytes);
    writeUint32(writer, totalSize);
    writeUint32(writer, sizeAfterCompression);
    writeUint16(writer, bitsPerPixel);
    writeUint16(writer, planes);
    writeBytes(writer, data);
});
addHandler(1057, function (target) { return target.versionInfo !== undefined; }, function (reader, target, left) {
    var version = readUint32(reader);
    if (version !== 1)
        throw new Error('Invalid versionInfo version');
    target.versionInfo = {
        hasRealMergedData: !!readUint8(reader),
        writerName: readUnicodeString(reader),
        readerName: readUnicodeString(reader),
        fileVersion: readUint32(reader),
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var versionInfo = target.versionInfo;
    writeUint32(writer, 1); // version
    writeUint8(writer, versionInfo.hasRealMergedData ? 1 : 0);
    writeUnicodeString(writer, versionInfo.writerName);
    writeUnicodeString(writer, versionInfo.readerName);
    writeUint32(writer, versionInfo.fileVersion);
});
MOCK_HANDLERS && addHandler(1058, // EXIF data 1.
function (// EXIF data 1.
target) { return target._ir1058 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1058', left());
    target._ir1058 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1058);
});
addHandler(7000, function (target) { return target.imageReadyVariables !== undefined; }, function (reader, target, left) {
    target.imageReadyVariables = readUtf8String(reader, left());
}, function (writer, target) {
    writeUtf8String(writer, target.imageReadyVariables);
});
addHandler(7001, function (target) { return target.imageReadyDataSets !== undefined; }, function (reader, target, left) {
    target.imageReadyDataSets = readUtf8String(reader, left());
}, function (writer, target) {
    writeUtf8String(writer, target.imageReadyDataSets);
});
addHandler(1088, function (target) { return target.pathSelectionState !== undefined; }, function (reader, target, _left) {
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.pathSelectionState = desc['null'];
}, function (writer, target) {
    var desc = { 'null': target.pathSelectionState };
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
MOCK_HANDLERS && addHandler(1025, function (target) { return target._ir1025 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1025', left());
    target._ir1025 = readBytes(reader, left());
}, function (writer, target) {
    writeBytes(writer, target._ir1025);
});
var FrmD = createEnum('FrmD', '', {
    auto: 'Auto',
    none: 'None',
    dispose: 'Disp',
});
// TODO: Unfinished
MOCK_HANDLERS && addHandler(4000, // Plug-In resource(s)
function (// Plug-In resource(s)
target) { return target._ir4000 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (MOCK_HANDLERS) {
        LOG_MOCK_HANDLERS && console.log('image resource 4000', left());
        target._ir4000 = readBytes(reader, left());
        return;
    }
    var key = readSignature(reader);
    if (key === 'mani') {
        checkSignature(reader, 'IRFR');
        readSection(reader, 1, function (left) {
            var _loop_1 = function () {
                checkSignature(reader, '8BIM');
                var key_1 = readSignature(reader);
                readSection(reader, 1, function (left) {
                    if (key_1 === 'AnDs') {
                        var desc = readVersionAndDescriptor(reader);
                        // console.log('AnDs', desc);
                        logDevFeatures && console.log('#4000 AnDs', desc);
                        // logDevFeatures && console.log('#4000 AnDs', require('util').inspect(desc, false, 99, true));
                        var result = {
                            // desc.AFSt ???
                            frames: desc.FrIn.map(function (x) { return ({
                                id: x.FrID,
                                delay: x.FrDl / 100,
                                dispose: x.FrDs ? FrmD.decode(x.FrDs) : 'auto', // missing == auto
                                // x.FrGA ???
                            }); }),
                            animations: desc.FSts.map(function (x) { return ({
                                id: x.FsID,
                                frames: x.FsFr,
                                repeats: x.LCnt,
                                // x.AFrm ???
                            }); }),
                        };
                        logDevFeatures && console.log('#4000 AnDs:result', result);
                        // logDevFeatures && console.log('#4000 AnDs:result', require('util').inspect(result, false, 99, true));
                    }
                    else if (key_1 === 'Roll') {
                        var bytes = readBytes(reader, left());
                        logDevFeatures && console.log('#4000 Roll', bytes);
                    }
                    else {
                        logMissingFeatures && console.log('Unhandled subsection in #4000', key_1);
                    }
                });
            };
            while (left()) {
                _loop_1();
            }
        });
    }
    else if (key === 'mopt') {
        var bytes = readBytes(reader, left());
        logDevFeatures && console.log('#4000 mopt', bytes);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4000:', key);
        return;
    }
}, function (writer, target) {
    writeBytes(writer, target._ir4000);
});
// TODO: Unfinished
MOCK_HANDLERS && addHandler(4001, // Plug-In resource(s)
function (// Plug-In resource(s)
target) { return target._ir4001 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (MOCK_HANDLERS) {
        LOG_MOCK_HANDLERS && console.log('image resource 4001', left());
        target._ir4001 = readBytes(reader, left());
        return;
    }
    var key = readSignature(reader);
    if (key === 'mfri') {
        var version = readUint32(reader);
        if (version !== 2)
            throw new Error('Invalid mfri version');
        var length_1 = readUint32(reader);
        var bytes = readBytes(reader, length_1);
        logDevFeatures && console.log('mfri', bytes);
    }
    else if (key === 'mset') {
        var desc = readVersionAndDescriptor(reader);
        logDevFeatures && console.log('mset', desc);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4001', key);
    }
}, function (writer, target) {
    writeBytes(writer, target._ir4001);
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImltYWdlUmVzb3VyY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFeEMsT0FBTyxFQUNLLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFDOUYsU0FBUyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQzdGLFdBQVcsRUFBRSxTQUFTLEVBQ3RCLE1BQU0sYUFBYSxDQUFDO0FBQ3JCLE9BQU8sRUFDSyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQ3BHLFVBQVUsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLGlCQUFpQixFQUFFLDZCQUE2QixFQUFFLFVBQVUsR0FDbEcsTUFBTSxhQUFhLENBQUM7QUFDckIsT0FBTyxFQUFFLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDNUUsT0FBTyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDcEQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLHlCQUF5QixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBU25GLE1BQU0sQ0FBQyxJQUFNLGdCQUFnQixHQUFzQixFQUFFLENBQUM7QUFDdEQsTUFBTSxDQUFDLElBQU0sbUJBQW1CLEdBQXVDLEVBQUUsQ0FBQztBQUUxRSxTQUFTLFVBQVUsQ0FDbEIsR0FBVyxFQUNYLEdBQXdDLEVBQ3hDLElBQW1HLEVBQ25HLEtBQTBEO0lBRTFELElBQU0sT0FBTyxHQUFvQixFQUFFLEdBQUcsS0FBQSxFQUFFLEdBQUcsS0FBQSxFQUFFLElBQUksTUFBQSxFQUFFLEtBQUssT0FBQSxFQUFFLENBQUM7SUFDM0QsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUM7QUFDNUMsQ0FBQztBQUVELElBQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0FBQ2hDLElBQU0sZ0JBQWdCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BELElBQU0saUJBQWlCLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzdGLElBQU0sR0FBRyxHQUFHLGtCQUFrQixDQUFDO0FBRS9CLFNBQVMsWUFBWSxDQUFDLElBQVk7SUFDakMsT0FBTyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQzNDLENBQUM7QUFFRCxTQUFTLE1BQU0sQ0FBQyxLQUFhLEVBQUUsS0FBYTtJQUMzQyxPQUFPLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqRyxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsTUFBaUIsRUFBRSxNQUFjO0lBQ3hELElBQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDekMsT0FBTyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUN4RCxJQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkMsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM1QixDQUFDO0FBRUQsYUFBYSxJQUFJLFVBQVUsQ0FDMUIsSUFBSSxFQUFFLGtCQUFrQjtBQUN4QixVQURNLGtCQUFrQjtBQUN4QixNQUFNLElBQUksT0FBQyxNQUFjLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBckMsQ0FBcUMsRUFDL0MsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUk7SUFDcEIsaUJBQWlCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQy9ELE1BQWMsQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsVUFBVSxDQUFDLE1BQU0sRUFBRyxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDN0MsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQWxDLENBQWtDLEVBQzVDLFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFFdkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUM1QixJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsYUFBYSxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDaEMsYUFBYSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUM7S0FDakM7SUFFRCxNQUFNLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztBQUN0QyxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDNUIsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLGFBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6RDtBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFoQyxDQUFnQyxFQUMxQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxJQUFLLE9BQUEsTUFBTSxDQUFDLFdBQVcsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQW5ELENBQW1ELEVBQzdFLFVBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSyxPQUFBLGVBQWUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFdBQVksQ0FBQyxFQUE1QyxDQUE0QyxDQUNoRSxDQUFDO0FBRUYsSUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFrQixNQUFNLEVBQUUsWUFBWSxFQUFFO0lBQzlELFlBQVksRUFBRSxNQUFNO0lBQ3BCLFlBQVksRUFBRSxNQUFNO0lBQ3BCLHVCQUF1QixFQUFFLE1BQU07SUFDL0IsdUJBQXVCLEVBQUUsTUFBTTtDQUMvQixDQUFDLENBQUM7QUFxQkgsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU07O0lBQ2QsSUFBTSxJQUFJLEdBQStCLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRTFFLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRztRQUN6QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxFQUFFO1FBQ25DLGVBQWUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQUEsSUFBSSxDQUFDLElBQUksbUNBQUksV0FBVyxDQUFDO0tBQ3RELENBQUM7SUFFRixJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7SUFFckMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNyRSxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssU0FBUztRQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUNwRixJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssU0FBUztRQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUNsRSxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDekIsSUFBSSxNQUFNLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtZQUNuQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1NBQ3ZFO2FBQU07WUFDTixJQUFJLENBQUMsVUFBVSxHQUFHO2dCQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPO2dCQUNyQyxlQUFlLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxtQ0FBSSxXQUFXLENBQUM7Z0JBQ3RFLHNCQUFzQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUk7Z0JBQ25ELFVBQVUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxVQUFVO2FBQzdDLENBQUM7U0FDRjtLQUNEO0FBQ0YsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07O0lBQ2QsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLGdCQUFpQixDQUFDO0lBQ3RDLElBQU0sSUFBSSxHQUErQixFQUFFLENBQUM7SUFFNUMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUU7UUFDOUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7S0FDakI7U0FBTTtRQUNOLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNwRSxJQUFJLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQyxDQUFDLFlBQVk7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQUEsSUFBSSxDQUFDLGNBQWMsbUNBQUksU0FBUyxDQUFDO0tBQ2hEO0lBRUQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUU5QyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQjtRQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztJQUUxRSxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO0lBQzlDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsSUFBSSxFQUFFLENBQUM7SUFFMUMsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLFNBQVMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ3BELElBQUksQ0FBQyxlQUFlLEdBQUc7WUFDdEIsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLEVBQUU7WUFDdEMsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUM7WUFDbEQsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLHNCQUFzQjtZQUM5QyxVQUFVLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVTtTQUN4QyxDQUFDO0tBQ0Y7U0FBTTtRQUNOLElBQUksQ0FBQyxlQUFlLEdBQUc7WUFDdEIsSUFBSSxFQUFFLENBQUEsTUFBQSxJQUFJLENBQUMsVUFBVSwwQ0FBRSxPQUFPLEVBQUMsQ0FBQyxDQUFDLGtCQUFnQixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQVMsQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1NBQ3JHLENBQUM7S0FDRjtJQUVELHlCQUF5QixDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzVELENBQUMsQ0FDRCxDQUFDO0FBRUYsYUFBYSxJQUFJLFVBQVUsQ0FDMUIsSUFBSSxFQUFFLGNBQWM7QUFDcEIsVUFETSxjQUFjO0FBQ3BCLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFyQyxDQUFxQyxFQUMvQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixpQkFBaUIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0QsTUFBYyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFFcEQsUUFBUTtJQUNSLGlEQUFpRDtJQUNqRCx1RUFBdUU7QUFDeEUsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxVQUFVLENBQUMsTUFBTSxFQUFHLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0QsQ0FBQztBQUVGLFVBQVUsQ0FDVCxJQUFJLEVBQ0osVUFBQSxNQUFNLElBQUksT0FBQSxNQUFNLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBbkMsQ0FBbUMsRUFDN0MsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sb0JBQW9CLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEQsSUFBTSx3QkFBd0IsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEQsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3JDLElBQU0sa0JBQWtCLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEQsSUFBTSxzQkFBc0IsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEQsSUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRXRDLE1BQU0sQ0FBQyxjQUFjLEdBQUc7UUFDdkIsb0JBQW9CLHNCQUFBO1FBQ3BCLHdCQUF3QixFQUFFLGdCQUFnQixDQUFDLHdCQUF3QixDQUFDLElBQUksS0FBWTtRQUNwRixTQUFTLEVBQUUsaUJBQWlCLENBQUMsU0FBUyxDQUFDLElBQUksUUFBZTtRQUMxRCxrQkFBa0Isb0JBQUE7UUFDbEIsc0JBQXNCLEVBQUUsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMsSUFBSSxLQUFZO1FBQ2hGLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxRQUFlO0tBQzVELENBQUM7QUFDSCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxjQUFlLENBQUM7SUFFcEMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUYsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1RSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3hELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4RixXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlFLENBQUMsQ0FDRCxDQUFDO0FBRUYsSUFBTSxnQkFBZ0IsR0FBRyxDQUFDLFVBQVUsRUFBRSxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFFckUsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUEvQixDQUErQixFQUN6QyxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxDQUFDLFVBQVUsR0FBRztRQUNuQixLQUFLLEVBQUUsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFRO1FBQ2pELENBQUMsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDO1FBQ3RCLENBQUMsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDO1FBQ3RCLEtBQUssRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDO0tBQzFCLENBQUM7QUFDSCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNSLElBQUEsS0FBeUIsTUFBTSxDQUFDLFVBQVcsRUFBekMsS0FBSyxXQUFBLEVBQUUsQ0FBQyxPQUFBLEVBQUUsQ0FBQyxPQUFBLEVBQUUsS0FBSyxXQUF1QixDQUFDO0lBQ2xELFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEtBQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNsRSxZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3QixZQUFZLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3QixZQUFZLENBQUMsTUFBTSxFQUFFLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQ0QsQ0FBQztBQUVGLFVBQVUsQ0FDVCxJQUFJLEVBQ0osVUFBQSxNQUFNLElBQUksT0FBQSxNQUFNLENBQUMsaUJBQWlCLEtBQUssU0FBUyxFQUF0QyxDQUFzQyxFQUNoRCxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixNQUFNLENBQUMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDO0lBRTlCLE9BQU8sSUFBSSxFQUFFLEVBQUU7UUFDZCxJQUFNLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNyQztBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsS0FBbUIsVUFBeUIsRUFBekIsS0FBQSxNQUFNLENBQUMsaUJBQWtCLEVBQXpCLGNBQXlCLEVBQXpCLElBQXlCLEVBQUU7UUFBekMsSUFBTSxNQUFJLFNBQUE7UUFDZCxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsTUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ25DO0FBQ0YsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLGlCQUFpQixLQUFLLFNBQVMsRUFBdEMsQ0FBc0MsRUFDaEQsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUk7SUFDcEIsTUFBTSxDQUFDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUU5QixPQUFPLElBQUksRUFBRSxFQUFFO1FBQ2QsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3pEO0FBQ0YsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxLQUFtQixVQUF5QixFQUF6QixLQUFBLE1BQU0sQ0FBQyxpQkFBa0IsRUFBekIsY0FBeUIsRUFBekIsSUFBeUIsRUFBRTtRQUF6QyxJQUFNLE1BQUksU0FBQTtRQUNkLDZCQUE2QixDQUFDLE1BQU0sRUFBRSxNQUFJLENBQUMsQ0FBQztLQUM1QztBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsYUFBYSxJQUFJLFVBQVUsQ0FDMUIsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUMsTUFBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRCxNQUFjLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUcsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUM7SUFFN0IsT0FBTyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7UUFDbkIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNqRDtBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsS0FBaUIsVUFBd0IsRUFBeEIsS0FBQSxNQUFNLENBQUMsZ0JBQWlCLEVBQXhCLGNBQXdCLEVBQXhCLElBQXdCLEVBQUU7UUFBdEMsSUFBTSxFQUFFLFNBQUE7UUFDWixXQUFXLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQ3hCO0FBQ0YsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLGVBQWUsS0FBSyxTQUFTLEVBQXBDLENBQW9DLEVBQzlDLFVBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSyxPQUFBLE1BQU0sQ0FBQyxlQUFlLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxFQUExQyxDQUEwQyxFQUM5RCxVQUFDLE1BQU0sRUFBRSxNQUFNLElBQUssT0FBQSxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxlQUFnQixDQUFDLEVBQTNDLENBQTJDLENBQy9ELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQWhDLENBQWdDLEVBQzFDLFVBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSyxPQUFBLE1BQU0sQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUF2QyxDQUF1QyxFQUMzRCxVQUFDLE1BQU0sRUFBRSxNQUFNLElBQUssT0FBQSxXQUFXLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxXQUFZLENBQUMsRUFBeEMsQ0FBd0MsQ0FDNUQsQ0FBQztBQUVGLFVBQVUsQ0FDVCxJQUFJLEVBQ0osVUFBQSxNQUFNLElBQUksT0FBQSxNQUFNLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBbkMsQ0FBbUMsRUFDN0MsVUFBQyxNQUFNLEVBQUUsTUFBTSxJQUFLLE9BQUEsTUFBTSxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQTFDLENBQTBDLEVBQzlELFVBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSyxPQUFBLFdBQVcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLGNBQWUsQ0FBQyxFQUEzQyxDQUEyQyxDQUMvRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUEvQixDQUErQixFQUN6QyxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxDQUFDLFVBQVUsR0FBRztRQUNuQixNQUFNLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDM0IsU0FBUyxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQzlCLFNBQVMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUM5QixpQkFBaUIsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUN0QyxRQUFRLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDN0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ3pCLFdBQVcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNoQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDNUIsVUFBVSxFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO0tBQy9CLENBQUM7QUFDSCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxVQUFXLENBQUM7SUFDakMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QyxVQUFVLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2QyxVQUFVLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxDQUFDLENBQ0QsQ0FBQztBQUVGLGFBQWEsSUFBSSxVQUFVLENBQzFCLEtBQUssRUFBRSxjQUFjO0FBQ3JCLFVBRE8sY0FBYztBQUNyQixNQUFNLElBQUksT0FBQyxNQUFjLENBQUMsUUFBUSxLQUFLLFNBQVMsRUFBdEMsQ0FBc0MsRUFDaEQsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUk7SUFDcEIsaUJBQWlCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2hFLE1BQWMsQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsVUFBVSxDQUFDLE1BQU0sRUFBRyxNQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUNELENBQUM7QUFFRixhQUFhLElBQUksVUFBVSxDQUMxQixJQUFJLEVBQUUsbUJBQW1CO0FBQ3pCLFVBRE0sbUJBQW1CO0FBQ3pCLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFyQyxDQUFxQyxFQUMvQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixpQkFBaUIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0QsTUFBYyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDckQsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxVQUFVLENBQUMsTUFBTSxFQUFHLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0QsQ0FBQztBQUVGLGFBQWEsSUFBSSxVQUFVLENBQzFCLElBQUksRUFBRSwyQkFBMkI7QUFDakMsVUFETSwyQkFBMkI7QUFDakMsTUFBTSxJQUFJLE9BQUMsTUFBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRCxNQUFjLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUcsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUEvQixDQUErQixFQUN6QyxVQUFDLE1BQU0sRUFBRSxNQUFNLElBQUssT0FBQSxNQUFNLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBdEMsQ0FBc0MsRUFDMUQsVUFBQyxNQUFNLEVBQUUsTUFBTSxJQUFLLE9BQUEsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVyxDQUFDLEVBQXZDLENBQXVDLENBQzNELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQWhDLENBQWdDLEVBQzFDLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO0lBRXhCLE9BQU8sSUFBSSxFQUFFLEVBQUU7UUFDZCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUM1QztBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsS0FBZ0IsVUFBbUIsRUFBbkIsS0FBQSxNQUFNLENBQUMsV0FBWSxFQUFuQixjQUFtQixFQUFuQixJQUFtQixFQUFFO1FBQWhDLElBQU0sQ0FBQyxTQUFBO1FBQ1gsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN2QjtBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxvQkFBb0IsS0FBSyxTQUFTLEVBQXpDLENBQXlDLEVBQ25ELFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxvQkFBb0IsR0FBRyxFQUFFLENBQUM7SUFFakMsT0FBTyxJQUFJLEVBQUUsRUFBRTtRQUNkLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7S0FDcEQ7QUFDRixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLEtBQWlCLFVBQTRCLEVBQTVCLEtBQUEsTUFBTSxDQUFDLG9CQUFxQixFQUE1QixjQUE0QixFQUE1QixJQUE0QixFQUFFO1FBQTFDLElBQU0sRUFBRSxTQUFBO1FBQ1osVUFBVSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztLQUN2QjtBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxpQkFBaUIsS0FBSyxTQUFTLEVBQXRDLENBQXNDLEVBQ2hELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxJQUFJLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0IsTUFBTSxDQUFDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztJQUU5QixPQUFPLEtBQUssRUFBRSxFQUFFO1FBQ2YsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztLQUNsRDtBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsaUJBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFdEQsS0FBaUIsVUFBeUIsRUFBekIsS0FBQSxNQUFNLENBQUMsaUJBQWtCLEVBQXpCLGNBQXlCLEVBQXpCLElBQXlCLEVBQUU7UUFBdkMsSUFBTSxFQUFFLFNBQUE7UUFDWixXQUFXLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQ3hCO0FBQ0YsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsSUFBSSxFQUNKLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLHdCQUF3QixLQUFLLFNBQVMsRUFBN0MsQ0FBNkMsRUFDdkQsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQyxJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEMsSUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BDLElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVqQyxJQUFJLE9BQU8sS0FBSyxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBa0MsT0FBUyxDQUFDLENBQUM7SUFFaEYsTUFBTSxDQUFDLHdCQUF3QixHQUFHO1FBQ2pDLElBQUksRUFBRSxFQUFFLFVBQVUsWUFBQSxFQUFFLFFBQVEsVUFBQSxFQUFFO1FBQzlCLE1BQU0sRUFBRSxFQUFFO0tBQ1YsQ0FBQztJQUVGLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0IsTUFBTSxDQUFDLHdCQUF3QixDQUFDLE1BQU8sQ0FBQyxJQUFJLENBQUM7WUFDNUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFO1lBQ2pDLFNBQVMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsVUFBVTtTQUN4RCxDQUFDLENBQUM7S0FDSDtBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLHdCQUF5QixDQUFDO0lBQzlDLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxVQUFVLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDO0lBQ3JFLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDO0lBRWpDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdkIsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDckMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkMsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFbkMsS0FBZ0IsVUFBTSxFQUFOLGlCQUFNLEVBQU4sb0JBQU0sRUFBTixJQUFNLEVBQUU7UUFBbkIsSUFBTSxDQUFDLGVBQUE7UUFDWCxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDckMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsU0FBUyxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6RDtBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUE3QixDQUE2QixFQUN2QyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE9BQU87SUFDMUIsSUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpDLElBQUksS0FBSyxFQUFFO1FBQ1YsSUFBSSxDQUFDLE9BQU8sQ0FBQyx1QkFBdUI7WUFBRSxPQUFPO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztLQUM3QztJQUVELDZCQUE2QjtJQUM3QixNQUFNLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztBQUN0QixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFdBQVcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFFBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUU3Qyw4QkFBOEI7SUFDOUIsSUFBSSxNQUFNLENBQUMsUUFBUyxDQUFDLE1BQU0sRUFBRTtRQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7S0FDN0M7QUFDRixDQUFDLENBQ0QsQ0FBQztBQUVGLGFBQWEsSUFBSSxVQUFVLENBQzFCLElBQUksRUFBRSxTQUFTO0FBQ2YsVUFETSxTQUFTO0FBQ2YsTUFBTSxJQUFJLE9BQUMsTUFBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRCxNQUFjLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUcsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO0lBQ2hGLE1BQU0sQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztBQUMzRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVO0lBQ2xDLFlBQVksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLGdCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZELENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxrQkFBa0IsS0FBSyxTQUFTLEVBQXZDLENBQXVDLEVBQ2pELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxNQUFNLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNqRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELENBQUMsQ0FDRCxDQUFDO0FBRUYsYUFBYSxJQUFJLFVBQVUsQ0FDMUIsSUFBSSxFQUFFLGNBQWM7QUFDcEIsVUFETSxjQUFjO0FBQ3BCLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFyQyxDQUFxQyxFQUMvQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixpQkFBaUIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0QsTUFBYyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDckQsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxVQUFVLENBQUMsTUFBTSxFQUFHLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0QsQ0FBQztBQUVGLFVBQVUsQ0FDVCxJQUFJLEVBQ0osVUFBQSxNQUFNLElBQUksT0FBQSxNQUFNLENBQUMsYUFBYSxLQUFLLFNBQVMsRUFBbEMsQ0FBa0MsRUFDNUMsVUFBQyxNQUFNLEVBQUUsTUFBTSxJQUFLLE9BQUEsTUFBTSxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQXpDLENBQXlDLEVBQzdELFVBQUMsTUFBTSxFQUFFLE1BQU0sSUFBSyxPQUFBLFdBQVcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLGFBQWMsQ0FBQyxFQUExQyxDQUEwQyxDQUM5RCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxTQUFTLEtBQUssU0FBUyxJQUFJLE1BQU0sQ0FBQyxZQUFZLEtBQUssU0FBUyxFQUFuRSxDQUFtRSxFQUM3RSxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU87SUFDN0IsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsNEJBQTRCO0lBQy9ELElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxJQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsdURBQXVEO0lBQzNFLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLDJDQUEyQztJQUMvRCxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyx1QkFBdUI7SUFDM0MsSUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSztJQUM5QyxJQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJO0lBRXZDLElBQUksTUFBTSxLQUFLLENBQUMsSUFBSSxZQUFZLEtBQUssRUFBRSxJQUFJLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDeEQsT0FBTyxDQUFDLGtCQUFrQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUNBQW1DLE1BQU0sd0JBQW1CLFlBQVksa0JBQWEsTUFBTSxNQUFHLENBQUMsQ0FBQztRQUMxSSxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDMUIsT0FBTztLQUNQO0lBRUQsSUFBTSxJQUFJLEdBQUcsSUFBSSxFQUFFLENBQUM7SUFDcEIsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUVyQyxJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUU7UUFDNUIsTUFBTSxDQUFDLFlBQVksR0FBRyxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLENBQUM7S0FDOUM7U0FBTTtRQUNOLE1BQU0sQ0FBQyxTQUFTLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDOUM7QUFDRixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNmLElBQUksSUFBZ0IsQ0FBQztJQUVyQixJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQUU7UUFDeEIsS0FBSyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBQ2xDLE1BQU0sR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztRQUNwQyxJQUFJLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7S0FDaEM7U0FBTTtRQUNOLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUM1RCxLQUFLLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7UUFDL0IsTUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ2pDLElBQUksR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3pHO0lBRUQsSUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO0lBQ3hCLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLEdBQUcsWUFBWSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNwRSxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDakIsSUFBTSxTQUFTLEdBQUcsVUFBVSxHQUFHLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDL0MsSUFBTSxvQkFBb0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBRXpDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxlQUFlO0lBQ3ZDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0IsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1QixXQUFXLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2hDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDL0IsV0FBVyxDQUFDLE1BQU0sRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQzFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDbEMsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1QixVQUFVLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzFCLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxXQUFXLEtBQUssU0FBUyxFQUFoQyxDQUFnQyxFQUMxQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkMsSUFBSSxPQUFPLEtBQUssQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztJQUVsRSxNQUFNLENBQUMsV0FBVyxHQUFHO1FBQ3BCLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ3RDLFVBQVUsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUM7UUFDckMsVUFBVSxFQUFFLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztRQUNyQyxXQUFXLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztLQUMvQixDQUFDO0lBRUYsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVksQ0FBQztJQUN4QyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVTtJQUNsQyxVQUFVLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRCxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25ELGtCQUFrQixDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbkQsV0FBVyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDOUMsQ0FBQyxDQUNELENBQUM7QUFFRixhQUFhLElBQUksVUFBVSxDQUMxQixJQUFJLEVBQUUsZUFBZTtBQUNyQixVQURNLGVBQWU7QUFDckIsTUFBTSxJQUFJLE9BQUMsTUFBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRCxNQUFjLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUcsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxtQkFBbUIsS0FBSyxTQUFTLEVBQXhDLENBQXdDLEVBQ2xELFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxtQkFBbUIsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDN0QsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxlQUFlLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxtQkFBb0IsQ0FBQyxDQUFDO0FBQ3RELENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxrQkFBa0IsS0FBSyxTQUFTLEVBQXZDLENBQXVDLEVBQ2pELFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxrQkFBa0IsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDNUQsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxlQUFlLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxrQkFBbUIsQ0FBQyxDQUFDO0FBQ3JELENBQUMsQ0FDRCxDQUFDO0FBTUYsVUFBVSxDQUNULElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxrQkFBa0IsS0FBSyxTQUFTLEVBQXZDLENBQXVDLEVBQ2pELFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxLQUFLO0lBQ3JCLElBQU0sSUFBSSxHQUFtQix3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5RCwrREFBK0Q7SUFDL0QsTUFBTSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMxQyxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sSUFBSSxHQUFtQixFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsa0JBQW1CLEVBQUUsQ0FBQztJQUNwRSx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNyRCxDQUFDLENBQ0QsQ0FBQztBQUVGLGFBQWEsSUFBSSxVQUFVLENBQzFCLElBQUksRUFDSixVQUFBLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFyQyxDQUFxQyxFQUMvQyxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixpQkFBaUIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0QsTUFBYyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDckQsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxVQUFVLENBQUMsTUFBTSxFQUFHLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0QsQ0FBQztBQUVGLElBQU0sSUFBSSxHQUFHLFVBQVUsQ0FBOEIsTUFBTSxFQUFFLEVBQUUsRUFBRTtJQUNoRSxJQUFJLEVBQUUsTUFBTTtJQUNaLElBQUksRUFBRSxNQUFNO0lBQ1osT0FBTyxFQUFFLE1BQU07Q0FDZixDQUFDLENBQUM7QUErQkgsbUJBQW1CO0FBQ25CLGFBQWEsSUFBSSxVQUFVLENBQzFCLElBQUksRUFBRSxzQkFBc0I7QUFDNUIsVUFETSxzQkFBc0I7QUFDNUIsTUFBTSxJQUFJLE9BQUMsTUFBYyxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQXJDLENBQXFDLEVBQy9DLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBc0M7UUFBcEMsa0JBQWtCLHdCQUFBLEVBQUUsY0FBYyxvQkFBQTtJQUMxRCxJQUFJLGFBQWEsRUFBRTtRQUNsQixpQkFBaUIsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDL0QsTUFBYyxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDcEQsT0FBTztLQUNQO0lBRUQsSUFBTSxHQUFHLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWxDLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtRQUNuQixjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLFVBQUEsSUFBSTs7Z0JBRXpCLGNBQWMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQy9CLElBQU0sS0FBRyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFbEMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO29CQUMxQixJQUFJLEtBQUcsS0FBSyxNQUFNLEVBQUU7d0JBQ25CLElBQU0sSUFBSSxHQUFHLHdCQUF3QixDQUFDLE1BQU0sQ0FBd0IsQ0FBQzt3QkFDckUsNkJBQTZCO3dCQUM3QixjQUFjLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7d0JBQ2xELCtGQUErRjt3QkFFL0YsSUFBTSxNQUFNLEdBQWU7NEJBQzFCLGdCQUFnQjs0QkFDaEIsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQztnQ0FDM0IsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJO2dDQUNWLEtBQUssRUFBRSxDQUFDLENBQUMsSUFBSSxHQUFHLEdBQUc7Z0NBQ25CLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLGtCQUFrQjtnQ0FDbEUsYUFBYTs2QkFDYixDQUFDLEVBTHlCLENBS3pCLENBQUM7NEJBQ0gsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQztnQ0FDL0IsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJO2dDQUNWLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSTtnQ0FDZCxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUk7Z0NBQ2YsYUFBYTs2QkFDYixDQUFDLEVBTDZCLENBSzdCLENBQUM7eUJBQ0gsQ0FBQzt3QkFFRixjQUFjLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsQ0FBQzt3QkFDM0Qsd0dBQXdHO3FCQUN4Rzt5QkFBTSxJQUFJLEtBQUcsS0FBSyxNQUFNLEVBQUU7d0JBQzFCLElBQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQzt3QkFDeEMsY0FBYyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUNuRDt5QkFBTTt3QkFDTixrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLCtCQUErQixFQUFFLEtBQUcsQ0FBQyxDQUFDO3FCQUN4RTtnQkFDRixDQUFDLENBQUMsQ0FBQzs7WUFuQ0osT0FBTyxJQUFJLEVBQUU7O2FBb0NaO1FBQ0YsQ0FBQyxDQUFDLENBQUM7S0FDSDtTQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtRQUMxQixJQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDeEMsY0FBYyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO0tBQ25EO1NBQU07UUFDTixrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2xFLE9BQU87S0FDUDtBQUNGLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsVUFBVSxDQUFDLE1BQU0sRUFBRyxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDN0MsQ0FBQyxDQUNELENBQUM7QUFFRixtQkFBbUI7QUFDbkIsYUFBYSxJQUFJLFVBQVUsQ0FDMUIsSUFBSSxFQUFFLHNCQUFzQjtBQUM1QixVQURNLHNCQUFzQjtBQUM1QixNQUFNLElBQUksT0FBQyxNQUFjLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBckMsQ0FBcUMsRUFDL0MsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFzQztRQUFwQyxrQkFBa0Isd0JBQUEsRUFBRSxjQUFjLG9CQUFBO0lBQzFELElBQUksYUFBYSxFQUFFO1FBQ2xCLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRCxNQUFjLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwRCxPQUFPO0tBQ1A7SUFFRCxJQUFNLEdBQUcsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFbEMsSUFBSSxHQUFHLEtBQUssTUFBTSxFQUFFO1FBQ25CLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxJQUFJLE9BQU8sS0FBSyxDQUFDO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRTNELElBQU0sUUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsQyxJQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQU0sQ0FBQyxDQUFDO1FBQ3hDLGNBQWMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztLQUM3QztTQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtRQUMxQixJQUFNLElBQUksR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5QyxjQUFjLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDNUM7U0FBTTtRQUNOLGtCQUFrQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLEVBQUUsR0FBRyxDQUFDLENBQUM7S0FDakU7QUFDRixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUcsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLENBQUMsQ0FDRCxDQUFDIiwiZmlsZSI6ImltYWdlUmVzb3VyY2VzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9CeXRlQXJyYXkgfSBmcm9tICdiYXNlNjQtanMnO1xyXG5pbXBvcnQgeyBJbWFnZVJlc291cmNlcywgUmVhZE9wdGlvbnMsIFJlbmRlcmluZ0ludGVudCB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRQc2RSZWFkZXIsIHJlYWRQYXNjYWxTdHJpbmcsIHJlYWRVbmljb2RlU3RyaW5nLCByZWFkVWludDMyLCByZWFkVWludDE2LCByZWFkVWludDgsIHJlYWRGbG9hdDY0LFxyXG5cdHJlYWRCeXRlcywgc2tpcEJ5dGVzLCByZWFkRmxvYXQzMiwgcmVhZEludDE2LCByZWFkRml4ZWRQb2ludDMyLCByZWFkU2lnbmF0dXJlLCBjaGVja1NpZ25hdHVyZSxcclxuXHRyZWFkU2VjdGlvbiwgcmVhZENvbG9yXHJcbn0gZnJvbSAnLi9wc2RSZWFkZXInO1xyXG5pbXBvcnQge1xyXG5cdFBzZFdyaXRlciwgd3JpdGVQYXNjYWxTdHJpbmcsIHdyaXRlVW5pY29kZVN0cmluZywgd3JpdGVVaW50MzIsIHdyaXRlVWludDgsIHdyaXRlRmxvYXQ2NCwgd3JpdGVVaW50MTYsXHJcblx0d3JpdGVCeXRlcywgd3JpdGVJbnQxNiwgd3JpdGVGbG9hdDMyLCB3cml0ZUZpeGVkUG9pbnQzMiwgd3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcsIHdyaXRlQ29sb3IsXHJcbn0gZnJvbSAnLi9wc2RXcml0ZXInO1xyXG5pbXBvcnQgeyBjcmVhdGVDYW52YXNGcm9tRGF0YSwgY3JlYXRlRW51bSwgTU9DS19IQU5ETEVSUyB9IGZyb20gJy4vaGVscGVycyc7XHJcbmltcG9ydCB7IGRlY29kZVN0cmluZywgZW5jb2RlU3RyaW5nIH0gZnJvbSAnLi91dGY4JztcclxuaW1wb3J0IHsgcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yLCB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yIH0gZnJvbSAnLi9kZXNjcmlwdG9yJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2VIYW5kbGVyIHtcclxuXHRrZXk6IG51bWJlcjtcclxuXHRoYXM6ICh0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiBib29sZWFuO1xyXG5cdHJlYWQ6IChyZWFkZXI6IFBzZFJlYWRlciwgdGFyZ2V0OiBJbWFnZVJlc291cmNlcywgbGVmdDogKCkgPT4gbnVtYmVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucykgPT4gdm9pZDtcclxuXHR3cml0ZTogKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiB2b2lkO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgcmVzb3VyY2VIYW5kbGVyczogUmVzb3VyY2VIYW5kbGVyW10gPSBbXTtcclxuZXhwb3J0IGNvbnN0IHJlc291cmNlSGFuZGxlcnNNYXA6IHsgW2tleTogbnVtYmVyXTogUmVzb3VyY2VIYW5kbGVyIH0gPSB7fTtcclxuXHJcbmZ1bmN0aW9uIGFkZEhhbmRsZXIoXHJcblx0a2V5OiBudW1iZXIsXHJcblx0aGFzOiAodGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gYm9vbGVhbixcclxuXHRyZWFkOiAocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMsIGxlZnQ6ICgpID0+IG51bWJlciwgb3B0aW9uczogUmVhZE9wdGlvbnMpID0+IHZvaWQsXHJcblx0d3JpdGU6ICh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gdm9pZCxcclxuKSB7XHJcblx0Y29uc3QgaGFuZGxlcjogUmVzb3VyY2VIYW5kbGVyID0geyBrZXksIGhhcywgcmVhZCwgd3JpdGUgfTtcclxuXHRyZXNvdXJjZUhhbmRsZXJzLnB1c2goaGFuZGxlcik7XHJcblx0cmVzb3VyY2VIYW5kbGVyc01hcFtoYW5kbGVyLmtleV0gPSBoYW5kbGVyO1xyXG59XHJcblxyXG5jb25zdCBMT0dfTU9DS19IQU5ETEVSUyA9IGZhbHNlO1xyXG5jb25zdCBSRVNPTFVUSU9OX1VOSVRTID0gW3VuZGVmaW5lZCwgJ1BQSScsICdQUENNJ107XHJcbmNvbnN0IE1FQVNVUkVNRU5UX1VOSVRTID0gW3VuZGVmaW5lZCwgJ0luY2hlcycsICdDZW50aW1ldGVycycsICdQb2ludHMnLCAnUGljYXMnLCAnQ29sdW1ucyddO1xyXG5jb25zdCBoZXggPSAnMDEyMzQ1Njc4OWFiY2RlZic7XHJcblxyXG5mdW5jdGlvbiBjaGFyVG9OaWJibGUoY29kZTogbnVtYmVyKSB7XHJcblx0cmV0dXJuIGNvZGUgPD0gNTcgPyBjb2RlIC0gNDggOiBjb2RlIC0gODc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ5dGVBdCh2YWx1ZTogc3RyaW5nLCBpbmRleDogbnVtYmVyKSB7XHJcblx0cmV0dXJuIChjaGFyVG9OaWJibGUodmFsdWUuY2hhckNvZGVBdChpbmRleCkpIDw8IDQpIHwgY2hhclRvTmliYmxlKHZhbHVlLmNoYXJDb2RlQXQoaW5kZXggKyAxKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRVdGY4U3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0cmV0dXJuIGRlY29kZVN0cmluZyhidWZmZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVV0ZjhTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBzdHJpbmcpIHtcclxuXHRjb25zdCBidWZmZXIgPSBlbmNvZGVTdHJpbmcodmFsdWUpO1xyXG5cdHdyaXRlQnl0ZXMod3JpdGVyLCBidWZmZXIpO1xyXG59XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAyOCwgLy8gSVBUQy1OQUEgcmVjb3JkXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDI4ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAyOCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAyOCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAyOCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2MSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmNhcHRpb25EaWdlc3QgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCBjYXB0aW9uRGlnZXN0ID0gJyc7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XHJcblx0XHRcdGNvbnN0IGJ5dGUgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Y2FwdGlvbkRpZ2VzdCArPSBoZXhbYnl0ZSA+PiA0XTtcclxuXHRcdFx0Y2FwdGlvbkRpZ2VzdCArPSBoZXhbYnl0ZSAmIDB4Zl07XHJcblx0XHR9XHJcblxyXG5cdFx0dGFyZ2V0LmNhcHRpb25EaWdlc3QgPSBjYXB0aW9uRGlnZXN0O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGJ5dGVBdCh0YXJnZXQuY2FwdGlvbkRpZ2VzdCEsIGkgKiAyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2MCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnhtcE1ldGFkYXRhICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB0YXJnZXQueG1wTWV0YWRhdGEgPSByZWFkVXRmOFN0cmluZyhyZWFkZXIsIGxlZnQoKSksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVV0ZjhTdHJpbmcod3JpdGVyLCB0YXJnZXQueG1wTWV0YWRhdGEhKSxcclxuKTtcclxuXHJcbmNvbnN0IEludGUgPSBjcmVhdGVFbnVtPFJlbmRlcmluZ0ludGVudD4oJ0ludGUnLCAncGVyY2VwdHVhbCcsIHtcclxuXHQncGVyY2VwdHVhbCc6ICdJbWcgJyxcclxuXHQnc2F0dXJhdGlvbic6ICdHcnAgJyxcclxuXHQncmVsYXRpdmUgY29sb3JpbWV0cmljJzogJ0Nscm0nLFxyXG5cdCdhYnNvbHV0ZSBjb2xvcmltZXRyaWMnOiAnQUNscicsXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIFByaW50SW5mb3JtYXRpb25EZXNjcmlwdG9yIHtcclxuXHQnTm0gICc/OiBzdHJpbmc7XHJcblx0Q2xyUz86IHN0cmluZztcclxuXHRQc3RTPzogYm9vbGVhbjtcclxuXHRNcEJsPzogYm9vbGVhbjtcclxuXHRJbnRlPzogc3RyaW5nO1xyXG5cdGhhcmRQcm9vZj86IGJvb2xlYW47XHJcblx0cHJpbnRTaXh0ZWVuQml0PzogYm9vbGVhbjtcclxuXHRwcmludGVyTmFtZT86IHN0cmluZztcclxuXHRwcmludFByb29mU2V0dXA/OiB7XHJcblx0XHRCbHRuOiBzdHJpbmc7XHJcblx0fSB8IHtcclxuXHRcdHByb2ZpbGU6IHN0cmluZztcclxuXHRcdEludGU6IHN0cmluZztcclxuXHRcdE1wQmw6IGJvb2xlYW47XHJcblx0XHRwYXBlcldoaXRlOiBib29sZWFuO1xyXG5cdH07XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA4MixcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnByaW50SW5mb3JtYXRpb24gIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2M6IFByaW50SW5mb3JtYXRpb25EZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblxyXG5cdFx0dGFyZ2V0LnByaW50SW5mb3JtYXRpb24gPSB7XHJcblx0XHRcdHByaW50ZXJOYW1lOiBkZXNjLnByaW50ZXJOYW1lIHx8ICcnLFxyXG5cdFx0XHRyZW5kZXJpbmdJbnRlbnQ6IEludGUuZGVjb2RlKGRlc2MuSW50ZSA/PyAnSW50ZS5JbWcgJyksXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQucHJpbnRJbmZvcm1hdGlvbjtcclxuXHJcblx0XHRpZiAoZGVzYy5Qc3RTICE9PSB1bmRlZmluZWQpIGluZm8ucHJpbnRlck1hbmFnZXNDb2xvcnMgPSBkZXNjLlBzdFM7XHJcblx0XHRpZiAoZGVzY1snTm0gICddICE9PSB1bmRlZmluZWQpIGluZm8ucHJpbnRlclByb2ZpbGUgPSBkZXNjWydObSAgJ107XHJcblx0XHRpZiAoZGVzYy5NcEJsICE9PSB1bmRlZmluZWQpIGluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbiA9IGRlc2MuTXBCbDtcclxuXHRcdGlmIChkZXNjLnByaW50U2l4dGVlbkJpdCAhPT0gdW5kZWZpbmVkKSBpbmZvLnByaW50U2l4dGVlbkJpdCA9IGRlc2MucHJpbnRTaXh0ZWVuQml0O1xyXG5cdFx0aWYgKGRlc2MuaGFyZFByb29mICE9PSB1bmRlZmluZWQpIGluZm8uaGFyZFByb29mID0gZGVzYy5oYXJkUHJvb2Y7XHJcblx0XHRpZiAoZGVzYy5wcmludFByb29mU2V0dXApIHtcclxuXHRcdFx0aWYgKCdCbHRuJyBpbiBkZXNjLnByaW50UHJvb2ZTZXR1cCkge1xyXG5cdFx0XHRcdGluZm8ucHJvb2ZTZXR1cCA9IHsgYnVpbHRpbjogZGVzYy5wcmludFByb29mU2V0dXAuQmx0bi5zcGxpdCgnLicpWzFdIH07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aW5mby5wcm9vZlNldHVwID0ge1xyXG5cdFx0XHRcdFx0cHJvZmlsZTogZGVzYy5wcmludFByb29mU2V0dXAucHJvZmlsZSxcclxuXHRcdFx0XHRcdHJlbmRlcmluZ0ludGVudDogSW50ZS5kZWNvZGUoZGVzYy5wcmludFByb29mU2V0dXAuSW50ZSA/PyAnSW50ZS5JbWcgJyksXHJcblx0XHRcdFx0XHRibGFja1BvaW50Q29tcGVuc2F0aW9uOiAhIWRlc2MucHJpbnRQcm9vZlNldHVwLk1wQmwsXHJcblx0XHRcdFx0XHRwYXBlcldoaXRlOiAhIWRlc2MucHJpbnRQcm9vZlNldHVwLnBhcGVyV2hpdGUsXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LnByaW50SW5mb3JtYXRpb24hO1xyXG5cdFx0Y29uc3QgZGVzYzogUHJpbnRJbmZvcm1hdGlvbkRlc2NyaXB0b3IgPSB7fTtcclxuXHJcblx0XHRpZiAoaW5mby5wcmludGVyTWFuYWdlc0NvbG9ycykge1xyXG5cdFx0XHRkZXNjLlBzdFMgPSB0cnVlO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aWYgKGluZm8uaGFyZFByb29mICE9PSB1bmRlZmluZWQpIGRlc2MuaGFyZFByb29mID0gISFpbmZvLmhhcmRQcm9vZjtcclxuXHRcdFx0ZGVzYy5DbHJTID0gJ0NsclMuUkdCQyc7IC8vIFRPRE86ID8/P1xyXG5cdFx0XHRkZXNjWydObSAgJ10gPSBpbmZvLnByaW50ZXJQcm9maWxlID8/ICdDSUUgUkdCJztcclxuXHRcdH1cclxuXHJcblx0XHRkZXNjLkludGUgPSBJbnRlLmVuY29kZShpbmZvLnJlbmRlcmluZ0ludGVudCk7XHJcblxyXG5cdFx0aWYgKCFpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzKSBkZXNjLk1wQmwgPSAhIWluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbjtcclxuXHJcblx0XHRkZXNjLnByaW50U2l4dGVlbkJpdCA9ICEhaW5mby5wcmludFNpeHRlZW5CaXQ7XHJcblx0XHRkZXNjLnByaW50ZXJOYW1lID0gaW5mby5wcmludGVyTmFtZSB8fCAnJztcclxuXHJcblx0XHRpZiAoaW5mby5wcm9vZlNldHVwICYmICdwcm9maWxlJyBpbiBpbmZvLnByb29mU2V0dXApIHtcclxuXHRcdFx0ZGVzYy5wcmludFByb29mU2V0dXAgPSB7XHJcblx0XHRcdFx0cHJvZmlsZTogaW5mby5wcm9vZlNldHVwLnByb2ZpbGUgfHwgJycsXHJcblx0XHRcdFx0SW50ZTogSW50ZS5lbmNvZGUoaW5mby5wcm9vZlNldHVwLnJlbmRlcmluZ0ludGVudCksXHJcblx0XHRcdFx0TXBCbDogISFpbmZvLnByb29mU2V0dXAuYmxhY2tQb2ludENvbXBlbnNhdGlvbixcclxuXHRcdFx0XHRwYXBlcldoaXRlOiAhIWluZm8ucHJvb2ZTZXR1cC5wYXBlcldoaXRlLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZGVzYy5wcmludFByb29mU2V0dXAgPSB7XHJcblx0XHRcdFx0Qmx0bjogaW5mby5wcm9vZlNldHVwPy5idWlsdGluID8gYGJ1aWx0aW5Qcm9vZi4ke2luZm8ucHJvb2ZTZXR1cC5idWlsdGlufWAgOiAnYnVpbHRpblByb29mLnByb29mQ01ZSycsXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAncHJpbnRPdXRwdXQnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwODMsIC8vIFByaW50IHN0eWxlXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDgzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA4MycsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA4MyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblxyXG5cdFx0Ly8gVE9ETzpcclxuXHRcdC8vIGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCcxMDgzJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA4Myk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAwNSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnJlc29sdXRpb25JbmZvICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBob3Jpem9udGFsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGhvcml6b250YWxSZXNvbHV0aW9uVW5pdCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IHdpZHRoVW5pdCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsUmVzb2x1dGlvblVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBoZWlnaHRVbml0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdHRhcmdldC5yZXNvbHV0aW9uSW5mbyA9IHtcclxuXHRcdFx0aG9yaXpvbnRhbFJlc29sdXRpb24sXHJcblx0XHRcdGhvcml6b250YWxSZXNvbHV0aW9uVW5pdDogUkVTT0xVVElPTl9VTklUU1tob3Jpem9udGFsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcclxuXHRcdFx0d2lkdGhVbml0OiBNRUFTVVJFTUVOVF9VTklUU1t3aWR0aFVuaXRdIHx8ICdJbmNoZXMnIGFzIGFueSxcclxuXHRcdFx0dmVydGljYWxSZXNvbHV0aW9uLFxyXG5cdFx0XHR2ZXJ0aWNhbFJlc29sdXRpb25Vbml0OiBSRVNPTFVUSU9OX1VOSVRTW3ZlcnRpY2FsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcclxuXHRcdFx0aGVpZ2h0VW5pdDogTUVBU1VSRU1FTlRfVU5JVFNbaGVpZ2h0VW5pdF0gfHwgJ0luY2hlcycgYXMgYW55LFxyXG5cdFx0fTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5yZXNvbHV0aW9uSW5mbyE7XHJcblxyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBpbmZvLmhvcml6b250YWxSZXNvbHV0aW9uIHx8IDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBSRVNPTFVUSU9OX1VOSVRTLmluZGV4T2YoaW5mby5ob3Jpem9udGFsUmVzb2x1dGlvblVuaXQpKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgubWF4KDEsIE1FQVNVUkVNRU5UX1VOSVRTLmluZGV4T2YoaW5mby53aWR0aFVuaXQpKSk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIGluZm8udmVydGljYWxSZXNvbHV0aW9uIHx8IDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBSRVNPTFVUSU9OX1VOSVRTLmluZGV4T2YoaW5mby52ZXJ0aWNhbFJlc29sdXRpb25Vbml0KSkpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBNRUFTVVJFTUVOVF9VTklUUy5pbmRleE9mKGluZm8uaGVpZ2h0VW5pdCkpKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgcHJpbnRTY2FsZVN0eWxlcyA9IFsnY2VudGVyZWQnLCAnc2l6ZSB0byBmaXQnLCAndXNlciBkZWZpbmVkJ107XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNjIsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wcmludFNjYWxlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQucHJpbnRTY2FsZSA9IHtcclxuXHRcdFx0c3R5bGU6IHByaW50U2NhbGVTdHlsZXNbcmVhZEludDE2KHJlYWRlcildIGFzIGFueSxcclxuXHRcdFx0eDogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0eTogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0c2NhbGU6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB7IHN0eWxlLCB4LCB5LCBzY2FsZSB9ID0gdGFyZ2V0LnByaW50U2NhbGUhO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgubWF4KDAsIHByaW50U2NhbGVTdHlsZXMuaW5kZXhPZihzdHlsZSEpKSk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB4IHx8IDApO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgeSB8fCAwKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHNjYWxlIHx8IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMDYsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHRcdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzLnB1c2godmFsdWUpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgdGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzISkge1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIG5hbWUsIDEpO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNDUsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHR0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMucHVzaChyZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyEpIHtcclxuXHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBuYW1lKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwNzcsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDc3ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA3NycsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA3NyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA3Nyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1MyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmFscGhhSWRlbnRpZmllcnMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hbHBoYUlkZW50aWZpZXJzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSA+PSA0KSB7XHJcblx0XHRcdHRhcmdldC5hbHBoYUlkZW50aWZpZXJzLnB1c2gocmVhZFVpbnQzMihyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBpZCBvZiB0YXJnZXQuYWxwaGFJZGVudGlmaWVycyEpIHtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpZCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAxMCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmJhY2tncm91bmRDb2xvciAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LmJhY2tncm91bmRDb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVDb2xvcih3cml0ZXIsIHRhcmdldC5iYWNrZ3JvdW5kQ29sb3IhKSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAzNyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmdsb2JhbEFuZ2xlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQuZ2xvYmFsQW5nbGUgPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5nbG9iYWxBbmdsZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDQ5LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuZ2xvYmFsQWx0aXR1ZGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5nbG9iYWxBbHRpdHVkZSA9IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlISksXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMTEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wcmludEZsYWdzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQucHJpbnRGbGFncyA9IHtcclxuXHRcdFx0bGFiZWxzOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRjcm9wTWFya3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdGNvbG9yQmFyczogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0cmVnaXN0cmF0aW9uTWFya3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdG5lZ2F0aXZlOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRmbGlwOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRpbnRlcnBvbGF0ZTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0Y2FwdGlvbjogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0cHJpbnRGbGFnczogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdH07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGZsYWdzID0gdGFyZ2V0LnByaW50RmxhZ3MhO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmxhYmVscyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5jcm9wTWFya3MgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY29sb3JCYXJzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLnJlZ2lzdHJhdGlvbk1hcmtzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLm5lZ2F0aXZlID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmZsaXAgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuaW50ZXJwb2xhdGUgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY2FwdGlvbiA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5wcmludEZsYWdzID8gMSA6IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAwMDAsIC8vIFByaW50IGZsYWdzXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDAwMCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMDAwJywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDAwMCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAwMDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAxMywgLy8gQ29sb3IgaGFsZnRvbmluZ1xyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTAxMyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMTMnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwMTMgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwMTMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAxNiwgLy8gQ29sb3IgdHJhbnNmZXIgZnVuY3Rpb25zXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDE2ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAxNicsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAxNiA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAxNik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAyNCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyU3RhdGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5sYXllclN0YXRlID0gcmVhZFVpbnQxNihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MTYod3JpdGVyLCB0YXJnZXQubGF5ZXJTdGF0ZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDI2LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJzR3JvdXAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5sYXllcnNHcm91cCA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0dGFyZ2V0LmxheWVyc0dyb3VwLnB1c2gocmVhZFVpbnQxNihyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBnIG9mIHRhcmdldC5sYXllcnNHcm91cCEpIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBnKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDcyLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJHcm91cHNFbmFibGVkSWQgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZCA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0dGFyZ2V0LmxheWVyR3JvdXBzRW5hYmxlZElkLnB1c2gocmVhZFVpbnQ4KHJlYWRlcikpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZCEpIHtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGlkKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDY5LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCBjb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdHRhcmdldC5sYXllclNlbGVjdGlvbklkcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChjb3VudC0tKSB7XHJcblx0XHRcdHRhcmdldC5sYXllclNlbGVjdGlvbklkcy5wdXNoKHJlYWRVaW50MzIocmVhZGVyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzIS5sZW5ndGgpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgaWQgb2YgdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzISkge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGlkKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDMyLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaG9yaXpvbnRhbCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKHZlcnNpb24gIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCAxMDMyIHJlc291cmNlIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uID0ge1xyXG5cdFx0XHRncmlkOiB7IGhvcml6b250YWwsIHZlcnRpY2FsIH0sXHJcblx0XHRcdGd1aWRlczogW10sXHJcblx0XHR9O1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uLmd1aWRlcyEucHVzaCh7XHJcblx0XHRcdFx0bG9jYXRpb246IHJlYWRVaW50MzIocmVhZGVyKSAvIDMyLFxyXG5cdFx0XHRcdGRpcmVjdGlvbjogcmVhZFVpbnQ4KHJlYWRlcikgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmdyaWRBbmRHdWlkZXNJbmZvcm1hdGlvbiE7XHJcblx0XHRjb25zdCBncmlkID0gaW5mby5ncmlkIHx8IHsgaG9yaXpvbnRhbDogMTggKiAzMiwgdmVydGljYWw6IDE4ICogMzIgfTtcclxuXHRcdGNvbnN0IGd1aWRlcyA9IGluZm8uZ3VpZGVzIHx8IFtdO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGdyaWQuaG9yaXpvbnRhbCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGdyaWQudmVydGljYWwpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBndWlkZXMubGVuZ3RoKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGcgb2YgZ3VpZGVzKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgZy5sb2NhdGlvbiAqIDMyKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGcuZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAxIDogMCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1NCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnVybHNMaXN0ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRpZiAoY291bnQpIHtcclxuXHRcdFx0aWYgKCFvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSByZXR1cm47XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkOiBVUkwgTGlzdCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFRPRE86IHJlYWQgYWN0dWFsIFVSTCBsaXN0XHJcblx0XHR0YXJnZXQudXJsc0xpc3QgPSBbXTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQudXJsc0xpc3QhLmxlbmd0aCk7XHJcblxyXG5cdFx0Ly8gVE9ETzogd3JpdGUgYWN0dWFsIFVSTCBsaXN0XHJcblx0XHRpZiAodGFyZ2V0LnVybHNMaXN0IS5sZW5ndGgpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQ6IFVSTCBMaXN0Jyk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQxMDUwLCAvLyBTbGljZXNcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwNTAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDUwJywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDUwID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDUwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDY0LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQucGl4ZWxBc3BlY3RSYXRpbyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSA+IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwaXhlbEFzcGVjdFJhdGlvIHZlcnNpb24nKTtcclxuXHRcdHRhcmdldC5waXhlbEFzcGVjdFJhdGlvID0geyBhc3BlY3Q6IHJlYWRGbG9hdDY0KHJlYWRlcikgfTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdGFyZ2V0LnBpeGVsQXNwZWN0UmF0aW8hLmFzcGVjdCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA0MSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmljY1VudGFnZ2VkUHJvZmlsZSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmljY1VudGFnZ2VkUHJvZmlsZSA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQuaWNjVW50YWdnZWRQcm9maWxlID8gMSA6IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAzOSwgLy8gSUNDIFByb2ZpbGVcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMzkgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDM5JywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDM5ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDM5KTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDQ0LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuaWRzU2VlZE51bWJlciAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0Lmlkc1NlZWROdW1iZXIgPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5pZHNTZWVkTnVtYmVyISksXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMzYsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC50aHVtYm5haWwgIT09IHVuZGVmaW5lZCB8fCB0YXJnZXQudGh1bWJuYWlsUmF3ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBmb3JtYXQgPSByZWFkVWludDMyKHJlYWRlcik7IC8vIDEgPSBrSnBlZ1JHQiwgMCA9IGtSYXdSR0JcclxuXHRcdGNvbnN0IHdpZHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaGVpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyB3aWR0aEJ5dGVzID0gKHdpZHRoICogYml0c19wZXJfcGl4ZWwgKyAzMSkgLyAzMiAqIDQuXHJcblx0XHRyZWFkVWludDMyKHJlYWRlcik7IC8vIHRvdGFsU2l6ZSA9IHdpZHRoQnl0ZXMgKiBoZWlnaHQgKiBwbGFuZXNcclxuXHRcdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gc2l6ZUFmdGVyQ29tcHJlc3Npb25cclxuXHRcdGNvbnN0IGJpdHNQZXJQaXhlbCA9IHJlYWRVaW50MTYocmVhZGVyKTsgLy8gMjRcclxuXHRcdGNvbnN0IHBsYW5lcyA9IHJlYWRVaW50MTYocmVhZGVyKTsgLy8gMVxyXG5cclxuXHRcdGlmIChmb3JtYXQgIT09IDEgfHwgYml0c1BlclBpeGVsICE9PSAyNCB8fCBwbGFuZXMgIT09IDEpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYEludmFsaWQgdGh1bWJuYWlsIGRhdGEgKGZvcm1hdDogJHtmb3JtYXR9LCBiaXRzUGVyUGl4ZWw6ICR7Yml0c1BlclBpeGVsfSwgcGxhbmVzOiAke3BsYW5lc30pYCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBzaXplID0gbGVmdCgpO1xyXG5cdFx0Y29uc3QgZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIHNpemUpO1xyXG5cclxuXHRcdGlmIChvcHRpb25zLnVzZVJhd1RodW1ibmFpbCkge1xyXG5cdFx0XHR0YXJnZXQudGh1bWJuYWlsUmF3ID0geyB3aWR0aCwgaGVpZ2h0LCBkYXRhIH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0YXJnZXQudGh1bWJuYWlsID0gY3JlYXRlQ2FudmFzRnJvbURhdGEoZGF0YSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCB3aWR0aCA9IDA7XHJcblx0XHRsZXQgaGVpZ2h0ID0gMDtcclxuXHRcdGxldCBkYXRhOiBVaW50OEFycmF5O1xyXG5cclxuXHRcdGlmICh0YXJnZXQudGh1bWJuYWlsUmF3KSB7XHJcblx0XHRcdHdpZHRoID0gdGFyZ2V0LnRodW1ibmFpbFJhdy53aWR0aDtcclxuXHRcdFx0aGVpZ2h0ID0gdGFyZ2V0LnRodW1ibmFpbFJhdy5oZWlnaHQ7XHJcblx0XHRcdGRhdGEgPSB0YXJnZXQudGh1bWJuYWlsUmF3LmRhdGE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpZiAoIXRhcmdldC50aHVtYm5haWwpIHRocm93IG5ldyBFcnJvcignTWlzc2luZyB0aHVtYm5haWwnKTtcclxuXHRcdFx0d2lkdGggPSB0YXJnZXQudGh1bWJuYWlsLndpZHRoO1xyXG5cdFx0XHRoZWlnaHQgPSB0YXJnZXQudGh1bWJuYWlsLmhlaWdodDtcclxuXHRcdFx0ZGF0YSA9IHRvQnl0ZUFycmF5KHRhcmdldC50aHVtYm5haWwudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywgMSkuc3Vic3RyKCdkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCcubGVuZ3RoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgYml0c1BlclBpeGVsID0gMjQ7XHJcblx0XHRjb25zdCB3aWR0aEJ5dGVzID0gTWF0aC5mbG9vcigod2lkdGggKiBiaXRzUGVyUGl4ZWwgKyAzMSkgLyAzMikgKiA0O1xyXG5cdFx0Y29uc3QgcGxhbmVzID0gMTtcclxuXHRcdGNvbnN0IHRvdGFsU2l6ZSA9IHdpZHRoQnl0ZXMgKiBoZWlnaHQgKiBwbGFuZXM7XHJcblx0XHRjb25zdCBzaXplQWZ0ZXJDb21wcmVzc2lvbiA9IGRhdGEubGVuZ3RoO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7IC8vIDEgPSBrSnBlZ1JHQlxyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB3aWR0aCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGhlaWdodCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIHdpZHRoQnl0ZXMpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0b3RhbFNpemUpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBzaXplQWZ0ZXJDb21wcmVzc2lvbik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGJpdHNQZXJQaXhlbCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHBsYW5lcyk7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgZGF0YSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1NyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnZlcnNpb25JbmZvICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0aWYgKHZlcnNpb24gIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2ZXJzaW9uSW5mbyB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LnZlcnNpb25JbmZvID0ge1xyXG5cdFx0XHRoYXNSZWFsTWVyZ2VkRGF0YTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0d3JpdGVyTmFtZTogcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSxcclxuXHRcdFx0cmVhZGVyTmFtZTogcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSxcclxuXHRcdFx0ZmlsZVZlcnNpb246IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbkluZm8gPSB0YXJnZXQudmVyc2lvbkluZm8hO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZlcnNpb25JbmZvLmhhc1JlYWxNZXJnZWREYXRhID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlciwgdmVyc2lvbkluZm8ud3JpdGVyTmFtZSk7XHJcblx0XHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCB2ZXJzaW9uSW5mby5yZWFkZXJOYW1lKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdmVyc2lvbkluZm8uZmlsZVZlcnNpb24pO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTA1OCwgLy8gRVhJRiBkYXRhIDEuXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDU4ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA1OCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0NzAwMCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmltYWdlUmVhZHlWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5pbWFnZVJlYWR5VmFyaWFibGVzID0gcmVhZFV0ZjhTdHJpbmcocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVV0ZjhTdHJpbmcod3JpdGVyLCB0YXJnZXQuaW1hZ2VSZWFkeVZhcmlhYmxlcyEpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDcwMDEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMgPSByZWFkVXRmOFN0cmluZyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVXRmOFN0cmluZyh3cml0ZXIsIHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMhKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIERlc2NyaXB0b3IxMDg4IHtcclxuXHQnbnVsbCc6IHN0cmluZ1tdO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwODgsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wYXRoU2VsZWN0aW9uU3RhdGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIF9sZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBEZXNjcmlwdG9yMTA4OCA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHR0YXJnZXQucGF0aFNlbGVjdGlvblN0YXRlID0gZGVzY1snbnVsbCddO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBEZXNjcmlwdG9yMTA4OCA9IHsgJ251bGwnOiB0YXJnZXQucGF0aFNlbGVjdGlvblN0YXRlISB9O1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAyNSxcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMjUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDI1JywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDI1ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDI1KTtcclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgRnJtRCA9IGNyZWF0ZUVudW08J2F1dG8nIHwgJ25vbmUnIHwgJ2Rpc3Bvc2UnPignRnJtRCcsICcnLCB7XHJcblx0YXV0bzogJ0F1dG8nLFxyXG5cdG5vbmU6ICdOb25lJyxcclxuXHRkaXNwb3NlOiAnRGlzcCcsXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIEFuaW1hdGlvbkRlc2NyaXB0b3Ige1xyXG5cdEFGU3Q6IG51bWJlcjtcclxuXHRGckluOiB7XHJcblx0XHRGcklEOiBudW1iZXI7XHJcblx0XHRGckRsOiBudW1iZXI7XHJcblx0XHRGckRzOiBzdHJpbmc7XHJcblx0XHRGckdBPzogbnVtYmVyO1xyXG5cdH1bXTtcclxuXHRGU3RzOiB7XHJcblx0XHRGc0lEOiBudW1iZXI7XHJcblx0XHRBRnJtOiBudW1iZXI7XHJcblx0XHRGc0ZyOiBudW1iZXJbXTtcclxuXHRcdExDbnQ6IG51bWJlcjtcclxuXHR9W107XHJcbn1cclxuXHJcbmludGVyZmFjZSBBbmltYXRpb25zIHtcclxuXHRmcmFtZXM6IHtcclxuXHRcdGlkOiBudW1iZXI7XHJcblx0XHRkZWxheTogbnVtYmVyO1xyXG5cdFx0ZGlzcG9zZT86ICdhdXRvJyB8ICdub25lJyB8ICdkaXNwb3NlJztcclxuXHR9W107XHJcblx0YW5pbWF0aW9uczoge1xyXG5cdFx0aWQ6IG51bWJlcjtcclxuXHRcdGZyYW1lczogbnVtYmVyW107XHJcblx0XHRyZXBlYXRzPzogbnVtYmVyO1xyXG5cdH1bXTtcclxufVxyXG5cclxuLy8gVE9ETzogVW5maW5pc2hlZFxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0NDAwMCwgLy8gUGx1Zy1JbiByZXNvdXJjZShzKVxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyNDAwMCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgeyBsb2dNaXNzaW5nRmVhdHVyZXMsIGxvZ0RldkZlYXR1cmVzIH0pID0+IHtcclxuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSB7XHJcblx0XHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSA0MDAwJywgbGVmdCgpKTtcclxuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9pcjQwMDAgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdGlmIChrZXkgPT09ICdtYW5pJykge1xyXG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICdJUkZSJyk7XHJcblx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRcdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdFx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChrZXkgPT09ICdBbkRzJykge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBBbmltYXRpb25EZXNjcmlwdG9yO1xyXG5cdFx0XHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdBbkRzJywgZGVzYyk7XHJcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIEFuRHMnLCBkZXNjKTtcclxuXHRcdFx0XHRcdFx0XHQvLyBsb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnIzQwMDAgQW5EcycsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQ6IEFuaW1hdGlvbnMgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBkZXNjLkFGU3QgPz8/XHJcblx0XHRcdFx0XHRcdFx0XHRmcmFtZXM6IGRlc2MuRnJJbi5tYXAoeCA9PiAoe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogeC5GcklELFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRkZWxheTogeC5GckRsIC8gMTAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNwb3NlOiB4LkZyRHMgPyBGcm1ELmRlY29kZSh4LkZyRHMpIDogJ2F1dG8nLCAvLyBtaXNzaW5nID09IGF1dG9cclxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8geC5GckdBID8/P1xyXG5cdFx0XHRcdFx0XHRcdFx0fSkpLFxyXG5cdFx0XHRcdFx0XHRcdFx0YW5pbWF0aW9uczogZGVzYy5GU3RzLm1hcCh4ID0+ICh7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiB4LkZzSUQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdGZyYW1lczogeC5Gc0ZyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXBlYXRzOiB4LkxDbnQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdC8vIHguQUZybSA/Pz9cclxuXHRcdFx0XHRcdFx0XHRcdH0pKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRcdFx0XHRsb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnIzQwMDAgQW5EczpyZXN1bHQnLCByZXN1bHQpO1xyXG5cdFx0XHRcdFx0XHRcdC8vIGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzOnJlc3VsdCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHJlc3VsdCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnUm9sbCcpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIFJvbGwnLCBieXRlcyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdVbmhhbmRsZWQgc3Vic2VjdGlvbiBpbiAjNDAwMCcsIGtleSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21vcHQnKSB7XHJcblx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIG1vcHQnLCBieXRlcyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRsb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBrZXkgaW4gIzQwMDA6Jywga2V5KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjQwMDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG4vLyBUT0RPOiBVbmZpbmlzaGVkXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQ0MDAxLCAvLyBQbHVnLUluIHJlc291cmNlKHMpXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXI0MDAxICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCB7IGxvZ01pc3NpbmdGZWF0dXJlcywgbG9nRGV2RmVhdHVyZXMgfSkgPT4ge1xyXG5cdFx0aWYgKE1PQ0tfSEFORExFUlMpIHtcclxuXHRcdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDQwMDEnLCBsZWZ0KCkpO1xyXG5cdFx0XHQodGFyZ2V0IGFzIGFueSkuX2lyNDAwMSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKGtleSA9PT0gJ21mcmknKSB7XHJcblx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGlmICh2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWZyaSB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21mcmknLCBieXRlcyk7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21zZXQnKSB7XHJcblx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21zZXQnLCBkZXNjKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIGtleSBpbiAjNDAwMScsIGtleSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyNDAwMSk7XHJcblx0fSxcclxuKTtcclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
