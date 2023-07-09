# ag-psd

[![Build Status](https://travis-ci.org/Agamnentzar/ag-psd.svg)](https://travis-ci.org/Agamnentzar/ag-psd)
[![npm version](https://img.shields.io/npm/v/ag-psd)](https://www.npmjs.com/package/ag-psd)

JavaScript library for reading and writing PSD files (Photoshop Document files)

Implemented according to [official documentation](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/)
, [fileformat.info](http://www.fileformat.info/format/psd/egff.htm) and a lot of trial and error.

## Limitations

* Does not support reading Indexed, CMYK, Multichannel, Duotone and LAB color modes (all supported color modes are converted to RGB mode when reading)
* Does not support writing any color modes other than RGB
* Does not support 16 bits per channel
* Does not support The Large Document Format (8BPB/PSB) 
* Does not support color palettes
* Does not support animations
* Does not support patterns (or "Pattern Overlay" layer effect)
* Does not support some metadata fields
* Does not support 3d effects
* Does not support some new features from latest versions of Photoshop
* Does not support all filters on smart layers (please report if you need a filter support added)
* Text layers implementation is incomplete
  * Writing text layer with "vertical" orientation may result in broken PSD file
  * Does not support writing or reading predefined "Paragraph Styles" or "Character Styles"
  * The library does not redraw bitmap data for the text layer, so files with updated/written text layers will result in a warning prompt when opening the file in Photoshop. [see more below](#updating-text-layers)
* This library does not handle redrawing layer and composite image data by itself when blending options, vector data or text options are changed. Any updates to image data have to be done by the user or updated by opening and re-saving the file in Photoshop.

## Installation

```bash
npm install ag-psd
```

## Usage

Description of the structure of Psd object used by `readPsd` and `writePsd` functions can be found in our [PSD Readme document](/README_PSD.md)

### Functions

```ts
// read PSD from ArrayBuffer, typed array or Node.js Buffer object
export function readPsd(buffer: Buffer | ArrayBuffer | BufferLike, options?: ReadOptions): Psd;

// write PSD to ArrayBuffer
export function writePsd(psd: Psd, options?: WriteOptions): ArrayBuffer;

// write PSD to Uint8Array (avoids some memory allocation)
export function writePsdUint8Array(psd: Psd, options?: WriteOptions): Uint8Array;

// write PSD to Node.js Buffer object
export function writePsdBuffer(psd: Psd, options?: WriteOptions): Buffer;
```

### Node.js

#### Reading

Needs [node-canvas](https://github.com/Automattic/node-canvas) to read image data and thumbnails.

```javascript
import * as fs from 'fs';
import 'ag-psd/initialize-canvas'; // only needed for reading image data and thumbnails
import { readPsd } from 'ag-psd';

const buffer = fs.readFileSync('my-file.psd');

// read only document structure
const psd1 = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
console.log(psd1);

// read document structure and image data
const psd2 = readPsd(buffer);
console.log(psd2);
// by defaults `canvas` field type is HTMLCanvasElement, so it needs to be cast to `any`
// or node-canvas `Canvas` type, in order to call `toBuffer` method
fs.writeFileSync('layer-1.png', (psd2.children[0].canvas as any).toBuffer());
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
  // skipping thumbnail and layer images here so we don't have to clear and convert them all
  // before posting data back
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
  /** Does not load layer image data. */
  skipLayerImageData?: boolean;
  /** Does not load composite image data. */
  skipCompositeImageData?: boolean;
  /** Does not load thumbnail. */
  skipThumbnail?: boolean;
  /** Does not load linked files (used in smart-objects). */
  skipLinkedFilesData?: boolean;
  /** Throws exception if features are missing. */
  throwForMissingFeatures?: boolean;
  /** Logs if features are missing. */
  logMissingFeatures?: boolean;
  /** Keep image data as byte array instead of canvas.
   * (image data will appear in `imageData` fields instead of `canvas` fields)
   * This avoids issues with canvas premultiplied alpha corrupting image data. */
  useImageData?: boolean;
  /** Loads thumbnail raw data instead of decoding it's content into canvas.
   * `thumnailRaw` field is used instead of `thumbnail` field. */
  useRawThumbnail?: boolean;
  /** Usend only for development */
  logDevFeatures?: boolean;
}

interface WriteOptions {
  /** Automatically generates thumbnail from composite image. */
  generateThumbnail?: boolean;
  /** Trims transparent pixels from layer image data. */
  trimImageData?: boolean;
  /** Invalidates text layer data, forcing Photoshop to redraw them on load.
   *  Use this option if you're updating loaded text layer properties. */
  invalidateTextLayers?: boolean;
  /** Logs if features are missing. */
  logMissingFeatures?: boolean;
  /** Forces bottom layer to be treated as layer and not background even when it's missing any transparency
   *  (by default Photoshop treats bottom layer as background if it doesn't have any transparent pixels) */
  noBackground?: boolean;
}
```

### Sample PSD document

Below is a simple example of document structure returned from `readPsd`. You can see full document structure in [psd.ts file](https://github.com/Agamnentzar/ag-psd/blob/master/src/psd.ts)

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
      "opacity": 1,
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
      "opacity": 1,
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

## Modifying documents

General approach with `ag-psd` to modifying documents is to read the document, apply the updates and write the document back.

If you read and write the same document, image data can get corrupted by automatic alpha channel pre-multiplication that happens when you load data into the canvas element. To avoid that, use raw image data, set `useImageData` option to `true` in `ReadOptions`. You can also use `useRawThumbnail` option to avoid any changes to thumbnail image.

```js
const psd = readPsd(inputBuffer, { useImageData: true });

// TODO: update psd document here

const outuptBuffer = writePsd(psd); 
```

Updating general properties that don't have visual impact on the canvas, like printing info or layer name will work correctly without any extra work.

This library does NOT generate new composite canvas based on the layer data, so changing layer order, adding or removing layers or changing layer canvas data, or blending mode, or any other property that has visual impact on the canvas will cause the composite image and thumbnail to not be valid anymore. If you need composite image or thumbnail to be correct you need to update them yourself by updating `psd.canvas` or `psd.imageData` and `psd.imageResources.thumbnail` or  `psd.imageResources.thumbnailRaw` fields. Composite image data is not required for PSD file to be readble in Photoshop so leaving old version or removing it completely may be good option. Thumbnail is only necessary for file preview in programs like Adobe Bridge or File Explorer, if you don't need to support that you can skip thumbnail as well.

This library also does NOT generate new layer canvas based on layer settings, so if you're changing any layer properties, that impact layer bitmap, you also need to update `layer.canvas` or `layer.imageData`. This includes: text layer properties, vector layer properties, smart object, etc. (this does not include layer blending options)

### Writing text layers

```js
// simple example
const psd = {
  width: 200,
  height: 200,
  children: [
    {
      name: 'text layer',
      text: {
        text: 'Hello world', // text you want to draw
        transform: [1, 0, 0, 1, 50, 50], // move text 50px horizontally and 50px vertically
        style: {
          font: { name: 'ArialMT' }, // need to provide full name here
          fontSize: 30,
          fillColor: { r: 255, g: 0, b: 0 }, // opaque red
        },
      },
    }, 
  ],
};

const buffer = writePsd(psd);
```

```js
// advanced example
const psd = {
  width: 200,
  height: 200,
  children: [
    {  
      name: 'text layer',
      text: {
        text: 'Hello world\nanother line', // text you want to draw
        transform: [1, 0, 0, 1, 50, 50], // move text 50px horizontally and 50px vertically
        style: {
          font: { name: 'ArialMT' }, // need to provide full name here
          fontSize: 30,
        },
        styleRuns: [
          {
            length: 5, // length of 'Hello'
            style: { fillColor: { r: 255, g: 0, b: 0 } }, // make 'Hello' red
          },
          {
            length: 7, // length of ' world\n'
            style: { fillColor: { r: 0, g: 0, b: 255 } }, // make 'world' blue
          },
          {
            length: 12, // length of 'another line'
            style: { fillColor: { r: 0, g: 255, b: 0 }, underline: true }, // make 'another line' green and underlined
          },
        ],
        paragraphStyle: {
          justification: 'center', // center justify whole block of text
        },
      },
    },
  ],
};

const buffer = writePsd(psd);
```

### Updating text layers

```js
const psd = readPsd(inputBuffer);

// assuming first layer is the one you want to update and has text already present
psd.children[0].text.text = 'New text here';

// optionally remove outdated image data
psd.children[0].canvas = undefined;

// needs `invalidateTextLayers` option to force Photoshop to redraw text layer on load,
// otherwise it will keep the old image data
const outuptBuffer = writePsd(psd, { invalidateTextLayers: true }); 
```

When you add text layer to PSD file it is missing image data and additional text engine information. When you open file created this way in Photoshop it will display this error message, prompting you to update layer image data. You should choose "Update" which will force Photoshop to redraw text layers from text data. Clicking "No" will result in text layers being left in broken state.

![](https://raw.githubusercontent.com/Agamnentzar/ag-psd/master/files/update-text-layers.png)

### Text layer issues

Writing or updating layer orientation to vertical can end up creating broken PSD file that will crash Photoshop on opening. This is result of incomplete text layer implementation.

## Development

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
