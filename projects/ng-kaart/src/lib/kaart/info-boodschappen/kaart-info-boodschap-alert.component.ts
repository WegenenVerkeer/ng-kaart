import { Component, NgZone } from "@angular/core";

import { KaartComponent } from "../kaart.component";
import { InfoBoodschapAlert } from "../kaart-with-info-model";
import { KaartInfoBoodschapBaseDirective } from "./kaart-info-boodschap-base.component";

@Component({
  selector: "awv-kaart-info-boodschap-alert",
  templateUrl: "./kaart-info-boodschap-alert.component.html",
  styleUrls: ["./kaart-info-boodschap-alert.component.scss"],
})
export class KaartInfoBoodschapAlertComponent extends KaartInfoBoodschapBaseDirective<
  InfoBoodschapAlert
> {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
