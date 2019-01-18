import { AfterViewInit, Component, Input, NgZone, OnInit, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { Laaggroep, TiledWmsType, WmsLaag } from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol-commands";
import { cacheTiles } from "../../util/cachetiles";
import { urlWithParams } from "../../util/url";
import { KaartClassicComponent } from "../kaart-classic.component";
import { logOnlyWrapper } from "../messages";

import { ClassicLaagComponent } from "./classic-laag.component";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicWmsLaagComponent extends ClassicLaagComponent implements OnInit, AfterViewInit {
  @Input()
  laagNaam: string;
  @Input()
  urls: string[];
  @Input()
  tiled = true;
  @Input()
  type: string;
  @Input()
  versie?: string;
  @Input()
  format = "image/png";
  @Input()
  // tslint:disable-next-line:whitespace
  tileSize? = 256;
  @Input()
  opacity?: number;
  @Input()
  offline = false;

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(kaart, zone);
  }

  ngOnInit() {
    if (["Voorgrond.Laag", "Voorgrond.Hoog", "Achtergrond"].indexOf(this.gekozenLaagGroep()) < 0) {
      throw new Error("groep moet 'Voorgrond.Laag', 'Voorgrond.Hoog' of 'Achtergrond' zijn");
    }
    super.ngOnInit();
  }

  createLayer(): WmsLaag {
    return {
      type: TiledWmsType,
      titel: this.titel,
      naam: this.laagNaam,
      urls: List(this.urls),
      versie: fromNullable(this.versie),
      tileSize: fromNullable(this.tileSize),
      format: fromNullable(this.format),
      opacity: fromNullable(this.opacity),
      backgroundUrl: this.backgroundUrl(List(this.urls), this.laagNaam),
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      verwijderd: false
    };
  }

  laaggroep(): Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(urls: List<string>, laagNaam: string): string {
    // TODO: rekening houden met echte config.
    return urlWithParams(urls.get(0), {
      layers: this.laagNaam,
      styles: "",
      service: "WMS",
      request: "GetMap",
      version: "1.3.0",
      transparant: false,
      tiled: true,
      width: 256,
      height: 256,
      format: this.format,
      srs: "EPSG:31370",
      crs: "EPSG:31370",
      bbox: "104528,188839.75,105040,189351.75"
    });
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    if (this.offline) {
      this.dispatch(prt.ActiveerCacheVoorLaag(this.titel, logOnlyWrapper));
    }
  }

  preCache(startZoom: number, eindZoom: number, wkt: string) {
    // TODO: start precaching - get Source
    cacheTiles(null, startZoom, eindZoom, wkt);
  }
}
