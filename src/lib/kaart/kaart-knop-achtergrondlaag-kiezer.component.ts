import { Component, OnDestroy, OnInit, ViewEncapsulation, NgZone, Input } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";
import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopAchtergrondLaagKiezerComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input() titels: Array<string> = [""]; // FIXME: dit wordt nog/niet meer gebruikt, maar lijkt wel handig

  constructor(private readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.ToonAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerbergAchtergrondKeuzeCmd(kaartLogOnlyWrapper));
    super.ngOnDestroy();
  }
}
