import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import * as ol from "openlayers";
import { Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { ofType } from "../util/operators";
import { KaartInternalMsg, GeometryChangedMsg, geometryChangedWrapper, subscribedWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";
import { kaartLogger } from "./log";
import { KaartChildComponentBase } from "./kaart-child-component-base";

@Component({
  selector: "awv-kaart-meten-logger",
  template: "<ng-content></ng-content>"
})
export class KaartMetenLoggerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  private geometries$: Observable<ol.geom.Geometry> = Observable.empty();
  private geometriesSubscription: Subscription;

  constructor(zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.GeometryChangedSubscription(geometryChangedWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.geometries$ = this.internalMessage$.pipe(ofType<GeometryChangedMsg>("GeometryChanged"), map(msg => msg.geometry));

    this.geometriesSubscription = this.geometries$.subscribe(geometry => {
      kaartLogger.debug("----------------Te meten geometry is aangepast------------------");
    });
  }

  ngOnDestroy(): void {
    this.geometriesSubscription.unsubscribe();
    super.ngOnDestroy();
  }
}
