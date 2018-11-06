import * as array from "fp-ts/lib/Array";
import { Function1, Function2 } from "fp-ts/lib/function";
import { fromNullable, none, Option } from "fp-ts/lib/Option";

import * as clr from "../../stijl/colour";
import * as ke from "../kaart-elementen";
import { Legende } from "../kaart-legende";
import * as ss from "../stijl-selector";

import { VeldKleurWaarde } from "./model";
import { kleurenpaletExtra } from "./palet";

// Voorlopig geven we alle lagen dezelfde, eenvoudige stijl op het kleur na
export const enkelvoudigeKleurStijl: Function1<clr.Kleur, ss.Awv0StyleSpec> = kleur => ({
  type: "StaticStyle",
  definition: {
    fill: {
      color: clr.kleurcodeValue(clr.setOpacity(0.25)(kleur))
    },
    stroke: {
      color: clr.kleurcodeValue(kleur),
      width: 4
    },
    image: {
      radius: 5,
      fill: {
        color: clr.kleurcodeValue(kleur)
      }
    }
  }
});
export const enkelvoudigeKleurLegende: Function2<string, clr.Kleur, Legende> = (laagTitel, kleur) =>
  Legende([{ type: "Lijn", beschrijving: laagTitel, kleur: clr.kleurcodeValue(kleur), achtergrondKleur: none }]);

const stdVeldKleuren: Function1<ke.VeldInfo, VeldKleurWaarde[]> = veldInfo =>
  array.zip(veldInfo.uniekeWaarden, kleurenpaletExtra).map(([label, kleur]) => ({ waarde: label, kleur: kleur }));

const veldKleurWaardenViaLaagEnVeldInfo: Function2<ke.ToegevoegdeVectorLaag, ke.VeldInfo, VeldKleurWaarde[]> = (laag, veld) =>
  ke.ToegevoegdeVectorLaag.stijlSelBronLens
    .composeIso(ss.Awv0DynamicStyleSpecIso)
    .getOption(laag)
    .chain(() => none as Option<VeldKleurWaarde[]>)
    .getOrElseL(() => stdVeldKleuren(veld));
export const veldKleurWaardenViaLaagEnVeldnaam: Function2<ke.ToegevoegdeVectorLaag, string, VeldKleurWaarde[]> = (laag, veldnaam) =>
  fromNullable(laag.bron.velden.get(veldnaam))
    .map(veld => veldKleurWaardenViaLaagEnVeldInfo(laag, veld))
    .getOrElse([]);
