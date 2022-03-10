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
var common_1 = require("./common");
var path = require("path");
var BoundingBoxScanner_1 = require("../BoundingBoxScanner");
var chai_1 = require("chai");
var testFilesPath = path.join(__dirname, '..', '..', 'test');
var readFilesPath = path.join(testFilesPath, 'read');
var opts = {
    throwForMissingFeatures: true,
    logMissingFeatures: true,
};
describe('BoundingBoxScan', function () {
    var psd = (0, common_1.readPsdFromFile)(path.join(readFilesPath, 'bounding-box-scan', 'src.psd'), __assign({}, opts));
    it('reads width and height properly', function () {
        (0, chai_1.expect)(psd.width).equal(300);
        (0, chai_1.expect)(psd.height).equal(432);
    });
    it('scans bounding transparency of a layer correctly', function () {
        var boundingBoxScan = new BoundingBoxScanner_1.BoundingBoxScan();
        var boundingBox = boundingBoxScan.scanLayerTransparency(psd.children[0]);
        console.log('######################################');
        console.log(boundingBox);
        (0, chai_1.expect)(boundingBox).to.be.exist;
        (0, chai_1.expect)(boundingBox.left).to.equal(88);
        (0, chai_1.expect)(boundingBox.right).to.equal(211);
        (0, chai_1.expect)(boundingBox.top).to.equal(92);
        (0, chai_1.expect)(boundingBox.bottom).to.equal(239);
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvYm91bmRpbmdCb3hTY2FuLnNwZWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQUFBLG1DQUF5QztBQUN6QywyQkFBNkI7QUFFN0IsNERBQW9FO0FBQ3BFLDZCQUE4QjtBQUU5QixJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQy9ELElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZELElBQU0sSUFBSSxHQUFnQjtJQUN6Qix1QkFBdUIsRUFBRSxJQUFJO0lBQzdCLGtCQUFrQixFQUFFLElBQUk7Q0FDeEIsQ0FBQztBQUVGLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRTtJQUMzQixJQUFNLEdBQUcsR0FBUSxJQUFBLHdCQUFlLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsbUJBQW1CLEVBQUUsU0FBUyxDQUFDLGVBQU0sSUFBSSxFQUFFLENBQUM7SUFDdEcsRUFBRSxDQUFDLGlDQUFpQyxFQUFFO1FBQ3JDLElBQUEsYUFBTSxFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0IsSUFBQSxhQUFNLEVBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztJQUNILEVBQUUsQ0FBQyxrREFBa0QsRUFBRTtRQUN0RCxJQUFNLGVBQWUsR0FBb0IsSUFBSSxvQ0FBZSxFQUFFLENBQUM7UUFDL0QsSUFBTSxXQUFXLEdBQWlCLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBTyxHQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFpQixDQUFDO1FBQ2hILE9BQU8sQ0FBQyxHQUFHLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUN0RCxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3pCLElBQUEsYUFBTSxFQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDO1FBQ2hDLElBQUEsYUFBTSxFQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLElBQUEsYUFBTSxFQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLElBQUEsYUFBTSxFQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3JDLElBQUEsYUFBTSxFQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoidGVzdC9ib3VuZGluZ0JveFNjYW4uc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7cmVhZFBzZEZyb21GaWxlfSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7UHNkLCBSZWFkT3B0aW9uc30gZnJvbSAnLi4vcHNkJztcclxuaW1wb3J0IHtCb3VuZGluZ0JveFNjYW4sIElCb3VuZGluZ0JveH0gZnJvbSAnLi4vQm91bmRpbmdCb3hTY2FubmVyJztcclxuaW1wb3J0IHsgZXhwZWN0IH0gZnJvbSAnY2hhaSc7XHJcblxyXG5jb25zdCB0ZXN0RmlsZXNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Rlc3QnKTtcclxuY29uc3QgcmVhZEZpbGVzUGF0aCA9IHBhdGguam9pbih0ZXN0RmlsZXNQYXRoLCAncmVhZCcpO1xyXG5jb25zdCBvcHRzOiBSZWFkT3B0aW9ucyA9IHtcclxuXHR0aHJvd0Zvck1pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxuXHRsb2dNaXNzaW5nRmVhdHVyZXM6IHRydWUsXHJcbn07XHJcblxyXG5kZXNjcmliZSgnQm91bmRpbmdCb3hTY2FuJywgKCkgPT4ge1xyXG5cdGNvbnN0IHBzZDogUHNkID0gcmVhZFBzZEZyb21GaWxlKHBhdGguam9pbihyZWFkRmlsZXNQYXRoLCAnYm91bmRpbmctYm94LXNjYW4nLCAnc3JjLnBzZCcpLCB7Li4ub3B0c30pO1xyXG5cdGl0KCdyZWFkcyB3aWR0aCBhbmQgaGVpZ2h0IHByb3Blcmx5JywgKCkgPT4ge1xyXG5cdFx0ZXhwZWN0KHBzZC53aWR0aCkuZXF1YWwoMzAwKTtcclxuXHRcdGV4cGVjdChwc2QuaGVpZ2h0KS5lcXVhbCg0MzIpO1xyXG5cdH0pO1xyXG5cdGl0KCdzY2FucyBib3VuZGluZyB0cmFuc3BhcmVuY3kgb2YgYSBsYXllciBjb3JyZWN0bHknLCAoKSA9PiB7XHJcblx0XHRjb25zdCBib3VuZGluZ0JveFNjYW46IEJvdW5kaW5nQm94U2NhbiA9IG5ldyBCb3VuZGluZ0JveFNjYW4oKTtcclxuXHRcdGNvbnN0IGJvdW5kaW5nQm94OiBJQm91bmRpbmdCb3ggPSBib3VuZGluZ0JveFNjYW4uc2NhbkxheWVyVHJhbnNwYXJlbmN5KCg8YW55PnBzZCkuY2hpbGRyZW5bMF0pIGFzIElCb3VuZGluZ0JveDtcclxuXHRcdGNvbnNvbGUubG9nKCcjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIycpO1xyXG5cdFx0Y29uc29sZS5sb2coYm91bmRpbmdCb3gpO1xyXG5cdFx0ZXhwZWN0KGJvdW5kaW5nQm94KS50by5iZS5leGlzdDtcclxuXHRcdGV4cGVjdChib3VuZGluZ0JveC5sZWZ0KS50by5lcXVhbCg4OCk7XHJcblx0XHRleHBlY3QoYm91bmRpbmdCb3gucmlnaHQpLnRvLmVxdWFsKDIxMSk7XHJcblx0XHRleHBlY3QoYm91bmRpbmdCb3gudG9wKS50by5lcXVhbCg5Mik7XHJcblx0XHRleHBlY3QoYm91bmRpbmdCb3guYm90dG9tKS50by5lcXVhbCgyMzkpO1xyXG5cdH0pO1xyXG59KTtcclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
