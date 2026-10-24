# Changelog

## v33.0.0
- **BREAKING CHANGE:** CMYK colors stored in binary color structures (legacy `lrFX` effects, background color, filter mask, etc.) are now inverted on read and write (Photoshop stores 0 as 100% ink), matching CMYK colors read from descriptors
- **BREAKING CHANGE:** Text layers with "Windows" and "Windows LCD" anti-aliasing now read as `platform` and `platformLCD` instead of `smooth`, and writing them no longer produces `sharp` anti-aliasing
- **BREAKING CHANGE:** Hue/saturation adjustment colorize settings are now read as `colorize` and `colorization` (`hue` 0-360, `saturation`, `lightness`) fields, previously they were incorrectly read as `a`, `b`, `c`, `d` fields of `master`, which now only has `hue`, `saturation` and `lightness`
- **BREAKING CHANGE:** Removed `pathList` field (it was always empty), saved paths are now read and written as `imageResources.savedPaths`
- **BREAKING CHANGE:** Levels and curves adjustment layers now use `channels` array (index 0 is composite channel, followed by document color channels) instead of `rgb`, `red`, `green` and `blue` fields, previously black channel of CMYK documents (and other channels) was lost
- Added support for levels smart filter
- Added `savedPaths`, `workPath` and `clippingPath` image resources (paths from the Paths panel), previously they were not written back
- Added support for reading CMYK documents (8 and 16 bits per channel), image data is converted to RGB using approximation of Photoshop's default U.S. Web Coated (SWOP) v2 profile
- Added `iccProfile`, `exifData`, `iptcData`, `printStyle`, `printFlagsInfo`, `indexedColorCount`, `transparencyIndex`, `alphaChannelDisplayInfo`, `colorHalftoneScreens`, `grayscaleHalftoneScreens`, `colorTransferFunctions` and `grayscaleTransferFunctions` image resources, previously they were not written back
- Added `generatorSettings` layer field (Generator / Export As settings), and document-level `generatorSettings` (with `assets` and `crema` fields), previously it was not written back
- Added `printerProfileColorSpace` field to `printInformation`, grayscale printer profile was previously written as RGB, `printerProfile`, `blackPointCompensation` and `proofSetup` are no longer written with default values when missing
- Added `buildUp` and `group` (brush groups / folders) fields to brushes read with `readAbr`
- Added support for reading ABR version 1 and 2 files (Photoshop 6 and earlier), sampled brushes are read as brushes with `sampled` shape and sample with generated `brush-N` id
- Added pattern `linked`, `phase`, `scale` and `angle` fields to stroke effect type (they were already read and written)
- Fixed writing file read with `useRawData` option producing black composite image
- Fixed writing color palette of Indexed documents into color mode data of RGB file
- Fixed writing vector mask of layers with vector stroke as `vmsk` instead of `vsms` (and vector mask of all layers in PSB files as `vsms`), vector masks now also include path component indices like Photoshop
- Fixed writing effects of group layers in `lfx2` / `lmfx` section instead of `lfxs`
- Fixed writing Displace smart filter displacement map path without trailing null character
- Fixed writing placed layer without `width` and `height` with zero size when `warp` is provided
- Added `'Distance'` units (used by print style)
- Added `external` field to `placedLayer` for linked smart objects, they are now written as `SoLE` without `PlLd` (like Photoshop), previously they were written as embedded smart objects
- Added `gradient` and `interpolationMethod` fields to outer and inner glow effect types
- Added `throwForMissingFeatures` and `totalMemoryLimit` options to `readAbr` and `logMissingFeatures` and `throwForMissingFeatures` options to `readAse`
- Added `log` write option and `log` field to `PsdWriter`, same as for reading
- Fixed curves smart filter without preset kind removing all smart filters of the layer
- Added `shapeContour` field to bevel effect (contour used when `useShape` is enabled), previously it overwrote `contour` (gloss contour) and was lost when writing
- Added `protected.all` field for "lock all" layer protection flag
- Added `type` field to gradient color stops using foreground or background color
- Added `scale` and `angle` fields to pattern stroke and pattern fill layer content
- Added missing `angle` type on pattern overlay effect, `range` and `antialiased` on bevel effect and `technique` on outer glow effect
- Fixed writing gradient map layers with interpolation method throwing an error, and interpolation method always reading as `perceptual`
- Fixed writing layer raw data (`useRawData` option) to a file with different format (PSB to PSD or vice versa, or non-RGB color mode)
- Fixed crash reading artboard info without background color
- Fixed lost effects (other than the first) and rounded opacity of animation frames
- Fixed lost style of empty last paragraph of text layer
- Fixed reading book (Pantone) colors in descriptors throwing an error (book colors are not supported, they are read as black)
- Removed hidden properties used to write back original descriptor value types, reference classes and exact color values, values are now always written based on their current data (`GlobalObject`, `GlobalClass` and `UnitFloat` descriptor values are written as `Object`, `Class` and `UnitDouble`)
- Fixed gradient opacity stops, gradient offsets and HSB hue values changing slightly on round-trip
- Fixed changing explicit id of other layer when fixing duplicate layer ids
- Fixed writing `realMask` without `mask` producing empty user mask
- Fixed reading 16bit RLE compressed brush samples
- Fixed brushes with transfer dynamics from older Photoshop versions being skipped when reading ABR files (`transfer.wetnessDynamics` and `transfer.mixDynamics` are now optional)
- Fixed reading empty ABR file throwing `RangeError` instead of `Invalid ABR file` error
- Fixed reading legacy (non-unicode) UTF-8 alpha channel names that are not valid GBK
- Fixed empty linked file creator and type being read as `'\0\0\0\0'`
- Fixed leading BOM being stripped only from long UTF-8 strings
- Fixed JPEG thumbnails with both JFIF and Adobe markers decoding with wrong colors
- Fixed malformed patterns and brushes bypassing memory limit
- Fixed reading files with layers with negative size (now read as empty layers)
- Fixed composite image transparency marked only by `Mtrn`/`Mt16`/`Mt32` (or by "Transparency" alpha channel name in 16bit documents) being ignored
- Fixed duplicate layers in 16bit and 32bit documents with both 8bit compatibility layers and `Lr16`/`Lr32` layers
- Fixed writing `lnk3`, `lnkE`, `pths`, `extd`, `extn`, `FELS` and `artd` in PSB files with 32bit length (Photoshop uses 64bit length), files written by previous versions are still read correctly
- Fixed glow effect gradient interpolation method being lost
- Fixed gradient fill and gradient stroke scale and offset being rounded to whole percent when writing
- Fixed vector stroke without line dash set being lost
- Fixed faux bold/faux italic (synthetic) variants of the same font being merged when writing text layers
- Fixed reading photo filter version 3 colors (stored as XYZ, not Lab)
- Fixed reading pattern transparency, 16bit/32bit patterns and RLE compressed indexed patterns, unsupported or invalid patterns are now skipped instead of removing all following patterns
- Fixed invalid pattern channel bounds, brush sample sizes and section sizes in ABR files causing huge allocations or hangs
- Fixed unknown sections (for example tool presets), invalid brushes and samples failing reading of whole ABR file, they are now skipped
- Fixed ASE files with unknown blocks, unknown color modes or color types, missing color types or non-zero minor version failing to read
- Fixed frame animations (`imageResources.animations`) being lost when stored in plug-in image resource other than 4000
- Fixed reading files with 57 channels (56 channels and transparency, written by Photoshop CS3 for 53 alpha channels)
- Fixed reading files with trailing bytes in image resources section or with image resources section length larger than its data (Photoshop CS2)
- Fixed layer metadata (timestamp, animation frames, layer comps) being lost for files from Photoshop Elements (`8ELE` signature) and when one of metadata items fails to read
- Fixed reading stroke effect size stored as number (old Photoshop versions)
- Fixed display info (`alphaChannelDisplayInfo`) being lost when channel color uses unsupported color space, the color is kept in `rawColor` field
- Fixed layers with unknown blend mode failing the whole file, they are read with normal blend mode (unless `throwForMissingFeatures` is set)
- Added support for reading CMYK patterns
- Added `colorSamplers` (Photoshop 5 color samplers) and `effectsVisible` image resources, obsolete display info resource is read into `alphaChannelDisplayInfo`
- Added `color` and `id` fields to guides (`gridAndGuidesInformation.guides`)
- Added `windowsDevMode` (raw printer settings) and `outputSettings` (Save for Web output settings) image resources
- Frame info plug-in resource is written together with animations, plug-in resources are written with consecutive ids like in Photoshop
- Added reading of uncompressed (raw RGB) thumbnails
- Fixed JPEG thumbnails with number of planes other than 1 not being read

