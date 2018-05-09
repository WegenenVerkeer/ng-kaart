import { Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import * as ke from "./kaart-elementen";
import { TypedRecord } from "./kaart-protocol";

export interface InfoBoodschap {
  readonly id: string;
  readonly titel: string;
  readonly inhoud: string;
  readonly verbergMsgGen: () => Option<TypedRecord>;
}

export interface GeselecteerdeFeatures {
  readonly geselecteerd: List<ol.Feature>;
  readonly toegevoegd: Option<ol.Feature>;
  readonly verwijderd: Option<ol.Feature>;
}
