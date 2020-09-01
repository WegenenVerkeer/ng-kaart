import { Component, Injector } from "@angular/core";

import { FeatureTabelUiSelector } from "../../kaart/feature-tabel";
import { OptiesRecord } from "../../kaart/ui-element-opties";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";

/**
 * Gebruik deze component om een tabel met features beschikbaar te maken.
 */
@Component({
  selector: "awv-feature-tabel",
  template: "",
})
export class ClassicFeatureTabelComponent extends ClassicUIElementSelectorDirective {
  constructor(injector: Injector) {
    super(FeatureTabelUiSelector, injector);
  }

  protected opties(): OptiesRecord {
    return {
      dataHeaderMenuExtraKnoppen: [
        {
          matIcon: "file_download",
          tooltip: "Exporteer data",
          actie: "export",
        },
      ],
    };
  }
}
