import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { skipUntilInitialised } from "../../util/operators";
import { actieveModusGezetWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Adres, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import * as srv from "./kaart-bevragen.service";

export const BevraagKaartUiSelector = "Bevraagkaart";

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: []
})
export class KaartBevragenComponent extends KaartModusComponent implements OnInit, OnDestroy {
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

    this.modelChanges.kaartKlikLocatie$
      .pipe(
        takeUntil(this.destroying$), // autounsubscribe bij destroy component
        skipUntilInitialised(),
        switchMap((coordinaat: ol.Coordinate) =>
          Observable.merge(
            srv.wegLocatiesViaXY$(this.http, coordinaat).map(weglocatie => srv.withWegLocaties(coordinaat, weglocatie)),
            srv.adresViaXY$(this.http, coordinaat).map(adres => srv.withAdres(coordinaat, adres))
          ).scan((nieuw, bestaand) => this.verrijk(nieuw, bestaand), srv.fromCoordinate(coordinaat))
        ),
        observeOnAngular(this.zone)
      )
      .subscribe((msg: srv.OntvangenInformatie) => {
        this.toonInfoBoodschap(
          msg.currentClick, //
          msg.adres.map(srv.toAdres), //
          msg.weglocaties.map(srv.toWegLocaties).getOrElse(List())
        );
      });
  }

  private verrijk(nieuw: srv.OntvangenInformatie, bestaand: srv.OntvangenInformatie): srv.OntvangenInformatie {
    return {
      ...bestaand,
      ...nieuw.weglocaties.fold({}, weglocaties => ({ weglocaties: some(weglocaties) })),
      ...nieuw.adres.fold({}, adres => ({ adres: some(adres) }))
    };
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
