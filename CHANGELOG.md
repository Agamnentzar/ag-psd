# Changelog

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
