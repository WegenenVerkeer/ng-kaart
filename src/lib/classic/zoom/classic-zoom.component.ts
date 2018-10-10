import { Component, NgZone } from "@angular/core";

import { ZoomknoppenUiSelector } from "../../kaart/zoom/kaart-zoom.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-zoomknoppen",
  template: ""
})
export class ClassicZoomComponent extends ClassicUIElementSelectorComponentBase {
  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(ZoomknoppenUiSelector, kaart, zone);
  }
}
