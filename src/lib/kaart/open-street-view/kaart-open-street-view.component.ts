import { Component, NgZone, OnInit } from "@angular/core";
import { none, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { Observable } from "rxjs/Observable";
import { skipUntil, take, takeUntil } from "rxjs/operators";

import { lambert72ToWgs84 } from "../../coordinaten/coordinaten.service";
import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { containsText } from "../../util/option";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import {
  ActieveModusAangepastMsg,
  actieveModusGezetWrapper,
  KaartClickMsg,
  kaartClickWrapper,
  KaartInternalMsg
} from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const StreetviewUiSelector = "Streetview";

@Component({
  selector: "awv-kaart-open-street-view",
  templateUrl: "./kaart-open-street-view.component.html",
  styleUrls: ["./kaart-open-street-view.component.scss"]
})
export class KaartOpenStreetViewComponent extends KaartChildComponentBase implements OnInit {
  private clickSubscription: rx.Subscription = new rx.Subscription();

  private actief = false;

  constructor(kaartComponent: KaartComponent, zone: NgZone) {
    super(kaartComponent, zone);
  }

  public get isActief(): boolean {
    return this.actief;
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<ActieveModusAangepastMsg>("ActieveModus"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipUntil(Observable.timer(0)) // beperk tot messages nadat subscribe opgeroepen is: oorzaak is shareReplay(1) in internalmessages$
      )
      .subscribe(msg => {
        if (!containsText(msg.modus, StreetviewUiSelector)) {
          // aanvraag tot andere actieve klik modus, deactiveer deze modus indien nodig
          if (this.actief) {
            this.stopLuisterenOpClickEvents();
          }
        }
      });
  }

  toggleLuisterenOpKaartClicks(): void {
    if (this.actief) {
      this.stopLuisterenOpClickEvents();
      this.dispatch(prt.ZetActieveModusCmd(none));
    } else {
      this.startLuisterenOpClickEvents();
      this.dispatch(prt.ZetActieveModusCmd(some(StreetviewUiSelector)));
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
        skipUntil(Observable.timer(0)), // beperk tot messages nadat subscribe opgeroepen is: oorzaak is shareReplay(1) in internalmessages$
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
    this.dispatch(prt.ZetActieveModusCmd(none));
  }
}
