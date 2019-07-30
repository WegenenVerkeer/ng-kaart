import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import { Either } from "fp-ts/lib/Either";
import { Function1, pipe } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import { fromEither, none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, map, share, tap } from "rxjs/operators";

import { ToegevoegdeLaag } from "../kaart";
import { KaartInfoBoodschapUiSelector } from "../kaart/info-boodschappen/kaart-info-boodschappen.component";
import { Adres, BevragenErrorReason, KaartLocaties, WegLocaties } from "../kaart/kaart-bevragen/laaginfo.model";
import { forChangedValue, KaartComponentBase } from "../kaart/kaart-component-base";
import { KaartCmdDispatcher, ReplaySubjectKaartCmdDispatcher } from "../kaart/kaart-event-dispatcher";
import * as prt from "../kaart/kaart-protocol";
import { KaartMsgObservableConsumer } from "../kaart/kaart.component";
import { subscriptionCmdOperator } from "../kaart/subscription-helper";
import * as arrays from "../util/arrays";
import { clusterFeaturesToGeoJson } from "../util/feature";
import { Feature } from "../util/feature";
import { GeoJsonFeatures } from "../util/geojson-types";
import { collectOption, ofType } from "../util/operators";
import { forEach } from "../util/option";
import * as progress from "../util/progress";
import { TypedRecord } from "../util/typed-record";

import { KaartClassicLocatorService } from "./kaart-classic-locator.service";
import { classicLogger } from "./log";
import {
  AchtergrondLagenInGroepAangepastMsg,
  ExtentAangepastMsg,
  FeatureGedeselecteerdMsg,
  FeatureHoverAangepastMsg,
  FeatureSelectieAangepastMsg,
  KaartClassicMsg,
  KaartClassicSubMsg,
  logOnlyWrapper,
  MiddelpuntAangepastMsg,
  PublishedKaartLocatiesMsg,
  SubscribedMsg,
  VoorgrondHoogLagenInGroepAangepastMsg,
  VoorgrondLaagLagenInGroepAangepastMsg,
  ZichtbareFeaturesAangepastMsg,
  ZoomAangepastMsg
} from "./messages";
import * as val from "./webcomponent-support/params";

// Dit is een type dat de interne KartLocaties plat klopt voor extern gebruik.
export interface ClassicKlikInfoEnStatus {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly adres?: Adres;
  readonly adresStatus: progress.ProgressStatus;
  readonly adresFailure?: BevragenErrorReason;
  readonly wegLocaties: WegLocaties;
  readonly wegLocatiesStatus: progress.ProgressStatus;
  readonly wegLocatiesFailure?: BevragenErrorReason;
  readonly combinedLaagLocatieStatus: progress.ProgressStatus;
}

const progressFailure: <A>(_: progress.Progress<Either<BevragenErrorReason, A>>) => BevragenErrorReason | undefined = p =>
  progress
    .toOption(p)
    .chain(e => option.fromEither(e.swap()))
    .toUndefined();

const flattenKaartLocaties: Function1<KaartLocaties, ClassicKlikInfoEnStatus> = locaties => ({
  timestamp: locaties.timestamp,
  coordinaat: locaties.coordinaat,
  adres: progress
    .toOption(locaties.maybeAdres)
    .chain(option.fromEither)
    .toUndefined(),
  adresStatus: progress.toProgressStatus(locaties.maybeAdres),
  adresFailure: progressFailure(locaties.maybeAdres),
  wegLocaties: arrays.fromOption(progress.toOption(locaties.wegLocaties).map(arrays.fromEither)),
  wegLocatiesStatus: progress.toProgressStatus(locaties.wegLocaties),
  wegLocatiesFailure: progressFailure(locaties.wegLocaties),
  combinedLaagLocatieStatus: progress.combineStatus(
    progress.toProgressStatus(locaties.maybeAdres),
    progress.toProgressStatus(locaties.wegLocaties)
  )
});

