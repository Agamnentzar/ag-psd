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
exports.writeColor = exports.writePsd = exports.writeSection = exports.writeUnicodeStringWithPadding = exports.writeUnicodeString = exports.writePascalString = exports.writeSignature = exports.writeZeros = exports.writeBytes = exports.writeFixedPointPath32 = exports.writeFixedPoint32 = exports.writeFloat64 = exports.writeFloat32 = exports.writeUint32 = exports.writeInt32 = exports.writeUint16 = exports.writeInt16 = exports.writeUint8 = exports.getWriterBufferNoCopy = exports.getWriterBuffer = exports.createWriter = void 0;
var helpers_1 = require("./helpers");
var additionalInfo_1 = require("./additionalInfo");
var imageResources_1 = require("./imageResources");
function createWriter(size) {
    if (size === void 0) { size = 4096; }
    var buffer = new ArrayBuffer(size);
    var view = new DataView(buffer);
    var offset = 0;
    return { buffer: buffer, view: view, offset: offset };
}
exports.createWriter = createWriter;
function getWriterBuffer(writer) {
    return writer.buffer.slice(0, writer.offset);
}
exports.getWriterBuffer = getWriterBuffer;
function getWriterBufferNoCopy(writer) {
    return new Uint8Array(writer.buffer, 0, writer.offset);
}
exports.getWriterBufferNoCopy = getWriterBufferNoCopy;
function writeUint8(writer, value) {
    var offset = addSize(writer, 1);
    writer.view.setUint8(offset, value);
}
exports.writeUint8 = writeUint8;
function writeInt16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setInt16(offset, value, false);
}
exports.writeInt16 = writeInt16;
function writeUint16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setUint16(offset, value, false);
}
exports.writeUint16 = writeUint16;
function writeInt32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setInt32(offset, value, false);
}
exports.writeInt32 = writeInt32;
function writeUint32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setUint32(offset, value, false);
}
exports.writeUint32 = writeUint32;
function writeFloat32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setFloat32(offset, value, false);
}
exports.writeFloat32 = writeFloat32;
function writeFloat64(writer, value) {
    var offset = addSize(writer, 8);
    writer.view.setFloat64(offset, value, false);
}
exports.writeFloat64 = writeFloat64;
// 32-bit fixed-point number 16.16
function writeFixedPoint32(writer, value) {
    writeInt32(writer, value * (1 << 16));
}
exports.writeFixedPoint32 = writeFixedPoint32;
// 32-bit fixed-point number 8.24
function writeFixedPointPath32(writer, value) {
    writeInt32(writer, value * (1 << 24));
}
exports.writeFixedPointPath32 = writeFixedPointPath32;
function writeBytes(writer, buffer) {
    if (buffer) {
        ensureSize(writer, writer.offset + buffer.length);
        var bytes = new Uint8Array(writer.buffer);
        bytes.set(buffer, writer.offset);
        writer.offset += buffer.length;
    }
}
exports.writeBytes = writeBytes;
function writeZeros(writer, count) {
    for (var i = 0; i < count; i++) {
        writeUint8(writer, 0);
    }
}
exports.writeZeros = writeZeros;
function writeSignature(writer, signature) {
    if (signature.length !== 4) {
        throw new Error("Invalid signature: '" + signature + "'");
    }
    for (var i = 0; i < 4; i++) {
        writeUint8(writer, signature.charCodeAt(i));
    }
}
exports.writeSignature = writeSignature;
function writePascalString(writer, text, padTo) {
    if (padTo === void 0) { padTo = 2; }
    var length = text.length;
    writeUint8(writer, length);
    for (var i = 0; i < length; i++) {
        var code = text.charCodeAt(i);
        writeUint8(writer, code < 128 ? code : '?'.charCodeAt(0));
    }
    while (++length % padTo) {
        writeUint8(writer, 0);
    }
}
exports.writePascalString = writePascalString;
function writeUnicodeString(writer, text) {
    writeUint32(writer, text.length);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
}
exports.writeUnicodeString = writeUnicodeString;
function writeUnicodeStringWithPadding(writer, text) {
    writeUint32(writer, text.length + 1);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
    writeUint16(writer, 0);
}
exports.writeUnicodeStringWithPadding = writeUnicodeStringWithPadding;
function getLargestLayerSize(layers) {
    if (layers === void 0) { layers = []; }
    var max = 0;
    for (var _i = 0, layers_1 = layers; _i < layers_1.length; _i++) {
        var layer = layers_1[_i];
        if (layer.canvas || layer.imageData) {
            var _a = getLayerDimentions(layer), width = _a.width, height = _a.height;
            max = Math.max(max, 2 * height + 2 * width * height);
        }
        if (layer.children) {
            max = Math.max(max, getLargestLayerSize(layer.children));
        }
    }
    return max;
}
function writeSection(writer, round, func, writeTotalLength) {
    if (writeTotalLength === void 0) { writeTotalLength = false; }
    var offset = writer.offset;
    writeInt32(writer, 0);
    func();
    var length = writer.offset - offset - 4;
    var len = length;
    while ((len % round) !== 0) {
        writeUint8(writer, 0);
        len++;
    }
    if (writeTotalLength) {
        length = len;
    }
    writer.view.setInt32(offset, length, false);
}
exports.writeSection = writeSection;
function writePsd(writer, psd, options) {
    if (options === void 0) { options = {}; }
    if (!(+psd.width > 0 && +psd.height > 0))
        throw new Error('Invalid document size');
    var imageResources = psd.imageResources || {};
    if (options.generateThumbnail) {
        imageResources = __assign(__assign({}, imageResources), { thumbnail: createThumbnail(psd) });
    }
    var imageData = psd.imageData;
    if (!imageData && psd.canvas) {
        imageData = psd.canvas.getContext('2d').getImageData(0, 0, psd.canvas.width, psd.canvas.height);
    }
    if (imageData && (psd.width !== imageData.width || psd.height !== imageData.height))
        throw new Error('Document canvas must have the same size as document');
    var globalAlpha = !!imageData && helpers_1.hasAlpha(imageData);
    var maxBufferSize = Math.max(getLargestLayerSize(psd.children), 4 * 2 * psd.width * psd.height + 2 * psd.height);
    var tempBuffer = new Uint8Array(maxBufferSize);
    // header
    writeSignature(writer, '8BPS');
    writeUint16(writer, 1); // version
    writeZeros(writer, 6);
    writeUint16(writer, globalAlpha ? 4 : 3); // channels
    writeUint32(writer, psd.height);
    writeUint32(writer, psd.width);
    writeUint16(writer, 8); // bits per channel
    writeUint16(writer, 3 /* RGB */);
    // color mode data
    writeSection(writer, 1, function () {
        // TODO: implement
    });
    // image resources
    writeSection(writer, 1, function () {
        var _loop_1 = function (handler) {
            if (handler.has(imageResources)) {
                writeSignature(writer, '8BIM');
                writeUint16(writer, handler.key);
                writePascalString(writer, '');
                writeSection(writer, 2, function () { return handler.write(writer, imageResources); });
            }
        };
        for (var _i = 0, resourceHandlers_1 = imageResources_1.resourceHandlers; _i < resourceHandlers_1.length; _i++) {
            var handler = resourceHandlers_1[_i];
            _loop_1(handler);
        }
    });
    // layer and mask info
    writeSection(writer, 2, function () {
        writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options);
        writeGlobalLayerMaskInfo(writer);
        writeAdditionalLayerInfo(writer, psd, psd, options);
    });
    // image data
    var channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
    var data = imageData || {
        data: new Uint8Array(4 * psd.width * psd.height),
        width: psd.width,
        height: psd.height,
    };
    // TODO(jsr): reading fails for compressing multiple channels at once, so revert to RLE here
    var compression = 1 /* RleCompressed */; // options.compression || Compression.RleCompressed;
    // const compression = options.compression || Compression.RleCompressed;
    writeUint16(writer, compression);
    writeBytes(writer, helpers_1.writeData(tempBuffer, data, psd.width, psd.height, channels, compression));
}
exports.writePsd = writePsd;
function writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options) {
    writeSection(writer, 4, function () {
        var _a;
        var layers = [];
        addChildren(layers, psd.children);
        if (!layers.length)
            layers.push({});
        writeInt16(writer, globalAlpha ? -layers.length : layers.length);
        var layersData = layers.map(function (l, i) { return getChannels(tempBuffer, l, i === 0, options); });
        var _loop_2 = function (layerData) {
            var layer = layerData.layer, top_1 = layerData.top, left = layerData.left, bottom = layerData.bottom, right = layerData.right, channels = layerData.channels;
            writeInt32(writer, top_1);
            writeInt32(writer, left);
            writeInt32(writer, bottom);
            writeInt32(writer, right);
            writeUint16(writer, channels.length);
            for (var _i = 0, channels_1 = channels; _i < channels_1.length; _i++) {
                var c = channels_1[_i];
                writeInt16(writer, c.channelId);
                writeInt32(writer, c.length);
            }
            writeSignature(writer, '8BIM');
            writeSignature(writer, helpers_1.fromBlendMode[layer.blendMode] || 'norm');
            writeUint8(writer, Math.round(helpers_1.clamp((_a = layer.opacity) !== null && _a !== void 0 ? _a : 1, 0, 1) * 255));
            writeUint8(writer, layer.clipping ? 1 : 0);
            var flags = 0x08; // 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
            if (layer.transparencyProtected)
                flags |= 0x01;
            if (layer.hidden)
                flags |= 0x02;
            if (layer.vectorMask)
                flags |= 0x10; // pixel data irrelevant to appearance of document
            writeUint8(writer, flags);
            writeUint8(writer, 0); // filler
            writeSection(writer, 1, function () {
                writeLayerMaskData(writer, layer, layerData);
                writeLayerBlendingRanges(writer, psd);
                writePascalString(writer, layer.name || '', 4);
                writeAdditionalLayerInfo(writer, layer, psd, options);
            });
        };
        // layer records
        for (var _i = 0, layersData_1 = layersData; _i < layersData_1.length; _i++) {
            var layerData = layersData_1[_i];
            _loop_2(layerData);
        }
        // layer channel image data
        for (var _b = 0, layersData_2 = layersData; _b < layersData_2.length; _b++) {
            var layerData = layersData_2[_b];
            for (var _c = 0, _d = layerData.channels; _c < _d.length; _c++) {
                var channel = _d[_c];
                writeUint16(writer, channel.compression);
                if (channel.buffer) {
                    writeBytes(writer, channel.buffer);
                }
            }
        }
        // writeUint16(writer, 0);
    }, true);
}
function writeLayerMaskData(writer, _a, layerData) {
    var mask = _a.mask, vectorMask = _a.vectorMask;
    writeSection(writer, 1, function () {
        if (!mask)
            return;
        var m = layerData.mask || {};
        writeInt32(writer, m.top);
        writeInt32(writer, m.left);
        writeInt32(writer, m.bottom);
        writeInt32(writer, m.right);
        writeUint8(writer, mask.defaultColor);
        var params = 0;
        if (mask.userMaskDensity !== undefined)
            params |= 1 /* UserMaskDensity */;
        if (mask.userMaskFeather !== undefined)
            params |= 2 /* UserMaskFeather */;
        if (mask.vectorMaskDensity !== undefined)
            params |= 4 /* VectorMaskDensity */;
        if (mask.vectorMaskFeather !== undefined)
            params |= 8 /* VectorMaskFeather */;
        var flags = 0;
        if (mask.disabled)
            flags |= 2 /* LayerMaskDisabled */;
        if (mask.positionRelativeToLayer)
            flags |= 1 /* PositionRelativeToLayer */;
        if (vectorMask)
            flags |= 8 /* LayerMaskFromRenderingOtherData */;
        if (params)
            flags |= 16 /* MaskHasParametersAppliedToIt */;
        writeUint8(writer, flags);
        if (params) {
            writeUint8(writer, params);
            if (mask.userMaskDensity !== undefined)
                writeUint8(writer, Math.round(mask.userMaskDensity * 0xff));
            if (mask.userMaskFeather !== undefined)
                writeFloat64(writer, mask.userMaskFeather);
            if (mask.vectorMaskDensity !== undefined)
                writeUint8(writer, Math.round(mask.vectorMaskDensity * 0xff));
            if (mask.vectorMaskFeather !== undefined)
                writeFloat64(writer, mask.vectorMaskFeather);
        }
        // TODO: handle rest of the fields
        writeZeros(writer, 2);
    });
}
function writeLayerBlendingRanges(writer, psd) {
    writeSection(writer, 1, function () {
        writeUint32(writer, 65535);
        writeUint32(writer, 65535);
        // TODO: use always 4 instead ?
        var channels = psd.channels || 0;
        for (var i = 0; i < channels; i++) {
            writeUint32(writer, 65535);
            writeUint32(writer, 65535);
        }
    });
}
function writeGlobalLayerMaskInfo(writer) {
    writeSection(writer, 1, function () {
        // TODO: implement
    });
}
function writeAdditionalLayerInfo(writer, target, psd, options) {
    var _loop_3 = function (handler) {
        if (handler.key === 'Txt2' && options.invalidateTextLayers)
            return "continue";
        if (handler.has(target)) {
            writeSignature(writer, '8BIM');
            writeSignature(writer, handler.key);
            var align = handler.key === 'Txt2' ? 4 : 2;
            writeSection(writer, align, function () { return handler.write(writer, target, psd, options); }, handler.key !== 'Txt2');
        }
    };
    for (var _i = 0, infoHandlers_1 = additionalInfo_1.infoHandlers; _i < infoHandlers_1.length; _i++) {
        var handler = infoHandlers_1[_i];
        _loop_3(handler);
    }
}
function addChildren(layers, children) {
    if (!children)
        return;
    for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
        var c = children_1[_i];
        if (c.children && c.canvas)
            throw new Error("Invalid layer, cannot have both 'canvas' and 'children' properties");
        if (c.children && c.imageData)
            throw new Error("Invalid layer, cannot have both 'imageData' and 'children' properties");
        if (c.children) {
            var sectionDivider = {
                type: c.opened === false ? 2 /* ClosedFolder */ : 1 /* OpenFolder */,
                key: c.blendMode || 'pass',
                subtype: 0,
            };
            layers.push({
                name: '</Layer group>',
                sectionDivider: {
                    type: 3 /* BoundingSectionDivider */,
                },
            });
            addChildren(layers, c.children);
            layers.push(__assign(__assign({}, c), { sectionDivider: sectionDivider }));
        }
        else {
            layers.push(__assign({}, c));
        }
    }
}
function resizeBuffer(writer, size) {
    var newLength = writer.buffer.byteLength;
    do {
        newLength *= 2;
    } while (size > newLength);
    var newBuffer = new ArrayBuffer(newLength);
    var newBytes = new Uint8Array(newBuffer);
    var oldBytes = new Uint8Array(writer.buffer);
    newBytes.set(oldBytes);
    writer.buffer = newBuffer;
    writer.view = new DataView(writer.buffer);
}
function ensureSize(writer, size) {
    if (size > writer.buffer.byteLength) {
        resizeBuffer(writer, size);
    }
}
function addSize(writer, size) {
    var offset = writer.offset;
    ensureSize(writer, writer.offset += size);
    return offset;
}
function createThumbnail(psd) {
    var canvas = helpers_1.createCanvas(10, 10);
    var scale = 1;
    if (psd.width > psd.height) {
        canvas.width = 160;
        canvas.height = Math.floor(psd.height * (canvas.width / psd.width));
        scale = canvas.width / psd.width;
    }
    else {
        canvas.height = 160;
        canvas.width = Math.floor(psd.width * (canvas.height / psd.height));
        scale = canvas.height / psd.height;
    }
    var context = canvas.getContext('2d');
    context.scale(scale, scale);
    if (psd.imageData) {
        var temp = helpers_1.createCanvas(psd.imageData.width, psd.imageData.height);
        temp.getContext('2d').putImageData(psd.imageData, 0, 0);
        context.drawImage(temp, 0, 0);
    }
    else if (psd.canvas) {
        context.drawImage(psd.canvas, 0, 0);
    }
    return canvas;
}
function getChannels(tempBuffer, layer, background, options) {
    var layerData = getLayerChannels(tempBuffer, layer, background, options);
    var mask = layer.mask;
    if (mask) {
        var _a = mask.top, top_2 = _a === void 0 ? 0 : _a, _b = mask.left, left = _b === void 0 ? 0 : _b, _c = mask.right, right = _c === void 0 ? 0 : _c, _d = mask.bottom, bottom = _d === void 0 ? 0 : _d;
        var _e = getLayerDimentions(mask), width = _e.width, height = _e.height;
        var imageData = mask.imageData;
        if (!imageData && mask.canvas && width && height) {
            imageData = mask.canvas.getContext('2d').getImageData(0, 0, width, height);
        }
        var compression = options.compression || 1 /* RleCompressed */;
        if (width && height && imageData) {
            right = left + width;
            bottom = top_2 + height;
            var buffer = helpers_1.writeData(tempBuffer, imageData, width, height, [0], compression);
            layerData.mask = { top: top_2, left: left, right: right, bottom: bottom };
            layerData.channels.push({
                channelId: -2 /* UserMask */,
                compression: compression,
                buffer: buffer,
                length: 2 + buffer.length,
            });
        }
        else {
            layerData.mask = { top: 0, left: 0, right: 0, bottom: 0 };
            layerData.channels.push({
                channelId: -2 /* UserMask */,
                compression: 0 /* RawData */,
                buffer: new Uint8Array(0),
                length: 0,
            });
        }
    }
    return layerData;
}
function getLayerDimentions(_a) {
    var canvas = _a.canvas, imageData = _a.imageData;
    return imageData || canvas || { width: 0, height: 0 };
}
function cropImageData(data, left, top, width, height) {
    var croppedData = helpers_1.createImageData(width, height);
    var srcData = data.data;
    var dstData = croppedData.data;
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            var src = ((x + left) + (y + top) * width) * 4;
            var dst = (x + y * width) * 4;
            dstData[dst] = srcData[src];
            dstData[dst + 1] = srcData[src + 1];
            dstData[dst + 2] = srcData[src + 2];
            dstData[dst + 3] = srcData[src + 3];
        }
    }
    return croppedData;
}
function getLayerChannels(tempBuffer, layer, background, options) {
    var _a = layer.top, top = _a === void 0 ? 0 : _a, _b = layer.left, left = _b === void 0 ? 0 : _b, _c = layer.right, right = _c === void 0 ? 0 : _c, _d = layer.bottom, bottom = _d === void 0 ? 0 : _d;
    var channels = [
        {
            channelId: -1 /* Transparency */,
            compression: 0 /* RawData */,
            buffer: undefined,
            length: 2,
        }
    ];
    var _e = getLayerDimentions(layer), width = _e.width, height = _e.height;
    if (!(layer.canvas || layer.imageData) || !width || !height) {
        right = left;
        bottom = top;
        return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
    }
    right = left + width;
    bottom = top + height;
    var data = layer.imageData || layer.canvas.getContext('2d').getImageData(0, 0, width, height);
    if (options.trimImageData) {
        var trimmed = trimData(data);
        if (trimmed.left !== 0 || trimmed.top !== 0 || trimmed.right !== data.width || trimmed.bottom !== data.height) {
            left += trimmed.left;
            top += trimmed.top;
            right -= (data.width - trimmed.right);
            bottom -= (data.height - trimmed.bottom);
            width = right - left;
            height = bottom - top;
            if (!width || !height) {
                return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
            }
            if (layer.imageData) {
                data = cropImageData(data, trimmed.left, trimmed.top, width, height);
            }
            else {
                data = layer.canvas.getContext('2d').getImageData(trimmed.left, trimmed.top, width, height);
            }
        }
    }
    var channelIds = [
        0 /* Red */,
        1 /* Green */,
        2 /* Blue */,
    ];
    if (!background || helpers_1.hasAlpha(data) || layer.mask) {
        channelIds.unshift(-1 /* Transparency */);
    }
    var compression = options.compression || 1 /* RleCompressed */;
    channels = channelIds.map(function (channel) {
        var offset = helpers_1.offsetForChannel(channel);
        var buffer = helpers_1.writeData(tempBuffer, data, width, height, [offset], compression);
        return {
            channelId: channel,
            compression: compression,
            buffer: buffer,
            length: 2 + buffer.length,
        };
    });
    return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
}
function isRowEmpty(_a, y, left, right) {
    var data = _a.data, width = _a.width;
    var start = ((y * width + left) * 4 + 3) | 0;
    var end = (start + (right - left) * 4) | 0;
    for (var i = start; i < end; i = (i + 4) | 0) {
        if (data[i] !== 0) {
            return false;
        }
    }
    return true;
}
function isColEmpty(_a, x, top, bottom) {
    var data = _a.data, width = _a.width;
    var stride = (width * 4) | 0;
    var start = (top * stride + x * 4 + 3) | 0;
    for (var y = top, i = start; y < bottom; y++, i = (i + stride) | 0) {
        if (data[i] !== 0) {
            return false;
        }
    }
    return true;
}
function trimData(data) {
    var top = 0;
    var left = 0;
    var right = data.width;
    var bottom = data.height;
    while (top < bottom && isRowEmpty(data, top, left, right))
        top++;
    while (bottom > top && isRowEmpty(data, bottom - 1, left, right))
        bottom--;
    while (left < right && isColEmpty(data, left, top, bottom))
        left++;
    while (right > left && isColEmpty(data, right - 1, top, bottom))
        right--;
    return { top: top, left: left, right: right, bottom: bottom };
}
function writeColor(writer, color) {
    if (!color) {
        writeUint16(writer, 0 /* RGB */);
        writeZeros(writer, 8);
    }
    else if ('r' in color) {
        writeUint16(writer, 0 /* RGB */);
        writeUint16(writer, Math.round(color.r * 257));
        writeUint16(writer, Math.round(color.g * 257));
        writeUint16(writer, Math.round(color.b * 257));
        writeUint16(writer, 0);
    }
    else if ('l' in color) {
        writeUint16(writer, 7 /* Lab */);
        writeUint16(writer, Math.round(color.l * 100));
        writeUint16(writer, Math.round(color.a * 100));
        writeUint16(writer, Math.round(color.b * 100));
        writeUint16(writer, 0);
    }
    else if ('h' in color) {
        writeUint16(writer, 1 /* HSB */);
        writeUint16(writer, Math.round(color.h));
        writeUint16(writer, Math.round(color.s));
        writeUint16(writer, Math.round(color.b));
        writeUint16(writer, 0);
    }
    else if ('c' in color) {
        writeUint16(writer, 2 /* CMYK */);
        writeUint16(writer, Math.round(color.c));
        writeUint16(writer, Math.round(color.m));
        writeUint16(writer, Math.round(color.y));
        writeUint16(writer, Math.round(color.k));
    }
    else {
        writeUint16(writer, 8 /* Grayscale */);
        writeUint16(writer, Math.round(color.k));
        writeZeros(writer, 6);
    }
}
exports.writeColor = writeColor;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBZ0Q7QUFDaEQsbURBQW9EO0FBUXBELFNBQWdCLFlBQVksQ0FBQyxJQUFXO0lBQVgscUJBQUEsRUFBQSxXQUFXO0lBQ3ZDLElBQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNqQixPQUFPLEVBQUUsTUFBTSxRQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBTEQsb0NBS0M7QUFFRCxTQUFnQixlQUFlLENBQUMsTUFBaUI7SUFDaEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFGRCwwQ0FFQztBQUVELFNBQWdCLHFCQUFxQixDQUFDLE1BQWlCO0lBQ3RELE9BQU8sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFGRCxzREFFQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUhELG9DQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0s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QUMsQ0FBQyxDQUFDLENBQUM7S0FDekM7U0FBTTtRQUNOLFdBQVcsQ0FBQyxNQUFNLG9CQUF1QixDQUFDO1FBQzFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RCO0FBQ0YsQ0FBQztBQWpDRCxnQ0FpQ0MiLCJmaWxlIjoicHNkV3JpdGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHNkLCBMYXllciwgTGF5ZXJBZGRpdGlvbmFsSW5mbywgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIFdyaXRlT3B0aW9ucywgQ29sb3IgfSBmcm9tICcuL3BzZCc7XG5pbXBvcnQge1xuXHRoYXNBbHBoYSwgY3JlYXRlQ2FudmFzLCB3cml0ZURhdGEsIFBpeGVsRGF0YSwgTGF5ZXJDaGFubmVsRGF0YSwgQ2hhbm5lbERhdGEsXG5cdG9mZnNldEZvckNoYW5uZWwsIGNyZWF0ZUltYWdlRGF0YSwgZnJvbUJsZW5kTW9kZSwgQ2hhbm5lbElELCBDb21wcmVzc2lvbiwgY2xhbXAsXG5cdExheWVyTWFza0ZsYWdzLCBNYXNrUGFyYW1zLCBDb2xvclNwYWNlLCBCb3VuZHNcbn0gZnJvbSAnLi9oZWxwZXJzJztcbmltcG9ydCB7IGluZm9IYW5kbGVycyB9IGZyb20gJy4vYWRkaXRpb25hbEluZm8nO1xuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVycyB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBzZFdyaXRlciB7XG5cdG9mZnNldDogbnVtYmVyO1xuXHRidWZmZXI6IEFycmF5QnVmZmVyO1xuXHR2aWV3OiBEYXRhVmlldztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVdyaXRlcihzaXplID0gNDA5Nik6IFBzZFdyaXRlciB7XG5cdGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzaXplKTtcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuXHRjb25zdCBvZmZzZXQgPSAwO1xuXHRyZXR1cm4geyBidWZmZXIsIHZpZXcsIG9mZnNldCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyKSB7XG5cdHJldHVybiB3cml0ZXIuYnVmZmVyLnNsaWNlKDAsIHdyaXRlci5vZmZzZXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0V3JpdGVyQnVmZmVyTm9Db3B5KHdyaXRlcjogUHNkV3JpdGVyKSB7XG5cdHJldHVybiBuZXcgVWludDhBcnJheSh3cml0ZXIuYnVmZmVyLCAwLCB3cml0ZXIub2Zmc2V0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDgod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDEpO1xuXHR3cml0ZXIudmlldy5zZXRVaW50OChvZmZzZXQsIHZhbHVlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlSW50MTYod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDIpO1xuXHR3cml0ZXIudmlldy5zZXRJbnQxNihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMik7XG5cdHdyaXRlci52aWV3LnNldFVpbnQxNihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcblx0d3JpdGVyLnZpZXcuc2V0SW50MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xuXHR3cml0ZXIudmlldy5zZXRVaW50MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcblx0d3JpdGVyLnZpZXcuc2V0RmxvYXQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZsb2F0NjQod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDgpO1xuXHR3cml0ZXIudmlldy5zZXRGbG9hdDY0KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciAxNi4xNlxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZSAqICgxIDw8IDE2KSk7XG59XG5cbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUgKiAoMSA8PCAyNCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVCeXRlcyh3cml0ZXI6IFBzZFdyaXRlciwgYnVmZmVyOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkKSB7XG5cdGlmIChidWZmZXIpIHtcblx0XHRlbnN1cmVTaXplKHdyaXRlciwgd3JpdGVyLm9mZnNldCArIGJ1ZmZlci5sZW5ndGgpO1xuXHRcdGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlcik7XG5cdFx0Ynl0ZXMuc2V0KGJ1ZmZlciwgd3JpdGVyLm9mZnNldCk7XG5cdFx0d3JpdGVyLm9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVplcm9zKHdyaXRlcjogUHNkV3JpdGVyLCBjb3VudDogbnVtYmVyKSB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVTaWduYXR1cmUod3JpdGVyOiBQc2RXcml0ZXIsIHNpZ25hdHVyZTogc3RyaW5nKSB7XG5cdGlmIChzaWduYXR1cmUubGVuZ3RoICE9PSA0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnbmF0dXJlfSdgKTtcblx0fVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHNpZ25hdHVyZS5jaGFyQ29kZUF0KGkpKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZywgcGFkVG8gPSAyKSB7XG5cdGxldCBsZW5ndGggPSB0ZXh0Lmxlbmd0aDtcblx0d3JpdGVVaW50OCh3cml0ZXIsIGxlbmd0aCk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IGNvZGUgPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGNvZGUgPCAxMjggPyBjb2RlIDogJz8nLmNoYXJDb2RlQXQoMCkpO1xuXHR9XG5cblx0d2hpbGUgKCsrbGVuZ3RoICUgcGFkVG8pIHtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nKSB7XG5cdHdyaXRlVWludDMyKHdyaXRlciwgdGV4dC5sZW5ndGgpO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZykge1xuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHRleHQubGVuZ3RoICsgMSk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCB0ZXh0LmNoYXJDb2RlQXQoaSkpO1xuXHR9XG5cblx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcbn1cblxuZnVuY3Rpb24gZ2V0TGFyZ2VzdExheWVyU2l6ZShsYXllcnM6IExheWVyW10gPSBbXSk6IG51bWJlciB7XG5cdGxldCBtYXggPSAwO1xuXG5cdGZvciAoY29uc3QgbGF5ZXIgb2YgbGF5ZXJzKSB7XG5cdFx0aWYgKGxheWVyLmNhbnZhcyB8fCBsYXllci5pbWFnZURhdGEpIHtcblx0XHRcdGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKGxheWVyKTtcblx0XHRcdG1heCA9IE1hdGgubWF4KG1heCwgMiAqIGhlaWdodCArIDIgKiB3aWR0aCAqIGhlaWdodCk7XG5cdFx0fVxuXG5cdFx0aWYgKGxheWVyLmNoaWxkcmVuKSB7XG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIGdldExhcmdlc3RMYXllclNpemUobGF5ZXIuY2hpbGRyZW4pKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbWF4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVTZWN0aW9uKHdyaXRlcjogUHNkV3JpdGVyLCByb3VuZDogbnVtYmVyLCBmdW5jOiAoKSA9PiB2b2lkLCB3cml0ZVRvdGFsTGVuZ3RoID0gZmFsc2UpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcblx0d3JpdGVJbnQzMih3cml0ZXIsIDApO1xuXG5cdGZ1bmMoKTtcblxuXHRsZXQgbGVuZ3RoID0gd3JpdGVyLm9mZnNldCAtIG9mZnNldCAtIDQ7XG5cdGxldCBsZW4gPSBsZW5ndGg7XG5cblx0d2hpbGUgKChsZW4gJSByb3VuZCkgIT09IDApIHtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XG5cdFx0bGVuKys7XG5cdH1cblxuXHRpZiAod3JpdGVUb3RhbExlbmd0aCkge1xuXHRcdGxlbmd0aCA9IGxlbjtcblx0fVxuXG5cdHdyaXRlci52aWV3LnNldEludDMyKG9mZnNldCwgbGVuZ3RoLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZCh3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFdyaXRlT3B0aW9ucyA9IHt9KSB7XG5cdGlmICghKCtwc2Qud2lkdGggPiAwICYmICtwc2QuaGVpZ2h0ID4gMCkpXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGRvY3VtZW50IHNpemUnKTtcblxuXHRsZXQgaW1hZ2VSZXNvdXJjZXMgPSBwc2QuaW1hZ2VSZXNvdXJjZXMgfHwge307XG5cblx0aWYgKG9wdGlvbnMuZ2VuZXJhdGVUaHVtYm5haWwpIHtcblx0XHRpbWFnZVJlc291cmNlcyA9IHsgLi4uaW1hZ2VSZXNvdXJjZXMsIHRodW1ibmFpbDogY3JlYXRlVGh1bWJuYWlsKHBzZCkgfTtcblx0fVxuXG5cdGxldCBpbWFnZURhdGEgPSBwc2QuaW1hZ2VEYXRhO1xuXG5cdGlmICghaW1hZ2VEYXRhICYmIHBzZC5jYW52YXMpIHtcblx0XHRpbWFnZURhdGEgPSBwc2QuY2FudmFzLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCBwc2QuY2FudmFzLndpZHRoLCBwc2QuY2FudmFzLmhlaWdodCk7XG5cdH1cblxuXHRpZiAoaW1hZ2VEYXRhICYmIChwc2Qud2lkdGggIT09IGltYWdlRGF0YS53aWR0aCB8fCBwc2QuaGVpZ2h0ICE9PSBpbWFnZURhdGEuaGVpZ2h0KSlcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RvY3VtZW50IGNhbnZhcyBtdXN0IGhhdmUgdGhlIHNhbWUgc2l6ZSBhcyBkb2N1bWVudCcpO1xuXG5cdGNvbnN0IGdsb2JhbEFscGhhID0gISFpbWFnZURhdGEgJiYgaGFzQWxwaGEoaW1hZ2VEYXRhKTtcblx0Y29uc3QgbWF4QnVmZmVyU2l6ZSA9IE1hdGgubWF4KGdldExhcmdlc3RMYXllclNpemUocHNkLmNoaWxkcmVuKSwgNCAqIDIgKiBwc2Qud2lkdGggKiBwc2QuaGVpZ2h0ICsgMiAqIHBzZC5oZWlnaHQpO1xuXHRjb25zdCB0ZW1wQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobWF4QnVmZmVyU2l6ZSk7XG5cblx0Ly8gaGVhZGVyXG5cdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCUFMnKTtcblx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxuXHR3cml0ZVplcm9zKHdyaXRlciwgNik7XG5cdHdyaXRlVWludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyA0IDogMyk7IC8vIGNoYW5uZWxzXG5cdHdyaXRlVWludDMyKHdyaXRlciwgcHNkLmhlaWdodCk7XG5cdHdyaXRlVWludDMyKHdyaXRlciwgcHNkLndpZHRoKTtcblx0d3JpdGVVaW50MTYod3JpdGVyLCA4KTsgLy8gYml0cyBwZXIgY2hhbm5lbFxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yTW9kZS5SR0IpO1xuXG5cdC8vIGNvbG9yIG1vZGUgZGF0YVxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0Ly8gVE9ETzogaW1wbGVtZW50XG5cdH0pO1xuXG5cdC8vIGltYWdlIHJlc291cmNlc1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIHJlc291cmNlSGFuZGxlcnMpIHtcblx0XHRcdGlmIChoYW5kbGVyLmhhcyhpbWFnZVJlc291cmNlcykpIHtcblx0XHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHRcdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGhhbmRsZXIua2V5KTtcblx0XHRcdFx0d3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyLCAnJyk7XG5cdFx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDIsICgpID0+IGhhbmRsZXIud3JpdGUod3JpdGVyLCBpbWFnZVJlc291cmNlcykpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Ly8gbGF5ZXIgYW5kIG1hc2sgaW5mb1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiB7XG5cdFx0d3JpdGVMYXllckluZm8odGVtcEJ1ZmZlciwgd3JpdGVyLCBwc2QsIGdsb2JhbEFscGhhLCBvcHRpb25zKTtcblx0XHR3cml0ZUdsb2JhbExheWVyTWFza0luZm8od3JpdGVyKTtcblx0XHR3cml0ZUFkZGl0aW9uYWxMYXllckluZm8od3JpdGVyLCBwc2QsIHBzZCwgb3B0aW9ucyk7XG5cdH0pO1xuXG5cdC8vIGltYWdlIGRhdGFcblx0Y29uc3QgY2hhbm5lbHMgPSBnbG9iYWxBbHBoYSA/IFswLCAxLCAyLCAzXSA6IFswLCAxLCAyXTtcblx0Y29uc3QgZGF0YTogUGl4ZWxEYXRhID0gaW1hZ2VEYXRhIHx8IHtcblx0XHRkYXRhOiBuZXcgVWludDhBcnJheSg0ICogcHNkLndpZHRoICogcHNkLmhlaWdodCksXG5cdFx0d2lkdGg6IHBzZC53aWR0aCxcblx0XHRoZWlnaHQ6IHBzZC5oZWlnaHQsXG5cdH07XG5cblx0Ly8gVE9ETyhqc3IpOiByZWFkaW5nIGZhaWxzIGZvciBjb21wcmVzc2luZyBtdWx0aXBsZSBjaGFubmVscyBhdCBvbmNlLCBzbyByZXZlcnQgdG8gUkxFIGhlcmVcblx0Y29uc3QgY29tcHJlc3Npb24gPSBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkOyAvLyBvcHRpb25zLmNvbXByZXNzaW9uIHx8IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQ7XG5cdC8vIGNvbnN0IGNvbXByZXNzaW9uID0gb3B0aW9ucy5jb21wcmVzc2lvbiB8fCBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkO1xuXHR3cml0ZVVpbnQxNih3cml0ZXIsIGNvbXByZXNzaW9uKTtcblx0d3JpdGVCeXRlcyh3cml0ZXIsIHdyaXRlRGF0YSh0ZW1wQnVmZmVyLCBkYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIGNoYW5uZWxzLCBjb21wcmVzc2lvbikpO1xufVxuXG5mdW5jdGlvbiB3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCB3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgNCwgKCkgPT4ge1xuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xuXG5cdFx0YWRkQ2hpbGRyZW4obGF5ZXJzLCBwc2QuY2hpbGRyZW4pO1xuXG5cdFx0aWYgKCFsYXllcnMubGVuZ3RoKSBsYXllcnMucHVzaCh7fSk7XG5cblx0XHR3cml0ZUludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyAtbGF5ZXJzLmxlbmd0aCA6IGxheWVycy5sZW5ndGgpO1xuXG5cdFx0Y29uc3QgbGF5ZXJzRGF0YSA9IGxheWVycy5tYXAoKGwsIGkpID0+IGdldENoYW5uZWxzKHRlbXBCdWZmZXIsIGwsIGkgPT09IDAsIG9wdGlvbnMpKTtcblxuXHRcdC8vIGxheWVyIHJlY29yZHNcblx0XHRmb3IgKGNvbnN0IGxheWVyRGF0YSBvZiBsYXllcnNEYXRhKSB7XG5cdFx0XHRjb25zdCB7IGxheWVyLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIGNoYW5uZWxzIH0gPSBsYXllckRhdGE7XG5cblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB0b3ApO1xuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGxlZnQpO1xuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGJvdHRvbSk7XG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgcmlnaHQpO1xuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVscy5sZW5ndGgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgY2hhbm5lbHMpIHtcblx0XHRcdFx0d3JpdGVJbnQxNih3cml0ZXIsIGMuY2hhbm5lbElkKTtcblx0XHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGMubGVuZ3RoKTtcblx0XHRcdH1cblxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmcm9tQmxlbmRNb2RlW2xheWVyLmJsZW5kTW9kZSFdIHx8ICdub3JtJyk7XG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChjbGFtcChsYXllci5vcGFjaXR5ID8/IDEsIDAsIDEpICogMjU1KSk7XG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbGF5ZXIuY2xpcHBpbmcgPyAxIDogMCk7XG5cblx0XHRcdGxldCBmbGFncyA9IDB4MDg7IC8vIDEgZm9yIFBob3Rvc2hvcCA1LjAgYW5kIGxhdGVyLCB0ZWxscyBpZiBiaXQgNCBoYXMgdXNlZnVsIGluZm9ybWF0aW9uXG5cdFx0XHRpZiAobGF5ZXIudHJhbnNwYXJlbmN5UHJvdGVjdGVkKSBmbGFncyB8PSAweDAxO1xuXHRcdFx0aWYgKGxheWVyLmhpZGRlbikgZmxhZ3MgfD0gMHgwMjtcblx0XHRcdGlmIChsYXllci52ZWN0b3JNYXNrKSBmbGFncyB8PSAweDEwOyAvLyBwaXhlbCBkYXRhIGlycmVsZXZhbnQgdG8gYXBwZWFyYW5jZSBvZiBkb2N1bWVudFxuXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApOyAvLyBmaWxsZXJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcblx0XHRcdFx0d3JpdGVMYXllck1hc2tEYXRhKHdyaXRlciwgbGF5ZXIsIGxheWVyRGF0YSk7XG5cdFx0XHRcdHdyaXRlTGF5ZXJCbGVuZGluZ1Jhbmdlcyh3cml0ZXIsIHBzZCk7XG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgbGF5ZXIubmFtZSB8fCAnJywgNCk7XG5cdFx0XHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gbGF5ZXIgY2hhbm5lbCBpbWFnZSBkYXRhXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGxheWVyRGF0YS5jaGFubmVscykge1xuXHRcdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWwuY29tcHJlc3Npb24pO1xuXG5cdFx0XHRcdGlmIChjaGFubmVsLmJ1ZmZlcikge1xuXHRcdFx0XHRcdHdyaXRlQnl0ZXMod3JpdGVyLCBjaGFubmVsLmJ1ZmZlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHR9LCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllck1hc2tEYXRhKHdyaXRlcjogUHNkV3JpdGVyLCB7IG1hc2ssIHZlY3Rvck1hc2sgfTogTGF5ZXIsIGxheWVyRGF0YTogTGF5ZXJDaGFubmVsRGF0YSkge1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0aWYgKCFtYXNrKSByZXR1cm47XG5cblx0XHRjb25zdCBtID0gbGF5ZXJEYXRhLm1hc2sgfHwge30gYXMgUGFydGlhbDxCb3VuZHM+O1xuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLnRvcCEpO1xuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmxlZnQhKTtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5ib3R0b20hKTtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5yaWdodCEpO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBtYXNrLmRlZmF1bHRDb2xvciEpO1xuXG5cdFx0bGV0IHBhcmFtcyA9IDA7XG5cdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eTtcblx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyO1xuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tEZW5zaXR5O1xuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tGZWF0aGVyO1xuXG5cdFx0bGV0IGZsYWdzID0gMDtcblx0XHRpZiAobWFzay5kaXNhYmxlZCkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQ7XG5cdFx0aWYgKG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyO1xuXHRcdGlmICh2ZWN0b3JNYXNrKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5MYXllck1hc2tGcm9tUmVuZGVyaW5nT3RoZXJEYXRhO1xuXHRcdGlmIChwYXJhbXMpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQ7XG5cblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xuXG5cdFx0aWYgKHBhcmFtcykge1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIHBhcmFtcyk7XG5cblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnVzZXJNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSB3cml0ZUZsb2F0NjQod3JpdGVyLCBtYXNrLnVzZXJNYXNrRmVhdGhlcik7XG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICogMHhmZikpO1xuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay52ZWN0b3JNYXNrRmVhdGhlcik7XG5cdFx0fVxuXG5cdFx0Ly8gVE9ETzogaGFuZGxlIHJlc3Qgb2YgdGhlIGZpZWxkc1xuXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCkge1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cblx0XHQvLyBUT0RPOiB1c2UgYWx3YXlzIDQgaW5zdGVhZCA/XG5cdFx0Y29uc3QgY2hhbm5lbHMgPSBwc2QuY2hhbm5lbHMgfHwgMDtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHM7IGkrKykge1xuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB3cml0ZUdsb2JhbExheWVyTWFza0luZm8od3JpdGVyOiBQc2RXcml0ZXIpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdC8vIFRPRE86IGltcGxlbWVudFxuXHR9KTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMpIHtcblx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIGluZm9IYW5kbGVycykge1xuXHRcdGlmIChoYW5kbGVyLmtleSA9PT0gJ1R4dDInICYmIG9wdGlvbnMuaW52YWxpZGF0ZVRleHRMYXllcnMpIGNvbnRpbnVlO1xuXG5cdFx0aWYgKGhhbmRsZXIuaGFzKHRhcmdldCkpIHtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgaGFuZGxlci5rZXkpO1xuXG5cdFx0XHRjb25zdCBhbGlnbiA9IGhhbmRsZXIua2V5ID09PSAnVHh0MicgPyA0IDogMjtcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIGFsaWduLCAoKSA9PiBoYW5kbGVyLndyaXRlKHdyaXRlciwgdGFyZ2V0LCBwc2QsIG9wdGlvbnMpLCBoYW5kbGVyLmtleSAhPT0gJ1R4dDInKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gYWRkQ2hpbGRyZW4obGF5ZXJzOiBMYXllcltdLCBjaGlsZHJlbjogTGF5ZXJbXSB8IHVuZGVmaW5lZCkge1xuXHRpZiAoIWNoaWxkcmVuKVxuXHRcdHJldHVybjtcblxuXHRmb3IgKGNvbnN0IGMgb2YgY2hpbGRyZW4pIHtcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmNhbnZhcylcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnY2FudmFzJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XG5cblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmltYWdlRGF0YSlcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnaW1hZ2VEYXRhJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XG5cblx0XHRpZiAoYy5jaGlsZHJlbikge1xuXHRcdFx0Y29uc3Qgc2VjdGlvbkRpdmlkZXIgPSB7XG5cdFx0XHRcdHR5cGU6IGMub3BlbmVkID09PSBmYWxzZSA/IFNlY3Rpb25EaXZpZGVyVHlwZS5DbG9zZWRGb2xkZXIgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcixcblx0XHRcdFx0a2V5OiBjLmJsZW5kTW9kZSB8fCAncGFzcycsXG5cdFx0XHRcdHN1YnR5cGU6IDAsXG5cdFx0XHR9O1xuXHRcdFx0bGF5ZXJzLnB1c2goe1xuXHRcdFx0XHRuYW1lOiAnPC9MYXllciBncm91cD4nLFxuXHRcdFx0XHRzZWN0aW9uRGl2aWRlcjoge1xuXHRcdFx0XHRcdHR5cGU6IFNlY3Rpb25EaXZpZGVyVHlwZS5Cb3VuZGluZ1NlY3Rpb25EaXZpZGVyLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRhZGRDaGlsZHJlbihsYXllcnMsIGMuY2hpbGRyZW4pO1xuXHRcdFx0bGF5ZXJzLnB1c2goeyAuLi5jLCBzZWN0aW9uRGl2aWRlciB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGF5ZXJzLnB1c2goeyAuLi5jIH0pO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiByZXNpemVCdWZmZXIod3JpdGVyOiBQc2RXcml0ZXIsIHNpemU6IG51bWJlcikge1xuXHRsZXQgbmV3TGVuZ3RoID0gd3JpdGVyLmJ1ZmZlci5ieXRlTGVuZ3RoO1xuXG5cdGRvIHtcblx0XHRuZXdMZW5ndGggKj0gMjtcblx0fSB3aGlsZSAoc2l6ZSA+IG5ld0xlbmd0aCk7XG5cblx0Y29uc3QgbmV3QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKG5ld0xlbmd0aCk7XG5cdGNvbnN0IG5ld0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkobmV3QnVmZmVyKTtcblx0Y29uc3Qgb2xkQnl0ZXMgPSBuZXcgVWludDhBcnJheSh3cml0ZXIuYnVmZmVyKTtcblx0bmV3Qnl0ZXMuc2V0KG9sZEJ5dGVzKTtcblx0d3JpdGVyLmJ1ZmZlciA9IG5ld0J1ZmZlcjtcblx0d3JpdGVyLnZpZXcgPSBuZXcgRGF0YVZpZXcod3JpdGVyLmJ1ZmZlcik7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZVNpemUod3JpdGVyOiBQc2RXcml0ZXIsIHNpemU6IG51bWJlcikge1xuXHRpZiAoc2l6ZSA+IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aCkge1xuXHRcdHJlc2l6ZUJ1ZmZlcih3cml0ZXIsIHNpemUpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFkZFNpemUod3JpdGVyOiBQc2RXcml0ZXIsIHNpemU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xuXHRlbnN1cmVTaXplKHdyaXRlciwgd3JpdGVyLm9mZnNldCArPSBzaXplKTtcblx0cmV0dXJuIG9mZnNldDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVGh1bWJuYWlsKHBzZDogUHNkKSB7XG5cdGNvbnN0IGNhbnZhcyA9IGNyZWF0ZUNhbnZhcygxMCwgMTApO1xuXHRsZXQgc2NhbGUgPSAxO1xuXG5cdGlmIChwc2Qud2lkdGggPiBwc2QuaGVpZ2h0KSB7XG5cdFx0Y2FudmFzLndpZHRoID0gMTYwO1xuXHRcdGNhbnZhcy5oZWlnaHQgPSBNYXRoLmZsb29yKHBzZC5oZWlnaHQgKiAoY2FudmFzLndpZHRoIC8gcHNkLndpZHRoKSk7XG5cdFx0c2NhbGUgPSBjYW52YXMud2lkdGggLyBwc2Qud2lkdGg7XG5cdH0gZWxzZSB7XG5cdFx0Y2FudmFzLmhlaWdodCA9IDE2MDtcblx0XHRjYW52YXMud2lkdGggPSBNYXRoLmZsb29yKHBzZC53aWR0aCAqIChjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodCkpO1xuXHRcdHNjYWxlID0gY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQ7XG5cdH1cblxuXHRjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykhO1xuXHRjb250ZXh0LnNjYWxlKHNjYWxlLCBzY2FsZSk7XG5cblx0aWYgKHBzZC5pbWFnZURhdGEpIHtcblx0XHRjb25zdCB0ZW1wID0gY3JlYXRlQ2FudmFzKHBzZC5pbWFnZURhdGEud2lkdGgsIHBzZC5pbWFnZURhdGEuaGVpZ2h0KTtcblx0XHR0ZW1wLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShwc2QuaW1hZ2VEYXRhLCAwLCAwKTtcblx0XHRjb250ZXh0LmRyYXdJbWFnZSh0ZW1wLCAwLCAwKTtcblx0fSBlbHNlIGlmIChwc2QuY2FudmFzKSB7XG5cdFx0Y29udGV4dC5kcmF3SW1hZ2UocHNkLmNhbnZhcywgMCwgMCk7XG5cdH1cblxuXHRyZXR1cm4gY2FudmFzO1xufVxuXG5mdW5jdGlvbiBnZXRDaGFubmVscyhcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcbik6IExheWVyQ2hhbm5lbERhdGEge1xuXHRjb25zdCBsYXllckRhdGEgPSBnZXRMYXllckNoYW5uZWxzKHRlbXBCdWZmZXIsIGxheWVyLCBiYWNrZ3JvdW5kLCBvcHRpb25zKTtcblx0Y29uc3QgbWFzayA9IGxheWVyLm1hc2s7XG5cblx0aWYgKG1hc2spIHtcblx0XHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBtYXNrO1xuXHRcdGxldCB7IHdpZHRoLCBoZWlnaHQgfSA9IGdldExheWVyRGltZW50aW9ucyhtYXNrKTtcblx0XHRsZXQgaW1hZ2VEYXRhID0gbWFzay5pbWFnZURhdGE7XG5cblx0XHRpZiAoIWltYWdlRGF0YSAmJiBtYXNrLmNhbnZhcyAmJiB3aWR0aCAmJiBoZWlnaHQpIHtcblx0XHRcdGltYWdlRGF0YSA9IG1hc2suY2FudmFzLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHR9XG5cblx0XHRjb25zdCBjb21wcmVzc2lvbiA9IG9wdGlvbnMuY29tcHJlc3Npb24gfHwgQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZDtcblxuXHRcdGlmICh3aWR0aCAmJiBoZWlnaHQgJiYgaW1hZ2VEYXRhKSB7XG5cdFx0XHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcblx0XHRcdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcblxuXHRcdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVEYXRhKHRlbXBCdWZmZXIsIGltYWdlRGF0YSwgd2lkdGgsIGhlaWdodCwgWzBdLCBjb21wcmVzc2lvbikhO1xuXG5cdFx0XHRsYXllckRhdGEubWFzayA9IHsgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tIH07XG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XG5cdFx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlVzZXJNYXNrLFxuXHRcdFx0XHRjb21wcmVzc2lvbixcblx0XHRcdFx0YnVmZmVyLFxuXHRcdFx0XHRsZW5ndGg6IDIgKyBidWZmZXIubGVuZ3RoLFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxheWVyRGF0YS5tYXNrID0geyB0b3A6IDAsIGxlZnQ6IDAsIHJpZ2h0OiAwLCBib3R0b206IDAgfTtcblx0XHRcdGxheWVyRGF0YS5jaGFubmVscy5wdXNoKHtcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXG5cdFx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLFxuXHRcdFx0XHRidWZmZXI6IG5ldyBVaW50OEFycmF5KDApLFxuXHRcdFx0XHRsZW5ndGg6IDAsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gbGF5ZXJEYXRhO1xufVxuXG5mdW5jdGlvbiBnZXRMYXllckRpbWVudGlvbnMoeyBjYW52YXMsIGltYWdlRGF0YSB9OiBMYXllcik6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IH0ge1xuXHRyZXR1cm4gaW1hZ2VEYXRhIHx8IGNhbnZhcyB8fCB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcbn1cblxuZnVuY3Rpb24gY3JvcEltYWdlRGF0YShkYXRhOiBJbWFnZURhdGEsIGxlZnQ6IG51bWJlciwgdG9wOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XG5cdGNvbnN0IGNyb3BwZWREYXRhID0gY3JlYXRlSW1hZ2VEYXRhKHdpZHRoLCBoZWlnaHQpO1xuXHRjb25zdCBzcmNEYXRhID0gZGF0YS5kYXRhO1xuXHRjb25zdCBkc3REYXRhID0gY3JvcHBlZERhdGEuZGF0YTtcblxuXHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG5cdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XG5cdFx0XHRsZXQgc3JjID0gKCh4ICsgbGVmdCkgKyAoeSArIHRvcCkgKiB3aWR0aCkgKiA0O1xuXHRcdFx0bGV0IGRzdCA9ICh4ICsgeSAqIHdpZHRoKSAqIDQ7XG5cdFx0XHRkc3REYXRhW2RzdF0gPSBzcmNEYXRhW3NyY107XG5cdFx0XHRkc3REYXRhW2RzdCArIDFdID0gc3JjRGF0YVtzcmMgKyAxXTtcblx0XHRcdGRzdERhdGFbZHN0ICsgMl0gPSBzcmNEYXRhW3NyYyArIDJdO1xuXHRcdFx0ZHN0RGF0YVtkc3QgKyAzXSA9IHNyY0RhdGFbc3JjICsgM107XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGNyb3BwZWREYXRhO1xufVxuXG5mdW5jdGlvbiBnZXRMYXllckNoYW5uZWxzKFxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xuKTogTGF5ZXJDaGFubmVsRGF0YSB7XG5cdGxldCB7IHRvcCA9IDAsIGxlZnQgPSAwLCByaWdodCA9IDAsIGJvdHRvbSA9IDAgfSA9IGxheWVyO1xuXHRsZXQgY2hhbm5lbHM6IENoYW5uZWxEYXRhW10gPSBbXG5cdFx0e1xuXHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVHJhbnNwYXJlbmN5LFxuXHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsXG5cdFx0XHRidWZmZXI6IHVuZGVmaW5lZCxcblx0XHRcdGxlbmd0aDogMixcblx0XHR9XG5cdF07XG5cblx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKGxheWVyKTtcblxuXHRpZiAoIShsYXllci5jYW52YXMgfHwgbGF5ZXIuaW1hZ2VEYXRhKSB8fCAhd2lkdGggfHwgIWhlaWdodCkge1xuXHRcdHJpZ2h0ID0gbGVmdDtcblx0XHRib3R0b20gPSB0b3A7XG5cdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcblx0fVxuXG5cdHJpZ2h0ID0gbGVmdCArIHdpZHRoO1xuXHRib3R0b20gPSB0b3AgKyBoZWlnaHQ7XG5cblx0bGV0IGRhdGEgPSBsYXllci5pbWFnZURhdGEgfHwgbGF5ZXIuY2FudmFzIS5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG5cblx0aWYgKG9wdGlvbnMudHJpbUltYWdlRGF0YSkge1xuXHRcdGNvbnN0IHRyaW1tZWQgPSB0cmltRGF0YShkYXRhKTtcblxuXHRcdGlmICh0cmltbWVkLmxlZnQgIT09IDAgfHwgdHJpbW1lZC50b3AgIT09IDAgfHwgdHJpbW1lZC5yaWdodCAhPT0gZGF0YS53aWR0aCB8fCB0cmltbWVkLmJvdHRvbSAhPT0gZGF0YS5oZWlnaHQpIHtcblx0XHRcdGxlZnQgKz0gdHJpbW1lZC5sZWZ0O1xuXHRcdFx0dG9wICs9IHRyaW1tZWQudG9wO1xuXHRcdFx0cmlnaHQgLT0gKGRhdGEud2lkdGggLSB0cmltbWVkLnJpZ2h0KTtcblx0XHRcdGJvdHRvbSAtPSAoZGF0YS5oZWlnaHQgLSB0cmltbWVkLmJvdHRvbSk7XG5cdFx0XHR3aWR0aCA9IHJpZ2h0IC0gbGVmdDtcblx0XHRcdGhlaWdodCA9IGJvdHRvbSAtIHRvcDtcblxuXHRcdFx0aWYgKCF3aWR0aCB8fCAhaGVpZ2h0KSB7XG5cdFx0XHRcdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChsYXllci5pbWFnZURhdGEpIHtcblx0XHRcdFx0ZGF0YSA9IGNyb3BJbWFnZURhdGEoZGF0YSwgdHJpbW1lZC5sZWZ0LCB0cmltbWVkLnRvcCwgd2lkdGgsIGhlaWdodCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkYXRhID0gbGF5ZXIuY2FudmFzIS5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEodHJpbW1lZC5sZWZ0LCB0cmltbWVkLnRvcCwgd2lkdGgsIGhlaWdodCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgY2hhbm5lbElkcyA9IFtcblx0XHRDaGFubmVsSUQuUmVkLFxuXHRcdENoYW5uZWxJRC5HcmVlbixcblx0XHRDaGFubmVsSUQuQmx1ZSxcblx0XTtcblxuXHRpZiAoIWJhY2tncm91bmQgfHwgaGFzQWxwaGEoZGF0YSkgfHwgbGF5ZXIubWFzaykge1xuXHRcdGNoYW5uZWxJZHMudW5zaGlmdChDaGFubmVsSUQuVHJhbnNwYXJlbmN5KTtcblx0fVxuXG5cdGNvbnN0IGNvbXByZXNzaW9uID0gb3B0aW9ucy5jb21wcmVzc2lvbiB8fCBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkO1xuXG5cdGNoYW5uZWxzID0gY2hhbm5lbElkcy5tYXAoY2hhbm5lbCA9PiB7XG5cdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsKTtcblx0XHRsZXQgYnVmZmVyID0gd3JpdGVEYXRhKHRlbXBCdWZmZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIFtvZmZzZXRdLCBjb21wcmVzc2lvbikhO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNoYW5uZWxJZDogY2hhbm5lbCxcblx0XHRcdGNvbXByZXNzaW9uLFxuXHRcdFx0YnVmZmVyLFxuXHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcblx0XHR9O1xuXHR9KTtcblxuXHRyZXR1cm4geyBsYXllciwgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tLCBjaGFubmVscyB9O1xufVxuXG5mdW5jdGlvbiBpc1Jvd0VtcHR5KHsgZGF0YSwgd2lkdGggfTogUGl4ZWxEYXRhLCB5OiBudW1iZXIsIGxlZnQ6IG51bWJlciwgcmlnaHQ6IG51bWJlcikge1xuXHRjb25zdCBzdGFydCA9ICgoeSAqIHdpZHRoICsgbGVmdCkgKiA0ICsgMykgfCAwO1xuXHRjb25zdCBlbmQgPSAoc3RhcnQgKyAocmlnaHQgLSBsZWZ0KSAqIDQpIHwgMDtcblxuXHRmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgPSAoaSArIDQpIHwgMCkge1xuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGlzQ29sRW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHg6IG51bWJlciwgdG9wOiBudW1iZXIsIGJvdHRvbTogbnVtYmVyKSB7XG5cdGNvbnN0IHN0cmlkZSA9ICh3aWR0aCAqIDQpIHwgMDtcblx0Y29uc3Qgc3RhcnQgPSAodG9wICogc3RyaWRlICsgeCAqIDQgKyAzKSB8IDA7XG5cblx0Zm9yIChsZXQgeSA9IHRvcCwgaSA9IHN0YXJ0OyB5IDwgYm90dG9tOyB5KyssIGkgPSAoaSArIHN0cmlkZSkgfCAwKSB7XG5cdFx0aWYgKGRhdGFbaV0gIT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gdHJpbURhdGEoZGF0YTogUGl4ZWxEYXRhKSB7XG5cdGxldCB0b3AgPSAwO1xuXHRsZXQgbGVmdCA9IDA7XG5cdGxldCByaWdodCA9IGRhdGEud2lkdGg7XG5cdGxldCBib3R0b20gPSBkYXRhLmhlaWdodDtcblxuXHR3aGlsZSAodG9wIDwgYm90dG9tICYmIGlzUm93RW1wdHkoZGF0YSwgdG9wLCBsZWZ0LCByaWdodCkpXG5cdFx0dG9wKys7XG5cdHdoaWxlIChib3R0b20gPiB0b3AgJiYgaXNSb3dFbXB0eShkYXRhLCBib3R0b20gLSAxLCBsZWZ0LCByaWdodCkpXG5cdFx0Ym90dG9tLS07XG5cdHdoaWxlIChsZWZ0IDwgcmlnaHQgJiYgaXNDb2xFbXB0eShkYXRhLCBsZWZ0LCB0b3AsIGJvdHRvbSkpXG5cdFx0bGVmdCsrO1xuXHR3aGlsZSAocmlnaHQgPiBsZWZ0ICYmIGlzQ29sRW1wdHkoZGF0YSwgcmlnaHQgLSAxLCB0b3AsIGJvdHRvbSkpXG5cdFx0cmlnaHQtLTtcblxuXHRyZXR1cm4geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQ29sb3Iod3JpdGVyOiBQc2RXcml0ZXIsIGNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZCkge1xuXHRpZiAoIWNvbG9yKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLlJHQik7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDgpO1xuXHR9IGVsc2UgaWYgKCdyJyBpbiBjb2xvcikge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5yICogMjU3KSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmcgKiAyNTcpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiAqIDI1NykpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XG5cdH0gZWxzZSBpZiAoJ2wnIGluIGNvbG9yKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkxhYik7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmwgKiAxMDApKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYSAqIDEwMCkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5iICogMTAwKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcblx0fSBlbHNlIGlmICgnaCcgaW4gY29sb3IpIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuSFNCKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuaCkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5zKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHR9IGVsc2UgaWYgKCdjJyBpbiBjb2xvcikge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5DTVlLKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYykpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5tKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnkpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuaykpO1xuXHR9IGVsc2Uge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5HcmF5c2NhbGUpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rKSk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xuXHR9XG59XG4iXSwic291cmNlUm9vdCI6Ii9Vc2Vycy9qb2VyYWlpL2Rldi9hZy1wc2Qvc3JjIn0=
