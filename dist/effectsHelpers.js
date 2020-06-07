"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeEffects = exports.readEffects = void 0;
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var bevelStyles = [
    undefined,
    'outer bevel', 'inner bevel', 'emboss', 'pillow emboss', 'stroke emboss'
];
function readBlendMode(reader) {
    psdReader_1.checkSignature(reader, '8BIM');
    return helpers_1.toBlendMode[psdReader_1.readSignature(reader)] || 'normal';
}
function writeBlendMode(writer, mode) {
    psdWriter_1.writeSignature(writer, '8BIM');
    psdWriter_1.writeSignature(writer, helpers_1.fromBlendMode[mode] || 'norm');
}
function readFixedPoint8(reader) {
    return psdReader_1.readUint8(reader) / 0xff;
}
function writeFixedPoint8(writer, value) {
    psdWriter_1.writeUint8(writer, Math.round(value * 0xff) | 0);
}
function readEffects(reader) {
    var version = psdReader_1.readUint16(reader);
    if (version !== 0)
        throw new Error("Invalid effects layer version: " + version);
    var effectsCount = psdReader_1.readUint16(reader);
    var effects = {};
    for (var i = 0; i < effectsCount; i++) {
        psdReader_1.checkSignature(reader, '8BIM');
        var type = psdReader_1.readSignature(reader);
        switch (type) {
            case 'cmnS': { // common state (see See Effects layer, common state info)
                var size = psdReader_1.readUint32(reader);
                var version_1 = psdReader_1.readUint32(reader);
                var visible = !!psdReader_1.readUint8(reader);
                psdReader_1.skipBytes(reader, 2);
                if (size !== 7 || version_1 !== 0 || !visible)
                    throw new Error("Invalid effects common state");
                break;
            }
            case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
            case 'isdw': { // inner shadow (see See Effects layer, drop shadow and inner shadow info)
                var blockSize = psdReader_1.readUint32(reader);
                var version_2 = psdReader_1.readUint32(reader);
                if (blockSize !== 41 && blockSize !== 51)
                    throw new Error("Invalid shadow size: " + blockSize);
                if (version_2 !== 0 && version_2 !== 2)
                    throw new Error("Invalid shadow version: " + version_2);
                var size = psdReader_1.readFixedPoint32(reader);
                psdReader_1.readFixedPoint32(reader); // intensity
                var angle = psdReader_1.readFixedPoint32(reader);
                var distance = psdReader_1.readFixedPoint32(reader);
                var color = psdReader_1.readColor(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!psdReader_1.readUint8(reader);
                var useGlobalLight = !!psdReader_1.readUint8(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 51)
                    psdReader_1.readColor(reader); // native color
                var shadowInfo = {
                    size: { units: 'Pixels', value: size },
                    distance: { units: 'Pixels', value: distance },
                    angle: angle, color: color, blendMode: blendMode, enabled: enabled, useGlobalLight: useGlobalLight, opacity: opacity
                };
                if (type === 'dsdw') {
                    effects.dropShadow = shadowInfo;
                }
                else {
                    effects.innerShadow = shadowInfo;
                }
                break;
            }
            case 'oglw': { // outer glow (see See Effects layer, outer glow info)
                var blockSize = psdReader_1.readUint32(reader);
                var version_3 = psdReader_1.readUint32(reader);
                if (blockSize !== 32 && blockSize !== 42)
                    throw new Error("Invalid outer glow size: " + blockSize);
                if (version_3 !== 0 && version_3 !== 2)
                    throw new Error("Invalid outer glow version: " + version_3);
                var size = psdReader_1.readFixedPoint32(reader);
                psdReader_1.readFixedPoint32(reader); // intensity
                var color = psdReader_1.readColor(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!psdReader_1.readUint8(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 42)
                    psdReader_1.readColor(reader); // native color
                effects.outerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color, blendMode: blendMode, enabled: enabled, opacity: opacity
                };
                break;
            }
            case 'iglw': { // inner glow (see See Effects layer, inner glow info)
                var blockSize = psdReader_1.readUint32(reader);
                var version_4 = psdReader_1.readUint32(reader);
                if (blockSize !== 32 && blockSize !== 43)
                    throw new Error("Invalid inner glow size: " + blockSize);
                if (version_4 !== 0 && version_4 !== 2)
                    throw new Error("Invalid inner glow version: " + version_4);
                var size = psdReader_1.readFixedPoint32(reader);
                psdReader_1.readFixedPoint32(reader); // intensity
                var color = psdReader_1.readColor(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!psdReader_1.readUint8(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 43) {
                    psdReader_1.readUint8(reader); // inverted
                    psdReader_1.readColor(reader); // native color
                }
                effects.innerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color, blendMode: blendMode, enabled: enabled, opacity: opacity
                };
                break;
            }
            case 'bevl': { // bevel (see See Effects layer, bevel info)
                var blockSize = psdReader_1.readUint32(reader);
                var version_5 = psdReader_1.readUint32(reader);
                if (blockSize !== 58 && blockSize !== 78)
                    throw new Error("Invalid bevel size: " + blockSize);
                if (version_5 !== 0 && version_5 !== 2)
                    throw new Error("Invalid bevel version: " + version_5);
                var angle = psdReader_1.readFixedPoint32(reader);
                var strength = psdReader_1.readFixedPoint32(reader);
                var size = psdReader_1.readFixedPoint32(reader);
                var highlightBlendMode = readBlendMode(reader);
                var shadowBlendMode = readBlendMode(reader);
                var highlightColor = psdReader_1.readColor(reader);
                var shadowColor = psdReader_1.readColor(reader);
                var style = bevelStyles[psdReader_1.readUint8(reader)] || 'inner bevel';
                var highlightOpacity = readFixedPoint8(reader);
                var shadowOpacity = readFixedPoint8(reader);
                var enabled = !!psdReader_1.readUint8(reader);
                var useGlobalLight = !!psdReader_1.readUint8(reader);
                var direction = psdReader_1.readUint8(reader) ? 'down' : 'up';
                if (blockSize >= 78) {
                    psdReader_1.readColor(reader); // real highlight color
                    psdReader_1.readColor(reader); // real shadow color
                }
                effects.bevel = {
                    size: { units: 'Pixels', value: size },
                    angle: angle, strength: strength, highlightBlendMode: highlightBlendMode, shadowBlendMode: shadowBlendMode, highlightColor: highlightColor, shadowColor: shadowColor,
                    style: style, highlightOpacity: highlightOpacity, shadowOpacity: shadowOpacity, enabled: enabled, useGlobalLight: useGlobalLight, direction: direction,
                };
                break;
            }
            case 'sofi': { // solid fill (Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
                var size = psdReader_1.readUint32(reader);
                var version_6 = psdReader_1.readUint32(reader);
                if (size !== 34)
                    throw new Error("Invalid effects solid fill info size: " + size);
                if (version_6 !== 2)
                    throw new Error("Invalid effects solid fill info version: " + version_6);
                var blendMode = readBlendMode(reader);
                var color = psdReader_1.readColor(reader);
                var opacity = readFixedPoint8(reader);
                var enabled = !!psdReader_1.readUint8(reader);
                psdReader_1.readColor(reader); // native color
                effects.solidFill = { blendMode: blendMode, color: color, opacity: opacity, enabled: enabled };
                break;
            }
            default:
                throw new Error("Invalid effect type: '" + type + "'");
        }
    }
    return effects;
}
exports.readEffects = readEffects;
function writeShadowInfo(writer, shadow) {
    var _a;
    psdWriter_1.writeUint32(writer, 51);
    psdWriter_1.writeUint32(writer, 2);
    psdWriter_1.writeFixedPoint32(writer, shadow.size && shadow.size.value || 0);
    psdWriter_1.writeFixedPoint32(writer, 0); // intensity
    psdWriter_1.writeFixedPoint32(writer, shadow.angle || 0);
    psdWriter_1.writeFixedPoint32(writer, shadow.distance && shadow.distance.value || 0);
    psdWriter_1.writeColor(writer, shadow.color);
    writeBlendMode(writer, shadow.blendMode);
    psdWriter_1.writeUint8(writer, shadow.enabled ? 1 : 0);
    psdWriter_1.writeUint8(writer, shadow.useGlobalLight ? 1 : 0);
    writeFixedPoint8(writer, (_a = shadow.opacity) !== null && _a !== void 0 ? _a : 1);
    psdWriter_1.writeColor(writer, shadow.color); // native color
}
function writeEffects(writer, effects) {
    var _a, _b, _c;
    psdWriter_1.writeUint16(writer, 0);
    var count = 1;
    if (effects.dropShadow)
        count++;
    if (effects.innerShadow)
        count++;
    if (effects.outerGlow)
        count++;
    if (effects.innerGlow)
        count++;
    if (effects.bevel)
        count++;
    if (effects.solidFill)
        count++;
    psdWriter_1.writeUint16(writer, count);
    psdWriter_1.writeSignature(writer, '8BIM');
    psdWriter_1.writeSignature(writer, 'cmnS');
    psdWriter_1.writeUint32(writer, 7); // size
    psdWriter_1.writeUint32(writer, 0); // version
    psdWriter_1.writeUint8(writer, 1); // visible
    psdWriter_1.writeZeros(writer, 2);
    if (effects.dropShadow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'dsdw');
        writeShadowInfo(writer, effects.dropShadow);
    }
    if (effects.innerShadow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'isdw');
        writeShadowInfo(writer, effects.innerShadow);
    }
    if (effects.outerGlow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'oglw');
        psdWriter_1.writeUint32(writer, 42);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, ((_a = effects.outerGlow.size) === null || _a === void 0 ? void 0 : _a.value) || 0);
        psdWriter_1.writeFixedPoint32(writer, 0); // intensity
        psdWriter_1.writeColor(writer, effects.outerGlow.color);
        writeBlendMode(writer, effects.outerGlow.blendMode);
        psdWriter_1.writeUint8(writer, effects.outerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, effects.outerGlow.opacity || 0);
        psdWriter_1.writeColor(writer, effects.outerGlow.color);
    }
    if (effects.innerGlow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'iglw');
        psdWriter_1.writeUint32(writer, 43);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, ((_b = effects.innerGlow.size) === null || _b === void 0 ? void 0 : _b.value) || 0);
        psdWriter_1.writeFixedPoint32(writer, 0); // intensity
        psdWriter_1.writeColor(writer, effects.innerGlow.color);
        writeBlendMode(writer, effects.innerGlow.blendMode);
        psdWriter_1.writeUint8(writer, effects.innerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, effects.innerGlow.opacity || 0);
        psdWriter_1.writeUint8(writer, 0); // inverted
        psdWriter_1.writeColor(writer, effects.innerGlow.color);
    }
    if (effects.bevel) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'bevl');
        psdWriter_1.writeUint32(writer, 78);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, effects.bevel.angle || 0);
        psdWriter_1.writeFixedPoint32(writer, effects.bevel.strength || 0);
        psdWriter_1.writeFixedPoint32(writer, ((_c = effects.bevel.size) === null || _c === void 0 ? void 0 : _c.value) || 0);
        writeBlendMode(writer, effects.bevel.highlightBlendMode);
        writeBlendMode(writer, effects.bevel.shadowBlendMode);
        psdWriter_1.writeColor(writer, effects.bevel.highlightColor);
        psdWriter_1.writeColor(writer, effects.bevel.shadowColor);
        var style = bevelStyles.indexOf(effects.bevel.style);
        psdWriter_1.writeUint8(writer, style <= 0 ? 1 : style);
        writeFixedPoint8(writer, effects.bevel.highlightOpacity || 0);
        writeFixedPoint8(writer, effects.bevel.shadowOpacity || 0);
        psdWriter_1.writeUint8(writer, effects.bevel.enabled ? 1 : 0);
        psdWriter_1.writeUint8(writer, effects.bevel.useGlobalLight ? 1 : 0);
        psdWriter_1.writeUint8(writer, effects.bevel.direction === 'down' ? 1 : 0);
        psdWriter_1.writeColor(writer, effects.bevel.highlightColor);
        psdWriter_1.writeColor(writer, effects.bevel.shadowColor);
    }
    if (effects.solidFill) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'sofi');
        psdWriter_1.writeUint32(writer, 34);
        psdWriter_1.writeUint32(writer, 2);
        writeBlendMode(writer, effects.solidFill.blendMode);
        psdWriter_1.writeColor(writer, effects.solidFill.color);
        writeFixedPoint8(writer, effects.solidFill.opacity || 0);
        psdWriter_1.writeUint8(writer, effects.solidFill.enabled ? 1 : 0);
        psdWriter_1.writeColor(writer, effects.solidFill.color);
    }
}
exports.writeEffects = writeEffects;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDeEIsdUJBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdkIsY0FBYyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3BELHNCQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3pELHNCQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RELHNCQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDNUM7QUFDRixDQUFDO0FBL0ZELG9DQStGQyIsImZpbGUiOiJlZmZlY3RzSGVscGVycy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExheWVyRWZmZWN0c0luZm8sIEJldmVsU3R5bGUsIExheWVyRWZmZWN0U2hhZG93IH0gZnJvbSAnLi9wc2QnO1xuaW1wb3J0IHsgdG9CbGVuZE1vZGUsIGZyb21CbGVuZE1vZGUgfSBmcm9tICcuL2hlbHBlcnMnO1xuaW1wb3J0IHtcblx0UHNkUmVhZGVyLCBjaGVja1NpZ25hdHVyZSwgcmVhZFNpZ25hdHVyZSwgc2tpcEJ5dGVzLCByZWFkVWludDE2LCByZWFkVWludDgsXG5cdHJlYWRVaW50MzIsIHJlYWRGaXhlZFBvaW50MzIsIHJlYWRDb2xvclxufSBmcm9tICcuL3BzZFJlYWRlcic7XG5pbXBvcnQge1xuXHRQc2RXcml0ZXIsIHdyaXRlU2lnbmF0dXJlLCB3cml0ZVVpbnQxNiwgd3JpdGVaZXJvcywgd3JpdGVGaXhlZFBvaW50MzIsXG5cdHdyaXRlVWludDgsIHdyaXRlVWludDMyLCB3cml0ZUNvbG9yXG59IGZyb20gJy4vcHNkV3JpdGVyJztcblxuY29uc3QgYmV2ZWxTdHlsZXM6IEJldmVsU3R5bGVbXSA9IFtcblx0dW5kZWZpbmVkIGFzIGFueSwgJ291dGVyIGJldmVsJywgJ2lubmVyIGJldmVsJywgJ2VtYm9zcycsICdwaWxsb3cgZW1ib3NzJywgJ3N0cm9rZSBlbWJvc3MnXG5dO1xuXG5mdW5jdGlvbiByZWFkQmxlbmRNb2RlKHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcblx0cmV0dXJuIHRvQmxlbmRNb2RlW3JlYWRTaWduYXR1cmUocmVhZGVyKV0gfHwgJ25vcm1hbCc7XG59XG5cbmZ1bmN0aW9uIHdyaXRlQmxlbmRNb2RlKHdyaXRlcjogUHNkV3JpdGVyLCBtb2RlOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGZyb21CbGVuZE1vZGVbbW9kZSFdIHx8ICdub3JtJyk7XG59XG5cbmZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50OChyZWFkZXI6IFBzZFJlYWRlcikge1xuXHRyZXR1cm4gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xufVxuXG5mdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XG5cdHdyaXRlVWludDgod3JpdGVyLCBNYXRoLnJvdW5kKHZhbHVlICogMHhmZikgfCAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRFZmZlY3RzKHJlYWRlcjogUHNkUmVhZGVyKSB7XG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0aWYgKHZlcnNpb24gIT09IDApXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdHMgbGF5ZXIgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdGNvbnN0IGVmZmVjdHNDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0Y29uc3QgZWZmZWN0czogTGF5ZXJFZmZlY3RzSW5mbyA9IDxhbnk+e307XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlZmZlY3RzQ291bnQ7IGkrKykge1xuXHRcdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcblx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xuXG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlICdjbW5TJzogeyAvLyBjb21tb24gc3RhdGUgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgY29tbW9uIHN0YXRlIGluZm8pXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHZpc2libGUgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcblxuXHRcdFx0XHRpZiAoc2l6ZSAhPT0gNyB8fCB2ZXJzaW9uICE9PSAwIHx8ICF2aXNpYmxlKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBjb21tb24gc3RhdGVgKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdkc2R3JzogLy8gZHJvcCBzaGFkb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgZHJvcCBzaGFkb3cgYW5kIGlubmVyIHNoYWRvdyBpbmZvKVxuXHRcdFx0Y2FzZSAnaXNkdyc6IHsgLy8gaW5uZXIgc2hhZG93IChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGRyb3Agc2hhZG93IGFuZCBpbm5lciBzaGFkb3cgaW5mbylcblx0XHRcdFx0Y29uc3QgYmxvY2tTaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXG5cdFx0XHRcdGlmIChibG9ja1NpemUgIT09IDQxICYmIGJsb2NrU2l6ZSAhPT0gNTEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaGFkb3cgc2l6ZTogJHtibG9ja1NpemV9YCk7XG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaGFkb3cgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XG5cdFx0XHRcdHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTsgLy8gaW50ZW5zaXR5XG5cdFx0XHRcdGNvbnN0IGFuZ2xlID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBkaXN0YW5jZSA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgY29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgYmxlbmRNb2RlID0gcmVhZEJsZW5kTW9kZShyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBlbmFibGVkID0gISFyZWFkVWludDgocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgdXNlR2xvYmFsTGlnaHQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XG5cdFx0XHRcdGlmIChibG9ja1NpemUgPj0gNTEpIHJlYWRDb2xvcihyZWFkZXIpOyAvLyBuYXRpdmUgY29sb3Jcblx0XHRcdFx0Y29uc3Qgc2hhZG93SW5mbzogTGF5ZXJFZmZlY3RTaGFkb3cgPSB7XG5cdFx0XHRcdFx0c2l6ZTogeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiBzaXplIH0sXG5cdFx0XHRcdFx0ZGlzdGFuY2U6IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogZGlzdGFuY2UgfSxcblx0XHRcdFx0XHRhbmdsZSwgY29sb3IsIGJsZW5kTW9kZSwgZW5hYmxlZCwgdXNlR2xvYmFsTGlnaHQsIG9wYWNpdHlcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpZiAodHlwZSA9PT0gJ2RzZHcnKSB7XG5cdFx0XHRcdFx0ZWZmZWN0cy5kcm9wU2hhZG93ID0gc2hhZG93SW5mbztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRlZmZlY3RzLmlubmVyU2hhZG93ID0gc2hhZG93SW5mbztcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ29nbHcnOiB7IC8vIG91dGVyIGdsb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgb3V0ZXIgZ2xvdyBpbmZvKVxuXHRcdFx0XHRjb25zdCBibG9ja1NpemUgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSAhPT0gMzIgJiYgYmxvY2tTaXplICE9PSA0MikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIG91dGVyIGdsb3cgc2l6ZTogJHtibG9ja1NpemV9YCk7XG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBvdXRlciBnbG93IHZlcnNpb246ICR7dmVyc2lvbn1gKTtcblxuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRyZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7IC8vIGludGVuc2l0eVxuXHRcdFx0XHRjb25zdCBjb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBibGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XG5cdFx0XHRcdGlmIChibG9ja1NpemUgPj0gNDIpIHJlYWRDb2xvcihyZWFkZXIpOyAvLyBuYXRpdmUgY29sb3JcblxuXHRcdFx0XHRlZmZlY3RzLm91dGVyR2xvdyA9IHtcblx0XHRcdFx0XHRzaXplOiB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IHNpemUgfSxcblx0XHRcdFx0XHRjb2xvciwgYmxlbmRNb2RlLCBlbmFibGVkLCBvcGFjaXR5XG5cdFx0XHRcdH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnaWdsdyc6IHsgLy8gaW5uZXIgZ2xvdyAoc2VlIFNlZSBFZmZlY3RzIGxheWVyLCBpbm5lciBnbG93IGluZm8pXG5cdFx0XHRcdGNvbnN0IGJsb2NrU2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoYmxvY2tTaXplICE9PSAzMiAmJiBibG9ja1NpemUgIT09IDQzKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaW5uZXIgZ2xvdyBzaXplOiAke2Jsb2NrU2l6ZX1gKTtcblx0XHRcdFx0aWYgKHZlcnNpb24gIT09IDAgJiYgdmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGlubmVyIGdsb3cgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XG5cdFx0XHRcdHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTsgLy8gaW50ZW5zaXR5XG5cdFx0XHRcdGNvbnN0IGNvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IG9wYWNpdHkgPSByZWFkRml4ZWRQb2ludDgocmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoYmxvY2tTaXplID49IDQzKSB7XG5cdFx0XHRcdFx0cmVhZFVpbnQ4KHJlYWRlcik7IC8vIGludmVydGVkXG5cdFx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZWZmZWN0cy5pbm5lckdsb3cgPSB7XG5cdFx0XHRcdFx0c2l6ZTogeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiBzaXplIH0sXG5cdFx0XHRcdFx0Y29sb3IsIGJsZW5kTW9kZSwgZW5hYmxlZCwgb3BhY2l0eVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2JldmwnOiB7IC8vIGJldmVsIChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGJldmVsIGluZm8pXG5cdFx0XHRcdGNvbnN0IGJsb2NrU2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoYmxvY2tTaXplICE9PSA1OCAmJiBibG9ja1NpemUgIT09IDc4KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYmV2ZWwgc2l6ZTogJHtibG9ja1NpemV9YCk7XG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBiZXZlbCB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XG5cblx0XHRcdFx0Y29uc3QgYW5nbGUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHN0cmVuZ3RoID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBoaWdobGlnaHRCbGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IHNoYWRvd0JsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgaGlnaGxpZ2h0Q29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcblx0XHRcdFx0Y29uc3Qgc2hhZG93Q29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcblx0XHRcdFx0Y29uc3Qgc3R5bGUgPSBiZXZlbFN0eWxlc1tyZWFkVWludDgocmVhZGVyKV0gfHwgJ2lubmVyIGJldmVsJztcblx0XHRcdFx0Y29uc3QgaGlnaGxpZ2h0T3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBzaGFkb3dPcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCB1c2VHbG9iYWxMaWdodCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGRpcmVjdGlvbiA9IHJlYWRVaW50OChyZWFkZXIpID8gJ2Rvd24nIDogJ3VwJztcblxuXHRcdFx0XHRpZiAoYmxvY2tTaXplID49IDc4KSB7XG5cdFx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIHJlYWwgaGlnaGxpZ2h0IGNvbG9yXG5cdFx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIHJlYWwgc2hhZG93IGNvbG9yXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlZmZlY3RzLmJldmVsID0ge1xuXHRcdFx0XHRcdHNpemU6IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogc2l6ZSB9LFxuXHRcdFx0XHRcdGFuZ2xlLCBzdHJlbmd0aCwgaGlnaGxpZ2h0QmxlbmRNb2RlLCBzaGFkb3dCbGVuZE1vZGUsIGhpZ2hsaWdodENvbG9yLCBzaGFkb3dDb2xvcixcblx0XHRcdFx0XHRzdHlsZSwgaGlnaGxpZ2h0T3BhY2l0eSwgc2hhZG93T3BhY2l0eSwgZW5hYmxlZCwgdXNlR2xvYmFsTGlnaHQsIGRpcmVjdGlvbixcblx0XHRcdFx0fTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdzb2ZpJzogeyAvLyBzb2xpZCBmaWxsIChQaG90b3Nob3AgNy4wKSAoc2VlIFNlZSBFZmZlY3RzIGxheWVyLCBzb2xpZCBmaWxsIChhZGRlZCBpbiBQaG90b3Nob3AgNy4wKSlcblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoc2l6ZSAhPT0gMzQpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBlZmZlY3RzIHNvbGlkIGZpbGwgaW5mbyBzaXplOiAke3NpemV9YCk7XG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBzb2xpZCBmaWxsIGluZm8gdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdFx0XHRcdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcblx0XHRcdFx0Y29uc3QgY29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcblx0XHRcdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBlbmFibGVkID0gISFyZWFkVWludDgocmVhZGVyKTtcblx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxuXG5cdFx0XHRcdGVmZmVjdHMuc29saWRGaWxsID0geyBibGVuZE1vZGUsIGNvbG9yLCBvcGFjaXR5LCBlbmFibGVkIH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdCB0eXBlOiAnJHt0eXBlfSdgKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZWZmZWN0cztcbn1cblxuZnVuY3Rpb24gd3JpdGVTaGFkb3dJbmZvKHdyaXRlcjogUHNkV3JpdGVyLCBzaGFkb3c6IExheWVyRWZmZWN0U2hhZG93KSB7XG5cdHdyaXRlVWludDMyKHdyaXRlciwgNTEpO1xuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xuXHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIHNoYWRvdy5zaXplICYmIHNoYWRvdy5zaXplLnZhbHVlIHx8IDApO1xuXHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIDApOyAvLyBpbnRlbnNpdHlcblx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBzaGFkb3cuYW5nbGUgfHwgMCk7XG5cdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgc2hhZG93LmRpc3RhbmNlICYmIHNoYWRvdy5kaXN0YW5jZS52YWx1ZSB8fCAwKTtcblx0d3JpdGVDb2xvcih3cml0ZXIsIHNoYWRvdy5jb2xvcik7XG5cdHdyaXRlQmxlbmRNb2RlKHdyaXRlciwgc2hhZG93LmJsZW5kTW9kZSk7XG5cdHdyaXRlVWludDgod3JpdGVyLCBzaGFkb3cuZW5hYmxlZCA/IDEgOiAwKTtcblx0d3JpdGVVaW50OCh3cml0ZXIsIHNoYWRvdy51c2VHbG9iYWxMaWdodCA/IDEgOiAwKTtcblx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIHNoYWRvdy5vcGFjaXR5ID8/IDEpO1xuXHR3cml0ZUNvbG9yKHdyaXRlciwgc2hhZG93LmNvbG9yKTsgLy8gbmF0aXZlIGNvbG9yXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUVmZmVjdHMod3JpdGVyOiBQc2RXcml0ZXIsIGVmZmVjdHM6IExheWVyRWZmZWN0c0luZm8pIHtcblx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcblxuXHRsZXQgY291bnQgPSAxO1xuXHRpZiAoZWZmZWN0cy5kcm9wU2hhZG93KSBjb3VudCsrO1xuXHRpZiAoZWZmZWN0cy5pbm5lclNoYWRvdykgY291bnQrKztcblx0aWYgKGVmZmVjdHMub3V0ZXJHbG93KSBjb3VudCsrO1xuXHRpZiAoZWZmZWN0cy5pbm5lckdsb3cpIGNvdW50Kys7XG5cdGlmIChlZmZlY3RzLmJldmVsKSBjb3VudCsrO1xuXHRpZiAoZWZmZWN0cy5zb2xpZEZpbGwpIGNvdW50Kys7XG5cblx0d3JpdGVVaW50MTYod3JpdGVyLCBjb3VudCk7XG5cblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdjbW5TJyk7XG5cdHdyaXRlVWludDMyKHdyaXRlciwgNyk7IC8vIHNpemVcblx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTsgLy8gdmVyc2lvblxuXHR3cml0ZVVpbnQ4KHdyaXRlciwgMSk7IC8vIHZpc2libGVcblx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXG5cdGlmIChlZmZlY3RzLmRyb3BTaGFkb3cpIHtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnZHNkdycpO1xuXHRcdHdyaXRlU2hhZG93SW5mbyh3cml0ZXIsIGVmZmVjdHMuZHJvcFNoYWRvdyk7XG5cdH1cblxuXHRpZiAoZWZmZWN0cy5pbm5lclNoYWRvdykge1xuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdpc2R3Jyk7XG5cdFx0d3JpdGVTaGFkb3dJbmZvKHdyaXRlciwgZWZmZWN0cy5pbm5lclNoYWRvdyk7XG5cdH1cblxuXHRpZiAoZWZmZWN0cy5vdXRlckdsb3cpIHtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnb2dsdycpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNDIpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMik7XG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBlZmZlY3RzLm91dGVyR2xvdy5zaXplPy52YWx1ZSB8fCAwKTtcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIDApOyAvLyBpbnRlbnNpdHlcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgZWZmZWN0cy5vdXRlckdsb3cuY29sb3IpO1xuXHRcdHdyaXRlQmxlbmRNb2RlKHdyaXRlciwgZWZmZWN0cy5vdXRlckdsb3cuYmxlbmRNb2RlKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZWZmZWN0cy5vdXRlckdsb3cuZW5hYmxlZCA/IDEgOiAwKTtcblx0XHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgZWZmZWN0cy5vdXRlckdsb3cub3BhY2l0eSB8fCAwKTtcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgZWZmZWN0cy5vdXRlckdsb3cuY29sb3IpO1xuXHR9XG5cblx0aWYgKGVmZmVjdHMuaW5uZXJHbG93KSB7XG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ2lnbHcnKTtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDQzKTtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgZWZmZWN0cy5pbm5lckdsb3cuc2l6ZT8udmFsdWUgfHwgMCk7XG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCAwKTsgLy8gaW50ZW5zaXR5XG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGVmZmVjdHMuaW5uZXJHbG93LmNvbG9yKTtcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIGVmZmVjdHMuaW5uZXJHbG93LmJsZW5kTW9kZSk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGVmZmVjdHMuaW5uZXJHbG93LmVuYWJsZWQgPyAxIDogMCk7XG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIGVmZmVjdHMuaW5uZXJHbG93Lm9wYWNpdHkgfHwgMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApOyAvLyBpbnZlcnRlZFxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBlZmZlY3RzLmlubmVyR2xvdy5jb2xvcik7XG5cdH1cblxuXHRpZiAoZWZmZWN0cy5iZXZlbCkge1xuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdiZXZsJyk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA3OCk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTtcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIGVmZmVjdHMuYmV2ZWwuYW5nbGUgfHwgMCk7XG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBlZmZlY3RzLmJldmVsLnN0cmVuZ3RoIHx8IDApO1xuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgZWZmZWN0cy5iZXZlbC5zaXplPy52YWx1ZSB8fCAwKTtcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIGVmZmVjdHMuYmV2ZWwuaGlnaGxpZ2h0QmxlbmRNb2RlKTtcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIGVmZmVjdHMuYmV2ZWwuc2hhZG93QmxlbmRNb2RlKTtcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgZWZmZWN0cy5iZXZlbC5oaWdobGlnaHRDb2xvcik7XG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGVmZmVjdHMuYmV2ZWwuc2hhZG93Q29sb3IpO1xuXHRcdGNvbnN0IHN0eWxlID0gYmV2ZWxTdHlsZXMuaW5kZXhPZihlZmZlY3RzLmJldmVsLnN0eWxlISk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHN0eWxlIDw9IDAgPyAxIDogc3R5bGUpO1xuXHRcdHdyaXRlRml4ZWRQb2ludDgod3JpdGVyLCBlZmZlY3RzLmJldmVsLmhpZ2hsaWdodE9wYWNpdHkgfHwgMCk7XG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIGVmZmVjdHMuYmV2ZWwuc2hhZG93T3BhY2l0eSB8fCAwKTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgZWZmZWN0cy5iZXZlbC5lbmFibGVkID8gMSA6IDApO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBlZmZlY3RzLmJldmVsLnVzZUdsb2JhbExpZ2h0ID8gMSA6IDApO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBlZmZlY3RzLmJldmVsLmRpcmVjdGlvbiA9PT0gJ2Rvd24nID8gMSA6IDApO1xuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBlZmZlY3RzLmJldmVsLmhpZ2hsaWdodENvbG9yKTtcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgZWZmZWN0cy5iZXZlbC5zaGFkb3dDb2xvcik7XG5cdH1cblxuXHRpZiAoZWZmZWN0cy5zb2xpZEZpbGwpIHtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnc29maScpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMzQpO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMik7XG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBlZmZlY3RzLnNvbGlkRmlsbC5ibGVuZE1vZGUpO1xuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBlZmZlY3RzLnNvbGlkRmlsbC5jb2xvcik7XG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIGVmZmVjdHMuc29saWRGaWxsLm9wYWNpdHkgfHwgMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGVmZmVjdHMuc29saWRGaWxsLmVuYWJsZWQgPyAxIDogMCk7XG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGVmZmVjdHMuc29saWRGaWxsLmNvbG9yKTtcblx0fVxufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
