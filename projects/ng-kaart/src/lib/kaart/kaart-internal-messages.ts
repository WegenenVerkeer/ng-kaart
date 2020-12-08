import { either, option } from "fp-ts";

import * as ol from "../util/openlayers-compat";

import { Tekenresultaat, TekenSettings } from "./kaart-elementen";
import * as prt from "./kaart-protocol";
import { Laagtabelinstellingen } from "./kaart-protocol";
import { InfoBoodschap } from "./kaart-with-info-model";
import { kaartLogger } from "./log";

// Dit zijn de types die als payload van KaartInternalMsg gebruikt kunnen worden.
export type KaartInternalSubMsg =
  | AchtergrondtitelGezetMsg
  | ActieveModusAangepastMsg
  | GeometryChangedMsg
  | IdentifyInfoBoodschapGeslotenMsg
  | InfoBoodschappenMsg
  | KaartClickMsg
  | MijnLocatieZoomdoelGezetMsg
  | SubscribedMsg
  | LaagtabelinstellingenMsg
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
  modus: option.Option<string>;
}

export interface TekenMsg {
  type: "Teken";
  settings: option.Option<TekenSettings>;
}

export interface SubscribedMsg {
  readonly type: "Subscribed";
  readonly subscription: prt.KaartCmdValidation<prt.SubscriptionResult>;
  readonly reference: any;
}

export interface MijnLocatieZoomdoelGezetMsg {
  readonly type: "MijnLocatieZoomdoelGezet";
  readonly mijnLocatieZoomdoel: option.Option<number>;
}

export interface KaartInternalMsg {
  readonly type: "KaartInternal";
  readonly payload: option.Option<KaartInternalSubMsg>;
}

export interface KaartClickMsg {
  readonly type: "KaartClick";
  readonly clickCoordinaat: ol.Coordinate;
}

export interface InfoBoodschappenMsg {
  readonly type: "InfoBoodschappen";
  readonly infoBoodschappen: Map<string, InfoBoodschap>;
}

export interface LaagtabelinstellingenMsg {
  readonly type: "Laagtabelinstellingen";
  readonly instellingen: Laagtabelinstellingen;
}

export interface VerwijderTekenFeatureMsg {
  readonly type: "VerwijderTekenFeature";
  readonly featureId: string | number;
}

export interface TekenInfoboodschapGeslotenMsg {
  readonly type: "TekenInfoboodschapGesloten";
}

export interface IdentifyInfoBoodschapGeslotenMsg {
  readonly type: "IdentifyInfoBoodschapGesloten";
  readonly feature: ol.Feature;
}

function KaartInternalMsg(
  payload: option.Option<KaartInternalSubMsg>
): KaartInternalMsg {
  return {
    type: "KaartInternal",
    payload: payload,
  };
}

/**
 * Dit is echt "fire and forget". Geen enkele informatie komt terug ook al zou dat kunnen.
 * Enkel de fouten worden gelogd.
 */
export const kaartLogOnlyWrapper: prt.ValidationWrapper<
  any,
  KaartInternalMsg
> = (v: prt.KaartCmdValidation<any>) => {
  if (either.isLeft(v)) {
    kaartLogger.error("Een intern command gaf een fout", v.left);
  }
  return {
    type: "KaartInternal",
    payload: option.none,
  };
};

export const infoBoodschappenMsgGen = (
  infoBoodschappen: Map<string, InfoBoodschap>
) => KaartInternalMsg(option.some(InfoBoodschappenMsg(infoBoodschappen)));

function InfoBoodschappenMsg(
  infoBoodschappen: Map<string, InfoBoodschap>
): InfoBoodschappenMsg {
  return { type: "InfoBoodschappen", infoBoodschappen: infoBoodschappen };
}

export const tabelLaagInstellingenMsgGen = (
  instellingen: Laagtabelinstellingen
): KaartInternalMsg =>
  KaartInternalMsg(option.some(LaagtabelinstellingenMsg(instellingen)));

function LaagtabelinstellingenMsg(
  instellingen: Laagtabelinstellingen
): LaagtabelinstellingenMsg {
  return { type: "Laagtabelinstellingen", instellingen };
}

export const kaartClickWrapper = (clickCoordinaat: ol.Coordinate) =>
  KaartInternalMsg(option.some(KaartClickMsg(clickCoordinaat)));

