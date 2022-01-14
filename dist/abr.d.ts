import { BlendMode, PatternInfo } from './psd';
export interface Abr {
    brushes: Brush[];
    samples: SampleInfo[];
    patterns: PatternInfo[];
}
export interface SampleInfo {
    id: string;
    bounds: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    alpha: Uint8Array;
}
export interface BrushDynamics {
    control: 'off' | 'fade' | 'pen pressure' | 'pen tilt' | 'stylus wheel' | 'initial direction' | 'direction' | 'initial rotation' | 'rotation';
    steps: number;
    jitter: number;
    minimum: number;
}
export interface BrushShape {
    name?: string;
    size: number;
    angle: number;
    roundness: number;
    hardness?: number;
    spacingOn: boolean;
    spacing: number;
    flipX: boolean;
    flipY: boolean;
    sampledData?: string;
}
export interface Brush {
    name: string;
    shape: BrushShape;
    shapeDynamics?: {
        sizeDynamics: BrushDynamics;
        minimumDiameter: number;
        tiltScale: number;
        angleDynamics: BrushDynamics;
        roundnessDynamics: BrushDynamics;
        minimumRoundness: number;
        flipX: boolean;
        flipY: boolean;
        brushProjection: boolean;
    };
    scatter?: {
        bothAxes: boolean;
        scatterDynamics: BrushDynamics;
        countDynamics: BrushDynamics;
        count: number;
    };
    texture?: {
        id: string;
        name: string;
        invert: boolean;
        scale: number;
        brightness: number;
        contrast: number;
        blendMode: BlendMode;
        depth: number;
        depthMinimum: number;
        depthDynamics: BrushDynamics;
    };
    dualBrush?: {
        flip: boolean;
        shape: BrushShape;
        blendMode: BlendMode;
        useScatter: boolean;
        spacing: number;
        count: number;
        bothAxes: boolean;
        countDynamics: BrushDynamics;
        scatterDynamics: BrushDynamics;
    };
    colorDynamics?: {
        foregroundBackground: BrushDynamics;
        hue: number;
        saturation: number;
        brightness: number;
        purity: number;
        perTip: boolean;
    };
    transfer?: {
        flowDynamics: BrushDynamics;
        opacityDynamics: BrushDynamics;
        wetnessDynamics: BrushDynamics;
        mixDynamics: BrushDynamics;
    };
    brushPose?: {
        overrideAngle: boolean;
        overrideTiltX: boolean;
        overrideTiltY: boolean;
        overridePressure: boolean;
        pressure: number;
        tiltX: number;
        tiltY: number;
        angle: number;
    };
    noise: boolean;
    wetEdges: boolean;
    protectTexture?: boolean;
    spacing: number;
    brushGroup?: undefined;
    interpretation?: boolean;
    useBrushSize: boolean;
    toolOptions?: {
        brushPreset: boolean;
        flow: number;
        smooth: number;
        mode: BlendMode;
        opacity: number;
        smoothing: boolean;
        smoothingValue: number;
        smoothingRadiusMode: boolean;
        smoothingCatchup: boolean;
        smoothingCatchupAtEnd: boolean;
        smoothingZoomCompensation: boolean;
        pressureSmoothing: boolean;
        usePressureOverridesSize: boolean;
        usePressureOverridesOpacity: boolean;
        useLegacy: boolean;
    };
}
export declare function readAbr(buffer: ArrayBufferView, options?: {
    logMissingFeatures?: boolean;
}): Abr;
