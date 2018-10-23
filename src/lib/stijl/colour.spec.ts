import { kleurcode, kleurnaam, setOpacity, toKleur, toKleurUnsafe } from "./colour";

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
          expect(gefaaldRood.isNone()).toBe(true);
        });
      });
    });
  });
  const groen = toKleurUnsafe("groen", "#00ff00ff");
  describe("bij het zetten van de opaciteit", () => {
    it("moet een getal tussen 0 en 1 aannemen als een opaciteit", () => {
      const halfGroen = setOpacity(0.5)(groen);
      expect(kleurcode(halfGroen) as any).toEqual("#00ff0080");
    });
  });
});
