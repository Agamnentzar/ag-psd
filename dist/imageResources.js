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
    var buffer = (0, psdReader_1.readBytes)(reader, length);
    return (0, utf8_1.decodeString)(buffer);
}
function writeUtf8String(writer, value) {
    var buffer = (0, utf8_1.encodeString)(value);
    (0, psdWriter_1.writeBytes)(writer, buffer);
}
helpers_1.MOCK_HANDLERS && addHandler(1028, // IPTC-NAA record
function (// IPTC-NAA record
target) { return target._ir1028 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1028', left());
    target._ir1028 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1028);
});
addHandler(1061, function (target) { return target.captionDigest !== undefined; }, function (reader, target) {
    var captionDigest = '';
    for (var i = 0; i < 16; i++) {
        var byte = (0, psdReader_1.readUint8)(reader);
        captionDigest += hex[byte >> 4];
        captionDigest += hex[byte & 0xf];
    }
    target.captionDigest = captionDigest;
}, function (writer, target) {
    for (var i = 0; i < 16; i++) {
        (0, psdWriter_1.writeUint8)(writer, byteAt(target.captionDigest, i * 2));
    }
});
addHandler(1060, function (target) { return target.xmpMetadata !== undefined; }, function (reader, target, left) { return target.xmpMetadata = readUtf8String(reader, left()); }, function (writer, target) { return writeUtf8String(writer, target.xmpMetadata); });
var Inte = (0, helpers_1.createEnum)('Inte', 'perceptual', {
    'perceptual': 'Img ',
    'saturation': 'Grp ',
    'relative colorimetric': 'Clrm',
    'absolute colorimetric': 'AClr',
});
addHandler(1082, function (target) { return target.printInformation !== undefined; }, function (reader, target) {
    var _a, _b;
    var desc = (0, descriptor_1.readVersionAndDescriptor)(reader);
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
            Bltn: ((_b = info.proofSetup) === null || _b === void 0 ? void 0 : _b.builtin) ? "builtinProof.".concat(info.proofSetup.builtin) : 'builtinProof.proofCMYK',
        };
    }
    (0, descriptor_1.writeVersionAndDescriptor)(writer, '', 'printOutput', desc);
});
helpers_1.MOCK_HANDLERS && addHandler(1083, // Print style
function (// Print style
target) { return target._ir1083 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1083', left());
    target._ir1083 = (0, psdReader_1.readBytes)(reader, left());
    // TODO:
    // const desc = readVersionAndDescriptor(reader);
    // console.log('1083', require('util').inspect(desc, false, 99, true));
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1083);
});
addHandler(1005, function (target) { return target.resolutionInfo !== undefined; }, function (reader, target) {
    var horizontalResolution = (0, psdReader_1.readFixedPoint32)(reader);
    var horizontalResolutionUnit = (0, psdReader_1.readUint16)(reader);
    var widthUnit = (0, psdReader_1.readUint16)(reader);
    var verticalResolution = (0, psdReader_1.readFixedPoint32)(reader);
    var verticalResolutionUnit = (0, psdReader_1.readUint16)(reader);
    var heightUnit = (0, psdReader_1.readUint16)(reader);
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
    (0, psdWriter_1.writeFixedPoint32)(writer, info.horizontalResolution || 0);
    (0, psdWriter_1.writeUint16)(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
    (0, psdWriter_1.writeUint16)(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
    (0, psdWriter_1.writeFixedPoint32)(writer, info.verticalResolution || 0);
    (0, psdWriter_1.writeUint16)(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
    (0, psdWriter_1.writeUint16)(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
});
var printScaleStyles = ['centered', 'size to fit', 'user defined'];
addHandler(1062, function (target) { return target.printScale !== undefined; }, function (reader, target) {
    target.printScale = {
        style: printScaleStyles[(0, psdReader_1.readInt16)(reader)],
        x: (0, psdReader_1.readFloat32)(reader),
        y: (0, psdReader_1.readFloat32)(reader),
        scale: (0, psdReader_1.readFloat32)(reader),
    };
}, function (writer, target) {
    var _a = target.printScale, style = _a.style, x = _a.x, y = _a.y, scale = _a.scale;
    (0, psdWriter_1.writeInt16)(writer, Math.max(0, printScaleStyles.indexOf(style)));
    (0, psdWriter_1.writeFloat32)(writer, x || 0);
    (0, psdWriter_1.writeFloat32)(writer, y || 0);
    (0, psdWriter_1.writeFloat32)(writer, scale || 0);
});
addHandler(1006, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        var value = (0, psdReader_1.readPascalString)(reader, 1);
        target.alphaChannelNames.push(value);
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_1 = _a[_i];
        (0, psdWriter_1.writePascalString)(writer, name_1, 1);
    }
});
addHandler(1045, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        target.alphaChannelNames.push((0, psdReader_1.readUnicodeString)(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_2 = _a[_i];
        (0, psdWriter_1.writeUnicodeStringWithPadding)(writer, name_2);
    }
});
helpers_1.MOCK_HANDLERS && addHandler(1077, function (target) { return target._ir1077 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1077', left());
    target._ir1077 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1077);
});
addHandler(1053, function (target) { return target.alphaIdentifiers !== undefined; }, function (reader, target, left) {
    target.alphaIdentifiers = [];
    while (left() >= 4) {
        target.alphaIdentifiers.push((0, psdReader_1.readUint32)(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaIdentifiers; _i < _a.length; _i++) {
        var id = _a[_i];
        (0, psdWriter_1.writeUint32)(writer, id);
    }
});
addHandler(1010, function (target) { return target.backgroundColor !== undefined; }, function (reader, target) { return target.backgroundColor = (0, psdReader_1.readColor)(reader); }, function (writer, target) { return (0, psdWriter_1.writeColor)(writer, target.backgroundColor); });
addHandler(1037, function (target) { return target.globalAngle !== undefined; }, function (reader, target) { return target.globalAngle = (0, psdReader_1.readUint32)(reader); }, function (writer, target) { return (0, psdWriter_1.writeUint32)(writer, target.globalAngle); });
addHandler(1049, function (target) { return target.globalAltitude !== undefined; }, function (reader, target) { return target.globalAltitude = (0, psdReader_1.readUint32)(reader); }, function (writer, target) { return (0, psdWriter_1.writeUint32)(writer, target.globalAltitude); });
addHandler(1011, function (target) { return target.printFlags !== undefined; }, function (reader, target) {
    target.printFlags = {
        labels: !!(0, psdReader_1.readUint8)(reader),
        cropMarks: !!(0, psdReader_1.readUint8)(reader),
        colorBars: !!(0, psdReader_1.readUint8)(reader),
        registrationMarks: !!(0, psdReader_1.readUint8)(reader),
        negative: !!(0, psdReader_1.readUint8)(reader),
        flip: !!(0, psdReader_1.readUint8)(reader),
        interpolate: !!(0, psdReader_1.readUint8)(reader),
        caption: !!(0, psdReader_1.readUint8)(reader),
        printFlags: !!(0, psdReader_1.readUint8)(reader),
    };
}, function (writer, target) {
    var flags = target.printFlags;
    (0, psdWriter_1.writeUint8)(writer, flags.labels ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.cropMarks ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.colorBars ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.registrationMarks ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.negative ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.flip ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.interpolate ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.caption ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, flags.printFlags ? 1 : 0);
});
helpers_1.MOCK_HANDLERS && addHandler(10000, // Print flags
function (// Print flags
target) { return target._ir10000 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 10000', left());
    target._ir10000 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir10000);
});
helpers_1.MOCK_HANDLERS && addHandler(1013, // Color halftoning
function (// Color halftoning
target) { return target._ir1013 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1013', left());
    target._ir1013 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1013);
});
helpers_1.MOCK_HANDLERS && addHandler(1016, // Color transfer functions
function (// Color transfer functions
target) { return target._ir1016 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1016', left());
    target._ir1016 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1016);
});
addHandler(1024, function (target) { return target.layerState !== undefined; }, function (reader, target) { return target.layerState = (0, psdReader_1.readUint16)(reader); }, function (writer, target) { return (0, psdWriter_1.writeUint16)(writer, target.layerState); });
addHandler(1026, function (target) { return target.layersGroup !== undefined; }, function (reader, target, left) {
    target.layersGroup = [];
    while (left()) {
        target.layersGroup.push((0, psdReader_1.readUint16)(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layersGroup; _i < _a.length; _i++) {
        var g = _a[_i];
        (0, psdWriter_1.writeUint16)(writer, g);
    }
});
addHandler(1072, function (target) { return target.layerGroupsEnabledId !== undefined; }, function (reader, target, left) {
    target.layerGroupsEnabledId = [];
    while (left()) {
        target.layerGroupsEnabledId.push((0, psdReader_1.readUint8)(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layerGroupsEnabledId; _i < _a.length; _i++) {
        var id = _a[_i];
        (0, psdWriter_1.writeUint8)(writer, id);
    }
});
addHandler(1069, function (target) { return target.layerSelectionIds !== undefined; }, function (reader, target) {
    var count = (0, psdReader_1.readUint16)(reader);
    target.layerSelectionIds = [];
    while (count--) {
        target.layerSelectionIds.push((0, psdReader_1.readUint32)(reader));
    }
}, function (writer, target) {
    (0, psdWriter_1.writeUint16)(writer, target.layerSelectionIds.length);
    for (var _i = 0, _a = target.layerSelectionIds; _i < _a.length; _i++) {
        var id = _a[_i];
        (0, psdWriter_1.writeUint32)(writer, id);
    }
});
addHandler(1032, function (target) { return target.gridAndGuidesInformation !== undefined; }, function (reader, target) {
    var version = (0, psdReader_1.readUint32)(reader);
    var horizontal = (0, psdReader_1.readUint32)(reader);
    var vertical = (0, psdReader_1.readUint32)(reader);
    var count = (0, psdReader_1.readUint32)(reader);
    if (version !== 1)
        throw new Error("Invalid 1032 resource version: ".concat(version));
    target.gridAndGuidesInformation = {
        grid: { horizontal: horizontal, vertical: vertical },
        guides: [],
    };
    for (var i = 0; i < count; i++) {
        target.gridAndGuidesInformation.guides.push({
            location: (0, psdReader_1.readUint32)(reader) / 32,
            direction: (0, psdReader_1.readUint8)(reader) ? 'horizontal' : 'vertical'
        });
    }
}, function (writer, target) {
    var info = target.gridAndGuidesInformation;
    var grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
    var guides = info.guides || [];
    (0, psdWriter_1.writeUint32)(writer, 1);
    (0, psdWriter_1.writeUint32)(writer, grid.horizontal);
    (0, psdWriter_1.writeUint32)(writer, grid.vertical);
    (0, psdWriter_1.writeUint32)(writer, guides.length);
    for (var _i = 0, guides_1 = guides; _i < guides_1.length; _i++) {
        var g = guides_1[_i];
        (0, psdWriter_1.writeUint32)(writer, g.location * 32);
        (0, psdWriter_1.writeUint8)(writer, g.direction === 'horizontal' ? 1 : 0);
    }
});
addHandler(1054, function (target) { return target.urlsList !== undefined; }, function (reader, target, _, options) {
    var count = (0, psdReader_1.readUint32)(reader);
    if (count) {
        if (!options.throwForMissingFeatures)
            return;
        throw new Error('Not implemented: URL List');
    }
    // TODO: read actual URL list
    target.urlsList = [];
}, function (writer, target) {
    (0, psdWriter_1.writeUint32)(writer, target.urlsList.length);
    // TODO: write actual URL list
    if (target.urlsList.length) {
        throw new Error('Not implemented: URL List');
    }
});
helpers_1.MOCK_HANDLERS && addHandler(1050, // Slices
function (// Slices
target) { return target._ir1050 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1050', left());
    target._ir1050 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1050);
});
addHandler(1064, function (target) { return target.pixelAspectRatio !== undefined; }, function (reader, target) {
    if ((0, psdReader_1.readUint32)(reader) > 2)
        throw new Error('Invalid pixelAspectRatio version');
    target.pixelAspectRatio = { aspect: (0, psdReader_1.readFloat64)(reader) };
}, function (writer, target) {
    (0, psdWriter_1.writeUint32)(writer, 2); // version
    (0, psdWriter_1.writeFloat64)(writer, target.pixelAspectRatio.aspect);
});
addHandler(1041, function (target) { return target.iccUntaggedProfile !== undefined; }, function (reader, target) {
    target.iccUntaggedProfile = !!(0, psdReader_1.readUint8)(reader);
}, function (writer, target) {
    (0, psdWriter_1.writeUint8)(writer, target.iccUntaggedProfile ? 1 : 0);
});
helpers_1.MOCK_HANDLERS && addHandler(1039, // ICC Profile
function (// ICC Profile
target) { return target._ir1039 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1039', left());
    target._ir1039 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1039);
});
addHandler(1044, function (target) { return target.idsSeedNumber !== undefined; }, function (reader, target) { return target.idsSeedNumber = (0, psdReader_1.readUint32)(reader); }, function (writer, target) { return (0, psdWriter_1.writeUint32)(writer, target.idsSeedNumber); });
addHandler(1036, function (target) { return target.thumbnail !== undefined || target.thumbnailRaw !== undefined; }, function (reader, target, left, options) {
    var format = (0, psdReader_1.readUint32)(reader); // 1 = kJpegRGB, 0 = kRawRGB
    var width = (0, psdReader_1.readUint32)(reader);
    var height = (0, psdReader_1.readUint32)(reader);
    (0, psdReader_1.readUint32)(reader); // widthBytes = (width * bits_per_pixel + 31) / 32 * 4.
    (0, psdReader_1.readUint32)(reader); // totalSize = widthBytes * height * planes
    (0, psdReader_1.readUint32)(reader); // sizeAfterCompression
    var bitsPerPixel = (0, psdReader_1.readUint16)(reader); // 24
    var planes = (0, psdReader_1.readUint16)(reader); // 1
    if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
        options.logMissingFeatures && console.log("Invalid thumbnail data (format: ".concat(format, ", bitsPerPixel: ").concat(bitsPerPixel, ", planes: ").concat(planes, ")"));
        (0, psdReader_1.skipBytes)(reader, left());
        return;
    }
    var size = left();
    var data = (0, psdReader_1.readBytes)(reader, size);
    if (options.useRawThumbnail) {
        target.thumbnailRaw = { width: width, height: height, data: data };
    }
    else {
        target.thumbnail = (0, helpers_1.createCanvasFromData)(data);
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
        data = (0, base64_js_1.toByteArray)(target.thumbnail.toDataURL('image/jpeg', 1).substr('data:image/jpeg;base64,'.length));
    }
    var bitsPerPixel = 24;
    var widthBytes = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
    var planes = 1;
    var totalSize = widthBytes * height * planes;
    var sizeAfterCompression = data.length;
    (0, psdWriter_1.writeUint32)(writer, 1); // 1 = kJpegRGB
    (0, psdWriter_1.writeUint32)(writer, width);
    (0, psdWriter_1.writeUint32)(writer, height);
    (0, psdWriter_1.writeUint32)(writer, widthBytes);
    (0, psdWriter_1.writeUint32)(writer, totalSize);
    (0, psdWriter_1.writeUint32)(writer, sizeAfterCompression);
    (0, psdWriter_1.writeUint16)(writer, bitsPerPixel);
    (0, psdWriter_1.writeUint16)(writer, planes);
    (0, psdWriter_1.writeBytes)(writer, data);
});
addHandler(1057, function (target) { return target.versionInfo !== undefined; }, function (reader, target, left) {
    var version = (0, psdReader_1.readUint32)(reader);
    if (version !== 1)
        throw new Error('Invalid versionInfo version');
    target.versionInfo = {
        hasRealMergedData: !!(0, psdReader_1.readUint8)(reader),
        writerName: (0, psdReader_1.readUnicodeString)(reader),
        readerName: (0, psdReader_1.readUnicodeString)(reader),
        fileVersion: (0, psdReader_1.readUint32)(reader),
    };
    (0, psdReader_1.skipBytes)(reader, left());
}, function (writer, target) {
    var versionInfo = target.versionInfo;
    (0, psdWriter_1.writeUint32)(writer, 1); // version
    (0, psdWriter_1.writeUint8)(writer, versionInfo.hasRealMergedData ? 1 : 0);
    (0, psdWriter_1.writeUnicodeString)(writer, versionInfo.writerName);
    (0, psdWriter_1.writeUnicodeString)(writer, versionInfo.readerName);
    (0, psdWriter_1.writeUint32)(writer, versionInfo.fileVersion);
});
helpers_1.MOCK_HANDLERS && addHandler(1058, // EXIF data 1.
function (// EXIF data 1.
target) { return target._ir1058 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1058', left());
    target._ir1058 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1058);
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
    var desc = (0, descriptor_1.readVersionAndDescriptor)(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.pathSelectionState = desc['null'];
}, function (writer, target) {
    var desc = { 'null': target.pathSelectionState };
    (0, descriptor_1.writeVersionAndDescriptor)(writer, '', 'null', desc);
});
helpers_1.MOCK_HANDLERS && addHandler(1025, function (target) { return target._ir1025 !== undefined; }, function (reader, target, left) {
    LOG_MOCK_HANDLERS && console.log('image resource 1025', left());
    target._ir1025 = (0, psdReader_1.readBytes)(reader, left());
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir1025);
});
var FrmD = (0, helpers_1.createEnum)('FrmD', '', {
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
        target._ir4000 = (0, psdReader_1.readBytes)(reader, left());
        return;
    }
    var key = (0, psdReader_1.readSignature)(reader);
    if (key === 'mani') {
        (0, psdReader_1.checkSignature)(reader, 'IRFR');
        (0, psdReader_1.readSection)(reader, 1, function (left) {
            var _loop_1 = function () {
                (0, psdReader_1.checkSignature)(reader, '8BIM');
                var key_1 = (0, psdReader_1.readSignature)(reader);
                (0, psdReader_1.readSection)(reader, 1, function (left) {
                    if (key_1 === 'AnDs') {
                        var desc = (0, descriptor_1.readVersionAndDescriptor)(reader);
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
                        var bytes = (0, psdReader_1.readBytes)(reader, left());
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
        var bytes = (0, psdReader_1.readBytes)(reader, left());
        logDevFeatures && console.log('#4000 mopt', bytes);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4000:', key);
        return;
    }
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir4000);
});
// TODO: Unfinished
helpers_1.MOCK_HANDLERS && addHandler(4001, // Plug-In resource(s)
function (// Plug-In resource(s)
target) { return target._ir4001 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (helpers_1.MOCK_HANDLERS) {
        LOG_MOCK_HANDLERS && console.log('image resource 4001', left());
        target._ir4001 = (0, psdReader_1.readBytes)(reader, left());
        return;
    }
    var key = (0, psdReader_1.readSignature)(reader);
    if (key === 'mfri') {
        var version = (0, psdReader_1.readUint32)(reader);
        if (version !== 2)
            throw new Error('Invalid mfri version');
        var length_1 = (0, psdReader_1.readUint32)(reader);
        var bytes = (0, psdReader_1.readBytes)(reader, length_1);
        logDevFeatures && console.log('mfri', bytes);
    }
    else if (key === 'mset') {
        var desc = (0, descriptor_1.readVersionAndDescriptor)(reader);
        logDevFeatures && console.log('mset', desc);
    }
    else {
        logMissingFeatures && console.log('Unhandled key in #4001', key);
    }
}, function (writer, target) {
    (0, psdWriter_1.writeBytes)(writer, target._ir4001);
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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ZmlsZSI6ImltYWdlUmVzb3VyY2VzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdG9CeXRlQXJyYXkgfSBmcm9tICdiYXNlNjQtanMnO1xyXG5pbXBvcnQgeyBJbWFnZVJlc291cmNlcywgUmVhZE9wdGlvbnMsIFJlbmRlcmluZ0ludGVudCB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRQc2RSZWFkZXIsIHJlYWRQYXNjYWxTdHJpbmcsIHJlYWRVbmljb2RlU3RyaW5nLCByZWFkVWludDMyLCByZWFkVWludDE2LCByZWFkVWludDgsIHJlYWRGbG9hdDY0LFxyXG5cdHJlYWRCeXRlcywgc2tpcEJ5dGVzLCByZWFkRmxvYXQzMiwgcmVhZEludDE2LCByZWFkRml4ZWRQb2ludDMyLCByZWFkU2lnbmF0dXJlLCBjaGVja1NpZ25hdHVyZSxcclxuXHRyZWFkU2VjdGlvbiwgcmVhZENvbG9yXHJcbn0gZnJvbSAnLi9wc2RSZWFkZXInO1xyXG5pbXBvcnQge1xyXG5cdFBzZFdyaXRlciwgd3JpdGVQYXNjYWxTdHJpbmcsIHdyaXRlVW5pY29kZVN0cmluZywgd3JpdGVVaW50MzIsIHdyaXRlVWludDgsIHdyaXRlRmxvYXQ2NCwgd3JpdGVVaW50MTYsXHJcblx0d3JpdGVCeXRlcywgd3JpdGVJbnQxNiwgd3JpdGVGbG9hdDMyLCB3cml0ZUZpeGVkUG9pbnQzMiwgd3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcsIHdyaXRlQ29sb3IsXHJcbn0gZnJvbSAnLi9wc2RXcml0ZXInO1xyXG5pbXBvcnQgeyBjcmVhdGVDYW52YXNGcm9tRGF0YSwgY3JlYXRlRW51bSwgTU9DS19IQU5ETEVSUyB9IGZyb20gJy4vaGVscGVycyc7XHJcbmltcG9ydCB7IGRlY29kZVN0cmluZywgZW5jb2RlU3RyaW5nIH0gZnJvbSAnLi91dGY4JztcclxuaW1wb3J0IHsgcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yLCB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yIH0gZnJvbSAnLi9kZXNjcmlwdG9yJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVzb3VyY2VIYW5kbGVyIHtcclxuXHRrZXk6IG51bWJlcjtcclxuXHRoYXM6ICh0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiBib29sZWFuO1xyXG5cdHJlYWQ6IChyZWFkZXI6IFBzZFJlYWRlciwgdGFyZ2V0OiBJbWFnZVJlc291cmNlcywgbGVmdDogKCkgPT4gbnVtYmVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucykgPT4gdm9pZDtcclxuXHR3cml0ZTogKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiB2b2lkO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgcmVzb3VyY2VIYW5kbGVyczogUmVzb3VyY2VIYW5kbGVyW10gPSBbXTtcclxuZXhwb3J0IGNvbnN0IHJlc291cmNlSGFuZGxlcnNNYXA6IHsgW2tleTogbnVtYmVyXTogUmVzb3VyY2VIYW5kbGVyIH0gPSB7fTtcclxuXHJcbmZ1bmN0aW9uIGFkZEhhbmRsZXIoXHJcblx0a2V5OiBudW1iZXIsXHJcblx0aGFzOiAodGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gYm9vbGVhbixcclxuXHRyZWFkOiAocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMsIGxlZnQ6ICgpID0+IG51bWJlciwgb3B0aW9uczogUmVhZE9wdGlvbnMpID0+IHZvaWQsXHJcblx0d3JpdGU6ICh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gdm9pZCxcclxuKSB7XHJcblx0Y29uc3QgaGFuZGxlcjogUmVzb3VyY2VIYW5kbGVyID0geyBrZXksIGhhcywgcmVhZCwgd3JpdGUgfTtcclxuXHRyZXNvdXJjZUhhbmRsZXJzLnB1c2goaGFuZGxlcik7XHJcblx0cmVzb3VyY2VIYW5kbGVyc01hcFtoYW5kbGVyLmtleV0gPSBoYW5kbGVyO1xyXG59XHJcblxyXG5jb25zdCBMT0dfTU9DS19IQU5ETEVSUyA9IGZhbHNlO1xyXG5jb25zdCBSRVNPTFVUSU9OX1VOSVRTID0gW3VuZGVmaW5lZCwgJ1BQSScsICdQUENNJ107XHJcbmNvbnN0IE1FQVNVUkVNRU5UX1VOSVRTID0gW3VuZGVmaW5lZCwgJ0luY2hlcycsICdDZW50aW1ldGVycycsICdQb2ludHMnLCAnUGljYXMnLCAnQ29sdW1ucyddO1xyXG5jb25zdCBoZXggPSAnMDEyMzQ1Njc4OWFiY2RlZic7XHJcblxyXG5mdW5jdGlvbiBjaGFyVG9OaWJibGUoY29kZTogbnVtYmVyKSB7XHJcblx0cmV0dXJuIGNvZGUgPD0gNTcgPyBjb2RlIC0gNDggOiBjb2RlIC0gODc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGJ5dGVBdCh2YWx1ZTogc3RyaW5nLCBpbmRleDogbnVtYmVyKSB7XHJcblx0cmV0dXJuIChjaGFyVG9OaWJibGUodmFsdWUuY2hhckNvZGVBdChpbmRleCkpIDw8IDQpIHwgY2hhclRvTmliYmxlKHZhbHVlLmNoYXJDb2RlQXQoaW5kZXggKyAxKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRVdGY4U3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0cmV0dXJuIGRlY29kZVN0cmluZyhidWZmZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVV0ZjhTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBzdHJpbmcpIHtcclxuXHRjb25zdCBidWZmZXIgPSBlbmNvZGVTdHJpbmcodmFsdWUpO1xyXG5cdHdyaXRlQnl0ZXMod3JpdGVyLCBidWZmZXIpO1xyXG59XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAyOCwgLy8gSVBUQy1OQUEgcmVjb3JkXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDI4ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAyOCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAyOCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAyOCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2MSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmNhcHRpb25EaWdlc3QgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCBjYXB0aW9uRGlnZXN0ID0gJyc7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XHJcblx0XHRcdGNvbnN0IGJ5dGUgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Y2FwdGlvbkRpZ2VzdCArPSBoZXhbYnl0ZSA+PiA0XTtcclxuXHRcdFx0Y2FwdGlvbkRpZ2VzdCArPSBoZXhbYnl0ZSAmIDB4Zl07XHJcblx0XHR9XHJcblxyXG5cdFx0dGFyZ2V0LmNhcHRpb25EaWdlc3QgPSBjYXB0aW9uRGlnZXN0O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGJ5dGVBdCh0YXJnZXQuY2FwdGlvbkRpZ2VzdCEsIGkgKiAyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA2MCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnhtcE1ldGFkYXRhICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB0YXJnZXQueG1wTWV0YWRhdGEgPSByZWFkVXRmOFN0cmluZyhyZWFkZXIsIGxlZnQoKSksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVV0ZjhTdHJpbmcod3JpdGVyLCB0YXJnZXQueG1wTWV0YWRhdGEhKSxcclxuKTtcclxuXHJcbmNvbnN0IEludGUgPSBjcmVhdGVFbnVtPFJlbmRlcmluZ0ludGVudD4oJ0ludGUnLCAncGVyY2VwdHVhbCcsIHtcclxuXHQncGVyY2VwdHVhbCc6ICdJbWcgJyxcclxuXHQnc2F0dXJhdGlvbic6ICdHcnAgJyxcclxuXHQncmVsYXRpdmUgY29sb3JpbWV0cmljJzogJ0Nscm0nLFxyXG5cdCdhYnNvbHV0ZSBjb2xvcmltZXRyaWMnOiAnQUNscicsXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIFByaW50SW5mb3JtYXRpb25EZXNjcmlwdG9yIHtcclxuXHQnTm0gICc/OiBzdHJpbmc7XHJcblx0Q2xyUz86IHN0cmluZztcclxuXHRQc3RTPzogYm9vbGVhbjtcclxuXHRNcEJsPzogYm9vbGVhbjtcclxuXHRJbnRlPzogc3RyaW5nO1xyXG5cdGhhcmRQcm9vZj86IGJvb2xlYW47XHJcblx0cHJpbnRTaXh0ZWVuQml0PzogYm9vbGVhbjtcclxuXHRwcmludGVyTmFtZT86IHN0cmluZztcclxuXHRwcmludFByb29mU2V0dXA/OiB7XHJcblx0XHRCbHRuOiBzdHJpbmc7XHJcblx0fSB8IHtcclxuXHRcdHByb2ZpbGU6IHN0cmluZztcclxuXHRcdEludGU6IHN0cmluZztcclxuXHRcdE1wQmw6IGJvb2xlYW47XHJcblx0XHRwYXBlcldoaXRlOiBib29sZWFuO1xyXG5cdH07XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA4MixcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnByaW50SW5mb3JtYXRpb24gIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2M6IFByaW50SW5mb3JtYXRpb25EZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblxyXG5cdFx0dGFyZ2V0LnByaW50SW5mb3JtYXRpb24gPSB7XHJcblx0XHRcdHByaW50ZXJOYW1lOiBkZXNjLnByaW50ZXJOYW1lIHx8ICcnLFxyXG5cdFx0XHRyZW5kZXJpbmdJbnRlbnQ6IEludGUuZGVjb2RlKGRlc2MuSW50ZSA/PyAnSW50ZS5JbWcgJyksXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQucHJpbnRJbmZvcm1hdGlvbjtcclxuXHJcblx0XHRpZiAoZGVzYy5Qc3RTICE9PSB1bmRlZmluZWQpIGluZm8ucHJpbnRlck1hbmFnZXNDb2xvcnMgPSBkZXNjLlBzdFM7XHJcblx0XHRpZiAoZGVzY1snTm0gICddICE9PSB1bmRlZmluZWQpIGluZm8ucHJpbnRlclByb2ZpbGUgPSBkZXNjWydObSAgJ107XHJcblx0XHRpZiAoZGVzYy5NcEJsICE9PSB1bmRlZmluZWQpIGluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbiA9IGRlc2MuTXBCbDtcclxuXHRcdGlmIChkZXNjLnByaW50U2l4dGVlbkJpdCAhPT0gdW5kZWZpbmVkKSBpbmZvLnByaW50U2l4dGVlbkJpdCA9IGRlc2MucHJpbnRTaXh0ZWVuQml0O1xyXG5cdFx0aWYgKGRlc2MuaGFyZFByb29mICE9PSB1bmRlZmluZWQpIGluZm8uaGFyZFByb29mID0gZGVzYy5oYXJkUHJvb2Y7XHJcblx0XHRpZiAoZGVzYy5wcmludFByb29mU2V0dXApIHtcclxuXHRcdFx0aWYgKCdCbHRuJyBpbiBkZXNjLnByaW50UHJvb2ZTZXR1cCkge1xyXG5cdFx0XHRcdGluZm8ucHJvb2ZTZXR1cCA9IHsgYnVpbHRpbjogZGVzYy5wcmludFByb29mU2V0dXAuQmx0bi5zcGxpdCgnLicpWzFdIH07XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aW5mby5wcm9vZlNldHVwID0ge1xyXG5cdFx0XHRcdFx0cHJvZmlsZTogZGVzYy5wcmludFByb29mU2V0dXAucHJvZmlsZSxcclxuXHRcdFx0XHRcdHJlbmRlcmluZ0ludGVudDogSW50ZS5kZWNvZGUoZGVzYy5wcmludFByb29mU2V0dXAuSW50ZSA/PyAnSW50ZS5JbWcgJyksXHJcblx0XHRcdFx0XHRibGFja1BvaW50Q29tcGVuc2F0aW9uOiAhIWRlc2MucHJpbnRQcm9vZlNldHVwLk1wQmwsXHJcblx0XHRcdFx0XHRwYXBlcldoaXRlOiAhIWRlc2MucHJpbnRQcm9vZlNldHVwLnBhcGVyV2hpdGUsXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LnByaW50SW5mb3JtYXRpb24hO1xyXG5cdFx0Y29uc3QgZGVzYzogUHJpbnRJbmZvcm1hdGlvbkRlc2NyaXB0b3IgPSB7fTtcclxuXHJcblx0XHRpZiAoaW5mby5wcmludGVyTWFuYWdlc0NvbG9ycykge1xyXG5cdFx0XHRkZXNjLlBzdFMgPSB0cnVlO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aWYgKGluZm8uaGFyZFByb29mICE9PSB1bmRlZmluZWQpIGRlc2MuaGFyZFByb29mID0gISFpbmZvLmhhcmRQcm9vZjtcclxuXHRcdFx0ZGVzYy5DbHJTID0gJ0NsclMuUkdCQyc7IC8vIFRPRE86ID8/P1xyXG5cdFx0XHRkZXNjWydObSAgJ10gPSBpbmZvLnByaW50ZXJQcm9maWxlID8/ICdDSUUgUkdCJztcclxuXHRcdH1cclxuXHJcblx0XHRkZXNjLkludGUgPSBJbnRlLmVuY29kZShpbmZvLnJlbmRlcmluZ0ludGVudCk7XHJcblxyXG5cdFx0aWYgKCFpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzKSBkZXNjLk1wQmwgPSAhIWluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbjtcclxuXHJcblx0XHRkZXNjLnByaW50U2l4dGVlbkJpdCA9ICEhaW5mby5wcmludFNpeHRlZW5CaXQ7XHJcblx0XHRkZXNjLnByaW50ZXJOYW1lID0gaW5mby5wcmludGVyTmFtZSB8fCAnJztcclxuXHJcblx0XHRpZiAoaW5mby5wcm9vZlNldHVwICYmICdwcm9maWxlJyBpbiBpbmZvLnByb29mU2V0dXApIHtcclxuXHRcdFx0ZGVzYy5wcmludFByb29mU2V0dXAgPSB7XHJcblx0XHRcdFx0cHJvZmlsZTogaW5mby5wcm9vZlNldHVwLnByb2ZpbGUgfHwgJycsXHJcblx0XHRcdFx0SW50ZTogSW50ZS5lbmNvZGUoaW5mby5wcm9vZlNldHVwLnJlbmRlcmluZ0ludGVudCksXHJcblx0XHRcdFx0TXBCbDogISFpbmZvLnByb29mU2V0dXAuYmxhY2tQb2ludENvbXBlbnNhdGlvbixcclxuXHRcdFx0XHRwYXBlcldoaXRlOiAhIWluZm8ucHJvb2ZTZXR1cC5wYXBlcldoaXRlLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZGVzYy5wcmludFByb29mU2V0dXAgPSB7XHJcblx0XHRcdFx0Qmx0bjogaW5mby5wcm9vZlNldHVwPy5idWlsdGluID8gYGJ1aWx0aW5Qcm9vZi4ke2luZm8ucHJvb2ZTZXR1cC5idWlsdGlufWAgOiAnYnVpbHRpblByb29mLnByb29mQ01ZSycsXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAncHJpbnRPdXRwdXQnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwODMsIC8vIFByaW50IHN0eWxlXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDgzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA4MycsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA4MyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblxyXG5cdFx0Ly8gVE9ETzpcclxuXHRcdC8vIGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCcxMDgzJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA4Myk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAwNSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnJlc29sdXRpb25JbmZvICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBob3Jpem9udGFsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGhvcml6b250YWxSZXNvbHV0aW9uVW5pdCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IHdpZHRoVW5pdCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsUmVzb2x1dGlvblVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBoZWlnaHRVbml0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdHRhcmdldC5yZXNvbHV0aW9uSW5mbyA9IHtcclxuXHRcdFx0aG9yaXpvbnRhbFJlc29sdXRpb24sXHJcblx0XHRcdGhvcml6b250YWxSZXNvbHV0aW9uVW5pdDogUkVTT0xVVElPTl9VTklUU1tob3Jpem9udGFsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcclxuXHRcdFx0d2lkdGhVbml0OiBNRUFTVVJFTUVOVF9VTklUU1t3aWR0aFVuaXRdIHx8ICdJbmNoZXMnIGFzIGFueSxcclxuXHRcdFx0dmVydGljYWxSZXNvbHV0aW9uLFxyXG5cdFx0XHR2ZXJ0aWNhbFJlc29sdXRpb25Vbml0OiBSRVNPTFVUSU9OX1VOSVRTW3ZlcnRpY2FsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcclxuXHRcdFx0aGVpZ2h0VW5pdDogTUVBU1VSRU1FTlRfVU5JVFNbaGVpZ2h0VW5pdF0gfHwgJ0luY2hlcycgYXMgYW55LFxyXG5cdFx0fTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5yZXNvbHV0aW9uSW5mbyE7XHJcblxyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBpbmZvLmhvcml6b250YWxSZXNvbHV0aW9uIHx8IDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBSRVNPTFVUSU9OX1VOSVRTLmluZGV4T2YoaW5mby5ob3Jpem9udGFsUmVzb2x1dGlvblVuaXQpKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgubWF4KDEsIE1FQVNVUkVNRU5UX1VOSVRTLmluZGV4T2YoaW5mby53aWR0aFVuaXQpKSk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIGluZm8udmVydGljYWxSZXNvbHV0aW9uIHx8IDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBSRVNPTFVUSU9OX1VOSVRTLmluZGV4T2YoaW5mby52ZXJ0aWNhbFJlc29sdXRpb25Vbml0KSkpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBNRUFTVVJFTUVOVF9VTklUUy5pbmRleE9mKGluZm8uaGVpZ2h0VW5pdCkpKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgcHJpbnRTY2FsZVN0eWxlcyA9IFsnY2VudGVyZWQnLCAnc2l6ZSB0byBmaXQnLCAndXNlciBkZWZpbmVkJ107XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNjIsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wcmludFNjYWxlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQucHJpbnRTY2FsZSA9IHtcclxuXHRcdFx0c3R5bGU6IHByaW50U2NhbGVTdHlsZXNbcmVhZEludDE2KHJlYWRlcildIGFzIGFueSxcclxuXHRcdFx0eDogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0eTogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0c2NhbGU6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB7IHN0eWxlLCB4LCB5LCBzY2FsZSB9ID0gdGFyZ2V0LnByaW50U2NhbGUhO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgubWF4KDAsIHByaW50U2NhbGVTdHlsZXMuaW5kZXhPZihzdHlsZSEpKSk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB4IHx8IDApO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgeSB8fCAwKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHNjYWxlIHx8IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMDYsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHRcdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzLnB1c2godmFsdWUpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgdGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzISkge1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIG5hbWUsIDEpO1xyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwNDUsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHR0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMucHVzaChyZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcyEpIHtcclxuXHRcdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBuYW1lKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxyXG5cdDEwNzcsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDc3ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA3NycsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA3NyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA3Nyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1MyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmFscGhhSWRlbnRpZmllcnMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hbHBoYUlkZW50aWZpZXJzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSA+PSA0KSB7XHJcblx0XHRcdHRhcmdldC5hbHBoYUlkZW50aWZpZXJzLnB1c2gocmVhZFVpbnQzMihyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBpZCBvZiB0YXJnZXQuYWxwaGFJZGVudGlmaWVycyEpIHtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpZCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAxMCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmJhY2tncm91bmRDb2xvciAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LmJhY2tncm91bmRDb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVDb2xvcih3cml0ZXIsIHRhcmdldC5iYWNrZ3JvdW5kQ29sb3IhKSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAzNyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmdsb2JhbEFuZ2xlICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQuZ2xvYmFsQW5nbGUgPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5nbG9iYWxBbmdsZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDQ5LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuZ2xvYmFsQWx0aXR1ZGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5nbG9iYWxBbHRpdHVkZSA9IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlISksXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMTEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wcmludEZsYWdzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQucHJpbnRGbGFncyA9IHtcclxuXHRcdFx0bGFiZWxzOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRjcm9wTWFya3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdGNvbG9yQmFyczogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0cmVnaXN0cmF0aW9uTWFya3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdG5lZ2F0aXZlOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRmbGlwOiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRpbnRlcnBvbGF0ZTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0Y2FwdGlvbjogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0cHJpbnRGbGFnczogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdH07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGZsYWdzID0gdGFyZ2V0LnByaW50RmxhZ3MhO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmxhYmVscyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5jcm9wTWFya3MgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY29sb3JCYXJzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLnJlZ2lzdHJhdGlvbk1hcmtzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLm5lZ2F0aXZlID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmZsaXAgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuaW50ZXJwb2xhdGUgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY2FwdGlvbiA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5wcmludEZsYWdzID8gMSA6IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAwMDAsIC8vIFByaW50IGZsYWdzXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDAwMCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMDAwJywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDAwMCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAwMDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAxMywgLy8gQ29sb3IgaGFsZnRvbmluZ1xyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyMTAxMyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMTMnLCBsZWZ0KCkpO1xyXG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwMTMgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwMTMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAxNiwgLy8gQ29sb3IgdHJhbnNmZXIgZnVuY3Rpb25zXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDE2ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTAxNicsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAxNiA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAxNik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTAyNCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyU3RhdGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5sYXllclN0YXRlID0gcmVhZFVpbnQxNihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MTYod3JpdGVyLCB0YXJnZXQubGF5ZXJTdGF0ZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDI2LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJzR3JvdXAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5sYXllcnNHcm91cCA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0dGFyZ2V0LmxheWVyc0dyb3VwLnB1c2gocmVhZFVpbnQxNihyZWFkZXIpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBnIG9mIHRhcmdldC5sYXllcnNHcm91cCEpIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBnKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDcyLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJHcm91cHNFbmFibGVkSWQgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZCA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0dGFyZ2V0LmxheWVyR3JvdXBzRW5hYmxlZElkLnB1c2gocmVhZFVpbnQ4KHJlYWRlcikpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZCEpIHtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGlkKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDY5LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCBjb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdHRhcmdldC5sYXllclNlbGVjdGlvbklkcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChjb3VudC0tKSB7XHJcblx0XHRcdHRhcmdldC5sYXllclNlbGVjdGlvbklkcy5wdXNoKHJlYWRVaW50MzIocmVhZGVyKSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzIS5sZW5ndGgpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgaWQgb2YgdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzISkge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGlkKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDMyLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaG9yaXpvbnRhbCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHZlcnRpY2FsID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKHZlcnNpb24gIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCAxMDMyIHJlc291cmNlIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uID0ge1xyXG5cdFx0XHRncmlkOiB7IGhvcml6b250YWwsIHZlcnRpY2FsIH0sXHJcblx0XHRcdGd1aWRlczogW10sXHJcblx0XHR9O1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uLmd1aWRlcyEucHVzaCh7XHJcblx0XHRcdFx0bG9jYXRpb246IHJlYWRVaW50MzIocmVhZGVyKSAvIDMyLFxyXG5cdFx0XHRcdGRpcmVjdGlvbjogcmVhZFVpbnQ4KHJlYWRlcikgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmdyaWRBbmRHdWlkZXNJbmZvcm1hdGlvbiE7XHJcblx0XHRjb25zdCBncmlkID0gaW5mby5ncmlkIHx8IHsgaG9yaXpvbnRhbDogMTggKiAzMiwgdmVydGljYWw6IDE4ICogMzIgfTtcclxuXHRcdGNvbnN0IGd1aWRlcyA9IGluZm8uZ3VpZGVzIHx8IFtdO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGdyaWQuaG9yaXpvbnRhbCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGdyaWQudmVydGljYWwpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBndWlkZXMubGVuZ3RoKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGcgb2YgZ3VpZGVzKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgZy5sb2NhdGlvbiAqIDMyKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGcuZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAxIDogMCk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1NCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnVybHNMaXN0ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRpZiAoY291bnQpIHtcclxuXHRcdFx0aWYgKCFvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSByZXR1cm47XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkOiBVUkwgTGlzdCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFRPRE86IHJlYWQgYWN0dWFsIFVSTCBsaXN0XHJcblx0XHR0YXJnZXQudXJsc0xpc3QgPSBbXTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQudXJsc0xpc3QhLmxlbmd0aCk7XHJcblxyXG5cdFx0Ly8gVE9ETzogd3JpdGUgYWN0dWFsIFVSTCBsaXN0XHJcblx0XHRpZiAodGFyZ2V0LnVybHNMaXN0IS5sZW5ndGgpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQ6IFVSTCBMaXN0Jyk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQxMDUwLCAvLyBTbGljZXNcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwNTAgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDUwJywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDUwID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDUwKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDY0LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQucGl4ZWxBc3BlY3RSYXRpbyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSA+IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwaXhlbEFzcGVjdFJhdGlvIHZlcnNpb24nKTtcclxuXHRcdHRhcmdldC5waXhlbEFzcGVjdFJhdGlvID0geyBhc3BlY3Q6IHJlYWRGbG9hdDY0KHJlYWRlcikgfTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdGFyZ2V0LnBpeGVsQXNwZWN0UmF0aW8hLmFzcGVjdCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA0MSxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmljY1VudGFnZ2VkUHJvZmlsZSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmljY1VudGFnZ2VkUHJvZmlsZSA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQuaWNjVW50YWdnZWRQcm9maWxlID8gMSA6IDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAzOSwgLy8gSUNDIFByb2ZpbGVcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMzkgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDM5JywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDM5ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDM5KTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQxMDQ0LFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuaWRzU2VlZE51bWJlciAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0Lmlkc1NlZWROdW1iZXIgPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5pZHNTZWVkTnVtYmVyISksXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwMzYsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC50aHVtYm5haWwgIT09IHVuZGVmaW5lZCB8fCB0YXJnZXQudGh1bWJuYWlsUmF3ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBmb3JtYXQgPSByZWFkVWludDMyKHJlYWRlcik7IC8vIDEgPSBrSnBlZ1JHQiwgMCA9IGtSYXdSR0JcclxuXHRcdGNvbnN0IHdpZHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaGVpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyB3aWR0aEJ5dGVzID0gKHdpZHRoICogYml0c19wZXJfcGl4ZWwgKyAzMSkgLyAzMiAqIDQuXHJcblx0XHRyZWFkVWludDMyKHJlYWRlcik7IC8vIHRvdGFsU2l6ZSA9IHdpZHRoQnl0ZXMgKiBoZWlnaHQgKiBwbGFuZXNcclxuXHRcdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gc2l6ZUFmdGVyQ29tcHJlc3Npb25cclxuXHRcdGNvbnN0IGJpdHNQZXJQaXhlbCA9IHJlYWRVaW50MTYocmVhZGVyKTsgLy8gMjRcclxuXHRcdGNvbnN0IHBsYW5lcyA9IHJlYWRVaW50MTYocmVhZGVyKTsgLy8gMVxyXG5cclxuXHRcdGlmIChmb3JtYXQgIT09IDEgfHwgYml0c1BlclBpeGVsICE9PSAyNCB8fCBwbGFuZXMgIT09IDEpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYEludmFsaWQgdGh1bWJuYWlsIGRhdGEgKGZvcm1hdDogJHtmb3JtYXR9LCBiaXRzUGVyUGl4ZWw6ICR7Yml0c1BlclBpeGVsfSwgcGxhbmVzOiAke3BsYW5lc30pYCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBzaXplID0gbGVmdCgpO1xyXG5cdFx0Y29uc3QgZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIHNpemUpO1xyXG5cclxuXHRcdGlmIChvcHRpb25zLnVzZVJhd1RodW1ibmFpbCkge1xyXG5cdFx0XHR0YXJnZXQudGh1bWJuYWlsUmF3ID0geyB3aWR0aCwgaGVpZ2h0LCBkYXRhIH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0YXJnZXQudGh1bWJuYWlsID0gY3JlYXRlQ2FudmFzRnJvbURhdGEoZGF0YSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGxldCB3aWR0aCA9IDA7XHJcblx0XHRsZXQgaGVpZ2h0ID0gMDtcclxuXHRcdGxldCBkYXRhOiBVaW50OEFycmF5O1xyXG5cclxuXHRcdGlmICh0YXJnZXQudGh1bWJuYWlsUmF3KSB7XHJcblx0XHRcdHdpZHRoID0gdGFyZ2V0LnRodW1ibmFpbFJhdy53aWR0aDtcclxuXHRcdFx0aGVpZ2h0ID0gdGFyZ2V0LnRodW1ibmFpbFJhdy5oZWlnaHQ7XHJcblx0XHRcdGRhdGEgPSB0YXJnZXQudGh1bWJuYWlsUmF3LmRhdGE7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpZiAoIXRhcmdldC50aHVtYm5haWwpIHRocm93IG5ldyBFcnJvcignTWlzc2luZyB0aHVtYm5haWwnKTtcclxuXHRcdFx0d2lkdGggPSB0YXJnZXQudGh1bWJuYWlsLndpZHRoO1xyXG5cdFx0XHRoZWlnaHQgPSB0YXJnZXQudGh1bWJuYWlsLmhlaWdodDtcclxuXHRcdFx0ZGF0YSA9IHRvQnl0ZUFycmF5KHRhcmdldC50aHVtYm5haWwudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywgMSkuc3Vic3RyKCdkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCcubGVuZ3RoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgYml0c1BlclBpeGVsID0gMjQ7XHJcblx0XHRjb25zdCB3aWR0aEJ5dGVzID0gTWF0aC5mbG9vcigod2lkdGggKiBiaXRzUGVyUGl4ZWwgKyAzMSkgLyAzMikgKiA0O1xyXG5cdFx0Y29uc3QgcGxhbmVzID0gMTtcclxuXHRcdGNvbnN0IHRvdGFsU2l6ZSA9IHdpZHRoQnl0ZXMgKiBoZWlnaHQgKiBwbGFuZXM7XHJcblx0XHRjb25zdCBzaXplQWZ0ZXJDb21wcmVzc2lvbiA9IGRhdGEubGVuZ3RoO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7IC8vIDEgPSBrSnBlZ1JHQlxyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB3aWR0aCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGhlaWdodCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIHdpZHRoQnl0ZXMpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0b3RhbFNpemUpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBzaXplQWZ0ZXJDb21wcmVzc2lvbik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGJpdHNQZXJQaXhlbCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHBsYW5lcyk7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgZGF0YSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0MTA1NyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnZlcnNpb25JbmZvICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0aWYgKHZlcnNpb24gIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2ZXJzaW9uSW5mbyB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LnZlcnNpb25JbmZvID0ge1xyXG5cdFx0XHRoYXNSZWFsTWVyZ2VkRGF0YTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0d3JpdGVyTmFtZTogcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSxcclxuXHRcdFx0cmVhZGVyTmFtZTogcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSxcclxuXHRcdFx0ZmlsZVZlcnNpb246IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbkluZm8gPSB0YXJnZXQudmVyc2lvbkluZm8hO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZlcnNpb25JbmZvLmhhc1JlYWxNZXJnZWREYXRhID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlciwgdmVyc2lvbkluZm8ud3JpdGVyTmFtZSk7XHJcblx0XHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCB2ZXJzaW9uSW5mby5yZWFkZXJOYW1lKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdmVyc2lvbkluZm8uZmlsZVZlcnNpb24pO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTA1OCwgLy8gRVhJRiBkYXRhIDEuXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDU4ICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRMT0dfTU9DS19IQU5ETEVSUyAmJiBjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgMTA1OCcsIGxlZnQoKSk7XHJcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0NzAwMCxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmltYWdlUmVhZHlWYXJpYWJsZXMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5pbWFnZVJlYWR5VmFyaWFibGVzID0gcmVhZFV0ZjhTdHJpbmcocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVV0ZjhTdHJpbmcod3JpdGVyLCB0YXJnZXQuaW1hZ2VSZWFkeVZhcmlhYmxlcyEpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDcwMDEsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMgPSByZWFkVXRmOFN0cmluZyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVXRmOFN0cmluZyh3cml0ZXIsIHRhcmdldC5pbWFnZVJlYWR5RGF0YVNldHMhKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIERlc2NyaXB0b3IxMDg4IHtcclxuXHQnbnVsbCc6IHN0cmluZ1tdO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdDEwODgsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5wYXRoU2VsZWN0aW9uU3RhdGUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIF9sZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBEZXNjcmlwdG9yMTA4OCA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHR0YXJnZXQucGF0aFNlbGVjdGlvblN0YXRlID0gZGVzY1snbnVsbCddO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBEZXNjcmlwdG9yMTA4OCA9IHsgJ251bGwnOiB0YXJnZXQucGF0aFNlbGVjdGlvblN0YXRlISB9O1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0MTAyNSxcclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMjUgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDI1JywgbGVmdCgpKTtcclxuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDI1ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDI1KTtcclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgRnJtRCA9IGNyZWF0ZUVudW08J2F1dG8nIHwgJ25vbmUnIHwgJ2Rpc3Bvc2UnPignRnJtRCcsICcnLCB7XHJcblx0YXV0bzogJ0F1dG8nLFxyXG5cdG5vbmU6ICdOb25lJyxcclxuXHRkaXNwb3NlOiAnRGlzcCcsXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIEFuaW1hdGlvbkRlc2NyaXB0b3Ige1xyXG5cdEFGU3Q6IG51bWJlcjtcclxuXHRGckluOiB7XHJcblx0XHRGcklEOiBudW1iZXI7XHJcblx0XHRGckRsOiBudW1iZXI7XHJcblx0XHRGckRzOiBzdHJpbmc7XHJcblx0XHRGckdBPzogbnVtYmVyO1xyXG5cdH1bXTtcclxuXHRGU3RzOiB7XHJcblx0XHRGc0lEOiBudW1iZXI7XHJcblx0XHRBRnJtOiBudW1iZXI7XHJcblx0XHRGc0ZyOiBudW1iZXJbXTtcclxuXHRcdExDbnQ6IG51bWJlcjtcclxuXHR9W107XHJcbn1cclxuXHJcbmludGVyZmFjZSBBbmltYXRpb25zIHtcclxuXHRmcmFtZXM6IHtcclxuXHRcdGlkOiBudW1iZXI7XHJcblx0XHRkZWxheTogbnVtYmVyO1xyXG5cdFx0ZGlzcG9zZT86ICdhdXRvJyB8ICdub25lJyB8ICdkaXNwb3NlJztcclxuXHR9W107XHJcblx0YW5pbWF0aW9uczoge1xyXG5cdFx0aWQ6IG51bWJlcjtcclxuXHRcdGZyYW1lczogbnVtYmVyW107XHJcblx0XHRyZXBlYXRzPzogbnVtYmVyO1xyXG5cdH1bXTtcclxufVxyXG5cclxuLy8gVE9ETzogVW5maW5pc2hlZFxyXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXHJcblx0NDAwMCwgLy8gUGx1Zy1JbiByZXNvdXJjZShzKVxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2lyNDAwMCAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgeyBsb2dNaXNzaW5nRmVhdHVyZXMsIGxvZ0RldkZlYXR1cmVzIH0pID0+IHtcclxuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSB7XHJcblx0XHRcdExPR19NT0NLX0hBTkRMRVJTICYmIGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSA0MDAwJywgbGVmdCgpKTtcclxuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9pcjQwMDAgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdGlmIChrZXkgPT09ICdtYW5pJykge1xyXG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICdJUkZSJyk7XHJcblx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRcdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdFx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRcdFx0XHRcdGlmIChrZXkgPT09ICdBbkRzJykge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBBbmltYXRpb25EZXNjcmlwdG9yO1xyXG5cdFx0XHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdBbkRzJywgZGVzYyk7XHJcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIEFuRHMnLCBkZXNjKTtcclxuXHRcdFx0XHRcdFx0XHQvLyBsb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnIzQwMDAgQW5EcycsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQ6IEFuaW1hdGlvbnMgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBkZXNjLkFGU3QgPz8/XHJcblx0XHRcdFx0XHRcdFx0XHRmcmFtZXM6IGRlc2MuRnJJbi5tYXAoeCA9PiAoe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogeC5GcklELFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRkZWxheTogeC5GckRsIC8gMTAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNwb3NlOiB4LkZyRHMgPyBGcm1ELmRlY29kZSh4LkZyRHMpIDogJ2F1dG8nLCAvLyBtaXNzaW5nID09IGF1dG9cclxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8geC5GckdBID8/P1xyXG5cdFx0XHRcdFx0XHRcdFx0fSkpLFxyXG5cdFx0XHRcdFx0XHRcdFx0YW5pbWF0aW9uczogZGVzYy5GU3RzLm1hcCh4ID0+ICh7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiB4LkZzSUQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdGZyYW1lczogeC5Gc0ZyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXBlYXRzOiB4LkxDbnQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdC8vIHguQUZybSA/Pz9cclxuXHRcdFx0XHRcdFx0XHRcdH0pKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRcdFx0XHRsb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnIzQwMDAgQW5EczpyZXN1bHQnLCByZXN1bHQpO1xyXG5cdFx0XHRcdFx0XHRcdC8vIGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzOnJlc3VsdCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHJlc3VsdCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnUm9sbCcpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zdCBieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIFJvbGwnLCBieXRlcyk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdVbmhhbmRsZWQgc3Vic2VjdGlvbiBpbiAjNDAwMCcsIGtleSk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21vcHQnKSB7XHJcblx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIG1vcHQnLCBieXRlcyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRsb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBrZXkgaW4gIzQwMDA6Jywga2V5KTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjQwMDApO1xyXG5cdH0sXHJcbik7XHJcblxyXG4vLyBUT0RPOiBVbmZpbmlzaGVkXHJcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcclxuXHQ0MDAxLCAvLyBQbHVnLUluIHJlc291cmNlKHMpXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXI0MDAxICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCB7IGxvZ01pc3NpbmdGZWF0dXJlcywgbG9nRGV2RmVhdHVyZXMgfSkgPT4ge1xyXG5cdFx0aWYgKE1PQ0tfSEFORExFUlMpIHtcclxuXHRcdFx0TE9HX01PQ0tfSEFORExFUlMgJiYgY29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDQwMDEnLCBsZWZ0KCkpO1xyXG5cdFx0XHQodGFyZ2V0IGFzIGFueSkuX2lyNDAwMSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKGtleSA9PT0gJ21mcmknKSB7XHJcblx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGlmICh2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWZyaSB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21mcmknLCBieXRlcyk7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21zZXQnKSB7XHJcblx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21zZXQnLCBkZXNjKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIGtleSBpbiAjNDAwMScsIGtleSk7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyNDAwMSk7XHJcblx0fSxcclxuKTtcclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
