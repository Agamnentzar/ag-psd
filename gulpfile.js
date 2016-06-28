var gulp = require('gulp');
var path = require('path');
var del = require('del');
var ts = require('gulp-typescript');
var mocha = require('gulp-spawn-mocha');
var tslint = require('gulp-tslint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var plumber = require('gulp-plumber');
var sourcemaps = require('gulp-sourcemaps');
var runSequence = require('run-sequence');
var remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
var merge = require('merge2');
var argv = require('yargs').argv;

gulp.task('clean', function () {
	return del([
		'build/*',
		'dist/*',
	]);
});

var project = ts.createProject('tsconfig.json');
var scripts = ['src/**/*.ts'];

gulp.task('build', function () {
	var result = gulp.src(scripts)
		.pipe(sourcemaps.init())
		.pipe(ts(project));

	return merge([
		result.dts
			.pipe(gulp.dest('build')),
		result.js
			.pipe(sourcemaps.write({ sourceRoot: path.resolve('src') }))
			.pipe(gulp.dest('build')),
	]);
});

gulp.task('tests', ['build'], function () {
	return gulp.src(['build/test/**/*.js'], { read: false })
		.pipe(mocha({
			reporter: 'dot',
			timeout: 10000,
		}));
});

gulp.task('coverage', ['build'], function () {
	return gulp.src(['build/test/**/*.js'], { read: false })
		.pipe(mocha({
			reporter: 'dot',
			timeout: 10000,
			istanbul: {
				print: 'none',
			},
		}));
});

gulp.task('watch', function () {
	gulp.watch(scripts, ['build']);

	if (argv.tests || argv.coverage)
		gulp.watch(scripts, [argv.coverage ? 'cov' : 'tests']);
});

gulp.task('lint', function () {
	return gulp.src(scripts)
		.pipe(plumber())
		.pipe(tslint({ configuration: require('./tslint.json') }))
		.pipe(tslint.report('verbose'));
});

gulp.task('dev', function (done) {
	runSequence('clean', 'build', 'watch', done);
});

gulp.task('cov', function (done) {
	runSequence('coverage', 'remap', done);
});

gulp.task('test', function (done) {
	runSequence('build', 'tests', done);
});

gulp.task('remap', function () {
	return gulp.src('coverage/coverage.json')
		.pipe(remapIstanbul({
			reports: {
				html: 'coverage-remapped'
			}
		}));
});
