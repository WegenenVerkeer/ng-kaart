import { Component, Input } from "@angular/core";

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

  get clickStyle(): string {
    return this.clickable ? "klikbaar" : "";
  }
}
