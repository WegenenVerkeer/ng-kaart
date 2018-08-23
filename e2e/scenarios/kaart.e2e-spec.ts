import { equal } from "assert";
import { browser, by, element } from "protractor";

import { KaartPage } from "../pages/kaart.po";

describe("Als ik de test-app met de configurator-kaart bekijk", function() {
  const page: KaartPage = new KaartPage();

  beforeAll(async () => {
    browser.waitForAngularEnabled(true);
    await page.gaNaarPagina();
  });

  it("dan is de kaart zichtbaar", async () => {
    return expect(await page.configuratorKaart.isPresent()).toBe(true);
  });
});
