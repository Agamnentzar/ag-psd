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
        throw new Error("Invalid signature: '".concat(signature, "' at 0x").concat(offset.toString(16)));
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
        throw new Error("Invalid PSD file version: ".concat(version));
    skipBytes(reader, 6);
    var channels = readUint16(reader);
    var height = readUint32(reader);
    var width = readUint32(reader);
    var bitsPerChannel = readUint16(reader);
    var colorMode = readUint16(reader);
    if (supportedColorModes.indexOf(colorMode) === -1)
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
        throw new Error("Invalid blend mode: '".concat(blendMode, "'"));
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
                    throw new Error("Channel not supported: ".concat(channel.id));
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
    if (supportedColorModes.indexOf(psd.colorMode) === -1)
        throw new Error("Color mode not supported: ".concat(psd.colorMode));
    if (compression !== 0 /* RawData */ && compression !== 1 /* RleCompressed */)
        throw new Error("Compression type not supported: ".concat(compression));
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
                throw new Error("Bitmap compression not supported: ".concat(compression));
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
        default: throw new Error("Color mode not supported: ".concat(psd.colorMode));
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
                        throw new Error("Invalid RLE data: exceeded buffer size ".concat(i, "/").concat(length_1));
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
        throw new Error("Unread section data: ".concat(end - reader.offset, " bytes at 0x").concat(reader.offset.toString(16)));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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R0FBRyxHQUFHLENBQUM7WUFDbkMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDbkI7UUFDRCxnQkFBbUIsQ0FBQyxDQUFDO1lBQ3BCLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDdEMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUN0QyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ3RDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDbkI7UUFDRCxpQkFBb0IsQ0FBQyxDQUFDO1lBQ3JCLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDdEI7UUFDRCxnQkFBbUIsQ0FBQyxDQUFDO1lB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O1lBQ3RELGlEQUFpRDtZQUNqRCxxQkFBcUI7WUFDckIsZ0VBQWdFO1lBQ2hFLHNEQUFzRDtZQUN0RCxPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDakQsSUFBSSxJQUFJLHFCQUFxQixDQUFDO1NBQzlCO2FBQU07WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7U0FDcEQ7UUFFRCxFQUFFLEVBQUUsQ0FBQztLQUNMO0lBRUQscUNBQXFDO0lBRXJDLE9BQU8sRUFBRSxFQUFFLElBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsSUFBSSxNQUFBLEVBQUUsQ0FBQztBQUNuRixDQUFDIiwiZmlsZSI6InBzZFJlYWRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcblx0UHNkLCBMYXllciwgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIExheWVyQWRkaXRpb25hbEluZm8sIFJlYWRPcHRpb25zLCBMYXllck1hc2tEYXRhLCBDb2xvcixcclxuXHRQYXR0ZXJuSW5mbywgR2xvYmFsTGF5ZXJNYXNrSW5mbywgUkdCXHJcbn0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdHJlc2V0SW1hZ2VEYXRhLCBvZmZzZXRGb3JDaGFubmVsLCBkZWNvZGVCaXRtYXAsIFBpeGVsRGF0YSwgY3JlYXRlQ2FudmFzLCBjcmVhdGVJbWFnZURhdGEsXHJcblx0dG9CbGVuZE1vZGUsIENoYW5uZWxJRCwgQ29tcHJlc3Npb24sIExheWVyTWFza0ZsYWdzLCBNYXNrUGFyYW1zLCBDb2xvclNwYWNlLCBSQVdfSU1BR0VfREFUQSwgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXNcclxufSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBpbmZvSGFuZGxlcnNNYXAgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVyc01hcCB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xyXG5cclxuaW50ZXJmYWNlIENoYW5uZWxJbmZvIHtcclxuXHRpZDogQ2hhbm5lbElEO1xyXG5cdGxlbmd0aDogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUmVhZE9wdGlvbnNFeHQgZXh0ZW5kcyBSZWFkT3B0aW9ucyB7XHJcblx0bGFyZ2U6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRDb2xvck1vZGVzID0gW0NvbG9yTW9kZS5CaXRtYXAsIENvbG9yTW9kZS5HcmF5c2NhbGUsIENvbG9yTW9kZS5SR0JdO1xyXG5jb25zdCBjb2xvck1vZGVzID0gWydiaXRtYXAnLCAnZ3JheXNjYWxlJywgJ2luZGV4ZWQnLCAnUkdCJywgJ0NNWUsnLCAnbXVsdGljaGFubmVsJywgJ2R1b3RvbmUnLCAnbGFiJ107XHJcblxyXG5mdW5jdGlvbiBzZXR1cEdyYXlzY2FsZShkYXRhOiBQaXhlbERhdGEpIHtcclxuXHRjb25zdCBzaXplID0gZGF0YS53aWR0aCAqIGRhdGEuaGVpZ2h0ICogNDtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaXplOyBpICs9IDQpIHtcclxuXHRcdGRhdGEuZGF0YVtpICsgMV0gPSBkYXRhLmRhdGFbaV07XHJcblx0XHRkYXRhLmRhdGFbaSArIDJdID0gZGF0YS5kYXRhW2ldO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQc2RSZWFkZXIge1xyXG5cdG9mZnNldDogbnVtYmVyO1xyXG5cdHZpZXc6IERhdGFWaWV3O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVhZGVyKGJ1ZmZlcjogQXJyYXlCdWZmZXIsIG9mZnNldD86IG51bWJlciwgbGVuZ3RoPzogbnVtYmVyKTogUHNkUmVhZGVyIHtcclxuXHRjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpO1xyXG5cdHJldHVybiB7IHZpZXcsIG9mZnNldDogMCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQ4KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAxO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0IC0gMSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBwZWVrVWludDgocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDgocmVhZGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MTYocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDI7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEludDE2KHJlYWRlci5vZmZzZXQgLSAyLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVWludDE2KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAyO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MTYocmVhZGVyLm9mZnNldCAtIDIsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0SW50MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRJbnQzMkxFKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQzMihyZWFkZXIub2Zmc2V0IC0gNCwgdHJ1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVWludDMyKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRVaW50MzIocmVhZGVyLm9mZnNldCAtIDQsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGbG9hdDMyKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSA0O1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRGbG9hdDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRmxvYXQ2NChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gODtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0RmxvYXQ2NChyZWFkZXIub2Zmc2V0IC0gOCwgZmFsc2UpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDE2LjE2XHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRml4ZWRQb2ludDMyKHJlYWRlcjogUHNkUmVhZGVyKTogbnVtYmVyIHtcclxuXHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcikgLyAoMSA8PCAxNik7XHJcbn1cclxuXHJcbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyOiBQc2RSZWFkZXIpOiBudW1iZXIge1xyXG5cdHJldHVybiByZWFkSW50MzIocmVhZGVyKSAvICgxIDw8IDI0KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRCeXRlcyhyZWFkZXI6IFBzZFJlYWRlciwgbGVuZ3RoOiBudW1iZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IGxlbmd0aDtcclxuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgcmVhZGVyLm9mZnNldCAtIGxlbmd0aCwgbGVuZ3RoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRTaWduYXR1cmUocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZFNob3J0U3RyaW5nKHJlYWRlciwgNCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUGFzY2FsU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBwYWRUbzogbnVtYmVyKSB7XHJcblx0bGV0IGxlbmd0aCA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdGNvbnN0IHRleHQgPSBsZW5ndGggPyByZWFkU2hvcnRTdHJpbmcocmVhZGVyLCBsZW5ndGgpIDogJyc7XHJcblxyXG5cdHdoaWxlICgrK2xlbmd0aCAlIHBhZFRvKSB7XHJcblx0XHRyZWFkZXIub2Zmc2V0Kys7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdGV4dDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdHJldHVybiByZWFkVW5pY29kZVN0cmluZ1dpdGhMZW5ndGgocmVhZGVyLCBsZW5ndGgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGxldCB0ZXh0ID0gJyc7XHJcblxyXG5cdHdoaWxlIChsZW5ndGgtLSkge1xyXG5cdFx0Y29uc3QgdmFsdWUgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKHZhbHVlIHx8IGxlbmd0aCA+IDApIHsgLy8gcmVtb3ZlIHRyYWlsaW5nIFxcMFxyXG5cdFx0XHR0ZXh0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUodmFsdWUpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQXNjaWlTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0bGV0IHRleHQgPSAnJztcclxuXHJcblx0d2hpbGUgKGxlbmd0aC0tKSB7XHJcblx0XHR0ZXh0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUocmVhZFVpbnQ4KHJlYWRlcikpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBza2lwQnl0ZXMocmVhZGVyOiBQc2RSZWFkZXIsIGNvdW50OiBudW1iZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IGNvdW50O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tTaWduYXR1cmUocmVhZGVyOiBQc2RSZWFkZXIsIGE6IHN0cmluZywgYj86IHN0cmluZykge1xyXG5cdGNvbnN0IG9mZnNldCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0Y29uc3Qgc2lnbmF0dXJlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRpZiAoc2lnbmF0dXJlICE9PSBhICYmIHNpZ25hdHVyZSAhPT0gYikge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnbmF0dXJlfScgYXQgMHgke29mZnNldC50b1N0cmluZygxNil9YCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkU2hvcnRTdHJpbmcocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHRsZXQgcmVzdWx0ID0gJyc7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRyZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZmZXJbaV0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQc2QocmVhZGVyOiBQc2RSZWFkZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zID0ge30pIHtcclxuXHQvLyBoZWFkZXJcclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QlBTJyk7XHJcblx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRpZiAodmVyc2lvbiAhPT0gMSAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUFNEIGZpbGUgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRza2lwQnl0ZXMocmVhZGVyLCA2KTtcclxuXHRjb25zdCBjaGFubmVscyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBoZWlnaHQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3Qgd2lkdGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgYml0c1BlckNoYW5uZWwgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgY29sb3JNb2RlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKGNvbG9yTW9kZSkgPT09IC0xKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb2xvciBtb2RlIG5vdCBzdXBwb3J0ZWQ6ICR7Y29sb3JNb2Rlc1tjb2xvck1vZGVdID8/IGNvbG9yTW9kZX1gKTtcclxuXHJcblx0Y29uc3QgcHNkOiBQc2QgPSB7IHdpZHRoLCBoZWlnaHQsIGNoYW5uZWxzLCBiaXRzUGVyQ2hhbm5lbCwgY29sb3JNb2RlIH07XHJcblx0Y29uc3Qgb3B0OiBSZWFkT3B0aW9uc0V4dCA9IHsgLi4ub3B0aW9ucywgbGFyZ2U6IHZlcnNpb24gPT09IDIgfTtcclxuXHJcblx0Ly8gY29sb3IgbW9kZSBkYXRhXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGlmIChvcHQudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHRocm93IG5ldyBFcnJvcignQ29sb3IgbW9kZSBkYXRhIG5vdCBzdXBwb3J0ZWQnKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSk7XHJcblxyXG5cdC8vIGltYWdlIHJlc291cmNlc1xyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdGNvbnN0IHNpZyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRcdGlmIChzaWcgIT09ICc4QklNJyAmJiBzaWcgIT09ICdNZVNhJyAmJiBzaWcgIT09ICdBZ0hnJyAmJiBzaWcgIT09ICdQSFVUJyAmJiBzaWcgIT09ICdEQ1NSJykge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ30nIGF0IDB4JHsocmVhZGVyLm9mZnNldCAtIDQpLnRvU3RyaW5nKDE2KX1gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgaWQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRcdHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAyKTsgLy8gbmFtZVxyXG5cclxuXHRcdFx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdFx0XHRjb25zdCBoYW5kbGVyID0gcmVzb3VyY2VIYW5kbGVyc01hcFtpZF07XHJcblx0XHRcdFx0Y29uc3Qgc2tpcCA9IGlkID09PSAxMDM2ICYmICEhb3B0LnNraXBUaHVtYm5haWw7XHJcblxyXG5cdFx0XHRcdGlmICghcHNkLmltYWdlUmVzb3VyY2VzKSB7XHJcblx0XHRcdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChoYW5kbGVyICYmICFza2lwKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRoYW5kbGVyLnJlYWQocmVhZGVyLCBwc2QuaW1hZ2VSZXNvdXJjZXMsIGxlZnQsIG9wdCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0XHRcdGlmIChvcHQudGhyb3dGb3JNaXNzaW5nRmVhdHVyZXMpIHRocm93IGU7XHJcblx0XHRcdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdC8vIG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKGBVbmhhbmRsZWQgaW1hZ2UgcmVzb3VyY2U6ICR7aWR9YCk7XHJcblx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdC8vIGxheWVyIGFuZCBtYXNrIGluZm9cclxuXHRsZXQgZ2xvYmFsQWxwaGEgPSBmYWxzZTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGdsb2JhbEFscGhhID0gcmVhZExheWVySW5mbyhyZWFkZXIsIHBzZCwgb3B0KTtcclxuXHJcblx0XHQvLyBTQUkgZG9lcyBub3QgaW5jbHVkZSB0aGlzIHNlY3Rpb25cclxuXHRcdGlmIChsZWZ0KCkgPiAwKSB7XHJcblx0XHRcdGNvbnN0IGdsb2JhbExheWVyTWFza0luZm8gPSByZWFkR2xvYmFsTGF5ZXJNYXNrSW5mbyhyZWFkZXIpO1xyXG5cdFx0XHRpZiAoZ2xvYmFsTGF5ZXJNYXNrSW5mbykgcHNkLmdsb2JhbExheWVyTWFza0luZm8gPSBnbG9iYWxMYXllck1hc2tJbmZvO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Ly8gcmV2ZXJ0IGJhY2sgdG8gZW5kIG9mIHNlY3Rpb24gaWYgZXhjZWVkZWQgc2VjdGlvbiBsaW1pdHNcclxuXHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygncmV2ZXJ0aW5nIHRvIGVuZCBvZiBzZWN0aW9uJyk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSA+IDApIHtcclxuXHRcdFx0Ly8gc29tZXRpbWVzIHRoZXJlIGFyZSBlbXB0eSBieXRlcyBoZXJlXHJcblx0XHRcdHdoaWxlIChsZWZ0KCkgJiYgcGVla1VpbnQ4KHJlYWRlcikgPT09IDApIHtcclxuXHRcdFx0XHQvLyBvcHQubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdza2lwcGluZyAwIGJ5dGUnKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAxKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGxlZnQoKSA+PSAxMikge1xyXG5cdFx0XHRcdHJlYWRBZGRpdGlvbmFsTGF5ZXJJbmZvKHJlYWRlciwgcHNkLCBwc2QsIG9wdCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnc2tpcHBpbmcgbGVmdG92ZXIgYnl0ZXMnLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB1bmRlZmluZWQsIG9wdC5sYXJnZSk7XHJcblxyXG5cdGNvbnN0IGhhc0NoaWxkcmVuID0gcHNkLmNoaWxkcmVuICYmIHBzZC5jaGlsZHJlbi5sZW5ndGg7XHJcblx0Y29uc3Qgc2tpcENvbXBvc2l0ZSA9IG9wdC5za2lwQ29tcG9zaXRlSW1hZ2VEYXRhICYmIChvcHQuc2tpcExheWVySW1hZ2VEYXRhIHx8IGhhc0NoaWxkcmVuKTtcclxuXHJcblx0aWYgKCFza2lwQ29tcG9zaXRlKSB7XHJcblx0XHRyZWFkSW1hZ2VEYXRhKHJlYWRlciwgcHNkLCBnbG9iYWxBbHBoYSwgb3B0KTtcclxuXHR9XHJcblxyXG5cdC8vIFRPRE86IHNob3cgY29udmVydGVkIGNvbG9yIG1vZGUgaW5zdGVhZCBvZiBvcmlnaW5hbCBQU0QgZmlsZSBjb2xvciBtb2RlXHJcblx0Ly8gICAgICAgYnV0IGFkZCBvcHRpb24gdG8gcHJlc2VydmUgZmlsZSBjb2xvciBtb2RlIChuZWVkIHRvIHJldHVybiBpbWFnZSBkYXRhIGluc3RlYWQgb2YgY2FudmFzIGluIHRoYXQgY2FzZSlcclxuXHQvLyBwc2QuY29sb3JNb2RlID0gQ29sb3JNb2RlLlJHQjsgLy8gd2UgY29udmVydCBhbGwgY29sb3IgbW9kZXMgdG8gUkdCXHJcblxyXG5cdHJldHVybiBwc2Q7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllckluZm8ocmVhZGVyOiBQc2RSZWFkZXIsIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGxldCBnbG9iYWxBbHBoYSA9IGZhbHNlO1xyXG5cclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDIsIGxlZnQgPT4ge1xyXG5cdFx0bGV0IGxheWVyQ291bnQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHJcblx0XHRpZiAobGF5ZXJDb3VudCA8IDApIHtcclxuXHRcdFx0Z2xvYmFsQWxwaGEgPSB0cnVlO1xyXG5cdFx0XHRsYXllckNvdW50ID0gLWxheWVyQ291bnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgbGF5ZXJzOiBMYXllcltdID0gW107XHJcblx0XHRjb25zdCBsYXllckNoYW5uZWxzOiBDaGFubmVsSW5mb1tdW10gPSBbXTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxheWVyQ291bnQ7IGkrKykge1xyXG5cdFx0XHRjb25zdCB7IGxheWVyLCBjaGFubmVscyB9ID0gcmVhZExheWVyUmVjb3JkKHJlYWRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0bGF5ZXJzLnB1c2gobGF5ZXIpO1xyXG5cdFx0XHRsYXllckNoYW5uZWxzLnB1c2goY2hhbm5lbHMpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICghb3B0aW9ucy5za2lwTGF5ZXJJbWFnZURhdGEpIHtcclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcclxuXHRcdFx0XHRyZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKHJlYWRlciwgcHNkLCBsYXllcnNbaV0sIGxheWVyQ2hhbm5lbHNbaV0sIG9wdGlvbnMpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHJcblx0XHRpZiAoIXBzZC5jaGlsZHJlbikgcHNkLmNoaWxkcmVuID0gW107XHJcblxyXG5cdFx0Y29uc3Qgc3RhY2s6IChMYXllciB8IFBzZClbXSA9IFtwc2RdO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSBsYXllcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuXHRcdFx0Y29uc3QgbCA9IGxheWVyc1tpXTtcclxuXHRcdFx0Y29uc3QgdHlwZSA9IGwuc2VjdGlvbkRpdmlkZXIgPyBsLnNlY3Rpb25EaXZpZGVyLnR5cGUgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3RoZXI7XHJcblx0XHRcdGlmICh0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlciB8fCB0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuQ2xvc2VkRm9sZGVyKSB7XHJcblx0XHRcdFx0bC5vcGVuZWQgPSB0eXBlID09PSBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcjtcclxuXHRcdFx0XHRsLmNoaWxkcmVuID0gW107XHJcblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XHJcblx0XHRcdFx0aWYgKHBhcmVudCAmJiBwYXJlbnQubmFtZSkge1xyXG5cdFx0XHRcdFx0bC5wYXJlbnRQYXRoID0gcGFyZW50Lm5hbWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xyXG5cdFx0XHRcdHN0YWNrLnB1c2gobCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIpIHtcclxuXHRcdFx0XHRzdGFjay5wb3AoKTtcclxuXHRcdFx0XHQvLyB0aGlzIHdhcyB3b3JrYXJvdW5kIGJlY2F1c2UgSSBkaWRuJ3Qga25vdyB3aGF0IGBsc2RrYCBzZWN0aW9uIHdhcywgbm93IGl0J3MgcHJvYmFibHkgbm90IG5lZWRlZCBhbnltb3JlXHJcblx0XHRcdFx0Ly8gfSBlbHNlIGlmIChsLm5hbWUgPT09ICc8L0xheWVyIGdyb3VwPicgJiYgIWwuc2VjdGlvbkRpdmlkZXIgJiYgIWwudG9wICYmICFsLmxlZnQgJiYgIWwuYm90dG9tICYmICFsLnJpZ2h0KSB7XHJcblx0XHRcdFx0Ly8gXHQvLyBzb21ldGltZXMgbGF5ZXIgZ3JvdXAgdGVybWluYXRvciBkb2Vzbid0IGhhdmUgc2VjdGlvbkRpdmlkZXIsIHNvIHdlIGp1c3QgZ3Vlc3MgaGVyZSAoUFMgYnVnID8pXHJcblx0XHRcdFx0Ly8gXHRzdGFjay5wb3AoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcclxuXHRcdFx0XHRpZiAocGFyZW50ICYmIHBhcmVudC5uYW1lKSB7XHJcblx0XHRcdFx0XHRsLnBhcmVudFBhdGggPSBwYXJlbnQubmFtZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0c3RhY2tbc3RhY2subGVuZ3RoIC0gMV0uY2hpbGRyZW4hLnVuc2hpZnQobCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB1bmRlZmluZWQsIG9wdGlvbnMubGFyZ2UpO1xyXG5cclxuXHRyZXR1cm4gZ2xvYmFsQWxwaGE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllclJlY29yZChyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3QgbGF5ZXI6IExheWVyID0ge307XHJcblx0bGF5ZXIudG9wID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0bGF5ZXIubGVmdCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGxheWVyLmJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGxheWVyLnJpZ2h0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblxyXG5cdGNvbnN0IGNoYW5uZWxDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxDb3VudDsgaSsrKSB7XHJcblx0XHRsZXQgY2hhbm5lbElEID0gcmVhZEludDE2KHJlYWRlcikgYXMgQ2hhbm5lbElEO1xyXG5cdFx0bGV0IGNoYW5uZWxMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMubGFyZ2UpIHtcclxuXHRcdFx0aWYgKGNoYW5uZWxMZW5ndGggIT09IDApIHRocm93IG5ldyBFcnJvcignU2l6ZXMgbGFyZ2VyIHRoYW4gNEdCIGFyZSBub3Qgc3VwcG9ydGVkJyk7XHJcblx0XHRcdGNoYW5uZWxMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0Y2hhbm5lbHMucHVzaCh7IGlkOiBjaGFubmVsSUQsIGxlbmd0aDogY2hhbm5lbExlbmd0aCB9KTtcclxuXHR9XHJcblxyXG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcclxuXHRjb25zdCBibGVuZE1vZGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0aWYgKCF0b0JsZW5kTW9kZVtibGVuZE1vZGVdKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYmxlbmQgbW9kZTogJyR7YmxlbmRNb2RlfSdgKTtcclxuXHRsYXllci5ibGVuZE1vZGUgPSB0b0JsZW5kTW9kZVtibGVuZE1vZGVdO1xyXG5cclxuXHRsYXllci5vcGFjaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG5cdGxheWVyLmNsaXBwaW5nID0gcmVhZFVpbnQ4KHJlYWRlcikgPT09IDE7XHJcblxyXG5cdGNvbnN0IGZsYWdzID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0bGF5ZXIudHJhbnNwYXJlbmN5UHJvdGVjdGVkID0gKGZsYWdzICYgMHgwMSkgIT09IDA7XHJcblx0bGF5ZXIuaGlkZGVuID0gKGZsYWdzICYgMHgwMikgIT09IDA7XHJcblx0Ly8gMHgwNCAtIG9ic29sZXRlXHJcblx0Ly8gMHgwOCAtIDEgZm9yIFBob3Rvc2hvcCA1LjAgYW5kIGxhdGVyLCB0ZWxscyBpZiBiaXQgNCBoYXMgdXNlZnVsIGluZm9ybWF0aW9uXHJcblx0Ly8gMHgxMCAtIHBpeGVsIGRhdGEgaXJyZWxldmFudCB0byBhcHBlYXJhbmNlIG9mIGRvY3VtZW50XHJcblxyXG5cdHNraXBCeXRlcyhyZWFkZXIsIDEpO1xyXG5cclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0Y29uc3QgbWFzayA9IHJlYWRMYXllck1hc2tEYXRhKHJlYWRlciwgb3B0aW9ucyk7XHJcblx0XHRpZiAobWFzaykgbGF5ZXIubWFzayA9IG1hc2s7XHJcblxyXG5cdFx0Lypjb25zdCBibGVuZGluZ1JhbmdlcyA9Ki8gcmVhZExheWVyQmxlbmRpbmdSYW5nZXMocmVhZGVyKTtcclxuXHRcdGxheWVyLm5hbWUgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgNCk7XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRyZWFkQWRkaXRpb25hbExheWVySW5mbyhyZWFkZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRyZXR1cm4geyBsYXllciwgY2hhbm5lbHMgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExheWVyTWFza0RhdGEocmVhZGVyOiBQc2RSZWFkZXIsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uPExheWVyTWFza0RhdGEgfCB1bmRlZmluZWQ+KHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRjb25zdCBtYXNrOiBMYXllck1hc2tEYXRhID0ge307XHJcblx0XHRtYXNrLnRvcCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5sZWZ0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRtYXNrLmJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5yaWdodCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5kZWZhdWx0Q29sb3IgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHJcblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0bWFzay5wb3NpdGlvblJlbGF0aXZlVG9MYXllciA9IChmbGFncyAmIExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyKSAhPT0gMDtcclxuXHRcdG1hc2suZGlzYWJsZWQgPSAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5MYXllck1hc2tEaXNhYmxlZCkgIT09IDA7XHJcblx0XHRtYXNrLmZyb21WZWN0b3JEYXRhID0gKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRnJvbVJlbmRlcmluZ090aGVyRGF0YSkgIT09IDA7XHJcblxyXG5cdFx0aWYgKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTWFza0hhc1BhcmFtZXRlcnNBcHBsaWVkVG9JdCkge1xyXG5cdFx0XHRjb25zdCBwYXJhbXMgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVXNlck1hc2tEZW5zaXR5KSBtYXNrLnVzZXJNYXNrRGVuc2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyKSBtYXNrLnVzZXJNYXNrRmVhdGhlciA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlZlY3Rvck1hc2tEZW5zaXR5KSBtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG5cdFx0XHRpZiAocGFyYW1zICYgTWFza1BhcmFtcy5WZWN0b3JNYXNrRmVhdGhlcikgbWFzay52ZWN0b3JNYXNrRmVhdGhlciA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnQoKSA+IDIpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBleHRyYSBtYXNrIHBhcmFtcycpO1xyXG5cdFx0XHQvLyBUT0RPOiBoYW5kbGUgdGhlc2UgdmFsdWVzXHJcblx0XHRcdC8qY29uc3QgcmVhbEZsYWdzID0qLyByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCByZWFsVXNlck1hc2tCYWNrZ3JvdW5kID0qLyByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCB0b3AyID0qLyByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCBsZWZ0MiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgYm90dG9tMiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcmlnaHQyID0qLyByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0cmV0dXJuIG1hc2s7XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllckJsZW5kaW5nUmFuZ2VzKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRjb25zdCBjb21wb3NpdGVHcmF5QmxlbmRTb3VyY2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjb21wb3NpdGVHcmFwaEJsZW5kRGVzdGluYXRpb25SYW5nZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHJhbmdlcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkpIHtcclxuXHRcdFx0Y29uc3Qgc291cmNlUmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGRlc3RSYW5nZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0cmFuZ2VzLnB1c2goeyBzb3VyY2VSYW5nZSwgZGVzdFJhbmdlIH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7IGNvbXBvc2l0ZUdyYXlCbGVuZFNvdXJjZSwgY29tcG9zaXRlR3JhcGhCbGVuZERlc3RpbmF0aW9uUmFuZ2UsIHJhbmdlcyB9O1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJDaGFubmVsSW1hZ2VEYXRhKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgbGF5ZXI6IExheWVyLCBjaGFubmVsczogQ2hhbm5lbEluZm9bXSwgb3B0aW9uczogUmVhZE9wdGlvbnNFeHRcclxuKSB7XHJcblx0Y29uc3QgbGF5ZXJXaWR0aCA9IChsYXllci5yaWdodCB8fCAwKSAtIChsYXllci5sZWZ0IHx8IDApO1xyXG5cdGNvbnN0IGxheWVySGVpZ2h0ID0gKGxheWVyLmJvdHRvbSB8fCAwKSAtIChsYXllci50b3AgfHwgMCk7XHJcblx0Y29uc3QgY215ayA9IHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5DTVlLO1xyXG5cclxuXHRsZXQgaW1hZ2VEYXRhOiBJbWFnZURhdGEgfCB1bmRlZmluZWQ7XHJcblxyXG5cdGlmIChsYXllcldpZHRoICYmIGxheWVySGVpZ2h0KSB7XHJcblx0XHRpZiAoY215aykge1xyXG5cdFx0XHRpbWFnZURhdGEgPSB7IHdpZHRoOiBsYXllcldpZHRoLCBoZWlnaHQ6IGxheWVySGVpZ2h0LCBkYXRhOiBuZXcgVWludDhDbGFtcGVkQXJyYXkobGF5ZXJXaWR0aCAqIGxheWVySGVpZ2h0ICogNSkgfTtcclxuXHRcdFx0Zm9yIChsZXQgcCA9IDQ7IHAgPCBpbWFnZURhdGEuZGF0YS5ieXRlTGVuZ3RoOyBwICs9IDUpIGltYWdlRGF0YS5kYXRhW3BdID0gMjU1O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aW1hZ2VEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKGxheWVyV2lkdGgsIGxheWVySGVpZ2h0KTtcclxuXHRcdFx0cmVzZXRJbWFnZURhdGEoaW1hZ2VEYXRhKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChSQVdfSU1BR0VfREFUQSkgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3ID0gW107XHJcblxyXG5cdGZvciAoY29uc3QgY2hhbm5lbCBvZiBjaGFubmVscykge1xyXG5cdFx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29tcHJlc3Npb247XHJcblxyXG5cdFx0aWYgKGNoYW5uZWwuaWQgPT09IENoYW5uZWxJRC5Vc2VyTWFzaykge1xyXG5cdFx0XHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcclxuXHJcblx0XHRcdGlmICghbWFzaykgdGhyb3cgbmV3IEVycm9yKGBNaXNzaW5nIGxheWVyIG1hc2sgZGF0YWApO1xyXG5cclxuXHRcdFx0Y29uc3QgbWFza1dpZHRoID0gKG1hc2sucmlnaHQgfHwgMCkgLSAobWFzay5sZWZ0IHx8IDApO1xyXG5cdFx0XHRjb25zdCBtYXNrSGVpZ2h0ID0gKG1hc2suYm90dG9tIHx8IDApIC0gKG1hc2sudG9wIHx8IDApO1xyXG5cclxuXHRcdFx0aWYgKG1hc2tXaWR0aCAmJiBtYXNrSGVpZ2h0KSB7XHJcblx0XHRcdFx0Y29uc3QgbWFza0RhdGEgPSBjcmVhdGVJbWFnZURhdGEobWFza1dpZHRoLCBtYXNrSGVpZ2h0KTtcclxuXHRcdFx0XHRyZXNldEltYWdlRGF0YShtYXNrRGF0YSk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHN0YXJ0ID0gcmVhZGVyLm9mZnNldDtcclxuXHRcdFx0XHRyZWFkRGF0YShyZWFkZXIsIG1hc2tEYXRhLCBjb21wcmVzc2lvbiwgbWFza1dpZHRoLCBtYXNrSGVpZ2h0LCAwLCBvcHRpb25zLmxhcmdlLCA0KTtcclxuXHJcblx0XHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSB7XHJcblx0XHRcdFx0XHQobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0c2V0dXBHcmF5c2NhbGUobWFza0RhdGEpO1xyXG5cclxuXHRcdFx0XHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdFx0XHRcdG1hc2suaW1hZ2VEYXRhID0gbWFza0RhdGE7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1hc2suY2FudmFzID0gY3JlYXRlQ2FudmFzKG1hc2tXaWR0aCwgbWFza0hlaWdodCk7XHJcblx0XHRcdFx0XHRtYXNrLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEobWFza0RhdGEsIDAsIDApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsLmlkLCBjbXlrKTtcclxuXHRcdFx0bGV0IHRhcmdldERhdGEgPSBpbWFnZURhdGE7XHJcblxyXG5cdFx0XHRpZiAob2Zmc2V0IDwgMCkge1xyXG5cdFx0XHRcdHRhcmdldERhdGEgPSB1bmRlZmluZWQ7XHJcblxyXG5cdFx0XHRcdGlmIChvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB7XHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENoYW5uZWwgbm90IHN1cHBvcnRlZDogJHtjaGFubmVsLmlkfWApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRyZWFkRGF0YShyZWFkZXIsIHRhcmdldERhdGEsIGNvbXByZXNzaW9uLCBsYXllcldpZHRoLCBsYXllckhlaWdodCwgb2Zmc2V0LCBvcHRpb25zLmxhcmdlLCBjbXlrID8gNSA6IDQpO1xyXG5cclxuXHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSB7XHJcblx0XHRcdFx0KGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3W2NoYW5uZWwuaWRdID0gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgc3RhcnQsIHJlYWRlci5vZmZzZXQgLSBzdGFydCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0YXJnZXREYXRhICYmIHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUpIHtcclxuXHRcdFx0XHRzZXR1cEdyYXlzY2FsZSh0YXJnZXREYXRhKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKGltYWdlRGF0YSkge1xyXG5cdFx0aWYgKGNteWspIHtcclxuXHRcdFx0Y29uc3QgY215a0RhdGEgPSBpbWFnZURhdGE7XHJcblx0XHRcdGltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShjbXlrRGF0YS53aWR0aCwgY215a0RhdGEuaGVpZ2h0KTtcclxuXHRcdFx0Y215a1RvUmdiKGNteWtEYXRhLCBpbWFnZURhdGEsIGZhbHNlKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdFx0bGF5ZXIuaW1hZ2VEYXRhID0gaW1hZ2VEYXRhO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXIuY2FudmFzID0gY3JlYXRlQ2FudmFzKGxheWVyV2lkdGgsIGxheWVySGVpZ2h0KTtcclxuXHRcdFx0bGF5ZXIuY2FudmFzLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShpbWFnZURhdGEsIDAsIDApO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZERhdGEoXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIGRhdGE6IEltYWdlRGF0YSB8IHVuZGVmaW5lZCwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcixcclxuXHRvZmZzZXQ6IG51bWJlciwgbGFyZ2U6IGJvb2xlYW4sIHN0ZXA6IG51bWJlclxyXG4pIHtcclxuXHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdHJlYWREYXRhUmF3KHJlYWRlciwgZGF0YSwgb2Zmc2V0LCB3aWR0aCwgaGVpZ2h0LCBzdGVwKTtcclxuXHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIHN0ZXAsIFtvZmZzZXRdLCBsYXJnZSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29tcHJlc3Npb24gdHlwZSBub3Qgc3VwcG9ydGVkOiAke2NvbXByZXNzaW9ufWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEdsb2JhbExheWVyTWFza0luZm8ocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZFNlY3Rpb248R2xvYmFsTGF5ZXJNYXNrSW5mbyB8IHVuZGVmaW5lZD4ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdGlmICghbGVmdCgpKSByZXR1cm4gdW5kZWZpbmVkO1xyXG5cclxuXHRcdGNvbnN0IG92ZXJsYXlDb2xvclNwYWNlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTEgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjb2xvclNwYWNlMiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2UzID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZjtcclxuXHRcdGNvbnN0IGtpbmQgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7IC8vIDMgYnl0ZXMgb2YgcGFkZGluZyA/XHJcblx0XHRyZXR1cm4geyBvdmVybGF5Q29sb3JTcGFjZSwgY29sb3JTcGFjZTEsIGNvbG9yU3BhY2UyLCBjb2xvclNwYWNlMywgY29sb3JTcGFjZTQsIG9wYWNpdHksIGtpbmQgfTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEFkZGl0aW9uYWxMYXllckluZm8ocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3Qgc2lnID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdGlmIChzaWcgIT09ICc4QklNJyAmJiBzaWcgIT09ICc4QjY0JykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnfScgYXQgMHgkeyhyZWFkZXIub2Zmc2V0IC0gNCkudG9TdHJpbmcoMTYpfWApO1xyXG5cdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0Ly8gYGxhcmdlQWRkaXRpb25hbEluZm9LZXlzYCBmYWxsYmFjaywgYmVjYXVzZSBzb21lIGtleXMgZG9uJ3QgaGF2ZSA4QjY0IHNpZ25hdHVyZSBldmVuIHdoZW4gdGhleSBhcmUgNjRiaXRcclxuXHRjb25zdCB1NjQgPSBzaWcgPT09ICc4QjY0JyB8fCAob3B0aW9ucy5sYXJnZSAmJiBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cy5pbmRleE9mKGtleSkgIT09IC0xKTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdGNvbnN0IGhhbmRsZXIgPSBpbmZvSGFuZGxlcnNNYXBba2V5XTtcclxuXHJcblx0XHRpZiAoaGFuZGxlcikge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGhhbmRsZXIucmVhZChyZWFkZXIsIHRhcmdldCwgbGVmdCwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdGlmIChvcHRpb25zLnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBlO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5oYW5kbGVkIGFkZGl0aW9uYWwgaW5mbzogJHtrZXl9YCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnQoKSkge1xyXG5cdFx0XHRvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5yZWFkICR7bGVmdCgpfSBieXRlcyBsZWZ0IGZvciBhZGRpdGlvbmFsIGluZm86ICR7a2V5fWApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cdH0sIGZhbHNlLCB1NjQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkSW1hZ2VEYXRhKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgZ2xvYmFsQWxwaGE6IGJvb2xlYW4sIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0KSB7XHJcblx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDE2KHJlYWRlcikgYXMgQ29tcHJlc3Npb247XHJcblxyXG5cdGlmIChzdXBwb3J0ZWRDb2xvck1vZGVzLmluZGV4T2YocHNkLmNvbG9yTW9kZSEpID09PSAtMSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke3BzZC5jb2xvck1vZGV9YCk7XHJcblxyXG5cdGlmIChjb21wcmVzc2lvbiAhPT0gQ29tcHJlc3Npb24uUmF3RGF0YSAmJiBjb21wcmVzc2lvbiAhPT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZClcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29tcHJlc3Npb24gdHlwZSBub3Qgc3VwcG9ydGVkOiAke2NvbXByZXNzaW9ufWApO1xyXG5cclxuXHRjb25zdCBpbWFnZURhdGEgPSBjcmVhdGVJbWFnZURhdGEocHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRyZXNldEltYWdlRGF0YShpbWFnZURhdGEpO1xyXG5cclxuXHRzd2l0Y2ggKHBzZC5jb2xvck1vZGUpIHtcclxuXHRcdGNhc2UgQ29sb3JNb2RlLkJpdG1hcDoge1xyXG5cdFx0XHRsZXQgYnl0ZXM6IFVpbnQ4QXJyYXk7XHJcblxyXG5cdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdFx0XHRieXRlcyA9IHJlYWRCeXRlcyhyZWFkZXIsIE1hdGguY2VpbChwc2Qud2lkdGggLyA4KSAqIHBzZC5oZWlnaHQpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Ynl0ZXMgPSBuZXcgVWludDhBcnJheShwc2Qud2lkdGggKiBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIHsgZGF0YTogYnl0ZXMsIHdpZHRoOiBwc2Qud2lkdGgsIGhlaWdodDogcHNkLmhlaWdodCB9LCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDEsIFswXSwgb3B0aW9ucy5sYXJnZSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBCaXRtYXAgY29tcHJlc3Npb24gbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZGVjb2RlQml0bWFwKGJ5dGVzLCBpbWFnZURhdGEuZGF0YSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yTW9kZS5SR0I6XHJcblx0XHRjYXNlIENvbG9yTW9kZS5HcmF5c2NhbGU6IHtcclxuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlID8gWzBdIDogWzAsIDEsIDJdO1xyXG5cclxuXHRcdFx0aWYgKHBzZC5jaGFubmVscyAmJiBwc2QuY2hhbm5lbHMgPiAzKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDM7IGkgPCBwc2QuY2hhbm5lbHM7IGkrKykge1xyXG5cdFx0XHRcdFx0Ly8gVE9ETzogc3RvcmUgdGhlc2UgY2hhbm5lbHMgaW4gYWRkaXRpb25hbCBpbWFnZSBkYXRhXHJcblx0XHRcdFx0XHRjaGFubmVscy5wdXNoKGkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmIChnbG9iYWxBbHBoYSkge1xyXG5cdFx0XHRcdGNoYW5uZWxzLnB1c2goMyk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmF3RGF0YSkge1xyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdHJlYWREYXRhUmF3KHJlYWRlciwgaW1hZ2VEYXRhLCBjaGFubmVsc1tpXSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCA0KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpIHtcclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBpbWFnZURhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgNCwgY2hhbm5lbHMsIG9wdGlvbnMubGFyZ2UpO1xyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSkge1xyXG5cdFx0XHRcdHNldHVwR3JheXNjYWxlKGltYWdlRGF0YSk7XHJcblx0XHRcdH1cclxuXHRcdFx0YnJlYWs7XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yTW9kZS5DTVlLOiB7XHJcblx0XHRcdGlmIChwc2QuY2hhbm5lbHMgIT09IDQpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjaGFubmVsIGNvdW50YCk7XHJcblxyXG5cdFx0XHRjb25zdCBjaGFubmVscyA9IFswLCAxLCAyLCAzXTtcclxuXHRcdFx0aWYgKGdsb2JhbEFscGhhKSBjaGFubmVscy5wdXNoKDQpO1xyXG5cclxuXHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOb3QgaW1wbGVtZW50ZWRgKTtcclxuXHRcdFx0XHQvLyBUT0RPOiAuLi5cclxuXHRcdFx0XHQvLyBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0Ly8gXHRyZWFkRGF0YVJhdyhyZWFkZXIsIGltYWdlRGF0YSwgY2hhbm5lbHNbaV0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Y29uc3QgY215a0ltYWdlRGF0YTogUGl4ZWxEYXRhID0ge1xyXG5cdFx0XHRcdFx0d2lkdGg6IGltYWdlRGF0YS53aWR0aCxcclxuXHRcdFx0XHRcdGhlaWdodDogaW1hZ2VEYXRhLmhlaWdodCxcclxuXHRcdFx0XHRcdGRhdGE6IG5ldyBVaW50OEFycmF5KGltYWdlRGF0YS53aWR0aCAqIGltYWdlRGF0YS5oZWlnaHQgKiA1KSxcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBjbXlrSW1hZ2VEYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDUsIGNoYW5uZWxzLCBvcHRpb25zLmxhcmdlKTtcclxuXHRcdFx0XHRjbXlrVG9SZ2IoY215a0ltYWdlRGF0YSwgaW1hZ2VEYXRhLCB0cnVlKTtcclxuXHJcblx0XHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBKSAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3ID0gbmV3IFVpbnQ4QXJyYXkocmVhZGVyLnZpZXcuYnVmZmVyLCByZWFkZXIudmlldy5ieXRlT2Zmc2V0ICsgc3RhcnQsIHJlYWRlci5vZmZzZXQgLSBzdGFydCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0ZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKGBDb2xvciBtb2RlIG5vdCBzdXBwb3J0ZWQ6ICR7cHNkLmNvbG9yTW9kZX1gKTtcclxuXHR9XHJcblxyXG5cdGlmIChvcHRpb25zLnVzZUltYWdlRGF0YSkge1xyXG5cdFx0cHNkLmltYWdlRGF0YSA9IGltYWdlRGF0YTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cHNkLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xyXG5cdFx0cHNkLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNteWtUb1JnYihjbXlrOiBQaXhlbERhdGEsIHJnYjogUGl4ZWxEYXRhLCByZXZlcnNlQWxwaGE6IGJvb2xlYW4pIHtcclxuXHRjb25zdCBzaXplID0gcmdiLndpZHRoICogcmdiLmhlaWdodCAqIDQ7XHJcblx0Y29uc3Qgc3JjRGF0YSA9IGNteWsuZGF0YTtcclxuXHRjb25zdCBkc3REYXRhID0gcmdiLmRhdGE7XHJcblxyXG5cdGZvciAobGV0IHNyYyA9IDAsIGRzdCA9IDA7IGRzdCA8IHNpemU7IHNyYyArPSA1LCBkc3QgKz0gNCkge1xyXG5cdFx0Y29uc3QgYyA9IHNyY0RhdGFbc3JjXTtcclxuXHRcdGNvbnN0IG0gPSBzcmNEYXRhW3NyYyArIDFdO1xyXG5cdFx0Y29uc3QgeSA9IHNyY0RhdGFbc3JjICsgMl07XHJcblx0XHRjb25zdCBrID0gc3JjRGF0YVtzcmMgKyAzXTtcclxuXHRcdGRzdERhdGFbZHN0XSA9ICgoKChjICogaykgfCAwKSAvIDI1NSkgfCAwKTtcclxuXHRcdGRzdERhdGFbZHN0ICsgMV0gPSAoKCgobSAqIGspIHwgMCkgLyAyNTUpIHwgMCk7XHJcblx0XHRkc3REYXRhW2RzdCArIDJdID0gKCgoKHkgKiBrKSB8IDApIC8gMjU1KSB8IDApO1xyXG5cdFx0ZHN0RGF0YVtkc3QgKyAzXSA9IHJldmVyc2VBbHBoYSA/IDI1NSAtIHNyY0RhdGFbc3JjICsgNF0gOiBzcmNEYXRhW3NyYyArIDRdO1xyXG5cdH1cclxuXHJcblx0Ly8gZm9yIChsZXQgc3JjID0gMCwgZHN0ID0gMDsgZHN0IDwgc2l6ZTsgc3JjICs9IDUsIGRzdCArPSA0KSB7XHJcblx0Ly8gXHRjb25zdCBjID0gMSAtIChzcmNEYXRhW3NyYyArIDBdIC8gMjU1KTtcclxuXHQvLyBcdGNvbnN0IG0gPSAxIC0gKHNyY0RhdGFbc3JjICsgMV0gLyAyNTUpO1xyXG5cdC8vIFx0Y29uc3QgeSA9IDEgLSAoc3JjRGF0YVtzcmMgKyAyXSAvIDI1NSk7XHJcblx0Ly8gXHQvLyBjb25zdCBrID0gc3JjRGF0YVtzcmMgKyAzXSAvIDI1NTtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgMF0gPSAoKDEgLSBjICogMC44KSAqIDI1NSkgfCAwO1xyXG5cdC8vIFx0ZHN0RGF0YVtkc3QgKyAxXSA9ICgoMSAtIG0gKiAwLjgpICogMjU1KSB8IDA7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDJdID0gKCgxIC0geSAqIDAuOCkgKiAyNTUpIHwgMDtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgM10gPSByZXZlcnNlQWxwaGEgPyAyNTUgLSBzcmNEYXRhW3NyYyArIDRdIDogc3JjRGF0YVtzcmMgKyA0XTtcclxuXHQvLyB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWREYXRhUmF3KHJlYWRlcjogUHNkUmVhZGVyLCBwaXhlbERhdGE6IFBpeGVsRGF0YSB8IHVuZGVmaW5lZCwgb2Zmc2V0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBzdGVwOiBudW1iZXIpIHtcclxuXHRjb25zdCBzaXplID0gd2lkdGggKiBoZWlnaHQ7XHJcblx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgc2l6ZSk7XHJcblxyXG5cdGlmIChwaXhlbERhdGEgJiYgb2Zmc2V0IDwgc3RlcCkge1xyXG5cdFx0Y29uc3QgZGF0YSA9IHBpeGVsRGF0YS5kYXRhO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwLCBwID0gb2Zmc2V0IHwgMDsgaSA8IHNpemU7IGkrKywgcCA9IChwICsgc3RlcCkgfCAwKSB7XHJcblx0XHRcdGRhdGFbcF0gPSBidWZmZXJbaV07XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZERhdGFSTEUoXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIHBpeGVsRGF0YTogUGl4ZWxEYXRhIHwgdW5kZWZpbmVkLCBfd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHN0ZXA6IG51bWJlciwgb2Zmc2V0czogbnVtYmVyW10sXHJcblx0bGFyZ2U6IGJvb2xlYW5cclxuKSB7XHJcblx0Y29uc3QgZGF0YSA9IHBpeGVsRGF0YSAmJiBwaXhlbERhdGEuZGF0YTtcclxuXHRsZXQgbGVuZ3RoczogVWludDE2QXJyYXkgfCBVaW50MzJBcnJheTtcclxuXHJcblx0aWYgKGxhcmdlKSB7XHJcblx0XHRsZW5ndGhzID0gbmV3IFVpbnQzMkFycmF5KG9mZnNldHMubGVuZ3RoICogaGVpZ2h0KTtcclxuXHJcblx0XHRmb3IgKGxldCBvID0gMCwgbGkgPSAwOyBvIDwgb2Zmc2V0cy5sZW5ndGg7IG8rKykge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0bGVuZ3Roc1tsaV0gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0bGVuZ3RocyA9IG5ldyBVaW50MTZBcnJheShvZmZzZXRzLmxlbmd0aCAqIGhlaWdodCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgbyA9IDAsIGxpID0gMDsgbyA8IG9mZnNldHMubGVuZ3RoOyBvKyspIHtcclxuXHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGxlbmd0aHNbbGldID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjb25zdCBleHRyYUxpbWl0ID0gKHN0ZXAgLSAxKSB8IDA7IC8vIDMgZm9yIHJnYiwgNCBmb3IgY215a1xyXG5cclxuXHRmb3IgKGxldCBjID0gMCwgbGkgPSAwOyBjIDwgb2Zmc2V0cy5sZW5ndGg7IGMrKykge1xyXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0c1tjXSB8IDA7XHJcblx0XHRjb25zdCBleHRyYSA9IGMgPiBleHRyYUxpbWl0IHx8IG9mZnNldCA+IGV4dHJhTGltaXQ7XHJcblxyXG5cdFx0aWYgKCFkYXRhIHx8IGV4dHJhKSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyssIGxpKyspIHtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZW5ndGhzW2xpXSk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwLCBwID0gb2Zmc2V0IHwgMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0Y29uc3QgbGVuZ3RoID0gbGVuZ3Roc1tsaV07XHJcblx0XHRcdFx0Y29uc3QgYnVmZmVyID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcclxuXHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0bGV0IGhlYWRlciA9IGJ1ZmZlcltpXTtcclxuXHJcblx0XHRcdFx0XHRpZiAoaGVhZGVyID4gMTI4KSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gYnVmZmVyWysraV07XHJcblx0XHRcdFx0XHRcdGhlYWRlciA9ICgyNTYgLSBoZWFkZXIpIHwgMDtcclxuXHJcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDw9IGhlYWRlcjsgaiA9IChqICsgMSkgfCAwKSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtwXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIHN0ZXApIHwgMDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIGlmIChoZWFkZXIgPCAxMjgpIHtcclxuXHRcdFx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPD0gaGVhZGVyOyBqID0gKGogKyAxKSB8IDApIHtcclxuXHRcdFx0XHRcdFx0XHRkYXRhW3BdID0gYnVmZmVyWysraV07XHJcblx0XHRcdFx0XHRcdFx0cCA9IChwICsgc3RlcCkgfCAwO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHQvLyBpZ25vcmUgMTI4XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKGkgPj0gbGVuZ3RoKSB7XHJcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBSTEUgZGF0YTogZXhjZWVkZWQgYnVmZmVyIHNpemUgJHtpfS8ke2xlbmd0aH1gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkU2VjdGlvbjxUPihcclxuXHRyZWFkZXI6IFBzZFJlYWRlciwgcm91bmQ6IG51bWJlciwgZnVuYzogKGxlZnQ6ICgpID0+IG51bWJlcikgPT4gVCwgc2tpcEVtcHR5ID0gdHJ1ZSwgZWlnaHRCeXRlcyA9IGZhbHNlXHJcbik6IFQgfCB1bmRlZmluZWQge1xyXG5cdGxldCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdGlmIChlaWdodEJ5dGVzKSB7XHJcblx0XHRpZiAobGVuZ3RoICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ1NpemVzIGxhcmdlciB0aGFuIDRHQiBhcmUgbm90IHN1cHBvcnRlZCcpO1xyXG5cdFx0bGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdH1cclxuXHJcblx0aWYgKGxlbmd0aCA8PSAwICYmIHNraXBFbXB0eSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0bGV0IGVuZCA9IHJlYWRlci5vZmZzZXQgKyBsZW5ndGg7XHJcblx0Y29uc3QgcmVzdWx0ID0gZnVuYygoKSA9PiBlbmQgLSByZWFkZXIub2Zmc2V0KTtcclxuXHJcblx0aWYgKHJlYWRlci5vZmZzZXQgPiBlbmQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIHNlY3Rpb24gbGltaXRzJyk7XHJcblxyXG5cdGlmIChyZWFkZXIub2Zmc2V0ICE9PSBlbmQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFVucmVhZCBzZWN0aW9uIGRhdGE6ICR7ZW5kIC0gcmVhZGVyLm9mZnNldH0gYnl0ZXMgYXQgMHgke3JlYWRlci5vZmZzZXQudG9TdHJpbmcoMTYpfWApO1xyXG5cclxuXHR3aGlsZSAoZW5kICUgcm91bmQpIGVuZCsrO1xyXG5cclxuXHRyZWFkZXIub2Zmc2V0ID0gZW5kO1xyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQ29sb3IocmVhZGVyOiBQc2RSZWFkZXIpOiBDb2xvciB7XHJcblx0Y29uc3QgY29sb3JTcGFjZSA9IHJlYWRVaW50MTYocmVhZGVyKSBhcyBDb2xvclNwYWNlO1xyXG5cclxuXHRzd2l0Y2ggKGNvbG9yU3BhY2UpIHtcclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5SR0I6IHtcclxuXHRcdFx0Y29uc3QgciA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgZyA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgYiA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XHJcblx0XHRcdHJldHVybiB7IHIsIGcsIGIgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5IU0I6IHtcclxuXHRcdFx0Y29uc3QgaCA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0Y29uc3QgcyA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0Y29uc3QgYiA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmZmZjtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XHJcblx0XHRcdHJldHVybiB7IGgsIHMsIGIgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5DTVlLOiB7XHJcblx0XHRcdGNvbnN0IGMgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IG0gPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IHkgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdGNvbnN0IGsgPSByZWFkVWludDE2KHJlYWRlcikgLyAyNTc7XHJcblx0XHRcdHJldHVybiB7IGMsIG0sIHksIGsgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5MYWI6IHtcclxuXHRcdFx0Y29uc3QgbCA9IHJlYWRJbnQxNihyZWFkZXIpIC8gMTAwMDA7XHJcblx0XHRcdGNvbnN0IHRhID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IHRiID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGEgPSB0YSA8IDAgPyAodGEgLyAxMjgwMCkgOiAodGEgLyAxMjcwMCk7XHJcblx0XHRcdGNvbnN0IGIgPSB0YiA8IDAgPyAodGIgLyAxMjgwMCkgOiAodGIgLyAxMjcwMCk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdFx0XHRyZXR1cm4geyBsLCBhLCBiIH07XHJcblx0XHR9XHJcblx0XHRjYXNlIENvbG9yU3BhY2UuR3JheXNjYWxlOiB7XHJcblx0XHRcdGNvbnN0IGsgPSByZWFkVWludDE2KHJlYWRlcikgKiAyNTUgLyAxMDAwMDtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XHJcblx0XHRcdHJldHVybiB7IGsgfTtcclxuXHRcdH1cclxuXHRcdGRlZmF1bHQ6XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciBzcGFjZScpO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQYXR0ZXJuKHJlYWRlcjogUHNkUmVhZGVyKTogUGF0dGVybkluZm8ge1xyXG5cdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gbGVuZ3RoXHJcblx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRpZiAodmVyc2lvbiAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBhdHRlcm4gdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRjb25zdCBjb2xvck1vZGUgPSByZWFkVWludDMyKHJlYWRlcikgYXMgQ29sb3JNb2RlO1xyXG5cdGNvbnN0IHggPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCB5ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblxyXG5cdC8vIHdlIG9ubHkgc3VwcG9ydCBSR0IgYW5kIGdyYXlzY2FsZSBmb3Igbm93XHJcblx0aWYgKGNvbG9yTW9kZSAhPT0gQ29sb3JNb2RlLlJHQiAmJiBjb2xvck1vZGUgIT09IENvbG9yTW9kZS5HcmF5c2NhbGUgJiYgY29sb3JNb2RlICE9PSBDb2xvck1vZGUuSW5kZXhlZCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwYXR0ZXJuIGNvbG9yIG1vZGU6ICR7Y29sb3JNb2RlfWApO1xyXG5cdH1cclxuXHJcblx0bGV0IG5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cdGNvbnN0IHBhbGV0dGU6IFJHQltdID0gW107XHJcblxyXG5cdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5JbmRleGVkKSB7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDI1NjsgaSsrKSB7XHJcblx0XHRcdHBhbGV0dGUucHVzaCh7XHJcblx0XHRcdFx0cjogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdFx0ZzogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdFx0YjogcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDQpOyAvLyBubyBpZGVhIHdoYXQgdGhpcyBpc1xyXG5cdH1cclxuXHJcblx0Ly8gdmlydHVhbCBtZW1vcnkgYXJyYXkgbGlzdFxyXG5cdGNvbnN0IHZlcnNpb24yID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uMiAhPT0gMykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBhdHRlcm4gVk1BTCB2ZXJzaW9uOiAke3ZlcnNpb24yfWApO1xyXG5cclxuXHRyZWFkVWludDMyKHJlYWRlcik7IC8vIGxlbmd0aFxyXG5cdGNvbnN0IHRvcCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBsZWZ0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGJvdHRvbSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCByaWdodCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBjaGFubmVsc0NvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xyXG5cdGNvbnN0IGhlaWdodCA9IGJvdHRvbSAtIHRvcDtcclxuXHRjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkod2lkdGggKiBoZWlnaHQgKiA0KTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDM7IGkgPCBkYXRhLmJ5dGVMZW5ndGg7IGkgKz0gNCkge1xyXG5cdFx0ZGF0YVtpXSA9IDI1NTtcclxuXHR9XHJcblxyXG5cdGZvciAobGV0IGkgPSAwLCBjaCA9IDA7IGkgPCAoY2hhbm5lbHNDb3VudCArIDIpOyBpKyspIHtcclxuXHRcdGNvbnN0IGhhcyA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGlmICghaGFzKSBjb250aW51ZTtcclxuXHJcblx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBwaXhlbERlcHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY3RvcCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNsZWZ0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY2JvdHRvbSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNyaWdodCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHBpeGVsRGVwdGgyID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29tcHJlc3Npb25Nb2RlID0gcmVhZFVpbnQ4KHJlYWRlcik7IC8vIDAgLSByYXcsIDEgLSB6aXBcclxuXHRcdGNvbnN0IGRhdGFMZW5ndGggPSBsZW5ndGggLSAoNCArIDE2ICsgMiArIDEpO1xyXG5cdFx0Y29uc3QgY2RhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBkYXRhTGVuZ3RoKTtcclxuXHJcblx0XHRpZiAocGl4ZWxEZXB0aCAhPT0gOCB8fCBwaXhlbERlcHRoMiAhPT0gOCkge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJzE2Yml0IHBpeGVsIGRlcHRoIG5vdCBzdXBwb3J0ZWQgZm9yIHBhdHRlcm5zJyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgdyA9IGNyaWdodCAtIGNsZWZ0O1xyXG5cdFx0Y29uc3QgaCA9IGNib3R0b20gLSBjdG9wO1xyXG5cdFx0Y29uc3Qgb3ggPSBjbGVmdCAtIGxlZnQ7XHJcblx0XHRjb25zdCBveSA9IGN0b3AgLSB0b3A7XHJcblxyXG5cdFx0aWYgKGNvbXByZXNzaW9uTW9kZSA9PT0gMCkge1xyXG5cdFx0XHRpZiAoY29sb3JNb2RlID09PSBDb2xvck1vZGUuUkdCICYmIGNoIDwgMykge1xyXG5cdFx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaDsgeSsrKSB7XHJcblx0XHRcdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHc7IHgrKykge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBzcmMgPSB4ICsgeSAqIHc7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGRzdCA9IChveCArIHggKyAoeSArIG95KSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgY2hdID0gY2RhdGFbc3JjXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUgJiYgY2ggPCAxKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoOyB5KyspIHtcclxuXHRcdFx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgdzsgeCsrKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHNyYyA9IHggKyB5ICogdztcclxuXHRcdFx0XHRcdFx0Y29uc3QgZHN0ID0gKG94ICsgeCArICh5ICsgb3kpICogd2lkdGgpICogNDtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdmFsdWUgPSBjZGF0YVtzcmNdO1xyXG5cdFx0XHRcdFx0XHRkYXRhW2RzdCArIDBdID0gdmFsdWU7XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgMV0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0ZGF0YVtkc3QgKyAyXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkluZGV4ZWQpIHtcclxuXHRcdFx0XHQvLyBUT0RPOlxyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW5kZXhlZCBwYXR0ZXJuIGNvbG9yIG1vZGUgbm90IGltcGxlbWVudGVkJyk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb25Nb2RlID09PSAxKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHsgY29sb3JNb2RlIH0pO1xyXG5cdFx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ3ppcC5iaW4nLCBCdWZmZXIuZnJvbShjZGF0YSkpO1xyXG5cdFx0XHQvLyBjb25zdCBkYXRhID0gcmVxdWlyZSgnemxpYicpLmluZmxhdGVSYXdTeW5jKGNkYXRhKTtcclxuXHRcdFx0Ly8gY29uc3QgZGF0YSA9IHJlcXVpcmUoJ3psaWInKS51bnppcFN5bmMoY2RhdGEpO1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhkYXRhKTtcclxuXHRcdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdaaXAgY29tcHJlc3Npb24gbm90IHN1cHBvcnRlZCBmb3IgcGF0dGVybicpO1xyXG5cdFx0XHQvLyB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIHBhdHRlcm4gY29tcHJlc3Npb24nKTtcclxuXHRcdFx0Y29uc29sZS5lcnJvcignVW5zdXBwb3J0ZWQgcGF0dGVybiBjb21wcmVzc2lvbicpO1xyXG5cdFx0XHRuYW1lICs9ICcgKGZhaWxlZCB0byBkZWNvZGUpJztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwYXR0ZXJuIGNvbXByZXNzaW9uIG1vZGUnKTtcclxuXHRcdH1cclxuXHJcblx0XHRjaCsrO1xyXG5cdH1cclxuXHJcblx0Ly8gVE9ETzogdXNlIGNhbnZhcyBpbnN0ZWFkIG9mIGRhdGEgP1xyXG5cclxuXHRyZXR1cm4geyBpZCwgbmFtZSwgeCwgeSwgYm91bmRzOiB7IHg6IGxlZnQsIHk6IHRvcCwgdzogd2lkdGgsIGg6IGhlaWdodCB9LCBkYXRhIH07XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
