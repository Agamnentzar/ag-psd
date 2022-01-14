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
exports.readCsh = void 0;
var additionalInfo_1 = require("./additionalInfo");
var psdReader_1 = require("./psdReader");
function readCsh(buffer) {
    var reader = psdReader_1.createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var csh = { shapes: [] };
    psdReader_1.checkSignature(reader, 'cush');
    if (psdReader_1.readUint32(reader) !== 2)
        throw new Error('Invalid version');
    var count = psdReader_1.readUint32(reader);
    for (var i = 0; i < count; i++) {
        var name_1 = psdReader_1.readUnicodeString(reader);
        while (reader.offset % 4)
            reader.offset++; // pad to 4byte bounds
        if (psdReader_1.readUint32(reader) !== 1)
            throw new Error('Invalid shape version');
        var size = psdReader_1.readUint32(reader);
        var end = reader.offset + size;
        var id = psdReader_1.readPascalString(reader, 1);
        // this might not be correct ???
        var y1 = psdReader_1.readUint32(reader);
        var x1 = psdReader_1.readUint32(reader);
        var y2 = psdReader_1.readUint32(reader);
        var x2 = psdReader_1.readUint32(reader);
        var width = x2 - x1;
        var height = y2 - y1;
        var mask = { paths: [] };
        additionalInfo_1.readVectorMask(reader, mask, width, height, end - reader.offset);
        csh.shapes.push(__assign({ name: name_1, id: id, width: width, height: height }, mask));
        reader.offset = end;
    }
    return csh;
}
exports.readCsh = readCsh;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBLG1EQUFrRDtBQUVsRCx5Q0FBNEc7QUFXNUcsU0FBZ0IsT0FBTyxDQUFDLE1BQXVCO0lBQzlDLElBQU0sTUFBTSxHQUFHLHdCQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRixJQUFNLEdBQUcsR0FBUSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUVoQywwQkFBYyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMvQixJQUFJLHNCQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNqRSxJQUFNLEtBQUssR0FBRyxzQkFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0IsSUFBTSxNQUFJLEdBQUcsNkJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkMsT0FBTyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUM7WUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxzQkFBc0I7UUFDakUsSUFBSSxzQkFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDdkUsSUFBTSxJQUFJLEdBQUcsc0JBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxJQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztRQUNqQyxJQUFNLEVBQUUsR0FBRyw0QkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdkMsZ0NBQWdDO1FBQ2hDLElBQU0sRUFBRSxHQUFHLHNCQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxFQUFFLEdBQUcsc0JBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5QixJQUFNLEVBQUUsR0FBRyxzQkFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLElBQU0sRUFBRSxHQUFHLHNCQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxLQUFLLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFNLE1BQU0sR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQU0sSUFBSSxHQUFvQixFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM1QywrQkFBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2pFLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxZQUFHLElBQUksUUFBQSxFQUFFLEVBQUUsSUFBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE1BQU0sUUFBQSxJQUFLLElBQUksRUFBRyxDQUFDO1FBRXRELE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0tBQ3BCO0lBRUQsT0FBTyxHQUFHLENBQUM7QUFDWixDQUFDO0FBOUJELDBCQThCQyIsImZpbGUiOiJjc2guanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWFkVmVjdG9yTWFzayB9IGZyb20gJy4vYWRkaXRpb25hbEluZm8nO1xyXG5pbXBvcnQgeyBMYXllclZlY3Rvck1hc2sgfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7IHJlYWRVaW50MzIsIGNoZWNrU2lnbmF0dXJlLCBjcmVhdGVSZWFkZXIsIHJlYWRQYXNjYWxTdHJpbmcsIHJlYWRVbmljb2RlU3RyaW5nIH0gZnJvbSAnLi9wc2RSZWFkZXInO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDc2gge1xyXG5cdHNoYXBlczogKExheWVyVmVjdG9yTWFzayAmIHtcclxuXHRcdG5hbWU6IHN0cmluZztcclxuXHRcdGlkOiBzdHJpbmc7XHJcblx0XHR3aWR0aDogbnVtYmVyO1xyXG5cdFx0aGVpZ2h0OiBudW1iZXI7XHJcblx0fSlbXTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRDc2goYnVmZmVyOiBBcnJheUJ1ZmZlclZpZXcpOiBDc2gge1xyXG5cdGNvbnN0IHJlYWRlciA9IGNyZWF0ZVJlYWRlcihidWZmZXIuYnVmZmVyLCBidWZmZXIuYnl0ZU9mZnNldCwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xyXG5cdGNvbnN0IGNzaDogQ3NoID0geyBzaGFwZXM6IFtdIH07XHJcblxyXG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJ2N1c2gnKTtcclxuXHRpZiAocmVhZFVpbnQzMihyZWFkZXIpICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdmVyc2lvbicpO1xyXG5cdGNvbnN0IGNvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcclxuXHRcdGNvbnN0IG5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdFx0d2hpbGUgKHJlYWRlci5vZmZzZXQgJSA0KSByZWFkZXIub2Zmc2V0Kys7IC8vIHBhZCB0byA0Ynl0ZSBib3VuZHNcclxuXHRcdGlmIChyZWFkVWludDMyKHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzaGFwZSB2ZXJzaW9uJyk7XHJcblx0XHRjb25zdCBzaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgZW5kID0gcmVhZGVyLm9mZnNldCArIHNpemU7XHJcblx0XHRjb25zdCBpZCA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHRcdC8vIHRoaXMgbWlnaHQgbm90IGJlIGNvcnJlY3QgPz8/XHJcblx0XHRjb25zdCB5MSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHgxID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgeTIgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB4MiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHdpZHRoID0geDIgLSB4MTtcclxuXHRcdGNvbnN0IGhlaWdodCA9IHkyIC0geTE7XHJcblx0XHRjb25zdCBtYXNrOiBMYXllclZlY3Rvck1hc2sgPSB7IHBhdGhzOiBbXSB9O1xyXG5cdFx0cmVhZFZlY3Rvck1hc2socmVhZGVyLCBtYXNrLCB3aWR0aCwgaGVpZ2h0LCBlbmQgLSByZWFkZXIub2Zmc2V0KTtcclxuXHRcdGNzaC5zaGFwZXMucHVzaCh7IG5hbWUsIGlkLCB3aWR0aCwgaGVpZ2h0LCAuLi5tYXNrIH0pO1xyXG5cclxuXHRcdHJlYWRlci5vZmZzZXQgPSBlbmQ7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY3NoO1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
