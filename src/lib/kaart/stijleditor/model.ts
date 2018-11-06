import { Curried2, Function1 } from "fp-ts/lib/function";

import * as clr from "../../stijl/colour";
import { Circle, Fill, FullStyle, fullStylePrism } from "../../stijl/stijl-static-types";
import * as ke from "../kaart-elementen";
import * as ss from "../stijl-selector";

// Alle kleuren die dezelfde zijn als de doelkleur krijgen een gekozen veldje
export interface KiesbareKleur extends clr.Kleur {
  gekozen?: boolean; // enkel voor gebruik in HTML
}
export const markeerKleur: Curried2<clr.Kleur, clr.Kleur[], KiesbareKleur[]> = doelkleur => kleuren =>
  kleuren.map(kleur => (kleur.code === doelkleur.code ? { ...kleur, gekozen: true } : kleur));

// Op het niveau van een stijl is er geen eenvoudige kleur. We gaan dit proberen af leiden van het bolletje in de stijl.
export interface AfgeleideKleur extends clr.Kleur {
  gevonden: boolean; // enkel voor gebruik in HTML
}
export const gevonden: Function1<clr.Kleur, AfgeleideKleur> = kleur => ({ ...kleur, gevonden: true });
export const nietGevonden: AfgeleideKleur = {
  ...clr.toKleurUnsafe("grijs", "#6d6d6d"), // kleurcode mag niet voorkomen in palet omdat we op code matchen
  gevonden: false
};

// We gaan er van uit dat de stijl er een is die we zelf gezet hebben. Dat wil zeggen dat we het kleurtje van het bolletje
// uit de stijlspec  kunnen peuteren.
// We moeten vrij diep in de hierarchie klauteren om het gepaste attribuut te pakken te krijgen. Vandaar het gebruik van Lenses e.a.
export const kleurViaLaag: Function1<ke.ToegevoegdeVectorLaag, AfgeleideKleur> = laag =>
  ke.ToegevoegdeVectorLaag.stijlSelBronLens
    .composeIso(ss.Awv0StaticStyleSpecIso)
    .composePrism(fullStylePrism)
    .compose(FullStyle.circleOptional)
    .compose(Circle.fillOptional)
    .composeLens(Fill.colorLens)
    .getOption(laag)
    .chain(clr.olToKleur)
    .map(gevonden)
    .getOrElse(nietGevonden);

export interface VeldKleurWaarde {
  waarde: string;
  kleur: clr.Kleur;
}
