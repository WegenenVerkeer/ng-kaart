import { browser, by, element, ElementFinder, protractor, ProtractorExpectedConditions } from "protractor";

export class KaartPage {
  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  configuratorKaart: ElementFinder = element(by.id("qa-protractor"));

  async gaNaarPagina(): Promise<any> {
    await browser.get(`/ng-kaart/test`);
    await this.configuratorKaart;
  }
}
