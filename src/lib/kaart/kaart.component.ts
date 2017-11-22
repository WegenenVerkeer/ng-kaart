import {Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild, ViewEncapsulation} from "@angular/core";
import {KaartConfig} from "./kaart.config";

import * as _ from "lodash";
import * as ol from "openlayers";
import {CoordinatenService} from "./coordinaten.service";

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Native
})
export class KaartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild("map") mapElement: ElementRef;

  map: ol.Map;

  @Input() zoom = 2;
  @Input() minZoom = 2;
  @Input() maxZoom = 13;
  @Input() middelpunt: ol.Coordinate = [130000, 184000]; // "extent" heeft voorrang
  @Input() breedte; // neem standaard de hele breedte in
  @Input() hoogte = 400;
  @Input() projectie = this.getDienstkaartProjectie();
  @Input() extent;

  constructor(@Input() public config: KaartConfig, private zone: NgZone, private coordinatenService: CoordinatenService) {}

  ngOnInit() {
    this.zone.runOutsideAngular(() => {
      this.map = this.maakKaart();
      this.map.setSize([this.breedte, this.hoogte]);
      this.centreer();
      this.refresh();
    });
  }

  ngOnDestroy() {
    this.zone.runOutsideAngular(() => {
      if (this.map) {
        this.map.setTarget(null);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    this.zone.runOutsideAngular(() => {
      if ("middelpunt" in changes) {
        if (!_.isEqual(changes.middelpunt.currentValue, changes.middelpunt.previousValue)) {
          this.centreer();
        }
      }

      if ("extent" in changes) {
        if (!_.isEqual(changes.extent.currentValue, changes.extent.previousValue)) {
          this.middelpunt = ol.extent.getCenter(changes.extent.currentValue);
          this.zoomToExtent();
        }
      }
      this.refresh();
    });
  }

  centreer() {
    setTimeout(() => {
      this.map.getView().setCenter(this.middelpunt);
    }, 0);
  }

  zoomToExtent() {
    setTimeout(() => {
      this.map.getView().fit(this.extent);
    }, 0);
  }

  refresh() {
    setTimeout(() => {
      this.map.updateSize();
    }, 0);
  }

  maakKaart(): ol.Map {
    return new ol.Map(<olx.MapOptions>{
      controls: [],
      interactions: [],
      layers: [],
      pixelRatio: 1, // dit moet op 1 staan anders zal OL 512x512 tiles ophalen op retina displays en die zitten niet in onze geowebcache
      target: this.mapElement.nativeElement,
      logo: false,
      view: new ol.View({
        projection: this.projectie,
        center: this.middelpunt,
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
        zoom: this.zoom
      })
    });
  }

  /**
   * Configureer Lambert72
   */
  getDienstkaartProjectie(): ol.proj.Projection {
    CoordinatenService.configureerLambert72();
    const dienstkaartProjectie: ol.proj.Projection = ol.proj.get("EPSG:31370");
    dienstkaartProjectie.setExtent([18000.0, 152999.75, 280144.0, 415143.75]); // zet de extent op die van de dienstkaart
    return dienstkaartProjectie;
  }

  zoomTo(extent: ol.geom.SimpleGeometry | ol.Extent): void {
    this.map.getView().fit(extent, {size: this.map.getSize()});
  }
}
