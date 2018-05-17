import { OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "../../kaart";
import * as prt from "../../kaart/kaart-protocol";

export abstract class ClassicUIElementSelectorComponentBase implements OnInit, OnDestroy {
  constructor(readonly uiSelector: string, readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch(prt.VoegUiElementToe(this.uiSelector));
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(prt.VerwijderUiElement(this.uiSelector));
  }
}
