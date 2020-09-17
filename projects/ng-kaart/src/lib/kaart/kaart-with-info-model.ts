import { either, option } from "fp-ts";
import { Function1 } from "fp-ts/lib/function";

import * as ol from "../util/openlayers-compat";
import { Progress } from "../util/progress";
import { TypedRecord } from "../util/typed-record";

import {
  Adres,
  LaagLocationInfoResult,
  PerceelInfo,
  WegLocaties,
} from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { VectorLaag } from "./kaart-elementen";

export type InfoBoodschap =
  | InfoBoodschapAlert
  | InfoBoodschapMeten
  | InfoBoodschapIdentify
  | InfoBoodschapKaartBevragenProgress;

export interface InfoBoodschapBase {
  readonly id: string;
  readonly titel: string;
  readonly bron: option.Option<string>;
  readonly sluit: "NIET" | "VANZELF" | "DOOR_APPLICATIE";
  readonly verbergMsgGen: () => option.Option<TypedRecord>;
}

export interface InfoBoodschapAlert extends InfoBoodschapBase {
  readonly type: "InfoBoodschapAlert";
  readonly message: string;
  readonly iconName: option.Option<string>;
}

export interface InfoBoodschapMeten extends InfoBoodschapBase {
  readonly type: "InfoBoodschapMeten";
  readonly length: option.Option<number>;
  readonly area: option.Option<number>;
  readonly coordinates: option.Option<number[]>;
}

export interface InfoBoodschapIdentify extends InfoBoodschapBase {
  readonly type: "InfoBoodschapIdentify";
  readonly feature: ol.Feature;
  readonly laag: option.Option<VectorLaag>;
}

export interface InfoBoodschapKaartBevragenProgress extends InfoBoodschapBase {
  readonly type: "InfoBoodschapKaartBevragen";
  readonly coordinaat: ol.Coordinate;
  readonly adres: option.Option<Adres>; // Zou ook Progress<Adres> kunnen zijn
  readonly weglocaties: WegLocaties; // Zou ook Progress<<WegLocaties> kunnen zijn
  readonly perceel: option.Option<PerceelInfo>;
  readonly laagLocatieInfoOpTitel: Map<
    string,
    Progress<LaagLocationInfoResult>
  >;
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
  readonly lagen: ke.ToegevoegdeLaag[];
}

export interface HoverFeature {
  readonly hover: either.Either<ol.Feature, ol.Feature>;
}
