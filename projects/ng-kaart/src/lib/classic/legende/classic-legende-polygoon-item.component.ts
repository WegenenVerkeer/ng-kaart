import { Component, Injector, Input } from "@angular/core";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-polygoon-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendePolygoonItemComponent extends ClassicLegendeItemComponent {
  _kleur: string;

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
