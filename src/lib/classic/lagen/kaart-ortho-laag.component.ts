import { Component, Inject, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { KAART_CFG, KaartConfig } from "../../kaart/kaart-config";
import { TiledWmsType, WmsLaag } from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";

import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";

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
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(List(this.config.orthofotomozaiek.urls), this.config.orthofotomozaiek.naam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }
}
