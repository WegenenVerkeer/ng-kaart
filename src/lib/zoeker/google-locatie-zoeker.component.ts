import { Component, Input, OnDestroy, OnInit, NgZone } from "@angular/core";

import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { KaartCmdDispatcher, VacuousDispatcher } from "../kaart/kaart-event-dispatcher";
import { Observable } from "rxjs/Observable";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

@Component({
  selector: "awv-google-locatie-zoeker",
  template: "<ng-content></ng-content>"
})
export class GoogleLocatieZoekerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, zone: NgZone, private readonly zoeker: GoogleLocatieZoekerService) {
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
