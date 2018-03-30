import { Component, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import {
  KaartInternalMsg,
  KaartInternalSubMsg,
  forgetWrapper,
  zoominstellingenGezetWrapper,
  ZoominstellingenGezetMsg,
  subscribedWrapper,
  SubscribedMsg
} from "./kaart-internal-messages";
import { ofType } from "../util/operators";
import { kaartLogger } from "./log";
import * as prt from "./kaart-protocol";

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
  private readonly subscriptions: prt.SubscriptionResult[] = [];
  kaartProps$: Observable<KaartProps> = Observable.empty();

  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    this.dispatcher.dispatch(prt.SubscriptionCmd(prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper), subscribedWrapper({})));

    this.kaartProps$ = this.internalMessage$.pipe(
      ofType<ZoominstellingenGezetMsg>("ZoominstellingenGezet"),
      map(m => ({
        canZoomIn: m.zoominstellingen.zoom + 1 <= m.zoominstellingen.maxZoom,
        canZoomOut: m.zoominstellingen.zoom - 1 >= m.zoominstellingen.minZoom,
        zoom: m.zoominstellingen.zoom
      }))
    );
    this.internalMessage$
      .pipe(ofType<SubscribedMsg>("Subscribed")) //
      .subscribe(sm =>
        sm.subscription.fold(
          kaartLogger.error, //
          sub => this.subscriptions.push(sub)
        )
      );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => this.dispatcher.dispatch(prt.UnsubscriptionCmd(sub)));
    this.subscriptions.splice(0, this.subscriptions.length);
    super.ngOnDestroy();
  }

  zoomIn(props: KaartProps) {
    if (props.canZoomIn) {
      this.dispatcher.dispatch({ type: "VeranderZoom", zoom: props.zoom + 1, wrapper: forgetWrapper });
    }
  }

  zoomOut(props: KaartProps) {
    if (props.canZoomOut) {
      this.dispatcher.dispatch({ type: "VeranderZoom", zoom: props.zoom - 1, wrapper: forgetWrapper });
    }
  }
}
