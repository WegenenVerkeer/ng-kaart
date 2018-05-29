import { Option } from "fp-ts/lib/Option";
import { List, Map } from "immutable";
import * as ol from "openlayers";

import { ZoekResultaat, ZoekResultaten } from "../zoeker/zoeker-base";

import * as ke from "./kaart-elementen";
import { InfoBoodschap } from "./kaart-with-info-model";

/////////
// Types
//

export type Subscription<Msg> =
  | ViewinstellingenSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | ExtentSubscription<Msg>
  | GeselecteerdeFeaturesSubscription<Msg>
  | AchtergrondTitelSubscription<Msg>
  | LagenInGroepSubscription<Msg>
  | LaagVerwijderdSubscription<Msg>
  | ZoekerSubscription<Msg>
  | ZoekerKlikSubscription<Msg>
  | MijnLocatieZoomdoelSubscription<Msg>
  | GeometryChangedSubscription<Msg>
  | TekenenSubscription<Msg>
  | KaartClickSubscription<Msg>
  | InfoBoodschappenSubscription<Msg>;

export interface Viewinstellingen {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  resolution: number;
  extent: ol.Extent;
  center: ol.Coordinate;
}

export interface GeselecteerdeFeatures {
  geselecteerd: List<ol.Feature>;
  toegevoegd: Option<ol.Feature>;
  verwijderd: Option<ol.Feature>;
}

export interface ViewinstellingenSubscription<Msg> {
  readonly type: "Viewinstellingen";
  readonly wrapper: (instellingen: Viewinstellingen) => Msg;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: (center: ol.Coordinate) => Msg;
}

export interface ExtentSubscription<Msg> {
  readonly type: "Extent";
  readonly wrapper: (extent: ol.Extent) => Msg;
}

export interface GeselecteerdeFeaturesSubscription<Msg> {
  readonly type: "GeselecteerdeFeatures";
  readonly wrapper: (geselecteerdeFeatures: GeselecteerdeFeatures) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: (titel: string) => Msg;
}

export interface LagenInGroepSubscription<Msg> {
  readonly type: "LagenInGroep";
  readonly groep: ke.Laaggroep;
  readonly wrapper: (lagen: List<ke.ToegevoegdeLaag>) => Msg;
}

export interface LaagVerwijderdSubscription<Msg> {
  readonly type: "LaagVerwijderd";
  readonly wrapper: (laag: ke.ToegevoegdeLaag) => Msg;
}

export interface KaartClickSubscription<Msg> {
  readonly type: "KaartClick";
  readonly wrapper: (coordinaat: ol.Coordinate) => Msg;
}

export interface ZoekerSubscription<Msg> {
  readonly type: "Zoeker";
  readonly wrapper: (resultaten: ZoekResultaten) => Msg;
}

export interface ZoekerKlikSubscription<Msg> {
  readonly type: "ZoekerKlik";
  readonly wrapper: (resultaat: ZoekResultaat) => Msg;
}

export interface MijnLocatieZoomdoelSubscription<Msg> {
  readonly type: "MijnLocatieZoomdoel";
  readonly wrapper: (doel: Option<number>) => Msg;
}

export interface GeometryChangedSubscription<Msg> {
  readonly type: "GeometryChanged";
  readonly tekenSettings: ke.TekenSettings;
  readonly wrapper: (evt: ol.geom.Geometry) => Msg;
}

export interface TekenenSubscription<Msg> {
  readonly type: "Tekenen";
  readonly wrapper: (settings: Option<ke.TekenSettings>) => Msg;
}

export interface InfoBoodschappenSubscription<Msg> {
  readonly type: "InfoBoodschap";
  readonly wrapper: (infoBoodschappen: Map<string, InfoBoodschap>) => Msg;
}

///////////////
// Constructors
//

export function ViewinstellingenSubscription<Msg>(wrapper: (settings: Viewinstellingen) => Msg): ViewinstellingenSubscription<Msg> {
  return { type: "Viewinstellingen", wrapper: wrapper };
}

export function GeselecteerdeFeaturesSubscription<Msg>(
  wrapper: (geselecteerdeFeatures: GeselecteerdeFeatures) => Msg
): GeselecteerdeFeaturesSubscription<Msg> {
  return { type: "GeselecteerdeFeatures", wrapper: wrapper };
}

export function MiddelpuntSubscription<Msg>(wrapper: (center: ol.Coordinate) => Msg): MiddelpuntSubscription<Msg> {
  return { type: "Middelpunt", wrapper: wrapper };
}

export function ExtentSubscription<Msg>(wrapper: (extent: ol.Extent) => Msg): ExtentSubscription<Msg> {
  return { type: "Extent", wrapper: wrapper };
}

export function AchtergrondTitelSubscription<Msg>(wrapper: (titel: string) => Msg): AchtergrondTitelSubscription<Msg> {
  return { type: "Achtergrond", wrapper: wrapper };
}

export function LagenInGroepSubscription<Msg>(
  groep: ke.Laaggroep,
  msgGen: (lagen: List<ke.ToegevoegdeLaag>) => Msg
): LagenInGroepSubscription<Msg> {
  return { type: "LagenInGroep", groep: groep, wrapper: msgGen };
}

export function LaagVerwijderdSubscription<Msg>(msgGen: (laag: ke.ToegevoegdeLaag) => Msg): LaagVerwijderdSubscription<Msg> {
  return { type: "LaagVerwijderd", wrapper: msgGen };
}

export function ZoekerSubscription<Msg>(wrapper: (resultaten: ZoekResultaten) => Msg): Subscription<Msg> {
  return { type: "Zoeker", wrapper: wrapper };
}

export function ZoekerKlikSubscription<Msg>(wrapper: (resultaat: ZoekResultaat) => Msg): Subscription<Msg> {
  return { type: "ZoekerKlik", wrapper: wrapper };
}

export function KaartClickSubscription<Msg>(wrapper: (coordinaat: ol.Coordinate) => Msg): Subscription<Msg> {
  return { type: "KaartClick", wrapper: wrapper };
}

export function InfoBoodschappenSubscription<Msg>(wrapper: (boodschappen: Map<string, InfoBoodschap>) => Msg): Subscription<Msg> {
  return { type: "InfoBoodschap", wrapper: wrapper };
}

export function MijnLocatieZoomdoelSubscription<Msg>(wrapper: (doel: Option<number>) => Msg): MijnLocatieZoomdoelSubscription<Msg> {
  return { type: "MijnLocatieZoomdoel", wrapper: wrapper };
}

export function GeometryChangedSubscription<Msg>(
  tekenSettings: ke.TekenSettings,
  wrapper: (geom: ol.geom.Geometry) => Msg
): GeometryChangedSubscription<Msg> {
  return { type: "GeometryChanged", tekenSettings: tekenSettings, wrapper: wrapper };
}

export function TekenenSubscription<Msg>(wrapper: (settings: Option<ke.TekenSettings>) => Msg): TekenenSubscription<Msg> {
  return { type: "Tekenen", wrapper: wrapper };
}
