import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import * as ke from "../kaart/kaart-elementen";
import * as cmd from "../kaart/kaart-protocol-commands";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "./filter-model";

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

  left(): fltr.Expression {
    return (<fltr.LogicalConnective>this.expression).left;
  }

  right(): fltr.Expression {
    return (<fltr.LogicalConnective>this.expression).right;
  }
}
