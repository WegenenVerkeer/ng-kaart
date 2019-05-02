import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-chip",
  templateUrl: "./filter-chip.component.html",
  styleUrls: ["./filter-chip.component.scss"]
})
export class FilterChipComponent {
  @Input()
  expression: fltr.Expression;
}
