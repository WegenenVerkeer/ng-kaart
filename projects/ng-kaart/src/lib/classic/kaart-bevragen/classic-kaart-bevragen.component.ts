import { Component, Injector, Input, OnChanges } from "@angular/core";

import { BevraagKaartOpties, BevraagKaartUiSelector, UnitType, ZoekAfstand } from "../../kaart/kaart-bevragen/kaart-bevragen-opties";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import * as val from "../webcomponent-support/params";

/**
 * Gebruik deze component om in het linkerpaneel informatie over de coördinaat waar geklikt wordt in de kaart te laten
 * verschijnen. De coördinaat wordt getoond in Lambert 72 en WGS 84, en is niet configueerbaar. Er zijn 2 types
 * informatie die te voorschijn kunnen komen: standaard adres en locatiegegevens enerzijds en extra informatie over de
 * locatie anderzijds. De extra informatie kunnen bijvoorbeeld de gegevens zijn die via GetFeautureInfo call op een
 * WMS-laag bekomen worden.
 */
@Component({
  selector: "awv-bevraag-kaart",
  template: ""
})
export class ClassicKaartBevragenComponent extends ClassicUIElementSelectorComponentBase implements OnChanges {
  private _unit: UnitType = "Meter";
  private _zoekAfstand = 25;
  private _infoServicesOnderdrukt = false;
  private _kaartBevragenOnderdrukt = false;
  private _onderdrukInfoBoodschappen = false;

  /** De unit van de zoekAfstand: "Meter" of "Pixel", default is "Meter" */
  @Input()
  set unit(value: UnitType) {
    this._unit = val.enu<UnitType>(value, "Meter", "Pixel");
  }

  /** De zoekafstand om te gebuiken in het bevragen, default is 25 */
  @Input()
  set zoekAfstand(value: number) {
    this._zoekAfstand = val.num(value, this._zoekAfstand);
  }

  @Input()
  set infoServicesOnderdrukt(value: boolean) {
    this._infoServicesOnderdrukt = val.bool(value, this._infoServicesOnderdrukt);
  }

  @Input()
  set kaartBevragenOnderdrukt(value: boolean) {
    this._kaartBevragenOnderdrukt = val.bool(value, this._kaartBevragenOnderdrukt);
  }

  @Input()
  set onderdrukInfoBoodschappen(value: boolean) {
    this._onderdrukInfoBoodschappen = val.bool(value, this._onderdrukInfoBoodschappen);
  }

  constructor(injector: Injector) {
    super(BevraagKaartUiSelector, injector);
  }

  protected opties(): BevraagKaartOpties {
    return {
      zoekAfstand: ZoekAfstand(this._unit, this._zoekAfstand),
      infoServiceOnderdrukt: this._infoServicesOnderdrukt,
      kaartBevragenOnderdrukt: this._kaartBevragenOnderdrukt,
      onderdrukInfoBoodschappen: this._onderdrukInfoBoodschappen
    };
  }
}
