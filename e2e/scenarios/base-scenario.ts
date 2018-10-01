import { browser, by, element } from "protractor";

import { KaartPage } from "../pages/kaart.po";
import { addOptionMatchers } from "../util/custom-matchers";

export const startPagina: KaartPage = new KaartPage();
const zoomInKnop = () => element(by.css("button[mattooltip='Zoom in']"));
const zoomUitKnop = () => element(by.css("button[mattooltip='Zoom uit']"));

export function initTesting() {
  // Dit zou ook onPrepare van protractor.conf.js kunnen komen, maar daar is enkel pure JavaScript mogelijk

  beforeAll(async () => {
    await browser.waitForAngularEnabled(true);
    await startPagina.gaNaarPagina();
  });

  beforeEach(addOptionMatchers);
}

export const zoomIn = async (n: number) => {
  for (let i = 0; i < n; ++i) {
    await zoomInKnop().click();
  }
};

export const zoomUit = async (n: number) => {
  for (let i = 0; i < n; ++i) {
    await zoomUitKnop().click();
  }
};
