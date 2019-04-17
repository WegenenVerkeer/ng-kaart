import { Injector, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { ClassicBaseComponent } from "../classic-base.component";

export abstract class ClassicUIElementSelectorComponentBase extends ClassicBaseComponent implements OnInit, OnDestroy, OnChanges {
  private alToegevoegd = false;

  constructor(readonly uiSelector: string, injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.zetOpties();
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderUiElement(this.uiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.zetOpties();
  }

  private zetOpties() {
    if (!this.alToegevoegd) {
      this.kaart.dispatch(prt.VoegUiElementToe(this.uiSelector));
      this.alToegevoegd = true;
    }
    this.kaart.dispatch(prt.ZetUiElementOpties(this.uiSelector, this.opties()));
  }

  protected opties(): any {
    return {};
  }
}
