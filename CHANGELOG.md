# Changelog

## v11.6.0
- Added `fromVectorData` field to `mask` object that indicates if mask image data comes from vector data attached to the layer
- Added handling `globalLayerMaskInfo` field
- Fixed vector and bitmap masks not writing correctly when used at the same time on one layer

## v11.5.1
- Added missing field `operation` to paths in vector layers

## v11.5.0
- Added `noBackground` write option to force treating bottom layer as layer instead of background when it doesn't have any transparent pixels

## v11.4.0
- Added handling for artboards
- Fixed issues with handling smart objects
- Fixed issues with handling vector layers

## v11.3.0
- Added handling for *Vector Origination Data* and *Compositor Used*
- Added handling for *ICC Untagged Profile*
- Added handling for *Lock Artbords* layer option

## v11.2.0
- Added handling for smart objects
- Changed types for text warp

## v11.1.0
- Added handling for text shape (point, box)
- Fixed incorrect parsing of utf-16 strings

## v11.0.0
- **BREAKING CHANGE:** Changed all color fields from r, g, b, a array to color mode specific objects
  ```js
  // old
  var color = [red, green, blue, alpha];
  
  // new
  var rgbColor = { r: red, g: green, b: blue };
  var hsbColor = { h: hue, s: saturation, b: brightness };
  var labColor = { l: L, a: A, b: B };
  var cmykColor = { c: cyan, m: magenta, y: yellow, k: black };
  var grayscaleColor = { k: grayscaleValue };
  
  // reading new colors
  if ('r' in color) {
    // read RGB color
  } else if ('h' in color) {
    // read HSB color
  } else if ('l' in color) {
    // read Lab color
  } else if ('c' in color) {
    // read CMYK color
  } else {
    // read grayscale color
  }
  
  // almost all color in PSD document follow main document color mode, so you can use this shortcut in your code
  if ('r' in color) {
    // read RGB color
  } else {
    // error or use default
  }
  ```

## v10.0.0
- **BREAKING CHANGE:** Removed `unicodeAlphaNames` image resource (use `alphaChannelNames` instead)
- **BREAKING CHANGE:** Replaced `sheetColors` layer field with `layerColor` field
- **BREAKING CHANGE:** Changed mask density fields to be in 0-1 range (instead of 0-255)
- Removed `metadata` field from layers
- Fixed incorrectly writing layer masks information in some cases
- Added handling for adjustment layers
- Added `timestamp` field to layers
- Added `printInformation` image resource

## v9.1.1
- Fixed saved PSD files broken in some cases

## v9.1.0
- Added missing support for "stroke" blending option

## v9.0.0
- **BREAKING CHANGE:** Changed some numerical fields in effects objects to value+units fields
- Added handling for vector layers
- Added option for reading and writing raw image data using `imageData` fields corresponding to `canvas` fields on layer objects. (use `useImageData` option for reading raw data instead of using canvas objects, for writing initialize `imageData` fields instead of `canvas` fields)
- Added option for reading and writing raw, compressed thumbnail image data using `thumbnailRaw` field. (use `useRawThumbnail` option for reading raw data instead of using canvas object)
- Added `backgroundColor` image resource
- Added `xmpMetadata` image resource
- Added `printFlags` image resource
- Added `idsSeedNumber` image resource
- Added typescript type for blendModes
- Fixed writing incorrect binary data in some cases
- Fixed field name for `sectionDivider.subType`
- Fixed reading mask parameters

## v8.0.0
- Added handling for reading and writing text layer data (with some limitations)
- Added `invalidateTextLayers` write options for forcing Photoshop to redraw updated text layer.
- Removed unnecessary `version` fields from `pixelAspectRatio` and `versionInfo` image resources.

## v7.0.0
- **BREAKING CHANGE:** Normalized handling of opacity (now all opacity fields are in 0-1 range, instead of 0-255)
- **BREAKING CHANGE:** Fixed handling for colors (colors are now represented by an array of 4 values in 0-255 range as [R, G, B, A], for example: `[255, 0, 0, 255]` for opaque red color)
- Added handling for layer effects (blending options) (supports all effects except "Pattern Overlay")
- Added `writePsdUint8Array` function for saving to `Uint8Array` (this avoids double memory allocation)
- Removed unnecessary `version` field from `gridAndGuidesInformation` field

## v6.3.0
- Added exported byteArrayToBase64 function
- Updated readme with exampla of usage in web worker

## v6.2.0
- Added print scale image resource handling
- Added caption digest image resource handling

## v6.1.0
- Added loading and saving layer masks

## v6.0.0
- Changed reading to ignore not implemented features by default instead of throwing
- Removed logging missing handling for layer info
- Added `throwForMissingFeatures` and `logMissingFeatures` read options for previous behavior

## v5.0.0
- Simplified canvas initialization on NodeJS

  before:
  ```typescript
  import { createCanvas } from 'canvas';
  import { readPsd, initializeCanvas } from 'ag-psd';

  initializeCanvas(createCanvas);
  ```
  after:
  ```typescript
  import 'ag-psd/initialize-canvas';
  import { readPsd } from 'ag-psd';
  ```
- Changed `writePsd()` method to always return `ArrayBuffer`. If you need `Buffer` as a result use `writePsdBuffer()` method instead.
- Simplified script import on browser, now import is the same on both platforms.

  before:
  ```typescript
  // node
  import { readPsd } from 'ag-psd';

  // browser
  import { readPsd } from 'ag-psd/dist/browser';
  ```
  after:
  ```typescript
  // node or browser
  import { readPsd } from 'ag-psd';
  ```
