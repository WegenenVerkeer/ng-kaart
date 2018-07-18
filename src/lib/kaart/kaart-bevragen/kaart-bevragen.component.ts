import { Component, NgZone, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";
import { skipUntil, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { contains } from "../../util/option";
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

export const BevraagKaartUiSelector = "Bevraagkaart";

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: ["./kaart-bevragen.component.scss"]
})
export class KaartBevragenComponent extends KaartChildComponentBase implements OnInit {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  private actief = false;

  private currentClick: ol.Coordinate;
  private adres: Option<string> = none;
  private weglocatie: Option<any> = none;

  ngOnInit(): void {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<KaartClickMsg>("KaartClick"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipUntil(Observable.timer(0)) // beperk tot messages nadat subscribe opgeroepen is: oorzaak is shareReplay(1) in internalmessages$
      )
      .subscribe(msg => {
        if (this.actief) {
          this.currentClick = msg.clickCoordinaat;
          this.updateInformatie();
        }
      });

    this.internalMessage$
      .pipe(
        ofType<ActieveModusAangepastMsg>("ActieveModus"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipUntil(Observable.timer(0)) // beperk tot messages nadat subscribe opgeroepen is: oorzaak is shareReplay(1) in internalmessages$
      )
      .subscribe(msg => {
        if (msg.modus.isNone()) {
          // als er geen modus gezet is, is dit de default modus, activeer onszelf
          if (!this.actief) {
            this.zetActief(true);
          }
        } else if (!contains(msg.modus, BevraagKaartUiSelector)) {
          // aanvraag tot andere modus, disable deze modus
          if (this.actief) {
            this.zetActief(false);
          }
        }
      });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  zetActief(actief: boolean) {
    this.actief = actief;
    if (this.actief) {
      this.dispatch(prt.ZetActieveModusCmd(some(BevraagKaartUiSelector)));
    }
  }

  updateInformatie() {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "Kaart bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluitbaar: true,
        coordinaat: some(this.currentClick),
        adres: none,
        weglocatie: none,
        verbergMsgGen: () => none
      })
    );
  }
}
