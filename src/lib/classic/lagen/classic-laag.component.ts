import { Input, OnDestroy, OnInit } from "@angular/core";
import { fromNullable } from "fp-ts/lib/Option";

import { Laag, Laaggroep } from "../../kaart/kaart-elementen";
import * as prt from "../../kaart/kaart-protocol";
import { KaartClassicComponent } from "../kaart-classic.component";
import { KaartClassicMsg, logOnlyWrapper } from "../messages";

export abstract class ClassicLaagComponent implements OnInit, OnDestroy {
  @Input() titel = "";
  @Input() zichtbaar = true;
  @Input() groep: Laaggroep | undefined; // Heeft voorrang op std ingesteld via laaggroep
  @Input() minZoom = 2;
  @Input() maxZoom = 16;

  protected voegLaagToeBijStart = true;

  constructor(protected readonly kaart: KaartClassicComponent) {}

  ngOnInit(): void {
    if (this.voegLaagToeBijStart) {
      this.voegLaagToe();
    }
  }

  ngOnDestroy(): void {
    this.dispatch(prt.VerwijderLaagCmd(this.titel, logOnlyWrapper));
  }

  protected voegLaagToe() {
    this.dispatch({
      type: "VoegLaagToe",
      positie: Number.MAX_SAFE_INTEGER,
      laag: this.createLayer(),
      laaggroep: this.gekozenLaagGroep(),
      magGetoondWorden: this.zichtbaar,
      wrapper: logOnlyWrapper
    });
  }

  protected gekozenLaagGroep(): Laaggroep {
    return fromNullable(this.groep).getOrElse(this.laaggroep());
  }

  protected dispatch(evt: prt.Command<KaartClassicMsg>) {
    this.kaart.dispatch(evt);
  }

  abstract createLayer(): Laag;

  abstract laaggroep(): Laaggroep;
}
