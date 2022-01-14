import { LayerVectorMask } from './psd';
export interface Csh {
    shapes: (LayerVectorMask & {
        name: string;
        id: string;
        width: number;
        height: number;
    })[];
}
export declare function readCsh(buffer: ArrayBufferView): Csh;
