import { LayerEffectsInfo } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export declare function readEffects(reader: PsdReader): LayerEffectsInfo;
export declare function writeEffects(writer: PsdWriter, effects: LayerEffectsInfo): void;
