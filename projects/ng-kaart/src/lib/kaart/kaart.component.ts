import { Component, ElementRef, Inject, Input, NgZone, ViewChild, ViewEncapsulation } from "@angular/core";
import * as MobileDetect from "mobile-detect/mobile-detect";
import * as ol from "openlayers";
import * as rx from "rxjs";
import {
  debounceTime,
  delay,
  distinctUntilChanged,
  filter,
  last,
  map,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap
} from "rxjs/operators";

import { isNonEmpty } from "../util/arrays";
import { asap } from "../util/asap";
import * as maps from "../util/maps";
import { observeOnAngular } from "../util/observe-on-angular";
import { observeOutsideAngular } from "../util/observer-outside-angular";
import { catOptions, ofType } from "../util/operators";
import { forEach } from "../util/option";
import { resizeObservable } from "../util/resize-observable";
import * as sets from "../util/sets";

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
export type KaartMsgObservableConsumer = (msg$: rx.Observable<prt.KaartMsg>) => void;
export const vacuousKaartMsgObservableConsumer: KaartMsgObservableConsumer = () => ({});

@Component({
  selector: "awv-kaart",
  templateUrl: "./kaart.component.html",
  styleUrls: ["./kaart.component.scss"],
  encapsulation: ViewEncapsulation.Emulated // Omwille hiervan kunnen we geen globale CSS gebruiken, maar met Native werken animaties niet
})
export class KaartComponent extends KaartComponentBase {
  kaartLinksZichtbaar = true;
  kaartLinksToggleZichtbaar = false;
  kaartLinksScrollbarZichtbaar = false;
  private readonly modelChanger: ModelChanger = ModelChanger();
  private innerModelChanges: ModelChanges;
  private innerAanwezigeElementen$: rx.Observable<Set<string>>;
  readonly kaartModel$: rx.Observable<KaartWithInfo> = rx.EMPTY;
  private readonly resizeCommand$: rx.Observable<prt.VeranderViewportCmd>;

  @ViewChild("map")
  mapElement: ElementRef;
  @ViewChild("kaartLinks")
  kaartLinksElement: ElementRef;
  @ViewChild("kaartFixedLinksBoven")
  kaartFixedLinksBovenElement: ElementRef;
  @ViewChild("kaartLinksZichtbaarToggleKnop", { read: ElementRef })
  kaartLinksZichtbaarToggleKnopElement: ElementRef;

  /**
   * Dit houdt heel de constructie bij elkaar. Ofwel awv-kaart-classic (in geval van declaratief gebruik) ofwel
   * een component van de gebruikende applicatie (in geval van programmatorisch gebruik) zet hier een Observable
   * waarmee events naar de component gestuurd kunnen worden.
   */
  @Input()
  kaartCmd$: rx.Observable<prt.Command<prt.KaartMsg>> = rx.EMPTY;
  /**
   * Hier wordt een callback verwacht die een Msg observable zal krijgen. Die observable kan dan gebruikt worden
   * op te luisteren op feedback van commands of uitvoer van subscriptions.
   */
  @Input()
  messageObsConsumer: KaartMsgObservableConsumer = vacuousKaartMsgObservableConsumer;

  /**
   * Dit is een beetje ongelukkig, maar ook componenten die door de KaartComponent zelf aangemaakt worden moeten events kunnen sturen
   * naar de KaartComponent. Een alternatief zou kunnen zijn één dispatcher hier te maken en de KaartClassicComponent die te laten
   * ophalen in afterViewInit.
   */
  readonly internalCmdDispatcher: ReplaySubjectKaartCmdDispatcher<KaartInternalMsg> = new ReplaySubjectKaartCmdDispatcher();

  private readonly msgSubj = new rx.ReplaySubject<prt.KaartMsg>(1000, 500);

  @Input()
  minZoom = 2; // TODO naar config
  @Input()
  maxZoom = 15; // TODO naar config
  @Input()
  naam = "kaart";
  @Input()
  kaartLinksBreedte;

