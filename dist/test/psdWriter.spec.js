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
function loadPsdFromJSONAndPNGFiles(basePath) {
    var psd = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));
    psd.canvas = common_1.loadCanvasFromFile(path.join(basePath, 'canvas.png'));
    psd.children.forEach(function (l, i) {
        if (!l.children) {
            l.canvas = common_1.loadCanvasFromFile(path.join(basePath, "layer-" + i + ".png"));
            if (l.mask) {
                l.mask.canvas = common_1.loadCanvasFromFile(path.join(basePath, "layer-" + i + "-mask.png"));
            }
        }
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
            // fs.writeFileSync(path.join(resultsFilesPath, `${f}.bin`), buffer);
            var reader = psdReader_1.createReader(buffer.buffer);
            var result = psdReader_1.readPsd(reader, { skipLayerImageData: true, logMissingFeatures: true, throwForMissingFeatures: true });
            fs.writeFileSync(path.join(resultsFilesPath, f + "-composite.png"), result.canvas.toBuffer());
            //compareCanvases(psd.canvas, result.canvas, 'composite image');
            var expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
            common_1.compareBuffers(buffer, expected, "ArrayBufferPsdWriter");
        });
    });
    fs.readdirSync(writeFilesPath).filter(function (f) { return !/pattern/.test(f); }).forEach(function (f) {
        it("writes PSD file with zip compression (" + f + ")", function () {
            var basePath = path.join(writeFilesPath, f);
            var psd = loadPsdFromJSONAndPNGFiles(basePath);
            var before = JSON.stringify(psd, replacer);
            var buffer = index_1.writePsdBuffer(psd, { generateThumbnail: false, trimImageData: true, logMissingFeatures: true, compression: 2 /* ZipWithoutPrediction */ });
            var after = JSON.stringify(psd, replacer);
            chai_1.expect(before).equal(after, 'psd object mutated');
            fs.mkdirSync(resultsFilesPath, { recursive: true });
            fs.writeFileSync(path.join(resultsFilesPath, f + ".psd"), buffer);
            // fs.writeFileSync(path.join(resultsFilesPath, `${f}.bin`), buffer);
            var reader = psdReader_1.createReader(buffer.buffer);
            var result = psdReader_1.readPsd(reader, { skipLayerImageData: true, logMissingFeatures: true, throwForMissingFeatures: true });
            fs.writeFileSync(path.join(resultsFilesPath, f + "-composite.png"), result.canvas.toBuffer());
            //compareCanvases(psd.canvas, result.canvas, 'composite image');
            var expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
            common_1.compareBuffers(buffer, expected, "ArrayBufferPsdWriter");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUN4QyxJQUFJLEdBQUcsS0FBSyxRQUFRLEVBQUU7UUFDckIsT0FBTyxVQUFVLENBQUM7S0FDbEI7U0FBTTtRQUNOLE9BQU8sS0FBSyxDQUFDO0tBQ2I7QUFDRixDQUFDIiwiZmlsZSI6InRlc3QvcHNkV3JpdGVyLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XG5pbXBvcnQgeyBsb2FkQ2FudmFzRnJvbUZpbGUsIGNvbXBhcmVCdWZmZXJzLCBjcmVhdGVDYW52YXMsIGNvbXBhcmVDYW52YXNlcyB9IGZyb20gJy4vY29tbW9uJztcbmltcG9ydCB7IFBzZCwgV3JpdGVPcHRpb25zLCBSZWFkT3B0aW9ucyB9IGZyb20gJy4uL3BzZCc7XG5pbXBvcnQgeyB3cml0ZVBzZCwgd3JpdGVTaWduYXR1cmUsIGdldFdyaXRlckJ1ZmZlciwgY3JlYXRlV3JpdGVyIH0gZnJvbSAnLi4vcHNkV3JpdGVyJztcbmltcG9ydCB7IHJlYWRQc2QsIGNyZWF0ZVJlYWRlciB9IGZyb20gJy4uL3BzZFJlYWRlcic7XG5pbXBvcnQgeyB3cml0ZVBzZEJ1ZmZlciB9IGZyb20gJy4uL2luZGV4JztcbmltcG9ydCB7IENvbXByZXNzaW9uIH0gZnJvbSAnLi4vaGVscGVycyc7XG5cbmNvbnN0IGxheWVySW1hZ2VzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICd0ZXN0JywgJ2xheWVyLWltYWdlcycpO1xuY29uc3Qgd3JpdGVGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcsICd3cml0ZScpO1xuY29uc3QgcmVzdWx0c0ZpbGVzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXN1bHRzJyk7XG5cbmZ1bmN0aW9uIHdyaXRlQW5kUmVhZChwc2Q6IFBzZCwgd3JpdGVPcHRpb25zOiBXcml0ZU9wdGlvbnMgPSB7fSwgcmVhZE9wdGlvbnM6IFJlYWRPcHRpb25zID0ge30pIHtcblx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cdHdyaXRlUHNkKHdyaXRlciwgcHNkLCB3cml0ZU9wdGlvbnMpO1xuXHRjb25zdCBidWZmZXIgPSBnZXRXcml0ZXJCdWZmZXIod3JpdGVyKTtcblx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGJ1ZmZlcik7XG5cdHJldHVybiByZWFkUHNkKHJlYWRlciwgeyAuLi5yZWFkT3B0aW9ucywgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcbn1cblxuZnVuY3Rpb24gbG9hZFBzZEZyb21KU09OQW5kUE5HRmlsZXMoYmFzZVBhdGg6IHN0cmluZykge1xuXHRjb25zdCBwc2Q6IFBzZCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ2RhdGEuanNvbicpLCAndXRmOCcpKTtcblx0cHNkLmNhbnZhcyA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsICdjYW52YXMucG5nJykpO1xuXHRwc2QuY2hpbGRyZW4hLmZvckVhY2goKGwsIGkpID0+IHtcblx0XHRpZiAoIWwuY2hpbGRyZW4pIHtcblx0XHRcdGwuY2FudmFzID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgYGxheWVyLSR7aX0ucG5nYCkpO1xuXG5cdFx0XHRpZiAobC5tYXNrKSB7XG5cdFx0XHRcdGwubWFzay5jYW52YXMgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGJhc2VQYXRoLCBgbGF5ZXItJHtpfS1tYXNrLnBuZ2ApKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gcHNkO1xufVxuXG5kZXNjcmliZSgnUHNkV3JpdGVyJywgKCkgPT4ge1xuXHRpdCgnZG9lcyBub3QgdGhyb3cgaWYgd3JpdGluZyBwc2Qgd2l0aCBlbXB0eSBjYW52YXMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0aGVpZ2h0OiAyMDBcblx0XHR9O1xuXG5cdFx0d3JpdGVQc2Qod3JpdGVyLCBwc2QpO1xuXHR9KTtcblxuXHRpdCgndGhyb3dzIGlmIHBhc3NlZCBpbnZhbGlkIHNpZ25hdHVyZScsICgpID0+IHtcblx0XHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcblxuXHRcdGZvciAoY29uc3QgcyBvZiBbJ2EnLCAnYWInLCAnYWJjZGUnXSkge1xuXHRcdFx0ZXhwZWN0KCgpID0+IHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgcyksIHMpLnRocm93KGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c30nYCk7XG5cdFx0fVxuXHR9KTtcblxuXHRpdCgndGhyb3dzIGV4Y2VwdGlvbiBpZiBoYXMgbGF5ZXIgd2l0aCBib3RoIGNoaWxkcmVuIGFuZCBjYW52YXMgcHJvcGVydGllcyBzZXQnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRjaGlsZHJlbjogW3sgY2hpbGRyZW46IFtdLCBjYW52YXM6IGNyZWF0ZUNhbnZhcygzMDAsIDMwMCkgfV1cblx0XHR9O1xuXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2NhbnZhcycgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xuXHR9KTtcblxuXHRpdCgndGhyb3dzIGV4Y2VwdGlvbiBpZiBoYXMgbGF5ZXIgd2l0aCBib3RoIGNoaWxkcmVuIGFuZCBpbWFnZURhdGEgcHJvcGVydGllcyBzZXQnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRjaGlsZHJlbjogW3sgY2hpbGRyZW46IFtdLCBpbWFnZURhdGE6IHt9IGFzIGFueSB9XVxuXHRcdH07XG5cblx0XHRleHBlY3QoKCkgPT4gd3JpdGVQc2Qod3JpdGVyLCBwc2QpKS50aHJvdyhgSW52YWxpZCBsYXllciwgY2Fubm90IGhhdmUgYm90aCAnaW1hZ2VEYXRhJyBhbmQgJ2NoaWxkcmVuJyBwcm9wZXJ0aWVzYCk7XG5cdH0pO1xuXG5cdGl0KCd0aHJvd3MgaWYgcHNkIGhhcyBpbnZhbGlkIHdpZHRoIG9yIGhlaWdodCcsICgpID0+IHtcblx0XHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcblx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdHdpZHRoOiAtNSxcblx0XHRcdGhlaWdodDogMCxcblx0XHR9O1xuXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgZG9jdW1lbnQgc2l6ZWApO1xuXHR9KTtcblxuXHRjb25zdCBmdWxsSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ2Z1bGwucG5nJykpO1xuXHRjb25zdCB0cmFuc3BhcmVudEltYWdlID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihsYXllckltYWdlc1BhdGgsICd0cmFuc3BhcmVudC5wbmcnKSk7XG5cdGNvbnN0IHRyaW1tZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAndHJpbW1lZC5wbmcnKSk7XG5cdC8vIGNvbnN0IGNyb3BwZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAnY3JvcHBlZC5wbmcnKSk7XG5cdC8vIGNvbnN0IHBhZGRlZEltYWdlID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihsYXllckltYWdlc1BhdGgsICdwYWRkZWQucG5nJykpO1xuXG5cdGRlc2NyaWJlKCdsYXllciBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20gaGFuZGxpbmcnLCAoKSA9PiB7XG5cdFx0aXQoJ2hhbmRsZXMgdW5kZWZpbmVkIGxlZnQsIHRvcCwgcmlnaHQsIGJvdHRvbSB3aXRoIGxheWVyIGltYWdlIHRoZSBzYW1lIHNpemUgYXMgZG9jdW1lbnQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdmdWxsLWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ2hhbmRsZXMgbGF5ZXIgaW1hZ2UgbGFyZ2VyIHRoYW4gZG9jdW1lbnQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDEwMCxcblx0XHRcdFx0aGVpZ2h0OiA1MCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XG5cblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ292ZXJzaXplZC1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcblx0XHR9KTtcblxuXHRcdGl0KCdhbGlnbnMgbGF5ZXIgaW1hZ2UgdG8gdG9wIGxlZnQgaWYgbGF5ZXIgaW1hZ2UgaXMgc21hbGxlciB0aGFuIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGNhbnZhczogdHJpbW1lZEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyaW1tZWRJbWFnZSwgbGF5ZXIuY2FudmFzLCAnc21hbGxlci1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgxOTIpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoNjgpO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ2RvZXMgbm90IHRyaW0gdHJhbnNwYXJlbnQgbGF5ZXIgaW1hZ2UgaWYgdHJpbSBvcHRpb24gaXMgbm90IHBhc3NlZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRjYW52YXM6IHRyYW5zcGFyZW50SW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXModHJhbnNwYXJlbnRJbWFnZSwgbGF5ZXIuY2FudmFzLCAndHJhbnNwYXJlbnQtbGF5ZXItaW1hZ2UucG5nJyk7XG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XG5cdFx0fSk7XG5cblx0XHRpdCgndHJpbXMgdHJhbnNwYXJlbnQgbGF5ZXIgaW1hZ2UgaWYgdHJpbSBvcHRpb24gaXMgc2V0JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGNhbnZhczogdHJhbnNwYXJlbnRJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCwgeyB0cmltSW1hZ2VEYXRhOiB0cnVlIH0pO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXModHJpbW1lZEltYWdlLCBsYXllci5jYW52YXMsICd0cmltbWVkLWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUxKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDY1KTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMjQzKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDEzMyk7XG5cdFx0fSk7XG5cblx0XHRpdCgncG9zaXRpb25zIHRoZSBsYXllciBhdCBnaXZlbiBsZWZ0L3RvcCBvZmZzZXRzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGxlZnQ6IDUwLFxuXHRcdFx0XHRcdFx0dG9wOiAzMCxcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnbGVmdC10b3AtbGF5ZXItaW1hZ2UucG5nJyk7XG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoNTApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMzApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzNTApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjMwKTtcblx0XHR9KTtcblxuXHRcdGl0KCdpZ25vcmVzIHJpZ2h0L2JvdHRvbSB2YWx1ZXMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0cmlnaHQ6IDIwMCxcblx0XHRcdFx0XHRcdGJvdHRvbTogMTAwLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdjcm9wcGVkLWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ2lnbm9yZXMgbGFyZ2VyIHJpZ2h0L2JvdHRvbSB2YWx1ZXMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0cmlnaHQ6IDQwMCxcblx0XHRcdFx0XHRcdGJvdHRvbTogMjUwLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdwYWRkZWQtbGF5ZXItaW1hZ2UucG5nJyk7XG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XG5cdFx0fSk7XG5cblx0XHRpdCgnaWdub3JlcyByaWdodC9ib3R0b20gdmFsdWVzIGlmIHRoZXkgZG8gbm90IG1hdGNoIGNhbnZhcyBzaXplJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGxlZnQ6IDUwLFxuXHRcdFx0XHRcdFx0dG9wOiA1MCxcblx0XHRcdFx0XHRcdHJpZ2h0OiA1MCxcblx0XHRcdFx0XHRcdGJvdHRvbTogNTAsXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XG5cblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2VtcHR5LWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDUwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzUwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDI1MCk7XG5cdFx0fSk7XG5cblx0XHRpdCgnaWdub3JlcyByaWdodC9ib3R0b20gdmFsdWVzIGlmIHRoZXkgYW1vdW50IHRvIG5lZ2F0aXZlIHNpemUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0bGVmdDogNTAsXG5cdFx0XHRcdFx0XHR0b3A6IDUwLFxuXHRcdFx0XHRcdFx0cmlnaHQ6IDAsXG5cdFx0XHRcdFx0XHRib3R0b206IDAsXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XG5cblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2VtcHR5LWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDUwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzUwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDI1MCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGZzLnJlYWRkaXJTeW5jKHdyaXRlRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm4vLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XG5cdFx0aXQoYHdyaXRlcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbih3cml0ZUZpbGVzUGF0aCwgZik7XG5cdFx0XHRjb25zdCBwc2QgPSBsb2FkUHNkRnJvbUpTT05BbmRQTkdGaWxlcyhiYXNlUGF0aCk7XG5cblx0XHRcdGNvbnN0IGJlZm9yZSA9IEpTT04uc3RyaW5naWZ5KHBzZCwgcmVwbGFjZXIpO1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGdlbmVyYXRlVGh1bWJuYWlsOiBmYWxzZSwgdHJpbUltYWdlRGF0YTogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBKU09OLnN0cmluZ2lmeShwc2QsIHJlcGxhY2VyKTtcblxuXHRcdFx0ZXhwZWN0KGJlZm9yZSkuZXF1YWwoYWZ0ZXIsICdwc2Qgb2JqZWN0IG11dGF0ZWQnKTtcblxuXHRcdFx0ZnMubWtkaXJTeW5jKHJlc3VsdHNGaWxlc1BhdGgsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYCR7Zn0ucHNkYCksIGJ1ZmZlcik7XG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgJHtmfS5iaW5gKSwgYnVmZmVyKTtcblxuXHRcdFx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGJ1ZmZlci5idWZmZXIpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gcmVhZFBzZChyZWFkZXIsIHsgc2tpcExheWVySW1hZ2VEYXRhOiB0cnVlLCBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsIHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlIH0pO1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYCR7Zn0tY29tcG9zaXRlLnBuZ2ApLCByZXN1bHQuY2FudmFzIS50b0J1ZmZlcigpKTtcblx0XHRcdC8vY29tcGFyZUNhbnZhc2VzKHBzZC5jYW52YXMsIHJlc3VsdC5jYW52YXMsICdjb21wb3NpdGUgaW1hZ2UnKTtcblxuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnZXhwZWN0ZWQucHNkJykpO1xuXHRcdFx0Y29tcGFyZUJ1ZmZlcnMoYnVmZmVyLCBleHBlY3RlZCwgYEFycmF5QnVmZmVyUHNkV3JpdGVyYCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGZzLnJlYWRkaXJTeW5jKHdyaXRlRmlsZXNQYXRoKS5maWx0ZXIoZiA9PiAhL3BhdHRlcm4vLnRlc3QoZikpLmZvckVhY2goZiA9PiB7XG5cdFx0aXQoYHdyaXRlcyBQU0QgZmlsZSB3aXRoIHppcCBjb21wcmVzc2lvbiAoJHtmfSlgLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbih3cml0ZUZpbGVzUGF0aCwgZik7XG5cdFx0XHRjb25zdCBwc2QgPSBsb2FkUHNkRnJvbUpTT05BbmRQTkdGaWxlcyhiYXNlUGF0aCk7XG5cblx0XHRcdGNvbnN0IGJlZm9yZSA9IEpTT04uc3RyaW5naWZ5KHBzZCwgcmVwbGFjZXIpO1xuXHRcdFx0Y29uc3QgYnVmZmVyID0gd3JpdGVQc2RCdWZmZXIocHNkLCB7IGdlbmVyYXRlVGh1bWJuYWlsOiBmYWxzZSwgdHJpbUltYWdlRGF0YTogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCBjb21wcmVzc2lvbjogQ29tcHJlc3Npb24uWmlwV2l0aG91dFByZWRpY3Rpb24gfSk7XG5cdFx0XHRjb25zdCBhZnRlciA9IEpTT04uc3RyaW5naWZ5KHBzZCwgcmVwbGFjZXIpO1xuXG5cdFx0XHRleHBlY3QoYmVmb3JlKS5lcXVhbChhZnRlciwgJ3BzZCBvYmplY3QgbXV0YXRlZCcpO1xuXG5cdFx0XHRmcy5ta2RpclN5bmMocmVzdWx0c0ZpbGVzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgJHtmfS5wc2RgKSwgYnVmZmVyKTtcblx0XHRcdC8vIGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LmJpbmApLCBidWZmZXIpO1xuXG5cdFx0XHRjb25zdCByZWFkZXIgPSBjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlcik7XG5cdFx0XHRjb25zdCByZXN1bHQgPSByZWFkUHNkKHJlYWRlciwgeyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgJHtmfS1jb21wb3NpdGUucG5nYCksIHJlc3VsdC5jYW52YXMhLnRvQnVmZmVyKCkpO1xuXHRcdFx0Ly9jb21wYXJlQ2FudmFzZXMocHNkLmNhbnZhcywgcmVzdWx0LmNhbnZhcywgJ2NvbXBvc2l0ZSBpbWFnZScpO1xuXG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oYmFzZVBhdGgsICdleHBlY3RlZC5wc2QnKSk7XG5cdFx0XHRjb21wYXJlQnVmZmVycyhidWZmZXIsIGV4cGVjdGVkLCBgQXJyYXlCdWZmZXJQc2RXcml0ZXJgKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuZnVuY3Rpb24gcmVwbGFjZXIoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcblx0aWYgKGtleSA9PT0gJ2NhbnZhcycpIHtcblx0XHRyZXR1cm4gJzxjYW52YXM+Jztcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cbn1cbiJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2pvZXJhaWkvZGV2L2FnLXBzZC9zcmMifQ==
