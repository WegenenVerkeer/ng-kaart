import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { forgetWrapper } from "./kaart-internal-messages";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  @Input() focusVoorZoom = false;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch({ type: "VoegStandaardInteractiesToe", scrollZoomOnFocus: this.focusVoorZoom, wrapper: forgetWrapper });
  }

  ngOnDestroy(): void {
    this.kaart.dispatch({ type: "VerwijderStandaardInteracties", wrapper: forgetWrapper });
  }
}
