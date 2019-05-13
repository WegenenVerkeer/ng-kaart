import { Function1, pipe } from "fp-ts/lib/function";
import * as ol from "openlayers";

import { CachedFeatureLookup } from "../kaart/cache/lookup";
import { KaartLocaties } from "../kaart/kaart-bevragen/laaginfo.model";
import * as ke from "../kaart/kaart-elementen";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import * as prt from "../kaart/kaart-protocol";
import { GeselecteerdeFeatures, HoverFeature } from "../kaart/kaart-with-info-model";
import * as loc from "../kaart/mijn-locatie/kaart-mijn-locatie.component";
import { LaatsteCacheRefresh, PrecacheLaagProgress } from "../kaart/model-changes";

import { classicLogger } from "./log";

export interface KaartClassicMsg {
  readonly type: "KaartClassic";
  readonly payload: KaartClassicSubMsg;
}

///////////////
// Inner types
//

export type KaartClassicSubMsg =
  | FeatureGedeselecteerdMsg
  | FeatureSelectieAangepastMsg
  | FeatureHoverAangepastMsg
  | ZichtbareFeaturesAangepastMsg
  | TekenGeomAangepastMsg
  | SubscribedMsg
  | ZoomAangepastMsg
  | ViewAangepastMsg
  | MiddelpuntAangepastMsg
  | ExtentAangepastMsg
  | VectorLagenAangepastMsg
  | AchtergrondLagenInGroepAangepastMsg
  | PrecacheProgressMsg
  | LaatsteCacheRefreshMsg
  | VoorgrondHoogLagenInGroepAangepastMsg
  | VoorgrondLaagLagenInGroepAangepastMsg
  | PublishedKaartLocatiesMsg
  | CachedFeaturesLookupReadyMsg
  | MijnLocatieStateChangeMsg
  | DummyMsg;

export interface FeatureSelectieAangepastMsg {
  readonly type: "FeatureSelectieAangepast";
  readonly geselecteerdeFeatures: GeselecteerdeFeatures;
}

export interface FeatureHoverAangepastMsg {
  readonly type: "FeatureHoverAangepast";
  readonly feature: HoverFeature;
}

export interface TekenGeomAangepastMsg {
  readonly type: "TekenGeomAangepast";
  readonly geom: ol.geom.Geometry;
}

export interface PrecacheProgressMsg {
  readonly type: "PrecacheProgress";
  readonly progress: PrecacheLaagProgress;
}

export interface LaatsteCacheRefreshMsg {
  readonly type: "LaatsteCacheRefresh";
  readonly laatsteCacheRefresh: LaatsteCacheRefresh;
}

export interface SubscribedMsg {
  type: "Subscribed";
  subscription: prt.KaartCmdValidation<prt.SubscriptionResult>;
  reference: any;
}

export interface FeatureGedeselecteerdMsg {
  readonly type: "FeatureGedeselecteerd";
  readonly featureid: string;
}

export interface ZichtbareFeaturesAangepastMsg {
  readonly type: "ZichtbareFeaturesAangepast";
  readonly features: Array<ol.Feature>;
}

export interface ZoomAangepastMsg {
  readonly type: "ZoomAangepast";
  readonly zoom: number;
}

export interface ViewAangepastMsg {
  readonly type: "ViewAangepast";
  readonly view: prt.Viewinstellingen;
}

export interface MiddelpuntAangepastMsg {
  readonly type: "MiddelpuntAangepast";
  readonly middelpunt: ol.Coordinate;
}

export interface PublishedKaartLocatiesMsg {
  readonly type: "PublishedKaartLocaties";
  readonly locaties: KaartLocaties;
}

export interface ExtentAangepastMsg {
  readonly type: "ExtentAangepast";
  readonly extent: ol.Extent;
}

export interface VectorLagenAangepastMsg {
  readonly type: "VectorLagenAangepast";
  readonly lagen: Array<ke.ToegevoegdeVectorLaag>;
}

export interface AchtergrondLagenInGroepAangepastMsg {
  readonly type: "AchtergrondLagenInGroepAangepast";
  readonly lagen: Array<ke.ToegevoegdeLaag>;
}

export interface VoorgrondHoogLagenInGroepAangepastMsg {
  readonly type: "VoorgrondHoogLagenInGroepAangepast";
  readonly lagen: Array<ke.ToegevoegdeLaag>;
}

export interface VoorgrondLaagLagenInGroepAangepastMsg {
  readonly type: "VoorgrondLaagLagenInGroepAangepast";
  readonly lagen: Array<ke.ToegevoegdeLaag>;
}

export interface CachedFeaturesLookupReadyMsg {
  readonly type: "CachedFeaturesLookupReady";
  readonly cacheLookupValidation: prt.KaartCmdValidation<CachedFeatureLookup>;
}

export interface MijnLocatieStateChangeMsg {
  readonly type: "MijnLocatieStateChangeMsg";
  readonly oudeState: loc.State;
  readonly nieuweState: loc.State;
  readonly event: loc.Event;
}

export interface DummyMsg {
  readonly type: "Dummy";
}

///////////////
// Constructors
//

