import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { either, option } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import * as rx from "rxjs";
import { catchError, flatMap, map, switchMap } from "rxjs/operators";

import { Coordinates } from "../../coordinaten";
import * as arrays from "../../util/arrays";
import * as maps from "../../util/maps";
import * as ol from "../../util/openlayers-compat";
import { proceed, Progress, Received, Requested } from "../../util/progress";
import {
  Afdeling,
  Gemeente,
  PerceelDetails,
  ZoekerPerceelService,
} from "../../zoeker/perceel/zoeker-perceel.service";
import { kaartLogger } from "../log";

import {
  Adres,
  AdresResult,
  BevragenErrorReason,
  LaagLocationInfoResult,
  PerceelDetailsResult,
  PerceelInfo,
  PerceelResult,
  WegLocatie,
  WegLocaties,
  WegLocatiesResult,
} from "./laaginfo.model";

export interface LocatieInfo {
  readonly timestamp: number;
  readonly kaartLocatie: ol.Coordinate;
  readonly adres: Progress<AdresResult>;
  readonly weglocaties: Progress<WegLocatiesResult>;
  readonly perceel: Progress<PerceelResult>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfoResult>>;
}

export function LocatieInfo(
  timestamp: number,
  kaartLocatie: ol.Coordinate,
  adres: Progress<AdresResult>,
  weglocaties: Progress<WegLocatiesResult>,
  perceel: Progress<PerceelResult>,
  lagenLocatieInfo: Map<string, Progress<LaagLocationInfoResult>>
): LocatieInfo {
  return {
    timestamp: timestamp,
    kaartLocatie: kaartLocatie,
    adres: adres,
    weglocaties: weglocaties,
    perceel: perceel,
    lagenLocatieInfo: lagenLocatieInfo,
  };
}

interface LsWegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly district: string;
  readonly districtcode: string;
  readonly position: number;
  readonly distance: number;
  readonly distancetopole: number;
  readonly projected: any;
}

interface LsWegLocaties {
  readonly total: number;
  readonly items: LsWegLocatie[];
  readonly error: string; // TODO naar Validation of Either
}

export function LsWegLocaties(
  total: number,
  items: LsWegLocatie[],
  error: string
): LsWegLocaties {
  return {
    total: total,
    items: items,
    error: error,
  };
}

export type XY2AdresResponse = XY2AdresSucces[] | XY2AdresError;

export interface XY2AdresSucces {
  readonly kind: "XY2AdresSucces";
  readonly adres: AgivAdres;
  readonly afstand: number;
}

export interface XY2AdresError {
  kind: "XY2AdresSucces";
  error: string;
}

export function XY2AdresError(message: string): XY2AdresError {
  return {
    kind: "XY2AdresSucces",
    error: message,
  };
}

export interface AgivAdres {
  readonly gemeente: string;
  readonly straat: string;
  readonly postcode: string;
  readonly huisnummer: string;
}

export function toWegLocaties(lsWegLocaties: LsWegLocaties): Array<WegLocatie> {
  return lsWegLocaties.items.map(toWegLocatie);
}

export function toPerceel(perceel: PerceelDetails): PerceelInfo {
  // TODO: fill in gemeente en afdeling naam
  return {
    gemeente: perceel.niscode,
    afdeling: perceel.afdelingcode,
    capaKey: perceel.capakey,
    perceel: perceel.perceelsnummer,
    sectie: perceel.sectiecode,
  };
}

const geoJSONOptions = <ol.format.GeoJSONOptions>{
  ignoreExtraDims: true,
  defaultDataProjection: undefined,
  featureProjection: undefined,
};

function toWegLocatie(lsWegLocatie: LsWegLocatie): WegLocatie {
  const geometry = new ol.format.GeoJSON(geoJSONOptions).readGeometry(
    lsWegLocatie.projected
  );
  return {
    ident8: lsWegLocatie.ident8,
    hm: lsWegLocatie.hm,
    afstand: lsWegLocatie.distancetopole,
    wegbeheerder: lsWegLocatie.district,
    projectieafstand: lsWegLocatie.distance,
    projected: geometry,
  };
}