## v32.0.0
- **BREAKING CHANGE:** Mask opacity (`filterMask.opacity`, `userMask.opacity` from `LMsk`, `globalLayerMaskInfo.opacity`) is now read and written using the correct 0-100 scale (Photoshop's default 50% now reads as `0.5` instead of `0.196`)
- **BREAKING CHANGE:** HSB, CMYK, Lab and Grayscale colors in descriptors (effects, gradients, filters) are now converted to the ranges documented on the `Color` type (HSB `s`/`b` 0-1, CMYK and Gray 0-255, Lab `l` 0-1 and `a`/`b` -1..1)
- **BREAKING CHANGE:** Gradient stop locations are no longer scaled by gradient smoothness
- **BREAKING CHANGE:** Text style runs without a font now use the font of the normal style sheet instead of the first font in the font set (usually `AdobeInvisFont`)
- **BREAKING CHANGE:** Only one trailing newline is removed from text layer text, empty last paragraphs are preserved
- **BREAKING CHANGE:** Renamed `TextPath.BaselineAlignment` to `baselineAlignment` to match decoded data
- Fixed decoding 16bit and 32bit RLE compressed image data
- Fixed reading 16bit and 32bit files modifying input buffer
- Fixed reading 16bit and 32bit files with transparent composite image
- Fixed reading composite image with extra alpha/spot channels
- Fixed reading files with more than 16 channels (up to 56)
- Fixed reading indexed composite image with raw compression
- Fixed `getCompositeImageData` for PSB files and files with transparency (added `rawCompositeDataInfo` field to `Psd`, set together with `rawCompositeData`)
- Fixed writing composite image, layers and patterns with very narrow width (1-2 pixels)
- Fixed writing masks with both feather parameters producing files that couldn't be read back
- Fixed layer mask data padding to match Photoshop (padded to multiple of 4 bytes)
- Layers with animation frames, timeline or layer comps now get generated layer id when writing if `id` field is missing
- Fixed writing timeline without audio, pattern `linked` field, colored slices, pixel source (video) layers, print proof setup, and some smart filters (perspective warp, oil paint, curves, hsb/hsl)
- Fixed writing linked files (`lnkE`) producing files that couldn't be read back
- Fixed negative guide positions
- Fixed lost or incorrect values on round-trip: channel blending restrictions, filter effect mask extra data, animation frame layer ids, timeline effect keys, pattern overlay angle, grid leading fill color, photo filter Lab color, and several values truncated instead of rounded
- Fixed reading text annotations with empty or odd-length data
- Fixed parsing and serializing engine data with `null` values inside arrays and `undefined`/`NaN` values
- Fixed writing text layers with `FRGB` or `HSB` colors, empty `styleRuns`, CRLF line endings and missing bounds
- Fixed crashes and infinite loops on malformed files (RLE data, zip data, JPEG thumbnails, layer groups, engine data, brushes)
- Fixed memory limit not applying to zip-compressed data
- Reduced memory usage and copying when reading and writing files

## v31.0.3
- Fixed crash when string doesn't contain utf-16 BOM

## v31.0.1
- Fixed incorrect handling of memory limit

## v31.0.0
- **BREAKING CHANGE:** Added default memory limit when decoding PSD files of 2GB, pass larger `totalMemoryLimit` in read options if you need to decode larger files, or use new api detailed in [Use in production section](/README.md#use-in-production-environments-and-handling-unsafe-user-provided-data)
- Added `totalMemoryLimit` field to read options
- Added new function for easier safe handling of large or unsafe files
- Fixed decoding indexed patterns

## v30.2.0
- Added partial support for loading and saving document-level patterns

## v30.0.1
- Fixed handling files with 16bit color format

## v30.0.0
- Added `useRawData` property to read options, if it's set to `true` the layer and mask image data will not be decompressed by `readPsd` function. Instead it can be decompressed for individual layers using `decodeLayerPixels` function.

## v29.1.0
- Fixes for importing ABR files

## v29.0.0
- Remove `createCanvasFromData` parameter from `initializeCanvas` function, simplifying handling of custom canvas classes

## v28.5.1
- Fixed handling for `transform` property in `vectorOrigination` section

## v28.5.0
- Added partial support for `pixelSource` section
- Reworked ABR brush types

## v28.4.0
- Added support for reading compressed patterns in ABR files

## v28.1.0
- Added support for reading and writing `choke` parameter for layer effects

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
