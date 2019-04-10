import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";

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

  constructor(injector: Injector) {
    super(injector);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: this.source,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this.selecteerbaar,
      hover: this.hover,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      offsetveld: fromNullable(this.offsetveld),
      velden: this.veldInfos.reduce((m, vi) => m.set(vi.naam, vi), new Map<string, ke.VeldInfo>()),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false
    };
  }
}
