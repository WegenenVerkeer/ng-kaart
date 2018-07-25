import { Component, NgZone, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType, skipUntilInitialised } from "../../util/operators";
import { actieveModusGezetWrapper, KaartClickMsg, kaartClickWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const BevraagKaartUiSelector = "Bevraagkaart";

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: ["./kaart-bevragen.component.scss"]
})
export class KaartBevragenComponent extends KaartModusComponent implements OnInit {
  constructor(parent: KaartComponent, zone: NgZone) {
    super(parent, zone);
  }

  private currentClick: ol.Coordinate;
  private adres: Option<string> = none;
  private weglocatie: Option<any> = none;

  modus(): string {
    return BevraagKaartUiSelector;
  }

  isDefaultModus() {
    return true;
  }

  activeer(actief: boolean) {
    this.actief = actief;
    if (this.actief) {
      // activatie van de modus gebeurt nooit expliciet via de gebruiker, dus we moeten expliciet
      // de activatie publiceren aan de andere componenten
      this.publiceerActivatie();
    }
  }

  ngOnInit(): void {
    super.ngOnInit();

    this.internalMessage$
      .pipe(
        ofType<KaartClickMsg>("KaartClick"), //
        observeOnAngular(this.zone),
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipUntilInitialised()
      )
      .subscribe(msg => {
        if (this.actief) {
          this.currentClick = msg.clickCoordinaat;
          this.updateInformatie();
        }
      });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  updateInformatie() {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "Kaart bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        coordinaat: some(this.currentClick),
        bron: none,
        adres: none,
        weglocatie: none,
        verbergMsgGen: () => none
      })
    );
  }
}
