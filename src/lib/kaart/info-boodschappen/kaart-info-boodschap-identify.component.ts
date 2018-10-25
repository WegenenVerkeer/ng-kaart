import { HttpClient } from "@angular/common/http";
import { Component, Input, NgZone } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as Mustache from "mustache";
import * as ol from "openlayers";

import { orElse } from "../../util/option";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { VectorLaag, VeldInfo } from "../kaart-elementen";
import { InfoBoodschapIdentify } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

const PROPERTIES = "properties";
const GEOMETRY = "geometry";
const IDENT8 = "ident8";
const IDENT8EN = "ident8en";
const LOCATIE_IDENT8 = "locatie.ident8";
const BEGIN_POSITIE = "locatie.begin.positie";
const BEGIN_AFSTAND = "locatie.begin.afstand";
const BEGIN_OPSCHRIFT = "locatie.begin.opschrift";
const EIND_POSITIE = "locatie.eind.positie";
const EIND_AFSTAND = "locatie.eind.afstand";
const EIND_OPSCHRIFT = "locatie.eind.opschrift";
const LENGTE = "lengte";
const LOCATIE_GEOMETRY_LENGTE = "locatie.geometry.lengte";
const LOCATIE_LENGTE = "locatie.lengte";
const ZIJDERIJBAAN = "zijderijbaan";
const AFSTANDRIJBAAN = "afstandrijbaan";
const BREEDTE = "breedte";
const HM = "hm";
const VERPL = "verpl";

const geldigeWaarde = value => value !== undefined && value !== null;

const nestedProperty = (propertyKey: string, object: Object) =>
  geldigeWaarde(propertyKey)
    ? propertyKey.split(".").reduce((obj, key) => (geldigeWaarde(obj) && geldigeWaarde(obj[key]) ? obj[key] : null), object)
    : null;

const formateerJson = (veld: string, json: string, formatString: string): string => {
  const jsonObject = JSON.parse(`{"${veld}": ${json}}`);
  return Mustache.render(formatString, jsonObject);
};

