"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var helpers_1 = require("../helpers");
var psdReader_1 = require("../psdReader");
var common_1 = require("./common");
function toData(data) {
    var result = [];
    for (var i = 0; i < data.length; i++) {
        result.push(data[i], data[i], data[i], data[i]);
    }
    return new Uint8Array(result);
}
function fromData(data) {
    var result = [];
    for (var i = 0; i < data.length; i += 4) {
        result.push(data[i]);
    }
    return result;
}
describe('helpers', function () {
    describe('writeDataRaw()', function () {
        it('returns undefined for 0 size', function () {
            (0, chai_1.expect)((0, helpers_1.writeDataRaw)({}, 0, 0, 0)).undefined;
            (0, chai_1.expect)((0, helpers_1.writeDataRaw)({}, 0, 0, 100)).undefined;
            (0, chai_1.expect)((0, helpers_1.writeDataRaw)({}, 0, 100, 0)).undefined;
        });
        it('writes data', function () {
            (0, helpers_1.writeDataRaw)({ data: new Uint8ClampedArray(16 * 16 * 4), width: 16, height: 16 }, 0, 16, 16);
        });
    });
    describe('writeDataRLE()', function () {
        it('returns undefined for 0 size', function () {
            (0, chai_1.expect)((0, helpers_1.writeDataRLE)(new Uint8Array(1), {}, 0, 0, [0], false)).undefined;
            (0, chai_1.expect)((0, helpers_1.writeDataRLE)(new Uint8Array(1), {}, 0, 100, [0], false)).undefined;
            (0, chai_1.expect)((0, helpers_1.writeDataRLE)(new Uint8Array(1), {}, 100, 0, [0], false)).undefined;
        });
        var rleTests = [
            { name: '1', width: 1, height: 1, data: [1] },
            { name: '1 1', width: 2, height: 1, data: [1, 1] },
            { name: '1 2', width: 2, height: 1, data: [1, 2] },
            { name: '3 x 1', width: 3, height: 1, data: [1, 1, 1] },
            { name: '1 2 3', width: 3, height: 1, data: [1, 2, 3] },
            { name: '1 1 1 3 2 1', width: 6, height: 1, data: [1, 1, 1, 3, 2, 1] },
            { name: '1 2 3 1 1 1', width: 6, height: 1, data: [1, 2, 3, 1, 1, 1] },
            { name: '1 1 1 1 1 0', width: 6, height: 1, data: [1, 1, 1, 1, 1, 0] },
            { name: '3x2 1 1 1 3 2 1', width: 3, height: 2, data: [1, 1, 1, 3, 2, 1] },
            { name: '3x2 1 2 3 1 1 1', width: 3, height: 2, data: [1, 2, 3, 1, 1, 1] },
            { name: '3x3 1 1 1 1 2 2 2 1 1', width: 3, height: 3, data: [1, 1, 1, 1, 2, 2, 2, 1, 1] },
            { name: '3x3 upper range', width: 3, height: 3, data: [255, 255, 255, 254, 254, 254, 1, 1, 0] },
            { name: '128 x 1', width: 128, height: 1, data: (0, common_1.repeat)(128, 1) },
            { name: '130 x 1', width: 130, height: 1, data: (0, common_1.repeat)(130, 1) },
            { name: '130 x 1 2', width: 130, height: 1, data: (0, common_1.repeat)(130 / 2, 1, 2) },
            { name: '150 x 1', width: 150, height: 1, data: (0, common_1.repeat)(150, 1) },
            { name: '100 x 1', width: 200, height: 1, data: (0, common_1.repeat)(200, 1) },
            { name: '300 x 1', width: 300, height: 1, data: (0, common_1.repeat)(300, 1) },
            { name: '500 x 1', width: 500, height: 1, data: (0, common_1.repeat)(500, 1) },
            { name: '100x5 only 1', width: 100, height: 5, data: (0, common_1.repeat)(5 * 100, 1) },
            {
                name: 'large list of 1s with some random numbers in it', width: 100, height: 5, data: __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], (0, common_1.repeat)(10, 1), true), [
                    3, 3, 3
                ], false), (0, common_1.repeat)(164, 1), true), [
                    3
                ], false), (0, common_1.repeat)(9, 1), true), [
                    5
                ], false), (0, common_1.repeat)(5, 1), true), [
                    3, 3, 3
                ], false), (0, common_1.repeat)(304, 1), true)
            },
            {
                name: 'smal batch in sea of 0s', width: 146, height: 1, data: __spreadArray(__spreadArray(__spreadArray([], (0, common_1.repeat)(50, 0), true), [
                    1, 13, 30, 42, 54, 64, 72, 77, 82, 86, 89, 90, 93, 94, 94, 95, 95, 95, 96, 96, 96, 96, 95, 95, 95, 94,
                    93, 92, 91, 89, 87, 84, 82, 80, 76, 72, 67, 62, 57, 49, 42, 34, 26, 19, 12, 5
                ], false), (0, common_1.repeat)(50, 0), true)
            },
            {
                name: 'from broken psd', width: 141, height: 1, data: [
                    237, 234, 233, 233, 233, 232, 233, 236, 238, 239, 239, 240, 241, 241, 238, 220, 217, 217, 215, 212,
                    205, 201, 203, 207, 208, 210, 218, 226, 234, 236, 236, 238, 240, 234, 228, 208, 180, 163, 178, 189,
                    205, 218, 219, 214, 214, 213, 205, 181, 171, 154, 132, 133, 163, 177, 179, 173, 76, 122, 168, 174,
                    143, 116, 117, 133, 181, 130, 172, 190, 159, 4, 0, 45, 179, 190, 177, 167, 18, 44, 110, 174, 212,
                    223, 229, 228, 213, 210, 170, 88, 200, 222, 210, 152, 152, 151, 190, 198, 210, 179, 183, 188, 189,
                    189, 187, 187, 186, 186, 184, 193, 213, 222, 229, 232, 231, 228, 229, 233, 237, 240, 240, 238, 236,
                    231, 226, 228, 230, 229, 222, 211, 201, 193, 189, 187, 186, 186, 186, 185, 184, 184, 186, 193, 198,
                ]
            },
            { name: '127 different + 3 repeated', width: 127 + 3, height: 1, data: __spreadArray(__spreadArray([], (0, common_1.range)(0, 127), true), [1, 1, 1], false) },
        ];
        rleTests.forEach(function (_a) {
            var width = _a.width, height = _a.height, data = _a.data, name = _a.name;
            it("correctly writes & reads RLE image (".concat(name, ")"), function () {
                if ((width * height) !== data.length) {
                    throw new Error("Invalid image data size ".concat(width * height, " !== ").concat(data.length));
                }
                var array;
                var result;
                try {
                    var input = { width: width, height: height, data: toData(data) };
                    var output = { width: width, height: height, data: new Uint8Array(width * height * 4) };
                    var buffer = new Uint8Array(16 * 1024 * 1024);
                    array = (0, helpers_1.writeDataRLE)(buffer, input, width, height, [0], false);
                    var reader = (0, psdReader_1.createReader)(array.buffer);
                    (0, psdReader_1.readDataRLE)(reader, output, width, height, 4, [0], false);
                    result = fromData(output.data);
                }
                catch (e) {
                    throw new Error("Error for image: [".concat(array, "] ").concat(e.stack));
                }
                (0, chai_1.expect)(result, "image: [".concat(array, "]")).eql(data);
            });
        });
    });
    describe('offsetForChannel()', function () {
        it('returns offset for other channelId', function () {
            (0, chai_1.expect)((0, helpers_1.offsetForChannel)(10, false)).equal(11);
        });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsQ0FBQyxTQUFTLENBQUM7UUFDbEYsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFNLFFBQVEsR0FBdUU7WUFDcEYsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUM3QyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNsRCxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNsRCxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDdkQsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3ZELEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUN0RSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDdEUsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3RFLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzFFLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQzFFLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3pGLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQy9GLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUEsZUFBTSxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNoRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFBLGVBQU0sRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDaEUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBQSxlQUFNLEVBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDekUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBQSxlQUFNLEVBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ2hFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUEsZUFBTSxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUNoRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFBLGVBQU0sRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDaEUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBQSxlQUFNLEVBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ2hFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUEsZUFBTSxFQUFDLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUU7WUFDekU7Z0JBQ0MsSUFBSSxFQUFFLGlEQUFpRCxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLG9JQUNoRixJQUFBLGVBQU0sRUFBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQzsyQkFBSyxJQUFBLGVBQU0sRUFBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO29CQUFFLENBQUM7MkJBQUssSUFBQSxlQUFNLEVBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFBRSxDQUFDOzJCQUFLLElBQUEsZUFBTSxFQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDOzJCQUFLLElBQUEsZUFBTSxFQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsT0FDaEg7YUFDRDtZQUNEO2dCQUNDLElBQUksRUFBRSx5QkFBeUIsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxnREFDeEQsSUFBQSxlQUFNLEVBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDaEIsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUU7b0JBQ3JHLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDOzJCQUMxRSxJQUFBLGVBQU0sRUFBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQ2hCO2FBQ0Q7WUFDRDtnQkFDQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRTtvQkFDckQsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7b0JBQ2xHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO29CQUNsRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztvQkFDakcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO29CQUNoRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztvQkFDakcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7b0JBQ2xHLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO2lCQUNsRzthQUNEO1lBQ0QsRUFBRSxJQUFJLEVBQUUsNEJBQTRCLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLGtDQUFNLElBQUEsY0FBSyxFQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsVUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBQyxFQUFFO1NBQ3BHLENBQUM7UUFFRixRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUMsRUFBNkI7Z0JBQTNCLEtBQUssV0FBQSxFQUFFLE1BQU0sWUFBQSxFQUFFLElBQUksVUFBQSxFQUFFLElBQUksVUFBQTtZQUM1QyxFQUFFLENBQUMsOENBQXVDLElBQUksTUFBRyxFQUFFO2dCQUNsRCxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLElBQUksQ0FBQyxNQUFNLEVBQUU7b0JBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQTJCLEtBQUssR0FBRyxNQUFNLGtCQUFRLElBQUksQ0FBQyxNQUFNLENBQUUsQ0FBQyxDQUFDO2lCQUNoRjtnQkFFRCxJQUFJLEtBQTZCLENBQUM7Z0JBQ2xDLElBQUksTUFBZ0IsQ0FBQztnQkFFckIsSUFBSTtvQkFDSCxJQUFNLEtBQUssR0FBYyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQzlFLElBQU0sTUFBTSxHQUFjLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLFVBQVUsQ0FBQyxLQUFLLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBRXJHLElBQU0sTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUM7b0JBQ2hELEtBQUssR0FBRyxJQUFBLHNCQUFZLEVBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFFLENBQUM7b0JBRWhFLElBQU0sTUFBTSxHQUFHLElBQUEsd0JBQVksRUFBQyxLQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzNDLElBQUEsdUJBQVcsRUFBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQzFELE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUMvQjtnQkFBQyxPQUFPLENBQUMsRUFBRTtvQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUFxQixLQUFLLGVBQVcsQ0FBRSxDQUFDLEtBQUssQ0FBRSxDQUFDLENBQUM7aUJBQ2pFO2dCQUVELElBQUEsYUFBTSxFQUFDLE1BQU0sRUFBRSxrQkFBVyxLQUFLLE1BQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMvQyxDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsb0JBQW9CLEVBQUU7UUFDOUIsRUFBRSxDQUFDLG9DQUFvQyxFQUFFO1lBQ3hDLElBQUEsYUFBTSxFQUFDLElBQUEsMEJBQWdCLEVBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L2hlbHBlcnMuc3BlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV4cGVjdCB9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQgeyB3cml0ZURhdGFSYXcsIG9mZnNldEZvckNoYW5uZWwsIFBpeGVsRGF0YSwgUGl4ZWxBcnJheSwgd3JpdGVEYXRhUkxFIH0gZnJvbSAnLi4vaGVscGVycyc7XHJcbmltcG9ydCB7IGNyZWF0ZVJlYWRlciwgcmVhZERhdGFSTEUgfSBmcm9tICcuLi9wc2RSZWFkZXInO1xyXG5pbXBvcnQgeyByYW5nZSwgcmVwZWF0IH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuZnVuY3Rpb24gdG9EYXRhKGRhdGE6IG51bWJlcltdKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcclxuXHRcdHJlc3VsdC5wdXNoKGRhdGFbaV0sIGRhdGFbaV0sIGRhdGFbaV0sIGRhdGFbaV0pO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIG5ldyBVaW50OEFycmF5KHJlc3VsdCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZyb21EYXRhKGRhdGE6IFBpeGVsQXJyYXkpIHtcclxuXHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkgKz0gNCkge1xyXG5cdFx0cmVzdWx0LnB1c2goZGF0YVtpXSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5kZXNjcmliZSgnaGVscGVycycsICgpID0+IHtcclxuXHRkZXNjcmliZSgnd3JpdGVEYXRhUmF3KCknLCAoKSA9PiB7XHJcblx0XHRpdCgncmV0dXJucyB1bmRlZmluZWQgZm9yIDAgc2l6ZScsICgpID0+IHtcclxuXHRcdFx0ZXhwZWN0KHdyaXRlRGF0YVJhdyh7fSBhcyBhbnksIDAsIDAsIDApKS51bmRlZmluZWQ7XHJcblx0XHRcdGV4cGVjdCh3cml0ZURhdGFSYXcoe30gYXMgYW55LCAwLCAwLCAxMDApKS51bmRlZmluZWQ7XHJcblx0XHRcdGV4cGVjdCh3cml0ZURhdGFSYXcoe30gYXMgYW55LCAwLCAxMDAsIDApKS51bmRlZmluZWQ7XHJcblx0XHR9KTtcclxuXHJcblx0XHRpdCgnd3JpdGVzIGRhdGEnLCAoKSA9PiB7XHJcblx0XHRcdHdyaXRlRGF0YVJhdyh7IGRhdGE6IG5ldyBVaW50OENsYW1wZWRBcnJheSgxNiAqIDE2ICogNCksIHdpZHRoOiAxNiwgaGVpZ2h0OiAxNiB9LCAwLCAxNiwgMTYpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdGRlc2NyaWJlKCd3cml0ZURhdGFSTEUoKScsICgpID0+IHtcclxuXHRcdGl0KCdyZXR1cm5zIHVuZGVmaW5lZCBmb3IgMCBzaXplJywgKCkgPT4ge1xyXG5cdFx0XHRleHBlY3Qod3JpdGVEYXRhUkxFKG5ldyBVaW50OEFycmF5KDEpLCB7fSBhcyBhbnksIDAsIDAsIFswXSwgZmFsc2UpKS51bmRlZmluZWQ7XHJcblx0XHRcdGV4cGVjdCh3cml0ZURhdGFSTEUobmV3IFVpbnQ4QXJyYXkoMSksIHt9IGFzIGFueSwgMCwgMTAwLCBbMF0sIGZhbHNlKSkudW5kZWZpbmVkO1xyXG5cdFx0XHRleHBlY3Qod3JpdGVEYXRhUkxFKG5ldyBVaW50OEFycmF5KDEpLCB7fSBhcyBhbnksIDEwMCwgMCwgWzBdLCBmYWxzZSkpLnVuZGVmaW5lZDtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGNvbnN0IHJsZVRlc3RzOiB7IG5hbWU6IHN0cmluZzsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IGRhdGE6IG51bWJlcltdOyB9W10gPSBbXHJcblx0XHRcdHsgbmFtZTogJzEnLCB3aWR0aDogMSwgaGVpZ2h0OiAxLCBkYXRhOiBbMV0gfSxcclxuXHRcdFx0eyBuYW1lOiAnMSAxJywgd2lkdGg6IDIsIGhlaWdodDogMSwgZGF0YTogWzEsIDFdIH0sXHJcblx0XHRcdHsgbmFtZTogJzEgMicsIHdpZHRoOiAyLCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAyXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICczIHggMScsIHdpZHRoOiAzLCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAxLCAxXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICcxIDIgMycsIHdpZHRoOiAzLCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAyLCAzXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICcxIDEgMSAzIDIgMScsIHdpZHRoOiA2LCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAxLCAxLCAzLCAyLCAxXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICcxIDIgMyAxIDEgMScsIHdpZHRoOiA2LCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAyLCAzLCAxLCAxLCAxXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICcxIDEgMSAxIDEgMCcsIHdpZHRoOiA2LCBoZWlnaHQ6IDEsIGRhdGE6IFsxLCAxLCAxLCAxLCAxLCAwXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICczeDIgMSAxIDEgMyAyIDEnLCB3aWR0aDogMywgaGVpZ2h0OiAyLCBkYXRhOiBbMSwgMSwgMSwgMywgMiwgMV0gfSxcclxuXHRcdFx0eyBuYW1lOiAnM3gyIDEgMiAzIDEgMSAxJywgd2lkdGg6IDMsIGhlaWdodDogMiwgZGF0YTogWzEsIDIsIDMsIDEsIDEsIDFdIH0sXHJcblx0XHRcdHsgbmFtZTogJzN4MyAxIDEgMSAxIDIgMiAyIDEgMScsIHdpZHRoOiAzLCBoZWlnaHQ6IDMsIGRhdGE6IFsxLCAxLCAxLCAxLCAyLCAyLCAyLCAxLCAxXSB9LFxyXG5cdFx0XHR7IG5hbWU6ICczeDMgdXBwZXIgcmFuZ2UnLCB3aWR0aDogMywgaGVpZ2h0OiAzLCBkYXRhOiBbMjU1LCAyNTUsIDI1NSwgMjU0LCAyNTQsIDI1NCwgMSwgMSwgMF0gfSxcclxuXHRcdFx0eyBuYW1lOiAnMTI4IHggMScsIHdpZHRoOiAxMjgsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDEyOCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnMTMwIHggMScsIHdpZHRoOiAxMzAsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDEzMCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnMTMwIHggMSAyJywgd2lkdGg6IDEzMCwgaGVpZ2h0OiAxLCBkYXRhOiByZXBlYXQoMTMwIC8gMiwgMSwgMikgfSxcclxuXHRcdFx0eyBuYW1lOiAnMTUwIHggMScsIHdpZHRoOiAxNTAsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDE1MCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnMTAwIHggMScsIHdpZHRoOiAyMDAsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDIwMCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnMzAwIHggMScsIHdpZHRoOiAzMDAsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDMwMCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnNTAwIHggMScsIHdpZHRoOiA1MDAsIGhlaWdodDogMSwgZGF0YTogcmVwZWF0KDUwMCwgMSkgfSxcclxuXHRcdFx0eyBuYW1lOiAnMTAweDUgb25seSAxJywgd2lkdGg6IDEwMCwgaGVpZ2h0OiA1LCBkYXRhOiByZXBlYXQoNSAqIDEwMCwgMSkgfSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdsYXJnZSBsaXN0IG9mIDFzIHdpdGggc29tZSByYW5kb20gbnVtYmVycyBpbiBpdCcsIHdpZHRoOiAxMDAsIGhlaWdodDogNSwgZGF0YTogW1xyXG5cdFx0XHRcdFx0Li4ucmVwZWF0KDEwLCAxKSwgMywgMywgMywgLi4ucmVwZWF0KDE2NCwgMSksIDMsIC4uLnJlcGVhdCg5LCAxKSwgNSwgLi4ucmVwZWF0KDUsIDEpLCAzLCAzLCAzLCAuLi5yZXBlYXQoMzA0LCAxKVxyXG5cdFx0XHRcdF1cclxuXHRcdFx0fSxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdG5hbWU6ICdzbWFsIGJhdGNoIGluIHNlYSBvZiAwcycsIHdpZHRoOiAxNDYsIGhlaWdodDogMSwgZGF0YTogW1xyXG5cdFx0XHRcdFx0Li4ucmVwZWF0KDUwLCAwKSxcclxuXHRcdFx0XHRcdDEsIDEzLCAzMCwgNDIsIDU0LCA2NCwgNzIsIDc3LCA4MiwgODYsIDg5LCA5MCwgOTMsIDk0LCA5NCwgOTUsIDk1LCA5NSwgOTYsIDk2LCA5NiwgOTYsIDk1LCA5NSwgOTUsIDk0LFxyXG5cdFx0XHRcdFx0OTMsIDkyLCA5MSwgODksIDg3LCA4NCwgODIsIDgwLCA3NiwgNzIsIDY3LCA2MiwgNTcsIDQ5LCA0MiwgMzQsIDI2LCAxOSwgMTIsIDUsXHJcblx0XHRcdFx0XHQuLi5yZXBlYXQoNTAsIDApXHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bmFtZTogJ2Zyb20gYnJva2VuIHBzZCcsIHdpZHRoOiAxNDEsIGhlaWdodDogMSwgZGF0YTogW1xyXG5cdFx0XHRcdFx0MjM3LCAyMzQsIDIzMywgMjMzLCAyMzMsIDIzMiwgMjMzLCAyMzYsIDIzOCwgMjM5LCAyMzksIDI0MCwgMjQxLCAyNDEsIDIzOCwgMjIwLCAyMTcsIDIxNywgMjE1LCAyMTIsXHJcblx0XHRcdFx0XHQyMDUsIDIwMSwgMjAzLCAyMDcsIDIwOCwgMjEwLCAyMTgsIDIyNiwgMjM0LCAyMzYsIDIzNiwgMjM4LCAyNDAsIDIzNCwgMjI4LCAyMDgsIDE4MCwgMTYzLCAxNzgsIDE4OSxcclxuXHRcdFx0XHRcdDIwNSwgMjE4LCAyMTksIDIxNCwgMjE0LCAyMTMsIDIwNSwgMTgxLCAxNzEsIDE1NCwgMTMyLCAxMzMsIDE2MywgMTc3LCAxNzksIDE3MywgNzYsIDEyMiwgMTY4LCAxNzQsXHJcblx0XHRcdFx0XHQxNDMsIDExNiwgMTE3LCAxMzMsIDE4MSwgMTMwLCAxNzIsIDE5MCwgMTU5LCA0LCAwLCA0NSwgMTc5LCAxOTAsIDE3NywgMTY3LCAxOCwgNDQsIDExMCwgMTc0LCAyMTIsXHJcblx0XHRcdFx0XHQyMjMsIDIyOSwgMjI4LCAyMTMsIDIxMCwgMTcwLCA4OCwgMjAwLCAyMjIsIDIxMCwgMTUyLCAxNTIsIDE1MSwgMTkwLCAxOTgsIDIxMCwgMTc5LCAxODMsIDE4OCwgMTg5LFxyXG5cdFx0XHRcdFx0MTg5LCAxODcsIDE4NywgMTg2LCAxODYsIDE4NCwgMTkzLCAyMTMsIDIyMiwgMjI5LCAyMzIsIDIzMSwgMjI4LCAyMjksIDIzMywgMjM3LCAyNDAsIDI0MCwgMjM4LCAyMzYsXHJcblx0XHRcdFx0XHQyMzEsIDIyNiwgMjI4LCAyMzAsIDIyOSwgMjIyLCAyMTEsIDIwMSwgMTkzLCAxODksIDE4NywgMTg2LCAxODYsIDE4NiwgMTg1LCAxODQsIDE4NCwgMTg2LCAxOTMsIDE5OCxcclxuXHRcdFx0XHRdXHJcblx0XHRcdH0sXHJcblx0XHRcdHsgbmFtZTogJzEyNyBkaWZmZXJlbnQgKyAzIHJlcGVhdGVkJywgd2lkdGg6IDEyNyArIDMsIGhlaWdodDogMSwgZGF0YTogWy4uLnJhbmdlKDAsIDEyNyksIDEsIDEsIDFdIH0sXHJcblx0XHRdO1xyXG5cclxuXHRcdHJsZVRlc3RzLmZvckVhY2goKHsgd2lkdGgsIGhlaWdodCwgZGF0YSwgbmFtZSB9KSA9PiB7XHJcblx0XHRcdGl0KGBjb3JyZWN0bHkgd3JpdGVzICYgcmVhZHMgUkxFIGltYWdlICgke25hbWV9KWAsICgpID0+IHtcclxuXHRcdFx0XHRpZiAoKHdpZHRoICogaGVpZ2h0KSAhPT0gZGF0YS5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpbWFnZSBkYXRhIHNpemUgJHt3aWR0aCAqIGhlaWdodH0gIT09ICR7ZGF0YS5sZW5ndGh9YCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRsZXQgYXJyYXk6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQ7XHJcblx0XHRcdFx0bGV0IHJlc3VsdDogbnVtYmVyW107XHJcblxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRjb25zdCBpbnB1dDogUGl4ZWxEYXRhID0geyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0LCBkYXRhOiB0b0RhdGEoZGF0YSkgfTtcclxuXHRcdFx0XHRcdGNvbnN0IG91dHB1dDogUGl4ZWxEYXRhID0geyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0LCBkYXRhOiBuZXcgVWludDhBcnJheSh3aWR0aCAqIGhlaWdodCAqIDQpIH07XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMTYgKiAxMDI0ICogMTAyNCk7XHJcblx0XHRcdFx0XHRhcnJheSA9IHdyaXRlRGF0YVJMRShidWZmZXIsIGlucHV0LCB3aWR0aCwgaGVpZ2h0LCBbMF0sIGZhbHNlKSE7XHJcblxyXG5cdFx0XHRcdFx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGFycmF5IS5idWZmZXIpO1xyXG5cdFx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCBvdXRwdXQsIHdpZHRoLCBoZWlnaHQsIDQsIFswXSwgZmFsc2UpO1xyXG5cdFx0XHRcdFx0cmVzdWx0ID0gZnJvbURhdGEob3V0cHV0LmRhdGEpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgRXJyb3IgZm9yIGltYWdlOiBbJHthcnJheX1dICR7KDxhbnk+ZSkuc3RhY2t9YCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRleHBlY3QocmVzdWx0LCBgaW1hZ2U6IFske2FycmF5fV1gKS5lcWwoZGF0YSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcblxyXG5cdGRlc2NyaWJlKCdvZmZzZXRGb3JDaGFubmVsKCknLCAoKSA9PiB7XHJcblx0XHRpdCgncmV0dXJucyBvZmZzZXQgZm9yIG90aGVyIGNoYW5uZWxJZCcsICgpID0+IHtcclxuXHRcdFx0ZXhwZWN0KG9mZnNldEZvckNoYW5uZWwoMTAsIGZhbHNlKSkuZXF1YWwoMTEpO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn0pO1xyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==