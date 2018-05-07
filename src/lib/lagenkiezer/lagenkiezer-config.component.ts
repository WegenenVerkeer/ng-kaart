import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";

import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { VerwijderUiElement, VoegUiElementToe, ZetUiElementOpties } from "../kaart/kaart-protocol-commands";
import { LagenUiSelector } from "./lagenkiezer.component";
import { forChangedValue } from "../kaart/kaart-component-base";

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
    console.log("-----> changes", changes);
    this.kaart.dispatch(ZetUiElementOpties(LagenUiSelector, this.opties()));
  }

  private opties(): any {
    return {
      toonLegende: this.toonLegende
    };
  }
}
