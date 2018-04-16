import { Option, some, none } from "fp-ts/lib/Option";
import { List } from "immutable";

import * as ol from "openlayers";

import { kaartLogger } from "./log";
import { Zoominstellingen, SubscriptionResult, KaartCmdValidation } from "./kaart-protocol";
import * as prt from "./kaart-protocol";
import { AchtergrondLaag } from "./kaart-elementen";

export type KaartInternalSubMsg =
  | ZoominstellingenGezetMsg
  | AchtergrondtitelGezetMsg
  | AchtergrondlagenGezetMsg
  | GeometryChangedMsg
  | TekenMsg
  | SubscribedMsg;

export interface KaartInternalMsg extends prt.KaartMsg {
  type: "KaartInternal";
  payload: Option<KaartInternalSubMsg>;
}

function KaartInternalMsg(payload: Option<KaartInternalSubMsg>): KaartInternalMsg {
  return {
    type: "KaartInternal",
    payload: payload
  };
}

/**
 * Dit is echt "fire and forget". Geen enkele informatie komt terug ook al zou dat kunnen.
 * Enkel de fouten worden gelogd.
 */
export const kaartLogOnlyWrapper: prt.ValidationWrapper<any, KaartInternalMsg> = (v: prt.KaartCmdValidation<any>) => {
  if (v.isFailure()) {
    kaartLogger.error("Een intern command gaf een fout", v.value);
  }
  return {
    type: "KaartInternal",
    payload: none
  };
};

export interface ZoominstellingenGezetMsg {
  type: "ZoominstellingenGezet";
  zoominstellingen: Zoominstellingen;
}

function ZoominstellingenGezetMsg(instellingen: Zoominstellingen): ZoominstellingenGezetMsg {
  return { type: "ZoominstellingenGezet", zoominstellingen: instellingen };
}

export const zoominstellingenGezetWrapper = (instellingen: Zoominstellingen) =>
  KaartInternalMsg(some(ZoominstellingenGezetMsg(instellingen)));

export interface AchtergrondtitelGezetMsg {
  type: "AchtergrondtitelGezet";
  titel: string;
}

function AchtergrondtitelGezetMsg(titel: string): AchtergrondtitelGezetMsg {
  return { type: "AchtergrondtitelGezet", titel: titel };
}

export const achtergrondtitelGezetWrapper = (titel: string) => KaartInternalMsg(some(AchtergrondtitelGezetMsg(titel)));

export interface AchtergrondlagenGezetMsg {
  type: "AchtergrondlagenGezet";
  achtergrondlagen: List<AchtergrondLaag>;
}

function AchtergrondlagenGezetMsg(achtergrondlagen: List<AchtergrondLaag>): AchtergrondlagenGezetMsg {
  return { type: "AchtergrondlagenGezet", achtergrondlagen: achtergrondlagen };
}

export const achtergrondlagenGezetWrapper = (lagen: List<AchtergrondLaag>) => KaartInternalMsg(some(AchtergrondlagenGezetMsg(lagen)));

export interface GeometryChangedMsg {
  type: "GeometryChanged";
  geometry: ol.geom.Geometry;
}

function GeometryChangedMsg(geometry: ol.geom.Geometry): GeometryChangedMsg {
  return { type: "GeometryChanged", geometry: geometry };
}

export const geometryChangedWrapper = (geometry: ol.geom.Geometry) => KaartInternalMsg(some(GeometryChangedMsg(geometry)));

export interface TekenMsg {
  type: "Teken";
  teken: boolean;
}

function TekenMsg(teken: boolean): TekenMsg {
  return {
    type: "Teken",
    teken: teken
  };
}

export const tekenWrapper = (meten: boolean) => KaartInternalMsg(some(TekenMsg(meten)));

export interface SubscribedMsg {
  type: "Subscribed";
  subscription: KaartCmdValidation<SubscriptionResult>;
  reference: any;
}

function SubscribedMsg(subscription: KaartCmdValidation<SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

export const subscribedWrapper: (ref: any) => (v: KaartCmdValidation<SubscriptionResult>) => KaartInternalMsg = (reference: any) => (
  v: prt.KaartCmdValidation<SubscriptionResult>
) => KaartInternalMsg(some(SubscribedMsg(v, reference)));
