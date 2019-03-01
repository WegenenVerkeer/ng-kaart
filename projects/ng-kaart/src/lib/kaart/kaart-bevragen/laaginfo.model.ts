import { List, Map } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";

import { Progress } from "../../util";

import { AdresResult } from "./kaart-bevragen.service";

export type LaagLocationInfo = TextLaagLocationInfo;

export interface TextLaagLocationInfo {
  readonly type: "TextLaagLocationInfo";
  readonly text: string;
}

export interface LaagLocationInfoService {
  infoByLocation$(location: ol.Coordinate): rx.Observable<LaagLocationInfo>;
}

export const TextLaagLocationInfo: (_: string) => TextLaagLocationInfo = text => ({ type: "TextLaagLocationInfo", text: text });

export interface KaartLocaties {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly maybeAdres: Progress<AdresResult>;
  readonly wegLocaties: List<WegLocatie>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>;
}

export interface WegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly afstand: number;
  readonly wegbeheerder: string;
  readonly projectieafstand: number;
}

export interface Adres {
  readonly straat: string;
  readonly huisnummer: string;
  readonly postcode: string;
  readonly gemeente: string;
}
