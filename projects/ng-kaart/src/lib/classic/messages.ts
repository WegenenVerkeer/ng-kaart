import { List } from "immutable";
import * as ol from "openlayers";

import * as ke from "../kaart/kaart-elementen";
import { ToegevoegdeLaag } from "../kaart/kaart-elementen";
import * as prt from "../kaart/kaart-protocol";
import { GeselecteerdeFeatures, HoverFeature } from "../kaart/kaart-with-info-model";
import { PrecacheLaagProgress } from "../kaart/model-changes";

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
  | VoorgrondHoogLagenInGroepAangepastMsg
  | VoorgrondLaagLagenInGroepAangepastMsg
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
  readonly features: List<ol.Feature>;
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

export interface ExtentAangepastMsg {
  readonly type: "ExtentAangepast";
  readonly extent: ol.Extent;
}

export interface VectorLagenAangepastMsg {
  readonly type: "VectorLagenAangepast";
  readonly lagen: List<ke.ToegevoegdeVectorLaag>;
}

export interface AchtergrondLagenInGroepAangepastMsg {
  readonly type: "AchtergrondLagenInGroepAangepast";
  readonly lagen: List<ke.ToegevoegdeLaag>;
}

export interface VoorgrondHoogLagenInGroepAangepastMsg {
  readonly type: "VoorgrondHoogLagenInGroepAangepast";
  readonly lagen: List<ke.ToegevoegdeLaag>;
}

export interface VoorgrondLaagLagenInGroepAangepastMsg {
  readonly type: "VoorgrondLaagLagenInGroepAangepast";
  readonly lagen: List<ke.ToegevoegdeLaag>;
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

export function ZichtbareFeaturesAangepastMsg(features: List<ol.Feature>): ZichtbareFeaturesAangepastMsg {
  return { type: "ZichtbareFeaturesAangepast", features: features };
}

export function TekenGeomAangepastMsg(geom: ol.geom.Geometry): TekenGeomAangepastMsg {
  return { type: "TekenGeomAangepast", geom: geom };
}

export function PrecacheProgressMsg(progress: PrecacheLaagProgress): PrecacheProgressMsg {
  return { type: "PrecacheProgress", progress: progress };
}

export function AchtergrondLagenInGroepAangepastMsg(lagen: List<ToegevoegdeLaag>): AchtergrondLagenInGroepAangepastMsg {
  return { type: "AchtergrondLagenInGroepAangepast", lagen: lagen };
}

export function VoorgrondLaagLagenInGroepAangepastMsg(lagen: List<ToegevoegdeLaag>): VoorgrondLaagLagenInGroepAangepastMsg {
  return { type: "VoorgrondLaagLagenInGroepAangepast", lagen: lagen };
}

export function VoorgrondHoogLagenInGroepAangepastMsg(lagen: List<ToegevoegdeLaag>): VoorgrondHoogLagenInGroepAangepastMsg {
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

export const ExtentAangepastMsg: (_: ol.Extent) => ExtentAangepastMsg = ext => ({ type: "ExtentAangepast", extent: ext });

export const VectorLagenAangepastMsg: (_: List<ke.ToegevoegdeVectorLaag>) => VectorLagenAangepastMsg = lgn => ({
  type: "VectorLagenAangepast",
  lagen: lgn
});

/////////////
// extractors

export const lagen: (_: VectorLagenAangepastMsg) => List<ke.ToegevoegdeVectorLaag> = msg => msg.lagen;
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
