import { Component, NgZone, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";
import { skipUntil, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType } from "../../util/operators";
import { KaartChildComponentBase } from "../kaart-child-component-base";
import { KaartClickMsg } from "../kaart-internal-messages";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

@Component({
  selector: "awv-kaart-bevragen",
  templateUrl: "./kaart-bevragen.component.html",
  styleUrls: ["./kaart-bevragen.component.scss"]
})
export class KaartBevragenComponent extends KaartChildComponentBase implements OnInit {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

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
        this.currentClick = msg.clickCoordinaat;
        this.updateInformatie();
      });
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
        verbergMsgGen: () => some(prt.VerbergInfoBoodschapCmd("Kaart bevragen"))
      })
    );
  }
}