function toAdres(agivAdres: AgivAdres): Adres {
  return {
    straat: agivAdres.straat,
    huisnummer: agivAdres.huisnummer,
    postcode: agivAdres.postcode,
    gemeente: agivAdres.gemeente,
  };
}

export function XY2AdresResponseToEither(
  response: XY2AdresResponse
): AdresResult {
  if (!arrays.isArray(response)) {
    kaartLogger.warn(
      "Fout bij opvragen adres",
      (response as XY2AdresError).error
    );
    return either.left<BevragenErrorReason, Adres>("ServiceError");
  } else {
    const succes = response as XY2AdresSucces[];
    if (arrays.isNonEmpty(succes)) {
      return either.right(toAdres(succes[0].adres));
    } else {
      return either.left<BevragenErrorReason, Adres>("NoData");
    }
  }
}

export function LsWegLocatiesResultToEither(
  response: LsWegLocaties
): WegLocatiesResult {
  return pipe(
    either.fromPredicate<BevragenErrorReason, LsWegLocaties>(
      (r) => r.items != null,
      (r) =>
        pipe(
          option.fromNullable(r.error),
          option.map<string, BevragenErrorReason>(() => "ServiceError"),
          option.getOrElse(() => "NoData")
        )
    )(response),
    either.map(toWegLocaties)
  );
}

export function PerceelDetailsToEither(
  response: PerceelDetails
): PerceelDetailsResult {
  return either.fromPredicate<BevragenErrorReason, PerceelDetails>(
    (r) => r.capakey != null,
    (r) =>
      pipe(
        option.fromNullable(r.error),
        option.map<string, BevragenErrorReason>(() => "ServiceError"),
        option.getOrElse(() => "NoData")
      )
  )(response);
}

export function fromTimestampAndCoordinate(
  timestamp: number,
  coordinaat: ol.Coordinate
): LocatieInfo {
  return LocatieInfo(
    timestamp,
    coordinaat,
    Requested,
    Requested,
    Requested,
    new Map()
  );
}

export function withAdres(
  timestamp: number,
  coordinaat: ol.Coordinate,
  adres: AdresResult
): LocatieInfo {
  return LocatieInfo(
    timestamp,
    coordinaat,
    Received(adres),
    Requested,
    Requested,
    new Map()
  );
}

export function withPerceel(
  timestamp: number,
  coordinaat: ol.Coordinate,
  perceel: PerceelResult
): LocatieInfo {
  return LocatieInfo(
    timestamp,
    coordinaat,
    Requested,
    Requested,
    Received(perceel),
    new Map()
  );
}

export function fromWegLocaties(
  timestamp: number,
  coordinaat: ol.Coordinate,
  wegLocaties: WegLocatiesResult
): LocatieInfo {
  return LocatieInfo(
    timestamp,
    coordinaat,
    Requested,
    Received(wegLocaties),
    Requested,
    new Map()
  );
}

export function merge(i1: LocatieInfo, i2: LocatieInfo): LocatieInfo {
  // Merge kan enkel als de 2 coordinaten en timestamps gelijk zijn.
  return Coordinates.equal(i1.kaartLocatie, i2.kaartLocatie) &&
    i1.timestamp === i2.timestamp
    ? LocatieInfo(
        i2.timestamp,
        i2.kaartLocatie,
        proceed(i2.adres, i1.adres),
        proceed(i2.weglocaties, i1.weglocaties),
        proceed(i2.perceel, i1.perceel),
        maps.concat(i1.lagenLocatieInfo)(i2.lagenLocatieInfo)
      )
    : i2;
}

export function withLaagLocationInfo(
  i: LocatieInfo,
  laagTitel: string,
  lli: Progress<LaagLocationInfoResult>
): LocatieInfo {
  return {
    ...i,
    lagenLocatieInfo: maps.set(i.lagenLocatieInfo, laagTitel, lli),
  };
}

