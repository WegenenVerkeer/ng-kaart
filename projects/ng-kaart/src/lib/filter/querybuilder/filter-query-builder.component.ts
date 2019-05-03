import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-query-builder",
  templateUrl: "./filter-query-builder.component.html",
  styleUrls: ["./filter-query-builder.component.scss"]
})
export class FilterQueryBuilderComponent {
  typeIsAanliggend = fltr.Equality(fltr.Property("string", "type", "Type"), fltr.Literal("string", "Aanliggend"));
  typeIsNietVerhoogd = fltr.Inequality(fltr.Property("string", "type", "Type"), fltr.Literal("string", "Verhoogd"));

  ident8IsR4 = fltr.Equality(fltr.Property("string", "ident8", "Ident8"), fltr.Literal("string", "R0040001"));
  ident8IsR1 = fltr.Equality(fltr.Property("string", "ident8", "Ident8"), fltr.Literal("string", "R0010001"));
  ident8IsR8 = fltr.Equality(fltr.Property("string", "ident8", "Ident8"), fltr.Literal("string", "R0080001"));

  incomplete = fltr.Incomplete(fltr.Property("string", "?", "?"), fltr.Literal("string", "?"));

  conj1 = fltr.Conjunction(this.ident8IsR4, this.typeIsAanliggend);
  conj2 = fltr.Conjunction(this.conj1, this.typeIsNietVerhoogd);

  conj3 = fltr.Conjunction(this.ident8IsR1, this.typeIsAanliggend);

  disj1 = fltr.Disjunction(this.conj2, this.conj3);
  disj2 = fltr.Disjunction(this.disj1, this.ident8IsR8);
  disj3 = fltr.Disjunction(this.disj2, this.incomplete);

  @Input()
  expression: fltr.Expression = this.disj3;

  property(): string {
    return (<fltr.Comparison>this.expression).property.ref;
  }

  value(): string {
    return (<fltr.Comparison>this.expression).value.value.toString();
  }
}
