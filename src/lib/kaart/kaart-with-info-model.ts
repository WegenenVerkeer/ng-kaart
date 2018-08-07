import { Option } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";

import { LaagLocationInfo } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { VectorLaag } from "./kaart-elementen";
import { TypedRecord } from "./kaart-protocol";

export type InfoBoodschap = InfoBoodschapAlert | InfoBoodschapIdentify | InfoBoodschapKaartBevragen;

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
}

export interface InfoBoodschapIdentify extends InfoBoodschapBase {
  readonly type: "InfoBoodschapIdentify";
  readonly feature: ol.Feature;
  readonly laag: Option<VectorLaag>;
}

export interface InfoBoodschapKaartBevragen extends InfoBoodschapBase {
  readonly type: "InfoBoodschapKaartBevragen";
  readonly coordinaat: ol.Coordinate;
  readonly adres: Option<Adres>;
  readonly weglocaties: List<WegLocatie>;
  readonly laagLocatieInfoOpTitel: Map<string, LaagLocationInfo>;
}

export interface WegLocatie {
  readonly ident8: string;
  readonly hm: number;
  readonly afstand: number;
  readonly wegbeheerder: string;
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
