import { Component, Injector } from "@angular/core";

import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";

/**
 * Voegt een zoeker voor vrije-tekst-zoeken via Google toe.
 *
 * Moet gebruikt worden als een child tag van <code>&lt;awv-kaart-zoeker&gt;</code>.
 */
@Component({
  selector: "awv-kaart-google-zoeker",
  template: ""
})
export class ClassicGoogleZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(injector: Injector, googleZoeker: ZoekerGoogleWdbService) {
    super(injector, googleZoeker);
  }
}
