import { Component, Input, ViewEncapsulation } from "@angular/core";

import { BlancoLaag, BlancoType, Laaggroep } from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";

import { KaartLaagComponent } from "./kaart-laag.component";

const blancoLaag = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

@Component({
  selector: "awv-kaart-blanco-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartBlancoLaagComponent extends KaartLaagComponent {
  @Input() titel = "Blanco";

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): BlancoLaag {
    return {
      type: BlancoType,
      titel: this.titel,
      backgroundUrl: blancoLaag,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): Laaggroep {
    return "Achtergrond";
  }
}
