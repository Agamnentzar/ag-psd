/// <reference types="node" />
export declare function stringLengthInBytes(value: string): number;
export declare function encodeStringTo(buffer: Uint8Array | Buffer, offset: number, value: string): number;
export declare function encodeString(value: string): Uint8Array;
export declare function decodeString(value: Uint8Array): string;
