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
        var psd = (0, common_1.readPsdFromFile)(path.join(readFilesPath, 'blend-mode', 'src.psd'), __assign({}, opts));
        console.log(require('util').inspect(psd, false, 99, true));
        (0, chai_1.expect)(psd.width).equal(300);
        (0, chai_1.expect)(psd.height).equal(200);
    });
    it('skips composite image data', function () {
        var psd = (0, common_1.readPsdFromFile)(path.join(readFilesPath, 'layers', 'src.psd'), __assign(__assign({}, opts), { skipCompositeImageData: true }));
        (0, chai_1.expect)(psd.canvas).not.ok;
    });
    it('fetches a layer group', function () {
        var psd = (0, common_1.readPsdFromFile)(path.join(readFilesPath, 'nested-layers', 'src.psd'), __assign(__assign({}, opts), { skipLayerImageData: true }));
        (0, chai_1.expect)(psd.children[2].name).to.equal('Group 1');
        (0, chai_1.expect)(psd.children[2].children[0].name).to.equal('GroupChild1');
        (0, chai_1.expect)(psd.children[2].children[0].parentId).to.equal(5);
    });
    it('reads PSD from Buffer with offset', function () {
        var file = fs.readFileSync(path.join(readFilesPath, 'layers', 'src.psd'));
        var outer = Buffer.alloc(file.byteLength + 100);
        file.copy(outer, 100);
        var inner = Buffer.from(outer.buffer, 100, file.byteLength);
        var psd = (0, index_1.readPsd)(inner, opts);
        (0, chai_1.expect)(psd.width).equal(300);
    });
    it.skip('duplicate smart', function () {
        var psd = (0, common_1.readPsdFromFile)(path.join('resources', 'src.psd'), __assign({}, opts));
        var child = psd.children[1].children[0];
        psd.children[1].children.push(child);
        // const child = psd.children![0];
        // delete child.id;
        // psd.children!.push(child);
        fs.writeFileSync('output.psd', (0, index_1.writePsdBuffer)(psd, {
            trimImageData: false,
            generateThumbnail: true,
            noBackground: true
        }));
        var psd2 = (0, common_1.readPsdFromFile)(path.join('output.psd'), __assign({}, opts));
        console.log(psd2.width);
    });
    // skipping "pattern" test because it requires zip cimpression of patterns
    // skipping "cmyk" test because we can't convert CMYK to RGB
    fs.readdirSync(readFilesPath).filter(function (f) { return !/pattern|cmyk/.test(f); }).forEach(function (f) {
        // fs.readdirSync(readFilesPath).filter(f => /fill-opacity/.test(f)).forEach(f => {
        it("reads PSD file (".concat(f, ")"), function () {
            var _a;
            var basePath = path.join(readFilesPath, f);
            var fileName = fs.existsSync(path.join(basePath, 'src.psb')) ? 'src.psb' : 'src.psd';
            var psd = (0, common_1.readPsdFromFile)(path.join(basePath, fileName), __assign({}, opts));
            var expected = (0, common_1.importPSD)(basePath);
            var images = (0, common_1.loadImagesFromDirectory)(basePath);
            var compare = [];
            var compareFiles = [];
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
                        compare.push({ name: "layer-".concat(layerId, ".png"), canvas: l.canvas });
                        l.canvas = undefined;
                        delete l.imageData;
                        if (l.mask) {
                            compare.push({ name: "layer-".concat(layerId, "-mask.png"), canvas: l.mask.canvas });
                            delete l.mask.canvas;
                            delete l.mask.imageData;
                        }
                    }
                }
            }
            if (psd.linkedFiles) {
                for (var _i = 0, _b = psd.linkedFiles; _i < _b.length; _i++) {
                    var file = _b[_i];
                    if (file.data) {
                        compareFiles.push({ name: file.name, data: file.data });
                        delete file.data;
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
            compare.forEach(function (i) { return (0, common_1.saveCanvas)(path.join(resultsFilesPath, f, i.name), i.canvas); });
            compareFiles.forEach(function (i) { return fs.writeFileSync(path.join(resultsFilesPath, f, i.name), i.data); });
            fs.writeFileSync(path.join(resultsFilesPath, f, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');
            clearEmptyCanvasFields(psd);
            clearEmptyCanvasFields(expected);
            (0, chai_1.expect)(psd).eql(expected, f);
            compare.forEach(function (i) { return i.skip || (0, common_1.compareCanvases)(images[i.name], i.canvas, "".concat(f, "/").concat(i.name)); });
            compareFiles.forEach(function (i) { return (0, common_1.compareTwoFiles)(path.join(basePath, i.name), i.data, "".concat(f, "/").concat(i.name)); });
        });
    });
    fs.readdirSync(readWriteFilesPath).forEach(function (f) {
        // fs.readdirSync(readWriteFilesPath).filter(f => /annot/.test(f)).forEach(f => {
        it("reads-writes PSD file (".concat(f, ")"), function () {
            var ext = fs.existsSync(path.join(readWriteFilesPath, f, 'src.psb')) ? 'psb' : 'psd';
            var psd = (0, common_1.readPsdFromFile)(path.join(readWriteFilesPath, f, "src.".concat(ext)), __assign(__assign({}, opts), { useImageData: true, useRawThumbnail: true, throwForMissingFeatures: true }));
            var actual = (0, index_1.writePsdBuffer)(psd, { logMissingFeatures: true, psb: ext === 'psb' });
            var expected = fs.readFileSync(path.join(readWriteFilesPath, f, "expected.".concat(ext)));
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-".concat(f, ".").concat(ext)), actual);
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-".concat(f, ".bin")), actual);
            // console.log(require('util').inspect(psd, false, 99, true));
            // const psd2 = readPsdFromFile(path.join(resultsFilesPath, `read-write-${f}.psd`), { ...opts, useImageData: true, useRawThumbnail: true });
            // fs.writeFileSync('temp.txt', require('util').inspect(psd, false, 99, false), 'utf8');
            // fs.writeFileSync('temp2.txt', require('util').inspect(psd2, false, 99, false), 'utf8');
            (0, common_1.compareBuffers)(actual, expected, "read-write-".concat(f), 0);
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
        fs.writeFileSync(path.join(resultsFilesPath, '_TEXT2.psd'), (0, index_1.writePsdBuffer)(psd, { logMissingFeatures: true }));
    });
    it.skip('read text layer test', function () {
        var psd = (0, common_1.readPsdFromFile)(path.join(testFilesPath, 'text-test.psd'), opts);
        // const layer = psd.children![1];
        // layer.text!.text = 'Foo bar';
        var buffer = (0, index_1.writePsdBuffer)(psd, { logMissingFeatures: true });
        fs.writeFileSync(path.join(resultsFilesPath, '_TEXT.psd'), buffer);
        // console.log(require('util').inspect(psd.children![0].text, false, 99, true));
        // console.log(require('util').inspect(psd.children![1].text, false, 99, true));
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
        var originalPsd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(originalBuffer), opts);
        console.log('WRITING');
        var buffer = (0, index_1.writePsdBuffer)(originalPsd, { logMissingFeatures: true });
        fs.writeFileSync('temp.psd', buffer);
        // fs.writeFileSync('temp.bin', buffer);
        // fs.writeFileSync('temp.json', JSON.stringify(originalPsd, null, 2), 'utf8');
        // fs.writeFileSync('temp.xml', originalPsd.imageResources?.xmpMetadata, 'utf8');
        console.log('READING WRITTEN');
        var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(buffer), { logMissingFeatures: true, throwForMissingFeatures: true });
        clearCanvasFields(originalPsd);
        clearCanvasFields(psd);
        delete originalPsd.imageResources.thumbnail;
        delete psd.imageResources.thumbnail;
        delete originalPsd.imageResources.thumbnailRaw;
        delete psd.imageResources.thumbnailRaw;
        // console.log(require('util').inspect(originalPsd, false, 99, true));
        // fs.writeFileSync('original.json', JSON.stringify(originalPsd, null, 2));
        // fs.writeFileSync('after.json', JSON.stringify(psd, null, 2));
        (0, common_1.compareBuffers)(buffer, originalBuffer, 'test');
        (0, chai_1.expect)(psd).eql(originalPsd);
    });
    it.skip('decode engine data 2', function () {
        // const fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Vertical.txt'));
        var fileData = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'engineData2Simple.txt'));
        var func = new Function("return ".concat(fileData, ";"));
        var data = func();
        var result = decodeEngineData2(data);
        fs.writeFileSync(path.join(__dirname, '..', '..', 'resources', 'temp.js'), 'var x = ' + require('util').inspect(result, false, 99, false), 'utf8');
    });
    it.skip('test.psd', function () {
        var buffer = fs.readFileSync('test.psd');
        var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(buffer), {
            skipCompositeImageData: true,
            skipLayerImageData: true,
            skipThumbnail: true,
            throwForMissingFeatures: true,
            logDevFeatures: true,
        });
        delete psd.engineData;
        psd.imageResources = {};
    });
    it.skip('test', function () {
        var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(fs.readFileSync("test/read-write/text-box/src.psd")), {
            // skipCompositeImageData: true,
            // skipLayerImageData: true,
            // skipThumbnail: true,
            throwForMissingFeatures: true,
            logDevFeatures: true,
            useRawThumbnail: true,
        });
        fs.writeFileSync('text_rect_out.psd', (0, index_1.writePsdBuffer)(psd, { logMissingFeatures: true }));
        fs.writeFileSync('text_rect_out.bin', (0, index_1.writePsdBuffer)(psd, { logMissingFeatures: true }));
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
        (0, common_1.compareBuffers)(output, original, '-', 0x65d8); // , 0x8ce8, 0x8fca - 0x8ce8);
    });
    it.skip('compare test', function () {
        for (var _i = 0, _a = ['text_point', 'text_rect']; _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(fs.readFileSync("".concat(name_1, ".psd"))), {
                skipCompositeImageData: true,
                skipLayerImageData: true,
                skipThumbnail: true,
                throwForMissingFeatures: true,
                logDevFeatures: true,
            });
            // psd.imageResources = {};
            fs.writeFileSync("".concat(name_1, ".txt"), require('util').inspect(psd, false, 99, false), 'utf8');
            // const engineData = parseEngineData(toByteArray(psd.engineData!));
            // fs.writeFileSync(`${name}_enginedata.txt`, require('util').inspect(engineData, false, 99, false), 'utf8');
        }
    });
    it.skip('text-replace.psd', function () {
        var _a, _b;
        {
            var buffer = fs.readFileSync('text-replace2.psd');
            var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(buffer), {});
            psd.children[1].text.text = 'Foo bar';
            var output = (0, index_1.writePsdBuffer)(psd, { invalidateTextLayers: true, logMissingFeatures: true });
            fs.writeFileSync('out.psd', output);
        }
        {
            var buffer = fs.readFileSync('text-replace.psd');
            var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(buffer), {
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
            var psd = (0, psdReader_1.readPsd)((0, common_1.createReaderFromBuffer)(buffer), {
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
                    '8': { name: 'UseFractionalGlyphWidths' }, // ???
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsR0FBRyxDQUFDLEVBQWhCLGNBQWdCLEVBQWhCLElBQWdCLEVBQUU7UUFBL0IsSUFBTSxHQUFHLFNBQUE7UUFDYixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNkLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRTtnQkFDckIsT0FBTyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUMvQztpQkFBTTtnQkFDTixNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ2pFO1NBQ0Q7YUFBTTtZQUNOLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDdkI7S0FDRDtJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsaUJBQWlCLENBQUMsSUFBUztJQUNuQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDOUIsQ0FBQyIsImZpbGUiOiJ0ZXN0L3BzZFJlYWRlci5zcGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcclxuaW1wb3J0IHtcclxuXHRyZWFkUHNkRnJvbUZpbGUsIGltcG9ydFBTRCwgbG9hZEltYWdlc0Zyb21EaXJlY3RvcnksIGNvbXBhcmVDYW52YXNlcywgc2F2ZUNhbnZhcyxcclxuXHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyLCBjb21wYXJlQnVmZmVycywgY29tcGFyZVR3b0ZpbGVzXHJcbn0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBMYXllciwgUmVhZE9wdGlvbnMsIFBzZCB9IGZyb20gJy4uL3BzZCc7XHJcbmltcG9ydCB7IHJlYWRQc2QsIHdyaXRlUHNkQnVmZmVyIH0gZnJvbSAnLi4vaW5kZXgnO1xyXG5pbXBvcnQgeyByZWFkUHNkIGFzIHJlYWRQc2RJbnRlcm5hbCB9IGZyb20gJy4uL3BzZFJlYWRlcic7XHJcblxyXG5jb25zdCB0ZXN0RmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Rlc3QnKTtcclxuY29uc3QgcmVhZEZpbGVzUGF0aCA9IHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAncmVhZCcpO1xyXG5jb25zdCByZWFkV3JpdGVGaWxlc1BhdGggPSBwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3JlYWQtd3JpdGUnKTtcclxuY29uc3QgcmVzdWx0c0ZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXN1bHRzJyk7XHJcbmNvbnN0IG9wdHM6IFJlYWRPcHRpb25zID0ge1xyXG5cdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxufTtcclxuXHJcbmRlc2NyaWJlKCdQc2RSZWFkZXInLCAoKSA9PiB7XHJcblx0aXQoJ3JlYWRzIHdpZHRoIGFuZCBoZWlnaHQgcHJvcGVybHknLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdibGVuZC1tb2RlJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzIH0pO1xyXG5cdFx0Y29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdGV4cGVjdChwc2Qud2lkdGgpLmVxdWFsKDMwMCk7XHJcblx0XHRleHBlY3QocHNkLmhlaWdodCkuZXF1YWwoMjAwKTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3NraXBzIGNvbXBvc2l0ZSBpbWFnZSBkYXRhJywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlIH0pO1xyXG5cdFx0ZXhwZWN0KHBzZC5jYW52YXMpLm5vdC5vaztcclxuXHR9KTtcclxuXHJcblx0aXQoJ2ZldGNoZXMgYSBsYXllciBncm91cCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ25lc3RlZC1sYXllcnMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMsIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSB9KTtcclxuXHRcdGV4cGVjdChwc2QuY2hpbGRyZW4hWzJdLm5hbWUpLnRvLmVxdWFsKCdHcm91cCAxJyk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5jaGlsZHJlbiFbMF0ubmFtZSkudG8uZXF1YWwoJ0dyb3VwQ2hpbGQxJyk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5jaGlsZHJlbiFbMF0ucGFyZW50SWQpLnRvLmVxdWFsKDUpO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgncmVhZHMgUFNEIGZyb20gQnVmZmVyIHdpdGggb2Zmc2V0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgZmlsZSA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2xheWVycycsICdzcmMucHNkJykpO1xyXG5cdFx0Y29uc3Qgb3V0ZXIgPSBCdWZmZXIuYWxsb2MoZmlsZS5ieXRlTGVuZ3RoICsgMTAwKTtcclxuXHRcdGZpbGUuY29weShvdXRlciwgMTAwKTtcclxuXHRcdGNvbnN0IGlubmVyID0gQnVmZmVyLmZyb20ob3V0ZXIuYnVmZmVyLCAxMDAsIGZpbGUuYnl0ZUxlbmd0aCk7XHJcblxyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZChpbm5lciwgb3B0cyk7XHJcblxyXG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkuZXF1YWwoMzAwKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnZHVwbGljYXRlIHNtYXJ0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbigncmVzb3VyY2VzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzIH0pO1xyXG5cclxuXHRcdGNvbnN0IGNoaWxkID0gcHNkLmNoaWxkcmVuIVsxXS5jaGlsZHJlbiFbMF07XHJcblx0XHRwc2QuY2hpbGRyZW4hWzFdLmNoaWxkcmVuIS5wdXNoKGNoaWxkKTtcclxuXHJcblx0XHQvLyBjb25zdCBjaGlsZCA9IHBzZC5jaGlsZHJlbiFbMF07XHJcblx0XHQvLyBkZWxldGUgY2hpbGQuaWQ7XHJcblx0XHQvLyBwc2QuY2hpbGRyZW4hLnB1c2goY2hpbGQpO1xyXG5cclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ291dHB1dC5wc2QnLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHtcclxuXHRcdFx0dHJpbUltYWdlRGF0YTogZmFsc2UsXHJcblx0XHRcdGdlbmVyYXRlVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRub0JhY2tncm91bmQ6IHRydWVcclxuXHRcdH0pKTtcclxuXHJcblx0XHRjb25zdCBwc2QyID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbignb3V0cHV0LnBzZCcpLCB7IC4uLm9wdHMgfSk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2cocHNkMi53aWR0aCk7XHJcblx0fSk7XHJcblxyXG5cdC8vIHNraXBwaW5nIFwicGF0dGVyblwiIHRlc3QgYmVjYXVzZSBpdCByZXF1aXJlcyB6aXAgY2ltcHJlc3Npb24gb2YgcGF0dGVybnNcclxuXHQvLyBza2lwcGluZyBcImNteWtcIiB0ZXN0IGJlY2F1c2Ugd2UgY2FuJ3QgY29udmVydCBDTVlLIHRvIFJHQlxyXG5cdGZzLnJlYWRkaXJTeW5jKHJlYWRGaWxlc1BhdGgpLmZpbHRlcihmID0+ICEvcGF0dGVybnxjbXlrLy50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0Ly8gZnMucmVhZGRpclN5bmMocmVhZEZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gL2ZpbGwtb3BhY2l0eS8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRcdGl0KGByZWFkcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IGJhc2VQYXRoID0gcGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsIGYpO1xyXG5cdFx0XHRjb25zdCBmaWxlTmFtZSA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnc3JjLnBzYicpKSA/ICdzcmMucHNiJyA6ICdzcmMucHNkJztcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgZmlsZU5hbWUpLCB7IC4uLm9wdHMgfSk7XHJcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gaW1wb3J0UFNEKGJhc2VQYXRoKTtcclxuXHRcdFx0Y29uc3QgaW1hZ2VzID0gbG9hZEltYWdlc0Zyb21EaXJlY3RvcnkoYmFzZVBhdGgpO1xyXG5cdFx0XHRjb25zdCBjb21wYXJlOiB7IG5hbWU6IHN0cmluZzsgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IHVuZGVmaW5lZDsgc2tpcD86IGJvb2xlYW47IH1bXSA9IFtdO1xyXG5cdFx0XHRjb25zdCBjb21wYXJlRmlsZXM6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBVaW50OEFycmF5OyB9W10gPSBbXTtcclxuXHJcblx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBjYW52YXMucG5nYCwgY2FudmFzOiBwc2QuY2FudmFzIH0pO1xyXG5cdFx0XHRwc2QuY2FudmFzID0gdW5kZWZpbmVkO1xyXG5cdFx0XHRkZWxldGUgcHNkLmltYWdlRGF0YTtcclxuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEueG1wTWV0YWRhdGE7XHJcblxyXG5cdFx0XHRsZXQgaSA9IDA7XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBwdXNoTGF5ZXJDYW52YXNlcyhsYXllcnM6IExheWVyW10pIHtcclxuXHRcdFx0XHRmb3IgKGNvbnN0IGwgb2YgbGF5ZXJzKSB7XHJcblx0XHRcdFx0XHRpZiAobC5jaGlsZHJlbikge1xyXG5cdFx0XHRcdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhsLmNoaWxkcmVuKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGxheWVySWQgPSBpKys7XHJcblx0XHRcdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBsYXllci0ke2xheWVySWR9LnBuZ2AsIGNhbnZhczogbC5jYW52YXMgfSk7XHJcblx0XHRcdFx0XHRcdGwuY2FudmFzID0gdW5kZWZpbmVkO1xyXG5cdFx0XHRcdFx0XHRkZWxldGUgbC5pbWFnZURhdGE7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAobC5tYXNrKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGxheWVyLSR7bGF5ZXJJZH0tbWFzay5wbmdgLCBjYW52YXM6IGwubWFzay5jYW52YXMgfSk7XHJcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5jYW52YXM7XHJcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5pbWFnZURhdGE7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChwc2QubGlua2VkRmlsZXMpIHtcclxuXHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgcHNkLmxpbmtlZEZpbGVzKSB7XHJcblx0XHRcdFx0XHRpZiAoZmlsZS5kYXRhKSB7XHJcblx0XHRcdFx0XHRcdGNvbXBhcmVGaWxlcy5wdXNoKHsgbmFtZTogZmlsZS5uYW1lLCBkYXRhOiBmaWxlLmRhdGEgfSk7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSBmaWxlLmRhdGE7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhwc2QuY2hpbGRyZW4gfHwgW10pO1xyXG5cdFx0XHRmcy5ta2RpclN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuXHJcblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXM/LnRodW1ibmFpbCkge1xyXG5cdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6ICd0aHVtYi5wbmcnLCBjYW52YXM6IHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWwsIHNraXA6IHRydWUgfSk7XHJcblx0XHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXMpIGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsUmF3O1xyXG5cclxuXHRcdFx0Y29tcGFyZS5mb3JFYWNoKGkgPT4gc2F2ZUNhbnZhcyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiwgaS5uYW1lKSwgaS5jYW52YXMpKTtcclxuXHRcdFx0Y29tcGFyZUZpbGVzLmZvckVhY2goaSA9PiBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCBpLm5hbWUpLCBpLmRhdGEpKTtcclxuXHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsICdkYXRhLmpzb24nKSwgSlNPTi5zdHJpbmdpZnkocHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMocHNkKTtcclxuXHRcdFx0Y2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhleHBlY3RlZCk7XHJcblxyXG5cdFx0XHRleHBlY3QocHNkKS5lcWwoZXhwZWN0ZWQsIGYpO1xyXG5cdFx0XHRjb21wYXJlLmZvckVhY2goaSA9PiBpLnNraXAgfHwgY29tcGFyZUNhbnZhc2VzKGltYWdlc1tpLm5hbWVdLCBpLmNhbnZhcywgYCR7Zn0vJHtpLm5hbWV9YCkpO1xyXG5cdFx0XHRjb21wYXJlRmlsZXMuZm9yRWFjaChpID0+IGNvbXBhcmVUd29GaWxlcyhwYXRoLmpvaW4oYmFzZVBhdGgsIGkubmFtZSksIGkuZGF0YSwgYCR7Zn0vJHtpLm5hbWV9YCkpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdGZzLnJlYWRkaXJTeW5jKHJlYWRXcml0ZUZpbGVzUGF0aCkuZm9yRWFjaChmID0+IHtcclxuXHRcdC8vIGZzLnJlYWRkaXJTeW5jKHJlYWRXcml0ZUZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gL2Fubm90Ly50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0aXQoYHJlYWRzLXdyaXRlcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IGV4dCA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgJ3NyYy5wc2InKSkgPyAncHNiJyA6ICdwc2QnO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgYHNyYy4ke2V4dH1gKSwge1xyXG5cdFx0XHRcdC4uLm9wdHMsIHVzZUltYWdlRGF0YTogdHJ1ZSwgdXNlUmF3VGh1bWJuYWlsOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZVxyXG5cdFx0XHR9KTtcclxuXHRcdFx0Y29uc3QgYWN0dWFsID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgcHNiOiBleHQgPT09ICdwc2InIH0pO1xyXG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCBgZXhwZWN0ZWQuJHtleHR9YCkpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LiR7ZXh0fWApLCBhY3R1YWwpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LmJpbmApLCBhY3R1YWwpO1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdFx0Ly8gY29uc3QgcHNkMiA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYHJlYWQtd3JpdGUtJHtmfS5wc2RgKSwgeyAuLi5vcHRzLCB1c2VJbWFnZURhdGE6IHRydWUsIHVzZVJhd1RodW1ibmFpbDogdHJ1ZSB9KTtcclxuXHRcdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wMi50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QyLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdGNvbXBhcmVCdWZmZXJzKGFjdHVhbCwgZXhwZWN0ZWQsIGByZWFkLXdyaXRlLSR7Zn1gLCAwKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd3cml0ZSB0ZXh0IGxheWVyIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0d2lkdGg6IDIwMCxcclxuXHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bmFtZTogJ3RleHQgbGF5ZXInLFxyXG5cdFx0XHRcdFx0dGV4dDoge1xyXG5cdFx0XHRcdFx0XHR0ZXh0OiAnSGVsbG8gV29ybGRcXG7igKIgYyDigKIgdGlueSFcXHJcXG50ZXN0JyxcclxuXHRcdFx0XHRcdFx0Ly8gb3JpZW50YXRpb246ICd2ZXJ0aWNhbCcsXHJcblx0XHRcdFx0XHRcdHRyYW5zZm9ybTogWzEsIDAsIDAsIDEsIDcwLCA3MF0sXHJcblx0XHRcdFx0XHRcdHN0eWxlOiB7XHJcblx0XHRcdFx0XHRcdFx0Zm9udDogeyBuYW1lOiAnQXJpYWxNVCcgfSxcclxuXHRcdFx0XHRcdFx0XHRmb250U2l6ZTogMzAsXHJcblx0XHRcdFx0XHRcdFx0ZmlsbENvbG9yOiB7IHI6IDAsIGc6IDEyOCwgYjogMCB9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRzdHlsZVJ1bnM6IFtcclxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogMTIsIHN0eWxlOiB7IGZpbGxDb2xvcjogeyByOiAyNTUsIGc6IDAsIGI6IDAgfSB9IH0sXHJcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDEyLCBzdHlsZTogeyBmaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMjU1IH0gfSB9LFxyXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiA0LCBzdHlsZTogeyB1bmRlcmxpbmU6IHRydWUgfSB9LFxyXG5cdFx0XHRcdFx0XHRdLFxyXG5cdFx0XHRcdFx0XHRwYXJhZ3JhcGhTdHlsZToge1xyXG5cdFx0XHRcdFx0XHRcdGp1c3RpZmljYXRpb246ICdjZW50ZXInLFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR3YXJwOiB7XHJcblx0XHRcdFx0XHRcdFx0c3R5bGU6ICdhcmMnLFxyXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiA1MCxcclxuXHRcdFx0XHRcdFx0XHRwZXJzcGVjdGl2ZTogMCxcclxuXHRcdFx0XHRcdFx0XHRwZXJzcGVjdGl2ZU90aGVyOiAwLFxyXG5cdFx0XHRcdFx0XHRcdHJvdGF0ZTogJ2hvcml6b250YWwnLFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG5hbWU6ICcybmQgbGF5ZXInLFxyXG5cdFx0XHRcdFx0dGV4dDoge1xyXG5cdFx0XHRcdFx0XHR0ZXh0OiAnQWFhYWEnLFxyXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm06IFsxLCAwLCAwLCAxLCA3MCwgNzBdLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0fTtcclxuXHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCAnX1RFWFQyLnBzZCcpLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgncmVhZCB0ZXh0IGxheWVyIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXh0LXRlc3QucHNkJyksIG9wdHMpO1xyXG5cdFx0Ly8gY29uc3QgbGF5ZXIgPSBwc2QuY2hpbGRyZW4hWzFdO1xyXG5cclxuXHRcdC8vIGxheWVyLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XHJcblx0XHRjb25zdCBidWZmZXIgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgJ19URVhULnBzZCcpLCBidWZmZXIpO1xyXG5cclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5jaGlsZHJlbiFbMF0udGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzFdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnUkVBRCBURVNUJywgKCkgPT4ge1xyXG5cdFx0Y29uc3Qgb3JpZ2luYWxCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXN0LnBzZCcpKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnUkVBRElORyBPUklHSU5BTCcpO1xyXG5cdFx0Y29uc3Qgb3B0cyA9IHtcclxuXHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dXNlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHR1c2VSYXdUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0fTtcclxuXHRcdGNvbnN0IG9yaWdpbmFsUHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIob3JpZ2luYWxCdWZmZXIpLCBvcHRzKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnV1JJVElORycpO1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIob3JpZ2luYWxQc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGVtcC5wc2QnLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5iaW4nLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpLCAndXRmOCcpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC54bWwnLCBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcz8ueG1wTWV0YWRhdGEsICd1dGY4Jyk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1JFQURJTkcgV1JJVFRFTicpO1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKFxyXG5cdFx0XHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhvcmlnaW5hbFBzZCk7XHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhwc2QpO1xyXG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KG9yaWdpbmFsUHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCdvcmlnaW5hbC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ2FmdGVyLmpzb24nLCBKU09OLnN0cmluZ2lmeShwc2QsIG51bGwsIDIpKTtcclxuXHJcblx0XHRjb21wYXJlQnVmZmVycyhidWZmZXIsIG9yaWdpbmFsQnVmZmVyLCAndGVzdCcpO1xyXG5cclxuXHRcdGV4cGVjdChwc2QpLmVxbChvcmlnaW5hbFBzZCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2RlY29kZSBlbmdpbmUgZGF0YSAyJywgKCkgPT4ge1xyXG5cdFx0Ly8gY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICdlbmdpbmVEYXRhMlZlcnRpY2FsLnR4dCcpKTtcclxuXHRcdGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJTaW1wbGUudHh0JykpO1xyXG5cdFx0Y29uc3QgZnVuYyA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZmlsZURhdGF9O2ApO1xyXG5cdFx0Y29uc3QgZGF0YSA9IGZ1bmMoKTtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IGRlY29kZUVuZ2luZURhdGEyKGRhdGEpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcclxuXHRcdFx0cGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICd0ZW1wLmpzJyksXHJcblx0XHRcdCd2YXIgeCA9ICcgKyByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChyZXN1bHQsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXN0LnBzZCcsICgpID0+IHtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGVzdC5wc2QnKTtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHR9KTtcclxuXHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApKSwge1xyXG5cdFx0XHQvLyBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0fSk7XHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKCd0ZXh0X3JlY3Rfb3V0LnBzZCcsIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGV4dF9yZWN0X291dC5iaW4nLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHRcdC8vIGNvbnN0IHBzZDIgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYHRleHRfcmVjdF9vdXQucHNkYCkpLCB7XHJcblx0XHQvLyBcdC8vIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHQvLyBcdC8vIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdC8vIFx0Ly8gc2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdC8vIFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHQvLyBcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0Ly8gfSk7XHJcblx0XHQvLyBwc2QyO1xyXG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBmcy5yZWFkRmlsZVN5bmMoYHRlc3QvcmVhZC13cml0ZS90ZXh0LWJveC9zcmMucHNkYCk7XHJcblx0XHRjb25zdCBvdXRwdXQgPSBmcy5yZWFkRmlsZVN5bmMoYHRleHRfcmVjdF9vdXQucHNkYCk7XHJcblx0XHRjb21wYXJlQnVmZmVycyhvdXRwdXQsIG9yaWdpbmFsLCAnLScsIDB4NjVkOCk7IC8vICwgMHg4Y2U4LCAweDhmY2EgLSAweDhjZTgpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdjb21wYXJlIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgWyd0ZXh0X3BvaW50JywgJ3RleHRfcmVjdCddKSB7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgJHtuYW1lfS5wc2RgKSksIHtcclxuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR9KTtcclxuXHRcdFx0Ly8gcHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX0udHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdC8vIGNvbnN0IGVuZ2luZURhdGEgPSBwYXJzZUVuZ2luZURhdGEodG9CeXRlQXJyYXkocHNkLmVuZ2luZURhdGEhKSk7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX1fZW5naW5lZGF0YS50eHRgLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGV4dC1yZXBsYWNlLnBzZCcsICgpID0+IHtcclxuXHRcdHtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCd0ZXh0LXJlcGxhY2UyLnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7fSk7XHJcblx0XHRcdHBzZC5jaGlsZHJlbiFbMV0hLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XHJcblx0XHRcdGNvbnN0IG91dHB1dCA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBpbnZhbGlkYXRlVGV4dExheWVyczogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXQucHNkJywgb3V0cHV0KTtcclxuXHRcdH1cclxuXHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlLnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdpbnB1dC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCdvdXQucHNkJyk7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR9KTtcclxuXHRcdFx0ZGVsZXRlIHBzZC5lbmdpbmVEYXRhO1xyXG5cdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0cHNkLmNoaWxkcmVuPy5zcGxpY2UoMCwgMSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ291dHB1dC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGNsZWFyRW1wdHlDYW52YXNGaWVsZHMobGF5ZXI6IExheWVyIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKGxheWVyKSB7XHJcblx0XHRpZiAoJ2NhbnZhcycgaW4gbGF5ZXIgJiYgIWxheWVyLmNhbnZhcykgZGVsZXRlIGxheWVyLmNhbnZhcztcclxuXHRcdGlmICgnaW1hZ2VEYXRhJyBpbiBsYXllciAmJiAhbGF5ZXIuaW1hZ2VEYXRhKSBkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xyXG5cdFx0bGF5ZXIuY2hpbGRyZW4/LmZvckVhY2goY2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBjbGVhckNhbnZhc0ZpZWxkcyhsYXllcjogTGF5ZXIgfCB1bmRlZmluZWQpIHtcclxuXHRpZiAobGF5ZXIpIHtcclxuXHRcdGRlbGV0ZSBsYXllci5jYW52YXM7XHJcblx0XHRkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xyXG5cdFx0aWYgKGxheWVyLm1hc2spIGRlbGV0ZSBsYXllci5tYXNrLmNhbnZhcztcclxuXHRcdGlmIChsYXllci5tYXNrKSBkZWxldGUgbGF5ZXIubWFzay5pbWFnZURhdGE7XHJcblx0XHRsYXllci5jaGlsZHJlbj8uZm9yRWFjaChjbGVhckNhbnZhc0ZpZWxkcyk7XHJcblx0fVxyXG59XHJcblxyXG4vLy8gRW5naW5lIGRhdGEgMiBleHBlcmltZW50c1xyXG4vLyAvdGVzdC9lbmdpbmVEYXRhMi5qc29uOjExMDkgaXMgY2hhcmFjdGVyIGNvZGVzXHJcblxyXG5jb25zdCBrZXlzQ29sb3IgPSB7XHJcblx0JzAnOiB7XHJcblx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHQnMCc6IHsgbmFtZTogJ1R5cGUnIH0sXHJcblx0XHRcdCcxJzogeyBuYW1lOiAnVmFsdWVzJyB9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG59O1xyXG5cclxuY29uc3Qga2V5c1N0eWxlU2hlZXQgPSB7XHJcblx0JzAnOiB7IG5hbWU6ICdGb250JyB9LFxyXG5cdCcxJzogeyBuYW1lOiAnRm9udFNpemUnIH0sXHJcblx0JzInOiB7IG5hbWU6ICdGYXV4Qm9sZCcgfSxcclxuXHQnMyc6IHsgbmFtZTogJ0ZhdXhJdGFsaWMnIH0sXHJcblx0JzQnOiB7IG5hbWU6ICdBdXRvTGVhZGluZycgfSxcclxuXHQnNSc6IHsgbmFtZTogJ0xlYWRpbmcnIH0sXHJcblx0JzYnOiB7IG5hbWU6ICdIb3Jpem9udGFsU2NhbGUnIH0sXHJcblx0JzcnOiB7IG5hbWU6ICdWZXJ0aWNhbFNjYWxlJyB9LFxyXG5cdCc4JzogeyBuYW1lOiAnVHJhY2tpbmcnIH0sXHJcblx0JzknOiB7IG5hbWU6ICdCYXNlbGluZVNoaWZ0JyB9LFxyXG5cclxuXHQnMTEnOiB7IG5hbWU6ICdLZXJuaW5nPycgfSwgLy8gZGlmZmVyZW50IHZhbHVlIHRoYW4gRW5naW5lRGF0YVxyXG5cdCcxMic6IHsgbmFtZTogJ0ZvbnRDYXBzJyB9LFxyXG5cdCcxMyc6IHsgbmFtZTogJ0ZvbnRCYXNlbGluZScgfSxcclxuXHJcblx0JzE1JzogeyBuYW1lOiAnU3RyaWtldGhyb3VnaD8nIH0sIC8vIG51bWJlciBpbnN0ZWFkIG9mIGJvb2xcclxuXHQnMTYnOiB7IG5hbWU6ICdVbmRlcmxpbmU/JyB9LCAvLyBudW1iZXIgaW5zdGVhZCBvZiBib29sXHJcblxyXG5cdCcxOCc6IHsgbmFtZTogJ0xpZ2F0dXJlcycgfSxcclxuXHQnMTknOiB7IG5hbWU6ICdETGlnYXR1cmVzJyB9LFxyXG5cclxuXHQnMjMnOiB7IG5hbWU6ICdGcmFjdGlvbnMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHQnMjQnOiB7IG5hbWU6ICdPcmRpbmFscycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMjgnOiB7IG5hbWU6ICdTdHlsaXN0aWNBbHRlcm5hdGVzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCczMCc6IHsgbmFtZTogJ09sZFN0eWxlPycgfSwgLy8gT3BlblR5cGUgPiBPbGRTdHlsZSwgbnVtYmVyIGluc3RlYWQgb2YgYm9vbCwgbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMzUnOiB7IG5hbWU6ICdCYXNlbGluZURpcmVjdGlvbicgfSxcclxuXHJcblx0JzM4JzogeyBuYW1lOiAnTGFuZ3VhZ2UnIH0sXHJcblxyXG5cdCc1Mic6IHsgbmFtZTogJ05vQnJlYWsnIH0sXHJcblx0JzUzJzogeyBuYW1lOiAnRmlsbENvbG9yJywgY2hpbGRyZW46IGtleXNDb2xvciB9LFxyXG59O1xyXG5cclxuY29uc3Qga2V5c1BhcmFncmFwaCA9IHtcclxuXHQnMCc6IHsgbmFtZTogJ0p1c3RpZmljYXRpb24nIH0sXHJcblx0JzEnOiB7IG5hbWU6ICdGaXJzdExpbmVJbmRlbnQnIH0sXHJcblx0JzInOiB7IG5hbWU6ICdTdGFydEluZGVudCcgfSxcclxuXHQnMyc6IHsgbmFtZTogJ0VuZEluZGVudCcgfSxcclxuXHQnNCc6IHsgbmFtZTogJ1NwYWNlQmVmb3JlJyB9LFxyXG5cdCc1JzogeyBuYW1lOiAnU3BhY2VBZnRlcicgfSxcclxuXHJcblx0JzcnOiB7IG5hbWU6ICdBdXRvTGVhZGluZycgfSxcclxuXHJcblx0JzknOiB7IG5hbWU6ICdBdXRvSHlwaGVuYXRlJyB9LFxyXG5cdCcxMCc6IHsgbmFtZTogJ0h5cGhlbmF0ZWRXb3JkU2l6ZScgfSxcclxuXHQnMTEnOiB7IG5hbWU6ICdQcmVIeXBoZW4nIH0sXHJcblx0JzEyJzogeyBuYW1lOiAnUG9zdEh5cGhlbicgfSxcclxuXHQnMTMnOiB7IG5hbWU6ICdDb25zZWN1dGl2ZUh5cGhlbnM/JyB9LCAvLyBkaWZmZXJlbnQgdmFsdWUgdGhhbiBFbmdpbmVEYXRhXHJcblx0JzE0JzogeyBuYW1lOiAnWm9uZScgfSxcclxuXHQnMTUnOiB7IG5hbWU6ICdIeXBlbmF0ZUNhcGl0YWxpemVkV29yZHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzE3JzogeyBuYW1lOiAnV29yZFNwYWNpbmcnIH0sXHJcblx0JzE4JzogeyBuYW1lOiAnTGV0dGVyU3BhY2luZycgfSxcclxuXHQnMTknOiB7IG5hbWU6ICdHbHlwaFNwYWNpbmcnIH0sXHJcblxyXG5cdCczMic6IHsgbmFtZTogJ1N0eWxlU2hlZXQnLCBjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQgfSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNTdHlsZVNoZWV0RGF0YSA9IHtcclxuXHRuYW1lOiAnU3R5bGVTaGVldERhdGEnLFxyXG5cdGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCxcclxufTtcclxuXHJcbmNvbnN0IGtleXMgPSB7XHJcblx0JzAnOiB7XHJcblx0XHRuYW1lOiAnUmVzb3VyY2VEaWN0JyxcclxuXHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdGb250U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzInOiB7IG5hbWU6ICdGb250VHlwZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcyJzoge1xyXG5cdFx0XHRcdG5hbWU6ICcyJyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge30sXHJcblx0XHRcdH0sXHJcblx0XHRcdCczJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdNb2ppS3VtaVNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ0ludGVybmFsTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzQnOiB7XHJcblx0XHRcdFx0bmFtZTogJ0tpbnNva3VTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTm9TdGFydCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnTm9FbmQnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMic6IHsgbmFtZTogJ0tlZXAnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMyc6IHsgbmFtZTogJ0hhbmdpbmcnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXRTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzYnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1Byb3BlcnRpZXMnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IHsgbmFtZTogJ0RlZmF1bHRTdHlsZVNoZWV0JyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnOCc6IHtcclxuXHRcdFx0XHRuYW1lOiAnOCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnOSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnUHJlZGVmaW5lZCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG5cdCcxJzoge1xyXG5cdFx0bmFtZTogJ0VuZ2luZURpY3QnLFxyXG5cdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0bmFtZTogJzAnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJzAnLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCczJzogeyBuYW1lOiAnU3VwZXJzY3JpcHRTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzQnOiB7IG5hbWU6ICdTdXBlcnNjcmlwdFBvc2l0aW9uJyB9LFxyXG5cdFx0XHRcdFx0JzUnOiB7IG5hbWU6ICdTdWJzY3JpcHRTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICdTdWJzY3JpcHRQb3NpdGlvbicgfSxcclxuXHRcdFx0XHRcdCc3JzogeyBuYW1lOiAnU21hbGxDYXBTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzgnOiB7IG5hbWU6ICdVc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHMnIH0sIC8vID8/P1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdFZGl0b3JzPycsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAnRWRpdG9yJyxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ1RleHQnIH0sXHJcblx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoUnVuJyxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdSdW5BcnJheScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICcwJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnNScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnNicgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ1J1bkxlbmd0aCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdCc2Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1N0eWxlUnVuJyxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdSdW5BcnJheScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnU3R5bGVTaGVldCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ1J1bkxlbmd0aCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAnRm9udFZlY3RvckRhdGEgPz8/JyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzInOiB7XHJcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzMnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxufTtcclxuXHJcbmZ1bmN0aW9uIGRlY29kZU9iaihvYmo6IGFueSwga2V5czogYW55KTogYW55IHtcclxuXHRpZiAob2JqID09PSBudWxsIHx8ICFrZXlzKSByZXR1cm4gb2JqO1xyXG5cclxuXHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XHJcblx0XHRyZXR1cm4gb2JqLm1hcCh4ID0+IGRlY29kZU9iaih4LCBrZXlzKSk7XHJcblx0fVxyXG5cclxuXHRpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHJldHVybiBvYmo7XHJcblxyXG5cdGNvbnN0IHJlc3VsdDogYW55ID0ge307XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcclxuXHRcdGlmIChrZXlzW2tleV0pIHtcclxuXHRcdFx0aWYgKGtleXNba2V5XS51cHJvb3QpIHtcclxuXHRcdFx0XHRyZXR1cm4gZGVjb2RlT2JqKG9ialtrZXldLCBrZXlzW2tleV0uY2hpbGRyZW4pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJlc3VsdFtrZXlzW2tleV0ubmFtZV0gPSBkZWNvZGVPYmoob2JqW2tleV0sIGtleXNba2V5XS5jaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0gb2JqW2tleV07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVFbmdpbmVEYXRhMihkYXRhOiBhbnkpIHtcclxuXHRyZXR1cm4gZGVjb2RlT2JqKGRhdGEsIGtleXMpO1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
