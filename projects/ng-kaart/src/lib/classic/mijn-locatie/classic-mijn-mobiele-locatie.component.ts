import { Component, Injector, Input } from "@angular/core";

import { MijnMobieleLocatieUiSelector } from "../../kaart/mijn-locatie/kaart-mijn-mobiele-locatie.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

/**
 * De mijn-locatie tag zorgt voor een locatie tracker.
 */
@Component({
  selector: "awv-mijn-mobiele-locatie",
  template: ""
})
export class ClassicMijnMobieleLocatieComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(MijnMobieleLocatieUiSelector, injector);
  }
}
