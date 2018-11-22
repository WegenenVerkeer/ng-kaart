import { Option } from "fp-ts/lib/Option";
import { List, Set } from "immutable";
import * as ol from "openlayers";
import * as rx from "rxjs";

import { ZoekerMetPrioriteiten, Zoekopdracht, ZoekResultaat } from "../zoeker/zoeker";

import { BareValidationWrapper, KaartMsg, Subscription, ValidationWrapper } from ".";
import { LaagLocationInfoService } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { Legende } from "./kaart-legende";
import * as prt from "./kaart-protocol";
import { InfoBoodschap } from "./kaart-with-info-model";
import * as ss from "./stijl-selector";

export type Command<Msg extends KaartMsg> =
  | AbortTileLoadingCmd
  | ActiveerHoverModusCmd<Msg>
  | ActiveerSelectieModusCmd<Msg>
  | BewerkVectorlaagstijlCmd
  | DeselecteerAlleFeaturesCmd
  | DeselecteerFeatureCmd
  | KiesAchtergrondCmd<Msg>
  | MaakLaagOnzichtbaarCmd<Msg>
  | MaakLaagZichtbaarCmd<Msg>
  | MeldComponentFoutCmd
  | SelecteerFeaturesCmd
  | SluitInfoBoodschapCmd
  | SluitPanelenCmd
  | StopVectorlaagstijlBewerkingCmd
  | SubscribeCmd<Msg>
  | ToonAchtergrondKeuzeCmd<Msg>
  | ToonInfoBoodschapCmd
  | UnsubscribeCmd
  | VeranderExtentCmd
  | VeranderMiddelpuntCmd<Msg>
  | VeranderViewportCmd
  | VeranderZoomCmd<Msg>
  | VeranderRotatieCmd<Msg>
  | VerbergAchtergrondKeuzeCmd<Msg>
  | VerbergInfoBoodschapCmd
  | VerliesFocusOpKaartCmd
  | VerplaatsLaagCmd<Msg>
  | VervangFeaturesCmd<Msg>
  | VervangLaagCmd<Msg>
  | VerwijderInteractieCmd
  | VerwijderLaagCmd<Msg>
  | VerwijderOverlaysCmd
  | VerwijderSchaalCmd<Msg>
  | VerwijderStandaardInteractiesCmd<Msg>
  | VerwijderUiElement
  | VerwijderVolledigSchermCmd<Msg>
  | VerwijderZoekerCmd<Msg>
  | VoegInteractieToeCmd
  | VoegLaagLocatieInformatieServiceToe
  | VoegLaagToeCmd<Msg>
  | VoegOverlayToeCmd
  | VoegSchaalToeCmd<Msg>
  | VoegStandaardInteractiesToeCmd<Msg>
  | VoegUiElementToe
  | VoegVolledigSchermToeCmd<Msg>
  | VoegZoekerToeCmd<Msg>
  | VraagSchaalAanCmd<Msg>
  | ZetActieveModusCmd
  | ZetFocusOpKaartCmd
  | ZetLaagLegendeCmd<Msg>
  | ZetMijnLocatieZoomCmd
  | ZetStijlSpecVoorLaagCmd<Msg>
  | ZetStijlVoorLaagCmd<Msg>
  | ZetUiElementOpties
  | ZoekCmd<Msg>
  | ZoekGekliktCmd;

