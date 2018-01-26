import { Component, Inject, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KAART_CFG, KaartConfig } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

// TODO uitvissen waarom die speficieke URL zo belangrijk is.
@Component({
  selector: "awv-kaart-wdb-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWdbLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.ElementType.WMSLAAG,
      titel: this.titel,
      dekkend: true,
      naam: this.laagNaam,
      extent: this.extent,
      urls: List(this.config.wdb.urls),
      versie: this.versie
    };
  }
}
