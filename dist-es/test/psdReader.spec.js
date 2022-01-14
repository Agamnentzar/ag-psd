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
        expect(psd.children[2].children[0].parentPath).to.equal('Group 1');
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
        // fs.readdirSync(readFilesPath).filter(f => /fill-opacity/.test(f)).forEach(f => {
        it("reads PSD file (" + f + ")", function () {
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
            compare.forEach(function (i) { return i.skip || compareCanvases(images[i.name], i.canvas, f + "/" + i.name); });
            compareFiles.forEach(function (i) { return compareTwoFiles(path.join(basePath, i.name), i.data, f + "/" + i.name); });
        });
    });
    fs.readdirSync(readWriteFilesPath).forEach(function (f) {
        // fs.readdirSync(readWriteFilesPath).filter(f => /annot/.test(f)).forEach(f => {
        it("reads-writes PSD file (" + f + ")", function () {
            var ext = fs.existsSync(path.join(readWriteFilesPath, f, 'src.psb')) ? 'psb' : 'psd';
            var psd = readPsdFromFile(path.join(readWriteFilesPath, f, "src." + ext), __assign(__assign({}, opts), { useImageData: true, useRawThumbnail: true, throwForMissingFeatures: true }));
            var actual = writePsdBuffer(psd, { logMissingFeatures: true, psb: ext === 'psb' });
            var expected = fs.readFileSync(path.join(readWriteFilesPath, f, "expected." + ext));
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-" + f + "." + ext), actual);
            fs.writeFileSync(path.join(resultsFilesPath, "read-write-" + f + ".bin"), actual);
            // console.log(require('util').inspect(psd, false, 99, true));
            // const psd2 = readPsdFromFile(path.join(resultsFilesPath, `read-write-${f}.psd`), { ...opts, useImageData: true, useRawThumbnail: true });
            // fs.writeFileSync('temp.txt', require('util').inspect(psd, false, 99, false), 'utf8');
            // fs.writeFileSync('temp2.txt', require('util').inspect(psd2, false, 99, false), 'utf8');
            compareBuffers(actual, expected, "read-write-" + f, 0);
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
        var func = new Function("return " + fileData + ";");
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
        console.log(require('util').inspect(psd, false, 99, true));
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
            var psd = readPsdInternal(createReaderFromBuffer(fs.readFileSync(name_1 + ".psd")), {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ2QsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFO2dCQUNyQixPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQy9DO2lCQUFNO2dCQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDakU7U0FDRDthQUFNO1lBQ04sTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUN2QjtLQUNEO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxJQUFTO0lBQ25DLE9BQU8sU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM5QixDQUFDIiwiZmlsZSI6InRlc3QvcHNkUmVhZGVyLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQge1xyXG5cdHJlYWRQc2RGcm9tRmlsZSwgaW1wb3J0UFNELCBsb2FkSW1hZ2VzRnJvbURpcmVjdG9yeSwgY29tcGFyZUNhbnZhc2VzLCBzYXZlQ2FudmFzLFxyXG5cdGNyZWF0ZVJlYWRlckZyb21CdWZmZXIsIGNvbXBhcmVCdWZmZXJzLCBjb21wYXJlVHdvRmlsZXNcclxufSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IExheWVyLCBSZWFkT3B0aW9ucywgUHNkIH0gZnJvbSAnLi4vcHNkJztcclxuaW1wb3J0IHsgcmVhZFBzZCwgd3JpdGVQc2RCdWZmZXIgfSBmcm9tICcuLi9pbmRleCc7XHJcbmltcG9ydCB7IHJlYWRQc2QgYXMgcmVhZFBzZEludGVybmFsIH0gZnJvbSAnLi4vcHNkUmVhZGVyJztcclxuXHJcbmNvbnN0IHRlc3RGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcpO1xyXG5jb25zdCByZWFkRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkJyk7XHJcbmNvbnN0IHJlYWRXcml0ZUZpbGVzUGF0aCA9IHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAncmVhZC13cml0ZScpO1xyXG5jb25zdCByZXN1bHRzRmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc3VsdHMnKTtcclxuY29uc3Qgb3B0czogUmVhZE9wdGlvbnMgPSB7XHJcblx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0bG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG59O1xyXG5cclxuZGVzY3JpYmUoJ1BzZFJlYWRlcicsICgpID0+IHtcclxuXHRpdCgncmVhZHMgd2lkdGggYW5kIGhlaWdodCBwcm9wZXJseScsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2JsZW5kLW1vZGUnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMgfSk7XHJcblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xyXG5cdFx0ZXhwZWN0KHBzZC5oZWlnaHQpLmVxdWFsKDIwMCk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdza2lwcyBjb21wb3NpdGUgaW1hZ2UgZGF0YScsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgJ2xheWVycycsICdzcmMucHNkJyksIHsgLi4ub3B0cywgc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSB9KTtcclxuXHRcdGV4cGVjdChwc2QuY2FudmFzKS5ub3Qub2s7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdmZXRjaGVzIGEgbGF5ZXIgZ3JvdXAnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICduZXN0ZWQtbGF5ZXJzJywgJ3NyYy5wc2QnKSwgeyAuLi5vcHRzLCBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUgfSk7XHJcblx0XHRleHBlY3QocHNkLmNoaWxkcmVuIVsyXS5uYW1lKS50by5lcXVhbCgnR3JvdXAgMScpO1xyXG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMl0uY2hpbGRyZW4hWzBdLm5hbWUpLnRvLmVxdWFsKCdHcm91cENoaWxkMScpO1xyXG5cdFx0ZXhwZWN0KHBzZC5jaGlsZHJlbiFbMl0uY2hpbGRyZW4hWzBdLnBhcmVudFBhdGgpLnRvLmVxdWFsKCdHcm91cCAxJyk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCdyZWFkcyBQU0QgZnJvbSBCdWZmZXIgd2l0aCBvZmZzZXQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBmaWxlID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnbGF5ZXJzJywgJ3NyYy5wc2QnKSk7XHJcblx0XHRjb25zdCBvdXRlciA9IEJ1ZmZlci5hbGxvYyhmaWxlLmJ5dGVMZW5ndGggKyAxMDApO1xyXG5cdFx0ZmlsZS5jb3B5KG91dGVyLCAxMDApO1xyXG5cdFx0Y29uc3QgaW5uZXIgPSBCdWZmZXIuZnJvbShvdXRlci5idWZmZXIsIDEwMCwgZmlsZS5ieXRlTGVuZ3RoKTtcclxuXHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkKGlubmVyLCBvcHRzKTtcclxuXHJcblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdkdXBsaWNhdGUgc21hcnQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKCdyZXNvdXJjZXMnLCAnc3JjLnBzZCcpLCB7IC4uLm9wdHMgfSk7XHJcblxyXG5cdFx0Y29uc3QgY2hpbGQgPSBwc2QuY2hpbGRyZW4hWzFdLmNoaWxkcmVuIVswXTtcclxuXHRcdHBzZC5jaGlsZHJlbiFbMV0uY2hpbGRyZW4hLnB1c2goY2hpbGQpO1xyXG5cclxuXHRcdC8vIGNvbnN0IGNoaWxkID0gcHNkLmNoaWxkcmVuIVswXTtcclxuXHRcdC8vIGRlbGV0ZSBjaGlsZC5pZDtcclxuXHRcdC8vIHBzZC5jaGlsZHJlbiEucHVzaChjaGlsZCk7XHJcblxyXG5cdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0cHV0LnBzZCcsIHdyaXRlUHNkQnVmZmVyKHBzZCwge1xyXG5cdFx0XHR0cmltSW1hZ2VEYXRhOiBmYWxzZSxcclxuXHRcdFx0Z2VuZXJhdGVUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdG5vQmFja2dyb3VuZDogdHJ1ZVxyXG5cdFx0fSkpO1xyXG5cclxuXHRcdGNvbnN0IHBzZDIgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKCdvdXRwdXQucHNkJyksIHsgLi4ub3B0cyB9KTtcclxuXHJcblx0XHRjb25zb2xlLmxvZyhwc2QyLndpZHRoKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gc2tpcHBpbmcgXCJwYXR0ZXJuXCIgdGVzdCBiZWNhdXNlIGl0IHJlcXVpcmVzIHppcCBjaW1wcmVzc2lvbiBvZiBwYXR0ZXJuc1xyXG5cdC8vIHNraXBwaW5nIFwiY215a1wiIHRlc3QgYmVjYXVzZSB3ZSBjYW4ndCBjb252ZXJ0IENNWUsgdG8gUkdCXHJcblx0ZnMucmVhZGRpclN5bmMocmVhZEZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gIS9wYXR0ZXJufGNteWsvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHQvLyBmcy5yZWFkZGlyU3luYyhyZWFkRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAvZmlsbC1vcGFjaXR5Ly50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0aXQoYHJlYWRzIFBTRCBmaWxlICgke2Z9KWAsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgYmFzZVBhdGggPSBwYXRoLmpvaW4ocmVhZEZpbGVzUGF0aCwgZik7XHJcblx0XHRcdGNvbnN0IGZpbGVOYW1lID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oYmFzZVBhdGgsICdzcmMucHNiJykpID8gJ3NyYy5wc2InIDogJ3NyYy5wc2QnO1xyXG5cdFx0XHRjb25zdCBwc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKGJhc2VQYXRoLCBmaWxlTmFtZSksIHsgLi4ub3B0cyB9KTtcclxuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBpbXBvcnRQU0QoYmFzZVBhdGgpO1xyXG5cdFx0XHRjb25zdCBpbWFnZXMgPSBsb2FkSW1hZ2VzRnJvbURpcmVjdG9yeShiYXNlUGF0aCk7XHJcblx0XHRcdGNvbnN0IGNvbXBhcmU6IHsgbmFtZTogc3RyaW5nOyBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50IHwgdW5kZWZpbmVkOyBza2lwPzogYm9vbGVhbjsgfVtdID0gW107XHJcblx0XHRcdGNvbnN0IGNvbXBhcmVGaWxlczogeyBuYW1lOiBzdHJpbmc7IGRhdGE6IFVpbnQ4QXJyYXk7IH1bXSA9IFtdO1xyXG5cclxuXHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGNhbnZhcy5wbmdgLCBjYW52YXM6IHBzZC5jYW52YXMgfSk7XHJcblx0XHRcdHBzZC5jYW52YXMgPSB1bmRlZmluZWQ7XHJcblx0XHRcdGRlbGV0ZSBwc2QuaW1hZ2VEYXRhO1xyXG5cdFx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS54bXBNZXRhZGF0YTtcclxuXHJcblx0XHRcdGxldCBpID0gMDtcclxuXHJcblx0XHRcdGZ1bmN0aW9uIHB1c2hMYXllckNhbnZhc2VzKGxheWVyczogTGF5ZXJbXSkge1xyXG5cdFx0XHRcdGZvciAoY29uc3QgbCBvZiBsYXllcnMpIHtcclxuXHRcdFx0XHRcdGlmIChsLmNoaWxkcmVuKSB7XHJcblx0XHRcdFx0XHRcdHB1c2hMYXllckNhbnZhc2VzKGwuY2hpbGRyZW4pO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgbGF5ZXJJZCA9IGkrKztcclxuXHRcdFx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogYGxheWVyLSR7bGF5ZXJJZH0ucG5nYCwgY2FudmFzOiBsLmNhbnZhcyB9KTtcclxuXHRcdFx0XHRcdFx0bC5jYW52YXMgPSB1bmRlZmluZWQ7XHJcblx0XHRcdFx0XHRcdGRlbGV0ZSBsLmltYWdlRGF0YTtcclxuXHJcblx0XHRcdFx0XHRcdGlmIChsLm1hc2spIHtcclxuXHRcdFx0XHRcdFx0XHRjb21wYXJlLnB1c2goeyBuYW1lOiBgbGF5ZXItJHtsYXllcklkfS1tYXNrLnBuZ2AsIGNhbnZhczogbC5tYXNrLmNhbnZhcyB9KTtcclxuXHRcdFx0XHRcdFx0XHRkZWxldGUgbC5tYXNrLmNhbnZhcztcclxuXHRcdFx0XHRcdFx0XHRkZWxldGUgbC5tYXNrLmltYWdlRGF0YTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHBzZC5saW5rZWRGaWxlcykge1xyXG5cdFx0XHRcdGZvciAoY29uc3QgZmlsZSBvZiBwc2QubGlua2VkRmlsZXMpIHtcclxuXHRcdFx0XHRcdGlmIChmaWxlLmRhdGEpIHtcclxuXHRcdFx0XHRcdFx0Y29tcGFyZUZpbGVzLnB1c2goeyBuYW1lOiBmaWxlLm5hbWUsIGRhdGE6IGZpbGUuZGF0YSB9KTtcclxuXHRcdFx0XHRcdFx0ZGVsZXRlIGZpbGUuZGF0YTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHB1c2hMYXllckNhbnZhc2VzKHBzZC5jaGlsZHJlbiB8fCBbXSk7XHJcblx0XHRcdGZzLm1rZGlyU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xyXG5cclxuXHRcdFx0aWYgKHBzZC5pbWFnZVJlc291cmNlcz8udGh1bWJuYWlsKSB7XHJcblx0XHRcdFx0Y29tcGFyZS5wdXNoKHsgbmFtZTogJ3RodW1iLnBuZycsIGNhbnZhczogcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbCwgc2tpcDogdHJ1ZSB9KTtcclxuXHRcdFx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzLnRodW1ibmFpbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHBzZC5pbWFnZVJlc291cmNlcykgZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcy50aHVtYm5haWxSYXc7XHJcblxyXG5cdFx0XHRjb21wYXJlLmZvckVhY2goaSA9PiBzYXZlQ2FudmFzKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBmLCBpLm5hbWUpLCBpLmNhbnZhcykpO1xyXG5cdFx0XHRjb21wYXJlRmlsZXMuZm9yRWFjaChpID0+IGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGYsIGkubmFtZSksIGkuZGF0YSkpO1xyXG5cclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgZiwgJ2RhdGEuanNvbicpLCBKU09OLnN0cmluZ2lmeShwc2QsIG51bGwsIDIpLCAndXRmOCcpO1xyXG5cclxuXHRcdFx0Y2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhwc2QpO1xyXG5cdFx0XHRjbGVhckVtcHR5Q2FudmFzRmllbGRzKGV4cGVjdGVkKTtcclxuXHJcblx0XHRcdGV4cGVjdChwc2QpLmVxbChleHBlY3RlZCwgZik7XHJcblx0XHRcdGNvbXBhcmUuZm9yRWFjaChpID0+IGkuc2tpcCB8fCBjb21wYXJlQ2FudmFzZXMoaW1hZ2VzW2kubmFtZV0sIGkuY2FudmFzLCBgJHtmfS8ke2kubmFtZX1gKSk7XHJcblx0XHRcdGNvbXBhcmVGaWxlcy5mb3JFYWNoKGkgPT4gY29tcGFyZVR3b0ZpbGVzKHBhdGguam9pbihiYXNlUGF0aCwgaS5uYW1lKSwgaS5kYXRhLCBgJHtmfS8ke2kubmFtZX1gKSk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHJcblx0ZnMucmVhZGRpclN5bmMocmVhZFdyaXRlRmlsZXNQYXRoKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0Ly8gZnMucmVhZGRpclN5bmMocmVhZFdyaXRlRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAvYW5ub3QvLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHRpdChgcmVhZHMtd3JpdGVzIFBTRCBmaWxlICgke2Z9KWAsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgZXh0ID0gZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCAnc3JjLnBzYicpKSA/ICdwc2InIDogJ3BzZCc7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4ocmVhZFdyaXRlRmlsZXNQYXRoLCBmLCBgc3JjLiR7ZXh0fWApLCB7XHJcblx0XHRcdFx0Li4ub3B0cywgdXNlSW1hZ2VEYXRhOiB0cnVlLCB1c2VSYXdUaHVtYm5haWw6IHRydWUsIHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRjb25zdCBhY3R1YWwgPSB3cml0ZVBzZEJ1ZmZlcihwc2QsIHsgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCBwc2I6IGV4dCA9PT0gJ3BzYicgfSk7XHJcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihyZWFkV3JpdGVGaWxlc1BhdGgsIGYsIGBleHBlY3RlZC4ke2V4dH1gKSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0uJHtleHR9YCksIGFjdHVhbCk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGByZWFkLXdyaXRlLSR7Zn0uYmluYCksIGFjdHVhbCk7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0XHQvLyBjb25zdCBwc2QyID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgcmVhZC13cml0ZS0ke2Z9LnBzZGApLCB7IC4uLm9wdHMsIHVzZUltYWdlRGF0YTogdHJ1ZSwgdXNlUmF3VGh1bWJuYWlsOiB0cnVlIH0pO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCd0ZW1wLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAyLnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZDIsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cclxuXHRcdFx0Y29tcGFyZUJ1ZmZlcnMoYWN0dWFsLCBleHBlY3RlZCwgYHJlYWQtd3JpdGUtJHtmfWAsIDApO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3dyaXRlIHRleHQgbGF5ZXIgdGVzdCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHR3aWR0aDogMjAwLFxyXG5cdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRuYW1lOiAndGV4dCBsYXllcicsXHJcblx0XHRcdFx0XHR0ZXh0OiB7XHJcblx0XHRcdFx0XHRcdHRleHQ6ICdIZWxsbyBXb3JsZFxcbuKAoiBjIOKAoiB0aW55IVxcclxcbnRlc3QnLFxyXG5cdFx0XHRcdFx0XHQvLyBvcmllbnRhdGlvbjogJ3ZlcnRpY2FsJyxcclxuXHRcdFx0XHRcdFx0dHJhbnNmb3JtOiBbMSwgMCwgMCwgMSwgNzAsIDcwXSxcclxuXHRcdFx0XHRcdFx0c3R5bGU6IHtcclxuXHRcdFx0XHRcdFx0XHRmb250OiB7IG5hbWU6ICdBcmlhbE1UJyB9LFxyXG5cdFx0XHRcdFx0XHRcdGZvbnRTaXplOiAzMCxcclxuXHRcdFx0XHRcdFx0XHRmaWxsQ29sb3I6IHsgcjogMCwgZzogMTI4LCBiOiAwIH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdHN0eWxlUnVuczogW1xyXG5cdFx0XHRcdFx0XHRcdHsgbGVuZ3RoOiAxMiwgc3R5bGU6IHsgZmlsbENvbG9yOiB7IHI6IDI1NSwgZzogMCwgYjogMCB9IH0gfSxcclxuXHRcdFx0XHRcdFx0XHR7IGxlbmd0aDogMTIsIHN0eWxlOiB7IGZpbGxDb2xvcjogeyByOiAwLCBnOiAwLCBiOiAyNTUgfSB9IH0sXHJcblx0XHRcdFx0XHRcdFx0eyBsZW5ndGg6IDQsIHN0eWxlOiB7IHVuZGVybGluZTogdHJ1ZSB9IH0sXHJcblx0XHRcdFx0XHRcdF0sXHJcblx0XHRcdFx0XHRcdHBhcmFncmFwaFN0eWxlOiB7XHJcblx0XHRcdFx0XHRcdFx0anVzdGlmaWNhdGlvbjogJ2NlbnRlcicsXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdHdhcnA6IHtcclxuXHRcdFx0XHRcdFx0XHRzdHlsZTogJ2FyYycsXHJcblx0XHRcdFx0XHRcdFx0dmFsdWU6IDUwLFxyXG5cdFx0XHRcdFx0XHRcdHBlcnNwZWN0aXZlOiAwLFxyXG5cdFx0XHRcdFx0XHRcdHBlcnNwZWN0aXZlT3RoZXI6IDAsXHJcblx0XHRcdFx0XHRcdFx0cm90YXRlOiAnaG9yaXpvbnRhbCcsXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0bmFtZTogJzJuZCBsYXllcicsXHJcblx0XHRcdFx0XHR0ZXh0OiB7XHJcblx0XHRcdFx0XHRcdHRleHQ6ICdBYWFhYScsXHJcblx0XHRcdFx0XHRcdHRyYW5zZm9ybTogWzEsIDAsIDAsIDEsIDcwLCA3MF0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdF0sXHJcblx0XHR9O1xyXG5cclxuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsICdfVEVYVDIucHNkJyksIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdyZWFkIHRleHQgbGF5ZXIgdGVzdCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RGcm9tRmlsZShwYXRoLmpvaW4odGVzdEZpbGVzUGF0aCwgJ3RleHQtdGVzdC5wc2QnKSwgb3B0cyk7XHJcblx0XHQvLyBjb25zdCBsYXllciA9IHBzZC5jaGlsZHJlbiFbMV07XHJcblxyXG5cdFx0Ly8gbGF5ZXIudGV4dCEudGV4dCA9ICdGb28gYmFyJztcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCAnX1RFWFQucHNkJyksIGJ1ZmZlcik7XHJcblxyXG5cdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QocHNkLmNoaWxkcmVuIVswXS50ZXh0LCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZC5jaGlsZHJlbiFbMV0udGV4dCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QuZW5naW5lRGF0YSwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ1JFQUQgVEVTVCcsICgpID0+IHtcclxuXHRcdGNvbnN0IG9yaWdpbmFsQnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAndGVzdC5wc2QnKSk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1JFQURJTkcgT1JJR0lOQUwnKTtcclxuXHRcdGNvbnN0IG9wdHMgPSB7XHJcblx0XHRcdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdHVzZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0dXNlUmF3VGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRsb2dEZXZGZWF0dXJlczogdHJ1ZSxcclxuXHRcdH07XHJcblx0XHRjb25zdCBvcmlnaW5hbFBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKG9yaWdpbmFsQnVmZmVyKSwgb3B0cyk7XHJcblxyXG5cdFx0Y29uc29sZS5sb2coJ1dSSVRJTkcnKTtcclxuXHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKG9yaWdpbmFsUHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAucHNkJywgYnVmZmVyKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuYmluJywgYnVmZmVyKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHRcdC8vIGZzLndyaXRlRmlsZVN5bmMoJ3RlbXAueG1sJywgb3JpZ2luYWxQc2QuaW1hZ2VSZXNvdXJjZXM/LnhtcE1ldGFkYXRhLCAndXRmOCcpO1xyXG5cclxuXHRcdGNvbnNvbGUubG9nKCdSRUFESU5HIFdSSVRURU4nKTtcclxuXHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChcclxuXHRcdFx0Y3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcblxyXG5cdFx0Y2xlYXJDYW52YXNGaWVsZHMob3JpZ2luYWxQc2QpO1xyXG5cdFx0Y2xlYXJDYW52YXNGaWVsZHMocHNkKTtcclxuXHRcdGRlbGV0ZSBvcmlnaW5hbFBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsO1xyXG5cdFx0ZGVsZXRlIHBzZC5pbWFnZVJlc291cmNlcyEudGh1bWJuYWlsO1xyXG5cdFx0ZGVsZXRlIG9yaWdpbmFsUHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XHJcblx0XHRkZWxldGUgcHNkLmltYWdlUmVzb3VyY2VzIS50aHVtYm5haWxSYXc7XHJcblx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChvcmlnaW5hbFBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0Ly8gZnMud3JpdGVGaWxlU3luYygnb3JpZ2luYWwuanNvbicsIEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsUHNkLCBudWxsLCAyKSk7XHJcblx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKCdhZnRlci5qc29uJywgSlNPTi5zdHJpbmdpZnkocHNkLCBudWxsLCAyKSk7XHJcblxyXG5cdFx0Y29tcGFyZUJ1ZmZlcnMoYnVmZmVyLCBvcmlnaW5hbEJ1ZmZlciwgJ3Rlc3QnKTtcclxuXHJcblx0XHRleHBlY3QocHNkKS5lcWwob3JpZ2luYWxQc2QpO1xyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCdkZWNvZGUgZW5naW5lIGRhdGEgMicsICgpID0+IHtcclxuXHRcdC8vIGNvbnN0IGZpbGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAnZW5naW5lRGF0YTJWZXJ0aWNhbC50eHQnKSk7XHJcblx0XHRjb25zdCBmaWxlRGF0YSA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzb3VyY2VzJywgJ2VuZ2luZURhdGEyU2ltcGxlLnR4dCcpKTtcclxuXHRcdGNvbnN0IGZ1bmMgPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2ZpbGVEYXRhfTtgKTtcclxuXHRcdGNvbnN0IGRhdGEgPSBmdW5jKCk7XHJcblx0XHRjb25zdCByZXN1bHQgPSBkZWNvZGVFbmdpbmVEYXRhMihkYXRhKTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoXHJcblx0XHRcdHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXNvdXJjZXMnLCAndGVtcC5qcycpLFxyXG5cdFx0XHQndmFyIHggPSAnICsgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QocmVzdWx0LCBmYWxzZSwgOTksIGZhbHNlKSwgJ3V0ZjgnKTtcclxuXHR9KTtcclxuXHJcblx0aXQuc2tpcCgndGVzdC5wc2QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3Rlc3QucHNkJyk7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpLCB7XHJcblx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0c2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0fSk7XHJcblx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XHJcblx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ3Rlc3QnLCAoKSA9PiB7XHJcblx0XHRjb25zdCBwc2QgPSByZWFkUHNkSW50ZXJuYWwoY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihmcy5yZWFkRmlsZVN5bmMoYHRlc3QvcmVhZC13cml0ZS90ZXh0LWJveC9zcmMucHNkYCkpLCB7XHJcblx0XHRcdC8vIHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdC8vIHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0Ly8gc2tpcFRodW1ibmFpbDogdHJ1ZSxcclxuXHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR1c2VSYXdUaHVtYm5haWw6IHRydWUsXHJcblx0XHR9KTtcclxuXHRcdGZzLndyaXRlRmlsZVN5bmMoJ3RleHRfcmVjdF9vdXQucHNkJywgd3JpdGVQc2RCdWZmZXIocHNkLCB7IGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KSk7XHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKCd0ZXh0X3JlY3Rfb3V0LmJpbicsIHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSkpO1xyXG5cdFx0Ly8gY29uc3QgcHNkMiA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGZzLnJlYWRGaWxlU3luYyhgdGV4dF9yZWN0X291dC5wc2RgKSksIHtcclxuXHRcdC8vIFx0Ly8gc2tpcENvbXBvc2l0ZUltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdC8vIFx0Ly8gc2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0Ly8gXHQvLyBza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0Ly8gXHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRcdC8vIFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHQvLyB9KTtcclxuXHRcdC8vIHBzZDI7XHJcblx0XHRjb25zdCBvcmlnaW5hbCA9IGZzLnJlYWRGaWxlU3luYyhgdGVzdC9yZWFkLXdyaXRlL3RleHQtYm94L3NyYy5wc2RgKTtcclxuXHRcdGNvbnN0IG91dHB1dCA9IGZzLnJlYWRGaWxlU3luYyhgdGV4dF9yZWN0X291dC5wc2RgKTtcclxuXHRcdGNvbXBhcmVCdWZmZXJzKG91dHB1dCwgb3JpZ2luYWwsICctJywgMHg2NWQ4KTsgLy8gLCAweDhjZTgsIDB4OGZjYSAtIDB4OGNlOCk7XHJcblx0fSk7XHJcblxyXG5cdGl0LnNraXAoJ2NvbXBhcmUgdGVzdCcsICgpID0+IHtcclxuXHRcdGZvciAoY29uc3QgbmFtZSBvZiBbJ3RleHRfcG9pbnQnLCAndGV4dF9yZWN0J10pIHtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoZnMucmVhZEZpbGVTeW5jKGAke25hbWV9LnBzZGApKSwge1xyXG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdH0pO1xyXG5cdFx0XHQvLyBwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhgJHtuYW1lfS50eHRgLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChwc2QsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cclxuXHRcdFx0Ly8gY29uc3QgZW5naW5lRGF0YSA9IHBhcnNlRW5naW5lRGF0YSh0b0J5dGVBcnJheShwc2QuZW5naW5lRGF0YSEpKTtcclxuXHRcdFx0Ly8gZnMud3JpdGVGaWxlU3luYyhgJHtuYW1lfV9lbmdpbmVkYXRhLnR4dGAsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGVuZ2luZURhdGEsIGZhbHNlLCA5OSwgZmFsc2UpLCAndXRmOCcpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRpdC5za2lwKCd0ZXh0LXJlcGxhY2UucHNkJywgKCkgPT4ge1xyXG5cdFx0e1xyXG5cdFx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ3RleHQtcmVwbGFjZTIucHNkJyk7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHt9KTtcclxuXHRcdFx0cHNkLmNoaWxkcmVuIVsxXSEudGV4dCEudGV4dCA9ICdGb28gYmFyJztcclxuXHRcdFx0Y29uc3Qgb3V0cHV0ID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGludmFsaWRhdGVUZXh0TGF5ZXJzOiB0cnVlLCBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ291dC5wc2QnLCBvdXRwdXQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKCd0ZXh0LXJlcGxhY2UucHNkJyk7XHJcblx0XHRcdGNvbnN0IHBzZCA9IHJlYWRQc2RJbnRlcm5hbChjcmVhdGVSZWFkZXJGcm9tQnVmZmVyKGJ1ZmZlciksIHtcclxuXHRcdFx0XHRza2lwQ29tcG9zaXRlSW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSxcclxuXHRcdFx0XHRza2lwVGh1bWJuYWlsOiB0cnVlLFxyXG5cdFx0XHRcdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHRcdGxvZ0RldkZlYXR1cmVzOiB0cnVlLFxyXG5cdFx0XHR9KTtcclxuXHRcdFx0ZGVsZXRlIHBzZC5lbmdpbmVEYXRhO1xyXG5cdFx0XHRwc2QuaW1hZ2VSZXNvdXJjZXMgPSB7fTtcclxuXHRcdFx0cHNkLmNoaWxkcmVuPy5zcGxpY2UoMCwgMSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMoJ2lucHV0LnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHR9XHJcblxyXG5cdFx0e1xyXG5cdFx0XHRjb25zdCBidWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoJ291dC5wc2QnKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gcmVhZFBzZEludGVybmFsKGNyZWF0ZVJlYWRlckZyb21CdWZmZXIoYnVmZmVyKSwge1xyXG5cdFx0XHRcdHNraXBDb21wb3NpdGVJbWFnZURhdGE6IHRydWUsXHJcblx0XHRcdFx0c2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLFxyXG5cdFx0XHRcdHNraXBUaHVtYm5haWw6IHRydWUsXHJcblx0XHRcdFx0dGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdFx0bG9nRGV2RmVhdHVyZXM6IHRydWUsXHJcblx0XHRcdH0pO1xyXG5cdFx0XHRkZWxldGUgcHNkLmVuZ2luZURhdGE7XHJcblx0XHRcdHBzZC5pbWFnZVJlc291cmNlcyA9IHt9O1xyXG5cdFx0XHRwc2QuY2hpbGRyZW4/LnNwbGljZSgwLCAxKTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYygnb3V0cHV0LnR4dCcsIHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KHBzZCwgZmFsc2UsIDk5LCBmYWxzZSksICd1dGY4Jyk7XHJcblx0XHR9XHJcblx0fSk7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gY2xlYXJFbXB0eUNhbnZhc0ZpZWxkcyhsYXllcjogTGF5ZXIgfCB1bmRlZmluZWQpIHtcclxuXHRpZiAobGF5ZXIpIHtcclxuXHRcdGlmICgnY2FudmFzJyBpbiBsYXllciAmJiAhbGF5ZXIuY2FudmFzKSBkZWxldGUgbGF5ZXIuY2FudmFzO1xyXG5cdFx0aWYgKCdpbWFnZURhdGEnIGluIGxheWVyICYmICFsYXllci5pbWFnZURhdGEpIGRlbGV0ZSBsYXllci5pbWFnZURhdGE7XHJcblx0XHRsYXllci5jaGlsZHJlbj8uZm9yRWFjaChjbGVhckVtcHR5Q2FudmFzRmllbGRzKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNsZWFyQ2FudmFzRmllbGRzKGxheWVyOiBMYXllciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChsYXllcikge1xyXG5cdFx0ZGVsZXRlIGxheWVyLmNhbnZhcztcclxuXHRcdGRlbGV0ZSBsYXllci5pbWFnZURhdGE7XHJcblx0XHRpZiAobGF5ZXIubWFzaykgZGVsZXRlIGxheWVyLm1hc2suY2FudmFzO1xyXG5cdFx0aWYgKGxheWVyLm1hc2spIGRlbGV0ZSBsYXllci5tYXNrLmltYWdlRGF0YTtcclxuXHRcdGxheWVyLmNoaWxkcmVuPy5mb3JFYWNoKGNsZWFyQ2FudmFzRmllbGRzKTtcclxuXHR9XHJcbn1cclxuXHJcbi8vLyBFbmdpbmUgZGF0YSAyIGV4cGVyaW1lbnRzXHJcbi8vIC90ZXN0L2VuZ2luZURhdGEyLmpzb246MTEwOSBpcyBjaGFyYWN0ZXIgY29kZXNcclxuXHJcbmNvbnN0IGtleXNDb2xvciA9IHtcclxuXHQnMCc6IHtcclxuXHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdCcwJzogeyBuYW1lOiAnVHlwZScgfSxcclxuXHRcdFx0JzEnOiB7IG5hbWU6ICdWYWx1ZXMnIH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcbn07XHJcblxyXG5jb25zdCBrZXlzU3R5bGVTaGVldCA9IHtcclxuXHQnMCc6IHsgbmFtZTogJ0ZvbnQnIH0sXHJcblx0JzEnOiB7IG5hbWU6ICdGb250U2l6ZScgfSxcclxuXHQnMic6IHsgbmFtZTogJ0ZhdXhCb2xkJyB9LFxyXG5cdCczJzogeyBuYW1lOiAnRmF1eEl0YWxpYycgfSxcclxuXHQnNCc6IHsgbmFtZTogJ0F1dG9MZWFkaW5nJyB9LFxyXG5cdCc1JzogeyBuYW1lOiAnTGVhZGluZycgfSxcclxuXHQnNic6IHsgbmFtZTogJ0hvcml6b250YWxTY2FsZScgfSxcclxuXHQnNyc6IHsgbmFtZTogJ1ZlcnRpY2FsU2NhbGUnIH0sXHJcblx0JzgnOiB7IG5hbWU6ICdUcmFja2luZycgfSxcclxuXHQnOSc6IHsgbmFtZTogJ0Jhc2VsaW5lU2hpZnQnIH0sXHJcblxyXG5cdCcxMSc6IHsgbmFtZTogJ0tlcm5pbmc/JyB9LCAvLyBkaWZmZXJlbnQgdmFsdWUgdGhhbiBFbmdpbmVEYXRhXHJcblx0JzEyJzogeyBuYW1lOiAnRm9udENhcHMnIH0sXHJcblx0JzEzJzogeyBuYW1lOiAnRm9udEJhc2VsaW5lJyB9LFxyXG5cclxuXHQnMTUnOiB7IG5hbWU6ICdTdHJpa2V0aHJvdWdoPycgfSwgLy8gbnVtYmVyIGluc3RlYWQgb2YgYm9vbFxyXG5cdCcxNic6IHsgbmFtZTogJ1VuZGVybGluZT8nIH0sIC8vIG51bWJlciBpbnN0ZWFkIG9mIGJvb2xcclxuXHJcblx0JzE4JzogeyBuYW1lOiAnTGlnYXR1cmVzJyB9LFxyXG5cdCcxOSc6IHsgbmFtZTogJ0RMaWdhdHVyZXMnIH0sXHJcblxyXG5cdCcyMyc6IHsgbmFtZTogJ0ZyYWN0aW9ucycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cdCcyNCc6IHsgbmFtZTogJ09yZGluYWxzJyB9LCAvLyBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCcyOCc6IHsgbmFtZTogJ1N0eWxpc3RpY0FsdGVybmF0ZXMnIH0sIC8vIG5vdCBwcmVzZW50IGluIEVuZ2luZURhdGFcclxuXHJcblx0JzMwJzogeyBuYW1lOiAnT2xkU3R5bGU/JyB9LCAvLyBPcGVuVHlwZSA+IE9sZFN0eWxlLCBudW1iZXIgaW5zdGVhZCBvZiBib29sLCBub3QgcHJlc2VudCBpbiBFbmdpbmVEYXRhXHJcblxyXG5cdCczNSc6IHsgbmFtZTogJ0Jhc2VsaW5lRGlyZWN0aW9uJyB9LFxyXG5cclxuXHQnMzgnOiB7IG5hbWU6ICdMYW5ndWFnZScgfSxcclxuXHJcblx0JzUyJzogeyBuYW1lOiAnTm9CcmVhaycgfSxcclxuXHQnNTMnOiB7IG5hbWU6ICdGaWxsQ29sb3InLCBjaGlsZHJlbjoga2V5c0NvbG9yIH0sXHJcbn07XHJcblxyXG5jb25zdCBrZXlzUGFyYWdyYXBoID0ge1xyXG5cdCcwJzogeyBuYW1lOiAnSnVzdGlmaWNhdGlvbicgfSxcclxuXHQnMSc6IHsgbmFtZTogJ0ZpcnN0TGluZUluZGVudCcgfSxcclxuXHQnMic6IHsgbmFtZTogJ1N0YXJ0SW5kZW50JyB9LFxyXG5cdCczJzogeyBuYW1lOiAnRW5kSW5kZW50JyB9LFxyXG5cdCc0JzogeyBuYW1lOiAnU3BhY2VCZWZvcmUnIH0sXHJcblx0JzUnOiB7IG5hbWU6ICdTcGFjZUFmdGVyJyB9LFxyXG5cclxuXHQnNyc6IHsgbmFtZTogJ0F1dG9MZWFkaW5nJyB9LFxyXG5cclxuXHQnOSc6IHsgbmFtZTogJ0F1dG9IeXBoZW5hdGUnIH0sXHJcblx0JzEwJzogeyBuYW1lOiAnSHlwaGVuYXRlZFdvcmRTaXplJyB9LFxyXG5cdCcxMSc6IHsgbmFtZTogJ1ByZUh5cGhlbicgfSxcclxuXHQnMTInOiB7IG5hbWU6ICdQb3N0SHlwaGVuJyB9LFxyXG5cdCcxMyc6IHsgbmFtZTogJ0NvbnNlY3V0aXZlSHlwaGVucz8nIH0sIC8vIGRpZmZlcmVudCB2YWx1ZSB0aGFuIEVuZ2luZURhdGFcclxuXHQnMTQnOiB7IG5hbWU6ICdab25lJyB9LFxyXG5cdCcxNSc6IHsgbmFtZTogJ0h5cGVuYXRlQ2FwaXRhbGl6ZWRXb3JkcycgfSwgLy8gbm90IHByZXNlbnQgaW4gRW5naW5lRGF0YVxyXG5cclxuXHQnMTcnOiB7IG5hbWU6ICdXb3JkU3BhY2luZycgfSxcclxuXHQnMTgnOiB7IG5hbWU6ICdMZXR0ZXJTcGFjaW5nJyB9LFxyXG5cdCcxOSc6IHsgbmFtZTogJ0dseXBoU3BhY2luZycgfSxcclxuXHJcblx0JzMyJzogeyBuYW1lOiAnU3R5bGVTaGVldCcsIGNoaWxkcmVuOiBrZXlzU3R5bGVTaGVldCB9LFxyXG59O1xyXG5cclxuY29uc3Qga2V5c1N0eWxlU2hlZXREYXRhID0ge1xyXG5cdG5hbWU6ICdTdHlsZVNoZWV0RGF0YScsXHJcblx0Y2hpbGRyZW46IGtleXNTdHlsZVNoZWV0LFxyXG59O1xyXG5cclxuY29uc3Qga2V5cyA9IHtcclxuXHQnMCc6IHtcclxuXHRcdG5hbWU6ICdSZXNvdXJjZURpY3QnLFxyXG5cdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0JzEnOiB7XHJcblx0XHRcdFx0bmFtZTogJ0ZvbnRTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMic6IHsgbmFtZTogJ0ZvbnRUeXBlJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzInOiB7XHJcblx0XHRcdFx0bmFtZTogJzInLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzMnOiB7XHJcblx0XHRcdFx0bmFtZTogJ01vamlLdW1pU2V0JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnSW50ZXJuYWxOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnNCc6IHtcclxuXHRcdFx0XHRuYW1lOiAnS2luc29rdVNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOb1N0YXJ0JyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzEnOiB7IG5hbWU6ICdOb0VuZCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcyJzogeyBuYW1lOiAnS2VlcCcgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCczJzogeyBuYW1lOiAnSGFuZ2luZycgfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRuYW1lOiAnU3R5bGVTaGVldFNldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJ05hbWUnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc2Jzoga2V5c1N0eWxlU2hlZXREYXRhLFxyXG5cdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnNic6IHtcclxuXHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXRTZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0dXByb290OiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7IG5hbWU6ICdOYW1lJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnUHJvcGVydGllcycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IGtleXNQYXJhZ3JhcGgsXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCc2JzogeyBuYW1lOiAnRGVmYXVsdFN0eWxlU2hlZXQnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc4Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICc4JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge30sXHJcblx0XHRcdH0sXHJcblx0XHRcdCc5Jzoge1xyXG5cdFx0XHRcdG5hbWU6ICdQcmVkZWZpbmVkJyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge30sXHJcblx0XHRcdH0sXHJcblx0XHR9LFxyXG5cdH0sXHJcblx0JzEnOiB7XHJcblx0XHRuYW1lOiAnRW5naW5lRGljdCcsXHJcblx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRuYW1lOiAnMCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdCcwJzoge1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAnMCcsXHJcblx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0JzMnOiB7IG5hbWU6ICdTdXBlcnNjcmlwdFNpemUnIH0sXHJcblx0XHRcdFx0XHQnNCc6IHsgbmFtZTogJ1N1cGVyc2NyaXB0UG9zaXRpb24nIH0sXHJcblx0XHRcdFx0XHQnNSc6IHsgbmFtZTogJ1N1YnNjcmlwdFNpemUnIH0sXHJcblx0XHRcdFx0XHQnNic6IHsgbmFtZTogJ1N1YnNjcmlwdFBvc2l0aW9uJyB9LFxyXG5cdFx0XHRcdFx0JzcnOiB7IG5hbWU6ICdTbWFsbENhcFNpemUnIH0sXHJcblx0XHRcdFx0XHQnOCc6IHsgbmFtZTogJ1VzZUZyYWN0aW9uYWxHbHlwaFdpZHRocycgfSwgLy8gPz8/XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdFx0JzEnOiB7XHJcblx0XHRcdFx0bmFtZTogJ0VkaXRvcnM/JyxcclxuXHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICdFZGl0b3InLFxyXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdCcwJzogeyBuYW1lOiAnVGV4dCcgfSxcclxuXHRcdFx0XHRcdFx0XHQnNSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhSdW4nLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1J1bkFycmF5JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdQYXJhZ3JhcGhTaGVldCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1cHJvb3Q6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHsgbmFtZTogJzAnIH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc1Jzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICc1JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoga2V5c1BhcmFncmFwaCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzYnOiB7IG5hbWU6ICc2JyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnUnVuTGVuZ3RoJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0JzYnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnU3R5bGVSdW4nLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ1J1bkFycmF5JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzAnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdTdHlsZVNoZWV0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnMCc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVwcm9vdDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc2Jzoga2V5c1N0eWxlU2hlZXREYXRhLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCcxJzogeyBuYW1lOiAnUnVuTGVuZ3RoJyB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0JzEnOiB7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICdGb250VmVjdG9yRGF0YSA/Pz8nLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMic6IHtcclxuXHRcdFx0XHRuYW1lOiAnU3R5bGVTaGVldCcsXHJcblx0XHRcdFx0Y2hpbGRyZW46IGtleXNTdHlsZVNoZWV0LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHQnMyc6IHtcclxuXHRcdFx0XHRuYW1lOiAnUGFyYWdyYXBoU2hlZXQnLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBrZXlzUGFyYWdyYXBoLFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHR9LFxyXG59O1xyXG5cclxuZnVuY3Rpb24gZGVjb2RlT2JqKG9iajogYW55LCBrZXlzOiBhbnkpOiBhbnkge1xyXG5cdGlmIChvYmogPT09IG51bGwgfHwgIWtleXMpIHJldHVybiBvYmo7XHJcblxyXG5cdGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcclxuXHRcdHJldHVybiBvYmoubWFwKHggPT4gZGVjb2RlT2JqKHgsIGtleXMpKTtcclxuXHR9XHJcblxyXG5cdGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JykgcmV0dXJuIG9iajtcclxuXHJcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMob2JqKSkge1xyXG5cdFx0aWYgKGtleXNba2V5XSkge1xyXG5cdFx0XHRpZiAoa2V5c1trZXldLnVwcm9vdCkge1xyXG5cdFx0XHRcdHJldHVybiBkZWNvZGVPYmoob2JqW2tleV0sIGtleXNba2V5XS5jaGlsZHJlbik7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cmVzdWx0W2tleXNba2V5XS5uYW1lXSA9IGRlY29kZU9iaihvYmpba2V5XSwga2V5c1trZXldLmNoaWxkcmVuKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzdWx0W2tleV0gPSBvYmpba2V5XTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlY29kZUVuZ2luZURhdGEyKGRhdGE6IGFueSkge1xyXG5cdHJldHVybiBkZWNvZGVPYmooZGF0YSwga2V5cyk7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
