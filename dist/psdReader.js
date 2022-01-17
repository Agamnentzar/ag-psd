"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPattern = exports.readColor = exports.readSection = exports.readDataRLE = exports.readPsd = exports.checkSignature = exports.skipBytes = exports.readAsciiString = exports.readUnicodeStringWithLength = exports.readUnicodeString = exports.readPascalString = exports.readSignature = exports.readBytes = exports.readFixedPointPath32 = exports.readFixedPoint32 = exports.readFloat64 = exports.readFloat32 = exports.readUint32 = exports.readInt32LE = exports.readInt32 = exports.readUint16 = exports.readInt16 = exports.peekUint8 = exports.readUint8 = exports.createReader = exports.supportedColorModes = void 0;
var helpers_1 = require("./helpers");
var additionalInfo_1 = require("./additionalInfo");
var imageResources_1 = require("./imageResources");
exports.supportedColorModes = [0 /* Bitmap */, 1 /* Grayscale */, 3 /* RGB */];
var colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];
function setupGrayscale(data) {
    var size = data.width * data.height * 4;
    for (var i = 0; i < size; i += 4) {
        data.data[i + 1] = data.data[i];
        data.data[i + 2] = data.data[i];
    }
}
function createReader(buffer, offset, length) {
    var view = new DataView(buffer, offset, length);
    return { view: view, offset: 0 };
}
exports.createReader = createReader;
function readUint8(reader) {
    reader.offset += 1;
    return reader.view.getUint8(reader.offset - 1);
}
exports.readUint8 = readUint8;
function peekUint8(reader) {
    return reader.view.getUint8(reader.offset);
}
exports.peekUint8 = peekUint8;
function readInt16(reader) {
    reader.offset += 2;
    return reader.view.getInt16(reader.offset - 2, false);
}
exports.readInt16 = readInt16;
function readUint16(reader) {
    reader.offset += 2;
    return reader.view.getUint16(reader.offset - 2, false);
}
exports.readUint16 = readUint16;
function readInt32(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, false);
}
exports.readInt32 = readInt32;
function readInt32LE(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, true);
}
exports.readInt32LE = readInt32LE;
function readUint32(reader) {
    reader.offset += 4;
    return reader.view.getUint32(reader.offset - 4, false);
}
exports.readUint32 = readUint32;
function readFloat32(reader) {
    reader.offset += 4;
    return reader.view.getFloat32(reader.offset - 4, false);
}
exports.readFloat32 = readFloat32;
function readFloat64(reader) {
    reader.offset += 8;
    return reader.view.getFloat64(reader.offset - 8, false);
}
exports.readFloat64 = readFloat64;
// 32-bit fixed-point number 16.16
function readFixedPoint32(reader) {
    return readInt32(reader) / (1 << 16);
}
exports.readFixedPoint32 = readFixedPoint32;
// 32-bit fixed-point number 8.24
function readFixedPointPath32(reader) {
    return readInt32(reader) / (1 << 24);
}
exports.readFixedPointPath32 = readFixedPointPath32;
function readBytes(reader, length) {
    reader.offset += length;
    return new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset - length, length);
}
exports.readBytes = readBytes;
function readSignature(reader) {
    return readShortString(reader, 4);
}
exports.readSignature = readSignature;
function readPascalString(reader, padTo) {
    var length = readUint8(reader);
    var text = length ? readShortString(reader, length) : '';
    while (++length % padTo) {
        reader.offset++;
    }
    return text;
}
exports.readPascalString = readPascalString;
function readUnicodeString(reader) {
    var length = readUint32(reader);
    return readUnicodeStringWithLength(reader, length);
}
exports.readUnicodeString = readUnicodeString;
function readUnicodeStringWithLength(reader, length) {
    var text = '';
    while (length--) {
        var value = readUint16(reader);
        if (value || length > 0) { // remove trailing \0
            text += String.fromCharCode(value);
        }
    }
    return text;
}
exports.readUnicodeStringWithLength = readUnicodeStringWithLength;
function readAsciiString(reader, length) {
    var text = '';
    while (length--) {
        text += String.fromCharCode(readUint8(reader));
    }
    return text;
}
exports.readAsciiString = readAsciiString;
function skipBytes(reader, count) {
    reader.offset += count;
}
exports.skipBytes = skipBytes;
function checkSignature(reader, a, b) {
    var offset = reader.offset;
    var signature = readSignature(reader);
    if (signature !== a && signature !== b) {
        throw new Error("Invalid signature: '".concat(signature, "' at 0x").concat(offset.toString(16)));
    }
}
exports.checkSignature = checkSignature;
function readShortString(reader, length) {
    var buffer = readBytes(reader, length);
    var result = '';
    for (var i = 0; i < buffer.length; i++) {
        result += String.fromCharCode(buffer[i]);
    }
    return result;
}
function readPsd(reader, options) {
    var _a;
    if (options === void 0) { options = {}; }
    // header
    checkSignature(reader, '8BPS');
    var version = readUint16(reader);
    if (version !== 1 && version !== 2)
        throw new Error("Invalid PSD file version: ".concat(version));
    skipBytes(reader, 6);
    var channels = readUint16(reader);
    var height = readUint32(reader);
    var width = readUint32(reader);
    var bitsPerChannel = readUint16(reader);
    var colorMode = readUint16(reader);
    if (exports.supportedColorModes.indexOf(colorMode) === -1)
        throw new Error("Color mode not supported: ".concat((_a = colorModes[colorMode]) !== null && _a !== void 0 ? _a : colorMode));
    var psd = { width: width, height: height, channels: channels, bitsPerChannel: bitsPerChannel, colorMode: colorMode };
    var opt = __assign(__assign({}, options), { large: version === 2 });
    // color mode data
    readSection(reader, 1, function (left) {
        if (opt.throwForMissingFeatures)
            throw new Error('Color mode data not supported');
        skipBytes(reader, left());
    });
    // image resources
    readSection(reader, 1, function (left) {
        var _loop_1 = function () {
            var sig = readSignature(reader);
            if (sig !== '8BIM' && sig !== 'MeSa' && sig !== 'AgHg' && sig !== 'PHUT' && sig !== 'DCSR') {
                throw new Error("Invalid signature: '".concat(sig, "' at 0x").concat((reader.offset - 4).toString(16)));
            }
            var id = readUint16(reader);
            readPascalString(reader, 2); // name
            readSection(reader, 2, function (left) {
                var handler = imageResources_1.resourceHandlersMap[id];
                var skip = id === 1036 && !!opt.skipThumbnail;
                if (!psd.imageResources) {
                    psd.imageResources = {};
                }
                if (handler && !skip) {
                    try {
                        handler.read(reader, psd.imageResources, left, opt);
                    }
                    catch (e) {
                        if (opt.throwForMissingFeatures)
                            throw e;
                        skipBytes(reader, left());
                    }
                }
                else {
                    // options.logMissingFeatures && console.log(`Unhandled image resource: ${id}`);
                    skipBytes(reader, left());
                }
            });
        };
        while (left()) {
            _loop_1();
        }
    });
    // layer and mask info
    var globalAlpha = false;
    readSection(reader, 1, function (left) {
        globalAlpha = readLayerInfo(reader, psd, opt);
        // SAI does not include this section
        if (left() > 0) {
            var globalLayerMaskInfo = readGlobalLayerMaskInfo(reader);
            if (globalLayerMaskInfo)
                psd.globalLayerMaskInfo = globalLayerMaskInfo;
        }
        else {
            // revert back to end of section if exceeded section limits
            // opt.logMissingFeatures && console.log('reverting to end of section');
            skipBytes(reader, left());
        }
        while (left() > 0) {
            // sometimes there are empty bytes here
            while (left() && peekUint8(reader) === 0) {
                // opt.logMissingFeatures && console.log('skipping 0 byte');
                skipBytes(reader, 1);
            }
            if (left() >= 12) {
                readAdditionalLayerInfo(reader, psd, psd, opt);
            }
            else {
                // opt.logMissingFeatures && console.log('skipping leftover bytes', left());
                skipBytes(reader, left());
            }
        }
    }, undefined, opt.large);
    var hasChildren = psd.children && psd.children.length;
    var skipComposite = opt.skipCompositeImageData && (opt.skipLayerImageData || hasChildren);
    if (!skipComposite) {
        readImageData(reader, psd, globalAlpha, opt);
    }
    // TODO: show converted color mode instead of original PSD file color mode
    //       but add option to preserve file color mode (need to return image data instead of canvas in that case)
    // psd.colorMode = ColorMode.RGB; // we convert all color modes to RGB
    return psd;
}
exports.readPsd = readPsd;
function readLayerInfo(reader, psd, options) {
    var globalAlpha = false;
    readSection(reader, 2, function (left) {
        var layerCount = readInt16(reader);
        if (layerCount < 0) {
            globalAlpha = true;
            layerCount = -layerCount;
        }
        var layers = [];
        var layerChannels = [];
        for (var i = 0; i < layerCount; i++) {
            var _a = readLayerRecord(reader, psd, options), layer = _a.layer, channels = _a.channels;
            layers.push(layer);
            layerChannels.push(channels);
        }
        if (!options.skipLayerImageData) {
            for (var i = 0; i < layerCount; i++) {
                readLayerChannelImageData(reader, psd, layers[i], layerChannels[i], options);
            }
        }
        skipBytes(reader, left());
        if (!psd.children)
            psd.children = [];
        var stack = [psd];
        for (var i = layers.length - 1; i >= 0; i--) {
            var l = layers[i];
            var type = l.sectionDivider ? l.sectionDivider.type : 0 /* Other */;
            if (type === 1 /* OpenFolder */ || type === 2 /* ClosedFolder */) {
                l.opened = type === 1 /* OpenFolder */;
                l.children = [];
                var parent_1 = stack[stack.length - 1];
                if (parent_1 && parent_1.name) {
                    l.parentPath = parent_1.name;
                }
                stack[stack.length - 1].children.unshift(l);
                stack.push(l);
            }
            else if (type === 3 /* BoundingSectionDivider */) {
                stack.pop();
                // this was workaround because I didn't know what `lsdk` section was, now it's probably not needed anymore
                // } else if (l.name === '</Layer group>' && !l.sectionDivider && !l.top && !l.left && !l.bottom && !l.right) {
                // 	// sometimes layer group terminator doesn't have sectionDivider, so we just guess here (PS bug ?)
                // 	stack.pop();
            }
            else {
                var parent_2 = stack[stack.length - 1];
                if (parent_2 && parent_2.name) {
                    l.parentPath = parent_2.name;
                }
                stack[stack.length - 1].children.unshift(l);
            }
        }
    }, undefined, options.large);
    return globalAlpha;
}
function readLayerRecord(reader, psd, options) {
    var layer = {};
    layer.top = readInt32(reader);
    layer.left = readInt32(reader);
    layer.bottom = readInt32(reader);
    layer.right = readInt32(reader);
    var channelCount = readUint16(reader);
    var channels = [];
    for (var i = 0; i < channelCount; i++) {
        var channelID = readInt16(reader);
        var channelLength = readUint32(reader);
        if (options.large) {
            if (channelLength !== 0)
                throw new Error('Sizes larger than 4GB are not supported');
            channelLength = readUint32(reader);
        }
        channels.push({ id: channelID, length: channelLength });
    }
    checkSignature(reader, '8BIM');
    var blendMode = readSignature(reader);
    if (!helpers_1.toBlendMode[blendMode])
        throw new Error("Invalid blend mode: '".concat(blendMode, "'"));
    layer.blendMode = helpers_1.toBlendMode[blendMode];
    layer.opacity = readUint8(reader) / 0xff;
    layer.clipping = readUint8(reader) === 1;
    var flags = readUint8(reader);
    layer.transparencyProtected = (flags & 0x01) !== 0;
    layer.hidden = (flags & 0x02) !== 0;
    // 0x04 - obsolete
    // 0x08 - 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
    // 0x10 - pixel data irrelevant to appearance of document
    skipBytes(reader, 1);
    readSection(reader, 1, function (left) {
        var mask = readLayerMaskData(reader, options);
        if (mask)
            layer.mask = mask;
        /*const blendingRanges =*/ readLayerBlendingRanges(reader);
        layer.name = readPascalString(reader, 4);
        while (left()) {
            readAdditionalLayerInfo(reader, layer, psd, options);
        }
    });
    return { layer: layer, channels: channels };
}
function readLayerMaskData(reader, options) {
    return readSection(reader, 1, function (left) {
        if (!left())
            return undefined;
        var mask = {};
        mask.top = readInt32(reader);
        mask.left = readInt32(reader);
        mask.bottom = readInt32(reader);
        mask.right = readInt32(reader);
        mask.defaultColor = readUint8(reader);
        var flags = readUint8(reader);
        mask.positionRelativeToLayer = (flags & 1 /* PositionRelativeToLayer */) !== 0;
        mask.disabled = (flags & 2 /* LayerMaskDisabled */) !== 0;
        mask.fromVectorData = (flags & 8 /* LayerMaskFromRenderingOtherData */) !== 0;
        if (flags & 16 /* MaskHasParametersAppliedToIt */) {
            var params = readUint8(reader);
            if (params & 1 /* UserMaskDensity */)
                mask.userMaskDensity = readUint8(reader) / 0xff;
            if (params & 2 /* UserMaskFeather */)
                mask.userMaskFeather = readFloat64(reader);
            if (params & 4 /* VectorMaskDensity */)
                mask.vectorMaskDensity = readUint8(reader) / 0xff;
            if (params & 8 /* VectorMaskFeather */)
                mask.vectorMaskFeather = readFloat64(reader);
        }
        if (left() > 2) {
            options.logMissingFeatures && console.log('Unhandled extra mask params');
            // TODO: handle these values
            /*const realFlags =*/ readUint8(reader);
            /*const realUserMaskBackground =*/ readUint8(reader);
            /*const top2 =*/ readInt32(reader);
            /*const left2 =*/ readInt32(reader);
            /*const bottom2 =*/ readInt32(reader);
            /*const right2 =*/ readInt32(reader);
        }
        skipBytes(reader, left());
        return mask;
    });
}
function readLayerBlendingRanges(reader) {
    return readSection(reader, 1, function (left) {
        var compositeGrayBlendSource = readUint32(reader);
        var compositeGraphBlendDestinationRange = readUint32(reader);
        var ranges = [];
        while (left()) {
            var sourceRange = readUint32(reader);
            var destRange = readUint32(reader);
            ranges.push({ sourceRange: sourceRange, destRange: destRange });
        }
        return { compositeGrayBlendSource: compositeGrayBlendSource, compositeGraphBlendDestinationRange: compositeGraphBlendDestinationRange, ranges: ranges };
    });
}
function readLayerChannelImageData(reader, psd, layer, channels, options) {
    var layerWidth = (layer.right || 0) - (layer.left || 0);
    var layerHeight = (layer.bottom || 0) - (layer.top || 0);
    var cmyk = psd.colorMode === 4 /* CMYK */;
    var imageData;
    if (layerWidth && layerHeight) {
        if (cmyk) {
            imageData = { width: layerWidth, height: layerHeight, data: new Uint8ClampedArray(layerWidth * layerHeight * 5) };
            for (var p = 4; p < imageData.data.byteLength; p += 5)
                imageData.data[p] = 255;
        }
        else {
            imageData = (0, helpers_1.createImageData)(layerWidth, layerHeight);
            (0, helpers_1.resetImageData)(imageData);
        }
    }
    if (helpers_1.RAW_IMAGE_DATA)
        layer.imageDataRaw = [];
    for (var _i = 0, channels_1 = channels; _i < channels_1.length; _i++) {
        var channel = channels_1[_i];
        var compression = readUint16(reader);
        if (channel.id === -2 /* UserMask */) {
            var mask = layer.mask;
            if (!mask)
                throw new Error("Missing layer mask data");
            var maskWidth = (mask.right || 0) - (mask.left || 0);
            var maskHeight = (mask.bottom || 0) - (mask.top || 0);
            if (maskWidth && maskHeight) {
                var maskData = (0, helpers_1.createImageData)(maskWidth, maskHeight);
                (0, helpers_1.resetImageData)(maskData);
                var start = reader.offset;
                readData(reader, maskData, compression, maskWidth, maskHeight, 0, options.large, 4);
                if (helpers_1.RAW_IMAGE_DATA) {
                    layer.maskDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
                }
                setupGrayscale(maskData);
                if (options.useImageData) {
                    mask.imageData = maskData;
                }
                else {
                    mask.canvas = (0, helpers_1.createCanvas)(maskWidth, maskHeight);
                    mask.canvas.getContext('2d').putImageData(maskData, 0, 0);
                }
            }
        }
        else {
            var offset = (0, helpers_1.offsetForChannel)(channel.id, cmyk);
            var targetData = imageData;
            if (offset < 0) {
                targetData = undefined;
                if (options.throwForMissingFeatures) {
                    throw new Error("Channel not supported: ".concat(channel.id));
                }
            }
            var start = reader.offset;
            readData(reader, targetData, compression, layerWidth, layerHeight, offset, options.large, cmyk ? 5 : 4);
            if (helpers_1.RAW_IMAGE_DATA) {
                layer.imageDataRaw[channel.id] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
            if (targetData && psd.colorMode === 1 /* Grayscale */) {
                setupGrayscale(targetData);
            }
        }
    }
    if (imageData) {
        if (cmyk) {
            var cmykData = imageData;
            imageData = (0, helpers_1.createImageData)(cmykData.width, cmykData.height);
            cmykToRgb(cmykData, imageData, false);
        }
        if (options.useImageData) {
            layer.imageData = imageData;
        }
        else {
            layer.canvas = (0, helpers_1.createCanvas)(layerWidth, layerHeight);
            layer.canvas.getContext('2d').putImageData(imageData, 0, 0);
        }
    }
}
function readData(reader, data, compression, width, height, offset, large, step) {
    if (compression === 0 /* RawData */) {
        readDataRaw(reader, data, offset, width, height, step);
    }
    else if (compression === 1 /* RleCompressed */) {
        readDataRLE(reader, data, width, height, step, [offset], large);
    }
    else {
        throw new Error("Compression type not supported: ".concat(compression));
    }
}
function readGlobalLayerMaskInfo(reader) {
    return readSection(reader, 1, function (left) {
        if (!left())
            return undefined;
        var overlayColorSpace = readUint16(reader);
        var colorSpace1 = readUint16(reader);
        var colorSpace2 = readUint16(reader);
        var colorSpace3 = readUint16(reader);
        var colorSpace4 = readUint16(reader);
        var opacity = readUint16(reader) / 0xff;
        var kind = readUint8(reader);
        skipBytes(reader, left()); // 3 bytes of padding ?
        return { overlayColorSpace: overlayColorSpace, colorSpace1: colorSpace1, colorSpace2: colorSpace2, colorSpace3: colorSpace3, colorSpace4: colorSpace4, opacity: opacity, kind: kind };
    });
}
function readAdditionalLayerInfo(reader, target, psd, options) {
    var sig = readSignature(reader);
    if (sig !== '8BIM' && sig !== '8B64')
        throw new Error("Invalid signature: '".concat(sig, "' at 0x").concat((reader.offset - 4).toString(16)));
    var key = readSignature(reader);
    // `largeAdditionalInfoKeys` fallback, because some keys don't have 8B64 signature even when they are 64bit
    var u64 = sig === '8B64' || (options.large && helpers_1.largeAdditionalInfoKeys.indexOf(key) !== -1);
    readSection(reader, 2, function (left) {
        var handler = additionalInfo_1.infoHandlersMap[key];
        if (handler) {
            try {
                handler.read(reader, target, left, psd, options);
            }
            catch (e) {
                if (options.throwForMissingFeatures)
                    throw e;
            }
        }
        else {
            options.logMissingFeatures && console.log("Unhandled additional info: ".concat(key));
            skipBytes(reader, left());
        }
        if (left()) {
            options.logMissingFeatures && console.log("Unread ".concat(left(), " bytes left for additional info: ").concat(key));
            skipBytes(reader, left());
        }
    }, false, u64);
}
function readImageData(reader, psd, globalAlpha, options) {
    var compression = readUint16(reader);
    if (exports.supportedColorModes.indexOf(psd.colorMode) === -1)
        throw new Error("Color mode not supported: ".concat(psd.colorMode));
    if (compression !== 0 /* RawData */ && compression !== 1 /* RleCompressed */)
        throw new Error("Compression type not supported: ".concat(compression));
    var imageData = (0, helpers_1.createImageData)(psd.width, psd.height);
    (0, helpers_1.resetImageData)(imageData);
    switch (psd.colorMode) {
        case 0 /* Bitmap */: {
            var bytes = void 0;
            if (compression === 0 /* RawData */) {
                bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
            }
            else if (compression === 1 /* RleCompressed */) {
                bytes = new Uint8Array(psd.width * psd.height);
                readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 1, [0], options.large);
            }
            else {
                throw new Error("Bitmap compression not supported: ".concat(compression));
            }
            (0, helpers_1.decodeBitmap)(bytes, imageData.data, psd.width, psd.height);
            break;
        }
        case 3 /* RGB */:
        case 1 /* Grayscale */: {
            var channels = psd.colorMode === 1 /* Grayscale */ ? [0] : [0, 1, 2];
            if (psd.channels && psd.channels > 3) {
                for (var i = 3; i < psd.channels; i++) {
                    // TODO: store these channels in additional image data
                    channels.push(i);
                }
            }
            else if (globalAlpha) {
                channels.push(3);
            }
            if (compression === 0 /* RawData */) {
                for (var i = 0; i < channels.length; i++) {
                    readDataRaw(reader, imageData, channels[i], psd.width, psd.height, 4);
                }
            }
            else if (compression === 1 /* RleCompressed */) {
                var start = reader.offset;
                readDataRLE(reader, imageData, psd.width, psd.height, 4, channels, options.large);
                if (helpers_1.RAW_IMAGE_DATA)
                    psd.imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
            if (psd.colorMode === 1 /* Grayscale */) {
                setupGrayscale(imageData);
            }
            break;
        }
        case 4 /* CMYK */: {
            if (psd.channels !== 4)
                throw new Error("Invalid channel count");
            var channels = [0, 1, 2, 3];
            if (globalAlpha)
                channels.push(4);
            if (compression === 0 /* RawData */) {
                throw new Error("Not implemented");
                // TODO: ...
                // for (let i = 0; i < channels.length; i++) {
                // 	readDataRaw(reader, imageData, channels[i], psd.width, psd.height);
                // }
            }
            else if (compression === 1 /* RleCompressed */) {
                var cmykImageData = {
                    width: imageData.width,
                    height: imageData.height,
                    data: new Uint8Array(imageData.width * imageData.height * 5),
                };
                var start = reader.offset;
                readDataRLE(reader, cmykImageData, psd.width, psd.height, 5, channels, options.large);
                cmykToRgb(cmykImageData, imageData, true);
                if (helpers_1.RAW_IMAGE_DATA)
                    psd.imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
            break;
        }
        default: throw new Error("Color mode not supported: ".concat(psd.colorMode));
    }
    if (options.useImageData) {
        psd.imageData = imageData;
    }
    else {
        psd.canvas = (0, helpers_1.createCanvas)(psd.width, psd.height);
        psd.canvas.getContext('2d').putImageData(imageData, 0, 0);
    }
}
function cmykToRgb(cmyk, rgb, reverseAlpha) {
    var size = rgb.width * rgb.height * 4;
    var srcData = cmyk.data;
    var dstData = rgb.data;
    for (var src = 0, dst = 0; dst < size; src += 5, dst += 4) {
        var c = srcData[src];
        var m = srcData[src + 1];
        var y = srcData[src + 2];
        var k = srcData[src + 3];
        dstData[dst] = ((((c * k) | 0) / 255) | 0);
        dstData[dst + 1] = ((((m * k) | 0) / 255) | 0);
        dstData[dst + 2] = ((((y * k) | 0) / 255) | 0);
        dstData[dst + 3] = reverseAlpha ? 255 - srcData[src + 4] : srcData[src + 4];
    }
    // for (let src = 0, dst = 0; dst < size; src += 5, dst += 4) {
    // 	const c = 1 - (srcData[src + 0] / 255);
    // 	const m = 1 - (srcData[src + 1] / 255);
    // 	const y = 1 - (srcData[src + 2] / 255);
    // 	// const k = srcData[src + 3] / 255;
    // 	dstData[dst + 0] = ((1 - c * 0.8) * 255) | 0;
    // 	dstData[dst + 1] = ((1 - m * 0.8) * 255) | 0;
    // 	dstData[dst + 2] = ((1 - y * 0.8) * 255) | 0;
    // 	dstData[dst + 3] = reverseAlpha ? 255 - srcData[src + 4] : srcData[src + 4];
    // }
}
function readDataRaw(reader, pixelData, offset, width, height, step) {
    var size = width * height;
    var buffer = readBytes(reader, size);
    if (pixelData && offset < step) {
        var data = pixelData.data;
        for (var i = 0, p = offset | 0; i < size; i++, p = (p + step) | 0) {
            data[p] = buffer[i];
        }
    }
}
function readDataRLE(reader, pixelData, _width, height, step, offsets, large) {
    var data = pixelData && pixelData.data;
    var lengths;
    if (large) {
        lengths = new Uint32Array(offsets.length * height);
        for (var o = 0, li = 0; o < offsets.length; o++) {
            for (var y = 0; y < height; y++, li++) {
                lengths[li] = readUint32(reader);
            }
        }
    }
    else {
        lengths = new Uint16Array(offsets.length * height);
        for (var o = 0, li = 0; o < offsets.length; o++) {
            for (var y = 0; y < height; y++, li++) {
                lengths[li] = readUint16(reader);
            }
        }
    }
    var extraLimit = (step - 1) | 0; // 3 for rgb, 4 for cmyk
    for (var c = 0, li = 0; c < offsets.length; c++) {
        var offset = offsets[c] | 0;
        var extra = c > extraLimit || offset > extraLimit;
        if (!data || extra) {
            for (var y = 0; y < height; y++, li++) {
                skipBytes(reader, lengths[li]);
            }
        }
        else {
            for (var y = 0, p = offset | 0; y < height; y++, li++) {
                var length_1 = lengths[li];
                var buffer = readBytes(reader, length_1);
                for (var i = 0; i < length_1; i++) {
                    var header = buffer[i];
                    if (header > 128) {
                        var value = buffer[++i];
                        header = (256 - header) | 0;
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = value;
                            p = (p + step) | 0;
                        }
                    }
                    else if (header < 128) {
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = buffer[++i];
                            p = (p + step) | 0;
                        }
                    }
                    else {
                        // ignore 128
                    }
                    if (i >= length_1) {
                        throw new Error("Invalid RLE data: exceeded buffer size ".concat(i, "/").concat(length_1));
                    }
                }
            }
        }
    }
}
exports.readDataRLE = readDataRLE;
function readSection(reader, round, func, skipEmpty, eightBytes) {
    if (skipEmpty === void 0) { skipEmpty = true; }
    if (eightBytes === void 0) { eightBytes = false; }
    var length = readUint32(reader);
    if (eightBytes) {
        if (length !== 0)
            throw new Error('Sizes larger than 4GB are not supported');
        length = readUint32(reader);
    }
    if (length <= 0 && skipEmpty)
        return undefined;
    var end = reader.offset + length;
    var result = func(function () { return end - reader.offset; });
    if (reader.offset > end)
        throw new Error('Exceeded section limits');
    if (reader.offset !== end)
        throw new Error("Unread section data: ".concat(end - reader.offset, " bytes at 0x").concat(reader.offset.toString(16)));
    while (end % round)
        end++;
    reader.offset = end;
    return result;
}
exports.readSection = readSection;
function readColor(reader) {
    var colorSpace = readUint16(reader);
    switch (colorSpace) {
        case 0 /* RGB */: {
            var r = readUint16(reader) / 257;
            var g = readUint16(reader) / 257;
            var b = readUint16(reader) / 257;
            skipBytes(reader, 2);
            return { r: r, g: g, b: b };
        }
        case 1 /* HSB */: {
            var h = readUint16(reader) / 0xffff;
            var s = readUint16(reader) / 0xffff;
            var b = readUint16(reader) / 0xffff;
            skipBytes(reader, 2);
            return { h: h, s: s, b: b };
        }
        case 2 /* CMYK */: {
            var c = readUint16(reader) / 257;
            var m = readUint16(reader) / 257;
            var y = readUint16(reader) / 257;
            var k = readUint16(reader) / 257;
            return { c: c, m: m, y: y, k: k };
        }
        case 7 /* Lab */: {
            var l = readInt16(reader) / 10000;
            var ta = readInt16(reader);
            var tb = readInt16(reader);
            var a = ta < 0 ? (ta / 12800) : (ta / 12700);
            var b = tb < 0 ? (tb / 12800) : (tb / 12700);
            skipBytes(reader, 2);
            return { l: l, a: a, b: b };
        }
        case 8 /* Grayscale */: {
            var k = readUint16(reader) * 255 / 10000;
            skipBytes(reader, 6);
            return { k: k };
        }
        default:
            throw new Error('Invalid color space');
    }
}
exports.readColor = readColor;
function readPattern(reader) {
    readUint32(reader); // length
    var version = readUint32(reader);
    if (version !== 1)
        throw new Error("Invalid pattern version: ".concat(version));
    var colorMode = readUint32(reader);
    var x = readInt16(reader);
    var y = readInt16(reader);
    // we only support RGB and grayscale for now
    if (colorMode !== 3 /* RGB */ && colorMode !== 1 /* Grayscale */ && colorMode !== 2 /* Indexed */) {
        throw new Error("Unsupported pattern color mode: ".concat(colorMode));
    }
    var name = readUnicodeString(reader);
    var id = readPascalString(reader, 1);
    var palette = [];
    if (colorMode === 2 /* Indexed */) {
        for (var i = 0; i < 256; i++) {
            palette.push({
                r: readUint8(reader),
                g: readUint8(reader),
                b: readUint8(reader),
            });
        }
        skipBytes(reader, 4); // no idea what this is
    }
    // virtual memory array list
    var version2 = readUint32(reader);
    if (version2 !== 3)
        throw new Error("Invalid pattern VMAL version: ".concat(version2));
    readUint32(reader); // length
    var top = readUint32(reader);
    var left = readUint32(reader);
    var bottom = readUint32(reader);
    var right = readUint32(reader);
    var channelsCount = readUint32(reader);
    var width = right - left;
    var height = bottom - top;
    var data = new Uint8Array(width * height * 4);
    for (var i = 3; i < data.byteLength; i += 4) {
        data[i] = 255;
    }
    for (var i = 0, ch = 0; i < (channelsCount + 2); i++) {
        var has = readUint32(reader);
        if (!has)
            continue;
        var length_2 = readUint32(reader);
        var pixelDepth = readUint32(reader);
        var ctop = readUint32(reader);
        var cleft = readUint32(reader);
        var cbottom = readUint32(reader);
        var cright = readUint32(reader);
        var pixelDepth2 = readUint16(reader);
        var compressionMode = readUint8(reader); // 0 - raw, 1 - zip
        var dataLength = length_2 - (4 + 16 + 2 + 1);
        var cdata = readBytes(reader, dataLength);
        if (pixelDepth !== 8 || pixelDepth2 !== 8) {
            throw new Error('16bit pixel depth not supported for patterns');
        }
        var w = cright - cleft;
        var h = cbottom - ctop;
        var ox = cleft - left;
        var oy = ctop - top;
        if (compressionMode === 0) {
            if (colorMode === 3 /* RGB */ && ch < 3) {
                for (var y_1 = 0; y_1 < h; y_1++) {
                    for (var x_1 = 0; x_1 < w; x_1++) {
                        var src = x_1 + y_1 * w;
                        var dst = (ox + x_1 + (y_1 + oy) * width) * 4;
                        data[dst + ch] = cdata[src];
                    }
                }
            }
            if (colorMode === 1 /* Grayscale */ && ch < 1) {
                for (var y_2 = 0; y_2 < h; y_2++) {
                    for (var x_2 = 0; x_2 < w; x_2++) {
                        var src = x_2 + y_2 * w;
                        var dst = (ox + x_2 + (y_2 + oy) * width) * 4;
                        var value = cdata[src];
                        data[dst + 0] = value;
                        data[dst + 1] = value;
                        data[dst + 2] = value;
                    }
                }
            }
            if (colorMode === 2 /* Indexed */) {
                // TODO:
                throw new Error('Indexed pattern color mode not implemented');
            }
        }
        else if (compressionMode === 1) {
            // console.log({ colorMode });
            // require('fs').writeFileSync('zip.bin', Buffer.from(cdata));
            // const data = require('zlib').inflateRawSync(cdata);
            // const data = require('zlib').unzipSync(cdata);
            // console.log(data);
            // throw new Error('Zip compression not supported for pattern');
            // throw new Error('Unsupported pattern compression');
            console.error('Unsupported pattern compression');
            name += ' (failed to decode)';
        }
        else {
            throw new Error('Invalid pattern compression mode');
        }
        ch++;
    }
    // TODO: use canvas instead of data ?
    return { id: id, name: name, x: x, y: y, bounds: { x: left, y: top, w: width, h: height }, data: data };
}
exports.readPattern = readPattern;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFJlYWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUlBLHFDQUdtQjtBQUNuQixtREFBbUQ7QUFDbkQsbURBQXVEO0FBVzFDLFFBQUEsbUJBQW1CLEdBQUcsZ0RBQXNELENBQUM7QUFDMUYsSUFBTSxVQUFVLEdBQUcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFFdkcsU0FBUyxjQUFjLENBQUMsSUFBZTtJQUN0QyxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBRTFDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDaEM7QUFDRixDQUFDO0FBT0QsU0FBZ0IsWUFBWSxDQUFDLE1BQW1CLEVBQUUsTUFBZSxFQUFFLE1BQWU7SUFDakYsSUFBTSxJQUFJLEdBQUcsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNsRCxPQUFPLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO0FBQzVCLENBQUM7QUFIRCxvQ0FHQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxNQUFpQjtJQUMxQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEQsQ0FBQztBQUhELDhCQUdDO0FBRUQsU0FBZ0IsU0FBUyxDQUFDLE1BQWlCO0lBQzFDLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFGRCw4QkFFQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxNQUFpQjtJQUMxQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFIRCw4QkFHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQjtJQUMzQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxNQUFpQjtJQUMxQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3ZELENBQUM7QUFIRCw4QkFHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQjtJQUM1QyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQjtJQUMzQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQjtJQUM1QyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQjtJQUM1QyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztJQUNuQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFIRCxrQ0FHQztBQUVELGtDQUFrQztBQUNsQyxTQUFnQixnQkFBZ0IsQ0FBQyxNQUFpQjtJQUNqRCxPQUFPLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUN0QyxDQUFDO0FBRkQsNENBRUM7QUFFRCxpQ0FBaUM7QUFDakMsU0FBZ0Isb0JBQW9CLENBQUMsTUFBaUI7SUFDckQsT0FBTyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUZELG9EQUVDO0FBRUQsU0FBZ0IsU0FBUyxDQUFDLE1BQWlCLEVBQUUsTUFBYztJQUMxRCxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQztJQUN4QixPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BHLENBQUM7QUFIRCw4QkFHQztBQUVELFNBQWdCLGFBQWEsQ0FBQyxNQUFpQjtJQUM5QyxPQUFPLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDbkMsQ0FBQztBQUZELHNDQUVDO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBaUIsRUFBRSxLQUFhO0lBQ2hFLElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvQixJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUUzRCxPQUFPLEVBQUUsTUFBTSxHQUFHLEtBQUssRUFBRTtRQUN4QixNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7S0FDaEI7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFURCw0Q0FTQztBQUVELFNBQWdCLGlCQUFpQixDQUFDLE1BQWlCO0lBQ2xELElBQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxPQUFPLDJCQUEyQixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBSEQsOENBR0M7QUFFRCxTQUFnQiwyQkFBMkIsQ0FBQyxNQUFpQixFQUFFLE1BQWM7SUFDNUUsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRWQsT0FBTyxNQUFNLEVBQUUsRUFBRTtRQUNoQixJQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakMsSUFBSSxLQUFLLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRSxFQUFFLHFCQUFxQjtZQUMvQyxJQUFJLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNuQztLQUNEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBWkQsa0VBWUM7QUFFRCxTQUFnQixlQUFlLENBQUMsTUFBaUIsRUFBRSxNQUFjO0lBQ2hFLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUVkLE9BQU8sTUFBTSxFQUFFLEVBQUU7UUFDaEIsSUFBSSxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7S0FDL0M7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFSRCwwQ0FRQztBQUVELFNBQWdCLFNBQVMsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDekQsTUFBTSxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUM7QUFDeEIsQ0FBQztBQUZELDhCQUVDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLE1BQWlCLEVBQUUsQ0FBUyxFQUFFLENBQVU7SUFDdEUsSUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM3QixJQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFeEMsSUFBSSxTQUFTLEtBQUssQ0FBQyxJQUFJLFNBQVMsS0FBSyxDQUFDLEVBQUU7UUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBdUIsU0FBUyxvQkFBVSxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBQztLQUNqRjtBQUNGLENBQUM7QUFQRCx3Q0FPQztBQUVELFNBQVMsZUFBZSxDQUFDLE1BQWlCLEVBQUUsTUFBYztJQUN6RCxJQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUVoQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN2QyxNQUFNLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6QztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQWdCLE9BQU8sQ0FBQyxNQUFpQixFQUFFLE9BQXlCOztJQUF6Qix3QkFBQSxFQUFBLFlBQXlCO0lBQ25FLFNBQVM7SUFDVCxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQyxJQUFJLE9BQU8sS0FBSyxDQUFDLElBQUksT0FBTyxLQUFLLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUE2QixPQUFPLENBQUUsQ0FBQyxDQUFDO0lBRTVGLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckIsSUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BDLElBQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxJQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDakMsSUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFDLElBQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVyQyxJQUFJLDJCQUFtQixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBNkIsTUFBQSxVQUFVLENBQUMsU0FBUyxDQUFDLG1DQUFJLFNBQVMsQ0FBRSxDQUFDLENBQUM7SUFFcEYsSUFBTSxHQUFHLEdBQVEsRUFBRSxLQUFLLE9BQUEsRUFBRSxNQUFNLFFBQUEsRUFBRSxRQUFRLFVBQUEsRUFBRSxjQUFjLGdCQUFBLEVBQUUsU0FBUyxXQUFBLEVBQUUsQ0FBQztJQUN4RSxJQUFNLEdBQUcseUJBQXdCLE9BQU8sS0FBRSxLQUFLLEVBQUUsT0FBTyxLQUFLLENBQUMsR0FBRSxDQUFDO0lBRWpFLGtCQUFrQjtJQUNsQixXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxVQUFBLElBQUk7UUFDMUIsSUFBSSxHQUFHLENBQUMsdUJBQXVCO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQ2xGLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMzQixDQUFDLENBQUMsQ0FBQztJQUVILGtCQUFrQjtJQUNsQixXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxVQUFBLElBQUk7O1lBRXpCLElBQU0sR0FBRyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVsQyxJQUFJLEdBQUcsS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLEtBQUssTUFBTSxJQUFJLEdBQUcsS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtnQkFDM0YsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBdUIsR0FBRyxvQkFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBQzthQUN4RjtZQUVELElBQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM5QixnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO1lBRXBDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLFVBQUEsSUFBSTtnQkFDMUIsSUFBTSxPQUFPLEdBQUcsb0NBQW1CLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3hDLElBQU0sSUFBSSxHQUFHLEVBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUM7Z0JBRWhELElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFO29CQUN4QixHQUFHLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztpQkFDeEI7Z0JBRUQsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUU7b0JBQ3JCLElBQUk7d0JBQ0gsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7cUJBQ3BEO29CQUFDLE9BQU8sQ0FBQyxFQUFFO3dCQUNYLElBQUksR0FBRyxDQUFDLHVCQUF1Qjs0QkFBRSxNQUFNLENBQUMsQ0FBQzt3QkFDekMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO3FCQUMxQjtpQkFDRDtxQkFBTTtvQkFDTixnRkFBZ0Y7b0JBQ2hGLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztpQkFDMUI7WUFDRixDQUFDLENBQUMsQ0FBQzs7UUE3QkosT0FBTyxJQUFJLEVBQUU7O1NBOEJaO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxzQkFBc0I7SUFDdEIsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBRXhCLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLFVBQUEsSUFBSTtRQUMxQixXQUFXLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFOUMsb0NBQW9DO1FBQ3BDLElBQUksSUFBSSxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ2YsSUFBTSxtQkFBbUIsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RCxJQUFJLG1CQUFtQjtnQkFBRSxHQUFHLENBQUMsbUJBQW1CLEdBQUcsbUJBQW1CLENBQUM7U0FDdkU7YUFBTTtZQUNOLDJEQUEyRDtZQUMzRCx3RUFBd0U7WUFDeEUsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzFCO1FBRUQsT0FBTyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUU7WUFDbEIsdUNBQXVDO1lBQ3ZDLE9BQU8sSUFBSSxFQUFFLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDekMsNERBQTREO2dCQUM1RCxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ3JCO1lBRUQsSUFBSSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUU7Z0JBQ2pCLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQy9DO2lCQUFNO2dCQUNOLDRFQUE0RTtnQkFDNUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO2FBQzFCO1NBQ0Q7SUFDRixDQUFDLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUV6QixJQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO0lBQ3hELElBQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXLENBQUMsQ0FBQztJQUU1RixJQUFJLENBQUMsYUFBYSxFQUFFO1FBQ25CLGFBQWEsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztLQUM3QztJQUVELDBFQUEwRTtJQUMxRSw4R0FBOEc7SUFDOUcsc0VBQXNFO0lBRXRFLE9BQU8sR0FBRyxDQUFDO0FBQ1osQ0FBQztBQXhHRCwwQkF3R0M7QUFFRCxTQUFTLGFBQWEsQ0FBQyxNQUFpQixFQUFFLEdBQVEsRUFBRSxPQUF1QjtJQUMxRSxJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUM7SUFFeEIsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO1FBQzFCLElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVuQyxJQUFJLFVBQVUsR0FBRyxDQUFDLEVBQUU7WUFDbkIsV0FBVyxHQUFHLElBQUksQ0FBQztZQUNuQixVQUFVLEdBQUcsQ0FBQyxVQUFVLENBQUM7U0FDekI7UUFFRCxJQUFNLE1BQU0sR0FBWSxFQUFFLENBQUM7UUFDM0IsSUFBTSxhQUFhLEdBQW9CLEVBQUUsQ0FBQztRQUUxQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzlCLElBQUEsS0FBc0IsZUFBZSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLEVBQXpELEtBQUssV0FBQSxFQUFFLFFBQVEsY0FBMEMsQ0FBQztZQUNsRSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25CLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDN0I7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFO1lBQ2hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ3BDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQzthQUM3RTtTQUNEO1FBRUQsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRTFCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUTtZQUFFLEdBQUcsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBRXJDLElBQU0sS0FBSyxHQUFvQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJDLEtBQUssSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM1QyxJQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEIsSUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUF5QixDQUFDO1lBQ2pGLElBQUksSUFBSSx1QkFBa0MsSUFBSSxJQUFJLHlCQUFvQyxFQUFFO2dCQUN2RixDQUFDLENBQUMsTUFBTSxHQUFHLElBQUksdUJBQWtDLENBQUM7Z0JBQ2xELENBQUMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO2dCQUNoQixJQUFNLFFBQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxRQUFNLElBQUksUUFBTSxDQUFDLElBQUksRUFBRTtvQkFDMUIsQ0FBQyxDQUFDLFVBQVUsR0FBRyxRQUFNLENBQUMsSUFBSSxDQUFDO2lCQUMzQjtnQkFDRCxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM3QyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2Q7aUJBQU0sSUFBSSxJQUFJLG1DQUE4QyxFQUFFO2dCQUM5RCxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ1osMEdBQTBHO2dCQUMxRywrR0FBK0c7Z0JBQy9HLHFHQUFxRztnQkFDckcsZ0JBQWdCO2FBQ2hCO2lCQUFNO2dCQUNOLElBQU0sUUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLFFBQU0sSUFBSSxRQUFNLENBQUMsSUFBSSxFQUFFO29CQUMxQixDQUFDLENBQUMsVUFBVSxHQUFHLFFBQU0sQ0FBQyxJQUFJLENBQUM7aUJBQzNCO2dCQUNELEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDN0M7U0FDRDtJQUNGLENBQUMsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRTdCLE9BQU8sV0FBVyxDQUFDO0FBQ3BCLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxNQUFpQixFQUFFLEdBQVEsRUFBRSxPQUF1QjtJQUM1RSxJQUFNLEtBQUssR0FBVSxFQUFFLENBQUM7SUFDeEIsS0FBSyxDQUFDLEdBQUcsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUIsS0FBSyxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0IsS0FBSyxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDakMsS0FBSyxDQUFDLEtBQUssR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFaEMsSUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hDLElBQU0sUUFBUSxHQUFrQixFQUFFLENBQUM7SUFFbkMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN0QyxJQUFJLFNBQVMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFjLENBQUM7UUFDL0MsSUFBSSxhQUFhLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXZDLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRTtZQUNsQixJQUFJLGFBQWEsS0FBSyxDQUFDO2dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQztZQUNwRixhQUFhLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ25DO1FBRUQsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7S0FDeEQ7SUFFRCxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLElBQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4QyxJQUFJLENBQUMscUJBQVcsQ0FBQyxTQUFTLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUF3QixTQUFTLE1BQUcsQ0FBQyxDQUFDO0lBQ25GLEtBQUssQ0FBQyxTQUFTLEdBQUcscUJBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUV6QyxLQUFLLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDekMsS0FBSyxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXpDLElBQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxLQUFLLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25ELEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLGtCQUFrQjtJQUNsQiw4RUFBOEU7SUFDOUUseURBQXlEO0lBRXpELFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFckIsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO1FBQzFCLElBQU0sSUFBSSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNoRCxJQUFJLElBQUk7WUFBRSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUU1QiwwQkFBMEIsQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzRCxLQUFLLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV6QyxPQUFPLElBQUksRUFBRSxFQUFFO1lBQ2QsdUJBQXVCLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDckQ7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sRUFBRSxLQUFLLE9BQUEsRUFBRSxRQUFRLFVBQUEsRUFBRSxDQUFDO0FBQzVCLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE1BQWlCLEVBQUUsT0FBb0I7SUFDakUsT0FBTyxXQUFXLENBQTRCLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO1FBQzVELElBQUksQ0FBQyxJQUFJLEVBQUU7WUFBRSxPQUFPLFNBQVMsQ0FBQztRQUU5QixJQUFNLElBQUksR0FBa0IsRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXRDLElBQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxJQUFJLENBQUMsdUJBQXVCLEdBQUcsQ0FBQyxLQUFLLGtDQUF5QyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RGLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxLQUFLLDRCQUFtQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxLQUFLLDBDQUFpRCxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRXJGLElBQUksS0FBSyx3Q0FBOEMsRUFBRTtZQUN4RCxJQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakMsSUFBSSxNQUFNLDBCQUE2QjtnQkFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDekYsSUFBSSxNQUFNLDBCQUE2QjtnQkFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwRixJQUFJLE1BQU0sNEJBQStCO2dCQUFFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQzdGLElBQUksTUFBTSw0QkFBK0I7Z0JBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN4RjtRQUVELElBQUksSUFBSSxFQUFFLEdBQUcsQ0FBQyxFQUFFO1lBQ2YsT0FBTyxDQUFDLGtCQUFrQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUN6RSw0QkFBNEI7WUFDNUIscUJBQXFCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3hDLGtDQUFrQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyRCxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3BDLG1CQUFtQixDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0QyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDckM7UUFFRCxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDMUIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLE1BQWlCO0lBQ2pELE9BQU8sV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO1FBQ2pDLElBQU0sd0JBQXdCLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELElBQU0sbUNBQW1DLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQy9ELElBQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUVsQixPQUFPLElBQUksRUFBRSxFQUFFO1lBQ2QsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZDLElBQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNyQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxhQUFBLEVBQUUsU0FBUyxXQUFBLEVBQUUsQ0FBQyxDQUFDO1NBQ3hDO1FBRUQsT0FBTyxFQUFFLHdCQUF3QiwwQkFBQSxFQUFFLG1DQUFtQyxxQ0FBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUM7SUFDbEYsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyx5QkFBeUIsQ0FDakMsTUFBaUIsRUFBRSxHQUFRLEVBQUUsS0FBWSxFQUFFLFFBQXVCLEVBQUUsT0FBdUI7SUFFM0YsSUFBTSxVQUFVLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztJQUMxRCxJQUFNLFdBQVcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzNELElBQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxTQUFTLGlCQUFtQixDQUFDO0lBRTlDLElBQUksU0FBZ0MsQ0FBQztJQUVyQyxJQUFJLFVBQVUsSUFBSSxXQUFXLEVBQUU7UUFDOUIsSUFBSSxJQUFJLEVBQUU7WUFDVCxTQUFTLEdBQUcsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksaUJBQWlCLENBQUMsVUFBVSxHQUFHLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2xILEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLElBQUksQ0FBQztnQkFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztTQUMvRTthQUFNO1lBQ04sU0FBUyxHQUFHLElBQUEseUJBQWUsRUFBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDckQsSUFBQSx3QkFBYyxFQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzFCO0tBQ0Q7SUFFRCxJQUFJLHdCQUFjO1FBQUcsS0FBYSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUM7SUFFckQsS0FBc0IsVUFBUSxFQUFSLHFCQUFRLEVBQVIsc0JBQVEsRUFBUixJQUFRLEVBQUU7UUFBM0IsSUFBTSxPQUFPLGlCQUFBO1FBQ2pCLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQWdCLENBQUM7UUFFdEQsSUFBSSxPQUFPLENBQUMsRUFBRSxzQkFBdUIsRUFBRTtZQUN0QyxJQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBRXhCLElBQUksQ0FBQyxJQUFJO2dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztZQUV0RCxJQUFNLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3ZELElBQU0sVUFBVSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7WUFFeEQsSUFBSSxTQUFTLElBQUksVUFBVSxFQUFFO2dCQUM1QixJQUFNLFFBQVEsR0FBRyxJQUFBLHlCQUFlLEVBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO2dCQUN4RCxJQUFBLHdCQUFjLEVBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRXpCLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUVwRixJQUFJLHdCQUFjLEVBQUU7b0JBQ2xCLEtBQWEsQ0FBQyxXQUFXLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUM7aUJBQ3ZIO2dCQUVELGNBQWMsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFFekIsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO29CQUN6QixJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztpQkFDMUI7cUJBQU07b0JBQ04sSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFBLHNCQUFZLEVBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO29CQUNsRCxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztpQkFDM0Q7YUFDRDtTQUNEO2FBQU07WUFDTixJQUFNLE1BQU0sR0FBRyxJQUFBLDBCQUFnQixFQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDbEQsSUFBSSxVQUFVLEdBQUcsU0FBUyxDQUFDO1lBRTNCLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDZixVQUFVLEdBQUcsU0FBUyxDQUFDO2dCQUV2QixJQUFJLE9BQU8sQ0FBQyx1QkFBdUIsRUFBRTtvQkFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBMEIsT0FBTyxDQUFDLEVBQUUsQ0FBRSxDQUFDLENBQUM7aUJBQ3hEO2FBQ0Q7WUFFRCxJQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1lBQzVCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUV4RyxJQUFJLHdCQUFjLEVBQUU7Z0JBQ2xCLEtBQWEsQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDO2FBQ3BJO1lBRUQsSUFBSSxVQUFVLElBQUksR0FBRyxDQUFDLFNBQVMsc0JBQXdCLEVBQUU7Z0JBQ3hELGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQzthQUMzQjtTQUNEO0tBQ0Q7SUFFRCxJQUFJLFNBQVMsRUFBRTtRQUNkLElBQUksSUFBSSxFQUFFO1lBQ1QsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDO1lBQzNCLFNBQVMsR0FBRyxJQUFBLHlCQUFlLEVBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDN0QsU0FBUyxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDdEM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxZQUFZLEVBQUU7WUFDekIsS0FBSyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7U0FDNUI7YUFBTTtZQUNOLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBQSxzQkFBWSxFQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNyRCxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUM3RDtLQUNEO0FBQ0YsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUNoQixNQUFpQixFQUFFLElBQTJCLEVBQUUsV0FBd0IsRUFBRSxLQUFhLEVBQUUsTUFBYyxFQUN2RyxNQUFjLEVBQUUsS0FBYyxFQUFFLElBQVk7SUFFNUMsSUFBSSxXQUFXLG9CQUF3QixFQUFFO1FBQ3hDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ3ZEO1NBQU0sSUFBSSxXQUFXLDBCQUE4QixFQUFFO1FBQ3JELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDaEU7U0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQW1DLFdBQVcsQ0FBRSxDQUFDLENBQUM7S0FDbEU7QUFDRixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxNQUFpQjtJQUNqRCxPQUFPLFdBQVcsQ0FBa0MsTUFBTSxFQUFFLENBQUMsRUFBRSxVQUFBLElBQUk7UUFDbEUsSUFBSSxDQUFDLElBQUksRUFBRTtZQUFFLE9BQU8sU0FBUyxDQUFDO1FBRTlCLElBQU0saUJBQWlCLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzdDLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxJQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkMsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzFDLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvQixTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyx1QkFBdUI7UUFDbEQsT0FBTyxFQUFFLGlCQUFpQixtQkFBQSxFQUFFLFdBQVcsYUFBQSxFQUFFLFdBQVcsYUFBQSxFQUFFLFdBQVcsYUFBQSxFQUFFLFdBQVcsYUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLElBQUksTUFBQSxFQUFFLENBQUM7SUFDakcsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxNQUFpQixFQUFFLE1BQTJCLEVBQUUsR0FBUSxFQUFFLE9BQXVCO0lBQ2pILElBQU0sR0FBRyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxJQUFJLEdBQUcsS0FBSyxNQUFNLElBQUksR0FBRyxLQUFLLE1BQU07UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUF1QixHQUFHLG9CQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUUsQ0FBQyxDQUFDO0lBQzlILElBQU0sR0FBRyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVsQywyR0FBMkc7SUFDM0csSUFBTSxHQUFHLEdBQUcsR0FBRyxLQUFLLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksaUNBQXVCLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFN0YsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsVUFBQSxJQUFJO1FBQzFCLElBQU0sT0FBTyxHQUFHLGdDQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFckMsSUFBSSxPQUFPLEVBQUU7WUFDWixJQUFJO2dCQUNILE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ2pEO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1gsSUFBSSxPQUFPLENBQUMsdUJBQXVCO29CQUFFLE1BQU0sQ0FBQyxDQUFDO2FBQzdDO1NBQ0Q7YUFBTTtZQUNOLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLHFDQUE4QixHQUFHLENBQUUsQ0FBQyxDQUFDO1lBQy9FLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztTQUMxQjtRQUVELElBQUksSUFBSSxFQUFFLEVBQUU7WUFDWCxPQUFPLENBQUMsa0JBQWtCLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBVSxJQUFJLEVBQUUsOENBQW9DLEdBQUcsQ0FBRSxDQUFDLENBQUM7WUFDckcsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQzFCO0lBQ0YsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyxhQUFhLENBQUMsTUFBaUIsRUFBRSxHQUFRLEVBQUUsV0FBb0IsRUFBRSxPQUF1QjtJQUNoRyxJQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFnQixDQUFDO0lBRXRELElBQUksMkJBQW1CLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBNkIsR0FBRyxDQUFDLFNBQVMsQ0FBRSxDQUFDLENBQUM7SUFFL0QsSUFBSSxXQUFXLG9CQUF3QixJQUFJLFdBQVcsMEJBQThCO1FBQ25GLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQW1DLFdBQVcsQ0FBRSxDQUFDLENBQUM7SUFFbkUsSUFBTSxTQUFTLEdBQUcsSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3pELElBQUEsd0JBQWMsRUFBQyxTQUFTLENBQUMsQ0FBQztJQUUxQixRQUFRLEdBQUcsQ0FBQyxTQUFTLEVBQUU7UUFDdEIsbUJBQXFCLENBQUMsQ0FBQztZQUN0QixJQUFJLEtBQUssU0FBWSxDQUFDO1lBRXRCLElBQUksV0FBVyxvQkFBd0IsRUFBRTtnQkFDeEMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNqRTtpQkFBTSxJQUFJLFdBQVcsMEJBQThCLEVBQUU7Z0JBQ3JELEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDL0MsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3pIO2lCQUFNO2dCQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQXFDLFdBQVcsQ0FBRSxDQUFDLENBQUM7YUFDcEU7WUFFRCxJQUFBLHNCQUFZLEVBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDM0QsTUFBTTtTQUNOO1FBQ0QsaUJBQW1CO1FBQ25CLHNCQUF3QixDQUFDLENBQUM7WUFDekIsSUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLFNBQVMsc0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUV6RSxJQUFJLEdBQUcsQ0FBQyxRQUFRLElBQUksR0FBRyxDQUFDLFFBQVEsR0FBRyxDQUFDLEVBQUU7Z0JBQ3JDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUN0QyxzREFBc0Q7b0JBQ3RELFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ2pCO2FBQ0Q7aUJBQU0sSUFBSSxXQUFXLEVBQUU7Z0JBQ3ZCLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDakI7WUFFRCxJQUFJLFdBQVcsb0JBQXdCLEVBQUU7Z0JBQ3hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUN6QyxXQUFXLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUN0RTthQUNEO2lCQUFNLElBQUksV0FBVywwQkFBOEIsRUFBRTtnQkFDckQsSUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztnQkFDNUIsV0FBVyxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNsRixJQUFJLHdCQUFjO29CQUFHLEdBQVcsQ0FBQyxZQUFZLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUM7YUFDMUk7WUFFRCxJQUFJLEdBQUcsQ0FBQyxTQUFTLHNCQUF3QixFQUFFO2dCQUMxQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDMUI7WUFDRCxNQUFNO1NBQ047UUFDRCxpQkFBbUIsQ0FBQyxDQUFDO1lBQ3BCLElBQUksR0FBRyxDQUFDLFFBQVEsS0FBSyxDQUFDO2dCQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztZQUVqRSxJQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzlCLElBQUksV0FBVztnQkFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWxDLElBQUksV0FBVyxvQkFBd0IsRUFBRTtnQkFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUNuQyxZQUFZO2dCQUNaLDhDQUE4QztnQkFDOUMsdUVBQXVFO2dCQUN2RSxJQUFJO2FBQ0o7aUJBQU0sSUFBSSxXQUFXLDBCQUE4QixFQUFFO2dCQUNyRCxJQUFNLGFBQWEsR0FBYztvQkFDaEMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLO29CQUN0QixNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU07b0JBQ3hCLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2lCQUM1RCxDQUFDO2dCQUVGLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQzVCLFdBQVcsQ0FBQyxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEYsU0FBUyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBRTFDLElBQUksd0JBQWM7b0JBQUcsR0FBVyxDQUFDLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQzthQUMxSTtZQUVELE1BQU07U0FDTjtRQUNELE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsb0NBQTZCLEdBQUcsQ0FBQyxTQUFTLENBQUUsQ0FBQyxDQUFDO0tBQ3ZFO0lBRUQsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO1FBQ3pCLEdBQUcsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO0tBQzFCO1NBQU07UUFDTixHQUFHLENBQUMsTUFBTSxHQUFHLElBQUEsc0JBQVksRUFBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxHQUFHLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztLQUMzRDtBQUNGLENBQUM7QUFFRCxTQUFTLFNBQVMsQ0FBQyxJQUFlLEVBQUUsR0FBYyxFQUFFLFlBQXFCO0lBQ3hFLElBQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDeEMsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztJQUMxQixJQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO0lBRXpCLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUU7UUFDMUQsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLElBQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDM0IsSUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFNLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMzQyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQy9DLE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDL0MsT0FBTyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQzVFO0lBRUQsK0RBQStEO0lBQy9ELDJDQUEyQztJQUMzQywyQ0FBMkM7SUFDM0MsMkNBQTJDO0lBQzNDLHdDQUF3QztJQUN4QyxpREFBaUQ7SUFDakQsaURBQWlEO0lBQ2pELGlEQUFpRDtJQUNqRCxnRkFBZ0Y7SUFDaEYsSUFBSTtBQUNMLENBQUM7QUFFRCxTQUFTLFdBQVcsQ0FBQyxNQUFpQixFQUFFLFNBQWdDLEVBQUUsTUFBYyxFQUFFLEtBQWEsRUFBRSxNQUFjLEVBQUUsSUFBWTtJQUNwSSxJQUFNLElBQUksR0FBRyxLQUFLLEdBQUcsTUFBTSxDQUFDO0lBQzVCLElBQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFFdkMsSUFBSSxTQUFTLElBQUksTUFBTSxHQUFHLElBQUksRUFBRTtRQUMvQixJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBRTVCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNsRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3BCO0tBQ0Q7QUFDRixDQUFDO0FBRUQsU0FBZ0IsV0FBVyxDQUMxQixNQUFpQixFQUFFLFNBQWdDLEVBQUUsTUFBYyxFQUFFLE1BQWMsRUFBRSxJQUFZLEVBQUUsT0FBaUIsRUFDcEgsS0FBYztJQUVkLElBQU0sSUFBSSxHQUFHLFNBQVMsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDO0lBQ3pDLElBQUksT0FBa0MsQ0FBQztJQUV2QyxJQUFJLEtBQUssRUFBRTtRQUNWLE9BQU8sR0FBRyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBRW5ELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDaEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtnQkFDdEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNqQztTQUNEO0tBQ0Q7U0FBTTtRQUNOLE9BQU8sR0FBRyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBRW5ELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDaEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRTtnQkFDdEMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNqQztTQUNEO0tBQ0Q7SUFFRCxJQUFNLFVBQVUsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7SUFFM0QsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLElBQU0sS0FBSyxHQUFHLENBQUMsR0FBRyxVQUFVLElBQUksTUFBTSxHQUFHLFVBQVUsQ0FBQztRQUVwRCxJQUFJLENBQUMsSUFBSSxJQUFJLEtBQUssRUFBRTtZQUNuQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFO2dCQUN0QyxTQUFTLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQy9CO1NBQ0Q7YUFBTTtZQUNOLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7Z0JBQ3RELElBQU0sUUFBTSxHQUFHLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDM0IsSUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFNLENBQUMsQ0FBQztnQkFFekMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDaEMsSUFBSSxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUV2QixJQUFJLE1BQU0sR0FBRyxHQUFHLEVBQUU7d0JBQ2pCLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUMxQixNQUFNLEdBQUcsQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUU1QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7NEJBQzdDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7NEJBQ2hCLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7eUJBQ25CO3FCQUNEO3lCQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsRUFBRTt3QkFDeEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFOzRCQUM3QyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7NEJBQ3RCLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7eUJBQ25CO3FCQUNEO3lCQUFNO3dCQUNOLGFBQWE7cUJBQ2I7b0JBRUQsSUFBSSxDQUFDLElBQUksUUFBTSxFQUFFO3dCQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGlEQUEwQyxDQUFDLGNBQUksUUFBTSxDQUFFLENBQUMsQ0FBQztxQkFDekU7aUJBQ0Q7YUFDRDtTQUNEO0tBQ0Q7QUFDRixDQUFDO0FBbkVELGtDQW1FQztBQUVELFNBQWdCLFdBQVcsQ0FDMUIsTUFBaUIsRUFBRSxLQUFhLEVBQUUsSUFBK0IsRUFBRSxTQUFnQixFQUFFLFVBQWtCO0lBQXBDLDBCQUFBLEVBQUEsZ0JBQWdCO0lBQUUsMkJBQUEsRUFBQSxrQkFBa0I7SUFFdkcsSUFBSSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWhDLElBQUksVUFBVSxFQUFFO1FBQ2YsSUFBSSxNQUFNLEtBQUssQ0FBQztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUM3RSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0tBQzVCO0lBRUQsSUFBSSxNQUFNLElBQUksQ0FBQyxJQUFJLFNBQVM7UUFBRSxPQUFPLFNBQVMsQ0FBQztJQUUvQyxJQUFJLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztJQUNqQyxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBTSxPQUFBLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFuQixDQUFtQixDQUFDLENBQUM7SUFFL0MsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUc7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBRTVDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxHQUFHO1FBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMsK0JBQXdCLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSx5QkFBZSxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBRSxDQUFDLENBQUM7SUFFekcsT0FBTyxHQUFHLEdBQUcsS0FBSztRQUFFLEdBQUcsRUFBRSxDQUFDO0lBRTFCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQ3BCLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQXpCRCxrQ0F5QkM7QUFFRCxTQUFnQixTQUFTLENBQUMsTUFBaUI7SUFDMUMsSUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBZSxDQUFDO0lBRXBELFFBQVEsVUFBVSxFQUFFO1FBQ25CLGdCQUFtQixDQUFDLENBQUM7WUFDcEIsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQixPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUNuQjtRQUNELGdCQUFtQixDQUFDLENBQUM7WUFDcEIsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUN0QyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ3RDLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDdEMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQixPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUNuQjtRQUNELGlCQUFvQixDQUFDLENBQUM7WUFDckIsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUN0QjtRQUNELGdCQUFtQixDQUFDLENBQUM7WUFDcEIsSUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUNwQyxJQUFNLEVBQUUsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDN0IsSUFBTSxFQUFFLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzdCLElBQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQztZQUMvQyxJQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUM7WUFDL0MsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQixPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUNuQjtRQUNELHNCQUF5QixDQUFDLENBQUM7WUFDMUIsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUM7WUFDM0MsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQixPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUNiO1FBQ0Q7WUFDQyxNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7S0FDeEM7QUFDRixDQUFDO0FBMUNELDhCQTBDQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQjtJQUM1QyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTO0lBQzdCLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQyxJQUFJLE9BQU8sS0FBSyxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQ0FBNEIsT0FBTyxDQUFFLENBQUMsQ0FBQztJQUUxRSxJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFjLENBQUM7SUFDbEQsSUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVCLElBQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUU1Qiw0Q0FBNEM7SUFDNUMsSUFBSSxTQUFTLGdCQUFrQixJQUFJLFNBQVMsc0JBQXdCLElBQUksU0FBUyxvQkFBc0IsRUFBRTtRQUN4RyxNQUFNLElBQUksS0FBSyxDQUFDLDBDQUFtQyxTQUFTLENBQUUsQ0FBQyxDQUFDO0tBQ2hFO0lBRUQsSUFBSSxJQUFJLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckMsSUFBTSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLElBQU0sT0FBTyxHQUFVLEVBQUUsQ0FBQztJQUUxQixJQUFJLFNBQVMsb0JBQXNCLEVBQUU7UUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM3QixPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUNaLENBQUMsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDO2dCQUNwQixDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztnQkFDcEIsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUM7YUFDcEIsQ0FBQyxDQUFDO1NBQ0g7UUFFRCxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsdUJBQXVCO0tBQzdDO0lBRUQsNEJBQTRCO0lBQzVCLElBQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwQyxJQUFJLFFBQVEsS0FBSyxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBaUMsUUFBUSxDQUFFLENBQUMsQ0FBQztJQUVqRixVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTO0lBQzdCLElBQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvQixJQUFNLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDaEMsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxJQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsSUFBTSxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQztJQUMzQixJQUFNLE1BQU0sR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQzVCLElBQU0sSUFBSSxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFaEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUM1QyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO0tBQ2Q7SUFFRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNyRCxJQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLEdBQUc7WUFBRSxTQUFTO1FBRW5CLElBQU0sUUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsQyxJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsSUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxJQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbkMsSUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2xDLElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN2QyxJQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxtQkFBbUI7UUFDOUQsSUFBTSxVQUFVLEdBQUcsUUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0MsSUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUU1QyxJQUFJLFVBQVUsS0FBSyxDQUFDLElBQUksV0FBVyxLQUFLLENBQUMsRUFBRTtZQUMxQyxNQUFNLElBQUksS0FBSyxDQUFDLDhDQUE4QyxDQUFDLENBQUM7U0FDaEU7UUFFRCxJQUFNLENBQUMsR0FBRyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLElBQU0sQ0FBQyxHQUFHLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDekIsSUFBTSxFQUFFLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFNLEVBQUUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO1FBRXRCLElBQUksZUFBZSxLQUFLLENBQUMsRUFBRTtZQUMxQixJQUFJLFNBQVMsZ0JBQWtCLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRTtnQkFDMUMsS0FBSyxJQUFJLEdBQUMsR0FBRyxDQUFDLEVBQUUsR0FBQyxHQUFHLENBQUMsRUFBRSxHQUFDLEVBQUUsRUFBRTtvQkFDM0IsS0FBSyxJQUFJLEdBQUMsR0FBRyxDQUFDLEVBQUUsR0FBQyxHQUFHLENBQUMsRUFBRSxHQUFDLEVBQUUsRUFBRTt3QkFDM0IsSUFBTSxHQUFHLEdBQUcsR0FBQyxHQUFHLEdBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ3RCLElBQU0sR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUMsR0FBRyxDQUFDLEdBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQzVDLElBQUksQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3FCQUM1QjtpQkFDRDthQUNEO1lBRUQsSUFBSSxTQUFTLHNCQUF3QixJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUU7Z0JBQ2hELEtBQUssSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxDQUFDLEVBQUUsR0FBQyxFQUFFLEVBQUU7b0JBQzNCLEtBQUssSUFBSSxHQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUMsR0FBRyxDQUFDLEVBQUUsR0FBQyxFQUFFLEVBQUU7d0JBQzNCLElBQU0sR0FBRyxHQUFHLEdBQUMsR0FBRyxHQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUN0QixJQUFNLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFDLEdBQUcsQ0FBQyxHQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUM1QyxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQ3pCLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO3dCQUN0QixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQzt3QkFDdEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7cUJBQ3RCO2lCQUNEO2FBQ0Q7WUFFRCxJQUFJLFNBQVMsb0JBQXNCLEVBQUU7Z0JBQ3BDLFFBQVE7Z0JBQ1IsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO2FBQzlEO1NBQ0Q7YUFBTSxJQUFJLGVBQWUsS0FBSyxDQUFDLEVBQUU7WUFDakMsOEJBQThCO1lBQzlCLDhEQUE4RDtZQUM5RCxzREFBc0Q7WUFDdEQsaURBQWlEO1lBQ2pELHFCQUFxQjtZQUNyQixnRUFBZ0U7WUFDaEUsc0RBQXNEO1lBQ3RELE9BQU8sQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUNqRCxJQUFJLElBQUkscUJBQXFCLENBQUM7U0FDOUI7YUFBTTtZQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztTQUNwRDtRQUVELEVBQUUsRUFBRSxDQUFDO0tBQ0w7SUFFRCxxQ0FBcUM7SUFFckMsT0FBTyxFQUFFLEVBQUUsSUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLE1BQUEsRUFBRSxDQUFDO0FBQ25GLENBQUM7QUF4SEQsa0NBd0hDIiwiZmlsZSI6InBzZFJlYWRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcblx0UHNkLCBMYXllciwgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIExheWVyQWRkaXRpb25hbEluZm8sIFJlYWRPcHRpb25zLCBMYXllck1hc2tEYXRhLCBDb2xvcixcclxuXHRQYXR0ZXJuSW5mbywgR2xvYmFsTGF5ZXJNYXNrSW5mbywgUkdCXHJcbn0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdHJlc2V0SW1hZ2VEYXRhLCBvZmZzZXRGb3JDaGFubmVsLCBkZWNvZGVCaXRtYXAsIFBpeGVsRGF0YSwgY3JlYXRlQ2FudmFzLCBjcmVhdGVJbWFnZURhdGEsXHJcblx0dG9CbGVuZE1vZGUsIENoYW5uZWxJRCwgQ29tcHJlc3Npb24sIExheWVyTWFza0ZsYWdzLCBNYXNrUGFyYW1zLCBDb2xvclNwYWNlLCBSQVdfSU1BR0VfREFUQSwgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXNcclxufSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBpbmZvSGFuZGxlcnNNYXAgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVyc01hcCB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xyXG5cclxuaW50ZXJmYWNlIENoYW5uZWxJbmZvIHtcclxuXHRpZDogQ2hhbm5lbElEO1xyXG5cdGxlbmd0aDogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUmVhZE9wdGlvbnNFeHQgZXh0ZW5kcyBSZWFkT3B0aW9ucyB7XHJcblx0bGFyZ2U6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRDb2xvck1vZGVzID0gW0NvbG9yTW9kZS5CaXRtYXAsIENvbG9yTW9kZS5HcmF5c2NhbGUsIENvbG9yTW9kZS5SR0JdO1xyXG5jb25zdCBjb2xvck1vZGVzID0gWydiaXRtYXAnLCAnZ3JheXNjYWxlJywgJ2luZGV4ZWQnLCAnUkdCJywgJ0NNWUsnLCAnbXVsdGljaGFubmVsJywgJ2R1b3RvbmUnLCAnbGFiJ107XHJcblxyXG5mdW5jdGlvbiBzZXR1cEdyYXlzY2FsZShkYXRhOiBQaXhlbERhdGEpIHtcclxuXHRjb25zdCBzaXplID0gZGF0YS53aWR0aCAqIGRhdGEuaGVpZ2h0ICogNDtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaXplOyBpICs9IDQpIHtcclxuXHRcdGRhdGEuZGF0YVtpICsgMV0gPSBkYXRhLmRhdGFbaV07XHJcblx0XHRkYXRhLmRhdGFbaSArIDJdID0gZGF0YS5kYXRhW2ldO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQc2RSZWFkZXIge1xyXG5cdG9mZnNldDogbnVtYmVyO1xyXG5cdHZpZXc6IERhdGFWaWV3O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVhZGVyKGJ1ZmZlcjogQXJyYXlCdWZmZXIsIG9mZnNldD86IG51bWJlciwgbGVuZ3RoPzogbnVtYmVyKTogUHNkUmVhZGVyIHtcclxuXHRjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpO1xyXG5cdHJldHVybiB7IHZpZXcsIG9mZnNldDogMCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQ4KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAxO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0IC0gMSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwZWVrVWludDgocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDgocmVhZGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MTYocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDI7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEludDE2KHJlYWRlci5vZmZzZXQgLSAyLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVWludDE2KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAyO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MTYocmVhZGVyLm9mZnNldCAtIDIsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0SW50MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQzMkxFKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQzMihyZWFkZXIub2Zmc2V0IC0gNCwgdHJ1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVWludDMyKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGbG9hdDMyKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRGbG9hdDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRmxvYXQ2NChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gODtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0RmxvYXQ2NChyZWFkZXIub2Zmc2V0IC0gOCwgZmFsc2UpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDE2LjE2XHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRml4ZWRQb2ludDMyKHJlYWRlcjogUHNkUmVhZGVyKTogbnVtYmVyIHtcclxuXHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcikgLyAoMSA8PCAxNik7XHJcbn1cclxuXHJcbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyOiBQc2RSZWFkZXIpOiBudW1iZXIge1xyXG5cdHJldHVybiByZWFkSW50MzIocmVhZGVyKSAvICgxIDw8IDI0KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRCeXRlcyhyZWFkZXI6IFBzZFJlYWRlciwgbGVuZ3RoOiBudW1iZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IGxlbmd0aDtcclxuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgcmVhZGVyLm9mZnNldCAtIGxlbmd0aCwgbGVuZ3RoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRTaWduYXR1cmUocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZFNob3J0U3RyaW5nKHJlYWRlciwgNCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUGFzY2FsU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBwYWRUbzogbnVtYmVyKSB7XHJcblx0bGV0IGxlbmd0aCA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdGNvbnN0IHRleHQgPSBsZW5ndGggPyByZWFkU2hvcnRTdHJpbmcocmVhZGVyLCBsZW5ndGgpIDogJyc7XHJcblxyXG5cdHdoaWxlICgrK2xlbmd0aCAlIHBhZFRvKSB7XHJcblx0XHRyZWFkZXIub2Zmc2V0Kys7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdGV4dDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdHJldHVybiByZWFkVW5pY29kZVN0cmluZ1dpdGhMZW5ndGgocmVhZGVyLCBsZW5ndGgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGxldCB0ZXh0ID0gJyc7XHJcblxyXG5cdHdoaWxlIChsZW5ndGgtLSkge1xyXG5cdFx0Y29uc3QgdmFsdWUgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKHZhbHVlIHx8IGxlbmd0aCA+IDApIHsgLy8gcmVtb3ZlIHRyYWlsaW5nIFxcMFxyXG5cdFx0XHR0ZXh0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQXNjaWlTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0bGV0IHRleHQgPSAnJztcclxuXHJcblx0d2hpbGUgKGxlbmd0aC0tKSB7XHJcblx0XHR0ZXh0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZFVpbnQ4KHJlYWRlcikpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBza2lwQnl0ZXMocmVhZGVyOiBQc2RSZWFkZXIsIGNvdW50OiBudW1iZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IGNvdW50O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tTaWduYXR1cmUocmVhZGVyOiBQc2RSZWFkZXIsIGE6IHN0cmluZywgYj86IHN0cmluZykge1xyXG5cdGNvbnN0IG9mZnNldCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0Y29uc3Qgc2lnbmF0dXJlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRpZiAoc2lnbmF0dXJlICE9PSBhICYmIHNpZ25hdHVyZSAhPT0gYikge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnbmF0dXJlfScgYXQgMHgke29mZnNldC50b1N0cmluZygxNil9YCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkU2hvcnRTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRsZXQgcmVzdWx0ID0gJyc7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRyZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZmZXJbaV0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQc2QocmVhZGVyOiBQc2RSZWFkZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zID0ge30pIHtcclxuXHQvLyBoZWFkZXJcclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QlBTJyk7XHJcblx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRpZiAodmVyc2lvbiAhPT0gMSAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUFNEIGZpbGUgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRza2lwQnl0ZXMocmVhZGVyLCA2KTtcclxuXHRjb25zdCBjaGFubmVscyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBoZWlnaHQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3Qgd2lkdGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgYml0c1BlckNoYW5uZWwgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgY29sb3JNb2RlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKGNvbG9yTW9kZSkgPT09IC0xKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb2xvciBtb2RlIG5vdCBzdXBwb3J0ZWQ6ICR7Y29sb3JNb2Rlc1tjb2xvck1vZGVdID8/IGNvbG9yTW9kZX1gKTtcclxuXHJcblx0Y29uc3QgcHNkOiBQc2QgPSB7IHdpZHRoLCBoZWlnaHQsIGNoYW5uZWxzLCBiaXRzUGVyQ2hhbm5lbCwgY29sb3JNb2RlIH07XHJcblx0Y29uc3Qgb3B0OiBSZWFkT3B0aW9uc0V4dCA9IHsgLi4ub3B0aW9ucywgbGFyZ2U6IHZlcnNpb24gPT09IDIgfTtcclxuXHJcblx0Ly8gY29sb3IgbW9kZSBkYXRhXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGlmIChvcHQudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHRocm93IG5ldyBFcnJvcignQ29sb3IgbW9kZSBkYXRhIG5vdCBzdXBwb3J0ZWQnKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSk7XHJcblxyXG5cdC8vIGltYWdlIHJlc291cmNlc1xyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdGNvbnN0IHNpZyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRcdGlmIChzaWcgIT09ICc4QklNJyAmJiBzaWcgIT09ICdNZVNhJyAmJiBzaWcgIT09ICdBZ0hnJyAmJiBzaWcgIT09ICdQSFVUJyAmJiBzaWcgIT09ICdEQ1NSJykge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ30nIGF0IDB4JHsocmVhZGVyLm9mZnNldCAtIDQpLnRvU3RyaW5nKDE2KX1gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgaWQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRcdHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAyKTsgLy8gbmFtZVxyXG5cclxuXHRcdFx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdFx0XHRjb25zdCBoYW5kbGVyID0gcmVzb3VyY2VIYW5kbGVyc01hcFtpZF07XHJcblx0XHRcdFx0Y29uc3Qgc2tpcCA9IGlkID09PSAxMDM2ICYmICEhb3B0LnNraXBUaHVtYm5haWw7XHJcblxyXG5cdFx0XHRcdGlmICghcHNkLmltYWdlUmVzb3VyY2VzKSB7XHJcblx0XHRcdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChoYW5kbGVyICYmICFza2lwKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRoYW5kbGVyLnJlYWQocmVhZGVyLCBwc2QuaW1hZ2VSZXNvdXJjZXMsIGxlZnQsIG9wdCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0XHRcdGlmIChvcHQudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHRocm93IGU7XHJcblx0XHRcdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdC8vIG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKGBVbmhhbmRsZWQgaW1hZ2UgcmVzb3VyY2U6ICR7aWR9YCk7XHJcblx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdC8vIGxheWVyIGFuZCBtYXNrIGluZm9cclxuXHRsZXQgZ2xvYmFsQWxwaGEgPSBmYWxzZTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGdsb2JhbEFscGhhID0gcmVhZExheWVySW5mbyhyZWFkZXIsIHBzZCwgb3B0KTtcclxuXHJcblx0XHQvLyBTQUkgZG9lcyBub3QgaW5jbHVkZSB0aGlzIHNlY3Rpb25cclxuXHRcdGlmIChsZWZ0KCkgPiAwKSB7XHJcblx0XHRcdGNvbnN0IGdsb2JhbExheWVyTWFza0luZm8gPSByZWFkR2xvYmFsTGF5ZXJNYXNrSW5mbyhyZWFkZXIpO1xyXG5cdFx0XHRpZiAoZ2xvYmFsTGF5ZXJNYXNrSW5mbykgcHNkLmdsb2JhbExheWVyTWFza0luZm8gPSBnbG9iYWxMYXllck1hc2tJbmZvO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly8gcmV2ZXJ0IGJhY2sgdG8gZW5kIG9mIHNlY3Rpb24gaWYgZXhjZWVkZWQgc2VjdGlvbiBsaW1pdHNcclxuXHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygncmV2ZXJ0aW5nIHRvIGVuZCBvZiBzZWN0aW9uJyk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSA+IDApIHtcclxuXHRcdFx0Ly8gc29tZXRpbWVzIHRoZXJlIGFyZSBlbXB0eSBieXRlcyBoZXJlXHJcblx0XHRcdHdoaWxlIChsZWZ0KCkgJiYgcGVla1VpbnQ4KHJlYWRlcikgPT09IDApIHtcclxuXHRcdFx0XHQvLyBvcHQubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdza2lwcGluZyAwIGJ5dGUnKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAxKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGxlZnQoKSA+PSAxMikge1xyXG5cdFx0XHRcdHJlYWRBZGRpdGlvbmFsTGF5ZXJJbmZvKHJlYWRlciwgcHNkLCBwc2QsIG9wdCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnc2tpcHBpbmcgbGVmdG92ZXIgYnl0ZXMnLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB1bmRlZmluZWQsIG9wdC5sYXJnZSk7XHJcblxyXG5cdGNvbnN0IGhhc0NoaWxkcmVuID0gcHNkLmNoaWxkcmVuICYmIHBzZC5jaGlsZHJlbi5sZW5ndGg7XHJcblx0Y29uc3Qgc2tpcENvbXBvc2l0ZSA9IG9wdC5za2lwQ29tcG9zaXRlSW1hZ2VEYXRhICYmIChvcHQuc2tpcExheWVySW1hZ2VEYXRhIHx8IGhhc0NoaWxkcmVuKTtcclxuXHJcblx0aWYgKCFza2lwQ29tcG9zaXRlKSB7XHJcblx0XHRyZWFkSW1hZ2VEYXRhKHJlYWRlciwgcHNkLCBnbG9iYWxBbHBoYSwgb3B0KTtcclxuXHR9XHJcblxyXG5cdC8vIFRPRE86IHNob3cgY29udmVydGVkIGNvbG9yIG1vZGUgaW5zdGVhZCBvZiBvcmlnaW5hbCBQU0QgZmlsZSBjb2xvciBtb2RlXHJcblx0Ly8gICAgICAgYnV0IGFkZCBvcHRpb24gdG8gcHJlc2VydmUgZmlsZSBjb2xvciBtb2RlIChuZWVkIHRvIHJldHVybiBpbWFnZSBkYXRhIGluc3RlYWQgb2YgY2FudmFzIGluIHRoYXQgY2FzZSlcclxuXHQvLyBwc2QuY29sb3JNb2RlID0gQ29sb3JNb2RlLlJHQjsgLy8gd2UgY29udmVydCBhbGwgY29sb3IgbW9kZXMgdG8gUkdCXHJcblxyXG5cdHJldHVybiBwc2Q7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllckluZm8ocmVhZGVyOiBQc2RSZWFkZXIsIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGxldCBnbG9iYWxBbHBoYSA9IGZhbHNlO1xyXG5cclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDIsIGxlZnQgPT4ge1xyXG5cdFx0bGV0IGxheWVyQ291bnQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHJcblx0XHRpZiAobGF5ZXJDb3VudCA8IDApIHtcclxuXHRcdFx0Z2xvYmFsQWxwaGEgPSB0cnVlO1xyXG5cdFx0XHRsYXllckNvdW50ID0gLWxheWVyQ291bnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgbGF5ZXJzOiBMYXllcltdID0gW107XHJcblx0XHRjb25zdCBsYXllckNoYW5uZWxzOiBDaGFubmVsSW5mb1tdW10gPSBbXTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxheWVyQ291bnQ7IGkrKykge1xyXG5cdFx0XHRjb25zdCB7IGxheWVyLCBjaGFubmVscyB9ID0gcmVhZExheWVyUmVjb3JkKHJlYWRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0bGF5ZXJzLnB1c2gobGF5ZXIpO1xyXG5cdFx0XHRsYXllckNoYW5uZWxzLnB1c2goY2hhbm5lbHMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghb3B0aW9ucy5za2lwTGF5ZXJJbWFnZURhdGEpIHtcclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcclxuXHRcdFx0XHRyZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKHJlYWRlciwgcHNkLCBsYXllcnNbaV0sIGxheWVyQ2hhbm5lbHNbaV0sIG9wdGlvbnMpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHJcblx0XHRpZiAoIXBzZC5jaGlsZHJlbikgcHNkLmNoaWxkcmVuID0gW107XHJcblxyXG5cdFx0Y29uc3Qgc3RhY2s6IChMYXllciB8IFBzZClbXSA9IFtwc2RdO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSBsYXllcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuXHRcdFx0Y29uc3QgbCA9IGxheWVyc1tpXTtcclxuXHRcdFx0Y29uc3QgdHlwZSA9IGwuc2VjdGlvbkRpdmlkZXIgPyBsLnNlY3Rpb25EaXZpZGVyLnR5cGUgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3RoZXI7XHJcblx0XHRcdGlmICh0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlciB8fCB0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuQ2xvc2VkRm9sZGVyKSB7XHJcblx0XHRcdFx0bC5vcGVuZWQgPSB0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcjtcclxuXHRcdFx0XHRsLmNoaWxkcmVuID0gW107XHJcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XHJcblx0XHRcdFx0aWYgKHBhcmVudCAmJiBwYXJlbnQubmFtZSkge1xyXG5cdFx0XHRcdFx0bC5wYXJlbnRQYXRoID0gcGFyZW50Lm5hbWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xyXG5cdFx0XHRcdHN0YWNrLnB1c2gobCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIpIHtcclxuXHRcdFx0XHRzdGFjay5wb3AoKTtcclxuXHRcdFx0XHQvLyB0aGlzIHdhcyB3b3JrYXJvdW5kIGJlY2F1c2UgSSBkaWRuJ3Qga25vdyB3aGF0IGBsc2RrYCBzZWN0aW9uIHdhcywgbm93IGl0J3MgcHJvYmFibHkgbm90IG5lZWRlZCBhbnltb3JlXHJcblx0XHRcdFx0Ly8gfSBlbHNlIGlmIChsLm5hbWUgPT09ICc8L0xheWVyIGdyb3VwPicgJiYgIWwuc2VjdGlvbkRpdmlkZXIgJiYgIWwudG9wICYmICFsLmxlZnQgJiYgIWwuYm90dG9tICYmICFsLnJpZ2h0KSB7XHJcblx0XHRcdFx0Ly8gXHQvLyBzb21ldGltZXMgbGF5ZXIgZ3JvdXAgdGVybWluYXRvciBkb2Vzbid0IGhhdmUgc2VjdGlvbkRpdmlkZXIsIHNvIHdlIGp1c3QgZ3Vlc3MgaGVyZSAoUFMgYnVnID8pXHJcblx0XHRcdFx0Ly8gXHRzdGFjay5wb3AoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcclxuXHRcdFx0XHRpZiAocGFyZW50ICYmIHBhcmVudC5uYW1lKSB7XHJcblx0XHRcdFx0XHRsLnBhcmVudFBhdGggPSBwYXJlbnQubmFtZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0c3RhY2tbc3RhY2subGVuZ3RoIC0gMV0uY2hpbGRyZW4hLnVuc2hpZnQobCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB1bmRlZmluZWQsIG9wdGlvbnMubGFyZ2UpO1xyXG5cclxuXHRyZXR1cm4gZ2xvYmFsQWxwaGE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllclJlY29yZChyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3QgbGF5ZXI6IExheWVyID0ge307XHJcblx0bGF5ZXIudG9wID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0bGF5ZXIubGVmdCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGxheWVyLmJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGxheWVyLnJpZ2h0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblxyXG5cdGNvbnN0IGNoYW5uZWxDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxDb3VudDsgaSsrKSB7XHJcblx0XHRsZXQgY2hhbm5lbElEID0gcmVhZEludDE2KHJlYWRlcikgYXMgQ2hhbm5lbElEO1xyXG5cdFx0bGV0IGNoYW5uZWxMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMubGFyZ2UpIHtcclxuXHRcdFx0aWYgKGNoYW5uZWxMZW5ndGggIT09IDApIHRocm93IG5ldyBFcnJvcignU2l6ZXMgbGFyZ2VyIHRoYW4gNEdCIGFyZSBub3Qgc3VwcG9ydGVkJyk7XHJcblx0XHRcdGNoYW5uZWxMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0Y2hhbm5lbHMucHVzaCh7IGlkOiBjaGFubmVsSUQsIGxlbmd0aDogY2hhbm5lbExlbmd0aCB9KTtcclxuXHR9XHJcblxyXG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcclxuXHRjb25zdCBibGVuZE1vZGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0aWYgKCF0b0JsZW5kTW9kZVtibGVuZE1vZGVdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYmxlbmQgbW9kZTogJyR7YmxlbmRNb2RlfSdgKTtcclxuXHRsYXllci5ibGVuZE1vZGUgPSB0b0JsZW5kTW9kZVtibGVuZE1vZGVdO1xyXG5cclxuXHRsYXllci5vcGFjaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG5cdGxheWVyLmNsaXBwaW5nID0gcmVhZFVpbnQ4KHJlYWRlcikgPT09IDE7XHJcblxyXG5cdGNvbnN0IGZsYWdzID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0bGF5ZXIudHJhbnNwYXJlbmN5UHJvdGVjdGVkID0gKGZsYWdzICYgMHgwMSkgIT09IDA7XHJcblx0bGF5ZXIuaGlkZGVuID0gKGZsYWdzICYgMHgwMikgIT09IDA7XHJcblx0Ly8gMHgwNCAtIG9ic29sZXRlXHJcblx0Ly8gMHgwOCAtIDEgZm9yIFBob3Rvc2hvcCA1LjAgYW5kIGxhdGVyLCB0ZWxscyBpZiBiaXQgNCBoYXMgdXNlZnVsIGluZm9ybWF0aW9uXHJcblx0Ly8gMHgxMCAtIHBpeGVsIGRhdGEgaXJyZWxldmFudCB0byBhcHBlYXJhbmNlIG9mIGRvY3VtZW50XHJcblxyXG5cdHNraXBCeXRlcyhyZWFkZXIsIDEpO1xyXG5cclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0Y29uc3QgbWFzayA9IHJlYWRMYXllck1hc2tEYXRhKHJlYWRlciwgb3B0aW9ucyk7XHJcblx0XHRpZiAobWFzaykgbGF5ZXIubWFzayA9IG1hc2s7XHJcblxyXG5cdFx0Lypjb25zdCBibGVuZGluZ1JhbmdlcyA9Ki8gcmVhZExheWVyQmxlbmRpbmdSYW5nZXMocmVhZGVyKTtcclxuXHRcdGxheWVyLm5hbWUgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgNCk7XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRyZWFkQWRkaXRpb25hbExheWVySW5mbyhyZWFkZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4geyBsYXllciwgY2hhbm5lbHMgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExheWVyTWFza0RhdGEocmVhZGVyOiBQc2RSZWFkZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uPExheWVyTWFza0RhdGEgfCB1bmRlZmluZWQ+KHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRjb25zdCBtYXNrOiBMYXllck1hc2tEYXRhID0ge307XHJcblx0XHRtYXNrLnRvcCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5sZWZ0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRtYXNrLmJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5yaWdodCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5kZWZhdWx0Q29sb3IgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHJcblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0bWFzay5wb3NpdGlvblJlbGF0aXZlVG9MYXllciA9IChmbGFncyAmIExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyKSAhPT0gMDtcclxuXHRcdG1hc2suZGlzYWJsZWQgPSAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5MYXllck1hc2tEaXNhYmxlZCkgIT09IDA7XHJcblx0XHRtYXNrLmZyb21WZWN0b3JEYXRhID0gKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRnJvbVJlbmRlcmluZ090aGVyRGF0YSkgIT09IDA7XHJcblxyXG5cdFx0aWYgKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTWFza0hhc1BhcmFtZXRlcnNBcHBsaWVkVG9JdCkge1xyXG5cdFx0XHRjb25zdCBwYXJhbXMgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVXNlck1hc2tEZW5zaXR5KSBtYXNrLnVzZXJNYXNrRGVuc2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyKSBtYXNrLnVzZXJNYXNrRmVhdGhlciA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlZlY3Rvck1hc2tEZW5zaXR5KSBtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG5cdFx0XHRpZiAocGFyYW1zICYgTWFza1BhcmFtcy5WZWN0b3JNYXNrRmVhdGhlcikgbWFzay52ZWN0b3JNYXNrRmVhdGhlciA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnQoKSA+IDIpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBleHRyYSBtYXNrIHBhcmFtcycpO1xyXG5cdFx0XHQvLyBUT0RPOiBoYW5kbGUgdGhlc2UgdmFsdWVzXHJcblx0XHRcdC8qY29uc3QgcmVhbEZsYWdzID0qLyByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCByZWFsVXNlck1hc2tCYWNrZ3JvdW5kID0qLyByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCB0b3AyID0qLyByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCBsZWZ0MiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgYm90dG9tMiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcmlnaHQyID0qLyByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0cmV0dXJuIG1hc2s7XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllckJsZW5kaW5nUmFuZ2VzKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRjb25zdCBjb21wb3NpdGVHcmF5QmxlbmRTb3VyY2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjb21wb3NpdGVHcmFwaEJsZW5kRGVzdGluYXRpb25SYW5nZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHJhbmdlcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0Y29uc3Qgc291cmNlUmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGRlc3RSYW5nZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmFuZ2VzLnB1c2goeyBzb3VyY2VSYW5nZSwgZGVzdFJhbmdlIH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7IGNvbXBvc2l0ZUdyYXlCbGVuZFNvdXJjZSwgY29tcG9zaXRlR3JhcGhCbGVuZERlc3RpbmF0aW9uUmFuZ2UsIHJhbmdlcyB9O1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgbGF5ZXI6IExheWVyLCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSwgb3B0aW9uczogUmVhZE9wdGlvbnNFeHRcclxuKSB7XHJcblx0Y29uc3QgbGF5ZXJXaWR0aCA9IChsYXllci5yaWdodCB8fCAwKSAtIChsYXllci5sZWZ0IHx8IDApO1xyXG5cdGNvbnN0IGxheWVySGVpZ2h0ID0gKGxheWVyLmJvdHRvbSB8fCAwKSAtIChsYXllci50b3AgfHwgMCk7XHJcblx0Y29uc3QgY215ayA9IHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5DTVlLO1xyXG5cclxuXHRsZXQgaW1hZ2VEYXRhOiBJbWFnZURhdGEgfCB1bmRlZmluZWQ7XHJcblxyXG5cdGlmIChsYXllcldpZHRoICYmIGxheWVySGVpZ2h0KSB7XHJcblx0XHRpZiAoY215aykge1xyXG5cdFx0XHRpbWFnZURhdGEgPSB7IHdpZHRoOiBsYXllcldpZHRoLCBoZWlnaHQ6IGxheWVySGVpZ2h0LCBkYXRhOiBuZXcgVWludDhDbGFtcGVkQXJyYXkobGF5ZXJXaWR0aCAqIGxheWVySGVpZ2h0ICogNSkgfTtcclxuXHRcdFx0Zm9yIChsZXQgcCA9IDQ7IHAgPCBpbWFnZURhdGEuZGF0YS5ieXRlTGVuZ3RoOyBwICs9IDUpIGltYWdlRGF0YS5kYXRhW3BdID0gMjU1O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aW1hZ2VEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKGxheWVyV2lkdGgsIGxheWVySGVpZ2h0KTtcclxuXHRcdFx0cmVzZXRJbWFnZURhdGEoaW1hZ2VEYXRhKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChSQVdfSU1BR0VfREFUQSkgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3ID0gW107XHJcblxyXG5cdGZvciAoY29uc3QgY2hhbm5lbCBvZiBjaGFubmVscykge1xyXG5cdFx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29tcHJlc3Npb247XHJcblxyXG5cdFx0aWYgKGNoYW5uZWwuaWQgPT09IENoYW5uZWxJRC5Vc2VyTWFzaykge1xyXG5cdFx0XHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcclxuXHJcblx0XHRcdGlmICghbWFzaykgdGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGxheWVyIG1hc2sgZGF0YWApO1xyXG5cclxuXHRcdFx0Y29uc3QgbWFza1dpZHRoID0gKG1hc2sucmlnaHQgfHwgMCkgLSAobWFzay5sZWZ0IHx8IDApO1xyXG5cdFx0XHRjb25zdCBtYXNrSGVpZ2h0ID0gKG1hc2suYm90dG9tIHx8IDApIC0gKG1hc2sudG9wIHx8IDApO1xyXG5cclxuXHRcdFx0aWYgKG1hc2tXaWR0aCAmJiBtYXNrSGVpZ2h0KSB7XHJcblx0XHRcdFx0Y29uc3QgbWFza0RhdGEgPSBjcmVhdGVJbWFnZURhdGEobWFza1dpZHRoLCBtYXNrSGVpZ2h0KTtcclxuXHRcdFx0XHRyZXNldEltYWdlRGF0YShtYXNrRGF0YSk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHN0YXJ0ID0gcmVhZGVyLm9mZnNldDtcclxuXHRcdFx0XHRyZWFkRGF0YShyZWFkZXIsIG1hc2tEYXRhLCBjb21wcmVzc2lvbiwgbWFza1dpZHRoLCBtYXNrSGVpZ2h0LCAwLCBvcHRpb25zLmxhcmdlLCA0KTtcclxuXHJcblx0XHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSB7XHJcblx0XHRcdFx0XHQobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2V0dXBHcmF5c2NhbGUobWFza0RhdGEpO1xyXG5cclxuXHRcdFx0XHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdFx0XHRcdG1hc2suaW1hZ2VEYXRhID0gbWFza0RhdGE7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1hc2suY2FudmFzID0gY3JlYXRlQ2FudmFzKG1hc2tXaWR0aCwgbWFza0hlaWdodCk7XHJcblx0XHRcdFx0XHRtYXNrLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEobWFza0RhdGEsIDAsIDApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsLmlkLCBjbXlrKTtcclxuXHRcdFx0bGV0IHRhcmdldERhdGEgPSBpbWFnZURhdGE7XHJcblxyXG5cdFx0XHRpZiAob2Zmc2V0IDwgMCkge1xyXG5cdFx0XHRcdHRhcmdldERhdGEgPSB1bmRlZmluZWQ7XHJcblxyXG5cdFx0XHRcdGlmIChvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB7XHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENoYW5uZWwgbm90IHN1cHBvcnRlZDogJHtjaGFubmVsLmlkfWApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRyZWFkRGF0YShyZWFkZXIsIHRhcmdldERhdGEsIGNvbXByZXNzaW9uLCBsYXllcldpZHRoLCBsYXllckhlaWdodCwgb2Zmc2V0LCBvcHRpb25zLmxhcmdlLCBjbXlrID8gNSA6IDQpO1xyXG5cclxuXHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSB7XHJcblx0XHRcdFx0KGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3W2NoYW5uZWwuaWRdID0gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgc3RhcnQsIHJlYWRlci5vZmZzZXQgLSBzdGFydCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0YXJnZXREYXRhICYmIHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUpIHtcclxuXHRcdFx0XHRzZXR1cEdyYXlzY2FsZSh0YXJnZXREYXRhKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKGltYWdlRGF0YSkge1xyXG5cdFx0aWYgKGNteWspIHtcclxuXHRcdFx0Y29uc3QgY215a0RhdGEgPSBpbWFnZURhdGE7XHJcblx0XHRcdGltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShjbXlrRGF0YS53aWR0aCwgY215a0RhdGEuaGVpZ2h0KTtcclxuXHRcdFx0Y215a1RvUmdiKGNteWtEYXRhLCBpbWFnZURhdGEsIGZhbHNlKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdFx0bGF5ZXIuaW1hZ2VEYXRhID0gaW1hZ2VEYXRhO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXIuY2FudmFzID0gY3JlYXRlQ2FudmFzKGxheWVyV2lkdGgsIGxheWVySGVpZ2h0KTtcclxuXHRcdFx0bGF5ZXIuY2FudmFzLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZERhdGEoXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIGRhdGE6IEltYWdlRGF0YSB8IHVuZGVmaW5lZCwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcixcclxuXHRvZmZzZXQ6IG51bWJlciwgbGFyZ2U6IGJvb2xlYW4sIHN0ZXA6IG51bWJlclxyXG4pIHtcclxuXHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdHJlYWREYXRhUmF3KHJlYWRlciwgZGF0YSwgb2Zmc2V0LCB3aWR0aCwgaGVpZ2h0LCBzdGVwKTtcclxuXHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIHN0ZXAsIFtvZmZzZXRdLCBsYXJnZSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29tcHJlc3Npb24gdHlwZSBub3Qgc3VwcG9ydGVkOiAke2NvbXByZXNzaW9ufWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEdsb2JhbExheWVyTWFza0luZm8ocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZFNlY3Rpb248R2xvYmFsTGF5ZXJNYXNrSW5mbyB8IHVuZGVmaW5lZD4ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGlmICghbGVmdCgpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuXHRcdGNvbnN0IG92ZXJsYXlDb2xvclNwYWNlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTEgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjb2xvclNwYWNlMiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2UzID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZjtcclxuXHRcdGNvbnN0IGtpbmQgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7IC8vIDMgYnl0ZXMgb2YgcGFkZGluZyA/XHJcblx0XHRyZXR1cm4geyBvdmVybGF5Q29sb3JTcGFjZSwgY29sb3JTcGFjZTEsIGNvbG9yU3BhY2UyLCBjb2xvclNwYWNlMywgY29sb3JTcGFjZTQsIG9wYWNpdHksIGtpbmQgfTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEFkZGl0aW9uYWxMYXllckluZm8ocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3Qgc2lnID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdGlmIChzaWcgIT09ICc4QklNJyAmJiBzaWcgIT09ICc4QjY0JykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnfScgYXQgMHgkeyhyZWFkZXIub2Zmc2V0IC0gNCkudG9TdHJpbmcoMTYpfWApO1xyXG5cdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0Ly8gYGxhcmdlQWRkaXRpb25hbEluZm9LZXlzYCBmYWxsYmFjaywgYmVjYXVzZSBzb21lIGtleXMgZG9uJ3QgaGF2ZSA4QjY0IHNpZ25hdHVyZSBldmVuIHdoZW4gdGhleSBhcmUgNjRiaXRcclxuXHRjb25zdCB1NjQgPSBzaWcgPT09ICc4QjY0JyB8fCAob3B0aW9ucy5sYXJnZSAmJiBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cy5pbmRleE9mKGtleSkgIT09IC0xKTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdGNvbnN0IGhhbmRsZXIgPSBpbmZvSGFuZGxlcnNNYXBba2V5XTtcclxuXHJcblx0XHRpZiAoaGFuZGxlcikge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGhhbmRsZXIucmVhZChyZWFkZXIsIHRhcmdldCwgbGVmdCwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdGlmIChvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBlO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5oYW5kbGVkIGFkZGl0aW9uYWwgaW5mbzogJHtrZXl9YCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnQoKSkge1xyXG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5yZWFkICR7bGVmdCgpfSBieXRlcyBsZWZ0IGZvciBhZGRpdGlvbmFsIGluZm86ICR7a2V5fWApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cdH0sIGZhbHNlLCB1NjQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkSW1hZ2VEYXRhKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgZ2xvYmFsQWxwaGE6IGJvb2xlYW4sIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29tcHJlc3Npb247XHJcblxyXG5cdGlmIChzdXBwb3J0ZWRDb2xvck1vZGVzLmluZGV4T2YocHNkLmNvbG9yTW9kZSEpID09PSAtMSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke3BzZC5jb2xvck1vZGV9YCk7XHJcblxyXG5cdGlmIChjb21wcmVzc2lvbiAhPT0gQ29tcHJlc3Npb24uUmF3RGF0YSAmJiBjb21wcmVzc2lvbiAhPT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZClcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29tcHJlc3Npb24gdHlwZSBub3Qgc3VwcG9ydGVkOiAke2NvbXByZXNzaW9ufWApO1xyXG5cclxuXHRjb25zdCBpbWFnZURhdGEgPSBjcmVhdGVJbWFnZURhdGEocHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRyZXNldEltYWdlRGF0YShpbWFnZURhdGEpO1xyXG5cclxuXHRzd2l0Y2ggKHBzZC5jb2xvck1vZGUpIHtcclxuXHRcdGNhc2UgQ29sb3JNb2RlLkJpdG1hcDoge1xyXG5cdFx0XHRsZXQgYnl0ZXM6IFVpbnQ4QXJyYXk7XHJcblxyXG5cdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdFx0XHRieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIE1hdGguY2VpbChwc2Qud2lkdGggLyA4KSAqIHBzZC5oZWlnaHQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Ynl0ZXMgPSBuZXcgVWludDhBcnJheShwc2Qud2lkdGggKiBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIHsgZGF0YTogYnl0ZXMsIHdpZHRoOiBwc2Qud2lkdGgsIGhlaWdodDogcHNkLmhlaWdodCB9LCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDEsIFswXSwgb3B0aW9ucy5sYXJnZSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBCaXRtYXAgY29tcHJlc3Npb24gbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVjb2RlQml0bWFwKGJ5dGVzLCBpbWFnZURhdGEuZGF0YSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yTW9kZS5SR0I6XHJcblx0XHRjYXNlIENvbG9yTW9kZS5HcmF5c2NhbGU6IHtcclxuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlID8gWzBdIDogWzAsIDEsIDJdO1xyXG5cclxuXHRcdFx0aWYgKHBzZC5jaGFubmVscyAmJiBwc2QuY2hhbm5lbHMgPiAzKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDM7IGkgPCBwc2QuY2hhbm5lbHM7IGkrKykge1xyXG5cdFx0XHRcdFx0Ly8gVE9ETzogc3RvcmUgdGhlc2UgY2hhbm5lbHMgaW4gYWRkaXRpb25hbCBpbWFnZSBkYXRhXHJcblx0XHRcdFx0XHRjaGFubmVscy5wdXNoKGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChnbG9iYWxBbHBoYSkge1xyXG5cdFx0XHRcdGNoYW5uZWxzLnB1c2goMyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmF3RGF0YSkge1xyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdHJlYWREYXRhUmF3KHJlYWRlciwgaW1hZ2VEYXRhLCBjaGFubmVsc1tpXSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCA0KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpIHtcclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBpbWFnZURhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgNCwgY2hhbm5lbHMsIG9wdGlvbnMubGFyZ2UpO1xyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSkge1xyXG5cdFx0XHRcdHNldHVwR3JheXNjYWxlKGltYWdlRGF0YSk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yTW9kZS5DTVlLOiB7XHJcblx0XHRcdGlmIChwc2QuY2hhbm5lbHMgIT09IDQpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjaGFubmVsIGNvdW50YCk7XHJcblxyXG5cdFx0XHRjb25zdCBjaGFubmVscyA9IFswLCAxLCAyLCAzXTtcclxuXHRcdFx0aWYgKGdsb2JhbEFscGhhKSBjaGFubmVscy5wdXNoKDQpO1xyXG5cclxuXHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOb3QgaW1wbGVtZW50ZWRgKTtcclxuXHRcdFx0XHQvLyBUT0RPOiAuLi5cclxuXHRcdFx0XHQvLyBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0Ly8gXHRyZWFkRGF0YVJhdyhyZWFkZXIsIGltYWdlRGF0YSwgY2hhbm5lbHNbaV0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Y29uc3QgY215a0ltYWdlRGF0YTogUGl4ZWxEYXRhID0ge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGltYWdlRGF0YS53aWR0aCxcclxuXHRcdFx0XHRcdGhlaWdodDogaW1hZ2VEYXRhLmhlaWdodCxcclxuXHRcdFx0XHRcdGRhdGE6IG5ldyBVaW50OEFycmF5KGltYWdlRGF0YS53aWR0aCAqIGltYWdlRGF0YS5oZWlnaHQgKiA1KSxcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBjbXlrSW1hZ2VEYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDUsIGNoYW5uZWxzLCBvcHRpb25zLmxhcmdlKTtcclxuXHRcdFx0XHRjbXlrVG9SZ2IoY215a0ltYWdlRGF0YSwgaW1hZ2VEYXRhLCB0cnVlKTtcclxuXHJcblx0XHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3ID0gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgc3RhcnQsIHJlYWRlci5vZmZzZXQgLSBzdGFydCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0ZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKGBDb2xvciBtb2RlIG5vdCBzdXBwb3J0ZWQ6ICR7cHNkLmNvbG9yTW9kZX1gKTtcclxuXHR9XHJcblxyXG5cdGlmIChvcHRpb25zLnVzZUltYWdlRGF0YSkge1xyXG5cdFx0cHNkLmltYWdlRGF0YSA9IGltYWdlRGF0YTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cHNkLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xyXG5cdFx0cHNkLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNteWtUb1JnYihjbXlrOiBQaXhlbERhdGEsIHJnYjogUGl4ZWxEYXRhLCByZXZlcnNlQWxwaGE6IGJvb2xlYW4pIHtcclxuXHRjb25zdCBzaXplID0gcmdiLndpZHRoICogcmdiLmhlaWdodCAqIDQ7XHJcblx0Y29uc3Qgc3JjRGF0YSA9IGNteWsuZGF0YTtcclxuXHRjb25zdCBkc3REYXRhID0gcmdiLmRhdGE7XHJcblxyXG5cdGZvciAobGV0IHNyYyA9IDAsIGRzdCA9IDA7IGRzdCA8IHNpemU7IHNyYyArPSA1LCBkc3QgKz0gNCkge1xyXG5cdFx0Y29uc3QgYyA9IHNyY0RhdGFbc3JjXTtcclxuXHRcdGNvbnN0IG0gPSBzcmNEYXRhW3NyYyArIDFdO1xyXG5cdFx0Y29uc3QgeSA9IHNyY0RhdGFbc3JjICsgMl07XHJcblx0XHRjb25zdCBrID0gc3JjRGF0YVtzcmMgKyAzXTtcclxuXHRcdGRzdERhdGFbZHN0XSA9ICgoKChjICogaykgfCAwKSAvIDI1NSkgfCAwKTtcclxuXHRcdGRzdERhdGFbZHN0ICsgMV0gPSAoKCgobSAqIGspIHwgMCkgLyAyNTUpIHwgMCk7XHJcblx0XHRkc3REYXRhW2RzdCArIDJdID0gKCgoKHkgKiBrKSB8IDApIC8gMjU1KSB8IDApO1xyXG5cdFx0ZHN0RGF0YVtkc3QgKyAzXSA9IHJldmVyc2VBbHBoYSA/IDI1NSAtIHNyY0RhdGFbc3JjICsgNF0gOiBzcmNEYXRhW3NyYyArIDRdO1xyXG5cdH1cclxuXHJcblx0Ly8gZm9yIChsZXQgc3JjID0gMCwgZHN0ID0gMDsgZHN0IDwgc2l6ZTsgc3JjICs9IDUsIGRzdCArPSA0KSB7XHJcblx0Ly8gXHRjb25zdCBjID0gMSAtIChzcmNEYXRhW3NyYyArIDBdIC8gMjU1KTtcclxuXHQvLyBcdGNvbnN0IG0gPSAxIC0gKHNyY0RhdGFbc3JjICsgMV0gLyAyNTUpO1xyXG5cdC8vIFx0Y29uc3QgeSA9IDEgLSAoc3JjRGF0YVtzcmMgKyAyXSAvIDI1NSk7XHJcblx0Ly8gXHQvLyBjb25zdCBrID0gc3JjRGF0YVtzcmMgKyAzXSAvIDI1NTtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgMF0gPSAoKDEgLSBjICogMC44KSAqIDI1NSkgfCAwO1xyXG5cdC8vIFx0ZHN0RGF0YVtkc3QgKyAxXSA9ICgoMSAtIG0gKiAwLjgpICogMjU1KSB8IDA7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDJdID0gKCgxIC0geSAqIDAuOCkgKiAyNTUpIHwgMDtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgM10gPSByZXZlcnNlQWxwaGEgPyAyNTUgLSBzcmNEYXRhW3NyYyArIDRdIDogc3JjRGF0YVtzcmMgKyA0XTtcclxuXHQvLyB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWREYXRhUmF3KHJlYWRlcjogUHNkUmVhZGVyLCBwaXhlbERhdGE6IFBpeGVsRGF0YSB8IHVuZGVmaW5lZCwgb2Zmc2V0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBzdGVwOiBudW1iZXIpIHtcclxuXHRjb25zdCBzaXplID0gd2lkdGggKiBoZWlnaHQ7XHJcblx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgc2l6ZSk7XHJcblxyXG5cdGlmIChwaXhlbERhdGEgJiYgb2Zmc2V0IDwgc3RlcCkge1xyXG5cdFx0Y29uc3QgZGF0YSA9IHBpeGVsRGF0YS5kYXRhO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwLCBwID0gb2Zmc2V0IHwgMDsgaSA8IHNpemU7IGkrKywgcCA9IChwICsgc3RlcCkgfCAwKSB7XHJcblx0XHRcdGRhdGFbcF0gPSBidWZmZXJbaV07XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZERhdGFSTEUoXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIHBpeGVsRGF0YTogUGl4ZWxEYXRhIHwgdW5kZWZpbmVkLCBfd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHN0ZXA6IG51bWJlciwgb2Zmc2V0czogbnVtYmVyW10sXHJcblx0bGFyZ2U6IGJvb2xlYW5cclxuKSB7XHJcblx0Y29uc3QgZGF0YSA9IHBpeGVsRGF0YSAmJiBwaXhlbERhdGEuZGF0YTtcclxuXHRsZXQgbGVuZ3RoczogVWludDE2QXJyYXkgfCBVaW50MzJBcnJheTtcclxuXHJcblx0aWYgKGxhcmdlKSB7XHJcblx0XHRsZW5ndGhzID0gbmV3IFVpbnQzMkFycmF5KG9mZnNldHMubGVuZ3RoICogaGVpZ2h0KTtcclxuXHJcblx0XHRmb3IgKGxldCBvID0gMCwgbGkgPSAwOyBvIDwgb2Zmc2V0cy5sZW5ndGg7IG8rKykge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0bGVuZ3Roc1tsaV0gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0bGVuZ3RocyA9IG5ldyBVaW50MTZBcnJheShvZmZzZXRzLmxlbmd0aCAqIGhlaWdodCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgbyA9IDAsIGxpID0gMDsgbyA8IG9mZnNldHMubGVuZ3RoOyBvKyspIHtcclxuXHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGxlbmd0aHNbbGldID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjb25zdCBleHRyYUxpbWl0ID0gKHN0ZXAgLSAxKSB8IDA7IC8vIDMgZm9yIHJnYiwgNCBmb3IgY215a1xyXG5cclxuXHRmb3IgKGxldCBjID0gMCwgbGkgPSAwOyBjIDwgb2Zmc2V0cy5sZW5ndGg7IGMrKykge1xyXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0c1tjXSB8IDA7XHJcblx0XHRjb25zdCBleHRyYSA9IGMgPiBleHRyYUxpbWl0IHx8IG9mZnNldCA+IGV4dHJhTGltaXQ7XHJcblxyXG5cdFx0aWYgKCFkYXRhIHx8IGV4dHJhKSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyssIGxpKyspIHtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZW5ndGhzW2xpXSk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwLCBwID0gb2Zmc2V0IHwgMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0Y29uc3QgbGVuZ3RoID0gbGVuZ3Roc1tsaV07XHJcblx0XHRcdFx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlciA9IGJ1ZmZlcltpXTtcclxuXHJcblx0XHRcdFx0XHRpZiAoaGVhZGVyID4gMTI4KSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gYnVmZmVyWysraV07XHJcblx0XHRcdFx0XHRcdGhlYWRlciA9ICgyNTYgLSBoZWFkZXIpIHwgMDtcclxuXHJcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDw9IGhlYWRlcjsgaiA9IChqICsgMSkgfCAwKSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtwXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIHN0ZXApIHwgMDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChoZWFkZXIgPCAxMjgpIHtcclxuXHRcdFx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPD0gaGVhZGVyOyBqID0gKGogKyAxKSB8IDApIHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhW3BdID0gYnVmZmVyWysraV07XHJcblx0XHRcdFx0XHRcdFx0cCA9IChwICsgc3RlcCkgfCAwO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHQvLyBpZ25vcmUgMTI4XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKGkgPj0gbGVuZ3RoKSB7XHJcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBSTEUgZGF0YTogZXhjZWVkZWQgYnVmZmVyIHNpemUgJHtpfS8ke2xlbmd0aH1gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkU2VjdGlvbjxUPihcclxuXHRyZWFkZXI6IFBzZFJlYWRlciwgcm91bmQ6IG51bWJlciwgZnVuYzogKGxlZnQ6ICgpID0+IG51bWJlcikgPT4gVCwgc2tpcEVtcHR5ID0gdHJ1ZSwgZWlnaHRCeXRlcyA9IGZhbHNlXHJcbik6IFQgfCB1bmRlZmluZWQge1xyXG5cdGxldCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdGlmIChlaWdodEJ5dGVzKSB7XHJcblx0XHRpZiAobGVuZ3RoICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ1NpemVzIGxhcmdlciB0aGFuIDRHQiBhcmUgbm90IHN1cHBvcnRlZCcpO1xyXG5cdFx0bGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdH1cclxuXHJcblx0aWYgKGxlbmd0aCA8PSAwICYmIHNraXBFbXB0eSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0bGV0IGVuZCA9IHJlYWRlci5vZmZzZXQgKyBsZW5ndGg7XHJcblx0Y29uc3QgcmVzdWx0ID0gZnVuYygoKSA9PiBlbmQgLSByZWFkZXIub2Zmc2V0KTtcclxuXHJcblx0aWYgKHJlYWRlci5vZmZzZXQgPiBlbmQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIHNlY3Rpb24gbGltaXRzJyk7XHJcblxyXG5cdGlmIChyZWFkZXIub2Zmc2V0ICE9PSBlbmQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFVucmVhZCBzZWN0aW9uIGRhdGE6ICR7ZW5kIC0gcmVhZGVyLm9mZnNldH0gYnl0ZXMgYXQgMHgke3JlYWRlci5vZmZzZXQudG9TdHJpbmcoMTYpfWApO1xyXG5cclxuXHR3aGlsZSAoZW5kICUgcm91bmQpIGVuZCsrO1xyXG5cclxuXHRyZWFkZXIub2Zmc2V0ID0gZW5kO1xyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQ29sb3IocmVhZGVyOiBQc2RSZWFkZXIpOiBDb2xvciB7XHJcblx0Y29uc3QgY29sb3JTcGFjZSA9IHJlYWRVaW50MTYocmVhZGVyKSBhcyBDb2xvclNwYWNlO1xyXG5cclxuXHRzd2l0Y2ggKGNvbG9yU3BhY2UpIHtcclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5SR0I6IHtcclxuXHRcdFx0Y29uc3QgciA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgZyA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgYiA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XHJcblx0XHRcdHJldHVybiB7IHIsIGcsIGIgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5IU0I6IHtcclxuXHRcdFx0Y29uc3QgaCA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0Y29uc3QgcyA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0Y29uc3QgYiA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XHJcblx0XHRcdHJldHVybiB7IGgsIHMsIGIgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5DTVlLOiB7XHJcblx0XHRcdGNvbnN0IGMgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IG0gPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IHkgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IGsgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdHJldHVybiB7IGMsIG0sIHksIGsgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5MYWI6IHtcclxuXHRcdFx0Y29uc3QgbCA9IHJlYWRJbnQxNihyZWFkZXIpIC8gMTAwMDA7XHJcblx0XHRcdGNvbnN0IHRhID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IHRiID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGEgPSB0YSA8IDAgPyAodGEgLyAxMjgwMCkgOiAodGEgLyAxMjcwMCk7XHJcblx0XHRcdGNvbnN0IGIgPSB0YiA8IDAgPyAodGIgLyAxMjgwMCkgOiAodGIgLyAxMjcwMCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdFx0XHRyZXR1cm4geyBsLCBhLCBiIH07XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuR3JheXNjYWxlOiB7XHJcblx0XHRcdGNvbnN0IGsgPSByZWFkVWludDE2KHJlYWRlcikgKiAyNTUgLyAxMDAwMDtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XHJcblx0XHRcdHJldHVybiB7IGsgfTtcclxuXHRcdH1cclxuXHRcdGRlZmF1bHQ6XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciBzcGFjZScpO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQYXR0ZXJuKHJlYWRlcjogUHNkUmVhZGVyKTogUGF0dGVybkluZm8ge1xyXG5cdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gbGVuZ3RoXHJcblx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRpZiAodmVyc2lvbiAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBhdHRlcm4gdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRjb25zdCBjb2xvck1vZGUgPSByZWFkVWludDMyKHJlYWRlcikgYXMgQ29sb3JNb2RlO1xyXG5cdGNvbnN0IHggPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCB5ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblxyXG5cdC8vIHdlIG9ubHkgc3VwcG9ydCBSR0IgYW5kIGdyYXlzY2FsZSBmb3Igbm93XHJcblx0aWYgKGNvbG9yTW9kZSAhPT0gQ29sb3JNb2RlLlJHQiAmJiBjb2xvck1vZGUgIT09IENvbG9yTW9kZS5HcmF5c2NhbGUgJiYgY29sb3JNb2RlICE9PSBDb2xvck1vZGUuSW5kZXhlZCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwYXR0ZXJuIGNvbG9yIG1vZGU6ICR7Y29sb3JNb2RlfWApO1xyXG5cdH1cclxuXHJcblx0bGV0IG5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cdGNvbnN0IHBhbGV0dGU6IFJHQltdID0gW107XHJcblxyXG5cdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5JbmRleGVkKSB7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XHJcblx0XHRcdHBhbGV0dGUucHVzaCh7XHJcblx0XHRcdFx0cjogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdFx0ZzogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdFx0YjogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDQpOyAvLyBubyBpZGVhIHdoYXQgdGhpcyBpc1xyXG5cdH1cclxuXHJcblx0Ly8gdmlydHVhbCBtZW1vcnkgYXJyYXkgbGlzdFxyXG5cdGNvbnN0IHZlcnNpb24yID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uMiAhPT0gMykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBhdHRlcm4gVk1BTCB2ZXJzaW9uOiAke3ZlcnNpb24yfWApO1xyXG5cclxuXHRyZWFkVWludDMyKHJlYWRlcik7IC8vIGxlbmd0aFxyXG5cdGNvbnN0IHRvcCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBsZWZ0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGJvdHRvbSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCByaWdodCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBjaGFubmVsc0NvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xyXG5cdGNvbnN0IGhlaWdodCA9IGJvdHRvbSAtIHRvcDtcclxuXHRjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkod2lkdGggKiBoZWlnaHQgKiA0KTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDM7IGkgPCBkYXRhLmJ5dGVMZW5ndGg7IGkgKz0gNCkge1xyXG5cdFx0ZGF0YVtpXSA9IDI1NTtcclxuXHR9XHJcblxyXG5cdGZvciAobGV0IGkgPSAwLCBjaCA9IDA7IGkgPCAoY2hhbm5lbHNDb3VudCArIDIpOyBpKyspIHtcclxuXHRcdGNvbnN0IGhhcyA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGlmICghaGFzKSBjb250aW51ZTtcclxuXHJcblx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBwaXhlbERlcHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY3RvcCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNsZWZ0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY2JvdHRvbSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNyaWdodCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHBpeGVsRGVwdGgyID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29tcHJlc3Npb25Nb2RlID0gcmVhZFVpbnQ4KHJlYWRlcik7IC8vIDAgLSByYXcsIDEgLSB6aXBcclxuXHRcdGNvbnN0IGRhdGFMZW5ndGggPSBsZW5ndGggLSAoNCArIDE2ICsgMiArIDEpO1xyXG5cdFx0Y29uc3QgY2RhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBkYXRhTGVuZ3RoKTtcclxuXHJcblx0XHRpZiAocGl4ZWxEZXB0aCAhPT0gOCB8fCBwaXhlbERlcHRoMiAhPT0gOCkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJzE2Yml0IHBpeGVsIGRlcHRoIG5vdCBzdXBwb3J0ZWQgZm9yIHBhdHRlcm5zJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgdyA9IGNyaWdodCAtIGNsZWZ0O1xyXG5cdFx0Y29uc3QgaCA9IGNib3R0b20gLSBjdG9wO1xyXG5cdFx0Y29uc3Qgb3ggPSBjbGVmdCAtIGxlZnQ7XHJcblx0XHRjb25zdCBveSA9IGN0b3AgLSB0b3A7XHJcblxyXG5cdFx0aWYgKGNvbXByZXNzaW9uTW9kZSA9PT0gMCkge1xyXG5cdFx0XHRpZiAoY29sb3JNb2RlID09PSBDb2xvck1vZGUuUkdCICYmIGNoIDwgMykge1xyXG5cdFx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaDsgeSsrKSB7XHJcblx0XHRcdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHc7IHgrKykge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBzcmMgPSB4ICsgeSAqIHc7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGRzdCA9IChveCArIHggKyAoeSArIG95KSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgY2hdID0gY2RhdGFbc3JjXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUgJiYgY2ggPCAxKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoOyB5KyspIHtcclxuXHRcdFx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgdzsgeCsrKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHNyYyA9IHggKyB5ICogdztcclxuXHRcdFx0XHRcdFx0Y29uc3QgZHN0ID0gKG94ICsgeCArICh5ICsgb3kpICogd2lkdGgpICogNDtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBjZGF0YVtzcmNdO1xyXG5cdFx0XHRcdFx0XHRkYXRhW2RzdCArIDBdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgMV0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0ZGF0YVtkc3QgKyAyXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkluZGV4ZWQpIHtcclxuXHRcdFx0XHQvLyBUT0RPOlxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW5kZXhlZCBwYXR0ZXJuIGNvbG9yIG1vZGUgbm90IGltcGxlbWVudGVkJyk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb25Nb2RlID09PSAxKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHsgY29sb3JNb2RlIH0pO1xyXG5cdFx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ3ppcC5iaW4nLCBCdWZmZXIuZnJvbShjZGF0YSkpO1xyXG5cdFx0XHQvLyBjb25zdCBkYXRhID0gcmVxdWlyZSgnemxpYicpLmluZmxhdGVSYXdTeW5jKGNkYXRhKTtcclxuXHRcdFx0Ly8gY29uc3QgZGF0YSA9IHJlcXVpcmUoJ3psaWInKS51bnppcFN5bmMoY2RhdGEpO1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhkYXRhKTtcclxuXHRcdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdaaXAgY29tcHJlc3Npb24gbm90IHN1cHBvcnRlZCBmb3IgcGF0dGVybicpO1xyXG5cdFx0XHQvLyB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIHBhdHRlcm4gY29tcHJlc3Npb24nKTtcclxuXHRcdFx0Y29uc29sZS5lcnJvcignVW5zdXBwb3J0ZWQgcGF0dGVybiBjb21wcmVzc2lvbicpO1xyXG5cdFx0XHRuYW1lICs9ICcgKGZhaWxlZCB0byBkZWNvZGUpJztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwYXR0ZXJuIGNvbXByZXNzaW9uIG1vZGUnKTtcclxuXHRcdH1cclxuXHJcblx0XHRjaCsrO1xyXG5cdH1cclxuXHJcblx0Ly8gVE9ETzogdXNlIGNhbnZhcyBpbnN0ZWFkIG9mIGRhdGEgP1xyXG5cclxuXHRyZXR1cm4geyBpZCwgbmFtZSwgeCwgeSwgYm91bmRzOiB7IHg6IGxlZnQsIHk6IHRvcCwgdzogd2lkdGgsIGg6IGhlaWdodCB9LCBkYXRhIH07XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
