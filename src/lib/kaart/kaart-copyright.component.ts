import { Component, Input, NgZone, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import * as prt from "./kaart-protocol";

import { CopyrightOpties, CopyrightSelector } from "./kaart-voorwaarden-box.component";

@Component({
  selector: "awv-kaart-copyright",
  template: "<ng-content></ng-content>"
})
export class KaartCopyrightComponent extends KaartComponentBase implements OnInit {
  @Input() copyright = "\u00A9 Agentschap Wegen en Verkeer";

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.ZetUiElementOpties(CopyrightSelector, CopyrightOpties(this.copyright)));
  }
}
