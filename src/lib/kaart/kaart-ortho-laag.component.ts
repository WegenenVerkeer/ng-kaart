import { Component, ViewEncapsulation, Inject } from "@angular/core";
import { List } from "immutable";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartConfig, KAART_CFG } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { WmsLaag, TiledWmsType } from "./kaart-elementen";
import { fromNullable } from "fp-ts/lib/Option";

@Component({
  selector: "awv-kaart-ortho-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartOrthoLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): WmsLaag {
    return {
      type: TiledWmsType,
      titel: this.titel,
      naam: this.config.orthofotomozaiek.naam,
      urls: List(this.config.orthofotomozaiek.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format)
    };
  }
}
