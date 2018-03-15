import { Component, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { VoegSchaalToe, VerwijderSchaal } from "./kaart-protocol-commands";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatch(new VoegSchaalToe());
  }

  ngOnDestroy(): void {
    this.kaart.dispatch(new VerwijderSchaal());
  }
}
