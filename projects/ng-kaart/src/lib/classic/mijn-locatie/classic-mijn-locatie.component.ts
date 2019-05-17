import { Component, Injector } from "@angular/core";

import { MijnLocatieUiSelector } from "../../kaart/mijn-locatie/kaart-mijn-locatie.component";

import { ClassicMijnLocatieBaseComponent } from "./classic-mijn-locatie-base.component";

/**
 * De mijn-locatie tag zorgt voor een locatie tracker.
 */
@Component({
  selector: "awv-mijn-locatie",
  template: ""
})
export class ClassicMijnLocatieComponent extends ClassicMijnLocatieBaseComponent {
  constructor(injector: Injector) {
    super(MijnLocatieUiSelector, injector);
  }
}
