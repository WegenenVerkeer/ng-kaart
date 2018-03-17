import { List } from "immutable";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { Subscription, SubscriptionType } from ".";
import { StyleSelector } from "./kaart-elementen";
import { Option } from "fp-ts/lib/Option";

export enum KaartMessageTypes {
  // Commands
  VOEG_LAAG_TOE,
  VERWIJDER_LAAG,
  VERPLAATS_LAAG,
  VOEG_SCHAAL_TOE,
  VERWIJDER_SCHAAL,
  VOEG_VOLLEDIGSCHERM_TOE,
  VERWIJDER_VOLLEDIGSCHERM,
  VOEG_STANDAARDINTERACTIES_TOE,
  VERWIJDER_STANDAARDINTERACTIES,
  VERANDER_MIDDELPUNT,
  VERANDER_ZOOMNIVEAU,
  VERANDER_EXTENT,
  VERANDER_VIEWPORT,
  FOCUS_OP_KAART,
  VERLIES_FOCUS_OP_KAART,
  VERVANG_FEATURES,
  TOON_ACHTERGROND_KEUZE,
  VERBERG_ACHTERGROND_KEUZE,
  KIES_ACHTERGROND,
  MAAK_LAAG_ZICHTBAAR,
  MAAK_LAAG_ONZICHTBAAR,
  ZET_STIJL_VOOR_LAAG,

  // Events
  ZOOMNIVEAU_VERANDERD,
  ZOOMMINMAX_VERANDERD
}

export interface KaartMessage {
  readonly type: KaartMessageTypes;
}

export class VoegLaagToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_LAAG_TOE;

  constructor(readonly positie: number, readonly laag: ke.Laag, readonly magGetoondWorden: boolean) {}
}

export class VerwijderLaag implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_LAAG;

  constructor(readonly titel: string) {}
}

export class VerplaatsLaag implements KaartMessage {
  readonly type = KaartMessageTypes.VERPLAATS_LAAG;

  constructor(readonly titel: string, readonly doelPositie: number) {}
}

export class VoegSchaalToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_SCHAAL_TOE;

  constructor() {}
}

export class VerwijderSchaal implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_SCHAAL;

  constructor() {}
}

export class VoegVolledigschermToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_VOLLEDIGSCHERM_TOE;

  constructor() {}
}

export class VerwijderVolledigscherm implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_VOLLEDIGSCHERM;

  constructor() {}
}

export class VoegStandaardinteractiesToe implements KaartMessage {
  readonly type = KaartMessageTypes.VOEG_STANDAARDINTERACTIES_TOE;

  constructor(readonly scrollZoomOnFocus = false) {}
}

export class VerwijderStandaardinteracties implements KaartMessage {
  readonly type = KaartMessageTypes.VERWIJDER_STANDAARDINTERACTIES;

  constructor() {}
}

export class VeranderMiddelpunt implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_MIDDELPUNT;

  constructor(readonly coordinate: ol.Coordinate) {}
}

export class VeranderZoomniveau implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_ZOOMNIVEAU;

  constructor(readonly zoom: number) {}
}

export class ZoomniveauVeranderd implements KaartMessage {
  readonly type = KaartMessageTypes.ZOOMNIVEAU_VERANDERD;

  constructor(readonly zoom: number) {}
}

export class ZoomminmaxVeranderd implements KaartMessage {
  readonly type = KaartMessageTypes.ZOOMMINMAX_VERANDERD;

  constructor(readonly minZoom: number, readonly maxZoom: number) {}
}

export class VeranderExtent implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_EXTENT;

  constructor(readonly extent: ol.Extent) {}
}

export class VeranderViewport implements KaartMessage {
  readonly type = KaartMessageTypes.VERANDER_VIEWPORT;

  constructor(readonly size: ol.Size) {}
}

export class FocusOpKaart implements KaartMessage {
  readonly type = KaartMessageTypes.FOCUS_OP_KAART;

  constructor() {}
}

export class VerliesFocusOpKaart implements KaartMessage {
  readonly type = KaartMessageTypes.VERLIES_FOCUS_OP_KAART;

  constructor() {}
}

export class VervangFeatures implements KaartMessage {
  readonly type = KaartMessageTypes.VERVANG_FEATURES;

  constructor(readonly titel: string, readonly features: List<ol.Feature>) {}
}

export class ToonAchtergrondKeuze implements KaartMessage {
  readonly type = KaartMessageTypes.TOON_ACHTERGROND_KEUZE;

  constructor(readonly backgrounds: List<ke.WmsLaag | ke.BlancoLaag>, readonly geselecteerdeLaag: Option<ke.WmsLaag | ke.BlancoLaag>) {}
}

export const VerbergAchtergrondKeuze = {
  type: KaartMessageTypes.VERBERG_ACHTERGROND_KEUZE
};

export class KiesAchtergrond implements KaartMessage {
  readonly type = KaartMessageTypes.KIES_ACHTERGROND;

  constructor(readonly titel: string) {}
}

export class MaakLaagZichtbaar implements KaartMessage {
  readonly type = KaartMessageTypes.MAAK_LAAG_ZICHTBAAR;

  constructor(readonly titel: string) {}
}

export class MaakLaagOnzichtbaar implements KaartMessage {
  readonly type = KaartMessageTypes.MAAK_LAAG_ONZICHTBAAR;

  constructor(readonly titel: string) {}
}

export class ZetStijlVoorLaag implements KaartMessage {
  readonly type = KaartMessageTypes.ZET_STIJL_VOOR_LAAG;

  constructor(readonly titel: string, readonly stijl: StyleSelector) {}
}

