import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";

import { KaartClassicComponent } from "./kaart-classic.component";
import { KaartComponentBase } from "./kaart-component-base";

@Component({
  selector: "awv-kaart-knop-meten",
  templateUrl: "./kaart-knop-meten.component.html",
  styleUrls: ["./kaart-knop-meten.component.scss"]
})
export class KaartKnopMetenLengteOppervlakteComponent extends KaartComponentBase implements OnInit, OnDestroy {
  private metende: boolean;

  constructor(zone: NgZone, private readonly kaartClassicComponent: KaartClassicComponent) {
    super(zone);
    this.metende = false;
  }

  ngOnDestroy(): void {
    this.stopMetMeten();
  }

  startMetMeten(): void {
    // TODO subscribe op GeometryChanged
    this.metende = true;
  }

  stopMetMeten(): void {
    // TODO unsubscribe van GeometryChanged
    this.metende = false;
  }

  toggleMeten(): void {
    if (this.metende) {
      this.stopMetMeten();
    } else {
      this.startMetMeten();
    }
  }
}
