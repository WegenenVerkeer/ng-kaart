import { Component, Input, NgZone } from "@angular/core";

import { MetenOpties, MetenUiSelector } from "../../kaart/meten/kaart-meten.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-meet-knop",
  template: ""
})
export class ClassicMetenComponent extends ClassicUIElementSelectorComponentBase {
  @Input() toonInfoBoodschap = true;
  @Input() meerdereGeometrieen = true;

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(MetenUiSelector, kaart, zone);
  }

  protected opties(): MetenOpties {
    return {
      toonInfoBoodschap: this.toonInfoBoodschap,
      meerdereGeometrieen: this.meerdereGeometrieen
    };
  }
}
