const gulp = require('gulp');
const path = require('path');
const del = require('del');
const ts = require('gulp-typescript');
const mocha = require('gulp-spawn-mocha');
const sourcemaps = require('gulp-sourcemaps');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const merge = require('merge2');
const argv = require('yargs').argv;

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

const coverage = () => gulp.src(['dist/test/**/*.js'], { read: false })
	.pipe(mocha({
		reporter: 'dot',
		timeout: 10000,
		istanbul: { print: 'none' },
	}));

const watch = cb => {
	gulp.watch([...scripts, 'test/**/*.psd', 'test/**/*.png', 'test/**/*.json'], argv.coverage ? cov : test);
	cb();
};

const remap = () => gulp.src('coverage/coverage.json')
	.pipe(remapIstanbul({ reports: { html: 'coverage-remapped' } }));

const dev = gulp.series(clean, buildJS, watch);
const cov = gulp.series(buildJS, coverage, remap);
const test = gulp.series(buildJS, tests);

module.exports = { build, buildJS, buildES, dev, cov, test };
