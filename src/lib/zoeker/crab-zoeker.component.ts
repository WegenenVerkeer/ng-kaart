import { Component, Input, OnDestroy, OnInit, NgZone } from "@angular/core";

import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { CrabZoekerService } from "./crab-zoeker.service";
import { KaartCmdDispatcher, VacuousDispatcher } from "../kaart/kaart-event-dispatcher";
import { Observable } from "rxjs/Observable";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

@Component({
  selector: "awv-crab-zoeker",
  template: "<ng-content></ng-content>"
})
export class CrabZoekerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, zone: NgZone, private readonly zoeker: CrabZoekerService) {
    super(parent, zone);
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.dispatch({ type: "VoegZoekerToe", zoeker: this.zoeker, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();

    this.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });
  }
}
