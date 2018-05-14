import { Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import * as option from "fp-ts/lib/Option";
import { some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable } from "rxjs/Observable";
import { map, share, tap } from "rxjs/operators";

import { classicLogger } from "../kaart-classic/log";
import {
  FeatureGedeselecteerdMsg,
  FeatureSelectieAangepastMsg,
  KaartClassicMsg,
  KaartClassicSubMsg,
  logOnlyWrapper,
  SubscribedMsg
} from "../kaart-classic/messages";
import { ofType, TypedRecord } from "../util/operators";

import { KaartComponentBase } from "./kaart-component-base";
import { KaartCmdDispatcher, ReplaySubjectKaartCmdDispatcher } from "./kaart-event-dispatcher";
import * as prt from "./kaart-protocol";
import { KaartMsgObservableConsumer } from "./kaart.component";
import { subscriptionCmdOperator } from "./subscription-helper";

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

  @Output() geselecteerdeFeatures: EventEmitter<List<ol.Feature>> = new EventEmitter();

  // TODO deze klasse en child components verhuizen naar classic directory, maar nog even wachten of we krijgen te veel merge conflicts
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

      // Een beetje overkill voor de ene kaart subscription die we nu hebben, maar het volgende zorgt voor automatisch beheer van de
      // kaart subscriptions.
      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.lift(
          classicMsgSubscriptionCmdOperator(
            this.dispatcher,
            prt.GeselecteerdeFeaturesSubscription(geselecteerdeFeatures =>
              KaartClassicMsg(FeatureSelectieAangepastMsg(geselecteerdeFeatures))
            )
          )
        )
      ).subscribe(err => classicLogger.error(err));

      // Zorg ervoor dat de geselecteerde features in de @Output terecht komen
      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.pipe(
          ofType<FeatureSelectieAangepastMsg>("FeatureSelectieAangepast"), //
          map(m => m.geselecteerdeFeatures)
        )
      ).subscribe(features => this.geselecteerdeFeatures.emit(features.geselecteerd));

      // Zorg ervoor dat deselecteer van een feature via infoboodschap terug naar kaart-reducer gaat
      this.bindToLifeCycle(
        this.kaartClassicSubMsg$.pipe(
          ofType<FeatureGedeselecteerdMsg>("FeatureGedeselecteerd"), //
          map(m => m.featureid)
        )
      ).subscribe(featureid => this.dispatch(prt.DeselecteerFeatureCmd(featureid)));

      // We kunnen hier makkelijk een mini-reducer zetten voor KaartClassicSubMsg mocht dat nodig zijn
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
    function forChangedValue(
      prop: string,
      action: (cur: any, prev: any) => void,
      pred: (cur: any, prev: any) => boolean = () => true
    ): void {
      if (prop in changes && (!changes[prop].previousValue || pred(changes[prop].currentValue, changes[prop].previousValue))) {
        action(changes[prop].currentValue, changes[prop].previousValue);
      }
    }

    forChangedValue("zoom", zoom => this.dispatch(prt.VeranderZoomCmd(zoom, logOnlyWrapper)));
    forChangedValue("middelpunt", middelpunt => this.dispatch(prt.VeranderMiddelpuntCmd(middelpunt)), coordinateIsDifferent);
    forChangedValue("extent", extent => this.dispatch(prt.VeranderExtentCmd(extent)), extentIsDifferent);
    forChangedValue("breedte", breedte => this.dispatch(prt.VeranderViewportCmd([breedte, this.hoogte])));
    forChangedValue("hoogte", hoogte => this.dispatch(prt.VeranderViewportCmd([this.breedte, hoogte])));
    forChangedValue("mijnLocatieZoom", zoom => this.dispatch(prt.ZetMijnLocatieZoomCmd(option.fromNullable(zoom))));
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

  toonIdentifyInformatie(id: string, titel: string, inhoud: string): void {
    this.dispatch(prt.ToonInfoBoodschapCmd(id, titel, inhoud, () => some(KaartClassicMsg(FeatureGedeselecteerdMsg(id)))));
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
