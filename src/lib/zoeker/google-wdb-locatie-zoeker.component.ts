import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { kaartLogOnlyWrapper } from "../kaart/kaart-internal-messages";
import { KaartComponent } from "../kaart/kaart.component";
import { GoogleWdbLocatieZoekerService } from "./google-wdb-locatie-zoeker.service";

@Component({
  selector: "awv-google-wdb-locatie-zoeker",
  template: "<ng-content></ng-content>"
})
export class GoogleWdbLocatieZoekerComponent extends KaartChildComponentBase implements OnInit, OnDestroy {
  constructor(parent: KaartComponent, zone: NgZone, private readonly zoeker: GoogleWdbLocatieZoekerService) {
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
