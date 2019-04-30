import { Either } from "fp-ts/lib/Either";
import { Function1 } from "fp-ts/lib/function";
import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";

import { ZoekAntwoord, ZoekerMetWeergaveopties, ZoekResultaat } from "../zoeker/zoeker";

import { KaartLocaties } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { Tekenresultaat } from "./kaart-elementen";
import { InfoBoodschap } from "./kaart-with-info-model";
import { LaatsteCacheRefresh, PrecacheLaagProgress } from "./model-changes";

/////////
// Types
//

export type Subscription<Msg> =
  | AchtergrondTitelSubscription<Msg>
  | ActieveModusSubscription<Msg>
  | ComponentFoutSubscription<Msg>
  | ExtentSubscription<Msg>
  | GeometryChangedSubscription<Msg>
  | GeselecteerdeFeaturesSubscription<Msg>
  | HoverFeaturesSubscription<Msg>
  | InfoBoodschappenSubscription<Msg>
  | KaartClickSubscription<Msg>
  | LaagfilterGezetSubscription<Msg>
  | LaagstijlGezetSubscription<Msg>
  | LaagVerwijderdSubscription<Msg>
  | LaatsteCacheRefreshSubscription<Msg>
  | LagenInGroepSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | PrecacheProgressSubscription<Msg>
  | PublishedKaartLocatiesSubscription<Msg>
  | TekenenSubscription<Msg>
  | ViewinstellingenSubscription<Msg>
  | ZichtbareFeaturesSubscription<Msg>
  | ZoekersSubscription<Msg>
  | ZoekResultaatSelectieSubscription<Msg>
  | ZoekResultatenSubscription<Msg>
  | ZoomSubscription<Msg>;

export interface Viewinstellingen {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  resolution: number;
  extent: ol.Extent;
  center: ol.Coordinate;
  rotation: number;
}

export interface GeselecteerdeFeatures {
  geselecteerd: Array<ol.Feature>;
  toegevoegd: Option<ol.Feature>;
  verwijderd: Option<ol.Feature>;
}

export interface HoverFeature {
  hover: Either<ol.Feature, ol.Feature>; // left = unhover, right = hover
}

export type MsgGen<Input, Msg> = Function1<Input, Msg>;

export interface ViewinstellingenSubscription<Msg> {
  readonly type: "Viewinstellingen";
  readonly wrapper: MsgGen<Viewinstellingen, Msg>;
}

export interface ZoomSubscription<Msg> {
  readonly type: "Zoom";
  readonly wrapper: MsgGen<number, Msg>;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: MsgGen<ol.Coordinate, Msg>;
}

export interface ExtentSubscription<Msg> {
  readonly type: "Extent";
  readonly wrapper: MsgGen<ol.Extent, Msg>;
}

export interface GeselecteerdeFeaturesSubscription<Msg> {
  readonly type: "GeselecteerdeFeatures";
  readonly wrapper: MsgGen<GeselecteerdeFeatures, Msg>;
}

export interface HoverFeaturesSubscription<Msg> {
  readonly type: "HoverFeatures";
  readonly wrapper: MsgGen<HoverFeature, Msg>;
}

export interface ZichtbareFeaturesSubscription<Msg> {
  readonly type: "ZichtbareFeatures";
  readonly wrapper: (zicthbareFeatures: Array<ol.Feature>) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: MsgGen<string, Msg>;
}

export interface LagenInGroepSubscription<Msg> {
  readonly type: "LagenInGroep";
  readonly groep: ke.Laaggroep;
  readonly wrapper: (lagen: Array<ke.ToegevoegdeLaag>) => Msg;
}

export interface LaagVerwijderdSubscription<Msg> {
  readonly type: "LaagVerwijderd";
  readonly wrapper: (laag: ke.ToegevoegdeLaag) => Msg;
}

export interface KaartClickSubscription<Msg> {
  readonly type: "KaartClick";
  readonly wrapper: (coordinaat: ol.Coordinate) => Msg;
}

