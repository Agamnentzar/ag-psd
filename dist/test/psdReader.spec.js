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
        // fs.readdirSync(readFilesPath).filter(f => /krita/.test(f)).forEach(f => {
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
                    var layerId = i;
                    if (!l.children || l.mask)
                        i++;
                    if (l.children) {
                        pushLayerCanvases(l.children);
                    }
                    else {
                        compare.push({ name: "layer-".concat(layerId, ".png"), canvas: l.canvas });
                        l.canvas = undefined;
                        delete l.imageData;
                    }
                    if (l.mask) {
                        compare.push({ name: "layer-".concat(layerId, "-mask.png"), canvas: l.mask.canvas });
                        delete l.mask.canvas;
                        delete l.mask.imageData;
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
        // fs.readdirSync(readWriteFilesPath).filter(f => /^test$/.test(f)).forEach(f => {
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
            (0, common_1.compareBuffers)(actual, expected, "read-write-".concat(f), 0x0);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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TSxNQUFNLEdBQVEsRUFBRSxDQUFDO0lBRXZCLEtBQWtCLFVBQWdCLEVBQWhCLEtBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBaEIsY0FBZ0IsRUFBaEIsSUFBZ0IsRUFBRTtRQUEvQixJQUFNLEdBQUcsU0FBQTtRQUNiLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ2QsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFO2dCQUNyQixPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQy9DO2lCQUFNO2dCQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDakU7U0FDRDthQUFNO1lBQ04sTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUN2QjtLQUNEO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFTO0lBQ25DLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM5QixDQUFDIiwiZmlsZSI6InRlc3QvcHNkUmVhZGVyLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQge1xyXG5cdHJlYWRQc2RGcm9tRmlsZSwgaW1wb3J0UFNELCBsb2FkSW1hZ2VzRnJvbURpcmVjdG9yeSwgY29tcGFyZUNhbnZhc2VzLCBzYXZlQ2FudmFzLFxyXG5cdGNyZWF0ZVJlYWRlckZyb21CdWZmZXIsIGNvbXBhcmVCdWZmZXJzLCBjb21wYXJlVHdvRmlsZXNcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IExheWVyLCBSZWFkT3B0aW9ucywgUHNkIH0gZnJvbSAnLi4vcHNkJztcclxuaW1wb3J0IHsgcmVhZFBzZCwgd3JpdGVQc2RCdWZmZXIgfSBmcm9tICcuLi9pbmRleCc7XHJcbmltcG9ydCB7IHJlYWRQc2QgYXMgcmVhZFBzZEludGVybmFsIH0gZnJvbSAnLi4vcHNkUmVhZGVyJztcclxuXHJcbmNvbnN0IHRlc3RGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcpO1xyXG5jb25zdCByZWFkRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkJyk7XHJcbmNvbnN0IHJlYWRXcml0ZUZpbGVzUGF0aCA9IHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAncmVhZC13cml0ZScpO1xyXG5jb25zdCByZXN1bHRzRmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc3VsdHMnKTtcclxuY29uc3Qgb3B0czogUmVhZE9wdGlvbnMgPSB7XHJcblx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0bG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZGVzY3JpYmUoJ1BzZFJlYWRlcicsICgpID0+IHtcclxuXHRpdCgncmVhZHMgd2lkdGggYW5kIGhlaWdodCBwcm9wZXJseScsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2JsZW5kLW1vZGUnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMgfSk7XHJcblx0XHRjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkuZXF1YWwoMzAwKTtcclxuXHRcdGV4cGVjdChwc2QuaGVpZ2h0KS5lcXVhbCgyMDApO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgnc2tpcHMgY29tcG9zaXRlIGltYWdlIGRhdGEnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMsIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUgfSk7XHJcblx0XHRleHBlY3QocHNkLmNhbnZhcykubm90Lm9rO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgnZmV0Y2hlcyBhIGxheWVyIGdyb3VwJywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbmVzdGVkLWxheWVycycsICdzcmMucHNkJyksIHsgLi4ub3B0cywgc2tpcExheWVySW1hZ2VEYXRhOiB0cnVlIH0pO1xyXG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMl0ubmFtZSkudG8uZXF1YWwoJ0dyb3VwIDEnKTtcclxuXHRcdGV4cGVjdChwc2QuY2hpbGRyZW4hWzJdLmNoaWxkcmVuIVswXS5uYW1lKS50by5lcXVhbCgnR3JvdXBDaGlsZDEnKTtcclxuXHRcdGV4cGVjdChwc2QuY2hpbGRyZW4hWzJdLmNoaWxkcmVuIVswXS5wYXJlbnRJZCkudG8uZXF1YWwoNSk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdyZWFkcyBQU0QgZnJvbSBCdWZmZXIgd2l0aCBvZmZzZXQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBmaWxlID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSk7XHJcblx0XHRjb25zdCBvdXRlciA9IEJ1ZmZlci5hbGxvYyhmaWxlLmJ5dGVMZW5ndGggKyAxMDApO1xyXG5cdFx0ZmlsZS5jb3B5KG91dGVyLCAxMDApO1xyXG5cdFx0Y29uc3QgaW5uZXIgPSBCdWZmZXIuZnJvbShvdXRlci5idWZmZXIsIDEwMCwgZmlsZS5ieXRlTGVuZ3RoKTtcclxuXHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkKGlubmVyLCBvcHRzKTtcclxuXHJcblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdkdXBsaWNhdGUgc21hcnQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKCdyZXNvdXJjZXMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMgfSk7XHJcblxyXG5cdFx0Y29uc3QgY2hpbGQgPSBwc2QuY2hpbGRyZW4hWzFdLmNoaWxkcmVuIVswXTtcclxuXHRcdHBzZC5jaGlsZHJlbiFbMV0uY2hpbGRyZW4hLnB1c2goY2hpbGQpO1xyXG5cclxuXHRcdC8vIGNvbnN0IGNoaWxkID0gcHNkLmNoaWxkcmVuIVswXTtcclxuXHRcdC8vIGRlbGV0ZSBjaGlsZC5pZDtcclxuXHRcdC8vIHBzZC5jaGlsZHJlbiEucHVzaChjaGlsZCk7XHJcblxyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0cHV0LnBzZCcsIHdyaXRlUHNkQnVmZmVyKHBzZCwge1xyXG5cdFx0XHR0cmltSW1hZ2VEYXRhOiBmYWxzZSxcclxuXHRcdFx0Z2VuZXJhdGVUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdG5vQmFja2dyb3VuZDogdHJ1ZVxyXG5cdFx0fSkpO1xyXG5cclxuXHRcdGNvbnN0IHBzZDIgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKCdvdXRwdXQucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHJcblx0XHRjb25zb2xlLmxvZyhwc2QyLndpZHRoKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gc2tpcHBpbmcgXCJwYXR0ZXJuXCIgdGVzdCBiZWNhdXNlIGl0IHJlcXVpcmVzIHppcCBjaW1wcmVzc2lvbiBvZiBwYXR0ZXJuc1xyXG5cdC8vIHNraXBwaW5nIFwiY215a1wiIHRlc3QgYmVjYXVzZSB3ZSBjYW4ndCBjb252ZXJ0IENNWUsgdG8gUkdCXHJcblx0ZnMucmVhZGRpclN5bmMocmVhZEZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gIS9wYXR0ZXJufGNteWsvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHQvLyBmcy5yZWFkZGlyU3luYyhyZWFkRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAva3JpdGEvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHRpdChgcmVhZHMgUFNEIGZpbGUgKCR7Zn0pYCwgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCBmKTtcclxuXHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ3NyYy5wc2InKSkgPyAnc3JjLnBzYicgOiAnc3JjLnBzZCc7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsIGZpbGVOYW1lKSwgeyAuLi5vcHRzIH0pO1xyXG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGltcG9ydFBTRChiYXNlUGF0aCk7XHJcblx0XHRcdGNvbnN0IGltYWdlcyA9IGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5KGJhc2VQYXRoKTtcclxuXHRcdFx0Y29uc3QgY29tcGFyZTogeyBuYW1lOiBzdHJpbmc7IGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQ7IHNraXA/OiBib29sZWFuOyB9W10gPSBbXTtcclxuXHRcdFx0Y29uc3QgY29tcGFyZUZpbGVzOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogVWludDhBcnJheTsgfVtdID0gW107XHJcblxyXG5cdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgY2FudmFzLnBuZ2AsIGNhbnZhczogcHNkLmNhbnZhcyB9KTtcclxuXHRcdFx0cHNkLmNhbnZhcyA9IHVuZGVmaW5lZDtcclxuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZURhdGE7XHJcblx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnhtcE1ldGFkYXRhO1xyXG5cclxuXHRcdFx0bGV0IGkgPSAwO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gcHVzaExheWVyQ2FudmFzZXMobGF5ZXJzOiBMYXllcltdKSB7XHJcblx0XHRcdFx0Zm9yIChjb25zdCBsIG9mIGxheWVycykge1xyXG5cdFx0XHRcdFx0Y29uc3QgbGF5ZXJJZCA9IGk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCFsLmNoaWxkcmVuIHx8IGwubWFzaykgaSsrO1xyXG5cclxuXHRcdFx0XHRcdGlmIChsLmNoaWxkcmVuKSB7XHJcblx0XHRcdFx0XHRcdHB1c2hMYXllckNhbnZhc2VzKGwuY2hpbGRyZW4pO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGxheWVyLSR7bGF5ZXJJZH0ucG5nYCwgY2FudmFzOiBsLmNhbnZhcyB9KTtcclxuXHRcdFx0XHRcdFx0bC5jYW52YXMgPSB1bmRlZmluZWQ7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSBsLmltYWdlRGF0YTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAobC5tYXNrKSB7XHJcblx0XHRcdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBsYXllci0ke2xheWVySWR9LW1hc2sucG5nYCwgY2FudmFzOiBsLm1hc2suY2FudmFzIH0pO1xyXG5cdFx0XHRcdFx0XHRkZWxldGUgbC5tYXNrLmNhbnZhcztcclxuXHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5pbWFnZURhdGE7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmxpbmtlZEZpbGVzKSB7XHJcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHBzZC5saW5rZWRGaWxlcykge1xyXG5cdFx0XHRcdFx0aWYgKGZpbGUuZGF0YSkge1xyXG5cdFx0XHRcdFx0XHRjb21wYXJlRmlsZXMucHVzaCh7IG5hbWU6IGZpbGUubmFtZSwgZGF0YTogZmlsZS5kYXRhIH0pO1xyXG5cdFx0XHRcdFx0XHRkZWxldGUgZmlsZS5kYXRhO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cHVzaExheWVyQ2FudmFzZXMocHNkLmNoaWxkcmVuIHx8IFtdKTtcclxuXHRcdFx0ZnMubWtkaXJTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcblxyXG5cdFx0XHRpZiAocHNkLmltYWdlUmVzb3VyY2VzPy50aHVtYm5haWwpIHtcclxuXHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiAndGh1bWIucG5nJywgY2FudmFzOiBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsLCBza2lwOiB0cnVlIH0pO1xyXG5cdFx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmltYWdlUmVzb3VyY2VzKSBkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbFJhdztcclxuXHJcblx0XHRcdGNvbXBhcmUuZm9yRWFjaChpID0+IHNhdmVDYW52YXMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsIGkubmFtZSksIGkuY2FudmFzKSk7XHJcblx0XHRcdGNvbXBhcmVGaWxlcy5mb3JFYWNoKGkgPT4gZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiwgaS5uYW1lKSwgaS5kYXRhKSk7XHJcblxyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCAnZGF0YS5qc29uJyksIEpTT04uc3RyaW5naWZ5KHBzZCwgbnVsbCwgMiksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHRjbGVhckVtcHR5Q2FudmFzRmllbGRzKHBzZCk7XHJcblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMoZXhwZWN0ZWQpO1xyXG5cclxuXHRcdFx0ZXhwZWN0KHBzZCkuZXFsKGV4cGVjdGVkLCBmKTtcclxuXHRcdFx0Y29tcGFyZS5mb3JFYWNoKGkgPT4gaS5za2lwIHx8IGNvbXBhcmVDYW52YXNlcyhpbWFnZXNbaS5uYW1lXSwgaS5jYW52YXMsIGAke2Z9LyR7aS5uYW1lfWApKTtcclxuXHRcdFx0Y29tcGFyZUZpbGVzLmZvckVhY2goaSA9PiBjb21wYXJlVHdvRmlsZXMocGF0aC5qb2luKGJhc2VQYXRoLCBpLm5hbWUpLCBpLmRhdGEsIGAke2Z9LyR7aS5uYW1lfWApKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cclxuXHRmcy5yZWFkZGlyU3luYyhyZWFkV3JpdGVGaWxlc1BhdGgpLmZvckVhY2goZiA9PiB7XHJcblx0XHQvLyBmcy5yZWFkZGlyU3luYyhyZWFkV3JpdGVGaWxlc1BhdGgpLmZpbHRlcihmID0+IC9edGVzdCQvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHRpdChgcmVhZHMtd3JpdGVzIFBTRCBmaWxlICgke2Z9KWAsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgZXh0ID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCAnc3JjLnBzYicpKSA/ICdwc2InIDogJ3BzZCc7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCBgc3JjLiR7ZXh0fWApLCB7XHJcblx0XHRcdFx0Li4ub3B0cywgdXNlSW1hZ2VEYXRhOiB0cnVlLCB1c2VSYXdUaHVtYm5haWw6IHRydWUsIHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRjb25zdCBhY3R1YWwgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCBwc2I6IGV4dCA9PT0gJ3BzYicgfSk7XHJcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyZWFkV3JpdGVGaWxlc1BhdGgsIGYsIGBleHBlY3RlZC4ke2V4dH1gKSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0uJHtleHR9YCksIGFjdHVhbCk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0uYmluYCksIGFjdHVhbCk7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0XHQvLyBjb25zdCBwc2QyID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LnBzZGApLCB7IC4uLm9wdHMsIHVzZUltYWdlRGF0YTogdHJ1ZSwgdXNlUmF3VGh1bWJuYWlsOiB0cnVlIH0pO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAyLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZDIsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cclxuXHRcdFx0Y29tcGFyZUJ1ZmZlcnMoYWN0dWFsLCBleHBlY3RlZCwgYHJlYWQtd3JpdGUtJHtmfWAsIDB4MCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnd3JpdGUgdGV4dCBsYXllciB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAyMDAsXHJcblx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG5hbWU6ICd0ZXh0IGxheWVyJyxcclxuXHRcdFx0XHRcdHRleHQ6IHtcclxuXHRcdFx0XHRcdFx0dGV4dDogJ0hlbGxvIFdvcmxkXFxu4oCiIGMg4oCiIHRpbnkhXFxyXFxudGVzdCcsXHJcblx0XHRcdFx0XHRcdC8vIG9yaWVudGF0aW9uOiAndmVydGljYWwnLFxyXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm06IFsxLCAwLCAwLCAxLCA3MCwgNzBdLFxyXG5cdFx0XHRcdFx0XHRzdHlsZToge1xyXG5cdFx0XHRcdFx0XHRcdGZvbnQ6IHsgbmFtZTogJ0FyaWFsTVQnIH0sXHJcblx0XHRcdFx0XHRcdFx0Zm9udFNpemU6IDMwLFxyXG5cdFx0XHRcdFx0XHRcdGZpbGxDb2xvcjogeyByOiAwLCBnOiAxMjgsIGI6IDAgfSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0c3R5bGVSdW5zOiBbXHJcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDEyLCBzdHlsZTogeyBmaWxsQ29sb3I6IHsgcjogMjU1LCBnOiAwLCBiOiAwIH0gfSB9LFxyXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiAxMiwgc3R5bGU6IHsgZmlsbENvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDI1NSB9IH0gfSxcclxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogNCwgc3R5bGU6IHsgdW5kZXJsaW5lOiB0cnVlIH0gfSxcclxuXHRcdFx0XHRcdFx0XSxcclxuXHRcdFx0XHRcdFx0cGFyYWdyYXBoU3R5bGU6IHtcclxuXHRcdFx0XHRcdFx0XHRqdXN0aWZpY2F0aW9uOiAnY2VudGVyJyxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0d2FycDoge1xyXG5cdFx0XHRcdFx0XHRcdHN0eWxlOiAnYXJjJyxcclxuXHRcdFx0XHRcdFx0XHR2YWx1ZTogNTAsXHJcblx0XHRcdFx0XHRcdFx0cGVyc3BlY3RpdmU6IDAsXHJcblx0XHRcdFx0XHRcdFx0cGVyc3BlY3RpdmVPdGhlcjogMCxcclxuXHRcdFx0XHRcdFx0XHRyb3RhdGU6ICdob3Jpem9udGFsJyxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRuYW1lOiAnMm5kIGxheWVyJyxcclxuXHRcdFx0XHRcdHRleHQ6IHtcclxuXHRcdFx0XHRcdFx0dGV4dDogJ0FhYWFhJyxcclxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiBbMSwgMCwgMCwgMSwgNzAsIDcwXSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XSxcclxuXHRcdH07XHJcblxyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgJ19URVhUMi5wc2QnKSwgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3JlYWQgdGV4dCBsYXllciB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGV4dC10ZXN0LnBzZCcpLCBvcHRzKTtcclxuXHRcdC8vIGNvbnN0IGxheWVyID0gcHNkLmNoaWxkcmVuIVsxXTtcclxuXHJcblx0XHQvLyBsYXllci50ZXh0IS50ZXh0ID0gJ0ZvbyBiYXInO1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsICdfVEVYVC5wc2QnKSwgYnVmZmVyKTtcclxuXHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzBdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLmNoaWxkcmVuIVsxXS50ZXh0LCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ1JFQUQgVEVTVCcsICgpID0+IHtcclxuXHRcdGNvbnN0IG9yaWdpbmFsQnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGVzdC5wc2QnKSk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1JFQURJTkcgT1JJR0lOQUwnKTtcclxuXHRcdGNvbnN0IG9wdHMgPSB7XHJcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdHVzZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdH07XHJcblx0XHRjb25zdCBvcmlnaW5hbFBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKG9yaWdpbmFsQnVmZmVyKSwgb3B0cyk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1dSSVRJTkcnKTtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKG9yaWdpbmFsUHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAucHNkJywgYnVmZmVyKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuYmluJywgYnVmZmVyKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAueG1sJywgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXM/LnhtcE1ldGFkYXRhLCAndXRmOCcpO1xyXG5cclxuXHRcdGNvbnNvbGUubG9nKCdSRUFESU5HIFdSSVRURU4nKTtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChcclxuXHRcdFx0Y3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcblxyXG5cdFx0Y2xlYXJDYW52YXNGaWVsZHMob3JpZ2luYWxQc2QpO1xyXG5cdFx0Y2xlYXJDYW52YXNGaWVsZHMocHNkKTtcclxuXHRcdGRlbGV0ZSBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsO1xyXG5cdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsO1xyXG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XHJcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChvcmlnaW5hbFBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygnb3JpZ2luYWwuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSk7XHJcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCdhZnRlci5qc29uJywgSlNPTi5zdHJpbmdpZnkocHNkLCBudWxsLCAyKSk7XHJcblxyXG5cdFx0Y29tcGFyZUJ1ZmZlcnMoYnVmZmVyLCBvcmlnaW5hbEJ1ZmZlciwgJ3Rlc3QnKTtcclxuXHJcblx0XHRleHBlY3QocHNkKS5lcWwob3JpZ2luYWxQc2QpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdkZWNvZGUgZW5naW5lIGRhdGEgMicsICgpID0+IHtcclxuXHRcdC8vIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJWZXJ0aWNhbC50eHQnKSk7XHJcblx0XHRjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzb3VyY2VzJywgJ2VuZ2luZURhdGEyU2ltcGxlLnR4dCcpKTtcclxuXHRcdGNvbnN0IGZ1bmMgPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2ZpbGVEYXRhfTtgKTtcclxuXHRcdGNvbnN0IGRhdGEgPSBmdW5jKCk7XHJcblx0XHRjb25zdCByZXN1bHQgPSBkZWNvZGVFbmdpbmVEYXRhMihkYXRhKTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoXHJcblx0XHRcdHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAndGVtcC5qcycpLFxyXG5cdFx0XHQndmFyIHggPSAnICsgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocmVzdWx0LCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGVzdC5wc2QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3Rlc3QucHNkJyk7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0fSk7XHJcblx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XHJcblx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGVzdCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgdGVzdC9yZWFkLXdyaXRlL3RleHQtYm94L3NyYy5wc2RgKSksIHtcclxuXHRcdFx0Ly8gc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0Ly8gc2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHQvLyBza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdHVzZVJhd1RodW1ibmFpbDogdHJ1ZSxcclxuXHRcdH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGV4dF9yZWN0X291dC5wc2QnLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RleHRfcmVjdF9vdXQuYmluJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XHJcblx0XHQvLyBjb25zdCBwc2QyID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApKSwge1xyXG5cdFx0Ly8gXHQvLyBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0Ly8gXHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHQvLyBcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHQvLyBcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0Ly8gXHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdC8vIH0pO1xyXG5cdFx0Ly8gcHNkMjtcclxuXHRcdGNvbnN0IG9yaWdpbmFsID0gZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApO1xyXG5cdFx0Y29uc3Qgb3V0cHV0ID0gZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApO1xyXG5cdFx0Y29tcGFyZUJ1ZmZlcnMob3V0cHV0LCBvcmlnaW5hbCwgJy0nLCAweDY1ZDgpOyAvLyAsIDB4OGNlOCwgMHg4ZmNhIC0gMHg4Y2U4KTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnY29tcGFyZSB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIFsndGV4dF9wb2ludCcsICd0ZXh0X3JlY3QnXSkge1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYCR7bmFtZX0ucHNkYCkpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdC8vIHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9LnR4dGAsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHQvLyBjb25zdCBlbmdpbmVEYXRhID0gcGFyc2VFbmdpbmVEYXRhKHRvQnl0ZUFycmF5KHBzZC5lbmdpbmVEYXRhISkpO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9X2VuZ2luZWRhdGEudHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3RleHQtcmVwbGFjZS5wc2QnLCAoKSA9PiB7XHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlMi5wc2QnKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge30pO1xyXG5cdFx0XHRwc2QuY2hpbGRyZW4hWzFdIS50ZXh0IS50ZXh0ID0gJ0ZvbyBiYXInO1xyXG5cdFx0XHRjb25zdCBvdXRwdXQgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgaW52YWxpZGF0ZVRleHRMYXllcnM6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0LnBzZCcsIG91dHB1dCk7XHJcblx0XHR9XHJcblxyXG5cdFx0e1xyXG5cdFx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3RleHQtcmVwbGFjZS5wc2QnKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge1xyXG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XHJcblx0XHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0XHRwc2QuY2hpbGRyZW4/LnNwbGljZSgwLCAxKTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnaW5wdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygnb3V0LnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXRwdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHR9KTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBjbGVhckVtcHR5Q2FudmFzRmllbGRzKGxheWVyOiBMYXllciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChsYXllcikge1xyXG5cdFx0aWYgKCdjYW52YXMnIGluIGxheWVyICYmICFsYXllci5jYW52YXMpIGRlbGV0ZSBsYXllci5jYW52YXM7XHJcblx0XHRpZiAoJ2ltYWdlRGF0YScgaW4gbGF5ZXIgJiYgIWxheWVyLmltYWdlRGF0YSkgZGVsZXRlIGxheWVyLmltYWdlRGF0YTtcclxuXHRcdGxheWVyLmNoaWxkcmVuPy5mb3JFYWNoKGNsZWFyRW1wdHlDYW52YXNGaWVsZHMpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2xlYXJDYW52YXNGaWVsZHMobGF5ZXI6IExheWVyIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKGxheWVyKSB7XHJcblx0XHRkZWxldGUgbGF5ZXIuY2FudmFzO1xyXG5cdFx0ZGVsZXRlIGxheWVyLmltYWdlRGF0YTtcclxuXHRcdGlmIChsYXllci5tYXNrKSBkZWxldGUgbGF5ZXIubWFzay5jYW52YXM7XHJcblx0XHRpZiAobGF5ZXIubWFzaykgZGVsZXRlIGxheWVyLm1hc2suaW1hZ2VEYXRhO1xyXG5cdFx0bGF5ZXIuY2hpbGRyZW4/LmZvckVhY2goY2xlYXJDYW52YXNGaWVsZHMpO1xyXG5cdH1cclxufVxyXG5cclxuLy8vIEVuZ2luZSBkYXRhIDIgZXhwZXJpbWVudHNcclxuLy8gL3Rlc3QvZW5naW5lRGF0YTIuanNvbjoxMTA5IGlzIGNoYXJhY3RlciBjb2Rlc1xyXG5cclxuY29uc3Qga2V5c0NvbG9yID0ge1xyXG5cdCcwJzoge1xyXG5cdFx0dXByb290OiB0cnVlLFxyXG5cdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0JzAnOiB7IG5hbWU6ICdUeXBlJyB9LFxyXG5cdFx0XHQnMSc6IHsgbmFtZTogJ1ZhbHVlcycgfSxcclxuXHRcdH0sXHJcblx0fSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNTdHlsZVNoZWV0ID0ge1xyXG5cdCcwJzogeyBuYW1lOiAnRm9udCcgfSxcclxuXHQnMSc6IHsgbmFtZTogJ0ZvbnRTaXplJyB9LFxyXG5cdCcyJzogeyBuYW1lOiAnRmF1eEJvbGQnIH0sXHJcblx0JzMnOiB7IG5hbWU6ICdGYXV4SXRhbGljJyB9LFxyXG5cdCc0JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXHJcblx0JzUnOiB7IG5hbWU6ICdMZWFkaW5nJyB9LFxyXG5cdCc2JzogeyBuYW1lOiAnSG9yaXpvbnRhbFNjYWxlJyB9LFxyXG5cdCc3JzogeyBuYW1lOiAnVmVydGljYWxTY2FsZScgfSxcclxuXHQnOCc6IHsgbmFtZTogJ1RyYWNraW5nJyB9LFxyXG5cdCc5JzogeyBuYW1lOiAnQmFzZWxpbmVTaGlmdCcgfSxcclxuXHJcblx0JzExJzogeyBuYW1lOiAnS2VybmluZz8nIH0sIC8vIGRpZmZlcmVudCB2YWx1ZSB0aGFuIEVuZ2luZURhdGFcclxuXHQnMTInOiB7IG5hbWU6ICdGb250Q2FwcycgfSxcclxuXHQnMTMnOiB7IG5hbWU6ICdGb250QmFzZWxpbmUnIH0sXHJcblxyXG5cdCcxNSc6IHsgbmFtZTogJ1N0cmlrZXRocm91Z2g/JyB9LCAvLyBudW1iZXIgaW5zdGVhZCBvZiBib29sXHJcblx0JzE2JzogeyBuYW1lOiAnVW5kZXJsaW5lPycgfSwgLy8gbnVtYmVyIGluc3RlYWQgb2YgYm9vbFxyXG5cclxuXHQnMTgnOiB7IG5hbWU6ICdMaWdhdHVyZXMnIH0sXHJcblx0JzE5JzogeyBuYW1lOiAnRExpZ2F0dXJlcycgfSxcclxuXHJcblx0JzIzJzogeyBuYW1lOiAnRnJhY3Rpb25zJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblx0JzI0JzogeyBuYW1lOiAnT3JkaW5hbHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzI4JzogeyBuYW1lOiAnU3R5bGlzdGljQWx0ZXJuYXRlcycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMzAnOiB7IG5hbWU6ICdPbGRTdHlsZT8nIH0sIC8vIE9wZW5UeXBlID4gT2xkU3R5bGUsIG51bWJlciBpbnN0ZWFkIG9mIGJvb2wsIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzM1JzogeyBuYW1lOiAnQmFzZWxpbmVEaXJlY3Rpb24nIH0sXHJcblxyXG5cdCczOCc6IHsgbmFtZTogJ0xhbmd1YWdlJyB9LFxyXG5cclxuXHQnNTInOiB7IG5hbWU6ICdOb0JyZWFrJyB9LFxyXG5cdCc1Myc6IHsgbmFtZTogJ0ZpbGxDb2xvcicsIGNoaWxkcmVuOiBrZXlzQ29sb3IgfSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNQYXJhZ3JhcGggPSB7XHJcblx0JzAnOiB7IG5hbWU6ICdKdXN0aWZpY2F0aW9uJyB9LFxyXG5cdCcxJzogeyBuYW1lOiAnRmlyc3RMaW5lSW5kZW50JyB9LFxyXG5cdCcyJzogeyBuYW1lOiAnU3RhcnRJbmRlbnQnIH0sXHJcblx0JzMnOiB7IG5hbWU6ICdFbmRJbmRlbnQnIH0sXHJcblx0JzQnOiB7IG5hbWU6ICdTcGFjZUJlZm9yZScgfSxcclxuXHQnNSc6IHsgbmFtZTogJ1NwYWNlQWZ0ZXInIH0sXHJcblxyXG5cdCc3JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXHJcblxyXG5cdCc5JzogeyBuYW1lOiAnQXV0b0h5cGhlbmF0ZScgfSxcclxuXHQnMTAnOiB7IG5hbWU6ICdIeXBoZW5hdGVkV29yZFNpemUnIH0sXHJcblx0JzExJzogeyBuYW1lOiAnUHJlSHlwaGVuJyB9LFxyXG5cdCcxMic6IHsgbmFtZTogJ1Bvc3RIeXBoZW4nIH0sXHJcblx0JzEzJzogeyBuYW1lOiAnQ29uc2VjdXRpdmVIeXBoZW5zPycgfSwgLy8gZGlmZmVyZW50IHZhbHVlIHRoYW4gRW5naW5lRGF0YVxyXG5cdCcxNCc6IHsgbmFtZTogJ1pvbmUnIH0sXHJcblx0JzE1JzogeyBuYW1lOiAnSHlwZW5hdGVDYXBpdGFsaXplZFdvcmRzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCcxNyc6IHsgbmFtZTogJ1dvcmRTcGFjaW5nJyB9LFxyXG5cdCcxOCc6IHsgbmFtZTogJ0xldHRlclNwYWNpbmcnIH0sXHJcblx0JzE5JzogeyBuYW1lOiAnR2x5cGhTcGFjaW5nJyB9LFxyXG5cclxuXHQnMzInOiB7IG5hbWU6ICdTdHlsZVNoZWV0JywgY2hpbGRyZW46IGtleXNTdHlsZVNoZWV0IH0sXHJcbn07XHJcblxyXG5jb25zdCBrZXlzU3R5bGVTaGVldERhdGEgPSB7XHJcblx0bmFtZTogJ1N0eWxlU2hlZXREYXRhJyxcclxuXHRjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQsXHJcbn07XHJcblxyXG5jb25zdCBrZXlzID0ge1xyXG5cdCcwJzoge1xyXG5cdFx0bmFtZTogJ1Jlc291cmNlRGljdCcsXHJcblx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnRm9udFNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcyJzogeyBuYW1lOiAnRm9udFR5cGUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMic6IHtcclxuXHRcdFx0XHRuYW1lOiAnMicsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMyc6IHtcclxuXHRcdFx0XHRuYW1lOiAnTW9qaUt1bWlTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdJbnRlcm5hbE5hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc0Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdLaW5zb2t1U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05vU3RhcnQnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ05vRW5kJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzInOiB7IG5hbWU6ICdLZWVwJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzMnOiB7IG5hbWU6ICdIYW5naW5nJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzYnOiBrZXlzU3R5bGVTaGVldERhdGEsXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc2Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldFNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQcm9wZXJ0aWVzJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICdEZWZhdWx0U3R5bGVTaGVldCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzgnOiB7XHJcblx0XHRcdFx0bmFtZTogJzgnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzknOiB7XHJcblx0XHRcdFx0bmFtZTogJ1ByZWRlZmluZWQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHQnMSc6IHtcclxuXHRcdG5hbWU6ICdFbmdpbmVEaWN0JyxcclxuXHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdG5hbWU6ICcwJyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICcwJyxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnMyc6IHsgbmFtZTogJ1N1cGVyc2NyaXB0U2l6ZScgfSxcclxuXHRcdFx0XHRcdCc0JzogeyBuYW1lOiAnU3VwZXJzY3JpcHRQb3NpdGlvbicgfSxcclxuXHRcdFx0XHRcdCc1JzogeyBuYW1lOiAnU3Vic2NyaXB0U2l6ZScgfSxcclxuXHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnU3Vic2NyaXB0UG9zaXRpb24nIH0sXHJcblx0XHRcdFx0XHQnNyc6IHsgbmFtZTogJ1NtYWxsQ2FwU2l6ZScgfSxcclxuXHRcdFx0XHRcdCc4JzogeyBuYW1lOiAnVXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzJyB9LCAvLyA/Pz9cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnRWRpdG9ycz8nLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ0VkaXRvcicsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdUZXh0JyB9LFxyXG5cdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFJ1bicsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnMCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJzUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNic6IHsgbmFtZTogJzYnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdSdW5MZW5ndGgnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHQnNic6IHtcclxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdTdHlsZVJ1bicsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzYnOiBrZXlzU3R5bGVTaGVldERhdGEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdSdW5MZW5ndGgnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ0ZvbnRWZWN0b3JEYXRhID8/PycsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcyJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQsXHJcblx0XHRcdH0sXHJcblx0XHRcdCczJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcbn07XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVPYmoob2JqOiBhbnksIGtleXM6IGFueSk6IGFueSB7XHJcblx0aWYgKG9iaiA9PT0gbnVsbCB8fCAha2V5cykgcmV0dXJuIG9iajtcclxuXHJcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG5cdFx0cmV0dXJuIG9iai5tYXAoeCA9PiBkZWNvZGVPYmooeCwga2V5cykpO1xyXG5cdH1cclxuXHJcblx0aWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSByZXR1cm4gb2JqO1xyXG5cclxuXHRjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xyXG5cclxuXHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XHJcblx0XHRpZiAoa2V5c1trZXldKSB7XHJcblx0XHRcdGlmIChrZXlzW2tleV0udXByb290KSB7XHJcblx0XHRcdFx0cmV0dXJuIGRlY29kZU9iaihvYmpba2V5XSwga2V5c1trZXldLmNoaWxkcmVuKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyZXN1bHRba2V5c1trZXldLm5hbWVdID0gZGVjb2RlT2JqKG9ialtrZXldLCBrZXlzW2tleV0uY2hpbGRyZW4pO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXN1bHRba2V5XSA9IG9ialtrZXldO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlRW5naW5lRGF0YTIoZGF0YTogYW55KSB7XHJcblx0cmV0dXJuIGRlY29kZU9iaihkYXRhLCBrZXlzKTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
