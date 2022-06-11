# PSD document format

This document describes structure of the Psd object used in `readPsd` and `writePsd` functions, you can see instructions on how to use these functions in our [main README document](/#functions)

You can see examples of different PSD documents and their corresponding JSON data in our [test folder](/test/read)

## Basic document structure

```ts
// example psd document structure
const psd: Psd = {
  "width": 300,
  "height": 200,
  "channels": 3,
  "bitsPerChannel": 8,
  "colorMode": 3,
  "canvas": <Canvas>,
  "children": [ /* ... */ ],
  "imageResources": { /* ... */ },
  "linkedFiles": [ /* ... */ ],
  "artboards": { /* ... */ },
  "annotations": [ /* ... */ ],
  "globalLayerMaskInfo": { /* ... */ },
  "filterMask": { /* ... */ },
};
```

- The `width` and `height` properties specify PSD document size in pixels. These values are required when writing a document.

  ![](/files/width-height.png)

- `channels` property specifies number of color channels in the document, it's usually 3 channels (red, green, and blue, when document is in typical RGB color mode) Other color modes will have different channel count (grayscale - 1 channel, CMYK - 4 channels). This property can be ommited when writing, this library only supports RGB color mode with 3 channels at the moment.

- `bitsPerChannel` property specifies number of bits per each color channel, this value will ba 1 for one bit bitmap color mode and 8 in all other cases as this library is not supporting 16 or 32 bit color channels at the moment. It can also be ommited when writing a document and default value of 8 will be assumed.

- `colorMode` specifies color mode of the PSD document.

  ![](/files/color-mode.png)

  Value is one of the numbers that can be matched to this enumerable:

  ```ts
  enum ColorMode {
    Bitmap = 0,
    Grayscale = 1,
    Indexed = 2,
    RGB = 3,
    CMYK = 4,
    Multichannel = 7,
    Duotone = 8,
    Lab = 9,
  }
  ```
  The library supports "Bitmap", "Grayscale" and "RGB" color modes at the moment. "Bitmap" and "Grayscale" colors will be converted to "RGB" colors when reading PSD file. Writing is only supported for "RGB" mode. The value can be ommited for writing and "RGB" color mode will be assumed.

- `canvas` (or `imageData`) is a property containing bitmap with composite image data for the entire document. PSD file contains this extra bitmap additionally to bitmaps of each layer. `canvas` field will be an instance of `HTMLCanvasElement` (in browser environment) or `Canvas` object of `node-canvas` library (in nodejs environment).

  You can choose to instead use `imageData` field by choosing `useImageData: true` option when reading PSD file. In that can `imageData` will be an instance of `ImageData` object, containing `width`, `height` and `data` properties. This is useful if you want to use bitmap data directly, and not use it for drawing using canvas. Additionally this will preserve accurate color information as canvas element will premultiply image alpha which will change color values slightly.
  
  If you don't need to use this field you can specify `skipCompositeImageData: true` option, while reading PSD file, to skip reading this field and save on processing time and memory usage.
  
  This image data is optional in PSD file so it may be missing in some PSD files that opted to skip it.
  
  When writing you can provide either `canvas` or `imageData` property and the library will use the one you provide. You can also skip the field entirely and not write this data at all as it's not needed by Photohop to read the file. It might be used in some other application, for thumbnails or by some old versions of Adobe software, so you may want to still provide it to remain compatible with those programs.
  
  If you're generating your own PSD file and want to provide this composite image data you will have to generate one yourself by composing all layer image data and effects yourself, this library does not provide any utilities to generate this image data for you.

- `children` list of layers and groups at the root of the document. [see Layers and Groups](#layers-and-groups)

- `imageResources` contains all document-wide parameters [see Image Resouces](#image-resources)

- `linkedFiles` contains list of files, linked in smart objects [see Smart Objects](#smart-objects)

- `artboards` contains global options for artboards. Artboards is a feature in new versions of Photoshop that lets you have multiple canvases in a single PSD document. The information about positioning, name and color of each artboard is stored inside each layer, in `artboard` property. This property will be absent if the document does not have any artboards specified. It can be ommited when writing.

  ```ts
  type Artboards = {
    count: number; // number of artboards in the document
    autoExpandOffset?: { horizontal: number; vertical: number; };
    origin?: { horizontal: number; vertical: number; };
    autoExpandEnabled?: boolean;
    autoNestEnabled?: boolean;
    autoPositionEnabled?: boolean;
    shrinkwrapOnSaveEnabled?: boolean;
    docDefaultNewArtboardBackgroundColor?: Color;
    docDefaultNewArtboardBackgroundType?: number;
  }
  ```

- `annotations` contains array of annotations, this field will be absent if the document does not have any annotations. It can be ommited when writing. Sound annotations are not supported by this library right at the moment.

  ![](/files/annotations.png)

  Each annotation object has a following structure:

  ```ts
  interface Annotation {
    type: 'text' | 'sound';
    open: boolean;
    iconLocation: { left: number; top: number; right: number; bottom: number };
    popupLocation: { left: number; top: number; right: number; bottom: number };
    color: Color;
    author: string;
    name: string;
    date: string;
    data: string | Uint8Array; // annotation text or sound buffer
  }
  ```

- `globalLayerMaskInfo` don't really know what this is, it can be ommited when writing.

- `filterMask` don't really know what this is, it can be ommited when writing.

## Layers and Groups

_TODO: general information about layer vs groups_

_TODO: tree structure_

### Layer types

You can distinguish between different layer types by checking which properties thay have set on them. If a layer has `children` property set it meas the it's a group, if it has `text` property it's a text layer and so on. If you're only interested in the basic parsing of layers and want to just extract image data or layer parameter a simple parsing like this can be enough:

```js
// simple parsing
function parseLayer(layer) {
  if ('children' in layer) {
    // group
    layer.children.forEach(parseLayer);
  } else if (layer.canvas) {
    // regular layer with canvas
  } else {
    // empty or special layer
  }
}
```

If you need to know type of each layer, something like this could be a good approach:

```ts
// complex parsing
function parseLayer(layer) {
  if ('children' in layer) {
    // group
    layer.children.forEach(parseLayer);
  } else if ('text' in layer) {
    // text layer
  } else if ('adjustment' in layer) {
    // adjustment layer
  } else if ('placedLayer' in layer) {
    // smart object layer
  } else if ('vectorMask' in layer) {
    // vector layer
  } else {
    // bitmap layer
  }
}
```

But thake into account that a lot of properties are shared for different types of layers. Any layer can have a `mask` property for example.

### Layer

Example layer structure:

```json
{
  "top": 0,
  "left": 0,
  "bottom": 200,
  "right": 300,
  "blendMode": "normal",
  "opacity": 1,
  "clipping": false,
  "timestamp": 1448235572.7235785,
  "transparencyProtected": true,
  "protected": {
    "transparency": true,
    "composite": false,
    "position": true
  },
  "hidden": false,
  "name": "Background",
  "nameSource": "bgnd",
  "id": 1,
  "layerColor": "none",
  "blendClippendElements": true,
  "blendInteriorElements": false,
  "knockout": false,
  "referencePoint": {
    "x": 0,
    "y": 0
  },
  "canvas": <Canvas>
},
```

- `top`, `left`, `bottom`, `right` properties specify location of layer image data withing the document. `top` specifies offset in pixel of the top of layer image data from the top edge of the document, `bottom` specifies offset of the bottom of the layer image data from the top adge of the document and similar for `left` and `right`.

  This is necessary as layer image data can be smaller or large than the document size. This can cause in some cases the values of these fields to be negative. A value of `left: -100` means that the layer image data starts 100 pixels outside the left document edge. This can happen if you move the layer left beyond document edge in Photoshop.
  
  `top` and `left` values can be ommited when writing and will be assumed to be 0. `bottom` and `right` values can be ommited and will always be ignored when writing and will instead be calculated from `canvas` (or `imageData`) width and height.

- `blendMode` is a layer blending mode and will be one of the following values:

  ```ts
  type BlendMode = 'pass through' | 'normal' | 'dissolve' | 'darken' |
  'multiply' | 'color burn' | 'linear burn' | 'darker color' | 'lighten'|
  'screen' | 'color dodge' | 'linear dodge' | 'lighter color' | 'overlay' |
  'soft light' | 'hard light' | 'vivid light' | 'linear light' | 'pin light' |
  'hard mix' | 'difference' | 'exclusion' | 'subtract' | 'divide' | 'hue' |
  'saturation' | 'color' | 'luminosity'
  ```
  
  These values correspond to naming in layer blend mode dropdown. If ommited a value of `normal` will be assumed.

  [](/files/blend-modes.png)

- `opacity` specifies level of layer transparency (the value range is from 0 to 1). Can be ommited when writing, a default value of 1 will be assumed.

  ![](/files/opacity.png)

- `clipping` indicates if layer clipping is enabled (if enabled the layer is clipped to the layer below it). Can be ommited when writing, a default value of `false` will be assumed.

  ![](/files/clipping.png)
  
  ![](/files/clipping-2.png)

- `timestamp` timestamp of last time layer was modified (in unix time). Can be ommited when writing.

- `transparencyProtected` and `protected` properties specify status of various locks that you can set for each layer.

  ![](/files/locks.png)

  - `protected.position` indicates if moving layer is locked
  - `protected.composite` indicates if drawing on the layer is locked
  - `protected.transparency` indicates if drawing transparent pixels are locked

  If the `transparencyProtected` is `true` but `protected.transparency` is `false` it means that the layer has "lock all" enabled. Both this fields can be ommited when writing, a values of `false` will be assumed for all of the ommited fields.

- `hidden` indicates if the layer is hidden. Can be ommited when writing, a value of `false` will be assumed.

  ![](/files/hidden.png)

- `name` name of the layer, can be any unicode string, can be empty. Can be ommited when writing, a value of `''` will be assumed.

- `nameSource` internal Photoshop information, can be ignored and ommited when writing.

- `id` unique ID number for layer, it may be missing in some PSD files. Can be ommited when writing, but if provided it has to be a unique number, if duplicate IDs are found they will be changed to a unique ones when writing the file.

- `layerColor` color of the layer in layer list, property will be missing or will be one of the following values:

  ```ts
  type LayerColor = 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'gray'
  ```

  ![](/files/layer-color.png)

- `blendClippendElements` _TODO_
- `blendInteriorElements` _TODO_
- `knockout` _TODO_
- `referencePoint` _TODO_
- `mask` _TODO_
- `filterMask` _TODO_
- `effects` _TODO_
- `text` _TODO_
- `patterns` _TODO_
- `vectorFill` _TODO_
- `vectorStroke` _TODO_
- `vectorMask` _TODO_
- `usingAlignedRendering` _TODO_
- `pathList` _TODO_
- `adjustment` _TODO_
- `placedLayer` _TODO_
- `adjustment` _TODO_
- `vectorOrigination` _TODO_
- `compositorUsed` _TODO_
- `artboard` _TODO_
- `fillOpacity` _TODO_
- `transparencyShapesLayer` _TODO_
- `engineData` _TODO_

- `canvas` (or `imageData`) see `canvas` property description in [Basic document structure ](#basic-socument-structure)

_TODO: write what bitmaps contain and what they don't_

### Group

TODO: example

TODO: common fields

Groups have the most of the same fields that layers do except ........

**Group-only fields:**

- `children` contains list of all layers in this group. **Cannot** be ommited when writing, without this field a group will be assumed to be a regular layer. Use empty `children` array when writing empty group.

- `opened` indicates if the group is expanded or collapsed in the layer list. If ommited a default values of `true` will be assumed.

  ![](/files/group-open.png)

- `sectionDivider` internal Photoshop property, can be ignored and ommited when writing.

## Image Resources

_TODO_

## Smart Objects

_TODO_

## Colors

Many fields in PSD file support passing color in different color formats (RGBA, RGB, HSB, CMYK, LAB, Grayscale) Those fields will use `Color` type which is a union of all of these color formats. The color types have following structure:

```ts
type RGBA = { r: number; g: number; b: number; a: number; }; // values from 0 to 255
type RGB = { r: number; g: number; b: number; }; // values from 0 to 255
type HSB = { h: number; s: number; b: number; }; // values from 0 to 1
type CMYK = { c: number; m: number; y: number; k: number; }; // values from 0 to 255
type LAB = { l: number; a: number; b: number; }; // values `l` from 0 to 1; `a` and `b` from -1 to 1
type Grayscale = { k: number }; // values from 0 to 255
type Color = RGBA | RGB | HSB | CMYK | LAB | Grayscale;
```

When you want to set field with a `Color` type, it's pretty straightforward, you can just choose any of the formats you like and set it on the field:

```ts
strokeEffect.color = { h: 0.79, s: 0.54, b: 0.93 };
```

Reading a color field is more complicated, you need to check what color format the field is in and then run correct code to handle it, here's how to do it for all color types:

```ts
if ('l' in color) {
  // color is LAB
} else if ('c' in color) {
  // color is CMYK
} else if ('h' in color) {
  // color is HSB
} else if ('k' in color) {
  // color is Grayscale
} else if ('a' in color) {
  // color is RGBA
} else {
  // color is RGB
}
```

If you expect the fields to be in one specific format you can just verity that it's correct and throw an error if it's a format that you didn't expect:

```ts
// handle only RGB colors
if ('r' in color && !('a' in color)) {
  // color is RGB
} else {
  throw new Error('Invalid color');
}
```
