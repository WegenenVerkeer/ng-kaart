import { Component, Input, NgZone } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { eq, map, option } from "fp-ts";
import { constTrue, Function1, Function2, Predicate } from "fp-ts/lib/function";
import * as Mustache from "mustache";

import * as arrays from "../../util/arrays";
import { formateerDate, formateerDateTime, parseDate, parseDateTime } from "../../util/date-time";
import { KaartChildDirective } from "../kaart-child.directive";
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

const hasValue: Predicate<any> = value => value !== undefined && value !== null;

const nestedPropertyValue: Function2<string, Object, any> = (propertyKey, object) =>
  hasValue(propertyKey)
    ? propertyKey.split(".").reduce((obj, key) => (hasValue(obj) && hasValue(obj[key]) ? obj[key] : null), object)
    : null;

const formateerJson = (veld: string, veldtype: string, json: any, formatString: string): string => {
  const jsonString = typeof json === "string" || json instanceof String ? json : JSON.stringify(json);
  const jsonObject = veldtype === "json" ? JSON.parse(`{"${veld}": ${jsonString}}`) : JSON.parse(`{"${veld}": "${jsonString}"}`);
  return Mustache.render(formatString, jsonObject);
};

const veldnamen: Function1<VeldinfoMap, string[]> = veldbeschrijvingen => [...veldbeschrijvingen.keys()];

const veldbeschrijving: Function2<string, VeldinfoMap, option.Option<VeldInfo>> = (veld, veldbeschrijvingen) =>
  map.lookup(eq.eqString)(veld, veldbeschrijvingen);

const hasVeldSatisfying: Function1<Predicate<VeldInfo>, Function2<VeldinfoMap, string, boolean>> = test => (veldbeschrijvingen, veld) =>
  veldbeschrijving(veld, veldbeschrijvingen).exists(test);

const hasVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(constTrue);

const isType: Function1<string, Function2<VeldinfoMap, string, boolean>> = type => hasVeldSatisfying(veldInfo => veldInfo.type === type);

const isBooleanVeld: Function2<VeldinfoMap, string, boolean> = isType("boolean");
const isDateVeld: Function2<VeldinfoMap, string, boolean> = isType("date");

// indien geen meta informatie functie, toon alle velden
const isBasisVeld: Function2<VeldinfoMap, string, boolean> = hasVeldSatisfying(veldInfo => veldInfo.isBasisVeld);

@Component({
  selector: "awv-kaart-info-boodschap-veldinfo",
  templateUrl: "./kaart-info-boodschap-veldinfo.component.html",
  styleUrls: ["./kaart-info-boodschap-veldinfo.component.scss"]
})
export class KaartInfoBoodschapVeldinfoComponent extends KaartChildDirective {
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

  heeftLocatieGegevensVoor(key: string) {
    return hasValue(this.waarde(key)) && this.isLocatieVeld(key);
  }

  alleVeldenZichtbaar() {
    return this._alleVeldenZichtbaar;
  }

  setAlleVeldenZichtbaar(zichtbaar: boolean) {
    this._alleVeldenZichtbaar = zichtbaar;
    this.kaartInfoBoodschapComponent.scrollIntoView();
  }

  lengte(): option.Option<number> {
    return option
      .fromNullable(this.waarde(LOCATIE_LENGTE))
      .map(Math.round)
      .orElse(() => option.fromNullable(this.waarde(LENGTE)).map(Math.round))
      .orElse(() => option.fromNullable(this.waarde(LOCATIE_GEOMETRY_LENGTE)).map(Math.round));
  }

  breedte(): option.Option<string> {
    return option.fromNullable(this.waarde(BREEDTE)).map(b => b.toString());
  }

