import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import { Observable } from "rxjs/Observable";
import "rxjs/add/observable/of";
import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/never";
import "rxjs/add/operator/concat";
import "rxjs/add/operator/first";
import "rxjs/add/operator/let";
import "rxjs/add/operator/map";
import "rxjs/add/operator/observeOn";
import "rxjs/add/operator/shareReplay";
import { asap } from "rxjs/scheduler/asap";

import * as _ from "lodash";
import * as ol from "openlayers";

import { KaartConfig } from "./kaart.config";
import { CoordinatenService } from "./coordinaten.service";
import { KaartComponentBase } from "./kaart-component-base";
import { Scheduler } from "rxjs/Scheduler";
import "../util/leave-zone";
import "../util/observable-run";

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Native
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @ViewChild("map") mapElement: ElementRef;

  @Input() zoom$ = Observable.of(2);
  @Input() middelpunt$: Observable<ol.Coordinate> = Observable.of<ol.Coordinate>([130000, 184000]);
  @Input() extent$: Observable<ol.Extent> = Observable.empty();
  @Input() viewportSize$: Observable<ol.Size> = Observable.of<ol.Size>([undefined, 400]); // std volledige breedte en 400 px hoog
  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 13; // TODO naar config

  private kaart: ol.Map; // we kunnen dit ook een Observable laten zijn, maar het sop is de kool niet waard

  constructor(@Input() public config: KaartConfig, zone: NgZone, private coordinatenService: CoordinatenService) {
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
    const kaart$ = Observable.combineLatest(this.middelpunt$, this.zoom$, this.viewportSize$)
      .observeOn(asap)
      .leaveZone(this.zone)
      .first() // we willen maar 1 kaart, dus maar 1 middelpunt transformeren
      .map(([middel, zoom, size]) => this.maakKaart(middel, zoom, size)) // maak een kaart obv middelpunt en zoom
      .do(kaart => (this.kaart = kaart))
      .shareReplay(); // alle toekomstige subscribers krijgen de ene kaart

    Observable.combineLatest(kaart$, this.destroying)
      .map(([kaart, x]) => kaart)
      .observeOn(asap)
      .leaveZone(this.zone)
      .subscribe(k => {
        console.log("Kaart opkuisen", k);
        k.setTarget(null);
      });

    Observable.combineLatest(kaart$, this.middelpunt$, this.zoom$)
      .terminateOnDestroyAndRunAsapOutsideOfAngular(this.zone, this.destroying)
      .subscribe(([kaart, middelpunt, zoom]) => this.updateMiddelpuntAndZoom(kaart, middelpunt, zoom));

    Observable.combineLatest(kaart$, this.extent$)
      .terminateOnDestroyAndRunAsapOutsideOfAngular(this.zone, this.destroying)
      .subscribe(([kaart, extent]) => this.updateExtent(kaart, extent));

    Observable.combineLatest(kaart$, this.viewportSize$)
      .terminateOnDestroyAndRunAsapOutsideOfAngular(this.zone, this.destroying)
      .subscribe(([kaart, size]) => this.updateSize(kaart, size));
  }

  private updateMiddelpuntAndZoom(kaart: ol.Map, middelpunt: ol.Coordinate, zoom: number) {
    kaart.getView().setCenter(middelpunt);
    kaart.getView().setZoom(zoom);
  }

  private updateExtent(kaart: ol.Map, extent: ol.Extent) {
    kaart.getView().fit(extent);
    // TODO publish ol.extent.getCenter(extent) to service
  }

  private updateSize(kaart: ol.Map, size: ol.Size) {
    // rechstreeks manipulatie van DOM omdat we hier buiten de Angular zitten
    this.mapElement.nativeElement.parentElement.style.height = `${size[1]}px`;
    kaart.setSize(size);
    kaart.updateSize(); // ingeval een dimensie undefined is
  }

  private maakKaart(middelpunt: ol.Coordinate, zoom: number, size: ol.Size): ol.Map {
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
        center: middelpunt,
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
        zoom: zoom
      })
    });
    console.log("De grootte zetten op", size);
    map.setSize(size);
    return map;
  }
}
