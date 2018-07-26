import { HttpClient } from "@angular/common/http";
import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";
import { Observable } from "rxjs/Observable";

import { Adres, WegLocatie } from "../kaart-with-info-model";
import { kaartLogger } from "../log";

export interface OntvangenInformatie {
  currentClick: ol.Coordinate;
  adres: Option<AgivAdres>;
  weglocaties: Option<LsWegLocaties>;
}

export interface LsWegLocatie {
  ident8: string;
  hm: number;
  district: string;
  districtcode: string;
  position: number;
  distance: number;
  distancetopole: number;
}

export interface LsWegLocaties {
  total: number;
  items: LsWegLocatie[];
  error: string;
}

export function LsWegLocaties(total: number, items: LsWegLocatie[], error: string): LsWegLocaties {
  return {
    total: total,
    items: items,
    error: error
  };
}

export interface XY2AdresSucces {
  kind: "XY2AdresSucces";
  adres: AgivAdres;
  afstand: number;
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
  gemeente: string;
  straat: string;
  postcode: string;
  huisnummer: string;
}

export function toWegLocaties(lsWegLocaties: LsWegLocaties): List<WegLocatie> {
  return List<WegLocatie>(lsWegLocaties.items.map(locatie => toWegLocatie(locatie)));
}

export function toWegLocatie(lsWegLocatie: LsWegLocatie): WegLocatie {
  return {
    ident8: lsWegLocatie.ident8,
    hm: lsWegLocatie.hm,
    afstand: lsWegLocatie.distance,
    wegbeheerder: lsWegLocatie.district
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

export function adresViaXYObs$(http: HttpClient, coordinaat: ol.Coordinate): Observable<XY2AdresSucces[] | XY2AdresError> {
  return http
    .get<XY2AdresSucces[] | XY2AdresError>("/agivservices/rest/locatie/adres/via/xy", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxResults: "1"
      }
    })
    .catch(error => {
      kaartLogger.error(`Fout bij opvragen weglocatie: ${error}`);
      // bij fout toch zeker geldige observable doorsturen - anders geen volgende events meer bij switchMap.. bug rxJs?
      return Observable.of(XY2AdresError(`Fout bij opvragen weglocatie: ${error}`));
    });
}

export function wegLocatiesViaXYObs$(http: HttpClient, coordinaat: ol.Coordinate): Observable<LsWegLocaties> {
  return http
    .get<LsWegLocaties>("/wegendatabank/v1/locator/xy2loc", {
      params: {
        x: `${coordinaat[0]}`,
        y: `${coordinaat[1]}`,
        maxAfstand: "25",
        showall: "true"
      }
    })
    .catch(error => {
      // bij fout toch zeker geldige observable doorsturen - anders geen volgende events meer bij switchMap.. bug rxJs?
      kaartLogger.error(`Fout bij opvragen adres: ${error}`);
      return Observable.of(LsWegLocaties(0, [], `Fout bij opvragen adres: ${error}`));
    });
}
