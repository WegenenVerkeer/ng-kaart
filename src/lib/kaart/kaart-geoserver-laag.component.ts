import { Component, Inject, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KAART_CFG, KaartConfig } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

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
      type: ke.WmsType,
      titel: this.titel,
      naam: this.laagNaam,
      extent: this.extent,
      urls: List(this.config.geoserver.urls),
      versie: this.versie
    };
  }
}
