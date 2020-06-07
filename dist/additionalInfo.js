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
exports.ClrS = exports.infoHandlersMap = exports.infoHandlers = void 0;
var effectsHelpers_1 = require("./effectsHelpers");
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var descriptor_1 = require("./descriptor");
var engineData_1 = require("./engineData");
var text_1 = require("./text");
var base64_js_1 = require("base64-js");
var MOCK_HANDLERS = false;
exports.infoHandlers = [];
exports.infoHandlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    exports.infoHandlers.push(handler);
    exports.infoHandlersMap[handler.key] = handler;
}
function addHandlerAlias(key, target) {
    exports.infoHandlersMap[key] = exports.infoHandlersMap[target];
}
var textGridding = helpers_1.createEnum('textGridding', 'none', {
    none: 'None',
});
var Ornt = helpers_1.createEnum('Ornt', 'horizontal', {
    horizontal: 'Hrzn',
    vertical: 'Vrtc',
});
var Annt = helpers_1.createEnum('Annt', 'sharp', {
    none: 'Anno',
    sharp: 'antiAliasSharp',
    crisp: 'AnCr',
    strong: 'AnSt',
    smooth: 'AnSm',
});
var warpStyle = helpers_1.createEnum('warpStyle', 'none', {
    none: 'warpNone',
    arc: 'warpArc',
    arcLower: 'warpArcLower',
    arcUpper: 'warpArcUpper',
    arch: 'warpArch',
    bulge: 'warpBulge',
    shellLower: 'warpShellLower',
    shellUpper: 'warpShellUpper',
    flag: 'warpFlag',
    wave: 'warpWave',
    fish: 'warpFish',
    rise: 'warpRise',
    fisheye: 'warpFisheye',
    inflate: 'warpInflate',
    squeeze: 'warpSqueeze',
    twist: 'warpTwist',
});
var BlnM = helpers_1.createEnum('BlnM', 'normal', {
    'normal': 'Nrml',
    'dissolve': 'Dslv',
    'darken': 'Drkn',
    'multiply': 'Mltp',
    'color burn': 'CBrn',
    'linear burn': 'linearBurn',
    'darker color': 'darkerColor',
    'lighten': 'Lghn',
    'screen': 'Scrn',
    'color dodge': 'CDdg',
    'linear dodge': 'linearDodge',
    'lighter color': 'lighterColor',
    'overlay': 'Ovrl',
    'soft light': 'SftL',
    'hard light': 'HrdL',
    'vivid light': 'vividLight',
    'linear light': 'linearLight',
    'pin light': 'pinLight',
    'hard mix': 'hardMix',
    'difference': 'Dfrn',
    'exclusion': 'Xclu',
    'subtract': 'blendSubtraction',
    'divide': 'blendDivide',
    'hue': 'H   ',
    'saturation': 'Strt',
    'color': 'Clr ',
    'luminosity': 'Lmns',
});
var BESl = helpers_1.createEnum('BESl', 'inner bevel', {
    'inner bevel': 'InrB',
    'outer bevel': 'OtrB',
    'emboss': 'Embs',
    'pillow emboss': 'PlEb',
    'stroke emboss': 'strokeEmboss',
});
var bvlT = helpers_1.createEnum('bvlT', 'smooth', {
    'smooth': 'SfBL',
    'chisel hard': 'PrBL',
    'chisel soft': 'Slmt',
});
var BESs = helpers_1.createEnum('BESs', 'up', {
    up: 'In  ',
    down: 'Out ',
});
var BETE = helpers_1.createEnum('BETE', 'softer', {
    softer: 'SfBL',
    precise: 'PrBL',
});
var IGSr = helpers_1.createEnum('IGSr', 'edge', {
    edge: 'SrcE',
    center: 'SrcC',
});
var GrdT = helpers_1.createEnum('GrdT', 'linear', {
    linear: 'Lnr ',
    radial: 'Rdl ',
    angle: 'Angl',
    reflected: 'Rflc',
    diamond: 'Dmnd',
});
exports.ClrS = helpers_1.createEnum('ClrS', 'rgb', {
    rgb: 'RGBC',
    hsb: 'HSBl',
    lab: 'LbCl',
});
var FStl = helpers_1.createEnum('FStl', 'outside', {
    outside: 'OutF',
    center: 'CtrF',
    inside: 'InsF'
});
var FrFl = helpers_1.createEnum('FrFl', 'color', {
    color: 'SClr',
    gradient: 'GrFl',
    pattern: 'Ptrn',
});
var strokeStyleLineCapType = helpers_1.createEnum('strokeStyleLineCapType', 'butt', {
    butt: 'strokeStyleButtCap',
    round: 'strokeStyleRoundCap',
    square: 'strokeStyleSquareCap',
});
var strokeStyleLineJoinType = helpers_1.createEnum('strokeStyleLineJoinType', 'miter', {
    miter: 'strokeStyleMiterJoin',
    round: 'strokeStyleRoundJoin',
    bevel: 'strokeStyleBevelJoin',
});
var strokeStyleLineAlignment = helpers_1.createEnum('strokeStyleLineAlignment', 'inside', {
    inside: 'strokeStyleAlignInside',
    center: 'strokeStyleAlignCenter',
    outside: 'strokeStyleAlignOutside',
});
function hasKey(key) {
    return function (target) { return target[key] !== undefined; };
}
addHandler('TySh', hasKey('text'), function (reader, target, leftBytes) {
    if (psdReader_1.readInt16(reader) !== 1)
        throw new Error("Invalid TySh version");
    var transform = [];
    for (var i = 0; i < 6; i++)
        transform.push(psdReader_1.readFloat64(reader));
    if (psdReader_1.readInt16(reader) !== 50)
        throw new Error("Invalid TySh text version");
    var text = descriptor_1.readVersionAndDescriptor(reader);
    if (psdReader_1.readInt16(reader) !== 1)
        throw new Error("Invalid TySh warp version");
    var warp = descriptor_1.readVersionAndDescriptor(reader);
    target.text = {
        transform: transform,
        left: psdReader_1.readFloat32(reader),
        top: psdReader_1.readFloat32(reader),
        right: psdReader_1.readFloat32(reader),
        bottom: psdReader_1.readFloat32(reader),
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
        var engineData = text_1.decodeEngineData(engineData_1.parseEngineData(text.EngineData));
        // const before = parseEngineData(text.EngineData);
        // const after = encodeEngineData(engineData);
        // require('fs').writeFileSync('before.txt', require('util').inspect(before, false, 99, false), 'utf8');
        // require('fs').writeFileSync('after.txt', require('util').inspect(after, false, 99, false), 'utf8');
        // console.log(require('util').inspect(parseEngineData(text.EngineData), false, 99, true));
        target.text = __assign(__assign({}, target.text), engineData);
        // console.log(require('util').inspect(target.text, false, 99, true));
    }
    psdReader_1.skipBytes(reader, leftBytes());
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
        EngineData: engineData_1.serializeEngineData(text_1.encodeEngineData(text)),
    };
    var warpDescriptor = {
        warpStyle: warpStyle.encode(warp.style),
        warpValue: warp.value || 0,
        warpPerspective: warp.perspective || 0,
        warpPerspectiveOther: warp.perspectiveOther || 0,
        warpRotate: Ornt.encode(warp.rotate),
    };
    psdWriter_1.writeInt16(writer, 1); // version
    for (var i = 0; i < 6; i++) {
        psdWriter_1.writeFloat64(writer, transform[i]);
    }
    psdWriter_1.writeInt16(writer, 50); // text version
    descriptor_1.writeVersionAndDescriptor(writer, '', 'TxLr', textDescriptor);
    psdWriter_1.writeInt16(writer, 1); // warp version
    descriptor_1.writeVersionAndDescriptor(writer, '', 'warp', warpDescriptor);
    psdWriter_1.writeFloat32(writer, text.left);
    psdWriter_1.writeFloat32(writer, text.top);
    psdWriter_1.writeFloat32(writer, text.right);
    psdWriter_1.writeFloat32(writer, text.bottom);
    // writeZeros(writer, 2);
});
// vector fills
addHandler('SoCo', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    target.vectorFill.type === 'color'; }, function (reader, target) {
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('GdFl', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    (target.vectorFill.type === 'solid' || target.vectorFill.type === 'noise'); }, function (reader, target) {
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('PtFl', function (target) { return target.vectorFill !== undefined && target.vectorStroke === undefined &&
    target.vectorFill.type === 'pattern'; }, function (reader, target) {
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
}, function (writer, target) {
    var descriptor = serializeVectorContent(target.vectorFill).descriptor;
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
addHandler('vscg', function (target) { return target.vectorFill !== undefined && target.vectorStroke !== undefined; }, function (reader, target, left) {
    psdReader_1.readSignature(reader); // key
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.vectorFill = parseVectorContent(descriptor);
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var _a = serializeVectorContent(target.vectorFill), descriptor = _a.descriptor, key = _a.key;
    psdWriter_1.writeSignature(writer, key);
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', descriptor);
});
function readBezierKnot(reader, width, height) {
    var y0 = psdReader_1.readFixedPointPath32(reader) * height;
    var x0 = psdReader_1.readFixedPointPath32(reader) * width;
    var y1 = psdReader_1.readFixedPointPath32(reader) * height;
    var x1 = psdReader_1.readFixedPointPath32(reader) * width;
    var y2 = psdReader_1.readFixedPointPath32(reader) * height;
    var x2 = psdReader_1.readFixedPointPath32(reader) * width;
    return [x0, y0, x1, y1, x2, y2];
}
addHandler('vmsk', hasKey('vectorMask'), function (reader, target, left, _a) {
    var width = _a.width, height = _a.height;
    if (psdReader_1.readUint32(reader) !== 3)
        throw new Error('Invalid vmsk version');
    target.vectorMask = { paths: [] };
    var vectorMask = target.vectorMask;
    var flags = psdReader_1.readUint32(reader);
    vectorMask.invert = (flags & 1) !== 0;
    vectorMask.notLink = (flags & 2) !== 0;
    vectorMask.disable = (flags & 4) !== 0;
    var paths = vectorMask.paths;
    var path = undefined;
    while (left() >= 26) {
        var selector = psdReader_1.readUint16(reader);
        switch (selector) {
            case 0: // Closed subpath length record
                psdReader_1.readUint16(reader); // count
                psdReader_1.skipBytes(reader, 22);
                path = { open: false, knots: [] };
                paths.push(path);
                break;
            case 1: // Closed subpath Bezier knot, linked
            case 4: // Open subpath Bezier knot, linked
                path.knots.push({ linked: true, points: readBezierKnot(reader, width, height) });
                break;
            case 2: // Closed subpath Bezier knot, unlinked
            case 5: // Open subpath Bezier knot, unlinked
                path.knots.push({ linked: false, points: readBezierKnot(reader, width, height) });
                break;
            case 3: // Open subpath length record
                psdReader_1.readUint16(reader); // count
                psdReader_1.skipBytes(reader, 22);
                path = { open: true, knots: [] };
                paths.push(path);
                break;
            case 6: // Path fill rule record
                psdReader_1.skipBytes(reader, 24);
                break;
            case 7: { // Clipboard record
                // TODO: check if these need to be multiplied by document size
                var top_1 = psdReader_1.readFixedPointPath32(reader);
                var left_1 = psdReader_1.readFixedPointPath32(reader);
                var bottom = psdReader_1.readFixedPointPath32(reader);
                var right = psdReader_1.readFixedPointPath32(reader);
                var resolution = psdReader_1.readFixedPointPath32(reader);
                psdReader_1.skipBytes(reader, 4);
                vectorMask.clipboard = { top: top_1, left: left_1, bottom: bottom, right: right, resolution: resolution };
                break;
            }
            case 8: // Initial fill rule record
                vectorMask.fillStartsWithAllPixels = !!psdReader_1.readUint16(reader);
                psdReader_1.skipBytes(reader, 22);
                break;
            default: throw new Error('Invalid vmsk section');
        }
    }
    psdReader_1.skipBytes(reader, left());
}, function (writer, target, _a) {
    var width = _a.width, height = _a.height;
    var vectorMask = target.vectorMask;
    var flags = (vectorMask.invert ? 1 : 0) |
        (vectorMask.notLink ? 2 : 0) |
        (vectorMask.disable ? 4 : 0);
    psdWriter_1.writeUint32(writer, 3); // version
    psdWriter_1.writeUint32(writer, flags);
    // initial entry
    psdWriter_1.writeUint16(writer, 6);
    psdWriter_1.writeZeros(writer, 24);
    var clipboard = vectorMask.clipboard;
    if (clipboard) {
        psdWriter_1.writeUint16(writer, 7);
        psdWriter_1.writeFixedPointPath32(writer, clipboard.top);
        psdWriter_1.writeFixedPointPath32(writer, clipboard.left);
        psdWriter_1.writeFixedPointPath32(writer, clipboard.bottom);
        psdWriter_1.writeFixedPointPath32(writer, clipboard.right);
        psdWriter_1.writeFixedPointPath32(writer, clipboard.resolution);
        psdWriter_1.writeZeros(writer, 4);
    }
    if (vectorMask.fillStartsWithAllPixels !== undefined) {
        psdWriter_1.writeUint16(writer, 8);
        psdWriter_1.writeUint16(writer, vectorMask.fillStartsWithAllPixels ? 1 : 0);
        psdWriter_1.writeZeros(writer, 22);
    }
    for (var _i = 0, _b = vectorMask.paths; _i < _b.length; _i++) {
        var path = _b[_i];
        psdWriter_1.writeUint16(writer, path.open ? 3 : 0);
        psdWriter_1.writeUint16(writer, path.knots.length);
        psdWriter_1.writeUint16(writer, 1);
        psdWriter_1.writeUint16(writer, 1);
        psdWriter_1.writeZeros(writer, 18);
        var linkedKnot = path.open ? 4 : 1;
        var unlinkedKnot = path.open ? 5 : 2;
        for (var _c = 0, _d = path.knots; _c < _d.length; _c++) {
            var _e = _d[_c], linked = _e.linked, points = _e.points;
            psdWriter_1.writeUint16(writer, linked ? linkedKnot : unlinkedKnot);
            psdWriter_1.writeFixedPointPath32(writer, points[1] / width); // y0
            psdWriter_1.writeFixedPointPath32(writer, points[0] / height); // x0
            psdWriter_1.writeFixedPointPath32(writer, points[3] / width); // y1
            psdWriter_1.writeFixedPointPath32(writer, points[2] / height); // x1
            psdWriter_1.writeFixedPointPath32(writer, points[5] / width); // y2
            psdWriter_1.writeFixedPointPath32(writer, points[4] / height); // x2
        }
    }
});
// TODO: need to write vmsk if has outline ?
addHandlerAlias('vsms', 'vmsk');
addHandler('luni', hasKey('name'), function (reader, target, left) {
    target.name = psdReader_1.readUnicodeString(reader);
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    psdWriter_1.writeUnicodeString(writer, target.name);
    // writeUint16(writer, 0); // padding (but not extending string length)
});
addHandler('lnsr', hasKey('nameSource'), function (reader, target) { return target.nameSource = psdReader_1.readSignature(reader); }, function (writer, target) { return psdWriter_1.writeSignature(writer, target.nameSource); });
addHandler('lyid', hasKey('id'), function (reader, target) { return target.id = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.id); });
addHandler('clbl', hasKey('blendClippendElements'), function (reader, target) {
    target.blendClippendElements = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.blendClippendElements ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('infx', hasKey('blendInteriorElements'), function (reader, target) {
    target.blendInteriorElements = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.blendInteriorElements ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('knko', hasKey('knockout'), function (reader, target) {
    target.knockout = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.knockout ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('lspf', hasKey('protected'), function (reader, target) {
    var flags = psdReader_1.readUint32(reader);
    target.protected = {
        transparency: (flags & 0x01) !== 0,
        composite: (flags & 0x02) !== 0,
        position: (flags & 0x04) !== 0,
    };
}, function (writer, target) {
    var flags = (target.protected.transparency ? 0x01 : 0) |
        (target.protected.composite ? 0x02 : 0) |
        (target.protected.position ? 0x04 : 0);
    psdWriter_1.writeUint32(writer, flags);
});
addHandler('lclr', hasKey('layerColor'), function (reader, target) {
    var color = psdReader_1.readUint16(reader);
    psdReader_1.skipBytes(reader, 6);
    target.layerColor = helpers_1.layerColors[color];
}, function (writer, target) {
    var index = helpers_1.layerColors.indexOf(target.layerColor);
    psdWriter_1.writeUint16(writer, index === -1 ? 0 : index);
    psdWriter_1.writeZeros(writer, 6);
});
addHandler('shmd', hasKey('timestamp'), function (reader, target, left, _, options) {
    var count = psdReader_1.readUint32(reader);
    var _loop_1 = function (i) {
        psdReader_1.checkSignature(reader, '8BIM');
        var key = psdReader_1.readSignature(reader);
        psdReader_1.readUint8(reader); // copy
        psdReader_1.skipBytes(reader, 3);
        psdReader_1.readSection(reader, 1, function (left) {
            if (key === 'cust') {
                var desc = descriptor_1.readVersionAndDescriptor(reader);
                if (desc.layerTime !== undefined)
                    target.timestamp = desc.layerTime;
            }
            else if (key === 'mlst') {
                var desc = descriptor_1.readVersionAndDescriptor(reader);
                options.logDevFeatures && console.log('mlst', desc);
                // options.logDevFeatures && console.log('mlst', require('util').inspect(desc, false, 99, true));
            }
            else if (key === 'mdyn') {
                // frame flags
                var unknown = psdReader_1.readUint16(reader);
                var propagate = psdReader_1.readUint8(reader);
                var flags = psdReader_1.readUint8(reader);
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
            psdReader_1.skipBytes(reader, left());
        });
    };
    for (var i = 0; i < count; i++) {
        _loop_1(i);
    }
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var desc = {
        layerTime: target.timestamp,
    };
    psdWriter_1.writeUint32(writer, 1); // count
    psdWriter_1.writeSignature(writer, '8BIM');
    psdWriter_1.writeSignature(writer, 'cust');
    psdWriter_1.writeUint8(writer, 0); // copy (always false)
    psdWriter_1.writeZeros(writer, 3);
    psdWriter_1.writeSection(writer, 2, function () { return descriptor_1.writeVersionAndDescriptor(writer, '', 'metadata', desc); });
});
addHandler('sn2P', hasKey('usingAlignedRendering'), function (reader, target) { return target.usingAlignedRendering = !!psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.usingAlignedRendering ? 1 : 0); });
addHandler('fxrp', hasKey('referencePoint'), function (reader, target) {
    target.referencePoint = {
        x: psdReader_1.readFloat64(reader),
        y: psdReader_1.readFloat64(reader),
    };
}, function (writer, target) {
    psdWriter_1.writeFloat64(writer, target.referencePoint.x);
    psdWriter_1.writeFloat64(writer, target.referencePoint.y);
});
addHandler('lsct', hasKey('sectionDivider'), function (reader, target, left) {
    target.sectionDivider = { type: psdReader_1.readUint32(reader) };
    if (left()) {
        psdReader_1.checkSignature(reader, '8BIM');
        target.sectionDivider.key = psdReader_1.readSignature(reader);
    }
    if (left()) {
        // 0 = normal
        // 1 = scene group, affects the animation timeline.
        target.sectionDivider.subType = psdReader_1.readUint32(reader);
    }
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.sectionDivider.type);
    if (target.sectionDivider.key) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, target.sectionDivider.key);
        if (target.sectionDivider.subType !== undefined) {
            psdWriter_1.writeUint32(writer, target.sectionDivider.subType);
        }
    }
});
MOCK_HANDLERS && addHandler('Patt', function (target) { return 'children' in target; }, // (target as any)._Patt !== undefined,
function (reader, target, left) {
    console.log('additional info: Patt');
    target._Patt = psdReader_1.readBytes(reader, left());
}, function (writer, target) { return false && psdWriter_1.writeBytes(writer, target._Patt); });
addHandler('Patt', // TODO: handle also Pat2 & Pat3
function (// TODO: handle also Pat2 & Pat3
target) { return !target; }, function (reader, _target, left) {
    if (!left())
        return;
    psdReader_1.skipBytes(reader, left());
    return; // not supported yet
    /*
    const length = readUint32(reader);
    const version = readUint32(reader);

    if (version !== 1) throw new Error(`Invalid Patt version: ${version}`);

    const colorMode = readUint32(reader) as ColorMode;
    const x = readInt16(reader);
    const y = readInt16(reader);

    if (supportedColorModes.indexOf(colorMode) == -1) {
        throw new Error(`Invalid Patt color mode: ${colorMode}`);
    }

    const name = readUnicodeString(reader);
    const id = readPascalString(reader, 1);

    // TODO: index color table here (only for indexed color mode, not supported right now)
    console.log('patt', length, colorMode, x, y, name, id);

    // virtual memory array list
    {
        const version = readUint32(reader);

        if (version !== 3) throw new Error(`Invalid Patt:VMAL version: ${version}`);

        const length = readUint32(reader);
        const top = readUint32(reader);
        const left = readUint32(reader);
        const bottom = readUint32(reader);
        const right = readUint32(reader);
        const channels = readUint32(reader);

        console.log('VMAL', length, top, left, bottom, right, channels);

        for (let i = 0; i < (channels + 2); i++) {
            const has = readUint32(reader);

            if (has) {
                const length = readUint32(reader);
                const pixelDepth = readUint32(reader);
                const top = readUint32(reader);
                const left = readUint32(reader);
                const bottom = readUint32(reader);
                const right = readUint32(reader);
                const pixelDepth2 = readUint16(reader);
                const compressionMode = readUint8(reader); // 1 - zip

                // TODO: decompress data ...

                skipBytes(reader, length - (4 + 16 + 2 + 1));

                console.log('channel', length, pixelDepth, top, left, bottom, right, pixelDepth2, compressionMode);
            } else {
                console.log('SKIP');
            }
        }
    }

    if (!target.patterns) target.patterns = [];

    target.patterns.push({ name, id, colorMode, x, y });

    skipBytes(reader, left());
    */
}, function (_writer, _target) {
});
addHandler('pths', hasKey('pathList'), function (reader, target) {
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.pathList = []; // TODO: read paths (find example with non-empty list)
    descriptor;
    // console.log('pths', descriptor); // TODO: remove this
}, function (writer, _target) {
    var descriptor = {
        pathList: [],
    };
    descriptor_1.writeVersionAndDescriptor(writer, '', 'pathsDataClass', descriptor);
});
addHandler('lyvr', hasKey('version'), function (reader, target) { return target.version = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.version); });
addHandler('lrFX', hasKey('effects'), function (reader, target, left) {
    if (!target.effects) {
        target.effects = effectsHelpers_1.readEffects(reader);
    }
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    effectsHelpers_1.writeEffects(writer, target.effects);
});
function adjustmentType(type) {
    return function (target) { return !!target.adjustment && target.adjustment.type === type; };
}
addHandler('brit', adjustmentType('brightness/contrast'), function (reader, target, left) {
    if (!target.adjustment) { // ignore if got one from CgEd block
        target.adjustment = {
            type: 'brightness/contrast',
            brightness: psdReader_1.readInt16(reader),
            contrast: psdReader_1.readInt16(reader),
            meanValue: psdReader_1.readInt16(reader),
            labColorOnly: !!psdReader_1.readUint8(reader),
            useLegacy: true,
        };
    }
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    psdWriter_1.writeInt16(writer, info.brightness || 0);
    psdWriter_1.writeInt16(writer, info.contrast || 0);
    psdWriter_1.writeInt16(writer, (_a = info.meanValue) !== null && _a !== void 0 ? _a : 127);
    psdWriter_1.writeUint8(writer, info.labColorOnly ? 1 : 0);
    psdWriter_1.writeZeros(writer, 1);
});
function readLevelsChannel(reader) {
    var shadowInput = psdReader_1.readInt16(reader);
    var highlightInput = psdReader_1.readInt16(reader);
    var shadowOutput = psdReader_1.readInt16(reader);
    var highlightOutput = psdReader_1.readInt16(reader);
    var midtoneInput = psdReader_1.readInt16(reader) / 100;
    return { shadowInput: shadowInput, highlightInput: highlightInput, shadowOutput: shadowOutput, highlightOutput: highlightOutput, midtoneInput: midtoneInput };
}
function writeLevelsChannel(writer, channel) {
    psdWriter_1.writeInt16(writer, channel.shadowInput);
    psdWriter_1.writeInt16(writer, channel.highlightInput);
    psdWriter_1.writeInt16(writer, channel.shadowOutput);
    psdWriter_1.writeInt16(writer, channel.highlightOutput);
    psdWriter_1.writeInt16(writer, Math.round(channel.midtoneInput * 100));
}
addHandler('levl', adjustmentType('levels'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 2)
        throw new Error('Invalid levl version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'levels', rgb: readLevelsChannel(reader), red: readLevelsChannel(reader), green: readLevelsChannel(reader), blue: readLevelsChannel(reader) });
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var defaultChannel = {
        shadowInput: 0,
        highlightInput: 255,
        shadowOutput: 0,
        highlightOutput: 255,
        midtoneInput: 1,
    };
    psdWriter_1.writeUint16(writer, 2); // version
    writeLevelsChannel(writer, info.rgb || defaultChannel);
    writeLevelsChannel(writer, info.red || defaultChannel);
    writeLevelsChannel(writer, info.blue || defaultChannel);
    writeLevelsChannel(writer, info.green || defaultChannel);
    for (var i = 0; i < 59; i++)
        writeLevelsChannel(writer, defaultChannel);
});
function readCurveChannel(reader) {
    var nodes = psdReader_1.readUint16(reader);
    var channel = [];
    for (var j = 0; j < nodes; j++) {
        var output = psdReader_1.readInt16(reader);
        var input = psdReader_1.readInt16(reader);
        channel.push({ input: input, output: output });
    }
    return channel;
}
function writeCurveChannel(writer, channel) {
    psdWriter_1.writeUint16(writer, channel.length);
    for (var _i = 0, channel_1 = channel; _i < channel_1.length; _i++) {
        var n = channel_1[_i];
        psdWriter_1.writeUint16(writer, n.output);
        psdWriter_1.writeUint16(writer, n.input);
    }
}
addHandler('curv', adjustmentType('curves'), function (reader, target, left) {
    psdReader_1.readUint8(reader);
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid curv version');
    psdReader_1.readUint16(reader);
    var channels = psdReader_1.readUint16(reader);
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
    psdReader_1.skipBytes(reader, left());
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
    psdWriter_1.writeUint8(writer, 0);
    psdWriter_1.writeUint16(writer, 1); // version
    psdWriter_1.writeUint16(writer, 0);
    psdWriter_1.writeUint16(writer, channels);
    if (rgb && rgb.length)
        writeCurveChannel(writer, rgb);
    if (red && red.length)
        writeCurveChannel(writer, red);
    if (green && green.length)
        writeCurveChannel(writer, green);
    if (blue && blue.length)
        writeCurveChannel(writer, blue);
    psdWriter_1.writeSignature(writer, 'Crv ');
    psdWriter_1.writeUint16(writer, 4); // version
    psdWriter_1.writeUint16(writer, 0);
    psdWriter_1.writeUint16(writer, channelCount);
    if (rgb && rgb.length) {
        psdWriter_1.writeUint16(writer, 0);
        writeCurveChannel(writer, rgb);
    }
    if (red && red.length) {
        psdWriter_1.writeUint16(writer, 1);
        writeCurveChannel(writer, red);
    }
    if (green && green.length) {
        psdWriter_1.writeUint16(writer, 2);
        writeCurveChannel(writer, green);
    }
    if (blue && blue.length) {
        psdWriter_1.writeUint16(writer, 3);
        writeCurveChannel(writer, blue);
    }
    psdWriter_1.writeZeros(writer, 2);
});
addHandler('expA', adjustmentType('exposure'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid expA version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'exposure', exposure: psdReader_1.readFloat32(reader), offset: psdReader_1.readFloat32(reader), gamma: psdReader_1.readFloat32(reader) });
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, 1); // version
    psdWriter_1.writeFloat32(writer, info.exposure);
    psdWriter_1.writeFloat32(writer, info.offset);
    psdWriter_1.writeFloat32(writer, info.gamma);
    psdWriter_1.writeZeros(writer, 2);
});
addHandler('vibA', adjustmentType('vibrance'), function (reader, target, left) {
    var desc = descriptor_1.readVersionAndDescriptor(reader);
    target.adjustment = { type: 'vibrance' };
    if (desc.vibrance !== undefined)
        target.adjustment.vibrance = desc.vibrance;
    if (desc.Strt !== undefined)
        target.adjustment.saturation = desc.Strt;
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    var desc = {};
    if (info.vibrance !== undefined)
        desc.vibrance = info.vibrance;
    if (info.saturation !== undefined)
        desc.Strt = info.saturation;
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
});
function readHueChannel(reader) {
    return {
        a: psdReader_1.readInt16(reader),
        b: psdReader_1.readInt16(reader),
        c: psdReader_1.readInt16(reader),
        d: psdReader_1.readInt16(reader),
        hue: psdReader_1.readInt16(reader),
        saturation: psdReader_1.readInt16(reader),
        lightness: psdReader_1.readInt16(reader),
    };
}
function writeHueChannel(writer, channel) {
    var c = channel || {};
    psdWriter_1.writeInt16(writer, c.a || 0);
    psdWriter_1.writeInt16(writer, c.b || 0);
    psdWriter_1.writeInt16(writer, c.c || 0);
    psdWriter_1.writeInt16(writer, c.d || 0);
    psdWriter_1.writeInt16(writer, c.hue || 0);
    psdWriter_1.writeInt16(writer, c.saturation || 0);
    psdWriter_1.writeInt16(writer, c.lightness || 0);
}
addHandler('hue2', adjustmentType('hue/saturation'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 2)
        throw new Error('Invalid hue2 version');
    target.adjustment = __assign(__assign({}, target.adjustment), { type: 'hue/saturation', master: readHueChannel(reader), reds: readHueChannel(reader), yellows: readHueChannel(reader), greens: readHueChannel(reader), cyans: readHueChannel(reader), blues: readHueChannel(reader), magentas: readHueChannel(reader) });
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, 2); // version
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
        cyanRed: psdReader_1.readInt16(reader),
        magentaGreen: psdReader_1.readInt16(reader),
        yellowBlue: psdReader_1.readInt16(reader),
    };
}
function writeColorBalance(writer, value) {
    psdWriter_1.writeInt16(writer, value.cyanRed || 0);
    psdWriter_1.writeInt16(writer, value.magentaGreen || 0);
    psdWriter_1.writeInt16(writer, value.yellowBlue || 0);
}
addHandler('blnc', adjustmentType('color balance'), function (reader, target, left) {
    target.adjustment = {
        type: 'color balance',
        shadows: readColorBalance(reader),
        midtones: readColorBalance(reader),
        highlights: readColorBalance(reader),
        preserveLuminosity: !!psdReader_1.readUint8(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    writeColorBalance(writer, info.shadows || {});
    writeColorBalance(writer, info.midtones || {});
    writeColorBalance(writer, info.highlights || {});
    psdWriter_1.writeUint8(writer, info.preserveLuminosity ? 1 : 0);
    psdWriter_1.writeZeros(writer, 1);
});
addHandler('blwh', adjustmentType('black & white'), function (reader, target, left) {
    var desc = descriptor_1.readVersionAndDescriptor(reader);
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
    psdReader_1.skipBytes(reader, left());
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
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('phfl', adjustmentType('photo filter'), function (reader, target, left) {
    var version = psdReader_1.readUint16(reader);
    if (version !== 2 && version !== 3)
        throw new Error('Invalid phfl version');
    var color;
    if (version === 2) {
        color = psdReader_1.readColor(reader);
    }
    else { // version 3
        // TODO: test this, this is probably wrong
        color = {
            l: psdReader_1.readInt32(reader) / 100,
            a: psdReader_1.readInt32(reader) / 100,
            b: psdReader_1.readInt32(reader) / 100,
        };
    }
    target.adjustment = {
        type: 'photo filter',
        color: color,
        density: psdReader_1.readUint32(reader) / 100,
        preserveLuminosity: !!psdReader_1.readUint8(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, 2); // version
    psdWriter_1.writeColor(writer, info.color || { l: 0, a: 0, b: 0 });
    psdWriter_1.writeUint32(writer, (info.density || 0) * 100);
    psdWriter_1.writeUint8(writer, info.preserveLuminosity ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
function readMixrChannel(reader) {
    var red = psdReader_1.readInt16(reader);
    var green = psdReader_1.readInt16(reader);
    var blue = psdReader_1.readInt16(reader);
    psdReader_1.skipBytes(reader, 2);
    var constant = psdReader_1.readInt16(reader);
    return { red: red, green: green, blue: blue, constant: constant };
}
function writeMixrChannel(writer, channel) {
    var c = channel || {};
    psdWriter_1.writeInt16(writer, c.red);
    psdWriter_1.writeInt16(writer, c.green);
    psdWriter_1.writeInt16(writer, c.blue);
    psdWriter_1.writeZeros(writer, 2);
    psdWriter_1.writeInt16(writer, c.constant);
}
addHandler('mixr', adjustmentType('channel mixer'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid mixr version');
    var adjustment = target.adjustment = __assign(__assign({}, target.adjustment), { type: 'channel mixer', monochrome: !!psdReader_1.readUint16(reader) });
    if (!adjustment.monochrome) {
        adjustment.red = readMixrChannel(reader);
        adjustment.green = readMixrChannel(reader);
        adjustment.blue = readMixrChannel(reader);
    }
    adjustment.gray = readMixrChannel(reader);
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, 1); // version
    psdWriter_1.writeUint16(writer, info.monochrome ? 1 : 0);
    if (info.monochrome) {
        writeMixrChannel(writer, info.gray);
        psdWriter_1.writeZeros(writer, 3 * 5 * 2);
    }
    else {
        writeMixrChannel(writer, info.red);
        writeMixrChannel(writer, info.green);
        writeMixrChannel(writer, info.blue);
        writeMixrChannel(writer, info.gray);
    }
});
var colorLookupType = helpers_1.createEnum('colorLookupType', '3DLUT', {
    '3dlut': '3DLUT',
    abstractProfile: 'abstractProfile',
    deviceLinkProfile: 'deviceLinkProfile',
});
var LUTFormatType = helpers_1.createEnum('LUTFormatType', 'look', {
    look: 'LUTFormatLOOK',
    cube: 'LUTFormatCUBE',
    '3dl': 'LUTFormat3DL',
});
var colorLookupOrder = helpers_1.createEnum('colorLookupOrder', 'rgb', {
    rgb: 'rgbOrder',
    bgr: 'bgrOrder',
});
addHandler('clrL', adjustmentType('color lookup'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid clrL version');
    var desc = descriptor_1.readVersionAndDescriptor(reader);
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
    psdReader_1.skipBytes(reader, left());
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
    psdWriter_1.writeUint16(writer, 1); // version
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
});
addHandler('nvrt', adjustmentType('invert'), function (reader, target, left) {
    target.adjustment = { type: 'invert' };
    psdReader_1.skipBytes(reader, left());
}, function () {
    // nothing to write here
});
addHandler('post', adjustmentType('posterize'), function (reader, target, left) {
    target.adjustment = {
        type: 'posterize',
        levels: psdReader_1.readUint16(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, (_a = info.levels) !== null && _a !== void 0 ? _a : 4);
    psdWriter_1.writeZeros(writer, 2);
});
addHandler('thrs', adjustmentType('threshold'), function (reader, target, left) {
    target.adjustment = {
        type: 'threshold',
        level: psdReader_1.readUint16(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var _a;
    var info = target.adjustment;
    psdWriter_1.writeUint16(writer, (_a = info.level) !== null && _a !== void 0 ? _a : 128);
    psdWriter_1.writeZeros(writer, 2);
});
var grdmColorModels = ['', '', '', 'rgb', 'hsb', '', 'lab'];
addHandler('grdm', adjustmentType('gradient map'), function (reader, target, left) {
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid grdm version');
    var info = {
        type: 'gradient map',
        gradientType: 'solid',
    };
    info.reverse = !!psdReader_1.readUint8(reader);
    info.dither = !!psdReader_1.readUint8(reader);
    info.name = psdReader_1.readUnicodeString(reader);
    info.colorStops = [];
    info.opacityStops = [];
    var stopsCount = psdReader_1.readUint16(reader);
    for (var i = 0; i < stopsCount; i++) {
        info.colorStops.push({
            location: psdReader_1.readUint32(reader),
            midpoint: psdReader_1.readUint32(reader) / 100,
            color: psdReader_1.readColor(reader),
        });
        psdReader_1.skipBytes(reader, 2);
    }
    var opacityStopsCount = psdReader_1.readUint16(reader);
    for (var i = 0; i < opacityStopsCount; i++) {
        info.opacityStops.push({
            location: psdReader_1.readUint32(reader),
            midpoint: psdReader_1.readUint32(reader) / 100,
            opacity: psdReader_1.readUint16(reader) / 0xff,
        });
    }
    var expansionCount = psdReader_1.readUint16(reader);
    if (expansionCount !== 2)
        throw new Error('Invalid grdm expansion count');
    var interpolation = psdReader_1.readUint16(reader);
    info.smoothness = interpolation / 4096;
    var length = psdReader_1.readUint16(reader);
    if (length !== 32)
        throw new Error('Invalid grdm length');
    info.gradientType = psdReader_1.readUint16(reader) ? 'noise' : 'solid';
    info.randomSeed = psdReader_1.readUint32(reader);
    info.addTransparency = !!psdReader_1.readUint16(reader);
    info.restrictColors = !!psdReader_1.readUint16(reader);
    info.roughness = psdReader_1.readUint32(reader) / 4096;
    info.colorModel = (grdmColorModels[psdReader_1.readUint16(reader)] || 'rgb');
    info.min = [
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
    ];
    info.max = [
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
        psdReader_1.readUint16(reader) / 0x8000,
    ];
    psdReader_1.skipBytes(reader, left());
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
    psdWriter_1.writeUint16(writer, 1); // version
    psdWriter_1.writeUint8(writer, info.reverse ? 1 : 0);
    psdWriter_1.writeUint8(writer, info.dither ? 1 : 0);
    psdWriter_1.writeUnicodeStringWithPadding(writer, info.name || '');
    psdWriter_1.writeUint16(writer, info.colorStops && info.colorStops.length || 0);
    var interpolation = Math.round(((_a = info.smoothness) !== null && _a !== void 0 ? _a : 1) * 4096);
    for (var _i = 0, _d = info.colorStops || []; _i < _d.length; _i++) {
        var s = _d[_i];
        psdWriter_1.writeUint32(writer, Math.round(s.location * interpolation));
        psdWriter_1.writeUint32(writer, Math.round(s.midpoint * 100));
        psdWriter_1.writeColor(writer, s.color);
        psdWriter_1.writeZeros(writer, 2);
    }
    psdWriter_1.writeUint16(writer, info.opacityStops && info.opacityStops.length || 0);
    for (var _e = 0, _f = info.opacityStops || []; _e < _f.length; _e++) {
        var s = _f[_e];
        psdWriter_1.writeUint32(writer, Math.round(s.location * interpolation));
        psdWriter_1.writeUint32(writer, Math.round(s.midpoint * 100));
        psdWriter_1.writeUint16(writer, Math.round(s.opacity * 0xff));
    }
    psdWriter_1.writeUint16(writer, 2); // expansion count
    psdWriter_1.writeUint16(writer, interpolation);
    psdWriter_1.writeUint16(writer, 32); // length
    psdWriter_1.writeUint16(writer, info.gradientType === 'noise' ? 1 : 0);
    psdWriter_1.writeUint32(writer, info.randomSeed || 0);
    psdWriter_1.writeUint16(writer, info.addTransparency ? 1 : 0);
    psdWriter_1.writeUint16(writer, info.restrictColors ? 1 : 0);
    psdWriter_1.writeUint32(writer, Math.round(((_b = info.roughness) !== null && _b !== void 0 ? _b : 1) * 4096));
    var colorModel = grdmColorModels.indexOf((_c = info.colorModel) !== null && _c !== void 0 ? _c : 'rgb');
    psdWriter_1.writeUint16(writer, colorModel === -1 ? 3 : colorModel);
    for (var i = 0; i < 4; i++)
        psdWriter_1.writeUint16(writer, Math.round((info.min && info.min[i] || 0) * 0x8000));
    for (var i = 0; i < 4; i++)
        psdWriter_1.writeUint16(writer, Math.round((info.max && info.max[i] || 0) * 0x8000));
    psdWriter_1.writeZeros(writer, 4);
});
function readSelectiveColors(reader) {
    return {
        c: psdReader_1.readInt16(reader),
        m: psdReader_1.readInt16(reader),
        y: psdReader_1.readInt16(reader),
        k: psdReader_1.readInt16(reader),
    };
}
function writeSelectiveColors(writer, cmyk) {
    var c = cmyk || {};
    psdWriter_1.writeInt16(writer, c.c);
    psdWriter_1.writeInt16(writer, c.m);
    psdWriter_1.writeInt16(writer, c.y);
    psdWriter_1.writeInt16(writer, c.k);
}
addHandler('selc', adjustmentType('selective color'), function (reader, target) {
    if (psdReader_1.readUint16(reader) !== 1)
        throw new Error('Invalid selc version');
    var mode = psdReader_1.readUint16(reader) ? 'absolute' : 'relative';
    psdReader_1.skipBytes(reader, 8);
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
    psdWriter_1.writeUint16(writer, 1); // version
    psdWriter_1.writeUint16(writer, info.mode === 'absolute' ? 1 : 0);
    psdWriter_1.writeZeros(writer, 8);
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
    var desc = descriptor_1.readVersionAndDescriptor(reader);
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
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var _a, _b, _c, _d;
    var info = target.adjustment;
    if (info.type === 'levels' || info.type === 'exposure' || info.type === 'hue/saturation') {
        var desc = {
            Vrsn: 1,
            presetKind: (_a = info.presetKind) !== null && _a !== void 0 ? _a : 1,
            presetFileName: info.presetFileName || '',
        };
        descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else if (info.type === 'curves') {
        var desc = {
            Vrsn: 1,
            curvesPresetKind: (_b = info.presetKind) !== null && _b !== void 0 ? _b : 1,
            curvesPresetFileName: info.presetFileName || '',
        };
        descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else if (info.type === 'channel mixer') {
        var desc = {
            Vrsn: 1,
            mixerPresetKind: (_c = info.presetKind) !== null && _c !== void 0 ? _c : 1,
            mixerPresetFileName: info.presetFileName || '',
        };
        descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
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
        descriptor_1.writeVersionAndDescriptor(writer, '', 'null', desc);
    }
    else {
        throw new Error('Unhandled CgEd case');
    }
});
addHandler('Txt2', hasKey('engineData'), function (reader, target, left) {
    var data = psdReader_1.readBytes(reader, left());
    target.engineData = base64_js_1.fromByteArray(data);
    // const engineData = parseEngineData(data);
    // console.log(require('util').inspect(engineData, false, 99, true));
    // require('fs').writeFileSync('resources/engineData2Simple.txt', require('util').inspect(engineData, false, 99, false), 'utf8');
    // require('fs').writeFileSync('test_data.json', JSON.stringify(ed, null, 2), 'utf8');
}, function (writer, target) {
    var buffer = base64_js_1.toByteArray(target.engineData);
    psdWriter_1.writeBytes(writer, buffer);
});
addHandler('FMsk', hasKey('filterMask'), function (reader, target) {
    target.filterMask = {
        colorSpace: psdReader_1.readColor(reader),
        opacity: psdReader_1.readUint16(reader) / 0xff,
    };
}, function (writer, target) {
    var _a;
    psdWriter_1.writeColor(writer, target.filterMask.colorSpace);
    psdWriter_1.writeUint16(writer, helpers_1.clamp((_a = target.filterMask.opacity) !== null && _a !== void 0 ? _a : 1, 0, 1) * 0xff);
});
addHandler('vstk', hasKey('vectorStroke'), function (reader, target, left) {
    var descriptor = descriptor_1.readVersionAndDescriptor(reader);
    target.vectorStroke = {
        strokeEnabled: descriptor.strokeEnabled,
        fillEnabled: descriptor.fillEnabled,
        lineWidth: parseUnits(descriptor.strokeStyleLineWidth),
        lineDashOffset: parseUnits(descriptor.strokeStyleLineDashOffset),
        miterLimit: descriptor.strokeStyleMiterLimit,
        lineCapType: strokeStyleLineCapType.decode(descriptor.strokeStyleLineCapType),
        lineJoinType: strokeStyleLineJoinType.decode(descriptor.strokeStyleLineJoinType),
        lineAlignment: strokeStyleLineAlignment.decode(descriptor.strokeStyleLineAlignment),
        scaleLock: descriptor.strokeStyleScaleLock,
        strokeAdjust: descriptor.strokeStyleStrokeAdjust,
        lineDashSet: descriptor.strokeStyleLineDashSet.map(parseUnits),
        blendMode: BlnM.decode(descriptor.strokeStyleBlendMode),
        opacity: parsePercent(descriptor.strokeStyleOpacity),
        content: parseVectorContent(descriptor.strokeStyleContent),
        resolution: descriptor.strokeStyleResolution,
    };
    psdReader_1.skipBytes(reader, left());
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
    descriptor_1.writeVersionAndDescriptor(writer, '', 'strokeStyle', descriptor);
});
addHandler('lfx2', hasKey('effects'), function (reader, target, left, _, options) {
    var log = !!options.logMissingFeatures;
    var version = psdReader_1.readUint32(reader);
    if (version !== 0)
        throw new Error("Invalid lfx2 version");
    var info = descriptor_1.readVersionAndDescriptor(reader);
    target.effects = {}; // discard if read in 'lrFX' section
    var effects = target.effects;
    if (!info.masterFXSwitch)
        effects.disabled = true;
    if (info['Scl '])
        effects.scale = parsePercent(info['Scl ']);
    if (info.DrSh)
        effects.dropShadow = parseEffectObject(info.DrSh, log);
    if (info.IrSh)
        effects.innerShadow = parseEffectObject(info.IrSh, log);
    if (info.OrGl)
        effects.outerGlow = parseEffectObject(info.OrGl, log);
    if (info.IrGl)
        effects.innerGlow = parseEffectObject(info.IrGl, log);
    if (info.ebbl)
        effects.bevel = parseEffectObject(info.ebbl, log);
    if (info.SoFi)
        effects.solidFill = parseEffectObject(info.SoFi, log);
    if (info.patternFill)
        effects.patternOverlay = parseEffectObject(info.patternFill, log);
    if (info.GrFl)
        effects.gradientOverlay = parseEffectObject(info.GrFl, log);
    if (info.ChFX)
        effects.satin = parseEffectObject(info.ChFX, log);
    if (info.FrFX) {
        effects.stroke = {
            enabled: !!info.FrFX.enab,
            position: FStl.decode(info.FrFX.Styl),
            fillType: FrFl.decode(info.FrFX.PntT),
            blendMode: BlnM.decode(info.FrFX['Md  ']),
            opacity: parsePercent(info.FrFX.Opct),
            size: parseUnits(info.FrFX['Sz  ']),
        };
        if (info.FrFX['Clr '])
            effects.stroke.color = parseColor(info.FrFX['Clr ']);
        if (info.FrFX.Grad)
            effects.stroke.gradient = parseGradientContent(info.FrFX);
        if (info.FrFX.Ptrn)
            effects.stroke.pattern = parsePatternContent(info.FrFX);
    }
    psdReader_1.skipBytes(reader, left());
}, function (writer, target, _, options) {
    var _a;
    var log = !!options.logMissingFeatures;
    var effects = target.effects;
    var info = {
        masterFXSwitch: !effects.disabled,
        'Scl ': unitsPercent((_a = effects.scale) !== null && _a !== void 0 ? _a : 1),
    };
    if (effects.dropShadow)
        info.DrSh = serializeEffectObject(effects.dropShadow, 'dropShadow', log);
    if (effects.innerShadow)
        info.IrSh = serializeEffectObject(effects.innerShadow, 'innerShadow', log);
    if (effects.outerGlow)
        info.OrGl = serializeEffectObject(effects.outerGlow, 'outerGlow', log);
    if (effects.innerGlow)
        info.IrGl = serializeEffectObject(effects.innerGlow, 'innerGlow', log);
    if (effects.bevel)
        info.ebbl = serializeEffectObject(effects.bevel, 'bevel', log);
    if (effects.solidFill)
        info.SoFi = serializeEffectObject(effects.solidFill, 'solidFill', log);
    if (effects.patternOverlay)
        info.patternFill = serializeEffectObject(effects.patternOverlay, 'patternOverlay', log);
    if (effects.gradientOverlay)
        info.GrFl = serializeEffectObject(effects.gradientOverlay, 'gradientOverlay', log);
    if (effects.satin)
        info.ChFX = serializeEffectObject(effects.satin, 'satin', log);
    var stroke = effects.stroke;
    if (stroke) {
        info.FrFX = {
            enab: !!stroke.enabled,
            Styl: FStl.encode(stroke.position),
            PntT: FrFl.encode(stroke.fillType),
            'Md  ': BlnM.encode(stroke.blendMode),
            Opct: unitsPercent(stroke.opacity),
            'Sz  ': unitsValue(stroke.size, 'size'),
        };
        if (stroke.color)
            info.FrFX['Clr '] = serializeColor(stroke.color);
        if (stroke.gradient)
            info.FrFX = __assign(__assign({}, info.FrFX), serializeGradientContent(stroke.gradient));
        if (stroke.pattern)
            info.FrFX = __assign(__assign({}, info.FrFX), serializePatternContent(stroke.pattern));
    }
    psdWriter_1.writeUint32(writer, 0); // version
    descriptor_1.writeVersionAndDescriptor(writer, '', 'null', info);
});
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
            colorModel: exports.ClrS.decode(grad.ClrS),
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
            GrdF: 'GrdF.CstS',
            'Nm  ': grad.name,
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
            'Nm  ': grad.name,
            ShTr: !!grad.addTransparency,
            VctC: !!grad.restrictColors,
            ClrS: exports.ClrS.encode(grad.colorModel),
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
    var result = {
        Grad: serializeGradient(content),
        Type: GrdT.encode(content.style),
    };
    if (content.dither !== undefined)
        result.Dthr = content.dither;
    if (content.reverse !== undefined)
        result.Rvrs = content.reverse;
    if (content.angle !== undefined)
        result.Angl = unitsAngle(content.angle);
    if (content.scale !== undefined)
        result['Scl '] = unitsPercent(content.scale);
    if (content.align !== undefined)
        result.Algn = content.align;
    if (content.offset) {
        result.Ofst = {
            Hrzn: unitsPercent(content.offset.x),
            Vrtc: unitsPercent(content.offset.y),
        };
    }
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
function parseAngle(x) {
    if (x === undefined)
        return 0;
    if (x.units !== 'Angle')
        throw new Error("Invalid units: " + x.units);
    return x.value;
}
function parsePercent(x) {
    if (x === undefined)
        return 1;
    if (x.units !== 'Percent')
        throw new Error("Invalid units: " + x.units);
    return x.value / 100;
}
function parseUnits(_a) {
    var units = _a.units, value = _a.value;
    if (units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
        units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters') {
        throw new Error("Invalid units: " + JSON.stringify({ units: units, value: value }));
    }
    return { value: value, units: units };
}
function unitsAngle(value) {
    return { units: 'Angle', value: value || 0 };
}
function unitsPercent(value) {
    return { units: 'Percent', value: Math.round(helpers_1.clamp(value || 0, 0, 1) * 100) };
}
function unitsValue(x, key) {
    if (x == null)
        return { units: 'Pixels', value: 0 };
    if (typeof x !== 'object')
        throw new Error("Invalid value: " + JSON.stringify(x) + " (key: " + key + ") (should have value and units)");
    var units = x.units, value = x.value;
    if (typeof value !== 'number')
        throw new Error("Invalid value in " + JSON.stringify(x) + " (key: " + key + ")");
    if (units !== 'Pixels' && units !== 'Millimeters' && units !== 'Points' && units !== 'None' &&
        units !== 'Picas' && units !== 'Inches' && units !== 'Centimeters') {
        throw new Error("Invalid units in " + JSON.stringify(x) + " (key: " + key + ")");
    }
    return { units: units, value: value };
}
function parseColor(color) {
    if ('H   ' in color) {
        return { h: parsePercent(color['H   ']), s: color.Strt, b: color.Brgh };
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
        return { 'H   ': unitsPercent(color.h), Strt: color.s || 0, Brgh: color.b || 0 };
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
            case 'antialiasGloss':
                result[key] = val;
                break;
            default:
                reportErrors && console.log("Invalid effect key: '" + key + "' value:", val);
        }
    }
    return result;
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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VUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDbkQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDdEQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDckQsS0FBSyxNQUFNO2dCQUFFLE1BQU0sQ0FBQyxPQUFPLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQUMsTUFBTTtZQUN6RSxLQUFLLE9BQU87Z0JBQUUsTUFBTSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQUMsTUFBTTtZQUNqRSxLQUFLLE1BQU07Z0JBQUUsTUFBTSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUMsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JB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QyxFQUExQixDQUEwQixDQUFDO2lCQUN6RSxDQUFDO2dCQUNGLE1BQU07YUFDTjtZQUNELEtBQUssVUFBVTtnQkFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUFDLE1BQU07WUFDN0QsS0FBSyxZQUFZLENBQUM7WUFDbEIsS0FBSyxVQUFVLENBQUM7WUFDaEIsS0FBSyxlQUFlLENBQUM7WUFDckIsS0FBSyxnQkFBZ0I7Z0JBQ3BCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7Z0JBQ2xCLE1BQU07WUFDUDtnQkFDQyxZQUFZLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBd0IsR0FBRyxhQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDekU7S0FDRDtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQyIsImZpbGUiOiJhZGRpdGlvbmFsSW5mby5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRFZmZlY3RzLCB3cml0ZUVmZmVjdHMgfSBmcm9tICcuL2VmZmVjdHNIZWxwZXJzJztcbmltcG9ydCB7IGNsYW1wLCBjcmVhdGVFbnVtLCBsYXllckNvbG9ycyB9IGZyb20gJy4vaGVscGVycyc7XG5pbXBvcnQge1xuXHRMYXllckFkZGl0aW9uYWxJbmZvLCBUZXh0R3JpZGRpbmcsIE9yaWVudGF0aW9uLCBXYXJwU3R5bGUsIEFudGlBbGlhcywgQmV2ZWxTdHlsZSwgQmV2ZWxUZWNobmlxdWUsXG5cdExheWVyRWZmZWN0U2hhZG93LCBMYXllckVmZmVjdHNPdXRlckdsb3csIExheWVyRWZmZWN0SW5uZXJHbG93LCBMYXllckVmZmVjdEJldmVsLFxuXHRMYXllckVmZmVjdFNvbGlkRmlsbCwgQmV2ZWxEaXJlY3Rpb24sIEdsb3dUZWNobmlxdWUsIEdsb3dTb3VyY2UsIExheWVyRWZmZWN0UGF0dGVybk92ZXJsYXksXG5cdExheWVyRWZmZWN0R3JhZGllbnRPdmVybGF5LCBMYXllckVmZmVjdFNhdGluLCBHcmFkaWVudFN0eWxlLCBFZmZlY3RDb250b3VyLCBFZmZlY3RTb2xpZEdyYWRpZW50LFxuXHRFZmZlY3ROb2lzZUdyYWRpZW50LCBCZXppZXJQYXRoLCBQc2QsIEJsZW5kTW9kZSwgTGluZUNhcFR5cGUsIExpbmVKb2luVHlwZSwgTGluZUFsaWdubWVudCxcblx0VmVjdG9yQ29udGVudCwgVW5pdHNWYWx1ZSwgTGF5ZXJFZmZlY3RTdHJva2UsIEV4dHJhR3JhZGllbnRJbmZvLCBFZmZlY3RQYXR0ZXJuLFxuXHRFeHRyYVBhdHRlcm5JbmZvLCBSZWFkT3B0aW9ucywgQnJpZ2h0bmVzc0FkanVzdG1lbnQsIEV4cG9zdXJlQWRqdXN0bWVudCwgVmlicmFuY2VBZGp1c3RtZW50LFxuXHRDb2xvckJhbGFuY2VBZGp1c3RtZW50LCBCbGFja0FuZFdoaXRlQWRqdXN0bWVudCwgUGhvdG9GaWx0ZXJBZGp1c3RtZW50LCBDaGFubmVsTWl4ZXJDaGFubmVsLFxuXHRDaGFubmVsTWl4ZXJBZGp1c3RtZW50LCBQb3N0ZXJpemVBZGp1c3RtZW50LCBUaHJlc2hvbGRBZGp1c3RtZW50LCBHcmFkaWVudE1hcEFkanVzdG1lbnQsIENNWUssXG5cdFNlbGVjdGl2ZUNvbG9yQWRqdXN0bWVudCwgQ29sb3JMb29rdXBBZGp1c3RtZW50LCBMZXZlbHNBZGp1c3RtZW50Q2hhbm5lbCwgTGV2ZWxzQWRqdXN0bWVudCxcblx0Q3VydmVzQWRqdXN0bWVudCwgQ3VydmVzQWRqdXN0bWVudENoYW5uZWwsIEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50LCBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudENoYW5uZWwsXG5cdFByZXNldEluZm8sIENvbG9yLCBDb2xvckJhbGFuY2VWYWx1ZXMsIFdyaXRlT3B0aW9ucyxcbn0gZnJvbSAnLi9wc2QnO1xuaW1wb3J0IHtcblx0UHNkUmVhZGVyLCByZWFkU2lnbmF0dXJlLCByZWFkVW5pY29kZVN0cmluZywgc2tpcEJ5dGVzLCByZWFkVWludDMyLCByZWFkVWludDgsIHJlYWRGbG9hdDY0LCByZWFkVWludDE2LFxuXHRyZWFkQnl0ZXMsIHJlYWRJbnQxNiwgY2hlY2tTaWduYXR1cmUsIHJlYWRGbG9hdDMyLCByZWFkRml4ZWRQb2ludFBhdGgzMiwgcmVhZFNlY3Rpb24sIHJlYWRDb2xvciwgcmVhZEludDMyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcbmltcG9ydCB7XG5cdFBzZFdyaXRlciwgd3JpdGVaZXJvcywgd3JpdGVTaWduYXR1cmUsIHdyaXRlQnl0ZXMsIHdyaXRlVWludDMyLCB3cml0ZVVpbnQxNiwgd3JpdGVGbG9hdDY0LCB3cml0ZVVpbnQ4LFxuXHR3cml0ZUludDE2LCB3cml0ZUZsb2F0MzIsIHdyaXRlRml4ZWRQb2ludFBhdGgzMiwgd3JpdGVVbmljb2RlU3RyaW5nLCB3cml0ZVNlY3Rpb24sIHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nLCB3cml0ZUNvbG9yLFxufSBmcm9tICcuL3BzZFdyaXRlcic7XG5pbXBvcnQgeyByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IsIHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3IgfSBmcm9tICcuL2Rlc2NyaXB0b3InO1xuaW1wb3J0IHsgc2VyaWFsaXplRW5naW5lRGF0YSwgcGFyc2VFbmdpbmVEYXRhIH0gZnJvbSAnLi9lbmdpbmVEYXRhJztcbmltcG9ydCB7IGVuY29kZUVuZ2luZURhdGEsIGRlY29kZUVuZ2luZURhdGEgfSBmcm9tICcuL3RleHQnO1xuaW1wb3J0IHsgZnJvbUJ5dGVBcnJheSwgdG9CeXRlQXJyYXkgfSBmcm9tICdiYXNlNjQtanMnO1xuXG5jb25zdCBNT0NLX0hBTkRMRVJTID0gZmFsc2U7XG5cbnR5cGUgSGFzTWV0aG9kID0gKHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbykgPT4gYm9vbGVhbjtcbnR5cGUgUmVhZE1ldGhvZCA9IChyZWFkZXI6IFBzZFJlYWRlciwgdGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvLCBsZWZ0OiAoKSA9PiBudW1iZXIsIHBzZDogUHNkLCBvcHRpb25zOiBSZWFkT3B0aW9ucykgPT4gdm9pZDtcbnR5cGUgV3JpdGVNZXRob2QgPSAod3JpdGVyOiBQc2RXcml0ZXIsIHRhcmdldDogTGF5ZXJBZGRpdGlvbmFsSW5mbywgcHNkOiBQc2QsIG9wdGlvbnM6IFdyaXRlT3B0aW9ucykgPT4gdm9pZDtcblxuZXhwb3J0IGludGVyZmFjZSBJbmZvSGFuZGxlciB7XG5cdGtleTogc3RyaW5nO1xuXHRoYXM6IEhhc01ldGhvZDtcblx0cmVhZDogUmVhZE1ldGhvZDtcblx0d3JpdGU6IFdyaXRlTWV0aG9kO1xufVxuXG5leHBvcnQgY29uc3QgaW5mb0hhbmRsZXJzOiBJbmZvSGFuZGxlcltdID0gW107XG5leHBvcnQgY29uc3QgaW5mb0hhbmRsZXJzTWFwOiB7IFtrZXk6IHN0cmluZ106IEluZm9IYW5kbGVyIH0gPSB7fTtcblxuZnVuY3Rpb24gYWRkSGFuZGxlcihrZXk6IHN0cmluZywgaGFzOiBIYXNNZXRob2QsIHJlYWQ6IFJlYWRNZXRob2QsIHdyaXRlOiBXcml0ZU1ldGhvZCkge1xuXHRjb25zdCBoYW5kbGVyOiBJbmZvSGFuZGxlciA9IHsga2V5LCBoYXMsIHJlYWQsIHdyaXRlIH07XG5cdGluZm9IYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xuXHRpbmZvSGFuZGxlcnNNYXBbaGFuZGxlci5rZXldID0gaGFuZGxlcjtcbn1cblxuZnVuY3Rpb24gYWRkSGFuZGxlckFsaWFzKGtleTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZykge1xuXHRpbmZvSGFuZGxlcnNNYXBba2V5XSA9IGluZm9IYW5kbGVyc01hcFt0YXJnZXRdO1xufVxuXG5jb25zdCB0ZXh0R3JpZGRpbmcgPSBjcmVhdGVFbnVtPFRleHRHcmlkZGluZz4oJ3RleHRHcmlkZGluZycsICdub25lJywge1xuXHRub25lOiAnTm9uZScsXG59KTtcblxuY29uc3QgT3JudCA9IGNyZWF0ZUVudW08T3JpZW50YXRpb24+KCdPcm50JywgJ2hvcml6b250YWwnLCB7XG5cdGhvcml6b250YWw6ICdIcnpuJyxcblx0dmVydGljYWw6ICdWcnRjJyxcbn0pO1xuXG5jb25zdCBBbm50ID0gY3JlYXRlRW51bTxBbnRpQWxpYXM+KCdBbm50JywgJ3NoYXJwJywge1xuXHRub25lOiAnQW5ubycsXG5cdHNoYXJwOiAnYW50aUFsaWFzU2hhcnAnLFxuXHRjcmlzcDogJ0FuQ3InLFxuXHRzdHJvbmc6ICdBblN0Jyxcblx0c21vb3RoOiAnQW5TbScsXG59KTtcblxuY29uc3Qgd2FycFN0eWxlID0gY3JlYXRlRW51bTxXYXJwU3R5bGU+KCd3YXJwU3R5bGUnLCAnbm9uZScsIHtcblx0bm9uZTogJ3dhcnBOb25lJyxcblx0YXJjOiAnd2FycEFyYycsXG5cdGFyY0xvd2VyOiAnd2FycEFyY0xvd2VyJyxcblx0YXJjVXBwZXI6ICd3YXJwQXJjVXBwZXInLFxuXHRhcmNoOiAnd2FycEFyY2gnLFxuXHRidWxnZTogJ3dhcnBCdWxnZScsXG5cdHNoZWxsTG93ZXI6ICd3YXJwU2hlbGxMb3dlcicsXG5cdHNoZWxsVXBwZXI6ICd3YXJwU2hlbGxVcHBlcicsXG5cdGZsYWc6ICd3YXJwRmxhZycsXG5cdHdhdmU6ICd3YXJwV2F2ZScsXG5cdGZpc2g6ICd3YXJwRmlzaCcsXG5cdHJpc2U6ICd3YXJwUmlzZScsXG5cdGZpc2hleWU6ICd3YXJwRmlzaGV5ZScsXG5cdGluZmxhdGU6ICd3YXJwSW5mbGF0ZScsXG5cdHNxdWVlemU6ICd3YXJwU3F1ZWV6ZScsXG5cdHR3aXN0OiAnd2FycFR3aXN0Jyxcbn0pO1xuXG5jb25zdCBCbG5NID0gY3JlYXRlRW51bTxCbGVuZE1vZGU+KCdCbG5NJywgJ25vcm1hbCcsIHtcblx0J25vcm1hbCc6ICdOcm1sJyxcblx0J2Rpc3NvbHZlJzogJ0RzbHYnLFxuXHQnZGFya2VuJzogJ0Rya24nLFxuXHQnbXVsdGlwbHknOiAnTWx0cCcsXG5cdCdjb2xvciBidXJuJzogJ0NCcm4nLFxuXHQnbGluZWFyIGJ1cm4nOiAnbGluZWFyQnVybicsXG5cdCdkYXJrZXIgY29sb3InOiAnZGFya2VyQ29sb3InLFxuXHQnbGlnaHRlbic6ICdMZ2huJyxcblx0J3NjcmVlbic6ICdTY3JuJyxcblx0J2NvbG9yIGRvZGdlJzogJ0NEZGcnLFxuXHQnbGluZWFyIGRvZGdlJzogJ2xpbmVhckRvZGdlJyxcblx0J2xpZ2h0ZXIgY29sb3InOiAnbGlnaHRlckNvbG9yJyxcblx0J292ZXJsYXknOiAnT3ZybCcsXG5cdCdzb2Z0IGxpZ2h0JzogJ1NmdEwnLFxuXHQnaGFyZCBsaWdodCc6ICdIcmRMJyxcblx0J3ZpdmlkIGxpZ2h0JzogJ3ZpdmlkTGlnaHQnLFxuXHQnbGluZWFyIGxpZ2h0JzogJ2xpbmVhckxpZ2h0Jyxcblx0J3BpbiBsaWdodCc6ICdwaW5MaWdodCcsXG5cdCdoYXJkIG1peCc6ICdoYXJkTWl4Jyxcblx0J2RpZmZlcmVuY2UnOiAnRGZybicsXG5cdCdleGNsdXNpb24nOiAnWGNsdScsXG5cdCdzdWJ0cmFjdCc6ICdibGVuZFN1YnRyYWN0aW9uJyxcblx0J2RpdmlkZSc6ICdibGVuZERpdmlkZScsXG5cdCdodWUnOiAnSCAgICcsXG5cdCdzYXR1cmF0aW9uJzogJ1N0cnQnLFxuXHQnY29sb3InOiAnQ2xyICcsXG5cdCdsdW1pbm9zaXR5JzogJ0xtbnMnLFxufSk7XG5cbmNvbnN0IEJFU2wgPSBjcmVhdGVFbnVtPEJldmVsU3R5bGU+KCdCRVNsJywgJ2lubmVyIGJldmVsJywge1xuXHQnaW5uZXIgYmV2ZWwnOiAnSW5yQicsXG5cdCdvdXRlciBiZXZlbCc6ICdPdHJCJyxcblx0J2VtYm9zcyc6ICdFbWJzJyxcblx0J3BpbGxvdyBlbWJvc3MnOiAnUGxFYicsXG5cdCdzdHJva2UgZW1ib3NzJzogJ3N0cm9rZUVtYm9zcycsXG59KTtcblxuY29uc3QgYnZsVCA9IGNyZWF0ZUVudW08QmV2ZWxUZWNobmlxdWU+KCdidmxUJywgJ3Ntb290aCcsIHtcblx0J3Ntb290aCc6ICdTZkJMJyxcblx0J2NoaXNlbCBoYXJkJzogJ1ByQkwnLFxuXHQnY2hpc2VsIHNvZnQnOiAnU2xtdCcsXG59KTtcblxuY29uc3QgQkVTcyA9IGNyZWF0ZUVudW08QmV2ZWxEaXJlY3Rpb24+KCdCRVNzJywgJ3VwJywge1xuXHR1cDogJ0luICAnLFxuXHRkb3duOiAnT3V0ICcsXG59KTtcblxuY29uc3QgQkVURSA9IGNyZWF0ZUVudW08R2xvd1RlY2huaXF1ZT4oJ0JFVEUnLCAnc29mdGVyJywge1xuXHRzb2Z0ZXI6ICdTZkJMJyxcblx0cHJlY2lzZTogJ1ByQkwnLFxufSk7XG5cbmNvbnN0IElHU3IgPSBjcmVhdGVFbnVtPEdsb3dTb3VyY2U+KCdJR1NyJywgJ2VkZ2UnLCB7XG5cdGVkZ2U6ICdTcmNFJyxcblx0Y2VudGVyOiAnU3JjQycsXG59KTtcblxuY29uc3QgR3JkVCA9IGNyZWF0ZUVudW08R3JhZGllbnRTdHlsZT4oJ0dyZFQnLCAnbGluZWFyJywge1xuXHRsaW5lYXI6ICdMbnIgJyxcblx0cmFkaWFsOiAnUmRsICcsXG5cdGFuZ2xlOiAnQW5nbCcsXG5cdHJlZmxlY3RlZDogJ1JmbGMnLFxuXHRkaWFtb25kOiAnRG1uZCcsXG59KTtcblxuZXhwb3J0IGNvbnN0IENsclMgPSBjcmVhdGVFbnVtPCdyZ2InIHwgJ2hzYicgfCAnbGFiJz4oJ0NsclMnLCAncmdiJywge1xuXHRyZ2I6ICdSR0JDJyxcblx0aHNiOiAnSFNCbCcsXG5cdGxhYjogJ0xiQ2wnLFxufSk7XG5cbmNvbnN0IEZTdGwgPSBjcmVhdGVFbnVtPCdpbnNpZGUnIHwgJ2NlbnRlcicgfCAnb3V0c2lkZSc+KCdGU3RsJywgJ291dHNpZGUnLCB7XG5cdG91dHNpZGU6ICdPdXRGJyxcblx0Y2VudGVyOiAnQ3RyRicsXG5cdGluc2lkZTogJ0luc0YnXG59KTtcblxuY29uc3QgRnJGbCA9IGNyZWF0ZUVudW08J2NvbG9yJyB8ICdncmFkaWVudCcgfCAncGF0dGVybic+KCdGckZsJywgJ2NvbG9yJywge1xuXHRjb2xvcjogJ1NDbHInLFxuXHRncmFkaWVudDogJ0dyRmwnLFxuXHRwYXR0ZXJuOiAnUHRybicsXG59KTtcblxuY29uc3Qgc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZSA9IGNyZWF0ZUVudW08TGluZUNhcFR5cGU+KCdzdHJva2VTdHlsZUxpbmVDYXBUeXBlJywgJ2J1dHQnLCB7XG5cdGJ1dHQ6ICdzdHJva2VTdHlsZUJ1dHRDYXAnLFxuXHRyb3VuZDogJ3N0cm9rZVN0eWxlUm91bmRDYXAnLFxuXHRzcXVhcmU6ICdzdHJva2VTdHlsZVNxdWFyZUNhcCcsXG59KTtcblxuY29uc3Qgc3Ryb2tlU3R5bGVMaW5lSm9pblR5cGUgPSBjcmVhdGVFbnVtPExpbmVKb2luVHlwZT4oJ3N0cm9rZVN0eWxlTGluZUpvaW5UeXBlJywgJ21pdGVyJywge1xuXHRtaXRlcjogJ3N0cm9rZVN0eWxlTWl0ZXJKb2luJyxcblx0cm91bmQ6ICdzdHJva2VTdHlsZVJvdW5kSm9pbicsXG5cdGJldmVsOiAnc3Ryb2tlU3R5bGVCZXZlbEpvaW4nLFxufSk7XG5cbmNvbnN0IHN0cm9rZVN0eWxlTGluZUFsaWdubWVudCA9IGNyZWF0ZUVudW08TGluZUFsaWdubWVudD4oJ3N0cm9rZVN0eWxlTGluZUFsaWdubWVudCcsICdpbnNpZGUnLCB7XG5cdGluc2lkZTogJ3N0cm9rZVN0eWxlQWxpZ25JbnNpZGUnLFxuXHRjZW50ZXI6ICdzdHJva2VTdHlsZUFsaWduQ2VudGVyJyxcblx0b3V0c2lkZTogJ3N0cm9rZVN0eWxlQWxpZ25PdXRzaWRlJyxcbn0pO1xuXG5mdW5jdGlvbiBoYXNLZXkoa2V5OiBrZXlvZiBMYXllckFkZGl0aW9uYWxJbmZvKSB7XG5cdHJldHVybiAodGFyZ2V0OiBMYXllckFkZGl0aW9uYWxJbmZvKSA9PiB0YXJnZXRba2V5XSAhPT0gdW5kZWZpbmVkO1xufVxuXG5hZGRIYW5kbGVyKFxuXHQnVHlTaCcsXG5cdGhhc0tleSgndGV4dCcpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnRCeXRlcykgPT4ge1xuXHRcdGlmIChyZWFkSW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFR5U2ggdmVyc2lvbmApO1xuXG5cdFx0Y29uc3QgdHJhbnNmb3JtOiBudW1iZXJbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB0cmFuc2Zvcm0ucHVzaChyZWFkRmxvYXQ2NChyZWFkZXIpKTtcblxuXHRcdGlmIChyZWFkSW50MTYocmVhZGVyKSAhPT0gNTApIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIHRleHQgdmVyc2lvbmApO1xuXHRcdGNvbnN0IHRleHQ6IFRleHREZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG5cblx0XHRpZiAocmVhZEludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBUeVNoIHdhcnAgdmVyc2lvbmApO1xuXHRcdGNvbnN0IHdhcnA6IFdhcnBEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG5cblx0XHR0YXJnZXQudGV4dCA9IHtcblx0XHRcdHRyYW5zZm9ybSxcblx0XHRcdGxlZnQ6IHJlYWRGbG9hdDMyKHJlYWRlciksXG5cdFx0XHR0b3A6IHJlYWRGbG9hdDMyKHJlYWRlciksXG5cdFx0XHRyaWdodDogcmVhZEZsb2F0MzIocmVhZGVyKSxcblx0XHRcdGJvdHRvbTogcmVhZEZsb2F0MzIocmVhZGVyKSxcblx0XHRcdHRleHQ6IHRleHRbJ1R4dCAnXS5yZXBsYWNlKC9cXHIvZywgJ1xcbicpLFxuXHRcdFx0aW5kZXg6IHRleHQuVGV4dEluZGV4IHx8IDAsXG5cdFx0XHRncmlkZGluZzogdGV4dEdyaWRkaW5nLmRlY29kZSh0ZXh0LnRleHRHcmlkZGluZyksXG5cdFx0XHRhbnRpQWxpYXM6IEFubnQuZGVjb2RlKHRleHQuQW50QSksXG5cdFx0XHRvcmllbnRhdGlvbjogT3JudC5kZWNvZGUodGV4dC5Pcm50KSxcblx0XHRcdHdhcnA6IHtcblx0XHRcdFx0c3R5bGU6IHdhcnBTdHlsZS5kZWNvZGUod2FycC53YXJwU3R5bGUpLFxuXHRcdFx0XHR2YWx1ZTogd2FycC53YXJwVmFsdWUgfHwgMCxcblx0XHRcdFx0cGVyc3BlY3RpdmU6IHdhcnAud2FycFBlcnNwZWN0aXZlIHx8IDAsXG5cdFx0XHRcdHBlcnNwZWN0aXZlT3RoZXI6IHdhcnAud2FycFBlcnNwZWN0aXZlT3RoZXIgfHwgMCxcblx0XHRcdFx0cm90YXRlOiBPcm50LmRlY29kZSh3YXJwLndhcnBSb3RhdGUpLFxuXHRcdFx0fSxcblx0XHR9O1xuXG5cdFx0aWYgKHRleHQuRW5naW5lRGF0YSkge1xuXHRcdFx0Y29uc3QgZW5naW5lRGF0YSA9IGRlY29kZUVuZ2luZURhdGEocGFyc2VFbmdpbmVEYXRhKHRleHQuRW5naW5lRGF0YSkpO1xuXG5cdFx0XHQvLyBjb25zdCBiZWZvcmUgPSBwYXJzZUVuZ2luZURhdGEodGV4dC5FbmdpbmVEYXRhKTtcblx0XHRcdC8vIGNvbnN0IGFmdGVyID0gZW5jb2RlRW5naW5lRGF0YShlbmdpbmVEYXRhKTtcblx0XHRcdC8vIHJlcXVpcmUoJ2ZzJykud3JpdGVGaWxlU3luYygnYmVmb3JlLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGJlZm9yZSwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cdFx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ2FmdGVyLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGFmdGVyLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblxuXHRcdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocGFyc2VFbmdpbmVEYXRhKHRleHQuRW5naW5lRGF0YSksIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHRcdFx0dGFyZ2V0LnRleHQgPSB7IC4uLnRhcmdldC50ZXh0LCAuLi5lbmdpbmVEYXRhIH07XG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdCh0YXJnZXQudGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdFx0fVxuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdEJ5dGVzKCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gdGFyZ2V0LnRleHQhO1xuXHRcdGNvbnN0IHdhcnAgPSB0ZXh0LndhcnAgfHwge307XG5cdFx0Y29uc3QgdHJhbnNmb3JtID0gdGV4dC50cmFuc2Zvcm0gfHwgWzEsIDAsIDAsIDEsIDAsIDBdO1xuXG5cdFx0Y29uc3QgdGV4dERlc2NyaXB0b3I6IFRleHREZXNjcmlwdG9yID0ge1xuXHRcdFx0J1R4dCAnOiAodGV4dC50ZXh0IHx8ICcnKS5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHInKSxcblx0XHRcdHRleHRHcmlkZGluZzogdGV4dEdyaWRkaW5nLmVuY29kZSh0ZXh0LmdyaWRkaW5nKSxcblx0XHRcdE9ybnQ6IE9ybnQuZW5jb2RlKHRleHQub3JpZW50YXRpb24pLFxuXHRcdFx0QW50QTogQW5udC5lbmNvZGUodGV4dC5hbnRpQWxpYXMpLFxuXHRcdFx0VGV4dEluZGV4OiB0ZXh0LmluZGV4IHx8IDAsXG5cdFx0XHRFbmdpbmVEYXRhOiBzZXJpYWxpemVFbmdpbmVEYXRhKGVuY29kZUVuZ2luZURhdGEodGV4dCkpLFxuXHRcdH07XG5cblx0XHRjb25zdCB3YXJwRGVzY3JpcHRvcjogV2FycERlc2NyaXB0b3IgPSB7XG5cdFx0XHR3YXJwU3R5bGU6IHdhcnBTdHlsZS5lbmNvZGUod2FycC5zdHlsZSksXG5cdFx0XHR3YXJwVmFsdWU6IHdhcnAudmFsdWUgfHwgMCxcblx0XHRcdHdhcnBQZXJzcGVjdGl2ZTogd2FycC5wZXJzcGVjdGl2ZSB8fCAwLFxuXHRcdFx0d2FycFBlcnNwZWN0aXZlT3RoZXI6IHdhcnAucGVyc3BlY3RpdmVPdGhlciB8fCAwLFxuXHRcdFx0d2FycFJvdGF0ZTogT3JudC5lbmNvZGUod2FycC5yb3RhdGUpLFxuXHRcdH07XG5cblx0XHR3cml0ZUludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG5cdFx0XHR3cml0ZUZsb2F0NjQod3JpdGVyLCB0cmFuc2Zvcm1baV0pO1xuXHRcdH1cblxuXHRcdHdyaXRlSW50MTYod3JpdGVyLCA1MCk7IC8vIHRleHQgdmVyc2lvblxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ1R4THInLCB0ZXh0RGVzY3JpcHRvcik7XG5cblx0XHR3cml0ZUludDE2KHdyaXRlciwgMSk7IC8vIHdhcnAgdmVyc2lvblxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3dhcnAnLCB3YXJwRGVzY3JpcHRvcik7XG5cblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LmxlZnQhKTtcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LnRvcCEpO1xuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIHRleHQucmlnaHQhKTtcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCB0ZXh0LmJvdHRvbSEpO1xuXG5cdFx0Ly8gd3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXHR9LFxuKTtcblxuLy8gdmVjdG9yIGZpbGxzXG5cbmFkZEhhbmRsZXIoXG5cdCdTb0NvJyxcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSA9PT0gdW5kZWZpbmVkICYmXG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwudHlwZSA9PT0gJ2NvbG9yJyxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xuXHRcdHRhcmdldC52ZWN0b3JGaWxsID0gcGFyc2VWZWN0b3JDb250ZW50KGRlc2NyaXB0b3IpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCB7IGRlc2NyaXB0b3IgfSA9IHNlcmlhbGl6ZVZlY3RvckNvbnRlbnQodGFyZ2V0LnZlY3RvckZpbGwhKTtcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzY3JpcHRvcik7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQnR2RGbCcsXG5cdHRhcmdldCA9PiB0YXJnZXQudmVjdG9yRmlsbCAhPT0gdW5kZWZpbmVkICYmIHRhcmdldC52ZWN0b3JTdHJva2UgPT09IHVuZGVmaW5lZCAmJlxuXHRcdCh0YXJnZXQudmVjdG9yRmlsbC50eXBlID09PSAnc29saWQnIHx8IHRhcmdldC52ZWN0b3JGaWxsLnR5cGUgPT09ICdub2lzZScpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwgPSBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcik7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVzY3JpcHRvciB9ID0gc2VyaWFsaXplVmVjdG9yQ29udGVudCh0YXJnZXQudmVjdG9yRmlsbCEpO1xuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjcmlwdG9yKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdQdEZsJyxcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSA9PT0gdW5kZWZpbmVkICYmXG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwudHlwZSA9PT0gJ3BhdHRlcm4nLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG5cdFx0dGFyZ2V0LnZlY3RvckZpbGwgPSBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcik7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IHsgZGVzY3JpcHRvciB9ID0gc2VyaWFsaXplVmVjdG9yQ29udGVudCh0YXJnZXQudmVjdG9yRmlsbCEpO1xuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjcmlwdG9yKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCd2c2NnJyxcblx0dGFyZ2V0ID0+IHRhcmdldC52ZWN0b3JGaWxsICE9PSB1bmRlZmluZWQgJiYgdGFyZ2V0LnZlY3RvclN0cm9rZSAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRyZWFkU2lnbmF0dXJlKHJlYWRlcik7IC8vIGtleVxuXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcblx0XHR0YXJnZXQudmVjdG9yRmlsbCA9IHBhcnNlVmVjdG9yQ29udGVudChkZXNjcmlwdG9yKTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCB7IGRlc2NyaXB0b3IsIGtleSB9ID0gc2VyaWFsaXplVmVjdG9yQ29udGVudCh0YXJnZXQudmVjdG9yRmlsbCEpO1xuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwga2V5KTtcblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzY3JpcHRvcik7XG5cdH0sXG4pO1xuXG5mdW5jdGlvbiByZWFkQmV6aWVyS25vdChyZWFkZXI6IFBzZFJlYWRlciwgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcblx0Y29uc3QgeTAgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogaGVpZ2h0O1xuXHRjb25zdCB4MCA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiB3aWR0aDtcblx0Y29uc3QgeTEgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogaGVpZ2h0O1xuXHRjb25zdCB4MSA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiB3aWR0aDtcblx0Y29uc3QgeTIgPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpICogaGVpZ2h0O1xuXHRjb25zdCB4MiA9IHJlYWRGaXhlZFBvaW50UGF0aDMyKHJlYWRlcikgKiB3aWR0aDtcblx0cmV0dXJuIFt4MCwgeTAsIHgxLCB5MSwgeDIsIHkyXTtcbn1cblxuYWRkSGFuZGxlcihcblx0J3Ztc2snLFxuXHRoYXNLZXkoJ3ZlY3Rvck1hc2snKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCB7IHdpZHRoLCBoZWlnaHQgfSkgPT4ge1xuXHRcdGlmIChyZWFkVWludDMyKHJlYWRlcikgIT09IDMpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCB2bXNrIHZlcnNpb24nKTtcblxuXHRcdHRhcmdldC52ZWN0b3JNYXNrID0geyBwYXRoczogW10gfTtcblx0XHRjb25zdCB2ZWN0b3JNYXNrID0gdGFyZ2V0LnZlY3Rvck1hc2s7XG5cblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHR2ZWN0b3JNYXNrLmludmVydCA9IChmbGFncyAmIDEpICE9PSAwO1xuXHRcdHZlY3Rvck1hc2subm90TGluayA9IChmbGFncyAmIDIpICE9PSAwO1xuXHRcdHZlY3Rvck1hc2suZGlzYWJsZSA9IChmbGFncyAmIDQpICE9PSAwO1xuXG5cdFx0Y29uc3QgcGF0aHMgPSB2ZWN0b3JNYXNrLnBhdGhzO1xuXHRcdGxldCBwYXRoOiBCZXppZXJQYXRoIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0d2hpbGUgKGxlZnQoKSA+PSAyNikge1xuXHRcdFx0Y29uc3Qgc2VsZWN0b3IgPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0XHRcdHN3aXRjaCAoc2VsZWN0b3IpIHtcblx0XHRcdFx0Y2FzZSAwOiAvLyBDbG9zZWQgc3VicGF0aCBsZW5ndGggcmVjb3JkXG5cdFx0XHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpOyAvLyBjb3VudFxuXHRcdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIDIyKTtcblx0XHRcdFx0XHRwYXRoID0geyBvcGVuOiBmYWxzZSwga25vdHM6IFtdIH07XG5cdFx0XHRcdFx0cGF0aHMucHVzaChwYXRoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAxOiAvLyBDbG9zZWQgc3VicGF0aCBCZXppZXIga25vdCwgbGlua2VkXG5cdFx0XHRcdGNhc2UgNDogLy8gT3BlbiBzdWJwYXRoIEJlemllciBrbm90LCBsaW5rZWRcblx0XHRcdFx0XHRwYXRoIS5rbm90cy5wdXNoKHsgbGlua2VkOiB0cnVlLCBwb2ludHM6IHJlYWRCZXppZXJLbm90KHJlYWRlciwgd2lkdGgsIGhlaWdodCkgfSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgMjogLy8gQ2xvc2VkIHN1YnBhdGggQmV6aWVyIGtub3QsIHVubGlua2VkXG5cdFx0XHRcdGNhc2UgNTogLy8gT3BlbiBzdWJwYXRoIEJlemllciBrbm90LCB1bmxpbmtlZFxuXHRcdFx0XHRcdHBhdGghLmtub3RzLnB1c2goeyBsaW5rZWQ6IGZhbHNlLCBwb2ludHM6IHJlYWRCZXppZXJLbm90KHJlYWRlciwgd2lkdGgsIGhlaWdodCkgfSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgMzogLy8gT3BlbiBzdWJwYXRoIGxlbmd0aCByZWNvcmRcblx0XHRcdFx0XHRyZWFkVWludDE2KHJlYWRlcik7IC8vIGNvdW50XG5cdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMjIpO1xuXHRcdFx0XHRcdHBhdGggPSB7IG9wZW46IHRydWUsIGtub3RzOiBbXSB9O1xuXHRcdFx0XHRcdHBhdGhzLnB1c2gocGF0aCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgNjogLy8gUGF0aCBmaWxsIHJ1bGUgcmVjb3JkXG5cdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMjQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIDc6IHsgLy8gQ2xpcGJvYXJkIHJlY29yZFxuXHRcdFx0XHRcdC8vIFRPRE86IGNoZWNrIGlmIHRoZXNlIG5lZWQgdG8gYmUgbXVsdGlwbGllZCBieSBkb2N1bWVudCBzaXplXG5cdFx0XHRcdFx0Y29uc3QgdG9wID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKTtcblx0XHRcdFx0XHRjb25zdCBsZWZ0ID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKTtcblx0XHRcdFx0XHRjb25zdCBib3R0b20gPSByZWFkRml4ZWRQb2ludFBhdGgzMihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHJpZ2h0ID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKTtcblx0XHRcdFx0XHRjb25zdCByZXNvbHV0aW9uID0gcmVhZEZpeGVkUG9pbnRQYXRoMzIocmVhZGVyKTtcblx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCA0KTtcblx0XHRcdFx0XHR2ZWN0b3JNYXNrLmNsaXBib2FyZCA9IHsgdG9wLCBsZWZ0LCBib3R0b20sIHJpZ2h0LCByZXNvbHV0aW9uIH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSA4OiAvLyBJbml0aWFsIGZpbGwgcnVsZSByZWNvcmRcblx0XHRcdFx0XHR2ZWN0b3JNYXNrLmZpbGxTdGFydHNXaXRoQWxsUGl4ZWxzID0gISFyZWFkVWludDE2KHJlYWRlcik7XG5cdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMjIpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdm1zayBzZWN0aW9uJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0LCB7IHdpZHRoLCBoZWlnaHQgfSkgPT4ge1xuXHRcdGNvbnN0IHZlY3Rvck1hc2sgPSB0YXJnZXQudmVjdG9yTWFzayE7XG5cdFx0Y29uc3QgZmxhZ3MgPVxuXHRcdFx0KHZlY3Rvck1hc2suaW52ZXJ0ID8gMSA6IDApIHxcblx0XHRcdCh2ZWN0b3JNYXNrLm5vdExpbmsgPyAyIDogMCkgfFxuXHRcdFx0KHZlY3Rvck1hc2suZGlzYWJsZSA/IDQgOiAwKTtcblxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgMyk7IC8vIHZlcnNpb25cblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIGZsYWdzKTtcblxuXHRcdC8vIGluaXRpYWwgZW50cnlcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDYpO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyNCk7XG5cblx0XHRjb25zdCBjbGlwYm9hcmQgPSB2ZWN0b3JNYXNrLmNsaXBib2FyZDtcblx0XHRpZiAoY2xpcGJvYXJkKSB7XG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDcpO1xuXHRcdFx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgY2xpcGJvYXJkLnRvcCk7XG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQubGVmdCk7XG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQuYm90dG9tKTtcblx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIGNsaXBib2FyZC5yaWdodCk7XG5cdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBjbGlwYm9hcmQucmVzb2x1dGlvbik7XG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgNCk7XG5cdFx0fVxuXG5cdFx0aWYgKHZlY3Rvck1hc2suZmlsbFN0YXJ0c1dpdGhBbGxQaXhlbHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCA4KTtcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgdmVjdG9yTWFzay5maWxsU3RhcnRzV2l0aEFsbFBpeGVscyA/IDEgOiAwKTtcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyMik7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBwYXRoIG9mIHZlY3Rvck1hc2sucGF0aHMpIHtcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgcGF0aC5vcGVuID8gMyA6IDApO1xuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCBwYXRoLmtub3RzLmxlbmd0aCk7XG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpO1xuXHRcdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTtcblx0XHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAxOCk7XG5cblx0XHRcdGNvbnN0IGxpbmtlZEtub3QgPSBwYXRoLm9wZW4gPyA0IDogMTtcblx0XHRcdGNvbnN0IHVubGlua2VkS25vdCA9IHBhdGgub3BlbiA/IDUgOiAyO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHsgbGlua2VkLCBwb2ludHMgfSBvZiBwYXRoLmtub3RzKSB7XG5cdFx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgbGlua2VkID8gbGlua2VkS25vdCA6IHVubGlua2VkS25vdCk7XG5cdFx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIHBvaW50c1sxXSAvIHdpZHRoKTsgLy8geTBcblx0XHRcdFx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgcG9pbnRzWzBdIC8gaGVpZ2h0KTsgLy8geDBcblx0XHRcdFx0d3JpdGVGaXhlZFBvaW50UGF0aDMyKHdyaXRlciwgcG9pbnRzWzNdIC8gd2lkdGgpOyAvLyB5MVxuXHRcdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbMl0gLyBoZWlnaHQpOyAvLyB4MVxuXHRcdFx0XHR3cml0ZUZpeGVkUG9pbnRQYXRoMzIod3JpdGVyLCBwb2ludHNbNV0gLyB3aWR0aCk7IC8vIHkyXG5cdFx0XHRcdHdyaXRlRml4ZWRQb2ludFBhdGgzMih3cml0ZXIsIHBvaW50c1s0XSAvIGhlaWdodCk7IC8vIHgyXG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuKTtcblxuLy8gVE9ETzogbmVlZCB0byB3cml0ZSB2bXNrIGlmIGhhcyBvdXRsaW5lID9cbmFkZEhhbmRsZXJBbGlhcygndnNtcycsICd2bXNrJyk7XG5cbmFkZEhhbmRsZXIoXG5cdCdsdW5pJyxcblx0aGFzS2V5KCduYW1lJyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdHRhcmdldC5uYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHR3cml0ZVVuaWNvZGVTdHJpbmcod3JpdGVyLCB0YXJnZXQubmFtZSEpO1xuXHRcdC8vIHdyaXRlVWludDE2KHdyaXRlciwgMCk7IC8vIHBhZGRpbmcgKGJ1dCBub3QgZXh0ZW5kaW5nIHN0cmluZyBsZW5ndGgpXG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQnbG5zcicsXG5cdGhhc0tleSgnbmFtZVNvdXJjZScpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5uYW1lU291cmNlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpLFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdGFyZ2V0Lm5hbWVTb3VyY2UhKSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdseWlkJyxcblx0aGFzS2V5KCdpZCcpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC5pZCA9IHJlYWRVaW50MzIocmVhZGVyKSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5pZCEpLFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2NsYmwnLFxuXHRoYXNLZXkoJ2JsZW5kQ2xpcHBlbmRFbGVtZW50cycpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHR0YXJnZXQuYmxlbmRDbGlwcGVuZEVsZW1lbnRzID0gISFyZWFkVWludDgocmVhZGVyKTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHRhcmdldC5ibGVuZENsaXBwZW5kRWxlbWVudHMgPyAxIDogMCk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2luZngnLFxuXHRoYXNLZXkoJ2JsZW5kSW50ZXJpb3JFbGVtZW50cycpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHR0YXJnZXQuYmxlbmRJbnRlcmlvckVsZW1lbnRzID0gISFyZWFkVWludDgocmVhZGVyKTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIHRhcmdldC5ibGVuZEludGVyaW9yRWxlbWVudHMgPyAxIDogMCk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2tua28nLFxuXHRoYXNLZXkoJ2tub2Nrb3V0JyksXG5cdChyZWFkZXIsIHRhcmdldCkgPT4ge1xuXHRcdHRhcmdldC5rbm9ja291dCA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgMyk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCB0YXJnZXQua25vY2tvdXQgPyAxIDogMCk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2xzcGYnLFxuXHRoYXNLZXkoJ3Byb3RlY3RlZCcpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBmbGFncyA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHR0YXJnZXQucHJvdGVjdGVkID0ge1xuXHRcdFx0dHJhbnNwYXJlbmN5OiAoZmxhZ3MgJiAweDAxKSAhPT0gMCxcblx0XHRcdGNvbXBvc2l0ZTogKGZsYWdzICYgMHgwMikgIT09IDAsXG5cdFx0XHRwb3NpdGlvbjogKGZsYWdzICYgMHgwNCkgIT09IDAsXG5cdFx0fTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgZmxhZ3MgPVxuXHRcdFx0KHRhcmdldC5wcm90ZWN0ZWQhLnRyYW5zcGFyZW5jeSA/IDB4MDEgOiAwKSB8XG5cdFx0XHQodGFyZ2V0LnByb3RlY3RlZCEuY29tcG9zaXRlID8gMHgwMiA6IDApIHxcblx0XHRcdCh0YXJnZXQucHJvdGVjdGVkIS5wb3NpdGlvbiA/IDB4MDQgOiAwKTtcblxuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgZmxhZ3MpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2xjbHInLFxuXHRoYXNLZXkoJ2xheWVyQ29sb3InKSxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgY29sb3IgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgNik7XG5cdFx0dGFyZ2V0LmxheWVyQ29sb3IgPSBsYXllckNvbG9yc1tjb2xvcl07XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZGV4ID0gbGF5ZXJDb2xvcnMuaW5kZXhPZih0YXJnZXQubGF5ZXJDb2xvciEpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5kZXggPT09IC0xID8gMCA6IGluZGV4KTtcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgNik7XG5cdH0sXG4pO1xuXG5pbnRlcmZhY2UgQ3VzdG9tRGVzY3JpcHRvciB7XG5cdGxheWVyVGltZT86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEZyYW1lTGlzdERlc2NyaXB0b3Ige1xuXHRMYUlEOiBudW1iZXI7XG5cdExhU3Q6IHtcblx0XHRlbmFiPzogYm9vbGVhbjtcblx0XHRJTXNrPzogeyBPZnN0OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9IH07XG5cdFx0Vk1zaz86IHsgT2ZzdDogeyBIcnpuOiBudW1iZXI7IFZydGM6IG51bWJlcjsgfSB9O1xuXHRcdEZYUmY/OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9O1xuXHRcdEZyTHM6IG51bWJlcltdO1xuXHR9W107XG59XG5cbmFkZEhhbmRsZXIoXG5cdCdzaG1kJyxcblx0aGFzS2V5KCd0aW1lc3RhbXAnKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0LCBfLCBvcHRpb25zKSA9PiB7XG5cdFx0Y29uc3QgY291bnQgPSByZWFkVWludDMyKHJlYWRlcik7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcblx0XHRcdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcblx0XHRcdGNvbnN0IGtleSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKTtcblx0XHRcdHJlYWRVaW50OChyZWFkZXIpOyAvLyBjb3B5XG5cdFx0XHRza2lwQnl0ZXMocmVhZGVyLCAzKTtcblxuXHRcdFx0cmVhZFNlY3Rpb24ocmVhZGVyLCAxLCBsZWZ0ID0+IHtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ2N1c3QnKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzIEN1c3RvbURlc2NyaXB0b3I7XG5cdFx0XHRcdFx0aWYgKGRlc2MubGF5ZXJUaW1lICE9PSB1bmRlZmluZWQpIHRhcmdldC50aW1lc3RhbXAgPSBkZXNjLmxheWVyVGltZTtcblx0XHRcdFx0fSBlbHNlIGlmIChrZXkgPT09ICdtbHN0Jykge1xuXHRcdFx0XHRcdGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBGcmFtZUxpc3REZXNjcmlwdG9yO1xuXHRcdFx0XHRcdG9wdGlvbnMubG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coJ21sc3QnLCBkZXNjKTtcblx0XHRcdFx0XHQvLyBvcHRpb25zLmxvZ0RldkZlYXR1cmVzICYmIGNvbnNvbGUubG9nKCdtbHN0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnbWR5bicpIHtcblx0XHRcdFx0XHQvLyBmcmFtZSBmbGFnc1xuXHRcdFx0XHRcdGNvbnN0IHVua25vd24gPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0XHRcdFx0Y29uc3QgcHJvcGFnYXRlID0gcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0XHRcdFx0Y29uc3QgZmxhZ3MgPSByZWFkVWludDgocmVhZGVyKTtcblx0XHRcdFx0XHRjb25zdCB1bmlmeUxheWVyUG9zaXRpb24gPSAoZmxhZ3MgJiAxKSAhPT0gMDtcblx0XHRcdFx0XHRjb25zdCB1bmlmeUxheWVyU3R5bGUgPSAoZmxhZ3MgJiAyKSAhPT0gMDtcblx0XHRcdFx0XHRjb25zdCB1bmlmeUxheWVyVmlzaWJpbGl0eSA9IChmbGFncyAmIDQpICE9PSAwO1xuXHRcdFx0XHRcdG9wdGlvbnMubG9nRGV2RmVhdHVyZXMgJiYgY29uc29sZS5sb2coXG5cdFx0XHRcdFx0XHQnbWR5bicsICd1bmtub3duOicsIHVua25vd24sICdwcm9wYWdhdGU6JywgcHJvcGFnYXRlLFxuXHRcdFx0XHRcdFx0J2ZsYWdzOicsIGZsYWdzLCB7IHVuaWZ5TGF5ZXJQb3NpdGlvbiwgdW5pZnlMYXllclN0eWxlLCB1bmlmeUxheWVyVmlzaWJpbGl0eSB9KTtcblxuXHRcdFx0XHRcdC8vIGNvbnN0IGRlc2MgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBGcmFtZUxpc3REZXNjcmlwdG9yO1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdtZHluJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5sb2dEZXZGZWF0dXJlcyAmJiBjb25zb2xlLmxvZygnVW5oYW5kbGVkIG1ldGFkYXRhJywga2V5KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBkZXNjOiBDdXN0b21EZXNjcmlwdG9yID0ge1xuXHRcdFx0bGF5ZXJUaW1lOiB0YXJnZXQudGltZXN0YW1wISxcblx0XHR9O1xuXG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCAxKTsgLy8gY291bnRcblxuXHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdjdXN0Jyk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApOyAvLyBjb3B5IChhbHdheXMgZmFsc2UpXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDMpO1xuXHRcdHdyaXRlU2VjdGlvbih3cml0ZXIsIDIsICgpID0+IHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ21ldGFkYXRhJywgZGVzYykpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J3NuMlAnLFxuXHRoYXNLZXkoJ3VzaW5nQWxpZ25lZFJlbmRlcmluZycpLFxuXHQocmVhZGVyLCB0YXJnZXQpID0+IHRhcmdldC51c2luZ0FsaWduZWRSZW5kZXJpbmcgPSAhIXJlYWRVaW50MzIocmVhZGVyKSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC51c2luZ0FsaWduZWRSZW5kZXJpbmcgPyAxIDogMCksXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQnZnhycCcsXG5cdGhhc0tleSgncmVmZXJlbmNlUG9pbnQnKSxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0dGFyZ2V0LnJlZmVyZW5jZVBvaW50ID0ge1xuXHRcdFx0eDogcmVhZEZsb2F0NjQocmVhZGVyKSxcblx0XHRcdHk6IHJlYWRGbG9hdDY0KHJlYWRlciksXG5cdFx0fTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVGbG9hdDY0KHdyaXRlciwgdGFyZ2V0LnJlZmVyZW5jZVBvaW50IS54KTtcblx0XHR3cml0ZUZsb2F0NjQod3JpdGVyLCB0YXJnZXQucmVmZXJlbmNlUG9pbnQhLnkpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2xzY3QnLFxuXHRoYXNLZXkoJ3NlY3Rpb25EaXZpZGVyJyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdHRhcmdldC5zZWN0aW9uRGl2aWRlciA9IHsgdHlwZTogcmVhZFVpbnQzMihyZWFkZXIpIH07XG5cblx0XHRpZiAobGVmdCgpKSB7XG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XG5cdFx0XHR0YXJnZXQuc2VjdGlvbkRpdmlkZXIua2V5ID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpO1xuXHRcdH1cblxuXHRcdGlmIChsZWZ0KCkpIHtcblx0XHRcdC8vIDAgPSBub3JtYWxcblx0XHRcdC8vIDEgPSBzY2VuZSBncm91cCwgYWZmZWN0cyB0aGUgYW5pbWF0aW9uIHRpbWVsaW5lLlxuXHRcdFx0dGFyZ2V0LnNlY3Rpb25EaXZpZGVyLnN1YlR5cGUgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0fVxuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIHRhcmdldC5zZWN0aW9uRGl2aWRlciEudHlwZSk7XG5cblx0XHRpZiAodGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5rZXkpIHtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgJzhCSU0nKTtcblx0XHRcdHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgdGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5rZXkpO1xuXG5cdFx0XHRpZiAodGFyZ2V0LnNlY3Rpb25EaXZpZGVyIS5zdWJUeXBlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQuc2VjdGlvbkRpdmlkZXIhLnN1YlR5cGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcbik7XG5cbk1PQ0tfSEFORExFUlMgJiYgYWRkSGFuZGxlcihcblx0J1BhdHQnLFxuXHR0YXJnZXQgPT4gJ2NoaWxkcmVuJyBpbiB0YXJnZXQsIC8vICh0YXJnZXQgYXMgYW55KS5fUGF0dCAhPT0gdW5kZWZpbmVkLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRjb25zb2xlLmxvZygnYWRkaXRpb25hbCBpbmZvOiBQYXR0Jyk7XG5cdFx0KHRhcmdldCBhcyBhbnkpLl9QYXR0ID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiBmYWxzZSAmJiB3cml0ZUJ5dGVzKHdyaXRlciwgKHRhcmdldCBhcyBhbnkpLl9QYXR0KSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdQYXR0JywgLy8gVE9ETzogaGFuZGxlIGFsc28gUGF0MiAmIFBhdDNcblx0dGFyZ2V0ID0+ICF0YXJnZXQsXG5cdChyZWFkZXIsIF90YXJnZXQsIGxlZnQpID0+IHtcblx0XHRpZiAoIWxlZnQoKSkgcmV0dXJuO1xuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTsgcmV0dXJuOyAvLyBub3Qgc3VwcG9ydGVkIHlldFxuXHRcdC8qXG5cdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cblx0XHRpZiAodmVyc2lvbiAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFBhdHQgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuXG5cdFx0Y29uc3QgY29sb3JNb2RlID0gcmVhZFVpbnQzMihyZWFkZXIpIGFzIENvbG9yTW9kZTtcblx0XHRjb25zdCB4ID0gcmVhZEludDE2KHJlYWRlcik7XG5cdFx0Y29uc3QgeSA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXG5cdFx0aWYgKHN1cHBvcnRlZENvbG9yTW9kZXMuaW5kZXhPZihjb2xvck1vZGUpID09IC0xKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUGF0dCBjb2xvciBtb2RlOiAke2NvbG9yTW9kZX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBuYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcblx0XHRjb25zdCBpZCA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcblxuXHRcdC8vIFRPRE86IGluZGV4IGNvbG9yIHRhYmxlIGhlcmUgKG9ubHkgZm9yIGluZGV4ZWQgY29sb3IgbW9kZSwgbm90IHN1cHBvcnRlZCByaWdodCBub3cpXG5cdFx0Y29uc29sZS5sb2coJ3BhdHQnLCBsZW5ndGgsIGNvbG9yTW9kZSwgeCwgeSwgbmFtZSwgaWQpO1xuXG5cdFx0Ly8gdmlydHVhbCBtZW1vcnkgYXJyYXkgbGlzdFxuXHRcdHtcblx0XHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cblx0XHRcdGlmICh2ZXJzaW9uICE9PSAzKSB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgUGF0dDpWTUFMIHZlcnNpb246ICR7dmVyc2lvbn1gKTtcblxuXHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgdG9wID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgbGVmdCA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdGNvbnN0IGJvdHRvbSA9IHJlYWRVaW50MzIocmVhZGVyKTtcblx0XHRcdGNvbnN0IHJpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0Y29uc3QgY2hhbm5lbHMgPSByZWFkVWludDMyKHJlYWRlcik7XG5cblx0XHRcdGNvbnNvbGUubG9nKCdWTUFMJywgbGVuZ3RoLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIGNoYW5uZWxzKTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAoY2hhbm5lbHMgKyAyKTsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGhhcyA9IHJlYWRVaW50MzIocmVhZGVyKTtcblxuXHRcdFx0XHRpZiAoaGFzKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHBpeGVsRGVwdGggPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRcdFx0Y29uc3QgdG9wID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IGxlZnQgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0XHRcdFx0Y29uc3QgYm90dG9tID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHJpZ2h0ID0gcmVhZFVpbnQzMihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHBpeGVsRGVwdGgyID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdFx0XHRcdGNvbnN0IGNvbXByZXNzaW9uTW9kZSA9IHJlYWRVaW50OChyZWFkZXIpOyAvLyAxIC0gemlwXG5cblx0XHRcdFx0XHQvLyBUT0RPOiBkZWNvbXByZXNzIGRhdGEgLi4uXG5cblx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZW5ndGggLSAoNCArIDE2ICsgMiArIDEpKTtcblxuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdjaGFubmVsJywgbGVuZ3RoLCBwaXhlbERlcHRoLCB0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQsIHBpeGVsRGVwdGgyLCBjb21wcmVzc2lvbk1vZGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdTS0lQJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRhcmdldC5wYXR0ZXJucykgdGFyZ2V0LnBhdHRlcm5zID0gW107XG5cblx0XHR0YXJnZXQucGF0dGVybnMucHVzaCh7IG5hbWUsIGlkLCBjb2xvck1vZGUsIHgsIHkgfSk7XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHRcdCovXG5cdH0sXG5cdChfd3JpdGVyLCBfdGFyZ2V0KSA9PiB7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQncHRocycsXG5cdGhhc0tleSgncGF0aExpc3QnKSxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xuXG5cdFx0dGFyZ2V0LnBhdGhMaXN0ID0gW107IC8vIFRPRE86IHJlYWQgcGF0aHMgKGZpbmQgZXhhbXBsZSB3aXRoIG5vbi1lbXB0eSBsaXN0KVxuXG5cdFx0ZGVzY3JpcHRvcjtcblx0XHQvLyBjb25zb2xlLmxvZygncHRocycsIGRlc2NyaXB0b3IpOyAvLyBUT0RPOiByZW1vdmUgdGhpc1xuXHR9LFxuXHQod3JpdGVyLCBfdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgZGVzY3JpcHRvciA9IHtcblx0XHRcdHBhdGhMaXN0OiBbXSwgLy8gVE9ETzogd3JpdGUgcGF0aHNcblx0XHR9O1xuXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAncGF0aHNEYXRhQ2xhc3MnLCBkZXNjcmlwdG9yKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdseXZyJyxcblx0aGFzS2V5KCd2ZXJzaW9uJyksXG5cdChyZWFkZXIsIHRhcmdldCkgPT4gdGFyZ2V0LnZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlciksXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4gd3JpdGVVaW50MzIod3JpdGVyLCB0YXJnZXQudmVyc2lvbiEpLFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2xyRlgnLFxuXHRoYXNLZXkoJ2VmZmVjdHMnKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0aWYgKCF0YXJnZXQuZWZmZWN0cykge1xuXHRcdFx0dGFyZ2V0LmVmZmVjdHMgPSByZWFkRWZmZWN0cyhyZWFkZXIpO1xuXHRcdH1cblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdHdyaXRlRWZmZWN0cyh3cml0ZXIsIHRhcmdldC5lZmZlY3RzISk7XG5cdH0sXG4pO1xuXG5mdW5jdGlvbiBhZGp1c3RtZW50VHlwZSh0eXBlOiBzdHJpbmcpIHtcblx0cmV0dXJuICh0YXJnZXQ6IExheWVyQWRkaXRpb25hbEluZm8pID0+ICEhdGFyZ2V0LmFkanVzdG1lbnQgJiYgdGFyZ2V0LmFkanVzdG1lbnQudHlwZSA9PT0gdHlwZTtcbn1cblxuYWRkSGFuZGxlcihcblx0J2JyaXQnLFxuXHRhZGp1c3RtZW50VHlwZSgnYnJpZ2h0bmVzcy9jb250cmFzdCcpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRpZiAoIXRhcmdldC5hZGp1c3RtZW50KSB7IC8vIGlnbm9yZSBpZiBnb3Qgb25lIGZyb20gQ2dFZCBibG9ja1xuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XG5cdFx0XHRcdHR5cGU6ICdicmlnaHRuZXNzL2NvbnRyYXN0Jyxcblx0XHRcdFx0YnJpZ2h0bmVzczogcmVhZEludDE2KHJlYWRlciksXG5cdFx0XHRcdGNvbnRyYXN0OiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRcdFx0bWVhblZhbHVlOiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRcdFx0bGFiQ29sb3JPbmx5OiAhIXJlYWRVaW50OChyZWFkZXIpLFxuXHRcdFx0XHR1c2VMZWdhY3k6IHRydWUsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBCcmlnaHRuZXNzQWRqdXN0bWVudDtcblx0XHR3cml0ZUludDE2KHdyaXRlciwgaW5mby5icmlnaHRuZXNzIHx8IDApO1xuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBpbmZvLmNvbnRyYXN0IHx8IDApO1xuXHRcdHdyaXRlSW50MTYod3JpdGVyLCBpbmZvLm1lYW5WYWx1ZSA/PyAxMjcpO1xuXHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLmxhYkNvbG9yT25seSA/IDEgOiAwKTtcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMSk7XG5cdH0sXG4pO1xuXG5mdW5jdGlvbiByZWFkTGV2ZWxzQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IExldmVsc0FkanVzdG1lbnRDaGFubmVsIHtcblx0Y29uc3Qgc2hhZG93SW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcblx0Y29uc3QgaGlnaGxpZ2h0SW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcblx0Y29uc3Qgc2hhZG93T3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XG5cdGNvbnN0IGhpZ2hsaWdodE91dHB1dCA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRjb25zdCBtaWR0b25lSW5wdXQgPSByZWFkSW50MTYocmVhZGVyKSAvIDEwMDtcblx0cmV0dXJuIHsgc2hhZG93SW5wdXQsIGhpZ2hsaWdodElucHV0LCBzaGFkb3dPdXRwdXQsIGhpZ2hsaWdodE91dHB1dCwgbWlkdG9uZUlucHV0IH07XG59XG5cbmZ1bmN0aW9uIHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXI6IFBzZFdyaXRlciwgY2hhbm5lbDogTGV2ZWxzQWRqdXN0bWVudENoYW5uZWwpIHtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGNoYW5uZWwuc2hhZG93SW5wdXQpO1xuXHR3cml0ZUludDE2KHdyaXRlciwgY2hhbm5lbC5oaWdobGlnaHRJbnB1dCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjaGFubmVsLnNoYWRvd091dHB1dCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjaGFubmVsLmhpZ2hsaWdodE91dHB1dCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBNYXRoLnJvdW5kKGNoYW5uZWwubWlkdG9uZUlucHV0ICogMTAwKSk7XG59XG5cbmFkZEhhbmRsZXIoXG5cdCdsZXZsJyxcblx0YWRqdXN0bWVudFR5cGUoJ2xldmVscycpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGV2bCB2ZXJzaW9uJyk7XG5cblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXG5cdFx0XHR0eXBlOiAnbGV2ZWxzJyxcblx0XHRcdHJnYjogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcblx0XHRcdHJlZDogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcblx0XHRcdGdyZWVuOiByZWFkTGV2ZWxzQ2hhbm5lbChyZWFkZXIpLFxuXHRcdFx0Ymx1ZTogcmVhZExldmVsc0NoYW5uZWwocmVhZGVyKSxcblx0XHR9O1xuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIExldmVsc0FkanVzdG1lbnQ7XG5cdFx0Y29uc3QgZGVmYXVsdENoYW5uZWwgPSB7XG5cdFx0XHRzaGFkb3dJbnB1dDogMCxcblx0XHRcdGhpZ2hsaWdodElucHV0OiAyNTUsXG5cdFx0XHRzaGFkb3dPdXRwdXQ6IDAsXG5cdFx0XHRoaWdobGlnaHRPdXRwdXQ6IDI1NSxcblx0XHRcdG1pZHRvbmVJbnB1dDogMSxcblx0XHR9O1xuXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAyKTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGluZm8ucmdiIHx8IGRlZmF1bHRDaGFubmVsKTtcblx0XHR3cml0ZUxldmVsc0NoYW5uZWwod3JpdGVyLCBpbmZvLnJlZCB8fCBkZWZhdWx0Q2hhbm5lbCk7XG5cdFx0d3JpdGVMZXZlbHNDaGFubmVsKHdyaXRlciwgaW5mby5ibHVlIHx8IGRlZmF1bHRDaGFubmVsKTtcblx0XHR3cml0ZUxldmVsc0NoYW5uZWwod3JpdGVyLCBpbmZvLmdyZWVuIHx8IGRlZmF1bHRDaGFubmVsKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDU5OyBpKyspIHdyaXRlTGV2ZWxzQ2hhbm5lbCh3cml0ZXIsIGRlZmF1bHRDaGFubmVsKTtcblx0fSxcbik7XG5cbmZ1bmN0aW9uIHJlYWRDdXJ2ZUNoYW5uZWwocmVhZGVyOiBQc2RSZWFkZXIpIHtcblx0Y29uc3Qgbm9kZXMgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdGNvbnN0IGNoYW5uZWw6IEN1cnZlc0FkanVzdG1lbnRDaGFubmVsID0gW107XG5cblx0Zm9yIChsZXQgaiA9IDA7IGogPCBub2RlczsgaisrKSB7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XG5cdFx0Y29uc3QgaW5wdXQgPSByZWFkSW50MTYocmVhZGVyKTtcblx0XHRjaGFubmVsLnB1c2goeyBpbnB1dCwgb3V0cHV0IH0pO1xuXHR9XG5cblx0cmV0dXJuIGNoYW5uZWw7XG59XG5cbmZ1bmN0aW9uIHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlcjogUHNkV3JpdGVyLCBjaGFubmVsOiBDdXJ2ZXNBZGp1c3RtZW50Q2hhbm5lbCkge1xuXHR3cml0ZVVpbnQxNih3cml0ZXIsIGNoYW5uZWwubGVuZ3RoKTtcblxuXHRmb3IgKGNvbnN0IG4gb2YgY2hhbm5lbCkge1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgbi5vdXRwdXQpO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgbi5pbnB1dCk7XG5cdH1cbn1cblxuYWRkSGFuZGxlcihcblx0J2N1cnYnLFxuXHRhZGp1c3RtZW50VHlwZSgnY3VydmVzJyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdHJlYWRVaW50OChyZWFkZXIpO1xuXHRcdGlmIChyZWFkVWludDE2KHJlYWRlcikgIT09IDEpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjdXJ2IHZlcnNpb24nKTtcblx0XHRyZWFkVWludDE2KHJlYWRlcik7XG5cdFx0Y29uc3QgY2hhbm5lbHMgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0Y29uc3QgaW5mbzogQ3VydmVzQWRqdXN0bWVudCA9IHsgdHlwZTogJ2N1cnZlcycgfTtcblxuXHRcdGlmIChjaGFubmVscyAmIDEpIGluZm8ucmdiID0gcmVhZEN1cnZlQ2hhbm5lbChyZWFkZXIpO1xuXHRcdGlmIChjaGFubmVscyAmIDIpIGluZm8ucmVkID0gcmVhZEN1cnZlQ2hhbm5lbChyZWFkZXIpO1xuXHRcdGlmIChjaGFubmVscyAmIDQpIGluZm8uZ3JlZW4gPSByZWFkQ3VydmVDaGFubmVsKHJlYWRlcik7XG5cdFx0aWYgKGNoYW5uZWxzICYgOCkgaW5mby5ibHVlID0gcmVhZEN1cnZlQ2hhbm5lbChyZWFkZXIpO1xuXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XG5cdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBQcmVzZXRJbmZvLFxuXHRcdFx0Li4uaW5mbyxcblx0XHR9O1xuXG5cdFx0Ly8gaWdub3JpbmcsIGR1cGxpY2F0ZSBpbmZvcm1hdGlvblxuXHRcdC8vIGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJ0NydiAnKTtcblxuXHRcdC8vIGNvbnN0IGNWZXJzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdC8vIHJlYWRVaW50MTYocmVhZGVyKTtcblx0XHQvLyBjb25zdCBjaGFubmVsQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0XHQvLyBmb3IgKGxldCBpID0gMDsgaSA8IGNoYW5uZWxDb3VudDsgaSsrKSB7XG5cdFx0Ly8gXHRjb25zdCBpbmRleCA9IHJlYWRVaW50MTYocmVhZGVyKTtcblx0XHQvLyBcdGNvbnN0IG5vZGVzID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXG5cdFx0Ly8gXHRmb3IgKGxldCBqID0gMDsgaiA8IG5vZGVzOyBqKyspIHtcblx0XHQvLyBcdFx0Y29uc3Qgb3V0cHV0ID0gcmVhZEludDE2KHJlYWRlcik7XG5cdFx0Ly8gXHRcdGNvbnN0IGlucHV0ID0gcmVhZEludDE2KHJlYWRlcik7XG5cdFx0Ly8gXHR9XG5cdFx0Ly8gfVxuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIEN1cnZlc0FkanVzdG1lbnQ7XG5cdFx0Y29uc3QgeyByZ2IsIHJlZCwgZ3JlZW4sIGJsdWUgfSA9IGluZm87XG5cdFx0bGV0IGNoYW5uZWxzID0gMDtcblx0XHRsZXQgY2hhbm5lbENvdW50ID0gMDtcblxuXHRcdGlmIChyZ2IgJiYgcmdiLmxlbmd0aCkgeyBjaGFubmVscyB8PSAxOyBjaGFubmVsQ291bnQrKzsgfVxuXHRcdGlmIChyZWQgJiYgcmVkLmxlbmd0aCkgeyBjaGFubmVscyB8PSAyOyBjaGFubmVsQ291bnQrKzsgfVxuXHRcdGlmIChncmVlbiAmJiBncmVlbi5sZW5ndGgpIHsgY2hhbm5lbHMgfD0gNDsgY2hhbm5lbENvdW50Kys7IH1cblx0XHRpZiAoYmx1ZSAmJiBibHVlLmxlbmd0aCkgeyBjaGFubmVscyB8PSA4OyBjaGFubmVsQ291bnQrKzsgfVxuXG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIDApO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMSk7IC8vIHZlcnNpb25cblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDApO1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgY2hhbm5lbHMpO1xuXG5cdFx0aWYgKHJnYiAmJiByZ2IubGVuZ3RoKSB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJnYik7XG5cdFx0aWYgKHJlZCAmJiByZWQubGVuZ3RoKSB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJlZCk7XG5cdFx0aWYgKGdyZWVuICYmIGdyZWVuLmxlbmd0aCkgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBncmVlbik7XG5cdFx0aWYgKGJsdWUgJiYgYmx1ZS5sZW5ndGgpIHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgYmx1ZSk7XG5cblx0XHR3cml0ZVNpZ25hdHVyZSh3cml0ZXIsICdDcnYgJyk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCA0KTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMCk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBjaGFubmVsQ291bnQpO1xuXG5cdFx0aWYgKHJnYiAmJiByZ2IubGVuZ3RoKSB7IHdyaXRlVWludDE2KHdyaXRlciwgMCk7IHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgcmdiKTsgfVxuXHRcdGlmIChyZWQgJiYgcmVkLmxlbmd0aCkgeyB3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyB3cml0ZUN1cnZlQ2hhbm5lbCh3cml0ZXIsIHJlZCk7IH1cblx0XHRpZiAoZ3JlZW4gJiYgZ3JlZW4ubGVuZ3RoKSB7IHdyaXRlVWludDE2KHdyaXRlciwgMik7IHdyaXRlQ3VydmVDaGFubmVsKHdyaXRlciwgZ3JlZW4pOyB9XG5cdFx0aWYgKGJsdWUgJiYgYmx1ZS5sZW5ndGgpIHsgd3JpdGVVaW50MTYod3JpdGVyLCAzKTsgd3JpdGVDdXJ2ZUNoYW5uZWwod3JpdGVyLCBibHVlKTsgfVxuXG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J2V4cEEnLFxuXHRhZGp1c3RtZW50VHlwZSgnZXhwb3N1cmUnKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGV4cEEgdmVyc2lvbicpO1xuXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XG5cdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBQcmVzZXRJbmZvLFxuXHRcdFx0dHlwZTogJ2V4cG9zdXJlJyxcblx0XHRcdGV4cG9zdXJlOiByZWFkRmxvYXQzMihyZWFkZXIpLFxuXHRcdFx0b2Zmc2V0OiByZWFkRmxvYXQzMihyZWFkZXIpLFxuXHRcdFx0Z2FtbWE6IHJlYWRGbG9hdDMyKHJlYWRlciksXG5cdFx0fTtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBFeHBvc3VyZUFkanVzdG1lbnQ7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIGluZm8uZXhwb3N1cmUhKTtcblx0XHR3cml0ZUZsb2F0MzIod3JpdGVyLCBpbmZvLm9mZnNldCEpO1xuXHRcdHdyaXRlRmxvYXQzMih3cml0ZXIsIGluZm8uZ2FtbWEhKTtcblx0XHR3cml0ZVplcm9zKHdyaXRlciwgMik7XG5cdH0sXG4pO1xuXG5pbnRlcmZhY2UgVmlicmFuY2VEZXNjcmlwdG9yIHtcblx0dmlicmFuY2U/OiBudW1iZXI7XG5cdFN0cnQ/OiBudW1iZXI7XG59XG5cbmFkZEhhbmRsZXIoXG5cdCd2aWJBJyxcblx0YWRqdXN0bWVudFR5cGUoJ3ZpYnJhbmNlJyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnN0IGRlc2M6IFZpYnJhbmNlRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0geyB0eXBlOiAndmlicmFuY2UnIH07XG5cdFx0aWYgKGRlc2MudmlicmFuY2UgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LmFkanVzdG1lbnQudmlicmFuY2UgPSBkZXNjLnZpYnJhbmNlO1xuXHRcdGlmIChkZXNjLlN0cnQgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LmFkanVzdG1lbnQuc2F0dXJhdGlvbiA9IGRlc2MuU3RydDtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBWaWJyYW5jZUFkanVzdG1lbnQ7XG5cdFx0Y29uc3QgZGVzYzogVmlicmFuY2VEZXNjcmlwdG9yID0ge307XG5cdFx0aWYgKGluZm8udmlicmFuY2UgIT09IHVuZGVmaW5lZCkgZGVzYy52aWJyYW5jZSA9IGluZm8udmlicmFuY2U7XG5cdFx0aWYgKGluZm8uc2F0dXJhdGlvbiAhPT0gdW5kZWZpbmVkKSBkZXNjLlN0cnQgPSBpbmZvLnNhdHVyYXRpb247XG5cblx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XG5cdH0sXG4pO1xuXG5mdW5jdGlvbiByZWFkSHVlQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50Q2hhbm5lbCB7XG5cdHJldHVybiB7XG5cdFx0YTogcmVhZEludDE2KHJlYWRlciksXG5cdFx0YjogcmVhZEludDE2KHJlYWRlciksXG5cdFx0YzogcmVhZEludDE2KHJlYWRlciksXG5cdFx0ZDogcmVhZEludDE2KHJlYWRlciksXG5cdFx0aHVlOiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRzYXR1cmF0aW9uOiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRsaWdodG5lc3M6IHJlYWRJbnQxNihyZWFkZXIpLFxuXHR9O1xufVxuXG5mdW5jdGlvbiB3cml0ZUh1ZUNoYW5uZWwod3JpdGVyOiBQc2RXcml0ZXIsIGNoYW5uZWw6IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50Q2hhbm5lbCB8IHVuZGVmaW5lZCkge1xuXHRjb25zdCBjID0gY2hhbm5lbCB8fCB7fSBhcyBQYXJ0aWFsPEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50Q2hhbm5lbD47XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmEgfHwgMCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmIgfHwgMCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmMgfHwgMCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmQgfHwgMCk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmh1ZSB8fCAwKTtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuc2F0dXJhdGlvbiB8fCAwKTtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMubGlnaHRuZXNzIHx8IDApO1xufVxuXG5hZGRIYW5kbGVyKFxuXHQnaHVlMicsXG5cdGFkanVzdG1lbnRUeXBlKCdodWUvc2F0dXJhdGlvbicpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaHVlMiB2ZXJzaW9uJyk7XG5cblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIFByZXNldEluZm8sXG5cdFx0XHR0eXBlOiAnaHVlL3NhdHVyYXRpb24nLFxuXHRcdFx0bWFzdGVyOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxuXHRcdFx0cmVkczogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcblx0XHRcdHllbGxvd3M6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXG5cdFx0XHRncmVlbnM6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXG5cdFx0XHRjeWFuczogcmVhZEh1ZUNoYW5uZWwocmVhZGVyKSxcblx0XHRcdGJsdWVzOiByZWFkSHVlQ2hhbm5lbChyZWFkZXIpLFxuXHRcdFx0bWFnZW50YXM6IHJlYWRIdWVDaGFubmVsKHJlYWRlciksXG5cdFx0fTtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBIdWVTYXR1cmF0aW9uQWRqdXN0bWVudDtcblxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7IC8vIHZlcnNpb25cblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLm1hc3Rlcik7XG5cdFx0d3JpdGVIdWVDaGFubmVsKHdyaXRlciwgaW5mby5yZWRzKTtcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLnllbGxvd3MpO1xuXHRcdHdyaXRlSHVlQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JlZW5zKTtcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLmN5YW5zKTtcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLmJsdWVzKTtcblx0XHR3cml0ZUh1ZUNoYW5uZWwod3JpdGVyLCBpbmZvLm1hZ2VudGFzKTtcblx0fSxcbik7XG5cbmZ1bmN0aW9uIHJlYWRDb2xvckJhbGFuY2UocmVhZGVyOiBQc2RSZWFkZXIpOiBDb2xvckJhbGFuY2VWYWx1ZXMge1xuXHRyZXR1cm4ge1xuXHRcdGN5YW5SZWQ6IHJlYWRJbnQxNihyZWFkZXIpLFxuXHRcdG1hZ2VudGFHcmVlbjogcmVhZEludDE2KHJlYWRlciksXG5cdFx0eWVsbG93Qmx1ZTogcmVhZEludDE2KHJlYWRlciksXG5cdH07XG59XG5cbmZ1bmN0aW9uIHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlcjogUHNkV3JpdGVyLCB2YWx1ZTogUGFydGlhbDxDb2xvckJhbGFuY2VWYWx1ZXM+KSB7XG5cdHdyaXRlSW50MTYod3JpdGVyLCB2YWx1ZS5jeWFuUmVkIHx8IDApO1xuXHR3cml0ZUludDE2KHdyaXRlciwgdmFsdWUubWFnZW50YUdyZWVuIHx8IDApO1xuXHR3cml0ZUludDE2KHdyaXRlciwgdmFsdWUueWVsbG93Qmx1ZSB8fCAwKTtcbn1cblxuYWRkSGFuZGxlcihcblx0J2JsbmMnLFxuXHRhZGp1c3RtZW50VHlwZSgnY29sb3IgYmFsYW5jZScpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdHR5cGU6ICdjb2xvciBiYWxhbmNlJyxcblx0XHRcdHNoYWRvd3M6IHJlYWRDb2xvckJhbGFuY2UocmVhZGVyKSxcblx0XHRcdG1pZHRvbmVzOiByZWFkQ29sb3JCYWxhbmNlKHJlYWRlciksXG5cdFx0XHRoaWdobGlnaHRzOiByZWFkQ29sb3JCYWxhbmNlKHJlYWRlciksXG5cdFx0XHRwcmVzZXJ2ZUx1bWlub3NpdHk6ICEhcmVhZFVpbnQ4KHJlYWRlciksXG5cdFx0fTtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDb2xvckJhbGFuY2VBZGp1c3RtZW50O1xuXHRcdHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlciwgaW5mby5zaGFkb3dzIHx8IHt9KTtcblx0XHR3cml0ZUNvbG9yQmFsYW5jZSh3cml0ZXIsIGluZm8ubWlkdG9uZXMgfHwge30pO1xuXHRcdHdyaXRlQ29sb3JCYWxhbmNlKHdyaXRlciwgaW5mby5oaWdobGlnaHRzIHx8IHt9KTtcblx0XHR3cml0ZVVpbnQ4KHdyaXRlciwgaW5mby5wcmVzZXJ2ZUx1bWlub3NpdHkgPyAxIDogMCk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDEpO1xuXHR9LFxuKTtcblxuaW50ZXJmYWNlIEJsYWNrQW5kV2hpdGVEZXNjcmlwdG9yIHtcblx0J1JkICAnOiBudW1iZXI7XG5cdFlsbHc6IG51bWJlcjtcblx0J0dybiAnOiBudW1iZXI7XG5cdCdDeW4gJzogbnVtYmVyO1xuXHQnQmwgICc6IG51bWJlcjtcblx0TWdudDogbnVtYmVyO1xuXHR1c2VUaW50OiBib29sZWFuO1xuXHR0aW50Q29sb3I/OiBEZXNjcmlwdG9yQ29sb3I7XG5cdGJ3UHJlc2V0S2luZDogbnVtYmVyO1xuXHRibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWU6IHN0cmluZztcbn1cblxuYWRkSGFuZGxlcihcblx0J2Jsd2gnLFxuXHRhZGp1c3RtZW50VHlwZSgnYmxhY2sgJiB3aGl0ZScpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRjb25zdCBkZXNjOiBCbGFja0FuZFdoaXRlRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xuXHRcdFx0dHlwZTogJ2JsYWNrICYgd2hpdGUnLFxuXHRcdFx0cmVkczogZGVzY1snUmQgICddLFxuXHRcdFx0eWVsbG93czogZGVzYy5ZbGx3LFxuXHRcdFx0Z3JlZW5zOiBkZXNjWydHcm4gJ10sXG5cdFx0XHRjeWFuczogZGVzY1snQ3luICddLFxuXHRcdFx0Ymx1ZXM6IGRlc2NbJ0JsICAnXSxcblx0XHRcdG1hZ2VudGFzOiBkZXNjLk1nbnQsXG5cdFx0XHR1c2VUaW50OiAhIWRlc2MudXNlVGludCxcblx0XHRcdHByZXNldEtpbmQ6IGRlc2MuYndQcmVzZXRLaW5kLFxuXHRcdFx0cHJlc2V0RmlsZU5hbWU6IGRlc2MuYmxhY2tBbmRXaGl0ZVByZXNldEZpbGVOYW1lLFxuXHRcdH07XG5cblx0XHRpZiAoZGVzYy50aW50Q29sb3IgIT09IHVuZGVmaW5lZCkgdGFyZ2V0LmFkanVzdG1lbnQudGludENvbG9yID0gcGFyc2VDb2xvcihkZXNjLnRpbnRDb2xvcik7XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgQmxhY2tBbmRXaGl0ZUFkanVzdG1lbnQ7XG5cdFx0Y29uc3QgZGVzYzogQmxhY2tBbmRXaGl0ZURlc2NyaXB0b3IgPSB7XG5cdFx0XHQnUmQgICc6IGluZm8ucmVkcyB8fCAwLFxuXHRcdFx0WWxsdzogaW5mby55ZWxsb3dzIHx8IDAsXG5cdFx0XHQnR3JuICc6IGluZm8uZ3JlZW5zIHx8IDAsXG5cdFx0XHQnQ3luICc6IGluZm8uY3lhbnMgfHwgMCxcblx0XHRcdCdCbCAgJzogaW5mby5ibHVlcyB8fCAwLFxuXHRcdFx0TWdudDogaW5mby5tYWdlbnRhcyB8fCAwLFxuXHRcdFx0dXNlVGludDogISFpbmZvLnVzZVRpbnQsXG5cdFx0XHR0aW50Q29sb3I6IHNlcmlhbGl6ZUNvbG9yKGluZm8udGludENvbG9yKSxcblx0XHRcdGJ3UHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kIHx8IDAsXG5cdFx0XHRibGFja0FuZFdoaXRlUHJlc2V0RmlsZU5hbWU6IGluZm8ucHJlc2V0RmlsZU5hbWUgfHwgJycsXG5cdFx0fTtcblxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdwaGZsJyxcblx0YWRqdXN0bWVudFR5cGUoJ3Bob3RvIGZpbHRlcicpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRjb25zdCB2ZXJzaW9uID0gcmVhZFVpbnQxNihyZWFkZXIpO1xuXHRcdGlmICh2ZXJzaW9uICE9PSAyICYmIHZlcnNpb24gIT09IDMpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwaGZsIHZlcnNpb24nKTtcblxuXHRcdGxldCBjb2xvcjogQ29sb3I7XG5cblx0XHRpZiAodmVyc2lvbiA9PT0gMikge1xuXHRcdFx0Y29sb3IgPSByZWFkQ29sb3IocmVhZGVyKTtcblx0XHR9IGVsc2UgeyAvLyB2ZXJzaW9uIDNcblx0XHRcdC8vIFRPRE86IHRlc3QgdGhpcywgdGhpcyBpcyBwcm9iYWJseSB3cm9uZ1xuXHRcdFx0Y29sb3IgPSB7XG5cdFx0XHRcdGw6IHJlYWRJbnQzMihyZWFkZXIpIC8gMTAwLFxuXHRcdFx0XHRhOiByZWFkSW50MzIocmVhZGVyKSAvIDEwMCxcblx0XHRcdFx0YjogcmVhZEludDMyKHJlYWRlcikgLyAxMDAsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xuXHRcdFx0dHlwZTogJ3Bob3RvIGZpbHRlcicsXG5cdFx0XHRjb2xvcixcblx0XHRcdGRlbnNpdHk6IHJlYWRVaW50MzIocmVhZGVyKSAvIDEwMCxcblx0XHRcdHByZXNlcnZlTHVtaW5vc2l0eTogISFyZWFkVWludDgocmVhZGVyKSxcblx0XHR9O1xuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIFBob3RvRmlsdGVyQWRqdXN0bWVudDtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDIpOyAvLyB2ZXJzaW9uXG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIGluZm8uY29sb3IgfHwgeyBsOiAwLCBhOiAwLCBiOiAwIH0pO1xuXHRcdHdyaXRlVWludDMyKHdyaXRlciwgKGluZm8uZGVuc2l0eSB8fCAwKSAqIDEwMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8ucHJlc2VydmVMdW1pbm9zaXR5ID8gMSA6IDApO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAzKTtcblx0fSxcbik7XG5cbmZ1bmN0aW9uIHJlYWRNaXhyQ2hhbm5lbChyZWFkZXI6IFBzZFJlYWRlcik6IENoYW5uZWxNaXhlckNoYW5uZWwge1xuXHRjb25zdCByZWQgPSByZWFkSW50MTYocmVhZGVyKTtcblx0Y29uc3QgZ3JlZW4gPSByZWFkSW50MTYocmVhZGVyKTtcblx0Y29uc3QgYmx1ZSA9IHJlYWRJbnQxNihyZWFkZXIpO1xuXHRza2lwQnl0ZXMocmVhZGVyLCAyKTtcblx0Y29uc3QgY29uc3RhbnQgPSByZWFkSW50MTYocmVhZGVyKTtcblx0cmV0dXJuIHsgcmVkLCBncmVlbiwgYmx1ZSwgY29uc3RhbnQgfTtcbn1cblxuZnVuY3Rpb24gd3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXI6IFBzZFdyaXRlciwgY2hhbm5lbDogQ2hhbm5lbE1peGVyQ2hhbm5lbCB8IHVuZGVmaW5lZCkge1xuXHRjb25zdCBjID0gY2hhbm5lbCB8fCB7fSBhcyBQYXJ0aWFsPENoYW5uZWxNaXhlckNoYW5uZWw+O1xuXHR3cml0ZUludDE2KHdyaXRlciwgYy5yZWQhKTtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuZ3JlZW4hKTtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuYmx1ZSEpO1xuXHR3cml0ZVplcm9zKHdyaXRlciwgMik7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLmNvbnN0YW50ISk7XG59XG5cbmFkZEhhbmRsZXIoXG5cdCdtaXhyJyxcblx0YWRqdXN0bWVudFR5cGUoJ2NoYW5uZWwgbWl4ZXInKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG1peHIgdmVyc2lvbicpO1xuXG5cdFx0Y29uc3QgYWRqdXN0bWVudDogQ2hhbm5lbE1peGVyQWRqdXN0bWVudCA9IHRhcmdldC5hZGp1c3RtZW50ID0ge1xuXHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgUHJlc2V0SW5mbyxcblx0XHRcdHR5cGU6ICdjaGFubmVsIG1peGVyJyxcblx0XHRcdG1vbm9jaHJvbWU6ICEhcmVhZFVpbnQxNihyZWFkZXIpLFxuXHRcdH07XG5cblx0XHRpZiAoIWFkanVzdG1lbnQubW9ub2Nocm9tZSkge1xuXHRcdFx0YWRqdXN0bWVudC5yZWQgPSByZWFkTWl4ckNoYW5uZWwocmVhZGVyKTtcblx0XHRcdGFkanVzdG1lbnQuZ3JlZW4gPSByZWFkTWl4ckNoYW5uZWwocmVhZGVyKTtcblx0XHRcdGFkanVzdG1lbnQuYmx1ZSA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xuXHRcdH1cblxuXHRcdGFkanVzdG1lbnQuZ3JheSA9IHJlYWRNaXhyQ2hhbm5lbChyZWFkZXIpO1xuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50IGFzIENoYW5uZWxNaXhlckFkanVzdG1lbnQ7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5tb25vY2hyb21lID8gMSA6IDApO1xuXG5cdFx0aWYgKGluZm8ubW9ub2Nocm9tZSkge1xuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JheSk7XG5cdFx0XHR3cml0ZVplcm9zKHdyaXRlciwgMyAqIDUgKiAyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8ucmVkKTtcblx0XHRcdHdyaXRlTWl4ckNoYW5uZWwod3JpdGVyLCBpbmZvLmdyZWVuKTtcblx0XHRcdHdyaXRlTWl4ckNoYW5uZWwod3JpdGVyLCBpbmZvLmJsdWUpO1xuXHRcdFx0d3JpdGVNaXhyQ2hhbm5lbCh3cml0ZXIsIGluZm8uZ3JheSk7XG5cdFx0fVxuXHR9LFxuKTtcblxuY29uc3QgY29sb3JMb29rdXBUeXBlID0gY3JlYXRlRW51bTwnM2RsdXQnIHwgJ2Fic3RyYWN0UHJvZmlsZScgfCAnZGV2aWNlTGlua1Byb2ZpbGUnPignY29sb3JMb29rdXBUeXBlJywgJzNETFVUJywge1xuXHQnM2RsdXQnOiAnM0RMVVQnLFxuXHRhYnN0cmFjdFByb2ZpbGU6ICdhYnN0cmFjdFByb2ZpbGUnLFxuXHRkZXZpY2VMaW5rUHJvZmlsZTogJ2RldmljZUxpbmtQcm9maWxlJyxcbn0pO1xuXG5jb25zdCBMVVRGb3JtYXRUeXBlID0gY3JlYXRlRW51bTwnbG9vaycgfCAnY3ViZScgfCAnM2RsJz4oJ0xVVEZvcm1hdFR5cGUnLCAnbG9vaycsIHtcblx0bG9vazogJ0xVVEZvcm1hdExPT0snLFxuXHRjdWJlOiAnTFVURm9ybWF0Q1VCRScsXG5cdCczZGwnOiAnTFVURm9ybWF0M0RMJyxcbn0pO1xuXG5jb25zdCBjb2xvckxvb2t1cE9yZGVyID0gY3JlYXRlRW51bTwncmdiJyB8ICdiZ3InPignY29sb3JMb29rdXBPcmRlcicsICdyZ2InLCB7XG5cdHJnYjogJ3JnYk9yZGVyJyxcblx0YmdyOiAnYmdyT3JkZXInLFxufSk7XG5cbmludGVyZmFjZSBDb2xvckxvb2t1cERlc2NyaXB0b3Ige1xuXHRsb29rdXBUeXBlPzogc3RyaW5nO1xuXHQnTm0gICc/OiBzdHJpbmc7XG5cdER0aHI/OiBib29sZWFuO1xuXHRwcm9maWxlPzogVWludDhBcnJheTtcblx0TFVURm9ybWF0Pzogc3RyaW5nO1xuXHRkYXRhT3JkZXI/OiBzdHJpbmc7XG5cdHRhYmxlT3JkZXI/OiBzdHJpbmc7XG5cdExVVDNERmlsZURhdGE/OiBVaW50OEFycmF5O1xuXHRMVVQzREZpbGVOYW1lPzogc3RyaW5nO1xufVxuXG5hZGRIYW5kbGVyKFxuXHQnY2xyTCcsXG5cdGFkanVzdG1lbnRUeXBlKCdjb2xvciBsb29rdXAnKSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNsckwgdmVyc2lvbicpO1xuXG5cdFx0Y29uc3QgZGVzYzogQ29sb3JMb29rdXBEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7IHR5cGU6ICdjb2xvciBsb29rdXAnIH07XG5cdFx0Y29uc3QgaW5mbyA9IHRhcmdldC5hZGp1c3RtZW50O1xuXG5cdFx0aWYgKGRlc2MubG9va3VwVHlwZSAhPT0gdW5kZWZpbmVkKSBpbmZvLmxvb2t1cFR5cGUgPSBjb2xvckxvb2t1cFR5cGUuZGVjb2RlKGRlc2MubG9va3VwVHlwZSk7XG5cdFx0aWYgKGRlc2NbJ05tICAnXSAhPT0gdW5kZWZpbmVkKSBpbmZvLm5hbWUgPSBkZXNjWydObSAgJ107XG5cdFx0aWYgKGRlc2MuRHRociAhPT0gdW5kZWZpbmVkKSBpbmZvLmRpdGhlciA9IGRlc2MuRHRocjtcblx0XHRpZiAoZGVzYy5wcm9maWxlICE9PSB1bmRlZmluZWQpIGluZm8ucHJvZmlsZSA9IGRlc2MucHJvZmlsZTtcblx0XHRpZiAoZGVzYy5MVVRGb3JtYXQgIT09IHVuZGVmaW5lZCkgaW5mby5sdXRGb3JtYXQgPSBMVVRGb3JtYXRUeXBlLmRlY29kZShkZXNjLkxVVEZvcm1hdCk7XG5cdFx0aWYgKGRlc2MuZGF0YU9yZGVyICE9PSB1bmRlZmluZWQpIGluZm8uZGF0YU9yZGVyID0gY29sb3JMb29rdXBPcmRlci5kZWNvZGUoZGVzYy5kYXRhT3JkZXIpO1xuXHRcdGlmIChkZXNjLnRhYmxlT3JkZXIgIT09IHVuZGVmaW5lZCkgaW5mby50YWJsZU9yZGVyID0gY29sb3JMb29rdXBPcmRlci5kZWNvZGUoZGVzYy50YWJsZU9yZGVyKTtcblx0XHRpZiAoZGVzYy5MVVQzREZpbGVEYXRhICE9PSB1bmRlZmluZWQpIGluZm8ubHV0M0RGaWxlRGF0YSA9IGRlc2MuTFVUM0RGaWxlRGF0YTtcblx0XHRpZiAoZGVzYy5MVVQzREZpbGVOYW1lICE9PSB1bmRlZmluZWQpIGluZm8ubHV0M0RGaWxlTmFtZSA9IGRlc2MuTFVUM0RGaWxlTmFtZTtcblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBDb2xvckxvb2t1cEFkanVzdG1lbnQ7XG5cdFx0Y29uc3QgZGVzYzogQ29sb3JMb29rdXBEZXNjcmlwdG9yID0ge307XG5cblx0XHRpZiAoaW5mby5sb29rdXBUeXBlICE9PSB1bmRlZmluZWQpIGRlc2MubG9va3VwVHlwZSA9IGNvbG9yTG9va3VwVHlwZS5lbmNvZGUoaW5mby5sb29rdXBUeXBlKTtcblx0XHRpZiAoaW5mby5uYW1lICE9PSB1bmRlZmluZWQpIGRlc2NbJ05tICAnXSA9IGluZm8ubmFtZTtcblx0XHRpZiAoaW5mby5kaXRoZXIgIT09IHVuZGVmaW5lZCkgZGVzYy5EdGhyID0gaW5mby5kaXRoZXI7XG5cdFx0aWYgKGluZm8ucHJvZmlsZSAhPT0gdW5kZWZpbmVkKSBkZXNjLnByb2ZpbGUgPSBpbmZvLnByb2ZpbGU7XG5cdFx0aWYgKGluZm8ubHV0Rm9ybWF0ICE9PSB1bmRlZmluZWQpIGRlc2MuTFVURm9ybWF0ID0gTFVURm9ybWF0VHlwZS5lbmNvZGUoaW5mby5sdXRGb3JtYXQpO1xuXHRcdGlmIChpbmZvLmRhdGFPcmRlciAhPT0gdW5kZWZpbmVkKSBkZXNjLmRhdGFPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZW5jb2RlKGluZm8uZGF0YU9yZGVyKTtcblx0XHRpZiAoaW5mby50YWJsZU9yZGVyICE9PSB1bmRlZmluZWQpIGRlc2MudGFibGVPcmRlciA9IGNvbG9yTG9va3VwT3JkZXIuZW5jb2RlKGluZm8udGFibGVPcmRlcik7XG5cdFx0aWYgKGluZm8ubHV0M0RGaWxlRGF0YSAhPT0gdW5kZWZpbmVkKSBkZXNjLkxVVDNERmlsZURhdGEgPSBpbmZvLmx1dDNERmlsZURhdGE7XG5cdFx0aWYgKGluZm8ubHV0M0RGaWxlTmFtZSAhPT0gdW5kZWZpbmVkKSBkZXNjLkxVVDNERmlsZU5hbWUgPSBpbmZvLmx1dDNERmlsZU5hbWU7XG5cblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J252cnQnLFxuXHRhZGp1c3RtZW50VHlwZSgnaW52ZXJ0JyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdHRhcmdldC5hZGp1c3RtZW50ID0geyB0eXBlOiAnaW52ZXJ0JyB9O1xuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCgpID0+IHtcblx0XHQvLyBub3RoaW5nIHRvIHdyaXRlIGhlcmVcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCdwb3N0Jyxcblx0YWRqdXN0bWVudFR5cGUoJ3Bvc3Rlcml6ZScpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdHR5cGU6ICdwb3N0ZXJpemUnLFxuXHRcdFx0bGV2ZWxzOiByZWFkVWludDE2KHJlYWRlciksXG5cdFx0fTtcblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgUG9zdGVyaXplQWRqdXN0bWVudDtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ubGV2ZWxzID8/IDQpO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcblx0fSxcbik7XG5cbmFkZEhhbmRsZXIoXG5cdCd0aHJzJyxcblx0YWRqdXN0bWVudFR5cGUoJ3RocmVzaG9sZCcpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdHR5cGU6ICd0aHJlc2hvbGQnLFxuXHRcdFx0bGV2ZWw6IHJlYWRVaW50MTYocmVhZGVyKSxcblx0XHR9O1xuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBUaHJlc2hvbGRBZGp1c3RtZW50O1xuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5sZXZlbCA/PyAxMjgpO1xuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCAyKTtcblx0fSxcbik7XG5cbmNvbnN0IGdyZG1Db2xvck1vZGVscyA9IFsnJywgJycsICcnLCAncmdiJywgJ2hzYicsICcnLCAnbGFiJ107XG5cbmFkZEhhbmRsZXIoXG5cdCdncmRtJyxcblx0YWRqdXN0bWVudFR5cGUoJ2dyYWRpZW50IG1hcCcpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRpZiAocmVhZFVpbnQxNihyZWFkZXIpICE9PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZ3JkbSB2ZXJzaW9uJyk7XG5cblx0XHRjb25zdCBpbmZvOiBHcmFkaWVudE1hcEFkanVzdG1lbnQgPSB7XG5cdFx0XHR0eXBlOiAnZ3JhZGllbnQgbWFwJyxcblx0XHRcdGdyYWRpZW50VHlwZTogJ3NvbGlkJyxcblx0XHR9O1xuXG5cdFx0aW5mby5yZXZlcnNlID0gISFyZWFkVWludDgocmVhZGVyKTtcblx0XHRpbmZvLmRpdGhlciA9ICEhcmVhZFVpbnQ4KHJlYWRlcik7XG5cdFx0aW5mby5uYW1lID0gcmVhZFVuaWNvZGVTdHJpbmcocmVhZGVyKTtcblx0XHRpbmZvLmNvbG9yU3RvcHMgPSBbXTtcblx0XHRpbmZvLm9wYWNpdHlTdG9wcyA9IFtdO1xuXG5cdFx0Y29uc3Qgc3RvcHNDb3VudCA9IHJlYWRVaW50MTYocmVhZGVyKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3RvcHNDb3VudDsgaSsrKSB7XG5cdFx0XHRpbmZvLmNvbG9yU3RvcHMucHVzaCh7XG5cdFx0XHRcdGxvY2F0aW9uOiByZWFkVWludDMyKHJlYWRlciksXG5cdFx0XHRcdG1pZHBvaW50OiByZWFkVWludDMyKHJlYWRlcikgLyAxMDAsXG5cdFx0XHRcdGNvbG9yOiByZWFkQ29sb3IocmVhZGVyKSxcblx0XHRcdH0pO1xuXHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgMik7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3BhY2l0eVN0b3BzQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG9wYWNpdHlTdG9wc0NvdW50OyBpKyspIHtcblx0XHRcdGluZm8ub3BhY2l0eVN0b3BzLnB1c2goe1xuXHRcdFx0XHRsb2NhdGlvbjogcmVhZFVpbnQzMihyZWFkZXIpLFxuXHRcdFx0XHRtaWRwb2ludDogcmVhZFVpbnQzMihyZWFkZXIpIC8gMTAwLFxuXHRcdFx0XHRvcGFjaXR5OiByZWFkVWludDE2KHJlYWRlcikgLyAweGZmLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhwYW5zaW9uQ291bnQgPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0aWYgKGV4cGFuc2lvbkNvdW50ICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZ3JkbSBleHBhbnNpb24gY291bnQnKTtcblxuXHRcdGNvbnN0IGludGVycG9sYXRpb24gPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0aW5mby5zbW9vdGhuZXNzID0gaW50ZXJwb2xhdGlvbiAvIDQwOTY7XG5cblx0XHRjb25zdCBsZW5ndGggPSByZWFkVWludDE2KHJlYWRlcik7XG5cdFx0aWYgKGxlbmd0aCAhPT0gMzIpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBncmRtIGxlbmd0aCcpO1xuXG5cdFx0aW5mby5ncmFkaWVudFR5cGUgPSByZWFkVWludDE2KHJlYWRlcikgPyAnbm9pc2UnIDogJ3NvbGlkJztcblx0XHRpbmZvLnJhbmRvbVNlZWQgPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0aW5mby5hZGRUcmFuc3BhcmVuY3kgPSAhIXJlYWRVaW50MTYocmVhZGVyKTtcblx0XHRpbmZvLnJlc3RyaWN0Q29sb3JzID0gISFyZWFkVWludDE2KHJlYWRlcik7XG5cdFx0aW5mby5yb3VnaG5lc3MgPSByZWFkVWludDMyKHJlYWRlcikgLyA0MDk2O1xuXHRcdGluZm8uY29sb3JNb2RlbCA9IChncmRtQ29sb3JNb2RlbHNbcmVhZFVpbnQxNihyZWFkZXIpXSB8fCAncmdiJykgYXMgJ3JnYicgfCAnaHNiJyB8ICdsYWInO1xuXG5cdFx0aW5mby5taW4gPSBbXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXG5cdFx0XHRyZWFkVWludDE2KHJlYWRlcikgLyAweDgwMDAsXG5cdFx0XTtcblxuXHRcdGluZm8ubWF4ID0gW1xuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxuXHRcdFx0cmVhZFVpbnQxNihyZWFkZXIpIC8gMHg4MDAwLFxuXHRcdF07XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXG5cdFx0Zm9yIChjb25zdCBzIG9mIGluZm8uY29sb3JTdG9wcykgcy5sb2NhdGlvbiAvPSBpbnRlcnBvbGF0aW9uO1xuXHRcdGZvciAoY29uc3QgcyBvZiBpbmZvLm9wYWNpdHlTdG9wcykgcy5sb2NhdGlvbiAvPSBpbnRlcnBvbGF0aW9uO1xuXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSBpbmZvO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQgYXMgR3JhZGllbnRNYXBBZGp1c3RtZW50O1xuXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAxKTsgLy8gdmVyc2lvblxuXHRcdHdyaXRlVWludDgod3JpdGVyLCBpbmZvLnJldmVyc2UgPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50OCh3cml0ZXIsIGluZm8uZGl0aGVyID8gMSA6IDApO1xuXHRcdHdyaXRlVW5pY29kZVN0cmluZ1dpdGhQYWRkaW5nKHdyaXRlciwgaW5mby5uYW1lIHx8ICcnKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8uY29sb3JTdG9wcyAmJiBpbmZvLmNvbG9yU3RvcHMubGVuZ3RoIHx8IDApO1xuXG5cdFx0Y29uc3QgaW50ZXJwb2xhdGlvbiA9IE1hdGgucm91bmQoKGluZm8uc21vb3RobmVzcyA/PyAxKSAqIDQwOTYpO1xuXG5cdFx0Zm9yIChjb25zdCBzIG9mIGluZm8uY29sb3JTdG9wcyB8fCBbXSkge1xuXHRcdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKHMubG9jYXRpb24gKiBpbnRlcnBvbGF0aW9uKSk7XG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQocy5taWRwb2ludCAqIDEwMCkpO1xuXHRcdFx0d3JpdGVDb2xvcih3cml0ZXIsIHMuY29sb3IpO1xuXHRcdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDIpO1xuXHRcdH1cblxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5vcGFjaXR5U3RvcHMgJiYgaW5mby5vcGFjaXR5U3RvcHMubGVuZ3RoIHx8IDApO1xuXG5cdFx0Zm9yIChjb25zdCBzIG9mIGluZm8ub3BhY2l0eVN0b3BzIHx8IFtdKSB7XG5cdFx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIE1hdGgucm91bmQocy5sb2NhdGlvbiAqIGludGVycG9sYXRpb24pKTtcblx0XHRcdHdyaXRlVWludDMyKHdyaXRlciwgTWF0aC5yb3VuZChzLm1pZHBvaW50ICogMTAwKSk7XG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQocy5vcGFjaXR5ICogMHhmZikpO1xuXHRcdH1cblxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgMik7IC8vIGV4cGFuc2lvbiBjb3VudFxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW50ZXJwb2xhdGlvbik7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCAzMik7IC8vIGxlbmd0aFxuXHRcdHdyaXRlVWludDE2KHdyaXRlciwgaW5mby5ncmFkaWVudFR5cGUgPT09ICdub2lzZScgPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBpbmZvLnJhbmRvbVNlZWQgfHwgMCk7XG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLmFkZFRyYW5zcGFyZW5jeSA/IDEgOiAwKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGluZm8ucmVzdHJpY3RDb2xvcnMgPyAxIDogMCk7XG5cdFx0d3JpdGVVaW50MzIod3JpdGVyLCBNYXRoLnJvdW5kKChpbmZvLnJvdWdobmVzcyA/PyAxKSAqIDQwOTYpKTtcblx0XHRjb25zdCBjb2xvck1vZGVsID0gZ3JkbUNvbG9yTW9kZWxzLmluZGV4T2YoaW5mby5jb2xvck1vZGVsID8/ICdyZ2InKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNvbG9yTW9kZWwgPT09IC0xID8gMyA6IGNvbG9yTW9kZWwpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspXG5cdFx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIE1hdGgucm91bmQoKGluZm8ubWluICYmIGluZm8ubWluW2ldIHx8IDApICogMHg4MDAwKSk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKylcblx0XHRcdHdyaXRlVWludDE2KHdyaXRlciwgTWF0aC5yb3VuZCgoaW5mby5tYXggJiYgaW5mby5tYXhbaV0gfHwgMCkgKiAweDgwMDApKTtcblxuXHRcdHdyaXRlWmVyb3Mod3JpdGVyLCA0KTtcblx0fSxcbik7XG5cbmZ1bmN0aW9uIHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyOiBQc2RSZWFkZXIpOiBDTVlLIHtcblx0cmV0dXJuIHtcblx0XHRjOiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRtOiByZWFkSW50MTYocmVhZGVyKSxcblx0XHR5OiByZWFkSW50MTYocmVhZGVyKSxcblx0XHRrOiByZWFkSW50MTYocmVhZGVyKSxcblx0fTtcbn1cblxuZnVuY3Rpb24gd3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyOiBQc2RXcml0ZXIsIGNteWs6IENNWUsgfCB1bmRlZmluZWQpIHtcblx0Y29uc3QgYyA9IGNteWsgfHwge30gYXMgUGFydGlhbDxDTVlLPjtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuYyEpO1xuXHR3cml0ZUludDE2KHdyaXRlciwgYy5tISk7XG5cdHdyaXRlSW50MTYod3JpdGVyLCBjLnkhKTtcblx0d3JpdGVJbnQxNih3cml0ZXIsIGMuayEpO1xufVxuXG5hZGRIYW5kbGVyKFxuXHQnc2VsYycsXG5cdGFkanVzdG1lbnRUeXBlKCdzZWxlY3RpdmUgY29sb3InKSxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0aWYgKHJlYWRVaW50MTYocmVhZGVyKSAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHNlbGMgdmVyc2lvbicpO1xuXG5cdFx0Y29uc3QgbW9kZSA9IHJlYWRVaW50MTYocmVhZGVyKSA/ICdhYnNvbHV0ZScgOiAncmVsYXRpdmUnO1xuXHRcdHNraXBCeXRlcyhyZWFkZXIsIDgpO1xuXG5cdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XG5cdFx0XHR0eXBlOiAnc2VsZWN0aXZlIGNvbG9yJyxcblx0XHRcdG1vZGUsXG5cdFx0XHRyZWRzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXG5cdFx0XHR5ZWxsb3dzOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXG5cdFx0XHRncmVlbnM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcblx0XHRcdGN5YW5zOiByZWFkU2VsZWN0aXZlQ29sb3JzKHJlYWRlciksXG5cdFx0XHRibHVlczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxuXHRcdFx0bWFnZW50YXM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcblx0XHRcdHdoaXRlczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxuXHRcdFx0bmV1dHJhbHM6IHJlYWRTZWxlY3RpdmVDb2xvcnMocmVhZGVyKSxcblx0XHRcdGJsYWNrczogcmVhZFNlbGVjdGl2ZUNvbG9ycyhyZWFkZXIpLFxuXHRcdH07XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCkgPT4ge1xuXHRcdGNvbnN0IGluZm8gPSB0YXJnZXQuYWRqdXN0bWVudCBhcyBTZWxlY3RpdmVDb2xvckFkanVzdG1lbnQ7XG5cblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIDEpOyAvLyB2ZXJzaW9uXG5cdFx0d3JpdGVVaW50MTYod3JpdGVyLCBpbmZvLm1vZGUgPT09ICdhYnNvbHV0ZScgPyAxIDogMCk7XG5cdFx0d3JpdGVaZXJvcyh3cml0ZXIsIDgpO1xuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5yZWRzKTtcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8ueWVsbG93cyk7XG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmdyZWVucyk7XG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLmN5YW5zKTtcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8uYmx1ZXMpO1xuXHRcdHdyaXRlU2VsZWN0aXZlQ29sb3JzKHdyaXRlciwgaW5mby5tYWdlbnRhcyk7XG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLndoaXRlcyk7XG5cdFx0d3JpdGVTZWxlY3RpdmVDb2xvcnMod3JpdGVyLCBpbmZvLm5ldXRyYWxzKTtcblx0XHR3cml0ZVNlbGVjdGl2ZUNvbG9ycyh3cml0ZXIsIGluZm8uYmxhY2tzKTtcblx0fSxcbik7XG5cbmludGVyZmFjZSBCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yIHtcblx0VnJzbjogbnVtYmVyO1xuXHRCcmdoOiBudW1iZXI7XG5cdENudHI6IG51bWJlcjtcblx0bWVhbnM6IG51bWJlcjtcblx0J0xhYiAnOiBib29sZWFuO1xuXHR1c2VMZWdhY3k6IGJvb2xlYW47XG5cdEF1dG86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBQcmVzZXREZXNjcmlwdG9yIHtcblx0VnJzbjogbnVtYmVyO1xuXHRwcmVzZXRLaW5kOiBudW1iZXI7XG5cdHByZXNldEZpbGVOYW1lOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBDdXJ2ZXNQcmVzZXREZXNjcmlwdG9yIHtcblx0VnJzbjogbnVtYmVyO1xuXHRjdXJ2ZXNQcmVzZXRLaW5kOiBudW1iZXI7XG5cdGN1cnZlc1ByZXNldEZpbGVOYW1lOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBNaXhlclByZXNldERlc2NyaXB0b3Ige1xuXHRWcnNuOiBudW1iZXI7XG5cdG1peGVyUHJlc2V0S2luZDogbnVtYmVyO1xuXHRtaXhlclByZXNldEZpbGVOYW1lOiBzdHJpbmc7XG59XG5cbmFkZEhhbmRsZXIoXG5cdCdDZ0VkJyxcblx0dGFyZ2V0ID0+IHtcblx0XHRjb25zdCBhID0gdGFyZ2V0LmFkanVzdG1lbnQ7XG5cblx0XHRpZiAoIWEpIHJldHVybiBmYWxzZTtcblxuXHRcdHJldHVybiAoYS50eXBlID09PSAnYnJpZ2h0bmVzcy9jb250cmFzdCcgJiYgIWEudXNlTGVnYWN5KSB8fFxuXHRcdFx0KChhLnR5cGUgPT09ICdsZXZlbHMnIHx8IGEudHlwZSA9PT0gJ2N1cnZlcycgfHwgYS50eXBlID09PSAnZXhwb3N1cmUnIHx8IGEudHlwZSA9PT0gJ2NoYW5uZWwgbWl4ZXInIHx8XG5cdFx0XHRcdGEudHlwZSA9PT0gJ2h1ZS9zYXR1cmF0aW9uJykgJiYgYS5wcmVzZXRGaWxlTmFtZSAhPT0gdW5kZWZpbmVkKTtcblx0fSxcblx0KHJlYWRlciwgdGFyZ2V0LCBsZWZ0KSA9PiB7XG5cdFx0Y29uc3QgZGVzYyA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpIGFzXG5cdFx0XHRCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yIHwgUHJlc2V0RGVzY3JpcHRvciB8IEN1cnZlc1ByZXNldERlc2NyaXB0b3IgfCBNaXhlclByZXNldERlc2NyaXB0b3I7XG5cdFx0aWYgKGRlc2MuVnJzbiAhPT0gMSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIENnRWQgdmVyc2lvbicpO1xuXG5cdFx0Ly8gdGhpcyBzZWN0aW9uIGNhbiBzcGVjaWZ5IHByZXNldCBmaWxlIG5hbWUgZm9yIG90aGVyIGFkanVzdG1lbnQgdHlwZXNcblx0XHRpZiAoJ3ByZXNldEZpbGVOYW1lJyBpbiBkZXNjKSB7XG5cdFx0XHR0YXJnZXQuYWRqdXN0bWVudCA9IHtcblx0XHRcdFx0Li4udGFyZ2V0LmFkanVzdG1lbnQgYXMgTGV2ZWxzQWRqdXN0bWVudCB8IEV4cG9zdXJlQWRqdXN0bWVudCB8IEh1ZVNhdHVyYXRpb25BZGp1c3RtZW50LFxuXHRcdFx0XHRwcmVzZXRLaW5kOiBkZXNjLnByZXNldEtpbmQsXG5cdFx0XHRcdHByZXNldEZpbGVOYW1lOiBkZXNjLnByZXNldEZpbGVOYW1lLFxuXHRcdFx0fTtcblx0XHR9IGVsc2UgaWYgKCdjdXJ2ZXNQcmVzZXRGaWxlTmFtZScgaW4gZGVzYykge1xuXHRcdFx0dGFyZ2V0LmFkanVzdG1lbnQgPSB7XG5cdFx0XHRcdC4uLnRhcmdldC5hZGp1c3RtZW50IGFzIEN1cnZlc0FkanVzdG1lbnQsXG5cdFx0XHRcdHByZXNldEtpbmQ6IGRlc2MuY3VydmVzUHJlc2V0S2luZCxcblx0XHRcdFx0cHJlc2V0RmlsZU5hbWU6IGRlc2MuY3VydmVzUHJlc2V0RmlsZU5hbWUsXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSBpZiAoJ21peGVyUHJlc2V0RmlsZU5hbWUnIGluIGRlc2MpIHtcblx0XHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xuXHRcdFx0XHQuLi50YXJnZXQuYWRqdXN0bWVudCBhcyBDdXJ2ZXNBZGp1c3RtZW50LFxuXHRcdFx0XHRwcmVzZXRLaW5kOiBkZXNjLm1peGVyUHJlc2V0S2luZCxcblx0XHRcdFx0cHJlc2V0RmlsZU5hbWU6IGRlc2MubWl4ZXJQcmVzZXRGaWxlTmFtZSxcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhcmdldC5hZGp1c3RtZW50ID0ge1xuXHRcdFx0XHR0eXBlOiAnYnJpZ2h0bmVzcy9jb250cmFzdCcsXG5cdFx0XHRcdGJyaWdodG5lc3M6IGRlc2MuQnJnaCxcblx0XHRcdFx0Y29udHJhc3Q6IGRlc2MuQ250cixcblx0XHRcdFx0bWVhblZhbHVlOiBkZXNjLm1lYW5zLFxuXHRcdFx0XHR1c2VMZWdhY3k6ICEhZGVzYy51c2VMZWdhY3ksXG5cdFx0XHRcdGxhYkNvbG9yT25seTogISFkZXNjWydMYWIgJ10sXG5cdFx0XHRcdGF1dG86ICEhZGVzYy5BdXRvLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRza2lwQnl0ZXMocmVhZGVyLCBsZWZ0KCkpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBpbmZvID0gdGFyZ2V0LmFkanVzdG1lbnQhO1xuXG5cdFx0aWYgKGluZm8udHlwZSA9PT0gJ2xldmVscycgfHwgaW5mby50eXBlID09PSAnZXhwb3N1cmUnIHx8IGluZm8udHlwZSA9PT0gJ2h1ZS9zYXR1cmF0aW9uJykge1xuXHRcdFx0Y29uc3QgZGVzYzogUHJlc2V0RGVzY3JpcHRvciA9IHtcblx0XHRcdFx0VnJzbjogMSxcblx0XHRcdFx0cHJlc2V0S2luZDogaW5mby5wcmVzZXRLaW5kID8/IDEsXG5cdFx0XHRcdHByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxuXHRcdFx0fTtcblx0XHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcblx0XHR9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2N1cnZlcycpIHtcblx0XHRcdGNvbnN0IGRlc2M6IEN1cnZlc1ByZXNldERlc2NyaXB0b3IgPSB7XG5cdFx0XHRcdFZyc246IDEsXG5cdFx0XHRcdGN1cnZlc1ByZXNldEtpbmQ6IGluZm8ucHJlc2V0S2luZCA/PyAxLFxuXHRcdFx0XHRjdXJ2ZXNQcmVzZXRGaWxlTmFtZTogaW5mby5wcmVzZXRGaWxlTmFtZSB8fCAnJyxcblx0XHRcdH07XG5cdFx0XHR3cml0ZVZlcnNpb25BbmREZXNjcmlwdG9yKHdyaXRlciwgJycsICdudWxsJywgZGVzYyk7XG5cdFx0fSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdjaGFubmVsIG1peGVyJykge1xuXHRcdFx0Y29uc3QgZGVzYzogTWl4ZXJQcmVzZXREZXNjcmlwdG9yID0ge1xuXHRcdFx0XHRWcnNuOiAxLFxuXHRcdFx0XHRtaXhlclByZXNldEtpbmQ6IGluZm8ucHJlc2V0S2luZCA/PyAxLFxuXHRcdFx0XHRtaXhlclByZXNldEZpbGVOYW1lOiBpbmZvLnByZXNldEZpbGVOYW1lIHx8ICcnLFxuXHRcdFx0fTtcblx0XHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ251bGwnLCBkZXNjKTtcblx0XHR9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2JyaWdodG5lc3MvY29udHJhc3QnKSB7XG5cdFx0XHRjb25zdCBkZXNjOiBCcmlnaHRuZXNzQ29udHJhc3REZXNjcmlwdG9yID0ge1xuXHRcdFx0XHRWcnNuOiAxLFxuXHRcdFx0XHRCcmdoOiBpbmZvLmJyaWdodG5lc3MgfHwgMCxcblx0XHRcdFx0Q250cjogaW5mby5jb250cmFzdCB8fCAwLFxuXHRcdFx0XHRtZWFuczogaW5mby5tZWFuVmFsdWUgPz8gMTI3LFxuXHRcdFx0XHQnTGFiICc6ICEhaW5mby5sYWJDb2xvck9ubHksXG5cdFx0XHRcdHVzZUxlZ2FjeTogISFpbmZvLnVzZUxlZ2FjeSxcblx0XHRcdFx0QXV0bzogISFpbmZvLmF1dG8sXG5cdFx0XHR9O1xuXHRcdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGRlc2MpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuaGFuZGxlZCBDZ0VkIGNhc2UnKTtcblx0XHR9XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQnVHh0MicsXG5cdGhhc0tleSgnZW5naW5lRGF0YScpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQpID0+IHtcblx0XHRjb25zdCBkYXRhID0gcmVhZEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0XHR0YXJnZXQuZW5naW5lRGF0YSA9IGZyb21CeXRlQXJyYXkoZGF0YSk7XG5cdFx0Ly8gY29uc3QgZW5naW5lRGF0YSA9IHBhcnNlRW5naW5lRGF0YShkYXRhKTtcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcblx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ3Jlc291cmNlcy9lbmdpbmVEYXRhMlNpbXBsZS50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblx0XHQvLyByZXF1aXJlKCdmcycpLndyaXRlRmlsZVN5bmMoJ3Rlc3RfZGF0YS5qc29uJywgSlNPTi5zdHJpbmdpZnkoZWQsIG51bGwsIDIpLCAndXRmOCcpO1xuXHR9LFxuXHQod3JpdGVyLCB0YXJnZXQpID0+IHtcblx0XHRjb25zdCBidWZmZXIgPSB0b0J5dGVBcnJheSh0YXJnZXQuZW5naW5lRGF0YSEpO1xuXHRcdHdyaXRlQnl0ZXMod3JpdGVyLCBidWZmZXIpO1xuXHR9LFxuKTtcblxuYWRkSGFuZGxlcihcblx0J0ZNc2snLFxuXHRoYXNLZXkoJ2ZpbHRlck1hc2snKSxcblx0KHJlYWRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0dGFyZ2V0LmZpbHRlck1hc2sgPSB7XG5cdFx0XHRjb2xvclNwYWNlOiByZWFkQ29sb3IocmVhZGVyKSxcblx0XHRcdG9wYWNpdHk6IHJlYWRVaW50MTYocmVhZGVyKSAvIDB4ZmYsXG5cdFx0fTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0d3JpdGVDb2xvcih3cml0ZXIsIHRhcmdldC5maWx0ZXJNYXNrIS5jb2xvclNwYWNlKTtcblx0XHR3cml0ZVVpbnQxNih3cml0ZXIsIGNsYW1wKHRhcmdldC5maWx0ZXJNYXNrIS5vcGFjaXR5ID8/IDEsIDAsIDEpICogMHhmZik7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQndnN0aycsXG5cdGhhc0tleSgndmVjdG9yU3Ryb2tlJyksXG5cdChyZWFkZXIsIHRhcmdldCwgbGVmdCkgPT4ge1xuXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKSBhcyBTdHJva2VEZXNjcmlwdG9yO1xuXG5cdFx0dGFyZ2V0LnZlY3RvclN0cm9rZSA9IHtcblx0XHRcdHN0cm9rZUVuYWJsZWQ6IGRlc2NyaXB0b3Iuc3Ryb2tlRW5hYmxlZCxcblx0XHRcdGZpbGxFbmFibGVkOiBkZXNjcmlwdG9yLmZpbGxFbmFibGVkLFxuXHRcdFx0bGluZVdpZHRoOiBwYXJzZVVuaXRzKGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVMaW5lV2lkdGgpLFxuXHRcdFx0bGluZURhc2hPZmZzZXQ6IHBhcnNlVW5pdHMoZGVzY3JpcHRvci5zdHJva2VTdHlsZUxpbmVEYXNoT2Zmc2V0KSxcblx0XHRcdG1pdGVyTGltaXQ6IGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVNaXRlckxpbWl0LFxuXHRcdFx0bGluZUNhcFR5cGU6IHN0cm9rZVN0eWxlTGluZUNhcFR5cGUuZGVjb2RlKGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZSksXG5cdFx0XHRsaW5lSm9pblR5cGU6IHN0cm9rZVN0eWxlTGluZUpvaW5UeXBlLmRlY29kZShkZXNjcmlwdG9yLnN0cm9rZVN0eWxlTGluZUpvaW5UeXBlKSxcblx0XHRcdGxpbmVBbGlnbm1lbnQ6IHN0cm9rZVN0eWxlTGluZUFsaWdubWVudC5kZWNvZGUoZGVzY3JpcHRvci5zdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQpLFxuXHRcdFx0c2NhbGVMb2NrOiBkZXNjcmlwdG9yLnN0cm9rZVN0eWxlU2NhbGVMb2NrLFxuXHRcdFx0c3Ryb2tlQWRqdXN0OiBkZXNjcmlwdG9yLnN0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0LFxuXHRcdFx0bGluZURhc2hTZXQ6IGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVMaW5lRGFzaFNldC5tYXAocGFyc2VVbml0cyksXG5cdFx0XHRibGVuZE1vZGU6IEJsbk0uZGVjb2RlKGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVCbGVuZE1vZGUpLFxuXHRcdFx0b3BhY2l0eTogcGFyc2VQZXJjZW50KGRlc2NyaXB0b3Iuc3Ryb2tlU3R5bGVPcGFjaXR5KSxcblx0XHRcdGNvbnRlbnQ6IHBhcnNlVmVjdG9yQ29udGVudChkZXNjcmlwdG9yLnN0cm9rZVN0eWxlQ29udGVudCksXG5cdFx0XHRyZXNvbHV0aW9uOiBkZXNjcmlwdG9yLnN0cm9rZVN0eWxlUmVzb2x1dGlvbixcblx0XHR9O1xuXG5cdFx0c2tpcEJ5dGVzKHJlYWRlciwgbGVmdCgpKTtcblx0fSxcblx0KHdyaXRlciwgdGFyZ2V0KSA9PiB7XG5cdFx0Y29uc3Qgc3Ryb2tlID0gdGFyZ2V0LnZlY3RvclN0cm9rZSE7XG5cdFx0Y29uc3QgZGVzY3JpcHRvcjogU3Ryb2tlRGVzY3JpcHRvciA9IHtcblx0XHRcdHN0cm9rZVN0eWxlVmVyc2lvbjogMixcblx0XHRcdHN0cm9rZUVuYWJsZWQ6ICEhc3Ryb2tlLnN0cm9rZUVuYWJsZWQsXG5cdFx0XHRmaWxsRW5hYmxlZDogISFzdHJva2UuZmlsbEVuYWJsZWQsXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVXaWR0aDogc3Ryb2tlLmxpbmVXaWR0aCB8fCB7IHZhbHVlOiAzLCB1bml0czogJ1BvaW50cycgfSxcblx0XHRcdHN0cm9rZVN0eWxlTGluZURhc2hPZmZzZXQ6IHN0cm9rZS5saW5lRGFzaE9mZnNldCB8fCB7IHZhbHVlOiAwLCB1bml0czogJ1BvaW50cycgfSxcblx0XHRcdHN0cm9rZVN0eWxlTWl0ZXJMaW1pdDogc3Ryb2tlLm1pdGVyTGltaXQgPz8gMTAwLFxuXHRcdFx0c3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZTogc3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZS5lbmNvZGUoc3Ryb2tlLmxpbmVDYXBUeXBlKSxcblx0XHRcdHN0cm9rZVN0eWxlTGluZUpvaW5UeXBlOiBzdHJva2VTdHlsZUxpbmVKb2luVHlwZS5lbmNvZGUoc3Ryb2tlLmxpbmVKb2luVHlwZSksXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQ6IHN0cm9rZVN0eWxlTGluZUFsaWdubWVudC5lbmNvZGUoc3Ryb2tlLmxpbmVBbGlnbm1lbnQpLFxuXHRcdFx0c3Ryb2tlU3R5bGVTY2FsZUxvY2s6ICEhc3Ryb2tlLnNjYWxlTG9jayxcblx0XHRcdHN0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0OiAhIXN0cm9rZS5zdHJva2VBZGp1c3QsXG5cdFx0XHRzdHJva2VTdHlsZUxpbmVEYXNoU2V0OiBzdHJva2UubGluZURhc2hTZXQgfHwgW10sXG5cdFx0XHRzdHJva2VTdHlsZUJsZW5kTW9kZTogQmxuTS5lbmNvZGUoc3Ryb2tlLmJsZW5kTW9kZSksXG5cdFx0XHRzdHJva2VTdHlsZU9wYWNpdHk6IHVuaXRzUGVyY2VudChzdHJva2Uub3BhY2l0eSA/PyAxKSxcblx0XHRcdHN0cm9rZVN0eWxlQ29udGVudDogc2VyaWFsaXplVmVjdG9yQ29udGVudChcblx0XHRcdFx0c3Ryb2tlLmNvbnRlbnQgfHwgeyB0eXBlOiAnY29sb3InLCBjb2xvcjogeyByOiAwLCBnOiAwLCBiOiAwIH0gfSkuZGVzY3JpcHRvcixcblx0XHRcdHN0cm9rZVN0eWxlUmVzb2x1dGlvbjogc3Ryb2tlLnJlc29sdXRpb24gPz8gNzIsXG5cdFx0fTtcblxuXHRcdHdyaXRlVmVyc2lvbkFuZERlc2NyaXB0b3Iod3JpdGVyLCAnJywgJ3N0cm9rZVN0eWxlJywgZGVzY3JpcHRvcik7XG5cdH0sXG4pO1xuXG5hZGRIYW5kbGVyKFxuXHQnbGZ4MicsXG5cdGhhc0tleSgnZWZmZWN0cycpLFxuXHQocmVhZGVyLCB0YXJnZXQsIGxlZnQsIF8sIG9wdGlvbnMpID0+IHtcblx0XHRjb25zdCBsb2cgPSAhIW9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzO1xuXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG5cdFx0aWYgKHZlcnNpb24gIT09IDApIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBsZngyIHZlcnNpb25gKTtcblxuXHRcdGNvbnN0IGluZm8gPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcblxuXHRcdHRhcmdldC5lZmZlY3RzID0ge307IC8vIGRpc2NhcmQgaWYgcmVhZCBpbiAnbHJGWCcgc2VjdGlvblxuXHRcdGNvbnN0IGVmZmVjdHMgPSB0YXJnZXQuZWZmZWN0cztcblxuXHRcdGlmICghaW5mby5tYXN0ZXJGWFN3aXRjaCkgZWZmZWN0cy5kaXNhYmxlZCA9IHRydWU7XG5cdFx0aWYgKGluZm9bJ1NjbCAnXSkgZWZmZWN0cy5zY2FsZSA9IHBhcnNlUGVyY2VudChpbmZvWydTY2wgJ10pO1xuXHRcdGlmIChpbmZvLkRyU2gpIGVmZmVjdHMuZHJvcFNoYWRvdyA9IHBhcnNlRWZmZWN0T2JqZWN0KGluZm8uRHJTaCwgbG9nKTtcblx0XHRpZiAoaW5mby5JclNoKSBlZmZlY3RzLmlubmVyU2hhZG93ID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5JclNoLCBsb2cpO1xuXHRcdGlmIChpbmZvLk9yR2wpIGVmZmVjdHMub3V0ZXJHbG93ID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5PckdsLCBsb2cpO1xuXHRcdGlmIChpbmZvLklyR2wpIGVmZmVjdHMuaW5uZXJHbG93ID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5JckdsLCBsb2cpO1xuXHRcdGlmIChpbmZvLmViYmwpIGVmZmVjdHMuYmV2ZWwgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLmViYmwsIGxvZyk7XG5cdFx0aWYgKGluZm8uU29GaSkgZWZmZWN0cy5zb2xpZEZpbGwgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLlNvRmksIGxvZyk7XG5cdFx0aWYgKGluZm8ucGF0dGVybkZpbGwpIGVmZmVjdHMucGF0dGVybk92ZXJsYXkgPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLnBhdHRlcm5GaWxsLCBsb2cpO1xuXHRcdGlmIChpbmZvLkdyRmwpIGVmZmVjdHMuZ3JhZGllbnRPdmVybGF5ID0gcGFyc2VFZmZlY3RPYmplY3QoaW5mby5HckZsLCBsb2cpO1xuXHRcdGlmIChpbmZvLkNoRlgpIGVmZmVjdHMuc2F0aW4gPSBwYXJzZUVmZmVjdE9iamVjdChpbmZvLkNoRlgsIGxvZyk7XG5cdFx0aWYgKGluZm8uRnJGWCkge1xuXHRcdFx0ZWZmZWN0cy5zdHJva2UgPSB7XG5cdFx0XHRcdGVuYWJsZWQ6ICEhaW5mby5GckZYLmVuYWIsXG5cdFx0XHRcdHBvc2l0aW9uOiBGU3RsLmRlY29kZShpbmZvLkZyRlguU3R5bCksXG5cdFx0XHRcdGZpbGxUeXBlOiBGckZsLmRlY29kZShpbmZvLkZyRlguUG50VCksXG5cdFx0XHRcdGJsZW5kTW9kZTogQmxuTS5kZWNvZGUoaW5mby5GckZYWydNZCAgJ10pLFxuXHRcdFx0XHRvcGFjaXR5OiBwYXJzZVBlcmNlbnQoaW5mby5GckZYLk9wY3QpLFxuXHRcdFx0XHRzaXplOiBwYXJzZVVuaXRzKGluZm8uRnJGWFsnU3ogICddKSxcblx0XHRcdH07XG5cblx0XHRcdGlmIChpbmZvLkZyRlhbJ0NsciAnXSkgZWZmZWN0cy5zdHJva2UuY29sb3IgPSBwYXJzZUNvbG9yKGluZm8uRnJGWFsnQ2xyICddKTtcblx0XHRcdGlmIChpbmZvLkZyRlguR3JhZCkgZWZmZWN0cy5zdHJva2UuZ3JhZGllbnQgPSBwYXJzZUdyYWRpZW50Q29udGVudChpbmZvLkZyRlgpO1xuXHRcdFx0aWYgKGluZm8uRnJGWC5QdHJuKSBlZmZlY3RzLnN0cm9rZS5wYXR0ZXJuID0gcGFyc2VQYXR0ZXJuQ29udGVudChpbmZvLkZyRlgpO1xuXHRcdH1cblxuXHRcdHNraXBCeXRlcyhyZWFkZXIsIGxlZnQoKSk7XG5cdH0sXG5cdCh3cml0ZXIsIHRhcmdldCwgXywgb3B0aW9ucykgPT4ge1xuXHRcdGNvbnN0IGxvZyA9ICEhb3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXM7XG5cdFx0Y29uc3QgZWZmZWN0cyA9IHRhcmdldC5lZmZlY3RzITtcblx0XHRjb25zdCBpbmZvOiBhbnkgPSB7XG5cdFx0XHRtYXN0ZXJGWFN3aXRjaDogIWVmZmVjdHMuZGlzYWJsZWQsXG5cdFx0XHQnU2NsICc6IHVuaXRzUGVyY2VudChlZmZlY3RzLnNjYWxlID8/IDEpLFxuXHRcdH07XG5cblx0XHRpZiAoZWZmZWN0cy5kcm9wU2hhZG93KSBpbmZvLkRyU2ggPSBzZXJpYWxpemVFZmZlY3RPYmplY3QoZWZmZWN0cy5kcm9wU2hhZG93LCAnZHJvcFNoYWRvdycsIGxvZyk7XG5cdFx0aWYgKGVmZmVjdHMuaW5uZXJTaGFkb3cpIGluZm8uSXJTaCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlZmZlY3RzLmlubmVyU2hhZG93LCAnaW5uZXJTaGFkb3cnLCBsb2cpO1xuXHRcdGlmIChlZmZlY3RzLm91dGVyR2xvdykgaW5mby5PckdsID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGVmZmVjdHMub3V0ZXJHbG93LCAnb3V0ZXJHbG93JywgbG9nKTtcblx0XHRpZiAoZWZmZWN0cy5pbm5lckdsb3cpIGluZm8uSXJHbCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlZmZlY3RzLmlubmVyR2xvdywgJ2lubmVyR2xvdycsIGxvZyk7XG5cdFx0aWYgKGVmZmVjdHMuYmV2ZWwpIGluZm8uZWJibCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlZmZlY3RzLmJldmVsLCAnYmV2ZWwnLCBsb2cpO1xuXHRcdGlmIChlZmZlY3RzLnNvbGlkRmlsbCkgaW5mby5Tb0ZpID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGVmZmVjdHMuc29saWRGaWxsLCAnc29saWRGaWxsJywgbG9nKTtcblx0XHRpZiAoZWZmZWN0cy5wYXR0ZXJuT3ZlcmxheSkgaW5mby5wYXR0ZXJuRmlsbCA9IHNlcmlhbGl6ZUVmZmVjdE9iamVjdChlZmZlY3RzLnBhdHRlcm5PdmVybGF5LCAncGF0dGVybk92ZXJsYXknLCBsb2cpO1xuXHRcdGlmIChlZmZlY3RzLmdyYWRpZW50T3ZlcmxheSkgaW5mby5HckZsID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGVmZmVjdHMuZ3JhZGllbnRPdmVybGF5LCAnZ3JhZGllbnRPdmVybGF5JywgbG9nKTtcblx0XHRpZiAoZWZmZWN0cy5zYXRpbikgaW5mby5DaEZYID0gc2VyaWFsaXplRWZmZWN0T2JqZWN0KGVmZmVjdHMuc2F0aW4sICdzYXRpbicsIGxvZyk7XG5cblx0XHRjb25zdCBzdHJva2UgPSBlZmZlY3RzLnN0cm9rZTtcblxuXHRcdGlmIChzdHJva2UpIHtcblx0XHRcdGluZm8uRnJGWCA9IHtcblx0XHRcdFx0ZW5hYjogISFzdHJva2UuZW5hYmxlZCxcblx0XHRcdFx0U3R5bDogRlN0bC5lbmNvZGUoc3Ryb2tlLnBvc2l0aW9uKSxcblx0XHRcdFx0UG50VDogRnJGbC5lbmNvZGUoc3Ryb2tlLmZpbGxUeXBlKSxcblx0XHRcdFx0J01kICAnOiBCbG5NLmVuY29kZShzdHJva2UuYmxlbmRNb2RlKSxcblx0XHRcdFx0T3BjdDogdW5pdHNQZXJjZW50KHN0cm9rZS5vcGFjaXR5KSxcblx0XHRcdFx0J1N6ICAnOiB1bml0c1ZhbHVlKHN0cm9rZS5zaXplLCAnc2l6ZScpLFxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKHN0cm9rZS5jb2xvcilcblx0XHRcdFx0aW5mby5GckZYWydDbHIgJ10gPSBzZXJpYWxpemVDb2xvcihzdHJva2UuY29sb3IpO1xuXHRcdFx0aWYgKHN0cm9rZS5ncmFkaWVudClcblx0XHRcdFx0aW5mby5GckZYID0geyAuLi5pbmZvLkZyRlgsIC4uLnNlcmlhbGl6ZUdyYWRpZW50Q29udGVudChzdHJva2UuZ3JhZGllbnQpIH07XG5cdFx0XHRpZiAoc3Ryb2tlLnBhdHRlcm4pXG5cdFx0XHRcdGluZm8uRnJGWCA9IHsgLi4uaW5mby5GckZYLCAuLi5zZXJpYWxpemVQYXR0ZXJuQ29udGVudChzdHJva2UucGF0dGVybikgfTtcblx0XHR9XG5cblx0XHR3cml0ZVVpbnQzMih3cml0ZXIsIDApOyAvLyB2ZXJzaW9uXG5cdFx0d3JpdGVWZXJzaW9uQW5kRGVzY3JpcHRvcih3cml0ZXIsICcnLCAnbnVsbCcsIGluZm8pO1xuXHR9LFxuKTtcblxuLy8gYWRkSGFuZGxlcihcbi8vIFx0J2xtZngnLFxuLy8gXHR0YXJnZXQgPT4gIXRhcmdldCxcbi8vIFx0KHJlYWRlciwgX3RhcmdldCkgPT4ge1xuLy8gXHRcdGNvbnN0IHZlcnNpb24gPSByZWFkVWludDMyKHJlYWRlcik7XG4vLyBcdFx0aWYgKHZlcnNpb24gIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsbWZ4IHZlcnNpb24nKTtcblxuLy8gXHRcdGNvbnN0IGRlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcbi8vIFx0XHRjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjcmlwdG9yLCBmYWxzZSwgOTksIHRydWUpKTtcbi8vIFx0fSxcbi8vIFx0KF93cml0ZXIsIF90YXJnZXQpID0+IHtcbi8vIFx0fSxcbi8vICk7XG5cbi8vIGFkZEhhbmRsZXIoXG4vLyBcdCdjaW5mJyxcbi8vIFx0dGFyZ2V0ID0+ICF0YXJnZXQsXG4vLyBcdChyZWFkZXIsIF90YXJnZXQpID0+IHtcbi8vIFx0XHRjb25zdCBkZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XG4vLyBcdFx0Y29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzY3JpcHRvciwgZmFsc2UsIDk5LCB0cnVlKSk7XG4vLyBcdH0sXG4vLyBcdChfd3JpdGVyLCBfdGFyZ2V0KSA9PiB7XG4vLyBcdH0sXG4vLyApO1xuXG4vLyBkZXNjcmlwdG9yIGhlbHBlcnNcblxudHlwZSBEZXNjcmlwdG9yVW5pdHMgPSAnQW5nbGUnIHwgJ0RlbnNpdHknIHwgJ0Rpc3RhbmNlJyB8ICdOb25lJyB8ICdQZXJjZW50JyB8ICdQaXhlbHMnIHxcblx0J01pbGxpbWV0ZXJzJyB8ICdQb2ludHMnIHwgJ1BpY2FzJyB8ICdJbmNoZXMnIHwgJ0NlbnRpbWV0ZXJzJztcblxuaW50ZXJmYWNlIERlc2NyaXB0b3JVbml0c1ZhbHVlIHtcblx0dW5pdHM6IERlc2NyaXB0b3JVbml0cztcblx0dmFsdWU6IG51bWJlcjtcbn1cblxudHlwZSBEZXNjcmlwdG9yQ29sb3IgPSB7XG5cdCdSZCAgJzogbnVtYmVyO1xuXHQnR3JuICc6IG51bWJlcjtcblx0J0JsICAnOiBudW1iZXI7XG59IHwge1xuXHQnSCAgICc6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xuXHRTdHJ0OiBudW1iZXI7XG5cdEJyZ2g6IG51bWJlcjtcbn0gfCB7XG5cdCdDeW4gJzogbnVtYmVyO1xuXHRNZ250OiBudW1iZXI7XG5cdCdZbHcgJzogbnVtYmVyO1xuXHRCbGNrOiBudW1iZXI7XG59IHwge1xuXHQnR3J5ICc6IG51bWJlcjtcbn0gfCB7XG5cdExtbmM6IG51bWJlcjtcblx0J0EgICAnOiBudW1iZXI7XG5cdCdCICAgJzogbnVtYmVyO1xufTtcblxuaW50ZXJmYWNlIERlc2NpcHRvclBhdHRlcm4ge1xuXHQnTm0gICc6IHN0cmluZztcblx0SWRudDogc3RyaW5nO1xufVxuXG50eXBlIERlc2NpcHRvckdyYWRpZW50ID0ge1xuXHRHcmRGOiAnR3JkRi5Dc3RTJztcblx0SW50cjogbnVtYmVyO1xuXHQnTm0gICc6IHN0cmluZztcblx0Q2xyczoge1xuXHRcdCdDbHIgJzogRGVzY3JpcHRvckNvbG9yO1xuXHRcdExjdG46IG51bWJlcjtcblx0XHRNZHBuOiBudW1iZXI7XG5cdH1bXTtcblx0VHJuczoge1xuXHRcdE9wY3Q6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xuXHRcdExjdG46IG51bWJlcjtcblx0XHRNZHBuOiBudW1iZXI7XG5cdH1bXTtcbn0gfCB7XG5cdEdyZEY6ICdHcmRGLkNsTnMnO1xuXHRTbXRoOiBudW1iZXI7XG5cdCdObSAgJzogc3RyaW5nO1xuXHRDbHJTOiBzdHJpbmc7XG5cdFJuZFM6IG51bWJlcjtcblx0VmN0Qz86IGJvb2xlYW47XG5cdFNoVHI/OiBib29sZWFuO1xuXHQnTW5tICc6IG51bWJlcltdO1xuXHQnTXhtICc6IG51bWJlcltdO1xufTtcblxuaW50ZXJmYWNlIERlc2NyaXB0b3JDb2xvckNvbnRlbnQge1xuXHQnQ2xyICc6IERlc2NyaXB0b3JDb2xvcjtcbn1cblxuaW50ZXJmYWNlIERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQge1xuXHRHcmFkOiBEZXNjaXB0b3JHcmFkaWVudDtcblx0VHlwZTogc3RyaW5nO1xuXHREdGhyPzogYm9vbGVhbjtcblx0UnZycz86IGJvb2xlYW47XG5cdEFuZ2w/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcblx0J1NjbCAnPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XG5cdEFsZ24/OiBib29sZWFuO1xuXHRPZnN0PzogeyBIcnpuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTsgVnJ0YzogRGVzY3JpcHRvclVuaXRzVmFsdWU7IH07XG59XG5cbmludGVyZmFjZSBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQge1xuXHRQdHJuOiBEZXNjaXB0b3JQYXR0ZXJuO1xuXHRMbmtkPzogYm9vbGVhbjtcblx0cGhhc2U/OiB7IEhyem46IG51bWJlcjsgVnJ0YzogbnVtYmVyOyB9O1xufVxuXG50eXBlIERlc2NyaXB0b3JWZWN0b3JDb250ZW50ID0gRGVzY3JpcHRvckNvbG9yQ29udGVudCB8IERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQgfCBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQ7XG5cbmludGVyZmFjZSBTdHJva2VEZXNjcmlwdG9yIHtcblx0c3Ryb2tlU3R5bGVWZXJzaW9uOiBudW1iZXI7XG5cdHN0cm9rZUVuYWJsZWQ6IGJvb2xlYW47XG5cdGZpbGxFbmFibGVkOiBib29sZWFuO1xuXHRzdHJva2VTdHlsZUxpbmVXaWR0aDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XG5cdHN0cm9rZVN0eWxlTGluZURhc2hPZmZzZXQ6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xuXHRzdHJva2VTdHlsZU1pdGVyTGltaXQ6IG51bWJlcjtcblx0c3Ryb2tlU3R5bGVMaW5lQ2FwVHlwZTogc3RyaW5nO1xuXHRzdHJva2VTdHlsZUxpbmVKb2luVHlwZTogc3RyaW5nO1xuXHRzdHJva2VTdHlsZUxpbmVBbGlnbm1lbnQ6IHN0cmluZztcblx0c3Ryb2tlU3R5bGVTY2FsZUxvY2s6IGJvb2xlYW47XG5cdHN0cm9rZVN0eWxlU3Ryb2tlQWRqdXN0OiBib29sZWFuO1xuXHRzdHJva2VTdHlsZUxpbmVEYXNoU2V0OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZVtdO1xuXHRzdHJva2VTdHlsZUJsZW5kTW9kZTogc3RyaW5nO1xuXHRzdHJva2VTdHlsZU9wYWNpdHk6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xuXHRzdHJva2VTdHlsZUNvbnRlbnQ6IERlc2NyaXB0b3JWZWN0b3JDb250ZW50O1xuXHRzdHJva2VTdHlsZVJlc29sdXRpb246IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIFRleHREZXNjcmlwdG9yIHtcblx0J1R4dCAnOiBzdHJpbmc7XG5cdHRleHRHcmlkZGluZzogc3RyaW5nO1xuXHRPcm50OiBzdHJpbmc7XG5cdEFudEE6IHN0cmluZztcblx0VGV4dEluZGV4OiBudW1iZXI7XG5cdEVuZ2luZURhdGE/OiBVaW50OEFycmF5O1xufVxuXG5pbnRlcmZhY2UgV2FycERlc2NyaXB0b3Ige1xuXHR3YXJwU3R5bGU6IHN0cmluZztcblx0d2FycFZhbHVlOiBudW1iZXI7XG5cdHdhcnBQZXJzcGVjdGl2ZTogbnVtYmVyO1xuXHR3YXJwUGVyc3BlY3RpdmVPdGhlcjogbnVtYmVyO1xuXHR3YXJwUm90YXRlOiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHBhcnNlR3JhZGllbnQoZ3JhZDogRGVzY2lwdG9yR3JhZGllbnQpOiBFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCB7XG5cdGlmIChncmFkLkdyZEYgPT09ICdHcmRGLkNzdFMnKSB7XG5cdFx0Y29uc3Qgc2FtcGxlczogbnVtYmVyID0gZ3JhZC5JbnRyIHx8IDQwOTY7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ3NvbGlkJyxcblx0XHRcdG5hbWU6IGdyYWRbJ05tICAnXSxcblx0XHRcdHNtb290aG5lc3M6IGdyYWQuSW50ciAvIDQwOTYsXG5cdFx0XHRjb2xvclN0b3BzOiBncmFkLkNscnMubWFwKHMgPT4gKHtcblx0XHRcdFx0Y29sb3I6IHBhcnNlQ29sb3Ioc1snQ2xyICddKSxcblx0XHRcdFx0bG9jYXRpb246IHMuTGN0biAvIHNhbXBsZXMsXG5cdFx0XHRcdG1pZHBvaW50OiBzLk1kcG4gLyAxMDAsXG5cdFx0XHR9KSksXG5cdFx0XHRvcGFjaXR5U3RvcHM6IGdyYWQuVHJucy5tYXAocyA9PiAoe1xuXHRcdFx0XHRvcGFjaXR5OiBwYXJzZVBlcmNlbnQocy5PcGN0KSxcblx0XHRcdFx0bG9jYXRpb246IHMuTGN0biAvIHNhbXBsZXMsXG5cdFx0XHRcdG1pZHBvaW50OiBzLk1kcG4gLyAxMDAsXG5cdFx0XHR9KSksXG5cdFx0fTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ25vaXNlJyxcblx0XHRcdG5hbWU6IGdyYWRbJ05tICAnXSxcblx0XHRcdHJvdWdobmVzczogZ3JhZC5TbXRoIC8gNDA5Nixcblx0XHRcdGNvbG9yTW9kZWw6IENsclMuZGVjb2RlKGdyYWQuQ2xyUyksXG5cdFx0XHRyYW5kb21TZWVkOiBncmFkLlJuZFMsXG5cdFx0XHRyZXN0cmljdENvbG9yczogISFncmFkLlZjdEMsXG5cdFx0XHRhZGRUcmFuc3BhcmVuY3k6ICEhZ3JhZC5TaFRyLFxuXHRcdFx0bWluOiBncmFkWydNbm0gJ10ubWFwKHggPT4geCAvIDEwMCksXG5cdFx0XHRtYXg6IGdyYWRbJ014bSAnXS5tYXAoeCA9PiB4IC8gMTAwKSxcblx0XHR9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUdyYWRpZW50KGdyYWQ6IEVmZmVjdFNvbGlkR3JhZGllbnQgfCBFZmZlY3ROb2lzZUdyYWRpZW50KTogRGVzY2lwdG9yR3JhZGllbnQge1xuXHRpZiAoZ3JhZC50eXBlID09PSAnc29saWQnKSB7XG5cdFx0Y29uc3Qgc2FtcGxlcyA9IE1hdGgucm91bmQoKGdyYWQuc21vb3RobmVzcyA/PyAxKSAqIDQwOTYpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdEdyZEY6ICdHcmRGLkNzdFMnLFxuXHRcdFx0J05tICAnOiBncmFkLm5hbWUsXG5cdFx0XHRJbnRyOiBzYW1wbGVzLFxuXHRcdFx0Q2xyczogZ3JhZC5jb2xvclN0b3BzLm1hcChzID0+ICh7XG5cdFx0XHRcdCdDbHIgJzogc2VyaWFsaXplQ29sb3Iocy5jb2xvciksXG5cdFx0XHRcdFR5cGU6ICdDbHJ5LlVzclMnLFxuXHRcdFx0XHRMY3RuOiBNYXRoLnJvdW5kKHMubG9jYXRpb24gKiBzYW1wbGVzKSxcblx0XHRcdFx0TWRwbjogTWF0aC5yb3VuZCgocy5taWRwb2ludCA/PyAwLjUpICogMTAwKSxcblx0XHRcdH0pKSxcblx0XHRcdFRybnM6IGdyYWQub3BhY2l0eVN0b3BzLm1hcChzID0+ICh7XG5cdFx0XHRcdE9wY3Q6IHVuaXRzUGVyY2VudChzLm9wYWNpdHkpLFxuXHRcdFx0XHRMY3RuOiBNYXRoLnJvdW5kKHMubG9jYXRpb24gKiBzYW1wbGVzKSxcblx0XHRcdFx0TWRwbjogTWF0aC5yb3VuZCgocy5taWRwb2ludCA/PyAwLjUpICogMTAwKSxcblx0XHRcdH0pKSxcblx0XHR9O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB7XG5cdFx0XHRHcmRGOiAnR3JkRi5DbE5zJyxcblx0XHRcdCdObSAgJzogZ3JhZC5uYW1lLFxuXHRcdFx0U2hUcjogISFncmFkLmFkZFRyYW5zcGFyZW5jeSxcblx0XHRcdFZjdEM6ICEhZ3JhZC5yZXN0cmljdENvbG9ycyxcblx0XHRcdENsclM6IENsclMuZW5jb2RlKGdyYWQuY29sb3JNb2RlbCksXG5cdFx0XHRSbmRTOiBncmFkLnJhbmRvbVNlZWQgfHwgMCxcblx0XHRcdFNtdGg6IE1hdGgucm91bmQoKGdyYWQucm91Z2huZXNzID8/IDEpICogNDA5NiksXG5cdFx0XHQnTW5tICc6IChncmFkLm1pbiB8fCBbMCwgMCwgMCwgMF0pLm1hcCh4ID0+IHggKiAxMDApLFxuXHRcdFx0J014bSAnOiAoZ3JhZC5tYXggfHwgWzEsIDEsIDEsIDFdKS5tYXAoeCA9PiB4ICogMTAwKSxcblx0XHR9O1xuXHR9XG59XG5cbmZ1bmN0aW9uIHBhcnNlR3JhZGllbnRDb250ZW50KGRlc2NyaXB0b3I6IERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQpIHtcblx0Y29uc3QgcmVzdWx0ID0gcGFyc2VHcmFkaWVudChkZXNjcmlwdG9yLkdyYWQpIGFzIChFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCkgJiBFeHRyYUdyYWRpZW50SW5mbztcblx0cmVzdWx0LnN0eWxlID0gR3JkVC5kZWNvZGUoZGVzY3JpcHRvci5UeXBlKTtcblx0aWYgKGRlc2NyaXB0b3IuRHRociAhPT0gdW5kZWZpbmVkKSByZXN1bHQuZGl0aGVyID0gZGVzY3JpcHRvci5EdGhyO1xuXHRpZiAoZGVzY3JpcHRvci5SdnJzICE9PSB1bmRlZmluZWQpIHJlc3VsdC5yZXZlcnNlID0gZGVzY3JpcHRvci5SdnJzO1xuXHRpZiAoZGVzY3JpcHRvci5BbmdsICE9PSB1bmRlZmluZWQpIHJlc3VsdC5hbmdsZSA9IHBhcnNlQW5nbGUoZGVzY3JpcHRvci5BbmdsKTtcblx0aWYgKGRlc2NyaXB0b3JbJ1NjbCAnXSAhPT0gdW5kZWZpbmVkKSByZXN1bHQuc2NhbGUgPSBwYXJzZVBlcmNlbnQoZGVzY3JpcHRvclsnU2NsICddKTtcblx0aWYgKGRlc2NyaXB0b3IuQWxnbiAhPT0gdW5kZWZpbmVkKSByZXN1bHQuYWxpZ24gPSBkZXNjcmlwdG9yLkFsZ247XG5cdGlmIChkZXNjcmlwdG9yLk9mc3QgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJlc3VsdC5vZmZzZXQgPSB7XG5cdFx0XHR4OiBwYXJzZVBlcmNlbnQoZGVzY3JpcHRvci5PZnN0Lkhyem4pLFxuXHRcdFx0eTogcGFyc2VQZXJjZW50KGRlc2NyaXB0b3IuT2ZzdC5WcnRjKVxuXHRcdH07XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gcGFyc2VQYXR0ZXJuQ29udGVudChkZXNjcmlwdG9yOiBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQpIHtcblx0Y29uc3QgcmVzdWx0OiBFZmZlY3RQYXR0ZXJuICYgRXh0cmFQYXR0ZXJuSW5mbyA9IHtcblx0XHRuYW1lOiBkZXNjcmlwdG9yLlB0cm5bJ05tICAnXSxcblx0XHRpZDogZGVzY3JpcHRvci5QdHJuLklkbnQsXG5cdH07XG5cdGlmIChkZXNjcmlwdG9yLkxua2QgIT09IHVuZGVmaW5lZCkgcmVzdWx0LmxpbmtlZCA9IGRlc2NyaXB0b3IuTG5rZDtcblx0aWYgKGRlc2NyaXB0b3IucGhhc2UgIT09IHVuZGVmaW5lZCkgcmVzdWx0LnBoYXNlID0geyB4OiBkZXNjcmlwdG9yLnBoYXNlLkhyem4sIHk6IGRlc2NyaXB0b3IucGhhc2UuVnJ0YyB9O1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVZlY3RvckNvbnRlbnQoZGVzY3JpcHRvcjogRGVzY3JpcHRvclZlY3RvckNvbnRlbnQpOiBWZWN0b3JDb250ZW50IHtcblx0aWYgKCdHcmFkJyBpbiBkZXNjcmlwdG9yKSB7XG5cdFx0cmV0dXJuIHBhcnNlR3JhZGllbnRDb250ZW50KGRlc2NyaXB0b3IpO1xuXHR9IGVsc2UgaWYgKCdQdHJuJyBpbiBkZXNjcmlwdG9yKSB7XG5cdFx0cmV0dXJuIHsgdHlwZTogJ3BhdHRlcm4nLCAuLi5wYXJzZVBhdHRlcm5Db250ZW50KGRlc2NyaXB0b3IpIH07XG5cdH0gZWxzZSBpZiAoJ0NsciAnIGluIGRlc2NyaXB0b3IpIHtcblx0XHRyZXR1cm4geyB0eXBlOiAnY29sb3InLCBjb2xvcjogcGFyc2VDb2xvcihkZXNjcmlwdG9yWydDbHIgJ10pIH07XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZlY3RvciBjb250ZW50Jyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplR3JhZGllbnRDb250ZW50KGNvbnRlbnQ6IChFZmZlY3RTb2xpZEdyYWRpZW50IHwgRWZmZWN0Tm9pc2VHcmFkaWVudCkgJiBFeHRyYUdyYWRpZW50SW5mbykge1xuXHRjb25zdCByZXN1bHQ6IERlc2NyaXB0b3JHcmFkaWVudENvbnRlbnQgPSB7XG5cdFx0R3JhZDogc2VyaWFsaXplR3JhZGllbnQoY29udGVudCksXG5cdFx0VHlwZTogR3JkVC5lbmNvZGUoY29udGVudC5zdHlsZSksXG5cdH07XG5cdGlmIChjb250ZW50LmRpdGhlciAhPT0gdW5kZWZpbmVkKSByZXN1bHQuRHRociA9IGNvbnRlbnQuZGl0aGVyO1xuXHRpZiAoY29udGVudC5yZXZlcnNlICE9PSB1bmRlZmluZWQpIHJlc3VsdC5SdnJzID0gY29udGVudC5yZXZlcnNlO1xuXHRpZiAoY29udGVudC5hbmdsZSAhPT0gdW5kZWZpbmVkKSByZXN1bHQuQW5nbCA9IHVuaXRzQW5nbGUoY29udGVudC5hbmdsZSk7XG5cdGlmIChjb250ZW50LnNjYWxlICE9PSB1bmRlZmluZWQpIHJlc3VsdFsnU2NsICddID0gdW5pdHNQZXJjZW50KGNvbnRlbnQuc2NhbGUpO1xuXHRpZiAoY29udGVudC5hbGlnbiAhPT0gdW5kZWZpbmVkKSByZXN1bHQuQWxnbiA9IGNvbnRlbnQuYWxpZ247XG5cdGlmIChjb250ZW50Lm9mZnNldCkge1xuXHRcdHJlc3VsdC5PZnN0ID0ge1xuXHRcdFx0SHJ6bjogdW5pdHNQZXJjZW50KGNvbnRlbnQub2Zmc2V0LngpLFxuXHRcdFx0VnJ0YzogdW5pdHNQZXJjZW50KGNvbnRlbnQub2Zmc2V0LnkpLFxuXHRcdH07XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplUGF0dGVybkNvbnRlbnQoY29udGVudDogRWZmZWN0UGF0dGVybiAmIEV4dHJhUGF0dGVybkluZm8pIHtcblx0Y29uc3QgcmVzdWx0OiBEZXNjcmlwdG9yUGF0dGVybkNvbnRlbnQgPSB7XG5cdFx0UHRybjoge1xuXHRcdFx0J05tICAnOiBjb250ZW50Lm5hbWUgfHwgJycsXG5cdFx0XHRJZG50OiBjb250ZW50LmlkIHx8ICcnLFxuXHRcdH1cblx0fTtcblx0aWYgKGNvbnRlbnQubGlua2VkICE9PSB1bmRlZmluZWQpIHJlc3VsdC5MbmtkID0gISFjb250ZW50LmxpbmtlZDtcblx0aWYgKGNvbnRlbnQucGhhc2UgIT09IHVuZGVmaW5lZCkgcmVzdWx0LnBoYXNlID0geyBIcnpuOiBjb250ZW50LnBoYXNlLngsIFZydGM6IGNvbnRlbnQucGhhc2UueSB9O1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVWZWN0b3JDb250ZW50KGNvbnRlbnQ6IFZlY3RvckNvbnRlbnQpOiB7IGRlc2NyaXB0b3I6IERlc2NyaXB0b3JWZWN0b3JDb250ZW50OyBrZXk6IHN0cmluZzsgfSB7XG5cdGlmIChjb250ZW50LnR5cGUgPT09ICdjb2xvcicpIHtcblx0XHRyZXR1cm4geyBrZXk6ICdTb0NvJywgZGVzY3JpcHRvcjogeyAnQ2xyICc6IHNlcmlhbGl6ZUNvbG9yKGNvbnRlbnQuY29sb3IpIH0gfTtcblx0fSBlbHNlIGlmIChjb250ZW50LnR5cGUgPT09ICdwYXR0ZXJuJykge1xuXHRcdHJldHVybiB7IGtleTogJ1B0RmwnLCBkZXNjcmlwdG9yOiBzZXJpYWxpemVQYXR0ZXJuQ29udGVudChjb250ZW50KSB9O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB7IGtleTogJ0dkRmwnLCBkZXNjcmlwdG9yOiBzZXJpYWxpemVHcmFkaWVudENvbnRlbnQoY29udGVudCkgfTtcblx0fVxufVxuXG5mdW5jdGlvbiBwYXJzZUFuZ2xlKHg6IERlc2NyaXB0b3JVbml0c1ZhbHVlKSB7XG5cdGlmICh4ID09PSB1bmRlZmluZWQpIHJldHVybiAwO1xuXHRpZiAoeC51bml0cyAhPT0gJ0FuZ2xlJykgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzOiAke3gudW5pdHN9YCk7XG5cdHJldHVybiB4LnZhbHVlO1xufVxuXG5mdW5jdGlvbiBwYXJzZVBlcmNlbnQoeDogRGVzY3JpcHRvclVuaXRzVmFsdWUgfCB1bmRlZmluZWQpIHtcblx0aWYgKHggPT09IHVuZGVmaW5lZCkgcmV0dXJuIDE7XG5cdGlmICh4LnVuaXRzICE9PSAnUGVyY2VudCcpIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHt4LnVuaXRzfWApO1xuXHRyZXR1cm4geC52YWx1ZSAvIDEwMDtcbn1cblxuZnVuY3Rpb24gcGFyc2VVbml0cyh7IHVuaXRzLCB2YWx1ZSB9OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSk6IFVuaXRzVmFsdWUge1xuXHRpZiAoXG5cdFx0dW5pdHMgIT09ICdQaXhlbHMnICYmIHVuaXRzICE9PSAnTWlsbGltZXRlcnMnICYmIHVuaXRzICE9PSAnUG9pbnRzJyAmJiB1bml0cyAhPT0gJ05vbmUnICYmXG5cdFx0dW5pdHMgIT09ICdQaWNhcycgJiYgdW5pdHMgIT09ICdJbmNoZXMnICYmIHVuaXRzICE9PSAnQ2VudGltZXRlcnMnXG5cdCkge1xuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB1bml0czogJHtKU09OLnN0cmluZ2lmeSh7IHVuaXRzLCB2YWx1ZSB9KX1gKTtcblx0fVxuXHRyZXR1cm4geyB2YWx1ZSwgdW5pdHMgfTtcbn1cblxuZnVuY3Rpb24gdW5pdHNBbmdsZSh2YWx1ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogRGVzY3JpcHRvclVuaXRzVmFsdWUge1xuXHRyZXR1cm4geyB1bml0czogJ0FuZ2xlJywgdmFsdWU6IHZhbHVlIHx8IDAgfTtcbn1cblxuZnVuY3Rpb24gdW5pdHNQZXJjZW50KHZhbHVlOiBudW1iZXIgfCB1bmRlZmluZWQpOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZSB7XG5cdHJldHVybiB7IHVuaXRzOiAnUGVyY2VudCcsIHZhbHVlOiBNYXRoLnJvdW5kKGNsYW1wKHZhbHVlIHx8IDAsIDAsIDEpICogMTAwKSB9O1xufVxuXG5mdW5jdGlvbiB1bml0c1ZhbHVlKHg6IFVuaXRzVmFsdWUgfCB1bmRlZmluZWQsIGtleTogc3RyaW5nKTogRGVzY3JpcHRvclVuaXRzVmFsdWUge1xuXHRpZiAoeCA9PSBudWxsKSByZXR1cm4geyB1bml0czogJ1BpeGVscycsIHZhbHVlOiAwIH07XG5cblx0aWYgKHR5cGVvZiB4ICE9PSAnb2JqZWN0Jylcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWU6ICR7SlNPTi5zdHJpbmdpZnkoeCl9IChrZXk6ICR7a2V5fSkgKHNob3VsZCBoYXZlIHZhbHVlIGFuZCB1bml0cylgKTtcblxuXHRjb25zdCB7IHVuaXRzLCB2YWx1ZSB9ID0geDtcblxuXHRpZiAodHlwZW9mIHZhbHVlICE9PSAnbnVtYmVyJylcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWUgaW4gJHtKU09OLnN0cmluZ2lmeSh4KX0gKGtleTogJHtrZXl9KWApO1xuXG5cdGlmIChcblx0XHR1bml0cyAhPT0gJ1BpeGVscycgJiYgdW5pdHMgIT09ICdNaWxsaW1ldGVycycgJiYgdW5pdHMgIT09ICdQb2ludHMnICYmIHVuaXRzICE9PSAnTm9uZScgJiZcblx0XHR1bml0cyAhPT0gJ1BpY2FzJyAmJiB1bml0cyAhPT0gJ0luY2hlcycgJiYgdW5pdHMgIT09ICdDZW50aW1ldGVycydcblx0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHVuaXRzIGluICR7SlNPTi5zdHJpbmdpZnkoeCl9IChrZXk6ICR7a2V5fSlgKTtcblx0fVxuXG5cdHJldHVybiB7IHVuaXRzLCB2YWx1ZSB9O1xufVxuXG5mdW5jdGlvbiBwYXJzZUNvbG9yKGNvbG9yOiBEZXNjcmlwdG9yQ29sb3IpOiBDb2xvciB7XG5cdGlmICgnSCAgICcgaW4gY29sb3IpIHtcblx0XHRyZXR1cm4geyBoOiBwYXJzZVBlcmNlbnQoY29sb3JbJ0ggICAnXSksIHM6IGNvbG9yLlN0cnQsIGI6IGNvbG9yLkJyZ2ggfTtcblx0fSBlbHNlIGlmICgnUmQgICcgaW4gY29sb3IpIHtcblx0XHRyZXR1cm4geyByOiBjb2xvclsnUmQgICddLCBnOiBjb2xvclsnR3JuICddLCBiOiBjb2xvclsnQmwgICddIH07XG5cdH0gZWxzZSBpZiAoJ0N5biAnIGluIGNvbG9yKSB7XG5cdFx0cmV0dXJuIHsgYzogY29sb3JbJ0N5biAnXSwgbTogY29sb3IuTWdudCwgeTogY29sb3JbJ1lsdyAnXSwgazogY29sb3IuQmxjayB9O1xuXHR9IGVsc2UgaWYgKCdHcnkgJyBpbiBjb2xvcikge1xuXHRcdHJldHVybiB7IGs6IGNvbG9yWydHcnkgJ10gfTtcblx0fSBlbHNlIGlmICgnTG1uYycgaW4gY29sb3IpIHtcblx0XHRyZXR1cm4geyBsOiBjb2xvci5MbW5jLCBhOiBjb2xvclsnQSAgICddLCBiOiBjb2xvclsnQiAgICddIH07XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBjb2xvciBkZXNjcmlwdG9yJyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplQ29sb3IoY29sb3I6IENvbG9yIHwgdW5kZWZpbmVkKTogRGVzY3JpcHRvckNvbG9yIHtcblx0aWYgKCFjb2xvcikge1xuXHRcdHJldHVybiB7ICdSZCAgJzogMCwgJ0dybiAnOiAwLCAnQmwgICc6IDAgfTtcblx0fSBlbHNlIGlmICgncicgaW4gY29sb3IpIHtcblx0XHRyZXR1cm4geyAnUmQgICc6IGNvbG9yLnIgfHwgMCwgJ0dybiAnOiBjb2xvci5nIHx8IDAsICdCbCAgJzogY29sb3IuYiB8fCAwIH07XG5cdH0gZWxzZSBpZiAoJ2gnIGluIGNvbG9yKSB7XG5cdFx0cmV0dXJuIHsgJ0ggICAnOiB1bml0c1BlcmNlbnQoY29sb3IuaCksIFN0cnQ6IGNvbG9yLnMgfHwgMCwgQnJnaDogY29sb3IuYiB8fCAwIH07XG5cdH0gZWxzZSBpZiAoJ2MnIGluIGNvbG9yKSB7XG5cdFx0cmV0dXJuIHsgJ0N5biAnOiBjb2xvci5jIHx8IDAsIE1nbnQ6IGNvbG9yLm0gfHwgMCwgJ1lsdyAnOiBjb2xvci55IHx8IDAsIEJsY2s6IGNvbG9yLmsgfHwgMCB9O1xuXHR9IGVsc2UgaWYgKCdsJyBpbiBjb2xvcikge1xuXHRcdHJldHVybiB7IExtbmM6IGNvbG9yLmwgfHwgMCwgJ0EgICAnOiBjb2xvci5hIHx8IDAsICdCICAgJzogY29sb3IuYiB8fCAwIH07XG5cdH0gZWxzZSBpZiAoJ2snIGluIGNvbG9yKSB7XG5cdFx0cmV0dXJuIHsgJ0dyeSAnOiBjb2xvci5rIH07XG5cdH0gZWxzZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbG9yIHZhbHVlJyk7XG5cdH1cbn1cblxudHlwZSBBbGxFZmZlY3RzID0gTGF5ZXJFZmZlY3RTaGFkb3cgJiBMYXllckVmZmVjdHNPdXRlckdsb3cgJiBMYXllckVmZmVjdFN0cm9rZSAmXG5cdExheWVyRWZmZWN0SW5uZXJHbG93ICYgTGF5ZXJFZmZlY3RCZXZlbCAmIExheWVyRWZmZWN0U29saWRGaWxsICZcblx0TGF5ZXJFZmZlY3RQYXR0ZXJuT3ZlcmxheSAmIExheWVyRWZmZWN0U2F0aW4gJiBMYXllckVmZmVjdEdyYWRpZW50T3ZlcmxheTtcblxuZnVuY3Rpb24gcGFyc2VFZmZlY3RPYmplY3Qob2JqOiBhbnksIHJlcG9ydEVycm9yczogYm9vbGVhbikge1xuXHRjb25zdCByZXN1bHQ6IEFsbEVmZmVjdHMgPSB7fSBhcyBhbnk7XG5cblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuXHRcdGNvbnN0IHZhbCA9IG9ialtrZXldO1xuXG5cdFx0c3dpdGNoIChrZXkpIHtcblx0XHRcdGNhc2UgJ2VuYWInOiByZXN1bHQuZW5hYmxlZCA9ICEhdmFsOyBicmVhaztcblx0XHRcdGNhc2UgJ3VnbGcnOiByZXN1bHQudXNlR2xvYmFsTGlnaHQgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdBbnRBJzogcmVzdWx0LmFudGlhbGlhc2VkID0gISF2YWw7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnQWxnbic6IHJlc3VsdC5hbGlnbiA9ICEhdmFsOyBicmVhaztcblx0XHRcdGNhc2UgJ0R0aHInOiByZXN1bHQuZGl0aGVyID0gISF2YWw7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnSW52cic6IHJlc3VsdC5pbnZlcnQgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdSdnJzJzogcmVzdWx0LnJldmVyc2UgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdDbHIgJzogcmVzdWx0LmNvbG9yID0gcGFyc2VDb2xvcih2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ2hnbEMnOiByZXN1bHQuaGlnaGxpZ2h0Q29sb3IgPSBwYXJzZUNvbG9yKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2R3Qyc6IHJlc3VsdC5zaGFkb3dDb2xvciA9IHBhcnNlQ29sb3IodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdTdHlsJzogcmVzdWx0LnBvc2l0aW9uID0gRlN0bC5kZWNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdNZCAgJzogcmVzdWx0LmJsZW5kTW9kZSA9IEJsbk0uZGVjb2RlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnaGdsTSc6IHJlc3VsdC5oaWdobGlnaHRCbGVuZE1vZGUgPSBCbG5NLmRlY29kZSh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3Nkd00nOiByZXN1bHQuc2hhZG93QmxlbmRNb2RlID0gQmxuTS5kZWNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdidmxTJzogcmVzdWx0LnN0eWxlID0gQkVTbC5kZWNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdidmxEJzogcmVzdWx0LmRpcmVjdGlvbiA9IEJFU3MuZGVjb2RlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnYnZsVCc6IHJlc3VsdC50ZWNobmlxdWUgPSBidmxULmRlY29kZSh2YWwpIGFzIGFueTsgYnJlYWs7XG5cdFx0XHRjYXNlICdHbHdUJzogcmVzdWx0LnRlY2huaXF1ZSA9IEJFVEUuZGVjb2RlKHZhbCkgYXMgYW55OyBicmVhaztcblx0XHRcdGNhc2UgJ2dsd1MnOiByZXN1bHQuc291cmNlID0gSUdTci5kZWNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdUeXBlJzogcmVzdWx0LnR5cGUgPSBHcmRULmRlY29kZSh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ09wY3QnOiByZXN1bHQub3BhY2l0eSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ2hnbE8nOiByZXN1bHQuaGlnaGxpZ2h0T3BhY2l0eSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3Nkd08nOiByZXN1bHQuc2hhZG93T3BhY2l0eSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ2xhZ2wnOiByZXN1bHQuYW5nbGUgPSBwYXJzZUFuZ2xlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnQW5nbCc6IHJlc3VsdC5hbmdsZSA9IHBhcnNlQW5nbGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdMYWxkJzogcmVzdWx0LmFsdGl0dWRlID0gcGFyc2VBbmdsZSh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ1NmdG4nOiByZXN1bHQuc29mdGVuID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3NyZ1InOiByZXN1bHQuc3RyZW5ndGggPSBwYXJzZVBlcmNlbnQodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdibHVyJzogcmVzdWx0LnNpemUgPSBwYXJzZVVuaXRzKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnTm9zZSc6IHJlc3VsdC5ub2lzZSA9IHBhcnNlUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ0lucHInOiByZXN1bHQucmFuZ2UgPSBwYXJzZVBlcmNlbnQodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdDa210JzogcmVzdWx0LmNob2tlID0gcGFyc2VVbml0cyh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ1NoZE4nOiByZXN1bHQuaml0dGVyID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnRHN0bic6IHJlc3VsdC5kaXN0YW5jZSA9IHBhcnNlVW5pdHModmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdTY2wgJzogcmVzdWx0LnNjYWxlID0gcGFyc2VQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnUHRybic6IHJlc3VsdC5wYXR0ZXJuID0geyBuYW1lOiB2YWxbJ05tICAnXSwgaWQ6IHZhbC5JZG50IH07IGJyZWFrO1xuXHRcdFx0Y2FzZSAncGhhc2UnOiByZXN1bHQucGhhc2UgPSB7IHg6IHZhbC5IcnpuLCB5OiB2YWwuVnJ0YyB9OyBicmVhaztcblx0XHRcdGNhc2UgJ09mc3QnOiByZXN1bHQub2Zmc2V0ID0geyB4OiBwYXJzZVBlcmNlbnQodmFsLkhyem4pLCB5OiBwYXJzZVBlcmNlbnQodmFsLlZydGMpIH07IGJyZWFrO1xuXHRcdFx0Y2FzZSAnTXBnUyc6XG5cdFx0XHRjYXNlICdUcm5TJzpcblx0XHRcdFx0cmVzdWx0LmNvbnRvdXIgPSB7XG5cdFx0XHRcdFx0bmFtZTogdmFsWydObSAgJ10sXG5cdFx0XHRcdFx0Y3VydmU6ICh2YWxbJ0NydiAnXSBhcyBhbnlbXSkubWFwKHAgPT4gKHsgeDogcC5IcnpuLCB5OiBwLlZydGMgfSkpLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ0dyYWQnOiByZXN1bHQuZ3JhZGllbnQgPSBwYXJzZUdyYWRpZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAndXNlVGV4dHVyZSc6XG5cdFx0XHRjYXNlICd1c2VTaGFwZSc6XG5cdFx0XHRjYXNlICdsYXllckNvbmNlYWxzJzpcblx0XHRcdGNhc2UgJ2FudGlhbGlhc0dsb3NzJzogcmVzdWx0W2tleV0gPSB2YWw7IGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmVwb3J0RXJyb3JzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIGVmZmVjdCBrZXk6ICcke2tleX0nOmAsIHZhbCk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplRWZmZWN0T2JqZWN0KG9iajogYW55LCBvYmpOYW1lOiBzdHJpbmcsIHJlcG9ydEVycm9yczogYm9vbGVhbikge1xuXHRjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xuXG5cdGZvciAoY29uc3Qgb2JqS2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcblx0XHRjb25zdCBrZXk6IGtleW9mIEFsbEVmZmVjdHMgPSBvYmpLZXkgYXMgYW55O1xuXHRcdGNvbnN0IHZhbCA9IG9ialtrZXldO1xuXG5cdFx0c3dpdGNoIChrZXkpIHtcblx0XHRcdGNhc2UgJ2VuYWJsZWQnOiByZXN1bHQuZW5hYiA9ICEhdmFsOyBicmVhaztcblx0XHRcdGNhc2UgJ3VzZUdsb2JhbExpZ2h0JzogcmVzdWx0LnVnbGcgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdhbnRpYWxpYXNlZCc6IHJlc3VsdC5BbnRBID0gISF2YWw7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnYWxpZ24nOiByZXN1bHQuQWxnbiA9ICEhdmFsOyBicmVhaztcblx0XHRcdGNhc2UgJ2RpdGhlcic6IHJlc3VsdC5EdGhyID0gISF2YWw7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnaW52ZXJ0JzogcmVzdWx0LkludnIgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdyZXZlcnNlJzogcmVzdWx0LlJ2cnMgPSAhIXZhbDsgYnJlYWs7XG5cdFx0XHRjYXNlICdjb2xvcic6IHJlc3VsdFsnQ2xyICddID0gc2VyaWFsaXplQ29sb3IodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdoaWdobGlnaHRDb2xvcic6IHJlc3VsdC5oZ2xDID0gc2VyaWFsaXplQ29sb3IodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdzaGFkb3dDb2xvcic6IHJlc3VsdC5zZHdDID0gc2VyaWFsaXplQ29sb3IodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdwb3NpdGlvbic6IHJlc3VsdC5TdHlsID0gRlN0bC5lbmNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdibGVuZE1vZGUnOiByZXN1bHRbJ01kICAnXSA9IEJsbk0uZW5jb2RlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnaGlnaGxpZ2h0QmxlbmRNb2RlJzogcmVzdWx0LmhnbE0gPSBCbG5NLmVuY29kZSh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3NoYWRvd0JsZW5kTW9kZSc6IHJlc3VsdC5zZHdNID0gQmxuTS5lbmNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdzdHlsZSc6IHJlc3VsdC5idmxTID0gQkVTbC5lbmNvZGUodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdkaXJlY3Rpb24nOiByZXN1bHQuYnZsRCA9IEJFU3MuZW5jb2RlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAndGVjaG5pcXVlJzpcblx0XHRcdFx0aWYgKG9iak5hbWUgPT09ICdiZXZlbCcpIHtcblx0XHRcdFx0XHRyZXN1bHQuYnZsVCA9IGJ2bFQuZW5jb2RlKHZhbCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0Lkdsd1QgPSBCRVRFLmVuY29kZSh2YWwpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnc291cmNlJzogcmVzdWx0Lmdsd1MgPSBJR1NyLmVuY29kZSh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3R5cGUnOiByZXN1bHQuVHlwZSA9IEdyZFQuZW5jb2RlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnb3BhY2l0eSc6IHJlc3VsdC5PcGN0ID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnaGlnaGxpZ2h0T3BhY2l0eSc6IHJlc3VsdC5oZ2xPID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2hhZG93T3BhY2l0eSc6IHJlc3VsdC5zZHdPID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnYW5nbGUnOlxuXHRcdFx0XHRpZiAob2JqTmFtZSA9PT0gJ2dyYWRpZW50T3ZlcmxheScpIHtcblx0XHRcdFx0XHRyZXN1bHQuQW5nbCA9IHVuaXRzQW5nbGUodmFsKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQubGFnbCA9IHVuaXRzQW5nbGUodmFsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2FsdGl0dWRlJzogcmVzdWx0LkxhbGQgPSB1bml0c0FuZ2xlKHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnc29mdGVuJzogcmVzdWx0LlNmdG4gPSB1bml0c1ZhbHVlKHZhbCwga2V5KTsgYnJlYWs7XG5cdFx0XHRjYXNlICdzdHJlbmd0aCc6IHJlc3VsdC5zcmdSID0gdW5pdHNQZXJjZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2l6ZSc6IHJlc3VsdC5ibHVyID0gdW5pdHNWYWx1ZSh2YWwsIGtleSk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnbm9pc2UnOiByZXN1bHQuTm9zZSA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3JhbmdlJzogcmVzdWx0LklucHIgPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdjaG9rZSc6IHJlc3VsdC5Da210ID0gdW5pdHNWYWx1ZSh2YWwsIGtleSk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnaml0dGVyJzogcmVzdWx0LlNoZE4gPSB1bml0c1BlcmNlbnQodmFsKTsgYnJlYWs7XG5cdFx0XHRjYXNlICdkaXN0YW5jZSc6IHJlc3VsdC5Ec3RuID0gdW5pdHNWYWx1ZSh2YWwsIGtleSk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAnc2NhbGUnOiByZXN1bHRbJ1NjbCAnXSA9IHVuaXRzUGVyY2VudCh2YWwpOyBicmVhaztcblx0XHRcdGNhc2UgJ3BhdHRlcm4nOiByZXN1bHQuUHRybiA9IHsgJ05tICAnOiB2YWwubmFtZSwgSWRudDogdmFsLmlkIH07IGJyZWFrO1xuXHRcdFx0Y2FzZSAncGhhc2UnOiByZXN1bHQucGhhc2UgPSB7IEhyem46IHZhbC54LCBWcnRjOiB2YWwueSB9OyBicmVhaztcblx0XHRcdGNhc2UgJ29mZnNldCc6IHJlc3VsdC5PZnN0ID0geyBIcnpuOiB1bml0c1BlcmNlbnQodmFsLngpLCBWcnRjOiB1bml0c1BlcmNlbnQodmFsLnkpIH07IGJyZWFrO1xuXHRcdFx0Y2FzZSAnY29udG91cic6IHtcblx0XHRcdFx0cmVzdWx0W29iak5hbWUgPT09ICdzYXRpbicgPyAnTXBnUycgOiAnVHJuUyddID0ge1xuXHRcdFx0XHRcdCdObSAgJzogKHZhbCBhcyBFZmZlY3RDb250b3VyKS5uYW1lLFxuXHRcdFx0XHRcdCdDcnYgJzogKHZhbCBhcyBFZmZlY3RDb250b3VyKS5jdXJ2ZS5tYXAocCA9PiAoeyBIcnpuOiBwLngsIFZydGM6IHAueSB9KSksXG5cdFx0XHRcdH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZ3JhZGllbnQnOiByZXN1bHQuR3JhZCA9IHNlcmlhbGl6ZUdyYWRpZW50KHZhbCk7IGJyZWFrO1xuXHRcdFx0Y2FzZSAndXNlVGV4dHVyZSc6XG5cdFx0XHRjYXNlICd1c2VTaGFwZSc6XG5cdFx0XHRjYXNlICdsYXllckNvbmNlYWxzJzpcblx0XHRcdGNhc2UgJ2FudGlhbGlhc0dsb3NzJzpcblx0XHRcdFx0cmVzdWx0W2tleV0gPSB2YWw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmVwb3J0RXJyb3JzICYmIGNvbnNvbGUubG9nKGBJbnZhbGlkIGVmZmVjdCBrZXk6ICcke2tleX0nIHZhbHVlOmAsIHZhbCk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cbiJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2pvZXJhaWkvZGV2L2FnLXBzZC9zcmMifQ==
