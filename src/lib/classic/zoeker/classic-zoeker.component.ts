import { Component } from "@angular/core";

import { ZoekerUiSelector } from "../../zoeker/box/zoeker-box.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-zoeker",
  template: ""
})
export class ClassicZoekerComponent extends ClassicUIElementSelectorComponentBase {
  constructor(readonly kaart: KaartClassicComponent) {
    super(ZoekerUiSelector, kaart);
  }
}
