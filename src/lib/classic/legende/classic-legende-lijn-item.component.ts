import { Component, forwardRef, Input } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-lijn-item",
  template: "<ng-content></ng-content>",
  // De volgende lijn is nodig om de @ContentChildren(ClassicLegendeItemComponent) te laten werken
  providers: [{ provide: ClassicLegendeItemComponent, useExisting: forwardRef(() => ClassicLegendeLijnItemComponent) }]
})
export class ClassicLegendeLijnItemComponent extends ClassicLegendeItemComponent {
  @Input() kleur: string;
  @Input() achtergrondKleur?: string;

  maakLegendeItem(): LegendeItem {
    return {
      type: "Lijn",
      beschrijving: this.beschrijving,
      kleur: this.kleur,
      achtergrondKleur: fromNullable(this.achtergrondKleur)
    };
  }
}
