"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readColor = exports.readSection = exports.readDataRLE = exports.readPsd = exports.checkSignature = exports.skipBytes = exports.readAsciiString = exports.readUnicodeStringWithLength = exports.readUnicodeString = exports.readPascalString = exports.readSignature = exports.readBytes = exports.readFixedPointPath32 = exports.readFixedPoint32 = exports.readFloat64 = exports.readFloat32 = exports.readUint32 = exports.readInt32LE = exports.readInt32 = exports.readUint16 = exports.readInt16 = exports.peekUint8 = exports.readUint8 = exports.createReader = exports.supportedColorModes = void 0;
var helpers_1 = require("./helpers");
var additionalInfo_1 = require("./additionalInfo");
var imageResources_1 = require("./imageResources");
exports.supportedColorModes = [0 /* Bitmap */, 1 /* Grayscale */, 3 /* RGB */];
var colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];
var RAW_IMAGE_DATA = false;
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
    if (padTo === void 0) { padTo = 2; }
    var length = readUint8(reader);
    var text = readShortString(reader, length);
    while (++length % padTo) {
        skipBytes(reader, 1);
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
    /* istanbul ignore if */
    if (signature !== a && signature !== b) {
        throw new Error("Invalid signature: '" + signature + "' at 0x" + offset.toString(16));
    }
}
exports.checkSignature = checkSignature;
function readShortString(reader, length) {
    var buffer = readBytes(reader, length);
    return String.fromCharCode.apply(String, buffer);
}
function readPsd(reader, options) {
    var _a;
    if (options === void 0) { options = {}; }
    // header
    checkSignature(reader, '8BPS');
    var version = readUint16(reader);
    if (version !== 1)
        throw new Error("Invalid PSD file version: " + version);
    skipBytes(reader, 6);
    var channels = readUint16(reader);
    var height = readUint32(reader);
    var width = readUint32(reader);
    var bitsPerChannel = readUint16(reader);
    var colorMode = readUint16(reader);
    if (exports.supportedColorModes.indexOf(colorMode) === -1)
        throw new Error("Color mode not supported: " + ((_a = colorModes[colorMode]) !== null && _a !== void 0 ? _a : colorMode));
    var psd = { width: width, height: height, channels: channels, bitsPerChannel: bitsPerChannel, colorMode: colorMode };
    // color mode data
    readSection(reader, 1, function (left) {
        if (options.throwForMissingFeatures)
            throw new Error('Color mode data not supported');
        skipBytes(reader, left());
    });
    // image resources
    readSection(reader, 1, function (left) {
        var _loop_1 = function () {
            checkSignature(reader, '8BIM');
            var id = readUint16(reader);
            readPascalString(reader); // name
            readSection(reader, 2, function (left) {
                var handler = imageResources_1.resourceHandlersMap[id];
                var skip = id === 1036 && !!options.skipThumbnail;
                if (!psd.imageResources) {
                    psd.imageResources = {};
                }
                if (handler && !skip) {
                    try {
                        handler.read(reader, psd.imageResources, left, options);
                    }
                    catch (e) {
                        if (options.throwForMissingFeatures)
                            throw e;
                        skipBytes(reader, left());
                    }
                }
                else {
                    // console.log(`Unhandled image resource: ${id}`);
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
        globalAlpha = readLayerInfo(reader, psd, options);
        // SAI does not include this section
        if (left() > 0) {
            readGlobalLayerMaskInfo(reader);
        }
        else {
            // revert back to end of section if exceeded section limits
            // options.logMissingFeatures && console.log('reverting to end of section');
            skipBytes(reader, left());
        }
        while (left() > 0) {
            // sometimes there are empty bytes here
            while (left() && peekUint8(reader) === 0) {
                // options.logMissingFeatures && console.log('skipping 0 byte');
                skipBytes(reader, 1);
            }
            if (left() >= 12) {
                readAdditionalLayerInfo(reader, psd, psd, options);
            }
            else {
                // options.logMissingFeatures && console.log('skipping leftover bytes', left());
                skipBytes(reader, left());
            }
        }
    });
    var hasChildren = psd.children && psd.children.length;
    var skipComposite = options.skipCompositeImageData && (options.skipLayerImageData || hasChildren);
    if (!skipComposite) {
        readImageData(reader, psd, globalAlpha, options);
    }
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
        if (!psd.children) {
            psd.children = [];
        }
        var stack = [psd];
        for (var i = layers.length - 1; i >= 0; i--) {
            var l = layers[i];
            var type = l.sectionDivider ? l.sectionDivider.type : 0 /* Other */;
            if (type === 1 /* OpenFolder */ || type === 2 /* ClosedFolder */) {
                l.opened = type === 1 /* OpenFolder */;
                l.children = [];
                stack[stack.length - 1].children.unshift(l);
                stack.push(l);
            }
            else if (type === 3 /* BoundingSectionDivider */) {
                stack.pop();
            }
            else {
                stack[stack.length - 1].children.unshift(l);
            }
        }
    });
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
        var channelLength = readInt32(reader);
        channels.push({ id: channelID, length: channelLength });
    }
    checkSignature(reader, '8BIM');
    var blendMode = readSignature(reader);
    if (!helpers_1.toBlendMode[blendMode])
        throw new Error("Invalid blend mode: '" + blendMode + "'");
    layer.blendMode = helpers_1.toBlendMode[blendMode];
    layer.opacity = readUint8(reader) / 0xff;
    layer.clipping = readUint8(reader) === 1;
    var flags = readUint8(reader);
    layer.transparencyProtected = (flags & 0x01) !== 0;
    layer.hidden = (flags & 0x02) !== 0;
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
    var imageData;
    if (layerWidth && layerHeight) {
        imageData = helpers_1.createImageData(layerWidth, layerHeight);
        helpers_1.resetImageData(imageData);
    }
    if (RAW_IMAGE_DATA) {
        layer.imageDataRaw = [];
    }
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
                var maskData = helpers_1.createImageData(maskWidth, maskHeight);
                helpers_1.resetImageData(maskData);
                readData(reader, maskData, compression, maskWidth, maskHeight, 0);
                setupGrayscale(maskData);
                if (options.useImageData) {
                    mask.imageData = maskData;
                }
                else {
                    mask.canvas = helpers_1.createCanvas(maskWidth, maskHeight);
                    mask.canvas.getContext('2d').putImageData(maskData, 0, 0);
                }
            }
        }
        else {
            var offset = helpers_1.offsetForChannel(channel.id);
            var targetData = imageData;
            /* istanbul ignore if */
            if (offset < 0) {
                targetData = undefined;
                if (options.throwForMissingFeatures) {
                    throw new Error("Channel not supported: " + channel.id);
                }
            }
            var start = reader.offset;
            readData(reader, targetData, compression, layerWidth, layerHeight, offset);
            if (RAW_IMAGE_DATA) {
                layer.imageDataRaw[channel.id] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
            if (targetData && psd.colorMode === 1 /* Grayscale */) {
                setupGrayscale(targetData);
            }
        }
    }
    if (imageData) {
        if (options.useImageData) {
            layer.imageData = imageData;
        }
        else {
            layer.canvas = helpers_1.createCanvas(layerWidth, layerHeight);
            layer.canvas.getContext('2d').putImageData(imageData, 0, 0);
        }
    }
}
function readData(reader, data, compression, width, height, offset) {
    if (compression === 0 /* RawData */) {
        readDataRaw(reader, data, offset, width, height);
    }
    else if (compression === 1 /* RleCompressed */) {
        readDataRLE(reader, data, width, height, 4, [offset]);
    }
    else {
        throw new Error("Compression type not supported: " + compression);
    }
}
function readGlobalLayerMaskInfo(reader) {
    return readSection(reader, 1, function (left) {
        if (left()) {
            var overlayColorSpace = readUint16(reader);
            var colorSpace1 = readUint16(reader);
            var colorSpace2 = readUint16(reader);
            var colorSpace3 = readUint16(reader);
            var colorSpace4 = readUint16(reader);
            var opacity = readUint16(reader) / 0xff;
            var kind = readUint8(reader);
            skipBytes(reader, left());
            return { overlayColorSpace: overlayColorSpace, colorSpace1: colorSpace1, colorSpace2: colorSpace2, colorSpace3: colorSpace3, colorSpace4: colorSpace4, opacity: opacity, kind: kind };
        }
    });
}
function readAdditionalLayerInfo(reader, target, psd, options) {
    checkSignature(reader, '8BIM', '8B64');
    var key = readSignature(reader);
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
            options.logMissingFeatures && console.log("Unhandled additional info: " + key);
            skipBytes(reader, left());
        }
        if (left()) {
            options.logMissingFeatures && console.log("Unread " + left() + " bytes left for tag: " + key);
            skipBytes(reader, left());
        }
    }, false);
}
function readImageData(reader, psd, globalAlpha, options) {
    var compression = readUint16(reader);
    if (exports.supportedColorModes.indexOf(psd.colorMode) === -1)
        throw new Error("Color mode not supported: " + psd.colorMode);
    if (compression !== 0 /* RawData */ && compression !== 1 /* RleCompressed */)
        throw new Error("Compression type not supported: " + compression);
    var imageData = helpers_1.createImageData(psd.width, psd.height);
    helpers_1.resetImageData(imageData);
    if (psd.colorMode === 0 /* Bitmap */) {
        var bytes = void 0;
        if (compression === 0 /* RawData */) {
            bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
        }
        else if (compression === 1 /* RleCompressed */) {
            bytes = new Uint8Array(psd.width * psd.height);
            readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 1, [0]);
        }
        else {
            throw new Error("Bitmap compression not supported: " + compression);
        }
        helpers_1.decodeBitmap(bytes, imageData.data, psd.width, psd.height);
    }
    else {
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
                readDataRaw(reader, imageData, channels[i], psd.width, psd.height);
            }
        }
        else if (compression === 1 /* RleCompressed */) {
            var start = reader.offset;
            readDataRLE(reader, imageData, psd.width, psd.height, 4, channels);
            if (RAW_IMAGE_DATA) {
                psd.imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
        }
        if (psd.colorMode === 1 /* Grayscale */) {
            setupGrayscale(imageData);
        }
    }
    if (options.useImageData) {
        psd.imageData = imageData;
    }
    else {
        psd.canvas = helpers_1.createCanvas(psd.width, psd.height);
        psd.canvas.getContext('2d').putImageData(imageData, 0, 0);
    }
}
function readDataRaw(reader, pixelData, offset, width, height) {
    var size = width * height;
    var buffer = readBytes(reader, size);
    if (pixelData && offset < 4) {
        var data = pixelData.data;
        for (var i = 0, p = offset | 0; i < size; i++, p = (p + 4) | 0) {
            data[p] = buffer[i];
        }
    }
}
function readDataRLE(reader, pixelData, _width, height, step, offsets) {
    var lengths = new Uint16Array(offsets.length * height);
    var data = pixelData && pixelData.data;
    for (var o = 0, li = 0; o < offsets.length; o++) {
        for (var y = 0; y < height; y++, li++) {
            lengths[li] = readUint16(reader);
        }
    }
    for (var c = 0, li = 0; c < offsets.length; c++) {
        var offset = offsets[c] | 0;
        var extra = c > 3 || offset > 3;
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
                    if (header >= 128) {
                        var value = buffer[++i];
                        header = (256 - header) | 0;
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = value;
                            p = (p + step) | 0;
                        }
                    }
                    else { // header < 128
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = buffer[++i];
                            p = (p + step) | 0;
                        }
                    }
                    /* istanbul ignore if */
                    if (i >= length_1) {
                        throw new Error("Invalid RLE data: exceeded buffer size " + i + "/" + length_1);
                    }
                }
            }
        }
    }
}
exports.readDataRLE = readDataRLE;
function readSection(reader, round, func, skipEmpty) {
    if (skipEmpty === void 0) { skipEmpty = true; }
    var length = readInt32(reader);
    if (length <= 0 && skipEmpty)
        return undefined;
    var end = reader.offset + length;
    var result = func(function () { return end - reader.offset; });
    /* istanbul ignore if */
    if (reader.offset > end)
        throw new Error('Exceeded section limits');
    /* istanbul ignore if */
    if (reader.offset !== end)
        throw new Error("Unread section data: " + (end - reader.offset) + " bytes at 0x" + reader.offset.toString(16));
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
        case 7 /* Lab */: {
            var l = readInt16(reader) / 100;
            var a = readInt16(reader) / 100;
            var b = readInt16(reader) / 100;
            skipBytes(reader, 2);
            return { l: l, a: a, b: b };
        }
        case 2 /* CMYK */: {
            var c = readInt16(reader);
            var m = readInt16(reader);
            var y = readInt16(reader);
            var k = readInt16(reader);
            return { c: c, m: m, y: y, k: k };
        }
        case 8 /* Grayscale */: {
            var k = readInt16(reader);
            skipBytes(reader, 6);
            return { k: k };
        }
        case 1 /* HSB */: {
            var h = readInt16(reader);
            var s = readInt16(reader);
            var b = readInt16(reader);
            skipBytes(reader, 2);
            return { h: h, s: s, b: b };
        }
        default:
            throw new Error('Invalid color space');
    }
}
exports.readColor = readColor;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LE1BQU0sQ0FBQyxDQUFDO1lBQzVCLElBQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1QixJQUFNLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDNUIsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQixPQUFPLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQztTQUNuQjtRQUNEO1lBQ0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0tBQ3hDO0FBQ0YsQ0FBQztBQXhDRCw4QkF3Q0MiLCJmaWxlIjoicHNkUmVhZGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHNkLCBMYXllciwgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIExheWVyQWRkaXRpb25hbEluZm8sIFJlYWRPcHRpb25zLCBMYXllck1hc2tEYXRhLCBDb2xvciB9IGZyb20gJy4vcHNkJztcbmltcG9ydCB7XG5cdHJlc2V0SW1hZ2VEYXRhLCBvZmZzZXRGb3JDaGFubmVsLCBkZWNvZGVCaXRtYXAsIFBpeGVsRGF0YSwgY3JlYXRlQ2FudmFzLCBjcmVhdGVJbWFnZURhdGEsXG5cdHRvQmxlbmRNb2RlLCBDaGFubmVsSUQsIENvbXByZXNzaW9uLCBMYXllck1hc2tGbGFncywgTWFza1BhcmFtcywgQ29sb3JTcGFjZVxufSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHsgaW5mb0hhbmRsZXJzTWFwIH0gZnJvbSAnLi9hZGRpdGlvbmFsSW5mbyc7XG5pbXBvcnQgeyByZXNvdXJjZUhhbmRsZXJzTWFwIH0gZnJvbSAnLi9pbWFnZVJlc291cmNlcyc7XG5cbmludGVyZmFjZSBDaGFubmVsSW5mbyB7XG5cdGlkOiBDaGFubmVsSUQ7XG5cdGxlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3Qgc3VwcG9ydGVkQ29sb3JNb2RlcyA9IFtDb2xvck1vZGUuQml0bWFwLCBDb2xvck1vZGUuR3JheXNjYWxlLCBDb2xvck1vZGUuUkdCXTtcbmNvbnN0IGNvbG9yTW9kZXMgPSBbJ2JpdG1hcCcsICdncmF5c2NhbGUnLCAnaW5kZXhlZCcsICdSR0InLCAnQ01ZSycsICdtdWx0aWNoYW5uZWwnLCAnZHVvdG9uZScsICdsYWInXTtcblxuY29uc3QgUkFXX0lNQUdFX0RBVEEgPSBmYWxzZTtcblxuZnVuY3Rpb24gc2V0dXBHcmF5c2NhbGUoZGF0YTogUGl4ZWxEYXRhKSB7XG5cdGNvbnN0IHNpemUgPSBkYXRhLndpZHRoICogZGF0YS5oZWlnaHQgKiA0O1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSArPSA0KSB7XG5cdFx0ZGF0YS5kYXRhW2kgKyAxXSA9IGRhdGEuZGF0YVtpXTtcblx0XHRkYXRhLmRhdGFbaSArIDJdID0gZGF0YS5kYXRhW2ldO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHNkUmVhZGVyIHtcblx0b2Zmc2V0OiBudW1iZXI7XG5cdHZpZXc6IERhdGFWaWV3O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVhZGVyKGJ1ZmZlcjogQXJyYXlCdWZmZXIsIG9mZnNldD86IG51bWJlciwgbGVuZ3RoPzogbnVtYmVyKTogUHNkUmVhZGVyIHtcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoKTtcblx0cmV0dXJuIHsgdmlldywgb2Zmc2V0OiAwIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkVWludDgocmVhZGVyOiBQc2RSZWFkZXIpIHtcblx0cmVhZGVyLm9mZnNldCArPSAxO1xuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDgocmVhZGVyLm9mZnNldCAtIDEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGVla1VpbnQ4KHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQxNihyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IDI7XG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQxNihyZWFkZXIub2Zmc2V0IC0gMiwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQxNihyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IDI7XG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MTYocmVhZGVyLm9mZnNldCAtIDIsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IDQ7XG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQzMihyZWFkZXIub2Zmc2V0IC0gNCwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEludDMyTEUocmVhZGVyOiBQc2RSZWFkZXIpIHtcblx0cmVhZGVyLm9mZnNldCArPSA0O1xuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0SW50MzIocmVhZGVyLm9mZnNldCAtIDQsIHRydWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IDQ7XG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGbG9hdDMyKHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEZsb2F0MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGbG9hdDY0KHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdHJlYWRlci5vZmZzZXQgKz0gODtcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEZsb2F0NjQocmVhZGVyLm9mZnNldCAtIDgsIGZhbHNlKTtcbn1cblxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciAxNi4xNlxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50MzIocmVhZGVyOiBQc2RSZWFkZXIpOiBudW1iZXIge1xuXHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcikgLyAoMSA8PCAxNik7XG59XG5cbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcjogUHNkUmVhZGVyKTogbnVtYmVyIHtcblx0cmV0dXJuIHJlYWRJbnQzMihyZWFkZXIpIC8gKDEgPDwgMjQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEJ5dGVzKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IGxlbmd0aDtcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHJlYWRlci5vZmZzZXQgLSBsZW5ndGgsIGxlbmd0aCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkU2lnbmF0dXJlKHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdHJldHVybiByZWFkU2hvcnRTdHJpbmcocmVhZGVyLCA0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIHBhZFRvID0gMikge1xuXHRsZXQgbGVuZ3RoID0gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdGNvbnN0IHRleHQgPSByZWFkU2hvcnRTdHJpbmcocmVhZGVyLCBsZW5ndGgpO1xuXG5cdHdoaWxlICgrK2xlbmd0aCAlIHBhZFRvKSB7XG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMSk7XG5cdH1cblxuXHRyZXR1cm4gdGV4dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdGNvbnN0IGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0cmV0dXJuIHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aChyZWFkZXIsIGxlbmd0aCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkVW5pY29kZVN0cmluZ1dpdGhMZW5ndGgocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XG5cdGxldCB0ZXh0ID0gJyc7XG5cblx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0XHRpZiAodmFsdWUgfHwgbGVuZ3RoID4gMCkgeyAvLyByZW1vdmUgdHJhaWxpbmcgXFwwXG5cdFx0XHR0ZXh0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0ZXh0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFzY2lpU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xuXHRsZXQgdGV4dCA9ICcnO1xuXG5cdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdHRleHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShyZWFkVWludDgocmVhZGVyKSk7XG5cdH1cblxuXHRyZXR1cm4gdGV4dDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNraXBCeXRlcyhyZWFkZXI6IFBzZFJlYWRlciwgY291bnQ6IG51bWJlcikge1xuXHRyZWFkZXIub2Zmc2V0ICs9IGNvdW50O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tTaWduYXR1cmUocmVhZGVyOiBQc2RSZWFkZXIsIGE6IHN0cmluZywgYj86IHN0cmluZykge1xuXHRjb25zdCBvZmZzZXQgPSByZWFkZXIub2Zmc2V0O1xuXHRjb25zdCBzaWduYXR1cmUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XG5cblx0LyogaXN0YW5idWwgaWdub3JlIGlmICovXG5cdGlmIChzaWduYXR1cmUgIT09IGEgJiYgc2lnbmF0dXJlICE9PSBiKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnbmF0dXJlfScgYXQgMHgke29mZnNldC50b1N0cmluZygxNil9YCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVhZFNob3J0U3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xuXHRjb25zdCBidWZmZXI6IGFueSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XG5cdHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLmJ1ZmZlcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKHJlYWRlcjogUHNkUmVhZGVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucyA9IHt9KSB7XG5cdC8vIGhlYWRlclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QlBTJyk7XG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XG5cdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUFNEIGZpbGUgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdHNraXBCeXRlcyhyZWFkZXIsIDYpO1xuXHRjb25zdCBjaGFubmVscyA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0Y29uc3QgaGVpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRjb25zdCB3aWR0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0Y29uc3QgYml0c1BlckNoYW5uZWwgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdGNvbnN0IGNvbG9yTW9kZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcblxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKGNvbG9yTW9kZSkgPT09IC0xKVxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke2NvbG9yTW9kZXNbY29sb3JNb2RlXSA/PyBjb2xvck1vZGV9YCk7XG5cblx0Y29uc3QgcHNkOiBQc2QgPSB7IHdpZHRoLCBoZWlnaHQsIGNoYW5uZWxzLCBiaXRzUGVyQ2hhbm5lbCwgY29sb3JNb2RlIH07XG5cblx0Ly8gY29sb3IgbW9kZSBkYXRhXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XG5cdFx0aWYgKG9wdGlvbnMudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHRocm93IG5ldyBFcnJvcignQ29sb3IgbW9kZSBkYXRhIG5vdCBzdXBwb3J0ZWQnKTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9KTtcblxuXHQvLyBpbWFnZSByZXNvdXJjZXNcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcblx0XHR3aGlsZSAobGVmdCgpKSB7XG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XG5cblx0XHRcdGNvbnN0IGlkID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdFx0cmVhZFBhc2NhbFN0cmluZyhyZWFkZXIpOyAvLyBuYW1lXG5cblx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZXIgPSByZXNvdXJjZUhhbmRsZXJzTWFwW2lkXTtcblx0XHRcdFx0Y29uc3Qgc2tpcCA9IGlkID09PSAxMDM2ICYmICEhb3B0aW9ucy5za2lwVGh1bWJuYWlsO1xuXG5cdFx0XHRcdGlmICghcHNkLmltYWdlUmVzb3VyY2VzKSB7XG5cdFx0XHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaGFuZGxlciAmJiAhc2tpcCkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRoYW5kbGVyLnJlYWQocmVhZGVyLCBwc2QuaW1hZ2VSZXNvdXJjZXMsIGxlZnQsIG9wdGlvbnMpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGlmIChvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBlO1xuXHRcdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coYFVuaGFuZGxlZCBpbWFnZSByZXNvdXJjZTogJHtpZH1gKTtcblx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIGxheWVyIGFuZCBtYXNrIGluZm9cblx0bGV0IGdsb2JhbEFscGhhID0gZmFsc2U7XG5cblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcblx0XHRnbG9iYWxBbHBoYSA9IHJlYWRMYXllckluZm8ocmVhZGVyLCBwc2QsIG9wdGlvbnMpO1xuXG5cdFx0Ly8gU0FJIGRvZXMgbm90IGluY2x1ZGUgdGhpcyBzZWN0aW9uXG5cdFx0aWYgKGxlZnQoKSA+IDApIHtcblx0XHRcdHJlYWRHbG9iYWxMYXllck1hc2tJbmZvKHJlYWRlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHJldmVydCBiYWNrIHRvIGVuZCBvZiBzZWN0aW9uIGlmIGV4Y2VlZGVkIHNlY3Rpb24gbGltaXRzXG5cdFx0XHQvLyBvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygncmV2ZXJ0aW5nIHRvIGVuZCBvZiBzZWN0aW9uJyk7XG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdH1cblxuXHRcdHdoaWxlIChsZWZ0KCkgPiAwKSB7XG5cdFx0XHQvLyBzb21ldGltZXMgdGhlcmUgYXJlIGVtcHR5IGJ5dGVzIGhlcmVcblx0XHRcdHdoaWxlIChsZWZ0KCkgJiYgcGVla1VpbnQ4KHJlYWRlcikgPT09IDApIHtcblx0XHRcdFx0Ly8gb3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ3NraXBwaW5nIDAgYnl0ZScpO1xuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAxKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxlZnQoKSA+PSAxMikge1xuXHRcdFx0XHRyZWFkQWRkaXRpb25hbExheWVySW5mbyhyZWFkZXIsIHBzZCwgcHNkLCBvcHRpb25zKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdza2lwcGluZyBsZWZ0b3ZlciBieXRlcycsIGxlZnQoKSk7XG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRjb25zdCBoYXNDaGlsZHJlbiA9IHBzZC5jaGlsZHJlbiAmJiBwc2QuY2hpbGRyZW4ubGVuZ3RoO1xuXHRjb25zdCBza2lwQ29tcG9zaXRlID0gb3B0aW9ucy5za2lwQ29tcG9zaXRlSW1hZ2VEYXRhICYmIChvcHRpb25zLnNraXBMYXllckltYWdlRGF0YSB8fCBoYXNDaGlsZHJlbik7XG5cblx0aWYgKCFza2lwQ29tcG9zaXRlKSB7XG5cdFx0cmVhZEltYWdlRGF0YShyZWFkZXIsIHBzZCwgZ2xvYmFsQWxwaGEsIG9wdGlvbnMpO1xuXHR9XG5cblx0cmV0dXJuIHBzZDtcbn1cblxuZnVuY3Rpb24gcmVhZExheWVySW5mbyhyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSB7XG5cdGxldCBnbG9iYWxBbHBoYSA9IGZhbHNlO1xuXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XG5cdFx0bGV0IGxheWVyQ291bnQgPSByZWFkSW50MTYocmVhZGVyKTtcblxuXHRcdGlmIChsYXllckNvdW50IDwgMCkge1xuXHRcdFx0Z2xvYmFsQWxwaGEgPSB0cnVlO1xuXHRcdFx0bGF5ZXJDb3VudCA9IC1sYXllckNvdW50O1xuXHRcdH1cblxuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGxheWVyQ2hhbm5lbHM6IENoYW5uZWxJbmZvW11bXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcblx0XHRcdGNvbnN0IHsgbGF5ZXIsIGNoYW5uZWxzIH0gPSByZWFkTGF5ZXJSZWNvcmQocmVhZGVyLCBwc2QsIG9wdGlvbnMpO1xuXHRcdFx0bGF5ZXJzLnB1c2gobGF5ZXIpO1xuXHRcdFx0bGF5ZXJDaGFubmVscy5wdXNoKGNoYW5uZWxzKTtcblx0XHR9XG5cblx0XHRpZiAoIW9wdGlvbnMuc2tpcExheWVySW1hZ2VEYXRhKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxheWVyQ291bnQ7IGkrKykge1xuXHRcdFx0XHRyZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKHJlYWRlciwgcHNkLCBsYXllcnNbaV0sIGxheWVyQ2hhbm5lbHNbaV0sIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cblx0XHRpZiAoIXBzZC5jaGlsZHJlbikge1xuXHRcdFx0cHNkLmNoaWxkcmVuID0gW107XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhY2s6IChMYXllciB8IFBzZClbXSA9IFtwc2RdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IGxheWVycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgbCA9IGxheWVyc1tpXTtcblx0XHRcdGNvbnN0IHR5cGUgPSBsLnNlY3Rpb25EaXZpZGVyID8gbC5zZWN0aW9uRGl2aWRlci50eXBlIDogU2VjdGlvbkRpdmlkZXJUeXBlLk90aGVyO1xuXG5cdFx0XHRpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXIgfHwgdHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkNsb3NlZEZvbGRlcikge1xuXHRcdFx0XHRsLm9wZW5lZCA9IHR5cGUgPT09IFNlY3Rpb25EaXZpZGVyVHlwZS5PcGVuRm9sZGVyO1xuXHRcdFx0XHRsLmNoaWxkcmVuID0gW107XG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xuXHRcdFx0XHRzdGFjay5wdXNoKGwpO1xuXHRcdFx0fSBlbHNlIGlmICh0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuQm91bmRpbmdTZWN0aW9uRGl2aWRlcikge1xuXHRcdFx0XHRzdGFjay5wb3AoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIGdsb2JhbEFscGhhO1xufVxuXG5mdW5jdGlvbiByZWFkTGF5ZXJSZWNvcmQocmVhZGVyOiBQc2RSZWFkZXIsIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9ucykge1xuXHRjb25zdCBsYXllcjogTGF5ZXIgPSB7fTtcblx0bGF5ZXIudG9wID0gcmVhZEludDMyKHJlYWRlcik7XG5cdGxheWVyLmxlZnQgPSByZWFkSW50MzIocmVhZGVyKTtcblx0bGF5ZXIuYm90dG9tID0gcmVhZEludDMyKHJlYWRlcik7XG5cdGxheWVyLnJpZ2h0ID0gcmVhZEludDMyKHJlYWRlcik7XG5cblx0Y29uc3QgY2hhbm5lbENvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRjb25zdCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSA9IFtdO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbENvdW50OyBpKyspIHtcblx0XHRjb25zdCBjaGFubmVsSUQgPSByZWFkSW50MTYocmVhZGVyKSBhcyBDaGFubmVsSUQ7XG5cdFx0Y29uc3QgY2hhbm5lbExlbmd0aCA9IHJlYWRJbnQzMihyZWFkZXIpO1xuXHRcdGNoYW5uZWxzLnB1c2goeyBpZDogY2hhbm5lbElELCBsZW5ndGg6IGNoYW5uZWxMZW5ndGggfSk7XG5cdH1cblxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XG5cdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcblx0aWYgKCF0b0JsZW5kTW9kZVtibGVuZE1vZGVdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYmxlbmQgbW9kZTogJyR7YmxlbmRNb2RlfSdgKTtcblx0bGF5ZXIuYmxlbmRNb2RlID0gdG9CbGVuZE1vZGVbYmxlbmRNb2RlXTtcblxuXHRsYXllci5vcGFjaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xuXHRsYXllci5jbGlwcGluZyA9IHJlYWRVaW50OChyZWFkZXIpID09PSAxO1xuXG5cdGNvbnN0IGZsYWdzID0gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdGxheWVyLnRyYW5zcGFyZW5jeVByb3RlY3RlZCA9IChmbGFncyAmIDB4MDEpICE9PSAwO1xuXHRsYXllci5oaWRkZW4gPSAoZmxhZ3MgJiAweDAyKSAhPT0gMDtcblxuXHRza2lwQnl0ZXMocmVhZGVyLCAxKTtcblxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xuXHRcdGNvbnN0IG1hc2sgPSByZWFkTGF5ZXJNYXNrRGF0YShyZWFkZXIsIG9wdGlvbnMpO1xuXG5cdFx0aWYgKG1hc2spIGxheWVyLm1hc2sgPSBtYXNrO1xuXG5cdFx0Lypjb25zdCBibGVuZGluZ1JhbmdlcyA9Ki8gcmVhZExheWVyQmxlbmRpbmdSYW5nZXMocmVhZGVyKTtcblx0XHRsYXllci5uYW1lID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDQpO1xuXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xuXHRcdFx0cmVhZEFkZGl0aW9uYWxMYXllckluZm8ocmVhZGVyLCBsYXllciwgcHNkLCBvcHRpb25zKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiB7IGxheWVyLCBjaGFubmVscyB9O1xufVxuXG5mdW5jdGlvbiByZWFkTGF5ZXJNYXNrRGF0YShyZWFkZXI6IFBzZFJlYWRlciwgb3B0aW9uczogUmVhZE9wdGlvbnMpIHtcblx0cmV0dXJuIHJlYWRTZWN0aW9uPExheWVyTWFza0RhdGEgfCB1bmRlZmluZWQ+KHJlYWRlciwgMSwgbGVmdCA9PiB7XG5cdFx0aWYgKCFsZWZ0KCkpIHJldHVybiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBtYXNrOiBMYXllck1hc2tEYXRhID0ge307XG5cdFx0bWFzay50b3AgPSByZWFkSW50MzIocmVhZGVyKTtcblx0XHRtYXNrLmxlZnQgPSByZWFkSW50MzIocmVhZGVyKTtcblx0XHRtYXNrLmJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xuXHRcdG1hc2sucmlnaHQgPSByZWFkSW50MzIocmVhZGVyKTtcblx0XHRtYXNrLmRlZmF1bHRDb2xvciA9IHJlYWRVaW50OChyZWFkZXIpO1xuXG5cdFx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcblx0XHRtYXNrLnBvc2l0aW9uUmVsYXRpdmVUb0xheWVyID0gKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuUG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIpICE9PSAwO1xuXHRcdG1hc2suZGlzYWJsZWQgPSAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5MYXllck1hc2tEaXNhYmxlZCkgIT09IDA7XG5cblx0XHRpZiAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5NYXNrSGFzUGFyYW1ldGVyc0FwcGxpZWRUb0l0KSB7XG5cdFx0XHRjb25zdCBwYXJhbXMgPSByZWFkVWludDgocmVhZGVyKTtcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eSkgbWFzay51c2VyTWFza0RlbnNpdHkgPSByZWFkVWludDgocmVhZGVyKSAvIDB4ZmY7XG5cdFx0XHRpZiAocGFyYW1zICYgTWFza1BhcmFtcy5Vc2VyTWFza0ZlYXRoZXIpIG1hc2sudXNlck1hc2tGZWF0aGVyID0gcmVhZEZsb2F0NjQocmVhZGVyKTtcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlZlY3Rvck1hc2tEZW5zaXR5KSBtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVmVjdG9yTWFza0ZlYXRoZXIpIG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xuXHRcdH1cblxuXHRcdGlmIChsZWZ0KCkgPiAyKSB7XG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIGV4dHJhIG1hc2sgcGFyYW1zJyk7XG5cdFx0XHQvLyBUT0RPOiBoYW5kbGUgdGhlc2UgdmFsdWVzXG5cdFx0XHQvKmNvbnN0IHJlYWxGbGFncyA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHQvKmNvbnN0IHJlYWxVc2VyTWFza0JhY2tncm91bmQgPSovIHJlYWRVaW50OChyZWFkZXIpO1xuXHRcdFx0Lypjb25zdCB0b3AyID0qLyByZWFkSW50MzIocmVhZGVyKTtcblx0XHRcdC8qY29uc3QgbGVmdDIgPSovIHJlYWRJbnQzMihyZWFkZXIpO1xuXHRcdFx0Lypjb25zdCBib3R0b20yID0qLyByZWFkSW50MzIocmVhZGVyKTtcblx0XHRcdC8qY29uc3QgcmlnaHQyID0qLyByZWFkSW50MzIocmVhZGVyKTtcblx0XHR9XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdHJldHVybiBtYXNrO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gcmVhZExheWVyQmxlbmRpbmdSYW5nZXMocmVhZGVyOiBQc2RSZWFkZXIpIHtcblx0cmV0dXJuIHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XG5cdFx0Y29uc3QgY29tcG9zaXRlR3JheUJsZW5kU291cmNlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdGNvbnN0IGNvbXBvc2l0ZUdyYXBoQmxlbmREZXN0aW5hdGlvblJhbmdlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdGNvbnN0IHJhbmdlcyA9IFtdO1xuXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xuXHRcdFx0Y29uc3Qgc291cmNlUmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRjb25zdCBkZXN0UmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRyYW5nZXMucHVzaCh7IHNvdXJjZVJhbmdlLCBkZXN0UmFuZ2UgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgY29tcG9zaXRlR3JheUJsZW5kU291cmNlLCBjb21wb3NpdGVHcmFwaEJsZW5kRGVzdGluYXRpb25SYW5nZSwgcmFuZ2VzIH07XG5cdH0pO1xufVxuXG5mdW5jdGlvbiByZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgbGF5ZXI6IExheWVyLCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSwgb3B0aW9uczogUmVhZE9wdGlvbnMpIHtcblx0Y29uc3QgbGF5ZXJXaWR0aCA9IChsYXllci5yaWdodCB8fCAwKSAtIChsYXllci5sZWZ0IHx8IDApO1xuXHRjb25zdCBsYXllckhlaWdodCA9IChsYXllci5ib3R0b20gfHwgMCkgLSAobGF5ZXIudG9wIHx8IDApO1xuXG5cdGxldCBpbWFnZURhdGE6IEltYWdlRGF0YSB8IHVuZGVmaW5lZDtcblxuXHRpZiAobGF5ZXJXaWR0aCAmJiBsYXllckhlaWdodCkge1xuXHRcdGltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShsYXllcldpZHRoLCBsYXllckhlaWdodCk7XG5cdFx0cmVzZXRJbWFnZURhdGEoaW1hZ2VEYXRhKTtcblx0fVxuXG5cdGlmIChSQVdfSU1BR0VfREFUQSkge1xuXHRcdChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IFtdO1xuXHR9XG5cblx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGNoYW5uZWxzKSB7XG5cdFx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29tcHJlc3Npb247XG5cblx0XHRpZiAoY2hhbm5lbC5pZCA9PT0gQ2hhbm5lbElELlVzZXJNYXNrKSB7XG5cdFx0XHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcblxuXHRcdFx0aWYgKCFtYXNrKSB0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgbGF5ZXIgbWFzayBkYXRhYCk7XG5cblx0XHRcdGNvbnN0IG1hc2tXaWR0aCA9IChtYXNrLnJpZ2h0IHx8IDApIC0gKG1hc2subGVmdCB8fCAwKTtcblx0XHRcdGNvbnN0IG1hc2tIZWlnaHQgPSAobWFzay5ib3R0b20gfHwgMCkgLSAobWFzay50b3AgfHwgMCk7XG5cblx0XHRcdGlmIChtYXNrV2lkdGggJiYgbWFza0hlaWdodCkge1xuXHRcdFx0XHRjb25zdCBtYXNrRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShtYXNrV2lkdGgsIG1hc2tIZWlnaHQpO1xuXHRcdFx0XHRyZXNldEltYWdlRGF0YShtYXNrRGF0YSk7XG5cdFx0XHRcdHJlYWREYXRhKHJlYWRlciwgbWFza0RhdGEsIGNvbXByZXNzaW9uLCBtYXNrV2lkdGgsIG1hc2tIZWlnaHQsIDApO1xuXHRcdFx0XHRzZXR1cEdyYXlzY2FsZShtYXNrRGF0YSk7XG5cblx0XHRcdFx0aWYgKG9wdGlvbnMudXNlSW1hZ2VEYXRhKSB7XG5cdFx0XHRcdFx0bWFzay5pbWFnZURhdGEgPSBtYXNrRGF0YTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtYXNrLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhtYXNrV2lkdGgsIG1hc2tIZWlnaHQpO1xuXHRcdFx0XHRcdG1hc2suY2FudmFzLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShtYXNrRGF0YSwgMCwgMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsLmlkKTtcblx0XHRcdGxldCB0YXJnZXREYXRhID0gaW1hZ2VEYXRhO1xuXG5cdFx0XHQvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cblx0XHRcdGlmIChvZmZzZXQgPCAwKSB7XG5cdFx0XHRcdHRhcmdldERhdGEgPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0aWYgKG9wdGlvbnMudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENoYW5uZWwgbm90IHN1cHBvcnRlZDogJHtjaGFubmVsLmlkfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXJ0ID0gcmVhZGVyLm9mZnNldDtcblx0XHRcdHJlYWREYXRhKHJlYWRlciwgdGFyZ2V0RGF0YSwgY29tcHJlc3Npb24sIGxheWVyV2lkdGgsIGxheWVySGVpZ2h0LCBvZmZzZXQpO1xuXG5cdFx0XHRpZiAoUkFXX0lNQUdFX0RBVEEpIHtcblx0XHRcdFx0KGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3W2NoYW5uZWwuaWRdID0gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgc3RhcnQsIHJlYWRlci5vZmZzZXQgLSBzdGFydCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0YXJnZXREYXRhICYmIHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUpIHtcblx0XHRcdFx0c2V0dXBHcmF5c2NhbGUodGFyZ2V0RGF0YSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKGltYWdlRGF0YSkge1xuXHRcdGlmIChvcHRpb25zLnVzZUltYWdlRGF0YSkge1xuXHRcdFx0bGF5ZXIuaW1hZ2VEYXRhID0gaW1hZ2VEYXRhO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYXllci5jYW52YXMgPSBjcmVhdGVDYW52YXMobGF5ZXJXaWR0aCwgbGF5ZXJIZWlnaHQpO1xuXHRcdFx0bGF5ZXIuY2FudmFzLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiByZWFkRGF0YShcblx0cmVhZGVyOiBQc2RSZWFkZXIsIGRhdGE6IEltYWdlRGF0YSB8IHVuZGVmaW5lZCwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcixcblx0b2Zmc2V0OiBudW1iZXJcbikge1xuXHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcblx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGRhdGEsIG9mZnNldCwgd2lkdGgsIGhlaWdodCk7XG5cdH0gZWxzZSBpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpIHtcblx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIDQsIFtvZmZzZXRdKTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbXByZXNzaW9uIHR5cGUgbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcblx0fVxufVxuXG5mdW5jdGlvbiByZWFkR2xvYmFsTGF5ZXJNYXNrSW5mbyhyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZXR1cm4gcmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcblx0XHRpZiAobGVmdCgpKSB7XG5cdFx0XHRjb25zdCBvdmVybGF5Q29sb3JTcGFjZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0XHRcdGNvbnN0IGNvbG9yU3BhY2UxID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgY29sb3JTcGFjZTIgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0XHRjb25zdCBjb2xvclNwYWNlMyA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0XHRcdGNvbnN0IGNvbG9yU3BhY2U0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmY7XG5cdFx0XHRjb25zdCBraW5kID0gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdFx0cmV0dXJuIHsgb3ZlcmxheUNvbG9yU3BhY2UsIGNvbG9yU3BhY2UxLCBjb2xvclNwYWNlMiwgY29sb3JTcGFjZTMsIGNvbG9yU3BhY2U0LCBvcGFjaXR5LCBraW5kIH07XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gcmVhZEFkZGl0aW9uYWxMYXllckluZm8ocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSB7XG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nLCAnOEI2NCcpO1xuXHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XG5cblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcblx0XHRjb25zdCBoYW5kbGVyID0gaW5mb0hhbmRsZXJzTWFwW2tleV07XG5cblx0XHRpZiAoaGFuZGxlcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aGFuZGxlci5yZWFkKHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBwc2QsIG9wdGlvbnMpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRpZiAob3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykgdGhyb3cgZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYFVuaGFuZGxlZCBhZGRpdGlvbmFsIGluZm86ICR7a2V5fWApO1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHR9XG5cblx0XHRpZiAobGVmdCgpKSB7XG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5yZWFkICR7bGVmdCgpfSBieXRlcyBsZWZ0IGZvciB0YWc6ICR7a2V5fWApO1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHR9XG5cdH0sIGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gcmVhZEltYWdlRGF0YShyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBSZWFkT3B0aW9ucykge1xuXHRjb25zdCBjb21wcmVzc2lvbiA9IHJlYWRVaW50MTYocmVhZGVyKSBhcyBDb21wcmVzc2lvbjtcblxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKHBzZC5jb2xvck1vZGUhKSA9PT0gLTEpXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb2xvciBtb2RlIG5vdCBzdXBwb3J0ZWQ6ICR7cHNkLmNvbG9yTW9kZX1gKTtcblxuXHRpZiAoY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJhd0RhdGEgJiYgY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb21wcmVzc2lvbiB0eXBlIG5vdCBzdXBwb3J0ZWQ6ICR7Y29tcHJlc3Npb259YCk7XG5cblx0Y29uc3QgaW1hZ2VEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XG5cdHJlc2V0SW1hZ2VEYXRhKGltYWdlRGF0YSk7XG5cblx0aWYgKHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5CaXRtYXApIHtcblx0XHRsZXQgYnl0ZXM6IFVpbnQ4QXJyYXk7XG5cblx0XHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcblx0XHRcdGJ5dGVzID0gcmVhZEJ5dGVzKHJlYWRlciwgTWF0aC5jZWlsKHBzZC53aWR0aCAvIDgpICogcHNkLmhlaWdodCk7XG5cdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xuXHRcdFx0Ynl0ZXMgPSBuZXcgVWludDhBcnJheShwc2Qud2lkdGggKiBwc2QuaGVpZ2h0KTtcblx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgeyBkYXRhOiBieXRlcywgd2lkdGg6IHBzZC53aWR0aCwgaGVpZ2h0OiBwc2QuaGVpZ2h0IH0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgMSwgWzBdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBCaXRtYXAgY29tcHJlc3Npb24gbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcblx0XHR9XG5cblx0XHRkZWNvZGVCaXRtYXAoYnl0ZXMsIGltYWdlRGF0YS5kYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IGNoYW5uZWxzID0gcHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSA/IFswXSA6IFswLCAxLCAyXTtcblxuXHRcdGlmIChwc2QuY2hhbm5lbHMgJiYgcHNkLmNoYW5uZWxzID4gMykge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDM7IGkgPCBwc2QuY2hhbm5lbHM7IGkrKykge1xuXHRcdFx0XHQvLyBUT0RPOiBzdG9yZSB0aGVzZSBjaGFubmVscyBpbiBhZGRpdGlvbmFsIGltYWdlIGRhdGFcblx0XHRcdFx0Y2hhbm5lbHMucHVzaChpKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGdsb2JhbEFscGhhKSB7XG5cdFx0XHRjaGFubmVscy5wdXNoKDMpO1xuXHRcdH1cblxuXHRcdGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmF3RGF0YSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGltYWdlRGF0YSwgY2hhbm5lbHNbaV0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xuXHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xuXHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBpbWFnZURhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgNCwgY2hhbm5lbHMpO1xuXG5cdFx0XHRpZiAoUkFXX0lNQUdFX0RBVEEpIHtcblx0XHRcdFx0KHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlKSB7XG5cdFx0XHRzZXR1cEdyYXlzY2FsZShpbWFnZURhdGEpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChvcHRpb25zLnVzZUltYWdlRGF0YSkge1xuXHRcdHBzZC5pbWFnZURhdGEgPSBpbWFnZURhdGE7XG5cdH0gZWxzZSB7XG5cdFx0cHNkLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xuXHRcdHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVhZERhdGFSYXcocmVhZGVyOiBQc2RSZWFkZXIsIHBpeGVsRGF0YTogUGl4ZWxEYXRhIHwgdW5kZWZpbmVkLCBvZmZzZXQ6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0Y29uc3Qgc2l6ZSA9IHdpZHRoICogaGVpZ2h0O1xuXHRjb25zdCBidWZmZXIgPSByZWFkQnl0ZXMocmVhZGVyLCBzaXplKTtcblxuXHRpZiAocGl4ZWxEYXRhICYmIG9mZnNldCA8IDQpIHtcblx0XHRjb25zdCBkYXRhID0gcGl4ZWxEYXRhLmRhdGE7XG5cblx0XHRmb3IgKGxldCBpID0gMCwgcCA9IG9mZnNldCB8IDA7IGkgPCBzaXplOyBpKyssIHAgPSAocCArIDQpIHwgMCkge1xuXHRcdFx0ZGF0YVtwXSA9IGJ1ZmZlcltpXTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWREYXRhUkxFKFxuXHRyZWFkZXI6IFBzZFJlYWRlciwgcGl4ZWxEYXRhOiBQaXhlbERhdGEgfCB1bmRlZmluZWQsIF93aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgc3RlcDogbnVtYmVyLCBvZmZzZXRzOiBudW1iZXJbXVxuKSB7XG5cdGNvbnN0IGxlbmd0aHMgPSBuZXcgVWludDE2QXJyYXkob2Zmc2V0cy5sZW5ndGggKiBoZWlnaHQpO1xuXHRjb25zdCBkYXRhID0gcGl4ZWxEYXRhICYmIHBpeGVsRGF0YS5kYXRhO1xuXG5cdGZvciAobGV0IG8gPSAwLCBsaSA9IDA7IG8gPCBvZmZzZXRzLmxlbmd0aDsgbysrKSB7XG5cdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xuXHRcdFx0bGVuZ3Roc1tsaV0gPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0fVxuXHR9XG5cblx0Zm9yIChsZXQgYyA9IDAsIGxpID0gMDsgYyA8IG9mZnNldHMubGVuZ3RoOyBjKyspIHtcblx0XHRjb25zdCBvZmZzZXQgPSBvZmZzZXRzW2NdIHwgMDtcblx0XHRjb25zdCBleHRyYSA9IGMgPiAzIHx8IG9mZnNldCA+IDM7XG5cblx0XHRpZiAoIWRhdGEgfHwgZXh0cmEpIHtcblx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyssIGxpKyspIHtcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVuZ3Roc1tsaV0pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmb3IgKGxldCB5ID0gMCwgcCA9IG9mZnNldCB8IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xuXHRcdFx0XHRjb25zdCBsZW5ndGggPSBsZW5ndGhzW2xpXTtcblx0XHRcdFx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0bGV0IGhlYWRlciA9IGJ1ZmZlcltpXTtcblxuXHRcdFx0XHRcdGlmIChoZWFkZXIgPj0gMTI4KSB7XG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGJ1ZmZlclsrK2ldO1xuXHRcdFx0XHRcdFx0aGVhZGVyID0gKDI1NiAtIGhlYWRlcikgfCAwO1xuXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8PSBoZWFkZXI7IGogPSAoaiArIDEpIHwgMCkge1xuXHRcdFx0XHRcdFx0XHRkYXRhW3BdID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIHN0ZXApIHwgMDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgeyAvLyBoZWFkZXIgPCAxMjhcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDw9IGhlYWRlcjsgaiA9IChqICsgMSkgfCAwKSB7XG5cdFx0XHRcdFx0XHRcdGRhdGFbcF0gPSBidWZmZXJbKytpXTtcblx0XHRcdFx0XHRcdFx0cCA9IChwICsgc3RlcCkgfCAwO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuXHRcdFx0XHRcdGlmIChpID49IGxlbmd0aCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFJMRSBkYXRhOiBleGNlZWRlZCBidWZmZXIgc2l6ZSAke2l9LyR7bGVuZ3RofWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNlY3Rpb248VD4ocmVhZGVyOiBQc2RSZWFkZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6IChsZWZ0OiAoKSA9PiBudW1iZXIpID0+IFQsIHNraXBFbXB0eSA9IHRydWUpOiBUIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgbGVuZ3RoID0gcmVhZEludDMyKHJlYWRlcik7XG5cblx0aWYgKGxlbmd0aCA8PSAwICYmIHNraXBFbXB0eSkgcmV0dXJuIHVuZGVmaW5lZDtcblxuXHRsZXQgZW5kID0gcmVhZGVyLm9mZnNldCArIGxlbmd0aDtcblx0Y29uc3QgcmVzdWx0ID0gZnVuYygoKSA9PiBlbmQgLSByZWFkZXIub2Zmc2V0KTtcblxuXHQvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cblx0aWYgKHJlYWRlci5vZmZzZXQgPiBlbmQpXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdFeGNlZWRlZCBzZWN0aW9uIGxpbWl0cycpO1xuXG5cdC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuXHRpZiAocmVhZGVyLm9mZnNldCAhPT0gZW5kKVxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5yZWFkIHNlY3Rpb24gZGF0YTogJHtlbmQgLSByZWFkZXIub2Zmc2V0fSBieXRlcyBhdCAweCR7cmVhZGVyLm9mZnNldC50b1N0cmluZygxNil9YCk7XG5cblx0d2hpbGUgKGVuZCAlIHJvdW5kKSBlbmQrKztcblxuXHRyZWFkZXIub2Zmc2V0ID0gZW5kO1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVhZENvbG9yKHJlYWRlcjogUHNkUmVhZGVyKTogQ29sb3Ige1xuXHRjb25zdCBjb2xvclNwYWNlID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbG9yU3BhY2U7XG5cblx0c3dpdGNoIChjb2xvclNwYWNlKSB7XG5cdFx0Y2FzZSBDb2xvclNwYWNlLlJHQjoge1xuXHRcdFx0Y29uc3QgciA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1Nztcblx0XHRcdGNvbnN0IGcgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XG5cdFx0XHRjb25zdCBiID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XG5cdFx0XHRyZXR1cm4geyByLCBnLCBiIH07XG5cdFx0fVxuXHRcdGNhc2UgQ29sb3JTcGFjZS5MYWI6IHtcblx0XHRcdGNvbnN0IGwgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDtcblx0XHRcdGNvbnN0IGEgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDtcblx0XHRcdGNvbnN0IGIgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDtcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xuXHRcdFx0cmV0dXJuIHsgbCwgYSwgYiB9O1xuXHRcdH1cblx0XHRjYXNlIENvbG9yU3BhY2UuQ01ZSzoge1xuXHRcdFx0Y29uc3QgYyA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbSA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgeSA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgayA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0cmV0dXJuIHsgYywgbSwgeSwgayB9O1xuXHRcdH1cblx0XHRjYXNlIENvbG9yU3BhY2UuR3JheXNjYWxlOiB7XG5cdFx0XHRjb25zdCBrID0gcmVhZEludDE2KHJlYWRlcik7XG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCA2KTtcblx0XHRcdHJldHVybiB7IGsgfTtcblx0XHR9XG5cdFx0Y2FzZSBDb2xvclNwYWNlLkhTQjoge1xuXHRcdFx0Y29uc3QgaCA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgcyA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgYiA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XG5cdFx0XHRyZXR1cm4geyBoLCBzLCBiIH07XG5cdFx0fVxuXHRcdGRlZmF1bHQ6XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29sb3Igc3BhY2UnKTtcblx0fVxufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
