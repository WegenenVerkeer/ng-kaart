import { Component, Injector } from "@angular/core";

import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";

/**
 * Voegt een zoeker voor gestructureerd zoeken van kadastrale perceelsinformatie. De gebruiker wordt gestuurd mbv een
 * getrapte dialoog (gemeenten/afdelingen/secties/perceelnummers).
 *
 * Moet gebruikt worden als een child tag van <code>&lt;awv-kaart-zoeker&gt;</code>.
 */
@Component({
  selector: "awv-kaart-perceel-zoeker",
  template: ""
})
export class ClassicPerceelZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(injector: Injector, perceelZoeker: ZoekerPerceelService) {
    super(injector, perceelZoeker);
  }
}
