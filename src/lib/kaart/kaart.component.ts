import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from "@angular/core";
import { Set } from "immutable";
import * as ol from "openlayers";
import { ReplaySubject } from "rxjs";
import "rxjs/add/observable/combineLatest";
import "rxjs/add/observable/empty";
import "rxjs/add/observable/never";
import "rxjs/add/observable/of";
import { Observable } from "rxjs/Observable";
import { delay, filter, last, map, merge, scan, shareReplay, startWith, switchMap, takeUntil, tap } from "rxjs/operators";

import { asap } from "../util/asap";
import { observeOnAngular } from "../util/observe-on-angular";
import { observeOutsideAngular } from "../util/observer-outside-angular";
import { emitSome, ofType } from "../util/operators";
import { forEach } from "../util/option";

import { KaartComponentBase } from "./kaart-component-base";
import { KAART_CFG, KaartConfig } from "./kaart-config";
import { ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import { InfoBoodschappenMsg, KaartInternalMsg, KaartInternalSubMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as red from "./kaart-reducer";
import { cleanup, KaartWithInfo } from "./kaart-with-info";
import { kaartLogger } from "./log";
import { ModelChanger, ModelChanges, modelChanges, UiElementSelectie } from "./model-changes";

// Om enkel met @Input properties te moeten werken. Op deze manier kan een stream van KaartMsg naar de caller gestuurd worden
export type KaartMsgObservableConsumer = (msg$: Observable<prt.KaartMsg>) => void;
export const vacuousKaartMsgObservableConsumer: KaartMsgObservableConsumer = () => ({});

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Emulated // Omwille hiervan kunnen we geen globale CSS gebruiken, maar met Native werken animaties niet
})
export class KaartComponent extends KaartComponentBase implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {
  kaartLinksZichtbaar: boolean;
  kaartLinksToggleZichtbaar: boolean;
  kaartLinksScrollbarZichtbaar: boolean;
  kaartLinksRefreshWeergaveBezig: boolean;
  private readonly modelChanger: ModelChanger = ModelChanger();
  private innerModelChanges: ModelChanges;
  private innerAanwezigeElementen$: Observable<Set<string>>;
  readonly kaartModel$: Observable<KaartWithInfo> = Observable.empty();

  @ViewChild("map") mapElement: ElementRef;
  @ViewChild("kaartLinks") kaartLinksElement: ElementRef;
  @ViewChild("kaartFixedLinksBoven") kaartFixedLinksBovenElement: ElementRef;

  /**
   * Dit houdt heel de constructie bij elkaar. Ofwel awv-kaart-classic (in geval van declaratief gebruik) ofwel
   * een component van de gebruikende applicatie (in geval van programmatorisch gebruik) zet hier een Observable
   * waarmee events naar de component gestuurd kunnen worden.
   */
  @Input() kaartCmd$: Observable<prt.Command<prt.KaartMsg>> = Observable.empty();
  /**
   * Hier wordt een callback verwacht die een Msg observable zal krijgen. Die observable kan dan gebruikt worden
   * op te luisteren op feedback van commands of uitvoer van subscriptions.
   */
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
  @Input() hoverModus: prt.HoverModus = "off";

  // Dit dient om messages naar toe te sturen

  internalMessage$: Observable<KaartInternalSubMsg> = Observable.empty();

  constructor(@Inject(KAART_CFG) readonly config: KaartConfig, zone: NgZone) {
    super(zone);
    this.kaartLinksZichtbaar = true;
    this.kaartLinksToggleZichtbaar = false;
    this.kaartLinksScrollbarZichtbaar = false;
    this.internalMessage$ = this.msgSubj.pipe(
      filter(m => m.type === "KaartInternal"), //
      map(m => (m as KaartInternalMsg).payload),
      emitSome,
      tap(m => kaartLogger.debug("een interne message werd ontvangen:", m)),
      shareReplay(1) // Waarom hebben we eigenlijk het vorige commando nog nodig?
    );

    this.kaartModel$ = this.initialising$.pipe(
      observeOutsideAngular(zone),
      tap(() => this.messageObsConsumer(this.msgSubj)), // Wie de messageObsConsumer @Input gezet heeft, krijgt een observable van messages
      map(() => this.initieelModel()),
      tap(model => {
        this.innerModelChanges = modelChanges(model, this.modelChanger);
        this.innerAanwezigeElementen$ = this.modelChanges.uiElementSelectie$.pipe(
          scan((st: Set<string>, selectie: UiElementSelectie) => (selectie.aan ? st.add(selectie.naam) : st.delete(selectie.naam)), Set()),
          startWith(Set())
        );
      }),
      switchMap(model => this.createMapModelForCommands(model)),
      shareReplay(1)
    );

    this.kaartModel$.subscribe(
      model => {
        kaartLogger.debug("reduced to", model);
        // TODO dubbels opvangen. Als we een versienummer ophogen telkens we effectief het model aanpassen, dan kunnen we
        // de modelConsumer werk besparen in die gevallen dat de reducer geen nieuwe toestand heeft gegenereerd.
      },
      e => kaartLogger.error("error", e),
      () => kaartLogger.info("kaart & cmd terminated")
    );

    // Het laatste model is dat net voor de stream van model unsubscribed is, dus bij ngOnDestroy
    this.kaartModel$.pipe(last()).subscribe(model => {
      kaartLogger.info(`kaart '${this.naam}' opkuisen`);
      cleanup(model);
    });

    // Linker paneel zichtbaar maken als de infoboodschappen wijzigen.
    this.internalMessage$.pipe(ofType<InfoBoodschappenMsg>("InfoBoodschappen"), observeOnAngular(this.zone)).subscribe(msg => {
      this.kaartLinksZichtbaar = true;
    });
  }

