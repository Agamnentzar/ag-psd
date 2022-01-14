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
import { readVectorMask } from './additionalInfo';
import { readUint32, checkSignature, createReader, readPascalString, readUnicodeString } from './psdReader';
export function readCsh(buffer) {
    var reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var csh = { shapes: [] };
    checkSignature(reader, 'cush');
    if (readUint32(reader) !== 2)
        throw new Error('Invalid version');
    var count = readUint32(reader);
    for (var i = 0; i < count; i++) {
        var name_1 = readUnicodeString(reader);
        while (reader.offset % 4)
            reader.offset++; // pad to 4byte bounds
        if (readUint32(reader) !== 1)
            throw new Error('Invalid shape version');
        var size = readUint32(reader);
        var end = reader.offset + size;
        var id = readPascalString(reader, 1);
        // this might not be correct ???
        var y1 = readUint32(reader);
        var x1 = readUint32(reader);
        var y2 = readUint32(reader);
        var x2 = readUint32(reader);
        var width = x2 - x1;
        var height = y2 - y1;
        var mask = { paths: [] };
        readVectorMask(reader, mask, width, height, end - reader.offset);
        csh.shapes.push(__assign({ name: name_1, id: id, width: width, height: height }, mask));
        reader.offset = end;
    }
    return csh;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVsRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFXNUcsTUFBTSxVQUFVLE9BQU8sQ0FBQyxNQUF1QjtJQUM5QyxJQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNqRixJQUFNLEdBQUcsR0FBUSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUVoQyxjQUFjLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDakUsSUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0IsSUFBTSxNQUFJLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkMsT0FBTyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUM7WUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxzQkFBc0I7UUFDakUsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUN2RSxJQUFNLElBQUksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsSUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7UUFDakMsSUFBTSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLGdDQUFnQztRQUNoQyxJQUFNLEVBQUUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxFQUFFLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLElBQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM5QixJQUFNLEVBQUUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDOUIsSUFBTSxLQUFLLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFNLE1BQU0sR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQU0sSUFBSSxHQUFvQixFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM1QyxjQUFjLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQUcsSUFBSSxRQUFBLEVBQUUsRUFBRSxJQUFBLEVBQUUsS0FBSyxPQUFBLEVBQUUsTUFBTSxRQUFBLElBQUssSUFBSSxFQUFHLENBQUM7UUFFdEQsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7S0FDcEI7SUFFRCxPQUFPLEdBQUcsQ0FBQztBQUNaLENBQUMiLCJmaWxlIjoiY3NoLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcmVhZFZlY3Rvck1hc2sgfSBmcm9tICcuL2FkZGl0aW9uYWxJbmZvJztcclxuaW1wb3J0IHsgTGF5ZXJWZWN0b3JNYXNrIH0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQgeyByZWFkVWludDMyLCBjaGVja1NpZ25hdHVyZSwgY3JlYXRlUmVhZGVyLCByZWFkUGFzY2FsU3RyaW5nLCByZWFkVW5pY29kZVN0cmluZyB9IGZyb20gJy4vcHNkUmVhZGVyJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ3NoIHtcclxuXHRzaGFwZXM6IChMYXllclZlY3Rvck1hc2sgJiB7XHJcblx0XHRuYW1lOiBzdHJpbmc7XHJcblx0XHRpZDogc3RyaW5nO1xyXG5cdFx0d2lkdGg6IG51bWJlcjtcclxuXHRcdGhlaWdodDogbnVtYmVyO1xyXG5cdH0pW107XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQ3NoKGJ1ZmZlcjogQXJyYXlCdWZmZXJWaWV3KTogQ3NoIHtcclxuXHRjb25zdCByZWFkZXIgPSBjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcclxuXHRjb25zdCBjc2g6IENzaCA9IHsgc2hhcGVzOiBbXSB9O1xyXG5cclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICdjdXNoJyk7XHJcblx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSAhPT0gMikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZlcnNpb24nKTtcclxuXHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XHJcblx0XHRjb25zdCBuYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdHdoaWxlIChyZWFkZXIub2Zmc2V0ICUgNCkgcmVhZGVyLm9mZnNldCsrOyAvLyBwYWQgdG8gNGJ5dGUgYm91bmRzXHJcblx0XHRpZiAocmVhZFVpbnQzMihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc2hhcGUgdmVyc2lvbicpO1xyXG5cdFx0Y29uc3Qgc2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IGVuZCA9IHJlYWRlci5vZmZzZXQgKyBzaXplO1xyXG5cdFx0Y29uc3QgaWQgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMSk7XHJcblx0XHQvLyB0aGlzIG1pZ2h0IG5vdCBiZSBjb3JyZWN0ID8/P1xyXG5cdFx0Y29uc3QgeTEgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB4MSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGNvbnN0IHkyID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgeDIgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCB3aWR0aCA9IHgyIC0geDE7XHJcblx0XHRjb25zdCBoZWlnaHQgPSB5MiAtIHkxO1xyXG5cdFx0Y29uc3QgbWFzazogTGF5ZXJWZWN0b3JNYXNrID0geyBwYXRoczogW10gfTtcclxuXHRcdHJlYWRWZWN0b3JNYXNrKHJlYWRlciwgbWFzaywgd2lkdGgsIGhlaWdodCwgZW5kIC0gcmVhZGVyLm9mZnNldCk7XHJcblx0XHRjc2guc2hhcGVzLnB1c2goeyBuYW1lLCBpZCwgd2lkdGgsIGhlaWdodCwgLi4ubWFzayB9KTtcclxuXHJcblx0XHRyZWFkZXIub2Zmc2V0ID0gZW5kO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGNzaDtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