const nop = () => {};

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html"
})
export class KaartClassicComponent extends KaartComponentBase implements OnInit, OnDestroy, OnChanges, KaartCmdDispatcher<TypedRecord> {
  /** @ignore */
  private static counter = 1;
  /** @ignore */
  kaartClassicSubMsg$: rx.Observable<KaartClassicSubMsg> = rx.EMPTY;
  /** @ignore */
  private hasFocus = false;

  /** @ignore */
  readonly dispatcher: ReplaySubjectKaartCmdDispatcher<TypedRecord> = new ReplaySubjectKaartCmdDispatcher();
  /** @ignore */
  readonly kaartMsgObservableConsumer: KaartMsgObservableConsumer;

  _zoom: Option<number> = none;
  _minZoom = 1;
  _maxZoom = 15;
  _middelpunt: Option<ol.Coordinate> = none;
  _breedte: Option<number> = none;
  _hoogte: Option<number> = none;
  _kaartLinksBreedte: number;
  _mijnLocatieZoom: Option<number> = none;
  _extent: Option<ol.Extent> = none;
  _selectieModus: prt.SelectieModus = "none";
  _hoverModus: prt.HoverModus = "off";
  _naam = "kaart" + KaartClassicComponent.counter++;
  _onderdrukKaartBevragenBoodschappen = false;

  /** Geselecteerde features */
  @Input()
  geselecteerdeFeatures: Array<ol.Feature> = [];

  /** Zoom niveau */
  @Input()
  set zoom(param: number) {
    this._zoom = val.optNum(param);
  }

  /** Minimum zoom niveau */
  @Input()
  set minZoom(param: number) {
    this._minZoom = val.num(param, this._minZoom);
  }

  /** Maximum zoom niveau */
  @Input()
  set maxZoom(param: number) {
    this._maxZoom = val.num(param, this._maxZoom);
  }

  /** Het middelpunt van de kaart. "extent" heeft voorrang */
  @Input()
  set middelpunt(param: ol.Coordinate) {
    this._middelpunt = val.optCoord(param);
  }

  /** Breedte van de kaart, neem standaard de hele breedte in */
  @Input()
  set breedte(param: number) {
    this._breedte = val.optNum(param);
  }

  /** Hoogte van de kaart, neem standaard de hele hoogte in */
  @Input()
  set hoogte(param: number) {
    this._hoogte = val.optNum(param);
  }

  /** Breedte van linker-paneel (de default is 480px bij kaart breedte > 1240 en 360px voor smallere kaarten) */
  @Input()
  set kaartLinksBreedte(param: number) {
    this._kaartLinksBreedte = val.num(param, this._kaartLinksBreedte);
  }

  /** Zoom niveau om te gebruiken bij "Mijn Locatie" */
  @Input()
  set mijnLocatieZoom(param: number) {
    this._mijnLocatieZoom = val.optNum(param);
  }

  /** De extent van de kaart, heeft voorang op "middelpunt" */
  @Input()
  set extent(param: ol.Extent) {
    this._extent = val.optExtent(param);
  }

  /** De selectiemodus: "single" | "multipleKlik" | "multipleShift" | "none" */
  @Input()
  set selectieModus(param: prt.SelectieModus) {
    this._selectieModus = val.enu(param, this._selectieModus, "single", "multipleKlik", "multipleShift", "none");
  }

  /** Info bij hover: "on" | "off" */
  @Input()
  set hoverModus(param: prt.HoverModus) {
    this._hoverModus = val.enu(param, this._hoverModus, "on", "off");
  }

  /** Naam van de kaart */
  @Input()
  set naam(param: string) {
    this._naam = val.str(param, this._naam);
  }

  /** Onderdrukken we kaart info boodschappen? */
  @Input()
  set onderdrukKaartBevragenBoodschappen(param: boolean) {
    this._onderdrukKaartBevragenBoodschappen = val.bool(param, this._onderdrukKaartBevragenBoodschappen);
  }

