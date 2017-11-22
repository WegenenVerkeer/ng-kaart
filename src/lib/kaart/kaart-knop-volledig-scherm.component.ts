import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from "@angular/core";
import {KaartComponent} from "./kaart.component";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-knop-volledig-scherm",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-knop-volledig-scherm.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopVolledigSchermComponent implements OnInit, OnDestroy {
  fullScreen: ol.control.FullScreen;

  constructor(protected kaart: KaartComponent, private zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.fullScreen = new ol.control.FullScreen({
        className: "full-screen-control-left",
        source: this.kaart.mapElement.nativeElement.parentElement
      });
      this.kaart.map.addControl(this.fullScreen);
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.kaart.map.removeControl(this.fullScreen);
    });
  }
}
