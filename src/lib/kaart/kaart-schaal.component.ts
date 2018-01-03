import { Component, OnDestroy, OnInit } from "@angular/core";

import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";
import { KaartComponent } from "./kaart.component";
import { KaartComponentBase } from "./kaart-component-base";
import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartEventDispatcher } from "./kaart-event-dispatcher";

@Component({
  selector: "awv-kaart-schaal",
  template: "<ng-content></ng-content>"
})
export class KaartSchaalComponent implements OnInit, OnDestroy {
  private scaleLine: ol.control.Control;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatcher.dispatch(new prt.AddedSchaal());
  }

  ngOnDestroy(): void {
    this.kaart.dispatcher.dispatch(new prt.RemovedSchaal());
  }
}
