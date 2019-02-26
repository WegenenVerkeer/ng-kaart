import { none, Option, some } from "fp-ts/lib/Option";
import { Map } from "immutable";
import * as ol from "openlayers";

import { TekenResultaat, TekenSettings } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { InfoBoodschap } from "./kaart-with-info-model";
import { kaartLogger } from "./log";

// Dit zijn de types die als payload van KaartInternalMsg gebruikt kunnen worden.
export type KaartInternalSubMsg =
  | AchtergrondtitelGezetMsg
  | ActieveModusAangepastMsg
  | GeometryChangedMsg
  | InfoBoodschappenMsg
  | KaartClickMsg
  | MijnLocatieZoomdoelGezetMsg
  | SubscribedMsg
  | TekenInfoboodschapGeslotenMsg
  | TekenMsg
  | VerwijderTekenFeatureMsg
  | ViewinstellingenGezetMsg;

export interface ViewinstellingenGezetMsg {
  readonly type: "ViewinstellingenGezet";
  readonly viewinstellingen: prt.Viewinstellingen;
}

export interface AchtergrondtitelGezetMsg {
  readonly type: "AchtergrondtitelGezet";
  readonly titel: string;
}

export interface GeometryChangedMsg {
  type: "GeometryChanged";
  geometry: ol.geom.Geometry;
  volgnummer: number;
  featureId: string | number;
}

export interface ActieveModusAangepastMsg {
  type: "ActieveModus";
  modus: Option<string>;
}

export interface TekenMsg {
  type: "Teken";
  settings: Option<TekenSettings>;
}

export interface SubscribedMsg {
  readonly type: "Subscribed";
  readonly subscription: prt.KaartCmdValidation<prt.SubscriptionResult>;
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

export interface KaartClickMsg {
  readonly type: "KaartClick";
  readonly clickCoordinaat: ol.Coordinate;
}

export interface InfoBoodschappenMsg {
  readonly type: "InfoBoodschappen";
  readonly infoBoodschappen: Map<string, InfoBoodschap>;
}

export interface VerwijderTekenFeatureMsg {
  readonly type: "VerwijderTekenFeature";
  readonly featureId: string | number;
}

export interface TekenInfoboodschapGeslotenMsg {
  readonly type: "TekenInfoboodschapGesloten";
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

export const infoBoodschappenMsgGen = (infoBoodschappen: Map<string, InfoBoodschap>) =>
  KaartInternalMsg(some(InfoBoodschappenMsg(infoBoodschappen)));

function InfoBoodschappenMsg(infoBoodschappen: Map<string, InfoBoodschap>): InfoBoodschappenMsg {
  return { type: "InfoBoodschappen", infoBoodschappen: infoBoodschappen };
}

export const kaartClickWrapper = (clickCoordinaat: ol.Coordinate) => KaartInternalMsg(some(KaartClickMsg(clickCoordinaat)));

function KaartClickMsg(clickCoordinaat: ol.Coordinate): KaartClickMsg {
  return { type: "KaartClick", clickCoordinaat: clickCoordinaat };
}

function ViewinstellingenGezetMsg(instellingen: prt.Viewinstellingen): ViewinstellingenGezetMsg {
  return { type: "ViewinstellingenGezet", viewinstellingen: instellingen };
}

export const viewinstellingenGezetWrapper = (instellingen: prt.Viewinstellingen) =>
  KaartInternalMsg(some(ViewinstellingenGezetMsg(instellingen)));

function AchtergrondtitelGezetMsg(titel: string): AchtergrondtitelGezetMsg {
  return { type: "AchtergrondtitelGezet", titel: titel };
}

export const achtergrondtitelGezetWrapper = (titel: string) => KaartInternalMsg(some(AchtergrondtitelGezetMsg(titel)));

function GeometryChangedMsg(geometry: ol.geom.Geometry, volgnummer: number, featureId: string | number): GeometryChangedMsg {
  return { type: "GeometryChanged", geometry: geometry, volgnummer: volgnummer, featureId: featureId };
}

export const tekenResultaatWrapper = (resultaat: TekenResultaat) =>
  KaartInternalMsg(some(GeometryChangedMsg(resultaat.geometry, resultaat.volgnummer, resultaat.featureId)));

function TekenMsg(settings: Option<TekenSettings>): TekenMsg {
  return {
    type: "Teken",
    settings: settings
  };
}

export const tekenWrapper = (settings: Option<TekenSettings>) => KaartInternalMsg(some(TekenMsg(settings)));

function SubscribedMsg(subscription: prt.KaartCmdValidation<prt.SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

export const subscribedWrapper: (ref: any) => (v: prt.KaartCmdValidation<prt.SubscriptionResult>) => KaartInternalMsg = (
  reference: any
) => (v: prt.KaartCmdValidation<prt.SubscriptionResult>) => KaartInternalMsg(some(SubscribedMsg(v, reference)));

function MijnLocatieZoomdoelGezetMsg(d: Option<number>): MijnLocatieZoomdoelGezetMsg {
  return { type: "MijnLocatieZoomdoelGezet", mijnLocatieZoomdoel: d };
}

export const mijnLocatieZoomdoelGezetWrapper = (d: Option<number>) => KaartInternalMsg(some(MijnLocatieZoomdoelGezetMsg(d)));

function ActieveModusGezet(modus: Option<string>): ActieveModusAangepastMsg {
  return { type: "ActieveModus", modus: modus };
}

export const actieveModusGezetWrapper = (modus: Option<string>) => KaartInternalMsg(some(ActieveModusGezet(modus)));

export function VerwijderTekenFeatureMsg(featureId: string | number): VerwijderTekenFeatureMsg {
  return {
    type: "VerwijderTekenFeature",
    featureId: featureId
  };
}

export const verwijderTekenFeatureWrapper = (featureId: string | number) => KaartInternalMsg(some(VerwijderTekenFeatureMsg(featureId)));

export function TekenInfoboodschapGeslotenMsg(): TekenInfoboodschapGeslotenMsg {
  return {
    type: "TekenInfoboodschapGesloten"
  };
}

export const tekenInfoboodschapGeslotenMsgWrapper = () => KaartInternalMsg(some(TekenInfoboodschapGeslotenMsg()));
