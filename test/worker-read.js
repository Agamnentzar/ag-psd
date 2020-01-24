importScripts('/dist/bundle.js');

const createCanvas = (width, height) => {
  const canvas = new OffscreenCanvas(width, height);
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const createCanvasFromData = (data) => {
  const image = new Image();
  image.src = 'data:image/jpeg;base64,' + agPsd.byteArrayToBase64(data);
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas;
};

agPsd.initializeCanvas(createCanvas, createCanvasFromData);

onmessage = message => {
  const psd = agPsd.readPsd(message.data, { skipLayerImageData: true, skipThumbnail: true });
  const bmp = psd.canvas.transferToImageBitmap();
  delete psd.canvas; // can't post canvases
  postMessage({ psd: psd, image: bmp }, [bmp]); // need to mark bitmap for transfer
};
