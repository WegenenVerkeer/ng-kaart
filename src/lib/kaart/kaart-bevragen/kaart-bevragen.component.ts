import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { none, Option } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { OperatorFunction } from "rxjs/interfaces";
import { debounceTime, filter, map, mergeAll, scan, startWith, switchMap, timeoutWith } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import * as ke from "../kaart-elementen";
import { actieveModusGezetWrapper, KaartInternalMsg } from "../kaart-internal-messages";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Adres, Progress, Received, Requested, TimedOut, WegLocatie } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import * as srv from "./kaart-bevragen.service";
import { LaagLocationInfo, LaagLocationInfoService } from "./laaginfo.model";

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

    const stableReferentielagen$ = this.modelChanges.lagenOpGroep.get("Voorgrond.Laag").pipe(debounceTime(250));
    const stableInfoServices$ = this.modelChanges.laagLocationInfoServicesOpTitel$.pipe(debounceTime(250));
    const geklikteLocatie$ = this.modelChanges.kaartKlikLocatie$.pipe(filter(() => this.actief));

    const allSvcCalls: (
      _1: List<ke.ToegevoegdeLaag>,
      _2: Map<string, LaagLocationInfoService>,
      _3: ol.Coordinate
    ) => Array<rx.Observable<srv.LocatieInfo>> = (lgn, svcs, locatie) =>
      lgn
        .filter(lg => lg!.layer.getVisible() && svcs.has(lg!.titel)) // zichtbare lagen met een info service
        .map(lg => infoForLaag(locatie, lg!, svcs.get(lg!.titel)))
        .toList()
        .push(
          srv.wegLocatiesViaXY$(this.http, locatie).pipe(map(weglocatie => srv.fromWegLocaties(locatie, weglocatie))),
          srv.adresViaXY$(this.http, locatie).pipe(map(adres => srv.withAdres(locatie, adres)))
        )
        .toArray();

    this.bindToLifeCycle(
      stableReferentielagen$.pipe(
        switchMap(lgn =>
          stableInfoServices$.pipe(
            switchMap(svcs =>
              geklikteLocatie$.pipe(
                switchMap(locatie =>
                  rx.Observable.from(allSvcCalls(lgn, svcs, locatie)).pipe(
                    mergeAll(5) as OperatorFunction<rx.Observable<srv.LocatieInfo>, srv.LocatieInfo>, // cast owv typedefs bug
                    scan(srv.merge)
                  )
                )
              )
            )
          )
        ),
        observeOnAngular(this.zone)
      )
    ).subscribe((msg: srv.LocatieInfo) => {
      this.toonInfoBoodschap(
        msg.kaartLocatie,
        msg.adres.map(srv.toAdres),
        msg.weglocaties.map(srv.toWegLocaties).getOrElse(List()),
        msg.lagenLocatieInfo
      );
    });
  }

  protected kaartSubscriptions(): prt.Subscription<KaartInternalMsg>[] {
    return [prt.ActieveModusSubscription(actieveModusGezetWrapper)];
  }

  private toonInfoBoodschap(
    coordinaat: ol.Coordinate,
    maybeAdres: Option<Adres>,
    wegLocaties: List<WegLocatie>,
    lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>
  ) {
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
        laagLocatieInfoOpTitel: lagenLocatieInfo,
        verbergMsgGen: () => none
      })
    );
  }
}

function infoForLaag(location: ol.Coordinate, laag: ke.ToegevoegdeLaag, svc: LaagLocationInfoService): rx.Observable<srv.LocatieInfo> {
  return svc
    .infoByLocation$(location) //
    .pipe(
      map(info => srv.withLaagLocationInfo(srv.fromCoordinate(location), laag.titel, Received(info))),
      startWith(srv.withLaagLocationInfo(srv.fromCoordinate(location), laag.titel, Requested)),
      timeoutWith(5000, rx.Observable.of(srv.withLaagLocationInfo(srv.fromCoordinate(location), laag.titel, TimedOut)))
    );
}