export const errorToReason: (arg: any) => BevragenErrorReason = (error) => {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404) {
      return "NoData";
    } else if (error.status === 0) {
      return "Unreachable";
    } else {
      // Eén of andere ander fout
      return "ServiceError";
    }
  } else {
    // Dit zou niet mogen
    return "ServiceError";
  }
};

export function adresViaXY$(
  http: HttpClient,
  coordinaat: ol.Coordinate
): rx.Observable<AdresResult> {
  return http
    .get<XY2AdresSucces[] | XY2AdresError>(
      "/agivservices/rest/locatie/adres/via/xy",
      {
        params: {
          x: `${coordinaat[0]}`,
          y: `${coordinaat[1]}`,
          maxResults: "1",
        },
      }
    )
    .pipe(
      map(XY2AdresResponseToEither),
      catchError((error) => {
        kaartLogger.error("Fout bij opvragen weglocatie", error);
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        return rx.of(
          either.left<BevragenErrorReason, Adres>(errorToReason(error))
        );
      })
    );
}

export function enhancePerceelMetGemeenteEnAfdeling(
  perceel: PerceelDetails,
  gemeenten: Gemeente[],
  afdelingen: Afdeling[]
): PerceelResult {
  return either.right({
    gemeente: pipe(
      option.fromNullable(
        gemeenten.find(
          (gemeente) => gemeente.niscode.toString() === perceel.niscode
        )
      ),
      option.map((gemeente) => gemeente.naam),
      option.getOrElse(() => perceel.niscode)
    ),
    afdeling: pipe(
      option.fromNullable(
        afdelingen.find((afdeling) => afdeling.code === perceel.afdelingcode)
      ),
      option.map((afdeling) => afdeling.naam),
      option.getOrElse(() => perceel.afdelingcode)
    ),
    sectie: perceel.sectiecode,
    perceel: perceel.perceelsnummer,
    capaKey: perceel.capakey,
  });
}

export function enhancePerceelMetGemeenteEnAfdeling$(
  maybePerceel: PerceelDetailsResult,
  zoekerPerceelService: ZoekerPerceelService
): rx.Observable<PerceelResult> {
  return pipe(
    maybePerceel,
    either.fold(
      (error) => rx.of(either.left<BevragenErrorReason, PerceelInfo>(error)),
      (perceel) =>
        rx
          .zip(
            zoekerPerceelService.getAlleGemeenten$(),
            zoekerPerceelService.getAfdelingen$(parseInt(perceel.niscode, 10))
          )
          .pipe(
            map(([gemeenten, afdelingen]) =>
              enhancePerceelMetGemeenteEnAfdeling(
                perceel,
                gemeenten,
                afdelingen
              )
            )
          )
    )
  );
}

export function getPerceelDetailsByXY$(
  http: HttpClient,
  perceelService: ZoekerPerceelService,
  coordinaat: ol.Coordinate
): rx.Observable<PerceelResult> {
  return http
    .get<PerceelDetails>(
      `/locatorservices/rest/capakey/perceel/by/xy/${coordinaat[0]}/${coordinaat[1]}`
    )
    .pipe(
      map(PerceelDetailsToEither),
      switchMap((perceel) =>
        enhancePerceelMetGemeenteEnAfdeling$(perceel, perceelService)
      ),
      catchError((error) => {
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        kaartLogger.error("Fout bij opvragen adres", error);
        return rx.of(
          either.left<BevragenErrorReason, PerceelInfo>(errorToReason(error))
        );
      })
    );
}

export function wegLocatiesViaXY$(
  http: HttpClient,
  coordinaat: ol.Coordinate,
  zoekAfstand = 25
): rx.Observable<WegLocatiesResult> {
  return http
    .get<LsWegLocaties>("/wegendatabank/v1/locator/xy2loc", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxAfstand: zoekAfstand.toString(),
        showall: "true",
      },
    })
    .pipe(
      map(LsWegLocatiesResultToEither),
      catchError((error) => {
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        kaartLogger.error("Fout bij opvragen adres", error);
        return rx.of(
          either.left<BevragenErrorReason, WegLocaties>(errorToReason(error))
        );
      })
    );
}
