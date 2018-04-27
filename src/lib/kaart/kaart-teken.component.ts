import { Component, EventEmitter, Input, NgZone, OnInit, Output } from "@angular/core";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, map, takeUntil } from "rxjs/operators";

import { classicLogger } from "../kaart-classic/log";
import { KaartClassicMsg, TekenGeomAangepastMsg } from "../kaart-classic/messages";
import { ofType } from "../util/operators";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { TekenSettings } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { determineStyleSelector } from "./laag-converter";
import { TekenenUISelector } from "./kaart-teken-laag.component";

@Component({
  selector: "awv-kaart-teken",
  template: "<ng-content></ng-content>"
})
export class KaartTekenComponent extends KaartComponentBase implements OnInit {
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

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);

    this.initialising$.subscribe(() => this.kaart.dispatch(prt.VoegUIElementToe(TekenenUISelector)));
    this.destroying$.subscribe(() => this.kaart.dispatch(prt.VerwijderUIElement(TekenenUISelector)));
  }

  ngOnInit() {
    super.ngOnInit();
    // TODO: dit kan allicht eleganter met een switchMap
    this.bindToLifeCycle(this.aanHetTekenen.pipe(distinctUntilChanged())).subscribe(
      tekenen => (tekenen ? this.startTekenen() : this.stopTekenen())
    );
  }

  private startTekenen() {
    this.bindToLifeCycle(
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
          takeUntil(this.stopTekenenSubj) // Unsubscribe bij stoppen met tekenen
        )
    ).subscribe(err => classicLogger.error(err));

    // Zorg ervoor dat de getekende geom in de @Output terecht komen
    this.bindToLifeCycle(
      this.kaart.kaartClassicSubMsg$.pipe(
        ofType<TekenGeomAangepastMsg>("TekenGeomAangepast"), //
        map(m => m.geom)
      )
    ).subscribe(geom => this.getekendeGeom.emit(geom));
  }

  private stopTekenen() {
    this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
    this.stopTekenenSubj = new rx.Subject(); // en maak ons klaar voor de volgende ronde
  }
}
