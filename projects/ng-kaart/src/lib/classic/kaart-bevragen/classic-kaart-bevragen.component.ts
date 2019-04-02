import { Component, Injector } from "@angular/core";

import { BevraagKaartUiSelector } from "../../kaart/kaart-bevragen/kaart-bevragen.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-bevraag-kaart",
  template: ""
})
export class ClassicKaartBevragenComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(BevraagKaartUiSelector, injector);
  }
}
