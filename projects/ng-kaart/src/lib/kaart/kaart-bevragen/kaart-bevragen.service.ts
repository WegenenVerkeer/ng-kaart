import { HttpClient } from "@angular/common/http";
import { array } from "fp-ts";
import { fromNullable, none, Option, some } from "fp-ts/lib/Option";
import { setoidNumber } from "fp-ts/lib/Setoid";
import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";
import { catchError } from "rxjs/operators";

import { Progress } from "../kaart-with-info-model";
import { kaartLogger } from "../log";

import { Adres, LaagLocationInfo, WegLocatie } from "./laaginfo.model";

export interface LocatieInfo {
  readonly kaartLocatie: ol.Coordinate;
  readonly adres: Option<AgivAdres>;
  readonly weglocaties: Option<LsWegLocaties>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>;
}

export function LocatieInfo(
  kaartLocatie: ol.Coordinate,
  adres: Option<AgivAdres>,
  weglocaties: Option<LsWegLocaties>,
  lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>
): LocatieInfo {
  return {
    kaartLocatie: kaartLocatie,
    adres: adres,
    weglocaties: weglocaties,
    lagenLocatieInfo: lagenLocatieInfo
  };
}

export interface LsWegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly district: string;
  readonly districtcode: string;
  readonly position: number;
  readonly distance: number;
  readonly distancetopole: number;
}

export interface LsWegLocaties {
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

// TODO Validation of Either gebruiken
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

export function toWegLocaties(lsWegLocaties: LsWegLocaties): List<WegLocatie> {
  return List<WegLocatie>(lsWegLocaties.items.map(toWegLocatie));
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

export function toAdres(agivAdres: AgivAdres): Adres {
  return {
    straat: agivAdres.straat,
    huisnummer: agivAdres.huisnummer,
    postcode: agivAdres.postcode,
    gemeente: agivAdres.gemeente
  };
}

export function fromCoordinate(coordinaat: ol.Coordinate): LocatieInfo {
  return LocatieInfo(coordinaat, none, none, Map());
}

export function withAdres(coordinaat: ol.Coordinate, adres: XY2AdresSucces[] | XY2AdresError): LocatieInfo {
  if (adres instanceof Array && adres.length > 0) {
    return LocatieInfo(coordinaat, some(adres[0].adres), none, Map());
  } else {
    return LocatieInfo(coordinaat, none, none, Map());
  }
}

export function fromWegLocaties(coordinaat: ol.Coordinate, lsWegLocaties: LsWegLocaties): LocatieInfo {
  return fromNullable(lsWegLocaties.error).foldL(
    () => LocatieInfo(coordinaat, none, some(lsWegLocaties), Map()),
    () => LocatieInfo(coordinaat, none, none, Map())
  );
}

export function merge(i1: LocatieInfo, i2: LocatieInfo): LocatieInfo {
  // Merge kan enkel als de 2 coordinaten gelijk zijn.
  return coordinatesEqual(i1.kaartLocatie, i2.kaartLocatie)
    ? LocatieInfo(
        i2.kaartLocatie,
        i2.adres.alt(i1.adres),
        i2.weglocaties.alt(i1.weglocaties),
        i1.lagenLocatieInfo.concat(i2.lagenLocatieInfo).toMap()
      )
    : i2;
}

function coordinatesEqual(c1: ol.Coordinate, c2: ol.Coordinate): boolean {
  return array.getSetoid(setoidNumber).equals(c1, c2);
}

export function withLaagLocationInfo(i: LocatieInfo, laagTitel: string, lli: Progress<LaagLocationInfo>): LocatieInfo {
  return { ...i, lagenLocatieInfo: i.lagenLocatieInfo.set(laagTitel, lli) };
}

export function adresViaXY$(http: HttpClient, coordinaat: ol.Coordinate): rx.Observable<XY2AdresSucces[] | XY2AdresError> {
  return http
    .get<XY2AdresSucces[] | XY2AdresError>("/agivservices/rest/locatie/adres/via/xy", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxResults: "1"
      }
    })
    .pipe(
      catchError(error => {
        kaartLogger.error("Fout bij opvragen weglocatie", error);
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        return rx.of(XY2AdresError(`Fout bij opvragen weglocatie: ${error}`));
      })
    );
}

export function wegLocatiesViaXY$(http: HttpClient, coordinaat: ol.Coordinate): rx.Observable<LsWegLocaties> {
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
      catchError(error => {
        // bij fout toch zeker geldige observable doorsturen, anders geen volgende events
        kaartLogger.error("Fout bij opvragen adres", error);
        return rx.of(LsWegLocaties(0, [], `Fout bij opvragen adres: ${error}`));
      })
    );
}
