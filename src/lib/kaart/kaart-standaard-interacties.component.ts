import { Component, Input, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { AddedStandaardInteracties, RemovedStandaardInteracties } from "./kaart-protocol-events";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  @Input() focusVoorZoom = false;

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatcher.dispatch(new AddedStandaardInteracties(this.focusVoorZoom));
  }

  ngOnDestroy(): void {
    this.kaart.dispatcher.dispatch(new RemovedStandaardInteracties());
  }
}
