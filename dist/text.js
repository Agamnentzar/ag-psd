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
    var text = "".concat((data.text || '').replace(/\r?\n/g, '\r'), "\r");
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QyxFQUFFLE1BQU0sRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUMzRCxvQkFBb0IsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3RFLDBCQUEwQixFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsMEJBQTBCO2FBQ2pFO1lBQ0QsU0FBUyxFQUFFLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBQSxJQUFJLENBQUMsU0FBUyxtQ0FBSSxPQUFPLENBQUM7WUFDdkQsd0JBQXdCLEVBQUUsTUFBQSxJQUFJLENBQUMsd0JBQXdCLG1DQUFJLElBQUk7WUFDL0QsUUFBUSxFQUFFO2dCQUNULE9BQU8sRUFBRSxDQUFDO2dCQUNWLE1BQU0sRUFBRTtvQkFDUCxnQkFBZ0Isa0JBQUE7b0JBQ2hCLFFBQVEsRUFBRTt3QkFDVDs0QkFDQyxTQUFTLFdBQUE7NEJBQ1QsVUFBVSxZQUFBOzRCQUNWLEtBQUssRUFBRSxFQUFFLGdCQUFnQixrQkFBQSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7NEJBQ3pDLE1BQU0sRUFBRSxFQUFFLFNBQVMsV0FBQSxFQUFFO3lCQUNyQjtxQkFDRDtpQkFDRDthQUNEO1NBQ0Q7UUFDRCxZQUFZLGVBQU8sZ0JBQWdCLENBQUU7UUFDckMsaUJBQWlCLGVBQU8sZ0JBQWdCLENBQUU7S0FDMUMsQ0FBQztJQUVGLHlGQUF5RjtJQUN6RixPQUFPLFVBQVUsQ0FBQztBQUNuQixDQUFDO0FBMU9ELDRDQTBPQyIsImZpbGUiOiJ0ZXh0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVGV4dFN0eWxlLCBMYXllclRleHREYXRhLCBQYXJhZ3JhcGhTdHlsZSwgRm9udCwgQW50aUFsaWFzLCBUZXh0R3JpZEluZm8sIEp1c3RpZmljYXRpb24sIENvbG9yIH0gZnJvbSAnLi9wc2QnO1xyXG5cclxuaW50ZXJmYWNlIEFkanVzdG1lbnRzIHtcclxuXHRBeGlzOiBudW1iZXJbXTtcclxuXHRYWTogbnVtYmVyW107XHJcbn1cclxuXHJcbmludGVyZmFjZSBUeXBlVmFsdWVzIHtcclxuXHRUeXBlOiBudW1iZXI7XHJcblx0VmFsdWVzOiBudW1iZXJbXTtcclxufVxyXG5cclxuaW50ZXJmYWNlIFBhcmFncmFwaFByb3BlcnRpZXMge1xyXG5cdEp1c3RpZmljYXRpb24/OiBudW1iZXI7XHJcblx0Rmlyc3RMaW5lSW5kZW50PzogbnVtYmVyO1xyXG5cdFN0YXJ0SW5kZW50PzogbnVtYmVyO1xyXG5cdEVuZEluZGVudD86IG51bWJlcjtcclxuXHRTcGFjZUJlZm9yZT86IG51bWJlcjtcclxuXHRTcGFjZUFmdGVyPzogbnVtYmVyO1xyXG5cdEF1dG9IeXBoZW5hdGU/OiBib29sZWFuO1xyXG5cdEh5cGhlbmF0ZWRXb3JkU2l6ZT86IG51bWJlcjtcclxuXHRQcmVIeXBoZW4/OiBudW1iZXI7XHJcblx0UG9zdEh5cGhlbj86IG51bWJlcjtcclxuXHRDb25zZWN1dGl2ZUh5cGhlbnM/OiBudW1iZXI7XHJcblx0Wm9uZT86IG51bWJlcjtcclxuXHRXb3JkU3BhY2luZz86IG51bWJlcltdO1xyXG5cdExldHRlclNwYWNpbmc/OiBudW1iZXJbXTtcclxuXHRHbHlwaFNwYWNpbmc/OiBudW1iZXJbXTtcclxuXHRBdXRvTGVhZGluZz86IG51bWJlcjtcclxuXHRMZWFkaW5nVHlwZT86IG51bWJlcjtcclxuXHRIYW5naW5nPzogYm9vbGVhbjtcclxuXHRCdXJhc2FnYXJpPzogYm9vbGVhbjtcclxuXHRLaW5zb2t1T3JkZXI/OiBudW1iZXI7XHJcblx0RXZlcnlMaW5lQ29tcG9zZXI/OiBib29sZWFuO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUGFyYWdyYXBoU2hlZXQge1xyXG5cdE5hbWU/OiBzdHJpbmc7XHJcblx0RGVmYXVsdFN0eWxlU2hlZXQ6IG51bWJlcjtcclxuXHRQcm9wZXJ0aWVzOiBQYXJhZ3JhcGhQcm9wZXJ0aWVzO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgU3R5bGVTaGVldERhdGEge1xyXG5cdEZvbnQ/OiBudW1iZXI7XHJcblx0Rm9udFNpemU/OiBudW1iZXI7XHJcblx0RmF1eEJvbGQ/OiBib29sZWFuO1xyXG5cdEZhdXhJdGFsaWM/OiBib29sZWFuO1xyXG5cdEF1dG9MZWFkaW5nPzogYm9vbGVhbjtcclxuXHRMZWFkaW5nPzogbnVtYmVyO1xyXG5cdEhvcml6b250YWxTY2FsZT86IG51bWJlcjtcclxuXHRWZXJ0aWNhbFNjYWxlPzogbnVtYmVyO1xyXG5cdFRyYWNraW5nPzogbnVtYmVyO1xyXG5cdEF1dG9LZXJuaW5nPzogYm9vbGVhbjtcclxuXHRLZXJuaW5nPzogbnVtYmVyO1xyXG5cdEJhc2VsaW5lU2hpZnQ/OiBudW1iZXI7XHJcblx0Rm9udENhcHM/OiBudW1iZXI7XHJcblx0Rm9udEJhc2VsaW5lPzogbnVtYmVyO1xyXG5cdFVuZGVybGluZT86IGJvb2xlYW47XHJcblx0U3RyaWtldGhyb3VnaD86IGJvb2xlYW47XHJcblx0TGlnYXR1cmVzPzogYm9vbGVhbjtcclxuXHRETGlnYXR1cmVzPzogYm9vbGVhbjtcclxuXHRCYXNlbGluZURpcmVjdGlvbj86IG51bWJlcjtcclxuXHRUc3VtZT86IG51bWJlcjtcclxuXHRTdHlsZVJ1bkFsaWdubWVudD86IG51bWJlcjtcclxuXHRMYW5ndWFnZT86IG51bWJlcjtcclxuXHROb0JyZWFrPzogYm9vbGVhbjtcclxuXHRGaWxsQ29sb3I/OiBUeXBlVmFsdWVzO1xyXG5cdFN0cm9rZUNvbG9yPzogVHlwZVZhbHVlcztcclxuXHRGaWxsRmxhZz86IGJvb2xlYW47XHJcblx0U3Ryb2tlRmxhZz86IGJvb2xlYW47XHJcblx0RmlsbEZpcnN0PzogYm9vbGVhbjtcclxuXHRZVW5kZXJsaW5lPzogbnVtYmVyO1xyXG5cdE91dGxpbmVXaWR0aD86IG51bWJlcjtcclxuXHRDaGFyYWN0ZXJEaXJlY3Rpb24/OiBudW1iZXI7XHJcblx0SGluZGlOdW1iZXJzPzogYm9vbGVhbjtcclxuXHRLYXNoaWRhPzogbnVtYmVyO1xyXG5cdERpYWNyaXRpY1Bvcz86IG51bWJlcjtcclxufVxyXG5cclxuaW50ZXJmYWNlIEZvbnRTZXQge1xyXG5cdE5hbWU6IHN0cmluZztcclxuXHRTY3JpcHQ6IG51bWJlcjtcclxuXHRGb250VHlwZTogbnVtYmVyO1xyXG5cdFN5bnRoZXRpYzogbnVtYmVyO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgUmVzb3VyY2VEaWN0IHtcclxuXHRLaW5zb2t1U2V0OiBhbnlbXTtcclxuXHRNb2ppS3VtaVNldDogYW55W107XHJcblx0VGhlTm9ybWFsU3R5bGVTaGVldDogbnVtYmVyO1xyXG5cdFRoZU5vcm1hbFBhcmFncmFwaFNoZWV0OiBudW1iZXI7XHJcblx0UGFyYWdyYXBoU2hlZXRTZXQ6IFBhcmFncmFwaFNoZWV0W107XHJcblx0U3R5bGVTaGVldFNldDogeyBOYW1lOiBzdHJpbmc7IFN0eWxlU2hlZXREYXRhOiBTdHlsZVNoZWV0RGF0YTsgfVtdO1xyXG5cdEZvbnRTZXQ6IEZvbnRTZXRbXTtcclxuXHRTdXBlcnNjcmlwdFNpemU6IG51bWJlcjtcclxuXHRTdXBlcnNjcmlwdFBvc2l0aW9uOiBudW1iZXI7XHJcblx0U3Vic2NyaXB0U2l6ZTogbnVtYmVyO1xyXG5cdFN1YnNjcmlwdFBvc2l0aW9uOiBudW1iZXI7XHJcblx0U21hbGxDYXBTaXplOiBudW1iZXI7XHJcbn1cclxuXHJcbmludGVyZmFjZSBQYXJhZ3JhcGhSdW4ge1xyXG5cdFBhcmFncmFwaFNoZWV0OiBQYXJhZ3JhcGhTaGVldDtcclxuXHRBZGp1c3RtZW50czogQWRqdXN0bWVudHM7XHJcbn1cclxuXHJcbmludGVyZmFjZSBTdHlsZVJ1biB7XHJcblx0U3R5bGVTaGVldDogeyBTdHlsZVNoZWV0RGF0YTogU3R5bGVTaGVldERhdGE7IH07XHJcbn1cclxuXHJcbmludGVyZmFjZSBQaG90b3Nob3BOb2RlIHtcclxuXHRTaGFwZVR5cGU/OiBudW1iZXI7XHJcblx0UG9pbnRCYXNlPzogbnVtYmVyW107XHJcblx0Qm94Qm91bmRzPzogbnVtYmVyW107XHJcblx0QmFzZT86IHtcclxuXHRcdFNoYXBlVHlwZTogbnVtYmVyO1xyXG5cdFx0VHJhbnNmb3JtUG9pbnQwOiBudW1iZXJbXTtcclxuXHRcdFRyYW5zZm9ybVBvaW50MTogbnVtYmVyW107XHJcblx0XHRUcmFuc2Zvcm1Qb2ludDI6IG51bWJlcltdO1xyXG5cdH07XHJcbn1cclxuXHJcbmludGVyZmFjZSBFbmdpbmVEYXRhIHtcclxuXHRFbmdpbmVEaWN0OiB7XHJcblx0XHRFZGl0b3I6IHsgVGV4dDogc3RyaW5nOyB9O1xyXG5cdFx0UGFyYWdyYXBoUnVuOiB7XHJcblx0XHRcdERlZmF1bHRSdW5EYXRhOiBQYXJhZ3JhcGhSdW47XHJcblx0XHRcdFJ1bkFycmF5OiBQYXJhZ3JhcGhSdW5bXTtcclxuXHRcdFx0UnVuTGVuZ3RoQXJyYXk6IG51bWJlcltdO1xyXG5cdFx0XHRJc0pvaW5hYmxlOiBudW1iZXI7XHJcblx0XHR9O1xyXG5cdFx0U3R5bGVSdW46IHtcclxuXHRcdFx0RGVmYXVsdFJ1bkRhdGE6IFN0eWxlUnVuO1xyXG5cdFx0XHRSdW5BcnJheTogU3R5bGVSdW5bXTtcclxuXHRcdFx0UnVuTGVuZ3RoQXJyYXk6IG51bWJlcltdO1xyXG5cdFx0XHRJc0pvaW5hYmxlOiBudW1iZXI7XHJcblx0XHR9O1xyXG5cdFx0R3JpZEluZm86IHtcclxuXHRcdFx0R3JpZElzT246IGJvb2xlYW47XHJcblx0XHRcdFNob3dHcmlkOiBib29sZWFuO1xyXG5cdFx0XHRHcmlkU2l6ZTogbnVtYmVyO1xyXG5cdFx0XHRHcmlkTGVhZGluZzogbnVtYmVyO1xyXG5cdFx0XHRHcmlkQ29sb3I6IFR5cGVWYWx1ZXM7XHJcblx0XHRcdEdyaWRMZWFkaW5nRmlsbENvbG9yOiBUeXBlVmFsdWVzO1xyXG5cdFx0XHRBbGlnbkxpbmVIZWlnaHRUb0dyaWRGbGFnczogYm9vbGVhbjtcclxuXHRcdH07XHJcblx0XHRBbnRpQWxpYXM6IG51bWJlcjtcclxuXHRcdFVzZUZyYWN0aW9uYWxHbHlwaFdpZHRoczogYm9vbGVhbjtcclxuXHRcdFJlbmRlcmVkPzoge1xyXG5cdFx0XHRWZXJzaW9uOiBudW1iZXI7XHJcblx0XHRcdFNoYXBlcz86IHtcclxuXHRcdFx0XHRXcml0aW5nRGlyZWN0aW9uOiBudW1iZXI7XHJcblx0XHRcdFx0Q2hpbGRyZW4/OiB7XHJcblx0XHRcdFx0XHRTaGFwZVR5cGU/OiBudW1iZXI7XHJcblx0XHRcdFx0XHRQcm9jZXNzaW9uOiBudW1iZXI7XHJcblx0XHRcdFx0XHRMaW5lczogeyBXcml0aW5nRGlyZWN0aW9uOiBudW1iZXI7IENoaWxkcmVuOiBhbnlbXTsgfTtcclxuXHRcdFx0XHRcdENvb2tpZT86IHtcclxuXHRcdFx0XHRcdFx0UGhvdG9zaG9wPzogUGhvdG9zaG9wTm9kZTtcclxuXHRcdFx0XHRcdH07XHJcblx0XHRcdFx0fVtdO1xyXG5cdFx0XHR9O1xyXG5cdFx0fTtcclxuXHR9O1xyXG5cdFJlc291cmNlRGljdDogUmVzb3VyY2VEaWN0O1xyXG5cdERvY3VtZW50UmVzb3VyY2VzOiBSZXNvdXJjZURpY3Q7XHJcbn1cclxuXHJcbmNvbnN0IGRlZmF1bHRGb250OiBGb250ID0ge1xyXG5cdG5hbWU6ICdNeXJpYWRQcm8tUmVndWxhcicsXHJcblx0c2NyaXB0OiAwLFxyXG5cdHR5cGU6IDAsXHJcblx0c3ludGhldGljOiAwLFxyXG59O1xyXG5cclxuY29uc3QgZGVmYXVsdFBhcmFncmFwaFN0eWxlOiBQYXJhZ3JhcGhTdHlsZSA9IHtcclxuXHRqdXN0aWZpY2F0aW9uOiAnbGVmdCcsXHJcblx0Zmlyc3RMaW5lSW5kZW50OiAwLFxyXG5cdHN0YXJ0SW5kZW50OiAwLFxyXG5cdGVuZEluZGVudDogMCxcclxuXHRzcGFjZUJlZm9yZTogMCxcclxuXHRzcGFjZUFmdGVyOiAwLFxyXG5cdGF1dG9IeXBoZW5hdGU6IHRydWUsXHJcblx0aHlwaGVuYXRlZFdvcmRTaXplOiA2LFxyXG5cdHByZUh5cGhlbjogMixcclxuXHRwb3N0SHlwaGVuOiAyLFxyXG5cdGNvbnNlY3V0aXZlSHlwaGVuczogOCxcclxuXHR6b25lOiAzNixcclxuXHR3b3JkU3BhY2luZzogWzAuOCwgMSwgMS4zM10sXHJcblx0bGV0dGVyU3BhY2luZzogWzAsIDAsIDBdLFxyXG5cdGdseXBoU3BhY2luZzogWzEsIDEsIDFdLFxyXG5cdGF1dG9MZWFkaW5nOiAxLjIsXHJcblx0bGVhZGluZ1R5cGU6IDAsXHJcblx0aGFuZ2luZzogZmFsc2UsXHJcblx0YnVyYXNhZ2FyaTogZmFsc2UsXHJcblx0a2luc29rdU9yZGVyOiAwLFxyXG5cdGV2ZXJ5TGluZUNvbXBvc2VyOiBmYWxzZSxcclxufTtcclxuXHJcbmNvbnN0IGRlZmF1bHRTdHlsZTogVGV4dFN0eWxlID0ge1xyXG5cdGZvbnQ6IGRlZmF1bHRGb250LFxyXG5cdGZvbnRTaXplOiAxMixcclxuXHRmYXV4Qm9sZDogZmFsc2UsXHJcblx0ZmF1eEl0YWxpYzogZmFsc2UsXHJcblx0YXV0b0xlYWRpbmc6IHRydWUsXHJcblx0bGVhZGluZzogMCxcclxuXHRob3Jpem9udGFsU2NhbGU6IDEsXHJcblx0dmVydGljYWxTY2FsZTogMSxcclxuXHR0cmFja2luZzogMCxcclxuXHRhdXRvS2VybmluZzogdHJ1ZSxcclxuXHRrZXJuaW5nOiAwLFxyXG5cdGJhc2VsaW5lU2hpZnQ6IDAsXHJcblx0Zm9udENhcHM6IDAsXHJcblx0Zm9udEJhc2VsaW5lOiAwLFxyXG5cdHVuZGVybGluZTogZmFsc2UsXHJcblx0c3RyaWtldGhyb3VnaDogZmFsc2UsXHJcblx0bGlnYXR1cmVzOiB0cnVlLFxyXG5cdGRMaWdhdHVyZXM6IGZhbHNlLFxyXG5cdGJhc2VsaW5lRGlyZWN0aW9uOiAyLFxyXG5cdHRzdW1lOiAwLFxyXG5cdHN0eWxlUnVuQWxpZ25tZW50OiAyLFxyXG5cdGxhbmd1YWdlOiAwLFxyXG5cdG5vQnJlYWs6IGZhbHNlLFxyXG5cdGZpbGxDb2xvcjogeyByOiAwLCBnOiAwLCBiOiAwIH0sXHJcblx0c3Ryb2tlQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMCB9LFxyXG5cdGZpbGxGbGFnOiB0cnVlLFxyXG5cdHN0cm9rZUZsYWc6IGZhbHNlLFxyXG5cdGZpbGxGaXJzdDogdHJ1ZSxcclxuXHR5VW5kZXJsaW5lOiAxLFxyXG5cdG91dGxpbmVXaWR0aDogMSxcclxuXHRjaGFyYWN0ZXJEaXJlY3Rpb246IDAsXHJcblx0aGluZGlOdW1iZXJzOiBmYWxzZSxcclxuXHRrYXNoaWRhOiAxLFxyXG5cdGRpYWNyaXRpY1BvczogMixcclxufTtcclxuXHJcbmNvbnN0IGRlZmF1bHRHcmlkSW5mbzogVGV4dEdyaWRJbmZvID0ge1xyXG5cdGlzT246IGZhbHNlLFxyXG5cdHNob3c6IGZhbHNlLFxyXG5cdHNpemU6IDE4LFxyXG5cdGxlYWRpbmc6IDIyLFxyXG5cdGNvbG9yOiB7IHI6IDAsIGc6IDAsIGI6IDI1NSB9LFxyXG5cdGxlYWRpbmdGaWxsQ29sb3I6IHsgcjogMCwgZzogMCwgYjogMjU1IH0sXHJcblx0YWxpZ25MaW5lSGVpZ2h0VG9HcmlkRmxhZ3M6IGZhbHNlLFxyXG59O1xyXG5cclxuY29uc3QgcGFyYWdyYXBoU3R5bGVLZXlzOiAoa2V5b2YgUGFyYWdyYXBoU3R5bGUpW10gPSBbXHJcblx0J2p1c3RpZmljYXRpb24nLCAnZmlyc3RMaW5lSW5kZW50JywgJ3N0YXJ0SW5kZW50JywgJ2VuZEluZGVudCcsICdzcGFjZUJlZm9yZScsICdzcGFjZUFmdGVyJyxcclxuXHQnYXV0b0h5cGhlbmF0ZScsICdoeXBoZW5hdGVkV29yZFNpemUnLCAncHJlSHlwaGVuJywgJ3Bvc3RIeXBoZW4nLCAnY29uc2VjdXRpdmVIeXBoZW5zJyxcclxuXHQnem9uZScsICd3b3JkU3BhY2luZycsICdsZXR0ZXJTcGFjaW5nJywgJ2dseXBoU3BhY2luZycsICdhdXRvTGVhZGluZycsICdsZWFkaW5nVHlwZScsXHJcblx0J2hhbmdpbmcnLCAnYnVyYXNhZ2FyaScsICdraW5zb2t1T3JkZXInLCAnZXZlcnlMaW5lQ29tcG9zZXInLFxyXG5dO1xyXG5cclxuY29uc3Qgc3R5bGVLZXlzOiAoa2V5b2YgVGV4dFN0eWxlKVtdID0gW1xyXG5cdCdmb250JywgJ2ZvbnRTaXplJywgJ2ZhdXhCb2xkJywgJ2ZhdXhJdGFsaWMnLCAnYXV0b0xlYWRpbmcnLCAnbGVhZGluZycsICdob3Jpem9udGFsU2NhbGUnLFxyXG5cdCd2ZXJ0aWNhbFNjYWxlJywgJ3RyYWNraW5nJywgJ2F1dG9LZXJuaW5nJywgJ2tlcm5pbmcnLCAnYmFzZWxpbmVTaGlmdCcsICdmb250Q2FwcycsICdmb250QmFzZWxpbmUnLFxyXG5cdCd1bmRlcmxpbmUnLCAnc3RyaWtldGhyb3VnaCcsICdsaWdhdHVyZXMnLCAnZExpZ2F0dXJlcycsICdiYXNlbGluZURpcmVjdGlvbicsICd0c3VtZScsXHJcblx0J3N0eWxlUnVuQWxpZ25tZW50JywgJ2xhbmd1YWdlJywgJ25vQnJlYWsnLCAnZmlsbENvbG9yJywgJ3N0cm9rZUNvbG9yJywgJ2ZpbGxGbGFnJyxcclxuXHQnc3Ryb2tlRmxhZycsICdmaWxsRmlyc3QnLCAneVVuZGVybGluZScsICdvdXRsaW5lV2lkdGgnLCAnY2hhcmFjdGVyRGlyZWN0aW9uJywgJ2hpbmRpTnVtYmVycycsXHJcblx0J2thc2hpZGEnLCAnZGlhY3JpdGljUG9zJyxcclxuXTtcclxuXHJcbmNvbnN0IGFudGlhbGlhczogQW50aUFsaWFzW10gPSBbJ25vbmUnLCAnY3Jpc3AnLCAnc3Ryb25nJywgJ3Ntb290aCcsICdzaGFycCddO1xyXG5jb25zdCBqdXN0aWZpY2F0aW9uOiBKdXN0aWZpY2F0aW9uW10gPSBbJ2xlZnQnLCAncmlnaHQnLCAnY2VudGVyJ107XHJcblxyXG5mdW5jdGlvbiB1cHBlckZpcnN0KHZhbHVlOiBzdHJpbmcpIHtcclxuXHRyZXR1cm4gdmFsdWUuc3Vic3RyKDAsIDEpLnRvVXBwZXJDYXNlKCkgKyB2YWx1ZS5zdWJzdHIoMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGRlY29kZUNvbG9yKGNvbG9yOiB7IFR5cGU6IG51bWJlcjsgVmFsdWVzOiBudW1iZXJbXTsgfSk6IENvbG9yIHtcclxuXHRjb25zdCBjID0gY29sb3IuVmFsdWVzO1xyXG5cclxuXHRpZiAoY29sb3IuVHlwZSA9PT0gMCkgeyAvLyBncmF5c2NhbGVcclxuXHRcdHJldHVybiB7IHI6IGNbMV0gKiAyNTUsIGc6IGNbMV0gKiAyNTUsIGI6IGNbMV0gKiAyNTUgfTsgLy8gLCBjWzBdICogMjU1XTtcclxuXHR9IGVsc2UgeyAvLyByZ2JcclxuXHRcdHJldHVybiB7IHI6IGNbMV0gKiAyNTUsIGc6IGNbMl0gKiAyNTUsIGI6IGNbM10gKiAyNTUsIGE6IGNbMF0gfTsgLy8gLCBjWzBdICogMjU1XTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVuY29kZUNvbG9yKGNvbG9yOiBDb2xvciB8IHVuZGVmaW5lZCkge1xyXG5cdGlmIChjb2xvciAmJiAncicgaW4gY29sb3IpIHtcclxuXHRcdHJldHVybiBbJ2EnIGluIGNvbG9yID8gY29sb3IuYSA6IDEsIGNvbG9yLnIgLyAyNTUsIGNvbG9yLmcgLyAyNTUsIGNvbG9yLmIgLyAyNTVdO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gWzAsIDAsIDAsIDBdO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gYXJyYXlzRXF1YWwoYTogYW55W10sIGI6IGFueVtdKSB7XHJcblx0aWYgKCFhIHx8ICFiKSByZXR1cm4gZmFsc2U7XHJcblx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gb2JqZWN0c0VxdWFsKGE6IGFueSwgYjogYW55KSB7XHJcblx0aWYgKCFhIHx8ICFiKSByZXR1cm4gZmFsc2U7XHJcblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoYSkpIGlmIChhW2tleV0gIT09IGJba2V5XSkgcmV0dXJuIGZhbHNlO1xyXG5cdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGIpKSBpZiAoYVtrZXldICE9PSBiW2tleV0pIHJldHVybiBmYWxzZTtcclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZmluZE9yQWRkRm9udChmb250czogRm9udFtdLCBmb250OiBGb250KSB7XHJcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmb250cy5sZW5ndGg7IGkrKykge1xyXG5cdFx0aWYgKGZvbnRzW2ldLm5hbWUgPT09IGZvbnQubmFtZSkgcmV0dXJuIGk7XHJcblx0fVxyXG5cclxuXHRmb250cy5wdXNoKGZvbnQpO1xyXG5cdHJldHVybiBmb250cy5sZW5ndGggLSAxO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVPYmplY3Qob2JqOiBhbnksIGtleXM6IHN0cmluZ1tdLCBmb250czogRm9udFtdKSB7XHJcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xyXG5cdFx0Y29uc3QgS2V5ID0gdXBwZXJGaXJzdChrZXkpO1xyXG5cclxuXHRcdGlmIChvYmpbS2V5XSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZTtcclxuXHJcblx0XHRpZiAoa2V5ID09PSAnanVzdGlmaWNhdGlvbicpIHtcclxuXHRcdFx0cmVzdWx0W2tleV0gPSBqdXN0aWZpY2F0aW9uW29ialtLZXldXTtcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnZm9udCcpIHtcclxuXHRcdFx0cmVzdWx0W2tleV0gPSBmb250c1tvYmpbS2V5XV07XHJcblx0XHR9IGVsc2UgaWYgKGtleSA9PT0gJ2ZpbGxDb2xvcicgfHwga2V5ID09PSAnc3Ryb2tlQ29sb3InKSB7XHJcblx0XHRcdHJlc3VsdFtrZXldID0gZGVjb2RlQ29sb3Iob2JqW0tleV0pO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmVzdWx0W2tleV0gPSBvYmpbS2V5XTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVuY29kZU9iamVjdChvYmo6IGFueSwga2V5czogc3RyaW5nW10sIGZvbnRzOiBGb250W10pIHtcclxuXHRjb25zdCByZXN1bHQ6IGFueSA9IHt9O1xyXG5cclxuXHRmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XHJcblx0XHRjb25zdCBLZXkgPSB1cHBlckZpcnN0KGtleSk7XHJcblxyXG5cdFx0aWYgKG9ialtrZXldID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xyXG5cclxuXHRcdGlmIChrZXkgPT09ICdqdXN0aWZpY2F0aW9uJykge1xyXG5cdFx0XHRyZXN1bHRbS2V5XSA9IGp1c3RpZmljYXRpb24uaW5kZXhPZihvYmpba2V5XSA/PyAnbGVmdCcpO1xyXG5cdFx0fSBlbHNlIGlmIChrZXkgPT09ICdmb250Jykge1xyXG5cdFx0XHRyZXN1bHRbS2V5XSA9IGZpbmRPckFkZEZvbnQoZm9udHMsIG9ialtrZXldKTtcclxuXHRcdH0gZWxzZSBpZiAoa2V5ID09PSAnZmlsbENvbG9yJyB8fCBrZXkgPT09ICdzdHJva2VDb2xvcicpIHtcclxuXHRcdFx0cmVzdWx0W0tleV0gPSB7IFR5cGU6IDEsIFZhbHVlczogZW5jb2RlQ29sb3Iob2JqW2tleV0pIH0gYXMgVHlwZVZhbHVlcztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJlc3VsdFtLZXldID0gb2JqW2tleV07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVQYXJhZ3JhcGhTdHlsZShvYmo6IFBhcmFncmFwaFByb3BlcnRpZXMsIGZvbnRzOiBGb250W10pOiBQYXJhZ3JhcGhTdHlsZSB7XHJcblx0cmV0dXJuIGRlY29kZU9iamVjdChvYmosIHBhcmFncmFwaFN0eWxlS2V5cywgZm9udHMpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVTdHlsZShvYmo6IFN0eWxlU2hlZXREYXRhLCBmb250czogRm9udFtdKTogVGV4dFN0eWxlIHtcclxuXHRyZXR1cm4gZGVjb2RlT2JqZWN0KG9iaiwgc3R5bGVLZXlzLCBmb250cyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVuY29kZVBhcmFncmFwaFN0eWxlKG9iajogUGFyYWdyYXBoU3R5bGUsIGZvbnRzOiBGb250W10pOiBQYXJhZ3JhcGhQcm9wZXJ0aWVzIHtcclxuXHRyZXR1cm4gZW5jb2RlT2JqZWN0KG9iaiwgcGFyYWdyYXBoU3R5bGVLZXlzLCBmb250cyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVuY29kZVN0eWxlKG9iajogVGV4dFN0eWxlLCBmb250czogRm9udFtdKTogU3R5bGVTaGVldERhdGEge1xyXG5cdHJldHVybiBlbmNvZGVPYmplY3Qob2JqLCBzdHlsZUtleXMsIGZvbnRzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVkdXBsaWNhdGVWYWx1ZXM8VD4oYmFzZTogVCwgcnVuczogeyBzdHlsZTogVDsgfVtdLCBrZXlzOiAoa2V5b2YgVClbXSkge1xyXG5cdGlmICghcnVucy5sZW5ndGgpIHJldHVybjtcclxuXHJcblx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xyXG5cdFx0Y29uc3QgdmFsdWUgPSBydW5zWzBdLnN0eWxlW2tleV07XHJcblxyXG5cdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0bGV0IGlkZW50aWNhbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcblx0XHRcdFx0aWRlbnRpY2FsID0gcnVucy5ldmVyeShyID0+IGFycmF5c0VxdWFsKHIuc3R5bGVba2V5XSBhcyBhbnksIHZhbHVlKSk7XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xyXG5cdFx0XHRcdGlkZW50aWNhbCA9IHJ1bnMuZXZlcnkociA9PiBvYmplY3RzRXF1YWwoci5zdHlsZVtrZXldIGFzIGFueSwgdmFsdWUpKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpZGVudGljYWwgPSBydW5zLmV2ZXJ5KHIgPT4gci5zdHlsZVtrZXldID09PSB2YWx1ZSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmIChpZGVudGljYWwpIHtcclxuXHRcdFx0XHRiYXNlW2tleV0gPSB2YWx1ZSBhcyBhbnk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBzdHlsZVZhbHVlID0gYmFzZVtrZXldO1xyXG5cclxuXHRcdGlmIChzdHlsZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0Zm9yIChjb25zdCByIG9mIHJ1bnMpIHtcclxuXHRcdFx0XHRsZXQgc2FtZSA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuXHRcdFx0XHRcdHNhbWUgPSBhcnJheXNFcXVhbChyLnN0eWxlW2tleV0gYXMgYW55LCB2YWx1ZSk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XHJcblx0XHRcdFx0XHRzYW1lID0gb2JqZWN0c0VxdWFsKHIuc3R5bGVba2V5XSBhcyBhbnksIHZhbHVlKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0c2FtZSA9IHIuc3R5bGVba2V5XSA9PT0gdmFsdWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoc2FtZSkgZGVsZXRlIHIuc3R5bGVba2V5XTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKHJ1bnMuZXZlcnkoeCA9PiBPYmplY3Qua2V5cyh4LnN0eWxlKS5sZW5ndGggPT09IDApKSB7XHJcblx0XHRydW5zLmxlbmd0aCA9IDA7XHJcblx0fVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlRW5naW5lRGF0YShlbmdpbmVEYXRhOiBFbmdpbmVEYXRhKSB7XHJcblx0Ly8gY29uc29sZS5sb2coJ2VuZ2luZURhdGEnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRjb25zdCBlbmdpbmVEaWN0ID0gZW5naW5lRGF0YS5FbmdpbmVEaWN0O1xyXG5cdGNvbnN0IHJlc291cmNlRGljdCA9IGVuZ2luZURhdGEuUmVzb3VyY2VEaWN0O1xyXG5cclxuXHRjb25zdCBmb250cyA9IHJlc291cmNlRGljdC5Gb250U2V0Lm1hcDxGb250PihmID0+ICh7XHJcblx0XHRuYW1lOiBmLk5hbWUsXHJcblx0XHRzY3JpcHQ6IGYuU2NyaXB0LFxyXG5cdFx0dHlwZTogZi5Gb250VHlwZSxcclxuXHRcdHN5bnRoZXRpYzogZi5TeW50aGV0aWMsXHJcblx0fSkpO1xyXG5cclxuXHRsZXQgdGV4dCA9IGVuZ2luZURpY3QuRWRpdG9yLlRleHQucmVwbGFjZSgvXFxyL2csICdcXG4nKTtcclxuXHRsZXQgcmVtb3ZlZENoYXJhY3RlcnMgPSAwO1xyXG5cclxuXHR3aGlsZSAoL1xcbiQvLnRlc3QodGV4dCkpIHtcclxuXHRcdHRleHQgPSB0ZXh0LnN1YnN0cigwLCB0ZXh0Lmxlbmd0aCAtIDEpO1xyXG5cdFx0cmVtb3ZlZENoYXJhY3RlcnMrKztcclxuXHR9XHJcblxyXG5cdGNvbnN0IHJlc3VsdDogTGF5ZXJUZXh0RGF0YSA9IHtcclxuXHRcdHRleHQsXHJcblx0XHRhbnRpQWxpYXM6IGFudGlhbGlhc1tlbmdpbmVEaWN0LkFudGlBbGlhc10gPz8gJ3Ntb290aCcsXHJcblx0XHR1c2VGcmFjdGlvbmFsR2x5cGhXaWR0aHM6ICEhZW5naW5lRGljdC5Vc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHMsXHJcblx0XHRzdXBlcnNjcmlwdFNpemU6IHJlc291cmNlRGljdC5TdXBlcnNjcmlwdFNpemUsXHJcblx0XHRzdXBlcnNjcmlwdFBvc2l0aW9uOiByZXNvdXJjZURpY3QuU3VwZXJzY3JpcHRQb3NpdGlvbixcclxuXHRcdHN1YnNjcmlwdFNpemU6IHJlc291cmNlRGljdC5TdWJzY3JpcHRTaXplLFxyXG5cdFx0c3Vic2NyaXB0UG9zaXRpb246IHJlc291cmNlRGljdC5TdWJzY3JpcHRQb3NpdGlvbixcclxuXHRcdHNtYWxsQ2FwU2l6ZTogcmVzb3VyY2VEaWN0LlNtYWxsQ2FwU2l6ZSxcclxuXHR9O1xyXG5cclxuXHQvLyBzaGFwZVxyXG5cclxuXHRjb25zdCBwaG90b3Nob3AgPSBlbmdpbmVEaWN0LlJlbmRlcmVkPy5TaGFwZXM/LkNoaWxkcmVuPy5bMF0/LkNvb2tpZT8uUGhvdG9zaG9wO1xyXG5cclxuXHRpZiAocGhvdG9zaG9wKSB7XHJcblx0XHRyZXN1bHQuc2hhcGVUeXBlID0gcGhvdG9zaG9wLlNoYXBlVHlwZSA9PT0gMSA/ICdib3gnIDogJ3BvaW50JztcclxuXHRcdGlmIChwaG90b3Nob3AuUG9pbnRCYXNlKSByZXN1bHQucG9pbnRCYXNlID0gcGhvdG9zaG9wLlBvaW50QmFzZTtcclxuXHRcdGlmIChwaG90b3Nob3AuQm94Qm91bmRzKSByZXN1bHQuYm94Qm91bmRzID0gcGhvdG9zaG9wLkJveEJvdW5kcztcclxuXHR9XHJcblxyXG5cdC8vIHBhcmFncmFwaCBzdHlsZVxyXG5cclxuXHQvLyBjb25zdCB0aGVOb3JtYWxQYXJhZ3JhcGhTaGVldCA9IHJlc291cmNlRGljdC5UaGVOb3JtYWxQYXJhZ3JhcGhTaGVldDtcclxuXHQvLyBjb25zdCBwYXJhZ3JhcGhTaGVldFNldCA9IHJlc291cmNlRGljdC5QYXJhZ3JhcGhTaGVldFNldDtcclxuXHQvLyBjb25zdCBwYXJhZ3JhcGhQcm9wZXJ0aWVzID0gcGFyYWdyYXBoU2hlZXRTZXRbdGhlTm9ybWFsUGFyYWdyYXBoU2hlZXRdLlByb3BlcnRpZXM7XHJcblx0Y29uc3QgcGFyYWdyYXBoUnVuID0gZW5naW5lRGF0YS5FbmdpbmVEaWN0LlBhcmFncmFwaFJ1bjtcclxuXHJcblx0cmVzdWx0LnBhcmFncmFwaFN0eWxlID0ge307IC8vIGRlY29kZVBhcmFncmFwaFN0eWxlKHBhcmFncmFwaFByb3BlcnRpZXMsIGZvbnRzKTtcclxuXHRyZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zID0gW107XHJcblxyXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYWdyYXBoUnVuLlJ1bkFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRjb25zdCBydW4gPSBwYXJhZ3JhcGhSdW4uUnVuQXJyYXlbaV07XHJcblx0XHRjb25zdCBsZW5ndGggPSBwYXJhZ3JhcGhSdW4uUnVuTGVuZ3RoQXJyYXlbaV07XHJcblx0XHRjb25zdCBzdHlsZSA9IGRlY29kZVBhcmFncmFwaFN0eWxlKHJ1bi5QYXJhZ3JhcGhTaGVldC5Qcm9wZXJ0aWVzLCBmb250cyk7XHJcblx0XHQvLyBjb25zdCBhZGp1c3RtZW50cyA9IHtcclxuXHRcdC8vICAgYXhpczogcnVuLkFkanVzdG1lbnRzLkF4aXMsXHJcblx0XHQvLyAgIHh5OiBydW4uQWRqdXN0bWVudHMuWFksXHJcblx0XHQvLyB9O1xyXG5cdFx0cmVzdWx0LnBhcmFncmFwaFN0eWxlUnVucy5wdXNoKHsgbGVuZ3RoLCBzdHlsZS8qLCBhZGp1c3RtZW50cyovIH0pO1xyXG5cdH1cclxuXHJcblx0Zm9yIChsZXQgY291bnRlciA9IHJlbW92ZWRDaGFyYWN0ZXJzOyByZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zLmxlbmd0aCAmJiBjb3VudGVyID4gMDsgY291bnRlci0tKSB7XHJcblx0XHRpZiAoLS1yZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zW3Jlc3VsdC5wYXJhZ3JhcGhTdHlsZVJ1bnMubGVuZ3RoIC0gMV0ubGVuZ3RoID09PSAwKSB7XHJcblx0XHRcdHJlc3VsdC5wYXJhZ3JhcGhTdHlsZVJ1bnMucG9wKCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRkZWR1cGxpY2F0ZVZhbHVlcyhyZXN1bHQucGFyYWdyYXBoU3R5bGUsIHJlc3VsdC5wYXJhZ3JhcGhTdHlsZVJ1bnMsIHBhcmFncmFwaFN0eWxlS2V5cyk7XHJcblxyXG5cdGlmICghcmVzdWx0LnBhcmFncmFwaFN0eWxlUnVucy5sZW5ndGgpIGRlbGV0ZSByZXN1bHQucGFyYWdyYXBoU3R5bGVSdW5zO1xyXG5cclxuXHQvLyBzdHlsZVxyXG5cclxuXHQvLyBjb25zdCB0aGVOb3JtYWxTdHlsZVNoZWV0ID0gcmVzb3VyY2VEaWN0LlRoZU5vcm1hbFN0eWxlU2hlZXQ7XHJcblx0Ly8gY29uc3Qgc3R5bGVTaGVldFNldCA9IHJlc291cmNlRGljdC5TdHlsZVNoZWV0U2V0O1xyXG5cdC8vIGNvbnN0IHN0eWxlU2hlZXREYXRhID0gc3R5bGVTaGVldFNldFt0aGVOb3JtYWxTdHlsZVNoZWV0XS5TdHlsZVNoZWV0RGF0YTtcclxuXHRjb25zdCBzdHlsZVJ1biA9IGVuZ2luZURhdGEuRW5naW5lRGljdC5TdHlsZVJ1bjtcclxuXHJcblx0cmVzdWx0LnN0eWxlID0ge307IC8vIGRlY29kZVN0eWxlKHN0eWxlU2hlZXREYXRhLCBmb250cyk7XHJcblx0cmVzdWx0LnN0eWxlUnVucyA9IFtdO1xyXG5cclxuXHRmb3IgKGxldCBpID0gMDsgaSA8IHN0eWxlUnVuLlJ1bkFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRjb25zdCBsZW5ndGggPSBzdHlsZVJ1bi5SdW5MZW5ndGhBcnJheVtpXTtcclxuXHRcdGNvbnN0IHN0eWxlID0gZGVjb2RlU3R5bGUoc3R5bGVSdW4uUnVuQXJyYXlbaV0uU3R5bGVTaGVldC5TdHlsZVNoZWV0RGF0YSwgZm9udHMpO1xyXG5cdFx0cmVzdWx0LnN0eWxlUnVucy5wdXNoKHsgbGVuZ3RoLCBzdHlsZSB9KTtcclxuXHR9XHJcblxyXG5cdGZvciAobGV0IGNvdW50ZXIgPSByZW1vdmVkQ2hhcmFjdGVyczsgcmVzdWx0LnN0eWxlUnVucy5sZW5ndGggJiYgY291bnRlciA+IDA7IGNvdW50ZXItLSkge1xyXG5cdFx0aWYgKC0tcmVzdWx0LnN0eWxlUnVuc1tyZXN1bHQuc3R5bGVSdW5zLmxlbmd0aCAtIDFdLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRyZXN1bHQuc3R5bGVSdW5zLnBvcCgpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZGVkdXBsaWNhdGVWYWx1ZXMocmVzdWx0LnN0eWxlLCByZXN1bHQuc3R5bGVSdW5zLCBzdHlsZUtleXMpO1xyXG5cclxuXHRpZiAoIXJlc3VsdC5zdHlsZVJ1bnMubGVuZ3RoKSBkZWxldGUgcmVzdWx0LnN0eWxlUnVucztcclxuXHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUVuZ2luZURhdGEoZGF0YTogTGF5ZXJUZXh0RGF0YSkge1xyXG5cdGNvbnN0IHRleHQgPSBgJHsoZGF0YS50ZXh0IHx8ICcnKS5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHInKX1cXHJgO1xyXG5cclxuXHRjb25zdCBmb250czogRm9udFtdID0gW1xyXG5cdFx0eyBuYW1lOiAnQWRvYmVJbnZpc0ZvbnQnLCBzY3JpcHQ6IDAsIHR5cGU6IDAsIHN5bnRoZXRpYzogMCB9LFxyXG5cdF07XHJcblxyXG5cdGNvbnN0IGRlZkZvbnQgPSBkYXRhLnN0eWxlPy5mb250IHx8IGRhdGEuc3R5bGVSdW5zPy5maW5kKHMgPT4gcy5zdHlsZS5mb250KT8uc3R5bGUuZm9udCB8fCBkZWZhdWx0Rm9udDtcclxuXHRjb25zdCBwYXJhZ3JhcGhSdW5BcnJheTogUGFyYWdyYXBoUnVuW10gPSBbXTtcclxuXHRjb25zdCBwYXJhZ3JhcGhSdW5MZW5ndGhBcnJheTogbnVtYmVyW10gPSBbXTtcclxuXHRjb25zdCBwYXJhZ3JhcGhSdW5zID0gZGF0YS5wYXJhZ3JhcGhTdHlsZVJ1bnM7XHJcblxyXG5cdGlmIChwYXJhZ3JhcGhSdW5zICYmIHBhcmFncmFwaFJ1bnMubGVuZ3RoKSB7XHJcblx0XHRsZXQgbGVmdExlbmd0aCA9IHRleHQubGVuZ3RoO1xyXG5cclxuXHRcdGZvciAoY29uc3QgcnVuIG9mIHBhcmFncmFwaFJ1bnMpIHtcclxuXHRcdFx0bGV0IHJ1bkxlbmd0aCA9IE1hdGgubWluKHJ1bi5sZW5ndGgsIGxlZnRMZW5ndGgpO1xyXG5cdFx0XHRsZWZ0TGVuZ3RoIC09IHJ1bkxlbmd0aDtcclxuXHJcblx0XHRcdGlmICghcnVuTGVuZ3RoKSBjb250aW51ZTsgLy8gaWdub3JlIDAgc2l6ZSBydW5zXHJcblxyXG5cdFx0XHQvLyBleHRlbmQgbGFzdCBydW4gaWYgaXQncyBvbmx5IGZvciB0cmFpbGluZyBcXHJcclxuXHRcdFx0aWYgKGxlZnRMZW5ndGggPT09IDEgJiYgcnVuID09PSBwYXJhZ3JhcGhSdW5zW3BhcmFncmFwaFJ1bnMubGVuZ3RoIC0gMV0pIHtcclxuXHRcdFx0XHRydW5MZW5ndGgrKztcclxuXHRcdFx0XHRsZWZ0TGVuZ3RoLS07XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHBhcmFncmFwaFJ1bkxlbmd0aEFycmF5LnB1c2gocnVuTGVuZ3RoKTtcclxuXHRcdFx0cGFyYWdyYXBoUnVuQXJyYXkucHVzaCh7XHJcblx0XHRcdFx0UGFyYWdyYXBoU2hlZXQ6IHtcclxuXHRcdFx0XHRcdERlZmF1bHRTdHlsZVNoZWV0OiAwLFxyXG5cdFx0XHRcdFx0UHJvcGVydGllczogZW5jb2RlUGFyYWdyYXBoU3R5bGUoeyAuLi5kZWZhdWx0UGFyYWdyYXBoU3R5bGUsIC4uLmRhdGEucGFyYWdyYXBoU3R5bGUsIC4uLnJ1bi5zdHlsZSB9LCBmb250cyksXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRBZGp1c3RtZW50czogeyBBeGlzOiBbMSwgMCwgMV0sIFhZOiBbMCwgMF0gfSxcclxuXHRcdFx0fSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGxlZnRMZW5ndGgpIHtcclxuXHRcdFx0cGFyYWdyYXBoUnVuTGVuZ3RoQXJyYXkucHVzaChsZWZ0TGVuZ3RoKTtcclxuXHRcdFx0cGFyYWdyYXBoUnVuQXJyYXkucHVzaCh7XHJcblx0XHRcdFx0UGFyYWdyYXBoU2hlZXQ6IHtcclxuXHRcdFx0XHRcdERlZmF1bHRTdHlsZVNoZWV0OiAwLFxyXG5cdFx0XHRcdFx0UHJvcGVydGllczogZW5jb2RlUGFyYWdyYXBoU3R5bGUoeyAuLi5kZWZhdWx0UGFyYWdyYXBoU3R5bGUsIC4uLmRhdGEucGFyYWdyYXBoU3R5bGUgfSwgZm9udHMpLFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0QWRqdXN0bWVudHM6IHsgQXhpczogWzEsIDAsIDFdLCBYWTogWzAsIDBdIH0sXHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHRmb3IgKGxldCBpID0gMCwgbGFzdCA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGlmICh0ZXh0LmNoYXJDb2RlQXQoaSkgPT09IDEzKSB7IC8vIFxcclxyXG5cdFx0XHRcdHBhcmFncmFwaFJ1bkxlbmd0aEFycmF5LnB1c2goaSAtIGxhc3QgKyAxKTtcclxuXHRcdFx0XHRwYXJhZ3JhcGhSdW5BcnJheS5wdXNoKHtcclxuXHRcdFx0XHRcdFBhcmFncmFwaFNoZWV0OiB7XHJcblx0XHRcdFx0XHRcdERlZmF1bHRTdHlsZVNoZWV0OiAwLFxyXG5cdFx0XHRcdFx0XHRQcm9wZXJ0aWVzOiBlbmNvZGVQYXJhZ3JhcGhTdHlsZSh7IC4uLmRlZmF1bHRQYXJhZ3JhcGhTdHlsZSwgLi4uZGF0YS5wYXJhZ3JhcGhTdHlsZSB9LCBmb250cyksXHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0QWRqdXN0bWVudHM6IHsgQXhpczogWzEsIDAsIDFdLCBYWTogWzAsIDBdIH0sXHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0bGFzdCA9IGkgKyAxO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRjb25zdCBzdHlsZVNoZWV0RGF0YSA9IGVuY29kZVN0eWxlKHsgLi4uZGVmYXVsdFN0eWxlLCBmb250OiBkZWZGb250IH0sIGZvbnRzKTtcclxuXHRjb25zdCBzdHlsZVJ1bnMgPSBkYXRhLnN0eWxlUnVucyB8fCBbeyBsZW5ndGg6IHRleHQubGVuZ3RoLCBzdHlsZTogZGF0YS5zdHlsZSB8fCB7fSB9XTtcclxuXHRjb25zdCBzdHlsZVJ1bkFycmF5OiBTdHlsZVJ1bltdID0gW107XHJcblx0Y29uc3Qgc3R5bGVSdW5MZW5ndGhBcnJheTogbnVtYmVyW10gPSBbXTtcclxuXHJcblx0bGV0IGxlZnRMZW5ndGggPSB0ZXh0Lmxlbmd0aDtcclxuXHJcblx0Zm9yIChjb25zdCBydW4gb2Ygc3R5bGVSdW5zKSB7XHJcblx0XHRsZXQgcnVuTGVuZ3RoID0gTWF0aC5taW4ocnVuLmxlbmd0aCwgbGVmdExlbmd0aCk7XHJcblx0XHRsZWZ0TGVuZ3RoIC09IHJ1bkxlbmd0aDtcclxuXHJcblx0XHRpZiAoIXJ1bkxlbmd0aCkgY29udGludWU7IC8vIGlnbm9yZSAwIHNpemUgcnVuc1xyXG5cclxuXHRcdC8vIGV4dGVuZCBsYXN0IHJ1biBpZiBpdCdzIG9ubHkgZm9yIHRyYWlsaW5nIFxcclxyXG5cdFx0aWYgKGxlZnRMZW5ndGggPT09IDEgJiYgcnVuID09PSBzdHlsZVJ1bnNbc3R5bGVSdW5zLmxlbmd0aCAtIDFdKSB7XHJcblx0XHRcdHJ1bkxlbmd0aCsrO1xyXG5cdFx0XHRsZWZ0TGVuZ3RoLS07XHJcblx0XHR9XHJcblxyXG5cdFx0c3R5bGVSdW5MZW5ndGhBcnJheS5wdXNoKHJ1bkxlbmd0aCk7XHJcblx0XHRzdHlsZVJ1bkFycmF5LnB1c2goe1xyXG5cdFx0XHRTdHlsZVNoZWV0OiB7XHJcblx0XHRcdFx0U3R5bGVTaGVldERhdGE6IGVuY29kZVN0eWxlKHtcclxuXHRcdFx0XHRcdGtlcm5pbmc6IDAsXHJcblx0XHRcdFx0XHRhdXRvS2VybmluZzogdHJ1ZSxcclxuXHRcdFx0XHRcdGZpbGxDb2xvcjogeyByOiAwLCBnOiAwLCBiOiAwIH0sXHJcblx0XHRcdFx0XHQuLi5kYXRhLnN0eWxlLFxyXG5cdFx0XHRcdFx0Li4ucnVuLnN0eWxlLFxyXG5cdFx0XHRcdH0sIGZvbnRzKSxcclxuXHRcdFx0fSxcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Ly8gYWRkIGV4dHJhIHJ1biB0byB0aGUgZW5kIGlmIGV4aXN0aW5nIG9uZXMgZGlkbid0IGZpbGwgaXQgdXBcclxuXHRpZiAobGVmdExlbmd0aCAmJiBzdHlsZVJ1bnMubGVuZ3RoKSB7XHJcblx0XHRzdHlsZVJ1bkxlbmd0aEFycmF5LnB1c2gobGVmdExlbmd0aCk7XHJcblx0XHRzdHlsZVJ1bkFycmF5LnB1c2goe1xyXG5cdFx0XHRTdHlsZVNoZWV0OiB7XHJcblx0XHRcdFx0U3R5bGVTaGVldERhdGE6IGVuY29kZVN0eWxlKHtcclxuXHRcdFx0XHRcdGtlcm5pbmc6IDAsXHJcblx0XHRcdFx0XHRhdXRvS2VybmluZzogdHJ1ZSxcclxuXHRcdFx0XHRcdGZpbGxDb2xvcjogeyByOiAwLCBnOiAwLCBiOiAwIH0sXHJcblx0XHRcdFx0XHQuLi5kYXRhLnN0eWxlLFxyXG5cdFx0XHRcdH0sIGZvbnRzKSxcclxuXHRcdFx0fSxcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Y29uc3QgZ3JpZEluZm8gPSB7IC4uLmRlZmF1bHRHcmlkSW5mbywgLi4uZGF0YS5ncmlkSW5mbyB9O1xyXG5cdGNvbnN0IFdyaXRpbmdEaXJlY3Rpb24gPSBkYXRhLm9yaWVudGF0aW9uID09PSAndmVydGljYWwnID8gMiA6IDA7XHJcblx0Y29uc3QgUHJvY2Vzc2lvbiA9IGRhdGEub3JpZW50YXRpb24gPT09ICd2ZXJ0aWNhbCcgPyAxIDogMDtcclxuXHRjb25zdCBTaGFwZVR5cGUgPSBkYXRhLnNoYXBlVHlwZSA9PT0gJ2JveCcgPyAxIDogMDtcclxuXHRjb25zdCBQaG90b3Nob3A6IFBob3Rvc2hvcE5vZGUgPSB7XHJcblx0XHRTaGFwZVR5cGUsXHJcblx0fTtcclxuXHJcblx0aWYgKFNoYXBlVHlwZSA9PT0gMCkge1xyXG5cdFx0UGhvdG9zaG9wLlBvaW50QmFzZSA9IGRhdGEucG9pbnRCYXNlIHx8IFswLCAwXTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0UGhvdG9zaG9wLkJveEJvdW5kcyA9IGRhdGEuYm94Qm91bmRzIHx8IFswLCAwLCAwLCAwXTtcclxuXHR9XHJcblxyXG5cdC8vIG5lZWRlZCBmb3IgY29ycmVjdCBvcmRlciBvZiBwcm9wZXJ0aWVzXHJcblx0UGhvdG9zaG9wLkJhc2UgPSB7XHJcblx0XHRTaGFwZVR5cGUsXHJcblx0XHRUcmFuc2Zvcm1Qb2ludDA6IFsxLCAwXSxcclxuXHRcdFRyYW5zZm9ybVBvaW50MTogWzAsIDFdLFxyXG5cdFx0VHJhbnNmb3JtUG9pbnQyOiBbMCwgMF0sXHJcblx0fTtcclxuXHJcblx0Y29uc3QgZGVmYXVsdFJlc291cmNlcyA9IHtcclxuXHRcdEtpbnNva3VTZXQ6IFtcclxuXHRcdFx0e1xyXG5cdFx0XHRcdE5hbWU6ICdQaG90b3Nob3BLaW5zb2t1SGFyZCcsXHJcblx0XHRcdFx0Tm9TdGFydDogJ+OAgeOAgu+8jO+8juODu++8mu+8m++8n++8geODvOKAleKAmeKAne+8ieOAle+8ve+9neOAieOAi+OAjeOAj+OAkeODveODvuOCneOCnuOAheOBgeOBg+OBheOBh+OBieOBo+OCg+OCheOCh+OCjuOCoeOCo+OCpeOCp+OCqeODg+ODo+ODpeODp+ODruODteODtuOCm+OCnD8hKV19LC46O+KEg+KEicKi77yF4oCwJyxcclxuXHRcdFx0XHROb0VuZDogJ+KAmOKAnO+8iOOAlO+8u++9m+OAiOOAiuOAjOOAjuOAkChbe++/pe+8hMKj77ygwqfjgJLvvIMnLFxyXG5cdFx0XHRcdEtlZXA6ICfigJXigKUnLFxyXG5cdFx0XHRcdEhhbmdpbmc6ICfjgIHjgIIuLCcsXHJcblx0XHRcdH0sXHJcblx0XHRcdHtcclxuXHRcdFx0XHROYW1lOiAnUGhvdG9zaG9wS2luc29rdVNvZnQnLFxyXG5cdFx0XHRcdE5vU3RhcnQ6ICfjgIHjgILvvIzvvI7jg7vvvJrvvJvvvJ/vvIHigJnigJ3vvInjgJXvvL3vvZ3jgInjgIvjgI3jgI/jgJHjg73jg77jgp3jgp7jgIUnLFxyXG5cdFx0XHRcdE5vRW5kOiAn4oCY4oCc77yI44CU77y7772b44CI44CK44CM44CO44CQJyxcclxuXHRcdFx0XHRLZWVwOiAn4oCV4oClJyxcclxuXHRcdFx0XHRIYW5naW5nOiAn44CB44CCLiwnLFxyXG5cdFx0XHR9LFxyXG5cdFx0XSxcclxuXHRcdE1vamlLdW1pU2V0OiBbXHJcblx0XHRcdHsgSW50ZXJuYWxOYW1lOiAnUGhvdG9zaG9wNk1vamlLdW1pU2V0MScgfSxcclxuXHRcdFx0eyBJbnRlcm5hbE5hbWU6ICdQaG90b3Nob3A2TW9qaUt1bWlTZXQyJyB9LFxyXG5cdFx0XHR7IEludGVybmFsTmFtZTogJ1Bob3Rvc2hvcDZNb2ppS3VtaVNldDMnIH0sXHJcblx0XHRcdHsgSW50ZXJuYWxOYW1lOiAnUGhvdG9zaG9wNk1vamlLdW1pU2V0NCcgfSxcclxuXHRcdF0sXHJcblx0XHRUaGVOb3JtYWxTdHlsZVNoZWV0OiAwLFxyXG5cdFx0VGhlTm9ybWFsUGFyYWdyYXBoU2hlZXQ6IDAsXHJcblx0XHRQYXJhZ3JhcGhTaGVldFNldDogW1xyXG5cdFx0XHR7XHJcblx0XHRcdFx0TmFtZTogJ05vcm1hbCBSR0InLFxyXG5cdFx0XHRcdERlZmF1bHRTdHlsZVNoZWV0OiAwLFxyXG5cdFx0XHRcdFByb3BlcnRpZXM6IGVuY29kZVBhcmFncmFwaFN0eWxlKHsgLi4uZGVmYXVsdFBhcmFncmFwaFN0eWxlLCAuLi5kYXRhLnBhcmFncmFwaFN0eWxlIH0sIGZvbnRzKSxcclxuXHRcdFx0fSxcclxuXHRcdF0sXHJcblx0XHRTdHlsZVNoZWV0U2V0OiBbXHJcblx0XHRcdHtcclxuXHRcdFx0XHROYW1lOiAnTm9ybWFsIFJHQicsXHJcblx0XHRcdFx0U3R5bGVTaGVldERhdGE6IHN0eWxlU2hlZXREYXRhLFxyXG5cdFx0XHR9LFxyXG5cdFx0XSxcclxuXHRcdEZvbnRTZXQ6IGZvbnRzLm1hcDxGb250U2V0PihmID0+ICh7XHJcblx0XHRcdE5hbWU6IGYubmFtZSxcclxuXHRcdFx0U2NyaXB0OiBmLnNjcmlwdCB8fCAwLFxyXG5cdFx0XHRGb250VHlwZTogZi50eXBlIHx8IDAsXHJcblx0XHRcdFN5bnRoZXRpYzogZi5zeW50aGV0aWMgfHwgMCxcclxuXHRcdH0pKSxcclxuXHRcdFN1cGVyc2NyaXB0U2l6ZTogZGF0YS5zdXBlcnNjcmlwdFNpemUgPz8gMC41ODMsXHJcblx0XHRTdXBlcnNjcmlwdFBvc2l0aW9uOiBkYXRhLnN1cGVyc2NyaXB0UG9zaXRpb24gPz8gMC4zMzMsXHJcblx0XHRTdWJzY3JpcHRTaXplOiBkYXRhLnN1YnNjcmlwdFNpemUgPz8gMC41ODMsXHJcblx0XHRTdWJzY3JpcHRQb3NpdGlvbjogZGF0YS5zdWJzY3JpcHRQb3NpdGlvbiA/PyAwLjMzMyxcclxuXHRcdFNtYWxsQ2FwU2l6ZTogZGF0YS5zbWFsbENhcFNpemUgPz8gMC43LFxyXG5cdH07XHJcblxyXG5cdGNvbnN0IGVuZ2luZURhdGE6IEVuZ2luZURhdGEgPSB7XHJcblx0XHRFbmdpbmVEaWN0OiB7XHJcblx0XHRcdEVkaXRvcjogeyBUZXh0OiB0ZXh0IH0sXHJcblx0XHRcdFBhcmFncmFwaFJ1bjoge1xyXG5cdFx0XHRcdERlZmF1bHRSdW5EYXRhOiB7XHJcblx0XHRcdFx0XHRQYXJhZ3JhcGhTaGVldDogeyBEZWZhdWx0U3R5bGVTaGVldDogMCwgUHJvcGVydGllczoge30gfSxcclxuXHRcdFx0XHRcdEFkanVzdG1lbnRzOiB7IEF4aXM6IFsxLCAwLCAxXSwgWFk6IFswLCAwXSB9LFxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0UnVuQXJyYXk6IHBhcmFncmFwaFJ1bkFycmF5LFxyXG5cdFx0XHRcdFJ1bkxlbmd0aEFycmF5OiBwYXJhZ3JhcGhSdW5MZW5ndGhBcnJheSxcclxuXHRcdFx0XHRJc0pvaW5hYmxlOiAxLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRTdHlsZVJ1bjoge1xyXG5cdFx0XHRcdERlZmF1bHRSdW5EYXRhOiB7IFN0eWxlU2hlZXQ6IHsgU3R5bGVTaGVldERhdGE6IHt9IH0gfSxcclxuXHRcdFx0XHRSdW5BcnJheTogc3R5bGVSdW5BcnJheSxcclxuXHRcdFx0XHRSdW5MZW5ndGhBcnJheTogc3R5bGVSdW5MZW5ndGhBcnJheSxcclxuXHRcdFx0XHRJc0pvaW5hYmxlOiAyLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRHcmlkSW5mbzoge1xyXG5cdFx0XHRcdEdyaWRJc09uOiAhIWdyaWRJbmZvLmlzT24sXHJcblx0XHRcdFx0U2hvd0dyaWQ6ICEhZ3JpZEluZm8uc2hvdyxcclxuXHRcdFx0XHRHcmlkU2l6ZTogZ3JpZEluZm8uc2l6ZSA/PyAxOCxcclxuXHRcdFx0XHRHcmlkTGVhZGluZzogZ3JpZEluZm8ubGVhZGluZyA/PyAyMixcclxuXHRcdFx0XHRHcmlkQ29sb3I6IHsgVHlwZTogMSwgVmFsdWVzOiBlbmNvZGVDb2xvcihncmlkSW5mby5jb2xvcikgfSxcclxuXHRcdFx0XHRHcmlkTGVhZGluZ0ZpbGxDb2xvcjogeyBUeXBlOiAxLCBWYWx1ZXM6IGVuY29kZUNvbG9yKGdyaWRJbmZvLmNvbG9yKSB9LFxyXG5cdFx0XHRcdEFsaWduTGluZUhlaWdodFRvR3JpZEZsYWdzOiAhIWdyaWRJbmZvLmFsaWduTGluZUhlaWdodFRvR3JpZEZsYWdzLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRBbnRpQWxpYXM6IGFudGlhbGlhcy5pbmRleE9mKGRhdGEuYW50aUFsaWFzID8/ICdzaGFycCcpLFxyXG5cdFx0XHRVc2VGcmFjdGlvbmFsR2x5cGhXaWR0aHM6IGRhdGEudXNlRnJhY3Rpb25hbEdseXBoV2lkdGhzID8/IHRydWUsXHJcblx0XHRcdFJlbmRlcmVkOiB7XHJcblx0XHRcdFx0VmVyc2lvbjogMSxcclxuXHRcdFx0XHRTaGFwZXM6IHtcclxuXHRcdFx0XHRcdFdyaXRpbmdEaXJlY3Rpb24sXHJcblx0XHRcdFx0XHRDaGlsZHJlbjogW1xyXG5cdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0U2hhcGVUeXBlLFxyXG5cdFx0XHRcdFx0XHRcdFByb2Nlc3Npb24sXHJcblx0XHRcdFx0XHRcdFx0TGluZXM6IHsgV3JpdGluZ0RpcmVjdGlvbiwgQ2hpbGRyZW46IFtdIH0sXHJcblx0XHRcdFx0XHRcdFx0Q29va2llOiB7IFBob3Rvc2hvcCB9LFxyXG5cdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XSxcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHR9LFxyXG5cdFx0fSxcclxuXHRcdFJlc291cmNlRGljdDogeyAuLi5kZWZhdWx0UmVzb3VyY2VzIH0sXHJcblx0XHREb2N1bWVudFJlc291cmNlczogeyAuLi5kZWZhdWx0UmVzb3VyY2VzIH0sXHJcblx0fTtcclxuXHJcblx0Ly8gY29uc29sZS5sb2coJ2VuY29kZUVuZ2luZURhdGEnLCByZXF1aXJlKCd1dGlsJykuaW5zcGVjdChlbmdpbmVEYXRhLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHRyZXR1cm4gZW5naW5lRGF0YTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
