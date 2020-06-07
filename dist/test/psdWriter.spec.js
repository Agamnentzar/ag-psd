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
});
function replacer(key, value) {
    if (key === 'canvas') {
        return '<canvas>';
    }
    else {
        return value;
    }
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QU0sR0FBRyxtQkFBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUN0SCxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUssQ0FBQyxtQkFBZ0IsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxNQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUMvRixnRUFBZ0U7WUFFaEUsSUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLHVCQUFjLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsUUFBUSxDQUFDLEdBQVcsRUFBRSxLQUFVO0lBQ3hDLElBQUksR0FBRyxLQUFLLFFBQVEsRUFBRTtRQUNyQixPQUFPLFVBQVUsQ0FBQztLQUNsQjtTQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDYjtBQUNGLENBQUMiLCJmaWxlIjoidGVzdC9wc2RXcml0ZXIuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcbmltcG9ydCB7IGxvYWRDYW52YXNGcm9tRmlsZSwgY29tcGFyZUJ1ZmZlcnMsIGNyZWF0ZUNhbnZhcywgY29tcGFyZUNhbnZhc2VzIH0gZnJvbSAnLi9jb21tb24nO1xuaW1wb3J0IHsgUHNkLCBXcml0ZU9wdGlvbnMsIFJlYWRPcHRpb25zIH0gZnJvbSAnLi4vcHNkJztcbmltcG9ydCB7IHdyaXRlUHNkLCB3cml0ZVNpZ25hdHVyZSwgZ2V0V3JpdGVyQnVmZmVyLCBjcmVhdGVXcml0ZXIgfSBmcm9tICcuLi9wc2RXcml0ZXInO1xuaW1wb3J0IHsgcmVhZFBzZCwgY3JlYXRlUmVhZGVyIH0gZnJvbSAnLi4vcHNkUmVhZGVyJztcbmltcG9ydCB7IHdyaXRlUHNkQnVmZmVyIH0gZnJvbSAnLi4vaW5kZXgnO1xuXG5jb25zdCBsYXllckltYWdlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcsICdsYXllci1pbWFnZXMnKTtcbmNvbnN0IHdyaXRlRmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Rlc3QnLCAnd3JpdGUnKTtcbmNvbnN0IHJlc3VsdHNGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycpO1xuXG5mdW5jdGlvbiB3cml0ZUFuZFJlYWQocHNkOiBQc2QsIHdyaXRlT3B0aW9uczogV3JpdGVPcHRpb25zID0ge30sIHJlYWRPcHRpb25zOiBSZWFkT3B0aW9ucyA9IHt9KSB7XG5cdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xuXHR3cml0ZVBzZCh3cml0ZXIsIHBzZCwgd3JpdGVPcHRpb25zKTtcblx0Y29uc3QgYnVmZmVyID0gZ2V0V3JpdGVyQnVmZmVyKHdyaXRlcik7XG5cdGNvbnN0IHJlYWRlciA9IGNyZWF0ZVJlYWRlcihidWZmZXIpO1xuXHRyZXR1cm4gcmVhZFBzZChyZWFkZXIsIHsgLi4ucmVhZE9wdGlvbnMsIHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XG59XG5cbmZ1bmN0aW9uIGxvYWRQc2RGcm9tSlNPTkFuZFBOR0ZpbGVzKGJhc2VQYXRoOiBzdHJpbmcpIHtcblx0Y29uc3QgcHNkOiBQc2QgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4oYmFzZVBhdGgsICdkYXRhLmpzb24nKSwgJ3V0ZjgnKSk7XG5cdHBzZC5jYW52YXMgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGJhc2VQYXRoLCAnY2FudmFzLnBuZycpKTtcblx0cHNkLmNoaWxkcmVuIS5mb3JFYWNoKChsLCBpKSA9PiB7XG5cdFx0aWYgKCFsLmNoaWxkcmVuKSB7XG5cdFx0XHRsLmNhbnZhcyA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsIGBsYXllci0ke2l9LnBuZ2ApKTtcblxuXHRcdFx0aWYgKGwubWFzaykge1xuXHRcdFx0XHRsLm1hc2suY2FudmFzID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgYGxheWVyLSR7aX0tbWFzay5wbmdgKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIHBzZDtcbn1cblxuZGVzY3JpYmUoJ1BzZFdyaXRlcicsICgpID0+IHtcblx0aXQoJ2RvZXMgbm90IHRocm93IGlmIHdyaXRpbmcgcHNkIHdpdGggZW1wdHkgY2FudmFzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdGhlaWdodDogMjAwXG5cdFx0fTtcblxuXHRcdHdyaXRlUHNkKHdyaXRlciwgcHNkKTtcblx0fSk7XG5cblx0aXQoJ3Rocm93cyBpZiBwYXNzZWQgaW52YWxpZCBzaWduYXR1cmUnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cblx0XHRmb3IgKGNvbnN0IHMgb2YgWydhJywgJ2FiJywgJ2FiY2RlJ10pIHtcblx0XHRcdGV4cGVjdCgoKSA9PiB3cml0ZVNpZ25hdHVyZSh3cml0ZXIsIHMpLCBzKS50aHJvdyhgSW52YWxpZCBzaWduYXR1cmU6ICcke3N9J2ApO1xuXHRcdH1cblx0fSk7XG5cblx0aXQoJ3Rocm93cyBleGNlcHRpb24gaWYgaGFzIGxheWVyIHdpdGggYm90aCBjaGlsZHJlbiBhbmQgY2FudmFzIHByb3BlcnRpZXMgc2V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0Y2hpbGRyZW46IFt7IGNoaWxkcmVuOiBbXSwgY2FudmFzOiBjcmVhdGVDYW52YXMoMzAwLCAzMDApIH1dXG5cdFx0fTtcblxuXHRcdGV4cGVjdCgoKSA9PiB3cml0ZVBzZCh3cml0ZXIsIHBzZCkpLnRocm93KGBJbnZhbGlkIGxheWVyLCBjYW5ub3QgaGF2ZSBib3RoICdjYW52YXMnIGFuZCAnY2hpbGRyZW4nIHByb3BlcnRpZXNgKTtcblx0fSk7XG5cblx0aXQoJ3Rocm93cyBleGNlcHRpb24gaWYgaGFzIGxheWVyIHdpdGggYm90aCBjaGlsZHJlbiBhbmQgaW1hZ2VEYXRhIHByb3BlcnRpZXMgc2V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0Y2hpbGRyZW46IFt7IGNoaWxkcmVuOiBbXSwgaW1hZ2VEYXRhOiB7fSBhcyBhbnkgfV1cblx0XHR9O1xuXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2ltYWdlRGF0YScgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xuXHR9KTtcblxuXHRpdCgndGhyb3dzIGlmIHBzZCBoYXMgaW52YWxpZCB3aWR0aCBvciBoZWlnaHQnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlV3JpdGVyKCk7XG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHR3aWR0aDogLTUsXG5cdFx0XHRoZWlnaHQ6IDAsXG5cdFx0fTtcblxuXHRcdGV4cGVjdCgoKSA9PiB3cml0ZVBzZCh3cml0ZXIsIHBzZCkpLnRocm93KGBJbnZhbGlkIGRvY3VtZW50IHNpemVgKTtcblx0fSk7XG5cblx0Y29uc3QgZnVsbEltYWdlID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihsYXllckltYWdlc1BhdGgsICdmdWxsLnBuZycpKTtcblx0Y29uc3QgdHJhbnNwYXJlbnRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAndHJhbnNwYXJlbnQucG5nJykpO1xuXHRjb25zdCB0cmltbWVkSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ3RyaW1tZWQucG5nJykpO1xuXHQvLyBjb25zdCBjcm9wcGVkSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ2Nyb3BwZWQucG5nJykpO1xuXHQvLyBjb25zdCBwYWRkZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAncGFkZGVkLnBuZycpKTtcblxuXHRkZXNjcmliZSgnbGF5ZXIgbGVmdCwgdG9wLCByaWdodCwgYm90dG9tIGhhbmRsaW5nJywgKCkgPT4ge1xuXHRcdGl0KCdoYW5kbGVzIHVuZGVmaW5lZCBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20gd2l0aCBsYXllciBpbWFnZSB0aGUgc2FtZSBzaXplIGFzIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnZnVsbC1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcblx0XHR9KTtcblxuXHRcdGl0KCdoYW5kbGVzIGxheWVyIGltYWdlIGxhcmdlciB0aGFuIGRvY3VtZW50JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAxMDAsXG5cdFx0XHRcdGhlaWdodDogNTAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdvdmVyc2l6ZWQtbGF5ZXItaW1hZ2UucG5nJyk7XG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XG5cdFx0fSk7XG5cblx0XHRpdCgnYWxpZ25zIGxheWVyIGltYWdlIHRvIHRvcCBsZWZ0IGlmIGxheWVyIGltYWdlIGlzIHNtYWxsZXIgdGhhbiBkb2N1bWVudCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRjYW52YXM6IHRyaW1tZWRJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XG5cblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcblx0XHRcdGNvbXBhcmVDYW52YXNlcyh0cmltbWVkSW1hZ2UsIGxheWVyLmNhbnZhcywgJ3NtYWxsZXItbGF5ZXItaW1hZ2UucG5nJyk7XG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMTkyKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDY4KTtcblx0XHR9KTtcblxuXHRcdGl0KCdkb2VzIG5vdCB0cmltIHRyYW5zcGFyZW50IGxheWVyIGltYWdlIGlmIHRyaW0gb3B0aW9uIGlzIG5vdCBwYXNzZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcblx0XHRcdFx0d2lkdGg6IDMwMCxcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiB0cmFuc3BhcmVudEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyYW5zcGFyZW50SW1hZ2UsIGxheWVyLmNhbnZhcywgJ3RyYW5zcGFyZW50LWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ3RyaW1zIHRyYW5zcGFyZW50IGxheWVyIGltYWdlIGlmIHRyaW0gb3B0aW9uIGlzIHNldCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRjYW52YXM6IHRyYW5zcGFyZW50SW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QsIHsgdHJpbUltYWdlRGF0YTogdHJ1ZSB9KTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyaW1tZWRJbWFnZSwgbGF5ZXIuY2FudmFzLCAndHJpbW1lZC1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MSk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCg2NSk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDI0Myk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgxMzMpO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ3Bvc2l0aW9ucyB0aGUgbGF5ZXIgYXQgZ2l2ZW4gbGVmdC90b3Agb2Zmc2V0cycsICgpID0+IHtcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCxcblx0XHRcdFx0XHRcdHRvcDogMzAsXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XG5cblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2xlZnQtdG9wLWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDMwKTtcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzUwKTtcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIzMCk7XG5cdFx0fSk7XG5cblx0XHRpdCgnaWdub3JlcyByaWdodC9ib3R0b20gdmFsdWVzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdHJpZ2h0OiAyMDAsXG5cdFx0XHRcdFx0XHRib3R0b206IDEwMCxcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnY3JvcHBlZC1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcblx0XHR9KTtcblxuXHRcdGl0KCdpZ25vcmVzIGxhcmdlciByaWdodC9ib3R0b20gdmFsdWVzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdHJpZ2h0OiA0MDAsXG5cdFx0XHRcdFx0XHRib3R0b206IDI1MCxcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcblxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAncGFkZGVkLWxheWVyLWltYWdlLnBuZycpO1xuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ2lnbm9yZXMgcmlnaHQvYm90dG9tIHZhbHVlcyBpZiB0aGV5IGRvIG5vdCBtYXRjaCBjYW52YXMgc2l6ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xuXHRcdFx0XHR3aWR0aDogMzAwLFxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRcdFx0XHRsZWZ0OiA1MCxcblx0XHRcdFx0XHRcdHRvcDogNTAsXG5cdFx0XHRcdFx0XHRyaWdodDogNTAsXG5cdFx0XHRcdFx0XHRib3R0b206IDUwLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdlbXB0eS1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCg1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDM1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyNTApO1xuXHRcdH0pO1xuXG5cdFx0aXQoJ2lnbm9yZXMgcmlnaHQvYm90dG9tIHZhbHVlcyBpZiB0aGV5IGFtb3VudCB0byBuZWdhdGl2ZSBzaXplJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XG5cdFx0XHRcdHdpZHRoOiAzMDAsXG5cdFx0XHRcdGhlaWdodDogMjAwLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdFx0XHRcdGxlZnQ6IDUwLFxuXHRcdFx0XHRcdFx0dG9wOiA1MCxcblx0XHRcdFx0XHRcdHJpZ2h0OiAwLFxuXHRcdFx0XHRcdFx0Ym90dG9tOiAwLFxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xuXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdlbXB0eS1sYXllci1pbWFnZS5wbmcnKTtcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCg1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDM1MCk7XG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyNTApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRmcy5yZWFkZGlyU3luYyh3cml0ZUZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gIS9wYXR0ZXJuLy50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xuXHRcdGl0KGB3cml0ZXMgUFNEIGZpbGUgKCR7Zn0pYCwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgYmFzZVBhdGggPSBwYXRoLmpvaW4od3JpdGVGaWxlc1BhdGgsIGYpO1xuXHRcdFx0Y29uc3QgcHNkID0gbG9hZFBzZEZyb21KU09OQW5kUE5HRmlsZXMoYmFzZVBhdGgpO1xuXG5cdFx0XHRjb25zdCBiZWZvcmUgPSBKU09OLnN0cmluZ2lmeShwc2QsIHJlcGxhY2VyKTtcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBnZW5lcmF0ZVRodW1ibmFpbDogZmFsc2UsIHRyaW1JbWFnZURhdGE6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGFmdGVyID0gSlNPTi5zdHJpbmdpZnkocHNkLCByZXBsYWNlcik7XG5cblx0XHRcdGV4cGVjdChiZWZvcmUpLmVxdWFsKGFmdGVyLCAncHNkIG9iamVjdCBtdXRhdGVkJyk7XG5cblx0XHRcdGZzLm1rZGlyU3luYyhyZXN1bHRzRmlsZXNQYXRoLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LnBzZGApLCBidWZmZXIpO1xuXHRcdFx0Ly8gZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4ocmVzdWx0c0ZpbGVzUGF0aCwgYCR7Zn0uYmluYCksIGJ1ZmZlcik7XG5cblx0XHRcdGNvbnN0IHJlYWRlciA9IGNyZWF0ZVJlYWRlcihidWZmZXIuYnVmZmVyKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlYWRQc2QocmVhZGVyLCB7IHNraXBMYXllckltYWdlRGF0YTogdHJ1ZSwgbG9nTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCB0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LWNvbXBvc2l0ZS5wbmdgKSwgcmVzdWx0LmNhbnZhcyEudG9CdWZmZXIoKSk7XG5cdFx0XHQvL2NvbXBhcmVDYW52YXNlcyhwc2QuY2FudmFzLCByZXN1bHQuY2FudmFzLCAnY29tcG9zaXRlIGltYWdlJyk7XG5cblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ2V4cGVjdGVkLnBzZCcpKTtcblx0XHRcdGNvbXBhcmVCdWZmZXJzKGJ1ZmZlciwgZXhwZWN0ZWQsIGBBcnJheUJ1ZmZlclBzZFdyaXRlcmApO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiByZXBsYWNlcihrZXk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuXHRpZiAoa2V5ID09PSAnY2FudmFzJykge1xuXHRcdHJldHVybiAnPGNhbnZhcz4nO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxufVxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
