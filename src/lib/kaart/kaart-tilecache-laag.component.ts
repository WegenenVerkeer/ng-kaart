import { Component, Inject, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import * as ke from "./kaart-elementen";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";

@Component({
  selector: "awv-kaart-tilecache-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartTilecacheLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, @Inject(KAART_CFG) private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.WmsLaag {
    return {
      type: ke.TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.config.tilecache.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(List(this.config.tilecache.urls), this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }
}
