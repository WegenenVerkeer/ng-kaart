import { Component, Input, NgZone, OnInit } from "@angular/core";

import { toonVoorwaardenMsgGen } from "../kaart-classic/messages";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-voorwaarden",
  template: "<ng-content></ng-content>"
})
export class KaartVoorwaardenComponent extends KaartComponentBase implements OnInit {
  @Input() href = "https://www.vlaanderen.be/nl/disclaimer";
  @Input() titel = "Voorwaarden";

  constructor(readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.ToonVoorWaardenCmd(this.titel, this.href, toonVoorwaardenMsgGen));
  }
}
