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
import { readPsdFromFile } from './common';
import * as path from 'path';
import { BoundingBoxScan } from '../BoundingBoxScanner';
import { expect } from 'chai';
var testFilesPath = path.join(__dirname, '..', '..', 'test');
var readFilesPath = path.join(testFilesPath, 'read');
var opts = {
    throwForMissingFeatures: true,
    logMissingFeatures: true,
};
describe('BoundingBoxScan', function () {
    var psd = readPsdFromFile(path.join(readFilesPath, 'bounding-box-scan', 'src.psd'), __assign({}, opts));
    it('reads width and height properly', function () {
        expect(psd.width).equal(300);
        expect(psd.height).equal(432);
    });
    it('scans bounding transparency of a layer correctly', function () {
        var boundingBoxScan = new BoundingBoxScan();
        var boundingBox = boundingBoxScan.scanLayerTransparency(psd.children[0]);
        console.log('######################################');
        console.log(boundingBox);
        expect(boundingBox).to.be.exist;
        expect(boundingBox.left).to.equal(88);
        expect(boundingBox.right).to.equal(211);
        expect(boundingBox.top).to.equal(92);
        expect(boundingBox.bottom).to.equal(239);
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvYm91bmRpbmdCb3hTY2FuLnNwZWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQSxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0sVUFBVSxDQUFDO0FBQ3pDLE9BQU8sS0FBSyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBRTdCLE9BQU8sRUFBQyxlQUFlLEVBQWUsTUFBTSx1QkFBdUIsQ0FBQztBQUNwRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBRTlCLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDL0QsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDdkQsSUFBTSxJQUFJLEdBQWdCO0lBQ3pCLHVCQUF1QixFQUFFLElBQUk7SUFDN0Isa0JBQWtCLEVBQUUsSUFBSTtDQUN4QixDQUFDO0FBRUYsUUFBUSxDQUFDLGlCQUFpQixFQUFFO0lBQzNCLElBQU0sR0FBRyxHQUFRLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxTQUFTLENBQUMsZUFBTSxJQUFJLEVBQUUsQ0FBQztJQUN0RyxFQUFFLENBQUMsaUNBQWlDLEVBQUU7UUFDckMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0IsQ0FBQyxDQUFDLENBQUM7SUFDSCxFQUFFLENBQUMsa0RBQWtELEVBQUU7UUFDdEQsSUFBTSxlQUFlLEdBQW9CLElBQUksZUFBZSxFQUFFLENBQUM7UUFDL0QsSUFBTSxXQUFXLEdBQWlCLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBTyxHQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFpQixDQUFDO1FBQ2hILE9BQU8sQ0FBQyxHQUFHLENBQUMsd0NBQXdDLENBQUMsQ0FBQztRQUN0RCxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQztRQUNoQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L2JvdW5kaW5nQm94U2Nhbi5zcGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtyZWFkUHNkRnJvbUZpbGV9IGZyb20gJy4vY29tbW9uJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHtQc2QsIFJlYWRPcHRpb25zfSBmcm9tICcuLi9wc2QnO1xyXG5pbXBvcnQge0JvdW5kaW5nQm94U2NhbiwgSUJvdW5kaW5nQm94fSBmcm9tICcuLi9Cb3VuZGluZ0JveFNjYW5uZXInO1xyXG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tICdjaGFpJztcclxuXHJcbmNvbnN0IHRlc3RGaWxlc1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAndGVzdCcpO1xyXG5jb25zdCByZWFkRmlsZXNQYXRoID0gcGF0aC5qb2luKHRlc3RGaWxlc1BhdGgsICdyZWFkJyk7XHJcbmNvbnN0IG9wdHM6IFJlYWRPcHRpb25zID0ge1xyXG5cdHRocm93Rm9yTWlzc2luZ0ZlYXR1cmVzOiB0cnVlLFxyXG5cdGxvZ01pc3NpbmdGZWF0dXJlczogdHJ1ZSxcclxufTtcclxuXHJcbmRlc2NyaWJlKCdCb3VuZGluZ0JveFNjYW4nLCAoKSA9PiB7XHJcblx0Y29uc3QgcHNkOiBQc2QgPSByZWFkUHNkRnJvbUZpbGUocGF0aC5qb2luKHJlYWRGaWxlc1BhdGgsICdib3VuZGluZy1ib3gtc2NhbicsICdzcmMucHNkJyksIHsuLi5vcHRzfSk7XHJcblx0aXQoJ3JlYWRzIHdpZHRoIGFuZCBoZWlnaHQgcHJvcGVybHknLCAoKSA9PiB7XHJcblx0XHRleHBlY3QocHNkLndpZHRoKS5lcXVhbCgzMDApO1xyXG5cdFx0ZXhwZWN0KHBzZC5oZWlnaHQpLmVxdWFsKDQzMik7XHJcblx0fSk7XHJcblx0aXQoJ3NjYW5zIGJvdW5kaW5nIHRyYW5zcGFyZW5jeSBvZiBhIGxheWVyIGNvcnJlY3RseScsICgpID0+IHtcclxuXHRcdGNvbnN0IGJvdW5kaW5nQm94U2NhbjogQm91bmRpbmdCb3hTY2FuID0gbmV3IEJvdW5kaW5nQm94U2NhbigpO1xyXG5cdFx0Y29uc3QgYm91bmRpbmdCb3g6IElCb3VuZGluZ0JveCA9IGJvdW5kaW5nQm94U2Nhbi5zY2FuTGF5ZXJUcmFuc3BhcmVuY3koKDxhbnk+cHNkKS5jaGlsZHJlblswXSkgYXMgSUJvdW5kaW5nQm94O1xyXG5cdFx0Y29uc29sZS5sb2coJyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjJyk7XHJcblx0XHRjb25zb2xlLmxvZyhib3VuZGluZ0JveCk7XHJcblx0XHRleHBlY3QoYm91bmRpbmdCb3gpLnRvLmJlLmV4aXN0O1xyXG5cdFx0ZXhwZWN0KGJvdW5kaW5nQm94LmxlZnQpLnRvLmVxdWFsKDg4KTtcclxuXHRcdGV4cGVjdChib3VuZGluZ0JveC5yaWdodCkudG8uZXF1YWwoMjExKTtcclxuXHRcdGV4cGVjdChib3VuZGluZ0JveC50b3ApLnRvLmVxdWFsKDkyKTtcclxuXHRcdGV4cGVjdChib3VuZGluZ0JveC5ib3R0b20pLnRvLmVxdWFsKDIzOSk7XHJcblx0fSk7XHJcbn0pO1xyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
