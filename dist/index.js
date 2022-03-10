"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLayerOrMaskContentBoundingBox = exports.writePsdBuffer = exports.writePsdUint8Array = exports.writePsd = exports.readPsd = exports.boundingBoxScanner = exports.byteArrayToBase64 = exports.initializeCanvas = void 0;
var psdWriter_1 = require("./psdWriter");
var psdReader_1 = require("./psdReader");
__exportStar(require("./abr"), exports);
__exportStar(require("./csh"), exports);
var helpers_1 = require("./helpers");
Object.defineProperty(exports, "initializeCanvas", { enumerable: true, get: function () { return helpers_1.initializeCanvas; } });
__exportStar(require("./psd"), exports);
var base64_js_1 = require("base64-js");
var BoundingBoxScanner_1 = require("./BoundingBoxScanner");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFDQSx5Q0FBNEg7QUFDNUgseUNBQWtGO0FBQ2xGLHdDQUFzQjtBQUN0Qix3Q0FBc0I7QUFDdEIscUNBQTZDO0FBQXBDLDJHQUFBLGdCQUFnQixPQUFBO0FBQ3pCLHdDQUFzQjtBQUN0Qix1Q0FBMEM7QUFDMUMsMkRBQW1FO0FBU3RELFFBQUEsaUJBQWlCLEdBQUcseUJBQWEsQ0FBQztBQUNsQyxRQUFBLGtCQUFrQixHQUFHLElBQUksb0NBQWUsRUFBRSxDQUFDO0FBRXhELFNBQWdCLE9BQU8sQ0FBQyxNQUFnQyxFQUFFLE9BQXFCO0lBQzlFLElBQU0sTUFBTSxHQUFHLFFBQVEsSUFBSSxNQUFNLENBQUMsQ0FBQztRQUNsQyxJQUFBLHdCQUFZLEVBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ25FLElBQUEsd0JBQVksRUFBQyxNQUFNLENBQUMsQ0FBQztJQUN0QixPQUFPLElBQUEsbUJBQWUsRUFBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUxELDBCQUtDO0FBRUQsU0FBZ0IsUUFBUSxDQUFDLEdBQVEsRUFBRSxPQUFzQjtJQUN4RCxJQUFNLE1BQU0sR0FBRyxJQUFBLHdCQUFZLEdBQUUsQ0FBQztJQUM5QixJQUFBLG9CQUFnQixFQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsT0FBTyxJQUFBLDJCQUFlLEVBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUpELDRCQUlDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsR0FBUSxFQUFFLE9BQXNCO0lBQ2xFLElBQU0sTUFBTSxHQUFHLElBQUEsd0JBQVksR0FBRSxDQUFDO0lBQzlCLElBQUEsb0JBQWdCLEVBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxPQUFPLElBQUEsaUNBQXFCLEVBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUpELGdEQUlDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLEdBQVEsRUFBRSxPQUFzQjtJQUM5RCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRTtRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDekQ7SUFDRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUxELHdDQUtDO0FBRUQsU0FBZ0IsZ0NBQWdDLENBQUMsS0FBNEI7SUFDNUUsT0FBTywwQkFBa0IsQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4RCxDQUFDO0FBRkQsNEVBRUMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0xheWVyLCBMYXllck1hc2tEYXRhLCBQc2QsIFJlYWRPcHRpb25zLCBXcml0ZU9wdGlvbnN9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHsgUHNkV3JpdGVyLCB3cml0ZVBzZCBhcyB3cml0ZVBzZEludGVybmFsLCBnZXRXcml0ZXJCdWZmZXIsIGNyZWF0ZVdyaXRlciwgZ2V0V3JpdGVyQnVmZmVyTm9Db3B5IH0gZnJvbSAnLi9wc2RXcml0ZXInO1xyXG5pbXBvcnQgeyBQc2RSZWFkZXIsIHJlYWRQc2QgYXMgcmVhZFBzZEludGVybmFsLCBjcmVhdGVSZWFkZXIgfSBmcm9tICcuL3BzZFJlYWRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vYWJyJztcclxuZXhwb3J0ICogZnJvbSAnLi9jc2gnO1xyXG5leHBvcnQgeyBpbml0aWFsaXplQ2FudmFzIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuZXhwb3J0ICogZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQgeyBmcm9tQnl0ZUFycmF5IH0gZnJvbSAnYmFzZTY0LWpzJztcclxuaW1wb3J0IHtCb3VuZGluZ0JveFNjYW4sIElCb3VuZGluZ0JveH0gZnJvbSAnLi9Cb3VuZGluZ0JveFNjYW5uZXInO1xyXG5leHBvcnQgeyBQc2RSZWFkZXIsIFBzZFdyaXRlciB9O1xyXG5cclxuaW50ZXJmYWNlIEJ1ZmZlckxpa2Uge1xyXG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XHJcblx0Ynl0ZU9mZnNldDogbnVtYmVyO1xyXG5cdGJ5dGVMZW5ndGg6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGJ5dGVBcnJheVRvQmFzZTY0ID0gZnJvbUJ5dGVBcnJheTtcclxuZXhwb3J0IGNvbnN0IGJvdW5kaW5nQm94U2Nhbm5lciA9IG5ldyBCb3VuZGluZ0JveFNjYW4oKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKGJ1ZmZlcjogQXJyYXlCdWZmZXIgfCBCdWZmZXJMaWtlLCBvcHRpb25zPzogUmVhZE9wdGlvbnMpOiBQc2Qge1xyXG5cdGNvbnN0IHJlYWRlciA9ICdidWZmZXInIGluIGJ1ZmZlciA/XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKSA6XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyKTtcclxuXHRyZXR1cm4gcmVhZFBzZEludGVybmFsKHJlYWRlciwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZChwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEFycmF5QnVmZmVyIHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZFVpbnQ4QXJyYXkocHNkOiBQc2QsIG9wdGlvbnM/OiBXcml0ZU9wdGlvbnMpOiBVaW50OEFycmF5IHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyTm9Db3B5KHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZEJ1ZmZlcihwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEJ1ZmZlciB7XHJcblx0aWYgKHR5cGVvZiBCdWZmZXIgPT09ICd1bmRlZmluZWQnKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlciBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm0nKTtcclxuXHR9XHJcblx0cmV0dXJuIEJ1ZmZlci5mcm9tKHdyaXRlUHNkVWludDhBcnJheShwc2QsIG9wdGlvbnMpKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldExheWVyT3JNYXNrQ29udGVudEJvdW5kaW5nQm94KGxheWVyOiBMYXllciB8IExheWVyTWFza0RhdGEpOiBJQm91bmRpbmdCb3ggfCB1bmRlZmluZWQge1xyXG5cdHJldHVybiBib3VuZGluZ0JveFNjYW5uZXIuc2NhbkxheWVyVHJhbnNwYXJlbmN5KGxheWVyKTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
