import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";
import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-knop-zoom-slider",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopZoomSliderComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private zoomSlider: ol.control.ZoomSlider;

  constructor(private readonly kaart: KaartComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.zoomSlider = this.kaart.voegControlToe(new ol.control.ZoomSlider());
  }

  ngOnDestroy(): void {
    this.kaart.verwijderControl(this.zoomSlider);
    super.ngOnDestroy();
  }
}
