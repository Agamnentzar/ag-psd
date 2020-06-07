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
var MOCK_HANDLERS = false;
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
MOCK_HANDLERS && addHandler(1028, // IPTC-NAA record
function (// IPTC-NAA record
target) { return target._ir1028 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1028', left());
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
        desc.ClrS = 'Clrs.RGBC'; // TODO: ???
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
MOCK_HANDLERS && addHandler(1083, // Print style
function (// Print style
target) { return target._ir1083 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1083', left());
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
MOCK_HANDLERS && addHandler(1077, function (target) { return target._ir1077 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1077', left());
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
MOCK_HANDLERS && addHandler(10000, // Print flags
function (// Print flags
target) { return target._ir10000 !== undefined; }, function (reader, target, left) {
    console.log('image resource 10000', left());
    target._ir10000 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir10000);
});
MOCK_HANDLERS && addHandler(1013, // Color halftoning
function (// Color halftoning
target) { return target._ir1013 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1013', left());
    target._ir1013 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1013);
});
MOCK_HANDLERS && addHandler(1016, // Color transfer functions
function (// Color transfer functions
target) { return target._ir1016 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1016', left());
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
MOCK_HANDLERS && addHandler(1050, // Slices
function (// Slices
target) { return target._ir1050 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1050', left());
    target._ir1050 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1050);
});
addHandler(1064, function (target) { return target.pixelAspectRatio !== undefined; }, function (reader, target) {
    var version = psdReader_1.readUint32(reader);
    if (version > 2)
        throw new Error('Invalid pixelAspectRatio version');
    target.pixelAspectRatio = { aspect: psdReader_1.readFloat64(reader) };
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, 2); // version
    psdWriter_1.writeFloat64(writer, target.pixelAspectRatio.aspect);
});
MOCK_HANDLERS && addHandler(1039, // ICC Profile
function (// ICC Profile
target) { return target._ir1039 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1039', left());
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
MOCK_HANDLERS && addHandler(1058, // EXIF data 1.
function (// EXIF data 1.
target) { return target._ir1058 !== undefined; }, function (reader, target, left) {
    console.log('image resource 1058', left());
    target._ir1058 = psdReader_1.readBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, target._ir1058);
});
// addHandler(
// 	1025,
// 	target => (target as any)._ir1025 !== undefined,
// 	(reader, target, left) => {
// 		console.log('image resource 1025', left());
// 		(target as any)._ir1025 = readBytes(reader, left());
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, (target as any)._ir1025);
// 	},
// );
var FrmD = helpers_1.createEnum('FrmD', '', {
    auto: 'Auto',
    none: 'None',
    dispose: 'Disp',
});
// TODO: Unfinished
MOCK_HANDLERS && addHandler(4000, function (target) { return target._ir4000 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (MOCK_HANDLERS) {
        console.log('image resource 4000', left());
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
                                dispose: x.FrDs ? FrmD.decode(x.FrDs) : 'auto',
                            }); }),
                            animations: desc.FSts.map(function (x) { return ({
                                id: x.FsID,
                                frames: x.FsFr,
                                repeats: x.LCnt,
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
MOCK_HANDLERS && addHandler(4001, function (target) { return target._ir4001 !== undefined; }, function (reader, target, left, _a) {
    var logMissingFeatures = _a.logMissingFeatures, logDevFeatures = _a.logDevFeatures;
    if (MOCK_HANDLERS) {
        console.log('image resource 4001', left());
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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aW1hZ2VSZXNvdXJjZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB0b0J5dGVBcnJheSB9IGZyb20gJ2Jhc2U2NC1qcyc7XG5pbXBvcnQgeyBJbWFnZVJlc291cmNlcywgUmVhZE9wdGlvbnMsIFJlbmRlcmluZ0ludGVudCB9IGZyb20gJy4vcHNkJztcbmltcG9ydCB7XG5cdFBzZFJlYWRlciwgcmVhZFBhc2NhbFN0cmluZywgcmVhZFVuaWNvZGVTdHJpbmcsIHJlYWRVaW50MzIsIHJlYWRVaW50MTYsIHJlYWRVaW50OCwgcmVhZEZsb2F0NjQsXG5cdHJlYWRCeXRlcywgc2tpcEJ5dGVzLCByZWFkRmxvYXQzMiwgcmVhZEludDE2LCByZWFkRml4ZWRQb2ludDMyLCByZWFkU2lnbmF0dXJlLCBjaGVja1NpZ25hdHVyZSxcblx0cmVhZFNlY3Rpb24sIHJlYWRDb2xvclxufSBmcm9tICcuL3BzZFJlYWRlcic7XG5pbXBvcnQge1xuXHRQc2RXcml0ZXIsIHdyaXRlUGFzY2FsU3RyaW5nLCB3cml0ZVVuaWNvZGVTdHJpbmcsIHdyaXRlVWludDMyLCB3cml0ZVVpbnQ4LCB3cml0ZUZsb2F0NjQsIHdyaXRlVWludDE2LFxuXHR3cml0ZUJ5dGVzLCB3cml0ZUludDE2LCB3cml0ZUZsb2F0MzIsIHdyaXRlRml4ZWRQb2ludDMyLCB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZywgd3JpdGVDb2xvcixcbn0gZnJvbSAnLi9wc2RXcml0ZXInO1xuaW1wb3J0IHsgY3JlYXRlQ2FudmFzRnJvbURhdGEsIGNyZWF0ZUVudW0gfSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHsgZGVjb2RlU3RyaW5nLCBlbmNvZGVTdHJpbmcgfSBmcm9tICcuL3V0ZjgnO1xuaW1wb3J0IHsgcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yLCB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yIH0gZnJvbSAnLi9kZXNjcmlwdG9yJztcblxuZXhwb3J0IGludGVyZmFjZSBSZXNvdXJjZUhhbmRsZXIge1xuXHRrZXk6IG51bWJlcjtcblx0aGFzOiAodGFyZ2V0OiBJbWFnZVJlc291cmNlcykgPT4gYm9vbGVhbjtcblx0cmVhZDogKHJlYWRlcjogUHNkUmVhZGVyLCB0YXJnZXQ6IEltYWdlUmVzb3VyY2VzLCBsZWZ0OiAoKSA9PiBudW1iZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSA9PiB2b2lkO1xuXHR3cml0ZTogKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY29uc3QgcmVzb3VyY2VIYW5kbGVyczogUmVzb3VyY2VIYW5kbGVyW10gPSBbXTtcbmV4cG9ydCBjb25zdCByZXNvdXJjZUhhbmRsZXJzTWFwOiB7IFtrZXk6IG51bWJlcl06IFJlc291cmNlSGFuZGxlciB9ID0ge307XG5cbmZ1bmN0aW9uIGFkZEhhbmRsZXIoXG5cdGtleTogbnVtYmVyLFxuXHRoYXM6ICh0YXJnZXQ6IEltYWdlUmVzb3VyY2VzKSA9PiBib29sZWFuLFxuXHRyZWFkOiAocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMsIGxlZnQ6ICgpID0+IG51bWJlciwgb3B0aW9uczogUmVhZE9wdGlvbnMpID0+IHZvaWQsXG5cdHdyaXRlOiAod3JpdGVyOiBQc2RXcml0ZXIsIHRhcmdldDogSW1hZ2VSZXNvdXJjZXMpID0+IHZvaWQsXG4pIHtcblx0Y29uc3QgaGFuZGxlcjogUmVzb3VyY2VIYW5kbGVyID0geyBrZXksIGhhcywgcmVhZCwgd3JpdGUgfTtcblx0cmVzb3VyY2VIYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xuXHRyZXNvdXJjZUhhbmRsZXJzTWFwW2hhbmRsZXIua2V5XSA9IGhhbmRsZXI7XG59XG5cbmNvbnN0IE1PQ0tfSEFORExFUlMgPSBmYWxzZTtcbmNvbnN0IFJFU09MVVRJT05fVU5JVFMgPSBbdW5kZWZpbmVkLCAnUFBJJywgJ1BQQ00nXTtcbmNvbnN0IE1FQVNVUkVNRU5UX1VOSVRTID0gW3VuZGVmaW5lZCwgJ0luY2hlcycsICdDZW50aW1ldGVycycsICdQb2ludHMnLCAnUGljYXMnLCAnQ29sdW1ucyddO1xuY29uc3QgaGV4ID0gJzAxMjM0NTY3ODlhYmNkZWYnO1xuXG5mdW5jdGlvbiBjaGFyVG9OaWJibGUoY29kZTogbnVtYmVyKSB7XG5cdHJldHVybiBjb2RlIDw9IDU3ID8gY29kZSAtIDQ4IDogY29kZSAtIDg3O1xufVxuXG5mdW5jdGlvbiBieXRlQXQodmFsdWU6IHN0cmluZywgaW5kZXg6IG51bWJlcikge1xuXHRyZXR1cm4gKGNoYXJUb05pYmJsZSh2YWx1ZS5jaGFyQ29kZUF0KGluZGV4KSkgPDwgNCkgfCBjaGFyVG9OaWJibGUodmFsdWUuY2hhckNvZGVBdChpbmRleCArIDEpKTtcbn1cblxuZnVuY3Rpb24gcmVhZFV0ZjhTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XG5cdHJldHVybiBkZWNvZGVTdHJpbmcoYnVmZmVyKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVVdGY4U3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogc3RyaW5nKSB7XG5cdGNvbnN0IGJ1ZmZlciA9IGVuY29kZVN0cmluZyh2YWx1ZSk7XG5cdHdyaXRlQnl0ZXMod3JpdGVyLCBidWZmZXIpO1xufVxuXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXG5cdDEwMjgsIC8vIElQVEMtTkFBIHJlY29yZFxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMjggIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0Y29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMjgnLCBsZWZ0KCkpO1xuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDI4ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDI4KTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwNjEsXG5cdHRhcmdldCA9PiB0YXJnZXQuY2FwdGlvbkRpZ2VzdCAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRsZXQgY2FwdGlvbkRpZ2VzdCA9ICcnO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XG5cdFx0XHRjb25zdCBieXRlID0gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHRjYXB0aW9uRGlnZXN0ICs9IGhleFtieXRlID4+IDRdO1xuXHRcdFx0Y2FwdGlvbkRpZ2VzdCArPSBoZXhbYnl0ZSAmIDB4Zl07XG5cdFx0fVxuXG5cdFx0dGFyZ2V0LmNhcHRpb25EaWdlc3QgPSBjYXB0aW9uRGlnZXN0O1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBieXRlQXQodGFyZ2V0LmNhcHRpb25EaWdlc3QhLCBpICogMikpO1xuXHRcdH1cblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwNjAsXG5cdHRhcmdldCA9PiB0YXJnZXQueG1wTWV0YWRhdGEgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB0YXJnZXQueG1wTWV0YWRhdGEgPSByZWFkVXRmOFN0cmluZyhyZWFkZXIsIGxlZnQoKSksXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVdGY4U3RyaW5nKHdyaXRlciwgdGFyZ2V0LnhtcE1ldGFkYXRhISksXG4pO1xuXG5jb25zdCBJbnRlID0gY3JlYXRlRW51bTxSZW5kZXJpbmdJbnRlbnQ+KCdJbnRlJywgJ3BlcmNlcHR1YWwnLCB7XG5cdCdwZXJjZXB0dWFsJzogJ0ltZyAnLFxuXHQnc2F0dXJhdGlvbic6ICdHcnAgJyxcblx0J3JlbGF0aXZlIGNvbG9yaW1ldHJpYyc6ICdDbHJtJyxcblx0J2Fic29sdXRlIGNvbG9yaW1ldHJpYyc6ICdBQ2xyJyxcbn0pO1xuXG5pbnRlcmZhY2UgUHJpbnRJbmZvcm1hdGlvbkRlc2NyaXB0b3Ige1xuXHQnTm0gICc/OiBzdHJpbmc7XG5cdENsclM/OiBzdHJpbmc7XG5cdFBzdFM/OiBib29sZWFuO1xuXHRNcEJsPzogYm9vbGVhbjtcblx0SW50ZT86IHN0cmluZztcblx0aGFyZFByb29mPzogYm9vbGVhbjtcblx0cHJpbnRTaXh0ZWVuQml0PzogYm9vbGVhbjtcblx0cHJpbnRlck5hbWU/OiBzdHJpbmc7XG5cdHByaW50UHJvb2ZTZXR1cD86IHtcblx0XHRCbHRuOiBzdHJpbmc7XG5cdH0gfCB7XG5cdFx0cHJvZmlsZTogc3RyaW5nO1xuXHRcdEludGU6IHN0cmluZztcblx0XHRNcEJsOiBib29sZWFuO1xuXHRcdHBhcGVyV2hpdGU6IGJvb2xlYW47XG5cdH07XG59XG5cbmFkZEhhbmRsZXIoXG5cdDEwODIsXG5cdHRhcmdldCA9PiB0YXJnZXQucHJpbnRJbmZvcm1hdGlvbiAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBkZXNjOiBQcmludEluZm9ybWF0aW9uRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xuXG5cdFx0dGFyZ2V0LnByaW50SW5mb3JtYXRpb24gPSB7XG5cdFx0XHRwcmludGVyTmFtZTogZGVzYy5wcmludGVyTmFtZSB8fCAnJyxcblx0XHRcdHJlbmRlcmluZ0ludGVudDogSW50ZS5kZWNvZGUoZGVzYy5JbnRlID8/ICdJbnRlLkltZyAnKSxcblx0XHR9O1xuXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5wcmludEluZm9ybWF0aW9uO1xuXG5cdFx0aWYgKGRlc2MuUHN0UyAhPT0gdW5kZWZpbmVkKSBpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzID0gZGVzYy5Qc3RTO1xuXHRcdGlmIChkZXNjWydObSAgJ10gIT09IHVuZGVmaW5lZCkgaW5mby5wcmludGVyUHJvZmlsZSA9IGRlc2NbJ05tICAnXTtcblx0XHRpZiAoZGVzYy5NcEJsICE9PSB1bmRlZmluZWQpIGluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbiA9IGRlc2MuTXBCbDtcblx0XHRpZiAoZGVzYy5wcmludFNpeHRlZW5CaXQgIT09IHVuZGVmaW5lZCkgaW5mby5wcmludFNpeHRlZW5CaXQgPSBkZXNjLnByaW50U2l4dGVlbkJpdDtcblx0XHRpZiAoZGVzYy5oYXJkUHJvb2YgIT09IHVuZGVmaW5lZCkgaW5mby5oYXJkUHJvb2YgPSBkZXNjLmhhcmRQcm9vZjtcblx0XHRpZiAoZGVzYy5wcmludFByb29mU2V0dXApIHtcblx0XHRcdGlmICgnQmx0bicgaW4gZGVzYy5wcmludFByb29mU2V0dXApIHtcblx0XHRcdFx0aW5mby5wcm9vZlNldHVwID0geyBidWlsdGluOiBkZXNjLnByaW50UHJvb2ZTZXR1cC5CbHRuLnNwbGl0KCcuJylbMV0gfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluZm8ucHJvb2ZTZXR1cCA9IHtcblx0XHRcdFx0XHRwcm9maWxlOiBkZXNjLnByaW50UHJvb2ZTZXR1cC5wcm9maWxlLFxuXHRcdFx0XHRcdHJlbmRlcmluZ0ludGVudDogSW50ZS5kZWNvZGUoZGVzYy5wcmludFByb29mU2V0dXAuSW50ZSA/PyAnSW50ZS5JbWcgJyksXG5cdFx0XHRcdFx0YmxhY2tQb2ludENvbXBlbnNhdGlvbjogISFkZXNjLnByaW50UHJvb2ZTZXR1cC5NcEJsLFxuXHRcdFx0XHRcdHBhcGVyV2hpdGU6ICEhZGVzYy5wcmludFByb29mU2V0dXAucGFwZXJXaGl0ZSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQucHJpbnRJbmZvcm1hdGlvbiE7XG5cdFx0Y29uc3QgZGVzYzogUHJpbnRJbmZvcm1hdGlvbkRlc2NyaXB0b3IgPSB7fTtcblxuXHRcdGlmIChpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzKSB7XG5cdFx0XHRkZXNjLlBzdFMgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoaW5mby5oYXJkUHJvb2YgIT09IHVuZGVmaW5lZCkgZGVzYy5oYXJkUHJvb2YgPSAhIWluZm8uaGFyZFByb29mO1xuXHRcdFx0ZGVzYy5DbHJTID0gJ0NscnMuUkdCQyc7IC8vIFRPRE86ID8/P1xuXHRcdFx0ZGVzY1snTm0gICddID0gaW5mby5wcmludGVyUHJvZmlsZSA/PyAnQ0lFIFJHQic7XG5cdFx0fVxuXG5cdFx0ZGVzYy5JbnRlID0gSW50ZS5lbmNvZGUoaW5mby5yZW5kZXJpbmdJbnRlbnQpO1xuXG5cdFx0aWYgKCFpbmZvLnByaW50ZXJNYW5hZ2VzQ29sb3JzKSBkZXNjLk1wQmwgPSAhIWluZm8uYmxhY2tQb2ludENvbXBlbnNhdGlvbjtcblxuXHRcdGRlc2MucHJpbnRTaXh0ZWVuQml0ID0gISFpbmZvLnByaW50U2l4dGVlbkJpdDtcblx0XHRkZXNjLnByaW50ZXJOYW1lID0gaW5mby5wcmludGVyTmFtZSB8fCAnJztcblxuXHRcdGlmIChpbmZvLnByb29mU2V0dXAgJiYgJ3Byb2ZpbGUnIGluIGluZm8ucHJvb2ZTZXR1cCkge1xuXHRcdFx0ZGVzYy5wcmludFByb29mU2V0dXAgPSB7XG5cdFx0XHRcdHByb2ZpbGU6IGluZm8ucHJvb2ZTZXR1cC5wcm9maWxlIHx8ICcnLFxuXHRcdFx0XHRJbnRlOiBJbnRlLmVuY29kZShpbmZvLnByb29mU2V0dXAucmVuZGVyaW5nSW50ZW50KSxcblx0XHRcdFx0TXBCbDogISFpbmZvLnByb29mU2V0dXAuYmxhY2tQb2ludENvbXBlbnNhdGlvbixcblx0XHRcdFx0cGFwZXJXaGl0ZTogISFpbmZvLnByb29mU2V0dXAucGFwZXJXaGl0ZSxcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlc2MucHJpbnRQcm9vZlNldHVwID0ge1xuXHRcdFx0XHRCbHRuOiBpbmZvLnByb29mU2V0dXA/LmJ1aWx0aW4gPyBgYnVpbHRpblByb29mLiR7aW5mby5wcm9vZlNldHVwLmJ1aWx0aW59YCA6ICdidWlsdGluUHJvb2YucHJvb2ZDTVlLJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAncHJpbnRPdXRwdXQnLCBkZXNjKTtcblx0fSxcbik7XG5cbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcblx0MTA4MywgLy8gUHJpbnQgc3R5bGVcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDgzICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDgzJywgbGVmdCgpKTtcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA4MyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cblx0XHQvLyBUT0RPOlxuXHRcdC8vIGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcblx0XHQvLyBjb25zb2xlLmxvZygnMTA4MycsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjEwODMpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0MTAwNSxcblx0dGFyZ2V0ID0+IHRhcmdldC5yZXNvbHV0aW9uSW5mbyAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBob3Jpem9udGFsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcblx0XHRjb25zdCBob3Jpem9udGFsUmVzb2x1dGlvblVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0Y29uc3Qgd2lkdGhVbml0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdGNvbnN0IHZlcnRpY2FsUmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcblx0XHRjb25zdCB2ZXJ0aWNhbFJlc29sdXRpb25Vbml0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdGNvbnN0IGhlaWdodFVuaXQgPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0XHR0YXJnZXQucmVzb2x1dGlvbkluZm8gPSB7XG5cdFx0XHRob3Jpem9udGFsUmVzb2x1dGlvbixcblx0XHRcdGhvcml6b250YWxSZXNvbHV0aW9uVW5pdDogUkVTT0xVVElPTl9VTklUU1tob3Jpem9udGFsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcblx0XHRcdHdpZHRoVW5pdDogTUVBU1VSRU1FTlRfVU5JVFNbd2lkdGhVbml0XSB8fCAnSW5jaGVzJyBhcyBhbnksXG5cdFx0XHR2ZXJ0aWNhbFJlc29sdXRpb24sXG5cdFx0XHR2ZXJ0aWNhbFJlc29sdXRpb25Vbml0OiBSRVNPTFVUSU9OX1VOSVRTW3ZlcnRpY2FsUmVzb2x1dGlvblVuaXRdIHx8ICdQUEknIGFzIGFueSxcblx0XHRcdGhlaWdodFVuaXQ6IE1FQVNVUkVNRU5UX1VOSVRTW2hlaWdodFVuaXRdIHx8ICdJbmNoZXMnIGFzIGFueSxcblx0XHR9O1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LnJlc29sdXRpb25JbmZvITtcblxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgaW5mby5ob3Jpem9udGFsUmVzb2x1dGlvbiB8fCAwKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgubWF4KDEsIFJFU09MVVRJT05fVU5JVFMuaW5kZXhPZihpbmZvLmhvcml6b250YWxSZXNvbHV0aW9uVW5pdCkpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgubWF4KDEsIE1FQVNVUkVNRU5UX1VOSVRTLmluZGV4T2YoaW5mby53aWR0aFVuaXQpKSk7XG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBpbmZvLnZlcnRpY2FsUmVzb2x1dGlvbiB8fCAwKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgubWF4KDEsIFJFU09MVVRJT05fVU5JVFMuaW5kZXhPZihpbmZvLnZlcnRpY2FsUmVzb2x1dGlvblVuaXQpKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLm1heCgxLCBNRUFTVVJFTUVOVF9VTklUUy5pbmRleE9mKGluZm8uaGVpZ2h0VW5pdCkpKTtcblx0fSxcbik7XG5cbmNvbnN0IHByaW50U2NhbGVTdHlsZXMgPSBbJ2NlbnRlcmVkJywgJ3NpemUgdG8gZml0JywgJ3VzZXIgZGVmaW5lZCddO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDYyLFxuXHR0YXJnZXQgPT4gdGFyZ2V0LnByaW50U2NhbGUgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0dGFyZ2V0LnByaW50U2NhbGUgPSB7XG5cdFx0XHRzdHlsZTogcHJpbnRTY2FsZVN0eWxlc1tyZWFkSW50MTYocmVhZGVyKV0gYXMgYW55LFxuXHRcdFx0eDogcmVhZEZsb2F0MzIocmVhZGVyKSxcblx0XHRcdHk6IHJlYWRGbG9hdDMyKHJlYWRlciksXG5cdFx0XHRzY2FsZTogcmVhZEZsb2F0MzIocmVhZGVyKSxcblx0XHR9O1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCB7IHN0eWxlLCB4LCB5LCBzY2FsZSB9ID0gdGFyZ2V0LnByaW50U2NhbGUhO1xuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLm1heCgwLCBwcmludFNjYWxlU3R5bGVzLmluZGV4T2Yoc3R5bGUhKSkpO1xuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHggfHwgMCk7XG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgeSB8fCAwKTtcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCBzY2FsZSB8fCAwKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMDYsXG5cdHRhcmdldCA9PiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XG5cblx0XHR3aGlsZSAobGVmdCgpKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcblx0XHRcdHRhcmdldC5hbHBoYUNoYW5uZWxOYW1lcy5wdXNoKHZhbHVlKTtcblx0XHR9XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGZvciAoY29uc3QgbmFtZSBvZiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMhKSB7XG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIG5hbWUsIDEpO1xuXHRcdH1cblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwNDUsXG5cdHRhcmdldCA9PiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0dGFyZ2V0LmFscGhhQ2hhbm5lbE5hbWVzID0gW107XG5cblx0XHR3aGlsZSAobGVmdCgpKSB7XG5cdFx0XHR0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMucHVzaChyZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpKTtcblx0XHR9XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGZvciAoY29uc3QgbmFtZSBvZiB0YXJnZXQuYWxwaGFDaGFubmVsTmFtZXMhKSB7XG5cdFx0XHR3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXIsIG5hbWUpO1xuXHRcdH1cblx0fSxcbik7XG5cbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcblx0MTA3Nyxcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDc3ICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDc3JywgbGVmdCgpKTtcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA3NyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA3Nyk7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDUzLFxuXHR0YXJnZXQgPT4gdGFyZ2V0LmFscGhhSWRlbnRpZmllcnMgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0dGFyZ2V0LmFscGhhSWRlbnRpZmllcnMgPSBbXTtcblxuXHRcdHdoaWxlIChsZWZ0KCkgPj0gNCkge1xuXHRcdFx0dGFyZ2V0LmFscGhhSWRlbnRpZmllcnMucHVzaChyZWFkVWludDMyKHJlYWRlcikpO1xuXHRcdH1cblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Zm9yIChjb25zdCBpZCBvZiB0YXJnZXQuYWxwaGFJZGVudGlmaWVycyEpIHtcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgaWQpO1xuXHRcdH1cblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMTAsXG5cdHRhcmdldCA9PiB0YXJnZXQuYmFja2dyb3VuZENvbG9yICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LmJhY2tncm91bmRDb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlQ29sb3Iod3JpdGVyLCB0YXJnZXQuYmFja2dyb3VuZENvbG9yISksXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDM3LFxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmdsb2JhbEFuZ2xlICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0Lmdsb2JhbEFuZ2xlID0gcmVhZFVpbnQzMihyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0Lmdsb2JhbEFuZ2xlISksXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDQ5LFxuXHR0YXJnZXQgPT4gdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlID0gcmVhZFVpbnQzMihyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0Lmdsb2JhbEFsdGl0dWRlISksXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDExLFxuXHR0YXJnZXQgPT4gdGFyZ2V0LnByaW50RmxhZ3MgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0dGFyZ2V0LnByaW50RmxhZ3MgPSB7XG5cdFx0XHRsYWJlbHM6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0XHRjcm9wTWFya3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0XHRjb2xvckJhcnM6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0XHRyZWdpc3RyYXRpb25NYXJrczogISFyZWFkVWludDgocmVhZGVyKSxcblx0XHRcdG5lZ2F0aXZlOiAhIXJlYWRVaW50OChyZWFkZXIpLFxuXHRcdFx0ZmxpcDogISFyZWFkVWludDgocmVhZGVyKSxcblx0XHRcdGludGVycG9sYXRlOiAhIXJlYWRVaW50OChyZWFkZXIpLFxuXHRcdFx0Y2FwdGlvbjogISFyZWFkVWludDgocmVhZGVyKSxcblx0XHRcdHByaW50RmxhZ3M6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0fTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgZmxhZ3MgPSB0YXJnZXQucHJpbnRGbGFncyE7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmxhYmVscyA/IDEgOiAwKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuY3JvcE1hcmtzID8gMSA6IDApO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5jb2xvckJhcnMgPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLnJlZ2lzdHJhdGlvbk1hcmtzID8gMSA6IDApO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncy5uZWdhdGl2ZSA/IDEgOiAwKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuZmxpcCA/IDEgOiAwKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MuaW50ZXJwb2xhdGUgPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLmNhcHRpb24gPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzLnByaW50RmxhZ3MgPyAxIDogMCk7XG5cdH0sXG4pO1xuXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXG5cdDEwMDAwLCAvLyBQcmludCBmbGFnc1xuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMDAwICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDAwMCcsIGxlZnQoKSk7XG5cdFx0KHRhcmdldCBhcyBhbnkpLl9pcjEwMDAwID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDAwMCk7XG5cdH0sXG4pO1xuXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXG5cdDEwMTMsIC8vIENvbG9yIGhhbGZ0b25pbmdcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDEzICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDEzJywgbGVmdCgpKTtcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTAxMyA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTAxMyk7XG5cdH0sXG4pO1xuXG5NT0NLX0hBTkRMRVJTICYmIGFkZEhhbmRsZXIoXG5cdDEwMTYsIC8vIENvbG9yIHRyYW5zZmVyIGZ1bmN0aW9uc1xuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMTYgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0Y29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMTYnLCBsZWZ0KCkpO1xuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDE2ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDE2KTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMjQsXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJTdGF0ZSAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5sYXllclN0YXRlID0gcmVhZFVpbnQxNihyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDE2KHdyaXRlciwgdGFyZ2V0LmxheWVyU3RhdGUhKSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMjYsXG5cdHRhcmdldCA9PiB0YXJnZXQubGF5ZXJzR3JvdXAgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0dGFyZ2V0LmxheWVyc0dyb3VwID0gW107XG5cblx0XHR3aGlsZSAobGVmdCgpKSB7XG5cdFx0XHR0YXJnZXQubGF5ZXJzR3JvdXAucHVzaChyZWFkVWludDE2KHJlYWRlcikpO1xuXHRcdH1cblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Zm9yIChjb25zdCBnIG9mIHRhcmdldC5sYXllcnNHcm91cCEpIHtcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgZyk7XG5cdFx0fVxuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0MTA3Mixcblx0dGFyZ2V0ID0+IHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZCAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHR0YXJnZXQubGF5ZXJHcm91cHNFbmFibGVkSWQgPSBbXTtcblxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcblx0XHRcdHRhcmdldC5sYXllckdyb3Vwc0VuYWJsZWRJZC5wdXNoKHJlYWRVaW50OChyZWFkZXIpKTtcblx0XHR9XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGZvciAoY29uc3QgaWQgb2YgdGFyZ2V0LmxheWVyR3JvdXBzRW5hYmxlZElkISkge1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGlkKTtcblx0XHR9XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDY5LFxuXHR0YXJnZXQgPT4gdGFyZ2V0LmxheWVyU2VsZWN0aW9uSWRzICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xuXHRcdGxldCBjb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0XHR0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMgPSBbXTtcblxuXHRcdHdoaWxlIChjb3VudC0tKSB7XG5cdFx0XHR0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMucHVzaChyZWFkVWludDMyKHJlYWRlcikpO1xuXHRcdH1cblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCB0YXJnZXQubGF5ZXJTZWxlY3Rpb25JZHMhLmxlbmd0aCk7XG5cblx0XHRmb3IgKGNvbnN0IGlkIG9mIHRhcmdldC5sYXllclNlbGVjdGlvbklkcyEpIHtcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgaWQpO1xuXHRcdH1cblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMzIsXG5cdHRhcmdldCA9PiB0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRjb25zdCB2ZXJ0aWNhbCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgMTAzMiByZXNvdXJjZSB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XG5cblx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uID0ge1xuXHRcdFx0Z3JpZDogeyBob3Jpem9udGFsLCB2ZXJ0aWNhbCB9LFxuXHRcdFx0Z3VpZGVzOiBbXSxcblx0XHR9O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG5cdFx0XHR0YXJnZXQuZ3JpZEFuZEd1aWRlc0luZm9ybWF0aW9uLmd1aWRlcyEucHVzaCh7XG5cdFx0XHRcdGxvY2F0aW9uOiByZWFkVWludDMyKHJlYWRlcikgLyAzMixcblx0XHRcdFx0ZGlyZWN0aW9uOiByZWFkVWludDgocmVhZGVyKSA/ICdob3Jpem9udGFsJyA6ICd2ZXJ0aWNhbCdcblx0XHRcdH0pO1xuXHRcdH1cblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5ncmlkQW5kR3VpZGVzSW5mb3JtYXRpb24hO1xuXHRcdGNvbnN0IGdyaWQgPSBpbmZvLmdyaWQgfHwgeyBob3Jpem9udGFsOiAxOCAqIDMyLCB2ZXJ0aWNhbDogMTggKiAzMiB9O1xuXHRcdGNvbnN0IGd1aWRlcyA9IGluZm8uZ3VpZGVzIHx8IFtdO1xuXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAxKTtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGdyaWQuaG9yaXpvbnRhbCk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBncmlkLnZlcnRpY2FsKTtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGd1aWRlcy5sZW5ndGgpO1xuXG5cdFx0Zm9yIChjb25zdCBnIG9mIGd1aWRlcykge1xuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBnLmxvY2F0aW9uICogMzIpO1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGcuZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCcgPyAxIDogMCk7XG5cdFx0fVxuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0MTA1NCxcblx0dGFyZ2V0ID0+IHRhcmdldC51cmxzTGlzdCAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIF8sIG9wdGlvbnMpID0+IHtcblx0XHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdGlmIChjb3VudCkge1xuXHRcdFx0aWYgKCFvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSByZXR1cm47XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZDogVVJMIExpc3QnKTtcblx0XHR9XG5cblx0XHQvLyBUT0RPOiByZWFkIGFjdHVhbCBVUkwgbGlzdFxuXHRcdHRhcmdldC51cmxzTGlzdCA9IFtdO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC51cmxzTGlzdCEubGVuZ3RoKTtcblxuXHRcdC8vIFRPRE86IHdyaXRlIGFjdHVhbCBVUkwgbGlzdFxuXHRcdGlmICh0YXJnZXQudXJsc0xpc3QhLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgaW1wbGVtZW50ZWQ6IFVSTCBMaXN0Jyk7XG5cdFx0fVxuXHR9LFxuKTtcblxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxuXHQxMDUwLCAvLyBTbGljZXNcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDUwICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDUwJywgbGVmdCgpKTtcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA1MCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA1MCk7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQxMDY0LFxuXHR0YXJnZXQgPT4gdGFyZ2V0LnBpeGVsQXNwZWN0UmF0aW8gIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRpZiAodmVyc2lvbiA+IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwaXhlbEFzcGVjdFJhdGlvIHZlcnNpb24nKTtcblxuXHRcdHRhcmdldC5waXhlbEFzcGVjdFJhdGlvID0geyBhc3BlY3Q6IHJlYWRGbG9hdDY0KHJlYWRlcikgfTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHRhcmdldC5waXhlbEFzcGVjdFJhdGlvIS5hc3BlY3QpO1xuXHR9LFxuKTtcblxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxuXHQxMDM5LCAvLyBJQ0MgUHJvZmlsZVxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMzkgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0Y29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMzknLCBsZWZ0KCkpO1xuXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDM5ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDM5KTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwNDQsXG5cdHRhcmdldCA9PiB0YXJnZXQuaWRzU2VlZE51bWJlciAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5pZHNTZWVkTnVtYmVyID0gcmVhZFVpbnQzMihyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0Lmlkc1NlZWROdW1iZXIhKSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdDEwMzYsXG5cdHRhcmdldCA9PiB0YXJnZXQudGh1bWJuYWlsICE9PSB1bmRlZmluZWQgfHwgdGFyZ2V0LnRodW1ibmFpbFJhdyAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIG9wdGlvbnMpID0+IHtcblx0XHRjb25zdCBmb3JtYXQgPSByZWFkVWludDMyKHJlYWRlcik7IC8vIDEgPSBrSnBlZ1JHQiwgMCA9IGtSYXdSR0Jcblx0XHRjb25zdCB3aWR0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRjb25zdCBoZWlnaHQgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyB3aWR0aEJ5dGVzID0gKHdpZHRoICogYml0c19wZXJfcGl4ZWwgKyAzMSkgLyAzMiAqIDQuXG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyB0b3RhbFNpemUgPSB3aWR0aEJ5dGVzICogaGVpZ2h0ICogcGxhbmVzXG5cdFx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyBzaXplQWZ0ZXJDb21wcmVzc2lvblxuXHRcdGNvbnN0IGJpdHNQZXJQaXhlbCA9IHJlYWRVaW50MTYocmVhZGVyKTsgLy8gMjRcblx0XHRjb25zdCBwbGFuZXMgPSByZWFkVWludDE2KHJlYWRlcik7IC8vIDFcblxuXHRcdGlmIChmb3JtYXQgIT09IDEgfHwgYml0c1BlclBpeGVsICE9PSAyNCB8fCBwbGFuZXMgIT09IDEpIHtcblx0XHRcdG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIHRodW1ibmFpbCBkYXRhIChmb3JtYXQ6ICR7Zm9ybWF0fSwgYml0c1BlclBpeGVsOiAke2JpdHNQZXJQaXhlbH0sIHBsYW5lczogJHtwbGFuZXN9KWApO1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzaXplID0gbGVmdCgpO1xuXHRcdGNvbnN0IGRhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBzaXplKTtcblxuXHRcdGlmIChvcHRpb25zLnVzZVJhd1RodW1ibmFpbCkge1xuXHRcdFx0dGFyZ2V0LnRodW1ibmFpbFJhdyA9IHsgd2lkdGgsIGhlaWdodCwgZGF0YSB9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0YXJnZXQudGh1bWJuYWlsID0gY3JlYXRlQ2FudmFzRnJvbURhdGEoZGF0YSk7XG5cdFx0fVxuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRsZXQgd2lkdGggPSAwO1xuXHRcdGxldCBoZWlnaHQgPSAwO1xuXHRcdGxldCBkYXRhOiBVaW50OEFycmF5O1xuXG5cdFx0aWYgKHRhcmdldC50aHVtYm5haWxSYXcpIHtcblx0XHRcdHdpZHRoID0gdGFyZ2V0LnRodW1ibmFpbFJhdy53aWR0aDtcblx0XHRcdGhlaWdodCA9IHRhcmdldC50aHVtYm5haWxSYXcuaGVpZ2h0O1xuXHRcdFx0ZGF0YSA9IHRhcmdldC50aHVtYm5haWxSYXcuZGF0YTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d2lkdGggPSB0YXJnZXQudGh1bWJuYWlsIS53aWR0aDtcblx0XHRcdGhlaWdodCA9IHRhcmdldC50aHVtYm5haWwhLmhlaWdodDtcblx0XHRcdGRhdGEgPSB0b0J5dGVBcnJheSh0YXJnZXQudGh1bWJuYWlsIS50b0RhdGFVUkwoJ2ltYWdlL2pwZWcnLCAxKS5zdWJzdHIoJ2RhdGE6aW1hZ2UvanBlZztiYXNlNjQsJy5sZW5ndGgpKTtcblx0XHR9XG5cblx0XHRjb25zdCBiaXRzUGVyUGl4ZWwgPSAyNDtcblx0XHRjb25zdCB3aWR0aEJ5dGVzID0gTWF0aC5mbG9vcigod2lkdGggKiBiaXRzUGVyUGl4ZWwgKyAzMSkgLyAzMikgKiA0O1xuXHRcdGNvbnN0IHBsYW5lcyA9IDE7XG5cdFx0Y29uc3QgdG90YWxTaXplID0gd2lkdGhCeXRlcyAqIGhlaWdodCAqIHBsYW5lcztcblx0XHRjb25zdCBzaXplQWZ0ZXJDb21wcmVzc2lvbiA9IGRhdGEubGVuZ3RoO1xuXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAxKTsgLy8gMSA9IGtKcGVnUkdCXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB3aWR0aCk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBoZWlnaHQpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgd2lkdGhCeXRlcyk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0b3RhbFNpemUpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgc2l6ZUFmdGVyQ29tcHJlc3Npb24pO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgYml0c1BlclBpeGVsKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHBsYW5lcyk7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIGRhdGEpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0MTA1Nyxcblx0dGFyZ2V0ID0+IHRhcmdldC52ZXJzaW9uSW5mbyAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdmVyc2lvbkluZm8gdmVyc2lvbicpO1xuXG5cdFx0dGFyZ2V0LnZlcnNpb25JbmZvID0ge1xuXHRcdFx0aGFzUmVhbE1lcmdlZERhdGE6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0XHR3cml0ZXJOYW1lOiByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpLFxuXHRcdFx0cmVhZGVyTmFtZTogcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKSxcblx0XHRcdGZpbGVWZXJzaW9uOiByZWFkVWludDMyKHJlYWRlciksXG5cdFx0fTtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IHZlcnNpb25JbmZvID0gdGFyZ2V0LnZlcnNpb25JbmZvITtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHZlcnNpb25JbmZvLmhhc1JlYWxNZXJnZWREYXRhID8gMSA6IDApO1xuXHRcdHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXIsIHZlcnNpb25JbmZvLndyaXRlck5hbWUpO1xuXHRcdHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXIsIHZlcnNpb25JbmZvLnJlYWRlck5hbWUpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdmVyc2lvbkluZm8uZmlsZVZlcnNpb24pO1xuXHR9LFxuKTtcblxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxuXHQxMDU4LCAvLyBFWElGIGRhdGEgMS5cblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXIxMDU4ICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnNvbGUubG9nKCdpbWFnZSByZXNvdXJjZSAxMDU4JywgbGVmdCgpKTtcblx0XHQodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2lyMTA1OCk7XG5cdH0sXG4pO1xuXG4vLyBhZGRIYW5kbGVyKFxuLy8gXHQxMDI1LFxuLy8gXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjEwMjUgIT09IHVuZGVmaW5lZCxcbi8vIFx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG4vLyBcdFx0Y29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDEwMjUnLCBsZWZ0KCkpO1xuLy8gXHRcdCh0YXJnZXQgYXMgYW55KS5faXIxMDI1ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcbi8vIFx0fSxcbi8vIFx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG4vLyBcdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXIxMDI1KTtcbi8vIFx0fSxcbi8vICk7XG5cbmNvbnN0IEZybUQgPSBjcmVhdGVFbnVtPCdhdXRvJyB8ICdub25lJyB8ICdkaXNwb3NlJz4oJ0ZybUQnLCAnJywge1xuXHRhdXRvOiAnQXV0bycsXG5cdG5vbmU6ICdOb25lJyxcblx0ZGlzcG9zZTogJ0Rpc3AnLFxufSk7XG5cbmludGVyZmFjZSBBbmltYXRpb25EZXNjcmlwdG9yIHtcblx0QUZTdDogbnVtYmVyO1xuXHRGckluOiB7XG5cdFx0RnJJRDogbnVtYmVyO1xuXHRcdEZyRGw6IG51bWJlcjtcblx0XHRGckRzOiBzdHJpbmc7XG5cdFx0RnJHQT86IG51bWJlcjtcblx0fVtdO1xuXHRGU3RzOiB7XG5cdFx0RnNJRDogbnVtYmVyO1xuXHRcdEFGcm06IG51bWJlcjtcblx0XHRGc0ZyOiBudW1iZXJbXTtcblx0XHRMQ250OiBudW1iZXI7XG5cdH1bXTtcbn1cblxuaW50ZXJmYWNlIEFuaW1hdGlvbnMge1xuXHRmcmFtZXM6IHtcblx0XHRpZDogbnVtYmVyO1xuXHRcdGRlbGF5OiBudW1iZXI7XG5cdFx0ZGlzcG9zZT86ICdhdXRvJyB8ICdub25lJyB8ICdkaXNwb3NlJztcblx0fVtdO1xuXHRhbmltYXRpb25zOiB7XG5cdFx0aWQ6IG51bWJlcjtcblx0XHRmcmFtZXM6IG51bWJlcltdO1xuXHRcdHJlcGVhdHM/OiBudW1iZXI7XG5cdH1bXTtcbn1cblxuLy8gVE9ETzogVW5maW5pc2hlZFxuTU9DS19IQU5ETEVSUyAmJiBhZGRIYW5kbGVyKFxuXHQ0MDAwLFxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBhbnkpLl9pcjQwMDAgIT09IHVuZGVmaW5lZCxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCB7IGxvZ01pc3NpbmdGZWF0dXJlcywgbG9nRGV2RmVhdHVyZXMgfSkgPT4ge1xuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnaW1hZ2UgcmVzb3VyY2UgNDAwMCcsIGxlZnQoKSk7XG5cdFx0XHQodGFyZ2V0IGFzIGFueSkuX2lyNDAwMCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qga2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xuXG5cdFx0aWYgKGtleSA9PT0gJ21hbmknKSB7XG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICdJUkZSJyk7XG5cdFx0XHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xuXHRcdFx0XHR3aGlsZSAobGVmdCgpKSB7XG5cdFx0XHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xuXHRcdFx0XHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcblxuXHRcdFx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoa2V5ID09PSAnQW5EcycpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIEFuaW1hdGlvbkRlc2NyaXB0b3I7XG5cdFx0XHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdBbkRzJywgZGVzYyk7XG5cdFx0XHRcdFx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzJywgZGVzYyk7XG5cdFx0XHRcdFx0XHRcdC8vIGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XG5cblx0XHRcdFx0XHRcdFx0Y29uc3QgcmVzdWx0OiBBbmltYXRpb25zID0ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGRlc2MuQUZTdCA/Pz9cblx0XHRcdFx0XHRcdFx0XHRmcmFtZXM6IGRlc2MuRnJJbi5tYXAoeCA9PiAoe1xuXHRcdFx0XHRcdFx0XHRcdFx0aWQ6IHguRnJJRCxcblx0XHRcdFx0XHRcdFx0XHRcdGRlbGF5OiB4LkZyRGwgLyAxMDAsXG5cdFx0XHRcdFx0XHRcdFx0XHRkaXNwb3NlOiB4LkZyRHMgPyBGcm1ELmRlY29kZSh4LkZyRHMpIDogJ2F1dG8nLCAvLyBtaXNzaW5nID09IGF1dG9cblx0XHRcdFx0XHRcdFx0XHRcdC8vIHguRnJHQSA/Pz9cblx0XHRcdFx0XHRcdFx0XHR9KSksXG5cdFx0XHRcdFx0XHRcdFx0YW5pbWF0aW9uczogZGVzYy5GU3RzLm1hcCh4ID0+ICh7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogeC5Gc0lELFxuXHRcdFx0XHRcdFx0XHRcdFx0ZnJhbWVzOiB4LkZzRnIsXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXBlYXRzOiB4LkxDbnQsXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyB4LkFGcm0gPz8/XG5cdFx0XHRcdFx0XHRcdFx0fSkpLFxuXHRcdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzOnJlc3VsdCcsIHJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdC8vIGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCcjNDAwMCBBbkRzOnJlc3VsdCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHJlc3VsdCwgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ1JvbGwnKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHRcdFx0XHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIFJvbGwnLCBieXRlcyk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRsb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBzdWJzZWN0aW9uIGluICM0MDAwJywga2V5KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdtb3B0Jykge1xuXHRcdFx0Y29uc3QgYnl0ZXMgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdFx0bG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJyM0MDAwIG1vcHQnLCBieXRlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIGtleSBpbiAjNDAwMDonLCBrZXkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsICh0YXJnZXQgYXMgYW55KS5faXI0MDAwKTtcblx0fSxcbik7XG5cbi8vIFRPRE86IFVuZmluaXNoZWRcbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcblx0NDAwMSxcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5faXI0MDAxICE9PSB1bmRlZmluZWQsXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgeyBsb2dNaXNzaW5nRmVhdHVyZXMsIGxvZ0RldkZlYXR1cmVzIH0pID0+IHtcblx0XHRpZiAoTU9DS19IQU5ETEVSUykge1xuXHRcdFx0Y29uc29sZS5sb2coJ2ltYWdlIHJlc291cmNlIDQwMDEnLCBsZWZ0KCkpO1xuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9pcjQwMDEgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcblxuXHRcdGlmIChrZXkgPT09ICdtZnJpJykge1xuXHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdGlmICh2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWZyaSB2ZXJzaW9uJyk7XG5cblx0XHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdGNvbnN0IGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcblx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdtZnJpJywgYnl0ZXMpO1xuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnbXNldCcpIHtcblx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcblx0XHRcdGxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdtc2V0JywgZGVzYyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIGtleSBpbiAjNDAwMScsIGtleSk7XG5cdFx0fVxuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9pcjQwMDEpO1xuXHR9LFxuKTtcbiJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2pvZXJhaWkvZGV2L2FnLXBzZC9zcmMifQ==
