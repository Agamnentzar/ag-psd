/// <reference types="node" />
import { Layer, LayerMaskData, Psd, ReadOptions, WriteOptions } from './psd';
import { PsdWriter } from './psdWriter';
import { PsdReader } from './psdReader';
export * from './abr';
export * from './csh';
export { initializeCanvas } from './helpers';
export * from './psd';
import { fromByteArray } from 'base64-js';
import { BoundingBoxScan, IBoundingBox } from './BoundingBoxScanner';
export { PsdReader, PsdWriter };
interface BufferLike {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
}
export declare const byteArrayToBase64: typeof fromByteArray;
export declare const boundingBoxScanner: BoundingBoxScan;
export declare function readPsd(buffer: ArrayBuffer | BufferLike, options?: ReadOptions): Psd;
export declare function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer;
export declare function writePsdUint8Array(psd: Psd, options?: WriteOptions): Uint8Array;
export declare function writePsdBuffer(psd: Psd, options?: WriteOptions): Buffer;
export declare function getLayerOrMaskContentBoundingBox(layer: Layer | LayerMaskData): IBoundingBox | undefined;
export declare function getLayerOrMaskChannelBoundingBox(layer: Layer | LayerMaskData, channel?: number): IBoundingBox | undefined;
export interface IPSRectangle {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export declare const getMaskedLayerSize: (layer: Layer, margin: number | undefined, psd: Psd) => IPSRectangle;
