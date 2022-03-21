"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var helpers_1 = require("../helpers");
var index_1 = require("../index");
var common_1 = require("./common");
var fs = require("fs");
var psdFileToTest = './test-manual/masked_layer_size_2.psd';
(0, helpers_1.initializeCanvas)(helpers_1.createCanvas, helpers_1.createCanvasFromData);
describe('When getting the size of a layer mask that extends to the left of the border', function () {
    var psd;
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            psd = (0, common_1.readPsdFromFile)(psdFileToTest);
            return [2 /*return*/];
        });
    }); });
    it('Should crop layer size correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var layer, imageContent, maskContent, layerSize;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    layer = psd.children[4];
                    return [4 /*yield*/, layer.canvas.toBuffer()];
                case 1:
                    imageContent = _a.sent();
                    fs.writeFileSync("test1.png", imageContent);
                    return [4 /*yield*/, layer.mask.canvas.toBuffer()];
                case 2:
                    maskContent = _a.sent();
                    fs.writeFileSync("test1_mask.png", maskContent);
                    layerSize = (0, index_1.getMaskedLayerSize)(psd.children[4], 10, psd);
                    (0, chai_1.expect)(psd.width).to.equal(1000);
                    (0, chai_1.expect)(psd.height).to.equal(1000);
                    (0, chai_1.expect)(layerSize.left).to.equal(50);
                    (0, chai_1.expect)(layerSize.right).to.equal(317);
                    (0, chai_1.expect)(layerSize.top).to.equal(670);
                    (0, chai_1.expect)(layerSize.bottom).to.equal(910);
                    return [2 /*return*/];
            }
        });
    }); });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvbGF5ZXJSZXNpemUuc3BlYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZCQUE0QjtBQUM1QixzQ0FBZ0Y7QUFFaEYsa0NBQTRDO0FBQzVDLG1DQUF5QztBQUN6Qyx1QkFBeUI7QUFFekIsSUFBTSxhQUFhLEdBQUcsdUNBQXVDLENBQUM7QUFDOUQsSUFBQSwwQkFBZ0IsRUFBQyxzQkFBWSxFQUFFLDhCQUFvQixDQUFDLENBQUM7QUFFckQsUUFBUSxDQUFDLDhFQUE4RSxFQUFFO0lBQ3hGLElBQUksR0FBUSxDQUFDO0lBQ2IsVUFBVSxDQUFDOztZQUNWLEdBQUcsR0FBRyxJQUFBLHdCQUFlLEVBQUMsYUFBYSxDQUFDLENBQUM7OztTQUNyQyxDQUFDLENBQUM7SUFDSCxFQUFFLENBQUMsa0NBQWtDLEVBQUU7Ozs7O29CQUNoQyxLQUFLLEdBQUcsR0FBRyxDQUFDLFFBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDVixxQkFBWSxLQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFBOztvQkFBbkQsWUFBWSxHQUFHLFNBQW9DO29CQUN6RCxFQUFFLENBQUMsYUFBYSxDQUNmLFdBQVcsRUFDWCxZQUFZLENBQ1osQ0FBQztvQkFDa0IscUJBQVksS0FBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUE7O29CQUF2RCxXQUFXLEdBQUcsU0FBeUM7b0JBQzdELEVBQUUsQ0FBQyxhQUFhLENBQ2YsZ0JBQWdCLEVBQ2hCLFdBQVcsQ0FDWCxDQUFDO29CQUNJLFNBQVMsR0FBRyxJQUFBLDBCQUFrQixFQUFDLEdBQUcsQ0FBQyxRQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUNoRSxJQUFBLGFBQU0sRUFBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakMsSUFBQSxhQUFNLEVBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2xDLElBQUEsYUFBTSxFQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNwQyxJQUFBLGFBQU0sRUFBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsSUFBQSxhQUFNLEVBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3BDLElBQUEsYUFBTSxFQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDOzs7O1NBQ3ZDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvbGF5ZXJSZXNpemUuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7ZXhwZWN0fSBmcm9tICdjaGFpJztcclxuaW1wb3J0IHtjcmVhdGVDYW52YXMsIGNyZWF0ZUNhbnZhc0Zyb21EYXRhLCBpbml0aWFsaXplQ2FudmFzfSBmcm9tICcuLi9oZWxwZXJzJztcclxuaW1wb3J0IHtQc2R9IGZyb20gJy4uL3BzZCc7XHJcbmltcG9ydCB7Z2V0TWFza2VkTGF5ZXJTaXplfSBmcm9tICcuLi9pbmRleCc7XHJcbmltcG9ydCB7cmVhZFBzZEZyb21GaWxlfSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuXHJcbmNvbnN0IHBzZEZpbGVUb1Rlc3QgPSAnLi90ZXN0LW1hbnVhbC9tYXNrZWRfbGF5ZXJfc2l6ZV8yLnBzZCc7XHJcbmluaXRpYWxpemVDYW52YXMoY3JlYXRlQ2FudmFzLCBjcmVhdGVDYW52YXNGcm9tRGF0YSk7XHJcblxyXG5kZXNjcmliZSgnV2hlbiBnZXR0aW5nIHRoZSBzaXplIG9mIGEgbGF5ZXIgbWFzayB0aGF0IGV4dGVuZHMgdG8gdGhlIGxlZnQgb2YgdGhlIGJvcmRlcicsICgpID0+IHtcclxuXHRsZXQgcHNkOiBQc2Q7XHJcblx0YmVmb3JlRWFjaChhc3luYyAoKSA9PiB7XHJcblx0XHRwc2QgPSByZWFkUHNkRnJvbUZpbGUocHNkRmlsZVRvVGVzdCk7XHJcblx0fSk7XHJcblx0aXQoJ1Nob3VsZCBjcm9wIGxheWVyIHNpemUgY29ycmVjdGx5JywgYXN5bmMgKCkgPT4ge1xyXG5cdFx0Y29uc3QgbGF5ZXIgPSBwc2QuY2hpbGRyZW4hWzRdO1xyXG5cdFx0Y29uc3QgaW1hZ2VDb250ZW50ID0gYXdhaXQgKDxhbnk+bGF5ZXIpLmNhbnZhcy50b0J1ZmZlcigpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcclxuXHRcdFx0YHRlc3QxLnBuZ2AsXHJcblx0XHRcdGltYWdlQ29udGVudCxcclxuXHRcdCk7XHJcblx0XHRjb25zdCBtYXNrQ29udGVudCA9IGF3YWl0ICg8YW55PmxheWVyKS5tYXNrLmNhbnZhcy50b0J1ZmZlcigpO1xyXG5cdFx0ZnMud3JpdGVGaWxlU3luYyhcclxuXHRcdFx0YHRlc3QxX21hc2sucG5nYCxcclxuXHRcdFx0bWFza0NvbnRlbnQsXHJcblx0XHQpO1xyXG5cdFx0Y29uc3QgbGF5ZXJTaXplID0gZ2V0TWFza2VkTGF5ZXJTaXplKHBzZC5jaGlsZHJlbiFbNF0sIDEwLCBwc2QpO1xyXG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkudG8uZXF1YWwoMTAwMCk7XHJcblx0XHRleHBlY3QocHNkLmhlaWdodCkudG8uZXF1YWwoMTAwMCk7XHJcblx0XHRleHBlY3QobGF5ZXJTaXplLmxlZnQpLnRvLmVxdWFsKDUwKTtcclxuXHRcdGV4cGVjdChsYXllclNpemUucmlnaHQpLnRvLmVxdWFsKDMxNyk7XHJcblx0XHRleHBlY3QobGF5ZXJTaXplLnRvcCkudG8uZXF1YWwoNjcwKTtcclxuXHRcdGV4cGVjdChsYXllclNpemUuYm90dG9tKS50by5lcXVhbCg5MTApO1xyXG5cdH0pO1xyXG59KTtcclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
