import { Component, Input, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";

import * as prt from "./kaart-protocol";
import * as ke from "./kaart-elementen";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartEventDispatcher } from "./kaart-event-dispatcher";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.dispatch(new prt.AddedLaagOnTop(this.createLayer()));
  }

  ngOnDestroy(): void {
    this.dispatch(new prt.RemovedLaag(this.titel));
  }

  protected dispatch(evt: prt.KaartEvnt) {
    this.kaart.dispatcher.dispatch(evt);
  }

  abstract createLayer(): ke.Laag;
}
