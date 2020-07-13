import { array, eq, option } from "fp-ts";
import { Curried2, Function1, Function2, not, or, Predicate } from "fp-ts/lib/function";
import { Optional } from "monocle-ts";

import * as clr from "../../stijl/colour";
import * as sft from "../../stijl/stijl-function-types";
import * as sst from "../../stijl/stijl-static-types";
import * as arrays from "../../util/arrays";
import { Comparator } from "../../util/function";
import { isUndefined } from "../../util/null";
import * as ke from "../kaart-elementen";
import { Legende, LijnItem } from "../kaart-legende";
import * as ss from "../stijl-selector";

import { EnkeleKleur, KleurPerVeldwaarde, VeldProps, VeldwaardeKleur } from "./model";
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
        color: clr.kleurcodeValue(clr.setOpacity(0.75)(kleur))
      },
      stroke: {
        color: clr.kleurcodeValue(clr.donkergrijs),
        width: 1
      }
    }
  }
});

// Zet de stijl van het laageditormodel om in een stijl die we kunnen persisteren en converteren naar OL styles.
export const enkeleKleurToStijlSpec: Function1<EnkeleKleur, ss.AwvV0StaticStyleSpec> = stijl => enkelvoudigeKleurStijl(stijl.kleur);
export const enkeleKleurToLegende: Curried2<string, EnkeleKleur, Legende> = laagTitel => stijl =>
  Legende([LijnItem(laagTitel, clr.kleurcodeValue(stijl.kleur), option.none)]);

const veldwaardeKleurToRule: Curried2<VeldProps, VeldwaardeKleur, sft.Rule> = veld => vkw => ({
  condition: {
    kind: "==",
    left: { kind: "Property", type: veld.expressietype, ref: veld.naam },
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
    rules: array.snoc(kpv.waardekleuren.map(veldwaardeKleurToRule(kpv.veld)), terugvalkleurToRule(kpv.terugvalkleur))
  }
});

export const kleurPerVeldwaardeToLegende: Function1<KleurPerVeldwaarde, Legende> = kpv =>
  Legende(
    array.snoc(
      kpv.waardekleuren.map(vkw => LijnItem(`${kpv.veld.naam}: ${vkw.waarde}`, clr.kleurcodeValue(vkw.kleur), option.none)),
      LijnItem("Andere", clr.kleurcodeValue(kpv.terugvalkleur), option.none)
    )
  );

// We gaan er van uit dat we de stijlen zelf gezet hebben in de UI. Dat wil zeggen dat we het kleurtje van het bolletje
// uit de stijlspec kunnen peuteren. Uiteraard houden we er rekening mee dat de stijl helemaal niet aan onze voorwaarden voldoet,
// maar dan vallen we terug op de standaardinstellingen.
// We moeten vrij diep in de hiërarchie klauteren om het gepaste attribuut te pakken te krijgen. Vandaar het gebruik van Lenses e.a.

// Deze Optional peutert de kleur uit een statisch stijl. We moeten een atribuut nemen dat de kleur bevat.
const staticStyleKleurOptional: Optional<sst.AwvV0StaticStyle, clr.Kleur> = sst.fullStylePrism
  .composeOptional(sst.FullStyle.strokeOptional)
  .compose(sst.Stroke.colorOptional)
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

const gezetteLaagKleur: Function1<ke.ToegevoegdeVectorLaag, option.Option<clr.Kleur>> = staticStyleOptional.compose(
  staticStyleKleurOptional
).getOption;

const containsAtLeastOneRule: Predicate<sft.Rule[]> = not(or(isUndefined, arrays.isEmpty));

const extractVeldnaam: Function1<sft.Expression, option.Option<string>> = expression => {
  if (expression.kind === "==" && expression.left.kind === "Property") {
    return option.some(expression.left.ref);
  } else {
    return option.none;
  }
};

const mustBe: Function1<string, Predicate<string>> = a => b => a === b;

const extractVeldwaarde: Function2<string, sft.Expression, option.Option<sft.ValueType>> = (veldnaam, expression) => {
  return extractVeldnaam(expression)
    .filter(mustBe(veldnaam))
    .chain(() => {
      if (expression.kind === "==" && expression.right.kind === "Literal") {
        return option.some(expression.right.value);
      } else {
        return option.none;
      }
    });
};

const ruleToVeldwaardeKleur: Curried2<string, sft.Rule, option.Option<VeldwaardeKleur>> = veldnaam => rule => {
  const maybeKleur = staticStyleKleurOptional.getOption(rule.style.definition);
  const maybeWaarde = extractVeldwaarde(veldnaam, rule.condition);
  return maybeKleur.chain(kleur => maybeWaarde.map(waarde => VeldwaardeKleur.create(waarde, kleur)));
};

// catOptions negeert "foute" rules. Als we de boel willen afblazen bij 1 foute rule, moeten we sequence gebruiken.
// Maar: de fallback rule zal niet aan het VKW stramien voldoen, dus best houden zoals het is.
const rulesToVeldwaardeKleuren: Curried2<string, sft.Rule[], option.Option<VeldwaardeKleur[]>> = veldnaam => rules =>
  containsAtLeastOneRule(rules)
    ? extractVeldnaam(rules[0].condition) // De eerste regel moet wbt structuur aan onze verwachtingen voldoen
        .filter(mustBe(veldnaam)) // En voor hetzelfde veld zijn. Controle is nodig om none te produceren ipv some([])
        .map(() => array.catOptions(rules.map(ruleToVeldwaardeKleur(veldnaam)))) // dan pogen we we alle de rest om te zetten
    : option.none;

