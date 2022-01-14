import { AntiAlias, BevelDirection, BevelStyle, BevelTechnique, BlendMode, GlowSource, GlowTechnique, GradientStyle, LineAlignment, LineCapType, LineJoinType, Orientation, TextGridding, Units, UnitsValue, WarpStyle } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export declare function setLogErrors(value: boolean): void;
export declare function readAsciiStringOrClassId(reader: PsdReader): string;
export declare function readDescriptorStructure(reader: PsdReader): any;
export declare function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any, root: string): void;
export declare function readVersionAndDescriptor(reader: PsdReader): any;
export declare function writeVersionAndDescriptor(writer: PsdWriter, name: string, classID: string, descriptor: any, root?: string): void;
export declare type DescriptorUnits = 'Angle' | 'Density' | 'Distance' | 'None' | 'Percent' | 'Pixels' | 'Millimeters' | 'Points' | 'Picas' | 'Inches' | 'Centimeters';
export interface DescriptorUnitsValue {
    units: DescriptorUnits;
    value: number;
}
export declare type DescriptorColor = {
    'Rd  ': number;
    'Grn ': number;
    'Bl  ': number;
} | {
    'H   ': DescriptorUnitsValue;
    Strt: number;
    Brgh: number;
} | {
    'Cyn ': number;
    Mgnt: number;
    'Ylw ': number;
    Blck: number;
} | {
    'Gry ': number;
} | {
    Lmnc: number;
    'A   ': number;
    'B   ': number;
};
export interface DesciptorPattern {
    'Nm  ': string;
    Idnt: string;
}
export declare type DesciptorGradient = {
    'Nm  ': string;
    GrdF: 'GrdF.CstS';
    Intr: number;
    Clrs: {
        'Clr ': DescriptorColor;
        Type: 'Clry.UsrS';
        Lctn: number;
        Mdpn: number;
    }[];
    Trns: {
        Opct: DescriptorUnitsValue;
        Lctn: number;
        Mdpn: number;
    }[];
} | {
    GrdF: 'GrdF.ClNs';
    Smth: number;
    'Nm  ': string;
    ClrS: string;
    RndS: number;
    VctC?: boolean;
    ShTr?: boolean;
    'Mnm ': number[];
    'Mxm ': number[];
};
export interface DescriptorColorContent {
    'Clr ': DescriptorColor;
}
export interface DescriptorGradientContent {
    Grad: DesciptorGradient;
    Type: string;
    Dthr?: boolean;
    Rvrs?: boolean;
    Angl?: DescriptorUnitsValue;
    'Scl '?: DescriptorUnitsValue;
    Algn?: boolean;
    Ofst?: {
        Hrzn: DescriptorUnitsValue;
        Vrtc: DescriptorUnitsValue;
    };
}
export interface DescriptorPatternContent {
    Ptrn: DesciptorPattern;
    Lnkd?: boolean;
    phase?: {
        Hrzn: number;
        Vrtc: number;
    };
}
export declare type DescriptorVectorContent = DescriptorColorContent | DescriptorGradientContent | DescriptorPatternContent;
export interface StrokeDescriptor {
    strokeStyleVersion: number;
    strokeEnabled: boolean;
    fillEnabled: boolean;
    strokeStyleLineWidth: DescriptorUnitsValue;
    strokeStyleLineDashOffset: DescriptorUnitsValue;
    strokeStyleMiterLimit: number;
    strokeStyleLineCapType: string;
    strokeStyleLineJoinType: string;
    strokeStyleLineAlignment: string;
    strokeStyleScaleLock: boolean;
    strokeStyleStrokeAdjust: boolean;
    strokeStyleLineDashSet: DescriptorUnitsValue[];
    strokeStyleBlendMode: string;
    strokeStyleOpacity: DescriptorUnitsValue;
    strokeStyleContent: DescriptorVectorContent;
    strokeStyleResolution: number;
}
export interface TextDescriptor {
    'Txt ': string;
    textGridding: string;
    Ornt: string;
    AntA: string;
    TextIndex: number;
    EngineData?: Uint8Array;
}
export interface WarpDescriptor {
    warpStyle: string;
    warpValue: number;
    warpPerspective: number;
    warpPerspectiveOther: number;
    warpRotate: string;
    bounds?: {
        'Top ': DescriptorUnitsValue;
        Left: DescriptorUnitsValue;
        Btom: DescriptorUnitsValue;
        Rght: DescriptorUnitsValue;
    };
    uOrder: number;
    vOrder: number;
    customEnvelopeWarp?: {
        meshPoints: {
            type: 'Hrzn' | 'Vrtc';
            values: number[];
        }[];
    };
}
export interface QuiltWarpDescriptor extends WarpDescriptor {
    deformNumRows: number;
    deformNumCols: number;
    customEnvelopeWarp: {
        quiltSliceX: {
            type: 'quiltSliceX';
            values: number[];
        }[];
        quiltSliceY: {
            type: 'quiltSliceY';
            values: number[];
        }[];
        meshPoints: {
            type: 'Hrzn' | 'Vrtc';
            values: number[];
        }[];
    };
}
export declare function parseAngle(x: DescriptorUnitsValue): number;
export declare function parsePercent(x: DescriptorUnitsValue | undefined): number;
export declare function parsePercentOrAngle(x: DescriptorUnitsValue | undefined): number;
export declare function parseUnits({ units, value }: DescriptorUnitsValue): UnitsValue;
export declare function parseUnitsOrNumber(value: DescriptorUnitsValue | number, units?: Units): UnitsValue;
export declare function parseUnitsToNumber({ units, value }: DescriptorUnitsValue, expectedUnits: string): number;
export declare function unitsAngle(value: number | undefined): DescriptorUnitsValue;
export declare function unitsPercent(value: number | undefined): DescriptorUnitsValue;
export declare function unitsValue(x: UnitsValue | undefined, key: string): DescriptorUnitsValue;
export declare const textGridding: {
    decode: (val: string) => TextGridding;
    encode: (val: TextGridding | undefined) => string;
};
export declare const Ornt: {
    decode: (val: string) => Orientation;
    encode: (val: Orientation | undefined) => string;
};
export declare const Annt: {
    decode: (val: string) => AntiAlias;
    encode: (val: AntiAlias | undefined) => string;
};
export declare const warpStyle: {
    decode: (val: string) => WarpStyle;
    encode: (val: WarpStyle | undefined) => string;
};
export declare const BlnM: {
    decode: (val: string) => BlendMode;
    encode: (val: BlendMode | undefined) => string;
};
export declare const BESl: {
    decode: (val: string) => BevelStyle;
    encode: (val: BevelStyle | undefined) => string;
};
export declare const bvlT: {
    decode: (val: string) => BevelTechnique;
    encode: (val: BevelTechnique | undefined) => string;
};
export declare const BESs: {
    decode: (val: string) => BevelDirection;
    encode: (val: BevelDirection | undefined) => string;
};
export declare const BETE: {
    decode: (val: string) => GlowTechnique;
    encode: (val: GlowTechnique | undefined) => string;
};
export declare const IGSr: {
    decode: (val: string) => GlowSource;
    encode: (val: GlowSource | undefined) => string;
};
export declare const GrdT: {
    decode: (val: string) => GradientStyle;
    encode: (val: GradientStyle | undefined) => string;
};
export declare const ClrS: {
    decode: (val: string) => "rgb" | "hsb" | "lab";
    encode: (val: "rgb" | "hsb" | "lab" | undefined) => string;
};
export declare const FStl: {
    decode: (val: string) => "center" | "inside" | "outside";
    encode: (val: "center" | "inside" | "outside" | undefined) => string;
};
export declare const FrFl: {
    decode: (val: string) => "pattern" | "color" | "gradient";
    encode: (val: "pattern" | "color" | "gradient" | undefined) => string;
};
export declare const strokeStyleLineCapType: {
    decode: (val: string) => LineCapType;
    encode: (val: LineCapType | undefined) => string;
};
export declare const strokeStyleLineJoinType: {
    decode: (val: string) => LineJoinType;
    encode: (val: LineJoinType | undefined) => string;
};
export declare const strokeStyleLineAlignment: {
    decode: (val: string) => LineAlignment;
    encode: (val: LineAlignment | undefined) => string;
};
