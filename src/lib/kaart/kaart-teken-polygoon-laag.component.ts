import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";
import { KaartVectorLaagComponent } from "./kaart-vector-laag.component";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-teken-polygoon-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartTekenPolygoonLaagComponent extends KaartVectorLaagComponent implements OnInit, OnDestroy {
  @Output() polygonGetekend = new EventEmitter<ol.Feature>();

  interactie: ol.interaction.Interaction;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);

    this.source = new ol.source.Vector({ wrapX: false });
    this.titel = "Poly";
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.zone.runOutsideAngular(() => {
      this.interactie = this.kaart.voegInteractionToe(this.maakTekenPolygoonInteractie());
      this.vectorLaag.setZIndex(100);
    });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.zone.runOutsideAngular(() => {
      this.kaart.verwijderInteraction(this.interactie);
    });
  }

  maakTekenPolygoonInteractie(): ol.interaction.Draw {
    const interactie = new ol.interaction.Draw({
      source: this.source,
      type: "Polygon"
    });

    interactie.on("drawend", (drawevent: any) => {
      this.zone.run(() => {
        this.polygonGetekend.emit(drawevent.feature);
      });
    });

    return interactie;
  }
}
