import { List } from "immutable";
import * as ol from "openlayers";

import * as prt from "../kaart/kaart-protocol";
import { classicLogger } from "./log";

export interface KaartClassicMsg {
  readonly type: "KaartClassic";
  readonly payload: KaartClassicSubMsg;
}

///////////////
// Inner types
//

export type KaartClassicSubMsg = FeatureSelectieAangepastMsg | TekenGeomAangepastMsg | SubscribedMsg | DummyMsg;

export interface FeatureSelectieAangepastMsg {
  readonly type: "FeatureSelectieAangepast";
  readonly geselecteerdeFeatures: List<ol.Feature>;
}

export interface TekenGeomAangepastMsg {
  readonly type: "TekenGeomAangepast";
  readonly geom: ol.geom.Geometry;
}

export interface SubscribedMsg {
  type: "Subscribed";
  subscription: prt.KaartCmdValidation<prt.SubscriptionResult>;
  reference: any;
}

export interface DummyMsg {
  readonly type: "Dummy";
}

///////////////
// Constructors
//

export function KaartClassicMsg(payload: KaartClassicSubMsg): KaartClassicMsg {
  return { type: "KaartClassic", payload: payload };
}

export function FeatureSelectieAangepastMsg(geselecteerdeFeatures: List<ol.Feature>): FeatureSelectieAangepastMsg {
  return { type: "FeatureSelectieAangepast", geselecteerdeFeatures: geselecteerdeFeatures };
}

export function TekenGeomAangepastMsg(geom: ol.geom.Geometry): TekenGeomAangepastMsg {
  return { type: "TekenGeomAangepast", geom: geom };
}

export function SubscribedMsg(subscription: prt.KaartCmdValidation<prt.SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

/////////////////////
// Message generators
//

export const logOnlyWrapper: prt.ValidationWrapper<any, KaartClassicMsg> = (v: prt.KaartCmdValidation<any>) => {
  if (v.isFailure()) {
    classicLogger.error("Een classic command gaf een fout", v.value);
  }
  return KaartClassicMsg({ type: "Dummy" });
};
