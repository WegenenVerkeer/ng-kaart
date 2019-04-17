import { Component, Injector } from "@angular/core";

import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";

/**
 * Voegt een zoeker voor gestructureerd zoeken in CRAB toe. De gebruiker wordt gestuurd mbv een getrapte dialoog
 * (gemeente/straat/huisnummer). Zoekt ook op vrije tekst.
 *
 * Moet gebruikt worden als een child tag van <code>&lt;awv-kaart-zoeker&gt;</code>.
 */
@Component({
  selector: "awv-kaart-crab-zoeker",
  template: ""
})
export class ClassicCrabZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(injector: Injector, crabZoeker: ZoekerCrabService) {
    super(injector, crabZoeker);
  }
}
