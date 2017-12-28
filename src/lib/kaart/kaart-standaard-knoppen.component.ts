import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";

import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-standaard-knoppen",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardKnoppenComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private controls: ol.control.Control[];

  constructor(private readonly kaart: KaartComponent, zone: NgZone) {
    super(zone);
    throw new Error("nog niet geïmplementeerd");
  }
}
