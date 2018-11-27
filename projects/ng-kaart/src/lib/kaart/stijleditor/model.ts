import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, Function3, Function4, Refinement } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { getArraySetoid, getRecordSetoid, Setoid, setoidBoolean, setoidString } from "fp-ts/lib/Setoid";
import { Lens, Optional } from "monocle-ts";
import { isObject } from "util";

import * as clr from "../../stijl/colour";
import { ReduceFunction, reducerFromLens } from "../../util/function";

/////////////////
// Typedefinities
//

export interface VeldwaardeKleur {
  readonly waarde: string; // De waarde van een feature property
  readonly kleur: clr.Kleur; // De kleur voor die waarde
}

// De high-level stijlen die exact uitdrukken wat de gebruiker kiest als instellingen voor de laag in de UI.
// Om historische reden en ook omdat deze definities nogal variabel zijn naarmate er meer features toegevoegd worden,
// is dit verschillend van wat er gepersisteerd en op lagere niveaus gebruikt wordt. Daar gebruiken we immers
// AwvV0StyleSpec (persistentie) en StyleSelector (voor OL).
export type LaagkleurInstellingen = UniformeKleur | KleurPerVeldwaarde;

// De instellingen nodig om een uniforme stijl en legende te maken
export interface UniformeKleur {
  readonly type: "uniform";
  readonly kleur: clr.Kleur;
  readonly afgeleid: boolean; // wanneer de stijl afgeleid is van een StijlSpec
}

// De instellingen nodig om een stijl met voor elke waarde van een specifiek veld een stijl en legende te maken
export interface KleurPerVeldwaarde {
  readonly type: "perVeldwaarde";
  readonly veldnaam: string;
  readonly waardekleuren: VeldwaardeKleur[];
  readonly terugvalkleur: clr.Kleur;
  readonly afgeleid: boolean;
}

/////////////////
// Basisoperaties
//

export namespace VeldwaardeKleur {
  export const create: Function2<string, clr.Kleur, VeldwaardeKleur> = (waarde, kleur) => ({
    waarde: waarde,
    kleur: kleur
  });
  export const waarde: Lens<VeldwaardeKleur, string> = Lens.fromProp("waarde");
  export const kleur: Lens<VeldwaardeKleur, clr.Kleur> = Lens.fromProp("kleur");

  export const setoid: Setoid<VeldwaardeKleur> = getRecordSetoid({
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
  export const create: Function4<boolean, string, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (
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

  export const createAfgeleid: Function3<string, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (naam, waardekleuren, terugvalkleur) =>
    create(true, naam, waardekleuren, terugvalkleur);
  export const createSynthetisch: Function3<string, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (
    naam,
    waardekleuren,
    terugvalkleur
  ) => create(false, naam, waardekleuren, terugvalkleur);

  export const setoid: Setoid<KleurPerVeldwaarde> = getRecordSetoid({
    afgeleid: setoidBoolean,
    veldnaam: setoidString,
    waardekleuren: getArraySetoid(VeldwaardeKleur.setoid),
    terugvalkleur: clr.setoidKleurOpCode
  });

  const waardekleurenLens: Lens<KleurPerVeldwaarde, VeldwaardeKleur[]> = Lens.fromProp("waardekleuren");
  const terugvalKleurLens: Lens<KleurPerVeldwaarde, clr.Kleur> = Lens.fromProp("terugvalkleur");

  const findVeldwaardeKleurByWaarde: Curried2<string, VeldwaardeKleur[], Option<VeldwaardeKleur>> = waarde => vkwn =>
    array.findFirst(vkwn, vkw => vkw.waarde === waarde);

  const arrayAsMapOptional: Function1<string, Optional<VeldwaardeKleur[], VeldwaardeKleur>> = waarde =>
    new Optional<VeldwaardeKleur[], VeldwaardeKleur>(
      findVeldwaardeKleurByWaarde(waarde), // getter
      vkw => vkwn =>
        findVeldwaardeKleurByWaarde(waarde)(vkwn).isSome() ? vkwn.map(vk => (vk.waarde === vkw.waarde ? vkw : vk)) : array.cons(vkw, vkwn)
    );

  export const kleurVoorWaarde: Function1<string, Optional<KleurPerVeldwaarde, clr.Kleur>> = waarde =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(waarde).composeLens(VeldwaardeKleur.kleur));

  export const zetVeldwaardeKleur: ReduceFunction<KleurPerVeldwaarde, VeldwaardeKleur> = (kpv, overlayVkw) =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(overlayVkw.waarde)).set(overlayVkw)(kpv);

  export const zetTerugvalkleur: ReduceFunction<KleurPerVeldwaarde, clr.Kleur> = reducerFromLens(terugvalKleurLens);
}
