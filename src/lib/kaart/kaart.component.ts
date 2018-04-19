import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/never";
import "rxjs/add/observable/of";

import { Component, ElementRef, Inject, Input, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from "@angular/core";
import * as ol from "openlayers";
import proj4 from "proj4";
import { ReplaySubject } from "rxjs";
import { Observable } from "rxjs/Observable";
import { filter, map, merge, scan, shareReplay, takeUntil, tap } from "rxjs/operators";

import { asap } from "../util/asap";
import { observerOutsideAngular } from "../util/observer-outside-angular";
import { emitSome } from "../util/operators";
import { forEach } from "../util/option";
import { KaartComponentBase } from "./kaart-component-base";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as red from "./kaart-reducer";
import { KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";

// Om enkel met @Input properties te moeten werken. Op deze manier kan een stream van KaartMsg naar de caller gestuurd worden
export type KaartMsgObservableConsumer = (msg$: Observable<prt.KaartMsg>) => void;
export const vacuousKaartMsgObservableConsumer: KaartMsgObservableConsumer = (msg$: Observable<prt.KaartMsg>) => ({});

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["../../../node_modules/openlayers/css/ol.css", "./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Emulated // Omwille hiervan kunnen we geen globale CSS gebruiken, maar met Native werken animaties niet
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy {
  // noinspection JSUnusedLocalSymbols
  private static readonly lambert72 = KaartComponent.configureerLambert72();
  kaartModel$: Observable<KaartWithInfo> = Observable.empty();

  @ViewChild("map") mapElement: ElementRef;

  /**
   * Dit houdt heel de constructie bij elkaar. Ofwel awv-kaart-classic (in geval van declaratief gebruik) ofwel
   * een component van de gebruikende applicatie (in geval van programmatorisch gebruik) zet hier een Observable
   * waarmee events naar de component gestuurd kunnen worden.
   */
  @Input() kaartCmd$: Observable<prt.Command<prt.KaartMsg>> = Observable.empty();
  @Input() messageObsConsumer: KaartMsgObservableConsumer = vacuousKaartMsgObservableConsumer;

  /**
   * Dit is een beetje ongelukkig, maar ook componenten die door de KaartComponent zelf aangemaakt worden moeten events kunnen sturen
   * naar de KaartComponent. Een alternatief zou kunnen zijn één dispatcher hier te maken en de KaartClassicComponent die te laten
   * ophalen in afterViewInit.
   */
  readonly internalCmdDispatcher: ReplaySubjectKaartCmdDispatcher<KaartInternalMsg> = new ReplaySubjectKaartCmdDispatcher();

  private readonly msgSubj = new ReplaySubject<prt.KaartMsg>(1000, 500);

  @Input() minZoom = 2; // TODO naar config
  @Input() maxZoom = 15; // TODO naar config
  @Input() naam = "kaart";
  @Input() selectieModus: prt.SelectieModus = "none";

  // Dit dient om messages naar toe te sturen

  internalMessage$: Observable<KaartInternalSubMsg> = Observable.empty();

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
    this.internalMessage$ = this.msgSubj.pipe(
      filter(m => m.type === "KaartInternal"), //
      map(m => (m as KaartInternalMsg).payload),
      emitSome,
      tap(m => kaartLogger.debug("een interne message werd ontvangen:", m)),
      shareReplay(1)
    );
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
      // Initialiseer the model
      const initieelModel = this.initieelModel();
      kaartLogger.info(`Kaart ${this.naam} aangemaakt`);

      // Wanneer de destroying observable emit, maw wanneer de component aan het afsluiten is, dan kuisen we ook
      // de openlayers kaart op.
      // noinspection JSUnusedLocalSymbols
      this.destroying$.pipe(observerOutsideAngular(this.zone)).subscribe(_ => {
        kaartLogger.info(`kaart ${this.naam} opkuisen`);
        initieelModel.map.setTarget((undefined as any) as string); // Hack omdat openlayers typedefs kaduuk zijn
      });

      const messageConsumer = (msg: prt.KaartMsg) => {
        asap(() => this.msgSubj.next(msg));
      };

      this.kaartModel$ = this.kaartCmd$.pipe(
        merge(this.internalCmdDispatcher.commands$),
        tap(c => kaartLogger.debug("kaart command", c)),
        takeUntil(this.destroying$),
        observerOutsideAngular(this.zone),
        scan((model: KaartWithInfo, cmd: prt.Command<any>) => {
          const { model: newModel, message } = red.kaartCmdReducer(cmd)(model, messageConsumer);
          kaartLogger.debug("produceert", message);
          forEach(message, messageConsumer); // stuur het resultaat terug naar de eigenaar van de kaartcomponent
          return newModel; // en laat het nieuwe model terugvloeien
        }, initieelModel),
        shareReplay(1)
      );

      // subscribe op het model om de zaak aan gang te zwengelen
      this.kaartModel$.subscribe(
        model => {
          kaartLogger.debug("reduced to", model);
          // TODO dubbels opvangen (zie versie). Als we een versienummer ophogen telkens we effectief het model aanpassen, dan kunnen we
          // de modelConsumer werk besparen in die gevallen dat de reducer geen nieuwe toestand heeft gegenereerd.
          // this.modelConsumer(model); // Heel belangrijk: laat diegene die ons embed weten wat het huidige model is.
        },
        e => kaartLogger.error("error", e),
        () => kaartLogger.info("kaart & cmd terminated")
      );

      // Zorg ervoor dat wie de messageObsConsumer @Input gezet heeft een observable van messages krijgt
      this.messageObsConsumer(this.msgSubj);
    });
  }

  private initieelModel(): KaartWithInfo {
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

  get message$(): Observable<prt.KaartMsg> {
    return this.msgSubj;
  }
}
