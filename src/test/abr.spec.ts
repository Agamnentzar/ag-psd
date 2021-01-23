import * as fs from 'fs';
import { readAbr } from '../abr';

describe('ABR', () => {
	// TODO: write actual tests
	it.skip('readAbr', () => {
		const buffer = fs.readFileSync('resources/test3.abr');
		const abr = readAbr(buffer);

		if (0) console.log(require('util').inspect(abr, false, 99, true));
		// const canvas = createCanvas(w, h);
		// const context = canvas.getContext('2d')!;
		// const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		// for (let i = 0, j = 0; i < alpha.byteLength; i++, j += 4) {
		// 	imageData.data[j + 3] = alpha[i];
		// }
		// context.putImageData(imageData, 0, 0);
		// saveCanvas('brush_shape.png', canvas);

		// const pattern = abr.patterns[0];
		// if (1) console.log(require('util').inspect(pattern, false, 99, true));
		// const canvas = createCanvas(pattern.bounds.w, pattern.bounds.h);
		// const context = canvas.getContext('2d')!;
		// const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		// imageData.data.set(pattern.data);
		// context.putImageData(imageData, 0, 0);
		// saveCanvas('brush_pattern.png', canvas);
	});
});
