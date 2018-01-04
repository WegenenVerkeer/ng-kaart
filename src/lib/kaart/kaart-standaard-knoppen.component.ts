import { Component, ViewEncapsulation } from "@angular/core";

import { KaartComponent } from "./kaart.component";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-standaard-knoppen",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardKnoppenComponent {
  private controls: ol.control.Control[];

  constructor(private readonly kaart: KaartComponent) {
    throw new Error("nog niet geïmplementeerd");
  }
}
