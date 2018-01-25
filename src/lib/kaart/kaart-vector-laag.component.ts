import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartVectorLaagComponent extends KaartLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style: ol.style.Style;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.ElementType.VECTORLAAG,
      titel: this.titel,
      source: this.source,
      style: this.style,
      selecteerbaar: this.selecteerbaar
    };
  }
}
