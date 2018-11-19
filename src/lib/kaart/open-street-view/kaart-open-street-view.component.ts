import { Component, NgZone } from "@angular/core";

import * as ol from "openlayers";
import * as rx from "rxjs";
import { take, takeUntil } from "rxjs/operators";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType, skipOlder } from "../../util/operators";

import { actieveModusGezetWrapper, KaartClickMsg, kaartClickWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
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

  isDefaultModus() {
    return false;
  }

  activeer(active: boolean) {
    if (active) {
      this.startLuisterenOpClickEvents();
    } else {
      this.stopLuisterenOpClickEvents();
    }
  }

  public get isActief(): boolean {
    return this.actief;
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  toggleLuisterenOpKaartClicks(): void {
    if (this.actief) {
      this.stopLuisterenOpClickEvents();
      this.publiceerDeactivatie();
    } else {
      this.startLuisterenOpClickEvents();
      this.publiceerActivatie();
    }
  }

  private startLuisterenOpClickEvents(): void {
    this.actief = true;
    document.body.style.cursor = "crosshair";

    this.clickSubscription.unsubscribe();
    this.clickSubscription = this.internalMessage$
      .pipe(
        ofType<KaartClickMsg>("KaartClick"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipOlder(),
        take(1) // 1 click message is genoeg
      )
      .subscribe(msg => {
        this.openGoogleStreetView(msg.clickCoordinaat);
      });
  }

  private stopLuisterenOpClickEvents(): void {
    this.actief = false;
    document.body.style.cursor = "default";

    this.clickSubscription.unsubscribe();
  }

  private openGoogleStreetView(coordinaat: ol.Coordinate): void {
    // const wsg84xy = ol.proj.transform(coordinaat, ol.proj.get("EPSG:31370"), ol.proj.get("EPSG:4326"));
    const wsg84xy = lambert72ToWgs84(coordinaat);
    const strtvUrl = `http://maps.google.com/?cbll= ${wsg84xy[1]},${wsg84xy[0]} &cbp=12,0,0,0,0&layer=c&source=embed&z=14&output=svembed`;

    window.open(strtvUrl);

    // sluit de street view modus af
    this.stopLuisterenOpClickEvents();
    this.publiceerDeactivatie();
  }
}
