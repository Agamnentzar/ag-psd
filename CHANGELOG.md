# Changelog

## v28.0.0
- **BREAKING CHANGE:** Removed `layersGroup` and `layerGroupsEnabledId` properties from `imageResources` and instead added `linkGroup` and `linkGroupEnabled` fields to layers.

## v27.0.0
- Added support for read-only field `text.textPath` with text path information for text layers. This field is extracted from psd.engineData, which is not fully supported yet.

## v26.0.0
- Added support for `realMask` section

## v25.0.0
- Added support for `blendingRanges` section
- Added support for `interpolationMethod` for gradients

## v24.0.0
- Added support for `curves` smart object filter
- Added support for reading and writing `palette` field
- Added support for reading PSD file with palette color mode
- Fixed parsing for `filterEffectsMasks` section
- Fixed padding for section data
- Fixed reading some fields in `compositorUsed` section
- Fixed incorrect writing for some smart object filters

## v23.1.0
- Added support for perspective warp filter

## v23.0.0
- Fixed handling externally linked files in smart object layers

## v22.0.0
- Fixed parsing path `smooth` gradient interpolation method
- Changed `PsdReader` type

## v21.0.0
- Fixed parsing path `operation` field to handle empty value

## v20.2.1
- Fixed invalid value of `globalAngle` when the value is negative

## v20.2.0
- Fixed missing handling for justified paragraphs
- Fixed reading slice names

## v20.1.0
- Improve performance of encoding and decoding large text fields.
- Added initial support for 32bit image data.
- Fixed handling compressed encoding mode by switching to better compression library.

## v20.0.0
- Added support for reading 16bit image data, when reading PSD width default settings 16bit data will be converted to regular 8bit canvases, when `useImageData: true` is passed in read options the image data will be of type `Uint16Array` for 16bit images. Because of that type of `layer.imageData` and `psd.imageData` and `layer.mask.imageData` can be of different types depending on PSD file bitDepth.
- Added support for reading image data compressed with zip with prediction mode.
- Added support for layer comps (`psd.imageResources.layerComps` and `layer.comps` fields)

## v19.0.1
- Fixed incorrect layer trimming when using `layer.imageData` property instead of `layer.canvas`

## v19.0.0
- Added brush type to ABR
- Fixed importing smudge and mixer brushes from ABR
- Fixed saving mask without canvas/imageData
- Fixed rare issue with saving files resulting in corrupted file

## v18.0.1
- Fixed incorrect writing of `fillRule` field for vector paths

## v18.0.0
- Added `fillRule` field to vector paths

## v17.0.6
- Fixed broken file after saving with layer name longer than 255 characters

## v17.0.5
- Fixed incorrect parsing of external linked files
- Fixed incorrect parsing of compositorUsed section when some fields are missing

## v17.0.4
- Fixed saving smart layers without placedLayer.warp field present for newer versions of photoshop

## v17.0.3
- Added extra error checks and fixed writing PSD without placedLayer.warp field present

## v17.0.2
- Fixed issues with writing some layer effects

## v17.0.1
- Fixed incorrect reading and writing of slice bounds
- Fixed missing bounds and boundingBox fields on `layer.text`

## v17.0.0
- Added `effectsOpen` field to layers
- Added support for basic set of smart layer filters
- Changed the way smart layer filters are typed (`placedLayer.filter`)

## v16.0.0
- Added support for different color modes in text layer colors
- Added option for other smart layer filter types

## v15.3.0
- Added support for smart layer puppet filter (`placedLayer.filter`)

## v15.2.0
- Added handling missing `font` in text layer style by assuming first font on the list

## v15.1.0
- Added support for float color in effects, new color type was added
  ```ts
  export type FRGB = { fr: number; fg: number; fb: number; }; // values from 0 to 1 (can be above 1)
  ```
- Changed `time` field on `LinkedFile` from `Date` to `string` type

## v15.0.0
- Added support for frame and timeline animations

