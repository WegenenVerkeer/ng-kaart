import { Component, Injector, Input, OnChanges } from "@angular/core";

import { IdentifyOpties, IdentifyUiSelector } from "../../kaart/kaart-bevragen/kaart-identify-opties";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import * as val from "../webcomponent-support/params";

/**
 * Gebruik deze component om in het linkerpaneel informatie over de coördinaat waar geklikt wordt in de kaart te laten
 * verschijnen. De coördinaat wordt getoond in Lambert 72 en WGS 84, en is niet configueerbaar.
 */
@Component({
  selector: "awv-kaart-identify",
  template: ""
})
export class ClassicKaartIdentifyComponent extends ClassicUIElementSelectorComponentBase implements OnChanges {
  private _identifyOnderdrukt = false;

  @Input()
  set identifyOnderdrukt(value: boolean) {
    this._identifyOnderdrukt = val.bool(value, this._identifyOnderdrukt);
  }

  constructor(injector: Injector) {
    super(IdentifyUiSelector, injector);
  }

  protected opties(): IdentifyOpties {
    return {
      identifyOnderdrukt: this._identifyOnderdrukt
    };
  }
}