export interface ZoekResultatenSubscription<Msg> {
  readonly type: "ZoekAntwoord";
  readonly wrapper: MsgGen<ZoekAntwoord, Msg>;
}

export interface ZoekersSubscription<Msg> {
  readonly type: "Zoekers";
  readonly wrapper: MsgGen<ZoekerMetWeergaveopties[], Msg>;
}

export interface ZoekResultaatSelectieSubscription<Msg> {
  readonly type: "ZoekResultaatSelectie";
  readonly wrapper: MsgGen<ZoekResultaat, Msg>;
}

export interface ActieveModusSubscription<Msg> {
  readonly type: "ActieveModus";
  readonly wrapper: (modus: Option<string>) => Msg;
}

export interface GeometryChangedSubscription<Msg> {
  readonly type: "GeometryChanged";
  readonly tekenSettings: ke.TekenSettings;
  readonly wrapper: MsgGen<Tekenresultaat, Msg>;
}

export interface TekenenSubscription<Msg> {
  readonly type: "Tekenen";
  readonly wrapper: (settings: Option<ke.TekenSettings>) => Msg;
}

export interface InfoBoodschappenSubscription<Msg> {
  readonly type: "InfoBoodschap";
  readonly wrapper: (infoBoodschappen: Map<string, InfoBoodschap>) => Msg;
}

export interface ComponentFoutSubscription<Msg> {
  readonly type: "ComponentFout";
  readonly wrapper: MsgGen<string[], Msg>;
}

export interface LaagfilterGezetSubscription<Msg> {
  readonly type: "LaagfilterGezet";
  readonly wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>;
}
export interface LaagstijlGezetSubscription<Msg> {
  readonly type: "LaagstijlGezet";
  readonly wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>;
}

export interface PublishedKaartLocatiesSubscription<Msg> {
  readonly type: "PublishedKaartLocaties";
  readonly wrapper: MsgGen<KaartLocaties, Msg>;
}

export interface PrecacheProgressSubscription<Msg> {
  readonly type: "PrecacheProgress";
  readonly wrapper: (progress: PrecacheLaagProgress) => Msg;
}

export interface LaatsteCacheRefreshSubscription<Msg> {
  readonly type: "LaatsteCacheRefresh";
  readonly wrapper: (progress: LaatsteCacheRefresh) => Msg;
}

///////////////
// Constructors
//

export function ViewinstellingenSubscription<Msg>(wrapper: MsgGen<Viewinstellingen, Msg>): ViewinstellingenSubscription<Msg> {
  return { type: "Viewinstellingen", wrapper: wrapper };
}

export function GeselecteerdeFeaturesSubscription<Msg>(
  wrapper: MsgGen<GeselecteerdeFeatures, Msg>
): GeselecteerdeFeaturesSubscription<Msg> {
  return { type: "GeselecteerdeFeatures", wrapper: wrapper };
}

export function HoverFeaturesSubscription<Msg>(wrapper: MsgGen<HoverFeature, Msg>): HoverFeaturesSubscription<Msg> {
  return { type: "HoverFeatures", wrapper: wrapper };
}

export function ZichtbareFeaturesSubscription<Msg>(
  msgGen: (zichtbareFeatures: Array<ol.Feature>) => Msg
): ZichtbareFeaturesSubscription<Msg> {
  return { type: "ZichtbareFeatures", wrapper: msgGen };
}

export function ZoomSubscription<Msg>(wrapper: MsgGen<number, Msg>): ZoomSubscription<Msg> {
  return { type: "Zoom", wrapper: wrapper };
}

export function MiddelpuntSubscription<Msg>(wrapper: (center: ol.Coordinate) => Msg): MiddelpuntSubscription<Msg> {
  return { type: "Middelpunt", wrapper: wrapper };
}

export function ExtentSubscription<Msg>(wrapper: (extent: ol.Extent) => Msg): ExtentSubscription<Msg> {
  return { type: "Extent", wrapper: wrapper };
}

