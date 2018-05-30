import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import { array } from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import { some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable } from "rxjs/Observable";
import { combineLatest, concat, debounceTime, map, pairwise, share, takeUntil, tap } from "rxjs/operators";

import { forChangedValue, KaartComponentBase } from "../kaart/kaart-component-base";
import * as ke from "../kaart/kaart-elementen";
import { KaartCmdDispatcher, ReplaySubjectKaartCmdDispatcher } from "../kaart/kaart-event-dispatcher";
import * as prt from "../kaart/kaart-protocol";
import { KaartMsgObservableConsumer } from "../kaart/kaart.component";
import { subscriptionCmdOperator } from "../kaart/subscription-helper";
import { ofType, TypedRecord } from "../util/operators";

import { classicLogger } from "./log";
import {
  ExtentAangepastMsg,
  FeatureGedeselecteerdMsg,
  FeatureSelectieAangepastMsg,
  KaartClassicMsg,
  KaartClassicSubMsg,
  lagen,
  logOnlyWrapper,
  MiddelpuntAangepastMsg,
  SubscribedMsg,
  VectorLagenAangepastMsg,
  view,
  ViewAangepastMsg,
  ZoomAangepastMsg
} from "./messages";

@Component({
  selector: "awv-kaart-classic",
  templateUrl: "./kaart-classic.component.html"
})
export class KaartClassicComponent extends KaartComponentBase implements OnInit, OnDestroy, OnChanges, KaartCmdDispatcher<prt.TypedRecord> {
  private static counter = 1;
  kaartClassicSubMsg$: Observable<KaartClassicSubMsg> = Observable.empty();
  private hasFocus = false;

  readonly dispatcher: ReplaySubjectKaartCmdDispatcher<TypedRecord> = new ReplaySubjectKaartCmdDispatcher();
  readonly kaartMsgObservableConsumer: KaartMsgObservableConsumer;

  @Input() zoom: number;
  @Input() minZoom = 0;
  @Input() maxZoom = 15;
  @Input() middelpunt: ol.Coordinate; // = [130000, 193000]; // "extent" heeft voorrang
  @Input() breedte; // neem standaard de hele breedte in
  @Input() hoogte = 400;
  @Input() mijnLocatieZoom: number | undefined;
  @Input() extent: ol.Extent;
  @Input() selectieModus: prt.SelectieModus = "none";
  @Input() naam = "kaart" + KaartClassicComponent.counter++;
  @Input() geselecteerdeFeatures: List<ol.Feature> = List();

  @Output() geselecteerdeFeaturesChange: EventEmitter<List<ol.Feature>> = new EventEmitter();
  @Output() middelpuntChange: EventEmitter<ol.Coordinate> = new EventEmitter();
  @Output() zoomChange: EventEmitter<number> = new EventEmitter();
  @Output() extentChange: EventEmitter<ol.Extent> = new EventEmitter();
  @Output() zichtbareFeatures: EventEmitter<List<ol.Feature>> = new EventEmitter();

