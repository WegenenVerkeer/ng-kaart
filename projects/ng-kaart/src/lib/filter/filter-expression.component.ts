import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "./filter-model";

@Component({
  selector: "awv-filter-expression",
  templateUrl: "./filter-expression.component.html",
  styleUrls: ["./filter-expression.component.scss"]
})
export class FilterExpressionComponent extends KaartChildComponentBase {
  left?: fltr.Expression;
  right?: fltr.Expression;
  term?: fltr.BinaryComparison;
  kind: fltr.Expression["kind"];

  @Input()
  public set expression(v: fltr.Expression) {
    this.kind = v.kind;
    switch (v.kind) {
      case "And":
      case "Or":
        this.left = v.left;
        this.right = v.right;
        this.term = undefined;
        break;
      case "BinaryComparison":
        this.left = undefined;
        this.right = undefined;
        this.term = v;
    }
  }

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
