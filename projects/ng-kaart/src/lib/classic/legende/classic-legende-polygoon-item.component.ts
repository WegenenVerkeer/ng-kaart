import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-polygoon-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendePolygoonItemComponent extends ClassicLegendeItemComponent {
  @Input()
  kleur: string;

  constructor(injector: Injector) {
    super(injector);
  }

  maakLegendeItem(): LegendeItem {
    return {
      type: "Polygoon",
      beschrijving: this.beschrijving,
      kleur: this.kleur
    };
  }
}
