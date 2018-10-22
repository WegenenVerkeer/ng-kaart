import { findFirst } from "fp-ts/lib/Array";
import { Option } from "fp-ts/lib/Option";
import { browser, by, element, WebElement } from "protractor";

import { KaartPage } from "../pages/kaart.po";

import { initTesting } from "./base-scenario";

class AchtergrondTile {
  constructor(readonly titel: string, readonly zichtbaar: boolean) {}
}

class AchtergrondSelectie {
  private readonly achtergrondSelectorFndr = element(by.css("awv-kaart-achtergrond-selector"));
  private readonly allAchtergrondTiles = element.all(by.css("awv-kaart-achtergrond-tile"));

  private async webEltToTile(elt: WebElement): Promise<AchtergrondTile> {
    const titleElt = elt.findElement(by.css(".title"));
    const title = await titleElt.getText();
    const visible = await titleElt.isDisplayed();
    return new AchtergrondTile(title, visible);
  }

  async alleTiles(): Promise<AchtergrondTile[]> {
    return await Promise.all((await this.allAchtergrondTiles.getWebElements()).map(elt => this.webEltToTile(elt)));
  }

  async zichtBareTiles(): Promise<AchtergrondTile[]> {
    return (await this.alleTiles()).filter(tile => tile.zichtbaar);
  }

  async zichtbareTileMetTitel(naam: string): Promise<Option<AchtergrondTile>> {
    return findFirst(await this.zichtBareTiles(), tile => tile.titel === naam);
  }

  async zichtbaar(): Promise<boolean> {
    return this.achtergrondSelectorFndr.isDisplayed();
  }

  async clickFirst(): Promise<void> {
    await this.allAchtergrondTiles.first().click();
    await browser.sleep(1000); // uitklapanimatie
  }

  async click(titel: string): Promise<void> {
    await this.allAchtergrondTiles
      .filter(tl =>
        tl
          .element(by.css(".title"))
          .getText()
          .then(title => title === titel)
      )
      .first()
      .click();
    await browser.sleep(600); // inklapanimatie
  }
}

describe("Als ik naar de achtergrond kijk", () => {
  initTesting();

  const page: KaartPage = new KaartPage();
  const achtergrondSelectie = new AchtergrondSelectie();

  it("dan is de achtergrond selector zichtbaar", async () => {
    expect(await achtergrondSelectie.zichtbaar()).toBe(true);
  });

  it("dan wordt de 'dienstkaart grijs' achtergrond tile getoond", async () => {
    expect(await achtergrondSelectie.zichtbareTileMetTitel("Dienstkaart grijs")).toBeSome();
  });

  it("dan worden er 5 achtergrond tiles aangemaakt", async () => {
    expect((await achtergrondSelectie.alleTiles()).length).toBe(5);
  });

  it("dan is er maar 1 van die 5 tiles zichtbaar", async () => {
    expect((await achtergrondSelectie.zichtBareTiles()).length).toBe(1);
  });

  it("dan wordt de 'dienstkaart kleur' achtergrond tile niet getoond", async () => {
    expect(await achtergrondSelectie.zichtbareTileMetTitel("Dienstkaart kleur")).toBeNone();
  });

  describe("wanneer op de enige tile geklikt wordt", () => {
    beforeEach(async () => {
      await page.gaNaarPagina(); // om zeker te zijn dat een vorige test niet gestopt is in opengeklapte toestand
      await achtergrondSelectie.clickFirst();
    });

    it("dan worden alle 5 tiles zichtbaar", async () => {
      expect((await achtergrondSelectie.zichtBareTiles()).length).toBe(5);
    });

    describe("wanneer dan op de 'Dienstkaart kleur' tile geklikt wordt", () => {
      beforeEach(async () => {
        await achtergrondSelectie.click("Dienstkaart kleur");
      });

      it("is 'Dienstkaart kleur' zichtbaar", async () => {
        expect(await achtergrondSelectie.zichtbareTileMetTitel("Dienstkaart kleur")).toBeSome();
      });

      it("zijn er geen andere tiles meer zichtbaar", async () => {
        expect((await achtergrondSelectie.zichtBareTiles()).length).toBe(1);
      });
    });
  });
});
