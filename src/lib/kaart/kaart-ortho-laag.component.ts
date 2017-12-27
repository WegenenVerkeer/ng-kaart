import { Component, ViewEncapsulation } from "@angular/core";
import { List } from "immutable";

import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartConfig } from "./kaart.config";
import { KaartWmsLaagComponent } from "./kaart-wms-laag.component";
import { KaartEventDispatcher } from "./kaart-event-dispatcher";

@Component({
  selector: "awv-kaart-ortho-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartOrthoLaagComponent extends KaartWmsLaagComponent {
  constructor(kaart: KaartClassicComponent, private readonly config: KaartConfig) {
    super(kaart);
  }

  createLayer(): ke.Laag {
    console.log("ortho laag wordt gemaakt");
    return new ke.WmsLaag(this.titel, this.config.orthofotomozaiek.naam, this.extent, List(this.config.orthofotomozaiek.urls), this.versie);
  }
}
