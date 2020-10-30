import { HttpClient } from "@angular/common/http";
import {
  Component,
  Injector,
  Input,
  OnInit,
  ViewEncapsulation,
} from "@angular/core";
import { option } from "fp-ts";

import * as ke from "../../kaart/kaart-elementen";
import * as arrays from "../../util/arrays";
import * as ol from "../../util/openlayers-compat";
import { urlWithParams } from "../../util/url";
import { classicLogger } from "../log";
import { logOnlyWrapper } from "../messages";
import * as val from "../webcomponent-support/params";

import { blancoLaag } from "./classic-blanco-laag.component";
import { ClassicLaagDirective } from "./classic-laag.directive";

const WmtsParser = new ol.format.WMTSCapabilities();

@Component({
  selector: "awv-kaart-wmts-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None,
})
export class ClassicWmtsLaagComponent
  extends ClassicLaagDirective
  implements OnInit {
  private _laagNaam: string;
  private _type: string;
  private _matrixSet: string;
  private _capUrl: option.Option<string> = option.none;
  private _versie: option.Option<string> = option.none;
  private _format = "image/png";
  private _style: option.Option<string> = option.none;
  private _projection = "EPSG:31370";
  private _urls: string[] = [];
  private _matrixIds: string[];
  private _origin: option.Option<ol.Coordinate> = option.none;
  private _extent: option.Option<ol.Extent> = option.none;

  constructor(injector: Injector, private http: HttpClient) {
    super(injector);
  }

  @Input()
  set urls(param: string[]) {
    this._urls = val.stringArray(param, this._urls);
  }

  @Input()
  set matrixIds(param: string[]) {
    this._matrixIds = val.stringArray(param, this._matrixIds);
  }

  @Input()
  set origin(param: [number, number]) {
    this._origin = val.optCoord(param);
  }

  @Input()
  set extent(param: ol.Extent) {
    this._extent = val.optExtent(param);
  }

  @Input()
  set laagNaam(param: string) {
    this._laagNaam = val.str(param, this._laagNaam);
  }

  @Input()
  set type(param: string) {
    this._type = val.str(param, this._type);
  }

  @Input()
  set matrixSet(param: string) {
    this._matrixSet = val.str(param, this._matrixSet);
  }

  @Input()
  set capUrl(param: string) {
    this._capUrl = val.optStr(param);
  }

  @Input()
  set versie(param: string) {
    this._versie = val.optStr(param);
  }

  @Input()
  set format(param: string) {
    this._format = val.str(param, this._format);
  }

  @Input()
  set style(param: string) {
    this._style = val.optStr(param);
  }

  @Input()
  set projection(param: string) {
    this._projection = val.str(param, this._projection);
  }

  ngOnInit() {
    if (
      ["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(
        this.gekozenLaagGroep()
      ) < 0
    ) {
      throw new Error(
        "groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn"
      );
    }
    if (!this._matrixSet) {
      throw new Error("matrixSet moet opgegeven zijn");
    }
    if (
      !(
        this._capUrl.isSome() ||
        (arrays.isNonEmpty(this._urls) && arrays.isNonEmpty(this._matrixIds))
      )
    ) {
      throw new Error("capurl of urls en matrixIds moet opgegeven zijn");
    }
    super.ngOnInit();
  }

  createLayer(): ke.Laag {
    return this._capUrl.foldL(
      () => {
        const config: ke.WmtsManualConfig = {
          type: "Manual",
          urls: this._urls,
          matrixIds: this._matrixIds,
          style: this._style,
          origin: this._origin,
          extent: this._extent,
        };
        return this.createLayerFromConfig(config) as ke.Laag;
      },
      (capUrl) => {
        this.vervangLaagWithCapabilitiesAsync(capUrl);
        return {
          type: ke.BlancoType,
          titel: this._titel,
          backgroundUrl: blancoLaag,
          minZoom: this._minZoom,
          maxZoom: this._maxZoom,
          verwijderd: false,
        } as ke.Laag;
      }
    );
  }

  private createLayerFromConfig(
    config: ke.WmtsCapaConfig | ke.WmtsManualConfig
  ): ke.WmtsLaag {
    return {
      type: ke.WmtsType,
      titel: this._titel,
      naam: this._laagNaam,
      versie: this._versie,
      format: option.some(this._format),
      matrixSet: this._matrixSet,
      config: config,
      backgroundUrl: this.backgroundUrl(config),
      minZoom: this._minZoom,
      maxZoom: this._maxZoom,
      verwijderd: false,
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(config: ke.WmtsCapaConfig | ke.WmtsManualConfig): string {
    if (config.type === "Manual") {
      return urlWithParams(this._urls[0], {
        layer: this._laagNaam,
        style: config.style.getOrElse(""),
        tilematrixset: this._matrixSet,
        Service: "WMTS",
        Request: "GetTile",
        Version: "1.0.0",
        WIDTH: 256,
        HEIGHT: 256,
        Format: this._format,
        TileMatrix: 7,
        TileCol: 49,
        TileRow: 66,
      });
    } else {
      // TODO: bepalen op basis van de echte parameters. Rekening houden met config.
      return urlWithParams(this._capUrl.toNullable()!, {
        layer: this._laagNaam,
        style: this._style.getOrElse(""),
        tilematrixset: this._matrixSet,
        Service: "WMTS",
        Request: "GetTile",
        Version: "1.0.0",
        Format: "image/png",
        TileMatrix: this._matrixSet + ":9",
        TileCol: 169,
        TileRow: 108,
      });
    }
  }

  private vervangLaagWithCapabilitiesAsync(capUrl: string): void {
    this.http
      .get(capUrl + "?request=getCapabilities", { responseType: "text" }) //
      .subscribe(
        (cap) => this.vervangLaagWithCapabilities(capUrl, cap), //
        (err) =>
          classicLogger.error(
            "Kon capabilities niet ophalen",
            err,
            this._titel,
            capUrl
          )
      );
  }

  private vervangLaagWithCapabilities(
    capUrl: string,
    capabilitiesText: string
  ) {
    const capabilities = WmtsParser.read(capabilitiesText);
    const wmtsOptions = ol.source.wmts.optionsFromCapabilities(capabilities, {
      layer: this._laagNaam,
      matrixSet: this._matrixSet,
      projection: this._projection,
    });
    const config: ke.WmtsCapaConfig = {
      type: "Capa",
      url: capUrl,
      wmtsOptions: wmtsOptions,
    };
    const lg = this.createLayerFromConfig(config);
    this.laag = option.some(lg);
    this.dispatch({
      type: "VervangLaagCmd",
      laag: lg,
      wrapper: logOnlyWrapper,
    });
  }
}
