# ag-psd

[![Build Status](https://travis-ci.org/Agamnentzar/ag-psd.svg)](https://travis-ci.org/Agamnentzar/ag-psd)
[![npm version](https://badge.fury.io/js/ag-psd.svg)](https://badge.fury.io/js/ag-psd)

JavaScript library for reading and writing PSD files (Photoshop Document files)

Implemented according to [official documentation](https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/).

### Limitations

* Supports only RGB, Grayscale and Bitmap color modes
* Supports only 8 bits per channel
* Does not support vector/text layers
* Does not support layer masks
* Does not support color palettes
* Does not support all metadata fields
* Does not support thumbnails

## Installing

#### Node.js
```bash
npm install ag-psd
```

#### Browser
```bash
jspm install npm:ag-psd
```

## Usage

### Node.js

#### Reading

Needs [node-canvas](https://github.com/Automattic/node-canvas) peer dependency to read image data

```javascript
import * as fs from 'fs';
import { readPsd } from 'ag-psd';

var buffer = fs.readFileSync('my-file.psd');
var psd = readPsd(buffer);

console.log(psd);

fs.writeFileSync('layer-1.png', psd.children[0].canvas.getBuffer());
```

#### Writing

```javascript
import * as fs from 'fs';
import { writePsd } from 'ag-psd';

var psd = {
  width: 300,
  height: 200,
  children: [
    {
      name: 'Layer #1',
    }
  ]
};

var buffer = writePsd(psd);
fs.writeFileSync('my-file.psd', buffer);
```

### Browser

#### Reading

```javascript
import { readPsd } from 'ag-psd';

var xhr = new XMLHttpRequest();
xhr.open('GET', 'my-file.psd', true);
xhr.responseType = 'arraybuffer';
xhr.addEventListener('load', function () {
  var buffer = xhr.response;
  var psd = readPsd(buffer);

  console.log(psd);

  document.body.appendChild(psd.children[0].canvas);
}, false);
```

#### Writing

`saveAs` function from [FileSaver.js](https://github.com/eligrey/FileSaver.js/)

```javascript
import { writePsd } from 'ag-psd';

var psd = {
  width: 300,
  height: 200,
  children: [
    {
      name: 'Layer #1',
    }
  ]
};

var buffer = writePsd(psd);
var blob = new Blob([buffer], { type: 'application/octet-stream' });
saveAs(blob, 'my-file.psd');
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
      "visible": true,
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
      "visible": false,
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
gulp tests           # run tests
gulp cov             # run tests & coverage
```

### Coding

Watch task with building, testing and code coverage

```bash
gulp dev             # run with build watch task
gulp dev --tests     # run with build & tests watch tasks
gulp dev --coverage  # run with build & tests & coverage watch tasks
gulp lint            # run tslint
```
