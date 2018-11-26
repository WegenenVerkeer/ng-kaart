import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, Function3, Function4, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { getArraySetoid, getRecordSetoid, Setoid, setoidBoolean, setoidString } from "fp-ts/lib/Setoid";
import { Lens, Optional } from "monocle-ts";
import { isObject } from "util";

import * as clr from "../../stijl/colour";
import { ReduceFunction, reducerFromLens } from "../../util/function";

// Alle kleuren die dezelfde zijn als de effectief gezette kleur krijgen een gekozen veldje
export interface KiesbareKleur extends clr.Kleur {
  gekozen?: boolean; // Is deze kleur de geselecteerde kleur? Enkel voor gebruik in HTML
}
export const markeerKleur: Curried2<clr.Kleur, clr.Kleur[], KiesbareKleur[]> = doelkleur => kleuren =>
  kleuren.map(kleur => (kleur.code === doelkleur.code ? { ...kleur, gekozen: true } : kleur));

// Op het niveau van een stijl is er geen clr.Kleur. We proberen dit af te leiden van kleurcodes in de stijl.
// export interface AfgeleideKleur extends clr.Kleur {
//   gevonden: boolean; // Duidt aan of de kleur herkend is. Enkel voor gebruik in HTML
// }
// export const gevonden: Function1<clr.Kleur, AfgeleideKleur> = kleur => ({ ...kleur, gevonden: true });
// export const nietGevonden: AfgeleideKleur = {
//   ...clr.rood,
//   gevonden: false
// };

export interface VeldKleurWaarde {
  readonly waarde: string; // De waarde van een feature property
  readonly kleur: clr.Kleur;
}

export type LaagkleurInstellingen = UniformeKleur | KleurPerVeldwaarde;

// De instellingen nodig om een uniforme stijl en legende te maken
export interface UniformeKleur {
  readonly type: "uniform";
  readonly kleur: clr.Kleur;
  readonly afgeleid: boolean;
}

// De instellingen nodig om een stijl met voor elke waarde van een specifiek veld een stijl en legende te maken
export interface KleurPerVeldwaarde {
  readonly type: "perVeldwaarde";
  readonly veldnaam: string;
  readonly waardekleuren: VeldKleurWaarde[];
  readonly terugvalkleur: clr.Kleur;
  readonly afgeleid: boolean;
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

  export const setoid: Setoid<VeldKleurWaarde> = getRecordSetoid({
    waarde: setoidString,
    kleur: clr.setoidKleurOpCode
  });
}

export namespace LaagkleurInstellingen {
  export const isUniformeKleur: Refinement<LaagkleurInstellingen, UniformeKleur> = (inst): inst is UniformeKleur => inst.type === "uniform";
  export const isKleurPerVeldwaarde: Refinement<LaagkleurInstellingen, KleurPerVeldwaarde> = (inst): inst is KleurPerVeldwaarde =>
    inst.type === "perVeldwaarde";
}

export namespace UniformeKleur {
  export const create: Function2<boolean, clr.Kleur, UniformeKleur> = (afgeleid, kleur) => ({
    type: "uniform",
    kleur: kleur,
    afgeleid: afgeleid
  });

  export const createAfgeleid: Function1<clr.Kleur, UniformeKleur> = kleur => create(true, kleur);
  export const createSynthetisch: Function1<clr.Kleur, UniformeKleur> = kleur => create(false, kleur);

  export const setoid: Setoid<UniformeKleur> = getRecordSetoid({
    kleur: clr.setoidKleurOpCode,
    afgeleid: setoidBoolean
  });

  const kleurLens: Lens<UniformeKleur, clr.Kleur> = Lens.fromProp("kleur");

  export const zetKleur: ReduceFunction<UniformeKleur, clr.Kleur> = reducerFromLens(kleurLens);
}

export namespace KleurPerVeldwaarde {
  export const create: Function4<boolean, string, VeldKleurWaarde[], clr.Kleur, KleurPerVeldwaarde> = (
    afgeleid,
    naam,
    waardekleuren,
    terugvalkleur
  ) => ({
    type: "perVeldwaarde",
    afgeleid: afgeleid,
    veldnaam: naam,
    waardekleuren: waardekleuren,
    terugvalkleur: terugvalkleur
  });

  export const createAfgeleid: Function3<string, VeldKleurWaarde[], clr.Kleur, KleurPerVeldwaarde> = (naam, waardekleuren, terugvalkleur) =>
    create(true, naam, waardekleuren, terugvalkleur);
  export const createSynthetisch: Function3<string, VeldKleurWaarde[], clr.Kleur, KleurPerVeldwaarde> = (
    naam,
    waardekleuren,
    terugvalkleur
  ) => create(false, naam, waardekleuren, terugvalkleur);

  export const setoid: Setoid<KleurPerVeldwaarde> = getRecordSetoid({
    afgeleid: setoidBoolean,
    veldnaam: setoidString,
    waardekleuren: getArraySetoid(VeldKleurWaarde.setoid),
    terugvalkleur: clr.setoidKleurOpCode
  });

  const waardekleurenLens: Lens<KleurPerVeldwaarde, VeldKleurWaarde[]> = Lens.fromProp("waardekleuren");
  const terugvalKleurLens: Lens<KleurPerVeldwaarde, clr.Kleur> = Lens.fromProp("terugvalkleur");

  const findVeldKleurWaardeByWaarde: Curried2<string, VeldKleurWaarde[], Option<VeldKleurWaarde>> = waarde => vkwn =>
    array.findFirst(vkwn, vkw => vkw.waarde === waarde);

  const arrayAsMapOptional: Function1<string, Optional<VeldKleurWaarde[], VeldKleurWaarde>> = waarde =>
    new Optional<VeldKleurWaarde[], VeldKleurWaarde>(findVeldKleurWaardeByWaarde(waarde), vkw => vkwn =>
      findVeldKleurWaardeByWaarde(waarde)(vkwn).isSome() ? vkwn.map(vk => (vk.waarde === vkw.waarde ? vkw : vk)) : array.cons(vkw, vkwn)
    );

  export const kleurVoorWaarde: Function1<string, Optional<KleurPerVeldwaarde, clr.Kleur>> = waarde =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(waarde).composeLens(VeldKleurWaarde.kleur));

  export const zetVeldkleurwaarde: ReduceFunction<KleurPerVeldwaarde, VeldKleurWaarde> = (kpv, overlayVkw) =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(overlayVkw.waarde)).set(overlayVkw)(kpv);

  export const zetTerugvalkleur: ReduceFunction<KleurPerVeldwaarde, clr.Kleur> = reducerFromLens(terugvalKleurLens);
}
