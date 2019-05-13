import { Component, Input, NgZone } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { constTrue, Function1, Function2, Predicate } from "fp-ts/lib/function";
import * as map from "fp-ts/lib/Map";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { setoidString } from "fp-ts/lib/Setoid";
import * as Mustache from "mustache";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { VeldInfo } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";

import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

const GEOMETRY = "geometry";
const IDENT8 = "ident8";
const IDENT8EN = "ident8en";
const LOCATIE_IDENT8 = "locatie.ident8";
const BEGIN_POSITIE = "locatie.begin.positie";
const BEGIN_AFSTAND = "locatie.begin.afstand";
const BEGIN_AFSTAND_ALT = "van_afstand";
const BEGIN_OPSCHRIFT = "locatie.begin.opschrift";
const BEGIN_OPSCHRIFT_ALT = "van_referentiepaal";
const EIND_POSITIE = "locatie.eind.positie";
const EIND_AFSTAND = "locatie.eind.afstand";
const EIND_AFSTAND_ALT = "tot_afstand";
const EIND_OPSCHRIFT = "locatie.eind.opschrift";
const EIND_OPSCHRIFT_ALT = "tot_referentiepaal";
const LENGTE = "lengte";
const LOCATIE_GEOMETRY_LENGTE = "locatie.geometry.lengte";
const LOCATIE_LENGTE = "locatie.lengte";
const ZIJDERIJBAAN = "zijderijbaan";
const AFSTANDRIJBAAN = "afstandrijbaan";
const BREEDTE = "breedte";
const HM = "hm";
const VERPL = "verpl";

export type VeldinfoMap = Map<string, VeldInfo>;
export interface Properties {
  readonly [key: string]: any;
}

const geldigeWaarde = value => value !== undefined && value !== null;

const nestedProperty = (propertyKey: string, object: Object) =>
  geldigeWaarde(propertyKey)
    ? propertyKey.split(".").reduce((obj, key) => (geldigeWaarde(obj) && geldigeWaarde(obj[key]) ? obj[key] : null), object)
    : null;

const formateerJson = (veld: string, veldtype: string, json: any, formatString: string): string => {
  const jsonString = typeof json === "string" || json instanceof String ? json : JSON.stringify(json);
  const jsonObject = veldtype === "json" ? JSON.parse(`{"${veld}": ${jsonString}}`) : JSON.parse(`{"${veld}": "${jsonString}"}`);
  return Mustache.render(formatString, jsonObject);
};

const formateerDatum = (dateString: string): string => {
  if (isValidDate(dateString)) {
    return new Date(dateString).toLocaleDateString("nl-BE");
  } else {
    return dateString; // date string niet herkend, geef input terug
  }
};

const formateerDateTime = (dateString: string): string => {
  if (isValidDate(dateString)) {
    const date = new Date(dateString);
    return date.toLocaleDateString("nl-BE") + " " + date.toLocaleTimeString("nl-BE");
  } else {
    return dateString; // date string niet herkend, geef input terug
  }
};

const isValidDate = (dateString: string): boolean => {
  const timestamp = Date.parse(dateString);

  return !isNaN(timestamp);
};

const veldnamen: Function1<VeldinfoMap, string[]> = veldbeschrijvingen => [...veldbeschrijvingen.keys()];

const veldbeschrijving: Function2<string, VeldinfoMap, Option<VeldInfo>> = (veld, veldbeschrijvingen) =>
  map.lookup(setoidString)(veld, veldbeschrijvingen);

const hasVeldSatisfying: Function1<Predicate<VeldInfo>, Function2<VeldinfoMap, string, boolean>> = test => (veldbeschrijvingen, veld) =>
  veldbeschrijving(veld, veldbeschrijvingen).exists(test);

const hasVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(constTrue);

const isType: Function1<string, Function2<VeldinfoMap, string, boolean>> = type => hasVeldSatisfying(veldInfo => veldInfo.type === type);

const isBoolean: Function2<VeldinfoMap, string, boolean> = isType("boolean");
const isDatum: Function2<VeldinfoMap, string, boolean> = isType("date");
const isDateTime: Function2<VeldinfoMap, string, boolean> = isType("datetime");

// indien geen meta informatie functie, toon alle velden
const isBasisVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(veldInfo => veldInfo.isBasisVeld);

@Component({
  selector: "awv-kaart-info-boodschap-veldinfo",
  templateUrl: "./kaart-info-boodschap-veldinfo.component.html",
  styleUrls: ["./kaart-info-boodschap-veldinfo.component.scss"]
})
export class KaartInfoBoodschapVeldinfoComponent extends KaartChildComponentBase {
  @Input()
  properties: Properties;
  @Input()
  veldbeschrijvingen: VeldinfoMap = new Map();

  private _alleVeldenZichtbaar = false;

