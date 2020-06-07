import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export declare function setLogErrors(value: boolean): void;
export declare function readAsciiStringOrClassId(reader: PsdReader): string;
export declare function readDescriptorStructure(reader: PsdReader): any;
export declare function writeDescriptorStructure(writer: PsdWriter, name: string, classId: string, value: any): void;
export declare function readVersionAndDescriptor(reader: PsdReader): any;
export declare function writeVersionAndDescriptor(writer: PsdWriter, name: string, classID: string, descriptor: any): void;