  heeftDimensies() {
    return (
      this.heeftLocatieGegevensVoor(LOCATIE_LENGTE) ||
      this.heeftLocatieGegevensVoor(LOCATIE_LENGTE) ||
      this.heeftLocatieGegevensVoor(LOCATIE_GEOMETRY_LENGTE) ||
      this.heeftLocatieGegevensVoor(BREEDTE)
    );
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
        return option
          .fromNullable(this.waarde(ZIJDERIJBAAN))
          .map(b => b.toString())
          .getOrElse("");
    }
  }

  heeftVanTot(): boolean {
    return (
      (this.heeftLocatieGegevensVoor(BEGIN_OPSCHRIFT) && this.heeftLocatieGegevensVoor(EIND_OPSCHRIFT)) ||
      (this.heeftLocatieGegevensVoor(BEGIN_OPSCHRIFT_ALT) && this.heeftLocatieGegevensVoor(EIND_OPSCHRIFT_ALT))
    );
  }

  heeftIdent8en(): boolean {
    // TODO we ontbreken een string[] type
    const waarde = this.waarde(IDENT8EN);
    return arrays.isArray(waarde) && arrays.isNonEmpty(waarde);
  }

  ident8en() {
    // TODO we ontbreken een string[] type
    const waarde = this.waarde(IDENT8EN);
    return option
      .fromPredicate(arrays.isArray)(waarde)
      .map(s => s.join(", "))
      .getOrElse("");
  }

  heeftIdent8(): boolean {
    return (
      this.heeftLocatieGegevensVoor(IDENT8) || this.heeftLocatieGegevensVoor(LOCATIE_IDENT8) || this.heeftLocatieGegevensVoor(IDENT8EN)
    );
  }

  ident8() {
    if (this.heeftIdent8en()) {
      return this.ident8en();
    } else {
      return option
        .fromNullable(this.waarde(IDENT8))
        .orElse(() => option.fromNullable(this.waarde(LOCATIE_IDENT8)))
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

  private afstand(afstandVeld: string): option.Option<string> {
    return option.fromNullable(this.waarde(afstandVeld)).map(this.signed);
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
      .map(veldInfo => option.fromNullable(veldInfo.label).getOrElse(""))
      .getOrElse(veld);
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam) &&
        !isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        (!this.teVerbergenProperties.includes(veldnaam) || this.isGeenLocatieVeld(veldnaam))
    );
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  dateEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  linkEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        isBasisVeld(this.veldbeschrijvingen, veldnaam) && this.isLinkVeld(veldnaam) && !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  heeftGeavanceerdeEigenschappen(): boolean {
    return this.geavanceerdeEigenschappen().length > 0;
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        !isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.isLinkVeld(veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isBooleanVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeDateEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) &&
        isDateVeld(this.veldbeschrijvingen, veldnaam) &&
        !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  geavanceerdeLinkEigenschappen(): string[] {
    return this.eigenschappen(
      veldnaam =>
        !isBasisVeld(this.veldbeschrijvingen, veldnaam) && this.isLinkVeld(veldnaam) && !this.teVerbergenProperties.includes(veldnaam)
    );
  }

  constante(veld: string): option.Option<string> {
    return (
      veldbeschrijving(veld, this.veldbeschrijvingen)
        .chain(veldInfo => option.fromNullable(veldInfo.constante))
        // vervang elke instantie van {id} in de waarde van 'constante' door de effectieve id :
        .map(waarde =>
          veldnamen(this.veldbeschrijvingen).reduce((result, eigenschap) => {
            const token = `{${eigenschap}}`;
            // vervang _alle_ tokens met de waarde uit het record
            return result.includes(token) ? result.split(token).join(`${nestedPropertyValue(eigenschap, this.properties)}`) : result;
          }, waarde)
        )
    );
  }

  parseFormat(veldnaam: string): option.Option<string> {
    return veldbeschrijving(veldnaam, this.veldbeschrijvingen).chain(veldInfo => option.fromNullable(veldInfo.parseFormat));
  }

  displayFormat(veldnaam: string): option.Option<string> {
    return veldbeschrijving(veldnaam, this.veldbeschrijvingen).chain(veldInfo =>
      option.fromNullable(veldInfo.displayFormat).orElse(() => option.fromNullable(veldInfo.parseFormat))
    );
  }

  isLocatieVeld(veldnaam: string): boolean {
    return !this.isGeenLocatieVeld(veldnaam);
  }

  isGeenLocatieVeld(veldnaam: string): boolean {
    return veldbeschrijving(veldnaam, this.veldbeschrijvingen)
      .chain(veldInfo => option.fromNullable(veldInfo.isGeenLocatieVeld))
      .getOrElse(false);
  }

  waarde(veldnaam: string): string | number {
    // indien er een 'constante' object in de definitie is, geef dat terug, anders geef de waarde in het veld terug
    return this.constante(veldnaam).getOrElseL(() => {
      const waarde = nestedPropertyValue(veldnaam, this.properties);
      if (this.hasHtml(veldnaam) && waarde && this.veldtype(veldnaam) !== "url") {
        return this.sanitizer.bypassSecurityTrustHtml(formateerJson(veldnaam, this.veldtype(veldnaam), waarde, this.html(veldnaam)));
      } else if (this.hasTemplate(veldnaam) && waarde) {
        return formateerJson(veldnaam, this.veldtype(veldnaam), waarde, this.template(veldnaam));
      } else {
        return waarde;
      }
    });
  }

  private maybeDateWaarde(veldnaam: string): option.Option<string> {
    return this.constante(veldnaam).orElse(() => {
      const waarde = nestedPropertyValue(veldnaam, this.properties);
      return option
        .fromNullable(waarde)
        .chain(parseDate(this.parseFormat(veldnaam)))
        .map(formateerDate(this.displayFormat(veldnaam)));
    });
  }

  dateWaarde(veldnaam: string): string {
    return this.maybeDateWaarde(veldnaam).getOrElse("");
  }

  validDateWaarde(veldnaam: string): boolean {
    return this.maybeDateWaarde(veldnaam).isSome();
  }

  private maybeDateTimeWaarde(veldnaam: string): option.Option<string> {
    return this.constante(veldnaam).orElse(() => {
      const waarde = nestedPropertyValue(veldnaam, this.properties);
      return option
        .fromNullable(waarde)
        .chain(parseDateTime(this.parseFormat(veldnaam)))
        .map(formateerDateTime(this.displayFormat(veldnaam)));
    });
  }

  dateTimeWaarde(veldnaam: string): string {
    return this.maybeDateTimeWaarde(veldnaam).getOrElse("");
  }

  validDateTimeWaarde(veldnaam: string): boolean {
    return this.maybeDateTimeWaarde(veldnaam).isSome();
  }

  verpl(): string {
    return option
      .fromNullable(this.waarde("verpl"))
      .map(this.signed)
      .getOrElse("");
  }

  private pos(positieVeld: string): option.Option<string> {
    return option
      .fromNullable(this.waarde(positieVeld))
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

  private eigenschappen(filter: Predicate<string>): string[] {
    return veldnamen(this.veldbeschrijvingen)
      .filter(veldNaam => filter(veldNaam))
      .filter(veldNaam => hasValue(nestedPropertyValue(veldNaam, this.properties)) || this.constante(veldNaam).isSome())
      .filter(veldNaam => nestedPropertyValue(veldNaam, this.properties) !== "");
  }

  private isLinkVeld(veld: string): boolean {
    return (
      option
        .fromNullable(this.waarde(veld)) // indien waarde van veld begint met http
        .filter(waarde => typeof waarde === "string")
        .exists(waarde => `${waarde}`.startsWith("http")) ||
      veldbeschrijving(veld, this.veldbeschrijvingen) // indien 'constante' veld start met http
        .chain(veldInfo => option.fromNullable(veldInfo.constante)) //
        .exists(constante => constante.startsWith("http")) ||
      this.veldtype(veld) === "url"
    );
  }

  private hasTemplate(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => option.fromNullable(veldInfo.template))
      .isSome();
  }

  private hasHtml(veld: string): boolean {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => option.fromNullable(veldInfo.html))
      .isSome();
  }

  private template(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => option.fromNullable(veldInfo.template))
      .getOrElse("");
  }

  private html(veld: string): string {
    return veldbeschrijving(veld, this.veldbeschrijvingen)
      .chain(veldInfo => option.fromNullable(veldInfo.html))
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
