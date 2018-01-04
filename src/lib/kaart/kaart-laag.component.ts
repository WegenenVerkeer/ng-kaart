import { Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { AddedLaagOnTop, KaartEvnt, RemovedLaag } from "./kaart-protocol-events";
import { Laag } from "./kaart-elementen";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.dispatch(new AddedLaagOnTop(this.createLayer()));
  }

  ngOnDestroy(): void {
    this.dispatch(new RemovedLaag(this.titel));
  }

  protected dispatch(evt: KaartEvnt) {
    this.kaart.dispatcher.dispatch(evt);
  }

  abstract createLayer(): Laag;
}
