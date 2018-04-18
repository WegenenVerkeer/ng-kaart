import { none, Option, some } from "fp-ts/lib/Option";
import { List } from "immutable";

import * as ol from "openlayers";

import { AchtergrondLaag } from "./kaart-elementen";
import { KaartCmdValidation, SubscriptionResult, Zoominstellingen } from "./kaart-protocol";
import * as prt from "./kaart-protocol";
import { kaartLogger } from "./log";

export type KaartInternalSubMsg =
  | ZoominstellingenGezetMsg
  | AchtergrondtitelGezetMsg
  | AchtergrondlagenGezetMsg
  | GeometryChangedMsg
  | TekenMsg
  | SubscribedMsg
  | MijnLocatieZoomdoelGezetMsg;

export interface ZoominstellingenGezetMsg {
  readonly type: "ZoominstellingenGezet";
  readonly zoominstellingen: Zoominstellingen;
}

export interface AchtergrondtitelGezetMsg {
  readonly type: "AchtergrondtitelGezet";
  readonly titel: string;
}

export interface AchtergrondlagenGezetMsg {
  readonly type: "AchtergrondlagenGezet";
  readonly achtergrondlagen: List<AchtergrondLaag>;
}

export interface GeometryChangedMsg {
  type: "GeometryChanged";
  geometry: ol.geom.Geometry;
}

export interface TekenMsg {
  type: "Teken";
  teken: boolean;
}

export interface SubscribedMsg {
  readonly type: "Subscribed";
  readonly subscription: KaartCmdValidation<SubscriptionResult>;
  readonly reference: any;
}

export interface MijnLocatieZoomdoelGezetMsg {
  readonly type: "MijnLocatieZoomdoelGezet";
  readonly mijnLocatieZoomdoel: Option<number>;
}

export interface KaartInternalMsg {
  readonly type: "KaartInternal";
  readonly payload: Option<KaartInternalSubMsg>;
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

function ZoominstellingenGezetMsg(instellingen: Zoominstellingen): ZoominstellingenGezetMsg {
  return { type: "ZoominstellingenGezet", zoominstellingen: instellingen };
}

export const zoominstellingenGezetWrapper = (instellingen: Zoominstellingen) =>
  KaartInternalMsg(some(ZoominstellingenGezetMsg(instellingen)));

function AchtergrondtitelGezetMsg(titel: string): AchtergrondtitelGezetMsg {
  return { type: "AchtergrondtitelGezet", titel: titel };
}

export const achtergrondtitelGezetWrapper = (titel: string) => KaartInternalMsg(some(AchtergrondtitelGezetMsg(titel)));

function AchtergrondlagenGezetMsg(achtergrondlagen: List<AchtergrondLaag>): AchtergrondlagenGezetMsg {
  return { type: "AchtergrondlagenGezet", achtergrondlagen: achtergrondlagen };
}

export const achtergrondlagenGezetWrapper = (lagen: List<AchtergrondLaag>) => KaartInternalMsg(some(AchtergrondlagenGezetMsg(lagen)));

function GeometryChangedMsg(geometry: ol.geom.Geometry): GeometryChangedMsg {
  return { type: "GeometryChanged", geometry: geometry };
}

export const geometryChangedWrapper = (geometry: ol.geom.Geometry) => KaartInternalMsg(some(GeometryChangedMsg(geometry)));

function TekenMsg(teken: boolean): TekenMsg {
  return {
    type: "Teken",
    teken: teken
  };
}

export const tekenWrapper = (tekenen: boolean) => KaartInternalMsg(some(TekenMsg(tekenen)));

function SubscribedMsg(subscription: KaartCmdValidation<SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

export const subscribedWrapper: (ref: any) => (v: KaartCmdValidation<SubscriptionResult>) => KaartInternalMsg = (reference: any) => (
  v: prt.KaartCmdValidation<SubscriptionResult>
) => KaartInternalMsg(some(SubscribedMsg(v, reference)));

function MijnLocatieZoomdoelGezetMsg(d: Option<number>): MijnLocatieZoomdoelGezetMsg {
  return { type: "MijnLocatieZoomdoelGezet", mijnLocatieZoomdoel: d };
}

export const MijnLocatieZoomdoelGezetWrapper = (d: Option<number>) => KaartInternalMsg(some(MijnLocatieZoomdoelGezetMsg(d)));
