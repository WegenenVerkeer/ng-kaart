import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { Subject, ReplaySubject, Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { map, distinctUntilChanged, concatAll, mergeAll } from "rxjs/operators";
import * as ol from "openlayers";

import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";
import {
  MetenLengteOppervlakteMsg,
  SubscribedMsg,
  subscribedWrapper,
  GeometryChangedMsg,
  geometryChangedWrapper
} from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";
import { ofType } from "../util/operators";
import { forEach } from "../util/option";
import { kaartLogger } from "./log";
import { MetenLengteOppervlakteCmd } from "./kaart-protocol";
import { KaartWithInfo } from "./kaart-with-info";

@Component({
  selector: "awv-kaart-meten-logger",
  template: "<ng-content></ng-content>"
})
export class KaartMetenLoggerComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private geometries$: Observable<ol.geom.Geometry> = Observable.empty();
  private geometriesSubscription: Subscription;

  constructor(private readonly kaartComponent: KaartComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    this.kaartComponent.internalCmdDispatcher.dispatch(
      prt.SubscriptionCmd(prt.GeometryChangedSubscription(geometryChangedWrapper), subscribedWrapper({}))
    );

    this.geometries$ = this.kaartComponent.internalMessage$.pipe(ofType<GeometryChangedMsg>("GeometryChanged"), map(msg => msg.geometry));

    this.geometriesSubscription = this.geometries$.subscribe(geometry => {
      kaartLogger.debug("----------------Te meten geometry is aangepast------------------");
    });
  }

  ngOnDestroy(): void {
    this.geometriesSubscription.unsubscribe();
  }
}
