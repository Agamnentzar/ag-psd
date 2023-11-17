const fs = require('fs');
const path = require('path');

for (const dir of fs.readdirSync(path.join('test', 'read-write'))) {
  try {
    if (fs.existsSync(path.join('results', 'read-write', dir, 'expected.psd'))) {
      fs.unlinkSync(path.join('test', 'read-write', dir, 'expected.psd'));
      fs.renameSync(
        path.join('results', 'read-write', dir, 'expected.psd'),
        path.join('test', 'read-write', dir, 'expected.psd'));
      console.log('copied', dir);
    } else {
      console.log('skipped', dir);
    }
  } catch (e) {
    console.log('failed', dir, e.message);
  }
}
