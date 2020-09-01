import { Component, Injector, Input } from "@angular/core";

import {
  CopyrightOpties,
  CopyrightUISelector,
} from "../../kaart/copyright/kaart-copyright.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";
import * as val from "../webcomponent-support/params";

/**
 * De copyright tag zorgt voor een copyright boodschap rechts onderaan de kaart. De tekst van de boodschap is configureerbaar.
 */
@Component({
  selector: "awv-kaart-copyright",
  template: "",
})
export class ClassicCopyrightComponent extends ClassicUIElementSelectorDirective {
  private _copyright = "\u00A9 Agentschap Wegen en Verkeer";

  /**
   * De tekst die getoond wordt. Gebruik zelf het copyrightsymbool © indien je dit wenst te tonen.
   */
  @Input()
  set copyright(param: string) {
    this._copyright = val.str(param, this._copyright);
  }

  constructor(injector: Injector) {
    super(CopyrightUISelector, injector);
  }

  protected opties(): CopyrightOpties {
    return {
      copyright: this._copyright,
    };
  }
}
