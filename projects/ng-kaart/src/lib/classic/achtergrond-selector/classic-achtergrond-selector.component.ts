import { Component, Injector, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseComponent } from "../classic-base.component";

@Component({
  selector: "awv-kaart-knop-achtergrondlaag-kiezer",
  template: "",
  encapsulation: ViewEncapsulation.None
})
export class ClassicAchtergrondSelectorComponent extends ClassicBaseComponent implements OnInit, OnDestroy {
  constructor(injector: Injector) {
    super(injector);
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
