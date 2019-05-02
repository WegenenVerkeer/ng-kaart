import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "../filter/filter-model";

@Component({
  selector: "awv-filter-term",
  templateUrl: "./filter-term.component.html",
  styleUrls: ["./filter-term.component.scss"]
})
export class FilterTermComponent extends KaartChildComponentBase {
  @Input()
  expression: fltr.Expression;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }

  property(): string {
    return (<fltr.Comparison>this.expression).property.label;
  }

  value(): string {
    return (<fltr.Comparison>this.expression).value.value.toString();
  }
}
