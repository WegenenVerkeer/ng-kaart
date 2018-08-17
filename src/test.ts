// This file is required by karma.conf.js and loads recursively all the .spec and framework files
// Deze lijn moet eerst komen. Wee diegene die ze verplaatst!
import "./polyfills.ts";

// tslint:disable-next-line:ordered-imports
import { getTestBed } from "@angular/core/testing";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";
import "zone.js/dist/async-test";
import "zone.js/dist/fake-async-test";
import "zone.js/dist/jasmine-patch";
import "zone.js/dist/long-stack-trace-zone";
import "zone.js/dist/proxy.js";
import "zone.js/dist/sync-test";

// Er zijn geen typings voor karma, definieer als any
declare var __karma__: any;
declare var require: any;

// Run karma nog niet te vroeg
__karma__.loaded = () => {};

// Initialiseer Angular testing environment.
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Zoek alle testen op
const context = require.context("./", true, /\.spec\.ts$/);

// Laad de modules in
context.keys().map(context);

// En start karma
__karma__.start();
