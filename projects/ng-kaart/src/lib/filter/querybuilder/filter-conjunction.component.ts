import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Endomorphism } from "fp-ts/lib/function";

import { FilterEditor as fed } from "../filter-builder";

@Component({
  selector: "awv-filter-conjunction",
  templateUrl: "./filter-conjunction.component.html",
  styleUrls: ["./filter-conjunction.component.scss"],
})
export class FilterConjunctionComponent {
  @Input()
  editor: fed.ConjunctionEditor;

  @Input()
  expressionEditor: fed.ExpressionEditor;

  @Output()
  expressionEditorUpdate: EventEmitter<
    Endomorphism<fed.ExpressionEditor>
  > = new EventEmitter();

  voegConjunctionToe(isLast: boolean) {
    if (isLast) {
      this.expressionEditorUpdate.emit(fed.addConjunction(this.editor));
    }
  }

  onExpressionEditorUpdate(
    expressionEditorUpdate: Endomorphism<fed.ExpressionEditor>
  ) {
    this.expressionEditorUpdate.next(expressionEditorUpdate);
  }
}
