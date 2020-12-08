import { either, option } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import * as rx from "rxjs";

import * as ol from "../../util/openlayers-compat";
import { Progress } from "../../util/progress";
import * as progress from "../../util/progress";
import { VeldInfo } from "../kaart-elementen";
import { PerceelDetails } from "../../zoeker/perceel/zoeker-perceel.service";

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

export const TextLaagLocationInfo: (text: string) => TextLaagLocationInfo = (
  text
) => ({ type: "TextLaagLocationInfo", text: text });

export const VeldinfoLaagLocationInfo: (
  waarden: Veldwaarde[],
  veldinfos: VeldInfo[]
) => VeldinfoLaagLocationInfo = (waarden, veldinfos) => ({
  type: "VeldinfoLaagLocationInfo",
  waarden: waarden,
  veldinfos: veldinfos,
});

export interface PerceelInfo {
  readonly gemeente: string;
  readonly afdeling: string;
  readonly sectie: string;
  readonly perceel: string;
  readonly capaKey: string;
}

export interface WegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly afstand: number;
  readonly wegbeheerder: string;
  readonly projectieafstand: number;
  readonly projected: ol.geom.Geometry;
}

export type WegLocaties = WegLocatie[];

export interface Adres {
  readonly straat: string;
  readonly huisnummer: string;
  readonly postcode: string;
  readonly gemeente: string;
}

export type BevragenErrorReason = "Unreachable" | "ServiceError" | "NoData";

export type AdresResult = either.Either<BevragenErrorReason, Adres>;
export type WegLocatiesResult = either.Either<BevragenErrorReason, WegLocaties>;
export type PerceelResult = either.Either<BevragenErrorReason, PerceelInfo>;
export type PerceelDetailsResult = either.Either<
  BevragenErrorReason,
  PerceelDetails
>;

export type LaagLocationInfoResult = either.Either<
  BevragenErrorReason,
  LaagLocationInfo
>;

export interface KaartLocaties {
  readonly timestamp: number;
  readonly coordinaat: ol.Coordinate;
  readonly maybeAdres: Progress<AdresResult>;
  readonly wegLocaties: Progress<WegLocatiesResult>;
  readonly perceel: Progress<PerceelResult>;
  readonly lagenLocatieInfo: Map<string, Progress<LaagLocationInfoResult>>;
}

export const progressFailure: <A>(
  _: Progress<either.Either<BevragenErrorReason, A>>
) => BevragenErrorReason | undefined = (p) =>
  pipe(
    progress.toOption(p),
    option.chain((e) => option.fromEither(either.swap(e))),
    option.toUndefined
  );
