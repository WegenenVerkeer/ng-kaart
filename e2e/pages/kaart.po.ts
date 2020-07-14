import { browser, by, element, ElementFinder, protractor, ProtractorExpectedConditions } from "protractor";

export class KaartPage {
  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  async gaNaarPagina(): Promise<void> {
    const configuratorKaart: ElementFinder = element(by.id("qa-protractor"));
    await browser.get(`/test`);
    // De cast hier onder is een hack want ElementFinder is geen Promise. Het
    // implementeert enkel de then methode.
    await ((configuratorKaart as unknown) as Promise<void>);
  }
}
