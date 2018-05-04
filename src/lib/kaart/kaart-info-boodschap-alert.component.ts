import { Component, Input, NgZone, OnInit } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";
import { KaartComponent } from "./kaart.component";

@Component({
  selector: "awv-kaart-info-boodschap-alert",
  templateUrl: "./kaart-info-boodschap-alert.component.html",
  styleUrls: ["./kaart-info-boodschap-alert.component.scss"]
})
export class KaartInfoBoodschapAlertComponent extends KaartChildComponentBase implements OnInit {
  @Input() message: string;

  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [];
  }

  ngOnInit(): void {
    super.ngOnInit();
  }
}
