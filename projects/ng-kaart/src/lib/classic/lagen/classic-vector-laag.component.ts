import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import * as ol from "../../util/openlayers-compat";
import * as val from "../webcomponent-support/params";

import { ClassicVectorLaagLikeDirective } from "./classic-vector-laag-like.directive";

@Component({
  selector: "awv-kaart-vector-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicVectorLaagComponent extends ClassicVectorLaagLikeDirective {
  @Input()
  source = new ol.source.Vector();

  _veldInfos: ke.VeldInfo[] = [];

  @Input()
  set veldinfos(param: ke.VeldInfo[]) {
    this._veldInfos = val.veldInfoArray(param, this._veldInfos);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: this.source,
      clusterDistance: this._clusterDistance,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: option.fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: option.fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this._selecteerbaar,
      hover: this._hover,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      offsetveld: this._offsetveld,
      velden: this._veldInfos.reduce((m, vi) => m.set(vi.naam, vi), new Map<string, ke.VeldInfo>()),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false,
      filter: option.none
    };
  }
}
