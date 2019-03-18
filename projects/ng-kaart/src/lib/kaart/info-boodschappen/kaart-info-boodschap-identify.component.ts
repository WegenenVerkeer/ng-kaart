import { Component, Input, NgZone } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import { KaartChildComponentBase } from "../kaart-child-component-base";
import { InfoBoodschapIdentify } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import { Properties, VeldinfoMap } from "./kaart-info-boodschap-veldinfo.component";

const PROPERTIES = "properties";

@Component({
  selector: "awv-kaart-info-boodschap-identify",
  templateUrl: "./kaart-info-boodschap-identify.component.html"
})
export class KaartInfoBoodschapIdentifyComponent extends KaartChildComponentBase {
  properties: Properties;
  veldbeschrijvingen: VeldinfoMap = new Map();

  @Input()
  set boodschap(bsch: InfoBoodschapIdentify) {
    this.properties = fromNullable(bsch.feature.getProperties())
      .chain(props => fromNullable(props[PROPERTIES]))
      .getOrElse({});
    this.veldbeschrijvingen = bsch.laag.map(vectorlaag => vectorlaag.velden).getOrElse(new Map());
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
