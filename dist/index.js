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
exports.writePsdBuffer = exports.writePsdUint8Array = exports.writePsd = exports.readPsd = exports.byteArrayToBase64 = exports.initializeCanvas = void 0;
var psdWriter_1 = require("./psdWriter");
var psdReader_1 = require("./psdReader");
__exportStar(require("./abr"), exports);
__exportStar(require("./csh"), exports);
var helpers_1 = require("./helpers");
Object.defineProperty(exports, "initializeCanvas", { enumerable: true, get: function () { return helpers_1.initializeCanvas; } });
__exportStar(require("./psd"), exports);
var base64_js_1 = require("base64-js");
exports.byteArrayToBase64 = base64_js_1.fromByteArray;
function readPsd(buffer, options) {
    var reader = 'buffer' in buffer ?
        psdReader_1.createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
        psdReader_1.createReader(buffer);
    return psdReader_1.readPsd(reader, options);
}
exports.readPsd = readPsd;
function writePsd(psd, options) {
    var writer = psdWriter_1.createWriter();
    psdWriter_1.writePsd(writer, psd, options);
    return psdWriter_1.getWriterBuffer(writer);
}
exports.writePsd = writePsd;
function writePsdUint8Array(psd, options) {
    var writer = psdWriter_1.createWriter();
    psdWriter_1.writePsd(writer, psd, options);
    return psdWriter_1.getWriterBufferNoCopy(writer);
}
exports.writePsdUint8Array = writePsdUint8Array;
function writePsdBuffer(psd, options) {
    if (typeof Buffer === 'undefined') {
        throw new Error('Buffer not supported on this platform');
    }
    return Buffer.from(writePsdUint8Array(psd, options));
}
exports.writePsdBuffer = writePsdBuffer;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFDQSx5Q0FBNEg7QUFDNUgseUNBQWtGO0FBQ2xGLHdDQUFzQjtBQUN0Qix3Q0FBc0I7QUFDdEIscUNBQTZDO0FBQXBDLDJHQUFBLGdCQUFnQixPQUFBO0FBQ3pCLHdDQUFzQjtBQUN0Qix1Q0FBMEM7QUFTN0IsUUFBQSxpQkFBaUIsR0FBRyx5QkFBYSxDQUFDO0FBRS9DLFNBQWdCLE9BQU8sQ0FBQyxNQUFnQyxFQUFFLE9BQXFCO0lBQzlFLElBQU0sTUFBTSxHQUFHLFFBQVEsSUFBSSxNQUFNLENBQUMsQ0FBQztRQUNsQyx3QkFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUNuRSx3QkFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RCLE9BQU8sbUJBQWUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUxELDBCQUtDO0FBRUQsU0FBZ0IsUUFBUSxDQUFDLEdBQVEsRUFBRSxPQUFzQjtJQUN4RCxJQUFNLE1BQU0sR0FBRyx3QkFBWSxFQUFFLENBQUM7SUFDOUIsb0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxPQUFPLDJCQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUpELDRCQUlDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQUMsR0FBUSxFQUFFLE9BQXNCO0lBQ2xFLElBQU0sTUFBTSxHQUFHLHdCQUFZLEVBQUUsQ0FBQztJQUM5QixvQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3ZDLE9BQU8saUNBQXFCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUpELGdEQUlDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLEdBQVEsRUFBRSxPQUFzQjtJQUM5RCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRTtRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7S0FDekQ7SUFFRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQU5ELHdDQU1DIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHNkLCBSZWFkT3B0aW9ucywgV3JpdGVPcHRpb25zIH0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQgeyBQc2RXcml0ZXIsIHdyaXRlUHNkIGFzIHdyaXRlUHNkSW50ZXJuYWwsIGdldFdyaXRlckJ1ZmZlciwgY3JlYXRlV3JpdGVyLCBnZXRXcml0ZXJCdWZmZXJOb0NvcHkgfSBmcm9tICcuL3BzZFdyaXRlcic7XHJcbmltcG9ydCB7IFBzZFJlYWRlciwgcmVhZFBzZCBhcyByZWFkUHNkSW50ZXJuYWwsIGNyZWF0ZVJlYWRlciB9IGZyb20gJy4vcHNkUmVhZGVyJztcclxuZXhwb3J0ICogZnJvbSAnLi9hYnInO1xyXG5leHBvcnQgKiBmcm9tICcuL2NzaCc7XHJcbmV4cG9ydCB7IGluaXRpYWxpemVDYW52YXMgfSBmcm9tICcuL2hlbHBlcnMnO1xyXG5leHBvcnQgKiBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7IGZyb21CeXRlQXJyYXkgfSBmcm9tICdiYXNlNjQtanMnO1xyXG5leHBvcnQgeyBQc2RSZWFkZXIsIFBzZFdyaXRlciB9O1xyXG5cclxuaW50ZXJmYWNlIEJ1ZmZlckxpa2Uge1xyXG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XHJcblx0Ynl0ZU9mZnNldDogbnVtYmVyO1xyXG5cdGJ5dGVMZW5ndGg6IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGJ5dGVBcnJheVRvQmFzZTY0ID0gZnJvbUJ5dGVBcnJheTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkKGJ1ZmZlcjogQXJyYXlCdWZmZXIgfCBCdWZmZXJMaWtlLCBvcHRpb25zPzogUmVhZE9wdGlvbnMpOiBQc2Qge1xyXG5cdGNvbnN0IHJlYWRlciA9ICdidWZmZXInIGluIGJ1ZmZlciA/XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKSA6XHJcblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyKTtcclxuXHRyZXR1cm4gcmVhZFBzZEludGVybmFsKHJlYWRlciwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZChwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEFycmF5QnVmZmVyIHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZFVpbnQ4QXJyYXkocHNkOiBQc2QsIG9wdGlvbnM/OiBXcml0ZU9wdGlvbnMpOiBVaW50OEFycmF5IHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZEludGVybmFsKHdyaXRlciwgcHNkLCBvcHRpb25zKTtcclxuXHRyZXR1cm4gZ2V0V3JpdGVyQnVmZmVyTm9Db3B5KHdyaXRlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB3cml0ZVBzZEJ1ZmZlcihwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IEJ1ZmZlciB7XHJcblx0aWYgKHR5cGVvZiBCdWZmZXIgPT09ICd1bmRlZmluZWQnKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0J1ZmZlciBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgcGxhdGZvcm0nKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBCdWZmZXIuZnJvbSh3cml0ZVBzZFVpbnQ4QXJyYXkocHNkLCBvcHRpb25zKSk7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
