import { Component, Input, NgZone, OnInit } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";
import { List } from "immutable";
import * as ol from "openlayers";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { VectorLaag } from "./kaart-elementen";

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html",
  styleUrls: ["./kaart-info-boodschap-identify.component.scss"]
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildComponentBase implements OnInit {
  @Input() feature: ol.Feature;
  @Input() laag: Option<VectorLaag>;

  teVerbergenProperties = List.of("geometry", "locatie", "ident8", "afstandrijbaan", "zijderijbaan", "breedte", "hm", "verpl");

  properties = () => this.feature.getProperties()["properties"];

  heeftWaarde = value => value !== undefined && value !== null;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit(): void {
    super.ngOnInit();
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
    return this.lengte().isSome() && this.breedte().isSome();
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
        return this.waarde("zijderijbaan").toString();
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
      .chain(l => fromNullable(l.getType))
      .map(getType => getType(veld) === "boolean")
      .getOrElseValue(false);
  }

  label(veld: string): string {
    return this.laag
      .chain(l => fromNullable(l.getLabel))
      .map(getLabel => getLabel(veld))
      .getOrElseValue(veld);
  }

  zichtbareEigenschappen(): string[] {
    return this.eigenschappen(key => !this.isBoolean(key));
  }

  booleanEigenschappen(): string[] {
    return this.eigenschappen(key => this.isBoolean(key));
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
