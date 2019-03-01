import { HttpClient } from "@angular/common/http";
import { either } from "fp-ts";
import { left, right } from "fp-ts/lib/Either";
import { fromNullable } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Coordinate } from "../../coordinaten";
import * as arrays from "../../util/arrays";
import { proceed, Progress, Received, Requested } from "../../util/progress";
import { kaartLogger } from "../log";

import { Adres, AdresResult, LaagLocationInfo, WegLocatie, WegLocaties, WegLocatiesResult } from "./laaginfo.model";

export interface LocatieInfo {
  readonly timestamp: number;
  readonly kaartLocatie: ol.Coordinate;
  readonly adres: Progress<AdresResult>;
  readonly weglocaties: Progress<WegLocatiesResult>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>;
}

export function LocatieInfo(
  timestamp: number,
  kaartLocatie: ol.Coordinate,
  adres: Progress<AdresResult>,
  weglocaties: Progress<WegLocatiesResult>,
  lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>
): LocatieInfo {
  return {
    timestamp: timestamp,
    kaartLocatie: kaartLocatie,
    adres: adres,
    weglocaties: weglocaties,
    lagenLocatieInfo: lagenLocatieInfo
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
}

interface LsWegLocaties {
  readonly total: number;
  readonly items: LsWegLocatie[];
  readonly error: string; // TODO naar Validation of Either
}

export function LsWegLocaties(total: number, items: LsWegLocatie[], error: string): LsWegLocaties {
  return {
    total: total,
    items: items,
    error: error
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
    error: message
  };
}

export interface AgivAdres {
  readonly gemeente: string;
  readonly straat: string;
  readonly postcode: string;
  readonly huisnummer: string;
}

export function toWegLocaties(lsWegLocaties: LsWegLocaties): WegLocatie[] {
  return lsWegLocaties.items.map(toWegLocatie);
}

function toWegLocatie(lsWegLocatie: LsWegLocatie): WegLocatie {
  return {
    ident8: lsWegLocatie.ident8,
    hm: lsWegLocatie.hm,
    afstand: lsWegLocatie.distancetopole,
    wegbeheerder: lsWegLocatie.district,
    projectieafstand: lsWegLocatie.distance
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

export function XY2AdresResponseToEither(response: XY2AdresResponse): AdresResult {
  if (!arrays.isArray(response)) {
    return left((response as XY2AdresError).error);
  } else {
    const succes = response as XY2AdresSucces[];
    if (arrays.isNonEmpty(succes)) {
      return right(toAdres(succes[0].adres));
    } else {
      return left("Er is niet minstens 1 adres gevonden");
    }
  }
}

export function LsWegLocatiesResultToEither(response: LsWegLocaties): WegLocatiesResult {
  return either
    .fromPredicate<string, LsWegLocaties>(r => r.items != null, r => fromNullable(r.error).getOrElse("Geen items gevonden"))(response)
    .map(toWegLocaties);
}

export function fromTimestampAndCoordinate(timestamp: number, coordinaat: ol.Coordinate): LocatieInfo {
  return LocatieInfo(timestamp, coordinaat, Requested, Requested, Map());
}

export function withAdres(timestamp: number, coordinaat: ol.Coordinate, adres: AdresResult): LocatieInfo {
  return LocatieInfo(timestamp, coordinaat, Received(adres), Requested, Map());
}

export function fromWegLocaties(timestamp: number, coordinaat: ol.Coordinate, wegLocaties: WegLocatiesResult): LocatieInfo {
  return LocatieInfo(timestamp, coordinaat, Requested, Received(wegLocaties), Map());
}

export function merge(i1: LocatieInfo, i2: LocatieInfo): LocatieInfo {
  // Merge kan enkel als de 2 coordinaten en timestamps gelijk zijn.
  return Coordinate.equal(i1.kaartLocatie, i2.kaartLocatie) && i1.timestamp === i2.timestamp
    ? LocatieInfo(
        i2.timestamp,
        i2.kaartLocatie,
        proceed(i2.adres, i1.adres),
        proceed(i2.weglocaties, i1.weglocaties),
        i1.lagenLocatieInfo.concat(i2.lagenLocatieInfo).toMap()
      )
    : i2;
}

export function withLaagLocationInfo(i: LocatieInfo, laagTitel: string, lli: Progress<LaagLocationInfo>): LocatieInfo {
  return { ...i, lagenLocatieInfo: i.lagenLocatieInfo.set(laagTitel, lli) };
}

export function adresViaXY$(http: HttpClient, coordinaat: ol.Coordinate): rx.Observable<AdresResult> {
  return http
    .get<XY2AdresSucces[] | XY2AdresError>("/agivservices/rest/locatie/adres/via/xy", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxResults: "1"
      }
    })
    .pipe(
      map(XY2AdresResponseToEither),
      catchError(error => {
        kaartLogger.error("Fout bij opvragen weglocatie", error);
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        return rx.of(left<string, Adres>(`Fout bij opvragen weglocatie: ${error}`));
      })
    );
}

export function wegLocatiesViaXY$(http: HttpClient, coordinaat: ol.Coordinate): rx.Observable<WegLocatiesResult> {
  return http
    .get<LsWegLocaties>("/wegendatabank/v1/locator/xy2loc", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxAfstand: "25",
        showall: "true"
      }
    })
    .pipe(
      map(LsWegLocatiesResultToEither),
      catchError(error => {
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        kaartLogger.error("Fout bij opvragen adres", error);
        return rx.of(left<string, WegLocaties>(`Fout bij opvragen adres: ${error}`));
      })
    );
}
