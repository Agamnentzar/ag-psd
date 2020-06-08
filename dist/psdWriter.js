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
                key: 'pass',
                blendMode: c.blendMode,
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBZ0Q7QUFDaEQsbURBQW9EO0FBRXBELElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQztBQVE3QixTQUFnQixZQUFZLENBQUMsSUFBVztJQUFYLHFCQUFBLEVBQUEsV0FBVztJQUN2QyxJQUFNLE1BQU0sR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQyxJQUFNLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDakIsT0FBTyxFQUFFLE1BQU0sUUFBQSxFQUFFLElBQUksTUFBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUM7QUFDakMsQ0FBQztBQUxELG9DQUtDO0FBRUQsU0FBZ0IsZUFBZSxDQUFDLE1BQWlCO0lBQ2hELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM5QyxDQUFDO0FBRkQsMENBRUM7QUFFRCxTQUFnQixxQkFBcUIsQ0FBQyxNQUFpQjtJQUN0RCxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRkQsc0RBRUM7QUFFRCxTQUFnQixVQUFVLENBQUMsTUFBaUIsRUFBRSxLQUFhO0lBQzFELElBQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDM0QsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFIRCxnQ0FHQztBQUVELFNBQWdCLFdBQVcsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDM0QsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFIRCxrQ0FHQztBQUVELFNBQWdCLFlBQVksQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDNUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFIRCxvQ0FHQztBQUVELFNBQWdCLFlBQVksQ0FBQyxN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QUFDLENBQUMsQ0FBQztRQUN6QyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ3pDO1NBQU07UUFDTixXQUFXLENBQUMsTUFBTSxvQkFBdUIsQ0FBQztRQUMxQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN0QjtBQUNGLENBQUM7QUFqQ0QsZ0NBaUNDIiwiZmlsZSI6InBzZFdyaXRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBzZCwgTGF5ZXIsIExheWVyQWRkaXRpb25hbEluZm8sIENvbG9yTW9kZSwgU2VjdGlvbkRpdmlkZXJUeXBlLCBXcml0ZU9wdGlvbnMsIENvbG9yIH0gZnJvbSAnLi9wc2QnO1xuaW1wb3J0IHtcblx0aGFzQWxwaGEsIGNyZWF0ZUNhbnZhcywgd3JpdGVEYXRhUkxFLCBQaXhlbERhdGEsIExheWVyQ2hhbm5lbERhdGEsIENoYW5uZWxEYXRhLFxuXHRvZmZzZXRGb3JDaGFubmVsLCBjcmVhdGVJbWFnZURhdGEsIGZyb21CbGVuZE1vZGUsIENoYW5uZWxJRCwgQ29tcHJlc3Npb24sIGNsYW1wLFxuXHRMYXllck1hc2tGbGFncywgTWFza1BhcmFtcywgQ29sb3JTcGFjZSwgQm91bmRzXG59IGZyb20gJy4vaGVscGVycyc7XG5pbXBvcnQgeyBpbmZvSGFuZGxlcnMgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcbmltcG9ydCB7IHJlc291cmNlSGFuZGxlcnMgfSBmcm9tICcuL2ltYWdlUmVzb3VyY2VzJztcblxuY29uc3QgUkFXX0lNQUdFX0RBVEEgPSBmYWxzZTtcblxuZXhwb3J0IGludGVyZmFjZSBQc2RXcml0ZXIge1xuXHRvZmZzZXQ6IG51bWJlcjtcblx0YnVmZmVyOiBBcnJheUJ1ZmZlcjtcblx0dmlldzogRGF0YVZpZXc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXcml0ZXIoc2l6ZSA9IDQwOTYpOiBQc2RXcml0ZXIge1xuXHRjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoc2l6ZSk7XG5cdGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcblx0Y29uc3Qgb2Zmc2V0ID0gMDtcblx0cmV0dXJuIHsgYnVmZmVyLCB2aWV3LCBvZmZzZXQgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFdyaXRlckJ1ZmZlcih3cml0ZXI6IFBzZFdyaXRlcikge1xuXHRyZXR1cm4gd3JpdGVyLmJ1ZmZlci5zbGljZSgwLCB3cml0ZXIub2Zmc2V0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFdyaXRlckJ1ZmZlck5vQ29weSh3cml0ZXI6IFBzZFdyaXRlcikge1xuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlciwgMCwgd3JpdGVyLm9mZnNldCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQ4KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAxKTtcblx0d3JpdGVyLnZpZXcuc2V0VWludDgob2Zmc2V0LCB2YWx1ZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUludDE2KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcblx0d3JpdGVyLnZpZXcuc2V0SW50MTYob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50MTYod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDIpO1xuXHR3cml0ZXIudmlldy5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XG5cdHdyaXRlci52aWV3LnNldEludDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcblx0d3JpdGVyLnZpZXcuc2V0VWludDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRmxvYXQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XG5cdHdyaXRlci52aWV3LnNldEZsb2F0MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDY0KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA4KTtcblx0d3JpdGVyLnZpZXcuc2V0RmxvYXQ2NChvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XG59XG5cbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgMTYuMTZcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xuXHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUgKiAoMSA8PCAxNikpO1xufVxuXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDguMjRcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcblx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlICogKDEgPDwgMjQpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQnl0ZXMod3JpdGVyOiBQc2RXcml0ZXIsIGJ1ZmZlcjogVWludDhBcnJheSB8IHVuZGVmaW5lZCkge1xuXHRpZiAoYnVmZmVyKSB7XG5cdFx0ZW5zdXJlU2l6ZSh3cml0ZXIsIHdyaXRlci5vZmZzZXQgKyBidWZmZXIubGVuZ3RoKTtcblx0XHRjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xuXHRcdGJ5dGVzLnNldChidWZmZXIsIHdyaXRlci5vZmZzZXQpO1xuXHRcdHdyaXRlci5vZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVaZXJvcyh3cml0ZXI6IFBzZFdyaXRlciwgY291bnQ6IG51bWJlcikge1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlU2lnbmF0dXJlKHdyaXRlcjogUHNkV3JpdGVyLCBzaWduYXR1cmU6IHN0cmluZykge1xuXHRpZiAoc2lnbmF0dXJlLmxlbmd0aCAhPT0gNCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ25hdHVyZX0nYCk7XG5cdH1cblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBzaWduYXR1cmUuY2hhckNvZGVBdChpKSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcsIHBhZFRvID0gMikge1xuXHRsZXQgbGVuZ3RoID0gdGV4dC5sZW5ndGg7XG5cdHdyaXRlVWludDgod3JpdGVyLCBsZW5ndGgpO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBjb2RlID0gdGV4dC5jaGFyQ29kZUF0KGkpO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBjb2RlIDwgMTI4ID8gY29kZSA6ICc/Jy5jaGFyQ29kZUF0KDApKTtcblx0fVxuXG5cdHdoaWxlICgrK2xlbmd0aCAlIHBhZFRvKSB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZykge1xuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHRleHQubGVuZ3RoKTtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHRleHQuY2hhckNvZGVBdChpKSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcpIHtcblx0d3JpdGVVaW50MzIod3JpdGVyLCB0ZXh0Lmxlbmd0aCArIDEpO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcblx0fVxuXG5cdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XG59XG5cbmZ1bmN0aW9uIGdldExhcmdlc3RMYXllclNpemUobGF5ZXJzOiBMYXllcltdID0gW10pOiBudW1iZXIge1xuXHRsZXQgbWF4ID0gMDtcblxuXHRmb3IgKGNvbnN0IGxheWVyIG9mIGxheWVycykge1xuXHRcdGlmIChsYXllci5jYW52YXMgfHwgbGF5ZXIuaW1hZ2VEYXRhKSB7XG5cdFx0XHRjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IGdldExheWVyRGltZW50aW9ucyhsYXllcik7XG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIDIgKiBoZWlnaHQgKyAyICogd2lkdGggKiBoZWlnaHQpO1xuXHRcdH1cblxuXHRcdGlmIChsYXllci5jaGlsZHJlbikge1xuXHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCBnZXRMYXJnZXN0TGF5ZXJTaXplKGxheWVyLmNoaWxkcmVuKSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIG1heDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlU2VjdGlvbih3cml0ZXI6IFBzZFdyaXRlciwgcm91bmQ6IG51bWJlciwgZnVuYzogKCkgPT4gdm9pZCwgd3JpdGVUb3RhbExlbmd0aCA9IGZhbHNlKSB7XG5cdGNvbnN0IG9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XG5cdHdyaXRlSW50MzIod3JpdGVyLCAwKTtcblxuXHRmdW5jKCk7XG5cblx0bGV0IGxlbmd0aCA9IHdyaXRlci5vZmZzZXQgLSBvZmZzZXQgLSA0O1xuXHRsZXQgbGVuID0gbGVuZ3RoO1xuXG5cdHdoaWxlICgobGVuICUgcm91bmQpICE9PSAwKSB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xuXHRcdGxlbisrO1xuXHR9XG5cblx0aWYgKHdyaXRlVG90YWxMZW5ndGgpIHtcblx0XHRsZW5ndGggPSBsZW47XG5cdH1cblxuXHR3cml0ZXIudmlldy5zZXRJbnQzMihvZmZzZXQsIGxlbmd0aCwgZmFsc2UpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVQc2Qod3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMgPSB7fSkge1xuXHRpZiAoISgrcHNkLndpZHRoID4gMCAmJiArcHNkLmhlaWdodCA+IDApKVxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkb2N1bWVudCBzaXplJyk7XG5cblx0bGV0IGltYWdlUmVzb3VyY2VzID0gcHNkLmltYWdlUmVzb3VyY2VzIHx8IHt9O1xuXG5cdGlmIChvcHRpb25zLmdlbmVyYXRlVGh1bWJuYWlsKSB7XG5cdFx0aW1hZ2VSZXNvdXJjZXMgPSB7IC4uLmltYWdlUmVzb3VyY2VzLCB0aHVtYm5haWw6IGNyZWF0ZVRodW1ibmFpbChwc2QpIH07XG5cdH1cblxuXHRsZXQgaW1hZ2VEYXRhID0gcHNkLmltYWdlRGF0YTtcblxuXHRpZiAoIWltYWdlRGF0YSAmJiBwc2QuY2FudmFzKSB7XG5cdFx0aW1hZ2VEYXRhID0gcHNkLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgcHNkLmNhbnZhcy53aWR0aCwgcHNkLmNhbnZhcy5oZWlnaHQpO1xuXHR9XG5cblx0aWYgKGltYWdlRGF0YSAmJiAocHNkLndpZHRoICE9PSBpbWFnZURhdGEud2lkdGggfHwgcHNkLmhlaWdodCAhPT0gaW1hZ2VEYXRhLmhlaWdodCkpXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBjYW52YXMgbXVzdCBoYXZlIHRoZSBzYW1lIHNpemUgYXMgZG9jdW1lbnQnKTtcblxuXHRjb25zdCBnbG9iYWxBbHBoYSA9ICEhaW1hZ2VEYXRhICYmIGhhc0FscGhhKGltYWdlRGF0YSk7XG5cdGNvbnN0IG1heEJ1ZmZlclNpemUgPSBNYXRoLm1heChnZXRMYXJnZXN0TGF5ZXJTaXplKHBzZC5jaGlsZHJlbiksIDQgKiAyICogcHNkLndpZHRoICogcHNkLmhlaWdodCArIDIgKiBwc2QuaGVpZ2h0KTtcblx0Y29uc3QgdGVtcEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG1heEJ1ZmZlclNpemUpO1xuXG5cdC8vIGhlYWRlclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QlBTJyk7XG5cdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cblx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xuXHR3cml0ZVVpbnQxNih3cml0ZXIsIGdsb2JhbEFscGhhID8gNCA6IDMpOyAvLyBjaGFubmVsc1xuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHBzZC5oZWlnaHQpO1xuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHBzZC53aWR0aCk7XG5cdHdyaXRlVWludDE2KHdyaXRlciwgOCk7IC8vIGJpdHMgcGVyIGNoYW5uZWxcblx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvck1vZGUuUkdCKTtcblxuXHQvLyBjb2xvciBtb2RlIGRhdGFcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdC8vIFRPRE86IGltcGxlbWVudFxuXHR9KTtcblxuXHQvLyBpbWFnZSByZXNvdXJjZXNcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdGZvciAoY29uc3QgaGFuZGxlciBvZiByZXNvdXJjZUhhbmRsZXJzKSB7XG5cdFx0XHRpZiAoaGFuZGxlci5oYXMoaW1hZ2VSZXNvdXJjZXMpKSB7XG5cdFx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBoYW5kbGVyLmtleSk7XG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgJycpO1xuXHRcdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiBoYW5kbGVyLndyaXRlKHdyaXRlciwgaW1hZ2VSZXNvdXJjZXMpKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdC8vIGxheWVyIGFuZCBtYXNrIGluZm9cblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4ge1xuXHRcdHdyaXRlTGF5ZXJJbmZvKHRlbXBCdWZmZXIsIHdyaXRlciwgcHNkLCBnbG9iYWxBbHBoYSwgb3B0aW9ucyk7XG5cdFx0d3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlcik7XG5cdFx0d3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlciwgcHNkLCBwc2QsIG9wdGlvbnMpO1xuXHR9KTtcblxuXHQvLyBpbWFnZSBkYXRhXG5cdGNvbnN0IGNoYW5uZWxzID0gZ2xvYmFsQWxwaGEgPyBbMCwgMSwgMiwgM10gOiBbMCwgMSwgMl07XG5cdGNvbnN0IGRhdGE6IFBpeGVsRGF0YSA9IGltYWdlRGF0YSB8fCB7XG5cdFx0ZGF0YTogbmV3IFVpbnQ4QXJyYXkoNCAqIHBzZC53aWR0aCAqIHBzZC5oZWlnaHQpLFxuXHRcdHdpZHRoOiBwc2Qud2lkdGgsXG5cdFx0aGVpZ2h0OiBwc2QuaGVpZ2h0LFxuXHR9O1xuXG5cdHdyaXRlVWludDE2KHdyaXRlciwgQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCk7XG5cblx0aWYgKFJBV19JTUFHRV9EQVRBICYmIChwc2QgYXMgYW55KS5pbWFnZURhdGFSYXcpIHtcblx0XHRjb25zb2xlLmxvZygnd3JpdGluZyByYXcgaW1hZ2UgZGF0YScpO1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3KTtcblx0fSBlbHNlIHtcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgd3JpdGVEYXRhUkxFKHRlbXBCdWZmZXIsIGRhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgY2hhbm5lbHMpKTtcblx0fVxufVxuXG5mdW5jdGlvbiB3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCB3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgNCwgKCkgPT4ge1xuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xuXG5cdFx0YWRkQ2hpbGRyZW4obGF5ZXJzLCBwc2QuY2hpbGRyZW4pO1xuXG5cdFx0aWYgKCFsYXllcnMubGVuZ3RoKSBsYXllcnMucHVzaCh7fSk7XG5cblx0XHR3cml0ZUludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyAtbGF5ZXJzLmxlbmd0aCA6IGxheWVycy5sZW5ndGgpO1xuXG5cdFx0Y29uc3QgbGF5ZXJzRGF0YSA9IGxheWVycy5tYXAoKGwsIGkpID0+IGdldENoYW5uZWxzKHRlbXBCdWZmZXIsIGwsIGkgPT09IDAsIG9wdGlvbnMpKTtcblxuXHRcdC8vIGxheWVyIHJlY29yZHNcblx0XHRmb3IgKGNvbnN0IGxheWVyRGF0YSBvZiBsYXllcnNEYXRhKSB7XG5cdFx0XHRjb25zdCB7IGxheWVyLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIGNoYW5uZWxzIH0gPSBsYXllckRhdGE7XG5cblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB0b3ApO1xuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGxlZnQpO1xuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGJvdHRvbSk7XG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgcmlnaHQpO1xuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVscy5sZW5ndGgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgY2hhbm5lbHMpIHtcblx0XHRcdFx0d3JpdGVJbnQxNih3cml0ZXIsIGMuY2hhbm5lbElkKTtcblx0XHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGMubGVuZ3RoKTtcblx0XHRcdH1cblxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmcm9tQmxlbmRNb2RlW2xheWVyLmJsZW5kTW9kZSFdIHx8ICdub3JtJyk7XG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChjbGFtcChsYXllci5vcGFjaXR5ID8/IDEsIDAsIDEpICogMjU1KSk7XG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbGF5ZXIuY2xpcHBpbmcgPyAxIDogMCk7XG5cblx0XHRcdGxldCBmbGFncyA9IDB4MDg7IC8vIDEgZm9yIFBob3Rvc2hvcCA1LjAgYW5kIGxhdGVyLCB0ZWxscyBpZiBiaXQgNCBoYXMgdXNlZnVsIGluZm9ybWF0aW9uXG5cdFx0XHRpZiAobGF5ZXIudHJhbnNwYXJlbmN5UHJvdGVjdGVkKSBmbGFncyB8PSAweDAxO1xuXHRcdFx0aWYgKGxheWVyLmhpZGRlbikgZmxhZ3MgfD0gMHgwMjtcblx0XHRcdGlmIChsYXllci52ZWN0b3JNYXNrKSBmbGFncyB8PSAweDEwOyAvLyBwaXhlbCBkYXRhIGlycmVsZXZhbnQgdG8gYXBwZWFyYW5jZSBvZiBkb2N1bWVudFxuXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApOyAvLyBmaWxsZXJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcblx0XHRcdFx0d3JpdGVMYXllck1hc2tEYXRhKHdyaXRlciwgbGF5ZXIsIGxheWVyRGF0YSk7XG5cdFx0XHRcdHdyaXRlTGF5ZXJCbGVuZGluZ1Jhbmdlcyh3cml0ZXIsIHBzZCk7XG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgbGF5ZXIubmFtZSB8fCAnJywgNCk7XG5cdFx0XHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gbGF5ZXIgY2hhbm5lbCBpbWFnZSBkYXRhXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGxheWVyRGF0YS5jaGFubmVscykge1xuXHRcdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWwuY29tcHJlc3Npb24pO1xuXG5cdFx0XHRcdGlmIChjaGFubmVsLmJ1ZmZlcikge1xuXHRcdFx0XHRcdHdyaXRlQnl0ZXMod3JpdGVyLCBjaGFubmVsLmJ1ZmZlcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHR9LCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllck1hc2tEYXRhKHdyaXRlcjogUHNkV3JpdGVyLCB7IG1hc2ssIHZlY3Rvck1hc2sgfTogTGF5ZXIsIGxheWVyRGF0YTogTGF5ZXJDaGFubmVsRGF0YSkge1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0aWYgKCFtYXNrKSByZXR1cm47XG5cblx0XHRjb25zdCBtID0gbGF5ZXJEYXRhLm1hc2sgfHwge30gYXMgUGFydGlhbDxCb3VuZHM+O1xuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLnRvcCEpO1xuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmxlZnQhKTtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5ib3R0b20hKTtcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5yaWdodCEpO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBtYXNrLmRlZmF1bHRDb2xvciEpO1xuXG5cdFx0bGV0IHBhcmFtcyA9IDA7XG5cdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eTtcblx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyO1xuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tEZW5zaXR5O1xuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tGZWF0aGVyO1xuXG5cdFx0bGV0IGZsYWdzID0gMDtcblx0XHRpZiAobWFzay5kaXNhYmxlZCkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQ7XG5cdFx0aWYgKG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyO1xuXHRcdGlmICh2ZWN0b3JNYXNrKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5MYXllck1hc2tGcm9tUmVuZGVyaW5nT3RoZXJEYXRhO1xuXHRcdGlmIChwYXJhbXMpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQ7XG5cblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xuXG5cdFx0aWYgKHBhcmFtcykge1xuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIHBhcmFtcyk7XG5cblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnVzZXJNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSB3cml0ZUZsb2F0NjQod3JpdGVyLCBtYXNrLnVzZXJNYXNrRmVhdGhlcik7XG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICogMHhmZikpO1xuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay52ZWN0b3JNYXNrRmVhdGhlcik7XG5cdFx0fVxuXG5cdFx0Ly8gVE9ETzogaGFuZGxlIHJlc3Qgb2YgdGhlIGZpZWxkc1xuXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gd3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCkge1xuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cblx0XHQvLyBUT0RPOiB1c2UgYWx3YXlzIDQgaW5zdGVhZCA/XG5cdFx0Y29uc3QgY2hhbm5lbHMgPSBwc2QuY2hhbm5lbHMgfHwgMDtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHM7IGkrKykge1xuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB3cml0ZUdsb2JhbExheWVyTWFza0luZm8od3JpdGVyOiBQc2RXcml0ZXIpIHtcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xuXHRcdC8vIFRPRE86IGltcGxlbWVudFxuXHR9KTtcbn1cblxuZnVuY3Rpb24gd3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMpIHtcblx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIGluZm9IYW5kbGVycykge1xuXHRcdGlmIChoYW5kbGVyLmtleSA9PT0gJ1R4dDInICYmIG9wdGlvbnMuaW52YWxpZGF0ZVRleHRMYXllcnMpIGNvbnRpbnVlO1xuXG5cdFx0aWYgKGhhbmRsZXIuaGFzKHRhcmdldCkpIHtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgaGFuZGxlci5rZXkpO1xuXG5cdFx0XHRjb25zdCBhbGlnbiA9IGhhbmRsZXIua2V5ID09PSAnVHh0MicgPyA0IDogMjtcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIGFsaWduLCAoKSA9PiBoYW5kbGVyLndyaXRlKHdyaXRlciwgdGFyZ2V0LCBwc2QsIG9wdGlvbnMpLCBoYW5kbGVyLmtleSAhPT0gJ1R4dDInKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gYWRkQ2hpbGRyZW4obGF5ZXJzOiBMYXllcltdLCBjaGlsZHJlbjogTGF5ZXJbXSB8IHVuZGVmaW5lZCkge1xuXHRpZiAoIWNoaWxkcmVuKVxuXHRcdHJldHVybjtcblxuXHRmb3IgKGNvbnN0IGMgb2YgY2hpbGRyZW4pIHtcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmNhbnZhcylcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnY2FudmFzJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XG5cblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmltYWdlRGF0YSlcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnaW1hZ2VEYXRhJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XG5cblx0XHRpZiAoYy5jaGlsZHJlbikge1xuXHRcdFx0Y29uc3Qgc2VjdGlvbkRpdmlkZXIgPSB7XG5cdFx0XHRcdHR5cGU6IGMub3BlbmVkID09PSBmYWxzZSA/IFNlY3Rpb25EaXZpZGVyVHlwZS5DbG9zZWRGb2xkZXIgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcixcblx0XHRcdFx0a2V5OiAncGFzcycsXG4gICAgICAgICAgICAgICAgYmxlbmRNb2RlOiBjLmJsZW5kTW9kZSxcblx0XHRcdFx0c3VidHlwZTogMCxcblx0XHRcdH07XG5cdFx0XHRsYXllcnMucHVzaCh7XG5cdFx0XHRcdG5hbWU6ICc8L0xheWVyIGdyb3VwPicsXG5cdFx0XHRcdHNlY3Rpb25EaXZpZGVyOiB7XG5cdFx0XHRcdFx0dHlwZTogU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGFkZENoaWxkcmVuKGxheWVycywgYy5jaGlsZHJlbik7XG5cdFx0XHRsYXllcnMucHVzaCh7IC4uLmMsIHNlY3Rpb25EaXZpZGVyIH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYXllcnMucHVzaCh7IC4uLmMgfSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHJlc2l6ZUJ1ZmZlcih3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XG5cdGxldCBuZXdMZW5ndGggPSB3cml0ZXIuYnVmZmVyLmJ5dGVMZW5ndGg7XG5cblx0ZG8ge1xuXHRcdG5ld0xlbmd0aCAqPSAyO1xuXHR9IHdoaWxlIChzaXplID4gbmV3TGVuZ3RoKTtcblxuXHRjb25zdCBuZXdCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIobmV3TGVuZ3RoKTtcblx0Y29uc3QgbmV3Qnl0ZXMgPSBuZXcgVWludDhBcnJheShuZXdCdWZmZXIpO1xuXHRjb25zdCBvbGRCeXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xuXHRuZXdCeXRlcy5zZXQob2xkQnl0ZXMpO1xuXHR3cml0ZXIuYnVmZmVyID0gbmV3QnVmZmVyO1xuXHR3cml0ZXIudmlldyA9IG5ldyBEYXRhVmlldyh3cml0ZXIuYnVmZmVyKTtcbn1cblxuZnVuY3Rpb24gZW5zdXJlU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XG5cdGlmIChzaXplID4gd3JpdGVyLmJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG5cdFx0cmVzaXplQnVmZmVyKHdyaXRlciwgc2l6ZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gYWRkU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XG5cdGNvbnN0IG9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XG5cdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICs9IHNpemUpO1xuXHRyZXR1cm4gb2Zmc2V0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVUaHVtYm5haWwocHNkOiBQc2QpIHtcblx0Y29uc3QgY2FudmFzID0gY3JlYXRlQ2FudmFzKDEwLCAxMCk7XG5cdGxldCBzY2FsZSA9IDE7XG5cblx0aWYgKHBzZC53aWR0aCA+IHBzZC5oZWlnaHQpIHtcblx0XHRjYW52YXMud2lkdGggPSAxNjA7XG5cdFx0Y2FudmFzLmhlaWdodCA9IE1hdGguZmxvb3IocHNkLmhlaWdodCAqIChjYW52YXMud2lkdGggLyBwc2Qud2lkdGgpKTtcblx0XHRzY2FsZSA9IGNhbnZhcy53aWR0aCAvIHBzZC53aWR0aDtcblx0fSBlbHNlIHtcblx0XHRjYW52YXMuaGVpZ2h0ID0gMTYwO1xuXHRcdGNhbnZhcy53aWR0aCA9IE1hdGguZmxvb3IocHNkLndpZHRoICogKGNhbnZhcy5oZWlnaHQgLyBwc2QuaGVpZ2h0KSk7XG5cdFx0c2NhbGUgPSBjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodDtcblx0fVxuXG5cdGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSE7XG5cdGNvbnRleHQuc2NhbGUoc2NhbGUsIHNjYWxlKTtcblxuXHRpZiAocHNkLmltYWdlRGF0YSkge1xuXHRcdGNvbnN0IHRlbXAgPSBjcmVhdGVDYW52YXMocHNkLmltYWdlRGF0YS53aWR0aCwgcHNkLmltYWdlRGF0YS5oZWlnaHQpO1xuXHRcdHRlbXAuZ2V0Q29udGV4dCgnMmQnKSEucHV0SW1hZ2VEYXRhKHBzZC5pbWFnZURhdGEsIDAsIDApO1xuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHRlbXAsIDAsIDApO1xuXHR9IGVsc2UgaWYgKHBzZC5jYW52YXMpIHtcblx0XHRjb250ZXh0LmRyYXdJbWFnZShwc2QuY2FudmFzLCAwLCAwKTtcblx0fVxuXG5cdHJldHVybiBjYW52YXM7XG59XG5cbmZ1bmN0aW9uIGdldENoYW5uZWxzKFxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xuKTogTGF5ZXJDaGFubmVsRGF0YSB7XG5cdGNvbnN0IGxheWVyRGF0YSA9IGdldExheWVyQ2hhbm5lbHModGVtcEJ1ZmZlciwgbGF5ZXIsIGJhY2tncm91bmQsIG9wdGlvbnMpO1xuXHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcblxuXHRpZiAobWFzaykge1xuXHRcdGxldCB7IHRvcCA9IDAsIGxlZnQgPSAwLCByaWdodCA9IDAsIGJvdHRvbSA9IDAgfSA9IG1hc2s7XG5cdFx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKG1hc2spO1xuXHRcdGxldCBpbWFnZURhdGEgPSBtYXNrLmltYWdlRGF0YTtcblxuXHRcdGlmICghaW1hZ2VEYXRhICYmIG1hc2suY2FudmFzICYmIHdpZHRoICYmIGhlaWdodCkge1xuXHRcdFx0aW1hZ2VEYXRhID0gbWFzay5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXHRcdH1cblxuXHRcdGlmICh3aWR0aCAmJiBoZWlnaHQgJiYgaW1hZ2VEYXRhKSB7XG5cdFx0XHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcblx0XHRcdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcblxuXHRcdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVEYXRhUkxFKHRlbXBCdWZmZXIsIGltYWdlRGF0YSwgd2lkdGgsIGhlaWdodCwgWzBdKSE7XG5cdFx0XHRsYXllckRhdGEubWFzayA9IHsgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tIH07XG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XG5cdFx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlVzZXJNYXNrLFxuXHRcdFx0XHRjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCxcblx0XHRcdFx0YnVmZmVyOiBidWZmZXIsXG5cdFx0XHRcdGxlbmd0aDogMiArIGJ1ZmZlci5sZW5ndGgsXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGF5ZXJEYXRhLm1hc2sgPSB7IHRvcDogMCwgbGVmdDogMCwgcmlnaHQ6IDAsIGJvdHRvbTogMCB9O1xuXHRcdFx0bGF5ZXJEYXRhLmNoYW5uZWxzLnB1c2goe1xuXHRcdFx0XHRjaGFubmVsSWQ6IENoYW5uZWxJRC5Vc2VyTWFzayxcblx0XHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsXG5cdFx0XHRcdGJ1ZmZlcjogbmV3IFVpbnQ4QXJyYXkoMCksXG5cdFx0XHRcdGxlbmd0aDogMCxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBsYXllckRhdGE7XG59XG5cbmZ1bmN0aW9uIGdldExheWVyRGltZW50aW9ucyh7IGNhbnZhcywgaW1hZ2VEYXRhIH06IExheWVyKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlcjsgfSB7XG5cdHJldHVybiBpbWFnZURhdGEgfHwgY2FudmFzIHx8IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xufVxuXG5mdW5jdGlvbiBjcm9wSW1hZ2VEYXRhKGRhdGE6IEltYWdlRGF0YSwgbGVmdDogbnVtYmVyLCB0b3A6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0Y29uc3QgY3JvcHBlZERhdGEgPSBjcmVhdGVJbWFnZURhdGEod2lkdGgsIGhlaWdodCk7XG5cdGNvbnN0IHNyY0RhdGEgPSBkYXRhLmRhdGE7XG5cdGNvbnN0IGRzdERhdGEgPSBjcm9wcGVkRGF0YS5kYXRhO1xuXG5cdGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyspIHtcblx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcblx0XHRcdGxldCBzcmMgPSAoKHggKyBsZWZ0KSArICh5ICsgdG9wKSAqIHdpZHRoKSAqIDQ7XG5cdFx0XHRsZXQgZHN0ID0gKHggKyB5ICogd2lkdGgpICogNDtcblx0XHRcdGRzdERhdGFbZHN0XSA9IHNyY0RhdGFbc3JjXTtcblx0XHRcdGRzdERhdGFbZHN0ICsgMV0gPSBzcmNEYXRhW3NyYyArIDFdO1xuXHRcdFx0ZHN0RGF0YVtkc3QgKyAyXSA9IHNyY0RhdGFbc3JjICsgMl07XG5cdFx0XHRkc3REYXRhW2RzdCArIDNdID0gc3JjRGF0YVtzcmMgKyAzXTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gY3JvcHBlZERhdGE7XG59XG5cbmZ1bmN0aW9uIGdldExheWVyQ2hhbm5lbHMoXG5cdHRlbXBCdWZmZXI6IFVpbnQ4QXJyYXksIGxheWVyOiBMYXllciwgYmFja2dyb3VuZDogYm9vbGVhbiwgb3B0aW9uczogV3JpdGVPcHRpb25zXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcblx0bGV0IHsgdG9wID0gMCwgbGVmdCA9IDAsIHJpZ2h0ID0gMCwgYm90dG9tID0gMCB9ID0gbGF5ZXI7XG5cdGxldCBjaGFubmVsczogQ2hhbm5lbERhdGFbXSA9IFtcblx0XHR7XG5cdFx0XHRjaGFubmVsSWQ6IENoYW5uZWxJRC5UcmFuc3BhcmVuY3ksXG5cdFx0XHRjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSxcblx0XHRcdGJ1ZmZlcjogdW5kZWZpbmVkLFxuXHRcdFx0bGVuZ3RoOiAyLFxuXHRcdH1cblx0XTtcblxuXHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xuXG5cdGlmICghKGxheWVyLmNhbnZhcyB8fCBsYXllci5pbWFnZURhdGEpIHx8ICF3aWR0aCB8fCAhaGVpZ2h0KSB7XG5cdFx0cmlnaHQgPSBsZWZ0O1xuXHRcdGJvdHRvbSA9IHRvcDtcblx0XHRyZXR1cm4geyBsYXllciwgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tLCBjaGFubmVscyB9O1xuXHR9XG5cblx0cmlnaHQgPSBsZWZ0ICsgd2lkdGg7XG5cdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcblxuXHRsZXQgZGF0YSA9IGxheWVyLmltYWdlRGF0YSB8fCBsYXllci5jYW52YXMhLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuXHRpZiAob3B0aW9ucy50cmltSW1hZ2VEYXRhKSB7XG5cdFx0Y29uc3QgdHJpbW1lZCA9IHRyaW1EYXRhKGRhdGEpO1xuXG5cdFx0aWYgKHRyaW1tZWQubGVmdCAhPT0gMCB8fCB0cmltbWVkLnRvcCAhPT0gMCB8fCB0cmltbWVkLnJpZ2h0ICE9PSBkYXRhLndpZHRoIHx8IHRyaW1tZWQuYm90dG9tICE9PSBkYXRhLmhlaWdodCkge1xuXHRcdFx0bGVmdCArPSB0cmltbWVkLmxlZnQ7XG5cdFx0XHR0b3AgKz0gdHJpbW1lZC50b3A7XG5cdFx0XHRyaWdodCAtPSAoZGF0YS53aWR0aCAtIHRyaW1tZWQucmlnaHQpO1xuXHRcdFx0Ym90dG9tIC09IChkYXRhLmhlaWdodCAtIHRyaW1tZWQuYm90dG9tKTtcblx0XHRcdHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xuXHRcdFx0aGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xuXG5cdFx0XHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpIHtcblx0XHRcdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGxheWVyLmltYWdlRGF0YSkge1xuXHRcdFx0XHRkYXRhID0gY3JvcEltYWdlRGF0YShkYXRhLCB0cmltbWVkLmxlZnQsIHRyaW1tZWQudG9wLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRhdGEgPSBsYXllci5jYW52YXMhLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSh0cmltbWVkLmxlZnQsIHRyaW1tZWQudG9wLCB3aWR0aCwgaGVpZ2h0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRjb25zdCBjaGFubmVsSWRzID0gW1xuXHRcdENoYW5uZWxJRC5SZWQsXG5cdFx0Q2hhbm5lbElELkdyZWVuLFxuXHRcdENoYW5uZWxJRC5CbHVlLFxuXHRdO1xuXG5cdGlmICghYmFja2dyb3VuZCB8fCBoYXNBbHBoYShkYXRhKSB8fCBsYXllci5tYXNrKSB7XG5cdFx0Y2hhbm5lbElkcy51bnNoaWZ0KENoYW5uZWxJRC5UcmFuc3BhcmVuY3kpO1xuXHR9XG5cblx0Y2hhbm5lbHMgPSBjaGFubmVsSWRzLm1hcChjaGFubmVsID0+IHtcblx0XHRjb25zdCBvZmZzZXQgPSBvZmZzZXRGb3JDaGFubmVsKGNoYW5uZWwpO1xuXHRcdGxldCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgZGF0YSwgd2lkdGgsIGhlaWdodCwgW29mZnNldF0pITtcblxuXHRcdGlmIChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXcpIHtcblx0XHRcdGNvbnNvbGUubG9nKCd3cml0dGVuIHJhdyBsYXllciBpbWFnZSBkYXRhJyk7XG5cdFx0XHRidWZmZXIgPSAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXdbY2hhbm5lbF07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNoYW5uZWxJZDogY2hhbm5lbCxcblx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxuXHRcdFx0YnVmZmVyOiBidWZmZXIsXG5cdFx0XHRsZW5ndGg6IDIgKyBidWZmZXIubGVuZ3RoLFxuXHRcdH07XG5cdH0pO1xuXG5cdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XG59XG5cbmZ1bmN0aW9uIGlzUm93RW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHk6IG51bWJlciwgbGVmdDogbnVtYmVyLCByaWdodDogbnVtYmVyKSB7XG5cdGNvbnN0IHN0YXJ0ID0gKCh5ICogd2lkdGggKyBsZWZ0KSAqIDQgKyAzKSB8IDA7XG5cdGNvbnN0IGVuZCA9IChzdGFydCArIChyaWdodCAtIGxlZnQpICogNCkgfCAwO1xuXG5cdGZvciAobGV0IGkgPSBzdGFydDsgaSA8IGVuZDsgaSA9IChpICsgNCkgfCAwKSB7XG5cdFx0aWYgKGRhdGFbaV0gIT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gaXNDb2xFbXB0eSh7IGRhdGEsIHdpZHRoIH06IFBpeGVsRGF0YSwgeDogbnVtYmVyLCB0b3A6IG51bWJlciwgYm90dG9tOiBudW1iZXIpIHtcblx0Y29uc3Qgc3RyaWRlID0gKHdpZHRoICogNCkgfCAwO1xuXHRjb25zdCBzdGFydCA9ICh0b3AgKiBzdHJpZGUgKyB4ICogNCArIDMpIHwgMDtcblxuXHRmb3IgKGxldCB5ID0gdG9wLCBpID0gc3RhcnQ7IHkgPCBib3R0b207IHkrKywgaSA9IChpICsgc3RyaWRlKSB8IDApIHtcblx0XHRpZiAoZGF0YVtpXSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB0cmltRGF0YShkYXRhOiBQaXhlbERhdGEpIHtcblx0bGV0IHRvcCA9IDA7XG5cdGxldCBsZWZ0ID0gMDtcblx0bGV0IHJpZ2h0ID0gZGF0YS53aWR0aDtcblx0bGV0IGJvdHRvbSA9IGRhdGEuaGVpZ2h0O1xuXG5cdHdoaWxlICh0b3AgPCBib3R0b20gJiYgaXNSb3dFbXB0eShkYXRhLCB0b3AsIGxlZnQsIHJpZ2h0KSlcblx0XHR0b3ArKztcblx0d2hpbGUgKGJvdHRvbSA+IHRvcCAmJiBpc1Jvd0VtcHR5KGRhdGEsIGJvdHRvbSAtIDEsIGxlZnQsIHJpZ2h0KSlcblx0XHRib3R0b20tLTtcblx0d2hpbGUgKGxlZnQgPCByaWdodCAmJiBpc0NvbEVtcHR5KGRhdGEsIGxlZnQsIHRvcCwgYm90dG9tKSlcblx0XHRsZWZ0Kys7XG5cdHdoaWxlIChyaWdodCA+IGxlZnQgJiYgaXNDb2xFbXB0eShkYXRhLCByaWdodCAtIDEsIHRvcCwgYm90dG9tKSlcblx0XHRyaWdodC0tO1xuXG5cdHJldHVybiB7IHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVDb2xvcih3cml0ZXI6IFBzZFdyaXRlciwgY29sb3I6IENvbG9yIHwgdW5kZWZpbmVkKSB7XG5cdGlmICghY29sb3IpIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuUkdCKTtcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgOCk7XG5cdH0gZWxzZSBpZiAoJ3InIGluIGNvbG9yKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLlJHQik7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnIgKiAyNTcpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuZyAqIDI1NykpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5iICogMjU3KSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcblx0fSBlbHNlIGlmICgnbCcgaW4gY29sb3IpIHtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuTGFiKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubCAqIDEwMCkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5hICogMTAwKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAxMDApKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHR9IGVsc2UgaWYgKCdoJyBpbiBjb2xvcikge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5IU0IpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5oKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnMpKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYikpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XG5cdH0gZWxzZSBpZiAoJ2MnIGluIGNvbG9yKSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkNNWUspO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5jKSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLm0pKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IueSkpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rKSk7XG5cdH0gZWxzZSB7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkdyYXlzY2FsZSk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmspKTtcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgNik7XG5cdH1cbn1cbiJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2pvZXJhaWkvZGV2L2FnLXBzZC9zcmMifQ==
