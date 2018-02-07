import { Component, Input, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";

const stdStijl: ol.style.Style = new ol.style.Style({
  stroke: new ol.style.Stroke({
    color: "rgba(0, 0, 255, 1.0)",
    width: 2
  })
});

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartVectorLaagComponent extends KaartLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style: ol.style.Style = stdStijl;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minResolution: number;
  @Input() maxResolution: number;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  // resolutions: [256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0, 1.0, 0.5, 0.25, 0.125, 0.0625, 0.03125],

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      style: this.style,
      selecteerbaar: this.selecteerbaar,
      minResolution: this.minResolution,
      maxResolution: this.maxResolution
    };
  }
}
