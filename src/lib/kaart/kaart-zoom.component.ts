import { Component, Input, NgZone, OnDestroy, OnChanges } from "@angular/core";
import { SimpleChanges, OnInit } from "@angular/core/src/metadata/lifecycle_hooks";
import { Observable } from "rxjs/Observable";
import { map, tap, filter } from "rxjs/operators";

import { KaartWithInfo } from "./kaart-with-info";
import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { VeranderZoomniveau } from "./kaart-protocol-commands";
import { observeOnAngular } from "../util/observe-on-angular";
import {
  KaartInternalMsg,
  KaartInternalSubMsg,
  forgetWrapper,
  zoominstellingenGezetWrapper,
  ZoominstellingenGezetMsg
} from "./kaart-internal-messages";
import { emitSome, ofType } from "../util/operators";
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
export class KaartZoomComponent extends KaartComponentBase implements OnInit, OnChanges, OnDestroy {
  kaartProps$: Observable<KaartProps> = Observable.empty();

  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(zone: NgZone) {
    super(zone);
  }

  ngOnInit() {
    this.dispatcher.dispatch({
      type: "Subscription",
      subscription: prt.ZoominstellingenSubscription(zoominstellingenGezetWrapper),
      wrapper: forgetWrapper // TODO we moeten hier de subscription opvangen
    });
    this.kaartProps$ = this.internalMessage$.pipe(
      ofType<KaartInternalSubMsg, ZoominstellingenGezetMsg>("ZoominstellingenGezet"),
      map(m => ({
        canZoomIn: m.zoominstellingen.zoom + 1 <= m.zoominstellingen.maxZoom,
        canZoomOut: m.zoominstellingen.zoom - 1 >= m.zoominstellingen.minZoom,
        zoom: m.zoominstellingen.zoom
      }))
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    // this.kaartProps$ = this.kaartModel$.pipe(
    //   map(m => ({
    //     canZoomIn: KaartZoomComponent.canZoomIn(m),
    //     canZoomOut: KaartZoomComponent.canZoomOut(m),
    //     zoom: m.zoom
    //   })),
    //   observeOnAngular(this.zone)
    // );
  }

  ngOnDestroy() {
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
