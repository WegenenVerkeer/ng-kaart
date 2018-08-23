module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine-jquery', 'jasmine', '@angular/cli'],
    plugins: [
      require('karma-jasmine-jquery'),
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular/cli/plugins/karma'),
      require('karma-junit-reporter'),
      require('karma-mocha-reporter')
    ],
    files: [
      {pattern: './src/test.ts', watched: false}
    ],
    preprocessors: {
      './src/test.ts': ['@angular/cli']
    },
    mime: {
      'text/x-typescript': ['ts', 'tsx']
    },
    angularCli: {
      environment: 'dev'
    },
    reporters: ['mocha', 'junit', 'coverage-istanbul'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome', 'ChromeHeadless', 'ChromeHeadlessNoSandbox'],
    singleRun: false,
    coverageIstanbulReporter: {
      reports: ['html', 'lcovonly', 'text-summary'],
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