export function PublishedKaartLocatiesSubscription<Msg>(
  wrapper: (locaties: KaartLocaties) => Msg
): PublishedKaartLocatiesSubscription<Msg> {
  return { type: "PublishedKaartLocaties", wrapper: wrapper };
}

export function AchtergrondTitelSubscription<Msg>(wrapper: MsgGen<string, Msg>): AchtergrondTitelSubscription<Msg> {
  return { type: "Achtergrond", wrapper: wrapper };
}

export function LagenInGroepSubscription<Msg>(
  groep: ke.Laaggroep,
  msgGen: (lagen: Array<ke.ToegevoegdeLaag>) => Msg
): LagenInGroepSubscription<Msg> {
  return { type: "LagenInGroep", groep: groep, wrapper: msgGen };
}

export function LaagVerwijderdSubscription<Msg>(msgGen: (laag: ke.ToegevoegdeLaag) => Msg): LaagVerwijderdSubscription<Msg> {
  return { type: "LaagVerwijderd", wrapper: msgGen };
}

export function ZoekResultatenSubscription<Msg>(wrapper: MsgGen<ZoekAntwoord, Msg>): ZoekResultatenSubscription<Msg> {
  return { type: "ZoekAntwoord", wrapper: wrapper };
}

export function ZoekersSubscription<Msg>(wrapper: MsgGen<ZoekerMetWeergaveopties[], Msg>): ZoekersSubscription<Msg> {
  return { type: "Zoekers", wrapper: wrapper };
}

export function ZoekResultaatSelectieSubscription<Msg>(wrapper: MsgGen<ZoekResultaat, Msg>): ZoekResultaatSelectieSubscription<Msg> {
  return { type: "ZoekResultaatSelectie", wrapper: wrapper };
}

export function KaartClickSubscription<Msg>(wrapper: (coordinaat: ol.Coordinate) => Msg): Subscription<Msg> {
  return { type: "KaartClick", wrapper: wrapper };
}

export function InfoBoodschappenSubscription<Msg>(wrapper: (boodschappen: Map<string, InfoBoodschap>) => Msg): Subscription<Msg> {
  return { type: "InfoBoodschap", wrapper: wrapper };
}

export function GeometryChangedSubscription<Msg>(
  tekenSettings: ke.TekenSettings,
  wrapper: MsgGen<Tekenresultaat, Msg>
): GeometryChangedSubscription<Msg> {
  return { type: "GeometryChanged", tekenSettings: tekenSettings, wrapper: wrapper };
}

export function TekenenSubscription<Msg>(wrapper: (settings: Option<ke.TekenSettings>) => Msg): TekenenSubscription<Msg> {
  return { type: "Tekenen", wrapper: wrapper };
}

export function ActieveModusSubscription<Msg>(wrapper: (modus: Option<string>) => Msg): ActieveModusSubscription<Msg> {
  return { type: "ActieveModus", wrapper: wrapper };
}

export function ComponentFoutSubscription<Msg>(wrapper: (fouten: Array<string>) => Msg): ComponentFoutSubscription<Msg> {
  return {
    type: "ComponentFout",
    wrapper: wrapper
  };
}

export function LaagfilterGezetSubscription<Msg>(wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>): LaagfilterGezetSubscription<Msg> {
  return { type: "LaagfilterGezet", wrapper: wrapper };
}

export function LaagstijlGezetSubscription<Msg>(wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>): LaagstijlGezetSubscription<Msg> {
  return { type: "LaagstijlGezet", wrapper: wrapper };
}

export function PrecacheProgressSubscription<Msg>(wrapper: (progress: PrecacheLaagProgress) => Msg): PrecacheProgressSubscription<Msg> {
  return { type: "PrecacheProgress", wrapper };
}

export function LaatsteCacheRefreshSubscription<Msg>(
  wrapper: (progress: LaatsteCacheRefresh) => Msg
): LaatsteCacheRefreshSubscription<Msg> {
  return { type: "LaatsteCacheRefresh", wrapper };
}
