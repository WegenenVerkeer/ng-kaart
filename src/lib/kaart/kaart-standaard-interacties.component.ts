import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";

import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private interactions: ol.interaction.Interaction[];

  constructor(private readonly kaart: KaartComponent, zone: NgZone) {
    super(zone);
    console.log("KSIC", kaart);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.interactions = this.kaart.voegInteractionsToe(ol.interaction.defaults().getArray());
  }

  ngOnDestroy(): void {
    this.kaart.verwijderInteractions(ol.interaction.defaults().getArray());
    super.ngOnDestroy();
  }
}
