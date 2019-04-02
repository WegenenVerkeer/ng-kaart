import { Component, Injector, Input } from "@angular/core";

import { CopyrightOpties, CopyrightUISelector } from "../../kaart/copyright/kaart-copyright.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

@Component({
  selector: "awv-kaart-copyright",
  template: ""
})
export class ClassicCopyrightComponent extends ClassicUIElementSelectorComponentBase {
  @Input()
  copyright = "\u00A9 Agentschap Wegen en Verkeer";

  constructor(injector: Injector) {
    super(CopyrightUISelector, injector);
  }

  protected opties(): CopyrightOpties {
    return {
      copyright: this.copyright
    };
  }
}
