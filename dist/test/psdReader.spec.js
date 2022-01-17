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
        (0, chai_1.expect)(psd.children[2].children[0].parentPath).to.equal('Group 1');
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
        console.log(require('util').inspect(psd, false, 99, true));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFoQixjQUFnQixFQUFoQixJQUFnQixFQUFFO1FBQS9CLElBQU0sR0FBRyxTQUFBO1FBQ2IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDZCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3JCLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDL0M7aUJBQU07Z0JBQ04sTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNqRTtTQUNEO2FBQU07WUFDTixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3ZCO0tBQ0Q7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVM7SUFDbkMsT0FBTyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJmaWxlIjoidGVzdC9wc2RSZWFkZXIuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XHJcbmltcG9ydCB7XHJcblx0cmVhZFBzZEZyb21GaWxlLCBpbXBvcnRQU0QsIGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5LCBjb21wYXJlQ2FudmFzZXMsIHNhdmVDYW52YXMsXHJcblx0Y3JlYXRlUmVhZGVyRnJvbUJ1ZmZlciwgY29tcGFyZUJ1ZmZlcnMsIGNvbXBhcmVUd29GaWxlc1xyXG59IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0IHsgTGF5ZXIsIFJlYWRPcHRpb25zLCBQc2QgfSBmcm9tICcuLi9wc2QnO1xyXG5pbXBvcnQgeyByZWFkUHNkLCB3cml0ZVBzZEJ1ZmZlciB9IGZyb20gJy4uL2luZGV4JztcclxuaW1wb3J0IHsgcmVhZFBzZCBhcyByZWFkUHNkSW50ZXJuYWwgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xyXG5cclxuY29uc3QgdGVzdEZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0Jyk7XHJcbmNvbnN0IHJlYWRGaWxlc1BhdGggPSBwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3JlYWQnKTtcclxuY29uc3QgcmVhZFdyaXRlRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkLXdyaXRlJyk7XHJcbmNvbnN0IHJlc3VsdHNGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycpO1xyXG5jb25zdCBvcHRzOiBSZWFkT3B0aW9ucyA9IHtcclxuXHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcbn07XHJcblxyXG5kZXNjcmliZSgnUHNkUmVhZGVyJywgKCkgPT4ge1xyXG5cdGl0KCdyZWFkcyB3aWR0aCBhbmQgaGVpZ2h0IHByb3Blcmx5JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnYmxlbmQtbW9kZScsICdzcmMucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHRcdGV4cGVjdChwc2Qud2lkdGgpLmVxdWFsKDMwMCk7XHJcblx0XHRleHBlY3QocHNkLmhlaWdodCkuZXF1YWwoMjAwKTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3NraXBzIGNvbXBvc2l0ZSBpbWFnZSBkYXRhJywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlIH0pO1xyXG5cdFx0ZXhwZWN0KHBzZC5jYW52YXMpLm5vdC5vaztcclxuXHR9KTtcclxuXHJcblx0aXQoJ2ZldGNoZXMgYSBsYXllciBncm91cCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ25lc3RlZC1sYXllcnMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMsIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSB9KTtcclxuXHRcdGV4cGVjdChwc2QuY2hpbGRyZW4hWzJdLm5hbWUpLnRvLmVxdWFsKCdHcm91cCAxJyk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5jaGlsZHJlbiFbMF0ubmFtZSkudG8uZXF1YWwoJ0dyb3VwQ2hpbGQxJyk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5jaGlsZHJlbiFbMF0ucGFyZW50UGF0aCkudG8uZXF1YWwoJ0dyb3VwIDEnKTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3JlYWRzIFBTRCBmcm9tIEJ1ZmZlciB3aXRoIG9mZnNldCcsICgpID0+IHtcclxuXHRcdGNvbnN0IGZpbGUgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpKTtcclxuXHRcdGNvbnN0IG91dGVyID0gQnVmZmVyLmFsbG9jKGZpbGUuYnl0ZUxlbmd0aCArIDEwMCk7XHJcblx0XHRmaWxlLmNvcHkob3V0ZXIsIDEwMCk7XHJcblx0XHRjb25zdCBpbm5lciA9IEJ1ZmZlci5mcm9tKG91dGVyLmJ1ZmZlciwgMTAwLCBmaWxlLmJ5dGVMZW5ndGgpO1xyXG5cclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2QoaW5uZXIsIG9wdHMpO1xyXG5cclxuXHRcdGV4cGVjdChwc2Qud2lkdGgpLmVxdWFsKDMwMCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2R1cGxpY2F0ZSBzbWFydCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oJ3Jlc291cmNlcycsICdzcmMucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHJcblx0XHRjb25zdCBjaGlsZCA9IHBzZC5jaGlsZHJlbiFbMV0uY2hpbGRyZW4hWzBdO1xyXG5cdFx0cHNkLmNoaWxkcmVuIVsxXS5jaGlsZHJlbiEucHVzaChjaGlsZCk7XHJcblxyXG5cdFx0Ly8gY29uc3QgY2hpbGQgPSBwc2QuY2hpbGRyZW4hWzBdO1xyXG5cdFx0Ly8gZGVsZXRlIGNoaWxkLmlkO1xyXG5cdFx0Ly8gcHNkLmNoaWxkcmVuIS5wdXNoKGNoaWxkKTtcclxuXHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXRwdXQucHNkJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7XHJcblx0XHRcdHRyaW1JbWFnZURhdGE6IGZhbHNlLFxyXG5cdFx0XHRnZW5lcmF0ZVRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0bm9CYWNrZ3JvdW5kOiB0cnVlXHJcblx0XHR9KSk7XHJcblxyXG5cdFx0Y29uc3QgcHNkMiA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oJ291dHB1dC5wc2QnKSwgeyAuLi5vcHRzIH0pO1xyXG5cclxuXHRcdGNvbnNvbGUubG9nKHBzZDIud2lkdGgpO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBza2lwcGluZyBcInBhdHRlcm5cIiB0ZXN0IGJlY2F1c2UgaXQgcmVxdWlyZXMgemlwIGNpbXByZXNzaW9uIG9mIHBhdHRlcm5zXHJcblx0Ly8gc2tpcHBpbmcgXCJjbXlrXCIgdGVzdCBiZWNhdXNlIHdlIGNhbid0IGNvbnZlcnQgQ01ZSyB0byBSR0JcclxuXHRmcy5yZWFkZGlyU3luYyhyZWFkRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm58Y215ay8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRcdC8vIGZzLnJlYWRkaXJTeW5jKHJlYWRGaWxlc1BhdGgpLmZpbHRlcihmID0+IC9maWxsLW9wYWNpdHkvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHRpdChgcmVhZHMgUFNEIGZpbGUgKCR7Zn0pYCwgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCBmKTtcclxuXHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ3NyYy5wc2InKSkgPyAnc3JjLnBzYicgOiAnc3JjLnBzZCc7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsIGZpbGVOYW1lKSwgeyAuLi5vcHRzIH0pO1xyXG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGltcG9ydFBTRChiYXNlUGF0aCk7XHJcblx0XHRcdGNvbnN0IGltYWdlcyA9IGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5KGJhc2VQYXRoKTtcclxuXHRcdFx0Y29uc3QgY29tcGFyZTogeyBuYW1lOiBzdHJpbmc7IGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQ7IHNraXA/OiBib29sZWFuOyB9W10gPSBbXTtcclxuXHRcdFx0Y29uc3QgY29tcGFyZUZpbGVzOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogVWludDhBcnJheTsgfVtdID0gW107XHJcblxyXG5cdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgY2FudmFzLnBuZ2AsIGNhbnZhczogcHNkLmNhbnZhcyB9KTtcclxuXHRcdFx0cHNkLmNhbnZhcyA9IHVuZGVmaW5lZDtcclxuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZURhdGE7XHJcblx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnhtcE1ldGFkYXRhO1xyXG5cclxuXHRcdFx0bGV0IGkgPSAwO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gcHVzaExheWVyQ2FudmFzZXMobGF5ZXJzOiBMYXllcltdKSB7XHJcblx0XHRcdFx0Zm9yIChjb25zdCBsIG9mIGxheWVycykge1xyXG5cdFx0XHRcdFx0aWYgKGwuY2hpbGRyZW4pIHtcclxuXHRcdFx0XHRcdFx0cHVzaExheWVyQ2FudmFzZXMobC5jaGlsZHJlbik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBsYXllcklkID0gaSsrO1xyXG5cdFx0XHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgbGF5ZXItJHtsYXllcklkfS5wbmdgLCBjYW52YXM6IGwuY2FudmFzIH0pO1xyXG5cdFx0XHRcdFx0XHRsLmNhbnZhcyA9IHVuZGVmaW5lZDtcclxuXHRcdFx0XHRcdFx0ZGVsZXRlIGwuaW1hZ2VEYXRhO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGwubWFzaykge1xyXG5cdFx0XHRcdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBsYXllci0ke2xheWVySWR9LW1hc2sucG5nYCwgY2FudmFzOiBsLm1hc2suY2FudmFzIH0pO1xyXG5cdFx0XHRcdFx0XHRcdGRlbGV0ZSBsLm1hc2suY2FudmFzO1xyXG5cdFx0XHRcdFx0XHRcdGRlbGV0ZSBsLm1hc2suaW1hZ2VEYXRhO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmxpbmtlZEZpbGVzKSB7XHJcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHBzZC5saW5rZWRGaWxlcykge1xyXG5cdFx0XHRcdFx0aWYgKGZpbGUuZGF0YSkge1xyXG5cdFx0XHRcdFx0XHRjb21wYXJlRmlsZXMucHVzaCh7IG5hbWU6IGZpbGUubmFtZSwgZGF0YTogZmlsZS5kYXRhIH0pO1xyXG5cdFx0XHRcdFx0XHRkZWxldGUgZmlsZS5kYXRhO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cHVzaExheWVyQ2FudmFzZXMocHNkLmNoaWxkcmVuIHx8IFtdKTtcclxuXHRcdFx0ZnMubWtkaXJTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmKSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcblxyXG5cdFx0XHRpZiAocHNkLmltYWdlUmVzb3VyY2VzPy50aHVtYm5haWwpIHtcclxuXHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiAndGh1bWIucG5nJywgY2FudmFzOiBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsLCBza2lwOiB0cnVlIH0pO1xyXG5cdFx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAocHNkLmltYWdlUmVzb3VyY2VzKSBkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbFJhdztcclxuXHJcblx0XHRcdGNvbXBhcmUuZm9yRWFjaChpID0+IHNhdmVDYW52YXMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsIGkubmFtZSksIGkuY2FudmFzKSk7XHJcblx0XHRcdGNvbXBhcmVGaWxlcy5mb3JFYWNoKGkgPT4gZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiwgaS5uYW1lKSwgaS5kYXRhKSk7XHJcblxyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCAnZGF0YS5qc29uJyksIEpTT04uc3RyaW5naWZ5KHBzZCwgbnVsbCwgMiksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHRjbGVhckVtcHR5Q2FudmFzRmllbGRzKHBzZCk7XHJcblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMoZXhwZWN0ZWQpO1xyXG5cclxuXHRcdFx0ZXhwZWN0KHBzZCkuZXFsKGV4cGVjdGVkLCBmKTtcclxuXHRcdFx0Y29tcGFyZS5mb3JFYWNoKGkgPT4gaS5za2lwIHx8IGNvbXBhcmVDYW52YXNlcyhpbWFnZXNbaS5uYW1lXSwgaS5jYW52YXMsIGAke2Z9LyR7aS5uYW1lfWApKTtcclxuXHRcdFx0Y29tcGFyZUZpbGVzLmZvckVhY2goaSA9PiBjb21wYXJlVHdvRmlsZXMocGF0aC5qb2luKGJhc2VQYXRoLCBpLm5hbWUpLCBpLmRhdGEsIGAke2Z9LyR7aS5uYW1lfWApKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cclxuXHRmcy5yZWFkZGlyU3luYyhyZWFkV3JpdGVGaWxlc1BhdGgpLmZvckVhY2goZiA9PiB7XHJcblx0XHQvLyBmcy5yZWFkZGlyU3luYyhyZWFkV3JpdGVGaWxlc1BhdGgpLmZpbHRlcihmID0+IC9hbm5vdC8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRcdGl0KGByZWFkcy13cml0ZXMgUFNEIGZpbGUgKCR7Zn0pYCwgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBleHQgPSBmcy5leGlzdHNTeW5jKHBhdGguam9pbihyZWFkV3JpdGVGaWxlc1BhdGgsIGYsICdzcmMucHNiJykpID8gJ3BzYicgOiAncHNkJztcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkV3JpdGVGaWxlc1BhdGgsIGYsIGBzcmMuJHtleHR9YCksIHtcclxuXHRcdFx0XHQuLi5vcHRzLCB1c2VJbWFnZURhdGE6IHRydWUsIHVzZVJhd1RodW1ibmFpbDogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWVcclxuXHRcdFx0fSk7XHJcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsIHBzYjogZXh0ID09PSAncHNiJyB9KTtcclxuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgYGV4cGVjdGVkLiR7ZXh0fWApKTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYHJlYWQtd3JpdGUtJHtmfS4ke2V4dH1gKSwgYWN0dWFsKTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYHJlYWQtd3JpdGUtJHtmfS5iaW5gKSwgYWN0dWFsKTtcclxuXHRcdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHRcdC8vIGNvbnN0IHBzZDIgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0ucHNkYCksIHsgLi4ub3B0cywgdXNlSW1hZ2VEYXRhOiB0cnVlLCB1c2VSYXdUaHVtYm5haWw6IHRydWUgfSk7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcDIudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkMiwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHRjb21wYXJlQnVmZmVycyhhY3R1YWwsIGV4cGVjdGVkLCBgcmVhZC13cml0ZS0ke2Z9YCwgMCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnd3JpdGUgdGV4dCBsYXllciB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAyMDAsXHJcblx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG5hbWU6ICd0ZXh0IGxheWVyJyxcclxuXHRcdFx0XHRcdHRleHQ6IHtcclxuXHRcdFx0XHRcdFx0dGV4dDogJ0hlbGxvIFdvcmxkXFxu4oCiIGMg4oCiIHRpbnkhXFxyXFxudGVzdCcsXHJcblx0XHRcdFx0XHRcdC8vIG9yaWVudGF0aW9uOiAndmVydGljYWwnLFxyXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm06IFsxLCAwLCAwLCAxLCA3MCwgNzBdLFxyXG5cdFx0XHRcdFx0XHRzdHlsZToge1xyXG5cdFx0XHRcdFx0XHRcdGZvbnQ6IHsgbmFtZTogJ0FyaWFsTVQnIH0sXHJcblx0XHRcdFx0XHRcdFx0Zm9udFNpemU6IDMwLFxyXG5cdFx0XHRcdFx0XHRcdGZpbGxDb2xvcjogeyByOiAwLCBnOiAxMjgsIGI6IDAgfSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0c3R5bGVSdW5zOiBbXHJcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDEyLCBzdHlsZTogeyBmaWxsQ29sb3I6IHsgcjogMjU1LCBnOiAwLCBiOiAwIH0gfSB9LFxyXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiAxMiwgc3R5bGU6IHsgZmlsbENvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDI1NSB9IH0gfSxcclxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogNCwgc3R5bGU6IHsgdW5kZXJsaW5lOiB0cnVlIH0gfSxcclxuXHRcdFx0XHRcdFx0XSxcclxuXHRcdFx0XHRcdFx0cGFyYWdyYXBoU3R5bGU6IHtcclxuXHRcdFx0XHRcdFx0XHRqdXN0aWZpY2F0aW9uOiAnY2VudGVyJyxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0d2FycDoge1xyXG5cdFx0XHRcdFx0XHRcdHN0eWxlOiAnYXJjJyxcclxuXHRcdFx0XHRcdFx0XHR2YWx1ZTogNTAsXHJcblx0XHRcdFx0XHRcdFx0cGVyc3BlY3RpdmU6IDAsXHJcblx0XHRcdFx0XHRcdFx0cGVyc3BlY3RpdmVPdGhlcjogMCxcclxuXHRcdFx0XHRcdFx0XHRyb3RhdGU6ICdob3Jpem9udGFsJyxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRuYW1lOiAnMm5kIGxheWVyJyxcclxuXHRcdFx0XHRcdHRleHQ6IHtcclxuXHRcdFx0XHRcdFx0dGV4dDogJ0FhYWFhJyxcclxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiBbMSwgMCwgMCwgMSwgNzAsIDcwXSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XSxcclxuXHRcdH07XHJcblxyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgJ19URVhUMi5wc2QnKSwgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3JlYWQgdGV4dCBsYXllciB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGV4dC10ZXN0LnBzZCcpLCBvcHRzKTtcclxuXHRcdC8vIGNvbnN0IGxheWVyID0gcHNkLmNoaWxkcmVuIVsxXTtcclxuXHJcblx0XHQvLyBsYXllci50ZXh0IS50ZXh0ID0gJ0ZvbyBiYXInO1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsICdfVEVYVC5wc2QnKSwgYnVmZmVyKTtcclxuXHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzBdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLmNoaWxkcmVuIVsxXS50ZXh0LCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5lbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnUkVBRCBURVNUJywgKCkgPT4ge1xyXG5cdFx0Y29uc3Qgb3JpZ2luYWxCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXN0LnBzZCcpKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnUkVBRElORyBPUklHSU5BTCcpO1xyXG5cdFx0Y29uc3Qgb3B0cyA9IHtcclxuXHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dXNlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHR1c2VSYXdUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0fTtcclxuXHRcdGNvbnN0IG9yaWdpbmFsUHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIob3JpZ2luYWxCdWZmZXIpLCBvcHRzKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnV1JJVElORycpO1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIob3JpZ2luYWxQc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGVtcC5wc2QnLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5iaW4nLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpLCAndXRmOCcpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC54bWwnLCBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcz8ueG1wTWV0YWRhdGEsICd1dGY4Jyk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1JFQURJTkcgV1JJVFRFTicpO1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKFxyXG5cdFx0XHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhvcmlnaW5hbFBzZCk7XHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhwc2QpO1xyXG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KG9yaWdpbmFsUHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCdvcmlnaW5hbC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ2FmdGVyLmpzb24nLCBKU09OLnN0cmluZ2lmeShwc2QsIG51bGwsIDIpKTtcclxuXHJcblx0XHRjb21wYXJlQnVmZmVycyhidWZmZXIsIG9yaWdpbmFsQnVmZmVyLCAndGVzdCcpO1xyXG5cclxuXHRcdGV4cGVjdChwc2QpLmVxbChvcmlnaW5hbFBzZCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2RlY29kZSBlbmdpbmUgZGF0YSAyJywgKCkgPT4ge1xyXG5cdFx0Ly8gY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICdlbmdpbmVEYXRhMlZlcnRpY2FsLnR4dCcpKTtcclxuXHRcdGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJTaW1wbGUudHh0JykpO1xyXG5cdFx0Y29uc3QgZnVuYyA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZmlsZURhdGF9O2ApO1xyXG5cdFx0Y29uc3QgZGF0YSA9IGZ1bmMoKTtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IGRlY29kZUVuZ2luZURhdGEyKGRhdGEpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcclxuXHRcdFx0cGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICd0ZW1wLmpzJyksXHJcblx0XHRcdCd2YXIgeCA9ICcgKyByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChyZXN1bHQsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXN0LnBzZCcsICgpID0+IHtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGVzdC5wc2QnKTtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHR9KTtcclxuXHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0Y29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGVzdCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgdGVzdC9yZWFkLXdyaXRlL3RleHQtYm94L3NyYy5wc2RgKSksIHtcclxuXHRcdFx0Ly8gc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0Ly8gc2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHQvLyBza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdHVzZVJhd1RodW1ibmFpbDogdHJ1ZSxcclxuXHRcdH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGV4dF9yZWN0X291dC5wc2QnLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RleHRfcmVjdF9vdXQuYmluJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XHJcblx0XHQvLyBjb25zdCBwc2QyID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApKSwge1xyXG5cdFx0Ly8gXHQvLyBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0Ly8gXHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHQvLyBcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHQvLyBcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0Ly8gXHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdC8vIH0pO1xyXG5cdFx0Ly8gcHNkMjtcclxuXHRcdGNvbnN0IG9yaWdpbmFsID0gZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApO1xyXG5cdFx0Y29uc3Qgb3V0cHV0ID0gZnMucmVhZEZpbGVTeW5jKGB0ZXh0X3JlY3Rfb3V0LnBzZGApO1xyXG5cdFx0Y29tcGFyZUJ1ZmZlcnMob3V0cHV0LCBvcmlnaW5hbCwgJy0nLCAweDY1ZDgpOyAvLyAsIDB4OGNlOCwgMHg4ZmNhIC0gMHg4Y2U4KTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnY29tcGFyZSB0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIFsndGV4dF9wb2ludCcsICd0ZXh0X3JlY3QnXSkge1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYCR7bmFtZX0ucHNkYCkpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdC8vIHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9LnR4dGAsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblxyXG5cdFx0XHQvLyBjb25zdCBlbmdpbmVEYXRhID0gcGFyc2VFbmdpbmVEYXRhKHRvQnl0ZUFycmF5KHBzZC5lbmdpbmVEYXRhISkpO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKGAke25hbWV9X2VuZ2luZWRhdGEudHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3RleHQtcmVwbGFjZS5wc2QnLCAoKSA9PiB7XHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlMi5wc2QnKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge30pO1xyXG5cdFx0XHRwc2QuY2hpbGRyZW4hWzFdIS50ZXh0IS50ZXh0ID0gJ0ZvbyBiYXInO1xyXG5cdFx0XHRjb25zdCBvdXRwdXQgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgaW52YWxpZGF0ZVRleHRMYXllcnM6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0LnBzZCcsIG91dHB1dCk7XHJcblx0XHR9XHJcblxyXG5cdFx0e1xyXG5cdFx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3RleHQtcmVwbGFjZS5wc2QnKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge1xyXG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XHJcblx0XHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0XHRwc2QuY2hpbGRyZW4/LnNwbGljZSgwLCAxKTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnaW5wdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygnb3V0LnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXRwdXQudHh0JywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHR9KTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBjbGVhckVtcHR5Q2FudmFzRmllbGRzKGxheWVyOiBMYXllciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChsYXllcikge1xyXG5cdFx0aWYgKCdjYW52YXMnIGluIGxheWVyICYmICFsYXllci5jYW52YXMpIGRlbGV0ZSBsYXllci5jYW52YXM7XHJcblx0XHRpZiAoJ2ltYWdlRGF0YScgaW4gbGF5ZXIgJiYgIWxheWVyLmltYWdlRGF0YSkgZGVsZXRlIGxheWVyLmltYWdlRGF0YTtcclxuXHRcdGxheWVyLmNoaWxkcmVuPy5mb3JFYWNoKGNsZWFyRW1wdHlDYW52YXNGaWVsZHMpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gY2xlYXJDYW52YXNGaWVsZHMobGF5ZXI6IExheWVyIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKGxheWVyKSB7XHJcblx0XHRkZWxldGUgbGF5ZXIuY2FudmFzO1xyXG5cdFx0ZGVsZXRlIGxheWVyLmltYWdlRGF0YTtcclxuXHRcdGlmIChsYXllci5tYXNrKSBkZWxldGUgbGF5ZXIubWFzay5jYW52YXM7XHJcblx0XHRpZiAobGF5ZXIubWFzaykgZGVsZXRlIGxheWVyLm1hc2suaW1hZ2VEYXRhO1xyXG5cdFx0bGF5ZXIuY2hpbGRyZW4/LmZvckVhY2goY2xlYXJDYW52YXNGaWVsZHMpO1xyXG5cdH1cclxufVxyXG5cclxuLy8vIEVuZ2luZSBkYXRhIDIgZXhwZXJpbWVudHNcclxuLy8gL3Rlc3QvZW5naW5lRGF0YTIuanNvbjoxMTA5IGlzIGNoYXJhY3RlciBjb2Rlc1xyXG5cclxuY29uc3Qga2V5c0NvbG9yID0ge1xyXG5cdCcwJzoge1xyXG5cdFx0dXByb290OiB0cnVlLFxyXG5cdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0JzAnOiB7IG5hbWU6ICdUeXBlJyB9LFxyXG5cdFx0XHQnMSc6IHsgbmFtZTogJ1ZhbHVlcycgfSxcclxuXHRcdH0sXHJcblx0fSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNTdHlsZVNoZWV0ID0ge1xyXG5cdCcwJzogeyBuYW1lOiAnRm9udCcgfSxcclxuXHQnMSc6IHsgbmFtZTogJ0ZvbnRTaXplJyB9LFxyXG5cdCcyJzogeyBuYW1lOiAnRmF1eEJvbGQnIH0sXHJcblx0JzMnOiB7IG5hbWU6ICdGYXV4SXRhbGljJyB9LFxyXG5cdCc0JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXHJcblx0JzUnOiB7IG5hbWU6ICdMZWFkaW5nJyB9LFxyXG5cdCc2JzogeyBuYW1lOiAnSG9yaXpvbnRhbFNjYWxlJyB9LFxyXG5cdCc3JzogeyBuYW1lOiAnVmVydGljYWxTY2FsZScgfSxcclxuXHQnOCc6IHsgbmFtZTogJ1RyYWNraW5nJyB9LFxyXG5cdCc5JzogeyBuYW1lOiAnQmFzZWxpbmVTaGlmdCcgfSxcclxuXHJcblx0JzExJzogeyBuYW1lOiAnS2VybmluZz8nIH0sIC8vIGRpZmZlcmVudCB2YWx1ZSB0aGFuIEVuZ2luZURhdGFcclxuXHQnMTInOiB7IG5hbWU6ICdGb250Q2FwcycgfSxcclxuXHQnMTMnOiB7IG5hbWU6ICdGb250QmFzZWxpbmUnIH0sXHJcblxyXG5cdCcxNSc6IHsgbmFtZTogJ1N0cmlrZXRocm91Z2g/JyB9LCAvLyBudW1iZXIgaW5zdGVhZCBvZiBib29sXHJcblx0JzE2JzogeyBuYW1lOiAnVW5kZXJsaW5lPycgfSwgLy8gbnVtYmVyIGluc3RlYWQgb2YgYm9vbFxyXG5cclxuXHQnMTgnOiB7IG5hbWU6ICdMaWdhdHVyZXMnIH0sXHJcblx0JzE5JzogeyBuYW1lOiAnRExpZ2F0dXJlcycgfSxcclxuXHJcblx0JzIzJzogeyBuYW1lOiAnRnJhY3Rpb25zJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblx0JzI0JzogeyBuYW1lOiAnT3JkaW5hbHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzI4JzogeyBuYW1lOiAnU3R5bGlzdGljQWx0ZXJuYXRlcycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMzAnOiB7IG5hbWU6ICdPbGRTdHlsZT8nIH0sIC8vIE9wZW5UeXBlID4gT2xkU3R5bGUsIG51bWJlciBpbnN0ZWFkIG9mIGJvb2wsIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzM1JzogeyBuYW1lOiAnQmFzZWxpbmVEaXJlY3Rpb24nIH0sXHJcblxyXG5cdCczOCc6IHsgbmFtZTogJ0xhbmd1YWdlJyB9LFxyXG5cclxuXHQnNTInOiB7IG5hbWU6ICdOb0JyZWFrJyB9LFxyXG5cdCc1Myc6IHsgbmFtZTogJ0ZpbGxDb2xvcicsIGNoaWxkcmVuOiBrZXlzQ29sb3IgfSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNQYXJhZ3JhcGggPSB7XHJcblx0JzAnOiB7IG5hbWU6ICdKdXN0aWZpY2F0aW9uJyB9LFxyXG5cdCcxJzogeyBuYW1lOiAnRmlyc3RMaW5lSW5kZW50JyB9LFxyXG5cdCcyJzogeyBuYW1lOiAnU3RhcnRJbmRlbnQnIH0sXHJcblx0JzMnOiB7IG5hbWU6ICdFbmRJbmRlbnQnIH0sXHJcblx0JzQnOiB7IG5hbWU6ICdTcGFjZUJlZm9yZScgfSxcclxuXHQnNSc6IHsgbmFtZTogJ1NwYWNlQWZ0ZXInIH0sXHJcblxyXG5cdCc3JzogeyBuYW1lOiAnQXV0b0xlYWRpbmcnIH0sXHJcblxyXG5cdCc5JzogeyBuYW1lOiAnQXV0b0h5cGhlbmF0ZScgfSxcclxuXHQnMTAnOiB7IG5hbWU6ICdIeXBoZW5hdGVkV29yZFNpemUnIH0sXHJcblx0JzExJzogeyBuYW1lOiAnUHJlSHlwaGVuJyB9LFxyXG5cdCcxMic6IHsgbmFtZTogJ1Bvc3RIeXBoZW4nIH0sXHJcblx0JzEzJzogeyBuYW1lOiAnQ29uc2VjdXRpdmVIeXBoZW5zPycgfSwgLy8gZGlmZmVyZW50IHZhbHVlIHRoYW4gRW5naW5lRGF0YVxyXG5cdCcxNCc6IHsgbmFtZTogJ1pvbmUnIH0sXHJcblx0JzE1JzogeyBuYW1lOiAnSHlwZW5hdGVDYXBpdGFsaXplZFdvcmRzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCcxNyc6IHsgbmFtZTogJ1dvcmRTcGFjaW5nJyB9LFxyXG5cdCcxOCc6IHsgbmFtZTogJ0xldHRlclNwYWNpbmcnIH0sXHJcblx0JzE5JzogeyBuYW1lOiAnR2x5cGhTcGFjaW5nJyB9LFxyXG5cclxuXHQnMzInOiB7IG5hbWU6ICdTdHlsZVNoZWV0JywgY2hpbGRyZW46IGtleXNTdHlsZVNoZWV0IH0sXHJcbn07XHJcblxyXG5jb25zdCBrZXlzU3R5bGVTaGVldERhdGEgPSB7XHJcblx0bmFtZTogJ1N0eWxlU2hlZXREYXRhJyxcclxuXHRjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQsXHJcbn07XHJcblxyXG5jb25zdCBrZXlzID0ge1xyXG5cdCcwJzoge1xyXG5cdFx0bmFtZTogJ1Jlc291cmNlRGljdCcsXHJcblx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnRm9udFNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcyJzogeyBuYW1lOiAnRm9udFR5cGUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMic6IHtcclxuXHRcdFx0XHRuYW1lOiAnMicsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMyc6IHtcclxuXHRcdFx0XHRuYW1lOiAnTW9qaUt1bWlTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdJbnRlcm5hbE5hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc0Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdLaW5zb2t1U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05vU3RhcnQnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ05vRW5kJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzInOiB7IG5hbWU6ICdLZWVwJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzMnOiB7IG5hbWU6ICdIYW5naW5nJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzYnOiBrZXlzU3R5bGVTaGVldERhdGEsXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc2Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldFNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQcm9wZXJ0aWVzJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICdEZWZhdWx0U3R5bGVTaGVldCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzgnOiB7XHJcblx0XHRcdFx0bmFtZTogJzgnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzknOiB7XHJcblx0XHRcdFx0bmFtZTogJ1ByZWRlZmluZWQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHQnMSc6IHtcclxuXHRcdG5hbWU6ICdFbmdpbmVEaWN0JyxcclxuXHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdG5hbWU6ICcwJyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICcwJyxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnMyc6IHsgbmFtZTogJ1N1cGVyc2NyaXB0U2l6ZScgfSxcclxuXHRcdFx0XHRcdCc0JzogeyBuYW1lOiAnU3VwZXJzY3JpcHRQb3NpdGlvbicgfSxcclxuXHRcdFx0XHRcdCc1JzogeyBuYW1lOiAnU3Vic2NyaXB0U2l6ZScgfSxcclxuXHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnU3Vic2NyaXB0UG9zaXRpb24nIH0sXHJcblx0XHRcdFx0XHQnNyc6IHsgbmFtZTogJ1NtYWxsQ2FwU2l6ZScgfSxcclxuXHRcdFx0XHRcdCc4JzogeyBuYW1lOiAnVXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzJyB9LCAvLyA/Pz9cclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnRWRpdG9ycz8nLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ0VkaXRvcicsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdUZXh0JyB9LFxyXG5cdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFJ1bicsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnMCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJzUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNic6IHsgbmFtZTogJzYnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdSdW5MZW5ndGgnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHQnNic6IHtcclxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdTdHlsZVJ1bicsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUnVuQXJyYXknLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzYnOiBrZXlzU3R5bGVTaGVldERhdGEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdSdW5MZW5ndGgnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnMSc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ0ZvbnRWZWN0b3JEYXRhID8/PycsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcyJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQsXHJcblx0XHRcdH0sXHJcblx0XHRcdCczJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcbn07XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVPYmoob2JqOiBhbnksIGtleXM6IGFueSk6IGFueSB7XHJcblx0aWYgKG9iaiA9PT0gbnVsbCB8fCAha2V5cykgcmV0dXJuIG9iajtcclxuXHJcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xyXG5cdFx0cmV0dXJuIG9iai5tYXAoeCA9PiBkZWNvZGVPYmooeCwga2V5cykpO1xyXG5cdH1cclxuXHJcblx0aWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSByZXR1cm4gb2JqO1xyXG5cclxuXHRjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xyXG5cclxuXHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvYmopKSB7XHJcblx0XHRpZiAoa2V5c1trZXldKSB7XHJcblx0XHRcdGlmIChrZXlzW2tleV0udXByb290KSB7XHJcblx0XHRcdFx0cmV0dXJuIGRlY29kZU9iaihvYmpba2V5XSwga2V5c1trZXldLmNoaWxkcmVuKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyZXN1bHRba2V5c1trZXldLm5hbWVdID0gZGVjb2RlT2JqKG9ialtrZXldLCBrZXlzW2tleV0uY2hpbGRyZW4pO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXN1bHRba2V5XSA9IG9ialtrZXldO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlRW5naW5lRGF0YTIoZGF0YTogYW55KSB7XHJcblx0cmV0dXJuIGRlY29kZU9iaihkYXRhLCBrZXlzKTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
