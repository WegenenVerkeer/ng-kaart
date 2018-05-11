import * as ol from "openlayers";

import * as prt from "../kaart/kaart-protocol";
import { GeselecteerdeFeatures } from "../kaart/kaart-with-info-model";
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
  | TekenGeomAangepastMsg
  | SubscribedMsg
  | SchaalAangevraagdMsg
  | ToonCopyrightMsg
  | ToonVoorwaardenMsg
  | DummyMsg;

export interface FeatureSelectieAangepastMsg {
  readonly type: "FeatureSelectieAangepast";
  readonly geselecteerdeFeatures: GeselecteerdeFeatures;
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

export interface FeatureGedeselecteerdMsg {
  readonly type: "FeatureGedeselecteerd";
  readonly featureid: string;
}

export interface DummyMsg {
  readonly type: "Dummy";
}

export interface SchaalAangevraagdMsg {
  readonly type: "SchaalAangevraagd";
}

export interface ToonVoorwaardenMsg {
  readonly type: "ToonVoorwaarden";
  readonly titel: string;
  readonly href: string;
}

export interface ToonCopyrightMsg {
  readonly type: "ToonCopyright";
  readonly copyright: string;
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

export function TekenGeomAangepastMsg(geom: ol.geom.Geometry): TekenGeomAangepastMsg {
  return { type: "TekenGeomAangepast", geom: geom };
}

export function SubscribedMsg(subscription: prt.KaartCmdValidation<prt.SubscriptionResult>, reference: any): SubscribedMsg {
  return { type: "Subscribed", reference: reference, subscription: subscription };
}

export function SchaalAangevraagdMsg(): SchaalAangevraagdMsg {
  return { type: "SchaalAangevraagd" };
}

export function ToonVoorwaardenMsg(titel: string, href: string): ToonVoorwaardenMsg {
  return { type: "ToonVoorwaarden", titel: titel, href: href };
}

export function ToonCopyrightMsg(copyright: string): ToonCopyrightMsg {
  return { type: "ToonCopyright", copyright: copyright };
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

export const schaalAangevraagdMsgGen = () => KaartClassicMsg(SchaalAangevraagdMsg());

export const toonVoorwaardenMsgGen = (titel: string, href: string) => KaartClassicMsg(ToonVoorwaardenMsg(titel, href));

export const toonCopyrightMsgGen = (copyright: string) => KaartClassicMsg(ToonCopyrightMsg(copyright));
