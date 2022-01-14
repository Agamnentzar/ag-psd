"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceHandlersMap = exports.resourceHandlers = void 0;
var base64_js_1 = require("base64-js");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var helpers_1 = require("./helpers");
var utf8_1 = require("./utf8");
var descriptor_1 = require("./descriptor");
exports.resourceHandlers = [];
exports.resourceHandlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    exports.resourceHandlers.push(handler);
    exports.resourceHandlersMap[handler.key] = handler;
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
    var buffer = psdReader_1.readBytes(reader, length);
    return utf8_1.decodeString(buffer);
}
function writeUtf8String(writer, value) {
    var buffer = utf8_1.encodeString(value);
    psdWriter_1.writeBytes(writer, buffer);
}
helpers_1.MOCK_HANDLERS && addHandler(1028, // IPTC-NAA record
function (// IPTC-NAA record
target) { return target._ir1028 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1028', left());
    target._ir1028 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1028);
});
addHandler(1061, function (target) { return target.captionDigest !== undefined; }, function (reader, target) {
    var captionDigest = '';
    for (var i = 0; i < 16; i++) {
        var byte = psdReader_1.readUint8(reader);
        captionDigest += hex[byte >> 4];
        captionDigest += hex[byte & 0xf];
    }
    target.captionDigest = captionDigest;
}, function (writer, target) {
    for (var i = 0; i < 16; i++) {
        psdWriter_1.writeUint8(writer, byteAt(target.captionDigest, i * 2));
    }
});
addHandler(1060, function (target) { return target.xmpMetadata !== undefined; }, function (reader, target, left) { return target.xmpMetadata = readUtf8String(reader, left()); }, function (writer, target) { return writeUtf8String(writer, target.xmpMetadata); });
var Inte = helpers_1.createEnum('Inte', 'perceptual', {
    'perceptual': 'Img ',
    'saturation': 'Grp ',
    'relative colorimetric': 'Clrm',
    'absolute colorimetric': 'AClr',
});
addHandler(1082, function (target) { return target.printInformation !== undefined; }, function (reader, target) {
    var _a, _b;
    var desc = descriptor_1.readVersionAndDescriptor(reader);
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
    descriptor_1.writeVersionAndDescriptor(writer, '', 'printOutput', desc);
});
helpers_1.MOCK_HANDLERS && addHandler(1083, // Print style
function (// Print style
target) { return target._ir1083 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1083', left());
    target._ir1083 = psdReader_1.readBytes(reader, left());
    // TODO:
    // const desc = readVersionAndDescriptor(reader);
    // console.log('1083', require('util').inspect(desc, false, 99, true));
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1083);
});
addHandler(1005, function (target) { return target.resolutionInfo !== undefined; }, function (reader, target) {
    var horizontalResolution = psdReader_1.readFixedPoint32(reader);
    var horizontalResolutionUnit = psdReader_1.readUint16(reader);
    var widthUnit = psdReader_1.readUint16(reader);
    var verticalResolution = psdReader_1.readFixedPoint32(reader);
    var verticalResolutionUnit = psdReader_1.readUint16(reader);
    var heightUnit = psdReader_1.readUint16(reader);
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
    psdWriter_1.writeFixedPoint32(writer, info.horizontalResolution || 0);
    psdWriter_1.writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
    psdWriter_1.writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
    psdWriter_1.writeFixedPoint32(writer, info.verticalResolution || 0);
    psdWriter_1.writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
    psdWriter_1.writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
});
var printScaleStyles = ['centered', 'size to fit', 'user defined'];
addHandler(1062, function (target) { return target.printScale !== undefined; }, function (reader, target) {
    target.printScale = {
        style: printScaleStyles[psdReader_1.readInt16(reader)],
        x: psdReader_1.readFloat32(reader),
        y: psdReader_1.readFloat32(reader),
        scale: psdReader_1.readFloat32(reader),
    };
}, function (writer, target) {
    var _a = target.printScale, style = _a.style, x = _a.x, y = _a.y, scale = _a.scale;
    psdWriter_1.writeInt16(writer, Math.max(0, printScaleStyles.indexOf(style)));
    psdWriter_1.writeFloat32(writer, x || 0);
    psdWriter_1.writeFloat32(writer, y || 0);
    psdWriter_1.writeFloat32(writer, scale || 0);
});
addHandler(1006, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        var value = psdReader_1.readPascalString(reader, 1);
        target.alphaChannelNames.push(value);
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_1 = _a[_i];
        psdWriter_1.writePascalString(writer, name_1, 1);
    }
});
addHandler(1045, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        target.alphaChannelNames.push(psdReader_1.readUnicodeString(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_2 = _a[_i];
        psdWriter_1.writeUnicodeStringWithPadding(writer, name_2);
    }
});
helpers_1.MOCK_HANDLERS && addHandler(1077, function (target) { return target._ir1077 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1077', left());
    target._ir1077 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1077);
});
addHandler(1053, function (target) { return target.alphaIdentifiers !== undefined; }, function (reader, target, left) {
    target.alphaIdentifiers = [];
    while (left() >= 4) {
        target.alphaIdentifiers.push(psdReader_1.readUint32(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaIdentifiers; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint32(writer, id);
    }
});
addHandler(1010, function (target) { return target.backgroundColor !== undefined; }, function (reader, target) { return target.backgroundColor = psdReader_1.readColor(reader); }, function (writer, target) { return psdWriter_1.writeColor(writer, target.backgroundColor); });
addHandler(1037, function (target) { return target.globalAngle !== undefined; }, function (reader, target) { return target.globalAngle = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.globalAngle); });
addHandler(1049, function (target) { return target.globalAltitude !== undefined; }, function (reader, target) { return target.globalAltitude = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.globalAltitude); });
addHandler(1011, function (target) { return target.printFlags !== undefined; }, function (reader, target) {
    target.printFlags = {
        labels: !!psdReader_1.readUint8(reader),
        cropMarks: !!psdReader_1.readUint8(reader),
        colorBars: !!psdReader_1.readUint8(reader),
        registrationMarks: !!psdReader_1.readUint8(reader),
        negative: !!psdReader_1.readUint8(reader),
        flip: !!psdReader_1.readUint8(reader),
        interpolate: !!psdReader_1.readUint8(reader),
        caption: !!psdReader_1.readUint8(reader),
        printFlags: !!psdReader_1.readUint8(reader),
    };
}, function (writer, target) {
    var flags = target.printFlags;
    psdWriter_1.writeUint8(writer, flags.labels ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.cropMarks ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.colorBars ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.registrationMarks ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.negative ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.flip ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.interpolate ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.caption ? 1 : 0);
    psdWriter_1.writeUint8(writer, flags.printFlags ? 1 : 0);
});
helpers_1.MOCK_HANDLERS && addHandler(10000, // Print flags
function (// Print flags
target) { return target._ir10000 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 10000', left());
    target._ir10000 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir10000);
});
helpers_1.MOCK_HANDLERS && addHandler(1013, // Color halftoning
function (// Color halftoning
target) { return target._ir1013 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1013', left());
    target._ir1013 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1013);
});
helpers_1.MOCK_HANDLERS && addHandler(1016, // Color transfer functions
function (// Color transfer functions
target) { return target._ir1016 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1016', left());
    target._ir1016 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1016);
});
addHandler(1024, function (target) { return target.layerState !== undefined; }, function (reader, target) { return target.layerState = psdReader_1.readUint16(reader); }, function (writer, target) { return psdWriter_1.writeUint16(writer, target.layerState); });
addHandler(1026, function (target) { return target.layersGroup !== undefined; }, function (reader, target, left) {
    target.layersGroup = [];
    while (left()) {
        target.layersGroup.push(psdReader_1.readUint16(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layersGroup; _i < _a.length; _i++) {
        var g = _a[_i];
        psdWriter_1.writeUint16(writer, g);
    }
});
addHandler(1072, function (target) { return target.layerGroupsEnabledId !== undefined; }, function (reader, target, left) {
    target.layerGroupsEnabledId = [];
    while (left()) {
        target.layerGroupsEnabledId.push(psdReader_1.readUint8(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layerGroupsEnabledId; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint8(writer, id);
    }
});
addHandler(1069, function (target) { return target.layerSelectionIds !== undefined; }, function (reader, target) {
    var count = psdReader_1.readUint16(reader);
    target.layerSelectionIds = [];
    while (count--) {
        target.layerSelectionIds.push(psdReader_1.readUint32(reader));
    }
}, function (writer, target) {
    psdWriter_1.writeUint16(writer, target.layerSelectionIds.length);
    for (var _i = 0, _a = target.layerSelectionIds; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint32(writer, id);
    }
});
addHandler(1032, function (target) { return target.gridAndGuidesInformation !== undefined; }, function (reader, target) {
    var version = psdReader_1.readUint32(reader);
    var horizontal = psdReader_1.readUint32(reader);
    var vertical = psdReader_1.readUint32(reader);
    var count = psdReader_1.readUint32(reader);
    if (version !== 1)
        throw new Error("Invalid 1032 resource version: " + version);
    target.gridAndGuidesInformation = {
        grid: { horizontal: horizontal, vertical: vertical },
        guides: [],
    };
    for (var i = 0; i < count; i++) {
        target.gridAndGuidesInformation.guides.push({
            location: psdReader_1.readUint32(reader) / 32,
            direction: psdReader_1.readUint8(reader) ? 'horizontal' : 'vertical'
        });
    }
}, function (writer, target) {
    var info = target.gridAndGuidesInformation;
    var grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
    var guides = info.guides || [];
    psdWriter_1.writeUint32(writer, 1);
    psdWriter_1.writeUint32(writer, grid.horizontal);
    psdWriter_1.writeUint32(writer, grid.vertical);
    psdWriter_1.writeUint32(writer, guides.length);
    for (var _i = 0, guides_1 = guides; _i < guides_1.length; _i++) {
        var g = guides_1[_i];
        psdWriter_1.writeUint32(writer, g.location * 32);
        psdWriter_1.writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
    }
});
addHandler(1054, function (target) { return target.urlsList !== undefined; }, function (reader, target, _, options) {
    var count = psdReader_1.readUint32(reader);
    if (count) {
        if (!options.throwForMissingFeatures)
            return;
        throw new Error('Not implemented: URL List');
    }
    // TODO: read actual URL list
    target.urlsList = [];
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.urlsList.length);
    // TODO: write actual URL list
    if (target.urlsList.length) {
        throw new Error('Not implemented: URL List');
    }
});
helpers_1.MOCK_HANDLERS && addHandler(1050, // Slices
function (// Slices
target) { return target._ir1050 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1050', left());
    target._ir1050 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1050);
});
addHandler(1064, function (target) { return target.pixelAspectRatio !== undefined; }, function (reader, target) {
    if (psdReader_1.readUint32(reader) > 2)
        throw new Error('Invalid pixelAspectRatio version');
    target.pixelAspectRatio = { aspect: psdReader_1.readFloat64(reader) };
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, 2); // version
    psdWriter_1.writeFloat64(writer, target.pixelAspectRatio.aspect);
});
addHandler(1041, function (target) { return target.iccUntaggedProfile !== undefined; }, function (reader, target) {
    target.iccUntaggedProfile = !!psdReader_1.readUint8(reader);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.iccUntaggedProfile ? 1 : 0);
});
helpers_1.MOCK_HANDLERS && addHandler(1039, // ICC Profile
function (// ICC Profile
target) { return target._ir1039 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1039', left());
    target._ir1039 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1039);
});
addHandler(1044, function (target) { return target.idsSeedNumber !== undefined; }, function (reader, target) { return target.idsSeedNumber = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.idsSeedNumber); });
addHandler(1036, function (target) { return target.thumbnail !== undefined || target.thumbnailRaw !== undefined; }, function (reader, target, left, options) {
    var format = psdReader_1.readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
    var width = psdReader_1.readUint32(reader);
    var height = psdReader_1.readUint32(reader);
    psdReader_1.readUint32(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
    psdReader_1.readUint32(reader); // totalSize = widthBytes * height * planes
    psdReader_1.readUint32(reader); // sizeAfterCompression
    var bitsPerPixel = psdReader_1.readUint16(reader); // 24
    var planes = psdReader_1.readUint16(reader); // 1
    if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
        options.logMissingFeatures && console.log("Invalid thumbnail data (format: " + format + ", bitsPerPixel: " + bitsPerPixel + ", planes: " + planes + ")");
        psdReader_1.skipBytes(reader, left());
        return;
    }
    var size = left();
    var data = psdReader_1.readBytes(reader, size);
    if (options.useRawThumbnail) {
        target.thumbnailRaw = { width: width, height: height, data: data };
    }
    else {
        target.thumbnail = helpers_1.createCanvasFromData(data);
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
        data = base64_js_1.toByteArray(target.thumbnail.toDataURL('image/jpeg', 1).substr('data:image/jpeg;base64,'.length));
    }
    var bitsPerPixel = 24;
    var widthBytes = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
    var planes = 1;
    var totalSize = widthBytes * height * planes;
    var sizeAfterCompression = data.length;
    psdWriter_1.writeUint32(writer, 1); // 1 = kJpegRGB
    psdWriter_1.writeUint32(writer, width);
    psdWriter_1.writeUint32(writer, height);
    psdWriter_1.writeUint32(writer, widthBytes);
    psdWriter_1.writeUint32(writer, totalSize);
    psdWriter_1.writeUint32(writer, sizeAfterCompression);
    psdWriter_1.writeUint16(writer, bitsPerPixel);
    psdWriter_1.writeUint16(writer, planes);
    psdWriter_1.writeBytes(writer, data);
});
addHandler(1057, function (target) { return target.versionInfo !== undefined; }, function (reader, target, left) {
    var version = psdReader_1.readUint32(reader);
    if (version !== 1)
        throw new Error('Invalid versionInfo version');
    target.versionInfo = {
        hasRealMergedData: !!psdReader_1.readUint8(reader),
        writerName: psdReader_1.readUnicodeString(reader),
        readerName: psdReader_1.readUnicodeString(reader),
        fileVersion: psdReader_1.readUint32(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var versionInfo = target.versionInfo;
    psdWriter_1.writeUint32(writer, 1); // version
    psdWriter_1.writeUint8(writer, versionInfo.hasRealMergedData ? 1 : 0);
    psdWriter_1.writeUnicodeString(writer, versionInfo.writerName);
    psdWriter_1.writeUnicodeString(writer, versionInfo.readerName);
    psdWriter_1.writeUint32(writer, versionInfo.fileVersion);
});
helpers_1.MOCK_HANDLERS && addHandler(1058, // EXIF data 1.
function (// EXIF data 1.
target) { return target._ir1058 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1058', left());
    target._ir1058 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1058);
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
    var desc = descriptor_1.readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.pathSelectionState = desc['null'];
}, function (writer, target) {
    var desc = { 'null': target.pathSelectionState };
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
});
helpers_1.MOCK_HANDLERS && addHandler(1025, function (target) { return target._ir1025 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1025', left());
    target._ir1025 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1025);
});
var FrmD = helpers_1.createEnum('FrmD', '', {
    auto: 'Auto',
    none: 'None',
    dispose: 'Disp',
});
// TODO: Unfinished
helpers_1.MOCK_HANDLERS && addHandler(4000, // Plug-In resource(s)
function (// Plug-In resource(s)
target) { return target._ir4000 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (helpers_1.MOCK_HANDLERS) {
        LOG_MOCK_HANDLERS && console.log('image resource 4000', left());
        target._ir4000 = psdReader_1.readBytes(reader, left());
        return;
    }
    var key = psdReader_1.readSignature(reader);
    if (key === 'mani') {
        psdReader_1.checkSignature(reader, 'IRFR');
        psdReader_1.readSection(reader, 1, function (left) {
            var _loop_1 = function () {
                psdReader_1.checkSignature(reader, '8BIM');
                var key_1 = psdReader_1.readSignature(reader);
                psdReader_1.readSection(reader, 1, function (left) {
                    if (key_1 === 'AnDs') {
                        var desc = descriptor_1.readVersionAndDescriptor(reader);
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
                        var bytes = psdReader_1.readBytes(reader, left());
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
        var bytes = psdReader_1.readBytes(reader, left());
        logDevFeatures && console.log('#4000 mopt', bytes);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4000:', key);
        return;
    }
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir4000);
});
// TODO: Unfinished
helpers_1.MOCK_HANDLERS && addHandler(4001, // Plug-In resource(s)
function (// Plug-In resource(s)
target) { return target._ir4001 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (helpers_1.MOCK_HANDLERS) {
        LOG_MOCK_HANDLERS && console.log('image resource 4001', left());
        target._ir4001 = psdReader_1.readBytes(reader, left());
        return;
    }
    var key = psdReader_1.readSignature(reader);
    if (key === 'mfri') {
        var version = psdReader_1.readUint32(reader);
        if (version !== 2)
            throw new Error('Invalid mfri version');
        var length_1 = psdReader_1.readUint32(reader);
        var bytes = psdReader_1.readBytes(reader, length_1);
        logDevFeatures && console.log('mfri', bytes);
    }
    else if (key === 'mset') {
        var desc = descriptor_1.readVersionAndDescriptor(reader);
        logDevFeatures && console.log('mset', desc);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4001', key);
    }
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir4001);
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LHNCQUFVLENBQUMsTUFBTSxFQUFHLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQ0QsQ0FBQyIsImZpbGUiOiJpbWFnZVJlc291cmNlcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHRvQnl0ZUFycmF5IH0gZnJvbSAnYmFzZTY0LWpzJztcclxuaW1wb3J0IHsgSW1hZ2VSZXNvdXJjZXMsIFJlYWRPcHRpb25zLCBSZW5kZXJpbmdJbnRlbnQgfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7XHJcblx0UHNkUmVhZGVyLCByZWFkUGFzY2FsU3RyaW5nLCByZWFkVW5pY29kZVN0cmluZywgcmVhZFVpbnQzMiwgcmVhZFVpbnQxNiwgcmVhZFVpbnQ4LCByZWFkRmxvYXQ2NCxcclxuXHRyZWFkQnl0ZXMsIHNraXBCeXRlcywgcmVhZEZsb2F0MzIsIHJlYWRJbnQxNiwgcmVhZEZpeGVkUG9pbnQzMiwgcmVhZFNpZ25hdHVyZSwgY2hlY2tTaWduYXR1cmUsXHJcblx0cmVhZFNlY3Rpb24sIHJlYWRDb2xvclxyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcclxuaW1wb3J0IHtcclxuXHRQc2RXcml0ZXIsIHdyaXRlUGFzY2FsU3RyaW5nLCB3cml0ZVVuaWNvZGVTdHJpbmcsIHdyaXRlVWludDMyLCB3cml0ZVVpbnQ4LCB3cml0ZUZsb2F0NjQsIHdyaXRlVWludDE2LFxyXG5cdHdyaXRlQnl0ZXMsIHdyaXRlSW50MTYsIHdyaXRlRmxvYXQzMiwgd3JpdGVGaXhlZFBvaW50MzIsIHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nLCB3cml0ZUNvbG9yLFxyXG59IGZyb20gJy4vcHNkV3JpdGVyJztcclxuaW1wb3J0IHsgY3JlYXRlQ2FudmFzRnJvbURhdGEsIGNyZWF0ZUVudW0sIE1PQ0tfSEFORExFUlMgfSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBkZWNvZGVTdHJpbmcsIGVuY29kZVN0cmluZyB9IGZyb20gJy4vdXRmOCc7XHJcbmltcG9ydCB7IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvciwgd3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvciB9IGZyb20gJy4vZGVzY3JpcHRvcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFJlc291cmNlSGFuZGxlciB7XHJcblx0a2V5OiBudW1iZXI7XHJcblx0aGFzOiAodGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gYm9vbGVhbjtcclxuXHRyZWFkOiAocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMsIGxlZnQ6ICgpID0+IG51bWJlciwgb3B0aW9uczogUmVhZE9wdGlvbnMpID0+IHZvaWQ7XHJcblx0d3JpdGU6ICh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gdm9pZDtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHJlc291cmNlSGFuZGxlcnM6IFJlc291cmNlSGFuZGxlcltdID0gW107XHJcbmV4cG9ydCBjb25zdCByZXNvdXJjZUhhbmRsZXJzTWFwOiB7IFtrZXk6IG51bWJlcl06IFJlc291cmNlSGFuZGxlciB9ID0ge307XHJcblxyXG5mdW5jdGlvbiBhZGRIYW5kbGVyKFxyXG5cdGtleTogbnVtYmVyLFxyXG5cdGhhczogKHRhcmdldDogSW1hZ2VSZXNvdXJjZXMpID0+IGJvb2xlYW4sXHJcblx0cmVhZDogKHJlYWRlcjogUHNkUmVhZGVyLCB0YXJnZXQ6IEltYWdlUmVzb3VyY2VzLCBsZWZ0OiAoKSA9PiBudW1iZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSA9PiB2b2lkLFxyXG5cdHdyaXRlOiAod3JpdGVyOiBQc2RXcml0ZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMpID0+IHZvaWQsXHJcbikge1xyXG5cdGNvbnN0IGhhbmRsZXI6IFJlc291cmNlSGFuZGxlciA9IHsga2V5LCBoYXMsIHJlYWQsIHdyaXRlIH07XHJcblx0cmVzb3VyY2VIYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xyXG5cdHJlc291cmNlSGFuZGxlcnNNYXBbaGFuZGxlci5rZXldID0gaGFuZGxlcjtcclxufVxyXG5cclxuY29uc3QgTE9HX01PQ0tfSEFORExFUlMgPSBmYWxzZTtcclxuY29uc3QgUkVTT0xVVElPTl9VTklUUyA9IFt1bmRlZmluZWQsICdQUEknLCAnUFBDTSddO1xyXG5jb25zdCBNRUFTVVJFTUVOVF9VTklUUyA9IFt1bmRlZmluZWQsICdJbmNoZXMnLCAnQ2VudGltZXRlcnMnLCAnUG9pbnRzJywgJ1BpY2FzJywgJ0NvbHVtbnMnXTtcclxuY29uc3QgaGV4ID0gJzAxMjM0NTY3ODlhYmNkZWYnO1xyXG5cclxuZnVuY3Rpb24gY2hhclRvTmliYmxlKGNvZGU6IG51bWJlcikge1xyXG5cdHJldHVybiBjb2RlIDw9IDU3ID8gY29kZSAtIDQ4IDogY29kZSAtIDg3O1xyXG59XHJcblxyXG5mdW5jdGlvbiBieXRlQXQodmFsdWU6IHN0cmluZywgaW5kZXg6IG51bWJlcikge1xyXG5cdHJldHVybiAoY2hhclRvTmliYmxlKHZhbHVlLmNoYXJDb2RlQXQoaW5kZXgpKSA8PCA0KSB8IGNoYXJUb05pYmJsZSh2YWx1ZS5jaGFyQ29kZUF0KGluZGV4ICsgMSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkVXRmOFN0cmluZyhyZWFkZXI6IFBzZFJlYWRlciwgbGVuZ3RoOiBudW1iZXIpIHtcclxuXHRjb25zdCBidWZmZXIgPSByZWFkQnl0ZXMocmVhZGVyLCBsZW5ndGgpO1xyXG5cdHJldHVybiBkZWNvZGVTdHJpbmcoYnVmZmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVVdGY4U3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogc3RyaW5nKSB7XHJcblx0Y29uc3QgYnVmZmVyID0gZW5jb2RlU3RyaW5nKHZhbHVlKTtcclxuXHR3cml0ZUJ5dGVzKHdyaXRlciwgYnVmZmVyKTtcclxufVxyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMjgsIC8vIElQVEMtTkFBIHJlY29yZFxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTAyOCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMjgnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwMjggPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwMjgpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNjEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5jYXB0aW9uRGlnZXN0ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRsZXQgY2FwdGlvbkRpZ2VzdCA9ICcnO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkrKykge1xyXG5cdFx0XHRjb25zdCBieXRlID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdGNhcHRpb25EaWdlc3QgKz0gaGV4W2J5dGUgPj4gNF07XHJcblx0XHRcdGNhcHRpb25EaWdlc3QgKz0gaGV4W2J5dGUgJiAweGZdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRhcmdldC5jYXB0aW9uRGlnZXN0ID0gY2FwdGlvbkRpZ2VzdDtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBieXRlQXQodGFyZ2V0LmNhcHRpb25EaWdlc3QhLCBpICogMikpO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNjAsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC54bXBNZXRhZGF0YSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4gdGFyZ2V0LnhtcE1ldGFkYXRhID0gcmVhZFV0ZjhTdHJpbmcocmVhZGVyLCBsZWZ0KCkpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVdGY4U3RyaW5nKHdyaXRlciwgdGFyZ2V0LnhtcE1ldGFkYXRhISksXHJcbik7XHJcblxyXG5jb25zdCBJbnRlID0gY3JlYXRlRW51bTxSZW5kZXJpbmdJbnRlbnQ+KCdJbnRlJywgJ3BlcmNlcHR1YWwnLCB7XHJcblx0J3BlcmNlcHR1YWwnOiAnSW1nICcsXHJcblx0J3NhdHVyYXRpb24nOiAnR3JwICcsXHJcblx0J3JlbGF0aXZlIGNvbG9yaW1ldHJpYyc6ICdDbHJtJyxcclxuXHQnYWJzb2x1dGUgY29sb3JpbWV0cmljJzogJ0FDbHInLFxyXG59KTtcclxuXHJcbmludGVyZmFjZSBQcmludEluZm9ybWF0aW9uRGVzY3JpcHRvciB7XHJcblx0J05tICAnPzogc3RyaW5nO1xyXG5cdENsclM/OiBzdHJpbmc7XHJcblx0UHN0Uz86IGJvb2xlYW47XHJcblx0TXBCbD86IGJvb2xlYW47XHJcblx0SW50ZT86IHN0cmluZztcclxuXHRoYXJkUHJvb2Y/OiBib29sZWFuO1xyXG5cdHByaW50U2l4dGVlbkJpdD86IGJvb2xlYW47XHJcblx0cHJpbnRlck5hbWU/OiBzdHJpbmc7XHJcblx0cHJpbnRQcm9vZlNldHVwPzoge1xyXG5cdFx0Qmx0bjogc3RyaW5nO1xyXG5cdH0gfCB7XHJcblx0XHRwcm9maWxlOiBzdHJpbmc7XHJcblx0XHRJbnRlOiBzdHJpbmc7XHJcblx0XHRNcEJsOiBib29sZWFuO1xyXG5cdFx0cGFwZXJXaGl0ZTogYm9vbGVhbjtcclxuXHR9O1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwODIsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wcmludEluZm9ybWF0aW9uICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBQcmludEluZm9ybWF0aW9uRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cclxuXHRcdHRhcmdldC5wcmludEluZm9ybWF0aW9uID0ge1xyXG5cdFx0XHRwcmludGVyTmFtZTogZGVzYy5wcmludGVyTmFtZSB8fCAnJyxcclxuXHRcdFx0cmVuZGVyaW5nSW50ZW50OiBJbnRlLmRlY29kZShkZXNjLkludGUgPz8gJ0ludGUuSW1nICcpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LnByaW50SW5mb3JtYXRpb247XHJcblxyXG5cdFx0aWYgKGRlc2MuUHN0UyAhPT0gdW5kZWZpbmVkKSBpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzID0gZGVzYy5Qc3RTO1xyXG5cdFx0aWYgKGRlc2NbJ05tICAnXSAhPT0gdW5kZWZpbmVkKSBpbmZvLnByaW50ZXJQcm9maWxlID0gZGVzY1snTm0gICddO1xyXG5cdFx0aWYgKGRlc2MuTXBCbCAhPT0gdW5kZWZpbmVkKSBpbmZvLmJsYWNrUG9pbnRDb21wZW5zYXRpb24gPSBkZXNjLk1wQmw7XHJcblx0XHRpZiAoZGVzYy5wcmludFNpeHRlZW5CaXQgIT09IHVuZGVmaW5lZCkgaW5mby5wcmludFNpeHRlZW5CaXQgPSBkZXNjLnByaW50U2l4dGVlbkJpdDtcclxuXHRcdGlmIChkZXNjLmhhcmRQcm9vZiAhPT0gdW5kZWZpbmVkKSBpbmZvLmhhcmRQcm9vZiA9IGRlc2MuaGFyZFByb29mO1xyXG5cdFx0aWYgKGRlc2MucHJpbnRQcm9vZlNldHVwKSB7XHJcblx0XHRcdGlmICgnQmx0bicgaW4gZGVzYy5wcmludFByb29mU2V0dXApIHtcclxuXHRcdFx0XHRpbmZvLnByb29mU2V0dXAgPSB7IGJ1aWx0aW46IGRlc2MucHJpbnRQcm9vZlNldHVwLkJsdG4uc3BsaXQoJy4nKVsxXSB9O1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGluZm8ucHJvb2ZTZXR1cCA9IHtcclxuXHRcdFx0XHRcdHByb2ZpbGU6IGRlc2MucHJpbnRQcm9vZlNldHVwLnByb2ZpbGUsXHJcblx0XHRcdFx0XHRyZW5kZXJpbmdJbnRlbnQ6IEludGUuZGVjb2RlKGRlc2MucHJpbnRQcm9vZlNldHVwLkludGUgPz8gJ0ludGUuSW1nICcpLFxyXG5cdFx0XHRcdFx0YmxhY2tQb2ludENvbXBlbnNhdGlvbjogISFkZXNjLnByaW50UHJvb2ZTZXR1cC5NcEJsLFxyXG5cdFx0XHRcdFx0cGFwZXJXaGl0ZTogISFkZXNjLnByaW50UHJvb2ZTZXR1cC5wYXBlcldoaXRlLFxyXG5cdFx0XHRcdH07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5wcmludEluZm9ybWF0aW9uITtcclxuXHRcdGNvbnN0IGRlc2M6IFByaW50SW5mb3JtYXRpb25EZXNjcmlwdG9yID0ge307XHJcblxyXG5cdFx0aWYgKGluZm8ucHJpbnRlck1hbmFnZXNDb2xvcnMpIHtcclxuXHRcdFx0ZGVzYy5Qc3RTID0gdHJ1ZTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlmIChpbmZvLmhhcmRQcm9vZiAhPT0gdW5kZWZpbmVkKSBkZXNjLmhhcmRQcm9vZiA9ICEhaW5mby5oYXJkUHJvb2Y7XHJcblx0XHRcdGRlc2MuQ2xyUyA9ICdDbHJTLlJHQkMnOyAvLyBUT0RPOiA/Pz9cclxuXHRcdFx0ZGVzY1snTm0gICddID0gaW5mby5wcmludGVyUHJvZmlsZSA/PyAnQ0lFIFJHQic7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGVzYy5JbnRlID0gSW50ZS5lbmNvZGUoaW5mby5yZW5kZXJpbmdJbnRlbnQpO1xyXG5cclxuXHRcdGlmICghaW5mby5wcmludGVyTWFuYWdlc0NvbG9ycykgZGVzYy5NcEJsID0gISFpbmZvLmJsYWNrUG9pbnRDb21wZW5zYXRpb247XHJcblxyXG5cdFx0ZGVzYy5wcmludFNpeHRlZW5CaXQgPSAhIWluZm8ucHJpbnRTaXh0ZWVuQml0O1xyXG5cdFx0ZGVzYy5wcmludGVyTmFtZSA9IGluZm8ucHJpbnRlck5hbWUgfHwgJyc7XHJcblxyXG5cdFx0aWYgKGluZm8ucHJvb2ZTZXR1cCAmJiAncHJvZmlsZScgaW4gaW5mby5wcm9vZlNldHVwKSB7XHJcblx0XHRcdGRlc2MucHJpbnRQcm9vZlNldHVwID0ge1xyXG5cdFx0XHRcdHByb2ZpbGU6IGluZm8ucHJvb2ZTZXR1cC5wcm9maWxlIHx8ICcnLFxyXG5cdFx0XHRcdEludGU6IEludGUuZW5jb2RlKGluZm8ucHJvb2ZTZXR1cC5yZW5kZXJpbmdJbnRlbnQpLFxyXG5cdFx0XHRcdE1wQmw6ICEhaW5mby5wcm9vZlNldHVwLmJsYWNrUG9pbnRDb21wZW5zYXRpb24sXHJcblx0XHRcdFx0cGFwZXJXaGl0ZTogISFpbmZvLnByb29mU2V0dXAucGFwZXJXaGl0ZSxcclxuXHRcdFx0fTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGRlc2MucHJpbnRQcm9vZlNldHVwID0ge1xyXG5cdFx0XHRcdEJsdG46IGluZm8ucHJvb2ZTZXR1cD8uYnVpbHRpbiA/IGBidWlsdGluUHJvb2YuJHtpbmZvLnByb29mU2V0dXAuYnVpbHRpbn1gIDogJ2J1aWx0aW5Qcm9vZi5wcm9vZkNNWUsnLFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3ByaW50T3V0cHV0JywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQxMDgzLCAvLyBQcmludCBzdHlsZVxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTA4MyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwODMnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwODMgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cclxuXHRcdC8vIFRPRE86XHJcblx0XHQvLyBjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnMTA4MycsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwODMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMDUsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5yZXNvbHV0aW9uSW5mbyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaG9yaXpvbnRhbFJlc29sdXRpb24gPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBob3Jpem9udGFsUmVzb2x1dGlvblVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCB3aWR0aFVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCB2ZXJ0aWNhbFJlc29sdXRpb24gPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB2ZXJ0aWNhbFJlc29sdXRpb25Vbml0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaGVpZ2h0VW5pdCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHR0YXJnZXQucmVzb2x1dGlvbkluZm8gPSB7XHJcblx0XHRcdGhvcml6b250YWxSZXNvbHV0aW9uLFxyXG5cdFx0XHRob3Jpem9udGFsUmVzb2x1dGlvblVuaXQ6IFJFU09MVVRJT05fVU5JVFNbaG9yaXpvbnRhbFJlc29sdXRpb25Vbml0XSB8fCAnUFBJJyBhcyBhbnksXHJcblx0XHRcdHdpZHRoVW5pdDogTUVBU1VSRU1FTlRfVU5JVFNbd2lkdGhVbml0XSB8fCAnSW5jaGVzJyBhcyBhbnksXHJcblx0XHRcdHZlcnRpY2FsUmVzb2x1dGlvbixcclxuXHRcdFx0dmVydGljYWxSZXNvbHV0aW9uVW5pdDogUkVTT0xVVElPTl9VTklUU1t2ZXJ0aWNhbFJlc29sdXRpb25Vbml0XSB8fCAnUFBJJyBhcyBhbnksXHJcblx0XHRcdGhlaWdodFVuaXQ6IE1FQVNVUkVNRU5UX1VOSVRTW2hlaWdodFVuaXRdIHx8ICdJbmNoZXMnIGFzIGFueSxcclxuXHRcdH07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQucmVzb2x1dGlvbkluZm8hO1xyXG5cclxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgaW5mby5ob3Jpem9udGFsUmVzb2x1dGlvbiB8fCAwKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5tYXgoMSwgUkVTT0xVVElPTl9VTklUUy5pbmRleE9mKGluZm8uaG9yaXpvbnRhbFJlc29sdXRpb25Vbml0KSkpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBNRUFTVVJFTUVOVF9VTklUUy5pbmRleE9mKGluZm8ud2lkdGhVbml0KSkpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBpbmZvLnZlcnRpY2FsUmVzb2x1dGlvbiB8fCAwKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5tYXgoMSwgUkVTT0xVVElPTl9VTklUUy5pbmRleE9mKGluZm8udmVydGljYWxSZXNvbHV0aW9uVW5pdCkpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5tYXgoMSwgTUVBU1VSRU1FTlRfVU5JVFMuaW5kZXhPZihpbmZvLmhlaWdodFVuaXQpKSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmNvbnN0IHByaW50U2NhbGVTdHlsZXMgPSBbJ2NlbnRlcmVkJywgJ3NpemUgdG8gZml0JywgJ3VzZXIgZGVmaW5lZCddO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDYyLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQucHJpbnRTY2FsZSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LnByaW50U2NhbGUgPSB7XHJcblx0XHRcdHN0eWxlOiBwcmludFNjYWxlU3R5bGVzW3JlYWRJbnQxNihyZWFkZXIpXSBhcyBhbnksXHJcblx0XHRcdHg6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdHk6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdHNjYWxlOiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgeyBzdHlsZSwgeCwgeSwgc2NhbGUgfSA9IHRhcmdldC5wcmludFNjYWxlITtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLm1heCgwLCBwcmludFNjYWxlU3R5bGVzLmluZGV4T2Yoc3R5bGUhKSkpO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgeCB8fCAwKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHkgfHwgMCk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCBzY2FsZSB8fCAwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDA2LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMSk7XHJcblx0XHRcdHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcy5wdXNoKHZhbHVlKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyEpIHtcclxuXHRcdFx0d3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyLCBuYW1lLCAxKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDQ1LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzLnB1c2gocmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGZvciAoY29uc3QgbmFtZSBvZiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMhKSB7XHJcblx0XHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgbmFtZSk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQxMDc3LFxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTA3NyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwNzcnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwNzcgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwNzcpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNTMsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5hbHBoYUlkZW50aWZpZXJzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuYWxwaGFJZGVudGlmaWVycyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkgPj0gNCkge1xyXG5cdFx0XHR0YXJnZXQuYWxwaGFJZGVudGlmaWVycy5wdXNoKHJlYWRVaW50MzIocmVhZGVyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGZvciAoY29uc3QgaWQgb2YgdGFyZ2V0LmFscGhhSWRlbnRpZmllcnMhKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgaWQpO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMTAsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5iYWNrZ3JvdW5kQ29sb3IgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5iYWNrZ3JvdW5kQ29sb3IgPSByZWFkQ29sb3IocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlQ29sb3Iod3JpdGVyLCB0YXJnZXQuYmFja2dyb3VuZENvbG9yISksXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMzcsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5nbG9iYWxBbmdsZSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0Lmdsb2JhbEFuZ2xlID0gcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQuZ2xvYmFsQW5nbGUhKSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA0OSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQuZ2xvYmFsQWx0aXR1ZGUgPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5nbG9iYWxBbHRpdHVkZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDExLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQucHJpbnRGbGFncyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LnByaW50RmxhZ3MgPSB7XHJcblx0XHRcdGxhYmVsczogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0Y3JvcE1hcmtzOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRjb2xvckJhcnM6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdHJlZ2lzdHJhdGlvbk1hcmtzOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRuZWdhdGl2ZTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0ZmxpcDogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0aW50ZXJwb2xhdGU6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdGNhcHRpb246ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdHByaW50RmxhZ3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBmbGFncyA9IHRhcmdldC5wcmludEZsYWdzITtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5sYWJlbHMgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY3JvcE1hcmtzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmNvbG9yQmFycyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5yZWdpc3RyYXRpb25NYXJrcyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5uZWdhdGl2ZSA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5mbGlwID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmludGVycG9sYXRlID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmNhcHRpb24gPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MucHJpbnRGbGFncyA/IDEgOiAwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMDAwLCAvLyBQcmludCBmbGFnc1xyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTAwMDAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDAwMCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAwMDAgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwMDAwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMTMsIC8vIENvbG9yIGhhbGZ0b25pbmdcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMTMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDEzJywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDEzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDEzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMTYsIC8vIENvbG9yIHRyYW5zZmVyIGZ1bmN0aW9uc1xyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTAxNiAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMTYnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwMTYgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwMTYpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMjQsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5sYXllclN0YXRlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQubGF5ZXJTdGF0ZSA9IHJlYWRVaW50MTYocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDE2KHdyaXRlciwgdGFyZ2V0LmxheWVyU3RhdGUhKSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAyNixcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyc0dyb3VwICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQubGF5ZXJzR3JvdXAgPSBbXTtcclxuXHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdHRhcmdldC5sYXllcnNHcm91cC5wdXNoKHJlYWRVaW50MTYocmVhZGVyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGZvciAoY29uc3QgZyBvZiB0YXJnZXQubGF5ZXJzR3JvdXAhKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgZyk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA3MixcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyR3JvdXBzRW5hYmxlZElkICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQubGF5ZXJHcm91cHNFbmFibGVkSWQgPSBbXTtcclxuXHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZC5wdXNoKHJlYWRVaW50OChyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBpZCBvZiB0YXJnZXQubGF5ZXJHcm91cHNFbmFibGVkSWQhKSB7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBpZCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2OSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRsZXQgY291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHR0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMgPSBbXTtcclxuXHJcblx0XHR3aGlsZSAoY291bnQtLSkge1xyXG5cdFx0XHR0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMucHVzaChyZWFkVWludDMyKHJlYWRlcikpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHRhcmdldC5sYXllclNlbGVjdGlvbklkcyEubGVuZ3RoKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRhcmdldC5sYXllclNlbGVjdGlvbklkcyEpIHtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpZCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAzMixcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmdyaWRBbmRHdWlkZXNJbmZvcm1hdGlvbiAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGhvcml6b250YWwgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB2ZXJ0aWNhbCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgMTAzMiByZXNvdXJjZSB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdFx0dGFyZ2V0LmdyaWRBbmRHdWlkZXNJbmZvcm1hdGlvbiA9IHtcclxuXHRcdFx0Z3JpZDogeyBob3Jpem9udGFsLCB2ZXJ0aWNhbCB9LFxyXG5cdFx0XHRndWlkZXM6IFtdLFxyXG5cdFx0fTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcclxuXHRcdFx0dGFyZ2V0LmdyaWRBbmRHdWlkZXNJbmZvcm1hdGlvbi5ndWlkZXMhLnB1c2goe1xyXG5cdFx0XHRcdGxvY2F0aW9uOiByZWFkVWludDMyKHJlYWRlcikgLyAzMixcclxuXHRcdFx0XHRkaXJlY3Rpb246IHJlYWRVaW50OChyZWFkZXIpID8gJ2hvcml6b250YWwnIDogJ3ZlcnRpY2FsJ1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5ncmlkQW5kR3VpZGVzSW5mb3JtYXRpb24hO1xyXG5cdFx0Y29uc3QgZ3JpZCA9IGluZm8uZ3JpZCB8fCB7IGhvcml6b250YWw6IDE4ICogMzIsIHZlcnRpY2FsOiAxOCAqIDMyIH07XHJcblx0XHRjb25zdCBndWlkZXMgPSBpbmZvLmd1aWRlcyB8fCBbXTtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDEpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBncmlkLmhvcml6b250YWwpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBncmlkLnZlcnRpY2FsKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgZ3VpZGVzLmxlbmd0aCk7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBnIG9mIGd1aWRlcykge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGcubG9jYXRpb24gKiAzMik7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBnLmRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnID8gMSA6IDApO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNTQsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC51cmxzTGlzdCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgXywgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKGNvdW50KSB7XHJcblx0XHRcdGlmICghb3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykgcmV0dXJuO1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZDogVVJMIExpc3QnKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUT0RPOiByZWFkIGFjdHVhbCBVUkwgbGlzdFxyXG5cdFx0dGFyZ2V0LnVybHNMaXN0ID0gW107XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0LnVybHNMaXN0IS5sZW5ndGgpO1xyXG5cclxuXHRcdC8vIFRPRE86IHdyaXRlIGFjdHVhbCBVUkwgbGlzdFxyXG5cdFx0aWYgKHRhcmdldC51cmxzTGlzdCEubGVuZ3RoKSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkOiBVUkwgTGlzdCcpO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTA1MCwgLy8gU2xpY2VzXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDUwICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA1MCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA1MCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA1MCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2NCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnBpeGVsQXNwZWN0UmF0aW8gIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDMyKHJlYWRlcikgPiAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGl4ZWxBc3BlY3RSYXRpbyB2ZXJzaW9uJyk7XHJcblx0XHR0YXJnZXQucGl4ZWxBc3BlY3RSYXRpbyA9IHsgYXNwZWN0OiByZWFkRmxvYXQ2NChyZWFkZXIpIH07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMik7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHRhcmdldC5waXhlbEFzcGVjdFJhdGlvIS5hc3BlY3QpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNDEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5pY2NVbnRhZ2dlZFByb2ZpbGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5pY2NVbnRhZ2dlZFByb2ZpbGUgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgdGFyZ2V0LmljY1VudGFnZ2VkUHJvZmlsZSA/IDEgOiAwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMzksIC8vIElDQyBQcm9maWxlXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDM5ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAzOScsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAzOSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAzOSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA0NCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmlkc1NlZWROdW1iZXIgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5pZHNTZWVkTnVtYmVyID0gcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQuaWRzU2VlZE51bWJlciEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDM2LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQudGh1bWJuYWlsICE9PSB1bmRlZmluZWQgfHwgdGFyZ2V0LnRodW1ibmFpbFJhdyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgZm9ybWF0ID0gcmVhZFVpbnQzMihyZWFkZXIpOyAvLyAxID0ga0pwZWdSR0IsIDAgPSBrUmF3UkdCXHJcblx0XHRjb25zdCB3aWR0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGhlaWdodCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gd2lkdGhCeXRlcyA9ICh3aWR0aCAqIGJpdHNfcGVyX3BpeGVsICsgMzEpIC8gMzIgKiA0LlxyXG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyB0b3RhbFNpemUgPSB3aWR0aEJ5dGVzICogaGVpZ2h0ICogcGxhbmVzXHJcblx0XHRyZWFkVWludDMyKHJlYWRlcik7IC8vIHNpemVBZnRlckNvbXByZXNzaW9uXHJcblx0XHRjb25zdCBiaXRzUGVyUGl4ZWwgPSByZWFkVWludDE2KHJlYWRlcik7IC8vIDI0XHJcblx0XHRjb25zdCBwbGFuZXMgPSByZWFkVWludDE2KHJlYWRlcik7IC8vIDFcclxuXHJcblx0XHRpZiAoZm9ybWF0ICE9PSAxIHx8IGJpdHNQZXJQaXhlbCAhPT0gMjQgfHwgcGxhbmVzICE9PSAxKSB7XHJcblx0XHRcdG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIHRodW1ibmFpbCBkYXRhIChmb3JtYXQ6ICR7Zm9ybWF0fSwgYml0c1BlclBpeGVsOiAke2JpdHNQZXJQaXhlbH0sIHBsYW5lczogJHtwbGFuZXN9KWApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qgc2l6ZSA9IGxlZnQoKTtcclxuXHRcdGNvbnN0IGRhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBzaXplKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy51c2VSYXdUaHVtYm5haWwpIHtcclxuXHRcdFx0dGFyZ2V0LnRodW1ibmFpbFJhdyA9IHsgd2lkdGgsIGhlaWdodCwgZGF0YSB9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGFyZ2V0LnRodW1ibmFpbCA9IGNyZWF0ZUNhbnZhc0Zyb21EYXRhKGRhdGEpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRsZXQgd2lkdGggPSAwO1xyXG5cdFx0bGV0IGhlaWdodCA9IDA7XHJcblx0XHRsZXQgZGF0YTogVWludDhBcnJheTtcclxuXHJcblx0XHRpZiAodGFyZ2V0LnRodW1ibmFpbFJhdykge1xyXG5cdFx0XHR3aWR0aCA9IHRhcmdldC50aHVtYm5haWxSYXcud2lkdGg7XHJcblx0XHRcdGhlaWdodCA9IHRhcmdldC50aHVtYm5haWxSYXcuaGVpZ2h0O1xyXG5cdFx0XHRkYXRhID0gdGFyZ2V0LnRodW1ibmFpbFJhdy5kYXRhO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aWYgKCF0YXJnZXQudGh1bWJuYWlsKSB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgdGh1bWJuYWlsJyk7XHJcblx0XHRcdHdpZHRoID0gdGFyZ2V0LnRodW1ibmFpbC53aWR0aDtcclxuXHRcdFx0aGVpZ2h0ID0gdGFyZ2V0LnRodW1ibmFpbC5oZWlnaHQ7XHJcblx0XHRcdGRhdGEgPSB0b0J5dGVBcnJheSh0YXJnZXQudGh1bWJuYWlsLnRvRGF0YVVSTCgnaW1hZ2UvanBlZycsIDEpLnN1YnN0cignZGF0YTppbWFnZS9qcGVnO2Jhc2U2NCwnLmxlbmd0aCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGJpdHNQZXJQaXhlbCA9IDI0O1xyXG5cdFx0Y29uc3Qgd2lkdGhCeXRlcyA9IE1hdGguZmxvb3IoKHdpZHRoICogYml0c1BlclBpeGVsICsgMzEpIC8gMzIpICogNDtcclxuXHRcdGNvbnN0IHBsYW5lcyA9IDE7XHJcblx0XHRjb25zdCB0b3RhbFNpemUgPSB3aWR0aEJ5dGVzICogaGVpZ2h0ICogcGxhbmVzO1xyXG5cdFx0Y29uc3Qgc2l6ZUFmdGVyQ29tcHJlc3Npb24gPSBkYXRhLmxlbmd0aDtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDEpOyAvLyAxID0ga0pwZWdSR0JcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgd2lkdGgpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBoZWlnaHQpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB3aWR0aEJ5dGVzKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdG90YWxTaXplKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgc2l6ZUFmdGVyQ29tcHJlc3Npb24pO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBiaXRzUGVyUGl4ZWwpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBwbGFuZXMpO1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIGRhdGEpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNTcsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC52ZXJzaW9uSW5mbyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdmVyc2lvbkluZm8gdmVyc2lvbicpO1xyXG5cclxuXHRcdHRhcmdldC52ZXJzaW9uSW5mbyA9IHtcclxuXHRcdFx0aGFzUmVhbE1lcmdlZERhdGE6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdHdyaXRlck5hbWU6IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlciksXHJcblx0XHRcdHJlYWRlck5hbWU6IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlciksXHJcblx0XHRcdGZpbGVWZXJzaW9uOiByZWFkVWludDMyKHJlYWRlciksXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHZlcnNpb25JbmZvID0gdGFyZ2V0LnZlcnNpb25JbmZvITtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB2ZXJzaW9uSW5mby5oYXNSZWFsTWVyZ2VkRGF0YSA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXIsIHZlcnNpb25JbmZvLndyaXRlck5hbWUpO1xyXG5cdFx0d3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlciwgdmVyc2lvbkluZm8ucmVhZGVyTmFtZSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIHZlcnNpb25JbmZvLmZpbGVWZXJzaW9uKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwNTgsIC8vIEVYSUYgZGF0YSAxLlxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwNTgnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwNTggPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwNTgpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDcwMDAsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5pbWFnZVJlYWR5VmFyaWFibGVzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuaW1hZ2VSZWFkeVZhcmlhYmxlcyA9IHJlYWRVdGY4U3RyaW5nKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVdGY4U3RyaW5nKHdyaXRlciwgdGFyZ2V0LmltYWdlUmVhZHlWYXJpYWJsZXMhKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQ3MDAxLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuaW1hZ2VSZWFkeURhdGFTZXRzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuaW1hZ2VSZWFkeURhdGFTZXRzID0gcmVhZFV0ZjhTdHJpbmcocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVV0ZjhTdHJpbmcod3JpdGVyLCB0YXJnZXQuaW1hZ2VSZWFkeURhdGFTZXRzISk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBEZXNjcmlwdG9yMTA4OCB7XHJcblx0J251bGwnOiBzdHJpbmdbXTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDg4LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQucGF0aFNlbGVjdGlvblN0YXRlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBfbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYzogRGVzY3JpcHRvcjEwODggPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0dGFyZ2V0LnBhdGhTZWxlY3Rpb25TdGF0ZSA9IGRlc2NbJ251bGwnXTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYzogRGVzY3JpcHRvcjEwODggPSB7ICdudWxsJzogdGFyZ2V0LnBhdGhTZWxlY3Rpb25TdGF0ZSEgfTtcclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwMjUsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDI1ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAyNScsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAyNSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAyNSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmNvbnN0IEZybUQgPSBjcmVhdGVFbnVtPCdhdXRvJyB8ICdub25lJyB8ICdkaXNwb3NlJz4oJ0ZybUQnLCAnJywge1xyXG5cdGF1dG86ICdBdXRvJyxcclxuXHRub25lOiAnTm9uZScsXHJcblx0ZGlzcG9zZTogJ0Rpc3AnLFxyXG59KTtcclxuXHJcbmludGVyZmFjZSBBbmltYXRpb25EZXNjcmlwdG9yIHtcclxuXHRBRlN0OiBudW1iZXI7XHJcblx0RnJJbjoge1xyXG5cdFx0RnJJRDogbnVtYmVyO1xyXG5cdFx0RnJEbDogbnVtYmVyO1xyXG5cdFx0RnJEczogc3RyaW5nO1xyXG5cdFx0RnJHQT86IG51bWJlcjtcclxuXHR9W107XHJcblx0RlN0czoge1xyXG5cdFx0RnNJRDogbnVtYmVyO1xyXG5cdFx0QUZybTogbnVtYmVyO1xyXG5cdFx0RnNGcjogbnVtYmVyW107XHJcblx0XHRMQ250OiBudW1iZXI7XHJcblx0fVtdO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgQW5pbWF0aW9ucyB7XHJcblx0ZnJhbWVzOiB7XHJcblx0XHRpZDogbnVtYmVyO1xyXG5cdFx0ZGVsYXk6IG51bWJlcjtcclxuXHRcdGRpc3Bvc2U/OiAnYXV0bycgfCAnbm9uZScgfCAnZGlzcG9zZSc7XHJcblx0fVtdO1xyXG5cdGFuaW1hdGlvbnM6IHtcclxuXHRcdGlkOiBudW1iZXI7XHJcblx0XHRmcmFtZXM6IG51bWJlcltdO1xyXG5cdFx0cmVwZWF0cz86IG51bWJlcjtcclxuXHR9W107XHJcbn1cclxuXHJcbi8vIFRPRE86IFVuZmluaXNoZWRcclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDQwMDAsIC8vIFBsdWctSW4gcmVzb3VyY2UocylcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjQwMDAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzLCBsb2dEZXZGZWF0dXJlcyB9KSA9PiB7XHJcblx0XHRpZiAoTU9DS19IQU5ETEVSUykge1xyXG5cdFx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgNDAwMCcsIGxlZnQoKSk7XHJcblx0XHRcdCh0YXJnZXQgYXMgYW55KS5faXI0MDAwID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRpZiAoa2V5ID09PSAnbWFuaScpIHtcclxuXHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnSVJGUicpO1xyXG5cdFx0XHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0XHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0XHRcdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcclxuXHRcdFx0XHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0XHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0XHRcdFx0XHRpZiAoa2V5ID09PSAnQW5EcycpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgQW5pbWF0aW9uRGVzY3JpcHRvcjtcclxuXHRcdFx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZygnQW5EcycsIGRlc2MpO1xyXG5cdFx0XHRcdFx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzJywgZGVzYyk7XHJcblx0XHRcdFx0XHRcdFx0Ly8gbG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIEFuRHMnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0OiBBbmltYXRpb25zID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gZGVzYy5BRlN0ID8/P1xyXG5cdFx0XHRcdFx0XHRcdFx0ZnJhbWVzOiBkZXNjLkZySW4ubWFwKHggPT4gKHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0aWQ6IHguRnJJRCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZGVsYXk6IHguRnJEbCAvIDEwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0ZGlzcG9zZTogeC5GckRzID8gRnJtRC5kZWNvZGUoeC5GckRzKSA6ICdhdXRvJywgLy8gbWlzc2luZyA9PSBhdXRvXHJcblx0XHRcdFx0XHRcdFx0XHRcdC8vIHguRnJHQSA/Pz9cclxuXHRcdFx0XHRcdFx0XHRcdH0pKSxcclxuXHRcdFx0XHRcdFx0XHRcdGFuaW1hdGlvbnM6IGRlc2MuRlN0cy5tYXAoeCA9PiAoe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogeC5Gc0lELFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRmcmFtZXM6IHguRnNGcixcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmVwZWF0czogeC5MQ250LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyB4LkFGcm0gPz8/XHJcblx0XHRcdFx0XHRcdFx0XHR9KSksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIEFuRHM6cmVzdWx0JywgcmVzdWx0KTtcclxuXHRcdFx0XHRcdFx0XHQvLyBsb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnIzQwMDAgQW5EczpyZXN1bHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChyZXN1bHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ1JvbGwnKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgYnl0ZXMgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdFx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBSb2xsJywgYnl0ZXMpO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIHN1YnNlY3Rpb24gaW4gIzQwMDAnLCBrZXkpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdtb3B0Jykge1xyXG5cdFx0XHRjb25zdCBieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBtb3B0JywgYnl0ZXMpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdVbmhhbmRsZWQga2V5IGluICM0MDAwOicsIGtleSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXI0MDAwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuLy8gVE9ETzogVW5maW5pc2hlZFxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0NDAwMSwgLy8gUGx1Zy1JbiByZXNvdXJjZShzKVxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyNDAwMSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgeyBsb2dNaXNzaW5nRmVhdHVyZXMsIGxvZ0RldkZlYXR1cmVzIH0pID0+IHtcclxuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSB7XHJcblx0XHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSA0MDAxJywgbGVmdCgpKTtcclxuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9pcjQwMDEgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdGlmIChrZXkgPT09ICdtZnJpJykge1xyXG5cdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRpZiAodmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG1mcmkgdmVyc2lvbicpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdtZnJpJywgYnl0ZXMpO1xyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdtc2V0Jykge1xyXG5cdFx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdtc2V0JywgZGVzYyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRsb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBrZXkgaW4gIzQwMDEnLCBrZXkpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjQwMDEpO1xyXG5cdH0sXHJcbik7XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
