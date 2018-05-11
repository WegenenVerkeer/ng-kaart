import { List, Set } from "immutable";
import { Subscription as RxSubscription } from "rxjs/Subscription";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { Subscription, Wrapper, VoidWrapper, KaartMsg, KaartCmdValidation, ValidationWrapper, BareValidationWrapper } from ".";
import { StyleSelector } from "./kaart-elementen";
import { AbstractZoeker, ZoekInput } from "../zoeker/abstract-zoeker";
import { Option } from "fp-ts/lib/Option";
import { InfoBoodschap } from "./kaart-with-info-model";
import { KaartInternalMsg } from "./kaart-internal-messages";
import * as prt from "./kaart-protocol";

export type Command<Msg extends KaartMsg> =
  | SubscribeCmd<Msg>
  | UnsubscribeCmd
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
  | VeranderExtentCmd
  | VeranderViewportCmd
  | ZetFocusOpKaartCmd
  | VerliesFocusOpKaartCmd
  | VervangFeaturesCmd<Msg>
  | ToonAchtergrondKeuzeCmd<Msg>
  | VerbergAchtergrondKeuzeCmd<Msg>
  | KiesAchtergrondCmd<Msg>
  | MaakLaagZichtbaarCmd<Msg>
  | MaakLaagOnzichtbaarCmd<Msg>
  | ActiveerSelectieModusCmd<Msg>
  | ZetStijlVoorLaagCmd<Msg>
  | VoegZoekerToeCmd<Msg>
  | VerwijderZoekerCmd<Msg>
  | ZoekCmd<Msg>
  | MeldComponentFoutCmd
  | ZetMijnLocatieZoomCmd
  | VoegInteractieToeCmd
  | VerwijderInteractieCmd
  | VoegOverlayToeCmd
  | VerwijderOverlaysCmd
  | ToonInfoBoodschapCmd
  | VerbergInfoBoodschapCmd
  | DeselecteerFeatureCmd
  | SluitInfoBoodschapCmd<Msg>
  | VoegUiElementToe
  | VerwijderUiElement
  | ZetUiElementOpties;

export interface SubscriptionResult {
  readonly subscription: RxSubscription;
  readonly subscriberName: string;
}

export interface SubscribeCmd<Msg extends KaartMsg> {
  readonly type: "Subscription";
  readonly subscription: Subscription<Msg>;
  readonly wrapper: ValidationWrapper<SubscriptionResult, Msg>;
}

export interface UnsubscribeCmd {
  readonly type: "Unsubscription";
  readonly subscriptionResult: SubscriptionResult;
}

export interface PositieAanpassing {
  readonly titel: string;
  readonly positie: number;
}

export interface VoegLaagToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegLaagToe";
  readonly positie: number;
  readonly laag: ke.Laag;
  readonly magGetoondWorden: boolean;
  readonly laaggroep: ke.Laaggroep;
  readonly wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>;
}

export interface VerwijderLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderLaag";
  readonly titel: string;
  readonly wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>;
}

export interface VerplaatsLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerplaatsLaag";
  readonly titel: string;
  readonly naarPositie: number;
  readonly wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>;
}

export interface VoegSchaalToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegSchaalToe";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderSchaalCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderSchaal";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VoegVolledigSchermToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegVolledigSchermToe";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderVolledigSchermCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderVolledigScherm";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VoegStandaardInteractiesToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegStandaardInteractiesToe";
  readonly scrollZoomOnFocus: boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderStandaardInteractiesCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderStandaardInteracties";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VeranderMiddelpuntCmd<Msg extends KaartMsg> {
  readonly type: "VeranderMiddelpunt";
  readonly coordinate: ol.Coordinate;
}

