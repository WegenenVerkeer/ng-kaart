import { Component, Input, NgZone } from "@angular/core";

import { KaartChildComponentBase } from "../kaart/kaart-child-component-base";
import { KaartComponent } from "../kaart/kaart.component";

import { Filter as fltr } from "../filter/filter-model";

@Component({
  selector: "awv-filter-chip",
  templateUrl: "./filter-chip.component.html",
  styleUrls: ["./filter-chip.component.scss"]
})
export class FilterChipComponent extends KaartChildComponentBase {
  @Input()
  expression: fltr.Expression;

  constructor(kaart: KaartComponent, zone: NgZone) {
    super(kaart, zone);
  }
}
