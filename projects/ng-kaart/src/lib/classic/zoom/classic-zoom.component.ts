import { Component, Injector } from "@angular/core";

import { ZoomknoppenUiSelector } from "../../kaart/zoom/kaart-zoom.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";

/**
 * Deze component zorgt voor zoomknoppen aan de rechterkant van de kaart.
 */
@Component({
  selector: "awv-kaart-zoomknoppen",
  template: "",
})
export class ClassicZoomComponent extends ClassicUIElementSelectorDirective {
  constructor(injector: Injector) {
    super(ZoomknoppenUiSelector, injector);
  }
}
