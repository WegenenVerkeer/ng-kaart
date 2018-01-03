import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";
import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-knop-zoom-slider",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopZoomSliderComponent {
  constructor() {
    throw new Error("nog niet geïmplementeerd");
  }
}
