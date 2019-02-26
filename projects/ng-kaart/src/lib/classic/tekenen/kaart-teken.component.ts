import { Component, EventEmitter, Input, NgZone, OnInit, Output } from "@angular/core";
import { none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { identity, merge } from "rxjs";
import { distinctUntilChanged, map, switchMap, takeUntil } from "rxjs/operators";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { StartTekenen, StopTekenen, TekenenCommand, TekenSettings } from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { TekenenUiSelector } from "../../kaart/tekenen/kaart-teken-laag.component";
import { collect, ofType } from "../../util/operators";
import { classicMsgSubscriptionCmdOperator, KaartClassicComponent } from "../kaart-classic.component";
import { KaartClassicMsg, TekenGeomAangepastMsg } from "../messages";

@Component({
  selector: "awv-kaart-teken",
  template: "<ng-content></ng-content>"
})
export class KaartTekenComponent extends KaartComponentBase implements OnInit {
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();
  private tekenenCommandSubj = new rx.Subject<TekenenCommand>();

  @Input()
  set tekenen(teken: boolean) {
    if (teken) {
      this.tekenenCommandSubj.next(
        StartTekenen(
          TekenSettings(
            this.geometryType,
            this.geometry,
            ss.asStyleSelector(this.laagStyle),
            ss.asStyleSelector(this.drawStyle),
            this.meerdereGeometrieen
          )
        )
      );
    } else {
      this.tekenenCommandSubj.next(StopTekenen());
    }
  }

  @Input()
  set tekenenCommand(command: TekenenCommand) {
    this.tekenenCommandSubj.next(command);
  }

  @Input()
  private geometryType: ol.geom.GeometryType = "LineString";

  @Input()
  private laagStyle;

  @Input()
  private drawStyle: ol.style.Style;

  @Input()
  private meerdereGeometrieen = false;

  @Input()
  private geometry: Option<ol.geom.Geometry> = none;

  @Output()
  getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);

    this.initialising$.subscribe(() => this.kaart.dispatch(prt.VoegUiElementToe(TekenenUiSelector)));
    this.destroying$.subscribe(() => this.kaart.dispatch(prt.VerwijderUiElement(TekenenUiSelector)));
  }

  ngOnInit() {
    super.ngOnInit();
    this.bindToLifeCycle(
      this.tekenenCommandSubj.pipe(
        distinctUntilChanged(),
        collect(identity),
        switchMap((command: TekenenCommand) => {
          switch (command.type) {
            case "start":
              return merge(
                this.kaart.kaartClassicSubMsg$
                  .lift(
                    classicMsgSubscriptionCmdOperator(
                      this.kaart.dispatcher,
                      prt.GeometryChangedSubscription(command.settings, resultaat =>
                        KaartClassicMsg(TekenGeomAangepastMsg(resultaat.geometry))
                      )
                    )
                  )
                  .pipe(
                    takeUntil(this.stopTekenenSubj) // Unsubscribe bij stoppen met tekenen
                  ),
                this.kaart.kaartClassicSubMsg$.pipe(
                  ofType<TekenGeomAangepastMsg>("TekenGeomAangepast"), //
                  map(m => this.getekendeGeom.emit(m.geom)),
                  takeUntil(this.stopTekenenSubj)
                )
              );
            case "stop":
              this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
              this.stopTekenenSubj = new rx.Subject();
              return rx.EMPTY;
          }
        })
      )
    ).subscribe();
  }
}
