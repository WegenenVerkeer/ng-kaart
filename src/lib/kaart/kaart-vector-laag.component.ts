import { Component, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { orElse } from "../util/option";
import { KaartClassicComponent } from "./kaart-classic.component";
import * as ke from "./kaart-elementen";
import { KaartLaagComponent } from "./kaart-laag.component";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartVectorLaagComponent extends KaartLaagComponent {
  @Input() source = new ol.source.Vector();
  @Input() style?: ol.style.Style;
  @Input() styleFunction?: ol.StyleFunction;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      styleSelector: orElse(fromNullable(this.style).map(ke.StaticStyle), () => fromNullable(this.styleFunction).map(ke.DynamicStyle)),
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Voorgrond.Hoog";
  }
}
