importScripts('/dist/bundle.js');

const createCanvas = (width, height) => {
  const canvas = new OffscreenCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

agPsd.initializeCanvas(createCanvas);

onmessage = message => {
  const psd = agPsd.readPsd(message.data, { skipLayerImageData: true, skipThumbnail: true });
  const bmp = psd.canvas.transferToImageBitmap();
  delete psd.canvas; // can't post canvases
  postMessage({ psd: psd, image: bmp }, [bmp]); // need to mark bitmap for transfer
};
