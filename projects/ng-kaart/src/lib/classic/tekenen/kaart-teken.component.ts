import {
  Component,
  EventEmitter,
  Injector,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { option } from "fp-ts";
import * as rx from "rxjs";
import { identity, merge } from "rxjs";
import {
  distinctUntilChanged,
  map,
  switchMap,
  takeUntil,
} from "rxjs/operators";

import {
  StartTekenen,
  StopTekenen,
  TekenenCommand,
  TekenSettings,
} from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import * as ss from "../../kaart/stijl-selector";
import { TekenenUiSelector } from "../../kaart/tekenen/kaart-teken-laag.component";
import * as ol from "../../util/openlayers-compat";
import { collect, ofType } from "../../util/operators";
import { ClassicBaseDirective } from "../classic-base.directive";
import { classicMsgSubscriptionCmdOperator } from "../kaart-classic.component";
import { KaartClassicMsg, TekenGeomAangepastMsg } from "../messages";
import * as val from "../webcomponent-support/params";

@Component({
  selector: "awv-kaart-teken",
  template: "<ng-content></ng-content>",
})
export class KaartTekenComponent
  extends ClassicBaseDirective
  implements OnInit {
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();
  private tekenenCommandSubj = new rx.Subject<TekenenCommand>();

  @Input()
  set tekenen(param: boolean) {
    const teken = val.bool(param, false);
    if (teken) {
      this.tekenenCommandSubj.next(
        StartTekenen(
          TekenSettings(
            this.geometryTypeValue,
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

  private geometryTypeValue: ol.geom.GeometryType =
    ol.geom.GeometryType.LINE_STRING;

  @Input()
  set geometryType(geomType: string) {
    switch (geomType) {
      case "Point":
        this.geometryTypeValue = ol.geom.GeometryType.POINT;
        break;
      case "LineString":
        this.geometryTypeValue = ol.geom.GeometryType.LINE_STRING;
        break;
      case "LinearRing":
        this.geometryTypeValue = ol.geom.GeometryType.LINEAR_RING;
        break;
      case "Polygon":
        this.geometryTypeValue = ol.geom.GeometryType.POLYGON;
        break;
      case "MultiPoint":
        this.geometryTypeValue = ol.geom.GeometryType.MULTI_POINT;
        break;
      case "MultiLineString":
        this.geometryTypeValue = ol.geom.GeometryType.MULTI_LINE_STRING;
        break;
      case "MultiPolygon":
        this.geometryTypeValue = ol.geom.GeometryType.MULTI_POLYGON;
        break;
      case "GeometryCollection":
        this.geometryTypeValue = ol.geom.GeometryType.GEOMETRY_COLLECTION;
        break;
      case "Circle":
        this.geometryTypeValue = ol.geom.GeometryType.CIRCLE;
        break;
    }
  }

  @Input()
  private laagStyle;

  @Input()
  private drawStyle: ol.style.Style;

  @Input()
  private meerdereGeometrieen = false;

  @Input()
  private geometry: option.Option<ol.geom.Geometry> = option.none;

  @Output()
  getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  constructor(injector: Injector) {
    super(injector);

    this.initialising$.subscribe(() =>
      this.kaart.dispatch(prt.VoegUiElementToe(TekenenUiSelector))
    );
    this.destroying$.subscribe(() =>
      this.kaart.dispatch(prt.VerwijderUiElement(TekenenUiSelector))
    );
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
                      prt.GeometryChangedSubscription(
                        command.settings,
                        (resultaat) =>
                          KaartClassicMsg(
                            TekenGeomAangepastMsg(resultaat.geometry)
                          )
                      )
                    )
                  )
                  .pipe(
                    takeUntil(this.stopTekenenSubj) // Unsubscribe bij stoppen met tekenen
                  ),
                this.kaart.kaartClassicSubMsg$.pipe(
                  ofType<TekenGeomAangepastMsg>("TekenGeomAangepast"), //
                  map((m) => this.getekendeGeom.emit(m.geom)),
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
