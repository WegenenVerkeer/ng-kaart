import { Component, Inject, NgZone, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import { KAART_CFG, KaartConfig } from "../../kaart/kaart-config";
import * as ke from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";

import { ClassicWmsLaagComponent } from "./classic-wms-laag.component";

@Component({
  selector: "awv-kaart-geoserver-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicGeoserverLaagComponent extends ClassicWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig, zone: NgZone) {
    super(kaart, zone);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: this.config.geoserver.urls,
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(this.config.geoserver.urls, this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Laag";
  }
}
