import { Component, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KaartComponent } from "./kaart.component";
import { KaartConfig } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

@Component({
  selector: "awv-kaart-wdb-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWdbLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.Laag {
    return new ke.WmsLaag(this.titel, this.laagNaam, this.extent, List(this.config.wdb.urls), this.versie);
  }
}
