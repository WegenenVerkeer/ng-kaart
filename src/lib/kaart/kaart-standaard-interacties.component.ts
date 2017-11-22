import {Component, NgZone, OnDestroy, OnInit, ViewEncapsulation} from "@angular/core";

import * as ol from "openlayers";
import {KaartComponent} from "./kaart.component";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  defaults: ol.Collection<ol.interaction.Interaction>;

  constructor(protected kaart: KaartComponent, private zone: NgZone) {}

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.defaults = ol.interaction.defaults();
      this.defaults.forEach(interaction => this.kaart.map.addInteraction(interaction));
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.defaults.forEach(interaction => this.kaart.map.removeInteraction(interaction));
    });
  }
}
