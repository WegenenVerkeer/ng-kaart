import { Component, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { AddedSchaal, RemovedSchaal } from "./kaart-protocol-events";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent implements OnInit, OnDestroy {
  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatcher.dispatch(new AddedSchaal());
  }

  ngOnDestroy(): void {
    this.kaart.dispatcher.dispatch(new RemovedSchaal());
  }
}