const ruleToTerugvalkleur: Function1<sft.Rule, option.Option<clr.Kleur>> = rule =>
  option
    .fromPredicate<sft.Rule>(rule => rule.condition.kind === "Literal" && rule.condition.value === true)(rule)
    .map(rule => rule.style)
    .chain(style => staticStyleKleurOptional.getOption(style.definition));

const rulesToTerugvalkleur: Function1<sft.Rule[], option.Option<clr.Kleur>> = rules =>
  option
    .fromPredicate(arrays.isSingleton)(array.catOptions(rules.map(ruleToTerugvalkleur)))
    .map(arr => arr[0]);

const ruleToVergelijkendeVeldnaam: Function1<sft.Rule, option.Option<string>> = rule => extractVeldnaam(rule.condition);
const rulesToUniqueVeldnamen: Function1<sft.Rule[], string[]> = rules =>
  array.uniq(eq.eqString)(array.mapOption(rules, ruleToVergelijkendeVeldnaam));

const rulesToVeldnaam: Function1<sft.Rule[], option.Option<string>> = rules =>
  option
    .fromPredicate(arrays.isArray)(rules)
    .map(rulesToUniqueVeldnamen)
    .filter(arrays.isSingleton) // alle regels moeten dezelfde veldnaam gebruiken
    .chain(array.head);

const rulesToKleurPerVeld: Curried2<VeldProps, sft.Rule[], option.Option<KleurPerVeldwaarde>> = veld => rules =>
  rulesToVeldwaardeKleuren(veld.naam)(rules).chain(vkwn =>
    rulesToTerugvalkleur(rules).map(terugvalkleur => KleurPerVeldwaarde.createAfgeleid(veld, vkwn, terugvalkleur))
  );

const comparatorForWaardeType: Function1<sft.TypeType, Comparator<sft.ValueType>> = waardetype => {
  switch (waardetype) {
    case "boolean":
      return (a, b) => ((a as boolean) ? 1 : 0) - ((b as boolean) ? 1 : 0);
    case "number":
      return (a, b) => (a as number) - (b as number);
    case "string":
      return (a, b) => ((a as string) === (b as string) ? 0 : a < b ? -1 : 1);
  }
};

const standaardKleurenPerVeldwaarde: Function1<VeldProps, VeldwaardeKleur[]> = veldprops =>
  array
    .zip(veldprops.uniekeWaarden.sort(comparatorForWaardeType(veldprops.expressietype)), kleurenpaletGroot)
    .map(([label, kleur]) => ({ waarde: label, kleur: kleur }));

const standaardTerugvalKleur = clr.zachtgrijs;

const standaardInstellingVoorVeldwaarde: Function1<VeldProps, KleurPerVeldwaarde> = veldprops =>
  KleurPerVeldwaarde.createSynthetisch(veldprops, standaardKleurenPerVeldwaarde(veldprops), standaardTerugvalKleur);

export const enkeleKleurViaLaag: Function1<ke.ToegevoegdeVectorLaag, EnkeleKleur> = laag =>
  gezetteLaagKleur(laag)
    .map(EnkeleKleur.createAfgeleid)
    .getOrElse(EnkeleKleur.createSynthetisch(clr.rood));

const veldInfoViaLaagEnVeldnaam: Function2<ke.ToegevoegdeVectorLaag, string, option.Option<ke.VeldInfo>> = (laag, veldnaam) =>
  ke.ToegevoegdeVectorLaag.veldInfoOpNaamOptional(veldnaam).getOption(laag);

export const kleurveldnaamViaLaag: Function1<ke.ToegevoegdeVectorLaag, option.Option<string>> = laag =>
  dynamicStyleOptional
    .composeLens(sft.rulesLens)
    .getOption(laag)
    .chain(rulesToVeldnaam);

export const kleurPerVeldwaardeViaLaagEnVeldnaam: Curried2<
  ke.ToegevoegdeVectorLaag,
  string,
  option.Option<KleurPerVeldwaarde>
> = laag => veldnaam =>
  veldInfoViaLaagEnVeldnaam(laag, veldnaam).chain(veld =>
    VeldProps.fromVeldinfo(veld).chain(veldProps =>
      dynamicStyleOptional
        .composeLens(sft.rulesLens)
        .getOption(laag)
        // als wij de regels gegenereerd hebben of veel geluk hebben
        .chain(rules => rulesToKleurPerVeld(veldProps)(rules))
        // als veld bestaat
        .orElse(() => veldInfoViaLaagEnVeldnaam(laag, veldnaam).map(() => standaardInstellingVoorVeldwaarde(veldProps)))
    )
  );
export const kleurPerVeldwaardeViaLaagEnVeldnaam2: Curried2<
  ke.ToegevoegdeVectorLaag,
  string,
  option.Option<KleurPerVeldwaarde>
> = laag => veldnaam =>
  ke.ToegevoegdeVectorLaag.veldInfoOpNaamOptional(veldnaam)
    .getOption(laag)
    .chain(veld =>
      dynamicStyleOptional
        .composeLens(sft.rulesLens)
        .getOption(laag)
        // als wij de regels gegenereerd hebben of veel geluk hebben
        .chain(rules =>
          VeldProps.fromVeldinfo(veld).chain(veldProps =>
            rulesToKleurPerVeld(veldProps)(rules)
              // als veld bestaat
              .orElse(() => veldInfoViaLaagEnVeldnaam(laag, veldnaam).map(() => standaardInstellingVoorVeldwaarde(veldProps)))
          )
        )
    );

export const veldenMetUniekeWaarden: Function1<ke.ToegevoegdeVectorLaag, VeldProps[]> = laag =>
  array.mapOption(ke.ToegevoegdeVectorLaag.veldInfosLens.get(laag), VeldProps.fromVeldinfo);
