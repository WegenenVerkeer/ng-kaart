import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-bolletje-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeBolletjeItemComponent extends ClassicLegendeItemComponent {
  @Input()
  kleur: string;

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Bolletje",
      beschrijving: this.beschrijving,
      kleur: this.kleur
    };
  }
}
