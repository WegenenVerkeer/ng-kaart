import { browser, protractor, by, element, ElementFinder, ProtractorExpectedConditions } from "protractor";

export class KaartPage {
  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  configuratorKaart: ElementFinder = element(by.css(".qa-configurator-kaart"));

  async gaNaarPagina(): Promise<any> {
    await browser.get(`/ng-kaart`);
    return browser.wait(this.expectedConditions.visibilityOf(this.configuratorKaart), 2000);
  }
}
