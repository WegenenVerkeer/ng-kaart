import { eq, option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";

import {
  kleurcode,
  kleurcodeValue,
  kleurnaam,
  kleurnaamValue,
  setOpacity,
  toKleur,
  toKleurUnsafe,
} from "./colour";

describe("Een kleur", () => {
  describe("aanmaken", () => {
    describe("op basis van een naam en een hex code zonder transparantie", () => {
      const rood = toKleurUnsafe("rood", "#ff0000");
      it("moet de naam overnemen", () => {
        expect(kleurnaam(rood) as any).toEqual("rood");
      });
      it("moet de code overnemen met volledige opaciteit", () => {
        expect(kleurcode(rood) as any).toEqual("#ff0000ff");
      });
      it("moet een structuur maken die er als een gewoon JavaScript object uitziet", () => {
        expect(rood as any).toEqual({ naam: "rood", code: "#ff0000ff" });
      });
      it("moet ook uppercase hex codes aan nemen", () => {
        const rood = toKleurUnsafe("rood", "#FF0000");
        expect(kleurcode(rood) as any).toEqual("#ff0000ff");
      });
    });
    describe("op basis van een naam en een hex code met transparantie", () => {
      const rood = toKleurUnsafe("rood", "#ff0000ab");
      it("moet de naam overnemen", () => {
        expect(kleurnaam(rood) as any).toEqual("rood");
      });
      it("moet de code overnemen met de gegeven opaciteit", () => {
        expect(kleurcode(rood) as any).toEqual("#ff0000ab");
      });
    });
    describe("op basis van een ongeldige hex code", () => {
      describe("op de 'onveilige' manier", () => {
        const slechtRood = toKleurUnsafe("rood", "ff0000");
        it("moet de fallback kleur opleveren", () => {
          expect(kleurnaam(slechtRood) as any).toEqual("zwart");
          expect(kleurcode(slechtRood) as any).toEqual("#000000ff");
        });
      });
      describe("op de 'veilige' manier", () => {
        const gefaaldRood = toKleur("rood", "ff0000");
        it("moet none opleveren", () => {
          expect(option.isNone(gefaaldRood)).toEqual(true);
        });
      });
    });
    describe("op de veilige manier met geldige argument", () => {
      const blauw = toKleur("blauw", "#0000ffff");
      it("moet een 'some' opleveren", () => {
        expect(option.isSome(blauw)).toEqual(true);
      });
      it("moet de componenten omvatten", () => {
        expect(
          pipe(blauw, option.map(kleurnaamValue), (o) =>
            option.elem(eq.eqString)("blauw", o)
          )
        ).toEqual(true);
        expect(
          pipe(blauw, option.map(kleurcodeValue), (o) =>
            option.elem(eq.eqString)("#0000ffff", o)
          )
        ).toEqual(true);
      });
    });
    describe("op basis van een lege naam", () => {
      it("moet falen", () => {
        const slechteNaam = toKleur("", "#ff0000");
        expect(option.isNone(slechteNaam)).toEqual(true);
      });
    });
  });
  const groen = toKleurUnsafe("groen", "#00ff00ff");
  describe("bij het zetten van de opaciteit", () => {
    it("moet een getal tussen 0 en 1 aannemen als een opaciteit", () => {
      const transparantGroen = setOpacity(0)(groen);
      const halfDoorzichtigGroen = setOpacity(0.5)(groen);
      const ondoorzichtigGroen = setOpacity(1)(groen);
      expect(kleurcode(transparantGroen) as any).toEqual("#00ff0000");
      expect(kleurcode(halfDoorzichtigGroen) as any).toEqual("#00ff0080");
      expect(kleurcode(ondoorzichtigGroen) as any).toEqual("#00ff00ff");
    });
    it("moet een getal lager dan 0 aannemen als een 0-opaciteit", () => {
      const groenen = [-2, -1, -0.00001].map((op) =>
        kleurcode(setOpacity(op)(groen))
      );
      expect(groenen as any[]).toEqual(["#00ff0000", "#00ff0000", "#00ff0000"]);
    });
    it("moet een getal hoger dan 1 aannemen als een 1-opaciteit", () => {
      const groenen = [2, 1, 1.00001].map((op) =>
        kleurcode(setOpacity(op)(groen))
      );
      expect(groenen as any[]).toEqual(["#00ff00ff", "#00ff00ff", "#00ff00ff"]);
    });
  });
});
