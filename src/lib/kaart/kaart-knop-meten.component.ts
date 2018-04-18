import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";
import { ofType } from "../util/operators";
import { kaartLogger } from "./log";
import { KaartClassicComponent } from "./kaart-classic.component";
import { StartTekenenCmd, StopTekenenCmd } from "./kaart-protocol";

@Component({
  selector: "awv-kaart-knop-meten",
  templateUrl: "./kaart-knop-meten.component.html",
  styleUrls: ["./kaart-knop-meten.component.scss"]
})
export class KaartKnopMetenLengteOppervlakteComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private metende: boolean;

  constructor(zone: NgZone, private readonly kaartClassicComponent: KaartClassicComponent) {
    super(zone);
    this.metende = false;
  }

  ngOnDestroy(): void {
    this.stopMetMeten();
  }

  startMetMeten(): void {
    this.kaartClassicComponent.dispatch(StartTekenenCmd());
    this.metende = true;
  }

  stopMetMeten(): void {
    this.kaartClassicComponent.dispatch(StopTekenenCmd());
    this.metende = false;
  }

  toggleMeten(): void {
    if (this.metende) {
      this.stopMetMeten();
    } else {
      this.startMetMeten();
    }
  }
}