export function FeatureGedeselecteerdMsg(featureid: string): FeatureGedeselecteerdMsg {
  return { type: "FeatureGedeselecteerd", featureid: featureid };
}

export function KaartClassicMsg(payload: KaartClassicSubMsg): KaartClassicMsg {
  return { type: "KaartClassic", payload: payload };
}

export function FeatureSelectieAangepastMsg(geselecteerdeFeatures: GeselecteerdeFeatures): FeatureSelectieAangepastMsg {
  return { type: "FeatureSelectieAangepast", geselecteerdeFeatures: geselecteerdeFeatures };
}

export function FeatureHoverAangepastMsg(hoverFeature: HoverFeature): FeatureHoverAangepastMsg {
  return { type: "FeatureHoverAangepast", feature: hoverFeature };
}

export function ZichtbareFeaturesAangepastMsg(features: Array<ol.Feature>): ZichtbareFeaturesAangepastMsg {
  return { type: "ZichtbareFeaturesAangepast", features: features };
}

export function TekenGeomAangepastMsg(geom: ol.geom.Geometry): TekenGeomAangepastMsg {
  return { type: "TekenGeomAangepast", geom: geom };
}

export function PrecacheProgressMsg(progress: PrecacheLaagProgress): PrecacheProgressMsg {
  return { type: "PrecacheProgress", progress: progress };
}

export function MijnLocatieStateChangeMsg(oudeState: loc.State, nieuweState: loc.State, event: loc.Event): MijnLocatieStateChangeMsg {
  return { type: "MijnLocatieStateChangeMsg", oudeState: oudeState, nieuweState: nieuweState, event: event };
}

export function LaatsteCacheRefreshMsg(laatsteCacheRefresh: LaatsteCacheRefresh): LaatsteCacheRefreshMsg {
  return { type: "LaatsteCacheRefresh", laatsteCacheRefresh: laatsteCacheRefresh };
}

export function AchtergrondLagenInGroepAangepastMsg(lagen: Array<ToegevoegdeLaag>): AchtergrondLagenInGroepAangepastMsg {
  return { type: "AchtergrondLagenInGroepAangepast", lagen: lagen };
}

export function VoorgrondLaagLagenInGroepAangepastMsg(lagen: Array<ToegevoegdeLaag>): VoorgrondLaagLagenInGroepAangepastMsg {
  return { type: "VoorgrondLaagLagenInGroepAangepast", lagen: lagen };
}

export function VoorgrondHoogLagenInGroepAangepastMsg(lagen: Array<ToegevoegdeLaag>): VoorgrondHoogLagenInGroepAangepastMsg {
  return { type: "VoorgrondHoogLagenInGroepAangepast", lagen: lagen };
}

export function SubscribedMsg(subscription: prt.KaartCmdValidation<prt.SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

export const ZoomAangepastMsg: (_: number) => ZoomAangepastMsg = zoom => ({ type: "ZoomAangepast", zoom: zoom });

export const ViewAangepastMsg: (_: prt.Viewinstellingen) => ViewAangepastMsg = vw => ({ type: "ViewAangepast", view: vw });

export const MiddelpuntAangepastMsg: (_: ol.Coordinate) => MiddelpuntAangepastMsg = middelpunt => ({
  type: "MiddelpuntAangepast",
  middelpunt: middelpunt
});

export const PublishedKaartLocatiesMsg: Function1<KaartLocaties, PublishedKaartLocatiesMsg> = locaties => ({
  type: "PublishedKaartLocaties",
  locaties: locaties
});

export const ExtentAangepastMsg: (_: ol.Extent) => ExtentAangepastMsg = ext => ({ type: "ExtentAangepast", extent: ext });

export const VectorLagenAangepastMsg: (_: Array<ke.ToegevoegdeVectorLaag>) => VectorLagenAangepastMsg = lgn => ({
  type: "VectorLagenAangepast",
  lagen: lgn
});

export const CachedFeaturesLookupReadyMsg: Function1<
  prt.KaartCmdValidation<CachedFeatureLookup>,
  CachedFeaturesLookupReadyMsg
> = cacheLookupValidation => ({
  type: "CachedFeaturesLookupReady",
  cacheLookupValidation: cacheLookupValidation
});

/////////////
// extractors

export const lagen: (_: VectorLagenAangepastMsg) => Array<ke.ToegevoegdeVectorLaag> = msg => msg.lagen;
export const extent: (_: ExtentAangepastMsg) => ol.Extent = msg => msg.extent;
export const view: (_: ViewAangepastMsg) => prt.Viewinstellingen = msg => msg.view;

/////////////////////
// Message generators
//

export const logOnlyWrapper: prt.ValidationWrapper<any, KaartClassicMsg> = (v: prt.KaartCmdValidation<any>) => {
  if (v.isFailure()) {
    classicLogger.error("Een classic command gaf een fout", v.value);
  }
  return KaartClassicMsg({ type: "Dummy" });
};

export const cachedFeaturesLookupReadyMsg: prt.ValidationWrapper<CachedFeatureLookup, KaartClassicMsg> = pipe(
  CachedFeaturesLookupReadyMsg,
  KaartClassicMsg
);
