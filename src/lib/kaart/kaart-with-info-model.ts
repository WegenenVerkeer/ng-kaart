import * as ke from "./kaart-elementen";
import { List } from "immutable";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Laaggroep } from "./kaart-protocol-commands";
import { TypedRecord } from "./kaart-protocol";

export interface InfoBoodschap {
  readonly id: string;
  readonly titel: string;
  readonly type: string;
  readonly verbergMsgGen: () => Option<TypedRecord>;
}

export interface InfoBoodschapSimple extends InfoBoodschap {
  readonly type: "InfoBoodschapSimple";
  readonly inhoud: string;
}

export interface InfoBoodschapIdentify extends InfoBoodschap {
  readonly type: "InfoBoodschapIdentify";
  readonly feature: ol.Feature;
}

export interface Groeplagen {
  readonly laaggroep: Laaggroep;
  readonly lagen: List<ke.Laag>;
}

export interface GeselecteerdeFeatures {
  readonly geselecteerd: List<ol.Feature>;
  readonly toegevoegd: Option<ol.Feature>;
  readonly verwijderd: Option<ol.Feature>;
}
