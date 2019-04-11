import { Component, Injector, Input } from "@angular/core";
import { fromNullable, none, Option } from "fp-ts/lib/Option";

import { LegendeItem } from "../../kaart/kaart-legende";
import * as val from "../webcomponent-support/params";

import { ClassicLegendeItemComponent } from "./classic-legende-item.component";

@Component({
  selector: "awv-legende-lijn-item",
  template: "<ng-content></ng-content>"
})
export class ClassicLegendeLijnItemComponent extends ClassicLegendeItemComponent {
  _achtergrondKleur: Option<string> = none;
  _kleur: string;

  @Input()
  set kleur(param: string) {
    this._kleur = val.str(param, this._kleur);
  }

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
      achtergrondKleur: this._achtergrondKleur
    };
  }
}