export type Command<Msg> =
  | SubscriptionCmd<Msg>
  | UnsubscriptionCmd<Msg>
  | VoegLaagToeCmd<Msg>
  | VerwijderLaagCmd<Msg>
  | VerplaatsLaagCmd<Msg>
  | VoegSchaalToeCmd<Msg>
  | VerwijderSchaalCmd<Msg>
  | VoegVolledigSchermToeCmd<Msg>
  | VerwijderVolledigSchermCmd<Msg>
  | VoegStandaardInteractiesToeCmd<Msg>
  | VerwijderStandaardInteractiesCmd<Msg>
  | VeranderMiddelpuntCmd<Msg>
  | VeranderZoomCmd<Msg>
  | VeranderExtentCmd<Msg>
  | VeranderViewportCmd<Msg>
  | ZetFocusOpKaartCmd<Msg>
  | VerliesFocusOpKaartCmd<Msg>
  | VervangFeaturesCmd<Msg>
  | ToonAchtergrondKeuzeCmd<Msg>
  | VerbergAchtergrondKeuzeCmd<Msg>
  | KiesAchtergrondCmd<Msg>
  | MaakLaagZichtbaarCmd<Msg>
  | MaakLaagOnzichtbaarCmd<Msg>
  | ZetStijlVoorLaagCmd<Msg>;

export interface SubscriptionCmd<Msg> {
  readonly type: "Subscription";
  readonly subscription: Subscription<Msg>;
  readonly wrapper: () => Msg; // Msg zal hoogstwschl een union type zijn
}

export interface UnsubscriptionCmd<Msg> {
  readonly type: "Unsubscription";
  readonly subscriptionType: SubscriptionType;
  readonly wrapper: () => Msg;
}

export interface VoegLaagToeCmd<Msg> {
  readonly type: "VoegLaagToe";
  readonly positie: number;
  readonly laag: ke.Laag;
  readonly magGetoondWorden: boolean;
  readonly wrapper: (positie: number) => Msg;
}

export interface VerwijderLaagCmd<Msg> {
  readonly type: "VerwijderLaag";
  readonly titel: string;
  readonly wrapper: () => Msg;
}

export interface VoegSchaalToeCmd<Msg> {
  readonly type: "VoegSchaalToe";
  readonly wrapper: () => Msg;
}

export interface VerplaatsLaagCmd<Msg> {
  readonly type: "VerplaatsLaag";
  readonly titel: string;
  readonly naarPositie: number;
  readonly wrapper: (positie: number) => Msg;
}

export interface VerwijderSchaalCmd<Msg> {
  readonly type: "VerwijderSchaal";
  readonly wrapper: () => Msg;
}

export interface VoegVolledigSchermToeCmd<Msg> {
  readonly type: "VoegVolledigSchermToe";
  readonly wrapper: () => Msg;
}

export interface VerwijderVolledigSchermCmd<Msg> {
  readonly type: "VerwijderVolledigScherm";
  readonly wrapper: () => Msg;
}

export interface VoegStandaardInteractiesToeCmd<Msg> {
  readonly type: "VoegStandaardInteractiesToe";
  readonly scrollZoomOnFocus: boolean;
  readonly wrapper: () => Msg;
}

export interface VerwijderStandaardInteractiesCmd<Msg> {
  readonly type: "VerwijderStandaardInteracties";
  readonly wrapper: () => Msg;
}

export interface VeranderMiddelpuntCmd<Msg> {
  readonly type: "VeranderMiddelpunt";
  readonly coordinate: ol.Coordinate;
  readonly wrapper: () => Msg;
}

export interface VeranderZoomCmd<Msg> {
  readonly type: "VeranderZoom";
  readonly zoom: number;
  readonly wrapper: () => Msg;
}

export interface VeranderExtentCmd<Msg> {
  readonly type: "VeranderExtent";
  readonly extent: ol.Extent;
  readonly wrapper: () => Msg;
}

export interface VeranderViewportCmd<Msg> {
  readonly type: "VeranderViewport";
  readonly size: ol.Size;
  readonly wrapper: () => Msg;
}

export interface ZetFocusOpKaartCmd<Msg> {
  readonly type: "FocusOpKaart";
  readonly wrapper: () => Msg;
}

export interface VerliesFocusOpKaartCmd<Msg> {
  readonly type: "VerliesFocusOpKaart";
  readonly wrapper: () => Msg;
}

export interface VervangFeaturesCmd<Msg> {
  readonly type: "VervangFeatures";
  readonly titel: string;
  readonly features: List<ol.Feature>;
  readonly wrapper: () => Msg;
}

export interface ToonAchtergrondKeuzeCmd<Msg> {
  readonly type: "ToonAchtergrondKeuze";
  readonly achtergrondTitels: List<string>;
  readonly geselecteerdeLaagTitel: Option<string>;
  readonly wrapper: () => Msg;
}

export interface VerbergAchtergrondKeuzeCmd<Msg> {
  readonly type: "VerbergAchtergrondKeuze";
  readonly wrapper: () => Msg;
}

export interface KiesAchtergrondCmd<Msg> {
  readonly type: "KiesAchtergrond";
  readonly titel: string;
  readonly wrapper: () => Msg;
}

export interface MaakLaagZichtbaarCmd<Msg> {
  readonly type: "MaakLaagZichtbaar";
  readonly titel: string;
  readonly wrapper: () => Msg;
}

export interface MaakLaagOnzichtbaarCmd<Msg> {
  readonly type: "MaakLaagOnzichtbaar";
  readonly titel: string;
  readonly wrapper: () => Msg;
}

export interface ZetStijlVoorLaagCmd<Msg> {
  readonly type: "ZetStijlVoorLaag";
  readonly titel: string;
  readonly stijl: StyleSelector;
  readonly wrapper: () => Msg;
}
