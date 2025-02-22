const fs = require('fs');
const path = require('path');
const type = process.argv[2];

if (type === 'read-write' || type === 'write') {
  for (const dir of fs.readdirSync(path.join('test', type))) {
    try {
      for (const ext of ['psd', 'psb']) {
        const file = `expected.${ext}`;
        if (fs.existsSync(path.join('results', type, dir, file))) {
          fs.unlinkSync(path.join('test', type, dir, file));
          fs.copyFileSync(
            path.join('results', type, dir, file),
            path.join('test', type, dir, file));
          console.log('copied', dir);
          break;
        } else {
          console.log('skipped', dir);
        }
      }
    } catch (e) {
      console.log('failed', dir, e.message);
    }
  }
} else if (type === 'read') {
  for (const dir of fs.readdirSync(path.join('test', type))) {
    try {
      const file = `data.json`;
      if (fs.existsSync(path.join('results', type, dir, file))) {
        fs.unlinkSync(path.join('test', type, dir, file));
        fs.copyFileSync(
          path.join('results', type, dir, file),
          path.join('test', type, dir, file));
        console.log('copied', dir);
      } else {
        console.log('skipped', dir);
      }
    } catch (e) {
      console.log('failed', dir, e.message);
    }
  }
} else {
  console.error('Invalid type:', type);
}

// TODO: read
