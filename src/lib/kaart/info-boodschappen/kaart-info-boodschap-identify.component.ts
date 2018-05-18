import { Component, Input, NgZone } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as ol from "openlayers";

import { orElse } from "../../util/option";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { VectorLaag, VeldInfo } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";

import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

// Nosql feature parsing

const PROPERTIES = "properties";
const GEOMETRY = "geometry";
const IDENT8 = "ident8";
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

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html",
  styleUrls: ["./kaart-info-boodschap-identify.component.scss"]
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildComponentBase {
  @Input() feature: ol.Feature;
  @Input() laag: Option<VectorLaag>;

  private _alleVeldenZichtbaar = false;

  teVerbergenProperties = List.of(
    IDENT8,
    LOCATIE_IDENT8,
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
    return this.lengte().fold(
      () => this.breedte().fold(() => "Geen dimensies", breedte => `${breedte}cm`),
      lengte => this.breedte().fold(() => `${lengte}m`, breedte => `${lengte}m x ${breedte}cm`)
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
          .getOrElseValue("");
    }
  }

  heeftVanTot(): boolean {
    return geldigeWaarde(this.waarde(BEGIN_POSITIE)) && geldigeWaarde(this.waarde(EIND_POSITIE));
  }

  heeftIdent8(): boolean {
    return this.heeft(IDENT8) || this.heeft(LOCATIE_IDENT8);
  }

  ident8() {
    return orElse(fromNullable(this.waarde(IDENT8)), () => fromNullable(this.waarde(LOCATIE_IDENT8))).getOrElseValue("");
  }

  van(): string {
    return this.pos(BEGIN_POSITIE);
  }

  tot(): string {
    return this.pos(EIND_POSITIE);
  }

  private afstand(afstandVeld: string): string {
    return fromNullable(this.waarde(afstandVeld))
      .map(this.signed)
      .fold(() => "", pos => pos);
  }

  vanAfstand(): string {
    return this.afstand(BEGIN_POSITIE);
  }

  totAfstand(): string {
    return this.afstand(EIND_POSITIE);
  }

  label(veld: string): string {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.label)
      .getOrElseValue(veld);
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBoolean(key) && this.isBasisVeld(key) && !this.teVerbergenProperties.contains(key));
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBoolean(key) && this.isBasisVeld(key) && !this.teVerbergenProperties.contains(key));
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBoolean(key) && !this.isBasisVeld(key) && !this.teVerbergenProperties.contains(key));
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBoolean(key) && !this.isBasisVeld(key) && !this.teVerbergenProperties.contains(key));
  }

  waarde(name: string): Object {
    const waarde = nestedProperty(name, this.properties());
    if (this.isDatum(name)) {
      return this.formateerDatum(waarde.toString());
    } else {
      return waarde;
    }
  }

  private verpl(): string {
    return fromNullable(this.waarde("verpl"))
      .map(this.signed)
      .fold(() => "", pos => pos);
  }

  private pos(positieVeld: string): string {
    return fromNullable(this.waarde(positieVeld))
      .filter(positie => typeof positie === "number")
      .map(positie => `${Math.round((positie as number) * 10) / 10}`)
      .fold(() => "", pos => pos);
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
      .getOrElseValue(OrderedMap<string, VeldInfo>())
      .filter((value, key) => filter(key))
      .filter((value, key) => geldigeWaarde(nestedProperty(key!, this.properties())))
      .filter((value, key) => nestedProperty(key!, this.properties()) !== "")
      .keySeq()
      .toArray();
  }

  private isBasisVeld(veld: string): boolean {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.isBasisVeld)
      .getOrElseValue(false); // indien geen meta informatie functie, toon alle velden
  }

  private isType(veld: string, type: string): boolean {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.type === type)
      .getOrElseValue(false);
  }

  private isBoolean(veld: string): boolean {
    return this.isType(veld, "boolean");
  }

  private isDatum(veld: string): boolean {
    return this.isType(veld, "date");
  }

  private formateerDatum(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString("nl-BE");
    } catch (e) {
      return dateString;
    }
  }
}
