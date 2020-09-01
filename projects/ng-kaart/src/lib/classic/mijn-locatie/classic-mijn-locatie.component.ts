import { Component, Injector } from "@angular/core";

import { MijnLocatieUiSelector } from "../../kaart/mijn-locatie/kaart-mijn-locatie.component";

import { ClassicMijnLocatieDirective } from "./classic-mijn-locatie-base.component";

/**
 * De mijn-locatie tag zorgt voor een locatie tracker.
 */
@Component({
  selector: "awv-mijn-locatie",
  template: "",
})
export class ClassicMijnLocatieComponent extends ClassicMijnLocatieDirective {
  constructor(injector: Injector) {
    super(MijnLocatieUiSelector, injector);
  }
}