function KaartClickMsg(clickCoordinaat: ol.Coordinate): KaartClickMsg {
  return { type: "KaartClick", clickCoordinaat: clickCoordinaat };
}

function ViewinstellingenGezetMsg(
  instellingen: prt.Viewinstellingen
): ViewinstellingenGezetMsg {
  return { type: "ViewinstellingenGezet", viewinstellingen: instellingen };
}

export const viewinstellingenGezetWrapper = (
  instellingen: prt.Viewinstellingen
) => KaartInternalMsg(option.some(ViewinstellingenGezetMsg(instellingen)));

function AchtergrondtitelGezetMsg(titel: string): AchtergrondtitelGezetMsg {
  return { type: "AchtergrondtitelGezet", titel: titel };
}

export const achtergrondtitelGezetWrapper = (titel: string) =>
  KaartInternalMsg(option.some(AchtergrondtitelGezetMsg(titel)));

function GeometryChangedMsg(
  geometry: ol.geom.Geometry,
  volgnummer: number,
  featureId: string | number
): GeometryChangedMsg {
  return {
    type: "GeometryChanged",
    geometry: geometry,
    volgnummer: volgnummer,
    featureId: featureId,
  };
}

export const tekenResultaatWrapper = (resultaat: Tekenresultaat) =>
  KaartInternalMsg(
    option.some(
      GeometryChangedMsg(
        resultaat.geometry,
        resultaat.volgnummer,
        resultaat.featureId
      )
    )
  );

function TekenMsg(settings: option.Option<TekenSettings>): TekenMsg {
  return {
    type: "Teken",
    settings: settings,
  };
}

export const tekenWrapper = (settings: option.Option<TekenSettings>) =>
  KaartInternalMsg(option.some(TekenMsg(settings)));

function SubscribedMsg(
  subscription: prt.KaartCmdValidation<prt.SubscriptionResult>,
  reference: any
): SubscribedMsg {
  return {
    type: "Subscribed",
    reference: reference,
    subscription: subscription,
  };
}

export const subscribedWrapper: (
  ref: any
) => (v: prt.KaartCmdValidation<prt.SubscriptionResult>) => KaartInternalMsg = (
  reference: any
) => (v: prt.KaartCmdValidation<prt.SubscriptionResult>) =>
  KaartInternalMsg(option.some(SubscribedMsg(v, reference)));

function MijnLocatieZoomdoelGezetMsg(
  d: option.Option<number>
): MijnLocatieZoomdoelGezetMsg {
  return { type: "MijnLocatieZoomdoelGezet", mijnLocatieZoomdoel: d };
}

export const mijnLocatieZoomdoelGezetWrapper = (d: option.Option<number>) =>
  KaartInternalMsg(option.some(MijnLocatieZoomdoelGezetMsg(d)));

function ActieveModusGezet(
  modus: option.Option<string>
): ActieveModusAangepastMsg {
  return { type: "ActieveModus", modus: modus };
}

export const actieveModusGezetWrapper = (modus: option.Option<string>) =>
  KaartInternalMsg(option.some(ActieveModusGezet(modus)));

export function VerwijderTekenFeatureMsg(
  featureId: string | number
): VerwijderTekenFeatureMsg {
  return {
    type: "VerwijderTekenFeature",
    featureId: featureId,
  };
}

export const verwijderTekenFeatureWrapper = (featureId: string | number) =>
  KaartInternalMsg(option.some(VerwijderTekenFeatureMsg(featureId)));

export function TekenInfoboodschapGeslotenMsg(): TekenInfoboodschapGeslotenMsg {
  return {
    type: "TekenInfoboodschapGesloten",
  };
}

export const tekenInfoboodschapGeslotenMsgWrapper = () =>
  KaartInternalMsg(option.some(TekenInfoboodschapGeslotenMsg()));

const IdentifyInfoBoodschapGeslotenMsg = (
  feature: ol.Feature
): IdentifyInfoBoodschapGeslotenMsg => ({
  type: "IdentifyInfoBoodschapGesloten",
  feature,
});

export const identifyInfoBoodschapGeslotenMsgGen = (feature: ol.Feature) =>
  KaartInternalMsg(option.some(IdentifyInfoBoodschapGeslotenMsg(feature)));
