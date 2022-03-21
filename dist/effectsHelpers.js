"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeEffects = exports.readEffects = void 0;
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var bevelStyles = [
    undefined, 'outer bevel', 'inner bevel', 'emboss', 'pillow emboss', 'stroke emboss'
];
function readBlendMode(reader) {
    (0, psdReader_1.checkSignature)(reader, '8BIM');
    return helpers_1.toBlendMode[(0, psdReader_1.readSignature)(reader)] || 'normal';
}
function writeBlendMode(writer, mode) {
    (0, psdWriter_1.writeSignature)(writer, '8BIM');
    (0, psdWriter_1.writeSignature)(writer, helpers_1.fromBlendMode[mode] || 'norm');
}
function readFixedPoint8(reader) {
    return (0, psdReader_1.readUint8)(reader) / 0xff;
}
function writeFixedPoint8(writer, value) {
    (0, psdWriter_1.writeUint8)(writer, Math.round(value * 0xff) | 0);
}
function readEffects(reader) {
    var version = (0, psdReader_1.readUint16)(reader);
    if (version !== 0)
        throw new Error("Invalid effects layer version: ".concat(version));
    var effectsCount = (0, psdReader_1.readUint16)(reader);
    var effects = {};
    for (var i = 0; i < effectsCount; i++) {
        (0, psdReader_1.checkSignature)(reader, '8BIM');
        var type = (0, psdReader_1.readSignature)(reader);
        switch (type) {
            case 'cmnS': { // common state (see See Effects layer, common state info)
                var size = (0, psdReader_1.readUint32)(reader);
                var version_1 = (0, psdReader_1.readUint32)(reader);
                var visible = !!(0, psdReader_1.readUint8)(reader);
                (0, psdReader_1.skipBytes)(reader, 2);
                if (size !== 7 || version_1 !== 0 || !visible)
                    throw new Error("Invalid effects common state");
                break;
            }
            case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
            case 'isdw': { // inner shadow (see See Effects layer, drop shadow and inner shadow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_2 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 41 && blockSize !== 51)
                    throw new Error("Invalid shadow size: ".concat(blockSize));
                if (version_2 !== 0 && version_2 !== 2)
                    throw new Error("Invalid shadow version: ".concat(version_2));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var angle = (0, psdReader_1.readFixedPoint32)(reader);
                var distance = (0, psdReader_1.readFixedPoint32)(reader);
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var useGlobalLight = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 51)
                    (0, psdReader_1.readColor)(reader); // native color
                var shadowInfo = {
                    size: { units: 'Pixels', value: size },
                    distance: { units: 'Pixels', value: distance },
                    angle: angle,
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    useGlobalLight: useGlobalLight,
                    opacity: opacity
                };
                if (type === 'dsdw') {
                    effects.dropShadow = [shadowInfo];
                }
                else {
                    effects.innerShadow = [shadowInfo];
                }
                break;
            }
            case 'oglw': { // outer glow (see See Effects layer, outer glow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_3 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 32 && blockSize !== 42)
                    throw new Error("Invalid outer glow size: ".concat(blockSize));
                if (version_3 !== 0 && version_3 !== 2)
                    throw new Error("Invalid outer glow version: ".concat(version_3));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 42)
                    (0, psdReader_1.readColor)(reader); // native color
                effects.outerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    opacity: opacity
                };
                break;
            }
            case 'iglw': { // inner glow (see See Effects layer, inner glow info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_4 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 32 && blockSize !== 43)
                    throw new Error("Invalid inner glow size: ".concat(blockSize));
                if (version_4 !== 0 && version_4 !== 2)
                    throw new Error("Invalid inner glow version: ".concat(version_4));
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                (0, psdReader_1.readFixedPoint32)(reader); // intensity
                var color = (0, psdReader_1.readColor)(reader);
                var blendMode = readBlendMode(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var opacity = readFixedPoint8(reader);
                if (blockSize >= 43) {
                    (0, psdReader_1.readUint8)(reader); // inverted
                    (0, psdReader_1.readColor)(reader); // native color
                }
                effects.innerGlow = {
                    size: { units: 'Pixels', value: size },
                    color: color,
                    blendMode: blendMode,
                    enabled: enabled,
                    opacity: opacity
                };
                break;
            }
            case 'bevl': { // bevel (see See Effects layer, bevel info)
                var blockSize = (0, psdReader_1.readUint32)(reader);
                var version_5 = (0, psdReader_1.readUint32)(reader);
                if (blockSize !== 58 && blockSize !== 78)
                    throw new Error("Invalid bevel size: ".concat(blockSize));
                if (version_5 !== 0 && version_5 !== 2)
                    throw new Error("Invalid bevel version: ".concat(version_5));
                var angle = (0, psdReader_1.readFixedPoint32)(reader);
                var strength = (0, psdReader_1.readFixedPoint32)(reader);
                var size = (0, psdReader_1.readFixedPoint32)(reader);
                var highlightBlendMode = readBlendMode(reader);
                var shadowBlendMode = readBlendMode(reader);
                var highlightColor = (0, psdReader_1.readColor)(reader);
                var shadowColor = (0, psdReader_1.readColor)(reader);
                var style = bevelStyles[(0, psdReader_1.readUint8)(reader)] || 'inner bevel';
                var highlightOpacity = readFixedPoint8(reader);
                var shadowOpacity = readFixedPoint8(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                var useGlobalLight = !!(0, psdReader_1.readUint8)(reader);
                var direction = (0, psdReader_1.readUint8)(reader) ? 'down' : 'up';
                if (blockSize >= 78) {
                    (0, psdReader_1.readColor)(reader); // real highlight color
                    (0, psdReader_1.readColor)(reader); // real shadow color
                }
                effects.bevel = {
                    size: { units: 'Pixels', value: size },
                    angle: angle,
                    strength: strength,
                    highlightBlendMode: highlightBlendMode,
                    shadowBlendMode: shadowBlendMode,
                    highlightColor: highlightColor,
                    shadowColor: shadowColor,
                    style: style,
                    highlightOpacity: highlightOpacity,
                    shadowOpacity: shadowOpacity,
                    enabled: enabled,
                    useGlobalLight: useGlobalLight,
                    direction: direction,
                };
                break;
            }
            case 'sofi': { // solid fill (Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
                var size = (0, psdReader_1.readUint32)(reader);
                var version_6 = (0, psdReader_1.readUint32)(reader);
                if (size !== 34)
                    throw new Error("Invalid effects solid fill info size: ".concat(size));
                if (version_6 !== 2)
                    throw new Error("Invalid effects solid fill info version: ".concat(version_6));
                var blendMode = readBlendMode(reader);
                var color = (0, psdReader_1.readColor)(reader);
                var opacity = readFixedPoint8(reader);
                var enabled = !!(0, psdReader_1.readUint8)(reader);
                (0, psdReader_1.readColor)(reader); // native color
                effects.solidFill = [{ blendMode: blendMode, color: color, opacity: opacity, enabled: enabled }];
                break;
            }
            default:
                throw new Error("Invalid effect type: '".concat(type, "'"));
        }
    }
    return effects;
}
exports.readEffects = readEffects;
function writeShadowInfo(writer, shadow) {
    var _a;
    (0, psdWriter_1.writeUint32)(writer, 51);
    (0, psdWriter_1.writeUint32)(writer, 2);
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.size && shadow.size.value || 0);
    (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.angle || 0);
    (0, psdWriter_1.writeFixedPoint32)(writer, shadow.distance && shadow.distance.value || 0);
    (0, psdWriter_1.writeColor)(writer, shadow.color);
    writeBlendMode(writer, shadow.blendMode);
    (0, psdWriter_1.writeUint8)(writer, shadow.enabled ? 1 : 0);
    (0, psdWriter_1.writeUint8)(writer, shadow.useGlobalLight ? 1 : 0);
    writeFixedPoint8(writer, (_a = shadow.opacity) !== null && _a !== void 0 ? _a : 1);
    (0, psdWriter_1.writeColor)(writer, shadow.color); // native color
}
function writeEffects(writer, effects) {
    var _a, _b, _c, _d, _e, _f;
    var dropShadow = (_a = effects.dropShadow) === null || _a === void 0 ? void 0 : _a[0];
    var innerShadow = (_b = effects.innerShadow) === null || _b === void 0 ? void 0 : _b[0];
    var outerGlow = effects.outerGlow;
    var innerGlow = effects.innerGlow;
    var bevel = effects.bevel;
    var solidFill = (_c = effects.solidFill) === null || _c === void 0 ? void 0 : _c[0];
    var count = 1;
    if (dropShadow)
        count++;
    if (innerShadow)
        count++;
    if (outerGlow)
        count++;
    if (innerGlow)
        count++;
    if (bevel)
        count++;
    if (solidFill)
        count++;
    (0, psdWriter_1.writeUint16)(writer, 0);
    (0, psdWriter_1.writeUint16)(writer, count);
    (0, psdWriter_1.writeSignature)(writer, '8BIM');
    (0, psdWriter_1.writeSignature)(writer, 'cmnS');
    (0, psdWriter_1.writeUint32)(writer, 7); // size
    (0, psdWriter_1.writeUint32)(writer, 0); // version
    (0, psdWriter_1.writeUint8)(writer, 1); // visible
    (0, psdWriter_1.writeZeros)(writer, 2);
    if (dropShadow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'dsdw');
        writeShadowInfo(writer, dropShadow);
    }
    if (innerShadow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'isdw');
        writeShadowInfo(writer, innerShadow);
    }
    if (outerGlow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'oglw');
        (0, psdWriter_1.writeUint32)(writer, 42);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_d = outerGlow.size) === null || _d === void 0 ? void 0 : _d.value) || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
        (0, psdWriter_1.writeColor)(writer, outerGlow.color);
        writeBlendMode(writer, outerGlow.blendMode);
        (0, psdWriter_1.writeUint8)(writer, outerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, outerGlow.opacity || 0);
        (0, psdWriter_1.writeColor)(writer, outerGlow.color);
    }
    if (innerGlow) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'iglw');
        (0, psdWriter_1.writeUint32)(writer, 43);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_e = innerGlow.size) === null || _e === void 0 ? void 0 : _e.value) || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, 0); // intensity
        (0, psdWriter_1.writeColor)(writer, innerGlow.color);
        writeBlendMode(writer, innerGlow.blendMode);
        (0, psdWriter_1.writeUint8)(writer, innerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, innerGlow.opacity || 0);
        (0, psdWriter_1.writeUint8)(writer, 0); // inverted
        (0, psdWriter_1.writeColor)(writer, innerGlow.color);
    }
    if (bevel) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'bevl');
        (0, psdWriter_1.writeUint32)(writer, 78);
        (0, psdWriter_1.writeUint32)(writer, 2);
        (0, psdWriter_1.writeFixedPoint32)(writer, bevel.angle || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, bevel.strength || 0);
        (0, psdWriter_1.writeFixedPoint32)(writer, ((_f = bevel.size) === null || _f === void 0 ? void 0 : _f.value) || 0);
        writeBlendMode(writer, bevel.highlightBlendMode);
        writeBlendMode(writer, bevel.shadowBlendMode);
        (0, psdWriter_1.writeColor)(writer, bevel.highlightColor);
        (0, psdWriter_1.writeColor)(writer, bevel.shadowColor);
        var style = bevelStyles.indexOf(bevel.style);
        (0, psdWriter_1.writeUint8)(writer, style <= 0 ? 1 : style);
        writeFixedPoint8(writer, bevel.highlightOpacity || 0);
        writeFixedPoint8(writer, bevel.shadowOpacity || 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.enabled ? 1 : 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.useGlobalLight ? 1 : 0);
        (0, psdWriter_1.writeUint8)(writer, bevel.direction === 'down' ? 1 : 0);
        (0, psdWriter_1.writeColor)(writer, bevel.highlightColor);
        (0, psdWriter_1.writeColor)(writer, bevel.shadowColor);
    }
    if (solidFill) {
        (0, psdWriter_1.writeSignature)(writer, '8BIM');
        (0, psdWriter_1.writeSignature)(writer, 'sofi');
        (0, psdWriter_1.writeUint32)(writer, 34);
        (0, psdWriter_1.writeUint32)(writer, 2);
        writeBlendMode(writer, solidFill.blendMode);
        (0, psdWriter_1.writeColor)(writer, solidFill.color);
        writeFixedPoint8(writer, solidFill.opacity || 0);
        (0, psdWriter_1.writeUint8)(writer, solidFill.enabled ? 1 : 0);
        (0, psdWriter_1.writeColor)(writer, solidFill.color);
    }
}
exports.writeEffects = writeEffects;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxJQUFBLHNCQUFVLEVBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUNwQztBQUNGLENBQUM7QUFyR0Qsb0NBcUdDIiwiZmlsZSI6ImVmZmVjdHNIZWxwZXJzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTGF5ZXJFZmZlY3RzSW5mbywgQmV2ZWxTdHlsZSwgTGF5ZXJFZmZlY3RTaGFkb3cgfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7IHRvQmxlbmRNb2RlLCBmcm9tQmxlbmRNb2RlIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHtcclxuXHRQc2RSZWFkZXIsIGNoZWNrU2lnbmF0dXJlLCByZWFkU2lnbmF0dXJlLCBza2lwQnl0ZXMsIHJlYWRVaW50MTYsIHJlYWRVaW50OCxcclxuXHRyZWFkVWludDMyLCByZWFkRml4ZWRQb2ludDMyLCByZWFkQ29sb3JcclxufSBmcm9tICcuL3BzZFJlYWRlcic7XHJcbmltcG9ydCB7XHJcblx0UHNkV3JpdGVyLCB3cml0ZVNpZ25hdHVyZSwgd3JpdGVVaW50MTYsIHdyaXRlWmVyb3MsIHdyaXRlRml4ZWRQb2ludDMyLFxyXG5cdHdyaXRlVWludDgsIHdyaXRlVWludDMyLCB3cml0ZUNvbG9yXHJcbn0gZnJvbSAnLi9wc2RXcml0ZXInO1xyXG5cclxuY29uc3QgYmV2ZWxTdHlsZXM6IEJldmVsU3R5bGVbXSA9IFtcclxuXHR1bmRlZmluZWQgYXMgYW55LCAnb3V0ZXIgYmV2ZWwnLCAnaW5uZXIgYmV2ZWwnLCAnZW1ib3NzJywgJ3BpbGxvdyBlbWJvc3MnLCAnc3Ryb2tlIGVtYm9zcydcclxuXTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRCbGVuZE1vZGUocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0cmV0dXJuIHRvQmxlbmRNb2RlW3JlYWRTaWduYXR1cmUocmVhZGVyKV0gfHwgJ25vcm1hbCc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQmxlbmRNb2RlKHdyaXRlcjogUHNkV3JpdGVyLCBtb2RlOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmcm9tQmxlbmRNb2RlW21vZGUhXSB8fCAnbm9ybScpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkRml4ZWRQb2ludDgocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRyZXR1cm4gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogbnVtYmVyKSB7XHJcblx0d3JpdGVVaW50OCh3cml0ZXIsIE1hdGgucm91bmQodmFsdWUgKiAweGZmKSB8IDApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEVmZmVjdHMocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdGlmICh2ZXJzaW9uICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBsYXllciB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdGNvbnN0IGVmZmVjdHNDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBlZmZlY3RzOiBMYXllckVmZmVjdHNJbmZvID0gPGFueT57fTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBlZmZlY3RzQ291bnQ7IGkrKykge1xyXG5cdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0Y29uc3QgdHlwZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHJcblx0XHRzd2l0Y2ggKHR5cGUpIHtcclxuXHRcdFx0Y2FzZSAnY21uUyc6IHsgLy8gY29tbW9uIHN0YXRlIChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGNvbW1vbiBzdGF0ZSBpbmZvKVxyXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2aXNpYmxlID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHJcblx0XHRcdFx0aWYgKHNpemUgIT09IDcgfHwgdmVyc2lvbiAhPT0gMCB8fCAhdmlzaWJsZSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdHMgY29tbW9uIHN0YXRlYCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnZHNkdyc6IC8vIGRyb3Agc2hhZG93IChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGRyb3Agc2hhZG93IGFuZCBpbm5lciBzaGFkb3cgaW5mbylcclxuXHRcdFx0Y2FzZSAnaXNkdyc6IHsgLy8gaW5uZXIgc2hhZG93IChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGRyb3Agc2hhZG93IGFuZCBpbm5lciBzaGFkb3cgaW5mbylcclxuXHRcdFx0XHRjb25zdCBibG9ja1NpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSAhPT0gNDEgJiYgYmxvY2tTaXplICE9PSA1MSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNoYWRvdyBzaXplOiAke2Jsb2NrU2l6ZX1gKTtcclxuXHRcdFx0XHRpZiAodmVyc2lvbiAhPT0gMCAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2hhZG93IHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRyZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7IC8vIGludGVuc2l0eVxyXG5cdFx0XHRcdGNvbnN0IGFuZ2xlID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGRpc3RhbmNlID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGNvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgYmxlbmRNb2RlID0gcmVhZEJsZW5kTW9kZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHVzZUdsb2JhbExpZ2h0ID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSA+PSA1MSkgcmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxyXG5cdFx0XHRcdGNvbnN0IHNoYWRvd0luZm86IExheWVyRWZmZWN0U2hhZG93ID0ge1xyXG5cdFx0XHRcdFx0c2l6ZTogeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiBzaXplIH0sXHJcblx0XHRcdFx0XHRkaXN0YW5jZTogeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiBkaXN0YW5jZSB9LFxyXG5cdFx0XHRcdFx0YW5nbGUsIGNvbG9yLCBibGVuZE1vZGUsIGVuYWJsZWQsIHVzZUdsb2JhbExpZ2h0LCBvcGFjaXR5XHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0aWYgKHR5cGUgPT09ICdkc2R3Jykge1xyXG5cdFx0XHRcdFx0ZWZmZWN0cy5kcm9wU2hhZG93ID0gW3NoYWRvd0luZm9dO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRlZmZlY3RzLmlubmVyU2hhZG93ID0gW3NoYWRvd0luZm9dO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdvZ2x3JzogeyAvLyBvdXRlciBnbG93IChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIG91dGVyIGdsb3cgaW5mbylcclxuXHRcdFx0XHRjb25zdCBibG9ja1NpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSAhPT0gMzIgJiYgYmxvY2tTaXplICE9PSA0MikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIG91dGVyIGdsb3cgc2l6ZTogJHtibG9ja1NpemV9YCk7XHJcblx0XHRcdFx0aWYgKHZlcnNpb24gIT09IDAgJiYgdmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIG91dGVyIGdsb3cgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTsgLy8gaW50ZW5zaXR5XHJcblx0XHRcdFx0Y29uc3QgY29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBibGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGlmIChibG9ja1NpemUgPj0gNDIpIHJlYWRDb2xvcihyZWFkZXIpOyAvLyBuYXRpdmUgY29sb3JcclxuXHJcblx0XHRcdFx0ZWZmZWN0cy5vdXRlckdsb3cgPSB7XHJcblx0XHRcdFx0XHRzaXplOiB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IHNpemUgfSxcclxuXHRcdFx0XHRcdGNvbG9yLCBibGVuZE1vZGUsIGVuYWJsZWQsIG9wYWNpdHlcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ2lnbHcnOiB7IC8vIGlubmVyIGdsb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgaW5uZXIgZ2xvdyBpbmZvKVxyXG5cdFx0XHRcdGNvbnN0IGJsb2NrU2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoYmxvY2tTaXplICE9PSAzMiAmJiBibG9ja1NpemUgIT09IDQzKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaW5uZXIgZ2xvdyBzaXplOiAke2Jsb2NrU2l6ZX1gKTtcclxuXHRcdFx0XHRpZiAodmVyc2lvbiAhPT0gMCAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaW5uZXIgZ2xvdyB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0cmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpOyAvLyBpbnRlbnNpdHlcclxuXHRcdFx0XHRjb25zdCBjb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBlbmFibGVkID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XHJcblxyXG5cdFx0XHRcdGlmIChibG9ja1NpemUgPj0gNDMpIHtcclxuXHRcdFx0XHRcdHJlYWRVaW50OChyZWFkZXIpOyAvLyBpbnZlcnRlZFxyXG5cdFx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZWZmZWN0cy5pbm5lckdsb3cgPSB7XHJcblx0XHRcdFx0XHRzaXplOiB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IHNpemUgfSxcclxuXHRcdFx0XHRcdGNvbG9yLCBibGVuZE1vZGUsIGVuYWJsZWQsIG9wYWNpdHlcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ2JldmwnOiB7IC8vIGJldmVsIChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIGJldmVsIGluZm8pXHJcblx0XHRcdFx0Y29uc3QgYmxvY2tTaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0XHRcdGlmIChibG9ja1NpemUgIT09IDU4ICYmIGJsb2NrU2l6ZSAhPT0gNzgpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBiZXZlbCBzaXplOiAke2Jsb2NrU2l6ZX1gKTtcclxuXHRcdFx0XHRpZiAodmVyc2lvbiAhPT0gMCAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYmV2ZWwgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBhbmdsZSA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBzdHJlbmd0aCA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGhpZ2hsaWdodEJsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBzaGFkb3dCbGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgaGlnaGxpZ2h0Q29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBzaGFkb3dDb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHN0eWxlID0gYmV2ZWxTdHlsZXNbcmVhZFVpbnQ4KHJlYWRlcildIHx8ICdpbm5lciBiZXZlbCc7XHJcblx0XHRcdFx0Y29uc3QgaGlnaGxpZ2h0T3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHNoYWRvd09wYWNpdHkgPSByZWFkRml4ZWRQb2ludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBlbmFibGVkID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB1c2VHbG9iYWxMaWdodCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgZGlyZWN0aW9uID0gcmVhZFVpbnQ4KHJlYWRlcikgPyAnZG93bicgOiAndXAnO1xyXG5cclxuXHRcdFx0XHRpZiAoYmxvY2tTaXplID49IDc4KSB7XHJcblx0XHRcdFx0XHRyZWFkQ29sb3IocmVhZGVyKTsgLy8gcmVhbCBoaWdobGlnaHQgY29sb3JcclxuXHRcdFx0XHRcdHJlYWRDb2xvcihyZWFkZXIpOyAvLyByZWFsIHNoYWRvdyBjb2xvclxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZWZmZWN0cy5iZXZlbCA9IHtcclxuXHRcdFx0XHRcdHNpemU6IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogc2l6ZSB9LFxyXG5cdFx0XHRcdFx0YW5nbGUsIHN0cmVuZ3RoLCBoaWdobGlnaHRCbGVuZE1vZGUsIHNoYWRvd0JsZW5kTW9kZSwgaGlnaGxpZ2h0Q29sb3IsIHNoYWRvd0NvbG9yLFxyXG5cdFx0XHRcdFx0c3R5bGUsIGhpZ2hsaWdodE9wYWNpdHksIHNoYWRvd09wYWNpdHksIGVuYWJsZWQsIHVzZUdsb2JhbExpZ2h0LCBkaXJlY3Rpb24sXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdzb2ZpJzogeyAvLyBzb2xpZCBmaWxsIChQaG90b3Nob3AgNy4wKSAoc2VlIFNlZSBFZmZlY3RzIGxheWVyLCBzb2xpZCBmaWxsIChhZGRlZCBpbiBQaG90b3Nob3AgNy4wKSlcclxuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0XHRcdGlmIChzaXplICE9PSAzNCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdHMgc29saWQgZmlsbCBpbmZvIHNpemU6ICR7c2l6ZX1gKTtcclxuXHRcdFx0XHRpZiAodmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdHMgc29saWQgZmlsbCBpbmZvIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0XHRcdFx0Y29uc3QgYmxlbmRNb2RlID0gcmVhZEJsZW5kTW9kZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGNvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgb3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdHJlYWRDb2xvcihyZWFkZXIpOyAvLyBuYXRpdmUgY29sb3JcclxuXHJcblx0XHRcdFx0ZWZmZWN0cy5zb2xpZEZpbGwgPSBbeyBibGVuZE1vZGUsIGNvbG9yLCBvcGFjaXR5LCBlbmFibGVkIH1dO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGVmZmVjdCB0eXBlOiAnJHt0eXBlfSdgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBlZmZlY3RzO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVNoYWRvd0luZm8od3JpdGVyOiBQc2RXcml0ZXIsIHNoYWRvdzogTGF5ZXJFZmZlY3RTaGFkb3cpIHtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDUxKTtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xyXG5cdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgc2hhZG93LnNpemUgJiYgc2hhZG93LnNpemUudmFsdWUgfHwgMCk7XHJcblx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCAwKTsgLy8gaW50ZW5zaXR5XHJcblx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBzaGFkb3cuYW5nbGUgfHwgMCk7XHJcblx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBzaGFkb3cuZGlzdGFuY2UgJiYgc2hhZG93LmRpc3RhbmNlLnZhbHVlIHx8IDApO1xyXG5cdHdyaXRlQ29sb3Iod3JpdGVyLCBzaGFkb3cuY29sb3IpO1xyXG5cdHdyaXRlQmxlbmRNb2RlKHdyaXRlciwgc2hhZG93LmJsZW5kTW9kZSk7XHJcblx0d3JpdGVVaW50OCh3cml0ZXIsIHNoYWRvdy5lbmFibGVkID8gMSA6IDApO1xyXG5cdHdyaXRlVWludDgod3JpdGVyLCBzaGFkb3cudXNlR2xvYmFsTGlnaHQgPyAxIDogMCk7XHJcblx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIHNoYWRvdy5vcGFjaXR5ID8/IDEpO1xyXG5cdHdyaXRlQ29sb3Iod3JpdGVyLCBzaGFkb3cuY29sb3IpOyAvLyBuYXRpdmUgY29sb3JcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlRWZmZWN0cyh3cml0ZXI6IFBzZFdyaXRlciwgZWZmZWN0czogTGF5ZXJFZmZlY3RzSW5mbykge1xyXG5cdGNvbnN0IGRyb3BTaGFkb3cgPSBlZmZlY3RzLmRyb3BTaGFkb3c/LlswXTtcclxuXHRjb25zdCBpbm5lclNoYWRvdyA9IGVmZmVjdHMuaW5uZXJTaGFkb3c/LlswXTtcclxuXHRjb25zdCBvdXRlckdsb3cgPSBlZmZlY3RzLm91dGVyR2xvdztcclxuXHRjb25zdCBpbm5lckdsb3cgPSBlZmZlY3RzLmlubmVyR2xvdztcclxuXHRjb25zdCBiZXZlbCA9IGVmZmVjdHMuYmV2ZWw7XHJcblx0Y29uc3Qgc29saWRGaWxsID0gZWZmZWN0cy5zb2xpZEZpbGw/LlswXTtcclxuXHJcblx0bGV0IGNvdW50ID0gMTtcclxuXHRpZiAoZHJvcFNoYWRvdykgY291bnQrKztcclxuXHRpZiAoaW5uZXJTaGFkb3cpIGNvdW50Kys7XHJcblx0aWYgKG91dGVyR2xvdykgY291bnQrKztcclxuXHRpZiAoaW5uZXJHbG93KSBjb3VudCsrO1xyXG5cdGlmIChiZXZlbCkgY291bnQrKztcclxuXHRpZiAoc29saWRGaWxsKSBjb3VudCsrO1xyXG5cclxuXHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgY291bnQpO1xyXG5cclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnY21uUycpO1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgNyk7IC8vIHNpemVcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyB2ZXJzaW9uXHJcblx0d3JpdGVVaW50OCh3cml0ZXIsIDEpOyAvLyB2aXNpYmxlXHJcblx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cclxuXHRpZiAoZHJvcFNoYWRvdykge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnZHNkdycpO1xyXG5cdFx0d3JpdGVTaGFkb3dJbmZvKHdyaXRlciwgZHJvcFNoYWRvdyk7XHJcblx0fVxyXG5cclxuXHRpZiAoaW5uZXJTaGFkb3cpIHtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ2lzZHcnKTtcclxuXHRcdHdyaXRlU2hhZG93SW5mbyh3cml0ZXIsIGlubmVyU2hhZG93KTtcclxuXHR9XHJcblxyXG5cdGlmIChvdXRlckdsb3cpIHtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ29nbHcnKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNDIpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgb3V0ZXJHbG93LnNpemU/LnZhbHVlIHx8IDApO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCAwKTsgLy8gaW50ZW5zaXR5XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgb3V0ZXJHbG93LmNvbG9yKTtcclxuXHRcdHdyaXRlQmxlbmRNb2RlKHdyaXRlciwgb3V0ZXJHbG93LmJsZW5kTW9kZSk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgb3V0ZXJHbG93LmVuYWJsZWQgPyAxIDogMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgb3V0ZXJHbG93Lm9wYWNpdHkgfHwgMCk7XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgb3V0ZXJHbG93LmNvbG9yKTtcclxuXHR9XHJcblxyXG5cdGlmIChpbm5lckdsb3cpIHtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ2lnbHcnKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgNDMpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAyKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgaW5uZXJHbG93LnNpemU/LnZhbHVlIHx8IDApO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCAwKTsgLy8gaW50ZW5zaXR5XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgaW5uZXJHbG93LmNvbG9yKTtcclxuXHRcdHdyaXRlQmxlbmRNb2RlKHdyaXRlciwgaW5uZXJHbG93LmJsZW5kTW9kZSk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5uZXJHbG93LmVuYWJsZWQgPyAxIDogMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgaW5uZXJHbG93Lm9wYWNpdHkgfHwgMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7IC8vIGludmVydGVkXHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgaW5uZXJHbG93LmNvbG9yKTtcclxuXHR9XHJcblxyXG5cdGlmIChiZXZlbCkge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnYmV2bCcpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA3OCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBiZXZlbC5hbmdsZSB8fCAwKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgYmV2ZWwuc3RyZW5ndGggfHwgMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIGJldmVsLnNpemU/LnZhbHVlIHx8IDApO1xyXG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBiZXZlbC5oaWdobGlnaHRCbGVuZE1vZGUpO1xyXG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBiZXZlbC5zaGFkb3dCbGVuZE1vZGUpO1xyXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGJldmVsLmhpZ2hsaWdodENvbG9yKTtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBiZXZlbC5zaGFkb3dDb2xvcik7XHJcblx0XHRjb25zdCBzdHlsZSA9IGJldmVsU3R5bGVzLmluZGV4T2YoYmV2ZWwuc3R5bGUhKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBzdHlsZSA8PSAwID8gMSA6IHN0eWxlKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDgod3JpdGVyLCBiZXZlbC5oaWdobGlnaHRPcGFjaXR5IHx8IDApO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIGJldmVsLnNoYWRvd09wYWNpdHkgfHwgMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgYmV2ZWwuZW5hYmxlZCA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBiZXZlbC51c2VHbG9iYWxMaWdodCA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBiZXZlbC5kaXJlY3Rpb24gPT09ICdkb3duJyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBiZXZlbC5oaWdobGlnaHRDb2xvcik7XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgYmV2ZWwuc2hhZG93Q29sb3IpO1xyXG5cdH1cclxuXHJcblx0aWYgKHNvbGlkRmlsbCkge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnc29maScpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAzNCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xyXG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBzb2xpZEZpbGwuYmxlbmRNb2RlKTtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBzb2xpZEZpbGwuY29sb3IpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIHNvbGlkRmlsbC5vcGFjaXR5IHx8IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHNvbGlkRmlsbC5lbmFibGVkID8gMSA6IDApO1xyXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIHNvbGlkRmlsbC5jb2xvcik7XHJcblx0fVxyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
