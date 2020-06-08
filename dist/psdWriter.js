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
var RAW_IMAGE_DATA = false;
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
    writeUint16(writer, 1 /* RleCompressed */);
    if (RAW_IMAGE_DATA && psd.imageDataRaw) {
        console.log('writing raw image data');
        writeBytes(writer, psd.imageDataRaw);
    }
    else {
        writeBytes(writer, helpers_1.writeDataRLE(tempBuffer, data, psd.width, psd.height, channels));
    }
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
        if (width && height && imageData) {
            right = left + width;
            bottom = top_2 + height;
            var buffer = helpers_1.writeDataRLE(tempBuffer, imageData, width, height, [0]);
            layerData.mask = { top: top_2, left: left, right: right, bottom: bottom };
            layerData.channels.push({
                channelId: -2 /* UserMask */,
                compression: 1 /* RleCompressed */,
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
    channels = channelIds.map(function (channel) {
        var offset = helpers_1.offsetForChannel(channel);
        var buffer = helpers_1.writeDataRLE(tempBuffer, data, width, height, [offset]);
        if (RAW_IMAGE_DATA && layer.imageDataRaw) {
            console.log('written raw layer image data');
            buffer = layer.imageDataRaw[channel];
        }
        return {
            channelId: channel,
            compression: 1 /* RleCompressed */,
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBZ0Q7QUFDaEQsbURBQW9EO0FBRXBELElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQztBQVE3QixTQUFnQixZQUFZLENBQUMsSUFBVztJQUFYLHFCQUFBLEVBQUEsV0FBVztJQUN2QyxJQUFNLE1BQU0sR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQyxJQUFNLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDakIsT0FBTyxFQUFFLE1BQU0sUUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUM7QUFDakMsQ0FBQztBQUxELG9DQUtDO0FBRUQsU0FBZ0IsZUFBZSxDQUFDLE1BQWlCO0lBQ2hELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBRkQsMENBRUM7QUFFRCxTQUFnQixxQkFBcUIsQ0FBQyxNQUFpQjtJQUN0RCxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRkQsc0RBRUM7QUFFRCxTQUFnQixVQUFVLENBQUMsTUFBaUIsRUFBRSxLQUFhO0lBQzFELElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDM0QsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDM0QsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFlBQVksQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDNUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFIRCxvQ0FHQztBQUVELFNBQWdCLFlBQVksQ0FBQyxN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QUM7UUFDekMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6QztTQUFNO1FBQ04sV0FBVyxDQUFDLE1BQU0sb0JBQXVCLENBQUM7UUFDMUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDdEI7QUFDRixDQUFDO0FBakNELGdDQWlDQyIsImZpbGUiOiJwc2RXcml0ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQc2QsIExheWVyLCBMYXllckFkZGl0aW9uYWxJbmZvLCBDb2xvck1vZGUsIFNlY3Rpb25EaXZpZGVyVHlwZSwgV3JpdGVPcHRpb25zLCBDb2xvciB9IGZyb20gJy4vcHNkJztcbmltcG9ydCB7XG5cdGhhc0FscGhhLCBjcmVhdGVDYW52YXMsIHdyaXRlRGF0YVJMRSwgUGl4ZWxEYXRhLCBMYXllckNoYW5uZWxEYXRhLCBDaGFubmVsRGF0YSxcblx0b2Zmc2V0Rm9yQ2hhbm5lbCwgY3JlYXRlSW1hZ2VEYXRhLCBmcm9tQmxlbmRNb2RlLCBDaGFubmVsSUQsIENvbXByZXNzaW9uLCBjbGFtcCxcblx0TGF5ZXJNYXNrRmxhZ3MsIE1hc2tQYXJhbXMsIENvbG9yU3BhY2UsIEJvdW5kc1xufSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHsgaW5mb0hhbmRsZXJzIH0gZnJvbSAnLi9hZGRpdGlvbmFsSW5mbyc7XG5pbXBvcnQgeyByZXNvdXJjZUhhbmRsZXJzIH0gZnJvbSAnLi9pbWFnZVJlc291cmNlcyc7XG5cbmNvbnN0IFJBV19JTUFHRV9EQVRBID0gZmFsc2U7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHNkV3JpdGVyIHtcblx0b2Zmc2V0OiBudW1iZXI7XG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XG5cdHZpZXc6IERhdGFWaWV3O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV3JpdGVyKHNpemUgPSA0MDk2KTogUHNkV3JpdGVyIHtcblx0Y29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKHNpemUpO1xuXHRjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XG5cdGNvbnN0IG9mZnNldCA9IDA7XG5cdHJldHVybiB7IGJ1ZmZlciwgdmlldywgb2Zmc2V0IH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXcml0ZXJCdWZmZXIod3JpdGVyOiBQc2RXcml0ZXIpIHtcblx0cmV0dXJuIHdyaXRlci5idWZmZXIuc2xpY2UoMCwgd3JpdGVyLm9mZnNldCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRXcml0ZXJCdWZmZXJOb0NvcHkod3JpdGVyOiBQc2RXcml0ZXIpIHtcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIsIDAsIHdyaXRlci5vZmZzZXQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50OCh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMSk7XG5cdHdyaXRlci52aWV3LnNldFVpbnQ4KG9mZnNldCwgdmFsdWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMik7XG5cdHdyaXRlci52aWV3LnNldEludDE2KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDE2KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcblx0d3JpdGVyLnZpZXcuc2V0VWludDE2KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlSW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xuXHR3cml0ZXIudmlldy5zZXRJbnQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XG5cdHdyaXRlci52aWV3LnNldFVpbnQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZsb2F0MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xuXHR3cml0ZXIudmlldy5zZXRGbG9hdDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRmxvYXQ2NCh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgOCk7XG5cdHdyaXRlci52aWV3LnNldEZsb2F0NjQob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDE2LjE2XG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGaXhlZFBvaW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlICogKDEgPDwgMTYpKTtcbn1cblxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciA4LjI0XG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZSAqICgxIDw8IDI0KSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUJ5dGVzKHdyaXRlcjogUHNkV3JpdGVyLCBidWZmZXI6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQpIHtcblx0aWYgKGJ1ZmZlcikge1xuXHRcdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICsgYnVmZmVyLmxlbmd0aCk7XG5cdFx0Y29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSh3cml0ZXIuYnVmZmVyKTtcblx0XHRieXRlcy5zZXQoYnVmZmVyLCB3cml0ZXIub2Zmc2V0KTtcblx0XHR3cml0ZXIub2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlWmVyb3Mod3JpdGVyOiBQc2RXcml0ZXIsIGNvdW50OiBudW1iZXIpIHtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVNpZ25hdHVyZSh3cml0ZXI6IFBzZFdyaXRlciwgc2lnbmF0dXJlOiBzdHJpbmcpIHtcblx0aWYgKHNpZ25hdHVyZS5sZW5ndGggIT09IDQpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzaWduYXR1cmV9J2ApO1xuXHR9XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgc2lnbmF0dXJlLmNoYXJDb2RlQXQoaSkpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nLCBwYWRUbyA9IDIpIHtcblx0bGV0IGxlbmd0aCA9IHRleHQubGVuZ3RoO1xuXHR3cml0ZVVpbnQ4KHdyaXRlciwgbGVuZ3RoKTtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgY29kZSA9IHRleHQuY2hhckNvZGVBdChpKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgY29kZSA8IDEyOCA/IGNvZGUgOiAnPycuY2hhckNvZGVBdCgwKSk7XG5cdH1cblxuXHR3aGlsZSAoKytsZW5ndGggJSBwYWRUbykge1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcpIHtcblx0d3JpdGVVaW50MzIod3JpdGVyLCB0ZXh0Lmxlbmd0aCk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCB0ZXh0LmNoYXJDb2RlQXQoaSkpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nKSB7XG5cdHdyaXRlVWludDMyKHdyaXRlciwgdGV4dC5sZW5ndGggKyAxKTtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHRleHQuY2hhckNvZGVBdChpKSk7XG5cdH1cblxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xufVxuXG5mdW5jdGlvbiBnZXRMYXJnZXN0TGF5ZXJTaXplKGxheWVyczogTGF5ZXJbXSA9IFtdKTogbnVtYmVyIHtcblx0bGV0IG1heCA9IDA7XG5cblx0Zm9yIChjb25zdCBsYXllciBvZiBsYXllcnMpIHtcblx0XHRpZiAobGF5ZXIuY2FudmFzIHx8IGxheWVyLmltYWdlRGF0YSkge1xuXHRcdFx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xuXHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCAyICogaGVpZ2h0ICsgMiAqIHdpZHRoICogaGVpZ2h0KTtcblx0XHR9XG5cblx0XHRpZiAobGF5ZXIuY2hpbGRyZW4pIHtcblx0XHRcdG1heCA9IE1hdGgubWF4KG1heCwgZ2V0TGFyZ2VzdExheWVyU2l6ZShsYXllci5jaGlsZHJlbikpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBtYXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVNlY3Rpb24od3JpdGVyOiBQc2RXcml0ZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6ICgpID0+IHZvaWQsIHdyaXRlVG90YWxMZW5ndGggPSBmYWxzZSkge1xuXHRjb25zdCBvZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xuXHR3cml0ZUludDMyKHdyaXRlciwgMCk7XG5cblx0ZnVuYygpO1xuXG5cdGxldCBsZW5ndGggPSB3cml0ZXIub2Zmc2V0IC0gb2Zmc2V0IC0gNDtcblx0bGV0IGxlbiA9IGxlbmd0aDtcblxuXHR3aGlsZSAoKGxlbiAlIHJvdW5kKSAhPT0gMCkge1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcblx0XHRsZW4rKztcblx0fVxuXG5cdGlmICh3cml0ZVRvdGFsTGVuZ3RoKSB7XG5cdFx0bGVuZ3RoID0gbGVuO1xuXHR9XG5cblx0d3JpdGVyLnZpZXcuc2V0SW50MzIob2Zmc2V0LCBsZW5ndGgsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUHNkKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCwgb3B0aW9uczogV3JpdGVPcHRpb25zID0ge30pIHtcblx0aWYgKCEoK3BzZC53aWR0aCA+IDAgJiYgK3BzZC5oZWlnaHQgPiAwKSlcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZG9jdW1lbnQgc2l6ZScpO1xuXG5cdGxldCBpbWFnZVJlc291cmNlcyA9IHBzZC5pbWFnZVJlc291cmNlcyB8fCB7fTtcblxuXHRpZiAob3B0aW9ucy5nZW5lcmF0ZVRodW1ibmFpbCkge1xuXHRcdGltYWdlUmVzb3VyY2VzID0geyAuLi5pbWFnZVJlc291cmNlcywgdGh1bWJuYWlsOiBjcmVhdGVUaHVtYm5haWwocHNkKSB9O1xuXHR9XG5cblx0bGV0IGltYWdlRGF0YSA9IHBzZC5pbWFnZURhdGE7XG5cblx0aWYgKCFpbWFnZURhdGEgJiYgcHNkLmNhbnZhcykge1xuXHRcdGltYWdlRGF0YSA9IHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHBzZC5jYW52YXMud2lkdGgsIHBzZC5jYW52YXMuaGVpZ2h0KTtcblx0fVxuXG5cdGlmIChpbWFnZURhdGEgJiYgKHBzZC53aWR0aCAhPT0gaW1hZ2VEYXRhLndpZHRoIHx8IHBzZC5oZWlnaHQgIT09IGltYWdlRGF0YS5oZWlnaHQpKVxuXHRcdHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgY2FudmFzIG11c3QgaGF2ZSB0aGUgc2FtZSBzaXplIGFzIGRvY3VtZW50Jyk7XG5cblx0Y29uc3QgZ2xvYmFsQWxwaGEgPSAhIWltYWdlRGF0YSAmJiBoYXNBbHBoYShpbWFnZURhdGEpO1xuXHRjb25zdCBtYXhCdWZmZXJTaXplID0gTWF0aC5tYXgoZ2V0TGFyZ2VzdExheWVyU2l6ZShwc2QuY2hpbGRyZW4pLCA0ICogMiAqIHBzZC53aWR0aCAqIHBzZC5oZWlnaHQgKyAyICogcHNkLmhlaWdodCk7XG5cdGNvbnN0IHRlbXBCdWZmZXIgPSBuZXcgVWludDhBcnJheShtYXhCdWZmZXJTaXplKTtcblxuXHQvLyBoZWFkZXJcblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJQUycpO1xuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXG5cdHdyaXRlWmVyb3Mod3JpdGVyLCA2KTtcblx0d3JpdGVVaW50MTYod3JpdGVyLCBnbG9iYWxBbHBoYSA/IDQgOiAzKTsgLy8gY2hhbm5lbHNcblx0d3JpdGVVaW50MzIod3JpdGVyLCBwc2QuaGVpZ2h0KTtcblx0d3JpdGVVaW50MzIod3JpdGVyLCBwc2Qud2lkdGgpO1xuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDgpOyAvLyBiaXRzIHBlciBjaGFubmVsXG5cdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JNb2RlLlJHQik7XG5cblx0Ly8gY29sb3IgbW9kZSBkYXRhXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcblx0XHQvLyBUT0RPOiBpbXBsZW1lbnRcblx0fSk7XG5cblx0Ly8gaW1hZ2UgcmVzb3VyY2VzXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcblx0XHRmb3IgKGNvbnN0IGhhbmRsZXIgb2YgcmVzb3VyY2VIYW5kbGVycykge1xuXHRcdFx0aWYgKGhhbmRsZXIuaGFzKGltYWdlUmVzb3VyY2VzKSkge1xuXHRcdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaGFuZGxlci5rZXkpO1xuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsICcnKTtcblx0XHRcdFx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4gaGFuZGxlci53cml0ZSh3cml0ZXIsIGltYWdlUmVzb3VyY2VzKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBsYXllciBhbmQgbWFzayBpbmZvXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDIsICgpID0+IHtcblx0XHR3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyLCB3cml0ZXIsIHBzZCwgZ2xvYmFsQWxwaGEsIG9wdGlvbnMpO1xuXHRcdHdyaXRlR2xvYmFsTGF5ZXJNYXNrSW5mbyh3cml0ZXIpO1xuXHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIHBzZCwgcHNkLCBvcHRpb25zKTtcblx0fSk7XG5cblx0Ly8gaW1hZ2UgZGF0YVxuXHRjb25zdCBjaGFubmVscyA9IGdsb2JhbEFscGhhID8gWzAsIDEsIDIsIDNdIDogWzAsIDEsIDJdO1xuXHRjb25zdCBkYXRhOiBQaXhlbERhdGEgPSBpbWFnZURhdGEgfHwge1xuXHRcdGRhdGE6IG5ldyBVaW50OEFycmF5KDQgKiBwc2Qud2lkdGggKiBwc2QuaGVpZ2h0KSxcblx0XHR3aWR0aDogcHNkLndpZHRoLFxuXHRcdGhlaWdodDogcHNkLmhlaWdodCxcblx0fTtcblxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpO1xuXG5cdGlmIChSQVdfSU1BR0VfREFUQSAmJiAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3KSB7XG5cdFx0Y29uc29sZS5sb2coJ3dyaXRpbmcgcmF3IGltYWdlIGRhdGEnKTtcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyk7XG5cdH0gZWxzZSB7XG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIGNoYW5uZWxzKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllckluZm8odGVtcEJ1ZmZlcjogVWludDhBcnJheSwgd3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkLCBnbG9iYWxBbHBoYTogYm9vbGVhbiwgb3B0aW9uczogV3JpdGVPcHRpb25zKSB7XG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDQsICgpID0+IHtcblx0XHRjb25zdCBsYXllcnM6IExheWVyW10gPSBbXTtcblxuXHRcdGFkZENoaWxkcmVuKGxheWVycywgcHNkLmNoaWxkcmVuKTtcblxuXHRcdGlmICghbGF5ZXJzLmxlbmd0aCkgbGF5ZXJzLnB1c2goe30pO1xuXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIGdsb2JhbEFscGhhID8gLWxheWVycy5sZW5ndGggOiBsYXllcnMubGVuZ3RoKTtcblxuXHRcdGNvbnN0IGxheWVyc0RhdGEgPSBsYXllcnMubWFwKChsLCBpKSA9PiBnZXRDaGFubmVscyh0ZW1wQnVmZmVyLCBsLCBpID09PSAwLCBvcHRpb25zKSk7XG5cblx0XHQvLyBsYXllciByZWNvcmRzXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xuXHRcdFx0Y29uc3QgeyBsYXllciwgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0LCBjaGFubmVscyB9ID0gbGF5ZXJEYXRhO1xuXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdG9wKTtcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCBsZWZ0KTtcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCBib3R0b20pO1xuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHJpZ2h0KTtcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbHMubGVuZ3RoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGNoYW5uZWxzKSB7XG5cdFx0XHRcdHdyaXRlSW50MTYod3JpdGVyLCBjLmNoYW5uZWxJZCk7XG5cdFx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCBjLmxlbmd0aCk7XG5cdFx0XHR9XG5cblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgZnJvbUJsZW5kTW9kZVtsYXllci5ibGVuZE1vZGUhXSB8fCAnbm9ybScpO1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQoY2xhbXAobGF5ZXIub3BhY2l0eSA/PyAxLCAwLCAxKSAqIDI1NSkpO1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGxheWVyLmNsaXBwaW5nID8gMSA6IDApO1xuXG5cdFx0XHRsZXQgZmxhZ3MgPSAweDA4OyAvLyAxIGZvciBQaG90b3Nob3AgNS4wIGFuZCBsYXRlciwgdGVsbHMgaWYgYml0IDQgaGFzIHVzZWZ1bCBpbmZvcm1hdGlvblxuXHRcdFx0aWYgKGxheWVyLnRyYW5zcGFyZW5jeVByb3RlY3RlZCkgZmxhZ3MgfD0gMHgwMTtcblx0XHRcdGlmIChsYXllci5oaWRkZW4pIGZsYWdzIHw9IDB4MDI7XG5cdFx0XHRpZiAobGF5ZXIudmVjdG9yTWFzaykgZmxhZ3MgfD0gMHgxMDsgLy8gcGl4ZWwgZGF0YSBpcnJlbGV2YW50IHRvIGFwcGVhcmFuY2Ugb2YgZG9jdW1lbnRcblxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzKTtcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTsgLy8gZmlsbGVyXG5cdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0XHRcdHdyaXRlTGF5ZXJNYXNrRGF0YSh3cml0ZXIsIGxheWVyLCBsYXllckRhdGEpO1xuXHRcdFx0XHR3cml0ZUxheWVyQmxlbmRpbmdSYW5nZXMod3JpdGVyLCBwc2QpO1xuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGxheWVyLm5hbWUgfHwgJycsIDQpO1xuXHRcdFx0XHR3cml0ZUFkZGl0aW9uYWxMYXllckluZm8od3JpdGVyLCBsYXllciwgcHNkLCBvcHRpb25zKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIGxheWVyIGNoYW5uZWwgaW1hZ2UgZGF0YVxuXHRcdGZvciAoY29uc3QgbGF5ZXJEYXRhIG9mIGxheWVyc0RhdGEpIHtcblx0XHRcdGZvciAoY29uc3QgY2hhbm5lbCBvZiBsYXllckRhdGEuY2hhbm5lbHMpIHtcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsLmNvbXByZXNzaW9uKTtcblxuXHRcdFx0XHRpZiAoY2hhbm5lbC5idWZmZXIpIHtcblx0XHRcdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgY2hhbm5lbC5idWZmZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gd3JpdGVVaW50MTYod3JpdGVyLCAwKTtcblx0fSwgdHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlTGF5ZXJNYXNrRGF0YSh3cml0ZXI6IFBzZFdyaXRlciwgeyBtYXNrLCB2ZWN0b3JNYXNrIH06IExheWVyLCBsYXllckRhdGE6IExheWVyQ2hhbm5lbERhdGEpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdGlmICghbWFzaykgcmV0dXJuO1xuXG5cdFx0Y29uc3QgbSA9IGxheWVyRGF0YS5tYXNrIHx8IHt9IGFzIFBhcnRpYWw8Qm91bmRzPjtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS50b3AhKTtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5sZWZ0ISk7XG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0uYm90dG9tISk7XG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0ucmlnaHQhKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbWFzay5kZWZhdWx0Q29sb3IhKTtcblxuXHRcdGxldCBwYXJhbXMgPSAwO1xuXHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5Vc2VyTWFza0RlbnNpdHk7XG5cdFx0aWYgKG1hc2sudXNlck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlVzZXJNYXNrRmVhdGhlcjtcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRGVuc2l0eTtcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRmVhdGhlcjtcblxuXHRcdGxldCBmbGFncyA9IDA7XG5cdFx0aWYgKG1hc2suZGlzYWJsZWQpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Rpc2FibGVkO1xuXHRcdGlmIChtYXNrLnBvc2l0aW9uUmVsYXRpdmVUb0xheWVyKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5Qb3NpdGlvblJlbGF0aXZlVG9MYXllcjtcblx0XHRpZiAodmVjdG9yTWFzaykgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRnJvbVJlbmRlcmluZ090aGVyRGF0YTtcblx0XHRpZiAocGFyYW1zKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5NYXNrSGFzUGFyYW1ldGVyc0FwcGxpZWRUb0l0O1xuXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzKTtcblxuXHRcdGlmIChwYXJhbXMpIHtcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBwYXJhbXMpO1xuXG5cdFx0XHRpZiAobWFzay51c2VyTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgd3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQobWFzay51c2VyTWFza0RlbnNpdHkgKiAweGZmKSk7XG5cdFx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay51c2VyTWFza0ZlYXRoZXIpO1xuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgd3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcblx0XHRcdGlmIChtYXNrLnZlY3Rvck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHdyaXRlRmxvYXQ2NCh3cml0ZXIsIG1hc2sudmVjdG9yTWFza0ZlYXRoZXIpO1xuXHRcdH1cblxuXHRcdC8vIFRPRE86IGhhbmRsZSByZXN0IG9mIHRoZSBmaWVsZHNcblxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlTGF5ZXJCbGVuZGluZ1Jhbmdlcyh3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xuXG5cdFx0Ly8gVE9ETzogdXNlIGFsd2F5cyA0IGluc3RlYWQgP1xuXHRcdGNvbnN0IGNoYW5uZWxzID0gcHNkLmNoYW5uZWxzIHx8IDA7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxzOyBpKyspIHtcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cdFx0fVxuXHR9KTtcbn1cblxuZnVuY3Rpb24gd3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlcjogUHNkV3JpdGVyKSB7XG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcblx0XHQvLyBUT0RPOiBpbXBsZW1lbnRcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvLCBwc2Q6IFBzZCwgb3B0aW9uczogV3JpdGVPcHRpb25zKSB7XG5cdGZvciAoY29uc3QgaGFuZGxlciBvZiBpbmZvSGFuZGxlcnMpIHtcblx0XHRpZiAoaGFuZGxlci5rZXkgPT09ICdUeHQyJyAmJiBvcHRpb25zLmludmFsaWRhdGVUZXh0TGF5ZXJzKSBjb250aW51ZTtcblxuXHRcdGlmIChoYW5kbGVyLmhhcyh0YXJnZXQpKSB7XG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGhhbmRsZXIua2V5KTtcblxuXHRcdFx0Y29uc3QgYWxpZ24gPSBoYW5kbGVyLmtleSA9PT0gJ1R4dDInID8gNCA6IDI7XG5cdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCBhbGlnbiwgKCkgPT4gaGFuZGxlci53cml0ZSh3cml0ZXIsIHRhcmdldCwgcHNkLCBvcHRpb25zKSwgaGFuZGxlci5rZXkgIT09ICdUeHQyJyk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGFkZENoaWxkcmVuKGxheWVyczogTGF5ZXJbXSwgY2hpbGRyZW46IExheWVyW10gfCB1bmRlZmluZWQpIHtcblx0aWYgKCFjaGlsZHJlbilcblx0XHRyZXR1cm47XG5cblx0Zm9yIChjb25zdCBjIG9mIGNoaWxkcmVuKSB7XG5cdFx0aWYgKGMuY2hpbGRyZW4gJiYgYy5jYW52YXMpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2NhbnZhcycgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xuXG5cdFx0aWYgKGMuY2hpbGRyZW4gJiYgYy5pbWFnZURhdGEpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2ltYWdlRGF0YScgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xuXG5cdFx0aWYgKGMuY2hpbGRyZW4pIHtcblx0XHRcdGNvbnN0IHNlY3Rpb25EaXZpZGVyID0ge1xuXHRcdFx0XHR0eXBlOiBjLm9wZW5lZCA9PT0gZmFsc2UgPyBTZWN0aW9uRGl2aWRlclR5cGUuQ2xvc2VkRm9sZGVyIDogU2VjdGlvbkRpdmlkZXJUeXBlLk9wZW5Gb2xkZXIsXG5cdFx0XHRcdGtleTogYy5ibGVuZE1vZGUgfHwgJ3Bhc3MnLFxuXHRcdFx0XHRzdWJ0eXBlOiAwLFxuXHRcdFx0fTtcblx0XHRcdGxheWVycy5wdXNoKHtcblx0XHRcdFx0bmFtZTogJzwvTGF5ZXIgZ3JvdXA+Jyxcblx0XHRcdFx0c2VjdGlvbkRpdmlkZXI6IHtcblx0XHRcdFx0XHR0eXBlOiBTZWN0aW9uRGl2aWRlclR5cGUuQm91bmRpbmdTZWN0aW9uRGl2aWRlcixcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0YWRkQ2hpbGRyZW4obGF5ZXJzLCBjLmNoaWxkcmVuKTtcblx0XHRcdGxheWVycy5wdXNoKHsgLi4uYywgc2VjdGlvbkRpdmlkZXIgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxheWVycy5wdXNoKHsgLi4uYyB9KTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVzaXplQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcblx0bGV0IG5ld0xlbmd0aCA9IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aDtcblxuXHRkbyB7XG5cdFx0bmV3TGVuZ3RoICo9IDI7XG5cdH0gd2hpbGUgKHNpemUgPiBuZXdMZW5ndGgpO1xuXG5cdGNvbnN0IG5ld0J1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihuZXdMZW5ndGgpO1xuXHRjb25zdCBuZXdCeXRlcyA9IG5ldyBVaW50OEFycmF5KG5ld0J1ZmZlcik7XG5cdGNvbnN0IG9sZEJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlcik7XG5cdG5ld0J5dGVzLnNldChvbGRCeXRlcyk7XG5cdHdyaXRlci5idWZmZXIgPSBuZXdCdWZmZXI7XG5cdHdyaXRlci52aWV3ID0gbmV3IERhdGFWaWV3KHdyaXRlci5idWZmZXIpO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcblx0aWYgKHNpemUgPiB3cml0ZXIuYnVmZmVyLmJ5dGVMZW5ndGgpIHtcblx0XHRyZXNpemVCdWZmZXIod3JpdGVyLCBzaXplKTtcblx0fVxufVxuXG5mdW5jdGlvbiBhZGRTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcblx0ZW5zdXJlU2l6ZSh3cml0ZXIsIHdyaXRlci5vZmZzZXQgKz0gc2l6ZSk7XG5cdHJldHVybiBvZmZzZXQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRodW1ibmFpbChwc2Q6IFBzZCkge1xuXHRjb25zdCBjYW52YXMgPSBjcmVhdGVDYW52YXMoMTAsIDEwKTtcblx0bGV0IHNjYWxlID0gMTtcblxuXHRpZiAocHNkLndpZHRoID4gcHNkLmhlaWdodCkge1xuXHRcdGNhbnZhcy53aWR0aCA9IDE2MDtcblx0XHRjYW52YXMuaGVpZ2h0ID0gTWF0aC5mbG9vcihwc2QuaGVpZ2h0ICogKGNhbnZhcy53aWR0aCAvIHBzZC53aWR0aCkpO1xuXHRcdHNjYWxlID0gY2FudmFzLndpZHRoIC8gcHNkLndpZHRoO1xuXHR9IGVsc2Uge1xuXHRcdGNhbnZhcy5oZWlnaHQgPSAxNjA7XG5cdFx0Y2FudmFzLndpZHRoID0gTWF0aC5mbG9vcihwc2Qud2lkdGggKiAoY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQpKTtcblx0XHRzY2FsZSA9IGNhbnZhcy5oZWlnaHQgLyBwc2QuaGVpZ2h0O1xuXHR9XG5cblx0Y29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpITtcblx0Y29udGV4dC5zY2FsZShzY2FsZSwgc2NhbGUpO1xuXG5cdGlmIChwc2QuaW1hZ2VEYXRhKSB7XG5cdFx0Y29uc3QgdGVtcCA9IGNyZWF0ZUNhbnZhcyhwc2QuaW1hZ2VEYXRhLndpZHRoLCBwc2QuaW1hZ2VEYXRhLmhlaWdodCk7XG5cdFx0dGVtcC5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEocHNkLmltYWdlRGF0YSwgMCwgMCk7XG5cdFx0Y29udGV4dC5kcmF3SW1hZ2UodGVtcCwgMCwgMCk7XG5cdH0gZWxzZSBpZiAocHNkLmNhbnZhcykge1xuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHBzZC5jYW52YXMsIDAsIDApO1xuXHR9XG5cblx0cmV0dXJuIGNhbnZhcztcbn1cblxuZnVuY3Rpb24gZ2V0Q2hhbm5lbHMoXG5cdHRlbXBCdWZmZXI6IFVpbnQ4QXJyYXksIGxheWVyOiBMYXllciwgYmFja2dyb3VuZDogYm9vbGVhbiwgb3B0aW9uczogV3JpdGVPcHRpb25zXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcblx0Y29uc3QgbGF5ZXJEYXRhID0gZ2V0TGF5ZXJDaGFubmVscyh0ZW1wQnVmZmVyLCBsYXllciwgYmFja2dyb3VuZCwgb3B0aW9ucyk7XG5cdGNvbnN0IG1hc2sgPSBsYXllci5tYXNrO1xuXG5cdGlmIChtYXNrKSB7XG5cdFx0bGV0IHsgdG9wID0gMCwgbGVmdCA9IDAsIHJpZ2h0ID0gMCwgYm90dG9tID0gMCB9ID0gbWFzaztcblx0XHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobWFzayk7XG5cdFx0bGV0IGltYWdlRGF0YSA9IG1hc2suaW1hZ2VEYXRhO1xuXG5cdFx0aWYgKCFpbWFnZURhdGEgJiYgbWFzay5jYW52YXMgJiYgd2lkdGggJiYgaGVpZ2h0KSB7XG5cdFx0XHRpbWFnZURhdGEgPSBtYXNrLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG5cdFx0fVxuXG5cdFx0aWYgKHdpZHRoICYmIGhlaWdodCAmJiBpbWFnZURhdGEpIHtcblx0XHRcdHJpZ2h0ID0gbGVmdCArIHdpZHRoO1xuXHRcdFx0Ym90dG9tID0gdG9wICsgaGVpZ2h0O1xuXG5cdFx0XHRjb25zdCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgaW1hZ2VEYXRhLCB3aWR0aCwgaGVpZ2h0LCBbMF0pITtcblx0XHRcdGxheWVyRGF0YS5tYXNrID0geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcblx0XHRcdGxheWVyRGF0YS5jaGFubmVscy5wdXNoKHtcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXG5cdFx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxuXHRcdFx0XHRidWZmZXI6IGJ1ZmZlcixcblx0XHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYXllckRhdGEubWFzayA9IHsgdG9wOiAwLCBsZWZ0OiAwLCByaWdodDogMCwgYm90dG9tOiAwIH07XG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XG5cdFx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlVzZXJNYXNrLFxuXHRcdFx0XHRjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSxcblx0XHRcdFx0YnVmZmVyOiBuZXcgVWludDhBcnJheSgwKSxcblx0XHRcdFx0bGVuZ3RoOiAwLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGxheWVyRGF0YTtcbn1cblxuZnVuY3Rpb24gZ2V0TGF5ZXJEaW1lbnRpb25zKHsgY2FudmFzLCBpbWFnZURhdGEgfTogTGF5ZXIpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyB9IHtcblx0cmV0dXJuIGltYWdlRGF0YSB8fCBjYW52YXMgfHwgeyB3aWR0aDogMCwgaGVpZ2h0OiAwIH07XG59XG5cbmZ1bmN0aW9uIGNyb3BJbWFnZURhdGEoZGF0YTogSW1hZ2VEYXRhLCBsZWZ0OiBudW1iZXIsIHRvcDogbnVtYmVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuXHRjb25zdCBjcm9wcGVkRGF0YSA9IGNyZWF0ZUltYWdlRGF0YSh3aWR0aCwgaGVpZ2h0KTtcblx0Y29uc3Qgc3JjRGF0YSA9IGRhdGEuZGF0YTtcblx0Y29uc3QgZHN0RGF0YSA9IGNyb3BwZWREYXRhLmRhdGE7XG5cblx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xuXHRcdGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7IHgrKykge1xuXHRcdFx0bGV0IHNyYyA9ICgoeCArIGxlZnQpICsgKHkgKyB0b3ApICogd2lkdGgpICogNDtcblx0XHRcdGxldCBkc3QgPSAoeCArIHkgKiB3aWR0aCkgKiA0O1xuXHRcdFx0ZHN0RGF0YVtkc3RdID0gc3JjRGF0YVtzcmNdO1xuXHRcdFx0ZHN0RGF0YVtkc3QgKyAxXSA9IHNyY0RhdGFbc3JjICsgMV07XG5cdFx0XHRkc3REYXRhW2RzdCArIDJdID0gc3JjRGF0YVtzcmMgKyAyXTtcblx0XHRcdGRzdERhdGFbZHN0ICsgM10gPSBzcmNEYXRhW3NyYyArIDNdO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBjcm9wcGVkRGF0YTtcbn1cblxuZnVuY3Rpb24gZ2V0TGF5ZXJDaGFubmVscyhcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcbik6IExheWVyQ2hhbm5lbERhdGEge1xuXHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBsYXllcjtcblx0bGV0IGNoYW5uZWxzOiBDaGFubmVsRGF0YVtdID0gW1xuXHRcdHtcblx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlRyYW5zcGFyZW5jeSxcblx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLFxuXHRcdFx0YnVmZmVyOiB1bmRlZmluZWQsXG5cdFx0XHRsZW5ndGg6IDIsXG5cdFx0fVxuXHRdO1xuXG5cdGxldCB7IHdpZHRoLCBoZWlnaHQgfSA9IGdldExheWVyRGltZW50aW9ucyhsYXllcik7XG5cblx0aWYgKCEobGF5ZXIuY2FudmFzIHx8IGxheWVyLmltYWdlRGF0YSkgfHwgIXdpZHRoIHx8ICFoZWlnaHQpIHtcblx0XHRyaWdodCA9IGxlZnQ7XG5cdFx0Ym90dG9tID0gdG9wO1xuXHRcdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XG5cdH1cblxuXHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcblx0Ym90dG9tID0gdG9wICsgaGVpZ2h0O1xuXG5cdGxldCBkYXRhID0gbGF5ZXIuaW1hZ2VEYXRhIHx8IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG5cdGlmIChvcHRpb25zLnRyaW1JbWFnZURhdGEpIHtcblx0XHRjb25zdCB0cmltbWVkID0gdHJpbURhdGEoZGF0YSk7XG5cblx0XHRpZiAodHJpbW1lZC5sZWZ0ICE9PSAwIHx8IHRyaW1tZWQudG9wICE9PSAwIHx8IHRyaW1tZWQucmlnaHQgIT09IGRhdGEud2lkdGggfHwgdHJpbW1lZC5ib3R0b20gIT09IGRhdGEuaGVpZ2h0KSB7XG5cdFx0XHRsZWZ0ICs9IHRyaW1tZWQubGVmdDtcblx0XHRcdHRvcCArPSB0cmltbWVkLnRvcDtcblx0XHRcdHJpZ2h0IC09IChkYXRhLndpZHRoIC0gdHJpbW1lZC5yaWdodCk7XG5cdFx0XHRib3R0b20gLT0gKGRhdGEuaGVpZ2h0IC0gdHJpbW1lZC5ib3R0b20pO1xuXHRcdFx0d2lkdGggPSByaWdodCAtIGxlZnQ7XG5cdFx0XHRoZWlnaHQgPSBib3R0b20gLSB0b3A7XG5cblx0XHRcdGlmICghd2lkdGggfHwgIWhlaWdodCkge1xuXHRcdFx0XHRyZXR1cm4geyBsYXllciwgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tLCBjaGFubmVscyB9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAobGF5ZXIuaW1hZ2VEYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSBjcm9wSW1hZ2VEYXRhKGRhdGEsIHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGF0YSA9IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGNoYW5uZWxJZHMgPSBbXG5cdFx0Q2hhbm5lbElELlJlZCxcblx0XHRDaGFubmVsSUQuR3JlZW4sXG5cdFx0Q2hhbm5lbElELkJsdWUsXG5cdF07XG5cblx0aWYgKCFiYWNrZ3JvdW5kIHx8IGhhc0FscGhhKGRhdGEpIHx8IGxheWVyLm1hc2spIHtcblx0XHRjaGFubmVsSWRzLnVuc2hpZnQoQ2hhbm5lbElELlRyYW5zcGFyZW5jeSk7XG5cdH1cblxuXHRjaGFubmVscyA9IGNoYW5uZWxJZHMubWFwKGNoYW5uZWwgPT4ge1xuXHRcdGNvbnN0IG9mZnNldCA9IG9mZnNldEZvckNoYW5uZWwoY2hhbm5lbCk7XG5cdFx0bGV0IGJ1ZmZlciA9IHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBbb2Zmc2V0XSkhO1xuXG5cdFx0aWYgKFJBV19JTUFHRV9EQVRBICYmIChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhdykge1xuXHRcdFx0Y29uc29sZS5sb2coJ3dyaXR0ZW4gcmF3IGxheWVyIGltYWdlIGRhdGEnKTtcblx0XHRcdGJ1ZmZlciA9IChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhd1tjaGFubmVsXTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Y2hhbm5lbElkOiBjaGFubmVsLFxuXHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQsXG5cdFx0XHRidWZmZXI6IGJ1ZmZlcixcblx0XHRcdGxlbmd0aDogMiArIGJ1ZmZlci5sZW5ndGgsXG5cdFx0fTtcblx0fSk7XG5cblx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcbn1cblxuZnVuY3Rpb24gaXNSb3dFbXB0eSh7IGRhdGEsIHdpZHRoIH06IFBpeGVsRGF0YSwgeTogbnVtYmVyLCBsZWZ0OiBudW1iZXIsIHJpZ2h0OiBudW1iZXIpIHtcblx0Y29uc3Qgc3RhcnQgPSAoKHkgKiB3aWR0aCArIGxlZnQpICogNCArIDMpIHwgMDtcblx0Y29uc3QgZW5kID0gKHN0YXJ0ICsgKHJpZ2h0IC0gbGVmdCkgKiA0KSB8IDA7XG5cblx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpID0gKGkgKyA0KSB8IDApIHtcblx0XHRpZiAoZGF0YVtpXSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBpc0NvbEVtcHR5KHsgZGF0YSwgd2lkdGggfTogUGl4ZWxEYXRhLCB4OiBudW1iZXIsIHRvcDogbnVtYmVyLCBib3R0b206IG51bWJlcikge1xuXHRjb25zdCBzdHJpZGUgPSAod2lkdGggKiA0KSB8IDA7XG5cdGNvbnN0IHN0YXJ0ID0gKHRvcCAqIHN0cmlkZSArIHggKiA0ICsgMykgfCAwO1xuXG5cdGZvciAobGV0IHkgPSB0b3AsIGkgPSBzdGFydDsgeSA8IGJvdHRvbTsgeSsrLCBpID0gKGkgKyBzdHJpZGUpIHwgMCkge1xuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHRyaW1EYXRhKGRhdGE6IFBpeGVsRGF0YSkge1xuXHRsZXQgdG9wID0gMDtcblx0bGV0IGxlZnQgPSAwO1xuXHRsZXQgcmlnaHQgPSBkYXRhLndpZHRoO1xuXHRsZXQgYm90dG9tID0gZGF0YS5oZWlnaHQ7XG5cblx0d2hpbGUgKHRvcCA8IGJvdHRvbSAmJiBpc1Jvd0VtcHR5KGRhdGEsIHRvcCwgbGVmdCwgcmlnaHQpKVxuXHRcdHRvcCsrO1xuXHR3aGlsZSAoYm90dG9tID4gdG9wICYmIGlzUm93RW1wdHkoZGF0YSwgYm90dG9tIC0gMSwgbGVmdCwgcmlnaHQpKVxuXHRcdGJvdHRvbS0tO1xuXHR3aGlsZSAobGVmdCA8IHJpZ2h0ICYmIGlzQ29sRW1wdHkoZGF0YSwgbGVmdCwgdG9wLCBib3R0b20pKVxuXHRcdGxlZnQrKztcblx0d2hpbGUgKHJpZ2h0ID4gbGVmdCAmJiBpc0NvbEVtcHR5KGRhdGEsIHJpZ2h0IC0gMSwgdG9wLCBib3R0b20pKVxuXHRcdHJpZ2h0LS07XG5cblx0cmV0dXJuIHsgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUNvbG9yKHdyaXRlcjogUHNkV3JpdGVyLCBjb2xvcjogQ29sb3IgfCB1bmRlZmluZWQpIHtcblx0aWYgKCFjb2xvcikge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA4KTtcblx0fSBlbHNlIGlmICgncicgaW4gY29sb3IpIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuUkdCKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuciAqIDI1NykpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5nICogMjU3KSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAyNTcpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHR9IGVsc2UgaWYgKCdsJyBpbiBjb2xvcikge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5MYWIpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5sICogMTAwKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmEgKiAxMDApKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiAqIDEwMCkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XG5cdH0gZWxzZSBpZiAoJ2gnIGluIGNvbG9yKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkhTQik7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmgpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IucykpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5iKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcblx0fSBlbHNlIGlmICgnYycgaW4gY29sb3IpIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuQ01ZSyk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmMpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubSkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci55KSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmspKTtcblx0fSBlbHNlIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuR3JheXNjYWxlKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuaykpO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA2KTtcblx0fVxufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
