import { HttpClient } from "@angular/common/http";
import { Component, Input, NgZone, OnInit, ViewEncapsulation } from "@angular/core";
import { fromNullable, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { urlWithParams } from "../../util/url";
import { KaartClassicComponent } from "../kaart-classic.component";
import { classicLogger } from "../log";
import { logOnlyWrapper } from "../messages";

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
  tiled = true;
  @Input()
  type: string;
  @Input()
  matrixSet: string;

  @Input()
  capUrl?: string;

  @Input()
  urls: string[] = [];
  @Input()
  versie?: string;
  @Input()
  format = "image/png";
  @Input()
  opacity?: number;
  @Input()
  matrixIds: string[];
  @Input()
  style?: string;
  @Input()
  origin?: [number, number];
  @Input()
  extent?: [number, number, number, number];
  @Input()
  projection = "EPSG:31370";

  constructor(kaart: KaartClassicComponent, private http: HttpClient, zone: NgZone) {
    super(kaart, zone);
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    if (!this.matrixSet) {
      throw new Error("matrixSet moet opgegeven zijn");
    }
    if (!(this.capUrl || (this.urls && this.urls.length > 0 && this.matrixIds && this.matrixIds.length > 0))) {
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
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
        verwijderd: false
      };
    } else {
      const config: ke.WmtsManualConfig = {
        type: "Manual",
        urls: this.urls,
        matrixIds: this.matrixIds,
        style: fromNullable(this.style),
        origin: fromNullable(this.origin),
        extent: fromNullable(this.extent)
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
      opacity: fromNullable(this.opacity),
      matrixSet: this.matrixSet,
      config: config,
      backgroundUrl: this.backgroundUrl(config),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(config: ke.WmtsCapaConfig | ke.WmtsManualConfig): string {
    if (config.type === "Manual") {
      return urlWithParams(this.urls[0], {
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
