import { Component, Input, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { NosqlFsSource } from "../source";

const stdStijl: ol.style.Style = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: "rgba(0, 0, 255, 1.0)",
    width: 2
  })
});

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartNosqlfsLaagComponent extends KaartLaagComponent {
  @Input() laag: String;
  @Input() style: ol.style.Style = stdStijl;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: new NosqlFsSource(this.laag),
      style: this.style,
      selecteerbaar: this.selecteerbaar
    };
  }
}
