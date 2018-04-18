import { Component, NgZone, OnDestroy, OnInit, Input } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Subscription } from "rxjs";
import { Observable } from "rxjs/Observable";
import { map } from "rxjs/operators";

import { ofType } from "../lib/util/operators";
import { KaartInternalMsg, GeometryChangedMsg, geometryChangedWrapper, subscribedWrapper } from "../lib/kaart/kaart-internal-messages";
import * as prt from "../lib/kaart/kaart-protocol";
import { KaartComponent } from "../lib/kaart/kaart.component";
import { kaartLogger } from "../lib/kaart/log";

@Component({
  selector: "awv-kaart-meten-logger",
  template: "<ng-content></ng-content>"
})
export class KaartMetenLoggerComponent implements OnInit, OnDestroy {
  @Input() geometries$: Observable<ol.geom.Geometry> = Observable.empty();
  private geometriesSubscription: Subscription;

  ngOnInit(): void {
    this.geometriesSubscription = this.geometries$.subscribe(geometry => {
      kaartLogger.debug("----------------Te meten geometry is aangepast------------------");
    });
  }

  ngOnDestroy(): void {
    this.geometriesSubscription.unsubscribe();
  }
}
