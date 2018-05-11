import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent extends KaartComponentBase implements OnInit, OnDestroy {
  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.VraagSchaalAanCmd(kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerwijderSchaalCmd(kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }
}
