import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { UiElementOpties, VerwijderUiElement, VoegUiElementToe, ZetUiElementOpties } from "../kaart/kaart-protocol-commands";

import { LagenUiSelector } from "./lagenkiezer.component";

@Component({
  selector: "awv-kaart-lagenkiezer-config",
  template: ""
})
export class LagenkiezerConfigComponent implements OnInit, OnDestroy, OnChanges {
  constructor(private readonly kaart: KaartClassicComponent) {}

  @Input() titels: string[] = []; // TODO nog te implementeren om te beperken tot deze

  @Input() toonLegende = false;

  ngOnInit() {
    this.kaart.dispatch(VoegUiElementToe(LagenUiSelector));
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  ngOnDestroy() {
    this.kaart.dispatch(VerwijderUiElement(LagenUiSelector));
  }

  ngOnChanges(changes: SimpleChanges) {
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  private opties(): UiElementOpties {
    return {
      toonLegende: this.toonLegende
    };
  }
}
