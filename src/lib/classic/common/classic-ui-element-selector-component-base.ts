import { OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import { KaartClassicComponent } from "../../kaart/kaart-classic.component";
import * as prt from "../../kaart/kaart-protocol";

export abstract class ClassicUIElementSelectorComponentBase implements OnInit, OnDestroy, OnChanges {
  constructor(readonly uiSelector: string, readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch(prt.VoegUiElementToe(this.uiSelector));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerwijderUiElement(this.uiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaart.dispatch(prt.ZetUiElementOpties(this.uiSelector, this.opties()));
  }

  protected abstract opties(): prt.UiElementOpties;
}
