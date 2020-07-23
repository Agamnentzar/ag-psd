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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvcHNkUmVhZGVyLnNwZWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxxQ0FBeUI7QUFDekIseUNBQTZCO0FBQzdCLDZCQUE4QjtBQUM5QixtQ0FJa0I7QUFFbEIsa0NBQW1EO0FBQ25ELDBDQUEwRDtBQUUxRCxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQy9ELElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZELElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDbEUsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3JFLElBQU0sSUFBSSxHQUFnQjtJQUN6Qix1QkFBdUIsRUFBRSxJQUFJO0lBQzdCLGtCQUFrQixFQUFFLElBQUk7Q0FDeEIsQ0FBQztBQUVGLFFBQVEsQ0FBQyxXQUFXLEVBQUU7SUFDckIsRUFBRSxDQUFDLGlDQUFpQyxFQUFFO1FBQ3JDLElBQU0sR0FBRyxHQUFHLHdCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxlQUFPLElBQUksRUFBRyxDQUFDO1FBQzVGLGFBQU0sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLGFBQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9CLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLDRCQUE0QixFQUFFO1FBQ2hDLElBQU0sR0FBRyxHQUFHLHdCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyx3QkFBTyxJQUFJLEtBQUUsc0JBQXNCLEVBQUUsSUFBSSxJQUFHLENBQUM7UUFDdEgsYUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQzNCLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLHdCQUF3QixFQUFFO1FBQzVCLElBQU0sR0FBRyxHQUFHLHdCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyx3QkFBTyxJQUFJLEtBQUUsa0JBQWtCLEVBQUUsSUFBSSxJQUFHLENBQUM7UUFDbEgsYUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUN4QyxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0ZBQWdGLEVBQUU7UUFDekYsSUFBTSxHQUFHLEdBQUcsd0JBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDckYsYUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ3BDLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLG1DQUFtQyxFQUFFO1FBQ3ZDLElBQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDNUUsSUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRTlELElBQU0sR0FBRyxHQUFHLGVBQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFakMsYUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBbEIsQ0FBa0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUM7UUFDdEUsRUFBRSxDQUFDLHFCQUFtQixDQUFDLE1BQUcsRUFBRTs7WUFDM0IsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0MsSUFBTSxHQUFHLEdBQUcsd0JBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsZUFBTyxJQUFJLEVBQUcsQ0FBQztZQUN6RSxJQUFNLFFBQVEsR0FBRyxrQkFBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3JDLElBQU0sTUFBTSxHQUFHLGdDQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pELElBQU0sT0FBTyxHQUErRSxFQUFFLENBQUM7WUFFL0YsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1lBQ3pELEdBQUcsQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO1lBQ3ZCLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUNyQixPQUFPLEdBQUcsQ0FBQyxjQUFlLENBQUMsV0FBVyxDQUFDO1lBRXZDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUVWLFNBQVMsaUJBQWlCLENBQUMsTUFBZTtnQkFDekMsS0FBZ0IsVUFBTSxFQUFOLGlCQUFNLEVBQU4sb0JBQU0sRUFBTixJQUFNLEVBQUU7b0JBQW5CLElBQU0sQ0FBQyxlQUFBO29CQUNYLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRTt3QkFDZixpQkFBaUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7cUJBQzlCO3lCQUFNO3dCQUNOLElBQU0sT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDO3dCQUNwQixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFdBQVMsT0FBTyxTQUFNLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO3dCQUNqRSxDQUFDLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQzt3QkFDckIsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUVuQixJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUU7NEJBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFTLE9BQU8sY0FBVyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7NEJBQzNFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7NEJBQ3JCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7eUJBQ3hCO3FCQUNEO2lCQUNEO1lBQ0YsQ0FBQztZQUVELGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUM7WUFDdEMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFFbEUsVUFBSSxHQUFHLENBQUMsY0FBYywwQ0FBRSxTQUFTLEVBQUU7Z0JBQ2xDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDdEYsT0FBTyxHQUFHLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQzthQUNwQztZQUVELElBQUksR0FBRyxDQUFDLGNBQWM7Z0JBQUUsT0FBTyxHQUFHLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQztZQUUvRCxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsbUJBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUE1RCxDQUE0RCxDQUFDLENBQUM7WUFFbkYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFBRSxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFFcEcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDNUIsc0JBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFakMsYUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0IsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsQ0FBQyxJQUFJLElBQUksd0JBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUssQ0FBQyxTQUFJLENBQUMsQ0FBQyxJQUFNLENBQUMsRUFBckUsQ0FBcUUsQ0FBQyxDQUFDO1FBQzdGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsQ0FBQztRQUMzQyxFQUFFLENBQUMsNEJBQTBCLENBQUMsTUFBRyxFQUFFO1lBQ2xDLElBQU0sR0FBRyxHQUFHLHdCQUFlLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLEVBQUUsU0FBUyxDQUFDLHdCQUFPLElBQUksS0FBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLElBQUcsQ0FBQztZQUNqSSxJQUFNLE1BQU0sR0FBRyxzQkFBYyxDQUFDLEdBQUcsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDakUsSUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ25GLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxnQkFBYyxDQUFDLFNBQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzdFLHVCQUFjLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxnQkFBYyxDQUFHLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtRQUNoQyxJQUFNLEdBQUcsR0FBUTtZQUNoQixLQUFLLEVBQUUsR0FBRztZQUNWLE1BQU0sRUFBRSxHQUFHO1lBQ1gsUUFBUSxFQUFFO2dCQUNUO29CQUNDLElBQUksRUFBRSxZQUFZO29CQUNsQixJQUFJLEVBQUU7d0JBQ0wsSUFBSSxFQUFFLGtDQUFrQzt3QkFDeEMsMkJBQTJCO3dCQUMzQixTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQzt3QkFDL0IsS0FBSyxFQUFFOzRCQUNOLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7NEJBQ3pCLFFBQVEsRUFBRSxFQUFFOzRCQUNaLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFO3lCQUNqQzt3QkFDRCxTQUFTLEVBQUU7NEJBQ1YsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRTs0QkFDNUQsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTs0QkFDNUQsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBRTt5QkFDekM7d0JBQ0QsY0FBYyxFQUFFOzRCQUNmLGFBQWEsRUFBRSxRQUFRO3lCQUN2Qjt3QkFDRCxJQUFJLEVBQUU7NEJBQ0wsS0FBSyxFQUFFLEtBQUs7NEJBQ1osS0FBSyxFQUFFLEVBQUU7NEJBQ1QsV0FBVyxFQUFFLENBQUM7NEJBQ2QsZ0JBQWdCLEVBQUUsQ0FBQzs0QkFDbkIsTUFBTSxFQUFFLFlBQVk7eUJBQ3BCO3FCQUNEO2lCQUNEO2dCQUNEO29CQUNDLElBQUksRUFBRSxXQUFXO29CQUNqQixJQUFJLEVBQUU7d0JBQ0wsSUFBSSxFQUFFLE9BQU87d0JBQ2IsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7cUJBQy9CO2lCQUNEO2FBQ0Q7U0FDRCxDQUFDO1FBRUYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxFQUFFLHNCQUFjLENBQUMsR0FBRyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2hILENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtRQUMvQixJQUFNLEdBQUcsR0FBRyx3QkFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLGVBQWUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzdFLGtDQUFrQztRQUVsQyxnQ0FBZ0M7UUFDaEMsSUFBTSxNQUFNLEdBQUcsc0JBQWMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUVuRSxnRkFBZ0Y7UUFDaEYsZ0ZBQWdGO1FBQ2hGLHlFQUF5RTtJQUMxRSxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ3BCLElBQU0sY0FBYyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztRQUU3RSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDaEMsSUFBTSxJQUFJLEdBQUc7WUFDWixrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsWUFBWSxFQUFFLElBQUk7WUFDbEIsZUFBZSxFQUFFLElBQUk7WUFDckIsY0FBYyxFQUFFLElBQUk7U0FDcEIsQ0FBQztRQUNGLElBQU0sV0FBVyxHQUFHLG1CQUFlLENBQUMsK0JBQXNCLENBQUMsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFbEYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN2QixJQUFNLE1BQU0sR0FBRyxzQkFBYyxDQUFDLFdBQVcsRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDekUsRUFBRSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDckMsd0NBQXdDO1FBQ3hDLCtFQUErRTtRQUMvRSxpRkFBaUY7UUFFakYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQy9CLElBQU0sR0FBRyxHQUFHLG1CQUFlLENBQzFCLCtCQUFzQixDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFFOUYsaUJBQWlCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0IsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkIsT0FBTyxXQUFXLENBQUMsY0FBZSxDQUFDLFNBQVMsQ0FBQztRQUM3QyxPQUFPLEdBQUcsQ0FBQyxjQUFlLENBQUMsU0FBUyxDQUFDO1FBQ3JDLE9BQU8sV0FBVyxDQUFDLGNBQWUsQ0FBQyxZQUFZLENBQUM7UUFDaEQsT0FBTyxHQUFHLENBQUMsY0FBZSxDQUFDLFlBQVksQ0FBQztRQUN4QyxzRUFBc0U7UUFFdEUsMkVBQTJFO1FBQzNFLGdFQUFnRTtRQUVoRSx1QkFBYyxDQUFDLE1BQU0sRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFL0MsYUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUU7UUFDL0IsOEdBQThHO1FBQzlHLElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO1FBQ3pHLElBQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLFlBQVUsUUFBUSxNQUFHLENBQUMsQ0FBQztRQUNqRCxJQUFNLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQztRQUNwQixJQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxFQUFFLENBQUMsYUFBYSxDQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxFQUN4RCxVQUFVLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMxRSxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1FBQ25CLElBQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsSUFBTSxHQUFHLEdBQUcsbUJBQWUsQ0FBQywrQkFBc0IsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMzRCxzQkFBc0IsRUFBRSxJQUFJO1lBQzVCLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsYUFBYSxFQUFFLElBQUk7WUFDbkIsdUJBQXVCLEVBQUUsSUFBSTtZQUM3QixjQUFjLEVBQUUsSUFBSTtTQUNwQixDQUFDLENBQUM7UUFDSCxPQUFPLEdBQUcsQ0FBQyxVQUFVLENBQUM7UUFDdEIsR0FBRyxDQUFDLGNBQWMsR0FBRyxFQUFFLENBQUM7UUFDeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtRQUNmLElBQU0sR0FBRyxHQUFHLG1CQUFlLENBQUMsK0JBQXNCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDLEVBQUU7WUFDeEcsZ0NBQWdDO1lBQ2hDLDRCQUE0QjtZQUM1Qix1QkFBdUI7WUFDdkIsdUJBQXVCLEVBQUUsSUFBSTtZQUM3QixjQUFjLEVBQUUsSUFBSTtZQUNwQixlQUFlLEVBQUUsSUFBSTtTQUNyQixDQUFDLENBQUM7UUFDSCxFQUFFLENBQUMsYUFBYSxDQUFDLG1CQUFtQixFQUFFLHNCQUFjLENBQUMsR0FBRyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLEVBQUUsQ0FBQyxhQUFhLENBQUMsbUJBQW1CLEVBQUUsc0JBQWMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekYsK0ZBQStGO1FBQy9GLG9DQUFvQztRQUNwQyxnQ0FBZ0M7UUFDaEMsMkJBQTJCO1FBQzNCLGtDQUFrQztRQUNsQyx5QkFBeUI7UUFDekIsTUFBTTtRQUNOLFFBQVE7UUFDUixJQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDckUsSUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BELHVCQUFjLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyw4QkFBOEI7SUFDOUUsQ0FBQyxDQUFDLENBQUM7SUFFSCxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtRQUN2QixLQUFtQixVQUEyQixFQUEzQixNQUFDLFlBQVksRUFBRSxXQUFXLENBQUMsRUFBM0IsY0FBMkIsRUFBM0IsSUFBMkIsRUFBRTtZQUEzQyxJQUFNLE1BQUksU0FBQTtZQUNkLElBQU0sR0FBRyxHQUFHLG1CQUFlLENBQUMsK0JBQXNCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBSSxNQUFJLFNBQU0sQ0FBQyxDQUFDLEVBQUU7Z0JBQ25GLHNCQUFzQixFQUFFLElBQUk7Z0JBQzVCLGtCQUFrQixFQUFFLElBQUk7Z0JBQ3hCLGFBQWEsRUFBRSxJQUFJO2dCQUNuQix1QkFBdUIsRUFBRSxJQUFJO2dCQUM3QixjQUFjLEVBQUUsSUFBSTthQUNwQixDQUFDLENBQUM7WUFDSCwyQkFBMkI7WUFDM0IsRUFBRSxDQUFDLGFBQWEsQ0FBSSxNQUFJLFNBQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBRXhGLG9FQUFvRTtZQUNwRSw2R0FBNkc7U0FDN0c7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7O1FBQzNCO1lBQ0MsSUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3BELElBQU0sR0FBRyxHQUFHLG1CQUFlLENBQUMsK0JBQXNCLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDaEUsR0FBRyxDQUFDLFFBQVMsQ0FBQyxDQUFDLENBQUUsQ0FBQyxJQUFLLENBQUMsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUN6QyxJQUFNLE1BQU0sR0FBRyxzQkFBYyxDQUFDLEdBQUcsRUFBRSxFQUFFLG9CQUFvQixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzdGLEVBQUUsQ0FBQyxhQUFhLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ3BDO1FBRUQ7WUFDQyxJQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLENBQUM7WUFDbkQsSUFBTSxHQUFHLEdBQUcsbUJBQWUsQ0FBQywrQkFBc0IsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDM0Qsc0JBQXNCLEVBQUUsSUFBSTtnQkFDNUIsa0JBQWtCLEVBQUUsSUFBSTtnQkFDeEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLHVCQUF1QixFQUFFLElBQUk7Z0JBQzdCLGNBQWMsRUFBRSxJQUFJO2FBQ3BCLENBQUMsQ0FBQztZQUNILE9BQU8sR0FBRyxDQUFDLFVBQVUsQ0FBQztZQUN0QixHQUFHLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4QixNQUFBLEdBQUcsQ0FBQyxRQUFRLDBDQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDdEY7UUFFRDtZQUNDLElBQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDMUMsSUFBTSxHQUFHLEdBQUcsbUJBQWUsQ0FBQywrQkFBc0IsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDM0Qsc0JBQXNCLEVBQUUsSUFBSTtnQkFDNUIsa0JBQWtCLEVBQUUsSUFBSTtnQkFDeEIsYUFBYSxFQUFFLElBQUk7Z0JBQ25CLHVCQUF1QixFQUFFLElBQUk7Z0JBQzdCLGNBQWMsRUFBRSxJQUFJO2FBQ3BCLENBQUMsQ0FBQztZQUNILE9BQU8sR0FBRyxDQUFDLFVBQVUsQ0FBQztZQUN0QixHQUFHLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4QixNQUFBLEdBQUcsQ0FBQyxRQUFRLDBDQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQzNCLEVBQUUsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDdkY7SUFDRixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxzQkFBc0IsQ0FBQyxLQUF3Qjs7SUFDdkQsSUFBSSxLQUFLLEVBQUU7UUFDVixJQUFJLFFBQVEsSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTTtZQUFFLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUM1RCxJQUFJLFdBQVcsSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUztZQUFFLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQztRQUNyRSxNQUFBLEtBQUssQ0FBQyxRQUFRLDBDQUFFLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRTtLQUNoRDtBQUNGLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEtBQXdCOztJQUNsRCxJQUFJLEtBQUssRUFBRTtRQUNWLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUNwQixPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFDdkIsSUFBSSxLQUFLLENBQUMsSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDekMsSUFBSSxLQUFLLENBQUMsSUFBSTtZQUFFLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDNUMsTUFBQSxLQUFLLENBQUMsUUFBUSwwQ0FBRSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7S0FDM0M7QUFDRixDQUFDO0FBRUQsNkJBQTZCO0FBQzdCLGlEQUFpRDtBQUVqRCxJQUFNLFNBQVMsR0FBRztJQUNqQixHQUFHLEVBQUU7UUFDSixNQUFNLEVBQUUsSUFBSTtRQUNaLFFBQVEsRUFBRTtZQUNULEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7WUFDckIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtTQUN2QjtLQUNEO0NBQ0QsQ0FBQztBQUVGLElBQU0sY0FBYyxHQUFHO0lBQ3RCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7SUFDckIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRTtJQUN6QixHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFO0lBQ3pCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7SUFDM0IsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRTtJQUM1QixHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0lBQ3hCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRTtJQUNoQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFO0lBQzlCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7SUFDekIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRTtJQUU5QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFO0lBQzFCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRTtJQUU5QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7SUFDaEMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRTtJQUU1QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFO0lBQzNCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUU7SUFFNUIsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFO0lBRTFCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxxQkFBcUIsRUFBRTtJQUVyQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFO0lBRTNCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRTtJQUVuQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFO0lBRTFCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7SUFDekIsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFO0NBQ2hELENBQUM7QUFFRixJQUFNLGFBQWEsR0FBRztJQUNyQixHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFO0lBQzlCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRTtJQUNoQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFO0lBQzVCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUU7SUFDMUIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRTtJQUM1QixHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO0lBRTNCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUU7SUFFNUIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRTtJQUM5QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7SUFDcEMsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFO0lBQzVCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxxQkFBcUIsRUFBRTtJQUNyQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO0lBQ3RCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSwwQkFBMEIsRUFBRTtJQUUxQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFO0lBQzdCLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUU7SUFDL0IsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRTtJQUU5QixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUU7Q0FDdEQsQ0FBQztBQUVGLElBQU0sa0JBQWtCLEdBQUc7SUFDMUIsSUFBSSxFQUFFLGdCQUFnQjtJQUN0QixRQUFRLEVBQUUsY0FBYztDQUN4QixDQUFDO0FBRUYsSUFBTSxJQUFJLEdBQUc7SUFDWixHQUFHLEVBQUU7UUFDSixJQUFJLEVBQUUsY0FBYztRQUNwQixRQUFRLEVBQUU7WUFDVCxHQUFHLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsUUFBUSxFQUFFO29CQUNULEdBQUcsRUFBRTt3QkFDSixNQUFNLEVBQUUsSUFBSTt3QkFDWixRQUFRLEVBQUU7NEJBQ1QsR0FBRyxFQUFFO2dDQUNKLE1BQU0sRUFBRSxJQUFJO2dDQUNaLFFBQVEsRUFBRTtvQ0FDVCxHQUFHLEVBQUU7d0NBQ0osTUFBTSxFQUFFLElBQUk7d0NBQ1osUUFBUSxFQUFFOzRDQUNULEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7NENBQ3JCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7eUNBQ3pCO3FDQUNEO2lDQUNEOzZCQUNEO3lCQUNEO3FCQUNEO2lCQUNEO2FBQ0Q7WUFDRCxHQUFHLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsUUFBUSxFQUFFLEVBQUU7YUFDWjtZQUNELEdBQUcsRUFBRTtnQkFDSixJQUFJLEVBQUUsYUFBYTtnQkFDbkIsUUFBUSxFQUFFO29CQUNULEdBQUcsRUFBRTt3QkFDSixNQUFNLEVBQUUsSUFBSTt3QkFDWixRQUFRLEVBQUU7NEJBQ1QsR0FBRyxFQUFFO2dDQUNKLE1BQU0sRUFBRSxJQUFJO2dDQUNaLFFBQVEsRUFBRTtvQ0FDVCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFO2lDQUM3Qjs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRDthQUNEO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxZQUFZO2dCQUNsQixRQUFRLEVBQUU7b0JBQ1QsR0FBRyxFQUFFO3dCQUNKLE1BQU0sRUFBRSxJQUFJO3dCQUNaLFFBQVEsRUFBRTs0QkFDVCxHQUFHLEVBQUU7Z0NBQ0osTUFBTSxFQUFFLElBQUk7Z0NBQ1osUUFBUSxFQUFFO29DQUNULEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUU7b0NBQ3JCLEdBQUcsRUFBRTt3Q0FDSixNQUFNLEVBQUUsSUFBSTt3Q0FDWixRQUFRLEVBQUU7NENBQ1QsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTs0Q0FDeEIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTs0Q0FDdEIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRTs0Q0FDckIsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTt5Q0FDeEI7cUNBQ0Q7aUNBQ0Q7NkJBQ0Q7eUJBQ0Q7cUJBQ0Q7aUJBQ0Q7YUFDRDtZQUNELEdBQUcsRUFBRTtnQkFDSixJQUFJLEVBQUUsZUFBZTtnQkFDckIsUUFBUSxFQUFFO29CQUNULEdBQUcsRUFBRTt3QkFDSixNQUFNLEVBQUUsSUFBSTt3QkFDWixRQUFRLEVBQUU7NEJBQ1QsR0FBRyxFQUFFO2dDQUNKLE1BQU0sRUFBRSxJQUFJO2dDQUNaLFFBQVEsRUFBRTtvQ0FDVCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO29DQUNyQixHQUFHLEVBQUUsa0JBQWtCO2lDQUN2Qjs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRDthQUNEO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxtQkFBbUI7Z0JBQ3pCLFFBQVEsRUFBRTtvQkFDVCxHQUFHLEVBQUU7d0JBQ0osTUFBTSxFQUFFLElBQUk7d0JBQ1osUUFBUSxFQUFFOzRCQUNULEdBQUcsRUFBRTtnQ0FDSixNQUFNLEVBQUUsSUFBSTtnQ0FDWixRQUFRLEVBQUU7b0NBQ1QsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRTtvQ0FDckIsR0FBRyxFQUFFO3dDQUNKLElBQUksRUFBRSxZQUFZO3dDQUNsQixRQUFRLEVBQUUsYUFBYTtxQ0FDdkI7b0NBQ0QsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFFO2lDQUNsQzs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRDthQUNEO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxHQUFHO2dCQUNULFFBQVEsRUFBRSxFQUFFO2FBQ1o7WUFDRCxHQUFHLEVBQUU7Z0JBQ0osSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLFFBQVEsRUFBRSxFQUFFO2FBQ1o7U0FDRDtLQUNEO0lBQ0QsR0FBRyxFQUFFO1FBQ0osSUFBSSxFQUFFLFlBQVk7UUFDbEIsUUFBUSxFQUFFO1lBQ1QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxHQUFHO2dCQUNULFFBQVEsRUFBRTtvQkFDVCxHQUFHLEVBQUU7d0JBQ0osSUFBSSxFQUFFLEdBQUc7d0JBQ1QsUUFBUSxFQUFFLEVBQ1Q7cUJBQ0Q7b0JBQ0QsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFO29CQUNoQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUU7b0JBQ3BDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUU7b0JBQzlCLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRTtvQkFDbEMsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRTtvQkFDN0IsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLDBCQUEwQixFQUFFO2lCQUN6QzthQUNEO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxVQUFVO2dCQUNoQixRQUFRLEVBQUU7b0JBQ1QsR0FBRyxFQUFFO3dCQUNKLElBQUksRUFBRSxRQUFRO3dCQUNkLFFBQVEsRUFBRTs0QkFDVCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFOzRCQUNyQixHQUFHLEVBQUU7Z0NBQ0osSUFBSSxFQUFFLGNBQWM7Z0NBQ3BCLFFBQVEsRUFBRTtvQ0FDVCxHQUFHLEVBQUU7d0NBQ0osSUFBSSxFQUFFLFVBQVU7d0NBQ2hCLFFBQVEsRUFBRTs0Q0FDVCxHQUFHLEVBQUU7Z0RBQ0osSUFBSSxFQUFFLGdCQUFnQjtnREFDdEIsUUFBUSxFQUFFO29EQUNULEdBQUcsRUFBRTt3REFDSixNQUFNLEVBQUUsSUFBSTt3REFDWixRQUFRLEVBQUU7NERBQ1QsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRTs0REFDbEIsR0FBRyxFQUFFO2dFQUNKLElBQUksRUFBRSxHQUFHO2dFQUNULFFBQVEsRUFBRSxhQUFhOzZEQUN2Qjs0REFDRCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFO3lEQUNsQjtxREFDRDtpREFDRDs2Q0FDRDs0Q0FDRCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFO3lDQUMxQjtxQ0FDRDtpQ0FDRDs2QkFDRDs0QkFDRCxHQUFHLEVBQUU7Z0NBQ0osSUFBSSxFQUFFLFVBQVU7Z0NBQ2hCLFFBQVEsRUFBRTtvQ0FDVCxHQUFHLEVBQUU7d0NBQ0osSUFBSSxFQUFFLFVBQVU7d0NBQ2hCLFFBQVEsRUFBRTs0Q0FDVCxHQUFHLEVBQUU7Z0RBQ0osSUFBSSxFQUFFLFlBQVk7Z0RBQ2xCLFFBQVEsRUFBRTtvREFDVCxHQUFHLEVBQUU7d0RBQ0osTUFBTSxFQUFFLElBQUk7d0RBQ1osUUFBUSxFQUFFOzREQUNULEdBQUcsRUFBRSxrQkFBa0I7eURBQ3ZCO3FEQUNEO2lEQUNEOzZDQUNEOzRDQUNELEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUU7eUNBQzFCO3FDQUNEO2lDQUNEOzZCQUNEO3lCQUNEO3FCQUNEO29CQUNELEdBQUcsRUFBRTt3QkFDSixJQUFJLEVBQUUsb0JBQW9CO3FCQUMxQjtpQkFDRDthQUNEO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxZQUFZO2dCQUNsQixRQUFRLEVBQUUsY0FBYzthQUN4QjtZQUNELEdBQUcsRUFBRTtnQkFDSixJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixRQUFRLEVBQUUsYUFBYTthQUN2QjtTQUNEO0tBQ0Q7Q0FDRCxDQUFDO0FBRUYsU0FBUyxTQUFTLENBQUMsR0FBUSxFQUFFLElBQVM7SUFDckMsSUFBSSxHQUFHLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSTtRQUFFLE9BQU8sR0FBRyxDQUFDO0lBRXRDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN2QixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFsQixDQUFrQixDQUFDLENBQUM7S0FDeEM7SUFFRCxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVE7UUFBRSxPQUFPLEdBQUcsQ0FBQztJQUV4QyxJQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7SUFFdkIsS0FBa0IsVUFBZ0IsRUFBaEIsS0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFoQixjQUFnQixFQUFoQixJQUFnQixFQUFFO1FBQS9CLElBQU0sR0FBRyxTQUFBO1FBQ2IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDZCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3JCLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDL0M7aUJBQU07Z0JBQ04sTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNqRTtTQUNEO2FBQU07WUFDTixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3ZCO0tBQ0Q7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVM7SUFDbkMsT0FBTyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJmaWxlIjoidGVzdC9wc2RSZWFkZXIuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcbmltcG9ydCB7XG5cdHJlYWRQc2RGcm9tRmlsZSwgaW1wb3J0UFNELCBsb2FkSW1hZ2VzRnJvbURpcmVjdG9yeSwgY29tcGFyZUNhbnZhc2VzLCBzYXZlQ2FudmFzLFxuXHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyLFxuXHRjb21wYXJlQnVmZmVyc1xufSBmcm9tICcuL2NvbW1vbic7XG5pbXBvcnQgeyBMYXllciwgUmVhZE9wdGlvbnMsIFBzZCB9IGZyb20gJy4uL3BzZCc7XG5pbXBvcnQgeyByZWFkUHNkLCB3cml0ZVBzZEJ1ZmZlciB9IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7IHJlYWRQc2QgYXMgcmVhZFBzZEludGVybmFsIH0gZnJvbSAnLi4vcHNkUmVhZGVyJztcblxuY29uc3QgdGVzdEZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0Jyk7XG5jb25zdCByZWFkRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkJyk7XG5jb25zdCByZWFkV3JpdGVGaWxlc1BhdGggPSBwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3JlYWQtd3JpdGUnKTtcbmNvbnN0IHJlc3VsdHNGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycpO1xuY29uc3Qgb3B0czogUmVhZE9wdGlvbnMgPSB7XG5cdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxuXHRsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG59O1xuXG5kZXNjcmliZSgnUHNkUmVhZGVyJywgKCkgPT4ge1xuXHRpdCgncmVhZHMgd2lkdGggYW5kIGhlaWdodCBwcm9wZXJseScsICgpID0+IHtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdibGVuZC1tb2RlJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzIH0pO1xuXHRcdGV4cGVjdChwc2Qud2lkdGgpLmVxdWFsKDMwMCk7XG5cdFx0ZXhwZWN0KHBzZC5oZWlnaHQpLmVxdWFsKDIwMCk7XG5cdH0pO1xuXG5cdGl0KCdza2lwcyBjb21wb3NpdGUgaW1hZ2UgZGF0YScsICgpID0+IHtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMsIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUgfSk7XG5cdFx0ZXhwZWN0KHBzZC5jYW52YXMpLm5vdC5vaztcblx0fSk7XG5cblx0aXQoJ3NraXBzIGxheWVyIGltYWdlIGRhdGEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUgfSk7XG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMF0uY2FudmFzKS5ub3Qub2s7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ2NhbiByZWFkIGEgUFNEIHdpdGggbGF5ZXIgbWFza3MgKG9ubHkgaWYgdGhyb3cgb24gbWlzc2luZyBmZWF0dXJlcyBpcyBub3Qgc2V0KScsICgpID0+IHtcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICcuLicsICdsYXllci1tYXNrJywgJ3NyYy5wc2QnKSk7XG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMF0uY2FudmFzKS5vaztcblx0fSk7XG5cblx0aXQoJ3JlYWRzIFBTRCBmcm9tIEJ1ZmZlciB3aXRoIG9mZnNldCcsICgpID0+IHtcblx0XHRjb25zdCBmaWxlID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSk7XG5cdFx0Y29uc3Qgb3V0ZXIgPSBCdWZmZXIuYWxsb2MoZmlsZS5ieXRlTGVuZ3RoICsgMTAwKTtcblx0XHRmaWxlLmNvcHkob3V0ZXIsIDEwMCk7XG5cdFx0Y29uc3QgaW5uZXIgPSBCdWZmZXIuZnJvbShvdXRlci5idWZmZXIsIDEwMCwgZmlsZS5ieXRlTGVuZ3RoKTtcblxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2QoaW5uZXIsIG9wdHMpO1xuXG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkuZXF1YWwoMzAwKTtcblx0fSk7XG5cblx0ZnMucmVhZGRpclN5bmMocmVhZEZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gIS9wYXR0ZXJuLy50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xuXHRcdGl0KGByZWFkcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCBmKTtcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsICdzcmMucHNkJyksIHsgLi4ub3B0cyB9KTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gaW1wb3J0UFNEKGJhc2VQYXRoKTtcblx0XHRcdGNvbnN0IGltYWdlcyA9IGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5KGJhc2VQYXRoKTtcblx0XHRcdGNvbnN0IGNvbXBhcmU6IHsgbmFtZTogc3RyaW5nOyBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50IHwgdW5kZWZpbmVkOyBza2lwPzogYm9vbGVhbjsgfVtdID0gW107XG5cblx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBjYW52YXMucG5nYCwgY2FudmFzOiBwc2QuY2FudmFzIH0pO1xuXHRcdFx0cHNkLmNhbnZhcyA9IHVuZGVmaW5lZDtcblx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VEYXRhO1xuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEueG1wTWV0YWRhdGE7XG5cblx0XHRcdGxldCBpID0gMDtcblxuXHRcdFx0ZnVuY3Rpb24gcHVzaExheWVyQ2FudmFzZXMobGF5ZXJzOiBMYXllcltdKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgbCBvZiBsYXllcnMpIHtcblx0XHRcdFx0XHRpZiAobC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0cHVzaExheWVyQ2FudmFzZXMobC5jaGlsZHJlbik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxheWVySWQgPSBpKys7XG5cdFx0XHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgbGF5ZXItJHtsYXllcklkfS5wbmdgLCBjYW52YXM6IGwuY2FudmFzIH0pO1xuXHRcdFx0XHRcdFx0bC5jYW52YXMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRkZWxldGUgbC5pbWFnZURhdGE7XG5cblx0XHRcdFx0XHRcdGlmIChsLm1hc2spIHtcblx0XHRcdFx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGxheWVyLSR7bGF5ZXJJZH0tbWFzay5wbmdgLCBjYW52YXM6IGwubWFzay5jYW52YXMgfSk7XG5cdFx0XHRcdFx0XHRcdGRlbGV0ZSBsLm1hc2suY2FudmFzO1xuXHRcdFx0XHRcdFx0XHRkZWxldGUgbC5tYXNrLmltYWdlRGF0YTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cHVzaExheWVyQ2FudmFzZXMocHNkLmNoaWxkcmVuIHx8IFtdKTtcblx0XHRcdGZzLm1rZGlyU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG5cdFx0XHRpZiAocHNkLmltYWdlUmVzb3VyY2VzPy50aHVtYm5haWwpIHtcblx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogJ3RodW1iLnBuZycsIGNhbnZhczogcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbCwgc2tpcDogdHJ1ZSB9KTtcblx0XHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWw7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXMpIGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsUmF3O1xuXG5cdFx0XHRjb21wYXJlLmZvckVhY2goaSA9PiBzYXZlQ2FudmFzKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCBpLm5hbWUpLCBpLmNhbnZhcykpO1xuXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCAnZGF0YS5qc29uJyksIEpTT04uc3RyaW5naWZ5KHBzZCwgbnVsbCwgMiksICd1dGY4Jyk7XG5cblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMocHNkKTtcblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMoZXhwZWN0ZWQpO1xuXG5cdFx0XHRleHBlY3QocHNkKS5lcWwoZXhwZWN0ZWQsIGYpO1xuXHRcdFx0Y29tcGFyZS5mb3JFYWNoKGkgPT4gaS5za2lwIHx8IGNvbXBhcmVDYW52YXNlcyhpbWFnZXNbaS5uYW1lXSwgaS5jYW52YXMsIGAke2Z9LyR7aS5uYW1lfWApKTtcblx0XHR9KTtcblx0fSk7XG5cblx0ZnMucmVhZGRpclN5bmMocmVhZFdyaXRlRmlsZXNQYXRoKS5mb3JFYWNoKGYgPT4ge1xuXHRcdGl0KGByZWFkcy13cml0ZXMgUFNEIGZpbGUgKCR7Zn0pYCwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkV3JpdGVGaWxlc1BhdGgsIGYsICdzcmMucHNkJyksIHsgLi4ub3B0cywgdXNlSW1hZ2VEYXRhOiB0cnVlLCB1c2VSYXdUaHVtYm5haWw6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgJ2V4cGVjdGVkLnBzZCcpKTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0ucHNkYCksIGFjdHVhbCk7XG5cdFx0XHRjb21wYXJlQnVmZmVycyhhY3R1YWwsIGV4cGVjdGVkLCBgcmVhZC13cml0ZS0ke2Z9YCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGl0LnNraXAoJ3dyaXRlIHRleHQgbGF5ZXIgdGVzdCcsICgpID0+IHtcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdHdpZHRoOiAyMDAsXG5cdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiAndGV4dCBsYXllcicsXG5cdFx0XHRcdFx0dGV4dDoge1xuXHRcdFx0XHRcdFx0dGV4dDogJ0hlbGxvIFdvcmxkXFxu4oCiIGMg4oCiIHRpbnkhXFxyXFxudGVzdCcsXG5cdFx0XHRcdFx0XHQvLyBvcmllbnRhdGlvbjogJ3ZlcnRpY2FsJyxcblx0XHRcdFx0XHRcdHRyYW5zZm9ybTogWzEsIDAsIDAsIDEsIDcwLCA3MF0sXG5cdFx0XHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdFx0XHRmb250OiB7IG5hbWU6ICdBcmlhbE1UJyB9LFxuXHRcdFx0XHRcdFx0XHRmb250U2l6ZTogMzAsXG5cdFx0XHRcdFx0XHRcdGZpbGxDb2xvcjogeyByOiAwLCBnOiAxMjgsIGI6IDAgfSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRzdHlsZVJ1bnM6IFtcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDEyLCBzdHlsZTogeyBmaWxsQ29sb3I6IHsgcjogMjU1LCBnOiAwLCBiOiAwIH0gfSB9LFxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogMTIsIHN0eWxlOiB7IGZpbGxDb2xvcjogeyByOiAwLCBnOiAwLCBiOiAyNTUgfSB9IH0sXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiA0LCBzdHlsZTogeyB1bmRlcmxpbmU6IHRydWUgfSB9LFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdHBhcmFncmFwaFN0eWxlOiB7XG5cdFx0XHRcdFx0XHRcdGp1c3RpZmljYXRpb246ICdjZW50ZXInLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHdhcnA6IHtcblx0XHRcdFx0XHRcdFx0c3R5bGU6ICdhcmMnLFxuXHRcdFx0XHRcdFx0XHR2YWx1ZTogNTAsXG5cdFx0XHRcdFx0XHRcdHBlcnNwZWN0aXZlOiAwLFxuXHRcdFx0XHRcdFx0XHRwZXJzcGVjdGl2ZU90aGVyOiAwLFxuXHRcdFx0XHRcdFx0XHRyb3RhdGU6ICdob3Jpem9udGFsJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5hbWU6ICcybmQgbGF5ZXInLFxuXHRcdFx0XHRcdHRleHQ6IHtcblx0XHRcdFx0XHRcdHRleHQ6ICdBYWFhYScsXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm06IFsxLCAwLCAwLCAxLCA3MCwgNzBdLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdH07XG5cblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCAnX1RFWFQyLnBzZCcpLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcblx0fSk7XG5cblx0aXQuc2tpcCgncmVhZCB0ZXh0IGxheWVyIHRlc3QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGV4dC10ZXN0LnBzZCcpLCBvcHRzKTtcblx0XHQvLyBjb25zdCBsYXllciA9IHBzZC5jaGlsZHJlbiFbMV07XG5cblx0XHQvLyBsYXllci50ZXh0IS50ZXh0ID0gJ0ZvbyBiYXInO1xuXHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgJ19URVhULnBzZCcpLCBidWZmZXIpO1xuXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLmNoaWxkcmVuIVswXS50ZXh0LCBmYWxzZSwgOTksIHRydWUpKTtcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzFdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5lbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcblx0fSk7XG5cblx0aXQuc2tpcCgnUkVBRCBURVNUJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsQnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGVzdC5wc2QnKSk7XG5cblx0XHRjb25zb2xlLmxvZygnUkVBRElORyBPUklHSU5BTCcpO1xuXHRcdGNvbnN0IG9wdHMgPSB7XG5cdFx0XHRsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHRcdHVzZUltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdHVzZVJhd1RodW1ibmFpbDogdHJ1ZSxcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdH07XG5cdFx0Y29uc3Qgb3JpZ2luYWxQc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihvcmlnaW5hbEJ1ZmZlciksIG9wdHMpO1xuXG5cdFx0Y29uc29sZS5sb2coJ1dSSVRJTkcnKTtcblx0XHRjb25zdCBidWZmZXIgPSB3cml0ZVBzZEJ1ZmZlcihvcmlnaW5hbFBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGVtcC5wc2QnLCBidWZmZXIpO1xuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuYmluJywgYnVmZmVyKTtcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wLmpzb24nLCBKU09OLnN0cmluZ2lmeShvcmlnaW5hbFBzZCwgbnVsbCwgMiksICd1dGY4Jyk7XG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC54bWwnLCBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcz8ueG1wTWV0YWRhdGEsICd1dGY4Jyk7XG5cblx0XHRjb25zb2xlLmxvZygnUkVBRElORyBXUklUVEVOJyk7XG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKFxuXHRcdFx0Y3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG5cblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhvcmlnaW5hbFBzZCk7XG5cdFx0Y2xlYXJDYW52YXNGaWVsZHMocHNkKTtcblx0XHRkZWxldGUgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbDtcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XG5cdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsUmF3O1xuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KG9yaWdpbmFsUHNkLCBmYWxzZSwgOTksIHRydWUpKTtcblxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ29yaWdpbmFsLmpzb24nLCBKU09OLnN0cmluZ2lmeShvcmlnaW5hbFBzZCwgbnVsbCwgMikpO1xuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ2FmdGVyLmpzb24nLCBKU09OLnN0cmluZ2lmeShwc2QsIG51bGwsIDIpKTtcblxuXHRcdGNvbXBhcmVCdWZmZXJzKGJ1ZmZlciwgb3JpZ2luYWxCdWZmZXIsICd0ZXN0Jyk7XG5cblx0XHRleHBlY3QocHNkKS5lcWwob3JpZ2luYWxQc2QpO1xuXHR9KTtcblxuXHRpdC5za2lwKCdkZWNvZGUgZW5naW5lIGRhdGEgMicsICgpID0+IHtcblx0XHQvLyBjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzb3VyY2VzJywgJ2VuZ2luZURhdGEyVmVydGljYWwudHh0JykpO1xuXHRcdGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJTaW1wbGUudHh0JykpO1xuXHRcdGNvbnN0IGZ1bmMgPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2ZpbGVEYXRhfTtgKTtcblx0XHRjb25zdCBkYXRhID0gZnVuYygpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGRlY29kZUVuZ2luZURhdGEyKGRhdGEpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoXG5cdFx0XHRwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzb3VyY2VzJywgJ3RlbXAuanMnKSxcblx0XHRcdCd2YXIgeCA9ICcgKyByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChyZXN1bHQsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xuXHR9KTtcblxuXHRpdC5za2lwKCd0ZXN0LnBzZCcsICgpID0+IHtcblx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3Rlc3QucHNkJyk7XG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge1xuXHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdH0pO1xuXHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcblx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcblx0XHRjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xuXHR9KTtcblxuXHRpdC5za2lwKCd0ZXN0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgdGVzdC9yZWFkLXdyaXRlL3RleHQtYm94L3NyYy5wc2RgKSksIHtcblx0XHRcdC8vIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXG5cdFx0XHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXG5cdFx0XHQvLyBza2lwVGh1bWJuYWlsOiB0cnVlLFxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcblx0XHRcdHVzZVJhd1RodW1ibmFpbDogdHJ1ZSxcblx0XHR9KTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKCd0ZXh0X3JlY3Rfb3V0LnBzZCcsIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RleHRfcmVjdF9vdXQuYmluJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XG5cdFx0Ly8gY29uc3QgcHNkMiA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgdGV4dF9yZWN0X291dC5wc2RgKSksIHtcblx0XHQvLyBcdC8vIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXG5cdFx0Ly8gXHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXG5cdFx0Ly8gXHQvLyBza2lwVGh1bWJuYWlsOiB0cnVlLFxuXHRcdC8vIFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0Ly8gXHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcblx0XHQvLyB9KTtcblx0XHQvLyBwc2QyO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApO1xuXHRcdGNvbnN0IG91dHB1dCA9IGZzLnJlYWRGaWxlU3luYyhgdGV4dF9yZWN0X291dC5wc2RgKTtcblx0XHRjb21wYXJlQnVmZmVycyhvdXRwdXQsIG9yaWdpbmFsLCAnLScsIDB4NjVkOCk7IC8vICwgMHg4Y2U4LCAweDhmY2EgLSAweDhjZTgpO1xuXHR9KTtcblxuXHRpdC5za2lwKCdjb21wYXJlIHRlc3QnLCAoKSA9PiB7XG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIFsndGV4dF9wb2ludCcsICd0ZXh0X3JlY3QnXSkge1xuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGAke25hbWV9LnBzZGApKSwge1xuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdFx0Ly8gcHNkLmltYWdlUmVzb3VyY2VzID0ge307XG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9LnR4dGAsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cblx0XHRcdC8vIGNvbnN0IGVuZ2luZURhdGEgPSBwYXJzZUVuZ2luZURhdGEodG9CeXRlQXJyYXkocHNkLmVuZ2luZURhdGEhKSk7XG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9X2VuZ2luZWRhdGEudHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cdFx0fVxuXHR9KTtcblxuXHRpdC5za2lwKCd0ZXh0LXJlcGxhY2UucHNkJywgKCkgPT4ge1xuXHRcdHtcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlMi5wc2QnKTtcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHt9KTtcblx0XHRcdHBzZC5jaGlsZHJlbiFbMV0hLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XG5cdFx0XHRjb25zdCBvdXRwdXQgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgaW52YWxpZGF0ZVRleHRMYXllcnM6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ291dC5wc2QnLCBvdXRwdXQpO1xuXHRcdH1cblxuXHRcdHtcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlLnBzZCcpO1xuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge1xuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdFx0ZGVsZXRlIHBzZC5lbmdpbmVEYXRhO1xuXHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XG5cdFx0XHRwc2QuY2hpbGRyZW4/LnNwbGljZSgwLCAxKTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ2lucHV0LnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cdFx0fVxuXG5cdFx0e1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCdvdXQucHNkJyk7XG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XG5cdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0cHV0LnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XG5cdFx0fVxuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBjbGVhckVtcHR5Q2FudmFzRmllbGRzKGxheWVyOiBMYXllciB8IHVuZGVmaW5lZCkge1xuXHRpZiAobGF5ZXIpIHtcblx0XHRpZiAoJ2NhbnZhcycgaW4gbGF5ZXIgJiYgIWxheWVyLmNhbnZhcykgZGVsZXRlIGxheWVyLmNhbnZhcztcblx0XHRpZiAoJ2ltYWdlRGF0YScgaW4gbGF5ZXIgJiYgIWxheWVyLmltYWdlRGF0YSkgZGVsZXRlIGxheWVyLmltYWdlRGF0YTtcblx0XHRsYXllci5jaGlsZHJlbj8uZm9yRWFjaChjbGVhckVtcHR5Q2FudmFzRmllbGRzKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjbGVhckNhbnZhc0ZpZWxkcyhsYXllcjogTGF5ZXIgfCB1bmRlZmluZWQpIHtcblx0aWYgKGxheWVyKSB7XG5cdFx0ZGVsZXRlIGxheWVyLmNhbnZhcztcblx0XHRkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xuXHRcdGlmIChsYXllci5tYXNrKSBkZWxldGUgbGF5ZXIubWFzay5jYW52YXM7XG5cdFx0aWYgKGxheWVyLm1hc2spIGRlbGV0ZSBsYXllci5tYXNrLmltYWdlRGF0YTtcblx0XHRsYXllci5jaGlsZHJlbj8uZm9yRWFjaChjbGVhckNhbnZhc0ZpZWxkcyk7XG5cdH1cbn1cblxuLy8vIEVuZ2luZSBkYXRhIDIgZXhwZXJpbWVudHNcbi8vIC90ZXN0L2VuZ2luZURhdGEyLmpzb246MTEwOSBpcyBjaGFyYWN0ZXIgY29kZXNcblxuY29uc3Qga2V5c0NvbG9yID0ge1xuXHQnMCc6IHtcblx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0Y2hpbGRyZW46IHtcblx0XHRcdCcwJzogeyBuYW1lOiAnVHlwZScgfSxcblx0XHRcdCcxJzogeyBuYW1lOiAnVmFsdWVzJyB9LFxuXHRcdH0sXG5cdH0sXG59O1xuXG5jb25zdCBrZXlzU3R5bGVTaGVldCA9IHtcblx0JzAnOiB7IG5hbWU6ICdGb250JyB9LFxuXHQnMSc6IHsgbmFtZTogJ0ZvbnRTaXplJyB9LFxuXHQnMic6IHsgbmFtZTogJ0ZhdXhCb2xkJyB9LFxuXHQnMyc6IHsgbmFtZTogJ0ZhdXhJdGFsaWMnIH0sXG5cdCc0JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXG5cdCc1JzogeyBuYW1lOiAnTGVhZGluZycgfSxcblx0JzYnOiB7IG5hbWU6ICdIb3Jpem9udGFsU2NhbGUnIH0sXG5cdCc3JzogeyBuYW1lOiAnVmVydGljYWxTY2FsZScgfSxcblx0JzgnOiB7IG5hbWU6ICdUcmFja2luZycgfSxcblx0JzknOiB7IG5hbWU6ICdCYXNlbGluZVNoaWZ0JyB9LFxuXG5cdCcxMSc6IHsgbmFtZTogJ0tlcm5pbmc/JyB9LCAvLyBkaWZmZXJlbnQgdmFsdWUgdGhhbiBFbmdpbmVEYXRhXG5cdCcxMic6IHsgbmFtZTogJ0ZvbnRDYXBzJyB9LFxuXHQnMTMnOiB7IG5hbWU6ICdGb250QmFzZWxpbmUnIH0sXG5cblx0JzE1JzogeyBuYW1lOiAnU3RyaWtldGhyb3VnaD8nIH0sIC8vIG51bWJlciBpbnN0ZWFkIG9mIGJvb2xcblx0JzE2JzogeyBuYW1lOiAnVW5kZXJsaW5lPycgfSwgLy8gbnVtYmVyIGluc3RlYWQgb2YgYm9vbFxuXG5cdCcxOCc6IHsgbmFtZTogJ0xpZ2F0dXJlcycgfSxcblx0JzE5JzogeyBuYW1lOiAnRExpZ2F0dXJlcycgfSxcblxuXHQnMjMnOiB7IG5hbWU6ICdGcmFjdGlvbnMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcblx0JzI0JzogeyBuYW1lOiAnT3JkaW5hbHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcblxuXHQnMjgnOiB7IG5hbWU6ICdTdHlsaXN0aWNBbHRlcm5hdGVzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXG5cblx0JzMwJzogeyBuYW1lOiAnT2xkU3R5bGU/JyB9LCAvLyBPcGVuVHlwZSA+IE9sZFN0eWxlLCBudW1iZXIgaW5zdGVhZCBvZiBib29sLCBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXG5cblx0JzM1JzogeyBuYW1lOiAnQmFzZWxpbmVEaXJlY3Rpb24nIH0sXG5cblx0JzM4JzogeyBuYW1lOiAnTGFuZ3VhZ2UnIH0sXG5cblx0JzUyJzogeyBuYW1lOiAnTm9CcmVhaycgfSxcblx0JzUzJzogeyBuYW1lOiAnRmlsbENvbG9yJywgY2hpbGRyZW46IGtleXNDb2xvciB9LFxufTtcblxuY29uc3Qga2V5c1BhcmFncmFwaCA9IHtcblx0JzAnOiB7IG5hbWU6ICdKdXN0aWZpY2F0aW9uJyB9LFxuXHQnMSc6IHsgbmFtZTogJ0ZpcnN0TGluZUluZGVudCcgfSxcblx0JzInOiB7IG5hbWU6ICdTdGFydEluZGVudCcgfSxcblx0JzMnOiB7IG5hbWU6ICdFbmRJbmRlbnQnIH0sXG5cdCc0JzogeyBuYW1lOiAnU3BhY2VCZWZvcmUnIH0sXG5cdCc1JzogeyBuYW1lOiAnU3BhY2VBZnRlcicgfSxcblxuXHQnNyc6IHsgbmFtZTogJ0F1dG9MZWFkaW5nJyB9LFxuXG5cdCc5JzogeyBuYW1lOiAnQXV0b0h5cGhlbmF0ZScgfSxcblx0JzEwJzogeyBuYW1lOiAnSHlwaGVuYXRlZFdvcmRTaXplJyB9LFxuXHQnMTEnOiB7IG5hbWU6ICdQcmVIeXBoZW4nIH0sXG5cdCcxMic6IHsgbmFtZTogJ1Bvc3RIeXBoZW4nIH0sXG5cdCcxMyc6IHsgbmFtZTogJ0NvbnNlY3V0aXZlSHlwaGVucz8nIH0sIC8vIGRpZmZlcmVudCB2YWx1ZSB0aGFuIEVuZ2luZURhdGFcblx0JzE0JzogeyBuYW1lOiAnWm9uZScgfSxcblx0JzE1JzogeyBuYW1lOiAnSHlwZW5hdGVDYXBpdGFsaXplZFdvcmRzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXG5cblx0JzE3JzogeyBuYW1lOiAnV29yZFNwYWNpbmcnIH0sXG5cdCcxOCc6IHsgbmFtZTogJ0xldHRlclNwYWNpbmcnIH0sXG5cdCcxOSc6IHsgbmFtZTogJ0dseXBoU3BhY2luZycgfSxcblxuXHQnMzInOiB7IG5hbWU6ICdTdHlsZVNoZWV0JywgY2hpbGRyZW46IGtleXNTdHlsZVNoZWV0IH0sXG59O1xuXG5jb25zdCBrZXlzU3R5bGVTaGVldERhdGEgPSB7XG5cdG5hbWU6ICdTdHlsZVNoZWV0RGF0YScsXG5cdGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCxcbn07XG5cbmNvbnN0IGtleXMgPSB7XG5cdCcwJzoge1xuXHRcdG5hbWU6ICdSZXNvdXJjZURpY3QnLFxuXHRcdGNoaWxkcmVuOiB7XG5cdFx0XHQnMSc6IHtcblx0XHRcdFx0bmFtZTogJ0ZvbnRTZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMic6IHsgbmFtZTogJ0ZvbnRUeXBlJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzInOiB7XG5cdFx0XHRcdG5hbWU6ICcyJyxcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxuXHRcdFx0fSxcblx0XHRcdCczJzoge1xuXHRcdFx0XHRuYW1lOiAnTW9qaUt1bWlTZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ0ludGVybmFsTmFtZScgfSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdCc0Jzoge1xuXHRcdFx0XHRuYW1lOiAnS2luc29rdVNldCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcblx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOb1N0YXJ0JyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnTm9FbmQnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzInOiB7IG5hbWU6ICdLZWVwJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCczJzogeyBuYW1lOiAnSGFuZ2luZycgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHQnNSc6IHtcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXRTZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdCc2Jzoge1xuXHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXRTZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0JzAnOiB7XG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXG5cdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1Byb3BlcnRpZXMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IHsgbmFtZTogJ0RlZmF1bHRTdHlsZVNoZWV0JyB9LFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzgnOiB7XG5cdFx0XHRcdG5hbWU6ICc4Jyxcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxuXHRcdFx0fSxcblx0XHRcdCc5Jzoge1xuXHRcdFx0XHRuYW1lOiAnUHJlZGVmaW5lZCcsXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcblx0XHRcdH0sXG5cdFx0fSxcblx0fSxcblx0JzEnOiB7XG5cdFx0bmFtZTogJ0VuZ2luZURpY3QnLFxuXHRcdGNoaWxkcmVuOiB7XG5cdFx0XHQnMCc6IHtcblx0XHRcdFx0bmFtZTogJzAnLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0bmFtZTogJzAnLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQnMyc6IHsgbmFtZTogJ1N1cGVyc2NyaXB0U2l6ZScgfSxcblx0XHRcdFx0XHQnNCc6IHsgbmFtZTogJ1N1cGVyc2NyaXB0UG9zaXRpb24nIH0sXG5cdFx0XHRcdFx0JzUnOiB7IG5hbWU6ICdTdWJzY3JpcHRTaXplJyB9LFxuXHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnU3Vic2NyaXB0UG9zaXRpb24nIH0sXG5cdFx0XHRcdFx0JzcnOiB7IG5hbWU6ICdTbWFsbENhcFNpemUnIH0sXG5cdFx0XHRcdFx0JzgnOiB7IG5hbWU6ICdVc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHMnIH0sIC8vID8/P1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdCcxJzoge1xuXHRcdFx0XHRuYW1lOiAnRWRpdG9ycz8nLFxuXHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0bmFtZTogJ0VkaXRvcicsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ1RleHQnIH0sXG5cdFx0XHRcdFx0XHRcdCc1Jzoge1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhSdW4nLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1J1bkFycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnMCcgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnNScsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnNicgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnUnVuTGVuZ3RoJyB9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHQnNic6IHtcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnU3R5bGVSdW4nLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1J1bkFycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzYnOiBrZXlzU3R5bGVTaGVldERhdGEsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ1J1bkxlbmd0aCcgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQnMSc6IHtcblx0XHRcdFx0XHRcdG5hbWU6ICdGb250VmVjdG9yRGF0YSA/Pz8nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0JzInOiB7XG5cdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0Jyxcblx0XHRcdFx0Y2hpbGRyZW46IGtleXNTdHlsZVNoZWV0LFxuXHRcdFx0fSxcblx0XHRcdCczJzoge1xuXHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXQnLFxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcblx0XHRcdH0sXG5cdFx0fSxcblx0fSxcbn07XG5cbmZ1bmN0aW9uIGRlY29kZU9iaihvYmo6IGFueSwga2V5czogYW55KTogYW55IHtcblx0aWYgKG9iaiA9PT0gbnVsbCB8fCAha2V5cykgcmV0dXJuIG9iajtcblxuXHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG5cdFx0cmV0dXJuIG9iai5tYXAoeCA9PiBkZWNvZGVPYmooeCwga2V5cykpO1xuXHR9XG5cblx0aWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSByZXR1cm4gb2JqO1xuXG5cdGNvbnN0IHJlc3VsdDogYW55ID0ge307XG5cblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xuXHRcdGlmIChrZXlzW2tleV0pIHtcblx0XHRcdGlmIChrZXlzW2tleV0udXByb290KSB7XG5cdFx0XHRcdHJldHVybiBkZWNvZGVPYmoob2JqW2tleV0sIGtleXNba2V5XS5jaGlsZHJlbik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRba2V5c1trZXldLm5hbWVdID0gZGVjb2RlT2JqKG9ialtrZXldLCBrZXlzW2tleV0uY2hpbGRyZW4pO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHRba2V5XSA9IG9ialtrZXldO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGRlY29kZUVuZ2luZURhdGEyKGRhdGE6IGFueSkge1xuXHRyZXR1cm4gZGVjb2RlT2JqKGRhdGEsIGtleXMpO1xufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