## v14.5.0
- Added support for zip compression without prediction of image data
- Added support for `compress` option when writing

## v14.4.0
- Added support for `layerMaskAsGlobalMask` flag
- Added support for `interpolationMethod` for gradient overlay layer blending mode

## v14.3.13
- Fixed handling files with incorrect channel image data length

## v14.3.11
- Fixed corrupted file when passing non-integer values to `layer.left`, `.top`, `.right`, `.bottom`

## v14.3.9
- Fixed reading some corrupted files

## v14.3.8
- Fixed handling files with incorrect section sizes

## v14.3.6
- Fixed incorrect writing of `vogk` section in some cases resulting in a broken file

## v14.3.6
- Fixed incorrect writing of `vogk` section in some cases resulting in a broken file

## v14.3.2
- Added `nonAffineTransform` field to smart object transform when nonAffineTransform is diferent than regular transform

## v14.3.1
- Fixed writing paragraphStyle autoLeading property (previous it was writing incorrectly for whole values, like 1.0 or 2.0)

## v14.3.0
- Added support for `fillOpacity` and `transparencyShapesLayer`
- Fixed error in some cases when reading files with deeply nested layers

## v14.2.0
- Added `readCsh` function for reading photoshop custom shape files

## v14.1.0
- Added support for `imageReadyVariables` and `imageReadyDataSets` image resources
- Fix missing support for alternative image resource block signatures

## v14.0.1
- Added missing handling for new platform and platformLCD text anti-aliasing modes

## v14.0.0
- Added handling for annotations
- **BREAKING CHANGE:** Fixed reading and writing non-RGB colors and documented value ranges (value ranger for HSB, CMYK, Lab and Grayscale colors different from previous versions)
  ```ts
  export type RGBA = { r: number; g: number; b: number; a: number; }; // values from 0 to 255
  export type RGB = { r: number; g: number; b: number; }; // values from 0 to 255
  export type HSB = { h: number; s: number; b: number; }; // values from 0 to 1
  export type CMYK = { c: number; m: number; y: number; k: number; }; // values from 0 to 255
  export type LAB = { l: number; a: number; b: number; }; // values `l` from 0 to 1; `a` and `b` from -1 to 1
  export type Grayscale = { k: number }; // values from 0 to 255
  export type Color = RGBA | RGB | HSB | CMYK | LAB | Grayscale;
  ```
- Fixed not handling correct value for text gridding

## v13.0.2
- Fixed error when opening PSB file with smart objects

## v13.0.1
- Fixed reading layer groups with missing section divider info

## v13.0.0
- **BREAKING CHANGE:** Changed how `meshPoints` are represented in warps
```ts
// old representation
interface Warp {
  meshPoints: { type: 'horizontal' | 'vertical'; values: number[]; }[];
}

// new representation
interface Warp {
  meshPoints: { x: number; y: number; }[];
}
 ```
- Fixed handling for complex warps

## v12.2.0
- Fixed incorrect length of style and paragraph style runs when reading or writing
- Added handling for `pathSelectionState`

## v12.1.0
- Added support for reading and writing PSB files (Large Document Format)

  Use `psb: true` in write options to write file in PSB format)
  
  The sizes are still limited by 32bit integer number range and will throw an error if you attempt to read any file larger than 2GB.
- Fixed some fields not handled in `vectorOrigination`

## v12.0.0
- **BREAKING CHANGE:** Added support for multiples of the same layer blending effect, these `layer.effects` keys are now arrays:
	- `dropShadow`
	- `innerShadow`
	- `solidFill`
	- `stroke`
	- `gradientOverlay`

  WARNING: adding more than one of effect in these arrays will result in file being saved with new version of effects section that is not readable on older versions of Photoshop.

## v11.6.2
- Fixed smart layer block info not parsing correctly in some cases
- Added automatic deduplication of layer IDs

## v11.6.1
- Fixed group blending modes not writing correctly

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
