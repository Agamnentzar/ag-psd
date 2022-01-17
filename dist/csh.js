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
    var reader = (0, psdReader_1.createReader)(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var csh = { shapes: [] };
    (0, psdReader_1.checkSignature)(reader, 'cush');
    if ((0, psdReader_1.readUint32)(reader) !== 2)
        throw new Error('Invalid version');
    var count = (0, psdReader_1.readUint32)(reader);
    for (var i = 0; i < count; i++) {
        var name_1 = (0, psdReader_1.readUnicodeString)(reader);
        while (reader.offset % 4)
            reader.offset++; // pad to 4byte bounds
        if ((0, psdReader_1.readUint32)(reader) !== 1)
            throw new Error('Invalid shape version');
        var size = (0, psdReader_1.readUint32)(reader);
        var end = reader.offset + size;
        var id = (0, psdReader_1.readPascalString)(reader, 1);
        // this might not be correct ???
        var y1 = (0, psdReader_1.readUint32)(reader);
        var x1 = (0, psdReader_1.readUint32)(reader);
        var y2 = (0, psdReader_1.readUint32)(reader);
        var x2 = (0, psdReader_1.readUint32)(reader);
        var width = x2 - x1;
        var height = y2 - y1;
        var mask = { paths: [] };
        (0, additionalInfo_1.readVectorMask)(reader, mask, width, height, end - reader.offset);
        csh.shapes.push(__assign({ name: name_1, id: id, width: width, height: height }, mask));
        reader.offset = end;
    }
    return csh;
}
exports.readCsh = readCsh;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUFBLG1EQUFrRDtBQUVsRCx5Q0FBNEc7QUFXNUcsU0FBZ0IsT0FBTyxDQUFDLE1BQXVCO0lBQzlDLElBQU0sTUFBTSxHQUFHLElBQUEsd0JBQVksRUFBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ2pGLElBQU0sR0FBRyxHQUFRLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRWhDLElBQUEsMEJBQWMsRUFBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0IsSUFBSSxJQUFBLHNCQUFVLEVBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNqRSxJQUFNLEtBQUssR0FBRyxJQUFBLHNCQUFVLEVBQUMsTUFBTSxDQUFDLENBQUM7SUFFakMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMvQixJQUFNLE1BQUksR0FBRyxJQUFBLDZCQUFpQixFQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDO1lBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsc0JBQXNCO1FBQ2pFLElBQUksSUFBQSxzQkFBVSxFQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDdkUsSUFBTSxJQUFJLEdBQUcsSUFBQSxzQkFBVSxFQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hDLElBQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO1FBQ2pDLElBQU0sRUFBRSxHQUFHLElBQUEsNEJBQWdCLEVBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLGdDQUFnQztRQUNoQyxJQUFNLEVBQUUsR0FBRyxJQUFBLHNCQUFVLEVBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxFQUFFLEdBQUcsSUFBQSxzQkFBVSxFQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLElBQU0sRUFBRSxHQUFHLElBQUEsc0JBQVUsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUM5QixJQUFNLEVBQUUsR0FBRyxJQUFBLHNCQUFVLEVBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxLQUFLLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFNLE1BQU0sR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQU0sSUFBSSxHQUFvQixFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM1QyxJQUFBLCtCQUFjLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQUcsSUFBSSxRQUFBLEVBQUUsRUFBRSxJQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsTUFBTSxRQUFBLElBQUssSUFBSSxFQUFHLENBQUM7UUFFdEQsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7S0FDcEI7SUFFRCxPQUFPLEdBQUcsQ0FBQztBQUNaLENBQUM7QUE5QkQsMEJBOEJDIiwiZmlsZSI6ImNzaC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRWZWN0b3JNYXNrIH0gZnJvbSAnLi9hZGRpdGlvbmFsSW5mbyc7XHJcbmltcG9ydCB7IExheWVyVmVjdG9yTWFzayB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHsgcmVhZFVpbnQzMiwgY2hlY2tTaWduYXR1cmUsIGNyZWF0ZVJlYWRlciwgcmVhZFBhc2NhbFN0cmluZywgcmVhZFVuaWNvZGVTdHJpbmcgfSBmcm9tICcuL3BzZFJlYWRlcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENzaCB7XHJcblx0c2hhcGVzOiAoTGF5ZXJWZWN0b3JNYXNrICYge1xyXG5cdFx0bmFtZTogc3RyaW5nO1xyXG5cdFx0aWQ6IHN0cmluZztcclxuXHRcdHdpZHRoOiBudW1iZXI7XHJcblx0XHRoZWlnaHQ6IG51bWJlcjtcclxuXHR9KVtdO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZENzaChidWZmZXI6IEFycmF5QnVmZmVyVmlldyk6IENzaCB7XHJcblx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGJ1ZmZlci5idWZmZXIsIGJ1ZmZlci5ieXRlT2Zmc2V0LCBidWZmZXIuYnl0ZUxlbmd0aCk7XHJcblx0Y29uc3QgY3NoOiBDc2ggPSB7IHNoYXBlczogW10gfTtcclxuXHJcblx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnY3VzaCcpO1xyXG5cdGlmIChyZWFkVWludDMyKHJlYWRlcikgIT09IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2ZXJzaW9uJyk7XHJcblx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0Y29uc3QgbmFtZSA9IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7XHJcblx0XHR3aGlsZSAocmVhZGVyLm9mZnNldCAlIDQpIHJlYWRlci5vZmZzZXQrKzsgLy8gcGFkIHRvIDRieXRlIGJvdW5kc1xyXG5cdFx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHNoYXBlIHZlcnNpb24nKTtcclxuXHRcdGNvbnN0IHNpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBlbmQgPSByZWFkZXIub2Zmc2V0ICsgc2l6ZTtcclxuXHRcdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cdFx0Ly8gdGhpcyBtaWdodCBub3QgYmUgY29ycmVjdCA/Pz9cclxuXHRcdGNvbnN0IHkxID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgeDEgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB5MiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHgyID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3Qgd2lkdGggPSB4MiAtIHgxO1xyXG5cdFx0Y29uc3QgaGVpZ2h0ID0geTIgLSB5MTtcclxuXHRcdGNvbnN0IG1hc2s6IExheWVyVmVjdG9yTWFzayA9IHsgcGF0aHM6IFtdIH07XHJcblx0XHRyZWFkVmVjdG9yTWFzayhyZWFkZXIsIG1hc2ssIHdpZHRoLCBoZWlnaHQsIGVuZCAtIHJlYWRlci5vZmZzZXQpO1xyXG5cdFx0Y3NoLnNoYXBlcy5wdXNoKHsgbmFtZSwgaWQsIHdpZHRoLCBoZWlnaHQsIC4uLm1hc2sgfSk7XHJcblxyXG5cdFx0cmVhZGVyLm9mZnNldCA9IGVuZDtcclxuXHR9XHJcblxyXG5cdHJldHVybiBjc2g7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
