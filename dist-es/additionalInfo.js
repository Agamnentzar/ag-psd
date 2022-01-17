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
        throw new Error("Resource size above 4 GB limit at ".concat(reader.offset.toString(16)));
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
        throw new Error("Invalid Warp version ".concat(warpVersion));
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
            open: open_1,
            iconLocation: iconLocation,
            popupLocation: popupLocation,
            color: color,
            author: author,
            name: name_1,
            date: date,
            data: data,
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
        writeSignature(writer, file.type ? "".concat(file.type, "    ").substr(0, 4) : '    ');
        writeSignature(writer, file.creator ? "".concat(file.creator, "    ").substr(0, 4) : '\0\0\0\0');
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
        console.log("Non-empty lnkE layer info (".concat(left(), " bytes)"));
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
            throw new Error("".concat(key, " should be an array"));
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
        Engn: "Engn.".concat(cinf.engine),
        enableCompCore: "enable.".concat(cinf.enableCompCore),
        enableCompCoreGPU: "enable.".concat(cinf.enableCompCoreGPU),
        // enableCompCoreThreads: `enable.feature`, // TESTING
        compCoreSupport: "reason.".concat(cinf.compCoreSupport),
        compCoreGPUSupport: "reason.".concat(cinf.compCoreGPUSupport),
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
                reportErrors && console.log("Invalid effect key: '".concat(key, "':"), val);
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
                reportErrors && console.log("Invalid effect key: '".concat(key, "' value:"), val);
        }
    }
    return result;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFJLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3hGLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzNGLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlGLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzlFLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBRTlFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUMzQixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFtQyxDQUFDO0lBQ3hELElBQU0sSUFBSSxHQUEwQixFQUFFLENBQUM7SUFFdkMsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdGLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDdEQsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDdkQsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDNUQsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3hGLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzNGLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFVBQVUsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzlGLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzlFLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBRTlFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVO0lBQ2xDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3JELENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULE1BQU0sRUFDTixjQUFjLENBQUMsUUFBUSxDQUFDLEVBQ3hCLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLE1BQU0sQ0FBQyxVQUFVLEdBQUcsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7SUFDdkMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNCLENBQUMsRUFDRDtJQUNDLHdCQUF3QjtBQUN6QixDQUFDLENBQ0QsQ0FBQztBQUVGLFVBQVUsQ0FDVCxNQUFNLEVBQ04sY0FBYyxDQUFDLFdBQVcsQ0FBQyxFQUMzQixVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixNQUFNLENBQUMsVUFBVSxHQUFHO1FBQ25CLElBQUksRUFBRSxXQUFXO1FBQ2pCLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTSxDQUFDO0tBQzFCLENBQUM7SUFDRixTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDM0IsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07O0lBQ2QsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQWlDLENBQUM7SUFDdEQsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFBLElBQUksQ0FBQyxNQUFNLG1DQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3RDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLGNBQWMsQ0FBQyxXQUFXLENBQUMsRUFDM0IsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUk7SUFDcEIsTUFBTSxDQUFDLFVBQVUsR0FBRztRQUNuQixJQUFJLEVBQUUsV0FBVztRQUNqQixLQUFLLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztLQUN6QixDQUFDO0lBQ0YsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNOztJQUNkLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFpQyxDQUFDO0lBQ3RELFdBQVcsQ0FBQyxNQUFNLEVBQUUsTUFBQSxJQUFJLENBQUMsS0FBSyxtQ0FBSSxHQUFHLENBQUMsQ0FBQztJQUN2QyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZCLENBQUMsQ0FDRCxDQUFDO0FBRUYsSUFBTSxlQUFlLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUU5RCxVQUFVLENBQ1QsTUFBTSxFQUNOLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFDOUIsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUk7SUFDcEIsSUFBSSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUV0RSxJQUFNLElBQUksR0FBMEI7UUFDbkMsSUFBSSxFQUFFLGNBQWM7UUFDcEIsWUFBWSxFQUFFLE9BQU87S0FDckIsQ0FBQztJQUVGLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEMsSUFBSSxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0QyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUNyQixJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUV2QixJQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFdEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNwQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQztZQUNwQixRQUFRLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUM1QixRQUFRLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUc7WUFDbEMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUM7U0FDeEIsQ0FBQyxDQUFDO1FBQ0gsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztLQUNyQjtJQUVELElBQU0saUJBQWlCLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRTdDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxpQkFBaUIsRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQztZQUN0QixRQUFRLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUM1QixRQUFRLEVBQUUsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUc7WUFDbEMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJO1NBQ2xDLENBQUMsQ0FBQztLQUNIO0lBRUQsSUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFDLElBQUksY0FBYyxLQUFLLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFFMUUsSUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxVQUFVLEdBQUcsYUFBYSxHQUFHLElBQUksQ0FBQztJQUV2QyxJQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEMsSUFBSSxNQUFNLEtBQUssRUFBRTtRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUUxRCxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7SUFDM0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckMsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzVDLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDM0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFLLENBQTBCLENBQUM7SUFFMUYsSUFBSSxDQUFDLEdBQUcsR0FBRztRQUNWLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNO1FBQzNCLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNO1FBQzNCLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNO1FBQzNCLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNO0tBQzNCLENBQUM7SUFFRixJQUFJLENBQUMsR0FBRyxHQUFHO1FBQ1YsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU07UUFDM0IsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU07UUFDM0IsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU07UUFDM0IsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU07S0FDM0IsQ0FBQztJQUVGLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUUxQixLQUFnQixVQUFlLEVBQWYsS0FBQSxJQUFJLENBQUMsVUFBVSxFQUFmLGNBQWUsRUFBZixJQUFlO1FBQTFCLElBQU0sQ0FBQyxTQUFBO1FBQXFCLENBQUMsQ0FBQyxRQUFRLElBQUksYUFBYSxDQUFDO0tBQUE7SUFDN0QsS0FBZ0IsVUFBaUIsRUFBakIsS0FBQSxJQUFJLENBQUMsWUFBWSxFQUFqQixjQUFpQixFQUFqQixJQUFpQjtRQUE1QixJQUFNLENBQUMsU0FBQTtRQUF1QixDQUFDLENBQUMsUUFBUSxJQUFJLGFBQWEsQ0FBQztLQUFBO0lBRS9ELE1BQU0sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQzFCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNOztJQUNkLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFtQyxDQUFDO0lBRXhELFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVO0lBQ2xDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN6QyxVQUFVLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEMsNkJBQTZCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7SUFDdkQsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRXBFLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFBLElBQUksQ0FBQyxVQUFVLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0lBRWhFLEtBQWdCLFVBQXFCLEVBQXJCLEtBQUEsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLEVBQXJCLGNBQXFCLEVBQXJCLElBQXFCLEVBQUU7UUFBbEMsSUFBTSxDQUFDLFNBQUE7UUFDWCxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQzVELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbEQsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUIsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztLQUN0QjtJQUVELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztJQUV4RSxLQUFnQixVQUF1QixFQUF2QixLQUFBLElBQUksQ0FBQyxZQUFZLElBQUksRUFBRSxFQUF2QixjQUF1QixFQUF2QixJQUF1QixFQUFFO1FBQXBDLElBQU0sQ0FBQyxTQUFBO1FBQ1gsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUM1RCxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2xELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7S0FDbEQ7SUFFRCxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCO0lBQzFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDbkMsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7SUFDbEMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRCxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xELFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqRCxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFBLElBQUksQ0FBQyxTQUFTLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDOUQsSUFBTSxVQUFVLEdBQUcsZUFBZSxDQUFDLE9BQU8sQ0FBQyxNQUFBLElBQUksQ0FBQyxVQUFVLG1DQUFJLEtBQUssQ0FBQyxDQUFDO0lBQ3JFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsVUFBVSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRXhELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBQ3pCLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRTFFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1FBQ3pCLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBRTFFLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixTQUFTLG1CQUFtQixDQUFDLE1BQWlCO0lBQzdDLE9BQU87UUFDTixDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNwQixDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNwQixDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNwQixDQUFDLEVBQUUsU0FBUyxDQUFDLE1BQU0sQ0FBQztLQUNwQixDQUFDO0FBQ0gsQ0FBQztBQUVELFNBQVMsb0JBQW9CLENBQUMsTUFBaUIsRUFBRSxJQUFzQjtJQUN0RSxJQUFNLENBQUMsR0FBRyxJQUFJLElBQUksRUFBbUIsQ0FBQztJQUN0QyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztJQUN6QixVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztJQUN6QixVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztJQUN6QixVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFFLENBQUMsQ0FBQztBQUMxQixDQUFDO0FBRUQsVUFBVSxDQUNULE1BQU0sRUFDTixjQUFjLENBQUMsaUJBQWlCLENBQUMsRUFDakMsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7UUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFFdEUsSUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztJQUMxRCxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRXJCLE1BQU0sQ0FBQyxVQUFVLEdBQUc7UUFDbkIsSUFBSSxFQUFFLGlCQUFpQjtRQUN2QixJQUFJLE1BQUE7UUFDSixJQUFJLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDO1FBQ2pDLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDcEMsTUFBTSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztRQUNuQyxLQUFLLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDO1FBQ2xDLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDbEMsUUFBUSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztRQUNyQyxNQUFNLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDO1FBQ25DLFFBQVEsRUFBRSxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDckMsTUFBTSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztLQUNuQyxDQUFDO0FBQ0gsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsVUFBc0MsQ0FBQztJQUUzRCxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVTtJQUNsQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RELFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdEIsb0JBQW9CLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzNDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN6QyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUNELENBQUM7QUE4QkYsVUFBVSxDQUNULE1BQU0sRUFDTixVQUFBLE1BQU07SUFDTCxJQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBRTVCLElBQUksQ0FBQyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFFckIsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUsscUJBQXFCLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGVBQWU7WUFDbEcsQ0FBQyxDQUFDLElBQUksS0FBSyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUFjLEtBQUssU0FBUyxDQUFDLENBQUM7QUFDbkUsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLElBQU0sSUFBSSxHQUFHLHdCQUF3QixDQUFDLE1BQU0sQ0FDcUQsQ0FBQztJQUNsRyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQztRQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUU3RCx1RUFBdUU7SUFDdkUsSUFBSSxnQkFBZ0IsSUFBSSxJQUFJLEVBQUU7UUFDN0IsTUFBTSxDQUFDLFVBQVUseUJBQ2IsTUFBTSxDQUFDLFVBQTZFLEtBQ3ZGLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUMzQixjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FDbkMsQ0FBQztLQUNGO1NBQU0sSUFBSSxzQkFBc0IsSUFBSSxJQUFJLEVBQUU7UUFDMUMsTUFBTSxDQUFDLFVBQVUseUJBQ2IsTUFBTSxDQUFDLFVBQThCLEtBQ3hDLFVBQVUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEVBQ2pDLGNBQWMsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEdBQ3pDLENBQUM7S0FDRjtTQUFNLElBQUkscUJBQXFCLElBQUksSUFBSSxFQUFFO1FBQ3pDLE1BQU0sQ0FBQyxVQUFVLHlCQUNiLE1BQU0sQ0FBQyxVQUE4QixLQUN4QyxVQUFVLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFDaEMsY0FBYyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsR0FDeEMsQ0FBQztLQUNGO1NBQU07UUFDTixNQUFNLENBQUMsVUFBVSxHQUFHO1lBQ25CLElBQUksRUFBRSxxQkFBcUI7WUFDM0IsVUFBVSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ3JCLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNuQixTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDckIsU0FBUyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUztZQUMzQixZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDNUIsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSTtTQUNqQixDQUFDO0tBQ0Y7SUFFRCxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDM0IsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07O0lBQ2QsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVcsQ0FBQztJQUVoQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssZ0JBQWdCLEVBQUU7UUFDekYsSUFBTSxJQUFJLEdBQXFCO1lBQzlCLElBQUksRUFBRSxDQUFDO1lBQ1AsVUFBVSxFQUFFLE1BQUEsSUFBSSxDQUFDLFVBQVUsbUNBQUksQ0FBQztZQUNoQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWMsSUFBSSxFQUFFO1NBQ3pDLENBQUM7UUFDRix5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7UUFDbEMsSUFBTSxJQUFJLEdBQTJCO1lBQ3BDLElBQUksRUFBRSxDQUFDO1lBQ1AsZ0JBQWdCLEVBQUUsTUFBQSxJQUFJLENBQUMsVUFBVSxtQ0FBSSxDQUFDO1lBQ3RDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxjQUFjLElBQUksRUFBRTtTQUMvQyxDQUFDO1FBQ0YseUJBQXlCLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDcEQ7U0FBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssZUFBZSxFQUFFO1FBQ3pDLElBQU0sSUFBSSxHQUEwQjtZQUNuQyxJQUFJLEVBQUUsQ0FBQztZQUNQLGVBQWUsRUFBRSxNQUFBLElBQUksQ0FBQyxVQUFVLG1DQUFJLENBQUM7WUFDckMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGNBQWMsSUFBSSxFQUFFO1NBQzlDLENBQUM7UUFDRix5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztLQUNwRDtTQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxxQkFBcUIsRUFBRTtRQUMvQyxJQUFNLElBQUksR0FBaUM7WUFDMUMsSUFBSSxFQUFFLENBQUM7WUFDUCxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDO1lBQzFCLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7WUFDeEIsS0FBSyxFQUFFLE1BQUEsSUFBSSxDQUFDLFNBQVMsbUNBQUksR0FBRztZQUM1QixNQUFNLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZO1lBQzNCLFNBQVMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVM7WUFDM0IsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSTtTQUNqQixDQUFDO1FBQ0YseUJBQXlCLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDcEQ7U0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztLQUN2QztBQUNGLENBQUMsQ0FDRCxDQUFDO0FBRUYsVUFBVSxDQUNULE1BQU0sRUFDTixNQUFNLENBQUMsWUFBWSxDQUFDLEVBQ3BCLFVBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJO0lBQ3BCLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN2QyxNQUFNLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4Qyw0Q0FBNEM7SUFDNUMscUVBQXFFO0lBQ3JFLGlJQUFpSTtJQUNqSSxzRkFBc0Y7QUFDdkYsQ0FBQyxFQUNELFVBQUMsTUFBTSxFQUFFLE1BQU07SUFDZCxJQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLFVBQVcsQ0FBQyxDQUFDO0lBQy9DLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDNUIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFDcEIsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sQ0FBQyxVQUFVLEdBQUc7UUFDbkIsVUFBVSxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUM7UUFDN0IsT0FBTyxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJO0tBQ2xDLENBQUM7QUFDSCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTs7SUFDZCxVQUFVLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxVQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbEQsV0FBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBQSxNQUFNLENBQUMsVUFBVyxDQUFDLE9BQU8sbUNBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUMxRSxDQUFDLENBQ0QsQ0FBQztBQWNGLFVBQVUsQ0FDVCxNQUFNLEVBQUUsOEJBQThCO0FBQ3RDLFVBRFEsOEJBQThCO0FBQ3RDLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxTQUFTLEtBQUssU0FBUyxFQUF2QyxDQUF1QyxFQUNqRCxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixJQUFNLElBQUksR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLENBQW1CLENBQUM7SUFDL0QsTUFBYyxDQUFDLFNBQVMsR0FBRztRQUMzQixLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNuQixnQkFBZ0IsRUFBRSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1FBQ2xHLE1BQU0sRUFBRSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUU7UUFDcEUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQjtRQUN6QyxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWU7UUFDckMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLG1CQUFtQjtRQUM3Qyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsdUJBQXVCO1FBQ3JELG9DQUFvQyxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsb0NBQW9DLENBQUM7UUFDM0YsbUNBQW1DLEVBQUUsSUFBSSxDQUFDLG1DQUFtQztLQUM3RSxDQUFDO0lBRUYsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNOztJQUNkLElBQU0sSUFBSSxHQUFJLE1BQWMsQ0FBQyxTQUFVLENBQUM7SUFDeEMsSUFBTSxJQUFJLEdBQW1CO1FBQzVCLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSztRQUNsQixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUU7UUFDakosTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRTtRQUN6RyxpQkFBaUIsRUFBRSxNQUFBLElBQUksQ0FBQyxpQkFBaUIsbUNBQUksSUFBSTtRQUNqRCxlQUFlLEVBQUUsTUFBQSxJQUFJLENBQUMsZUFBZSxtQ0FBSSxJQUFJO1FBQzdDLG1CQUFtQixFQUFFLE1BQUEsSUFBSSxDQUFDLG1CQUFtQixtQ0FBSSxJQUFJO1FBQ3JELHVCQUF1QixFQUFFLE1BQUEsSUFBSSxDQUFDLHVCQUF1QixtQ0FBSSxJQUFJO1FBQzdELG9DQUFvQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLENBQUMsb0NBQW9DLENBQUM7UUFDL0YsbUNBQW1DLEVBQUUsTUFBQSxJQUFJLENBQUMsbUNBQW1DLG1DQUFJLENBQUM7S0FDbEYsQ0FBQztJQUNGLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM3RCxDQUFDLENBQ0QsQ0FBQztBQThDRixTQUFTLGFBQWEsQ0FBQyxFQUFvQjtJQUMxQyxJQUFNLE1BQU0sR0FBc0I7UUFDakMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSTtRQUNsQixRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO1FBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFLLENBQUM7UUFDL0IsU0FBUyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBRSxDQUFDO1FBQ25DLE9BQU8sRUFBRSxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQztRQUM5QixJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUUsQ0FBQztLQUM3QixDQUFDO0lBRUYsSUFBSSxFQUFFLENBQUMsT0FBTyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUM7SUFDMUQsSUFBSSxFQUFFLENBQUMsWUFBWSxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUM7SUFDekUsSUFBSSxFQUFFLENBQUMsU0FBUyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUM7SUFDaEUsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQUUsTUFBTSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxFQUFFLENBQUMsSUFBSTtRQUFFLE1BQU0sQ0FBQyxRQUFRLEdBQUcsb0JBQW9CLENBQUMsRUFBUyxDQUFDLENBQUM7SUFDL0QsSUFBSSxFQUFFLENBQUMsSUFBSTtRQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsbUJBQW1CLENBQUMsRUFBUyxDQUFDLENBQUM7SUFFN0QsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxNQUF5QjtJQUNuRCxJQUFJLElBQUksR0FBcUIsRUFBUyxDQUFDO0lBQ3ZDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDN0IsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQ2xFLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyxTQUFTO1FBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUNqRixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLElBQUksQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6QyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0MsSUFBSSxNQUFNLENBQUMsS0FBSztRQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzlELElBQUksTUFBTSxDQUFDLFFBQVE7UUFBRSxJQUFJLHlCQUFRLElBQUksR0FBSyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUUsQ0FBQztJQUN0RixJQUFJLE1BQU0sQ0FBQyxPQUFPO1FBQUUsSUFBSSx5QkFBUSxJQUFJLEdBQUssdUJBQXVCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFFLENBQUM7SUFDbkYsSUFBSSxNQUFNLENBQUMsU0FBUyxLQUFLLFNBQVM7UUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ3hFLE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsWUFBWSxDQUFDLElBQXFDLEVBQUUsR0FBWTtJQUN4RSxJQUFNLE9BQU8sR0FBcUIsRUFBRSxDQUFDO0lBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYztRQUFFLE9BQU8sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ2xELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzdELElBQUksSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLENBQUMsVUFBVSxHQUFHLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3hFLElBQUksSUFBSSxDQUFDLGVBQWU7UUFBRSxPQUFPLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsaUJBQWlCLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUF6QixDQUF5QixDQUFDLENBQUM7SUFDeEcsSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sQ0FBQyxXQUFXLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDekUsSUFBSSxJQUFJLENBQUMsZ0JBQWdCO1FBQUUsT0FBTyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsaUJBQWlCLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUF6QixDQUF5QixDQUFDLENBQUM7SUFDM0csSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sQ0FBQyxTQUFTLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNyRSxJQUFJLElBQUksQ0FBQyxJQUFJO1FBQUUsT0FBTyxDQUFDLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3JFLElBQUksSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDakUsSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDdkUsSUFBSSxJQUFJLENBQUMsY0FBYztRQUFFLE9BQU8sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxpQkFBaUIsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQXpCLENBQXlCLENBQUMsQ0FBQztJQUNyRyxJQUFJLElBQUksQ0FBQyxXQUFXO1FBQUUsT0FBTyxDQUFDLGNBQWMsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3hGLElBQUksSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLENBQUMsZUFBZSxHQUFHLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdFLElBQUksSUFBSSxDQUFDLGlCQUFpQjtRQUFFLE9BQU8sQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLGlCQUFpQixDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBekIsQ0FBeUIsQ0FBQyxDQUFDO0lBQ2pILElBQUksSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLENBQUMsS0FBSyxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDakUsSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDM0QsSUFBSSxJQUFJLENBQUMsWUFBWTtRQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxhQUFhLENBQUMsQ0FBQyxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQztJQUNyRixPQUFPLE9BQU8sQ0FBQztBQUNoQixDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FBQyxDQUFtQixFQUFFLEdBQVksRUFBRSxLQUFjOztJQUMxRSxJQUFNLElBQUksR0FBb0MsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNyRCxNQUFNLEVBQUUsWUFBWSxDQUFDLE1BQUEsQ0FBQyxDQUFDLEtBQUssbUNBQUksQ0FBQyxDQUFDO1FBQ2xDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRO0tBQzNCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVE7UUFDM0IsTUFBTSxFQUFFLFlBQVksQ0FBQyxNQUFBLENBQUMsQ0FBQyxLQUFLLG1DQUFJLENBQUMsQ0FBQztLQUNsQyxDQUFDO0lBRUYsSUFBTSxTQUFTLEdBQStCLENBQUMsWUFBWSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDdEgsS0FBa0IsVUFBUyxFQUFULHVCQUFTLEVBQVQsdUJBQVMsRUFBVCxJQUFTLEVBQUU7UUFBeEIsSUFBTSxHQUFHLGtCQUFBO1FBQ2IsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBRyxHQUFHLHdCQUFxQixDQUFDLENBQUM7S0FDbkY7SUFFRCxJQUFJLENBQUEsTUFBQSxDQUFDLENBQUMsVUFBVSwwQ0FBRyxDQUFDLENBQUMsS0FBSSxDQUFDLEtBQUs7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZHLElBQUksQ0FBQSxNQUFBLENBQUMsQ0FBQyxVQUFVLDBDQUFHLENBQUMsQ0FBQyxLQUFJLEtBQUs7UUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEscUJBQXFCLENBQUMsQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsRUFBM0MsQ0FBMkMsQ0FBQyxDQUFDO0lBQzFILElBQUksQ0FBQSxNQUFBLENBQUMsQ0FBQyxXQUFXLDBDQUFHLENBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSztRQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcscUJBQXFCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDMUcsSUFBSSxDQUFBLE1BQUEsQ0FBQyxDQUFDLFdBQVcsMENBQUcsQ0FBQyxDQUFDLEtBQUksS0FBSztRQUFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLHFCQUFxQixDQUFDLENBQUMsRUFBRSxhQUFhLEVBQUUsR0FBRyxDQUFDLEVBQTVDLENBQTRDLENBQUMsQ0FBQztJQUM5SCxJQUFJLENBQUMsQ0FBQyxTQUFTO1FBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNsRixJQUFJLENBQUEsTUFBQSxDQUFDLENBQUMsU0FBUywwQ0FBRyxDQUFDLENBQUMsS0FBSSxLQUFLO1FBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLHFCQUFxQixDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLEVBQTFDLENBQTBDLENBQUMsQ0FBQztJQUN0SCxJQUFJLENBQUEsTUFBQSxDQUFDLENBQUMsZUFBZSwwQ0FBRyxDQUFDLENBQUMsS0FBSSxLQUFLO1FBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEscUJBQXFCLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxFQUFoRCxDQUFnRCxDQUFDLENBQUM7SUFDM0ksSUFBSSxDQUFBLE1BQUEsQ0FBQyxDQUFDLE1BQU0sMENBQUcsQ0FBQyxDQUFDLEtBQUksS0FBSztRQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBcEIsQ0FBb0IsQ0FBQyxDQUFDO0lBQ3hGLElBQUksQ0FBQyxDQUFDLFNBQVM7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ2xGLElBQUksQ0FBQyxDQUFDLEtBQUs7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RFLElBQUksQ0FBQSxNQUFBLENBQUMsQ0FBQyxTQUFTLDBDQUFHLENBQUMsQ0FBQyxLQUFJLENBQUMsS0FBSztRQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcscUJBQXFCLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDcEcsSUFBSSxDQUFDLENBQUMsY0FBYztRQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcscUJBQXFCLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN4RyxJQUFJLENBQUEsTUFBQSxDQUFDLENBQUMsZUFBZSwwQ0FBRyxDQUFDLENBQUMsS0FBSSxDQUFDLEtBQUs7UUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdEgsSUFBSSxDQUFDLENBQUMsS0FBSztRQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcscUJBQXFCLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDdEUsSUFBSSxDQUFBLE1BQUEsQ0FBQyxDQUFDLE1BQU0sMENBQUcsQ0FBQyxDQUFDLEtBQUksQ0FBQyxLQUFLO1FBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQyxNQUFBLENBQUMsQ0FBQyxNQUFNLDBDQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFMUUsSUFBSSxLQUFLLEVBQUU7UUFDVixJQUFJLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQztRQUV4QixLQUFrQixVQUFjLEVBQWQsS0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFkLGNBQWMsRUFBZCxJQUFjLEVBQUU7WUFBN0IsSUFBTSxHQUFHLFNBQUE7WUFDYixJQUFNLEtBQUssR0FBSSxDQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN6QixLQUFxQixVQUFLLEVBQUwsZUFBSyxFQUFMLG1CQUFLLEVBQUwsSUFBSyxFQUFFO29CQUF2QixJQUFNLE1BQU0sY0FBQTtvQkFDaEIsSUFBSSxNQUFNLENBQUMsT0FBTzt3QkFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7aUJBQzFDO2FBQ0Q7U0FDRDtLQUNEO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxPQUF5QjtJQUN4RCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsR0FBRyxJQUFJLE9BQUMsT0FBZSxDQUFDLEdBQUcsQ0FBQyxFQUFyQixDQUFxQixDQUFDLENBQUMsSUFBSSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDO0FBQzNHLENBQUM7QUFFRCxVQUFVLENBQ1QsTUFBTSxFQUNOLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFoRSxDQUFnRSxFQUMxRSxVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxPQUFPO0lBQ2hDLElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuQyxJQUFJLE9BQU8sS0FBSyxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBRTNELElBQU0sSUFBSSxHQUFtQix3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM5RCwrREFBK0Q7SUFFL0QsNkNBQTZDO0lBQzdDLG9DQUFvQztJQUNwQyxNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBRWxFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUMzQixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxPQUFPO0lBQzFCLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFRLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNwRiwrREFBK0Q7SUFFL0QsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVU7SUFDbEMseUJBQXlCLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDckQsQ0FBQyxDQUNELENBQUM7QUFlRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUN4QixVQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSTtJQUNwQixJQUFNLElBQUksR0FBRyx3QkFBd0IsQ0FBQyxNQUFNLENBQW1CLENBQUM7SUFDaEUsK0RBQStEO0lBRS9ELE1BQU0sQ0FBQyxjQUFjLEdBQUc7UUFDdkIsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO1FBQzdCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtRQUNuQixNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9CLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakQsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkQsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxrQkFBa0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN6RCxDQUFDO0lBRUYsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzNCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLGNBQWUsQ0FBQztJQUNwQyxJQUFNLElBQUksR0FBbUI7UUFDNUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7UUFDcEMseURBQXlEO1FBQ3pELFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztRQUM3QixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07UUFDbkIsSUFBSSxFQUFFLGVBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBRTtRQUMzQixjQUFjLEVBQUUsaUJBQVUsSUFBSSxDQUFDLGNBQWMsQ0FBRTtRQUMvQyxpQkFBaUIsRUFBRSxpQkFBVSxJQUFJLENBQUMsaUJBQWlCLENBQUU7UUFDckQsc0RBQXNEO1FBQ3RELGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsZUFBZSxDQUFFO1FBQ2pELGtCQUFrQixFQUFFLGlCQUFVLElBQUksQ0FBQyxrQkFBa0IsQ0FBRTtLQUN2RCxDQUFDO0lBQ0YseUJBQXlCLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDckQsQ0FBQyxDQUNELENBQUM7QUFFRixrQ0FBa0M7QUFDbEMsVUFBVSxDQUNULE1BQU0sRUFDTixVQUFBLE1BQU0sSUFBSSxPQUFDLE1BQWMsQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFuQyxDQUFtQyxFQUM3QyxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsSUFBTSxJQUFJLEdBQWtCLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzdELCtEQUErRDtJQUUvRCxJQUFJLGFBQWE7UUFBRyxNQUFjLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztBQUNqRCxDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLHNFQUFzRTtJQUN0RSxJQUFJLGFBQWE7UUFBRSx5QkFBeUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRyxNQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekYsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFDckIsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztJQUM5QyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLENBQUMsRUFDRCxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsVUFBVSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsV0FBWSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQy9DLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixVQUFVLENBQ1QsTUFBTSxFQUNOLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxFQUNqQyxVQUFDLE1BQU0sRUFBRSxNQUFNO0lBQ2QsTUFBTSxDQUFDLHVCQUF1QixHQUFHLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckQsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDLEVBQ0QsVUFBQyxNQUFNLEVBQUUsTUFBTTtJQUNkLFVBQVUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNELFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkIsQ0FBQyxDQUNELENBQUM7QUFFRixxQkFBcUI7QUFFckIsU0FBUyxhQUFhLENBQUMsSUFBdUI7SUFDN0MsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtRQUM5QixJQUFNLFNBQU8sR0FBVyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztRQUUxQyxPQUFPO1lBQ04sSUFBSSxFQUFFLE9BQU87WUFDYixJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUNsQixVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO1lBQzVCLFVBQVUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUM7Z0JBQy9CLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM1QixRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksR0FBRyxTQUFPO2dCQUMxQixRQUFRLEVBQUUsQ0FBQyxDQUFDLElBQUksR0FBRyxHQUFHO2FBQ3RCLENBQUMsRUFKNkIsQ0FJN0IsQ0FBQztZQUNILFlBQVksRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUM7Z0JBQ2pDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFDN0IsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsU0FBTztnQkFDMUIsUUFBUSxFQUFFLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRzthQUN0QixDQUFDLEVBSitCLENBSS9CLENBQUM7U0FDSCxDQUFDO0tBQ0Y7U0FBTTtRQUNOLE9BQU87WUFDTixJQUFJLEVBQUUsT0FBTztZQUNiLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ2xCLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUk7WUFDM0IsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNsQyxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDckIsY0FBYyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUMzQixlQUFlLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQzVCLEdBQUcsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxHQUFHLEdBQUcsRUFBUCxDQUFPLENBQUM7WUFDbkMsR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLEdBQUcsR0FBRyxFQUFQLENBQU8sQ0FBQztTQUNuQyxDQUFDO0tBQ0Y7QUFDRixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUErQzs7SUFDekUsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtRQUMxQixJQUFNLFNBQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxJQUFJLENBQUMsVUFBVSxtQ0FBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUMxRCxPQUFPO1lBQ04sTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksRUFBRTtZQUN2QixJQUFJLEVBQUUsV0FBVztZQUNqQixJQUFJLEVBQUUsU0FBTztZQUNiLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUM7O2dCQUFJLE9BQUEsQ0FBQztvQkFDL0IsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUMvQixJQUFJLEVBQUUsV0FBVztvQkFDakIsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxTQUFPLENBQUM7b0JBQ3RDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxDQUFDLENBQUMsUUFBUSxtQ0FBSSxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7aUJBQzNDLENBQUMsQ0FBQTthQUFBLENBQUM7WUFDSCxJQUFJLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDOztnQkFBSSxPQUFBLENBQUM7b0JBQ2pDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztvQkFDN0IsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsR0FBRyxTQUFPLENBQUM7b0JBQ3RDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBQSxDQUFDLENBQUMsUUFBUSxtQ0FBSSxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7aUJBQzNDLENBQUMsQ0FBQTthQUFBLENBQUM7U0FDSCxDQUFDO0tBQ0Y7U0FBTTtRQUNOLE9BQU87WUFDTixJQUFJLEVBQUUsV0FBVztZQUNqQixNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxFQUFFO1lBQ3ZCLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWU7WUFDNUIsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYztZQUMzQixJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1lBQ2xDLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUM7WUFDMUIsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFBLElBQUksQ0FBQyxTQUFTLG1DQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztZQUM5QyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLEdBQUcsR0FBRyxFQUFQLENBQU8sQ0FBQztZQUNwRCxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLEdBQUcsR0FBRyxFQUFQLENBQU8sQ0FBQztTQUNwRCxDQUFDO0tBQ0Y7QUFDRixDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxVQUFxQztJQUNsRSxJQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBb0UsQ0FBQztJQUNqSCxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzVDLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ25FLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLE9BQU8sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ3BFLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlFLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN0RixJQUFJLFVBQVUsQ0FBQyxJQUFJLEtBQUssU0FBUztRQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztJQUNsRSxJQUFJLFVBQVUsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1FBQ2xDLE1BQU0sQ0FBQyxNQUFNLEdBQUc7WUFDZixDQUFDLEVBQUUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3JDLENBQUMsRUFBRSxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7U0FDckMsQ0FBQztLQUNGO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxtQkFBbUIsQ0FBQyxVQUFvQztJQUNoRSxJQUFNLE1BQU0sR0FBcUM7UUFDaEQsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzdCLEVBQUUsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUk7S0FDeEIsQ0FBQztJQUNGLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDO0lBQ25FLElBQUksVUFBVSxDQUFDLEtBQUssS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMxRyxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLFVBQW1DO0lBQzlELElBQUksTUFBTSxJQUFJLFVBQVUsRUFBRTtRQUN6QixPQUFPLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3hDO1NBQU0sSUFBSSxNQUFNLElBQUksVUFBVSxFQUFFO1FBQ2hDLGtCQUFTLElBQUksRUFBRSxTQUFTLElBQUssbUJBQW1CLENBQUMsVUFBVSxDQUFDLEVBQUc7S0FDL0Q7U0FBTSxJQUFJLE1BQU0sSUFBSSxVQUFVLEVBQUU7UUFDaEMsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0tBQ2hFO1NBQU07UUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7S0FDMUM7QUFDRixDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxPQUF3RTtJQUN6RyxJQUFNLE1BQU0sR0FBOEIsRUFBUyxDQUFDO0lBQ3BELElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO0lBQy9ELElBQUksT0FBTyxDQUFDLE9BQU8sS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDO0lBQ2pFLElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTO1FBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDN0QsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5RSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7UUFDbkIsTUFBTSxDQUFDLElBQUksR0FBRztZQUNiLElBQUksRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDcEMsSUFBSSxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztTQUNwQyxDQUFDO0tBQ0Y7SUFDRCxNQUFNLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsT0FBeUM7SUFDekUsSUFBTSxNQUFNLEdBQTZCO1FBQ3hDLElBQUksRUFBRTtZQUNMLE1BQU0sRUFBRSxPQUFPLENBQUMsSUFBSSxJQUFJLEVBQUU7WUFDMUIsSUFBSSxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksRUFBRTtTQUN0QjtLQUNELENBQUM7SUFDRixJQUFJLE9BQU8sQ0FBQyxNQUFNLEtBQUssU0FBUztRQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDakUsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVM7UUFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ2pHLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsc0JBQXNCLENBQUMsT0FBc0I7SUFDckQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRTtRQUM3QixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsRUFBRSxNQUFNLEVBQUUsY0FBYyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUM7S0FDOUU7U0FBTSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1FBQ3RDLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0tBQ3JFO1NBQU07UUFDTixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsd0JBQXdCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztLQUN0RTtBQUNGLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxLQUFzQjtJQUN6QyxJQUFJLE1BQU0sSUFBSSxLQUFLLEVBQUU7UUFDcEIsT0FBTyxFQUFFLENBQUMsRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0tBQy9FO1NBQU0sSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO1FBQzNCLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0tBQ2hFO1NBQU0sSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO1FBQzNCLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUM1RTtTQUFNLElBQUksTUFBTSxJQUFJLEtBQUssRUFBRTtRQUMzQixPQUFPLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0tBQzVCO1NBQU0sSUFBSSxNQUFNLElBQUksS0FBSyxFQUFFO1FBQzNCLE9BQU8sRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztLQUM3RDtTQUFNO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO0tBQ2hEO0FBQ0YsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQXdCO0lBQy9DLElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDWCxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztLQUMzQztTQUFNLElBQUksR0FBRyxJQUFJLEtBQUssRUFBRTtRQUN4QixPQUFPLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztLQUM1RTtTQUFNLElBQUksR0FBRyxJQUFJLEtBQUssRUFBRTtRQUN4QixPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztLQUNyRjtTQUFNLElBQUksR0FBRyxJQUFJLEtBQUssRUFBRTtRQUN4QixPQUFPLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7S0FDOUY7U0FBTSxJQUFJLEdBQUcsSUFBSSxLQUFLLEVBQUU7UUFDeEIsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7S0FDMUU7U0FBTSxJQUFJLEdBQUcsSUFBSSxLQUFLLEVBQUU7UUFDeEIsT0FBTyxFQUFFLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7S0FDM0I7U0FBTTtRQUNOLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztLQUN2QztBQUNGLENBQUM7QUFNRCxTQUFTLGlCQUFpQixDQUFDLEdBQVEsRUFBRSxZQUFxQjtJQUN6RCxJQUFNLE1BQU0sR0FBZSxFQUFTLENBQUM7SUFFckMsS0FBa0IsVUFBZ0IsRUFBaEIsS0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFoQixjQUFnQixFQUFoQixJQUFnQixFQUFFO1FBQS9CLElBQU0sR0FBRyxTQUFBO1FBQ2IsSUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXJCLFFBQVEsR0FBRyxFQUFFO1lBQ1osS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztnQkFBQyxNQUFNO1lBQzNDLEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsY0FBYyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQUMsTUFBTTtZQUNsRCxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO2dCQUFDLE1BQU07WUFDL0MsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztnQkFBQyxNQUFNO1lBQ3pDLEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQUMsTUFBTTtZQUMxQyxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO2dCQUFDLE1BQU07WUFDMUMsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQztnQkFBQyxNQUFNO1lBQzNDLEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ25ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQzVELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3pELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUN2RCxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDeEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDakUsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQzlELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUNwRCxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDeEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQVEsQ0FBQztnQkFBQyxNQUFNO1lBQy9ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFRLENBQUM7Z0JBQUMsTUFBTTtZQUMvRCxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ25ELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3ZELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDaEUsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDN0QsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbkQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbkQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDcEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDeEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbkQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQs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QUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQsS0FBSyxRQUFRO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3pELEtBQUssVUFBVTtnQkFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQ3hELEtBQUssTUFBTTtnQkFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUN2RCxLQUFLLE9BQU87Z0JBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUNyRCxLQUFLLE9BQU87Z0JBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUNyRCxLQUFLLE9BQU87Z0JBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDeEQsS0FBSyxRQUFRO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQsS0FBSyxVQUFVO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFBQyxNQUFNO1lBQzNELEtBQUssT0FBTztnQkFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDeEQsS0FBSyxTQUFTO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUFDLE1BQU07WUFDeEUsS0FBSyxPQUFPO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUFDLE1BQU07WUFDakUsS0FBSyxRQUFRO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUFDLE1BQU07WUFDN0YsS0FBSyxTQUFTLENBQUMsQ0FBQztnQkFDZixNQUFNLENBQUMsT0FBTyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRztvQkFDL0MsTUFBTSxFQUFHLEdBQXFCLENBQUMsSUFBSTtvQkFDbkMsTUFBTSxFQUFHLEdBQXFCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQTFCLENBQTBCLENBQUM7aUJBQ3pFLENBQUM7Z0JBQ0YsTUFBTTthQUNOO1lBQ0QsS0FBSyxVQUFVO2dCQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQUMsTUFBTTtZQUM3RCxLQUFLLFlBQVksQ0FBQztZQUNsQixLQUFLLFVBQVUsQ0FBQztZQUNoQixLQUFLLGVBQWUsQ0FBQztZQUNyQixLQUFLLFNBQVMsQ0FBQztZQUNmLEtBQUssY0FBYyxDQUFDO1lBQ3BCLEtBQUssZ0JBQWdCO2dCQUNwQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO2dCQUNsQixNQUFNO1lBQ1A7Z0JBQ0MsWUFBWSxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQXdCLEdBQUcsYUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1NBQ3pFO0tBQ0Q7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUMiLCJmaWxlIjoiYWRkaXRpb25hbEluZm8uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBmcm9tQnl0ZUFycmF5LCB0b0J5dGVBcnJheSB9IGZyb20gJ2Jhc2U2NC1qcyc7XHJcbmltcG9ydCB7IHJlYWRFZmZlY3RzLCB3cml0ZUVmZmVjdHMgfSBmcm9tICcuL2VmZmVjdHNIZWxwZXJzJztcclxuaW1wb3J0IHsgY2xhbXAsIGNyZWF0ZUVudW0sIGxheWVyQ29sb3JzLCBNT0NLX0hBTkRMRVJTIH0gZnJvbSAnLi9oZWxwZXJzJztcclxuaW1wb3J0IHtcclxuXHRMYXllckFkZGl0aW9uYWxJbmZvLCBMYXllckVmZmVjdFNoYWRvdywgTGF5ZXJFZmZlY3RzT3V0ZXJHbG93LCBMYXllckVmZmVjdElubmVyR2xvdywgTGF5ZXJFZmZlY3RCZXZlbCxcclxuXHRMYXllckVmZmVjdFNvbGlkRmlsbCwgTGF5ZXJFZmZlY3RQYXR0ZXJuT3ZlcmxheSwgTGF5ZXJFZmZlY3RHcmFkaWVudE92ZXJsYXksIExheWVyRWZmZWN0U2F0aW4sIEVmZmVjdENvbnRvdXIsXHJcblx0RWZmZWN0Tm9pc2VHcmFkaWVudCwgQmV6aWVyUGF0aCwgUHNkLCBWZWN0b3JDb250ZW50LCBMYXllckVmZmVjdFN0cm9rZSwgRXh0cmFHcmFkaWVudEluZm8sIEVmZmVjdFBhdHRlcm4sXHJcblx0RXh0cmFQYXR0ZXJuSW5mbywgUmVhZE9wdGlvbnMsIEJyaWdodG5lc3NBZGp1c3RtZW50LCBFeHBvc3VyZUFkanVzdG1lbnQsIFZpYnJhbmNlQWRqdXN0bWVudCxcclxuXHRDb2xvckJhbGFuY2VBZGp1c3RtZW50LCBCbGFja0FuZFdoaXRlQWRqdXN0bWVudCwgUGhvdG9GaWx0ZXJBZGp1c3RtZW50LCBDaGFubmVsTWl4ZXJDaGFubmVsLFxyXG5cdENoYW5uZWxNaXhlckFkanVzdG1lbnQsIFBvc3Rlcml6ZUFkanVzdG1lbnQsIFRocmVzaG9sZEFkanVzdG1lbnQsIEdyYWRpZW50TWFwQWRqdXN0bWVudCwgQ01ZSyxcclxuXHRTZWxlY3RpdmVDb2xvckFkanVzdG1lbnQsIENvbG9yTG9va3VwQWRqdXN0bWVudCwgTGV2ZWxzQWRqdXN0bWVudENoYW5uZWwsIExldmVsc0FkanVzdG1lbnQsXHJcblx0Q3VydmVzQWRqdXN0bWVudCwgQ3VydmVzQWRqdXN0bWVudENoYW5uZWwsIEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50LCBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudENoYW5uZWwsXHJcblx0UHJlc2V0SW5mbywgQ29sb3IsIENvbG9yQmFsYW5jZVZhbHVlcywgV3JpdGVPcHRpb25zLCBMaW5rZWRGaWxlLCBQbGFjZWRMYXllclR5cGUsIFdhcnAsIEVmZmVjdFNvbGlkR3JhZGllbnQsXHJcblx0S2V5RGVzY3JpcHRvckl0ZW0sIEJvb2xlYW5PcGVyYXRpb24sIExheWVyRWZmZWN0c0luZm8sIEFubm90YXRpb24sIExheWVyVmVjdG9yTWFzayxcclxufSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7XHJcblx0UHNkUmVhZGVyLCByZWFkU2lnbmF0dXJlLCByZWFkVW5pY29kZVN0cmluZywgc2tpcEJ5dGVzLCByZWFkVWludDMyLCByZWFkVWludDgsIHJlYWRGbG9hdDY0LCByZWFkVWludDE2LFxyXG5cdHJlYWRCeXRlcywgcmVhZEludDE2LCBjaGVja1NpZ25hdHVyZSwgcmVhZEZsb2F0MzIsIHJlYWRGaXhlZFBvaW50UGF0aDMyLCByZWFkU2VjdGlvbiwgcmVhZENvbG9yLCByZWFkSW50MzIsXHJcblx0cmVhZFBhc2NhbFN0cmluZywgcmVhZFVuaWNvZGVTdHJpbmdXaXRoTGVuZ3RoLCByZWFkQXNjaWlTdHJpbmcsIHJlYWRQYXR0ZXJuLFxyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcclxuaW1wb3J0IHtcclxuXHRQc2RXcml0ZXIsIHdyaXRlWmVyb3MsIHdyaXRlU2lnbmF0dXJlLCB3cml0ZUJ5dGVzLCB3cml0ZVVpbnQzMiwgd3JpdGVVaW50MTYsIHdyaXRlRmxvYXQ2NCwgd3JpdGVVaW50OCxcclxuXHR3cml0ZUludDE2LCB3cml0ZUZsb2F0MzIsIHdyaXRlRml4ZWRQb2ludFBhdGgzMiwgd3JpdGVVbmljb2RlU3RyaW5nLCB3cml0ZVNlY3Rpb24sIHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nLFxyXG5cdHdyaXRlQ29sb3IsIHdyaXRlUGFzY2FsU3RyaW5nLCB3cml0ZUludDMyLFxyXG59IGZyb20gJy4vcHNkV3JpdGVyJztcclxuaW1wb3J0IHtcclxuXHRBbm50LCBCRVNsLCBCRVNzLCBCRVRFLCBCbG5NLCBidmxULCBDbHJTLCBEZXNjaXB0b3JHcmFkaWVudCwgRGVzY3JpcHRvckNvbG9yLCBEZXNjcmlwdG9yR3JhZGllbnRDb250ZW50LFxyXG5cdERlc2NyaXB0b3JQYXR0ZXJuQ29udGVudCwgRGVzY3JpcHRvclVuaXRzVmFsdWUsIERlc2NyaXB0b3JWZWN0b3JDb250ZW50LCBGckZsLCBGU3RsLCBHcmRULCBJR1NyLCBPcm50LFxyXG5cdHBhcnNlQW5nbGUsIHBhcnNlUGVyY2VudCwgcGFyc2VQZXJjZW50T3JBbmdsZSwgcGFyc2VVbml0cywgcGFyc2VVbml0c09yTnVtYmVyLCBRdWlsdFdhcnBEZXNjcmlwdG9yLCByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IsIFN0cm9rZURlc2NyaXB0b3IsXHJcblx0c3Ryb2tlU3R5bGVMaW5lQWxpZ25tZW50LCBzdHJva2VTdHlsZUxpbmVDYXBUeXBlLCBzdHJva2VTdHlsZUxpbmVKb2luVHlwZSwgVGV4dERlc2NyaXB0b3IsIHRleHRHcmlkZGluZyxcclxuXHR1bml0c0FuZ2xlLCB1bml0c1BlcmNlbnQsIHVuaXRzVmFsdWUsIFdhcnBEZXNjcmlwdG9yLCB3YXJwU3R5bGUsIHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3JcclxufSBmcm9tICcuL2Rlc2NyaXB0b3InO1xyXG5pbXBvcnQgeyBzZXJpYWxpemVFbmdpbmVEYXRhLCBwYXJzZUVuZ2luZURhdGEgfSBmcm9tICcuL2VuZ2luZURhdGEnO1xyXG5pbXBvcnQgeyBlbmNvZGVFbmdpbmVEYXRhLCBkZWNvZGVFbmdpbmVEYXRhIH0gZnJvbSAnLi90ZXh0JztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZW5kZWRXcml0ZU9wdGlvbnMgZXh0ZW5kcyBXcml0ZU9wdGlvbnMge1xyXG5cdGxheWVySWRzOiBudW1iZXJbXTtcclxufVxyXG5cclxudHlwZSBIYXNNZXRob2QgPSAodGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvKSA9PiBib29sZWFuO1xyXG50eXBlIFJlYWRNZXRob2QgPSAocmVhZGVyOiBQc2RSZWFkZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgbGVmdDogKCkgPT4gbnVtYmVyLCBwc2Q6IFBzZCwgb3B0aW9uczogUmVhZE9wdGlvbnMpID0+IHZvaWQ7XHJcbnR5cGUgV3JpdGVNZXRob2QgPSAod3JpdGVyOiBQc2RXcml0ZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgcHNkOiBQc2QsIG9wdGlvbnM6IEV4dGVuZGVkV3JpdGVPcHRpb25zKSA9PiB2b2lkO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbmZvSGFuZGxlciB7XHJcblx0a2V5OiBzdHJpbmc7XHJcblx0aGFzOiBIYXNNZXRob2Q7XHJcblx0cmVhZDogUmVhZE1ldGhvZDtcclxuXHR3cml0ZTogV3JpdGVNZXRob2Q7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBpbmZvSGFuZGxlcnM6IEluZm9IYW5kbGVyW10gPSBbXTtcclxuZXhwb3J0IGNvbnN0IGluZm9IYW5kbGVyc01hcDogeyBba2V5OiBzdHJpbmddOiBJbmZvSGFuZGxlciB9ID0ge307XHJcblxyXG5mdW5jdGlvbiBhZGRIYW5kbGVyKGtleTogc3RyaW5nLCBoYXM6IEhhc01ldGhvZCwgcmVhZDogUmVhZE1ldGhvZCwgd3JpdGU6IFdyaXRlTWV0aG9kKSB7XHJcblx0Y29uc3QgaGFuZGxlcjogSW5mb0hhbmRsZXIgPSB7IGtleSwgaGFzLCByZWFkLCB3cml0ZSB9O1xyXG5cdGluZm9IYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xyXG5cdGluZm9IYW5kbGVyc01hcFtoYW5kbGVyLmtleV0gPSBoYW5kbGVyO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRIYW5kbGVyQWxpYXMoa2V5OiBzdHJpbmcsIHRhcmdldDogc3RyaW5nKSB7XHJcblx0aW5mb0hhbmRsZXJzTWFwW2tleV0gPSBpbmZvSGFuZGxlcnNNYXBbdGFyZ2V0XTtcclxufVxyXG5cclxuZnVuY3Rpb24gaGFzS2V5KGtleToga2V5b2YgTGF5ZXJBZGRpdGlvbmFsSW5mbykge1xyXG5cdHJldHVybiAodGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvKSA9PiB0YXJnZXRba2V5XSAhPT0gdW5kZWZpbmVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZWFkTGVuZ3RoNjQocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRpZiAocmVhZFVpbnQzMihyZWFkZXIpKSB0aHJvdyBuZXcgRXJyb3IoYFJlc291cmNlIHNpemUgYWJvdmUgNCBHQiBsaW1pdCBhdCAke3JlYWRlci5vZmZzZXQudG9TdHJpbmcoMTYpfWApO1xyXG5cdHJldHVybiByZWFkVWludDMyKHJlYWRlcik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlTGVuZ3RoNjQod3JpdGVyOiBQc2RXcml0ZXIsIGxlbmd0aDogbnVtYmVyKSB7XHJcblx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHR3cml0ZVVpbnQzMih3cml0ZXIsIGxlbmd0aCk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J1R5U2gnLFxyXG5cdGhhc0tleSgndGV4dCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdEJ5dGVzKSA9PiB7XHJcblx0XHRpZiAocmVhZEludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIHZlcnNpb25gKTtcclxuXHJcblx0XHRjb25zdCB0cmFuc2Zvcm06IG51bWJlcltdID0gW107XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykgdHJhbnNmb3JtLnB1c2gocmVhZEZsb2F0NjQocmVhZGVyKSk7XHJcblxyXG5cdFx0aWYgKHJlYWRJbnQxNihyZWFkZXIpICE9PSA1MCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFR5U2ggdGV4dCB2ZXJzaW9uYCk7XHJcblx0XHRjb25zdCB0ZXh0OiBUZXh0RGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cclxuXHRcdGlmIChyZWFkSW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFR5U2ggd2FycCB2ZXJzaW9uYCk7XHJcblx0XHRjb25zdCB3YXJwOiBXYXJwRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cclxuXHRcdHRhcmdldC50ZXh0ID0ge1xyXG5cdFx0XHR0cmFuc2Zvcm0sXHJcblx0XHRcdGxlZnQ6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdHRvcDogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0cmlnaHQ6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdGJvdHRvbTogcmVhZEZsb2F0MzIocmVhZGVyKSxcclxuXHRcdFx0dGV4dDogdGV4dFsnVHh0ICddLnJlcGxhY2UoL1xcci9nLCAnXFxuJyksXHJcblx0XHRcdGluZGV4OiB0ZXh0LlRleHRJbmRleCB8fCAwLFxyXG5cdFx0XHRncmlkZGluZzogdGV4dEdyaWRkaW5nLmRlY29kZSh0ZXh0LnRleHRHcmlkZGluZyksXHJcblx0XHRcdGFudGlBbGlhczogQW5udC5kZWNvZGUodGV4dC5BbnRBKSxcclxuXHRcdFx0b3JpZW50YXRpb246IE9ybnQuZGVjb2RlKHRleHQuT3JudCksXHJcblx0XHRcdHdhcnA6IHtcclxuXHRcdFx0XHRzdHlsZTogd2FycFN0eWxlLmRlY29kZSh3YXJwLndhcnBTdHlsZSksXHJcblx0XHRcdFx0dmFsdWU6IHdhcnAud2FycFZhbHVlIHx8IDAsXHJcblx0XHRcdFx0cGVyc3BlY3RpdmU6IHdhcnAud2FycFBlcnNwZWN0aXZlIHx8IDAsXHJcblx0XHRcdFx0cGVyc3BlY3RpdmVPdGhlcjogd2FycC53YXJwUGVyc3BlY3RpdmVPdGhlciB8fCAwLFxyXG5cdFx0XHRcdHJvdGF0ZTogT3JudC5kZWNvZGUod2FycC53YXJwUm90YXRlKSxcclxuXHRcdFx0fSxcclxuXHRcdH07XHJcblxyXG5cdFx0aWYgKHRleHQuRW5naW5lRGF0YSkge1xyXG5cdFx0XHRjb25zdCBlbmdpbmVEYXRhID0gZGVjb2RlRW5naW5lRGF0YShwYXJzZUVuZ2luZURhdGEodGV4dC5FbmdpbmVEYXRhKSk7XHJcblxyXG5cdFx0XHQvLyBjb25zdCBiZWZvcmUgPSBwYXJzZUVuZ2luZURhdGEodGV4dC5FbmdpbmVEYXRhKTtcclxuXHRcdFx0Ly8gY29uc3QgYWZ0ZXIgPSBlbmNvZGVFbmdpbmVEYXRhKGVuZ2luZURhdGEpO1xyXG5cdFx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ2JlZm9yZS50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChiZWZvcmUsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ2FmdGVyLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGFmdGVyLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBhcnNlRW5naW5lRGF0YSh0ZXh0LkVuZ2luZURhdGEpLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdFx0dGFyZ2V0LnRleHQgPSB7IC4uLnRhcmdldC50ZXh0LCAuLi5lbmdpbmVEYXRhIH07XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHRhcmdldC50ZXh0LCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0Qnl0ZXMoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHRleHQgPSB0YXJnZXQudGV4dCE7XHJcblx0XHRjb25zdCB3YXJwID0gdGV4dC53YXJwIHx8IHt9O1xyXG5cdFx0Y29uc3QgdHJhbnNmb3JtID0gdGV4dC50cmFuc2Zvcm0gfHwgWzEsIDAsIDAsIDEsIDAsIDBdO1xyXG5cclxuXHRcdGNvbnN0IHRleHREZXNjcmlwdG9yOiBUZXh0RGVzY3JpcHRvciA9IHtcclxuXHRcdFx0J1R4dCAnOiAodGV4dC50ZXh0IHx8ICcnKS5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHInKSxcclxuXHRcdFx0dGV4dEdyaWRkaW5nOiB0ZXh0R3JpZGRpbmcuZW5jb2RlKHRleHQuZ3JpZGRpbmcpLFxyXG5cdFx0XHRPcm50OiBPcm50LmVuY29kZSh0ZXh0Lm9yaWVudGF0aW9uKSxcclxuXHRcdFx0QW50QTogQW5udC5lbmNvZGUodGV4dC5hbnRpQWxpYXMpLFxyXG5cdFx0XHRUZXh0SW5kZXg6IHRleHQuaW5kZXggfHwgMCxcclxuXHRcdFx0RW5naW5lRGF0YTogc2VyaWFsaXplRW5naW5lRGF0YShlbmNvZGVFbmdpbmVEYXRhKHRleHQpKSxcclxuXHRcdH07XHJcblxyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcclxuXHRcdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdHJhbnNmb3JtW2ldKTtcclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZUludDE2KHdyaXRlciwgNTApOyAvLyB0ZXh0IHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ1R4THInLCB0ZXh0RGVzY3JpcHRvcik7XHJcblxyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIDEpOyAvLyB3YXJwIHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3dhcnAnLCBlbmNvZGVXYXJwKHdhcnApKTtcclxuXHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LmxlZnQhKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHRleHQudG9wISk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LnJpZ2h0ISk7XHJcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LmJvdHRvbSEpO1xyXG5cclxuXHRcdC8vIHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuLy8gdmVjdG9yIGZpbGxzXHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdTb0NvJyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnZlY3RvckZpbGwgIT09IHVuZGVmaW5lZCAmJiB0YXJnZXQudmVjdG9yU3Ryb2tlID09PSB1bmRlZmluZWQgJiZcclxuXHRcdHRhcmdldC52ZWN0b3JGaWxsLnR5cGUgPT09ICdjb2xvcicsXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbCA9IHBhcnNlVmVjdG9yQ29udGVudChkZXNjcmlwdG9yKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgeyBkZXNjcmlwdG9yIH0gPSBzZXJpYWxpemVWZWN0b3JDb250ZW50KHRhcmdldC52ZWN0b3JGaWxsISk7XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzY3JpcHRvcik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J0dkRmwnLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQudmVjdG9yRmlsbCAhPT0gdW5kZWZpbmVkICYmIHRhcmdldC52ZWN0b3JTdHJva2UgPT09IHVuZGVmaW5lZCAmJlxyXG5cdFx0KHRhcmdldC52ZWN0b3JGaWxsLnR5cGUgPT09ICdzb2xpZCcgfHwgdGFyZ2V0LnZlY3RvckZpbGwudHlwZSA9PT0gJ25vaXNlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHR0YXJnZXQudmVjdG9yRmlsbCA9IHBhcnNlVmVjdG9yQ29udGVudChkZXNjcmlwdG9yKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHsgZGVzY3JpcHRvciB9ID0gc2VyaWFsaXplVmVjdG9yQ29udGVudCh0YXJnZXQudmVjdG9yRmlsbCEpO1xyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2NyaXB0b3IpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdQdEZsJyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LnZlY3RvckZpbGwgIT09IHVuZGVmaW5lZCAmJiB0YXJnZXQudmVjdG9yU3Ryb2tlID09PSB1bmRlZmluZWQgJiZcclxuXHRcdHRhcmdldC52ZWN0b3JGaWxsLnR5cGUgPT09ICdwYXR0ZXJuJyxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdHRhcmdldC52ZWN0b3JGaWxsID0gcGFyc2VWZWN0b3JDb250ZW50KGRlc2NyaXB0b3IpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCB7IGRlc2NyaXB0b3IgfSA9IHNlcmlhbGl6ZVZlY3RvckNvbnRlbnQodGFyZ2V0LnZlY3RvckZpbGwhKTtcclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjcmlwdG9yKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQndnNjZycsXHJcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0cmVhZFNpZ25hdHVyZShyZWFkZXIpOyAvLyBrZXlcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdHRhcmdldC52ZWN0b3JGaWxsID0gcGFyc2VWZWN0b3JDb250ZW50KGRlc2MpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgeyBkZXNjcmlwdG9yLCBrZXkgfSA9IHNlcmlhbGl6ZVZlY3RvckNvbnRlbnQodGFyZ2V0LnZlY3RvckZpbGwhKTtcclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwga2V5KTtcclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjcmlwdG9yKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRCZXppZXJLbm90KHJlYWRlcjogUHNkUmVhZGVyLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xyXG5cdGNvbnN0IHkwID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKSAqIGhlaWdodDtcclxuXHRjb25zdCB4MCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiB3aWR0aDtcclxuXHRjb25zdCB5MSA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiBoZWlnaHQ7XHJcblx0Y29uc3QgeDEgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogd2lkdGg7XHJcblx0Y29uc3QgeTIgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogaGVpZ2h0O1xyXG5cdGNvbnN0IHgyID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKSAqIHdpZHRoO1xyXG5cdHJldHVybiBbeDAsIHkwLCB4MSwgeTEsIHgyLCB5Ml07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQmV6aWVyS25vdCh3cml0ZXI6IFBzZFdyaXRlciwgcG9pbnRzOiBudW1iZXJbXSwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbMV0gLyBoZWlnaHQpOyAvLyB5MFxyXG5cdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIHBvaW50c1swXSAvIHdpZHRoKTsgLy8geDBcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbM10gLyBoZWlnaHQpOyAvLyB5MVxyXG5cdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIHBvaW50c1syXSAvIHdpZHRoKTsgLy8geDFcclxuXHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbNV0gLyBoZWlnaHQpOyAvLyB5MlxyXG5cdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIHBvaW50c1s0XSAvIHdpZHRoKTsgLy8geDJcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGJvb2xlYW5PcGVyYXRpb25zOiBCb29sZWFuT3BlcmF0aW9uW10gPSBbJ2V4Y2x1ZGUnLCAnY29tYmluZScsICdzdWJ0cmFjdCcsICdpbnRlcnNlY3QnXTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkVmVjdG9yTWFzayhyZWFkZXI6IFBzZFJlYWRlciwgdmVjdG9yTWFzazogTGF5ZXJWZWN0b3JNYXNrLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgc2l6ZTogbnVtYmVyKSB7XHJcblx0Y29uc3QgZW5kID0gcmVhZGVyLm9mZnNldCArIHNpemU7XHJcblx0Y29uc3QgcGF0aHMgPSB2ZWN0b3JNYXNrLnBhdGhzO1xyXG5cdGxldCBwYXRoOiBCZXppZXJQYXRoIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG5cclxuXHR3aGlsZSAoKGVuZCAtIHJlYWRlci5vZmZzZXQpID49IDI2KSB7XHJcblx0XHRjb25zdCBzZWxlY3RvciA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHRzd2l0Y2ggKHNlbGVjdG9yKSB7XHJcblx0XHRcdGNhc2UgMDogLy8gQ2xvc2VkIHN1YnBhdGggbGVuZ3RoIHJlY29yZFxyXG5cdFx0XHRjYXNlIDM6IHsgLy8gT3BlbiBzdWJwYXRoIGxlbmd0aCByZWNvcmRcclxuXHRcdFx0XHRyZWFkVWludDE2KHJlYWRlcik7IC8vIGNvdW50XHJcblx0XHRcdFx0Y29uc3QgYm9vbE9wID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpOyAvLyBhbHdheXMgMSA/XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMTgpO1xyXG5cdFx0XHRcdC8vIFRPRE86ICdjb21iaW5lJyBoZXJlIG1pZ2h0IGJlIHdyb25nXHJcblx0XHRcdFx0cGF0aCA9IHsgb3Blbjogc2VsZWN0b3IgPT09IDMsIG9wZXJhdGlvbjogYm9vbE9wID09PSAtMSA/ICdjb21iaW5lJyA6IGJvb2xlYW5PcGVyYXRpb25zW2Jvb2xPcF0sIGtub3RzOiBbXSB9O1xyXG5cdFx0XHRcdHBhdGhzLnB1c2gocGF0aCk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdFx0Y2FzZSAxOiAvLyBDbG9zZWQgc3VicGF0aCBCZXppZXIga25vdCwgbGlua2VkXHJcblx0XHRcdGNhc2UgMjogLy8gQ2xvc2VkIHN1YnBhdGggQmV6aWVyIGtub3QsIHVubGlua2VkXHJcblx0XHRcdGNhc2UgNDogLy8gT3BlbiBzdWJwYXRoIEJlemllciBrbm90LCBsaW5rZWRcclxuXHRcdFx0Y2FzZSA1OiAvLyBPcGVuIHN1YnBhdGggQmV6aWVyIGtub3QsIHVubGlua2VkXHJcblx0XHRcdFx0cGF0aCEua25vdHMucHVzaCh7IGxpbmtlZDogKHNlbGVjdG9yID09PSAxIHx8IHNlbGVjdG9yID09PSA0KSwgcG9pbnRzOiByZWFkQmV6aWVyS25vdChyZWFkZXIsIHdpZHRoLCBoZWlnaHQpIH0pO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlIDY6IC8vIFBhdGggZmlsbCBydWxlIHJlY29yZFxyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDI0KTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSA3OiB7IC8vIENsaXBib2FyZCByZWNvcmRcclxuXHRcdFx0XHQvLyBUT0RPOiBjaGVjayBpZiB0aGVzZSBuZWVkIHRvIGJlIG11bHRpcGxpZWQgYnkgZG9jdW1lbnQgc2l6ZVxyXG5cdFx0XHRcdGNvbnN0IHRvcCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgbGVmdCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgYm90dG9tID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCByaWdodCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcik7XHJcblx0XHRcdFx0Y29uc3QgcmVzb2x1dGlvbiA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcik7XHJcblx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgNCk7XHJcblx0XHRcdFx0dmVjdG9yTWFzay5jbGlwYm9hcmQgPSB7IHRvcCwgbGVmdCwgYm90dG9tLCByaWdodCwgcmVzb2x1dGlvbiB9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgODogLy8gSW5pdGlhbCBmaWxsIHJ1bGUgcmVjb3JkXHJcblx0XHRcdFx0dmVjdG9yTWFzay5maWxsU3RhcnRzV2l0aEFsbFBpeGVscyA9ICEhcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIyKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0ZGVmYXVsdDogdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZtc2sgc2VjdGlvbicpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHBhdGhzO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCd2bXNrJyxcclxuXHRoYXNLZXkoJ3ZlY3Rvck1hc2snKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIHsgd2lkdGgsIGhlaWdodCB9KSA9PiB7XHJcblx0XHRpZiAocmVhZFVpbnQzMihyZWFkZXIpICE9PSAzKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdm1zayB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LnZlY3Rvck1hc2sgPSB7IHBhdGhzOiBbXSB9O1xyXG5cdFx0Y29uc3QgdmVjdG9yTWFzayA9IHRhcmdldC52ZWN0b3JNYXNrO1xyXG5cclxuXHRcdGNvbnN0IGZsYWdzID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0dmVjdG9yTWFzay5pbnZlcnQgPSAoZmxhZ3MgJiAxKSAhPT0gMDtcclxuXHRcdHZlY3Rvck1hc2subm90TGluayA9IChmbGFncyAmIDIpICE9PSAwO1xyXG5cdFx0dmVjdG9yTWFzay5kaXNhYmxlID0gKGZsYWdzICYgNCkgIT09IDA7XHJcblxyXG5cdFx0cmVhZFZlY3Rvck1hc2socmVhZGVyLCB2ZWN0b3JNYXNrLCB3aWR0aCwgaGVpZ2h0LCBsZWZ0KCkpO1xyXG5cclxuXHRcdC8vIGRyYXdCZXppZXJQYXRocyh2ZWN0b3JNYXNrLnBhdGhzLCB3aWR0aCwgaGVpZ2h0LCAnb3V0LnBuZycpO1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQsIHsgd2lkdGgsIGhlaWdodCB9KSA9PiB7XHJcblx0XHRjb25zdCB2ZWN0b3JNYXNrID0gdGFyZ2V0LnZlY3Rvck1hc2shO1xyXG5cdFx0Y29uc3QgZmxhZ3MgPVxyXG5cdFx0XHQodmVjdG9yTWFzay5pbnZlcnQgPyAxIDogMCkgfFxyXG5cdFx0XHQodmVjdG9yTWFzay5ub3RMaW5rID8gMiA6IDApIHxcclxuXHRcdFx0KHZlY3Rvck1hc2suZGlzYWJsZSA/IDQgOiAwKTtcclxuXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDMpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGZsYWdzKTtcclxuXHJcblx0XHQvLyBpbml0aWFsIGVudHJ5XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDYpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDI0KTtcclxuXHJcblx0XHRjb25zdCBjbGlwYm9hcmQgPSB2ZWN0b3JNYXNrLmNsaXBib2FyZDtcclxuXHRcdGlmIChjbGlwYm9hcmQpIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCA3KTtcclxuXHRcdFx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgY2xpcGJvYXJkLnRvcCk7XHJcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC5sZWZ0KTtcclxuXHRcdFx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgY2xpcGJvYXJkLmJvdHRvbSk7XHJcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC5yaWdodCk7XHJcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC5yZXNvbHV0aW9uKTtcclxuXHRcdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICh2ZWN0b3JNYXNrLmZpbGxTdGFydHNXaXRoQWxsUGl4ZWxzICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCA4KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCB2ZWN0b3JNYXNrLmZpbGxTdGFydHNXaXRoQWxsUGl4ZWxzID8gMSA6IDApO1xyXG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMjIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoY29uc3QgcGF0aCBvZiB2ZWN0b3JNYXNrLnBhdGhzKSB7XHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgcGF0aC5vcGVuID8gMyA6IDApO1xyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIHBhdGgua25vdHMubGVuZ3RoKTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBNYXRoLmFicyhib29sZWFuT3BlcmF0aW9ucy5pbmRleE9mKHBhdGgub3BlcmF0aW9uKSkpOyAvLyBkZWZhdWx0IHRvIDEgaWYgbm90IGZvdW5kXHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7XHJcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAxOCk7IC8vIFRPRE86IHRoZXNlIGFyZSBzb21ldGltZXMgbm9uLXplcm9cclxuXHJcblx0XHRcdGNvbnN0IGxpbmtlZEtub3QgPSBwYXRoLm9wZW4gPyA0IDogMTtcclxuXHRcdFx0Y29uc3QgdW5saW5rZWRLbm90ID0gcGF0aC5vcGVuID8gNSA6IDI7XHJcblxyXG5cdFx0XHRmb3IgKGNvbnN0IHsgbGlua2VkLCBwb2ludHMgfSBvZiBwYXRoLmtub3RzKSB7XHJcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBsaW5rZWQgPyBsaW5rZWRLbm90IDogdW5saW5rZWRLbm90KTtcclxuXHRcdFx0XHR3cml0ZUJlemllcktub3Qod3JpdGVyLCBwb2ludHMsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbi8vIFRPRE86IG5lZWQgdG8gd3JpdGUgdm1zayBpZiBoYXMgb3V0bGluZSA/XHJcbmFkZEhhbmRsZXJBbGlhcygndnNtcycsICd2bXNrJyk7XHJcbi8vIGFkZEhhbmRsZXJBbGlhcygndm1zaycsICd2c21zJyk7XHJcblxyXG5pbnRlcmZhY2UgVm9na0Rlc2NyaXB0b3Ige1xyXG5cdGtleURlc2NyaXB0b3JMaXN0OiB7XHJcblx0XHRrZXlTaGFwZUludmFsaWRhdGVkPzogYm9vbGVhbjtcclxuXHRcdGtleU9yaWdpblR5cGU/OiBudW1iZXI7XHJcblx0XHRrZXlPcmlnaW5SZXNvbHV0aW9uPzogbnVtYmVyO1xyXG5cdFx0a2V5T3JpZ2luUlJlY3RSYWRpaT86IHtcclxuXHRcdFx0dW5pdFZhbHVlUXVhZFZlcnNpb246IG51bWJlcjtcclxuXHRcdFx0dG9wUmlnaHQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0XHR0b3BMZWZ0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFx0Ym90dG9tTGVmdDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRcdGJvdHRvbVJpZ2h0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdH07XHJcblx0XHRrZXlPcmlnaW5TaGFwZUJCb3g/OiB7XHJcblx0XHRcdHVuaXRWYWx1ZVF1YWRWZXJzaW9uOiBudW1iZXI7XHJcblx0XHRcdCdUb3AgJzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRcdExlZnQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0XHRCdG9tOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFx0UmdodDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHR9O1xyXG5cdFx0a2V5T3JpZ2luQm94Q29ybmVycz86IHtcclxuXHRcdFx0cmVjdGFuZ2xlQ29ybmVyQTogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRcdFx0cmVjdGFuZ2xlQ29ybmVyQjogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRcdFx0cmVjdGFuZ2xlQ29ybmVyQzogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRcdFx0cmVjdGFuZ2xlQ29ybmVyRDogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRcdH07XHJcblx0XHRUcm5mPzogeyB4eDogbnVtYmVyOyB4eTogbnVtYmVyOyB5eDogbnVtYmVyOyB5eTogbnVtYmVyOyB0eDogbnVtYmVyOyB0eTogbnVtYmVyOyB9LFxyXG5cdFx0a2V5T3JpZ2luSW5kZXg6IG51bWJlcjtcclxuXHR9W107XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3ZvZ2snLFxyXG5cdGhhc0tleSgndmVjdG9yT3JpZ2luYXRpb24nKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkSW50MzIocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZvZ2sgdmVyc2lvbmApO1xyXG5cdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIFZvZ2tEZXNjcmlwdG9yO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0dGFyZ2V0LnZlY3Rvck9yaWdpbmF0aW9uID0geyBrZXlEZXNjcmlwdG9yTGlzdDogW10gfTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IGkgb2YgZGVzYy5rZXlEZXNjcmlwdG9yTGlzdCkge1xyXG5cdFx0XHRjb25zdCBpdGVtOiBLZXlEZXNjcmlwdG9ySXRlbSA9IHt9O1xyXG5cclxuXHRcdFx0aWYgKGkua2V5U2hhcGVJbnZhbGlkYXRlZCAhPSBudWxsKSBpdGVtLmtleVNoYXBlSW52YWxpZGF0ZWQgPSBpLmtleVNoYXBlSW52YWxpZGF0ZWQ7XHJcblx0XHRcdGlmIChpLmtleU9yaWdpblR5cGUgIT0gbnVsbCkgaXRlbS5rZXlPcmlnaW5UeXBlID0gaS5rZXlPcmlnaW5UeXBlO1xyXG5cdFx0XHRpZiAoaS5rZXlPcmlnaW5SZXNvbHV0aW9uICE9IG51bGwpIGl0ZW0ua2V5T3JpZ2luUmVzb2x1dGlvbiA9IGkua2V5T3JpZ2luUmVzb2x1dGlvbjtcclxuXHRcdFx0aWYgKGkua2V5T3JpZ2luU2hhcGVCQm94KSB7XHJcblx0XHRcdFx0aXRlbS5rZXlPcmlnaW5TaGFwZUJvdW5kaW5nQm94ID0ge1xyXG5cdFx0XHRcdFx0dG9wOiBwYXJzZVVuaXRzKGkua2V5T3JpZ2luU2hhcGVCQm94WydUb3AgJ10pLFxyXG5cdFx0XHRcdFx0bGVmdDogcGFyc2VVbml0cyhpLmtleU9yaWdpblNoYXBlQkJveC5MZWZ0KSxcclxuXHRcdFx0XHRcdGJvdHRvbTogcGFyc2VVbml0cyhpLmtleU9yaWdpblNoYXBlQkJveC5CdG9tKSxcclxuXHRcdFx0XHRcdHJpZ2h0OiBwYXJzZVVuaXRzKGkua2V5T3JpZ2luU2hhcGVCQm94LlJnaHQpLFxyXG5cdFx0XHRcdH07XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgcmVjdFJhZGlpID0gaS5rZXlPcmlnaW5SUmVjdFJhZGlpO1xyXG5cdFx0XHRpZiAocmVjdFJhZGlpKSB7XHJcblx0XHRcdFx0aXRlbS5rZXlPcmlnaW5SUmVjdFJhZGlpID0ge1xyXG5cdFx0XHRcdFx0dG9wUmlnaHQ6IHBhcnNlVW5pdHMocmVjdFJhZGlpLnRvcFJpZ2h0KSxcclxuXHRcdFx0XHRcdHRvcExlZnQ6IHBhcnNlVW5pdHMocmVjdFJhZGlpLnRvcExlZnQpLFxyXG5cdFx0XHRcdFx0Ym90dG9tTGVmdDogcGFyc2VVbml0cyhyZWN0UmFkaWkuYm90dG9tTGVmdCksXHJcblx0XHRcdFx0XHRib3R0b21SaWdodDogcGFyc2VVbml0cyhyZWN0UmFkaWkuYm90dG9tUmlnaHQpLFxyXG5cdFx0XHRcdH07XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgY29ybmVycyA9IGkua2V5T3JpZ2luQm94Q29ybmVycztcclxuXHRcdFx0aWYgKGNvcm5lcnMpIHtcclxuXHRcdFx0XHRpdGVtLmtleU9yaWdpbkJveENvcm5lcnMgPSBbXHJcblx0XHRcdFx0XHR7IHg6IGNvcm5lcnMucmVjdGFuZ2xlQ29ybmVyQS5IcnpuLCB5OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckEuVnJ0YyB9LFxyXG5cdFx0XHRcdFx0eyB4OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckIuSHJ6biwgeTogY29ybmVycy5yZWN0YW5nbGVDb3JuZXJCLlZydGMgfSxcclxuXHRcdFx0XHRcdHsgeDogY29ybmVycy5yZWN0YW5nbGVDb3JuZXJDLkhyem4sIHk6IGNvcm5lcnMucmVjdGFuZ2xlQ29ybmVyQy5WcnRjIH0sXHJcblx0XHRcdFx0XHR7IHg6IGNvcm5lcnMucmVjdGFuZ2xlQ29ybmVyRC5IcnpuLCB5OiBjb3JuZXJzLnJlY3RhbmdsZUNvcm5lckQuVnJ0YyB9LFxyXG5cdFx0XHRcdF07XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgdHJuZiA9IGkuVHJuZjtcclxuXHRcdFx0aWYgKHRybmYpIHtcclxuXHRcdFx0XHRpdGVtLnRyYW5zZm9ybSA9IFt0cm5mLnh4LCB0cm5mLnh5LCB0cm5mLnh5LCB0cm5mLnl5LCB0cm5mLnR4LCB0cm5mLnR5XTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGFyZ2V0LnZlY3Rvck9yaWdpbmF0aW9uLmtleURlc2NyaXB0b3JMaXN0LnB1c2goaXRlbSk7XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0O1xyXG5cdFx0Y29uc3Qgb3JpZyA9IHRhcmdldC52ZWN0b3JPcmlnaW5hdGlvbiE7XHJcblx0XHRjb25zdCBkZXNjOiBWb2drRGVzY3JpcHRvciA9IHsga2V5RGVzY3JpcHRvckxpc3Q6IFtdIH07XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBvcmlnLmtleURlc2NyaXB0b3JMaXN0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGNvbnN0IGl0ZW0gPSBvcmlnLmtleURlc2NyaXB0b3JMaXN0W2ldO1xyXG5cclxuXHRcdFx0aWYgKGl0ZW0ua2V5U2hhcGVJbnZhbGlkYXRlZCkge1xyXG5cdFx0XHRcdGRlc2Mua2V5RGVzY3JpcHRvckxpc3QucHVzaCh7IGtleVNoYXBlSW52YWxpZGF0ZWQ6IHRydWUsIGtleU9yaWdpbkluZGV4OiBpIH0pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRlc2Mua2V5RGVzY3JpcHRvckxpc3QucHVzaCh7XHJcblx0XHRcdFx0XHRrZXlPcmlnaW5UeXBlOiBpdGVtLmtleU9yaWdpblR5cGUgPz8gNCxcclxuXHRcdFx0XHRcdGtleU9yaWdpblJlc29sdXRpb246IGl0ZW0ua2V5T3JpZ2luUmVzb2x1dGlvbiA/PyA3MixcclxuXHRcdFx0XHR9IGFzIGFueSk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IG91dCA9IGRlc2Mua2V5RGVzY3JpcHRvckxpc3RbZGVzYy5rZXlEZXNjcmlwdG9yTGlzdC5sZW5ndGggLSAxXTtcclxuXHJcblx0XHRcdFx0Y29uc3QgcmFkaWkgPSBpdGVtLmtleU9yaWdpblJSZWN0UmFkaWk7XHJcblx0XHRcdFx0aWYgKHJhZGlpKSB7XHJcblx0XHRcdFx0XHRvdXQua2V5T3JpZ2luUlJlY3RSYWRpaSA9IHtcclxuXHRcdFx0XHRcdFx0dW5pdFZhbHVlUXVhZFZlcnNpb246IDEsXHJcblx0XHRcdFx0XHRcdHRvcFJpZ2h0OiB1bml0c1ZhbHVlKHJhZGlpLnRvcFJpZ2h0LCAndG9wUmlnaHQnKSxcclxuXHRcdFx0XHRcdFx0dG9wTGVmdDogdW5pdHNWYWx1ZShyYWRpaS50b3BMZWZ0LCAndG9wTGVmdCcpLFxyXG5cdFx0XHRcdFx0XHRib3R0b21MZWZ0OiB1bml0c1ZhbHVlKHJhZGlpLmJvdHRvbUxlZnQsICdib3R0b21MZWZ0JyksXHJcblx0XHRcdFx0XHRcdGJvdHRvbVJpZ2h0OiB1bml0c1ZhbHVlKHJhZGlpLmJvdHRvbVJpZ2h0LCAnYm90dG9tUmlnaHQnKSxcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBib3ggPSBpdGVtLmtleU9yaWdpblNoYXBlQm91bmRpbmdCb3g7XHJcblx0XHRcdFx0aWYgKGJveCkge1xyXG5cdFx0XHRcdFx0b3V0LmtleU9yaWdpblNoYXBlQkJveCA9IHtcclxuXHRcdFx0XHRcdFx0dW5pdFZhbHVlUXVhZFZlcnNpb246IDEsXHJcblx0XHRcdFx0XHRcdCdUb3AgJzogdW5pdHNWYWx1ZShib3gudG9wLCAndG9wJyksXHJcblx0XHRcdFx0XHRcdExlZnQ6IHVuaXRzVmFsdWUoYm94LmxlZnQsICdsZWZ0JyksXHJcblx0XHRcdFx0XHRcdEJ0b206IHVuaXRzVmFsdWUoYm94LmJvdHRvbSwgJ2JvdHRvbScpLFxyXG5cdFx0XHRcdFx0XHRSZ2h0OiB1bml0c1ZhbHVlKGJveC5yaWdodCwgJ3JpZ2h0JyksXHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgY29ybmVycyA9IGl0ZW0ua2V5T3JpZ2luQm94Q29ybmVycztcclxuXHRcdFx0XHRpZiAoY29ybmVycyAmJiBjb3JuZXJzLmxlbmd0aCA9PT0gNCkge1xyXG5cdFx0XHRcdFx0b3V0LmtleU9yaWdpbkJveENvcm5lcnMgPSB7XHJcblx0XHRcdFx0XHRcdHJlY3RhbmdsZUNvcm5lckE6IHsgSHJ6bjogY29ybmVyc1swXS54LCBWcnRjOiBjb3JuZXJzWzBdLnkgfSxcclxuXHRcdFx0XHRcdFx0cmVjdGFuZ2xlQ29ybmVyQjogeyBIcnpuOiBjb3JuZXJzWzFdLngsIFZydGM6IGNvcm5lcnNbMV0ueSB9LFxyXG5cdFx0XHRcdFx0XHRyZWN0YW5nbGVDb3JuZXJDOiB7IEhyem46IGNvcm5lcnNbMl0ueCwgVnJ0YzogY29ybmVyc1syXS55IH0sXHJcblx0XHRcdFx0XHRcdHJlY3RhbmdsZUNvcm5lckQ6IHsgSHJ6bjogY29ybmVyc1szXS54LCBWcnRjOiBjb3JuZXJzWzNdLnkgfSxcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCB0cmFuc2Zvcm0gPSBpdGVtLnRyYW5zZm9ybTtcclxuXHRcdFx0XHRpZiAodHJhbnNmb3JtICYmIHRyYW5zZm9ybS5sZW5ndGggPT09IDYpIHtcclxuXHRcdFx0XHRcdG91dC5Ucm5mID0ge1xyXG5cdFx0XHRcdFx0XHR4eDogdHJhbnNmb3JtWzBdLFxyXG5cdFx0XHRcdFx0XHR4eTogdHJhbnNmb3JtWzFdLFxyXG5cdFx0XHRcdFx0XHR5eDogdHJhbnNmb3JtWzJdLFxyXG5cdFx0XHRcdFx0XHR5eTogdHJhbnNmb3JtWzNdLFxyXG5cdFx0XHRcdFx0XHR0eDogdHJhbnNmb3JtWzRdLFxyXG5cdFx0XHRcdFx0XHR0eTogdHJhbnNmb3JtWzVdLFxyXG5cdFx0XHRcdFx0fTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdG91dC5rZXlPcmlnaW5JbmRleCA9IGk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHR9XHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsbWZ4JyxcclxuXHR0YXJnZXQgPT4gdGFyZ2V0LmVmZmVjdHMgIT09IHVuZGVmaW5lZCAmJiBoYXNNdWx0aUVmZmVjdHModGFyZ2V0LmVmZmVjdHMpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgXywgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGlmICh2ZXJzaW9uICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbG1meCB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0Y29uc3QgZGVzYzogTG1meERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGluZm8sIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdC8vIGRpc2NhcmQgaWYgcmVhZCBpbiAnbHJGWCcgb3IgJ2xmeDInIHNlY3Rpb25cclxuXHRcdHRhcmdldC5lZmZlY3RzID0gcGFyc2VFZmZlY3RzKGRlc2MsICEhb3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMpO1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQsIF8sIG9wdGlvbnMpID0+IHtcclxuXHRcdGNvbnN0IGRlc2MgPSBzZXJpYWxpemVFZmZlY3RzKHRhcmdldC5lZmZlY3RzISwgISFvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcywgdHJ1ZSk7XHJcblxyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsckZYJyxcclxuXHRoYXNLZXkoJ2VmZmVjdHMnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmICghdGFyZ2V0LmVmZmVjdHMpIHRhcmdldC5lZmZlY3RzID0gcmVhZEVmZmVjdHMocmVhZGVyKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUVmZmVjdHMod3JpdGVyLCB0YXJnZXQuZWZmZWN0cyEpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsdW5pJyxcclxuXHRoYXNLZXkoJ25hbWUnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5uYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVW5pY29kZVN0cmluZyh3cml0ZXIsIHRhcmdldC5uYW1lISk7XHJcblx0XHQvLyB3cml0ZVVpbnQxNih3cml0ZXIsIDApOyAvLyBwYWRkaW5nIChidXQgbm90IGV4dGVuZGluZyBzdHJpbmcgbGVuZ3RoKVxyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsbnNyJyxcclxuXHRoYXNLZXkoJ25hbWVTb3VyY2UnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5uYW1lU291cmNlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVTaWduYXR1cmUod3JpdGVyLCB0YXJnZXQubmFtZVNvdXJjZSEpLFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbHlpZCcsXHJcblx0aGFzS2V5KCdpZCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LmlkID0gcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdCh3cml0ZXIsIHRhcmdldCwgX3BzZCwgb3B0aW9ucykgPT4ge1xyXG5cdFx0bGV0IGlkID0gdGFyZ2V0LmlkITtcclxuXHRcdHdoaWxlIChvcHRpb25zLmxheWVySWRzLmluZGV4T2YoaWQpICE9PSAtMSkgaWQgKz0gMTAwOyAvLyBtYWtlIHN1cmUgd2UgZG9uJ3QgaGF2ZSBkdXBsaWNhdGUgbGF5ZXIgaWRzXHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGlkKTtcclxuXHRcdG9wdGlvbnMubGF5ZXJJZHMucHVzaChpZCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2xzY3QnLFxyXG5cdGhhc0tleSgnc2VjdGlvbkRpdmlkZXInKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5zZWN0aW9uRGl2aWRlciA9IHsgdHlwZTogcmVhZFVpbnQzMihyZWFkZXIpIH07XHJcblxyXG5cdFx0aWYgKGxlZnQoKSkge1xyXG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0XHRcdHRhcmdldC5zZWN0aW9uRGl2aWRlci5rZXkgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnQoKSkge1xyXG5cdFx0XHQvLyAwID0gbm9ybWFsXHJcblx0XHRcdC8vIDEgPSBzY2VuZSBncm91cCwgYWZmZWN0cyB0aGUgYW5pbWF0aW9uIHRpbWVsaW5lLlxyXG5cdFx0XHR0YXJnZXQuc2VjdGlvbkRpdmlkZXIuc3ViVHlwZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdH1cclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQuc2VjdGlvbkRpdmlkZXIhLnR5cGUpO1xyXG5cclxuXHRcdGlmICh0YXJnZXQuc2VjdGlvbkRpdmlkZXIhLmtleSkge1xyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICc4QklNJyk7XHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5rZXkpO1xyXG5cclxuXHRcdFx0aWYgKHRhcmdldC5zZWN0aW9uRGl2aWRlciEuc3ViVHlwZSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQuc2VjdGlvbkRpdmlkZXIhLnN1YlR5cGUpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSxcclxuKTtcclxuXHJcbi8vIGl0IHNlZW1zIGxzZGsgaXMgdXNlZCB3aGVuIHRoZXJlJ3MgYSBsYXllciBpcyBuZXN0ZWQgbW9yZSB0aGFuIDYgbGV2ZWxzLCBidXQgSSBkb24ndCBrbm93IHdoeT9cclxuLy8gbWF5YmUgc29tZSBsaW1pdGF0aW9uIG9mIG9sZCB2ZXJzaW9uIG9mIFBTP1xyXG5hZGRIYW5kbGVyQWxpYXMoJ2xzZGsnLCAnbHNjdCcpO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnY2xibCcsXHJcblx0aGFzS2V5KCdibGVuZENsaXBwZW5kRWxlbWVudHMnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5ibGVuZENsaXBwZW5kRWxlbWVudHMgPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQuYmxlbmRDbGlwcGVuZEVsZW1lbnRzID8gMSA6IDApO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdpbmZ4JyxcclxuXHRoYXNLZXkoJ2JsZW5kSW50ZXJpb3JFbGVtZW50cycpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmJsZW5kSW50ZXJpb3JFbGVtZW50cyA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHRhcmdldC5ibGVuZEludGVyaW9yRWxlbWVudHMgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2tua28nLFxyXG5cdGhhc0tleSgna25vY2tvdXQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5rbm9ja291dCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHRhcmdldC5rbm9ja291dCA/IDEgOiAwKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbHNwZicsXHJcblx0aGFzS2V5KCdwcm90ZWN0ZWQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGZsYWdzID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0dGFyZ2V0LnByb3RlY3RlZCA9IHtcclxuXHRcdFx0dHJhbnNwYXJlbmN5OiAoZmxhZ3MgJiAweDAxKSAhPT0gMCxcclxuXHRcdFx0Y29tcG9zaXRlOiAoZmxhZ3MgJiAweDAyKSAhPT0gMCxcclxuXHRcdFx0cG9zaXRpb246IChmbGFncyAmIDB4MDQpICE9PSAwLFxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoZmxhZ3MgJiAweDA4KSB0YXJnZXQucHJvdGVjdGVkLmFydGJvYXJkcyA9IHRydWU7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGZsYWdzID1cclxuXHRcdFx0KHRhcmdldC5wcm90ZWN0ZWQhLnRyYW5zcGFyZW5jeSA/IDB4MDEgOiAwKSB8XHJcblx0XHRcdCh0YXJnZXQucHJvdGVjdGVkIS5jb21wb3NpdGUgPyAweDAyIDogMCkgfFxyXG5cdFx0XHQodGFyZ2V0LnByb3RlY3RlZCEucG9zaXRpb24gPyAweDA0IDogMCkgfFxyXG5cdFx0XHQodGFyZ2V0LnByb3RlY3RlZCEuYXJ0Ym9hcmRzID8gMHgwOCA6IDApO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgZmxhZ3MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdsY2xyJyxcclxuXHRoYXNLZXkoJ2xheWVyQ29sb3InKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGNvbG9yID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XHJcblx0XHR0YXJnZXQubGF5ZXJDb2xvciA9IGxheWVyQ29sb3JzW2NvbG9yXTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5kZXggPSBsYXllckNvbG9ycy5pbmRleE9mKHRhcmdldC5sYXllckNvbG9yISk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZGV4ID09PSAtMSA/IDAgOiBpbmRleCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgNik7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBDdXN0b21EZXNjcmlwdG9yIHtcclxuXHRsYXllclRpbWU/OiBudW1iZXI7XHJcbn1cclxuXHJcbmludGVyZmFjZSBGcmFtZUxpc3REZXNjcmlwdG9yIHtcclxuXHRMYUlEOiBudW1iZXI7XHJcblx0TGFTdDoge1xyXG5cdFx0ZW5hYj86IGJvb2xlYW47XHJcblx0XHRJTXNrPzogeyBPZnN0OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9IH07XHJcblx0XHRWTXNrPzogeyBPZnN0OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9IH07XHJcblx0XHRGWFJmPzogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRcdEZyTHM6IG51bWJlcltdO1xyXG5cdH1bXTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnc2htZCcsXHJcblx0aGFzS2V5KCd0aW1lc3RhbXAnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIF8sIG9wdGlvbnMpID0+IHtcclxuXHRcdGNvbnN0IGNvdW50ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xyXG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0XHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0cmVhZFVpbnQ4KHJlYWRlcik7IC8vIGNvcHlcclxuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblxyXG5cdFx0XHRyZWFkU2VjdGlvbihyZWFkZXIsIDEsIGxlZnQgPT4ge1xyXG5cdFx0XHRcdGlmIChrZXkgPT09ICdjdXN0Jykge1xyXG5cdFx0XHRcdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIEN1c3RvbURlc2NyaXB0b3I7XHJcblx0XHRcdFx0XHRpZiAoZGVzYy5sYXllclRpbWUgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LnRpbWVzdGFtcCA9IGRlc2MubGF5ZXJUaW1lO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnbWxzdCcpIHtcclxuXHRcdFx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBGcmFtZUxpc3REZXNjcmlwdG9yO1xyXG5cdFx0XHRcdFx0b3B0aW9ucy5sb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnbWxzdCcsIGRlc2MpO1xyXG5cdFx0XHRcdFx0Ly8gb3B0aW9ucy5sb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnbWxzdCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnbWR5bicpIHtcclxuXHRcdFx0XHRcdC8vIGZyYW1lIGZsYWdzXHJcblx0XHRcdFx0XHRjb25zdCB1bmtub3duID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0Y29uc3QgcHJvcGFnYXRlID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdFx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdFx0Y29uc3QgdW5pZnlMYXllclBvc2l0aW9uID0gKGZsYWdzICYgMSkgIT09IDA7XHJcblx0XHRcdFx0XHRjb25zdCB1bmlmeUxheWVyU3R5bGUgPSAoZmxhZ3MgJiAyKSAhPT0gMDtcclxuXHRcdFx0XHRcdGNvbnN0IHVuaWZ5TGF5ZXJWaXNpYmlsaXR5ID0gKGZsYWdzICYgNCkgIT09IDA7XHJcblx0XHRcdFx0XHRvcHRpb25zLmxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKFxyXG5cdFx0XHRcdFx0XHQnbWR5bicsICd1bmtub3duOicsIHVua25vd24sICdwcm9wYWdhdGU6JywgcHJvcGFnYXRlLFxyXG5cdFx0XHRcdFx0XHQnZmxhZ3M6JywgZmxhZ3MsIHsgdW5pZnlMYXllclBvc2l0aW9uLCB1bmlmeUxheWVyU3R5bGUsIHVuaWZ5TGF5ZXJWaXNpYmlsaXR5IH0pO1xyXG5cclxuXHRcdFx0XHRcdC8vIGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBGcmFtZUxpc3REZXNjcmlwdG9yO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ21keW4nLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0b3B0aW9ucy5sb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIG1ldGFkYXRhJywga2V5KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2M6IEN1c3RvbURlc2NyaXB0b3IgPSB7XHJcblx0XHRcdGxheWVyVGltZTogdGFyZ2V0LnRpbWVzdGFtcCEsXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMSk7IC8vIGNvdW50XHJcblxyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnOEJJTScpO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAnY3VzdCcpO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApOyAvLyBjb3B5IChhbHdheXMgZmFsc2UpXHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0XHR3cml0ZVNlY3Rpb24od3JpdGVyLCAyLCAoKSA9PiB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdtZXRhZGF0YScsIGRlc2MpLCB0cnVlKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQndnN0aycsXHJcblx0aGFzS2V5KCd2ZWN0b3JTdHJva2UnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBTdHJva2VEZXNjcmlwdG9yO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0dGFyZ2V0LnZlY3RvclN0cm9rZSA9IHtcclxuXHRcdFx0c3Ryb2tlRW5hYmxlZDogZGVzYy5zdHJva2VFbmFibGVkLFxyXG5cdFx0XHRmaWxsRW5hYmxlZDogZGVzYy5maWxsRW5hYmxlZCxcclxuXHRcdFx0bGluZVdpZHRoOiBwYXJzZVVuaXRzKGRlc2Muc3Ryb2tlU3R5bGVMaW5lV2lkdGgpLFxyXG5cdFx0XHRsaW5lRGFzaE9mZnNldDogcGFyc2VVbml0cyhkZXNjLnN0cm9rZVN0eWxlTGluZURhc2hPZmZzZXQpLFxyXG5cdFx0XHRtaXRlckxpbWl0OiBkZXNjLnN0cm9rZVN0eWxlTWl0ZXJMaW1pdCxcclxuXHRcdFx0bGluZUNhcFR5cGU6IHN0cm9rZVN0eWxlTGluZUNhcFR5cGUuZGVjb2RlKGRlc2Muc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZSksXHJcblx0XHRcdGxpbmVKb2luVHlwZTogc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUuZGVjb2RlKGRlc2Muc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUpLFxyXG5cdFx0XHRsaW5lQWxpZ25tZW50OiBzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQuZGVjb2RlKGRlc2Muc3Ryb2tlU3R5bGVMaW5lQWxpZ25tZW50KSxcclxuXHRcdFx0c2NhbGVMb2NrOiBkZXNjLnN0cm9rZVN0eWxlU2NhbGVMb2NrLFxyXG5cdFx0XHRzdHJva2VBZGp1c3Q6IGRlc2Muc3Ryb2tlU3R5bGVTdHJva2VBZGp1c3QsXHJcblx0XHRcdGxpbmVEYXNoU2V0OiBkZXNjLnN0cm9rZVN0eWxlTGluZURhc2hTZXQubWFwKHBhcnNlVW5pdHMpLFxyXG5cdFx0XHRibGVuZE1vZGU6IEJsbk0uZGVjb2RlKGRlc2Muc3Ryb2tlU3R5bGVCbGVuZE1vZGUpLFxyXG5cdFx0XHRvcGFjaXR5OiBwYXJzZVBlcmNlbnQoZGVzYy5zdHJva2VTdHlsZU9wYWNpdHkpLFxyXG5cdFx0XHRjb250ZW50OiBwYXJzZVZlY3RvckNvbnRlbnQoZGVzYy5zdHJva2VTdHlsZUNvbnRlbnQpLFxyXG5cdFx0XHRyZXNvbHV0aW9uOiBkZXNjLnN0cm9rZVN0eWxlUmVzb2x1dGlvbixcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3Qgc3Ryb2tlID0gdGFyZ2V0LnZlY3RvclN0cm9rZSE7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yOiBTdHJva2VEZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRzdHJva2VTdHlsZVZlcnNpb246IDIsXHJcblx0XHRcdHN0cm9rZUVuYWJsZWQ6ICEhc3Ryb2tlLnN0cm9rZUVuYWJsZWQsXHJcblx0XHRcdGZpbGxFbmFibGVkOiAhIXN0cm9rZS5maWxsRW5hYmxlZCxcclxuXHRcdFx0c3Ryb2tlU3R5bGVMaW5lV2lkdGg6IHN0cm9rZS5saW5lV2lkdGggfHwgeyB2YWx1ZTogMywgdW5pdHM6ICdQb2ludHMnIH0sXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZURhc2hPZmZzZXQ6IHN0cm9rZS5saW5lRGFzaE9mZnNldCB8fCB7IHZhbHVlOiAwLCB1bml0czogJ1BvaW50cycgfSxcclxuXHRcdFx0c3Ryb2tlU3R5bGVNaXRlckxpbWl0OiBzdHJva2UubWl0ZXJMaW1pdCA/PyAxMDAsXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZUNhcFR5cGU6IHN0cm9rZVN0eWxlTGluZUNhcFR5cGUuZW5jb2RlKHN0cm9rZS5saW5lQ2FwVHlwZSksXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZUpvaW5UeXBlOiBzdHJva2VTdHlsZUxpbmVKb2luVHlwZS5lbmNvZGUoc3Ryb2tlLmxpbmVKb2luVHlwZSksXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZUFsaWdubWVudDogc3Ryb2tlU3R5bGVMaW5lQWxpZ25tZW50LmVuY29kZShzdHJva2UubGluZUFsaWdubWVudCksXHJcblx0XHRcdHN0cm9rZVN0eWxlU2NhbGVMb2NrOiAhIXN0cm9rZS5zY2FsZUxvY2ssXHJcblx0XHRcdHN0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0OiAhIXN0cm9rZS5zdHJva2VBZGp1c3QsXHJcblx0XHRcdHN0cm9rZVN0eWxlTGluZURhc2hTZXQ6IHN0cm9rZS5saW5lRGFzaFNldCB8fCBbXSxcclxuXHRcdFx0c3Ryb2tlU3R5bGVCbGVuZE1vZGU6IEJsbk0uZW5jb2RlKHN0cm9rZS5ibGVuZE1vZGUpLFxyXG5cdFx0XHRzdHJva2VTdHlsZU9wYWNpdHk6IHVuaXRzUGVyY2VudChzdHJva2Uub3BhY2l0eSA/PyAxKSxcclxuXHRcdFx0c3Ryb2tlU3R5bGVDb250ZW50OiBzZXJpYWxpemVWZWN0b3JDb250ZW50KFxyXG5cdFx0XHRcdHN0cm9rZS5jb250ZW50IHx8IHsgdHlwZTogJ2NvbG9yJywgY29sb3I6IHsgcjogMCwgZzogMCwgYjogMCB9IH0pLmRlc2NyaXB0b3IsXHJcblx0XHRcdHN0cm9rZVN0eWxlUmVzb2x1dGlvbjogc3Ryb2tlLnJlc29sdXRpb24gPz8gNzIsXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3N0cm9rZVN0eWxlJywgZGVzY3JpcHRvcik7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBBcnRiRGVzY3JpcHRvciB7XHJcblx0YXJ0Ym9hcmRSZWN0OiB7ICdUb3AgJzogbnVtYmVyOyBMZWZ0OiBudW1iZXI7IEJ0b206IG51bWJlcjsgUmdodDogbnVtYmVyOyB9O1xyXG5cdGd1aWRlSW5kZWNlczogYW55W107XHJcblx0YXJ0Ym9hcmRQcmVzZXROYW1lOiBzdHJpbmc7XHJcblx0J0NsciAnOiBEZXNjcmlwdG9yQ29sb3I7XHJcblx0YXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZTogbnVtYmVyO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdhcnRiJywgLy8gcGVyLWxheWVyIGFyYm9hcmQgaW5mb1xyXG5cdGhhc0tleSgnYXJ0Ym9hcmQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBBcnRiRGVzY3JpcHRvcjtcclxuXHRcdGNvbnN0IHJlY3QgPSBkZXNjLmFydGJvYXJkUmVjdDtcclxuXHRcdHRhcmdldC5hcnRib2FyZCA9IHtcclxuXHRcdFx0cmVjdDogeyB0b3A6IHJlY3RbJ1RvcCAnXSwgbGVmdDogcmVjdC5MZWZ0LCBib3R0b206IHJlY3QuQnRvbSwgcmlnaHQ6IHJlY3QuUmdodCB9LFxyXG5cdFx0XHRndWlkZUluZGljZXM6IGRlc2MuZ3VpZGVJbmRlY2VzLFxyXG5cdFx0XHRwcmVzZXROYW1lOiBkZXNjLmFydGJvYXJkUHJlc2V0TmFtZSxcclxuXHRcdFx0Y29sb3I6IHBhcnNlQ29sb3IoZGVzY1snQ2xyICddKSxcclxuXHRcdFx0YmFja2dyb3VuZFR5cGU6IGRlc2MuYXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgYXJ0Ym9hcmQgPSB0YXJnZXQuYXJ0Ym9hcmQhO1xyXG5cdFx0Y29uc3QgcmVjdCA9IGFydGJvYXJkLnJlY3Q7XHJcblx0XHRjb25zdCBkZXNjOiBBcnRiRGVzY3JpcHRvciA9IHtcclxuXHRcdFx0YXJ0Ym9hcmRSZWN0OiB7ICdUb3AgJzogcmVjdC50b3AsIExlZnQ6IHJlY3QubGVmdCwgQnRvbTogcmVjdC5ib3R0b20sIFJnaHQ6IHJlY3QucmlnaHQgfSxcclxuXHRcdFx0Z3VpZGVJbmRlY2VzOiBhcnRib2FyZC5ndWlkZUluZGljZXMgfHwgW10sXHJcblx0XHRcdGFydGJvYXJkUHJlc2V0TmFtZTogYXJ0Ym9hcmQucHJlc2V0TmFtZSB8fCAnJyxcclxuXHRcdFx0J0NsciAnOiBzZXJpYWxpemVDb2xvcihhcnRib2FyZC5jb2xvciksXHJcblx0XHRcdGFydGJvYXJkQmFja2dyb3VuZFR5cGU6IGFydGJvYXJkLmJhY2tncm91bmRUeXBlID8/IDEsXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ2FydGJvYXJkJywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3NuMlAnLFxyXG5cdGhhc0tleSgndXNpbmdBbGlnbmVkUmVuZGVyaW5nJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB0YXJnZXQudXNpbmdBbGlnbmVkUmVuZGVyaW5nID0gISFyZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC51c2luZ0FsaWduZWRSZW5kZXJpbmcgPyAxIDogMCksXHJcbik7XHJcblxyXG5jb25zdCBwbGFjZWRMYXllclR5cGVzOiBQbGFjZWRMYXllclR5cGVbXSA9IFsndW5rbm93bicsICd2ZWN0b3InLCAncmFzdGVyJywgJ2ltYWdlIHN0YWNrJ107XHJcblxyXG5mdW5jdGlvbiBwYXJzZVdhcnAod2FycDogV2FycERlc2NyaXB0b3IgJiBRdWlsdFdhcnBEZXNjcmlwdG9yKTogV2FycCB7XHJcblx0Y29uc3QgcmVzdWx0OiBXYXJwID0ge1xyXG5cdFx0c3R5bGU6IHdhcnBTdHlsZS5kZWNvZGUod2FycC53YXJwU3R5bGUpLFxyXG5cdFx0dmFsdWU6IHdhcnAud2FycFZhbHVlIHx8IDAsXHJcblx0XHRwZXJzcGVjdGl2ZTogd2FycC53YXJwUGVyc3BlY3RpdmUgfHwgMCxcclxuXHRcdHBlcnNwZWN0aXZlT3RoZXI6IHdhcnAud2FycFBlcnNwZWN0aXZlT3RoZXIgfHwgMCxcclxuXHRcdHJvdGF0ZTogT3JudC5kZWNvZGUod2FycC53YXJwUm90YXRlKSxcclxuXHRcdGJvdW5kczogd2FycC5ib3VuZHMgJiYge1xyXG5cdFx0XHR0b3A6IHBhcnNlVW5pdHNPck51bWJlcih3YXJwLmJvdW5kc1snVG9wICddKSxcclxuXHRcdFx0bGVmdDogcGFyc2VVbml0c09yTnVtYmVyKHdhcnAuYm91bmRzLkxlZnQpLFxyXG5cdFx0XHRib3R0b206IHBhcnNlVW5pdHNPck51bWJlcih3YXJwLmJvdW5kcy5CdG9tKSxcclxuXHRcdFx0cmlnaHQ6IHBhcnNlVW5pdHNPck51bWJlcih3YXJwLmJvdW5kcy5SZ2h0KSxcclxuXHRcdH0sXHJcblx0XHR1T3JkZXI6IHdhcnAudU9yZGVyLFxyXG5cdFx0dk9yZGVyOiB3YXJwLnZPcmRlcixcclxuXHR9O1xyXG5cclxuXHRpZiAod2FycC5kZWZvcm1OdW1Sb3dzICE9IG51bGwgfHwgd2FycC5kZWZvcm1OdW1Db2xzICE9IG51bGwpIHtcclxuXHRcdHJlc3VsdC5kZWZvcm1OdW1Sb3dzID0gd2FycC5kZWZvcm1OdW1Sb3dzO1xyXG5cdFx0cmVzdWx0LmRlZm9ybU51bUNvbHMgPSB3YXJwLmRlZm9ybU51bUNvbHM7XHJcblx0fVxyXG5cclxuXHRjb25zdCBlbnZlbG9wZVdhcnAgPSB3YXJwLmN1c3RvbUVudmVsb3BlV2FycDtcclxuXHRpZiAoZW52ZWxvcGVXYXJwKSB7XHJcblx0XHRyZXN1bHQuY3VzdG9tRW52ZWxvcGVXYXJwID0ge1xyXG5cdFx0XHRtZXNoUG9pbnRzOiBbXSxcclxuXHRcdH07XHJcblxyXG5cdFx0Y29uc3QgeHMgPSBlbnZlbG9wZVdhcnAubWVzaFBvaW50cy5maW5kKGkgPT4gaS50eXBlID09PSAnSHJ6bicpPy52YWx1ZXMgfHwgW107XHJcblx0XHRjb25zdCB5cyA9IGVudmVsb3BlV2FycC5tZXNoUG9pbnRzLmZpbmQoaSA9PiBpLnR5cGUgPT09ICdWcnRjJyk/LnZhbHVlcyB8fCBbXTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdHJlc3VsdC5jdXN0b21FbnZlbG9wZVdhcnAhLm1lc2hQb2ludHMucHVzaCh7IHg6IHhzW2ldLCB5OiB5c1tpXSB9KTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoZW52ZWxvcGVXYXJwLnF1aWx0U2xpY2VYIHx8IGVudmVsb3BlV2FycC5xdWlsdFNsaWNlWSkge1xyXG5cdFx0XHRyZXN1bHQuY3VzdG9tRW52ZWxvcGVXYXJwLnF1aWx0U2xpY2VYID0gZW52ZWxvcGVXYXJwLnF1aWx0U2xpY2VYPy5bMF0/LnZhbHVlcyB8fCBbXTtcclxuXHRcdFx0cmVzdWx0LmN1c3RvbUVudmVsb3BlV2FycC5xdWlsdFNsaWNlWSA9IGVudmVsb3BlV2FycC5xdWlsdFNsaWNlWT8uWzBdPy52YWx1ZXMgfHwgW107XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBpc1F1aWx0V2FycCh3YXJwOiBXYXJwKSB7XHJcblx0cmV0dXJuIHdhcnAuZGVmb3JtTnVtQ29scyAhPSBudWxsIHx8IHdhcnAuZGVmb3JtTnVtUm93cyAhPSBudWxsIHx8XHJcblx0XHR3YXJwLmN1c3RvbUVudmVsb3BlV2FycD8ucXVpbHRTbGljZVggfHwgd2FycC5jdXN0b21FbnZlbG9wZVdhcnA/LnF1aWx0U2xpY2VZO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbmNvZGVXYXJwKHdhcnA6IFdhcnApOiBXYXJwRGVzY3JpcHRvciB7XHJcblx0Y29uc3QgYm91bmRzID0gd2FycC5ib3VuZHM7XHJcblx0Y29uc3QgZGVzYzogV2FycERlc2NyaXB0b3IgPSB7XHJcblx0XHR3YXJwU3R5bGU6IHdhcnBTdHlsZS5lbmNvZGUod2FycC5zdHlsZSksXHJcblx0XHR3YXJwVmFsdWU6IHdhcnAudmFsdWUgfHwgMCxcclxuXHRcdHdhcnBQZXJzcGVjdGl2ZTogd2FycC5wZXJzcGVjdGl2ZSB8fCAwLFxyXG5cdFx0d2FycFBlcnNwZWN0aXZlT3RoZXI6IHdhcnAucGVyc3BlY3RpdmVPdGhlciB8fCAwLFxyXG5cdFx0d2FycFJvdGF0ZTogT3JudC5lbmNvZGUod2FycC5yb3RhdGUpLFxyXG5cdFx0Ym91bmRzOiB7XHJcblx0XHRcdCdUb3AgJzogdW5pdHNWYWx1ZShib3VuZHMgJiYgYm91bmRzLnRvcCB8fCB7IHVuaXRzOiAnUGl4ZWxzJywgdmFsdWU6IDAgfSwgJ2JvdW5kcy50b3AnKSxcclxuXHRcdFx0TGVmdDogdW5pdHNWYWx1ZShib3VuZHMgJiYgYm91bmRzLmxlZnQgfHwgeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiAwIH0sICdib3VuZHMubGVmdCcpLFxyXG5cdFx0XHRCdG9tOiB1bml0c1ZhbHVlKGJvdW5kcyAmJiBib3VuZHMuYm90dG9tIHx8IHsgdW5pdHM6ICdQaXhlbHMnLCB2YWx1ZTogMCB9LCAnYm91bmRzLmJvdHRvbScpLFxyXG5cdFx0XHRSZ2h0OiB1bml0c1ZhbHVlKGJvdW5kcyAmJiBib3VuZHMucmlnaHQgfHwgeyB1bml0czogJ1BpeGVscycsIHZhbHVlOiAwIH0sICdib3VuZHMucmlnaHQnKSxcclxuXHRcdH0sXHJcblx0XHR1T3JkZXI6IHdhcnAudU9yZGVyIHx8IDAsXHJcblx0XHR2T3JkZXI6IHdhcnAudk9yZGVyIHx8IDAsXHJcblx0fTtcclxuXHJcblx0Y29uc3QgaXNRdWlsdCA9IGlzUXVpbHRXYXJwKHdhcnApO1xyXG5cclxuXHRpZiAoaXNRdWlsdCkge1xyXG5cdFx0Y29uc3QgZGVzYzIgPSBkZXNjIGFzIFF1aWx0V2FycERlc2NyaXB0b3I7XHJcblx0XHRkZXNjMi5kZWZvcm1OdW1Sb3dzID0gd2FycC5kZWZvcm1OdW1Sb3dzIHx8IDA7XHJcblx0XHRkZXNjMi5kZWZvcm1OdW1Db2xzID0gd2FycC5kZWZvcm1OdW1Db2xzIHx8IDA7XHJcblx0fVxyXG5cclxuXHRjb25zdCBjdXN0b21FbnZlbG9wZVdhcnAgPSB3YXJwLmN1c3RvbUVudmVsb3BlV2FycDtcclxuXHRpZiAoY3VzdG9tRW52ZWxvcGVXYXJwKSB7XHJcblx0XHRjb25zdCBtZXNoUG9pbnRzID0gY3VzdG9tRW52ZWxvcGVXYXJwLm1lc2hQb2ludHMgfHwgW107XHJcblxyXG5cdFx0aWYgKGlzUXVpbHQpIHtcclxuXHRcdFx0Y29uc3QgZGVzYzIgPSBkZXNjIGFzIFF1aWx0V2FycERlc2NyaXB0b3I7XHJcblx0XHRcdGRlc2MyLmN1c3RvbUVudmVsb3BlV2FycCA9IHtcclxuXHRcdFx0XHRxdWlsdFNsaWNlWDogW3tcclxuXHRcdFx0XHRcdHR5cGU6ICdxdWlsdFNsaWNlWCcsXHJcblx0XHRcdFx0XHR2YWx1ZXM6IGN1c3RvbUVudmVsb3BlV2FycC5xdWlsdFNsaWNlWCB8fCBbXSxcclxuXHRcdFx0XHR9XSxcclxuXHRcdFx0XHRxdWlsdFNsaWNlWTogW3tcclxuXHRcdFx0XHRcdHR5cGU6ICdxdWlsdFNsaWNlWScsXHJcblx0XHRcdFx0XHR2YWx1ZXM6IGN1c3RvbUVudmVsb3BlV2FycC5xdWlsdFNsaWNlWSB8fCBbXSxcclxuXHRcdFx0XHR9XSxcclxuXHRcdFx0XHRtZXNoUG9pbnRzOiBbXHJcblx0XHRcdFx0XHR7IHR5cGU6ICdIcnpuJywgdmFsdWVzOiBtZXNoUG9pbnRzLm1hcChwID0+IHAueCkgfSxcclxuXHRcdFx0XHRcdHsgdHlwZTogJ1ZydGMnLCB2YWx1ZXM6IG1lc2hQb2ludHMubWFwKHAgPT4gcC55KSB9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRkZXNjLmN1c3RvbUVudmVsb3BlV2FycCA9IHtcclxuXHRcdFx0XHRtZXNoUG9pbnRzOiBbXHJcblx0XHRcdFx0XHR7IHR5cGU6ICdIcnpuJywgdmFsdWVzOiBtZXNoUG9pbnRzLm1hcChwID0+IHAueCkgfSxcclxuXHRcdFx0XHRcdHsgdHlwZTogJ1ZydGMnLCB2YWx1ZXM6IG1lc2hQb2ludHMubWFwKHAgPT4gcC55KSB9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZGVzYztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnUGxMZCcsXHJcblx0aGFzS2V5KCdwbGFjZWRMYXllcicpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRTaWduYXR1cmUocmVhZGVyKSAhPT0gJ3BsY0wnKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUGxMZCBzaWduYXR1cmVgKTtcclxuXHRcdGlmIChyZWFkSW50MzIocmVhZGVyKSAhPT0gMykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFBsTGQgdmVyc2lvbmApO1xyXG5cdFx0Y29uc3QgaWQgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMSk7XHJcblx0XHRyZWFkSW50MzIocmVhZGVyKTsgLy8gcGFnZU51bWJlclxyXG5cdFx0cmVhZEludDMyKHJlYWRlcik7IC8vIHRvdGFsUGFnZXMsIFRPRE86IGNoZWNrIGhvdyB0aGlzIHdvcmtzID9cclxuXHRcdHJlYWRJbnQzMihyZWFkZXIpOyAvLyBhbml0QWxpYXNQb2xpY3kgMTZcclxuXHRcdGNvbnN0IHBsYWNlZExheWVyVHlwZSA9IHJlYWRJbnQzMihyZWFkZXIpOyAvLyAwID0gdW5rbm93biwgMSA9IHZlY3RvciwgMiA9IHJhc3RlciwgMyA9IGltYWdlIHN0YWNrXHJcblx0XHRpZiAoIXBsYWNlZExheWVyVHlwZXNbcGxhY2VkTGF5ZXJUeXBlXSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFBsTGQgdHlwZScpO1xyXG5cdFx0Y29uc3QgdHJhbnNmb3JtOiBudW1iZXJbXSA9IFtdO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA4OyBpKyspIHRyYW5zZm9ybS5wdXNoKHJlYWRGbG9hdDY0KHJlYWRlcikpOyAvLyB4LCB5IG9mIDQgY29ybmVycyBvZiB0aGUgdHJhbnNmb3JtXHJcblx0XHRjb25zdCB3YXJwVmVyc2lvbiA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0aWYgKHdhcnBWZXJzaW9uICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgV2FycCB2ZXJzaW9uICR7d2FycFZlcnNpb259YCk7XHJcblx0XHRjb25zdCB3YXJwOiBXYXJwRGVzY3JpcHRvciAmIFF1aWx0V2FycERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHJcblx0XHR0YXJnZXQucGxhY2VkTGF5ZXIgPSB0YXJnZXQucGxhY2VkTGF5ZXIgfHwgeyAvLyBza2lwIGlmIFNvTGQgYWxyZWFkeSBzZXQgaXRcclxuXHRcdFx0aWQsXHJcblx0XHRcdHR5cGU6IHBsYWNlZExheWVyVHlwZXNbcGxhY2VkTGF5ZXJUeXBlXSxcclxuXHRcdFx0Ly8gcGFnZU51bWJlcixcclxuXHRcdFx0Ly8gdG90YWxQYWdlcyxcclxuXHRcdFx0dHJhbnNmb3JtLFxyXG5cdFx0XHR3YXJwOiBwYXJzZVdhcnAod2FycCksXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIGNvbnNvbGUubG9nKCdQbExkIHdhcnAnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdCh3YXJwLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCdQbExkJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QodGFyZ2V0LnBsYWNlZExheWVyLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBwbGFjZWQgPSB0YXJnZXQucGxhY2VkTGF5ZXIhO1xyXG5cdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCAncGxjTCcpO1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDMpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIHBsYWNlZC5pZCwgMSk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgMSk7IC8vIHBhZ2VOdW1iZXJcclxuXHRcdHdyaXRlSW50MzIod3JpdGVyLCAxKTsgLy8gdG90YWxQYWdlc1xyXG5cdFx0d3JpdGVJbnQzMih3cml0ZXIsIDE2KTsgLy8gYW5pdEFsaWFzUG9saWN5XHJcblx0XHRpZiAocGxhY2VkTGF5ZXJUeXBlcy5pbmRleE9mKHBsYWNlZC50eXBlKSA9PT0gLTEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwbGFjZWRMYXllciB0eXBlJyk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgcGxhY2VkTGF5ZXJUeXBlcy5pbmRleE9mKHBsYWNlZC50eXBlKSk7XHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDg7IGkrKykgd3JpdGVGbG9hdDY0KHdyaXRlciwgcGxhY2VkLnRyYW5zZm9ybVtpXSk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgMCk7IC8vIHdhcnAgdmVyc2lvblxyXG5cdFx0Y29uc3QgaXNRdWlsdCA9IHBsYWNlZC53YXJwICYmIGlzUXVpbHRXYXJwKHBsYWNlZC53YXJwKTtcclxuXHRcdGNvbnN0IHR5cGUgPSBpc1F1aWx0ID8gJ3F1aWx0V2FycCcgOiAnd2FycCc7XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsIHR5cGUsIGVuY29kZVdhcnAocGxhY2VkLndhcnAgfHwge30pLCB0eXBlKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIFNvTGREZXNjcmlwdG9yIHtcclxuXHRJZG50OiBzdHJpbmc7XHJcblx0cGxhY2VkOiBzdHJpbmc7XHJcblx0UGdObTogbnVtYmVyO1xyXG5cdHRvdGFsUGFnZXM6IG51bWJlcjtcclxuXHRDcm9wPzogbnVtYmVyO1xyXG5cdGZyYW1lU3RlcDogeyBudW1lcmF0b3I6IG51bWJlcjsgZGVub21pbmF0b3I6IG51bWJlcjsgfTtcclxuXHRkdXJhdGlvbjogeyBudW1lcmF0b3I6IG51bWJlcjsgZGVub21pbmF0b3I6IG51bWJlcjsgfTtcclxuXHRmcmFtZUNvdW50OiBudW1iZXI7XHJcblx0QW5udDogbnVtYmVyO1xyXG5cdFR5cGU6IG51bWJlcjtcclxuXHRUcm5mOiBudW1iZXJbXTtcclxuXHRub25BZmZpbmVUcmFuc2Zvcm06IG51bWJlcltdO1xyXG5cdHF1aWx0V2FycD86IFF1aWx0V2FycERlc2NyaXB0b3I7XHJcblx0d2FycDogV2FycERlc2NyaXB0b3I7XHJcblx0J1N6ICAnOiB7IFdkdGg6IG51bWJlcjsgSGdodDogbnVtYmVyOyB9O1xyXG5cdFJzbHQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdGNvbXA/OiBudW1iZXI7XHJcblx0Y29tcEluZm8/OiB7IGNvbXBJRDogbnVtYmVyOyBvcmlnaW5hbENvbXBJRDogbnVtYmVyOyB9O1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdTb0xkJyxcclxuXHRoYXNLZXkoJ3BsYWNlZExheWVyJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZFNpZ25hdHVyZShyZWFkZXIpICE9PSAnc29MRCcpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBTb0xkIHR5cGVgKTtcclxuXHRcdGlmIChyZWFkSW50MzIocmVhZGVyKSAhPT0gNCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFNvTGQgdmVyc2lvbmApO1xyXG5cdFx0Y29uc3QgZGVzYzogU29MZERlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCdTb0xkJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZygnU29MZC53YXJwJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYy53YXJwLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCdTb0xkLnF1aWx0V2FycCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MucXVpbHRXYXJwLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHR0YXJnZXQucGxhY2VkTGF5ZXIgPSB7XHJcblx0XHRcdGlkOiBkZXNjLklkbnQsXHJcblx0XHRcdHBsYWNlZDogZGVzYy5wbGFjZWQsXHJcblx0XHRcdHR5cGU6IHBsYWNlZExheWVyVHlwZXNbZGVzYy5UeXBlXSxcclxuXHRcdFx0Ly8gcGFnZU51bWJlcjogaW5mby5QZ05tLFxyXG5cdFx0XHQvLyB0b3RhbFBhZ2VzOiBpbmZvLnRvdGFsUGFnZXMsXHJcblx0XHRcdC8vIGZyYW1lU3RlcDogaW5mby5mcmFtZVN0ZXAsXHJcblx0XHRcdC8vIGR1cmF0aW9uOiBpbmZvLmR1cmF0aW9uLFxyXG5cdFx0XHQvLyBmcmFtZUNvdW50OiBpbmZvLmZyYW1lQ291bnQsXHJcblx0XHRcdHRyYW5zZm9ybTogZGVzYy5Ucm5mLFxyXG5cdFx0XHR3aWR0aDogZGVzY1snU3ogICddLldkdGgsXHJcblx0XHRcdGhlaWdodDogZGVzY1snU3ogICddLkhnaHQsXHJcblx0XHRcdHJlc29sdXRpb246IHBhcnNlVW5pdHMoZGVzYy5Sc2x0KSxcclxuXHRcdFx0d2FycDogcGFyc2VXYXJwKChkZXNjLnF1aWx0V2FycCB8fCBkZXNjLndhcnApIGFzIGFueSksXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmIChkZXNjLm5vbkFmZmluZVRyYW5zZm9ybSAmJiBkZXNjLm5vbkFmZmluZVRyYW5zZm9ybS5zb21lKCh4LCBpKSA9PiB4ICE9PSBkZXNjLlRybmZbaV0pKSB7XHJcblx0XHRcdHRhcmdldC5wbGFjZWRMYXllci5ub25BZmZpbmVUcmFuc2Zvcm0gPSBkZXNjLm5vbkFmZmluZVRyYW5zZm9ybTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoZGVzYy5Dcm9wKSB0YXJnZXQucGxhY2VkTGF5ZXIuY3JvcCA9IGRlc2MuQ3JvcDtcclxuXHRcdGlmIChkZXNjLmNvbXApIHRhcmdldC5wbGFjZWRMYXllci5jb21wID0gZGVzYy5jb21wO1xyXG5cdFx0aWYgKGRlc2MuY29tcEluZm8pIHRhcmdldC5wbGFjZWRMYXllci5jb21wSW5mbyA9IGRlc2MuY29tcEluZm87XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTsgLy8gSEFDS1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdzb0xEJyk7XHJcblx0XHR3cml0ZUludDMyKHdyaXRlciwgNCk7IC8vIHZlcnNpb25cclxuXHJcblx0XHRjb25zdCBwbGFjZWQgPSB0YXJnZXQucGxhY2VkTGF5ZXIhO1xyXG5cdFx0Y29uc3QgZGVzYzogU29MZERlc2NyaXB0b3IgPSB7XHJcblx0XHRcdElkbnQ6IHBsYWNlZC5pZCxcclxuXHRcdFx0cGxhY2VkOiBwbGFjZWQucGxhY2VkID8/IHBsYWNlZC5pZCwgLy8gPz8/XHJcblx0XHRcdFBnTm06IDEsXHJcblx0XHRcdHRvdGFsUGFnZXM6IDEsXHJcblx0XHRcdC4uLihwbGFjZWQuY3JvcCA/IHsgQ3JvcDogcGxhY2VkLmNyb3AgfSA6IHt9KSxcclxuXHRcdFx0ZnJhbWVTdGVwOiB7XHJcblx0XHRcdFx0bnVtZXJhdG9yOiAwLFxyXG5cdFx0XHRcdGRlbm9taW5hdG9yOiA2MDBcclxuXHRcdFx0fSxcclxuXHRcdFx0ZHVyYXRpb246IHtcclxuXHRcdFx0XHRudW1lcmF0b3I6IDAsXHJcblx0XHRcdFx0ZGVub21pbmF0b3I6IDYwMFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRmcmFtZUNvdW50OiAxLFxyXG5cdFx0XHRBbm50OiAxNixcclxuXHRcdFx0VHlwZTogcGxhY2VkTGF5ZXJUeXBlcy5pbmRleE9mKHBsYWNlZC50eXBlKSxcclxuXHRcdFx0VHJuZjogcGxhY2VkLnRyYW5zZm9ybSxcclxuXHRcdFx0bm9uQWZmaW5lVHJhbnNmb3JtOiBwbGFjZWQubm9uQWZmaW5lVHJhbnNmb3JtID8/IHBsYWNlZC50cmFuc2Zvcm0sXHJcblx0XHRcdHF1aWx0V2FycDoge30gYXMgYW55LFxyXG5cdFx0XHR3YXJwOiBlbmNvZGVXYXJwKHBsYWNlZC53YXJwIHx8IHt9KSxcclxuXHRcdFx0J1N6ICAnOiB7XHJcblx0XHRcdFx0V2R0aDogcGxhY2VkLndpZHRoIHx8IDAsIC8vIFRPRE86IGZpbmQgc2l6ZSA/XHJcblx0XHRcdFx0SGdodDogcGxhY2VkLmhlaWdodCB8fCAwLCAvLyBUT0RPOiBmaW5kIHNpemUgP1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRSc2x0OiBwbGFjZWQucmVzb2x1dGlvbiA/IHVuaXRzVmFsdWUocGxhY2VkLnJlc29sdXRpb24sICdyZXNvbHV0aW9uJykgOiB7IHVuaXRzOiAnRGVuc2l0eScsIHZhbHVlOiA3MiB9LFxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAocGxhY2VkLndhcnAgJiYgaXNRdWlsdFdhcnAocGxhY2VkLndhcnApKSB7XHJcblx0XHRcdGNvbnN0IHF1aWx0V2FycCA9IGVuY29kZVdhcnAocGxhY2VkLndhcnApIGFzIFF1aWx0V2FycERlc2NyaXB0b3I7XHJcblx0XHRcdGRlc2MucXVpbHRXYXJwID0gcXVpbHRXYXJwO1xyXG5cdFx0XHRkZXNjLndhcnAgPSB7XHJcblx0XHRcdFx0d2FycFN0eWxlOiAnd2FycFN0eWxlLndhcnBOb25lJyxcclxuXHRcdFx0XHR3YXJwVmFsdWU6IHF1aWx0V2FycC53YXJwVmFsdWUsXHJcblx0XHRcdFx0d2FycFBlcnNwZWN0aXZlOiBxdWlsdFdhcnAud2FycFBlcnNwZWN0aXZlLFxyXG5cdFx0XHRcdHdhcnBQZXJzcGVjdGl2ZU90aGVyOiBxdWlsdFdhcnAud2FycFBlcnNwZWN0aXZlT3RoZXIsXHJcblx0XHRcdFx0d2FycFJvdGF0ZTogcXVpbHRXYXJwLndhcnBSb3RhdGUsXHJcblx0XHRcdFx0Ym91bmRzOiBxdWlsdFdhcnAuYm91bmRzLFxyXG5cdFx0XHRcdHVPcmRlcjogcXVpbHRXYXJwLnVPcmRlcixcclxuXHRcdFx0XHR2T3JkZXI6IHF1aWx0V2FycC52T3JkZXIsXHJcblx0XHRcdH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRkZWxldGUgZGVzYy5xdWlsdFdhcnA7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHBsYWNlZC5jb21wKSBkZXNjLmNvbXAgPSBwbGFjZWQuY29tcDtcclxuXHRcdGlmIChwbGFjZWQuY29tcEluZm8pIGRlc2MuY29tcEluZm8gPSBwbGFjZWQuY29tcEluZm87XHJcblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MsIGRlc2MucXVpbHRXYXJwID8gJ3F1aWx0V2FycCcgOiAnd2FycCcpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdmeHJwJyxcclxuXHRoYXNLZXkoJ3JlZmVyZW5jZVBvaW50JyksXHJcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR0YXJnZXQucmVmZXJlbmNlUG9pbnQgPSB7XHJcblx0XHRcdHg6IHJlYWRGbG9hdDY0KHJlYWRlciksXHJcblx0XHRcdHk6IHJlYWRGbG9hdDY0KHJlYWRlciksXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHR3cml0ZUZsb2F0NjQod3JpdGVyLCB0YXJnZXQucmVmZXJlbmNlUG9pbnQhLngpO1xyXG5cdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdGFyZ2V0LnJlZmVyZW5jZVBvaW50IS55KTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaWYgKE1PQ0tfSEFORExFUlMpIHtcclxuXHRhZGRIYW5kbGVyKFxyXG5cdFx0J1BhdHQnLFxyXG5cdFx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5fUGF0dCAhPT0gdW5kZWZpbmVkLFxyXG5cdFx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCdhZGRpdGlvbmFsIGluZm86IFBhdHQnKTtcclxuXHRcdFx0KHRhcmdldCBhcyBhbnkpLl9QYXR0ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdH0sXHJcblx0XHQod3JpdGVyLCB0YXJnZXQpID0+IGZhbHNlICYmIHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX1BhdHQpLFxyXG5cdCk7XHJcbn0gZWxzZSB7XHJcblx0YWRkSGFuZGxlcihcclxuXHRcdCdQYXR0JywgLy8gVE9ETzogaGFuZGxlIGFsc28gUGF0MiAmIFBhdDNcclxuXHRcdHRhcmdldCA9PiAhdGFyZ2V0LFxyXG5cdFx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRcdGlmICghbGVmdCgpKSByZXR1cm47XHJcblxyXG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpOyByZXR1cm47IC8vIG5vdCBzdXBwb3J0ZWQgeWV0XHJcblx0XHRcdHRhcmdldDsgcmVhZFBhdHRlcm47XHJcblxyXG5cdFx0XHQvLyBpZiAoIXRhcmdldC5wYXR0ZXJucykgdGFyZ2V0LnBhdHRlcm5zID0gW107XHJcblx0XHRcdC8vIHRhcmdldC5wYXR0ZXJucy5wdXNoKHJlYWRQYXR0ZXJuKHJlYWRlcikpO1xyXG5cdFx0XHQvLyBza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fSxcclxuXHRcdChfd3JpdGVyLCBfdGFyZ2V0KSA9PiB7XHJcblx0XHR9LFxyXG5cdCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlYWRSZWN0KHJlYWRlcjogUHNkUmVhZGVyKSB7XHJcblx0Y29uc3QgdG9wID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0Y29uc3QgbGVmdCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IGJvdHRvbSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdGNvbnN0IHJpZ2h0ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0cmV0dXJuIHsgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0IH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlUmVjdCh3cml0ZXI6IFBzZFdyaXRlciwgcmVjdDogeyBsZWZ0OiBudW1iZXI7IHRvcDogbnVtYmVyOyByaWdodDogbnVtYmVyOyBib3R0b206IG51bWJlciB9KSB7XHJcblx0d3JpdGVJbnQzMih3cml0ZXIsIHJlY3QudG9wKTtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgcmVjdC5sZWZ0KTtcclxuXHR3cml0ZUludDMyKHdyaXRlciwgcmVjdC5ib3R0b20pO1xyXG5cdHdyaXRlSW50MzIod3JpdGVyLCByZWN0LnJpZ2h0KTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnQW5ubycsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgUHNkKS5hbm5vdGF0aW9ucyAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgbWFqb3IgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRjb25zdCBtaW5vciA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGlmIChtYWpvciAhPT0gMiB8fCBtaW5vciAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEFubm8gdmVyc2lvbicpO1xyXG5cdFx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRjb25zdCBhbm5vdGF0aW9uczogQW5ub3RhdGlvbltdID0gW107XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XHJcblx0XHRcdC8qY29uc3QgbGVuZ3RoID0qLyByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IG9wZW4gPSAhIXJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHQvKmNvbnN0IGZsYWdzID0qLyByZWFkVWludDgocmVhZGVyKTsgLy8gYWx3YXlzIDI4XHJcblx0XHRcdC8qY29uc3Qgb3B0aW9uYWxCbG9ja3MgPSovIHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgaWNvbkxvY2F0aW9uID0gcmVhZFJlY3QocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgcG9wdXBMb2NhdGlvbiA9IHJlYWRSZWN0KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGNvbG9yID0gcmVhZENvbG9yKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGF1dGhvciA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAyKTtcclxuXHRcdFx0Y29uc3QgbmFtZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAyKTtcclxuXHRcdFx0Y29uc3QgZGF0ZSA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAyKTtcclxuXHRcdFx0Lypjb25zdCBjb250ZW50TGVuZ3RoID0qLyByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdC8qY29uc3QgZGF0YVR5cGUgPSovIHJlYWRTaWduYXR1cmUocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgZGF0YUxlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0bGV0IGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXk7XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3R4dEEnKSB7XHJcblx0XHRcdFx0aWYgKGRhdGFMZW5ndGggPj0gMiAmJiByZWFkVWludDE2KHJlYWRlcikgPT09IDB4ZmVmZikge1xyXG5cdFx0XHRcdFx0ZGF0YSA9IHJlYWRVbmljb2RlU3RyaW5nV2l0aExlbmd0aChyZWFkZXIsIChkYXRhTGVuZ3RoIC0gMikgLyAyKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVhZGVyLm9mZnNldCAtPSAyO1xyXG5cdFx0XHRcdFx0ZGF0YSA9IHJlYWRBc2NpaVN0cmluZyhyZWFkZXIsIGRhdGFMZW5ndGgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGF0YSA9IGRhdGEucmVwbGFjZSgvXFxyL2csICdcXG4nKTtcclxuXHRcdFx0fSBlbHNlIGlmICh0eXBlID09PSAnc25kQScpIHtcclxuXHRcdFx0XHRkYXRhID0gcmVhZEJ5dGVzKHJlYWRlciwgZGF0YUxlbmd0aCk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGFubm90YXRpb24gdHlwZScpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRhbm5vdGF0aW9ucy5wdXNoKHtcclxuXHRcdFx0XHR0eXBlOiB0eXBlID09PSAndHh0QScgPyAndGV4dCcgOiAnc291bmQnLCBvcGVuLCBpY29uTG9jYXRpb24sIHBvcHVwTG9jYXRpb24sIGNvbG9yLCBhdXRob3IsIG5hbWUsIGRhdGUsIGRhdGEsXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdCh0YXJnZXQgYXMgUHNkKS5hbm5vdGF0aW9ucyA9IGFubm90YXRpb25zO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgYW5ub3RhdGlvbnMgPSAodGFyZ2V0IGFzIFBzZCkuYW5ub3RhdGlvbnMhO1xyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpO1xyXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBhbm5vdGF0aW9ucy5sZW5ndGgpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgYW5ub3RhdGlvbiBvZiBhbm5vdGF0aW9ucykge1xyXG5cdFx0XHRjb25zdCBzb3VuZCA9IGFubm90YXRpb24udHlwZSA9PT0gJ3NvdW5kJztcclxuXHJcblx0XHRcdGlmIChzb3VuZCAmJiAhKGFubm90YXRpb24uZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKSB0aHJvdyBuZXcgRXJyb3IoJ1NvdW5kIGFubm90YXRpb24gZGF0YSBzaG91bGQgYmUgVWludDhBcnJheScpO1xyXG5cdFx0XHRpZiAoIXNvdW5kICYmIHR5cGVvZiBhbm5vdGF0aW9uLmRhdGEgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoJ1RleHQgYW5ub3RhdGlvbiBkYXRhIHNob3VsZCBiZSBzdHJpbmcnKTtcclxuXHJcblx0XHRcdGNvbnN0IGxlbmd0aE9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIGxlbmd0aFxyXG5cdFx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHNvdW5kID8gJ3NuZEEnIDogJ3R4dEEnKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGFubm90YXRpb24ub3BlbiA/IDEgOiAwKTtcclxuXHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIDI4KTtcclxuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTtcclxuXHRcdFx0d3JpdGVSZWN0KHdyaXRlciwgYW5ub3RhdGlvbi5pY29uTG9jYXRpb24pO1xyXG5cdFx0XHR3cml0ZVJlY3Qod3JpdGVyLCBhbm5vdGF0aW9uLnBvcHVwTG9jYXRpb24pO1xyXG5cdFx0XHR3cml0ZUNvbG9yKHdyaXRlciwgYW5ub3RhdGlvbi5jb2xvcik7XHJcblx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgYW5ub3RhdGlvbi5hdXRob3IgfHwgJycsIDIpO1xyXG5cdFx0XHR3cml0ZVBhc2NhbFN0cmluZyh3cml0ZXIsIGFubm90YXRpb24ubmFtZSB8fCAnJywgMik7XHJcblx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgYW5ub3RhdGlvbi5kYXRlIHx8ICcnLCAyKTtcclxuXHRcdFx0Y29uc3QgY29udGVudE9mZnNldCA9IHdyaXRlci5vZmZzZXQ7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIGNvbnRlbnQgbGVuZ3RoXHJcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgc291bmQgPyAnc25kTScgOiAndHh0QycpO1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyBkYXRhIGxlbmd0aFxyXG5cdFx0XHRjb25zdCBkYXRhT2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHJcblx0XHRcdGlmIChzb3VuZCkge1xyXG5cdFx0XHRcdHdyaXRlQnl0ZXMod3JpdGVyLCBhbm5vdGF0aW9uLmRhdGEgYXMgVWludDhBcnJheSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCAweGZlZmYpOyAvLyB1bmljb2RlIHN0cmluZyBpbmRpY2F0b3JcclxuXHRcdFx0XHRjb25zdCB0ZXh0ID0gKGFubm90YXRpb24uZGF0YSBhcyBzdHJpbmcpLnJlcGxhY2UoL1xcbi9nLCAnXFxyJyk7XHJcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB3cml0ZVVpbnQxNih3cml0ZXIsIHRleHQuY2hhckNvZGVBdChpKSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHdyaXRlci52aWV3LnNldFVpbnQzMihsZW5ndGhPZmZzZXQsIHdyaXRlci5vZmZzZXQgLSBsZW5ndGhPZmZzZXQsIGZhbHNlKTtcclxuXHRcdFx0d3JpdGVyLnZpZXcuc2V0VWludDMyKGNvbnRlbnRPZmZzZXQsIHdyaXRlci5vZmZzZXQgLSBjb250ZW50T2Zmc2V0LCBmYWxzZSk7XHJcblx0XHRcdHdyaXRlci52aWV3LnNldFVpbnQzMihkYXRhT2Zmc2V0IC0gNCwgd3JpdGVyLm9mZnNldCAtIGRhdGFPZmZzZXQsIGZhbHNlKTtcclxuXHRcdH1cclxuXHR9XHJcbik7XHJcblxyXG5pbnRlcmZhY2UgRmlsZU9wZW5EZXNjcmlwdG9yIHtcclxuXHRjb21wSW5mbzogeyBjb21wSUQ6IG51bWJlcjsgb3JpZ2luYWxDb21wSUQ6IG51bWJlcjsgfTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnbG5rMicsXHJcblx0KHRhcmdldDogYW55KSA9PiAhISh0YXJnZXQgYXMgUHNkKS5saW5rZWRGaWxlcyAmJiAodGFyZ2V0IGFzIFBzZCkubGlua2VkRmlsZXMhLmxlbmd0aCA+IDAsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSB0YXJnZXQgYXMgUHNkO1xyXG5cdFx0cHNkLmxpbmtlZEZpbGVzID0gW107XHJcblxyXG5cdFx0d2hpbGUgKGxlZnQoKSA+IDgpIHtcclxuXHRcdFx0bGV0IHNpemUgPSByZWFkTGVuZ3RoNjQocmVhZGVyKTsgLy8gc2l6ZVxyXG5cdFx0XHRjb25zdCBzdGFydE9mZnNldCA9IHJlYWRlci5vZmZzZXQ7XHJcblx0XHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcikgYXMgJ2xpRkQnIHwgJ2xpRkUnIHwgJ2xpRkEnO1xyXG5cdFx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cdFx0XHRjb25zdCBuYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcikudHJpbSgpOyAvLyAnICAgICcgaWYgZW1wdHlcclxuXHRcdFx0Y29uc3QgZmlsZUNyZWF0b3IgPSByZWFkU2lnbmF0dXJlKHJlYWRlcikudHJpbSgpOyAvLyAnICAgICcgb3IgJ1xcMFxcMFxcMFxcMCcgaWYgZW1wdHlcclxuXHRcdFx0Y29uc3QgZGF0YVNpemUgPSByZWFkTGVuZ3RoNjQocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgaGFzRmlsZU9wZW5EZXNjcmlwdG9yID0gcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGZpbGVPcGVuRGVzY3JpcHRvciA9IGhhc0ZpbGVPcGVuRGVzY3JpcHRvciA/IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIEZpbGVPcGVuRGVzY3JpcHRvciA6IHVuZGVmaW5lZDtcclxuXHRcdFx0Y29uc3QgbGlua2VkRmlsZURlc2NyaXB0b3IgPSB0eXBlID09PSAnbGlGRScgPyByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSA6IHVuZGVmaW5lZDtcclxuXHRcdFx0Y29uc3QgZmlsZTogTGlua2VkRmlsZSA9IHsgaWQsIG5hbWUsIGRhdGE6IHVuZGVmaW5lZCB9O1xyXG5cclxuXHRcdFx0aWYgKGZpbGVUeXBlKSBmaWxlLnR5cGUgPSBmaWxlVHlwZTtcclxuXHRcdFx0aWYgKGZpbGVDcmVhdG9yKSBmaWxlLmNyZWF0b3IgPSBmaWxlQ3JlYXRvcjtcclxuXHRcdFx0aWYgKGZpbGVPcGVuRGVzY3JpcHRvcikgZmlsZS5kZXNjcmlwdG9yID0gZmlsZU9wZW5EZXNjcmlwdG9yO1xyXG5cclxuXHRcdFx0aWYgKHR5cGUgPT09ICdsaUZFJyAmJiB2ZXJzaW9uID4gMykge1xyXG5cdFx0XHRcdGNvbnN0IHllYXIgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBtb250aCA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGRheSA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRcdGNvbnN0IGhvdXIgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBtaW51dGUgPSByZWFkVWludDgocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCBzZWNvbmRzID0gcmVhZEZsb2F0NjQocmVhZGVyKTtcclxuXHRcdFx0XHRjb25zdCB3aG9sZVNlY29uZHMgPSBNYXRoLmZsb29yKHNlY29uZHMpO1xyXG5cdFx0XHRcdGNvbnN0IG1zID0gKHNlY29uZHMgLSB3aG9sZVNlY29uZHMpICogMTAwMDtcclxuXHRcdFx0XHRmaWxlLnRpbWUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgZGF5LCBob3VyLCBtaW51dGUsIHdob2xlU2Vjb25kcywgbXMpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBmaWxlU2l6ZSA9IHR5cGUgPT09ICdsaUZFJyA/IHJlYWRMZW5ndGg2NChyZWFkZXIpIDogMDtcclxuXHRcdFx0aWYgKHR5cGUgPT09ICdsaUZBJykgc2tpcEJ5dGVzKHJlYWRlciwgOCk7XHJcblx0XHRcdGlmICh0eXBlID09PSAnbGlGRCcpIGZpbGUuZGF0YSA9IHJlYWRCeXRlcyhyZWFkZXIsIGRhdGFTaXplKTtcclxuXHRcdFx0aWYgKHZlcnNpb24gPj0gNSkgZmlsZS5jaGlsZERvY3VtZW50SUQgPSByZWFkVW5pY29kZVN0cmluZyhyZWFkZXIpO1xyXG5cdFx0XHRpZiAodmVyc2lvbiA+PSA2KSBmaWxlLmFzc2V0TW9kVGltZSA9IHJlYWRGbG9hdDY0KHJlYWRlcik7XHJcblx0XHRcdGlmICh2ZXJzaW9uID49IDcpIGZpbGUuYXNzZXRMb2NrZWRTdGF0ZSA9IHJlYWRVaW50OChyZWFkZXIpO1xyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ2xpRkUnKSBmaWxlLmRhdGEgPSByZWFkQnl0ZXMocmVhZGVyLCBmaWxlU2l6ZSk7XHJcblxyXG5cdFx0XHRpZiAob3B0aW9ucy5za2lwTGlua2VkRmlsZXNEYXRhKSBmaWxlLmRhdGEgPSB1bmRlZmluZWQ7XHJcblxyXG5cdFx0XHRwc2QubGlua2VkRmlsZXMucHVzaChmaWxlKTtcclxuXHRcdFx0bGlua2VkRmlsZURlc2NyaXB0b3I7XHJcblxyXG5cdFx0XHR3aGlsZSAoc2l6ZSAlIDQpIHNpemUrKztcclxuXHRcdFx0cmVhZGVyLm9mZnNldCA9IHN0YXJ0T2Zmc2V0ICsgc2l6ZTtcclxuXHRcdH1cclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpOyAvLyA/XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHRhcmdldCBhcyBQc2Q7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBmaWxlIG9mIHBzZC5saW5rZWRGaWxlcyEpIHtcclxuXHRcdFx0bGV0IHZlcnNpb24gPSAyO1xyXG5cclxuXHRcdFx0aWYgKGZpbGUuYXNzZXRMb2NrZWRTdGF0ZSAhPSBudWxsKSB2ZXJzaW9uID0gNztcclxuXHRcdFx0ZWxzZSBpZiAoZmlsZS5hc3NldE1vZFRpbWUgIT0gbnVsbCkgdmVyc2lvbiA9IDY7XHJcblx0XHRcdGVsc2UgaWYgKGZpbGUuY2hpbGREb2N1bWVudElEICE9IG51bGwpIHZlcnNpb24gPSA1O1xyXG5cdFx0XHQvLyBUT0RPOiBlbHNlIGlmIChmaWxlLnRpbWUgIT0gbnVsbCkgdmVyc2lvbiA9IDM7IChvbmx5IGZvciBsaUZFKVxyXG5cclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCAwKTsgLy8gc2l6ZVxyXG5cdFx0XHRjb25zdCBzaXplT2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmaWxlLmRhdGEgPyAnbGlGRCcgOiAnbGlGQScpO1xyXG5cdFx0XHR3cml0ZUludDMyKHdyaXRlciwgdmVyc2lvbik7XHJcblx0XHRcdHdyaXRlUGFzY2FsU3RyaW5nKHdyaXRlciwgZmlsZS5pZCB8fCAnJywgMSk7XHJcblx0XHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgZmlsZS5uYW1lIHx8ICcnKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmaWxlLnR5cGUgPyBgJHtmaWxlLnR5cGV9ICAgIGAuc3Vic3RyKDAsIDQpIDogJyAgICAnKTtcclxuXHRcdFx0d3JpdGVTaWduYXR1cmUod3JpdGVyLCBmaWxlLmNyZWF0b3IgPyBgJHtmaWxlLmNyZWF0b3J9ICAgIGAuc3Vic3RyKDAsIDQpIDogJ1xcMFxcMFxcMFxcMCcpO1xyXG5cdFx0XHR3cml0ZUxlbmd0aDY0KHdyaXRlciwgZmlsZS5kYXRhID8gZmlsZS5kYXRhLmJ5dGVMZW5ndGggOiAwKTtcclxuXHJcblx0XHRcdGlmIChmaWxlLmRlc2NyaXB0b3IgJiYgZmlsZS5kZXNjcmlwdG9yLmNvbXBJbmZvKSB7XHJcblx0XHRcdFx0Y29uc3QgZGVzYzogRmlsZU9wZW5EZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRcdFx0Y29tcEluZm86IGZpbGUuZGVzY3JpcHRvci5jb21wSW5mbyxcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgMSk7XHJcblx0XHRcdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKGZpbGUuZGF0YSkgd3JpdGVCeXRlcyh3cml0ZXIsIGZpbGUuZGF0YSk7XHJcblx0XHRcdGVsc2Ugd3JpdGVMZW5ndGg2NCh3cml0ZXIsIDApO1xyXG5cdFx0XHRpZiAodmVyc2lvbiA+PSA1KSB3cml0ZVVuaWNvZGVTdHJpbmdXaXRoUGFkZGluZyh3cml0ZXIsIGZpbGUuY2hpbGREb2N1bWVudElEIHx8ICcnKTtcclxuXHRcdFx0aWYgKHZlcnNpb24gPj0gNikgd3JpdGVGbG9hdDY0KHdyaXRlciwgZmlsZS5hc3NldE1vZFRpbWUgfHwgMCk7XHJcblx0XHRcdGlmICh2ZXJzaW9uID49IDcpIHdyaXRlVWludDgod3JpdGVyLCBmaWxlLmFzc2V0TG9ja2VkU3RhdGUgfHwgMCk7XHJcblxyXG5cdFx0XHRsZXQgc2l6ZSA9IHdyaXRlci5vZmZzZXQgLSBzaXplT2Zmc2V0O1xyXG5cdFx0XHR3cml0ZXIudmlldy5zZXRVaW50MzIoc2l6ZU9mZnNldCAtIDQsIHNpemUsIGZhbHNlKTsgLy8gd3JpdGUgc2l6ZVxyXG5cclxuXHRcdFx0d2hpbGUgKHNpemUgJSA0KSB7XHJcblx0XHRcdFx0c2l6ZSsrO1xyXG5cdFx0XHRcdHdyaXRlVWludDgod3JpdGVyLCAwKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0sXHJcbik7XHJcbmFkZEhhbmRsZXJBbGlhcygnbG5rRCcsICdsbmsyJyk7XHJcbmFkZEhhbmRsZXJBbGlhcygnbG5rMycsICdsbmsyJyk7XHJcblxyXG4vLyB0aGlzIHNlZW1zIHRvIGp1c3QgYmUgemVybyBzaXplIGJsb2NrLCBpZ25vcmUgaXRcclxuYWRkSGFuZGxlcihcclxuXHQnbG5rRScsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5fbG5rRSAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgX3BzZHMsIG9wdGlvbnMpID0+IHtcclxuXHRcdGlmIChvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcyAmJiBsZWZ0KCkpIHtcclxuXHRcdFx0Y29uc29sZS5sb2coYE5vbi1lbXB0eSBsbmtFIGxheWVyIGluZm8gKCR7bGVmdCgpfSBieXRlcylgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoTU9DS19IQU5ETEVSUykge1xyXG5cdFx0XHQodGFyZ2V0IGFzIGFueSkuX2xua0UgPSByZWFkQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdFx0fVxyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiBNT0NLX0hBTkRMRVJTICYmIHdyaXRlQnl0ZXMod3JpdGVyLCAodGFyZ2V0IGFzIGFueSkuX2xua0UpLFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIEV4dGVuc2lvbkRlc2Mge1xyXG5cdGdlbmVyYXRvclNldHRpbmdzOiB7XHJcblx0XHRnZW5lcmF0b3JfNDVfYXNzZXRzOiB7IGpzb246IHN0cmluZzsgfTtcclxuXHRcdGxheWVyVGltZTogbnVtYmVyO1xyXG5cdH07XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3B0aHMnLFxyXG5cdGhhc0tleSgncGF0aExpc3QnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHJcblx0XHR0YXJnZXQucGF0aExpc3QgPSBbXTsgLy8gVE9ETzogcmVhZCBwYXRocyAoZmluZCBleGFtcGxlIHdpdGggbm9uLWVtcHR5IGxpc3QpXHJcblxyXG5cdFx0ZGVzY3JpcHRvcjtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCdwdGhzJywgZGVzY3JpcHRvcik7IC8vIFRPRE86IHJlbW92ZSB0aGlzXHJcblx0fSxcclxuXHQod3JpdGVyLCBfdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRwYXRoTGlzdDogW10sIC8vIFRPRE86IHdyaXRlIHBhdGhzXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3BhdGhzRGF0YUNsYXNzJywgZGVzY3JpcHRvcik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2x5dnInLFxyXG5cdGhhc0tleSgndmVyc2lvbicpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LnZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlciksXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC52ZXJzaW9uISksXHJcbik7XHJcblxyXG5mdW5jdGlvbiBhZGp1c3RtZW50VHlwZSh0eXBlOiBzdHJpbmcpIHtcclxuXHRyZXR1cm4gKHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbykgPT4gISF0YXJnZXQuYWRqdXN0bWVudCAmJiB0YXJnZXQuYWRqdXN0bWVudC50eXBlID09PSB0eXBlO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdicml0JyxcclxuXHRhZGp1c3RtZW50VHlwZSgnYnJpZ2h0bmVzcy9jb250cmFzdCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKCF0YXJnZXQuYWRqdXN0bWVudCkgeyAvLyBpZ25vcmUgaWYgZ290IG9uZSBmcm9tIENnRWQgYmxvY2tcclxuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdFx0dHlwZTogJ2JyaWdodG5lc3MvY29udHJhc3QnLFxyXG5cdFx0XHRcdGJyaWdodG5lc3M6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0XHRcdGNvbnRyYXN0OiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdFx0XHRtZWFuVmFsdWU6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0XHRcdGxhYkNvbG9yT25seTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdFx0XHR1c2VMZWdhY3k6IHRydWUsXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIEJyaWdodG5lc3NBZGp1c3RtZW50O1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIGluZm8uYnJpZ2h0bmVzcyB8fCAwKTtcclxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBpbmZvLmNvbnRyYXN0IHx8IDApO1xyXG5cdFx0d3JpdGVJbnQxNih3cml0ZXIsIGluZm8ubWVhblZhbHVlID8/IDEyNyk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5mby5sYWJDb2xvck9ubHkgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMSk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRMZXZlbHNDaGFubmVsKHJlYWRlcjogUHNkUmVhZGVyKTogTGV2ZWxzQWRqdXN0bWVudENoYW5uZWwge1xyXG5cdGNvbnN0IHNoYWRvd0lucHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgaGlnaGxpZ2h0SW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBzaGFkb3dPdXRwdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBoaWdobGlnaHRPdXRwdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBtaWR0b25lSW5wdXQgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDtcclxuXHRyZXR1cm4geyBzaGFkb3dJbnB1dCwgaGlnaGxpZ2h0SW5wdXQsIHNoYWRvd091dHB1dCwgaGlnaGxpZ2h0T3V0cHV0LCBtaWR0b25lSW5wdXQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlcjogUHNkV3JpdGVyLCBjaGFubmVsOiBMZXZlbHNBZGp1c3RtZW50Q2hhbm5lbCkge1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjaGFubmVsLnNoYWRvd0lucHV0KTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgY2hhbm5lbC5oaWdobGlnaHRJbnB1dCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGNoYW5uZWwuc2hhZG93T3V0cHV0KTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgY2hhbm5lbC5oaWdobGlnaHRPdXRwdXQpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNoYW5uZWwubWlkdG9uZUlucHV0ICogMTAwKSk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2xldmwnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdsZXZlbHMnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsZXZsIHZlcnNpb24nKTtcclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgUHJlc2V0SW5mbyxcclxuXHRcdFx0dHlwZTogJ2xldmVscycsXHJcblx0XHRcdHJnYjogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0cmVkOiByZWFkTGV2ZWxzQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHRncmVlbjogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0Ymx1ZTogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIExldmVsc0FkanVzdG1lbnQ7XHJcblx0XHRjb25zdCBkZWZhdWx0Q2hhbm5lbCA9IHtcclxuXHRcdFx0c2hhZG93SW5wdXQ6IDAsXHJcblx0XHRcdGhpZ2hsaWdodElucHV0OiAyNTUsXHJcblx0XHRcdHNoYWRvd091dHB1dDogMCxcclxuXHRcdFx0aGlnaGxpZ2h0T3V0cHV0OiAyNTUsXHJcblx0XHRcdG1pZHRvbmVJbnB1dDogMSxcclxuXHRcdH07XHJcblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlciwgaW5mby5yZ2IgfHwgZGVmYXVsdENoYW5uZWwpO1xyXG5cdFx0d3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlciwgaW5mby5yZWQgfHwgZGVmYXVsdENoYW5uZWwpO1xyXG5cdFx0d3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlciwgaW5mby5ibHVlIHx8IGRlZmF1bHRDaGFubmVsKTtcclxuXHRcdHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JlZW4gfHwgZGVmYXVsdENoYW5uZWwpO1xyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA1OTsgaSsrKSB3cml0ZUxldmVsc0NoYW5uZWwod3JpdGVyLCBkZWZhdWx0Q2hhbm5lbCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyOiBQc2RSZWFkZXIpIHtcclxuXHRjb25zdCBub2RlcyA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBjaGFubmVsOiBDdXJ2ZXNBZGp1c3RtZW50Q2hhbm5lbCA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBqID0gMDsgaiA8IG5vZGVzOyBqKyspIHtcclxuXHRcdGNvbnN0IG91dHB1dCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdGNoYW5uZWwucHVzaCh7IGlucHV0LCBvdXRwdXQgfSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gY2hhbm5lbDtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyOiBQc2RXcml0ZXIsIGNoYW5uZWw6IEN1cnZlc0FkanVzdG1lbnRDaGFubmVsKSB7XHJcblx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsLmxlbmd0aCk7XHJcblxyXG5cdGZvciAoY29uc3QgbiBvZiBjaGFubmVsKSB7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIG4ub3V0cHV0KTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgbi5pbnB1dCk7XHJcblx0fVxyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdjdXJ2JyxcclxuXHRhZGp1c3RtZW50VHlwZSgnY3VydmVzJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjdXJ2IHZlcnNpb24nKTtcclxuXHRcdHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHRcdGNvbnN0IGNoYW5uZWxzID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Y29uc3QgaW5mbzogQ3VydmVzQWRqdXN0bWVudCA9IHsgdHlwZTogJ2N1cnZlcycgfTtcclxuXHJcblx0XHRpZiAoY2hhbm5lbHMgJiAxKSBpbmZvLnJnYiA9IHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyKTtcclxuXHRcdGlmIChjaGFubmVscyAmIDIpIGluZm8ucmVkID0gcmVhZEN1cnZlQ2hhbm5lbChyZWFkZXIpO1xyXG5cdFx0aWYgKGNoYW5uZWxzICYgNCkgaW5mby5ncmVlbiA9IHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyKTtcclxuXHRcdGlmIChjaGFubmVscyAmIDgpIGluZm8uYmx1ZSA9IHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyKTtcclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgUHJlc2V0SW5mbyxcclxuXHRcdFx0Li4uaW5mbyxcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gaWdub3JpbmcsIGR1cGxpY2F0ZSBpbmZvcm1hdGlvblxyXG5cdFx0Ly8gY2hlY2tTaWduYXR1cmUocmVhZGVyLCAnQ3J2ICcpO1xyXG5cclxuXHRcdC8vIGNvbnN0IGNWZXJzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Ly8gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cdFx0Ly8gY29uc3QgY2hhbm5lbENvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdC8vIGZvciAobGV0IGkgPSAwOyBpIDwgY2hhbm5lbENvdW50OyBpKyspIHtcclxuXHRcdC8vIFx0Y29uc3QgaW5kZXggPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHQvLyBcdGNvbnN0IG5vZGVzID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdC8vIFx0Zm9yIChsZXQgaiA9IDA7IGogPCBub2RlczsgaisrKSB7XHJcblx0XHQvLyBcdFx0Y29uc3Qgb3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHQvLyBcdFx0Y29uc3QgaW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdC8vIFx0fVxyXG5cdFx0Ly8gfVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDdXJ2ZXNBZGp1c3RtZW50O1xyXG5cdFx0Y29uc3QgeyByZ2IsIHJlZCwgZ3JlZW4sIGJsdWUgfSA9IGluZm87XHJcblx0XHRsZXQgY2hhbm5lbHMgPSAwO1xyXG5cdFx0bGV0IGNoYW5uZWxDb3VudCA9IDA7XHJcblxyXG5cdFx0aWYgKHJnYiAmJiByZ2IubGVuZ3RoKSB7IGNoYW5uZWxzIHw9IDE7IGNoYW5uZWxDb3VudCsrOyB9XHJcblx0XHRpZiAocmVkICYmIHJlZC5sZW5ndGgpIHsgY2hhbm5lbHMgfD0gMjsgY2hhbm5lbENvdW50Kys7IH1cclxuXHRcdGlmIChncmVlbiAmJiBncmVlbi5sZW5ndGgpIHsgY2hhbm5lbHMgfD0gNDsgY2hhbm5lbENvdW50Kys7IH1cclxuXHRcdGlmIChibHVlICYmIGJsdWUubGVuZ3RoKSB7IGNoYW5uZWxzIHw9IDg7IGNoYW5uZWxDb3VudCsrOyB9XHJcblxyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAwKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbHMpO1xyXG5cclxuXHRcdGlmIChyZ2IgJiYgcmdiLmxlbmd0aCkgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCByZ2IpO1xyXG5cdFx0aWYgKHJlZCAmJiByZWQubGVuZ3RoKSB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJlZCk7XHJcblx0XHRpZiAoZ3JlZW4gJiYgZ3JlZW4ubGVuZ3RoKSB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIGdyZWVuKTtcclxuXHRcdGlmIChibHVlICYmIGJsdWUubGVuZ3RoKSB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIGJsdWUpO1xyXG5cclxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJ0NydiAnKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgNCk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWxDb3VudCk7XHJcblxyXG5cdFx0aWYgKHJnYiAmJiByZ2IubGVuZ3RoKSB7IHdyaXRlVWludDE2KHdyaXRlciwgMCk7IHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgcmdiKTsgfVxyXG5cdFx0aWYgKHJlZCAmJiByZWQubGVuZ3RoKSB7IHdyaXRlVWludDE2KHdyaXRlciwgMSk7IHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgcmVkKTsgfVxyXG5cdFx0aWYgKGdyZWVuICYmIGdyZWVuLmxlbmd0aCkgeyB3cml0ZVVpbnQxNih3cml0ZXIsIDIpOyB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIGdyZWVuKTsgfVxyXG5cdFx0aWYgKGJsdWUgJiYgYmx1ZS5sZW5ndGgpIHsgd3JpdGVVaW50MTYod3JpdGVyLCAzKTsgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBibHVlKTsgfVxyXG5cclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnZXhwQScsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2V4cG9zdXJlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZXhwQSB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXHJcblx0XHRcdHR5cGU6ICdleHBvc3VyZScsXHJcblx0XHRcdGV4cG9zdXJlOiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0XHRvZmZzZXQ6IHJlYWRGbG9hdDMyKHJlYWRlciksXHJcblx0XHRcdGdhbW1hOiByZWFkRmxvYXQzMihyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgRXhwb3N1cmVBZGp1c3RtZW50O1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgaW5mby5leHBvc3VyZSEpO1xyXG5cdFx0d3JpdGVGbG9hdDMyKHdyaXRlciwgaW5mby5vZmZzZXQhKTtcclxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIGluZm8uZ2FtbWEhKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIFZpYnJhbmNlRGVzY3JpcHRvciB7XHJcblx0dmlicmFuY2U/OiBudW1iZXI7XHJcblx0U3RydD86IG51bWJlcjtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQndmliQScsXHJcblx0YWRqdXN0bWVudFR5cGUoJ3ZpYnJhbmNlJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjOiBWaWJyYW5jZURlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0geyB0eXBlOiAndmlicmFuY2UnIH07XHJcblx0XHRpZiAoZGVzYy52aWJyYW5jZSAhPT0gdW5kZWZpbmVkKSB0YXJnZXQuYWRqdXN0bWVudC52aWJyYW5jZSA9IGRlc2MudmlicmFuY2U7XHJcblx0XHRpZiAoZGVzYy5TdHJ0ICE9PSB1bmRlZmluZWQpIHRhcmdldC5hZGp1c3RtZW50LnNhdHVyYXRpb24gPSBkZXNjLlN0cnQ7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFZpYnJhbmNlQWRqdXN0bWVudDtcclxuXHRcdGNvbnN0IGRlc2M6IFZpYnJhbmNlRGVzY3JpcHRvciA9IHt9O1xyXG5cdFx0aWYgKGluZm8udmlicmFuY2UgIT09IHVuZGVmaW5lZCkgZGVzYy52aWJyYW5jZSA9IGluZm8udmlicmFuY2U7XHJcblx0XHRpZiAoaW5mby5zYXR1cmF0aW9uICE9PSB1bmRlZmluZWQpIGRlc2MuU3RydCA9IGluZm8uc2F0dXJhdGlvbjtcclxuXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRIdWVDaGFubmVsKHJlYWRlcjogUHNkUmVhZGVyKTogSHVlU2F0dXJhdGlvbkFkanVzdG1lbnRDaGFubmVsIHtcclxuXHRyZXR1cm4ge1xyXG5cdFx0YTogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRiOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdGM6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0ZDogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRodWU6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0c2F0dXJhdGlvbjogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRsaWdodG5lc3M6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXI6IFBzZFdyaXRlciwgY2hhbm5lbDogSHVlU2F0dXJhdGlvbkFkanVzdG1lbnRDaGFubmVsIHwgdW5kZWZpbmVkKSB7XHJcblx0Y29uc3QgYyA9IGNoYW5uZWwgfHwge30gYXMgUGFydGlhbDxIdWVTYXR1cmF0aW9uQWRqdXN0bWVudENoYW5uZWw+O1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmEgfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuYiB8fCAwKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5jIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmQgfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuaHVlIHx8IDApO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLnNhdHVyYXRpb24gfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMubGlnaHRuZXNzIHx8IDApO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdodWUyJyxcclxuXHRhZGp1c3RtZW50VHlwZSgnaHVlL3NhdHVyYXRpb24nKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBodWUyIHZlcnNpb24nKTtcclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgUHJlc2V0SW5mbyxcclxuXHRcdFx0dHlwZTogJ2h1ZS9zYXR1cmF0aW9uJyxcclxuXHRcdFx0bWFzdGVyOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHRyZWRzOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHR5ZWxsb3dzOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHRncmVlbnM6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXHJcblx0XHRcdGN5YW5zOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxyXG5cdFx0XHRibHVlczogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcclxuXHRcdFx0bWFnZW50YXM6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudDtcclxuXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDIpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLm1hc3Rlcik7XHJcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLnJlZHMpO1xyXG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby55ZWxsb3dzKTtcclxuXHRcdHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JlZW5zKTtcclxuXHRcdHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXIsIGluZm8uY3lhbnMpO1xyXG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby5ibHVlcyk7XHJcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLm1hZ2VudGFzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuZnVuY3Rpb24gcmVhZENvbG9yQmFsYW5jZShyZWFkZXI6IFBzZFJlYWRlcik6IENvbG9yQmFsYW5jZVZhbHVlcyB7XHJcblx0cmV0dXJuIHtcclxuXHRcdGN5YW5SZWQ6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0bWFnZW50YUdyZWVuOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdHllbGxvd0JsdWU6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogUGFydGlhbDxDb2xvckJhbGFuY2VWYWx1ZXM+KSB7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIHZhbHVlLmN5YW5SZWQgfHwgMCk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIHZhbHVlLm1hZ2VudGFHcmVlbiB8fCAwKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgdmFsdWUueWVsbG93Qmx1ZSB8fCAwKTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnYmxuYycsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2NvbG9yIGJhbGFuY2UnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHR0eXBlOiAnY29sb3IgYmFsYW5jZScsXHJcblx0XHRcdHNoYWRvd3M6IHJlYWRDb2xvckJhbGFuY2UocmVhZGVyKSxcclxuXHRcdFx0bWlkdG9uZXM6IHJlYWRDb2xvckJhbGFuY2UocmVhZGVyKSxcclxuXHRcdFx0aGlnaGxpZ2h0czogcmVhZENvbG9yQmFsYW5jZShyZWFkZXIpLFxyXG5cdFx0XHRwcmVzZXJ2ZUx1bWlub3NpdHk6ICEhcmVhZFVpbnQ4KHJlYWRlciksXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDb2xvckJhbGFuY2VBZGp1c3RtZW50O1xyXG5cdFx0d3JpdGVDb2xvckJhbGFuY2Uod3JpdGVyLCBpbmZvLnNoYWRvd3MgfHwge30pO1xyXG5cdFx0d3JpdGVDb2xvckJhbGFuY2Uod3JpdGVyLCBpbmZvLm1pZHRvbmVzIHx8IHt9KTtcclxuXHRcdHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlciwgaW5mby5oaWdobGlnaHRzIHx8IHt9KTtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLnByZXNlcnZlTHVtaW5vc2l0eSA/IDEgOiAwKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAxKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIEJsYWNrQW5kV2hpdGVEZXNjcmlwdG9yIHtcclxuXHQnUmQgICc6IG51bWJlcjtcclxuXHRZbGx3OiBudW1iZXI7XHJcblx0J0dybiAnOiBudW1iZXI7XHJcblx0J0N5biAnOiBudW1iZXI7XHJcblx0J0JsICAnOiBudW1iZXI7XHJcblx0TWdudDogbnVtYmVyO1xyXG5cdHVzZVRpbnQ6IGJvb2xlYW47XHJcblx0dGludENvbG9yPzogRGVzY3JpcHRvckNvbG9yO1xyXG5cdGJ3UHJlc2V0S2luZDogbnVtYmVyO1xyXG5cdGJsYWNrQW5kV2hpdGVQcmVzZXRGaWxlTmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdibHdoJyxcclxuXHRhZGp1c3RtZW50VHlwZSgnYmxhY2sgJiB3aGl0ZScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYzogQmxhY2tBbmRXaGl0ZURlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHR0eXBlOiAnYmxhY2sgJiB3aGl0ZScsXHJcblx0XHRcdHJlZHM6IGRlc2NbJ1JkICAnXSxcclxuXHRcdFx0eWVsbG93czogZGVzYy5ZbGx3LFxyXG5cdFx0XHRncmVlbnM6IGRlc2NbJ0dybiAnXSxcclxuXHRcdFx0Y3lhbnM6IGRlc2NbJ0N5biAnXSxcclxuXHRcdFx0Ymx1ZXM6IGRlc2NbJ0JsICAnXSxcclxuXHRcdFx0bWFnZW50YXM6IGRlc2MuTWdudCxcclxuXHRcdFx0dXNlVGludDogISFkZXNjLnVzZVRpbnQsXHJcblx0XHRcdHByZXNldEtpbmQ6IGRlc2MuYndQcmVzZXRLaW5kLFxyXG5cdFx0XHRwcmVzZXRGaWxlTmFtZTogZGVzYy5ibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWUsXHJcblx0XHR9O1xyXG5cclxuXHRcdGlmIChkZXNjLnRpbnRDb2xvciAhPT0gdW5kZWZpbmVkKSB0YXJnZXQuYWRqdXN0bWVudC50aW50Q29sb3IgPSBwYXJzZUNvbG9yKGRlc2MudGludENvbG9yKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgQmxhY2tBbmRXaGl0ZUFkanVzdG1lbnQ7XHJcblx0XHRjb25zdCBkZXNjOiBCbGFja0FuZFdoaXRlRGVzY3JpcHRvciA9IHtcclxuXHRcdFx0J1JkICAnOiBpbmZvLnJlZHMgfHwgMCxcclxuXHRcdFx0WWxsdzogaW5mby55ZWxsb3dzIHx8IDAsXHJcblx0XHRcdCdHcm4gJzogaW5mby5ncmVlbnMgfHwgMCxcclxuXHRcdFx0J0N5biAnOiBpbmZvLmN5YW5zIHx8IDAsXHJcblx0XHRcdCdCbCAgJzogaW5mby5ibHVlcyB8fCAwLFxyXG5cdFx0XHRNZ250OiBpbmZvLm1hZ2VudGFzIHx8IDAsXHJcblx0XHRcdHVzZVRpbnQ6ICEhaW5mby51c2VUaW50LFxyXG5cdFx0XHR0aW50Q29sb3I6IHNlcmlhbGl6ZUNvbG9yKGluZm8udGludENvbG9yKSxcclxuXHRcdFx0YndQcmVzZXRLaW5kOiBpbmZvLnByZXNldEtpbmQgfHwgMCxcclxuXHRcdFx0YmxhY2tBbmRXaGl0ZVByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxyXG5cdFx0fTtcclxuXHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3BoZmwnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdwaG90byBmaWx0ZXInKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpZiAodmVyc2lvbiAhPT0gMiAmJiB2ZXJzaW9uICE9PSAzKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGhmbCB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0bGV0IGNvbG9yOiBDb2xvcjtcclxuXHJcblx0XHRpZiAodmVyc2lvbiA9PT0gMikge1xyXG5cdFx0XHRjb2xvciA9IHJlYWRDb2xvcihyZWFkZXIpO1xyXG5cdFx0fSBlbHNlIHsgLy8gdmVyc2lvbiAzXHJcblx0XHRcdC8vIFRPRE86IHRlc3QgdGhpcywgdGhpcyBpcyBwcm9iYWJseSB3cm9uZ1xyXG5cdFx0XHRjb2xvciA9IHtcclxuXHRcdFx0XHRsOiByZWFkSW50MzIocmVhZGVyKSAvIDEwMCxcclxuXHRcdFx0XHRhOiByZWFkSW50MzIocmVhZGVyKSAvIDEwMCxcclxuXHRcdFx0XHRiOiByZWFkSW50MzIocmVhZGVyKSAvIDEwMCxcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ3Bob3RvIGZpbHRlcicsXHJcblx0XHRcdGNvbG9yLFxyXG5cdFx0XHRkZW5zaXR5OiByZWFkVWludDMyKHJlYWRlcikgLyAxMDAsXHJcblx0XHRcdHByZXNlcnZlTHVtaW5vc2l0eTogISFyZWFkVWludDgocmVhZGVyKSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFBob3RvRmlsdGVyQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCBpbmZvLmNvbG9yIHx8IHsgbDogMCwgYTogMCwgYjogMCB9KTtcclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgKGluZm8uZGVuc2l0eSB8fCAwKSAqIDEwMCk7XHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5mby5wcmVzZXJ2ZUx1bWlub3NpdHkgPyAxIDogMCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRNaXhyQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IENoYW5uZWxNaXhlckNoYW5uZWwge1xyXG5cdGNvbnN0IHJlZCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IGdyZWVuID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3QgYmx1ZSA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdGNvbnN0IGNvbnN0YW50ID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0cmV0dXJuIHsgcmVkLCBncmVlbiwgYmx1ZSwgY29uc3RhbnQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXI6IFBzZFdyaXRlciwgY2hhbm5lbDogQ2hhbm5lbE1peGVyQ2hhbm5lbCB8IHVuZGVmaW5lZCkge1xyXG5cdGNvbnN0IGMgPSBjaGFubmVsIHx8IHt9IGFzIFBhcnRpYWw8Q2hhbm5lbE1peGVyQ2hhbm5lbD47XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMucmVkISk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuZ3JlZW4hKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5ibHVlISk7XHJcblx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmNvbnN0YW50ISk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J21peHInLFxyXG5cdGFkanVzdG1lbnRUeXBlKCdjaGFubmVsIG1peGVyJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbWl4ciB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0Y29uc3QgYWRqdXN0bWVudDogQ2hhbm5lbE1peGVyQWRqdXN0bWVudCA9IHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBQcmVzZXRJbmZvLFxyXG5cdFx0XHR0eXBlOiAnY2hhbm5lbCBtaXhlcicsXHJcblx0XHRcdG1vbm9jaHJvbWU6ICEhcmVhZFVpbnQxNihyZWFkZXIpLFxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoIWFkanVzdG1lbnQubW9ub2Nocm9tZSkge1xyXG5cdFx0XHRhZGp1c3RtZW50LnJlZCA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xyXG5cdFx0XHRhZGp1c3RtZW50LmdyZWVuID0gcmVhZE1peHJDaGFubmVsKHJlYWRlcik7XHJcblx0XHRcdGFkanVzdG1lbnQuYmx1ZSA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGFkanVzdG1lbnQuZ3JheSA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDaGFubmVsTWl4ZXJBZGp1c3RtZW50O1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm1vbm9jaHJvbWUgPyAxIDogMCk7XHJcblxyXG5cdFx0aWYgKGluZm8ubW9ub2Nocm9tZSkge1xyXG5cdFx0XHR3cml0ZU1peHJDaGFubmVsKHdyaXRlciwgaW5mby5ncmF5KTtcclxuXHRcdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMgKiA1ICogMik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3cml0ZU1peHJDaGFubmVsKHdyaXRlciwgaW5mby5yZWQpO1xyXG5cdFx0XHR3cml0ZU1peHJDaGFubmVsKHdyaXRlciwgaW5mby5ncmVlbik7XHJcblx0XHRcdHdyaXRlTWl4ckNoYW5uZWwod3JpdGVyLCBpbmZvLmJsdWUpO1xyXG5cdFx0XHR3cml0ZU1peHJDaGFubmVsKHdyaXRlciwgaW5mby5ncmF5KTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuY29uc3QgY29sb3JMb29rdXBUeXBlID0gY3JlYXRlRW51bTwnM2RsdXQnIHwgJ2Fic3RyYWN0UHJvZmlsZScgfCAnZGV2aWNlTGlua1Byb2ZpbGUnPignY29sb3JMb29rdXBUeXBlJywgJzNETFVUJywge1xyXG5cdCczZGx1dCc6ICczRExVVCcsXHJcblx0YWJzdHJhY3RQcm9maWxlOiAnYWJzdHJhY3RQcm9maWxlJyxcclxuXHRkZXZpY2VMaW5rUHJvZmlsZTogJ2RldmljZUxpbmtQcm9maWxlJyxcclxufSk7XHJcblxyXG5jb25zdCBMVVRGb3JtYXRUeXBlID0gY3JlYXRlRW51bTwnbG9vaycgfCAnY3ViZScgfCAnM2RsJz4oJ0xVVEZvcm1hdFR5cGUnLCAnbG9vaycsIHtcclxuXHRsb29rOiAnTFVURm9ybWF0TE9PSycsXHJcblx0Y3ViZTogJ0xVVEZvcm1hdENVQkUnLFxyXG5cdCczZGwnOiAnTFVURm9ybWF0M0RMJyxcclxufSk7XHJcblxyXG5jb25zdCBjb2xvckxvb2t1cE9yZGVyID0gY3JlYXRlRW51bTwncmdiJyB8ICdiZ3InPignY29sb3JMb29rdXBPcmRlcicsICdyZ2InLCB7XHJcblx0cmdiOiAncmdiT3JkZXInLFxyXG5cdGJncjogJ2Jnck9yZGVyJyxcclxufSk7XHJcblxyXG5pbnRlcmZhY2UgQ29sb3JMb29rdXBEZXNjcmlwdG9yIHtcclxuXHRsb29rdXBUeXBlPzogc3RyaW5nO1xyXG5cdCdObSAgJz86IHN0cmluZztcclxuXHREdGhyPzogYm9vbGVhbjtcclxuXHRwcm9maWxlPzogVWludDhBcnJheTtcclxuXHRMVVRGb3JtYXQ/OiBzdHJpbmc7XHJcblx0ZGF0YU9yZGVyPzogc3RyaW5nO1xyXG5cdHRhYmxlT3JkZXI/OiBzdHJpbmc7XHJcblx0TFVUM0RGaWxlRGF0YT86IFVpbnQ4QXJyYXk7XHJcblx0TFVUM0RGaWxlTmFtZT86IHN0cmluZztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnY2xyTCcsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2NvbG9yIGxvb2t1cCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNsckwgdmVyc2lvbicpO1xyXG5cclxuXHRcdGNvbnN0IGRlc2M6IENvbG9yTG9va3VwRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7IHR5cGU6ICdjb2xvciBsb29rdXAnIH07XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQ7XHJcblxyXG5cdFx0aWYgKGRlc2MubG9va3VwVHlwZSAhPT0gdW5kZWZpbmVkKSBpbmZvLmxvb2t1cFR5cGUgPSBjb2xvckxvb2t1cFR5cGUuZGVjb2RlKGRlc2MubG9va3VwVHlwZSk7XHJcblx0XHRpZiAoZGVzY1snTm0gICddICE9PSB1bmRlZmluZWQpIGluZm8ubmFtZSA9IGRlc2NbJ05tICAnXTtcclxuXHRcdGlmIChkZXNjLkR0aHIgIT09IHVuZGVmaW5lZCkgaW5mby5kaXRoZXIgPSBkZXNjLkR0aHI7XHJcblx0XHRpZiAoZGVzYy5wcm9maWxlICE9PSB1bmRlZmluZWQpIGluZm8ucHJvZmlsZSA9IGRlc2MucHJvZmlsZTtcclxuXHRcdGlmIChkZXNjLkxVVEZvcm1hdCAhPT0gdW5kZWZpbmVkKSBpbmZvLmx1dEZvcm1hdCA9IExVVEZvcm1hdFR5cGUuZGVjb2RlKGRlc2MuTFVURm9ybWF0KTtcclxuXHRcdGlmIChkZXNjLmRhdGFPcmRlciAhPT0gdW5kZWZpbmVkKSBpbmZvLmRhdGFPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZGVjb2RlKGRlc2MuZGF0YU9yZGVyKTtcclxuXHRcdGlmIChkZXNjLnRhYmxlT3JkZXIgIT09IHVuZGVmaW5lZCkgaW5mby50YWJsZU9yZGVyID0gY29sb3JMb29rdXBPcmRlci5kZWNvZGUoZGVzYy50YWJsZU9yZGVyKTtcclxuXHRcdGlmIChkZXNjLkxVVDNERmlsZURhdGEgIT09IHVuZGVmaW5lZCkgaW5mby5sdXQzREZpbGVEYXRhID0gZGVzYy5MVVQzREZpbGVEYXRhO1xyXG5cdFx0aWYgKGRlc2MuTFVUM0RGaWxlTmFtZSAhPT0gdW5kZWZpbmVkKSBpbmZvLmx1dDNERmlsZU5hbWUgPSBkZXNjLkxVVDNERmlsZU5hbWU7XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIENvbG9yTG9va3VwQWRqdXN0bWVudDtcclxuXHRcdGNvbnN0IGRlc2M6IENvbG9yTG9va3VwRGVzY3JpcHRvciA9IHt9O1xyXG5cclxuXHRcdGlmIChpbmZvLmxvb2t1cFR5cGUgIT09IHVuZGVmaW5lZCkgZGVzYy5sb29rdXBUeXBlID0gY29sb3JMb29rdXBUeXBlLmVuY29kZShpbmZvLmxvb2t1cFR5cGUpO1xyXG5cdFx0aWYgKGluZm8ubmFtZSAhPT0gdW5kZWZpbmVkKSBkZXNjWydObSAgJ10gPSBpbmZvLm5hbWU7XHJcblx0XHRpZiAoaW5mby5kaXRoZXIgIT09IHVuZGVmaW5lZCkgZGVzYy5EdGhyID0gaW5mby5kaXRoZXI7XHJcblx0XHRpZiAoaW5mby5wcm9maWxlICE9PSB1bmRlZmluZWQpIGRlc2MucHJvZmlsZSA9IGluZm8ucHJvZmlsZTtcclxuXHRcdGlmIChpbmZvLmx1dEZvcm1hdCAhPT0gdW5kZWZpbmVkKSBkZXNjLkxVVEZvcm1hdCA9IExVVEZvcm1hdFR5cGUuZW5jb2RlKGluZm8ubHV0Rm9ybWF0KTtcclxuXHRcdGlmIChpbmZvLmRhdGFPcmRlciAhPT0gdW5kZWZpbmVkKSBkZXNjLmRhdGFPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZW5jb2RlKGluZm8uZGF0YU9yZGVyKTtcclxuXHRcdGlmIChpbmZvLnRhYmxlT3JkZXIgIT09IHVuZGVmaW5lZCkgZGVzYy50YWJsZU9yZGVyID0gY29sb3JMb29rdXBPcmRlci5lbmNvZGUoaW5mby50YWJsZU9yZGVyKTtcclxuXHRcdGlmIChpbmZvLmx1dDNERmlsZURhdGEgIT09IHVuZGVmaW5lZCkgZGVzYy5MVVQzREZpbGVEYXRhID0gaW5mby5sdXQzREZpbGVEYXRhO1xyXG5cdFx0aWYgKGluZm8ubHV0M0RGaWxlTmFtZSAhPT0gdW5kZWZpbmVkKSBkZXNjLkxVVDNERmlsZU5hbWUgPSBpbmZvLmx1dDNERmlsZU5hbWU7XHJcblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxyXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdudnJ0JyxcclxuXHRhZGp1c3RtZW50VHlwZSgnaW52ZXJ0JyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHsgdHlwZTogJ2ludmVydCcgfTtcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQoKSA9PiB7XHJcblx0XHQvLyBub3RoaW5nIHRvIHdyaXRlIGhlcmVcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQncG9zdCcsXHJcblx0YWRqdXN0bWVudFR5cGUoJ3Bvc3Rlcml6ZScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdHR5cGU6ICdwb3N0ZXJpemUnLFxyXG5cdFx0XHRsZXZlbHM6IHJlYWRVaW50MTYocmVhZGVyKSxcclxuXHRcdH07XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgUG9zdGVyaXplQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5sZXZlbHMgPz8gNCk7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3RocnMnLFxyXG5cdGFkanVzdG1lbnRUeXBlKCd0aHJlc2hvbGQnKSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHR0eXBlOiAndGhyZXNob2xkJyxcclxuXHRcdFx0bGV2ZWw6IHJlYWRVaW50MTYocmVhZGVyKSxcclxuXHRcdH07XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgVGhyZXNob2xkQWRqdXN0bWVudDtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5sZXZlbCA/PyAxMjgpO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5jb25zdCBncmRtQ29sb3JNb2RlbHMgPSBbJycsICcnLCAnJywgJ3JnYicsICdoc2InLCAnJywgJ2xhYiddO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnZ3JkbScsXHJcblx0YWRqdXN0bWVudFR5cGUoJ2dyYWRpZW50IG1hcCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGdyZG0gdmVyc2lvbicpO1xyXG5cclxuXHRcdGNvbnN0IGluZm86IEdyYWRpZW50TWFwQWRqdXN0bWVudCA9IHtcclxuXHRcdFx0dHlwZTogJ2dyYWRpZW50IG1hcCcsXHJcblx0XHRcdGdyYWRpZW50VHlwZTogJ3NvbGlkJyxcclxuXHRcdH07XHJcblxyXG5cdFx0aW5mby5yZXZlcnNlID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdGluZm8uZGl0aGVyID0gISFyZWFkVWludDgocmVhZGVyKTtcclxuXHRcdGluZm8ubmFtZSA9IHJlYWRVbmljb2RlU3RyaW5nKHJlYWRlcik7XHJcblx0XHRpbmZvLmNvbG9yU3RvcHMgPSBbXTtcclxuXHRcdGluZm8ub3BhY2l0eVN0b3BzID0gW107XHJcblxyXG5cdFx0Y29uc3Qgc3RvcHNDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcclxuXHJcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHN0b3BzQ291bnQ7IGkrKykge1xyXG5cdFx0XHRpbmZvLmNvbG9yU3RvcHMucHVzaCh7XHJcblx0XHRcdFx0bG9jYXRpb246IHJlYWRVaW50MzIocmVhZGVyKSxcclxuXHRcdFx0XHRtaWRwb2ludDogcmVhZFVpbnQzMihyZWFkZXIpIC8gMTAwLFxyXG5cdFx0XHRcdGNvbG9yOiByZWFkQ29sb3IocmVhZGVyKSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IG9wYWNpdHlTdG9wc0NvdW50ID0gcmVhZFVpbnQxNihyZWFkZXIpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgb3BhY2l0eVN0b3BzQ291bnQ7IGkrKykge1xyXG5cdFx0XHRpbmZvLm9wYWNpdHlTdG9wcy5wdXNoKHtcclxuXHRcdFx0XHRsb2NhdGlvbjogcmVhZFVpbnQzMihyZWFkZXIpLFxyXG5cdFx0XHRcdG1pZHBvaW50OiByZWFkVWludDMyKHJlYWRlcikgLyAxMDAsXHJcblx0XHRcdFx0b3BhY2l0eTogcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZixcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgZXhwYW5zaW9uQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpZiAoZXhwYW5zaW9uQ291bnQgIT09IDIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBncmRtIGV4cGFuc2lvbiBjb3VudCcpO1xyXG5cclxuXHRcdGNvbnN0IGludGVycG9sYXRpb24gPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpbmZvLnNtb290aG5lc3MgPSBpbnRlcnBvbGF0aW9uIC8gNDA5NjtcclxuXHJcblx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpZiAobGVuZ3RoICE9PSAzMikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGdyZG0gbGVuZ3RoJyk7XHJcblxyXG5cdFx0aW5mby5ncmFkaWVudFR5cGUgPSByZWFkVWludDE2KHJlYWRlcikgPyAnbm9pc2UnIDogJ3NvbGlkJztcclxuXHRcdGluZm8ucmFuZG9tU2VlZCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGluZm8uYWRkVHJhbnNwYXJlbmN5ID0gISFyZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpbmZvLnJlc3RyaWN0Q29sb3JzID0gISFyZWFkVWludDE2KHJlYWRlcik7XHJcblx0XHRpbmZvLnJvdWdobmVzcyA9IHJlYWRVaW50MzIocmVhZGVyKSAvIDQwOTY7XHJcblx0XHRpbmZvLmNvbG9yTW9kZWwgPSAoZ3JkbUNvbG9yTW9kZWxzW3JlYWRVaW50MTYocmVhZGVyKV0gfHwgJ3JnYicpIGFzICdyZ2InIHwgJ2hzYicgfCAnbGFiJztcclxuXHJcblx0XHRpbmZvLm1pbiA9IFtcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XTtcclxuXHJcblx0XHRpbmZvLm1heCA9IFtcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXHJcblx0XHRcdHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ODAwMCxcclxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxyXG5cdFx0XTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgcyBvZiBpbmZvLmNvbG9yU3RvcHMpIHMubG9jYXRpb24gLz0gaW50ZXJwb2xhdGlvbjtcclxuXHRcdGZvciAoY29uc3QgcyBvZiBpbmZvLm9wYWNpdHlTdG9wcykgcy5sb2NhdGlvbiAvPSBpbnRlcnBvbGF0aW9uO1xyXG5cclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0gaW5mbztcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIEdyYWRpZW50TWFwQWRqdXN0bWVudDtcclxuXHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXHJcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5mby5yZXZlcnNlID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8uZGl0aGVyID8gMSA6IDApO1xyXG5cdFx0d3JpdGVVbmljb2RlU3RyaW5nV2l0aFBhZGRpbmcod3JpdGVyLCBpbmZvLm5hbWUgfHwgJycpO1xyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmNvbG9yU3RvcHMgJiYgaW5mby5jb2xvclN0b3BzLmxlbmd0aCB8fCAwKTtcclxuXHJcblx0XHRjb25zdCBpbnRlcnBvbGF0aW9uID0gTWF0aC5yb3VuZCgoaW5mby5zbW9vdGhuZXNzID8/IDEpICogNDA5Nik7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBzIG9mIGluZm8uY29sb3JTdG9wcyB8fCBbXSkge1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQocy5sb2NhdGlvbiAqIGludGVycG9sYXRpb24pKTtcclxuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKHMubWlkcG9pbnQgKiAxMDApKTtcclxuXHRcdFx0d3JpdGVDb2xvcih3cml0ZXIsIHMuY29sb3IpO1xyXG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMik7XHJcblx0XHR9XHJcblxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm9wYWNpdHlTdG9wcyAmJiBpbmZvLm9wYWNpdHlTdG9wcy5sZW5ndGggfHwgMCk7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBzIG9mIGluZm8ub3BhY2l0eVN0b3BzIHx8IFtdKSB7XHJcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgTWF0aC5yb3VuZChzLmxvY2F0aW9uICogaW50ZXJwb2xhdGlvbikpO1xyXG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQocy5taWRwb2ludCAqIDEwMCkpO1xyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQocy5vcGFjaXR5ICogMHhmZikpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7IC8vIGV4cGFuc2lvbiBjb3VudFxyXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbnRlcnBvbGF0aW9uKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMzIpOyAvLyBsZW5ndGhcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5ncmFkaWVudFR5cGUgPT09ICdub2lzZScgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGluZm8ucmFuZG9tU2VlZCB8fCAwKTtcclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5hZGRUcmFuc3BhcmVuY3kgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ucmVzdHJpY3RDb2xvcnMgPyAxIDogMCk7XHJcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQoKGluZm8ucm91Z2huZXNzID8/IDEpICogNDA5NikpO1xyXG5cdFx0Y29uc3QgY29sb3JNb2RlbCA9IGdyZG1Db2xvck1vZGVscy5pbmRleE9mKGluZm8uY29sb3JNb2RlbCA/PyAncmdiJyk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNvbG9yTW9kZWwgPT09IC0xID8gMyA6IGNvbG9yTW9kZWwpO1xyXG5cclxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKVxyXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoKGluZm8ubWluICYmIGluZm8ubWluW2ldIHx8IDApICogMHg4MDAwKSk7XHJcblxyXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspXHJcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZCgoaW5mby5tYXggJiYgaW5mby5tYXhbaV0gfHwgMCkgKiAweDgwMDApKTtcclxuXHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgNCk7XHJcblx0fSxcclxuKTtcclxuXHJcbmZ1bmN0aW9uIHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyOiBQc2RSZWFkZXIpOiBDTVlLIHtcclxuXHRyZXR1cm4ge1xyXG5cdFx0YzogcmVhZEludDE2KHJlYWRlciksXHJcblx0XHRtOiByZWFkSW50MTYocmVhZGVyKSxcclxuXHRcdHk6IHJlYWRJbnQxNihyZWFkZXIpLFxyXG5cdFx0azogcmVhZEludDE2KHJlYWRlciksXHJcblx0fTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyOiBQc2RXcml0ZXIsIGNteWs6IENNWUsgfCB1bmRlZmluZWQpIHtcclxuXHRjb25zdCBjID0gY215ayB8fCB7fSBhcyBQYXJ0aWFsPENNWUs+O1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmMhKTtcclxuXHR3cml0ZUludDE2KHdyaXRlciwgYy5tISk7XHJcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMueSEpO1xyXG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmshKTtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnc2VsYycsXHJcblx0YWRqdXN0bWVudFR5cGUoJ3NlbGVjdGl2ZSBjb2xvcicpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHNlbGMgdmVyc2lvbicpO1xyXG5cclxuXHRcdGNvbnN0IG1vZGUgPSByZWFkVWludDE2KHJlYWRlcikgPyAnYWJzb2x1dGUnIDogJ3JlbGF0aXZlJztcclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDgpO1xyXG5cclxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHR0eXBlOiAnc2VsZWN0aXZlIGNvbG9yJyxcclxuXHRcdFx0bW9kZSxcclxuXHRcdFx0cmVkczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHR5ZWxsb3dzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXHJcblx0XHRcdGdyZWVuczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHRjeWFuczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHRibHVlczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHRtYWdlbnRhczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxyXG5cdFx0XHR3aGl0ZXM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0bmV1dHJhbHM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcclxuXHRcdFx0YmxhY2tzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXHJcblx0XHR9O1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XHJcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgU2VsZWN0aXZlQ29sb3JBZGp1c3RtZW50O1xyXG5cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5tb2RlID09PSAnYWJzb2x1dGUnID8gMSA6IDApO1xyXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDgpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLnJlZHMpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLnllbGxvd3MpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmdyZWVucyk7XHJcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8uY3lhbnMpO1xyXG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmJsdWVzKTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5tYWdlbnRhcyk7XHJcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8ud2hpdGVzKTtcclxuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5uZXV0cmFscyk7XHJcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8uYmxhY2tzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIEJyaWdodG5lc3NDb250cmFzdERlc2NyaXB0b3Ige1xyXG5cdFZyc246IG51bWJlcjtcclxuXHRCcmdoOiBudW1iZXI7XHJcblx0Q250cjogbnVtYmVyO1xyXG5cdG1lYW5zOiBudW1iZXI7XHJcblx0J0xhYiAnOiBib29sZWFuO1xyXG5cdHVzZUxlZ2FjeTogYm9vbGVhbjtcclxuXHRBdXRvOiBib29sZWFuO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUHJlc2V0RGVzY3JpcHRvciB7XHJcblx0VnJzbjogbnVtYmVyO1xyXG5cdHByZXNldEtpbmQ6IG51bWJlcjtcclxuXHRwcmVzZXRGaWxlTmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgQ3VydmVzUHJlc2V0RGVzY3JpcHRvciB7XHJcblx0VnJzbjogbnVtYmVyO1xyXG5cdGN1cnZlc1ByZXNldEtpbmQ6IG51bWJlcjtcclxuXHRjdXJ2ZXNQcmVzZXRGaWxlTmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgTWl4ZXJQcmVzZXREZXNjcmlwdG9yIHtcclxuXHRWcnNuOiBudW1iZXI7XHJcblx0bWl4ZXJQcmVzZXRLaW5kOiBudW1iZXI7XHJcblx0bWl4ZXJQcmVzZXRGaWxlTmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdDZ0VkJyxcclxuXHR0YXJnZXQgPT4ge1xyXG5cdFx0Y29uc3QgYSA9IHRhcmdldC5hZGp1c3RtZW50O1xyXG5cclxuXHRcdGlmICghYSkgcmV0dXJuIGZhbHNlO1xyXG5cclxuXHRcdHJldHVybiAoYS50eXBlID09PSAnYnJpZ2h0bmVzcy9jb250cmFzdCcgJiYgIWEudXNlTGVnYWN5KSB8fFxyXG5cdFx0XHQoKGEudHlwZSA9PT0gJ2xldmVscycgfHwgYS50eXBlID09PSAnY3VydmVzJyB8fCBhLnR5cGUgPT09ICdleHBvc3VyZScgfHwgYS50eXBlID09PSAnY2hhbm5lbCBtaXhlcicgfHxcclxuXHRcdFx0XHRhLnR5cGUgPT09ICdodWUvc2F0dXJhdGlvbicpICYmIGEucHJlc2V0RmlsZU5hbWUgIT09IHVuZGVmaW5lZCk7XHJcblx0fSxcclxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcclxuXHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhc1xyXG5cdFx0XHRCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yIHwgUHJlc2V0RGVzY3JpcHRvciB8IEN1cnZlc1ByZXNldERlc2NyaXB0b3IgfCBNaXhlclByZXNldERlc2NyaXB0b3I7XHJcblx0XHRpZiAoZGVzYy5WcnNuICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgQ2dFZCB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0Ly8gdGhpcyBzZWN0aW9uIGNhbiBzcGVjaWZ5IHByZXNldCBmaWxlIG5hbWUgZm9yIG90aGVyIGFkanVzdG1lbnQgdHlwZXNcclxuXHRcdGlmICgncHJlc2V0RmlsZU5hbWUnIGluIGRlc2MpIHtcclxuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XHJcblx0XHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgTGV2ZWxzQWRqdXN0bWVudCB8IEV4cG9zdXJlQWRqdXN0bWVudCB8IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50LFxyXG5cdFx0XHRcdHByZXNldEtpbmQ6IGRlc2MucHJlc2V0S2luZCxcclxuXHRcdFx0XHRwcmVzZXRGaWxlTmFtZTogZGVzYy5wcmVzZXRGaWxlTmFtZSxcclxuXHRcdFx0fTtcclxuXHRcdH0gZWxzZSBpZiAoJ2N1cnZlc1ByZXNldEZpbGVOYW1lJyBpbiBkZXNjKSB7XHJcblx0XHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xyXG5cdFx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIEN1cnZlc0FkanVzdG1lbnQsXHJcblx0XHRcdFx0cHJlc2V0S2luZDogZGVzYy5jdXJ2ZXNQcmVzZXRLaW5kLFxyXG5cdFx0XHRcdHByZXNldEZpbGVOYW1lOiBkZXNjLmN1cnZlc1ByZXNldEZpbGVOYW1lLFxyXG5cdFx0XHR9O1xyXG5cdFx0fSBlbHNlIGlmICgnbWl4ZXJQcmVzZXRGaWxlTmFtZScgaW4gZGVzYykge1xyXG5cdFx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBDdXJ2ZXNBZGp1c3RtZW50LFxyXG5cdFx0XHRcdHByZXNldEtpbmQ6IGRlc2MubWl4ZXJQcmVzZXRLaW5kLFxyXG5cdFx0XHRcdHByZXNldEZpbGVOYW1lOiBkZXNjLm1peGVyUHJlc2V0RmlsZU5hbWUsXHJcblx0XHRcdH07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcclxuXHRcdFx0XHR0eXBlOiAnYnJpZ2h0bmVzcy9jb250cmFzdCcsXHJcblx0XHRcdFx0YnJpZ2h0bmVzczogZGVzYy5CcmdoLFxyXG5cdFx0XHRcdGNvbnRyYXN0OiBkZXNjLkNudHIsXHJcblx0XHRcdFx0bWVhblZhbHVlOiBkZXNjLm1lYW5zLFxyXG5cdFx0XHRcdHVzZUxlZ2FjeTogISFkZXNjLnVzZUxlZ2FjeSxcclxuXHRcdFx0XHRsYWJDb2xvck9ubHk6ICEhZGVzY1snTGFiICddLFxyXG5cdFx0XHRcdGF1dG86ICEhZGVzYy5BdXRvLFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCE7XHJcblxyXG5cdFx0aWYgKGluZm8udHlwZSA9PT0gJ2xldmVscycgfHwgaW5mby50eXBlID09PSAnZXhwb3N1cmUnIHx8IGluZm8udHlwZSA9PT0gJ2h1ZS9zYXR1cmF0aW9uJykge1xyXG5cdFx0XHRjb25zdCBkZXNjOiBQcmVzZXREZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRcdFZyc246IDEsXHJcblx0XHRcdFx0cHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kID8/IDEsXHJcblx0XHRcdFx0cHJlc2V0RmlsZU5hbWU6IGluZm8ucHJlc2V0RmlsZU5hbWUgfHwgJycsXHJcblx0XHRcdH07XHJcblx0XHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHRcdH0gZWxzZSBpZiAoaW5mby50eXBlID09PSAnY3VydmVzJykge1xyXG5cdFx0XHRjb25zdCBkZXNjOiBDdXJ2ZXNQcmVzZXREZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRcdFZyc246IDEsXHJcblx0XHRcdFx0Y3VydmVzUHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kID8/IDEsXHJcblx0XHRcdFx0Y3VydmVzUHJlc2V0RmlsZU5hbWU6IGluZm8ucHJlc2V0RmlsZU5hbWUgfHwgJycsXHJcblx0XHRcdH07XHJcblx0XHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHRcdH0gZWxzZSBpZiAoaW5mby50eXBlID09PSAnY2hhbm5lbCBtaXhlcicpIHtcclxuXHRcdFx0Y29uc3QgZGVzYzogTWl4ZXJQcmVzZXREZXNjcmlwdG9yID0ge1xyXG5cdFx0XHRcdFZyc246IDEsXHJcblx0XHRcdFx0bWl4ZXJQcmVzZXRLaW5kOiBpbmZvLnByZXNldEtpbmQgPz8gMSxcclxuXHRcdFx0XHRtaXhlclByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxyXG5cdFx0XHR9O1xyXG5cdFx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0XHR9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2JyaWdodG5lc3MvY29udHJhc3QnKSB7XHJcblx0XHRcdGNvbnN0IGRlc2M6IEJyaWdodG5lc3NDb250cmFzdERlc2NyaXB0b3IgPSB7XHJcblx0XHRcdFx0VnJzbjogMSxcclxuXHRcdFx0XHRCcmdoOiBpbmZvLmJyaWdodG5lc3MgfHwgMCxcclxuXHRcdFx0XHRDbnRyOiBpbmZvLmNvbnRyYXN0IHx8IDAsXHJcblx0XHRcdFx0bWVhbnM6IGluZm8ubWVhblZhbHVlID8/IDEyNyxcclxuXHRcdFx0XHQnTGFiICc6ICEhaW5mby5sYWJDb2xvck9ubHksXHJcblx0XHRcdFx0dXNlTGVnYWN5OiAhIWluZm8udXNlTGVnYWN5LFxyXG5cdFx0XHRcdEF1dG86ICEhaW5mby5hdXRvLFxyXG5cdFx0XHR9O1xyXG5cdFx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuaGFuZGxlZCBDZ0VkIGNhc2UnKTtcclxuXHRcdH1cclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnVHh0MicsXHJcblx0aGFzS2V5KCdlbmdpbmVEYXRhJyksXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkYXRhID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHRcdHRhcmdldC5lbmdpbmVEYXRhID0gZnJvbUJ5dGVBcnJheShkYXRhKTtcclxuXHRcdC8vIGNvbnN0IGVuZ2luZURhdGEgPSBwYXJzZUVuZ2luZURhdGEoZGF0YSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdC8vIHJlcXVpcmUoJ2ZzJykud3JpdGVGaWxlU3luYygncmVzb3VyY2VzL2VuZ2luZURhdGEyU2ltcGxlLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGVuZ2luZURhdGEsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0Ly8gcmVxdWlyZSgnZnMnKS53cml0ZUZpbGVTeW5jKCd0ZXN0X2RhdGEuanNvbicsIEpTT04uc3RyaW5naWZ5KGVkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gdG9CeXRlQXJyYXkodGFyZ2V0LmVuZ2luZURhdGEhKTtcclxuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCBidWZmZXIpO1xyXG5cdH0sXHJcbik7XHJcblxyXG5hZGRIYW5kbGVyKFxyXG5cdCdGTXNrJyxcclxuXHRoYXNLZXkoJ2ZpbHRlck1hc2snKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC5maWx0ZXJNYXNrID0ge1xyXG5cdFx0XHRjb2xvclNwYWNlOiByZWFkQ29sb3IocmVhZGVyKSxcclxuXHRcdFx0b3BhY2l0eTogcmVhZFVpbnQxNihyZWFkZXIpIC8gMHhmZixcclxuXHRcdH07XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlQ29sb3Iod3JpdGVyLCB0YXJnZXQuZmlsdGVyTWFzayEuY29sb3JTcGFjZSk7XHJcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNsYW1wKHRhcmdldC5maWx0ZXJNYXNrIS5vcGFjaXR5ID8/IDEsIDAsIDEpICogMHhmZik7XHJcblx0fSxcclxuKTtcclxuXHJcbmludGVyZmFjZSBBcnRkRGVzY3JpcHRvciB7XHJcblx0J0NudCAnOiBudW1iZXI7XHJcblx0YXV0b0V4cGFuZE9mZnNldDogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfTtcclxuXHRvcmlnaW46IHsgSHJ6bjogbnVtYmVyOyBWcnRjOiBudW1iZXI7IH07XHJcblx0YXV0b0V4cGFuZEVuYWJsZWQ6IGJvb2xlYW47XHJcblx0YXV0b05lc3RFbmFibGVkOiBib29sZWFuO1xyXG5cdGF1dG9Qb3NpdGlvbkVuYWJsZWQ6IGJvb2xlYW47XHJcblx0c2hyaW5rd3JhcE9uU2F2ZUVuYWJsZWQ6IGJvb2xlYW47XHJcblx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yOiBEZXNjcmlwdG9yQ29sb3I7XHJcblx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGU6IG51bWJlcjtcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnYXJ0ZCcsIC8vIGRvY3VtZW50LXdpZGUgYXJ0Ym9hcmQgaW5mb1xyXG5cdHRhcmdldCA9PiAodGFyZ2V0IGFzIFBzZCkuYXJ0Ym9hcmRzICE9PSB1bmRlZmluZWQsXHJcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcikgYXMgQXJ0ZERlc2NyaXB0b3I7XHJcblx0XHQodGFyZ2V0IGFzIFBzZCkuYXJ0Ym9hcmRzID0ge1xyXG5cdFx0XHRjb3VudDogZGVzY1snQ250ICddLFxyXG5cdFx0XHRhdXRvRXhwYW5kT2Zmc2V0OiB7IGhvcml6b250YWw6IGRlc2MuYXV0b0V4cGFuZE9mZnNldC5IcnpuLCB2ZXJ0aWNhbDogZGVzYy5hdXRvRXhwYW5kT2Zmc2V0LlZydGMgfSxcclxuXHRcdFx0b3JpZ2luOiB7IGhvcml6b250YWw6IGRlc2Mub3JpZ2luLkhyem4sIHZlcnRpY2FsOiBkZXNjLm9yaWdpbi5WcnRjIH0sXHJcblx0XHRcdGF1dG9FeHBhbmRFbmFibGVkOiBkZXNjLmF1dG9FeHBhbmRFbmFibGVkLFxyXG5cdFx0XHRhdXRvTmVzdEVuYWJsZWQ6IGRlc2MuYXV0b05lc3RFbmFibGVkLFxyXG5cdFx0XHRhdXRvUG9zaXRpb25FbmFibGVkOiBkZXNjLmF1dG9Qb3NpdGlvbkVuYWJsZWQsXHJcblx0XHRcdHNocmlua3dyYXBPblNhdmVFbmFibGVkOiBkZXNjLnNocmlua3dyYXBPblNhdmVFbmFibGVkLFxyXG5cdFx0XHRkb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kQ29sb3I6IHBhcnNlQ29sb3IoZGVzYy5kb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kQ29sb3IpLFxyXG5cdFx0XHRkb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZTogZGVzYy5kb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kVHlwZSxcclxuXHRcdH07XHJcblxyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgYXJ0YiA9ICh0YXJnZXQgYXMgUHNkKS5hcnRib2FyZHMhO1xyXG5cdFx0Y29uc3QgZGVzYzogQXJ0ZERlc2NyaXB0b3IgPSB7XHJcblx0XHRcdCdDbnQgJzogYXJ0Yi5jb3VudCxcclxuXHRcdFx0YXV0b0V4cGFuZE9mZnNldDogYXJ0Yi5hdXRvRXhwYW5kT2Zmc2V0ID8geyBIcnpuOiBhcnRiLmF1dG9FeHBhbmRPZmZzZXQuaG9yaXpvbnRhbCwgVnJ0YzogYXJ0Yi5hdXRvRXhwYW5kT2Zmc2V0LnZlcnRpY2FsIH0gOiB7IEhyem46IDAsIFZydGM6IDAgfSxcclxuXHRcdFx0b3JpZ2luOiBhcnRiLm9yaWdpbiA/IHsgSHJ6bjogYXJ0Yi5vcmlnaW4uaG9yaXpvbnRhbCwgVnJ0YzogYXJ0Yi5vcmlnaW4udmVydGljYWwgfSA6IHsgSHJ6bjogMCwgVnJ0YzogMCB9LFxyXG5cdFx0XHRhdXRvRXhwYW5kRW5hYmxlZDogYXJ0Yi5hdXRvRXhwYW5kRW5hYmxlZCA/PyB0cnVlLFxyXG5cdFx0XHRhdXRvTmVzdEVuYWJsZWQ6IGFydGIuYXV0b05lc3RFbmFibGVkID8/IHRydWUsXHJcblx0XHRcdGF1dG9Qb3NpdGlvbkVuYWJsZWQ6IGFydGIuYXV0b1Bvc2l0aW9uRW5hYmxlZCA/PyB0cnVlLFxyXG5cdFx0XHRzaHJpbmt3cmFwT25TYXZlRW5hYmxlZDogYXJ0Yi5zaHJpbmt3cmFwT25TYXZlRW5hYmxlZCA/PyB0cnVlLFxyXG5cdFx0XHRkb2NEZWZhdWx0TmV3QXJ0Ym9hcmRCYWNrZ3JvdW5kQ29sb3I6IHNlcmlhbGl6ZUNvbG9yKGFydGIuZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZENvbG9yKSxcclxuXHRcdFx0ZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGU6IGFydGIuZG9jRGVmYXVsdE5ld0FydGJvYXJkQmFja2dyb3VuZFR5cGUgPz8gMSxcclxuXHRcdH07XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYywgJ2FydGQnKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIEVmZmVjdERlc2NyaXB0b3IgZXh0ZW5kcyBQYXJ0aWFsPERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQ+LCBQYXJ0aWFsPERlc2NyaXB0b3JQYXR0ZXJuQ29udGVudD4ge1xyXG5cdGVuYWI/OiBib29sZWFuO1xyXG5cdFN0eWw6IHN0cmluZztcclxuXHRQbnRUPzogc3RyaW5nO1xyXG5cdCdNZCAgJz86IHN0cmluZztcclxuXHRPcGN0PzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0J1N6ICAnPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0J0NsciAnPzogRGVzY3JpcHRvckNvbG9yO1xyXG5cdHByZXNlbnQ/OiBib29sZWFuO1xyXG5cdHNob3dJbkRpYWxvZz86IGJvb2xlYW47XHJcblx0b3ZlcnByaW50PzogYm9vbGVhbjtcclxufVxyXG5cclxuaW50ZXJmYWNlIExmeDJEZXNjcmlwdG9yIHtcclxuXHQnU2NsICc/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRtYXN0ZXJGWFN3aXRjaD86IGJvb2xlYW47XHJcblx0RHJTaD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0SXJTaD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0T3JHbD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0SXJHbD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0ZWJibD86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0U29GaT86IEVmZmVjdERlc2NyaXB0b3I7XHJcblx0cGF0dGVybkZpbGw/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdEdyRmw/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdENoRlg/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG5cdEZyRlg/OiBFZmZlY3REZXNjcmlwdG9yO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgTG1meERlc2NyaXB0b3Ige1xyXG5cdCdTY2wgJz86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdG1hc3RlckZYU3dpdGNoPzogYm9vbGVhbjtcclxuXHRudW1Nb2RpZnlpbmdGWD86IG51bWJlcjtcclxuXHRPckdsPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRJckdsPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRlYmJsPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRDaEZYPzogRWZmZWN0RGVzY3JpcHRvcjtcclxuXHRkcm9wU2hhZG93TXVsdGk/OiBFZmZlY3REZXNjcmlwdG9yW107XHJcblx0aW5uZXJTaGFkb3dNdWx0aT86IEVmZmVjdERlc2NyaXB0b3JbXTtcclxuXHRzb2xpZEZpbGxNdWx0aT86IEVmZmVjdERlc2NyaXB0b3JbXTtcclxuXHRncmFkaWVudEZpbGxNdWx0aT86IEVmZmVjdERlc2NyaXB0b3JbXTtcclxuXHRmcmFtZUZYTXVsdGk/OiBFZmZlY3REZXNjcmlwdG9yW107XHJcblx0cGF0dGVybkZpbGw/OiBFZmZlY3REZXNjcmlwdG9yOyAvLyA/Pz9cclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VGeE9iamVjdChmeDogRWZmZWN0RGVzY3JpcHRvcikge1xyXG5cdGNvbnN0IHN0cm9rZTogTGF5ZXJFZmZlY3RTdHJva2UgPSB7XHJcblx0XHRlbmFibGVkOiAhIWZ4LmVuYWIsXHJcblx0XHRwb3NpdGlvbjogRlN0bC5kZWNvZGUoZnguU3R5bCksXHJcblx0XHRmaWxsVHlwZTogRnJGbC5kZWNvZGUoZnguUG50VCEpLFxyXG5cdFx0YmxlbmRNb2RlOiBCbG5NLmRlY29kZShmeFsnTWQgICddISksXHJcblx0XHRvcGFjaXR5OiBwYXJzZVBlcmNlbnQoZnguT3BjdCksXHJcblx0XHRzaXplOiBwYXJzZVVuaXRzKGZ4WydTeiAgJ10hKSxcclxuXHR9O1xyXG5cclxuXHRpZiAoZngucHJlc2VudCAhPT0gdW5kZWZpbmVkKSBzdHJva2UucHJlc2VudCA9IGZ4LnByZXNlbnQ7XHJcblx0aWYgKGZ4LnNob3dJbkRpYWxvZyAhPT0gdW5kZWZpbmVkKSBzdHJva2Uuc2hvd0luRGlhbG9nID0gZnguc2hvd0luRGlhbG9nO1xyXG5cdGlmIChmeC5vdmVycHJpbnQgIT09IHVuZGVmaW5lZCkgc3Ryb2tlLm92ZXJwcmludCA9IGZ4Lm92ZXJwcmludDtcclxuXHRpZiAoZnhbJ0NsciAnXSkgc3Ryb2tlLmNvbG9yID0gcGFyc2VDb2xvcihmeFsnQ2xyICddKTtcclxuXHRpZiAoZnguR3JhZCkgc3Ryb2tlLmdyYWRpZW50ID0gcGFyc2VHcmFkaWVudENvbnRlbnQoZnggYXMgYW55KTtcclxuXHRpZiAoZnguUHRybikgc3Ryb2tlLnBhdHRlcm4gPSBwYXJzZVBhdHRlcm5Db250ZW50KGZ4IGFzIGFueSk7XHJcblxyXG5cdHJldHVybiBzdHJva2U7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZUZ4T2JqZWN0KHN0cm9rZTogTGF5ZXJFZmZlY3RTdHJva2UpIHtcclxuXHRsZXQgRnJGWDogRWZmZWN0RGVzY3JpcHRvciA9IHt9IGFzIGFueTtcclxuXHRGckZYLmVuYWIgPSAhIXN0cm9rZS5lbmFibGVkO1xyXG5cdGlmIChzdHJva2UucHJlc2VudCAhPT0gdW5kZWZpbmVkKSBGckZYLnByZXNlbnQgPSAhIXN0cm9rZS5wcmVzZW50O1xyXG5cdGlmIChzdHJva2Uuc2hvd0luRGlhbG9nICE9PSB1bmRlZmluZWQpIEZyRlguc2hvd0luRGlhbG9nID0gISFzdHJva2Uuc2hvd0luRGlhbG9nO1xyXG5cdEZyRlguU3R5bCA9IEZTdGwuZW5jb2RlKHN0cm9rZS5wb3NpdGlvbik7XHJcblx0RnJGWC5QbnRUID0gRnJGbC5lbmNvZGUoc3Ryb2tlLmZpbGxUeXBlKTtcclxuXHRGckZYWydNZCAgJ10gPSBCbG5NLmVuY29kZShzdHJva2UuYmxlbmRNb2RlKTtcclxuXHRGckZYLk9wY3QgPSB1bml0c1BlcmNlbnQoc3Ryb2tlLm9wYWNpdHkpO1xyXG5cdEZyRlhbJ1N6ICAnXSA9IHVuaXRzVmFsdWUoc3Ryb2tlLnNpemUsICdzaXplJyk7XHJcblx0aWYgKHN0cm9rZS5jb2xvcikgRnJGWFsnQ2xyICddID0gc2VyaWFsaXplQ29sb3Ioc3Ryb2tlLmNvbG9yKTtcclxuXHRpZiAoc3Ryb2tlLmdyYWRpZW50KSBGckZYID0geyAuLi5GckZYLCAuLi5zZXJpYWxpemVHcmFkaWVudENvbnRlbnQoc3Ryb2tlLmdyYWRpZW50KSB9O1xyXG5cdGlmIChzdHJva2UucGF0dGVybikgRnJGWCA9IHsgLi4uRnJGWCwgLi4uc2VyaWFsaXplUGF0dGVybkNvbnRlbnQoc3Ryb2tlLnBhdHRlcm4pIH07XHJcblx0aWYgKHN0cm9rZS5vdmVycHJpbnQgIT09IHVuZGVmaW5lZCkgRnJGWC5vdmVycHJpbnQgPSAhIXN0cm9rZS5vdmVycHJpbnQ7XHJcblx0cmV0dXJuIEZyRlg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRWZmZWN0cyhpbmZvOiBMZngyRGVzY3JpcHRvciAmIExtZnhEZXNjcmlwdG9yLCBsb2c6IGJvb2xlYW4pIHtcclxuXHRjb25zdCBlZmZlY3RzOiBMYXllckVmZmVjdHNJbmZvID0ge307XHJcblx0aWYgKCFpbmZvLm1hc3RlckZYU3dpdGNoKSBlZmZlY3RzLmRpc2FibGVkID0gdHJ1ZTtcclxuXHRpZiAoaW5mb1snU2NsICddKSBlZmZlY3RzLnNjYWxlID0gcGFyc2VQZXJjZW50KGluZm9bJ1NjbCAnXSk7XHJcblx0aWYgKGluZm8uRHJTaCkgZWZmZWN0cy5kcm9wU2hhZG93ID0gW3BhcnNlRWZmZWN0T2JqZWN0KGluZm8uRHJTaCwgbG9nKV07XHJcblx0aWYgKGluZm8uZHJvcFNoYWRvd011bHRpKSBlZmZlY3RzLmRyb3BTaGFkb3cgPSBpbmZvLmRyb3BTaGFkb3dNdWx0aS5tYXAoaSA9PiBwYXJzZUVmZmVjdE9iamVjdChpLCBsb2cpKTtcclxuXHRpZiAoaW5mby5JclNoKSBlZmZlY3RzLmlubmVyU2hhZG93ID0gW3BhcnNlRWZmZWN0T2JqZWN0KGluZm8uSXJTaCwgbG9nKV07XHJcblx0aWYgKGluZm8uaW5uZXJTaGFkb3dNdWx0aSkgZWZmZWN0cy5pbm5lclNoYWRvdyA9IGluZm8uaW5uZXJTaGFkb3dNdWx0aS5tYXAoaSA9PiBwYXJzZUVmZmVjdE9iamVjdChpLCBsb2cpKTtcclxuXHRpZiAoaW5mby5PckdsKSBlZmZlY3RzLm91dGVyR2xvdyA9IHBhcnNlRWZmZWN0T2JqZWN0KGluZm8uT3JHbCwgbG9nKTtcclxuXHRpZiAoaW5mby5JckdsKSBlZmZlY3RzLmlubmVyR2xvdyA9IHBhcnNlRWZmZWN0T2JqZWN0KGluZm8uSXJHbCwgbG9nKTtcclxuXHRpZiAoaW5mby5lYmJsKSBlZmZlY3RzLmJldmVsID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5lYmJsLCBsb2cpO1xyXG5cdGlmIChpbmZvLlNvRmkpIGVmZmVjdHMuc29saWRGaWxsID0gW3BhcnNlRWZmZWN0T2JqZWN0KGluZm8uU29GaSwgbG9nKV07XHJcblx0aWYgKGluZm8uc29saWRGaWxsTXVsdGkpIGVmZmVjdHMuc29saWRGaWxsID0gaW5mby5zb2xpZEZpbGxNdWx0aS5tYXAoaSA9PiBwYXJzZUVmZmVjdE9iamVjdChpLCBsb2cpKTtcclxuXHRpZiAoaW5mby5wYXR0ZXJuRmlsbCkgZWZmZWN0cy5wYXR0ZXJuT3ZlcmxheSA9IHBhcnNlRWZmZWN0T2JqZWN0KGluZm8ucGF0dGVybkZpbGwsIGxvZyk7XHJcblx0aWYgKGluZm8uR3JGbCkgZWZmZWN0cy5ncmFkaWVudE92ZXJsYXkgPSBbcGFyc2VFZmZlY3RPYmplY3QoaW5mby5HckZsLCBsb2cpXTtcclxuXHRpZiAoaW5mby5ncmFkaWVudEZpbGxNdWx0aSkgZWZmZWN0cy5ncmFkaWVudE92ZXJsYXkgPSBpbmZvLmdyYWRpZW50RmlsbE11bHRpLm1hcChpID0+IHBhcnNlRWZmZWN0T2JqZWN0KGksIGxvZykpO1xyXG5cdGlmIChpbmZvLkNoRlgpIGVmZmVjdHMuc2F0aW4gPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLkNoRlgsIGxvZyk7XHJcblx0aWYgKGluZm8uRnJGWCkgZWZmZWN0cy5zdHJva2UgPSBbcGFyc2VGeE9iamVjdChpbmZvLkZyRlgpXTtcclxuXHRpZiAoaW5mby5mcmFtZUZYTXVsdGkpIGVmZmVjdHMuc3Ryb2tlID0gaW5mby5mcmFtZUZYTXVsdGkubWFwKGkgPT4gcGFyc2VGeE9iamVjdChpKSk7XHJcblx0cmV0dXJuIGVmZmVjdHM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZUVmZmVjdHMoZTogTGF5ZXJFZmZlY3RzSW5mbywgbG9nOiBib29sZWFuLCBtdWx0aTogYm9vbGVhbikge1xyXG5cdGNvbnN0IGluZm86IExmeDJEZXNjcmlwdG9yICYgTG1meERlc2NyaXB0b3IgPSBtdWx0aSA/IHtcclxuXHRcdCdTY2wgJzogdW5pdHNQZXJjZW50KGUuc2NhbGUgPz8gMSksXHJcblx0XHRtYXN0ZXJGWFN3aXRjaDogIWUuZGlzYWJsZWQsXHJcblx0fSA6IHtcclxuXHRcdG1hc3RlckZYU3dpdGNoOiAhZS5kaXNhYmxlZCxcclxuXHRcdCdTY2wgJzogdW5pdHNQZXJjZW50KGUuc2NhbGUgPz8gMSksXHJcblx0fTtcclxuXHJcblx0Y29uc3QgYXJyYXlLZXlzOiAoa2V5b2YgTGF5ZXJFZmZlY3RzSW5mbylbXSA9IFsnZHJvcFNoYWRvdycsICdpbm5lclNoYWRvdycsICdzb2xpZEZpbGwnLCAnZ3JhZGllbnRPdmVybGF5JywgJ3N0cm9rZSddO1xyXG5cdGZvciAoY29uc3Qga2V5IG9mIGFycmF5S2V5cykge1xyXG5cdFx0aWYgKGVba2V5XSAmJiAhQXJyYXkuaXNBcnJheShlW2tleV0pKSB0aHJvdyBuZXcgRXJyb3IoYCR7a2V5fSBzaG91bGQgYmUgYW4gYXJyYXlgKTtcclxuXHR9XHJcblxyXG5cdGlmIChlLmRyb3BTaGFkb3c/LlswXSAmJiAhbXVsdGkpIGluZm8uRHJTaCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlLmRyb3BTaGFkb3dbMF0sICdkcm9wU2hhZG93JywgbG9nKTtcclxuXHRpZiAoZS5kcm9wU2hhZG93Py5bMF0gJiYgbXVsdGkpIGluZm8uZHJvcFNoYWRvd011bHRpID0gZS5kcm9wU2hhZG93Lm1hcChpID0+IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChpLCAnZHJvcFNoYWRvdycsIGxvZykpO1xyXG5cdGlmIChlLmlubmVyU2hhZG93Py5bMF0gJiYgIW11bHRpKSBpbmZvLklyU2ggPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5pbm5lclNoYWRvd1swXSwgJ2lubmVyU2hhZG93JywgbG9nKTtcclxuXHRpZiAoZS5pbm5lclNoYWRvdz8uWzBdICYmIG11bHRpKSBpbmZvLmlubmVyU2hhZG93TXVsdGkgPSBlLmlubmVyU2hhZG93Lm1hcChpID0+IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChpLCAnaW5uZXJTaGFkb3cnLCBsb2cpKTtcclxuXHRpZiAoZS5vdXRlckdsb3cpIGluZm8uT3JHbCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlLm91dGVyR2xvdywgJ291dGVyR2xvdycsIGxvZyk7XHJcblx0aWYgKGUuc29saWRGaWxsPy5bMF0gJiYgbXVsdGkpIGluZm8uc29saWRGaWxsTXVsdGkgPSBlLnNvbGlkRmlsbC5tYXAoaSA9PiBzZXJpYWxpemVFZmZlY3RPYmplY3QoaSwgJ3NvbGlkRmlsbCcsIGxvZykpO1xyXG5cdGlmIChlLmdyYWRpZW50T3ZlcmxheT8uWzBdICYmIG11bHRpKSBpbmZvLmdyYWRpZW50RmlsbE11bHRpID0gZS5ncmFkaWVudE92ZXJsYXkubWFwKGkgPT4gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGksICdncmFkaWVudE92ZXJsYXknLCBsb2cpKTtcclxuXHRpZiAoZS5zdHJva2U/LlswXSAmJiBtdWx0aSkgaW5mby5mcmFtZUZYTXVsdGkgPSBlLnN0cm9rZS5tYXAoaSA9PiBzZXJpYWxpemVGeE9iamVjdChpKSk7XHJcblx0aWYgKGUuaW5uZXJHbG93KSBpbmZvLklyR2wgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5pbm5lckdsb3csICdpbm5lckdsb3cnLCBsb2cpO1xyXG5cdGlmIChlLmJldmVsKSBpbmZvLmViYmwgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5iZXZlbCwgJ2JldmVsJywgbG9nKTtcclxuXHRpZiAoZS5zb2xpZEZpbGw/LlswXSAmJiAhbXVsdGkpIGluZm8uU29GaSA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlLnNvbGlkRmlsbFswXSwgJ3NvbGlkRmlsbCcsIGxvZyk7XHJcblx0aWYgKGUucGF0dGVybk92ZXJsYXkpIGluZm8ucGF0dGVybkZpbGwgPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZS5wYXR0ZXJuT3ZlcmxheSwgJ3BhdHRlcm5PdmVybGF5JywgbG9nKTtcclxuXHRpZiAoZS5ncmFkaWVudE92ZXJsYXk/LlswXSAmJiAhbXVsdGkpIGluZm8uR3JGbCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlLmdyYWRpZW50T3ZlcmxheVswXSwgJ2dyYWRpZW50T3ZlcmxheScsIGxvZyk7XHJcblx0aWYgKGUuc2F0aW4pIGluZm8uQ2hGWCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlLnNhdGluLCAnc2F0aW4nLCBsb2cpO1xyXG5cdGlmIChlLnN0cm9rZT8uWzBdICYmICFtdWx0aSkgaW5mby5GckZYID0gc2VyaWFsaXplRnhPYmplY3QoZS5zdHJva2U/LlswXSk7XHJcblxyXG5cdGlmIChtdWx0aSkge1xyXG5cdFx0aW5mby5udW1Nb2RpZnlpbmdGWCA9IDA7XHJcblxyXG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoZSkpIHtcclxuXHRcdFx0Y29uc3QgdmFsdWUgPSAoZSBhcyBhbnkpW2tleV07XHJcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG5cdFx0XHRcdGZvciAoY29uc3QgZWZmZWN0IG9mIHZhbHVlKSB7XHJcblx0XHRcdFx0XHRpZiAoZWZmZWN0LmVuYWJsZWQpIGluZm8ubnVtTW9kaWZ5aW5nRlgrKztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBpbmZvO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaGFzTXVsdGlFZmZlY3RzKGVmZmVjdHM6IExheWVyRWZmZWN0c0luZm8pIHtcclxuXHRyZXR1cm4gT2JqZWN0LmtleXMoZWZmZWN0cykubWFwKGtleSA9PiAoZWZmZWN0cyBhcyBhbnkpW2tleV0pLnNvbWUodiA9PiBBcnJheS5pc0FycmF5KHYpICYmIHYubGVuZ3RoID4gMSk7XHJcbn1cclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J2xmeDInLFxyXG5cdHRhcmdldCA9PiB0YXJnZXQuZWZmZWN0cyAhPT0gdW5kZWZpbmVkICYmICFoYXNNdWx0aUVmZmVjdHModGFyZ2V0LmVmZmVjdHMpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCwgXywgb3B0aW9ucykgPT4ge1xyXG5cdFx0Y29uc3QgdmVyc2lvbiA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdGlmICh2ZXJzaW9uICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbGZ4MiB2ZXJzaW9uYCk7XHJcblxyXG5cdFx0Y29uc3QgZGVzYzogTGZ4MkRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdC8vIFRPRE86IGRvbid0IGRpc2NhcmQgaWYgd2UgZ290IGl0IGZyb20gbG1meFxyXG5cdFx0Ly8gZGlzY2FyZCBpZiByZWFkIGluICdsckZYJyBzZWN0aW9uXHJcblx0XHR0YXJnZXQuZWZmZWN0cyA9IHBhcnNlRWZmZWN0cyhkZXNjLCAhIW9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzKTtcclxuXHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xyXG5cdH0sXHJcblx0KHdyaXRlciwgdGFyZ2V0LCBfLCBvcHRpb25zKSA9PiB7XHJcblx0XHRjb25zdCBkZXNjID0gc2VyaWFsaXplRWZmZWN0cyh0YXJnZXQuZWZmZWN0cyEsICEhb3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMsIGZhbHNlKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMCk7IC8vIHZlcnNpb25cclxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuaW50ZXJmYWNlIENpbmZEZXNjcmlwdG9yIHtcclxuXHRWcnNuOiB7IG1ham9yOiBudW1iZXI7IG1pbm9yOiBudW1iZXI7IGZpeDogbnVtYmVyOyB9O1xyXG5cdHBzVmVyc2lvbj86IHsgbWFqb3I6IG51bWJlcjsgbWlub3I6IG51bWJlcjsgZml4OiBudW1iZXI7IH07XHJcblx0ZGVzY3JpcHRpb246IHN0cmluZztcclxuXHRyZWFzb246IHN0cmluZztcclxuXHRFbmduOiBzdHJpbmc7IC8vICdFbmduLmNvbXBDb3JlJztcclxuXHRlbmFibGVDb21wQ29yZTogc3RyaW5nOyAvLyAnZW5hYmxlLmZlYXR1cmUnO1xyXG5cdGVuYWJsZUNvbXBDb3JlR1BVOiBzdHJpbmc7IC8vICdlbmFibGUuZmVhdHVyZSc7XHJcblx0ZW5hYmxlQ29tcENvcmVUaHJlYWRzPzogc3RyaW5nOyAvLyAnZW5hYmxlLmZlYXR1cmUnO1xyXG5cdGNvbXBDb3JlU3VwcG9ydDogc3RyaW5nOyAvLyAncmVhc29uLnN1cHBvcnRlZCc7XHJcblx0Y29tcENvcmVHUFVTdXBwb3J0OiBzdHJpbmc7IC8vICdyZWFzb24uZmVhdHVyZURpc2FibGVkJztcclxufVxyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnY2luZicsXHJcblx0aGFzS2V5KCdjb21wb3NpdG9yVXNlZCcpLFxyXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIENpbmZEZXNjcmlwdG9yO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0dGFyZ2V0LmNvbXBvc2l0b3JVc2VkID0ge1xyXG5cdFx0XHRkZXNjcmlwdGlvbjogZGVzYy5kZXNjcmlwdGlvbixcclxuXHRcdFx0cmVhc29uOiBkZXNjLnJlYXNvbixcclxuXHRcdFx0ZW5naW5lOiBkZXNjLkVuZ24uc3BsaXQoJy4nKVsxXSxcclxuXHRcdFx0ZW5hYmxlQ29tcENvcmU6IGRlc2MuZW5hYmxlQ29tcENvcmUuc3BsaXQoJy4nKVsxXSxcclxuXHRcdFx0ZW5hYmxlQ29tcENvcmVHUFU6IGRlc2MuZW5hYmxlQ29tcENvcmVHUFUuc3BsaXQoJy4nKVsxXSxcclxuXHRcdFx0Y29tcENvcmVTdXBwb3J0OiBkZXNjLmNvbXBDb3JlU3VwcG9ydC5zcGxpdCgnLicpWzFdLFxyXG5cdFx0XHRjb21wQ29yZUdQVVN1cHBvcnQ6IGRlc2MuY29tcENvcmVHUFVTdXBwb3J0LnNwbGl0KCcuJylbMV0sXHJcblx0XHR9O1xyXG5cclxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdGNvbnN0IGNpbmYgPSB0YXJnZXQuY29tcG9zaXRvclVzZWQhO1xyXG5cdFx0Y29uc3QgZGVzYzogQ2luZkRlc2NyaXB0b3IgPSB7XHJcblx0XHRcdFZyc246IHsgbWFqb3I6IDEsIG1pbm9yOiAwLCBmaXg6IDAgfSwgLy8gVEVNUFxyXG5cdFx0XHQvLyBwc1ZlcnNpb246IHsgbWFqb3I6IDIyLCBtaW5vcjogMywgZml4OiAxIH0sIC8vIFRFU1RJTkdcclxuXHRcdFx0ZGVzY3JpcHRpb246IGNpbmYuZGVzY3JpcHRpb24sXHJcblx0XHRcdHJlYXNvbjogY2luZi5yZWFzb24sXHJcblx0XHRcdEVuZ246IGBFbmduLiR7Y2luZi5lbmdpbmV9YCxcclxuXHRcdFx0ZW5hYmxlQ29tcENvcmU6IGBlbmFibGUuJHtjaW5mLmVuYWJsZUNvbXBDb3JlfWAsXHJcblx0XHRcdGVuYWJsZUNvbXBDb3JlR1BVOiBgZW5hYmxlLiR7Y2luZi5lbmFibGVDb21wQ29yZUdQVX1gLFxyXG5cdFx0XHQvLyBlbmFibGVDb21wQ29yZVRocmVhZHM6IGBlbmFibGUuZmVhdHVyZWAsIC8vIFRFU1RJTkdcclxuXHRcdFx0Y29tcENvcmVTdXBwb3J0OiBgcmVhc29uLiR7Y2luZi5jb21wQ29yZVN1cHBvcnR9YCxcclxuXHRcdFx0Y29tcENvcmVHUFVTdXBwb3J0OiBgcmVhc29uLiR7Y2luZi5jb21wQ29yZUdQVVN1cHBvcnR9YCxcclxuXHRcdH07XHJcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XHJcblx0fSxcclxuKTtcclxuXHJcbi8vIGV4dGVuc2lvbiBzZXR0aW5ncyA/LCBpZ25vcmUgaXRcclxuYWRkSGFuZGxlcihcclxuXHQnZXh0bicsXHJcblx0dGFyZ2V0ID0+ICh0YXJnZXQgYXMgYW55KS5fZXh0biAhPT0gdW5kZWZpbmVkLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0Y29uc3QgZGVzYzogRXh0ZW5zaW9uRGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0aWYgKE1PQ0tfSEFORExFUlMpICh0YXJnZXQgYXMgYW55KS5fZXh0biA9IGRlc2M7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdC8vIFRPRE86IG5lZWQgdG8gYWRkIGNvcnJlY3QgdHlwZXMgZm9yIGRlc2MgZmllbGRzIChyZXNvdXJjZXMvc3JjLnBzZClcclxuXHRcdGlmIChNT0NLX0hBTkRMRVJTKSB3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgKHRhcmdldCBhcyBhbnkpLl9leHRuKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuYWRkSGFuZGxlcihcclxuXHQnaU9wYScsXHJcblx0aGFzS2V5KCdmaWxsT3BhY2l0eScpLFxyXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0dGFyZ2V0LmZpbGxPcGFjaXR5ID0gcmVhZFVpbnQ4KHJlYWRlcikgLyAweGZmO1xyXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XHJcblx0fSxcclxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQuZmlsbE9wYWNpdHkhICogMHhmZik7XHJcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyk7XHJcblx0fSxcclxuKTtcclxuXHJcbmFkZEhhbmRsZXIoXHJcblx0J3RzbHknLFxyXG5cdGhhc0tleSgndHJhbnNwYXJlbmN5U2hhcGVzTGF5ZXInKSxcclxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcclxuXHRcdHRhcmdldC50cmFuc3BhcmVuY3lTaGFwZXNMYXllciA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XHJcblx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcclxuXHR9LFxyXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xyXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHRhcmdldC50cmFuc3BhcmVuY3lTaGFwZXNMYXllciA/IDEgOiAwKTtcclxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcclxuXHR9LFxyXG4pO1xyXG5cclxuLy8gZGVzY3JpcHRvciBoZWxwZXJzXHJcblxyXG5mdW5jdGlvbiBwYXJzZUdyYWRpZW50KGdyYWQ6IERlc2NpcHRvckdyYWRpZW50KTogRWZmZWN0U29saWRHcmFkaWVudCB8IEVmZmVjdE5vaXNlR3JhZGllbnQge1xyXG5cdGlmIChncmFkLkdyZEYgPT09ICdHcmRGLkNzdFMnKSB7XHJcblx0XHRjb25zdCBzYW1wbGVzOiBudW1iZXIgPSBncmFkLkludHIgfHwgNDA5NjtcclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHR0eXBlOiAnc29saWQnLFxyXG5cdFx0XHRuYW1lOiBncmFkWydObSAgJ10sXHJcblx0XHRcdHNtb290aG5lc3M6IGdyYWQuSW50ciAvIDQwOTYsXHJcblx0XHRcdGNvbG9yU3RvcHM6IGdyYWQuQ2xycy5tYXAocyA9PiAoe1xyXG5cdFx0XHRcdGNvbG9yOiBwYXJzZUNvbG9yKHNbJ0NsciAnXSksXHJcblx0XHRcdFx0bG9jYXRpb246IHMuTGN0biAvIHNhbXBsZXMsXHJcblx0XHRcdFx0bWlkcG9pbnQ6IHMuTWRwbiAvIDEwMCxcclxuXHRcdFx0fSkpLFxyXG5cdFx0XHRvcGFjaXR5U3RvcHM6IGdyYWQuVHJucy5tYXAocyA9PiAoe1xyXG5cdFx0XHRcdG9wYWNpdHk6IHBhcnNlUGVyY2VudChzLk9wY3QpLFxyXG5cdFx0XHRcdGxvY2F0aW9uOiBzLkxjdG4gLyBzYW1wbGVzLFxyXG5cdFx0XHRcdG1pZHBvaW50OiBzLk1kcG4gLyAxMDAsXHJcblx0XHRcdH0pKSxcclxuXHRcdH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHR5cGU6ICdub2lzZScsXHJcblx0XHRcdG5hbWU6IGdyYWRbJ05tICAnXSxcclxuXHRcdFx0cm91Z2huZXNzOiBncmFkLlNtdGggLyA0MDk2LFxyXG5cdFx0XHRjb2xvck1vZGVsOiBDbHJTLmRlY29kZShncmFkLkNsclMpLFxyXG5cdFx0XHRyYW5kb21TZWVkOiBncmFkLlJuZFMsXHJcblx0XHRcdHJlc3RyaWN0Q29sb3JzOiAhIWdyYWQuVmN0QyxcclxuXHRcdFx0YWRkVHJhbnNwYXJlbmN5OiAhIWdyYWQuU2hUcixcclxuXHRcdFx0bWluOiBncmFkWydNbm0gJ10ubWFwKHggPT4geCAvIDEwMCksXHJcblx0XHRcdG1heDogZ3JhZFsnTXhtICddLm1hcCh4ID0+IHggLyAxMDApLFxyXG5cdFx0fTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZUdyYWRpZW50KGdyYWQ6IEVmZmVjdFNvbGlkR3JhZGllbnQgfCBFZmZlY3ROb2lzZUdyYWRpZW50KTogRGVzY2lwdG9yR3JhZGllbnQge1xyXG5cdGlmIChncmFkLnR5cGUgPT09ICdzb2xpZCcpIHtcclxuXHRcdGNvbnN0IHNhbXBsZXMgPSBNYXRoLnJvdW5kKChncmFkLnNtb290aG5lc3MgPz8gMSkgKiA0MDk2KTtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdCdObSAgJzogZ3JhZC5uYW1lIHx8ICcnLFxyXG5cdFx0XHRHcmRGOiAnR3JkRi5Dc3RTJyxcclxuXHRcdFx0SW50cjogc2FtcGxlcyxcclxuXHRcdFx0Q2xyczogZ3JhZC5jb2xvclN0b3BzLm1hcChzID0+ICh7XHJcblx0XHRcdFx0J0NsciAnOiBzZXJpYWxpemVDb2xvcihzLmNvbG9yKSxcclxuXHRcdFx0XHRUeXBlOiAnQ2xyeS5Vc3JTJyxcclxuXHRcdFx0XHRMY3RuOiBNYXRoLnJvdW5kKHMubG9jYXRpb24gKiBzYW1wbGVzKSxcclxuXHRcdFx0XHRNZHBuOiBNYXRoLnJvdW5kKChzLm1pZHBvaW50ID8/IDAuNSkgKiAxMDApLFxyXG5cdFx0XHR9KSksXHJcblx0XHRcdFRybnM6IGdyYWQub3BhY2l0eVN0b3BzLm1hcChzID0+ICh7XHJcblx0XHRcdFx0T3BjdDogdW5pdHNQZXJjZW50KHMub3BhY2l0eSksXHJcblx0XHRcdFx0TGN0bjogTWF0aC5yb3VuZChzLmxvY2F0aW9uICogc2FtcGxlcyksXHJcblx0XHRcdFx0TWRwbjogTWF0aC5yb3VuZCgocy5taWRwb2ludCA/PyAwLjUpICogMTAwKSxcclxuXHRcdFx0fSkpLFxyXG5cdFx0fTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0R3JkRjogJ0dyZEYuQ2xOcycsXHJcblx0XHRcdCdObSAgJzogZ3JhZC5uYW1lIHx8ICcnLFxyXG5cdFx0XHRTaFRyOiAhIWdyYWQuYWRkVHJhbnNwYXJlbmN5LFxyXG5cdFx0XHRWY3RDOiAhIWdyYWQucmVzdHJpY3RDb2xvcnMsXHJcblx0XHRcdENsclM6IENsclMuZW5jb2RlKGdyYWQuY29sb3JNb2RlbCksXHJcblx0XHRcdFJuZFM6IGdyYWQucmFuZG9tU2VlZCB8fCAwLFxyXG5cdFx0XHRTbXRoOiBNYXRoLnJvdW5kKChncmFkLnJvdWdobmVzcyA/PyAxKSAqIDQwOTYpLFxyXG5cdFx0XHQnTW5tICc6IChncmFkLm1pbiB8fCBbMCwgMCwgMCwgMF0pLm1hcCh4ID0+IHggKiAxMDApLFxyXG5cdFx0XHQnTXhtICc6IChncmFkLm1heCB8fCBbMSwgMSwgMSwgMV0pLm1hcCh4ID0+IHggKiAxMDApLFxyXG5cdFx0fTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlR3JhZGllbnRDb250ZW50KGRlc2NyaXB0b3I6IERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQpIHtcclxuXHRjb25zdCByZXN1bHQgPSBwYXJzZUdyYWRpZW50KGRlc2NyaXB0b3IuR3JhZCkgYXMgKEVmZmVjdFNvbGlkR3JhZGllbnQgfCBFZmZlY3ROb2lzZUdyYWRpZW50KSAmIEV4dHJhR3JhZGllbnRJbmZvO1xyXG5cdHJlc3VsdC5zdHlsZSA9IEdyZFQuZGVjb2RlKGRlc2NyaXB0b3IuVHlwZSk7XHJcblx0aWYgKGRlc2NyaXB0b3IuRHRociAhPT0gdW5kZWZpbmVkKSByZXN1bHQuZGl0aGVyID0gZGVzY3JpcHRvci5EdGhyO1xyXG5cdGlmIChkZXNjcmlwdG9yLlJ2cnMgIT09IHVuZGVmaW5lZCkgcmVzdWx0LnJldmVyc2UgPSBkZXNjcmlwdG9yLlJ2cnM7XHJcblx0aWYgKGRlc2NyaXB0b3IuQW5nbCAhPT0gdW5kZWZpbmVkKSByZXN1bHQuYW5nbGUgPSBwYXJzZUFuZ2xlKGRlc2NyaXB0b3IuQW5nbCk7XHJcblx0aWYgKGRlc2NyaXB0b3JbJ1NjbCAnXSAhPT0gdW5kZWZpbmVkKSByZXN1bHQuc2NhbGUgPSBwYXJzZVBlcmNlbnQoZGVzY3JpcHRvclsnU2NsICddKTtcclxuXHRpZiAoZGVzY3JpcHRvci5BbGduICE9PSB1bmRlZmluZWQpIHJlc3VsdC5hbGlnbiA9IGRlc2NyaXB0b3IuQWxnbjtcclxuXHRpZiAoZGVzY3JpcHRvci5PZnN0ICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdHJlc3VsdC5vZmZzZXQgPSB7XHJcblx0XHRcdHg6IHBhcnNlUGVyY2VudChkZXNjcmlwdG9yLk9mc3QuSHJ6biksXHJcblx0XHRcdHk6IHBhcnNlUGVyY2VudChkZXNjcmlwdG9yLk9mc3QuVnJ0YylcclxuXHRcdH07XHJcblx0fVxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlUGF0dGVybkNvbnRlbnQoZGVzY3JpcHRvcjogRGVzY3JpcHRvclBhdHRlcm5Db250ZW50KSB7XHJcblx0Y29uc3QgcmVzdWx0OiBFZmZlY3RQYXR0ZXJuICYgRXh0cmFQYXR0ZXJuSW5mbyA9IHtcclxuXHRcdG5hbWU6IGRlc2NyaXB0b3IuUHRyblsnTm0gICddLFxyXG5cdFx0aWQ6IGRlc2NyaXB0b3IuUHRybi5JZG50LFxyXG5cdH07XHJcblx0aWYgKGRlc2NyaXB0b3IuTG5rZCAhPT0gdW5kZWZpbmVkKSByZXN1bHQubGlua2VkID0gZGVzY3JpcHRvci5MbmtkO1xyXG5cdGlmIChkZXNjcmlwdG9yLnBoYXNlICE9PSB1bmRlZmluZWQpIHJlc3VsdC5waGFzZSA9IHsgeDogZGVzY3JpcHRvci5waGFzZS5IcnpuLCB5OiBkZXNjcmlwdG9yLnBoYXNlLlZydGMgfTtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcjogRGVzY3JpcHRvclZlY3RvckNvbnRlbnQpOiBWZWN0b3JDb250ZW50IHtcclxuXHRpZiAoJ0dyYWQnIGluIGRlc2NyaXB0b3IpIHtcclxuXHRcdHJldHVybiBwYXJzZUdyYWRpZW50Q29udGVudChkZXNjcmlwdG9yKTtcclxuXHR9IGVsc2UgaWYgKCdQdHJuJyBpbiBkZXNjcmlwdG9yKSB7XHJcblx0XHRyZXR1cm4geyB0eXBlOiAncGF0dGVybicsIC4uLnBhcnNlUGF0dGVybkNvbnRlbnQoZGVzY3JpcHRvcikgfTtcclxuXHR9IGVsc2UgaWYgKCdDbHIgJyBpbiBkZXNjcmlwdG9yKSB7XHJcblx0XHRyZXR1cm4geyB0eXBlOiAnY29sb3InLCBjb2xvcjogcGFyc2VDb2xvcihkZXNjcmlwdG9yWydDbHIgJ10pIH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2ZWN0b3IgY29udGVudCcpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2VyaWFsaXplR3JhZGllbnRDb250ZW50KGNvbnRlbnQ6IChFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCkgJiBFeHRyYUdyYWRpZW50SW5mbykge1xyXG5cdGNvbnN0IHJlc3VsdDogRGVzY3JpcHRvckdyYWRpZW50Q29udGVudCA9IHt9IGFzIGFueTtcclxuXHRpZiAoY29udGVudC5kaXRoZXIgIT09IHVuZGVmaW5lZCkgcmVzdWx0LkR0aHIgPSBjb250ZW50LmRpdGhlcjtcclxuXHRpZiAoY29udGVudC5yZXZlcnNlICE9PSB1bmRlZmluZWQpIHJlc3VsdC5SdnJzID0gY29udGVudC5yZXZlcnNlO1xyXG5cdGlmIChjb250ZW50LmFuZ2xlICE9PSB1bmRlZmluZWQpIHJlc3VsdC5BbmdsID0gdW5pdHNBbmdsZShjb250ZW50LmFuZ2xlKTtcclxuXHRyZXN1bHQuVHlwZSA9IEdyZFQuZW5jb2RlKGNvbnRlbnQuc3R5bGUpO1xyXG5cdGlmIChjb250ZW50LmFsaWduICE9PSB1bmRlZmluZWQpIHJlc3VsdC5BbGduID0gY29udGVudC5hbGlnbjtcclxuXHRpZiAoY29udGVudC5zY2FsZSAhPT0gdW5kZWZpbmVkKSByZXN1bHRbJ1NjbCAnXSA9IHVuaXRzUGVyY2VudChjb250ZW50LnNjYWxlKTtcclxuXHRpZiAoY29udGVudC5vZmZzZXQpIHtcclxuXHRcdHJlc3VsdC5PZnN0ID0ge1xyXG5cdFx0XHRIcnpuOiB1bml0c1BlcmNlbnQoY29udGVudC5vZmZzZXQueCksXHJcblx0XHRcdFZydGM6IHVuaXRzUGVyY2VudChjb250ZW50Lm9mZnNldC55KSxcclxuXHRcdH07XHJcblx0fVxyXG5cdHJlc3VsdC5HcmFkID0gc2VyaWFsaXplR3JhZGllbnQoY29udGVudCk7XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gc2VyaWFsaXplUGF0dGVybkNvbnRlbnQoY29udGVudDogRWZmZWN0UGF0dGVybiAmIEV4dHJhUGF0dGVybkluZm8pIHtcclxuXHRjb25zdCByZXN1bHQ6IERlc2NyaXB0b3JQYXR0ZXJuQ29udGVudCA9IHtcclxuXHRcdFB0cm46IHtcclxuXHRcdFx0J05tICAnOiBjb250ZW50Lm5hbWUgfHwgJycsXHJcblx0XHRcdElkbnQ6IGNvbnRlbnQuaWQgfHwgJycsXHJcblx0XHR9XHJcblx0fTtcclxuXHRpZiAoY29udGVudC5saW5rZWQgIT09IHVuZGVmaW5lZCkgcmVzdWx0Lkxua2QgPSAhIWNvbnRlbnQubGlua2VkO1xyXG5cdGlmIChjb250ZW50LnBoYXNlICE9PSB1bmRlZmluZWQpIHJlc3VsdC5waGFzZSA9IHsgSHJ6bjogY29udGVudC5waGFzZS54LCBWcnRjOiBjb250ZW50LnBoYXNlLnkgfTtcclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVWZWN0b3JDb250ZW50KGNvbnRlbnQ6IFZlY3RvckNvbnRlbnQpOiB7IGRlc2NyaXB0b3I6IERlc2NyaXB0b3JWZWN0b3JDb250ZW50OyBrZXk6IHN0cmluZzsgfSB7XHJcblx0aWYgKGNvbnRlbnQudHlwZSA9PT0gJ2NvbG9yJykge1xyXG5cdFx0cmV0dXJuIHsga2V5OiAnU29DbycsIGRlc2NyaXB0b3I6IHsgJ0NsciAnOiBzZXJpYWxpemVDb2xvcihjb250ZW50LmNvbG9yKSB9IH07XHJcblx0fSBlbHNlIGlmIChjb250ZW50LnR5cGUgPT09ICdwYXR0ZXJuJykge1xyXG5cdFx0cmV0dXJuIHsga2V5OiAnUHRGbCcsIGRlc2NyaXB0b3I6IHNlcmlhbGl6ZVBhdHRlcm5Db250ZW50KGNvbnRlbnQpIH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiB7IGtleTogJ0dkRmwnLCBkZXNjcmlwdG9yOiBzZXJpYWxpemVHcmFkaWVudENvbnRlbnQoY29udGVudCkgfTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlQ29sb3IoY29sb3I6IERlc2NyaXB0b3JDb2xvcik6IENvbG9yIHtcclxuXHRpZiAoJ0ggICAnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyBoOiBwYXJzZVBlcmNlbnRPckFuZ2xlKGNvbG9yWydIICAgJ10pLCBzOiBjb2xvci5TdHJ0LCBiOiBjb2xvci5CcmdoIH07XHJcblx0fSBlbHNlIGlmICgnUmQgICcgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7IHI6IGNvbG9yWydSZCAgJ10sIGc6IGNvbG9yWydHcm4gJ10sIGI6IGNvbG9yWydCbCAgJ10gfTtcclxuXHR9IGVsc2UgaWYgKCdDeW4gJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgYzogY29sb3JbJ0N5biAnXSwgbTogY29sb3IuTWdudCwgeTogY29sb3JbJ1lsdyAnXSwgazogY29sb3IuQmxjayB9O1xyXG5cdH0gZWxzZSBpZiAoJ0dyeSAnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyBrOiBjb2xvclsnR3J5ICddIH07XHJcblx0fSBlbHNlIGlmICgnTG1uYycgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7IGw6IGNvbG9yLkxtbmMsIGE6IGNvbG9yWydBICAgJ10sIGI6IGNvbG9yWydCICAgJ10gfTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBjb2xvciBkZXNjcmlwdG9yJyk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBzZXJpYWxpemVDb2xvcihjb2xvcjogQ29sb3IgfCB1bmRlZmluZWQpOiBEZXNjcmlwdG9yQ29sb3Ige1xyXG5cdGlmICghY29sb3IpIHtcclxuXHRcdHJldHVybiB7ICdSZCAgJzogMCwgJ0dybiAnOiAwLCAnQmwgICc6IDAgfTtcclxuXHR9IGVsc2UgaWYgKCdyJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgJ1JkICAnOiBjb2xvci5yIHx8IDAsICdHcm4gJzogY29sb3IuZyB8fCAwLCAnQmwgICc6IGNvbG9yLmIgfHwgMCB9O1xyXG5cdH0gZWxzZSBpZiAoJ2gnIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4geyAnSCAgICc6IHVuaXRzQW5nbGUoY29sb3IuaCAqIDM2MCksIFN0cnQ6IGNvbG9yLnMgfHwgMCwgQnJnaDogY29sb3IuYiB8fCAwIH07XHJcblx0fSBlbHNlIGlmICgnYycgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiB7ICdDeW4gJzogY29sb3IuYyB8fCAwLCBNZ250OiBjb2xvci5tIHx8IDAsICdZbHcgJzogY29sb3IueSB8fCAwLCBCbGNrOiBjb2xvci5rIHx8IDAgfTtcclxuXHR9IGVsc2UgaWYgKCdsJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgTG1uYzogY29sb3IubCB8fCAwLCAnQSAgICc6IGNvbG9yLmEgfHwgMCwgJ0IgICAnOiBjb2xvci5iIHx8IDAgfTtcclxuXHR9IGVsc2UgaWYgKCdrJyBpbiBjb2xvcikge1xyXG5cdFx0cmV0dXJuIHsgJ0dyeSAnOiBjb2xvci5rIH07XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2xvciB2YWx1ZScpO1xyXG5cdH1cclxufVxyXG5cclxudHlwZSBBbGxFZmZlY3RzID0gTGF5ZXJFZmZlY3RTaGFkb3cgJiBMYXllckVmZmVjdHNPdXRlckdsb3cgJiBMYXllckVmZmVjdFN0cm9rZSAmXHJcblx0TGF5ZXJFZmZlY3RJbm5lckdsb3cgJiBMYXllckVmZmVjdEJldmVsICYgTGF5ZXJFZmZlY3RTb2xpZEZpbGwgJlxyXG5cdExheWVyRWZmZWN0UGF0dGVybk92ZXJsYXkgJiBMYXllckVmZmVjdFNhdGluICYgTGF5ZXJFZmZlY3RHcmFkaWVudE92ZXJsYXk7XHJcblxyXG5mdW5jdGlvbiBwYXJzZUVmZmVjdE9iamVjdChvYmo6IGFueSwgcmVwb3J0RXJyb3JzOiBib29sZWFuKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBBbGxFZmZlY3RzID0ge30gYXMgYW55O1xyXG5cclxuXHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XHJcblx0XHRjb25zdCB2YWwgPSBvYmpba2V5XTtcclxuXHJcblx0XHRzd2l0Y2ggKGtleSkge1xyXG5cdFx0XHRjYXNlICdlbmFiJzogcmVzdWx0LmVuYWJsZWQgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3VnbGcnOiByZXN1bHQudXNlR2xvYmFsTGlnaHQgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0FudEEnOiByZXN1bHQuYW50aWFsaWFzZWQgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0FsZ24nOiByZXN1bHQuYWxpZ24gPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0R0aHInOiByZXN1bHQuZGl0aGVyID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdJbnZyJzogcmVzdWx0LmludmVydCA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnUnZycyc6IHJlc3VsdC5yZXZlcnNlID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdDbHIgJzogcmVzdWx0LmNvbG9yID0gcGFyc2VDb2xvcih2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaGdsQyc6IHJlc3VsdC5oaWdobGlnaHRDb2xvciA9IHBhcnNlQ29sb3IodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3Nkd0MnOiByZXN1bHQuc2hhZG93Q29sb3IgPSBwYXJzZUNvbG9yKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdTdHlsJzogcmVzdWx0LnBvc2l0aW9uID0gRlN0bC5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ01kICAnOiByZXN1bHQuYmxlbmRNb2RlID0gQmxuTS5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2hnbE0nOiByZXN1bHQuaGlnaGxpZ2h0QmxlbmRNb2RlID0gQmxuTS5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3Nkd00nOiByZXN1bHQuc2hhZG93QmxlbmRNb2RlID0gQmxuTS5kZWNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2J2bFMnOiByZXN1bHQuc3R5bGUgPSBCRVNsLmRlY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYnZsRCc6IHJlc3VsdC5kaXJlY3Rpb24gPSBCRVNzLmRlY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnYnZsVCc6IHJlc3VsdC50ZWNobmlxdWUgPSBidmxULmRlY29kZSh2YWwpIGFzIGFueTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0dsd1QnOiByZXN1bHQudGVjaG5pcXVlID0gQkVURS5kZWNvZGUodmFsKSBhcyBhbnk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdnbHdTJzogcmVzdWx0LnNvdXJjZSA9IElHU3IuZGVjb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdUeXBlJzogcmVzdWx0LnR5cGUgPSBHcmRULmRlY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnT3BjdCc6IHJlc3VsdC5vcGFjaXR5ID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdoZ2xPJzogcmVzdWx0LmhpZ2hsaWdodE9wYWNpdHkgPSBwYXJzZVBlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3Nkd08nOiByZXN1bHQuc2hhZG93T3BhY2l0eSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnbGFnbCc6IHJlc3VsdC5hbmdsZSA9IHBhcnNlQW5nbGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0FuZ2wnOiByZXN1bHQuYW5nbGUgPSBwYXJzZUFuZ2xlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdMYWxkJzogcmVzdWx0LmFsdGl0dWRlID0gcGFyc2VBbmdsZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnU2Z0bic6IHJlc3VsdC5zb2Z0ZW4gPSBwYXJzZVVuaXRzKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzcmdSJzogcmVzdWx0LnN0cmVuZ3RoID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdibHVyJzogcmVzdWx0LnNpemUgPSBwYXJzZVVuaXRzKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdOb3NlJzogcmVzdWx0Lm5vaXNlID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdJbnByJzogcmVzdWx0LnJhbmdlID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdDa210JzogcmVzdWx0LmNob2tlID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnU2hkTic6IHJlc3VsdC5qaXR0ZXIgPSBwYXJzZVBlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0RzdG4nOiByZXN1bHQuZGlzdGFuY2UgPSBwYXJzZVVuaXRzKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdTY2wgJzogcmVzdWx0LnNjYWxlID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdQdHJuJzogcmVzdWx0LnBhdHRlcm4gPSB7IG5hbWU6IHZhbFsnTm0gICddLCBpZDogdmFsLklkbnQgfTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3BoYXNlJzogcmVzdWx0LnBoYXNlID0geyB4OiB2YWwuSHJ6biwgeTogdmFsLlZydGMgfTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ09mc3QnOiByZXN1bHQub2Zmc2V0ID0geyB4OiBwYXJzZVBlcmNlbnQodmFsLkhyem4pLCB5OiBwYXJzZVBlcmNlbnQodmFsLlZydGMpIH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdNcGdTJzpcclxuXHRcdFx0Y2FzZSAnVHJuUyc6XHJcblx0XHRcdFx0cmVzdWx0LmNvbnRvdXIgPSB7XHJcblx0XHRcdFx0XHRuYW1lOiB2YWxbJ05tICAnXSxcclxuXHRcdFx0XHRcdGN1cnZlOiAodmFsWydDcnYgJ10gYXMgYW55W10pLm1hcChwID0+ICh7IHg6IHAuSHJ6biwgeTogcC5WcnRjIH0pKSxcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRjYXNlICdHcmFkJzogcmVzdWx0LmdyYWRpZW50ID0gcGFyc2VHcmFkaWVudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAndXNlVGV4dHVyZSc6XHJcblx0XHRcdGNhc2UgJ3VzZVNoYXBlJzpcclxuXHRcdFx0Y2FzZSAnbGF5ZXJDb25jZWFscyc6XHJcblx0XHRcdGNhc2UgJ3ByZXNlbnQnOlxyXG5cdFx0XHRjYXNlICdzaG93SW5EaWFsb2cnOlxyXG5cdFx0XHRjYXNlICdhbnRpYWxpYXNHbG9zcyc6IHJlc3VsdFtrZXldID0gdmFsOyBicmVhaztcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRyZXBvcnRFcnJvcnMgJiYgY29uc29sZS5sb2coYEludmFsaWQgZWZmZWN0IGtleTogJyR7a2V5fSc6YCwgdmFsKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNlcmlhbGl6ZUVmZmVjdE9iamVjdChvYmo6IGFueSwgb2JqTmFtZTogc3RyaW5nLCByZXBvcnRFcnJvcnM6IGJvb2xlYW4pIHtcclxuXHRjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xyXG5cclxuXHRmb3IgKGNvbnN0IG9iaktleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XHJcblx0XHRjb25zdCBrZXk6IGtleW9mIEFsbEVmZmVjdHMgPSBvYmpLZXkgYXMgYW55O1xyXG5cdFx0Y29uc3QgdmFsID0gb2JqW2tleV07XHJcblxyXG5cdFx0c3dpdGNoIChrZXkpIHtcclxuXHRcdFx0Y2FzZSAnZW5hYmxlZCc6IHJlc3VsdC5lbmFiID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICd1c2VHbG9iYWxMaWdodCc6IHJlc3VsdC51Z2xnID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdhbnRpYWxpYXNlZCc6IHJlc3VsdC5BbnRBID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdhbGlnbic6IHJlc3VsdC5BbGduID0gISF2YWw7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdkaXRoZXInOiByZXN1bHQuRHRociA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaW52ZXJ0JzogcmVzdWx0LkludnIgPSAhIXZhbDsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3JldmVyc2UnOiByZXN1bHQuUnZycyA9ICEhdmFsOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnY29sb3InOiByZXN1bHRbJ0NsciAnXSA9IHNlcmlhbGl6ZUNvbG9yKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdoaWdobGlnaHRDb2xvcic6IHJlc3VsdC5oZ2xDID0gc2VyaWFsaXplQ29sb3IodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3NoYWRvd0NvbG9yJzogcmVzdWx0LnNkd0MgPSBzZXJpYWxpemVDb2xvcih2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAncG9zaXRpb24nOiByZXN1bHQuU3R5bCA9IEZTdGwuZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdibGVuZE1vZGUnOiByZXN1bHRbJ01kICAnXSA9IEJsbk0uZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdoaWdobGlnaHRCbGVuZE1vZGUnOiByZXN1bHQuaGdsTSA9IEJsbk0uZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzaGFkb3dCbGVuZE1vZGUnOiByZXN1bHQuc2R3TSA9IEJsbk0uZW5jb2RlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzdHlsZSc6IHJlc3VsdC5idmxTID0gQkVTbC5lbmNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2RpcmVjdGlvbic6IHJlc3VsdC5idmxEID0gQkVTcy5lbmNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3RlY2huaXF1ZSc6XHJcblx0XHRcdFx0aWYgKG9iak5hbWUgPT09ICdiZXZlbCcpIHtcclxuXHRcdFx0XHRcdHJlc3VsdC5idmxUID0gYnZsVC5lbmNvZGUodmFsKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0cmVzdWx0Lkdsd1QgPSBCRVRFLmVuY29kZSh2YWwpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnc291cmNlJzogcmVzdWx0Lmdsd1MgPSBJR1NyLmVuY29kZSh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAndHlwZSc6IHJlc3VsdC5UeXBlID0gR3JkVC5lbmNvZGUodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ29wYWNpdHknOiByZXN1bHQuT3BjdCA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnaGlnaGxpZ2h0T3BhY2l0eSc6IHJlc3VsdC5oZ2xPID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzaGFkb3dPcGFjaXR5JzogcmVzdWx0LnNkd08gPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ2FuZ2xlJzpcclxuXHRcdFx0XHRpZiAob2JqTmFtZSA9PT0gJ2dyYWRpZW50T3ZlcmxheScpIHtcclxuXHRcdFx0XHRcdHJlc3VsdC5BbmdsID0gdW5pdHNBbmdsZSh2YWwpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRyZXN1bHQubGFnbCA9IHVuaXRzQW5nbGUodmFsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ2FsdGl0dWRlJzogcmVzdWx0LkxhbGQgPSB1bml0c0FuZ2xlKHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdzb2Z0ZW4nOiByZXN1bHQuU2Z0biA9IHVuaXRzVmFsdWUodmFsLCBrZXkpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc3RyZW5ndGgnOiByZXN1bHQuc3JnUiA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc2l6ZSc6IHJlc3VsdC5ibHVyID0gdW5pdHNWYWx1ZSh2YWwsIGtleSk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdub2lzZSc6IHJlc3VsdC5Ob3NlID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdyYW5nZSc6IHJlc3VsdC5JbnByID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdjaG9rZSc6IHJlc3VsdC5Da210ID0gdW5pdHNWYWx1ZSh2YWwsIGtleSk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdqaXR0ZXInOiByZXN1bHQuU2hkTiA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnZGlzdGFuY2UnOiByZXN1bHQuRHN0biA9IHVuaXRzVmFsdWUodmFsLCBrZXkpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnc2NhbGUnOiByZXN1bHRbJ1NjbCAnXSA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAncGF0dGVybic6IHJlc3VsdC5QdHJuID0geyAnTm0gICc6IHZhbC5uYW1lLCBJZG50OiB2YWwuaWQgfTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ3BoYXNlJzogcmVzdWx0LnBoYXNlID0geyBIcnpuOiB2YWwueCwgVnJ0YzogdmFsLnkgfTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ29mZnNldCc6IHJlc3VsdC5PZnN0ID0geyBIcnpuOiB1bml0c1BlcmNlbnQodmFsLngpLCBWcnRjOiB1bml0c1BlcmNlbnQodmFsLnkpIH07IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdjb250b3VyJzoge1xyXG5cdFx0XHRcdHJlc3VsdFtvYmpOYW1lID09PSAnc2F0aW4nID8gJ01wZ1MnIDogJ1RyblMnXSA9IHtcclxuXHRcdFx0XHRcdCdObSAgJzogKHZhbCBhcyBFZmZlY3RDb250b3VyKS5uYW1lLFxyXG5cdFx0XHRcdFx0J0NydiAnOiAodmFsIGFzIEVmZmVjdENvbnRvdXIpLmN1cnZlLm1hcChwID0+ICh7IEhyem46IHAueCwgVnJ0YzogcC55IH0pKSxcclxuXHRcdFx0XHR9O1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNhc2UgJ2dyYWRpZW50JzogcmVzdWx0LkdyYWQgPSBzZXJpYWxpemVHcmFkaWVudCh2YWwpOyBicmVhaztcclxuXHRcdFx0Y2FzZSAndXNlVGV4dHVyZSc6XHJcblx0XHRcdGNhc2UgJ3VzZVNoYXBlJzpcclxuXHRcdFx0Y2FzZSAnbGF5ZXJDb25jZWFscyc6XHJcblx0XHRcdGNhc2UgJ3ByZXNlbnQnOlxyXG5cdFx0XHRjYXNlICdzaG93SW5EaWFsb2cnOlxyXG5cdFx0XHRjYXNlICdhbnRpYWxpYXNHbG9zcyc6XHJcblx0XHRcdFx0cmVzdWx0W2tleV0gPSB2YWw7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0cmVwb3J0RXJyb3JzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIGVmZmVjdCBrZXk6ICcke2tleX0nIHZhbHVlOmAsIHZhbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
