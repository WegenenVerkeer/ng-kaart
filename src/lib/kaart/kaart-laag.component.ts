import { Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { Laag } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { KaartInternalMsg, forgetWrapper } from "./kaart-internal-messages";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: this.createLayer(),
      laaggroep: this.laaggroep(),
      magGetoondWorden: this.zichtbaar,
      wrapper: forgetWrapper
    });
  }

  ngOnDestroy(): void {
    this.dispatch({ type: "VerwijderLaag", titel: this.titel, wrapper: forgetWrapper });
  }

  protected dispatch(evt: prt.Command<KaartInternalMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): prt.Laaggroep;
}
