import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { skipUntilInitialised } from "../../util/operators";
import { actieveModusGezetWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Adres, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import {
  adresViaXY,
  LsWegLocaties,
  OntvangenInformatie,
  toAdres,
  toWegLocaties,
  wegLocatiesViaXY,
  XY2AdresError,
  XY2AdresSucces
} from "./kaart-bevragen.service";

export const BevraagKaartUiSelector = "Bevraagkaart";

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: []
})
export class KaartBevragenComponent extends KaartModusComponent implements OnInit, OnDestroy {
  private ontvangenInfo$ = new BehaviorSubject<Option<OntvangenInformatie>>(none);

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

    // ververs de infoboodschap telkens we nieuwe info hebben ontvangen
    this.bindToLifeCycle(this.ontvangenInfo$).subscribe(msg => {
      msg.map(info => {
        this.toonInfoBoodschap(
          info.currentClick, //
          info.adres.map(adres => toAdres(adres)), //
          info.weglocaties.map(weglocaties => toWegLocaties(weglocaties)).getOrElse(List())
        );
      });
    });

    const clickObs$ = this.modelChanges.kaartKlikLocatie$.pipe(
      observeOnAngular(this.zone),
      takeUntil(this.destroying$), // autounsubscribe bij destroy component
      skipUntilInitialised()
    );

    // nieuwe click coordinaat ontvangen, start nieuwe identify informatie
    clickObs$.subscribe((coordinate: ol.Coordinate) => {
      this.ontvangenInfo$.next(
        some({
          currentClick: coordinate,
          weglocaties: none,
          adres: none
        })
      );
    });

    // weglocaties bij coordinaat opvragen
    clickObs$
      .pipe(
        // switchMap zal inner observables automatisch unsubscriben, zodat calls voor vorige coordinaat gecancelled worden
        switchMap((coordinaat: ol.Coordinate) => wegLocatiesViaXY(this.http, coordinaat))
      )
      .subscribe((weglocaties: LsWegLocaties) => {
        if (weglocaties.total !== undefined) {
          this.ontvangenInfo$.value.map(bestaandeInformatie => {
            this.ontvangenInfo$.next(
              // verrijk de bestaande identify informatie
              some({
                ...bestaandeInformatie,
                weglocaties: some(weglocaties)
              })
            );
          });
        }
      });

    // dichtsbijzijnde adres bij coordinaat opvragen
    clickObs$
      .pipe(
        // switchMap zal inner observables automatisch unsubscriben, zodat calls voor vorige coordinaat gecancelled worden
        switchMap((coordinaat: ol.Coordinate) => adresViaXY(this.http, coordinaat))
      )
      .subscribe((adres: XY2AdresSucces[] | XY2AdresError) => {
        if (adres instanceof Array && adres.length > 0) {
          this.ontvangenInfo$.value.map(bestaandeInformatie => {
            this.ontvangenInfo$.next(
              // verrijk de bestaande identify informatie
              some({
                ...bestaandeInformatie,
                adres: some(adres[0].adres)
              })
            );
          });
        }
      });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper)];
  }

  private toonInfoBoodschap(coordinaat: ol.Coordinate, maybeAdres: Option<Adres>, wegLocaties: List<WegLocatie>) {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "Kaart bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        bron: none,
        coordinaat: coordinaat,
        adres: maybeAdres,
        weglocaties: wegLocaties,
        verbergMsgGen: () => none
      })
    );
  }
}