  constructor(zone: NgZone) {
    super(zone);
    this.kaartMsgObservableConsumer = (msg$: Observable<prt.KaartMsg>) => {
      // We zijn enkel geïnteresseerd in messages van ons eigen type
      this.kaartClassicSubMsg$ = msg$.pipe(
        ofType<KaartClassicMsg>("KaartClassic"),
        map(m => m.payload),
        tap(m => classicLogger.debug("Een classic msg werd ontvangen", m)),
        share() // 1 rx subscription naar boven toe is genoeg
      );

      const filterVectorLagen = (lgn: List<ke.ToegevoegdeLaag>) => lgn.filter(ke.isToegevoegdeVectorLaag).toList();

      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.lift(
          classicMsgSubscriptionCmdOperator(
            this.dispatcher,
            prt.GeselecteerdeFeaturesSubscription(pipe(FeatureSelectieAangepastMsg, KaartClassicMsg)),
            prt.ViewinstellingenSubscription(pipe(zi => zi.zoom, ZoomAangepastMsg, KaartClassicMsg)),
            prt.ViewinstellingenSubscription(pipe(ViewAangepastMsg, KaartClassicMsg)),
            prt.MiddelpuntSubscription(pipe(MiddelpuntAangepastMsg, KaartClassicMsg)),
            prt.ExtentSubscription(pipe(ExtentAangepastMsg, KaartClassicMsg)),
            prt.LagenInGroepSubscription("Voorgrond.Hoog", pipe(filterVectorLagen, VectorLagenAangepastMsg, KaartClassicMsg))
          )
        )
      ).subscribe(err => classicLogger.error(err));

      const vectorlagen$ = this.kaartClassicSubMsg$.pipe(ofType<VectorLagenAangepastMsg>("VectorLagenAangepast"), map(lagen));
      const view$ = this.kaartClassicSubMsg$.pipe(ofType<ViewAangepastMsg>("ViewAangepast"), map(view));

      // Subscribe via Openlayers op alle feature changes van alle vectorlagen.
      const subscribeToChanges: (_: List<ke.ToegevoegdeVectorLaag>) => ol.EventsKey[] = vlgn =>
        array.chain(
          vlgn.toArray(), // Onnodig te luisteren naar onzichtbare lagen, maar in de praktijk zal OL daarvoor toch geen events genereren.
          vlg => vlg.layer.getSource().on(["addfeature", "removefeature", "clear"], () => featuresChangedSubj.next({})) as ol.EventsKey[]
        );

      // Om te weten welke features er zichtbaar zijn op een kaart zou het voldoende moeten zijn om te weten welke lagen er zijn, welke van
      // die lagen zichtbaar zijn en welke features er op de lagen in de huidige extent staan. Op zich is dat ook zo, maar het probleem is
      // dat openlayers features ophaalt in de background. Wanneer je naar een bepaalde extent gaat, zal er direct een event uit de view$
      // komen, maar de features zelf zijn er op dat moment nog niet noodzakelijk. De call naar getFeaturesInExtent zal dan te weinig
      // resultaten opleveren. Daarom voegen we nog een extra event toe wanneer openlayers klaar is met laden.
      // We gebruiker de addfeature en removefeature, and clear. Het interesseert ons daarbij niet wat de features zijn. Het is ons enkel te
      // doen om de change event (de generieke change event op zich blijkt geen events te genereren).
      const featuresChangedSubj = new rx.Subject<object>();
      const eventKeys$: rx.Observable<[ol.EventsKey[], ol.EventsKey[]]> = vectorlagen$.pipe(
        map(subscribeToChanges),
        takeUntil(this.destroying$), // bindToLifecycle niet bruikbaar omdat dan de concat hierna niet gebeurt
        concat(rx.Observable.of([] as ol.EventsKey[])), // eindig met een lege lijst zodat we de laatste keys nog unsubscriben
        pairwise() // we altijd de vorige keys hebben om te kunnen unsubscriber
      );
      eventKeys$.subscribe(([prevKeys, curKeys]) => prevKeys.forEach(evtKey => ol.Observable.unByKey(evtKey)));

      const collectFeatures: (_1: prt.Viewinstellingen, _2: List<ke.ToegevoegdeVectorLaag>) => ol.Feature[] = (vw, vlgn) =>
        array.chain(vlgn.toArray(), vlg => {
          return ke.isZichtbaar(vw.resolution)(vlg) ? vlg.layer.getSource().getFeaturesInExtent(vw.extent) : [];
        });

      const featuresChanged$ = featuresChangedSubj.asObservable().pipe(debounceTime(200));
      const featuresInExtent$ = view$.pipe(combineLatest(vectorlagen$, featuresChanged$, collectFeatures));

      this.bindToLifeCycle(this.kaartClassicSubMsg$).subscribe(msg => {
        switch (msg.type) {
          case "FeatureSelectieAangepast":
            // Zorg ervoor dat de geselecteerde features in de @Output terecht komen
            return this.geselecteerdeFeaturesChange.emit(msg.geselecteerdeFeatures.geselecteerd);
          case "FeatureGedeselecteerd":
            // Zorg ervoor dat deselecteer van een feature via infoboodschap terug naar kaart-reducer gaat
            return this.dispatch(prt.DeselecteerFeatureCmd(msg.featureid));
          case "ZoomAangepast":
            return this.zoomChange.emit(msg.zoom);
          case "MiddelpuntAangepast":
            return this.middelpuntChange.emit(msg.middelpunt);
          case "ExtentAangepast":
            return this.extentChange.emit(msg.extent);
          default:
            return; // Op de andere boodschappen reageren we niet
        }
      });

      this.bindToLifeCycle(featuresInExtent$).subscribe(features => this.zichtbareFeatures.emit(List(features)));
    };
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
      this.dispatch(prt.VeranderMiddelpuntCmd(this.middelpunt));
    }
    if (this.breedte || this.hoogte) {
      this.dispatch(prt.VeranderViewportCmd([this.breedte, this.hoogte]));
    }
    if (this.selectieModus) {
      this.dispatch(prt.ActiveerSelectieModusCmd(this.selectieModus));
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const dispatch: (cmd: prt.Command<TypedRecord>) => void = cmd => this.dispatch(cmd);
    forChangedValue(changes, "zoom", zoom => this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper)));
    forChangedValue(changes, "middelpunt", pipe(prt.VeranderMiddelpuntCmd, dispatch), coordinateIsDifferent);
    forChangedValue(changes, "extent", pipe(prt.VeranderExtentCmd, dispatch), extentIsDifferent);
    forChangedValue(changes, "breedte", pipe(breedte => [breedte, this.hoogte], prt.VeranderViewportCmd, dispatch));
    forChangedValue(changes, "hoogte", pipe(hoogte => [this.breedte, hoogte], prt.VeranderViewportCmd, dispatch));
    forChangedValue(changes, "mijnLocatieZoom", pipe(option.fromNullable, prt.ZetMijnLocatieZoomCmd, dispatch));
    forChangedValue(changes, "geselecteerdeFeatures", pipe(prt.SelecteerFeaturesCmd, dispatch));
  }

  dispatch(cmd: prt.Command<TypedRecord>) {
    this.dispatcher.dispatch(cmd);
  }

  get kaartCmd$(): Observable<prt.Command<prt.TypedRecord>> {
    return this.dispatcher.commands$;
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
        verbergMsgGen: () => some(KaartClassicMsg(FeatureGedeselecteerdMsg(featureId)))
      })
    );
    // Gewoon alert:
    //
    // this.dispatch(
    //   prt.ToonInfoBoodschapCmd({
    //     id: "alert-" + featureId,
    //     type: "InfoBoodschapAlert",
    //     titel: feature.get("laagnaam"),
    //     message: "Feature " + featureId + " geselecteerd",
    //     verbergMsgGen: () => some(KaartClassicMsg(FeatureGedeselecteerdMsg(featureId)))
    //   })
    // );
  }

  verbergIdentifyInformatie(id: string): void {
    this.dispatch(prt.VerbergInfoBoodschapCmd(id));
  }
}

