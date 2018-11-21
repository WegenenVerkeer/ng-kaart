import { Component, NgZone } from "@angular/core";

import { StreetviewUiSelector } from "../../kaart/open-street-view/kaart-open-street-view.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-streetview",
  template: ""
})
export class ClassicStreetviewComponent extends ClassicUIElementSelectorComponentBase {
  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(StreetviewUiSelector, kaart, zone);
  }
}
