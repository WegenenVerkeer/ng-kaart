import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, Function3, not, or, Predicate } from "fp-ts/lib/function";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { Optional } from "monocle-ts";
import { isUndefined } from "util";

import * as clr from "../../stijl/colour";
import * as sft from "../../stijl/stijl-function-types";
import * as sst from "../../stijl/stijl-static-types";
import * as ke from "../kaart-elementen";
import { Legende, LijnItem } from "../kaart-legende";
import * as ss from "../stijl-selector";

import { AfgeleideKleur, gevonden, nietGevonden, VeldKleurWaarde } from "./model";
import { kleurenpaletGroot } from "./palet";

// Voorlopig geven we alle lagen dezelfde, eenvoudige stijl op het kleur na
export const enkelvoudigeKleurStijl: Function1<clr.Kleur, ss.Awv0StaticStyleSpec> = kleur => ({
  type: "StaticStyle",
  definition: {
    fill: {
      color: clr.kleurcodeValue(clr.setOpacity(0.25)(kleur))
    },
    stroke: {
      color: clr.kleurcodeValue(kleur),
      width: 4
    },
    circle: {
      radius: 5,
      fill: {
        color: clr.kleurcodeValue(kleur)
      }
    }
  }
});
export const enkelvoudigeKleurLegende: Function2<string, clr.Kleur, Legende> = (laagTitel, kleur) =>
  Legende([LijnItem(laagTitel, clr.kleurcodeValue(kleur), none)]);

const standaardKleurenPerVeldwaarde: Function1<ke.VeldInfo, VeldKleurWaarde[]> = veldInfo =>
  array.zip(veldInfo.uniekeWaarden.sort(), kleurenpaletGroot).map(([label, kleur]) => ({ waarde: label, kleur: kleur }));

export const zetVeldKleurWaarde: Function3<VeldKleurWaarde[], string, clr.Kleur, VeldKleurWaarde[]> = (vkwn, waarde, kleur) =>
  vkwn.map(vkw => (vkw.waarde === waarde ? { waarde: waarde, kleur: kleur } : vkw));

const veldKleurWaardeToRule: Curried2<string, VeldKleurWaarde, sft.Rule> = veldnaam => vkw => ({
  condition: {
    kind: "==",
    left: { kind: "Property", type: "string", ref: veldnaam },
    right: { kind: "Literal", value: vkw.waarde }
  },
  style: {
    definition: enkelvoudigeKleurStijl(vkw.kleur).definition
  }
});

export const veldKleurWaardenAsStijlfunctie: Curried2<string, VeldKleurWaarde[], ss.Awv0DynamicStyleSpec> = veldnaam => vkwn => ({
  type: "DynamicStyle",
  definition: {
    rules: array.snoc(vkwn.map(veldKleurWaardeToRule(veldnaam)), {
      condition: { kind: "Literal", value: true },
      style: { definition: enkelvoudigeKleurStijl(clr.cyaan).definition }
    })
  }
});

export const veldKleurWaardenLegende: Curried2<string, VeldKleurWaarde[], Legende> = veldnaam => vkwn =>
  Legende(vkwn.map(vkw => LijnItem(`${veldnaam}: ${vkw.waarde}`, clr.kleurcodeValue(vkw.kleur), none)));

// We gaan er van uit dat we de stijlen zelf gezet hebben in de UI. Dat wil zeggen dat we het kleurtje van het bolletje
// uit de stijlspec  kunnen peuteren. Uiteraard houden we er rekening mee dat de stijl helemaal niet aan onze voorwaarden voldoet,
// maar dan vallen we terug op de standaardinstellingen.
// We moeten vrij diep in de hiërarchie klauteren om het gepaste attribuut te pakken te krijgen. Vandaar het gebruik van Lenses e.a.

// Deze Optional peutert de kleur uit een statisch stijl
const staticStyleKleurOptional: Optional<sst.Awv0StaticStyle, clr.Kleur> = sst.fullStylePrism
  .composeOptional(sst.FullStyle.circleOptional)
  .compose(sst.Circle.fillOptional)
  .composeLens(sst.Fill.colorLens)
  .compose(sst.Color.kleurOptional);