  teVerbergenProperties = [
    IDENT8,
    LOCATIE_IDENT8,
    IDENT8EN,
    GEOMETRY,
    BEGIN_POSITIE,
    BEGIN_AFSTAND,
    BEGIN_AFSTAND_ALT,
    BEGIN_OPSCHRIFT,
    BEGIN_OPSCHRIFT_ALT,
    EIND_POSITIE,
    EIND_AFSTAND,
    EIND_AFSTAND_ALT,
    EIND_OPSCHRIFT,
    EIND_OPSCHRIFT_ALT,
    LENGTE,
    LOCATIE_GEOMETRY_LENGTE,
    LOCATIE_LENGTE,
    AFSTANDRIJBAAN,
    ZIJDERIJBAAN,
    BREEDTE,
    HM,
    VERPL
  ];

  constructor(
    parent: KaartComponent,
    zone: NgZone,
    private kaartInfoBoodschapComponent: KaartInfoBoodschapComponent,
    private readonly sanitizer: DomSanitizer
  ) {
    super(parent, zone);
  }

  heeft(key: string) {
    return geldigeWaarde(this.waarde(key));
  }

  alleVeldenZichtbaar() {
    return this._alleVeldenZichtbaar;
  }

  setAlleVeldenZichtbaar(zichtbaar: boolean) {
    this._alleVeldenZichtbaar = zichtbaar;
    this.kaartInfoBoodschapComponent.scrollIntoView();
  }

  lengte(): Option<number> {
    return fromNullable(this.waarde(LOCATIE_LENGTE))
      .map(Math.round)
      .orElse(() => fromNullable(this.waarde(LENGTE)).map(Math.round))
      .orElse(() => fromNullable(this.waarde(LOCATIE_GEOMETRY_LENGTE)).map(Math.round));
  }

  breedte(): Option<string> {
    return fromNullable(this.waarde(BREEDTE)).map(b => b.toString());
  }

  heeftDimensies() {
    return this.lengte().isSome() || this.breedte().isSome();
  }

  dimensies(): string {
    return this.lengte().foldL(
      () => this.breedte().fold("Geen dimensies", breedte => `${breedte}cm`),
      lengte => this.breedte().foldL<string>(() => `${lengte}m`, breedte => `${lengte}m x ${breedte}cm`)
    );
  }

  zijderijbaan(): string {
    switch (this.waarde(ZIJDERIJBAAN)) {
      case "R":
        return "Rechts";
      case "L":
        return "Links";
      case "M":
        return "Midden";
      case "O":
        return "Op";
      default:
        return fromNullable(this.waarde(ZIJDERIJBAAN))
          .map(b => b.toString())
          .getOrElse("");
    }
  }

  heeftVanTot(): boolean {
    return (
      (geldigeWaarde(this.waarde(BEGIN_OPSCHRIFT)) && geldigeWaarde(this.waarde(EIND_OPSCHRIFT))) ||
      (geldigeWaarde(this.waarde(BEGIN_OPSCHRIFT_ALT)) && geldigeWaarde(this.waarde(EIND_OPSCHRIFT_ALT)))
    );
  }

  heeftIdent8en(): boolean {
    return this.heeft(IDENT8EN) && (this.waarde(IDENT8EN) as string[]).length > 0;
  }

  ident8en() {
    return fromNullable((this.waarde(IDENT8EN) as string[]).join(", ")).getOrElse("");
  }

  heeftIdent8(): boolean {
    return this.heeft(IDENT8) || this.heeft(LOCATIE_IDENT8) || this.heeft(IDENT8EN);
  }

  ident8() {
    if (this.heeftIdent8en()) {
      return this.ident8en();
    } else {
      return fromNullable(this.waarde(IDENT8))
        .orElse(() => fromNullable(this.waarde(LOCATIE_IDENT8)))
        .getOrElse("");
    }
  }

  van(): string {
    return this.pos(BEGIN_OPSCHRIFT)
      .alt(this.pos(BEGIN_OPSCHRIFT_ALT))
      .getOrElse("");
  }

  tot(): string {
    return this.pos(EIND_OPSCHRIFT)
      .alt(this.pos(EIND_OPSCHRIFT_ALT))
      .getOrElse("");
  }

  private afstand(afstandVeld: string): Option<string> {
    return fromNullable(this.waarde(afstandVeld)).map(this.signed);
  }

  vanAfstand(): string {
    return this.afstand(BEGIN_AFSTAND)
      .alt(this.afstand(BEGIN_AFSTAND_ALT))
      .getOrElse("");
  }

  totAfstand(): string {
    return this.afstand(EIND_AFSTAND)
      .alt(this.afstand(EIND_AFSTAND_ALT))
      .getOrElse("");
  }

  label(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .map(veldInfo => fromNullable(veldInfo.label).getOrElse(""))
      .getOrElse(veld);
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(
      key =>
        isBasisVeld(this.veldbeschrijvingen, key) &&
        !this.isLink(key) &&
        !isBoolean(this.veldbeschrijvingen, key) &&
        !this.teVerbergenProperties.includes(key)
    );
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(
      key =>
        isBasisVeld(this.veldbeschrijvingen, key) && isBoolean(this.veldbeschrijvingen, key) && !this.teVerbergenProperties.includes(key)
    );
  }

