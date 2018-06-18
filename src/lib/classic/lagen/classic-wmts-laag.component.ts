import { HttpClient } from "@angular/common/http";
import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import * as ke from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";
import { classicLogger } from "../log";

import { ClassicLaagComponent } from "./classic-laag.component";

@Component({
  selector: "awv-kaart-wmts-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWmtsLaagComponent extends ClassicLaagComponent implements OnInit {
  @Input() laagNaam: string;
  @Input() tiled = true;
  @Input() type: string;
  @Input() matrixSet: string;

  @Input() capurl?: string;

  @Input() urls: string[] = [];
  @Input() versie?: string;
  @Input() format = "image/png";
  @Input() opacity?: number;
  @Input() matrixIds: string[];
  @Input() style?: string;
  @Input() origin?: [number, number];
  @Input() extent?: [number, number, number, number];
  @Input() projection = "EPSG:31370";

  private wmtsOptions: ol.olx.source.WMTSOptions;

  constructor(kaart: KaartClassicComponent, private http: HttpClient) {
    super(kaart);
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    if (!this.matrixSet) {
      throw new Error("matrixSet moet opgegeven zijn");
    }
    if (!(this.capurl || (this.urls && this.urls.length > 0 && this.matrixIds && this.matrixIds.length > 0))) {
      throw new Error("capurl of urls en matrixIds moet opgegeven zijn");
    }

    if (this.capurl) {
      // We moeten eerst de capabilities ophalen. We zullen zelf manueel de this.voegLaagToe() oproepen.
      this.voegLaagToeBijStart = false;
      this.addLaagWithCapabilitiesAsync();
    }

    super.ngOnInit();
  }

  createLayer(): ke.WmtsLaag {
    let config: ke.WmtsCapaConfig | ke.WmtsManualConfig;
    if (this.capurl) {
      config = {
        type: "Capa",
        url: this.capurl,
        wmtsOptions: this.wmtsOptions
      };
    } else {
      config = {
        type: "Manual",
        urls: List(this.urls),
        matrixIds: this.matrixIds,
        style: fromNullable(this.style),
        origin: fromNullable(this.origin),
        extent: fromNullable(this.extent)
      };
    }

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
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): ke.Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(config: ke.WmtsCapaConfig | ke.WmtsManualConfig): string {
    if (config.type === "Manual") {
      return (
        this.urls[0] +
        "?layer=" +
        encodeURIComponent(this.laagNaam) +
        "&style=" +
        encodeURIComponent(config.style.getOrElse("")) +
        "&tilematrixset=" +
        encodeURIComponent(this.matrixSet) +
        "&Service=WMTS&Request=GetTile&Version=1.0.0&WIDTH=256&HEIGHT=256" +
        "&Format=" +
        encodeURIComponent(this.format) +
        "&TileMatrix=9&TileCol=185&TileRow=273"
      );
    } else {
      // TODO: bepalen op basis van de echte parameters. Rekening houden met config.
      return "";
    }
  }

  private addLaagWithCapabilitiesAsync(): void {
    if (this.capurl) {
      this.http
        .get(this.capurl, { responseType: "text" }) //
        .subscribe(
          cap => this.addLaagWithCapabilities(cap), //
          err => classicLogger.error("Kon capabilities niet ophalen", err)
        );
    }
  }

  private addLaagWithCapabilities(cap: string) {
    const parser = new ol.format.WMTSCapabilities();

    const result = parser.read(cap);
    this.wmtsOptions = ol.source.WMTS.optionsFromCapabilities(result, {
      layer: this.laagNaam,
      matrixSet: this.matrixSet,
      projection: this.projection
    });
    this.voegLaagToe();
  }
}
