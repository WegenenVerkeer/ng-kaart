import { Component, Input, NgZone, OnInit } from "@angular/core";

import { toonCopyrightMsgGen } from "../kaart-classic/messages";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import * as prt from "./kaart-protocol";

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
    this.kaart.dispatch(prt.ToonCopyrightCmd(this.copyright, toonCopyrightMsgGen));
  }
}
