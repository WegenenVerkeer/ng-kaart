import { Component, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";

@Component({
  selector: "awv-kaart-teken-polygoon-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenPolygoonLaagComponent extends KaartVectorLaagComponent {
  constructor(kaart: KaartClassicComponent) {
    super(kaart);
    throw new Error("Nog niet geïmplementeerd");
  }
}
