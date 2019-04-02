import { Component, Injector, Input } from "@angular/core";
import * as array from "fp-ts/lib/Array";
import { concat } from "fp-ts/lib/function";
import { fromNullable } from "fp-ts/lib/Option";

import { kaartLogOnlyWrapper } from "../../kaart/kaart-internal-messages";
import { forEach, toArray } from "../../util/option";
import { ZoekerUiSelector } from "../../zoeker/box/zoeker-box.component";
import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";
import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";
import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";
import { Zoeker, zoekerMetPrioriteiten, ZoekerMetWeergaveopties } from "../../zoeker/zoeker";
import { ClassicUIElementSelectorComponentBase } from "../common/classic-ui-element-selector-component-base";

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
  private isInitialised = false;

  constructor(
    injector: Injector,
    crabZoeker: ZoekerCrabService,
    googleZoeker: ZoekerGoogleWdbService,
    perceelZoeker: ZoekerPerceelService
  ) {
    super(ZoekerUiSelector, injector);

    this.initialising$.subscribe(() => {
      // Een beetje een ingewikkelde constructie, maar we willen dat we zowel met deze tag alleen kunnen werken (backwards compatibility)
      // als met deze tag + child tags
      const inputZoekers = concat(toArray(fromNullable(this.zoeker)), this.zoekers);
      const stdZoekers: ZoekerMetWeergaveopties[] = [
        zoekerMetPrioriteiten(googleZoeker, 1, 1),
        zoekerMetPrioriteiten(crabZoeker, 2, 2),
        zoekerMetPrioriteiten(perceelZoeker, 3)
      ];
      this.registered = array.isEmpty(inputZoekers) ? stdZoekers : inputZoekers;
      this.registered.forEach(zoeker => this.registerZoeker(zoeker));
      this.isInitialised = true;
    });
    this.destroying$.subscribe(() => this.registered.forEach(zmp => this.deregisterZoeker(zmp)));
  }

  addZoeker(zoekerOpties: ZoekerMetWeergaveopties): void {
    if (!this.isInitialised) {
      this.zoekers.push(zoekerOpties);
    } else {
      this.registerZoeker(zoekerOpties);
      this.registered.push(zoekerOpties);
    }
  }

  removeZoeker(zoeker: Zoeker): void {
    forEach(array.findFirst(this.registered, zmw => zmw.zoeker === zoeker), toDelete => {
      this.registered = this.registered.filter(zmw => zmw !== toDelete);
      this.deregisterZoeker(toDelete);
    });
  }

  private registerZoeker(zoekerOpties: ZoekerMetWeergaveopties) {
    this.kaart.dispatch({
      type: "VoegZoekerToe",
      zoekerPrioriteit: zoekerOpties,
      wrapper: kaartLogOnlyWrapper
    });
  }

  private deregisterZoeker(zoekerOpties: ZoekerMetWeergaveopties) {
    this.kaart.dispatch({
      type: "VerwijderZoeker",
      zoekerNaam: zoekerOpties.zoeker.naam(),
      wrapper: kaartLogOnlyWrapper
    });
  }
}
