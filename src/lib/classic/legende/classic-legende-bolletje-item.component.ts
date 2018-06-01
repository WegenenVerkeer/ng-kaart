import { Component, forwardRef, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-bolletje-item",
  template: "<ng-content></ng-content>",
  // De volgende lijn is nodig om de @ContentChildren(ClassicLegendeItemComponent) te laten werken
  providers: [{ provide: ClassicLegendeItemComponent, useExisting: forwardRef(() => ClassicLegendeBolletjeItemComponent) }]
})
export class ClassicLegendeBolletjeItemComponent extends ClassicLegendeItemComponent {
  @Input() kleur: string;

  maakLegendeItem(): LegendeItem {
    return {
      type: "Bolletje",
      beschrijving: this.beschrijving,
      kleur: this.kleur
    };
  }
}
