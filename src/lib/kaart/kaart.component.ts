import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
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
import "rxjs/add/operator/shareReplay";
import { asap } from "rxjs/scheduler/asap";
import { List, Map } from "immutable";

import * as ol from "openlayers";

import { KaartConfig } from "./kaart.config";
import { CoordinatenService } from "./coordinaten.service";
import { KaartComponentBase } from "./kaart-component-base";
import { Scheduler } from "rxjs/Scheduler";
import { KaartWithInfo } from "./kaart-with-info";
import "../util/leave-zone";
import "../util/observable-run";
import * as ke from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import * as red from "./kaart-reducer";

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Native
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @ViewChild("map") mapElement: ElementRef;

  @Input() kaartEvt$: Observable<prt.KaartEvnt> = Observable.empty();

  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 13; // TODO naar config
  @Input() naam = "kaart";

  constructor(readonly config: KaartConfig, zone: NgZone, private coordinatenService: CoordinatenService) {
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
    // We willen de kaart in een observable zodat we veilig kunnen combineren, maar we willen ook dat de observable open blijft
    // want als de kaart observable afgesloten zou worden, dan zouden ook de combinaties afgesloten worden.
    const kaart$: Observable<KaartWithInfo> = Observable.of([]) // er is geen unit in TS
      .observeOn(asap)
      .leaveZone(this.zone)
      .map(_ => this.maakKaart()) // maak een kaart obv middelpunt en zoom
      .concat(Observable.never<KaartWithInfo>())
      .shareReplay(); // alle toekomstige subscribers krijgen de ene kaart

    Observable.combineLatest(kaart$, this.destroying$)
      .map(([kaart, _]) => kaart)
      .observeOn(asap)
      .leaveZone(this.zone)
      .subscribe(k => {
        console.log("Kaart opkuisen", k);
        k.map.setTarget(null);
      });

    kaart$
      .switchMap(kaart => this.kaartEvt$.reduce(red.kaartReducer, kaart))
      .subscribe(x => console.log("reduced", x), e => console.log("error", e), () => console.log("kaart & cmd terminated"));
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
