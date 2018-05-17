import { Component, Input, NgZone } from "@angular/core";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { VectorLaag } from "../kaart-elementen";
import { KaartComponent } from "../kaart.component";

import { KaartInfoBoodschapComponent } from "./kaart-info-boodschap.component";

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
    "geometry",
    "locatie",
    "ident8",
    "afstandrijbaan",
    "zijderijbaan",
    "breedte",
    "hm",
    "verpl",
    "geometry_wkt"
  );

  properties = () => this.feature.getProperties()["properties"];

  heeftWaarde = value => value !== undefined && value !== null;

  constructor(parent: KaartComponent, zone: NgZone, private kaartInfoBoodschapComponent: KaartInfoBoodschapComponent) {
    super(parent, zone);
  }

  alleVeldenZichtbaar() {
    return this._alleVeldenZichtbaar;
  }

  setAlleVeldenZichtbaar(zichtbaar: boolean) {
    this._alleVeldenZichtbaar = zichtbaar;
    this.kaartInfoBoodschapComponent.scrollIntoView();
  }

  heeft(key: string) {
    return this.heeftWaarde(this.waarde(key));
  }

  lengte(): Option<number> {
    return fromNullable(this.waarde("locatie.lengte")).map(Math.round);
  }

  breedte(): Option<string> {
    return fromNullable(this.waarde("breedte")).map(b => b.toString());
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
    switch (this.waarde("zijderijbaan")) {
      case "R":
        return "Rechts";
      case "L":
        return "Links";
      case "M":
        return "Midden";
      case "O":
        return "Op";
      default:
        return fromNullable(this.waarde("zijderijbaan"))
          .map(b => b.toString())
          .getOrElseValue("");
    }
  }

  heeftVanTot(): boolean {
    return this.heeftWaarde(this.waarde("locatie.begin.positie")) && this.heeftWaarde(this.waarde("locatie.eind.positie"));
  }

  private verpl(): string {
    return fromNullable(this.waarde("verpl"))
      .map(this.signed)
      .fold(() => "", pos => pos);
  }

  private pos(beginOfEind: string): string {
    return fromNullable(this.waarde(`locatie.${beginOfEind}.positie`))
      .filter(positie => typeof positie === "number")
      .map(positie => `${Math.round((positie as number) * 10) / 10}`)
      .fold(() => "", pos => pos);
  }

  signed(value: number): string {
    if (value >= 0) {
      return `+${value}`;
    } else {
      return `${value}`;
    }
  }

  van(): string {
    return this.pos("begin");
  }

  tot(): string {
    return this.pos("eind");
  }

  private afstand(beginOfEind: string): string {
    return fromNullable(this.waarde(`locatie.${beginOfEind}.afstand`))
      .map(this.signed)
      .fold(() => "", pos => pos);
  }

  vanAfstand(): string {
    return this.afstand("begin");
  }

  totAfstand(): string {
    return this.afstand("eind");
  }

  isBoolean(veld: string): boolean {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.type === "boolean")
      .getOrElseValue(false);
  }

  label(veld: string): string {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.label)
      .getOrElseValue(veld);
  }

  isBasisVeld(veld: string): boolean {
    return this.laag
      .chain(l => fromNullable(l.velden.get(veld)))
      .map(veldInfo => veldInfo.isBasisVeld)
      .getOrElseValue(false); // indien geen meta informatie functie, toon alle velden
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBoolean(key) && this.isBasisVeld(key));
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBoolean(key) && this.isBasisVeld(key));
  }

  geavanceerdeEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBoolean(key) && !this.isBasisVeld(key));
  }

  geavanceerdeBooleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBoolean(key) && !this.isBasisVeld(key));
  }

  waarde(name: string): Object {
    return this.nestedProperty(name, this.properties());
  }

  private eigenschappen(filter: (string) => boolean): string[] {
    return Object.keys(this.properties()).filter(
      key =>
        this.heeftWaarde(this.nestedProperty(key, this.properties())) &&
        this.properties()[key] !== "" &&
        !this.teVerbergenProperties.contains(key) &&
        filter(key)
    );
  }

  private nestedProperty(propertyKey: string, object: Object): Object {
    return this.heeftWaarde(propertyKey)
      ? propertyKey.split(".").reduce((obj, key) => (this.heeftWaarde(obj) && this.heeftWaarde(obj[key]) ? obj[key] : null), object)
      : null;
  }
}
