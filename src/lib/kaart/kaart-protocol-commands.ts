import { List } from "immutable";
import { Option } from "fp-ts/lib/Option";
import { Subscription as RxSubscription } from "rxjs/Subscription";

import * as ol from "openlayers";
import * as ke from "./kaart-elementen";
import { Subscription, Wrapper, VoidWrapper, KaartMsg } from ".";
import { StyleSelector } from "./kaart-elementen";

export type Command<Msg extends KaartMsg> =
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
  | ZetStijlVoorLaagCmd<Msg>
  | MeldComponentFoutCmd<Msg>;

export interface SubscriptionCmd<Msg extends KaartMsg> {
  readonly type: "Subscription";
  readonly subscription: Subscription<Msg>;
  readonly wrapper: Wrapper<RxSubscription, Msg>;
}

export interface UnsubscriptionCmd<Msg extends KaartMsg> {
  readonly type: "Unsubscription";
  readonly subscription: RxSubscription;
  readonly wrapper: VoidWrapper<Msg>; // TODO weg, zoals de meeste voidwrappers
}

export interface VoegLaagToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegLaagToe";
  readonly positie: number;
  readonly laag: ke.Laag;
  readonly magGetoondWorden: boolean;
  readonly wrapper: Wrapper<number, Msg>;
}

export interface VerwijderLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderLaag";
  readonly titel: string;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VoegSchaalToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegSchaalToe";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VerplaatsLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerplaatsLaag";
  readonly titel: string;
  readonly naarPositie: number;
  readonly wrapper: Wrapper<number, Msg>;
}

export interface VerwijderSchaalCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderSchaal";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VoegVolledigSchermToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegVolledigSchermToe";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VerwijderVolledigSchermCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderVolledigScherm";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VoegStandaardInteractiesToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegStandaardInteractiesToe";
  readonly scrollZoomOnFocus: boolean;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VerwijderStandaardInteractiesCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderStandaardInteracties";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VeranderMiddelpuntCmd<Msg extends KaartMsg> {
  readonly type: "VeranderMiddelpunt";
  readonly coordinate: ol.Coordinate;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VeranderZoomCmd<Msg extends KaartMsg> {
  readonly type: "VeranderZoom";
  readonly zoom: number;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VeranderExtentCmd<Msg extends KaartMsg> {
  readonly type: "VeranderExtent";
  readonly extent: ol.Extent;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VeranderViewportCmd<Msg extends KaartMsg> {
  readonly type: "VeranderViewport";
  readonly size: ol.Size;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface ZetFocusOpKaartCmd<Msg extends KaartMsg> {
  readonly type: "FocusOpKaart";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VerliesFocusOpKaartCmd<Msg extends KaartMsg> {
  readonly type: "VerliesFocusOpKaart";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VervangFeaturesCmd<Msg extends KaartMsg> {
  readonly type: "VervangFeatures";
  readonly titel: string;
  readonly features: List<ol.Feature>;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface ToonAchtergrondKeuzeCmd<Msg extends KaartMsg> {
  readonly type: "ToonAchtergrondKeuze";
  readonly achtergrondTitels: List<string>;
  readonly geselecteerdeLaagTitel: Option<string>;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface VerbergAchtergrondKeuzeCmd<Msg extends KaartMsg> {
  readonly type: "VerbergAchtergrondKeuze";
  readonly wrapper: VoidWrapper<Msg>;
}

export interface KiesAchtergrondCmd<Msg extends KaartMsg> {
  readonly type: "KiesAchtergrond";
  readonly titel: string;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface MaakLaagZichtbaarCmd<Msg extends KaartMsg> {
  readonly type: "MaakLaagZichtbaar";
  readonly titel: string;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface MaakLaagOnzichtbaarCmd<Msg extends KaartMsg> {
  readonly type: "MaakLaagOnzichtbaar";
  readonly titel: string;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface ZetStijlVoorLaagCmd<Msg extends KaartMsg> {
  readonly type: "ZetStijlVoorLaag";
  readonly titel: string;
  readonly stijl: StyleSelector;
  readonly wrapper: VoidWrapper<Msg>;
}

export interface MeldComponentFoutCmd<Msg extends KaartMsg> {
  readonly type: "MeldComponentFout";
  readonly fouten: List<string>;
  readonly wrapper: VoidWrapper<Msg>;
}
