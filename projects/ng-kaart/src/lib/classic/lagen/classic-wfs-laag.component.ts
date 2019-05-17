import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import { urlWithParams } from "../../util/url";
import * as val from "../webcomponent-support/params";

import { ClassicVectorLaagLikeComponent } from "./classic-vector-laag-like.component";

@Component({
  selector: "awv-kaart-wfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWfsLaagComponent extends ClassicVectorLaagLikeComponent {
  _url = "/geoserver/wfs";
  _veldInfos: ke.VeldInfo[] = [];
  _version = "2.0.0";
  _srsName = "EPSG:31370";
  _typeNames: Option<string> = none;

  constructor(injector: Injector) {
    super(injector);
  }

  @Input()
  set url(param: string) {
    this._url = fromNullable(param).getOrElse(this._url);
  }

  @Input()
  set veldInfos(param: ke.VeldInfo[]) {
    this._veldInfos = val.veldInfoArray(param, this._veldInfos);
  }

  @Input()
  set version(param: string) {
    this._version = fromNullable(param).getOrElse(this._version);
  }

  @Input()
  set srsName(param: string) {
    this._srsName = fromNullable(param).getOrElse(this._srsName);
  }

  @Input()
  set typeNames(param: string) {
    this._typeNames = fromNullable(param);
  }

  createLayer(): ke.VectorLaag {
    const precalculatedUrl = urlWithParams(this._url, {
      srsname: this._srsName,
      version: this._version,
      outputFormat: "application/json",
      request: "GetFeature",
      typenames: this._typeNames.getOrElseL(() => {
        throw new Error("Een WFS kaag moet verplicht een waarde voor typenames hebben");
      })
    });
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: function(extent) {
          return `${precalculatedUrl}&bbox=${extent.join(",")}`;
        },
        strategy: ol.loadingstrategy.bbox
      }),
      clusterDistance: this._clusterDistance,
      styleSelector: this.getMaybeStyleSelector(),
      styleSelectorBron: this.getMaybeStyleSelectorBron(),
      selectieStyleSelector: fromNullable(this.selectieStyle).chain(ss.asStyleSelector),
      hoverStyleSelector: fromNullable(this.hoverStyle).chain(ss.asStyleSelector),
      selecteerbaar: this._selecteerbaar,
      hover: this._hover,
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      offsetveld: this._offsetveld,
      velden: this._veldInfos.reduce((m, vi) => m.set(vi.naam, vi), new Map<string, ke.VeldInfo>()),
      verwijderd: false,
      rijrichtingIsDigitalisatieZin: false,
      filter: none
    };
  }
}
