import { Component, Injector, Input } from "@angular/core";

import { MijnLocatieUiSelector } from "../../kaart/mijn-locatie/kaart-mijn-locatie.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

/**
 * De mijn-locatie tag zorgt voor een locatie tracker.
 */
@Component({
  selector: "awv-mijn-locatie",
  template: ""
})
export class ClassicMijnLocatieComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(MijnLocatieUiSelector, injector);
  }
}
