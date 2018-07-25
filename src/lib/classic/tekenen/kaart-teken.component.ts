import { Component, EventEmitter, Input, NgZone, OnInit, Output } from "@angular/core";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { distinctUntilChanged, map, takeUntil } from "rxjs/operators";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { TekenSettings } from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { TekenenUiSelector } from "../../kaart/tekenen/kaart-teken-laag.component";
import { ofType } from "../../util/operators";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "../kaart-classic.component";
import { classicLogger } from "../log";
import { KaartClassicMsg, TekenGeomAangepastMsg } from "../messages";

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
  private _meerdereGeometrieen = false;
  @Input()
  set meerdereGeometrieen(meerdereGeometrieen: boolean) {
    this._meerdereGeometrieen = meerdereGeometrieen;
  }

  @Output() getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);

    this.initialising$.subscribe(() => this.kaart.dispatch(prt.VoegUiElementToe(TekenenUiSelector)));
    this.destroying$.subscribe(() => this.kaart.dispatch(prt.VerwijderUiElement(TekenenUiSelector)));
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
              TekenSettings(
                this._geometryType,
                ss.asStyleSelector(this._laagStyle),
                ss.asStyleSelector(this._drawStyle),
                this._meerdereGeometrieen
              ),
              resultaat => KaartClassicMsg(TekenGeomAangepastMsg(resultaat.geometry))
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
