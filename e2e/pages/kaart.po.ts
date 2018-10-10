import { browser, by, element, ElementFinder, protractor, ProtractorExpectedConditions } from "protractor";

export class KaartPage {
  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  async gaNaarPagina(): Promise<void> {
    const configuratorKaart: ElementFinder = element(by.id("qa-protractor"));
    await browser.get(`/ng-kaart/test`);
    await configuratorKaart;
  }
}
