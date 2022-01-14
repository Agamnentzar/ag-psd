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
import { fromByteArray, toByteArray } from 'base64-js';
import { readEffects, writeEffects } from './effectsHelpers';
import { clamp, createEnum, layerColors, MOCK_HANDLERS } from './helpers';
import { readSignature, readUnicodeString, skipBytes, readUint32, readUint8, readFloat64, readUint16, readBytes, readInt16, checkSignature, readFloat32, readFixedPointPath32, readSection, readColor, readInt32, readPascalString, readUnicodeStringWithLength, readAsciiString, readPattern, } from './psdReader';
import { writeZeros, writeSignature, writeBytes, writeUint32, writeUint16, writeFloat64, writeUint8, writeInt16, writeFloat32, writeFixedPointPath32, writeUnicodeString, writeSection, writeUnicodeStringWithPadding, writeColor, writePascalString, writeInt32, } from './psdWriter';
import { Annt, BESl, BESs, BETE, BlnM, bvlT, ClrS, FrFl, FStl, GrdT, IGSr, Ornt, parseAngle, parsePercent, parsePercentOrAngle, parseUnits, parseUnitsOrNumber, readVersionAndDescriptor, strokeStyleLineAlignment, strokeStyleLineCapType, strokeStyleLineJoinType, textGridding, unitsAngle, unitsPercent, unitsValue, warpStyle, writeVersionAndDescriptor } from './descriptor';
import { serializeEngineData, parseEngineData } from './engineData';
import { encodeEngineData, decodeEngineData } from './text';
export var infoHandlers = [];
export var infoHandlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    infoHandlers.push(handler);
    infoHandlersMap[handler.key] = handler;
}
function addHandlerAlias(key, target) {
    infoHandlersMap[key] = infoHandlersMap[target];
}
function hasKey(key) {
    return function (target) { return target[key] !== undefined; };
}
function readLength64(reader) {
    if (readUint32(reader))
        throw new Error("Resource size above 4 GB limit at " + reader.offset.toString(16));
    return readUint32(reader);
}
function writeLength64(writer, length) {
    writeUint32(writer, 0);
    writeUint32(writer, length);
}
addHandler('TySh', hasKey('text'), function (reader, target, leftBytes) {
    if (readInt16(reader) !== 1)
        throw new Error("Invalid TySh version");
    var transform = [];
    for (var i = 0; i < 6; i++)
        transform.push(readFloat64(reader));
    if (readInt16(reader) !== 50)
        throw new Error("Invalid TySh text version");
    var text = readVersionAndDescriptor(reader);
    if (readInt16(reader) !== 1)
        throw new Error("Invalid TySh warp version");
    var warp = readVersionAndDescriptor(reader);
    target.text = {
        transform: transform,
        left: readFloat32(reader),
        top: readFloat32(reader),
        right: readFloat32(reader),
        bottom: readFloat32(reader),
        text: text['Txt '].replace(/\r/g, '\n'),
        index: text.TextIndex || 0,
        gridding: textGridding.decode(text.textGridding),
        antiAlias: Annt.decode(text.AntA),
        orientation: Ornt.decode(text.Ornt),
        warp: {
            style: warpStyle.decode(warp.warpStyle),
            value: warp.warpValue || 0,
            perspective: warp.warpPerspective || 0,
            perspectiveOther: warp.warpPerspectiveOther || 0,
            rotate: Ornt.decode(warp.warpRotate),
        },
    };
    if (text.EngineData) {
        var engineData = decodeEngineData(parseEngineData(text.EngineData));
        // const before = parseEngineData(text.EngineData);
        // const after = encodeEngineData(engineData);
        // require('fs').writeFileSync('before.txt', require('util').inspect(before, false, 99, false), 'utf8');
        // require('fs').writeFileSync('after.txt', require('util').inspect(after, false, 99, false), 'utf8');
        // console.log(require('util').inspect(parseEngineData(text.EngineData), false, 99, true));
        target.text = __assign(__assign({}, target.text), engineData);
        // console.log(require('util').inspect(target.text, false, 99, true));
    }
    skipBytes(reader, leftBytes());
}, function (writer, target) {
    var text = target.text;
    var warp = text.warp || {};
    var transform = text.transform || [1, 0, 0, 1, 0, 0];
    var textDescriptor = {
        'Txt ': (text.text || '').replace(/\r?\n/g, '\r'),
        textGridding: textGridding.encode(text.gridding),
        Ornt: Ornt.encode(text.orientation),
        AntA: Annt.encode(text.antiAlias),
        TextIndex: text.index || 0,
        EngineData: serializeEngineData(encodeEngineData(text)),
    };
    writeInt16(writer, 1); // version
    for (var i = 0; i < 6; i++) {
        writeFloat64(writer, transform[i]);
    }
    writeInt16(writer, 50); // text version
    writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor);
    writeInt16(writer, 1); // warp version
    writeVersionAndDescriptor(writer, '', 'warp', encodeWarp(warp));
    writeFloat32(writer, text.left);
    writeFloat32(writer, text.top);
    writeFloat32(writer, text.right);
    writeFloat32(writer, text.bottom);
    // writeZeros(writer, 2);
});
// vector fills
addHandler('SoCo', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    target.vectorFill.type === 'color'; }, function (reader, target) {
    var descriptor = readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('GdFl', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    (target.vectorFill.type === 'solid' || target.vectorFill.type === 'noise'); }, function (reader, target, left) {
    var descriptor = readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
    skipBytes(reader, left());
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('PtFl', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    target.vectorFill.type === 'pattern'; }, function (reader, target) {
    var descriptor = readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('vscg', function (target) { return target.vectorFill !== undefined && target.vectorStroke !== undefined; }, function (reader, target, left) {
    readSignature(reader); // key
    var desc = readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(desc);
    skipBytes(reader, left());
}, function (writer, target) {
    var _a = serializeVectorContent(target.vectorFill), descriptor = _a.descriptor, key = _a.key;
    writeSignature(writer, key);
    writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
export function readBezierKnot(reader, width, height) {
    var y0 = readFixedPointPath32(reader) * height;
    var x0 = readFixedPointPath32(reader) * width;
    var y1 = readFixedPointPath32(reader) * height;
    var x1 = readFixedPointPath32(reader) * width;
    var y2 = readFixedPointPath32(reader) * height;
    var x2 = readFixedPointPath32(reader) * width;
    return [x0, y0, x1, y1, x2, y2];
}
function writeBezierKnot(writer, points, width, height) {
    writeFixedPointPath32(writer, points[1] / height); // y0
    writeFixedPointPath32(writer, points[0] / width); // x0
    writeFixedPointPath32(writer, points[3] / height); // y1
    writeFixedPointPath32(writer, points[2] / width); // x1
    writeFixedPointPath32(writer, points[5] / height); // y2
    writeFixedPointPath32(writer, points[4] / width); // x2
}
export var booleanOperations = ['exclude', 'combine', 'subtract', 'intersect'];
export function readVectorMask(reader, vectorMask, width, height, size) {
    var end = reader.offset + size;
    var paths = vectorMask.paths;
    var path = undefined;
    while ((end - reader.offset) >= 26) {
        var selector = readUint16(reader);
        switch (selector) {
            case 0: // Closed subpath length record
            case 3: { // Open subpath length record
                readUint16(reader); // count
                var boolOp = readInt16(reader);
                readUint16(reader); // always 1 ?
                skipBytes(reader, 18);
                // TODO: 'combine' here might be wrong
                path = { open: selector === 3, operation: boolOp === -1 ? 'combine' : booleanOperations[boolOp], knots: [] };
                paths.push(path);
                break;
            }
            case 1: // Closed subpath Bezier knot, linked
            case 2: // Closed subpath Bezier knot, unlinked
            case 4: // Open subpath Bezier knot, linked
            case 5: // Open subpath Bezier knot, unlinked
                path.knots.push({ linked: (selector === 1 || selector === 4), points: readBezierKnot(reader, width, height) });
                break;
            case 6: // Path fill rule record
                skipBytes(reader, 24);
                break;
            case 7: { // Clipboard record
                // TODO: check if these need to be multiplied by document size
                var top_1 = readFixedPointPath32(reader);
                var left = readFixedPointPath32(reader);
                var bottom = readFixedPointPath32(reader);
                var right = readFixedPointPath32(reader);
                var resolution = readFixedPointPath32(reader);
                skipBytes(reader, 4);
                vectorMask.clipboard = { top: top_1, left: left, bottom: bottom, right: right, resolution: resolution };
                break;
            }
            case 8: // Initial fill rule record
                vectorMask.fillStartsWithAllPixels = !!readUint16(reader);
                skipBytes(reader, 22);
                break;
            default: throw new Error('Invalid vmsk section');
        }
    }
    return paths;
}
addHandler('vmsk', hasKey('vectorMask'), function (reader, target, left, _a) {
    var width = _a.width, height = _a.height;
    if (readUint32(reader) !== 3)
        throw new Error('Invalid vmsk version');
    target.vectorMask = { paths: [] };
    var vectorMask = target.vectorMask;
    var flags = readUint32(reader);
    vectorMask.invert = (flags & 1) !== 0;
    vectorMask.notLink = (flags & 2) !== 0;
    vectorMask.disable = (flags & 4) !== 0;
    readVectorMask(reader, vectorMask, width, height, left());
    // drawBezierPaths(vectorMask.paths, width, height, 'out.png');
    skipBytes(reader, left());
}, function (writer, target, _a) {
    var width = _a.width, height = _a.height;
    var vectorMask = target.vectorMask;
    var flags = (vectorMask.invert ? 1 : 0) |
        (vectorMask.notLink ? 2 : 0) |
        (vectorMask.disable ? 4 : 0);
    writeUint32(writer, 3); // version
    writeUint32(writer, flags);
    // initial entry
    writeUint16(writer, 6);
    writeZeros(writer, 24);
    var clipboard = vectorMask.clipboard;
    if (clipboard) {
        writeUint16(writer, 7);
        writeFixedPointPath32(writer, clipboard.top);
        writeFixedPointPath32(writer, clipboard.left);
        writeFixedPointPath32(writer, clipboard.bottom);
        writeFixedPointPath32(writer, clipboard.right);
        writeFixedPointPath32(writer, clipboard.resolution);
        writeZeros(writer, 4);
    }
    if (vectorMask.fillStartsWithAllPixels !== undefined) {
        writeUint16(writer, 8);
        writeUint16(writer, vectorMask.fillStartsWithAllPixels ? 1 : 0);
        writeZeros(writer, 22);
    }
    for (var _i = 0, _b = vectorMask.paths; _i < _b.length; _i++) {
        var path = _b[_i];
        writeUint16(writer, path.open ? 3 : 0);
        writeUint16(writer, path.knots.length);
        writeUint16(writer, Math.abs(booleanOperations.indexOf(path.operation))); // default to 1 if not found
        writeUint16(writer, 1);
        writeZeros(writer, 18); // TODO: these are sometimes non-zero
        var linkedKnot = path.open ? 4 : 1;
        var unlinkedKnot = path.open ? 5 : 2;
        for (var _c = 0, _d = path.knots; _c < _d.length; _c++) {
            var _e = _d[_c], linked = _e.linked, points = _e.points;
            writeUint16(writer, linked ? linkedKnot : unlinkedKnot);
            writeBezierKnot(writer, points, width, height);
        }
    }
});
// TODO: need to write vmsk if has outline ?
addHandlerAlias('vsms', 'vmsk');
addHandler('vogk', hasKey('vectorOrigination'), function (reader, target, left) {
    if (readInt32(reader) !== 1)
        throw new Error("Invalid vogk version");
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.vectorOrigination = { keyDescriptorList: [] };
    for (var _i = 0, _a = desc.keyDescriptorList; _i < _a.length; _i++) {
        var i = _a[_i];
        var item = {};
        if (i.keyShapeInvalidated != null)
            item.keyShapeInvalidated = i.keyShapeInvalidated;
        if (i.keyOriginType != null)
            item.keyOriginType = i.keyOriginType;
        if (i.keyOriginResolution != null)
            item.keyOriginResolution = i.keyOriginResolution;
        if (i.keyOriginShapeBBox) {
            item.keyOriginShapeBoundingBox = {
                top: parseUnits(i.keyOriginShapeBBox['Top ']),
                left: parseUnits(i.keyOriginShapeBBox.Left),
                bottom: parseUnits(i.keyOriginShapeBBox.Btom),
                right: parseUnits(i.keyOriginShapeBBox.Rght),
            };
        }
        var rectRadii = i.keyOriginRRectRadii;
        if (rectRadii) {
            item.keyOriginRRectRadii = {
                topRight: parseUnits(rectRadii.topRight),
                topLeft: parseUnits(rectRadii.topLeft),
                bottomLeft: parseUnits(rectRadii.bottomLeft),
                bottomRight: parseUnits(rectRadii.bottomRight),
            };
        }
        var corners = i.keyOriginBoxCorners;
        if (corners) {
            item.keyOriginBoxCorners = [
                { x: corners.rectangleCornerA.Hrzn, y: corners.rectangleCornerA.Vrtc },
                { x: corners.rectangleCornerB.Hrzn, y: corners.rectangleCornerB.Vrtc },
                { x: corners.rectangleCornerC.Hrzn, y: corners.rectangleCornerC.Vrtc },
                { x: corners.rectangleCornerD.Hrzn, y: corners.rectangleCornerD.Vrtc },
            ];
        }
        var trnf = i.Trnf;
        if (trnf) {
            item.transform = [trnf.xx, trnf.xy, trnf.xy, trnf.yy, trnf.tx, trnf.ty];
        }
        target.vectorOrigination.keyDescriptorList.push(item);
    }
    skipBytes(reader, left());
}, function (writer, target) {
    var _a, _b;
    target;
    var orig = target.vectorOrigination;
    var desc = { keyDescriptorList: [] };
    for (var i = 0; i < orig.keyDescriptorList.length; i++) {
        var item = orig.keyDescriptorList[i];
        if (item.keyShapeInvalidated) {
            desc.keyDescriptorList.push({ keyShapeInvalidated: true, keyOriginIndex: i });
        }
        else {
            desc.keyDescriptorList.push({
                keyOriginType: (_a = item.keyOriginType) !== null && _a !== void 0 ? _a : 4,
                keyOriginResolution: (_b = item.keyOriginResolution) !== null && _b !== void 0 ? _b : 72,
            });
            var out = desc.keyDescriptorList[desc.keyDescriptorList.length - 1];
            var radii = item.keyOriginRRectRadii;
            if (radii) {
                out.keyOriginRRectRadii = {
                    unitValueQuadVersion: 1,
                    topRight: unitsValue(radii.topRight, 'topRight'),
                    topLeft: unitsValue(radii.topLeft, 'topLeft'),
                    bottomLeft: unitsValue(radii.bottomLeft, 'bottomLeft'),
                    bottomRight: unitsValue(radii.bottomRight, 'bottomRight'),
                };
            }
            var box = item.keyOriginShapeBoundingBox;
            if (box) {
                out.keyOriginShapeBBox = {
                    unitValueQuadVersion: 1,
                    'Top ': unitsValue(box.top, 'top'),
                    Left: unitsValue(box.left, 'left'),
                    Btom: unitsValue(box.bottom, 'bottom'),
                    Rght: unitsValue(box.right, 'right'),
                };
            }
            var corners = item.keyOriginBoxCorners;
            if (corners && corners.length === 4) {
                out.keyOriginBoxCorners = {
                    rectangleCornerA: { Hrzn: corners[0].x, Vrtc: corners[0].y },
                    rectangleCornerB: { Hrzn: corners[1].x, Vrtc: corners[1].y },
                    rectangleCornerC: { Hrzn: corners[2].x, Vrtc: corners[2].y },
                    rectangleCornerD: { Hrzn: corners[3].x, Vrtc: corners[3].y },
                };
            }
            var transform = item.transform;
            if (transform && transform.length === 6) {
                out.Trnf = {
                    xx: transform[0],
                    xy: transform[1],
                    yx: transform[2],
                    yy: transform[3],
                    tx: transform[4],
                    ty: transform[5],
                };
            }
            out.keyOriginIndex = i;
        }
    }
    writeInt32(writer, 1); // version
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('lmfx', function (target) { return target.effects !== undefined && hasMultiEffects(target.effects); }, function (reader, target, left, _, options) {
    var version = readUint32(reader);
    if (version !== 0)
        throw new Error('Invalid lmfx version');
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(info, false, 99, true));
    // discard if read in 'lrFX' or 'lfx2' section
    target.effects = parseEffects(desc, !!options.logMissingFeatures);
    skipBytes(reader, left());
}, function (writer, target, _, options) {
    var desc = serializeEffects(target.effects, !!options.logMissingFeatures, true);
    writeUint32(writer, 0); // version
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('lrFX', hasKey('effects'), function (reader, target, left) {
    if (!target.effects)
        target.effects = readEffects(reader);
    skipBytes(reader, left());
}, function (writer, target) {
    writeEffects(writer, target.effects);
});
addHandler('luni', hasKey('name'), function (reader, target, left) {
    target.name = readUnicodeString(reader);
    skipBytes(reader, left());
}, function (writer, target) {
    writeUnicodeString(writer, target.name);
    // writeUint16(writer, 0); // padding (but not extending string length)
});
addHandler('lnsr', hasKey('nameSource'), function (reader, target) { return target.nameSource = readSignature(reader); }, function (writer, target) { return writeSignature(writer, target.nameSource); });
addHandler('lyid', hasKey('id'), function (reader, target) { return target.id = readUint32(reader); }, function (writer, target, _psd, options) {
    var id = target.id;
    while (options.layerIds.indexOf(id) !== -1)
        id += 100; // make sure we don't have duplicate layer ids
    writeUint32(writer, id);
    options.layerIds.push(id);
});
addHandler('lsct', hasKey('sectionDivider'), function (reader, target, left) {
    target.sectionDivider = { type: readUint32(reader) };
    if (left()) {
        checkSignature(reader, '8BIM');
        target.sectionDivider.key = readSignature(reader);
    }
    if (left()) {
        // 0 = normal
        // 1 = scene group, affects the animation timeline.
        target.sectionDivider.subType = readUint32(reader);
    }
}, function (writer, target) {
    writeUint32(writer, target.sectionDivider.type);
    if (target.sectionDivider.key) {
        writeSignature(writer, '8BIM');
        writeSignature(writer, target.sectionDivider.key);
        if (target.sectionDivider.subType !== undefined) {
            writeUint32(writer, target.sectionDivider.subType);
        }
    }
});
// it seems lsdk is used when there's a layer is nested more than 6 levels, but I don't know why?
// maybe some limitation of old version of PS?
addHandlerAlias('lsdk', 'lsct');
addHandler('clbl', hasKey('blendClippendElements'), function (reader, target) {
    target.blendClippendElements = !!readUint8(reader);
    skipBytes(reader, 3);
}, function (writer, target) {
    writeUint8(writer, target.blendClippendElements ? 1 : 0);
    writeZeros(writer, 3);
});
addHandler('infx', hasKey('blendInteriorElements'), function (reader, target) {
    target.blendInteriorElements = !!readUint8(reader);
    skipBytes(reader, 3);
}, function (writer, target) {
    writeUint8(writer, target.blendInteriorElements ? 1 : 0);
    writeZeros(writer, 3);
});
addHandler('knko', hasKey('knockout'), function (reader, target) {
    target.knockout = !!readUint8(reader);
    skipBytes(reader, 3);
}, function (writer, target) {
    writeUint8(writer, target.knockout ? 1 : 0);
    writeZeros(writer, 3);
});
addHandler('lspf', hasKey('protected'), function (reader, target) {
    var flags = readUint32(reader);
    target.protected = {
        transparency: (flags & 0x01) !== 0,
        composite: (flags & 0x02) !== 0,
        position: (flags & 0x04) !== 0,
    };
    if (flags & 0x08)
        target.protected.artboards = true;
}, function (writer, target) {
    var flags = (target.protected.transparency ? 0x01 : 0) |
        (target.protected.composite ? 0x02 : 0) |
        (target.protected.position ? 0x04 : 0) |
        (target.protected.artboards ? 0x08 : 0);
    writeUint32(writer, flags);
});
addHandler('lclr', hasKey('layerColor'), function (reader, target) {
    var color = readUint16(reader);
    skipBytes(reader, 6);
    target.layerColor = layerColors[color];
}, function (writer, target) {
    var index = layerColors.indexOf(target.layerColor);
    writeUint16(writer, index === -1 ? 0 : index);
    writeZeros(writer, 6);
});
addHandler('shmd', hasKey('timestamp'), function (reader, target, left, _, options) {
    var count = readUint32(reader);
    var _loop_1 = function (i) {
        checkSignature(reader, '8BIM');
        var key = readSignature(reader);
        readUint8(reader); // copy
        skipBytes(reader, 3);
        readSection(reader, 1, function (left) {
            if (key === 'cust') {
                var desc = readVersionAndDescriptor(reader);
                if (desc.layerTime !== undefined)
                    target.timestamp = desc.layerTime;
            }
            else if (key === 'mlst') {
                var desc = readVersionAndDescriptor(reader);
                options.logDevFeatures && console.log('mlst', desc);
                // options.logDevFeatures && console.log('mlst', require('util').inspect(desc, false, 99, true));
            }
            else if (key === 'mdyn') {
                // frame flags
                var unknown = readUint16(reader);
                var propagate = readUint8(reader);
                var flags = readUint8(reader);
                var unifyLayerPosition = (flags & 1) !== 0;
                var unifyLayerStyle = (flags & 2) !== 0;
                var unifyLayerVisibility = (flags & 4) !== 0;
                options.logDevFeatures && console.log('mdyn', 'unknown:', unknown, 'propagate:', propagate, 'flags:', flags, { unifyLayerPosition: unifyLayerPosition, unifyLayerStyle: unifyLayerStyle, unifyLayerVisibility: unifyLayerVisibility });
                // const desc = readVersionAndDescriptor(reader) as FrameListDescriptor;
                // console.log('mdyn', require('util').inspect(desc, false, 99, true));
            }
            else {
                options.logDevFeatures && console.log('Unhandled metadata', key);
            }
            skipBytes(reader, left());
        });
    };
    for (var i = 0; i < count; i++) {
        _loop_1(i);
    }
    skipBytes(reader, left());
}, function (writer, target) {
    var desc = {
        layerTime: target.timestamp,
    };
    writeUint32(writer, 1); // count
    writeSignature(writer, '8BIM');
    writeSignature(writer, 'cust');
    writeUint8(writer, 0); // copy (always false)
    writeZeros(writer, 3);
    writeSection(writer, 2, function () { return writeVersionAndDescriptor(writer, '', 'metadata', desc); }, true);
});
addHandler('vstk', hasKey('vectorStroke'), function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.vectorStroke = {
        strokeEnabled: desc.strokeEnabled,
        fillEnabled: desc.fillEnabled,
        lineWidth: parseUnits(desc.strokeStyleLineWidth),
        lineDashOffset: parseUnits(desc.strokeStyleLineDashOffset),
        miterLimit: desc.strokeStyleMiterLimit,
        lineCapType: strokeStyleLineCapType.decode(desc.strokeStyleLineCapType),
        lineJoinType: strokeStyleLineJoinType.decode(desc.strokeStyleLineJoinType),
        lineAlignment: strokeStyleLineAlignment.decode(desc.strokeStyleLineAlignment),
        scaleLock: desc.strokeStyleScaleLock,
        strokeAdjust: desc.strokeStyleStrokeAdjust,
        lineDashSet: desc.strokeStyleLineDashSet.map(parseUnits),
        blendMode: BlnM.decode(desc.strokeStyleBlendMode),
        opacity: parsePercent(desc.strokeStyleOpacity),
        content: parseVectorContent(desc.strokeStyleContent),
        resolution: desc.strokeStyleResolution,
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var _a, _b, _c;
    var stroke = target.vectorStroke;
    var descriptor = {
        strokeStyleVersion: 2,
        strokeEnabled: !!stroke.strokeEnabled,
        fillEnabled: !!stroke.fillEnabled,
        strokeStyleLineWidth: stroke.lineWidth || { value: 3, units: 'Points' },
        strokeStyleLineDashOffset: stroke.lineDashOffset || { value: 0, units: 'Points' },
        strokeStyleMiterLimit: (_a = stroke.miterLimit) !== null && _a !== void 0 ? _a : 100,
        strokeStyleLineCapType: strokeStyleLineCapType.encode(stroke.lineCapType),
        strokeStyleLineJoinType: strokeStyleLineJoinType.encode(stroke.lineJoinType),
        strokeStyleLineAlignment: strokeStyleLineAlignment.encode(stroke.lineAlignment),
        strokeStyleScaleLock: !!stroke.scaleLock,
        strokeStyleStrokeAdjust: !!stroke.strokeAdjust,
        strokeStyleLineDashSet: stroke.lineDashSet || [],
        strokeStyleBlendMode: BlnM.encode(stroke.blendMode),
        strokeStyleOpacity: unitsPercent((_b = stroke.opacity) !== null && _b !== void 0 ? _b : 1),
        strokeStyleContent: serializeVectorContent(stroke.content || { type: 'color', color: { r: 0, g: 0, b: 0 } }).descriptor,
        strokeStyleResolution: (_c = stroke.resolution) !== null && _c !== void 0 ? _c : 72,
    };
    writeVersionAndDescriptor(writer, '', 'strokeStyle', descriptor);
});
addHandler('artb', // per-layer arboard info
hasKey('artboard'), function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    var rect = desc.artboardRect;
    target.artboard = {
        rect: { top: rect['Top '], left: rect.Left, bottom: rect.Btom, right: rect.Rght },
        guideIndices: desc.guideIndeces,
        presetName: desc.artboardPresetName,
        color: parseColor(desc['Clr ']),
        backgroundType: desc.artboardBackgroundType,
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var artboard = target.artboard;
    var rect = artboard.rect;
    var desc = {
        artboardRect: { 'Top ': rect.top, Left: rect.left, Btom: rect.bottom, Rght: rect.right },
        guideIndeces: artboard.guideIndices || [],
        artboardPresetName: artboard.presetName || '',
        'Clr ': serializeColor(artboard.color),
        artboardBackgroundType: (_a = artboard.backgroundType) !== null && _a !== void 0 ? _a : 1,
    };
    writeVersionAndDescriptor(writer, '', 'artboard', desc);
});
addHandler('sn2P', hasKey('usingAlignedRendering'), function (reader, target) { return target.usingAlignedRendering = !!readUint32(reader); }, function (writer, target) { return writeUint32(writer, target.usingAlignedRendering ? 1 : 0); });
var placedLayerTypes = ['unknown', 'vector', 'raster', 'image stack'];
function parseWarp(warp) {
    var _a, _b, _c, _d, _e, _f;
    var result = {
        style: warpStyle.decode(warp.warpStyle),
        value: warp.warpValue || 0,
        perspective: warp.warpPerspective || 0,
        perspectiveOther: warp.warpPerspectiveOther || 0,
        rotate: Ornt.decode(warp.warpRotate),
        bounds: warp.bounds && {
            top: parseUnitsOrNumber(warp.bounds['Top ']),
            left: parseUnitsOrNumber(warp.bounds.Left),
            bottom: parseUnitsOrNumber(warp.bounds.Btom),
            right: parseUnitsOrNumber(warp.bounds.Rght),
        },
        uOrder: warp.uOrder,
        vOrder: warp.vOrder,
    };
    if (warp.deformNumRows != null || warp.deformNumCols != null) {
        result.deformNumRows = warp.deformNumRows;
        result.deformNumCols = warp.deformNumCols;
    }
    var envelopeWarp = warp.customEnvelopeWarp;
    if (envelopeWarp) {
        result.customEnvelopeWarp = {
            meshPoints: [],
        };
        var xs = ((_a = envelopeWarp.meshPoints.find(function (i) { return i.type === 'Hrzn'; })) === null || _a === void 0 ? void 0 : _a.values) || [];
        var ys = ((_b = envelopeWarp.meshPoints.find(function (i) { return i.type === 'Vrtc'; })) === null || _b === void 0 ? void 0 : _b.values) || [];
        for (var i = 0; i < xs.length; i++) {
            result.customEnvelopeWarp.meshPoints.push({ x: xs[i], y: ys[i] });
        }
        if (envelopeWarp.quiltSliceX || envelopeWarp.quiltSliceY) {
            result.customEnvelopeWarp.quiltSliceX = ((_d = (_c = envelopeWarp.quiltSliceX) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.values) || [];
            result.customEnvelopeWarp.quiltSliceY = ((_f = (_e = envelopeWarp.quiltSliceY) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.values) || [];
        }
    }
    return result;
}
function isQuiltWarp(warp) {
    var _a, _b;
    return warp.deformNumCols != null || warp.deformNumRows != null ||
        ((_a = warp.customEnvelopeWarp) === null || _a === void 0 ? void 0 : _a.quiltSliceX) || ((_b = warp.customEnvelopeWarp) === null || _b === void 0 ? void 0 : _b.quiltSliceY);
}
function encodeWarp(warp) {
    var bounds = warp.bounds;
    var desc = {
        warpStyle: warpStyle.encode(warp.style),
        warpValue: warp.value || 0,
        warpPerspective: warp.perspective || 0,
        warpPerspectiveOther: warp.perspectiveOther || 0,
        warpRotate: Ornt.encode(warp.rotate),
        bounds: {
            'Top ': unitsValue(bounds && bounds.top || { units: 'Pixels', value: 0 }, 'bounds.top'),
            Left: unitsValue(bounds && bounds.left || { units: 'Pixels', value: 0 }, 'bounds.left'),
            Btom: unitsValue(bounds && bounds.bottom || { units: 'Pixels', value: 0 }, 'bounds.bottom'),
            Rght: unitsValue(bounds && bounds.right || { units: 'Pixels', value: 0 }, 'bounds.right'),
        },
        uOrder: warp.uOrder || 0,
        vOrder: warp.vOrder || 0,
    };
    var isQuilt = isQuiltWarp(warp);
    if (isQuilt) {
        var desc2 = desc;
        desc2.deformNumRows = warp.deformNumRows || 0;
        desc2.deformNumCols = warp.deformNumCols || 0;
    }
    var customEnvelopeWarp = warp.customEnvelopeWarp;
    if (customEnvelopeWarp) {
        var meshPoints = customEnvelopeWarp.meshPoints || [];
        if (isQuilt) {
            var desc2 = desc;
            desc2.customEnvelopeWarp = {
                quiltSliceX: [{
                        type: 'quiltSliceX',
                        values: customEnvelopeWarp.quiltSliceX || [],
                    }],
                quiltSliceY: [{
                        type: 'quiltSliceY',
                        values: customEnvelopeWarp.quiltSliceY || [],
                    }],
                meshPoints: [
                    { type: 'Hrzn', values: meshPoints.map(function (p) { return p.x; }) },
                    { type: 'Vrtc', values: meshPoints.map(function (p) { return p.y; }) },
                ],
            };
        }
        else {
            desc.customEnvelopeWarp = {
                meshPoints: [
                    { type: 'Hrzn', values: meshPoints.map(function (p) { return p.x; }) },
                    { type: 'Vrtc', values: meshPoints.map(function (p) { return p.y; }) },
                ],
            };
        }
    }
    return desc;
}
addHandler('PlLd', hasKey('placedLayer'), function (reader, target, left) {
    if (readSignature(reader) !== 'plcL')
        throw new Error("Invalid PlLd signature");
    if (readInt32(reader) !== 3)
        throw new Error("Invalid PlLd version");
    var id = readPascalString(reader, 1);
    readInt32(reader); // pageNumber
    readInt32(reader); // totalPages, TODO: check how this works ?
    readInt32(reader); // anitAliasPolicy 16
    var placedLayerType = readInt32(reader); // 0 = unknown, 1 = vector, 2 = raster, 3 = image stack
    if (!placedLayerTypes[placedLayerType])
        throw new Error('Invalid PlLd type');
    var transform = [];
    for (var i = 0; i < 8; i++)
        transform.push(readFloat64(reader)); // x, y of 4 corners of the transform
    var warpVersion = readInt32(reader);
    if (warpVersion !== 0)
        throw new Error("Invalid Warp version " + warpVersion);
    var warp = readVersionAndDescriptor(reader);
    target.placedLayer = target.placedLayer || {
        id: id,
        type: placedLayerTypes[placedLayerType],
        // pageNumber,
        // totalPages,
        transform: transform,
        warp: parseWarp(warp),
    };
    // console.log('PlLd warp', require('util').inspect(warp, false, 99, true));
    // console.log('PlLd', require('util').inspect(target.placedLayer, false, 99, true));
    skipBytes(reader, left());
}, function (writer, target) {
    var placed = target.placedLayer;
    writeSignature(writer, 'plcL');
    writeInt32(writer, 3); // version
    writePascalString(writer, placed.id, 1);
    writeInt32(writer, 1); // pageNumber
    writeInt32(writer, 1); // totalPages
    writeInt32(writer, 16); // anitAliasPolicy
    if (placedLayerTypes.indexOf(placed.type) === -1)
        throw new Error('Invalid placedLayer type');
    writeInt32(writer, placedLayerTypes.indexOf(placed.type));
    for (var i = 0; i < 8; i++)
        writeFloat64(writer, placed.transform[i]);
    writeInt32(writer, 0); // warp version
    var isQuilt = placed.warp && isQuiltWarp(placed.warp);
    var type = isQuilt ? 'quiltWarp' : 'warp';
    writeVersionAndDescriptor(writer, '', type, encodeWarp(placed.warp || {}), type);
});
addHandler('SoLd', hasKey('placedLayer'), function (reader, target, left) {
    if (readSignature(reader) !== 'soLD')
        throw new Error("Invalid SoLd type");
    if (readInt32(reader) !== 4)
        throw new Error("Invalid SoLd version");
    var desc = readVersionAndDescriptor(reader);
    // console.log('SoLd', require('util').inspect(desc, false, 99, true));
    // console.log('SoLd.warp', require('util').inspect(desc.warp, false, 99, true));
    // console.log('SoLd.quiltWarp', require('util').inspect(desc.quiltWarp, false, 99, true));
    target.placedLayer = {
        id: desc.Idnt,
        placed: desc.placed,
        type: placedLayerTypes[desc.Type],
        // pageNumber: info.PgNm,
        // totalPages: info.totalPages,
        // frameStep: info.frameStep,
        // duration: info.duration,
        // frameCount: info.frameCount,
        transform: desc.Trnf,
        width: desc['Sz  '].Wdth,
        height: desc['Sz  '].Hght,
        resolution: parseUnits(desc.Rslt),
        warp: parseWarp((desc.quiltWarp || desc.warp)),
    };
    if (desc.nonAffineTransform && desc.nonAffineTransform.some(function (x, i) { return x !== desc.Trnf[i]; })) {
        target.placedLayer.nonAffineTransform = desc.nonAffineTransform;
    }
    if (desc.Crop)
        target.placedLayer.crop = desc.Crop;
    if (desc.comp)
        target.placedLayer.comp = desc.comp;
    if (desc.compInfo)
        target.placedLayer.compInfo = desc.compInfo;
    skipBytes(reader, left()); // HACK
}, function (writer, target) {
    var _a, _b;
    writeSignature(writer, 'soLD');
    writeInt32(writer, 4); // version
    var placed = target.placedLayer;
    var desc = __assign(__assign({ Idnt: placed.id, placed: (_a = placed.placed) !== null && _a !== void 0 ? _a : placed.id, PgNm: 1, totalPages: 1 }, (placed.crop ? { Crop: placed.crop } : {})), { frameStep: {
            numerator: 0,
            denominator: 600
        }, duration: {
            numerator: 0,
            denominator: 600
        }, frameCount: 1, Annt: 16, Type: placedLayerTypes.indexOf(placed.type), Trnf: placed.transform, nonAffineTransform: (_b = placed.nonAffineTransform) !== null && _b !== void 0 ? _b : placed.transform, quiltWarp: {}, warp: encodeWarp(placed.warp || {}), 'Sz  ': {
            Wdth: placed.width || 0,
            Hght: placed.height || 0, // TODO: find size ?
        }, Rslt: placed.resolution ? unitsValue(placed.resolution, 'resolution') : { units: 'Density', value: 72 } });
    if (placed.warp && isQuiltWarp(placed.warp)) {
        var quiltWarp = encodeWarp(placed.warp);
        desc.quiltWarp = quiltWarp;
        desc.warp = {
            warpStyle: 'warpStyle.warpNone',
            warpValue: quiltWarp.warpValue,
            warpPerspective: quiltWarp.warpPerspective,
            warpPerspectiveOther: quiltWarp.warpPerspectiveOther,
            warpRotate: quiltWarp.warpRotate,
            bounds: quiltWarp.bounds,
            uOrder: quiltWarp.uOrder,
            vOrder: quiltWarp.vOrder,
        };
    }
    else {
        delete desc.quiltWarp;
    }
    if (placed.comp)
        desc.comp = placed.comp;
    if (placed.compInfo)
        desc.compInfo = placed.compInfo;
    writeVersionAndDescriptor(writer, '', 'null', desc, desc.quiltWarp ? 'quiltWarp' : 'warp');
});
addHandler('fxrp', hasKey('referencePoint'), function (reader, target) {
    target.referencePoint = {
        x: readFloat64(reader),
        y: readFloat64(reader),
    };
}, function (writer, target) {
    writeFloat64(writer, target.referencePoint.x);
    writeFloat64(writer, target.referencePoint.y);
});
if (MOCK_HANDLERS) {
    addHandler('Patt', function (target) { return target._Patt !== undefined; }, function (reader, target, left) {
        // console.log('additional info: Patt');
        target._Patt = readBytes(reader, left());
    }, function (writer, target) { return false && writeBytes(writer, target._Patt); });
}
else {
    addHandler('Patt', // TODO: handle also Pat2 & Pat3
    function (// TODO: handle also Pat2 & Pat3
    target) { return !target; }, function (reader, target, left) {
        if (!left())
            return;
        skipBytes(reader, left());
        return; // not supported yet
        target;
        readPattern;
        // if (!target.patterns) target.patterns = [];
        // target.patterns.push(readPattern(reader));
        // skipBytes(reader, left());
    }, function (_writer, _target) {
    });
}
function readRect(reader) {
    var top = readInt32(reader);
    var left = readInt32(reader);
    var bottom = readInt32(reader);
    var right = readInt32(reader);
    return { top: top, left: left, bottom: bottom, right: right };
}
function writeRect(writer, rect) {
    writeInt32(writer, rect.top);
    writeInt32(writer, rect.left);
    writeInt32(writer, rect.bottom);
    writeInt32(writer, rect.right);
}
addHandler('Anno', function (target) { return target.annotations !== undefined; }, function (reader, target, left) {
    var major = readUint16(reader);
    var minor = readUint16(reader);
    if (major !== 2 || minor !== 1)
        throw new Error('Invalid Anno version');
    var count = readUint32(reader);
    var annotations = [];
    for (var i = 0; i < count; i++) {
        /*const length =*/ readUint32(reader);
        var type = readSignature(reader);
        var open_1 = !!readUint8(reader);
        /*const flags =*/ readUint8(reader); // always 28
        /*const optionalBlocks =*/ readUint16(reader);
        var iconLocation = readRect(reader);
        var popupLocation = readRect(reader);
        var color = readColor(reader);
        var author = readPascalString(reader, 2);
        var name_1 = readPascalString(reader, 2);
        var date = readPascalString(reader, 2);
        /*const contentLength =*/ readUint32(reader);
        /*const dataType =*/ readSignature(reader);
        var dataLength = readUint32(reader);
        var data = void 0;
        if (type === 'txtA') {
            if (dataLength >= 2 && readUint16(reader) === 0xfeff) {
                data = readUnicodeStringWithLength(reader, (dataLength - 2) / 2);
            }
            else {
                reader.offset -= 2;
                data = readAsciiString(reader, dataLength);
            }
            data = data.replace(/\r/g, '\n');
        }
        else if (type === 'sndA') {
            data = readBytes(reader, dataLength);
        }
        else {
            throw new Error('Unknown annotation type');
        }
        annotations.push({
            type: type === 'txtA' ? 'text' : 'sound',
            open: open_1, iconLocation: iconLocation, popupLocation: popupLocation, color: color, author: author, name: name_1, date: date, data: data,
        });
    }
    target.annotations = annotations;
    skipBytes(reader, left());
}, function (writer, target) {
    var annotations = target.annotations;
    writeUint16(writer, 2);
    writeUint16(writer, 1);
    writeUint32(writer, annotations.length);
    for (var _i = 0, annotations_1 = annotations; _i < annotations_1.length; _i++) {
        var annotation = annotations_1[_i];
        var sound = annotation.type === 'sound';
        if (sound && !(annotation.data instanceof Uint8Array))
            throw new Error('Sound annotation data should be Uint8Array');
        if (!sound && typeof annotation.data !== 'string')
            throw new Error('Text annotation data should be string');
        var lengthOffset = writer.offset;
        writeUint32(writer, 0); // length
        writeSignature(writer, sound ? 'sndA' : 'txtA');
        writeUint8(writer, annotation.open ? 1 : 0);
        writeUint8(writer, 28);
        writeUint16(writer, 1);
        writeRect(writer, annotation.iconLocation);
        writeRect(writer, annotation.popupLocation);
        writeColor(writer, annotation.color);
        writePascalString(writer, annotation.author || '', 2);
        writePascalString(writer, annotation.name || '', 2);
        writePascalString(writer, annotation.date || '', 2);
        var contentOffset = writer.offset;
        writeUint32(writer, 0); // content length
        writeSignature(writer, sound ? 'sndM' : 'txtC');
        writeUint32(writer, 0); // data length
        var dataOffset = writer.offset;
        if (sound) {
            writeBytes(writer, annotation.data);
        }
        else {
            writeUint16(writer, 0xfeff); // unicode string indicator
            var text = annotation.data.replace(/\n/g, '\r');
            for (var i = 0; i < text.length; i++)
                writeUint16(writer, text.charCodeAt(i));
        }
        writer.view.setUint32(lengthOffset, writer.offset - lengthOffset, false);
        writer.view.setUint32(contentOffset, writer.offset - contentOffset, false);
        writer.view.setUint32(dataOffset - 4, writer.offset - dataOffset, false);
    }
});
addHandler('lnk2', function (target) { return !!target.linkedFiles && target.linkedFiles.length > 0; }, function (reader, target, left, _, options) {
    var psd = target;
    psd.linkedFiles = [];
    while (left() > 8) {
        var size = readLength64(reader); // size
        var startOffset = reader.offset;
        var type = readSignature(reader);
        var version = readInt32(reader);
        var id = readPascalString(reader, 1);
        var name_2 = readUnicodeString(reader);
        var fileType = readSignature(reader).trim(); // '    ' if empty
        var fileCreator = readSignature(reader).trim(); // '    ' or '\0\0\0\0' if empty
        var dataSize = readLength64(reader);
        var hasFileOpenDescriptor = readUint8(reader);
        var fileOpenDescriptor = hasFileOpenDescriptor ? readVersionAndDescriptor(reader) : undefined;
        var linkedFileDescriptor = type === 'liFE' ? readVersionAndDescriptor(reader) : undefined;
        var file = { id: id, name: name_2, data: undefined };
        if (fileType)
            file.type = fileType;
        if (fileCreator)
            file.creator = fileCreator;
        if (fileOpenDescriptor)
            file.descriptor = fileOpenDescriptor;
        if (type === 'liFE' && version > 3) {
            var year = readInt32(reader);
            var month = readUint8(reader);
            var day = readUint8(reader);
            var hour = readUint8(reader);
            var minute = readUint8(reader);
            var seconds = readFloat64(reader);
            var wholeSeconds = Math.floor(seconds);
            var ms = (seconds - wholeSeconds) * 1000;
            file.time = new Date(year, month, day, hour, minute, wholeSeconds, ms);
        }
        var fileSize = type === 'liFE' ? readLength64(reader) : 0;
        if (type === 'liFA')
            skipBytes(reader, 8);
        if (type === 'liFD')
            file.data = readBytes(reader, dataSize);
        if (version >= 5)
            file.childDocumentID = readUnicodeString(reader);
        if (version >= 6)
            file.assetModTime = readFloat64(reader);
        if (version >= 7)
            file.assetLockedState = readUint8(reader);
        if (type === 'liFE')
            file.data = readBytes(reader, fileSize);
        if (options.skipLinkedFilesData)
            file.data = undefined;
        psd.linkedFiles.push(file);
        linkedFileDescriptor;
        while (size % 4)
            size++;
        reader.offset = startOffset + size;
    }
    skipBytes(reader, left()); // ?
}, function (writer, target) {
    var psd = target;
    for (var _i = 0, _a = psd.linkedFiles; _i < _a.length; _i++) {
        var file = _a[_i];
        var version = 2;
        if (file.assetLockedState != null)
            version = 7;
        else if (file.assetModTime != null)
            version = 6;
        else if (file.childDocumentID != null)
            version = 5;
        // TODO: else if (file.time != null) version = 3; (only for liFE)
        writeUint32(writer, 0);
        writeUint32(writer, 0); // size
        var sizeOffset = writer.offset;
        writeSignature(writer, file.data ? 'liFD' : 'liFA');
        writeInt32(writer, version);
        writePascalString(writer, file.id || '', 1);
        writeUnicodeStringWithPadding(writer, file.name || '');
        writeSignature(writer, file.type ? (file.type + "    ").substr(0, 4) : '    ');
        writeSignature(writer, file.creator ? (file.creator + "    ").substr(0, 4) : '\0\0\0\0');
        writeLength64(writer, file.data ? file.data.byteLength : 0);
        if (file.descriptor && file.descriptor.compInfo) {
            var desc = {
                compInfo: file.descriptor.compInfo,
            };
            writeUint8(writer, 1);
            writeVersionAndDescriptor(writer, '', 'null', desc);
        }
        else {
            writeUint8(writer, 0);
        }
        if (file.data)
            writeBytes(writer, file.data);
        else
            writeLength64(writer, 0);
        if (version >= 5)
            writeUnicodeStringWithPadding(writer, file.childDocumentID || '');
        if (version >= 6)
            writeFloat64(writer, file.assetModTime || 0);
        if (version >= 7)
            writeUint8(writer, file.assetLockedState || 0);
        var size = writer.offset - sizeOffset;
        writer.view.setUint32(sizeOffset - 4, size, false); // write size
        while (size % 4) {
            size++;
            writeUint8(writer, 0);
        }
    }
});
addHandlerAlias('lnkD', 'lnk2');
addHandlerAlias('lnk3', 'lnk2');
// this seems to just be zero size block, ignore it
addHandler('lnkE', function (target) { return target._lnkE !== undefined; }, function (reader, target, left, _psds, options) {
    if (options.logMissingFeatures && left()) {
        console.log("Non-empty lnkE layer info (" + left() + " bytes)");
    }
    if (MOCK_HANDLERS) {
        target._lnkE = readBytes(reader, left());
    }
}, function (writer, target) { return MOCK_HANDLERS && writeBytes(writer, target._lnkE); });
addHandler('pths', hasKey('pathList'), function (reader, target) {
    var descriptor = readVersionAndDescriptor(reader);
    target.pathList = []; // TODO: read paths (find example with non-empty list)
    descriptor;
    // console.log('pths', descriptor); // TODO: remove this
}, function (writer, _target) {
    var descriptor = {
        pathList: [], // TODO: write paths
    };
    writeVersionAndDescriptor(writer, '', 'pathsDataClass', descriptor);
});
addHandler('lyvr', hasKey('version'), function (reader, target) { return target.version = readUint32(reader); }, function (writer, target) { return writeUint32(writer, target.version); });
function adjustmentType(type) {
    return function (target) { return !!target.adjustment && target.adjustment.type === type; };
}
addHandler('brit', adjustmentType('brightness/contrast'), function (reader, target, left) {
    if (!target.adjustment) { // ignore if got one from CgEd block
        target.adjustment = {
            type: 'brightness/contrast',
            brightness: readInt16(reader),
            contrast: readInt16(reader),
            meanValue: readInt16(reader),
            labColorOnly: !!readUint8(reader),
            useLegacy: true,
        };
    }
    skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    writeInt16(writer, info.brightness || 0);
    writeInt16(writer, info.contrast || 0);
    writeInt16(writer, (_a = info.meanValue) !== null && _a !== void 0 ? _a : 127);
    writeUint8(writer, info.labColorOnly ? 1 : 0);
    writeZeros(writer, 1);
});
function readLevelsChannel(reader) {
    var shadowInput = readInt16(reader);
    var highlightInput = readInt16(reader);
    var shadowOutput = readInt16(reader);
    var highlightOutput = readInt16(reader);
    var midtoneInput = readInt16(reader) / 100;
    return { shadowInput: shadowInput, highlightInput: highlightInput, shadowOutput: shadowOutput, highlightOutput: highlightOutput, midtoneInput: midtoneInput };
}
function writeLevelsChannel(writer, channel) {
    writeInt16(writer, channel.shadowInput);
    writeInt16(writer, channel.highlightInput);
    writeInt16(writer, channel.shadowOutput);
    writeInt16(writer, channel.highlightOutput);
    writeInt16(writer, Math.round(channel.midtoneInput * 100));
}
addHandler('levl', adjustmentType('levels'), function (reader, target, left) {
    if (readUint16(reader) !== 2)
        throw new Error('Invalid levl version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'levels', rgb: readLevelsChannel(reader), red: readLevelsChannel(reader), green: readLevelsChannel(reader), blue: readLevelsChannel(reader) });
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var defaultChannel = {
        shadowInput: 0,
        highlightInput: 255,
        shadowOutput: 0,
        highlightOutput: 255,
        midtoneInput: 1,
    };
    writeUint16(writer, 2); // version
    writeLevelsChannel(writer, info.rgb || defaultChannel);
    writeLevelsChannel(writer, info.red || defaultChannel);
    writeLevelsChannel(writer, info.blue || defaultChannel);
    writeLevelsChannel(writer, info.green || defaultChannel);
    for (var i = 0; i < 59; i++)
        writeLevelsChannel(writer, defaultChannel);
});
function readCurveChannel(reader) {
    var nodes = readUint16(reader);
    var channel = [];
    for (var j = 0; j < nodes; j++) {
        var output = readInt16(reader);
        var input = readInt16(reader);
        channel.push({ input: input, output: output });
    }
    return channel;
}
function writeCurveChannel(writer, channel) {
    writeUint16(writer, channel.length);
    for (var _i = 0, channel_1 = channel; _i < channel_1.length; _i++) {
        var n = channel_1[_i];
        writeUint16(writer, n.output);
        writeUint16(writer, n.input);
    }
}
addHandler('curv', adjustmentType('curves'), function (reader, target, left) {
    readUint8(reader);
    if (readUint16(reader) !== 1)
        throw new Error('Invalid curv version');
    readUint16(reader);
    var channels = readUint16(reader);
    var info = { type: 'curves' };
    if (channels & 1)
        info.rgb = readCurveChannel(reader);
    if (channels & 2)
        info.red = readCurveChannel(reader);
    if (channels & 4)
        info.green = readCurveChannel(reader);
    if (channels & 8)
        info.blue = readCurveChannel(reader);
    target.adjustment = __assign(__assign({}, target.adjustment), info);
    // ignoring, duplicate information
    // checkSignature(reader, 'Crv ');
    // const cVersion = readUint16(reader);
    // readUint16(reader);
    // const channelCount = readUint16(reader);
    // for (let i = 0; i < channelCount; i++) {
    // 	const index = readUint16(reader);
    // 	const nodes = readUint16(reader);
    // 	for (let j = 0; j < nodes; j++) {
    // 		const output = readInt16(reader);
    // 		const input = readInt16(reader);
    // 	}
    // }
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var rgb = info.rgb, red = info.red, green = info.green, blue = info.blue;
    var channels = 0;
    var channelCount = 0;
    if (rgb && rgb.length) {
        channels |= 1;
        channelCount++;
    }
    if (red && red.length) {
        channels |= 2;
        channelCount++;
    }
    if (green && green.length) {
        channels |= 4;
        channelCount++;
    }
    if (blue && blue.length) {
        channels |= 8;
        channelCount++;
    }
    writeUint8(writer, 0);
    writeUint16(writer, 1); // version
    writeUint16(writer, 0);
    writeUint16(writer, channels);
    if (rgb && rgb.length)
        writeCurveChannel(writer, rgb);
    if (red && red.length)
        writeCurveChannel(writer, red);
    if (green && green.length)
        writeCurveChannel(writer, green);
    if (blue && blue.length)
        writeCurveChannel(writer, blue);
    writeSignature(writer, 'Crv ');
    writeUint16(writer, 4); // version
    writeUint16(writer, 0);
    writeUint16(writer, channelCount);
    if (rgb && rgb.length) {
        writeUint16(writer, 0);
        writeCurveChannel(writer, rgb);
    }
    if (red && red.length) {
        writeUint16(writer, 1);
        writeCurveChannel(writer, red);
    }
    if (green && green.length) {
        writeUint16(writer, 2);
        writeCurveChannel(writer, green);
    }
    if (blue && blue.length) {
        writeUint16(writer, 3);
        writeCurveChannel(writer, blue);
    }
    writeZeros(writer, 2);
});
addHandler('expA', adjustmentType('exposure'), function (reader, target, left) {
    if (readUint16(reader) !== 1)
        throw new Error('Invalid expA version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'exposure', exposure: readFloat32(reader), offset: readFloat32(reader), gamma: readFloat32(reader) });
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeUint16(writer, 1); // version
    writeFloat32(writer, info.exposure);
    writeFloat32(writer, info.offset);
    writeFloat32(writer, info.gamma);
    writeZeros(writer, 2);
});
addHandler('vibA', adjustmentType('vibrance'), function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    target.adjustment = { type: 'vibrance' };
    if (desc.vibrance !== undefined)
        target.adjustment.vibrance = desc.vibrance;
    if (desc.Strt !== undefined)
        target.adjustment.saturation = desc.Strt;
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var desc = {};
    if (info.vibrance !== undefined)
        desc.vibrance = info.vibrance;
    if (info.saturation !== undefined)
        desc.Strt = info.saturation;
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
function readHueChannel(reader) {
    return {
        a: readInt16(reader),
        b: readInt16(reader),
        c: readInt16(reader),
        d: readInt16(reader),
        hue: readInt16(reader),
        saturation: readInt16(reader),
        lightness: readInt16(reader),
    };
}
function writeHueChannel(writer, channel) {
    var c = channel || {};
    writeInt16(writer, c.a || 0);
    writeInt16(writer, c.b || 0);
    writeInt16(writer, c.c || 0);
    writeInt16(writer, c.d || 0);
    writeInt16(writer, c.hue || 0);
    writeInt16(writer, c.saturation || 0);
    writeInt16(writer, c.lightness || 0);
}
addHandler('hue2', adjustmentType('hue/saturation'), function (reader, target, left) {
    if (readUint16(reader) !== 2)
        throw new Error('Invalid hue2 version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'hue/saturation', master: readHueChannel(reader), reds: readHueChannel(reader), yellows: readHueChannel(reader), greens: readHueChannel(reader), cyans: readHueChannel(reader), blues: readHueChannel(reader), magentas: readHueChannel(reader) });
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeUint16(writer, 2); // version
    writeHueChannel(writer, info.master);
    writeHueChannel(writer, info.reds);
    writeHueChannel(writer, info.yellows);
    writeHueChannel(writer, info.greens);
    writeHueChannel(writer, info.cyans);
    writeHueChannel(writer, info.blues);
    writeHueChannel(writer, info.magentas);
});
function readColorBalance(reader) {
    return {
        cyanRed: readInt16(reader),
        magentaGreen: readInt16(reader),
        yellowBlue: readInt16(reader),
    };
}
function writeColorBalance(writer, value) {
    writeInt16(writer, value.cyanRed || 0);
    writeInt16(writer, value.magentaGreen || 0);
    writeInt16(writer, value.yellowBlue || 0);
}
addHandler('blnc', adjustmentType('color balance'), function (reader, target, left) {
    target.adjustment = {
        type: 'color balance',
        shadows: readColorBalance(reader),
        midtones: readColorBalance(reader),
        highlights: readColorBalance(reader),
        preserveLuminosity: !!readUint8(reader),
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeColorBalance(writer, info.shadows || {});
    writeColorBalance(writer, info.midtones || {});
    writeColorBalance(writer, info.highlights || {});
    writeUint8(writer, info.preserveLuminosity ? 1 : 0);
    writeZeros(writer, 1);
});
addHandler('blwh', adjustmentType('black & white'), function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    target.adjustment = {
        type: 'black & white',
        reds: desc['Rd  '],
        yellows: desc.Yllw,
        greens: desc['Grn '],
        cyans: desc['Cyn '],
        blues: desc['Bl  '],
        magentas: desc.Mgnt,
        useTint: !!desc.useTint,
        presetKind: desc.bwPresetKind,
        presetFileName: desc.blackAndWhitePresetFileName,
    };
    if (desc.tintColor !== undefined)
        target.adjustment.tintColor = parseColor(desc.tintColor);
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var desc = {
        'Rd  ': info.reds || 0,
        Yllw: info.yellows || 0,
        'Grn ': info.greens || 0,
        'Cyn ': info.cyans || 0,
        'Bl  ': info.blues || 0,
        Mgnt: info.magentas || 0,
        useTint: !!info.useTint,
        tintColor: serializeColor(info.tintColor),
        bwPresetKind: info.presetKind || 0,
        blackAndWhitePresetFileName: info.presetFileName || '',
    };
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('phfl', adjustmentType('photo filter'), function (reader, target, left) {
    var version = readUint16(reader);
    if (version !== 2 && version !== 3)
        throw new Error('Invalid phfl version');
    var color;
    if (version === 2) {
        color = readColor(reader);
    }
    else { // version 3
        // TODO: test this, this is probably wrong
        color = {
            l: readInt32(reader) / 100,
            a: readInt32(reader) / 100,
            b: readInt32(reader) / 100,
        };
    }
    target.adjustment = {
        type: 'photo filter',
        color: color,
        density: readUint32(reader) / 100,
        preserveLuminosity: !!readUint8(reader),
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeUint16(writer, 2); // version
    writeColor(writer, info.color || { l: 0, a: 0, b: 0 });
    writeUint32(writer, (info.density || 0) * 100);
    writeUint8(writer, info.preserveLuminosity ? 1 : 0);
    writeZeros(writer, 3);
});
function readMixrChannel(reader) {
    var red = readInt16(reader);
    var green = readInt16(reader);
    var blue = readInt16(reader);
    skipBytes(reader, 2);
    var constant = readInt16(reader);
    return { red: red, green: green, blue: blue, constant: constant };
}
function writeMixrChannel(writer, channel) {
    var c = channel || {};
    writeInt16(writer, c.red);
    writeInt16(writer, c.green);
    writeInt16(writer, c.blue);
    writeZeros(writer, 2);
    writeInt16(writer, c.constant);
}
addHandler('mixr', adjustmentType('channel mixer'), function (reader, target, left) {
    if (readUint16(reader) !== 1)
        throw new Error('Invalid mixr version');
    var adjustment = target.adjustment = __assign(__assign({}, target.adjustment), { type: 'channel mixer', monochrome: !!readUint16(reader) });
    if (!adjustment.monochrome) {
        adjustment.red = readMixrChannel(reader);
        adjustment.green = readMixrChannel(reader);
        adjustment.blue = readMixrChannel(reader);
    }
    adjustment.gray = readMixrChannel(reader);
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeUint16(writer, 1); // version
    writeUint16(writer, info.monochrome ? 1 : 0);
    if (info.monochrome) {
        writeMixrChannel(writer, info.gray);
        writeZeros(writer, 3 * 5 * 2);
    }
    else {
        writeMixrChannel(writer, info.red);
        writeMixrChannel(writer, info.green);
        writeMixrChannel(writer, info.blue);
        writeMixrChannel(writer, info.gray);
    }
});
var colorLookupType = createEnum('colorLookupType', '3DLUT', {
    '3dlut': '3DLUT',
    abstractProfile: 'abstractProfile',
    deviceLinkProfile: 'deviceLinkProfile',
});
var LUTFormatType = createEnum('LUTFormatType', 'look', {
    look: 'LUTFormatLOOK',
    cube: 'LUTFormatCUBE',
    '3dl': 'LUTFormat3DL',
});
var colorLookupOrder = createEnum('colorLookupOrder', 'rgb', {
    rgb: 'rgbOrder',
    bgr: 'bgrOrder',
});
addHandler('clrL', adjustmentType('color lookup'), function (reader, target, left) {
    if (readUint16(reader) !== 1)
        throw new Error('Invalid clrL version');
    var desc = readVersionAndDescriptor(reader);
    target.adjustment = { type: 'color lookup' };
    var info = target.adjustment;
    if (desc.lookupType !== undefined)
        info.lookupType = colorLookupType.decode(desc.lookupType);
    if (desc['Nm  '] !== undefined)
        info.name = desc['Nm  '];
    if (desc.Dthr !== undefined)
        info.dither = desc.Dthr;
    if (desc.profile !== undefined)
        info.profile = desc.profile;
    if (desc.LUTFormat !== undefined)
        info.lutFormat = LUTFormatType.decode(desc.LUTFormat);
    if (desc.dataOrder !== undefined)
        info.dataOrder = colorLookupOrder.decode(desc.dataOrder);
    if (desc.tableOrder !== undefined)
        info.tableOrder = colorLookupOrder.decode(desc.tableOrder);
    if (desc.LUT3DFileData !== undefined)
        info.lut3DFileData = desc.LUT3DFileData;
    if (desc.LUT3DFileName !== undefined)
        info.lut3DFileName = desc.LUT3DFileName;
    skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var desc = {};
    if (info.lookupType !== undefined)
        desc.lookupType = colorLookupType.encode(info.lookupType);
    if (info.name !== undefined)
        desc['Nm  '] = info.name;
    if (info.dither !== undefined)
        desc.Dthr = info.dither;
    if (info.profile !== undefined)
        desc.profile = info.profile;
    if (info.lutFormat !== undefined)
        desc.LUTFormat = LUTFormatType.encode(info.lutFormat);
    if (info.dataOrder !== undefined)
        desc.dataOrder = colorLookupOrder.encode(info.dataOrder);
    if (info.tableOrder !== undefined)
        desc.tableOrder = colorLookupOrder.encode(info.tableOrder);
    if (info.lut3DFileData !== undefined)
        desc.LUT3DFileData = info.lut3DFileData;
    if (info.lut3DFileName !== undefined)
        desc.LUT3DFileName = info.lut3DFileName;
    writeUint16(writer, 1); // version
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('nvrt', adjustmentType('invert'), function (reader, target, left) {
    target.adjustment = { type: 'invert' };
    skipBytes(reader, left());
}, function () {
    // nothing to write here
});
addHandler('post', adjustmentType('posterize'), function (reader, target, left) {
    target.adjustment = {
        type: 'posterize',
        levels: readUint16(reader),
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    writeUint16(writer, (_a = info.levels) !== null && _a !== void 0 ? _a : 4);
    writeZeros(writer, 2);
});
addHandler('thrs', adjustmentType('threshold'), function (reader, target, left) {
    target.adjustment = {
        type: 'threshold',
        level: readUint16(reader),
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    writeUint16(writer, (_a = info.level) !== null && _a !== void 0 ? _a : 128);
    writeZeros(writer, 2);
});
var grdmColorModels = ['', '', '', 'rgb', 'hsb', '', 'lab'];
addHandler('grdm', adjustmentType('gradient map'), function (reader, target, left) {
    if (readUint16(reader) !== 1)
        throw new Error('Invalid grdm version');
    var info = {
        type: 'gradient map',
        gradientType: 'solid',
    };
    info.reverse = !!readUint8(reader);
    info.dither = !!readUint8(reader);
    info.name = readUnicodeString(reader);
    info.colorStops = [];
    info.opacityStops = [];
    var stopsCount = readUint16(reader);
    for (var i = 0; i < stopsCount; i++) {
        info.colorStops.push({
            location: readUint32(reader),
            midpoint: readUint32(reader) / 100,
            color: readColor(reader),
        });
        skipBytes(reader, 2);
    }
    var opacityStopsCount = readUint16(reader);
    for (var i = 0; i < opacityStopsCount; i++) {
        info.opacityStops.push({
            location: readUint32(reader),
            midpoint: readUint32(reader) / 100,
            opacity: readUint16(reader) / 0xff,
        });
    }
    var expansionCount = readUint16(reader);
    if (expansionCount !== 2)
        throw new Error('Invalid grdm expansion count');
    var interpolation = readUint16(reader);
    info.smoothness = interpolation / 4096;
    var length = readUint16(reader);
    if (length !== 32)
        throw new Error('Invalid grdm length');
    info.gradientType = readUint16(reader) ? 'noise' : 'solid';
    info.randomSeed = readUint32(reader);
    info.addTransparency = !!readUint16(reader);
    info.restrictColors = !!readUint16(reader);
    info.roughness = readUint32(reader) / 4096;
    info.colorModel = (grdmColorModels[readUint16(reader)] || 'rgb');
    info.min = [
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
    ];
    info.max = [
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
        readUint16(reader) / 0x8000,
    ];
    skipBytes(reader, left());
    for (var _i = 0, _a = info.colorStops; _i < _a.length; _i++) {
        var s = _a[_i];
        s.location /= interpolation;
    }
    for (var _b = 0, _c = info.opacityStops; _b < _c.length; _b++) {
        var s = _c[_b];
        s.location /= interpolation;
    }
    target.adjustment = info;
}, function (writer, target) {
    var _a, _b, _c;
    var info = target.adjustment;
    writeUint16(writer, 1); // version
    writeUint8(writer, info.reverse ? 1 : 0);
    writeUint8(writer, info.dither ? 1 : 0);
    writeUnicodeStringWithPadding(writer, info.name || '');
    writeUint16(writer, info.colorStops && info.colorStops.length || 0);
    var interpolation = Math.round(((_a = info.smoothness) !== null && _a !== void 0 ? _a : 1) * 4096);
    for (var _i = 0, _d = info.colorStops || []; _i < _d.length; _i++) {
        var s = _d[_i];
        writeUint32(writer, Math.round(s.location * interpolation));
        writeUint32(writer, Math.round(s.midpoint * 100));
        writeColor(writer, s.color);
        writeZeros(writer, 2);
    }
    writeUint16(writer, info.opacityStops && info.opacityStops.length || 0);
    for (var _e = 0, _f = info.opacityStops || []; _e < _f.length; _e++) {
        var s = _f[_e];
        writeUint32(writer, Math.round(s.location * interpolation));
        writeUint32(writer, Math.round(s.midpoint * 100));
        writeUint16(writer, Math.round(s.opacity * 0xff));
    }
    writeUint16(writer, 2); // expansion count
    writeUint16(writer, interpolation);
    writeUint16(writer, 32); // length
    writeUint16(writer, info.gradientType === 'noise' ? 1 : 0);
    writeUint32(writer, info.randomSeed || 0);
    writeUint16(writer, info.addTransparency ? 1 : 0);
    writeUint16(writer, info.restrictColors ? 1 : 0);
    writeUint32(writer, Math.round(((_b = info.roughness) !== null && _b !== void 0 ? _b : 1) * 4096));
    var colorModel = grdmColorModels.indexOf((_c = info.colorModel) !== null && _c !== void 0 ? _c : 'rgb');
    writeUint16(writer, colorModel === -1 ? 3 : colorModel);
    for (var i = 0; i < 4; i++)
        writeUint16(writer, Math.round((info.min && info.min[i] || 0) * 0x8000));
    for (var i = 0; i < 4; i++)
        writeUint16(writer, Math.round((info.max && info.max[i] || 0) * 0x8000));
    writeZeros(writer, 4);
});
function readSelectiveColors(reader) {
    return {
        c: readInt16(reader),
        m: readInt16(reader),
        y: readInt16(reader),
        k: readInt16(reader),
    };
}
function writeSelectiveColors(writer, cmyk) {
    var c = cmyk || {};
    writeInt16(writer, c.c);
    writeInt16(writer, c.m);
    writeInt16(writer, c.y);
    writeInt16(writer, c.k);
}
addHandler('selc', adjustmentType('selective color'), function (reader, target) {
    if (readUint16(reader) !== 1)
        throw new Error('Invalid selc version');
    var mode = readUint16(reader) ? 'absolute' : 'relative';
    skipBytes(reader, 8);
    target.adjustment = {
        type: 'selective color',
        mode: mode,
        reds: readSelectiveColors(reader),
        yellows: readSelectiveColors(reader),
        greens: readSelectiveColors(reader),
        cyans: readSelectiveColors(reader),
        blues: readSelectiveColors(reader),
        magentas: readSelectiveColors(reader),
        whites: readSelectiveColors(reader),
        neutrals: readSelectiveColors(reader),
        blacks: readSelectiveColors(reader),
    };
}, function (writer, target) {
    var info = target.adjustment;
    writeUint16(writer, 1); // version
    writeUint16(writer, info.mode === 'absolute' ? 1 : 0);
    writeZeros(writer, 8);
    writeSelectiveColors(writer, info.reds);
    writeSelectiveColors(writer, info.yellows);
    writeSelectiveColors(writer, info.greens);
    writeSelectiveColors(writer, info.cyans);
    writeSelectiveColors(writer, info.blues);
    writeSelectiveColors(writer, info.magentas);
    writeSelectiveColors(writer, info.whites);
    writeSelectiveColors(writer, info.neutrals);
    writeSelectiveColors(writer, info.blacks);
});
addHandler('CgEd', function (target) {
    var a = target.adjustment;
    if (!a)
        return false;
    return (a.type === 'brightness/contrast' && !a.useLegacy) ||
        ((a.type === 'levels' || a.type === 'curves' || a.type === 'exposure' || a.type === 'channel mixer' ||
            a.type === 'hue/saturation') && a.presetFileName !== undefined);
}, function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    if (desc.Vrsn !== 1)
        throw new Error('Invalid CgEd version');
    // this section can specify preset file name for other adjustment types
    if ('presetFileName' in desc) {
        target.adjustment = __assign(__assign({}, target.adjustment), { presetKind: desc.presetKind, presetFileName: desc.presetFileName });
    }
    else if ('curvesPresetFileName' in desc) {
        target.adjustment = __assign(__assign({}, target.adjustment), { presetKind: desc.curvesPresetKind, presetFileName: desc.curvesPresetFileName });
    }
    else if ('mixerPresetFileName' in desc) {
        target.adjustment = __assign(__assign({}, target.adjustment), { presetKind: desc.mixerPresetKind, presetFileName: desc.mixerPresetFileName });
    }
    else {
        target.adjustment = {
            type: 'brightness/contrast',
            brightness: desc.Brgh,
            contrast: desc.Cntr,
            meanValue: desc.means,
            useLegacy: !!desc.useLegacy,
            labColorOnly: !!desc['Lab '],
            auto: !!desc.Auto,
        };
    }
    skipBytes(reader, left());
}, function (writer, target) {
    var _a, _b, _c, _d;
    var info = target.adjustment;
    if (info.type === 'levels' || info.type === 'exposure' || info.type === 'hue/saturation') {
        var desc = {
            Vrsn: 1,
            presetKind: (_a = info.presetKind) !== null && _a !== void 0 ? _a : 1,
            presetFileName: info.presetFileName || '',
        };
        writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else if (info.type === 'curves') {
        var desc = {
            Vrsn: 1,
            curvesPresetKind: (_b = info.presetKind) !== null && _b !== void 0 ? _b : 1,
            curvesPresetFileName: info.presetFileName || '',
        };
        writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else if (info.type === 'channel mixer') {
        var desc = {
            Vrsn: 1,
            mixerPresetKind: (_c = info.presetKind) !== null && _c !== void 0 ? _c : 1,
            mixerPresetFileName: info.presetFileName || '',
        };
        writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else if (info.type === 'brightness/contrast') {
        var desc = {
            Vrsn: 1,
            Brgh: info.brightness || 0,
            Cntr: info.contrast || 0,
            means: (_d = info.meanValue) !== null && _d !== void 0 ? _d : 127,
            'Lab ': !!info.labColorOnly,
            useLegacy: !!info.useLegacy,
            Auto: !!info.auto,
        };
        writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else {
        throw new Error('Unhandled CgEd case');
    }
});
addHandler('Txt2', hasKey('engineData'), function (reader, target, left) {
    var data = readBytes(reader, left());
    target.engineData = fromByteArray(data);
    // const engineData = parseEngineData(data);
    // console.log(require('util').inspect(engineData, false, 99, true));
    // require('fs').writeFileSync('resources/engineData2Simple.txt', require('util').inspect(engineData, false, 99, false), 'utf8');
    // require('fs').writeFileSync('test_data.json', JSON.stringify(ed, null, 2), 'utf8');
}, function (writer, target) {
    var buffer = toByteArray(target.engineData);
    writeBytes(writer, buffer);
});
addHandler('FMsk', hasKey('filterMask'), function (reader, target) {
    target.filterMask = {
        colorSpace: readColor(reader),
        opacity: readUint16(reader) / 0xff,
    };
}, function (writer, target) {
    var _a;
    writeColor(writer, target.filterMask.colorSpace);
    writeUint16(writer, clamp((_a = target.filterMask.opacity) !== null && _a !== void 0 ? _a : 1, 0, 1) * 0xff);
});
addHandler('artd', // document-wide artboard info
function (// document-wide artboard info
target) { return target.artboards !== undefined; }, function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    target.artboards = {
        count: desc['Cnt '],
        autoExpandOffset: { horizontal: desc.autoExpandOffset.Hrzn, vertical: desc.autoExpandOffset.Vrtc },
        origin: { horizontal: desc.origin.Hrzn, vertical: desc.origin.Vrtc },
        autoExpandEnabled: desc.autoExpandEnabled,
        autoNestEnabled: desc.autoNestEnabled,
        autoPositionEnabled: desc.autoPositionEnabled,
        shrinkwrapOnSaveEnabled: desc.shrinkwrapOnSaveEnabled,
        docDefaultNewArtboardBackgroundColor: parseColor(desc.docDefaultNewArtboardBackgroundColor),
        docDefaultNewArtboardBackgroundType: desc.docDefaultNewArtboardBackgroundType,
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var _a, _b, _c, _d, _e;
    var artb = target.artboards;
    var desc = {
        'Cnt ': artb.count,
        autoExpandOffset: artb.autoExpandOffset ? { Hrzn: artb.autoExpandOffset.horizontal, Vrtc: artb.autoExpandOffset.vertical } : { Hrzn: 0, Vrtc: 0 },
        origin: artb.origin ? { Hrzn: artb.origin.horizontal, Vrtc: artb.origin.vertical } : { Hrzn: 0, Vrtc: 0 },
        autoExpandEnabled: (_a = artb.autoExpandEnabled) !== null && _a !== void 0 ? _a : true,
        autoNestEnabled: (_b = artb.autoNestEnabled) !== null && _b !== void 0 ? _b : true,
        autoPositionEnabled: (_c = artb.autoPositionEnabled) !== null && _c !== void 0 ? _c : true,
        shrinkwrapOnSaveEnabled: (_d = artb.shrinkwrapOnSaveEnabled) !== null && _d !== void 0 ? _d : true,
        docDefaultNewArtboardBackgroundColor: serializeColor(artb.docDefaultNewArtboardBackgroundColor),
        docDefaultNewArtboardBackgroundType: (_e = artb.docDefaultNewArtboardBackgroundType) !== null && _e !== void 0 ? _e : 1,
    };
    writeVersionAndDescriptor(writer, '', 'null', desc, 'artd');
});
function parseFxObject(fx) {
    var stroke = {
        enabled: !!fx.enab,
        position: FStl.decode(fx.Styl),
        fillType: FrFl.decode(fx.PntT),
        blendMode: BlnM.decode(fx['Md  ']),
        opacity: parsePercent(fx.Opct),
        size: parseUnits(fx['Sz  ']),
    };
    if (fx.present !== undefined)
        stroke.present = fx.present;
    if (fx.showInDialog !== undefined)
        stroke.showInDialog = fx.showInDialog;
    if (fx.overprint !== undefined)
        stroke.overprint = fx.overprint;
    if (fx['Clr '])
        stroke.color = parseColor(fx['Clr ']);
    if (fx.Grad)
        stroke.gradient = parseGradientContent(fx);
    if (fx.Ptrn)
        stroke.pattern = parsePatternContent(fx);
    return stroke;
}
function serializeFxObject(stroke) {
    var FrFX = {};
    FrFX.enab = !!stroke.enabled;
    if (stroke.present !== undefined)
        FrFX.present = !!stroke.present;
    if (stroke.showInDialog !== undefined)
        FrFX.showInDialog = !!stroke.showInDialog;
    FrFX.Styl = FStl.encode(stroke.position);
    FrFX.PntT = FrFl.encode(stroke.fillType);
    FrFX['Md  '] = BlnM.encode(stroke.blendMode);
    FrFX.Opct = unitsPercent(stroke.opacity);
    FrFX['Sz  '] = unitsValue(stroke.size, 'size');
    if (stroke.color)
        FrFX['Clr '] = serializeColor(stroke.color);
    if (stroke.gradient)
        FrFX = __assign(__assign({}, FrFX), serializeGradientContent(stroke.gradient));
    if (stroke.pattern)
        FrFX = __assign(__assign({}, FrFX), serializePatternContent(stroke.pattern));
    if (stroke.overprint !== undefined)
        FrFX.overprint = !!stroke.overprint;
    return FrFX;
}
function parseEffects(info, log) {
    var effects = {};
    if (!info.masterFXSwitch)
        effects.disabled = true;
    if (info['Scl '])
        effects.scale = parsePercent(info['Scl ']);
    if (info.DrSh)
        effects.dropShadow = [parseEffectObject(info.DrSh, log)];
    if (info.dropShadowMulti)
        effects.dropShadow = info.dropShadowMulti.map(function (i) { return parseEffectObject(i, log); });
    if (info.IrSh)
        effects.innerShadow = [parseEffectObject(info.IrSh, log)];
    if (info.innerShadowMulti)
        effects.innerShadow = info.innerShadowMulti.map(function (i) { return parseEffectObject(i, log); });
    if (info.OrGl)
        effects.outerGlow = parseEffectObject(info.OrGl, log);
    if (info.IrGl)
        effects.innerGlow = parseEffectObject(info.IrGl, log);
    if (info.ebbl)
        effects.bevel = parseEffectObject(info.ebbl, log);
    if (info.SoFi)
        effects.solidFill = [parseEffectObject(info.SoFi, log)];
    if (info.solidFillMulti)
        effects.solidFill = info.solidFillMulti.map(function (i) { return parseEffectObject(i, log); });
    if (info.patternFill)
        effects.patternOverlay = parseEffectObject(info.patternFill, log);
    if (info.GrFl)
        effects.gradientOverlay = [parseEffectObject(info.GrFl, log)];
    if (info.gradientFillMulti)
        effects.gradientOverlay = info.gradientFillMulti.map(function (i) { return parseEffectObject(i, log); });
    if (info.ChFX)
        effects.satin = parseEffectObject(info.ChFX, log);
    if (info.FrFX)
        effects.stroke = [parseFxObject(info.FrFX)];
    if (info.frameFXMulti)
        effects.stroke = info.frameFXMulti.map(function (i) { return parseFxObject(i); });
    return effects;
}
function serializeEffects(e, log, multi) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var info = multi ? {
        'Scl ': unitsPercent((_a = e.scale) !== null && _a !== void 0 ? _a : 1),
        masterFXSwitch: !e.disabled,
    } : {
        masterFXSwitch: !e.disabled,
        'Scl ': unitsPercent((_b = e.scale) !== null && _b !== void 0 ? _b : 1),
    };
    var arrayKeys = ['dropShadow', 'innerShadow', 'solidFill', 'gradientOverlay', 'stroke'];
    for (var _i = 0, arrayKeys_1 = arrayKeys; _i < arrayKeys_1.length; _i++) {
        var key = arrayKeys_1[_i];
        if (e[key] && !Array.isArray(e[key]))
            throw new Error(key + " should be an array");
    }
    if (((_c = e.dropShadow) === null || _c === void 0 ? void 0 : _c[0]) && !multi)
        info.DrSh = serializeEffectObject(e.dropShadow[0], 'dropShadow', log);
    if (((_d = e.dropShadow) === null || _d === void 0 ? void 0 : _d[0]) && multi)
        info.dropShadowMulti = e.dropShadow.map(function (i) { return serializeEffectObject(i, 'dropShadow', log); });
    if (((_e = e.innerShadow) === null || _e === void 0 ? void 0 : _e[0]) && !multi)
        info.IrSh = serializeEffectObject(e.innerShadow[0], 'innerShadow', log);
    if (((_f = e.innerShadow) === null || _f === void 0 ? void 0 : _f[0]) && multi)
        info.innerShadowMulti = e.innerShadow.map(function (i) { return serializeEffectObject(i, 'innerShadow', log); });
    if (e.outerGlow)
        info.OrGl = serializeEffectObject(e.outerGlow, 'outerGlow', log);
    if (((_g = e.solidFill) === null || _g === void 0 ? void 0 : _g[0]) && multi)
        info.solidFillMulti = e.solidFill.map(function (i) { return serializeEffectObject(i, 'solidFill', log); });
    if (((_h = e.gradientOverlay) === null || _h === void 0 ? void 0 : _h[0]) && multi)
        info.gradientFillMulti = e.gradientOverlay.map(function (i) { return serializeEffectObject(i, 'gradientOverlay', log); });
    if (((_j = e.stroke) === null || _j === void 0 ? void 0 : _j[0]) && multi)
        info.frameFXMulti = e.stroke.map(function (i) { return serializeFxObject(i); });
    if (e.innerGlow)
        info.IrGl = serializeEffectObject(e.innerGlow, 'innerGlow', log);
    if (e.bevel)
        info.ebbl = serializeEffectObject(e.bevel, 'bevel', log);
    if (((_k = e.solidFill) === null || _k === void 0 ? void 0 : _k[0]) && !multi)
        info.SoFi = serializeEffectObject(e.solidFill[0], 'solidFill', log);
    if (e.patternOverlay)
        info.patternFill = serializeEffectObject(e.patternOverlay, 'patternOverlay', log);
    if (((_l = e.gradientOverlay) === null || _l === void 0 ? void 0 : _l[0]) && !multi)
        info.GrFl = serializeEffectObject(e.gradientOverlay[0], 'gradientOverlay', log);
    if (e.satin)
        info.ChFX = serializeEffectObject(e.satin, 'satin', log);
    if (((_m = e.stroke) === null || _m === void 0 ? void 0 : _m[0]) && !multi)
        info.FrFX = serializeFxObject((_o = e.stroke) === null || _o === void 0 ? void 0 : _o[0]);
    if (multi) {
        info.numModifyingFX = 0;
        for (var _p = 0, _q = Object.keys(e); _p < _q.length; _p++) {
            var key = _q[_p];
            var value = e[key];
            if (Array.isArray(value)) {
                for (var _r = 0, value_1 = value; _r < value_1.length; _r++) {
                    var effect = value_1[_r];
                    if (effect.enabled)
                        info.numModifyingFX++;
                }
            }
        }
    }
    return info;
}
export function hasMultiEffects(effects) {
    return Object.keys(effects).map(function (key) { return effects[key]; }).some(function (v) { return Array.isArray(v) && v.length > 1; });
}
addHandler('lfx2', function (target) { return target.effects !== undefined && !hasMultiEffects(target.effects); }, function (reader, target, left, _, options) {
    var version = readUint32(reader);
    if (version !== 0)
        throw new Error("Invalid lfx2 version");
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    // TODO: don't discard if we got it from lmfx
    // discard if read in 'lrFX' section
    target.effects = parseEffects(desc, !!options.logMissingFeatures);
    skipBytes(reader, left());
}, function (writer, target, _, options) {
    var desc = serializeEffects(target.effects, !!options.logMissingFeatures, false);
    // console.log(require('util').inspect(desc, false, 99, true));
    writeUint32(writer, 0); // version
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('cinf', hasKey('compositorUsed'), function (reader, target, left) {
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    target.compositorUsed = {
        description: desc.description,
        reason: desc.reason,
        engine: desc.Engn.split('.')[1],
        enableCompCore: desc.enableCompCore.split('.')[1],
        enableCompCoreGPU: desc.enableCompCoreGPU.split('.')[1],
        compCoreSupport: desc.compCoreSupport.split('.')[1],
        compCoreGPUSupport: desc.compCoreGPUSupport.split('.')[1],
    };
    skipBytes(reader, left());
}, function (writer, target) {
    var cinf = target.compositorUsed;
    var desc = {
        Vrsn: { major: 1, minor: 0, fix: 0 },
        // psVersion: { major: 22, minor: 3, fix: 1 }, // TESTING
        description: cinf.description,
        reason: cinf.reason,
        Engn: "Engn." + cinf.engine,
        enableCompCore: "enable." + cinf.enableCompCore,
        enableCompCoreGPU: "enable." + cinf.enableCompCoreGPU,
        // enableCompCoreThreads: `enable.feature`, // TESTING
        compCoreSupport: "reason." + cinf.compCoreSupport,
        compCoreGPUSupport: "reason." + cinf.compCoreGPUSupport,
    };
    writeVersionAndDescriptor(writer, '', 'null', desc);
});
// extension settings ?, ignore it
addHandler('extn', function (target) { return target._extn !== undefined; }, function (reader, target) {
    var desc = readVersionAndDescriptor(reader);
    // console.log(require('util').inspect(desc, false, 99, true));
    if (MOCK_HANDLERS)
        target._extn = desc;
}, function (writer, target) {
    // TODO: need to add correct types for desc fields (resources/src.psd)
    if (MOCK_HANDLERS)
        writeVersionAndDescriptor(writer, '', 'null', target._extn);
});
addHandler('iOpa', hasKey('fillOpacity'), function (reader, target) {
    target.fillOpacity = readUint8(reader) / 0xff;
    skipBytes(reader, 3);
}, function (writer, target) {
    writeUint8(writer, target.fillOpacity * 0xff);
    writeZeros(writer, 3);
});
addHandler('tsly', hasKey('transparencyShapesLayer'), function (reader, target) {
    target.transparencyShapesLayer = !!readUint8(reader);
    skipBytes(reader, 3);
}, function (writer, target) {
    writeUint8(writer, target.transparencyShapesLayer ? 1 : 0);
    writeZeros(writer, 3);
});
// descriptor helpers
function parseGradient(grad) {
    if (grad.GrdF === 'GrdF.CstS') {
        var samples_1 = grad.Intr || 4096;
        return {
            type: 'solid',
            name: grad['Nm  '],
            smoothness: grad.Intr / 4096,
            colorStops: grad.Clrs.map(function (s) { return ({
                color: parseColor(s['Clr ']),
                location: s.Lctn / samples_1,
                midpoint: s.Mdpn / 100,
            }); }),
            opacityStops: grad.Trns.map(function (s) { return ({
                opacity: parsePercent(s.Opct),
                location: s.Lctn / samples_1,
                midpoint: s.Mdpn / 100,
            }); }),
        };
    }
    else {
        return {
            type: 'noise',
            name: grad['Nm  '],
            roughness: grad.Smth / 4096,
            colorModel: ClrS.decode(grad.ClrS),
            randomSeed: grad.RndS,
            restrictColors: !!grad.VctC,
            addTransparency: !!grad.ShTr,
            min: grad['Mnm '].map(function (x) { return x / 100; }),
            max: grad['Mxm '].map(function (x) { return x / 100; }),
        };
    }
}
function serializeGradient(grad) {
    var _a, _b;
    if (grad.type === 'solid') {
        var samples_2 = Math.round(((_a = grad.smoothness) !== null && _a !== void 0 ? _a : 1) * 4096);
        return {
            'Nm  ': grad.name || '',
            GrdF: 'GrdF.CstS',
            Intr: samples_2,
            Clrs: grad.colorStops.map(function (s) {
                var _a;
                return ({
                    'Clr ': serializeColor(s.color),
                    Type: 'Clry.UsrS',
                    Lctn: Math.round(s.location * samples_2),
                    Mdpn: Math.round(((_a = s.midpoint) !== null && _a !== void 0 ? _a : 0.5) * 100),
                });
            }),
            Trns: grad.opacityStops.map(function (s) {
                var _a;
                return ({
                    Opct: unitsPercent(s.opacity),
                    Lctn: Math.round(s.location * samples_2),
                    Mdpn: Math.round(((_a = s.midpoint) !== null && _a !== void 0 ? _a : 0.5) * 100),
                });
            }),
        };
    }
    else {
        return {
            GrdF: 'GrdF.ClNs',
            'Nm  ': grad.name || '',
            ShTr: !!grad.addTransparency,
            VctC: !!grad.restrictColors,
            ClrS: ClrS.encode(grad.colorModel),
            RndS: grad.randomSeed || 0,
            Smth: Math.round(((_b = grad.roughness) !== null && _b !== void 0 ? _b : 1) * 4096),
            'Mnm ': (grad.min || [0, 0, 0, 0]).map(function (x) { return x * 100; }),
            'Mxm ': (grad.max || [1, 1, 1, 1]).map(function (x) { return x * 100; }),
        };
    }
}
function parseGradientContent(descriptor) {
    var result = parseGradient(descriptor.Grad);
    result.style = GrdT.decode(descriptor.Type);
    if (descriptor.Dthr !== undefined)
        result.dither = descriptor.Dthr;
    if (descriptor.Rvrs !== undefined)
        result.reverse = descriptor.Rvrs;
    if (descriptor.Angl !== undefined)
        result.angle = parseAngle(descriptor.Angl);
    if (descriptor['Scl '] !== undefined)
        result.scale = parsePercent(descriptor['Scl ']);
    if (descriptor.Algn !== undefined)
        result.align = descriptor.Algn;
    if (descriptor.Ofst !== undefined) {
        result.offset = {
            x: parsePercent(descriptor.Ofst.Hrzn),
            y: parsePercent(descriptor.Ofst.Vrtc)
        };
    }
    return result;
}
function parsePatternContent(descriptor) {
    var result = {
        name: descriptor.Ptrn['Nm  '],
        id: descriptor.Ptrn.Idnt,
    };
    if (descriptor.Lnkd !== undefined)
        result.linked = descriptor.Lnkd;
    if (descriptor.phase !== undefined)
        result.phase = { x: descriptor.phase.Hrzn, y: descriptor.phase.Vrtc };
    return result;
}
function parseVectorContent(descriptor) {
    if ('Grad' in descriptor) {
        return parseGradientContent(descriptor);
    }
    else if ('Ptrn' in descriptor) {
        return __assign({ type: 'pattern' }, parsePatternContent(descriptor));
    }
    else if ('Clr ' in descriptor) {
        return { type: 'color', color: parseColor(descriptor['Clr ']) };
    }
    else {
        throw new Error('Invalid vector content');
    }
}
function serializeGradientContent(content) {
    var result = {};
    if (content.dither !== undefined)
        result.Dthr = content.dither;
    if (content.reverse !== undefined)
        result.Rvrs = content.reverse;
    if (content.angle !== undefined)
        result.Angl = unitsAngle(content.angle);
    result.Type = GrdT.encode(content.style);
    if (content.align !== undefined)
        result.Algn = content.align;
    if (content.scale !== undefined)
        result['Scl '] = unitsPercent(content.scale);
    if (content.offset) {
        result.Ofst = {
            Hrzn: unitsPercent(content.offset.x),
            Vrtc: unitsPercent(content.offset.y),
        };
    }
    result.Grad = serializeGradient(content);
    return result;
}
function serializePatternContent(content) {
    var result = {
        Ptrn: {
            'Nm  ': content.name || '',
            Idnt: content.id || '',
        }
    };
    if (content.linked !== undefined)
        result.Lnkd = !!content.linked;
    if (content.phase !== undefined)
        result.phase = { Hrzn: content.phase.x, Vrtc: content.phase.y };
    return result;
}
function serializeVectorContent(content) {
    if (content.type === 'color') {
        return { key: 'SoCo', descriptor: { 'Clr ': serializeColor(content.color) } };
    }
    else if (content.type === 'pattern') {
        return { key: 'PtFl', descriptor: serializePatternContent(content) };
    }
    else {
        return { key: 'GdFl', descriptor: serializeGradientContent(content) };
    }
}
function parseColor(color) {
    if ('H   ' in color) {
        return { h: parsePercentOrAngle(color['H   ']), s: color.Strt, b: color.Brgh };
    }
    else if ('Rd  ' in color) {
        return { r: color['Rd  '], g: color['Grn '], b: color['Bl  '] };
    }
    else if ('Cyn ' in color) {
        return { c: color['Cyn '], m: color.Mgnt, y: color['Ylw '], k: color.Blck };
    }
    else if ('Gry ' in color) {
        return { k: color['Gry '] };
    }
    else if ('Lmnc' in color) {
        return { l: color.Lmnc, a: color['A   '], b: color['B   '] };
    }
    else {
        throw new Error('Unsupported color descriptor');
    }
}
function serializeColor(color) {
    if (!color) {
        return { 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
    }
    else if ('r' in color) {
        return { 'Rd  ': color.r || 0, 'Grn ': color.g || 0, 'Bl  ': color.b || 0 };
    }
    else if ('h' in color) {
        return { 'H   ': unitsAngle(color.h * 360), Strt: color.s || 0, Brgh: color.b || 0 };
    }
    else if ('c' in color) {
        return { 'Cyn ': color.c || 0, Mgnt: color.m || 0, 'Ylw ': color.y || 0, Blck: color.k || 0 };
    }
    else if ('l' in color) {
        return { Lmnc: color.l || 0, 'A   ': color.a || 0, 'B   ': color.b || 0 };
    }
    else if ('k' in color) {
        return { 'Gry ': color.k };
    }
    else {
        throw new Error('Invalid color value');
    }
}
function parseEffectObject(obj, reportErrors) {
    var result = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        var val = obj[key];
        switch (key) {
            case 'enab':
                result.enabled = !!val;
                break;
            case 'uglg':
                result.useGlobalLight = !!val;
                break;
            case 'AntA':
                result.antialiased = !!val;
                break;
            case 'Algn':
                result.align = !!val;
                break;
            case 'Dthr':
                result.dither = !!val;
                break;
            case 'Invr':
                result.invert = !!val;
                break;
            case 'Rvrs':
                result.reverse = !!val;
                break;
            case 'Clr ':
                result.color = parseColor(val);
                break;
            case 'hglC':
                result.highlightColor = parseColor(val);
                break;
            case 'sdwC':
                result.shadowColor = parseColor(val);
                break;
            case 'Styl':
                result.position = FStl.decode(val);
                break;
            case 'Md  ':
                result.blendMode = BlnM.decode(val);
                break;
            case 'hglM':
                result.highlightBlendMode = BlnM.decode(val);
                break;
            case 'sdwM':
                result.shadowBlendMode = BlnM.decode(val);
                break;
            case 'bvlS':
                result.style = BESl.decode(val);
                break;
            case 'bvlD':
                result.direction = BESs.decode(val);
                break;
            case 'bvlT':
                result.technique = bvlT.decode(val);
                break;
            case 'GlwT':
                result.technique = BETE.decode(val);
                break;
            case 'glwS':
                result.source = IGSr.decode(val);
                break;
            case 'Type':
                result.type = GrdT.decode(val);
                break;
            case 'Opct':
                result.opacity = parsePercent(val);
                break;
            case 'hglO':
                result.highlightOpacity = parsePercent(val);
                break;
            case 'sdwO':
                result.shadowOpacity = parsePercent(val);
                break;
            case 'lagl':
                result.angle = parseAngle(val);
                break;
            case 'Angl':
                result.angle = parseAngle(val);
                break;
            case 'Lald':
                result.altitude = parseAngle(val);
                break;
            case 'Sftn':
                result.soften = parseUnits(val);
                break;
            case 'srgR':
                result.strength = parsePercent(val);
                break;
            case 'blur':
                result.size = parseUnits(val);
                break;
            case 'Nose':
                result.noise = parsePercent(val);
                break;
            case 'Inpr':
                result.range = parsePercent(val);
                break;
            case 'Ckmt':
                result.choke = parseUnits(val);
                break;
            case 'ShdN':
                result.jitter = parsePercent(val);
                break;
            case 'Dstn':
                result.distance = parseUnits(val);
                break;
            case 'Scl ':
                result.scale = parsePercent(val);
                break;
            case 'Ptrn':
                result.pattern = { name: val['Nm  '], id: val.Idnt };
                break;
            case 'phase':
                result.phase = { x: val.Hrzn, y: val.Vrtc };
                break;
            case 'Ofst':
                result.offset = { x: parsePercent(val.Hrzn), y: parsePercent(val.Vrtc) };
                break;
            case 'MpgS':
            case 'TrnS':
                result.contour = {
                    name: val['Nm  '],
                    curve: val['Crv '].map(function (p) { return ({ x: p.Hrzn, y: p.Vrtc }); }),
                };
                break;
            case 'Grad':
                result.gradient = parseGradient(val);
                break;
            case 'useTexture':
            case 'useShape':
            case 'layerConceals':
            case 'present':
            case 'showInDialog':
            case 'antialiasGloss':
                result[key] = val;
                break;
            default:
                reportErrors && console.log("Invalid effect key: '" + key + "':", val);
        }
    }
    return result;
}
function serializeEffectObject(obj, objName, reportErrors) {
    var result = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var objKey = _a[_i];
        var key = objKey;
        var val = obj[key];
        switch (key) {
            case 'enabled':
                result.enab = !!val;
                break;
            case 'useGlobalLight':
                result.uglg = !!val;
                break;
            case 'antialiased':
                result.AntA = !!val;
                break;
            case 'align':
                result.Algn = !!val;
                break;
            case 'dither':
                result.Dthr = !!val;
                break;
            case 'invert':
                result.Invr = !!val;
                break;
            case 'reverse':
                result.Rvrs = !!val;
                break;
            case 'color':
                result['Clr '] = serializeColor(val);
                break;
            case 'highlightColor':
                result.hglC = serializeColor(val);
                break;
            case 'shadowColor':
                result.sdwC = serializeColor(val);
                break;
            case 'position':
                result.Styl = FStl.encode(val);
                break;
            case 'blendMode':
                result['Md  '] = BlnM.encode(val);
                break;
            case 'highlightBlendMode':
                result.hglM = BlnM.encode(val);
                break;
            case 'shadowBlendMode':
                result.sdwM = BlnM.encode(val);
                break;
            case 'style':
                result.bvlS = BESl.encode(val);
                break;
            case 'direction':
                result.bvlD = BESs.encode(val);
                break;
            case 'technique':
                if (objName === 'bevel') {
                    result.bvlT = bvlT.encode(val);
                }
                else {
                    result.GlwT = BETE.encode(val);
                }
                break;
            case 'source':
                result.glwS = IGSr.encode(val);
                break;
            case 'type':
                result.Type = GrdT.encode(val);
                break;
            case 'opacity':
                result.Opct = unitsPercent(val);
                break;
            case 'highlightOpacity':
                result.hglO = unitsPercent(val);
                break;
            case 'shadowOpacity':
                result.sdwO = unitsPercent(val);
                break;
            case 'angle':
                if (objName === 'gradientOverlay') {
                    result.Angl = unitsAngle(val);
                }
                else {
                    result.lagl = unitsAngle(val);
                }
                break;
            case 'altitude':
                result.Lald = unitsAngle(val);
                break;
            case 'soften':
                result.Sftn = unitsValue(val, key);
                break;
            case 'strength':
                result.srgR = unitsPercent(val);
                break;
            case 'size':
                result.blur = unitsValue(val, key);
                break;
            case 'noise':
                result.Nose = unitsPercent(val);
                break;
            case 'range':
                result.Inpr = unitsPercent(val);
                break;
            case 'choke':
                result.Ckmt = unitsValue(val, key);
                break;
            case 'jitter':
                result.ShdN = unitsPercent(val);
                break;
            case 'distance':
                result.Dstn = unitsValue(val, key);
                break;
            case 'scale':
                result['Scl '] = unitsPercent(val);
                break;
            case 'pattern':
                result.Ptrn = { 'Nm  ': val.name, Idnt: val.id };
                break;
            case 'phase':
                result.phase = { Hrzn: val.x, Vrtc: val.y };
                break;
            case 'offset':
                result.Ofst = { Hrzn: unitsPercent(val.x), Vrtc: unitsPercent(val.y) };
                break;
            case 'contour': {
                result[objName === 'satin' ? 'MpgS' : 'TrnS'] = {
                    'Nm  ': val.name,
                    'Crv ': val.curve.map(function (p) { return ({ Hrzn: p.x, Vrtc: p.y }); }),
                };
                break;
            }
            case 'gradient':
                result.Grad = serializeGradient(val);
                break;
            case 'useTexture':
            case 'useShape':
            case 'layerConceals':
            case 'present':
            case 'showInDialog':
            case 'antialiasGloss':
                result[key] = val;
                break;
            default:
                reportErrors && console.log("Invalid effect key: '" + key + "' value:", val);
        }
    }
    return result;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxFQUMvQixVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkQsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pELFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFDbEIsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFDbkIsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxNQUFNLENBQUMsU0FBUyxHQUFHO1FBQ2xCLFlBQVks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QUFJLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3hGLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzNGLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlGLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzlFLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBRTlFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUMzQixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFtQyxDQUFDO0lBQ3hELElBQU0sSUFBSSxHQUEwQixFQUFFLENBQUM7SUFFdkMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdGLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDdEQsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDdkQsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFL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QUFNO1lBQ2hFLEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQzdELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ25ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ25ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3RELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3BELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3hELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ2xELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3JELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3JELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ25ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3RELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsUUFBUSxH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QUF3QixHQUFHLGFBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUN6RTtLQUNEO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDIiwiZmlsZSI6ImFkZGl0aW9uYWxJbmZvLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZnJvbUJ5dGVBcnJheSwgdG9CeXRlQXJyYXkgfSBmcm9tICdiYXNlNjQtanMnO1xyXG5pbXBvcnQgeyByZWFkRWZmZWN0cywgd3JpdGVFZmZlY3RzIH0gZnJvbSAnLi9lZmZlY3RzSGVscGVycyc7XHJcbmltcG9ydCB7IGNsYW1wLCBjcmVhdGVFbnVtLCBsYXllckNvbG9ycywgTU9DS19IQU5ETEVSUyB9IGZyb20gJy4vaGVscGVycyc7XHJcbmltcG9ydCB7XHJcblx0TGF5ZXJBZGRpdGlvbmFsSW5mbywgTGF5ZXJFZmZlY3RTaGFkb3csIExheWVyRWZmZWN0c091dGVyR2xvdywgTGF5ZXJFZmZlY3RJbm5lckdsb3csIExheWVyRWZmZWN0QmV2ZWwsXHJcblx0TGF5ZXJFZmZlY3RTb2xpZEZpbGwsIExheWVyRWZmZWN0UGF0dGVybk92ZXJsYXksIExheWVyRWZmZWN0R3JhZGllbnRPdmVybGF5LCBMYXllckVmZmVjdFNhdGluLCBFZmZlY3RDb250b3VyLFxyXG5cdEVmZmVjdE5vaXNlR3JhZGllbnQsIEJlemllclBhdGgsIFBzZCwgVmVjdG9yQ29udGVudCwgTGF5ZXJFZmZlY3RTdHJva2UsIEV4dHJhR3JhZGllbnRJbmZvLCBFZmZlY3RQYXR0ZXJuLFxyXG5cdEV4dHJhUGF0dGVybkluZm8sIFJlYWRPcHRpb25zLCBCcmlnaHRuZXNzQWRqdXN0bWVudCwgRXhwb3N1cmVBZGp1c3RtZW50LCBWaWJyYW5jZUFkanVzdG1lbnQsXHJcblx0Q29sb3JCYWxhbmNlQWRqdXN0bWVudCwgQmxhY2tBbmRXaGl0ZUFkanVzdG1lbnQsIFBob3RvRmlsdGVyQWRqdXN0bWVudCwgQ2hhbm5lbE1peGVyQ2hhbm5lbCxcclxuXHRDaGFubmVsTWl4ZXJBZGp1c3RtZW50LCBQb3N0ZXJpemVBZGp1c3RtZW50LCBUaHJlc2hvbGRBZGp1c3RtZW50LCBHcmFkaWVudE1hcEFkanVzdG1lbnQsIENNWUssXHJcblx0U2VsZWN0aXZlQ29sb3JBZGp1c3RtZW50LCBDb2xvckxvb2t1cEFkanVzdG1lbnQsIExldmVsc0FkanVzdG1lbnRDaGFubmVsLCBMZXZlbHNBZGp1c3RtZW50LFxyXG5cdEN1cnZlc0FkanVzdG1lbnQsIEN1cnZlc0FkanVzdG1lbnRDaGFubmVsLCBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudCwgSHVlU2F0dXJhdGlvbkFkanVzdG1lbnRDaGFubmVsLFxyXG5cdFByZXNldEluZm8sIENvbG9yLCBDb2xvckJhbGFuY2VWYWx1ZXMsIFdyaXRlT3B0aW9ucywgTGlua2VkRmlsZSwgUGxhY2VkTGF5ZXJUeXBlLCBXYXJwLCBFZmZlY3RTb2xpZEdyYWRpZW50LFxyXG5cdEtleURlc2NyaXB0b3JJdGVtLCBCb29sZWFuT3BlcmF0aW9uLCBMYXllckVmZmVjdHNJbmZvLCBBbm5vdGF0aW9uLCBMYXllclZlY3Rvck1hc2ssXHJcbn0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdFBzZFJlYWRlciwgcmVhZFNpZ25hdHVyZSwgcmVhZFVuaWNvZGVTdHJpbmcsIHNraXBCeXRlcywgcmVhZFVpbnQzMiwgcmVhZFVpbnQ4LCByZWFkRmxvYXQ2NCwgcmVhZFVpbnQxNixcclxuXHRyZWFkQnl0ZXMsIHJlYWRJbnQxNiwgY2hlY2tTaWduYXR1cmUsIHJlYWRGbG9hdDMyLCByZWFkRml4ZWRQb2ludFBhdGgzMiwgcmVhZFNlY3Rpb24sIHJlYWRDb2xvciwgcmVhZEludDMyLFxyXG5cdHJlYWRQYXNjYWxTdHJpbmcsIHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aCwgcmVhZEFzY2lpU3RyaW5nLCByZWFkUGF0dGVybixcclxufSBmcm9tICcuL3BzZFJlYWRlcic7XHJcbmltcG9ydCB7XHJcblx0UHNkV3JpdGVyLCB3cml0ZVplcm9zLCB3cml0ZVNpZ25hdHVyZSwgd3JpdGVCeXRlcywgd3JpdGVVaW50MzIsIHdyaXRlVWludDE2LCB3cml0ZUZsb2F0NjQsIHdyaXRlVWludDgsXHJcblx0d3JpdGVJbnQxNiwgd3JpdGVGbG9hdDMyLCB3cml0ZUZpeGVkUG9pbnRQYXRoMzIsIHdyaXRlVW5pY29kZVN0cmluZywgd3JpdGVTZWN0aW9uLCB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyxcclxuXHR3cml0ZUNvbG9yLCB3cml0ZVBhc2NhbFN0cmluZywgd3JpdGVJbnQzMixcclxufSBmcm9tICcuL3BzZFdyaXRlcic7XHJcbmltcG9ydCB7XHJcblx0QW5udCwgQkVTbCwgQkVTcywgQkVURSwgQmxuTSwgYnZsVCwgQ2xyUywgRGVzY2lwdG9yR3JhZGllbnQsIERlc2NyaXB0b3JDb2xvciwgRGVzY3JpcHRvckdyYWRpZW50Q29udGVudCxcclxuXHREZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQsIERlc2NyaXB0b3JVbml0c1ZhbHVlLCBEZXNjcmlwdG9yVmVjdG9yQ29udGVudCwgRnJGbCwgRlN0bCwgR3JkVCwgSUdTciwgT3JudCxcclxuXHRwYXJzZUFuZ2xlLCBwYXJzZVBlcmNlbnQsIHBhcnNlUGVyY2VudE9yQW5nbGUsIHBhcnNlVW5pdHMsIHBhcnNlVW5pdHNPck51bWJlciwgUXVpbHRXYXJwRGVzY3JpcHRvciwgcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yLCBTdHJva2VEZXNjcmlwdG9yLFxyXG5cdHN0cm9rZVN0eWxlTGluZUFsaWdubWVudCwgc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZSwgc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUsIFRleHREZXNjcmlwdG9yLCB0ZXh0R3JpZGRpbmcsXHJcblx0dW5pdHNBbmdsZSwgdW5pdHNQZXJjZW50LCB1bml0c1ZhbHVlLCBXYXJwRGVzY3JpcHRvciwgd2FycFN0eWxlLCB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yXHJcbn0gZnJvbSAnLi9kZXNjcmlwdG9yJztcclxuaW1wb3J0IHsgc2VyaWFsaXplRW5naW5lRGF0YSwgcGFyc2VFbmdpbmVEYXRhIH0gZnJvbSAnLi9lbmdpbmVEYXRhJztcclxuaW1wb3J0IHsgZW5jb2RlRW5naW5lRGF0YSwgZGVjb2RlRW5naW5lRGF0YSB9IGZyb20gJy4vdGV4dCc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVuZGVkV3JpdGVPcHRpb25zIGV4dGVuZHMgV3JpdGVPcHRpb25zIHtcclxuXHRsYXllcklkczogbnVtYmVyW107XHJcbn1cclxuXHJcbnR5cGUgSGFzTWV0aG9kID0gKHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbykgPT4gYm9vbGVhbjtcclxudHlwZSBSZWFkTWV0aG9kID0gKHJlYWRlcjogUHNkUmVhZGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIGxlZnQ6ICgpID0+IG51bWJlciwgcHNkOiBQc2QsIG9wdGlvbnM6IFJlYWRPcHRpb25zKSA9PiB2b2lkO1xyXG50eXBlIFdyaXRlTWV0aG9kID0gKHdyaXRlcjogUHNkV3JpdGVyLCB0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8sIHBzZDogUHNkLCBvcHRpb25zOiBFeHRlbmRlZFdyaXRlT3B0aW9ucykgPT4gdm9pZDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW5mb0hhbmRsZXIge1xyXG5cdGtleTogc3RyaW5nO1xyXG5cdGhhczogSGFzTWV0aG9kO1xyXG5cdHJlYWQ6IFJlYWRNZXRob2Q7XHJcblx0d3JpdGU6IFdyaXRlTWV0aG9kO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgaW5mb0hhbmRsZXJzOiBJbmZvSGFuZGxlcltdID0gW107XHJcbmV4cG9ydCBjb25zdCBpbmZvSGFuZGxlcnNNYXA6IHsgW2tleTogc3RyaW5nXTogSW5mb0hhbmRsZXIgfSA9IHt9O1xyXG5cclxuZnVuY3Rpb24gYWRkSGFuZGxlcihrZXk6IHN0cmluZywgaGFzOiBIYXNNZXRob2QsIHJlYWQ6IFJlYWRNZXRob2QsIHdyaXRlOiBXcml0ZU1ldGhvZCkge1xyXG5cdGNvbnN0IGhhbmRsZXI6IEluZm9IYW5kbGVyID0geyBrZXksIGhhcywgcmVhZCwgd3JpdGUgfTtcclxuXHRpbmZvSGFuZGxlcnMucHVzaChoYW5kbGVyKTtcclxuXHRpbmZvSGFuZGxlcnNNYXBbaGFuZGxlci5rZXldID0gaGFuZGxlcjtcclxufVxyXG5cclxuZnVuY3Rpb24gYWRkSGFuZGxlckFsaWFzKGtleTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZykge1xyXG5cdGluZm9IYW5kbGVyc01hcFtrZXldID0gaW5mb0hhbmRsZXJzTWFwW3RhcmdldF07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc0tleShrZXk6IGtleW9mIExheWVyQWRkaXRpb25hbEluZm8pIHtcclxuXHRyZXR1cm4gKHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbykgPT4gdGFyZ2V0W2tleV0gIT09IHVuZGVmaW5lZDtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVhZExlbmd0aDY0KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSkgdGhyb3cgbmV3IEVycm9yKGBSZXNvdXJjZSBzaXplIGFib3ZlIDQgR0IgbGltaXQgYXQgJHtyZWFkZXIub2Zmc2V0LnRvU3RyaW5nKDE2KX1gKTtcclxuXHRyZXR1cm4gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUxlbmd0aDY0KHdyaXRlcjogUHNkV3JpdGVyLCBsZW5ndGg6IG51bWJlcikge1xyXG5cdHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCBsZW5ndGgpO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdUeVNoJyxcclxuXHRoYXNLZXkoJ3RleHQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnRCeXRlcykgPT4ge1xyXG5cdFx0aWYgKHJlYWRJbnQxNihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVHlTaCB2ZXJzaW9uYCk7XHJcblxyXG5cdFx0Y29uc3QgdHJhbnNmb3JtOiBudW1iZXJbXSA9IFtdO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHRyYW5zZm9ybS5wdXNoKHJlYWRGbG9hdDY0KHJlYWRlcikpO1xyXG5cclxuXHRcdGlmIChyZWFkSW50MTYocmVhZGVyKSAhPT0gNTApIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIHRleHQgdmVyc2lvbmApO1xyXG5cdFx0Y29uc3QgdGV4dDogVGV4dERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHJcblx0XHRpZiAocmVhZEludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIHdhcnAgdmVyc2lvbmApO1xyXG5cdFx0Y29uc3Qgd2FycDogV2FycERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHJcblx0XHR0YXJnZXQudGV4dCA9IHtcclxuXHRcdFx0dHJhbnNmb3JtLFxyXG5cdFx0XHRsZWZ0OiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0XHR0b3A6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdHJpZ2h0OiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0XHRib3R0b206IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdHRleHQ6IHRleHRbJ1R4dCAnXS5yZXBsYWNlKC9cXHIvZywgJ1xcbicpLFxyXG5cdFx0XHRpbmRleDogdGV4dC5UZXh0SW5kZXggfHwgMCxcclxuXHRcdFx0Z3JpZGRpbmc6IHRleHRHcmlkZGluZy5kZWNvZGUodGV4dC50ZXh0R3JpZGRpbmcpLFxyXG5cdFx0XHRhbnRpQWxpYXM6IEFubnQuZGVjb2RlKHRleHQuQW50QSksXHJcblx0XHRcdG9yaWVudGF0aW9uOiBPcm50LmRlY29kZSh0ZXh0Lk9ybnQpLFxyXG5cdFx0XHR3YXJwOiB7XHJcblx0XHRcdFx0c3R5bGU6IHdhcnBTdHlsZS5kZWNvZGUod2FycC53YXJwU3R5bGUpLFxyXG5cdFx0XHRcdHZhbHVlOiB3YXJwLndhcnBWYWx1ZSB8fCAwLFxyXG5cdFx0XHRcdHBlcnNwZWN0aXZlOiB3YXJwLndhcnBQZXJzcGVjdGl2ZSB8fCAwLFxyXG5cdFx0XHRcdHBlcnNwZWN0aXZlT3RoZXI6IHdhcnAud2FycFBlcnNwZWN0aXZlT3RoZXIgfHwgMCxcclxuXHRcdFx0XHRyb3RhdGU6IE9ybnQuZGVjb2RlKHdhcnAud2FycFJvdGF0ZSksXHJcblx0XHRcdH0sXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICh0ZXh0LkVuZ2luZURhdGEpIHtcclxuXHRcdFx0Y29uc3QgZW5naW5lRGF0YSA9IGRlY29kZUVuZ2luZURhdGEocGFyc2VFbmdpbmVEYXRhKHRleHQuRW5naW5lRGF0YSkpO1xyXG5cclxuXHRcdFx0Ly8gY29uc3QgYmVmb3JlID0gcGFyc2VFbmdpbmVEYXRhKHRleHQuRW5naW5lRGF0YSk7XHJcblx0XHRcdC8vIGNvbnN0IGFmdGVyID0gZW5jb2RlRW5naW5lRGF0YShlbmdpbmVEYXRhKTtcclxuXHRcdFx0Ly8gcmVxdWlyZSgnZnMnKS53cml0ZUZpbGVTeW5jKCdiZWZvcmUudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoYmVmb3JlLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdFx0Ly8gcmVxdWlyZSgnZnMnKS53cml0ZUZpbGVTeW5jKCdhZnRlci50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChhZnRlciwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwYXJzZUVuZ2luZURhdGEodGV4dC5FbmdpbmVEYXRhKSwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHRcdHRhcmdldC50ZXh0ID0geyAuLi50YXJnZXQudGV4dCwgLi4uZW5naW5lRGF0YSB9O1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdCh0YXJnZXQudGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdEJ5dGVzKCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB0ZXh0ID0gdGFyZ2V0LnRleHQhO1xyXG5cdFx0Y29uc3Qgd2FycCA9IHRleHQud2FycCB8fCB7fTtcclxuXHRcdGNvbnN0IHRyYW5zZm9ybSA9IHRleHQudHJhbnNmb3JtIHx8IFsxLCAwLCAwLCAxLCAwLCAwXTtcclxuXHJcblx0XHRjb25zdCB0ZXh0RGVzY3JpcHRvcjogVGV4dERlc2NyaXB0b3IgPSB7XHJcblx0XHRcdCdUeHQgJzogKHRleHQudGV4dCB8fCAnJykucmVwbGFjZSgvXFxyP1xcbi9nLCAnXFxyJyksXHJcblx0XHRcdHRleHRHcmlkZGluZzogdGV4dEdyaWRkaW5nLmVuY29kZSh0ZXh0LmdyaWRkaW5nKSxcclxuXHRcdFx0T3JudDogT3JudC5lbmNvZGUodGV4dC5vcmllbnRhdGlvbiksXHJcblx0XHRcdEFudEE6IEFubnQuZW5jb2RlKHRleHQuYW50aUFsaWFzKSxcclxuXHRcdFx0VGV4dEluZGV4OiB0ZXh0LmluZGV4IHx8IDAsXHJcblx0XHRcdEVuZ2luZURhdGE6IHNlcmlhbGl6ZUVuZ2luZURhdGEoZW5jb2RlRW5naW5lRGF0YSh0ZXh0KSksXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XHJcblx0XHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHRyYW5zZm9ybVtpXSk7XHJcblx0XHR9XHJcblxyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIDUwKTsgLy8gdGV4dCB2ZXJzaW9uXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdUeExyJywgdGV4dERlc2NyaXB0b3IpO1xyXG5cclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCAxKTsgLy8gd2FycCB2ZXJzaW9uXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICd3YXJwJywgZW5jb2RlV2FycCh3YXJwKSk7XHJcblxyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgdGV4dC5sZWZ0ISk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LnRvcCEpO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgdGV4dC5yaWdodCEpO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgdGV4dC5ib3R0b20hKTtcclxuXHJcblx0XHQvLyB3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblx0fSxcclxuKTtcclxuXHJcbi8vIHZlY3RvciBmaWxsc1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnU29DbycsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSA9PT0gdW5kZWZpbmVkICYmXHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbC50eXBlID09PSAnY29sb3InLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwgPSBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcik7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHsgZGVzY3JpcHRvciB9ID0gc2VyaWFsaXplVmVjdG9yQ29udGVudCh0YXJnZXQudmVjdG9yRmlsbCEpO1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2NyaXB0b3IpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdHZEZsJyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnZlY3RvckZpbGwgIT09IHVuZGVmaW5lZCAmJiB0YXJnZXQudmVjdG9yU3Ryb2tlID09PSB1bmRlZmluZWQgJiZcclxuXHRcdCh0YXJnZXQudmVjdG9yRmlsbC50eXBlID09PSAnc29saWQnIHx8IHRhcmdldC52ZWN0b3JGaWxsLnR5cGUgPT09ICdub2lzZScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwgPSBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB7IGRlc2NyaXB0b3IgfSA9IHNlcmlhbGl6ZVZlY3RvckNvbnRlbnQodGFyZ2V0LnZlY3RvckZpbGwhKTtcclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjcmlwdG9yKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnUHRGbCcsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSA9PT0gdW5kZWZpbmVkICYmXHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbC50eXBlID09PSAncGF0dGVybicsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbCA9IHBhcnNlVmVjdG9yQ29udGVudChkZXNjcmlwdG9yKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgeyBkZXNjcmlwdG9yIH0gPSBzZXJpYWxpemVWZWN0b3JDb250ZW50KHRhcmdldC52ZWN0b3JGaWxsISk7XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzY3JpcHRvcik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3ZzY2cnLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQudmVjdG9yRmlsbCAhPT0gdW5kZWZpbmVkICYmIHRhcmdldC52ZWN0b3JTdHJva2UgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHJlYWRTaWduYXR1cmUocmVhZGVyKTsgLy8ga2V5XHJcblx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbCA9IHBhcnNlVmVjdG9yQ29udGVudChkZXNjKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHsgZGVzY3JpcHRvciwga2V5IH0gPSBzZXJpYWxpemVWZWN0b3JDb250ZW50KHRhcmdldC52ZWN0b3JGaWxsISk7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIGtleSk7XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzY3JpcHRvcik7XHJcblx0fSxcclxuKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQmV6aWVyS25vdChyZWFkZXI6IFBzZFJlYWRlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHRjb25zdCB5MCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiBoZWlnaHQ7XHJcblx0Y29uc3QgeDAgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogd2lkdGg7XHJcblx0Y29uc3QgeTEgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogaGVpZ2h0O1xyXG5cdGNvbnN0IHgxID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKSAqIHdpZHRoO1xyXG5cdGNvbnN0IHkyID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKSAqIGhlaWdodDtcclxuXHRjb25zdCB4MiA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiB3aWR0aDtcclxuXHRyZXR1cm4gW3gwLCB5MCwgeDEsIHkxLCB4MiwgeTJdO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUJlemllcktub3Qod3JpdGVyOiBQc2RXcml0ZXIsIHBvaW50czogbnVtYmVyW10sIHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyKSB7XHJcblx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgcG9pbnRzWzFdIC8gaGVpZ2h0KTsgLy8geTBcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbMF0gLyB3aWR0aCk7IC8vIHgwXHJcblx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgcG9pbnRzWzNdIC8gaGVpZ2h0KTsgLy8geTFcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbMl0gLyB3aWR0aCk7IC8vIHgxXHJcblx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgcG9pbnRzWzVdIC8gaGVpZ2h0KTsgLy8geTJcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbNF0gLyB3aWR0aCk7IC8vIHgyXHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBib29sZWFuT3BlcmF0aW9uczogQm9vbGVhbk9wZXJhdGlvbltdID0gWydleGNsdWRlJywgJ2NvbWJpbmUnLCAnc3VidHJhY3QnLCAnaW50ZXJzZWN0J107XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZFZlY3Rvck1hc2socmVhZGVyOiBQc2RSZWFkZXIsIHZlY3Rvck1hc2s6IExheWVyVmVjdG9yTWFzaywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHNpemU6IG51bWJlcikge1xyXG5cdGNvbnN0IGVuZCA9IHJlYWRlci5vZmZzZXQgKyBzaXplO1xyXG5cdGNvbnN0IHBhdGhzID0gdmVjdG9yTWFzay5wYXRocztcclxuXHRsZXQgcGF0aDogQmV6aWVyUGF0aCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuXHJcblx0d2hpbGUgKChlbmQgLSByZWFkZXIub2Zmc2V0KSA+PSAyNikge1xyXG5cdFx0Y29uc3Qgc2VsZWN0b3IgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0c3dpdGNoIChzZWxlY3Rvcikge1xyXG5cdFx0XHRjYXNlIDA6IC8vIENsb3NlZCBzdWJwYXRoIGxlbmd0aCByZWNvcmRcclxuXHRcdFx0Y2FzZSAzOiB7IC8vIE9wZW4gc3VicGF0aCBsZW5ndGggcmVjb3JkXHJcblx0XHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpOyAvLyBjb3VudFxyXG5cdFx0XHRcdGNvbnN0IGJvb2xPcCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRcdHJlYWRVaW50MTYocmVhZGVyKTsgLy8gYWx3YXlzIDEgP1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDE4KTtcclxuXHRcdFx0XHQvLyBUT0RPOiAnY29tYmluZScgaGVyZSBtaWdodCBiZSB3cm9uZ1xyXG5cdFx0XHRcdHBhdGggPSB7IG9wZW46IHNlbGVjdG9yID09PSAzLCBvcGVyYXRpb246IGJvb2xPcCA9PT0gLTEgPyAnY29tYmluZScgOiBib29sZWFuT3BlcmF0aW9uc1tib29sT3BdLCBrbm90czogW10gfTtcclxuXHRcdFx0XHRwYXRocy5wdXNoKHBhdGgpO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgMTogLy8gQ2xvc2VkIHN1YnBhdGggQmV6aWVyIGtub3QsIGxpbmtlZFxyXG5cdFx0XHRjYXNlIDI6IC8vIENsb3NlZCBzdWJwYXRoIEJlemllciBrbm90LCB1bmxpbmtlZFxyXG5cdFx0XHRjYXNlIDQ6IC8vIE9wZW4gc3VicGF0aCBCZXppZXIga25vdCwgbGlua2VkXHJcblx0XHRcdGNhc2UgNTogLy8gT3BlbiBzdWJwYXRoIEJlemllciBrbm90LCB1bmxpbmtlZFxyXG5cdFx0XHRcdHBhdGghLmtub3RzLnB1c2goeyBsaW5rZWQ6IChzZWxlY3RvciA9PT0gMSB8fCBzZWxlY3RvciA9PT0gNCksIHBvaW50czogcmVhZEJlemllcktub3QocmVhZGVyLCB3aWR0aCwgaGVpZ2h0KSB9KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSA2OiAvLyBQYXRoIGZpbGwgcnVsZSByZWNvcmRcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyNCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgNzogeyAvLyBDbGlwYm9hcmQgcmVjb3JkXHJcblx0XHRcdFx0Ly8gVE9ETzogY2hlY2sgaWYgdGhlc2UgbmVlZCB0byBiZSBtdWx0aXBsaWVkIGJ5IGRvY3VtZW50IHNpemVcclxuXHRcdFx0XHRjb25zdCB0b3AgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGxlZnQgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGJvdHRvbSA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgcmlnaHQgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IHJlc29sdXRpb24gPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpO1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDQpO1xyXG5cdFx0XHRcdHZlY3Rvck1hc2suY2xpcGJvYXJkID0geyB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIHJlc29sdXRpb24gfTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlIDg6IC8vIEluaXRpYWwgZmlsbCBydWxlIHJlY29yZFxyXG5cdFx0XHRcdHZlY3Rvck1hc2suZmlsbFN0YXJ0c1dpdGhBbGxQaXhlbHMgPSAhIXJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyMik7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGRlZmF1bHQ6IHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2bXNrIHNlY3Rpb24nKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBwYXRocztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQndm1zaycsXHJcblx0aGFzS2V5KCd2ZWN0b3JNYXNrJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCB7IHdpZHRoLCBoZWlnaHQgfSkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MzIocmVhZGVyKSAhPT0gMykgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZtc2sgdmVyc2lvbicpO1xyXG5cclxuXHRcdHRhcmdldC52ZWN0b3JNYXNrID0geyBwYXRoczogW10gfTtcclxuXHRcdGNvbnN0IHZlY3Rvck1hc2sgPSB0YXJnZXQudmVjdG9yTWFzaztcclxuXHJcblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdHZlY3Rvck1hc2suaW52ZXJ0ID0gKGZsYWdzICYgMSkgIT09IDA7XHJcblx0XHR2ZWN0b3JNYXNrLm5vdExpbmsgPSAoZmxhZ3MgJiAyKSAhPT0gMDtcclxuXHRcdHZlY3Rvck1hc2suZGlzYWJsZSA9IChmbGFncyAmIDQpICE9PSAwO1xyXG5cclxuXHRcdHJlYWRWZWN0b3JNYXNrKHJlYWRlciwgdmVjdG9yTWFzaywgd2lkdGgsIGhlaWdodCwgbGVmdCgpKTtcclxuXHJcblx0XHQvLyBkcmF3QmV6aWVyUGF0aHModmVjdG9yTWFzay5wYXRocywgd2lkdGgsIGhlaWdodCwgJ291dC5wbmcnKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0LCB7IHdpZHRoLCBoZWlnaHQgfSkgPT4ge1xyXG5cdFx0Y29uc3QgdmVjdG9yTWFzayA9IHRhcmdldC52ZWN0b3JNYXNrITtcclxuXHRcdGNvbnN0IGZsYWdzID1cclxuXHRcdFx0KHZlY3Rvck1hc2suaW52ZXJ0ID8gMSA6IDApIHxcclxuXHRcdFx0KHZlY3Rvck1hc2subm90TGluayA/IDIgOiAwKSB8XHJcblx0XHRcdCh2ZWN0b3JNYXNrLmRpc2FibGUgPyA0IDogMCk7XHJcblxyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAzKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBmbGFncyk7XHJcblxyXG5cdFx0Ly8gaW5pdGlhbCBlbnRyeVxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCA2KTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyNCk7XHJcblxyXG5cdFx0Y29uc3QgY2xpcGJvYXJkID0gdmVjdG9yTWFzay5jbGlwYm9hcmQ7XHJcblx0XHRpZiAoY2xpcGJvYXJkKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgNyk7XHJcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC50b3ApO1xyXG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQubGVmdCk7XHJcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC5ib3R0b20pO1xyXG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQucmlnaHQpO1xyXG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQucmVzb2x1dGlvbik7XHJcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA0KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAodmVjdG9yTWFzay5maWxsU3RhcnRzV2l0aEFsbFBpeGVscyAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgOCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgdmVjdG9yTWFzay5maWxsU3RhcnRzV2l0aEFsbFBpeGVscyA/IDEgOiAwKTtcclxuXHRcdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIyKTtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKGNvbnN0IHBhdGggb2YgdmVjdG9yTWFzay5wYXRocykge1xyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHBhdGgub3BlbiA/IDMgOiAwKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBwYXRoLmtub3RzLmxlbmd0aCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5hYnMoYm9vbGVhbk9wZXJhdGlvbnMuaW5kZXhPZihwYXRoLm9wZXJhdGlvbikpKTsgLy8gZGVmYXVsdCB0byAxIGlmIG5vdCBmb3VuZFxyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpO1xyXG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMTgpOyAvLyBUT0RPOiB0aGVzZSBhcmUgc29tZXRpbWVzIG5vbi16ZXJvXHJcblxyXG5cdFx0XHRjb25zdCBsaW5rZWRLbm90ID0gcGF0aC5vcGVuID8gNCA6IDE7XHJcblx0XHRcdGNvbnN0IHVubGlua2VkS25vdCA9IHBhdGgub3BlbiA/IDUgOiAyO1xyXG5cclxuXHRcdFx0Zm9yIChjb25zdCB7IGxpbmtlZCwgcG9pbnRzIH0gb2YgcGF0aC5rbm90cykge1xyXG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgbGlua2VkID8gbGlua2VkS25vdCA6IHVubGlua2VkS25vdCk7XHJcblx0XHRcdFx0d3JpdGVCZXppZXJLbm90KHdyaXRlciwgcG9pbnRzLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG4vLyBUT0RPOiBuZWVkIHRvIHdyaXRlIHZtc2sgaWYgaGFzIG91dGxpbmUgP1xyXG5hZGRIYW5kbGVyQWxpYXMoJ3ZzbXMnLCAndm1zaycpO1xyXG4vLyBhZGRIYW5kbGVyQWxpYXMoJ3Ztc2snLCAndnNtcycpO1xyXG5cclxuaW50ZXJmYWNlIFZvZ2tEZXNjcmlwdG9yIHtcclxuXHRrZXlEZXNjcmlwdG9yTGlzdDoge1xyXG5cdFx0a2V5U2hhcGVJbnZhbGlkYXRlZD86IGJvb2xlYW47XHJcblx0XHRrZXlPcmlnaW5UeXBlPzogbnVtYmVyO1xyXG5cdFx0a2V5T3JpZ2luUmVzb2x1dGlvbj86IG51bWJlcjtcclxuXHRcdGtleU9yaWdpblJSZWN0UmFkaWk/OiB7XHJcblx0XHRcdHVuaXRWYWx1ZVF1YWRWZXJzaW9uOiBudW1iZXI7XHJcblx0XHRcdHRvcFJpZ2h0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFx0dG9wTGVmdDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRcdGJvdHRvbUxlZnQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0XHRib3R0b21SaWdodDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHR9O1xyXG5cdFx0a2V5T3JpZ2luU2hhcGVCQm94Pzoge1xyXG5cdFx0XHR1bml0VmFsdWVRdWFkVmVyc2lvbjogbnVtYmVyO1xyXG5cdFx0XHQnVG9wICc6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0XHRMZWZ0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFx0QnRvbTogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRcdFJnaHQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0fTtcclxuXHRcdGtleU9yaWdpbkJveENvcm5lcnM/OiB7XHJcblx0XHRcdHJlY3RhbmdsZUNvcm5lckE6IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0XHRcdHJlY3RhbmdsZUNvcm5lckI6IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0XHRcdHJlY3RhbmdsZUNvcm5lckM6IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0XHRcdHJlY3RhbmdsZUNvcm5lckQ6IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0XHR9O1xyXG5cdFx0VHJuZj86IHsgeHg6IG51bWJlcjsgeHk6IG51bWJlcjsgeXg6IG51bWJlcjsgeXk6IG51bWJlcjsgdHg6IG51bWJlcjsgdHk6IG51bWJlcjsgfSxcclxuXHRcdGtleU9yaWdpbkluZGV4OiBudW1iZXI7XHJcblx0fVtdO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCd2b2drJyxcclxuXHRoYXNLZXkoJ3ZlY3Rvck9yaWdpbmF0aW9uJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZEludDMyKHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB2b2drIHZlcnNpb25gKTtcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBWb2drRGVzY3JpcHRvcjtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdHRhcmdldC52ZWN0b3JPcmlnaW5hdGlvbiA9IHsga2V5RGVzY3JpcHRvckxpc3Q6IFtdIH07XHJcblxyXG5cdFx0Zm9yIChjb25zdCBpIG9mIGRlc2Mua2V5RGVzY3JpcHRvckxpc3QpIHtcclxuXHRcdFx0Y29uc3QgaXRlbTogS2V5RGVzY3JpcHRvckl0ZW0gPSB7fTtcclxuXHJcblx0XHRcdGlmIChpLmtleVNoYXBlSW52YWxpZGF0ZWQgIT0gbnVsbCkgaXRlbS5rZXlTaGFwZUludmFsaWRhdGVkID0gaS5rZXlTaGFwZUludmFsaWRhdGVkO1xyXG5cdFx0XHRpZiAoaS5rZXlPcmlnaW5UeXBlICE9IG51bGwpIGl0ZW0ua2V5T3JpZ2luVHlwZSA9IGkua2V5T3JpZ2luVHlwZTtcclxuXHRcdFx0aWYgKGkua2V5T3JpZ2luUmVzb2x1dGlvbiAhPSBudWxsKSBpdGVtLmtleU9yaWdpblJlc29sdXRpb24gPSBpLmtleU9yaWdpblJlc29sdXRpb247XHJcblx0XHRcdGlmIChpLmtleU9yaWdpblNoYXBlQkJveCkge1xyXG5cdFx0XHRcdGl0ZW0ua2V5T3JpZ2luU2hhcGVCb3VuZGluZ0JveCA9IHtcclxuXHRcdFx0XHRcdHRvcDogcGFyc2VVbml0cyhpLmtleU9yaWdpblNoYXBlQkJveFsnVG9wICddKSxcclxuXHRcdFx0XHRcdGxlZnQ6IHBhcnNlVW5pdHMoaS5rZXlPcmlnaW5TaGFwZUJCb3guTGVmdCksXHJcblx0XHRcdFx0XHRib3R0b206IHBhcnNlVW5pdHMoaS5rZXlPcmlnaW5TaGFwZUJCb3guQnRvbSksXHJcblx0XHRcdFx0XHRyaWdodDogcGFyc2VVbml0cyhpLmtleU9yaWdpblNoYXBlQkJveC5SZ2h0KSxcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHJlY3RSYWRpaSA9IGkua2V5T3JpZ2luUlJlY3RSYWRpaTtcclxuXHRcdFx0aWYgKHJlY3RSYWRpaSkge1xyXG5cdFx0XHRcdGl0ZW0ua2V5T3JpZ2luUlJlY3RSYWRpaSA9IHtcclxuXHRcdFx0XHRcdHRvcFJpZ2h0OiBwYXJzZVVuaXRzKHJlY3RSYWRpaS50b3BSaWdodCksXHJcblx0XHRcdFx0XHR0b3BMZWZ0OiBwYXJzZVVuaXRzKHJlY3RSYWRpaS50b3BMZWZ0KSxcclxuXHRcdFx0XHRcdGJvdHRvbUxlZnQ6IHBhcnNlVW5pdHMocmVjdFJhZGlpLmJvdHRvbUxlZnQpLFxyXG5cdFx0XHRcdFx0Ym90dG9tUmlnaHQ6IHBhcnNlVW5pdHMocmVjdFJhZGlpLmJvdHRvbVJpZ2h0KSxcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGNvcm5lcnMgPSBpLmtleU9yaWdpbkJveENvcm5lcnM7XHJcblx0XHRcdGlmIChjb3JuZXJzKSB7XHJcblx0XHRcdFx0aXRlbS5rZXlPcmlnaW5Cb3hDb3JuZXJzID0gW1xyXG5cdFx0XHRcdFx0eyB4OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckEuSHJ6biwgeTogY29ybmVycy5yZWN0YW5nbGVDb3JuZXJBLlZydGMgfSxcclxuXHRcdFx0XHRcdHsgeDogY29ybmVycy5yZWN0YW5nbGVDb3JuZXJCLkhyem4sIHk6IGNvcm5lcnMucmVjdGFuZ2xlQ29ybmVyQi5WcnRjIH0sXHJcblx0XHRcdFx0XHR7IHg6IGNvcm5lcnMucmVjdGFuZ2xlQ29ybmVyQy5IcnpuLCB5OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckMuVnJ0YyB9LFxyXG5cdFx0XHRcdFx0eyB4OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckQuSHJ6biwgeTogY29ybmVycy5yZWN0YW5nbGVDb3JuZXJELlZydGMgfSxcclxuXHRcdFx0XHRdO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHRybmYgPSBpLlRybmY7XHJcblx0XHRcdGlmICh0cm5mKSB7XHJcblx0XHRcdFx0aXRlbS50cmFuc2Zvcm0gPSBbdHJuZi54eCwgdHJuZi54eSwgdHJuZi54eSwgdHJuZi55eSwgdHJuZi50eCwgdHJuZi50eV07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRhcmdldC52ZWN0b3JPcmlnaW5hdGlvbi5rZXlEZXNjcmlwdG9yTGlzdC5wdXNoKGl0ZW0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldDtcclxuXHRcdGNvbnN0IG9yaWcgPSB0YXJnZXQudmVjdG9yT3JpZ2luYXRpb24hO1xyXG5cdFx0Y29uc3QgZGVzYzogVm9na0Rlc2NyaXB0b3IgPSB7IGtleURlc2NyaXB0b3JMaXN0OiBbXSB9O1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgb3JpZy5rZXlEZXNjcmlwdG9yTGlzdC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRjb25zdCBpdGVtID0gb3JpZy5rZXlEZXNjcmlwdG9yTGlzdFtpXTtcclxuXHJcblx0XHRcdGlmIChpdGVtLmtleVNoYXBlSW52YWxpZGF0ZWQpIHtcclxuXHRcdFx0XHRkZXNjLmtleURlc2NyaXB0b3JMaXN0LnB1c2goeyBrZXlTaGFwZUludmFsaWRhdGVkOiB0cnVlLCBrZXlPcmlnaW5JbmRleDogaSB9KTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRkZXNjLmtleURlc2NyaXB0b3JMaXN0LnB1c2goe1xyXG5cdFx0XHRcdFx0a2V5T3JpZ2luVHlwZTogaXRlbS5rZXlPcmlnaW5UeXBlID8/IDQsXHJcblx0XHRcdFx0XHRrZXlPcmlnaW5SZXNvbHV0aW9uOiBpdGVtLmtleU9yaWdpblJlc29sdXRpb24gPz8gNzIsXHJcblx0XHRcdFx0fSBhcyBhbnkpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBvdXQgPSBkZXNjLmtleURlc2NyaXB0b3JMaXN0W2Rlc2Mua2V5RGVzY3JpcHRvckxpc3QubGVuZ3RoIC0gMV07XHJcblxyXG5cdFx0XHRcdGNvbnN0IHJhZGlpID0gaXRlbS5rZXlPcmlnaW5SUmVjdFJhZGlpO1xyXG5cdFx0XHRcdGlmIChyYWRpaSkge1xyXG5cdFx0XHRcdFx0b3V0LmtleU9yaWdpblJSZWN0UmFkaWkgPSB7XHJcblx0XHRcdFx0XHRcdHVuaXRWYWx1ZVF1YWRWZXJzaW9uOiAxLFxyXG5cdFx0XHRcdFx0XHR0b3BSaWdodDogdW5pdHNWYWx1ZShyYWRpaS50b3BSaWdodCwgJ3RvcFJpZ2h0JyksXHJcblx0XHRcdFx0XHRcdHRvcExlZnQ6IHVuaXRzVmFsdWUocmFkaWkudG9wTGVmdCwgJ3RvcExlZnQnKSxcclxuXHRcdFx0XHRcdFx0Ym90dG9tTGVmdDogdW5pdHNWYWx1ZShyYWRpaS5ib3R0b21MZWZ0LCAnYm90dG9tTGVmdCcpLFxyXG5cdFx0XHRcdFx0XHRib3R0b21SaWdodDogdW5pdHNWYWx1ZShyYWRpaS5ib3R0b21SaWdodCwgJ2JvdHRvbVJpZ2h0JyksXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgYm94ID0gaXRlbS5rZXlPcmlnaW5TaGFwZUJvdW5kaW5nQm94O1xyXG5cdFx0XHRcdGlmIChib3gpIHtcclxuXHRcdFx0XHRcdG91dC5rZXlPcmlnaW5TaGFwZUJCb3ggPSB7XHJcblx0XHRcdFx0XHRcdHVuaXRWYWx1ZVF1YWRWZXJzaW9uOiAxLFxyXG5cdFx0XHRcdFx0XHQnVG9wICc6IHVuaXRzVmFsdWUoYm94LnRvcCwgJ3RvcCcpLFxyXG5cdFx0XHRcdFx0XHRMZWZ0OiB1bml0c1ZhbHVlKGJveC5sZWZ0LCAnbGVmdCcpLFxyXG5cdFx0XHRcdFx0XHRCdG9tOiB1bml0c1ZhbHVlKGJveC5ib3R0b20sICdib3R0b20nKSxcclxuXHRcdFx0XHRcdFx0UmdodDogdW5pdHNWYWx1ZShib3gucmlnaHQsICdyaWdodCcpLFxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IGNvcm5lcnMgPSBpdGVtLmtleU9yaWdpbkJveENvcm5lcnM7XHJcblx0XHRcdFx0aWYgKGNvcm5lcnMgJiYgY29ybmVycy5sZW5ndGggPT09IDQpIHtcclxuXHRcdFx0XHRcdG91dC5rZXlPcmlnaW5Cb3hDb3JuZXJzID0ge1xyXG5cdFx0XHRcdFx0XHRyZWN0YW5nbGVDb3JuZXJBOiB7IEhyem46IGNvcm5lcnNbMF0ueCwgVnJ0YzogY29ybmVyc1swXS55IH0sXHJcblx0XHRcdFx0XHRcdHJlY3RhbmdsZUNvcm5lckI6IHsgSHJ6bjogY29ybmVyc1sxXS54LCBWcnRjOiBjb3JuZXJzWzFdLnkgfSxcclxuXHRcdFx0XHRcdFx0cmVjdGFuZ2xlQ29ybmVyQzogeyBIcnpuOiBjb3JuZXJzWzJdLngsIFZydGM6IGNvcm5lcnNbMl0ueSB9LFxyXG5cdFx0XHRcdFx0XHRyZWN0YW5nbGVDb3JuZXJEOiB7IEhyem46IGNvcm5lcnNbM10ueCwgVnJ0YzogY29ybmVyc1szXS55IH0sXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgdHJhbnNmb3JtID0gaXRlbS50cmFuc2Zvcm07XHJcblx0XHRcdFx0aWYgKHRyYW5zZm9ybSAmJiB0cmFuc2Zvcm0ubGVuZ3RoID09PSA2KSB7XHJcblx0XHRcdFx0XHRvdXQuVHJuZiA9IHtcclxuXHRcdFx0XHRcdFx0eHg6IHRyYW5zZm9ybVswXSxcclxuXHRcdFx0XHRcdFx0eHk6IHRyYW5zZm9ybVsxXSxcclxuXHRcdFx0XHRcdFx0eXg6IHRyYW5zZm9ybVsyXSxcclxuXHRcdFx0XHRcdFx0eXk6IHRyYW5zZm9ybVszXSxcclxuXHRcdFx0XHRcdFx0dHg6IHRyYW5zZm9ybVs0XSxcclxuXHRcdFx0XHRcdFx0dHk6IHRyYW5zZm9ybVs1XSxcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRvdXQua2V5T3JpZ2luSW5kZXggPSBpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0fVxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbG1meCcsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC5lZmZlY3RzICE9PSB1bmRlZmluZWQgJiYgaGFzTXVsdGlFZmZlY3RzKHRhcmdldC5lZmZlY3RzKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIF8sIG9wdGlvbnMpID0+IHtcclxuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRpZiAodmVyc2lvbiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxtZnggdmVyc2lvbicpO1xyXG5cclxuXHRcdGNvbnN0IGRlc2M6IExtZnhEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChpbmZvLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHQvLyBkaXNjYXJkIGlmIHJlYWQgaW4gJ2xyRlgnIG9yICdsZngyJyBzZWN0aW9uXHJcblx0XHR0YXJnZXQuZWZmZWN0cyA9IHBhcnNlRWZmZWN0cyhkZXNjLCAhIW9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gc2VyaWFsaXplRWZmZWN0cyh0YXJnZXQuZWZmZWN0cyEsICEhb3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMsIHRydWUpO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbHJGWCcsXHJcblx0aGFzS2V5KCdlZmZlY3RzJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAoIXRhcmdldC5lZmZlY3RzKSB0YXJnZXQuZWZmZWN0cyA9IHJlYWRFZmZlY3RzKHJlYWRlcik7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVFZmZlY3RzKHdyaXRlciwgdGFyZ2V0LmVmZmVjdHMhKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbHVuaScsXHJcblx0aGFzS2V5KCduYW1lJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQubmFtZSA9IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCB0YXJnZXQubmFtZSEpO1xyXG5cdFx0Ly8gd3JpdGVVaW50MTYod3JpdGVyLCAwKTsgLy8gcGFkZGluZyAoYnV0IG5vdCBleHRlbmRpbmcgc3RyaW5nIGxlbmd0aClcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbG5zcicsXHJcblx0aGFzS2V5KCduYW1lU291cmNlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQubmFtZVNvdXJjZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdGFyZ2V0Lm5hbWVTb3VyY2UhKSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2x5aWQnLFxyXG5cdGhhc0tleSgnaWQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5pZCA9IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHQod3JpdGVyLCB0YXJnZXQsIF9wc2QsIG9wdGlvbnMpID0+IHtcclxuXHRcdGxldCBpZCA9IHRhcmdldC5pZCE7XHJcblx0XHR3aGlsZSAob3B0aW9ucy5sYXllcklkcy5pbmRleE9mKGlkKSAhPT0gLTEpIGlkICs9IDEwMDsgLy8gbWFrZSBzdXJlIHdlIGRvbid0IGhhdmUgZHVwbGljYXRlIGxheWVyIGlkc1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpZCk7XHJcblx0XHRvcHRpb25zLmxheWVySWRzLnB1c2goaWQpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsc2N0JyxcclxuXHRoYXNLZXkoJ3NlY3Rpb25EaXZpZGVyJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuc2VjdGlvbkRpdmlkZXIgPSB7IHR5cGU6IHJlYWRVaW50MzIocmVhZGVyKSB9O1xyXG5cclxuXHRcdGlmIChsZWZ0KCkpIHtcclxuXHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0XHR0YXJnZXQuc2VjdGlvbkRpdmlkZXIua2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0KCkpIHtcclxuXHRcdFx0Ly8gMCA9IG5vcm1hbFxyXG5cdFx0XHQvLyAxID0gc2NlbmUgZ3JvdXAsIGFmZmVjdHMgdGhlIGFuaW1hdGlvbiB0aW1lbGluZS5cclxuXHRcdFx0dGFyZ2V0LnNlY3Rpb25EaXZpZGVyLnN1YlR5cGUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHR9XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS50eXBlKTtcclxuXHJcblx0XHRpZiAodGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5rZXkpIHtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHRhcmdldC5zZWN0aW9uRGl2aWRlciEua2V5KTtcclxuXHJcblx0XHRcdGlmICh0YXJnZXQuc2VjdGlvbkRpdmlkZXIhLnN1YlR5cGUgIT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgdGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5zdWJUeXBlKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcblxyXG4vLyBpdCBzZWVtcyBsc2RrIGlzIHVzZWQgd2hlbiB0aGVyZSdzIGEgbGF5ZXIgaXMgbmVzdGVkIG1vcmUgdGhhbiA2IGxldmVscywgYnV0IEkgZG9uJ3Qga25vdyB3aHk/XHJcbi8vIG1heWJlIHNvbWUgbGltaXRhdGlvbiBvZiBvbGQgdmVyc2lvbiBvZiBQUz9cclxuYWRkSGFuZGxlckFsaWFzKCdsc2RrJywgJ2xzY3QnKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2NsYmwnLFxyXG5cdGhhc0tleSgnYmxlbmRDbGlwcGVuZEVsZW1lbnRzJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQuYmxlbmRDbGlwcGVuZEVsZW1lbnRzID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDMpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgdGFyZ2V0LmJsZW5kQ2xpcHBlbmRFbGVtZW50cyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnaW5meCcsXHJcblx0aGFzS2V5KCdibGVuZEludGVyaW9yRWxlbWVudHMnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5ibGVuZEludGVyaW9yRWxlbWVudHMgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQuYmxlbmRJbnRlcmlvckVsZW1lbnRzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdrbmtvJyxcclxuXHRoYXNLZXkoJ2tub2Nrb3V0JyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQua25vY2tvdXQgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQua25vY2tvdXQgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2xzcGYnLFxyXG5cdGhhc0tleSgncHJvdGVjdGVkJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdHRhcmdldC5wcm90ZWN0ZWQgPSB7XHJcblx0XHRcdHRyYW5zcGFyZW5jeTogKGZsYWdzICYgMHgwMSkgIT09IDAsXHJcblx0XHRcdGNvbXBvc2l0ZTogKGZsYWdzICYgMHgwMikgIT09IDAsXHJcblx0XHRcdHBvc2l0aW9uOiAoZmxhZ3MgJiAweDA0KSAhPT0gMCxcclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKGZsYWdzICYgMHgwOCkgdGFyZ2V0LnByb3RlY3RlZC5hcnRib2FyZHMgPSB0cnVlO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBmbGFncyA9XHJcblx0XHRcdCh0YXJnZXQucHJvdGVjdGVkIS50cmFuc3BhcmVuY3kgPyAweDAxIDogMCkgfFxyXG5cdFx0XHQodGFyZ2V0LnByb3RlY3RlZCEuY29tcG9zaXRlID8gMHgwMiA6IDApIHxcclxuXHRcdFx0KHRhcmdldC5wcm90ZWN0ZWQhLnBvc2l0aW9uID8gMHgwNCA6IDApIHxcclxuXHRcdFx0KHRhcmdldC5wcm90ZWN0ZWQhLmFydGJvYXJkcyA/IDB4MDggOiAwKTtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGZsYWdzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbGNscicsXHJcblx0aGFzS2V5KCdsYXllckNvbG9yJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBjb2xvciA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDYpO1xyXG5cdFx0dGFyZ2V0LmxheWVyQ29sb3IgPSBsYXllckNvbG9yc1tjb2xvcl07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZGV4ID0gbGF5ZXJDb2xvcnMuaW5kZXhPZih0YXJnZXQubGF5ZXJDb2xvciEpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmRleCA9PT0gLTEgPyAwIDogaW5kZXgpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDYpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5pbnRlcmZhY2UgQ3VzdG9tRGVzY3JpcHRvciB7XHJcblx0bGF5ZXJUaW1lPzogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRnJhbWVMaXN0RGVzY3JpcHRvciB7XHJcblx0TGFJRDogbnVtYmVyO1xyXG5cdExhU3Q6IHtcclxuXHRcdGVuYWI/OiBib29sZWFuO1xyXG5cdFx0SU1zaz86IHsgT2ZzdDogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfSB9O1xyXG5cdFx0Vk1zaz86IHsgT2ZzdDogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfSB9O1xyXG5cdFx0RlhSZj86IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0XHRGckxzOiBudW1iZXJbXTtcclxuXHR9W107XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3NobWQnLFxyXG5cdGhhc0tleSgndGltZXN0YW1wJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBjb3VudCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcclxuXHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0XHRjb25zdCBrZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdHJlYWRVaW50OChyZWFkZXIpOyAvLyBjb3B5XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDMpO1xyXG5cclxuXHRcdFx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcclxuXHRcdFx0XHRpZiAoa2V5ID09PSAnY3VzdCcpIHtcclxuXHRcdFx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBDdXN0b21EZXNjcmlwdG9yO1xyXG5cdFx0XHRcdFx0aWYgKGRlc2MubGF5ZXJUaW1lICE9PSB1bmRlZmluZWQpIHRhcmdldC50aW1lc3RhbXAgPSBkZXNjLmxheWVyVGltZTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21sc3QnKSB7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgRnJhbWVMaXN0RGVzY3JpcHRvcjtcclxuXHRcdFx0XHRcdG9wdGlvbnMubG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21sc3QnLCBkZXNjKTtcclxuXHRcdFx0XHRcdC8vIG9wdGlvbnMubG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21sc3QnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ21keW4nKSB7XHJcblx0XHRcdFx0XHQvLyBmcmFtZSBmbGFnc1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5rbm93biA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdFx0XHRcdGNvbnN0IHByb3BhZ2F0ZSA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdFx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRcdGNvbnN0IHVuaWZ5TGF5ZXJQb3NpdGlvbiA9IChmbGFncyAmIDEpICE9PSAwO1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5pZnlMYXllclN0eWxlID0gKGZsYWdzICYgMikgIT09IDA7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlmeUxheWVyVmlzaWJpbGl0eSA9IChmbGFncyAmIDQpICE9PSAwO1xyXG5cdFx0XHRcdFx0b3B0aW9ucy5sb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZyhcclxuXHRcdFx0XHRcdFx0J21keW4nLCAndW5rbm93bjonLCB1bmtub3duLCAncHJvcGFnYXRlOicsIHByb3BhZ2F0ZSxcclxuXHRcdFx0XHRcdFx0J2ZsYWdzOicsIGZsYWdzLCB7IHVuaWZ5TGF5ZXJQb3NpdGlvbiwgdW5pZnlMYXllclN0eWxlLCB1bmlmeUxheWVyVmlzaWJpbGl0eSB9KTtcclxuXHJcblx0XHRcdFx0XHQvLyBjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgRnJhbWVMaXN0RGVzY3JpcHRvcjtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdtZHluJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG9wdGlvbnMubG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ1VuaGFuZGxlZCBtZXRhZGF0YScsIGtleSk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBDdXN0b21EZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRsYXllclRpbWU6IHRhcmdldC50aW1lc3RhbXAhLFxyXG5cdFx0fTtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDEpOyAvLyBjb3VudFxyXG5cclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ2N1c3QnKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTsgLy8gY29weSAoYWx3YXlzIGZhbHNlKVxyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xyXG5cdFx0d3JpdGVTZWN0aW9uKHdyaXRlciwgMiwgKCkgPT4gd3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbWV0YWRhdGEnLCBkZXNjKSwgdHJ1ZSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3ZzdGsnLFxyXG5cdGhhc0tleSgndmVjdG9yU3Ryb2tlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgU3Ryb2tlRGVzY3JpcHRvcjtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdHRhcmdldC52ZWN0b3JTdHJva2UgPSB7XHJcblx0XHRcdHN0cm9rZUVuYWJsZWQ6IGRlc2Muc3Ryb2tlRW5hYmxlZCxcclxuXHRcdFx0ZmlsbEVuYWJsZWQ6IGRlc2MuZmlsbEVuYWJsZWQsXHJcblx0XHRcdGxpbmVXaWR0aDogcGFyc2VVbml0cyhkZXNjLnN0cm9rZVN0eWxlTGluZVdpZHRoKSxcclxuXHRcdFx0bGluZURhc2hPZmZzZXQ6IHBhcnNlVW5pdHMoZGVzYy5zdHJva2VTdHlsZUxpbmVEYXNoT2Zmc2V0KSxcclxuXHRcdFx0bWl0ZXJMaW1pdDogZGVzYy5zdHJva2VTdHlsZU1pdGVyTGltaXQsXHJcblx0XHRcdGxpbmVDYXBUeXBlOiBzdHJva2VTdHlsZUxpbmVDYXBUeXBlLmRlY29kZShkZXNjLnN0cm9rZVN0eWxlTGluZUNhcFR5cGUpLFxyXG5cdFx0XHRsaW5lSm9pblR5cGU6IHN0cm9rZVN0eWxlTGluZUpvaW5UeXBlLmRlY29kZShkZXNjLnN0cm9rZVN0eWxlTGluZUpvaW5UeXBlKSxcclxuXHRcdFx0bGluZUFsaWdubWVudDogc3Ryb2tlU3R5bGVMaW5lQWxpZ25tZW50LmRlY29kZShkZXNjLnN0cm9rZVN0eWxlTGluZUFsaWdubWVudCksXHJcblx0XHRcdHNjYWxlTG9jazogZGVzYy5zdHJva2VTdHlsZVNjYWxlTG9jayxcclxuXHRcdFx0c3Ryb2tlQWRqdXN0OiBkZXNjLnN0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0LFxyXG5cdFx0XHRsaW5lRGFzaFNldDogZGVzYy5zdHJva2VTdHlsZUxpbmVEYXNoU2V0Lm1hcChwYXJzZVVuaXRzKSxcclxuXHRcdFx0YmxlbmRNb2RlOiBCbG5NLmRlY29kZShkZXNjLnN0cm9rZVN0eWxlQmxlbmRNb2RlKSxcclxuXHRcdFx0b3BhY2l0eTogcGFyc2VQZXJjZW50KGRlc2Muc3Ryb2tlU3R5bGVPcGFjaXR5KSxcclxuXHRcdFx0Y29udGVudDogcGFyc2VWZWN0b3JDb250ZW50KGRlc2Muc3Ryb2tlU3R5bGVDb250ZW50KSxcclxuXHRcdFx0cmVzb2x1dGlvbjogZGVzYy5zdHJva2VTdHlsZVJlc29sdXRpb24sXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHN0cm9rZSA9IHRhcmdldC52ZWN0b3JTdHJva2UhO1xyXG5cdFx0Y29uc3QgZGVzY3JpcHRvcjogU3Ryb2tlRGVzY3JpcHRvciA9IHtcclxuXHRcdFx0c3Ryb2tlU3R5bGVWZXJzaW9uOiAyLFxyXG5cdFx0XHRzdHJva2VFbmFibGVkOiAhIXN0cm9rZS5zdHJva2VFbmFibGVkLFxyXG5cdFx0XHRmaWxsRW5hYmxlZDogISFzdHJva2UuZmlsbEVuYWJsZWQsXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZVdpZHRoOiBzdHJva2UubGluZVdpZHRoIHx8IHsgdmFsdWU6IDMsIHVuaXRzOiAnUG9pbnRzJyB9LFxyXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVEYXNoT2Zmc2V0OiBzdHJva2UubGluZURhc2hPZmZzZXQgfHwgeyB2YWx1ZTogMCwgdW5pdHM6ICdQb2ludHMnIH0sXHJcblx0XHRcdHN0cm9rZVN0eWxlTWl0ZXJMaW1pdDogc3Ryb2tlLm1pdGVyTGltaXQgPz8gMTAwLFxyXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVDYXBUeXBlOiBzdHJva2VTdHlsZUxpbmVDYXBUeXBlLmVuY29kZShzdHJva2UubGluZUNhcFR5cGUpLFxyXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVKb2luVHlwZTogc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUuZW5jb2RlKHN0cm9rZS5saW5lSm9pblR5cGUpLFxyXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQ6IHN0cm9rZVN0eWxlTGluZUFsaWdubWVudC5lbmNvZGUoc3Ryb2tlLmxpbmVBbGlnbm1lbnQpLFxyXG5cdFx0XHRzdHJva2VTdHlsZVNjYWxlTG9jazogISFzdHJva2Uuc2NhbGVMb2NrLFxyXG5cdFx0XHRzdHJva2VTdHlsZVN0cm9rZUFkanVzdDogISFzdHJva2Uuc3Ryb2tlQWRqdXN0LFxyXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVEYXNoU2V0OiBzdHJva2UubGluZURhc2hTZXQgfHwgW10sXHJcblx0XHRcdHN0cm9rZVN0eWxlQmxlbmRNb2RlOiBCbG5NLmVuY29kZShzdHJva2UuYmxlbmRNb2RlKSxcclxuXHRcdFx0c3Ryb2tlU3R5bGVPcGFjaXR5OiB1bml0c1BlcmNlbnQoc3Ryb2tlLm9wYWNpdHkgPz8gMSksXHJcblx0XHRcdHN0cm9rZVN0eWxlQ29udGVudDogc2VyaWFsaXplVmVjdG9yQ29udGVudChcclxuXHRcdFx0XHRzdHJva2UuY29udGVudCB8fCB7IHR5cGU6ICdjb2xvcicsIGNvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDAgfSB9KS5kZXNjcmlwdG9yLFxyXG5cdFx0XHRzdHJva2VTdHlsZVJlc29sdXRpb246IHN0cm9rZS5yZXNvbHV0aW9uID8/IDcyLFxyXG5cdFx0fTtcclxuXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdzdHJva2VTdHlsZScsIGRlc2NyaXB0b3IpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5pbnRlcmZhY2UgQXJ0YkRlc2NyaXB0b3Ige1xyXG5cdGFydGJvYXJkUmVjdDogeyAnVG9wICc6IG51bWJlcjsgTGVmdDogbnVtYmVyOyBCdG9tOiBudW1iZXI7IFJnaHQ6IG51bWJlcjsgfTtcclxuXHRndWlkZUluZGVjZXM6IGFueVtdO1xyXG5cdGFydGJvYXJkUHJlc2V0TmFtZTogc3RyaW5nO1xyXG5cdCdDbHIgJzogRGVzY3JpcHRvckNvbG9yO1xyXG5cdGFydGJvYXJkQmFja2dyb3VuZFR5cGU6IG51bWJlcjtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnYXJ0YicsIC8vIHBlci1sYXllciBhcmJvYXJkIGluZm9cclxuXHRoYXNLZXkoJ2FydGJvYXJkJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgQXJ0YkRlc2NyaXB0b3I7XHJcblx0XHRjb25zdCByZWN0ID0gZGVzYy5hcnRib2FyZFJlY3Q7XHJcblx0XHR0YXJnZXQuYXJ0Ym9hcmQgPSB7XHJcblx0XHRcdHJlY3Q6IHsgdG9wOiByZWN0WydUb3AgJ10sIGxlZnQ6IHJlY3QuTGVmdCwgYm90dG9tOiByZWN0LkJ0b20sIHJpZ2h0OiByZWN0LlJnaHQgfSxcclxuXHRcdFx0Z3VpZGVJbmRpY2VzOiBkZXNjLmd1aWRlSW5kZWNlcyxcclxuXHRcdFx0cHJlc2V0TmFtZTogZGVzYy5hcnRib2FyZFByZXNldE5hbWUsXHJcblx0XHRcdGNvbG9yOiBwYXJzZUNvbG9yKGRlc2NbJ0NsciAnXSksXHJcblx0XHRcdGJhY2tncm91bmRUeXBlOiBkZXNjLmFydGJvYXJkQmFja2dyb3VuZFR5cGUsXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGFydGJvYXJkID0gdGFyZ2V0LmFydGJvYXJkITtcclxuXHRcdGNvbnN0IHJlY3QgPSBhcnRib2FyZC5yZWN0O1xyXG5cdFx0Y29uc3QgZGVzYzogQXJ0YkRlc2NyaXB0b3IgPSB7XHJcblx0XHRcdGFydGJvYXJkUmVjdDogeyAnVG9wICc6IHJlY3QudG9wLCBMZWZ0OiByZWN0LmxlZnQsIEJ0b206IHJlY3QuYm90dG9tLCBSZ2h0OiByZWN0LnJpZ2h0IH0sXHJcblx0XHRcdGd1aWRlSW5kZWNlczogYXJ0Ym9hcmQuZ3VpZGVJbmRpY2VzIHx8IFtdLFxyXG5cdFx0XHRhcnRib2FyZFByZXNldE5hbWU6IGFydGJvYXJkLnByZXNldE5hbWUgfHwgJycsXHJcblx0XHRcdCdDbHIgJzogc2VyaWFsaXplQ29sb3IoYXJ0Ym9hcmQuY29sb3IpLFxyXG5cdFx0XHRhcnRib2FyZEJhY2tncm91bmRUeXBlOiBhcnRib2FyZC5iYWNrZ3JvdW5kVHlwZSA/PyAxLFxyXG5cdFx0fTtcclxuXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdhcnRib2FyZCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdzbjJQJyxcclxuXHRoYXNLZXkoJ3VzaW5nQWxpZ25lZFJlbmRlcmluZycpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LnVzaW5nQWxpZ25lZFJlbmRlcmluZyA9ICEhcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQudXNpbmdBbGlnbmVkUmVuZGVyaW5nID8gMSA6IDApLFxyXG4pO1xyXG5cclxuY29uc3QgcGxhY2VkTGF5ZXJUeXBlczogUGxhY2VkTGF5ZXJUeXBlW10gPSBbJ3Vua25vd24nLCAndmVjdG9yJywgJ3Jhc3RlcicsICdpbWFnZSBzdGFjayddO1xyXG5cclxuZnVuY3Rpb24gcGFyc2VXYXJwKHdhcnA6IFdhcnBEZXNjcmlwdG9yICYgUXVpbHRXYXJwRGVzY3JpcHRvcik6IFdhcnAge1xyXG5cdGNvbnN0IHJlc3VsdDogV2FycCA9IHtcclxuXHRcdHN0eWxlOiB3YXJwU3R5bGUuZGVjb2RlKHdhcnAud2FycFN0eWxlKSxcclxuXHRcdHZhbHVlOiB3YXJwLndhcnBWYWx1ZSB8fCAwLFxyXG5cdFx0cGVyc3BlY3RpdmU6IHdhcnAud2FycFBlcnNwZWN0aXZlIHx8IDAsXHJcblx0XHRwZXJzcGVjdGl2ZU90aGVyOiB3YXJwLndhcnBQZXJzcGVjdGl2ZU90aGVyIHx8IDAsXHJcblx0XHRyb3RhdGU6IE9ybnQuZGVjb2RlKHdhcnAud2FycFJvdGF0ZSksXHJcblx0XHRib3VuZHM6IHdhcnAuYm91bmRzICYmIHtcclxuXHRcdFx0dG9wOiBwYXJzZVVuaXRzT3JOdW1iZXIod2FycC5ib3VuZHNbJ1RvcCAnXSksXHJcblx0XHRcdGxlZnQ6IHBhcnNlVW5pdHNPck51bWJlcih3YXJwLmJvdW5kcy5MZWZ0KSxcclxuXHRcdFx0Ym90dG9tOiBwYXJzZVVuaXRzT3JOdW1iZXIod2FycC5ib3VuZHMuQnRvbSksXHJcblx0XHRcdHJpZ2h0OiBwYXJzZVVuaXRzT3JOdW1iZXIod2FycC5ib3VuZHMuUmdodCksXHJcblx0XHR9LFxyXG5cdFx0dU9yZGVyOiB3YXJwLnVPcmRlcixcclxuXHRcdHZPcmRlcjogd2FycC52T3JkZXIsXHJcblx0fTtcclxuXHJcblx0aWYgKHdhcnAuZGVmb3JtTnVtUm93cyAhPSBudWxsIHx8IHdhcnAuZGVmb3JtTnVtQ29scyAhPSBudWxsKSB7XHJcblx0XHRyZXN1bHQuZGVmb3JtTnVtUm93cyA9IHdhcnAuZGVmb3JtTnVtUm93cztcclxuXHRcdHJlc3VsdC5kZWZvcm1OdW1Db2xzID0gd2FycC5kZWZvcm1OdW1Db2xzO1xyXG5cdH1cclxuXHJcblx0Y29uc3QgZW52ZWxvcGVXYXJwID0gd2FycC5jdXN0b21FbnZlbG9wZVdhcnA7XHJcblx0aWYgKGVudmVsb3BlV2FycCkge1xyXG5cdFx0cmVzdWx0LmN1c3RvbUVudmVsb3BlV2FycCA9IHtcclxuXHRcdFx0bWVzaFBvaW50czogW10sXHJcblx0XHR9O1xyXG5cclxuXHRcdGNvbnN0IHhzID0gZW52ZWxvcGVXYXJwLm1lc2hQb2ludHMuZmluZChpID0+IGkudHlwZSA9PT0gJ0hyem4nKT8udmFsdWVzIHx8IFtdO1xyXG5cdFx0Y29uc3QgeXMgPSBlbnZlbG9wZVdhcnAubWVzaFBvaW50cy5maW5kKGkgPT4gaS50eXBlID09PSAnVnJ0YycpPy52YWx1ZXMgfHwgW107XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRyZXN1bHQuY3VzdG9tRW52ZWxvcGVXYXJwIS5tZXNoUG9pbnRzLnB1c2goeyB4OiB4c1tpXSwgeTogeXNbaV0gfSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGVudmVsb3BlV2FycC5xdWlsdFNsaWNlWCB8fCBlbnZlbG9wZVdhcnAucXVpbHRTbGljZVkpIHtcclxuXHRcdFx0cmVzdWx0LmN1c3RvbUVudmVsb3BlV2FycC5xdWlsdFNsaWNlWCA9IGVudmVsb3BlV2FycC5xdWlsdFNsaWNlWD8uWzBdPy52YWx1ZXMgfHwgW107XHJcblx0XHRcdHJlc3VsdC5jdXN0b21FbnZlbG9wZVdhcnAucXVpbHRTbGljZVkgPSBlbnZlbG9wZVdhcnAucXVpbHRTbGljZVk/LlswXT8udmFsdWVzIHx8IFtdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNRdWlsdFdhcnAod2FycDogV2FycCkge1xyXG5cdHJldHVybiB3YXJwLmRlZm9ybU51bUNvbHMgIT0gbnVsbCB8fCB3YXJwLmRlZm9ybU51bVJvd3MgIT0gbnVsbCB8fFxyXG5cdFx0d2FycC5jdXN0b21FbnZlbG9wZVdhcnA/LnF1aWx0U2xpY2VYIHx8IHdhcnAuY3VzdG9tRW52ZWxvcGVXYXJwPy5xdWlsdFNsaWNlWTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW5jb2RlV2FycCh3YXJwOiBXYXJwKTogV2FycERlc2NyaXB0b3Ige1xyXG5cdGNvbnN0IGJvdW5kcyA9IHdhcnAuYm91bmRzO1xyXG5cdGNvbnN0IGRlc2M6IFdhcnBEZXNjcmlwdG9yID0ge1xyXG5cdFx0d2FycFN0eWxlOiB3YXJwU3R5bGUuZW5jb2RlKHdhcnAuc3R5bGUpLFxyXG5cdFx0d2FycFZhbHVlOiB3YXJwLnZhbHVlIHx8IDAsXHJcblx0XHR3YXJwUGVyc3BlY3RpdmU6IHdhcnAucGVyc3BlY3RpdmUgfHwgMCxcclxuXHRcdHdhcnBQZXJzcGVjdGl2ZU90aGVyOiB3YXJwLnBlcnNwZWN0aXZlT3RoZXIgfHwgMCxcclxuXHRcdHdhcnBSb3RhdGU6IE9ybnQuZW5jb2RlKHdhcnAucm90YXRlKSxcclxuXHRcdGJvdW5kczoge1xyXG5cdFx0XHQnVG9wICc6IHVuaXRzVmFsdWUoYm91bmRzICYmIGJvdW5kcy50b3AgfHwgeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiAwIH0sICdib3VuZHMudG9wJyksXHJcblx0XHRcdExlZnQ6IHVuaXRzVmFsdWUoYm91bmRzICYmIGJvdW5kcy5sZWZ0IHx8IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogMCB9LCAnYm91bmRzLmxlZnQnKSxcclxuXHRcdFx0QnRvbTogdW5pdHNWYWx1ZShib3VuZHMgJiYgYm91bmRzLmJvdHRvbSB8fCB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IDAgfSwgJ2JvdW5kcy5ib3R0b20nKSxcclxuXHRcdFx0UmdodDogdW5pdHNWYWx1ZShib3VuZHMgJiYgYm91bmRzLnJpZ2h0IHx8IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogMCB9LCAnYm91bmRzLnJpZ2h0JyksXHJcblx0XHR9LFxyXG5cdFx0dU9yZGVyOiB3YXJwLnVPcmRlciB8fCAwLFxyXG5cdFx0dk9yZGVyOiB3YXJwLnZPcmRlciB8fCAwLFxyXG5cdH07XHJcblxyXG5cdGNvbnN0IGlzUXVpbHQgPSBpc1F1aWx0V2FycCh3YXJwKTtcclxuXHJcblx0aWYgKGlzUXVpbHQpIHtcclxuXHRcdGNvbnN0IGRlc2MyID0gZGVzYyBhcyBRdWlsdFdhcnBEZXNjcmlwdG9yO1xyXG5cdFx0ZGVzYzIuZGVmb3JtTnVtUm93cyA9IHdhcnAuZGVmb3JtTnVtUm93cyB8fCAwO1xyXG5cdFx0ZGVzYzIuZGVmb3JtTnVtQ29scyA9IHdhcnAuZGVmb3JtTnVtQ29scyB8fCAwO1xyXG5cdH1cclxuXHJcblx0Y29uc3QgY3VzdG9tRW52ZWxvcGVXYXJwID0gd2FycC5jdXN0b21FbnZlbG9wZVdhcnA7XHJcblx0aWYgKGN1c3RvbUVudmVsb3BlV2FycCkge1xyXG5cdFx0Y29uc3QgbWVzaFBvaW50cyA9IGN1c3RvbUVudmVsb3BlV2FycC5tZXNoUG9pbnRzIHx8IFtdO1xyXG5cclxuXHRcdGlmIChpc1F1aWx0KSB7XHJcblx0XHRcdGNvbnN0IGRlc2MyID0gZGVzYyBhcyBRdWlsdFdhcnBEZXNjcmlwdG9yO1xyXG5cdFx0XHRkZXNjMi5jdXN0b21FbnZlbG9wZVdhcnAgPSB7XHJcblx0XHRcdFx0cXVpbHRTbGljZVg6IFt7XHJcblx0XHRcdFx0XHR0eXBlOiAncXVpbHRTbGljZVgnLFxyXG5cdFx0XHRcdFx0dmFsdWVzOiBjdXN0b21FbnZlbG9wZVdhcnAucXVpbHRTbGljZVggfHwgW10sXHJcblx0XHRcdFx0fV0sXHJcblx0XHRcdFx0cXVpbHRTbGljZVk6IFt7XHJcblx0XHRcdFx0XHR0eXBlOiAncXVpbHRTbGljZVknLFxyXG5cdFx0XHRcdFx0dmFsdWVzOiBjdXN0b21FbnZlbG9wZVdhcnAucXVpbHRTbGljZVkgfHwgW10sXHJcblx0XHRcdFx0fV0sXHJcblx0XHRcdFx0bWVzaFBvaW50czogW1xyXG5cdFx0XHRcdFx0eyB0eXBlOiAnSHJ6bicsIHZhbHVlczogbWVzaFBvaW50cy5tYXAocCA9PiBwLngpIH0sXHJcblx0XHRcdFx0XHR7IHR5cGU6ICdWcnRjJywgdmFsdWVzOiBtZXNoUG9pbnRzLm1hcChwID0+IHAueSkgfSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZGVzYy5jdXN0b21FbnZlbG9wZVdhcnAgPSB7XHJcblx0XHRcdFx0bWVzaFBvaW50czogW1xyXG5cdFx0XHRcdFx0eyB0eXBlOiAnSHJ6bicsIHZhbHVlczogbWVzaFBvaW50cy5tYXAocCA9PiBwLngpIH0sXHJcblx0XHRcdFx0XHR7IHR5cGU6ICdWcnRjJywgdmFsdWVzOiBtZXNoUG9pbnRzLm1hcChwID0+IHAueSkgfSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGRlc2M7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J1BsTGQnLFxyXG5cdGhhc0tleSgncGxhY2VkTGF5ZXInKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkU2lnbmF0dXJlKHJlYWRlcikgIT09ICdwbGNMJykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFBsTGQgc2lnbmF0dXJlYCk7XHJcblx0XHRpZiAocmVhZEludDMyKHJlYWRlcikgIT09IDMpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBQbExkIHZlcnNpb25gKTtcclxuXHRcdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cdFx0cmVhZEludDMyKHJlYWRlcik7IC8vIHBhZ2VOdW1iZXJcclxuXHRcdHJlYWRJbnQzMihyZWFkZXIpOyAvLyB0b3RhbFBhZ2VzLCBUT0RPOiBjaGVjayBob3cgdGhpcyB3b3JrcyA/XHJcblx0XHRyZWFkSW50MzIocmVhZGVyKTsgLy8gYW5pdEFsaWFzUG9saWN5IDE2XHJcblx0XHRjb25zdCBwbGFjZWRMYXllclR5cGUgPSByZWFkSW50MzIocmVhZGVyKTsgLy8gMCA9IHVua25vd24sIDEgPSB2ZWN0b3IsIDIgPSByYXN0ZXIsIDMgPSBpbWFnZSBzdGFja1xyXG5cdFx0aWYgKCFwbGFjZWRMYXllclR5cGVzW3BsYWNlZExheWVyVHlwZV0pIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQbExkIHR5cGUnKTtcclxuXHRcdGNvbnN0IHRyYW5zZm9ybTogbnVtYmVyW10gPSBbXTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB0cmFuc2Zvcm0ucHVzaChyZWFkRmxvYXQ2NChyZWFkZXIpKTsgLy8geCwgeSBvZiA0IGNvcm5lcnMgb2YgdGhlIHRyYW5zZm9ybVxyXG5cdFx0Y29uc3Qgd2FycFZlcnNpb24gPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdGlmICh3YXJwVmVyc2lvbiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFdhcnAgdmVyc2lvbiAke3dhcnBWZXJzaW9ufWApO1xyXG5cdFx0Y29uc3Qgd2FycDogV2FycERlc2NyaXB0b3IgJiBRdWlsdFdhcnBEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblxyXG5cdFx0dGFyZ2V0LnBsYWNlZExheWVyID0gdGFyZ2V0LnBsYWNlZExheWVyIHx8IHsgLy8gc2tpcCBpZiBTb0xkIGFscmVhZHkgc2V0IGl0XHJcblx0XHRcdGlkLFxyXG5cdFx0XHR0eXBlOiBwbGFjZWRMYXllclR5cGVzW3BsYWNlZExheWVyVHlwZV0sXHJcblx0XHRcdC8vIHBhZ2VOdW1iZXIsXHJcblx0XHRcdC8vIHRvdGFsUGFnZXMsXHJcblx0XHRcdHRyYW5zZm9ybSxcclxuXHRcdFx0d2FycDogcGFyc2VXYXJwKHdhcnApLFxyXG5cdFx0fTtcclxuXHJcblx0XHQvLyBjb25zb2xlLmxvZygnUGxMZCB3YXJwJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3Qod2FycCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnUGxMZCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHRhcmdldC5wbGFjZWRMYXllciwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgcGxhY2VkID0gdGFyZ2V0LnBsYWNlZExheWVyITtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ3BsY0wnKTtcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCAzKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyLCBwbGFjZWQuaWQsIDEpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDEpOyAvLyBwYWdlTnVtYmVyXHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgMSk7IC8vIHRvdGFsUGFnZXNcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCAxNik7IC8vIGFuaXRBbGlhc1BvbGljeVxyXG5cdFx0aWYgKHBsYWNlZExheWVyVHlwZXMuaW5kZXhPZihwbGFjZWQudHlwZSkgPT09IC0xKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGxhY2VkTGF5ZXIgdHlwZScpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIHBsYWNlZExheWVyVHlwZXMuaW5kZXhPZihwbGFjZWQudHlwZSkpO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA4OyBpKyspIHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHBsYWNlZC50cmFuc2Zvcm1baV0pO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDApOyAvLyB3YXJwIHZlcnNpb25cclxuXHRcdGNvbnN0IGlzUXVpbHQgPSBwbGFjZWQud2FycCAmJiBpc1F1aWx0V2FycChwbGFjZWQud2FycCk7XHJcblx0XHRjb25zdCB0eXBlID0gaXNRdWlsdCA/ICdxdWlsdFdhcnAnIDogJ3dhcnAnO1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCB0eXBlLCBlbmNvZGVXYXJwKHBsYWNlZC53YXJwIHx8IHt9KSwgdHlwZSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBTb0xkRGVzY3JpcHRvciB7XHJcblx0SWRudDogc3RyaW5nO1xyXG5cdHBsYWNlZDogc3RyaW5nO1xyXG5cdFBnTm06IG51bWJlcjtcclxuXHR0b3RhbFBhZ2VzOiBudW1iZXI7XHJcblx0Q3JvcD86IG51bWJlcjtcclxuXHRmcmFtZVN0ZXA6IHsgbnVtZXJhdG9yOiBudW1iZXI7IGRlbm9taW5hdG9yOiBudW1iZXI7IH07XHJcblx0ZHVyYXRpb246IHsgbnVtZXJhdG9yOiBudW1iZXI7IGRlbm9taW5hdG9yOiBudW1iZXI7IH07XHJcblx0ZnJhbWVDb3VudDogbnVtYmVyO1xyXG5cdEFubnQ6IG51bWJlcjtcclxuXHRUeXBlOiBudW1iZXI7XHJcblx0VHJuZjogbnVtYmVyW107XHJcblx0bm9uQWZmaW5lVHJhbnNmb3JtOiBudW1iZXJbXTtcclxuXHRxdWlsdFdhcnA/OiBRdWlsdFdhcnBEZXNjcmlwdG9yO1xyXG5cdHdhcnA6IFdhcnBEZXNjcmlwdG9yO1xyXG5cdCdTeiAgJzogeyBXZHRoOiBudW1iZXI7IEhnaHQ6IG51bWJlcjsgfTtcclxuXHRSc2x0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRjb21wPzogbnVtYmVyO1xyXG5cdGNvbXBJbmZvPzogeyBjb21wSUQ6IG51bWJlcjsgb3JpZ2luYWxDb21wSUQ6IG51bWJlcjsgfTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnU29MZCcsXHJcblx0aGFzS2V5KCdwbGFjZWRMYXllcicpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRTaWduYXR1cmUocmVhZGVyKSAhPT0gJ3NvTEQnKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgU29MZCB0eXBlYCk7XHJcblx0XHRpZiAocmVhZEludDMyKHJlYWRlcikgIT09IDQpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBTb0xkIHZlcnNpb25gKTtcclxuXHRcdGNvbnN0IGRlc2M6IFNvTGREZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnU29MZCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coJ1NvTGQud2FycCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2Mud2FycCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnU29MZC5xdWlsdFdhcnAnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLnF1aWx0V2FycCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0dGFyZ2V0LnBsYWNlZExheWVyID0ge1xyXG5cdFx0XHRpZDogZGVzYy5JZG50LFxyXG5cdFx0XHRwbGFjZWQ6IGRlc2MucGxhY2VkLFxyXG5cdFx0XHR0eXBlOiBwbGFjZWRMYXllclR5cGVzW2Rlc2MuVHlwZV0sXHJcblx0XHRcdC8vIHBhZ2VOdW1iZXI6IGluZm8uUGdObSxcclxuXHRcdFx0Ly8gdG90YWxQYWdlczogaW5mby50b3RhbFBhZ2VzLFxyXG5cdFx0XHQvLyBmcmFtZVN0ZXA6IGluZm8uZnJhbWVTdGVwLFxyXG5cdFx0XHQvLyBkdXJhdGlvbjogaW5mby5kdXJhdGlvbixcclxuXHRcdFx0Ly8gZnJhbWVDb3VudDogaW5mby5mcmFtZUNvdW50LFxyXG5cdFx0XHR0cmFuc2Zvcm06IGRlc2MuVHJuZixcclxuXHRcdFx0d2lkdGg6IGRlc2NbJ1N6ICAnXS5XZHRoLFxyXG5cdFx0XHRoZWlnaHQ6IGRlc2NbJ1N6ICAnXS5IZ2h0LFxyXG5cdFx0XHRyZXNvbHV0aW9uOiBwYXJzZVVuaXRzKGRlc2MuUnNsdCksXHJcblx0XHRcdHdhcnA6IHBhcnNlV2FycCgoZGVzYy5xdWlsdFdhcnAgfHwgZGVzYy53YXJwKSBhcyBhbnkpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoZGVzYy5ub25BZmZpbmVUcmFuc2Zvcm0gJiYgZGVzYy5ub25BZmZpbmVUcmFuc2Zvcm0uc29tZSgoeCwgaSkgPT4geCAhPT0gZGVzYy5Ucm5mW2ldKSkge1xyXG5cdFx0XHR0YXJnZXQucGxhY2VkTGF5ZXIubm9uQWZmaW5lVHJhbnNmb3JtID0gZGVzYy5ub25BZmZpbmVUcmFuc2Zvcm07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGRlc2MuQ3JvcCkgdGFyZ2V0LnBsYWNlZExheWVyLmNyb3AgPSBkZXNjLkNyb3A7XHJcblx0XHRpZiAoZGVzYy5jb21wKSB0YXJnZXQucGxhY2VkTGF5ZXIuY29tcCA9IGRlc2MuY29tcDtcclxuXHRcdGlmIChkZXNjLmNvbXBJbmZvKSB0YXJnZXQucGxhY2VkTGF5ZXIuY29tcEluZm8gPSBkZXNjLmNvbXBJbmZvO1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7IC8vIEhBQ0tcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnc29MRCcpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDQpOyAvLyB2ZXJzaW9uXHJcblxyXG5cdFx0Y29uc3QgcGxhY2VkID0gdGFyZ2V0LnBsYWNlZExheWVyITtcclxuXHRcdGNvbnN0IGRlc2M6IFNvTGREZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRJZG50OiBwbGFjZWQuaWQsXHJcblx0XHRcdHBsYWNlZDogcGxhY2VkLnBsYWNlZCA/PyBwbGFjZWQuaWQsIC8vID8/P1xyXG5cdFx0XHRQZ05tOiAxLFxyXG5cdFx0XHR0b3RhbFBhZ2VzOiAxLFxyXG5cdFx0XHQuLi4ocGxhY2VkLmNyb3AgPyB7IENyb3A6IHBsYWNlZC5jcm9wIH0gOiB7fSksXHJcblx0XHRcdGZyYW1lU3RlcDoge1xyXG5cdFx0XHRcdG51bWVyYXRvcjogMCxcclxuXHRcdFx0XHRkZW5vbWluYXRvcjogNjAwXHJcblx0XHRcdH0sXHJcblx0XHRcdGR1cmF0aW9uOiB7XHJcblx0XHRcdFx0bnVtZXJhdG9yOiAwLFxyXG5cdFx0XHRcdGRlbm9taW5hdG9yOiA2MDBcclxuXHRcdFx0fSxcclxuXHRcdFx0ZnJhbWVDb3VudDogMSxcclxuXHRcdFx0QW5udDogMTYsXHJcblx0XHRcdFR5cGU6IHBsYWNlZExheWVyVHlwZXMuaW5kZXhPZihwbGFjZWQudHlwZSksXHJcblx0XHRcdFRybmY6IHBsYWNlZC50cmFuc2Zvcm0sXHJcblx0XHRcdG5vbkFmZmluZVRyYW5zZm9ybTogcGxhY2VkLm5vbkFmZmluZVRyYW5zZm9ybSA/PyBwbGFjZWQudHJhbnNmb3JtLFxyXG5cdFx0XHRxdWlsdFdhcnA6IHt9IGFzIGFueSxcclxuXHRcdFx0d2FycDogZW5jb2RlV2FycChwbGFjZWQud2FycCB8fCB7fSksXHJcblx0XHRcdCdTeiAgJzoge1xyXG5cdFx0XHRcdFdkdGg6IHBsYWNlZC53aWR0aCB8fCAwLCAvLyBUT0RPOiBmaW5kIHNpemUgP1xyXG5cdFx0XHRcdEhnaHQ6IHBsYWNlZC5oZWlnaHQgfHwgMCwgLy8gVE9ETzogZmluZCBzaXplID9cclxuXHRcdFx0fSxcclxuXHRcdFx0UnNsdDogcGxhY2VkLnJlc29sdXRpb24gPyB1bml0c1ZhbHVlKHBsYWNlZC5yZXNvbHV0aW9uLCAncmVzb2x1dGlvbicpIDogeyB1bml0czogJ0RlbnNpdHknLCB2YWx1ZTogNzIgfSxcclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKHBsYWNlZC53YXJwICYmIGlzUXVpbHRXYXJwKHBsYWNlZC53YXJwKSkge1xyXG5cdFx0XHRjb25zdCBxdWlsdFdhcnAgPSBlbmNvZGVXYXJwKHBsYWNlZC53YXJwKSBhcyBRdWlsdFdhcnBEZXNjcmlwdG9yO1xyXG5cdFx0XHRkZXNjLnF1aWx0V2FycCA9IHF1aWx0V2FycDtcclxuXHRcdFx0ZGVzYy53YXJwID0ge1xyXG5cdFx0XHRcdHdhcnBTdHlsZTogJ3dhcnBTdHlsZS53YXJwTm9uZScsXHJcblx0XHRcdFx0d2FycFZhbHVlOiBxdWlsdFdhcnAud2FycFZhbHVlLFxyXG5cdFx0XHRcdHdhcnBQZXJzcGVjdGl2ZTogcXVpbHRXYXJwLndhcnBQZXJzcGVjdGl2ZSxcclxuXHRcdFx0XHR3YXJwUGVyc3BlY3RpdmVPdGhlcjogcXVpbHRXYXJwLndhcnBQZXJzcGVjdGl2ZU90aGVyLFxyXG5cdFx0XHRcdHdhcnBSb3RhdGU6IHF1aWx0V2FycC53YXJwUm90YXRlLFxyXG5cdFx0XHRcdGJvdW5kczogcXVpbHRXYXJwLmJvdW5kcyxcclxuXHRcdFx0XHR1T3JkZXI6IHF1aWx0V2FycC51T3JkZXIsXHJcblx0XHRcdFx0dk9yZGVyOiBxdWlsdFdhcnAudk9yZGVyLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZGVsZXRlIGRlc2MucXVpbHRXYXJwO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChwbGFjZWQuY29tcCkgZGVzYy5jb21wID0gcGxhY2VkLmNvbXA7XHJcblx0XHRpZiAocGxhY2VkLmNvbXBJbmZvKSBkZXNjLmNvbXBJbmZvID0gcGxhY2VkLmNvbXBJbmZvO1xyXG5cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjLCBkZXNjLnF1aWx0V2FycCA/ICdxdWlsdFdhcnAnIDogJ3dhcnAnKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnZnhycCcsXHJcblx0aGFzS2V5KCdyZWZlcmVuY2VQb2ludCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LnJlZmVyZW5jZVBvaW50ID0ge1xyXG5cdFx0XHR4OiByZWFkRmxvYXQ2NChyZWFkZXIpLFxyXG5cdFx0XHR5OiByZWFkRmxvYXQ2NChyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdGFyZ2V0LnJlZmVyZW5jZVBvaW50IS54KTtcclxuXHRcdHdyaXRlRmxvYXQ2NCh3cml0ZXIsIHRhcmdldC5yZWZlcmVuY2VQb2ludCEueSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmlmIChNT0NLX0hBTkRMRVJTKSB7XHJcblx0YWRkSGFuZGxlcihcclxuXHRcdCdQYXR0JyxcclxuXHRcdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX1BhdHQgIT09IHVuZGVmaW5lZCxcclxuXHRcdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZygnYWRkaXRpb25hbCBpbmZvOiBQYXR0Jyk7XHJcblx0XHRcdCh0YXJnZXQgYXMgYW55KS5fUGF0dCA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR9LFxyXG5cdFx0KHdyaXRlciwgdGFyZ2V0KSA9PiBmYWxzZSAmJiB3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9QYXR0KSxcclxuXHQpO1xyXG59IGVsc2Uge1xyXG5cdGFkZEhhbmRsZXIoXHJcblx0XHQnUGF0dCcsIC8vIFRPRE86IGhhbmRsZSBhbHNvIFBhdDIgJiBQYXQzXHJcblx0XHR0YXJnZXQgPT4gIXRhcmdldCxcclxuXHRcdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuO1xyXG5cclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTsgcmV0dXJuOyAvLyBub3Qgc3VwcG9ydGVkIHlldFxyXG5cdFx0XHR0YXJnZXQ7IHJlYWRQYXR0ZXJuO1xyXG5cclxuXHRcdFx0Ly8gaWYgKCF0YXJnZXQucGF0dGVybnMpIHRhcmdldC5wYXR0ZXJucyA9IFtdO1xyXG5cdFx0XHQvLyB0YXJnZXQucGF0dGVybnMucHVzaChyZWFkUGF0dGVybihyZWFkZXIpKTtcclxuXHRcdFx0Ly8gc2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdH0sXHJcblx0XHQoX3dyaXRlciwgX3RhcmdldCkgPT4ge1xyXG5cdFx0fSxcclxuXHQpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkUmVjdChyZWFkZXI6IFBzZFJlYWRlcikge1xyXG5cdGNvbnN0IHRvcCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGxlZnQgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRjb25zdCBib3R0b20gPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRjb25zdCByaWdodCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdHJldHVybiB7IHRvcCwgbGVmdCwgYm90dG9tLCByaWdodCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZVJlY3Qod3JpdGVyOiBQc2RXcml0ZXIsIHJlY3Q6IHsgbGVmdDogbnVtYmVyOyB0b3A6IG51bWJlcjsgcmlnaHQ6IG51bWJlcjsgYm90dG9tOiBudW1iZXIgfSkge1xyXG5cdHdyaXRlSW50MzIod3JpdGVyLCByZWN0LnRvcCk7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHJlY3QubGVmdCk7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHJlY3QuYm90dG9tKTtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgcmVjdC5yaWdodCk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J0Fubm8nLFxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIFBzZCkuYW5ub3RhdGlvbnMgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IG1ham9yID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgbWlub3IgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpZiAobWFqb3IgIT09IDIgfHwgbWlub3IgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBBbm5vIHZlcnNpb24nKTtcclxuXHRcdGNvbnN0IGNvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgYW5ub3RhdGlvbnM6IEFubm90YXRpb25bXSA9IFtdO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0XHQvKmNvbnN0IGxlbmd0aCA9Ki8gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBvcGVuID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0Lypjb25zdCBmbGFncyA9Ki8gcmVhZFVpbnQ4KHJlYWRlcik7IC8vIGFsd2F5cyAyOFxyXG5cdFx0XHQvKmNvbnN0IG9wdGlvbmFsQmxvY2tzID0qLyByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGljb25Mb2NhdGlvbiA9IHJlYWRSZWN0KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IHBvcHVwTG9jYXRpb24gPSByZWFkUmVjdChyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBjb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBhdXRob3IgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMik7XHJcblx0XHRcdGNvbnN0IG5hbWUgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMik7XHJcblx0XHRcdGNvbnN0IGRhdGUgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMik7XHJcblx0XHRcdC8qY29uc3QgY29udGVudExlbmd0aCA9Ki8gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IGRhdGFUeXBlID0qLyByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGRhdGFMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGxldCBkYXRhOiBzdHJpbmcgfCBVaW50OEFycmF5O1xyXG5cclxuXHRcdFx0aWYgKHR5cGUgPT09ICd0eHRBJykge1xyXG5cdFx0XHRcdGlmIChkYXRhTGVuZ3RoID49IDIgJiYgcmVhZFVpbnQxNihyZWFkZXIpID09PSAweGZlZmYpIHtcclxuXHRcdFx0XHRcdGRhdGEgPSByZWFkVW5pY29kZVN0cmluZ1dpdGhMZW5ndGgocmVhZGVyLCAoZGF0YUxlbmd0aCAtIDIpIC8gMik7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHJlYWRlci5vZmZzZXQgLT0gMjtcclxuXHRcdFx0XHRcdGRhdGEgPSByZWFkQXNjaWlTdHJpbmcocmVhZGVyLCBkYXRhTGVuZ3RoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGRhdGEgPSBkYXRhLnJlcGxhY2UoL1xcci9nLCAnXFxuJyk7XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ3NuZEEnKSB7XHJcblx0XHRcdFx0ZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIGRhdGFMZW5ndGgpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBhbm5vdGF0aW9uIHR5cGUnKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YW5ub3RhdGlvbnMucHVzaCh7XHJcblx0XHRcdFx0dHlwZTogdHlwZSA9PT0gJ3R4dEEnID8gJ3RleHQnIDogJ3NvdW5kJywgb3BlbiwgaWNvbkxvY2F0aW9uLCBwb3B1cExvY2F0aW9uLCBjb2xvciwgYXV0aG9yLCBuYW1lLCBkYXRlLCBkYXRhLFxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHJcblx0XHQodGFyZ2V0IGFzIFBzZCkuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGFubm90YXRpb25zID0gKHRhcmdldCBhcyBQc2QpLmFubm90YXRpb25zITtcclxuXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDIpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgYW5ub3RhdGlvbnMubGVuZ3RoKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGFubm90YXRpb24gb2YgYW5ub3RhdGlvbnMpIHtcclxuXHRcdFx0Y29uc3Qgc291bmQgPSBhbm5vdGF0aW9uLnR5cGUgPT09ICdzb3VuZCc7XHJcblxyXG5cdFx0XHRpZiAoc291bmQgJiYgIShhbm5vdGF0aW9uLmRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSkgdGhyb3cgbmV3IEVycm9yKCdTb3VuZCBhbm5vdGF0aW9uIGRhdGEgc2hvdWxkIGJlIFVpbnQ4QXJyYXknKTtcclxuXHRcdFx0aWYgKCFzb3VuZCAmJiB0eXBlb2YgYW5ub3RhdGlvbi5kYXRhICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKCdUZXh0IGFubm90YXRpb24gZGF0YSBzaG91bGQgYmUgc3RyaW5nJyk7XHJcblxyXG5cdFx0XHRjb25zdCBsZW5ndGhPZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyBsZW5ndGhcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBzb3VuZCA/ICdzbmRBJyA6ICd0eHRBJyk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCBhbm5vdGF0aW9uLm9wZW4gPyAxIDogMCk7XHJcblx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAyOCk7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7XHJcblx0XHRcdHdyaXRlUmVjdCh3cml0ZXIsIGFubm90YXRpb24uaWNvbkxvY2F0aW9uKTtcclxuXHRcdFx0d3JpdGVSZWN0KHdyaXRlciwgYW5ub3RhdGlvbi5wb3B1cExvY2F0aW9uKTtcclxuXHRcdFx0d3JpdGVDb2xvcih3cml0ZXIsIGFubm90YXRpb24uY29sb3IpO1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGFubm90YXRpb24uYXV0aG9yIHx8ICcnLCAyKTtcclxuXHRcdFx0d3JpdGVQYXNjYWxTdHJpbmcod3JpdGVyLCBhbm5vdGF0aW9uLm5hbWUgfHwgJycsIDIpO1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGFubm90YXRpb24uZGF0ZSB8fCAnJywgMik7XHJcblx0XHRcdGNvbnN0IGNvbnRlbnRPZmZzZXQgPSB3cml0ZXIub2Zmc2V0O1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyBjb250ZW50IGxlbmd0aFxyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHNvdW5kID8gJ3NuZE0nIDogJ3R4dEMnKTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTsgLy8gZGF0YSBsZW5ndGhcclxuXHRcdFx0Y29uc3QgZGF0YU9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XHJcblxyXG5cdFx0XHRpZiAoc291bmQpIHtcclxuXHRcdFx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgYW5ub3RhdGlvbi5kYXRhIGFzIFVpbnQ4QXJyYXkpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgMHhmZWZmKTsgLy8gdW5pY29kZSBzdHJpbmcgaW5kaWNhdG9yXHJcblx0XHRcdFx0Y29uc3QgdGV4dCA9IChhbm5vdGF0aW9uLmRhdGEgYXMgc3RyaW5nKS5yZXBsYWNlKC9cXG4vZywgJ1xccicpO1xyXG5cdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykgd3JpdGVVaW50MTYod3JpdGVyLCB0ZXh0LmNoYXJDb2RlQXQoaSkpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3cml0ZXIudmlldy5zZXRVaW50MzIobGVuZ3RoT2Zmc2V0LCB3cml0ZXIub2Zmc2V0IC0gbGVuZ3RoT2Zmc2V0LCBmYWxzZSk7XHJcblx0XHRcdHdyaXRlci52aWV3LnNldFVpbnQzMihjb250ZW50T2Zmc2V0LCB3cml0ZXIub2Zmc2V0IC0gY29udGVudE9mZnNldCwgZmFsc2UpO1xyXG5cdFx0XHR3cml0ZXIudmlldy5zZXRVaW50MzIoZGF0YU9mZnNldCAtIDQsIHdyaXRlci5vZmZzZXQgLSBkYXRhT2Zmc2V0LCBmYWxzZSk7XHJcblx0XHR9XHJcblx0fVxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIEZpbGVPcGVuRGVzY3JpcHRvciB7XHJcblx0Y29tcEluZm86IHsgY29tcElEOiBudW1iZXI7IG9yaWdpbmFsQ29tcElEOiBudW1iZXI7IH07XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2xuazInLFxyXG5cdCh0YXJnZXQ6IGFueSkgPT4gISEodGFyZ2V0IGFzIFBzZCkubGlua2VkRmlsZXMgJiYgKHRhcmdldCBhcyBQc2QpLmxpbmtlZEZpbGVzIS5sZW5ndGggPiAwLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgXywgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gdGFyZ2V0IGFzIFBzZDtcclxuXHRcdHBzZC5saW5rZWRGaWxlcyA9IFtdO1xyXG5cclxuXHRcdHdoaWxlIChsZWZ0KCkgPiA4KSB7XHJcblx0XHRcdGxldCBzaXplID0gcmVhZExlbmd0aDY0KHJlYWRlcik7IC8vIHNpemVcclxuXHRcdFx0Y29uc3Qgc3RhcnRPZmZzZXQgPSByZWFkZXIub2Zmc2V0O1xyXG5cdFx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpIGFzICdsaUZEJyB8ICdsaUZFJyB8ICdsaUZBJztcclxuXHRcdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBpZCA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHRcdFx0Y29uc3QgbmFtZSA9IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGZpbGVUeXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpLnRyaW0oKTsgLy8gJyAgICAnIGlmIGVtcHR5XHJcblx0XHRcdGNvbnN0IGZpbGVDcmVhdG9yID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpLnRyaW0oKTsgLy8gJyAgICAnIG9yICdcXDBcXDBcXDBcXDAnIGlmIGVtcHR5XHJcblx0XHRcdGNvbnN0IGRhdGFTaXplID0gcmVhZExlbmd0aDY0KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGhhc0ZpbGVPcGVuRGVzY3JpcHRvciA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBmaWxlT3BlbkRlc2NyaXB0b3IgPSBoYXNGaWxlT3BlbkRlc2NyaXB0b3IgPyByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBGaWxlT3BlbkRlc2NyaXB0b3IgOiB1bmRlZmluZWQ7XHJcblx0XHRcdGNvbnN0IGxpbmtlZEZpbGVEZXNjcmlwdG9yID0gdHlwZSA9PT0gJ2xpRkUnID8gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgOiB1bmRlZmluZWQ7XHJcblx0XHRcdGNvbnN0IGZpbGU6IExpbmtlZEZpbGUgPSB7IGlkLCBuYW1lLCBkYXRhOiB1bmRlZmluZWQgfTtcclxuXHJcblx0XHRcdGlmIChmaWxlVHlwZSkgZmlsZS50eXBlID0gZmlsZVR5cGU7XHJcblx0XHRcdGlmIChmaWxlQ3JlYXRvcikgZmlsZS5jcmVhdG9yID0gZmlsZUNyZWF0b3I7XHJcblx0XHRcdGlmIChmaWxlT3BlbkRlc2NyaXB0b3IpIGZpbGUuZGVzY3JpcHRvciA9IGZpbGVPcGVuRGVzY3JpcHRvcjtcclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAnbGlGRScgJiYgdmVyc2lvbiA+IDMpIHtcclxuXHRcdFx0XHRjb25zdCB5ZWFyID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgbW9udGggPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBkYXkgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBob3VyID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgbWludXRlID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgc2Vjb25kcyA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3Qgd2hvbGVTZWNvbmRzID0gTWF0aC5mbG9vcihzZWNvbmRzKTtcclxuXHRcdFx0XHRjb25zdCBtcyA9IChzZWNvbmRzIC0gd2hvbGVTZWNvbmRzKSAqIDEwMDA7XHJcblx0XHRcdFx0ZmlsZS50aW1lID0gbmV3IERhdGUoeWVhciwgbW9udGgsIGRheSwgaG91ciwgbWludXRlLCB3aG9sZVNlY29uZHMsIG1zKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgZmlsZVNpemUgPSB0eXBlID09PSAnbGlGRScgPyByZWFkTGVuZ3RoNjQocmVhZGVyKSA6IDA7XHJcblx0XHRcdGlmICh0eXBlID09PSAnbGlGQScpIHNraXBCeXRlcyhyZWFkZXIsIDgpO1xyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ2xpRkQnKSBmaWxlLmRhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBkYXRhU2l6ZSk7XHJcblx0XHRcdGlmICh2ZXJzaW9uID49IDUpIGZpbGUuY2hpbGREb2N1bWVudElEID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdFx0aWYgKHZlcnNpb24gPj0gNikgZmlsZS5hc3NldE1vZFRpbWUgPSByZWFkRmxvYXQ2NChyZWFkZXIpO1xyXG5cdFx0XHRpZiAodmVyc2lvbiA+PSA3KSBmaWxlLmFzc2V0TG9ja2VkU3RhdGUgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0aWYgKHR5cGUgPT09ICdsaUZFJykgZmlsZS5kYXRhID0gcmVhZEJ5dGVzKHJlYWRlciwgZmlsZVNpemUpO1xyXG5cclxuXHRcdFx0aWYgKG9wdGlvbnMuc2tpcExpbmtlZEZpbGVzRGF0YSkgZmlsZS5kYXRhID0gdW5kZWZpbmVkO1xyXG5cclxuXHRcdFx0cHNkLmxpbmtlZEZpbGVzLnB1c2goZmlsZSk7XHJcblx0XHRcdGxpbmtlZEZpbGVEZXNjcmlwdG9yO1xyXG5cclxuXHRcdFx0d2hpbGUgKHNpemUgJSA0KSBzaXplKys7XHJcblx0XHRcdHJlYWRlci5vZmZzZXQgPSBzdGFydE9mZnNldCArIHNpemU7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTsgLy8gP1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSB0YXJnZXQgYXMgUHNkO1xyXG5cclxuXHRcdGZvciAoY29uc3QgZmlsZSBvZiBwc2QubGlua2VkRmlsZXMhKSB7XHJcblx0XHRcdGxldCB2ZXJzaW9uID0gMjtcclxuXHJcblx0XHRcdGlmIChmaWxlLmFzc2V0TG9ja2VkU3RhdGUgIT0gbnVsbCkgdmVyc2lvbiA9IDc7XHJcblx0XHRcdGVsc2UgaWYgKGZpbGUuYXNzZXRNb2RUaW1lICE9IG51bGwpIHZlcnNpb24gPSA2O1xyXG5cdFx0XHRlbHNlIGlmIChmaWxlLmNoaWxkRG9jdW1lbnRJRCAhPSBudWxsKSB2ZXJzaW9uID0gNTtcclxuXHRcdFx0Ly8gVE9ETzogZWxzZSBpZiAoZmlsZS50aW1lICE9IG51bGwpIHZlcnNpb24gPSAzOyAob25seSBmb3IgbGlGRSlcclxuXHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIHNpemVcclxuXHRcdFx0Y29uc3Qgc2l6ZU9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgZmlsZS5kYXRhID8gJ2xpRkQnIDogJ2xpRkEnKTtcclxuXHRcdFx0d3JpdGVJbnQzMih3cml0ZXIsIHZlcnNpb24pO1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGZpbGUuaWQgfHwgJycsIDEpO1xyXG5cdFx0XHR3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXIsIGZpbGUubmFtZSB8fCAnJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgZmlsZS50eXBlID8gYCR7ZmlsZS50eXBlfSAgICBgLnN1YnN0cigwLCA0KSA6ICcgICAgJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgZmlsZS5jcmVhdG9yID8gYCR7ZmlsZS5jcmVhdG9yfSAgICBgLnN1YnN0cigwLCA0KSA6ICdcXDBcXDBcXDBcXDAnKTtcclxuXHRcdFx0d3JpdGVMZW5ndGg2NCh3cml0ZXIsIGZpbGUuZGF0YSA/IGZpbGUuZGF0YS5ieXRlTGVuZ3RoIDogMCk7XHJcblxyXG5cdFx0XHRpZiAoZmlsZS5kZXNjcmlwdG9yICYmIGZpbGUuZGVzY3JpcHRvci5jb21wSW5mbykge1xyXG5cdFx0XHRcdGNvbnN0IGRlc2M6IEZpbGVPcGVuRGVzY3JpcHRvciA9IHtcclxuXHRcdFx0XHRcdGNvbXBJbmZvOiBmaWxlLmRlc2NyaXB0b3IuY29tcEluZm8sXHJcblx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIDEpO1xyXG5cdFx0XHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChmaWxlLmRhdGEpIHdyaXRlQnl0ZXMod3JpdGVyLCBmaWxlLmRhdGEpO1xyXG5cdFx0XHRlbHNlIHdyaXRlTGVuZ3RoNjQod3JpdGVyLCAwKTtcclxuXHRcdFx0aWYgKHZlcnNpb24gPj0gNSkgd3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBmaWxlLmNoaWxkRG9jdW1lbnRJRCB8fCAnJyk7XHJcblx0XHRcdGlmICh2ZXJzaW9uID49IDYpIHdyaXRlRmxvYXQ2NCh3cml0ZXIsIGZpbGUuYXNzZXRNb2RUaW1lIHx8IDApO1xyXG5cdFx0XHRpZiAodmVyc2lvbiA+PSA3KSB3cml0ZVVpbnQ4KHdyaXRlciwgZmlsZS5hc3NldExvY2tlZFN0YXRlIHx8IDApO1xyXG5cclxuXHRcdFx0bGV0IHNpemUgPSB3cml0ZXIub2Zmc2V0IC0gc2l6ZU9mZnNldDtcclxuXHRcdFx0d3JpdGVyLnZpZXcuc2V0VWludDMyKHNpemVPZmZzZXQgLSA0LCBzaXplLCBmYWxzZSk7IC8vIHdyaXRlIHNpemVcclxuXHJcblx0XHRcdHdoaWxlIChzaXplICUgNCkge1xyXG5cdFx0XHRcdHNpemUrKztcclxuXHRcdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5hZGRIYW5kbGVyQWxpYXMoJ2xua0QnLCAnbG5rMicpO1xyXG5hZGRIYW5kbGVyQWxpYXMoJ2xuazMnLCAnbG5rMicpO1xyXG5cclxuLy8gdGhpcyBzZWVtcyB0byBqdXN0IGJlIHplcm8gc2l6ZSBibG9jaywgaWdub3JlIGl0XHJcbmFkZEhhbmRsZXIoXHJcblx0J2xua0UnLFxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2xua0UgIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIF9wc2RzLCBvcHRpb25zKSA9PiB7XHJcblx0XHRpZiAob3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMgJiYgbGVmdCgpKSB7XHJcblx0XHRcdGNvbnNvbGUubG9nKGBOb24tZW1wdHkgbG5rRSBsYXllciBpbmZvICgke2xlZnQoKX0gYnl0ZXMpYCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKE1PQ0tfSEFORExFUlMpIHtcclxuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9sbmtFID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gTU9DS19IQU5ETEVSUyAmJiB3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9sbmtFKSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBFeHRlbnNpb25EZXNjIHtcclxuXHRnZW5lcmF0b3JTZXR0aW5nczoge1xyXG5cdFx0Z2VuZXJhdG9yXzQ1X2Fzc2V0czogeyBqc29uOiBzdHJpbmc7IH07XHJcblx0XHRsYXllclRpbWU6IG51bWJlcjtcclxuXHR9O1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdwdGhzJyxcclxuXHRoYXNLZXkoJ3BhdGhMaXN0JyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblxyXG5cdFx0dGFyZ2V0LnBhdGhMaXN0ID0gW107IC8vIFRPRE86IHJlYWQgcGF0aHMgKGZpbmQgZXhhbXBsZSB3aXRoIG5vbi1lbXB0eSBsaXN0KVxyXG5cclxuXHRcdGRlc2NyaXB0b3I7XHJcblx0XHQvLyBjb25zb2xlLmxvZygncHRocycsIGRlc2NyaXB0b3IpOyAvLyBUT0RPOiByZW1vdmUgdGhpc1xyXG5cdH0sXHJcblx0KHdyaXRlciwgX3RhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHtcclxuXHRcdFx0cGF0aExpc3Q6IFtdLCAvLyBUT0RPOiB3cml0ZSBwYXRoc1xyXG5cdFx0fTtcclxuXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdwYXRoc0RhdGFDbGFzcycsIGRlc2NyaXB0b3IpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdseXZyJyxcclxuXHRoYXNLZXkoJ3ZlcnNpb24nKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC52ZXJzaW9uID0gcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQudmVyc2lvbiEpLFxyXG4pO1xyXG5cclxuZnVuY3Rpb24gYWRqdXN0bWVudFR5cGUodHlwZTogc3RyaW5nKSB7XHJcblx0cmV0dXJuICh0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8pID0+ICEhdGFyZ2V0LmFkanVzdG1lbnQgJiYgdGFyZ2V0LmFkanVzdG1lbnQudHlwZSA9PT0gdHlwZTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnYnJpdCcsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2JyaWdodG5lc3MvY29udHJhc3QnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmICghdGFyZ2V0LmFkanVzdG1lbnQpIHsgLy8gaWdub3JlIGlmIGdvdCBvbmUgZnJvbSBDZ0VkIGJsb2NrXHJcblx0XHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHRcdHR5cGU6ICdicmlnaHRuZXNzL2NvbnRyYXN0JyxcclxuXHRcdFx0XHRicmlnaHRuZXNzOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdFx0XHRjb250cmFzdDogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRcdFx0bWVhblZhbHVlOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdFx0XHRsYWJDb2xvck9ubHk6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHRcdFx0dXNlTGVnYWN5OiB0cnVlLFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBCcmlnaHRuZXNzQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBpbmZvLmJyaWdodG5lc3MgfHwgMCk7XHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgaW5mby5jb250cmFzdCB8fCAwKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBpbmZvLm1lYW5WYWx1ZSA/PyAxMjcpO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ubGFiQ29sb3JPbmx5ID8gMSA6IDApO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDEpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5mdW5jdGlvbiByZWFkTGV2ZWxzQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IExldmVsc0FkanVzdG1lbnRDaGFubmVsIHtcclxuXHRjb25zdCBzaGFkb3dJbnB1dCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGhpZ2hsaWdodElucHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3Qgc2hhZG93T3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgaGlnaGxpZ2h0T3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgbWlkdG9uZUlucHV0ID0gcmVhZEludDE2KHJlYWRlcikgLyAxMDA7XHJcblx0cmV0dXJuIHsgc2hhZG93SW5wdXQsIGhpZ2hsaWdodElucHV0LCBzaGFkb3dPdXRwdXQsIGhpZ2hsaWdodE91dHB1dCwgbWlkdG9uZUlucHV0IH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXI6IFBzZFdyaXRlciwgY2hhbm5lbDogTGV2ZWxzQWRqdXN0bWVudENoYW5uZWwpIHtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgY2hhbm5lbC5zaGFkb3dJbnB1dCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGNoYW5uZWwuaGlnaGxpZ2h0SW5wdXQpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjaGFubmVsLnNoYWRvd091dHB1dCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGNoYW5uZWwuaGlnaGxpZ2h0T3V0cHV0KTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgTWF0aC5yb3VuZChjaGFubmVsLm1pZHRvbmVJbnB1dCAqIDEwMCkpO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsZXZsJyxcclxuXHRhZGp1c3RtZW50VHlwZSgnbGV2ZWxzJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGV2bCB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXHJcblx0XHRcdHR5cGU6ICdsZXZlbHMnLFxyXG5cdFx0XHRyZ2I6IHJlYWRMZXZlbHNDaGFubmVsKHJlYWRlciksXHJcblx0XHRcdHJlZDogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0Z3JlZW46IHJlYWRMZXZlbHNDaGFubmVsKHJlYWRlciksXHJcblx0XHRcdGJsdWU6IHJlYWRMZXZlbHNDaGFubmVsKHJlYWRlciksXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBMZXZlbHNBZGp1c3RtZW50O1xyXG5cdFx0Y29uc3QgZGVmYXVsdENoYW5uZWwgPSB7XHJcblx0XHRcdHNoYWRvd0lucHV0OiAwLFxyXG5cdFx0XHRoaWdobGlnaHRJbnB1dDogMjU1LFxyXG5cdFx0XHRzaGFkb3dPdXRwdXQ6IDAsXHJcblx0XHRcdGhpZ2hsaWdodE91dHB1dDogMjU1LFxyXG5cdFx0XHRtaWR0b25lSW5wdXQ6IDEsXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGluZm8ucmdiIHx8IGRlZmF1bHRDaGFubmVsKTtcclxuXHRcdHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGluZm8ucmVkIHx8IGRlZmF1bHRDaGFubmVsKTtcclxuXHRcdHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGluZm8uYmx1ZSB8fCBkZWZhdWx0Q2hhbm5lbCk7XHJcblx0XHR3cml0ZUxldmVsc0NoYW5uZWwod3JpdGVyLCBpbmZvLmdyZWVuIHx8IGRlZmF1bHRDaGFubmVsKTtcclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNTk7IGkrKykgd3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlciwgZGVmYXVsdENoYW5uZWwpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5mdW5jdGlvbiByZWFkQ3VydmVDaGFubmVsKHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3Qgbm9kZXMgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgY2hhbm5lbDogQ3VydmVzQWRqdXN0bWVudENoYW5uZWwgPSBbXTtcclxuXHJcblx0Zm9yIChsZXQgaiA9IDA7IGogPCBub2RlczsgaisrKSB7XHJcblx0XHRjb25zdCBvdXRwdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGlucHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRjaGFubmVsLnB1c2goeyBpbnB1dCwgb3V0cHV0IH0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGNoYW5uZWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlcjogUHNkV3JpdGVyLCBjaGFubmVsOiBDdXJ2ZXNBZGp1c3RtZW50Q2hhbm5lbCkge1xyXG5cdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbC5sZW5ndGgpO1xyXG5cclxuXHRmb3IgKGNvbnN0IG4gb2YgY2hhbm5lbCkge1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBuLm91dHB1dCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIG4uaW5wdXQpO1xyXG5cdH1cclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnY3VydicsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2N1cnZlcycpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0cmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY3VydiB2ZXJzaW9uJyk7XHJcblx0XHRyZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBjaGFubmVscyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGluZm86IEN1cnZlc0FkanVzdG1lbnQgPSB7IHR5cGU6ICdjdXJ2ZXMnIH07XHJcblxyXG5cdFx0aWYgKGNoYW5uZWxzICYgMSkgaW5mby5yZ2IgPSByZWFkQ3VydmVDaGFubmVsKHJlYWRlcik7XHJcblx0XHRpZiAoY2hhbm5lbHMgJiAyKSBpbmZvLnJlZCA9IHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyKTtcclxuXHRcdGlmIChjaGFubmVscyAmIDQpIGluZm8uZ3JlZW4gPSByZWFkQ3VydmVDaGFubmVsKHJlYWRlcik7XHJcblx0XHRpZiAoY2hhbm5lbHMgJiA4KSBpbmZvLmJsdWUgPSByZWFkQ3VydmVDaGFubmVsKHJlYWRlcik7XHJcblxyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXHJcblx0XHRcdC4uLmluZm8sXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIGlnbm9yaW5nLCBkdXBsaWNhdGUgaW5mb3JtYXRpb25cclxuXHRcdC8vIGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJ0NydiAnKTtcclxuXHJcblx0XHQvLyBjb25zdCBjVmVyc2lvbiA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdC8vIHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdC8vIGNvbnN0IGNoYW5uZWxDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHQvLyBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxDb3VudDsgaSsrKSB7XHJcblx0XHQvLyBcdGNvbnN0IGluZGV4ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Ly8gXHRjb25zdCBub2RlcyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHQvLyBcdGZvciAobGV0IGogPSAwOyBqIDwgbm9kZXM7IGorKykge1xyXG5cdFx0Ly8gXHRcdGNvbnN0IG91dHB1dCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0Ly8gXHRcdGNvbnN0IGlucHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHQvLyBcdH1cclxuXHRcdC8vIH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgQ3VydmVzQWRqdXN0bWVudDtcclxuXHRcdGNvbnN0IHsgcmdiLCByZWQsIGdyZWVuLCBibHVlIH0gPSBpbmZvO1xyXG5cdFx0bGV0IGNoYW5uZWxzID0gMDtcclxuXHRcdGxldCBjaGFubmVsQ291bnQgPSAwO1xyXG5cclxuXHRcdGlmIChyZ2IgJiYgcmdiLmxlbmd0aCkgeyBjaGFubmVscyB8PSAxOyBjaGFubmVsQ291bnQrKzsgfVxyXG5cdFx0aWYgKHJlZCAmJiByZWQubGVuZ3RoKSB7IGNoYW5uZWxzIHw9IDI7IGNoYW5uZWxDb3VudCsrOyB9XHJcblx0XHRpZiAoZ3JlZW4gJiYgZ3JlZW4ubGVuZ3RoKSB7IGNoYW5uZWxzIHw9IDQ7IGNoYW5uZWxDb3VudCsrOyB9XHJcblx0XHRpZiAoYmx1ZSAmJiBibHVlLmxlbmd0aCkgeyBjaGFubmVscyB8PSA4OyBjaGFubmVsQ291bnQrKzsgfVxyXG5cclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWxzKTtcclxuXHJcblx0XHRpZiAocmdiICYmIHJnYi5sZW5ndGgpIHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgcmdiKTtcclxuXHRcdGlmIChyZWQgJiYgcmVkLmxlbmd0aCkgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCByZWQpO1xyXG5cdFx0aWYgKGdyZWVuICYmIGdyZWVuLmxlbmd0aCkgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBncmVlbik7XHJcblx0XHRpZiAoYmx1ZSAmJiBibHVlLmxlbmd0aCkgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBibHVlKTtcclxuXHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdDcnYgJyk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDQpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsQ291bnQpO1xyXG5cclxuXHRcdGlmIChyZ2IgJiYgcmdiLmxlbmd0aCkgeyB3cml0ZVVpbnQxNih3cml0ZXIsIDApOyB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJnYik7IH1cclxuXHRcdGlmIChyZWQgJiYgcmVkLmxlbmd0aCkgeyB3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJlZCk7IH1cclxuXHRcdGlmIChncmVlbiAmJiBncmVlbi5sZW5ndGgpIHsgd3JpdGVVaW50MTYod3JpdGVyLCAyKTsgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBncmVlbik7IH1cclxuXHRcdGlmIChibHVlICYmIGJsdWUubGVuZ3RoKSB7IHdyaXRlVWludDE2KHdyaXRlciwgMyk7IHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgYmx1ZSk7IH1cclxuXHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2V4cEEnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdleHBvc3VyZScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGV4cEEgdmVyc2lvbicpO1xyXG5cclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBQcmVzZXRJbmZvLFxyXG5cdFx0XHR0eXBlOiAnZXhwb3N1cmUnLFxyXG5cdFx0XHRleHBvc3VyZTogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0b2Zmc2V0OiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0XHRnYW1tYTogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIEV4cG9zdXJlQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIGluZm8uZXhwb3N1cmUhKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIGluZm8ub2Zmc2V0ISk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCBpbmZvLmdhbW1hISk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBWaWJyYW5jZURlc2NyaXB0b3Ige1xyXG5cdHZpYnJhbmNlPzogbnVtYmVyO1xyXG5cdFN0cnQ/OiBudW1iZXI7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3ZpYkEnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCd2aWJyYW5jZScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYzogVmlicmFuY2VEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHsgdHlwZTogJ3ZpYnJhbmNlJyB9O1xyXG5cdFx0aWYgKGRlc2MudmlicmFuY2UgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LmFkanVzdG1lbnQudmlicmFuY2UgPSBkZXNjLnZpYnJhbmNlO1xyXG5cdFx0aWYgKGRlc2MuU3RydCAhPT0gdW5kZWZpbmVkKSB0YXJnZXQuYWRqdXN0bWVudC5zYXR1cmF0aW9uID0gZGVzYy5TdHJ0O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBWaWJyYW5jZUFkanVzdG1lbnQ7XHJcblx0XHRjb25zdCBkZXNjOiBWaWJyYW5jZURlc2NyaXB0b3IgPSB7fTtcclxuXHRcdGlmIChpbmZvLnZpYnJhbmNlICE9PSB1bmRlZmluZWQpIGRlc2MudmlicmFuY2UgPSBpbmZvLnZpYnJhbmNlO1xyXG5cdFx0aWYgKGluZm8uc2F0dXJhdGlvbiAhPT0gdW5kZWZpbmVkKSBkZXNjLlN0cnQgPSBpbmZvLnNhdHVyYXRpb247XHJcblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5mdW5jdGlvbiByZWFkSHVlQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50Q2hhbm5lbCB7XHJcblx0cmV0dXJuIHtcclxuXHRcdGE6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0YjogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRjOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdGQ6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0aHVlOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdHNhdHVyYXRpb246IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0bGlnaHRuZXNzOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHR9O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUh1ZUNoYW5uZWwod3JpdGVyOiBQc2RXcml0ZXIsIGNoYW5uZWw6IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50Q2hhbm5lbCB8IHVuZGVmaW5lZCkge1xyXG5cdGNvbnN0IGMgPSBjaGFubmVsIHx8IHt9IGFzIFBhcnRpYWw8SHVlU2F0dXJhdGlvbkFkanVzdG1lbnRDaGFubmVsPjtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5hIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmIgfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuYyB8fCAwKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5kIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmh1ZSB8fCAwKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5zYXR1cmF0aW9uIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmxpZ2h0bmVzcyB8fCAwKTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnaHVlMicsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2h1ZS9zYXR1cmF0aW9uJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaHVlMiB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXHJcblx0XHRcdHR5cGU6ICdodWUvc2F0dXJhdGlvbicsXHJcblx0XHRcdG1hc3RlcjogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0cmVkczogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0eWVsbG93czogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0Z3JlZW5zOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHRjeWFuczogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0Ymx1ZXM6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXHJcblx0XHRcdG1hZ2VudGFzOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgSHVlU2F0dXJhdGlvbkFkanVzdG1lbnQ7XHJcblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby5tYXN0ZXIpO1xyXG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby5yZWRzKTtcclxuXHRcdHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXIsIGluZm8ueWVsbG93cyk7XHJcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLmdyZWVucyk7XHJcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLmN5YW5zKTtcclxuXHRcdHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXIsIGluZm8uYmx1ZXMpO1xyXG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby5tYWdlbnRhcyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRDb2xvckJhbGFuY2UocmVhZGVyOiBQc2RSZWFkZXIpOiBDb2xvckJhbGFuY2VWYWx1ZXMge1xyXG5cdHJldHVybiB7XHJcblx0XHRjeWFuUmVkOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdG1hZ2VudGFHcmVlbjogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHR5ZWxsb3dCbHVlOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHR9O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUNvbG9yQmFsYW5jZSh3cml0ZXI6IFBzZFdyaXRlciwgdmFsdWU6IFBhcnRpYWw8Q29sb3JCYWxhbmNlVmFsdWVzPikge1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCB2YWx1ZS5jeWFuUmVkIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCB2YWx1ZS5tYWdlbnRhR3JlZW4gfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIHZhbHVlLnllbGxvd0JsdWUgfHwgMCk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2JsbmMnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdjb2xvciBiYWxhbmNlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ2NvbG9yIGJhbGFuY2UnLFxyXG5cdFx0XHRzaGFkb3dzOiByZWFkQ29sb3JCYWxhbmNlKHJlYWRlciksXHJcblx0XHRcdG1pZHRvbmVzOiByZWFkQ29sb3JCYWxhbmNlKHJlYWRlciksXHJcblx0XHRcdGhpZ2hsaWdodHM6IHJlYWRDb2xvckJhbGFuY2UocmVhZGVyKSxcclxuXHRcdFx0cHJlc2VydmVMdW1pbm9zaXR5OiAhIXJlYWRVaW50OChyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgQ29sb3JCYWxhbmNlQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlciwgaW5mby5zaGFkb3dzIHx8IHt9KTtcclxuXHRcdHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlciwgaW5mby5taWR0b25lcyB8fCB7fSk7XHJcblx0XHR3cml0ZUNvbG9yQmFsYW5jZSh3cml0ZXIsIGluZm8uaGlnaGxpZ2h0cyB8fCB7fSk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5mby5wcmVzZXJ2ZUx1bWlub3NpdHkgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBCbGFja0FuZFdoaXRlRGVzY3JpcHRvciB7XHJcblx0J1JkICAnOiBudW1iZXI7XHJcblx0WWxsdzogbnVtYmVyO1xyXG5cdCdHcm4gJzogbnVtYmVyO1xyXG5cdCdDeW4gJzogbnVtYmVyO1xyXG5cdCdCbCAgJzogbnVtYmVyO1xyXG5cdE1nbnQ6IG51bWJlcjtcclxuXHR1c2VUaW50OiBib29sZWFuO1xyXG5cdHRpbnRDb2xvcj86IERlc2NyaXB0b3JDb2xvcjtcclxuXHRid1ByZXNldEtpbmQ6IG51bWJlcjtcclxuXHRibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWU6IHN0cmluZztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnYmx3aCcsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2JsYWNrICYgd2hpdGUnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2M6IEJsYWNrQW5kV2hpdGVEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ2JsYWNrICYgd2hpdGUnLFxyXG5cdFx0XHRyZWRzOiBkZXNjWydSZCAgJ10sXHJcblx0XHRcdHllbGxvd3M6IGRlc2MuWWxsdyxcclxuXHRcdFx0Z3JlZW5zOiBkZXNjWydHcm4gJ10sXHJcblx0XHRcdGN5YW5zOiBkZXNjWydDeW4gJ10sXHJcblx0XHRcdGJsdWVzOiBkZXNjWydCbCAgJ10sXHJcblx0XHRcdG1hZ2VudGFzOiBkZXNjLk1nbnQsXHJcblx0XHRcdHVzZVRpbnQ6ICEhZGVzYy51c2VUaW50LFxyXG5cdFx0XHRwcmVzZXRLaW5kOiBkZXNjLmJ3UHJlc2V0S2luZCxcclxuXHRcdFx0cHJlc2V0RmlsZU5hbWU6IGRlc2MuYmxhY2tBbmRXaGl0ZVByZXNldEZpbGVOYW1lLFxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoZGVzYy50aW50Q29sb3IgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LmFkanVzdG1lbnQudGludENvbG9yID0gcGFyc2VDb2xvcihkZXNjLnRpbnRDb2xvcik7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIEJsYWNrQW5kV2hpdGVBZGp1c3RtZW50O1xyXG5cdFx0Y29uc3QgZGVzYzogQmxhY2tBbmRXaGl0ZURlc2NyaXB0b3IgPSB7XHJcblx0XHRcdCdSZCAgJzogaW5mby5yZWRzIHx8IDAsXHJcblx0XHRcdFlsbHc6IGluZm8ueWVsbG93cyB8fCAwLFxyXG5cdFx0XHQnR3JuICc6IGluZm8uZ3JlZW5zIHx8IDAsXHJcblx0XHRcdCdDeW4gJzogaW5mby5jeWFucyB8fCAwLFxyXG5cdFx0XHQnQmwgICc6IGluZm8uYmx1ZXMgfHwgMCxcclxuXHRcdFx0TWdudDogaW5mby5tYWdlbnRhcyB8fCAwLFxyXG5cdFx0XHR1c2VUaW50OiAhIWluZm8udXNlVGludCxcclxuXHRcdFx0dGludENvbG9yOiBzZXJpYWxpemVDb2xvcihpbmZvLnRpbnRDb2xvciksXHJcblx0XHRcdGJ3UHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kIHx8IDAsXHJcblx0XHRcdGJsYWNrQW5kV2hpdGVQcmVzZXRGaWxlTmFtZTogaW5mby5wcmVzZXRGaWxlTmFtZSB8fCAnJyxcclxuXHRcdH07XHJcblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdwaGZsJyxcclxuXHRhZGp1c3RtZW50VHlwZSgncGhvdG8gZmlsdGVyJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aWYgKHZlcnNpb24gIT09IDIgJiYgdmVyc2lvbiAhPT0gMykgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBoZmwgdmVyc2lvbicpO1xyXG5cclxuXHRcdGxldCBjb2xvcjogQ29sb3I7XHJcblxyXG5cdFx0aWYgKHZlcnNpb24gPT09IDIpIHtcclxuXHRcdFx0Y29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcclxuXHRcdH0gZWxzZSB7IC8vIHZlcnNpb24gM1xyXG5cdFx0XHQvLyBUT0RPOiB0ZXN0IHRoaXMsIHRoaXMgaXMgcHJvYmFibHkgd3JvbmdcclxuXHRcdFx0Y29sb3IgPSB7XHJcblx0XHRcdFx0bDogcmVhZEludDMyKHJlYWRlcikgLyAxMDAsXHJcblx0XHRcdFx0YTogcmVhZEludDMyKHJlYWRlcikgLyAxMDAsXHJcblx0XHRcdFx0YjogcmVhZEludDMyKHJlYWRlcikgLyAxMDAsXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdHR5cGU6ICdwaG90byBmaWx0ZXInLFxyXG5cdFx0XHRjb2xvcixcclxuXHRcdFx0ZGVuc2l0eTogcmVhZFVpbnQzMihyZWFkZXIpIC8gMTAwLFxyXG5cdFx0XHRwcmVzZXJ2ZUx1bWlub3NpdHk6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBQaG90b0ZpbHRlckFkanVzdG1lbnQ7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDIpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgaW5mby5jb2xvciB8fCB7IGw6IDAsIGE6IDAsIGI6IDAgfSk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIChpbmZvLmRlbnNpdHkgfHwgMCkgKiAxMDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ucHJlc2VydmVMdW1pbm9zaXR5ID8gMSA6IDApO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5mdW5jdGlvbiByZWFkTWl4ckNoYW5uZWwocmVhZGVyOiBQc2RSZWFkZXIpOiBDaGFubmVsTWl4ZXJDaGFubmVsIHtcclxuXHRjb25zdCByZWQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBncmVlbiA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGJsdWUgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHRjb25zdCBjb25zdGFudCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdHJldHVybiB7IHJlZCwgZ3JlZW4sIGJsdWUsIGNvbnN0YW50IH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTWl4ckNoYW5uZWwod3JpdGVyOiBQc2RXcml0ZXIsIGNoYW5uZWw6IENoYW5uZWxNaXhlckNoYW5uZWwgfCB1bmRlZmluZWQpIHtcclxuXHRjb25zdCBjID0gY2hhbm5lbCB8fCB7fSBhcyBQYXJ0aWFsPENoYW5uZWxNaXhlckNoYW5uZWw+O1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLnJlZCEpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmdyZWVuISk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuYmx1ZSEpO1xyXG5cdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5jb25zdGFudCEpO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdtaXhyJyxcclxuXHRhZGp1c3RtZW50VHlwZSgnY2hhbm5lbCBtaXhlcicpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG1peHIgdmVyc2lvbicpO1xyXG5cclxuXHRcdGNvbnN0IGFkanVzdG1lbnQ6IENoYW5uZWxNaXhlckFkanVzdG1lbnQgPSB0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgUHJlc2V0SW5mbyxcclxuXHRcdFx0dHlwZTogJ2NoYW5uZWwgbWl4ZXInLFxyXG5cdFx0XHRtb25vY2hyb21lOiAhIXJlYWRVaW50MTYocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKCFhZGp1c3RtZW50Lm1vbm9jaHJvbWUpIHtcclxuXHRcdFx0YWRqdXN0bWVudC5yZWQgPSByZWFkTWl4ckNoYW5uZWwocmVhZGVyKTtcclxuXHRcdFx0YWRqdXN0bWVudC5ncmVlbiA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xyXG5cdFx0XHRhZGp1c3RtZW50LmJsdWUgPSByZWFkTWl4ckNoYW5uZWwocmVhZGVyKTtcclxuXHRcdH1cclxuXHJcblx0XHRhZGp1c3RtZW50LmdyYXkgPSByZWFkTWl4ckNoYW5uZWwocmVhZGVyKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgQ2hhbm5lbE1peGVyQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5tb25vY2hyb21lID8gMSA6IDApO1xyXG5cclxuXHRcdGlmIChpbmZvLm1vbm9jaHJvbWUpIHtcclxuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JheSk7XHJcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzICogNSAqIDIpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8ucmVkKTtcclxuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JlZW4pO1xyXG5cdFx0XHR3cml0ZU1peHJDaGFubmVsKHdyaXRlciwgaW5mby5ibHVlKTtcclxuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JheSk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmNvbnN0IGNvbG9yTG9va3VwVHlwZSA9IGNyZWF0ZUVudW08JzNkbHV0JyB8ICdhYnN0cmFjdFByb2ZpbGUnIHwgJ2RldmljZUxpbmtQcm9maWxlJz4oJ2NvbG9yTG9va3VwVHlwZScsICczRExVVCcsIHtcclxuXHQnM2RsdXQnOiAnM0RMVVQnLFxyXG5cdGFic3RyYWN0UHJvZmlsZTogJ2Fic3RyYWN0UHJvZmlsZScsXHJcblx0ZGV2aWNlTGlua1Byb2ZpbGU6ICdkZXZpY2VMaW5rUHJvZmlsZScsXHJcbn0pO1xyXG5cclxuY29uc3QgTFVURm9ybWF0VHlwZSA9IGNyZWF0ZUVudW08J2xvb2snIHwgJ2N1YmUnIHwgJzNkbCc+KCdMVVRGb3JtYXRUeXBlJywgJ2xvb2snLCB7XHJcblx0bG9vazogJ0xVVEZvcm1hdExPT0snLFxyXG5cdGN1YmU6ICdMVVRGb3JtYXRDVUJFJyxcclxuXHQnM2RsJzogJ0xVVEZvcm1hdDNETCcsXHJcbn0pO1xyXG5cclxuY29uc3QgY29sb3JMb29rdXBPcmRlciA9IGNyZWF0ZUVudW08J3JnYicgfCAnYmdyJz4oJ2NvbG9yTG9va3VwT3JkZXInLCAncmdiJywge1xyXG5cdHJnYjogJ3JnYk9yZGVyJyxcclxuXHRiZ3I6ICdiZ3JPcmRlcicsXHJcbn0pO1xyXG5cclxuaW50ZXJmYWNlIENvbG9yTG9va3VwRGVzY3JpcHRvciB7XHJcblx0bG9va3VwVHlwZT86IHN0cmluZztcclxuXHQnTm0gICc/OiBzdHJpbmc7XHJcblx0RHRocj86IGJvb2xlYW47XHJcblx0cHJvZmlsZT86IFVpbnQ4QXJyYXk7XHJcblx0TFVURm9ybWF0Pzogc3RyaW5nO1xyXG5cdGRhdGFPcmRlcj86IHN0cmluZztcclxuXHR0YWJsZU9yZGVyPzogc3RyaW5nO1xyXG5cdExVVDNERmlsZURhdGE/OiBVaW50OEFycmF5O1xyXG5cdExVVDNERmlsZU5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2NsckwnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdjb2xvciBsb29rdXAnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjbHJMIHZlcnNpb24nKTtcclxuXHJcblx0XHRjb25zdCBkZXNjOiBDb2xvckxvb2t1cERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0geyB0eXBlOiAnY29sb3IgbG9va3VwJyB9O1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50O1xyXG5cclxuXHRcdGlmIChkZXNjLmxvb2t1cFR5cGUgIT09IHVuZGVmaW5lZCkgaW5mby5sb29rdXBUeXBlID0gY29sb3JMb29rdXBUeXBlLmRlY29kZShkZXNjLmxvb2t1cFR5cGUpO1xyXG5cdFx0aWYgKGRlc2NbJ05tICAnXSAhPT0gdW5kZWZpbmVkKSBpbmZvLm5hbWUgPSBkZXNjWydObSAgJ107XHJcblx0XHRpZiAoZGVzYy5EdGhyICE9PSB1bmRlZmluZWQpIGluZm8uZGl0aGVyID0gZGVzYy5EdGhyO1xyXG5cdFx0aWYgKGRlc2MucHJvZmlsZSAhPT0gdW5kZWZpbmVkKSBpbmZvLnByb2ZpbGUgPSBkZXNjLnByb2ZpbGU7XHJcblx0XHRpZiAoZGVzYy5MVVRGb3JtYXQgIT09IHVuZGVmaW5lZCkgaW5mby5sdXRGb3JtYXQgPSBMVVRGb3JtYXRUeXBlLmRlY29kZShkZXNjLkxVVEZvcm1hdCk7XHJcblx0XHRpZiAoZGVzYy5kYXRhT3JkZXIgIT09IHVuZGVmaW5lZCkgaW5mby5kYXRhT3JkZXIgPSBjb2xvckxvb2t1cE9yZGVyLmRlY29kZShkZXNjLmRhdGFPcmRlcik7XHJcblx0XHRpZiAoZGVzYy50YWJsZU9yZGVyICE9PSB1bmRlZmluZWQpIGluZm8udGFibGVPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZGVjb2RlKGRlc2MudGFibGVPcmRlcik7XHJcblx0XHRpZiAoZGVzYy5MVVQzREZpbGVEYXRhICE9PSB1bmRlZmluZWQpIGluZm8ubHV0M0RGaWxlRGF0YSA9IGRlc2MuTFVUM0RGaWxlRGF0YTtcclxuXHRcdGlmIChkZXNjLkxVVDNERmlsZU5hbWUgIT09IHVuZGVmaW5lZCkgaW5mby5sdXQzREZpbGVOYW1lID0gZGVzYy5MVVQzREZpbGVOYW1lO1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDb2xvckxvb2t1cEFkanVzdG1lbnQ7XHJcblx0XHRjb25zdCBkZXNjOiBDb2xvckxvb2t1cERlc2NyaXB0b3IgPSB7fTtcclxuXHJcblx0XHRpZiAoaW5mby5sb29rdXBUeXBlICE9PSB1bmRlZmluZWQpIGRlc2MubG9va3VwVHlwZSA9IGNvbG9yTG9va3VwVHlwZS5lbmNvZGUoaW5mby5sb29rdXBUeXBlKTtcclxuXHRcdGlmIChpbmZvLm5hbWUgIT09IHVuZGVmaW5lZCkgZGVzY1snTm0gICddID0gaW5mby5uYW1lO1xyXG5cdFx0aWYgKGluZm8uZGl0aGVyICE9PSB1bmRlZmluZWQpIGRlc2MuRHRociA9IGluZm8uZGl0aGVyO1xyXG5cdFx0aWYgKGluZm8ucHJvZmlsZSAhPT0gdW5kZWZpbmVkKSBkZXNjLnByb2ZpbGUgPSBpbmZvLnByb2ZpbGU7XHJcblx0XHRpZiAoaW5mby5sdXRGb3JtYXQgIT09IHVuZGVmaW5lZCkgZGVzYy5MVVRGb3JtYXQgPSBMVVRGb3JtYXRUeXBlLmVuY29kZShpbmZvLmx1dEZvcm1hdCk7XHJcblx0XHRpZiAoaW5mby5kYXRhT3JkZXIgIT09IHVuZGVmaW5lZCkgZGVzYy5kYXRhT3JkZXIgPSBjb2xvckxvb2t1cE9yZGVyLmVuY29kZShpbmZvLmRhdGFPcmRlcik7XHJcblx0XHRpZiAoaW5mby50YWJsZU9yZGVyICE9PSB1bmRlZmluZWQpIGRlc2MudGFibGVPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZW5jb2RlKGluZm8udGFibGVPcmRlcik7XHJcblx0XHRpZiAoaW5mby5sdXQzREZpbGVEYXRhICE9PSB1bmRlZmluZWQpIGRlc2MuTFVUM0RGaWxlRGF0YSA9IGluZm8ubHV0M0RGaWxlRGF0YTtcclxuXHRcdGlmIChpbmZvLmx1dDNERmlsZU5hbWUgIT09IHVuZGVmaW5lZCkgZGVzYy5MVVQzREZpbGVOYW1lID0gaW5mby5sdXQzREZpbGVOYW1lO1xyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbnZydCcsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2ludmVydCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7IHR5cGU6ICdpbnZlcnQnIH07XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KCkgPT4ge1xyXG5cdFx0Ly8gbm90aGluZyB0byB3cml0ZSBoZXJlXHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3Bvc3QnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdwb3N0ZXJpemUnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHR0eXBlOiAncG9zdGVyaXplJyxcclxuXHRcdFx0bGV2ZWxzOiByZWFkVWludDE2KHJlYWRlciksXHJcblx0XHR9O1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFBvc3Rlcml6ZUFkanVzdG1lbnQ7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ubGV2ZWxzID8/IDQpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCd0aHJzJyxcclxuXHRhZGp1c3RtZW50VHlwZSgndGhyZXNob2xkJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ3RocmVzaG9sZCcsXHJcblx0XHRcdGxldmVsOiByZWFkVWludDE2KHJlYWRlciksXHJcblx0XHR9O1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFRocmVzaG9sZEFkanVzdG1lbnQ7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ubGV2ZWwgPz8gMTI4KTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgZ3JkbUNvbG9yTW9kZWxzID0gWycnLCAnJywgJycsICdyZ2InLCAnaHNiJywgJycsICdsYWInXTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2dyZG0nLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdncmFkaWVudCBtYXAnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBncmRtIHZlcnNpb24nKTtcclxuXHJcblx0XHRjb25zdCBpbmZvOiBHcmFkaWVudE1hcEFkanVzdG1lbnQgPSB7XHJcblx0XHRcdHR5cGU6ICdncmFkaWVudCBtYXAnLFxyXG5cdFx0XHRncmFkaWVudFR5cGU6ICdzb2xpZCcsXHJcblx0XHR9O1xyXG5cclxuXHRcdGluZm8ucmV2ZXJzZSA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRpbmZvLmRpdGhlciA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRpbmZvLm5hbWUgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdFx0aW5mby5jb2xvclN0b3BzID0gW107XHJcblx0XHRpbmZvLm9wYWNpdHlTdG9wcyA9IFtdO1xyXG5cclxuXHRcdGNvbnN0IHN0b3BzQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdG9wc0NvdW50OyBpKyspIHtcclxuXHRcdFx0aW5mby5jb2xvclN0b3BzLnB1c2goe1xyXG5cdFx0XHRcdGxvY2F0aW9uOiByZWFkVWludDMyKHJlYWRlciksXHJcblx0XHRcdFx0bWlkcG9pbnQ6IHJlYWRVaW50MzIocmVhZGVyKSAvIDEwMCxcclxuXHRcdFx0XHRjb2xvcjogcmVhZENvbG9yKHJlYWRlciksXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBvcGFjaXR5U3RvcHNDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG9wYWNpdHlTdG9wc0NvdW50OyBpKyspIHtcclxuXHRcdFx0aW5mby5vcGFjaXR5U3RvcHMucHVzaCh7XHJcblx0XHRcdFx0bG9jYXRpb246IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHRcdFx0XHRtaWRwb2ludDogcmVhZFVpbnQzMihyZWFkZXIpIC8gMTAwLFxyXG5cdFx0XHRcdG9wYWNpdHk6IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmYsXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGV4cGFuc2lvbkNvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aWYgKGV4cGFuc2lvbkNvdW50ICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZ3JkbSBleHBhbnNpb24gY291bnQnKTtcclxuXHJcblx0XHRjb25zdCBpbnRlcnBvbGF0aW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aW5mby5zbW9vdGhuZXNzID0gaW50ZXJwb2xhdGlvbiAvIDQwOTY7XHJcblxyXG5cdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aWYgKGxlbmd0aCAhPT0gMzIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBncmRtIGxlbmd0aCcpO1xyXG5cclxuXHRcdGluZm8uZ3JhZGllbnRUeXBlID0gcmVhZFVpbnQxNihyZWFkZXIpID8gJ25vaXNlJyA6ICdzb2xpZCc7XHJcblx0XHRpbmZvLnJhbmRvbVNlZWQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRpbmZvLmFkZFRyYW5zcGFyZW5jeSA9ICEhcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aW5mby5yZXN0cmljdENvbG9ycyA9ICEhcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0aW5mby5yb3VnaG5lc3MgPSByZWFkVWludDMyKHJlYWRlcikgLyA0MDk2O1xyXG5cdFx0aW5mby5jb2xvck1vZGVsID0gKGdyZG1Db2xvck1vZGVsc1tyZWFkVWludDE2KHJlYWRlcildIHx8ICdyZ2InKSBhcyAncmdiJyB8ICdoc2InIHwgJ2xhYic7XHJcblxyXG5cdFx0aW5mby5taW4gPSBbXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdF07XHJcblxyXG5cdFx0aW5mby5tYXggPSBbXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdF07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IHMgb2YgaW5mby5jb2xvclN0b3BzKSBzLmxvY2F0aW9uIC89IGludGVycG9sYXRpb247XHJcblx0XHRmb3IgKGNvbnN0IHMgb2YgaW5mby5vcGFjaXR5U3RvcHMpIHMubG9jYXRpb24gLz0gaW50ZXJwb2xhdGlvbjtcclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IGluZm87XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBHcmFkaWVudE1hcEFkanVzdG1lbnQ7XHJcblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ucmV2ZXJzZSA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLmRpdGhlciA/IDEgOiAwKTtcclxuXHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgaW5mby5uYW1lIHx8ICcnKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5jb2xvclN0b3BzICYmIGluZm8uY29sb3JTdG9wcy5sZW5ndGggfHwgMCk7XHJcblxyXG5cdFx0Y29uc3QgaW50ZXJwb2xhdGlvbiA9IE1hdGgucm91bmQoKGluZm8uc21vb3RobmVzcyA/PyAxKSAqIDQwOTYpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgcyBvZiBpbmZvLmNvbG9yU3RvcHMgfHwgW10pIHtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKHMubG9jYXRpb24gKiBpbnRlcnBvbGF0aW9uKSk7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgTWF0aC5yb3VuZChzLm1pZHBvaW50ICogMTAwKSk7XHJcblx0XHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBzLmNvbG9yKTtcclxuXHRcdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vcGFjaXR5U3RvcHMgJiYgaW5mby5vcGFjaXR5U3RvcHMubGVuZ3RoIHx8IDApO1xyXG5cclxuXHRcdGZvciAoY29uc3QgcyBvZiBpbmZvLm9wYWNpdHlTdG9wcyB8fCBbXSkge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQocy5sb2NhdGlvbiAqIGludGVycG9sYXRpb24pKTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKHMubWlkcG9pbnQgKiAxMDApKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKHMub3BhY2l0eSAqIDB4ZmYpKTtcclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDIpOyAvLyBleHBhbnNpb24gY291bnRcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW50ZXJwb2xhdGlvbik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDMyKTsgLy8gbGVuZ3RoXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8uZ3JhZGllbnRUeXBlID09PSAnbm9pc2UnID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpbmZvLnJhbmRvbVNlZWQgfHwgMCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8uYWRkVHJhbnNwYXJlbmN5ID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLnJlc3RyaWN0Q29sb3JzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKChpbmZvLnJvdWdobmVzcyA/PyAxKSAqIDQwOTYpKTtcclxuXHRcdGNvbnN0IGNvbG9yTW9kZWwgPSBncmRtQ29sb3JNb2RlbHMuaW5kZXhPZihpbmZvLmNvbG9yTW9kZWwgPz8gJ3JnYicpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjb2xvck1vZGVsID09PSAtMSA/IDMgOiBjb2xvck1vZGVsKTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKylcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKChpbmZvLm1pbiAmJiBpbmZvLm1pbltpXSB8fCAwKSAqIDB4ODAwMCkpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKVxyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoKGluZm8ubWF4ICYmIGluZm8ubWF4W2ldIHx8IDApICogMHg4MDAwKSk7XHJcblxyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDQpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5mdW5jdGlvbiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlcjogUHNkUmVhZGVyKTogQ01ZSyB7XHJcblx0cmV0dXJuIHtcclxuXHRcdGM6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0bTogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHR5OiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdGs6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlcjogUHNkV3JpdGVyLCBjbXlrOiBDTVlLIHwgdW5kZWZpbmVkKSB7XHJcblx0Y29uc3QgYyA9IGNteWsgfHwge30gYXMgUGFydGlhbDxDTVlLPjtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5jISk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMubSEpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLnkhKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5rISk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3NlbGMnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdzZWxlY3RpdmUgY29sb3InKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzZWxjIHZlcnNpb24nKTtcclxuXHJcblx0XHRjb25zdCBtb2RlID0gcmVhZFVpbnQxNihyZWFkZXIpID8gJ2Fic29sdXRlJyA6ICdyZWxhdGl2ZSc7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCA4KTtcclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ3NlbGVjdGl2ZSBjb2xvcicsXHJcblx0XHRcdG1vZGUsXHJcblx0XHRcdHJlZHM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0eWVsbG93czogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHRncmVlbnM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0Y3lhbnM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0Ymx1ZXM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0bWFnZW50YXM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0d2hpdGVzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXHJcblx0XHRcdG5ldXRyYWxzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXHJcblx0XHRcdGJsYWNrczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFNlbGVjdGl2ZUNvbG9yQWRqdXN0bWVudDtcclxuXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ubW9kZSA9PT0gJ2Fic29sdXRlJyA/IDEgOiAwKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA4KTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5yZWRzKTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby55ZWxsb3dzKTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5ncmVlbnMpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmN5YW5zKTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5ibHVlcyk7XHJcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8ubWFnZW50YXMpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLndoaXRlcyk7XHJcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8ubmV1dHJhbHMpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmJsYWNrcyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yIHtcclxuXHRWcnNuOiBudW1iZXI7XHJcblx0QnJnaDogbnVtYmVyO1xyXG5cdENudHI6IG51bWJlcjtcclxuXHRtZWFuczogbnVtYmVyO1xyXG5cdCdMYWIgJzogYm9vbGVhbjtcclxuXHR1c2VMZWdhY3k6IGJvb2xlYW47XHJcblx0QXV0bzogYm9vbGVhbjtcclxufVxyXG5cclxuaW50ZXJmYWNlIFByZXNldERlc2NyaXB0b3Ige1xyXG5cdFZyc246IG51bWJlcjtcclxuXHRwcmVzZXRLaW5kOiBudW1iZXI7XHJcblx0cHJlc2V0RmlsZU5hbWU6IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIEN1cnZlc1ByZXNldERlc2NyaXB0b3Ige1xyXG5cdFZyc246IG51bWJlcjtcclxuXHRjdXJ2ZXNQcmVzZXRLaW5kOiBudW1iZXI7XHJcblx0Y3VydmVzUHJlc2V0RmlsZU5hbWU6IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIE1peGVyUHJlc2V0RGVzY3JpcHRvciB7XHJcblx0VnJzbjogbnVtYmVyO1xyXG5cdG1peGVyUHJlc2V0S2luZDogbnVtYmVyO1xyXG5cdG1peGVyUHJlc2V0RmlsZU5hbWU6IHN0cmluZztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnQ2dFZCcsXHJcblx0dGFyZ2V0ID0+IHtcclxuXHRcdGNvbnN0IGEgPSB0YXJnZXQuYWRqdXN0bWVudDtcclxuXHJcblx0XHRpZiAoIWEpIHJldHVybiBmYWxzZTtcclxuXHJcblx0XHRyZXR1cm4gKGEudHlwZSA9PT0gJ2JyaWdodG5lc3MvY29udHJhc3QnICYmICFhLnVzZUxlZ2FjeSkgfHxcclxuXHRcdFx0KChhLnR5cGUgPT09ICdsZXZlbHMnIHx8IGEudHlwZSA9PT0gJ2N1cnZlcycgfHwgYS50eXBlID09PSAnZXhwb3N1cmUnIHx8IGEudHlwZSA9PT0gJ2NoYW5uZWwgbWl4ZXInIHx8XHJcblx0XHRcdFx0YS50eXBlID09PSAnaHVlL3NhdHVyYXRpb24nKSAmJiBhLnByZXNldEZpbGVOYW1lICE9PSB1bmRlZmluZWQpO1xyXG5cdH0sXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXNcclxuXHRcdFx0QnJpZ2h0bmVzc0NvbnRyYXN0RGVzY3JpcHRvciB8IFByZXNldERlc2NyaXB0b3IgfCBDdXJ2ZXNQcmVzZXREZXNjcmlwdG9yIHwgTWl4ZXJQcmVzZXREZXNjcmlwdG9yO1xyXG5cdFx0aWYgKGRlc2MuVnJzbiAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIENnRWQgdmVyc2lvbicpO1xyXG5cclxuXHRcdC8vIHRoaXMgc2VjdGlvbiBjYW4gc3BlY2lmeSBwcmVzZXQgZmlsZSBuYW1lIGZvciBvdGhlciBhZGp1c3RtZW50IHR5cGVzXHJcblx0XHRpZiAoJ3ByZXNldEZpbGVOYW1lJyBpbiBkZXNjKSB7XHJcblx0XHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIExldmVsc0FkanVzdG1lbnQgfCBFeHBvc3VyZUFkanVzdG1lbnQgfCBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudCxcclxuXHRcdFx0XHRwcmVzZXRLaW5kOiBkZXNjLnByZXNldEtpbmQsXHJcblx0XHRcdFx0cHJlc2V0RmlsZU5hbWU6IGRlc2MucHJlc2V0RmlsZU5hbWUsXHJcblx0XHRcdH07XHJcblx0XHR9IGVsc2UgaWYgKCdjdXJ2ZXNQcmVzZXRGaWxlTmFtZScgaW4gZGVzYykge1xyXG5cdFx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBDdXJ2ZXNBZGp1c3RtZW50LFxyXG5cdFx0XHRcdHByZXNldEtpbmQ6IGRlc2MuY3VydmVzUHJlc2V0S2luZCxcclxuXHRcdFx0XHRwcmVzZXRGaWxlTmFtZTogZGVzYy5jdXJ2ZXNQcmVzZXRGaWxlTmFtZSxcclxuXHRcdFx0fTtcclxuXHRcdH0gZWxzZSBpZiAoJ21peGVyUHJlc2V0RmlsZU5hbWUnIGluIGRlc2MpIHtcclxuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgQ3VydmVzQWRqdXN0bWVudCxcclxuXHRcdFx0XHRwcmVzZXRLaW5kOiBkZXNjLm1peGVyUHJlc2V0S2luZCxcclxuXHRcdFx0XHRwcmVzZXRGaWxlTmFtZTogZGVzYy5taXhlclByZXNldEZpbGVOYW1lLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdFx0dHlwZTogJ2JyaWdodG5lc3MvY29udHJhc3QnLFxyXG5cdFx0XHRcdGJyaWdodG5lc3M6IGRlc2MuQnJnaCxcclxuXHRcdFx0XHRjb250cmFzdDogZGVzYy5DbnRyLFxyXG5cdFx0XHRcdG1lYW5WYWx1ZTogZGVzYy5tZWFucyxcclxuXHRcdFx0XHR1c2VMZWdhY3k6ICEhZGVzYy51c2VMZWdhY3ksXHJcblx0XHRcdFx0bGFiQ29sb3JPbmx5OiAhIWRlc2NbJ0xhYiAnXSxcclxuXHRcdFx0XHRhdXRvOiAhIWRlc2MuQXV0byxcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQhO1xyXG5cclxuXHRcdGlmIChpbmZvLnR5cGUgPT09ICdsZXZlbHMnIHx8IGluZm8udHlwZSA9PT0gJ2V4cG9zdXJlJyB8fCBpbmZvLnR5cGUgPT09ICdodWUvc2F0dXJhdGlvbicpIHtcclxuXHRcdFx0Y29uc3QgZGVzYzogUHJlc2V0RGVzY3JpcHRvciA9IHtcclxuXHRcdFx0XHRWcnNuOiAxLFxyXG5cdFx0XHRcdHByZXNldEtpbmQ6IGluZm8ucHJlc2V0S2luZCA/PyAxLFxyXG5cdFx0XHRcdHByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxyXG5cdFx0XHR9O1xyXG5cdFx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0XHR9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2N1cnZlcycpIHtcclxuXHRcdFx0Y29uc3QgZGVzYzogQ3VydmVzUHJlc2V0RGVzY3JpcHRvciA9IHtcclxuXHRcdFx0XHRWcnNuOiAxLFxyXG5cdFx0XHRcdGN1cnZlc1ByZXNldEtpbmQ6IGluZm8ucHJlc2V0S2luZCA/PyAxLFxyXG5cdFx0XHRcdGN1cnZlc1ByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxyXG5cdFx0XHR9O1xyXG5cdFx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0XHR9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2NoYW5uZWwgbWl4ZXInKSB7XHJcblx0XHRcdGNvbnN0IGRlc2M6IE1peGVyUHJlc2V0RGVzY3JpcHRvciA9IHtcclxuXHRcdFx0XHRWcnNuOiAxLFxyXG5cdFx0XHRcdG1peGVyUHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kID8/IDEsXHJcblx0XHRcdFx0bWl4ZXJQcmVzZXRGaWxlTmFtZTogaW5mby5wcmVzZXRGaWxlTmFtZSB8fCAnJyxcclxuXHRcdFx0fTtcclxuXHRcdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdFx0fSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdicmlnaHRuZXNzL2NvbnRyYXN0Jykge1xyXG5cdFx0XHRjb25zdCBkZXNjOiBCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRcdFZyc246IDEsXHJcblx0XHRcdFx0QnJnaDogaW5mby5icmlnaHRuZXNzIHx8IDAsXHJcblx0XHRcdFx0Q250cjogaW5mby5jb250cmFzdCB8fCAwLFxyXG5cdFx0XHRcdG1lYW5zOiBpbmZvLm1lYW5WYWx1ZSA/PyAxMjcsXHJcblx0XHRcdFx0J0xhYiAnOiAhIWluZm8ubGFiQ29sb3JPbmx5LFxyXG5cdFx0XHRcdHVzZUxlZ2FjeTogISFpbmZvLnVzZUxlZ2FjeSxcclxuXHRcdFx0XHRBdXRvOiAhIWluZm8uYXV0byxcclxuXHRcdFx0fTtcclxuXHRcdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmhhbmRsZWQgQ2dFZCBjYXNlJyk7XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J1R4dDInLFxyXG5cdGhhc0tleSgnZW5naW5lRGF0YScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHR0YXJnZXQuZW5naW5lRGF0YSA9IGZyb21CeXRlQXJyYXkoZGF0YSk7XHJcblx0XHQvLyBjb25zdCBlbmdpbmVEYXRhID0gcGFyc2VFbmdpbmVEYXRhKGRhdGEpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ3Jlc291cmNlcy9lbmdpbmVEYXRhMlNpbXBsZS50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdC8vIHJlcXVpcmUoJ2ZzJykud3JpdGVGaWxlU3luYygndGVzdF9kYXRhLmpzb24nLCBKU09OLnN0cmluZ2lmeShlZCwgbnVsbCwgMiksICd1dGY4Jyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IHRvQnl0ZUFycmF5KHRhcmdldC5lbmdpbmVEYXRhISk7XHJcblx0XHR3cml0ZUJ5dGVzKHdyaXRlciwgYnVmZmVyKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnRk1zaycsXHJcblx0aGFzS2V5KCdmaWx0ZXJNYXNrJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQuZmlsdGVyTWFzayA9IHtcclxuXHRcdFx0Y29sb3JTcGFjZTogcmVhZENvbG9yKHJlYWRlciksXHJcblx0XHRcdG9wYWNpdHk6IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmYsXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUNvbG9yKHdyaXRlciwgdGFyZ2V0LmZpbHRlck1hc2shLmNvbG9yU3BhY2UpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjbGFtcCh0YXJnZXQuZmlsdGVyTWFzayEub3BhY2l0eSA/PyAxLCAwLCAxKSAqIDB4ZmYpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5pbnRlcmZhY2UgQXJ0ZERlc2NyaXB0b3Ige1xyXG5cdCdDbnQgJzogbnVtYmVyO1xyXG5cdGF1dG9FeHBhbmRPZmZzZXQ6IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0b3JpZ2luOiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9O1xyXG5cdGF1dG9FeHBhbmRFbmFibGVkOiBib29sZWFuO1xyXG5cdGF1dG9OZXN0RW5hYmxlZDogYm9vbGVhbjtcclxuXHRhdXRvUG9zaXRpb25FbmFibGVkOiBib29sZWFuO1xyXG5cdHNocmlua3dyYXBPblNhdmVFbmFibGVkOiBib29sZWFuO1xyXG5cdGRvY0RlZmF1bHROZXdBcnRib2FyZEJhY2tncm91bmRDb2xvcjogRGVzY3JpcHRvckNvbG9yO1xyXG5cdGRvY0RlZmF1bHROZXdBcnRib2FyZEJhY2tncm91bmRUeXBlOiBudW1iZXI7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2FydGQnLCAvLyBkb2N1bWVudC13aWRlIGFydGJvYXJkIGluZm9cclxuXHR0YXJnZXQgPT4gKHRhcmdldCBhcyBQc2QpLmFydGJvYXJkcyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIEFydGREZXNjcmlwdG9yO1xyXG5cdFx0KHRhcmdldCBhcyBQc2QpLmFydGJvYXJkcyA9IHtcclxuXHRcdFx0Y291bnQ6IGRlc2NbJ0NudCAnXSxcclxuXHRcdFx0YXV0b0V4cGFuZE9mZnNldDogeyBob3Jpem9udGFsOiBkZXNjLmF1dG9FeHBhbmRPZmZzZXQuSHJ6biwgdmVydGljYWw6IGRlc2MuYXV0b0V4cGFuZE9mZnNldC5WcnRjIH0sXHJcblx0XHRcdG9yaWdpbjogeyBob3Jpem9udGFsOiBkZXNjLm9yaWdpbi5IcnpuLCB2ZXJ0aWNhbDogZGVzYy5vcmlnaW4uVnJ0YyB9LFxyXG5cdFx0XHRhdXRvRXhwYW5kRW5hYmxlZDogZGVzYy5hdXRvRXhwYW5kRW5hYmxlZCxcclxuXHRcdFx0YXV0b05lc3RFbmFibGVkOiBkZXNjLmF1dG9OZXN0RW5hYmxlZCxcclxuXHRcdFx0YXV0b1Bvc2l0aW9uRW5hYmxlZDogZGVzYy5hdXRvUG9zaXRpb25FbmFibGVkLFxyXG5cdFx0XHRzaHJpbmt3cmFwT25TYXZlRW5hYmxlZDogZGVzYy5zaHJpbmt3cmFwT25TYXZlRW5hYmxlZCxcclxuXHRcdFx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yOiBwYXJzZUNvbG9yKGRlc2MuZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yKSxcclxuXHRcdFx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGU6IGRlc2MuZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGUsXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGFydGIgPSAodGFyZ2V0IGFzIFBzZCkuYXJ0Ym9hcmRzITtcclxuXHRcdGNvbnN0IGRlc2M6IEFydGREZXNjcmlwdG9yID0ge1xyXG5cdFx0XHQnQ250ICc6IGFydGIuY291bnQsXHJcblx0XHRcdGF1dG9FeHBhbmRPZmZzZXQ6IGFydGIuYXV0b0V4cGFuZE9mZnNldCA/IHsgSHJ6bjogYXJ0Yi5hdXRvRXhwYW5kT2Zmc2V0Lmhvcml6b250YWwsIFZydGM6IGFydGIuYXV0b0V4cGFuZE9mZnNldC52ZXJ0aWNhbCB9IDogeyBIcnpuOiAwLCBWcnRjOiAwIH0sXHJcblx0XHRcdG9yaWdpbjogYXJ0Yi5vcmlnaW4gPyB7IEhyem46IGFydGIub3JpZ2luLmhvcml6b250YWwsIFZydGM6IGFydGIub3JpZ2luLnZlcnRpY2FsIH0gOiB7IEhyem46IDAsIFZydGM6IDAgfSxcclxuXHRcdFx0YXV0b0V4cGFuZEVuYWJsZWQ6IGFydGIuYXV0b0V4cGFuZEVuYWJsZWQgPz8gdHJ1ZSxcclxuXHRcdFx0YXV0b05lc3RFbmFibGVkOiBhcnRiLmF1dG9OZXN0RW5hYmxlZCA/PyB0cnVlLFxyXG5cdFx0XHRhdXRvUG9zaXRpb25FbmFibGVkOiBhcnRiLmF1dG9Qb3NpdGlvbkVuYWJsZWQgPz8gdHJ1ZSxcclxuXHRcdFx0c2hyaW5rd3JhcE9uU2F2ZUVuYWJsZWQ6IGFydGIuc2hyaW5rd3JhcE9uU2F2ZUVuYWJsZWQgPz8gdHJ1ZSxcclxuXHRcdFx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yOiBzZXJpYWxpemVDb2xvcihhcnRiLmRvY0RlZmF1bHROZXdBcnRib2FyZEJhY2tncm91bmRDb2xvciksXHJcblx0XHRcdGRvY0RlZmF1bHROZXdBcnRib2FyZEJhY2tncm91bmRUeXBlOiBhcnRiLmRvY0RlZmF1bHROZXdBcnRib2FyZEJhY2tncm91bmRUeXBlID8/IDEsXHJcblx0XHR9O1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MsICdhcnRkJyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBFZmZlY3REZXNjcmlwdG9yIGV4dGVuZHMgUGFydGlhbDxEZXNjcmlwdG9yR3JhZGllbnRDb250ZW50PiwgUGFydGlhbDxEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQ+IHtcclxuXHRlbmFiPzogYm9vbGVhbjtcclxuXHRTdHlsOiBzdHJpbmc7XHJcblx0UG50VD86IHN0cmluZztcclxuXHQnTWQgICc/OiBzdHJpbmc7XHJcblx0T3BjdD86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdCdTeiAgJz86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdCdDbHIgJz86IERlc2NyaXB0b3JDb2xvcjtcclxuXHRwcmVzZW50PzogYm9vbGVhbjtcclxuXHRzaG93SW5EaWFsb2c/OiBib29sZWFuO1xyXG5cdG92ZXJwcmludD86IGJvb2xlYW47XHJcbn1cclxuXHJcbmludGVyZmFjZSBMZngyRGVzY3JpcHRvciB7XHJcblx0J1NjbCAnPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0bWFzdGVyRlhTd2l0Y2g/OiBib29sZWFuO1xyXG5cdERyU2g/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdElyU2g/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdE9yR2w/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdElyR2w/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdGViYmw/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdFNvRmk/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdHBhdHRlcm5GaWxsPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRHckZsPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRDaEZYPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRGckZYPzogRWZmZWN0RGVzY3JpcHRvcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIExtZnhEZXNjcmlwdG9yIHtcclxuXHQnU2NsICc/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRtYXN0ZXJGWFN3aXRjaD86IGJvb2xlYW47XHJcblx0bnVtTW9kaWZ5aW5nRlg/OiBudW1iZXI7XHJcblx0T3JHbD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0SXJHbD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0ZWJibD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0Q2hGWD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0ZHJvcFNoYWRvd011bHRpPzogRWZmZWN0RGVzY3JpcHRvcltdO1xyXG5cdGlubmVyU2hhZG93TXVsdGk/OiBFZmZlY3REZXNjcmlwdG9yW107XHJcblx0c29saWRGaWxsTXVsdGk/OiBFZmZlY3REZXNjcmlwdG9yW107XHJcblx0Z3JhZGllbnRGaWxsTXVsdGk/OiBFZmZlY3REZXNjcmlwdG9yW107XHJcblx0ZnJhbWVGWE11bHRpPzogRWZmZWN0RGVzY3JpcHRvcltdO1xyXG5cdHBhdHRlcm5GaWxsPzogRWZmZWN0RGVzY3JpcHRvcjsgLy8gPz8/XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRnhPYmplY3QoZng6IEVmZmVjdERlc2NyaXB0b3IpIHtcclxuXHRjb25zdCBzdHJva2U6IExheWVyRWZmZWN0U3Ryb2tlID0ge1xyXG5cdFx0ZW5hYmxlZDogISFmeC5lbmFiLFxyXG5cdFx0cG9zaXRpb246IEZTdGwuZGVjb2RlKGZ4LlN0eWwpLFxyXG5cdFx0ZmlsbFR5cGU6IEZyRmwuZGVjb2RlKGZ4LlBudFQhKSxcclxuXHRcdGJsZW5kTW9kZTogQmxuTS5kZWNvZGUoZnhbJ01kICAnXSEpLFxyXG5cdFx0b3BhY2l0eTogcGFyc2VQZXJjZW50KGZ4Lk9wY3QpLFxyXG5cdFx0c2l6ZTogcGFyc2VVbml0cyhmeFsnU3ogICddISksXHJcblx0fTtcclxuXHJcblx0aWYgKGZ4LnByZXNlbnQgIT09IHVuZGVmaW5lZCkgc3Ryb2tlLnByZXNlbnQgPSBmeC5wcmVzZW50O1xyXG5cdGlmIChmeC5zaG93SW5EaWFsb2cgIT09IHVuZGVmaW5lZCkgc3Ryb2tlLnNob3dJbkRpYWxvZyA9IGZ4LnNob3dJbkRpYWxvZztcclxuXHRpZiAoZngub3ZlcnByaW50ICE9PSB1bmRlZmluZWQpIHN0cm9rZS5vdmVycHJpbnQgPSBmeC5vdmVycHJpbnQ7XHJcblx0aWYgKGZ4WydDbHIgJ10pIHN0cm9rZS5jb2xvciA9IHBhcnNlQ29sb3IoZnhbJ0NsciAnXSk7XHJcblx0aWYgKGZ4LkdyYWQpIHN0cm9rZS5ncmFkaWVudCA9IHBhcnNlR3JhZGllbnRDb250ZW50KGZ4IGFzIGFueSk7XHJcblx0aWYgKGZ4LlB0cm4pIHN0cm9rZS5wYXR0ZXJuID0gcGFyc2VQYXR0ZXJuQ29udGVudChmeCBhcyBhbnkpO1xyXG5cclxuXHRyZXR1cm4gc3Ryb2tlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVGeE9iamVjdChzdHJva2U6IExheWVyRWZmZWN0U3Ryb2tlKSB7XHJcblx0bGV0IEZyRlg6IEVmZmVjdERlc2NyaXB0b3IgPSB7fSBhcyBhbnk7XHJcblx0RnJGWC5lbmFiID0gISFzdHJva2UuZW5hYmxlZDtcclxuXHRpZiAoc3Ryb2tlLnByZXNlbnQgIT09IHVuZGVmaW5lZCkgRnJGWC5wcmVzZW50ID0gISFzdHJva2UucHJlc2VudDtcclxuXHRpZiAoc3Ryb2tlLnNob3dJbkRpYWxvZyAhPT0gdW5kZWZpbmVkKSBGckZYLnNob3dJbkRpYWxvZyA9ICEhc3Ryb2tlLnNob3dJbkRpYWxvZztcclxuXHRGckZYLlN0eWwgPSBGU3RsLmVuY29kZShzdHJva2UucG9zaXRpb24pO1xyXG5cdEZyRlguUG50VCA9IEZyRmwuZW5jb2RlKHN0cm9rZS5maWxsVHlwZSk7XHJcblx0RnJGWFsnTWQgICddID0gQmxuTS5lbmNvZGUoc3Ryb2tlLmJsZW5kTW9kZSk7XHJcblx0RnJGWC5PcGN0ID0gdW5pdHNQZXJjZW50KHN0cm9rZS5vcGFjaXR5KTtcclxuXHRGckZYWydTeiAgJ10gPSB1bml0c1ZhbHVlKHN0cm9rZS5zaXplLCAnc2l6ZScpO1xyXG5cdGlmIChzdHJva2UuY29sb3IpIEZyRlhbJ0NsciAnXSA9IHNlcmlhbGl6ZUNvbG9yKHN0cm9rZS5jb2xvcik7XHJcblx0aWYgKHN0cm9rZS5ncmFkaWVudCkgRnJGWCA9IHsgLi4uRnJGWCwgLi4uc2VyaWFsaXplR3JhZGllbnRDb250ZW50KHN0cm9rZS5ncmFkaWVudCkgfTtcclxuXHRpZiAoc3Ryb2tlLnBhdHRlcm4pIEZyRlggPSB7IC4uLkZyRlgsIC4uLnNlcmlhbGl6ZVBhdHRlcm5Db250ZW50KHN0cm9rZS5wYXR0ZXJuKSB9O1xyXG5cdGlmIChzdHJva2Uub3ZlcnByaW50ICE9PSB1bmRlZmluZWQpIEZyRlgub3ZlcnByaW50ID0gISFzdHJva2Uub3ZlcnByaW50O1xyXG5cdHJldHVybiBGckZYO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUVmZmVjdHMoaW5mbzogTGZ4MkRlc2NyaXB0b3IgJiBMbWZ4RGVzY3JpcHRvciwgbG9nOiBib29sZWFuKSB7XHJcblx0Y29uc3QgZWZmZWN0czogTGF5ZXJFZmZlY3RzSW5mbyA9IHt9O1xyXG5cdGlmICghaW5mby5tYXN0ZXJGWFN3aXRjaCkgZWZmZWN0cy5kaXNhYmxlZCA9IHRydWU7XHJcblx0aWYgKGluZm9bJ1NjbCAnXSkgZWZmZWN0cy5zY2FsZSA9IHBhcnNlUGVyY2VudChpbmZvWydTY2wgJ10pO1xyXG5cdGlmIChpbmZvLkRyU2gpIGVmZmVjdHMuZHJvcFNoYWRvdyA9IFtwYXJzZUVmZmVjdE9iamVjdChpbmZvLkRyU2gsIGxvZyldO1xyXG5cdGlmIChpbmZvLmRyb3BTaGFkb3dNdWx0aSkgZWZmZWN0cy5kcm9wU2hhZG93ID0gaW5mby5kcm9wU2hhZG93TXVsdGkubWFwKGkgPT4gcGFyc2VFZmZlY3RPYmplY3QoaSwgbG9nKSk7XHJcblx0aWYgKGluZm8uSXJTaCkgZWZmZWN0cy5pbm5lclNoYWRvdyA9IFtwYXJzZUVmZmVjdE9iamVjdChpbmZvLklyU2gsIGxvZyldO1xyXG5cdGlmIChpbmZvLmlubmVyU2hhZG93TXVsdGkpIGVmZmVjdHMuaW5uZXJTaGFkb3cgPSBpbmZvLmlubmVyU2hhZG93TXVsdGkubWFwKGkgPT4gcGFyc2VFZmZlY3RPYmplY3QoaSwgbG9nKSk7XHJcblx0aWYgKGluZm8uT3JHbCkgZWZmZWN0cy5vdXRlckdsb3cgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLk9yR2wsIGxvZyk7XHJcblx0aWYgKGluZm8uSXJHbCkgZWZmZWN0cy5pbm5lckdsb3cgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLklyR2wsIGxvZyk7XHJcblx0aWYgKGluZm8uZWJibCkgZWZmZWN0cy5iZXZlbCA9IHBhcnNlRWZmZWN0T2JqZWN0KGluZm8uZWJibCwgbG9nKTtcclxuXHRpZiAoaW5mby5Tb0ZpKSBlZmZlY3RzLnNvbGlkRmlsbCA9IFtwYXJzZUVmZmVjdE9iamVjdChpbmZvLlNvRmksIGxvZyldO1xyXG5cdGlmIChpbmZvLnNvbGlkRmlsbE11bHRpKSBlZmZlY3RzLnNvbGlkRmlsbCA9IGluZm8uc29saWRGaWxsTXVsdGkubWFwKGkgPT4gcGFyc2VFZmZlY3RPYmplY3QoaSwgbG9nKSk7XHJcblx0aWYgKGluZm8ucGF0dGVybkZpbGwpIGVmZmVjdHMucGF0dGVybk92ZXJsYXkgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLnBhdHRlcm5GaWxsLCBsb2cpO1xyXG5cdGlmIChpbmZvLkdyRmwpIGVmZmVjdHMuZ3JhZGllbnRPdmVybGF5ID0gW3BhcnNlRWZmZWN0T2JqZWN0KGluZm8uR3JGbCwgbG9nKV07XHJcblx0aWYgKGluZm8uZ3JhZGllbnRGaWxsTXVsdGkpIGVmZmVjdHMuZ3JhZGllbnRPdmVybGF5ID0gaW5mby5ncmFkaWVudEZpbGxNdWx0aS5tYXAoaSA9PiBwYXJzZUVmZmVjdE9iamVjdChpLCBsb2cpKTtcclxuXHRpZiAoaW5mby5DaEZYKSBlZmZlY3RzLnNhdGluID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5DaEZYLCBsb2cpO1xyXG5cdGlmIChpbmZvLkZyRlgpIGVmZmVjdHMuc3Ryb2tlID0gW3BhcnNlRnhPYmplY3QoaW5mby5GckZYKV07XHJcblx0aWYgKGluZm8uZnJhbWVGWE11bHRpKSBlZmZlY3RzLnN0cm9rZSA9IGluZm8uZnJhbWVGWE11bHRpLm1hcChpID0+IHBhcnNlRnhPYmplY3QoaSkpO1xyXG5cdHJldHVybiBlZmZlY3RzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVFZmZlY3RzKGU6IExheWVyRWZmZWN0c0luZm8sIGxvZzogYm9vbGVhbiwgbXVsdGk6IGJvb2xlYW4pIHtcclxuXHRjb25zdCBpbmZvOiBMZngyRGVzY3JpcHRvciAmIExtZnhEZXNjcmlwdG9yID0gbXVsdGkgPyB7XHJcblx0XHQnU2NsICc6IHVuaXRzUGVyY2VudChlLnNjYWxlID8/IDEpLFxyXG5cdFx0bWFzdGVyRlhTd2l0Y2g6ICFlLmRpc2FibGVkLFxyXG5cdH0gOiB7XHJcblx0XHRtYXN0ZXJGWFN3aXRjaDogIWUuZGlzYWJsZWQsXHJcblx0XHQnU2NsICc6IHVuaXRzUGVyY2VudChlLnNjYWxlID8/IDEpLFxyXG5cdH07XHJcblxyXG5cdGNvbnN0IGFycmF5S2V5czogKGtleW9mIExheWVyRWZmZWN0c0luZm8pW10gPSBbJ2Ryb3BTaGFkb3cnLCAnaW5uZXJTaGFkb3cnLCAnc29saWRGaWxsJywgJ2dyYWRpZW50T3ZlcmxheScsICdzdHJva2UnXTtcclxuXHRmb3IgKGNvbnN0IGtleSBvZiBhcnJheUtleXMpIHtcclxuXHRcdGlmIChlW2tleV0gJiYgIUFycmF5LmlzQXJyYXkoZVtrZXldKSkgdGhyb3cgbmV3IEVycm9yKGAke2tleX0gc2hvdWxkIGJlIGFuIGFycmF5YCk7XHJcblx0fVxyXG5cclxuXHRpZiAoZS5kcm9wU2hhZG93Py5bMF0gJiYgIW11bHRpKSBpbmZvLkRyU2ggPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5kcm9wU2hhZG93WzBdLCAnZHJvcFNoYWRvdycsIGxvZyk7XHJcblx0aWYgKGUuZHJvcFNoYWRvdz8uWzBdICYmIG11bHRpKSBpbmZvLmRyb3BTaGFkb3dNdWx0aSA9IGUuZHJvcFNoYWRvdy5tYXAoaSA9PiBzZXJpYWxpemVFZmZlY3RPYmplY3QoaSwgJ2Ryb3BTaGFkb3cnLCBsb2cpKTtcclxuXHRpZiAoZS5pbm5lclNoYWRvdz8uWzBdICYmICFtdWx0aSkgaW5mby5JclNoID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGUuaW5uZXJTaGFkb3dbMF0sICdpbm5lclNoYWRvdycsIGxvZyk7XHJcblx0aWYgKGUuaW5uZXJTaGFkb3c/LlswXSAmJiBtdWx0aSkgaW5mby5pbm5lclNoYWRvd011bHRpID0gZS5pbm5lclNoYWRvdy5tYXAoaSA9PiBzZXJpYWxpemVFZmZlY3RPYmplY3QoaSwgJ2lubmVyU2hhZG93JywgbG9nKSk7XHJcblx0aWYgKGUub3V0ZXJHbG93KSBpbmZvLk9yR2wgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5vdXRlckdsb3csICdvdXRlckdsb3cnLCBsb2cpO1xyXG5cdGlmIChlLnNvbGlkRmlsbD8uWzBdICYmIG11bHRpKSBpbmZvLnNvbGlkRmlsbE11bHRpID0gZS5zb2xpZEZpbGwubWFwKGkgPT4gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGksICdzb2xpZEZpbGwnLCBsb2cpKTtcclxuXHRpZiAoZS5ncmFkaWVudE92ZXJsYXk/LlswXSAmJiBtdWx0aSkgaW5mby5ncmFkaWVudEZpbGxNdWx0aSA9IGUuZ3JhZGllbnRPdmVybGF5Lm1hcChpID0+IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChpLCAnZ3JhZGllbnRPdmVybGF5JywgbG9nKSk7XHJcblx0aWYgKGUuc3Ryb2tlPy5bMF0gJiYgbXVsdGkpIGluZm8uZnJhbWVGWE11bHRpID0gZS5zdHJva2UubWFwKGkgPT4gc2VyaWFsaXplRnhPYmplY3QoaSkpO1xyXG5cdGlmIChlLmlubmVyR2xvdykgaW5mby5JckdsID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGUuaW5uZXJHbG93LCAnaW5uZXJHbG93JywgbG9nKTtcclxuXHRpZiAoZS5iZXZlbCkgaW5mby5lYmJsID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGUuYmV2ZWwsICdiZXZlbCcsIGxvZyk7XHJcblx0aWYgKGUuc29saWRGaWxsPy5bMF0gJiYgIW11bHRpKSBpbmZvLlNvRmkgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5zb2xpZEZpbGxbMF0sICdzb2xpZEZpbGwnLCBsb2cpO1xyXG5cdGlmIChlLnBhdHRlcm5PdmVybGF5KSBpbmZvLnBhdHRlcm5GaWxsID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGUucGF0dGVybk92ZXJsYXksICdwYXR0ZXJuT3ZlcmxheScsIGxvZyk7XHJcblx0aWYgKGUuZ3JhZGllbnRPdmVybGF5Py5bMF0gJiYgIW11bHRpKSBpbmZvLkdyRmwgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5ncmFkaWVudE92ZXJsYXlbMF0sICdncmFkaWVudE92ZXJsYXknLCBsb2cpO1xyXG5cdGlmIChlLnNhdGluKSBpbmZvLkNoRlggPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5zYXRpbiwgJ3NhdGluJywgbG9nKTtcclxuXHRpZiAoZS5zdHJva2U/LlswXSAmJiAhbXVsdGkpIGluZm8uRnJGWCA9IHNlcmlhbGl6ZUZ4T2JqZWN0KGUuc3Ryb2tlPy5bMF0pO1xyXG5cclxuXHRpZiAobXVsdGkpIHtcclxuXHRcdGluZm8ubnVtTW9kaWZ5aW5nRlggPSAwO1xyXG5cclxuXHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGUpKSB7XHJcblx0XHRcdGNvbnN0IHZhbHVlID0gKGUgYXMgYW55KVtrZXldO1xyXG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuXHRcdFx0XHRmb3IgKGNvbnN0IGVmZmVjdCBvZiB2YWx1ZSkge1xyXG5cdFx0XHRcdFx0aWYgKGVmZmVjdC5lbmFibGVkKSBpbmZvLm51bU1vZGlmeWluZ0ZYKys7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gaW5mbztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGhhc011bHRpRWZmZWN0cyhlZmZlY3RzOiBMYXllckVmZmVjdHNJbmZvKSB7XHJcblx0cmV0dXJuIE9iamVjdC5rZXlzKGVmZmVjdHMpLm1hcChrZXkgPT4gKGVmZmVjdHMgYXMgYW55KVtrZXldKS5zb21lKHYgPT4gQXJyYXkuaXNBcnJheSh2KSAmJiB2Lmxlbmd0aCA+IDEpO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsZngyJyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmVmZmVjdHMgIT09IHVuZGVmaW5lZCAmJiAhaGFzTXVsdGlFZmZlY3RzKHRhcmdldC5lZmZlY3RzKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIF8sIG9wdGlvbnMpID0+IHtcclxuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRpZiAodmVyc2lvbiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxmeDIgdmVyc2lvbmApO1xyXG5cclxuXHRcdGNvbnN0IGRlc2M6IExmeDJEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHQvLyBUT0RPOiBkb24ndCBkaXNjYXJkIGlmIHdlIGdvdCBpdCBmcm9tIGxtZnhcclxuXHRcdC8vIGRpc2NhcmQgaWYgcmVhZCBpbiAnbHJGWCcgc2VjdGlvblxyXG5cdFx0dGFyZ2V0LmVmZmVjdHMgPSBwYXJzZUVmZmVjdHMoZGVzYywgISFvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyk7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCwgXywgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYyA9IHNlcmlhbGl6ZUVmZmVjdHModGFyZ2V0LmVmZmVjdHMhLCAhIW9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzLCBmYWxzZSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBDaW5mRGVzY3JpcHRvciB7XHJcblx0VnJzbjogeyBtYWpvcjogbnVtYmVyOyBtaW5vcjogbnVtYmVyOyBmaXg6IG51bWJlcjsgfTtcclxuXHRwc1ZlcnNpb24/OiB7IG1ham9yOiBudW1iZXI7IG1pbm9yOiBudW1iZXI7IGZpeDogbnVtYmVyOyB9O1xyXG5cdGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcblx0cmVhc29uOiBzdHJpbmc7XHJcblx0RW5nbjogc3RyaW5nOyAvLyAnRW5nbi5jb21wQ29yZSc7XHJcblx0ZW5hYmxlQ29tcENvcmU6IHN0cmluZzsgLy8gJ2VuYWJsZS5mZWF0dXJlJztcclxuXHRlbmFibGVDb21wQ29yZUdQVTogc3RyaW5nOyAvLyAnZW5hYmxlLmZlYXR1cmUnO1xyXG5cdGVuYWJsZUNvbXBDb3JlVGhyZWFkcz86IHN0cmluZzsgLy8gJ2VuYWJsZS5mZWF0dXJlJztcclxuXHRjb21wQ29yZVN1cHBvcnQ6IHN0cmluZzsgLy8gJ3JlYXNvbi5zdXBwb3J0ZWQnO1xyXG5cdGNvbXBDb3JlR1BVU3VwcG9ydDogc3RyaW5nOyAvLyAncmVhc29uLmZlYXR1cmVEaXNhYmxlZCc7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2NpbmYnLFxyXG5cdGhhc0tleSgnY29tcG9zaXRvclVzZWQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBDaW5mRGVzY3JpcHRvcjtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdHRhcmdldC5jb21wb3NpdG9yVXNlZCA9IHtcclxuXHRcdFx0ZGVzY3JpcHRpb246IGRlc2MuZGVzY3JpcHRpb24sXHJcblx0XHRcdHJlYXNvbjogZGVzYy5yZWFzb24sXHJcblx0XHRcdGVuZ2luZTogZGVzYy5FbmduLnNwbGl0KCcuJylbMV0sXHJcblx0XHRcdGVuYWJsZUNvbXBDb3JlOiBkZXNjLmVuYWJsZUNvbXBDb3JlLnNwbGl0KCcuJylbMV0sXHJcblx0XHRcdGVuYWJsZUNvbXBDb3JlR1BVOiBkZXNjLmVuYWJsZUNvbXBDb3JlR1BVLnNwbGl0KCcuJylbMV0sXHJcblx0XHRcdGNvbXBDb3JlU3VwcG9ydDogZGVzYy5jb21wQ29yZVN1cHBvcnQuc3BsaXQoJy4nKVsxXSxcclxuXHRcdFx0Y29tcENvcmVHUFVTdXBwb3J0OiBkZXNjLmNvbXBDb3JlR1BVU3VwcG9ydC5zcGxpdCgnLicpWzFdLFxyXG5cdFx0fTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBjaW5mID0gdGFyZ2V0LmNvbXBvc2l0b3JVc2VkITtcclxuXHRcdGNvbnN0IGRlc2M6IENpbmZEZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRWcnNuOiB7IG1ham9yOiAxLCBtaW5vcjogMCwgZml4OiAwIH0sIC8vIFRFTVBcclxuXHRcdFx0Ly8gcHNWZXJzaW9uOiB7IG1ham9yOiAyMiwgbWlub3I6IDMsIGZpeDogMSB9LCAvLyBURVNUSU5HXHJcblx0XHRcdGRlc2NyaXB0aW9uOiBjaW5mLmRlc2NyaXB0aW9uLFxyXG5cdFx0XHRyZWFzb246IGNpbmYucmVhc29uLFxyXG5cdFx0XHRFbmduOiBgRW5nbi4ke2NpbmYuZW5naW5lfWAsXHJcblx0XHRcdGVuYWJsZUNvbXBDb3JlOiBgZW5hYmxlLiR7Y2luZi5lbmFibGVDb21wQ29yZX1gLFxyXG5cdFx0XHRlbmFibGVDb21wQ29yZUdQVTogYGVuYWJsZS4ke2NpbmYuZW5hYmxlQ29tcENvcmVHUFV9YCxcclxuXHRcdFx0Ly8gZW5hYmxlQ29tcENvcmVUaHJlYWRzOiBgZW5hYmxlLmZlYXR1cmVgLCAvLyBURVNUSU5HXHJcblx0XHRcdGNvbXBDb3JlU3VwcG9ydDogYHJlYXNvbi4ke2NpbmYuY29tcENvcmVTdXBwb3J0fWAsXHJcblx0XHRcdGNvbXBDb3JlR1BVU3VwcG9ydDogYHJlYXNvbi4ke2NpbmYuY29tcENvcmVHUFVTdXBwb3J0fWAsXHJcblx0XHR9O1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG4vLyBleHRlbnNpb24gc2V0dGluZ3MgPywgaWdub3JlIGl0XHJcbmFkZEhhbmRsZXIoXHJcblx0J2V4dG4nLFxyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIGFueSkuX2V4dG4gIT09IHVuZGVmaW5lZCxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2M6IEV4dGVuc2lvbkRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSAodGFyZ2V0IGFzIGFueSkuX2V4dG4gPSBkZXNjO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHQvLyBUT0RPOiBuZWVkIHRvIGFkZCBjb3JyZWN0IHR5cGVzIGZvciBkZXNjIGZpZWxkcyAocmVzb3VyY2VzL3NyYy5wc2QpXHJcblx0XHRpZiAoTU9DS19IQU5ETEVSUykgd3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsICh0YXJnZXQgYXMgYW55KS5fZXh0bik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2lPcGEnLFxyXG5cdGhhc0tleSgnZmlsbE9wYWNpdHknKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5maWxsT3BhY2l0eSA9IHJlYWRVaW50OChyZWFkZXIpIC8gMHhmZjtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDMpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgdGFyZ2V0LmZpbGxPcGFjaXR5ISAqIDB4ZmYpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCd0c2x5JyxcclxuXHRoYXNLZXkoJ3RyYW5zcGFyZW5jeVNoYXBlc0xheWVyJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQudHJhbnNwYXJlbmN5U2hhcGVzTGF5ZXIgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQudHJhbnNwYXJlbmN5U2hhcGVzTGF5ZXIgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0fSxcclxuKTtcclxuXHJcbi8vIGRlc2NyaXB0b3IgaGVscGVyc1xyXG5cclxuZnVuY3Rpb24gcGFyc2VHcmFkaWVudChncmFkOiBEZXNjaXB0b3JHcmFkaWVudCk6IEVmZmVjdFNvbGlkR3JhZGllbnQgfCBFZmZlY3ROb2lzZUdyYWRpZW50IHtcclxuXHRpZiAoZ3JhZC5HcmRGID09PSAnR3JkRi5Dc3RTJykge1xyXG5cdFx0Y29uc3Qgc2FtcGxlczogbnVtYmVyID0gZ3JhZC5JbnRyIHx8IDQwOTY7XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0dHlwZTogJ3NvbGlkJyxcclxuXHRcdFx0bmFtZTogZ3JhZFsnTm0gICddLFxyXG5cdFx0XHRzbW9vdGhuZXNzOiBncmFkLkludHIgLyA0MDk2LFxyXG5cdFx0XHRjb2xvclN0b3BzOiBncmFkLkNscnMubWFwKHMgPT4gKHtcclxuXHRcdFx0XHRjb2xvcjogcGFyc2VDb2xvcihzWydDbHIgJ10pLFxyXG5cdFx0XHRcdGxvY2F0aW9uOiBzLkxjdG4gLyBzYW1wbGVzLFxyXG5cdFx0XHRcdG1pZHBvaW50OiBzLk1kcG4gLyAxMDAsXHJcblx0XHRcdH0pKSxcclxuXHRcdFx0b3BhY2l0eVN0b3BzOiBncmFkLlRybnMubWFwKHMgPT4gKHtcclxuXHRcdFx0XHRvcGFjaXR5OiBwYXJzZVBlcmNlbnQocy5PcGN0KSxcclxuXHRcdFx0XHRsb2NhdGlvbjogcy5MY3RuIC8gc2FtcGxlcyxcclxuXHRcdFx0XHRtaWRwb2ludDogcy5NZHBuIC8gMTAwLFxyXG5cdFx0XHR9KSksXHJcblx0XHR9O1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHR0eXBlOiAnbm9pc2UnLFxyXG5cdFx0XHRuYW1lOiBncmFkWydObSAgJ10sXHJcblx0XHRcdHJvdWdobmVzczogZ3JhZC5TbXRoIC8gNDA5NixcclxuXHRcdFx0Y29sb3JNb2RlbDogQ2xyUy5kZWNvZGUoZ3JhZC5DbHJTKSxcclxuXHRcdFx0cmFuZG9tU2VlZDogZ3JhZC5SbmRTLFxyXG5cdFx0XHRyZXN0cmljdENvbG9yczogISFncmFkLlZjdEMsXHJcblx0XHRcdGFkZFRyYW5zcGFyZW5jeTogISFncmFkLlNoVHIsXHJcblx0XHRcdG1pbjogZ3JhZFsnTW5tICddLm1hcCh4ID0+IHggLyAxMDApLFxyXG5cdFx0XHRtYXg6IGdyYWRbJ014bSAnXS5tYXAoeCA9PiB4IC8gMTAwKSxcclxuXHRcdH07XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVHcmFkaWVudChncmFkOiBFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCk6IERlc2NpcHRvckdyYWRpZW50IHtcclxuXHRpZiAoZ3JhZC50eXBlID09PSAnc29saWQnKSB7XHJcblx0XHRjb25zdCBzYW1wbGVzID0gTWF0aC5yb3VuZCgoZ3JhZC5zbW9vdGhuZXNzID8/IDEpICogNDA5Nik7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHQnTm0gICc6IGdyYWQubmFtZSB8fCAnJyxcclxuXHRcdFx0R3JkRjogJ0dyZEYuQ3N0UycsXHJcblx0XHRcdEludHI6IHNhbXBsZXMsXHJcblx0XHRcdENscnM6IGdyYWQuY29sb3JTdG9wcy5tYXAocyA9PiAoe1xyXG5cdFx0XHRcdCdDbHIgJzogc2VyaWFsaXplQ29sb3Iocy5jb2xvciksXHJcblx0XHRcdFx0VHlwZTogJ0NscnkuVXNyUycsXHJcblx0XHRcdFx0TGN0bjogTWF0aC5yb3VuZChzLmxvY2F0aW9uICogc2FtcGxlcyksXHJcblx0XHRcdFx0TWRwbjogTWF0aC5yb3VuZCgocy5taWRwb2ludCA/PyAwLjUpICogMTAwKSxcclxuXHRcdFx0fSkpLFxyXG5cdFx0XHRUcm5zOiBncmFkLm9wYWNpdHlTdG9wcy5tYXAocyA9PiAoe1xyXG5cdFx0XHRcdE9wY3Q6IHVuaXRzUGVyY2VudChzLm9wYWNpdHkpLFxyXG5cdFx0XHRcdExjdG46IE1hdGgucm91bmQocy5sb2NhdGlvbiAqIHNhbXBsZXMpLFxyXG5cdFx0XHRcdE1kcG46IE1hdGgucm91bmQoKHMubWlkcG9pbnQgPz8gMC41KSAqIDEwMCksXHJcblx0XHRcdH0pKSxcclxuXHRcdH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdEdyZEY6ICdHcmRGLkNsTnMnLFxyXG5cdFx0XHQnTm0gICc6IGdyYWQubmFtZSB8fCAnJyxcclxuXHRcdFx0U2hUcjogISFncmFkLmFkZFRyYW5zcGFyZW5jeSxcclxuXHRcdFx0VmN0QzogISFncmFkLnJlc3RyaWN0Q29sb3JzLFxyXG5cdFx0XHRDbHJTOiBDbHJTLmVuY29kZShncmFkLmNvbG9yTW9kZWwpLFxyXG5cdFx0XHRSbmRTOiBncmFkLnJhbmRvbVNlZWQgfHwgMCxcclxuXHRcdFx0U210aDogTWF0aC5yb3VuZCgoZ3JhZC5yb3VnaG5lc3MgPz8gMSkgKiA0MDk2KSxcclxuXHRcdFx0J01ubSAnOiAoZ3JhZC5taW4gfHwgWzAsIDAsIDAsIDBdKS5tYXAoeCA9PiB4ICogMTAwKSxcclxuXHRcdFx0J014bSAnOiAoZ3JhZC5tYXggfHwgWzEsIDEsIDEsIDFdKS5tYXAoeCA9PiB4ICogMTAwKSxcclxuXHRcdH07XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUdyYWRpZW50Q29udGVudChkZXNjcmlwdG9yOiBEZXNjcmlwdG9yR3JhZGllbnRDb250ZW50KSB7XHJcblx0Y29uc3QgcmVzdWx0ID0gcGFyc2VHcmFkaWVudChkZXNjcmlwdG9yLkdyYWQpIGFzIChFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCkgJiBFeHRyYUdyYWRpZW50SW5mbztcclxuXHRyZXN1bHQuc3R5bGUgPSBHcmRULmRlY29kZShkZXNjcmlwdG9yLlR5cGUpO1xyXG5cdGlmIChkZXNjcmlwdG9yLkR0aHIgIT09IHVuZGVmaW5lZCkgcmVzdWx0LmRpdGhlciA9IGRlc2NyaXB0b3IuRHRocjtcclxuXHRpZiAoZGVzY3JpcHRvci5SdnJzICE9PSB1bmRlZmluZWQpIHJlc3VsdC5yZXZlcnNlID0gZGVzY3JpcHRvci5SdnJzO1xyXG5cdGlmIChkZXNjcmlwdG9yLkFuZ2wgIT09IHVuZGVmaW5lZCkgcmVzdWx0LmFuZ2xlID0gcGFyc2VBbmdsZShkZXNjcmlwdG9yLkFuZ2wpO1xyXG5cdGlmIChkZXNjcmlwdG9yWydTY2wgJ10gIT09IHVuZGVmaW5lZCkgcmVzdWx0LnNjYWxlID0gcGFyc2VQZXJjZW50KGRlc2NyaXB0b3JbJ1NjbCAnXSk7XHJcblx0aWYgKGRlc2NyaXB0b3IuQWxnbiAhPT0gdW5kZWZpbmVkKSByZXN1bHQuYWxpZ24gPSBkZXNjcmlwdG9yLkFsZ247XHJcblx0aWYgKGRlc2NyaXB0b3IuT2ZzdCAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRyZXN1bHQub2Zmc2V0ID0ge1xyXG5cdFx0XHR4OiBwYXJzZVBlcmNlbnQoZGVzY3JpcHRvci5PZnN0Lkhyem4pLFxyXG5cdFx0XHR5OiBwYXJzZVBlcmNlbnQoZGVzY3JpcHRvci5PZnN0LlZydGMpXHJcblx0XHR9O1xyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZVBhdHRlcm5Db250ZW50KGRlc2NyaXB0b3I6IERlc2NyaXB0b3JQYXR0ZXJuQ29udGVudCkge1xyXG5cdGNvbnN0IHJlc3VsdDogRWZmZWN0UGF0dGVybiAmIEV4dHJhUGF0dGVybkluZm8gPSB7XHJcblx0XHRuYW1lOiBkZXNjcmlwdG9yLlB0cm5bJ05tICAnXSxcclxuXHRcdGlkOiBkZXNjcmlwdG9yLlB0cm4uSWRudCxcclxuXHR9O1xyXG5cdGlmIChkZXNjcmlwdG9yLkxua2QgIT09IHVuZGVmaW5lZCkgcmVzdWx0LmxpbmtlZCA9IGRlc2NyaXB0b3IuTG5rZDtcclxuXHRpZiAoZGVzY3JpcHRvci5waGFzZSAhPT0gdW5kZWZpbmVkKSByZXN1bHQucGhhc2UgPSB7IHg6IGRlc2NyaXB0b3IucGhhc2UuSHJ6biwgeTogZGVzY3JpcHRvci5waGFzZS5WcnRjIH07XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VWZWN0b3JDb250ZW50KGRlc2NyaXB0b3I6IERlc2NyaXB0b3JWZWN0b3JDb250ZW50KTogVmVjdG9yQ29udGVudCB7XHJcblx0aWYgKCdHcmFkJyBpbiBkZXNjcmlwdG9yKSB7XHJcblx0XHRyZXR1cm4gcGFyc2VHcmFkaWVudENvbnRlbnQoZGVzY3JpcHRvcik7XHJcblx0fSBlbHNlIGlmICgnUHRybicgaW4gZGVzY3JpcHRvcikge1xyXG5cdFx0cmV0dXJuIHsgdHlwZTogJ3BhdHRlcm4nLCAuLi5wYXJzZVBhdHRlcm5Db250ZW50KGRlc2NyaXB0b3IpIH07XHJcblx0fSBlbHNlIGlmICgnQ2xyICcgaW4gZGVzY3JpcHRvcikge1xyXG5cdFx0cmV0dXJuIHsgdHlwZTogJ2NvbG9yJywgY29sb3I6IHBhcnNlQ29sb3IoZGVzY3JpcHRvclsnQ2xyICddKSB9O1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdmVjdG9yIGNvbnRlbnQnKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZUdyYWRpZW50Q29udGVudChjb250ZW50OiAoRWZmZWN0U29saWRHcmFkaWVudCB8IEVmZmVjdE5vaXNlR3JhZGllbnQpICYgRXh0cmFHcmFkaWVudEluZm8pIHtcclxuXHRjb25zdCByZXN1bHQ6IERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQgPSB7fSBhcyBhbnk7XHJcblx0aWYgKGNvbnRlbnQuZGl0aGVyICE9PSB1bmRlZmluZWQpIHJlc3VsdC5EdGhyID0gY29udGVudC5kaXRoZXI7XHJcblx0aWYgKGNvbnRlbnQucmV2ZXJzZSAhPT0gdW5kZWZpbmVkKSByZXN1bHQuUnZycyA9IGNvbnRlbnQucmV2ZXJzZTtcclxuXHRpZiAoY29udGVudC5hbmdsZSAhPT0gdW5kZWZpbmVkKSByZXN1bHQuQW5nbCA9IHVuaXRzQW5nbGUoY29udGVudC5hbmdsZSk7XHJcblx0cmVzdWx0LlR5cGUgPSBHcmRULmVuY29kZShjb250ZW50LnN0eWxlKTtcclxuXHRpZiAoY29udGVudC5hbGlnbiAhPT0gdW5kZWZpbmVkKSByZXN1bHQuQWxnbiA9IGNvbnRlbnQuYWxpZ247XHJcblx0aWYgKGNvbnRlbnQuc2NhbGUgIT09IHVuZGVmaW5lZCkgcmVzdWx0WydTY2wgJ10gPSB1bml0c1BlcmNlbnQoY29udGVudC5zY2FsZSk7XHJcblx0aWYgKGNvbnRlbnQub2Zmc2V0KSB7XHJcblx0XHRyZXN1bHQuT2ZzdCA9IHtcclxuXHRcdFx0SHJ6bjogdW5pdHNQZXJjZW50KGNvbnRlbnQub2Zmc2V0LngpLFxyXG5cdFx0XHRWcnRjOiB1bml0c1BlcmNlbnQoY29udGVudC5vZmZzZXQueSksXHJcblx0XHR9O1xyXG5cdH1cclxuXHRyZXN1bHQuR3JhZCA9IHNlcmlhbGl6ZUdyYWRpZW50KGNvbnRlbnQpO1xyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZVBhdHRlcm5Db250ZW50KGNvbnRlbnQ6IEVmZmVjdFBhdHRlcm4gJiBFeHRyYVBhdHRlcm5JbmZvKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQgPSB7XHJcblx0XHRQdHJuOiB7XHJcblx0XHRcdCdObSAgJzogY29udGVudC5uYW1lIHx8ICcnLFxyXG5cdFx0XHRJZG50OiBjb250ZW50LmlkIHx8ICcnLFxyXG5cdFx0fVxyXG5cdH07XHJcblx0aWYgKGNvbnRlbnQubGlua2VkICE9PSB1bmRlZmluZWQpIHJlc3VsdC5MbmtkID0gISFjb250ZW50LmxpbmtlZDtcclxuXHRpZiAoY29udGVudC5waGFzZSAhPT0gdW5kZWZpbmVkKSByZXN1bHQucGhhc2UgPSB7IEhyem46IGNvbnRlbnQucGhhc2UueCwgVnJ0YzogY29udGVudC5waGFzZS55IH07XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gc2VyaWFsaXplVmVjdG9yQ29udGVudChjb250ZW50OiBWZWN0b3JDb250ZW50KTogeyBkZXNjcmlwdG9yOiBEZXNjcmlwdG9yVmVjdG9yQ29udGVudDsga2V5OiBzdHJpbmc7IH0ge1xyXG5cdGlmIChjb250ZW50LnR5cGUgPT09ICdjb2xvcicpIHtcclxuXHRcdHJldHVybiB7IGtleTogJ1NvQ28nLCBkZXNjcmlwdG9yOiB7ICdDbHIgJzogc2VyaWFsaXplQ29sb3IoY29udGVudC5jb2xvcikgfSB9O1xyXG5cdH0gZWxzZSBpZiAoY29udGVudC50eXBlID09PSAncGF0dGVybicpIHtcclxuXHRcdHJldHVybiB7IGtleTogJ1B0RmwnLCBkZXNjcmlwdG9yOiBzZXJpYWxpemVQYXR0ZXJuQ29udGVudChjb250ZW50KSB9O1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4geyBrZXk6ICdHZEZsJywgZGVzY3JpcHRvcjogc2VyaWFsaXplR3JhZGllbnRDb250ZW50KGNvbnRlbnQpIH07XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUNvbG9yKGNvbG9yOiBEZXNjcmlwdG9yQ29sb3IpOiBDb2xvciB7XHJcblx0aWYgKCdIICAgJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgaDogcGFyc2VQZXJjZW50T3JBbmdsZShjb2xvclsnSCAgICddKSwgczogY29sb3IuU3RydCwgYjogY29sb3IuQnJnaCB9O1xyXG5cdH0gZWxzZSBpZiAoJ1JkICAnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyByOiBjb2xvclsnUmQgICddLCBnOiBjb2xvclsnR3JuICddLCBiOiBjb2xvclsnQmwgICddIH07XHJcblx0fSBlbHNlIGlmICgnQ3luICcgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7IGM6IGNvbG9yWydDeW4gJ10sIG06IGNvbG9yLk1nbnQsIHk6IGNvbG9yWydZbHcgJ10sIGs6IGNvbG9yLkJsY2sgfTtcclxuXHR9IGVsc2UgaWYgKCdHcnkgJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgazogY29sb3JbJ0dyeSAnXSB9O1xyXG5cdH0gZWxzZSBpZiAoJ0xtbmMnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyBsOiBjb2xvci5MbW5jLCBhOiBjb2xvclsnQSAgICddLCBiOiBjb2xvclsnQiAgICddIH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgY29sb3IgZGVzY3JpcHRvcicpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2VyaWFsaXplQ29sb3IoY29sb3I6IENvbG9yIHwgdW5kZWZpbmVkKTogRGVzY3JpcHRvckNvbG9yIHtcclxuXHRpZiAoIWNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyAnUmQgICc6IDAsICdHcm4gJzogMCwgJ0JsICAnOiAwIH07XHJcblx0fSBlbHNlIGlmICgncicgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7ICdSZCAgJzogY29sb3IuciB8fCAwLCAnR3JuICc6IGNvbG9yLmcgfHwgMCwgJ0JsICAnOiBjb2xvci5iIHx8IDAgfTtcclxuXHR9IGVsc2UgaWYgKCdoJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgJ0ggICAnOiB1bml0c0FuZ2xlKGNvbG9yLmggKiAzNjApLCBTdHJ0OiBjb2xvci5zIHx8IDAsIEJyZ2g6IGNvbG9yLmIgfHwgMCB9O1xyXG5cdH0gZWxzZSBpZiAoJ2MnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyAnQ3luICc6IGNvbG9yLmMgfHwgMCwgTWdudDogY29sb3IubSB8fCAwLCAnWWx3ICc6IGNvbG9yLnkgfHwgMCwgQmxjazogY29sb3IuayB8fCAwIH07XHJcblx0fSBlbHNlIGlmICgnbCcgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7IExtbmM6IGNvbG9yLmwgfHwgMCwgJ0EgICAnOiBjb2xvci5hIHx8IDAsICdCICAgJzogY29sb3IuYiB8fCAwIH07XHJcblx0fSBlbHNlIGlmICgnaycgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7ICdHcnkgJzogY29sb3IuayB9O1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29sb3IgdmFsdWUnKTtcclxuXHR9XHJcbn1cclxuXHJcbnR5cGUgQWxsRWZmZWN0cyA9IExheWVyRWZmZWN0U2hhZG93ICYgTGF5ZXJFZmZlY3RzT3V0ZXJHbG93ICYgTGF5ZXJFZmZlY3RTdHJva2UgJlxyXG5cdExheWVyRWZmZWN0SW5uZXJHbG93ICYgTGF5ZXJFZmZlY3RCZXZlbCAmIExheWVyRWZmZWN0U29saWRGaWxsICZcclxuXHRMYXllckVmZmVjdFBhdHRlcm5PdmVybGF5ICYgTGF5ZXJFZmZlY3RTYXRpbiAmIExheWVyRWZmZWN0R3JhZGllbnRPdmVybGF5O1xyXG5cclxuZnVuY3Rpb24gcGFyc2VFZmZlY3RPYmplY3Qob2JqOiBhbnksIHJlcG9ydEVycm9yczogYm9vbGVhbikge1xyXG5cdGNvbnN0IHJlc3VsdDogQWxsRWZmZWN0cyA9IHt9IGFzIGFueTtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xyXG5cdFx0Y29uc3QgdmFsID0gb2JqW2tleV07XHJcblxyXG5cdFx0c3dpdGNoIChrZXkpIHtcclxuXHRcdFx0Y2FzZSAnZW5hYic6IHJlc3VsdC5lbmFibGVkID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICd1Z2xnJzogcmVzdWx0LnVzZUdsb2JhbExpZ2h0ID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdBbnRBJzogcmVzdWx0LmFudGlhbGlhc2VkID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdBbGduJzogcmVzdWx0LmFsaWduID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdEdGhyJzogcmVzdWx0LmRpdGhlciA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnSW52cic6IHJlc3VsdC5pbnZlcnQgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ1J2cnMnOiByZXN1bHQucmV2ZXJzZSA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnQ2xyICc6IHJlc3VsdC5jb2xvciA9IHBhcnNlQ29sb3IodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2hnbEMnOiByZXN1bHQuaGlnaGxpZ2h0Q29sb3IgPSBwYXJzZUNvbG9yKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzZHdDJzogcmVzdWx0LnNoYWRvd0NvbG9yID0gcGFyc2VDb2xvcih2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnU3R5bCc6IHJlc3VsdC5wb3NpdGlvbiA9IEZTdGwuZGVjb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdNZCAgJzogcmVzdWx0LmJsZW5kTW9kZSA9IEJsbk0uZGVjb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdoZ2xNJzogcmVzdWx0LmhpZ2hsaWdodEJsZW5kTW9kZSA9IEJsbk0uZGVjb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzZHdNJzogcmVzdWx0LnNoYWRvd0JsZW5kTW9kZSA9IEJsbk0uZGVjb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdidmxTJzogcmVzdWx0LnN0eWxlID0gQkVTbC5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2J2bEQnOiByZXN1bHQuZGlyZWN0aW9uID0gQkVTcy5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2J2bFQnOiByZXN1bHQudGVjaG5pcXVlID0gYnZsVC5kZWNvZGUodmFsKSBhcyBhbnk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdHbHdUJzogcmVzdWx0LnRlY2huaXF1ZSA9IEJFVEUuZGVjb2RlKHZhbCkgYXMgYW55OyBicmVhaztcclxuXHRcdFx0Y2FzZSAnZ2x3Uyc6IHJlc3VsdC5zb3VyY2UgPSBJR1NyLmRlY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnVHlwZSc6IHJlc3VsdC50eXBlID0gR3JkVC5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ09wY3QnOiByZXN1bHQub3BhY2l0eSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaGdsTyc6IHJlc3VsdC5oaWdobGlnaHRPcGFjaXR5ID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzZHdPJzogcmVzdWx0LnNoYWRvd09wYWNpdHkgPSBwYXJzZVBlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2xhZ2wnOiByZXN1bHQuYW5nbGUgPSBwYXJzZUFuZ2xlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdBbmdsJzogcmVzdWx0LmFuZ2xlID0gcGFyc2VBbmdsZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnTGFsZCc6IHJlc3VsdC5hbHRpdHVkZSA9IHBhcnNlQW5nbGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ1NmdG4nOiByZXN1bHQuc29mdGVuID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc3JnUic6IHJlc3VsdC5zdHJlbmd0aCA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYmx1cic6IHJlc3VsdC5zaXplID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnTm9zZSc6IHJlc3VsdC5ub2lzZSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnSW5wcic6IHJlc3VsdC5yYW5nZSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnQ2ttdCc6IHJlc3VsdC5jaG9rZSA9IHBhcnNlVW5pdHModmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ1NoZE4nOiByZXN1bHQuaml0dGVyID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdEc3RuJzogcmVzdWx0LmRpc3RhbmNlID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnU2NsICc6IHJlc3VsdC5zY2FsZSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnUHRybic6IHJlc3VsdC5wYXR0ZXJuID0geyBuYW1lOiB2YWxbJ05tICAnXSwgaWQ6IHZhbC5JZG50IH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdwaGFzZSc6IHJlc3VsdC5waGFzZSA9IHsgeDogdmFsLkhyem4sIHk6IHZhbC5WcnRjIH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdPZnN0JzogcmVzdWx0Lm9mZnNldCA9IHsgeDogcGFyc2VQZXJjZW50KHZhbC5IcnpuKSwgeTogcGFyc2VQZXJjZW50KHZhbC5WcnRjKSB9OyBicmVhaztcclxuXHRcdFx0Y2FzZSAnTXBnUyc6XHJcblx0XHRcdGNhc2UgJ1RyblMnOlxyXG5cdFx0XHRcdHJlc3VsdC5jb250b3VyID0ge1xyXG5cdFx0XHRcdFx0bmFtZTogdmFsWydObSAgJ10sXHJcblx0XHRcdFx0XHRjdXJ2ZTogKHZhbFsnQ3J2ICddIGFzIGFueVtdKS5tYXAocCA9PiAoeyB4OiBwLkhyem4sIHk6IHAuVnJ0YyB9KSksXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnR3JhZCc6IHJlc3VsdC5ncmFkaWVudCA9IHBhcnNlR3JhZGllbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3VzZVRleHR1cmUnOlxyXG5cdFx0XHRjYXNlICd1c2VTaGFwZSc6XHJcblx0XHRcdGNhc2UgJ2xheWVyQ29uY2VhbHMnOlxyXG5cdFx0XHRjYXNlICdwcmVzZW50JzpcclxuXHRcdFx0Y2FzZSAnc2hvd0luRGlhbG9nJzpcclxuXHRcdFx0Y2FzZSAnYW50aWFsaWFzR2xvc3MnOiByZXN1bHRba2V5XSA9IHZhbDsgYnJlYWs7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0cmVwb3J0RXJyb3JzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIGVmZmVjdCBrZXk6ICcke2tleX0nOmAsIHZhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVFZmZlY3RPYmplY3Qob2JqOiBhbnksIG9iak5hbWU6IHN0cmluZywgcmVwb3J0RXJyb3JzOiBib29sZWFuKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcclxuXHJcblx0Zm9yIChjb25zdCBvYmpLZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xyXG5cdFx0Y29uc3Qga2V5OiBrZXlvZiBBbGxFZmZlY3RzID0gb2JqS2V5IGFzIGFueTtcclxuXHRcdGNvbnN0IHZhbCA9IG9ialtrZXldO1xyXG5cclxuXHRcdHN3aXRjaCAoa2V5KSB7XHJcblx0XHRcdGNhc2UgJ2VuYWJsZWQnOiByZXN1bHQuZW5hYiA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAndXNlR2xvYmFsTGlnaHQnOiByZXN1bHQudWdsZyA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYW50aWFsaWFzZWQnOiByZXN1bHQuQW50QSA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYWxpZ24nOiByZXN1bHQuQWxnbiA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnZGl0aGVyJzogcmVzdWx0LkR0aHIgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2ludmVydCc6IHJlc3VsdC5JbnZyID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdyZXZlcnNlJzogcmVzdWx0LlJ2cnMgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2NvbG9yJzogcmVzdWx0WydDbHIgJ10gPSBzZXJpYWxpemVDb2xvcih2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaGlnaGxpZ2h0Q29sb3InOiByZXN1bHQuaGdsQyA9IHNlcmlhbGl6ZUNvbG9yKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzaGFkb3dDb2xvcic6IHJlc3VsdC5zZHdDID0gc2VyaWFsaXplQ29sb3IodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3Bvc2l0aW9uJzogcmVzdWx0LlN0eWwgPSBGU3RsLmVuY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYmxlbmRNb2RlJzogcmVzdWx0WydNZCAgJ10gPSBCbG5NLmVuY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaGlnaGxpZ2h0QmxlbmRNb2RlJzogcmVzdWx0LmhnbE0gPSBCbG5NLmVuY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc2hhZG93QmxlbmRNb2RlJzogcmVzdWx0LnNkd00gPSBCbG5NLmVuY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc3R5bGUnOiByZXN1bHQuYnZsUyA9IEJFU2wuZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdkaXJlY3Rpb24nOiByZXN1bHQuYnZsRCA9IEJFU3MuZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICd0ZWNobmlxdWUnOlxyXG5cdFx0XHRcdGlmIChvYmpOYW1lID09PSAnYmV2ZWwnKSB7XHJcblx0XHRcdFx0XHRyZXN1bHQuYnZsVCA9IGJ2bFQuZW5jb2RlKHZhbCk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHJlc3VsdC5HbHdUID0gQkVURS5lbmNvZGUodmFsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ3NvdXJjZSc6IHJlc3VsdC5nbHdTID0gSUdTci5lbmNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3R5cGUnOiByZXN1bHQuVHlwZSA9IEdyZFQuZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdvcGFjaXR5JzogcmVzdWx0Lk9wY3QgPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2hpZ2hsaWdodE9wYWNpdHknOiByZXN1bHQuaGdsTyA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc2hhZG93T3BhY2l0eSc6IHJlc3VsdC5zZHdPID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdhbmdsZSc6XHJcblx0XHRcdFx0aWYgKG9iak5hbWUgPT09ICdncmFkaWVudE92ZXJsYXknKSB7XHJcblx0XHRcdFx0XHRyZXN1bHQuQW5nbCA9IHVuaXRzQW5nbGUodmFsKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVzdWx0LmxhZ2wgPSB1bml0c0FuZ2xlKHZhbCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICdhbHRpdHVkZSc6IHJlc3VsdC5MYWxkID0gdW5pdHNBbmdsZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc29mdGVuJzogcmVzdWx0LlNmdG4gPSB1bml0c1ZhbHVlKHZhbCwga2V5KTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3N0cmVuZ3RoJzogcmVzdWx0LnNyZ1IgPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3NpemUnOiByZXN1bHQuYmx1ciA9IHVuaXRzVmFsdWUodmFsLCBrZXkpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnbm9pc2UnOiByZXN1bHQuTm9zZSA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAncmFuZ2UnOiByZXN1bHQuSW5wciA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnY2hva2UnOiByZXN1bHQuQ2ttdCA9IHVuaXRzVmFsdWUodmFsLCBrZXkpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaml0dGVyJzogcmVzdWx0LlNoZE4gPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2Rpc3RhbmNlJzogcmVzdWx0LkRzdG4gPSB1bml0c1ZhbHVlKHZhbCwga2V5KTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3NjYWxlJzogcmVzdWx0WydTY2wgJ10gPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3BhdHRlcm4nOiByZXN1bHQuUHRybiA9IHsgJ05tICAnOiB2YWwubmFtZSwgSWRudDogdmFsLmlkIH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdwaGFzZSc6IHJlc3VsdC5waGFzZSA9IHsgSHJ6bjogdmFsLngsIFZydGM6IHZhbC55IH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdvZmZzZXQnOiByZXN1bHQuT2ZzdCA9IHsgSHJ6bjogdW5pdHNQZXJjZW50KHZhbC54KSwgVnJ0YzogdW5pdHNQZXJjZW50KHZhbC55KSB9OyBicmVhaztcclxuXHRcdFx0Y2FzZSAnY29udG91cic6IHtcclxuXHRcdFx0XHRyZXN1bHRbb2JqTmFtZSA9PT0gJ3NhdGluJyA/ICdNcGdTJyA6ICdUcm5TJ10gPSB7XHJcblx0XHRcdFx0XHQnTm0gICc6ICh2YWwgYXMgRWZmZWN0Q29udG91cikubmFtZSxcclxuXHRcdFx0XHRcdCdDcnYgJzogKHZhbCBhcyBFZmZlY3RDb250b3VyKS5jdXJ2ZS5tYXAocCA9PiAoeyBIcnpuOiBwLngsIFZydGM6IHAueSB9KSksXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0XHRjYXNlICdncmFkaWVudCc6IHJlc3VsdC5HcmFkID0gc2VyaWFsaXplR3JhZGllbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3VzZVRleHR1cmUnOlxyXG5cdFx0XHRjYXNlICd1c2VTaGFwZSc6XHJcblx0XHRcdGNhc2UgJ2xheWVyQ29uY2VhbHMnOlxyXG5cdFx0XHRjYXNlICdwcmVzZW50JzpcclxuXHRcdFx0Y2FzZSAnc2hvd0luRGlhbG9nJzpcclxuXHRcdFx0Y2FzZSAnYW50aWFsaWFzR2xvc3MnOlxyXG5cdFx0XHRcdHJlc3VsdFtrZXldID0gdmFsO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdHJlcG9ydEVycm9ycyAmJiBjb25zb2xlLmxvZyhgSW52YWxpZCBlZmZlY3Qga2V5OiAnJHtrZXl9JyB2YWx1ZTpgLCB2YWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
