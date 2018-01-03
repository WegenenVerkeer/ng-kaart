import { browser, protractor, by, element, ElementFinder, ProtractorExpectedConditions } from "protractor";

export class KaartPage {
  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  kaartComponent: ElementFinder = element(by.css(".qa-kaart"));

  async gaNaarPagina(): Promise<any> {
    await browser.get(`/`);
    return browser.wait(this.expectedConditions.visibilityOf(this.kaartComponent), 2000);
  }
}