  private createMapModelForCommands(initieelModel: KaartWithInfo): Observable<KaartWithInfo> {
    kaartLogger.info(`Kaart '${this.naam}' aangemaakt`);

    const messageConsumer = (msg: prt.KaartMsg) => {
      asap(() => this.msgSubj.next(msg));
    };

    return this.kaartCmd$.pipe(
      merge(this.internalCmdDispatcher.commands$),
      tap(c => kaartLogger.debug("kaart command", c)),
      takeUntil(this.destroying$.pipe(delay(100))), // Een klein beetje extra tijd voor de cleanup commands
      observeOutsideAngular(this.zone),
      scan((model: KaartWithInfo, cmd: prt.Command<any>) => {
        const { model: newModel, message } = red.kaartCmdReducer(cmd)(model, this.modelChanger, this.modelChanges, messageConsumer);
        kaartLogger.debug("produceert", message);
        forEach(message, messageConsumer); // stuur het resultaat terug naar de eigenaar van de kaartcomponent
        return newModel; // en laat het nieuwe model terugvloeien
      }, initieelModel)
    );
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

    return new KaartWithInfo(this.config, this.naam, this.mapElement.nativeElement.parentElement, kaart, this.modelChanger);
  }

  get modelChanges(): ModelChanges {
    return this.innerModelChanges;
  }

  get aanwezigeElementen$(): Observable<Set<string>> {
    return this.innerAanwezigeElementen$;
  }

  ngAfterViewInit() {
    this.kaartLinksRefreshWeergaveBezig = false;
    this.bepaalKaartLinksMarginTopEnMaxHeight();
    this.bepaalKaartLinksToggleZichtbaar();
    this.kaartLinksScrollbarZichtbaar = this.isKaartLinksScrollbarNodig();
  }

  bepaalKaartLinksMarginTopEnMaxHeight() {
    setTimeout(() => {
      // MarginTop correctie als de scrollbar verschijnt/verdwijnt
      this.kaartLinksElement.nativeElement.style.marginTop = this.kaartFixedLinksBovenElement.nativeElement.clientHeight + "px";
      // Als er een fixed header is bovenaan links moet de max-height van kaart-links daar ook rekening mee houden.
      this.kaartLinksElement.nativeElement.style.maxHeight =
        "calc(100% - " + this.kaartFixedLinksBovenElement.nativeElement.clientHeight + "px - 8px)"; // -8px is van padding-top.
    }, 10);
  }

  bepaalKaartLinksToggleZichtbaar() {
    // Toggle pas tonen vanaf 40px hoogte.
    setTimeout(() => {
      this.kaartLinksToggleZichtbaar =
        this.kaartFixedLinksBovenElement.nativeElement.clientHeight + this.kaartLinksElement.nativeElement.clientHeight >= 40;
    }, 10);
  }

  ngAfterViewChecked() {
    if (!this.kaartLinksRefreshWeergaveBezig) {
      this.refreshKaartLinksWeergave();
    }
  }

  refreshKaartLinksWeergave() {
    // Om te vermijden dat er teveel refreshes gedaan worden en te wachten tot de animaties klaar zijn zit deze code in een timeout
    this.kaartLinksRefreshWeergaveBezig = true;
    setTimeout(() => {
      this.kaartLinksScrollbarZichtbaar = this.isKaartLinksScrollbarNodig();
      this.bepaalKaartLinksMarginTopEnMaxHeight();
      this.kaartLinksRefreshWeergaveBezig = false;
    }, 750);
  }

  isKaartLinksScrollbarNodig(): boolean {
    return this.kaartLinksElement.nativeElement.scrollHeight > this.kaartLinksElement.nativeElement.clientHeight;
  }

  toggleKaartLinks() {
    this.kaartLinksZichtbaar = !this.kaartLinksZichtbaar;
  }
}
