import { Component, EventEmitter, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { Predicate } from "fp-ts/lib/function";
import { none, some } from "fp-ts/lib/Option";
import { Set } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { filter, map, startWith, takeUntil, tap } from "rxjs/operators";

import * as clr from "../../stijl/colour";
import { dimensieBeschrijving } from "../../util/geometries";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType, subSpy } from "../../util/operators";
import { TekenSettings } from "../kaart-elementen";
import { GeometryChangedMsg, InfoBoodschappenMsg, tekenResultaatWrapper, verwijderTekenFeatureWrapper } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { DrawOpsCmd } from "../kaart-protocol-commands";
import { InfoBoodschap } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";
import { internalMsgSubscriptionCmdOperator } from "../subscription-helper";
import { StartDrawing, StopDrawing } from "../tekenen/tekenen-model";

export const MultiMetenUiSelector = "MultiMeten";

export interface MultiMetenOpties {
  readonly markColour: clr.Kleur;
  readonly useRouting: boolean;
}

@Component({
  selector: "awv-kaart-multi-meten",
  templateUrl: "./kaart-multi-meten.component.html",
  styleUrls: ["./kaart-multi-meten.component.scss"]
})
export class KaartMultiMetenComponent extends KaartModusComponent implements OnInit, OnDestroy {
  private metenOpties: MultiMetenOpties = {
    markColour: clr.zwart, // Wschl beter ineens een stijl, dan kan het helemaal gecustomiseerd worden
    useRouting: false
  };

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);

    this.runInViewReady(
      this.modelChanges.uiElementOpties$.pipe(
        filter(optie => optie.naam === MultiMetenUiSelector),
        tap(o => (this.metenOpties = o.opties as MultiMetenOpties))
      )
    );
  }

  modus(): string {
    return MultiMetenUiSelector;
  }

  activeer() {
    this.startMetMeten();
  }

  deactiveer() {
    this.stopMetenEnVerbergBoodschapen();
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  ngOnDestroy(): void {
    this.stopMetenEnVerbergBoodschapen();
    super.ngOnDestroy();
  }

  private startMetMeten(): void {
    this.dispatch(DrawOpsCmd(StartDrawing(this.metenOpties.markColour, this.metenOpties.useRouting)));
  }

  private stopMeten(): void {
    this.dispatch(DrawOpsCmd(StopDrawing()));
  }

  private stopMetenEnVerbergBoodschapen(): void {
    this.stopMeten();

    // Sluit alle meten infoboxen.
  }
}
