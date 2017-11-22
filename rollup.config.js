const libName = require('./package.json').name;
const sourcemaps = require('rollup-plugin-sourcemaps');

export default {
  moduleName: camelCase(libName),
  sourceMap: true,
  // ATTENTION:
  // Add any dependency or peer dependency your library to `globals` and `external`.
  // This is required for UMD bundle users.
  globals: {
    // The key here is library name, and the value is the the name of the global variable name
    // the window object.
    // See https://github.com/rollup/rollup/wiki/JavaScript-API#globals for more.
    '@angular/core': 'ng.core'
  },
  external: [
    // List of dependencies
    // See https://github.com/rollup/rollup/wiki/JavaScript-API#external for more.
    '@angular/core'
  ],
  plugins: [
    sourcemaps()
  ],
  format: 'es'
};
