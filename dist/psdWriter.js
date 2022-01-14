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
    if (signature.length !== 4)
        throw new Error("Invalid signature: '" + signature + "'");
    for (var i = 0; i < 4; i++) {
        writeUint8(writer, signature.charCodeAt(i));
    }
}
exports.writeSignature = writeSignature;
function writePascalString(writer, text, padTo) {
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
function writeSection(writer, round, func, writeTotalLength, large) {
    if (writeTotalLength === void 0) { writeTotalLength = false; }
    if (large === void 0) { large = false; }
    if (large)
        writeUint32(writer, 0);
    var offset = writer.offset;
    writeUint32(writer, 0);
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
    writer.view.setUint32(offset, length, false);
}
exports.writeSection = writeSection;
function writePsd(writer, psd, options) {
    if (options === void 0) { options = {}; }
    if (!(+psd.width > 0 && +psd.height > 0))
        throw new Error('Invalid document size');
    if ((psd.width > 30000 || psd.height > 30000) && !options.psb)
        throw new Error('Document size is too large (max is 30000x30000, use PSB format instead)');
    var imageResources = psd.imageResources || {};
    var opt = __assign(__assign({}, options), { layerIds: [] });
    if (opt.generateThumbnail) {
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
    writeUint16(writer, options.psb ? 2 : 1); // version
    writeZeros(writer, 6);
    writeUint16(writer, globalAlpha ? 4 : 3); // channels
    writeUint32(writer, psd.height);
    writeUint32(writer, psd.width);
    writeUint16(writer, 8); // bits per channel
    writeUint16(writer, 3 /* RGB */); // we only support saving RGB right now
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
                writePascalString(writer, '', 2);
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
        writeLayerInfo(tempBuffer, writer, psd, globalAlpha, opt);
        writeGlobalLayerMaskInfo(writer, psd.globalLayerMaskInfo);
        writeAdditionalLayerInfo(writer, psd, psd, opt);
    }, undefined, !!opt.psb);
    // image data
    var channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
    var data = imageData || {
        data: new Uint8Array(4 * psd.width * psd.height),
        width: psd.width,
        height: psd.height,
    };
    writeUint16(writer, 1 /* RleCompressed */);
    if (helpers_1.RAW_IMAGE_DATA && psd.imageDataRaw) {
        console.log('writing raw image data');
        writeBytes(writer, psd.imageDataRaw);
    }
    else {
        writeBytes(writer, helpers_1.writeDataRLE(tempBuffer, data, psd.width, psd.height, channels, !!options.psb));
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
            for (var _e = 0, channels_1 = channels; _e < channels_1.length; _e++) {
                var c = channels_1[_e];
                writeInt16(writer, c.channelId);
                if (options.psb)
                    writeUint32(writer, 0);
                writeUint32(writer, c.length);
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
            if (layer.vectorMask || (layer.sectionDivider && layer.sectionDivider.type !== 0 /* Other */)) {
                flags |= 0x10; // pixel data irrelevant to appearance of document
            }
            if (layer.effects && additionalInfo_1.hasMultiEffects(layer.effects)) {
                flags |= 0x20; // just guessing this one, might be completely incorrect
            }
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
    }, true, options.psb);
}
function writeLayerMaskData(writer, _a, layerData) {
    var mask = _a.mask;
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
        if (mask.fromVectorData)
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
        var channels = psd.channels || 0; // TODO: use always 4 instead ?
        // channels = 4; // TESTING
        for (var i = 0; i < channels; i++) {
            writeUint32(writer, 65535);
            writeUint32(writer, 65535);
        }
    });
}
function writeGlobalLayerMaskInfo(writer, info) {
    writeSection(writer, 1, function () {
        if (info) {
            writeUint16(writer, info.overlayColorSpace);
            writeUint16(writer, info.colorSpace1);
            writeUint16(writer, info.colorSpace2);
            writeUint16(writer, info.colorSpace3);
            writeUint16(writer, info.colorSpace4);
            writeUint16(writer, info.opacity * 0xff);
            writeUint8(writer, info.kind);
            writeZeros(writer, 3);
        }
    });
}
function writeAdditionalLayerInfo(writer, target, psd, options) {
    var _loop_3 = function (handler) {
        var key = handler.key;
        if (key === 'Txt2' && options.invalidateTextLayers)
            return "continue";
        if (key === 'vmsk' && options.psb)
            key = 'vsms';
        if (handler.has(target)) {
            var large = options.psb && helpers_1.largeAdditionalInfoKeys.indexOf(key) !== -1;
            writeSignature(writer, large ? '8B64' : '8BIM');
            writeSignature(writer, key);
            var fourBytes = key === 'Txt2' || key === 'luni' || key === 'vmsk' || key === 'artb' || key === 'artd' ||
                key === 'vogk' || key === 'SoLd' || key === 'lnk2' || key === 'vscg' || key === 'vsms' || key === 'GdFl' ||
                key === 'lmfx' || key === 'lrFX' || key === 'cinf' || key === 'PlLd' || key === 'Anno';
            writeSection(writer, fourBytes ? 4 : 2, function () {
                handler.write(writer, target, psd, options);
            }, key !== 'Txt2' && key !== 'cinf' && key !== 'extn', large);
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
            layers.push({
                name: '</Layer group>',
                sectionDivider: {
                    type: 3 /* BoundingSectionDivider */,
                },
                // TESTING
                // nameSource: 'lset',
                // id: [4, 0, 0, 8, 11, 0, 0, 0, 0, 14][layers.length] || 0,
                // layerColor: 'none',
                // timestamp: [1611346817.349021, 0, 0, 1611346817.349175, 1611346817.3491833, 0, 0, 0, 0, 1611346817.349832][layers.length] || 0,
                // protected: {},
                // referencePoint: { x: 0, y: 0 },
            });
            addChildren(layers, c.children);
            layers.push(__assign({ sectionDivider: {
                    type: c.opened === false ? 2 /* ClosedFolder */ : 1 /* OpenFolder */,
                    key: helpers_1.fromBlendMode[c.blendMode] || 'pass',
                    subType: 0,
                } }, c));
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
            var buffer = helpers_1.writeDataRLE(tempBuffer, imageData, width, height, [0], !!options.psb);
            if (helpers_1.RAW_IMAGE_DATA && layer.maskDataRaw) {
                // console.log('written raw layer image data');
                buffer = layer.maskDataRaw;
            }
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
    var _a;
    var _b = layer.top, top = _b === void 0 ? 0 : _b, _c = layer.left, left = _c === void 0 ? 0 : _c, _d = layer.right, right = _d === void 0 ? 0 : _d, _e = layer.bottom, bottom = _e === void 0 ? 0 : _e;
    var channels = [
        { channelId: -1 /* Transparency */, compression: 0 /* RawData */, buffer: undefined, length: 2 },
        { channelId: 0 /* Color0 */, compression: 0 /* RawData */, buffer: undefined, length: 2 },
        { channelId: 1 /* Color1 */, compression: 0 /* RawData */, buffer: undefined, length: 2 },
        { channelId: 2 /* Color2 */, compression: 0 /* RawData */, buffer: undefined, length: 2 },
    ];
    var _f = getLayerDimentions(layer), width = _f.width, height = _f.height;
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
        0 /* Color0 */,
        1 /* Color1 */,
        2 /* Color2 */,
    ];
    if (!background || options.noBackground || layer.mask || helpers_1.hasAlpha(data) || (helpers_1.RAW_IMAGE_DATA && ((_a = layer.imageDataRaw) === null || _a === void 0 ? void 0 : _a['-1']))) {
        channelIds.unshift(-1 /* Transparency */);
    }
    channels = channelIds.map(function (channel) {
        var offset = helpers_1.offsetForChannel(channel, false); // TODO: psd.colorMode === ColorMode.CMYK);
        var buffer = helpers_1.writeDataRLE(tempBuffer, data, width, height, [offset], !!options.psb);
        if (helpers_1.RAW_IMAGE_DATA && layer.imageDataRaw) {
            // console.log('written raw layer image data');
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
        writeInt16(writer, Math.round(color.l * 10000));
        writeInt16(writer, Math.round(color.a < 0 ? (color.a * 12800) : (color.a * 12700)));
        writeInt16(writer, Math.round(color.b < 0 ? (color.b * 12800) : (color.b * 12700)));
        writeUint16(writer, 0);
    }
    else if ('h' in color) {
        writeUint16(writer, 1 /* HSB */);
        writeUint16(writer, Math.round(color.h * 0xffff));
        writeUint16(writer, Math.round(color.s * 0xffff));
        writeUint16(writer, Math.round(color.b * 0xffff));
        writeUint16(writer, 0);
    }
    else if ('c' in color) {
        writeUint16(writer, 2 /* CMYK */);
        writeUint16(writer, Math.round(color.c * 257));
        writeUint16(writer, Math.round(color.m * 257));
        writeUint16(writer, Math.round(color.y * 257));
        writeUint16(writer, Math.round(color.k * 257));
    }
    else {
        writeUint16(writer, 8 /* Grayscale */);
        writeUint16(writer, Math.round(color.k * 10000 / 255));
        writeZeros(writer, 6);
    }
}
exports.writeColor = writeColor;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBdUY7QUFDdkYsbURBQW9EO0FBUXBELFNBQWdCLFlBQVksQ0FBQyxJQUFXO0lBQVgscUJBQUEsRUFBQSxXQUFXO0lBQ3ZDLElBQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNqQixPQUFPLEVBQUUsTUFBTSxRQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBTEQsb0NBS0M7QUFFRCxTQUFnQixlQUFlLENBQUMsTUFBaUI7SUFDaEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFGRCwwQ0FFQztBQUVELFNBQWdCLHFCQUFxQixDQUFDLE1BQWlCO0lBQ3RELE9BQU8sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFGRCxzREFFQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUhELG9DQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0s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QUFFLE1BQU0sUUFBQSxFQUFFLFFBQVEsVUFBQSxFQUFFLENBQUM7QUFDdEQsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEVBQTBCLEVBQUUsQ0FBUyxFQUFFLElBQVksRUFBRSxLQUFhO1FBQWhFLElBQUksVUFBQSxFQUFFLEtBQUssV0FBQTtJQUNoQyxJQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLElBQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUU3QyxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDN0MsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2xCLE9BQU8sS0FBSyxDQUFDO1NBQ2I7S0FDRDtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEVBQTBCLEVBQUUsQ0FBUyxFQUFFLEdBQVcsRUFBRSxNQUFjO1FBQWhFLElBQUksVUFBQSxFQUFFLEtBQUssV0FBQTtJQUNoQyxJQUFNLE1BQU0sR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0IsSUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTdDLEtBQUssSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFB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QUFDO1FBQzFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7S0FDdEI7QUFDRixDQUFDO0FBakNELGdDQWlDQyIsImZpbGUiOiJwc2RXcml0ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQc2QsIExheWVyLCBMYXllckFkZGl0aW9uYWxJbmZvLCBDb2xvck1vZGUsIFNlY3Rpb25EaXZpZGVyVHlwZSwgV3JpdGVPcHRpb25zLCBDb2xvciwgR2xvYmFsTGF5ZXJNYXNrSW5mbyB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRoYXNBbHBoYSwgY3JlYXRlQ2FudmFzLCB3cml0ZURhdGFSTEUsIFBpeGVsRGF0YSwgTGF5ZXJDaGFubmVsRGF0YSwgQ2hhbm5lbERhdGEsXHJcblx0b2Zmc2V0Rm9yQ2hhbm5lbCwgY3JlYXRlSW1hZ2VEYXRhLCBmcm9tQmxlbmRNb2RlLCBDaGFubmVsSUQsIENvbXByZXNzaW9uLCBjbGFtcCxcclxuXHRMYXllck1hc2tGbGFncywgTWFza1BhcmFtcywgQ29sb3JTcGFjZSwgQm91bmRzLCBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cywgUkFXX0lNQUdFX0RBVEFcclxufSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBFeHRlbmRlZFdyaXRlT3B0aW9ucywgaGFzTXVsdGlFZmZlY3RzLCBpbmZvSGFuZGxlcnMgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVycyB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQc2RXcml0ZXIge1xyXG5cdG9mZnNldDogbnVtYmVyO1xyXG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XHJcblx0dmlldzogRGF0YVZpZXc7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXcml0ZXIoc2l6ZSA9IDQwOTYpOiBQc2RXcml0ZXIge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzaXplKTtcclxuXHRjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gMDtcclxuXHRyZXR1cm4geyBidWZmZXIsIHZpZXcsIG9mZnNldCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyKSB7XHJcblx0cmV0dXJuIHdyaXRlci5idWZmZXIuc2xpY2UoMCwgd3JpdGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRXcml0ZXJCdWZmZXJOb0NvcHkod3JpdGVyOiBQc2RXcml0ZXIpIHtcclxuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlciwgMCwgd3JpdGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQ4KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDEpO1xyXG5cdHdyaXRlci52aWV3LnNldFVpbnQ4KG9mZnNldCwgdmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcclxuXHR3cml0ZXIudmlldy5zZXRJbnQxNihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcclxuXHR3cml0ZXIudmlldy5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcclxuXHR3cml0ZXIudmlldy5zZXRJbnQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcclxuXHR3cml0ZXIudmlldy5zZXRVaW50MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xyXG5cdHdyaXRlci52aWV3LnNldEZsb2F0MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDY0KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDgpO1xyXG5cdHdyaXRlci52aWV3LnNldEZsb2F0NjQob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDE2LjE2XHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZSAqICgxIDw8IDE2KSk7XHJcbn1cclxuXHJcbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlICogKDEgPDwgMjQpKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQnl0ZXMod3JpdGVyOiBQc2RXcml0ZXIsIGJ1ZmZlcjogVWludDhBcnJheSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChidWZmZXIpIHtcclxuXHRcdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICsgYnVmZmVyLmxlbmd0aCk7XHJcblx0XHRjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xyXG5cdFx0Ynl0ZXMuc2V0KGJ1ZmZlciwgd3JpdGVyLm9mZnNldCk7XHJcblx0XHR3cml0ZXIub2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVaZXJvcyh3cml0ZXI6IFBzZFdyaXRlciwgY291bnQ6IG51bWJlcikge1xyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlU2lnbmF0dXJlKHdyaXRlcjogUHNkV3JpdGVyLCBzaWduYXR1cmU6IHN0cmluZykge1xyXG5cdGlmIChzaWduYXR1cmUubGVuZ3RoICE9PSA0KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzaWduYXR1cmV9J2ApO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHNpZ25hdHVyZS5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nLCBwYWRUbzogbnVtYmVyKSB7XHJcblx0bGV0IGxlbmd0aCA9IHRleHQubGVuZ3RoO1xyXG5cdHdyaXRlVWludDgod3JpdGVyLCBsZW5ndGgpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcblx0XHRjb25zdCBjb2RlID0gdGV4dC5jaGFyQ29kZUF0KGkpO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGNvZGUgPCAxMjggPyBjb2RlIDogJz8nLmNoYXJDb2RlQXQoMCkpO1xyXG5cdH1cclxuXHJcblx0d2hpbGUgKCsrbGVuZ3RoICUgcGFkVG8pIHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZykge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgdGV4dC5sZW5ndGgpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nKSB7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCB0ZXh0Lmxlbmd0aCArIDEpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcblxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExhcmdlc3RMYXllclNpemUobGF5ZXJzOiBMYXllcltdID0gW10pOiBudW1iZXIge1xyXG5cdGxldCBtYXggPSAwO1xyXG5cclxuXHRmb3IgKGNvbnN0IGxheWVyIG9mIGxheWVycykge1xyXG5cdFx0aWYgKGxheWVyLmNhbnZhcyB8fCBsYXllci5pbWFnZURhdGEpIHtcclxuXHRcdFx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xyXG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIDIgKiBoZWlnaHQgKyAyICogd2lkdGggKiBoZWlnaHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsYXllci5jaGlsZHJlbikge1xyXG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIGdldExhcmdlc3RMYXllclNpemUobGF5ZXIuY2hpbGRyZW4pKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBtYXg7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVNlY3Rpb24od3JpdGVyOiBQc2RXcml0ZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6ICgpID0+IHZvaWQsIHdyaXRlVG90YWxMZW5ndGggPSBmYWxzZSwgbGFyZ2UgPSBmYWxzZSkge1xyXG5cdGlmIChsYXJnZSkgd3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHJcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDApO1xyXG5cclxuXHRmdW5jKCk7XHJcblxyXG5cdGxldCBsZW5ndGggPSB3cml0ZXIub2Zmc2V0IC0gb2Zmc2V0IC0gNDtcclxuXHRsZXQgbGVuID0gbGVuZ3RoO1xyXG5cclxuXHR3aGlsZSAoKGxlbiAlIHJvdW5kKSAhPT0gMCkge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdFx0bGVuKys7XHJcblx0fVxyXG5cclxuXHRpZiAod3JpdGVUb3RhbExlbmd0aCkge1xyXG5cdFx0bGVuZ3RoID0gbGVuO1xyXG5cdH1cclxuXHJcblx0d3JpdGVyLnZpZXcuc2V0VWludDMyKG9mZnNldCwgbGVuZ3RoLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZCh3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFdyaXRlT3B0aW9ucyA9IHt9KSB7XHJcblx0aWYgKCEoK3BzZC53aWR0aCA+IDAgJiYgK3BzZC5oZWlnaHQgPiAwKSlcclxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkb2N1bWVudCBzaXplJyk7XHJcblxyXG5cdGlmICgocHNkLndpZHRoID4gMzAwMDAgfHwgcHNkLmhlaWdodCA+IDMwMDAwKSAmJiAhb3B0aW9ucy5wc2IpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RvY3VtZW50IHNpemUgaXMgdG9vIGxhcmdlIChtYXggaXMgMzAwMDB4MzAwMDAsIHVzZSBQU0IgZm9ybWF0IGluc3RlYWQpJyk7XHJcblxyXG5cdGxldCBpbWFnZVJlc291cmNlcyA9IHBzZC5pbWFnZVJlc291cmNlcyB8fCB7fTtcclxuXHJcblx0Y29uc3Qgb3B0OiBFeHRlbmRlZFdyaXRlT3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgbGF5ZXJJZHM6IFtdIH07XHJcblxyXG5cdGlmIChvcHQuZ2VuZXJhdGVUaHVtYm5haWwpIHtcclxuXHRcdGltYWdlUmVzb3VyY2VzID0geyAuLi5pbWFnZVJlc291cmNlcywgdGh1bWJuYWlsOiBjcmVhdGVUaHVtYm5haWwocHNkKSB9O1xyXG5cdH1cclxuXHJcblx0bGV0IGltYWdlRGF0YSA9IHBzZC5pbWFnZURhdGE7XHJcblxyXG5cdGlmICghaW1hZ2VEYXRhICYmIHBzZC5jYW52YXMpIHtcclxuXHRcdGltYWdlRGF0YSA9IHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHBzZC5jYW52YXMud2lkdGgsIHBzZC5jYW52YXMuaGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGlmIChpbWFnZURhdGEgJiYgKHBzZC53aWR0aCAhPT0gaW1hZ2VEYXRhLndpZHRoIHx8IHBzZC5oZWlnaHQgIT09IGltYWdlRGF0YS5oZWlnaHQpKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBjYW52YXMgbXVzdCBoYXZlIHRoZSBzYW1lIHNpemUgYXMgZG9jdW1lbnQnKTtcclxuXHJcblx0Y29uc3QgZ2xvYmFsQWxwaGEgPSAhIWltYWdlRGF0YSAmJiBoYXNBbHBoYShpbWFnZURhdGEpO1xyXG5cdGNvbnN0IG1heEJ1ZmZlclNpemUgPSBNYXRoLm1heChnZXRMYXJnZXN0TGF5ZXJTaXplKHBzZC5jaGlsZHJlbiksIDQgKiAyICogcHNkLndpZHRoICogcHNkLmhlaWdodCArIDIgKiBwc2QuaGVpZ2h0KTtcclxuXHRjb25zdCB0ZW1wQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobWF4QnVmZmVyU2l6ZSk7XHJcblxyXG5cdC8vIGhlYWRlclxyXG5cdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCUFMnKTtcclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIG9wdGlvbnMucHNiID8gMiA6IDEpOyAvLyB2ZXJzaW9uXHJcblx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyA0IDogMyk7IC8vIGNoYW5uZWxzXHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBwc2QuaGVpZ2h0KTtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHBzZC53aWR0aCk7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCA4KTsgLy8gYml0cyBwZXIgY2hhbm5lbFxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JNb2RlLlJHQik7IC8vIHdlIG9ubHkgc3VwcG9ydCBzYXZpbmcgUkdCIHJpZ2h0IG5vd1xyXG5cclxuXHQvLyBjb2xvciBtb2RlIGRhdGFcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHQvLyBUT0RPOiBpbXBsZW1lbnRcclxuXHR9KTtcclxuXHJcblx0Ly8gaW1hZ2UgcmVzb3VyY2VzXHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIHJlc291cmNlSGFuZGxlcnMpIHtcclxuXHRcdFx0aWYgKGhhbmRsZXIuaGFzKGltYWdlUmVzb3VyY2VzKSkge1xyXG5cdFx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGhhbmRsZXIua2V5KTtcclxuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsICcnLCAyKTtcclxuXHRcdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiBoYW5kbGVyLndyaXRlKHdyaXRlciwgaW1hZ2VSZXNvdXJjZXMpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHQvLyBsYXllciBhbmQgbWFzayBpbmZvXHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4ge1xyXG5cdFx0d3JpdGVMYXllckluZm8odGVtcEJ1ZmZlciwgd3JpdGVyLCBwc2QsIGdsb2JhbEFscGhhLCBvcHQpO1xyXG5cdFx0d3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlciwgcHNkLmdsb2JhbExheWVyTWFza0luZm8pO1xyXG5cdFx0d3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlciwgcHNkLCBwc2QsIG9wdCk7XHJcblx0fSwgdW5kZWZpbmVkLCAhIW9wdC5wc2IpO1xyXG5cclxuXHQvLyBpbWFnZSBkYXRhXHJcblx0Y29uc3QgY2hhbm5lbHMgPSBnbG9iYWxBbHBoYSA/IFswLCAxLCAyLCAzXSA6IFswLCAxLCAyXTtcclxuXHRjb25zdCBkYXRhOiBQaXhlbERhdGEgPSBpbWFnZURhdGEgfHwge1xyXG5cdFx0ZGF0YTogbmV3IFVpbnQ4QXJyYXkoNCAqIHBzZC53aWR0aCAqIHBzZC5oZWlnaHQpLFxyXG5cdFx0d2lkdGg6IHBzZC53aWR0aCxcclxuXHRcdGhlaWdodDogcHNkLmhlaWdodCxcclxuXHR9O1xyXG5cclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpO1xyXG5cclxuXHRpZiAoUkFXX0lNQUdFX0RBVEEgJiYgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdykge1xyXG5cdFx0Y29uc29sZS5sb2coJ3dyaXRpbmcgcmF3IGltYWdlIGRhdGEnKTtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIGNoYW5uZWxzLCAhIW9wdGlvbnMucHNiKSk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCB3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBFeHRlbmRlZFdyaXRlT3B0aW9ucykge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDQsICgpID0+IHtcclxuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xyXG5cclxuXHRcdGFkZENoaWxkcmVuKGxheWVycywgcHNkLmNoaWxkcmVuKTtcclxuXHJcblx0XHRpZiAoIWxheWVycy5sZW5ndGgpIGxheWVycy5wdXNoKHt9KTtcclxuXHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyAtbGF5ZXJzLmxlbmd0aCA6IGxheWVycy5sZW5ndGgpO1xyXG5cclxuXHRcdGNvbnN0IGxheWVyc0RhdGEgPSBsYXllcnMubWFwKChsLCBpKSA9PiBnZXRDaGFubmVscyh0ZW1wQnVmZmVyLCBsLCBpID09PSAwLCBvcHRpb25zKSk7XHJcblxyXG5cdFx0Ly8gbGF5ZXIgcmVjb3Jkc1xyXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xyXG5cdFx0XHRjb25zdCB7IGxheWVyLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIGNoYW5uZWxzIH0gPSBsYXllckRhdGE7XHJcblxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdG9wKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGxlZnQpO1xyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgYm90dG9tKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHJpZ2h0KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVscy5sZW5ndGgpO1xyXG5cclxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGNoYW5uZWxzKSB7XHJcblx0XHRcdFx0d3JpdGVJbnQxNih3cml0ZXIsIGMuY2hhbm5lbElkKTtcclxuXHRcdFx0XHRpZiAob3B0aW9ucy5wc2IpIHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblx0XHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBjLmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmcm9tQmxlbmRNb2RlW2xheWVyLmJsZW5kTW9kZSFdIHx8ICdub3JtJyk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBNYXRoLnJvdW5kKGNsYW1wKGxheWVyLm9wYWNpdHkgPz8gMSwgMCwgMSkgKiAyNTUpKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGxheWVyLmNsaXBwaW5nID8gMSA6IDApO1xyXG5cclxuXHRcdFx0bGV0IGZsYWdzID0gMHgwODsgLy8gMSBmb3IgUGhvdG9zaG9wIDUuMCBhbmQgbGF0ZXIsIHRlbGxzIGlmIGJpdCA0IGhhcyB1c2VmdWwgaW5mb3JtYXRpb25cclxuXHRcdFx0aWYgKGxheWVyLnRyYW5zcGFyZW5jeVByb3RlY3RlZCkgZmxhZ3MgfD0gMHgwMTtcclxuXHRcdFx0aWYgKGxheWVyLmhpZGRlbikgZmxhZ3MgfD0gMHgwMjtcclxuXHRcdFx0aWYgKGxheWVyLnZlY3Rvck1hc2sgfHwgKGxheWVyLnNlY3Rpb25EaXZpZGVyICYmIGxheWVyLnNlY3Rpb25EaXZpZGVyLnR5cGUgIT09IFNlY3Rpb25EaXZpZGVyVHlwZS5PdGhlcikpIHtcclxuXHRcdFx0XHRmbGFncyB8PSAweDEwOyAvLyBwaXhlbCBkYXRhIGlycmVsZXZhbnQgdG8gYXBwZWFyYW5jZSBvZiBkb2N1bWVudFxyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChsYXllci5lZmZlY3RzICYmIGhhc011bHRpRWZmZWN0cyhsYXllci5lZmZlY3RzKSkge1xyXG5cdFx0XHRcdGZsYWdzIHw9IDB4MjA7IC8vIGp1c3QgZ3Vlc3NpbmcgdGhpcyBvbmUsIG1pZ2h0IGJlIGNvbXBsZXRlbHkgaW5jb3JyZWN0XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncyk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTsgLy8gZmlsbGVyXHJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdFx0XHR3cml0ZUxheWVyTWFza0RhdGEod3JpdGVyLCBsYXllciwgbGF5ZXJEYXRhKTtcclxuXHRcdFx0XHR3cml0ZUxheWVyQmxlbmRpbmdSYW5nZXMod3JpdGVyLCBwc2QpO1xyXG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgbGF5ZXIubmFtZSB8fCAnJywgNCk7XHJcblx0XHRcdFx0d3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlciwgbGF5ZXIsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGxheWVyIGNoYW5uZWwgaW1hZ2UgZGF0YVxyXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xyXG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgbGF5ZXJEYXRhLmNoYW5uZWxzKSB7XHJcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsLmNvbXByZXNzaW9uKTtcclxuXHJcblx0XHRcdFx0aWYgKGNoYW5uZWwuYnVmZmVyKSB7XHJcblx0XHRcdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgY2hhbm5lbC5idWZmZXIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sIHRydWUsIG9wdGlvbnMucHNiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMYXllck1hc2tEYXRhKHdyaXRlcjogUHNkV3JpdGVyLCB7IG1hc2sgfTogTGF5ZXIsIGxheWVyRGF0YTogTGF5ZXJDaGFubmVsRGF0YSkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdGlmICghbWFzaykgcmV0dXJuO1xyXG5cclxuXHRcdGNvbnN0IG0gPSBsYXllckRhdGEubWFzayB8fCB7fSBhcyBQYXJ0aWFsPEJvdW5kcz47XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS50b3AhKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmxlZnQhKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmJvdHRvbSEpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0ucmlnaHQhKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBtYXNrLmRlZmF1bHRDb2xvciEpO1xyXG5cclxuXHRcdGxldCBwYXJhbXMgPSAwO1xyXG5cdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eTtcclxuXHRcdGlmIChtYXNrLnVzZXJNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5Vc2VyTWFza0ZlYXRoZXI7XHJcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRGVuc2l0eTtcclxuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tGZWF0aGVyO1xyXG5cclxuXHRcdGxldCBmbGFncyA9IDA7XHJcblx0XHRpZiAobWFzay5kaXNhYmxlZCkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQ7XHJcblx0XHRpZiAobWFzay5wb3NpdGlvblJlbGF0aXZlVG9MYXllcikgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuUG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXI7XHJcblx0XHRpZiAobWFzay5mcm9tVmVjdG9yRGF0YSkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRnJvbVJlbmRlcmluZ090aGVyRGF0YTtcclxuXHRcdGlmIChwYXJhbXMpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQ7XHJcblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzKTtcclxuXHJcblx0XHRpZiAocGFyYW1zKSB7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBwYXJhbXMpO1xyXG5cclxuXHRcdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHdyaXRlVWludDgod3JpdGVyLCBNYXRoLnJvdW5kKG1hc2sudXNlck1hc2tEZW5zaXR5ICogMHhmZikpO1xyXG5cdFx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay51c2VyTWFza0ZlYXRoZXIpO1xyXG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICogMHhmZikpO1xyXG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSB3cml0ZUZsb2F0NjQod3JpdGVyLCBtYXNrLnZlY3Rvck1hc2tGZWF0aGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUT0RPOiBoYW5kbGUgcmVzdCBvZiB0aGUgZmllbGRzXHJcblxyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUxheWVyQmxlbmRpbmdSYW5nZXMod3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkKSB7XHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHJcblx0XHRsZXQgY2hhbm5lbHMgPSBwc2QuY2hhbm5lbHMgfHwgMDsgLy8gVE9ETzogdXNlIGFsd2F5cyA0IGluc3RlYWQgP1xyXG5cdFx0Ly8gY2hhbm5lbHMgPSA0OyAvLyBURVNUSU5HXHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVsczsgaSsrKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCBpbmZvOiBHbG9iYWxMYXllck1hc2tJbmZvIHwgdW5kZWZpbmVkKSB7XHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0aWYgKGluZm8pIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm92ZXJsYXlDb2xvclNwYWNlKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UxKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UyKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UzKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2U0KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm9wYWNpdHkgKiAweGZmKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ua2luZCk7XHJcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBFeHRlbmRlZFdyaXRlT3B0aW9ucykge1xyXG5cdGZvciAoY29uc3QgaGFuZGxlciBvZiBpbmZvSGFuZGxlcnMpIHtcclxuXHRcdGxldCBrZXkgPSBoYW5kbGVyLmtleTtcclxuXHJcblx0XHRpZiAoa2V5ID09PSAnVHh0MicgJiYgb3B0aW9ucy5pbnZhbGlkYXRlVGV4dExheWVycykgY29udGludWU7XHJcblx0XHRpZiAoa2V5ID09PSAndm1zaycgJiYgb3B0aW9ucy5wc2IpIGtleSA9ICd2c21zJztcclxuXHJcblx0XHRpZiAoaGFuZGxlci5oYXModGFyZ2V0KSkge1xyXG5cdFx0XHRjb25zdCBsYXJnZSA9IG9wdGlvbnMucHNiICYmIGxhcmdlQWRkaXRpb25hbEluZm9LZXlzLmluZGV4T2Yoa2V5KSAhPT0gLTE7XHJcblxyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGxhcmdlID8gJzhCNjQnIDogJzhCSU0nKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBrZXkpO1xyXG5cclxuXHRcdFx0Y29uc3QgZm91ckJ5dGVzID0ga2V5ID09PSAnVHh0MicgfHwga2V5ID09PSAnbHVuaScgfHwga2V5ID09PSAndm1zaycgfHwga2V5ID09PSAnYXJ0YicgfHwga2V5ID09PSAnYXJ0ZCcgfHxcclxuXHRcdFx0XHRrZXkgPT09ICd2b2drJyB8fCBrZXkgPT09ICdTb0xkJyB8fCBrZXkgPT09ICdsbmsyJyB8fCBrZXkgPT09ICd2c2NnJyB8fCBrZXkgPT09ICd2c21zJyB8fCBrZXkgPT09ICdHZEZsJyB8fFxyXG5cdFx0XHRcdGtleSA9PT0gJ2xtZngnIHx8IGtleSA9PT0gJ2xyRlgnIHx8IGtleSA9PT0gJ2NpbmYnIHx8IGtleSA9PT0gJ1BsTGQnIHx8IGtleSA9PT0gJ0Fubm8nO1xyXG5cclxuXHRcdFx0d3JpdGVTZWN0aW9uKHdyaXRlciwgZm91ckJ5dGVzID8gNCA6IDIsICgpID0+IHtcclxuXHRcdFx0XHRoYW5kbGVyLndyaXRlKHdyaXRlciwgdGFyZ2V0LCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0XHR9LCBrZXkgIT09ICdUeHQyJyAmJiBrZXkgIT09ICdjaW5mJyAmJiBrZXkgIT09ICdleHRuJywgbGFyZ2UpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkQ2hpbGRyZW4obGF5ZXJzOiBMYXllcltdLCBjaGlsZHJlbjogTGF5ZXJbXSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICghY2hpbGRyZW4pIHJldHVybjtcclxuXHJcblx0Zm9yIChjb25zdCBjIG9mIGNoaWxkcmVuKSB7XHJcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmNhbnZhcykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxheWVyLCBjYW5ub3QgaGF2ZSBib3RoICdjYW52YXMnIGFuZCAnY2hpbGRyZW4nIHByb3BlcnRpZXNgKTtcclxuXHRcdGlmIChjLmNoaWxkcmVuICYmIGMuaW1hZ2VEYXRhKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2ltYWdlRGF0YScgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xyXG5cclxuXHRcdGlmIChjLmNoaWxkcmVuKSB7XHJcblx0XHRcdGxheWVycy5wdXNoKHtcclxuXHRcdFx0XHRuYW1lOiAnPC9MYXllciBncm91cD4nLFxyXG5cdFx0XHRcdHNlY3Rpb25EaXZpZGVyOiB7XHJcblx0XHRcdFx0XHR0eXBlOiBTZWN0aW9uRGl2aWRlclR5cGUuQm91bmRpbmdTZWN0aW9uRGl2aWRlcixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8vIFRFU1RJTkdcclxuXHRcdFx0XHQvLyBuYW1lU291cmNlOiAnbHNldCcsXHJcblx0XHRcdFx0Ly8gaWQ6IFs0LCAwLCAwLCA4LCAxMSwgMCwgMCwgMCwgMCwgMTRdW2xheWVycy5sZW5ndGhdIHx8IDAsXHJcblx0XHRcdFx0Ly8gbGF5ZXJDb2xvcjogJ25vbmUnLFxyXG5cdFx0XHRcdC8vIHRpbWVzdGFtcDogWzE2MTEzNDY4MTcuMzQ5MDIxLCAwLCAwLCAxNjExMzQ2ODE3LjM0OTE3NSwgMTYxMTM0NjgxNy4zNDkxODMzLCAwLCAwLCAwLCAwLCAxNjExMzQ2ODE3LjM0OTgzMl1bbGF5ZXJzLmxlbmd0aF0gfHwgMCxcclxuXHRcdFx0XHQvLyBwcm90ZWN0ZWQ6IHt9LFxyXG5cdFx0XHRcdC8vIHJlZmVyZW5jZVBvaW50OiB7IHg6IDAsIHk6IDAgfSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGFkZENoaWxkcmVuKGxheWVycywgYy5jaGlsZHJlbik7XHJcblx0XHRcdGxheWVycy5wdXNoKHtcclxuXHRcdFx0XHRzZWN0aW9uRGl2aWRlcjoge1xyXG5cdFx0XHRcdFx0dHlwZTogYy5vcGVuZWQgPT09IGZhbHNlID8gU2VjdGlvbkRpdmlkZXJUeXBlLkNsb3NlZEZvbGRlciA6IFNlY3Rpb25EaXZpZGVyVHlwZS5PcGVuRm9sZGVyLFxyXG5cdFx0XHRcdFx0a2V5OiBmcm9tQmxlbmRNb2RlW2MuYmxlbmRNb2RlIV0gfHwgJ3Bhc3MnLFxyXG5cdFx0XHRcdFx0c3ViVHlwZTogMCxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC4uLmMsXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXJzLnB1c2goeyAuLi5jIH0pO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVzaXplQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRsZXQgbmV3TGVuZ3RoID0gd3JpdGVyLmJ1ZmZlci5ieXRlTGVuZ3RoO1xyXG5cclxuXHRkbyB7XHJcblx0XHRuZXdMZW5ndGggKj0gMjtcclxuXHR9IHdoaWxlIChzaXplID4gbmV3TGVuZ3RoKTtcclxuXHJcblx0Y29uc3QgbmV3QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKG5ld0xlbmd0aCk7XHJcblx0Y29uc3QgbmV3Qnl0ZXMgPSBuZXcgVWludDhBcnJheShuZXdCdWZmZXIpO1xyXG5cdGNvbnN0IG9sZEJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlcik7XHJcblx0bmV3Qnl0ZXMuc2V0KG9sZEJ5dGVzKTtcclxuXHR3cml0ZXIuYnVmZmVyID0gbmV3QnVmZmVyO1xyXG5cdHdyaXRlci52aWV3ID0gbmV3IERhdGFWaWV3KHdyaXRlci5idWZmZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbnN1cmVTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRpZiAoc2l6ZSA+IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aCkge1xyXG5cdFx0cmVzaXplQnVmZmVyKHdyaXRlciwgc2l6ZSk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xyXG5cdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICs9IHNpemUpO1xyXG5cdHJldHVybiBvZmZzZXQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVRodW1ibmFpbChwc2Q6IFBzZCkge1xyXG5cdGNvbnN0IGNhbnZhcyA9IGNyZWF0ZUNhbnZhcygxMCwgMTApO1xyXG5cdGxldCBzY2FsZSA9IDE7XHJcblxyXG5cdGlmIChwc2Qud2lkdGggPiBwc2QuaGVpZ2h0KSB7XHJcblx0XHRjYW52YXMud2lkdGggPSAxNjA7XHJcblx0XHRjYW52YXMuaGVpZ2h0ID0gTWF0aC5mbG9vcihwc2QuaGVpZ2h0ICogKGNhbnZhcy53aWR0aCAvIHBzZC53aWR0aCkpO1xyXG5cdFx0c2NhbGUgPSBjYW52YXMud2lkdGggLyBwc2Qud2lkdGg7XHJcblx0fSBlbHNlIHtcclxuXHRcdGNhbnZhcy5oZWlnaHQgPSAxNjA7XHJcblx0XHRjYW52YXMud2lkdGggPSBNYXRoLmZsb29yKHBzZC53aWR0aCAqIChjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodCkpO1xyXG5cdFx0c2NhbGUgPSBjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodDtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSE7XHJcblx0Y29udGV4dC5zY2FsZShzY2FsZSwgc2NhbGUpO1xyXG5cclxuXHRpZiAocHNkLmltYWdlRGF0YSkge1xyXG5cdFx0Y29uc3QgdGVtcCA9IGNyZWF0ZUNhbnZhcyhwc2QuaW1hZ2VEYXRhLndpZHRoLCBwc2QuaW1hZ2VEYXRhLmhlaWdodCk7XHJcblx0XHR0ZW1wLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShwc2QuaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHRlbXAsIDAsIDApO1xyXG5cdH0gZWxzZSBpZiAocHNkLmNhbnZhcykge1xyXG5cdFx0Y29udGV4dC5kcmF3SW1hZ2UocHNkLmNhbnZhcywgMCwgMCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY2FudmFzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDaGFubmVscyhcclxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xyXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcclxuXHRjb25zdCBsYXllckRhdGEgPSBnZXRMYXllckNoYW5uZWxzKHRlbXBCdWZmZXIsIGxheWVyLCBiYWNrZ3JvdW5kLCBvcHRpb25zKTtcclxuXHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcclxuXHJcblx0aWYgKG1hc2spIHtcclxuXHRcdGxldCB7IHRvcCA9IDAsIGxlZnQgPSAwLCByaWdodCA9IDAsIGJvdHRvbSA9IDAgfSA9IG1hc2s7XHJcblx0XHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobWFzayk7XHJcblx0XHRsZXQgaW1hZ2VEYXRhID0gbWFzay5pbWFnZURhdGE7XHJcblxyXG5cdFx0aWYgKCFpbWFnZURhdGEgJiYgbWFzay5jYW52YXMgJiYgd2lkdGggJiYgaGVpZ2h0KSB7XHJcblx0XHRcdGltYWdlRGF0YSA9IG1hc2suY2FudmFzLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAod2lkdGggJiYgaGVpZ2h0ICYmIGltYWdlRGF0YSkge1xyXG5cdFx0XHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcclxuXHRcdFx0Ym90dG9tID0gdG9wICsgaGVpZ2h0O1xyXG5cclxuXHRcdFx0bGV0IGJ1ZmZlciA9IHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBpbWFnZURhdGEsIHdpZHRoLCBoZWlnaHQsIFswXSwgISFvcHRpb25zLnBzYikhO1xyXG5cclxuXHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBICYmIChsYXllciBhcyBhbnkpLm1hc2tEYXRhUmF3KSB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ3dyaXR0ZW4gcmF3IGxheWVyIGltYWdlIGRhdGEnKTtcclxuXHRcdFx0XHRidWZmZXIgPSAobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGF5ZXJEYXRhLm1hc2sgPSB7IHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSB9O1xyXG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XHJcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXHJcblx0XHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQsXHJcblx0XHRcdFx0YnVmZmVyOiBidWZmZXIsXHJcblx0XHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRsYXllckRhdGEubWFzayA9IHsgdG9wOiAwLCBsZWZ0OiAwLCByaWdodDogMCwgYm90dG9tOiAwIH07XHJcblx0XHRcdGxheWVyRGF0YS5jaGFubmVscy5wdXNoKHtcclxuXHRcdFx0XHRjaGFubmVsSWQ6IENoYW5uZWxJRC5Vc2VyTWFzayxcclxuXHRcdFx0XHRjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSxcclxuXHRcdFx0XHRidWZmZXI6IG5ldyBVaW50OEFycmF5KDApLFxyXG5cdFx0XHRcdGxlbmd0aDogMCxcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gbGF5ZXJEYXRhO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMYXllckRpbWVudGlvbnMoeyBjYW52YXMsIGltYWdlRGF0YSB9OiBMYXllcik6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IH0ge1xyXG5cdHJldHVybiBpbWFnZURhdGEgfHwgY2FudmFzIHx8IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcm9wSW1hZ2VEYXRhKGRhdGE6IEltYWdlRGF0YSwgbGVmdDogbnVtYmVyLCB0b3A6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHRjb25zdCBjcm9wcGVkRGF0YSA9IGNyZWF0ZUltYWdlRGF0YSh3aWR0aCwgaGVpZ2h0KTtcclxuXHRjb25zdCBzcmNEYXRhID0gZGF0YS5kYXRhO1xyXG5cdGNvbnN0IGRzdERhdGEgPSBjcm9wcGVkRGF0YS5kYXRhO1xyXG5cclxuXHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XHJcblx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcclxuXHRcdFx0bGV0IHNyYyA9ICgoeCArIGxlZnQpICsgKHkgKyB0b3ApICogd2lkdGgpICogNDtcclxuXHRcdFx0bGV0IGRzdCA9ICh4ICsgeSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdGRzdERhdGFbZHN0XSA9IHNyY0RhdGFbc3JjXTtcclxuXHRcdFx0ZHN0RGF0YVtkc3QgKyAxXSA9IHNyY0RhdGFbc3JjICsgMV07XHJcblx0XHRcdGRzdERhdGFbZHN0ICsgMl0gPSBzcmNEYXRhW3NyYyArIDJdO1xyXG5cdFx0XHRkc3REYXRhW2RzdCArIDNdID0gc3JjRGF0YVtzcmMgKyAzXTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBjcm9wcGVkRGF0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGF5ZXJDaGFubmVscyhcclxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xyXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcclxuXHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBsYXllcjtcclxuXHRsZXQgY2hhbm5lbHM6IENoYW5uZWxEYXRhW10gPSBbXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELlRyYW5zcGFyZW5jeSwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRcdHsgY2hhbm5lbElkOiBDaGFubmVsSUQuQ29sb3IwLCBjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSwgYnVmZmVyOiB1bmRlZmluZWQsIGxlbmd0aDogMiB9LFxyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5Db2xvcjEsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELkNvbG9yMiwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRdO1xyXG5cclxuXHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xyXG5cclxuXHRpZiAoIShsYXllci5jYW52YXMgfHwgbGF5ZXIuaW1hZ2VEYXRhKSB8fCAhd2lkdGggfHwgIWhlaWdodCkge1xyXG5cdFx0cmlnaHQgPSBsZWZ0O1xyXG5cdFx0Ym90dG9tID0gdG9wO1xyXG5cdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxuXHR9XHJcblxyXG5cdHJpZ2h0ID0gbGVmdCArIHdpZHRoO1xyXG5cdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcclxuXHJcblx0bGV0IGRhdGEgPSBsYXllci5pbWFnZURhdGEgfHwgbGF5ZXIuY2FudmFzIS5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblxyXG5cdGlmIChvcHRpb25zLnRyaW1JbWFnZURhdGEpIHtcclxuXHRcdGNvbnN0IHRyaW1tZWQgPSB0cmltRGF0YShkYXRhKTtcclxuXHJcblx0XHRpZiAodHJpbW1lZC5sZWZ0ICE9PSAwIHx8IHRyaW1tZWQudG9wICE9PSAwIHx8IHRyaW1tZWQucmlnaHQgIT09IGRhdGEud2lkdGggfHwgdHJpbW1lZC5ib3R0b20gIT09IGRhdGEuaGVpZ2h0KSB7XHJcblx0XHRcdGxlZnQgKz0gdHJpbW1lZC5sZWZ0O1xyXG5cdFx0XHR0b3AgKz0gdHJpbW1lZC50b3A7XHJcblx0XHRcdHJpZ2h0IC09IChkYXRhLndpZHRoIC0gdHJpbW1lZC5yaWdodCk7XHJcblx0XHRcdGJvdHRvbSAtPSAoZGF0YS5oZWlnaHQgLSB0cmltbWVkLmJvdHRvbSk7XHJcblx0XHRcdHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xyXG5cdFx0XHRoZWlnaHQgPSBib3R0b20gLSB0b3A7XHJcblxyXG5cdFx0XHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpIHtcclxuXHRcdFx0XHRyZXR1cm4geyBsYXllciwgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tLCBjaGFubmVscyB9O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAobGF5ZXIuaW1hZ2VEYXRhKSB7XHJcblx0XHRcdFx0ZGF0YSA9IGNyb3BJbWFnZURhdGEoZGF0YSwgdHJpbW1lZC5sZWZ0LCB0cmltbWVkLnRvcCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZGF0YSA9IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjb25zdCBjaGFubmVsSWRzID0gW1xyXG5cdFx0Q2hhbm5lbElELkNvbG9yMCxcclxuXHRcdENoYW5uZWxJRC5Db2xvcjEsXHJcblx0XHRDaGFubmVsSUQuQ29sb3IyLFxyXG5cdF07XHJcblxyXG5cdGlmICghYmFja2dyb3VuZCB8fCBvcHRpb25zLm5vQmFja2dyb3VuZCB8fCBsYXllci5tYXNrIHx8IGhhc0FscGhhKGRhdGEpIHx8IChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXc/LlsnLTEnXSkpIHtcclxuXHRcdGNoYW5uZWxJZHMudW5zaGlmdChDaGFubmVsSUQuVHJhbnNwYXJlbmN5KTtcclxuXHR9XHJcblxyXG5cdGNoYW5uZWxzID0gY2hhbm5lbElkcy5tYXAoY2hhbm5lbCA9PiB7XHJcblx0XHRjb25zdCBvZmZzZXQgPSBvZmZzZXRGb3JDaGFubmVsKGNoYW5uZWwsIGZhbHNlKTsgLy8gVE9ETzogcHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkNNWUspO1xyXG5cdFx0bGV0IGJ1ZmZlciA9IHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBbb2Zmc2V0XSwgISFvcHRpb25zLnBzYikhO1xyXG5cclxuXHRcdGlmIChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXcpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coJ3dyaXR0ZW4gcmF3IGxheWVyIGltYWdlIGRhdGEnKTtcclxuXHRcdFx0YnVmZmVyID0gKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3W2NoYW5uZWxdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGNoYW5uZWxJZDogY2hhbm5lbCxcclxuXHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQsXHJcblx0XHRcdGJ1ZmZlcjogYnVmZmVyLFxyXG5cdFx0XHRsZW5ndGg6IDIgKyBidWZmZXIubGVuZ3RoLFxyXG5cdFx0fTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNSb3dFbXB0eSh7IGRhdGEsIHdpZHRoIH06IFBpeGVsRGF0YSwgeTogbnVtYmVyLCBsZWZ0OiBudW1iZXIsIHJpZ2h0OiBudW1iZXIpIHtcclxuXHRjb25zdCBzdGFydCA9ICgoeSAqIHdpZHRoICsgbGVmdCkgKiA0ICsgMykgfCAwO1xyXG5cdGNvbnN0IGVuZCA9IChzdGFydCArIChyaWdodCAtIGxlZnQpICogNCkgfCAwO1xyXG5cclxuXHRmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgPSAoaSArIDQpIHwgMCkge1xyXG5cdFx0aWYgKGRhdGFbaV0gIT09IDApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzQ29sRW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHg6IG51bWJlciwgdG9wOiBudW1iZXIsIGJvdHRvbTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc3RyaWRlID0gKHdpZHRoICogNCkgfCAwO1xyXG5cdGNvbnN0IHN0YXJ0ID0gKHRvcCAqIHN0cmlkZSArIHggKiA0ICsgMykgfCAwO1xyXG5cclxuXHRmb3IgKGxldCB5ID0gdG9wLCBpID0gc3RhcnQ7IHkgPCBib3R0b207IHkrKywgaSA9IChpICsgc3RyaWRlKSB8IDApIHtcclxuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cmltRGF0YShkYXRhOiBQaXhlbERhdGEpIHtcclxuXHRsZXQgdG9wID0gMDtcclxuXHRsZXQgbGVmdCA9IDA7XHJcblx0bGV0IHJpZ2h0ID0gZGF0YS53aWR0aDtcclxuXHRsZXQgYm90dG9tID0gZGF0YS5oZWlnaHQ7XHJcblxyXG5cdHdoaWxlICh0b3AgPCBib3R0b20gJiYgaXNSb3dFbXB0eShkYXRhLCB0b3AsIGxlZnQsIHJpZ2h0KSlcclxuXHRcdHRvcCsrO1xyXG5cdHdoaWxlIChib3R0b20gPiB0b3AgJiYgaXNSb3dFbXB0eShkYXRhLCBib3R0b20gLSAxLCBsZWZ0LCByaWdodCkpXHJcblx0XHRib3R0b20tLTtcclxuXHR3aGlsZSAobGVmdCA8IHJpZ2h0ICYmIGlzQ29sRW1wdHkoZGF0YSwgbGVmdCwgdG9wLCBib3R0b20pKVxyXG5cdFx0bGVmdCsrO1xyXG5cdHdoaWxlIChyaWdodCA+IGxlZnQgJiYgaXNDb2xFbXB0eShkYXRhLCByaWdodCAtIDEsIHRvcCwgYm90dG9tKSlcclxuXHRcdHJpZ2h0LS07XHJcblxyXG5cdHJldHVybiB7IHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVDb2xvcih3cml0ZXI6IFBzZFdyaXRlciwgY29sb3I6IENvbG9yIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKCFjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLlJHQik7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgOCk7XHJcblx0fSBlbHNlIGlmICgncicgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnIgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5nICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxuXHR9IGVsc2UgaWYgKCdsJyBpbiBjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkxhYik7XHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5sICogMTAwMDApKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmEgPCAwID8gKGNvbG9yLmEgKiAxMjgwMCkgOiAoY29sb3IuYSAqIDEyNzAwKSkpO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiA8IDAgPyAoY29sb3IuYiAqIDEyODAwKSA6IChjb2xvci5iICogMTI3MDApKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdH0gZWxzZSBpZiAoJ2gnIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuSFNCKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5oICogMHhmZmZmKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IucyAqIDB4ZmZmZikpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAweGZmZmYpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0fSBlbHNlIGlmICgnYycgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5DTVlLKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5jICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubSAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnkgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rICogMjU3KSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5HcmF5c2NhbGUpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmsgKiAxMDAwMCAvIDI1NSkpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xyXG5cdH1cclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
