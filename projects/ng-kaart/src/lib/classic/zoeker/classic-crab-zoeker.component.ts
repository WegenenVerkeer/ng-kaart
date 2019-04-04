import { Component, Injector } from "@angular/core";

import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";
import { ClassicZoekerComponent } from "./classic-zoeker.component";

@Component({
  selector: "awv-kaart-crab-zoeker",
  template: ""
})
export class ClassicCrabZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(injector: Injector, crabZoeker: ZoekerCrabService) {
    super(injector, crabZoeker);
  }
}
