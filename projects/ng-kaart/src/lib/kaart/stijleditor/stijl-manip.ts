import * as array from "fp-ts/lib/Array";
import { Curried2, Function1, Function2, not, or, Predicate } from "fp-ts/lib/function";
import { fromNullable, fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import { Optional } from "monocle-ts";
import { isUndefined } from "util";

import * as clr from "../../stijl/colour";
import * as sft from "../../stijl/stijl-function-types";
import * as sst from "../../stijl/stijl-static-types";
import * as arrays from "../../util/arrays";
import * as ke from "../kaart-elementen";
import { Legende, LijnItem } from "../kaart-legende";
import * as ss from "../stijl-selector";

import { KleurPerVeldwaarde, UniformeKleur, VeldwaardeKleur } from "./model";
import { kleurenpaletGroot } from "./palet";

// Deze module bevat alle functies die converteren tussen de StijlSpec en het laagstijleditor model.

// Voorlopig geven we alle lagen dezelfde, eenvoudige stijl op het kleur na
const enkelvoudigeKleurStijl: Function1<clr.Kleur, ss.AwvV0StaticStyleSpec> = kleur => ({
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

// Zet de stijl van het laageditormodel om in een stijl die we kunnen persisteren en converteren naar OL styles.
export const uniformeKleurToStijlSpec: Function1<UniformeKleur, ss.AwvV0StaticStyleSpec> = stijl => enkelvoudigeKleurStijl(stijl.kleur);
export const uniformeKleurToLegende: Curried2<string, UniformeKleur, Legende> = laagTitel => stijl =>
  Legende([LijnItem(laagTitel, clr.kleurcodeValue(stijl.kleur), none)]);

const veldwaardeKleurToRule: Curried2<string, VeldwaardeKleur, sft.Rule> = veldnaam => vkw => ({
  condition: {
    kind: "==",
    left: { kind: "Property", type: "string", ref: veldnaam },
    right: { kind: "Literal", value: vkw.waarde }
  },
  style: {
    definition: enkelvoudigeKleurStijl(vkw.kleur).definition
  }
});

const terugvalkleurToRule: Function1<clr.Kleur, sft.Rule> = kleur => ({
  condition: { kind: "Literal", value: true },
  style: { definition: enkelvoudigeKleurStijl(kleur).definition }
});

export const kleurPerVeldWaardeToStijlSpec: Function1<KleurPerVeldwaarde, ss.AwvV0DynamicStyleSpec> = kpv => ({
  type: "DynamicStyle",
  definition: {
    rules: array.snoc(kpv.waardekleuren.map(veldwaardeKleurToRule(kpv.veldnaam)), terugvalkleurToRule(kpv.terugvalkleur))
  }
});

export const kleurPerVeldwaardeToLegende: Function1<KleurPerVeldwaarde, Legende> = kpv =>
  Legende(
    array.snoc(
      kpv.waardekleuren.map(vkw => LijnItem(`${kpv.veldnaam}: ${vkw.waarde}`, clr.kleurcodeValue(vkw.kleur), none)),
      LijnItem("Andere", clr.kleurcodeValue(kpv.terugvalkleur), none)
    )
  );

// We gaan er van uit dat we de stijlen zelf gezet hebben in de UI. Dat wil zeggen dat we het kleurtje van het bolletje
// uit de stijlspec  kunnen peuteren. Uiteraard houden we er rekening mee dat de stijl helemaal niet aan onze voorwaarden voldoet,
// maar dan vallen we terug op de standaardinstellingen.
// We moeten vrij diep in de hiërarchie klauteren om het gepaste attribuut te pakken te krijgen. Vandaar het gebruik van Lenses e.a.

// Deze Optional peutert de kleur uit een statisch stijl
const staticStyleKleurOptional: Optional<sst.AwvV0StaticStyle, clr.Kleur> = sst.fullStylePrism
  .composeOptional(sst.FullStyle.circleOptional)
  .compose(sst.Circle.fillOptional)
  .composeLens(sst.Fill.colorLens)
  .compose(sst.Color.kleurOptional);

// Deze Optional probeert een statische stijl uit een laag te halen
const staticStyleOptional: Optional<ke.ToegevoegdeVectorLaag, sst.AwvV0StaticStyle> = ke.ToegevoegdeVectorLaag.stijlSelBronLens.composeIso(
  ss.AwvV0StaticStyleSpecIso
);

// Deze Optional probeert een dynamische stijl uit een laag te halen
const dynamicStyleOptional: Optional<
  ke.ToegevoegdeVectorLaag,
  sft.AwvV0DynamicStyle
> = ke.ToegevoegdeVectorLaag.stijlSelBronLens.composeIso(ss.AwvV0DynamicStyleSpecIso);

const gezetteLaagKleur: Function1<ke.ToegevoegdeVectorLaag, Option<clr.Kleur>> = staticStyleOptional.compose(staticStyleKleurOptional)
  .getOption;

const containsAtLeastOneRule: Predicate<sft.Rule[]> = not(or(isUndefined, arrays.isEmpty));

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

const ruleToVeldwaardeKleur: Curried2<string, sft.Rule, Option<VeldwaardeKleur>> = veldnaam => rule => {
  const maybeKleur = staticStyleKleurOptional.getOption(rule.style.definition);
  const maybeWaarde = extractVeldwaarde(veldnaam, rule.condition);
  return maybeKleur.chain(kleur => maybeWaarde.map(waarde => VeldwaardeKleur.create(waarde, kleur)));
};

// catOptions negeert "foute" rules. Als we de boel willen afblazen bij 1 foute rule, moeten we sequence gebruiken.
// Maar: de fallback rule zal niet aan het VKW stramien voldoen, dus best houden zoals het is.
const rulesToVeldwaardeKleuren: Curried2<string, sft.Rule[], Option<VeldwaardeKleur[]>> = veldnaam => rules =>
  containsAtLeastOneRule(rules)
    ? extractVeldnaam(rules[0].condition) // De eerste regel moet wbt structuur aan onze verwachtingen voldoen
        .filter(mustBe(veldnaam)) // En voor hetzelfde veld zijn. Controle is nodig om none te produceren ipv some([])
        .map(() => array.catOptions(rules.map(ruleToVeldwaardeKleur(veldnaam)))) // dan pogen we we alle de rest om te zetten
    : none;

const ruleToTerugvalkleur: Function1<sft.Rule, Option<clr.Kleur>> = rule =>
  fromPredicate<sft.Rule>(rule => rule.condition.kind === "Literal" && rule.condition.value === true)(rule)
    .map(rule => rule.style)
    .chain(style => staticStyleKleurOptional.getOption(style.definition));

const rulesToTerugvalkleur: Function1<sft.Rule[], Option<clr.Kleur>> = rules =>
  fromPredicate(arrays.isSingleton)(array.catOptions(rules.map(ruleToTerugvalkleur))).map(arr => arr[0]);

const ruleToVergelijkendeVeldnaam: Function1<sft.Rule, Option<string>> = rule => extractVeldnaam(rule.condition);
const rulesToUniqueVeldnamen: Function1<sft.Rule[], string[]> = rules =>
  array.uniq(setoidString)(array.mapOption(rules, ruleToVergelijkendeVeldnaam));

const rulesToVeldnaam: Function1<sft.Rule[], Option<string>> = rules =>
  fromPredicate(arrays.isArray)(rules)
    .map(rulesToUniqueVeldnamen)
    .filter(arrays.isSingleton) // alle regels moeten dezelfde veldnaam gebruiken
    .chain(array.head);

const rulesToKleurPerVeldwaarde: Curried2<string, sft.Rule[], Option<KleurPerVeldwaarde>> = veldnaam => rules =>
  rulesToVeldwaardeKleuren(veldnaam)(rules).chain(vkwn =>
    rulesToTerugvalkleur(rules).map(terugvalkleur => KleurPerVeldwaarde.createAfgeleid(veldnaam, vkwn, terugvalkleur))
  );

const standaardKleurenPerVeldwaarde: Function1<ke.VeldInfo, VeldwaardeKleur[]> = veldInfo =>
  array.zip(veldInfo.uniekeWaarden!.sort(), kleurenpaletGroot).map(([label, kleur]) => ({ waarde: label, kleur: kleur }));

const standaardTerugvalKleur = clr.zachtgrijs;

const standaardInstellingVoorVeldwaarde: Curried2<string, ke.VeldInfo, KleurPerVeldwaarde> = veldnaam => veldinfo =>
  KleurPerVeldwaarde.createSynthetisch(veldnaam, standaardKleurenPerVeldwaarde(veldinfo), standaardTerugvalKleur);

const terugvalKleurAlleen = KleurPerVeldwaarde.create(false, "", [], standaardTerugvalKleur);

export const uniformeKleurViaLaag: Function1<ke.ToegevoegdeVectorLaag, UniformeKleur> = laag =>
  gezetteLaagKleur(laag)
    .map(UniformeKleur.createAfgeleid)
    .getOrElse(UniformeKleur.createSynthetisch(clr.rood));

const veldInfoViaLaagEnVeldnaam: Function2<ke.ToegevoegdeVectorLaag, string, Option<ke.VeldInfo>> = (laag, veldnaam) =>
  fromNullable(laag.bron.velden.get(veldnaam));

export const kleurveldnaamViaLaag: Function1<ke.ToegevoegdeVectorLaag, Option<string>> = laag =>
  dynamicStyleOptional
    .composeLens(sft.rulesLens)
    .getOption(laag)
    .chain(rulesToVeldnaam);

export const kleurPerVeldwaardeViaLaagEnVeldnaam: Curried2<ke.ToegevoegdeVectorLaag, string, KleurPerVeldwaarde> = laag => veldnaam =>
  dynamicStyleOptional
    .composeLens(sft.rulesLens)
    .getOption(laag)
    .chain(rulesToKleurPerVeldwaarde(veldnaam)) // als wij de regels gegenereerd hebben of veel geluk hebben
    .orElse(() => veldInfoViaLaagEnVeldnaam(laag, veldnaam).map(standaardInstellingVoorVeldwaarde(veldnaam))) // als het veld bestaat
    .getOrElse(terugvalKleurAlleen); // we geven het op
