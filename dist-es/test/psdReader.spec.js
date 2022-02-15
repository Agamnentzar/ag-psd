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
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { readPsdFromFile, importPSD, loadImagesFromDirectory, compareCanvases, saveCanvas, createReaderFromBuffer, compareBuffers, compareTwoFiles } from './common';
import { readPsd, writePsdBuffer } from '../index';
import { readPsd as readPsdInternal } from '../psdReader';
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
        var psd = readPsdFromFile(path.join(readFilesPath, 'blend-mode', 'src.psd'), __assign({}, opts));
        console.log(require('util').inspect(psd, false, 99, true));
        expect(psd.width).equal(300);
        expect(psd.height).equal(200);
    });
    it('skips composite image data', function () {
        var psd = readPsdFromFile(path.join(readFilesPath, 'layers', 'src.psd'), __assign(__assign({}, opts), { skipCompositeImageData: true }));
        expect(psd.canvas).not.ok;
    });
    it('fetches a layer group', function () {
        var psd = readPsdFromFile(path.join(readFilesPath, 'nested-layers', 'src.psd'), __assign(__assign({}, opts), { skipLayerImageData: true }));
        expect(psd.children[2].name).to.equal('Group 1');
        expect(psd.children[2].children[0].name).to.equal('GroupChild1');
        expect(psd.children[2].children[0].parentId).to.equal(5);
    });
    it('reads PSD from Buffer with offset', function () {
        var file = fs.readFileSync(path.join(readFilesPath, 'layers', 'src.psd'));
        var outer = Buffer.alloc(file.byteLength + 100);
        file.copy(outer, 100);
        var inner = Buffer.from(outer.buffer, 100, file.byteLength);
        var psd = readPsd(inner, opts);
        expect(psd.width).equal(300);
    });
    it.skip('duplicate smart', function () {
        var psd = readPsdFromFile(path.join('resources', 'src.psd'), __assign({}, opts));
        var child = psd.children[1].children[0];
        psd.children[1].children.push(child);
        // const child = psd.children![0];
        // delete child.id;
        // psd.children!.push(child);
        fs.writeFileSync('output.psd', writePsdBuffer(psd, {
            trimImageData: false,
            generateThumbnail: true,
            noBackground: true
        }));
        var psd2 = readPsdFromFile(path.join('output.psd'), __assign({}, opts));
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
            var psd = readPsdFromFile(path.join(basePath, fileName), __assign({}, opts));
            var expected = importPSD(basePath);
            var images = loadImagesFromDirectory(basePath);
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
            compare.forEach(function (i) { return saveCanvas(path.join(resultsFilesPath, f, i.name), i.canvas); });
            compareFiles.forEach(function (i) { return fs.writeFileSync(path.join(resultsFilesPath, f, i.name), i.data); });
            fs.writeFileSync(path.join(resultsFilesPath, f, 'data.json'), JSON.stringify(psd, null, 2), 'utf8');
            clearEmptyCanvasFields(psd);
            clearEmptyCanvasFields(expected);
            expect(psd).eql(expected, f);
            compare.forEach(function (i) { return i.skip || compareCanvases(images[i.name], i.canvas, "".concat(f, "/").concat(i.name)); });
            compareFiles.forEach(function (i) { return compareTwoFiles(path.join(basePath, i.name), i.data, "".concat(f, "/").concat(i.name)); });
        });
    });
    fs.readdirSync(readWriteFilesPath).forEach(function (f) {
        // fs.readdirSync(readWriteFilesPath).filter(f => /annot/.test(f)).forEach(f => {
        it("reads-writes PSD file (".concat(f, ")"), function () {
            var ext = fs.existsSync(path.join(readWriteFilesPath, f, 'src.psb')) ? 'psb' : 'psd';
            var psd = readPsdFromFile(path.join(readWriteFilesPath, f, "src.".concat(ext)), __assign(__assign({}, opts), { useImageData: true, useRawThumbnail: true, throwForMissingFeatures: true }));
            var actual = writePsdBuffer(psd, { logMissingFeatures: true, psb: ext === 'psb' });
            var expected = fs.readFileSync(path.join(readWriteFilesPath, f, "expected.".concat(ext)));
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-".concat(f, ".").concat(ext)), actual);
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-".concat(f, ".bin")), actual);
            // console.log(require('util').inspect(psd, false, 99, true));
            // const psd2 = readPsdFromFile(path.join(resultsFilesPath, `read-write-${f}.psd`), { ...opts, useImageData: true, useRawThumbnail: true });
            // fs.writeFileSync('temp.txt', require('util').inspect(psd, false, 99, false), 'utf8');
            // fs.writeFileSync('temp2.txt', require('util').inspect(psd2, false, 99, false), 'utf8');
            compareBuffers(actual, expected, "read-write-".concat(f), 0);
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
        fs.writeFileSync(path.join(resultsFilesPath, '_TEXT2.psd'), writePsdBuffer(psd, { logMissingFeatures: true }));
    });
    it.skip('read text layer test', function () {
        var psd = readPsdFromFile(path.join(testFilesPath, 'text-test.psd'), opts);
        // const layer = psd.children![1];
        // layer.text!.text = 'Foo bar';
        var buffer = writePsdBuffer(psd, { logMissingFeatures: true });
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
        var originalPsd = readPsdInternal(createReaderFromBuffer(originalBuffer), opts);
        console.log('WRITING');
        var buffer = writePsdBuffer(originalPsd, { logMissingFeatures: true });
        fs.writeFileSync('temp.psd', buffer);
        // fs.writeFileSync('temp.bin', buffer);
        // fs.writeFileSync('temp.json', JSON.stringify(originalPsd, null, 2), 'utf8');
        // fs.writeFileSync('temp.xml', originalPsd.imageResources?.xmpMetadata, 'utf8');
        console.log('READING WRITTEN');
        var psd = readPsdInternal(createReaderFromBuffer(buffer), { logMissingFeatures: true, throwForMissingFeatures: true });
        clearCanvasFields(originalPsd);
        clearCanvasFields(psd);
        delete originalPsd.imageResources.thumbnail;
        delete psd.imageResources.thumbnail;
        delete originalPsd.imageResources.thumbnailRaw;
        delete psd.imageResources.thumbnailRaw;
        // console.log(require('util').inspect(originalPsd, false, 99, true));
        // fs.writeFileSync('original.json', JSON.stringify(originalPsd, null, 2));
        // fs.writeFileSync('after.json', JSON.stringify(psd, null, 2));
        compareBuffers(buffer, originalBuffer, 'test');
        expect(psd).eql(originalPsd);
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
        var psd = readPsdInternal(createReaderFromBuffer(buffer), {
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
        var psd = readPsdInternal(createReaderFromBuffer(fs.readFileSync("test/read-write/text-box/src.psd")), {
            // skipCompositeImageData: true,
            // skipLayerImageData: true,
            // skipThumbnail: true,
            throwForMissingFeatures: true,
            logDevFeatures: true,
            useRawThumbnail: true,
        });
        fs.writeFileSync('text_rect_out.psd', writePsdBuffer(psd, { logMissingFeatures: true }));
        fs.writeFileSync('text_rect_out.bin', writePsdBuffer(psd, { logMissingFeatures: true }));
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
        compareBuffers(output, original, '-', 0x65d8); // , 0x8ce8, 0x8fca - 0x8ce8);
    });
    it.skip('compare test', function () {
        for (var _i = 0, _a = ['text_point', 'text_rect']; _i < _a.length; _i++) {
            var name_1 = _a[_i];
            var psd = readPsdInternal(createReaderFromBuffer(fs.readFileSync("".concat(name_1, ".psd"))), {
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
            var psd = readPsdInternal(createReaderFromBuffer(buffer), {});
            psd.children[1].text.text = 'Foo bar';
            var output = writePsdBuffer(psd, { invalidateTextLayers: true, logMissingFeatures: true });
            fs.writeFileSync('out.psd', output);
        }
        {
            var buffer = fs.readFileSync('text-replace.psd');
            var psd = readPsdInternal(createReaderFromBuffer(buffer), {
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
            var psd = readPsdInternal(createReaderFromBuffer(buffer), {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QixJQUFnQixFQUFFO1FBQS9CLElBQU0sR0FBRyxTQUFBO1FBQ2IsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDZCxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3JCLE9BQU8sU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDL0M7aUJBQU07Z0JBQ04sTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNqRTtTQUNEO2FBQU07WUFDTixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3ZCO0tBQ0Q7SUFFRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLElBQVM7SUFDbkMsT0FBTyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzlCLENBQUMiLCJmaWxlIjoidGVzdC9wc2RSZWFkZXIuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XHJcbmltcG9ydCB7XHJcblx0cmVhZFBzZEZyb21GaWxlLCBpbXBvcnRQU0QsIGxvYWRJbWFnZXNGcm9tRGlyZWN0b3J5LCBjb21wYXJlQ2FudmFzZXMsIHNhdmVDYW52YXMsXHJcblx0Y3JlYXRlUmVhZGVyRnJvbUJ1ZmZlciwgY29tcGFyZUJ1ZmZlcnMsIGNvbXBhcmVUd29GaWxlc1xyXG59IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0IHsgTGF5ZXIsIFJlYWRPcHRpb25zLCBQc2QgfSBmcm9tICcuLi9wc2QnO1xyXG5pbXBvcnQgeyByZWFkUHNkLCB3cml0ZVBzZEJ1ZmZlciB9IGZyb20gJy4uL2luZGV4JztcclxuaW1wb3J0IHsgcmVhZFBzZCBhcyByZWFkUHNkSW50ZXJuYWwgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xyXG5cclxuY29uc3QgdGVzdEZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0Jyk7XHJcbmNvbnN0IHJlYWRGaWxlc1BhdGggPSBwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3JlYWQnKTtcclxuY29uc3QgcmVhZFdyaXRlRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkLXdyaXRlJyk7XHJcbmNvbnN0IHJlc3VsdHNGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycpO1xyXG5jb25zdCBvcHRzOiBSZWFkT3B0aW9ucyA9IHtcclxuXHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcbn07XHJcblxyXG5kZXNjcmliZSgnUHNkUmVhZGVyJywgKCkgPT4ge1xyXG5cdGl0KCdyZWFkcyB3aWR0aCBhbmQgaGVpZ2h0IHByb3Blcmx5JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnYmxlbmQtbW9kZScsICdzcmMucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHRcdGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xyXG5cdFx0ZXhwZWN0KHBzZC5oZWlnaHQpLmVxdWFsKDIwMCk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdza2lwcyBjb21wb3NpdGUgaW1hZ2UgZGF0YScsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2xheWVycycsICdzcmMucHNkJyksIHsgLi4ub3B0cywgc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSB9KTtcclxuXHRcdGV4cGVjdChwc2QuY2FudmFzKS5ub3Qub2s7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdmZXRjaGVzIGEgbGF5ZXIgZ3JvdXAnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICduZXN0ZWQtbGF5ZXJzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUgfSk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5uYW1lKS50by5lcXVhbCgnR3JvdXAgMScpO1xyXG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMl0uY2hpbGRyZW4hWzBdLm5hbWUpLnRvLmVxdWFsKCdHcm91cENoaWxkMScpO1xyXG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMl0uY2hpbGRyZW4hWzBdLnBhcmVudElkKS50by5lcXVhbCg1KTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3JlYWRzIFBTRCBmcm9tIEJ1ZmZlciB3aXRoIG9mZnNldCcsICgpID0+IHtcclxuXHRcdGNvbnN0IGZpbGUgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdsYXllcnMnLCAnc3JjLnBzZCcpKTtcclxuXHRcdGNvbnN0IG91dGVyID0gQnVmZmVyLmFsbG9jKGZpbGUuYnl0ZUxlbmd0aCArIDEwMCk7XHJcblx0XHRmaWxlLmNvcHkob3V0ZXIsIDEwMCk7XHJcblx0XHRjb25zdCBpbm5lciA9IEJ1ZmZlci5mcm9tKG91dGVyLmJ1ZmZlciwgMTAwLCBmaWxlLmJ5dGVMZW5ndGgpO1xyXG5cclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2QoaW5uZXIsIG9wdHMpO1xyXG5cclxuXHRcdGV4cGVjdChwc2Qud2lkdGgpLmVxdWFsKDMwMCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2R1cGxpY2F0ZSBzbWFydCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oJ3Jlc291cmNlcycsICdzcmMucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHJcblx0XHRjb25zdCBjaGlsZCA9IHBzZC5jaGlsZHJlbiFbMV0uY2hpbGRyZW4hWzBdO1xyXG5cdFx0cHNkLmNoaWxkcmVuIVsxXS5jaGlsZHJlbiEucHVzaChjaGlsZCk7XHJcblxyXG5cdFx0Ly8gY29uc3QgY2hpbGQgPSBwc2QuY2hpbGRyZW4hWzBdO1xyXG5cdFx0Ly8gZGVsZXRlIGNoaWxkLmlkO1xyXG5cdFx0Ly8gcHNkLmNoaWxkcmVuIS5wdXNoKGNoaWxkKTtcclxuXHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXRwdXQucHNkJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7XHJcblx0XHRcdHRyaW1JbWFnZURhdGE6IGZhbHNlLFxyXG5cdFx0XHRnZW5lcmF0ZVRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0bm9CYWNrZ3JvdW5kOiB0cnVlXHJcblx0XHR9KSk7XHJcblxyXG5cdFx0Y29uc3QgcHNkMiA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4oJ291dHB1dC5wc2QnKSwgeyAuLi5vcHRzIH0pO1xyXG5cclxuXHRcdGNvbnNvbGUubG9nKHBzZDIud2lkdGgpO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBza2lwcGluZyBcInBhdHRlcm5cIiB0ZXN0IGJlY2F1c2UgaXQgcmVxdWlyZXMgemlwIGNpbXByZXNzaW9uIG9mIHBhdHRlcm5zXHJcblx0Ly8gc2tpcHBpbmcgXCJjbXlrXCIgdGVzdCBiZWNhdXNlIHdlIGNhbid0IGNvbnZlcnQgQ01ZSyB0byBSR0JcclxuXHRmcy5yZWFkZGlyU3luYyhyZWFkRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm58Y215ay8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRcdC8vIGZzLnJlYWRkaXJTeW5jKHJlYWRGaWxlc1BhdGgpLmZpbHRlcihmID0+IC9rcml0YS8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRcdGl0KGByZWFkcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IGJhc2VQYXRoID0gcGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsIGYpO1xyXG5cdFx0XHRjb25zdCBmaWxlTmFtZSA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnc3JjLnBzYicpKSA/ICdzcmMucHNiJyA6ICdzcmMucHNkJztcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgZmlsZU5hbWUpLCB7IC4uLm9wdHMgfSk7XHJcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gaW1wb3J0UFNEKGJhc2VQYXRoKTtcclxuXHRcdFx0Y29uc3QgaW1hZ2VzID0gbG9hZEltYWdlc0Zyb21EaXJlY3RvcnkoYmFzZVBhdGgpO1xyXG5cdFx0XHRjb25zdCBjb21wYXJlOiB7IG5hbWU6IHN0cmluZzsgY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudCB8IHVuZGVmaW5lZDsgc2tpcD86IGJvb2xlYW47IH1bXSA9IFtdO1xyXG5cdFx0XHRjb25zdCBjb21wYXJlRmlsZXM6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBVaW50OEFycmF5OyB9W10gPSBbXTtcclxuXHJcblx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBjYW52YXMucG5nYCwgY2FudmFzOiBwc2QuY2FudmFzIH0pO1xyXG5cdFx0XHRwc2QuY2FudmFzID0gdW5kZWZpbmVkO1xyXG5cdFx0XHRkZWxldGUgcHNkLmltYWdlRGF0YTtcclxuXHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEueG1wTWV0YWRhdGE7XHJcblxyXG5cdFx0XHRsZXQgaSA9IDA7XHJcblxyXG5cdFx0XHRmdW5jdGlvbiBwdXNoTGF5ZXJDYW52YXNlcyhsYXllcnM6IExheWVyW10pIHtcclxuXHRcdFx0XHRmb3IgKGNvbnN0IGwgb2YgbGF5ZXJzKSB7XHJcblx0XHRcdFx0XHRpZiAobC5jaGlsZHJlbikge1xyXG5cdFx0XHRcdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhsLmNoaWxkcmVuKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGxheWVySWQgPSBpKys7XHJcblx0XHRcdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6IGBsYXllci0ke2xheWVySWR9LnBuZ2AsIGNhbnZhczogbC5jYW52YXMgfSk7XHJcblx0XHRcdFx0XHRcdGwuY2FudmFzID0gdW5kZWZpbmVkO1xyXG5cdFx0XHRcdFx0XHRkZWxldGUgbC5pbWFnZURhdGE7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAobC5tYXNrKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGxheWVyLSR7bGF5ZXJJZH0tbWFzay5wbmdgLCBjYW52YXM6IGwubWFzay5jYW52YXMgfSk7XHJcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5jYW52YXM7XHJcblx0XHRcdFx0XHRcdFx0ZGVsZXRlIGwubWFzay5pbWFnZURhdGE7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChwc2QubGlua2VkRmlsZXMpIHtcclxuXHRcdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgcHNkLmxpbmtlZEZpbGVzKSB7XHJcblx0XHRcdFx0XHRpZiAoZmlsZS5kYXRhKSB7XHJcblx0XHRcdFx0XHRcdGNvbXBhcmVGaWxlcy5wdXNoKHsgbmFtZTogZmlsZS5uYW1lLCBkYXRhOiBmaWxlLmRhdGEgfSk7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSBmaWxlLmRhdGE7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwdXNoTGF5ZXJDYW52YXNlcyhwc2QuY2hpbGRyZW4gfHwgW10pO1xyXG5cdFx0XHRmcy5ta2RpclN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuXHJcblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXM/LnRodW1ibmFpbCkge1xyXG5cdFx0XHRcdGNvbXBhcmUucHVzaCh7IG5hbWU6ICd0aHVtYi5wbmcnLCBjYW52YXM6IHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWwsIHNraXA6IHRydWUgfSk7XHJcblx0XHRcdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChwc2QuaW1hZ2VSZXNvdXJjZXMpIGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMudGh1bWJuYWlsUmF3O1xyXG5cclxuXHRcdFx0Y29tcGFyZS5mb3JFYWNoKGkgPT4gc2F2ZUNhbnZhcyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiwgaS5uYW1lKSwgaS5jYW52YXMpKTtcclxuXHRcdFx0Y29tcGFyZUZpbGVzLmZvckVhY2goaSA9PiBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCBpLm5hbWUpLCBpLmRhdGEpKTtcclxuXHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsICdkYXRhLmpzb24nKSwgSlNPTi5zdHJpbmdpZnkocHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdGNsZWFyRW1wdHlDYW52YXNGaWVsZHMocHNkKTtcclxuXHRcdFx0Y2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhleHBlY3RlZCk7XHJcblxyXG5cdFx0XHRleHBlY3QocHNkKS5lcWwoZXhwZWN0ZWQsIGYpO1xyXG5cdFx0XHRjb21wYXJlLmZvckVhY2goaSA9PiBpLnNraXAgfHwgY29tcGFyZUNhbnZhc2VzKGltYWdlc1tpLm5hbWVdLCBpLmNhbnZhcywgYCR7Zn0vJHtpLm5hbWV9YCkpO1xyXG5cdFx0XHRjb21wYXJlRmlsZXMuZm9yRWFjaChpID0+IGNvbXBhcmVUd29GaWxlcyhwYXRoLmpvaW4oYmFzZVBhdGgsIGkubmFtZSksIGkuZGF0YSwgYCR7Zn0vJHtpLm5hbWV9YCkpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdGZzLnJlYWRkaXJTeW5jKHJlYWRXcml0ZUZpbGVzUGF0aCkuZm9yRWFjaChmID0+IHtcclxuXHRcdC8vIGZzLnJlYWRkaXJTeW5jKHJlYWRXcml0ZUZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gL2Fubm90Ly50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0aXQoYHJlYWRzLXdyaXRlcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IGV4dCA9IGZzLmV4aXN0c1N5bmMocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgJ3NyYy5wc2InKSkgPyAncHNiJyA6ICdwc2QnO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRXcml0ZUZpbGVzUGF0aCwgZiwgYHNyYy4ke2V4dH1gKSwge1xyXG5cdFx0XHRcdC4uLm9wdHMsIHVzZUltYWdlRGF0YTogdHJ1ZSwgdXNlUmF3VGh1bWJuYWlsOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZVxyXG5cdFx0XHR9KTtcclxuXHRcdFx0Y29uc3QgYWN0dWFsID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgcHNiOiBleHQgPT09ICdwc2InIH0pO1xyXG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCBgZXhwZWN0ZWQuJHtleHR9YCkpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LiR7ZXh0fWApLCBhY3R1YWwpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LmJpbmApLCBhY3R1YWwpO1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdFx0Ly8gY29uc3QgcHNkMiA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYHJlYWQtd3JpdGUtJHtmfS5wc2RgKSwgeyAuLi5vcHRzLCB1c2VJbWFnZURhdGE6IHRydWUsIHVzZVJhd1RodW1ibmFpbDogdHJ1ZSB9KTtcclxuXHRcdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wMi50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QyLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdGNvbXBhcmVCdWZmZXJzKGFjdHVhbCwgZXhwZWN0ZWQsIGByZWFkLXdyaXRlLSR7Zn1gLCAwKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd3cml0ZSB0ZXh0IGxheWVyIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0d2lkdGg6IDIwMCxcclxuXHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bmFtZTogJ3RleHQgbGF5ZXInLFxyXG5cdFx0XHRcdFx0dGV4dDoge1xyXG5cdFx0XHRcdFx0XHR0ZXh0OiAnSGVsbG8gV29ybGRcXG7igKIgYyDigKIgdGlueSFcXHJcXG50ZXN0JyxcclxuXHRcdFx0XHRcdFx0Ly8gb3JpZW50YXRpb246ICd2ZXJ0aWNhbCcsXHJcblx0XHRcdFx0XHRcdHRyYW5zZm9ybTogWzEsIDAsIDAsIDEsIDcwLCA3MF0sXHJcblx0XHRcdFx0XHRcdHN0eWxlOiB7XHJcblx0XHRcdFx0XHRcdFx0Zm9udDogeyBuYW1lOiAnQXJpYWxNVCcgfSxcclxuXHRcdFx0XHRcdFx0XHRmb250U2l6ZTogMzAsXHJcblx0XHRcdFx0XHRcdFx0ZmlsbENvbG9yOiB7IHI6IDAsIGc6IDEyOCwgYjogMCB9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRzdHlsZVJ1bnM6IFtcclxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogMTIsIHN0eWxlOiB7IGZpbGxDb2xvcjogeyByOiAyNTUsIGc6IDAsIGI6IDAgfSB9IH0sXHJcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDEyLCBzdHlsZTogeyBmaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMjU1IH0gfSB9LFxyXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiA0LCBzdHlsZTogeyB1bmRlcmxpbmU6IHRydWUgfSB9LFxyXG5cdFx0XHRcdFx0XHRdLFxyXG5cdFx0XHRcdFx0XHRwYXJhZ3JhcGhTdHlsZToge1xyXG5cdFx0XHRcdFx0XHRcdGp1c3RpZmljYXRpb246ICdjZW50ZXInLFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR3YXJwOiB7XHJcblx0XHRcdFx0XHRcdFx0c3R5bGU6ICdhcmMnLFxyXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiA1MCxcclxuXHRcdFx0XHRcdFx0XHRwZXJzcGVjdGl2ZTogMCxcclxuXHRcdFx0XHRcdFx0XHRwZXJzcGVjdGl2ZU90aGVyOiAwLFxyXG5cdFx0XHRcdFx0XHRcdHJvdGF0ZTogJ2hvcml6b250YWwnLFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG5hbWU6ICcybmQgbGF5ZXInLFxyXG5cdFx0XHRcdFx0dGV4dDoge1xyXG5cdFx0XHRcdFx0XHR0ZXh0OiAnQWFhYWEnLFxyXG5cdFx0XHRcdFx0XHR0cmFuc2Zvcm06IFsxLCAwLCAwLCAxLCA3MCwgNzBdLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRdLFxyXG5cdFx0fTtcclxuXHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCAnX1RFWFQyLnBzZCcpLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgncmVhZCB0ZXh0IGxheWVyIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXh0LXRlc3QucHNkJyksIG9wdHMpO1xyXG5cdFx0Ly8gY29uc3QgbGF5ZXIgPSBwc2QuY2hpbGRyZW4hWzFdO1xyXG5cclxuXHRcdC8vIGxheWVyLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XHJcblx0XHRjb25zdCBidWZmZXIgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgJ19URVhULnBzZCcpLCBidWZmZXIpO1xyXG5cclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5jaGlsZHJlbiFbMF0udGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuY2hpbGRyZW4hWzFdLnRleHQsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgnUkVBRCBURVNUJywgKCkgPT4ge1xyXG5cdFx0Y29uc3Qgb3JpZ2luYWxCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICd0ZXN0LnBzZCcpKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnUkVBRElORyBPUklHSU5BTCcpO1xyXG5cdFx0Y29uc3Qgb3B0cyA9IHtcclxuXHRcdFx0bG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dXNlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHR1c2VSYXdUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0fTtcclxuXHRcdGNvbnN0IG9yaWdpbmFsUHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIob3JpZ2luYWxCdWZmZXIpLCBvcHRzKTtcclxuXHJcblx0XHRjb25zb2xlLmxvZygnV1JJVElORycpO1xyXG5cdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIob3JpZ2luYWxQc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGVtcC5wc2QnLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5iaW4nLCBidWZmZXIpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpLCAndXRmOCcpO1xyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygndGVtcC54bWwnLCBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcz8ueG1wTWV0YWRhdGEsICd1dGY4Jyk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1JFQURJTkcgV1JJVFRFTicpO1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKFxyXG5cdFx0XHRjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhvcmlnaW5hbFBzZCk7XHJcblx0XHRjbGVhckNhbnZhc0ZpZWxkcyhwc2QpO1xyXG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWw7XHJcblx0XHRkZWxldGUgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdGRlbGV0ZSBwc2QuaW1hZ2VSZXNvdXJjZXMhLnRodW1ibmFpbFJhdztcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KG9yaWdpbmFsUHNkLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCdvcmlnaW5hbC5qc29uJywgSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxQc2QsIG51bGwsIDIpKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ2FmdGVyLmpzb24nLCBKU09OLnN0cmluZ2lmeShwc2QsIG51bGwsIDIpKTtcclxuXHJcblx0XHRjb21wYXJlQnVmZmVycyhidWZmZXIsIG9yaWdpbmFsQnVmZmVyLCAndGVzdCcpO1xyXG5cclxuXHRcdGV4cGVjdChwc2QpLmVxbChvcmlnaW5hbFBzZCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2RlY29kZSBlbmdpbmUgZGF0YSAyJywgKCkgPT4ge1xyXG5cdFx0Ly8gY29uc3QgZmlsZURhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICdlbmdpbmVEYXRhMlZlcnRpY2FsLnR4dCcpKTtcclxuXHRcdGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJTaW1wbGUudHh0JykpO1xyXG5cdFx0Y29uc3QgZnVuYyA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZmlsZURhdGF9O2ApO1xyXG5cdFx0Y29uc3QgZGF0YSA9IGZ1bmMoKTtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IGRlY29kZUVuZ2luZURhdGEyKGRhdGEpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcclxuXHRcdFx0cGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc291cmNlcycsICd0ZW1wLmpzJyksXHJcblx0XHRcdCd2YXIgeCA9ICcgKyByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChyZXN1bHQsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXN0LnBzZCcsICgpID0+IHtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGVzdC5wc2QnKTtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHR9KTtcclxuXHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXN0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGB0ZXN0L3JlYWQtd3JpdGUvdGV4dC1ib3gvc3JjLnBzZGApKSwge1xyXG5cdFx0XHQvLyBza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHQvLyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdC8vIHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0fSk7XHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKCd0ZXh0X3JlY3Rfb3V0LnBzZCcsIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygndGV4dF9yZWN0X291dC5iaW4nLCB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pKTtcclxuXHRcdC8vIGNvbnN0IHBzZDIgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYHRleHRfcmVjdF9vdXQucHNkYCkpLCB7XHJcblx0XHQvLyBcdC8vIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHQvLyBcdC8vIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdC8vIFx0Ly8gc2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdC8vIFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHQvLyBcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0Ly8gfSk7XHJcblx0XHQvLyBwc2QyO1xyXG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBmcy5yZWFkRmlsZVN5bmMoYHRlc3QvcmVhZC13cml0ZS90ZXh0LWJveC9zcmMucHNkYCk7XHJcblx0XHRjb25zdCBvdXRwdXQgPSBmcy5yZWFkRmlsZVN5bmMoYHRleHRfcmVjdF9vdXQucHNkYCk7XHJcblx0XHRjb21wYXJlQnVmZmVycyhvdXRwdXQsIG9yaWdpbmFsLCAnLScsIDB4NjVkOCk7IC8vICwgMHg4Y2U4LCAweDhmY2EgLSAweDhjZTgpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdjb21wYXJlIHRlc3QnLCAoKSA9PiB7XHJcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgWyd0ZXh0X3BvaW50JywgJ3RleHRfcmVjdCddKSB7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgJHtuYW1lfS5wc2RgKSksIHtcclxuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR9KTtcclxuXHRcdFx0Ly8gcHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX0udHh0YCwgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRcdC8vIGNvbnN0IGVuZ2luZURhdGEgPSBwYXJzZUVuZ2luZURhdGEodG9CeXRlQXJyYXkocHNkLmVuZ2luZURhdGEhKSk7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoYCR7bmFtZX1fZW5naW5lZGF0YS50eHRgLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGV4dC1yZXBsYWNlLnBzZCcsICgpID0+IHtcclxuXHRcdHtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCd0ZXh0LXJlcGxhY2UyLnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7fSk7XHJcblx0XHRcdHBzZC5jaGlsZHJlbiFbMV0hLnRleHQhLnRleHQgPSAnRm9vIGJhcic7XHJcblx0XHRcdGNvbnN0IG91dHB1dCA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBpbnZhbGlkYXRlVGV4dExheWVyczogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdvdXQucHNkJywgb3V0cHV0KTtcclxuXHRcdH1cclxuXHJcblx0XHR7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYygndGV4dC1yZXBsYWNlLnBzZCcpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdFx0c2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0XHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0fSk7XHJcblx0XHRcdGRlbGV0ZSBwc2QuZW5naW5lRGF0YTtcclxuXHRcdFx0cHNkLmltYWdlUmVzb3VyY2VzID0ge307XHJcblx0XHRcdHBzZC5jaGlsZHJlbj8uc3BsaWNlKDAsIDEpO1xyXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKCdpbnB1dC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCdvdXQucHNkJyk7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR9KTtcclxuXHRcdFx0ZGVsZXRlIHBzZC5lbmdpbmVEYXRhO1xyXG5cdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0cHNkLmNoaWxkcmVuPy5zcGxpY2UoMCwgMSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ291dHB1dC50eHQnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG59KTtcclxuXHJcbmZ1bmN0aW9uIGNsZWFyRW1wdHlDYW52YXNGaWVsZHMobGF5ZXI6IExheWVyIHwgdW5kZWZpbmVkKSB7XHJcblx0aWYgKGxheWVyKSB7XHJcblx0XHRpZiAoJ2NhbnZhcycgaW4gbGF5ZXIgJiYgIWxheWVyLmNhbnZhcykgZGVsZXRlIGxheWVyLmNhbnZhcztcclxuXHRcdGlmICgnaW1hZ2VEYXRhJyBpbiBsYXllciAmJiAhbGF5ZXIuaW1hZ2VEYXRhKSBkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xyXG5cdFx0bGF5ZXIuY2hpbGRyZW4/LmZvckVhY2goY2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBjbGVhckNhbnZhc0ZpZWxkcyhsYXllcjogTGF5ZXIgfCB1bmRlZmluZWQpIHtcclxuXHRpZiAobGF5ZXIpIHtcclxuXHRcdGRlbGV0ZSBsYXllci5jYW52YXM7XHJcblx0XHRkZWxldGUgbGF5ZXIuaW1hZ2VEYXRhO1xyXG5cdFx0aWYgKGxheWVyLm1hc2spIGRlbGV0ZSBsYXllci5tYXNrLmNhbnZhcztcclxuXHRcdGlmIChsYXllci5tYXNrKSBkZWxldGUgbGF5ZXIubWFzay5pbWFnZURhdGE7XHJcblx0XHRsYXllci5jaGlsZHJlbj8uZm9yRWFjaChjbGVhckNhbnZhc0ZpZWxkcyk7XHJcblx0fVxyXG59XHJcblxyXG4vLy8gRW5naW5lIGRhdGEgMiBleHBlcmltZW50c1xyXG4vLyAvdGVzdC9lbmdpbmVEYXRhMi5qc29uOjExMDkgaXMgY2hhcmFjdGVyIGNvZGVzXHJcblxyXG5jb25zdCBrZXlzQ29sb3IgPSB7XHJcblx0JzAnOiB7XHJcblx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHQnMCc6IHsgbmFtZTogJ1R5cGUnIH0sXHJcblx0XHRcdCcxJzogeyBuYW1lOiAnVmFsdWVzJyB9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG59O1xyXG5cclxuY29uc3Qga2V5c1N0eWxlU2hlZXQgPSB7XHJcblx0JzAnOiB7IG5hbWU6ICdGb250JyB9LFxyXG5cdCcxJzogeyBuYW1lOiAnRm9udFNpemUnIH0sXHJcblx0JzInOiB7IG5hbWU6ICdGYXV4Qm9sZCcgfSxcclxuXHQnMyc6IHsgbmFtZTogJ0ZhdXhJdGFsaWMnIH0sXHJcblx0JzQnOiB7IG5hbWU6ICdBdXRvTGVhZGluZycgfSxcclxuXHQnNSc6IHsgbmFtZTogJ0xlYWRpbmcnIH0sXHJcblx0JzYnOiB7IG5hbWU6ICdIb3Jpem9udGFsU2NhbGUnIH0sXHJcblx0JzcnOiB7IG5hbWU6ICdWZXJ0aWNhbFNjYWxlJyB9LFxyXG5cdCc4JzogeyBuYW1lOiAnVHJhY2tpbmcnIH0sXHJcblx0JzknOiB7IG5hbWU6ICdCYXNlbGluZVNoaWZ0JyB9LFxyXG5cclxuXHQnMTEnOiB7IG5hbWU6ICdLZXJuaW5nPycgfSwgLy8gZGlmZmVyZW50IHZhbHVlIHRoYW4gRW5naW5lRGF0YVxyXG5cdCcxMic6IHsgbmFtZTogJ0ZvbnRDYXBzJyB9LFxyXG5cdCcxMyc6IHsgbmFtZTogJ0ZvbnRCYXNlbGluZScgfSxcclxuXHJcblx0JzE1JzogeyBuYW1lOiAnU3RyaWtldGhyb3VnaD8nIH0sIC8vIG51bWJlciBpbnN0ZWFkIG9mIGJvb2xcclxuXHQnMTYnOiB7IG5hbWU6ICdVbmRlcmxpbmU/JyB9LCAvLyBudW1iZXIgaW5zdGVhZCBvZiBib29sXHJcblxyXG5cdCcxOCc6IHsgbmFtZTogJ0xpZ2F0dXJlcycgfSxcclxuXHQnMTknOiB7IG5hbWU6ICdETGlnYXR1cmVzJyB9LFxyXG5cclxuXHQnMjMnOiB7IG5hbWU6ICdGcmFjdGlvbnMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHQnMjQnOiB7IG5hbWU6ICdPcmRpbmFscycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMjgnOiB7IG5hbWU6ICdTdHlsaXN0aWNBbHRlcm5hdGVzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCczMCc6IHsgbmFtZTogJ09sZFN0eWxlPycgfSwgLy8gT3BlblR5cGUgPiBPbGRTdHlsZSwgbnVtYmVyIGluc3RlYWQgb2YgYm9vbCwgbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMzUnOiB7IG5hbWU6ICdCYXNlbGluZURpcmVjdGlvbicgfSxcclxuXHJcblx0JzM4JzogeyBuYW1lOiAnTGFuZ3VhZ2UnIH0sXHJcblxyXG5cdCc1Mic6IHsgbmFtZTogJ05vQnJlYWsnIH0sXHJcblx0JzUzJzogeyBuYW1lOiAnRmlsbENvbG9yJywgY2hpbGRyZW46IGtleXNDb2xvciB9LFxyXG59O1xyXG5cclxuY29uc3Qga2V5c1BhcmFncmFwaCA9IHtcclxuXHQnMCc6IHsgbmFtZTogJ0p1c3RpZmljYXRpb24nIH0sXHJcblx0JzEnOiB7IG5hbWU6ICdGaXJzdExpbmVJbmRlbnQnIH0sXHJcblx0JzInOiB7IG5hbWU6ICdTdGFydEluZGVudCcgfSxcclxuXHQnMyc6IHsgbmFtZTogJ0VuZEluZGVudCcgfSxcclxuXHQnNCc6IHsgbmFtZTogJ1NwYWNlQmVmb3JlJyB9LFxyXG5cdCc1JzogeyBuYW1lOiAnU3BhY2VBZnRlcicgfSxcclxuXHJcblx0JzcnOiB7IG5hbWU6ICdBdXRvTGVhZGluZycgfSxcclxuXHJcblx0JzknOiB7IG5hbWU6ICdBdXRvSHlwaGVuYXRlJyB9LFxyXG5cdCcxMCc6IHsgbmFtZTogJ0h5cGhlbmF0ZWRXb3JkU2l6ZScgfSxcclxuXHQnMTEnOiB7IG5hbWU6ICdQcmVIeXBoZW4nIH0sXHJcblx0JzEyJzogeyBuYW1lOiAnUG9zdEh5cGhlbicgfSxcclxuXHQnMTMnOiB7IG5hbWU6ICdDb25zZWN1dGl2ZUh5cGhlbnM/JyB9LCAvLyBkaWZmZXJlbnQgdmFsdWUgdGhhbiBFbmdpbmVEYXRhXHJcblx0JzE0JzogeyBuYW1lOiAnWm9uZScgfSxcclxuXHQnMTUnOiB7IG5hbWU6ICdIeXBlbmF0ZUNhcGl0YWxpemVkV29yZHMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzE3JzogeyBuYW1lOiAnV29yZFNwYWNpbmcnIH0sXHJcblx0JzE4JzogeyBuYW1lOiAnTGV0dGVyU3BhY2luZycgfSxcclxuXHQnMTknOiB7IG5hbWU6ICdHbHlwaFNwYWNpbmcnIH0sXHJcblxyXG5cdCczMic6IHsgbmFtZTogJ1N0eWxlU2hlZXQnLCBjaGlsZHJlbjoga2V5c1N0eWxlU2hlZXQgfSxcclxufTtcclxuXHJcbmNvbnN0IGtleXNTdHlsZVNoZWV0RGF0YSA9IHtcclxuXHRuYW1lOiAnU3R5bGVTaGVldERhdGEnLFxyXG5cdGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCxcclxufTtcclxuXHJcbmNvbnN0IGtleXMgPSB7XHJcblx0JzAnOiB7XHJcblx0XHRuYW1lOiAnUmVzb3VyY2VEaWN0JyxcclxuXHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdGb250U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzInOiB7IG5hbWU6ICdGb250VHlwZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcyJzoge1xyXG5cdFx0XHRcdG5hbWU6ICcyJyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge30sXHJcblx0XHRcdH0sXHJcblx0XHRcdCczJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdNb2ppS3VtaVNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ0ludGVybmFsTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzQnOiB7XHJcblx0XHRcdFx0bmFtZTogJ0tpbnNva3VTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTm9TdGFydCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnTm9FbmQnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMic6IHsgbmFtZTogJ0tlZXAnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMyc6IHsgbmFtZTogJ0hhbmdpbmcnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXRTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcclxuXHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzYnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0U2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnTmFtZScgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1Byb3BlcnRpZXMnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNic6IHsgbmFtZTogJ0RlZmF1bHRTdHlsZVNoZWV0JyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnOCc6IHtcclxuXHRcdFx0XHRuYW1lOiAnOCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnOSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnUHJlZGVmaW5lZCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG5cdCcxJzoge1xyXG5cdFx0bmFtZTogJ0VuZ2luZURpY3QnLFxyXG5cdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0bmFtZTogJzAnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJzAnLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCczJzogeyBuYW1lOiAnU3VwZXJzY3JpcHRTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzQnOiB7IG5hbWU6ICdTdXBlcnNjcmlwdFBvc2l0aW9uJyB9LFxyXG5cdFx0XHRcdFx0JzUnOiB7IG5hbWU6ICdTdWJzY3JpcHRTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICdTdWJzY3JpcHRQb3NpdGlvbicgfSxcclxuXHRcdFx0XHRcdCc3JzogeyBuYW1lOiAnU21hbGxDYXBTaXplJyB9LFxyXG5cdFx0XHRcdFx0JzgnOiB7IG5hbWU6ICdVc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHMnIH0sIC8vID8/P1xyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdG5hbWU6ICdFZGl0b3JzPycsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAnRWRpdG9yJyxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ1RleHQnIH0sXHJcblx0XHRcdFx0XHRcdFx0JzUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoUnVuJyxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdSdW5BcnJheScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICcwJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnNScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnNicgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ1J1bkxlbmd0aCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdCc2Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1N0eWxlUnVuJyxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdSdW5BcnJheScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnU3R5bGVTaGVldCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnNic6IGtleXNTdHlsZVNoZWV0RGF0YSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMSc6IHsgbmFtZTogJ1J1bkxlbmd0aCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCcxJzoge1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAnRm9udFZlY3RvckRhdGEgPz8/JyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzInOiB7XHJcblx0XHRcdFx0bmFtZTogJ1N0eWxlU2hlZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzMnOiB7XHJcblx0XHRcdFx0bmFtZTogJ1BhcmFncmFwaFNoZWV0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0fSxcclxufTtcclxuXHJcbmZ1bmN0aW9uIGRlY29kZU9iaihvYmo6IGFueSwga2V5czogYW55KTogYW55IHtcclxuXHRpZiAob2JqID09PSBudWxsIHx8ICFrZXlzKSByZXR1cm4gb2JqO1xyXG5cclxuXHRpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XHJcblx0XHRyZXR1cm4gb2JqLm1hcCh4ID0+IGRlY29kZU9iaih4LCBrZXlzKSk7XHJcblx0fVxyXG5cclxuXHRpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHJldHVybiBvYmo7XHJcblxyXG5cdGNvbnN0IHJlc3VsdDogYW55ID0ge307XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9iaikpIHtcclxuXHRcdGlmIChrZXlzW2tleV0pIHtcclxuXHRcdFx0aWYgKGtleXNba2V5XS51cHJvb3QpIHtcclxuXHRcdFx0XHRyZXR1cm4gZGVjb2RlT2JqKG9ialtrZXldLCBrZXlzW2tleV0uY2hpbGRyZW4pO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHJlc3VsdFtrZXlzW2tleV0ubmFtZV0gPSBkZWNvZGVPYmoob2JqW2tleV0sIGtleXNba2V5XS5jaGlsZHJlbik7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0gb2JqW2tleV07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVFbmdpbmVEYXRhMihkYXRhOiBhbnkpIHtcclxuXHRyZXR1cm4gZGVjb2RlT2JqKGRhdGEsIGtleXMpO1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
