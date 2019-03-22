import { Component, NgZone } from "@angular/core";

import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";
import { ClassicZoekerComponent } from "./classic-zoeker.component";

@Component({
  selector: "awv-kaart-perceel-zoeker",
  template: ""
})
export class ClassicPerceelZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(zone: NgZone, zoekerComponent: ClassicZoekerComponent, perceelZoeker: ZoekerPerceelService) {
    super(zone, zoekerComponent, perceelZoeker);
  }
}
