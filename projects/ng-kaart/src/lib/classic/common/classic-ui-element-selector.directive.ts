import {
  Directive,
  Injector,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { OptiesRecord } from "../../kaart/ui-element-opties";
import { ClassicBaseDirective } from "../classic-base.directive";

@Directive()
export abstract class ClassicUIElementSelectorDirective
  extends ClassicBaseDirective
  implements OnInit, OnDestroy, OnChanges {
  private alToegevoegd = false;

  constructor(readonly uiSelector: string, injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    super.ngOnInit();
    if (!this.alToegevoegd) {
      this.kaart.dispatch(prt.VoegUiElementToe(this.uiSelector));
      this.alToegevoegd = true;
    } else {
      console.error("****Tiens", this.uiSelector);
    }
    this.zetOpties();
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderUiElement(this.uiSelector));
  }

  ngOnChanges(_changes: SimpleChanges) {
    this.zetOpties();
  }

  private zetOpties() {
    this.kaart.dispatch(prt.ZetUiElementOpties(this.uiSelector, this.opties()));
  }

  protected opties(): OptiesRecord {
    return {};
  }
}
