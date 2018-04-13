import { Component, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";
import { Subscription as RxSubscription } from "rxjs/Subscription";

import { ofType } from "../util/operators";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import {
  KaartInternalMsg,
  KaartInternalSubMsg,
  kaartLogOnlyWrapper,
  ZoominstellingenGezetMsg,
  zoominstellingenGezetWrapper
} from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";
import { internalMsgSubscriptionCmdOperator } from "./subscription-helper";

export interface KaartProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoom: number;
}

@Component({
  selector: "awv-kaart-zoom",
  templateUrl: "./kaart-zoom.component.html",
  styleUrls: ["./kaart-zoom.component.scss"]
})
export class KaartZoomComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private subHelperSub: RxSubscription = new RxSubscription();
  kaartProps$: Observable<KaartProps> = Observable.empty();

  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    this.subHelperSub.unsubscribe(); // voor de zekerheid
    this.subHelperSub = this.internalMessage$
      .lift(internalMsgSubscriptionCmdOperator(this.dispatcher, prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper)))
      .subscribe(err => kaartLogger.error);

    this.kaartProps$ = this.internalMessage$.pipe(
      ofType<ZoominstellingenGezetMsg>("ZoominstellingenGezet"),
      map(m => ({
        canZoomIn: m.zoominstellingen.zoom + 1 <= m.zoominstellingen.maxZoom,
        canZoomOut: m.zoominstellingen.zoom - 1 >= m.zoominstellingen.minZoom,
        zoom: m.zoominstellingen.zoom
      }))
    );
  }

  ngOnDestroy() {
    this.subHelperSub.unsubscribe(); // Stop met luisteren op subscriptions
    super.ngOnDestroy();
  }

  zoomIn(props: KaartProps) {
    if (props.canZoomIn) {
      this.dispatcher.dispatch(prt.VeranderZoomCmd(props.zoom + 1, kaartLogOnlyWrapper));
    }
  }

  zoomOut(props: KaartProps) {
    if (props.canZoomOut) {
      this.dispatcher.dispatch(prt.VeranderZoomCmd(props.zoom - 1, kaartLogOnlyWrapper));
    }
  }
}
