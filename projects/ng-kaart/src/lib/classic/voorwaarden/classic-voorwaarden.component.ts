import { Component, Injector, Input } from "@angular/core";

import { VoorwaardenOpties, VoorwaardenSelector } from "../../kaart/voorwaarden/kaart-voorwaarden.component";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

import * as val from "../webcomponent-support/params";

@Component({
  selector: "awv-kaart-voorwaarden",
  template: ""
})
export class ClassicVoorwaardenComponent extends ClassicUIElementSelectorComponentBase {
  _href = "https://www.vlaanderen.be/nl/disclaimer";
  _titel = "Voorwaarden";

  @Input()
  set href(param: string) {
    this._href = val.str(param, this._href);
  }

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
