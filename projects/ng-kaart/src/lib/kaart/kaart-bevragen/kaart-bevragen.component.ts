import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { none, Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { debounceTime, filter, map, mergeAll, scan, startWith, switchMap, timeoutWith } from "rxjs/operators";

import { observeOnAngular } from "../../util/observe-on-angular";
import * as ke from "../kaart-elementen";
import { KaartModusComponent } from "../kaart-modus-component";
import * as prt from "../kaart-protocol";
import { Progress, Received, Requested, TimedOut } from "../kaart-with-info-model";
import { KaartComponent } from "../kaart.component";

import * as srv from "./kaart-bevragen.service";
import { Adres, LaagLocationInfo, LaagLocationInfoService, WegLocatie } from "./laaginfo.model";

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

    const stableReferentielagen$ = this.modelChanges.lagenOpGroep.get("Voorgrond.Laag")!.pipe(debounceTime(250));
    const stableInfoServices$ = this.modelChanges.laagLocationInfoServicesOpTitel$.pipe(debounceTime(250));
    const geklikteLocatie$ = this.modelChanges.kaartKlikLocatie$.pipe(filter(l => this.isActief() && !l.coversFeature));

    const allSvcCalls: (
      _1: Array<ke.ToegevoegdeLaag>,
      _2: Map<string, LaagLocationInfoService>,
      _3: ol.Coordinate
    ) => Array<rx.Observable<srv.LocatieInfo>> = (lgn, svcs, locatie) =>
      lgn
        .filter(lg => lg!.layer.getVisible() && svcs.has(lg!.titel)) // zichtbare lagen met een info service
        .map(lg => infoForLaag(locatie, lg!, svcs.get(lg!.titel)!))
        .concat([
          srv.wegLocatiesViaXY$(this.http, locatie).pipe(map(weglocatie => srv.fromWegLocaties(locatie, weglocatie))),
          srv.adresViaXY$(this.http, locatie).pipe(map(adres => srv.withAdres(locatie, adres)))
        ]);

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
      this.toonInfoBoodschap(
        msg.kaartLocatie,
        msg.adres.map(srv.toAdres),
        msg.weglocaties.map(srv.toWegLocaties).getOrElse([]),
        msg.lagenLocatieInfo
      );
    });
  }

  private toonInfoBoodschap(
    coordinaat: ol.Coordinate,
    maybeAdres: Option<Adres>,
    wegLocaties: Array<WegLocatie>,
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
        adres: maybeAdres,
        weglocaties: wegLocaties,
        laagLocatieInfoOpTitel: lagenLocatieInfo,
        verbergMsgGen: () => none
      })
    );
    this.dispatch(
      prt.PublishKaartLocatiesCmd({
        coordinaat: coordinaat,
        maybeAdres: maybeAdres,
        wegLocaties: wegLocaties,
        lagenLocatieInfo: lagenLocatieInfo
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
      timeoutWith(5000, rx.of(srv.withLaagLocationInfo(srv.fromCoordinate(location), laag.titel, TimedOut)))
    );
}
