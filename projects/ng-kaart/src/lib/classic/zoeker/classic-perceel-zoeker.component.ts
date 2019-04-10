import { Component, Injector } from "@angular/core";

import { ZoekerPerceelService } from "../../zoeker/perceel/zoeker-perceel.service";

import { ClassicSingleZoekerComponentBase } from "./classic-single-zoeker.component";

@Component({
  selector: "awv-kaart-perceel-zoeker",
  template: ""
})
export class ClassicPerceelZoekerComponent extends ClassicSingleZoekerComponentBase {
  constructor(injector: Injector, perceelZoeker: ZoekerPerceelService) {
    super(injector, perceelZoeker);
  }
}
