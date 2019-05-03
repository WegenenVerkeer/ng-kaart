import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-disjunction",
  templateUrl: "./filter-disjunction.component.html",
  styleUrls: ["./filter-disjunction.component.scss"]
})
export class FilterDisjunctionComponent {
  @Input()
  expression: fltr.Expression;
}
