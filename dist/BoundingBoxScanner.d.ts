/**
 * A tool for finding the bounding box around a set of colored pixels
 */
import { Layer, LayerMaskData } from './psd';
export interface IBoundingBox {
    left: number | undefined;
    top: number | undefined;
    right: number | undefined;
    bottom: number | undefined;
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
    /**
     * Find the bounding box of the layer's channel
     */
    scanLayerChannel(layer: Layer | LayerMaskData, channel?: number): IBoundingBox | undefined;
    cropLayerToBoundingBox(layer: Layer): void;
    /**
     * Scan the entire image for a rectangle in the set channel
     */
    scan(data: Uint8ClampedArray, w: number, _h: number, scanOffset?: number): IBoundingBox;
}
