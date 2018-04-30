import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { KaartComponent } from "../kaart/kaart.component";
import { GoogleLocatieZoekerService } from "./google-locatie-zoeker.service";

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
    this.dispatch({ type: "VerwijderZoeker", zoeker: this.zoeker.naam(), wrapper: kaartLogOnlyWrapper });

    super.ngOnDestroy();
  }
}
