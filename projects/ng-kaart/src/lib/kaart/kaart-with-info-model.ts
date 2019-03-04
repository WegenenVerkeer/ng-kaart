import { Either } from "fp-ts/lib/Either";
import { Function1, Lazy } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { TypedRecord } from "../util/typed-record";

import { Adres, LaagLocationInfo, WegLocatie } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { VectorLaag } from "./kaart-elementen";

export type InfoBoodschap = InfoBoodschapAlert | InfoBoodschapMeten | InfoBoodschapIdentify | InfoBoodschapKaartBevragenProgress;

export interface InfoBoodschapBase {
  readonly id: string;
  readonly titel: string;
  readonly bron: Option<string>;
  readonly sluit: "NIET" | "VANZELF" | "DOOR_APPLICATIE";
  readonly verbergMsgGen: () => Option<TypedRecord>;
}

export interface InfoBoodschapAlert extends InfoBoodschapBase {
  readonly type: "InfoBoodschapAlert";
  readonly message: string;
  readonly iconName: Option<string>;
}

export interface InfoBoodschapMeten extends InfoBoodschapBase {
  readonly type: "InfoBoodschapMeten";
  readonly length: Option<number>;
  readonly area: Option<number>;
}

export interface InfoBoodschapIdentify extends InfoBoodschapBase {
  readonly type: "InfoBoodschapIdentify";
  readonly feature: ol.Feature;
  readonly laag: Option<VectorLaag>;
}

export type Progress<A> = Requested | TimedOut | Received<A>;

export type Requested = "Requested";
export type TimedOut = "TimedOut";
export interface Received<A> {
  readonly value: A;
}

export const withProgress = <A>(progress: Progress<A>) => <B>(ifRequested: Lazy<B>, ifTimedOut: Lazy<B>, ifReceived: Function1<A, B>) => {
  if (progress === "Requested") {
    return ifRequested();
  } else if (progress === "TimedOut") {
    return ifTimedOut();
  } else {
    return ifReceived(progress.value);
  }
};

export const Requested: Requested = "Requested";
export const TimedOut: TimedOut = "TimedOut";
export const Received: <A>(_: A) => Received<A> = a => ({ value: a });

export interface InfoBoodschapKaartBevragenProgress extends InfoBoodschapBase {
  readonly type: "InfoBoodschapKaartBevragen";
  readonly coordinaat: ol.Coordinate;
  readonly adres: Option<Adres>; // Zou ook Progress<Adres> kunnen zijn
  readonly weglocaties: Array<WegLocatie>; // Zou ook Progress<Array<WegLocatie>> kunnen zijn
  readonly laagLocatieInfoOpTitel: Map<string, Progress<LaagLocationInfo>>;
}

export const foldInfoBoodschap = (boodschap: InfoBoodschap) => <A>(
  ifAlert: Function1<InfoBoodschapAlert, A>,
  ifIdentify: Function1<InfoBoodschapIdentify, A>,
  ifKaartBevragen: Function1<InfoBoodschapKaartBevragenProgress, A>,
  ifMeten: Function1<InfoBoodschapMeten, A>
) => {
  switch (boodschap.type) {
    case "InfoBoodschapAlert":
      return ifAlert(boodschap);
    case "InfoBoodschapIdentify":
      return ifIdentify(boodschap);
    case "InfoBoodschapKaartBevragen":
      return ifKaartBevragen(boodschap);
    case "InfoBoodschapMeten":
      return ifMeten(boodschap);
  }
};

export interface Groeplagen {
  readonly laaggroep: ke.Laaggroep;
  readonly lagen: Array<ke.ToegevoegdeLaag>;
}

export interface GeselecteerdeFeatures {
  readonly geselecteerd: Array<ol.Feature>;
  readonly toegevoegd: Option<ol.Feature>;
  readonly verwijderd: Option<ol.Feature>;
}

export interface HoverFeature {
  readonly hover: Either<ol.Feature, ol.Feature>;
}
