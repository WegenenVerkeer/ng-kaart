import "zone.js/dist/zone-testing";

import { getTestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";

// Er zijn geen typings voor karma, definieer als any
declare let __karma__: any;
declare let require: any;

// Run karma nog niet te vroeg
__karma__.loaded = () => {};

// Initialiseer Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Zoek alle testen op
const context = require.context("./", true, /\.spec\.ts$/);

// Laad de modules in
context.keys().map(context);

// En start karma
__karma__.start();
