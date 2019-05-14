import { Component, EventEmitter, Input, Output } from "@angular/core";
import { Endomorphism } from "fp-ts/lib/function";

import { FilterEditor as fed } from "../filter-builder";

@Component({
  selector: "awv-filter-conjunction",
  templateUrl: "./filter-conjunction.component.html",
  styleUrls: ["./filter-conjunction.component.scss"]
})
export class FilterConjunctionComponent {
  @Input()
  editor: fed.ConjunctionEditor;

  @Input()
  globalExpressionEditor: fed.ExpressionEditor;

  @Output()
  newExpressionEditor: EventEmitter<Endomorphism<fed.ExpressionEditor>> = new EventEmitter();

  voegConjunctionToe() {
    this.newExpressionEditor.emit(fed.addConjunction(this.editor));
  }

  onNewExpressionEditor(newExpressionEditor: Endomorphism<fed.ExpressionEditor>) {
    this.newExpressionEditor.next(newExpressionEditor);
  }
}
