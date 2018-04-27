import { KaartClassicComponent } from "../kaart/kaart-classic.component";
import { Component, OnInit, OnDestroy, Input } from "@angular/core";
import { LagenUISelector } from "./lagenkiezer.component";
import { VoegUIElementToe, VerwijderUIElement } from "../kaart/kaart-protocol-commands";

@Component({
  selector: "awv-kaart-lagenkiezer-config",
  template: ""
})
export class LagenkiezerConfigComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent) {}

  @Input() titels: string[] = [];

  ngOnInit() {
    this.kaart.dispatch(VoegUIElementToe(LagenUISelector));
  }

  ngOnDestroy() {
    this.kaart.dispatch(VerwijderUIElement(LagenUISelector));
  }
}
