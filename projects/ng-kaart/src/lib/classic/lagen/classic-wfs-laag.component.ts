import { Component, Injector, Input, ViewEncapsulation } from "@angular/core";
import { fromNullable, none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import * as ss from "../../kaart/stijl-selector";
import { setLaagnaam } from "../../util/feature";
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
  _cqlFilter: Option<string> = none;

  constructor(injector: Injector) {
    super(injector);
  }

  @Input()
  set url(param: string) {
    this._url = fromNullable(param).getOrElse(this._url);
  }

  @Input()
  set veldinfos(param: ke.VeldInfo[]) {
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

  @Input()
  set cqlFilter(param: string) {
    this._cqlFilter = fromNullable(param);
  }

  createLayer(): ke.VectorLaag {
    const maybeEncodedFilter = this._cqlFilter.map(f => ` AND (${f})`).map(encodeURIComponent);
    const precalculatedUrl = urlWithParams(this._url, {
      srsname: this._srsName,
      version: this._version,
      outputFormat: "application/json",
      request: "GetFeature",
      typenames: this._typeNames.getOrElseL(() => {
        throw new Error("Een WFS kaag moet verplicht een waarde voor typenames hebben");
      })
    });
    const source = new ol.source.Vector({
      format: new ol.format.GeoJSON(),
      url: extent => {
        const url = `${precalculatedUrl}&cql_filter=bbox(the_geom,${extent.join(",")})`;
        return maybeEncodedFilter.fold(url, encodedFilter => url + encodedFilter);
      },
      strategy: ol.loadingstrategy.bbox
    });
    source.on(
      "addfeature",
      evt => {
        const feature = evt["feature"] as ol.Feature;
        const properties = feature.getProperties();
        feature.setProperties({});
        feature.set("properties", properties);
        setLaagnaam(this._titel)(feature);
      },
      this
    );
    return {
      type: ke.VectorType,
      titel: this._titel,
      source: source,
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