const formateerDatum = (dateString: string): string => {
  const timestamp = Date.parse(dateString);

  if (!isNaN(timestamp)) {
    // geldige datum
    return new Date(dateString).toLocaleDateString("nl-BE");
  } else {
    return dateString; // date string niet herkend, geef input terug
  }
};

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html",
  styleUrls: ["./kaart-info-boodschap-identify.component.scss"]
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildComponentBase {
  feature: ol.Feature;
  laag: Option<VectorLaag>;

  @Input()
  set boodschap(bsch: InfoBoodschapIdentify) {
    this.feature = bsch.feature;
    this.laag = bsch.laag;
  }

  private _alleVeldenZichtbaar = false;

  teVerbergenProperties = List.of(
    IDENT8,
    LOCATIE_IDENT8,
    IDENT8EN,
    GEOMETRY,
    BEGIN_POSITIE,
    BEGIN_AFSTAND,
    BEGIN_OPSCHRIFT,
    EIND_POSITIE,
    EIND_AFSTAND,
    EIND_OPSCHRIFT,
    LENGTE,
    LOCATIE_GEOMETRY_LENGTE,
    LOCATIE_LENGTE,
    AFSTANDRIJBAAN,
    ZIJDERIJBAAN,
    BREEDTE,
    HM,
    VERPL
  );

  private properties = () => this.feature.getProperties()[PROPERTIES];

  constructor(parent: KaartComponent, zone: NgZone, private kaartInfoBoodschapComponent: KaartInfoBoodschapComponent) {
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
    return orElse(
      orElse(fromNullable(this.waarde(LOCATIE_LENGTE)).map(Math.round), () => fromNullable(this.waarde(LENGTE)).map(Math.round)),
      () => fromNullable(this.waarde(LOCATIE_GEOMETRY_LENGTE)).map(Math.round)
    );
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
    return geldigeWaarde(this.waarde(BEGIN_OPSCHRIFT)) && geldigeWaarde(this.waarde(EIND_OPSCHRIFT));
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
      return orElse(fromNullable(this.waarde(IDENT8)), () => fromNullable(this.waarde(LOCATIE_IDENT8))).getOrElse("");
    }
  }

  van(): string {
    return this.pos(BEGIN_OPSCHRIFT).getOrElse("");
  }

  tot(): string {
    return this.pos(EIND_OPSCHRIFT).getOrElse("");
  }

  private afstand(afstandVeld: string): string {
    return fromNullable(this.waarde(afstandVeld))
      .map(this.signed)
      .getOrElse("");
  }

  vanAfstand(): string {
    return this.afstand(BEGIN_AFSTAND);
  }

  totAfstand(): string {
    return this.afstand(EIND_AFSTAND);
  }

  label(veld: string): string {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.label)
      .getOrElse(veld);
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(
      key => this.isBasisVeld(key) && !this.isLink(key) && !this.isBoolean(key) && !this.teVerbergenProperties.contains(key)
    );
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBasisVeld(key) && this.isBoolean(key) && !this.teVerbergenProperties.contains(key));
  }

  linkEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBasisVeld(key) && this.isLink(key) && !this.teVerbergenProperties.contains(key));
  }

  heeftGeavanceerdeEigenschappen(): boolean {
    return this.eigenschappen(key => !this.isBasisVeld(key) && !this.teVerbergenProperties.contains(key)).length > 0;
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(
      key => !this.isBasisVeld(key) && !this.isBoolean(key) && !this.isLink(key) && !this.teVerbergenProperties.contains(key)
    );
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBasisVeld(key) && this.isBoolean(key) && !this.teVerbergenProperties.contains(key));
  }

  geavanceerdeLinkEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBasisVeld(key) && this.isLink(key) && !this.teVerbergenProperties.contains(key));
  }

  constante(veld: string): Option<string> {
    return (
      this.laag
        .chain(l => fromNullable(l.velden.get(veld)))
        .chain(veldInfo => fromNullable(veldInfo.constante))
        // vervang elke instantie van {id} in de waarde van 'constante' door de effectieve id :
        .map(waarde =>
          this.laag
            .map(l => l.velden)
            .getOrElse(OrderedMap<string, VeldInfo>())
            .keySeq()
            .toArray()
            .reduce((result, eigenschap) => {
              const token = `{${eigenschap}}`;
              // vervang _alle_ tokens met de waarde uit het record
              return result.includes(token) ? result.split(token).join(`${this.waarde(eigenschap)}`) : result;
            }, waarde)
        )
    );
  }

  waarde(name: string): Object {
    // indien er een 'constante' object in de definitie is, geef dat terug, anders geeft de waarde in het veld terug
    return this.constante(name).getOrElseL(() => {
      const waarde = nestedProperty(name, this.properties());
      if (this.isDatum(name) && waarde) {
        return formateerDatum(waarde.toString());
      } else if (this.isJson(name) && waarde) {
        return formateerJson(name, waarde, this.template(name));
      } else {
        return waarde;
      }
    });
  }

  private verpl(): string {
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
    return this.laag
      .map(l => l.velden)
      .getOrElse(OrderedMap<string, VeldInfo>())
      .filter((veldInfo, veldNaam) => filter(veldNaam))
      .filter((veldInfo, veldNaam) => geldigeWaarde(nestedProperty(veldNaam!, this.properties())) || this.constante(veldNaam!).isSome())
      .filter((veldInfo, veldNaam) => nestedProperty(veldNaam!, this.properties()) !== "")
      .keySeq()
      .toArray();
  }

  private isLink(veld: string): boolean {
    return (
      fromNullable(this.waarde(veld)) // indien waarde van veld begint met http
        .filter(waarde => typeof waarde === "string")
        .exists(waarde => `${waarde}`.startsWith("http")) ||
      this.laag // indien 'constante' veld start met http
        .chain(l => fromNullable(l.velden.get(veld))) //
        .chain(veldInfo => fromNullable(veldInfo.constante)) //
        .exists(constante => constante.startsWith("http"))
    );
  }

  private isBasisVeld(veld: string): boolean {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld))) //
      .exists(veldInfo => veldInfo.isBasisVeld); // indien geen meta informatie functie, toon alle velden
  }

  private isType(veld: string, type: string): boolean {
    return this.laag.chain(l => fromNullable(l.velden.get(veld))).exists(veldInfo => veldInfo.type === type);
  }

  private isBoolean(veld: string): boolean {
    return this.isType(veld, "boolean");
  }

  private isDatum(veld: string): boolean {
    return this.isType(veld, "date");
  }

  private isJson(veld: string): boolean {
    return this.isType(veld, "json");
  }

  private template(veld: string): string {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .chain(veldInfo => fromNullable(veldInfo.template))
      .getOrElse("");
  }

  heeftMaakAbbameldaMelding(): boolean {
    return this.laag.chain(l => fromNullable(l.velden.get("meldingInAbbamelda"))).isSome();
  }
}
