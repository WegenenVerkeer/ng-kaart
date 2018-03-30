import { Component, OnDestroy, OnInit, ViewEncapsulation, NgZone, Input } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "<awv-kaart-achtergrond-selector></awv-kaart-achtergrond-selector>",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopAchtergrondLaagKiezerComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() titels: Array<string> = [""];

  constructor(private readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    // Dit commando mag maar verstuurd worden als de achtergrondlagen al in het model zitten. Dat is zo als de
    // tag in de html na de lagen tags komt.
    this.kaart.dispatch(prt.ToonAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerbergAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }
}
