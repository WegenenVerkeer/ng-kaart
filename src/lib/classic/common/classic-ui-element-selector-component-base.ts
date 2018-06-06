import { OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";

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

  protected opties(): prt.UiElementOpties {
    return {};
  }
}
