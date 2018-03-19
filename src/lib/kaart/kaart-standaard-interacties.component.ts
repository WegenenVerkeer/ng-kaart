import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { VoegStandaardinteractiesToe, VerwijderStandaardinteracties } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  @Input() focusVoorZoom = false;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    // this.kaart.dispatch(new VoegStandaardinteractiesToe(this.focusVoorZoom));
  }

  ngOnDestroy(): void {
    // this.kaart.dispatch(new VerwijderStandaardinteracties());
  }
}
