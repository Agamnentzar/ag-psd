"use strict";
/// <reference types="mocha" />
/// <reference path="../../typings/chai.d.ts" />
/// <reference path="../../typings/canvas.d.ts" />
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
exports.expectBuffersEqual = exports.compareBuffers = exports.compareCanvases = exports.loadCanvasFromFile = exports.saveCanvas = exports.extractPSD = exports.readPsdFromFile = exports.createReaderFromBuffer = exports.loadImagesFromDirectory = exports.importPSD = exports.range = exports.repeat = exports.toArrayBuffer = exports.createCanvas = void 0;
require('source-map-support').install();
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var canvas_1 = require("canvas");
Object.defineProperty(exports, "createCanvas", { enumerable: true, get: function () { return canvas_1.createCanvas; } });
require("../initializeCanvas");
var psdReader_1 = require("../psdReader");
var descriptor_1 = require("../descriptor");
descriptor_1.setLogErrors(true);
var resultsPath = path.join(__dirname, '..', '..', 'results');
function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
exports.toArrayBuffer = toArrayBuffer;
function repeat(times) {
    var values = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }
    if (!values.length) {
        throw new Error('missing values');
    }
    var array = [];
    for (var i = 0; i < times; i++) {
        array.push.apply(array, values);
    }
    return array;
}
exports.repeat = repeat;
function range(start, length) {
    var array = [];
    for (var i = 0; i < length; i++) {
        array.push(start + i);
    }
    return array;
}
exports.range = range;
function importPSD(dirName) {
    var dataPath = path.join(dirName, 'data.json');
    if (!fs.existsSync(dataPath))
        return undefined;
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
exports.importPSD = importPSD;
function loadImagesFromDirectory(dirName) {
    var images = {};
    fs.readdirSync(dirName)
        .filter(function (f) { return /\.png$/.test(f); })
        .forEach(function (f) { return images[f] = loadCanvasFromFile(path.join(dirName, f)); });
    return images;
}
exports.loadImagesFromDirectory = loadImagesFromDirectory;
function createReaderFromBuffer(buffer) {
    return psdReader_1.createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
exports.createReaderFromBuffer = createReaderFromBuffer;
function readPsdFromFile(fileName, options) {
    var buffer = fs.readFileSync(fileName);
    var reader = createReaderFromBuffer(buffer);
    return psdReader_1.readPsd(reader, options);
}
exports.readPsdFromFile = readPsdFromFile;
function extractPSD(filePath, psd) {
    var basePath = path.join(resultsPath, filePath);
    if (!fs.existsSync(basePath))
        fs.mkdirSync(basePath);
    if (psd.canvas) {
        fs.writeFileSync(path.join(basePath, 'canvas.png'), psd.canvas.toBuffer());
        psd.canvas = undefined;
    }
    psd.children.forEach(function (l, i) {
        if (l.canvas) {
            fs.writeFileSync(path.join(basePath, "layer-" + i + ".png"), l.canvas.toBuffer());
            l.canvas = undefined;
        }
    });
    fs.writeFileSync(path.join(basePath, 'data.json'), JSON.stringify(psd, null, 2));
}
exports.extractPSD = extractPSD;
function saveCanvas(fileName, canvas) {
    if (canvas) {
        fs.writeFileSync(fileName, canvas.toBuffer());
    }
}
exports.saveCanvas = saveCanvas;
function loadCanvasFromFile(filePath) {
    var img = new canvas_1.Image();
    img.src = fs.readFileSync(filePath);
    var canvas = canvas_1.createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
}
exports.loadCanvasFromFile = loadCanvasFromFile;
function compareCanvases(expected, actual, name) {
    var saveFailure = function () {
        var failuresDir = path.join(resultsPath, 'failures');
        if (!fs.existsSync(failuresDir)) {
            fs.mkdirSync(failuresDir);
        }
        fs.writeFileSync(path.join(failuresDir, "" + name.replace(/[\\/]/, '-')), actual.toBuffer());
    };
    if (expected === actual)
        return;
    if (!expected)
        throw new Error("Expected canvas is null (" + name + ")");
    if (!actual)
        throw new Error("Actual canvas is null (" + name + ")");
    if (expected.width !== actual.width || expected.height !== actual.height) {
        saveFailure();
        throw new Error("Canvas size is different than expected (" + name + ")");
    }
    var expectedData = expected.getContext('2d').getImageData(0, 0, expected.width, expected.height);
    var actualData = actual.getContext('2d').getImageData(0, 0, actual.width, actual.height);
    var length = expectedData.width * expectedData.height * 4;
    for (var i = 0; i < length; i++) {
        if (expectedData.data[i] !== actualData.data[i]) {
            saveFailure();
            var expectedNumBytes = expectedData.data.length;
            var actualNumBytes = actualData.data.length;
            throw new Error("Actual canvas (" + actualNumBytes + " bytes) different " +
                ("than expected (" + name + ": " + expectedNumBytes + " bytes) ") +
                ("at index " + i + ": actual " + actualData.data[i] + " vs. expected " + expectedData.data[i]));
        }
    }
}
exports.compareCanvases = compareCanvases;
function compareBuffers(actual, expected, test, start, offset) {
    if (start === void 0) { start = 0; }
    if (offset === void 0) { offset = 0; }
    if (!actual)
        throw new Error("Actual buffer is null or undefined (" + test + ")");
    if (!expected)
        throw new Error("Expected buffer is null or undefined (" + test + ")");
    for (var i = start; i < expected.length; i++) {
        if (expected[i] !== actual[i + offset]) {
            throw new Error("Buffers differ " +
                ("expected: 0x" + expected[i].toString(16) + " at [0x" + i.toString(16) + "] ") +
                ("actual: 0x" + actual[i + offset].toString(16) + " at [0x" + (i + offset).toString(16) + "] (" + test + ")"));
        }
    }
    if (actual.length !== expected.length)
        throw new Error("Buffers differ in size actual: " + actual.length + " expected: " + expected.length + " (" + test + ")");
}
exports.compareBuffers = compareBuffers;
function expectBuffersEqual(actual, expected, name) {
    var length = Math.max(actual.length, expected.length);
    for (var i = 0; i < length; i++) {
        if (actual[i] !== expected[i]) {
            fs.writeFileSync(path.join(__dirname, '..', '..', 'results', name), Buffer.from(actual));
            throw new Error("Different byte at 0x" + i.toString(16) + " in (" + name + ")");
        }
    }
}
exports.expectBuffersEqual = expectBuffersEqual;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDekYsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBdUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsYUFBUSxJQUFJLE1BQUcsQ0FBQyxDQUFDO1NBQ3RFO0tBQ0Q7QUFDRixDQUFDO0FBVEQsZ0RBU0MiLCJmaWxlIjoidGVzdC9jb21tb24uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSB0eXBlcz1cIm1vY2hhXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi8uLi90eXBpbmdzL2NoYWkuZC50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vLi4vdHlwaW5ncy9jYW52YXMuZC50c1wiIC8+XG5cbnJlcXVpcmUoJ3NvdXJjZS1tYXAtc3VwcG9ydCcpLmluc3RhbGwoKTtcblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IGNyZWF0ZUNhbnZhcywgSW1hZ2UgfSBmcm9tICdjYW52YXMnO1xuaW1wb3J0ICcuLi9pbml0aWFsaXplQ2FudmFzJztcbmltcG9ydCB7IFBzZCwgUmVhZE9wdGlvbnMgfSBmcm9tICcuLi9pbmRleCc7XG5pbXBvcnQgeyByZWFkUHNkLCBjcmVhdGVSZWFkZXIgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xuaW1wb3J0IHsgc2V0TG9nRXJyb3JzIH0gZnJvbSAnLi4vZGVzY3JpcHRvcic7XG5leHBvcnQgeyBjcmVhdGVDYW52YXMgfTtcblxuc2V0TG9nRXJyb3JzKHRydWUpO1xuXG5jb25zdCByZXN1bHRzUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXN1bHRzJyk7XG5cbmV4cG9ydCB0eXBlIEltYWdlTWFwID0geyBba2V5OiBzdHJpbmddOiBIVE1MQ2FudmFzRWxlbWVudCB9O1xuXG5leHBvcnQgZnVuY3Rpb24gdG9BcnJheUJ1ZmZlcihidWZmZXI6IEJ1ZmZlcikge1xuXHRjb25zdCBhYiA9IG5ldyBBcnJheUJ1ZmZlcihidWZmZXIubGVuZ3RoKTtcblx0Y29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGFiKTtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7ICsraSkge1xuXHRcdHZpZXdbaV0gPSBidWZmZXJbaV07XG5cdH1cblxuXHRyZXR1cm4gYWI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXQ8VD4odGltZXM6IG51bWJlciwgLi4udmFsdWVzOiBUW10pOiBUW10ge1xuXHRpZiAoIXZhbHVlcy5sZW5ndGgpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ21pc3NpbmcgdmFsdWVzJyk7XG5cdH1cblxuXHRjb25zdCBhcnJheTogVFtdID0gW107XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aW1lczsgaSsrKSB7XG5cdFx0YXJyYXkucHVzaCguLi52YWx1ZXMpO1xuXHR9XG5cblx0cmV0dXJuIGFycmF5O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmFuZ2Uoc3RhcnQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXJbXSB7XG5cdGNvbnN0IGFycmF5OiBudW1iZXJbXSA9IFtdO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRhcnJheS5wdXNoKHN0YXJ0ICsgaSk7XG5cdH1cblxuXHRyZXR1cm4gYXJyYXk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRQU0QoZGlyTmFtZTogc3RyaW5nKTogUHNkIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgZGF0YVBhdGggPSBwYXRoLmpvaW4oZGlyTmFtZSwgJ2RhdGEuanNvbicpO1xuXG5cdGlmICghZnMuZXhpc3RzU3luYyhkYXRhUGF0aCkpXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblxuXHRyZXR1cm4gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoZGF0YVBhdGgsICd1dGY4JykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbG9hZEltYWdlc0Zyb21EaXJlY3RvcnkoZGlyTmFtZTogc3RyaW5nKSB7XG5cdGNvbnN0IGltYWdlczogSW1hZ2VNYXAgPSB7fTtcblxuXHRmcy5yZWFkZGlyU3luYyhkaXJOYW1lKVxuXHRcdC5maWx0ZXIoZiA9PiAvXFwucG5nJC8udGVzdChmKSlcblx0XHQuZm9yRWFjaChmID0+IGltYWdlc1tmXSA9IGxvYWRDYW52YXNGcm9tRmlsZShwYXRoLmpvaW4oZGlyTmFtZSwgZikpKTtcblxuXHRyZXR1cm4gaW1hZ2VzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXI6IEJ1ZmZlcikge1xuXHRyZXR1cm4gY3JlYXRlUmVhZGVyKGJ1ZmZlci5idWZmZXIsIGJ1ZmZlci5ieXRlT2Zmc2V0LCBidWZmZXIuYnl0ZUxlbmd0aCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkUHNkRnJvbUZpbGUoZmlsZU5hbWU6IHN0cmluZywgb3B0aW9ucz86IFJlYWRPcHRpb25zKTogUHNkIHtcblx0Y29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKGZpbGVOYW1lKTtcblx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyRnJvbUJ1ZmZlcihidWZmZXIpO1xuXHRyZXR1cm4gcmVhZFBzZChyZWFkZXIsIG9wdGlvbnMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFBTRChmaWxlUGF0aDogc3RyaW5nLCBwc2Q6IFBzZCkge1xuXHRjb25zdCBiYXNlUGF0aCA9IHBhdGguam9pbihyZXN1bHRzUGF0aCwgZmlsZVBhdGgpO1xuXG5cdGlmICghZnMuZXhpc3RzU3luYyhiYXNlUGF0aCkpXG5cdFx0ZnMubWtkaXJTeW5jKGJhc2VQYXRoKTtcblxuXHRpZiAocHNkLmNhbnZhcykge1xuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnY2FudmFzLnBuZycpLCBwc2QuY2FudmFzLnRvQnVmZmVyKCkpO1xuXHRcdHBzZC5jYW52YXMgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwc2QuY2hpbGRyZW4hLmZvckVhY2goKGwsIGkpID0+IHtcblx0XHRpZiAobC5jYW52YXMpIHtcblx0XHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCBgbGF5ZXItJHtpfS5wbmdgKSwgbC5jYW52YXMudG9CdWZmZXIoKSk7XG5cdFx0XHRsLmNhbnZhcyA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH0pO1xuXG5cdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJhc2VQYXRoLCAnZGF0YS5qc29uJyksIEpTT04uc3RyaW5naWZ5KHBzZCwgbnVsbCwgMikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2F2ZUNhbnZhcyhmaWxlTmFtZTogc3RyaW5nLCBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50IHwgdW5kZWZpbmVkKSB7XG5cdGlmIChjYW52YXMpIHtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGZpbGVOYW1lLCBjYW52YXMudG9CdWZmZXIoKSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRDYW52YXNGcm9tRmlsZShmaWxlUGF0aDogc3RyaW5nKSB7XG5cdGNvbnN0IGltZyA9IG5ldyBJbWFnZSgpO1xuXHRpbWcuc3JjID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoKTtcblx0Y29uc3QgY2FudmFzID0gY3JlYXRlQ2FudmFzKGltZy53aWR0aCwgaW1nLmhlaWdodCk7XG5cdGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpIS5kcmF3SW1hZ2UoaW1nLCAwLCAwKTtcblx0cmV0dXJuIGNhbnZhcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVDYW52YXNlcyhleHBlY3RlZDogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQsIGFjdHVhbDogSFRNTENhbnZhc0VsZW1lbnQgfCB1bmRlZmluZWQsIG5hbWU6IHN0cmluZykge1xuXHRjb25zdCBzYXZlRmFpbHVyZSA9ICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlc0RpciA9IHBhdGguam9pbihyZXN1bHRzUGF0aCwgJ2ZhaWx1cmVzJyk7XG5cdFx0aWYgKCFmcy5leGlzdHNTeW5jKGZhaWx1cmVzRGlyKSkge1xuXHRcdFx0ZnMubWtkaXJTeW5jKGZhaWx1cmVzRGlyKTtcblx0XHR9XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oZmFpbHVyZXNEaXIsIGAke25hbWUucmVwbGFjZSgvW1xcXFwvXS8sICctJyl9YCksIGFjdHVhbCEudG9CdWZmZXIoKSk7XG5cdH07XG5cblx0aWYgKGV4cGVjdGVkID09PSBhY3R1YWwpXG5cdFx0cmV0dXJuO1xuXHRpZiAoIWV4cGVjdGVkKVxuXHRcdHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgY2FudmFzIGlzIG51bGwgKCR7bmFtZX0pYCk7XG5cdGlmICghYWN0dWFsKVxuXHRcdHRocm93IG5ldyBFcnJvcihgQWN0dWFsIGNhbnZhcyBpcyBudWxsICgke25hbWV9KWApO1xuXG5cdGlmIChleHBlY3RlZC53aWR0aCAhPT0gYWN0dWFsLndpZHRoIHx8IGV4cGVjdGVkLmhlaWdodCAhPT0gYWN0dWFsLmhlaWdodCkge1xuXHRcdHNhdmVGYWlsdXJlKCk7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDYW52YXMgc2l6ZSBpcyBkaWZmZXJlbnQgdGhhbiBleHBlY3RlZCAoJHtuYW1lfSlgKTtcblx0fVxuXG5cdGNvbnN0IGV4cGVjdGVkRGF0YSA9IGV4cGVjdGVkLmdldENvbnRleHQoJzJkJykhLmdldEltYWdlRGF0YSgwLCAwLCBleHBlY3RlZC53aWR0aCwgZXhwZWN0ZWQuaGVpZ2h0KTtcblx0Y29uc3QgYWN0dWFsRGF0YSA9IGFjdHVhbC5nZXRDb250ZXh0KCcyZCcpIS5nZXRJbWFnZURhdGEoMCwgMCwgYWN0dWFsLndpZHRoLCBhY3R1YWwuaGVpZ2h0KTtcblx0Y29uc3QgbGVuZ3RoID0gZXhwZWN0ZWREYXRhLndpZHRoICogZXhwZWN0ZWREYXRhLmhlaWdodCAqIDQ7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdGlmIChleHBlY3RlZERhdGEuZGF0YVtpXSAhPT0gYWN0dWFsRGF0YS5kYXRhW2ldKSB7XG5cdFx0XHRzYXZlRmFpbHVyZSgpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWROdW1CeXRlcyA9IGV4cGVjdGVkRGF0YS5kYXRhLmxlbmd0aDtcblx0XHRcdGNvbnN0IGFjdHVhbE51bUJ5dGVzID0gYWN0dWFsRGF0YS5kYXRhLmxlbmd0aDtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcblx0XHRcdFx0YEFjdHVhbCBjYW52YXMgKCR7YWN0dWFsTnVtQnl0ZXN9IGJ5dGVzKSBkaWZmZXJlbnQgYCArXG5cdFx0XHRcdGB0aGFuIGV4cGVjdGVkICgke25hbWV9OiAke2V4cGVjdGVkTnVtQnl0ZXN9IGJ5dGVzKSBgICtcblx0XHRcdFx0YGF0IGluZGV4ICR7aX06IGFjdHVhbCAke2FjdHVhbERhdGEuZGF0YVtpXX0gdnMuIGV4cGVjdGVkICR7ZXhwZWN0ZWREYXRhLmRhdGFbaV19YFxuXHRcdFx0KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVCdWZmZXJzKGFjdHVhbDogQnVmZmVyLCBleHBlY3RlZDogQnVmZmVyLCB0ZXN0OiBzdHJpbmcsIHN0YXJ0ID0gMCwgb2Zmc2V0ID0gMCkge1xuXHRpZiAoIWFjdHVhbClcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEFjdHVhbCBidWZmZXIgaXMgbnVsbCBvciB1bmRlZmluZWQgKCR7dGVzdH0pYCk7XG5cdGlmICghZXhwZWN0ZWQpXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBidWZmZXIgaXMgbnVsbCBvciB1bmRlZmluZWQgKCR7dGVzdH0pYCk7XG5cblx0Zm9yIChsZXQgaSA9IHN0YXJ0OyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoZXhwZWN0ZWRbaV0gIT09IGFjdHVhbFtpICsgb2Zmc2V0XSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBCdWZmZXJzIGRpZmZlciBgICtcblx0XHRcdFx0YGV4cGVjdGVkOiAweCR7ZXhwZWN0ZWRbaV0udG9TdHJpbmcoMTYpfSBhdCBbMHgke2kudG9TdHJpbmcoMTYpfV0gYCArXG5cdFx0XHRcdGBhY3R1YWw6IDB4JHthY3R1YWxbaSArIG9mZnNldF0udG9TdHJpbmcoMTYpfSBhdCBbMHgkeyhpICsgb2Zmc2V0KS50b1N0cmluZygxNil9XSAoJHt0ZXN0fSlgKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoYWN0dWFsLmxlbmd0aCAhPT0gZXhwZWN0ZWQubGVuZ3RoKVxuXHRcdHRocm93IG5ldyBFcnJvcihgQnVmZmVycyBkaWZmZXIgaW4gc2l6ZSBhY3R1YWw6ICR7YWN0dWFsLmxlbmd0aH0gZXhwZWN0ZWQ6ICR7ZXhwZWN0ZWQubGVuZ3RofSAoJHt0ZXN0fSlgKTtcbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gZXhwZWN0QnVmZmVyc0VxdWFsKGFjdHVhbDogVWludDhBcnJheSwgZXhwZWN0ZWQ6IFVpbnQ4QXJyYXksIG5hbWU6IHN0cmluZykge1xuXHRjb25zdCBsZW5ndGggPSBNYXRoLm1heChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoYWN0dWFsW2ldICE9PSBleHBlY3RlZFtpXSkge1xuXHRcdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAncmVzdWx0cycsIG5hbWUpLCBCdWZmZXIuZnJvbShhY3R1YWwpKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRGlmZmVyZW50IGJ5dGUgYXQgMHgke2kudG9TdHJpbmcoMTYpfSBpbiAoJHtuYW1lfSlgKTtcblx0XHR9XG5cdH1cbn1cbiJdLCJzb3VyY2VSb290IjoiL1VzZXJzL2pvZXJhaWkvZGV2L2FnLXBzZC9zcmMifQ==
