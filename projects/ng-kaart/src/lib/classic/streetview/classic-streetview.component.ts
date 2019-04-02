import { Component, Injector } from "@angular/core";

import { StreetviewUiSelector } from "../../kaart/open-street-view/kaart-open-street-view.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-kaart-streetview",
  template: ""
})
export class ClassicStreetviewComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(StreetviewUiSelector, injector);
  }
}
