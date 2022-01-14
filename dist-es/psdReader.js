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
import { resetImageData, offsetForChannel, decodeBitmap, createCanvas, createImageData, toBlendMode, RAW_IMAGE_DATA, largeAdditionalInfoKeys } from './helpers';
import { infoHandlersMap } from './additionalInfo';
import { resourceHandlersMap } from './imageResources';
export var supportedColorModes = [0 /* Bitmap */, 1 /* Grayscale */, 3 /* RGB */];
var colorModes = ['bitmap', 'grayscale', 'indexed', 'RGB', 'CMYK', 'multichannel', 'duotone', 'lab'];
function setupGrayscale(data) {
    var size = data.width * data.height * 4;
    for (var i = 0; i < size; i += 4) {
        data.data[i + 1] = data.data[i];
        data.data[i + 2] = data.data[i];
    }
}
export function createReader(buffer, offset, length) {
    var view = new DataView(buffer, offset, length);
    return { view: view, offset: 0 };
}
export function readUint8(reader) {
    reader.offset += 1;
    return reader.view.getUint8(reader.offset - 1);
}
export function peekUint8(reader) {
    return reader.view.getUint8(reader.offset);
}
export function readInt16(reader) {
    reader.offset += 2;
    return reader.view.getInt16(reader.offset - 2, false);
}
export function readUint16(reader) {
    reader.offset += 2;
    return reader.view.getUint16(reader.offset - 2, false);
}
export function readInt32(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, false);
}
export function readInt32LE(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, true);
}
export function readUint32(reader) {
    reader.offset += 4;
    return reader.view.getUint32(reader.offset - 4, false);
}
export function readFloat32(reader) {
    reader.offset += 4;
    return reader.view.getFloat32(reader.offset - 4, false);
}
export function readFloat64(reader) {
    reader.offset += 8;
    return reader.view.getFloat64(reader.offset - 8, false);
}
// 32-bit fixed-point number 16.16
export function readFixedPoint32(reader) {
    return readInt32(reader) / (1 << 16);
}
// 32-bit fixed-point number 8.24
export function readFixedPointPath32(reader) {
    return readInt32(reader) / (1 << 24);
}
export function readBytes(reader, length) {
    reader.offset += length;
    return new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset - length, length);
}
export function readSignature(reader) {
    return readShortString(reader, 4);
}
export function readPascalString(reader, padTo) {
    var length = readUint8(reader);
    var text = length ? readShortString(reader, length) : '';
    while (++length % padTo) {
        reader.offset++;
    }
    return text;
}
export function readUnicodeString(reader) {
    var length = readUint32(reader);
    return readUnicodeStringWithLength(reader, length);
}
export function readUnicodeStringWithLength(reader, length) {
    var text = '';
    while (length--) {
        var value = readUint16(reader);
        if (value || length > 0) { // remove trailing \0
            text += String.fromCharCode(value);
        }
    }
    return text;
}
export function readAsciiString(reader, length) {
    var text = '';
    while (length--) {
        text += String.fromCharCode(readUint8(reader));
    }
    return text;
}
export function skipBytes(reader, count) {
    reader.offset += count;
}
export function checkSignature(reader, a, b) {
    var offset = reader.offset;
    var signature = readSignature(reader);
    if (signature !== a && signature !== b) {
        throw new Error("Invalid signature: '" + signature + "' at 0x" + offset.toString(16));
    }
}
function readShortString(reader, length) {
    var buffer = readBytes(reader, length);
    var result = '';
    for (var i = 0; i < buffer.length; i++) {
        result += String.fromCharCode(buffer[i]);
    }
    return result;
}
export function readPsd(reader, options) {
    var _a;
    if (options === void 0) { options = {}; }
    // header
    checkSignature(reader, '8BPS');
    var version = readUint16(reader);
    if (version !== 1 && version !== 2)
        throw new Error("Invalid PSD file version: " + version);
    skipBytes(reader, 6);
    var channels = readUint16(reader);
    var height = readUint32(reader);
    var width = readUint32(reader);
    var bitsPerChannel = readUint16(reader);
    var colorMode = readUint16(reader);
    if (supportedColorModes.indexOf(colorMode) === -1)
        throw new Error("Color mode not supported: " + ((_a = colorModes[colorMode]) !== null && _a !== void 0 ? _a : colorMode));
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
                throw new Error("Invalid signature: '" + sig + "' at 0x" + (reader.offset - 4).toString(16));
            }
            var id = readUint16(reader);
            readPascalString(reader, 2); // name
            readSection(reader, 2, function (left) {
                var handler = resourceHandlersMap[id];
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
    if (!toBlendMode[blendMode])
        throw new Error("Invalid blend mode: '" + blendMode + "'");
    layer.blendMode = toBlendMode[blendMode];
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
            imageData = createImageData(layerWidth, layerHeight);
            resetImageData(imageData);
        }
    }
    if (RAW_IMAGE_DATA)
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
                var maskData = createImageData(maskWidth, maskHeight);
                resetImageData(maskData);
                var start = reader.offset;
                readData(reader, maskData, compression, maskWidth, maskHeight, 0, options.large, 4);
                if (RAW_IMAGE_DATA) {
                    layer.maskDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
                }
                setupGrayscale(maskData);
                if (options.useImageData) {
                    mask.imageData = maskData;
                }
                else {
                    mask.canvas = createCanvas(maskWidth, maskHeight);
                    mask.canvas.getContext('2d').putImageData(maskData, 0, 0);
                }
            }
        }
        else {
            var offset = offsetForChannel(channel.id, cmyk);
            var targetData = imageData;
            if (offset < 0) {
                targetData = undefined;
                if (options.throwForMissingFeatures) {
                    throw new Error("Channel not supported: " + channel.id);
                }
            }
            var start = reader.offset;
            readData(reader, targetData, compression, layerWidth, layerHeight, offset, options.large, cmyk ? 5 : 4);
            if (RAW_IMAGE_DATA) {
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
            imageData = createImageData(cmykData.width, cmykData.height);
            cmykToRgb(cmykData, imageData, false);
        }
        if (options.useImageData) {
            layer.imageData = imageData;
        }
        else {
            layer.canvas = createCanvas(layerWidth, layerHeight);
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
        throw new Error("Compression type not supported: " + compression);
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
        throw new Error("Invalid signature: '" + sig + "' at 0x" + (reader.offset - 4).toString(16));
    var key = readSignature(reader);
    // `largeAdditionalInfoKeys` fallback, because some keys don't have 8B64 signature even when they are 64bit
    var u64 = sig === '8B64' || (options.large && largeAdditionalInfoKeys.indexOf(key) !== -1);
    readSection(reader, 2, function (left) {
        var handler = infoHandlersMap[key];
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
            options.logMissingFeatures && console.log("Unread " + left() + " bytes left for additional info: " + key);
            skipBytes(reader, left());
        }
    }, false, u64);
}
function readImageData(reader, psd, globalAlpha, options) {
    var compression = readUint16(reader);
    if (supportedColorModes.indexOf(psd.colorMode) === -1)
        throw new Error("Color mode not supported: " + psd.colorMode);
    if (compression !== 0 /* RawData */ && compression !== 1 /* RleCompressed */)
        throw new Error("Compression type not supported: " + compression);
    var imageData = createImageData(psd.width, psd.height);
    resetImageData(imageData);
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
                throw new Error("Bitmap compression not supported: " + compression);
            }
            decodeBitmap(bytes, imageData.data, psd.width, psd.height);
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
                if (RAW_IMAGE_DATA)
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
                if (RAW_IMAGE_DATA)
                    psd.imageDataRaw = new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, reader.offset - start);
            }
            break;
        }
        default: throw new Error("Color mode not supported: " + psd.colorMode);
    }
    if (options.useImageData) {
        psd.imageData = imageData;
    }
    else {
        psd.canvas = createCanvas(psd.width, psd.height);
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
export function readDataRLE(reader, pixelData, _width, height, step, offsets, large) {
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
                        throw new Error("Invalid RLE data: exceeded buffer size " + i + "/" + length_1);
                    }
                }
            }
        }
    }
}
export function readSection(reader, round, func, skipEmpty, eightBytes) {
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
        throw new Error("Unread section data: " + (end - reader.offset) + " bytes at 0x" + reader.offset.toString(16));
    while (end % round)
        end++;
    reader.offset = end;
    return result;
}
export function readColor(reader) {
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
export function readPattern(reader) {
    readUint32(reader); // length
    var version = readUint32(reader);
    if (version !== 1)
        throw new Error("Invalid pattern version: " + version);
    var colorMode = readUint32(reader);
    var x = readInt16(reader);
    var y = readInt16(reader);
    // we only support RGB and grayscale for now
    if (colorMode !== 3 /* RGB */ && colorMode !== 1 /* Grayscale */ && colorMode !== 2 /* Indexed */) {
        throw new Error("Unsupported pattern color mode: " + colorMode);
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
        throw new Error("Invalid pattern VMAL version: " + version2);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxDQUFDO1lBQ2pELElBQUksSUFBSSxxQkFBcUIsQ0FBQztTQUM5QjthQUFNO1lBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1NBQ3BEO1FBRUQsRUFBRSxFQUFFLENBQUM7S0FDTDtJQUVELHFDQUFxQztJQUVyQyxPQUFPLEVBQUUsRUFBRSxJQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsQ0FBQyxHQUFBLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksTUFBQSxFQUFFLENBQUM7QUFDbkYsQ0FBQyIsImZpbGUiOiJwc2RSZWFkZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xyXG5cdFBzZCwgTGF5ZXIsIENvbG9yTW9kZSwgU2VjdGlvbkRpdmlkZXJUeXBlLCBMYXllckFkZGl0aW9uYWxJbmZvLCBSZWFkT3B0aW9ucywgTGF5ZXJNYXNrRGF0YSwgQ29sb3IsXHJcblx0UGF0dGVybkluZm8sIEdsb2JhbExheWVyTWFza0luZm8sIFJHQlxyXG59IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRyZXNldEltYWdlRGF0YSwgb2Zmc2V0Rm9yQ2hhbm5lbCwgZGVjb2RlQml0bWFwLCBQaXhlbERhdGEsIGNyZWF0ZUNhbnZhcywgY3JlYXRlSW1hZ2VEYXRhLFxyXG5cdHRvQmxlbmRNb2RlLCBDaGFubmVsSUQsIENvbXByZXNzaW9uLCBMYXllck1hc2tGbGFncywgTWFza1BhcmFtcywgQ29sb3JTcGFjZSwgUkFXX0lNQUdFX0RBVEEsIGxhcmdlQWRkaXRpb25hbEluZm9LZXlzXHJcbn0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHsgaW5mb0hhbmRsZXJzTWFwIH0gZnJvbSAnLi9hZGRpdGlvbmFsSW5mbyc7XHJcbmltcG9ydCB7IHJlc291cmNlSGFuZGxlcnNNYXAgfSBmcm9tICcuL2ltYWdlUmVzb3VyY2VzJztcclxuXHJcbmludGVyZmFjZSBDaGFubmVsSW5mbyB7XHJcblx0aWQ6IENoYW5uZWxJRDtcclxuXHRsZW5ndGg6IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIFJlYWRPcHRpb25zRXh0IGV4dGVuZHMgUmVhZE9wdGlvbnMge1xyXG5cdGxhcmdlOiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3Qgc3VwcG9ydGVkQ29sb3JNb2RlcyA9IFtDb2xvck1vZGUuQml0bWFwLCBDb2xvck1vZGUuR3JheXNjYWxlLCBDb2xvck1vZGUuUkdCXTtcclxuY29uc3QgY29sb3JNb2RlcyA9IFsnYml0bWFwJywgJ2dyYXlzY2FsZScsICdpbmRleGVkJywgJ1JHQicsICdDTVlLJywgJ211bHRpY2hhbm5lbCcsICdkdW90b25lJywgJ2xhYiddO1xyXG5cclxuZnVuY3Rpb24gc2V0dXBHcmF5c2NhbGUoZGF0YTogUGl4ZWxEYXRhKSB7XHJcblx0Y29uc3Qgc2l6ZSA9IGRhdGEud2lkdGggKiBkYXRhLmhlaWdodCAqIDQ7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSArPSA0KSB7XHJcblx0XHRkYXRhLmRhdGFbaSArIDFdID0gZGF0YS5kYXRhW2ldO1xyXG5cdFx0ZGF0YS5kYXRhW2kgKyAyXSA9IGRhdGEuZGF0YVtpXTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHNkUmVhZGVyIHtcclxuXHRvZmZzZXQ6IG51bWJlcjtcclxuXHR2aWV3OiBEYXRhVmlldztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlYWRlcihidWZmZXI6IEFycmF5QnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIsIGxlbmd0aD86IG51bWJlcik6IFBzZFJlYWRlciB7XHJcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoKTtcclxuXHRyZXR1cm4geyB2aWV3LCBvZmZzZXQ6IDAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVaW50OChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gMTtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDgocmVhZGVyLm9mZnNldCAtIDEpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGVla1VpbnQ4KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldFVpbnQ4KHJlYWRlci5vZmZzZXQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEludDE2KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAyO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQxNihyZWFkZXIub2Zmc2V0IC0gMiwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQxNihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gMjtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDE2KHJlYWRlci5vZmZzZXQgLSAyLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MzIocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDQ7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEludDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MzJMRShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0SW50MzIocmVhZGVyLm9mZnNldCAtIDQsIHRydWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRmxvYXQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0RmxvYXQzMihyZWFkZXIub2Zmc2V0IC0gNCwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZsb2F0NjQocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDg7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEZsb2F0NjQocmVhZGVyLm9mZnNldCAtIDgsIGZhbHNlKTtcclxufVxyXG5cclxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciAxNi4xNlxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXI6IFBzZFJlYWRlcik6IG51bWJlciB7XHJcblx0cmV0dXJuIHJlYWRJbnQzMihyZWFkZXIpIC8gKDEgPDwgMTYpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDguMjRcclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcjogUHNkUmVhZGVyKTogbnVtYmVyIHtcclxuXHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcikgLyAoMSA8PCAyNCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQnl0ZXMocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSBsZW5ndGg7XHJcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHJlYWRlci5vZmZzZXQgLSBsZW5ndGgsIGxlbmd0aCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkU2lnbmF0dXJlKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTaG9ydFN0cmluZyhyZWFkZXIsIDQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXI6IFBzZFJlYWRlciwgcGFkVG86IG51bWJlcikge1xyXG5cdGxldCBsZW5ndGggPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRjb25zdCB0ZXh0ID0gbGVuZ3RoID8gcmVhZFNob3J0U3RyaW5nKHJlYWRlciwgbGVuZ3RoKSA6ICcnO1xyXG5cclxuXHR3aGlsZSAoKytsZW5ndGggJSBwYWRUbykge1xyXG5cdFx0cmVhZGVyLm9mZnNldCsrO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVW5pY29kZVN0cmluZyhyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRyZXR1cm4gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlciwgbGVuZ3RoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aChyZWFkZXI6IFBzZFJlYWRlciwgbGVuZ3RoOiBudW1iZXIpIHtcclxuXHRsZXQgdGV4dCA9ICcnO1xyXG5cclxuXHR3aGlsZSAobGVuZ3RoLS0pIHtcclxuXHRcdGNvbnN0IHZhbHVlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdGlmICh2YWx1ZSB8fCBsZW5ndGggPiAwKSB7IC8vIHJlbW92ZSB0cmFpbGluZyBcXDBcclxuXHRcdFx0dGV4dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0ZXh0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFzY2lpU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGxldCB0ZXh0ID0gJyc7XHJcblxyXG5cdHdoaWxlIChsZW5ndGgtLSkge1xyXG5cdFx0dGV4dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHJlYWRVaW50OChyZWFkZXIpKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB0ZXh0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2tpcEJ5dGVzKHJlYWRlcjogUHNkUmVhZGVyLCBjb3VudDogbnVtYmVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSBjb3VudDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrU2lnbmF0dXJlKHJlYWRlcjogUHNkUmVhZGVyLCBhOiBzdHJpbmcsIGI/OiBzdHJpbmcpIHtcclxuXHRjb25zdCBvZmZzZXQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdGNvbnN0IHNpZ25hdHVyZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0aWYgKHNpZ25hdHVyZSAhPT0gYSAmJiBzaWduYXR1cmUgIT09IGIpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ25hdHVyZX0nIGF0IDB4JHtvZmZzZXQudG9TdHJpbmcoMTYpfWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZFNob3J0U3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0bGV0IHJlc3VsdCA9ICcnO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xyXG5cdFx0cmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmZmVyW2ldKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKHJlYWRlcjogUHNkUmVhZGVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucyA9IHt9KSB7XHJcblx0Ly8gaGVhZGVyXHJcblx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJQUycpO1xyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24gIT09IDEgJiYgdmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFBTRCBmaWxlIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XHJcblx0Y29uc3QgY2hhbm5lbHMgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgaGVpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHdpZHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGJpdHNQZXJDaGFubmVsID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGNvbG9yTW9kZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0aWYgKHN1cHBvcnRlZENvbG9yTW9kZXMuaW5kZXhPZihjb2xvck1vZGUpID09PSAtMSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke2NvbG9yTW9kZXNbY29sb3JNb2RlXSA/PyBjb2xvck1vZGV9YCk7XHJcblxyXG5cdGNvbnN0IHBzZDogUHNkID0geyB3aWR0aCwgaGVpZ2h0LCBjaGFubmVscywgYml0c1BlckNoYW5uZWwsIGNvbG9yTW9kZSB9O1xyXG5cdGNvbnN0IG9wdDogUmVhZE9wdGlvbnNFeHQgPSB7IC4uLm9wdGlvbnMsIGxhcmdlOiB2ZXJzaW9uID09PSAyIH07XHJcblxyXG5cdC8vIGNvbG9yIG1vZGUgZGF0YVxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAob3B0LnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yIG1vZGUgZGF0YSBub3Qgc3VwcG9ydGVkJyk7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBpbWFnZSByZXNvdXJjZXNcclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRjb25zdCBzaWcgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0XHRpZiAoc2lnICE9PSAnOEJJTScgJiYgc2lnICE9PSAnTWVTYScgJiYgc2lnICE9PSAnQWdIZycgJiYgc2lnICE9PSAnUEhVVCcgJiYgc2lnICE9PSAnRENTUicpIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzaWd9JyBhdCAweCR7KHJlYWRlci5vZmZzZXQgLSA0KS50b1N0cmluZygxNil9YCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGlkID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRyZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMik7IC8vIG5hbWVcclxuXHJcblx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IHJlc291cmNlSGFuZGxlcnNNYXBbaWRdO1xyXG5cdFx0XHRcdGNvbnN0IHNraXAgPSBpZCA9PT0gMTAzNiAmJiAhIW9wdC5za2lwVGh1bWJuYWlsO1xyXG5cclxuXHRcdFx0XHRpZiAoIXBzZC5pbWFnZVJlc291cmNlcykge1xyXG5cdFx0XHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaGFuZGxlciAmJiAhc2tpcCkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0aGFuZGxlci5yZWFkKHJlYWRlciwgcHNkLmltYWdlUmVzb3VyY2VzLCBsZWZ0LCBvcHQpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0XHRpZiAob3B0LnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBlO1xyXG5cdFx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5oYW5kbGVkIGltYWdlIHJlc291cmNlOiAke2lkfWApO1xyXG5cdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHQvLyBsYXllciBhbmQgbWFzayBpbmZvXHJcblx0bGV0IGdsb2JhbEFscGhhID0gZmFsc2U7XHJcblxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRnbG9iYWxBbHBoYSA9IHJlYWRMYXllckluZm8ocmVhZGVyLCBwc2QsIG9wdCk7XHJcblxyXG5cdFx0Ly8gU0FJIGRvZXMgbm90IGluY2x1ZGUgdGhpcyBzZWN0aW9uXHJcblx0XHRpZiAobGVmdCgpID4gMCkge1xyXG5cdFx0XHRjb25zdCBnbG9iYWxMYXllck1hc2tJbmZvID0gcmVhZEdsb2JhbExheWVyTWFza0luZm8ocmVhZGVyKTtcclxuXHRcdFx0aWYgKGdsb2JhbExheWVyTWFza0luZm8pIHBzZC5nbG9iYWxMYXllck1hc2tJbmZvID0gZ2xvYmFsTGF5ZXJNYXNrSW5mbztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIHJldmVydCBiYWNrIHRvIGVuZCBvZiBzZWN0aW9uIGlmIGV4Y2VlZGVkIHNlY3Rpb24gbGltaXRzXHJcblx0XHRcdC8vIG9wdC5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ3JldmVydGluZyB0byBlbmQgb2Ygc2VjdGlvbicpO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkgPiAwKSB7XHJcblx0XHRcdC8vIHNvbWV0aW1lcyB0aGVyZSBhcmUgZW1wdHkgYnl0ZXMgaGVyZVxyXG5cdFx0XHR3aGlsZSAobGVmdCgpICYmIHBlZWtVaW50OChyZWFkZXIpID09PSAwKSB7XHJcblx0XHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnc2tpcHBpbmcgMCBieXRlJyk7XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChsZWZ0KCkgPj0gMTIpIHtcclxuXHRcdFx0XHRyZWFkQWRkaXRpb25hbExheWVySW5mbyhyZWFkZXIsIHBzZCwgcHNkLCBvcHQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIG9wdC5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ3NraXBwaW5nIGxlZnRvdmVyIGJ5dGVzJywgbGVmdCgpKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSwgdW5kZWZpbmVkLCBvcHQubGFyZ2UpO1xyXG5cclxuXHRjb25zdCBoYXNDaGlsZHJlbiA9IHBzZC5jaGlsZHJlbiAmJiBwc2QuY2hpbGRyZW4ubGVuZ3RoO1xyXG5cdGNvbnN0IHNraXBDb21wb3NpdGUgPSBvcHQuc2tpcENvbXBvc2l0ZUltYWdlRGF0YSAmJiAob3B0LnNraXBMYXllckltYWdlRGF0YSB8fCBoYXNDaGlsZHJlbik7XHJcblxyXG5cdGlmICghc2tpcENvbXBvc2l0ZSkge1xyXG5cdFx0cmVhZEltYWdlRGF0YShyZWFkZXIsIHBzZCwgZ2xvYmFsQWxwaGEsIG9wdCk7XHJcblx0fVxyXG5cclxuXHQvLyBUT0RPOiBzaG93IGNvbnZlcnRlZCBjb2xvciBtb2RlIGluc3RlYWQgb2Ygb3JpZ2luYWwgUFNEIGZpbGUgY29sb3IgbW9kZVxyXG5cdC8vICAgICAgIGJ1dCBhZGQgb3B0aW9uIHRvIHByZXNlcnZlIGZpbGUgY29sb3IgbW9kZSAobmVlZCB0byByZXR1cm4gaW1hZ2UgZGF0YSBpbnN0ZWFkIG9mIGNhbnZhcyBpbiB0aGF0IGNhc2UpXHJcblx0Ly8gcHNkLmNvbG9yTW9kZSA9IENvbG9yTW9kZS5SR0I7IC8vIHdlIGNvbnZlcnQgYWxsIGNvbG9yIG1vZGVzIHRvIFJHQlxyXG5cclxuXHRyZXR1cm4gcHNkO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJJbmZvKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgb3B0aW9uczogUmVhZE9wdGlvbnNFeHQpIHtcclxuXHRsZXQgZ2xvYmFsQWxwaGEgPSBmYWxzZTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdGxldCBsYXllckNvdW50ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKGxheWVyQ291bnQgPCAwKSB7XHJcblx0XHRcdGdsb2JhbEFscGhhID0gdHJ1ZTtcclxuXHRcdFx0bGF5ZXJDb3VudCA9IC1sYXllckNvdW50O1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xyXG5cdFx0Y29uc3QgbGF5ZXJDaGFubmVsczogQ2hhbm5lbEluZm9bXVtdID0gW107XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcclxuXHRcdFx0Y29uc3QgeyBsYXllciwgY2hhbm5lbHMgfSA9IHJlYWRMYXllclJlY29yZChyZWFkZXIsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdGxheWVycy5wdXNoKGxheWVyKTtcclxuXHRcdFx0bGF5ZXJDaGFubmVscy5wdXNoKGNoYW5uZWxzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIW9wdGlvbnMuc2tpcExheWVySW1hZ2VEYXRhKSB7XHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJDb3VudDsgaSsrKSB7XHJcblx0XHRcdFx0cmVhZExheWVyQ2hhbm5lbEltYWdlRGF0YShyZWFkZXIsIHBzZCwgbGF5ZXJzW2ldLCBsYXllckNoYW5uZWxzW2ldLCBvcHRpb25zKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblxyXG5cdFx0aWYgKCFwc2QuY2hpbGRyZW4pIHBzZC5jaGlsZHJlbiA9IFtdO1xyXG5cclxuXHRcdGNvbnN0IHN0YWNrOiAoTGF5ZXIgfCBQc2QpW10gPSBbcHNkXTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gbGF5ZXJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcblx0XHRcdGNvbnN0IGwgPSBsYXllcnNbaV07XHJcblx0XHRcdGNvbnN0IHR5cGUgPSBsLnNlY3Rpb25EaXZpZGVyID8gbC5zZWN0aW9uRGl2aWRlci50eXBlIDogU2VjdGlvbkRpdmlkZXJUeXBlLk90aGVyO1xyXG5cdFx0XHRpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXIgfHwgdHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkNsb3NlZEZvbGRlcikge1xyXG5cdFx0XHRcdGwub3BlbmVkID0gdHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXI7XHJcblx0XHRcdFx0bC5jaGlsZHJlbiA9IFtdO1xyXG5cdFx0XHRcdGNvbnN0IHBhcmVudCA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xyXG5cdFx0XHRcdGlmIChwYXJlbnQgJiYgcGFyZW50Lm5hbWUpIHtcclxuXHRcdFx0XHRcdGwucGFyZW50UGF0aCA9IHBhcmVudC5uYW1lO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRzdGFja1tzdGFjay5sZW5ndGggLSAxXS5jaGlsZHJlbiEudW5zaGlmdChsKTtcclxuXHRcdFx0XHRzdGFjay5wdXNoKGwpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHR5cGUgPT09IFNlY3Rpb25EaXZpZGVyVHlwZS5Cb3VuZGluZ1NlY3Rpb25EaXZpZGVyKSB7XHJcblx0XHRcdFx0c3RhY2sucG9wKCk7XHJcblx0XHRcdFx0Ly8gdGhpcyB3YXMgd29ya2Fyb3VuZCBiZWNhdXNlIEkgZGlkbid0IGtub3cgd2hhdCBgbHNka2Agc2VjdGlvbiB3YXMsIG5vdyBpdCdzIHByb2JhYmx5IG5vdCBuZWVkZWQgYW55bW9yZVxyXG5cdFx0XHRcdC8vIH0gZWxzZSBpZiAobC5uYW1lID09PSAnPC9MYXllciBncm91cD4nICYmICFsLnNlY3Rpb25EaXZpZGVyICYmICFsLnRvcCAmJiAhbC5sZWZ0ICYmICFsLmJvdHRvbSAmJiAhbC5yaWdodCkge1xyXG5cdFx0XHRcdC8vIFx0Ly8gc29tZXRpbWVzIGxheWVyIGdyb3VwIHRlcm1pbmF0b3IgZG9lc24ndCBoYXZlIHNlY3Rpb25EaXZpZGVyLCBzbyB3ZSBqdXN0IGd1ZXNzIGhlcmUgKFBTIGJ1ZyA/KVxyXG5cdFx0XHRcdC8vIFx0c3RhY2sucG9wKCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XHJcblx0XHRcdFx0aWYgKHBhcmVudCAmJiBwYXJlbnQubmFtZSkge1xyXG5cdFx0XHRcdFx0bC5wYXJlbnRQYXRoID0gcGFyZW50Lm5hbWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSwgdW5kZWZpbmVkLCBvcHRpb25zLmxhcmdlKTtcclxuXHJcblx0cmV0dXJuIGdsb2JhbEFscGhhO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJSZWNvcmQocmVhZGVyOiBQc2RSZWFkZXIsIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGNvbnN0IGxheWVyOiBMYXllciA9IHt9O1xyXG5cdGxheWVyLnRvcCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGxheWVyLmxlZnQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRsYXllci5ib3R0b20gPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRsYXllci5yaWdodCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cclxuXHRjb25zdCBjaGFubmVsQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgY2hhbm5lbHM6IENoYW5uZWxJbmZvW10gPSBbXTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVsQ291bnQ7IGkrKykge1xyXG5cdFx0bGV0IGNoYW5uZWxJRCA9IHJlYWRJbnQxNihyZWFkZXIpIGFzIENoYW5uZWxJRDtcclxuXHRcdGxldCBjaGFubmVsTGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdGlmIChvcHRpb25zLmxhcmdlKSB7XHJcblx0XHRcdGlmIChjaGFubmVsTGVuZ3RoICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ1NpemVzIGxhcmdlciB0aGFuIDRHQiBhcmUgbm90IHN1cHBvcnRlZCcpO1xyXG5cdFx0XHRjaGFubmVsTGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNoYW5uZWxzLnB1c2goeyBpZDogY2hhbm5lbElELCBsZW5ndGg6IGNoYW5uZWxMZW5ndGggfSk7XHJcblx0fVxyXG5cclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0Y29uc3QgYmxlbmRNb2RlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdGlmICghdG9CbGVuZE1vZGVbYmxlbmRNb2RlXSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJsZW5kIG1vZGU6ICcke2JsZW5kTW9kZX0nYCk7XHJcblx0bGF5ZXIuYmxlbmRNb2RlID0gdG9CbGVuZE1vZGVbYmxlbmRNb2RlXTtcclxuXHJcblx0bGF5ZXIub3BhY2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRsYXllci5jbGlwcGluZyA9IHJlYWRVaW50OChyZWFkZXIpID09PSAxO1xyXG5cclxuXHRjb25zdCBmbGFncyA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdGxheWVyLnRyYW5zcGFyZW5jeVByb3RlY3RlZCA9IChmbGFncyAmIDB4MDEpICE9PSAwO1xyXG5cdGxheWVyLmhpZGRlbiA9IChmbGFncyAmIDB4MDIpICE9PSAwO1xyXG5cdC8vIDB4MDQgLSBvYnNvbGV0ZVxyXG5cdC8vIDB4MDggLSAxIGZvciBQaG90b3Nob3AgNS4wIGFuZCBsYXRlciwgdGVsbHMgaWYgYml0IDQgaGFzIHVzZWZ1bCBpbmZvcm1hdGlvblxyXG5cdC8vIDB4MTAgLSBwaXhlbCBkYXRhIGlycmVsZXZhbnQgdG8gYXBwZWFyYW5jZSBvZiBkb2N1bWVudFxyXG5cclxuXHRza2lwQnl0ZXMocmVhZGVyLCAxKTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGNvbnN0IG1hc2sgPSByZWFkTGF5ZXJNYXNrRGF0YShyZWFkZXIsIG9wdGlvbnMpO1xyXG5cdFx0aWYgKG1hc2spIGxheWVyLm1hc2sgPSBtYXNrO1xyXG5cclxuXHRcdC8qY29uc3QgYmxlbmRpbmdSYW5nZXMgPSovIHJlYWRMYXllckJsZW5kaW5nUmFuZ2VzKHJlYWRlcik7XHJcblx0XHRsYXllci5uYW1lID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDQpO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0cmVhZEFkZGl0aW9uYWxMYXllckluZm8ocmVhZGVyLCBsYXllciwgcHNkLCBvcHRpb25zKTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIHsgbGF5ZXIsIGNoYW5uZWxzIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllck1hc2tEYXRhKHJlYWRlcjogUHNkUmVhZGVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucykge1xyXG5cdHJldHVybiByZWFkU2VjdGlvbjxMYXllck1hc2tEYXRhIHwgdW5kZWZpbmVkPihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0aWYgKCFsZWZ0KCkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdFx0Y29uc3QgbWFzazogTGF5ZXJNYXNrRGF0YSA9IHt9O1xyXG5cdFx0bWFzay50b3AgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2subGVmdCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5ib3R0b20gPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2sucmlnaHQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2suZGVmYXVsdENvbG9yID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblxyXG5cdFx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIgPSAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5Qb3NpdGlvblJlbGF0aXZlVG9MYXllcikgIT09IDA7XHJcblx0XHRtYXNrLmRpc2FibGVkID0gKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQpICE9PSAwO1xyXG5cdFx0bWFzay5mcm9tVmVjdG9yRGF0YSA9IChmbGFncyAmIExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Zyb21SZW5kZXJpbmdPdGhlckRhdGEpICE9PSAwO1xyXG5cclxuXHRcdGlmIChmbGFncyAmIExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQpIHtcclxuXHRcdFx0Y29uc3QgcGFyYW1zID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eSkgbWFzay51c2VyTWFza0RlbnNpdHkgPSByZWFkVWludDgocmVhZGVyKSAvIDB4ZmY7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlVzZXJNYXNrRmVhdGhlcikgbWFzay51c2VyTWFza0ZlYXRoZXIgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0XHRpZiAocGFyYW1zICYgTWFza1BhcmFtcy5WZWN0b3JNYXNrRGVuc2l0eSkgbWFzay52ZWN0b3JNYXNrRGVuc2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVmVjdG9yTWFza0ZlYXRoZXIpIG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0KCkgPiAyKSB7XHJcblx0XHRcdG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdVbmhhbmRsZWQgZXh0cmEgbWFzayBwYXJhbXMnKTtcclxuXHRcdFx0Ly8gVE9ETzogaGFuZGxlIHRoZXNlIHZhbHVlc1xyXG5cdFx0XHQvKmNvbnN0IHJlYWxGbGFncyA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcmVhbFVzZXJNYXNrQmFja2dyb3VuZCA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgdG9wMiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgbGVmdDIgPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IGJvdHRvbTIgPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IHJpZ2h0MiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdHJldHVybiBtYXNrO1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJCbGVuZGluZ1JhbmdlcyhyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJldHVybiByZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0Y29uc3QgY29tcG9zaXRlR3JheUJsZW5kU291cmNlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29tcG9zaXRlR3JhcGhCbGVuZERlc3RpbmF0aW9uUmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCByYW5nZXMgPSBbXTtcclxuXHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdGNvbnN0IHNvdXJjZVJhbmdlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBkZXN0UmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdHJhbmdlcy5wdXNoKHsgc291cmNlUmFuZ2UsIGRlc3RSYW5nZSB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4geyBjb21wb3NpdGVHcmF5QmxlbmRTb3VyY2UsIGNvbXBvc2l0ZUdyYXBoQmxlbmREZXN0aW5hdGlvblJhbmdlLCByYW5nZXMgfTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExheWVyQ2hhbm5lbEltYWdlRGF0YShcclxuXHRyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIGxheWVyOiBMYXllciwgY2hhbm5lbHM6IENoYW5uZWxJbmZvW10sIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0XHJcbikge1xyXG5cdGNvbnN0IGxheWVyV2lkdGggPSAobGF5ZXIucmlnaHQgfHwgMCkgLSAobGF5ZXIubGVmdCB8fCAwKTtcclxuXHRjb25zdCBsYXllckhlaWdodCA9IChsYXllci5ib3R0b20gfHwgMCkgLSAobGF5ZXIudG9wIHx8IDApO1xyXG5cdGNvbnN0IGNteWsgPSBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuQ01ZSztcclxuXHJcblx0bGV0IGltYWdlRGF0YTogSW1hZ2VEYXRhIHwgdW5kZWZpbmVkO1xyXG5cclxuXHRpZiAobGF5ZXJXaWR0aCAmJiBsYXllckhlaWdodCkge1xyXG5cdFx0aWYgKGNteWspIHtcclxuXHRcdFx0aW1hZ2VEYXRhID0geyB3aWR0aDogbGF5ZXJXaWR0aCwgaGVpZ2h0OiBsYXllckhlaWdodCwgZGF0YTogbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGxheWVyV2lkdGggKiBsYXllckhlaWdodCAqIDUpIH07XHJcblx0XHRcdGZvciAobGV0IHAgPSA0OyBwIDwgaW1hZ2VEYXRhLmRhdGEuYnl0ZUxlbmd0aDsgcCArPSA1KSBpbWFnZURhdGEuZGF0YVtwXSA9IDI1NTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShsYXllcldpZHRoLCBsYXllckhlaWdodCk7XHJcblx0XHRcdHJlc2V0SW1hZ2VEYXRhKGltYWdlRGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoUkFXX0lNQUdFX0RBVEEpIChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IFtdO1xyXG5cclxuXHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcclxuXHRcdGNvbnN0IGNvbXByZXNzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbXByZXNzaW9uO1xyXG5cclxuXHRcdGlmIChjaGFubmVsLmlkID09PSBDaGFubmVsSUQuVXNlck1hc2spIHtcclxuXHRcdFx0Y29uc3QgbWFzayA9IGxheWVyLm1hc2s7XHJcblxyXG5cdFx0XHRpZiAoIW1hc2spIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBsYXllciBtYXNrIGRhdGFgKTtcclxuXHJcblx0XHRcdGNvbnN0IG1hc2tXaWR0aCA9IChtYXNrLnJpZ2h0IHx8IDApIC0gKG1hc2subGVmdCB8fCAwKTtcclxuXHRcdFx0Y29uc3QgbWFza0hlaWdodCA9IChtYXNrLmJvdHRvbSB8fCAwKSAtIChtYXNrLnRvcCB8fCAwKTtcclxuXHJcblx0XHRcdGlmIChtYXNrV2lkdGggJiYgbWFza0hlaWdodCkge1xyXG5cdFx0XHRcdGNvbnN0IG1hc2tEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKG1hc2tXaWR0aCwgbWFza0hlaWdodCk7XHJcblx0XHRcdFx0cmVzZXRJbWFnZURhdGEobWFza0RhdGEpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGEocmVhZGVyLCBtYXNrRGF0YSwgY29tcHJlc3Npb24sIG1hc2tXaWR0aCwgbWFza0hlaWdodCwgMCwgb3B0aW9ucy5sYXJnZSwgNCk7XHJcblxyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkge1xyXG5cdFx0XHRcdFx0KGxheWVyIGFzIGFueSkubWFza0RhdGFSYXcgPSBuZXcgVWludDhBcnJheShyZWFkZXIudmlldy5idWZmZXIsIHJlYWRlci52aWV3LmJ5dGVPZmZzZXQgKyBzdGFydCwgcmVhZGVyLm9mZnNldCAtIHN0YXJ0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNldHVwR3JheXNjYWxlKG1hc2tEYXRhKTtcclxuXHJcblx0XHRcdFx0aWYgKG9wdGlvbnMudXNlSW1hZ2VEYXRhKSB7XHJcblx0XHRcdFx0XHRtYXNrLmltYWdlRGF0YSA9IG1hc2tEYXRhO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRtYXNrLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhtYXNrV2lkdGgsIG1hc2tIZWlnaHQpO1xyXG5cdFx0XHRcdFx0bWFzay5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKG1hc2tEYXRhLCAwLCAwKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNvbnN0IG9mZnNldCA9IG9mZnNldEZvckNoYW5uZWwoY2hhbm5lbC5pZCwgY215ayk7XHJcblx0XHRcdGxldCB0YXJnZXREYXRhID0gaW1hZ2VEYXRhO1xyXG5cclxuXHRcdFx0aWYgKG9mZnNldCA8IDApIHtcclxuXHRcdFx0XHR0YXJnZXREYXRhID0gdW5kZWZpbmVkO1xyXG5cclxuXHRcdFx0XHRpZiAob3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykge1xyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDaGFubmVsIG5vdCBzdXBwb3J0ZWQ6ICR7Y2hhbm5lbC5pZH1gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHN0YXJ0ID0gcmVhZGVyLm9mZnNldDtcclxuXHRcdFx0cmVhZERhdGEocmVhZGVyLCB0YXJnZXREYXRhLCBjb21wcmVzc2lvbiwgbGF5ZXJXaWR0aCwgbGF5ZXJIZWlnaHQsIG9mZnNldCwgb3B0aW9ucy5sYXJnZSwgY215ayA/IDUgOiA0KTtcclxuXHJcblx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkge1xyXG5cdFx0XHRcdChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhd1tjaGFubmVsLmlkXSA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGFyZ2V0RGF0YSAmJiBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlKSB7XHJcblx0XHRcdFx0c2V0dXBHcmF5c2NhbGUodGFyZ2V0RGF0YSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChpbWFnZURhdGEpIHtcclxuXHRcdGlmIChjbXlrKSB7XHJcblx0XHRcdGNvbnN0IGNteWtEYXRhID0gaW1hZ2VEYXRhO1xyXG5cdFx0XHRpbWFnZURhdGEgPSBjcmVhdGVJbWFnZURhdGEoY215a0RhdGEud2lkdGgsIGNteWtEYXRhLmhlaWdodCk7XHJcblx0XHRcdGNteWtUb1JnYihjbXlrRGF0YSwgaW1hZ2VEYXRhLCBmYWxzZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMudXNlSW1hZ2VEYXRhKSB7XHJcblx0XHRcdGxheWVyLmltYWdlRGF0YSA9IGltYWdlRGF0YTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxheWVyLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhsYXllcldpZHRoLCBsYXllckhlaWdodCk7XHJcblx0XHRcdGxheWVyLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWREYXRhKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBkYXRhOiBJbWFnZURhdGEgfCB1bmRlZmluZWQsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbiwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsXHJcblx0b2Zmc2V0OiBudW1iZXIsIGxhcmdlOiBib29sZWFuLCBzdGVwOiBudW1iZXJcclxuKSB7XHJcblx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGRhdGEsIG9mZnNldCwgd2lkdGgsIGhlaWdodCwgc3RlcCk7XHJcblx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0cmVhZERhdGFSTEUocmVhZGVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBzdGVwLCBbb2Zmc2V0XSwgbGFyZ2UpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbXByZXNzaW9uIHR5cGUgbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRHbG9iYWxMYXllck1hc2tJbmZvKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uPEdsb2JhbExheWVyTWFza0luZm8gfCB1bmRlZmluZWQ+KHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRjb25zdCBvdmVybGF5Q29sb3JTcGFjZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2UxID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTIgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjb2xvclNwYWNlMyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2U0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmY7XHJcblx0XHRjb25zdCBraW5kID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpOyAvLyAzIGJ5dGVzIG9mIHBhZGRpbmcgP1xyXG5cdFx0cmV0dXJuIHsgb3ZlcmxheUNvbG9yU3BhY2UsIGNvbG9yU3BhY2UxLCBjb2xvclNwYWNlMiwgY29sb3JTcGFjZTMsIGNvbG9yU3BhY2U0LCBvcGFjaXR5LCBraW5kIH07XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRBZGRpdGlvbmFsTGF5ZXJJbmZvKHJlYWRlcjogUHNkUmVhZGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGNvbnN0IHNpZyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRpZiAoc2lnICE9PSAnOEJJTScgJiYgc2lnICE9PSAnOEI2NCcpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ30nIGF0IDB4JHsocmVhZGVyLm9mZnNldCAtIDQpLnRvU3RyaW5nKDE2KX1gKTtcclxuXHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdC8vIGBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5c2AgZmFsbGJhY2ssIGJlY2F1c2Ugc29tZSBrZXlzIGRvbid0IGhhdmUgOEI2NCBzaWduYXR1cmUgZXZlbiB3aGVuIHRoZXkgYXJlIDY0Yml0XHJcblx0Y29uc3QgdTY0ID0gc2lnID09PSAnOEI2NCcgfHwgKG9wdGlvbnMubGFyZ2UgJiYgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXMuaW5kZXhPZihrZXkpICE9PSAtMSk7XHJcblxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XHJcblx0XHRjb25zdCBoYW5kbGVyID0gaW5mb0hhbmRsZXJzTWFwW2tleV07XHJcblxyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRoYW5kbGVyLnJlYWQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRpZiAob3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykgdGhyb3cgZTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYFVuaGFuZGxlZCBhZGRpdGlvbmFsIGluZm86ICR7a2V5fWApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0KCkpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYFVucmVhZCAke2xlZnQoKX0gYnl0ZXMgbGVmdCBmb3IgYWRkaXRpb25hbCBpbmZvOiAke2tleX1gKTtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdH1cclxuXHR9LCBmYWxzZSwgdTY0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEltYWdlRGF0YShyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGNvbnN0IGNvbXByZXNzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbXByZXNzaW9uO1xyXG5cclxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKHBzZC5jb2xvck1vZGUhKSA9PT0gLTEpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbG9yIG1vZGUgbm90IHN1cHBvcnRlZDogJHtwc2QuY29sb3JNb2RlfWApO1xyXG5cclxuXHRpZiAoY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJhd0RhdGEgJiYgY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbXByZXNzaW9uIHR5cGUgbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHJcblx0Y29uc3QgaW1hZ2VEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0cmVzZXRJbWFnZURhdGEoaW1hZ2VEYXRhKTtcclxuXHJcblx0c3dpdGNoIChwc2QuY29sb3JNb2RlKSB7XHJcblx0XHRjYXNlIENvbG9yTW9kZS5CaXRtYXA6IHtcclxuXHRcdFx0bGV0IGJ5dGVzOiBVaW50OEFycmF5O1xyXG5cclxuXHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRcdFx0Ynl0ZXMgPSByZWFkQnl0ZXMocmVhZGVyLCBNYXRoLmNlaWwocHNkLndpZHRoIC8gOCkgKiBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0XHRcdGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkocHNkLndpZHRoICogcHNkLmhlaWdodCk7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCB7IGRhdGE6IGJ5dGVzLCB3aWR0aDogcHNkLndpZHRoLCBoZWlnaHQ6IHBzZC5oZWlnaHQgfSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCAxLCBbMF0sIG9wdGlvbnMubGFyZ2UpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQml0bWFwIGNvbXByZXNzaW9uIG5vdCBzdXBwb3J0ZWQ6ICR7Y29tcHJlc3Npb259YCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGRlY29kZUJpdG1hcChieXRlcywgaW1hZ2VEYXRhLmRhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuUkdCOlxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuR3JheXNjYWxlOiB7XHJcblx0XHRcdGNvbnN0IGNoYW5uZWxzID0gcHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSA/IFswXSA6IFswLCAxLCAyXTtcclxuXHJcblx0XHRcdGlmIChwc2QuY2hhbm5lbHMgJiYgcHNkLmNoYW5uZWxzID4gMykge1xyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAzOyBpIDwgcHNkLmNoYW5uZWxzOyBpKyspIHtcclxuXHRcdFx0XHRcdC8vIFRPRE86IHN0b3JlIHRoZXNlIGNoYW5uZWxzIGluIGFkZGl0aW9uYWwgaW1hZ2UgZGF0YVxyXG5cdFx0XHRcdFx0Y2hhbm5lbHMucHVzaChpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoZ2xvYmFsQWxwaGEpIHtcclxuXHRcdFx0XHRjaGFubmVscy5wdXNoKDMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGltYWdlRGF0YSwgY2hhbm5lbHNbaV0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgNCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgaW1hZ2VEYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDQsIGNoYW5uZWxzLCBvcHRpb25zLmxhcmdlKTtcclxuXHRcdFx0XHRpZiAoUkFXX0lNQUdFX0RBVEEpIChwc2QgYXMgYW55KS5pbWFnZURhdGFSYXcgPSBuZXcgVWludDhBcnJheShyZWFkZXIudmlldy5idWZmZXIsIHJlYWRlci52aWV3LmJ5dGVPZmZzZXQgKyBzdGFydCwgcmVhZGVyLm9mZnNldCAtIHN0YXJ0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUpIHtcclxuXHRcdFx0XHRzZXR1cEdyYXlzY2FsZShpbWFnZURhdGEpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuQ01ZSzoge1xyXG5cdFx0XHRpZiAocHNkLmNoYW5uZWxzICE9PSA0KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2hhbm5lbCBjb3VudGApO1xyXG5cclxuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSBbMCwgMSwgMiwgM107XHJcblx0XHRcdGlmIChnbG9iYWxBbHBoYSkgY2hhbm5lbHMucHVzaCg0KTtcclxuXHJcblx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmF3RGF0YSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTm90IGltcGxlbWVudGVkYCk7XHJcblx0XHRcdFx0Ly8gVE9ETzogLi4uXHJcblx0XHRcdFx0Ly8gZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVscy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdC8vIFx0cmVhZERhdGFSYXcocmVhZGVyLCBpbWFnZURhdGEsIGNoYW5uZWxzW2ldLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xyXG5cdFx0XHRcdC8vIH1cclxuXHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0XHRcdGNvbnN0IGNteWtJbWFnZURhdGE6IFBpeGVsRGF0YSA9IHtcclxuXHRcdFx0XHRcdHdpZHRoOiBpbWFnZURhdGEud2lkdGgsXHJcblx0XHRcdFx0XHRoZWlnaHQ6IGltYWdlRGF0YS5oZWlnaHQsXHJcblx0XHRcdFx0XHRkYXRhOiBuZXcgVWludDhBcnJheShpbWFnZURhdGEud2lkdGggKiBpbWFnZURhdGEuaGVpZ2h0ICogNSksXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgY215a0ltYWdlRGF0YSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCA1LCBjaGFubmVscywgb3B0aW9ucy5sYXJnZSk7XHJcblx0XHRcdFx0Y215a1RvUmdiKGNteWtJbWFnZURhdGEsIGltYWdlRGF0YSwgdHJ1ZSk7XHJcblxyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHRcdGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke3BzZC5jb2xvck1vZGV9YCk7XHJcblx0fVxyXG5cclxuXHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdHBzZC5pbWFnZURhdGEgPSBpbWFnZURhdGE7XHJcblx0fSBlbHNlIHtcclxuXHRcdHBzZC5jYW52YXMgPSBjcmVhdGVDYW52YXMocHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRcdHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBjbXlrVG9SZ2IoY215azogUGl4ZWxEYXRhLCByZ2I6IFBpeGVsRGF0YSwgcmV2ZXJzZUFscGhhOiBib29sZWFuKSB7XHJcblx0Y29uc3Qgc2l6ZSA9IHJnYi53aWR0aCAqIHJnYi5oZWlnaHQgKiA0O1xyXG5cdGNvbnN0IHNyY0RhdGEgPSBjbXlrLmRhdGE7XHJcblx0Y29uc3QgZHN0RGF0YSA9IHJnYi5kYXRhO1xyXG5cclxuXHRmb3IgKGxldCBzcmMgPSAwLCBkc3QgPSAwOyBkc3QgPCBzaXplOyBzcmMgKz0gNSwgZHN0ICs9IDQpIHtcclxuXHRcdGNvbnN0IGMgPSBzcmNEYXRhW3NyY107XHJcblx0XHRjb25zdCBtID0gc3JjRGF0YVtzcmMgKyAxXTtcclxuXHRcdGNvbnN0IHkgPSBzcmNEYXRhW3NyYyArIDJdO1xyXG5cdFx0Y29uc3QgayA9IHNyY0RhdGFbc3JjICsgM107XHJcblx0XHRkc3REYXRhW2RzdF0gPSAoKCgoYyAqIGspIHwgMCkgLyAyNTUpIHwgMCk7XHJcblx0XHRkc3REYXRhW2RzdCArIDFdID0gKCgoKG0gKiBrKSB8IDApIC8gMjU1KSB8IDApO1xyXG5cdFx0ZHN0RGF0YVtkc3QgKyAyXSA9ICgoKCh5ICogaykgfCAwKSAvIDI1NSkgfCAwKTtcclxuXHRcdGRzdERhdGFbZHN0ICsgM10gPSByZXZlcnNlQWxwaGEgPyAyNTUgLSBzcmNEYXRhW3NyYyArIDRdIDogc3JjRGF0YVtzcmMgKyA0XTtcclxuXHR9XHJcblxyXG5cdC8vIGZvciAobGV0IHNyYyA9IDAsIGRzdCA9IDA7IGRzdCA8IHNpemU7IHNyYyArPSA1LCBkc3QgKz0gNCkge1xyXG5cdC8vIFx0Y29uc3QgYyA9IDEgLSAoc3JjRGF0YVtzcmMgKyAwXSAvIDI1NSk7XHJcblx0Ly8gXHRjb25zdCBtID0gMSAtIChzcmNEYXRhW3NyYyArIDFdIC8gMjU1KTtcclxuXHQvLyBcdGNvbnN0IHkgPSAxIC0gKHNyY0RhdGFbc3JjICsgMl0gLyAyNTUpO1xyXG5cdC8vIFx0Ly8gY29uc3QgayA9IHNyY0RhdGFbc3JjICsgM10gLyAyNTU7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDBdID0gKCgxIC0gYyAqIDAuOCkgKiAyNTUpIHwgMDtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgMV0gPSAoKDEgLSBtICogMC44KSAqIDI1NSkgfCAwO1xyXG5cdC8vIFx0ZHN0RGF0YVtkc3QgKyAyXSA9ICgoMSAtIHkgKiAwLjgpICogMjU1KSB8IDA7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDNdID0gcmV2ZXJzZUFscGhhID8gMjU1IC0gc3JjRGF0YVtzcmMgKyA0XSA6IHNyY0RhdGFbc3JjICsgNF07XHJcblx0Ly8gfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkRGF0YVJhdyhyZWFkZXI6IFBzZFJlYWRlciwgcGl4ZWxEYXRhOiBQaXhlbERhdGEgfCB1bmRlZmluZWQsIG9mZnNldDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgc3RlcDogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc2l6ZSA9IHdpZHRoICogaGVpZ2h0O1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIHNpemUpO1xyXG5cclxuXHRpZiAocGl4ZWxEYXRhICYmIG9mZnNldCA8IHN0ZXApIHtcclxuXHRcdGNvbnN0IGRhdGEgPSBwaXhlbERhdGEuZGF0YTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMCwgcCA9IG9mZnNldCB8IDA7IGkgPCBzaXplOyBpKyssIHAgPSAocCArIHN0ZXApIHwgMCkge1xyXG5cdFx0XHRkYXRhW3BdID0gYnVmZmVyW2ldO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWREYXRhUkxFKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBwaXhlbERhdGE6IFBpeGVsRGF0YSB8IHVuZGVmaW5lZCwgX3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBzdGVwOiBudW1iZXIsIG9mZnNldHM6IG51bWJlcltdLFxyXG5cdGxhcmdlOiBib29sZWFuXHJcbikge1xyXG5cdGNvbnN0IGRhdGEgPSBwaXhlbERhdGEgJiYgcGl4ZWxEYXRhLmRhdGE7XHJcblx0bGV0IGxlbmd0aHM6IFVpbnQxNkFycmF5IHwgVWludDMyQXJyYXk7XHJcblxyXG5cdGlmIChsYXJnZSkge1xyXG5cdFx0bGVuZ3RocyA9IG5ldyBVaW50MzJBcnJheShvZmZzZXRzLmxlbmd0aCAqIGhlaWdodCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgbyA9IDAsIGxpID0gMDsgbyA8IG9mZnNldHMubGVuZ3RoOyBvKyspIHtcclxuXHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGxlbmd0aHNbbGldID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGxlbmd0aHMgPSBuZXcgVWludDE2QXJyYXkob2Zmc2V0cy5sZW5ndGggKiBoZWlnaHQpO1xyXG5cclxuXHRcdGZvciAobGV0IG8gPSAwLCBsaSA9IDA7IG8gPCBvZmZzZXRzLmxlbmd0aDsgbysrKSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyssIGxpKyspIHtcclxuXHRcdFx0XHRsZW5ndGhzW2xpXSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y29uc3QgZXh0cmFMaW1pdCA9IChzdGVwIC0gMSkgfCAwOyAvLyAzIGZvciByZ2IsIDQgZm9yIGNteWtcclxuXHJcblx0Zm9yIChsZXQgYyA9IDAsIGxpID0gMDsgYyA8IG9mZnNldHMubGVuZ3RoOyBjKyspIHtcclxuXHRcdGNvbnN0IG9mZnNldCA9IG9mZnNldHNbY10gfCAwO1xyXG5cdFx0Y29uc3QgZXh0cmEgPSBjID4gZXh0cmFMaW1pdCB8fCBvZmZzZXQgPiBleHRyYUxpbWl0O1xyXG5cclxuXHRcdGlmICghZGF0YSB8fCBleHRyYSkge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVuZ3Roc1tsaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMCwgcCA9IG9mZnNldCB8IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGNvbnN0IGxlbmd0aCA9IGxlbmd0aHNbbGldO1xyXG5cdFx0XHRcdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblxyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGxldCBoZWFkZXIgPSBidWZmZXJbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGhlYWRlciA+IDEyOCkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGJ1ZmZlclsrK2ldO1xyXG5cdFx0XHRcdFx0XHRoZWFkZXIgPSAoMjU2IC0gaGVhZGVyKSB8IDA7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8PSBoZWFkZXI7IGogPSAoaiArIDEpIHwgMCkge1xyXG5cdFx0XHRcdFx0XHRcdGRhdGFbcF0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHRwID0gKHAgKyBzdGVwKSB8IDA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaGVhZGVyIDwgMTI4KSB7XHJcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDw9IGhlYWRlcjsgaiA9IChqICsgMSkgfCAwKSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtwXSA9IGJ1ZmZlclsrK2ldO1xyXG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIHN0ZXApIHwgMDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly8gaWdub3JlIDEyOFxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChpID49IGxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUkxFIGRhdGE6IGV4Y2VlZGVkIGJ1ZmZlciBzaXplICR7aX0vJHtsZW5ndGh9YCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNlY3Rpb248VD4oXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6IChsZWZ0OiAoKSA9PiBudW1iZXIpID0+IFQsIHNraXBFbXB0eSA9IHRydWUsIGVpZ2h0Qnl0ZXMgPSBmYWxzZVxyXG4pOiBUIHwgdW5kZWZpbmVkIHtcclxuXHRsZXQgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRpZiAoZWlnaHRCeXRlcykge1xyXG5cdFx0aWYgKGxlbmd0aCAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdTaXplcyBsYXJnZXIgdGhhbiA0R0IgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcclxuXHRcdGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHR9XHJcblxyXG5cdGlmIChsZW5ndGggPD0gMCAmJiBza2lwRW1wdHkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdGxldCBlbmQgPSByZWFkZXIub2Zmc2V0ICsgbGVuZ3RoO1xyXG5cdGNvbnN0IHJlc3VsdCA9IGZ1bmMoKCkgPT4gZW5kIC0gcmVhZGVyLm9mZnNldCk7XHJcblxyXG5cdGlmIChyZWFkZXIub2Zmc2V0ID4gZW5kKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdFeGNlZWRlZCBzZWN0aW9uIGxpbWl0cycpO1xyXG5cclxuXHRpZiAocmVhZGVyLm9mZnNldCAhPT0gZW5kKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbnJlYWQgc2VjdGlvbiBkYXRhOiAke2VuZCAtIHJlYWRlci5vZmZzZXR9IGJ5dGVzIGF0IDB4JHtyZWFkZXIub2Zmc2V0LnRvU3RyaW5nKDE2KX1gKTtcclxuXHJcblx0d2hpbGUgKGVuZCAlIHJvdW5kKSBlbmQrKztcclxuXHJcblx0cmVhZGVyLm9mZnNldCA9IGVuZDtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZENvbG9yKHJlYWRlcjogUHNkUmVhZGVyKTogQ29sb3Ige1xyXG5cdGNvbnN0IGNvbG9yU3BhY2UgPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29sb3JTcGFjZTtcclxuXHJcblx0c3dpdGNoIChjb2xvclNwYWNlKSB7XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuUkdCOiB7XHJcblx0XHRcdGNvbnN0IHIgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IGcgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IGIgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdFx0XHRyZXR1cm4geyByLCBnLCBiIH07XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuSFNCOiB7XHJcblx0XHRcdGNvbnN0IGggPSByZWFkVWludDE2KHJlYWRlcikgLyAweGZmZmY7XHJcblx0XHRcdGNvbnN0IHMgPSByZWFkVWludDE2KHJlYWRlcikgLyAweGZmZmY7XHJcblx0XHRcdGNvbnN0IGIgPSByZWFkVWludDE2KHJlYWRlcikgLyAweGZmZmY7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdFx0XHRyZXR1cm4geyBoLCBzLCBiIH07XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuQ01ZSzoge1xyXG5cdFx0XHRjb25zdCBjID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRjb25zdCBtID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRjb25zdCB5ID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRjb25zdCBrID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRyZXR1cm4geyBjLCBtLCB5LCBrIH07XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuTGFiOiB7XHJcblx0XHRcdGNvbnN0IGwgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDAwO1xyXG5cdFx0XHRjb25zdCB0YSA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB0YiA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBhID0gdGEgPCAwID8gKHRhIC8gMTI4MDApIDogKHRhIC8gMTI3MDApO1xyXG5cdFx0XHRjb25zdCBiID0gdGIgPCAwID8gKHRiIC8gMTI4MDApIDogKHRiIC8gMTI3MDApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHRcdFx0cmV0dXJuIHsgbCwgYSwgYiB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvclNwYWNlLkdyYXlzY2FsZToge1xyXG5cdFx0XHRjb25zdCBrID0gcmVhZFVpbnQxNihyZWFkZXIpICogMjU1IC8gMTAwMDA7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDYpO1xyXG5cdFx0XHRyZXR1cm4geyBrIH07XHJcblx0XHR9XHJcblx0XHRkZWZhdWx0OlxyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29sb3Igc3BhY2UnKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUGF0dGVybihyZWFkZXI6IFBzZFJlYWRlcik6IFBhdHRlcm5JbmZvIHtcclxuXHRyZWFkVWludDMyKHJlYWRlcik7IC8vIGxlbmd0aFxyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24gIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwYXR0ZXJuIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0Y29uc3QgY29sb3JNb2RlID0gcmVhZFVpbnQzMihyZWFkZXIpIGFzIENvbG9yTW9kZTtcclxuXHRjb25zdCB4ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgeSA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cclxuXHQvLyB3ZSBvbmx5IHN1cHBvcnQgUkdCIGFuZCBncmF5c2NhbGUgZm9yIG5vd1xyXG5cdGlmIChjb2xvck1vZGUgIT09IENvbG9yTW9kZS5SR0IgJiYgY29sb3JNb2RlICE9PSBDb2xvck1vZGUuR3JheXNjYWxlICYmIGNvbG9yTW9kZSAhPT0gQ29sb3JNb2RlLkluZGV4ZWQpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcGF0dGVybiBjb2xvciBtb2RlOiAke2NvbG9yTW9kZX1gKTtcclxuXHR9XHJcblxyXG5cdGxldCBuYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRjb25zdCBpZCA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHRjb25zdCBwYWxldHRlOiBSR0JbXSA9IFtdO1xyXG5cclxuXHRpZiAoY29sb3JNb2RlID09PSBDb2xvck1vZGUuSW5kZXhlZCkge1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xyXG5cdFx0XHRwYWxldHRlLnB1c2goe1xyXG5cdFx0XHRcdHI6IHJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRcdGc6IHJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHRcdGI6IHJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCA0KTsgLy8gbm8gaWRlYSB3aGF0IHRoaXMgaXNcclxuXHR9XHJcblxyXG5cdC8vIHZpcnR1YWwgbWVtb3J5IGFycmF5IGxpc3RcclxuXHRjb25zdCB2ZXJzaW9uMiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRpZiAodmVyc2lvbjIgIT09IDMpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwYXR0ZXJuIFZNQUwgdmVyc2lvbjogJHt2ZXJzaW9uMn1gKTtcclxuXHJcblx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyBsZW5ndGhcclxuXHRjb25zdCB0b3AgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgbGVmdCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBib3R0b20gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgcmlnaHQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgY2hhbm5lbHNDb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCB3aWR0aCA9IHJpZ2h0IC0gbGVmdDtcclxuXHRjb25zdCBoZWlnaHQgPSBib3R0b20gLSB0b3A7XHJcblx0Y29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KHdpZHRoICogaGVpZ2h0ICogNCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAzOyBpIDwgZGF0YS5ieXRlTGVuZ3RoOyBpICs9IDQpIHtcclxuXHRcdGRhdGFbaV0gPSAyNTU7XHJcblx0fVxyXG5cclxuXHRmb3IgKGxldCBpID0gMCwgY2ggPSAwOyBpIDwgKGNoYW5uZWxzQ291bnQgKyAyKTsgaSsrKSB7XHJcblx0XHRjb25zdCBoYXMgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRpZiAoIWhhcykgY29udGludWU7XHJcblxyXG5cdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgcGl4ZWxEZXB0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGN0b3AgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjbGVmdCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNib3R0b20gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjcmlnaHQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBwaXhlbERlcHRoMiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbXByZXNzaW9uTW9kZSA9IHJlYWRVaW50OChyZWFkZXIpOyAvLyAwIC0gcmF3LCAxIC0gemlwXHJcblx0XHRjb25zdCBkYXRhTGVuZ3RoID0gbGVuZ3RoIC0gKDQgKyAxNiArIDIgKyAxKTtcclxuXHRcdGNvbnN0IGNkYXRhID0gcmVhZEJ5dGVzKHJlYWRlciwgZGF0YUxlbmd0aCk7XHJcblxyXG5cdFx0aWYgKHBpeGVsRGVwdGggIT09IDggfHwgcGl4ZWxEZXB0aDIgIT09IDgpIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCcxNmJpdCBwaXhlbCBkZXB0aCBub3Qgc3VwcG9ydGVkIGZvciBwYXR0ZXJucycpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IHcgPSBjcmlnaHQgLSBjbGVmdDtcclxuXHRcdGNvbnN0IGggPSBjYm90dG9tIC0gY3RvcDtcclxuXHRcdGNvbnN0IG94ID0gY2xlZnQgLSBsZWZ0O1xyXG5cdFx0Y29uc3Qgb3kgPSBjdG9wIC0gdG9wO1xyXG5cclxuXHRcdGlmIChjb21wcmVzc2lvbk1vZGUgPT09IDApIHtcclxuXHRcdFx0aWYgKGNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLlJHQiAmJiBjaCA8IDMpIHtcclxuXHRcdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGg7IHkrKykge1xyXG5cdFx0XHRcdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3OyB4KyspIHtcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc3JjID0geCArIHkgKiB3O1xyXG5cdFx0XHRcdFx0XHRjb25zdCBkc3QgPSAob3ggKyB4ICsgKHkgKyBveSkgKiB3aWR0aCkgKiA0O1xyXG5cdFx0XHRcdFx0XHRkYXRhW2RzdCArIGNoXSA9IGNkYXRhW3NyY107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlICYmIGNoIDwgMSkge1xyXG5cdFx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaDsgeSsrKSB7XHJcblx0XHRcdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHc7IHgrKykge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBzcmMgPSB4ICsgeSAqIHc7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGRzdCA9IChveCArIHggKyAoeSArIG95KSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gY2RhdGFbc3JjXTtcclxuXHRcdFx0XHRcdFx0ZGF0YVtkc3QgKyAwXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRkYXRhW2RzdCArIDFdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgMl0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5JbmRleGVkKSB7XHJcblx0XHRcdFx0Ly8gVE9ETzpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0luZGV4ZWQgcGF0dGVybiBjb2xvciBtb2RlIG5vdCBpbXBsZW1lbnRlZCcpO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uTW9kZSA9PT0gMSkge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyh7IGNvbG9yTW9kZSB9KTtcclxuXHRcdFx0Ly8gcmVxdWlyZSgnZnMnKS53cml0ZUZpbGVTeW5jKCd6aXAuYmluJywgQnVmZmVyLmZyb20oY2RhdGEpKTtcclxuXHRcdFx0Ly8gY29uc3QgZGF0YSA9IHJlcXVpcmUoJ3psaWInKS5pbmZsYXRlUmF3U3luYyhjZGF0YSk7XHJcblx0XHRcdC8vIGNvbnN0IGRhdGEgPSByZXF1aXJlKCd6bGliJykudW56aXBTeW5jKGNkYXRhKTtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coZGF0YSk7XHJcblx0XHRcdC8vIHRocm93IG5ldyBFcnJvcignWmlwIGNvbXByZXNzaW9uIG5vdCBzdXBwb3J0ZWQgZm9yIHBhdHRlcm4nKTtcclxuXHRcdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBwYXR0ZXJuIGNvbXByZXNzaW9uJyk7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1Vuc3VwcG9ydGVkIHBhdHRlcm4gY29tcHJlc3Npb24nKTtcclxuXHRcdFx0bmFtZSArPSAnIChmYWlsZWQgdG8gZGVjb2RlKSc7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGF0dGVybiBjb21wcmVzc2lvbiBtb2RlJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y2grKztcclxuXHR9XHJcblxyXG5cdC8vIFRPRE86IHVzZSBjYW52YXMgaW5zdGVhZCBvZiBkYXRhID9cclxuXHJcblx0cmV0dXJuIHsgaWQsIG5hbWUsIHgsIHksIGJvdW5kczogeyB4OiBsZWZ0LCB5OiB0b3AsIHc6IHdpZHRoLCBoOiBoZWlnaHQgfSwgZGF0YSB9O1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
