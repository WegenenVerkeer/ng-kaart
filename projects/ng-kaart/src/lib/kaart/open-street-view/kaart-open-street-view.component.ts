import { Component, NgZone } from "@angular/core";

import * as ol from "openlayers";
import * as rx from "rxjs";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";

import { KaartModusComponent } from "../kaart-modus-component";
import { KaartComponent } from "../kaart.component";

export const StreetviewUiSelector = "Streetview";

@Component({
  selector: "awv-kaart-open-street-view",
  templateUrl: "./kaart-open-street-view.component.html",
  styleUrls: ["./kaart-open-street-view.component.scss"]
})
export class KaartOpenStreetViewComponent extends KaartModusComponent {
  private clickSubscription: rx.Subscription = new rx.Subscription();

  constructor(kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  modus(): string {
    return StreetviewUiSelector;
  }

  activeer() {
    this.startLuisterenOpClickEvents();
  }

  deactiveer() {
    this.stopLuisterenOpClickEvents();
  }

  private startLuisterenOpClickEvents(): void {
    document.body.style.cursor = "crosshair";

    this.clickSubscription.unsubscribe();
    this.clickSubscription = this.bindToLifeCycle(this.modelChanges.kaartKlikLocatie$).subscribe(locatie =>
      this.openGoogleStreetView(locatie)
    );
  }

  private stopLuisterenOpClickEvents(): void {
    document.body.style.cursor = "default";

    this.clickSubscription.unsubscribe();
  }

  private openGoogleStreetView(coordinaat: ol.Coordinate): void {
    // const wsg84xy = ol.proj.transform(coordinaat, ol.proj.get("EPSG:31370"), ol.proj.get("EPSG:4326"));
    const wsg84xy = lambert72ToWgs84(coordinaat);
    const strtvUrl = `http://maps.google.com/?cbll= ${wsg84xy[1]},${wsg84xy[0]} &cbp=12,0,0,0,0&layer=c&source=embed&z=14&output=svembed`;

    window.open(strtvUrl);

    // sluit de street view modus af
    this.zetModeAf();
  }
}
