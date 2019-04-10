import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";

import { BlancoLaag, BlancoType, Laaggroep } from "../../kaart/kaart-elementen";

import { ClassicLaagComponent } from "./classic-laag.component";

export const blancoLaag = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
/**
 * Zorgt voor een blancoachtergrondlaag. Uiteraard pas interessant als er ook andere achtergrondlagen zijn.
 */
@Component({
  selector: "awv-kaart-blanco-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicBlancoLaagComponent extends ClassicLaagComponent {
  _titel = "Blanco";

  constructor(injector: Injector) {
    super(injector);
  }

  createLayer(): BlancoLaag {
    return {
      type: BlancoType,
      titel: this._titel,
      backgroundUrl: blancoLaag,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): Laaggroep {
    return "Achtergrond";
  }
}
