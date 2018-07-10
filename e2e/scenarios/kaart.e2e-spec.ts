import { KaartPage } from "../pages/kaart.po";
import { browser } from "protractor";

describe("Als ik de test-app met de configurator-kaart bekijk", function() {
  const page: KaartPage = new KaartPage();

  beforeAll(async function(): Promise<any> {
    browser.waitForAngularEnabled(false);
    await page.gaNaarPagina();
  });

  it("dan is de kaart zichtbaar", async function(): Promise<any> {
    expect(await page.configuratorKaart.isPresent()).toBeTruthy();
  });
});
