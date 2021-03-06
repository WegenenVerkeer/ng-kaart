import { Component, Injector, Input } from "@angular/core";
import { option } from "fp-ts";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemDirective } from "./classic-legende-item.directive";

/**
 * De component moet als child tag van een laag gebruikt worden, Wanneer de elementen op de laag zichtbaar zijn, wordt
 * dan in de lagenkiezer een lijn getoond met dit legende-item.
 *
 * Gebruik deze component voor laagelementen die als een lijn weergegeven worden.
 */
@Component({
  selector: "awv-legende-lijn-item",
  template: "<ng-content></ng-content>",
})
export class ClassicLegendeLijnItemComponent extends ClassicLegendeItemDirective {
  _achtergrondKleur: option.Option<string> = option.none;
  _kleur: string;

  /**
   * De voorgrondkleur van de lijn.
   */
  @Input()
  set kleur(param: string) {
    this._kleur = val.str(param, this._kleur);
  }

  /**
   * De achtergrongrondkleur van de lijn.
   */
  @Input()
  set achtergrondKleur(param: string) {
    this._achtergrondKleur = val.optStr(param);
  }

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Lijn",
      beschrijving: this._beschrijving,
      kleur: this._kleur,
      achtergrondKleur: this._achtergrondKleur,
    };
  }
}
