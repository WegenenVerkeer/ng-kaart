import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation, Inject } from "@angular/core";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/of";
import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/never";
import "rxjs/add/operator/concat";
import "rxjs/add/operator/switchMap";
import "rxjs/add/operator/first";
import "rxjs/add/operator/let";
import "rxjs/add/operator/map";
import "rxjs/add/operator/observeOn";
import "rxjs/add/operator/reduce";
import "rxjs/add/operator/scan";
import "rxjs/add/operator/shareReplay";

import * as ol from "openlayers";
import proj4 from "proj4";

import { KaartConfig, KAART_CFG } from "./kaart.config";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartWithInfo } from "./kaart-with-info";
import "../util/leave-zone";
import "../util/observable-run";
import * as prt from "./kaart-protocol";
import * as red from "./kaart-reducer";

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Native
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private static readonly lambert72 = KaartComponent.configureerLambert72();

  @ViewChild("map") mapElement: ElementRef;

  @Input() kaartEvt$: Observable<prt.KaartEvnt> = Observable.empty();

  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 13; // TODO naar config
  @Input() naam = "kaart";

  private static configureerLambert72() {
    ol.proj.setProj4(proj4);
    proj4.defs(
      "EPSG:31370",
      "+proj=lcc +lat_1=51.16666723333333 +lat_2=49.8333339 +lat_0=90 +lon_0=4.367486666666666 +x_0=150000.013 +y_0=5400088.438 " +
        "+ellps=intl +towgs84=-125.8,79.9,-100.5 +units=m +no_defs"
    );
  }

  constructor(@Inject(KAART_CFG) readonly config: KaartConfig, zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    super.ngOnInit();
    this.bindObservables();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  private bindObservables() {
    this.runAsapOutsideAngular(() => {
      const kaart = this.maakKaart();

      this.destroying$.leaveZone(this.zone).subscribe(_ => {
        console.log("kaart opkuisen");
        kaart.map.setTarget(null);
      });

      this.kaartEvt$
        .leaveZone(this.zone)
        .scan(red.kaartReducer, kaart)
        .subscribe(x => console.log("reduced", x), e => console.log("error", e), () => console.log("kaart & cmd terminated"));
    });
  }

  private maakKaart(): KaartWithInfo {
    const dienstkaartProjectie: ol.proj.Projection = ol.proj.get("EPSG:31370");
    // Zonder deze extent zoomen we op de hele wereld en Vlaanderen is daar maar een heeel klein deeltje van
    dienstkaartProjectie.setExtent([18000.0, 152999.75, 280144.0, 415143.75]); // zet de extent op die van de dienstkaart

    const map = new ol.Map({
      controls: [],
      interactions: [],
      layers: [],
      pixelRatio: 1, // dit moet op 1 staan anders zal OL 512x512 tiles ophalen op retina displays en die zitten niet in onze geowebcache
      target: this.mapElement.nativeElement,
      logo: false,
      view: new ol.View({
        projection: dienstkaartProjectie,
        center: this.config.defaults.middelpunt,
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
        zoom: this.config.defaults.zoom
      })
    });
    return new KaartWithInfo(this.config, this.naam, this.mapElement.nativeElement.parentElement, map);
  }
}
