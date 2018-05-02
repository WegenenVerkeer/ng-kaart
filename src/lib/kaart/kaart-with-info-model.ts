import * as ke from "./kaart-elementen";
import { List } from "immutable";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import { Laaggroep } from "./kaart-protocol-commands";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

export interface InfoBoodschap {
  readonly id: string;
  readonly titel: string;
  readonly inhoud: string;
  readonly verbergMsg: Option<prt.Command<KaartInternalMsg>>;
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
