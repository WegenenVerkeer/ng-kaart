import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import * as fltr from "../filter/filter-model";

@Component({
  selector: "awv-filter-expression",
  templateUrl: "./filter-expression.component.html",
  styleUrls: ["./filter-expression.component.scss"]
})
export class FilterExpressionComponent extends KaartChildComponentBase {
  @Input()
  expression: fltr.Expression;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }

  property(): string {
    return (<fltr.Comparison>this.expression).property.ref;
  }

  value(): string {
    return (<fltr.Comparison>this.expression).value.value.toString();
  }

  isEquality(): boolean {
    return this.expression.kind === "Equality";
  }

  isInequality(): boolean {
    return this.expression.kind === "Inequality";
  }

  isConjunction(): boolean {
    return this.expression.kind === "And";
  }

  isDisjunction(): boolean {
    return this.expression.kind === "Or";
  }

  left(): fltr.Expression {
    return (<fltr.LogicalConnective>this.expression).left;
  }

  right(): fltr.Expression {
    return (<fltr.LogicalConnective>this.expression).right;
  }
}
