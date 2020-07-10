import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemDirective } from "./classic-legende-item.directive";

/**
 * De component moet als child tag van een laag gebruikt worden, Wanneer de elementen op de laag zichtbaar zijn, wordt
 * dan in de lagenkiezer een lijn getoond met dit legende-item.
 *
 * Gebruik deze component voor laagelementen die als een cirkel weergegeven worden.
 */
@Component({
  selector: "awv-legende-bolletje-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeBolletjeItemComponent extends ClassicLegendeItemDirective {
  _kleur: string;

  /**
   * De kleur van het bolletje.
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
      type: "Bolletje",
      beschrijving: this._beschrijving,
      kleur: this._kleur
    };
  }
}
