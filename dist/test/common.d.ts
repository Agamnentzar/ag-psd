/// <reference path="../../typings/chai.d.ts" />
/// <reference path="../../typings/canvas.d.ts" />
/// <reference types="node" />
import { createCanvas } from 'canvas';
import '../initializeCanvas';
import { Psd, ReadOptions } from '../index';
export { createCanvas };
export declare type ImageMap = {
    [key: string]: HTMLCanvasElement;
};
export declare function toArrayBuffer(buffer: Buffer): ArrayBuffer;
export declare function repeat<T>(times: number, ...values: T[]): T[];
export declare function range(start: number, length: number): number[];
export declare function importPSD(dirName: string): Psd | undefined;
export declare function loadImagesFromDirectory(dirName: string): ImageMap;
export declare function createReaderFromBuffer(buffer: Buffer): import("..").PsdReader;
export declare function readPsdFromFile(fileName: string, options?: ReadOptions): Psd;
export declare function extractPSD(filePath: string, psd: Psd): void;
export declare function saveCanvas(fileName: string, canvas: HTMLCanvasElement | undefined): void;
export declare function loadCanvasFromFile(filePath: string): HTMLCanvasElement;
export declare function compareTwoFiles(expectedPath: string, actual: Uint8Array, name: string): void;
export declare function compareCanvases(expected: HTMLCanvasElement | undefined, actual: HTMLCanvasElement | undefined, name: string): void;
export declare function compareBuffers(actual: Buffer, expected: Buffer, test: string, start?: number, offset?: number): void;
export declare function expectBuffersEqual(actual: Uint8Array, expected: Uint8Array, name: string): void;
