import { by, element } from "protractor";

import { asPromise, map, LazyPromise } from "../util/promises";

import { initTesting, zoomIn, zoomUit } from "./base-scenario";

//////////////
// Page object
//
class LagenKiezer {
  constructor(
    readonly aanwezig: LazyPromise<boolean>,
    readonly openGeklapt: LazyPromise<boolean>,
    readonly dichtGeklapt: LazyPromise<boolean>,
    readonly legendeLagenVakZichtbaar: LazyPromise<boolean>,
    readonly actieveLegendeLagenVakTitel: LazyPromise<string>,
    readonly legendeLagenVakInhoud: LazyPromise<string>,
    readonly aantalLegendeItems: LazyPromise<number>,
    readonly aantalZichtbareLagen: LazyPromise<number>,
    readonly aantalOnzichtbareLagen: LazyPromise<number>
  ) {}
}

const lagenKiezer = element(by.tagName("awv-lagenkiezer"));
const openOfDicht = lagenKiezer.element(by.id("openOfDichtBtn"));
const legendeLagenVak = lagenKiezer.element(by.tagName("mat-tab-group"));
const legendeLagenTitel = legendeLagenVak.element(by.css(".mat-tab-label-active"));
const legendeLagenBody = index => legendeLagenVak.all(by.css(".mat-tab-body-content")).get(index); // Material maakt ook onzichtbaar elt aan
const legendeItems = legendeLagenBody(0).all(by.css(".legende")); // 1ste div is zichtbaar
const zichtbareLagen = legendeLagenBody(1).all(by.css(".awv-kaart-laagmanipulatie:not(.onzichtbaar)")); // 2de div is zichtbaar
const onzichtbareLagen = legendeLagenBody(1).all(by.css(".awv-kaart-laagmanipulatie.onzichtbaar")); // 2de div is zichtbaar

function inspecteerLagenKiezer(): LagenKiezer {
  const aanwezig = () => asPromise(lagenKiezer.isPresent());
  const openDichtIcon = () => asPromise(openOfDicht.element(by.tagName("mat-icon")).getText());
  const openGeklapt = map(openDichtIcon, t => t === "expand_less");
  const dichtGeklapt = map(openDichtIcon, t => t === "expand_more");
  return new LagenKiezer(
    aanwezig,
    openGeklapt,
    dichtGeklapt,
    () => asPromise(lagenKiezer.element(by.tagName("mat-tab-group")).isDisplayed()),
    () => asPromise(legendeLagenTitel.getText()),
    () => asPromise(legendeLagenBody(0).getText()),
    () => asPromise(legendeItems.count()),
    () => asPromise(zichtbareLagen.count()),
    () => asPromise(onzichtbareLagen.count())
  );
}

const toggleLagenkiezer = async () => await openOfDicht.click();
const selecteerLagen = async () =>
  await legendeLagenVak
    .all(by.className("mat-tab-label"))
    .get(1)
    .click();

////////////
// De testen
//

describe("Wanneer ik naar de lagenkiezer kijk", () => {
  initTesting();

  it("dan is die aanwezig", async () => {
    expect(await inspecteerLagenKiezer().aanwezig()).toBe(true);
  });

  it("dan is die initieel dichtgeklapt", async () => {
    expect(await inspecteerLagenKiezer().openGeklapt()).toBe(false);
    expect(await inspecteerLagenKiezer().dichtGeklapt()).toBe(true);
  });

  describe("Wanneer ik de kiezer open", () => {
    beforeAll(toggleLagenkiezer);

    it("dan zie ik aan het expand icoontje dat die open is", async () => {
      expect(await inspecteerLagenKiezer().openGeklapt()).toBe(true);
      expect(await inspecteerLagenKiezer().dichtGeklapt()).toBe(false);
    });

    it("dan zie ik een extra vak", async () => {
      expect(await inspecteerLagenKiezer().legendeLagenVakZichtbaar()).toBe(true);
    });

    it("dan zie ik dat de titel van het inhoudvak 'legende' is", async () => {
      expect(await inspecteerLagenKiezer().actieveLegendeLagenVakTitel()).toMatch(/Legende/i);
    });

    it("dan is het legendevak leeg", async () => {
      expect(await inspecteerLagenKiezer().legendeLagenVakInhoud()).toMatch(/.*geen zichtbare lagen met een legende.*/i);
    });

    describe("Wanneer ik 1 niveau inzoom", async () => {
      beforeAll(() => zoomIn(1));

      it("dan zie ik 1 legende-item", async () => {
        expect(await inspecteerLagenKiezer().aantalLegendeItems()).toBe(1);
      });

      describe("Wanneer ik nog 1 niveau inzoom", async () => {
        beforeAll(() => zoomIn(1));

        it("dan zie ik 2 legende-items", async () => {
          expect(await inspecteerLagenKiezer().aantalLegendeItems()).toBe(2);
        });
      });
    });

    describe("Wanneer ik 'lagen' selecteer", async () => {
      beforeAll(selecteerLagen);
      beforeAll(() => zoomUit(2));

      it("dan zie ik dat de titel van het inhoudvak 'lagen' is", async () => {
        expect(await inspecteerLagenKiezer().actieveLegendeLagenVakTitel()).toMatch(/Lagen/i);
      });

      it("dan zie ik enkel niet-actieve lagen in het lagenvak", async () => {
        expect(await inspecteerLagenKiezer().aantalOnzichtbareLagen()).toBe(2);
        expect(await inspecteerLagenKiezer().aantalZichtbareLagen()).toBe(0);
      });

      describe("Wanneer ik één maal inzoom", async () => {
        beforeAll(() => zoomIn(1));

        it("dan zie ik 1 actieve en 1 niet-active laag", async () => {
          expect(await inspecteerLagenKiezer().aantalOnzichtbareLagen()).toBe(1);
          expect(await inspecteerLagenKiezer().aantalZichtbareLagen()).toBe(1);
        });

        describe("Wanneer ik nog één maal inzoom", async () => {
          beforeAll(() => zoomIn(1));

          it("dan zie ik enkel 2 actieve lagen", async () => {
            expect(await inspecteerLagenKiezer().aantalOnzichtbareLagen()).toBe(0);
            expect(await inspecteerLagenKiezer().aantalZichtbareLagen()).toBe(2);
          });
        });
      });
    });
  });
});
