import { Component, ElementRef, Injector, Input, NgZone } from "@angular/core";

import { VoorwaardenOpties, VoorwaardenSelector } from "../../kaart/voorwaarden/kaart-voorwaarden.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicLocatorService } from "../kaart-classic-locator.service";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-voorwaarden",
  template: ""
})
export class ClassicVoorwaardenComponent extends ClassicUIElementSelectorComponentBase {
  @Input()
  href = "https://www.vlaanderen.be/nl/disclaimer";
  @Input()
  titel = "Voorwaarden";

  constructor(injector: Injector) {
    super(VoorwaardenSelector, injector);
  }

  protected opties(): VoorwaardenOpties {
    return {
      titel: this.titel,
      href: this.href
    };
  }
}
