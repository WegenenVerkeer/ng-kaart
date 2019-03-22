import { Component, NgZone } from "@angular/core";

import { ZoekerCrabService } from "../../zoeker/crab/zoeker-crab.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";
import { ClassicZoekerComponent } from "./classic-zoeker.component";

@Component({
  selector: "awv-kaart-crab-zoeker",
  template: ""
})
export class ClassicCrabZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(zone: NgZone, zoekerComponent: ClassicZoekerComponent, crabZoeker: ZoekerCrabService) {
    super(zone, zoekerComponent, crabZoeker);
  }
}
