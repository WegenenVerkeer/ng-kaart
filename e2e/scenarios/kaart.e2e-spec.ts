import { browser } from "protractor";

import { KaartPage } from "../pages/kaart.po";

describe("Als ik de test-app met de configurator-kaart bekijk", function() {
  const page: KaartPage = new KaartPage();

  beforeAll(async function(): Promise<any> {
    browser.waitForAngularEnabled(true);
    await page.gaNaarPagina();
  });

  it("dan is de kaart zichtbaar", async function(): Promise<any> {
    await page.configuratorKaart.isPresent();
  });
});