export interface VeranderZoomCmd<Msg extends KaartMsg> {
  readonly type: "VeranderZoom";
  readonly zoom: number;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VeranderExtentCmd {
  readonly type: "VeranderExtent";
  readonly extent: ol.Extent;
}

export interface VeranderViewportCmd {
  readonly type: "VeranderViewport";
  readonly size: ol.Size;
}

export interface ZetFocusOpKaartCmd {
  readonly type: "FocusOpKaart";
}

export interface VerliesFocusOpKaartCmd {
  readonly type: "VerliesFocusOpKaart";
}

export interface VervangFeaturesCmd<Msg extends KaartMsg> {
  readonly type: "VervangFeatures";
  readonly titel: string;
  readonly features: List<ol.Feature>;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export type SelectieModus = "single" | "multiple" | "none";

export interface ActiveerSelectieModusCmd<Msg extends KaartMsg> {
  readonly type: "ActiveerSelectieModus";
  readonly selectieModus: SelectieModus;
}

export interface ToonAchtergrondKeuzeCmd<Msg extends KaartMsg> {
  readonly type: "ToonAchtergrondKeuze";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerbergAchtergrondKeuzeCmd<Msg extends KaartMsg> {
  readonly type: "VerbergAchtergrondKeuze";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface KiesAchtergrondCmd<Msg extends KaartMsg> {
  readonly type: "KiesAchtergrond";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface MaakLaagZichtbaarCmd<Msg extends KaartMsg> {
  readonly type: "MaakLaagZichtbaar";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface MaakLaagOnzichtbaarCmd<Msg extends KaartMsg> {
  readonly type: "MaakLaagOnzichtbaar";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZetStijlVoorLaagCmd<Msg extends KaartMsg> {
  readonly type: "ZetStijlVoorLaag";
  readonly titel: string;
  readonly stijl: StyleSelector;
  readonly selectieStijl: Option<StyleSelector>;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface MeldComponentFoutCmd {
  readonly type: "MeldComponentFout";
  readonly fouten: List<string>;
}

export interface VoegZoekerToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegZoekerToe";
  readonly zoeker: AbstractZoeker;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderZoekerCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderZoeker";
  readonly zoeker: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZoekCmd<Msg extends KaartMsg> {
  readonly type: "Zoek";
  readonly input: string | ZoekInput;
  readonly zoekers: Set<string>;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZetMijnLocatieZoomCmd {
  readonly type: "ZetMijnLocatieZoomStatus";
  readonly doelniveau: Option<number>;
}

export interface VoegInteractieToeCmd {
  readonly type: "VoegInteractieToe";
  readonly interactie: ol.interaction.Pointer;
}

export interface VerwijderInteractieCmd {
  readonly type: "VerwijderInteractie";
  readonly interactie: ol.interaction.Pointer;
}

export interface VoegOverlayToeCmd {
  readonly type: "VoegOverlayToe";
  readonly overlay: ol.Overlay;
}

export interface VerwijderOverlaysCmd {
  readonly type: "VerwijderOverlays";
  readonly overlays: Array<ol.Overlay>;
}

export interface ToonInfoBoodschapCmd {
  readonly type: "ToonInfoBoodschap";
  readonly boodschap: InfoBoodschap;
}

export interface VerbergInfoBoodschapCmd {
  readonly type: "VerbergInfoBoodschap";
  readonly id: string;
}

export interface UiElementOpties {
  [k: string]: any;
}

// TODO toevoegen van een selector wanneer er meerdere elementen van hetzelfde type beschikbaar zijn
export interface VoegUiElementToe {
  readonly type: "VoegUiElementToe";
  readonly naam: string;
}

export interface VerwijderUiElement {
  readonly type: "VerwijderUiElement";
  readonly naam: string;
}

export interface ZetUiElementOpties {
  readonly type: "ZetUiElementOpties";
  readonly naam: string;
  readonly opties: UiElementOpties;
}

export interface DeselecteerFeatureCmd {
  readonly type: "DeselecteerFeature";
  readonly id: string;
}

export interface SluitInfoBoodschapCmd<Msg extends prt.TypedRecord> {
  readonly type: "SluitInfoBoodschap";
  readonly id: string;
  readonly msgGen: () => Option<Msg>;
}

////////////////////////
// constructor functies
//

export function VoegStandaardInteractiesToeCmd<Msg extends KaartMsg>(
  scrollZoomOnFocus: boolean,
  wrapper: BareValidationWrapper<Msg>
): VoegStandaardInteractiesToeCmd<Msg> {
  return { type: "VoegStandaardInteractiesToe", scrollZoomOnFocus: scrollZoomOnFocus, wrapper: wrapper };
}

export function VerwijderStandaardInteractiesCmd<Msg extends KaartMsg>(
  wrapper: BareValidationWrapper<Msg>
): VerwijderStandaardInteractiesCmd<Msg> {
  return { type: "VerwijderStandaardInteracties", wrapper: wrapper };
}

export function VoegLaagToeCmd<Msg extends KaartMsg>(
  positie: number,
  laag: ke.Laag,
  magGetoondWorden: boolean,
  laagGroep: ke.Laaggroep,
  wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>
): VoegLaagToeCmd<Msg> {
  return { type: "VoegLaagToe", positie: positie, laag: laag, magGetoondWorden: magGetoondWorden, laaggroep: laagGroep, wrapper: wrapper };
}

export function VerwijderLaagCmd<Msg extends KaartMsg>(
  titel: string,
  wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>
): VerwijderLaagCmd<Msg> {
  return { type: "VerwijderLaag", titel: titel, wrapper: wrapper };
}

export function VerplaatsLaagCmd<Msg extends KaartMsg>(
  titel: string,
  naarPositie: number,
  wrapper: ValidationWrapper<List<PositieAanpassing>, Msg>
): VerplaatsLaagCmd<Msg> {
  return { type: "VerplaatsLaag", titel: titel, naarPositie: naarPositie, wrapper: wrapper };
}

export function ZetStijlVoorLaagCmd<Msg extends KaartMsg>(
  titel: string,
  stijl: StyleSelector,
  selectieStijl: Option<StyleSelector>,
  wrapper: BareValidationWrapper<Msg>
): ZetStijlVoorLaagCmd<Msg> {
  return { type: "ZetStijlVoorLaag", stijl: stijl, selectieStijl: selectieStijl, titel: titel, wrapper: wrapper };
}

export function VeranderMiddelpuntCmd<Msg extends KaartMsg>(coordinate: ol.Coordinate): VeranderMiddelpuntCmd<Msg> {
  return { type: "VeranderMiddelpunt", coordinate: coordinate };
}

export function VeranderZoomCmd<Msg extends KaartMsg>(zoom: number, wrapper: BareValidationWrapper<Msg>): VeranderZoomCmd<Msg> {
  return { type: "VeranderZoom", zoom: zoom, wrapper: wrapper };
}

export function VeranderExtentCmd<Msg extends KaartMsg>(extent: ol.Extent): VeranderExtentCmd {
  return { type: "VeranderExtent", extent: extent };
}

export function VeranderViewportCmd<Msg extends KaartMsg>(size: ol.Size): VeranderViewportCmd {
  return { type: "VeranderViewport", size: size };
}

export function VervangFeaturesCmd<Msg extends KaartMsg>(
  titel: string,
  features: List<ol.Feature>,
  wrapper: BareValidationWrapper<Msg>
): VervangFeaturesCmd<Msg> {
  return { type: "VervangFeatures", titel: titel, features: features, wrapper: wrapper };
}

export function ActiveerSelectieModusCmd<Msg extends KaartMsg>(selectieModus: SelectieModus): ActiveerSelectieModusCmd<Msg> {
  return { type: "ActiveerSelectieModus", selectieModus: selectieModus };
}

export function MeldComponentFoutCmd<Msg extends KaartMsg>(fouten: List<string>): MeldComponentFoutCmd {
  return { type: "MeldComponentFout", fouten: fouten };
}

export function KiesAchtergrondCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): KiesAchtergrondCmd<Msg> {
  return { type: "KiesAchtergrond", titel: titel, wrapper: wrapper };
}

export function MaakLaagZichtbaarCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): MaakLaagZichtbaarCmd<Msg> {
  return { type: "MaakLaagZichtbaar", titel: titel, wrapper: wrapper };
}

export function MaakLaagOnzichtbaarCmd<Msg extends KaartMsg>(
  titel: string,
  wrapper: BareValidationWrapper<Msg>
): MaakLaagOnzichtbaarCmd<Msg> {
  return { type: "MaakLaagOnzichtbaar", titel: titel, wrapper: wrapper };
}

export function ToonAchtergrondKeuzeCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): ToonAchtergrondKeuzeCmd<Msg> {
  return {
    type: "ToonAchtergrondKeuze",
    wrapper: wrapper
  };
}

export function VerbergAchtergrondKeuzeCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VerbergAchtergrondKeuzeCmd<Msg> {
  return { type: "VerbergAchtergrondKeuze", wrapper: wrapper };
}

export function VoegInteractieToeCmd<Msg extends KaartMsg>(interactie: ol.interaction.Pointer): VoegInteractieToeCmd {
  return {
    type: "VoegInteractieToe",
    interactie: interactie
  };
}

export function VerwijderInteractieCmd<Msg extends KaartMsg>(interactie: ol.interaction.Pointer): VerwijderInteractieCmd {
  return {
    type: "VerwijderInteractie",
    interactie: interactie
  };
}

export function VoegOverlayToeCmd<Msg extends KaartMsg>(overlay: ol.Overlay): VoegOverlayToeCmd {
  return {
    type: "VoegOverlayToe",
    overlay: overlay
  };
}

export function VerwijderOverlaysCmd<Msg extends KaartMsg>(overlays: Array<ol.Overlay>): VerwijderOverlaysCmd {
  return {
    type: "VerwijderOverlays",
    overlays: overlays
  };
}

export function SubscribeCmd<Msg extends KaartMsg>(
  subscription: Subscription<Msg>,
  wrapper: ValidationWrapper<SubscriptionResult, Msg>
): SubscribeCmd<Msg> {
  return { type: "Subscription", subscription: subscription, wrapper: wrapper };
}

export function UnsubscribeCmd<Msg extends KaartMsg>(subscriptionResult: SubscriptionResult): UnsubscribeCmd {
  return { type: "Unsubscription", subscriptionResult: subscriptionResult };
}

export function ZetMijnLocatieZoomCmd(doelniveau: Option<number>): ZetMijnLocatieZoomCmd {
  return { type: "ZetMijnLocatieZoomStatus", doelniveau: doelniveau };
}

export function ToonInfoBoodschapCmd<Msg extends KaartMsg>(
  id: string,
  titel: string,
  inhoud: string,
  verbergMsgGen: () => Option<Msg>
): ToonInfoBoodschapCmd {
  return {
    type: "ToonInfoBoodschap",
    boodschap: {
      id: id,
      titel: titel,
      inhoud: inhoud,
      verbergMsgGen: verbergMsgGen
    }
  };
}

export function VerbergInfoBoodschapCmd(id: string): VerbergInfoBoodschapCmd {
  return { type: "VerbergInfoBoodschap", id: id };
}

export function VoegUiElementToe(naam: string): VoegUiElementToe {
  return { type: "VoegUiElementToe", naam: naam };
}

export function VerwijderUiElement(naam: string): VerwijderUiElement {
  return { type: "VerwijderUiElement", naam: naam };
}

export function ZetUiElementOpties(naam: string, opties: UiElementOpties): ZetUiElementOpties {
  return { type: "ZetUiElementOpties", naam: naam, opties: opties };
}

export function DeselecteerFeatureCmd(id: string): DeselecteerFeatureCmd {
  return {
    type: "DeselecteerFeature",
    id: id
  };
}

export function SluitInfoBoodschapCmd<Msg extends prt.TypedRecord>(id: string, msgGen: () => Option<Msg>): SluitInfoBoodschapCmd<Msg> {
  return {
    type: "SluitInfoBoodschap",
    id: id,
    msgGen: msgGen
  };
}
