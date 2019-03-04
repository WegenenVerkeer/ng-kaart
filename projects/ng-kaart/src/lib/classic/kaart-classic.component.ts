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
import { Function1, pipe } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import { fromEither, none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { map, share, tap } from "rxjs/operators";

import { ToegevoegdeLaag } from "../kaart";
import { KaartInfoBoodschapUiSelector } from "../kaart/info-boodschappen/kaart-info-boodschappen.component";
import { Adres, KaartLocaties, WegLocaties } from "../kaart/kaart-bevragen/laaginfo.model";
import { forChangedValue, KaartComponentBase } from "../kaart/kaart-component-base";
import { KaartCmdDispatcher, ReplaySubjectKaartCmdDispatcher } from "../kaart/kaart-event-dispatcher";
import * as prt from "../kaart/kaart-protocol";
import { KaartMsgObservableConsumer } from "../kaart/kaart.component";
import { subscriptionCmdOperator } from "../kaart/subscription-helper";
import * as arrays from "../util/arrays";
import { ofType } from "../util/operators";
import * as progress from "../util/progress";
import { TypedRecord } from "../util/typed-record";

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

// Dit is een type dat de interne KartLocaties plat klopt voor extern gebruik.
export interface KaartLocatiesPlat {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly adres?: Adres;
  readonly adresStatus: progress.ProgressStatus;
  readonly wegLocaties: WegLocaties;
  readonly wegLocatiesStatus: progress.ProgressStatus;
  readonly combinedLaagLocatieStatus: progress.ProgressStatus;
}

const flattenKaartLocaties: Function1<KaartLocaties, KaartLocatiesPlat> = locaties => ({
  timestamp: locaties.timestamp,
  coordinaat: locaties.coordinaat,
  adres: progress
    .toOption(locaties.maybeAdres)
    .chain(option.fromEither)
    .toUndefined(),
  adresStatus: progress.toProgressStatus(locaties.maybeAdres),
  wegLocaties: arrays.fromOption(progress.toOption(locaties.wegLocaties).map(arrays.fromEither)),
  wegLocatiesStatus: progress.toProgressStatus(locaties.wegLocaties),
  combinedLaagLocatieStatus: progress.combineStatus(
    progress.toProgressStatus(locaties.maybeAdres),
    progress.toProgressStatus(locaties.wegLocaties)
  )
});

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html"
})
export class KaartClassicComponent extends KaartComponentBase implements OnInit, OnDestroy, OnChanges, KaartCmdDispatcher<TypedRecord> {
  private static counter = 1;
  kaartClassicSubMsg$: rx.Observable<KaartClassicSubMsg> = rx.EMPTY;
  private hasFocus = false;

  readonly dispatcher: ReplaySubjectKaartCmdDispatcher<TypedRecord> = new ReplaySubjectKaartCmdDispatcher();
  readonly kaartMsgObservableConsumer: KaartMsgObservableConsumer;

  @Input()
  zoom: number;
  @Input()
  minZoom = 1;
  @Input()
  maxZoom = 15;
  @Input()
  middelpunt: ol.Coordinate; // = [130000, 193000]; // "extent" heeft voorrang
  @Input()
  breedte: number | undefined; // neem standaard de hele breedte in
  @Input()
  hoogte: number | undefined;
  @Input()
  kaartLinksBreedte; // breedte van linker-paneel (de default is 480px bij kaart breedte > 1240 en 360px voor smallere kaarten)
  @Input()
  mijnLocatieZoom: number | undefined;
  @Input()
  extent: ol.Extent;
  @Input()
  selectieModus: prt.SelectieModus = "none";
  @Input()
  hoverModus: prt.HoverModus = "off";
  @Input()
  naam = "kaart" + KaartClassicComponent.counter++;
  @Input()
  geselecteerdeFeatures: List<ol.Feature> = List();
  @Input()
  onderdrukKaartBevragenBoodschappen = false;

