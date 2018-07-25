import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { fromPredicate, none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import { BehaviorSubject } from "rxjs";
import { Observable } from "rxjs/Observable";
import { map, switchMap, takeUntil } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { ofType, skipUntilInitialised } from "../../util/operators";
import { actieveModusGezetWrapper, KaartClickMsg, kaartClickWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Adres, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

export const BevraagKaartUiSelector = "Bevraagkaart";

interface OntvangenInformatie {
  currentClick: ol.Coordinate;
  adres: Option<AgivAdres>;
  weglocaties: Option<LsWegLocaties>;
}

interface LsWegLocatie {
  ident8: string;
  hm: number;
  district: string;
  districtcode: string;
  position: number;
  distance: number;
  distancetopole: number;
}

interface LsWegLocaties {
  total: number;
  items: LsWegLocatie[];
  error: string;
}

interface XY2Address {
  adres: AgivAdres;
  afstand: number;
}

interface AgivAdres {
  gemeente: string;
  straat: string;
  postcode: string;
  huisnummer: string;
}

function toWegLocaties(lsWegLocaties: LsWegLocaties): List<WegLocatie> {
  return List<WegLocatie>(lsWegLocaties.items.map(locatie => this.toWegLocatie(locatie)));
}

function toWegLocatie(lsWegLocatie: LsWegLocatie): WegLocatie {
  return {
    ident8: lsWegLocatie.ident8,
    hm: `${lsWegLocatie.hm}`,
    afstand: `${lsWegLocatie.distance}`,
    wegbeheerder: lsWegLocatie.district
  };
}

function toAdres(agivAdres: AgivAdres): Adres {
  return {
    straat: agivAdres.straat,
    huisnummer: agivAdres.huisnummer,
    postcode: agivAdres.postcode,
    gemeente: agivAdres.gemeente
  };
}

@Component({
  selector: "awv-kaart-bevragen",
  template: "",
  styleUrls: ["./kaart-bevragen.component.scss"]
})
export class KaartBevragenComponent extends KaartModusComponent implements OnInit, OnDestroy {
  private ontvangenInformatie = new BehaviorSubject<Option<OntvangenInformatie>>(none);

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
    this.bindToLifeCycle(this.ontvangenInformatie).subscribe(msg => {
      msg.map(info => {
        this.toonInfoBoodschap(
          info.currentClick, //
          info.adres.map(adres => toAdres(adres)), //
          info.weglocaties.map(weglocaties => toWegLocaties(weglocaties))
        );
      });
    });

    const clickObs$ = this.internalMessage$.pipe(
      ofType<KaartClickMsg>("KaartClick"), //
      observeOnAngular(this.zone),
      takeUntil(this.destroying$), // autounsubscribe bij destroy component
      skipUntilInitialised(),
      map((msg: KaartClickMsg) => msg.clickCoordinaat)
    );

    clickObs$.subscribe((coordinate: ol.Coordinate) => {
      this.ontvangenInformatie.next(
        some({
          currentClick: coordinate,
          weglocaties: none,
          adres: none
        })
      );
    });

    clickObs$
      .pipe(
        // switchMap zal inner observables automatisch unsubscriben, zodat calls voor vorige coordinaat gecancelled worden
        switchMap((coordinaat: ol.Coordinate) =>
          this.http
            .get<LsWegLocaties>("https://apps-dev.mow.vlaanderen.be/wegendatabank/v1/locator/xy2loc", {
              params: {
                x: `${coordinaat[0]}`,
                y: `${coordinaat[1]}`,
                maxAfstand: "25",
                showall: "true"
              }
            })
            .catch(error => {
              // bij fout toch zeker geldige observable doorsturen - anders geen volgende events meer.. bug rxJs?
              kaartLogger.error(`Fout bij opvragen adres: ${error}`);
              return Observable.of({
                total: 0,
                items: [],
                error: `Fout bij opvragen adres: ${error}`
              }) as Observable<LsWegLocaties>;
            })
        )
      )
      .subscribe((weglocaties: LsWegLocaties) => {
        if (weglocaties.total !== undefined) {
          this.ontvangenInformatie.value.map(bestaandeInformatie => {
            this.ontvangenInformatie.next(
              // verrijk de bestaande identify informatie
              some({
                ...bestaandeInformatie,
                weglocaties: some(weglocaties)
              })
            );
          });
        }
      });

    clickObs$
      .pipe(
        // switchMap zal inner observables automatisch unsubscriben, zodat calls voor vorige coordinaat gecancelled worden
        switchMap((coordinaat: ol.Coordinate) =>
          this.http
            .get("https://apps-dev.mow.vlaanderen.be/agivservices/rest/locatie/adres/via/xy", {
              params: {
                x: `${coordinaat[0]}`,
                y: `${coordinaat[1]}`,
                maxResults: "1"
              }
            })
            .catch(error => {
              kaartLogger.error(`Fout bij opvragen weglocatie: ${error}`);
              // bij fout toch zeker geldige observable doorsturen - anders geen volgende events meer.. bug rxJs?
              return Observable.of([]);
            })
        )
      )
      .subscribe(
        adres => {
          if (adres instanceof Array && adres.length > 0) {
            this.ontvangenInformatie.value.map(bestaandeInformatie => {
              this.ontvangenInformatie.next(
                // verrijk de bestaande identify informatie
                some({
                  ...bestaandeInformatie,
                  adres: some(adres[0])
                })
              );
            });
          }
        },
        error => console.log(error)
      );
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper), prt.KaartClickSubscription(kaartClickWrapper)];
  }

  private toonInfoBoodschap(coordinaat: ol.Coordinate, maybeAdres: Option<Adres>, maybeWeglocaties: Option<List<WegLocatie>>) {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "Kaart bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        bron: none,
        coordinaat: coordinaat,
        adres: maybeAdres,
        weglocaties: maybeWeglocaties,
        verbergMsgGen: () => none
      })
    );
  }
}
