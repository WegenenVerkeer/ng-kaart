import { Component, Input, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";

import { KaartComponentBase } from "../../kaart/kaart-component-base";
import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { Zoeker } from "../../zoeker/zoeker";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-zoeker-registratie",
  template: ""
})
export class ClassicZoekerRegistratieComponent extends KaartComponentBase {
  @Input() zoeker: Zoeker;
  @Input() zoekers: Zoeker[] = [];

  private registered: Zoeker[];

  constructor(kaart: KaartClassicComponent, zone: NgZone) {
    super(zone);

    this.initialising$.subscribe(() => {
      // berekend op het moment van initialisatie => geen mismatch init <> destroy mogelijk
      this.registered = concat(array.catOptions([fromNullable(this.zoeker)]), this.zoekers);
      this.registered.forEach(zoeker =>
        kaart.dispatch({
          type: "VoegZoekerToe",
          zoeker: zoeker,
          wrapper: kaartLogOnlyWrapper
        })
      );
    });
    this.destroying$.subscribe(() =>
      this.registered.forEach(zoeker =>
        kaart.dispatch({
          type: "VerwijderZoeker",
          zoeker: zoeker.naam(),
          wrapper: kaartLogOnlyWrapper
        })
      )
    );
  }
}
