import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter, Filter as fltr } from "../filter/filter-model";

@Component({
  selector: "awv-filter-conjunction",
  templateUrl: "./filter-conjunction.component.html",
  styleUrls: ["./filter-conjunction.component.scss"]
})
export class FilterConjunctionComponent extends KaartChildComponentBase {
  @Input()
  expression: fltr.Expression;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
