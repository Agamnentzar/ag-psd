import { LayerAdditionalInfo, BezierPath, Psd, ReadOptions, WriteOptions, BooleanOperation, LayerEffectsInfo, LayerVectorMask } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export interface ExtendedWriteOptions extends WriteOptions {
    layerIds: number[];
}
declare type HasMethod = (target: LayerAdditionalInfo) => boolean;
declare type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd, options: ReadOptions) => void;
declare type WriteMethod = (writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: ExtendedWriteOptions) => void;
export interface InfoHandler {
    key: string;
    has: HasMethod;
    read: ReadMethod;
    write: WriteMethod;
}
export declare const infoHandlers: InfoHandler[];
export declare const infoHandlersMap: {
    [key: string]: InfoHandler;
};
export declare function readBezierKnot(reader: PsdReader, width: number, height: number): number[];
export declare const booleanOperations: BooleanOperation[];
export declare function readVectorMask(reader: PsdReader, vectorMask: LayerVectorMask, width: number, height: number, size: number): BezierPath[];
export declare function hasMultiEffects(effects: LayerEffectsInfo): boolean;
export {};
