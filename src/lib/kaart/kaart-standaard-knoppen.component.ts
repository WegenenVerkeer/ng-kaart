import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from "@angular/core";

import * as ol from "openlayers";
import {KaartComponent} from "./kaart.component";

@Component({
  selector: "awv-kaart-standaard-knoppen",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardKnoppenComponent implements OnInit, OnDestroy {
  defaults: ol.Collection<ol.control.Control>;

  constructor(protected kaart: KaartComponent, private zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.defaults = ol.control.defaults();
      this.defaults.forEach(control => this.kaart.map.addControl(control));
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.defaults.forEach(control => this.kaart.map.removeControl(control));
    });
  }
}
