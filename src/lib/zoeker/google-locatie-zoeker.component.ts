import { Component, Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";
import { KaartCmdDispatcher } from "../kaart/kaart-event-dispatcher";
import { KaartMsg } from "../kaart";

@Component({
  selector: "awv-google-locatie-zoeker",
  template: "<ng-content></ng-content>"
})
export class GoogleLocatieZoekerComponent implements OnInit, OnDestroy {
  @Input() dispatcher: KaartCmdDispatcher<KaartMsg>;

  constructor(private readonly zoeker: GoogleLocatieZoekerService, kaart?: KaartClassicComponent) {
    if (kaart) {
      this.dispatcher = kaart;
    }
  }

  ngOnInit(): void {
    this.dispatcher.dispatch({ type: "VoegZoekerToe", zoeker: this.zoeker, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    this.dispatcher.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });
  }
}
