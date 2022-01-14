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
exports.encodeEngineData = exports.decodeEngineData = void 0;
var defaultFont = {
    name: 'MyriadPro-Regular',
    script: 0,
    type: 0,
    synthetic: 0,
};
var defaultParagraphStyle = {
    justification: 'left',
    firstLineIndent: 0,
    startIndent: 0,
    endIndent: 0,
    spaceBefore: 0,
    spaceAfter: 0,
    autoHyphenate: true,
    hyphenatedWordSize: 6,
    preHyphen: 2,
    postHyphen: 2,
    consecutiveHyphens: 8,
    zone: 36,
    wordSpacing: [0.8, 1, 1.33],
    letterSpacing: [0, 0, 0],
    glyphSpacing: [1, 1, 1],
    autoLeading: 1.2,
    leadingType: 0,
    hanging: false,
    burasagari: false,
    kinsokuOrder: 0,
    everyLineComposer: false,
};
var defaultStyle = {
    font: defaultFont,
    fontSize: 12,
    fauxBold: false,
    fauxItalic: false,
    autoLeading: true,
    leading: 0,
    horizontalScale: 1,
    verticalScale: 1,
    tracking: 0,
    autoKerning: true,
    kerning: 0,
    baselineShift: 0,
    fontCaps: 0,
    fontBaseline: 0,
    underline: false,
    strikethrough: false,
    ligatures: true,
    dLigatures: false,
    baselineDirection: 2,
    tsume: 0,
    styleRunAlignment: 2,
    language: 0,
    noBreak: false,
    fillColor: { r: 0, g: 0, b: 0 },
    strokeColor: { r: 0, g: 0, b: 0 },
    fillFlag: true,
    strokeFlag: false,
    fillFirst: true,
    yUnderline: 1,
    outlineWidth: 1,
    characterDirection: 0,
    hindiNumbers: false,
    kashida: 1,
    diacriticPos: 2,
};
var defaultGridInfo = {
    isOn: false,
    show: false,
    size: 18,
    leading: 22,
    color: { r: 0, g: 0, b: 255 },
    leadingFillColor: { r: 0, g: 0, b: 255 },
    alignLineHeightToGridFlags: false,
};
var paragraphStyleKeys = [
    'justification', 'firstLineIndent', 'startIndent', 'endIndent', 'spaceBefore', 'spaceAfter',
    'autoHyphenate', 'hyphenatedWordSize', 'preHyphen', 'postHyphen', 'consecutiveHyphens',
    'zone', 'wordSpacing', 'letterSpacing', 'glyphSpacing', 'autoLeading', 'leadingType',
    'hanging', 'burasagari', 'kinsokuOrder', 'everyLineComposer',
];
var styleKeys = [
    'font', 'fontSize', 'fauxBold', 'fauxItalic', 'autoLeading', 'leading', 'horizontalScale',
    'verticalScale', 'tracking', 'autoKerning', 'kerning', 'baselineShift', 'fontCaps', 'fontBaseline',
    'underline', 'strikethrough', 'ligatures', 'dLigatures', 'baselineDirection', 'tsume',
    'styleRunAlignment', 'language', 'noBreak', 'fillColor', 'strokeColor', 'fillFlag',
    'strokeFlag', 'fillFirst', 'yUnderline', 'outlineWidth', 'characterDirection', 'hindiNumbers',
    'kashida', 'diacriticPos',
];
var antialias = ['none', 'crisp', 'strong', 'smooth', 'sharp'];
var justification = ['left', 'right', 'center'];
function upperFirst(value) {
    return value.substr(0, 1).toUpperCase() + value.substr(1);
}
function decodeColor(color) {
    var c = color.Values;
    if (color.Type === 0) { // grayscale
        return { r: c[1] * 255, g: c[1] * 255, b: c[1] * 255 }; // , c[0] * 255];
    }
    else { // rgb
        return { r: c[1] * 255, g: c[2] * 255, b: c[3] * 255, a: c[0] }; // , c[0] * 255];
    }
}
function encodeColor(color) {
    if (color && 'r' in color) {
        return ['a' in color ? color.a : 1, color.r / 255, color.g / 255, color.b / 255];
    }
    else {
        return [0, 0, 0, 0];
    }
}
function arraysEqual(a, b) {
    if (!a || !b)
        return false;
    if (a.length !== b.length)
        return false;
    for (var i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
function objectsEqual(a, b) {
    if (!a || !b)
        return false;
    for (var _i = 0, _a = Object.keys(a); _i < _a.length; _i++) {
        var key = _a[_i];
        if (a[key] !== b[key])
            return false;
    }
    for (var _b = 0, _c = Object.keys(b); _b < _c.length; _b++) {
        var key = _c[_b];
        if (a[key] !== b[key])
            return false;
    }
    return true;
}
function findOrAddFont(fonts, font) {
    for (var i = 0; i < fonts.length; i++) {
        if (fonts[i].name === font.name)
            return i;
    }
    fonts.push(font);
    return fonts.length - 1;
}
function decodeObject(obj, keys, fonts) {
    var result = {};
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var Key = upperFirst(key);
        if (obj[Key] === undefined)
            continue;
        if (key === 'justification') {
            result[key] = justification[obj[Key]];
        }
        else if (key === 'font') {
            result[key] = fonts[obj[Key]];
        }
        else if (key === 'fillColor' || key === 'strokeColor') {
            result[key] = decodeColor(obj[Key]);
        }
        else {
            result[key] = obj[Key];
        }
    }
    return result;
}
function encodeObject(obj, keys, fonts) {
    var _a;
    var result = {};
    for (var _i = 0, keys_2 = keys; _i < keys_2.length; _i++) {
        var key = keys_2[_i];
        var Key = upperFirst(key);
        if (obj[key] === undefined)
            continue;
        if (key === 'justification') {
            result[Key] = justification.indexOf((_a = obj[key]) !== null && _a !== void 0 ? _a : 'left');
        }
        else if (key === 'font') {
            result[Key] = findOrAddFont(fonts, obj[key]);
        }
        else if (key === 'fillColor' || key === 'strokeColor') {
            result[Key] = { Type: 1, Values: encodeColor(obj[key]) };
        }
        else {
            result[Key] = obj[key];
        }
    }
    return result;
}
function decodeParagraphStyle(obj, fonts) {
    return decodeObject(obj, paragraphStyleKeys, fonts);
}
function decodeStyle(obj, fonts) {
    return decodeObject(obj, styleKeys, fonts);
}
function encodeParagraphStyle(obj, fonts) {
    return encodeObject(obj, paragraphStyleKeys, fonts);
}
function encodeStyle(obj, fonts) {
    return encodeObject(obj, styleKeys, fonts);
}
function deduplicateValues(base, runs, keys) {
    if (!runs.length)
        return;
    var _loop_1 = function (key) {
        var value = runs[0].style[key];
        if (value !== undefined) {
            var identical = false;
            if (Array.isArray(value)) {
                identical = runs.every(function (r) { return arraysEqual(r.style[key], value); });
            }
            else if (typeof value === 'object') {
                identical = runs.every(function (r) { return objectsEqual(r.style[key], value); });
            }
            else {
                identical = runs.every(function (r) { return r.style[key] === value; });
            }
            if (identical) {
                base[key] = value;
            }
        }
        var styleValue = base[key];
        if (styleValue !== undefined) {
            for (var _a = 0, runs_1 = runs; _a < runs_1.length; _a++) {
                var r = runs_1[_a];
                var same = false;
                if (Array.isArray(value)) {
                    same = arraysEqual(r.style[key], value);
                }
                else if (typeof value === 'object') {
                    same = objectsEqual(r.style[key], value);
                }
                else {
                    same = r.style[key] === value;
                }
                if (same)
                    delete r.style[key];
            }
        }
    };
    for (var _i = 0, keys_3 = keys; _i < keys_3.length; _i++) {
        var key = keys_3[_i];
        _loop_1(key);
    }
    if (runs.every(function (x) { return Object.keys(x.style).length === 0; })) {
        runs.length = 0;
    }
}
function decodeEngineData(engineData) {
    var _a, _b, _c, _d, _e, _f;
    // console.log('engineData', require('util').inspect(engineData, false, 99, true));
    var engineDict = engineData.EngineDict;
    var resourceDict = engineData.ResourceDict;
    var fonts = resourceDict.FontSet.map(function (f) { return ({
        name: f.Name,
        script: f.Script,
        type: f.FontType,
        synthetic: f.Synthetic,
    }); });
    var text = engineDict.Editor.Text.replace(/\r/g, '\n');
    var removedCharacters = 0;
    while (/\n$/.test(text)) {
        text = text.substr(0, text.length - 1);
        removedCharacters++;
    }
    var result = {
        text: text,
        antiAlias: (_a = antialias[engineDict.AntiAlias]) !== null && _a !== void 0 ? _a : 'smooth',
        useFractionalGlyphWidths: !!engineDict.UseFractionalGlyphWidths,
        superscriptSize: resourceDict.SuperscriptSize,
        superscriptPosition: resourceDict.SuperscriptPosition,
        subscriptSize: resourceDict.SubscriptSize,
        subscriptPosition: resourceDict.SubscriptPosition,
        smallCapSize: resourceDict.SmallCapSize,
    };
    // shape
    var photoshop = (_f = (_e = (_d = (_c = (_b = engineDict.Rendered) === null || _b === void 0 ? void 0 : _b.Shapes) === null || _c === void 0 ? void 0 : _c.Children) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.Cookie) === null || _f === void 0 ? void 0 : _f.Photoshop;
    if (photoshop) {
        result.shapeType = photoshop.ShapeType === 1 ? 'box' : 'point';
        if (photoshop.PointBase)
            result.pointBase = photoshop.PointBase;
        if (photoshop.BoxBounds)
            result.boxBounds = photoshop.BoxBounds;
    }
    // paragraph style
    // const theNormalParagraphSheet = resourceDict.TheNormalParagraphSheet;
    // const paragraphSheetSet = resourceDict.ParagraphSheetSet;
    // const paragraphProperties = paragraphSheetSet[theNormalParagraphSheet].Properties;
    var paragraphRun = engineData.EngineDict.ParagraphRun;
    result.paragraphStyle = {}; // decodeParagraphStyle(paragraphProperties, fonts);
    result.paragraphStyleRuns = [];
    for (var i = 0; i < paragraphRun.RunArray.length; i++) {
        var run_1 = paragraphRun.RunArray[i];
        var length_1 = paragraphRun.RunLengthArray[i];
        var style = decodeParagraphStyle(run_1.ParagraphSheet.Properties, fonts);
        // const adjustments = {
        //   axis: run.Adjustments.Axis,
        //   xy: run.Adjustments.XY,
        // };
        result.paragraphStyleRuns.push({ length: length_1, style: style /*, adjustments*/ });
    }
    for (var counter = removedCharacters; result.paragraphStyleRuns.length && counter > 0; counter--) {
        if (--result.paragraphStyleRuns[result.paragraphStyleRuns.length - 1].length === 0) {
            result.paragraphStyleRuns.pop();
        }
    }
    deduplicateValues(result.paragraphStyle, result.paragraphStyleRuns, paragraphStyleKeys);
    if (!result.paragraphStyleRuns.length)
        delete result.paragraphStyleRuns;
    // style
    // const theNormalStyleSheet = resourceDict.TheNormalStyleSheet;
    // const styleSheetSet = resourceDict.StyleSheetSet;
    // const styleSheetData = styleSheetSet[theNormalStyleSheet].StyleSheetData;
    var styleRun = engineData.EngineDict.StyleRun;
    result.style = {}; // decodeStyle(styleSheetData, fonts);
    result.styleRuns = [];
    for (var i = 0; i < styleRun.RunArray.length; i++) {
        var length_2 = styleRun.RunLengthArray[i];
        var style = decodeStyle(styleRun.RunArray[i].StyleSheet.StyleSheetData, fonts);
        result.styleRuns.push({ length: length_2, style: style });
    }
    for (var counter = removedCharacters; result.styleRuns.length && counter > 0; counter--) {
        if (--result.styleRuns[result.styleRuns.length - 1].length === 0) {
            result.styleRuns.pop();
        }
    }
    deduplicateValues(result.style, result.styleRuns, styleKeys);
    if (!result.styleRuns.length)
        delete result.styleRuns;
    return result;
}
exports.decodeEngineData = decodeEngineData;
function encodeEngineData(data) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var text = (data.text || '').replace(/\r?\n/g, '\r') + "\r";
    var fonts = [
        { name: 'AdobeInvisFont', script: 0, type: 0, synthetic: 0 },
    ];
    var defFont = ((_a = data.style) === null || _a === void 0 ? void 0 : _a.font) || ((_c = (_b = data.styleRuns) === null || _b === void 0 ? void 0 : _b.find(function (s) { return s.style.font; })) === null || _c === void 0 ? void 0 : _c.style.font) || defaultFont;
    var paragraphRunArray = [];
    var paragraphRunLengthArray = [];
    var paragraphRuns = data.paragraphStyleRuns;
    if (paragraphRuns && paragraphRuns.length) {
        var leftLength_1 = text.length;
        for (var _i = 0, paragraphRuns_1 = paragraphRuns; _i < paragraphRuns_1.length; _i++) {
            var run_2 = paragraphRuns_1[_i];
            var runLength = Math.min(run_2.length, leftLength_1);
            leftLength_1 -= runLength;
            if (!runLength)
                continue; // ignore 0 size runs
            // extend last run if it's only for trailing \r
            if (leftLength_1 === 1 && run_2 === paragraphRuns[paragraphRuns.length - 1]) {
                runLength++;
                leftLength_1--;
            }
            paragraphRunLengthArray.push(runLength);
            paragraphRunArray.push({
                ParagraphSheet: {
                    DefaultStyleSheet: 0,
                    Properties: encodeParagraphStyle(__assign(__assign(__assign({}, defaultParagraphStyle), data.paragraphStyle), run_2.style), fonts),
                },
                Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
            });
        }
        if (leftLength_1) {
            paragraphRunLengthArray.push(leftLength_1);
            paragraphRunArray.push({
                ParagraphSheet: {
                    DefaultStyleSheet: 0,
                    Properties: encodeParagraphStyle(__assign(__assign({}, defaultParagraphStyle), data.paragraphStyle), fonts),
                },
                Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
            });
        }
    }
    else {
        for (var i = 0, last = 0; i < text.length; i++) {
            if (text.charCodeAt(i) === 13) { // \r
                paragraphRunLengthArray.push(i - last + 1);
                paragraphRunArray.push({
                    ParagraphSheet: {
                        DefaultStyleSheet: 0,
                        Properties: encodeParagraphStyle(__assign(__assign({}, defaultParagraphStyle), data.paragraphStyle), fonts),
                    },
                    Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
                });
                last = i + 1;
            }
        }
    }
    var styleSheetData = encodeStyle(__assign(__assign({}, defaultStyle), { font: defFont }), fonts);
    var styleRuns = data.styleRuns || [{ length: text.length, style: data.style || {} }];
    var styleRunArray = [];
    var styleRunLengthArray = [];
    var leftLength = text.length;
    for (var _o = 0, styleRuns_1 = styleRuns; _o < styleRuns_1.length; _o++) {
        var run_3 = styleRuns_1[_o];
        var runLength = Math.min(run_3.length, leftLength);
        leftLength -= runLength;
        if (!runLength)
            continue; // ignore 0 size runs
        // extend last run if it's only for trailing \r
        if (leftLength === 1 && run_3 === styleRuns[styleRuns.length - 1]) {
            runLength++;
            leftLength--;
        }
        styleRunLengthArray.push(runLength);
        styleRunArray.push({
            StyleSheet: {
                StyleSheetData: encodeStyle(__assign(__assign({ kerning: 0, autoKerning: true, fillColor: { r: 0, g: 0, b: 0 } }, data.style), run_3.style), fonts),
            },
        });
    }
    // add extra run to the end if existing ones didn't fill it up
    if (leftLength && styleRuns.length) {
        styleRunLengthArray.push(leftLength);
        styleRunArray.push({
            StyleSheet: {
                StyleSheetData: encodeStyle(__assign({ kerning: 0, autoKerning: true, fillColor: { r: 0, g: 0, b: 0 } }, data.style), fonts),
            },
        });
    }
    var gridInfo = __assign(__assign({}, defaultGridInfo), data.gridInfo);
    var WritingDirection = data.orientation === 'vertical' ? 2 : 0;
    var Procession = data.orientation === 'vertical' ? 1 : 0;
    var ShapeType = data.shapeType === 'box' ? 1 : 0;
    var Photoshop = {
        ShapeType: ShapeType,
    };
    if (ShapeType === 0) {
        Photoshop.PointBase = data.pointBase || [0, 0];
    }
    else {
        Photoshop.BoxBounds = data.boxBounds || [0, 0, 0, 0];
    }
    // needed for correct order of properties
    Photoshop.Base = {
        ShapeType: ShapeType,
        TransformPoint0: [1, 0],
        TransformPoint1: [0, 1],
        TransformPoint2: [0, 0],
    };
    var defaultResources = {
        KinsokuSet: [
            {
                Name: 'PhotoshopKinsokuHard',
                NoStart: '、。，．・：；？！ー―’”）〕］｝〉》」』】ヽヾゝゞ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ゛゜?!)]},.:;℃℉¢％‰',
                NoEnd: '‘“（〔［｛〈《「『【([{￥＄£＠§〒＃',
                Keep: '―‥',
                Hanging: '、。.,',
            },
            {
                Name: 'PhotoshopKinsokuSoft',
                NoStart: '、。，．・：；？！’”）〕］｝〉》」』】ヽヾゝゞ々',
                NoEnd: '‘“（〔［｛〈《「『【',
                Keep: '―‥',
                Hanging: '、。.,',
            },
        ],
        MojiKumiSet: [
            { InternalName: 'Photoshop6MojiKumiSet1' },
            { InternalName: 'Photoshop6MojiKumiSet2' },
            { InternalName: 'Photoshop6MojiKumiSet3' },
            { InternalName: 'Photoshop6MojiKumiSet4' },
        ],
        TheNormalStyleSheet: 0,
        TheNormalParagraphSheet: 0,
        ParagraphSheetSet: [
            {
                Name: 'Normal RGB',
                DefaultStyleSheet: 0,
                Properties: encodeParagraphStyle(__assign(__assign({}, defaultParagraphStyle), data.paragraphStyle), fonts),
            },
        ],
        StyleSheetSet: [
            {
                Name: 'Normal RGB',
                StyleSheetData: styleSheetData,
            },
        ],
        FontSet: fonts.map(function (f) { return ({
            Name: f.name,
            Script: f.script || 0,
            FontType: f.type || 0,
            Synthetic: f.synthetic || 0,
        }); }),
        SuperscriptSize: (_d = data.superscriptSize) !== null && _d !== void 0 ? _d : 0.583,
        SuperscriptPosition: (_e = data.superscriptPosition) !== null && _e !== void 0 ? _e : 0.333,
        SubscriptSize: (_f = data.subscriptSize) !== null && _f !== void 0 ? _f : 0.583,
        SubscriptPosition: (_g = data.subscriptPosition) !== null && _g !== void 0 ? _g : 0.333,
        SmallCapSize: (_h = data.smallCapSize) !== null && _h !== void 0 ? _h : 0.7,
    };
    var engineData = {
        EngineDict: {
            Editor: { Text: text },
            ParagraphRun: {
                DefaultRunData: {
                    ParagraphSheet: { DefaultStyleSheet: 0, Properties: {} },
                    Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
                },
                RunArray: paragraphRunArray,
                RunLengthArray: paragraphRunLengthArray,
                IsJoinable: 1,
            },
            StyleRun: {
                DefaultRunData: { StyleSheet: { StyleSheetData: {} } },
                RunArray: styleRunArray,
                RunLengthArray: styleRunLengthArray,
                IsJoinable: 2,
            },
            GridInfo: {
                GridIsOn: !!gridInfo.isOn,
                ShowGrid: !!gridInfo.show,
                GridSize: (_j = gridInfo.size) !== null && _j !== void 0 ? _j : 18,
                GridLeading: (_k = gridInfo.leading) !== null && _k !== void 0 ? _k : 22,
                GridColor: { Type: 1, Values: encodeColor(gridInfo.color) },
                GridLeadingFillColor: { Type: 1, Values: encodeColor(gridInfo.color) },
                AlignLineHeightToGridFlags: !!gridInfo.alignLineHeightToGridFlags,
            },
            AntiAlias: antialias.indexOf((_l = data.antiAlias) !== null && _l !== void 0 ? _l : 'sharp'),
            UseFractionalGlyphWidths: (_m = data.useFractionalGlyphWidths) !== null && _m !== void 0 ? _m : true,
            Rendered: {
                Version: 1,
                Shapes: {
                    WritingDirection: WritingDirection,
                    Children: [
                        {
                            ShapeType: ShapeType,
                            Procession: Procession,
                            Lines: { WritingDirection: WritingDirection, Children: [] },
                            Cookie: { Photoshop: Photoshop },
                        },
                    ],
                },
            },
        },
        ResourceDict: __assign({}, defaultResources),
        DocumentResources: __assign({}, defaultResources),
    };
    // console.log('encodeEngineData', require('util').inspect(engineData, false, 99, true));
    return engineData;
}
exports.encodeEngineData = encodeEngineData;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RSxNQUFNLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDM0Qsb0JBQW9CLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN0RSwwQkFBMEIsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLDBCQUEwQjthQUNqRTtZQUNELFNBQVMsRUFBRSxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQUEsSUFBSSxDQUFDLFNBQVMsbUNBQUksT0FBTyxDQUFDO1lBQ3ZELHdCQUF3QixFQUFFLE1BQUEsSUFBSSxDQUFDLHdCQUF3QixtQ0FBSSxJQUFJO1lBQy9ELFFBQVEsRUFBRTtnQkFDVCxPQUFPLEVBQUUsQ0FBQztnQkFDVixNQUFNLEVBQUU7b0JBQ1AsZ0JBQWdCLGtCQUFBO29CQUNoQixRQUFRLEVBQUU7d0JBQ1Q7NEJBQ0MsU0FBUyxXQUFBOzRCQUNULFVBQVUsWUFBQTs0QkFDVixLQUFLLEVBQUUsRUFBRSxnQkFBZ0Isa0JBQUEsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFOzRCQUN6QyxNQUFNLEVBQUUsRUFBRSxTQUFTLFdBQUEsRUFBRTt5QkFDckI7cUJBQ0Q7aUJBQ0Q7YUFDRDtTQUNEO1FBQ0QsWUFBWSxlQUFPLGdCQUFnQixDQUFFO1FBQ3JDLGlCQUFpQixlQUFPLGdCQUFnQixDQUFFO0tBQzFDLENBQUM7SUFFRix5RkFBeUY7SUFDekYsT0FBTyxVQUFVLENBQUM7QUFDbkIsQ0FBQztBQTFPRCw0Q0EwT0MiLCJmaWxlIjoidGV4dC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRleHRTdHlsZSwgTGF5ZXJUZXh0RGF0YSwgUGFyYWdyYXBoU3R5bGUsIEZvbnQsIEFudGlBbGlhcywgVGV4dEdyaWRJbmZvLCBKdXN0aWZpY2F0aW9uLCBDb2xvciB9IGZyb20gJy4vcHNkJztcclxuXHJcbmludGVyZmFjZSBBZGp1c3RtZW50cyB7XHJcblx0QXhpczogbnVtYmVyW107XHJcblx0WFk6IG51bWJlcltdO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgVHlwZVZhbHVlcyB7XHJcblx0VHlwZTogbnVtYmVyO1xyXG5cdFZhbHVlczogbnVtYmVyW107XHJcbn1cclxuXHJcbmludGVyZmFjZSBQYXJhZ3JhcGhQcm9wZXJ0aWVzIHtcclxuXHRKdXN0aWZpY2F0aW9uPzogbnVtYmVyO1xyXG5cdEZpcnN0TGluZUluZGVudD86IG51bWJlcjtcclxuXHRTdGFydEluZGVudD86IG51bWJlcjtcclxuXHRFbmRJbmRlbnQ/OiBudW1iZXI7XHJcblx0U3BhY2VCZWZvcmU/OiBudW1iZXI7XHJcblx0U3BhY2VBZnRlcj86IG51bWJlcjtcclxuXHRBdXRvSHlwaGVuYXRlPzogYm9vbGVhbjtcclxuXHRIeXBoZW5hdGVkV29yZFNpemU/OiBudW1iZXI7XHJcblx0UHJlSHlwaGVuPzogbnVtYmVyO1xyXG5cdFBvc3RIeXBoZW4/OiBudW1iZXI7XHJcblx0Q29uc2VjdXRpdmVIeXBoZW5zPzogbnVtYmVyO1xyXG5cdFpvbmU/OiBudW1iZXI7XHJcblx0V29yZFNwYWNpbmc/OiBudW1iZXJbXTtcclxuXHRMZXR0ZXJTcGFjaW5nPzogbnVtYmVyW107XHJcblx0R2x5cGhTcGFjaW5nPzogbnVtYmVyW107XHJcblx0QXV0b0xlYWRpbmc/OiBudW1iZXI7XHJcblx0TGVhZGluZ1R5cGU/OiBudW1iZXI7XHJcblx0SGFuZ2luZz86IGJvb2xlYW47XHJcblx0QnVyYXNhZ2FyaT86IGJvb2xlYW47XHJcblx0S2luc29rdU9yZGVyPzogbnVtYmVyO1xyXG5cdEV2ZXJ5TGluZUNvbXBvc2VyPzogYm9vbGVhbjtcclxufVxyXG5cclxuaW50ZXJmYWNlIFBhcmFncmFwaFNoZWV0IHtcclxuXHROYW1lPzogc3RyaW5nO1xyXG5cdERlZmF1bHRTdHlsZVNoZWV0OiBudW1iZXI7XHJcblx0UHJvcGVydGllczogUGFyYWdyYXBoUHJvcGVydGllcztcclxufVxyXG5cclxuaW50ZXJmYWNlIFN0eWxlU2hlZXREYXRhIHtcclxuXHRGb250PzogbnVtYmVyO1xyXG5cdEZvbnRTaXplPzogbnVtYmVyO1xyXG5cdEZhdXhCb2xkPzogYm9vbGVhbjtcclxuXHRGYXV4SXRhbGljPzogYm9vbGVhbjtcclxuXHRBdXRvTGVhZGluZz86IGJvb2xlYW47XHJcblx0TGVhZGluZz86IG51bWJlcjtcclxuXHRIb3Jpem9udGFsU2NhbGU/OiBudW1iZXI7XHJcblx0VmVydGljYWxTY2FsZT86IG51bWJlcjtcclxuXHRUcmFja2luZz86IG51bWJlcjtcclxuXHRBdXRvS2VybmluZz86IGJvb2xlYW47XHJcblx0S2VybmluZz86IG51bWJlcjtcclxuXHRCYXNlbGluZVNoaWZ0PzogbnVtYmVyO1xyXG5cdEZvbnRDYXBzPzogbnVtYmVyO1xyXG5cdEZvbnRCYXNlbGluZT86IG51bWJlcjtcclxuXHRVbmRlcmxpbmU/OiBib29sZWFuO1xyXG5cdFN0cmlrZXRocm91Z2g/OiBib29sZWFuO1xyXG5cdExpZ2F0dXJlcz86IGJvb2xlYW47XHJcblx0RExpZ2F0dXJlcz86IGJvb2xlYW47XHJcblx0QmFzZWxpbmVEaXJlY3Rpb24/OiBudW1iZXI7XHJcblx0VHN1bWU/OiBudW1iZXI7XHJcblx0U3R5bGVSdW5BbGlnbm1lbnQ/OiBudW1iZXI7XHJcblx0TGFuZ3VhZ2U/OiBudW1iZXI7XHJcblx0Tm9CcmVhaz86IGJvb2xlYW47XHJcblx0RmlsbENvbG9yPzogVHlwZVZhbHVlcztcclxuXHRTdHJva2VDb2xvcj86IFR5cGVWYWx1ZXM7XHJcblx0RmlsbEZsYWc/OiBib29sZWFuO1xyXG5cdFN0cm9rZUZsYWc/OiBib29sZWFuO1xyXG5cdEZpbGxGaXJzdD86IGJvb2xlYW47XHJcblx0WVVuZGVybGluZT86IG51bWJlcjtcclxuXHRPdXRsaW5lV2lkdGg/OiBudW1iZXI7XHJcblx0Q2hhcmFjdGVyRGlyZWN0aW9uPzogbnVtYmVyO1xyXG5cdEhpbmRpTnVtYmVycz86IGJvb2xlYW47XHJcblx0S2FzaGlkYT86IG51bWJlcjtcclxuXHREaWFjcml0aWNQb3M/OiBudW1iZXI7XHJcbn1cclxuXHJcbmludGVyZmFjZSBGb250U2V0IHtcclxuXHROYW1lOiBzdHJpbmc7XHJcblx0U2NyaXB0OiBudW1iZXI7XHJcblx0Rm9udFR5cGU6IG51bWJlcjtcclxuXHRTeW50aGV0aWM6IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIFJlc291cmNlRGljdCB7XHJcblx0S2luc29rdVNldDogYW55W107XHJcblx0TW9qaUt1bWlTZXQ6IGFueVtdO1xyXG5cdFRoZU5vcm1hbFN0eWxlU2hlZXQ6IG51bWJlcjtcclxuXHRUaGVOb3JtYWxQYXJhZ3JhcGhTaGVldDogbnVtYmVyO1xyXG5cdFBhcmFncmFwaFNoZWV0U2V0OiBQYXJhZ3JhcGhTaGVldFtdO1xyXG5cdFN0eWxlU2hlZXRTZXQ6IHsgTmFtZTogc3RyaW5nOyBTdHlsZVNoZWV0RGF0YTogU3R5bGVTaGVldERhdGE7IH1bXTtcclxuXHRGb250U2V0OiBGb250U2V0W107XHJcblx0U3VwZXJzY3JpcHRTaXplOiBudW1iZXI7XHJcblx0U3VwZXJzY3JpcHRQb3NpdGlvbjogbnVtYmVyO1xyXG5cdFN1YnNjcmlwdFNpemU6IG51bWJlcjtcclxuXHRTdWJzY3JpcHRQb3NpdGlvbjogbnVtYmVyO1xyXG5cdFNtYWxsQ2FwU2l6ZTogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUGFyYWdyYXBoUnVuIHtcclxuXHRQYXJhZ3JhcGhTaGVldDogUGFyYWdyYXBoU2hlZXQ7XHJcblx0QWRqdXN0bWVudHM6IEFkanVzdG1lbnRzO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3R5bGVSdW4ge1xyXG5cdFN0eWxlU2hlZXQ6IHsgU3R5bGVTaGVldERhdGE6IFN0eWxlU2hlZXREYXRhOyB9O1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUGhvdG9zaG9wTm9kZSB7XHJcblx0U2hhcGVUeXBlPzogbnVtYmVyO1xyXG5cdFBvaW50QmFzZT86IG51bWJlcltdO1xyXG5cdEJveEJvdW5kcz86IG51bWJlcltdO1xyXG5cdEJhc2U/OiB7XHJcblx0XHRTaGFwZVR5cGU6IG51bWJlcjtcclxuXHRcdFRyYW5zZm9ybVBvaW50MDogbnVtYmVyW107XHJcblx0XHRUcmFuc2Zvcm1Qb2ludDE6IG51bWJlcltdO1xyXG5cdFx0VHJhbnNmb3JtUG9pbnQyOiBudW1iZXJbXTtcclxuXHR9O1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRW5naW5lRGF0YSB7XHJcblx0RW5naW5lRGljdDoge1xyXG5cdFx0RWRpdG9yOiB7IFRleHQ6IHN0cmluZzsgfTtcclxuXHRcdFBhcmFncmFwaFJ1bjoge1xyXG5cdFx0XHREZWZhdWx0UnVuRGF0YTogUGFyYWdyYXBoUnVuO1xyXG5cdFx0XHRSdW5BcnJheTogUGFyYWdyYXBoUnVuW107XHJcblx0XHRcdFJ1bkxlbmd0aEFycmF5OiBudW1iZXJbXTtcclxuXHRcdFx0SXNKb2luYWJsZTogbnVtYmVyO1xyXG5cdFx0fTtcclxuXHRcdFN0eWxlUnVuOiB7XHJcblx0XHRcdERlZmF1bHRSdW5EYXRhOiBTdHlsZVJ1bjtcclxuXHRcdFx0UnVuQXJyYXk6IFN0eWxlUnVuW107XHJcblx0XHRcdFJ1bkxlbmd0aEFycmF5OiBudW1iZXJbXTtcclxuXHRcdFx0SXNKb2luYWJsZTogbnVtYmVyO1xyXG5cdFx0fTtcclxuXHRcdEdyaWRJbmZvOiB7XHJcblx0XHRcdEdyaWRJc09uOiBib29sZWFuO1xyXG5cdFx0XHRTaG93R3JpZDogYm9vbGVhbjtcclxuXHRcdFx0R3JpZFNpemU6IG51bWJlcjtcclxuXHRcdFx0R3JpZExlYWRpbmc6IG51bWJlcjtcclxuXHRcdFx0R3JpZENvbG9yOiBUeXBlVmFsdWVzO1xyXG5cdFx0XHRHcmlkTGVhZGluZ0ZpbGxDb2xvcjogVHlwZVZhbHVlcztcclxuXHRcdFx0QWxpZ25MaW5lSGVpZ2h0VG9HcmlkRmxhZ3M6IGJvb2xlYW47XHJcblx0XHR9O1xyXG5cdFx0QW50aUFsaWFzOiBudW1iZXI7XHJcblx0XHRVc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHM6IGJvb2xlYW47XHJcblx0XHRSZW5kZXJlZD86IHtcclxuXHRcdFx0VmVyc2lvbjogbnVtYmVyO1xyXG5cdFx0XHRTaGFwZXM/OiB7XHJcblx0XHRcdFx0V3JpdGluZ0RpcmVjdGlvbjogbnVtYmVyO1xyXG5cdFx0XHRcdENoaWxkcmVuPzoge1xyXG5cdFx0XHRcdFx0U2hhcGVUeXBlPzogbnVtYmVyO1xyXG5cdFx0XHRcdFx0UHJvY2Vzc2lvbjogbnVtYmVyO1xyXG5cdFx0XHRcdFx0TGluZXM6IHsgV3JpdGluZ0RpcmVjdGlvbjogbnVtYmVyOyBDaGlsZHJlbjogYW55W107IH07XHJcblx0XHRcdFx0XHRDb29raWU/OiB7XHJcblx0XHRcdFx0XHRcdFBob3Rvc2hvcD86IFBob3Rvc2hvcE5vZGU7XHJcblx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdH1bXTtcclxuXHRcdFx0fTtcclxuXHRcdH07XHJcblx0fTtcclxuXHRSZXNvdXJjZURpY3Q6IFJlc291cmNlRGljdDtcclxuXHREb2N1bWVudFJlc291cmNlczogUmVzb3VyY2VEaWN0O1xyXG59XHJcblxyXG5jb25zdCBkZWZhdWx0Rm9udDogRm9udCA9IHtcclxuXHRuYW1lOiAnTXlyaWFkUHJvLVJlZ3VsYXInLFxyXG5cdHNjcmlwdDogMCxcclxuXHR0eXBlOiAwLFxyXG5cdHN5bnRoZXRpYzogMCxcclxufTtcclxuXHJcbmNvbnN0IGRlZmF1bHRQYXJhZ3JhcGhTdHlsZTogUGFyYWdyYXBoU3R5bGUgPSB7XHJcblx0anVzdGlmaWNhdGlvbjogJ2xlZnQnLFxyXG5cdGZpcnN0TGluZUluZGVudDogMCxcclxuXHRzdGFydEluZGVudDogMCxcclxuXHRlbmRJbmRlbnQ6IDAsXHJcblx0c3BhY2VCZWZvcmU6IDAsXHJcblx0c3BhY2VBZnRlcjogMCxcclxuXHRhdXRvSHlwaGVuYXRlOiB0cnVlLFxyXG5cdGh5cGhlbmF0ZWRXb3JkU2l6ZTogNixcclxuXHRwcmVIeXBoZW46IDIsXHJcblx0cG9zdEh5cGhlbjogMixcclxuXHRjb25zZWN1dGl2ZUh5cGhlbnM6IDgsXHJcblx0em9uZTogMzYsXHJcblx0d29yZFNwYWNpbmc6IFswLjgsIDEsIDEuMzNdLFxyXG5cdGxldHRlclNwYWNpbmc6IFswLCAwLCAwXSxcclxuXHRnbHlwaFNwYWNpbmc6IFsxLCAxLCAxXSxcclxuXHRhdXRvTGVhZGluZzogMS4yLFxyXG5cdGxlYWRpbmdUeXBlOiAwLFxyXG5cdGhhbmdpbmc6IGZhbHNlLFxyXG5cdGJ1cmFzYWdhcmk6IGZhbHNlLFxyXG5cdGtpbnNva3VPcmRlcjogMCxcclxuXHRldmVyeUxpbmVDb21wb3NlcjogZmFsc2UsXHJcbn07XHJcblxyXG5jb25zdCBkZWZhdWx0U3R5bGU6IFRleHRTdHlsZSA9IHtcclxuXHRmb250OiBkZWZhdWx0Rm9udCxcclxuXHRmb250U2l6ZTogMTIsXHJcblx0ZmF1eEJvbGQ6IGZhbHNlLFxyXG5cdGZhdXhJdGFsaWM6IGZhbHNlLFxyXG5cdGF1dG9MZWFkaW5nOiB0cnVlLFxyXG5cdGxlYWRpbmc6IDAsXHJcblx0aG9yaXpvbnRhbFNjYWxlOiAxLFxyXG5cdHZlcnRpY2FsU2NhbGU6IDEsXHJcblx0dHJhY2tpbmc6IDAsXHJcblx0YXV0b0tlcm5pbmc6IHRydWUsXHJcblx0a2VybmluZzogMCxcclxuXHRiYXNlbGluZVNoaWZ0OiAwLFxyXG5cdGZvbnRDYXBzOiAwLFxyXG5cdGZvbnRCYXNlbGluZTogMCxcclxuXHR1bmRlcmxpbmU6IGZhbHNlLFxyXG5cdHN0cmlrZXRocm91Z2g6IGZhbHNlLFxyXG5cdGxpZ2F0dXJlczogdHJ1ZSxcclxuXHRkTGlnYXR1cmVzOiBmYWxzZSxcclxuXHRiYXNlbGluZURpcmVjdGlvbjogMixcclxuXHR0c3VtZTogMCxcclxuXHRzdHlsZVJ1bkFsaWdubWVudDogMixcclxuXHRsYW5ndWFnZTogMCxcclxuXHRub0JyZWFrOiBmYWxzZSxcclxuXHRmaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMCB9LFxyXG5cdHN0cm9rZUNvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDAgfSxcclxuXHRmaWxsRmxhZzogdHJ1ZSxcclxuXHRzdHJva2VGbGFnOiBmYWxzZSxcclxuXHRmaWxsRmlyc3Q6IHRydWUsXHJcblx0eVVuZGVybGluZTogMSxcclxuXHRvdXRsaW5lV2lkdGg6IDEsXHJcblx0Y2hhcmFjdGVyRGlyZWN0aW9uOiAwLFxyXG5cdGhpbmRpTnVtYmVyczogZmFsc2UsXHJcblx0a2FzaGlkYTogMSxcclxuXHRkaWFjcml0aWNQb3M6IDIsXHJcbn07XHJcblxyXG5jb25zdCBkZWZhdWx0R3JpZEluZm86IFRleHRHcmlkSW5mbyA9IHtcclxuXHRpc09uOiBmYWxzZSxcclxuXHRzaG93OiBmYWxzZSxcclxuXHRzaXplOiAxOCxcclxuXHRsZWFkaW5nOiAyMixcclxuXHRjb2xvcjogeyByOiAwLCBnOiAwLCBiOiAyNTUgfSxcclxuXHRsZWFkaW5nRmlsbENvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDI1NSB9LFxyXG5cdGFsaWduTGluZUhlaWdodFRvR3JpZEZsYWdzOiBmYWxzZSxcclxufTtcclxuXHJcbmNvbnN0IHBhcmFncmFwaFN0eWxlS2V5czogKGtleW9mIFBhcmFncmFwaFN0eWxlKVtdID0gW1xyXG5cdCdqdXN0aWZpY2F0aW9uJywgJ2ZpcnN0TGluZUluZGVudCcsICdzdGFydEluZGVudCcsICdlbmRJbmRlbnQnLCAnc3BhY2VCZWZvcmUnLCAnc3BhY2VBZnRlcicsXHJcblx0J2F1dG9IeXBoZW5hdGUnLCAnaHlwaGVuYXRlZFdvcmRTaXplJywgJ3ByZUh5cGhlbicsICdwb3N0SHlwaGVuJywgJ2NvbnNlY3V0aXZlSHlwaGVucycsXHJcblx0J3pvbmUnLCAnd29yZFNwYWNpbmcnLCAnbGV0dGVyU3BhY2luZycsICdnbHlwaFNwYWNpbmcnLCAnYXV0b0xlYWRpbmcnLCAnbGVhZGluZ1R5cGUnLFxyXG5cdCdoYW5naW5nJywgJ2J1cmFzYWdhcmknLCAna2luc29rdU9yZGVyJywgJ2V2ZXJ5TGluZUNvbXBvc2VyJyxcclxuXTtcclxuXHJcbmNvbnN0IHN0eWxlS2V5czogKGtleW9mIFRleHRTdHlsZSlbXSA9IFtcclxuXHQnZm9udCcsICdmb250U2l6ZScsICdmYXV4Qm9sZCcsICdmYXV4SXRhbGljJywgJ2F1dG9MZWFkaW5nJywgJ2xlYWRpbmcnLCAnaG9yaXpvbnRhbFNjYWxlJyxcclxuXHQndmVydGljYWxTY2FsZScsICd0cmFja2luZycsICdhdXRvS2VybmluZycsICdrZXJuaW5nJywgJ2Jhc2VsaW5lU2hpZnQnLCAnZm9udENhcHMnLCAnZm9udEJhc2VsaW5lJyxcclxuXHQndW5kZXJsaW5lJywgJ3N0cmlrZXRocm91Z2gnLCAnbGlnYXR1cmVzJywgJ2RMaWdhdHVyZXMnLCAnYmFzZWxpbmVEaXJlY3Rpb24nLCAndHN1bWUnLFxyXG5cdCdzdHlsZVJ1bkFsaWdubWVudCcsICdsYW5ndWFnZScsICdub0JyZWFrJywgJ2ZpbGxDb2xvcicsICdzdHJva2VDb2xvcicsICdmaWxsRmxhZycsXHJcblx0J3N0cm9rZUZsYWcnLCAnZmlsbEZpcnN0JywgJ3lVbmRlcmxpbmUnLCAnb3V0bGluZVdpZHRoJywgJ2NoYXJhY3RlckRpcmVjdGlvbicsICdoaW5kaU51bWJlcnMnLFxyXG5cdCdrYXNoaWRhJywgJ2RpYWNyaXRpY1BvcycsXHJcbl07XHJcblxyXG5jb25zdCBhbnRpYWxpYXM6IEFudGlBbGlhc1tdID0gWydub25lJywgJ2NyaXNwJywgJ3N0cm9uZycsICdzbW9vdGgnLCAnc2hhcnAnXTtcclxuY29uc3QganVzdGlmaWNhdGlvbjogSnVzdGlmaWNhdGlvbltdID0gWydsZWZ0JywgJ3JpZ2h0JywgJ2NlbnRlciddO1xyXG5cclxuZnVuY3Rpb24gdXBwZXJGaXJzdCh2YWx1ZTogc3RyaW5nKSB7XHJcblx0cmV0dXJuIHZhbHVlLnN1YnN0cigwLCAxKS50b1VwcGVyQ2FzZSgpICsgdmFsdWUuc3Vic3RyKDEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVDb2xvcihjb2xvcjogeyBUeXBlOiBudW1iZXI7IFZhbHVlczogbnVtYmVyW107IH0pOiBDb2xvciB7XHJcblx0Y29uc3QgYyA9IGNvbG9yLlZhbHVlcztcclxuXHJcblx0aWYgKGNvbG9yLlR5cGUgPT09IDApIHsgLy8gZ3JheXNjYWxlXHJcblx0XHRyZXR1cm4geyByOiBjWzFdICogMjU1LCBnOiBjWzFdICogMjU1LCBiOiBjWzFdICogMjU1IH07IC8vICwgY1swXSAqIDI1NV07XHJcblx0fSBlbHNlIHsgLy8gcmdiXHJcblx0XHRyZXR1cm4geyByOiBjWzFdICogMjU1LCBnOiBjWzJdICogMjU1LCBiOiBjWzNdICogMjU1LCBhOiBjWzBdIH07IC8vICwgY1swXSAqIDI1NV07XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiBlbmNvZGVDb2xvcihjb2xvcjogQ29sb3IgfCB1bmRlZmluZWQpIHtcclxuXHRpZiAoY29sb3IgJiYgJ3InIGluIGNvbG9yKSB7XHJcblx0XHRyZXR1cm4gWydhJyBpbiBjb2xvciA/IGNvbG9yLmEgOiAxLCBjb2xvci5yIC8gMjU1LCBjb2xvci5nIC8gMjU1LCBjb2xvci5iIC8gMjU1XTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIFswLCAwLCAwLCAwXTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGFycmF5c0VxdWFsKGE6IGFueVtdLCBiOiBhbnlbXSkge1xyXG5cdGlmICghYSB8fCAhYikgcmV0dXJuIGZhbHNlO1xyXG5cdGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9iamVjdHNFcXVhbChhOiBhbnksIGI6IGFueSkge1xyXG5cdGlmICghYSB8fCAhYikgcmV0dXJuIGZhbHNlO1xyXG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGEpKSBpZiAoYVtrZXldICE9PSBiW2tleV0pIHJldHVybiBmYWxzZTtcclxuXHRmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhiKSkgaWYgKGFba2V5XSAhPT0gYltrZXldKSByZXR1cm4gZmFsc2U7XHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRPckFkZEZvbnQoZm9udHM6IEZvbnRbXSwgZm9udDogRm9udCkge1xyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZm9udHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdGlmIChmb250c1tpXS5uYW1lID09PSBmb250Lm5hbWUpIHJldHVybiBpO1xyXG5cdH1cclxuXHJcblx0Zm9udHMucHVzaChmb250KTtcclxuXHRyZXR1cm4gZm9udHMubGVuZ3RoIC0gMTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlT2JqZWN0KG9iajogYW55LCBrZXlzOiBzdHJpbmdbXSwgZm9udHM6IEZvbnRbXSkge1xyXG5cdGNvbnN0IHJlc3VsdDogYW55ID0ge307XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcclxuXHRcdGNvbnN0IEtleSA9IHVwcGVyRmlyc3Qoa2V5KTtcclxuXHJcblx0XHRpZiAob2JqW0tleV0gPT09IHVuZGVmaW5lZCkgY29udGludWU7XHJcblxyXG5cdFx0aWYgKGtleSA9PT0gJ2p1c3RpZmljYXRpb24nKSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0ganVzdGlmaWNhdGlvbltvYmpbS2V5XV07XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ2ZvbnQnKSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0gZm9udHNbb2JqW0tleV1dO1xyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdmaWxsQ29sb3InIHx8IGtleSA9PT0gJ3N0cm9rZUNvbG9yJykge1xyXG5cdFx0XHRyZXN1bHRba2V5XSA9IGRlY29kZUNvbG9yKG9ialtLZXldKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0gb2JqW0tleV07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbmNvZGVPYmplY3Qob2JqOiBhbnksIGtleXM6IHN0cmluZ1tdLCBmb250czogRm9udFtdKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xyXG5cdFx0Y29uc3QgS2V5ID0gdXBwZXJGaXJzdChrZXkpO1xyXG5cclxuXHRcdGlmIChvYmpba2V5XSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcclxuXHJcblx0XHRpZiAoa2V5ID09PSAnanVzdGlmaWNhdGlvbicpIHtcclxuXHRcdFx0cmVzdWx0W0tleV0gPSBqdXN0aWZpY2F0aW9uLmluZGV4T2Yob2JqW2tleV0gPz8gJ2xlZnQnKTtcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnZm9udCcpIHtcclxuXHRcdFx0cmVzdWx0W0tleV0gPSBmaW5kT3JBZGRGb250KGZvbnRzLCBvYmpba2V5XSk7XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ2ZpbGxDb2xvcicgfHwga2V5ID09PSAnc3Ryb2tlQ29sb3InKSB7XHJcblx0XHRcdHJlc3VsdFtLZXldID0geyBUeXBlOiAxLCBWYWx1ZXM6IGVuY29kZUNvbG9yKG9ialtrZXldKSB9IGFzIFR5cGVWYWx1ZXM7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXN1bHRbS2V5XSA9IG9ialtrZXldO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlUGFyYWdyYXBoU3R5bGUob2JqOiBQYXJhZ3JhcGhQcm9wZXJ0aWVzLCBmb250czogRm9udFtdKTogUGFyYWdyYXBoU3R5bGUge1xyXG5cdHJldHVybiBkZWNvZGVPYmplY3Qob2JqLCBwYXJhZ3JhcGhTdHlsZUtleXMsIGZvbnRzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVjb2RlU3R5bGUob2JqOiBTdHlsZVNoZWV0RGF0YSwgZm9udHM6IEZvbnRbXSk6IFRleHRTdHlsZSB7XHJcblx0cmV0dXJuIGRlY29kZU9iamVjdChvYmosIHN0eWxlS2V5cywgZm9udHMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbmNvZGVQYXJhZ3JhcGhTdHlsZShvYmo6IFBhcmFncmFwaFN0eWxlLCBmb250czogRm9udFtdKTogUGFyYWdyYXBoUHJvcGVydGllcyB7XHJcblx0cmV0dXJuIGVuY29kZU9iamVjdChvYmosIHBhcmFncmFwaFN0eWxlS2V5cywgZm9udHMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBlbmNvZGVTdHlsZShvYmo6IFRleHRTdHlsZSwgZm9udHM6IEZvbnRbXSk6IFN0eWxlU2hlZXREYXRhIHtcclxuXHRyZXR1cm4gZW5jb2RlT2JqZWN0KG9iaiwgc3R5bGVLZXlzLCBmb250cyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlZHVwbGljYXRlVmFsdWVzPFQ+KGJhc2U6IFQsIHJ1bnM6IHsgc3R5bGU6IFQ7IH1bXSwga2V5czogKGtleW9mIFQpW10pIHtcclxuXHRpZiAoIXJ1bnMubGVuZ3RoKSByZXR1cm47XHJcblxyXG5cdGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcclxuXHRcdGNvbnN0IHZhbHVlID0gcnVuc1swXS5zdHlsZVtrZXldO1xyXG5cclxuXHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdGxldCBpZGVudGljYWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG5cdFx0XHRcdGlkZW50aWNhbCA9IHJ1bnMuZXZlcnkociA9PiBhcnJheXNFcXVhbChyLnN0eWxlW2tleV0gYXMgYW55LCB2YWx1ZSkpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuXHRcdFx0XHRpZGVudGljYWwgPSBydW5zLmV2ZXJ5KHIgPT4gb2JqZWN0c0VxdWFsKHIuc3R5bGVba2V5XSBhcyBhbnksIHZhbHVlKSk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aWRlbnRpY2FsID0gcnVucy5ldmVyeShyID0+IHIuc3R5bGVba2V5XSA9PT0gdmFsdWUpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoaWRlbnRpY2FsKSB7XHJcblx0XHRcdFx0YmFzZVtrZXldID0gdmFsdWUgYXMgYW55O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qgc3R5bGVWYWx1ZSA9IGJhc2Vba2V5XTtcclxuXHJcblx0XHRpZiAoc3R5bGVWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdGZvciAoY29uc3QgciBvZiBydW5zKSB7XHJcblx0XHRcdFx0bGV0IHNhbWUgPSBmYWxzZTtcclxuXHJcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcblx0XHRcdFx0XHRzYW1lID0gYXJyYXlzRXF1YWwoci5zdHlsZVtrZXldIGFzIGFueSwgdmFsdWUpO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHRcdFx0c2FtZSA9IG9iamVjdHNFcXVhbChyLnN0eWxlW2tleV0gYXMgYW55LCB2YWx1ZSk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHNhbWUgPSByLnN0eWxlW2tleV0gPT09IHZhbHVlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKHNhbWUpIGRlbGV0ZSByLnN0eWxlW2tleV07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmIChydW5zLmV2ZXJ5KHggPT4gT2JqZWN0LmtleXMoeC5zdHlsZSkubGVuZ3RoID09PSAwKSkge1xyXG5cdFx0cnVucy5sZW5ndGggPSAwO1xyXG5cdH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZUVuZ2luZURhdGEoZW5naW5lRGF0YTogRW5naW5lRGF0YSkge1xyXG5cdC8vIGNvbnNvbGUubG9nKCdlbmdpbmVEYXRhJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0Y29uc3QgZW5naW5lRGljdCA9IGVuZ2luZURhdGEuRW5naW5lRGljdDtcclxuXHRjb25zdCByZXNvdXJjZURpY3QgPSBlbmdpbmVEYXRhLlJlc291cmNlRGljdDtcclxuXHJcblx0Y29uc3QgZm9udHMgPSByZXNvdXJjZURpY3QuRm9udFNldC5tYXA8Rm9udD4oZiA9PiAoe1xyXG5cdFx0bmFtZTogZi5OYW1lLFxyXG5cdFx0c2NyaXB0OiBmLlNjcmlwdCxcclxuXHRcdHR5cGU6IGYuRm9udFR5cGUsXHJcblx0XHRzeW50aGV0aWM6IGYuU3ludGhldGljLFxyXG5cdH0pKTtcclxuXHJcblx0bGV0IHRleHQgPSBlbmdpbmVEaWN0LkVkaXRvci5UZXh0LnJlcGxhY2UoL1xcci9nLCAnXFxuJyk7XHJcblx0bGV0IHJlbW92ZWRDaGFyYWN0ZXJzID0gMDtcclxuXHJcblx0d2hpbGUgKC9cXG4kLy50ZXN0KHRleHQpKSB7XHJcblx0XHR0ZXh0ID0gdGV4dC5zdWJzdHIoMCwgdGV4dC5sZW5ndGggLSAxKTtcclxuXHRcdHJlbW92ZWRDaGFyYWN0ZXJzKys7XHJcblx0fVxyXG5cclxuXHRjb25zdCByZXN1bHQ6IExheWVyVGV4dERhdGEgPSB7XHJcblx0XHR0ZXh0LFxyXG5cdFx0YW50aUFsaWFzOiBhbnRpYWxpYXNbZW5naW5lRGljdC5BbnRpQWxpYXNdID8/ICdzbW9vdGgnLFxyXG5cdFx0dXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzOiAhIWVuZ2luZURpY3QuVXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzLFxyXG5cdFx0c3VwZXJzY3JpcHRTaXplOiByZXNvdXJjZURpY3QuU3VwZXJzY3JpcHRTaXplLFxyXG5cdFx0c3VwZXJzY3JpcHRQb3NpdGlvbjogcmVzb3VyY2VEaWN0LlN1cGVyc2NyaXB0UG9zaXRpb24sXHJcblx0XHRzdWJzY3JpcHRTaXplOiByZXNvdXJjZURpY3QuU3Vic2NyaXB0U2l6ZSxcclxuXHRcdHN1YnNjcmlwdFBvc2l0aW9uOiByZXNvdXJjZURpY3QuU3Vic2NyaXB0UG9zaXRpb24sXHJcblx0XHRzbWFsbENhcFNpemU6IHJlc291cmNlRGljdC5TbWFsbENhcFNpemUsXHJcblx0fTtcclxuXHJcblx0Ly8gc2hhcGVcclxuXHJcblx0Y29uc3QgcGhvdG9zaG9wID0gZW5naW5lRGljdC5SZW5kZXJlZD8uU2hhcGVzPy5DaGlsZHJlbj8uWzBdPy5Db29raWU/LlBob3Rvc2hvcDtcclxuXHJcblx0aWYgKHBob3Rvc2hvcCkge1xyXG5cdFx0cmVzdWx0LnNoYXBlVHlwZSA9IHBob3Rvc2hvcC5TaGFwZVR5cGUgPT09IDEgPyAnYm94JyA6ICdwb2ludCc7XHJcblx0XHRpZiAocGhvdG9zaG9wLlBvaW50QmFzZSkgcmVzdWx0LnBvaW50QmFzZSA9IHBob3Rvc2hvcC5Qb2ludEJhc2U7XHJcblx0XHRpZiAocGhvdG9zaG9wLkJveEJvdW5kcykgcmVzdWx0LmJveEJvdW5kcyA9IHBob3Rvc2hvcC5Cb3hCb3VuZHM7XHJcblx0fVxyXG5cclxuXHQvLyBwYXJhZ3JhcGggc3R5bGVcclxuXHJcblx0Ly8gY29uc3QgdGhlTm9ybWFsUGFyYWdyYXBoU2hlZXQgPSByZXNvdXJjZURpY3QuVGhlTm9ybWFsUGFyYWdyYXBoU2hlZXQ7XHJcblx0Ly8gY29uc3QgcGFyYWdyYXBoU2hlZXRTZXQgPSByZXNvdXJjZURpY3QuUGFyYWdyYXBoU2hlZXRTZXQ7XHJcblx0Ly8gY29uc3QgcGFyYWdyYXBoUHJvcGVydGllcyA9IHBhcmFncmFwaFNoZWV0U2V0W3RoZU5vcm1hbFBhcmFncmFwaFNoZWV0XS5Qcm9wZXJ0aWVzO1xyXG5cdGNvbnN0IHBhcmFncmFwaFJ1biA9IGVuZ2luZURhdGEuRW5naW5lRGljdC5QYXJhZ3JhcGhSdW47XHJcblxyXG5cdHJlc3VsdC5wYXJhZ3JhcGhTdHlsZSA9IHt9OyAvLyBkZWNvZGVQYXJhZ3JhcGhTdHlsZShwYXJhZ3JhcGhQcm9wZXJ0aWVzLCBmb250cyk7XHJcblx0cmVzdWx0LnBhcmFncmFwaFN0eWxlUnVucyA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFncmFwaFJ1bi5SdW5BcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0Y29uc3QgcnVuID0gcGFyYWdyYXBoUnVuLlJ1bkFycmF5W2ldO1xyXG5cdFx0Y29uc3QgbGVuZ3RoID0gcGFyYWdyYXBoUnVuLlJ1bkxlbmd0aEFycmF5W2ldO1xyXG5cdFx0Y29uc3Qgc3R5bGUgPSBkZWNvZGVQYXJhZ3JhcGhTdHlsZShydW4uUGFyYWdyYXBoU2hlZXQuUHJvcGVydGllcywgZm9udHMpO1xyXG5cdFx0Ly8gY29uc3QgYWRqdXN0bWVudHMgPSB7XHJcblx0XHQvLyAgIGF4aXM6IHJ1bi5BZGp1c3RtZW50cy5BeGlzLFxyXG5cdFx0Ly8gICB4eTogcnVuLkFkanVzdG1lbnRzLlhZLFxyXG5cdFx0Ly8gfTtcclxuXHRcdHJlc3VsdC5wYXJhZ3JhcGhTdHlsZVJ1bnMucHVzaCh7IGxlbmd0aCwgc3R5bGUvKiwgYWRqdXN0bWVudHMqLyB9KTtcclxuXHR9XHJcblxyXG5cdGZvciAobGV0IGNvdW50ZXIgPSByZW1vdmVkQ2hhcmFjdGVyczsgcmVzdWx0LnBhcmFncmFwaFN0eWxlUnVucy5sZW5ndGggJiYgY291bnRlciA+IDA7IGNvdW50ZXItLSkge1xyXG5cdFx0aWYgKC0tcmVzdWx0LnBhcmFncmFwaFN0eWxlUnVuc1tyZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zLmxlbmd0aCAtIDFdLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRyZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zLnBvcCgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVkdXBsaWNhdGVWYWx1ZXMocmVzdWx0LnBhcmFncmFwaFN0eWxlLCByZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zLCBwYXJhZ3JhcGhTdHlsZUtleXMpO1xyXG5cclxuXHRpZiAoIXJlc3VsdC5wYXJhZ3JhcGhTdHlsZVJ1bnMubGVuZ3RoKSBkZWxldGUgcmVzdWx0LnBhcmFncmFwaFN0eWxlUnVucztcclxuXHJcblx0Ly8gc3R5bGVcclxuXHJcblx0Ly8gY29uc3QgdGhlTm9ybWFsU3R5bGVTaGVldCA9IHJlc291cmNlRGljdC5UaGVOb3JtYWxTdHlsZVNoZWV0O1xyXG5cdC8vIGNvbnN0IHN0eWxlU2hlZXRTZXQgPSByZXNvdXJjZURpY3QuU3R5bGVTaGVldFNldDtcclxuXHQvLyBjb25zdCBzdHlsZVNoZWV0RGF0YSA9IHN0eWxlU2hlZXRTZXRbdGhlTm9ybWFsU3R5bGVTaGVldF0uU3R5bGVTaGVldERhdGE7XHJcblx0Y29uc3Qgc3R5bGVSdW4gPSBlbmdpbmVEYXRhLkVuZ2luZURpY3QuU3R5bGVSdW47XHJcblxyXG5cdHJlc3VsdC5zdHlsZSA9IHt9OyAvLyBkZWNvZGVTdHlsZShzdHlsZVNoZWV0RGF0YSwgZm9udHMpO1xyXG5cdHJlc3VsdC5zdHlsZVJ1bnMgPSBbXTtcclxuXHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdHlsZVJ1bi5SdW5BcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0Y29uc3QgbGVuZ3RoID0gc3R5bGVSdW4uUnVuTGVuZ3RoQXJyYXlbaV07XHJcblx0XHRjb25zdCBzdHlsZSA9IGRlY29kZVN0eWxlKHN0eWxlUnVuLlJ1bkFycmF5W2ldLlN0eWxlU2hlZXQuU3R5bGVTaGVldERhdGEsIGZvbnRzKTtcclxuXHRcdHJlc3VsdC5zdHlsZVJ1bnMucHVzaCh7IGxlbmd0aCwgc3R5bGUgfSk7XHJcblx0fVxyXG5cclxuXHRmb3IgKGxldCBjb3VudGVyID0gcmVtb3ZlZENoYXJhY3RlcnM7IHJlc3VsdC5zdHlsZVJ1bnMubGVuZ3RoICYmIGNvdW50ZXIgPiAwOyBjb3VudGVyLS0pIHtcclxuXHRcdGlmICgtLXJlc3VsdC5zdHlsZVJ1bnNbcmVzdWx0LnN0eWxlUnVucy5sZW5ndGggLSAxXS5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0cmVzdWx0LnN0eWxlUnVucy5wb3AoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGRlZHVwbGljYXRlVmFsdWVzKHJlc3VsdC5zdHlsZSwgcmVzdWx0LnN0eWxlUnVucywgc3R5bGVLZXlzKTtcclxuXHJcblx0aWYgKCFyZXN1bHQuc3R5bGVSdW5zLmxlbmd0aCkgZGVsZXRlIHJlc3VsdC5zdHlsZVJ1bnM7XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVFbmdpbmVEYXRhKGRhdGE6IExheWVyVGV4dERhdGEpIHtcclxuXHRjb25zdCB0ZXh0ID0gYCR7KGRhdGEudGV4dCB8fCAnJykucmVwbGFjZSgvXFxyP1xcbi9nLCAnXFxyJyl9XFxyYDtcclxuXHJcblx0Y29uc3QgZm9udHM6IEZvbnRbXSA9IFtcclxuXHRcdHsgbmFtZTogJ0Fkb2JlSW52aXNGb250Jywgc2NyaXB0OiAwLCB0eXBlOiAwLCBzeW50aGV0aWM6IDAgfSxcclxuXHRdO1xyXG5cclxuXHRjb25zdCBkZWZGb250ID0gZGF0YS5zdHlsZT8uZm9udCB8fCBkYXRhLnN0eWxlUnVucz8uZmluZChzID0+IHMuc3R5bGUuZm9udCk/LnN0eWxlLmZvbnQgfHwgZGVmYXVsdEZvbnQ7XHJcblx0Y29uc3QgcGFyYWdyYXBoUnVuQXJyYXk6IFBhcmFncmFwaFJ1bltdID0gW107XHJcblx0Y29uc3QgcGFyYWdyYXBoUnVuTGVuZ3RoQXJyYXk6IG51bWJlcltdID0gW107XHJcblx0Y29uc3QgcGFyYWdyYXBoUnVucyA9IGRhdGEucGFyYWdyYXBoU3R5bGVSdW5zO1xyXG5cclxuXHRpZiAocGFyYWdyYXBoUnVucyAmJiBwYXJhZ3JhcGhSdW5zLmxlbmd0aCkge1xyXG5cdFx0bGV0IGxlZnRMZW5ndGggPSB0ZXh0Lmxlbmd0aDtcclxuXHJcblx0XHRmb3IgKGNvbnN0IHJ1biBvZiBwYXJhZ3JhcGhSdW5zKSB7XHJcblx0XHRcdGxldCBydW5MZW5ndGggPSBNYXRoLm1pbihydW4ubGVuZ3RoLCBsZWZ0TGVuZ3RoKTtcclxuXHRcdFx0bGVmdExlbmd0aCAtPSBydW5MZW5ndGg7XHJcblxyXG5cdFx0XHRpZiAoIXJ1bkxlbmd0aCkgY29udGludWU7IC8vIGlnbm9yZSAwIHNpemUgcnVuc1xyXG5cclxuXHRcdFx0Ly8gZXh0ZW5kIGxhc3QgcnVuIGlmIGl0J3Mgb25seSBmb3IgdHJhaWxpbmcgXFxyXHJcblx0XHRcdGlmIChsZWZ0TGVuZ3RoID09PSAxICYmIHJ1biA9PT0gcGFyYWdyYXBoUnVuc1twYXJhZ3JhcGhSdW5zLmxlbmd0aCAtIDFdKSB7XHJcblx0XHRcdFx0cnVuTGVuZ3RoKys7XHJcblx0XHRcdFx0bGVmdExlbmd0aC0tO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwYXJhZ3JhcGhSdW5MZW5ndGhBcnJheS5wdXNoKHJ1bkxlbmd0aCk7XHJcblx0XHRcdHBhcmFncmFwaFJ1bkFycmF5LnB1c2goe1xyXG5cdFx0XHRcdFBhcmFncmFwaFNoZWV0OiB7XHJcblx0XHRcdFx0XHREZWZhdWx0U3R5bGVTaGVldDogMCxcclxuXHRcdFx0XHRcdFByb3BlcnRpZXM6IGVuY29kZVBhcmFncmFwaFN0eWxlKHsgLi4uZGVmYXVsdFBhcmFncmFwaFN0eWxlLCAuLi5kYXRhLnBhcmFncmFwaFN0eWxlLCAuLi5ydW4uc3R5bGUgfSwgZm9udHMpLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0QWRqdXN0bWVudHM6IHsgQXhpczogWzEsIDAsIDFdLCBYWTogWzAsIDBdIH0sXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChsZWZ0TGVuZ3RoKSB7XHJcblx0XHRcdHBhcmFncmFwaFJ1bkxlbmd0aEFycmF5LnB1c2gobGVmdExlbmd0aCk7XHJcblx0XHRcdHBhcmFncmFwaFJ1bkFycmF5LnB1c2goe1xyXG5cdFx0XHRcdFBhcmFncmFwaFNoZWV0OiB7XHJcblx0XHRcdFx0XHREZWZhdWx0U3R5bGVTaGVldDogMCxcclxuXHRcdFx0XHRcdFByb3BlcnRpZXM6IGVuY29kZVBhcmFncmFwaFN0eWxlKHsgLi4uZGVmYXVsdFBhcmFncmFwaFN0eWxlLCAuLi5kYXRhLnBhcmFncmFwaFN0eWxlIH0sIGZvbnRzKSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdEFkanVzdG1lbnRzOiB7IEF4aXM6IFsxLCAwLCAxXSwgWFk6IFswLCAwXSB9LFxyXG5cdFx0XHR9KTtcclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxhc3QgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRpZiAodGV4dC5jaGFyQ29kZUF0KGkpID09PSAxMykgeyAvLyBcXHJcclxuXHRcdFx0XHRwYXJhZ3JhcGhSdW5MZW5ndGhBcnJheS5wdXNoKGkgLSBsYXN0ICsgMSk7XHJcblx0XHRcdFx0cGFyYWdyYXBoUnVuQXJyYXkucHVzaCh7XHJcblx0XHRcdFx0XHRQYXJhZ3JhcGhTaGVldDoge1xyXG5cdFx0XHRcdFx0XHREZWZhdWx0U3R5bGVTaGVldDogMCxcclxuXHRcdFx0XHRcdFx0UHJvcGVydGllczogZW5jb2RlUGFyYWdyYXBoU3R5bGUoeyAuLi5kZWZhdWx0UGFyYWdyYXBoU3R5bGUsIC4uLmRhdGEucGFyYWdyYXBoU3R5bGUgfSwgZm9udHMpLFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdEFkanVzdG1lbnRzOiB7IEF4aXM6IFsxLCAwLCAxXSwgWFk6IFswLCAwXSB9LFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHRcdGxhc3QgPSBpICsgMTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Y29uc3Qgc3R5bGVTaGVldERhdGEgPSBlbmNvZGVTdHlsZSh7IC4uLmRlZmF1bHRTdHlsZSwgZm9udDogZGVmRm9udCB9LCBmb250cyk7XHJcblx0Y29uc3Qgc3R5bGVSdW5zID0gZGF0YS5zdHlsZVJ1bnMgfHwgW3sgbGVuZ3RoOiB0ZXh0Lmxlbmd0aCwgc3R5bGU6IGRhdGEuc3R5bGUgfHwge30gfV07XHJcblx0Y29uc3Qgc3R5bGVSdW5BcnJheTogU3R5bGVSdW5bXSA9IFtdO1xyXG5cdGNvbnN0IHN0eWxlUnVuTGVuZ3RoQXJyYXk6IG51bWJlcltdID0gW107XHJcblxyXG5cdGxldCBsZWZ0TGVuZ3RoID0gdGV4dC5sZW5ndGg7XHJcblxyXG5cdGZvciAoY29uc3QgcnVuIG9mIHN0eWxlUnVucykge1xyXG5cdFx0bGV0IHJ1bkxlbmd0aCA9IE1hdGgubWluKHJ1bi5sZW5ndGgsIGxlZnRMZW5ndGgpO1xyXG5cdFx0bGVmdExlbmd0aCAtPSBydW5MZW5ndGg7XHJcblxyXG5cdFx0aWYgKCFydW5MZW5ndGgpIGNvbnRpbnVlOyAvLyBpZ25vcmUgMCBzaXplIHJ1bnNcclxuXHJcblx0XHQvLyBleHRlbmQgbGFzdCBydW4gaWYgaXQncyBvbmx5IGZvciB0cmFpbGluZyBcXHJcclxuXHRcdGlmIChsZWZ0TGVuZ3RoID09PSAxICYmIHJ1biA9PT0gc3R5bGVSdW5zW3N0eWxlUnVucy5sZW5ndGggLSAxXSkge1xyXG5cdFx0XHRydW5MZW5ndGgrKztcclxuXHRcdFx0bGVmdExlbmd0aC0tO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0eWxlUnVuTGVuZ3RoQXJyYXkucHVzaChydW5MZW5ndGgpO1xyXG5cdFx0c3R5bGVSdW5BcnJheS5wdXNoKHtcclxuXHRcdFx0U3R5bGVTaGVldDoge1xyXG5cdFx0XHRcdFN0eWxlU2hlZXREYXRhOiBlbmNvZGVTdHlsZSh7XHJcblx0XHRcdFx0XHRrZXJuaW5nOiAwLFxyXG5cdFx0XHRcdFx0YXV0b0tlcm5pbmc6IHRydWUsXHJcblx0XHRcdFx0XHRmaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMCB9LFxyXG5cdFx0XHRcdFx0Li4uZGF0YS5zdHlsZSxcclxuXHRcdFx0XHRcdC4uLnJ1bi5zdHlsZSxcclxuXHRcdFx0XHR9LCBmb250cyksXHJcblx0XHRcdH0sXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vIGFkZCBleHRyYSBydW4gdG8gdGhlIGVuZCBpZiBleGlzdGluZyBvbmVzIGRpZG4ndCBmaWxsIGl0IHVwXHJcblx0aWYgKGxlZnRMZW5ndGggJiYgc3R5bGVSdW5zLmxlbmd0aCkge1xyXG5cdFx0c3R5bGVSdW5MZW5ndGhBcnJheS5wdXNoKGxlZnRMZW5ndGgpO1xyXG5cdFx0c3R5bGVSdW5BcnJheS5wdXNoKHtcclxuXHRcdFx0U3R5bGVTaGVldDoge1xyXG5cdFx0XHRcdFN0eWxlU2hlZXREYXRhOiBlbmNvZGVTdHlsZSh7XHJcblx0XHRcdFx0XHRrZXJuaW5nOiAwLFxyXG5cdFx0XHRcdFx0YXV0b0tlcm5pbmc6IHRydWUsXHJcblx0XHRcdFx0XHRmaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMCB9LFxyXG5cdFx0XHRcdFx0Li4uZGF0YS5zdHlsZSxcclxuXHRcdFx0XHR9LCBmb250cyksXHJcblx0XHRcdH0sXHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGdyaWRJbmZvID0geyAuLi5kZWZhdWx0R3JpZEluZm8sIC4uLmRhdGEuZ3JpZEluZm8gfTtcclxuXHRjb25zdCBXcml0aW5nRGlyZWN0aW9uID0gZGF0YS5vcmllbnRhdGlvbiA9PT0gJ3ZlcnRpY2FsJyA/IDIgOiAwO1xyXG5cdGNvbnN0IFByb2Nlc3Npb24gPSBkYXRhLm9yaWVudGF0aW9uID09PSAndmVydGljYWwnID8gMSA6IDA7XHJcblx0Y29uc3QgU2hhcGVUeXBlID0gZGF0YS5zaGFwZVR5cGUgPT09ICdib3gnID8gMSA6IDA7XHJcblx0Y29uc3QgUGhvdG9zaG9wOiBQaG90b3Nob3BOb2RlID0ge1xyXG5cdFx0U2hhcGVUeXBlLFxyXG5cdH07XHJcblxyXG5cdGlmIChTaGFwZVR5cGUgPT09IDApIHtcclxuXHRcdFBob3Rvc2hvcC5Qb2ludEJhc2UgPSBkYXRhLnBvaW50QmFzZSB8fCBbMCwgMF07XHJcblx0fSBlbHNlIHtcclxuXHRcdFBob3Rvc2hvcC5Cb3hCb3VuZHMgPSBkYXRhLmJveEJvdW5kcyB8fCBbMCwgMCwgMCwgMF07XHJcblx0fVxyXG5cclxuXHQvLyBuZWVkZWQgZm9yIGNvcnJlY3Qgb3JkZXIgb2YgcHJvcGVydGllc1xyXG5cdFBob3Rvc2hvcC5CYXNlID0ge1xyXG5cdFx0U2hhcGVUeXBlLFxyXG5cdFx0VHJhbnNmb3JtUG9pbnQwOiBbMSwgMF0sXHJcblx0XHRUcmFuc2Zvcm1Qb2ludDE6IFswLCAxXSxcclxuXHRcdFRyYW5zZm9ybVBvaW50MjogWzAsIDBdLFxyXG5cdH07XHJcblxyXG5cdGNvbnN0IGRlZmF1bHRSZXNvdXJjZXMgPSB7XHJcblx0XHRLaW5zb2t1U2V0OiBbXHJcblx0XHRcdHtcclxuXHRcdFx0XHROYW1lOiAnUGhvdG9zaG9wS2luc29rdUhhcmQnLFxyXG5cdFx0XHRcdE5vU3RhcnQ6ICfjgIHjgILvvIzvvI7jg7vvvJrvvJvvvJ/vvIHjg7zigJXigJnigJ3vvInjgJXvvL3vvZ3jgInjgIvjgI3jgI/jgJHjg73jg77jgp3jgp7jgIXjgYHjgYPjgYXjgYfjgYnjgaPjgoPjgoXjgofjgo7jgqHjgqPjgqXjgqfjgqnjg4Pjg6Pjg6Xjg6fjg67jg7Xjg7bjgpvjgpw/ISldfSwuOjvihIPihInCou+8heKAsCcsXHJcblx0XHRcdFx0Tm9FbmQ6ICfigJjigJzvvIjjgJTvvLvvvZvjgIjjgIrjgIzjgI7jgJAoW3vvv6XvvITCo++8oMKn44CS77yDJyxcclxuXHRcdFx0XHRLZWVwOiAn4oCV4oClJyxcclxuXHRcdFx0XHRIYW5naW5nOiAn44CB44CCLiwnLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0TmFtZTogJ1Bob3Rvc2hvcEtpbnNva3VTb2Z0JyxcclxuXHRcdFx0XHROb1N0YXJ0OiAn44CB44CC77yM77yO44O777ya77yb77yf77yB4oCZ4oCd77yJ44CV77y9772d44CJ44CL44CN44CP44CR44O944O+44Kd44Ke44CFJyxcclxuXHRcdFx0XHROb0VuZDogJ+KAmOKAnO+8iOOAlO+8u++9m+OAiOOAiuOAjOOAjuOAkCcsXHJcblx0XHRcdFx0S2VlcDogJ+KAleKApScsXHJcblx0XHRcdFx0SGFuZ2luZzogJ+OAgeOAgi4sJyxcclxuXHRcdFx0fSxcclxuXHRcdF0sXHJcblx0XHRNb2ppS3VtaVNldDogW1xyXG5cdFx0XHR7IEludGVybmFsTmFtZTogJ1Bob3Rvc2hvcDZNb2ppS3VtaVNldDEnIH0sXHJcblx0XHRcdHsgSW50ZXJuYWxOYW1lOiAnUGhvdG9zaG9wNk1vamlLdW1pU2V0MicgfSxcclxuXHRcdFx0eyBJbnRlcm5hbE5hbWU6ICdQaG90b3Nob3A2TW9qaUt1bWlTZXQzJyB9LFxyXG5cdFx0XHR7IEludGVybmFsTmFtZTogJ1Bob3Rvc2hvcDZNb2ppS3VtaVNldDQnIH0sXHJcblx0XHRdLFxyXG5cdFx0VGhlTm9ybWFsU3R5bGVTaGVldDogMCxcclxuXHRcdFRoZU5vcm1hbFBhcmFncmFwaFNoZWV0OiAwLFxyXG5cdFx0UGFyYWdyYXBoU2hlZXRTZXQ6IFtcclxuXHRcdFx0e1xyXG5cdFx0XHRcdE5hbWU6ICdOb3JtYWwgUkdCJyxcclxuXHRcdFx0XHREZWZhdWx0U3R5bGVTaGVldDogMCxcclxuXHRcdFx0XHRQcm9wZXJ0aWVzOiBlbmNvZGVQYXJhZ3JhcGhTdHlsZSh7IC4uLmRlZmF1bHRQYXJhZ3JhcGhTdHlsZSwgLi4uZGF0YS5wYXJhZ3JhcGhTdHlsZSB9LCBmb250cyksXHJcblx0XHRcdH0sXHJcblx0XHRdLFxyXG5cdFx0U3R5bGVTaGVldFNldDogW1xyXG5cdFx0XHR7XHJcblx0XHRcdFx0TmFtZTogJ05vcm1hbCBSR0InLFxyXG5cdFx0XHRcdFN0eWxlU2hlZXREYXRhOiBzdHlsZVNoZWV0RGF0YSxcclxuXHRcdFx0fSxcclxuXHRcdF0sXHJcblx0XHRGb250U2V0OiBmb250cy5tYXA8Rm9udFNldD4oZiA9PiAoe1xyXG5cdFx0XHROYW1lOiBmLm5hbWUsXHJcblx0XHRcdFNjcmlwdDogZi5zY3JpcHQgfHwgMCxcclxuXHRcdFx0Rm9udFR5cGU6IGYudHlwZSB8fCAwLFxyXG5cdFx0XHRTeW50aGV0aWM6IGYuc3ludGhldGljIHx8IDAsXHJcblx0XHR9KSksXHJcblx0XHRTdXBlcnNjcmlwdFNpemU6IGRhdGEuc3VwZXJzY3JpcHRTaXplID8/IDAuNTgzLFxyXG5cdFx0U3VwZXJzY3JpcHRQb3NpdGlvbjogZGF0YS5zdXBlcnNjcmlwdFBvc2l0aW9uID8/IDAuMzMzLFxyXG5cdFx0U3Vic2NyaXB0U2l6ZTogZGF0YS5zdWJzY3JpcHRTaXplID8/IDAuNTgzLFxyXG5cdFx0U3Vic2NyaXB0UG9zaXRpb246IGRhdGEuc3Vic2NyaXB0UG9zaXRpb24gPz8gMC4zMzMsXHJcblx0XHRTbWFsbENhcFNpemU6IGRhdGEuc21hbGxDYXBTaXplID8/IDAuNyxcclxuXHR9O1xyXG5cclxuXHRjb25zdCBlbmdpbmVEYXRhOiBFbmdpbmVEYXRhID0ge1xyXG5cdFx0RW5naW5lRGljdDoge1xyXG5cdFx0XHRFZGl0b3I6IHsgVGV4dDogdGV4dCB9LFxyXG5cdFx0XHRQYXJhZ3JhcGhSdW46IHtcclxuXHRcdFx0XHREZWZhdWx0UnVuRGF0YToge1xyXG5cdFx0XHRcdFx0UGFyYWdyYXBoU2hlZXQ6IHsgRGVmYXVsdFN0eWxlU2hlZXQ6IDAsIFByb3BlcnRpZXM6IHt9IH0sXHJcblx0XHRcdFx0XHRBZGp1c3RtZW50czogeyBBeGlzOiBbMSwgMCwgMV0sIFhZOiBbMCwgMF0gfSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdFJ1bkFycmF5OiBwYXJhZ3JhcGhSdW5BcnJheSxcclxuXHRcdFx0XHRSdW5MZW5ndGhBcnJheTogcGFyYWdyYXBoUnVuTGVuZ3RoQXJyYXksXHJcblx0XHRcdFx0SXNKb2luYWJsZTogMSxcclxuXHRcdFx0fSxcclxuXHRcdFx0U3R5bGVSdW46IHtcclxuXHRcdFx0XHREZWZhdWx0UnVuRGF0YTogeyBTdHlsZVNoZWV0OiB7IFN0eWxlU2hlZXREYXRhOiB7fSB9IH0sXHJcblx0XHRcdFx0UnVuQXJyYXk6IHN0eWxlUnVuQXJyYXksXHJcblx0XHRcdFx0UnVuTGVuZ3RoQXJyYXk6IHN0eWxlUnVuTGVuZ3RoQXJyYXksXHJcblx0XHRcdFx0SXNKb2luYWJsZTogMixcclxuXHRcdFx0fSxcclxuXHRcdFx0R3JpZEluZm86IHtcclxuXHRcdFx0XHRHcmlkSXNPbjogISFncmlkSW5mby5pc09uLFxyXG5cdFx0XHRcdFNob3dHcmlkOiAhIWdyaWRJbmZvLnNob3csXHJcblx0XHRcdFx0R3JpZFNpemU6IGdyaWRJbmZvLnNpemUgPz8gMTgsXHJcblx0XHRcdFx0R3JpZExlYWRpbmc6IGdyaWRJbmZvLmxlYWRpbmcgPz8gMjIsXHJcblx0XHRcdFx0R3JpZENvbG9yOiB7IFR5cGU6IDEsIFZhbHVlczogZW5jb2RlQ29sb3IoZ3JpZEluZm8uY29sb3IpIH0sXHJcblx0XHRcdFx0R3JpZExlYWRpbmdGaWxsQ29sb3I6IHsgVHlwZTogMSwgVmFsdWVzOiBlbmNvZGVDb2xvcihncmlkSW5mby5jb2xvcikgfSxcclxuXHRcdFx0XHRBbGlnbkxpbmVIZWlnaHRUb0dyaWRGbGFnczogISFncmlkSW5mby5hbGlnbkxpbmVIZWlnaHRUb0dyaWRGbGFncyxcclxuXHRcdFx0fSxcclxuXHRcdFx0QW50aUFsaWFzOiBhbnRpYWxpYXMuaW5kZXhPZihkYXRhLmFudGlBbGlhcyA/PyAnc2hhcnAnKSxcclxuXHRcdFx0VXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzOiBkYXRhLnVzZUZyYWN0aW9uYWxHbHlwaFdpZHRocyA/PyB0cnVlLFxyXG5cdFx0XHRSZW5kZXJlZDoge1xyXG5cdFx0XHRcdFZlcnNpb246IDEsXHJcblx0XHRcdFx0U2hhcGVzOiB7XHJcblx0XHRcdFx0XHRXcml0aW5nRGlyZWN0aW9uLFxyXG5cdFx0XHRcdFx0Q2hpbGRyZW46IFtcclxuXHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFNoYXBlVHlwZSxcclxuXHRcdFx0XHRcdFx0XHRQcm9jZXNzaW9uLFxyXG5cdFx0XHRcdFx0XHRcdExpbmVzOiB7IFdyaXRpbmdEaXJlY3Rpb24sIENoaWxkcmVuOiBbXSB9LFxyXG5cdFx0XHRcdFx0XHRcdENvb2tpZTogeyBQaG90b3Nob3AgfSxcclxuXHRcdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdF0sXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0fSxcclxuXHRcdH0sXHJcblx0XHRSZXNvdXJjZURpY3Q6IHsgLi4uZGVmYXVsdFJlc291cmNlcyB9LFxyXG5cdFx0RG9jdW1lbnRSZXNvdXJjZXM6IHsgLi4uZGVmYXVsdFJlc291cmNlcyB9LFxyXG5cdH07XHJcblxyXG5cdC8vIGNvbnNvbGUubG9nKCdlbmNvZGVFbmdpbmVEYXRhJywgcmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZW5naW5lRGF0YSwgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblx0cmV0dXJuIGVuZ2luZURhdGE7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
