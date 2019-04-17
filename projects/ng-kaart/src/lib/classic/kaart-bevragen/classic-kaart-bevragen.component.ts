import { Component, Injector } from "@angular/core";

import { BevraagKaartUiSelector } from "../../kaart/kaart-bevragen/kaart-bevragen.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

/**
 * Gebruik deze component om in het linkerpaneel informatie over de coördinaat waar geklikt wordt in de kaart te laten
 * verschijnen. De coördinaat wordt getoond in Lambert 72 en WGS 84, en is niet configueerbaar.
 */
@Component({
  selector: "awv-bevraag-kaart",
  template: ""
})
export class ClassicKaartBevragenComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(BevraagKaartUiSelector, injector);
  }
}
