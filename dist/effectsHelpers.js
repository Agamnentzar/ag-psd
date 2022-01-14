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
                    effects.dropShadow = [shadowInfo];
                }
                else {
                    effects.innerShadow = [shadowInfo];
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
                effects.solidFill = [{ blendMode: blendMode, color: color, opacity: opacity, enabled: enabled }];
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
    psdWriter_1.writeUint16(writer, 0);
    psdWriter_1.writeUint16(writer, count);
    psdWriter_1.writeSignature(writer, '8BIM');
    psdWriter_1.writeSignature(writer, 'cmnS');
    psdWriter_1.writeUint32(writer, 7); // size
    psdWriter_1.writeUint32(writer, 0); // version
    psdWriter_1.writeUint8(writer, 1); // visible
    psdWriter_1.writeZeros(writer, 2);
    if (dropShadow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'dsdw');
        writeShadowInfo(writer, dropShadow);
    }
    if (innerShadow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'isdw');
        writeShadowInfo(writer, innerShadow);
    }
    if (outerGlow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'oglw');
        psdWriter_1.writeUint32(writer, 42);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, ((_d = outerGlow.size) === null || _d === void 0 ? void 0 : _d.value) || 0);
        psdWriter_1.writeFixedPoint32(writer, 0); // intensity
        psdWriter_1.writeColor(writer, outerGlow.color);
        writeBlendMode(writer, outerGlow.blendMode);
        psdWriter_1.writeUint8(writer, outerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, outerGlow.opacity || 0);
        psdWriter_1.writeColor(writer, outerGlow.color);
    }
    if (innerGlow) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'iglw');
        psdWriter_1.writeUint32(writer, 43);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, ((_e = innerGlow.size) === null || _e === void 0 ? void 0 : _e.value) || 0);
        psdWriter_1.writeFixedPoint32(writer, 0); // intensity
        psdWriter_1.writeColor(writer, innerGlow.color);
        writeBlendMode(writer, innerGlow.blendMode);
        psdWriter_1.writeUint8(writer, innerGlow.enabled ? 1 : 0);
        writeFixedPoint8(writer, innerGlow.opacity || 0);
        psdWriter_1.writeUint8(writer, 0); // inverted
        psdWriter_1.writeColor(writer, innerGlow.color);
    }
    if (bevel) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'bevl');
        psdWriter_1.writeUint32(writer, 78);
        psdWriter_1.writeUint32(writer, 2);
        psdWriter_1.writeFixedPoint32(writer, bevel.angle || 0);
        psdWriter_1.writeFixedPoint32(writer, bevel.strength || 0);
        psdWriter_1.writeFixedPoint32(writer, ((_f = bevel.size) === null || _f === void 0 ? void 0 : _f.value) || 0);
        writeBlendMode(writer, bevel.highlightBlendMode);
        writeBlendMode(writer, bevel.shadowBlendMode);
        psdWriter_1.writeColor(writer, bevel.highlightColor);
        psdWriter_1.writeColor(writer, bevel.shadowColor);
        var style = bevelStyles.indexOf(bevel.style);
        psdWriter_1.writeUint8(writer, style <= 0 ? 1 : style);
        writeFixedPoint8(writer, bevel.highlightOpacity || 0);
        writeFixedPoint8(writer, bevel.shadowOpacity || 0);
        psdWriter_1.writeUint8(writer, bevel.enabled ? 1 : 0);
        psdWriter_1.writeUint8(writer, bevel.useGlobalLight ? 1 : 0);
        psdWriter_1.writeUint8(writer, bevel.direction === 'down' ? 1 : 0);
        psdWriter_1.writeColor(writer, bevel.highlightColor);
        psdWriter_1.writeColor(writer, bevel.shadowColor);
    }
    if (solidFill) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, 'sofi');
        psdWriter_1.writeUint32(writer, 34);
        psdWriter_1.writeUint32(writer, 2);
        writeBlendMode(writer, solidFill.blendMode);
        psdWriter_1.writeColor(writer, solidFill.color);
        writeFixedPoint8(writer, solidFill.opacity || 0);
        psdWriter_1.writeUint8(writer, solidFill.enabled ? 1 : 0);
        psdWriter_1.writeColor(writer, solidFill.color);
    }
}
exports.writeEffects = writeEffects;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxDQUFDLENBQUM7UUFDdkIsY0FBYyxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUMsc0JBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BDLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2pELHNCQUFVLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUMsc0JBQVUsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3BDO0FBQ0YsQ0FBQztBQXJHRCxvQ0FxR0MiLCJmaWxlIjoiZWZmZWN0c0hlbHBlcnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMYXllckVmZmVjdHNJbmZvLCBCZXZlbFN0eWxlLCBMYXllckVmZmVjdFNoYWRvdyB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHsgdG9CbGVuZE1vZGUsIGZyb21CbGVuZE1vZGUgfSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQge1xyXG5cdFBzZFJlYWRlciwgY2hlY2tTaWduYXR1cmUsIHJlYWRTaWduYXR1cmUsIHNraXBCeXRlcywgcmVhZFVpbnQxNiwgcmVhZFVpbnQ4LFxyXG5cdHJlYWRVaW50MzIsIHJlYWRGaXhlZFBvaW50MzIsIHJlYWRDb2xvclxyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcclxuaW1wb3J0IHtcclxuXHRQc2RXcml0ZXIsIHdyaXRlU2lnbmF0dXJlLCB3cml0ZVVpbnQxNiwgd3JpdGVaZXJvcywgd3JpdGVGaXhlZFBvaW50MzIsXHJcblx0d3JpdGVVaW50OCwgd3JpdGVVaW50MzIsIHdyaXRlQ29sb3JcclxufSBmcm9tICcuL3BzZFdyaXRlcic7XHJcblxyXG5jb25zdCBiZXZlbFN0eWxlczogQmV2ZWxTdHlsZVtdID0gW1xyXG5cdHVuZGVmaW5lZCBhcyBhbnksICdvdXRlciBiZXZlbCcsICdpbm5lciBiZXZlbCcsICdlbWJvc3MnLCAncGlsbG93IGVtYm9zcycsICdzdHJva2UgZW1ib3NzJ1xyXG5dO1xyXG5cclxuZnVuY3Rpb24gcmVhZEJsZW5kTW9kZShyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcclxuXHRyZXR1cm4gdG9CbGVuZE1vZGVbcmVhZFNpZ25hdHVyZShyZWFkZXIpXSB8fCAnbm9ybWFsJztcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVCbGVuZE1vZGUod3JpdGVyOiBQc2RXcml0ZXIsIG1vZGU6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xyXG5cdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGZyb21CbGVuZE1vZGVbbW9kZSFdIHx8ICdub3JtJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRGaXhlZFBvaW50OChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdHJldHVybiByZWFkVWludDgocmVhZGVyKSAvIDB4ZmY7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlRml4ZWRQb2ludDgod3JpdGVyOiBQc2RXcml0ZXIsIHZhbHVlOiBudW1iZXIpIHtcclxuXHR3cml0ZVVpbnQ4KHdyaXRlciwgTWF0aC5yb3VuZCh2YWx1ZSAqIDB4ZmYpIHwgMCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkRWZmZWN0cyhyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0aWYgKHZlcnNpb24gIT09IDApIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBlZmZlY3RzIGxheWVyIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0Y29uc3QgZWZmZWN0c0NvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGVmZmVjdHM6IExheWVyRWZmZWN0c0luZm8gPSA8YW55Pnt9O1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGVmZmVjdHNDb3VudDsgaSsrKSB7XHJcblx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cclxuXHRcdHN3aXRjaCAodHlwZSkge1xyXG5cdFx0XHRjYXNlICdjbW5TJzogeyAvLyBjb21tb24gc3RhdGUgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgY29tbW9uIHN0YXRlIGluZm8pXHJcblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZpc2libGUgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cclxuXHRcdFx0XHRpZiAoc2l6ZSAhPT0gNyB8fCB2ZXJzaW9uICE9PSAwIHx8ICF2aXNpYmxlKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBjb21tb24gc3RhdGVgKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdkc2R3JzogLy8gZHJvcCBzaGFkb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgZHJvcCBzaGFkb3cgYW5kIGlubmVyIHNoYWRvdyBpbmZvKVxyXG5cdFx0XHRjYXNlICdpc2R3JzogeyAvLyBpbm5lciBzaGFkb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgZHJvcCBzaGFkb3cgYW5kIGlubmVyIHNoYWRvdyBpbmZvKVxyXG5cdFx0XHRcdGNvbnN0IGJsb2NrU2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoYmxvY2tTaXplICE9PSA0MSAmJiBibG9ja1NpemUgIT09IDUxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgc2hhZG93IHNpemU6ICR7YmxvY2tTaXplfWApO1xyXG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBzaGFkb3cgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBzaXplID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTsgLy8gaW50ZW5zaXR5XHJcblx0XHRcdFx0Y29uc3QgYW5nbGUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgZGlzdGFuY2UgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgY29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBibGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdXNlR2xvYmFsTGlnaHQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IG9wYWNpdHkgPSByZWFkRml4ZWRQb2ludDgocmVhZGVyKTtcclxuXHRcdFx0XHRpZiAoYmxvY2tTaXplID49IDUxKSByZWFkQ29sb3IocmVhZGVyKTsgLy8gbmF0aXZlIGNvbG9yXHJcblx0XHRcdFx0Y29uc3Qgc2hhZG93SW5mbzogTGF5ZXJFZmZlY3RTaGFkb3cgPSB7XHJcblx0XHRcdFx0XHRzaXplOiB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IHNpemUgfSxcclxuXHRcdFx0XHRcdGRpc3RhbmNlOiB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IGRpc3RhbmNlIH0sXHJcblx0XHRcdFx0XHRhbmdsZSwgY29sb3IsIGJsZW5kTW9kZSwgZW5hYmxlZCwgdXNlR2xvYmFsTGlnaHQsIG9wYWNpdHlcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRpZiAodHlwZSA9PT0gJ2RzZHcnKSB7XHJcblx0XHRcdFx0XHRlZmZlY3RzLmRyb3BTaGFkb3cgPSBbc2hhZG93SW5mb107XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGVmZmVjdHMuaW5uZXJTaGFkb3cgPSBbc2hhZG93SW5mb107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ29nbHcnOiB7IC8vIG91dGVyIGdsb3cgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgb3V0ZXIgZ2xvdyBpbmZvKVxyXG5cdFx0XHRcdGNvbnN0IGJsb2NrU2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdFx0XHRpZiAoYmxvY2tTaXplICE9PSAzMiAmJiBibG9ja1NpemUgIT09IDQyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgb3V0ZXIgZ2xvdyBzaXplOiAke2Jsb2NrU2l6ZX1gKTtcclxuXHRcdFx0XHRpZiAodmVyc2lvbiAhPT0gMCAmJiB2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgb3V0ZXIgZ2xvdyB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0cmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpOyAvLyBpbnRlbnNpdHlcclxuXHRcdFx0XHRjb25zdCBjb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGJsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBlbmFibGVkID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSA+PSA0MikgcmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxyXG5cclxuXHRcdFx0XHRlZmZlY3RzLm91dGVyR2xvdyA9IHtcclxuXHRcdFx0XHRcdHNpemU6IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogc2l6ZSB9LFxyXG5cdFx0XHRcdFx0Y29sb3IsIGJsZW5kTW9kZSwgZW5hYmxlZCwgb3BhY2l0eVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnaWdsdyc6IHsgLy8gaW5uZXIgZ2xvdyAoc2VlIFNlZSBFZmZlY3RzIGxheWVyLCBpbm5lciBnbG93IGluZm8pXHJcblx0XHRcdFx0Y29uc3QgYmxvY2tTaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblxyXG5cdFx0XHRcdGlmIChibG9ja1NpemUgIT09IDMyICYmIGJsb2NrU2l6ZSAhPT0gNDMpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpbm5lciBnbG93IHNpemU6ICR7YmxvY2tTaXplfWApO1xyXG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpbm5lciBnbG93IHZlcnNpb246ICR7dmVyc2lvbn1gKTtcclxuXHJcblx0XHRcdFx0Y29uc3Qgc2l6ZSA9IHJlYWRGaXhlZFBvaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRyZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7IC8vIGludGVuc2l0eVxyXG5cdFx0XHRcdGNvbnN0IGNvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgYmxlbmRNb2RlID0gcmVhZEJsZW5kTW9kZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IG9wYWNpdHkgPSByZWFkRml4ZWRQb2ludDgocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSA+PSA0Mykge1xyXG5cdFx0XHRcdFx0cmVhZFVpbnQ4KHJlYWRlcik7IC8vIGludmVydGVkXHJcblx0XHRcdFx0XHRyZWFkQ29sb3IocmVhZGVyKTsgLy8gbmF0aXZlIGNvbG9yXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlZmZlY3RzLmlubmVyR2xvdyA9IHtcclxuXHRcdFx0XHRcdHNpemU6IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogc2l6ZSB9LFxyXG5cdFx0XHRcdFx0Y29sb3IsIGJsZW5kTW9kZSwgZW5hYmxlZCwgb3BhY2l0eVxyXG5cdFx0XHRcdH07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAnYmV2bCc6IHsgLy8gYmV2ZWwgKHNlZSBTZWUgRWZmZWN0cyBsYXllciwgYmV2ZWwgaW5mbylcclxuXHRcdFx0XHRjb25zdCBibG9ja1NpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0aWYgKGJsb2NrU2l6ZSAhPT0gNTggJiYgYmxvY2tTaXplICE9PSA3OCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJldmVsIHNpemU6ICR7YmxvY2tTaXplfWApO1xyXG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAwICYmIHZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBiZXZlbCB2ZXJzaW9uOiAke3ZlcnNpb259YCk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGFuZ2xlID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHN0cmVuZ3RoID0gcmVhZEZpeGVkUG9pbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkRml4ZWRQb2ludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgaGlnaGxpZ2h0QmxlbmRNb2RlID0gcmVhZEJsZW5kTW9kZShyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHNoYWRvd0JsZW5kTW9kZSA9IHJlYWRCbGVuZE1vZGUocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBoaWdobGlnaHRDb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHNoYWRvd0NvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgc3R5bGUgPSBiZXZlbFN0eWxlc1tyZWFkVWludDgocmVhZGVyKV0gfHwgJ2lubmVyIGJldmVsJztcclxuXHRcdFx0XHRjb25zdCBoaWdobGlnaHRPcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgc2hhZG93T3BhY2l0eSA9IHJlYWRGaXhlZFBvaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGVuYWJsZWQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHVzZUdsb2JhbExpZ2h0ID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBkaXJlY3Rpb24gPSByZWFkVWludDgocmVhZGVyKSA/ICdkb3duJyA6ICd1cCc7XHJcblxyXG5cdFx0XHRcdGlmIChibG9ja1NpemUgPj0gNzgpIHtcclxuXHRcdFx0XHRcdHJlYWRDb2xvcihyZWFkZXIpOyAvLyByZWFsIGhpZ2hsaWdodCBjb2xvclxyXG5cdFx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIHJlYWwgc2hhZG93IGNvbG9yXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlZmZlY3RzLmJldmVsID0ge1xyXG5cdFx0XHRcdFx0c2l6ZTogeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiBzaXplIH0sXHJcblx0XHRcdFx0XHRhbmdsZSwgc3RyZW5ndGgsIGhpZ2hsaWdodEJsZW5kTW9kZSwgc2hhZG93QmxlbmRNb2RlLCBoaWdobGlnaHRDb2xvciwgc2hhZG93Q29sb3IsXHJcblx0XHRcdFx0XHRzdHlsZSwgaGlnaGxpZ2h0T3BhY2l0eSwgc2hhZG93T3BhY2l0eSwgZW5hYmxlZCwgdXNlR2xvYmFsTGlnaHQsIGRpcmVjdGlvbixcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ3NvZmknOiB7IC8vIHNvbGlkIGZpbGwgKFBob3Rvc2hvcCA3LjApIChzZWUgU2VlIEVmZmVjdHMgbGF5ZXIsIHNvbGlkIGZpbGwgKGFkZGVkIGluIFBob3Rvc2hvcCA3LjApKVxyXG5cdFx0XHRcdGNvbnN0IHNpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRcdFx0aWYgKHNpemUgIT09IDM0KSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBzb2xpZCBmaWxsIGluZm8gc2l6ZTogJHtzaXplfWApO1xyXG5cdFx0XHRcdGlmICh2ZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0cyBzb2xpZCBmaWxsIGluZm8gdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBibGVuZE1vZGUgPSByZWFkQmxlbmRNb2RlKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgY29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gcmVhZEZpeGVkUG9pbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgZW5hYmxlZCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0cmVhZENvbG9yKHJlYWRlcik7IC8vIG5hdGl2ZSBjb2xvclxyXG5cclxuXHRcdFx0XHRlZmZlY3RzLnNvbGlkRmlsbCA9IFt7IGJsZW5kTW9kZSwgY29sb3IsIG9wYWNpdHksIGVuYWJsZWQgfV07XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZWZmZWN0IHR5cGU6ICcke3R5cGV9J2ApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGVmZmVjdHM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlU2hhZG93SW5mbyh3cml0ZXI6IFBzZFdyaXRlciwgc2hhZG93OiBMYXllckVmZmVjdFNoYWRvdykge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgNTEpO1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgMik7XHJcblx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBzaGFkb3cuc2l6ZSAmJiBzaGFkb3cuc2l6ZS52YWx1ZSB8fCAwKTtcclxuXHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIDApOyAvLyBpbnRlbnNpdHlcclxuXHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIHNoYWRvdy5hbmdsZSB8fCAwKTtcclxuXHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIHNoYWRvdy5kaXN0YW5jZSAmJiBzaGFkb3cuZGlzdGFuY2UudmFsdWUgfHwgMCk7XHJcblx0d3JpdGVDb2xvcih3cml0ZXIsIHNoYWRvdy5jb2xvcik7XHJcblx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBzaGFkb3cuYmxlbmRNb2RlKTtcclxuXHR3cml0ZVVpbnQ4KHdyaXRlciwgc2hhZG93LmVuYWJsZWQgPyAxIDogMCk7XHJcblx0d3JpdGVVaW50OCh3cml0ZXIsIHNoYWRvdy51c2VHbG9iYWxMaWdodCA/IDEgOiAwKTtcclxuXHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgc2hhZG93Lm9wYWNpdHkgPz8gMSk7XHJcblx0d3JpdGVDb2xvcih3cml0ZXIsIHNoYWRvdy5jb2xvcik7IC8vIG5hdGl2ZSBjb2xvclxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVFZmZlY3RzKHdyaXRlcjogUHNkV3JpdGVyLCBlZmZlY3RzOiBMYXllckVmZmVjdHNJbmZvKSB7XHJcblx0Y29uc3QgZHJvcFNoYWRvdyA9IGVmZmVjdHMuZHJvcFNoYWRvdz8uWzBdO1xyXG5cdGNvbnN0IGlubmVyU2hhZG93ID0gZWZmZWN0cy5pbm5lclNoYWRvdz8uWzBdO1xyXG5cdGNvbnN0IG91dGVyR2xvdyA9IGVmZmVjdHMub3V0ZXJHbG93O1xyXG5cdGNvbnN0IGlubmVyR2xvdyA9IGVmZmVjdHMuaW5uZXJHbG93O1xyXG5cdGNvbnN0IGJldmVsID0gZWZmZWN0cy5iZXZlbDtcclxuXHRjb25zdCBzb2xpZEZpbGwgPSBlZmZlY3RzLnNvbGlkRmlsbD8uWzBdO1xyXG5cclxuXHRsZXQgY291bnQgPSAxO1xyXG5cdGlmIChkcm9wU2hhZG93KSBjb3VudCsrO1xyXG5cdGlmIChpbm5lclNoYWRvdykgY291bnQrKztcclxuXHRpZiAob3V0ZXJHbG93KSBjb3VudCsrO1xyXG5cdGlmIChpbm5lckdsb3cpIGNvdW50Kys7XHJcblx0aWYgKGJldmVsKSBjb3VudCsrO1xyXG5cdGlmIChzb2xpZEZpbGwpIGNvdW50Kys7XHJcblxyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBjb3VudCk7XHJcblxyXG5cdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdjbW5TJyk7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCA3KTsgLy8gc2l6ZVxyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIHZlcnNpb25cclxuXHR3cml0ZVVpbnQ4KHdyaXRlciwgMSk7IC8vIHZpc2libGVcclxuXHR3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblxyXG5cdGlmIChkcm9wU2hhZG93KSB7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdkc2R3Jyk7XHJcblx0XHR3cml0ZVNoYWRvd0luZm8od3JpdGVyLCBkcm9wU2hhZG93KTtcclxuXHR9XHJcblxyXG5cdGlmIChpbm5lclNoYWRvdykge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnaXNkdycpO1xyXG5cdFx0d3JpdGVTaGFkb3dJbmZvKHdyaXRlciwgaW5uZXJTaGFkb3cpO1xyXG5cdH1cclxuXHJcblx0aWYgKG91dGVyR2xvdykge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnb2dsdycpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA0Mik7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBvdXRlckdsb3cuc2l6ZT8udmFsdWUgfHwgMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIDApOyAvLyBpbnRlbnNpdHlcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBvdXRlckdsb3cuY29sb3IpO1xyXG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBvdXRlckdsb3cuYmxlbmRNb2RlKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBvdXRlckdsb3cuZW5hYmxlZCA/IDEgOiAwKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDgod3JpdGVyLCBvdXRlckdsb3cub3BhY2l0eSB8fCAwKTtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBvdXRlckdsb3cuY29sb3IpO1xyXG5cdH1cclxuXHJcblx0aWYgKGlubmVyR2xvdykge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnaWdsdycpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCA0Myk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDIpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBpbm5lckdsb3cuc2l6ZT8udmFsdWUgfHwgMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIDApOyAvLyBpbnRlbnNpdHlcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBpbm5lckdsb3cuY29sb3IpO1xyXG5cdFx0d3JpdGVCbGVuZE1vZGUod3JpdGVyLCBpbm5lckdsb3cuYmxlbmRNb2RlKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBpbm5lckdsb3cuZW5hYmxlZCA/IDEgOiAwKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDgod3JpdGVyLCBpbm5lckdsb3cub3BhY2l0eSB8fCAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTsgLy8gaW52ZXJ0ZWRcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBpbm5lckdsb3cuY29sb3IpO1xyXG5cdH1cclxuXHJcblx0aWYgKGJldmVsKSB7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdiZXZsJyk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDc4KTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMik7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQzMih3cml0ZXIsIGJldmVsLmFuZ2xlIHx8IDApO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50MzIod3JpdGVyLCBiZXZlbC5zdHJlbmd0aCB8fCAwKTtcclxuXHRcdHdyaXRlRml4ZWRQb2ludDMyKHdyaXRlciwgYmV2ZWwuc2l6ZT8udmFsdWUgfHwgMCk7XHJcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIGJldmVsLmhpZ2hsaWdodEJsZW5kTW9kZSk7XHJcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIGJldmVsLnNoYWRvd0JsZW5kTW9kZSk7XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgYmV2ZWwuaGlnaGxpZ2h0Q29sb3IpO1xyXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGJldmVsLnNoYWRvd0NvbG9yKTtcclxuXHRcdGNvbnN0IHN0eWxlID0gYmV2ZWxTdHlsZXMuaW5kZXhPZihiZXZlbC5zdHlsZSEpO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHN0eWxlIDw9IDAgPyAxIDogc3R5bGUpO1xyXG5cdFx0d3JpdGVGaXhlZFBvaW50OCh3cml0ZXIsIGJldmVsLmhpZ2hsaWdodE9wYWNpdHkgfHwgMCk7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgYmV2ZWwuc2hhZG93T3BhY2l0eSB8fCAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBiZXZlbC5lbmFibGVkID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGJldmVsLnVzZUdsb2JhbExpZ2h0ID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGJldmVsLmRpcmVjdGlvbiA9PT0gJ2Rvd24nID8gMSA6IDApO1xyXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGJldmVsLmhpZ2hsaWdodENvbG9yKTtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBiZXZlbC5zaGFkb3dDb2xvcik7XHJcblx0fVxyXG5cclxuXHRpZiAoc29saWRGaWxsKSB7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdzb2ZpJyk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDM0KTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMik7XHJcblx0XHR3cml0ZUJsZW5kTW9kZSh3cml0ZXIsIHNvbGlkRmlsbC5ibGVuZE1vZGUpO1xyXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIHNvbGlkRmlsbC5jb2xvcik7XHJcblx0XHR3cml0ZUZpeGVkUG9pbnQ4KHdyaXRlciwgc29saWRGaWxsLm9wYWNpdHkgfHwgMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgc29saWRGaWxsLmVuYWJsZWQgPyAxIDogMCk7XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgc29saWRGaWxsLmNvbG9yKTtcclxuXHR9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
