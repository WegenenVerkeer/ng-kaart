let reporters = require('jasmine-reporters');
let HtmlScreenshotReporter = require('protractor-jasmine2-screenshot-reporter');
let rimraf = require('rimraf');
let mkdirp = require('mkdirp');
let SpecReporter = require('jasmine-spec-reporter').SpecReporter;

const config = {
  allScriptsTimeout: 11000,
  specs: [
    './e2e/**/*.e2e-spec.ts'
  ],
  capabilities: {
    browserName: 'chrome',
    chromeOptions: {
      args: [
        'window-size=1280x1000',
        'headless', // definieer DISABLE_HEADLESS om gewoon te testen
        'disable-gpu'
      ],
      prefs: {
        download: {
          prompt_for_download: false,
          directory_upgrade: true,
          default_directory: '/tmp/e2e/'
        }
      }
    }
  },
  plugins: [
    {
      package: 'protractor-console-plugin',
      failOnWarning: true,
      failOnError: true,
      exclude: [ // protractor kan niet aan WMS server van WDB
        /.*wms1.apps.mow.vlaanderen.be.*/,
        /.*wms2.apps.mow.vlaanderen.be.*/,
        /.*wms3.apps.mow.vlaanderen.be.*/,
      ]
    },
    {
      package: 'protractor-console',
      logLevels: ['debug', 'info'] // bij failure zien we 'warning' en 'severe' toch
    }
  ],
  directConnect: true,
  baseUrl: 'http://localhost:4220/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 360000,
    print: function () {
    }
  },
  useAllAngular2AppRoots: true,
  SELENIUM_PROMISE_MANAGER: false,
  beforeLaunch: function () {
    require('ts-node').register({
      project: 'e2e/tsconfig.e2e.json'
    });
  },
  onPrepare: function () {
    // kuis voorgaande reports op
    rimraf.sync('reports/e2e/');
    mkdirp.sync('reports/e2e/screenshots');

    // configureer screenshots
    jasmine.getEnv().addReporter(
      new HtmlScreenshotReporter({
        dest: 'reports/e2e/screenshots',
        filename: 'index.html',
        ignoreSkippedSpecs: false,
        reportOnlyFailedSpecs: false,
        captureOnlyFailedSpecs: false
      })
    );

    // configureer junit rapporten
    jasmine.getEnv().addReporter(
      new reporters.JUnitXmlReporter({savePath: 'reports/e2e/', consolidateAll: false})
    );

    jasmine.getEnv().addReporter(new SpecReporter({
      spec: {
        displayStacktrace: true
      }
    }));

    // kuis voorgaande downloads op
    rimraf.sync('/tmp/e2e/');
    mkdirp.sync('/tmp/e2e/');

    console.info('Protractor is geconfigureerd');
  }
};

if (process.env.DISABLE_HEADLESS) {
  config.capabilities.chromeOptions.args.splice(config.capabilities.chromeOptions.args.indexOf('headless'), 1);
}

exports.config = config;
