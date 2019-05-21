const fs = require('fs');
const path = 'node_modules/@angular-devkit/build-angular/src/angular-cli-files/models/webpack-configs/browser.js';

let file = fs.readFileSync(path, { encoding: 'utf8' });
file = file.replace("'source-map'", "'inline-source-map'");
fs.writeFileSync(path, file, 'utf8');
