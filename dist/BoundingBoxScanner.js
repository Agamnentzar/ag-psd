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
    BoundingBoxScan.prototype.scan = function (d, w, h, scanOffset) {
        if (scanOffset === void 0) { scanOffset = BoundingBoxScan.SCAN_OFFSET_ALPHA; }
        var x;
        var y;
        var ptr;
        var output = {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        for (x = 0; x < w; x += 1) {
            for (y = 0; y < h; y += 1) {
                ptr = (x + (y * w)) * 4;
                if (d[ptr + scanOffset] > 250) {
                    if (output.left === 0) {
                        output.left = x;
                    }
                    if (output.top === 0) {
                        output.top = y;
                    }
                    output.right = Math.max(output.right, x);
                    output.bottom = Math.max(output.bottom, y);
                }
            }
        }
        return output;
    };
    BoundingBoxScan.SCAN_OFFSET_RED = 0;
    BoundingBoxScan.SCAN_OFFSET_GREEN = 1;
    BoundingBoxScan.SCAN_OFFSET_BLUE = 2;
    BoundingBoxScan.SCAN_OFFSET_ALPHA = 3;
    return BoundingBoxScan;
}());
exports.BoundingBoxScan = BoundingBoxScan;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDMUIsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsR0FBRyxFQUFFO29CQUM5QixJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFO3dCQUN0QixNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztxQkFDaEI7b0JBQ0QsSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsRUFBRTt3QkFDckIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7cUJBQ2Y7b0JBQ0QsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQ3pDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUMzQzthQUNEO1NBQ0Q7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUEvRGEsK0JBQWUsR0FBVyxDQUFDLENBQUM7SUFDNUIsaUNBQWlCLEdBQVcsQ0FBQyxDQUFDO0lBQzlCLGdDQUFnQixHQUFXLENBQUMsQ0FBQztJQUM3QixpQ0FBaUIsR0FBVyxDQUFDLENBQUM7SUE4RDdDLHNCQUFDO0NBbEVELEFBa0VDLElBQUE7QUFsRVksMENBQWUiLCJmaWxlIjoiQm91bmRpbmdCb3hTY2FubmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEEgdG9vbCBmb3IgZmluZGluZyB0aGUgYm91bmRpbmcgYm94IGFyb3VuZCBhIHNldCBvZiBjb2xvcmVkIHBpeGVsc1xyXG4gKi9cclxuaW1wb3J0IHtMYXllciwgTGF5ZXJNYXNrRGF0YX0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge2NyZWF0ZUNhbnZhc30gZnJvbSAnLi9oZWxwZXJzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSUJvdW5kaW5nQm94IHtcclxuXHRsZWZ0OiBudW1iZXI7XHJcblx0dG9wOiBudW1iZXI7XHJcblx0cmlnaHQ6IG51bWJlcjtcclxuXHRib3R0b206IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEJvdW5kaW5nQm94U2NhbiB7XHJcblx0cHVibGljIHN0YXRpYyBTQ0FOX09GRlNFVF9SRUQ6IG51bWJlciA9IDA7XHJcblx0cHVibGljIHN0YXRpYyBTQ0FOX09GRlNFVF9HUkVFTjogbnVtYmVyID0gMTtcclxuXHRwdWJsaWMgc3RhdGljIFNDQU5fT0ZGU0VUX0JMVUU6IG51bWJlciA9IDI7XHJcblx0cHVibGljIHN0YXRpYyBTQ0FOX09GRlNFVF9BTFBIQTogbnVtYmVyID0gMztcclxuXHJcblx0LyoqXHJcblx0ICogRmluZCB0aGUgYm91bmRpbmcgYm94IG9mIHRoZSBsYXllcidzIHRyYW5zcGFyZW5jeVxyXG5cdCAqL1xyXG5cdHB1YmxpYyBzY2FuTGF5ZXJUcmFuc3BhcmVuY3kobGF5ZXI6IExheWVyIHwgTGF5ZXJNYXNrRGF0YSk6IElCb3VuZGluZ0JveCB8IHVuZGVmaW5lZCB7XHJcblx0XHRjb25zdCBpbWFnZURhdGEgPSBsYXllci5jYW52YXM/LmdldENvbnRleHQoJzJkJyk/LmdldEltYWdlRGF0YSgwLDAsbGF5ZXIuY2FudmFzPy53aWR0aCwgbGF5ZXIuY2FudmFzPy5oZWlnaHQpPy5kYXRhLmJ1ZmZlcjtcclxuXHRcdGlmIChpbWFnZURhdGEgJiYgbGF5ZXIuY2FudmFzKSB7XHJcblx0XHRcdHJldHVybiB0aGlzLnNjYW4obmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGltYWdlRGF0YSksIGxheWVyLmNhbnZhcy53aWR0aCwgbGF5ZXIuY2FudmFzLmhlaWdodCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cHVibGljIGNyb3BMYXllclRvQm91bmRpbmdCb3gobGF5ZXI6IExheWVyKTogdm9pZCB7XHJcblx0XHRjb25zdCBib3VuZGluZ0JveDogSUJvdW5kaW5nQm94IHwgdW5kZWZpbmVkID0gdGhpcy5zY2FuTGF5ZXJUcmFuc3BhcmVuY3kobGF5ZXIpO1xyXG5cdFx0aWYgKGJvdW5kaW5nQm94KSB7XHJcblx0XHRcdGNvbnN0IHdpZHRoOiBudW1iZXIgPSBib3VuZGluZ0JveC5yaWdodCAtIGJvdW5kaW5nQm94LmxlZnQ7XHJcblx0XHRcdGNvbnN0IGhlaWdodDogbnVtYmVyID0gYm91bmRpbmdCb3guYm90dG9tIC0gYm91bmRpbmdCb3gudG9wO1xyXG5cdFx0XHRjb25zdCBuZXdDYW52YXMgPSBjcmVhdGVDYW52YXMod2lkdGgsIGhlaWdodCk7XHJcblx0XHRcdGNvbnN0IGN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEID0gbmV3Q2FudmFzLmdldENvbnRleHQoJzJkJykgYXMgQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xyXG5cdFx0XHRjdHguZHJhd0ltYWdlKGxheWVyLmNhbnZhcyEsIGJvdW5kaW5nQm94LmxlZnQsIGJvdW5kaW5nQm94LnRvcCwgd2lkdGgsIGhlaWdodCwgMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcblx0XHRcdGxheWVyLmNhbnZhcyA9IG5ld0NhbnZhcztcclxuXHRcdFx0bGF5ZXIudG9wID0gYm91bmRpbmdCb3gudG9wO1xyXG5cdFx0XHRsYXllci5ib3R0b20gPSBib3VuZGluZ0JveC5ib3R0b207XHJcblx0XHRcdGxheWVyLmxlZnQgPSBib3VuZGluZ0JveC5sZWZ0O1xyXG5cdFx0XHRsYXllci5yaWdodCA9IGJvdW5kaW5nQm94LnJpZ2h0O1xyXG5cdFx0XHRsYXllci5pbWFnZURhdGEgPSBjdHguZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2NhbiB0aGUgZW50aXJlIGltYWdlIGZvciBhIHJlY3RhbmdsZSBpbiB0aGUgc2V0IGNoYW5uZWxcclxuXHQgKi9cclxuXHRwcml2YXRlIHNjYW4oZDogVWludDhDbGFtcGVkQXJyYXksIHc6IG51bWJlciwgaDogbnVtYmVyLCBzY2FuT2Zmc2V0OiBudW1iZXIgPSBCb3VuZGluZ0JveFNjYW4uU0NBTl9PRkZTRVRfQUxQSEEpOiBJQm91bmRpbmdCb3gge1xyXG5cdFx0bGV0IHg6IG51bWJlcjtcclxuXHRcdGxldCB5OiBudW1iZXI7XHJcblx0XHRsZXQgcHRyOiBudW1iZXI7XHJcblx0XHRjb25zdCBvdXRwdXQ6IElCb3VuZGluZ0JveCA9IHtcclxuXHRcdFx0bGVmdDogMCxcclxuXHRcdFx0dG9wOiAwLFxyXG5cdFx0XHRyaWdodDogMCxcclxuXHRcdFx0Ym90dG9tOiAwLFxyXG5cdFx0fTtcclxuXHRcdGZvciAoeCA9IDA7IHggPCB3OyB4ICs9IDEpIHtcclxuXHRcdFx0Zm9yICh5ID0gMDsgeSA8IGg7IHkgKz0gMSkge1xyXG5cdFx0XHRcdHB0ciA9ICh4ICsgKHkgKiB3KSkgKiA0O1xyXG5cdFx0XHRcdGlmIChkW3B0ciArIHNjYW5PZmZzZXRdID4gMjUwKSB7XHJcblx0XHRcdFx0XHRpZiAob3V0cHV0LmxlZnQgPT09IDApIHtcclxuXHRcdFx0XHRcdFx0b3V0cHV0LmxlZnQgPSB4O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKG91dHB1dC50b3AgPT09IDApIHtcclxuXHRcdFx0XHRcdFx0b3V0cHV0LnRvcCA9IHk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRvdXRwdXQucmlnaHQgPSBNYXRoLm1heChvdXRwdXQucmlnaHQsIHgpO1xyXG5cdFx0XHRcdFx0b3V0cHV0LmJvdHRvbSA9IE1hdGgubWF4KG91dHB1dC5ib3R0b20sIHkpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHR9XHJcblxyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
