import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter, Filter as fltr } from "../filter/filter-model";

@Component({
  selector: "awv-filter-query-builder",
  templateUrl: "./filter-query-builder.component.html",
  styleUrls: ["./filter-query-builder.component.scss"]
})
export class FilterQueryBuilderComponent extends KaartChildComponentBase {
  comp1 = fltr.Equality(fltr.Property("string", "ident8", "Ident8"), fltr.Literal("string", "R0040001"));
  comp2 = fltr.Equality(fltr.Property("string", "type", "Type"), fltr.Literal("string", "Aanliggend"));
  conj = fltr.Conjunction(this.comp1, this.comp2);

  @Input()
  expression: fltr.Expression = this.conj;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }

  property(): string {
    return (<fltr.Comparison>this.expression).property.ref;
  }

  value(): string {
    return (<fltr.Comparison>this.expression).value.value.toString();
  }
}
