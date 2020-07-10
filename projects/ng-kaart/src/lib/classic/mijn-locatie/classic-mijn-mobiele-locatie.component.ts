import { Component, Injector } from "@angular/core";

import { MijnMobieleLocatieUiSelector } from "../../kaart/mijn-locatie/kaart-mijn-mobiele-locatie.component";

import { ClassicMijnLocatieDirective } from "./classic-mijn-locatie-base.component";

/**
 * De mijn-locatie tag zorgt voor een locatie tracker.
 */
@Component({
  selector: "awv-mijn-mobiele-locatie",
  template: ""
})
export class ClassicMijnMobieleLocatieComponent extends ClassicMijnLocatieDirective {
  constructor(injector: Injector) {
    super(MijnMobieleLocatieUiSelector, injector);
  }
}
