import { equal } from "assert";
import { browser, by, element } from "protractor";

import { KaartPage } from "../pages/kaart.po";

describe("Als ik de test-app met de configurator-kaart bekijk", function() {
  const page: KaartPage = new KaartPage();
  const achtergrondSelectorFndr = element(by.css("awv-kaart-achtergrond-selector"));
  const allAchtergrondTiles = element.all(by.css("awv-kaart-achtergrond-tile"));
  const achtergrondTileByTitleFndr = (title: string) =>
    allAchtergrondTiles
      .filter(fndr =>
        fndr
          .element(by.css(".title"))
          .getText()
          .then(text => text === title)
      )
      .first();

  beforeAll(async () => {
    browser.waitForAngularEnabled(true);
    await page.gaNaarPagina();
  });

  it("dan is de kaart zichtbaar", async () => {
    return expect(await page.configuratorKaart.isPresent()).toBe(true);
  });

  it("dan is de achtergrond selector zichtbaar", async () => {
    return expect(await achtergrondSelectorFndr.isPresent()).toBe(true);
  });

  it("dan wordt de 'dienstkaart grijs' achtergrond tile getoond", async () => {
    const grijsTileFndr = achtergrondTileByTitleFndr("Dienstkaart grijs");
    return expect(await grijsTileFndr.isDisplayed()).toBe(true);
  });

  it("dan worden er 5 achtergrond tiles aangemaakt", async () => {
    const kleurTileCount = element.all(by.css("awv-kaart-achtergrond-tile")).count();
    return expect(await kleurTileCount).toBe(5);
  });

  it("dan is er maar 1 van die tiles zichtbaar", async () => {
    const visibleTileCount = allAchtergrondTiles.filter(fndr => fndr.element(by.css(".title")).isDisplayed()).count();
    return expect(await visibleTileCount).toBe(1);
  });

  it("dan wordt de 'dienstkaart kleur' achtergrond tile niet getoond", async function(): Promise<boolean> {
    const kleurTileCount = allAchtergrondTiles
      .filter(fndr =>
        fndr
          .element(by.css(".title"))
          .getText()
          .then(text => text === "Dienstkaart kleur")
      )
      .count();
    return expect(await kleurTileCount).toBe(0);
  });

  describe("wanneer op de enige tile geklikt wordt", () => {
    beforeEach(async () => await allAchtergrondTiles.first().click());

    it("dan worden alle 5 tiles zichtbaar", async () => {
      const visibleTileCount = allAchtergrondTiles.filter(fndr => fndr.isDisplayed()).count();
      return expect(await visibleTileCount).toEqual(5);
    });

    // TODO. Er is blijkbaar een interactie tussen de tests -> consulteer Niels voor wat hulp
    // describe("wanneer dan op de 'Dienstkaart kleur' tile geklikt wordt", () => {
    //   beforeEach(async () => await achtergrondTileByTitleFndr("Dienstkaart kleur").click());
    //   it("is 'Dienstkaart kleur' zichtbaar", async () => {
    //     return expect(await achtergrondTileByTitleFndr("Dienstkaart kleur").isDisplayed()).toBe(true);
    //   });

    //   it("zijn er geen andere tiles zichtbaar", async () =>
    //     expect(await allAchtergrondTiles.filter(fndr => fndr.element(by.css(".title")).isDisplayed()).count()).toBe(1));
    // });
  });
});