  @Output()
  geselecteerdeFeaturesChange: EventEmitter<List<ol.Feature>> = new EventEmitter();
  @Output()
  middelpuntChange: EventEmitter<ol.Coordinate> = new EventEmitter();
  @Output()
  zoomChange: EventEmitter<number> = new EventEmitter();
  @Output()
  extentChange: EventEmitter<ol.Extent> = new EventEmitter();
  @Output()
  zichtbareFeatures: EventEmitter<List<ol.Feature>> = new EventEmitter();
  @Output()
  hoverFeature: EventEmitter<Option<ol.Feature>> = new EventEmitter();
  @Output()
  achtergrondLagen: EventEmitter<List<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondHoogLagen: EventEmitter<List<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  voorgrondLaagLagen: EventEmitter<List<ToegevoegdeLaag>> = new EventEmitter();
  @Output()
  kaartLocaties: EventEmitter<KaartLocatiesPlat> = new EventEmitter();

  @ViewChild("kaart", { read: ElementRef })
  mapElement: ElementRef;

  constructor(zone: NgZone) {
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

      this.bindToLifeCycle(this.kaartClassicSubMsg$).subscribe(msg => {
        switch (msg.type) {
          case "FeatureSelectieAangepast":
            // Zorg ervoor dat de geselecteerde features in de @Output terecht komen
            return this.geselecteerdeFeaturesChange.emit(msg.geselecteerdeFeatures.geselecteerd);
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

  ngOnInit() {
    super.ngOnInit();
    // De volgorde van de dispatching hier is van belang voor wat de overhand heeft
    if (this.zoom) {
      this.dispatch(prt.VeranderZoomCmd(this.zoom, logOnlyWrapper));
    }
    if (this.extent) {
      this.dispatch(prt.VeranderExtentCmd(this.extent));
    }
    if (this.middelpunt) {
      this.dispatch(prt.VeranderMiddelpuntCmd(this.middelpunt, none));
    }
    if (this.breedte || this.hoogte) {
      this.dispatch(prt.VeranderViewportCmd([this.breedte!, this.hoogte!]));
    }
    if (this.hoverModus) {
      this.dispatch(prt.ActiveerHoverModusCmd(this.hoverModus));
    }
    if (this.selectieModus) {
      this.dispatch(prt.ActiveerSelectieModusCmd(this.selectieModus));
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const dispatch: (cmd: prt.Command<TypedRecord>) => void = cmd => this.dispatch(cmd);
    forChangedValue(changes, "zoom", zoom => this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper)));
    forChangedValue(changes, "middelpunt", middelpunt => this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt, none)));
    forChangedValue(
      changes,
      "extent",
      pipe(
        prt.VeranderExtentCmd,
        dispatch
      )
    );
    forChangedValue(
      changes,
      "mijnLocatieZoom",
      pipe(
        option.fromNullable,
        prt.ZetMijnLocatieZoomCmd,
        dispatch
      )
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
    forChangedValue(changes, "onderdrukKaartBevragenBoodschappen", onderdruk =>
      this.dispatch(prt.ZetUiElementOpties(KaartInfoBoodschapUiSelector, { kaartBevragenOnderdrukt: onderdruk }))
    );
  }

  dispatch(cmd: prt.Command<TypedRecord>) {
    this.dispatcher.dispatch(cmd);
  }

  get kaartCmd$(): rx.Observable<prt.Command<TypedRecord>> {
    return this.dispatcher.commands$;
  }

  private zetKaartGrootte() {
    if (this.breedte) {
      this.mapElement.nativeElement.style.width = `${this.breedte}px`;
    }
    if (this.hoogte) {
      this.mapElement.nativeElement.style.height = `${this.hoogte}px`;
    }
  }

  focus(): void {
    // Voor performantie
    if (!this.hasFocus) {
      this.hasFocus = true;
      this.dispatch({ type: "FocusOpKaart" });
    }
  }

  geenFocus(): void {
    // Stuur enkel enkel indien nodig
    if (this.hasFocus) {
      this.hasFocus = false;
      this.dispatch({ type: "VerliesFocusOpKaart" });
    }
  }

  toonIdentifyInformatie(feature: ol.Feature): void {
    const featureId = feature.get("id").toString();
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        type: "InfoBoodschapIdentify",
        id: featureId,
        titel: feature.get("laagnaam"),
        feature: feature,
        bron: none,
        sluit: "DOOR_APPLICATIE",
        laag: none,
        verbergMsgGen: () => some(KaartClassicMsg(FeatureGedeselecteerdMsg(featureId)))
      })
    );
  }

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
