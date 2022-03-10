/**
 * A tool for finding the bounding box around a set of colored pixels
 */
import { Layer, LayerMaskData } from './psd';
export interface IBoundingBox {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export declare class BoundingBoxScan {
    static SCAN_OFFSET_RED: number;
    static SCAN_OFFSET_GREEN: number;
    static SCAN_OFFSET_BLUE: number;
    static SCAN_OFFSET_ALPHA: number;
    /**
     * Find the bounding box of the layer's transparency
     */
    scanLayerTransparency(layer: Layer | LayerMaskData): IBoundingBox | undefined;
    cropLayerToBoundingBox(layer: Layer): void;
    /**
     * Scan the entire image for a rectangle in the set channel
     */
    private scan;
}
