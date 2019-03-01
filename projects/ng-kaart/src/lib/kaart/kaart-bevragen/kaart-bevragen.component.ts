import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { identity } from "fp-ts/lib/function";
import * as option from "fp-ts/lib/Option";
import { none } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, filter, map, mergeAll, scan, startWith, switchMap, timeoutWith } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import { Progress, Received, Requested, TimedOut } from "../../util/progress";
import * as progress from "../../util/progress";
import * as ke from "../kaart-elementen";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";

import * as srv from "./kaart-bevragen.service";
import { AdresResult, LaagLocationInfo, LaagLocationInfoService, WegLocatiesResult } from "./laaginfo.model";

export const BevraagKaartUiSelector = "Bevraagkaart";

@Component({
  selector: "awv-kaart-bevragen",
  template: ""
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

  ngOnInit(): void {
    super.ngOnInit();

    const stableReferentielagen$ = this.modelChanges.lagenOpGroep.get("Voorgrond.Laag").pipe(debounceTime(250));
    const stableInfoServices$ = this.modelChanges.laagLocationInfoServicesOpTitel$.pipe(debounceTime(250));
    const geklikteLocatie$ = this.modelChanges.kaartKlikLocatie$.pipe(filter(l => this.isActief() && !l.coversFeature));

    const allSvcCalls: (
      _1: List<ke.ToegevoegdeLaag>,
      _2: Map<string, LaagLocationInfoService>,
      _3: ol.Coordinate
    ) => Array<rx.Observable<srv.LocatieInfo>> = (lgn, svcs, locatie) => {
      const timestamp = Date.now();
      return lgn
        .filter(lg => lg!.layer.getVisible() && svcs.has(lg!.titel)) // zichtbare lagen met een info service
        .map(lg => infoForLaag(timestamp, locatie, lg!, svcs.get(lg!.titel)))
        .toList()
        .push(
          srv.wegLocatiesViaXY$(this.http, locatie).pipe(map(weglocatie => srv.fromWegLocaties(timestamp, locatie, weglocatie))),
          srv.adresViaXY$(this.http, locatie).pipe(map(adres => srv.withAdres(timestamp, locatie, adres)))
        )
        .toArray();
    };

    this.bindToLifeCycle(
      stableReferentielagen$.pipe(
        switchMap(lgn =>
          stableInfoServices$.pipe(
            switchMap(svcs =>
              geklikteLocatie$.pipe(
                switchMap(locatie =>
                  rx.from(allSvcCalls(lgn, svcs, locatie.coordinate)).pipe(
                    mergeAll(5), //
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
      const adres = msg.adres;
      const wegLocaties = msg.weglocaties;
      this.toonInfoBoodschap(msg.kaartLocatie, adres, wegLocaties, msg.lagenLocatieInfo);
      this.publiceerInfoBoodschap(msg.timestamp, msg.kaartLocatie, adres, wegLocaties, msg.lagenLocatieInfo);
    });
  }

  private toonInfoBoodschap(
    coordinaat: ol.Coordinate,
    maybeAdres: Progress<AdresResult>,
    wegLocaties: Progress<WegLocatiesResult>,
    lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>
  ) {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "kaart_bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        bron: none,
        coordinaat: coordinaat,
        adres: progress.toOption(maybeAdres).chain(option.fromEither),
        weglocaties: progress.toOption(wegLocaties).fold([], wls => wls.fold(() => [], identity)),
        laagLocatieInfoOpTitel: lagenLocatieInfo,
        verbergMsgGen: () => none
      })
    );
  }

  private publiceerInfoBoodschap(
    timestamp: number,
    coordinaat: ol.Coordinate,
    maybeAdres: Progress<AdresResult>,
    wegLocaties: Progress<WegLocatiesResult>,
    lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>
  ) {
    this.dispatch(
      prt.PublishKaartLocatiesCmd({
        timestamp: timestamp,
        coordinaat: coordinaat,
        maybeAdres: maybeAdres,
        wegLocaties: wegLocaties,
        lagenLocatieInfo: lagenLocatieInfo
      })
    );
  }
}

function infoForLaag(
  timestamp: number,
  location: ol.Coordinate,
  laag: ke.ToegevoegdeLaag,
  svc: LaagLocationInfoService
): rx.Observable<srv.LocatieInfo> {
  return svc
    .infoByLocation$(location) //
    .pipe(
      map(info => srv.withLaagLocationInfo(srv.fromTimestampAndCoordinate(timestamp, location), laag.titel, Received(info))),
      startWith(srv.withLaagLocationInfo(srv.fromTimestampAndCoordinate(timestamp, location), laag.titel, Requested)),
      timeoutWith(5000, rx.of(srv.withLaagLocationInfo(srv.fromTimestampAndCoordinate(timestamp, location), laag.titel, TimedOut)))
    );
}
