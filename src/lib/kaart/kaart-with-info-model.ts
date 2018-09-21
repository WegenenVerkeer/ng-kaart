import { Function1, Lazy } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";

import { LaagLocationInfo } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { VectorLaag } from "./kaart-elementen";
import { TypedRecord } from "./kaart-protocol";

export type InfoBoodschap = InfoBoodschapAlert | InfoBoodschapIdentify | InfoBoodschapKaartBevragenProgress;

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
  readonly weglocaties: List<WegLocatie>; // Zou ook Progress<List<WegLocatie>> kunnen zijn
  readonly laagLocatieInfoOpTitel: Map<string, Progress<LaagLocationInfo>>;
}

export const foldInfoBoodschap = (boodschap: InfoBoodschap) => <A>(
  ifAlert: Function1<InfoBoodschapAlert, A>,
  ifIdentify: Function1<InfoBoodschapIdentify, A>,
  ifKaartBevragen: Function1<InfoBoodschapKaartBevragenProgress, A>
) => {
  switch (boodschap.type) {
    case "InfoBoodschapAlert":
      return ifAlert(boodschap);
    case "InfoBoodschapIdentify":
      return ifIdentify(boodschap);
    case "InfoBoodschapKaartBevragen":
      return ifKaartBevragen(boodschap);
  }
};

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

export interface Groeplagen {
  readonly laaggroep: ke.Laaggroep;
  readonly lagen: List<ke.ToegevoegdeLaag>;
}

export interface GeselecteerdeFeatures {
  readonly geselecteerd: List<ol.Feature>;
  readonly toegevoegd: Option<ol.Feature>;
  readonly verwijderd: Option<ol.Feature>;
}

export interface HoverFeature {
  readonly geselecteerd: Option<ol.Feature>;
}