const coordinateIsEqual = (coor1: ol.Coordinate, coor2: ol.Coordinate) => {
  if (!coor1 && !coor2) {
    return true;
  }
  if (!coor1 || !coor2) {
    return false;
  }
  return coor1[0] === coor2[0] && coor1[1] === coor2[1];
};
const coordinateIsDifferent = (coor1: ol.Coordinate, coor2: ol.Coordinate) => !coordinateIsEqual(coor1, coor2);

const extentIsEqual = (ext1: ol.Extent, ext2: ol.Extent) => {
  if (!ext1 && !ext2) {
    return true;
  }
  if (!ext1 || !ext2) {
    return false;
  }
  return ext1[0] === ext2[0] && ext1[1] === ext2[1] && ext1[2] === ext2[2] && ext1[3] === ext2[3];
};
const extentIsDifferent = (ext1: ol.Extent, ext2: ol.Extent) => !extentIsEqual(ext1, ext2);

/**
 * Een specialisatie van de subscriptionCmdOperator die specifiek werkt met KaartClassicMessages.
 */
export function classicMsgSubscriptionCmdOperator(
  dispatcher: KaartCmdDispatcher<KaartClassicMsg>,
  ...subscriptions: prt.Subscription<KaartClassicMsg>[]
): rx.Operator<KaartClassicSubMsg, string[]> {
  return subscriptionCmdOperator(dispatcher, ref => validation => KaartClassicMsg(SubscribedMsg(validation, ref)), ...subscriptions);
}
