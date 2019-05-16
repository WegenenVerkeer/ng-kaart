import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "../filter/filter-model";

const binaryComparisonOperatorMapping = {
  equality: "is",
  inequality: "is niet",
  contains: "bevat",
  starts: "begint met",
  ends: "eindigt met",
  smaller: "kleiner dan",
  smallerOrEqual: "kleiner of gelijk aan",
  larger: "groter dan",
  largerOrEqual: "groter dan of gelijk aan"
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
  public set term(term: fltr.BinaryComparison) {
    this.property = term.property.label;
    this.value = term.value.value.toString();
    this.operator = binaryComparisonOperatorMapping[term.operator];
  }

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
