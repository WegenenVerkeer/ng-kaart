import { Component } from "@angular/core";

import { BevraagKaartUiSelector } from "../../kaart/kaart-bevragen/kaart-bevragen.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-bevraag-kaart",
  template: ""
})
export class ClassicKaartBevragenComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(BevraagKaartUiSelector, kaart);
  }
}
