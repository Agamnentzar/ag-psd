"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCanvas = exports.createImageData = exports.createCanvasFromData = exports.createCanvas = exports.writeDataZipPrediction = exports.writeDataZip = exports.writeDataRLE = exports.writeDataRaw = exports.writeData = exports.decodeBitmap = exports.resetImageData = exports.hasAlpha = exports.clamp = exports.offsetForChannel = exports.Compression = exports.ChannelID = exports.MaskParams = exports.LayerMaskFlags = exports.ColorSpace = exports.createEnum = exports.revMap = exports.layerColors = exports.toBlendMode = exports.fromBlendMode = void 0;
var pako_1 = __importDefault(require("pako"));
var base64_js_1 = require("base64-js");
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
function revMap(map) {
    var result = {};
    Object.keys(map).forEach(function (key) { return result[map[key]] = key; });
    return result;
}
exports.revMap = revMap;
function createEnum(prefix, def, map) {
    var rev = revMap(map);
    var decode = function (val) { return rev[val.split('.')[1]] || def; };
    var encode = function (val) { return prefix + "." + (map[val] || map[def]); };
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
    ChannelID[ChannelID["Red"] = 0] = "Red";
    ChannelID[ChannelID["Green"] = 1] = "Green";
    ChannelID[ChannelID["Blue"] = 2] = "Blue";
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
function offsetForChannel(channelId) {
    switch (channelId) {
        case 0 /* Red */: return 0;
        case 1 /* Green */: return 1;
        case 2 /* Blue */: return 2;
        case -1 /* Transparency */: return 3;
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
    var width = _a.width, height = _a.height, data = _a.data;
    var size = (width * height) | 0;
    var buffer = new Uint32Array(data.buffer);
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
function writeData(buffer, data, width, height, offsets, compression) {
    switch (compression) {
        case 0 /* RawData */:
            return new Uint8Array(data.data);
        case 2 /* ZipWithoutPrediction */:
            return writeDataZip(buffer, data, width, height, offsets);
        case 3:
            return writeDataZipPrediction(buffer, data, width, height, offsets);
        case 1:
        default:
            return writeDataRLE(buffer, data, width, height, offsets);
    }
}
exports.writeData = writeData;
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
function writeDataRLE(buffer, _a, width, height, offsets) {
    var data = _a.data;
    if (!width || !height)
        return undefined;
    var stride = (4 * width) | 0;
    var ol = 0;
    var o = (offsets.length * 2 * height) | 0;
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
            buffer[ol++] = (length_1 >> 8) & 0xff;
            buffer[ol++] = length_1 & 0xff;
        }
    }
    return buffer.slice(0, o);
}
exports.writeDataRLE = writeDataRLE;
/**
 * Creates a new Uint8Array based on two different ArrayBuffers
 *
 * @private
 * @param {Uint8Array} buffer1 The first buffer.
 * @param {Uint8Array} buffer2 The second buffer.
 * @return {Uint8Array} The new ArrayBuffer created out of the two.
 */
var appendBuffer = function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp;
};
/**
 * As per the Adobe file format, zlib compress each channel separately
 */
