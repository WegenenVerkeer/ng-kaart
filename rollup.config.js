const libName = require('./package.json').name;
const sourcemaps = require('rollup-plugin-sourcemaps');

export default {
  // Allow mixing of hypothetical and actual files. "Actual" files can be files
  // accessed by Rollup or produced by plugins further down the chain.
  // This prevents errors like: 'path/file' does not exist in the hypothetical file system
  // when subdirectories are used in the `src` directory.
  allowRealFiles: true,
  // ATTENTION:
  // Add any dependency or peer dependency your library to `globals` and `external`.
  // This is required for UMD bundle users.
  globals: {
    // The key here is library name, and the value is the the name of the global variable name
    // the window object.
    // See https://github.com/rollup/rollup/wiki/JavaScript-API#globals for more.
    typescript: 'ts',
    proj4: 'proj4',
    '@angular/core': 'ng.core',
    '@angular/common': 'ng.common',
    'lodash-es/isEqual': 'le.isEqual',
    'openlayers': 'openlayers',
    'rxjs/Observable': 'rxjs.observable',
    'rxjs/Subject': 'rxjs.subject',
    'rxjs/Subscriber': 'rxjs.subscriber',
    'rxjs/scheduler/asap': 'rxjs.scheduler.asap'
  },
  external: [
    // List of dependencies
    // See https://github.com/rollup/rollup/wiki/JavaScript-API#external for more.
    '@angular/common',
    '@angular/core',
    '@angular/http',
    'lodash-es/isEqual',
    'immutable',
    'openlayers',
    'proj4',
    'rxjs/Observable',
    'rxjs/ReplaySubject',
    'rxjs/Subject',
    'rxjs/Subscriber',
    'rxjs/add/observable/combineLatest',
    'rxjs/add/observable/empty',
    'rxjs/add/observable/fromPromise',
    'rxjs/add/observable/never',
    'rxjs/add/observable/of',
    'rxjs/add/operator/concat',
    'rxjs/add/operator/catch',
    'rxjs/add/operator/do',
    'rxjs/add/operator/first',
    'rxjs/add/operator/let',
    'rxjs/add/operator/let',
    'rxjs/add/operator/map',
    'rxjs/add/operator/mergeAll',
    'rxjs/add/operator/observeOn',
    'rxjs/add/operator/publishReplay',
    'rxjs/add/operator/reduce',
    'rxjs/add/operator/shareReplay',
    'rxjs/add/operator/switchMap',
    'rxjs/add/operator/takeUntil',
    'rxjs/add/operator/toPromise',
    'rxjs/scheduler/asap'
  ],
  plugins: [
    sourcemaps()
  ],
  output: {
    format: 'es'
  } 
};