  /** De geselecteerde features */
  @Output()
  geselecteerdeFeaturesChange: EventEmitter<Array<ol.Feature>> = new EventEmitter();
  @Output()
  geselecteerdeFeatureGeoJson: EventEmitter<GeoJsonFeatures[]> = new EventEmitter();
  @Output()
  middelpuntChange: EventEmitter<ol.Coordinate> = new EventEmitter();
  @Output()
  zoomChange: EventEmitter<number> = new EventEmitter();
  @Output()
  extentChange: EventEmitter<ol.Extent> = new EventEmitter();
  @Output()
  zichtbareFeatures: EventEmitter<Array<ol.Feature>> = new EventEmitter();
  @Output()
  hoverFeature: EventEmitter<Option<ol.Feature>> = new EventEmitter();
  @Output()
  achtergrondLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondHoogLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondLaagLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  kaartLocaties: EventEmitter<ClassicKlikInfoEnStatus> = new EventEmitter();

  /** @ignore */
  @ViewChild("kaart", { read: ElementRef })
  mapElement: ElementRef;

  /** @ignore */
  constructor(
    zone: NgZone,
    private el: ElementRef<Element>,
    private kaartLocatorService: KaartClassicLocatorService<KaartClassicComponent>
  ) {
    super(zone);
    this.kaartMsgObservableConsumer = (msg$: rx.Observable<prt.KaartMsg>) => {
      // We zijn enkel geïnteresseerd in messages van ons eigen type
      this.kaartClassicSubMsg$ = msg$.pipe(
        ofType<KaartClassicMsg>("KaartClassic"),
        map(m => m.payload),
        tap(m => classicLogger.debug("Een classic msg werd ontvangen", m)),
        share() // 1 rx subscription naar boven toe is genoeg
      );

      // Deze blok lift de boodschappen van de kaart component naar boodschappen voor de classic componenten
      // Alle messages die door 1 van de classic componenten de geconsumeerd worden, moet hier vertaald worden.
      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.lift(
          classicMsgSubscriptionCmdOperator(
            this.dispatcher,
            prt.GeselecteerdeFeaturesSubscription(
              pipe(
                FeatureSelectieAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.HoverFeaturesSubscription(
              pipe(
                FeatureHoverAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.ZichtbareFeaturesSubscription(
              pipe(
                ZichtbareFeaturesAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.ZoomSubscription(
              pipe(
                ZoomAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.MiddelpuntSubscription(
              pipe(
                MiddelpuntAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.ExtentSubscription(
              pipe(
                ExtentAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.LagenInGroepSubscription(
              "Achtergrond",
              pipe(
                AchtergrondLagenInGroepAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.LagenInGroepSubscription(
              "Voorgrond.Hoog",
              pipe(
                VoorgrondHoogLagenInGroepAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.LagenInGroepSubscription(
              "Voorgrond.Laag",
              pipe(
                VoorgrondLaagLagenInGroepAangepastMsg,
                KaartClassicMsg
              )
            ),
            prt.PublishedKaartLocatiesSubscription(
              pipe(
                PublishedKaartLocatiesMsg,
                KaartClassicMsg
              )
            )
          )
        )
      ).subscribe(err => classicLogger.error(err));

      // We willen vermijden dat te vlugge veranderingen naar de client doorgestuurd worden. In het bijzonder is het zo
      // dat bij het programmatorisch zetten van een geselecteerde feature er eerst een clear gebeurt (er is geen
      // vervang API in OL) en dat we op die manier 2 updates krijgen. Eén met een lege array en één met aantal features
      // erin.
      const selectionBuffer: rx.Subject<ol.Feature[]> = new rx.Subject();
      const debouncedSelectedFeatures = selectionBuffer.pipe(debounceTime(20));
      this.bindToLifeCycle(debouncedSelectedFeatures).subscribe(e => this.geselecteerdeFeaturesChange.emit(e));

      // Voor de webcomponent willen we de features als GeoJson exposen
      this.bindToLifeCycle(debouncedSelectedFeatures.pipe(collectOption(clusterFeaturesToGeoJson))).subscribe(e =>
        this.geselecteerdeFeatureGeoJson.emit(e)
      );

      this.bindToLifeCycle(this.kaartClassicSubMsg$).subscribe(msg => {
        switch (msg.type) {
          case "FeatureSelectieAangepast":
            // Zorg ervoor dat de geselecteerde features in de @Output terecht komen
            return selectionBuffer.next(msg.geselecteerdeFeatures.geselecteerd);
          case "FeatureHoverAangepast":
            return this.hoverFeature.emit(fromEither(msg.feature.hover));
          case "ZichtbareFeaturesAangepast":
            return this.zichtbareFeatures.emit(msg.features);
          case "FeatureGedeselecteerd":
            // Zorg ervoor dat deselecteer van een feature via infoboodschap terug naar kaart-reducer gaat
            return this.dispatch(prt.DeselecteerFeatureCmd(msg.featureid));
          case "ZoomAangepast":
            return this.zoomChange.emit(msg.zoom);
          case "MiddelpuntAangepast":
            return this.middelpuntChange.emit(msg.middelpunt);
          case "ExtentAangepast":
            return this.extentChange.emit(msg.extent);
          case "AchtergrondLagenInGroepAangepast":
            return this.achtergrondLagen.emit(msg.lagen);
          case "VoorgrondHoogLagenInGroepAangepast":
            return this.voorgrondHoogLagen.emit(msg.lagen);
          case "VoorgrondLaagLagenInGroepAangepast":
            return this.voorgrondLaagLagen.emit(msg.lagen);
          case "PublishedKaartLocaties":
            return this.kaartLocaties.emit(flattenKaartLocaties(msg.locaties));
          default:
            return; // Op de andere boodschappen reageren we niet
        }
      });
    };

    this.viewReady$.subscribe(() => this.zetKaartGrootte());
  }

  /** @ignore */
  ngOnInit() {
    super.ngOnInit();
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    this._zoom.foldL(nop, zoom => this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper)));
    this._extent.foldL(nop, extent => this.dispatch(prt.VeranderExtentCmd(extent)));
    this._middelpunt.foldL(nop, middelpunt => this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt, none)));
    if (this._breedte.isSome() || this._hoogte.isSome()) {
      this.dispatch(prt.VeranderViewportCmd([this._breedte.toUndefined(), this._hoogte.toUndefined()]));
    }
    this.dispatch(prt.ActiveerHoverModusCmd(this._hoverModus));
    this.dispatch(prt.ActiveerSelectieModusCmd(this._selectieModus));

    this.kaartLocatorService.registerComponent(this, this.el);
  }

  /** @ignore */
  ngOnChanges(changes: SimpleChanges) {
    const dispatch: (cmd: prt.Command<TypedRecord>) => void = cmd => this.dispatch(cmd);
    forChangedValue(
      changes,
      "zoom",
      // TODO: Eigenlijk moeten we iets doen als de input leeggemaakt wordt, maar wat?
      zoomOpt => forEach(zoomOpt, zoom => this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper))),
      val.optNum
    );
    forChangedValue(changes, "minZoom", () => this.zetZoomRange());
    forChangedValue(changes, "maxZoom", () => this.zetZoomRange());
    forChangedValue(
      changes,
      "middelpunt",
      middelpuntOpt => forEach(middelpuntOpt, middelpunt => this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt, none))),
      val.optCoord
    );
    forChangedValue(
      changes,
      "extent",
      extentOpt =>
        forEach(
          extentOpt,
          pipe(
            prt.VeranderExtentCmd,
            dispatch
          )
        ),
      val.optExtent
    );
    forChangedValue(
      changes,
      "mijnLocatieZoom",
      zoomOpt =>
        forEach(
          zoomOpt,
          pipe(
            option.fromNullable,
            prt.ZetMijnLocatieZoomCmd,
            dispatch
          )
        ),
      val.optNum
    );
    forChangedValue(
      changes,
      "geselecteerdeFeatures",
      pipe(
        prt.SelecteerFeaturesCmd,
        dispatch
      )
    );
    forChangedValue(changes, "breedte", () => this.zetKaartGrootte());
    forChangedValue(changes, "hoogte", () => this.zetKaartGrootte());
    forChangedValue(
      changes,
      "onderdrukKaartBevragenBoodschappen",
      onderdruk => this.dispatch(prt.ZetUiElementOpties(KaartInfoBoodschapUiSelector, { kaartBevragenOnderdrukt: onderdruk })),
      (value: boolean) => val.bool(value, this._onderdrukKaartBevragenBoodschappen)
    );
    forChangedValue(
      changes,
      "selectieModus",
      pipe(
        prt.ActiveerSelectieModusCmd,
        dispatch
      ),
      (param: string) => val.enu(param, this._selectieModus, "single", "multipleKlik", "multipleShift", "none"),
      value => value !== undefined && value != null
    );
    forChangedValue(
      changes,
      "hovermodus",
      pipe(
        prt.ActiveerHoverModusCmd,
        dispatch
      ),
      (param: string) => val.enu(param, this._hoverModus, "on", "off"),
      value => value !== undefined && value != null
    );
  }

  /** @ignore */
  dispatch(cmd: prt.Command<TypedRecord>) {
    this.dispatcher.dispatch(cmd);
  }

  /** @ignore */
  get kaartCmd$(): rx.Observable<prt.Command<TypedRecord>> {
    return this.dispatcher.commands$;
  }

  /** @ignore */
  private zetKaartGrootte() {
    this._breedte.foldL(nop, breedte => (this.mapElement.nativeElement.style.width = `${breedte}px`));
    this._hoogte.foldL(nop, hoogte => (this.mapElement.nativeElement.style.height = `${hoogte}px`));
  }

  /** @ignore */
  private zetZoomRange() {
    this.dispatch(prt.ZetZoomBereikCmd(this._minZoom, this._maxZoom));
  }

  /** @ignore */
  focus(): void {
    // Voor performantie
    if (!this.hasFocus) {
      this.hasFocus = true;
      this.dispatch({ type: "FocusOpKaart" });
    }
  }

  /** @ignore */
  geenFocus(): void {
    // Stuur enkel enkel indien nodig
    if (this.hasFocus) {
      this.hasFocus = false;
      this.dispatch({ type: "VerliesFocusOpKaart" });
    }
  }

  /** @ignore */
  toonIdentifyInformatie(feature: ol.Feature): void {
    const featureId = Feature.propertyId(feature).getOrElse("");
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        type: "InfoBoodschapIdentify",
        id: featureId,
        titel: Feature.getLaagnaam(feature).getOrElse("Onbekende laag"),
        feature: feature,
        bron: none,
        sluit: "DOOR_APPLICATIE",
        laag: none,
        verbergMsgGen: () => some(KaartClassicMsg(FeatureGedeselecteerdMsg(featureId)))
      })
    );
  }

  /** @ignore */
  verbergIdentifyInformatie(id: string): void {
    this.dispatch(prt.VerbergInfoBoodschapCmd(id));
  }
}

/**
 * Een specialisatie van de subscriptionCmdOperator die specifiek werkt met KaartClassicMessages.
 */
export function classicMsgSubscriptionCmdOperator(
  dispatcher: KaartCmdDispatcher<KaartClassicMsg>,
  ...subscriptions: prt.Subscription<KaartClassicMsg>[]
): rx.Operator<KaartClassicSubMsg, string[]> {
  return subscriptionCmdOperator(dispatcher, ref => validation => KaartClassicMsg(SubscribedMsg(validation, ref)), ...subscriptions);
}
