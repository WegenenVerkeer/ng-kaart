import { array, eq, option } from "fp-ts";
import { Curried2, Endomorphism, Function1, Function2, Function3, Function4, Function5, Predicate, Refinement } from "fp-ts/lib/function";
import { Lens, Optional } from "monocle-ts";

import * as clr from "../../stijl/colour";
import * as sft from "../../stijl/stijl-function-types";
import * as arrays from "../../util/arrays";
import { ReduceFunction, reducerFromLens } from "../../util/function";
import * as ke from "../kaart-elementen";

/////////////////
// Typedefinities
//

export interface VeldwaardeKleur {
  readonly waarde: sft.ValueType; // De waarde van een feature property
  readonly kleur: clr.Kleur; // De kleur voor die waarde
}

// Bevat een subset van de attributen van VeldInfo. De reden om af te splitsen is dat niet alle VeldInfo aanvaardbaar
// is. We zouden dan met option.Option moeten werken en dan nog het none geval niet goed kunnen afhandelen.
export interface VeldProps {
  readonly naam: string;
  readonly label?: string;
  readonly weergavetype: ke.VeldType; // voor bijv. afronding en sortering
  readonly expressietype: sft.TypeType; // zoals gebruint in onze stijlfuncties
  readonly uniekeWaarden: sft.ValueType[];
}

// De high-level stijlen die exact uitdrukken wat de gebruiker kiest als instellingen voor de laag in de UI.
// Om historische reden en ook omdat deze definities nogal variabel zijn naarmate er meer features toegevoegd worden,
// is dit verschillend van wat er gepersisteerd en op lagere niveaus gebruikt wordt. Daar gebruiken we immers
// AwvV0StyleSpec (persistentie) en StyleSelector (voor OL).
// We zouden dit type ook HighLevelLaagStijl genoemd kunnen hebben, maar we hebben al stijlen genoeg.
export type LaagkleurInstellingen = EnkeleKleur | KleurPerVeldwaarde;

// De instellingen nodig om een stijl met 1 kleur en legende te maken
export interface EnkeleKleur {
  readonly type: "enkel";
  readonly kleur: clr.Kleur;
  readonly afgeleid: boolean; // Wanneer de stijl afgeleid is van een StijlSpec. Maw dat de stijl al toegepast is.
}

// De instellingen nodig om een stijl met voor elke waarde van een specifiek veld een stijl en legende te maken
export interface KleurPerVeldwaarde {
  readonly type: "perVeldwaarde";
  readonly veld: VeldProps;
  readonly waardekleuren: VeldwaardeKleur[];
  readonly terugvalkleur: clr.Kleur;
  readonly afgeleid: boolean;
}

/////////////////
// Basisoperaties
//

export namespace VeldwaardeKleur {
  export const create: Function2<sft.ValueType, clr.Kleur, VeldwaardeKleur> = (waarde, kleur) => ({
    waarde: waarde,
    kleur: kleur
  });
  export const waarde: Lens<VeldwaardeKleur, sft.ValueType> = Lens.fromProp("waarde");
  export const kleur: Lens<VeldwaardeKleur, clr.Kleur> = Lens.fromProp("kleur");

  export const getEq: eq.Eq<VeldwaardeKleur> = eq.getStructEq({
    waarde: eq.eqString,
    kleur: clr.setoidKleurOpCode
  });
}

export namespace VeldProps {
  export const create: Function5<string, string, ke.VeldType, sft.TypeType, sft.ValueType[], VeldProps> = (
    naam,
    label,
    weergavetype,
    expressietype,
    uniekeWaarden
  ) => ({
    naam: naam,
    label: label,
    weergavetype: weergavetype,
    expressietype: expressietype,
    uniekeWaarden: uniekeWaarden
  });

  const hasRightNumberOfUniekeWaarden: Predicate<ke.VeldInfo> = veld =>
    arrays.isArray(veld.uniekeWaarden) && arrays.hasLengthBetween(1, 35)(veld.uniekeWaarden);

  const convertType: Function1<ke.VeldType, option.Option<sft.TypeType>> = vt => {
    switch (vt) {
      case "boolean":
        return option.some<sft.TypeType>("boolean");
      case "double":
      case "integer":
        return option.some<sft.TypeType>("number");
      case "date":
      case "string":
        return option.some<sft.TypeType>("string");
      default:
        return option.none;
    }
  };
  const convertData: Curried2<sft.TypeType, string, sft.ValueType> = expType => waarde => {
    switch (expType) {
      case "boolean":
        return waarde === "true"; // onze server stuurt enkel lower case
      case "number":
        return Number.parseFloat(waarde); // parset ook integer zonder probleem en crasht nooit
      case "string":
        return waarde; // datums blijven datums
    }
  };

