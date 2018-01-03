import { Component, ViewEncapsulation, Inject } from "@angular/core";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartConfig, KAART_CFG } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartEventDispatcher } from "./kaart-event-dispatcher";

@Component({
  selector: "awv-kaart-ortho-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartOrthoLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.ElementType.WMSLAAG,
      titel: this.titel,
      naam: this.config.orthofotomozaiek.naam,
      extent: this.extent,
      urls: List(this.config.orthofotomozaiek.urls),
      versie: this.versie
    };
  }
}
