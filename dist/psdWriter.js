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
            if (layer.effects && (0, additionalInfo_1.hasMultiEffects)(layer.effects)) { // TODO: this is not correct
                flags |= 0x20; // just guessing this one, might be completely incorrect
            }
            // if ('_2' in layer) flags |= 0x20; // TEMP!!!
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBzZFdyaXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUNBLHFDQUltQjtBQUNuQixtREFBdUY7QUFDdkYsbURBQW9EO0FBUXBELFNBQWdCLFlBQVksQ0FBQyxJQUFXO0lBQVgscUJBQUEsRUFBQSxXQUFXO0lBQ3ZDLElBQU0sTUFBTSxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JDLElBQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2xDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNqQixPQUFPLEVBQUUsTUFBTSxRQUFBLEVBQUUsSUFBSSxNQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBTEQsb0NBS0M7QUFFRCxTQUFnQixlQUFlLENBQUMsTUFBaUI7SUFDaEQsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzlDLENBQUM7QUFGRCwwQ0FFQztBQUVELFNBQWdCLHFCQUFxQixDQUFDLE1BQWlCO0lBQ3RELE9BQU8sSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hELENBQUM7QUFGRCxzREFFQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxNQUFpQixFQUFFLEtBQWE7SUFDMUQsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMxRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUMsQ0FBQztBQUhELGdDQUdDO0FBRUQsU0FBZ0IsV0FBVyxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUMzRCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDN0MsQ0FBQztBQUhELGtDQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDOUMsQ0FBQztBQUhELG9DQUdDO0FBRUQsU0FBZ0IsWUFBWSxDQUFDLE1BQWlCLEVBQUUsS0FBYTtJQUM1RCxJQUFNLE1BQU0s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LEtBQUssQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUMvQztTQUFNO1FBQ04sV0FBVyxDQUFDLE1BQU0sb0JBQXVCLENBQUM7UUFDMUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkQsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN0QjtBQUNGLENBQUM7QUFqQ0QsZ0NBaUNDIiwiZmlsZSI6InBzZFdyaXRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBzZCwgTGF5ZXIsIExheWVyQWRkaXRpb25hbEluZm8sIENvbG9yTW9kZSwgU2VjdGlvbkRpdmlkZXJUeXBlLCBXcml0ZU9wdGlvbnMsIENvbG9yLCBHbG9iYWxMYXllck1hc2tJbmZvIH0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdGhhc0FscGhhLCBjcmVhdGVDYW52YXMsIHdyaXRlRGF0YVJMRSwgUGl4ZWxEYXRhLCBMYXllckNoYW5uZWxEYXRhLCBDaGFubmVsRGF0YSxcclxuXHRvZmZzZXRGb3JDaGFubmVsLCBjcmVhdGVJbWFnZURhdGEsIGZyb21CbGVuZE1vZGUsIENoYW5uZWxJRCwgQ29tcHJlc3Npb24sIGNsYW1wLFxyXG5cdExheWVyTWFza0ZsYWdzLCBNYXNrUGFyYW1zLCBDb2xvclNwYWNlLCBCb3VuZHMsIGxhcmdlQWRkaXRpb25hbEluZm9LZXlzLCBSQVdfSU1BR0VfREFUQVxyXG59IGZyb20gJy4vaGVscGVycyc7XHJcbmltcG9ydCB7IEV4dGVuZGVkV3JpdGVPcHRpb25zLCBoYXNNdWx0aUVmZmVjdHMsIGluZm9IYW5kbGVycyB9IGZyb20gJy4vYWRkaXRpb25hbEluZm8nO1xyXG5pbXBvcnQgeyByZXNvdXJjZUhhbmRsZXJzIH0gZnJvbSAnLi9pbWFnZVJlc291cmNlcyc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBzZFdyaXRlciB7XHJcblx0b2Zmc2V0OiBudW1iZXI7XHJcblx0YnVmZmVyOiBBcnJheUJ1ZmZlcjtcclxuXHR2aWV3OiBEYXRhVmlldztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVdyaXRlcihzaXplID0gNDA5Nik6IFBzZFdyaXRlciB7XHJcblx0Y29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKHNpemUpO1xyXG5cdGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcclxuXHRjb25zdCBvZmZzZXQgPSAwO1xyXG5cdHJldHVybiB7IGJ1ZmZlciwgdmlldywgb2Zmc2V0IH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRXcml0ZXJCdWZmZXIod3JpdGVyOiBQc2RXcml0ZXIpIHtcclxuXHRyZXR1cm4gd3JpdGVyLmJ1ZmZlci5zbGljZSgwLCB3cml0ZXIub2Zmc2V0KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFdyaXRlckJ1ZmZlck5vQ29weSh3cml0ZXI6IFBzZFdyaXRlcikge1xyXG5cdHJldHVybiBuZXcgVWludDhBcnJheSh3cml0ZXIuYnVmZmVyLCAwLCB3cml0ZXIub2Zmc2V0KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDgod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgMSk7XHJcblx0d3JpdGVyLnZpZXcuc2V0VWludDgob2Zmc2V0LCB2YWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUludDE2KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDIpO1xyXG5cdHdyaXRlci52aWV3LnNldEludDE2KG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDE2KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDIpO1xyXG5cdHdyaXRlci52aWV3LnNldFVpbnQxNihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xyXG5cdHdyaXRlci52aWV3LnNldEludDMyKG9mZnNldCwgdmFsdWUsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVWludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xyXG5cdHdyaXRlci52aWV3LnNldFVpbnQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZsb2F0MzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgNCk7XHJcblx0d3JpdGVyLnZpZXcuc2V0RmxvYXQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZsb2F0NjQod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSBhZGRTaXplKHdyaXRlciwgOCk7XHJcblx0d3JpdGVyLnZpZXcuc2V0RmxvYXQ2NChvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgMTYuMTZcclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlICogKDEgPDwgMTYpKTtcclxufVxyXG5cclxuLy8gMzItYml0IGZpeGVkLXBvaW50IG51bWJlciA4LjI0XHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgdmFsdWUgKiAoMSA8PCAyNCkpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVCeXRlcyh3cml0ZXI6IFBzZFdyaXRlciwgYnVmZmVyOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKGJ1ZmZlcikge1xyXG5cdFx0ZW5zdXJlU2l6ZSh3cml0ZXIsIHdyaXRlci5vZmZzZXQgKyBidWZmZXIubGVuZ3RoKTtcclxuXHRcdGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlcik7XHJcblx0XHRieXRlcy5zZXQoYnVmZmVyLCB3cml0ZXIub2Zmc2V0KTtcclxuXHRcdHdyaXRlci5vZmZzZXQgKz0gYnVmZmVyLmxlbmd0aDtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVplcm9zKHdyaXRlcjogUHNkV3JpdGVyLCBjb3VudDogbnVtYmVyKSB7XHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVTaWduYXR1cmUod3JpdGVyOiBQc2RXcml0ZXIsIHNpZ25hdHVyZTogc3RyaW5nKSB7XHJcblx0aWYgKHNpZ25hdHVyZS5sZW5ndGggIT09IDQpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaWduYXR1cmU6ICcke3NpZ25hdHVyZX0nYCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgc2lnbmF0dXJlLmNoYXJDb2RlQXQoaSkpO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcsIHBhZFRvOiBudW1iZXIpIHtcclxuXHRsZXQgbGVuZ3RoID0gdGV4dC5sZW5ndGg7XHJcblx0d3JpdGVVaW50OCh3cml0ZXIsIGxlbmd0aCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcclxuXHRcdGNvbnN0IGNvZGUgPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgY29kZSA8IDEyOCA/IGNvZGUgOiAnPycuY2hhckNvZGVBdCgwKSk7XHJcblx0fVxyXG5cclxuXHR3aGlsZSAoKytsZW5ndGggJSBwYWRUbykge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nKSB7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCB0ZXh0Lmxlbmd0aCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCB0ZXh0LmNoYXJDb2RlQXQoaSkpO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlcjogUHNkV3JpdGVyLCB0ZXh0OiBzdHJpbmcpIHtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHRleHQubGVuZ3RoICsgMSk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCB0ZXh0LmNoYXJDb2RlQXQoaSkpO1xyXG5cdH1cclxuXHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGFyZ2VzdExheWVyU2l6ZShsYXllcnM6IExheWVyW10gPSBbXSk6IG51bWJlciB7XHJcblx0bGV0IG1heCA9IDA7XHJcblxyXG5cdGZvciAoY29uc3QgbGF5ZXIgb2YgbGF5ZXJzKSB7XHJcblx0XHRpZiAobGF5ZXIuY2FudmFzIHx8IGxheWVyLmltYWdlRGF0YSkge1xyXG5cdFx0XHRjb25zdCB7IHdpZHRoLCBoZWlnaHQgfSA9IGdldExheWVyRGltZW50aW9ucyhsYXllcik7XHJcblx0XHRcdG1heCA9IE1hdGgubWF4KG1heCwgMiAqIGhlaWdodCArIDIgKiB3aWR0aCAqIGhlaWdodCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxheWVyLmNoaWxkcmVuKSB7XHJcblx0XHRcdG1heCA9IE1hdGgubWF4KG1heCwgZ2V0TGFyZ2VzdExheWVyU2l6ZShsYXllci5jaGlsZHJlbikpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIG1heDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlU2VjdGlvbih3cml0ZXI6IFBzZFdyaXRlciwgcm91bmQ6IG51bWJlciwgZnVuYzogKCkgPT4gdm9pZCwgd3JpdGVUb3RhbExlbmd0aCA9IGZhbHNlLCBsYXJnZSA9IGZhbHNlKSB7XHJcblx0aWYgKGxhcmdlKSB3cml0ZVVpbnQzMih3cml0ZXIsIDApO1xyXG5cclxuXHRjb25zdCBvZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblxyXG5cdGZ1bmMoKTtcclxuXHJcblx0bGV0IGxlbmd0aCA9IHdyaXRlci5vZmZzZXQgLSBvZmZzZXQgLSA0O1xyXG5cdGxldCBsZW4gPSBsZW5ndGg7XHJcblxyXG5cdHdoaWxlICgobGVuICUgcm91bmQpICE9PSAwKSB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XHJcblx0XHRsZW4rKztcclxuXHR9XHJcblxyXG5cdGlmICh3cml0ZVRvdGFsTGVuZ3RoKSB7XHJcblx0XHRsZW5ndGggPSBsZW47XHJcblx0fVxyXG5cclxuXHR3cml0ZXIudmlldy5zZXRVaW50MzIob2Zmc2V0LCBsZW5ndGgsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUHNkKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCwgb3B0aW9uczogV3JpdGVPcHRpb25zID0ge30pIHtcclxuXHRpZiAoISgrcHNkLndpZHRoID4gMCAmJiArcHNkLmhlaWdodCA+IDApKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGRvY3VtZW50IHNpemUnKTtcclxuXHJcblx0aWYgKChwc2Qud2lkdGggPiAzMDAwMCB8fCBwc2QuaGVpZ2h0ID4gMzAwMDApICYmICFvcHRpb25zLnBzYilcclxuXHRcdHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgc2l6ZSBpcyB0b28gbGFyZ2UgKG1heCBpcyAzMDAwMHgzMDAwMCwgdXNlIFBTQiBmb3JtYXQgaW5zdGVhZCknKTtcclxuXHJcblx0bGV0IGltYWdlUmVzb3VyY2VzID0gcHNkLmltYWdlUmVzb3VyY2VzIHx8IHt9O1xyXG5cclxuXHRjb25zdCBvcHQ6IEV4dGVuZGVkV3JpdGVPcHRpb25zID0geyAuLi5vcHRpb25zLCBsYXllcklkczogW10gfTtcclxuXHJcblx0aWYgKG9wdC5nZW5lcmF0ZVRodW1ibmFpbCkge1xyXG5cdFx0aW1hZ2VSZXNvdXJjZXMgPSB7IC4uLmltYWdlUmVzb3VyY2VzLCB0aHVtYm5haWw6IGNyZWF0ZVRodW1ibmFpbChwc2QpIH07XHJcblx0fVxyXG5cclxuXHRsZXQgaW1hZ2VEYXRhID0gcHNkLmltYWdlRGF0YTtcclxuXHJcblx0aWYgKCFpbWFnZURhdGEgJiYgcHNkLmNhbnZhcykge1xyXG5cdFx0aW1hZ2VEYXRhID0gcHNkLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgcHNkLmNhbnZhcy53aWR0aCwgcHNkLmNhbnZhcy5oZWlnaHQpO1xyXG5cdH1cclxuXHJcblx0aWYgKGltYWdlRGF0YSAmJiAocHNkLndpZHRoICE9PSBpbWFnZURhdGEud2lkdGggfHwgcHNkLmhlaWdodCAhPT0gaW1hZ2VEYXRhLmhlaWdodCkpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RvY3VtZW50IGNhbnZhcyBtdXN0IGhhdmUgdGhlIHNhbWUgc2l6ZSBhcyBkb2N1bWVudCcpO1xyXG5cclxuXHRjb25zdCBnbG9iYWxBbHBoYSA9ICEhaW1hZ2VEYXRhICYmIGhhc0FscGhhKGltYWdlRGF0YSk7XHJcblx0Y29uc3QgbWF4QnVmZmVyU2l6ZSA9IE1hdGgubWF4KGdldExhcmdlc3RMYXllclNpemUocHNkLmNoaWxkcmVuKSwgNCAqIDIgKiBwc2Qud2lkdGggKiBwc2QuaGVpZ2h0ICsgMiAqIHBzZC5oZWlnaHQpO1xyXG5cdGNvbnN0IHRlbXBCdWZmZXIgPSBuZXcgVWludDhBcnJheShtYXhCdWZmZXJTaXplKTtcclxuXHJcblx0Ly8gaGVhZGVyXHJcblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJQUycpO1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgb3B0aW9ucy5wc2IgPyAyIDogMSk7IC8vIHZlcnNpb25cclxuXHR3cml0ZVplcm9zKHdyaXRlciwgNik7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBnbG9iYWxBbHBoYSA/IDQgOiAzKTsgLy8gY2hhbm5lbHNcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHBzZC5oZWlnaHQpO1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgcHNkLndpZHRoKTtcclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDgpOyAvLyBiaXRzIHBlciBjaGFubmVsXHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvck1vZGUuUkdCKTsgLy8gd2Ugb25seSBzdXBwb3J0IHNhdmluZyBSR0IgcmlnaHQgbm93XHJcblxyXG5cdC8vIGNvbG9yIG1vZGUgZGF0YVxyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdC8vIFRPRE86IGltcGxlbWVudFxyXG5cdH0pO1xyXG5cclxuXHQvLyBpbWFnZSByZXNvdXJjZXNcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IGhhbmRsZXIgb2YgcmVzb3VyY2VIYW5kbGVycykge1xyXG5cdFx0XHRpZiAoaGFuZGxlci5oYXMoaW1hZ2VSZXNvdXJjZXMpKSB7XHJcblx0XHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaGFuZGxlci5rZXkpO1xyXG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgJycsIDIpO1xyXG5cdFx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDIsICgpID0+IGhhbmRsZXIud3JpdGUod3JpdGVyLCBpbWFnZVJlc291cmNlcykpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdC8vIGxheWVyIGFuZCBtYXNrIGluZm9cclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiB7XHJcblx0XHR3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyLCB3cml0ZXIsIHBzZCwgZ2xvYmFsQWxwaGEsIG9wdCk7XHJcblx0XHR3cml0ZUdsb2JhbExheWVyTWFza0luZm8od3JpdGVyLCBwc2QuZ2xvYmFsTGF5ZXJNYXNrSW5mbyk7XHJcblx0XHR3cml0ZUFkZGl0aW9uYWxMYXllckluZm8od3JpdGVyLCBwc2QsIHBzZCwgb3B0KTtcclxuXHR9LCB1bmRlZmluZWQsICEhb3B0LnBzYik7XHJcblxyXG5cdC8vIGltYWdlIGRhdGFcclxuXHRjb25zdCBjaGFubmVscyA9IGdsb2JhbEFscGhhID8gWzAsIDEsIDIsIDNdIDogWzAsIDEsIDJdO1xyXG5cdGNvbnN0IGRhdGE6IFBpeGVsRGF0YSA9IGltYWdlRGF0YSB8fCB7XHJcblx0XHRkYXRhOiBuZXcgVWludDhBcnJheSg0ICogcHNkLndpZHRoICogcHNkLmhlaWdodCksXHJcblx0XHR3aWR0aDogcHNkLndpZHRoLFxyXG5cdFx0aGVpZ2h0OiBwc2QuaGVpZ2h0LFxyXG5cdH07XHJcblxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgQ29tcHJlc3Npb24uUmxlQ29tcHJlc3NlZCk7XHJcblxyXG5cdGlmIChSQVdfSU1BR0VfREFUQSAmJiAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3KSB7XHJcblx0XHRjb25zb2xlLmxvZygnd3JpdGluZyByYXcgaW1hZ2UgZGF0YScpO1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIChwc2QgYXMgYW55KS5pbWFnZURhdGFSYXcpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgd3JpdGVEYXRhUkxFKHRlbXBCdWZmZXIsIGRhdGEsIHBzZC53aWR0aCwgcHNkLmhlaWdodCwgY2hhbm5lbHMsICEhb3B0aW9ucy5wc2IpKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTGF5ZXJJbmZvKHRlbXBCdWZmZXI6IFVpbnQ4QXJyYXksIHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCwgZ2xvYmFsQWxwaGE6IGJvb2xlYW4sIG9wdGlvbnM6IEV4dGVuZGVkV3JpdGVPcHRpb25zKSB7XHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgNCwgKCkgPT4ge1xyXG5cdFx0Y29uc3QgbGF5ZXJzOiBMYXllcltdID0gW107XHJcblxyXG5cdFx0YWRkQ2hpbGRyZW4obGF5ZXJzLCBwc2QuY2hpbGRyZW4pO1xyXG5cclxuXHRcdGlmICghbGF5ZXJzLmxlbmd0aCkgbGF5ZXJzLnB1c2goe30pO1xyXG5cclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBnbG9iYWxBbHBoYSA/IC1sYXllcnMubGVuZ3RoIDogbGF5ZXJzLmxlbmd0aCk7XHJcblxyXG5cdFx0Y29uc3QgbGF5ZXJzRGF0YSA9IGxheWVycy5tYXAoKGwsIGkpID0+IGdldENoYW5uZWxzKHRlbXBCdWZmZXIsIGwsIGkgPT09IDAsIG9wdGlvbnMpKTtcclxuXHJcblx0XHQvLyBsYXllciByZWNvcmRzXHJcblx0XHRmb3IgKGNvbnN0IGxheWVyRGF0YSBvZiBsYXllcnNEYXRhKSB7XHJcblx0XHRcdGNvbnN0IHsgbGF5ZXIsIHRvcCwgbGVmdCwgYm90dG9tLCByaWdodCwgY2hhbm5lbHMgfSA9IGxheWVyRGF0YTtcclxuXHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCB0b3ApO1xyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgbGVmdCk7XHJcblx0XHRcdHdyaXRlSW50MzIod3JpdGVyLCBib3R0b20pO1xyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgcmlnaHQpO1xyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWxzLmxlbmd0aCk7XHJcblxyXG5cdFx0XHRmb3IgKGNvbnN0IGMgb2YgY2hhbm5lbHMpIHtcclxuXHRcdFx0XHR3cml0ZUludDE2KHdyaXRlciwgYy5jaGFubmVsSWQpO1xyXG5cdFx0XHRcdGlmIChvcHRpb25zLnBzYikgd3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHRcdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGMubGVuZ3RoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGZyb21CbGVuZE1vZGVbbGF5ZXIuYmxlbmRNb2RlIV0gfHwgJ25vcm0nKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQoY2xhbXAobGF5ZXIub3BhY2l0eSA/PyAxLCAwLCAxKSAqIDI1NSkpO1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbGF5ZXIuY2xpcHBpbmcgPyAxIDogMCk7XHJcblxyXG5cdFx0XHRsZXQgZmxhZ3MgPSAweDA4OyAvLyAxIGZvciBQaG90b3Nob3AgNS4wIGFuZCBsYXRlciwgdGVsbHMgaWYgYml0IDQgaGFzIHVzZWZ1bCBpbmZvcm1hdGlvblxyXG5cdFx0XHRpZiAobGF5ZXIudHJhbnNwYXJlbmN5UHJvdGVjdGVkKSBmbGFncyB8PSAweDAxO1xyXG5cdFx0XHRpZiAobGF5ZXIuaGlkZGVuKSBmbGFncyB8PSAweDAyO1xyXG5cdFx0XHRpZiAobGF5ZXIudmVjdG9yTWFzayB8fCAobGF5ZXIuc2VjdGlvbkRpdmlkZXIgJiYgbGF5ZXIuc2VjdGlvbkRpdmlkZXIudHlwZSAhPT0gU2VjdGlvbkRpdmlkZXJUeXBlLk90aGVyKSkge1xyXG5cdFx0XHRcdGZsYWdzIHw9IDB4MTA7IC8vIHBpeGVsIGRhdGEgaXJyZWxldmFudCB0byBhcHBlYXJhbmNlIG9mIGRvY3VtZW50XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKGxheWVyLmVmZmVjdHMgJiYgaGFzTXVsdGlFZmZlY3RzKGxheWVyLmVmZmVjdHMpKSB7IC8vIFRPRE86IHRoaXMgaXMgbm90IGNvcnJlY3RcclxuXHRcdFx0XHRmbGFncyB8PSAweDIwOyAvLyBqdXN0IGd1ZXNzaW5nIHRoaXMgb25lLCBtaWdodCBiZSBjb21wbGV0ZWx5IGluY29ycmVjdFxyXG5cdFx0XHR9XHJcblx0XHRcdC8vIGlmICgnXzInIGluIGxheWVyKSBmbGFncyB8PSAweDIwOyAvLyBURU1QISEhXHJcblxyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZmxhZ3MpO1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7IC8vIGZpbGxlclxyXG5cdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHRcdFx0d3JpdGVMYXllck1hc2tEYXRhKHdyaXRlciwgbGF5ZXIsIGxheWVyRGF0YSk7XHJcblx0XHRcdFx0d3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlciwgcHNkKTtcclxuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGxheWVyLm5hbWUgfHwgJycsIDQpO1xyXG5cdFx0XHRcdHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXIsIGxheWVyLCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBsYXllciBjaGFubmVsIGltYWdlIGRhdGFcclxuXHRcdGZvciAoY29uc3QgbGF5ZXJEYXRhIG9mIGxheWVyc0RhdGEpIHtcclxuXHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGxheWVyRGF0YS5jaGFubmVscykge1xyXG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbC5jb21wcmVzc2lvbik7XHJcblxyXG5cdFx0XHRcdGlmIChjaGFubmVsLmJ1ZmZlcikge1xyXG5cdFx0XHRcdFx0d3JpdGVCeXRlcyh3cml0ZXIsIGNoYW5uZWwuYnVmZmVyKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LCB0cnVlLCBvcHRpb25zLnBzYik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTGF5ZXJNYXNrRGF0YSh3cml0ZXI6IFBzZFdyaXRlciwgeyBtYXNrIH06IExheWVyLCBsYXllckRhdGE6IExheWVyQ2hhbm5lbERhdGEpIHtcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHRpZiAoIW1hc2spIHJldHVybjtcclxuXHJcblx0XHRjb25zdCBtID0gbGF5ZXJEYXRhLm1hc2sgfHwge30gYXMgUGFydGlhbDxCb3VuZHM+O1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0udG9wISk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5sZWZ0ISk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS5ib3R0b20hKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLnJpZ2h0ISk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgbWFzay5kZWZhdWx0Q29sb3IhKTtcclxuXHJcblx0XHRsZXQgcGFyYW1zID0gMDtcclxuXHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5Vc2VyTWFza0RlbnNpdHk7XHJcblx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVXNlck1hc2tGZWF0aGVyO1xyXG5cdFx0aWYgKG1hc2sudmVjdG9yTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgcGFyYW1zIHw9IE1hc2tQYXJhbXMuVmVjdG9yTWFza0RlbnNpdHk7XHJcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRmVhdGhlcjtcclxuXHJcblx0XHRsZXQgZmxhZ3MgPSAwO1xyXG5cdFx0aWYgKG1hc2suZGlzYWJsZWQpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Rpc2FibGVkO1xyXG5cdFx0aWYgKG1hc2sucG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLlBvc2l0aW9uUmVsYXRpdmVUb0xheWVyO1xyXG5cdFx0aWYgKG1hc2suZnJvbVZlY3RvckRhdGEpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLkxheWVyTWFza0Zyb21SZW5kZXJpbmdPdGhlckRhdGE7XHJcblx0XHRpZiAocGFyYW1zKSBmbGFncyB8PSBMYXllck1hc2tGbGFncy5NYXNrSGFzUGFyYW1ldGVyc0FwcGxpZWRUb0l0O1xyXG5cclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncyk7XHJcblxyXG5cdFx0aWYgKHBhcmFtcykge1xyXG5cdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgcGFyYW1zKTtcclxuXHJcblx0XHRcdGlmIChtYXNrLnVzZXJNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnVzZXJNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcclxuXHRcdFx0aWYgKG1hc2sudXNlck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHdyaXRlRmxvYXQ2NCh3cml0ZXIsIG1hc2sudXNlck1hc2tGZWF0aGVyKTtcclxuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgd3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAqIDB4ZmYpKTtcclxuXHRcdFx0aWYgKG1hc2sudmVjdG9yTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay52ZWN0b3JNYXNrRmVhdGhlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVE9ETzogaGFuZGxlIHJlc3Qgb2YgdGhlIGZpZWxkc1xyXG5cclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMYXllckJsZW5kaW5nUmFuZ2VzKHdyaXRlcjogUHNkV3JpdGVyLCBwc2Q6IFBzZCkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblxyXG5cdFx0bGV0IGNoYW5uZWxzID0gcHNkLmNoYW5uZWxzIHx8IDA7IC8vIFRPRE86IHVzZSBhbHdheXMgNCBpbnN0ZWFkID9cclxuXHRcdC8vIGNoYW5uZWxzID0gNDsgLy8gVEVTVElOR1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbHM7IGkrKykge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlR2xvYmFsTGF5ZXJNYXNrSW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgaW5mbzogR2xvYmFsTGF5ZXJNYXNrSW5mbyB8IHVuZGVmaW5lZCkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdGlmIChpbmZvKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vdmVybGF5Q29sb3JTcGFjZSk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMSk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMik7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlMyk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclNwYWNlNCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vcGFjaXR5ICogMHhmZik7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLmtpbmQpO1xyXG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQWRkaXRpb25hbExheWVySW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgdGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvLCBwc2Q6IFBzZCwgb3B0aW9uczogRXh0ZW5kZWRXcml0ZU9wdGlvbnMpIHtcclxuXHRmb3IgKGNvbnN0IGhhbmRsZXIgb2YgaW5mb0hhbmRsZXJzKSB7XHJcblx0XHRsZXQga2V5ID0gaGFuZGxlci5rZXk7XHJcblxyXG5cdFx0aWYgKGtleSA9PT0gJ1R4dDInICYmIG9wdGlvbnMuaW52YWxpZGF0ZVRleHRMYXllcnMpIGNvbnRpbnVlO1xyXG5cdFx0aWYgKGtleSA9PT0gJ3Ztc2snICYmIG9wdGlvbnMucHNiKSBrZXkgPSAndnNtcyc7XHJcblxyXG5cdFx0aWYgKGhhbmRsZXIuaGFzKHRhcmdldCkpIHtcclxuXHRcdFx0Y29uc3QgbGFyZ2UgPSBvcHRpb25zLnBzYiAmJiBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cy5pbmRleE9mKGtleSkgIT09IC0xO1xyXG5cclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBsYXJnZSA/ICc4QjY0JyA6ICc4QklNJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwga2V5KTtcclxuXHJcblx0XHRcdGNvbnN0IGZvdXJCeXRlcyA9IGtleSA9PT0gJ1R4dDInIHx8IGtleSA9PT0gJ2x1bmknIHx8IGtleSA9PT0gJ3Ztc2snIHx8IGtleSA9PT0gJ2FydGInIHx8IGtleSA9PT0gJ2FydGQnIHx8XHJcblx0XHRcdFx0a2V5ID09PSAndm9naycgfHwga2V5ID09PSAnU29MZCcgfHwga2V5ID09PSAnbG5rMicgfHwga2V5ID09PSAndnNjZycgfHwga2V5ID09PSAndnNtcycgfHwga2V5ID09PSAnR2RGbCcgfHxcclxuXHRcdFx0XHRrZXkgPT09ICdsbWZ4JyB8fCBrZXkgPT09ICdsckZYJyB8fCBrZXkgPT09ICdjaW5mJyB8fCBrZXkgPT09ICdQbExkJyB8fCBrZXkgPT09ICdBbm5vJztcclxuXHJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIGZvdXJCeXRlcyA/IDQgOiAyLCAoKSA9PiB7XHJcblx0XHRcdFx0aGFuZGxlci53cml0ZSh3cml0ZXIsIHRhcmdldCwgcHNkLCBvcHRpb25zKTtcclxuXHRcdFx0fSwga2V5ICE9PSAnVHh0MicgJiYga2V5ICE9PSAnY2luZicgJiYga2V5ICE9PSAnZXh0bicsIGxhcmdlKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFkZENoaWxkcmVuKGxheWVyczogTGF5ZXJbXSwgY2hpbGRyZW46IExheWVyW10gfCB1bmRlZmluZWQpIHtcclxuXHRpZiAoIWNoaWxkcmVuKSByZXR1cm47XHJcblxyXG5cdGZvciAoY29uc3QgYyBvZiBjaGlsZHJlbikge1xyXG5cdFx0aWYgKGMuY2hpbGRyZW4gJiYgYy5jYW52YXMpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnY2FudmFzJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XHJcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmltYWdlRGF0YSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxheWVyLCBjYW5ub3QgaGF2ZSBib3RoICdpbWFnZURhdGEnIGFuZCAnY2hpbGRyZW4nIHByb3BlcnRpZXNgKTtcclxuXHJcblx0XHRpZiAoYy5jaGlsZHJlbikge1xyXG5cdFx0XHRsYXllcnMucHVzaCh7XHJcblx0XHRcdFx0bmFtZTogJzwvTGF5ZXIgZ3JvdXA+JyxcclxuXHRcdFx0XHRzZWN0aW9uRGl2aWRlcjoge1xyXG5cdFx0XHRcdFx0dHlwZTogU2VjdGlvbkRpdmlkZXJUeXBlLkJvdW5kaW5nU2VjdGlvbkRpdmlkZXIsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvLyBURVNUSU5HXHJcblx0XHRcdFx0Ly8gbmFtZVNvdXJjZTogJ2xzZXQnLFxyXG5cdFx0XHRcdC8vIGlkOiBbNCwgMCwgMCwgOCwgMTEsIDAsIDAsIDAsIDAsIDE0XVtsYXllcnMubGVuZ3RoXSB8fCAwLFxyXG5cdFx0XHRcdC8vIGxheWVyQ29sb3I6ICdub25lJyxcclxuXHRcdFx0XHQvLyB0aW1lc3RhbXA6IFsxNjExMzQ2ODE3LjM0OTAyMSwgMCwgMCwgMTYxMTM0NjgxNy4zNDkxNzUsIDE2MTEzNDY4MTcuMzQ5MTgzMywgMCwgMCwgMCwgMCwgMTYxMTM0NjgxNy4zNDk4MzJdW2xheWVycy5sZW5ndGhdIHx8IDAsXHJcblx0XHRcdFx0Ly8gcHJvdGVjdGVkOiB7fSxcclxuXHRcdFx0XHQvLyByZWZlcmVuY2VQb2ludDogeyB4OiAwLCB5OiAwIH0sXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRhZGRDaGlsZHJlbihsYXllcnMsIGMuY2hpbGRyZW4pO1xyXG5cdFx0XHRsYXllcnMucHVzaCh7XHJcblx0XHRcdFx0c2VjdGlvbkRpdmlkZXI6IHtcclxuXHRcdFx0XHRcdHR5cGU6IGMub3BlbmVkID09PSBmYWxzZSA/IFNlY3Rpb25EaXZpZGVyVHlwZS5DbG9zZWRGb2xkZXIgOiBTZWN0aW9uRGl2aWRlclR5cGUuT3BlbkZvbGRlcixcclxuXHRcdFx0XHRcdGtleTogZnJvbUJsZW5kTW9kZVtjLmJsZW5kTW9kZSFdIHx8ICdwYXNzJyxcclxuXHRcdFx0XHRcdHN1YlR5cGU6IDAsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQuLi5jLFxyXG5cdFx0XHR9KTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGxheWVycy5wdXNoKHsgLi4uYyB9KTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlc2l6ZUJ1ZmZlcih3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0bGV0IG5ld0xlbmd0aCA9IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aDtcclxuXHJcblx0ZG8ge1xyXG5cdFx0bmV3TGVuZ3RoICo9IDI7XHJcblx0fSB3aGlsZSAoc2l6ZSA+IG5ld0xlbmd0aCk7XHJcblxyXG5cdGNvbnN0IG5ld0J1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihuZXdMZW5ndGgpO1xyXG5cdGNvbnN0IG5ld0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkobmV3QnVmZmVyKTtcclxuXHRjb25zdCBvbGRCeXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xyXG5cdG5ld0J5dGVzLnNldChvbGRCeXRlcyk7XHJcblx0d3JpdGVyLmJ1ZmZlciA9IG5ld0J1ZmZlcjtcclxuXHR3cml0ZXIudmlldyA9IG5ldyBEYXRhVmlldyh3cml0ZXIuYnVmZmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW5zdXJlU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0aWYgKHNpemUgPiB3cml0ZXIuYnVmZmVyLmJ5dGVMZW5ndGgpIHtcclxuXHRcdHJlc2l6ZUJ1ZmZlcih3cml0ZXIsIHNpemUpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkU2l6ZSh3cml0ZXI6IFBzZFdyaXRlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHRlbnN1cmVTaXplKHdyaXRlciwgd3JpdGVyLm9mZnNldCArPSBzaXplKTtcclxuXHRyZXR1cm4gb2Zmc2V0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVUaHVtYm5haWwocHNkOiBQc2QpIHtcclxuXHRjb25zdCBjYW52YXMgPSBjcmVhdGVDYW52YXMoMTAsIDEwKTtcclxuXHRsZXQgc2NhbGUgPSAxO1xyXG5cclxuXHRpZiAocHNkLndpZHRoID4gcHNkLmhlaWdodCkge1xyXG5cdFx0Y2FudmFzLndpZHRoID0gMTYwO1xyXG5cdFx0Y2FudmFzLmhlaWdodCA9IE1hdGguZmxvb3IocHNkLmhlaWdodCAqIChjYW52YXMud2lkdGggLyBwc2Qud2lkdGgpKTtcclxuXHRcdHNjYWxlID0gY2FudmFzLndpZHRoIC8gcHNkLndpZHRoO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRjYW52YXMuaGVpZ2h0ID0gMTYwO1xyXG5cdFx0Y2FudmFzLndpZHRoID0gTWF0aC5mbG9vcihwc2Qud2lkdGggKiAoY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQpKTtcclxuXHRcdHNjYWxlID0gY2FudmFzLmhlaWdodCAvIHBzZC5oZWlnaHQ7XHJcblx0fVxyXG5cclxuXHRjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykhO1xyXG5cdGNvbnRleHQuc2NhbGUoc2NhbGUsIHNjYWxlKTtcclxuXHJcblx0aWYgKHBzZC5pbWFnZURhdGEpIHtcclxuXHRcdGNvbnN0IHRlbXAgPSBjcmVhdGVDYW52YXMocHNkLmltYWdlRGF0YS53aWR0aCwgcHNkLmltYWdlRGF0YS5oZWlnaHQpO1xyXG5cdFx0dGVtcC5nZXRDb250ZXh0KCcyZCcpIS5wdXRJbWFnZURhdGEocHNkLmltYWdlRGF0YSwgMCwgMCk7XHJcblx0XHRjb250ZXh0LmRyYXdJbWFnZSh0ZW1wLCAwLCAwKTtcclxuXHR9IGVsc2UgaWYgKHBzZC5jYW52YXMpIHtcclxuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHBzZC5jYW52YXMsIDAsIDApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGNhbnZhcztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q2hhbm5lbHMoXHJcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcclxuKTogTGF5ZXJDaGFubmVsRGF0YSB7XHJcblx0Y29uc3QgbGF5ZXJEYXRhID0gZ2V0TGF5ZXJDaGFubmVscyh0ZW1wQnVmZmVyLCBsYXllciwgYmFja2dyb3VuZCwgb3B0aW9ucyk7XHJcblx0Y29uc3QgbWFzayA9IGxheWVyLm1hc2s7XHJcblxyXG5cdGlmIChtYXNrKSB7XHJcblx0XHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBtYXNrO1xyXG5cdFx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKG1hc2spO1xyXG5cdFx0bGV0IGltYWdlRGF0YSA9IG1hc2suaW1hZ2VEYXRhO1xyXG5cclxuXHRcdGlmICghaW1hZ2VEYXRhICYmIG1hc2suY2FudmFzICYmIHdpZHRoICYmIGhlaWdodCkge1xyXG5cdFx0XHRpbWFnZURhdGEgPSBtYXNrLmNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHdpZHRoICYmIGhlaWdodCAmJiBpbWFnZURhdGEpIHtcclxuXHRcdFx0cmlnaHQgPSBsZWZ0ICsgd2lkdGg7XHJcblx0XHRcdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcclxuXHJcblx0XHRcdGxldCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgaW1hZ2VEYXRhLCB3aWR0aCwgaGVpZ2h0LCBbMF0sICEhb3B0aW9ucy5wc2IpITtcclxuXHJcblx0XHRcdGlmIChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdykge1xyXG5cdFx0XHRcdC8vIGNvbnNvbGUubG9nKCd3cml0dGVuIHJhdyBsYXllciBpbWFnZSBkYXRhJyk7XHJcblx0XHRcdFx0YnVmZmVyID0gKGxheWVyIGFzIGFueSkubWFza0RhdGFSYXc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxheWVyRGF0YS5tYXNrID0geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcclxuXHRcdFx0bGF5ZXJEYXRhLmNoYW5uZWxzLnB1c2goe1xyXG5cdFx0XHRcdGNoYW5uZWxJZDogQ2hhbm5lbElELlVzZXJNYXNrLFxyXG5cdFx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxyXG5cdFx0XHRcdGJ1ZmZlcjogYnVmZmVyLFxyXG5cdFx0XHRcdGxlbmd0aDogMiArIGJ1ZmZlci5sZW5ndGgsXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXJEYXRhLm1hc2sgPSB7IHRvcDogMCwgbGVmdDogMCwgcmlnaHQ6IDAsIGJvdHRvbTogMCB9O1xyXG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XHJcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXHJcblx0XHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsXHJcblx0XHRcdFx0YnVmZmVyOiBuZXcgVWludDhBcnJheSgwKSxcclxuXHRcdFx0XHRsZW5ndGg6IDAsXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGxheWVyRGF0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGF5ZXJEaW1lbnRpb25zKHsgY2FudmFzLCBpbWFnZURhdGEgfTogTGF5ZXIpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyB9IHtcclxuXHRyZXR1cm4gaW1hZ2VEYXRhIHx8IGNhbnZhcyB8fCB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JvcEltYWdlRGF0YShkYXRhOiBJbWFnZURhdGEsIGxlZnQ6IG51bWJlciwgdG9wOiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XHJcblx0Y29uc3QgY3JvcHBlZERhdGEgPSBjcmVhdGVJbWFnZURhdGEod2lkdGgsIGhlaWdodCk7XHJcblx0Y29uc3Qgc3JjRGF0YSA9IGRhdGEuZGF0YTtcclxuXHRjb25zdCBkc3REYXRhID0gY3JvcHBlZERhdGEuZGF0YTtcclxuXHJcblx0Zm9yIChsZXQgeSA9IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xyXG5cdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDsgeCsrKSB7XHJcblx0XHRcdGxldCBzcmMgPSAoKHggKyBsZWZ0KSArICh5ICsgdG9wKSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdGxldCBkc3QgPSAoeCArIHkgKiB3aWR0aCkgKiA0O1xyXG5cdFx0XHRkc3REYXRhW2RzdF0gPSBzcmNEYXRhW3NyY107XHJcblx0XHRcdGRzdERhdGFbZHN0ICsgMV0gPSBzcmNEYXRhW3NyYyArIDFdO1xyXG5cdFx0XHRkc3REYXRhW2RzdCArIDJdID0gc3JjRGF0YVtzcmMgKyAyXTtcclxuXHRcdFx0ZHN0RGF0YVtkc3QgKyAzXSA9IHNyY0RhdGFbc3JjICsgM107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY3JvcHBlZERhdGE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExheWVyQ2hhbm5lbHMoXHJcblx0dGVtcEJ1ZmZlcjogVWludDhBcnJheSwgbGF5ZXI6IExheWVyLCBiYWNrZ3JvdW5kOiBib29sZWFuLCBvcHRpb25zOiBXcml0ZU9wdGlvbnNcclxuKTogTGF5ZXJDaGFubmVsRGF0YSB7XHJcblx0bGV0IHsgdG9wID0gMCwgbGVmdCA9IDAsIHJpZ2h0ID0gMCwgYm90dG9tID0gMCB9ID0gbGF5ZXI7XHJcblx0bGV0IGNoYW5uZWxzOiBDaGFubmVsRGF0YVtdID0gW1xyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5UcmFuc3BhcmVuY3ksIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELkNvbG9yMCwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRcdHsgY2hhbm5lbElkOiBDaGFubmVsSUQuQ29sb3IxLCBjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSwgYnVmZmVyOiB1bmRlZmluZWQsIGxlbmd0aDogMiB9LFxyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5Db2xvcjIsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XTtcclxuXHJcblx0bGV0IHsgd2lkdGgsIGhlaWdodCB9ID0gZ2V0TGF5ZXJEaW1lbnRpb25zKGxheWVyKTtcclxuXHJcblx0aWYgKCEobGF5ZXIuY2FudmFzIHx8IGxheWVyLmltYWdlRGF0YSkgfHwgIXdpZHRoIHx8ICFoZWlnaHQpIHtcclxuXHRcdHJpZ2h0ID0gbGVmdDtcclxuXHRcdGJvdHRvbSA9IHRvcDtcclxuXHRcdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XHJcblx0fVxyXG5cclxuXHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcclxuXHRib3R0b20gPSB0b3AgKyBoZWlnaHQ7XHJcblxyXG5cdGxldCBkYXRhID0gbGF5ZXIuaW1hZ2VEYXRhIHx8IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuXHRpZiAob3B0aW9ucy50cmltSW1hZ2VEYXRhKSB7XHJcblx0XHRjb25zdCB0cmltbWVkID0gdHJpbURhdGEoZGF0YSk7XHJcblxyXG5cdFx0aWYgKHRyaW1tZWQubGVmdCAhPT0gMCB8fCB0cmltbWVkLnRvcCAhPT0gMCB8fCB0cmltbWVkLnJpZ2h0ICE9PSBkYXRhLndpZHRoIHx8IHRyaW1tZWQuYm90dG9tICE9PSBkYXRhLmhlaWdodCkge1xyXG5cdFx0XHRsZWZ0ICs9IHRyaW1tZWQubGVmdDtcclxuXHRcdFx0dG9wICs9IHRyaW1tZWQudG9wO1xyXG5cdFx0XHRyaWdodCAtPSAoZGF0YS53aWR0aCAtIHRyaW1tZWQucmlnaHQpO1xyXG5cdFx0XHRib3R0b20gLT0gKGRhdGEuaGVpZ2h0IC0gdHJpbW1lZC5ib3R0b20pO1xyXG5cdFx0XHR3aWR0aCA9IHJpZ2h0IC0gbGVmdDtcclxuXHRcdFx0aGVpZ2h0ID0gYm90dG9tIC0gdG9wO1xyXG5cclxuXHRcdFx0aWYgKCF3aWR0aCB8fCAhaGVpZ2h0KSB7XHJcblx0XHRcdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGxheWVyLmltYWdlRGF0YSkge1xyXG5cdFx0XHRcdGRhdGEgPSBjcm9wSW1hZ2VEYXRhKGRhdGEsIHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGEgPSBsYXllci5jYW52YXMhLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSh0cmltbWVkLmxlZnQsIHRyaW1tZWQudG9wLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y29uc3QgY2hhbm5lbElkcyA9IFtcclxuXHRcdENoYW5uZWxJRC5Db2xvcjAsXHJcblx0XHRDaGFubmVsSUQuQ29sb3IxLFxyXG5cdFx0Q2hhbm5lbElELkNvbG9yMixcclxuXHRdO1xyXG5cclxuXHRpZiAoIWJhY2tncm91bmQgfHwgb3B0aW9ucy5ub0JhY2tncm91bmQgfHwgbGF5ZXIubWFzayB8fCBoYXNBbHBoYShkYXRhKSB8fCAoUkFXX0lNQUdFX0RBVEEgJiYgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3Py5bJy0xJ10pKSB7XHJcblx0XHRjaGFubmVsSWRzLnVuc2hpZnQoQ2hhbm5lbElELlRyYW5zcGFyZW5jeSk7XHJcblx0fVxyXG5cclxuXHRjaGFubmVscyA9IGNoYW5uZWxJZHMubWFwKGNoYW5uZWwgPT4ge1xyXG5cdFx0Y29uc3Qgb2Zmc2V0ID0gb2Zmc2V0Rm9yQ2hhbm5lbChjaGFubmVsLCBmYWxzZSk7IC8vIFRPRE86IHBzZC5jb2xvck1vZGUgPT09IENvbG9yTW9kZS5DTVlLKTtcclxuXHRcdGxldCBidWZmZXIgPSB3cml0ZURhdGFSTEUodGVtcEJ1ZmZlciwgZGF0YSwgd2lkdGgsIGhlaWdodCwgW29mZnNldF0sICEhb3B0aW9ucy5wc2IpITtcclxuXHJcblx0XHRpZiAoUkFXX0lNQUdFX0RBVEEgJiYgKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3KSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCd3cml0dGVuIHJhdyBsYXllciBpbWFnZSBkYXRhJyk7XHJcblx0XHRcdGJ1ZmZlciA9IChsYXllciBhcyBhbnkpLmltYWdlRGF0YVJhd1tjaGFubmVsXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRjaGFubmVsSWQ6IGNoYW5uZWwsXHJcblx0XHRcdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SbGVDb21wcmVzc2VkLFxyXG5cdFx0XHRidWZmZXI6IGJ1ZmZlcixcclxuXHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcclxuXHRcdH07XHJcblx0fSk7XHJcblxyXG5cdHJldHVybiB7IGxheWVyLCB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20sIGNoYW5uZWxzIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzUm93RW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHk6IG51bWJlciwgbGVmdDogbnVtYmVyLCByaWdodDogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc3RhcnQgPSAoKHkgKiB3aWR0aCArIGxlZnQpICogNCArIDMpIHwgMDtcclxuXHRjb25zdCBlbmQgPSAoc3RhcnQgKyAocmlnaHQgLSBsZWZ0KSAqIDQpIHwgMDtcclxuXHJcblx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpID0gKGkgKyA0KSB8IDApIHtcclxuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc0NvbEVtcHR5KHsgZGF0YSwgd2lkdGggfTogUGl4ZWxEYXRhLCB4OiBudW1iZXIsIHRvcDogbnVtYmVyLCBib3R0b206IG51bWJlcikge1xyXG5cdGNvbnN0IHN0cmlkZSA9ICh3aWR0aCAqIDQpIHwgMDtcclxuXHRjb25zdCBzdGFydCA9ICh0b3AgKiBzdHJpZGUgKyB4ICogNCArIDMpIHwgMDtcclxuXHJcblx0Zm9yIChsZXQgeSA9IHRvcCwgaSA9IHN0YXJ0OyB5IDwgYm90dG9tOyB5KyssIGkgPSAoaSArIHN0cmlkZSkgfCAwKSB7XHJcblx0XHRpZiAoZGF0YVtpXSAhPT0gMCkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJpbURhdGEoZGF0YTogUGl4ZWxEYXRhKSB7XHJcblx0bGV0IHRvcCA9IDA7XHJcblx0bGV0IGxlZnQgPSAwO1xyXG5cdGxldCByaWdodCA9IGRhdGEud2lkdGg7XHJcblx0bGV0IGJvdHRvbSA9IGRhdGEuaGVpZ2h0O1xyXG5cclxuXHR3aGlsZSAodG9wIDwgYm90dG9tICYmIGlzUm93RW1wdHkoZGF0YSwgdG9wLCBsZWZ0LCByaWdodCkpXHJcblx0XHR0b3ArKztcclxuXHR3aGlsZSAoYm90dG9tID4gdG9wICYmIGlzUm93RW1wdHkoZGF0YSwgYm90dG9tIC0gMSwgbGVmdCwgcmlnaHQpKVxyXG5cdFx0Ym90dG9tLS07XHJcblx0d2hpbGUgKGxlZnQgPCByaWdodCAmJiBpc0NvbEVtcHR5KGRhdGEsIGxlZnQsIHRvcCwgYm90dG9tKSlcclxuXHRcdGxlZnQrKztcclxuXHR3aGlsZSAocmlnaHQgPiBsZWZ0ICYmIGlzQ29sRW1wdHkoZGF0YSwgcmlnaHQgLSAxLCB0b3AsIGJvdHRvbSkpXHJcblx0XHRyaWdodC0tO1xyXG5cclxuXHRyZXR1cm4geyB0b3AsIGxlZnQsIHJpZ2h0LCBib3R0b20gfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQ29sb3Iod3JpdGVyOiBQc2RXcml0ZXIsIGNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICghY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDgpO1xyXG5cdH0gZWxzZSBpZiAoJ3InIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuUkdCKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5yICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuZyAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0fSBlbHNlIGlmICgnbCcgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5MYWIpO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubCAqIDEwMDAwKSk7XHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5hIDwgMCA/IChjb2xvci5hICogMTI4MDApIDogKGNvbG9yLmEgKiAxMjcwMCkpKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgPCAwID8gKGNvbG9yLmIgKiAxMjgwMCkgOiAoY29sb3IuYiAqIDEyNzAwKSkpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxuXHR9IGVsc2UgaWYgKCdoJyBpbiBjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkhTQik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuaCAqIDB4ZmZmZikpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnMgKiAweGZmZmYpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5iICogMHhmZmZmKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdH0gZWxzZSBpZiAoJ2MnIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuQ01ZSyk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYyAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLm0gKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci55ICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuayAqIDI1NykpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuR3JheXNjYWxlKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rICogMTAwMDAgLyAyNTUpKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA2KTtcclxuXHR9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
