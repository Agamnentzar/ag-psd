import { BezierPath } from '../psd';
import {createCanvas} from '../canvas/Canvas';

export function drawBezierPaths(paths: BezierPath[], width: number, height: number, fileName: string, ox = 0, oy = 0) {
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d')!;
	context.fillStyle = 'red';
	context.translate(-ox, -oy);
	for (const path of paths) {
		context.beginPath();
		context.moveTo(path.knots[0].points[2], path.knots[0].points[3]);
		for (let i = 1; i < path.knots.length; i++) {
			// console.log(path.knots[i].points.map(x => x.toFixed(2)));
			context.bezierCurveTo(
				path.knots[i - 1].points[4], path.knots[i - 1].points[5],
				path.knots[i].points[0], path.knots[i].points[1], path.knots[i].points[2], path.knots[i].points[3]);
		}
		if (!path.open) context.closePath();
		context.fill();
	}
	require('fs').writeFileSync(fileName, canvas.toBufferSync('png'));
}
