import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { option } from "fp-ts";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import { wfsSource } from "../../source/wfs-source";
import * as val from "../webcomponent-support/params";

import { ClassicVectorLaagLikeDirective } from "./classic-vector-laag-like.directive";

@Component({
  selector: "awv-kaart-wfs-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWfsLaagComponent extends ClassicVectorLaagLikeDirective {
  _url = "/geoserver/wfs";
  _veldInfos: ke.VeldInfo[] = [];
  _version = "2.0.0";
  _srsName = "EPSG:31370";
  _geom = "the_geom";
  _typeNames: option.Option<string> = option.none;
  _cqlFilter: option.Option<string> = option.none;
  _cors = false;

  constructor(injector: Injector) {
    super(injector);
  }

  @Input()
  set url(param: string) {
    this._url = option.fromNullable(param).getOrElse(this._url);
  }

  @Input()
  set veldinfos(param: ke.VeldInfo[]) {
    this._veldInfos = val.veldInfoArray(param, this._veldInfos);
  }

  @Input()
  set version(param: string) {
    this._version = option.fromNullable(param).getOrElse(this._version);
  }

  @Input()
  set srsName(param: string) {
    this._srsName = option.fromNullable(param).getOrElse(this._srsName);
  }

  @Input()
  set typeNames(param: string) {
    this._typeNames = option.fromNullable(param);
  }

  @Input()
  set cqlFilter(param: string) {
    this._cqlFilter = option.fromNullable(param);
  }

  @Input()
  set geom(param: string) {
    this._geom = option.fromNullable(param).getOrElse(this._geom);
  }

  /**
   * If cors is set to true, we don't include the credentials: "include" header since this doesn't play well with
   * Access-Control-Allow-Origin wildcard setting (CORS: Cannot use wildcard in Access-Control-Allow-Origin when credentials flag is true)
   * @param cors
   */
  @Input()
  set cors(cors: boolean) {
    this._cors = option.fromNullable(cors).getOrElse(this._cors);
  }

  createLayer(): ke.VectorLaag {
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: wfsSource(
        this._titel,
        this._srsName,
        this._version,
        this._typeNames.getOrElseL(() => {
          throw new Error("Een WFS laag moet verplicht een waarde voor typenames hebben");
        }),
        this._url,
        this._geom,
        this._cqlFilter,
        this._cors
      ),
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
