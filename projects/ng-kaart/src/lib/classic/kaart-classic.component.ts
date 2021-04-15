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
  ViewChild,
} from "@angular/core";
import { apply, option } from "fp-ts";
import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { debounceTime, map, share, switchMap, tap } from "rxjs/operators";

import {
  forChangedValue,
  KaartBaseDirective,
} from "../kaart/kaart-base.directive";
import { BevraagKaartOpties } from "../kaart/kaart-bevragen/kaart-bevragen-opties";
import {
  Adres,
  BevragenErrorReason,
  KaartLocaties,
  progressFailure,
  WegLocaties,
} from "../kaart/kaart-bevragen/laaginfo.model";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import {
  KaartCmdDispatcher,
  ReplaySubjectKaartCmdDispatcher,
} from "../kaart/kaart-event-dispatcher";
import * as prt from "../kaart/kaart-protocol";
import { KaartMsgObservableConsumer } from "../kaart/kaart.component";
import { subscriptionCmdOperator } from "../kaart/subscription-helper";
import * as arrays from "../util/arrays";
import { clusterFeaturesToGeoJson } from "../util/feature";
import { Feature } from "../util/feature";
import { GeoJsonFeatures } from "../util/geojson-types";
import * as ol from "../util/openlayers-compat";
import { collectOption, ofType } from "../util/operators";
import { forEach } from "../util/option";
import * as progress from "../util/progress";
import { TypedRecord } from "../util/typed-record";

import { KaartClassicLocatorService } from "./kaart-classic-locator.service";
import { classicLogger } from "./log";
import {
  AchtergrondLagenInGroepAangepastMsg,
  BusyMsg,
  ExtentAangepastMsg,
  FeatureGedeselecteerdMsg,
  FeatureHoverAangepastMsg,
  FeatureSelectieAangepastMsg,
  InErrorMsg,
  KaartClassicMsg,
  KaartClassicSubMsg,
  KaartClickMsg,
  logOnlyWrapper,
  MiddelpuntAangepastMsg,
  PublishedKaartLocatiesMsg,
  SubscribedMsg,
  VoorgrondHoogLagenInGroepAangepastMsg,
  VoorgrondLaagLagenInGroepAangepastMsg,
  ZichtbareFeaturesAangepastMsg,
  ZoomAangepastMsg,
} from "./messages";
import * as val from "./webcomponent-support/params";

// Dit is een type dat de interne KaartLocaties plat klopt voor extern gebruik.
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

const flattenKaartLocaties: (
  locaties: KaartLocaties
) => ClassicKlikInfoEnStatus = (locaties) => ({
  timestamp: locaties.timestamp,
  coordinaat: locaties.coordinaat,
  adres: pipe(
    progress.toOption(locaties.maybeAdres),
    option.chain(option.fromEither),
    option.toUndefined
  ),
  adresStatus: progress.toProgressStatus(locaties.maybeAdres),
  adresFailure: progressFailure(locaties.maybeAdres),
  wegLocaties: arrays.fromOption(
    pipe(progress.toOption(locaties.wegLocaties), option.map(arrays.fromEither))
  ),
  wegLocatiesStatus: progress.toProgressStatus(locaties.wegLocaties),
  wegLocatiesFailure: progressFailure(locaties.wegLocaties),
  combinedLaagLocatieStatus: progress.combineStatus(
    progress.toProgressStatus(locaties.maybeAdres),
    progress.toProgressStatus(locaties.wegLocaties)
  ),
});

