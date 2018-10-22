import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicAchtergrondSelectorComponent extends KaartComponentBase implements OnInit, OnDestroy {
  @Input()
  titels: Array<string> = [""]; // FIXME: dit wordt nog/niet meer gebruikt, maar lijkt wel handig

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
