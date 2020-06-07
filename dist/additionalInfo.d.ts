import { LayerAdditionalInfo, Psd, ReadOptions, WriteOptions } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
declare type HasMethod = (target: LayerAdditionalInfo) => boolean;
declare type ReadMethod = (reader: PsdReader, target: LayerAdditionalInfo, left: () => number, psd: Psd, options: ReadOptions) => void;
declare type WriteMethod = (writer: PsdWriter, target: LayerAdditionalInfo, psd: Psd, options: WriteOptions) => void;
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
export declare const ClrS: {
    decode: (val: string) => "rgb" | "hsb" | "lab";
    encode: (val: "rgb" | "hsb" | "lab" | undefined) => string;
};
export {};
