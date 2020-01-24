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
  const psd = message.data.psd;
  const image = message.data.image;

  // convert bitmap back to canvas
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.getContext('bitmaprenderer').transferFromImageBitmap(image);
  // need to draw onto new canvas because single canvas can't use both '2d' and 'bitmaprenderer' contexts
  const canvas2 = new OffscreenCanvas(canvas.width, canvas.height);
  canvas2.getContext('2d').drawImage(canvas, 0, 0);

  console.log(psd, canvas2);
  psd.children[0].canvas = canvas2;
  psd.canvas = canvas2;
  const data = agPsd.writePsd(psd);
  postMessage(data, [data]); // mark data as transferable
};
