import {browser, by, element, ElementFinder} from "protractor";
import {BasePage} from "./base.po";

export class KaartPage extends BasePage {
  kaartComponent: ElementFinder = element(by.css(".qa-kaart"));

  async gaNaarPagina(): Promise<any> {
    await browser.get(`/`);
    return browser.wait(this.expectedConditions.visibilityOf(this.kaartComponent), 2000);
  }
}
