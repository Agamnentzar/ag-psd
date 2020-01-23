require('./dist/initializeCanvas');
var psd = require('./dist/index');
var fs = require('fs');

var buff = fs.readFileSync('D:\\Projects\\story-game\\assets\\character.psd');
var t = psd.readPsd(buff);

console.log('done');
