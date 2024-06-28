require('ts-node').register({});
const { readPsd } = require('./src/index.ts');
require('./src/initializeCanvas.ts');
const { readFileSync } = require('fs');

const buffer = readFileSync('D:\\Downloads\\8K Painting.psd');

const start = performance.now();
const psd = readPsd(buffer);
const end = performance.now();

console.log('time', end - start, 'ms', psd.width, psd.height);