function writeDataZip(buffer, _a, width, height, offsets) {
    var data = _a.data;
    if (!width || !height)
        return undefined;
    var size = width * height;
    var resultBuffer = new Uint8Array();
    // TODO(jsr): this doesn't work if more than one offest is passed
    if (offsets.length > 1) {
        throw new Error("Zipping multiple channels is not supported");
    }
    // NOTE this fixes the packing order, so if you passed offsets = [1,0,2,3] it will flip channels
    offsets.forEach(function (offset, o) {
        for (var i = 0; i < size; i++) {
            buffer[i + o * size] = data[i * 4 + offset];
        }
        var zippedBuffer = pako_1.default.deflate(buffer.slice(0, size));
        resultBuffer = o === 0 ? zippedBuffer : appendBuffer(resultBuffer, zippedBuffer);
    });
    return resultBuffer;
}
exports.writeDataZip = writeDataZip;
function writeDataZipPrediction(buffer, _a, width, height, offsets) {
    var data = _a.data;
    if (!width || !height)
        return undefined;
    console.log(buffer, data, offsets);
    throw new Error('Zip with prediction compression not yet implemented');
}
exports.writeDataZipPrediction = writeDataZipPrediction;
/* istanbul ignore next */
exports.createCanvas = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};
/* istanbul ignore next */
exports.createCanvasFromData = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};
var tempCanvas = undefined;
exports.createImageData = function (width, height) {
    if (!tempCanvas)
        tempCanvas = exports.createCanvas(1, 1);
    return tempCanvas.getContext('2d').createImageData(width, height);
};
/* istanbul ignore if */
if (typeof document !== 'undefined') {
    exports.createCanvas = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };
    exports.createCanvasFromData = function (data) {
        var image = new Image();
        image.src = 'data:image/jpeg;base64,' + base64_js_1.fromByteArray(data);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LEdBQUcseUJBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1RCxJQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2hELE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUMzQixNQUFNLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7UUFDN0IsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUMsQ0FBQztDQUNGO0FBRUQsU0FBZ0IsZ0JBQWdCLENBQy9CLGtCQUF3RSxFQUN4RSwwQkFBb0UsRUFDcEUscUJBQW9FO0lBRXBFLG9CQUFZLEdBQUcsa0JBQWtCLENBQUM7SUFDbEMsNEJBQW9CLEdBQUcsMEJBQTBCLElBQUksNEJBQW9CLENBQUM7SUFDMUUsdUJBQWUsR0FBRyxxQkFBcUIsSUFBSSx1QkFBZSxDQUFDO0FBQzVELENBQUM7QUFSRCw0Q0FRQyIsImZpbGUiOiJoZWxwZXJzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBha28gZnJvbSAncGFrbyc7XG5pbXBvcnQgeyBmcm9tQnl0ZUFycmF5IH0gZnJvbSAnYmFzZTY0LWpzJztcbmltcG9ydCB7IExheWVyLCBCbGVuZE1vZGUsIExheWVyQ29sb3IgfSBmcm9tICcuL3BzZCc7XG5cbmV4cG9ydCBjb25zdCBmcm9tQmxlbmRNb2RlOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG5leHBvcnQgY29uc3QgdG9CbGVuZE1vZGU6IHsgW2tleTogc3RyaW5nXTogQmxlbmRNb2RlIH0gPSB7XG5cdCdwYXNzJzogJ3Bhc3MgdGhyb3VnaCcsXG5cdCdub3JtJzogJ25vcm1hbCcsXG5cdCdkaXNzJzogJ2Rpc3NvbHZlJyxcblx0J2RhcmsnOiAnZGFya2VuJyxcblx0J211bCAnOiAnbXVsdGlwbHknLFxuXHQnaWRpdic6ICdjb2xvciBidXJuJyxcblx0J2xicm4nOiAnbGluZWFyIGJ1cm4nLFxuXHQnZGtDbCc6ICdkYXJrZXIgY29sb3InLFxuXHQnbGl0ZSc6ICdsaWdodGVuJyxcblx0J3Njcm4nOiAnc2NyZWVuJyxcblx0J2RpdiAnOiAnY29sb3IgZG9kZ2UnLFxuXHQnbGRkZyc6ICdsaW5lYXIgZG9kZ2UnLFxuXHQnbGdDbCc6ICdsaWdodGVyIGNvbG9yJyxcblx0J292ZXInOiAnb3ZlcmxheScsXG5cdCdzTGl0JzogJ3NvZnQgbGlnaHQnLFxuXHQnaExpdCc6ICdoYXJkIGxpZ2h0Jyxcblx0J3ZMaXQnOiAndml2aWQgbGlnaHQnLFxuXHQnbExpdCc6ICdsaW5lYXIgbGlnaHQnLFxuXHQncExpdCc6ICdwaW4gbGlnaHQnLFxuXHQnaE1peCc6ICdoYXJkIG1peCcsXG5cdCdkaWZmJzogJ2RpZmZlcmVuY2UnLFxuXHQnc211ZCc6ICdleGNsdXNpb24nLFxuXHQnZnN1Yic6ICdzdWJ0cmFjdCcsXG5cdCdmZGl2JzogJ2RpdmlkZScsXG5cdCdodWUgJzogJ2h1ZScsXG5cdCdzYXQgJzogJ3NhdHVyYXRpb24nLFxuXHQnY29scic6ICdjb2xvcicsXG5cdCdsdW0gJzogJ2x1bWlub3NpdHknLFxufTtcblxuT2JqZWN0LmtleXModG9CbGVuZE1vZGUpLmZvckVhY2goa2V5ID0+IGZyb21CbGVuZE1vZGVbdG9CbGVuZE1vZGVba2V5XV0gPSBrZXkpO1xuXG5leHBvcnQgY29uc3QgbGF5ZXJDb2xvcnM6IExheWVyQ29sb3JbXSA9IFtcblx0J25vbmUnLCAncmVkJywgJ29yYW5nZScsICd5ZWxsb3cnLCAnZ3JlZW4nLCAnYmx1ZScsICd2aW9sZXQnLCAnZ3JheSdcbl07XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGljdCB7XG5cdFtrZXk6IHN0cmluZ106IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJldk1hcChtYXA6IERpY3QpIHtcblx0Y29uc3QgcmVzdWx0OiBEaWN0ID0ge307XG5cdE9iamVjdC5rZXlzKG1hcCkuZm9yRWFjaChrZXkgPT4gcmVzdWx0W21hcFtrZXldXSA9IGtleSk7XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVFbnVtPFQ+KHByZWZpeDogc3RyaW5nLCBkZWY6IHN0cmluZywgbWFwOiBEaWN0KSB7XG5cdGNvbnN0IHJldiA9IHJldk1hcChtYXApO1xuXHRjb25zdCBkZWNvZGUgPSAodmFsOiBzdHJpbmcpOiBUID0+IChyZXZbdmFsLnNwbGl0KCcuJylbMV1dIGFzIGFueSkgfHwgZGVmO1xuXHRjb25zdCBlbmNvZGUgPSAodmFsOiBUIHwgdW5kZWZpbmVkKTogc3RyaW5nID0+IGAke3ByZWZpeH0uJHttYXBbdmFsIGFzIGFueV0gfHwgbWFwW2RlZl19YDtcblx0cmV0dXJuIHsgZGVjb2RlLCBlbmNvZGUgfTtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQ29sb3JTcGFjZSB7XG5cdFJHQiA9IDAsXG5cdEhTQiA9IDEsXG5cdENNWUsgPSAyLFxuXHRMYWIgPSA3LFxuXHRHcmF5c2NhbGUgPSA4LFxufVxuXG5leHBvcnQgY29uc3QgZW51bSBMYXllck1hc2tGbGFncyB7XG5cdFBvc2l0aW9uUmVsYXRpdmVUb0xheWVyID0gMSxcblx0TGF5ZXJNYXNrRGlzYWJsZWQgPSAyLFxuXHRJbnZlcnRMYXllck1hc2tXaGVuQmxlbmRpbmcgPSA0LCAvLyBvYnNvbGV0ZVxuXHRMYXllck1hc2tGcm9tUmVuZGVyaW5nT3RoZXJEYXRhID0gOCxcblx0TWFza0hhc1BhcmFtZXRlcnNBcHBsaWVkVG9JdCA9IDE2LFxufVxuXG5leHBvcnQgY29uc3QgZW51bSBNYXNrUGFyYW1zIHtcblx0VXNlck1hc2tEZW5zaXR5ID0gMSxcblx0VXNlck1hc2tGZWF0aGVyID0gMixcblx0VmVjdG9yTWFza0RlbnNpdHkgPSA0LFxuXHRWZWN0b3JNYXNrRmVhdGhlciA9IDgsXG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIENoYW5uZWxJRCB7XG5cdFJlZCA9IDAsXG5cdEdyZWVuID0gMSxcblx0Qmx1ZSA9IDIsXG5cdFRyYW5zcGFyZW5jeSA9IC0xLFxuXHRVc2VyTWFzayA9IC0yLFxuXHRSZWFsVXNlck1hc2sgPSAtMyxcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQ29tcHJlc3Npb24ge1xuXHRSYXdEYXRhID0gMCxcblx0UmxlQ29tcHJlc3NlZCA9IDEsXG5cdFppcFdpdGhvdXRQcmVkaWN0aW9uID0gMixcblx0WmlwV2l0aFByZWRpY3Rpb24gPSAzLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENoYW5uZWxEYXRhIHtcblx0Y2hhbm5lbElkOiBDaGFubmVsSUQ7XG5cdGNvbXByZXNzaW9uOiBDb21wcmVzc2lvbjtcblx0YnVmZmVyOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuXHRsZW5ndGg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCb3VuZHMge1xuXHR0b3A6IG51bWJlcjtcblx0bGVmdDogbnVtYmVyO1xuXHRyaWdodDogbnVtYmVyO1xuXHRib3R0b206IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYXllckNoYW5uZWxEYXRhIHtcblx0bGF5ZXI6IExheWVyO1xuXHRjaGFubmVsczogQ2hhbm5lbERhdGFbXTtcblx0dG9wOiBudW1iZXI7XG5cdGxlZnQ6IG51bWJlcjtcblx0cmlnaHQ6IG51bWJlcjtcblx0Ym90dG9tOiBudW1iZXI7XG5cdG1hc2s/OiBCb3VuZHM7XG59XG5cbmV4cG9ydCB0eXBlIFBpeGVsQXJyYXkgPSBVaW50OENsYW1wZWRBcnJheSB8IFVpbnQ4QXJyYXk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGl4ZWxEYXRhIHtcblx0ZGF0YTogUGl4ZWxBcnJheTtcblx0d2lkdGg6IG51bWJlcjtcblx0aGVpZ2h0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvZmZzZXRGb3JDaGFubmVsKGNoYW5uZWxJZDogQ2hhbm5lbElEKSB7XG5cdHN3aXRjaCAoY2hhbm5lbElkKSB7XG5cdFx0Y2FzZSBDaGFubmVsSUQuUmVkOiByZXR1cm4gMDtcblx0XHRjYXNlIENoYW5uZWxJRC5HcmVlbjogcmV0dXJuIDE7XG5cdFx0Y2FzZSBDaGFubmVsSUQuQmx1ZTogcmV0dXJuIDI7XG5cdFx0Y2FzZSBDaGFubmVsSUQuVHJhbnNwYXJlbmN5OiByZXR1cm4gMztcblx0XHRkZWZhdWx0OiByZXR1cm4gY2hhbm5lbElkICsgMTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xhbXAodmFsdWU6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKSB7XG5cdHJldHVybiB2YWx1ZSA8IG1pbiA/IG1pbiA6ICh2YWx1ZSA+IG1heCA/IG1heCA6IHZhbHVlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0FscGhhKGRhdGE6IFBpeGVsRGF0YSkge1xuXHRjb25zdCBzaXplID0gZGF0YS53aWR0aCAqIGRhdGEuaGVpZ2h0ICogNDtcblxuXHRmb3IgKGxldCBpID0gMzsgaSA8IHNpemU7IGkgKz0gNCkge1xuXHRcdGlmIChkYXRhLmRhdGFbaV0gIT09IDI1NSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRJbWFnZURhdGEoeyB3aWR0aCwgaGVpZ2h0LCBkYXRhIH06IFBpeGVsRGF0YSkge1xuXHRjb25zdCBzaXplID0gKHdpZHRoICogaGVpZ2h0KSB8IDA7XG5cdGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50MzJBcnJheShkYXRhLmJ1ZmZlcik7XG5cblx0Zm9yIChsZXQgcCA9IDA7IHAgPCBzaXplOyBwID0gKHAgKyAxKSB8IDApIHtcblx0XHRidWZmZXJbcF0gPSAweGZmMDAwMDAwO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVCaXRtYXAoaW5wdXQ6IFBpeGVsQXJyYXksIG91dHB1dDogUGl4ZWxBcnJheSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0Zm9yIChsZXQgeSA9IDAsIHAgPSAwLCBvID0gMDsgeSA8IGhlaWdodDsgeSsrKSB7XG5cdFx0Zm9yIChsZXQgeCA9IDA7IHggPCB3aWR0aDspIHtcblx0XHRcdGxldCBiID0gaW5wdXRbbysrXTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA4ICYmIHggPCB3aWR0aDsgaSsrLCB4KyspIHtcblx0XHRcdFx0Y29uc3QgdiA9IGIgJiAweDgwID8gMCA6IDI1NTtcblx0XHRcdFx0YiA9IGIgPDwgMTtcblx0XHRcdFx0b3V0cHV0W3ArK10gPSB2O1xuXHRcdFx0XHRvdXRwdXRbcCsrXSA9IHY7XG5cdFx0XHRcdG91dHB1dFtwKytdID0gdjtcblx0XHRcdFx0b3V0cHV0W3ArK10gPSAyNTU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURhdGEoYnVmZmVyOiBVaW50OEFycmF5LCBkYXRhOiBQaXhlbERhdGEsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvZmZzZXRzOiBudW1iZXJbXSwgY29tcHJlc3Npb24/OiBDb21wcmVzc2lvbikge1xuXHRzd2l0Y2ggKGNvbXByZXNzaW9uKSB7XG5cdFx0Y2FzZSBDb21wcmVzc2lvbi5SYXdEYXRhOlxuXHRcdFx0cmV0dXJuIG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YSk7XG5cdFx0Y2FzZSBDb21wcmVzc2lvbi5aaXBXaXRob3V0UHJlZGljdGlvbjpcblx0XHRcdHJldHVybiB3cml0ZURhdGFaaXAoYnVmZmVyLCBkYXRhLCB3aWR0aCwgaGVpZ2h0LCBvZmZzZXRzKTtcblx0XHRjYXNlIDM6XG5cdFx0XHRyZXR1cm4gd3JpdGVEYXRhWmlwUHJlZGljdGlvbihidWZmZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIG9mZnNldHMpO1xuXHRcdGNhc2UgMTpcblx0XHRkZWZhdWx0OlxuXHRcdFx0cmV0dXJuIHdyaXRlRGF0YVJMRShidWZmZXIsIGRhdGEsIHdpZHRoLCBoZWlnaHQsIG9mZnNldHMpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURhdGFSYXcoZGF0YTogUGl4ZWxEYXRhLCBvZmZzZXQ6IG51bWJlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0aWYgKCF3aWR0aCB8fCAhaGVpZ2h0KVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cblx0Y29uc3QgYXJyYXkgPSBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuXHRcdGFycmF5W2ldID0gZGF0YS5kYXRhW2kgKiA0ICsgb2Zmc2V0XTtcblx0fVxuXG5cdHJldHVybiBhcnJheTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRGF0YVJMRShidWZmZXI6IFVpbnQ4QXJyYXksIHsgZGF0YSB9OiBQaXhlbERhdGEsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvZmZzZXRzOiBudW1iZXJbXSkge1xuXHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblxuXHRjb25zdCBzdHJpZGUgPSAoNCAqIHdpZHRoKSB8IDA7XG5cblx0bGV0IG9sID0gMDtcblx0bGV0IG8gPSAob2Zmc2V0cy5sZW5ndGggKiAyICogaGVpZ2h0KSB8IDA7XG5cblx0Zm9yIChjb25zdCBvZmZzZXQgb2Ygb2Zmc2V0cykge1xuXHRcdGZvciAobGV0IHkgPSAwLCBwID0gb2Zmc2V0IHwgMDsgeSA8IGhlaWdodDsgeSsrKSB7XG5cdFx0XHRjb25zdCBzdHJpZGVTdGFydCA9ICh5ICogc3RyaWRlKSB8IDA7XG5cdFx0XHRjb25zdCBzdHJpZGVFbmQgPSAoc3RyaWRlU3RhcnQgKyBzdHJpZGUpIHwgMDtcblx0XHRcdGNvbnN0IGxhc3RJbmRleCA9IChzdHJpZGVFbmQgKyBvZmZzZXQgLSA0KSB8IDA7XG5cdFx0XHRjb25zdCBsYXN0SW5kZXgyID0gKGxhc3RJbmRleCAtIDQpIHwgMDtcblx0XHRcdGNvbnN0IHN0YXJ0T2Zmc2V0ID0gbztcblxuXHRcdFx0Zm9yIChwID0gKHN0cmlkZVN0YXJ0ICsgb2Zmc2V0KSB8IDA7IHAgPCBzdHJpZGVFbmQ7IHAgPSAocCArIDQpIHwgMCkge1xuXHRcdFx0XHRpZiAocCA8IGxhc3RJbmRleDIpIHtcblx0XHRcdFx0XHRsZXQgdmFsdWUxID0gZGF0YVtwXTtcblx0XHRcdFx0XHRwID0gKHAgKyA0KSB8IDA7XG5cdFx0XHRcdFx0bGV0IHZhbHVlMiA9IGRhdGFbcF07XG5cdFx0XHRcdFx0cCA9IChwICsgNCkgfCAwO1xuXHRcdFx0XHRcdGxldCB2YWx1ZTMgPSBkYXRhW3BdO1xuXG5cdFx0XHRcdFx0aWYgKHZhbHVlMSA9PT0gdmFsdWUyICYmIHZhbHVlMSA9PT0gdmFsdWUzKSB7XG5cdFx0XHRcdFx0XHRsZXQgY291bnQgPSAzO1xuXG5cdFx0XHRcdFx0XHR3aGlsZSAoY291bnQgPCAxMjggJiYgcCA8IGxhc3RJbmRleCAmJiBkYXRhWyhwICsgNCkgfCAwXSA9PT0gdmFsdWUxKSB7XG5cdFx0XHRcdFx0XHRcdGNvdW50ID0gKGNvdW50ICsgMSkgfCAwO1xuXHRcdFx0XHRcdFx0XHRwID0gKHAgKyA0KSB8IDA7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gMSAtIGNvdW50O1xuXHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSB2YWx1ZTE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNvdW50SW5kZXggPSBvO1xuXHRcdFx0XHRcdFx0bGV0IHdyaXRlTGFzdCA9IHRydWU7XG5cdFx0XHRcdFx0XHRsZXQgY291bnQgPSAxO1xuXHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSAwO1xuXHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSB2YWx1ZTE7XG5cblx0XHRcdFx0XHRcdHdoaWxlIChwIDwgbGFzdEluZGV4ICYmIGNvdW50IDwgMTI4KSB7XG5cdFx0XHRcdFx0XHRcdHAgPSAocCArIDQpIHwgMDtcblx0XHRcdFx0XHRcdFx0dmFsdWUxID0gdmFsdWUyO1xuXHRcdFx0XHRcdFx0XHR2YWx1ZTIgPSB2YWx1ZTM7XG5cdFx0XHRcdFx0XHRcdHZhbHVlMyA9IGRhdGFbcF07XG5cblx0XHRcdFx0XHRcdFx0aWYgKHZhbHVlMSA9PT0gdmFsdWUyICYmIHZhbHVlMSA9PT0gdmFsdWUzKSB7XG5cdFx0XHRcdFx0XHRcdFx0cCA9IChwIC0gMTIpIHwgMDtcblx0XHRcdFx0XHRcdFx0XHR3cml0ZUxhc3QgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRjb3VudCsrO1xuXHRcdFx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gdmFsdWUxO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICh3cml0ZUxhc3QpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGNvdW50IDwgMTI3KSB7XG5cdFx0XHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSB2YWx1ZTI7XG5cdFx0XHRcdFx0XHRcdFx0YnVmZmVyW28rK10gPSB2YWx1ZTM7XG5cdFx0XHRcdFx0XHRcdFx0Y291bnQgKz0gMjtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChjb3VudCA8IDEyOCkge1xuXHRcdFx0XHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gdmFsdWUyO1xuXHRcdFx0XHRcdFx0XHRcdGNvdW50Kys7XG5cdFx0XHRcdFx0XHRcdFx0cCA9IChwIC0gNCkgfCAwO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHAgPSAocCAtIDgpIHwgMDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRidWZmZXJbY291bnRJbmRleF0gPSBjb3VudCAtIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKHAgPT09IGxhc3RJbmRleCkge1xuXHRcdFx0XHRcdGJ1ZmZlcltvKytdID0gMDtcblx0XHRcdFx0XHRidWZmZXJbbysrXSA9IGRhdGFbcF07XG5cdFx0XHRcdH0gZWxzZSB7IC8vIHAgPT09IGxhc3RJbmRleDJcblx0XHRcdFx0XHRidWZmZXJbbysrXSA9IDE7XG5cdFx0XHRcdFx0YnVmZmVyW28rK10gPSBkYXRhW3BdO1xuXHRcdFx0XHRcdHAgPSAocCArIDQpIHwgMDtcblx0XHRcdFx0XHRidWZmZXJbbysrXSA9IGRhdGFbcF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbGVuZ3RoID0gbyAtIHN0YXJ0T2Zmc2V0O1xuXHRcdFx0YnVmZmVyW29sKytdID0gKGxlbmd0aCA+PiA4KSAmIDB4ZmY7XG5cdFx0XHRidWZmZXJbb2wrK10gPSBsZW5ndGggJiAweGZmO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBidWZmZXIuc2xpY2UoMCwgbyk7XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBVaW50OEFycmF5IGJhc2VkIG9uIHR3byBkaWZmZXJlbnQgQXJyYXlCdWZmZXJzXG4gKlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmZmVyMSBUaGUgZmlyc3QgYnVmZmVyLlxuICogQHBhcmFtIHtVaW50OEFycmF5fSBidWZmZXIyIFRoZSBzZWNvbmQgYnVmZmVyLlxuICogQHJldHVybiB7VWludDhBcnJheX0gVGhlIG5ldyBBcnJheUJ1ZmZlciBjcmVhdGVkIG91dCBvZiB0aGUgdHdvLlxuICovXG52YXIgYXBwZW5kQnVmZmVyID0gZnVuY3Rpb24oYnVmZmVyMTogVWludDhBcnJheSwgYnVmZmVyMjogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkge1xuXHR2YXIgdG1wID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyMS5ieXRlTGVuZ3RoICsgYnVmZmVyMi5ieXRlTGVuZ3RoKTtcblx0dG1wLnNldChuZXcgVWludDhBcnJheShidWZmZXIxKSwgMCk7XG5cdHRtcC5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyMiksIGJ1ZmZlcjEuYnl0ZUxlbmd0aCk7XG5cdHJldHVybiB0bXA7XG59O1xuXG4vKipcbiAqIEFzIHBlciB0aGUgQWRvYmUgZmlsZSBmb3JtYXQsIHpsaWIgY29tcHJlc3MgZWFjaCBjaGFubmVsIHNlcGFyYXRlbHlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRGF0YVppcChidWZmZXI6IFVpbnQ4QXJyYXksIHsgZGF0YSB9OiBQaXhlbERhdGEsIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvZmZzZXRzOiBudW1iZXJbXSkge1xuXHRpZiAoIXdpZHRoIHx8ICFoZWlnaHQpXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblxuXHRjb25zdCBzaXplID0gd2lkdGggKiBoZWlnaHQ7XG5cblx0bGV0IHJlc3VsdEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KCk7XG5cblx0Ly8gVE9ETyhqc3IpOiB0aGlzIGRvZXNuJ3Qgd29yayBpZiBtb3JlIHRoYW4gb25lIG9mZmVzdCBpcyBwYXNzZWRcblx0aWYgKG9mZnNldHMubGVuZ3RoID4gMSkge1xuXHRcdHRocm93IG5ldyBFcnJvcihcIlppcHBpbmcgbXVsdGlwbGUgY2hhbm5lbHMgaXMgbm90IHN1cHBvcnRlZFwiKTtcblx0fVxuXG5cdC8vIE5PVEUgdGhpcyBmaXhlcyB0aGUgcGFja2luZyBvcmRlciwgc28gaWYgeW91IHBhc3NlZCBvZmZzZXRzID0gWzEsMCwyLDNdIGl0IHdpbGwgZmxpcCBjaGFubmVsc1xuXHRvZmZzZXRzLmZvckVhY2goKG9mZnNldCwgbykgPT4ge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZTsgaSsrKSB7XG5cdFx0XHRidWZmZXJbaSArIG8gKiBzaXplXSA9IGRhdGFbaSAqIDQgKyBvZmZzZXRdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHppcHBlZEJ1ZmZlciA9IHBha28uZGVmbGF0ZShidWZmZXIuc2xpY2UoMCwgc2l6ZSkpO1xuXG5cdFx0cmVzdWx0QnVmZmVyID0gbyA9PT0gMCA/IHppcHBlZEJ1ZmZlciA6IGFwcGVuZEJ1ZmZlcihyZXN1bHRCdWZmZXIsIHppcHBlZEJ1ZmZlcik7XG5cdH0pO1xuXG5cdHJldHVybiByZXN1bHRCdWZmZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZURhdGFaaXBQcmVkaWN0aW9uKGJ1ZmZlcjogVWludDhBcnJheSwgeyBkYXRhIH06IFBpeGVsRGF0YSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIG9mZnNldHM6IG51bWJlcltdKSB7XG5cdGlmICghd2lkdGggfHwgIWhlaWdodClcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXG5cdGNvbnNvbGUubG9nKGJ1ZmZlciwgZGF0YSwgb2Zmc2V0cyk7XG5cblx0dGhyb3cgbmV3IEVycm9yKCdaaXAgd2l0aCBwcmVkaWN0aW9uIGNvbXByZXNzaW9uIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmV4cG9ydCBsZXQgY3JlYXRlQ2FudmFzOiAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpID0+IEhUTUxDYW52YXNFbGVtZW50ID0gKCkgPT4ge1xuXHR0aHJvdyBuZXcgRXJyb3IoJ0NhbnZhcyBub3QgaW5pdGlhbGl6ZWQsIHVzZSBpbml0aWFsaXplQ2FudmFzIG1ldGhvZCB0byBzZXQgdXAgY3JlYXRlQ2FudmFzIG1ldGhvZCcpO1xufTtcblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmV4cG9ydCBsZXQgY3JlYXRlQ2FudmFzRnJvbURhdGE6IChkYXRhOiBVaW50OEFycmF5KSA9PiBIVE1MQ2FudmFzRWxlbWVudCA9ICgpID0+IHtcblx0dGhyb3cgbmV3IEVycm9yKCdDYW52YXMgbm90IGluaXRpYWxpemVkLCB1c2UgaW5pdGlhbGl6ZUNhbnZhcyBtZXRob2QgdG8gc2V0IHVwIGNyZWF0ZUNhbnZhc0Zyb21EYXRhIG1ldGhvZCcpO1xufTtcblxubGV0IHRlbXBDYW52YXM6IEhUTUxDYW52YXNFbGVtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5leHBvcnQgbGV0IGNyZWF0ZUltYWdlRGF0YTogKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSA9PiBJbWFnZURhdGEgPSAod2lkdGgsIGhlaWdodCkgPT4ge1xuXHRpZiAoIXRlbXBDYW52YXMpIHRlbXBDYW52YXMgPSBjcmVhdGVDYW52YXMoMSwgMSk7XG5cdHJldHVybiB0ZW1wQ2FudmFzLmdldENvbnRleHQoJzJkJykhLmNyZWF0ZUltYWdlRGF0YSh3aWR0aCwgaGVpZ2h0KTtcbn07XG5cbi8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0Y3JlYXRlQ2FudmFzID0gKHdpZHRoLCBoZWlnaHQpID0+IHtcblx0XHRjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcblx0XHRjYW52YXMud2lkdGggPSB3aWR0aDtcblx0XHRjYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHJldHVybiBjYW52YXM7XG5cdH07XG5cblx0Y3JlYXRlQ2FudmFzRnJvbURhdGEgPSAoZGF0YSkgPT4ge1xuXHRcdGNvbnN0IGltYWdlID0gbmV3IEltYWdlKCk7XG5cdFx0aW1hZ2Uuc3JjID0gJ2RhdGE6aW1hZ2UvanBlZztiYXNlNjQsJyArIGZyb21CeXRlQXJyYXkoZGF0YSk7XG5cdFx0Y29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG5cdFx0Y2FudmFzLndpZHRoID0gaW1hZ2Uud2lkdGg7XG5cdFx0Y2FudmFzLmhlaWdodCA9IGltYWdlLmhlaWdodDtcblx0XHRjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSEuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcblx0XHRyZXR1cm4gY2FudmFzO1xuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdGlhbGl6ZUNhbnZhcyhcblx0Y3JlYXRlQ2FudmFzTWV0aG9kOiAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpID0+IEhUTUxDYW52YXNFbGVtZW50LFxuXHRjcmVhdGVDYW52YXNGcm9tRGF0YU1ldGhvZD86IChkYXRhOiBVaW50OEFycmF5KSA9PiBIVE1MQ2FudmFzRWxlbWVudCxcblx0Y3JlYXRlSW1hZ2VEYXRhTWV0aG9kPzogKHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSA9PiBJbWFnZURhdGFcbikge1xuXHRjcmVhdGVDYW52YXMgPSBjcmVhdGVDYW52YXNNZXRob2Q7XG5cdGNyZWF0ZUNhbnZhc0Zyb21EYXRhID0gY3JlYXRlQ2FudmFzRnJvbURhdGFNZXRob2QgfHwgY3JlYXRlQ2FudmFzRnJvbURhdGE7XG5cdGNyZWF0ZUltYWdlRGF0YSA9IGNyZWF0ZUltYWdlRGF0YU1ldGhvZCB8fCBjcmVhdGVJbWFnZURhdGE7XG59XG4iXSwic291cmNlUm9vdCI6Ii9Vc2Vycy9qb2VyYWlpL2Rldi9hZy1wc2Qvc3JjIn0=
