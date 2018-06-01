import { Component } from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { ZoomknoppenUiSelector } from "../../kaart/zoom/kaart-zoom.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-zoomknoppen",
  template: ""
})
export class ClassicZoomComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(ZoomknoppenUiSelector, kaart);
  }

  protected opties(): prt.UiElementOpties {
    return {};
  }
}
