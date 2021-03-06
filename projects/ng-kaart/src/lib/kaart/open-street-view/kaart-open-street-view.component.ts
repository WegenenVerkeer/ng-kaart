import { Component, NgZone } from "@angular/core";
import * as rx from "rxjs";
import { tap } from "rxjs/operators";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
import * as ol from "../../util/openlayers-compat";
import { KaartModusDirective } from "../kaart-modus.directive";
import * as prt from "../kaart-protocol-commands";
import { KaartComponent } from "../kaart.component";

export const StreetviewUiSelector = "Streetview";

@Component({
  selector: "awv-kaart-open-street-view",
  templateUrl: "./kaart-open-street-view.component.html",
  styleUrls: ["./kaart-open-street-view.component.scss"],
})
export class KaartOpenStreetViewComponent extends KaartModusDirective {
  private clickSubscription: rx.Subscription = new rx.Subscription();

  constructor(kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);

    this.runInViewReady(
      rx.merge(
        this.wordtActief$.pipe(tap(() => this.startLuisterenOpClickEvents())),
        this.wordtInactief$.pipe(tap(() => this.stopLuisterenOpClickEvents()))
      )
    );
  }

  modus(): string {
    return StreetviewUiSelector;
  }

  private startLuisterenOpClickEvents(): void {
    document.body.style.cursor = "crosshair";

    this.clickSubscription.unsubscribe();
    this.dispatch(prt.DeactiveerSelectieModusCmd());
    this.clickSubscription = this.bindToLifeCycle(
      this.modelChanges.kaartKlikLocatie$
    ).subscribe((locatie) => this.openGoogleStreetView(locatie.coordinate));
  }

  private stopLuisterenOpClickEvents(): void {
    document.body.style.cursor = "default";

    this.clickSubscription.unsubscribe();
    this.dispatch(prt.ReactiveerSelectieModusCmd());
  }

  private openGoogleStreetView(coordinaat: ol.Coordinate): void {
    const wsg84xy = lambert72ToWgs84(coordinaat);
    const strtvUrl = `https://maps.google.com/?cbll= ${wsg84xy[1]},${wsg84xy[0]} &cbp=12,0,0,0,0&layer=c&source=embed&z=14&output=svembed`;

    window.open(strtvUrl);

    // sluit de street view modus af
    this.zetModeAf();
  }
}
