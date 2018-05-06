import { Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { Laag, StyleSelector } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as ol from "openlayers";
import { getDefaultSelectionStyleFunction } from "./styles";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  protected voegLaagToeBijStart = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    if (this.voegLaagToeBijStart) {
      this.voegLaagToe();
    }
  }

  ngOnDestroy(): void {
    this.dispatch(prt.VerwijderLaagCmd(this.titel, kaartLogOnlyWrapper));
  }

  protected voegLaagToe() {
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: this.createLayer(),
      laaggroep: this.laaggroep(),
      magGetoondWorden: this.zichtbaar,
      wrapper: kaartLogOnlyWrapper
    });
  }

  protected dispatch(evt: prt.Command<KaartInternalMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): prt.Laaggroep;
}