  linkEigenschappen(): string[] {
    return this.eigenschappen(
      key => isBasisVeld(this.veldbeschrijvingen, key) && this.isLink(key) && !this.teVerbergenProperties.includes(key)
    );
  }

  heeftGeavanceerdeEigenschappen(): boolean {
    return this.eigenschappen(key => !isBasisVeld(this.veldbeschrijvingen, key) && !this.teVerbergenProperties.includes(key)).length > 0;
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(
      key =>
        !isBasisVeld(this.veldbeschrijvingen, key) &&
        !isBoolean(this.veldbeschrijvingen, key) &&
        !this.isLink(key) &&
        !this.teVerbergenProperties.includes(key)
    );
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(
      key =>
        !isBasisVeld(this.veldbeschrijvingen, key) && isBoolean(this.veldbeschrijvingen, key) && !this.teVerbergenProperties.includes(key)
    );
  }

  geavanceerdeLinkEigenschappen(): string[] {
    return this.eigenschappen(
      key => !isBasisVeld(this.veldbeschrijvingen, key) && this.isLink(key) && !this.teVerbergenProperties.includes(key)
    );
  }

  constante(veld: string): Option<string> {
    return (
      veldbeschrijving(veld, this.veldbeschrijvingen)
        .chain(veldInfo => fromNullable(veldInfo.constante))
        // vervang elke instantie van {id} in de waarde van 'constante' door de effectieve id :
        .map(waarde =>
          veldnamen(this.veldbeschrijvingen).reduce((result, eigenschap) => {
            const token = `{${eigenschap}}`;
            // vervang _alle_ tokens met de waarde uit het record
            return result.includes(token) ? result.split(token).join(`${this.waarde(eigenschap)}`) : result;
          }, waarde)
        )
    );
  }

  waarde(name: string): Object {
    // indien er een 'constante' object in de definitie is, geef dat terug, anders geef de waarde in het veld terug
    return this.constante(name).getOrElseL(() => {
      const waarde = nestedProperty(name, this.properties);
      if (isDatum(this.veldbeschrijvingen, name) && waarde) {
        return formateerDatum(waarde.toString());
      } else if (isDateTime(this.veldbeschrijvingen, name) && waarde) {
        return formateerDateTime(waarde.toString());
      } else if (this.hasHtml(name) && waarde) {
        return this.sanitizer.bypassSecurityTrustHtml(formateerJson(name, this.veldtype(name), waarde, this.html(name)));
      } else if (this.hasTemplate(name) && waarde) {
        return formateerJson(name, this.veldtype(name), waarde, this.template(name));
      } else {
        return waarde;
      }
    });
  }

  verpl(): string {
    return fromNullable(this.waarde("verpl"))
      .map(this.signed)
      .getOrElse("");
  }

  private pos(positieVeld: string): Option<string> {
    return fromNullable(this.waarde(positieVeld))
      .filter(positie => typeof positie === "number")
      .map(positie => `${Math.round((positie as number) * 10) / 10}`);
  }

  private signed(value: number): string {
    if (value >= 0) {
      return `+${value}`;
    } else {
      return `${value}`;
    }
  }

  private eigenschappen(filter: (string) => boolean): string[] {
    return veldnamen(this.veldbeschrijvingen)
      .filter(veldNaam => filter(veldNaam))
      .filter(veldNaam => geldigeWaarde(nestedProperty(veldNaam!, this.properties)) || this.constante(veldNaam!).isSome())
      .filter(veldNaam => nestedProperty(veldNaam!, this.properties) !== "");
  }

  private isLink(veld: string): boolean {
    return (
      fromNullable(this.waarde(veld)) // indien waarde van veld begint met http
        .filter(waarde => typeof waarde === "string")
        .exists(waarde => `${waarde}`.startsWith("http")) ||
      veldbeschrijving(veld, this.veldbeschrijvingen) // indien 'constante' veld start met http
        .chain(veldInfo => fromNullable(veldInfo.constante)) //
        .exists(constante => constante.startsWith("http"))
    );
  }

  private hasTemplate(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => fromNullable(veldInfo.template))
      .isSome();
  }

  private hasHtml(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => fromNullable(veldInfo.html))
      .isSome();
  }

  private template(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => fromNullable(veldInfo.template))
      .getOrElse("");
  }

  private html(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => fromNullable(veldInfo.html))
      .getOrElse("");
  }

  private veldtype(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .map(veldInfo => veldInfo.type.toString())
      .getOrElse("");
  }

  heeftMaakAbbameldaMelding(): boolean {
    return hasVeld(this.veldbeschrijvingen, "meldingInAbbamelda");
  }
}
