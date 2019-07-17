import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "../filter/filter-model";

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
  largerOrEqual: "groter dan of gelijk aan"
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
  value: string;
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
          this.value = term.value.value.toString();
          this.operator = binaryComparisonOperatorMapping[term.operator] || "???";
        }
    }
  }

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
