# Changelog

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
- Changed `writePsd()` method to always return `ArrayBuffer`. If you need `Buffer` as a result user `writePsdBuffer()` method instead.
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
