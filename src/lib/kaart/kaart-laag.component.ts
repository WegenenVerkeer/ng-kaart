import { Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { VoegLaagToe, KaartMessage, VerwijderLaag } from "./kaart-protocol-events";
import { Laag } from "./kaart-elementen";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.dispatch(new VoegLaagToe(0, this.createLayer(), this.zichtbaar));
  }

  ngOnDestroy(): void {
    this.dispatch(new VerwijderLaag(this.titel));
  }

  protected dispatch(evt: KaartMessage) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;
}
