import {Layer, Psd} from './psd';
import {createCanvas} from './helpers';
import {findPsdLayerById} from './findLayer';
import {CanvasRenderingContext2D} from 'skia-canvas';
import {Canvas} from 'skia-canvas/lib';
export const _flattenPsd = (psd: Psd) => {
	const layers: Layer[] | undefined = psd.children;
	if (layers) {
		let lastMergingLayer: Layer = layers[0];
		let layer: Layer;
		const psdOut: Psd = {
			width: psd.width,
			height: psd.height,
			channels: psd.channels,
			children: [],
		};
		// TODO
		for (let i = 0; i < layers.length; i++) {
			layer = layers[i];
			concatenateMasksRecursively(layer, psd);
			if (layer.mask || layer.text) {
				// Pass through
				psdOut.children!.push(lastMergingLayer);
				psdOut.children!.push(layer);
				lastMergingLayer = layers[i + 1];
			} else {
				const newLayerCanvas: Canvas = createCanvas(psd.width, psd.height);
				const newLayerCanvasContext: CanvasRenderingContext2D = newLayerCanvas.getContext('2d');
				const {bottom, canvas, left, right,top} = layers[i];
				if (lastMergingLayer !== layer) {
					newLayerCanvasContext.drawImage(lastMergingLayer.canvas!, 0, 0, lastMergingLayer.canvas!.width,
						lastMergingLayer.canvas!.height,
						lastMergingLayer.left!,
						lastMergingLayer.top!,
						lastMergingLayer.right! - lastMergingLayer.left!,
						lastMergingLayer.bottom! - lastMergingLayer.top!);
				}
				newLayerCanvasContext.drawImage(canvas!,
					0,
					0,
					(canvas)!.width,
					(canvas)!.height,
					left!,
					top!,
					right! - left!,
					bottom! - top!);
				lastMergingLayer.canvas = newLayerCanvas;
				lastMergingLayer.top = 0;
				lastMergingLayer.bottom = psd.height;
				lastMergingLayer.left = 0;
				lastMergingLayer.right = psd.width;
			}
		}
		if (layer! && !(layer.mask || layer.text)) {
			psdOut.children!.push(lastMergingLayer);
		}
		return psdOut;
	} else {
		return psd;
	}
};

export const concatenateMasks = (parentLayer: Layer, childLayer: Layer) => {
	if (!childLayer.mask) {
		if (parentLayer.mask) {
			// eslint-disable-next-line no-param-reassign
			childLayer.mask = parentLayer.mask;
		}
		return;
	}
	const parentCanvas = <any>parentLayer!.mask!.canvas;
	const childCanvas = <any>childLayer.mask.canvas;
	const compositeCanvas = createCanvas(
		childCanvas.width,
		childCanvas.height,
	);
	const compositeCanvasContext = compositeCanvas.getContext(
		'2d',
	)!;
	const childCanvasContext = childCanvas.getContext(
		'2d',
	);
	compositeCanvasContext.fillStyle = 'black';
	compositeCanvasContext.fillRect(
		0,
		0,
		compositeCanvas.width,
		compositeCanvas.height,
	);
	// Draw the parent canvas's mask as a mask to the child canvas's mask (maskception!)
	compositeCanvasContext.drawImage(
		parentCanvas,
		parentLayer.mask!.left!,
		parentLayer.mask!.top!,
	);
	const compCanvasImageData = compositeCanvasContext.getImageData(
		0,
		0,
		compositeCanvas.width,
		compositeCanvas.height,
	);
	const compCanvasData = compCanvasImageData.data;
	const childCanvasImageData = childCanvasContext.getImageData(
		0,
		0,
		childCanvas.width,
		childCanvas.height,
	);
	const childCanvasData = childCanvasImageData.data;
	for (let i = 0; i < compCanvasData.length; i += 4) {
		const concatValue = Math.ceil(
			(childCanvasData[i] * compCanvasData[i]) / 255,
		);
		compCanvasData[i] = concatValue;
		compCanvasData[i + 1] = concatValue;
		compCanvasData[i + 2] = concatValue;
		compCanvasData[i + 3] = 255;
	}
	compositeCanvasContext.putImageData(compCanvasImageData, 0, 0);
	childLayer.mask.canvas = compositeCanvas;
};


export const concatenateMasksRecursively = (layer: Layer, psd: Psd) => {
	let currentLayer: Layer = layer;
	while (currentLayer?.parentId) {
		const parentLayer: Layer = findPsdLayerById(currentLayer.parentId, psd)!;
		if (parentLayer && parentLayer.mask) {
			concatenateMasks(parentLayer, currentLayer);
		}
		currentLayer = parentLayer;
	}
};
