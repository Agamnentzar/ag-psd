"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMaskedLayerSize = exports.getLayerOrMaskChannelBoundingBox = exports.getLayerOrMaskContentBoundingBox = exports.writePsdBuffer = exports.writePsdUint8Array = exports.writePsd = exports.readPsd = exports.boundingBoxScanner = exports.byteArrayToBase64 = exports.initializeCanvas = void 0;
var psdWriter_1 = require("./psdWriter");
var psdReader_1 = require("./psdReader");
__exportStar(require("./abr"), exports);
__exportStar(require("./csh"), exports);
var helpers_1 = require("./helpers");
Object.defineProperty(exports, "initializeCanvas", { enumerable: true, get: function () { return helpers_1.initializeCanvas; } });
__exportStar(require("./psd"), exports);
var base64_js_1 = require("base64-js");
var BoundingBoxScanner_1 = require("./BoundingBoxScanner");
var canvas_1 = require("canvas");
exports.byteArrayToBase64 = base64_js_1.fromByteArray;
exports.boundingBoxScanner = new BoundingBoxScanner_1.BoundingBoxScan();
function readPsd(buffer, options) {
    var reader = 'buffer' in buffer ?
        (0, psdReader_1.createReader)(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
        (0, psdReader_1.createReader)(buffer);
    return (0, psdReader_1.readPsd)(reader, options);
}
exports.readPsd = readPsd;
function writePsd(psd, options) {
    var writer = (0, psdWriter_1.createWriter)();
    (0, psdWriter_1.writePsd)(writer, psd, options);
    return (0, psdWriter_1.getWriterBuffer)(writer);
}
exports.writePsd = writePsd;
function writePsdUint8Array(psd, options) {
    var writer = (0, psdWriter_1.createWriter)();
    (0, psdWriter_1.writePsd)(writer, psd, options);
    return (0, psdWriter_1.getWriterBufferNoCopy)(writer);
}
exports.writePsdUint8Array = writePsdUint8Array;
function writePsdBuffer(psd, options) {
    if (typeof Buffer === 'undefined') {
        throw new Error('Buffer not supported on this platform');
    }
    return Buffer.from(writePsdUint8Array(psd, options));
}
exports.writePsdBuffer = writePsdBuffer;
function getLayerOrMaskContentBoundingBox(layer) {
    return exports.boundingBoxScanner.scanLayerTransparency(layer);
}
exports.getLayerOrMaskContentBoundingBox = getLayerOrMaskContentBoundingBox;
function getLayerOrMaskChannelBoundingBox(layer, channel) {
    if (channel === void 0) { channel = BoundingBoxScanner_1.BoundingBoxScan.SCAN_OFFSET_RED; }
    return exports.boundingBoxScanner.scanLayerChannel(layer, channel);
}
exports.getLayerOrMaskChannelBoundingBox = getLayerOrMaskChannelBoundingBox;
var getMaskedLayerSize = function (layer, margin, psd) {
    if (margin === void 0) { margin = 0; }
    var right = layer.right, left = layer.left, bottom = layer.bottom, top = layer.top;
    var mask = layer.mask;
    // Place the layer on the canvas
    // Mask the layer using the mask
    if (mask) {
        // First, create a canvas PSD size
        var compCanvas = (0, canvas_1.createCanvas)(psd.width, psd.height);
        var compCtx = compCanvas.getContext('2d');
        var maskCanvas = (0, canvas_1.createCanvas)(psd.width, psd.height);
        var maskCtx = maskCanvas.getContext('2d');
        maskCtx.drawImage(layer.mask.canvas, layer.mask.left, layer.mask.top);
        compCtx.drawImage(layer.canvas, layer.left, layer.top);
        var compImageData = compCtx.getImageData(0, 0, psd.width, psd.height);
        var maskImageData = maskCtx.getImageData(0, 0, psd.width, psd.height);
        var compImageDataArray = compImageData.data;
        var maskImageDataArray = maskImageData.data;
        for (var i = 0; i < compImageDataArray.length; i += 4) {
            var alphaFromMask = maskImageDataArray[i];
            var alphaFromLayer = compImageDataArray[i + 3];
            var concatValue = Math.ceil((alphaFromMask * alphaFromLayer) / 255);
            compImageDataArray[i + 3] = concatValue;
        }
        compCanvas.width = psd.width; // Reset
        compCtx.putImageData(compImageData, 0, 0);
        var maskBoundingBox = exports.boundingBoxScanner.scan(compImageDataArray, psd.width, psd.height);
        if (!maskBoundingBox) {
            maskBoundingBox = {
                left: 0,
                top: 0,
                right: mask.right - mask.left,
                bottom: mask.bottom - mask.top,
            };
        }
        var layerLeft = maskBoundingBox.left - margin;
        var layerRight = maskBoundingBox.right + margin;
        var layerTop = maskBoundingBox.top - margin;
        var layerBottom = maskBoundingBox.bottom + margin;
        return {
            left: layerLeft,
            right: layerRight,
            top: layerTop,
            bottom: layerBottom,
        };
    }
    return {
        left: left,
        right: right,
        top: top,
        bottom: bottom,
    };
};
exports.getMaskedLayerSize = getMaskedLayerSize;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUNuQixDQUFDO0tBQ0Y7SUFDRCxPQUFzQjtRQUNyQixJQUFJLE1BQUE7UUFDSixLQUFLLE9BQUE7UUFDTCxHQUFHLEtBQUE7UUFDSCxNQUFNLFFBQUE7S0FDTixDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBdkVXLFFBQUEsa0JBQWtCLHNCQXVFN0IiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0xheWVyLCBMYXllck1hc2tEYXRhLCBQc2QsIFJlYWRPcHRpb25zLCBXcml0ZU9wdGlvbnN9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHsgUHNkV3JpdGVyLCB3cml0ZVBzZCBhcyB3cml0ZVBzZEludGVybmFsLCBnZXRXcml0ZXJCdWZmZXIsIGNyZWF0ZVdyaXRlciwgZ2V0V3JpdGVyQnVmZmVyTm9Db3B5IH0gZnJvbSAnLi9wc2RXcml0ZXInO1xyXG5pbXBvcnQgeyBQc2RSZWFkZXIsIHJlYWRQc2QgYXMgcmVhZFBzZEludGVybmFsLCBjcmVhdGVSZWFkZXIgfSBmcm9tICcuL3BzZFJlYWRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vYWJyJztcclxuZXhwb3J0ICogZnJvbSAnLi9jc2gnO1xyXG5leHBvcnQgeyBpbml0aWFsaXplQ2FudmFzIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuZXhwb3J0ICogZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQgeyBmcm9tQnl0ZUFycmF5IH0gZnJvbSAnYmFzZTY0LWpzJztcclxuaW1wb3J0IHtCb3VuZGluZ0JveFNjYW4sIElCb3VuZGluZ0JveH0gZnJvbSAnLi9Cb3VuZGluZ0JveFNjYW5uZXInO1xyXG5leHBvcnQgeyBQc2RSZWFkZXIsIFBzZFdyaXRlciB9O1xyXG5pbXBvcnQgeyBjcmVhdGVDYW52YXMgfSBmcm9tICdjYW52YXMnO1xyXG5cclxuaW50ZXJmYWNlIEJ1ZmZlckxpa2Uge1xyXG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XHJcblx0Ynl0ZU9mZnNldDogbnVtYmVyO1xyXG5cdGJ5dGVMZW5ndGg6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGJ5dGVBcnJheVRvQmFzZTY0ID0gZnJvbUJ5dGVBcnJheTtcclxuZXhwb3J0IGNvbnN0IGJvdW5kaW5nQm94U2Nhbm5lciA9IG5ldyBCb3VuZGluZ0JveFNjYW4oKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKGJ1ZmZlcjogQXJyYXlCdWZmZXIgfCBCdWZmZXJMaWtlLCBvcHRpb25zPzogUmVhZE9wdGlvbnMpOiBQc2Qge1xyXG5cdGNvbnN0IHJlYWRlciA9ICdidWZmZXInIGluIGJ1ZmZlciA/XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKSA6XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyKTtcclxuXHRyZXR1cm4gcmVhZFBzZEludGVybmFsKHJlYWRlciwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZChwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEFycmF5QnVmZmVyIHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZFVpbnQ4QXJyYXkocHNkOiBQc2QsIG9wdGlvbnM/OiBXcml0ZU9wdGlvbnMpOiBVaW50OEFycmF5IHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyTm9Db3B5KHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZEJ1ZmZlcihwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEJ1ZmZlciB7XHJcblx0aWYgKHR5cGVvZiBCdWZmZXIgPT09ICd1bmRlZmluZWQnKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlciBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm0nKTtcclxuXHR9XHJcblx0cmV0dXJuIEJ1ZmZlci5mcm9tKHdyaXRlUHNkVWludDhBcnJheShwc2QsIG9wdGlvbnMpKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldExheWVyT3JNYXNrQ29udGVudEJvdW5kaW5nQm94KGxheWVyOiBMYXllciB8IExheWVyTWFza0RhdGEpOiBJQm91bmRpbmdCb3ggfCB1bmRlZmluZWQge1xyXG5cdHJldHVybiBib3VuZGluZ0JveFNjYW5uZXIuc2NhbkxheWVyVHJhbnNwYXJlbmN5KGxheWVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldExheWVyT3JNYXNrQ2hhbm5lbEJvdW5kaW5nQm94KGxheWVyOiBMYXllciB8IExheWVyTWFza0RhdGEsIGNoYW5uZWw6IG51bWJlciA9IEJvdW5kaW5nQm94U2Nhbi5TQ0FOX09GRlNFVF9SRUQpOiBJQm91bmRpbmdCb3ggfCB1bmRlZmluZWQge1xyXG5cdHJldHVybiBib3VuZGluZ0JveFNjYW5uZXIuc2NhbkxheWVyQ2hhbm5lbChsYXllciwgY2hhbm5lbCk7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVBTUmVjdGFuZ2xlIHtcclxuXHRsZWZ0OiBudW1iZXI7XHJcblx0cmlnaHQ6IG51bWJlcjtcclxuXHR0b3A6IG51bWJlcjtcclxuXHRib3R0b206IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGdldE1hc2tlZExheWVyU2l6ZSA9IChsYXllcjogTGF5ZXIsIG1hcmdpbjogbnVtYmVyID0gMCwgcHNkOiBQc2QpOiBJUFNSZWN0YW5nbGUgPT4ge1xyXG5cdGNvbnN0IHsgcmlnaHQsIGxlZnQsIGJvdHRvbSwgdG9wIH0gPSBsYXllcjtcclxuXHRjb25zdCBtYXNrOiBMYXllck1hc2tEYXRhID0gbGF5ZXIubWFzayE7XHJcblx0Ly8gUGxhY2UgdGhlIGxheWVyIG9uIHRoZSBjYW52YXNcclxuXHQvLyBNYXNrIHRoZSBsYXllciB1c2luZyB0aGUgbWFza1xyXG5cdGlmIChtYXNrKSB7XHJcblxyXG5cdFx0Ly8gRmlyc3QsIGNyZWF0ZSBhIGNhbnZhcyBQU0Qgc2l6ZVxyXG5cdFx0Y29uc3QgY29tcENhbnZhcyA9IGNyZWF0ZUNhbnZhcyhwc2Qud2lkdGgsIHBzZC5oZWlnaHQpO1xyXG5cdFx0Y29uc3QgY29tcEN0eCA9IGNvbXBDYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcclxuXHRcdGNvbnN0IG1hc2tDYW52YXMgPSBjcmVhdGVDYW52YXMocHNkLndpZHRoLCBwc2QuaGVpZ2h0KTtcclxuXHRcdGNvbnN0IG1hc2tDdHggPSBtYXNrQ2FudmFzLmdldENvbnRleHQoJzJkJyk7XHJcblxyXG5cdFx0bWFza0N0eCEuZHJhd0ltYWdlKGxheWVyLm1hc2shLmNhbnZhcyEsIGxheWVyLm1hc2shLmxlZnQhLCBsYXllci5tYXNrIS50b3AhKTtcclxuXHRcdGNvbXBDdHghLmRyYXdJbWFnZShsYXllci5jYW52YXMhLCBsYXllci5sZWZ0ISwgbGF5ZXIudG9wISk7XHJcblxyXG5cdFx0Y29uc3QgY29tcEltYWdlRGF0YSA9IGNvbXBDdHghLmdldEltYWdlRGF0YShcclxuXHRcdFx0MCxcclxuXHRcdFx0MCxcclxuXHRcdFx0cHNkLndpZHRoLFxyXG5cdFx0XHRwc2QuaGVpZ2h0LFxyXG5cdFx0KTtcclxuXHJcblx0XHRjb25zdCBtYXNrSW1hZ2VEYXRhID0gbWFza0N0eCEuZ2V0SW1hZ2VEYXRhKFxyXG5cdFx0XHQwLFxyXG5cdFx0XHQwLFxyXG5cdFx0XHRwc2Qud2lkdGgsXHJcblx0XHRcdHBzZC5oZWlnaHQsXHJcblx0XHQpO1xyXG5cclxuXHRcdGNvbnN0IGNvbXBJbWFnZURhdGFBcnJheSA9IGNvbXBJbWFnZURhdGEuZGF0YTtcclxuXHRcdGNvbnN0IG1hc2tJbWFnZURhdGFBcnJheSA9IG1hc2tJbWFnZURhdGEuZGF0YTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvbXBJbWFnZURhdGFBcnJheS5sZW5ndGg7IGkgKz0gNCkge1xyXG5cdFx0XHRjb25zdCBhbHBoYUZyb21NYXNrID0gbWFza0ltYWdlRGF0YUFycmF5W2ldO1xyXG5cdFx0XHRjb25zdCBhbHBoYUZyb21MYXllciA9IGNvbXBJbWFnZURhdGFBcnJheVtpICsgM107XHJcblx0XHRcdGNvbnN0IGNvbmNhdFZhbHVlID0gTWF0aC5jZWlsKFxyXG5cdFx0XHRcdChhbHBoYUZyb21NYXNrICogYWxwaGFGcm9tTGF5ZXIpIC8gMjU1LFxyXG5cdFx0XHQpO1xyXG5cdFx0XHRjb21wSW1hZ2VEYXRhQXJyYXlbaSArIDNdID0gY29uY2F0VmFsdWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29tcENhbnZhcy53aWR0aCA9IHBzZC53aWR0aDsgLy8gUmVzZXRcclxuXHRcdGNvbXBDdHghLnB1dEltYWdlRGF0YShjb21wSW1hZ2VEYXRhLCAwLCAwKTtcclxuXHJcblx0XHRsZXQgbWFza0JvdW5kaW5nQm94OiBJQm91bmRpbmdCb3ggPSBib3VuZGluZ0JveFNjYW5uZXIuc2Nhbihjb21wSW1hZ2VEYXRhQXJyYXksIHBzZC53aWR0aCwgcHNkLmhlaWdodCk7XHJcblx0XHRpZiAoIW1hc2tCb3VuZGluZ0JveCkge1xyXG5cdFx0XHRtYXNrQm91bmRpbmdCb3ggPSB7XHJcblx0XHRcdFx0bGVmdDogMCxcclxuXHRcdFx0XHR0b3A6IDAsXHJcblx0XHRcdFx0cmlnaHQ6IG1hc2sucmlnaHQhIC0gbWFzay5sZWZ0ISxcclxuXHRcdFx0XHRib3R0b206IG1hc2suYm90dG9tISAtIG1hc2sudG9wISxcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHRcdGNvbnN0IGxheWVyTGVmdCA9IG1hc2tCb3VuZGluZ0JveC5sZWZ0ISAtIG1hcmdpbjtcclxuXHRcdGNvbnN0IGxheWVyUmlnaHQgPSBtYXNrQm91bmRpbmdCb3gucmlnaHQhICsgbWFyZ2luO1xyXG5cdFx0Y29uc3QgbGF5ZXJUb3AgPSBtYXNrQm91bmRpbmdCb3gudG9wISAtIG1hcmdpbjtcclxuXHRcdGNvbnN0IGxheWVyQm90dG9tID0gbWFza0JvdW5kaW5nQm94LmJvdHRvbSEgKyBtYXJnaW47XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRsZWZ0OiBsYXllckxlZnQsXHJcblx0XHRcdHJpZ2h0OiBsYXllclJpZ2h0LFxyXG5cdFx0XHR0b3A6IGxheWVyVG9wLFxyXG5cdFx0XHRib3R0b206IGxheWVyQm90dG9tLFxyXG5cdFx0fTtcclxuXHR9XHJcblx0cmV0dXJuIDxJUFNSZWN0YW5nbGU+IHtcclxuXHRcdGxlZnQsXHJcblx0XHRyaWdodCxcclxuXHRcdHRvcCxcclxuXHRcdGJvdHRvbSxcclxuXHR9O1xyXG59O1xyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
