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
var psdWriter_1 = require("../psdWriter");
var psdReader_1 = require("../psdReader");
var index_1 = require("../index");
var layerImagesPath = path.join(__dirname, '..', '..', 'test', 'layer-images');
var writeFilesPath = path.join(__dirname, '..', '..', 'test', 'write');
var resultsFilesPath = path.join(__dirname, '..', '..', 'results');
function writeAndRead(psd, writeOptions, readOptions) {
    if (writeOptions === void 0) { writeOptions = {}; }
    if (readOptions === void 0) { readOptions = {}; }
    var writer = psdWriter_1.createWriter();
    psdWriter_1.writePsd(writer, psd, writeOptions);
    var buffer = psdWriter_1.getWriterBuffer(writer);
    var reader = psdReader_1.createReader(buffer);
    return psdReader_1.readPsd(reader, __assign(__assign({}, readOptions), { throwForMissingFeatures: true, logMissingFeatures: true }));
}
function tryLoadCanvasFromFile(filePath) {
    try {
        return common_1.loadCanvasFromFile(filePath);
    }
    catch (_a) {
        return undefined;
    }
}
function loadPsdFromJSONAndPNGFiles(basePath) {
    var _a;
    var psd = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));
    psd.canvas = common_1.loadCanvasFromFile(path.join(basePath, 'canvas.png'));
    psd.children.forEach(function (l, i) {
        if (!l.children) {
            l.canvas = tryLoadCanvasFromFile(path.join(basePath, "layer-" + i + ".png"));
            if (l.mask) {
                l.mask.canvas = tryLoadCanvasFromFile(path.join(basePath, "layer-" + i + "-mask.png"));
            }
        }
    });
    (_a = psd.linkedFiles) === null || _a === void 0 ? void 0 : _a.forEach(function (f) {
        try {
            f.data = fs.readFileSync(path.join(basePath, f.name));
        }
        catch (e) { }
    });
    return psd;
}
describe('PsdWriter', function () {
    it('does not throw if writing psd with empty canvas', function () {
        var writer = psdWriter_1.createWriter();
        var psd = {
            width: 300,
            height: 200
        };
        psdWriter_1.writePsd(writer, psd);
    });
    it('throws if passed invalid signature', function () {
        var writer = psdWriter_1.createWriter();
        var _loop_1 = function (s) {
            chai_1.expect(function () { return psdWriter_1.writeSignature(writer, s); }, s).throw("Invalid signature: '" + s + "'");
        };
        for (var _i = 0, _a = ['a', 'ab', 'abcde']; _i < _a.length; _i++) {
            var s = _a[_i];
            _loop_1(s);
        }
    });
    it('throws exception if has layer with both children and canvas properties set', function () {
        var writer = psdWriter_1.createWriter();
        var psd = {
            width: 300,
            height: 200,
            children: [{ children: [], canvas: common_1.createCanvas(300, 300) }]
        };
        chai_1.expect(function () { return psdWriter_1.writePsd(writer, psd); }).throw("Invalid layer, cannot have both 'canvas' and 'children' properties");
    });
    it('throws exception if has layer with both children and imageData properties set', function () {
        var writer = psdWriter_1.createWriter();
        var psd = {
            width: 300,
            height: 200,
            children: [{ children: [], imageData: {} }]
        };
        chai_1.expect(function () { return psdWriter_1.writePsd(writer, psd); }).throw("Invalid layer, cannot have both 'imageData' and 'children' properties");
    });
    it('throws if psd has invalid width or height', function () {
        var writer = psdWriter_1.createWriter();
        var psd = {
            width: -5,
            height: 0,
        };
        chai_1.expect(function () { return psdWriter_1.writePsd(writer, psd); }).throw("Invalid document size");
    });
    var fullImage = common_1.loadCanvasFromFile(path.join(layerImagesPath, 'full.png'));
    var transparentImage = common_1.loadCanvasFromFile(path.join(layerImagesPath, 'transparent.png'));
    var trimmedImage = common_1.loadCanvasFromFile(path.join(layerImagesPath, 'trimmed.png'));
    // const croppedImage = loadCanvasFromFile(path.join(layerImagesPath, 'cropped.png'));
    // const paddedImage = loadCanvasFromFile(path.join(layerImagesPath, 'padded.png'));
    describe('layer left, top, right, bottom handling', function () {
        it('handles undefined left, top, right, bottom with layer image the same size as document', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'full-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(300);
            chai_1.expect(layer.bottom).equal(200);
        });
        it('handles layer image larger than document', function () {
            var psd = {
                width: 100,
                height: 50,
                children: [
                    {
                        name: 'test',
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'oversized-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(300);
            chai_1.expect(layer.bottom).equal(200);
        });
        it('aligns layer image to top left if layer image is smaller than document', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        canvas: trimmedImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(trimmedImage, layer.canvas, 'smaller-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(192);
            chai_1.expect(layer.bottom).equal(68);
        });
        it('does not trim transparent layer image if trim option is not passed', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        canvas: transparentImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(transparentImage, layer.canvas, 'transparent-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(300);
            chai_1.expect(layer.bottom).equal(200);
        });
        it('trims transparent layer image if trim option is set', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        canvas: transparentImage,
                    },
                ],
            };
            var result = writeAndRead(psd, { trimImageData: true });
            var layer = result.children[0];
            common_1.compareCanvases(trimmedImage, layer.canvas, 'trimmed-layer-image.png');
            chai_1.expect(layer.left).equal(51);
            chai_1.expect(layer.top).equal(65);
            chai_1.expect(layer.right).equal(243);
            chai_1.expect(layer.bottom).equal(133);
        });
        it('positions the layer at given left/top offsets', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        left: 50,
                        top: 30,
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'left-top-layer-image.png');
            chai_1.expect(layer.left).equal(50);
            chai_1.expect(layer.top).equal(30);
            chai_1.expect(layer.right).equal(350);
            chai_1.expect(layer.bottom).equal(230);
        });
        it('ignores right/bottom values', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        right: 200,
                        bottom: 100,
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'cropped-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(300);
            chai_1.expect(layer.bottom).equal(200);
        });
        it('ignores larger right/bottom values', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        right: 400,
                        bottom: 250,
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'padded-layer-image.png');
            chai_1.expect(layer.left).equal(0);
            chai_1.expect(layer.top).equal(0);
            chai_1.expect(layer.right).equal(300);
            chai_1.expect(layer.bottom).equal(200);
        });
        it('ignores right/bottom values if they do not match canvas size', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        left: 50,
                        top: 50,
                        right: 50,
                        bottom: 50,
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
            chai_1.expect(layer.left).equal(50);
            chai_1.expect(layer.top).equal(50);
            chai_1.expect(layer.right).equal(350);
            chai_1.expect(layer.bottom).equal(250);
        });
        it('ignores right/bottom values if they amount to negative size', function () {
            var psd = {
                width: 300,
                height: 200,
                children: [
                    {
                        name: 'test',
                        left: 50,
                        top: 50,
                        right: 0,
                        bottom: 0,
                        canvas: fullImage,
                    },
                ],
            };
            var result = writeAndRead(psd);
            var layer = result.children[0];
            common_1.compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
            chai_1.expect(layer.left).equal(50);
            chai_1.expect(layer.top).equal(50);
            chai_1.expect(layer.right).equal(350);
            chai_1.expect(layer.bottom).equal(250);
        });
    });
    // fs.readdirSync(writeFilesPath).filter(f => /smart-object/.test(f)).forEach(f => {
    fs.readdirSync(writeFilesPath).filter(function (f) { return !/pattern/.test(f); }).forEach(function (f) {
        it("writes PSD file (" + f + ")", function () {
            var basePath = path.join(writeFilesPath, f);
            var psd = loadPsdFromJSONAndPNGFiles(basePath);
            var before = JSON.stringify(psd, replacer);
            var buffer = index_1.writePsdBuffer(psd, { generateThumbnail: false, trimImageData: true, logMissingFeatures: true });
            var after = JSON.stringify(psd, replacer);
            chai_1.expect(before).equal(after, 'psd object mutated');
            fs.mkdirSync(resultsFilesPath, { recursive: true });
            fs.writeFileSync(path.join(resultsFilesPath, f + ".psd"), buffer);
            // fs.writeFileSync(path.join(resultsFilesPath, `${f}.bin`), buffer); // TEMP
            var reader = psdReader_1.createReader(buffer.buffer);
            var result = psdReader_1.readPsd(reader, { skipLayerImageData: true, logMissingFeatures: true, throwForMissingFeatures: true });
            fs.writeFileSync(path.join(resultsFilesPath, f + "-composite.png"), result.canvas.toBuffer());
            //compareCanvases(psd.canvas, result.canvas, 'composite image');
            var expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
            common_1.compareBuffers(buffer, expected, "ArrayBufferPsdWriter", 0);
        });
    });
});
function replacer(key, value) {
    if (key === 'canvas') {
        return '<canvas>';
    }
    else {
        return value;
    }
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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VSxDQUFDO0tBQ2xCO1NBQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNiO0FBQ0YsQ0FBQyIsImZpbGUiOiJ0ZXN0L3BzZFdyaXRlci5zcGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcclxuaW1wb3J0IHsgbG9hZENhbnZhc0Zyb21GaWxlLCBjb21wYXJlQnVmZmVycywgY3JlYXRlQ2FudmFzLCBjb21wYXJlQ2FudmFzZXMgfSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IFBzZCwgV3JpdGVPcHRpb25zLCBSZWFkT3B0aW9ucyB9IGZyb20gJy4uL3BzZCc7XHJcbmltcG9ydCB7IHdyaXRlUHNkLCB3cml0ZVNpZ25hdHVyZSwgZ2V0V3JpdGVyQnVmZmVyLCBjcmVhdGVXcml0ZXIgfSBmcm9tICcuLi9wc2RXcml0ZXInO1xyXG5pbXBvcnQgeyByZWFkUHNkLCBjcmVhdGVSZWFkZXIgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xyXG5pbXBvcnQgeyB3cml0ZVBzZEJ1ZmZlciB9IGZyb20gJy4uL2luZGV4JztcclxuXHJcbmNvbnN0IGxheWVySW1hZ2VzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0JywgJ2xheWVyLWltYWdlcycpO1xyXG5jb25zdCB3cml0ZUZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0JywgJ3dyaXRlJyk7XHJcbmNvbnN0IHJlc3VsdHNGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycpO1xyXG5cclxuZnVuY3Rpb24gd3JpdGVBbmRSZWFkKHBzZDogUHNkLCB3cml0ZU9wdGlvbnM6IFdyaXRlT3B0aW9ucyA9IHt9LCByZWFkT3B0aW9uczogUmVhZE9wdGlvbnMgPSB7fSkge1xyXG5cdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cdHdyaXRlUHNkKHdyaXRlciwgcHNkLCB3cml0ZU9wdGlvbnMpO1xyXG5cdGNvbnN0IGJ1ZmZlciA9IGdldFdyaXRlckJ1ZmZlcih3cml0ZXIpO1xyXG5cdGNvbnN0IHJlYWRlciA9IGNyZWF0ZVJlYWRlcihidWZmZXIpO1xyXG5cdHJldHVybiByZWFkUHNkKHJlYWRlciwgeyAuLi5yZWFkT3B0aW9ucywgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJ5TG9hZENhbnZhc0Zyb21GaWxlKGZpbGVQYXRoOiBzdHJpbmcpIHtcclxuXHR0cnkge1xyXG5cdFx0cmV0dXJuIGxvYWRDYW52YXNGcm9tRmlsZShmaWxlUGF0aCk7XHJcblx0fSBjYXRjaCB7XHJcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gbG9hZFBzZEZyb21KU09OQW5kUE5HRmlsZXMoYmFzZVBhdGg6IHN0cmluZykge1xyXG5cdGNvbnN0IHBzZDogUHNkID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnZGF0YS5qc29uJyksICd1dGY4JykpO1xyXG5cdHBzZC5jYW52YXMgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGJhc2VQYXRoLCAnY2FudmFzLnBuZycpKTtcclxuXHRwc2QuY2hpbGRyZW4hLmZvckVhY2goKGwsIGkpID0+IHtcclxuXHRcdGlmICghbC5jaGlsZHJlbikge1xyXG5cdFx0XHRsLmNhbnZhcyA9IHRyeUxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsIGBsYXllci0ke2l9LnBuZ2ApKTtcclxuXHJcblx0XHRcdGlmIChsLm1hc2spIHtcclxuXHRcdFx0XHRsLm1hc2suY2FudmFzID0gdHJ5TG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgYGxheWVyLSR7aX0tbWFzay5wbmdgKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9KTtcclxuXHRwc2QubGlua2VkRmlsZXM/LmZvckVhY2goZiA9PiB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRmLmRhdGEgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCBmLm5hbWUpKTtcclxuXHRcdH0gY2F0Y2ggKGUpIHsgfVxyXG5cdH0pO1xyXG5cdHJldHVybiBwc2Q7XHJcbn1cclxuXHJcbmRlc2NyaWJlKCdQc2RXcml0ZXInLCAoKSA9PiB7XHJcblx0aXQoJ2RvZXMgbm90IHRocm93IGlmIHdyaXRpbmcgcHNkIHdpdGggZW1wdHkgY2FudmFzJywgKCkgPT4ge1xyXG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XHJcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0aGVpZ2h0OiAyMDBcclxuXHRcdH07XHJcblxyXG5cdFx0d3JpdGVQc2Qod3JpdGVyLCBwc2QpO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgndGhyb3dzIGlmIHBhc3NlZCBpbnZhbGlkIHNpZ25hdHVyZScsICgpID0+IHtcclxuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cclxuXHRcdGZvciAoY29uc3QgcyBvZiBbJ2EnLCAnYWInLCAnYWJjZGUnXSkge1xyXG5cdFx0XHRleHBlY3QoKCkgPT4gd3JpdGVTaWduYXR1cmUod3JpdGVyLCBzKSwgcykudGhyb3coYEludmFsaWQgc2lnbmF0dXJlOiAnJHtzfSdgKTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0aXQoJ3Rocm93cyBleGNlcHRpb24gaWYgaGFzIGxheWVyIHdpdGggYm90aCBjaGlsZHJlbiBhbmQgY2FudmFzIHByb3BlcnRpZXMgc2V0JywgKCkgPT4ge1xyXG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XHJcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdGNoaWxkcmVuOiBbeyBjaGlsZHJlbjogW10sIGNhbnZhczogY3JlYXRlQ2FudmFzKDMwMCwgMzAwKSB9XVxyXG5cdFx0fTtcclxuXHJcblx0XHRleHBlY3QoKCkgPT4gd3JpdGVQc2Qod3JpdGVyLCBwc2QpKS50aHJvdyhgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnY2FudmFzJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCd0aHJvd3MgZXhjZXB0aW9uIGlmIGhhcyBsYXllciB3aXRoIGJvdGggY2hpbGRyZW4gYW5kIGltYWdlRGF0YSBwcm9wZXJ0aWVzIHNldCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRjaGlsZHJlbjogW3sgY2hpbGRyZW46IFtdLCBpbWFnZURhdGE6IHt9IGFzIGFueSB9XVxyXG5cdFx0fTtcclxuXHJcblx0XHRleHBlY3QoKCkgPT4gd3JpdGVQc2Qod3JpdGVyLCBwc2QpKS50aHJvdyhgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnaW1hZ2VEYXRhJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XHJcblx0fSk7XHJcblxyXG5cdGl0KCd0aHJvd3MgaWYgcHNkIGhhcyBpbnZhbGlkIHdpZHRoIG9yIGhlaWdodCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAtNSxcclxuXHRcdFx0aGVpZ2h0OiAwLFxyXG5cdFx0fTtcclxuXHJcblx0XHRleHBlY3QoKCkgPT4gd3JpdGVQc2Qod3JpdGVyLCBwc2QpKS50aHJvdyhgSW52YWxpZCBkb2N1bWVudCBzaXplYCk7XHJcblx0fSk7XHJcblxyXG5cdGNvbnN0IGZ1bGxJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAnZnVsbC5wbmcnKSk7XHJcblx0Y29uc3QgdHJhbnNwYXJlbnRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAndHJhbnNwYXJlbnQucG5nJykpO1xyXG5cdGNvbnN0IHRyaW1tZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAndHJpbW1lZC5wbmcnKSk7XHJcblx0Ly8gY29uc3QgY3JvcHBlZEltYWdlID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihsYXllckltYWdlc1BhdGgsICdjcm9wcGVkLnBuZycpKTtcclxuXHQvLyBjb25zdCBwYWRkZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAncGFkZGVkLnBuZycpKTtcclxuXHJcblx0ZGVzY3JpYmUoJ2xheWVyIGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSBoYW5kbGluZycsICgpID0+IHtcclxuXHRcdGl0KCdoYW5kbGVzIHVuZGVmaW5lZCBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20gd2l0aCBsYXllciBpbWFnZSB0aGUgc2FtZSBzaXplIGFzIGRvY3VtZW50JywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnZnVsbC1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ2hhbmRsZXMgbGF5ZXIgaW1hZ2UgbGFyZ2VyIHRoYW4gZG9jdW1lbnQnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAxMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiA1MCxcclxuXHRcdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXHJcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XHJcblxyXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XHJcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ292ZXJzaXplZC1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ2FsaWducyBsYXllciBpbWFnZSB0byB0b3AgbGVmdCBpZiBsYXllciBpbWFnZSBpcyBzbWFsbGVyIHRoYW4gZG9jdW1lbnQnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IHRyaW1tZWRJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXModHJpbW1lZEltYWdlLCBsYXllci5jYW52YXMsICdzbWFsbGVyLWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDE5Mik7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDY4KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdkb2VzIG5vdCB0cmltIHRyYW5zcGFyZW50IGxheWVyIGltYWdlIGlmIHRyaW0gb3B0aW9uIGlzIG5vdCBwYXNzZWQnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IHRyYW5zcGFyZW50SW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyYW5zcGFyZW50SW1hZ2UsIGxheWVyLmNhbnZhcywgJ3RyYW5zcGFyZW50LWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgndHJpbXMgdHJhbnNwYXJlbnQgbGF5ZXIgaW1hZ2UgaWYgdHJpbSBvcHRpb24gaXMgc2V0JywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiB0cmFuc3BhcmVudEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCwgeyB0cmltSW1hZ2VEYXRhOiB0cnVlIH0pO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXModHJpbW1lZEltYWdlLCBsYXllci5jYW52YXMsICd0cmltbWVkLWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoNTEpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCg2NSk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMjQzKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMTMzKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdwb3NpdGlvbnMgdGhlIGxheWVyIGF0IGdpdmVuIGxlZnQvdG9wIG9mZnNldHMnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCxcclxuXHRcdFx0XHRcdFx0dG9wOiAzMCxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnbGVmdC10b3AtbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDMwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMzApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ2lnbm9yZXMgcmlnaHQvYm90dG9tIHZhbHVlcycsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXHJcblx0XHRcdFx0XHRcdHJpZ2h0OiAyMDAsXHJcblx0XHRcdFx0XHRcdGJvdHRvbTogMTAwLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdjcm9wcGVkLWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgnaWdub3JlcyBsYXJnZXIgcmlnaHQvYm90dG9tIHZhbHVlcycsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXHJcblx0XHRcdFx0XHRcdHJpZ2h0OiA0MDAsXHJcblx0XHRcdFx0XHRcdGJvdHRvbTogMjUwLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdwYWRkZWQtbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdpZ25vcmVzIHJpZ2h0L2JvdHRvbSB2YWx1ZXMgaWYgdGhleSBkbyBub3QgbWF0Y2ggY2FudmFzIHNpemUnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCxcclxuXHRcdFx0XHRcdFx0dG9wOiA1MCxcclxuXHRcdFx0XHRcdFx0cmlnaHQ6IDUwLFxyXG5cdFx0XHRcdFx0XHRib3R0b206IDUwLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdlbXB0eS1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDM1MCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDI1MCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgnaWdub3JlcyByaWdodC9ib3R0b20gdmFsdWVzIGlmIHRoZXkgYW1vdW50IHRvIG5lZ2F0aXZlIHNpemUnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCxcclxuXHRcdFx0XHRcdFx0dG9wOiA1MCxcclxuXHRcdFx0XHRcdFx0cmlnaHQ6IDAsXHJcblx0XHRcdFx0XHRcdGJvdHRvbTogMCxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnZW1wdHktbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDUwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyNTApO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdC8vIGZzLnJlYWRkaXJTeW5jKHdyaXRlRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAvc21hcnQtb2JqZWN0Ly50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdGZzLnJlYWRkaXJTeW5jKHdyaXRlRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm4vLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XHJcblx0XHRpdChgd3JpdGVzIFBTRCBmaWxlICgke2Z9KWAsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgYmFzZVBhdGggPSBwYXRoLmpvaW4od3JpdGVGaWxlc1BhdGgsIGYpO1xyXG5cdFx0XHRjb25zdCBwc2QgPSBsb2FkUHNkRnJvbUpTT05BbmRQTkdGaWxlcyhiYXNlUGF0aCk7XHJcblxyXG5cdFx0XHRjb25zdCBiZWZvcmUgPSBKU09OLnN0cmluZ2lmeShwc2QsIHJlcGxhY2VyKTtcclxuXHRcdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGdlbmVyYXRlVGh1bWJuYWlsOiBmYWxzZSwgdHJpbUltYWdlRGF0YTogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xyXG5cdFx0XHRjb25zdCBhZnRlciA9IEpTT04uc3RyaW5naWZ5KHBzZCwgcmVwbGFjZXIpO1xyXG5cclxuXHRcdFx0ZXhwZWN0KGJlZm9yZSkuZXF1YWwoYWZ0ZXIsICdwc2Qgb2JqZWN0IG11dGF0ZWQnKTtcclxuXHJcblx0XHRcdGZzLm1rZGlyU3luYyhyZXN1bHRzRmlsZXNQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYCR7Zn0ucHNkYCksIGJ1ZmZlcik7XHJcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LmJpbmApLCBidWZmZXIpOyAvLyBURU1QXHJcblxyXG5cdFx0XHRjb25zdCByZWFkZXIgPSBjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlcik7XHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlYWRQc2QocmVhZGVyLCB7IHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYCR7Zn0tY29tcG9zaXRlLnBuZ2ApLCByZXN1bHQuY2FudmFzIS50b0J1ZmZlcigpKTtcclxuXHRcdFx0Ly9jb21wYXJlQ2FudmFzZXMocHNkLmNhbnZhcywgcmVzdWx0LmNhbnZhcywgJ2NvbXBvc2l0ZSBpbWFnZScpO1xyXG5cclxuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnZXhwZWN0ZWQucHNkJykpO1xyXG5cdFx0XHRjb21wYXJlQnVmZmVycyhidWZmZXIsIGV4cGVjdGVkLCBgQXJyYXlCdWZmZXJQc2RXcml0ZXJgLCAwKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG59KTtcclxuXHJcbmZ1bmN0aW9uIHJlcGxhY2VyKGtleTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XHJcblx0aWYgKGtleSA9PT0gJ2NhbnZhcycpIHtcclxuXHRcdHJldHVybiAnPGNhbnZhcz4nO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gdmFsdWU7XHJcblx0fVxyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