  readonly moveTolerance = new MobileDetect(window.navigator.userAgent).mobile() ? 40 : 1; // 1 is default

  // Dit dient om messages naar toe te sturen
  internalMessage$: rx.Observable<KaartInternalSubMsg> = rx.EMPTY;

  constructor(@Inject(KAART_CFG) readonly config: KaartConfig, zone: NgZone) {
    super(zone);
    this.internalMessage$ = this.msgSubj.pipe(
      filter(m => m.type === "KaartInternal"), //
      map(m => (m as KaartInternalMsg).payload),
      catOptions,
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
          scan(
            (st: Set<string>, selectie: UiElementSelectie) => (selectie.aan ? st.add(selectie.naam) : sets.removeSimple(st)(selectie.naam)),
            new Set<string>([])
          ),
          startWith(new Set<string>())
        );
      }),
      switchMap(model => this.createMapModelForCommands(model)),
      takeUntil(this.destroying$),
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

    // Het laatste model is dit dat net voor de stream van model unsubscribed is, dus bij ngOnDestroy
    this.kaartModel$.pipe(last()).subscribe(model => {
      kaartLogger.info(`kaart '${this.naam}' opkuisen`);
      cleanup(model);
    });

    // Linker paneel zichtbaar maken wanneer er minstens 1 infoboodschap is.
    this.internalMessage$
      .pipe(
        ofType<InfoBoodschappenMsg>("InfoBoodschappen"),
        observeOnAngular(this.zone)
      )
      .subscribe(msg => {
        if (maps.isNonEmpty(msg.infoBoodschappen)) {
          this.kaartLinksZichtbaar = true;
        }
      });

    // Observeer veranderingen aan de grootte van het linker paneel mbv browser events
    this.bindToLifeCycle(
      this.viewReady$.pipe(
        observeOutsideAngular(this.zone),
        switchMap(() => resizeObservable(this.kaartLinksElement.nativeElement, this.kaartFixedLinksBovenElement.nativeElement)),
        debounceTime(150), // het is voldoende om weten dat er onlangs iets aangepast is
        observeOnAngular(this.zone)
      )
    ).subscribe(() => this.pasKaartLinksWeergaveAan());
    this.viewReady$.pipe(delay(10)).subscribe(() => this.bepaalKaartLinksInitieelZichtbaar()); // waarom is delay nodig?

    // Angular heeft niet altijd door dat een van variabelen die we gebruiken voor het bepalen van de zichtbaarheid van
    // de scrollbar en inklapknop aangepast zijn.
    this.viewReady$
      .pipe(
        observeOutsideAngular(this.zone),
        switchMap(() => rx.timer(100, 100)),
        map(() => this.kaartLinksElement.nativeElement.scrollHeight > this.kaartLinksElement.nativeElement.clientHeight),
        distinctUntilChanged(),
        debounceTime(200), // Blijkbaar is direct na de verandering nog wat te vroeg
        take(2)
      )
      .subscribe(() => this.pasKaartLinksWeergaveAan());

    // Het kan gebeuren dat de container waar wij ons in bevinden een andere grootte krijgt. In dat geval moeten we dat laten weten aan OL.
    // We hebben geen subject waar we commands kunnen naar toe sturen (en dat willen we ook niet), dus gebruiken we een observable die we
    // mergen met de externe en interne componentcommandos.
    this.resizeCommand$ = this.viewReady$.pipe(
      observeOutsideAngular(this.zone),
      switchMap(() => resizeObservable(this.mapElement.nativeElement)),
      debounceTime(200), // resize events komen heel vlug
      filter(isNonEmpty),
      map(entries => [entries[0].contentRect.width, entries[0].contentRect.height] as ol.Size),
      map(prt.VeranderViewportCmd)
    );
  }

  private createMapModelForCommands(initieelModel: KaartWithInfo): rx.Observable<KaartWithInfo> {
    kaartLogger.info(`Kaart '${this.naam}' aangemaakt`);

    const messageConsumer = (msg: prt.KaartMsg) => {
      asap(() => this.msgSubj.next(msg));
    };

    return rx.merge(this.kaartCmd$, this.internalCmdDispatcher.commands$, this.resizeCommand$).pipe(
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
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      controls: [],
      interactions: [],
      layers: [],
      pixelRatio: 1, // dit moet op 1 staan anders zal OL 512x512 tiles ophalen op retina displays en die zitten niet in onze geowebcache
      target: this.mapElement.nativeElement,
      logo: false,
      moveTolerance: this.moveTolerance,
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

  get aanwezigeElementen$(): rx.Observable<Set<string>> {
    return this.innerAanwezigeElementen$;
  }

  bepaalKaartLinksMarginTopEnMaxHeight() {
    // MarginTop correctie als de scrollbar verschijnt/verdwijnt
    this.kaartLinksElement.nativeElement.style.marginTop = this.kaartFixedLinksBovenElement.nativeElement.clientHeight + "px";
    // Als er een fixed header is bovenaan links moet de max-height van kaart-links daar ook rekening mee houden.
    this.kaartLinksElement.nativeElement.style.maxHeight =
      "calc(100% - " + this.kaartFixedLinksBovenElement.nativeElement.clientHeight + "px - 8px)"; // -8px is van padding-top.
  }

  bepaalKaartLinksToggleZichtbaar() {
    // Toggle pas tonen vanaf 40px hoogte.
    const nuZichtbaar = this.kaartLinksToggleZichtbaar;
    this.kaartLinksToggleZichtbaar =
      this.kaartFixedLinksBovenElement.nativeElement.clientHeight + this.kaartLinksElement.nativeElement.clientHeight >= 40;
    if (nuZichtbaar !== this.kaartLinksToggleZichtbaar) {
      this.bepaalKaartLinksBreedte(); // Als de toggle eerder niet zichtbaar was kan de breedte fout staan
    }
  }

  bepaalKaartLinksInitieelZichtbaar() {
    this.kaartLinksZichtbaar = this.mapElement.nativeElement.clientWidth > 620;
    this.bepaalKaartLinksBreedte();
  }

  bepaalKaartLinksBreedte() {
    if (!this.kaartLinksBreedte && this.mapElement.nativeElement.clientWidth <= 1240) {
      this.kaartLinksBreedte = 360;
    }
    if (this.kaartLinksBreedte) {
      setTimeout(() => {
        const kaartLinksWidth = this.kaartLinksBreedte + "px";
        this.kaartFixedLinksBovenElement.nativeElement.style.width = kaartLinksWidth;
        this.kaartLinksElement.nativeElement.style.width = kaartLinksWidth;
        if (this.kaartLinksToggleZichtbaar && this.kaartLinksZichtbaarToggleKnopElement) {
          if (this.kaartLinksZichtbaar) {
            this.kaartLinksZichtbaarToggleKnopElement.nativeElement.style.left = kaartLinksWidth;
          } else {
            this.kaartLinksZichtbaarToggleKnopElement.nativeElement.style.left = "0";
          }
        }
      }, 10);
    }
  }

  pasKaartLinksWeergaveAan() {
    this.kaartLinksScrollbarZichtbaar = this.isKaartLinksScrollbarNodig();
    this.bepaalKaartLinksMarginTopEnMaxHeight();
    this.bepaalKaartLinksToggleZichtbaar();
  }

  isKaartLinksScrollbarNodig(): boolean {
    return this.kaartLinksElement.nativeElement.scrollHeight > this.kaartLinksElement.nativeElement.clientHeight;
  }

  toggleKaartLinks() {
    this.kaartLinksZichtbaar = !this.kaartLinksZichtbaar;
    this.bepaalKaartLinksBreedte();
  }
}
