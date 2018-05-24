import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "../classic/kaart-classic.component";

import { kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  @Input() focusVoorZoom = false;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch(prt.VoegStandaardInteractiesToeCmd(this.focusVoorZoom, kaartLogOnlyWrapper));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerwijderStandaardInteractiesCmd(kaartLogOnlyWrapper));
  }
}
