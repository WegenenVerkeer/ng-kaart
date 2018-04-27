import { Input, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { Laag, Laaggroep } from "./kaart-elementen";
import { KaartInternalMsg, kaartLogOnlyWrapper } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { fromNullable } from "fp-ts/lib/Option";

export abstract class KaartLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;
  @Input() groep: Laaggroep | undefined; // Heeft voorrang op std ingesteld via laaggroep

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
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this.zichtbaar,
      wrapper: kaartLogOnlyWrapper
    });
  }

  protected gekozenLaagGroep(): Laaggroep {
    return fromNullable(this.groep).getOrElseValue(this.laaggroep());
  }

  protected dispatch(evt: prt.Command<KaartInternalMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): Laaggroep;
}
