import { HttpClient } from "@angular/common/http";
import { Component, Injector, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { urlWithParams } from "../../util/url";
import * as val from "../classic-validators";
import { classicLogger } from "../log";
import { logOnlyWrapper } from "../messages";
import { getBooleanParam, getOptionalCoordinateParam, getOptionalExtentParam, getStringArrayParam } from "../webcomponent-support/params";

import { blancoLaag } from "./classic-blanco-laag.component";
import { ClassicLaagComponent } from "./classic-laag.component";

const WmtsParser = new ol.format.WMTSCapabilities();

@Component({
  selector: "awv-kaart-wmts-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWmtsLaagComponent extends ClassicLaagComponent implements OnInit {
  @Input()
  laagNaam: string;
  @Input()
  type: string;
  @Input()
  matrixSet: string;

  @Input()
  capUrl?: string;

  @Input()
  versie?: string;
  @Input()
  format = "image/png";
  @Input()
  style?: string;
  @Input()
  projection = "EPSG:31370";

  private _urls: string[] = [];
  private _matrixIds: string[];
  private _origin?: ol.Coordinate;
  private _extent?: ol.Extent;
  private _opacity?: number;

  constructor(injector: Injector, private http: HttpClient) {
    super(injector);
  }

  @Input()
  set urls(param: string[] | string) {
    val.stringArray(param, array => (this._urls = array));
  }

  @Input()
  set matrixIds(param: string[] | string) {
    val.stringArray(param, array => (this._matrixIds = array));
  }

  @Input()
  set origin(param: [number, number] | string) {
    val.coord(param, coord => (this._origin = coord));
  }

  @Input()
  set extent(param: ol.Extent | string) {
    val.extent(param, extent => (this._extent = extent));
  }

  @Input()
  set opacity(param: number | string) {
    val.num(param, num => (this._opacity = num));
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    if (!this.matrixSet) {
      throw new Error("matrixSet moet opgegeven zijn");
    }
    if (!(this.capUrl || (arrays.isNonEmpty(this._urls) && arrays.isNonEmpty(this._matrixIds)))) {
      throw new Error("capurl of urls en matrixIds moet opgegeven zijn");
    }
    super.ngOnInit();
  }

  createLayer(): ke.Laag {
    if (this.capUrl) {
      this.vervangLaagWithCapabilitiesAsync(this.capUrl!);
      return {
        type: ke.BlancoType,
        titel: this.titel,
        backgroundUrl: blancoLaag,
        minZoom: this._minZoom,
        maxZoom: this._maxZoom,
        verwijderd: false
      };
    } else {
      const config: ke.WmtsManualConfig = {
        type: "Manual",
        urls: this._urls,
        matrixIds: this._matrixIds,
        style: fromNullable(this.style),
        origin: this._origin,
        extent: this._extent
      };
      return this.createLayerFromConfig(config);
    }
  }

  private createLayerFromConfig(config: ke.WmtsCapaConfig | ke.WmtsManualConfig): ke.WmtsLaag {
    return {
      type: ke.WmtsType,
      titel: this.titel,
      naam: this.laagNaam,
      versie: fromNullable(this.versie),
      format: fromNullable(this.format),
      opacity: fromNullable(this._opacity),
      matrixSet: this.matrixSet,
      config: config,
      backgroundUrl: this.backgroundUrl(config),
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(config: ke.WmtsCapaConfig | ke.WmtsManualConfig): string {
    if (config.type === "Manual") {
      return urlWithParams(this._urls[0], {
        layer: this.laagNaam,
        style: config.style.getOrElse(""),
        tilematrixset: this.matrixSet,
        Service: "WMTS",
        Request: "GetTile",
        Version: "1.0.0",
        WIDTH: 256,
        HEIGHT: 256,
        Format: this.format,
        TileMatrix: 9,
        TileCol: 185,
        TileRow: 273
      });
    } else {
      // TODO: bepalen op basis van de echte parameters. Rekening houden met config.
      return urlWithParams(this.capUrl!, {
        layer: this.laagNaam,
        style: fromNullable(this.style).getOrElse(""),
        tilematrixset: this.matrixSet,
        Service: "WMTS",
        Request: "GetTile",
        Version: "1.0.0",
        Format: "image/png",
        TileMatrix: this.matrixSet + ":9",
        TileCol: 169,
        TileRow: 108
      });
    }
  }

  private vervangLaagWithCapabilitiesAsync(capUrl: string): void {
    this.http
      .get(capUrl + "?request=getCapabilities", { responseType: "text" }) //
      .subscribe(
        cap => this.vervangLaagWithCapabilities(capUrl, cap), //
        err => classicLogger.error("Kon capabilities niet ophalen", err, this.titel, capUrl)
      );
  }

  private vervangLaagWithCapabilities(capUrl: string, capabilitiesText: string) {
    const capabilities = WmtsParser.read(capabilitiesText);
    const wmtsOptions = ol.source.WMTS.optionsFromCapabilities(capabilities, {
      layer: this.laagNaam,
      matrixSet: this.matrixSet,
      projection: this.projection
    });
    const config: ke.WmtsCapaConfig = {
      type: "Capa",
      url: capUrl,
      wmtsOptions: wmtsOptions
    };
    const lg = this.createLayerFromConfig(config);
    this.laag = some(lg);
    this.dispatch({
      type: "VervangLaagCmd",
      laag: lg,
      wrapper: logOnlyWrapper
    });
  }
}
