"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCanvas = exports.createImageData = exports.createCanvasFromData = exports.createCanvas = exports.writeDataRLE = exports.writeDataRaw = exports.decodeBitmap = exports.resetImageData = exports.hasAlpha = exports.clamp = exports.offsetForChannel = exports.Compression = exports.ChannelID = exports.MaskParams = exports.LayerMaskFlags = exports.ColorSpace = exports.createEnum = exports.revMap = exports.largeAdditionalInfoKeys = exports.layerColors = exports.toBlendMode = exports.fromBlendMode = exports.RAW_IMAGE_DATA = exports.MOCK_HANDLERS = void 0;
var base64_js_1 = require("base64-js");
exports.MOCK_HANDLERS = false;
exports.RAW_IMAGE_DATA = false;
exports.fromBlendMode = {};
exports.toBlendMode = {
    'pass': 'pass through',
    'norm': 'normal',
    'diss': 'dissolve',
    'dark': 'darken',
    'mul ': 'multiply',
    'idiv': 'color burn',
    'lbrn': 'linear burn',
    'dkCl': 'darker color',
    'lite': 'lighten',
    'scrn': 'screen',
    'div ': 'color dodge',
    'lddg': 'linear dodge',
    'lgCl': 'lighter color',
    'over': 'overlay',
    'sLit': 'soft light',
    'hLit': 'hard light',
    'vLit': 'vivid light',
    'lLit': 'linear light',
    'pLit': 'pin light',
    'hMix': 'hard mix',
    'diff': 'difference',
    'smud': 'exclusion',
    'fsub': 'subtract',
    'fdiv': 'divide',
    'hue ': 'hue',
    'sat ': 'saturation',
    'colr': 'color',
    'lum ': 'luminosity',
};
Object.keys(exports.toBlendMode).forEach(function (key) { return exports.fromBlendMode[exports.toBlendMode[key]] = key; });
exports.layerColors = [
    'none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'
];
exports.largeAdditionalInfoKeys = [
    // from documentation
    'LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD',
    // from guessing
    'cinf',
];
function revMap(map) {
    var result = {};
    Object.keys(map).forEach(function (key) { return result[map[key]] = key; });
    return result;
}
exports.revMap = revMap;
function createEnum(prefix, def, map) {
    var rev = revMap(map);
    var decode = function (val) {
        var value = val.split('.')[1];
        if (value && !rev[value])
            throw new Error("Unrecognized value for enum: '".concat(val, "'"));
        return rev[value] || def;
    };
    var encode = function (val) {
        if (val && !map[val])
            throw new Error("Invalid value for enum: '".concat(val, "'"));
        return "".concat(prefix, ".").concat(map[val] || map[def]);
    };
    return { decode: decode, encode: encode };
}
exports.createEnum = createEnum;
var ColorSpace;
(function (ColorSpace) {
    ColorSpace[ColorSpace["RGB"] = 0] = "RGB";
    ColorSpace[ColorSpace["HSB"] = 1] = "HSB";
    ColorSpace[ColorSpace["CMYK"] = 2] = "CMYK";
    ColorSpace[ColorSpace["Lab"] = 7] = "Lab";
    ColorSpace[ColorSpace["Grayscale"] = 8] = "Grayscale";
})(ColorSpace = exports.ColorSpace || (exports.ColorSpace = {}));
var LayerMaskFlags;
(function (LayerMaskFlags) {
    LayerMaskFlags[LayerMaskFlags["PositionRelativeToLayer"] = 1] = "PositionRelativeToLayer";
    LayerMaskFlags[LayerMaskFlags["LayerMaskDisabled"] = 2] = "LayerMaskDisabled";
    LayerMaskFlags[LayerMaskFlags["InvertLayerMaskWhenBlending"] = 4] = "InvertLayerMaskWhenBlending";
    LayerMaskFlags[LayerMaskFlags["LayerMaskFromRenderingOtherData"] = 8] = "LayerMaskFromRenderingOtherData";
    LayerMaskFlags[LayerMaskFlags["MaskHasParametersAppliedToIt"] = 16] = "MaskHasParametersAppliedToIt";
})(LayerMaskFlags = exports.LayerMaskFlags || (exports.LayerMaskFlags = {}));
var MaskParams;
(function (MaskParams) {
    MaskParams[MaskParams["UserMaskDensity"] = 1] = "UserMaskDensity";
    MaskParams[MaskParams["UserMaskFeather"] = 2] = "UserMaskFeather";
    MaskParams[MaskParams["VectorMaskDensity"] = 4] = "VectorMaskDensity";
    MaskParams[MaskParams["VectorMaskFeather"] = 8] = "VectorMaskFeather";
})(MaskParams = exports.MaskParams || (exports.MaskParams = {}));
var ChannelID;
(function (ChannelID) {
    ChannelID[ChannelID["Color0"] = 0] = "Color0";
    ChannelID[ChannelID["Color1"] = 1] = "Color1";
    ChannelID[ChannelID["Color2"] = 2] = "Color2";
    ChannelID[ChannelID["Color3"] = 3] = "Color3";
    ChannelID[ChannelID["Transparency"] = -1] = "Transparency";
    ChannelID[ChannelID["UserMask"] = -2] = "UserMask";
    ChannelID[ChannelID["RealUserMask"] = -3] = "RealUserMask";
})(ChannelID = exports.ChannelID || (exports.ChannelID = {}));
var Compression;
(function (Compression) {
    Compression[Compression["RawData"] = 0] = "RawData";
    Compression[Compression["RleCompressed"] = 1] = "RleCompressed";
    Compression[Compression["ZipWithoutPrediction"] = 2] = "ZipWithoutPrediction";
    Compression[Compression["ZipWithPrediction"] = 3] = "ZipWithPrediction";
})(Compression = exports.Compression || (exports.Compression = {}));
function offsetForChannel(channelId, cmyk) {
    switch (channelId) {
        case 0 /* Color0 */: return 0;
        case 1 /* Color1 */: return 1;
        case 2 /* Color2 */: return 2;
        case 3 /* Color3 */: return cmyk ? 3 : channelId + 1;
        case -1 /* Transparency */: return cmyk ? 4 : 3;
        default: return channelId + 1;
    }
}
exports.offsetForChannel = offsetForChannel;
function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
exports.clamp = clamp;
function hasAlpha(data) {
    var size = data.width * data.height * 4;
    for (var i = 3; i < size; i += 4) {
        if (data.data[i] !== 255) {
            return true;
        }
    }
    return false;
}
exports.hasAlpha = hasAlpha;
function resetImageData(_a) {
    var data = _a.data;
    var buffer = new Uint32Array(data.buffer);
    var size = buffer.length | 0;
    for (var p = 0; p < size; p = (p + 1) | 0) {
        buffer[p] = 0xff000000;
    }
}
exports.resetImageData = resetImageData;
function decodeBitmap(input, output, width, height) {
    for (var y = 0, p = 0, o = 0; y < height; y++) {
        for (var x = 0; x < width;) {
            var b = input[o++];
            for (var i = 0; i < 8 && x < width; i++, x++) {
                var v = b & 0x80 ? 0 : 255;
                b = b << 1;
                output[p++] = v;
                output[p++] = v;
                output[p++] = v;
                output[p++] = 255;
            }
        }
    }
}
exports.decodeBitmap = decodeBitmap;
function writeDataRaw(data, offset, width, height) {
    if (!width || !height)
        return undefined;
    var array = new Uint8Array(width * height);
    for (var i = 0; i < array.length; i++) {
        array[i] = data.data[i * 4 + offset];
    }
    return array;
}
exports.writeDataRaw = writeDataRaw;
function writeDataRLE(buffer, _a, width, height, offsets, large) {
    var data = _a.data;
    if (!width || !height)
        return undefined;
    var stride = (4 * width) | 0;
    var ol = 0;
    var o = (offsets.length * (large ? 4 : 2) * height) | 0;
    for (var _i = 0, offsets_1 = offsets; _i < offsets_1.length; _i++) {
        var offset = offsets_1[_i];
        for (var y = 0, p = offset | 0; y < height; y++) {
            var strideStart = (y * stride) | 0;
            var strideEnd = (strideStart + stride) | 0;
            var lastIndex = (strideEnd + offset - 4) | 0;
            var lastIndex2 = (lastIndex - 4) | 0;
            var startOffset = o;
            for (p = (strideStart + offset) | 0; p < strideEnd; p = (p + 4) | 0) {
                if (p < lastIndex2) {
                    var value1 = data[p];
                    p = (p + 4) | 0;
                    var value2 = data[p];
                    p = (p + 4) | 0;
                    var value3 = data[p];
                    if (value1 === value2 && value1 === value3) {
                        var count = 3;
                        while (count < 128 && p < lastIndex && data[(p + 4) | 0] === value1) {
                            count = (count + 1) | 0;
                            p = (p + 4) | 0;
                        }
                        buffer[o++] = 1 - count;
                        buffer[o++] = value1;
                    }
                    else {
                        var countIndex = o;
                        var writeLast = true;
                        var count = 1;
                        buffer[o++] = 0;
                        buffer[o++] = value1;
                        while (p < lastIndex && count < 128) {
                            p = (p + 4) | 0;
                            value1 = value2;
                            value2 = value3;
                            value3 = data[p];
                            if (value1 === value2 && value1 === value3) {
                                p = (p - 12) | 0;
                                writeLast = false;
                                break;
                            }
                            else {
                                count++;
                                buffer[o++] = value1;
                            }
                        }
                        if (writeLast) {
                            if (count < 127) {
                                buffer[o++] = value2;
                                buffer[o++] = value3;
                                count += 2;
                            }
                            else if (count < 128) {
                                buffer[o++] = value2;
                                count++;
                                p = (p - 4) | 0;
                            }
                            else {
                                p = (p - 8) | 0;
                            }
                        }
                        buffer[countIndex] = count - 1;
                    }
                }
                else if (p === lastIndex) {
                    buffer[o++] = 0;
                    buffer[o++] = data[p];
                }
                else { // p === lastIndex2
                    buffer[o++] = 1;
                    buffer[o++] = data[p];
                    p = (p + 4) | 0;
                    buffer[o++] = data[p];
                }
            }
            var length_1 = o - startOffset;
            if (large) {
                buffer[ol++] = (length_1 >> 24) & 0xff;
                buffer[ol++] = (length_1 >> 16) & 0xff;
            }
            buffer[ol++] = (length_1 >> 8) & 0xff;
            buffer[ol++] = length_1 & 0xff;
        }
    }
    return buffer.slice(0, o);
}
exports.writeDataRLE = writeDataRLE;
var createCanvas = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};
exports.createCanvas = createCanvas;
var createCanvasFromData = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};
exports.createCanvasFromData = createCanvasFromData;
var tempCanvas = undefined;
var createImageData = function (width, height) {
    if (!tempCanvas)
        tempCanvas = (0, exports.createCanvas)(1, 1);
    return tempCanvas.getContext('2d').createImageData(width, height);
};
exports.createImageData = createImageData;
if (typeof document !== 'undefined') {
    exports.createCanvas = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };
    exports.createCanvasFromData = function (data) {
        var image = new Image();
        image.src = 'data:image/jpeg;base64,' + (0, base64_js_1.fromByteArray)(data);
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas;
    };
}
function initializeCanvas(createCanvasMethod, createCanvasFromDataMethod, createImageDataMethod) {
    exports.createCanvas = createCanvasMethod;
    exports.createCanvasFromData = createCanvasFromDataMethod || exports.createCanvasFromData;
    exports.createImageData = createImageDataMethod || exports.createImageData;
}
exports.initializeCanvas = initializeCanvas;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQzNCLE1BQU0sQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUM3QixNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBRSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2hELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQyxDQUFDO0NBQ0Y7QUFFRCxTQUFnQixnQkFBZ0IsQ0FDL0Isa0JBQXdFLEVBQ3hFLDBCQUFvRSxFQUNwRSxxQkFBb0U7SUFFcEUsb0JBQVksR0FBRyxrQkFBa0IsQ0FBQztJQUNsQyw0QkFBb0IsR0FBRywwQkFBMEIsSUFBSSw0QkFBb0IsQ0FBQztJQUMxRSx1QkFBZSxHQUFHLHFCQUFxQixJQUFJLHVCQUFlLENBQUM7QUFDNUQsQ0FBQztBQVJELDRDQVFDIiwiZmlsZSI6ImhlbHBlcnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmcm9tQnl0ZUFycmF5IH0gZnJvbSAnYmFzZTY0LWpzJztcclxuaW1wb3J0IHsgTGF5ZXIsIEJsZW5kTW9kZSwgTGF5ZXJDb2xvciB9IGZyb20gJy4vcHNkJztcclxuXHJcbmV4cG9ydCBjb25zdCBNT0NLX0hBTkRMRVJTID0gZmFsc2U7XHJcbmV4cG9ydCBjb25zdCBSQVdfSU1BR0VfREFUQSA9IGZhbHNlO1xyXG5cclxuZXhwb3J0IGNvbnN0IGZyb21CbGVuZE1vZGU6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcclxuZXhwb3J0IGNvbnN0IHRvQmxlbmRNb2RlOiB7IFtrZXk6IHN0cmluZ106IEJsZW5kTW9kZSB9ID0ge1xyXG5cdCdwYXNzJzogJ3Bhc3MgdGhyb3VnaCcsXHJcblx0J25vcm0nOiAnbm9ybWFsJyxcclxuXHQnZGlzcyc6ICdkaXNzb2x2ZScsXHJcblx0J2RhcmsnOiAnZGFya2VuJyxcclxuXHQnbXVsICc6ICdtdWx0aXBseScsXHJcblx0J2lkaXYnOiAnY29sb3IgYnVybicsXHJcblx0J2xicm4nOiAnbGluZWFyIGJ1cm4nLFxyXG5cdCdka0NsJzogJ2RhcmtlciBjb2xvcicsXHJcblx0J2xpdGUnOiAnbGlnaHRlbicsXHJcblx0J3Njcm4nOiAnc2NyZWVuJyxcclxuXHQnZGl2ICc6ICdjb2xvciBkb2RnZScsXHJcblx0J2xkZGcnOiAnbGluZWFyIGRvZGdlJyxcclxuXHQnbGdDbCc6ICdsaWdodGVyIGNvbG9yJyxcclxuXHQnb3Zlcic6ICdvdmVybGF5JyxcclxuXHQnc0xpdCc6ICdzb2Z0IGxpZ2h0JyxcclxuXHQnaExpdCc6ICdoYXJkIGxpZ2h0JyxcclxuXHQndkxpdCc6ICd2aXZpZCBsaWdodCcsXHJcblx0J2xMaXQnOiAnbGluZWFyIGxpZ2h0JyxcclxuXHQncExpdCc6ICdwaW4gbGlnaHQnLFxyXG5cdCdoTWl4JzogJ2hhcmQgbWl4JyxcclxuXHQnZGlmZic6ICdkaWZmZXJlbmNlJyxcclxuXHQnc211ZCc6ICdleGNsdXNpb24nLFxyXG5cdCdmc3ViJzogJ3N1YnRyYWN0JyxcclxuXHQnZmRpdic6ICdkaXZpZGUnLFxyXG5cdCdodWUgJzogJ2h1ZScsXHJcblx0J3NhdCAnOiAnc2F0dXJhdGlvbicsXHJcblx0J2NvbHInOiAnY29sb3InLFxyXG5cdCdsdW0gJzogJ2x1bWlub3NpdHknLFxyXG59O1xyXG5cclxuT2JqZWN0LmtleXModG9CbGVuZE1vZGUpLmZvckVhY2goa2V5ID0+IGZyb21CbGVuZE1vZGVbdG9CbGVuZE1vZGVba2V5XV0gPSBrZXkpO1xyXG5cclxuZXhwb3J0IGNvbnN0IGxheWVyQ29sb3JzOiBMYXllckNvbG9yW10gPSBbXHJcblx0J25vbmUnLCAncmVkJywgJ29yYW5nZScsICd5ZWxsb3cnLCAnZ3JlZW4nLCAnYmx1ZScsICd2aW9sZXQnLCAnZ3JheSdcclxuXTtcclxuXHJcbmV4cG9ydCBjb25zdCBsYXJnZUFkZGl0aW9uYWxJbmZvS2V5cyA9IFtcclxuXHQvLyBmcm9tIGRvY3VtZW50YXRpb25cclxuXHQnTE1zaycsICdMcjE2JywgJ0xyMzInLCAnTGF5cicsICdNdDE2JywgJ010MzInLCAnTXRybicsICdBbHBoJywgJ0ZNc2snLCAnbG5rMicsICdGRWlkJywgJ0ZYaWQnLCAnUHhTRCcsXHJcblx0Ly8gZnJvbSBndWVzc2luZ1xyXG5cdCdjaW5mJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGljdCB7XHJcblx0W2tleTogc3RyaW5nXTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmV2TWFwKG1hcDogRGljdCkge1xyXG5cdGNvbnN0IHJlc3VsdDogRGljdCA9IHt9O1xyXG5cdE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChrZXkgPT4gcmVzdWx0W21hcFtrZXldXSA9IGtleSk7XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVudW08VD4ocHJlZml4OiBzdHJpbmcsIGRlZjogc3RyaW5nLCBtYXA6IERpY3QpIHtcclxuXHRjb25zdCByZXYgPSByZXZNYXAobWFwKTtcclxuXHRjb25zdCBkZWNvZGUgPSAodmFsOiBzdHJpbmcpOiBUID0+IHtcclxuXHRcdGNvbnN0IHZhbHVlID0gdmFsLnNwbGl0KCcuJylbMV07XHJcblx0XHRpZiAodmFsdWUgJiYgIXJldlt2YWx1ZV0pIHRocm93IG5ldyBFcnJvcihgVW5yZWNvZ25pemVkIHZhbHVlIGZvciBlbnVtOiAnJHt2YWx9J2ApO1xyXG5cdFx0cmV0dXJuIChyZXZbdmFsdWVdIGFzIGFueSkgfHwgZGVmO1xyXG5cdH07XHJcblx0Y29uc3QgZW5jb2RlID0gKHZhbDogVCB8IHVuZGVmaW5lZCk6IHN0cmluZyA9PiB7XHJcblx0XHRpZiAodmFsICYmICFtYXBbdmFsIGFzIGFueV0pIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2YWx1ZSBmb3IgZW51bTogJyR7dmFsfSdgKTtcclxuXHRcdHJldHVybiBgJHtwcmVmaXh9LiR7bWFwW3ZhbCBhcyBhbnldIHx8IG1hcFtkZWZdfWA7XHJcblx0fTtcclxuXHRyZXR1cm4geyBkZWNvZGUsIGVuY29kZSB9O1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW51bSBDb2xvclNwYWNlIHtcclxuXHRSR0IgPSAwLFxyXG5cdEhTQiA9IDEsXHJcblx0Q01ZSyA9IDIsXHJcblx0TGFiID0gNyxcclxuXHRHcmF5c2NhbGUgPSA4LFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW51bSBMYXllck1hc2tGbGFncyB7XHJcblx0UG9zaXRpb25SZWxhdGl2ZVRvTGF5ZXIgPSAxLFxyXG5cdExheWVyTWFza0Rpc2FibGVkID0gMixcclxuXHRJbnZlcnRMYXllck1hc2tXaGVuQmxlbmRpbmcgPSA0LCAvLyBvYnNvbGV0ZVxyXG5cdExheWVyTWFza0Zyb21SZW5kZXJpbmdPdGhlckRhdGEgPSA4LFxyXG5cdE1hc2tIYXNQYXJhbWV0ZXJzQXBwbGllZFRvSXQgPSAxNixcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGVudW0gTWFza1BhcmFtcyB7XHJcblx0VXNlck1hc2tEZW5zaXR5ID0gMSxcclxuXHRVc2VyTWFza0ZlYXRoZXIgPSAyLFxyXG5cdFZlY3Rvck1hc2tEZW5zaXR5ID0gNCxcclxuXHRWZWN0b3JNYXNrRmVhdGhlciA9IDgsXHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBlbnVtIENoYW5uZWxJRCB7XHJcblx0Q29sb3IwID0gMCwgLy8gcmVkIChyZ2IpIC8gY3lhbiAoY215aylcclxuXHRDb2xvcjEgPSAxLCAvLyBncmVlbiAocmdiKSAvIG1hZ2VudGEgKGNteWspXHJcblx0Q29sb3IyID0gMiwgLy8gYmx1ZSAocmdiKSAvIHllbGxvdyAoY215aylcclxuXHRDb2xvcjMgPSAzLCAvLyAtIChyZ2IpIC8gYmxhY2sgKGNteWspXHJcblx0VHJhbnNwYXJlbmN5ID0gLTEsXHJcblx0VXNlck1hc2sgPSAtMixcclxuXHRSZWFsVXNlck1hc2sgPSAtMyxcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGVudW0gQ29tcHJlc3Npb24ge1xyXG5cdFJhd0RhdGEgPSAwLFxyXG5cdFJsZUNvbXByZXNzZWQgPSAxLFxyXG5cdFppcFdpdGhvdXRQcmVkaWN0aW9uID0gMixcclxuXHRaaXBXaXRoUHJlZGljdGlvbiA9IDMsXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ2hhbm5lbERhdGEge1xyXG5cdGNoYW5uZWxJZDogQ2hhbm5lbElEO1xyXG5cdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbjtcclxuXHRidWZmZXI6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQ7XHJcblx0bGVuZ3RoOiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQm91bmRzIHtcclxuXHR0b3A6IG51bWJlcjtcclxuXHRsZWZ0OiBudW1iZXI7XHJcblx0cmlnaHQ6IG51bWJlcjtcclxuXHRib3R0b206IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMYXllckNoYW5uZWxEYXRhIHtcclxuXHRsYXllcjogTGF5ZXI7XHJcblx0Y2hhbm5lbHM6IENoYW5uZWxEYXRhW107XHJcblx0dG9wOiBudW1iZXI7XHJcblx0bGVmdDogbnVtYmVyO1xyXG5cdHJpZ2h0OiBudW1iZXI7XHJcblx0Ym90dG9tOiBudW1iZXI7XHJcblx0bWFzaz86IEJvdW5kcztcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgUGl4ZWxBcnJheSA9IFVpbnQ4Q2xhbXBlZEFycmF5IHwgVWludDhBcnJheTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGl4ZWxEYXRhIHtcclxuXHRkYXRhOiBQaXhlbEFycmF5O1xyXG5cdHdpZHRoOiBudW1iZXI7XHJcblx0aGVpZ2h0OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBvZmZzZXRGb3JDaGFubmVsKGNoYW5uZWxJZDogQ2hhbm5lbElELCBjbXlrOiBib29sZWFuKSB7XHJcblx0c3dpdGNoIChjaGFubmVsSWQpIHtcclxuXHRcdGNhc2UgQ2hhbm5lbElELkNvbG9yMDogcmV0dXJuIDA7XHJcblx0XHRjYXNlIENoYW5uZWxJRC5Db2xvcjE6IHJldHVybiAxO1xyXG5cdFx0Y2FzZSBDaGFubmVsSUQuQ29sb3IyOiByZXR1cm4gMjtcclxuXHRcdGNhc2UgQ2hhbm5lbElELkNvbG9yMzogcmV0dXJuIGNteWsgPyAzIDogY2hhbm5lbElkICsgMTtcclxuXHRcdGNhc2UgQ2hhbm5lbElELlRyYW5zcGFyZW5jeTogcmV0dXJuIGNteWsgPyA0IDogMztcclxuXHRcdGRlZmF1bHQ6IHJldHVybiBjaGFubmVsSWQgKyAxO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wKHZhbHVlOiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcikge1xyXG5cdHJldHVybiB2YWx1ZSA8IG1pbiA/IG1pbiA6ICh2YWx1ZSA+IG1heCA/IG1heCA6IHZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGhhc0FscGhhKGRhdGE6IFBpeGVsRGF0YSkge1xyXG5cdGNvbnN0IHNpemUgPSBkYXRhLndpZHRoICogZGF0YS5oZWlnaHQgKiA0O1xyXG5cclxuXHRmb3IgKGxldCBpID0gMzsgaSA8IHNpemU7IGkgKz0gNCkge1xyXG5cdFx0aWYgKGRhdGEuZGF0YVtpXSAhPT0gMjU1KSB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRJbWFnZURhdGEoeyBkYXRhIH06IFBpeGVsRGF0YSkge1xyXG5cdGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50MzJBcnJheShkYXRhLmJ1ZmZlcik7XHJcblx0Y29uc3Qgc2l6ZSA9IGJ1ZmZlci5sZW5ndGggfCAwO1xyXG5cclxuXHRmb3IgKGxldCBwID0gMDsgcCA8IHNpemU7IHAgPSAocCArIDEpIHwgMCkge1xyXG5cdFx0YnVmZmVyW3BdID0gMHhmZjAwMDAwMDtcclxuXHR9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVCaXRtYXAoaW5wdXQ6IFBpeGVsQXJyYXksIG91dHB1dDogUGl4ZWxBcnJheSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHRmb3IgKGxldCB5ID0gMCwgcCA9IDAsIG8gPSAwOyB5IDwgaGVpZ2h0OyB5KyspIHtcclxuXHRcdGZvciAobGV0IHggPSAwOyB4IDwgd2lkdGg7KSB7XHJcblx0XHRcdGxldCBiID0gaW5wdXRbbysrXTtcclxuXHJcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgOCAmJiB4IDwgd2lkdGg7IGkrKywgeCsrKSB7XHJcblx0XHRcdFx0Y29uc3QgdiA9IGIgJiAweDgwID8gMCA6IDI1NTtcclxuXHRcdFx0XHRiID0gYiA8PCAxO1xyXG5cdFx0XHRcdG91dHB1dFtwKytdID0gdjtcclxuXHRcdFx0XHRvdXRwdXRbcCsrXSA9IHY7XHJcblx0XHRcdFx0b3V0cHV0W3ArK10gPSB2O1xyXG5cdFx0XHRcdG91dHB1dFtwKytdID0gMjU1O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVEYXRhUmF3KGRhdGE6IFBpeGVsRGF0YSwgb2Zmc2V0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XHJcblx0aWYgKCF3aWR0aCB8fCAhaGVpZ2h0KVxyXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcclxuXHJcblx0Y29uc3QgYXJyYXkgPSBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCk7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcclxuXHRcdGFycmF5W2ldID0gZGF0YS5kYXRhW2kgKiA0ICsgb2Zmc2V0XTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBhcnJheTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRGF0YVJMRShcclxuXHRidWZmZXI6IFVpbnQ4QXJyYXksIHsgZGF0YSB9OiBQaXhlbERhdGEsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvZmZzZXRzOiBudW1iZXJbXSxcclxuXHRsYXJnZTogYm9vbGVhblxyXG4pIHtcclxuXHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpIHJldHVybiB1bmRlZmluZWQ7XHJcblxyXG5cdGNvbnN0IHN0cmlkZSA9ICg0ICogd2lkdGgpIHwgMDtcclxuXHJcblx0bGV0IG9sID0gMDtcclxuXHRsZXQgbyA9IChvZmZzZXRzLmxlbmd0aCAqIChsYXJnZSA/IDQgOiAyKSAqIGhlaWdodCkgfCAwO1xyXG5cclxuXHRmb3IgKGNvbnN0IG9mZnNldCBvZiBvZmZzZXRzKSB7XHJcblx0XHRmb3IgKGxldCB5ID0gMCwgcCA9IG9mZnNldCB8IDA7IHkgPCBoZWlnaHQ7IHkrKykge1xyXG5cdFx0XHRjb25zdCBzdHJpZGVTdGFydCA9ICh5ICogc3RyaWRlKSB8IDA7XHJcblx0XHRcdGNvbnN0IHN0cmlkZUVuZCA9IChzdHJpZGVTdGFydCArIHN0cmlkZSkgfCAwO1xyXG5cdFx0XHRjb25zdCBsYXN0SW5kZXggPSAoc3RyaWRlRW5kICsgb2Zmc2V0IC0gNCkgfCAwO1xyXG5cdFx0XHRjb25zdCBsYXN0SW5kZXgyID0gKGxhc3RJbmRleCAtIDQpIHwgMDtcclxuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSBvO1xyXG5cclxuXHRcdFx0Zm9yIChwID0gKHN0cmlkZVN0YXJ0ICsgb2Zmc2V0KSB8IDA7IHAgPCBzdHJpZGVFbmQ7IHAgPSAocCArIDQpIHwgMCkge1xyXG5cdFx0XHRcdGlmIChwIDwgbGFzdEluZGV4Mikge1xyXG5cdFx0XHRcdFx0bGV0IHZhbHVlMSA9IGRhdGFbcF07XHJcblx0XHRcdFx0XHRwID0gKHAgKyA0KSB8IDA7XHJcblx0XHRcdFx0XHRsZXQgdmFsdWUyID0gZGF0YVtwXTtcclxuXHRcdFx0XHRcdHAgPSAocCArIDQpIHwgMDtcclxuXHRcdFx0XHRcdGxldCB2YWx1ZTMgPSBkYXRhW3BdO1xyXG5cclxuXHRcdFx0XHRcdGlmICh2YWx1ZTEgPT09IHZhbHVlMiAmJiB2YWx1ZTEgPT09IHZhbHVlMykge1xyXG5cdFx0XHRcdFx0XHRsZXQgY291bnQgPSAzO1xyXG5cclxuXHRcdFx0XHRcdFx0d2hpbGUgKGNvdW50IDwgMTI4ICYmIHAgPCBsYXN0SW5kZXggJiYgZGF0YVsocCArIDQpIHwgMF0gPT09IHZhbHVlMSkge1xyXG5cdFx0XHRcdFx0XHRcdGNvdW50ID0gKGNvdW50ICsgMSkgfCAwO1xyXG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIDQpIHwgMDtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSAxIC0gY291bnQ7XHJcblx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gdmFsdWUxO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgY291bnRJbmRleCA9IG87XHJcblx0XHRcdFx0XHRcdGxldCB3cml0ZUxhc3QgPSB0cnVlO1xyXG5cdFx0XHRcdFx0XHRsZXQgY291bnQgPSAxO1xyXG5cdFx0XHRcdFx0XHRidWZmZXJbbysrXSA9IDA7XHJcblx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gdmFsdWUxO1xyXG5cclxuXHRcdFx0XHRcdFx0d2hpbGUgKHAgPCBsYXN0SW5kZXggJiYgY291bnQgPCAxMjgpIHtcclxuXHRcdFx0XHRcdFx0XHRwID0gKHAgKyA0KSB8IDA7XHJcblx0XHRcdFx0XHRcdFx0dmFsdWUxID0gdmFsdWUyO1xyXG5cdFx0XHRcdFx0XHRcdHZhbHVlMiA9IHZhbHVlMztcclxuXHRcdFx0XHRcdFx0XHR2YWx1ZTMgPSBkYXRhW3BdO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAodmFsdWUxID09PSB2YWx1ZTIgJiYgdmFsdWUxID09PSB2YWx1ZTMpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHAgPSAocCAtIDEyKSB8IDA7XHJcblx0XHRcdFx0XHRcdFx0XHR3cml0ZUxhc3QgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb3VudCsrO1xyXG5cdFx0XHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSB2YWx1ZTE7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAod3JpdGVMYXN0KSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKGNvdW50IDwgMTI3KSB7XHJcblx0XHRcdFx0XHRcdFx0XHRidWZmZXJbbysrXSA9IHZhbHVlMjtcclxuXHRcdFx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gdmFsdWUzO1xyXG5cdFx0XHRcdFx0XHRcdFx0Y291bnQgKz0gMjtcclxuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvdW50IDwgMTI4KSB7XHJcblx0XHRcdFx0XHRcdFx0XHRidWZmZXJbbysrXSA9IHZhbHVlMjtcclxuXHRcdFx0XHRcdFx0XHRcdGNvdW50Kys7XHJcblx0XHRcdFx0XHRcdFx0XHRwID0gKHAgLSA0KSB8IDA7XHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdHAgPSAocCAtIDgpIHwgMDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGJ1ZmZlcltjb3VudEluZGV4XSA9IGNvdW50IC0gMTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9IGVsc2UgaWYgKHAgPT09IGxhc3RJbmRleCkge1xyXG5cdFx0XHRcdFx0YnVmZmVyW28rK10gPSAwO1xyXG5cdFx0XHRcdFx0YnVmZmVyW28rK10gPSBkYXRhW3BdO1xyXG5cdFx0XHRcdH0gZWxzZSB7IC8vIHAgPT09IGxhc3RJbmRleDJcclxuXHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gMTtcclxuXHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gZGF0YVtwXTtcclxuXHRcdFx0XHRcdHAgPSAocCArIDQpIHwgMDtcclxuXHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gZGF0YVtwXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGxlbmd0aCA9IG8gLSBzdGFydE9mZnNldDtcclxuXHJcblx0XHRcdGlmIChsYXJnZSkge1xyXG5cdFx0XHRcdGJ1ZmZlcltvbCsrXSA9IChsZW5ndGggPj4gMjQpICYgMHhmZjtcclxuXHRcdFx0XHRidWZmZXJbb2wrK10gPSAobGVuZ3RoID4+IDE2KSAmIDB4ZmY7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGJ1ZmZlcltvbCsrXSA9IChsZW5ndGggPj4gOCkgJiAweGZmO1xyXG5cdFx0XHRidWZmZXJbb2wrK10gPSBsZW5ndGggJiAweGZmO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGJ1ZmZlci5zbGljZSgwLCBvKTtcclxufVxyXG5cclxuZXhwb3J0IGxldCBjcmVhdGVDYW52YXM6ICh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikgPT4gSFRNTENhbnZhc0VsZW1lbnQgPSAoKSA9PiB7XHJcblx0dGhyb3cgbmV3IEVycm9yKCdDYW52YXMgbm90IGluaXRpYWxpemVkLCB1c2UgaW5pdGlhbGl6ZUNhbnZhcyBtZXRob2QgdG8gc2V0IHVwIGNyZWF0ZUNhbnZhcyBtZXRob2QnKTtcclxufTtcclxuXHJcbmV4cG9ydCBsZXQgY3JlYXRlQ2FudmFzRnJvbURhdGE6IChkYXRhOiBVaW50OEFycmF5KSA9PiBIVE1MQ2FudmFzRWxlbWVudCA9ICgpID0+IHtcclxuXHR0aHJvdyBuZXcgRXJyb3IoJ0NhbnZhcyBub3QgaW5pdGlhbGl6ZWQsIHVzZSBpbml0aWFsaXplQ2FudmFzIG1ldGhvZCB0byBzZXQgdXAgY3JlYXRlQ2FudmFzRnJvbURhdGEgbWV0aG9kJyk7XHJcbn07XHJcblxyXG5sZXQgdGVtcENhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XHJcblxyXG5leHBvcnQgbGV0IGNyZWF0ZUltYWdlRGF0YTogKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSA9PiBJbWFnZURhdGEgPSAod2lkdGgsIGhlaWdodCkgPT4ge1xyXG5cdGlmICghdGVtcENhbnZhcykgdGVtcENhbnZhcyA9IGNyZWF0ZUNhbnZhcygxLCAxKTtcclxuXHRyZXR1cm4gdGVtcENhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5jcmVhdGVJbWFnZURhdGEod2lkdGgsIGhlaWdodCk7XHJcbn07XHJcblxyXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xyXG5cdGNyZWF0ZUNhbnZhcyA9ICh3aWR0aCwgaGVpZ2h0KSA9PiB7XHJcblx0XHRjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuXHRcdGNhbnZhcy53aWR0aCA9IHdpZHRoO1xyXG5cdFx0Y2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuXHRcdHJldHVybiBjYW52YXM7XHJcblx0fTtcclxuXHJcblx0Y3JlYXRlQ2FudmFzRnJvbURhdGEgPSAoZGF0YSkgPT4ge1xyXG5cdFx0Y29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcclxuXHRcdGltYWdlLnNyYyA9ICdkYXRhOmltYWdlL2pwZWc7YmFzZTY0LCcgKyBmcm9tQnl0ZUFycmF5KGRhdGEpO1xyXG5cdFx0Y29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XHJcblx0XHRjYW52YXMud2lkdGggPSBpbWFnZS53aWR0aDtcclxuXHRcdGNhbnZhcy5oZWlnaHQgPSBpbWFnZS5oZWlnaHQ7XHJcblx0XHRjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcclxuXHRcdHJldHVybiBjYW52YXM7XHJcblx0fTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGluaXRpYWxpemVDYW52YXMoXHJcblx0Y3JlYXRlQ2FudmFzTWV0aG9kOiAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpID0+IEhUTUxDYW52YXNFbGVtZW50LFxyXG5cdGNyZWF0ZUNhbnZhc0Zyb21EYXRhTWV0aG9kPzogKGRhdGE6IFVpbnQ4QXJyYXkpID0+IEhUTUxDYW52YXNFbGVtZW50LFxyXG5cdGNyZWF0ZUltYWdlRGF0YU1ldGhvZD86ICh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikgPT4gSW1hZ2VEYXRhXHJcbikge1xyXG5cdGNyZWF0ZUNhbnZhcyA9IGNyZWF0ZUNhbnZhc01ldGhvZDtcclxuXHRjcmVhdGVDYW52YXNGcm9tRGF0YSA9IGNyZWF0ZUNhbnZhc0Zyb21EYXRhTWV0aG9kIHx8IGNyZWF0ZUNhbnZhc0Zyb21EYXRhO1xyXG5cdGNyZWF0ZUltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YU1ldGhvZCB8fCBjcmVhdGVJbWFnZURhdGE7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
