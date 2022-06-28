const gulp = require('gulp');
const path = require('path');
const del = require('del');
const ts = require('gulp-typescript');
const mocha = require('gulp-spawn-mocha');
const sourcemaps = require('gulp-sourcemaps');
const merge = require('merge2');

const scripts = ['src/**/*.ts'];

const clean = () => del(['dist/*', 'dist-es/*']);

const compileTs = (name, dest, settings) => {
	const task = () => {
		const project = ts.createProject('tsconfig.json', settings);
		const result = gulp.src(scripts)
			.pipe(sourcemaps.init())
			.pipe(project(ts.reporter.defaultReporter()));

		return merge([
			result.dts
				.pipe(gulp.dest(dest)),
			result.js
				.pipe(sourcemaps.write({ sourceRoot: path.resolve('src') }))
				.pipe(gulp.dest(dest)),
		]);
	};
	task.displayName = name;
	return task;
};

const buildJS = compileTs('build-js', 'dist', {});
const buildES = compileTs('build-es', 'dist-es', { module: 'es6' });
const build = gulp.parallel(buildJS, buildES);

const tests = () => gulp.src(['dist/test/**/*.js'], { read: false })
	.pipe(mocha({
		reporter: 'dot',
		timeout: 10000,
	}))
	.on('error', function (e) {
		console.log(e.message);
		this.emit('end');
	});

const watch = cb => {
	gulp.watch([
		...scripts, 'test/**/*.psd', 'test/**/*.psb', 'test/**/*.abr', 'test/**/*.png', 'test/**/*.json'
	],  test);
	cb();
};

const dev = gulp.series(clean, buildJS, watch);
const test = gulp.series(buildJS, tests);

module.exports = { build, buildJS, buildES, dev, test };
