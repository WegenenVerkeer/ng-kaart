import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";

import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

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
