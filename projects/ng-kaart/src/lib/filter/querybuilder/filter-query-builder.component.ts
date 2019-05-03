import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-query-builder",
  templateUrl: "./filter-query-builder.component.html",
  styleUrls: ["./filter-query-builder.component.scss"]
})
export class FilterQueryBuilderComponent {
  comp1 = fltr.Equality(fltr.Property("string", "ident8", "Ident8"), fltr.Literal("string", "R0040001"));
  comp2 = fltr.Equality(fltr.Property("string", "type", "Type"), fltr.Literal("string", "Aanliggend"));
  comp3 = fltr.Inequality(fltr.Property("string", "type", "Type"), fltr.Literal("string", "Verhoogd"));

  conj1 = fltr.Conjunction(this.comp1, this.comp2);
  conj2 = fltr.Conjunction(this.conj1, this.comp3);
  conj3 = fltr.Conjunction(this.conj2, this.comp2);

  disj1 = fltr.Disjunction(this.conj1, this.conj3);
  disj2 = fltr.Disjunction(this.disj1, this.disj1);

  @Input()
  expression: fltr.Expression = this.disj2;

  property(): string {
    return (<fltr.Comparison>this.expression).property.ref;
  }

  value(): string {
    return (<fltr.Comparison>this.expression).value.value.toString();
  }
}