const nop = () => {};

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html",
})
export class KaartClassicComponent
  extends KaartBaseDirective
  implements OnInit, OnDestroy, OnChanges, KaartCmdDispatcher<TypedRecord> {
  /** @ignore */
  private static counter = 1;

  /** @ignore */
  private kaartClassicSubMsgProvider: rx.ReplaySubject<
    rx.Observable<KaartClassicSubMsg>
  > = new rx.ReplaySubject(1);
  /** @ignore */
  kaartClassicSubMsg$: rx.Observable<
    KaartClassicSubMsg
  > = this.kaartClassicSubMsgProvider.pipe(switchMap((provider) => provider));

  /** @ignore */
  private hasFocus = false;

  /** @ignore */
  readonly dispatcher: ReplaySubjectKaartCmdDispatcher<
    TypedRecord
  > = new ReplaySubjectKaartCmdDispatcher();
  /** @ignore */
  readonly kaartMsgObservableConsumer: KaartMsgObservableConsumer;

  _zoom: option.Option<number> = option.none;
  _minZoom = 1;
  _maxZoom = 15;
  _middelpunt: option.Option<ol.Coordinate> = option.none;
  _breedte: option.Option<number> = option.none;
  _hoogte: option.Option<number> = option.none;
  _kaartLinksBreedte: number;
  _mijnLocatieZoom: option.Option<number> = option.none;
  _extent: option.Option<ol.Extent> = option.none;
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

  /** De selectiemodus: "single" | "singleQuick" | "multipleKlik" | "multipleShift" | "none" */
  @Input()
  set selectieModus(param: prt.SelectieModus) {
    this._selectieModus = val.enu(
      param,
      this._selectieModus,
      "single",
      "singleQuick",
      "multipleKlik",
      "multipleShift",
      "none"
    );
  } /** De selectiemodus: "single" | "singleQuick" | "multipleKlik" | "multipleShift" | "none" */

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
    this._onderdrukKaartBevragenBoodschappen = val.bool(
      param,
      this._onderdrukKaartBevragenBoodschappen
    );
  }

  /** De geselecteerde features */
  @Output()
  geselecteerdeFeaturesChange: EventEmitter<
    Array<ol.Feature>
  > = new EventEmitter();
  @Output()
  geselecteerdeFeatureGeoJson: EventEmitter<
    GeoJsonFeatures[]
  > = new EventEmitter();
  @Output()
  middelpuntChange: EventEmitter<ol.Coordinate> = new EventEmitter();
  @Output()
  zoomChange: EventEmitter<number> = new EventEmitter();
  @Output()
  extentChange: EventEmitter<ol.Extent> = new EventEmitter();
  @Output()
  zichtbareFeatures: EventEmitter<Array<ol.Feature>> = new EventEmitter();
  @Output()
  hoverFeature: EventEmitter<option.Option<ol.Feature>> = new EventEmitter();
  @Output()
  achtergrondLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondHoogLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondLaagLagen: EventEmitter<Array<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  kaartLocaties: EventEmitter<ClassicKlikInfoEnStatus> = new EventEmitter();
  @Output()
  kaartClick: EventEmitter<ol.Coordinate> = new EventEmitter();
  @Output()
  inErrorChange: EventEmitter<boolean> = new EventEmitter();

  /** @ignore */
  @ViewChild("kaart", { read: ElementRef })
  mapElement: ElementRef;

  /** @ignore */
  constructor(
    zone: NgZone,
    private el: ElementRef<Element>,
    private kaartLocatorService: KaartClassicLocatorService<
      KaartClassicComponent
    >
  ) {
    super(zone);
    this.kaartLocatorService.registerComponent(this, this.el);

    this.kaartMsgObservableConsumer = (msg$: rx.Observable<prt.KaartMsg>) => {
      // We zijn enkel geïnteresseerd in messages van ons eigen type
      this.kaartClassicSubMsgProvider.next(
        msg$.pipe(
          ofType<KaartClassicMsg>("KaartClassic"),
          map((m) => m.payload),
          tap((m) => classicLogger.debug("Een classic msg werd ontvangen", m)),
          share() // 1 rx subscription naar boven toe is genoeg
        )
      );

      // Deze blok lift de boodschappen van de kaart component naar boodschappen voor de classic componenten
      // Alle messages die door 1 van de classic componenten de geconsumeerd worden, moet hier vertaald worden.
      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.lift(
          classicMsgSubscriptionCmdOperator(
            this.dispatcher,
            prt.KaartClickSubscription(flow(KaartClickMsg, KaartClassicMsg)),
            prt.GeselecteerdeFeaturesSubscription(
              flow(FeatureSelectieAangepastMsg, KaartClassicMsg)
            ),
            prt.HoverFeaturesSubscription(
              flow(FeatureHoverAangepastMsg, KaartClassicMsg)
            ),
            prt.ZichtbareFeaturesSubscription(
              flow(ZichtbareFeaturesAangepastMsg, KaartClassicMsg)
            ),
            prt.ZoomSubscription(flow(ZoomAangepastMsg, KaartClassicMsg)),
            prt.MiddelpuntSubscription(
              flow(MiddelpuntAangepastMsg, KaartClassicMsg)
            ),
            prt.ExtentSubscription(flow(ExtentAangepastMsg, KaartClassicMsg)),
            prt.LagenInGroepSubscription(
              "Achtergrond",
              flow(AchtergrondLagenInGroepAangepastMsg, KaartClassicMsg)
            ),
            prt.LagenInGroepSubscription(
              "Voorgrond.Hoog",
              flow(VoorgrondHoogLagenInGroepAangepastMsg, KaartClassicMsg)
            ),
            prt.LagenInGroepSubscription(
              "Voorgrond.Laag",
              flow(VoorgrondLaagLagenInGroepAangepastMsg, KaartClassicMsg)
            ),
            prt.PublishedKaartLocatiesSubscription(
              flow(PublishedKaartLocatiesMsg, KaartClassicMsg)
            ),
            prt.InErrorSubscription(flow(InErrorMsg, KaartClassicMsg)),
            prt.BusySubscription(flow(BusyMsg, KaartClassicMsg))
          )
        )
      ).subscribe((err) => classicLogger.error(err));

      // We willen vermijden dat te vlugge veranderingen naar de client doorgestuurd worden. In het bijzonder is het zo
      // dat bij het programmatorisch zetten van een geselecteerde feature er eerst een clear gebeurt (er is geen
      // vervang API in OL) en dat we op die manier 2 updates krijgen. Eén met een lege array en één met aantal features
      // erin.
      const selectionBuffer: rx.Subject<ol.Feature[]> = new rx.Subject();
      const debouncedSelectedFeatures = selectionBuffer.pipe(debounceTime(20));
      this.bindToLifeCycle(debouncedSelectedFeatures).subscribe((e) =>
        this.geselecteerdeFeaturesChange.emit(e)
      );

      // Voor de webcomponent willen we de features als GeoJson exposen
      this.bindToLifeCycle(
        debouncedSelectedFeatures.pipe(collectOption(clusterFeaturesToGeoJson))
      ).subscribe((e) => this.geselecteerdeFeatureGeoJson.emit(e));

      this.bindToLifeCycle(this.kaartClassicSubMsg$).subscribe((msg) => {
        switch (msg.type) {
          case "FeatureSelectieAangepast":
            // Zorg ervoor dat de geselecteerde features in de @Output terecht komen
            return selectionBuffer.next(msg.geselecteerdeFeatures.geselecteerd);
          case "FeatureHoverAangepast":
            return this.hoverFeature.emit(option.fromEither(msg.feature.hover));
          case "ZichtbareFeaturesAangepast":
            return this.zichtbareFeatures.emit(msg.features);
          case "FeatureGedeselecteerd":
            // Zorg ervoor dat deselecteer van een feature via infoboodschap terug naar kaart-reducer gaat
            return this.dispatch(prt.DeselecteerFeatureCmd([msg.feature]));
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
          case "KaartClick":
            return this.kaartClick.emit(msg.clickCoordinaat);
          case "InError":
            return this.inErrorChange.emit(msg.inError);
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
    pipe(
      this._zoom,
      option.fold(nop, (zoom) =>
        this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper))
      )
    );
    pipe(
      this._extent,
      option.fold(nop, (extent) => this.dispatch(prt.VeranderExtentCmd(extent)))
    );
    pipe(
      this._middelpunt,
      option.fold(nop, (middelpunt) =>
        this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt, option.none))
      )
    );
    if (option.isSome(this._breedte) || option.isSome(this._hoogte)) {
      this.dispatch(
        prt.VeranderViewportCmd([
          option.toUndefined(this._breedte),
          option.toUndefined(this._hoogte),
        ])
      );
    }
    this.dispatch(prt.ActiveerHoverModusCmd(this._hoverModus));
    this.dispatch(prt.ActiveerSelectieModusCmd(this._selectieModus));
  }

  /** @ignore */
  ngOnChanges(changes: SimpleChanges) {
    const dispatch: (cmd: prt.Command<TypedRecord>) => void = (cmd) =>
      this.dispatch(cmd);
    forChangedValue(
      changes,
      "zoom",
      // TODO: Eigenlijk moeten we iets doen als de input leeggemaakt wordt, maar wat?
      (zoomOpt) =>
        forEach(zoomOpt, (zoom) =>
          this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper))
        ),
      val.optNum
    );
    forChangedValue(changes, "minZoom", () => this.zetZoomRange());
    forChangedValue(changes, "maxZoom", () => this.zetZoomRange());
    forChangedValue(
      changes,
      "middelpunt",
      (middelpuntOpt) =>
        forEach(middelpuntOpt, (middelpunt) =>
          this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt, option.none))
        ),
      val.optCoord
    );
    forChangedValue(
      changes,
      "extent",
      (extentOpt) => forEach(extentOpt, flow(prt.VeranderExtentCmd, dispatch)),
      val.optExtent
    );
    forChangedValue(
      changes,
      "mijnLocatieZoom",
      (zoomOpt) =>
        forEach(
          zoomOpt,
          flow(option.fromNullable, prt.ZetMijnLocatieZoomCmd, dispatch)
        ),
      val.optNum
    );
    forChangedValue(
      changes,
      "geselecteerdeFeatures",
      flow(prt.SelecteerFeaturesCmd, dispatch)
    );
    forChangedValue(changes, "breedte", () => this.zetKaartGrootte());
    forChangedValue(changes, "hoogte", () => this.zetKaartGrootte());
    forChangedValue(
      changes,
      "onderdrukKaartBevragenBoodschappen",
      (onderdruk) =>
        this.dispatch(
          BevraagKaartOpties.ZetOptiesCmd({
            onderdrukInfoBoodschappen: onderdruk,
          })
        ),
      (value: boolean) =>
        val.bool(value, this._onderdrukKaartBevragenBoodschappen)
    );

    forChangedValue(
      changes,
      "selectieModus",
      flow(prt.ActiveerSelectieModusCmd, dispatch),
      (param: string) =>
        val.enu(
          param,
          this._selectieModus,
          "single",
          "singleQuick",
          "multipleKlik",
          "multipleShift",
          "none"
        ),
      (value) => value !== undefined && value != null
    );
    forChangedValue(
      changes,
      "hovermodus",
      flow(prt.ActiveerHoverModusCmd, dispatch),
      (param: string) => val.enu(param, this._hoverModus, "on", "off"),
      (value) => value !== undefined && value != null
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
    const maybeNativeMapElement = pipe(
      option.fromNullable(this.mapElement),
      option.chain((elt) => option.fromNullable(elt.nativeElement))
    );

    forEach(
      apply.sequenceT(option.option)(maybeNativeMapElement, this._breedte),
      ([elt, breedte]) => (elt.style.width = `${breedte}px`)
    );
    forEach(
      apply.sequenceT(option.option)(maybeNativeMapElement, this._hoogte),
      ([elt, hoogte]) => (elt.style.height = `${hoogte}px`)
    );
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
    const featureId = pipe(
      Feature.propertyId(feature),
      option.getOrElse(() => "")
    );
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        type: "InfoBoodschapIdentify",
        id: featureId,
        titel: pipe(
          Feature.getLaagnaam(feature),
          option.getOrElse(() => "Onbekende laag")
        ),
        feature: feature,
        bron: option.none,
        sluit: "DOOR_APPLICATIE",
        laag: option.none,
        verbergMsgGen: () =>
          option.some(KaartClassicMsg(FeatureGedeselecteerdMsg(feature))),
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
  return subscriptionCmdOperator(
    dispatcher,
    (ref) => (validation) => KaartClassicMsg(SubscribedMsg(validation, ref)),
    ...subscriptions
  );
}
