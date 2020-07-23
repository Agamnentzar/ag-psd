"use strict";
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
require("./common");
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var chai_1 = require("chai");
var engineData_1 = require("../engineData");
var common_1 = require("./common");
var testsPath = path.join(__dirname, '..', '..', 'test');
describe('engineData', function () {
    var dataBin = fs.readFileSync(path.join(testsPath, 'engineData.bin'));
    var dataJSON = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData.json'), 'utf8'));
    var dataBin2 = fs.readFileSync(path.join(testsPath, 'engineData2b.bin'));
    var dataJSON2 = JSON.parse(fs.readFileSync(path.join(testsPath, 'engineData2.json'), 'utf8'));
    it('parses engine data', function () {
        var result = engineData_1.parseEngineData(dataBin);
        chai_1.expect(result).eql(dataJSON);
    });
    it('parses engine data (2)', function () {
        var result = engineData_1.parseEngineData(dataBin2);
        fs.writeFileSync(path.join(__dirname, '..', '..', 'results', 'engineData2.json'), JSON.stringify(result, null, 2), 'utf8');
        chai_1.expect(result).eql(dataJSON2);
    });
    it('serializes engine data', function () {
        var result = engineData_1.serializeEngineData(dataJSON);
        common_1.expectBuffersEqual(result, dataBin, 'serialized.bin');
    });
    // TODO: floats encoded as integers in some fields (no way to use keys because they are all numeric)
    it('serializes engine data (2)', function () {
        var result = engineData_1.serializeEngineData(dataJSON2, true);
        common_1.expectBuffersEqual(result, dataBin2, 'serialized2.bin');
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvZW5naW5lRGF0YS5zcGVjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9CQUFrQjtBQUNsQixxQ0FBeUI7QUFDekIseUNBQTZCO0FBQzdCLDZCQUE4QjtBQUM5Qiw0Q0FBcUU7QUFDckUsbUNBQThDO0FBRTlDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFFM0QsUUFBUSxDQUFDLFlBQVksRUFBRTtJQUN0QixJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQUN4RSxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsaUJBQWlCLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzlGLElBQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBQzNFLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFaEcsRUFBRSxDQUFDLG9CQUFvQixFQUFFO1FBQ3hCLElBQU0sTUFBTSxHQUFHLDRCQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFeEMsYUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM5QixDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyx3QkFBd0IsRUFBRTtRQUM1QixJQUFNLE1BQU0sR0FBRyw0QkFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3pDLEVBQUUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsa0JBQWtCLENBQUMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFM0gsYUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMvQixDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyx3QkFBd0IsRUFBRTtRQUM1QixJQUFNLE1BQU0sR0FBRyxnQ0FBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUU3QywyQkFBa0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDdkQsQ0FBQyxDQUFDLENBQUM7SUFFSCxvR0FBb0c7SUFDcEcsRUFBRSxDQUFDLDRCQUE0QixFQUFFO1FBQ2hDLElBQU0sTUFBTSxHQUFHLGdDQUFtQixDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVwRCwyQkFBa0IsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDekQsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L2VuZ2luZURhdGEuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAnLi9jb21tb24nO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQgeyBwYXJzZUVuZ2luZURhdGEsIHNlcmlhbGl6ZUVuZ2luZURhdGEgfSBmcm9tICcuLi9lbmdpbmVEYXRhJztcclxuaW1wb3J0IHsgZXhwZWN0QnVmZmVyc0VxdWFsIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuY29uc3QgdGVzdHNQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uJywgJy4uJywgJ3Rlc3QnKTtcclxuXHJcbmRlc2NyaWJlKCdlbmdpbmVEYXRhJywgKCkgPT4ge1xyXG5cdGNvbnN0IGRhdGFCaW4gPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RzUGF0aCwgJ2VuZ2luZURhdGEuYmluJykpO1xyXG5cdGNvbnN0IGRhdGFKU09OID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKHRlc3RzUGF0aCwgJ2VuZ2luZURhdGEuanNvbicpLCAndXRmOCcpKTtcclxuXHRjb25zdCBkYXRhQmluMiA9IGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4odGVzdHNQYXRoLCAnZW5naW5lRGF0YTJiLmJpbicpKTtcclxuXHRjb25zdCBkYXRhSlNPTjIgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwYXRoLmpvaW4odGVzdHNQYXRoLCAnZW5naW5lRGF0YTIuanNvbicpLCAndXRmOCcpKTtcclxuXHJcblx0aXQoJ3BhcnNlcyBlbmdpbmUgZGF0YScsICgpID0+IHtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IHBhcnNlRW5naW5lRGF0YShkYXRhQmluKTtcclxuXHJcblx0XHRleHBlY3QocmVzdWx0KS5lcWwoZGF0YUpTT04pO1xyXG5cdH0pO1xyXG5cclxuXHRpdCgncGFyc2VzIGVuZ2luZSBkYXRhICgyKScsICgpID0+IHtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IHBhcnNlRW5naW5lRGF0YShkYXRhQmluMik7XHJcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihfX2Rpcm5hbWUsICcuLicsICcuLicsICdyZXN1bHRzJywgJ2VuZ2luZURhdGEyLmpzb24nKSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0LCBudWxsLCAyKSwgJ3V0ZjgnKTtcclxuXHJcblx0XHRleHBlY3QocmVzdWx0KS5lcWwoZGF0YUpTT04yKTtcclxuXHR9KTtcclxuXHJcblx0aXQoJ3NlcmlhbGl6ZXMgZW5naW5lIGRhdGEnLCAoKSA9PiB7XHJcblx0XHRjb25zdCByZXN1bHQgPSBzZXJpYWxpemVFbmdpbmVEYXRhKGRhdGFKU09OKTtcclxuXHJcblx0XHRleHBlY3RCdWZmZXJzRXF1YWwocmVzdWx0LCBkYXRhQmluLCAnc2VyaWFsaXplZC5iaW4nKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gVE9ETzogZmxvYXRzIGVuY29kZWQgYXMgaW50ZWdlcnMgaW4gc29tZSBmaWVsZHMgKG5vIHdheSB0byB1c2Uga2V5cyBiZWNhdXNlIHRoZXkgYXJlIGFsbCBudW1lcmljKVxyXG5cdGl0KCdzZXJpYWxpemVzIGVuZ2luZSBkYXRhICgyKScsICgpID0+IHtcclxuXHRcdGNvbnN0IHJlc3VsdCA9IHNlcmlhbGl6ZUVuZ2luZURhdGEoZGF0YUpTT04yLCB0cnVlKTtcclxuXHJcblx0XHRleHBlY3RCdWZmZXJzRXF1YWwocmVzdWx0LCBkYXRhQmluMiwgJ3NlcmlhbGl6ZWQyLmJpbicpO1xyXG5cdH0pO1xyXG59KTtcclxuIl0sInNvdXJjZVJvb3QiOiIvVXNlcnMvam9lcmFpaS9kZXYvYWctcHNkL3NyYyJ9
