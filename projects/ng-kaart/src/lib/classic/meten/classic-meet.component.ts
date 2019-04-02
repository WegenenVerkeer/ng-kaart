import { Component, Injector, Input } from "@angular/core";

import { MetenOpties, MetenUiSelector } from "../../kaart/meten/kaart-meten.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-meet-knop",
  template: ""
})
export class ClassicMetenComponent extends ClassicUIElementSelectorComponentBase {
  @Input()
  toonInfoBoodschap = true;
  @Input()
  meerdereGeometrieen = true;

  constructor(injector: Injector) {
    super(MetenUiSelector, injector);
  }

  protected opties(): MetenOpties {
    return {
      toonInfoBoodschap: this.toonInfoBoodschap,
      meerdereGeometrieen: this.meerdereGeometrieen
    };
  }
}
