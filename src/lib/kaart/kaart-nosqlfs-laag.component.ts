import { Component, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartLaagComponent } from "./kaart-laag.component";
import { NosqlFsSource } from "../source";

@Component({
  selector: "awv-kaart-nosqlfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartNosqlfsLaagComponent extends KaartLaagComponent {
  @Input() url = "/geolatte-nosqlfs";
  @Input() database: string;
  @Input() collection: string;
  @Input() style?: ol.style.Style = undefined;
  @Input() styleFunction?: ol.StyleFunction = undefined;
  @Input() zichtbaar = true;
  @Input() selecteerbaar = true;
  @Input() minZoom = 7;
  @Input() maxZoom = 15;
  @Input() view = "default";
  @Input() filter: string;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: new NosqlFsSource(this.database, this.collection, this.url, this.view, this.filter),
      style: fromNullable(this.style),
      styleFunction: fromNullable(this.styleFunction),
      selecteerbaar: this.selecteerbaar,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom
    };
  }
}
