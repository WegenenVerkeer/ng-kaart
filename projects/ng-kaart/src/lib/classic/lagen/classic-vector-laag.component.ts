import { Component, Input, NgZone, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { OrderedMap } from "immutable";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import { KaartClassicComponent } from "../kaart-classic.component";

import { ClassicVectorLaagLikeComponent } from "./classic-vector-laag-like.component";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicVectorLaagComponent extends ClassicVectorLaagLikeComponent {
  @Input()
  source = new ol.source.Vector();

  @Input()
  veldInfos: ke.VeldInfo[] = [];

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this.titel,
      source: this.source,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      hover: this.hover,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: OrderedMap(this.veldInfos.map(vi => [vi.naam, vi])),
      verwijderd: false
    };
  }
}
