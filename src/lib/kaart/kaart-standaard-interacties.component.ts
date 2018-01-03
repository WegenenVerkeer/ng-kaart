import { Component, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";

import * as ol from "openlayers";

import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";
import { KaartClassicComponent } from "./kaart-classic.component";

@Component({
  selector: "awv-kaart-standaard-interacties",
  template: "<ng-content></ng-content>",
  encapsulation: ViewEncapsulation.None
})
export class KaartStandaardInteractiesComponent implements OnInit, OnDestroy {
  private interactions: ol.interaction.Interaction[];

  constructor(private readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.kaart.dispatcher.dispatch(new prt.AddedStandaardInteracties());
  }

  ngOnDestroy(): void {
    this.kaart.dispatcher.dispatch(new prt.RemovedStandaardInteracties());
  }
}
