import { Component, Injector } from "@angular/core";

import { SchaalUiSelector } from "../../kaart/schaal/kaart-schaal.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

/**
 * Toont een schaalaanduiding rechts onderaan de kaart.
 */
@Component({
  selector: "awv-kaart-schaal",
  template: ""
})
export class ClassicSchaalComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(SchaalUiSelector, injector);
  }
}
