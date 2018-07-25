import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { info } from "fp-ts/lib/Console";
import { none, Option, some } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { BehaviorSubject } from "rxjs";
import { timer } from "rxjs/observable/timer";
import { mergeMap } from "rxjs/operator/mergeMap";
import { map, merge, switchMap, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType, skipUntilInitialised } from "../../util/operators";
import { actieveModusGezetWrapper, KaartClickMsg, kaartClickWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

export const BevraagKaartUiSelector = "Bevraagkaart";

interface BevraagInformatie {
  currentClick: ol.Coordinate;
  adres: Option<string>;
  weglocatie: Option<string>;
}

interface WegLocatie {
  ident8: string;
  hm: number;
  district: string;
  districtcode: string;
  position: number;
  distance: number;
  distancetopole: number;
}

interface WegLocaties {
  total: number;
  items: WegLocatie[];
  error: string;
}

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: ["./kaart-bevragen.component.scss"]
})
export class KaartBevragenComponent extends KaartModusComponent implements OnInit, OnDestroy {
  private bevraagdeInformatie = new BehaviorSubject<Option<BevraagInformatie>>(none);

  constructor(parent: KaartComponent, zone: NgZone, private http: HttpClient) {
    super(parent, zone);
  }

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

    this.bindToLifeCycle(this.bevraagdeInformatie).subscribe(msg => {
      msg.map(info => this.updateInformatie(info));
    });

    const clickObs$ = this.internalMessage$.pipe(
      ofType<KaartClickMsg>("KaartClick"), //
      observeOnAngular(this.zone),
      takeUntil(this.destroying$), // autounsubscribe bij destroy component
      skipUntilInitialised(),
      map((msg: KaartClickMsg) => msg.clickCoordinaat)
    );

    clickObs$.subscribe((coordinate: ol.Coordinate) => {
      this.bevraagdeInformatie.next(
        some({
          currentClick: coordinate,
          weglocatie: none,
          adres: none
        })
      );
    });

    clickObs$
      .pipe(
        switchMap((coordinaat: ol.Coordinate) =>
          this.http.get<WegLocaties>(
            `https://apps-dev.mow.vlaanderen.be/wegendatabank/v1/locator/xy2loc?showall=true&maxAfstand=25&x=${coordinaat[0]}&y=${
              coordinaat[1]
            }`
          )
        )
      )
      .subscribe((weglocaties: WegLocaties) => {
        console.log("Weglocatie");
        console.log(weglocaties);
        if (weglocaties.total !== undefined) {
          this.bevraagdeInformatie.value.map(info => {
            info.weglocatie = some(weglocaties.items[0].ident8 + " " + weglocaties.items[0].hm);
            this.bevraagdeInformatie.next(some(info));
          });
        }
      });

    clickObs$
      .pipe(
        switchMap((coordinaat: ol.Coordinate) =>
          this.http.get(`https://apps-dev.mow.vlaanderen.be/wegendatabank/v1/locator/xy2address?x=${coordinaat[0]}&y=${coordinaat[1]}`)
        )
      )
      .subscribe(adres => {
        console.log("Adres");
        console.log(adres);
        this.bevraagdeInformatie.value.map(info => {
          info.adres = some("Meir 1, Antwerpen");
          this.bevraagdeInformatie.next(some(info));
        });
      });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  private updateInformatie(informatie: BevraagInformatie) {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "Kaart bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        bron: none,
        coordinaat: informatie.currentClick,
        adres: informatie.adres,
        weglocatie: informatie.weglocatie,
        verbergMsgGen: () => none
      })
    );
  }
}
