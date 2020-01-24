# ag-psd

[![Build Status](https://travis-ci.org/Agamnentzar/ag-psd.svg)](https://travis-ci.org/Agamnentzar/ag-psd)
[![npm version](https://badge.fury.io/js/ag-psd.svg)](https://badge.fury.io/js/ag-psd)

JavaScript library for reading and writing PSD files (Photoshop Document files)

Implemented according to [official documentation](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/)
and [fileformat.info](http://www.fileformat.info/format/psd/egff.htm).

### Limitations

* Supports only RGB, Grayscale and Bitmap color modes
* Supports only 8 bits per channel
* Does not support The Large Document Format (8BPB/PSB) 
* Does not support vector/text layers
* Does not support color palettes
* Does not support all metadata fields

## Installing

```bash
npm install ag-psd
```

## Usage

### Node.js

#### Reading

Needs [node-canvas](https://github.com/Automattic/node-canvas) to read image data or thumbnails

```javascript
import * as fs from 'fs';
import 'ag-psd/initialize-canvas'; // only needed for reading image data and thumbnails
import { readPsd, initializeCanvas } from 'ag-psd';

const buffer = fs.readFileSync('my-file.psd');

// read only document structure
const psd1 = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
console.log(psd1);

// read document structure and image data
const psd2 = readPsd(buffer);
console.log(psd2);
fs.writeFileSync('layer-1.png', psd2.children[0].canvas.getBuffer());
```

#### Writing

```javascript
import * as fs from 'fs';
import 'ag-psd/initialize-canvas'; // only needed for writing image data and thumbnails
import { writePsdBuffer } from 'ag-psd';

const psd = {
  width: 300,
  height: 200,
  children: [
    {
      name: 'Layer #1',
    }
  ]
};

const buffer = writePsdBuffer(psd);
fs.writeFileSync('my-file.psd', buffer);
```

### Browser

#### Reading

```javascript
import { readPsd } from 'ag-psd';

const xhr = new XMLHttpRequest();
xhr.open('GET', 'my-file.psd', true);
xhr.responseType = 'arraybuffer';
xhr.addEventListener('load', function () {
  const buffer = xhr.response;
  const psd = readPsd(buffer);

  console.log(psd);

  document.body.appendChild(psd.children[0].canvas);
}, false);
xhr.send();
```

#### Writing

`saveAs` function from [FileSaver.js](https://github.com/eligrey/FileSaver.js/)

```javascript
import { writePsd } from 'ag-psd';

const psd = {
  width: 300,
  height: 200,
  children: [
    {
      name: 'Layer #1',
    }
  ]
};

const buffer = writePsd(psd);
const blob = new Blob([buffer], { type: 'application/octet-stream' });
saveAs(blob, 'my-file.psd');
```

### Browser (bundle)

```html
<script src="node_modules/ag-psd/dist/bundle.js"></script>
<script>
  var readPsd = agPsd.readPsd;
  // rest the same as above
</script>
```

### Browser in Web Worker

#### Reading

Browser has to support `OffscreenCanvas` and `bitmaprenderer` context.

```js
// worker.js

importScripts('bundle.js');

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
  // skipping thumbnail and layer images here so we don't have to clear and convert them all before posting data back
  const psd = agPsd.readPsd(message.data, { skipLayerImageData: true, skipThumbnail: true });
  const bmp = psd.canvas.transferToImageBitmap();
  delete psd.canvas; // can't post canvases back from workers
  postMessage({ psd: psd, image: bmp }, [bmp]); // need to mark bitmap for transfer
};


// main script (assumes using bundle)

const worker = new Worker('worker.js');
worker.onmessage = message => {
  const psd = message.data.psd;
  const image = message.data.image;
  
  // convert image back to canvas
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('bitmaprenderer').transferFromImageBitmap(image);

  document.body.appendChild(canvas);
  console.log('psd:', psd);
};

const xhr = new XMLHttpRequest();
xhr.open('GET', 'src.psd', true);
xhr.responseType = 'arraybuffer';
xhr.addEventListener('load', function () {
  // read using worker
  worker.postMessage(buffer, [buffer]);
}, false);
xhr.send();
```

#### Writing

```js
// worker.js

importScripts('bundle.js');

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


// main script (assumes using bundle)

const worker = new Worker('/test/worker-write.js');
worker.onmessage = message => {
  const blob = new Blob([message.data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.textContent = 'Download generated PSD';
  a.download = 'example_psd.psd';
  document.body.appendChild(a);
};

const canvas = new OffscreenCanvas(200, 200);
const context = canvas.getContext('2d');
context.fillStyle = 'white';
context.fillRect(0, 0, 200, 200);
context.fillStyle = 'red';
context.fillRect(50, 50, 120, 110);
const bmp = canvas.transferToImageBitmap(); // convert canvas to image bitmap for transfering to worker
const psd = {
  width: 200,
  height: 200,
  children: [
    {
      name: 'Layer 1',
    }
  ]
};
worker.postMessage({ psd: psd, image: bmp }, [bmp]);
```

You can see working example in `test/index.html`, `test/worker-read.js` and `test/worker-write.js`.

### Options

```typescript
interface ReadOptions {
  /** does not load layer image data */
  skipLayerImageData?: boolean;
  /** does not load composite image data */
  skipCompositeImageData?: boolean;
  /** does not load thumbnail */
  skipThumbnail?: boolean;
}

interface WriteOptions {
  /** automatically generates thumbnail from composite image */
  generateThumbnail?: boolean;
  /** trims transparent pixels from layer image data */
  trimImageData?: boolean;
}
```

### Sample PSD document

```json
{
  "width": 300,
  "height": 200,
  "channels": 3,
  "bitsPerChannel": 8,
  "colorMode": 3,
  "children": [
    {
      "top": 0,
      "left": 0,
      "bottom": 200,
      "right": 300,
      "blendMode": "normal",
      "opacity": 255,
      "transparencyProtected": false,
      "hidden": true,
      "clipping": false,
      "name": "Layer 0",
      "canvas": [Canvas]
    },
    {
      "top": 0,
      "left": 0,
      "bottom": 0,
      "right": 0,
      "blendMode": "multiply",
      "opacity": 255,
      "transparencyProtected": true,
      "hidden": false,
      "clipping": false,
      "name": "Layer 3",
      "canvas": [Canvas]
    }
  ],
  "canvas": [Canvas]
}
```

## Developing

### Building

```bash
gulp build
```

### Testing

```bash
gulp test            # run tests
gulp cov             # run tests & coverage
```

### Coding

Watch task with building, testing and code coverage

```bash
gulp dev             # run with build watch task
gulp dev --coverage  # run with build & tests & coverage watch tasks
npm run lint         # run tslint
```
