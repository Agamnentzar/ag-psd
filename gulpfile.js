var gulp = require('gulp');
var path = require('path');
var del = require('del');
var ts = require('gulp-typescript');
var mocha = require('gulp-spawn-mocha');
var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var runSequence = require('run-sequence');
var remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
var merge = require('merge2');
var argv = require('yargs').argv;

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
	], [argv.coverage ? 'cov' : (argv.tests ? 'test' : 'build')]);
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
