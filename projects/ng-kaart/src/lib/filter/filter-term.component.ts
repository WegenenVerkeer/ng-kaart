import { Component, Input, NgZone } from "@angular/core";
import { option } from "fp-ts";
import { DateTime } from "luxon";

import { Filter as fltr } from "../filter/filter-model";
import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";
import { formateerDate } from "../util/date-time";

import { formatRelativeDateRange } from "./date-range-helper";

type BinaryComparisonOperatorMapping = { [P in fltr.BinaryComparisonOperator]: string };
type UnaryComparisonOperatorMapping = { [P in fltr.UnaryComparisonOperator]: string };

const binaryComparisonOperatorMapping: BinaryComparisonOperatorMapping = {
  equality: "is",
  inequality: "is niet",
  contains: "bevat",
  starts: "start met",
  ends: "eindigt met",
  smaller: "kleiner dan",
  smallerOrEqual: "kleiner of gelijk aan",
  larger: "groter dan",
  largerOrEqual: "groter dan of gelijk aan",
  within: "laatste"
};

const unaryComparisonOperatorMapping: UnaryComparisonOperatorMapping = {
  isEmpty: "heeft geen waarde",
  isNotEmpty: "heeft een waarde"
};

const booleanComparisonOperatorMapping = {
  equality: "is waar",
  inequality: "is niet waar"
};

@Component({
  selector: "awv-filter-term",
  templateUrl: "./filter-term.component.html",
  styleUrls: ["./filter-term.component.scss"]
})
export class FilterTermComponent extends KaartChildComponentBase {
  property: string;
  value: string | number;
  operator: string;

  @Input()
  public set term(term: fltr.Comparison) {
    this.property = term.property.label;
    switch (term.kind) {
      case "UnaryComparison":
        this.value = "";
        this.operator = unaryComparisonOperatorMapping[term.operator] || "???";
        break;
      case "BinaryComparison":
        if (term.property.type === "boolean") {
          this.value = "";
          this.operator = booleanComparisonOperatorMapping[term.operator] || "???";
        } else {
          this.value = fltr.matchLiteral({
            boolean: literal => (literal.value ? "Waar" : "Niet waar"),
            integer: literal => literal.value.toString(),
            double: literal => literal.value.toString(),
            string: literal => literal.value.toString(),
            date: literal => formateerDate(option.some("dd/MM/yyyy"))(literal.value as DateTime),
            datetime: () => "-", // nog niet ondersteund
            range: literal => formatRelativeDateRange(literal.value as fltr.RelativeDateRange)
          })(term.value);
          this.operator = binaryComparisonOperatorMapping[term.operator] || "???";
        }
    }
  }

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
