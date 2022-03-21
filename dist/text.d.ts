import { LayerTextData } from './psd';
interface Adjustments {
    Axis: number[];
    XY: number[];
}
interface TypeValues {
    Type: number;
    Values: number[];
}
interface ParagraphProperties {
    Justification?: number;
    FirstLineIndent?: number;
    StartIndent?: number;
    EndIndent?: number;
    SpaceBefore?: number;
    SpaceAfter?: number;
    AutoHyphenate?: boolean;
    HyphenatedWordSize?: number;
    PreHyphen?: number;
    PostHyphen?: number;
    ConsecutiveHyphens?: number;
    Zone?: number;
    WordSpacing?: number[];
    LetterSpacing?: number[];
    GlyphSpacing?: number[];
    AutoLeading?: number;
    LeadingType?: number;
    Hanging?: boolean;
    Burasagari?: boolean;
    KinsokuOrder?: number;
    EveryLineComposer?: boolean;
}
interface ParagraphSheet {
    Name?: string;
    DefaultStyleSheet: number;
    Properties: ParagraphProperties;
}
interface StyleSheetData {
    Font?: number;
    FontSize?: number;
    FauxBold?: boolean;
    FauxItalic?: boolean;
    AutoLeading?: boolean;
    Leading?: number;
    HorizontalScale?: number;
    VerticalScale?: number;
    Tracking?: number;
    AutoKerning?: boolean;
    Kerning?: number;
    BaselineShift?: number;
    FontCaps?: number;
    FontBaseline?: number;
    Underline?: boolean;
    Strikethrough?: boolean;
    Ligatures?: boolean;
    DLigatures?: boolean;
    BaselineDirection?: number;
    Tsume?: number;
    StyleRunAlignment?: number;
    Language?: number;
    NoBreak?: boolean;
    FillColor?: TypeValues;
    StrokeColor?: TypeValues;
    FillFlag?: boolean;
    StrokeFlag?: boolean;
    FillFirst?: boolean;
    YUnderline?: number;
    OutlineWidth?: number;
    CharacterDirection?: number;
    HindiNumbers?: boolean;
    Kashida?: number;
    DiacriticPos?: number;
}
interface FontSet {
    Name: string;
    Script: number;
    FontType: number;
    Synthetic: number;
}
interface ResourceDict {
    KinsokuSet: any[];
    MojiKumiSet: any[];
    TheNormalStyleSheet: number;
    TheNormalParagraphSheet: number;
    ParagraphSheetSet: ParagraphSheet[];
    StyleSheetSet: {
        Name: string;
        StyleSheetData: StyleSheetData;
    }[];
    FontSet: FontSet[];
    SuperscriptSize: number;
    SuperscriptPosition: number;
    SubscriptSize: number;
    SubscriptPosition: number;
    SmallCapSize: number;
}
interface ParagraphRun {
    ParagraphSheet: ParagraphSheet;
    Adjustments: Adjustments;
}
interface StyleRun {
    StyleSheet: {
        StyleSheetData: StyleSheetData;
    };
}
interface PhotoshopNode {
    ShapeType?: number;
    PointBase?: number[];
    BoxBounds?: number[];
    Base?: {
        ShapeType: number;
        TransformPoint0: number[];
        TransformPoint1: number[];
        TransformPoint2: number[];
    };
}
interface EngineData {
    EngineDict: {
        Editor: {
            Text: string;
        };
        ParagraphRun: {
            DefaultRunData: ParagraphRun;
            RunArray: ParagraphRun[];
            RunLengthArray: number[];
            IsJoinable: number;
        };
        StyleRun: {
            DefaultRunData: StyleRun;
            RunArray: StyleRun[];
            RunLengthArray: number[];
            IsJoinable: number;
        };
        GridInfo: {
            GridIsOn: boolean;
            ShowGrid: boolean;
            GridSize: number;
            GridLeading: number;
            GridColor: TypeValues;
            GridLeadingFillColor: TypeValues;
            AlignLineHeightToGridFlags: boolean;
        };
        AntiAlias: number;
        UseFractionalGlyphWidths: boolean;
        Rendered?: {
            Version: number;
            Shapes?: {
                WritingDirection: number;
                Children?: {
                    ShapeType?: number;
                    Procession: number;
                    Lines: {
                        WritingDirection: number;
                        Children: any[];
                    };
                    Cookie?: {
                        Photoshop?: PhotoshopNode;
                    };
                }[];
            };
        };
    };
    ResourceDict: ResourceDict;
    DocumentResources: ResourceDict;
}
export declare function decodeEngineData(engineData: EngineData): LayerTextData;
export declare function encodeEngineData(data: LayerTextData): EngineData;
export {};
