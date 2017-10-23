const gulp = require('gulp');
const path = require('path');
const del = require('del');
const ts = require('gulp-typescript');
const mocha = require('gulp-spawn-mocha');
const tslint = require('gulp-tslint');
const sourcemaps = require('gulp-sourcemaps');
const runSequence = require('run-sequence');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const merge = require('merge2');
const argv = require('yargs').argv;

gulp.task('clean', () => del(['dist/*']));

const project = ts.createProject('tsconfig.json');
const scripts = ['src/**/*.ts'];

gulp.task('build', () => {
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
});

gulp.task('tests', () => {
	return gulp.src(['dist/test/**/*.js'], { read: false })
		.pipe(mocha({
			reporter: 'dot',
			timeout: 10000,
		}))
		.on('error', function (e) {
			console.log(e.message);
			this.emit('end');
		});
});

gulp.task('coverage', () => {
	return gulp.src(['dist/test/**/*.js'], { read: false })
		.pipe(mocha({
			reporter: 'dot',
			timeout: 10000,
			istanbul: { print: 'none' },
		}));
});

gulp.task('watch', () => {
	gulp.watch([
		...scripts,
		'test/**/*.psd',
		'test/**/*.png',
		'test/**/*.json',
	], [argv.coverage ? 'cov' : 'test']);
});

gulp.task('lint', () => {
	return gulp.src(scripts)
		.pipe(tslint({ formatter: 'verbose' }))
		.pipe(tslint.report());
});

gulp.task('remap', () => {
	return gulp.src('coverage/coverage.json')
		.pipe(remapIstanbul({ reports: { html: 'coverage-remapped' } }));
});

gulp.task('dev', done => runSequence('clean', 'build', 'watch', done));
gulp.task('cov', done => runSequence('build', 'coverage', 'remap', done));
gulp.task('test', done => runSequence('build', 'tests', done));
