import { Component, NgZone } from "@angular/core";

import { ZoekerGoogleWdbService } from "../../zoeker/google-wdb/zoeker-google-wdb.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";
import { ClassicZoekerComponent } from "./classic-zoeker.component";

@Component({
  selector: "awv-kaart-google-zoeker",
  template: ""
})
export class ClassicGoogleZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(zone: NgZone, zoekerComponent: ClassicZoekerComponent, googleZoeker: ZoekerGoogleWdbService) {
    super(zone, zoekerComponent, googleZoeker);
  }
}
