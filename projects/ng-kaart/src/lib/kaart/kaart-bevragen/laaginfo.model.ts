import { Either } from "fp-ts/lib/Either";
import { Function2 } from "fp-ts/lib/function";
import * as ol from "openlayers";
import * as rx from "rxjs";

import { Progress } from "../../util";
import { VeldInfo } from "../kaart-elementen";

export type LaagLocationInfo = TextLaagLocationInfo | VeldinfoLaagLocationInfo;

export interface TextLaagLocationInfo {
  readonly type: "TextLaagLocationInfo";
  readonly text: string;
}

export type Veldwaarde = [string, any];

export interface VeldinfoLaagLocationInfo {
  readonly type: "VeldinfoLaagLocationInfo";
  readonly waarden: Veldwaarde[];
  readonly veldinfos: VeldInfo[];
}

export interface LaagLocationInfoService {
  infoByLocation$(location: ol.Coordinate): rx.Observable<LaagLocationInfo>;
}

export const TextLaagLocationInfo: (_: string) => TextLaagLocationInfo = text => ({ type: "TextLaagLocationInfo", text: text });

export const VeldinfoLaagLocationInfo: Function2<Veldwaarde[], VeldInfo[], VeldinfoLaagLocationInfo> = (waarden, veldinfos) => ({
  type: "VeldinfoLaagLocationInfo",
  waarden: waarden,
  veldinfos: veldinfos
});

export interface WegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly afstand: number;
  readonly wegbeheerder: string;
  readonly projectieafstand: number;
}

export type WegLocaties = WegLocatie[];

export interface Adres {
  readonly straat: string;
  readonly huisnummer: string;
  readonly postcode: string;
  readonly gemeente: string;
}

export type AdresResult = Either<string, Adres>;
export type WegLocatiesResult = Either<string, WegLocaties>;

export interface KaartLocaties {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly maybeAdres: Progress<AdresResult>;
  readonly wegLocaties: Progress<WegLocatiesResult>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfo>>;
}
