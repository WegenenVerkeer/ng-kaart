import { Component, Injector, Input } from "@angular/core";

import { BevraagKaartOpties, BevraagKaartUiSelector, UnitType, ZoekAfstand } from "../../kaart/kaart-bevragen/kaart-bevragen.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

import * as val from "../webcomponent-support/params";

/**
 * Gebruik deze component om in het linkerpaneel informatie over de coördinaat waar geklikt wordt in de kaart te laten
 * verschijnen. De coördinaat wordt getoond in Lambert 72 en WGS 84, en is niet configueerbaar.
 */
@Component({
  selector: "awv-bevraag-kaart",
  template: ""
})
export class ClassicKaartBevragenComponent extends ClassicUIElementSelectorComponentBase {
  private _unit: UnitType = "Meter";
  private _zoekAfstand = 25;

  /** De unit van de zoekAfstand: "Meter" of "Pixel", default is "Meter" */
  @Input()
  set unit(param: UnitType) {
    this._unit = val.enu<UnitType>(param, "Meter", "Meter", "Pixel");
  }

  /** De zoekafstand om te gebuiken in het bevragen, default is 25 */
  @Input()
  set zoekAfstand(param: number) {
    this._zoekAfstand = val.num(param, this._zoekAfstand);
  }

  constructor(injector: Injector) {
    super(BevraagKaartUiSelector, injector);
  }

  protected opties(): BevraagKaartOpties {
    return {
      zoekAfstand: ZoekAfstand(this._unit, this._zoekAfstand)
    };
  }
}