// Deze Optional probeert een statische stijl uit een laag te halen
const staticStyleOptional: Optional<ke.ToegevoegdeVectorLaag, sst.Awv0StaticStyle> = ke.ToegevoegdeVectorLaag.stijlSelBronLens.composeIso(
  ss.Awv0StaticStyleSpecIso
);
// Deze Optional probeert een dynamisch stijl uit een laag te halen
const dynamicStyleOptional: Optional<ke.ToegevoegdeVectorLaag, sft.Awv0DynamicStyle> = ke.ToegevoegdeVectorLaag.stijlSelBronLens.composeIso(
  ss.Awv0DynamicStyleSpecIso
);
const gezetteLaagKleur: Function1<ke.ToegevoegdeVectorLaag, Option<clr.Kleur>> = staticStyleOptional.compose(staticStyleKleurOptional)
  .getOption;

const containsAtLeastOneRule: Predicate<sft.Rule[]> = not(or(isUndefined, array.isEmpty));

const extractVeldnaam: Function1<sft.Expression, Option<string>> = expression => {
  if (expression.kind === "==" && expression.left.kind === "Property") {
    return some(expression.left.ref);
  } else {
    return none;
  }
};

const mustBe: Function1<string, Predicate<string>> = a => b => a === b;

const extractVeldwaarde: Function2<string, sft.Expression, Option<string>> = (veldnaam, expression) => {
  return extractVeldnaam(expression)
    .filter(mustBe(veldnaam))
    .chain(() => {
      if (expression.kind === "==" && expression.right.kind === "Literal" && typeof expression.right.value === "string") {
        return some(expression.right.value);
      } else {
        return none;
      }
    });
};

const ruleToVeldKleurWaarde: Curried2<string, sft.Rule, Option<VeldKleurWaarde>> = veldnaam => rule => {
  const maybeKleur = staticStyleKleurOptional.getOption(rule.style.definition).map(gevonden);
  const maybeWaarde = extractVeldwaarde(veldnaam, rule.condition);
  return maybeKleur.chain(kleur => maybeWaarde.map(waarde => VeldKleurWaarde.create(waarde, kleur)));
};

// catOptions negeert "foute" rules. Als we de boel willen afblazen bij 1 foute rule, moeten we sequence gebruiken.
const rulesToVeldKleurWaarden: Curried2<string, sft.Rule[], Option<VeldKleurWaarde[]>> = veldnaam => rules =>
  containsAtLeastOneRule(rules)
    ? extractVeldnaam(rules[0].condition) // De eerste regel moet wbt structuur aan onze verwachtingen voldoen
        .filter(mustBe(veldnaam)) // En voor hetzelfde veld zijn
        .map(() => array.catOptions(rules.map(ruleToVeldKleurWaarde(veldnaam)))) // dan pogen we we alle de rest om te zetten
    : none;

export const uniformeKleurViaLaag: Function1<ke.ToegevoegdeVectorLaag, AfgeleideKleur> = laag =>
  gezetteLaagKleur(laag)
    .map(gevonden)
    .getOrElse(nietGevonden);

export const veldInfoViaLaagEnVeldnaam: Function2<ke.ToegevoegdeVectorLaag, string, Option<ke.VeldInfo>> = (laag, veldnaam) =>
  fromNullable(laag.bron.velden.get(veldnaam));

export const veldKleurWaardenViaLaagEnVeldnaam: Function2<ke.ToegevoegdeVectorLaag, string, VeldKleurWaarde[]> = (laag, veldnaam) =>
  dynamicStyleOptional
    .composeLens(sft.rulesLens)
    .getOption(laag)
    .chain(rulesToVeldKleurWaarden(veldnaam)) // als wij de regels gegenereerd hebben of veel geluk hebben
    .orElse(() => veldInfoViaLaagEnVeldnaam(laag, veldnaam).map(standaardKleurenPerVeldwaarde)) // als het veld bestaat
    .getOrElse([]); // we geven het op
