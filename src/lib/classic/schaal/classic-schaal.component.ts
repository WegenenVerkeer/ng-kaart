import { Component } from "@angular/core";

import { KaartClassicComponent } from "../../kaart/kaart-classic.component";
import { SchaalUiSelector } from "../../kaart/schaal/kaart-schaal.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-kaart-schaal",
  template: ""
})
export class ClassicSchaalComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(SchaalUiSelector, kaart);
  }
}