  export const fromVeldinfo: Function1<ke.VeldInfo, option.Option<VeldProps>> = veldinfo =>
    option
      .fromPredicate(hasRightNumberOfUniekeWaarden)(veldinfo) //
      .chain(veld =>
        convertType(veld.type) //
          .map(exprtype =>
            create(
              veld.naam,
              option.fromNullable(veld.label).getOrElse(""),
              veld.type,
              exprtype,
              veld.uniekeWaarden!.map(convertData(exprtype))
            )
          )
      );
  export const setoidWithoutUniekeWaarden: eq.Eq<VeldProps> = eq.getStructEq({
    expressietype: eq.eqString,
    weergavetype: eq.eqString,
    naam: eq.eqString
    // De unieke waarden worden niet vergeleken
  });
}

export namespace LaagkleurInstellingen {
  export const isEnkeleKleur: Refinement<LaagkleurInstellingen, EnkeleKleur> = (inst): inst is EnkeleKleur => inst.type === "enkel";
  export const isKleurPerVeldwaarde: Refinement<LaagkleurInstellingen, KleurPerVeldwaarde> = (inst): inst is KleurPerVeldwaarde =>
    inst.type === "perVeldwaarde";
}

export namespace EnkeleKleur {
  export const create: Function2<boolean, clr.Kleur, EnkeleKleur> = (afgeleid, kleur) => ({
    type: "enkel",
    kleur: kleur,
    afgeleid: afgeleid
  });

  export const createAfgeleid: Function1<clr.Kleur, EnkeleKleur> = kleur => create(true, kleur);
  export const createSynthetisch: Function1<clr.Kleur, EnkeleKleur> = kleur => create(false, kleur);

  export const setoid: eq.Eq<EnkeleKleur> = eq.getStructEq({
    kleur: clr.setoidKleurOpCode,
    afgeleid: eq.eqBoolean
  });

  const kleurLens: Lens<EnkeleKleur, clr.Kleur> = Lens.fromProp("kleur");

  export const zetKleur: ReduceFunction<EnkeleKleur, clr.Kleur> = reducerFromLens(kleurLens);

  export const makeAfgeleid: Endomorphism<EnkeleKleur> = Lens.fromProp<EnkeleKleur, "afgeleid">("afgeleid").set(true);
}

export namespace KleurPerVeldwaarde {
  export const create: Function4<boolean, VeldProps, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (
    afgeleid,
    veld,
    waardekleuren,
    terugvalkleur
  ) => ({
    type: "perVeldwaarde",
    afgeleid: afgeleid,
    veld: veld,
    waardekleuren: waardekleuren,
    terugvalkleur: terugvalkleur
  });

  export const createAfgeleid: Function3<VeldProps, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (
    veld,
    waardekleuren,
    terugvalkleur
  ) => create(true, veld, waardekleuren, terugvalkleur);
  export const createSynthetisch: Function3<VeldProps, VeldwaardeKleur[], clr.Kleur, KleurPerVeldwaarde> = (
    veld,
    waardekleuren,
    terugvalkleur
  ) => create(false, veld, waardekleuren, terugvalkleur);

  export const setoid: eq.Eq<KleurPerVeldwaarde> = eq.getStructEq({
    afgeleid: eq.eqBoolean,
    waardekleuren: array.getEq(VeldwaardeKleur.getEq),
    terugvalkleur: clr.setoidKleurOpCode
  });

  const waardekleurenLens: Lens<KleurPerVeldwaarde, VeldwaardeKleur[]> = Lens.fromProp("waardekleuren");
  const terugvalKleurLens: Lens<KleurPerVeldwaarde, clr.Kleur> = Lens.fromProp("terugvalkleur");

  const findVeldwaardeKleurByWaarde: Curried2<sft.ValueType, VeldwaardeKleur[], option.Option<VeldwaardeKleur>> = waarde => vkwn =>
    array.findFirst(vkwn, vkw => vkw.waarde === waarde);

  const arrayAsMapOptional: Function1<sft.ValueType, Optional<VeldwaardeKleur[], VeldwaardeKleur>> = waarde =>
    new Optional<VeldwaardeKleur[], VeldwaardeKleur>(
      findVeldwaardeKleurByWaarde(waarde), // getter
      vkw => vkwn =>
        findVeldwaardeKleurByWaarde(waarde)(vkwn).isSome() ? vkwn.map(vk => (vk.waarde === vkw.waarde ? vkw : vk)) : array.cons(vkw, vkwn)
    );

  export const kleurVoorWaarde: Function1<sft.ValueType, Optional<KleurPerVeldwaarde, clr.Kleur>> = waarde =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(waarde).composeLens(VeldwaardeKleur.kleur));

  export const zetVeldwaardeKleur: ReduceFunction<KleurPerVeldwaarde, VeldwaardeKleur> = (kpv, overlayVkw) =>
    waardekleurenLens.composeOptional(arrayAsMapOptional(overlayVkw.waarde)).set(overlayVkw)(kpv);

  export const zetTerugvalkleur: ReduceFunction<KleurPerVeldwaarde, clr.Kleur> = reducerFromLens(terugvalKleurLens);

  export const makeAfgeleid: Endomorphism<KleurPerVeldwaarde> = Lens.fromProp<KleurPerVeldwaarde, "afgeleid">("afgeleid").set(true);
}
