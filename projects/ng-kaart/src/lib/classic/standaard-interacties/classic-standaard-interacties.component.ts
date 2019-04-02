import { Component, Injector, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseComponent } from "../classic-base.component";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicStandaardInteractiesComponent extends ClassicBaseComponent implements OnDestroy, OnChanges {
  @Input()
  focusVoorZoom = false;

  @Input()
  rotatie = false;

  constructor(injector: Injector) {
    super(injector);
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes.focusVoorZoom && !changes.focusVoorZoom.isFirstChange()) || (changes.rotatie && !changes.rotatie.isFirstChange())) {
      this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
    }
    this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this.focusVoorZoom, this.rotatie, kaartLogOnlyWrapper));
  }
}
