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

  @Input() zoom$ = Observable.of(2);
  @Input() extent$: Observable<ol.Extent> = Observable.empty();
  @Input() viewportSize$: Observable<ol.Size> = Observable.of<ol.Size>([undefined, 400]); // std volledige breedte en 400 px hoog
  @Input() kaartEvt$: Observable<prt.KaartEvnt> = Observable.empty(); // TODO de commandos moeten in 1 observable komen

  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 13; // TODO naar config

  private kaart: ol.Map; // we kunnen dit ook een Observable laten zijn, maar het sop is de kool niet waard

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

  voegLaagToe(laag: ol.layer.Layer) {
    this.voegLagenToe([laag]);
  }

  voegLagenToe(lagen: ol.layer.Layer[]) {
    this.runAsapOutsideAngular(() => lagen.forEach(l => this.kaart.addLayer(l)));
  }

  verwijderLaag(laag: ol.layer.Layer) {
    this.verwijderLagen([laag]);
  }

  verwijderLagen(lagen: ol.layer.Layer[]) {
    this.runAsapOutsideAngular(() => lagen.forEach(l => this.kaart.removeLayer(l)));
  }

  voegControlToe(control: ol.control.Control): ol.control.Control {
    return this.voegControlsToe([control])[0];
  }

  voegControlsToe(controls: ol.control.Control[]): ol.control.Control[] {
    this.runAsapOutsideAngular(() => controls.forEach(c => this.kaart.addControl(c)));
    return controls;
  }

  verwijderControl(control: ol.control.Control) {
    this.verwijderControls([control]);
  }

  verwijderControls(controls: ol.control.Control[]) {
    this.runAsapOutsideAngular(() => controls.forEach(c => this.kaart.removeControl(c)));
  }

  voegInteractionToe(interaction: ol.interaction.Interaction): ol.interaction.Interaction {
    return this.voegInteractionsToe([interaction])[0];
  }

  voegInteractionsToe(interactions: ol.interaction.Interaction[]): ol.interaction.Interaction[] {
    this.runAsapOutsideAngular(() => interactions.forEach(i => this.kaart.addInteraction(i)));
    return interactions;
  }

  verwijderInteraction(interaction: ol.interaction.Interaction) {
    this.verwijderInteractions([interaction]);
  }

  verwijderInteractions(interactions: ol.interaction.Interaction[]) {
    this.runAsapOutsideAngular(() => interactions.forEach(i => this.kaart.removeInteraction(i)));
  }

  private bindObservables() {
    // We willen de kaart in een observable zodat we veilig kunnen combineren, maar we willen ook dat de observable open blijft
    // want als de kaart observable afgesloten zou worden, dan zouden ook de combinaties afgesloten worden.
    const kaart$ = Observable.combineLatest(this.zoom$, this.viewportSize$)
      .observeOn(asap)
      .leaveZone(this.zone)
      .first() // we willen maar 1 kaart, dus maar 1 middelpunt transformeren
      .map(([zoom, size]) => this.maakKaart(zoom, size)) // maak een kaart obv middelpunt en zoom
      .concat(Observable.never<ol.Map>())
      .do(kaart => (this.kaart = kaart)) // TODO dit mag weg wanneer we volledig met observables werken
      .shareReplay(); // alle toekomstige subscribers krijgen de ene kaart

    Observable.combineLatest(kaart$, this.destroying)
      .map(([kaart, x]) => kaart)
      .observeOn(asap)
      .leaveZone(this.zone)
      .subscribe(k => {
        console.log("Kaart opkuisen", k);
        k.setTarget(null);
      });

    Observable.combineLatest(kaart$, this.extent$)
      .do(x => console.log("extent$", x))
      .terminateOnDestroyAndRunAsapOutsideOfAngular(this.zone, this.destroying)
      .subscribe(([kaart, extent]) => this.updateExtent(kaart, extent));

    Observable.combineLatest(kaart$, this.viewportSize$)
      .terminateOnDestroyAndRunAsapOutsideOfAngular(this.zone, this.destroying)
      .subscribe(([kaart, size]) => this.updateSize(kaart, size));

    kaart$
      .switchMap(kaart => this.kaartEvt$.reduce(red.kaartReducer, new KaartWithInfo(this.config, kaart)))
      .subscribe(x => console.log("reduced", x), e => console.log("error", e), () => console.log("kaart & cmd terminated"));
  }

  private updateMiddelpuntAndZoom(kaart: ol.Map, middelpunt: ol.Coordinate, zoom: number) {
    kaart.getView().setCenter(middelpunt);
    kaart.getView().setZoom(zoom);
  }

  private updateExtent(kaart: ol.Map, extent: ol.Extent) {
    console.log("update extent", extent);
    // kaart.getView().fit(extent);
    // TODO publish ol.extent.getCenter(extent) to service
  }

  private updateSize(kaart: ol.Map, size: ol.Size) {
    // rechstreekse manipulatie van DOM omdat we hier buiten de Angular zone zitten
    this.mapElement.nativeElement.parentElement.style.height = `${size[1]}px`;
    kaart.setSize(size);
    kaart.updateSize(); // ingeval een dimensie undefined is
  }

  private maakKaart(zoom: number, size: ol.Size): ol.Map {
    const dienstkaartProjectie: ol.proj.Projection = ol.proj.get("EPSG:31370");
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
        zoom: zoom
      })
    });
    map.setSize(size);
    return map;
  }
}
