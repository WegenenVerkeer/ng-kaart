import {Component, NgZone, OnDestroy, OnInit} from "@angular/core";

import * as ol from "openlayers";
import {KaartComponent} from "./kaart.component";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent implements OnInit, OnDestroy {
  scaleLine: ol.control.ScaleLine;

  constructor(protected kaart: KaartComponent, protected zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.scaleLine = new ol.control.ScaleLine();
      this.kaart.map.addControl(this.scaleLine);
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.kaart.map.removeControl(this.scaleLine);
    });
  }
}
