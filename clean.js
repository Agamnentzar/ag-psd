const fs = require('fs');
fs.rmSync('dist', { recursive: true, force: true });
fs.rmSync('dist-es', { recursive: true, force: true });
