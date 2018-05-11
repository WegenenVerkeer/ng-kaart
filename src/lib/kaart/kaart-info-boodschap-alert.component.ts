import { Component, Input, NgZone, OnInit } from "@angular/core";
import { KaartChildComponentBase } from "./kaart-child-component-base";
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

  ngOnInit(): void {
    super.ngOnInit();
  }
}
