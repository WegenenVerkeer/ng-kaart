import { Component, Injector } from "@angular/core";

import { ZoomknoppenUiSelector } from "../../kaart/zoom/kaart-zoom.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-kaart-zoomknoppen",
  template: ""
})
export class ClassicZoomComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(ZoomknoppenUiSelector, injector);
  }
}
