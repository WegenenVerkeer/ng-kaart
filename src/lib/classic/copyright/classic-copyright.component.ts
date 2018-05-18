import { Component, Input } from "@angular/core";

import { CopyrightOpties, CopyrightSelector } from "../../kaart/copyright/kaart-copyright.component";
import { KaartClassicComponent } from "../../kaart/kaart-classic.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-kaart-copyright",
  template: ""
})
export class ClassicCopyrightComponent extends ClassicUIElementSelectorComponentBase {
  @Input() copyright = "\u00A9 Agentschap Wegen en Verkeer";

  constructor(readonly kaart: KaartClassicComponent) {
    super(CopyrightSelector, kaart);
  }

  protected opties(): CopyrightOpties {
    return {
      copyright: this.copyright
    };
  }
}
