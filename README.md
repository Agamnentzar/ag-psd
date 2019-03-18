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
