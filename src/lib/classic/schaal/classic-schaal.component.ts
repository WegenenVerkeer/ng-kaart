import { Component } from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { SchaalUiSelector } from "../../kaart/schaal/kaart-schaal.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-schaal",
  template: ""
})
export class ClassicSchaalComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(SchaalUiSelector, kaart);
  }

  protected opties(): prt.UiElementOpties {
    return {};
  }
}
