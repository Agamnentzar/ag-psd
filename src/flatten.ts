import {Layer, Psd} from './psd';
import {createCanvas} from './helpers';
import {findPsdLayerById} from './findLayer';


export const flattenPsd = (psd: Psd) => {
	const layers: Layer[] | undefined = psd.children;
	if (layers) {
		let lastMergingLayer: Layer = layers[0];
		let layer: Layer;
		// Pre-test for compatibility
		for (let i = 0; i < layers.length; i++) {
			layer = layers[i];
			if (!layer.canvas && layer.mask?.canvas && layer.children && layer.children.length > 0) {
				// TODO Support masked layer groups
				console.warn('Layer groups with masks cannot be flattened yet. Returning unmodified PSD.');
				return psd;
			}
		}
		// Create a new output PSD
		const psdOut: Psd = { ...psd };
		psdOut.children = [];
		// Loop through all the layers. If we find a simple layer without mask or text, we concatenate all previous simple layers into it
		for (let i = 0; i < layers.length; i++) {
			layer = layers[i];
			if (layer.mask || layer.text || !layer.canvas) {
				// Pass through
				if (lastMergingLayer !== layer) {
					psdOut.children!.push(lastMergingLayer);
				}
				psdOut.children!.push(layer);
				lastMergingLayer = layers[i + 1];
			} else {
				const newLayerCanvas = createCanvas(psd.width, psd.height);
				const newLayerCanvasContext: CanvasRenderingContext2D = newLayerCanvas.getContext('2d')!;
				const {bottom, canvas, left, right,top} = layer;
				if (lastMergingLayer !== layer) {
					newLayerCanvasContext.drawImage(lastMergingLayer.canvas!, 0, 0, lastMergingLayer.canvas!.width,
						lastMergingLayer.canvas!.height,
						lastMergingLayer.left!,
						lastMergingLayer.top!,
						lastMergingLayer.right! - lastMergingLayer.left!,
						lastMergingLayer.bottom! - lastMergingLayer.top!);
				}
				newLayerCanvasContext.globalAlpha = layer.opacity as number;
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
				concatenateMasks(layer, lastMergingLayer);
			}
		}
		if (layer! && !(layer.mask || layer.text || !layer.canvas)) {
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
