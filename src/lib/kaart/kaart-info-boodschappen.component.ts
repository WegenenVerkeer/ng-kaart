import { Component, NgZone, OnInit } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { List } from "immutable";
import { InfoBoodschap } from "./kaart-with-info";

@Component({
  selector: "awv-kaart-info-boodschappen",
  templateUrl: "./kaart-info-boodschappen.component.html",
  styleUrls: ["./kaart-info-boodschappen.component.scss"]
})
export class KaartInfoBoodschappenComponent extends KaartChildComponentBase implements OnInit {
  boodschappen: List<InfoBoodschap>;

  constructor(zone: NgZone) {
    super(zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit(): void {
    super.ngOnInit();
  }
}
