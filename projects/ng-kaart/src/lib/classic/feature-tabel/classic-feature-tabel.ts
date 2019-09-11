import { Component, Injector, Input } from "@angular/core";

import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

import { FeatureTabelUiOpties, FeatureTabelUiSelector } from "../../kaart/feature-tabel";
import * as val from "../webcomponent-support/params";

/**
 * Gebruik deze component om een tabel met features beschikbaar te maken.
 */
@Component({
  selector: "awv-feature-tabel",
  template: ""
})
export class ClassicFeatureTabelComponent extends ClassicUIElementSelectorComponentBase {
  private _zichtbaar = true;

  /** Mag de tabel getoond worden. */
  @Input()
  set zichtbaar(param: boolean) {
    this._zichtbaar = val.bool(param, this._zichtbaar);
  }

  constructor(injector: Injector) {
    super(FeatureTabelUiSelector, injector);
  }

  protected opties(): FeatureTabelUiOpties {
    return {
      zichtbaar: this._zichtbaar,
      filterbareLagen: true
    };
  }
}
