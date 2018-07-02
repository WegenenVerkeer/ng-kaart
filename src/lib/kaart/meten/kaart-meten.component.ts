import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { none } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, startWith, takeUntil } from "rxjs/operators";

import { dimensieBeschrijving } from "../../util/geometries";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { TekenSettings } from "../kaart-elementen";
import { GeometryChangedMsg, geometryChangedWrapper } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { InfoBoodschapAlert } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";
import { internalMsgSubscriptionCmdOperator } from "../subscription-helper";

export const MetenUiSelector = "Meten";

export interface MetenOpties {
  toonInfoBoodschap: boolean;
}

@Component({
  selector: "awv-kaart-meten",
  templateUrl: "./kaart-meten.component.html",
  styleUrls: ["./kaart-meten.component.scss"]
})
export class KaartMetenComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  @Output() getekendeGeom: EventEmitter<ol.geom.Geometry> = new EventEmitter();

  private toonInfoBoodschap = true;
  private metenActief = false;
  private stopTekenenSubj: rx.Subject<void> = new rx.Subject<void>();

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  public get isMetenActief(): boolean {
    return this.metenActief;
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.bindToLifeCycle(
      this.modelChanges.uiElementOpties$.pipe(
        filter(optie => optie.naam === MetenUiSelector),
        map(o => o.opties.toonInfoBoodschap),
        startWith(true)
      )
    ).subscribe(toon => (this.toonInfoBoodschap = toon));
  }

  ngOnDestroy(): void {
    this.stopMetMeten();
    super.ngOnDestroy();
  }

  toggleMeten(): void {
    if (this.metenActief) {
      this.metenActief = false;
      this.stopMetMeten();
    } else {
      this.metenActief = true;
      this.startMetMeten();
    }
  }

  private startMetMeten(): void {
    this.bindToLifeCycle(
      this.internalMessage$.lift(
        internalMsgSubscriptionCmdOperator(
          this.kaartComponent.internalCmdDispatcher,
          prt.GeometryChangedSubscription(TekenSettings("Polygon", none, none), geometryChangedWrapper)
        )
      )
    )
      .pipe(takeUntil(this.stopTekenenSubj))
      .subscribe(
        err => kaartLogger.error("De meten subscription gaf een logische fout", err),
        err => kaartLogger.error("De meten subscription gaf een technische fout", err),
        () => kaartLogger.debug("De meten source is gestopt")
      );

    this.internalMessage$
      .pipe(
        ofType<GeometryChangedMsg>("GeometryChanged"), //
        observeOnAngular(this.zone)
      )
      .subscribe(msg => {
        this.getekendeGeom.next(msg.geometry);
        if (this.toonInfoBoodschap) {
          this.dispatch(
            prt.ToonInfoBoodschapCmd({
              id: "meten-resultaat",
              type: "InfoBoodschapAlert",
              titel: "Meten",
              sluitbaar: false,
              message: this.helpText(msg.geometry),
              verbergMsgGen: () => none // TODO: stop tekenen event moet gestuurd worden
            })
          );
        }
      });
  }

  private stopMetMeten(): void {
    this.stopTekenenSubj.next(); // zorg dat de unsubscribe gebeurt
    this.stopTekenenSubj = new rx.Subject(); // en maak ons klaar voor de volgende ronde

    this.dispatch(prt.VerbergInfoBoodschapCmd("meten-resultaat"));
  }

  helpText(geometry: ol.geom.Geometry): string {
    return dimensieBeschrijving(geometry);
  }
}
