import { Component, Input, ViewEncapsulation } from "@angular/core";

import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";
import { BlancoLaag, BlancoType } from "./kaart-elementen";
import { Laaggroep } from "./kaart-elementen";

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
      backgroundUrl: blancoLaag
    };
  }

  laaggroep(): Laaggroep {
    return "Achtergrond";
  }
}
