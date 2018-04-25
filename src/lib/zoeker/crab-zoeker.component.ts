import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { KaartInternalMsg, KaartInternalSubMsg, kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { CrabZoekerService } from "./crab-zoeker.service";
import { KaartCmdDispatcher, VacuousDispatcher } from "../kaart/kaart-event-dispatcher";
import { Observable } from "rxjs/Observable";

@Component({
  selector: "awv-crab-zoeker",
  template: "<ng-content></ng-content>"
})
export class CrabZoekerComponent implements OnInit, OnDestroy {
  @Input() dispatcher: KaartCmdDispatcher<KaartInternalMsg> = VacuousDispatcher;
  @Input() internalMessage$: Observable<KaartInternalSubMsg> = Observable.never();

  constructor(private readonly zoeker: CrabZoekerService) {}

  ngOnInit(): void {
    this.dispatcher.dispatch({ type: "VoegZoekerToe", zoeker: this.zoeker, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    this.dispatcher.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });
  }
}
