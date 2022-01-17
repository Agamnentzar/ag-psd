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
import { hasAlpha, createCanvas, writeDataRLE, offsetForChannel, createImageData, fromBlendMode, clamp, largeAdditionalInfoKeys, RAW_IMAGE_DATA } from './helpers';
import { hasMultiEffects, infoHandlers } from './additionalInfo';
import { resourceHandlers } from './imageResources';
export function createWriter(size) {
    if (size === void 0) { size = 4096; }
    var buffer = new ArrayBuffer(size);
    var view = new DataView(buffer);
    var offset = 0;
    return { buffer: buffer, view: view, offset: offset };
}
export function getWriterBuffer(writer) {
    return writer.buffer.slice(0, writer.offset);
}
export function getWriterBufferNoCopy(writer) {
    return new Uint8Array(writer.buffer, 0, writer.offset);
}
export function writeUint8(writer, value) {
    var offset = addSize(writer, 1);
    writer.view.setUint8(offset, value);
}
export function writeInt16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setInt16(offset, value, false);
}
export function writeUint16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setUint16(offset, value, false);
}
export function writeInt32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setInt32(offset, value, false);
}
export function writeUint32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setUint32(offset, value, false);
}
export function writeFloat32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setFloat32(offset, value, false);
}
export function writeFloat64(writer, value) {
    var offset = addSize(writer, 8);
    writer.view.setFloat64(offset, value, false);
}
// 32-bit fixed-point number 16.16
export function writeFixedPoint32(writer, value) {
    writeInt32(writer, value * (1 << 16));
}
// 32-bit fixed-point number 8.24
export function writeFixedPointPath32(writer, value) {
    writeInt32(writer, value * (1 << 24));
}
export function writeBytes(writer, buffer) {
    if (buffer) {
        ensureSize(writer, writer.offset + buffer.length);
        var bytes = new Uint8Array(writer.buffer);
        bytes.set(buffer, writer.offset);
        writer.offset += buffer.length;
    }
}
export function writeZeros(writer, count) {
    for (var i = 0; i < count; i++) {
        writeUint8(writer, 0);
    }
}
export function writeSignature(writer, signature) {
    if (signature.length !== 4)
        throw new Error("Invalid signature: '".concat(signature, "'"));
    for (var i = 0; i < 4; i++) {
        writeUint8(writer, signature.charCodeAt(i));
    }
}
export function writePascalString(writer, text, padTo) {
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
export function writeUnicodeString(writer, text) {
    writeUint32(writer, text.length);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
}
export function writeUnicodeStringWithPadding(writer, text) {
    writeUint32(writer, text.length + 1);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
    writeUint16(writer, 0);
}
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
export function writeSection(writer, round, func, writeTotalLength, large) {
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
export function writePsd(writer, psd, options) {
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
    var globalAlpha = !!imageData && hasAlpha(imageData);
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
        for (var _i = 0, resourceHandlers_1 = resourceHandlers; _i < resourceHandlers_1.length; _i++) {
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
    if (RAW_IMAGE_DATA && psd.imageDataRaw) {
        console.log('writing raw image data');
        writeBytes(writer, psd.imageDataRaw);
    }
    else {
        writeBytes(writer, writeDataRLE(tempBuffer, data, psd.width, psd.height, channels, !!options.psb));
    }
}
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
            writeSignature(writer, fromBlendMode[layer.blendMode] || 'norm');
            writeUint8(writer, Math.round(clamp((_a = layer.opacity) !== null && _a !== void 0 ? _a : 1, 0, 1) * 255));
            writeUint8(writer, layer.clipping ? 1 : 0);
            var flags = 0x08; // 1 for Photoshop 5.0 and later, tells if bit 4 has useful information
            if (layer.transparencyProtected)
                flags |= 0x01;
            if (layer.hidden)
                flags |= 0x02;
            if (layer.vectorMask || (layer.sectionDivider && layer.sectionDivider.type !== 0 /* Other */)) {
                flags |= 0x10; // pixel data irrelevant to appearance of document
            }
            if (layer.effects && hasMultiEffects(layer.effects)) {
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
            var large = options.psb && largeAdditionalInfoKeys.indexOf(key) !== -1;
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
    for (var _i = 0, infoHandlers_1 = infoHandlers; _i < infoHandlers_1.length; _i++) {
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
                    key: fromBlendMode[c.blendMode] || 'pass',
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
    var canvas = createCanvas(10, 10);
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
        var temp = createCanvas(psd.imageData.width, psd.imageData.height);
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
            var buffer = writeDataRLE(tempBuffer, imageData, width, height, [0], !!options.psb);
            if (RAW_IMAGE_DATA && layer.maskDataRaw) {
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
    var croppedData = createImageData(width, height);
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
    if (!background || options.noBackground || layer.mask || hasAlpha(data) || (RAW_IMAGE_DATA && ((_a = layer.imageDataRaw) === null || _a === void 0 ? void 0 : _a['-1']))) {
        channelIds.unshift(-1 /* Transparency */);
    }
    channels = channelIds.map(function (channel) {
        var offset = offsetForChannel(channel, false); // TODO: psd.colorMode === ColorMode.CMYK);
        var buffer = writeDataRLE(tempBuffer, data, width, height, [offset], !!options.psb);
        if (RAW_IMAGE_DATA && layer.imageDataRaw) {
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
export function writeColor(writer, color) {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLFFBQVEsVUFBQSxFQUFFLENBQUM7QUFDdEQsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEVBQTBCLEVBQUUsQ0FBUyxFQUFFLElBQVksRUFBRSxLQUFhO1FBQWhFLElBQUksVUFBQSxFQUFFLEtBQUssV0FBQTtJQUNoQyxJQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLElBQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUU3QyxLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDN0MsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2xCLE9BQU8sS0FBSyxDQUFDO1NBQ2I7S0FDRDtJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEVBQTBCLEVBQUUsQ0FBUyxFQUFFLEdBQVcsRUFBRSxNQUFjO1FBQWhFLElBQUksVUFBQSxFQUFFLEtBQUssV0FBQTtJQUNoQyxJQUFNLE1BQU0sR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0IsSUFBTSxLQUFLLEdBQUcsQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTdDLEtBQUssSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FB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LENBQUMsTUFBTSxvQkFBdUIsQ0FBQztRQUMxQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2RCxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQ3RCO0FBQ0YsQ0FBQyIsImZpbGUiOiJwc2RXcml0ZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQc2QsIExheWVyLCBMYXllckFkZGl0aW9uYWxJbmZvLCBDb2xvck1vZGUsIFNlY3Rpb25EaXZpZGVyVHlwZSwgV3JpdGVPcHRpb25zLCBDb2xvciwgR2xvYmFsTGF5ZXJNYXNrSW5mbyB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRoYXNBbHBoYSwgY3JlYXRlQ2FudmFzLCB3cml0ZURhdGFSTEUsIFBpeGVsRGF0YSwgTGF5ZXJDaGFubmVsRGF0YSwgQ2hhbm5lbERhdGEsXHJcblx0b2Zmc2V0Rm9yQ2hhbm5lbCwgY3JlYXRlSW1hZ2VEYXRhLCBmcm9tQmxlbmRNb2RlLCBDaGFubmVsSUQsIENvbXByZXNzaW9uLCBjbGFtcCxcclxuXHRMYXllck1hc2tGbGFncywgTWFza1BhcmFtcywgQ29sb3JTcGFjZSwgQm91bmRzLCBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cywgUkFXX0lNQUdFX0RBVEFcclxufSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBFeHRlbmRlZFdyaXRlT3B0aW9ucywgaGFzTXVsdGlFZmZlY3RzLCBpbmZvSGFuZGxlcnMgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgcmVzb3VyY2VIYW5kbGVycyB9IGZyb20gJy4vaW1hZ2VSZXNvdXJjZXMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQc2RXcml0ZXIge1xyXG5cdG9mZnNldDogbnVtYmVyO1xyXG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XHJcblx0dmlldzogRGF0YVZpZXc7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVXcml0ZXIoc2l6ZSA9IDQwOTYpOiBQc2RXcml0ZXIge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzaXplKTtcclxuXHRjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGJ1ZmZlcik7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gMDtcclxuXHRyZXR1cm4geyBidWZmZXIsIHZpZXcsIG9mZnNldCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyKSB7XHJcblx0cmV0dXJuIHdyaXRlci5idWZmZXIuc2xpY2UoMCwgd3JpdGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRXcml0ZXJCdWZmZXJOb0NvcHkod3JpdGVyOiBQc2RXcml0ZXIpIHtcclxuXHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlciwgMCwgd3JpdGVyLm9mZnNldCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQ4KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDEpO1xyXG5cdHdyaXRlci52aWV3LnNldFVpbnQ4KG9mZnNldCwgdmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcclxuXHR3cml0ZXIudmlldy5zZXRJbnQxNihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQxNih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCAyKTtcclxuXHR3cml0ZXIudmlldy5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcclxuXHR3cml0ZXIudmlldy5zZXRJbnQzMihvZmZzZXQsIHZhbHVlLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVpbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdGNvbnN0IG9mZnNldCA9IGFkZFNpemUod3JpdGVyLCA0KTtcclxuXHR3cml0ZXIudmlldy5zZXRVaW50MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDQpO1xyXG5cdHdyaXRlci52aWV3LnNldEZsb2F0MzIob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGbG9hdDY0KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgb2Zmc2V0ID0gYWRkU2l6ZSh3cml0ZXIsIDgpO1xyXG5cdHdyaXRlci52aWV3LnNldEZsb2F0NjQob2Zmc2V0LCB2YWx1ZSwgZmFsc2UpO1xyXG59XHJcblxyXG4vLyAzMi1iaXQgZml4ZWQtcG9pbnQgbnVtYmVyIDE2LjE2XHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IG51bWJlcikge1xyXG5cdHdyaXRlSW50MzIod3JpdGVyLCB2YWx1ZSAqICgxIDw8IDE2KSk7XHJcbn1cclxuXHJcbi8vIDMyLWJpdCBmaXhlZC1wb2ludCBudW1iZXIgOC4yNFxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHZhbHVlICogKDEgPDwgMjQpKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQnl0ZXMod3JpdGVyOiBQc2RXcml0ZXIsIGJ1ZmZlcjogVWludDhBcnJheSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChidWZmZXIpIHtcclxuXHRcdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICsgYnVmZmVyLmxlbmd0aCk7XHJcblx0XHRjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KHdyaXRlci5idWZmZXIpO1xyXG5cdFx0Ynl0ZXMuc2V0KGJ1ZmZlciwgd3JpdGVyLm9mZnNldCk7XHJcblx0XHR3cml0ZXIub2Zmc2V0ICs9IGJ1ZmZlci5sZW5ndGg7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVaZXJvcyh3cml0ZXI6IFBzZFdyaXRlciwgY291bnQ6IG51bWJlcikge1xyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlU2lnbmF0dXJlKHdyaXRlcjogUHNkV3JpdGVyLCBzaWduYXR1cmU6IHN0cmluZykge1xyXG5cdGlmIChzaWduYXR1cmUubGVuZ3RoICE9PSA0KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzaWduYXR1cmV9J2ApO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHNpZ25hdHVyZS5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nLCBwYWRUbzogbnVtYmVyKSB7XHJcblx0bGV0IGxlbmd0aCA9IHRleHQubGVuZ3RoO1xyXG5cdHdyaXRlVWludDgod3JpdGVyLCBsZW5ndGgpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcblx0XHRjb25zdCBjb2RlID0gdGV4dC5jaGFyQ29kZUF0KGkpO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGNvZGUgPCAxMjggPyBjb2RlIDogJz8nLmNoYXJDb2RlQXQoMCkpO1xyXG5cdH1cclxuXHJcblx0d2hpbGUgKCsrbGVuZ3RoICUgcGFkVG8pIHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyOiBQc2RXcml0ZXIsIHRleHQ6IHN0cmluZykge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgdGV4dC5sZW5ndGgpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXI6IFBzZFdyaXRlciwgdGV4dDogc3RyaW5nKSB7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCB0ZXh0Lmxlbmd0aCArIDEpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgdGV4dC5jaGFyQ29kZUF0KGkpKTtcclxuXHR9XHJcblxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExhcmdlc3RMYXllclNpemUobGF5ZXJzOiBMYXllcltdID0gW10pOiBudW1iZXIge1xyXG5cdGxldCBtYXggPSAwO1xyXG5cclxuXHRmb3IgKGNvbnN0IGxheWVyIG9mIGxheWVycykge1xyXG5cdFx0aWYgKGxheWVyLmNhbnZhcyB8fCBsYXllci5pbWFnZURhdGEpIHtcclxuXHRcdFx0Y29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xyXG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIDIgKiBoZWlnaHQgKyAyICogd2lkdGggKiBoZWlnaHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsYXllci5jaGlsZHJlbikge1xyXG5cdFx0XHRtYXggPSBNYXRoLm1heChtYXgsIGdldExhcmdlc3RMYXllclNpemUobGF5ZXIuY2hpbGRyZW4pKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBtYXg7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVNlY3Rpb24od3JpdGVyOiBQc2RXcml0ZXIsIHJvdW5kOiBudW1iZXIsIGZ1bmM6ICgpID0+IHZvaWQsIHdyaXRlVG90YWxMZW5ndGggPSBmYWxzZSwgbGFyZ2UgPSBmYWxzZSkge1xyXG5cdGlmIChsYXJnZSkgd3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHJcblx0Y29uc3Qgb2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDApO1xyXG5cclxuXHRmdW5jKCk7XHJcblxyXG5cdGxldCBsZW5ndGggPSB3cml0ZXIub2Zmc2V0IC0gb2Zmc2V0IC0gNDtcclxuXHRsZXQgbGVuID0gbGVuZ3RoO1xyXG5cclxuXHR3aGlsZSAoKGxlbiAlIHJvdW5kKSAhPT0gMCkge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdFx0bGVuKys7XHJcblx0fVxyXG5cclxuXHRpZiAod3JpdGVUb3RhbExlbmd0aCkge1xyXG5cdFx0bGVuZ3RoID0gbGVuO1xyXG5cdH1cclxuXHJcblx0d3JpdGVyLnZpZXcuc2V0VWludDMyKG9mZnNldCwgbGVuZ3RoLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZCh3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFdyaXRlT3B0aW9ucyA9IHt9KSB7XHJcblx0aWYgKCEoK3BzZC53aWR0aCA+IDAgJiYgK3BzZC5oZWlnaHQgPiAwKSlcclxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkb2N1bWVudCBzaXplJyk7XHJcblxyXG5cdGlmICgocHNkLndpZHRoID4gMzAwMDAgfHwgcHNkLmhlaWdodCA+IDMwMDAwKSAmJiAhb3B0aW9ucy5wc2IpXHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0RvY3VtZW50IHNpemUgaXMgdG9vIGxhcmdlIChtYXggaXMgMzAwMDB4MzAwMDAsIHVzZSBQU0IgZm9ybWF0IGluc3RlYWQpJyk7XHJcblxyXG5cdGxldCBpbWFnZVJlc291cmNlcyA9IHBzZC5pbWFnZVJlc291cmNlcyB8fCB7fTtcclxuXHJcblx0Y29uc3Qgb3B0OiBFeHRlbmRlZFdyaXRlT3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgbGF5ZXJJZHM6IFtdIH07XHJcblxyXG5cdGlmIChvcHQuZ2VuZXJhdGVUaHVtYm5haWwpIHtcclxuXHRcdGltYWdlUmVzb3VyY2VzID0geyAuLi5pbWFnZVJlc291cmNlcywgdGh1bWJuYWlsOiBjcmVhdGVUaHVtYm5haWwocHNkKSB9O1xyXG5cdH1cclxuXHJcblx0bGV0IGltYWdlRGF0YSA9IHBzZC5pbWFnZURhdGE7XHJcblxyXG5cdGlmICghaW1hZ2VEYXRhICYmIHBzZC5jYW52YXMpIHtcclxuXHRcdGltYWdlRGF0YSA9IHBzZC5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKDAsIDAsIHBzZC5jYW52YXMud2lkdGgsIHBzZC5jYW52YXMuaGVpZ2h0KTtcclxuXHR9XHJcblxyXG5cdGlmIChpbWFnZURhdGEgJiYgKHBzZC53aWR0aCAhPT0gaW1hZ2VEYXRhLndpZHRoIHx8IHBzZC5oZWlnaHQgIT09IGltYWdlRGF0YS5oZWlnaHQpKVxyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBjYW52YXMgbXVzdCBoYXZlIHRoZSBzYW1lIHNpemUgYXMgZG9jdW1lbnQnKTtcclxuXHJcblx0Y29uc3QgZ2xvYmFsQWxwaGEgPSAhIWltYWdlRGF0YSAmJiBoYXNBbHBoYShpbWFnZURhdGEpO1xyXG5cdGNvbnN0IG1heEJ1ZmZlclNpemUgPSBNYXRoLm1heChnZXRMYXJnZXN0TGF5ZXJTaXplKHBzZC5jaGlsZHJlbiksIDQgKiAyICogcHNkLndpZHRoICogcHNkLmhlaWdodCArIDIgKiBwc2QuaGVpZ2h0KTtcclxuXHRjb25zdCB0ZW1wQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobWF4QnVmZmVyU2l6ZSk7XHJcblxyXG5cdC8vIGhlYWRlclxyXG5cdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCUFMnKTtcclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIG9wdGlvbnMucHNiID8gMiA6IDEpOyAvLyB2ZXJzaW9uXHJcblx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyA0IDogMyk7IC8vIGNoYW5uZWxzXHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBwc2QuaGVpZ2h0KTtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIHBzZC53aWR0aCk7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCA4KTsgLy8gYml0cyBwZXIgY2hhbm5lbFxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JNb2RlLlJHQik7IC8vIHdlIG9ubHkgc3VwcG9ydCBzYXZpbmcgUkdCIHJpZ2h0IG5vd1xyXG5cclxuXHQvLyBjb2xvciBtb2RlIGRhdGFcclxuXHR3cml0ZVNlY3Rpb24od3JpdGVyLCAxLCAoKSA9PiB7XHJcblx0XHQvLyBUT0RPOiBpbXBsZW1lbnRcclxuXHR9KTtcclxuXHJcblx0Ly8gaW1hZ2UgcmVzb3VyY2VzXHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIHJlc291cmNlSGFuZGxlcnMpIHtcclxuXHRcdFx0aWYgKGhhbmRsZXIuaGFzKGltYWdlUmVzb3VyY2VzKSkge1xyXG5cdFx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGhhbmRsZXIua2V5KTtcclxuXHRcdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsICcnLCAyKTtcclxuXHRcdFx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiBoYW5kbGVyLndyaXRlKHdyaXRlciwgaW1hZ2VSZXNvdXJjZXMpKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHQvLyBsYXllciBhbmQgbWFzayBpbmZvXHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4ge1xyXG5cdFx0d3JpdGVMYXllckluZm8odGVtcEJ1ZmZlciwgd3JpdGVyLCBwc2QsIGdsb2JhbEFscGhhLCBvcHQpO1xyXG5cdFx0d3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlciwgcHNkLmdsb2JhbExheWVyTWFza0luZm8pO1xyXG5cdFx0d3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlciwgcHNkLCBwc2QsIG9wdCk7XHJcblx0fSwgdW5kZWZpbmVkLCAhIW9wdC5wc2IpO1xyXG5cclxuXHQvLyBpbWFnZSBkYXRhXHJcblx0Y29uc3QgY2hhbm5lbHMgPSBnbG9iYWxBbHBoYSA/IFswLCAxLCAyLCAzXSA6IFswLCAxLCAyXTtcclxuXHRjb25zdCBkYXRhOiBQaXhlbERhdGEgPSBpbWFnZURhdGEgfHwge1xyXG5cdFx0ZGF0YTogbmV3IFVpbnQ4QXJyYXkoNCAqIHBzZC53aWR0aCAqIHBzZC5oZWlnaHQpLFxyXG5cdFx0d2lkdGg6IHBzZC53aWR0aCxcclxuXHRcdGhlaWdodDogcHNkLmhlaWdodCxcclxuXHR9O1xyXG5cclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQpO1xyXG5cclxuXHRpZiAoUkFXX0lNQUdFX0RBVEEgJiYgKHBzZCBhcyBhbnkpLmltYWdlRGF0YVJhdykge1xyXG5cdFx0Y29uc29sZS5sb2coJ3dyaXRpbmcgcmF3IGltYWdlIGRhdGEnKTtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCAocHNkIGFzIGFueSkuaW1hZ2VEYXRhUmF3KTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3JpdGVCeXRlcyh3cml0ZXIsIHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCBwc2Qud2lkdGgsIHBzZC5oZWlnaHQsIGNoYW5uZWxzLCAhIW9wdGlvbnMucHNiKSk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUxheWVySW5mbyh0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCB3cml0ZXI6IFBzZFdyaXRlciwgcHNkOiBQc2QsIGdsb2JhbEFscGhhOiBib29sZWFuLCBvcHRpb25zOiBFeHRlbmRlZFdyaXRlT3B0aW9ucykge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDQsICgpID0+IHtcclxuXHRcdGNvbnN0IGxheWVyczogTGF5ZXJbXSA9IFtdO1xyXG5cclxuXHRcdGFkZENoaWxkcmVuKGxheWVycywgcHNkLmNoaWxkcmVuKTtcclxuXHJcblx0XHRpZiAoIWxheWVycy5sZW5ndGgpIGxheWVycy5wdXNoKHt9KTtcclxuXHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgZ2xvYmFsQWxwaGEgPyAtbGF5ZXJzLmxlbmd0aCA6IGxheWVycy5sZW5ndGgpO1xyXG5cclxuXHRcdGNvbnN0IGxheWVyc0RhdGEgPSBsYXllcnMubWFwKChsLCBpKSA9PiBnZXRDaGFubmVscyh0ZW1wQnVmZmVyLCBsLCBpID09PSAwLCBvcHRpb25zKSk7XHJcblxyXG5cdFx0Ly8gbGF5ZXIgcmVjb3Jkc1xyXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xyXG5cdFx0XHRjb25zdCB7IGxheWVyLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIGNoYW5uZWxzIH0gPSBsYXllckRhdGE7XHJcblxyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdG9wKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIGxlZnQpO1xyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgYm90dG9tKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHJpZ2h0KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVscy5sZW5ndGgpO1xyXG5cclxuXHRcdFx0Zm9yIChjb25zdCBjIG9mIGNoYW5uZWxzKSB7XHJcblx0XHRcdFx0d3JpdGVJbnQxNih3cml0ZXIsIGMuY2hhbm5lbElkKTtcclxuXHRcdFx0XHRpZiAob3B0aW9ucy5wc2IpIHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblx0XHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBjLmxlbmd0aCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmcm9tQmxlbmRNb2RlW2xheWVyLmJsZW5kTW9kZSFdIHx8ICdub3JtJyk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBNYXRoLnJvdW5kKGNsYW1wKGxheWVyLm9wYWNpdHkgPz8gMSwgMCwgMSkgKiAyNTUpKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGxheWVyLmNsaXBwaW5nID8gMSA6IDApO1xyXG5cclxuXHRcdFx0bGV0IGZsYWdzID0gMHgwODsgLy8gMSBmb3IgUGhvdG9zaG9wIDUuMCBhbmQgbGF0ZXIsIHRlbGxzIGlmIGJpdCA0IGhhcyB1c2VmdWwgaW5mb3JtYXRpb25cclxuXHRcdFx0aWYgKGxheWVyLnRyYW5zcGFyZW5jeVByb3RlY3RlZCkgZmxhZ3MgfD0gMHgwMTtcclxuXHRcdFx0aWYgKGxheWVyLmhpZGRlbikgZmxhZ3MgfD0gMHgwMjtcclxuXHRcdFx0aWYgKGxheWVyLnZlY3Rvck1hc2sgfHwgKGxheWVyLnNlY3Rpb25EaXZpZGVyICYmIGxheWVyLnNlY3Rpb25EaXZpZGVyLnR5cGUgIT09IFNlY3Rpb25EaXZpZGVyVHlwZS5PdGhlcikpIHtcclxuXHRcdFx0XHRmbGFncyB8PSAweDEwOyAvLyBwaXhlbCBkYXRhIGlycmVsZXZhbnQgdG8gYXBwZWFyYW5jZSBvZiBkb2N1bWVudFxyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChsYXllci5lZmZlY3RzICYmIGhhc011bHRpRWZmZWN0cyhsYXllci5lZmZlY3RzKSkge1xyXG5cdFx0XHRcdGZsYWdzIHw9IDB4MjA7IC8vIGp1c3QgZ3Vlc3NpbmcgdGhpcyBvbmUsIG1pZ2h0IGJlIGNvbXBsZXRlbHkgaW5jb3JyZWN0XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBmbGFncyk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTsgLy8gZmlsbGVyXHJcblx0XHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdFx0XHR3cml0ZUxheWVyTWFza0RhdGEod3JpdGVyLCBsYXllciwgbGF5ZXJEYXRhKTtcclxuXHRcdFx0XHR3cml0ZUxheWVyQmxlbmRpbmdSYW5nZXMod3JpdGVyLCBwc2QpO1xyXG5cdFx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgbGF5ZXIubmFtZSB8fCAnJywgNCk7XHJcblx0XHRcdFx0d3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlciwgbGF5ZXIsIHBzZCwgb3B0aW9ucyk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGxheWVyIGNoYW5uZWwgaW1hZ2UgZGF0YVxyXG5cdFx0Zm9yIChjb25zdCBsYXllckRhdGEgb2YgbGF5ZXJzRGF0YSkge1xyXG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgbGF5ZXJEYXRhLmNoYW5uZWxzKSB7XHJcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsLmNvbXByZXNzaW9uKTtcclxuXHJcblx0XHRcdFx0aWYgKGNoYW5uZWwuYnVmZmVyKSB7XHJcblx0XHRcdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgY2hhbm5lbC5idWZmZXIpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sIHRydWUsIG9wdGlvbnMucHNiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMYXllck1hc2tEYXRhKHdyaXRlcjogUHNkV3JpdGVyLCB7IG1hc2sgfTogTGF5ZXIsIGxheWVyRGF0YTogTGF5ZXJDaGFubmVsRGF0YSkge1xyXG5cdHdyaXRlU2VjdGlvbih3cml0ZXIsIDEsICgpID0+IHtcclxuXHRcdGlmICghbWFzaykgcmV0dXJuO1xyXG5cclxuXHRcdGNvbnN0IG0gPSBsYXllckRhdGEubWFzayB8fCB7fSBhcyBQYXJ0aWFsPEJvdW5kcz47XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgbS50b3AhKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmxlZnQhKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCBtLmJvdHRvbSEpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIG0ucmlnaHQhKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBtYXNrLmRlZmF1bHRDb2xvciEpO1xyXG5cclxuXHRcdGxldCBwYXJhbXMgPSAwO1xyXG5cdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlVzZXJNYXNrRGVuc2l0eTtcclxuXHRcdGlmIChtYXNrLnVzZXJNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5Vc2VyTWFza0ZlYXRoZXI7XHJcblx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwYXJhbXMgfD0gTWFza1BhcmFtcy5WZWN0b3JNYXNrRGVuc2l0eTtcclxuXHRcdGlmIChtYXNrLnZlY3Rvck1hc2tGZWF0aGVyICE9PSB1bmRlZmluZWQpIHBhcmFtcyB8PSBNYXNrUGFyYW1zLlZlY3Rvck1hc2tGZWF0aGVyO1xyXG5cclxuXHRcdGxldCBmbGFncyA9IDA7XHJcblx0XHRpZiAobWFzay5kaXNhYmxlZCkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRGlzYWJsZWQ7XHJcblx0XHRpZiAobWFzay5wb3NpdGlvblJlbGF0aXZlVG9MYXllcikgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuUG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXI7XHJcblx0XHRpZiAobWFzay5mcm9tVmVjdG9yRGF0YSkgZmxhZ3MgfD0gTGF5ZXJNYXNrRmxhZ3MuTGF5ZXJNYXNrRnJvbVJlbmRlcmluZ090aGVyRGF0YTtcclxuXHRcdGlmIChwYXJhbXMpIGZsYWdzIHw9IExheWVyTWFza0ZsYWdzLk1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQ7XHJcblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGZsYWdzKTtcclxuXHJcblx0XHRpZiAocGFyYW1zKSB7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBwYXJhbXMpO1xyXG5cclxuXHRcdFx0aWYgKG1hc2sudXNlck1hc2tEZW5zaXR5ICE9PSB1bmRlZmluZWQpIHdyaXRlVWludDgod3JpdGVyLCBNYXRoLnJvdW5kKG1hc2sudXNlck1hc2tEZW5zaXR5ICogMHhmZikpO1xyXG5cdFx0XHRpZiAobWFzay51c2VyTWFza0ZlYXRoZXIgIT09IHVuZGVmaW5lZCkgd3JpdGVGbG9hdDY0KHdyaXRlciwgbWFzay51c2VyTWFza0ZlYXRoZXIpO1xyXG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSB3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZChtYXNrLnZlY3Rvck1hc2tEZW5zaXR5ICogMHhmZikpO1xyXG5cdFx0XHRpZiAobWFzay52ZWN0b3JNYXNrRmVhdGhlciAhPT0gdW5kZWZpbmVkKSB3cml0ZUZsb2F0NjQod3JpdGVyLCBtYXNrLnZlY3Rvck1hc2tGZWF0aGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBUT0RPOiBoYW5kbGUgcmVzdCBvZiB0aGUgZmllbGRzXHJcblxyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUxheWVyQmxlbmRpbmdSYW5nZXMod3JpdGVyOiBQc2RXcml0ZXIsIHBzZDogUHNkKSB7XHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA2NTUzNSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHJcblx0XHRsZXQgY2hhbm5lbHMgPSBwc2QuY2hhbm5lbHMgfHwgMDsgLy8gVE9ETzogdXNlIGFsd2F5cyA0IGluc3RlYWQgP1xyXG5cdFx0Ly8gY2hhbm5lbHMgPSA0OyAvLyBURVNUSU5HXHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjaGFubmVsczsgaSsrKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgNjU1MzUpO1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDY1NTM1KTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVHbG9iYWxMYXllck1hc2tJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCBpbmZvOiBHbG9iYWxMYXllck1hc2tJbmZvIHwgdW5kZWZpbmVkKSB7XHJcblx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMSwgKCkgPT4ge1xyXG5cdFx0aWYgKGluZm8pIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm92ZXJsYXlDb2xvclNwYWNlKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UxKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UyKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2UzKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3BhY2U0KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm9wYWNpdHkgKiAweGZmKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ua2luZCk7XHJcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVBZGRpdGlvbmFsTGF5ZXJJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBFeHRlbmRlZFdyaXRlT3B0aW9ucykge1xyXG5cdGZvciAoY29uc3QgaGFuZGxlciBvZiBpbmZvSGFuZGxlcnMpIHtcclxuXHRcdGxldCBrZXkgPSBoYW5kbGVyLmtleTtcclxuXHJcblx0XHRpZiAoa2V5ID09PSAnVHh0MicgJiYgb3B0aW9ucy5pbnZhbGlkYXRlVGV4dExheWVycykgY29udGludWU7XHJcblx0XHRpZiAoa2V5ID09PSAndm1zaycgJiYgb3B0aW9ucy5wc2IpIGtleSA9ICd2c21zJztcclxuXHJcblx0XHRpZiAoaGFuZGxlci5oYXModGFyZ2V0KSkge1xyXG5cdFx0XHRjb25zdCBsYXJnZSA9IG9wdGlvbnMucHNiICYmIGxhcmdlQWRkaXRpb25hbEluZm9LZXlzLmluZGV4T2Yoa2V5KSAhPT0gLTE7XHJcblxyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGxhcmdlID8gJzhCNjQnIDogJzhCSU0nKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBrZXkpO1xyXG5cclxuXHRcdFx0Y29uc3QgZm91ckJ5dGVzID0ga2V5ID09PSAnVHh0MicgfHwga2V5ID09PSAnbHVuaScgfHwga2V5ID09PSAndm1zaycgfHwga2V5ID09PSAnYXJ0YicgfHwga2V5ID09PSAnYXJ0ZCcgfHxcclxuXHRcdFx0XHRrZXkgPT09ICd2b2drJyB8fCBrZXkgPT09ICdTb0xkJyB8fCBrZXkgPT09ICdsbmsyJyB8fCBrZXkgPT09ICd2c2NnJyB8fCBrZXkgPT09ICd2c21zJyB8fCBrZXkgPT09ICdHZEZsJyB8fFxyXG5cdFx0XHRcdGtleSA9PT0gJ2xtZngnIHx8IGtleSA9PT0gJ2xyRlgnIHx8IGtleSA9PT0gJ2NpbmYnIHx8IGtleSA9PT0gJ1BsTGQnIHx8IGtleSA9PT0gJ0Fubm8nO1xyXG5cclxuXHRcdFx0d3JpdGVTZWN0aW9uKHdyaXRlciwgZm91ckJ5dGVzID8gNCA6IDIsICgpID0+IHtcclxuXHRcdFx0XHRoYW5kbGVyLndyaXRlKHdyaXRlciwgdGFyZ2V0LCBwc2QsIG9wdGlvbnMpO1xyXG5cdFx0XHR9LCBrZXkgIT09ICdUeHQyJyAmJiBrZXkgIT09ICdjaW5mJyAmJiBrZXkgIT09ICdleHRuJywgbGFyZ2UpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gYWRkQ2hpbGRyZW4obGF5ZXJzOiBMYXllcltdLCBjaGlsZHJlbjogTGF5ZXJbXSB8IHVuZGVmaW5lZCkge1xyXG5cdGlmICghY2hpbGRyZW4pIHJldHVybjtcclxuXHJcblx0Zm9yIChjb25zdCBjIG9mIGNoaWxkcmVuKSB7XHJcblx0XHRpZiAoYy5jaGlsZHJlbiAmJiBjLmNhbnZhcykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxheWVyLCBjYW5ub3QgaGF2ZSBib3RoICdjYW52YXMnIGFuZCAnY2hpbGRyZW4nIHByb3BlcnRpZXNgKTtcclxuXHRcdGlmIChjLmNoaWxkcmVuICYmIGMuaW1hZ2VEYXRhKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2ltYWdlRGF0YScgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xyXG5cclxuXHRcdGlmIChjLmNoaWxkcmVuKSB7XHJcblx0XHRcdGxheWVycy5wdXNoKHtcclxuXHRcdFx0XHRuYW1lOiAnPC9MYXllciBncm91cD4nLFxyXG5cdFx0XHRcdHNlY3Rpb25EaXZpZGVyOiB7XHJcblx0XHRcdFx0XHR0eXBlOiBTZWN0aW9uRGl2aWRlclR5cGUuQm91bmRpbmdTZWN0aW9uRGl2aWRlcixcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8vIFRFU1RJTkdcclxuXHRcdFx0XHQvLyBuYW1lU291cmNlOiAnbHNldCcsXHJcblx0XHRcdFx0Ly8gaWQ6IFs0LCAwLCAwLCA4LCAxMSwgMCwgMCwgMCwgMCwgMTRdW2xheWVycy5sZW5ndGhdIHx8IDAsXHJcblx0XHRcdFx0Ly8gbGF5ZXJDb2xvcjogJ25vbmUnLFxyXG5cdFx0XHRcdC8vIHRpbWVzdGFtcDogWzE2MTEzNDY4MTcuMzQ5MDIxLCAwLCAwLCAxNjExMzQ2ODE3LjM0OTE3NSwgMTYxMTM0NjgxNy4zNDkxODMzLCAwLCAwLCAwLCAwLCAxNjExMzQ2ODE3LjM0OTgzMl1bbGF5ZXJzLmxlbmd0aF0gfHwgMCxcclxuXHRcdFx0XHQvLyBwcm90ZWN0ZWQ6IHt9LFxyXG5cdFx0XHRcdC8vIHJlZmVyZW5jZVBvaW50OiB7IHg6IDAsIHk6IDAgfSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGFkZENoaWxkcmVuKGxheWVycywgYy5jaGlsZHJlbik7XHJcblx0XHRcdGxheWVycy5wdXNoKHtcclxuXHRcdFx0XHRzZWN0aW9uRGl2aWRlcjoge1xyXG5cdFx0XHRcdFx0dHlwZTogYy5vcGVuZWQgPT09IGZhbHNlID8gU2VjdGlvbkRpdmlkZXJUeXBlLkNsb3NlZEZvbGRlciA6IFNlY3Rpb25EaXZpZGVyVHlwZS5PcGVuRm9sZGVyLFxyXG5cdFx0XHRcdFx0a2V5OiBmcm9tQmxlbmRNb2RlW2MuYmxlbmRNb2RlIV0gfHwgJ3Bhc3MnLFxyXG5cdFx0XHRcdFx0c3ViVHlwZTogMCxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC4uLmMsXHJcblx0XHRcdH0pO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0bGF5ZXJzLnB1c2goeyAuLi5jIH0pO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVzaXplQnVmZmVyKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRsZXQgbmV3TGVuZ3RoID0gd3JpdGVyLmJ1ZmZlci5ieXRlTGVuZ3RoO1xyXG5cclxuXHRkbyB7XHJcblx0XHRuZXdMZW5ndGggKj0gMjtcclxuXHR9IHdoaWxlIChzaXplID4gbmV3TGVuZ3RoKTtcclxuXHJcblx0Y29uc3QgbmV3QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKG5ld0xlbmd0aCk7XHJcblx0Y29uc3QgbmV3Qnl0ZXMgPSBuZXcgVWludDhBcnJheShuZXdCdWZmZXIpO1xyXG5cdGNvbnN0IG9sZEJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkod3JpdGVyLmJ1ZmZlcik7XHJcblx0bmV3Qnl0ZXMuc2V0KG9sZEJ5dGVzKTtcclxuXHR3cml0ZXIuYnVmZmVyID0gbmV3QnVmZmVyO1xyXG5cdHdyaXRlci52aWV3ID0gbmV3IERhdGFWaWV3KHdyaXRlci5idWZmZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbnN1cmVTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRpZiAoc2l6ZSA+IHdyaXRlci5idWZmZXIuYnl0ZUxlbmd0aCkge1xyXG5cdFx0cmVzaXplQnVmZmVyKHdyaXRlciwgc2l6ZSk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRTaXplKHdyaXRlcjogUHNkV3JpdGVyLCBzaXplOiBudW1iZXIpIHtcclxuXHRjb25zdCBvZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xyXG5cdGVuc3VyZVNpemUod3JpdGVyLCB3cml0ZXIub2Zmc2V0ICs9IHNpemUpO1xyXG5cdHJldHVybiBvZmZzZXQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVRodW1ibmFpbChwc2Q6IFBzZCkge1xyXG5cdGNvbnN0IGNhbnZhcyA9IGNyZWF0ZUNhbnZhcygxMCwgMTApO1xyXG5cdGxldCBzY2FsZSA9IDE7XHJcblxyXG5cdGlmIChwc2Qud2lkdGggPiBwc2QuaGVpZ2h0KSB7XHJcblx0XHRjYW52YXMud2lkdGggPSAxNjA7XHJcblx0XHRjYW52YXMuaGVpZ2h0ID0gTWF0aC5mbG9vcihwc2QuaGVpZ2h0ICogKGNhbnZhcy53aWR0aCAvIHBzZC53aWR0aCkpO1xyXG5cdFx0c2NhbGUgPSBjYW52YXMud2lkdGggLyBwc2Qud2lkdGg7XHJcblx0fSBlbHNlIHtcclxuXHRcdGNhbnZhcy5oZWlnaHQgPSAxNjA7XHJcblx0XHRjYW52YXMud2lkdGggPSBNYXRoLmZsb29yKHBzZC53aWR0aCAqIChjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodCkpO1xyXG5cdFx0c2NhbGUgPSBjYW52YXMuaGVpZ2h0IC8gcHNkLmhlaWdodDtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSE7XHJcblx0Y29udGV4dC5zY2FsZShzY2FsZSwgc2NhbGUpO1xyXG5cclxuXHRpZiAocHNkLmltYWdlRGF0YSkge1xyXG5cdFx0Y29uc3QgdGVtcCA9IGNyZWF0ZUNhbnZhcyhwc2QuaW1hZ2VEYXRhLndpZHRoLCBwc2QuaW1hZ2VEYXRhLmhlaWdodCk7XHJcblx0XHR0ZW1wLmdldENvbnRleHQoJzJkJykhLnB1dEltYWdlRGF0YShwc2QuaW1hZ2VEYXRhLCAwLCAwKTtcclxuXHRcdGNvbnRleHQuZHJhd0ltYWdlKHRlbXAsIDAsIDApO1xyXG5cdH0gZWxzZSBpZiAocHNkLmNhbnZhcykge1xyXG5cdFx0Y29udGV4dC5kcmF3SW1hZ2UocHNkLmNhbnZhcywgMCwgMCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY2FudmFzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDaGFubmVscyhcclxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xyXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcclxuXHRjb25zdCBsYXllckRhdGEgPSBnZXRMYXllckNoYW5uZWxzKHRlbXBCdWZmZXIsIGxheWVyLCBiYWNrZ3JvdW5kLCBvcHRpb25zKTtcclxuXHRjb25zdCBtYXNrID0gbGF5ZXIubWFzaztcclxuXHJcblx0aWYgKG1hc2spIHtcclxuXHRcdGxldCB7IHRvcCA9IDAsIGxlZnQgPSAwLCByaWdodCA9IDAsIGJvdHRvbSA9IDAgfSA9IG1hc2s7XHJcblx0XHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobWFzayk7XHJcblx0XHRsZXQgaW1hZ2VEYXRhID0gbWFzay5pbWFnZURhdGE7XHJcblxyXG5cdFx0aWYgKCFpbWFnZURhdGEgJiYgbWFzay5jYW52YXMgJiYgd2lkdGggJiYgaGVpZ2h0KSB7XHJcblx0XHRcdGltYWdlRGF0YSA9IG1hc2suY2FudmFzLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAod2lkdGggJiYgaGVpZ2h0ICYmIGltYWdlRGF0YSkge1xyXG5cdFx0XHRyaWdodCA9IGxlZnQgKyB3aWR0aDtcclxuXHRcdFx0Ym90dG9tID0gdG9wICsgaGVpZ2h0O1xyXG5cclxuXHRcdFx0bGV0IGJ1ZmZlciA9IHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBpbWFnZURhdGEsIHdpZHRoLCBoZWlnaHQsIFswXSwgISFvcHRpb25zLnBzYikhO1xyXG5cclxuXHRcdFx0aWYgKFJBV19JTUFHRV9EQVRBICYmIChsYXllciBhcyBhbnkpLm1hc2tEYXRhUmF3KSB7XHJcblx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ3dyaXR0ZW4gcmF3IGxheWVyIGltYWdlIGRhdGEnKTtcclxuXHRcdFx0XHRidWZmZXIgPSAobGF5ZXIgYXMgYW55KS5tYXNrRGF0YVJhdztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGF5ZXJEYXRhLm1hc2sgPSB7IHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSB9O1xyXG5cdFx0XHRsYXllckRhdGEuY2hhbm5lbHMucHVzaCh7XHJcblx0XHRcdFx0Y2hhbm5lbElkOiBDaGFubmVsSUQuVXNlck1hc2ssXHJcblx0XHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQsXHJcblx0XHRcdFx0YnVmZmVyOiBidWZmZXIsXHJcblx0XHRcdFx0bGVuZ3RoOiAyICsgYnVmZmVyLmxlbmd0aCxcclxuXHRcdFx0fSk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRsYXllckRhdGEubWFzayA9IHsgdG9wOiAwLCBsZWZ0OiAwLCByaWdodDogMCwgYm90dG9tOiAwIH07XHJcblx0XHRcdGxheWVyRGF0YS5jaGFubmVscy5wdXNoKHtcclxuXHRcdFx0XHRjaGFubmVsSWQ6IENoYW5uZWxJRC5Vc2VyTWFzayxcclxuXHRcdFx0XHRjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSxcclxuXHRcdFx0XHRidWZmZXI6IG5ldyBVaW50OEFycmF5KDApLFxyXG5cdFx0XHRcdGxlbmd0aDogMCxcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gbGF5ZXJEYXRhO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMYXllckRpbWVudGlvbnMoeyBjYW52YXMsIGltYWdlRGF0YSB9OiBMYXllcik6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IH0ge1xyXG5cdHJldHVybiBpbWFnZURhdGEgfHwgY2FudmFzIHx8IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBjcm9wSW1hZ2VEYXRhKGRhdGE6IEltYWdlRGF0YSwgbGVmdDogbnVtYmVyLCB0b3A6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHRjb25zdCBjcm9wcGVkRGF0YSA9IGNyZWF0ZUltYWdlRGF0YSh3aWR0aCwgaGVpZ2h0KTtcclxuXHRjb25zdCBzcmNEYXRhID0gZGF0YS5kYXRhO1xyXG5cdGNvbnN0IGRzdERhdGEgPSBjcm9wcGVkRGF0YS5kYXRhO1xyXG5cclxuXHRmb3IgKGxldCB5ID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XHJcblx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcclxuXHRcdFx0bGV0IHNyYyA9ICgoeCArIGxlZnQpICsgKHkgKyB0b3ApICogd2lkdGgpICogNDtcclxuXHRcdFx0bGV0IGRzdCA9ICh4ICsgeSAqIHdpZHRoKSAqIDQ7XHJcblx0XHRcdGRzdERhdGFbZHN0XSA9IHNyY0RhdGFbc3JjXTtcclxuXHRcdFx0ZHN0RGF0YVtkc3QgKyAxXSA9IHNyY0RhdGFbc3JjICsgMV07XHJcblx0XHRcdGRzdERhdGFbZHN0ICsgMl0gPSBzcmNEYXRhW3NyYyArIDJdO1xyXG5cdFx0XHRkc3REYXRhW2RzdCArIDNdID0gc3JjRGF0YVtzcmMgKyAzXTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBjcm9wcGVkRGF0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGF5ZXJDaGFubmVscyhcclxuXHR0ZW1wQnVmZmVyOiBVaW50OEFycmF5LCBsYXllcjogTGF5ZXIsIGJhY2tncm91bmQ6IGJvb2xlYW4sIG9wdGlvbnM6IFdyaXRlT3B0aW9uc1xyXG4pOiBMYXllckNoYW5uZWxEYXRhIHtcclxuXHRsZXQgeyB0b3AgPSAwLCBsZWZ0ID0gMCwgcmlnaHQgPSAwLCBib3R0b20gPSAwIH0gPSBsYXllcjtcclxuXHRsZXQgY2hhbm5lbHM6IENoYW5uZWxEYXRhW10gPSBbXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELlRyYW5zcGFyZW5jeSwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRcdHsgY2hhbm5lbElkOiBDaGFubmVsSUQuQ29sb3IwLCBjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uUmF3RGF0YSwgYnVmZmVyOiB1bmRlZmluZWQsIGxlbmd0aDogMiB9LFxyXG5cdFx0eyBjaGFubmVsSWQ6IENoYW5uZWxJRC5Db2xvcjEsIGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbi5SYXdEYXRhLCBidWZmZXI6IHVuZGVmaW5lZCwgbGVuZ3RoOiAyIH0sXHJcblx0XHR7IGNoYW5uZWxJZDogQ2hhbm5lbElELkNvbG9yMiwgY29tcHJlc3Npb246IENvbXByZXNzaW9uLlJhd0RhdGEsIGJ1ZmZlcjogdW5kZWZpbmVkLCBsZW5ndGg6IDIgfSxcclxuXHRdO1xyXG5cclxuXHRsZXQgeyB3aWR0aCwgaGVpZ2h0IH0gPSBnZXRMYXllckRpbWVudGlvbnMobGF5ZXIpO1xyXG5cclxuXHRpZiAoIShsYXllci5jYW52YXMgfHwgbGF5ZXIuaW1hZ2VEYXRhKSB8fCAhd2lkdGggfHwgIWhlaWdodCkge1xyXG5cdFx0cmlnaHQgPSBsZWZ0O1xyXG5cdFx0Ym90dG9tID0gdG9wO1xyXG5cdFx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxuXHR9XHJcblxyXG5cdHJpZ2h0ID0gbGVmdCArIHdpZHRoO1xyXG5cdGJvdHRvbSA9IHRvcCArIGhlaWdodDtcclxuXHJcblx0bGV0IGRhdGEgPSBsYXllci5pbWFnZURhdGEgfHwgbGF5ZXIuY2FudmFzIS5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblxyXG5cdGlmIChvcHRpb25zLnRyaW1JbWFnZURhdGEpIHtcclxuXHRcdGNvbnN0IHRyaW1tZWQgPSB0cmltRGF0YShkYXRhKTtcclxuXHJcblx0XHRpZiAodHJpbW1lZC5sZWZ0ICE9PSAwIHx8IHRyaW1tZWQudG9wICE9PSAwIHx8IHRyaW1tZWQucmlnaHQgIT09IGRhdGEud2lkdGggfHwgdHJpbW1lZC5ib3R0b20gIT09IGRhdGEuaGVpZ2h0KSB7XHJcblx0XHRcdGxlZnQgKz0gdHJpbW1lZC5sZWZ0O1xyXG5cdFx0XHR0b3AgKz0gdHJpbW1lZC50b3A7XHJcblx0XHRcdHJpZ2h0IC09IChkYXRhLndpZHRoIC0gdHJpbW1lZC5yaWdodCk7XHJcblx0XHRcdGJvdHRvbSAtPSAoZGF0YS5oZWlnaHQgLSB0cmltbWVkLmJvdHRvbSk7XHJcblx0XHRcdHdpZHRoID0gcmlnaHQgLSBsZWZ0O1xyXG5cdFx0XHRoZWlnaHQgPSBib3R0b20gLSB0b3A7XHJcblxyXG5cdFx0XHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpIHtcclxuXHRcdFx0XHRyZXR1cm4geyBsYXllciwgdG9wLCBsZWZ0LCByaWdodCwgYm90dG9tLCBjaGFubmVscyB9O1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAobGF5ZXIuaW1hZ2VEYXRhKSB7XHJcblx0XHRcdFx0ZGF0YSA9IGNyb3BJbWFnZURhdGEoZGF0YSwgdHJpbW1lZC5sZWZ0LCB0cmltbWVkLnRvcCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZGF0YSA9IGxheWVyLmNhbnZhcyEuZ2V0Q29udGV4dCgnMmQnKSEuZ2V0SW1hZ2VEYXRhKHRyaW1tZWQubGVmdCwgdHJpbW1lZC50b3AsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjb25zdCBjaGFubmVsSWRzID0gW1xyXG5cdFx0Q2hhbm5lbElELkNvbG9yMCxcclxuXHRcdENoYW5uZWxJRC5Db2xvcjEsXHJcblx0XHRDaGFubmVsSUQuQ29sb3IyLFxyXG5cdF07XHJcblxyXG5cdGlmICghYmFja2dyb3VuZCB8fCBvcHRpb25zLm5vQmFja2dyb3VuZCB8fCBsYXllci5tYXNrIHx8IGhhc0FscGhhKGRhdGEpIHx8IChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXc/LlsnLTEnXSkpIHtcclxuXHRcdGNoYW5uZWxJZHMudW5zaGlmdChDaGFubmVsSUQuVHJhbnNwYXJlbmN5KTtcclxuXHR9XHJcblxyXG5cdGNoYW5uZWxzID0gY2hhbm5lbElkcy5tYXAoY2hhbm5lbCA9PiB7XHJcblx0XHRjb25zdCBvZmZzZXQgPSBvZmZzZXRGb3JDaGFubmVsKGNoYW5uZWwsIGZhbHNlKTsgLy8gVE9ETzogcHNkLmNvbG9yTW9kZSA9PT0gQ29sb3JNb2RlLkNNWUspO1xyXG5cdFx0bGV0IGJ1ZmZlciA9IHdyaXRlRGF0YVJMRSh0ZW1wQnVmZmVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBbb2Zmc2V0XSwgISFvcHRpb25zLnBzYikhO1xyXG5cclxuXHRcdGlmIChSQVdfSU1BR0VfREFUQSAmJiAobGF5ZXIgYXMgYW55KS5pbWFnZURhdGFSYXcpIHtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2coJ3dyaXR0ZW4gcmF3IGxheWVyIGltYWdlIGRhdGEnKTtcclxuXHRcdFx0YnVmZmVyID0gKGxheWVyIGFzIGFueSkuaW1hZ2VEYXRhUmF3W2NoYW5uZWxdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGNoYW5uZWxJZDogY2hhbm5lbCxcclxuXHRcdFx0Y29tcHJlc3Npb246IENvbXByZXNzaW9uLlJsZUNvbXByZXNzZWQsXHJcblx0XHRcdGJ1ZmZlcjogYnVmZmVyLFxyXG5cdFx0XHRsZW5ndGg6IDIgKyBidWZmZXIubGVuZ3RoLFxyXG5cdFx0fTtcclxuXHR9KTtcclxuXHJcblx0cmV0dXJuIHsgbGF5ZXIsIHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSwgY2hhbm5lbHMgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNSb3dFbXB0eSh7IGRhdGEsIHdpZHRoIH06IFBpeGVsRGF0YSwgeTogbnVtYmVyLCBsZWZ0OiBudW1iZXIsIHJpZ2h0OiBudW1iZXIpIHtcclxuXHRjb25zdCBzdGFydCA9ICgoeSAqIHdpZHRoICsgbGVmdCkgKiA0ICsgMykgfCAwO1xyXG5cdGNvbnN0IGVuZCA9IChzdGFydCArIChyaWdodCAtIGxlZnQpICogNCkgfCAwO1xyXG5cclxuXHRmb3IgKGxldCBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgPSAoaSArIDQpIHwgMCkge1xyXG5cdFx0aWYgKGRhdGFbaV0gIT09IDApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGlzQ29sRW1wdHkoeyBkYXRhLCB3aWR0aCB9OiBQaXhlbERhdGEsIHg6IG51bWJlciwgdG9wOiBudW1iZXIsIGJvdHRvbTogbnVtYmVyKSB7XHJcblx0Y29uc3Qgc3RyaWRlID0gKHdpZHRoICogNCkgfCAwO1xyXG5cdGNvbnN0IHN0YXJ0ID0gKHRvcCAqIHN0cmlkZSArIHggKiA0ICsgMykgfCAwO1xyXG5cclxuXHRmb3IgKGxldCB5ID0gdG9wLCBpID0gc3RhcnQ7IHkgPCBib3R0b207IHkrKywgaSA9IChpICsgc3RyaWRlKSB8IDApIHtcclxuXHRcdGlmIChkYXRhW2ldICE9PSAwKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cmltRGF0YShkYXRhOiBQaXhlbERhdGEpIHtcclxuXHRsZXQgdG9wID0gMDtcclxuXHRsZXQgbGVmdCA9IDA7XHJcblx0bGV0IHJpZ2h0ID0gZGF0YS53aWR0aDtcclxuXHRsZXQgYm90dG9tID0gZGF0YS5oZWlnaHQ7XHJcblxyXG5cdHdoaWxlICh0b3AgPCBib3R0b20gJiYgaXNSb3dFbXB0eShkYXRhLCB0b3AsIGxlZnQsIHJpZ2h0KSlcclxuXHRcdHRvcCsrO1xyXG5cdHdoaWxlIChib3R0b20gPiB0b3AgJiYgaXNSb3dFbXB0eShkYXRhLCBib3R0b20gLSAxLCBsZWZ0LCByaWdodCkpXHJcblx0XHRib3R0b20tLTtcclxuXHR3aGlsZSAobGVmdCA8IHJpZ2h0ICYmIGlzQ29sRW1wdHkoZGF0YSwgbGVmdCwgdG9wLCBib3R0b20pKVxyXG5cdFx0bGVmdCsrO1xyXG5cdHdoaWxlIChyaWdodCA+IGxlZnQgJiYgaXNDb2xFbXB0eShkYXRhLCByaWdodCAtIDEsIHRvcCwgYm90dG9tKSlcclxuXHRcdHJpZ2h0LS07XHJcblxyXG5cdHJldHVybiB7IHRvcCwgbGVmdCwgcmlnaHQsIGJvdHRvbSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVDb2xvcih3cml0ZXI6IFBzZFdyaXRlciwgY29sb3I6IENvbG9yIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKCFjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLlJHQik7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgOCk7XHJcblx0fSBlbHNlIGlmICgncicgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5SR0IpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnIgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5nICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxuXHR9IGVsc2UgaWYgKCdsJyBpbiBjb2xvcikge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBDb2xvclNwYWNlLkxhYik7XHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5sICogMTAwMDApKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmEgPCAwID8gKGNvbG9yLmEgKiAxMjgwMCkgOiAoY29sb3IuYSAqIDEyNzAwKSkpO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IuYiA8IDAgPyAoY29sb3IuYiAqIDEyODAwKSA6IChjb2xvci5iICogMTI3MDApKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdH0gZWxzZSBpZiAoJ2gnIGluIGNvbG9yKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIENvbG9yU3BhY2UuSFNCKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5oICogMHhmZmZmKSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IucyAqIDB4ZmZmZikpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmIgKiAweGZmZmYpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0fSBlbHNlIGlmICgnYycgaW4gY29sb3IpIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5DTVlLKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5jICogMjU3KSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoY29sb3IubSAqIDI1NykpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLnkgKiAyNTcpKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjb2xvci5rICogMjU3KSk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgQ29sb3JTcGFjZS5HcmF5c2NhbGUpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNvbG9yLmsgKiAxMDAwMCAvIDI1NSkpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xyXG5cdH1cclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
