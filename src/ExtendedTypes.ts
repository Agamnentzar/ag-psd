import {Layer, Psd} from 'ag-psd';

export type LayerExtended = Omit<Layer, 'children'> & { children?: LayerExtended[], parentId: number | undefined};
export type PsdExtended = Omit<Psd, 'children'> & { children?: LayerExtended[], parentId: number | undefined};
