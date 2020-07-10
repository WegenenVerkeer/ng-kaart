import { Component, Input, NgZone, OnInit } from "@angular/core";

import { KaartChildDirective } from "../kaart-child.directive";
import { InfoBoodschapAlert } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-info-boodschap-alert",
  templateUrl: "./kaart-info-boodschap-alert.component.html",
  styleUrls: ["./kaart-info-boodschap-alert.component.scss"]
})
export class KaartInfoBoodschapAlertComponent extends KaartChildDirective {
  message: string;

  @Input()
  set boodschap(bsch: InfoBoodschapAlert) {
    this.message = bsch.message;
  }

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }
}
