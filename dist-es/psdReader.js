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
    return { view: view, offset: 0, strict: false };
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
                    l.parentId = parent_1.id;
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
                    l.parentId = parent_2.id;
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
    if (reader.offset > end) {
        throw new Error('Exceeded section limits');
    }
    if (reader.offset !== end && reader.strict) {
        // throw new Error(`Unread section data: ${end - reader.offset} bytes at 0x${reader.offset.toString(16)}`);
        console.warn('Unread section data');
    }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RyxHQUFHLENBQUM7WUFDbkMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDbkI7UUFDRCxnQkFBbUIsQ0FBQyxDQUFDO1lBQ3BCLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7WUFDdEMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUN0QyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDO1lBQ3RDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDbkI7UUFDRCxpQkFBb0IsQ0FBQyxDQUFDO1lBQ3JCLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsSUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztZQUNuQyxJQUFNLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1lBQ25DLElBQU0sQ0FBQyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7WUFDbkMsT0FBTyxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUMsR0FBQSxFQUFFLENBQUM7U0FDdEI7UUFDRCxnQkFBbUIsQ0FBQyxDQUFDO1lBQ3BC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Q3RELGlEQUFpRDtZQUNqRCxxQkFBcUI7WUFDckIsZ0VBQWdFO1lBQ2hFLHNEQUFzRDtZQUN0RCxPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDakQsSUFBSSxJQUFJLHFCQUFxQixDQUFDO1NBQzlCO2FBQU07WUFDTixNQUFNLElBQUksS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7U0FDcEQ7UUFFRCxFQUFFLEVBQUUsQ0FBQztLQUNMO0lBRUQscUNBQXFDO0lBRXJDLE9BQU8sRUFBRSxFQUFFLElBQUEsRUFBRSxJQUFJLE1BQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxDQUFDLEdBQUEsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEVBQUUsSUFBSSxNQUFBLEVBQUUsQ0FBQztBQUNuRixDQUFDIiwiZmlsZSI6InBzZFJlYWRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XHJcblx0UHNkLCBMYXllciwgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIExheWVyQWRkaXRpb25hbEluZm8sIFJlYWRPcHRpb25zLCBMYXllck1hc2tEYXRhLCBDb2xvcixcclxuXHRQYXR0ZXJuSW5mbywgR2xvYmFsTGF5ZXJNYXNrSW5mbywgUkdCXHJcbn0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdHJlc2V0SW1hZ2VEYXRhLCBvZmZzZXRGb3JDaGFubmVsLCBkZWNvZGVCaXRtYXAsIFBpeGVsRGF0YSwgY3JlYXRlQ2FudmFzLCBjcmVhdGVJbWFnZURhdGEsXHJcblx0dG9CbGVuZE1vZGUsIENoYW5uZWxJRCwgQ29tcHJlc3Npb24sIExheWVyTWFza0ZsYWdzLCBNYXNrUGFyYW1zLCBDb2xvclNwYWNlLCBSQVdfSU1BR0VfREFUQSwgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXNcclxufSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBpbmZvSGFuZGxlcnNNYXAgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVyc01hcCB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xyXG5cclxuaW50ZXJmYWNlIENoYW5uZWxJbmZvIHtcclxuXHRpZDogQ2hhbm5lbElEO1xyXG5cdGxlbmd0aDogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUmVhZE9wdGlvbnNFeHQgZXh0ZW5kcyBSZWFkT3B0aW9ucyB7XHJcblx0bGFyZ2U6IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRDb2xvck1vZGVzID0gW0NvbG9yTW9kZS5CaXRtYXAsIENvbG9yTW9kZS5HcmF5c2NhbGUsIENvbG9yTW9kZS5SR0JdO1xyXG5jb25zdCBjb2xvck1vZGVzID0gWydiaXRtYXAnLCAnZ3JheXNjYWxlJywgJ2luZGV4ZWQnLCAnUkdCJywgJ0NNWUsnLCAnbXVsdGljaGFubmVsJywgJ2R1b3RvbmUnLCAnbGFiJ107XHJcblxyXG5mdW5jdGlvbiBzZXR1cEdyYXlzY2FsZShkYXRhOiBQaXhlbERhdGEpIHtcclxuXHRjb25zdCBzaXplID0gZGF0YS53aWR0aCAqIGRhdGEuaGVpZ2h0ICogNDtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzaXplOyBpICs9IDQpIHtcclxuXHRcdGRhdGEuZGF0YVtpICsgMV0gPSBkYXRhLmRhdGFbaV07XHJcblx0XHRkYXRhLmRhdGFbaSArIDJdID0gZGF0YS5kYXRhW2ldO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQc2RSZWFkZXIge1xyXG5cdG9mZnNldDogbnVtYmVyO1xyXG5cdHZpZXc6IERhdGFWaWV3O1xyXG5cdHN0cmljdDogYm9vbGVhbjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVJlYWRlcihidWZmZXI6IEFycmF5QnVmZmVyLCBvZmZzZXQ/OiBudW1iZXIsIGxlbmd0aD86IG51bWJlcik6IFBzZFJlYWRlciB7XHJcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIsIG9mZnNldCwgbGVuZ3RoKTtcclxuXHRyZXR1cm4geyB2aWV3LCBvZmZzZXQ6IDAsIHN0cmljdDogZmFsc2UgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVaW50OChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gMTtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDgocmVhZGVyLm9mZnNldCAtIDEpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcGVla1VpbnQ4KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldFVpbnQ4KHJlYWRlci5vZmZzZXQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEludDE2KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSAyO1xyXG5cdHJldHVybiByZWFkZXIudmlldy5nZXRJbnQxNihyZWFkZXIub2Zmc2V0IC0gMiwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQxNihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gMjtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDE2KHJlYWRlci5vZmZzZXQgLSAyLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MzIocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDQ7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEludDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkSW50MzJMRShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0SW50MzIocmVhZGVyLm9mZnNldCAtIDQsIHRydWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFVpbnQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0VWludDMyKHJlYWRlci5vZmZzZXQgLSA0LCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRmxvYXQzMihyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJlYWRlci5vZmZzZXQgKz0gNDtcclxuXHRyZXR1cm4gcmVhZGVyLnZpZXcuZ2V0RmxvYXQzMihyZWFkZXIub2Zmc2V0IC0gNCwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZsb2F0NjQocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZWFkZXIub2Zmc2V0ICs9IDg7XHJcblx0cmV0dXJuIHJlYWRlci52aWV3LmdldEZsb2F0NjQocmVhZGVyLm9mZnNldCAtIDgsIGZhbHNlKTtcclxufVxyXG5cclxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciAxNi4xNlxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXI6IFBzZFJlYWRlcik6IG51bWJlciB7XHJcblx0cmV0dXJuIHJlYWRJbnQzMihyZWFkZXIpIC8gKDEgPDwgMTYpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDguMjRcclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcjogUHNkUmVhZGVyKTogbnVtYmVyIHtcclxuXHRyZXR1cm4gcmVhZEludDMyKHJlYWRlcikgLyAoMSA8PCAyNCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQnl0ZXMocmVhZGVyOiBQc2RSZWFkZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSBsZW5ndGg7XHJcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHJlYWRlci5vZmZzZXQgLSBsZW5ndGgsIGxlbmd0aCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkU2lnbmF0dXJlKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTaG9ydFN0cmluZyhyZWFkZXIsIDQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXI6IFBzZFJlYWRlciwgcGFkVG86IG51bWJlcikge1xyXG5cdGxldCBsZW5ndGggPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRjb25zdCB0ZXh0ID0gbGVuZ3RoID8gcmVhZFNob3J0U3RyaW5nKHJlYWRlciwgbGVuZ3RoKSA6ICcnO1xyXG5cclxuXHR3aGlsZSAoKytsZW5ndGggJSBwYWRUbykge1xyXG5cdFx0cmVhZGVyLm9mZnNldCsrO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRleHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVW5pY29kZVN0cmluZyhyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRyZXR1cm4gcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoKHJlYWRlciwgbGVuZ3RoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aChyZWFkZXI6IFBzZFJlYWRlciwgbGVuZ3RoOiBudW1iZXIpIHtcclxuXHRsZXQgdGV4dCA9ICcnO1xyXG5cclxuXHR3aGlsZSAobGVuZ3RoLS0pIHtcclxuXHRcdGNvbnN0IHZhbHVlID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdGlmICh2YWx1ZSB8fCBsZW5ndGggPiAwKSB7IC8vIHJlbW92ZSB0cmFpbGluZyBcXDBcclxuXHRcdFx0dGV4dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHZhbHVlKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0ZXh0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFzY2lpU3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGxldCB0ZXh0ID0gJyc7XHJcblxyXG5cdHdoaWxlIChsZW5ndGgtLSkge1xyXG5cdFx0dGV4dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHJlYWRVaW50OChyZWFkZXIpKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB0ZXh0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2tpcEJ5dGVzKHJlYWRlcjogUHNkUmVhZGVyLCBjb3VudDogbnVtYmVyKSB7XHJcblx0cmVhZGVyLm9mZnNldCArPSBjb3VudDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrU2lnbmF0dXJlKHJlYWRlcjogUHNkUmVhZGVyLCBhOiBzdHJpbmcsIGI/OiBzdHJpbmcpIHtcclxuXHRjb25zdCBvZmZzZXQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdGNvbnN0IHNpZ25hdHVyZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0aWYgKHNpZ25hdHVyZSAhPT0gYSAmJiBzaWduYXR1cmUgIT09IGIpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ25hdHVyZX0nIGF0IDB4JHtvZmZzZXQudG9TdHJpbmcoMTYpfWApO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZFNob3J0U3RyaW5nKHJlYWRlcjogUHNkUmVhZGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblx0bGV0IHJlc3VsdCA9ICcnO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xyXG5cdFx0cmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmZmVyW2ldKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKHJlYWRlcjogUHNkUmVhZGVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucyA9IHt9KSB7XHJcblx0Ly8gaGVhZGVyXHJcblx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJQUycpO1xyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24gIT09IDEgJiYgdmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFBTRCBmaWxlIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XHJcblx0Y29uc3QgY2hhbm5lbHMgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgaGVpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHdpZHRoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGJpdHNQZXJDaGFubmVsID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGNvbG9yTW9kZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0aWYgKHN1cHBvcnRlZENvbG9yTW9kZXMuaW5kZXhPZihjb2xvck1vZGUpID09PSAtMSlcclxuXHRcdHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke2NvbG9yTW9kZXNbY29sb3JNb2RlXSA/PyBjb2xvck1vZGV9YCk7XHJcblxyXG5cdGNvbnN0IHBzZDogUHNkID0geyB3aWR0aCwgaGVpZ2h0LCBjaGFubmVscywgYml0c1BlckNoYW5uZWwsIGNvbG9yTW9kZSB9O1xyXG5cdGNvbnN0IG9wdDogUmVhZE9wdGlvbnNFeHQgPSB7IC4uLm9wdGlvbnMsIGxhcmdlOiB2ZXJzaW9uID09PSAyIH07XHJcblxyXG5cdC8vIGNvbG9yIG1vZGUgZGF0YVxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAob3B0LnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yIG1vZGUgZGF0YSBub3Qgc3VwcG9ydGVkJyk7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBpbWFnZSByZXNvdXJjZXNcclxuXHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0d2hpbGUgKGxlZnQoKSkge1xyXG5cdFx0XHRjb25zdCBzaWcgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdFx0XHRpZiAoc2lnICE9PSAnOEJJTScgJiYgc2lnICE9PSAnTWVTYScgJiYgc2lnICE9PSAnQWdIZycgJiYgc2lnICE9PSAnUEhVVCcgJiYgc2lnICE9PSAnRENTUicpIHtcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzaWd9JyBhdCAweCR7KHJlYWRlci5vZmZzZXQgLSA0KS50b1N0cmluZygxNil9YCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGlkID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRyZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMik7IC8vIG5hbWVcclxuXHJcblx0XHRcdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XHJcblx0XHRcdFx0Y29uc3QgaGFuZGxlciA9IHJlc291cmNlSGFuZGxlcnNNYXBbaWRdO1xyXG5cdFx0XHRcdGNvbnN0IHNraXAgPSBpZCA9PT0gMTAzNiAmJiAhIW9wdC5za2lwVGh1bWJuYWlsO1xyXG5cclxuXHRcdFx0XHRpZiAoIXBzZC5pbWFnZVJlc291cmNlcykge1xyXG5cdFx0XHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoaGFuZGxlciAmJiAhc2tpcCkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0aGFuZGxlci5yZWFkKHJlYWRlciwgcHNkLmltYWdlUmVzb3VyY2VzLCBsZWZ0LCBvcHQpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHRcdFx0XHRpZiAob3B0LnRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzKSB0aHJvdyBlO1xyXG5cdFx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHQvLyBvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhgVW5oYW5kbGVkIGltYWdlIHJlc291cmNlOiAke2lkfWApO1xyXG5cdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHQvLyBsYXllciBhbmQgbWFzayBpbmZvXHJcblx0bGV0IGdsb2JhbEFscGhhID0gZmFsc2U7XHJcblxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRnbG9iYWxBbHBoYSA9IHJlYWRMYXllckluZm8ocmVhZGVyLCBwc2QsIG9wdCk7XHJcblxyXG5cdFx0Ly8gU0FJIGRvZXMgbm90IGluY2x1ZGUgdGhpcyBzZWN0aW9uXHJcblx0XHRpZiAobGVmdCgpID4gMCkge1xyXG5cdFx0XHRjb25zdCBnbG9iYWxMYXllck1hc2tJbmZvID0gcmVhZEdsb2JhbExheWVyTWFza0luZm8ocmVhZGVyKTtcclxuXHRcdFx0aWYgKGdsb2JhbExheWVyTWFza0luZm8pIHBzZC5nbG9iYWxMYXllck1hc2tJbmZvID0gZ2xvYmFsTGF5ZXJNYXNrSW5mbztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdC8vIHJldmVydCBiYWNrIHRvIGVuZCBvZiBzZWN0aW9uIGlmIGV4Y2VlZGVkIHNlY3Rpb24gbGltaXRzXHJcblx0XHRcdC8vIG9wdC5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ3JldmVydGluZyB0byBlbmQgb2Ygc2VjdGlvbicpO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkgPiAwKSB7XHJcblx0XHRcdC8vIHNvbWV0aW1lcyB0aGVyZSBhcmUgZW1wdHkgYnl0ZXMgaGVyZVxyXG5cdFx0XHR3aGlsZSAobGVmdCgpICYmIHBlZWtVaW50OChyZWFkZXIpID09PSAwKSB7XHJcblx0XHRcdFx0Ly8gb3B0LmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnc2tpcHBpbmcgMCBieXRlJyk7XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChsZWZ0KCkgPj0gMTIpIHtcclxuXHRcdFx0XHRyZWFkQWRkaXRpb25hbExheWVySW5mbyhyZWFkZXIsIHBzZCwgcHNkLCBvcHQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIG9wdC5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ3NraXBwaW5nIGxlZnRvdmVyIGJ5dGVzJywgbGVmdCgpKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSwgdW5kZWZpbmVkLCBvcHQubGFyZ2UpO1xyXG5cclxuXHRjb25zdCBoYXNDaGlsZHJlbiA9IHBzZC5jaGlsZHJlbiAmJiBwc2QuY2hpbGRyZW4ubGVuZ3RoO1xyXG5cdGNvbnN0IHNraXBDb21wb3NpdGUgPSBvcHQuc2tpcENvbXBvc2l0ZUltYWdlRGF0YSAmJiAob3B0LnNraXBMYXllckltYWdlRGF0YSB8fCBoYXNDaGlsZHJlbik7XHJcblxyXG5cdGlmICghc2tpcENvbXBvc2l0ZSkge1xyXG5cdFx0cmVhZEltYWdlRGF0YShyZWFkZXIsIHBzZCwgZ2xvYmFsQWxwaGEsIG9wdCk7XHJcblx0fVxyXG5cclxuXHQvLyBUT0RPOiBzaG93IGNvbnZlcnRlZCBjb2xvciBtb2RlIGluc3RlYWQgb2Ygb3JpZ2luYWwgUFNEIGZpbGUgY29sb3IgbW9kZVxyXG5cdC8vICAgICAgIGJ1dCBhZGQgb3B0aW9uIHRvIHByZXNlcnZlIGZpbGUgY29sb3IgbW9kZSAobmVlZCB0byByZXR1cm4gaW1hZ2UgZGF0YSBpbnN0ZWFkIG9mIGNhbnZhcyBpbiB0aGF0IGNhc2UpXHJcblx0Ly8gcHNkLmNvbG9yTW9kZSA9IENvbG9yTW9kZS5SR0I7IC8vIHdlIGNvbnZlcnQgYWxsIGNvbG9yIG1vZGVzIHRvIFJHQlxyXG5cclxuXHRyZXR1cm4gcHNkO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJJbmZvKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgb3B0aW9uczogUmVhZE9wdGlvbnNFeHQpIHtcclxuXHRsZXQgZ2xvYmFsQWxwaGEgPSBmYWxzZTtcclxuXHJcblx0cmVhZFNlY3Rpb24ocmVhZGVyLCAyLCBsZWZ0ID0+IHtcclxuXHRcdGxldCBsYXllckNvdW50ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0aWYgKGxheWVyQ291bnQgPCAwKSB7XHJcblx0XHRcdGdsb2JhbEFscGhhID0gdHJ1ZTtcclxuXHRcdFx0bGF5ZXJDb3VudCA9IC1sYXllckNvdW50O1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xyXG5cdFx0Y29uc3QgbGF5ZXJDaGFubmVsczogQ2hhbm5lbEluZm9bXVtdID0gW107XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsYXllckNvdW50OyBpKyspIHtcclxuXHRcdFx0Y29uc3QgeyBsYXllciwgY2hhbm5lbHMgfSA9IHJlYWRMYXllclJlY29yZChyZWFkZXIsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdGxheWVycy5wdXNoKGxheWVyKTtcclxuXHRcdFx0bGF5ZXJDaGFubmVscy5wdXNoKGNoYW5uZWxzKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIW9wdGlvbnMuc2tpcExheWVySW1hZ2VEYXRhKSB7XHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJDb3VudDsgaSsrKSB7XHJcblx0XHRcdFx0cmVhZExheWVyQ2hhbm5lbEltYWdlRGF0YShyZWFkZXIsIHBzZCwgbGF5ZXJzW2ldLCBsYXllckNoYW5uZWxzW2ldLCBvcHRpb25zKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblxyXG5cdFx0aWYgKCFwc2QuY2hpbGRyZW4pIHBzZC5jaGlsZHJlbiA9IFtdO1xyXG5cclxuXHRcdGNvbnN0IHN0YWNrOiAoTGF5ZXIgfCBQc2QpW10gPSBbcHNkXTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gbGF5ZXJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcblx0XHRcdGNvbnN0IGwgPSBsYXllcnNbaV07XHJcblx0XHRcdGNvbnN0IHR5cGUgPSBsLnNlY3Rpb25EaXZpZGVyID8gbC5zZWN0aW9uRGl2aWRlci50eXBlIDogU2VjdGlvbkRpdmlkZXJUeXBlLk90aGVyO1xyXG5cdFx0XHRpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXIgfHwgdHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkNsb3NlZEZvbGRlcikge1xyXG5cdFx0XHRcdGwub3BlbmVkID0gdHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXI7XHJcblx0XHRcdFx0bC5jaGlsZHJlbiA9IFtdO1xyXG5cdFx0XHRcdGNvbnN0IHBhcmVudCA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xyXG5cdFx0XHRcdGlmIChwYXJlbnQgJiYgcGFyZW50Lm5hbWUpIHtcclxuXHRcdFx0XHRcdGwucGFyZW50SWQgPSBwYXJlbnQuaWQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdLmNoaWxkcmVuIS51bnNoaWZ0KGwpO1xyXG5cdFx0XHRcdHN0YWNrLnB1c2gobCk7XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIpIHtcclxuXHRcdFx0XHRzdGFjay5wb3AoKTtcclxuXHRcdFx0XHQvLyB0aGlzIHdhcyB3b3JrYXJvdW5kIGJlY2F1c2UgSSBkaWRuJ3Qga25vdyB3aGF0IGBsc2RrYCBzZWN0aW9uIHdhcywgbm93IGl0J3MgcHJvYmFibHkgbm90IG5lZWRlZCBhbnltb3JlXHJcblx0XHRcdFx0Ly8gfSBlbHNlIGlmIChsLm5hbWUgPT09ICc8L0xheWVyIGdyb3VwPicgJiYgIWwuc2VjdGlvbkRpdmlkZXIgJiYgIWwudG9wICYmICFsLmxlZnQgJiYgIWwuYm90dG9tICYmICFsLnJpZ2h0KSB7XHJcblx0XHRcdFx0Ly8gXHQvLyBzb21ldGltZXMgbGF5ZXIgZ3JvdXAgdGVybWluYXRvciBkb2Vzbid0IGhhdmUgc2VjdGlvbkRpdmlkZXIsIHNvIHdlIGp1c3QgZ3Vlc3MgaGVyZSAoUFMgYnVnID8pXHJcblx0XHRcdFx0Ly8gXHRzdGFjay5wb3AoKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb25zdCBwYXJlbnQgPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcclxuXHRcdFx0XHRpZiAocGFyZW50ICYmIHBhcmVudC5uYW1lKSB7XHJcblx0XHRcdFx0XHRsLnBhcmVudElkID0gcGFyZW50LmlkO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRzdGFja1tzdGFjay5sZW5ndGggLSAxXS5jaGlsZHJlbiEudW5zaGlmdChsKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sIHVuZGVmaW5lZCwgb3B0aW9ucy5sYXJnZSk7XHJcblxyXG5cdHJldHVybiBnbG9iYWxBbHBoYTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExheWVyUmVjb3JkKHJlYWRlcjogUHNkUmVhZGVyLCBwc2Q6IFBzZCwgb3B0aW9uczogUmVhZE9wdGlvbnNFeHQpIHtcclxuXHRjb25zdCBsYXllcjogTGF5ZXIgPSB7fTtcclxuXHRsYXllci50b3AgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRsYXllci5sZWZ0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0bGF5ZXIuYm90dG9tID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0bGF5ZXIucmlnaHQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHJcblx0Y29uc3QgY2hhbm5lbENvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGNoYW5uZWxzOiBDaGFubmVsSW5mb1tdID0gW107XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbENvdW50OyBpKyspIHtcclxuXHRcdGxldCBjaGFubmVsSUQgPSByZWFkSW50MTYocmVhZGVyKSBhcyBDaGFubmVsSUQ7XHJcblx0XHRsZXQgY2hhbm5lbExlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRpZiAob3B0aW9ucy5sYXJnZSkge1xyXG5cdFx0XHRpZiAoY2hhbm5lbExlbmd0aCAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdTaXplcyBsYXJnZXIgdGhhbiA0R0IgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcclxuXHRcdFx0Y2hhbm5lbExlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRjaGFubmVscy5wdXNoKHsgaWQ6IGNoYW5uZWxJRCwgbGVuZ3RoOiBjaGFubmVsTGVuZ3RoIH0pO1xyXG5cdH1cclxuXHJcblx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRpZiAoIXRvQmxlbmRNb2RlW2JsZW5kTW9kZV0pIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBibGVuZCBtb2RlOiAnJHtibGVuZE1vZGV9J2ApO1xyXG5cdGxheWVyLmJsZW5kTW9kZSA9IHRvQmxlbmRNb2RlW2JsZW5kTW9kZV07XHJcblxyXG5cdGxheWVyLm9wYWNpdHkgPSByZWFkVWludDgocmVhZGVyKSAvIDB4ZmY7XHJcblx0bGF5ZXIuY2xpcHBpbmcgPSByZWFkVWludDgocmVhZGVyKSA9PT0gMTtcclxuXHJcblx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRsYXllci50cmFuc3BhcmVuY3lQcm90ZWN0ZWQgPSAoZmxhZ3MgJiAweDAxKSAhPT0gMDtcclxuXHRsYXllci5oaWRkZW4gPSAoZmxhZ3MgJiAweDAyKSAhPT0gMDtcclxuXHQvLyAweDA0IC0gb2Jzb2xldGVcclxuXHQvLyAweDA4IC0gMSBmb3IgUGhvdG9zaG9wIDUuMCBhbmQgbGF0ZXIsIHRlbGxzIGlmIGJpdCA0IGhhcyB1c2VmdWwgaW5mb3JtYXRpb25cclxuXHQvLyAweDEwIC0gcGl4ZWwgZGF0YSBpcnJlbGV2YW50IHRvIGFwcGVhcmFuY2Ugb2YgZG9jdW1lbnRcclxuXHJcblx0c2tpcEJ5dGVzKHJlYWRlciwgMSk7XHJcblxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRjb25zdCBtYXNrID0gcmVhZExheWVyTWFza0RhdGEocmVhZGVyLCBvcHRpb25zKTtcclxuXHRcdGlmIChtYXNrKSBsYXllci5tYXNrID0gbWFzaztcclxuXHJcblx0XHQvKmNvbnN0IGJsZW5kaW5nUmFuZ2VzID0qLyByZWFkTGF5ZXJCbGVuZGluZ1JhbmdlcyhyZWFkZXIpO1xyXG5cdFx0bGF5ZXIubmFtZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCA0KTtcclxuXHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdHJlYWRBZGRpdGlvbmFsTGF5ZXJJbmZvKHJlYWRlciwgbGF5ZXIsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHR9XHJcblx0fSk7XHJcblx0cmV0dXJuIHsgbGF5ZXIsIGNoYW5uZWxzIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRMYXllck1hc2tEYXRhKHJlYWRlcjogUHNkUmVhZGVyLCBvcHRpb25zOiBSZWFkT3B0aW9ucykge1xyXG5cdHJldHVybiByZWFkU2VjdGlvbjxMYXllck1hc2tEYXRhIHwgdW5kZWZpbmVkPihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0aWYgKCFsZWZ0KCkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdFx0Y29uc3QgbWFzazogTGF5ZXJNYXNrRGF0YSA9IHt9O1xyXG5cdFx0bWFzay50b3AgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2subGVmdCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0bWFzay5ib3R0b20gPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2sucmlnaHQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdG1hc2suZGVmYXVsdENvbG9yID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblxyXG5cdFx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIgPSAoZmxhZ3MgJiBMYXllck1hc2tGbGFncy5Qb3NpdGlvblJlbGF0aXZlVG9MYXllcikgIT09IDA7XHJcblx0XHRtYXNrLmRpc2FibGVkID0gKGZsYWdzICYgTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQpICE9PSAwO1xyXG5cdFx0bWFzay5mcm9tVmVjdG9yRGF0YSA9IChmbGFncyAmIExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Zyb21SZW5kZXJpbmdPdGhlckRhdGEpICE9PSAwO1xyXG5cclxuXHRcdGlmIChmbGFncyAmIExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQpIHtcclxuXHRcdFx0Y29uc3QgcGFyYW1zID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eSkgbWFzay51c2VyTWFza0RlbnNpdHkgPSByZWFkVWludDgocmVhZGVyKSAvIDB4ZmY7XHJcblx0XHRcdGlmIChwYXJhbXMgJiBNYXNrUGFyYW1zLlVzZXJNYXNrRmVhdGhlcikgbWFzay51c2VyTWFza0ZlYXRoZXIgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0XHRpZiAocGFyYW1zICYgTWFza1BhcmFtcy5WZWN0b3JNYXNrRGVuc2l0eSkgbWFzay52ZWN0b3JNYXNrRGVuc2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRcdFx0aWYgKHBhcmFtcyAmIE1hc2tQYXJhbXMuVmVjdG9yTWFza0ZlYXRoZXIpIG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0KCkgPiAyKSB7XHJcblx0XHRcdG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdVbmhhbmRsZWQgZXh0cmEgbWFzayBwYXJhbXMnKTtcclxuXHRcdFx0Ly8gVE9ETzogaGFuZGxlIHRoZXNlIHZhbHVlc1xyXG5cdFx0XHQvKmNvbnN0IHJlYWxGbGFncyA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgcmVhbFVzZXJNYXNrQmFja2dyb3VuZCA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgdG9wMiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgbGVmdDIgPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IGJvdHRvbTIgPSovIHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IHJpZ2h0MiA9Ki8gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdHJldHVybiBtYXNrO1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGF5ZXJCbGVuZGluZ1JhbmdlcyhyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJldHVybiByZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0Y29uc3QgY29tcG9zaXRlR3JheUJsZW5kU291cmNlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29tcG9zaXRlR3JhcGhCbGVuZERlc3RpbmF0aW9uUmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCByYW5nZXMgPSBbXTtcclxuXHJcblx0XHR3aGlsZSAobGVmdCgpKSB7XHJcblx0XHRcdGNvbnN0IHNvdXJjZVJhbmdlID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBkZXN0UmFuZ2UgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdHJhbmdlcy5wdXNoKHsgc291cmNlUmFuZ2UsIGRlc3RSYW5nZSB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4geyBjb21wb3NpdGVHcmF5QmxlbmRTb3VyY2UsIGNvbXBvc2l0ZUdyYXBoQmxlbmREZXN0aW5hdGlvblJhbmdlLCByYW5nZXMgfTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExheWVyQ2hhbm5lbEltYWdlRGF0YShcclxuXHRyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIGxheWVyOiBMYXllciwgY2hhbm5lbHM6IENoYW5uZWxJbmZvW10sIG9wdGlvbnM6IFJlYWRPcHRpb25zRXh0XHJcbikge1xyXG5cdGNvbnN0IGxheWVyV2lkdGggPSAobGF5ZXIucmlnaHQgfHwgMCkgLSAobGF5ZXIubGVmdCB8fCAwKTtcclxuXHRjb25zdCBsYXllckhlaWdodCA9IChsYXllci5ib3R0b20gfHwgMCkgLSAobGF5ZXIudG9wIHx8IDApO1xyXG5cdGNvbnN0IGNteWsgPSBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuQ01ZSztcclxuXHJcblx0bGV0IGltYWdlRGF0YTogSW1hZ2VEYXRhIHwgdW5kZWZpbmVkO1xyXG5cclxuXHRpZiAobGF5ZXJXaWR0aCAmJiBsYXllckhlaWdodCkge1xyXG5cdFx0aWYgKGNteWspIHtcclxuXHRcdFx0aW1hZ2VEYXRhID0geyB3aWR0aDogbGF5ZXJXaWR0aCwgaGVpZ2h0OiBsYXllckhlaWdodCwgZGF0YTogbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGxheWVyV2lkdGggKiBsYXllckhlaWdodCAqIDUpIH07XHJcblx0XHRcdGZvciAobGV0IHAgPSA0OyBwIDwgaW1hZ2VEYXRhLmRhdGEuYnl0ZUxlbmd0aDsgcCArPSA1KSBpbWFnZURhdGEuZGF0YVtwXSA9IDI1NTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YShsYXllcldpZHRoLCBsYXllckhlaWdodCk7XHJcblx0XHRcdHJlc2V0SW1hZ2VEYXRhKGltYWdlRGF0YSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoUkFXX0lNQUdFX0RBVEEpIChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IFtdO1xyXG5cclxuXHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgY2hhbm5lbHMpIHtcclxuXHRcdGNvbnN0IGNvbXByZXNzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbXByZXNzaW9uO1xyXG5cclxuXHRcdGlmIChjaGFubmVsLmlkID09PSBDaGFubmVsSUQuVXNlck1hc2spIHtcclxuXHRcdFx0Y29uc3QgbWFzayA9IGxheWVyLm1hc2s7XHJcblxyXG5cdFx0XHRpZiAoIW1hc2spIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBsYXllciBtYXNrIGRhdGFgKTtcclxuXHJcblx0XHRcdGNvbnN0IG1hc2tXaWR0aCA9IChtYXNrLnJpZ2h0IHx8IDApIC0gKG1hc2subGVmdCB8fCAwKTtcclxuXHRcdFx0Y29uc3QgbWFza0hlaWdodCA9IChtYXNrLmJvdHRvbSB8fCAwKSAtIChtYXNrLnRvcCB8fCAwKTtcclxuXHJcblx0XHRcdGlmIChtYXNrV2lkdGggJiYgbWFza0hlaWdodCkge1xyXG5cdFx0XHRcdGNvbnN0IG1hc2tEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKG1hc2tXaWR0aCwgbWFza0hlaWdodCk7XHJcblx0XHRcdFx0cmVzZXRJbWFnZURhdGEobWFza0RhdGEpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBzdGFydCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdFx0cmVhZERhdGEocmVhZGVyLCBtYXNrRGF0YSwgY29tcHJlc3Npb24sIG1hc2tXaWR0aCwgbWFza0hlaWdodCwgMCwgb3B0aW9ucy5sYXJnZSwgNCk7XHJcblxyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkge1xyXG5cdFx0XHRcdFx0KGxheWVyIGFzIGFueSkubWFza0RhdGFSYXcgPSBuZXcgVWludDhBcnJheShyZWFkZXIudmlldy5idWZmZXIsIHJlYWRlci52aWV3LmJ5dGVPZmZzZXQgKyBzdGFydCwgcmVhZGVyLm9mZnNldCAtIHN0YXJ0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNldHVwR3JheXNjYWxlKG1hc2tEYXRhKTtcclxuXHJcblx0XHRcdFx0aWYgKG9wdGlvbnMudXNlSW1hZ2VEYXRhKSB7XHJcblx0XHRcdFx0XHRtYXNrLmltYWdlRGF0YSA9IG1hc2tEYXRhO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRtYXNrLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhtYXNrV2lkdGgsIG1hc2tIZWlnaHQpO1xyXG5cdFx0XHRcdFx0bWFzay5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKG1hc2tEYXRhLCAwLCAwKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGNvbnN0IG9mZnNldCA9IG9mZnNldEZvckNoYW5uZWwoY2hhbm5lbC5pZCwgY215ayk7XHJcblx0XHRcdGxldCB0YXJnZXREYXRhID0gaW1hZ2VEYXRhO1xyXG5cclxuXHRcdFx0aWYgKG9mZnNldCA8IDApIHtcclxuXHRcdFx0XHR0YXJnZXREYXRhID0gdW5kZWZpbmVkO1xyXG5cclxuXHRcdFx0XHRpZiAob3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykge1xyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDaGFubmVsIG5vdCBzdXBwb3J0ZWQ6ICR7Y2hhbm5lbC5pZH1gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHN0YXJ0ID0gcmVhZGVyLm9mZnNldDtcclxuXHRcdFx0cmVhZERhdGEocmVhZGVyLCB0YXJnZXREYXRhLCBjb21wcmVzc2lvbiwgbGF5ZXJXaWR0aCwgbGF5ZXJIZWlnaHQsIG9mZnNldCwgb3B0aW9ucy5sYXJnZSwgY215ayA/IDUgOiA0KTtcclxuXHJcblx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkge1xyXG5cdFx0XHRcdChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhd1tjaGFubmVsLmlkXSA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodGFyZ2V0RGF0YSAmJiBwc2QuY29sb3JNb2RlID09PSBDb2xvck1vZGUuR3JheXNjYWxlKSB7XHJcblx0XHRcdFx0c2V0dXBHcmF5c2NhbGUodGFyZ2V0RGF0YSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChpbWFnZURhdGEpIHtcclxuXHRcdGlmIChjbXlrKSB7XHJcblx0XHRcdGNvbnN0IGNteWtEYXRhID0gaW1hZ2VEYXRhO1xyXG5cdFx0XHRpbWFnZURhdGEgPSBjcmVhdGVJbWFnZURhdGEoY215a0RhdGEud2lkdGgsIGNteWtEYXRhLmhlaWdodCk7XHJcblx0XHRcdGNteWtUb1JnYihjbXlrRGF0YSwgaW1hZ2VEYXRhLCBmYWxzZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKG9wdGlvbnMudXNlSW1hZ2VEYXRhKSB7XHJcblx0XHRcdGxheWVyLmltYWdlRGF0YSA9IGltYWdlRGF0YTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxheWVyLmNhbnZhcyA9IGNyZWF0ZUNhbnZhcyhsYXllcldpZHRoLCBsYXllckhlaWdodCk7XHJcblx0XHRcdGxheWVyLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEoaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWREYXRhKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBkYXRhOiBJbWFnZURhdGEgfCB1bmRlZmluZWQsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbiwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsXHJcblx0b2Zmc2V0OiBudW1iZXIsIGxhcmdlOiBib29sZWFuLCBzdGVwOiBudW1iZXJcclxuKSB7XHJcblx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGRhdGEsIG9mZnNldCwgd2lkdGgsIGhlaWdodCwgc3RlcCk7XHJcblx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0cmVhZERhdGFSTEUocmVhZGVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBzdGVwLCBbb2Zmc2V0XSwgbGFyZ2UpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbXByZXNzaW9uIHR5cGUgbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRHbG9iYWxMYXllck1hc2tJbmZvKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0cmV0dXJuIHJlYWRTZWN0aW9uPEdsb2JhbExheWVyTWFza0luZm8gfCB1bmRlZmluZWQ+KHJlYWRlciwgMSwgbGVmdCA9PiB7XHJcblx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0XHRjb25zdCBvdmVybGF5Q29sb3JTcGFjZSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2UxID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY29sb3JTcGFjZTIgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjb2xvclNwYWNlMyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNvbG9yU3BhY2U0ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmY7XHJcblx0XHRjb25zdCBraW5kID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpOyAvLyAzIGJ5dGVzIG9mIHBhZGRpbmcgP1xyXG5cdFx0cmV0dXJuIHsgb3ZlcmxheUNvbG9yU3BhY2UsIGNvbG9yU3BhY2UxLCBjb2xvclNwYWNlMiwgY29sb3JTcGFjZTMsIGNvbG9yU3BhY2U0LCBvcGFjaXR5LCBraW5kIH07XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRBZGRpdGlvbmFsTGF5ZXJJbmZvKHJlYWRlcjogUHNkUmVhZGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGNvbnN0IHNpZyA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRpZiAoc2lnICE9PSAnOEJJTScgJiYgc2lnICE9PSAnOEI2NCcpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ30nIGF0IDB4JHsocmVhZGVyLm9mZnNldCAtIDQpLnRvU3RyaW5nKDE2KX1gKTtcclxuXHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblxyXG5cdC8vIGBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5c2AgZmFsbGJhY2ssIGJlY2F1c2Ugc29tZSBrZXlzIGRvbid0IGhhdmUgOEI2NCBzaWduYXR1cmUgZXZlbiB3aGVuIHRoZXkgYXJlIDY0Yml0XHJcblx0Y29uc3QgdTY0ID0gc2lnID09PSAnOEI2NCcgfHwgKG9wdGlvbnMubGFyZ2UgJiYgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXMuaW5kZXhPZihrZXkpICE9PSAtMSk7XHJcblxyXG5cdHJlYWRTZWN0aW9uKHJlYWRlciwgMiwgbGVmdCA9PiB7XHJcblx0XHRjb25zdCBoYW5kbGVyID0gaW5mb0hhbmRsZXJzTWFwW2tleV07XHJcblxyXG5cdFx0aWYgKGhhbmRsZXIpIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRoYW5kbGVyLnJlYWQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRpZiAob3B0aW9ucy50aHJvd0Zvck1pc3NpbmdGZWF0dXJlcykgdGhyb3cgZTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYFVuaGFuZGxlZCBhZGRpdGlvbmFsIGluZm86ICR7a2V5fWApO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0KCkpIHtcclxuXHRcdFx0b3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgY29uc29sZS5sb2coYFVucmVhZCAke2xlZnQoKX0gYnl0ZXMgbGVmdCBmb3IgYWRkaXRpb25hbCBpbmZvOiAke2tleX1gKTtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdH1cclxuXHR9LCBmYWxzZSwgdTY0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZEltYWdlRGF0YShyZWFkZXI6IFBzZFJlYWRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBSZWFkT3B0aW9uc0V4dCkge1xyXG5cdGNvbnN0IGNvbXByZXNzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbXByZXNzaW9uO1xyXG5cclxuXHRpZiAoc3VwcG9ydGVkQ29sb3JNb2Rlcy5pbmRleE9mKHBzZC5jb2xvck1vZGUhKSA9PT0gLTEpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbG9yIG1vZGUgbm90IHN1cHBvcnRlZDogJHtwc2QuY29sb3JNb2RlfWApO1xyXG5cclxuXHRpZiAoY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJhd0RhdGEgJiYgY29tcHJlc3Npb24gIT09IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENvbXByZXNzaW9uIHR5cGUgbm90IHN1cHBvcnRlZDogJHtjb21wcmVzc2lvbn1gKTtcclxuXHJcblx0Y29uc3QgaW1hZ2VEYXRhID0gY3JlYXRlSW1hZ2VEYXRhKHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0cmVzZXRJbWFnZURhdGEoaW1hZ2VEYXRhKTtcclxuXHJcblx0c3dpdGNoIChwc2QuY29sb3JNb2RlKSB7XHJcblx0XHRjYXNlIENvbG9yTW9kZS5CaXRtYXA6IHtcclxuXHRcdFx0bGV0IGJ5dGVzOiBVaW50OEFycmF5O1xyXG5cclxuXHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SYXdEYXRhKSB7XHJcblx0XHRcdFx0Ynl0ZXMgPSByZWFkQnl0ZXMocmVhZGVyLCBNYXRoLmNlaWwocHNkLndpZHRoIC8gOCkgKiBwc2QuaGVpZ2h0KTtcclxuXHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0XHRcdGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkocHNkLndpZHRoICogcHNkLmhlaWdodCk7XHJcblx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCB7IGRhdGE6IGJ5dGVzLCB3aWR0aDogcHNkLndpZHRoLCBoZWlnaHQ6IHBzZC5oZWlnaHQgfSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCAxLCBbMF0sIG9wdGlvbnMubGFyZ2UpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQml0bWFwIGNvbXByZXNzaW9uIG5vdCBzdXBwb3J0ZWQ6ICR7Y29tcHJlc3Npb259YCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGRlY29kZUJpdG1hcChieXRlcywgaW1hZ2VEYXRhLmRhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuUkdCOlxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuR3JheXNjYWxlOiB7XHJcblx0XHRcdGNvbnN0IGNoYW5uZWxzID0gcHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSA/IFswXSA6IFswLCAxLCAyXTtcclxuXHJcblx0XHRcdGlmIChwc2QuY2hhbm5lbHMgJiYgcHNkLmNoYW5uZWxzID4gMykge1xyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAzOyBpIDwgcHNkLmNoYW5uZWxzOyBpKyspIHtcclxuXHRcdFx0XHRcdC8vIFRPRE86IHN0b3JlIHRoZXNlIGNoYW5uZWxzIGluIGFkZGl0aW9uYWwgaW1hZ2UgZGF0YVxyXG5cdFx0XHRcdFx0Y2hhbm5lbHMucHVzaChpKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAoZ2xvYmFsQWxwaGEpIHtcclxuXHRcdFx0XHRjaGFubmVscy5wdXNoKDMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IENvbXByZXNzaW9uLlJhd0RhdGEpIHtcclxuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRyZWFkRGF0YVJhdyhyZWFkZXIsIGltYWdlRGF0YSwgY2hhbm5lbHNbaV0sIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgNCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKSB7XHJcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgaW1hZ2VEYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIDQsIGNoYW5uZWxzLCBvcHRpb25zLmxhcmdlKTtcclxuXHRcdFx0XHRpZiAoUkFXX0lNQUdFX0RBVEEpIChwc2QgYXMgYW55KS5pbWFnZURhdGFSYXcgPSBuZXcgVWludDhBcnJheShyZWFkZXIudmlldy5idWZmZXIsIHJlYWRlci52aWV3LmJ5dGVPZmZzZXQgKyBzdGFydCwgcmVhZGVyLm9mZnNldCAtIHN0YXJ0KTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5HcmF5c2NhbGUpIHtcclxuXHRcdFx0XHRzZXR1cEdyYXlzY2FsZShpbWFnZURhdGEpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJyZWFrO1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvck1vZGUuQ01ZSzoge1xyXG5cdFx0XHRpZiAocHNkLmNoYW5uZWxzICE9PSA0KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2hhbm5lbCBjb3VudGApO1xyXG5cclxuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSBbMCwgMSwgMiwgM107XHJcblx0XHRcdGlmIChnbG9iYWxBbHBoYSkgY2hhbm5lbHMucHVzaCg0KTtcclxuXHJcblx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmF3RGF0YSkge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgTm90IGltcGxlbWVudGVkYCk7XHJcblx0XHRcdFx0Ly8gVE9ETzogLi4uXHJcblx0XHRcdFx0Ly8gZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVscy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdC8vIFx0cmVhZERhdGFSYXcocmVhZGVyLCBpbWFnZURhdGEsIGNoYW5uZWxzW2ldLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xyXG5cdFx0XHRcdC8vIH1cclxuXHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCkge1xyXG5cdFx0XHRcdGNvbnN0IGNteWtJbWFnZURhdGE6IFBpeGVsRGF0YSA9IHtcclxuXHRcdFx0XHRcdHdpZHRoOiBpbWFnZURhdGEud2lkdGgsXHJcblx0XHRcdFx0XHRoZWlnaHQ6IGltYWdlRGF0YS5oZWlnaHQsXHJcblx0XHRcdFx0XHRkYXRhOiBuZXcgVWludDhBcnJheShpbWFnZURhdGEud2lkdGggKiBpbWFnZURhdGEuaGVpZ2h0ICogNSksXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0Y29uc3Qgc3RhcnQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgY215a0ltYWdlRGF0YSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCA1LCBjaGFubmVscywgb3B0aW9ucy5sYXJnZSk7XHJcblx0XHRcdFx0Y215a1RvUmdiKGNteWtJbWFnZURhdGEsIGltYWdlRGF0YSwgdHJ1ZSk7XHJcblxyXG5cdFx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSkgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyA9IG5ldyBVaW50OEFycmF5KHJlYWRlci52aWV3LmJ1ZmZlciwgcmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHN0YXJ0LCByZWFkZXIub2Zmc2V0IC0gc3RhcnQpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRicmVhaztcclxuXHRcdH1cclxuXHRcdGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcihgQ29sb3IgbW9kZSBub3Qgc3VwcG9ydGVkOiAke3BzZC5jb2xvck1vZGV9YCk7XHJcblx0fVxyXG5cclxuXHRpZiAob3B0aW9ucy51c2VJbWFnZURhdGEpIHtcclxuXHRcdHBzZC5pbWFnZURhdGEgPSBpbWFnZURhdGE7XHJcblx0fSBlbHNlIHtcclxuXHRcdHBzZC5jYW52YXMgPSBjcmVhdGVDYW52YXMocHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRcdHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKGltYWdlRGF0YSwgMCwgMCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBjbXlrVG9SZ2IoY215azogUGl4ZWxEYXRhLCByZ2I6IFBpeGVsRGF0YSwgcmV2ZXJzZUFscGhhOiBib29sZWFuKSB7XHJcblx0Y29uc3Qgc2l6ZSA9IHJnYi53aWR0aCAqIHJnYi5oZWlnaHQgKiA0O1xyXG5cdGNvbnN0IHNyY0RhdGEgPSBjbXlrLmRhdGE7XHJcblx0Y29uc3QgZHN0RGF0YSA9IHJnYi5kYXRhO1xyXG5cclxuXHRmb3IgKGxldCBzcmMgPSAwLCBkc3QgPSAwOyBkc3QgPCBzaXplOyBzcmMgKz0gNSwgZHN0ICs9IDQpIHtcclxuXHRcdGNvbnN0IGMgPSBzcmNEYXRhW3NyY107XHJcblx0XHRjb25zdCBtID0gc3JjRGF0YVtzcmMgKyAxXTtcclxuXHRcdGNvbnN0IHkgPSBzcmNEYXRhW3NyYyArIDJdO1xyXG5cdFx0Y29uc3QgayA9IHNyY0RhdGFbc3JjICsgM107XHJcblx0XHRkc3REYXRhW2RzdF0gPSAoKCgoYyAqIGspIHwgMCkgLyAyNTUpIHwgMCk7XHJcblx0XHRkc3REYXRhW2RzdCArIDFdID0gKCgoKG0gKiBrKSB8IDApIC8gMjU1KSB8IDApO1xyXG5cdFx0ZHN0RGF0YVtkc3QgKyAyXSA9ICgoKCh5ICogaykgfCAwKSAvIDI1NSkgfCAwKTtcclxuXHRcdGRzdERhdGFbZHN0ICsgM10gPSByZXZlcnNlQWxwaGEgPyAyNTUgLSBzcmNEYXRhW3NyYyArIDRdIDogc3JjRGF0YVtzcmMgKyA0XTtcclxuXHR9XHJcblxyXG5cdC8vIGZvciAobGV0IHNyYyA9IDAsIGRzdCA9IDA7IGRzdCA8IHNpemU7IHNyYyArPSA1LCBkc3QgKz0gNCkge1xyXG5cdC8vIFx0Y29uc3QgYyA9IDEgLSAoc3JjRGF0YVtzcmMgKyAwXSAvIDI1NSk7XHJcblx0Ly8gXHRjb25zdCBtID0gMSAtIChzcmNEYXRhW3NyYyArIDFdIC8gMjU1KTtcclxuXHQvLyBcdGNvbnN0IHkgPSAxIC0gKHNyY0RhdGFbc3JjICsgMl0gLyAyNTUpO1xyXG5cdC8vIFx0Ly8gY29uc3QgayA9IHNyY0RhdGFbc3JjICsgM10gLyAyNTU7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDBdID0gKCgxIC0gYyAqIDAuOCkgKiAyNTUpIHwgMDtcclxuXHQvLyBcdGRzdERhdGFbZHN0ICsgMV0gPSAoKDEgLSBtICogMC44KSAqIDI1NSkgfCAwO1xyXG5cdC8vIFx0ZHN0RGF0YVtkc3QgKyAyXSA9ICgoMSAtIHkgKiAwLjgpICogMjU1KSB8IDA7XHJcblx0Ly8gXHRkc3REYXRhW2RzdCArIDNdID0gcmV2ZXJzZUFscGhhID8gMjU1IC0gc3JjRGF0YVtzcmMgKyA0XSA6IHNyY0RhdGFbc3JjICsgNF07XHJcblx0Ly8gfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkRGF0YVJhdyhyZWFkZXI6IFBzZFJlYWRlciwgcGl4ZWxEYXRhOiBQaXhlbERhdGEgfCB1bmRlZmluZWQsIG9mZnNldDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgc3RlcDogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc2l6ZSA9IHdpZHRoICogaGVpZ2h0O1xyXG5cdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIHNpemUpO1xyXG5cclxuXHRpZiAocGl4ZWxEYXRhICYmIG9mZnNldCA8IHN0ZXApIHtcclxuXHRcdGNvbnN0IGRhdGEgPSBwaXhlbERhdGEuZGF0YTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMCwgcCA9IG9mZnNldCB8IDA7IGkgPCBzaXplOyBpKyssIHAgPSAocCArIHN0ZXApIHwgMCkge1xyXG5cdFx0XHRkYXRhW3BdID0gYnVmZmVyW2ldO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWREYXRhUkxFKFxyXG5cdHJlYWRlcjogUHNkUmVhZGVyLCBwaXhlbERhdGE6IFBpeGVsRGF0YSB8IHVuZGVmaW5lZCwgX3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBzdGVwOiBudW1iZXIsIG9mZnNldHM6IG51bWJlcltdLFxyXG5cdGxhcmdlOiBib29sZWFuXHJcbikge1xyXG5cdGNvbnN0IGRhdGEgPSBwaXhlbERhdGEgJiYgcGl4ZWxEYXRhLmRhdGE7XHJcblx0bGV0IGxlbmd0aHM6IFVpbnQxNkFycmF5IHwgVWludDMyQXJyYXk7XHJcblxyXG5cdGlmIChsYXJnZSkge1xyXG5cdFx0bGVuZ3RocyA9IG5ldyBVaW50MzJBcnJheShvZmZzZXRzLmxlbmd0aCAqIGhlaWdodCk7XHJcblxyXG5cdFx0Zm9yIChsZXQgbyA9IDAsIGxpID0gMDsgbyA8IG9mZnNldHMubGVuZ3RoOyBvKyspIHtcclxuXHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGxlbmd0aHNbbGldID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdGxlbmd0aHMgPSBuZXcgVWludDE2QXJyYXkob2Zmc2V0cy5sZW5ndGggKiBoZWlnaHQpO1xyXG5cclxuXHRcdGZvciAobGV0IG8gPSAwLCBsaSA9IDA7IG8gPCBvZmZzZXRzLmxlbmd0aDsgbysrKSB7XHJcblx0XHRcdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyssIGxpKyspIHtcclxuXHRcdFx0XHRsZW5ndGhzW2xpXSA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y29uc3QgZXh0cmFMaW1pdCA9IChzdGVwIC0gMSkgfCAwOyAvLyAzIGZvciByZ2IsIDQgZm9yIGNteWtcclxuXHJcblx0Zm9yIChsZXQgYyA9IDAsIGxpID0gMDsgYyA8IG9mZnNldHMubGVuZ3RoOyBjKyspIHtcclxuXHRcdGNvbnN0IG9mZnNldCA9IG9mZnNldHNbY10gfCAwO1xyXG5cdFx0Y29uc3QgZXh0cmEgPSBjID4gZXh0cmFMaW1pdCB8fCBvZmZzZXQgPiBleHRyYUxpbWl0O1xyXG5cclxuXHRcdGlmICghZGF0YSB8fCBleHRyYSkge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrLCBsaSsrKSB7XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVuZ3Roc1tsaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRmb3IgKGxldCB5ID0gMCwgcCA9IG9mZnNldCB8IDA7IHkgPCBoZWlnaHQ7IHkrKywgbGkrKykge1xyXG5cdFx0XHRcdGNvbnN0IGxlbmd0aCA9IGxlbmd0aHNbbGldO1xyXG5cdFx0XHRcdGNvbnN0IGJ1ZmZlciA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlbmd0aCk7XHJcblxyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdGxldCBoZWFkZXIgPSBidWZmZXJbaV07XHJcblxyXG5cdFx0XHRcdFx0aWYgKGhlYWRlciA+IDEyOCkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGJ1ZmZlclsrK2ldO1xyXG5cdFx0XHRcdFx0XHRoZWFkZXIgPSAoMjU2IC0gaGVhZGVyKSB8IDA7XHJcblxyXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8PSBoZWFkZXI7IGogPSAoaiArIDEpIHwgMCkge1xyXG5cdFx0XHRcdFx0XHRcdGRhdGFbcF0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0XHRwID0gKHAgKyBzdGVwKSB8IDA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaGVhZGVyIDwgMTI4KSB7XHJcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDw9IGhlYWRlcjsgaiA9IChqICsgMSkgfCAwKSB7XHJcblx0XHRcdFx0XHRcdFx0ZGF0YVtwXSA9IGJ1ZmZlclsrK2ldO1xyXG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIHN0ZXApIHwgMDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Ly8gaWdub3JlIDEyOFxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChpID49IGxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUkxFIGRhdGE6IGV4Y2VlZGVkIGJ1ZmZlciBzaXplICR7aX0vJHtsZW5ndGh9YCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFNlY3Rpb248VD4oXHJcblx0cmVhZGVyOiBQc2RSZWFkZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6IChsZWZ0OiAoKSA9PiBudW1iZXIpID0+IFQsIHNraXBFbXB0eSA9IHRydWUsIGVpZ2h0Qnl0ZXMgPSBmYWxzZVxyXG4pOiBUIHwgdW5kZWZpbmVkIHtcclxuXHRsZXQgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRpZiAoZWlnaHRCeXRlcykge1xyXG5cdFx0aWYgKGxlbmd0aCAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdTaXplcyBsYXJnZXIgdGhhbiA0R0IgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcclxuXHRcdGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHR9XHJcblxyXG5cdGlmIChsZW5ndGggPD0gMCAmJiBza2lwRW1wdHkpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdGxldCBlbmQgPSByZWFkZXIub2Zmc2V0ICsgbGVuZ3RoO1xyXG5cdGNvbnN0IHJlc3VsdCA9IGZ1bmMoKCkgPT4gZW5kIC0gcmVhZGVyLm9mZnNldCk7XHJcblxyXG5cdGlmIChyZWFkZXIub2Zmc2V0ID4gZW5kKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIHNlY3Rpb24gbGltaXRzJyk7XHJcblx0fVxyXG5cclxuXHRpZiAocmVhZGVyLm9mZnNldCAhPT0gZW5kICYmIHJlYWRlci5zdHJpY3QpIHtcclxuXHRcdC8vIHRocm93IG5ldyBFcnJvcihgVW5yZWFkIHNlY3Rpb24gZGF0YTogJHtlbmQgLSByZWFkZXIub2Zmc2V0fSBieXRlcyBhdCAweCR7cmVhZGVyLm9mZnNldC50b1N0cmluZygxNil9YCk7XHJcblx0XHRjb25zb2xlLndhcm4oJ1VucmVhZCBzZWN0aW9uIGRhdGEnKTtcclxuXHR9XHJcblxyXG5cdHdoaWxlIChlbmQgJSByb3VuZCkgZW5kKys7XHJcblxyXG5cdHJlYWRlci5vZmZzZXQgPSBlbmQ7XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRDb2xvcihyZWFkZXI6IFBzZFJlYWRlcik6IENvbG9yIHtcclxuXHRjb25zdCBjb2xvclNwYWNlID0gcmVhZFVpbnQxNihyZWFkZXIpIGFzIENvbG9yU3BhY2U7XHJcblxyXG5cdHN3aXRjaCAoY29sb3JTcGFjZSkge1xyXG5cdFx0Y2FzZSBDb2xvclNwYWNlLlJHQjoge1xyXG5cdFx0XHRjb25zdCByID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRjb25zdCBnID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRjb25zdCBiID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMjU3O1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHRcdFx0cmV0dXJuIHsgciwgZywgYiB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvclNwYWNlLkhTQjoge1xyXG5cdFx0XHRjb25zdCBoID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZmZmO1xyXG5cdFx0XHRjb25zdCBzID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZmZmO1xyXG5cdFx0XHRjb25zdCBiID0gcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZmZmO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHRcdFx0cmV0dXJuIHsgaCwgcywgYiB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvclNwYWNlLkNNWUs6IHtcclxuXHRcdFx0Y29uc3QgYyA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgbSA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgeSA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0Y29uc3QgayA9IHJlYWRVaW50MTYocmVhZGVyKSAvIDI1NztcclxuXHRcdFx0cmV0dXJuIHsgYywgbSwgeSwgayB9O1xyXG5cdFx0fVxyXG5cdFx0Y2FzZSBDb2xvclNwYWNlLkxhYjoge1xyXG5cdFx0XHRjb25zdCBsID0gcmVhZEludDE2KHJlYWRlcikgLyAxMDAwMDtcclxuXHRcdFx0Y29uc3QgdGEgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgdGIgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgYSA9IHRhIDwgMCA/ICh0YSAvIDEyODAwKSA6ICh0YSAvIDEyNzAwKTtcclxuXHRcdFx0Y29uc3QgYiA9IHRiIDwgMCA/ICh0YiAvIDEyODAwKSA6ICh0YiAvIDEyNzAwKTtcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XHJcblx0XHRcdHJldHVybiB7IGwsIGEsIGIgfTtcclxuXHRcdH1cclxuXHRcdGNhc2UgQ29sb3JTcGFjZS5HcmF5c2NhbGU6IHtcclxuXHRcdFx0Y29uc3QgayA9IHJlYWRVaW50MTYocmVhZGVyKSAqIDI1NSAvIDEwMDAwO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCA2KTtcclxuXHRcdFx0cmV0dXJuIHsgayB9O1xyXG5cdFx0fVxyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbG9yIHNwYWNlJyk7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFBhdHRlcm4ocmVhZGVyOiBQc2RSZWFkZXIpOiBQYXR0ZXJuSW5mbyB7XHJcblx0cmVhZFVpbnQzMihyZWFkZXIpOyAvLyBsZW5ndGhcclxuXHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcGF0dGVybiB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdGNvbnN0IGNvbG9yTW9kZSA9IHJlYWRVaW50MzIocmVhZGVyKSBhcyBDb2xvck1vZGU7XHJcblx0Y29uc3QgeCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IHkgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHJcblx0Ly8gd2Ugb25seSBzdXBwb3J0IFJHQiBhbmQgZ3JheXNjYWxlIGZvciBub3dcclxuXHRpZiAoY29sb3JNb2RlICE9PSBDb2xvck1vZGUuUkdCICYmIGNvbG9yTW9kZSAhPT0gQ29sb3JNb2RlLkdyYXlzY2FsZSAmJiBjb2xvck1vZGUgIT09IENvbG9yTW9kZS5JbmRleGVkKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHBhdHRlcm4gY29sb3IgbW9kZTogJHtjb2xvck1vZGV9YCk7XHJcblx0fVxyXG5cclxuXHRsZXQgbmFtZSA9IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7XHJcblx0Y29uc3QgaWQgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMSk7XHJcblx0Y29uc3QgcGFsZXR0ZTogUkdCW10gPSBbXTtcclxuXHJcblx0aWYgKGNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkluZGV4ZWQpIHtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcclxuXHRcdFx0cGFsZXR0ZS5wdXNoKHtcclxuXHRcdFx0XHRyOiByZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0XHRnOiByZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0XHRiOiByZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgNCk7IC8vIG5vIGlkZWEgd2hhdCB0aGlzIGlzXHJcblx0fVxyXG5cclxuXHQvLyB2aXJ0dWFsIG1lbW9yeSBhcnJheSBsaXN0XHJcblx0Y29uc3QgdmVyc2lvbjIgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24yICE9PSAzKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcGF0dGVybiBWTUFMIHZlcnNpb246ICR7dmVyc2lvbjJ9YCk7XHJcblxyXG5cdHJlYWRVaW50MzIocmVhZGVyKTsgLy8gbGVuZ3RoXHJcblx0Y29uc3QgdG9wID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGxlZnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgYm90dG9tID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHJpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGNoYW5uZWxzQ291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0Y29uc3Qgd2lkdGggPSByaWdodCAtIGxlZnQ7XHJcblx0Y29uc3QgaGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xyXG5cdGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCAqIDQpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMzsgaSA8IGRhdGEuYnl0ZUxlbmd0aDsgaSArPSA0KSB7XHJcblx0XHRkYXRhW2ldID0gMjU1O1xyXG5cdH1cclxuXHJcblx0Zm9yIChsZXQgaSA9IDAsIGNoID0gMDsgaSA8IChjaGFubmVsc0NvdW50ICsgMik7IGkrKykge1xyXG5cdFx0Y29uc3QgaGFzID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0aWYgKCFoYXMpIGNvbnRpbnVlO1xyXG5cclxuXHRcdGNvbnN0IGxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHBpeGVsRGVwdGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjdG9wID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY2xlZnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBjYm90dG9tID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgY3JpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgcGl4ZWxEZXB0aDIgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjb21wcmVzc2lvbk1vZGUgPSByZWFkVWludDgocmVhZGVyKTsgLy8gMCAtIHJhdywgMSAtIHppcFxyXG5cdFx0Y29uc3QgZGF0YUxlbmd0aCA9IGxlbmd0aCAtICg0ICsgMTYgKyAyICsgMSk7XHJcblx0XHRjb25zdCBjZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIGRhdGFMZW5ndGgpO1xyXG5cclxuXHRcdGlmIChwaXhlbERlcHRoICE9PSA4IHx8IHBpeGVsRGVwdGgyICE9PSA4KSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignMTZiaXQgcGl4ZWwgZGVwdGggbm90IHN1cHBvcnRlZCBmb3IgcGF0dGVybnMnKTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCB3ID0gY3JpZ2h0IC0gY2xlZnQ7XHJcblx0XHRjb25zdCBoID0gY2JvdHRvbSAtIGN0b3A7XHJcblx0XHRjb25zdCBveCA9IGNsZWZ0IC0gbGVmdDtcclxuXHRcdGNvbnN0IG95ID0gY3RvcCAtIHRvcDtcclxuXHJcblx0XHRpZiAoY29tcHJlc3Npb25Nb2RlID09PSAwKSB7XHJcblx0XHRcdGlmIChjb2xvck1vZGUgPT09IENvbG9yTW9kZS5SR0IgJiYgY2ggPCAzKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoOyB5KyspIHtcclxuXHRcdFx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgdzsgeCsrKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHNyYyA9IHggKyB5ICogdztcclxuXHRcdFx0XHRcdFx0Y29uc3QgZHN0ID0gKG94ICsgeCArICh5ICsgb3kpICogd2lkdGgpICogNDtcclxuXHRcdFx0XHRcdFx0ZGF0YVtkc3QgKyBjaF0gPSBjZGF0YVtzcmNdO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkdyYXlzY2FsZSAmJiBjaCA8IDEpIHtcclxuXHRcdFx0XHRmb3IgKGxldCB5ID0gMDsgeSA8IGg7IHkrKykge1xyXG5cdFx0XHRcdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3OyB4KyspIHtcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc3JjID0geCArIHkgKiB3O1xyXG5cdFx0XHRcdFx0XHRjb25zdCBkc3QgPSAob3ggKyB4ICsgKHkgKyBveSkgKiB3aWR0aCkgKiA0O1xyXG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGNkYXRhW3NyY107XHJcblx0XHRcdFx0XHRcdGRhdGFbZHN0ICsgMF0gPSB2YWx1ZTtcclxuXHRcdFx0XHRcdFx0ZGF0YVtkc3QgKyAxXSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0XHRkYXRhW2RzdCArIDJdID0gdmFsdWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoY29sb3JNb2RlID09PSBDb2xvck1vZGUuSW5kZXhlZCkge1xyXG5cdFx0XHRcdC8vIFRPRE86XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbmRleGVkIHBhdHRlcm4gY29sb3IgbW9kZSBub3QgaW1wbGVtZW50ZWQnKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbk1vZGUgPT09IDEpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coeyBjb2xvck1vZGUgfSk7XHJcblx0XHRcdC8vIHJlcXVpcmUoJ2ZzJykud3JpdGVGaWxlU3luYygnemlwLmJpbicsIEJ1ZmZlci5mcm9tKGNkYXRhKSk7XHJcblx0XHRcdC8vIGNvbnN0IGRhdGEgPSByZXF1aXJlKCd6bGliJykuaW5mbGF0ZVJhd1N5bmMoY2RhdGEpO1xyXG5cdFx0XHQvLyBjb25zdCBkYXRhID0gcmVxdWlyZSgnemxpYicpLnVuemlwU3luYyhjZGF0YSk7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKGRhdGEpO1xyXG5cdFx0XHQvLyB0aHJvdyBuZXcgRXJyb3IoJ1ppcCBjb21wcmVzc2lvbiBub3Qgc3VwcG9ydGVkIGZvciBwYXR0ZXJuJyk7XHJcblx0XHRcdC8vIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgcGF0dGVybiBjb21wcmVzc2lvbicpO1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCdVbnN1cHBvcnRlZCBwYXR0ZXJuIGNvbXByZXNzaW9uJyk7XHJcblx0XHRcdG5hbWUgKz0gJyAoZmFpbGVkIHRvIGRlY29kZSknO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhdHRlcm4gY29tcHJlc3Npb24gbW9kZScpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNoKys7XHJcblx0fVxyXG5cclxuXHQvLyBUT0RPOiB1c2UgY2FudmFzIGluc3RlYWQgb2YgZGF0YSA/XHJcblxyXG5cdHJldHVybiB7IGlkLCBuYW1lLCB4LCB5LCBib3VuZHM6IHsgeDogbGVmdCwgeTogdG9wLCB3OiB3aWR0aCwgaDogaGVpZ2h0IH0sIGRhdGEgfTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
