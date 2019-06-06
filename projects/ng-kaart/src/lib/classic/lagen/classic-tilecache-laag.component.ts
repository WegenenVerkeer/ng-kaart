import { HttpClient } from "@angular/common/http";
import { Component, Inject, Injector, ViewEncapsulation } from "@angular/core";
import { fromNullable, none } from "fp-ts/lib/Option";

import { KAART_CFG, KaartConfig } from "../../kaart/kaart-config";
import * as ke from "../../kaart/kaart-elementen";

import * as arrays from "../../util/arrays";

import { ClassicWmsLaagComponent } from "./classic-wms-laag.component";

@Component({
  selector: "awv-kaart-tilecache-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicTilecacheLaagComponent extends ClassicWmsLaagComponent {
  constructor(injector: Injector, @Inject(KAART_CFG) private readonly config: KaartConfig, http: HttpClient) {
    super(injector, http);
  }

  createLayer(): ke.WmsLaag {
    const urls = arrays.isArray(this._urls) && arrays.isNonEmpty(this._urls) ? this._urls : this.config.tilecache.urls;
    return {
      type: ke.TiledWmsType,
      titel: this._titel,
      naam: this._laagNaam,
      urls: urls,
      versie: fromNullable(this.versie),
      cqlFilter: this._cqlFilter,
      tileSize: fromNullable(this._tileSize),
      format: fromNullable(this.format),
      opacity: this._opacity,
      backgroundUrl: this.backgroundUrl(urls, this._laagNaam),
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      verwijderd: false,
      beschikbareProjecties: this._beschikbareProjecties
    };
  }
}
