import { Curried2, Function1, Function2, Refinement } from "fp-ts/lib/function";
import { Lens } from "monocle-ts";
import { isObject } from "util";

import * as clr from "../../stijl/colour";

// Alle kleuren die dezelfde zijn als de effectief gezette kleur krijgen een gekozen veldje
export interface KiesbareKleur extends clr.Kleur {
  gekozen?: boolean; // Is deze kleur de geselecteerde kleur? Enkel voor gebruik in HTML
}
export const markeerKleur: Curried2<clr.Kleur, clr.Kleur[], KiesbareKleur[]> = doelkleur => kleuren =>
  kleuren.map(kleur => (kleur.code === doelkleur.code ? { ...kleur, gekozen: true } : kleur));

// Op het niveau van een stijl is er geen clr.Kleur. We proberen dit af te leiden van kleurcodes in de stijl.
export interface AfgeleideKleur extends clr.Kleur {
  gevonden: boolean; // Duidt aan of de kleur herkend is. Enkel voor gebruik in HTML
}
export const gevonden: Function1<clr.Kleur, AfgeleideKleur> = kleur => ({ ...kleur, gevonden: true });
export const nietGevonden: AfgeleideKleur = {
  ...clr.rood,
  gevonden: false
};

export interface VeldKleurWaarde {
  readonly waarde: string; // De waarde van een feature property
  readonly kleur: clr.Kleur;
}

export interface VeldKleurInstellingen {
  readonly veldnaam: string;
  readonly waardekleuren: VeldKleurWaarde[];
}

export const isVeldKleurWaarde: Refinement<any, VeldKleurWaarde> = (vkw): vkw is VeldKleurWaarde =>
  isObject(vkw) && vkw.hasOwnProperty("waarde") && vkw.hasOwnProperty("kleur");

export namespace VeldKleurWaarde {
  export const create: Function2<string, clr.Kleur, VeldKleurWaarde> = (waarde, kleur) => ({
    waarde: waarde,
    kleur: kleur
  });
  export const waarde: Lens<VeldKleurWaarde, string> = Lens.fromProp("waarde");
  export const kleur: Lens<VeldKleurWaarde, clr.Kleur> = Lens.fromProp("kleur");
}

export namespace VeldKleurInstellingen {
  export const create: Function2<string, VeldKleurWaarde[], VeldKleurInstellingen> = (naam, waardekleuren) => ({
    veldnaam: naam,
    waardekleuren: waardekleuren
  });
}
