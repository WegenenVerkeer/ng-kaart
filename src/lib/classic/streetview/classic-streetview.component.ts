import { Component } from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { StreetviewUiSelector } from "../../kaart/open-street-view/kaart-open-street-view.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-streetview",
  template: ""
})
export class ClassicStreetviewComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(StreetviewUiSelector, kaart);
  }

  protected opties(): prt.UiElementOpties {
    return {};
  }
}
