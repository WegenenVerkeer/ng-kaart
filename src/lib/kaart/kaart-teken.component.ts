import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, map, takeUntil } from "rxjs/operators";

import { classicLogger } from "../kaart-classic/log";
import { KaartClassicMsg, TekenGeomAangepastMsg } from "../kaart-classic/messages";
import { ofType } from "../util/operators";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "./kaart-classic.component";
import { TekenSettings } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { determineStyleSelector } from "./laag-converter";

@Component({
  selector: "awv-kaart-teken",
  template: "<ng-content></ng-content>"
})
export class KaartTekenComponent implements OnDestroy {
  private readonly destroyingSubj: rx.Subject<void> = new rx.Subject<void>();
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();
  private _geometryType: ol.geom.GeometryType = "LineString";
  private aanHetTekenen = new rx.BehaviorSubject<boolean>(false);
  @Input()
  set tekenen(teken: boolean) {
    this.aanHetTekenen.next(teken);
  }
  @Input()
  set geometryType(gtype: ol.geom.GeometryType) {
    this._geometryType = gtype;
  }
  private _laagStyle;
  @Input()
  set laagStyle(style: ol.style.Style) {
    this._laagStyle = style;
  }
  private _drawStyle;
  @Input()
  set drawStyle(style: ol.style.Style) {
    this._drawStyle = style;
  }
  @Output() getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  constructor(readonly kaart: KaartClassicComponent) {
    this.aanHetTekenen.pipe(distinctUntilChanged()).subscribe(tekenen => (tekenen ? this.startTekenen() : this.stopTekenen()));
  }

  ngOnDestroy() {
    this.destroyingSubj.next();
  }

  private startTekenen() {
    this.kaart.kaartClassicSubMsg$
      .lift(
        classicMsgSubscriptionCmdOperator(
          this.kaart.dispatcher,
          prt.GeometryChangedSubscription(
            TekenSettings(this._geometryType, determineStyleSelector(this._laagStyle), determineStyleSelector(this._drawStyle)),
            geom => KaartClassicMsg(TekenGeomAangepastMsg(geom))
          )
        )
      )
      .pipe(
        takeUntil(this.destroyingSubj), // Autounsubscribe by stoppen van de component
        takeUntil(this.stopTekenenSubj) // En bij stoppen met tekenen
      )
      .subscribe(err => classicLogger.error(err));

    // Zorg ervoor dat de getekende geom in de @Output terecht komen
    this.kaart.kaartClassicSubMsg$
      .pipe(
        ofType<TekenGeomAangepastMsg>("TekenGeomAangepast"), //
        map(m => m.geom),
        takeUntil(this.destroyingSubj)
      )
      .subscribe(geom => this.getekendeGeom.emit(geom));
  }

  private stopTekenen() {
    this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
    this.stopTekenenSubj = new rx.Subject(); // en maak ons klaar voor de volgende ronde
  }
}
