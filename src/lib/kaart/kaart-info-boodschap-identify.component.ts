import { Component, Input, NgZone, OnInit } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";
import { List } from "immutable";
import * as ol from "openlayers";
import { fromNullable, Option } from "fp-ts/lib/Option";

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html",
  styleUrls: ["./kaart-info-boodschap-identify.component.scss"]
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildComponentBase implements OnInit {
  @Input() feature: ol.Feature;

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
    return fromNullable(this.prop("locatie")["lengte"]).map(Math.round);
  }

  breedte(): Option<string> {
    return fromNullable(this.prop("breedte"));
  }

  dimensies(): string {
    return this.lengte().fold(
      () => this.breedte().fold(() => "Geen dimensies", breedte => `${breedte}cm`),
      lengte => this.breedte().fold(() => `${lengte}m`, breedte => `${lengte}m x ${breedte}cm`)
    );
  }

  zijderijbaan(): string {
    switch (this.prop("zijderijbaan")) {
      case "R":
        return "Rechts";
      case "L":
        return "Links";
      case "M":
        return "Midden";
      case "O":
        return "Op";
      default:
        return this.prop("zijderijbaan");
    }
  }

  van(): string {
    return fromNullable(this.prop("locatie"))
      .chain(loc => fromNullable(loc["begin"]))
      .map(beginLocatie => `${beginLocatie["positie"]}`)
      .fold(() => "", pos => pos);
  }

  vanAfstand(): string {
    return fromNullable(this.prop("locatie"))
      .chain(loc => fromNullable(loc["begin"]))
      .map(beginLocatie => beginLocatie["afstand"])
      .map(afstand => {
        if (afstand > 0) {
          return `+${afstand}`;
        } else {
          return `${afstand}`;
        }
      })
      .fold(() => "", pos => pos);
  }

  tot(): string {
    return fromNullable(this.prop("locatie"))
      .chain(loc => fromNullable(loc["eind"]))
      .map(beginLocatie => `${beginLocatie["positie"]}}`)
      .fold(() => "", pos => pos);
  }

  totAfstand(): string {
    return fromNullable(this.prop("locatie"))
      .chain(loc => fromNullable(loc["eind"]))
      .map(beginLocatie => beginLocatie["afstand"])
      .map(afstand => {
        if (afstand > 0) {
          return `+${afstand}`;
        } else {
          return `${afstand}`;
        }
      })
      .fold(() => "", pos => pos);
  }

  properties(): string[] {
    const teVerbergenProperties = List.of("geometry", "locatie");

    const properties: Object = this.feature.getProperties()["properties"];

    return Object.keys(properties).filter(key => properties[key] !== null && !teVerbergenProperties.contains(key));
  }

  prop(name: string): string {
    return this.feature.getProperties()["properties"][name];
  }
}
