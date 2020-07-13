import { HttpClient } from "@angular/common/http";
import { Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { either, option, tuple } from "fp-ts";
import * as rx from "rxjs";
import { catchError, debounceTime, filter, map, mergeAll, scan, startWith, switchMap, timeoutWith } from "rxjs/operators";

import * as arrays from "../../util/arrays";
import { observeOnAngular } from "../../util/observe-on-angular";
import * as ol from "../../util/openlayers-compat";
import { Progress, Received, Requested, TimedOut } from "../../util/progress";
import * as progress from "../../util/progress";
import * as ke from "../kaart-elementen";
import { KaartModusDirective } from "../kaart-modus.directive";
import * as prt from "../kaart-protocol";
import { KaartComponent } from "../kaart.component";
import { kaartLogger } from "../log";

import { BevraagKaartOpties, BevraagKaartUiSelector, ZoekAfstand } from "./kaart-bevragen-opties";
import * as srv from "./kaart-bevragen.service";
import {
  AdresResult,
  BevragenErrorReason,
  LaagLocationInfo,
  LaagLocationInfoResult,
  LaagLocationInfoService,
  WegLocatiesResult
} from "./laaginfo.model";

const defaultOptions: BevraagKaartOpties = {
  zoekAfstand: {
    type: "Meter",
    waarde: 25
  },
  kaartBevragenOnderdrukt: false,
  infoServiceOnderdrukt: false,
  onderdrukInfoBoodschappen: false
};

// Deze component zorgt voor het klikken op de kaart _naast_ een feature. Het is deze component die de service calls
// naar de gepaste back-end services uitvoert. Voor het klikken van een feature op de kaart zie de
// KaartIdentifyComponent.
@Component({
  selector: "awv-kaart-bevragen",
  template: ""
})
export class KaartBevragenComponent extends KaartModusDirective implements OnInit, OnDestroy {
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

    const zoekAfstandInMeter = (resolution: number, zoekAfstand: ZoekAfstand) => {
      switch (zoekAfstand.type) {
        case "Meter":
          return zoekAfstand.waarde;
        case "Pixel":
          // We gaan er hier van uit dat de mapUnits van de kaart in meter is
          return zoekAfstand.waarde * resolution;
      }
    };

    const options$ = this.modusOpties$(defaultOptions);
    const stableReferentielagen$ = this.modelChanges.lagenOpGroep["Voorgrond.Laag"].pipe(debounceTime(250));
    const stableInfoServices$ = options$.pipe(
      switchMap(options =>
        options.infoServiceOnderdrukt ? rx.EMPTY : this.modelChanges.laagLocationInfoServicesOpTitel$.pipe(debounceTime(250))
      )
    );
    const infoServiceCalls$ = (
      lgn: ke.ToegevoegdeLaag[],
      svcs: Map<string, LaagLocationInfoService>,
      locatie: ol.Coordinate,
      timestamp: number,
      options: BevraagKaartOpties
    ): rx.Observable<srv.LocatieInfo> =>
      options.infoServiceOnderdrukt
        ? rx.EMPTY
        : rx
            .from(
              lgn
                .filter(lg => lg!.layer.getVisible() && svcs.has(lg!.titel)) // zichtbare lagen met een info service
                .map(lg => infoForLaag(timestamp, locatie, lg!, svcs.get(lg!.titel)!))
            )
            .pipe(mergeAll(4));
    const kaartBevragenServiceCalls$ = (
      locatie: ol.Coordinate,
      timestamp: number,
      zoekAfstandInMeter: number,
      options: BevraagKaartOpties
    ): rx.Observable<srv.LocatieInfo> =>
      options.kaartBevragenOnderdrukt
        ? rx.EMPTY
        : rx.merge(
            srv
              .wegLocatiesViaXY$(this.http, locatie, zoekAfstandInMeter)
              .pipe(map(weglocatie => srv.fromWegLocaties(timestamp, locatie, weglocatie))),
            srv.adresViaXY$(this.http, locatie).pipe(map(adres => srv.withAdres(timestamp, locatie, adres)))
          );
    const clickOutsideFeature$ = this.modelChanges.kaartKlikLocatie$.pipe(filter(l => !l.coversFeature));
    const geklikteLocatie$ = this.isActief$.pipe(switchMap(isActief => (isActief ? clickOutsideFeature$ : rx.EMPTY)));
    const stableZoekAfstand$ = (options: BevraagKaartOpties) =>
      this.modelChanges.viewinstellingen$.pipe(
        debounceTime(250),
        map(view => zoekAfstandInMeter(view.resolution, options.zoekAfstand))
      );

    const allSvcCalls = (
      lgn: ke.ToegevoegdeLaag[],
      svcs: Map<string, LaagLocationInfoService>,
      locatie: ol.Coordinate,
      zoekAfstandInMeter: number,
      options: BevraagKaartOpties
    ): rx.Observable<srv.LocatieInfo> => {
      const timestamp = Date.now();
      return rx.merge(
        infoServiceCalls$(lgn, svcs, locatie, timestamp, options),
        kaartBevragenServiceCalls$(locatie, timestamp, zoekAfstandInMeter, options)
      );
    };

    this.bindToLifeCycle(
      stableReferentielagen$.pipe(
        switchMap(lgn =>
          stableInfoServices$.pipe(
            switchMap(svcs =>
              options$.pipe(
                switchMap(options =>
                  stableZoekAfstand$(options).pipe(
                    switchMap(zoekAfstand =>
                      geklikteLocatie$.pipe(
                        switchMap(locatie =>
                          allSvcCalls(lgn, svcs, locatie.coordinate, zoekAfstand, options) //
                            .pipe(
                              scan(srv.merge),
                              map(locatieInfo => new tuple.Tuple<srv.LocatieInfo, BevraagKaartOpties>(locatieInfo, options))
                            )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        ),
        observeOnAngular(this.zone)
      )
    ).subscribe(tuple => {
      const msg = tuple.fst;
      const options = tuple.snd;
      const adres = msg.adres;
      const wegLocaties = msg.weglocaties;
      if (!options.onderdrukInfoBoodschappen) {
        this.toonInfoBoodschap(msg.kaartLocatie, adres, wegLocaties, msg.lagenLocatieInfo);
      }
      this.publiceerInfoBoodschap(msg.timestamp, msg.kaartLocatie, adres, wegLocaties, msg.lagenLocatieInfo);
    });
  }

  private toonInfoBoodschap(
    coordinaat: ol.Coordinate,
    maybeAdres: Progress<AdresResult>,
    wegLocaties: Progress<WegLocatiesResult>,
    lagenLocatieInfo: Map<string, Progress<LaagLocationInfoResult>>
  ) {
    this.dispatch(
      prt.ToonInfoBoodschapCmd({
        id: "kaart_bevragen",
        type: "InfoBoodschapKaartBevragen",
        titel: "Kaart bevragen",
        sluit: "DOOR_APPLICATIE",
        bron: option.none,
        coordinaat: coordinaat,
        adres: progress.toOption(maybeAdres).chain(option.fromEither),
        // We moeten een Progress<Either<A, B[]>> omzetten naar een B[]
        weglocaties: arrays.fromOption(progress.toOption(wegLocaties).map(arrays.fromEither)),
        laagLocatieInfoOpTitel: lagenLocatieInfo,
        verbergMsgGen: () => option.none
      })
    );
  }

  private publiceerInfoBoodschap(
    timestamp: number,
    coordinaat: ol.Coordinate,
    maybeAdres: Progress<AdresResult>,
    wegLocaties: Progress<WegLocatiesResult>,
    lagenLocatieInfo: Map<string, Progress<LaagLocationInfoResult>>
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
      map(info =>
        srv.withLaagLocationInfo(
          srv.fromTimestampAndCoordinate(timestamp, location),
          laag.titel,
          Received(either.right<BevragenErrorReason, LaagLocationInfo>(info))
        )
      ),
      startWith(srv.withLaagLocationInfo(srv.fromTimestampAndCoordinate(timestamp, location), laag.titel, Requested)),
      timeoutWith(5000, rx.of(srv.withLaagLocationInfo(srv.fromTimestampAndCoordinate(timestamp, location), laag.titel, TimedOut))),
      catchError(error => {
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        kaartLogger.error("Fout bij opvragen laaginfo", error);
        return rx.of(
          srv.withLaagLocationInfo(
            srv.fromTimestampAndCoordinate(timestamp, location),
            laag.titel,
            Received(either.left<BevragenErrorReason, LaagLocationInfo>(srv.errorToReason(error)))
          )
        );
      })
    );
}
