import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";
import { KaartClassicComponent } from "./kaart-classic.component";

@Component({
  selector: "awv-kaart-teken-polygoon-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenPolygoonLaagComponent extends KaartVectorLaagComponent {
  @Output() polygonGetekend = new EventEmitter<ol.Feature>();

  interactie: ol.interaction.Interaction;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
    throw new Error("Nog niet geïmplementeerd");
  }
}
