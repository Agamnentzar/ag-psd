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
        throw new Error("Invalid signature: '".concat(signature, "'"));
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
    var globalAlpha = !!imageData && (0, helpers_1.hasAlpha)(imageData);
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
        writeBytes(writer, (0, helpers_1.writeDataRLE)(tempBuffer, data, psd.width, psd.height, channels, !!options.psb));
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
            writeUint8(writer, Math.round((0, helpers_1.clamp)((_a = layer.opacity) !== null && _a !== void 0 ? _a : 1, 0, 1) * 255));
            writeUint8(writer, layer.clipping ? 1 : 0);
            var flags = 0x08; // 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
            if (layer.transparencyProtected)
                flags |= 0x01;
            if (layer.hidden)
                flags |= 0x02;
            if (layer.vectorMask || (layer.sectionDivider && layer.sectionDivider.type !== 0 /* Other */)) {
                flags |= 0x10; // pixel data irrelevant to appearance of document
            }
            if (layer.effects && (0, additionalInfo_1.hasMultiEffects)(layer.effects)) {
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
    var canvas = (0, helpers_1.createCanvas)(10, 10);
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
        var temp = (0, helpers_1.createCanvas)(psd.imageData.width, psd.imageData.height);
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
            var buffer = (0, helpers_1.writeDataRLE)(tempBuffer, imageData, width, height, [0], !!options.psb);
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
    var croppedData = (0, helpers_1.createImageData)(width, height);
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
    if (!background || options.noBackground || layer.mask || (0, helpers_1.hasAlpha)(data) || (helpers_1.RAW_IMAGE_DATA && ((_a = layer.imageDataRaw) === null || _a === void 0 ? void 0 : _a['-1']))) {
        channelIds.unshift(-1 /* Transparency */);
    }
    channels = channelIds.map(function (channel) {
        var offset = (0, helpers_1.offsetForChannel)(channel, false); // TODO: psd.colorMode === ColorMode.CMYK);
        var buffer = (0, helpers_1.writeDataRLE)(tempBuffer, data, width, height, [offset], !!options.psb);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBdUY7QUFDdkYsbURBQW9EO0FBUXBELFNBQWdCLFlBQVksQ0FBQyxJQUFXO0lBQVgscUJBQUEsRUFBQSxXQUFXO0lBQ3ZDLElBQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNqQixPQUFPLEVBQUUsTUFBTSxRQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBTEQsb0NBS0M7QUFFRCxTQUFnQixlQUFlLENBQUMsTUFBaUI7SUFDaEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFGRCwwQ0FFQztBQUVELFNBQWdCLHFCQUFxQixDQUFDLE1BQWlCO0lBQ3RELE9BQU8sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFGRCxzREFFQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUhELG9DQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0s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LENBQUMsQ0FBQyxDQUFDO0tBQy9DO1NBQU07UUFDTixXQUFXLENBQUMsTUFBTSxvQkFBdUIsQ0FBQztRQUMxQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2RCxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RCO0FBQ0YsQ0FBQztBQWpDRCxnQ0FpQ0MiLCJmaWxlIjoicHNkV3JpdGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHNkLCBMYXllciwgTGF5ZXJBZGRpdGlvbmFsSW5mbywgQ29sb3JNb2RlLCBTZWN0aW9uRGl2aWRlclR5cGUsIFdyaXRlT3B0aW9ucywgQ29sb3IsIEdsb2JhbExheWVyTWFza0luZm8gfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7XHJcblx0aGFzQWxwaGEsIGNyZWF0ZUNhbnZhcywgd3JpdGVEYXRhUkxFLCBQaXhlbERhdGEsIExheWVyQ2hhbm5lbERhdGEsIENoYW5uZWxEYXRhLFxyXG5cdG9mZnNldEZvckNoYW5uZWwsIGNyZWF0ZUltYWdlRGF0YSwgZnJvbUJsZW5kTW9kZSwgQ2hhbm5lbElELCBDb21wcmVzc2lvbiwgY2xhbXAsXHJcblx0TGF5ZXJNYXNrRmxhZ3MsIE1hc2tQYXJhbXMsIENvbG9yU3BhY2UsIEJvdW5kcywgbGFyZ2VBZGRpdGlvbmFsSW5mb0tleXMsIFJBV19JTUFHRV9EQVRBXHJcbn0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHsgRXh0ZW5kZWRXcml0ZU9wdGlvbnMsIGhhc011bHRpRWZmZWN0cywgaW5mb0hhbmRsZXJzIH0gZnJvbSAnLi9hZGRpdGlvbmFsSW5mbyc7XHJcbmltcG9ydCB7IHJlc291cmNlSGFuZGxlcnMgfSBmcm9tICcuL2ltYWdlUmVzb3VyY2VzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHNkV3JpdGVyIHtcclxuXHRvZmZzZXQ6IG51bWJlcjtcclxuXHRidWZmZXI6IEFycmF5QnVmZmVyO1xyXG5cdHZpZXc6IERhdGFWaWV3O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlV3JpdGVyKHNpemUgPSA0MDk2KTogUHNkV3JpdGVyIHtcclxuXHRjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoc2l6ZSk7XHJcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xyXG5cdGNvbnN0IG9mZnNldCA9IDA7XHJcblx0cmV0dXJuIHsgYnVmZmVyLCB2aWV3LCBvZmZzZXQgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFdyaXRlckJ1ZmZlcih3cml0ZXI6IFBzZFdyaXRlcikge1xyXG5cdHJldHVybiB3cml0ZXIuYnVmZmVyLnNsaWNlKDAsIHdyaXRlci5vZmZzZXQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V3JpdGVyQnVmZmVyTm9Db3B5KHdyaXRlcjogUHNkV3JpdGVyKSB7XHJcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIsIDAsIHdyaXRlci5vZmZzZXQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50OCh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAxKTtcclxuXHR3cml0ZXIudmlldy5zZXRVaW50OChvZmZzZXQsIHZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlSW50MTYod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMik7XHJcblx0d3JpdGVyLnZpZXcuc2V0SW50MTYob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50MTYod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMik7XHJcblx0d3JpdGVyLnZpZXcuc2V0VWludDE2KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlSW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XHJcblx0d3JpdGVyLnZpZXcuc2V0SW50MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVaW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XHJcblx0d3JpdGVyLnZpZXcuc2V0VWludDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRmxvYXQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcclxuXHR3cml0ZXIudmlldy5zZXRGbG9hdDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRmxvYXQ2NCh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA4KTtcclxuXHR3cml0ZXIudmlldy5zZXRGbG9hdDY0KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciAxNi4xNlxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGaXhlZFBvaW50MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUgKiAoMSA8PCAxNikpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDguMjRcclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZSAqICgxIDw8IDI0KSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUJ5dGVzKHdyaXRlcjogUHNkV3JpdGVyLCBidWZmZXI6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQpIHtcclxuXHRpZiAoYnVmZmVyKSB7XHJcblx0XHRlbnN1cmVTaXplKHdyaXRlciwgd3JpdGVyLm9mZnNldCArIGJ1ZmZlci5sZW5ndGgpO1xyXG5cdFx0Y29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSh3cml0ZXIuYnVmZmVyKTtcclxuXHRcdGJ5dGVzLnNldChidWZmZXIsIHdyaXRlci5vZmZzZXQpO1xyXG5cdFx0d3JpdGVyLm9mZnNldCArPSBidWZmZXIubGVuZ3RoO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlWmVyb3Mod3JpdGVyOiBQc2RXcml0ZXIsIGNvdW50OiBudW1iZXIpIHtcclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVNpZ25hdHVyZSh3cml0ZXI6IFBzZFdyaXRlciwgc2lnbmF0dXJlOiBzdHJpbmcpIHtcclxuXHRpZiAoc2lnbmF0dXJlLmxlbmd0aCAhPT0gNCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c2lnbmF0dXJlfSdgKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBzaWduYXR1cmUuY2hhckNvZGVBdChpKSk7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZywgcGFkVG86IG51bWJlcikge1xyXG5cdGxldCBsZW5ndGggPSB0ZXh0Lmxlbmd0aDtcclxuXHR3cml0ZVVpbnQ4KHdyaXRlciwgbGVuZ3RoKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG5cdFx0Y29uc3QgY29kZSA9IHRleHQuY2hhckNvZGVBdChpKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBjb2RlIDwgMTI4ID8gY29kZSA6ICc/Jy5jaGFyQ29kZUF0KDApKTtcclxuXHR9XHJcblxyXG5cdHdoaWxlICgrK2xlbmd0aCAlIHBhZFRvKSB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVbmljb2RlU3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcpIHtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHRleHQubGVuZ3RoKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHRleHQuY2hhckNvZGVBdChpKSk7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZykge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgdGV4dC5sZW5ndGggKyAxKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHRleHQuY2hhckNvZGVBdChpKSk7XHJcblx0fVxyXG5cclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMYXJnZXN0TGF5ZXJTaXplKGxheWVyczogTGF5ZXJbXSA9IFtdKTogbnVtYmVyIHtcclxuXHRsZXQgbWF4ID0gMDtcclxuXHJcblx0Zm9yIChjb25zdCBsYXllciBvZiBsYXllcnMpIHtcclxuXHRcdGlmIChsYXllci5jYW52YXMgfHwgbGF5ZXIuaW1hZ2VEYXRhKSB7XHJcblx0XHRcdGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKGxheWVyKTtcclxuXHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCAyICogaGVpZ2h0ICsgMiAqIHdpZHRoICogaGVpZ2h0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAobGF5ZXIuY2hpbGRyZW4pIHtcclxuXHRcdFx0bWF4ID0gTWF0aC5tYXgobWF4LCBnZXRMYXJnZXN0TGF5ZXJTaXplKGxheWVyLmNoaWxkcmVuKSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gbWF4O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVTZWN0aW9uKHdyaXRlcjogUHNkV3JpdGVyLCByb3VuZDogbnVtYmVyLCBmdW5jOiAoKSA9PiB2b2lkLCB3cml0ZVRvdGFsTGVuZ3RoID0gZmFsc2UsIGxhcmdlID0gZmFsc2UpIHtcclxuXHRpZiAobGFyZ2UpIHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblxyXG5cdGNvbnN0IG9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHJcblx0ZnVuYygpO1xyXG5cclxuXHRsZXQgbGVuZ3RoID0gd3JpdGVyLm9mZnNldCAtIG9mZnNldCAtIDQ7XHJcblx0bGV0IGxlbiA9IGxlbmd0aDtcclxuXHJcblx0d2hpbGUgKChsZW4gJSByb3VuZCkgIT09IDApIHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHRcdGxlbisrO1xyXG5cdH1cclxuXHJcblx0aWYgKHdyaXRlVG90YWxMZW5ndGgpIHtcclxuXHRcdGxlbmd0aCA9IGxlbjtcclxuXHR9XHJcblxyXG5cdHdyaXRlci52aWV3LnNldFVpbnQzMihvZmZzZXQsIGxlbmd0aCwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVQc2Qod3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkLCBvcHRpb25zOiBXcml0ZU9wdGlvbnMgPSB7fSkge1xyXG5cdGlmICghKCtwc2Qud2lkdGggPiAwICYmICtwc2QuaGVpZ2h0ID4gMCkpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZG9jdW1lbnQgc2l6ZScpO1xyXG5cclxuXHRpZiAoKHBzZC53aWR0aCA+IDMwMDAwIHx8IHBzZC5oZWlnaHQgPiAzMDAwMCkgJiYgIW9wdGlvbnMucHNiKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBzaXplIGlzIHRvbyBsYXJnZSAobWF4IGlzIDMwMDAweDMwMDAwLCB1c2UgUFNCIGZvcm1hdCBpbnN0ZWFkKScpO1xyXG5cclxuXHRsZXQgaW1hZ2VSZXNvdXJjZXMgPSBwc2QuaW1hZ2VSZXNvdXJjZXMgfHwge307XHJcblxyXG5cdGNvbnN0IG9wdDogRXh0ZW5kZWRXcml0ZU9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIGxheWVySWRzOiBbXSB9O1xyXG5cclxuXHRpZiAob3B0LmdlbmVyYXRlVGh1bWJuYWlsKSB7XHJcblx0XHRpbWFnZVJlc291cmNlcyA9IHsgLi4uaW1hZ2VSZXNvdXJjZXMsIHRodW1ibmFpbDogY3JlYXRlVGh1bWJuYWlsKHBzZCkgfTtcclxuXHR9XHJcblxyXG5cdGxldCBpbWFnZURhdGEgPSBwc2QuaW1hZ2VEYXRhO1xyXG5cclxuXHRpZiAoIWltYWdlRGF0YSAmJiBwc2QuY2FudmFzKSB7XHJcblx0XHRpbWFnZURhdGEgPSBwc2QuY2FudmFzLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCBwc2QuY2FudmFzLndpZHRoLCBwc2QuY2FudmFzLmhlaWdodCk7XHJcblx0fVxyXG5cclxuXHRpZiAoaW1hZ2VEYXRhICYmIChwc2Qud2lkdGggIT09IGltYWdlRGF0YS53aWR0aCB8fCBwc2QuaGVpZ2h0ICE9PSBpbWFnZURhdGEuaGVpZ2h0KSlcclxuXHRcdHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgY2FudmFzIG11c3QgaGF2ZSB0aGUgc2FtZSBzaXplIGFzIGRvY3VtZW50Jyk7XHJcblxyXG5cdGNvbnN0IGdsb2JhbEFscGhhID0gISFpbWFnZURhdGEgJiYgaGFzQWxwaGEoaW1hZ2VEYXRhKTtcclxuXHRjb25zdCBtYXhCdWZmZXJTaXplID0gTWF0aC5tYXgoZ2V0TGFyZ2VzdExheWVyU2l6ZShwc2QuY2hpbGRyZW4pLCA0ICogMiAqIHBzZC53aWR0aCAqIHBzZC5oZWlnaHQgKyAyICogcHNkLmhlaWdodCk7XHJcblx0Y29uc3QgdGVtcEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG1heEJ1ZmZlclNpemUpO1xyXG5cclxuXHQvLyBoZWFkZXJcclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QlBTJyk7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBvcHRpb25zLnBzYiA/IDIgOiAxKTsgLy8gdmVyc2lvblxyXG5cdHdyaXRlWmVyb3Mod3JpdGVyLCA2KTtcclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIGdsb2JhbEFscGhhID8gNCA6IDMpOyAvLyBjaGFubmVsc1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgcHNkLmhlaWdodCk7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBwc2Qud2lkdGgpO1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgOCk7IC8vIGJpdHMgcGVyIGNoYW5uZWxcclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yTW9kZS5SR0IpOyAvLyB3ZSBvbmx5IHN1cHBvcnQgc2F2aW5nIFJHQiByaWdodCBub3dcclxuXHJcblx0Ly8gY29sb3IgbW9kZSBkYXRhXHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0Ly8gVE9ETzogaW1wbGVtZW50XHJcblx0fSk7XHJcblxyXG5cdC8vIGltYWdlIHJlc291cmNlc1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdGZvciAoY29uc3QgaGFuZGxlciBvZiByZXNvdXJjZUhhbmRsZXJzKSB7XHJcblx0XHRcdGlmIChoYW5kbGVyLmhhcyhpbWFnZVJlc291cmNlcykpIHtcclxuXHRcdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBoYW5kbGVyLmtleSk7XHJcblx0XHRcdFx0d3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyLCAnJywgMik7XHJcblx0XHRcdFx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4gaGFuZGxlci53cml0ZSh3cml0ZXIsIGltYWdlUmVzb3VyY2VzKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0Ly8gbGF5ZXIgYW5kIG1hc2sgaW5mb1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDIsICgpID0+IHtcclxuXHRcdHdyaXRlTGF5ZXJJbmZvKHRlbXBCdWZmZXIsIHdyaXRlciwgcHNkLCBnbG9iYWxBbHBoYSwgb3B0KTtcclxuXHRcdHdyaXRlR2xvYmFsTGF5ZXJNYXNrSW5mbyh3cml0ZXIsIHBzZC5nbG9iYWxMYXllck1hc2tJbmZvKTtcclxuXHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIHBzZCwgcHNkLCBvcHQpO1xyXG5cdH0sIHVuZGVmaW5lZCwgISFvcHQucHNiKTtcclxuXHJcblx0Ly8gaW1hZ2UgZGF0YVxyXG5cdGNvbnN0IGNoYW5uZWxzID0gZ2xvYmFsQWxwaGEgPyBbMCwgMSwgMiwgM10gOiBbMCwgMSwgMl07XHJcblx0Y29uc3QgZGF0YTogUGl4ZWxEYXRhID0gaW1hZ2VEYXRhIHx8IHtcclxuXHRcdGRhdGE6IG5ldyBVaW50OEFycmF5KDQgKiBwc2Qud2lkdGggKiBwc2QuaGVpZ2h0KSxcclxuXHRcdHdpZHRoOiBwc2Qud2lkdGgsXHJcblx0XHRoZWlnaHQ6IHBzZC5oZWlnaHQsXHJcblx0fTtcclxuXHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkKTtcclxuXHJcblx0aWYgKFJBV19JTUFHRV9EQVRBICYmIChwc2QgYXMgYW55KS5pbWFnZURhdGFSYXcpIHtcclxuXHRcdGNvbnNvbGUubG9nKCd3cml0aW5nIHJhdyBpbWFnZSBkYXRhJyk7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdyk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgZGF0YSwgcHNkLndpZHRoLCBwc2QuaGVpZ2h0LCBjaGFubmVscywgISFvcHRpb25zLnBzYikpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMYXllckluZm8odGVtcEJ1ZmZlcjogVWludDhBcnJheSwgd3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkLCBnbG9iYWxBbHBoYTogYm9vbGVhbiwgb3B0aW9uczogRXh0ZW5kZWRXcml0ZU9wdGlvbnMpIHtcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCA0LCAoKSA9PiB7XHJcblx0XHRjb25zdCBsYXllcnM6IExheWVyW10gPSBbXTtcclxuXHJcblx0XHRhZGRDaGlsZHJlbihsYXllcnMsIHBzZC5jaGlsZHJlbik7XHJcblxyXG5cdFx0aWYgKCFsYXllcnMubGVuZ3RoKSBsYXllcnMucHVzaCh7fSk7XHJcblxyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIGdsb2JhbEFscGhhID8gLWxheWVycy5sZW5ndGggOiBsYXllcnMubGVuZ3RoKTtcclxuXHJcblx0XHRjb25zdCBsYXllcnNEYXRhID0gbGF5ZXJzLm1hcCgobCwgaSkgPT4gZ2V0Q2hhbm5lbHModGVtcEJ1ZmZlciwgbCwgaSA9PT0gMCwgb3B0aW9ucykpO1xyXG5cclxuXHRcdC8vIGxheWVyIHJlY29yZHNcclxuXHRcdGZvciAoY29uc3QgbGF5ZXJEYXRhIG9mIGxheWVyc0RhdGEpIHtcclxuXHRcdFx0Y29uc3QgeyBsYXllciwgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0LCBjaGFubmVscyB9ID0gbGF5ZXJEYXRhO1xyXG5cclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHRvcCk7XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCBsZWZ0KTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGJvdHRvbSk7XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCByaWdodCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbHMubGVuZ3RoKTtcclxuXHJcblx0XHRcdGZvciAoY29uc3QgYyBvZiBjaGFubmVscykge1xyXG5cdFx0XHRcdHdyaXRlSW50MTYod3JpdGVyLCBjLmNoYW5uZWxJZCk7XHJcblx0XHRcdFx0aWYgKG9wdGlvbnMucHNiKSB3cml0ZVVpbnQzMih3cml0ZXIsIDApO1xyXG5cdFx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgYy5sZW5ndGgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgZnJvbUJsZW5kTW9kZVtsYXllci5ibGVuZE1vZGUhXSB8fCAnbm9ybScpO1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChjbGFtcChsYXllci5vcGFjaXR5ID8/IDEsIDAsIDEpICogMjU1KSk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBsYXllci5jbGlwcGluZyA/IDEgOiAwKTtcclxuXHJcblx0XHRcdGxldCBmbGFncyA9IDB4MDg7IC8vIDEgZm9yIFBob3Rvc2hvcCA1LjAgYW5kIGxhdGVyLCB0ZWxscyBpZiBiaXQgNCBoYXMgdXNlZnVsIGluZm9ybWF0aW9uXHJcblx0XHRcdGlmIChsYXllci50cmFuc3BhcmVuY3lQcm90ZWN0ZWQpIGZsYWdzIHw9IDB4MDE7XHJcblx0XHRcdGlmIChsYXllci5oaWRkZW4pIGZsYWdzIHw9IDB4MDI7XHJcblx0XHRcdGlmIChsYXllci52ZWN0b3JNYXNrIHx8IChsYXllci5zZWN0aW9uRGl2aWRlciAmJiBsYXllci5zZWN0aW9uRGl2aWRlci50eXBlICE9PSBTZWN0aW9uRGl2aWRlclR5cGUuT3RoZXIpKSB7XHJcblx0XHRcdFx0ZmxhZ3MgfD0gMHgxMDsgLy8gcGl4ZWwgZGF0YSBpcnJlbGV2YW50IHRvIGFwcGVhcmFuY2Ugb2YgZG9jdW1lbnRcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAobGF5ZXIuZWZmZWN0cyAmJiBoYXNNdWx0aUVmZmVjdHMobGF5ZXIuZWZmZWN0cykpIHtcclxuXHRcdFx0XHRmbGFncyB8PSAweDIwOyAvLyBqdXN0IGd1ZXNzaW5nIHRoaXMgb25lLCBtaWdodCBiZSBjb21wbGV0ZWx5IGluY29ycmVjdFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7IC8vIGZpbGxlclxyXG5cdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHRcdFx0d3JpdGVMYXllck1hc2tEYXRhKHdyaXRlciwgbGF5ZXIsIGxheWVyRGF0YSk7XHJcblx0XHRcdFx0d3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlciwgcHNkKTtcclxuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGxheWVyLm5hbWUgfHwgJycsIDQpO1xyXG5cdFx0XHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBsYXllciBjaGFubmVsIGltYWdlIGRhdGFcclxuXHRcdGZvciAoY29uc3QgbGF5ZXJEYXRhIG9mIGxheWVyc0RhdGEpIHtcclxuXHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGxheWVyRGF0YS5jaGFubmVscykge1xyXG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbC5jb21wcmVzc2lvbik7XHJcblxyXG5cdFx0XHRcdGlmIChjaGFubmVsLmJ1ZmZlcikge1xyXG5cdFx0XHRcdFx0d3JpdGVCeXRlcyh3cml0ZXIsIGNoYW5uZWwuYnVmZmVyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB0cnVlLCBvcHRpb25zLnBzYik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTGF5ZXJNYXNrRGF0YSh3cml0ZXI6IFBzZFdyaXRlciwgeyBtYXNrIH06IExheWVyLCBsYXllckRhdGE6IExheWVyQ2hhbm5lbERhdGEpIHtcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHRpZiAoIW1hc2spIHJldHVybjtcclxuXHJcblx0XHRjb25zdCBtID0gbGF5ZXJEYXRhLm1hc2sgfHwge30gYXMgUGFydGlhbDxCb3VuZHM+O1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0udG9wISk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5sZWZ0ISk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5ib3R0b20hKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLnJpZ2h0ISk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbWFzay5kZWZhdWx0Q29sb3IhKTtcclxuXHJcblx0XHRsZXQgcGFyYW1zID0gMDtcclxuXHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5Vc2VyTWFza0RlbnNpdHk7XHJcblx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyO1xyXG5cdFx0aWYgKG1hc2sudmVjdG9yTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVmVjdG9yTWFza0RlbnNpdHk7XHJcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRmVhdGhlcjtcclxuXHJcblx0XHRsZXQgZmxhZ3MgPSAwO1xyXG5cdFx0aWYgKG1hc2suZGlzYWJsZWQpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Rpc2FibGVkO1xyXG5cdFx0aWYgKG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyO1xyXG5cdFx0aWYgKG1hc2suZnJvbVZlY3RvckRhdGEpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Zyb21SZW5kZXJpbmdPdGhlckRhdGE7XHJcblx0XHRpZiAocGFyYW1zKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5NYXNrSGFzUGFyYW1ldGVyc0FwcGxpZWRUb0l0O1xyXG5cclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncyk7XHJcblxyXG5cdFx0aWYgKHBhcmFtcykge1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgcGFyYW1zKTtcclxuXHJcblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnVzZXJNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcclxuXHRcdFx0aWYgKG1hc2sudXNlck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHdyaXRlRmxvYXQ2NCh3cml0ZXIsIG1hc2sudXNlck1hc2tGZWF0aGVyKTtcclxuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgd3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcclxuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay52ZWN0b3JNYXNrRmVhdGhlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVE9ETzogaGFuZGxlIHJlc3Qgb2YgdGhlIGZpZWxkc1xyXG5cclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblxyXG5cdFx0bGV0IGNoYW5uZWxzID0gcHNkLmNoYW5uZWxzIHx8IDA7IC8vIFRPRE86IHVzZSBhbHdheXMgNCBpbnN0ZWFkID9cclxuXHRcdC8vIGNoYW5uZWxzID0gNDsgLy8gVEVTVElOR1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHM7IGkrKykge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlR2xvYmFsTGF5ZXJNYXNrSW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgaW5mbzogR2xvYmFsTGF5ZXJNYXNrSW5mbyB8IHVuZGVmaW5lZCkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdGlmIChpbmZvKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vdmVybGF5Q29sb3JTcGFjZSk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMSk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMik7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMyk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlNCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vcGFjaXR5ICogMHhmZik7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLmtpbmQpO1xyXG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvLCBwc2Q6IFBzZCwgb3B0aW9uczogRXh0ZW5kZWRXcml0ZU9wdGlvbnMpIHtcclxuXHRmb3IgKGNvbnN0IGhhbmRsZXIgb2YgaW5mb0hhbmRsZXJzKSB7XHJcblx0XHRsZXQga2V5ID0gaGFuZGxlci5rZXk7XHJcblxyXG5cdFx0aWYgKGtleSA9PT0gJ1R4dDInICYmIG9wdGlvbnMuaW52YWxpZGF0ZVRleHRMYXllcnMpIGNvbnRpbnVlO1xyXG5cdFx0aWYgKGtleSA9PT0gJ3Ztc2snICYmIG9wdGlvbnMucHNiKSBrZXkgPSAndnNtcyc7XHJcblxyXG5cdFx0aWYgKGhhbmRsZXIuaGFzKHRhcmdldCkpIHtcclxuXHRcdFx0Y29uc3QgbGFyZ2UgPSBvcHRpb25zLnBzYiAmJiBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cy5pbmRleE9mKGtleSkgIT09IC0xO1xyXG5cclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBsYXJnZSA/ICc4QjY0JyA6ICc4QklNJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwga2V5KTtcclxuXHJcblx0XHRcdGNvbnN0IGZvdXJCeXRlcyA9IGtleSA9PT0gJ1R4dDInIHx8IGtleSA9PT0gJ2x1bmknIHx8IGtleSA9PT0gJ3Ztc2snIHx8IGtleSA9PT0gJ2FydGInIHx8IGtleSA9PT0gJ2FydGQnIHx8XHJcblx0XHRcdFx0a2V5ID09PSAndm9naycgfHwga2V5ID09PSAnU29MZCcgfHwga2V5ID09PSAnbG5rMicgfHwga2V5ID09PSAndnNjZycgfHwga2V5ID09PSAndnNtcycgfHwga2V5ID09PSAnR2RGbCcgfHxcclxuXHRcdFx0XHRrZXkgPT09ICdsbWZ4JyB8fCBrZXkgPT09ICdsckZYJyB8fCBrZXkgPT09ICdjaW5mJyB8fCBrZXkgPT09ICdQbExkJyB8fCBrZXkgPT09ICdBbm5vJztcclxuXHJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIGZvdXJCeXRlcyA/IDQgOiAyLCAoKSA9PiB7XHJcblx0XHRcdFx0aGFuZGxlci53cml0ZSh3cml0ZXIsIHRhcmdldCwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0fSwga2V5ICE9PSAnVHh0MicgJiYga2V5ICE9PSAnY2luZicgJiYga2V5ICE9PSAnZXh0bicsIGxhcmdlKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZENoaWxkcmVuKGxheWVyczogTGF5ZXJbXSwgY2hpbGRyZW46IExheWVyW10gfCB1bmRlZmluZWQpIHtcclxuXHRpZiAoIWNoaWxkcmVuKSByZXR1cm47XHJcblxyXG5cdGZvciAoY29uc3QgYyBvZiBjaGlsZHJlbikge1xyXG5cdFx0aWYgKGMuY2hpbGRyZW4gJiYgYy5jYW52YXMpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnY2FudmFzJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XHJcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmltYWdlRGF0YSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxheWVyLCBjYW5ub3QgaGF2ZSBib3RoICdpbWFnZURhdGEnIGFuZCAnY2hpbGRyZW4nIHByb3BlcnRpZXNgKTtcclxuXHJcblx0XHRpZiAoYy5jaGlsZHJlbikge1xyXG5cdFx0XHRsYXllcnMucHVzaCh7XHJcblx0XHRcdFx0bmFtZTogJzwvTGF5ZXIgZ3JvdXA+JyxcclxuXHRcdFx0XHRzZWN0aW9uRGl2aWRlcjoge1xyXG5cdFx0XHRcdFx0dHlwZTogU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvLyBURVNUSU5HXHJcblx0XHRcdFx0Ly8gbmFtZVNvdXJjZTogJ2xzZXQnLFxyXG5cdFx0XHRcdC8vIGlkOiBbNCwgMCwgMCwgOCwgMTEsIDAsIDAsIDAsIDAsIDE0XVtsYXllcnMubGVuZ3RoXSB8fCAwLFxyXG5cdFx0XHRcdC8vIGxheWVyQ29sb3I6ICdub25lJyxcclxuXHRcdFx0XHQvLyB0aW1lc3RhbXA6IFsxNjExMzQ2ODE3LjM0OTAyMSwgMCwgMCwgMTYxMTM0NjgxNy4zNDkxNzUsIDE2MTEzNDY4MTcuMzQ5MTgzMywgMCwgMCwgMCwgMCwgMTYxMTM0NjgxNy4zNDk4MzJdW2xheWVycy5sZW5ndGhdIHx8IDAsXHJcblx0XHRcdFx0Ly8gcHJvdGVjdGVkOiB7fSxcclxuXHRcdFx0XHQvLyByZWZlcmVuY2VQb2ludDogeyB4OiAwLCB5OiAwIH0sXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRhZGRDaGlsZHJlbihsYXllcnMsIGMuY2hpbGRyZW4pO1xyXG5cdFx0XHRsYXllcnMucHVzaCh7XHJcblx0XHRcdFx0c2VjdGlvbkRpdmlkZXI6IHtcclxuXHRcdFx0XHRcdHR5cGU6IGMub3BlbmVkID09PSBmYWxzZSA/IFNlY3Rpb25EaXZpZGVyVHlwZS5DbG9zZWRGb2xkZXIgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcixcclxuXHRcdFx0XHRcdGtleTogZnJvbUJsZW5kTW9kZVtjLmJsZW5kTW9kZSFdIHx8ICdwYXNzJyxcclxuXHRcdFx0XHRcdHN1YlR5cGU6IDAsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQuLi5jLFxyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxheWVycy5wdXNoKHsgLi4uYyB9KTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlc2l6ZUJ1ZmZlcih3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0bGV0IG5ld0xlbmd0aCA9IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aDtcclxuXHJcblx0ZG8ge1xyXG5cdFx0bmV3TGVuZ3RoICo9IDI7XHJcblx0fSB3aGlsZSAoc2l6ZSA+IG5ld0xlbmd0aCk7XHJcblxyXG5cdGNvbnN0IG5ld0J1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihuZXdMZW5ndGgpO1xyXG5cdGNvbnN0IG5ld0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkobmV3QnVmZmVyKTtcclxuXHRjb25zdCBvbGRCeXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xyXG5cdG5ld0J5dGVzLnNldChvbGRCeXRlcyk7XHJcblx0d3JpdGVyLmJ1ZmZlciA9IG5ld0J1ZmZlcjtcclxuXHR3cml0ZXIudmlldyA9IG5ldyBEYXRhVmlldyh3cml0ZXIuYnVmZmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW5zdXJlU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0aWYgKHNpemUgPiB3cml0ZXIuYnVmZmVyLmJ5dGVMZW5ndGgpIHtcclxuXHRcdHJlc2l6ZUJ1ZmZlcih3cml0ZXIsIHNpemUpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHRlbnN1cmVTaXplKHdyaXRlciwgd3JpdGVyLm9mZnNldCArPSBzaXplKTtcclxuXHRyZXR1cm4gb2Zmc2V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVUaHVtYm5haWwocHNkOiBQc2QpIHtcclxuXHRjb25zdCBjYW52YXMgPSBjcmVhdGVDYW52YXMoMTAsIDEwKTtcclxuXHRsZXQgc2NhbGUgPSAxO1xyXG5cclxuXHRpZiAocHNkLndpZHRoID4gcHNkLmhlaWdodCkge1xyXG5cdFx0Y2FudmFzLndpZHRoID0gMTYwO1xyXG5cdFx0Y2FudmFzLmhlaWdodCA9IE1hdGguZmxvb3IocHNkLmhlaWdodCAqIChjYW52YXMud2lkdGggLyBwc2Qud2lkdGgpKTtcclxuXHRcdHNjYWxlID0gY2FudmFzLndpZHRoIC8gcHNkLndpZHRoO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRjYW52YXMuaGVpZ2h0ID0gMTYwO1xyXG5cdFx0Y2FudmFzLndpZHRoID0gTWF0aC5mbG9vcihwc2Qud2lkdGggKiAoY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQpKTtcclxuXHRcdHNjYWxlID0gY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQ7XHJcblx0fVxyXG5cclxuXHRjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykhO1xyXG5cdGNvbnRleHQuc2NhbGUoc2NhbGUsIHNjYWxlKTtcclxuXHJcblx0aWYgKHBzZC5pbWFnZURhdGEpIHtcclxuXHRcdGNvbnN0IHRlbXAgPSBjcmVhdGVDYW52YXMocHNkLmltYWdlRGF0YS53aWR0aCwgcHNkLmltYWdlRGF0YS5oZWlnaHQpO1xyXG5cdFx0dGVtcC5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEocHNkLmltYWdlRGF0YSwgMCwgMCk7XHJcblx0XHRjb250ZXh0LmRyYXdJbWFnZSh0ZW1wLCAwLCAwKTtcclxuXHR9IGVsc2UgaWYgKHBzZC5jYW52YXMpIHtcclxuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHBzZC5jYW52YXMsIDAsIDApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGNhbnZhcztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q2hhbm5lbHMoXHJcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcclxuKTogTGF5ZXJDaGFubmVsRGF0YSB7XHJcblx0Y29uc3QgbGF5ZXJEYXRhID0gZ2V0TGF5ZXJDaGFubmVscyh0ZW1wQnVmZmVyLCBsYXllciwgYmFja2dyb3VuZCwgb3B0aW9ucyk7XHJcblx0Y29uc3QgbWFzayA9IGxheWVyLm1hc2s7XHJcblxyXG5cdGlmIChtYXNrKSB7XHJcblx0XHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBtYXNrO1xyXG5cdFx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKG1hc2spO1xyXG5cdFx0bGV0IGltYWdlRGF0YSA9IG1hc2suaW1hZ2VEYXRhO1xyXG5cclxuXHRcdGlmICghaW1hZ2VEYXRhICYmIG1hc2suY2FudmFzICYmIHdpZHRoICYmIGhlaWdodCkge1xyXG5cdFx0XHRpbWFnZURhdGEgPSBtYXNrLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHdpZHRoICYmIGhlaWdodCAmJiBpbWFnZURhdGEpIHtcclxuXHRcdFx0cmlnaHQgPSBsZWZ0ICsgd2lkdGg7XHJcblx0XHRcdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcclxuXHJcblx0XHRcdGxldCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgaW1hZ2VEYXRhLCB3aWR0aCwgaGVpZ2h0LCBbMF0sICEhb3B0aW9ucy5wc2IpITtcclxuXHJcblx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdykge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCd3cml0dGVuIHJhdyBsYXllciBpbWFnZSBkYXRhJyk7XHJcblx0XHRcdFx0YnVmZmVyID0gKGxheWVyIGFzIGFueSkubWFza0RhdGFSYXc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxheWVyRGF0YS5tYXNrID0geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcclxuXHRcdFx0bGF5ZXJEYXRhLmNoYW5uZWxzLnB1c2goe1xyXG5cdFx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlVzZXJNYXNrLFxyXG5cdFx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxyXG5cdFx0XHRcdGJ1ZmZlcjogYnVmZmVyLFxyXG5cdFx0XHRcdGxlbmd0aDogMiArIGJ1ZmZlci5sZW5ndGgsXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXJEYXRhLm1hc2sgPSB7IHRvcDogMCwgbGVmdDogMCwgcmlnaHQ6IDAsIGJvdHRvbTogMCB9O1xyXG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XHJcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXHJcblx0XHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsXHJcblx0XHRcdFx0YnVmZmVyOiBuZXcgVWludDhBcnJheSgwKSxcclxuXHRcdFx0XHRsZW5ndGg6IDAsXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGxheWVyRGF0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGF5ZXJEaW1lbnRpb25zKHsgY2FudmFzLCBpbWFnZURhdGEgfTogTGF5ZXIpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyB9IHtcclxuXHRyZXR1cm4gaW1hZ2VEYXRhIHx8IGNhbnZhcyB8fCB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JvcEltYWdlRGF0YShkYXRhOiBJbWFnZURhdGEsIGxlZnQ6IG51bWJlciwgdG9wOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XHJcblx0Y29uc3QgY3JvcHBlZERhdGEgPSBjcmVhdGVJbWFnZURhdGEod2lkdGgsIGhlaWdodCk7XHJcblx0Y29uc3Qgc3JjRGF0YSA9IGRhdGEuZGF0YTtcclxuXHRjb25zdCBkc3REYXRhID0gY3JvcHBlZERhdGEuZGF0YTtcclxuXHJcblx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xyXG5cdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XHJcblx0XHRcdGxldCBzcmMgPSAoKHggKyBsZWZ0KSArICh5ICsgdG9wKSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdGxldCBkc3QgPSAoeCArIHkgKiB3aWR0aCkgKiA0O1xyXG5cdFx0XHRkc3REYXRhW2RzdF0gPSBzcmNEYXRhW3NyY107XHJcblx0XHRcdGRzdERhdGFbZHN0ICsgMV0gPSBzcmNEYXRhW3NyYyArIDFdO1xyXG5cdFx0XHRkc3REYXRhW2RzdCArIDJdID0gc3JjRGF0YVtzcmMgKyAyXTtcclxuXHRcdFx0ZHN0RGF0YVtkc3QgKyAzXSA9IHNyY0RhdGFbc3JjICsgM107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY3JvcHBlZERhdGE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExheWVyQ2hhbm5lbHMoXHJcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcclxuKTogTGF5ZXJDaGFubmVsRGF0YSB7XHJcblx0bGV0IHsgdG9wID0gMCwgbGVmdCA9IDAsIHJpZ2h0ID0gMCwgYm90dG9tID0gMCB9ID0gbGF5ZXI7XHJcblx0bGV0IGNoYW5uZWxzOiBDaGFubmVsRGF0YVtdID0gW1xyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5UcmFuc3BhcmVuY3ksIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELkNvbG9yMCwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRcdHsgY2hhbm5lbElkOiBDaGFubmVsSUQuQ29sb3IxLCBjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSwgYnVmZmVyOiB1bmRlZmluZWQsIGxlbmd0aDogMiB9LFxyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5Db2xvcjIsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XTtcclxuXHJcblx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKGxheWVyKTtcclxuXHJcblx0aWYgKCEobGF5ZXIuY2FudmFzIHx8IGxheWVyLmltYWdlRGF0YSkgfHwgIXdpZHRoIHx8ICFoZWlnaHQpIHtcclxuXHRcdHJpZ2h0ID0gbGVmdDtcclxuXHRcdGJvdHRvbSA9IHRvcDtcclxuXHRcdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XHJcblx0fVxyXG5cclxuXHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcclxuXHRib3R0b20gPSB0b3AgKyBoZWlnaHQ7XHJcblxyXG5cdGxldCBkYXRhID0gbGF5ZXIuaW1hZ2VEYXRhIHx8IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuXHRpZiAob3B0aW9ucy50cmltSW1hZ2VEYXRhKSB7XHJcblx0XHRjb25zdCB0cmltbWVkID0gdHJpbURhdGEoZGF0YSk7XHJcblxyXG5cdFx0aWYgKHRyaW1tZWQubGVmdCAhPT0gMCB8fCB0cmltbWVkLnRvcCAhPT0gMCB8fCB0cmltbWVkLnJpZ2h0ICE9PSBkYXRhLndpZHRoIHx8IHRyaW1tZWQuYm90dG9tICE9PSBkYXRhLmhlaWdodCkge1xyXG5cdFx0XHRsZWZ0ICs9IHRyaW1tZWQubGVmdDtcclxuXHRcdFx0dG9wICs9IHRyaW1tZWQudG9wO1xyXG5cdFx0XHRyaWdodCAtPSAoZGF0YS53aWR0aCAtIHRyaW1tZWQucmlnaHQpO1xyXG5cdFx0XHRib3R0b20gLT0gKGRhdGEuaGVpZ2h0IC0gdHJpbW1lZC5ib3R0b20pO1xyXG5cdFx0XHR3aWR0aCA9IHJpZ2h0IC0gbGVmdDtcclxuXHRcdFx0aGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xyXG5cclxuXHRcdFx0aWYgKCF3aWR0aCB8fCAhaGVpZ2h0KSB7XHJcblx0XHRcdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGxheWVyLmltYWdlRGF0YSkge1xyXG5cdFx0XHRcdGRhdGEgPSBjcm9wSW1hZ2VEYXRhKGRhdGEsIHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGEgPSBsYXllci5jYW52YXMhLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSh0cmltbWVkLmxlZnQsIHRyaW1tZWQudG9wLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y29uc3QgY2hhbm5lbElkcyA9IFtcclxuXHRcdENoYW5uZWxJRC5Db2xvcjAsXHJcblx0XHRDaGFubmVsSUQuQ29sb3IxLFxyXG5cdFx0Q2hhbm5lbElELkNvbG9yMixcclxuXHRdO1xyXG5cclxuXHRpZiAoIWJhY2tncm91bmQgfHwgb3B0aW9ucy5ub0JhY2tncm91bmQgfHwgbGF5ZXIubWFzayB8fCBoYXNBbHBoYShkYXRhKSB8fCAoUkFXX0lNQUdFX0RBVEEgJiYgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3Py5bJy0xJ10pKSB7XHJcblx0XHRjaGFubmVsSWRzLnVuc2hpZnQoQ2hhbm5lbElELlRyYW5zcGFyZW5jeSk7XHJcblx0fVxyXG5cclxuXHRjaGFubmVscyA9IGNoYW5uZWxJZHMubWFwKGNoYW5uZWwgPT4ge1xyXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsLCBmYWxzZSk7IC8vIFRPRE86IHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5DTVlLKTtcclxuXHRcdGxldCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgZGF0YSwgd2lkdGgsIGhlaWdodCwgW29mZnNldF0sICEhb3B0aW9ucy5wc2IpITtcclxuXHJcblx0XHRpZiAoUkFXX0lNQUdFX0RBVEEgJiYgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3KSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCd3cml0dGVuIHJhdyBsYXllciBpbWFnZSBkYXRhJyk7XHJcblx0XHRcdGJ1ZmZlciA9IChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhd1tjaGFubmVsXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRjaGFubmVsSWQ6IGNoYW5uZWwsXHJcblx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxyXG5cdFx0XHRidWZmZXI6IGJ1ZmZlcixcclxuXHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcclxuXHRcdH07XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzUm93RW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHk6IG51bWJlciwgbGVmdDogbnVtYmVyLCByaWdodDogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc3RhcnQgPSAoKHkgKiB3aWR0aCArIGxlZnQpICogNCArIDMpIHwgMDtcclxuXHRjb25zdCBlbmQgPSAoc3RhcnQgKyAocmlnaHQgLSBsZWZ0KSAqIDQpIHwgMDtcclxuXHJcblx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpID0gKGkgKyA0KSB8IDApIHtcclxuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc0NvbEVtcHR5KHsgZGF0YSwgd2lkdGggfTogUGl4ZWxEYXRhLCB4OiBudW1iZXIsIHRvcDogbnVtYmVyLCBib3R0b206IG51bWJlcikge1xyXG5cdGNvbnN0IHN0cmlkZSA9ICh3aWR0aCAqIDQpIHwgMDtcclxuXHRjb25zdCBzdGFydCA9ICh0b3AgKiBzdHJpZGUgKyB4ICogNCArIDMpIHwgMDtcclxuXHJcblx0Zm9yIChsZXQgeSA9IHRvcCwgaSA9IHN0YXJ0OyB5IDwgYm90dG9tOyB5KyssIGkgPSAoaSArIHN0cmlkZSkgfCAwKSB7XHJcblx0XHRpZiAoZGF0YVtpXSAhPT0gMCkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJpbURhdGEoZGF0YTogUGl4ZWxEYXRhKSB7XHJcblx0bGV0IHRvcCA9IDA7XHJcblx0bGV0IGxlZnQgPSAwO1xyXG5cdGxldCByaWdodCA9IGRhdGEud2lkdGg7XHJcblx0bGV0IGJvdHRvbSA9IGRhdGEuaGVpZ2h0O1xyXG5cclxuXHR3aGlsZSAodG9wIDwgYm90dG9tICYmIGlzUm93RW1wdHkoZGF0YSwgdG9wLCBsZWZ0LCByaWdodCkpXHJcblx0XHR0b3ArKztcclxuXHR3aGlsZSAoYm90dG9tID4gdG9wICYmIGlzUm93RW1wdHkoZGF0YSwgYm90dG9tIC0gMSwgbGVmdCwgcmlnaHQpKVxyXG5cdFx0Ym90dG9tLS07XHJcblx0d2hpbGUgKGxlZnQgPCByaWdodCAmJiBpc0NvbEVtcHR5KGRhdGEsIGxlZnQsIHRvcCwgYm90dG9tKSlcclxuXHRcdGxlZnQrKztcclxuXHR3aGlsZSAocmlnaHQgPiBsZWZ0ICYmIGlzQ29sRW1wdHkoZGF0YSwgcmlnaHQgLSAxLCB0b3AsIGJvdHRvbSkpXHJcblx0XHRyaWdodC0tO1xyXG5cclxuXHRyZXR1cm4geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQ29sb3Iod3JpdGVyOiBQc2RXcml0ZXIsIGNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICghY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDgpO1xyXG5cdH0gZWxzZSBpZiAoJ3InIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuUkdCKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5yICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuZyAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0fSBlbHNlIGlmICgnbCcgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5MYWIpO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubCAqIDEwMDAwKSk7XHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5hIDwgMCA/IChjb2xvci5hICogMTI4MDApIDogKGNvbG9yLmEgKiAxMjcwMCkpKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgPCAwID8gKGNvbG9yLmIgKiAxMjgwMCkgOiAoY29sb3IuYiAqIDEyNzAwKSkpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxuXHR9IGVsc2UgaWYgKCdoJyBpbiBjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkhTQik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuaCAqIDB4ZmZmZikpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnMgKiAweGZmZmYpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5iICogMHhmZmZmKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdH0gZWxzZSBpZiAoJ2MnIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuQ01ZSyk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYyAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLm0gKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci55ICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuayAqIDI1NykpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuR3JheXNjYWxlKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rICogMTAwMDAgLyAyNTUpKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA2KTtcclxuXHR9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
