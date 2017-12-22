import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";

import * as ol from "openlayers";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartLaagComponent } from "./kaart-laag.component";
import { KaartConfig } from "./kaart.config";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmsLaagComponent extends KaartLaagComponent implements OnInit, OnDestroy {
  @Input() laagNaam: string;
  @Input() urls: string[];
  @Input() tiled = true;
  @Input() type: string;
  @Input() versie?: string;
  @Input() extent: ol.Extent = [18000.0, 152999.75, 280144.0, 415143.75];

  constructor(kaart: KaartComponent, config: KaartConfig, zone: NgZone) {
    super(kaart, config, zone);
  }

  createLayer(): ol.layer.Layer {
    return new ol.layer.Tile({
      visible: this.zichtbaar,
      extent: this.extent,
      source: new ol.source.TileWMS({
        projection: null,
        urls: this.urls,
        params: {
          LAYERS: this.laagNaam,
          TILED: this.tiled,
          SRS: this.srs,
          version: this.versie
        }
      })
    });
  }
}
