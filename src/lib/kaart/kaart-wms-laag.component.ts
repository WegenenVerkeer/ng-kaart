import {Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation} from "@angular/core";
import {KaartComponent} from "./kaart.component";

import * as ol from "openlayers";

@Component({
  selector: "awv-kaart-wms-laag",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartWmsLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;
  @Input() urls: string[];
  @Input() laag: string;
  @Input() tiles = true;
  @Input() type: string;
  @Input() srs = "EPSG:31370";
  @Input() versie?: string;
  @Input() extent: ol.Extent = [18000.0, 152999.75, 280144.0, 415143.75];

  wmsLaag: ol.layer.Tile;

  constructor(protected kaart: KaartComponent, protected zone: NgZone) {}

  ngOnInit(): void {
    if (!this.laag) {
      throw new Error("Geen laag gedefinieerd");
    }
    this.zone.runOutsideAngular(() => {
      this.wmsLaag = this.maakWmsLayer();
      this.kaart.map.addLayer(this.wmsLaag);
    });
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      this.kaart.map.removeLayer(this.wmsLaag);
    });
  }

  maakWmsLayer(): ol.layer.Tile {
    return new ol.layer.Tile(<olx.layer.TileOptions>{
      title: this.titel,
      type: this.type,
      visible: this.zichtbaar,
      extent: this.extent,
      source: new ol.source.TileWMS({
        projection: null,
        urls: this.urls,
        params: {
          LAYERS: this.laag,
          TILED: this.tiles,
          SRS: this.srs,
          version: this.versie
        }
      })
    });
  }
}
