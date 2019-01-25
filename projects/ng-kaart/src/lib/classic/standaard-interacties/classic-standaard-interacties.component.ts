import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from "@angular/core";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class ClassicStandaardInteractiesComponent implements OnDestroy, OnChanges {
  @Input()
  focusVoorZoom = false;

  @Input()
  rotatie = false;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes.focusVoorZoom && !changes.focusVoorZoom.isFirstChange()) || (changes.rotatie && !changes.rotatie.isFirstChange())) {
      this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
    }
    this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this.focusVoorZoom, this.rotatie, kaartLogOnlyWrapper));
  }
}
