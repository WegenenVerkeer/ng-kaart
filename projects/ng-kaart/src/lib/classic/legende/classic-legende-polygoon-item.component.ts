import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemDirective } from "./classic-legende-item.directive";

/**
 * De component moet als child tag van een laag gebruikt worden, Wanneer de elementen op de laag zichtbaar zijn, wordt
 * dan in de lagenkiezer een lijn getoond met dit legende-item.
 *
 * Gebruik deze component voor laagelementen die als een polygoon weergegeven worden.
 */
@Component({
  selector: "awv-legende-polygoon-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendePolygoonItemComponent extends ClassicLegendeItemDirective {
  _kleur: string;

  /**
   * De opvulkleur van de polygoon.
   */
  @Input()
  set kleur(param: string) {
    this._kleur = val.str(param, this._kleur);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Polygoon",
      beschrijving: this._beschrijving,
      kleur: this._kleur
    };
  }
}
