import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from "@angular/core";

import * as ol from "openlayers";
import {KaartComponent} from "./kaart.component";

@Component({
  selector: "awv-kaart-knop-zoom-slider",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopZoomSliderComponent implements OnInit, OnDestroy {
  zoomSlider: ol.control.ZoomSlider;

  constructor(protected kaart: KaartComponent, private zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.zoomSlider = new ol.control.ZoomSlider();
      this.kaart.map.addControl(this.zoomSlider);
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.kaart.map.removeControl(this.zoomSlider);
    });
  }
}
