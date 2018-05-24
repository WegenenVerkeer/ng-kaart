import { Component, Input } from "@angular/core";

import { VoorwaardenOpties, VoorwaardenSelector } from "../../kaart/voorwaarden/kaart-voorwaarden.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-voorwaarden",
  template: ""
})
export class ClassicVoorwaardenComponent extends ClassicUIElementSelectorComponentBase {
  @Input() href = "https://www.vlaanderen.be/nl/disclaimer";
  @Input() titel = "Voorwaarden";

  constructor(readonly kaart: KaartClassicComponent) {
    super(VoorwaardenSelector, kaart);
  }

  protected opties(): VoorwaardenOpties {
    return {
      titel: this.titel,
      href: this.href
    };
  }
}
