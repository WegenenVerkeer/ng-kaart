import {element, by, ElementFinder, browser, protractor, ProtractorExpectedConditions} from "protractor";
import {Chance} from 'chance';

export class BasePage {

  chance = Chance.Chance();

  defaultLdapid = "test";
  defaultOrganisatie = "Afdeling Wegen en Verkeer Vlaams-Brabant";
  backendBaseUrl = "http://127.0.0.1:12345/districtcenter-service";

  expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  getBerichten(): ElementFinder {
    return element(by.css('snack-bar-container'));
  }

  async scrollTo(selector: string) {
    // await browser.waitForAngular();

    const isPresent = await element(by.css(selector)).isPresent();

    if (isPresent) {
      await browser.executeScript(`$('${selector}')[0].scrollIntoView(false)`);
    } else {
      fail(`Pagina bevat niet de verwachte selector '${selector}'`);
    }
  }

}
