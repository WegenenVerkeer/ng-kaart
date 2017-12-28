import { Component, NgZone, OnDestroy, OnInit, ViewEncapsulation } from "@angular/core";
import { KaartComponent } from "./kaart.component";

import * as ol from "openlayers";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-knop-volledig-scherm",
  template: "<ng-content></ng-content>",
  styleUrls: ["./kaart-knop-volledig-scherm.component.scss"],
  encapsulation: ViewEncapsulation.None
})
export class KaartKnopVolledigSchermComponent extends KaartComponentBase implements OnInit, OnDestroy {
  fullScreen: ol.control.FullScreen;

  constructor(private readonly kaart: KaartComponent, zone: NgZone) {
    super(zone);
    throw new Error("nog niet geïmplementeerd");
  }
}
