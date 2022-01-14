import { Psd, WriteOptions, Color } from './psd';
export interface PsdWriter {
    offset: number;
    buffer: ArrayBuffer;
    view: DataView;
}
export declare function createWriter(size?: number): PsdWriter;
export declare function getWriterBuffer(writer: PsdWriter): ArrayBuffer;
export declare function getWriterBufferNoCopy(writer: PsdWriter): Uint8Array;
export declare function writeUint8(writer: PsdWriter, value: number): void;
export declare function writeInt16(writer: PsdWriter, value: number): void;
export declare function writeUint16(writer: PsdWriter, value: number): void;
export declare function writeInt32(writer: PsdWriter, value: number): void;
export declare function writeUint32(writer: PsdWriter, value: number): void;
export declare function writeFloat32(writer: PsdWriter, value: number): void;
export declare function writeFloat64(writer: PsdWriter, value: number): void;
export declare function writeFixedPoint32(writer: PsdWriter, value: number): void;
export declare function writeFixedPointPath32(writer: PsdWriter, value: number): void;
export declare function writeBytes(writer: PsdWriter, buffer: Uint8Array | undefined): void;
export declare function writeZeros(writer: PsdWriter, count: number): void;
export declare function writeSignature(writer: PsdWriter, signature: string): void;
export declare function writePascalString(writer: PsdWriter, text: string, padTo: number): void;
export declare function writeUnicodeString(writer: PsdWriter, text: string): void;
export declare function writeUnicodeStringWithPadding(writer: PsdWriter, text: string): void;
export declare function writeSection(writer: PsdWriter, round: number, func: () => void, writeTotalLength?: boolean, large?: boolean): void;
export declare function writePsd(writer: PsdWriter, psd: Psd, options?: WriteOptions): void;
export declare function writeColor(writer: PsdWriter, color: Color | undefined): void;
