import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import { VectorLaag } from "./kaart-elementen";
import { TypedRecord } from "./kaart-protocol";

export interface InfoBoodschap {
  readonly id: string;
  readonly titel: string;
  readonly type: string;
  readonly sluitbaar: boolean;
  readonly verbergMsgGen: () => Option<TypedRecord>;
}

export interface InfoBoodschapAlert extends InfoBoodschap {
  readonly type: "InfoBoodschapAlert";
  readonly message: string;
}

export interface InfoBoodschapIdentify extends InfoBoodschap {
  readonly type: "InfoBoodschapIdentify";
  readonly feature: ol.Feature;
  readonly laag: VectorLaag;
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
