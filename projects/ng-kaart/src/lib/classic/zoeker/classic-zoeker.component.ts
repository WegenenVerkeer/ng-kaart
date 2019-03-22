import { Component, Input, NgZone } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { toArray } from "../../util/option";
import { ZoekerUiSelector } from "../../zoeker/box/zoeker-box.component";
import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";
import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";
import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";
import { zoekerMetPrioriteiten, ZoekerMetWeergaveopties } from "../../zoeker/zoeker";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";
import { KaartClassicComponent } from "../kaart-classic.component";

@Component({
  selector: "awv-kaart-zoeker",
  template: ""
})
export class ClassicZoekerComponent extends ClassicUIElementSelectorComponentBase {
  @Input()
  zoeker: ZoekerMetWeergaveopties;
  @Input()
  zoekers: ZoekerMetWeergaveopties[] = [];

  private registered: ZoekerMetWeergaveopties[] = [];

  constructor(
    kaart: KaartClassicComponent,
    zone: NgZone,
    crabZoeker: ZoekerCrabService,
    googleZoeker: ZoekerGoogleWdbService,
    perceelZoeker: ZoekerPerceelService
  ) {
    super(ZoekerUiSelector, kaart, zone);

    this.initialising$.subscribe(() => {
      // berekend op het moment van initialisatie => geen mismatch init <> destroy mogelijk
      const inputZoekers = concat(toArray(fromNullable(this.zoeker)), this.zoekers);
      const stdZoekers: ZoekerMetWeergaveopties[] = [
        zoekerMetPrioriteiten(googleZoeker, 1, 1),
        zoekerMetPrioriteiten(crabZoeker, 2, 2),
        zoekerMetPrioriteiten(perceelZoeker, 3)
      ];
      this.registered = array.isEmpty(inputZoekers) ? stdZoekers : inputZoekers;
      this.registered.forEach(zoeker =>
        kaart.dispatch({
          type: "VoegZoekerToe",
          zoekerPrioriteit: zoeker,
          wrapper: kaartLogOnlyWrapper
        })
      );
    });
    this.destroying$.subscribe(() =>
      this.registered.forEach(zmp =>
        kaart.dispatch({
          type: "VerwijderZoeker",
          zoekerNaam: zmp.zoeker.naam(),
          wrapper: kaartLogOnlyWrapper
        })
      )
    );
  }
}
