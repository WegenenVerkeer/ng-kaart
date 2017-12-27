import { Component, DoCheck, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-toon-features",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartToonFeaturesComponent extends KaartVectorLaagComponent {
  @Input() features = new ol.Collection<ol.Feature>();
  @Output() featureGeselecteerd: EventEmitter<ol.Feature> = new EventEmitter<ol.Feature>();

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
    throw new Error("Nog niet geïmplementeerd");
  }
}
