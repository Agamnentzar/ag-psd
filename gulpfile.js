const gulp = require('gulp');
const path = require('path');
const del = require('del');
const ts = require('gulp-typescript');
const mocha = require('gulp-spawn-mocha');
const sourcemaps = require('gulp-sourcemaps');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const merge = require('merge2');
const argv = require('yargs').argv;

const project = ts.createProject('tsconfig.json');
const scripts = ['src/**/*.ts'];

const clean = () => del(['dist/*']);

const build = () => {
	const result = gulp.src(scripts)
		.pipe(sourcemaps.init())
		.pipe(project(ts.reporter.defaultReporter()));

	return merge([
		result.dts
			.pipe(gulp.dest('dist')),
		result.js
			.pipe(sourcemaps.write({ sourceRoot: path.resolve('src') }))
			.pipe(gulp.dest('dist')),
	]);
};

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

const dev = gulp.series(clean, build, watch);
const cov = gulp.series(build, coverage, remap);
const test = gulp.series(build, tests);

module.exports = { build, dev, cov, test };
