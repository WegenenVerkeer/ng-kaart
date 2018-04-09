import { Component, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";

@Component({
  selector: "awv-google-locatie-zoeker",
  template: "<ng-content></ng-content>"
})
export class GoogleLocatieZoekerComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent, private readonly zoeker: GoogleLocatieZoekerService) {}

  ngOnInit(): void {
    this.kaart.dispatch({ type: "VoegZoekerToe", zoeker: this.zoeker, wrapper: kaartLogOnlyWrapper });
  }

  ngOnDestroy(): void {
    this.kaart.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });
  }
}