export interface SubscriptionResult {
  readonly subscription: rx.Subscription;
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
  readonly legende: Option<Legende>;
  readonly stijlInLagenKiezer: Option<string>;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderLaag";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerplaatsLaagCmd<Msg extends KaartMsg> {
  readonly type: "VerplaatsLaag";
  readonly titel: string;
  readonly naarPositie: number;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VervangLaagCmd<Msg extends KaartMsg> {
  readonly type: "VervangLaagCmd";
  readonly laag: ke.Laag;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZetLaagLegendeCmd<Msg extends KaartMsg> {
  readonly type: "ZetLaagLegende";
  readonly titel: string;
  readonly legende: Legende;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VraagSchaalAanCmd<Msg extends KaartMsg> {
  readonly type: "VraagSchaalAan";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VoegSchaalToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegSchaalToe";
  readonly target: Option<Element>;
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
  readonly rotatie: boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderStandaardInteractiesCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderStandaardInteracties";
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VeranderMiddelpuntCmd<Msg extends KaartMsg> {
  readonly type: "VeranderMiddelpunt";
  readonly coordinate: ol.Coordinate;
  readonly animationDuration: Option<number>;
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

export interface VeranderRotatieCmd<Msg extends KaartMsg> {
  readonly type: "VeranderRotatie";
  readonly rotatie: number;
  readonly animationDuration: Option<number>;
  readonly wrapper: BareValidationWrapper<Msg>;
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

// single: altijd maar 1 element geselecteerd
// multipleKlik: een klik voegt een element toe aan de selectie
// multipleShift: een shift-klik voegt een element toe aan de selectie
export type SelectieModus = "single" | "multipleKlik" | "multipleShift" | "none";

export interface ActiveerSelectieModusCmd<Msg extends KaartMsg> {
  readonly type: "ActiveerSelectieModus";
  readonly selectieModus: SelectieModus;
}

export type HoverModus = "on" | "off";

export interface ActiveerHoverModusCmd<Msg extends KaartMsg> {
  readonly type: "ActiveerHoverModus";
  readonly hoverModus: HoverModus;
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
  readonly stijl: ss.StyleSelector;
  readonly selectieStijl: Option<ss.StyleSelector>;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZetStijlSpecVoorLaagCmd<Msg extends KaartMsg> {
  readonly type: "ZetStijlSpecVoorLaag";
  readonly titel: string;
  readonly stijlSpec: ss.AwvV0StyleSpec;
  readonly legende: Legende;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface AbortTileLoadingCmd {
  readonly type: "AbortTileLoading";
}

export interface MeldComponentFoutCmd {
  readonly type: "MeldComponentFout";
  readonly fouten: List<string>;
}

export interface VoegZoekerToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegZoekerToe";
  readonly zoekerPrioriteit: ZoekerMetPrioriteiten;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VerwijderZoekerCmd<Msg extends KaartMsg> {
  readonly type: "VerwijderZoeker";
  readonly zoekerNaam: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZoekCmd<Msg extends KaartMsg> {
  readonly type: "Zoek";
  readonly opdracht: Zoekopdracht;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZoekGekliktCmd {
  readonly type: "ZoekGeklikt";
  readonly resultaat: ZoekResultaat;
}

export interface ZoekSuggestiesCmd {
  readonly type: "ZoekSuggesties";
  readonly zoekterm: string;
  readonly zoekers: Set<string>;
}

export interface ZetMijnLocatieZoomCmd {
  readonly type: "ZetMijnLocatieZoomStatus";
  readonly doelniveau: Option<number>;
}

export interface ZetActieveModusCmd {
  readonly type: "ZetActieveModus";
  readonly modus: Option<string>;
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

// De features zullen "geselecteerd" worden, ook al zouden ze geen onderdeel uitmaken van één van de lagen. Het is dus de
// verantwoordelijkheid van de zender om enkel feature mee te geven die zichtbaar zijn.
// De gegeven features vervangen de eventueel reeds geselecteerde features. Maw, om alles te deslecteren, kan dit commando verzonden worden
// met een lege verzameling features.
export interface SelecteerFeaturesCmd {
  readonly type: "SelecteerFeatures";
  readonly features: List<ol.Feature>;
}

export interface DeselecteerFeatureCmd {
  readonly type: "DeselecteerFeature";
  readonly id: string;
}

export interface DeselecteerAlleFeaturesCmd {
  readonly type: "DeselecteerAlleFeatures";
}

export interface SluitInfoBoodschapCmd {
  readonly type: "SluitInfoBoodschap";
  readonly id: string;
  readonly sluit: boolean;
  readonly msgGen: () => Option<prt.TypedRecord>;
}

export interface SluitPanelenCmd {
  readonly type: "SluitPanelen";
}

export interface VoegLaagLocatieInformatieServiceToe {
  readonly type: "VoegLaagLocatieInformatieServiceToe";
  readonly titel: string;
  readonly service: LaagLocationInfoService;
  readonly msgGen: BareValidationWrapper<prt.TypedRecord>;
}

// Er kan maar 1 Vectorlaagstijl per keer bewerk worden. Indien meer gewenst, moet een msgGen met daarin handle opgegeven worden.
export interface BewerkVectorlaagstijlCmd {
  readonly type: "BewerkVectorlaagstijl";
  readonly laag: ke.ToegevoegdeVectorLaag;
}

export interface StopVectorlaagstijlBewerkingCmd {
  readonly type: "StopVectorlaagstijlBewerking";
}

////////////////////////
// constructor functies
//

export function VoegStandaardInteractiesToeCmd<Msg extends KaartMsg>(
  scrollZoomOnFocus: boolean,
  rotatie: boolean,
  wrapper: BareValidationWrapper<Msg>
): VoegStandaardInteractiesToeCmd<Msg> {
  return { type: "VoegStandaardInteractiesToe", scrollZoomOnFocus: scrollZoomOnFocus, rotatie: rotatie, wrapper: wrapper };
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
  legende: Option<Legende>,
  stijlInLagenKiezer: Option<string>,
  wrapper: BareValidationWrapper<Msg>
): VoegLaagToeCmd<Msg> {
  return {
    type: "VoegLaagToe",
    positie: positie,
    laag: laag,
    magGetoondWorden: magGetoondWorden,
    laaggroep: laagGroep,
    legende: legende,
    stijlInLagenKiezer: stijlInLagenKiezer,
    wrapper: wrapper
  };
}

export function VerwijderLaagCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): VerwijderLaagCmd<Msg> {
  return { type: "VerwijderLaag", titel: titel, wrapper: wrapper };
}

export function VerplaatsLaagCmd<Msg extends KaartMsg>(
  titel: string,
  naarPositie: number,
  wrapper: BareValidationWrapper<Msg>
): VerplaatsLaagCmd<Msg> {
  return { type: "VerplaatsLaag", titel: titel, naarPositie: naarPositie, wrapper: wrapper };
}

export function VraagSchaalAanCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VraagSchaalAanCmd<Msg> {
  return {
    type: "VraagSchaalAan",
    wrapper: wrapper
  };
}

export function VoegSchaalToeCmd<Msg extends KaartMsg>(
  target: Option<Element>,
  wrapper: BareValidationWrapper<Msg>
): VoegSchaalToeCmd<Msg> {
  return { type: "VoegSchaalToe", target: target, wrapper: wrapper };
}

export function VerwijderSchaalCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VerwijderSchaalCmd<Msg> {
  return { type: "VerwijderSchaal", wrapper: wrapper };
}

export function ZetStijlVoorLaagCmd<Msg extends KaartMsg>(
  titel: string,
  stijl: ss.StyleSelector,
  selectieStijl: Option<ss.StyleSelector>,
  wrapper: BareValidationWrapper<Msg>
): ZetStijlVoorLaagCmd<Msg> {
  return { type: "ZetStijlVoorLaag", stijl: stijl, selectieStijl: selectieStijl, titel: titel, wrapper: wrapper };
}

export function ZetStijlSpecVoorLaagCmd<Msg extends KaartMsg>(
  titel: string,
  stijlSpec: ss.AwvV0StyleSpec,
  legende: Legende,
  wrapper: BareValidationWrapper<Msg>
): ZetStijlSpecVoorLaagCmd<Msg> {
  return { type: "ZetStijlSpecVoorLaag", stijlSpec: stijlSpec, legende: legende, titel: titel, wrapper: wrapper };
}

export function VeranderMiddelpuntCmd<Msg extends KaartMsg>(
  coordinate: ol.Coordinate,
  animationDuration: Option<number>
): VeranderMiddelpuntCmd<Msg> {
  return { type: "VeranderMiddelpunt", coordinate: coordinate, animationDuration: animationDuration };
}

export function VeranderZoomCmd<Msg extends KaartMsg>(zoom: number, wrapper: BareValidationWrapper<Msg>): VeranderZoomCmd<Msg> {
  return { type: "VeranderZoom", zoom: zoom, wrapper: wrapper };
}

export function VeranderRotatieCmd<Msg extends KaartMsg>(
  rotatie: number,
  animationDuration: Option<number>,
  wrapper: BareValidationWrapper<Msg>
): VeranderRotatieCmd<Msg> {
  return { type: "VeranderRotatie", rotatie: rotatie, animationDuration: animationDuration, wrapper: wrapper };
}

export function VeranderExtentCmd<Msg extends KaartMsg>(extent: ol.Extent): VeranderExtentCmd {
  return { type: "VeranderExtent", extent: extent };
}

export function ZoekGekliktCmd<Msg extends KaartMsg>(resultaat: ZoekResultaat): ZoekGekliktCmd {
  return { type: "ZoekGeklikt", resultaat: resultaat };
}

export function VeranderViewportCmd<Msg extends KaartMsg>(size: ol.Size): VeranderViewportCmd {
  return { type: "VeranderViewport", size: size };
}

export function AbortTileLoadingCmd(): AbortTileLoadingCmd {
  return { type: "AbortTileLoading" };
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

export function ActiveerHoverModusCmd<Msg extends KaartMsg>(hoverModus: HoverModus): ActiveerHoverModusCmd<Msg> {
  return { type: "ActiveerHoverModus", hoverModus: hoverModus };
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

export function ZetActieveModusCmd(modus: Option<string>): ZetActieveModusCmd {
  return { type: "ZetActieveModus", modus: modus };
}

export function ToonInfoBoodschapCmd<Bdschp extends InfoBoodschap>(boodschap: Bdschp): ToonInfoBoodschapCmd {
  return {
    type: "ToonInfoBoodschap",
    boodschap: boodschap
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

export function SelecteerFeaturesCmd(features: List<ol.Feature>): SelecteerFeaturesCmd {
  return { type: "SelecteerFeatures", features: features };
}

export function DeselecteerFeatureCmd(id: string): DeselecteerFeatureCmd {
  return {
    type: "DeselecteerFeature",
    id: id
  };
}

export function DeselecteerAlleFeaturesCmd(): DeselecteerAlleFeaturesCmd {
  return {
    type: "DeselecteerAlleFeatures"
  };
}

export function SluitInfoBoodschapCmd(id: string, sluit: boolean, msgGen: () => Option<prt.TypedRecord>): SluitInfoBoodschapCmd {
  return {
    type: "SluitInfoBoodschap",
    id: id,
    sluit: sluit,
    msgGen: msgGen
  };
}

export function SluitPanelenCmd(): SluitPanelenCmd {
  return {
    type: "SluitPanelen"
  };
}

export function ZetLaagLegendeCmd<Msg extends KaartMsg>(
  titel: string,
  legende: Legende,
  wrapper: BareValidationWrapper<Msg>
): ZetLaagLegendeCmd<Msg> {
  return { type: "ZetLaagLegende", titel: titel, legende: legende, wrapper: wrapper };
}

export function VoegZoekerToeCmd<Msg extends KaartMsg>(
  zoeker: ZoekerMetPrioriteiten,
  wrapper: BareValidationWrapper<Msg>
): VoegZoekerToeCmd<Msg> {
  return { type: "VoegZoekerToe", zoekerPrioriteit: zoeker, wrapper: wrapper };
}

export function VoegLaagLocatieInformatieServiceToe(
  titel: string,
  service: LaagLocationInfoService,
  msgGen: BareValidationWrapper<prt.TypedRecord>
): VoegLaagLocatieInformatieServiceToe {
  return { type: "VoegLaagLocatieInformatieServiceToe", titel: titel, service: service, msgGen: msgGen };
}

export function BewerkVectorlaagstijlCmd(laag: ke.ToegevoegdeVectorLaag): BewerkVectorlaagstijlCmd {
  return { type: "BewerkVectorlaagstijl", laag: laag };
}

export function StopVectorlaagstijlBewerkingCmd(): StopVectorlaagstijlBewerkingCmd {
  return { type: "StopVectorlaagstijlBewerking" };
}
