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
import { loadCanvasFromFile, compareBuffers, createCanvas, compareCanvases } from './common';
import { writePsd, writeSignature, getWriterBuffer, createWriter } from '../psdWriter';
import { readPsd, createReader } from '../psdReader';
import { writePsdBuffer } from '../index';
var layerImagesPath = path.join(__dirname, '..', '..', 'test', 'layer-images');
var writeFilesPath = path.join(__dirname, '..', '..', 'test', 'write');
var resultsFilesPath = path.join(__dirname, '..', '..', 'results');
function writeAndRead(psd, writeOptions, readOptions) {
    if (writeOptions === void 0) { writeOptions = {}; }
    if (readOptions === void 0) { readOptions = {}; }
    var writer = createWriter();
    writePsd(writer, psd, writeOptions);
    var buffer = getWriterBuffer(writer);
    var reader = createReader(buffer);
    return readPsd(reader, __assign(__assign({}, readOptions), { throwForMissingFeatures: true, logMissingFeatures: true }));
}
function tryLoadCanvasFromFile(filePath) {
    try {
        return loadCanvasFromFile(filePath);
    }
    catch (_a) {
        return undefined;
    }
}
function loadPsdFromJSONAndPNGFiles(basePath) {
    var _a;
    var psd = JSON.parse(fs.readFileSync(path.join(basePath, 'data.json'), 'utf8'));
    psd.canvas = loadCanvasFromFile(path.join(basePath, 'canvas.png'));
    psd.children.forEach(function (l, i) {
        if (!l.children) {
            l.canvas = tryLoadCanvasFromFile(path.join(basePath, "layer-".concat(i, ".png")));
            if (l.mask) {
                l.mask.canvas = tryLoadCanvasFromFile(path.join(basePath, "layer-".concat(i, "-mask.png")));
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
        var writer = createWriter();
        var psd = {
            width: 300,
            height: 200
        };
        writePsd(writer, psd);
    });
    it('throws if passed invalid signature', function () {
        var writer = createWriter();
        var _loop_1 = function (s) {
            expect(function () { return writeSignature(writer, s); }, s).throw("Invalid signature: '".concat(s, "'"));
        };
        for (var _i = 0, _a = ['a', 'ab', 'abcde']; _i < _a.length; _i++) {
            var s = _a[_i];
            _loop_1(s);
        }
    });
    it('throws exception if has layer with both children and canvas properties set', function () {
        var writer = createWriter();
        var psd = {
            width: 300,
            height: 200,
            children: [{ children: [], canvas: createCanvas(300, 300) }]
        };
        expect(function () { return writePsd(writer, psd); }).throw("Invalid layer, cannot have both 'canvas' and 'children' properties");
    });
    it('throws exception if has layer with both children and imageData properties set', function () {
        var writer = createWriter();
        var psd = {
            width: 300,
            height: 200,
            children: [{ children: [], imageData: {} }]
        };
        expect(function () { return writePsd(writer, psd); }).throw("Invalid layer, cannot have both 'imageData' and 'children' properties");
    });
    it('throws if psd has invalid width or height', function () {
        var writer = createWriter();
        var psd = {
            width: -5,
            height: 0,
        };
        expect(function () { return writePsd(writer, psd); }).throw("Invalid document size");
    });
    var fullImage = loadCanvasFromFile(path.join(layerImagesPath, 'full.png'));
    var transparentImage = loadCanvasFromFile(path.join(layerImagesPath, 'transparent.png'));
    var trimmedImage = loadCanvasFromFile(path.join(layerImagesPath, 'trimmed.png'));
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
            compareCanvases(fullImage, layer.canvas, 'full-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(300);
            expect(layer.bottom).equal(200);
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
            compareCanvases(fullImage, layer.canvas, 'oversized-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(300);
            expect(layer.bottom).equal(200);
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
            compareCanvases(trimmedImage, layer.canvas, 'smaller-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(192);
            expect(layer.bottom).equal(68);
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
            compareCanvases(transparentImage, layer.canvas, 'transparent-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(300);
            expect(layer.bottom).equal(200);
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
            compareCanvases(trimmedImage, layer.canvas, 'trimmed-layer-image.png');
            expect(layer.left).equal(51);
            expect(layer.top).equal(65);
            expect(layer.right).equal(243);
            expect(layer.bottom).equal(133);
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
            compareCanvases(fullImage, layer.canvas, 'left-top-layer-image.png');
            expect(layer.left).equal(50);
            expect(layer.top).equal(30);
            expect(layer.right).equal(350);
            expect(layer.bottom).equal(230);
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
            compareCanvases(fullImage, layer.canvas, 'cropped-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(300);
            expect(layer.bottom).equal(200);
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
            compareCanvases(fullImage, layer.canvas, 'padded-layer-image.png');
            expect(layer.left).equal(0);
            expect(layer.top).equal(0);
            expect(layer.right).equal(300);
            expect(layer.bottom).equal(200);
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
            compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
            expect(layer.left).equal(50);
            expect(layer.top).equal(50);
            expect(layer.right).equal(350);
            expect(layer.bottom).equal(250);
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
            compareCanvases(fullImage, layer.canvas, 'empty-layer-image.png');
            expect(layer.left).equal(50);
            expect(layer.top).equal(50);
            expect(layer.right).equal(350);
            expect(layer.bottom).equal(250);
        });
    });
    // fs.readdirSync(writeFilesPath).filter(f => /smart-object/.test(f)).forEach(f => {
    fs.readdirSync(writeFilesPath).filter(function (f) { return !/pattern/.test(f); }).forEach(function (f) {
        it("writes PSD file (".concat(f, ")"), function () {
            var basePath = path.join(writeFilesPath, f);
            var psd = loadPsdFromJSONAndPNGFiles(basePath);
            var before = JSON.stringify(psd, replacer);
            var buffer = writePsdBuffer(psd, { generateThumbnail: false, trimImageData: true, logMissingFeatures: true });
            var after = JSON.stringify(psd, replacer);
            expect(before).equal(after, 'psd object mutated');
            fs.mkdirSync(resultsFilesPath, { recursive: true });
            fs.writeFileSync(path.join(resultsFilesPath, "".concat(f, ".psd")), buffer);
            // fs.writeFileSync(path.join(resultsFilesPath, `${f}.bin`), buffer); // TEMP
            var reader = createReader(buffer.buffer);
            var result = readPsd(reader, { skipLayerImageData: true, logMissingFeatures: true, throwForMissingFeatures: true });
            fs.writeFileSync(path.join(resultsFilesPath, "".concat(f, "-composite.png")), result.canvas.toBuffer());
            //compareCanvases(psd.canvas, result.canvas, 'composite image');
            var expected = fs.readFileSync(path.join(basePath, 'expected.psd'));
            compareBuffers(buffer, expected, "ArrayBufferPsdWriter", 0);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLGNBQWMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUVILFNBQVMsUUFBUSxDQUFDLEdBQVcsRUFBRSxLQUFVO0lBQ3hDLElBQUksR0FBRyxLQUFLLFFBQVEsRUFBRTtRQUNyQixPQUFPLFVBQVUsQ0FBQztLQUNsQjtTQUFNO1FBQ04sT0FBTyxLQUFLLENBQUM7S0FDYjtBQUNGLENBQUMiLCJmaWxlIjoidGVzdC9wc2RXcml0ZXIuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XHJcbmltcG9ydCB7IGxvYWRDYW52YXNGcm9tRmlsZSwgY29tcGFyZUJ1ZmZlcnMsIGNyZWF0ZUNhbnZhcywgY29tcGFyZUNhbnZhc2VzIH0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBQc2QsIFdyaXRlT3B0aW9ucywgUmVhZE9wdGlvbnMgfSBmcm9tICcuLi9wc2QnO1xyXG5pbXBvcnQgeyB3cml0ZVBzZCwgd3JpdGVTaWduYXR1cmUsIGdldFdyaXRlckJ1ZmZlciwgY3JlYXRlV3JpdGVyIH0gZnJvbSAnLi4vcHNkV3JpdGVyJztcclxuaW1wb3J0IHsgcmVhZFBzZCwgY3JlYXRlUmVhZGVyIH0gZnJvbSAnLi4vcHNkUmVhZGVyJztcclxuaW1wb3J0IHsgd3JpdGVQc2RCdWZmZXIgfSBmcm9tICcuLi9pbmRleCc7XHJcblxyXG5jb25zdCBsYXllckltYWdlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcsICdsYXllci1pbWFnZXMnKTtcclxuY29uc3Qgd3JpdGVGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcsICd3cml0ZScpO1xyXG5jb25zdCByZXN1bHRzRmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Jlc3VsdHMnKTtcclxuXHJcbmZ1bmN0aW9uIHdyaXRlQW5kUmVhZChwc2Q6IFBzZCwgd3JpdGVPcHRpb25zOiBXcml0ZU9wdGlvbnMgPSB7fSwgcmVhZE9wdGlvbnM6IFJlYWRPcHRpb25zID0ge30pIHtcclxuXHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHR3cml0ZVBzZCh3cml0ZXIsIHBzZCwgd3JpdGVPcHRpb25zKTtcclxuXHRjb25zdCBidWZmZXIgPSBnZXRXcml0ZXJCdWZmZXIod3JpdGVyKTtcclxuXHRjb25zdCByZWFkZXIgPSBjcmVhdGVSZWFkZXIoYnVmZmVyKTtcclxuXHRyZXR1cm4gcmVhZFBzZChyZWFkZXIsIHsgLi4ucmVhZE9wdGlvbnMsIHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLCBsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRyeUxvYWRDYW52YXNGcm9tRmlsZShmaWxlUGF0aDogc3RyaW5nKSB7XHJcblx0dHJ5IHtcclxuXHRcdHJldHVybiBsb2FkQ2FudmFzRnJvbUZpbGUoZmlsZVBhdGgpO1xyXG5cdH0gY2F0Y2gge1xyXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGxvYWRQc2RGcm9tSlNPTkFuZFBOR0ZpbGVzKGJhc2VQYXRoOiBzdHJpbmcpIHtcclxuXHRjb25zdCBwc2Q6IFBzZCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ2RhdGEuanNvbicpLCAndXRmOCcpKTtcclxuXHRwc2QuY2FudmFzID0gbG9hZENhbnZhc0Zyb21GaWxlKHBhdGguam9pbihiYXNlUGF0aCwgJ2NhbnZhcy5wbmcnKSk7XHJcblx0cHNkLmNoaWxkcmVuIS5mb3JFYWNoKChsLCBpKSA9PiB7XHJcblx0XHRpZiAoIWwuY2hpbGRyZW4pIHtcclxuXHRcdFx0bC5jYW52YXMgPSB0cnlMb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGJhc2VQYXRoLCBgbGF5ZXItJHtpfS5wbmdgKSk7XHJcblxyXG5cdFx0XHRpZiAobC5tYXNrKSB7XHJcblx0XHRcdFx0bC5tYXNrLmNhbnZhcyA9IHRyeUxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4oYmFzZVBhdGgsIGBsYXllci0ke2l9LW1hc2sucG5nYCkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSk7XHJcblx0cHNkLmxpbmtlZEZpbGVzPy5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Zi5kYXRhID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgZi5uYW1lKSk7XHJcblx0XHR9IGNhdGNoIChlKSB7IH1cclxuXHR9KTtcclxuXHRyZXR1cm4gcHNkO1xyXG59XHJcblxyXG5kZXNjcmliZSgnUHNkV3JpdGVyJywgKCkgPT4ge1xyXG5cdGl0KCdkb2VzIG5vdCB0aHJvdyBpZiB3cml0aW5nIHBzZCB3aXRoIGVtcHR5IGNhbnZhcycsICgpID0+IHtcclxuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdGhlaWdodDogMjAwXHJcblx0XHR9O1xyXG5cclxuXHRcdHdyaXRlUHNkKHdyaXRlciwgcHNkKTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3Rocm93cyBpZiBwYXNzZWQgaW52YWxpZCBzaWduYXR1cmUnLCAoKSA9PiB7XHJcblx0XHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHJcblx0XHRmb3IgKGNvbnN0IHMgb2YgWydhJywgJ2FiJywgJ2FiY2RlJ10pIHtcclxuXHRcdFx0ZXhwZWN0KCgpID0+IHdyaXRlU2lnbmF0dXJlKHdyaXRlciwgcyksIHMpLnRocm93KGBJbnZhbGlkIHNpZ25hdHVyZTogJyR7c30nYCk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdGl0KCd0aHJvd3MgZXhjZXB0aW9uIGlmIGhhcyBsYXllciB3aXRoIGJvdGggY2hpbGRyZW4gYW5kIGNhbnZhcyBwcm9wZXJ0aWVzIHNldCcsICgpID0+IHtcclxuXHRcdGNvbnN0IHdyaXRlciA9IGNyZWF0ZVdyaXRlcigpO1xyXG5cdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRjaGlsZHJlbjogW3sgY2hpbGRyZW46IFtdLCBjYW52YXM6IGNyZWF0ZUNhbnZhcygzMDAsIDMwMCkgfV1cclxuXHRcdH07XHJcblxyXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2NhbnZhcycgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgndGhyb3dzIGV4Y2VwdGlvbiBpZiBoYXMgbGF5ZXIgd2l0aCBib3RoIGNoaWxkcmVuIGFuZCBpbWFnZURhdGEgcHJvcGVydGllcyBzZXQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0Y2hpbGRyZW46IFt7IGNoaWxkcmVuOiBbXSwgaW1hZ2VEYXRhOiB7fSBhcyBhbnkgfV1cclxuXHRcdH07XHJcblxyXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgbGF5ZXIsIGNhbm5vdCBoYXZlIGJvdGggJ2ltYWdlRGF0YScgYW5kICdjaGlsZHJlbicgcHJvcGVydGllc2ApO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgndGhyb3dzIGlmIHBzZCBoYXMgaW52YWxpZCB3aWR0aCBvciBoZWlnaHQnLCAoKSA9PiB7XHJcblx0XHRjb25zdCB3cml0ZXIgPSBjcmVhdGVXcml0ZXIoKTtcclxuXHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHR3aWR0aDogLTUsXHJcblx0XHRcdGhlaWdodDogMCxcclxuXHRcdH07XHJcblxyXG5cdFx0ZXhwZWN0KCgpID0+IHdyaXRlUHNkKHdyaXRlciwgcHNkKSkudGhyb3coYEludmFsaWQgZG9jdW1lbnQgc2l6ZWApO1xyXG5cdH0pO1xyXG5cclxuXHRjb25zdCBmdWxsSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ2Z1bGwucG5nJykpO1xyXG5cdGNvbnN0IHRyYW5zcGFyZW50SW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ3RyYW5zcGFyZW50LnBuZycpKTtcclxuXHRjb25zdCB0cmltbWVkSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ3RyaW1tZWQucG5nJykpO1xyXG5cdC8vIGNvbnN0IGNyb3BwZWRJbWFnZSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4obGF5ZXJJbWFnZXNQYXRoLCAnY3JvcHBlZC5wbmcnKSk7XHJcblx0Ly8gY29uc3QgcGFkZGVkSW1hZ2UgPSBsb2FkQ2FudmFzRnJvbUZpbGUocGF0aC5qb2luKGxheWVySW1hZ2VzUGF0aCwgJ3BhZGRlZC5wbmcnKSk7XHJcblxyXG5cdGRlc2NyaWJlKCdsYXllciBsZWZ0LCB0b3AsIHJpZ2h0LCBib3R0b20gaGFuZGxpbmcnLCAoKSA9PiB7XHJcblx0XHRpdCgnaGFuZGxlcyB1bmRlZmluZWQgbGVmdCwgdG9wLCByaWdodCwgYm90dG9tIHdpdGggbGF5ZXIgaW1hZ2UgdGhlIHNhbWUgc2l6ZSBhcyBkb2N1bWVudCcsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXHJcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XHJcblxyXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XHJcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2Z1bGwtbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdoYW5kbGVzIGxheWVyIGltYWdlIGxhcmdlciB0aGFuIGRvY3VtZW50JywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMTAwLFxyXG5cdFx0XHRcdGhlaWdodDogNTAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRjYW52YXM6IGZ1bGxJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QpO1xyXG5cclxuXHRcdFx0Y29uc3QgbGF5ZXIgPSByZXN1bHQuY2hpbGRyZW4hWzBdO1xyXG5cdFx0XHRjb21wYXJlQ2FudmFzZXMoZnVsbEltYWdlLCBsYXllci5jYW52YXMsICdvdmVyc2l6ZWQtbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzAwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjAwKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdhbGlnbnMgbGF5ZXIgaW1hZ2UgdG8gdG9wIGxlZnQgaWYgbGF5ZXIgaW1hZ2UgaXMgc21hbGxlciB0aGFuIGRvY3VtZW50JywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiB0cmltbWVkSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyaW1tZWRJbWFnZSwgbGF5ZXIuY2FudmFzLCAnc21hbGxlci1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgxOTIpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCg2OCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgnZG9lcyBub3QgdHJpbSB0cmFuc3BhcmVudCBsYXllciBpbWFnZSBpZiB0cmltIG9wdGlvbiBpcyBub3QgcGFzc2VkJywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiB0cmFuc3BhcmVudEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XHJcblxyXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XHJcblx0XHRcdGNvbXBhcmVDYW52YXNlcyh0cmFuc3BhcmVudEltYWdlLCBsYXllci5jYW52YXMsICd0cmFuc3BhcmVudC1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ3RyaW1zIHRyYW5zcGFyZW50IGxheWVyIGltYWdlIGlmIHRyaW0gb3B0aW9uIGlzIHNldCcsICgpID0+IHtcclxuXHRcdFx0Y29uc3QgcHNkOiBQc2QgPSB7XHJcblx0XHRcdFx0d2lkdGg6IDMwMCxcclxuXHRcdFx0XHRoZWlnaHQ6IDIwMCxcclxuXHRcdFx0XHRjaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRuYW1lOiAndGVzdCcsXHJcblx0XHRcdFx0XHRcdGNhbnZhczogdHJhbnNwYXJlbnRJbWFnZSxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHdyaXRlQW5kUmVhZChwc2QsIHsgdHJpbUltYWdlRGF0YTogdHJ1ZSB9KTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKHRyaW1tZWRJbWFnZSwgbGF5ZXIuY2FudmFzLCAndHJpbW1lZC1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDUxKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnRvcCkuZXF1YWwoNjUpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDI0Myk7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDEzMyk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgncG9zaXRpb25zIHRoZSBsYXllciBhdCBnaXZlbiBsZWZ0L3RvcCBvZmZzZXRzJywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0bGVmdDogNTAsXHJcblx0XHRcdFx0XHRcdHRvcDogMzAsXHJcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XHJcblxyXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XHJcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2xlZnQtdG9wLWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgzMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzUwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjMwKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGl0KCdpZ25vcmVzIHJpZ2h0L2JvdHRvbSB2YWx1ZXMnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRyaWdodDogMjAwLFxyXG5cdFx0XHRcdFx0XHRib3R0b206IDEwMCxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnY3JvcHBlZC1sYXllci1pbWFnZS5wbmcnKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmxlZnQpLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCgwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzMDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyMDApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ2lnbm9yZXMgbGFyZ2VyIHJpZ2h0L2JvdHRvbSB2YWx1ZXMnLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IHBzZDogUHNkID0ge1xyXG5cdFx0XHRcdHdpZHRoOiAzMDAsXHJcblx0XHRcdFx0aGVpZ2h0OiAyMDAsXHJcblx0XHRcdFx0Y2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxyXG5cdFx0XHRcdFx0XHRyaWdodDogNDAwLFxyXG5cdFx0XHRcdFx0XHRib3R0b206IDI1MCxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAncGFkZGVkLWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIucmlnaHQpLmVxdWFsKDMwMCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5ib3R0b20pLmVxdWFsKDIwMCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgnaWdub3JlcyByaWdodC9ib3R0b20gdmFsdWVzIGlmIHRoZXkgZG8gbm90IG1hdGNoIGNhbnZhcyBzaXplJywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0bGVmdDogNTAsXHJcblx0XHRcdFx0XHRcdHRvcDogNTAsXHJcblx0XHRcdFx0XHRcdHJpZ2h0OiA1MCxcclxuXHRcdFx0XHRcdFx0Ym90dG9tOiA1MCxcclxuXHRcdFx0XHRcdFx0Y2FudmFzOiBmdWxsSW1hZ2UsXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdF0sXHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHRjb25zdCByZXN1bHQgPSB3cml0ZUFuZFJlYWQocHNkKTtcclxuXHJcblx0XHRcdGNvbnN0IGxheWVyID0gcmVzdWx0LmNoaWxkcmVuIVswXTtcclxuXHRcdFx0Y29tcGFyZUNhbnZhc2VzKGZ1bGxJbWFnZSwgbGF5ZXIuY2FudmFzLCAnZW1wdHktbGF5ZXItaW1hZ2UucG5nJyk7XHJcblx0XHRcdGV4cGVjdChsYXllci5sZWZ0KS5lcXVhbCg1MCk7XHJcblx0XHRcdGV4cGVjdChsYXllci50b3ApLmVxdWFsKDUwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLnJpZ2h0KS5lcXVhbCgzNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIuYm90dG9tKS5lcXVhbCgyNTApO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0aXQoJ2lnbm9yZXMgcmlnaHQvYm90dG9tIHZhbHVlcyBpZiB0aGV5IGFtb3VudCB0byBuZWdhdGl2ZSBzaXplJywgKCkgPT4ge1xyXG5cdFx0XHRjb25zdCBwc2Q6IFBzZCA9IHtcclxuXHRcdFx0XHR3aWR0aDogMzAwLFxyXG5cdFx0XHRcdGhlaWdodDogMjAwLFxyXG5cdFx0XHRcdGNoaWxkcmVuOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0JyxcclxuXHRcdFx0XHRcdFx0bGVmdDogNTAsXHJcblx0XHRcdFx0XHRcdHRvcDogNTAsXHJcblx0XHRcdFx0XHRcdHJpZ2h0OiAwLFxyXG5cdFx0XHRcdFx0XHRib3R0b206IDAsXHJcblx0XHRcdFx0XHRcdGNhbnZhczogZnVsbEltYWdlLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRdLFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gd3JpdGVBbmRSZWFkKHBzZCk7XHJcblxyXG5cdFx0XHRjb25zdCBsYXllciA9IHJlc3VsdC5jaGlsZHJlbiFbMF07XHJcblx0XHRcdGNvbXBhcmVDYW52YXNlcyhmdWxsSW1hZ2UsIGxheWVyLmNhbnZhcywgJ2VtcHR5LWxheWVyLWltYWdlLnBuZycpO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIubGVmdCkuZXF1YWwoNTApO1xyXG5cdFx0XHRleHBlY3QobGF5ZXIudG9wKS5lcXVhbCg1MCk7XHJcblx0XHRcdGV4cGVjdChsYXllci5yaWdodCkuZXF1YWwoMzUwKTtcclxuXHRcdFx0ZXhwZWN0KGxheWVyLmJvdHRvbSkuZXF1YWwoMjUwKTtcclxuXHRcdH0pO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBmcy5yZWFkZGlyU3luYyh3cml0ZUZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gL3NtYXJ0LW9iamVjdC8udGVzdChmKSkuZm9yRWFjaChmID0+IHtcclxuXHRmcy5yZWFkZGlyU3luYyh3cml0ZUZpbGVzUGF0aCkuZmlsdGVyKGYgPT4gIS9wYXR0ZXJuLy50ZXN0KGYpKS5mb3JFYWNoKGYgPT4ge1xyXG5cdFx0aXQoYHdyaXRlcyBQU0QgZmlsZSAoJHtmfSlgLCAoKSA9PiB7XHJcblx0XHRcdGNvbnN0IGJhc2VQYXRoID0gcGF0aC5qb2luKHdyaXRlRmlsZXNQYXRoLCBmKTtcclxuXHRcdFx0Y29uc3QgcHNkID0gbG9hZFBzZEZyb21KU09OQW5kUE5HRmlsZXMoYmFzZVBhdGgpO1xyXG5cclxuXHRcdFx0Y29uc3QgYmVmb3JlID0gSlNPTi5zdHJpbmdpZnkocHNkLCByZXBsYWNlcik7XHJcblx0XHRcdGNvbnN0IGJ1ZmZlciA9IHdyaXRlUHNkQnVmZmVyKHBzZCwgeyBnZW5lcmF0ZVRodW1ibmFpbDogZmFsc2UsIHRyaW1JbWFnZURhdGE6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSB9KTtcclxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBKU09OLnN0cmluZ2lmeShwc2QsIHJlcGxhY2VyKTtcclxuXHJcblx0XHRcdGV4cGVjdChiZWZvcmUpLmVxdWFsKGFmdGVyLCAncHNkIG9iamVjdCBtdXRhdGVkJyk7XHJcblxyXG5cdFx0XHRmcy5ta2RpclN5bmMocmVzdWx0c0ZpbGVzUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LnBzZGApLCBidWZmZXIpO1xyXG5cdFx0XHQvLyBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihyZXN1bHRzRmlsZXNQYXRoLCBgJHtmfS5iaW5gKSwgYnVmZmVyKTsgLy8gVEVNUFxyXG5cclxuXHRcdFx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGJ1ZmZlci5idWZmZXIpO1xyXG5cdFx0XHRjb25zdCByZXN1bHQgPSByZWFkUHNkKHJlYWRlciwgeyBza2lwTGF5ZXJJbWFnZURhdGE6IHRydWUsIGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSwgdGhyb3dGb3JNaXNzaW5nRmVhdHVyZXM6IHRydWUgfSk7XHJcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKHJlc3VsdHNGaWxlc1BhdGgsIGAke2Z9LWNvbXBvc2l0ZS5wbmdgKSwgcmVzdWx0LmNhbnZhcyEudG9CdWZmZXIoKSk7XHJcblx0XHRcdC8vY29tcGFyZUNhbnZhc2VzKHBzZC5jYW52YXMsIHJlc3VsdC5jYW52YXMsICdjb21wb3NpdGUgaW1hZ2UnKTtcclxuXHJcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihiYXNlUGF0aCwgJ2V4cGVjdGVkLnBzZCcpKTtcclxuXHRcdFx0Y29tcGFyZUJ1ZmZlcnMoYnVmZmVyLCBleHBlY3RlZCwgYEFycmF5QnVmZmVyUHNkV3JpdGVyYCwgMCk7XHJcblx0XHR9KTtcclxuXHR9KTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiByZXBsYWNlcihrZXk6IHN0cmluZywgdmFsdWU6IGFueSkge1xyXG5cdGlmIChrZXkgPT09ICdjYW52YXMnKSB7XHJcblx0XHRyZXR1cm4gJzxjYW52YXM+JztcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIHZhbHVlO1xyXG5cdH1cclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==