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
var fs = require("fs");
var path = require("path");
var chai_1 = require("chai");
var common_1 = require("./common");
var index_1 = require("../index");
var psdReader_1 = require("../psdReader");
var testFilesPath = path.join(__dirname, '..', '..', 'test');
var readFilesPath = path.join(testFilesPath, 'read');
var readWriteFilesPath = path.join(testFilesPath, 'read-write');
var resultsFilesPath = path.join(__dirname, '..', '..', 'results');
var opts = {
    throwForMissingFeatures: true,
    logMissingFeatures: true,
};
describe('PsdReader', function () {
    it('reads width and height properly', function () {
        var psd = common_1.readPsdFromFile(path.join(readFilesPath, 'blend-mode', 'src.psd'), __assign({}, opts));
        chai_1.expect(psd.width).equal(300);
        chai_1.expect(psd.height).equal(200);
    });
    it('skips composite image data', function () {
        var psd = common_1.readPsdFromFile(path.join(readFilesPath, 'layers', 'src.psd'), __assign(__assign({}, opts), { skipCompositeImageData: true }));
        chai_1.expect(psd.canvas).not.ok;
    });
    it('skips layer image data', function () {
        var psd = common_1.readPsdFromFile(path.join(readFilesPath, 'layers', 'src.psd'), __assign(__assign({}, opts), { skipLayerImageData: true }));
        chai_1.expect(psd.children[0].canvas).not.ok;
    });
    it.skip('can read a PSD with layer masks (only if throw on missing features is not set)', function () {
        var psd = common_1.readPsdFromFile(path.join(readFilesPath, '..', 'layer-mask', 'src.psd'));
        chai_1.expect(psd.children[0].canvas).ok;
    });
    it('reads PSD from Buffer with offset', function () {
        var file = fs.readFileSync(path.join(readFilesPath, 'layers', 'src.psd'));
        var outer = Buffer.alloc(file.byteLength + 100);
        file.copy(outer, 100);
        var inner = Buffer.from(outer.buffer, 100, file.byteLength);
        var psd = index_1.readPsd(inner, opts);
        chai_1.expect(psd.width).equal(300);
    });
    fs.readdirSync(readFilesPath).filter(function (f) { return !/pattern/.test(f); }).forEach(function (f) {
        it("reads PSD file (" + f + ")", function () {
            var _a;
            var basePath = path.join(readFilesPath, f);
            var psd = common_1.readPsdFromFile(path.join(basePath, 'src.psd'), __assign({}, opts));
            var expected = common_1.importPSD(basePath);
            var images = common_1.loadImagesFromDirectory(basePath);
            var compare = [];
            compare.push({ name: "canvas.png", canvas: psd.canvas });
            psd.canvas = undefined;
            delete psd.imageData;
            delete psd.imageResources.xmpMetadata;
            var i = 0;
            function pushLayerCanvases(layers) {
                for (var _i = 0, layers_1 = layers; _i < layers_1.length; _i++) {
                    var l = layers_1[_i];
                    if (l.children) {
                        pushLayerCanvases(l.children);
                    }
                    else {
                        var layerId = i++;
                        compare.push({ name: "layer-" + layerId + ".png", canvas: l.canvas });
                        l.canvas = undefined;
                        delete l.imageData;
                        if (l.mask) {
                            compare.push({ name: "layer-" + layerId + "-mask.png", canvas: l.mask.canvas });
                            delete l.mask.canvas;
                            delete l.mask.imageData;
                        }
                    }
                }
            }
            pushLayerCanvases(psd.children || []);
            fs.mkdirSync(path.join(resultsFilesPath, f), { recursive: true });
            if ((_a = psd.imageResources) === null || _a === void 0 ? void 0 : _a.thumbnail) {
                compare.push({ name: 'thumb.png', canvas: psd.imageResources.thumbnail, skip: true });
                delete psd.imageResources.thumbnail;
            }
            if (psd.imageResources)
                delete psd.imageResources.thumbnailRaw;
            compare.forEach(function (i) { return common_1.saveCanvas(path.join(resultsFilesPath, f, i.name), i.canvas); });
            fs.writeFileSync(path.join(resultsFilesPath, f, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');
            clearEmptyCanvasFields(psd);
            clearEmptyCanvasFields(expected);
            chai_1.expect(psd).eql(expected, f);
            compare.forEach(function (i) { return i.skip || common_1.compareCanvases(images[i.name], i.canvas, f + "/" + i.name); });
        });
    });
    fs.readdirSync(readWriteFilesPath).forEach(function (f) {
        it("reads-writes PSD file (" + f + ")", function () {
            var psd = common_1.readPsdFromFile(path.join(readWriteFilesPath, f, 'src.psd'), __assign(__assign({}, opts), { useImageData: true, useRawThumbnail: true }));
            var actual = index_1.writePsdBuffer(psd, { logMissingFeatures: true });
            var expected = fs.readFileSync(path.join(readWriteFilesPath, f, 'expected.psd'));
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-" + f + ".psd"), actual);
            common_1.compareBuffers(actual, expected, "read-write-" + f);
        });
    });
    it.skip('write text layer test', function () {
        var psd = {
            width: 200,
            height: 200,
            children: [
                {
                    name: 'text layer',
                    text: {
                        text: 'Hello World\n• c • tiny!\r\ntest',
                        // orientation: 'vertical',
                        transform: [1, 0, 0, 1, 70, 70],
                        style: {
                            font: { name: 'ArialMT' },
                            fontSize: 30,
                            fillColor: { r: 0, g: 128, b: 0 },
                        },
                        styleRuns: [
                            { length: 12, style: { fillColor: { r: 255, g: 0, b: 0 } } },
                            { length: 12, style: { fillColor: { r: 0, g: 0, b: 255 } } },
                            { length: 4, style: { underline: true } },
                        ],
                        paragraphStyle: {
                            justification: 'center',
                        },
                        warp: {
                            style: 'arc',
                            value: 50,
                            perspective: 0,
                            perspectiveOther: 0,
                            rotate: 'horizontal',
                        },
                    },
                },
                {
                    name: '2nd layer',
                    text: {
                        text: 'Aaaaa',
                        transform: [1, 0, 0, 1, 70, 70],
                    },
                },
            ],
        };
        fs.writeFileSync(path.join(resultsFilesPath, '_TEXT2.psd'), index_1.writePsdBuffer(psd, { logMissingFeatures: true }));
    });
    it.skip('read text layer test', function () {
        var psd = common_1.readPsdFromFile(path.join(testFilesPath, 'text-test.psd'), opts);
        // const layer = psd.children![1];
        // layer.text!.text = 'Foo bar';
        var buffer = index_1.writePsdBuffer(psd, { logMissingFeatures: true });
        fs.writeFileSync(path.join(resultsFilesPath, '_TEXT.psd'), buffer);
        // console.log(require('util').inspect(psd.children![0].text, false, 99, true));
        // console.log(require('util').inspect(psd.children![1].text, false, 99, true));
        // console.log(require('util').inspect(psd.engineData, false, 99, true));
    });
    it.skip('READ TEST', function () {
        var originalBuffer = fs.readFileSync(path.join(testFilesPath, 'test.psd'));
        console.log('READING ORIGINAL');
        var opts = {
            logMissingFeatures: true,
            throwForMissingFeatures: true,
            useImageData: true,
            useRawThumbnail: true,
            logDevFeatures: true,
        };
        var originalPsd = psdReader_1.readPsd(common_1.createReaderFromBuffer(originalBuffer), opts);
        console.log('WRITING');
        var buffer = index_1.writePsdBuffer(originalPsd, { logMissingFeatures: true });
        fs.writeFileSync('temp.psd', buffer);
        // fs.writeFileSync('temp.bin', buffer);
        // fs.writeFileSync('temp.json', JSON.stringify(originalPsd, null, 2), 'utf8');
        // fs.writeFileSync('temp.xml', originalPsd.imageResources?.xmpMetadata, 'utf8');
        console.log('READING WRITTEN');
        var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(buffer), { logMissingFeatures: true, throwForMissingFeatures: true });
        clearCanvasFields(originalPsd);
        clearCanvasFields(psd);
        delete originalPsd.imageResources.thumbnail;
        delete psd.imageResources.thumbnail;
        delete originalPsd.imageResources.thumbnailRaw;
        delete psd.imageResources.thumbnailRaw;
        // console.log(require('util').inspect(originalPsd, false, 99, true));
        // fs.writeFileSync('original.json', JSON.stringify(originalPsd, null, 2));
        // fs.writeFileSync('after.json', JSON.stringify(psd, null, 2));
        common_1.compareBuffers(buffer, originalBuffer, 'test');
        chai_1.expect(psd).eql(originalPsd);
    });
    it.skip('decode engine data 2', function () {
        // const fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Vertical.txt'));
        var fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Simple.txt'));
        var func = new Function("return " + fileData + ";");
        var data = func();
        var result = decodeEngineData2(data);
        fs.writeFileSync(path.join(__dirname, '..', '..', 'resources', 'temp.js'), 'var x = ' + require('util').inspect(result, false, 99, false), 'utf8');
    });
    it.skip('test.psd', function () {
        var buffer = fs.readFileSync('test.psd');
        var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(buffer), {
            skipCompositeImageData: true,
            skipLayerImageData: true,
            skipThumbnail: true,
            throwForMissingFeatures: true,
            logDevFeatures: true,
        });
        delete psd.engineData;
        psd.imageResources = {};
        console.log(require('util').inspect(psd, false, 99, true));
    });
    it.skip('test', function () {
        var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(fs.readFileSync("test/read-write/text-box/src.psd")), {
            // skipCompositeImageData: true,
            // skipLayerImageData: true,
            // skipThumbnail: true,
            throwForMissingFeatures: true,
            logDevFeatures: true,
            useRawThumbnail: true,
        });
        fs.writeFileSync('text_rect_out.psd', index_1.writePsdBuffer(psd, { logMissingFeatures: true }));
        fs.writeFileSync('text_rect_out.bin', index_1.writePsdBuffer(psd, { logMissingFeatures: true }));
        // const psd2 = readPsdInternal(createReaderFromBuffer(fs.readFileSync(`text_rect_out.psd`)), {
        // 	// skipCompositeImageData: true,
        // 	// skipLayerImageData: true,
        // 	// skipThumbnail: true,
        // 	throwForMissingFeatures: true,
        // 	logDevFeatures: true,
        // });
        // psd2;
        var original = fs.readFileSync("test/read-write/text-box/src.psd");
        var output = fs.readFileSync("text_rect_out.psd");
        common_1.compareBuffers(output, original, '-', 0x65d8); // , 0x8ce8, 0x8fca - 0x8ce8);
    });
    it.skip('compare test', function () {
        for (var _i = 0, _a = ['text_point', 'text_rect']; _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(fs.readFileSync(name_1 + ".psd")), {
                skipCompositeImageData: true,
                skipLayerImageData: true,
                skipThumbnail: true,
                throwForMissingFeatures: true,
                logDevFeatures: true,
            });
            // psd.imageResources = {};
            fs.writeFileSync(name_1 + ".txt", require('util').inspect(psd, false, 99, false), 'utf8');
            // const engineData = parseEngineData(toByteArray(psd.engineData!));
            // fs.writeFileSync(`${name}_enginedata.txt`, require('util').inspect(engineData, false, 99, false), 'utf8');
        }
    });
    it.skip('text-replace.psd', function () {
        var _a, _b;
        {
            var buffer = fs.readFileSync('text-replace2.psd');
            var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(buffer), {});
            psd.children[1].text.text = 'Foo bar';
            var output = index_1.writePsdBuffer(psd, { invalidateTextLayers: true, logMissingFeatures: true });
            fs.writeFileSync('out.psd', output);
        }
        {
            var buffer = fs.readFileSync('text-replace.psd');
            var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(buffer), {
                skipCompositeImageData: true,
                skipLayerImageData: true,
                skipThumbnail: true,
                throwForMissingFeatures: true,
                logDevFeatures: true,
            });
            delete psd.engineData;
            psd.imageResources = {};
            (_a = psd.children) === null || _a === void 0 ? void 0 : _a.splice(0, 1);
            fs.writeFileSync('input.txt', require('util').inspect(psd, false, 99, false), 'utf8');
        }
        {
            var buffer = fs.readFileSync('out.psd');
            var psd = psdReader_1.readPsd(common_1.createReaderFromBuffer(buffer), {
                skipCompositeImageData: true,
                skipLayerImageData: true,
                skipThumbnail: true,
                throwForMissingFeatures: true,
                logDevFeatures: true,
            });
            delete psd.engineData;
            psd.imageResources = {};
            (_b = psd.children) === null || _b === void 0 ? void 0 : _b.splice(0, 1);
            fs.writeFileSync('output.txt', require('util').inspect(psd, false, 99, false), 'utf8');
        }
    });
});
function clearEmptyCanvasFields(layer) {
    var _a;
    if (layer) {
        if ('canvas' in layer && !layer.canvas)
            delete layer.canvas;
        if ('imageData' in layer && !layer.imageData)
            delete layer.imageData;
        (_a = layer.children) === null || _a === void 0 ? void 0 : _a.forEach(clearEmptyCanvasFields);
    }
}
function clearCanvasFields(layer) {
    var _a;
    if (layer) {
        delete layer.canvas;
        delete layer.imageData;
        if (layer.mask)
            delete layer.mask.canvas;
        if (layer.mask)
            delete layer.mask.imageData;
        (_a = layer.children) === null || _a === void 0 ? void 0 : _a.forEach(clearCanvasFields);
    }
}
/// Engine data 2 experiments
// /test/engineData2.json:1109 is character codes
var keysColor = {
    '0': {
        uproot: true,
        children: {
            '0': { name: 'Type' },
            '1': { name: 'Values' },
        },
    },
};
var keysStyleSheet = {
    '0': { name: 'Font' },
    '1': { name: 'FontSize' },
    '2': { name: 'FauxBold' },
    '3': { name: 'FauxItalic' },
    '4': { name: 'AutoLeading' },
    '5': { name: 'Leading' },
    '6': { name: 'HorizontalScale' },
    '7': { name: 'VerticalScale' },
    '8': { name: 'Tracking' },
    '9': { name: 'BaselineShift' },
    '11': { name: 'Kerning?' },
    '12': { name: 'FontCaps' },
    '13': { name: 'FontBaseline' },
    '15': { name: 'Strikethrough?' },
    '16': { name: 'Underline?' },
    '18': { name: 'Ligatures' },
    '19': { name: 'DLigatures' },
    '23': { name: 'Fractions' },
    '24': { name: 'Ordinals' },
    '28': { name: 'StylisticAlternates' },
    '30': { name: 'OldStyle?' },
    '35': { name: 'BaselineDirection' },
    '38': { name: 'Language' },
    '52': { name: 'NoBreak' },
    '53': { name: 'FillColor', children: keysColor },
};
var keysParagraph = {
    '0': { name: 'Justification' },
    '1': { name: 'FirstLineIndent' },
    '2': { name: 'StartIndent' },
    '3': { name: 'EndIndent' },
    '4': { name: 'SpaceBefore' },
    '5': { name: 'SpaceAfter' },
    '7': { name: 'AutoLeading' },
    '9': { name: 'AutoHyphenate' },
    '10': { name: 'HyphenatedWordSize' },
    '11': { name: 'PreHyphen' },
    '12': { name: 'PostHyphen' },
    '13': { name: 'ConsecutiveHyphens?' },
    '14': { name: 'Zone' },
    '15': { name: 'HypenateCapitalizedWords' },
    '17': { name: 'WordSpacing' },
    '18': { name: 'LetterSpacing' },
    '19': { name: 'GlyphSpacing' },
    '32': { name: 'StyleSheet', children: keysStyleSheet },
};
var keysStyleSheetData = {
    name: 'StyleSheetData',
    children: keysStyleSheet,
};
var keys = {
    '0': {
        name: 'ResourceDict',
        children: {
            '1': {
                name: 'FontSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': {
                                        uproot: true,
                                        children: {
                                            '0': { name: 'Name' },
                                            '2': { name: 'FontType' },
                                        },
                                    },
                                },
                            }
                        },
                    },
                },
            },
            '2': {
                name: '2',
                children: {},
            },
            '3': {
                name: 'MojiKumiSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'InternalName' },
                                },
                            },
                        },
                    },
                },
            },
            '4': {
                name: 'KinsokuSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '5': {
                                        uproot: true,
                                        children: {
                                            '0': { name: 'NoStart' },
                                            '1': { name: 'NoEnd' },
                                            '2': { name: 'Keep' },
                                            '3': { name: 'Hanging' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '5': {
                name: 'StyleSheetSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '6': keysStyleSheetData,
                                },
                            },
                        },
                    },
                },
            },
            '6': {
                name: 'ParagraphSheetSet',
                children: {
                    '0': {
                        uproot: true,
                        children: {
                            '0': {
                                uproot: true,
                                children: {
                                    '0': { name: 'Name' },
                                    '5': {
                                        name: 'Properties',
                                        children: keysParagraph,
                                    },
                                    '6': { name: 'DefaultStyleSheet' },
                                },
                            },
                        },
                    },
                },
            },
            '8': {
                name: '8',
                children: {},
            },
            '9': {
                name: 'Predefined',
                children: {},
            },
        },
    },
    '1': {
        name: 'EngineDict',
        children: {
            '0': {
                name: '0',
                children: {
                    '0': {
                        name: '0',
                        children: {},
                    },
                    '3': { name: 'SuperscriptSize' },
                    '4': { name: 'SuperscriptPosition' },
                    '5': { name: 'SubscriptSize' },
                    '6': { name: 'SubscriptPosition' },
                    '7': { name: 'SmallCapSize' },
                    '8': { name: 'UseFractionalGlyphWidths' },
                },
            },
            '1': {
                name: 'Editors?',
                children: {
                    '0': {
                        name: 'Editor',
                        children: {
                            '0': { name: 'Text' },
                            '5': {
                                name: 'ParagraphRun',
                                children: {
                                    '0': {
                                        name: 'RunArray',
                                        children: {
                                            '0': {
                                                name: 'ParagraphSheet',
                                                children: {
                                                    '0': {
                                                        uproot: true,
                                                        children: {
                                                            '0': { name: '0' },
                                                            '5': {
                                                                name: '5',
                                                                children: keysParagraph,
                                                            },
                                                            '6': { name: '6' },
                                                        },
                                                    },
                                                },
                                            },
                                            '1': { name: 'RunLength' },
                                        },
                                    },
                                },
                            },
                            '6': {
                                name: 'StyleRun',
                                children: {
                                    '0': {
                                        name: 'RunArray',
                                        children: {
                                            '0': {
                                                name: 'StyleSheet',
                                                children: {
                                                    '0': {
                                                        uproot: true,
                                                        children: {
                                                            '6': keysStyleSheetData,
                                                        },
                                                    },
                                                },
                                            },
                                            '1': { name: 'RunLength' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    '1': {
                        name: 'FontVectorData ???',
                    },
                },
            },
            '2': {
                name: 'StyleSheet',
                children: keysStyleSheet,
            },
            '3': {
                name: 'ParagraphSheet',
                children: keysParagraph,
            },
        },
    },
};
function decodeObj(obj, keys) {
    if (obj === null || !keys)
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(function (x) { return decodeObj(x, keys); });
    }
    if (typeof obj !== 'object')
        return obj;
    var result = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        if (keys[key]) {
            if (keys[key].uproot) {
                return decodeObj(obj[key], keys[key].children);
            }
            else {
                result[keys[key].name] = decodeObj(obj[key], keys[key].children);
            }
        }
        else {
            result[key] = obj[key];
        }
    }
    return result;
}
function decodeEngineData2(data) {
    return decodeObj(data, keys);
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsR0FBRyxDQUFDLENBQUM7U0FDdkI7S0FDRDtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBUztJQUNuQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDOUIsQ0FBQyIsImZpbGUiOiJ0ZXN0L3BzZFJlYWRlci5zcGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xuaW1wb3J0IHtcblx0cmVhZFBzZEZyb21GaWxlLCBpbXBvcnRQU0QsIGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5LCBjb21wYXJlQ2FudmFzZXMsIHNhdmVDYW52YXMsXG5cdGNyZWF0ZVJlYWRlckZyb21CdWZmZXIsXG5cdGNvbXBhcmVCdWZmZXJzXG59IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IExheWVyLCBSZWFkT3B0aW9ucywgUHNkIH0gZnJvbSAnLi4vcHNkJztcbmltcG9ydCB7IHJlYWRQc2QsIHdyaXRlUHNkQnVmZmVyIH0gZnJvbSAnLi4vaW5kZXgnO1xuaW1wb3J0IHsgcmVhZFBzZCBhcyByZWFkUHNkSW50ZXJuYWwgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xuXG5jb25zdCB0ZXN0RmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Rlc3QnKTtcbmNvbnN0IHJlYWRGaWxlc1BhdGggPSBwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3JlYWQnKTtcbmNvbnN0IHJlYWRXcml0ZUZpbGVzUGF0aCA9IHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAncmVhZC13cml0ZScpO1xuY29uc3QgcmVzdWx0c0ZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXN1bHRzJyk7XG5jb25zdCBvcHRzOiBSZWFkT3B0aW9ucyA9IHtcblx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcbn07XG5cbmRlc2NyaWJlKCdQc2RSZWFkZXInLCAoKSA9PiB7XG5cdGl0KCdyZWFkcyB3aWR0aCBhbmQgaGVpZ2h0IHByb3Blcmx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2JsZW5kLW1vZGUnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMgfSk7XG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkuZXF1YWwoMzAwKTtcblx0XHRleHBlY3QocHNkLmhlaWdodCkuZXF1YWwoMjAwKTtcblx0fSk7XG5cblx0aXQoJ3NraXBzIGNvbXBvc2l0ZSBpbWFnZSBkYXRhJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2xheWVycycsICdzcmMucHNkJyksIHsgLi4ub3B0cywgc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSB9KTtcblx0XHRleHBlY3QocHNkLmNhbnZhcykubm90Lm9rO1xuXHR9KTtcblxuXHRpdCgnc2tpcHMgbGF5ZXIgaW1hZ2UgZGF0YScsICgpID0+IHtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMsIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSB9KTtcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVswXS5jYW52YXMpLm5vdC5vaztcblx0fSk7XG5cblx0aXQuc2tpcCgnY2FuIHJlYWQgYSBQU0Qgd2l0aCBsYXllciBtYXNrcyAob25seSBpZiB0aHJvdyBvbiBtaXNzaW5nIGZlYXR1cmVzIGlzIG5vdCBzZXQpJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJy4uJywgJ2xheWVyLW1hc2snLCAnc3JjLnBzZCcpKTtcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVswXS5jYW52YXMpLm9rO1xuXHR9KTtcblxuXHRpdCgncmVhZHMgUFNEIGZyb20gQnVmZmVyIHdpdGggb2Zmc2V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGUgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpKTtcblx0XHRjb25zdCBvdXRlciA9IEJ1ZmZlci5hbGxvYyhmaWxlLmJ5dGVMZW5ndGggKyAxMDApO1xuXHRcdGZpbGUuY29weShvdXRlciwgMTAwKTtcblx0XHRjb25zdCBpbm5lciA9IEJ1ZmZlci5mcm9tKG91dGVyLmJ1ZmZlciwgMTAwLCBmaWxlLmJ5dGVMZW5ndGgpO1xuXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZChpbm5lciwgb3B0cyk7XG5cblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xuXHR9KTtcblxuXHRmcy5yZWFkZGlyU3luYyhyZWFkRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm4vLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XG5cdFx0aXQoYHJlYWRzIFBTRCBmaWxlICgke2Z9KWAsICgpID0+IHtcblx0XHRcdGNvbnN0IGJhc2VQYXRoID0gcGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsIGYpO1xuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzIH0pO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBpbXBvcnRQU0QoYmFzZVBhdGgpO1xuXHRcdFx0Y29uc3QgaW1hZ2VzID0gbG9hZEltYWdlc0Zyb21EaXJlY3RvcnkoYmFzZVBhdGgpO1xuXHRcdFx0Y29uc3QgY29tcGFyZTogeyBuYW1lOiBzdHJpbmc7IGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQ7IHNraXA/OiBib29sZWFuOyB9W10gPSBbXTtcblxuXHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGNhbnZhcy5wbmdgLCBjYW52YXM6IHBzZC5jYW52YXMgfSk7XG5cdFx0XHRwc2QuY2FudmFzID0gdW5kZWZpbmVkO1xuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZURhdGE7XG5cdFx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS54bXBNZXRhZGF0YTtcblxuXHRcdFx0bGV0IGkgPSAwO1xuXG5cdFx0XHRmdW5jdGlvbiBwdXNoTGF5ZXJDYW52YXNlcyhsYXllcnM6IExheWVyW10pIHtcblx0XHRcdFx0Zm9yIChjb25zdCBsIG9mIGxheWVycykge1xuXHRcdFx0XHRcdGlmIChsLmNoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhsLmNoaWxkcmVuKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGF5ZXJJZCA9IGkrKztcblx0XHRcdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBsYXllci0ke2xheWVySWR9LnBuZ2AsIGNhbnZhczogbC5jYW52YXMgfSk7XG5cdFx0XHRcdFx0XHRsLmNhbnZhcyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdGRlbGV0ZSBsLmltYWdlRGF0YTtcblxuXHRcdFx0XHRcdFx0aWYgKGwubWFzaykge1xuXHRcdFx0XHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgbGF5ZXItJHtsYXllcklkfS1tYXNrLnBuZ2AsIGNhbnZhczogbC5tYXNrLmNhbnZhcyB9KTtcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5jYW52YXM7XG5cdFx0XHRcdFx0XHRcdGRlbGV0ZSBsLm1hc2suaW1hZ2VEYXRhO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhwc2QuY2hpbGRyZW4gfHwgW10pO1xuXHRcdFx0ZnMubWtkaXJTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXM/LnRodW1ibmFpbCkge1xuXHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiAndGh1bWIucG5nJywgY2FudmFzOiBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsLCBza2lwOiB0cnVlIH0pO1xuXHRcdFx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBzZC5pbWFnZVJlc291cmNlcykgZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWxSYXc7XG5cblx0XHRcdGNvbXBhcmUuZm9yRWFjaChpID0+IHNhdmVDYW52YXMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsIGkubmFtZSksIGkuY2FudmFzKSk7XG5cblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsICdkYXRhLmpzb24nKSwgSlNPTi5zdHJpbmdpZnkocHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcblxuXHRcdFx0Y2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhwc2QpO1xuXHRcdFx0Y2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhleHBlY3RlZCk7XG5cblx0XHRcdGV4cGVjdChwc2QpLmVxbChleHBlY3RlZCwgZik7XG5cdFx0XHRjb21wYXJlLmZvckVhY2goaSA9PiBpLnNraXAgfHwgY29tcGFyZUNhbnZhc2VzKGltYWdlc1tpLm5hbWVdLCBpLmNhbnZhcywgYCR7Zn0vJHtpLm5hbWV9YCkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRmcy5yZWFkZGlyU3luYyhyZWFkV3JpdGVGaWxlc1BhdGgpLmZvckVhY2goZiA9PiB7XG5cdFx0aXQoYHJlYWRzLXdyaXRlcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCB1c2VJbWFnZURhdGE6IHRydWUsIHVzZVJhd1RodW1ibmFpbDogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCAnZXhwZWN0ZWQucHNkJykpO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYHJlYWQtd3JpdGUtJHtmfS5wc2RgKSwgYWN0dWFsKTtcblx0XHRcdGNvbXBhcmVCdWZmZXJzKGFjdHVhbCwgZXhwZWN0ZWQsIGByZWFkLXdyaXRlLSR7Zn1gKTtcblx0XHR9KTtcblx0fSk7XG5cblx0aXQuc2tpcCgnd3JpdGUgdGV4dCBsYXllciB0ZXN0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0d2lkdGg6IDIwMCxcblx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6ICd0ZXh0IGxheWVyJyxcblx0XHRcdFx0XHR0ZXh0OiB7XG5cdFx0XHRcdFx0XHR0ZXh0OiAnSGVsbG8gV29ybGRcXG7igKIgYyDigKIgdGlueSFcXHJcXG50ZXN0Jyxcblx0XHRcdFx0XHRcdC8vIG9yaWVudGF0aW9uOiAndmVydGljYWwnLFxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiBbMSwgMCwgMCwgMSwgNzAsIDcwXSxcblx0XHRcdFx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdGZvbnQ6IHsgbmFtZTogJ0FyaWFsTVQnIH0sXG5cdFx0XHRcdFx0XHRcdGZvbnRTaXplOiAzMCxcblx0XHRcdFx0XHRcdFx0ZmlsbENvbG9yOiB7IHI6IDAsIGc6IDEyOCwgYjogMCB9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHN0eWxlUnVuczogW1xuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogMTIsIHN0eWxlOiB7IGZpbGxDb2xvcjogeyByOiAyNTUsIGc6IDAsIGI6IDAgfSB9IH0sXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiAxMiwgc3R5bGU6IHsgZmlsbENvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDI1NSB9IH0gfSxcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDQsIHN0eWxlOiB7IHVuZGVybGluZTogdHJ1ZSB9IH0sXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0cGFyYWdyYXBoU3R5bGU6IHtcblx0XHRcdFx0XHRcdFx0anVzdGlmaWNhdGlvbjogJ2NlbnRlcicsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0d2FycDoge1xuXHRcdFx0XHRcdFx0XHRzdHlsZTogJ2FyYycsXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiA1MCxcblx0XHRcdFx0XHRcdFx0cGVyc3BlY3RpdmU6IDAsXG5cdFx0XHRcdFx0XHRcdHBlcnNwZWN0aXZlT3RoZXI6IDAsXG5cdFx0XHRcdFx0XHRcdHJvdGF0ZTogJ2hvcml6b250YWwnLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZTogJzJuZCBsYXllcicsXG5cdFx0XHRcdFx0dGV4dDoge1xuXHRcdFx0XHRcdFx0dGV4dDogJ0FhYWFhJyxcblx0XHRcdFx0XHRcdHRyYW5zZm9ybTogWzEsIDAsIDAsIDEsIDcwLCA3MF0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0fTtcblxuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsICdfVEVYVDIucHNkJyksIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xuXHR9KTtcblxuXHRpdC5za2lwKCdyZWFkIHRleHQgbGF5ZXIgdGVzdCcsICgpID0+IHtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXh0LXRlc3QucHNkJyksIG9wdHMpO1xuXHRcdC8vIGNvbnN0IGxheWVyID0gcHNkLmNoaWxkcmVuIVsxXTtcblxuXHRcdC8vIGxheWVyLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCAnX1RFWFQucHNkJyksIGJ1ZmZlcik7XG5cblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzBdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5jaGlsZHJlbiFbMV0udGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLmVuZ2luZURhdGEsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHR9KTtcblxuXHRpdC5za2lwKCdSRUFEIFRFU1QnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWxCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXN0LnBzZCcpKTtcblxuXHRcdGNvbnNvbGUubG9nKCdSRUFESU5HIE9SSUdJTkFMJyk7XG5cdFx0Y29uc3Qgb3B0cyA9IHtcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0dXNlSW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXG5cdFx0fTtcblx0XHRjb25zdCBvcmlnaW5hbFBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKG9yaWdpbmFsQnVmZmVyKSwgb3B0cyk7XG5cblx0XHRjb25zb2xlLmxvZygnV1JJVElORycpO1xuXHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKG9yaWdpbmFsUHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKCd0ZW1wLnBzZCcsIGJ1ZmZlcik7XG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5iaW4nLCBidWZmZXIpO1xuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wLnhtbCcsIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzPy54bXBNZXRhZGF0YSwgJ3V0ZjgnKTtcblxuXHRcdGNvbnNvbGUubG9nKCdSRUFESU5HIFdSSVRURU4nKTtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoXG5cdFx0XHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblxuXHRcdGNsZWFyQ2FudmFzRmllbGRzKG9yaWdpbmFsUHNkKTtcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhwc2QpO1xuXHRcdGRlbGV0ZSBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsO1xuXHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbDtcblx0XHRkZWxldGUgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3Qob3JpZ2luYWxQc2QsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygnb3JpZ2luYWwuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSk7XG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygnYWZ0ZXIuanNvbicsIEpTT04uc3RyaW5naWZ5KHBzZCwgbnVsbCwgMikpO1xuXG5cdFx0Y29tcGFyZUJ1ZmZlcnMoYnVmZmVyLCBvcmlnaW5hbEJ1ZmZlciwgJ3Rlc3QnKTtcblxuXHRcdGV4cGVjdChwc2QpLmVxbChvcmlnaW5hbFBzZCk7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ2RlY29kZSBlbmdpbmUgZGF0YSAyJywgKCkgPT4ge1xuXHRcdC8vIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJWZXJ0aWNhbC50eHQnKSk7XG5cdFx0Y29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICdlbmdpbmVEYXRhMlNpbXBsZS50eHQnKSk7XG5cdFx0Y29uc3QgZnVuYyA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZmlsZURhdGF9O2ApO1xuXHRcdGNvbnN0IGRhdGEgPSBmdW5jKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gZGVjb2RlRW5naW5lRGF0YTIoZGF0YSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcblx0XHRcdHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAndGVtcC5qcycpLFxuXHRcdFx0J3ZhciB4ID0gJyArIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHJlc3VsdCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ3Rlc3QucHNkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGVzdC5wc2QnKTtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XG5cdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcblx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXG5cdFx0fSk7XG5cdFx0ZGVsZXRlIHBzZC5lbmdpbmVEYXRhO1xuXHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xuXHRcdGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ3Rlc3QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApKSwge1xuXHRcdFx0Ly8gc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdC8vIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxuXHRcdH0pO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RleHRfcmVjdF9vdXQucHNkJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGV4dF9yZWN0X291dC5iaW4nLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcblx0XHQvLyBjb25zdCBwc2QyID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApKSwge1xuXHRcdC8vIFx0Ly8gc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcblx0XHQvLyBcdC8vIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHQvLyBcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXG5cdFx0Ly8gXHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHQvLyBcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdC8vIH0pO1xuXHRcdC8vIHBzZDI7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBmcy5yZWFkRmlsZVN5bmMoYHRlc3QvcmVhZC13cml0ZS90ZXh0LWJveC9zcmMucHNkYCk7XG5cdFx0Y29uc3Qgb3V0cHV0ID0gZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApO1xuXHRcdGNvbXBhcmVCdWZmZXJzKG91dHB1dCwgb3JpZ2luYWwsICctJywgMHg2NWQ4KTsgLy8gLCAweDhjZTgsIDB4OGZjYSAtIDB4OGNlOCk7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ2NvbXBhcmUgdGVzdCcsICgpID0+IHtcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgWyd0ZXh0X3BvaW50JywgJ3RleHRfcmVjdCddKSB7XG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYCR7bmFtZX0ucHNkYCkpLCB7XG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0XHQvLyBwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX0udHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblxuXHRcdFx0Ly8gY29uc3QgZW5naW5lRGF0YSA9IHBhcnNlRW5naW5lRGF0YSh0b0J5dGVBcnJheShwc2QuZW5naW5lRGF0YSEpKTtcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX1fZW5naW5lZGF0YS50eHRgLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblx0XHR9XG5cdH0pO1xuXG5cdGl0LnNraXAoJ3RleHQtcmVwbGFjZS5wc2QnLCAoKSA9PiB7XG5cdFx0e1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCd0ZXh0LXJlcGxhY2UyLnBzZCcpO1xuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge30pO1xuXHRcdFx0cHNkLmNoaWxkcmVuIVsxXSEudGV4dCEudGV4dCA9ICdGb28gYmFyJztcblx0XHRcdGNvbnN0IG91dHB1dCA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBpbnZhbGlkYXRlVGV4dExheWVyczogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0LnBzZCcsIG91dHB1dCk7XG5cdFx0fVxuXG5cdFx0e1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCd0ZXh0LXJlcGxhY2UucHNkJyk7XG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XG5cdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnaW5wdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ291dC5wc2QnKTtcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXG5cdFx0XHR9KTtcblx0XHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcblx0XHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xuXHRcdFx0cHNkLmNoaWxkcmVuPy5zcGxpY2UoMCwgMSk7XG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXRwdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcblx0XHR9XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIGNsZWFyRW1wdHlDYW52YXNGaWVsZHMobGF5ZXI6IExheWVyIHwgdW5kZWZpbmVkKSB7XG5cdGlmIChsYXllcikge1xuXHRcdGlmICgnY2FudmFzJyBpbiBsYXllciAmJiAhbGF5ZXIuY2FudmFzKSBkZWxldGUgbGF5ZXIuY2FudmFzO1xuXHRcdGlmICgnaW1hZ2VEYXRhJyBpbiBsYXllciAmJiAhbGF5ZXIuaW1hZ2VEYXRhKSBkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xuXHRcdGxheWVyLmNoaWxkcmVuPy5mb3JFYWNoKGNsZWFyRW1wdHlDYW52YXNGaWVsZHMpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNsZWFyQ2FudmFzRmllbGRzKGxheWVyOiBMYXllciB8IHVuZGVmaW5lZCkge1xuXHRpZiAobGF5ZXIpIHtcblx0XHRkZWxldGUgbGF5ZXIuY2FudmFzO1xuXHRcdGRlbGV0ZSBsYXllci5pbWFnZURhdGE7XG5cdFx0aWYgKGxheWVyLm1hc2spIGRlbGV0ZSBsYXllci5tYXNrLmNhbnZhcztcblx0XHRpZiAobGF5ZXIubWFzaykgZGVsZXRlIGxheWVyLm1hc2suaW1hZ2VEYXRhO1xuXHRcdGxheWVyLmNoaWxkcmVuPy5mb3JFYWNoKGNsZWFyQ2FudmFzRmllbGRzKTtcblx0fVxufVxuXG4vLy8gRW5naW5lIGRhdGEgMiBleHBlcmltZW50c1xuLy8gL3Rlc3QvZW5naW5lRGF0YTIuanNvbjoxMTA5IGlzIGNoYXJhY3RlciBjb2Rlc1xuXG5jb25zdCBrZXlzQ29sb3IgPSB7XG5cdCcwJzoge1xuXHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRjaGlsZHJlbjoge1xuXHRcdFx0JzAnOiB7IG5hbWU6ICdUeXBlJyB9LFxuXHRcdFx0JzEnOiB7IG5hbWU6ICdWYWx1ZXMnIH0sXG5cdFx0fSxcblx0fSxcbn07XG5cbmNvbnN0IGtleXNTdHlsZVNoZWV0ID0ge1xuXHQnMCc6IHsgbmFtZTogJ0ZvbnQnIH0sXG5cdCcxJzogeyBuYW1lOiAnRm9udFNpemUnIH0sXG5cdCcyJzogeyBuYW1lOiAnRmF1eEJvbGQnIH0sXG5cdCczJzogeyBuYW1lOiAnRmF1eEl0YWxpYycgfSxcblx0JzQnOiB7IG5hbWU6ICdBdXRvTGVhZGluZycgfSxcblx0JzUnOiB7IG5hbWU6ICdMZWFkaW5nJyB9LFxuXHQnNic6IHsgbmFtZTogJ0hvcml6b250YWxTY2FsZScgfSxcblx0JzcnOiB7IG5hbWU6ICdWZXJ0aWNhbFNjYWxlJyB9LFxuXHQnOCc6IHsgbmFtZTogJ1RyYWNraW5nJyB9LFxuXHQnOSc6IHsgbmFtZTogJ0Jhc2VsaW5lU2hpZnQnIH0sXG5cblx0JzExJzogeyBuYW1lOiAnS2VybmluZz8nIH0sIC8vIGRpZmZlcmVudCB2YWx1ZSB0aGFuIEVuZ2luZURhdGFcblx0JzEyJzogeyBuYW1lOiAnRm9udENhcHMnIH0sXG5cdCcxMyc6IHsgbmFtZTogJ0ZvbnRCYXNlbGluZScgfSxcblxuXHQnMTUnOiB7IG5hbWU6ICdTdHJpa2V0aHJvdWdoPycgfSwgLy8gbnVtYmVyIGluc3RlYWQgb2YgYm9vbFxuXHQnMTYnOiB7IG5hbWU6ICdVbmRlcmxpbmU/JyB9LCAvLyBudW1iZXIgaW5zdGVhZCBvZiBib29sXG5cblx0JzE4JzogeyBuYW1lOiAnTGlnYXR1cmVzJyB9LFxuXHQnMTknOiB7IG5hbWU6ICdETGlnYXR1cmVzJyB9LFxuXG5cdCcyMyc6IHsgbmFtZTogJ0ZyYWN0aW9ucycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxuXHQnMjQnOiB7IG5hbWU6ICdPcmRpbmFscycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxuXG5cdCcyOCc6IHsgbmFtZTogJ1N0eWxpc3RpY0FsdGVybmF0ZXMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcblxuXHQnMzAnOiB7IG5hbWU6ICdPbGRTdHlsZT8nIH0sIC8vIE9wZW5UeXBlID4gT2xkU3R5bGUsIG51bWJlciBpbnN0ZWFkIG9mIGJvb2wsIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcblxuXHQnMzUnOiB7IG5hbWU6ICdCYXNlbGluZURpcmVjdGlvbicgfSxcblxuXHQnMzgnOiB7IG5hbWU6ICdMYW5ndWFnZScgfSxcblxuXHQnNTInOiB7IG5hbWU6ICdOb0JyZWFrJyB9LFxuXHQnNTMnOiB7IG5hbWU6ICdGaWxsQ29sb3InLCBjaGlsZHJlbjoga2V5c0NvbG9yIH0sXG59O1xuXG5jb25zdCBrZXlzUGFyYWdyYXBoID0ge1xuXHQnMCc6IHsgbmFtZTogJ0p1c3RpZmljYXRpb24nIH0sXG5cdCcxJzogeyBuYW1lOiAnRmlyc3RMaW5lSW5kZW50JyB9LFxuXHQnMic6IHsgbmFtZTogJ1N0YXJ0SW5kZW50JyB9LFxuXHQnMyc6IHsgbmFtZTogJ0VuZEluZGVudCcgfSxcblx0JzQnOiB7IG5hbWU6ICdTcGFjZUJlZm9yZScgfSxcblx0JzUnOiB7IG5hbWU6ICdTcGFjZUFmdGVyJyB9LFxuXG5cdCc3JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXG5cblx0JzknOiB7IG5hbWU6ICdBdXRvSHlwaGVuYXRlJyB9LFxuXHQnMTAnOiB7IG5hbWU6ICdIeXBoZW5hdGVkV29yZFNpemUnIH0sXG5cdCcxMSc6IHsgbmFtZTogJ1ByZUh5cGhlbicgfSxcblx0JzEyJzogeyBuYW1lOiAnUG9zdEh5cGhlbicgfSxcblx0JzEzJzogeyBuYW1lOiAnQ29uc2VjdXRpdmVIeXBoZW5zPycgfSwgLy8gZGlmZmVyZW50IHZhbHVlIHRoYW4gRW5naW5lRGF0YVxuXHQnMTQnOiB7IG5hbWU6ICdab25lJyB9LFxuXHQnMTUnOiB7IG5hbWU6ICdIeXBlbmF0ZUNhcGl0YWxpemVkV29yZHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcblxuXHQnMTcnOiB7IG5hbWU6ICdXb3JkU3BhY2luZycgfSxcblx0JzE4JzogeyBuYW1lOiAnTGV0dGVyU3BhY2luZycgfSxcblx0JzE5JzogeyBuYW1lOiAnR2x5cGhTcGFjaW5nJyB9LFxuXG5cdCczMic6IHsgbmFtZTogJ1N0eWxlU2hlZXQnLCBjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQgfSxcbn07XG5cbmNvbnN0IGtleXNTdHlsZVNoZWV0RGF0YSA9IHtcblx0bmFtZTogJ1N0eWxlU2hlZXREYXRhJyxcblx0Y2hpbGRyZW46IGtleXNTdHlsZVNoZWV0LFxufTtcblxuY29uc3Qga2V5cyA9IHtcblx0JzAnOiB7XG5cdFx0bmFtZTogJ1Jlc291cmNlRGljdCcsXG5cdFx0Y2hpbGRyZW46IHtcblx0XHRcdCcxJzoge1xuXHRcdFx0XHRuYW1lOiAnRm9udFNldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcyJzogeyBuYW1lOiAnRm9udFR5cGUnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHQnMic6IHtcblx0XHRcdFx0bmFtZTogJzInLFxuXHRcdFx0XHRjaGlsZHJlbjoge30sXG5cdFx0XHR9LFxuXHRcdFx0JzMnOiB7XG5cdFx0XHRcdG5hbWU6ICdNb2ppS3VtaVNldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnSW50ZXJuYWxOYW1lJyB9LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzQnOiB7XG5cdFx0XHRcdG5hbWU6ICdLaW5zb2t1U2V0Jyxcblx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05vU3RhcnQnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdOb0VuZCcgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMic6IHsgbmFtZTogJ0tlZXAnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzMnOiB7IG5hbWU6ICdIYW5naW5nJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdCc1Jzoge1xuXHRcdFx0XHRuYW1lOiAnU3R5bGVTaGVldFNldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcblx0XHRcdFx0XHRcdFx0XHRcdCc2Jzoga2V5c1N0eWxlU2hlZXREYXRhLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzYnOiB7XG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldFNldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcblx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUHJvcGVydGllcycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnRGVmYXVsdFN0eWxlU2hlZXQnIH0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHQnOCc6IHtcblx0XHRcdFx0bmFtZTogJzgnLFxuXHRcdFx0XHRjaGlsZHJlbjoge30sXG5cdFx0XHR9LFxuXHRcdFx0JzknOiB7XG5cdFx0XHRcdG5hbWU6ICdQcmVkZWZpbmVkJyxcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxuXHRcdFx0fSxcblx0XHR9LFxuXHR9LFxuXHQnMSc6IHtcblx0XHRuYW1lOiAnRW5naW5lRGljdCcsXG5cdFx0Y2hpbGRyZW46IHtcblx0XHRcdCcwJzoge1xuXHRcdFx0XHRuYW1lOiAnMCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRuYW1lOiAnMCcsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCczJzogeyBuYW1lOiAnU3VwZXJzY3JpcHRTaXplJyB9LFxuXHRcdFx0XHRcdCc0JzogeyBuYW1lOiAnU3VwZXJzY3JpcHRQb3NpdGlvbicgfSxcblx0XHRcdFx0XHQnNSc6IHsgbmFtZTogJ1N1YnNjcmlwdFNpemUnIH0sXG5cdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICdTdWJzY3JpcHRQb3NpdGlvbicgfSxcblx0XHRcdFx0XHQnNyc6IHsgbmFtZTogJ1NtYWxsQ2FwU2l6ZScgfSxcblx0XHRcdFx0XHQnOCc6IHsgbmFtZTogJ1VzZUZyYWN0aW9uYWxHbHlwaFdpZHRocycgfSwgLy8gPz8/XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzEnOiB7XG5cdFx0XHRcdG5hbWU6ICdFZGl0b3JzPycsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRuYW1lOiAnRWRpdG9yJyxcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnVGV4dCcgfSxcblx0XHRcdFx0XHRcdFx0JzUnOiB7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFJ1bicsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICcwJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICc1Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICc2JyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdSdW5MZW5ndGgnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCc2Jzoge1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdTdHlsZVJ1bicsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnUnVuTGVuZ3RoJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCcxJzoge1xuXHRcdFx0XHRcdFx0bmFtZTogJ0ZvbnRWZWN0b3JEYXRhID8/PycsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHQnMic6IHtcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQsXG5cdFx0XHR9LFxuXHRcdFx0JzMnOiB7XG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxuXHRcdFx0fSxcblx0XHR9LFxuXHR9LFxufTtcblxuZnVuY3Rpb24gZGVjb2RlT2JqKG9iajogYW55LCBrZXlzOiBhbnkpOiBhbnkge1xuXHRpZiAob2JqID09PSBudWxsIHx8ICFrZXlzKSByZXR1cm4gb2JqO1xuXG5cdGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcblx0XHRyZXR1cm4gb2JqLm1hcCh4ID0+IGRlY29kZU9iaih4LCBrZXlzKSk7XG5cdH1cblxuXHRpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHJldHVybiBvYmo7XG5cblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuXHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XG5cdFx0aWYgKGtleXNba2V5XSkge1xuXHRcdFx0aWYgKGtleXNba2V5XS51cHJvb3QpIHtcblx0XHRcdFx0cmV0dXJuIGRlY29kZU9iaihvYmpba2V5XSwga2V5c1trZXldLmNoaWxkcmVuKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdFtrZXlzW2tleV0ubmFtZV0gPSBkZWNvZGVPYmoob2JqW2tleV0sIGtleXNba2V5XS5jaGlsZHJlbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdFtrZXldID0gb2JqW2tleV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZGVjb2RlRW5naW5lRGF0YTIoZGF0YTogYW55KSB7XG5cdHJldHVybiBkZWNvZGVPYmooZGF0YSwga2V5cyk7XG59XG4iXSwic291cmNlUm9vdCI6Ii9Vc2Vycy9qb2VyYWlpL2Rldi9hZy1wc2Qvc3JjIn0=
