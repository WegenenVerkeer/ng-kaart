import { Component, Inject, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { KAART_CFG, KaartConfig } from "../../kaart/kaart-config";
import * as ke from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";

import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";

@Component({
  selector: "awv-kaart-geoserver-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartGeoserverLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.config.geoserver.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(List(this.config.geoserver.urls), this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Laag";
  }
}
