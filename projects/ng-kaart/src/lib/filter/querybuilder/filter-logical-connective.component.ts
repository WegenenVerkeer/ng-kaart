import { Component, Input } from "@angular/core";

import { Filter as fltr } from "../../filter/filter-model";

@Component({
  selector: "awv-filter-logical-connective",
  templateUrl: "./filter-logical-connective.component.html",
  styleUrls: ["./filter-logical-connective.component.scss"]
})
export class FilterLogicalConnectiveComponent {
  @Input()
  operator: "EN" | "OF";

  @Input()
  clickable = false;

  @Input()
  expression;

  get clickStyle(): string {
    return this.clickable ? "klikbaar" : "";
  }

  onClick() {
    switch (this.operator) {
      case "EN":
        // TODO: nieuwe conjunction toevoegen
        const conj = fltr.Conjunction(this.expression, fltr.Incomplete(fltr.Property("string", "?", "?"), fltr.Literal("string", "?")));
        break;
      case "OF":
        // TODO: nieuwe disjunction toevoegen
        const disj = fltr.Disjunction(this.expression, fltr.Incomplete(fltr.Property("string", "?", "?"), fltr.Literal("string", "?")));
        break;
    }
  }
}
