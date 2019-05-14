import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Endomorphism } from "fp-ts/lib/function";

import { FilterEditor as fed } from "../filter-builder";

@Component({
  selector: "awv-filter-query-builder",
  templateUrl: "./filter-query-builder.component.html",
  styleUrls: ["./filter-query-builder.component.scss"]
})
export class FilterQueryBuilderComponent {
  @Input()
  expressionEditor: fed.ExpressionEditor;

  @Output()
  newExpressionEditor: EventEmitter<Endomorphism<fed.ExpressionEditor>> = new EventEmitter();

  voegDisjunctionToe() {
    this.newExpressionEditor.emit(fed.addDisjunction);
  }

  onNewExpressionEditor(newExpressionEditor: Endomorphism<fed.ExpressionEditor>) {
    this.newExpressionEditor.next(newExpressionEditor);
  }
}
