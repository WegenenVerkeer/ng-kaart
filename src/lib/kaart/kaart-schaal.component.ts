import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";

import * as ol from "openlayers";
import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private scaleLine: ol.control.Control;

  constructor(private readonly kaart: KaartComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.scaleLine = this.kaart.voegControlToe(new ol.control.ScaleLine());
  }

  ngOnDestroy(): void {
    this.kaart.verwijderControl(this.scaleLine);
    super.ngOnDestroy();
  }
}
