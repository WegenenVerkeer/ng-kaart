import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-conjunction",
  templateUrl: "./filter-conjunction.component.html",
  styleUrls: ["./filter-conjunction.component.scss"]
})
export class FilterConjunctionComponent {
  @Input()
  expression: fltr.Expression;
}
