import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation, Inject, Output } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";
import "rxjs/add/observable/of";
import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/never";
import { scan, map, tap, distinctUntilChanged, filter, shareReplay, merge, combineLatest } from "rxjs/operators";

import proj4 from "proj4";
import * as ol from "openlayers";

import { KaartConfig, KAART_CFG } from "./kaart.config";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartWithInfo } from "./kaart-with-info";
import { leaveZone } from "../util/leave-zone";
import { terminateOnDestroyAndRunAsapOutsideOfAngular } from "../util/observable-run";
import { kaartLogger } from "./log";
import * as prt from "./kaart-protocol";
import * as red from "./kaart-reducer";

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Emulated // Omwille hiervan kunnen we geen globale CSS gebruiken, maar met Native werken animaties niet
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private static readonly lambert72 = KaartComponent.configureerLambert72();

  @ViewChild("map") mapElement: ElementRef;

  /**
   * Dit houdt heel de constructie bij elkaar. Ofwel awv-kaart-classic (in geval van declaratief gebruik) ofwel
   * een component van de gebruikende applicatie (in geval van programmatorisch gebruik) zet hier een Observable
   * waarmee events naar de component gestuurd kunnen worden.
   */
  @Input() kaartEvt$: Observable<prt.KaartEvnt> = Observable.empty();

  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 13; // TODO naar config
  @Input() naam = "kaart";

  @Input() achtergrondTitelSelectieConsumer: prt.ModelConsumer<string> = prt.noOpModelConsumer;
  @Input() modelConsumer: prt.ModelConsumer<KaartWithInfo> = prt.noOpModelConsumer;

  showBackgroundSelector$: Observable<boolean> = Observable.empty();
  kaartModel$: Observable<KaartWithInfo> = Observable.empty();

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
    console.log("binding observables");
    this.runAsapOutsideAngular(() => {
      const kaart = this.maakKaart();
      kaartLogger.info(`Kaart ${this.naam} aangemaakt`);

      this.destroying$.pipe(leaveZone(this.zone)).subscribe(_ => {
        kaartLogger.info(`kaart ${this.naam} opkuisen`);
        kaart.map.setTarget(null);
      });

      this.kaartModel$ = this.kaartEvt$.pipe(
        tap(x => kaartLogger.debug("kaart event", x)),
        leaveZone(this.zone), //
        scan(red.kaartReducer, kaart), // TODO: zorg er voor dat de unsubscribe gebeurt
        shareReplay(1000, 5000)
      );
      console.log("kaart model obs is gemaakt");

      this.kaartModel$
        .pipe(
          map(model => model.lagen.get(0)), // dit geeft undefined als er geen lagen zijn
          filter(laag => !!laag), // misschien zijn er geen lagen, hou rekening met undefined
          distinctUntilChanged() // de meeste modelwijzigingen hebben niks met de onderste laag te maken
        )
        .subscribe(laag => this.achtergrondTitelSelectieConsumer(laag.titel));

      this.kaartModel$.subscribe(
        model => {
          kaartLogger.debug("reduced to", model);
          //this.modelConsumer(model); // Heel belangrijk: laat diegene die ons embed weten wat het huidige model is
        },
        e => kaartLogger.error("error", e),
        () => kaartLogger.info("kaart & cmd terminated")
      );

      // Deze zorgt er voor dat de achtergrondselectieknop getoond wordt obv het model
      this.showBackgroundSelector$ = this.kaartModel$.pipe(map(k => k.showBackgroundSelector), distinctUntilChanged());
    });
  }

  private maakKaart(): KaartWithInfo {
    const dienstkaartProjectie: ol.proj.Projection = ol.proj.get("EPSG:31370");
    // Zonder deze extent zoomen we op de hele wereld en Vlaanderen is daar maar een heeel klein deeltje van
    dienstkaartProjectie.setExtent([18000.0, 152999.75, 280144.0, 415143.75]); // zet de extent op die van de dienstkaart

    const kaart = new ol.Map({
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
    return new KaartWithInfo(this.config, this.naam, this.mapElement.nativeElement.parentElement, kaart);
  }
}
