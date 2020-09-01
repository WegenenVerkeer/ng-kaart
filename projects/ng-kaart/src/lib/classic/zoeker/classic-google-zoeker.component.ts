import { Component, Injector } from "@angular/core";

import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";

import { ClassicSingleZoekerDirective } from "./classic-single-zoeker.directive";

/**
 * Voegt een zoeker voor vrije-tekst-zoeken via Google toe.
 *
 * Moet gebruikt worden als een child tag van <code>&lt;awv-kaart-zoeker&gt;</code>.
 */
@Component({
  selector: "awv-kaart-google-zoeker",
  template: "",
})
export class ClassicGoogleZoekerComponent extends ClassicSingleZoekerDirective {
  constructor(injector: Injector, googleZoeker: ZoekerGoogleWdbService) {
    super(injector, googleZoeker);
  }
}
