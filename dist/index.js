"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writePsdBuffer = exports.writePsdUint8Array = exports.writePsd = exports.readPsd = exports.byteArrayToBase64 = void 0;
var psdWriter_1 = require("./psdWriter");
var psdReader_1 = require("./psdReader");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFDQSx5Q0FBNEg7QUFDNUgseUNBQWtGO0FBQ2xGLHFDQUE2QztBQUFwQywyR0FBQSxnQkFBZ0IsT0FBQTtBQUN6Qix3Q0FBc0I7QUFDdEIsdUNBQTBDO0FBUzdCLFFBQUEsaUJBQWlCLEdBQUcseUJBQWEsQ0FBQztBQUUvQyxTQUFnQixPQUFPLENBQUMsTUFBZ0MsRUFBRSxPQUFxQjtJQUM5RSxJQUFNLE1BQU0sR0FBRyxRQUFRLElBQUksTUFBTSxDQUFDLENBQUM7UUFDbEMsd0JBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbkUsd0JBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QixPQUFPLG1CQUFlLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3pDLENBQUM7QUFMRCwwQkFLQztBQUVELFNBQWdCLFFBQVEsQ0FBQyxHQUFRLEVBQUUsT0FBc0I7SUFDeEQsSUFBTSxNQUFNLEdBQUcsd0JBQVksRUFBRSxDQUFDO0lBQzlCLG9CQUFnQixDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsT0FBTywyQkFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hDLENBQUM7QUFKRCw0QkFJQztBQUVELFNBQWdCLGtCQUFrQixDQUFDLEdBQVEsRUFBRSxPQUFzQjtJQUNsRSxJQUFNLE1BQU0sR0FBRyx3QkFBWSxFQUFFLENBQUM7SUFDOUIsb0JBQWdCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2QyxPQUFPLGlDQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFKRCxnREFJQztBQUVELFNBQWdCLGNBQWMsQ0FBQyxHQUFRLEVBQUUsT0FBc0I7SUFDOUQsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7UUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0tBQ3pEO0lBRUQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFORCx3Q0FNQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBzZCwgUmVhZE9wdGlvbnMsIFdyaXRlT3B0aW9ucyB9IGZyb20gJy4vcHNkJztcbmltcG9ydCB7IFBzZFdyaXRlciwgd3JpdGVQc2QgYXMgd3JpdGVQc2RJbnRlcm5hbCwgZ2V0V3JpdGVyQnVmZmVyLCBjcmVhdGVXcml0ZXIsIGdldFdyaXRlckJ1ZmZlck5vQ29weSB9IGZyb20gJy4vcHNkV3JpdGVyJztcbmltcG9ydCB7IFBzZFJlYWRlciwgcmVhZFBzZCBhcyByZWFkUHNkSW50ZXJuYWwsIGNyZWF0ZVJlYWRlciB9IGZyb20gJy4vcHNkUmVhZGVyJztcbmV4cG9ydCB7IGluaXRpYWxpemVDYW52YXMgfSBmcm9tICcuL2hlbHBlcnMnO1xuZXhwb3J0ICogZnJvbSAnLi9wc2QnO1xuaW1wb3J0IHsgZnJvbUJ5dGVBcnJheSB9IGZyb20gJ2Jhc2U2NC1qcyc7XG5leHBvcnQgeyBQc2RSZWFkZXIsIFBzZFdyaXRlciB9O1xuXG5pbnRlcmZhY2UgQnVmZmVyTGlrZSB7XG5cdGJ1ZmZlcjogQXJyYXlCdWZmZXI7XG5cdGJ5dGVPZmZzZXQ6IG51bWJlcjtcblx0Ynl0ZUxlbmd0aDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgYnl0ZUFycmF5VG9CYXNlNjQgPSBmcm9tQnl0ZUFycmF5O1xuXG5leHBvcnQgZnVuY3Rpb24gcmVhZFBzZChidWZmZXI6IEFycmF5QnVmZmVyIHwgQnVmZmVyTGlrZSwgb3B0aW9ucz86IFJlYWRPcHRpb25zKTogUHNkIHtcblx0Y29uc3QgcmVhZGVyID0gJ2J1ZmZlcicgaW4gYnVmZmVyID9cblx0XHRjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKSA6XG5cdFx0Y3JlYXRlUmVhZGVyKGJ1ZmZlcik7XG5cdHJldHVybiByZWFkUHNkSW50ZXJuYWwocmVhZGVyLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUHNkKHBzZDogUHNkLCBvcHRpb25zPzogV3JpdGVPcHRpb25zKTogQXJyYXlCdWZmZXIge1xuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcblx0d3JpdGVQc2RJbnRlcm5hbCh3cml0ZXIsIHBzZCwgb3B0aW9ucyk7XG5cdHJldHVybiBnZXRXcml0ZXJCdWZmZXIod3JpdGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUHNkVWludDhBcnJheShwc2Q6IFBzZCwgb3B0aW9ucz86IFdyaXRlT3B0aW9ucyk6IFVpbnQ4QXJyYXkge1xuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcblx0d3JpdGVQc2RJbnRlcm5hbCh3cml0ZXIsIHBzZCwgb3B0aW9ucyk7XG5cdHJldHVybiBnZXRXcml0ZXJCdWZmZXJOb0NvcHkod3JpdGVyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUHNkQnVmZmVyKHBzZDogUHNkLCBvcHRpb25zPzogV3JpdGVPcHRpb25zKTogQnVmZmVyIHtcblx0aWYgKHR5cGVvZiBCdWZmZXIgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdCdWZmZXIgbm90IHN1cHBvcnRlZCBvbiB0aGlzIHBsYXRmb3JtJyk7XG5cdH1cblxuXHRyZXR1cm4gQnVmZmVyLmZyb20od3JpdGVQc2RVaW50OEFycmF5KHBzZCwgb3B0aW9ucykpO1xufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
