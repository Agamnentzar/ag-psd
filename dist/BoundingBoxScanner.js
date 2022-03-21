"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundingBoxScan = void 0;
var helpers_1 = require("./helpers");
var BoundingBoxScan = /** @class */ (function () {
    function BoundingBoxScan() {
    }
    /**
     * Find the bounding box of the layer's transparency
     */
    BoundingBoxScan.prototype.scanLayerTransparency = function (layer) {
        var _a, _b, _c, _d, _e;
        var imageData = (_e = (_b = (_a = layer.canvas) === null || _a === void 0 ? void 0 : _a.getContext('2d')) === null || _b === void 0 ? void 0 : _b.getImageData(0, 0, (_c = layer.canvas) === null || _c === void 0 ? void 0 : _c.width, (_d = layer.canvas) === null || _d === void 0 ? void 0 : _d.height)) === null || _e === void 0 ? void 0 : _e.data.buffer;
        if (imageData && layer.canvas) {
            return this.scan(new Uint8ClampedArray(imageData), layer.canvas.width, layer.canvas.height);
        }
        else {
            return undefined;
        }
    };
    /**
     * Find the bounding box of the layer's channel
     */
    BoundingBoxScan.prototype.scanLayerChannel = function (layer, channel) {
        var _a, _b, _c, _d, _e;
        if (channel === void 0) { channel = BoundingBoxScan.SCAN_OFFSET_RED; }
        var imageData = (_e = (_b = (_a = layer.canvas) === null || _a === void 0 ? void 0 : _a.getContext('2d')) === null || _b === void 0 ? void 0 : _b.getImageData(0, 0, (_c = layer.canvas) === null || _c === void 0 ? void 0 : _c.width, (_d = layer.canvas) === null || _d === void 0 ? void 0 : _d.height)) === null || _e === void 0 ? void 0 : _e.data.buffer;
        if (imageData && layer.canvas) {
            return this.scan(new Uint8ClampedArray(imageData), layer.canvas.width, layer.canvas.height, channel);
        }
        else {
            return undefined;
        }
    };
    BoundingBoxScan.prototype.cropLayerToBoundingBox = function (layer) {
        var boundingBox = this.scanLayerTransparency(layer);
        if (boundingBox) {
            var width = boundingBox.right - boundingBox.left;
            var height = boundingBox.bottom - boundingBox.top;
            var newCanvas = (0, helpers_1.createCanvas)(width, height);
            var ctx = newCanvas.getContext('2d');
            ctx.drawImage(layer.canvas, boundingBox.left, boundingBox.top, width, height, 0, 0, width, height);
            layer.canvas = newCanvas;
            layer.top = boundingBox.top;
            layer.bottom = boundingBox.bottom;
            layer.left = boundingBox.left;
            layer.right = boundingBox.right;
            layer.imageData = ctx.getImageData(0, 0, width, height);
        }
    };
    /**
     * Scan the entire image for a rectangle in the set channel
     */
    BoundingBoxScan.prototype.scan = function (data, w, _h, scanOffset) {
        if (scanOffset === void 0) { scanOffset = BoundingBoxScan.SCAN_OFFSET_ALPHA; }
        if (scanOffset === void 0) {
            scanOffset = BoundingBoxScan.SCAN_OFFSET_ALPHA;
        }
        var l = data.length, i, bound = {
            top: undefined,
            left: undefined,
            right: undefined,
            bottom: undefined
        }, x, y;
        // Iterate over every pixel to find the highest
        // and where it ends on every axis ()
        for (i = 0; i < l; i += 4) {
            if (data[i + scanOffset] > 10) {
                x = (i / 4) % w;
                y = ~~((i / 4) / w);
                if (bound.top === undefined) {
                    bound.top = y;
                }
                if (bound.left === undefined) {
                    bound.left = x;
                }
                else if (x < bound.left) {
                    bound.left = x;
                }
                if (bound.right === undefined) {
                    bound.right = x;
                }
                else if (bound.right < x) {
                    bound.right = x;
                }
                if (bound.bottom === undefined) {
                    bound.bottom = y;
                }
                else if (bound.bottom < y) {
                    bound.bottom = y;
                }
            }
        }
        return bound;
    };
    BoundingBoxScan.SCAN_OFFSET_RED = 0;
    BoundingBoxScan.SCAN_OFFSET_GREEN = 1;
    BoundingBoxScan.SCAN_OFFSET_BLUE = 2;
    BoundingBoxScan.SCAN_OFFSET_ALPHA = 3;
    return BoundingBoxScan;
}());
exports.BoundingBoxScan = BoundingBoxScan;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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SyxTQUFTLEVBQUU7b0JBQzdCLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO2lCQUNmO3FCQUFNLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUU7b0JBQzFCLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO2lCQUNmO2dCQUNELElBQUksS0FBSyxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7b0JBQzlCLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2lCQUNoQjtxQkFBTSxJQUFJLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFO29CQUMzQixLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztpQkFDaEI7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtvQkFDL0IsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7aUJBQ2pCO3FCQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7b0JBQzVCLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2lCQUNqQjthQUNEO1NBQ0Q7UUFDRCxPQUFZLEtBQXFCLENBQUM7SUFDbkMsQ0FBQztJQTFGYSwrQkFBZSxHQUFXLENBQUMsQ0FBQztJQUM1QixpQ0FBaUIsR0FBVyxDQUFDLENBQUM7SUFDOUIsZ0NBQWdCLEdBQVcsQ0FBQyxDQUFDO0lBQzdCLGlDQUFpQixHQUFXLENBQUMsQ0FBQztJQXdGN0Msc0JBQUM7Q0E1RkQsQUE0RkMsSUFBQTtBQTVGWSwwQ0FBZSIsImZpbGUiOiJCb3VuZGluZ0JveFNjYW5uZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQSB0b29sIGZvciBmaW5kaW5nIHRoZSBib3VuZGluZyBib3ggYXJvdW5kIGEgc2V0IG9mIGNvbG9yZWQgcGl4ZWxzXHJcbiAqL1xyXG5pbXBvcnQge0xheWVyLCBMYXllck1hc2tEYXRhfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7Y3JlYXRlQ2FudmFzfSBmcm9tICcuL2hlbHBlcnMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJQm91bmRpbmdCb3gge1xyXG5cdGxlZnQ6IG51bWJlciB8IHVuZGVmaW5lZDtcclxuXHR0b3A6IG51bWJlciB8IHVuZGVmaW5lZDtcclxuXHRyaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkO1xyXG5cdGJvdHRvbTogbnVtYmVyIHwgdW5kZWZpbmVkO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQm91bmRpbmdCb3hTY2FuIHtcclxuXHRwdWJsaWMgc3RhdGljIFNDQU5fT0ZGU0VUX1JFRDogbnVtYmVyID0gMDtcclxuXHRwdWJsaWMgc3RhdGljIFNDQU5fT0ZGU0VUX0dSRUVOOiBudW1iZXIgPSAxO1xyXG5cdHB1YmxpYyBzdGF0aWMgU0NBTl9PRkZTRVRfQkxVRTogbnVtYmVyID0gMjtcclxuXHRwdWJsaWMgc3RhdGljIFNDQU5fT0ZGU0VUX0FMUEhBOiBudW1iZXIgPSAzO1xyXG5cclxuXHQvKipcclxuXHQgKiBGaW5kIHRoZSBib3VuZGluZyBib3ggb2YgdGhlIGxheWVyJ3MgdHJhbnNwYXJlbmN5XHJcblx0ICovXHJcblx0cHVibGljIHNjYW5MYXllclRyYW5zcGFyZW5jeShsYXllcjogTGF5ZXIgfCBMYXllck1hc2tEYXRhKTogSUJvdW5kaW5nQm94IHwgdW5kZWZpbmVkIHtcclxuXHRcdGNvbnN0IGltYWdlRGF0YSA9IGxheWVyLmNhbnZhcz8uZ2V0Q29udGV4dCgnMmQnKT8uZ2V0SW1hZ2VEYXRhKDAsIDAsIGxheWVyLmNhbnZhcz8ud2lkdGgsIGxheWVyLmNhbnZhcz8uaGVpZ2h0KT8uZGF0YS5idWZmZXI7XHJcblx0XHRpZiAoaW1hZ2VEYXRhICYmIGxheWVyLmNhbnZhcykge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5zY2FuKG5ldyBVaW50OENsYW1wZWRBcnJheShpbWFnZURhdGEpLCBsYXllci5jYW52YXMud2lkdGgsIGxheWVyLmNhbnZhcy5oZWlnaHQpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEZpbmQgdGhlIGJvdW5kaW5nIGJveCBvZiB0aGUgbGF5ZXIncyBjaGFubmVsXHJcblx0ICovXHJcblx0cHVibGljIHNjYW5MYXllckNoYW5uZWwobGF5ZXI6IExheWVyIHwgTGF5ZXJNYXNrRGF0YSwgY2hhbm5lbDogbnVtYmVyID0gQm91bmRpbmdCb3hTY2FuLlNDQU5fT0ZGU0VUX1JFRCk6IElCb3VuZGluZ0JveCB8IHVuZGVmaW5lZCB7XHJcblx0XHRjb25zdCBpbWFnZURhdGEgPSBsYXllci5jYW52YXM/LmdldENvbnRleHQoJzJkJyk/LmdldEltYWdlRGF0YSgwLCAwLCBsYXllci5jYW52YXM/LndpZHRoLCBsYXllci5jYW52YXM/LmhlaWdodCk/LmRhdGEuYnVmZmVyO1xyXG5cdFx0aWYgKGltYWdlRGF0YSAmJiBsYXllci5jYW52YXMpIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMuc2NhbihuZXcgVWludDhDbGFtcGVkQXJyYXkoaW1hZ2VEYXRhKSwgbGF5ZXIuY2FudmFzLndpZHRoLCBsYXllci5jYW52YXMuaGVpZ2h0LCBjaGFubmVsKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRwdWJsaWMgY3JvcExheWVyVG9Cb3VuZGluZ0JveChsYXllcjogTGF5ZXIpOiB2b2lkIHtcclxuXHRcdGNvbnN0IGJvdW5kaW5nQm94OiBJQm91bmRpbmdCb3ggfCB1bmRlZmluZWQgPSB0aGlzLnNjYW5MYXllclRyYW5zcGFyZW5jeShsYXllcik7XHJcblx0XHRpZiAoYm91bmRpbmdCb3gpIHtcclxuXHRcdFx0Y29uc3Qgd2lkdGg6IG51bWJlciA9IGJvdW5kaW5nQm94LnJpZ2h0ISAtIGJvdW5kaW5nQm94LmxlZnQhO1xyXG5cdFx0XHRjb25zdCBoZWlnaHQ6IG51bWJlciA9IGJvdW5kaW5nQm94LmJvdHRvbSEgLSBib3VuZGluZ0JveC50b3AhO1xyXG5cdFx0XHRjb25zdCBuZXdDYW52YXMgPSBjcmVhdGVDYW52YXMod2lkdGgsIGhlaWdodCk7XHJcblx0XHRcdGNvbnN0IGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEID0gbmV3Q2FudmFzLmdldENvbnRleHQoJzJkJykgYXMgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xyXG5cdFx0XHRjdHguZHJhd0ltYWdlKGxheWVyLmNhbnZhcyEsIGJvdW5kaW5nQm94LmxlZnQhLCBib3VuZGluZ0JveC50b3AhLCB3aWR0aCwgaGVpZ2h0LCAwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHRcdFx0bGF5ZXIuY2FudmFzID0gbmV3Q2FudmFzO1xyXG5cdFx0XHRsYXllci50b3AgPSBib3VuZGluZ0JveC50b3A7XHJcblx0XHRcdGxheWVyLmJvdHRvbSA9IGJvdW5kaW5nQm94LmJvdHRvbTtcclxuXHRcdFx0bGF5ZXIubGVmdCA9IGJvdW5kaW5nQm94LmxlZnQ7XHJcblx0XHRcdGxheWVyLnJpZ2h0ID0gYm91bmRpbmdCb3gucmlnaHQ7XHJcblx0XHRcdGxheWVyLmltYWdlRGF0YSA9IGN0eC5nZXRJbWFnZURhdGEoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTY2FuIHRoZSBlbnRpcmUgaW1hZ2UgZm9yIGEgcmVjdGFuZ2xlIGluIHRoZSBzZXQgY2hhbm5lbFxyXG5cdCAqL1xyXG5cdHB1YmxpYyBzY2FuKGRhdGE6IFVpbnQ4Q2xhbXBlZEFycmF5LCB3OiBudW1iZXIsIF9oOiBudW1iZXIsIHNjYW5PZmZzZXQ6IG51bWJlciA9IEJvdW5kaW5nQm94U2Nhbi5TQ0FOX09GRlNFVF9BTFBIQSk6IElCb3VuZGluZ0JveCB7XHJcblx0XHRpZiAoc2Nhbk9mZnNldCA9PT0gdm9pZCAwKSB7XHJcblx0XHRcdHNjYW5PZmZzZXQgPSBCb3VuZGluZ0JveFNjYW4uU0NBTl9PRkZTRVRfQUxQSEE7XHJcblx0XHR9XHJcblx0XHRsZXQgbCA9IGRhdGEubGVuZ3RoLFxyXG5cdFx0XHRpLFxyXG5cdFx0XHRib3VuZDogSUJvdW5kaW5nQm94ID0ge1xyXG5cdFx0XHRcdHRvcDogdW5kZWZpbmVkLFxyXG5cdFx0XHRcdGxlZnQ6IHVuZGVmaW5lZCxcclxuXHRcdFx0XHRyaWdodDogdW5kZWZpbmVkLFxyXG5cdFx0XHRcdGJvdHRvbTogdW5kZWZpbmVkXHJcblx0XHRcdH0sXHJcblx0XHRcdHgsIHk7XHJcblxyXG5cdFx0Ly8gSXRlcmF0ZSBvdmVyIGV2ZXJ5IHBpeGVsIHRvIGZpbmQgdGhlIGhpZ2hlc3RcclxuXHRcdC8vIGFuZCB3aGVyZSBpdCBlbmRzIG9uIGV2ZXJ5IGF4aXMgKClcclxuXHRcdGZvciAoaSA9IDA7IGkgPCBsOyBpICs9IDQpIHtcclxuXHRcdFx0aWYgKGRhdGFbaSArIHNjYW5PZmZzZXRdID4gMTApIHtcclxuXHRcdFx0XHR4ID0gKGkgLyA0KSAlIHc7XHJcblx0XHRcdFx0eSA9IH5+KChpIC8gNCkgLyB3KTtcclxuXHRcdFx0XHRpZiAoYm91bmQudG9wID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRcdGJvdW5kLnRvcCA9IHk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChib3VuZC5sZWZ0ID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0XHRcdGJvdW5kLmxlZnQgPSB4O1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoeCA8IGJvdW5kLmxlZnQpIHtcclxuXHRcdFx0XHRcdGJvdW5kLmxlZnQgPSB4O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoYm91bmQucmlnaHQgPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdFx0Ym91bmQucmlnaHQgPSB4O1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoYm91bmQucmlnaHQgPCB4KSB7XHJcblx0XHRcdFx0XHRib3VuZC5yaWdodCA9IHg7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmIChib3VuZC5ib3R0b20gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHRcdFx0Ym91bmQuYm90dG9tID0geTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKGJvdW5kLmJvdHRvbSA8IHkpIHtcclxuXHRcdFx0XHRcdGJvdW5kLmJvdHRvbSA9IHk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gPGFueT5ib3VuZCBhcyBJQm91bmRpbmdCb3g7XHJcblx0fVxyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
