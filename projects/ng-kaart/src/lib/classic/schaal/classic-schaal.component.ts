import { Component, Injector } from "@angular/core";

import { SchaalUiSelector } from "../../kaart/schaal/kaart-schaal.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";

/**
 * Toont een schaalaanduiding rechts onderaan de kaart.
 */
@Component({
  selector: "awv-kaart-schaal",
  template: ""
})
export class ClassicSchaalComponent extends ClassicUIElementSelectorDirective {
  constructor(injector: Injector) {
    super(SchaalUiSelector, injector);
  }
}
