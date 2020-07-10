import { Component, Injector, Input } from "@angular/core";

import { VoorwaardenOpties, VoorwaardenSelector } from "../../kaart/voorwaarden/kaart-voorwaarden.component";
import { ClassicUIElementSelectorDirective } from "../common/classic-ui-element-selector.directive";

import * as val from "../webcomponent-support/params";

/**
 * Voegt onderaan een link toe die naar een arbitraire pagina kan verwijzen. De bedoeling is om te verwijzen naar de
 * algemene voorwaarden, maar het zou bijvoorbeeld ook een helptekst kunnen zijn.
 *
 * De link opent in een nieuw venster.
 */
@Component({
  selector: "awv-kaart-voorwaarden",
  template: ""
})
export class ClassicVoorwaardenComponent extends ClassicUIElementSelectorDirective {
  _href = "https://www.vlaanderen.be/nl/disclaimer";
  _titel = "Voorwaarden";

  /**
   * De URL van de pagina die geopend moet worden.
   */
  @Input()
  set href(param: string) {
    this._href = val.str(param, this._href);
  }

  /**
   * De titel van de link zoals die onderaan rechts getoond wordt.
   */
  @Input()
  set titel(param: string) {
    this._titel = val.str(param, this._titel);
  }

  constructor(injector: Injector) {
    super(VoorwaardenSelector, injector);
  }

  protected opties(): VoorwaardenOpties {
    return {
      titel: this._titel,
      href: this._href
    };
  }
}
