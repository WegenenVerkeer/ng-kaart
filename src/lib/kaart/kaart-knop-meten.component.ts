import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartCmdDispatcher, VacuousDispatcher } from "./kaart-event-dispatcher";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";
import { ofType } from "../util/operators";
import { kaartLogger } from "./log";

@Component({
  selector: "awv-kaart-knop-meten",
  templateUrl: "./kaart-knop-meten.component.html",
  styleUrls: ["./kaart-knop-meten.component.scss"]
})
export class KaartKnopMekenLengteOppervlakteComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;

  private metende: boolean;

  constructor(zone: NgZone) {
    super(zone);
    this.metende = false;
  }

  ngOnDestroy(): void {
    this.stopMetMeten();
  }

  startMetMeten(): void {
    this.dispatcher.dispatch({ type: "MetenLengteOppervlakte", meten: true });
    this.metende = true;
  }

  stopMetMeten(): void {
    this.dispatcher.dispatch({ type: "MetenLengteOppervlakte", meten: false });
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
