import { Component, Injector, Input } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-lijn-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeLijnItemComponent extends ClassicLegendeItemComponent {
  @Input()
  kleur: string;
  @Input()
  achtergrondKleur?: string;

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Lijn",
      beschrijving: this.beschrijving,
      kleur: this.kleur,
      achtergrondKleur: fromNullable(this.achtergrondKleur)
    };
  }
}
