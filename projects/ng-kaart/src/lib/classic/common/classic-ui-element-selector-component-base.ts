import { NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";

export abstract class ClassicUIElementSelectorComponentBase extends KaartComponentBase implements OnInit, OnDestroy, OnChanges {
  constructor(readonly uiSelector: string, readonly kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);
  }

  ngOnInit(): void {
    super.ngOnInit();
    this.kaart.dispatch(prt.VoegUiElementToe(this.uiSelector));
    this.kaart.dispatch(prt.ZetUiElementOpties(this.uiSelector, this.opties()));
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.kaart.dispatch(prt.VerwijderUiElement(this.uiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaart.dispatch(prt.ZetUiElementOpties(this.uiSelector, this.opties()));
  }

  protected opties(): prt.UiElementOpties {
    return {};
  }
}
