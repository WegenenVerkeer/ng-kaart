module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine-jquery', 'jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine-jquery'),
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-phantomjs-launcher'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma'),
      require('karma-junit-reporter'),
      require('karma-mocha-reporter')
    ],
    reporters: ['mocha', 'junit', 'coverage-istanbul'],
    port: 9876,
    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['PhantomJS', 'Chrome', 'ChromeHeadless', 'ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      }
    },
    // singleRun: false,
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, 'coverage'), reports: ['html', 'lcovonly', 'text-summary'],
      fixWebpackSourcePaths: true,
      dir: './reports/karma/'
    },
    junitReporter: {
      outputDir: 'reports/karma/junit/',
      suite: 'unit'
    },
    mochaReporter: {
      ignoreSkipped: true
    }
  });
};
