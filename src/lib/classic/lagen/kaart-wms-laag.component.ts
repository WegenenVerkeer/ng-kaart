import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";
import { List } from "immutable";

import { Laaggroep, TiledWmsType, WmsLaag } from "../../kaart/kaart-elementen";
import { KaartClassicComponent } from "../kaart-classic.component";

import { KaartLaagComponent } from "./kaart-laag.component";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmsLaagComponent extends KaartLaagComponent implements OnInit {
  @Input() laagNaam: string;
  @Input() urls: string[];
  @Input() tiled = true;
  @Input() type: string;
  @Input() versie?: string;
  @Input() format = "image/png";
  @Input() tileSize? = 256;
  @Input() opacity?: number;

  constructor(kaart: KaartClassicComponent) {
    super(kaart);
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
      maxZoom: this.maxZoom
    };
  }

  laaggroep(): Laaggroep {
    return "Achtergrond";
  }

  backgroundUrl(urls: List<string>, laagNaam: string): string {
    // TODO: rekening houden met echte config.
    return (
      urls.get(0) + // mag wat veiliger
      "?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap" +
      "&FORMAT=" +
      encodeURIComponent(this.format) +
      "&TRANSPARENT=false&LAYERS=" +
      encodeURIComponent(laagNaam) +
      "&TILED=true" +
      "&SRS=EPSG%3A31370" +
      "&CRS=EPSG%3A31370" +
      "&WIDTH=256&HEIGHT=256" +
      "&STYLES=&BBOX=104528%2C188839.75%2C105040%2C189351.75"
    );
  }
}
