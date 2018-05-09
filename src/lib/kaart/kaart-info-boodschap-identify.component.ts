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

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  lengte(): Option<number> {
    return fromNullable(this.waarde("locatie")["lengte"]).map(Math.round);
  }

  breedte(): Option<string> {
    return fromNullable(this.waarde("breedte"));
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
        return this.waarde("zijderijbaan");
    }
  }

  van(): string {
    return fromNullable(this.waarde("locatie"))
      .chain(loc => fromNullable(loc["begin"]))
      .map(beginLocatie => `${Math.round(beginLocatie["positie"] * 10) / 10}`)
      .fold(() => "", pos => pos);
  }

  vanAfstand(): string {
    return fromNullable(this.waarde("locatie"))
      .chain(loc => fromNullable(loc["begin"]))
      .map(beginLocatie => beginLocatie["afstand"])
      .map(afstand => {
        if (afstand >= 0) {
          return `+${afstand}`;
        } else {
          return `${afstand}`;
        }
      })
      .fold(() => "", pos => pos);
  }

  tot(): string {
    return fromNullable(this.waarde("locatie"))
      .chain(loc => fromNullable(loc["eind"]))
      .map(eindLocatie => `${Math.round(eindLocatie["positie"] * 10) / 10}`)
      .fold(() => "", pos => pos);
  }

  totAfstand(): string {
    return fromNullable(this.waarde("locatie"))
      .chain(loc => fromNullable(loc["eind"]))
      .map(beginLocatie => beginLocatie["afstand"])
      .map(afstand => {
        if (afstand >= 0) {
          return `+${afstand}`;
        } else {
          return `${afstand}`;
        }
      })
      .fold(() => "", pos => pos);
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

  booleanEigenschappen(): string[] {
    return this.zichtbareEigenschappen(true);
  }

  zichtbareEigenschappen(onlyBooleans = false): string[] {
    const teVerbergenProperties = List.of("geometry", "locatie", "ident8", "afstandrijbaan", "zijderijbaan", "breedte");

    const properties: Object = this.feature.getProperties()["properties"];

    return Object.keys(properties).filter(
      key =>
        properties[key] !== undefined &&
        properties[key] !== null &&
        properties[key] !== "" &&
        !teVerbergenProperties.contains(key) &&
        this.isBoolean(key) === onlyBooleans
    );
  }

  waarde(name: string): string {
    return this.feature.getProperties()["properties"][name];
  }
}
