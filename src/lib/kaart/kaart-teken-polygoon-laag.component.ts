import { Component, ViewEncapsulation } from "@angular/core";

import { ClassicVectorLaagComponent } from "../classic/lagen/classic-vector-laag.component";

import { KaartClassicComponent } from "../classic/kaart-classic.component";

@Component({
  selector: "awv-kaart-teken-polygoon-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenPolygoonLaagComponent extends ClassicVectorLaagComponent {
  constructor(kaart: KaartClassicComponent) {
    super(kaart);
    throw new Error("Nog niet geïmplementeerd");
  }
}
