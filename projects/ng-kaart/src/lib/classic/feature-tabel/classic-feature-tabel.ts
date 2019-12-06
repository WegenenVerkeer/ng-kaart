import { Component, Injector, Input } from "@angular/core";

import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

import { FeatureTabelUiSelector } from "../../kaart/feature-tabel";
import * as val from "../webcomponent-support/params";

/**
 * Gebruik deze component om een tabel met features beschikbaar te maken.
 */
@Component({
  selector: "awv-feature-tabel",
  template: ""
})
export class ClassicFeatureTabelComponent extends ClassicUIElementSelectorComponentBase {
  constructor(injector: Injector) {
    super(FeatureTabelUiSelector, injector);
  }

  protected opties(): object {
    return {
      dataHeaderMenuExtraKnoppen: [
        {
          matIcon: "file_download",
          tooltip: "Exporteer data",
          actie: "export"
        }
      ]
    };
  }
}
