import { Option } from "fp-ts/lib/Option";
import * as ol from "openlayers";
import * as rx from "rxjs";

import { Filter as fltr } from "../filter/filter-model";
import { Transparantie } from "../transparantieeditor/transparantie";
import { TypedRecord } from "../util/typed-record";
import { ZoekerMetWeergaveopties, Zoekopdracht, ZoekResultaat } from "../zoeker/zoeker";

import { BareValidationWrapper, KaartLocaties, KaartMsg, Laagtabelinstellingen, Subscription, ValidationWrapper } from ".";
import { CachedFeatureLookup } from "./cache/lookup";
import { LaagLocationInfoService } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { Legende } from "./kaart-legende";
import { InfoBoodschap } from "./kaart-with-info-model";
import * as loc from "./mijn-locatie/kaart-mijn-locatie.component";
import * as ss from "./stijl-selector";
import { TabelActiviteit } from "./tabel-state";
import { DrawOps } from "./tekenen/tekenen-model";
import { OptiesRecord } from "./ui-element-opties";

export type Command<Msg extends KaartMsg> =
  | AbortTileLoadingCmd
  | ActiveerCacheVoorLaag<Msg>
  | ActiveerFilter<Msg>
  | ActiveerHighlightModusCmd
  | ActiveerHoverModusCmd
  | ActiveerSelectieModusCmd
  | BewerkTransparantieCmd
  | BewerkVectorFilterCmd
  | BewerkVectorlaagstijlCmd
  | DeactiveerSelectieModusCmd
  | DeselecteerAlleFeaturesCmd
  | DeselecteerFeatureCmd
  | DrawOpsCmd
  | HaalFilterTotaalOp<Msg>
  | HighlightFeaturesCmd<Msg>
  | KiesAchtergrondCmd<Msg>
  | MaakLaagOnzichtbaarCmd<Msg>
  | MaakLaagZichtbaarCmd<Msg>
  | MijnLocatieStateChangeCmd
  | PublishKaartLocatiesCmd
  | ReactiveerSelectieModusCmd
  | RegistreerErrorCmd
  | SelecteerFeaturesCmd
  | SluitInfoBoodschapCmd
  | SluitPanelenCmd
  | StopTransparantieBewerkingCmd
  | StopVectorFilterBewerkingCmd
  | StopVectorlaagstijlBewerkingCmd
  | SubscribeCmd<Msg>
  | ToonAchtergrondKeuzeCmd<Msg>
  | ToonInfoBoodschapCmd
  | ToonMeldingCmd
  | UnsubscribeCmd
  | VeranderExtentCmd
  | VeranderMiddelpuntCmd
  | VeranderRotatieCmd
  | VeranderLaagtabelinstellingenCmd
  | VeranderViewportCmd
  | VeranderZoomCmd<Msg>
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
  | VraagCachedFeaturesLookupCmd<Msg>
  | VraagSchaalAanCmd<Msg>
  | VulCacheVoorNosqlLaag<Msg>
  | VulCacheVoorWMSLaag<Msg>
  | ZetActieveModusCmd
  | ZetDataloadBusyCmd
  | ZetFilter<Msg>
  | ZetFocusOpKaartCmd
  | ZetForceProgressBarCmd
  | ZetGetekendeGeometryCmd
  | ZetLaagLegendeCmd<Msg>
  | ZetLaagSelecteerbaarCmd<Msg>
  | ZetMijnLocatieZoomCmd
  | ZetOffline<Msg>
  | ZetStijlSpecVoorLaagCmd<Msg>
  | ZetStijlVoorLaagCmd<Msg>
  | ZetTabeltoestandCmd
  | ZetTransparantieVoorLaagCmd<Msg>
  | ZetUiElementOpties
  | ZetZoomBereikCmd
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

export interface VeranderLaagtabelinstellingenCmd {
  readonly type: "VeranderLaagtabelinstellingen";
  readonly instellingen: Laagtabelinstellingen;
}

export interface VoegLaagToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegLaagToe";
  readonly positie: number;
  readonly laag: ke.Laag;
  readonly magGetoondWorden: boolean;
  readonly transparantie: Transparantie;
  readonly laaggroep: ke.Laaggroep;
  readonly legende: Option<Legende>;
  readonly stijlInLagenKiezer: Option<string>;
  readonly filterinstellingen: Option<ke.Laagfilterinstellingen>;
  readonly laagtabelinstellingen: Option<Laagtabelinstellingen>;
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

export interface ActiveerCacheVoorLaag<Msg extends KaartMsg> {
  readonly type: "ActiveerCacheVoorLaag";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VulCacheVoorWMSLaag<Msg extends KaartMsg> {
  readonly type: "VulCacheVoorWMSLaag";
  readonly titel: string;
  readonly startZoom: number;
  readonly eindZoom: number;
  readonly wkt: string;
  readonly startMetLegeCache: boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VulCacheVoorNosqlLaag<Msg extends KaartMsg> {
  readonly type: "VulCacheVoorNosqlLaag";
  readonly titel: string;
  readonly wkt: string;
  readonly startMetLegeCache: boolean;
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

export interface VeranderMiddelpuntCmd {
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

export interface VeranderRotatieCmd {
  readonly type: "VeranderRotatie";
  readonly rotatie: number;
  readonly animationDuration: Option<number>;
}

export interface VeranderViewportCmd {
  readonly type: "VeranderViewport";
  readonly size: [number | undefined, number | undefined];
}

export interface ZetFocusOpKaartCmd {
  readonly type: "FocusOpKaart";
}

export interface VerliesFocusOpKaartCmd {
  readonly type: "VerliesFocusOpKaart";
}

export interface HighlightFeaturesCmd<Msg extends KaartMsg> {
  readonly type: "HighlightFeatures";
  readonly titel: string;
  readonly selector: (feature: ol.Feature) => boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface VervangFeaturesCmd<Msg extends KaartMsg> {
  readonly type: "VervangFeatures";
  readonly titel: string;
  readonly features: ol.Feature[];
  readonly wrapper: BareValidationWrapper<Msg>;
}

// single: altijd maar 1 element geselecteerd
// singleClosest: zoals single, maar selecteert de feature dichtst bij de klik. Minder performant.
// multipleKlik: een klik voegt een element toe aan de selectie
// multipleShift: een shift-klik voegt een element toe aan de selectie
export type SelectieModus = "single" | "singleQuick" | "multipleKlik" | "multipleShift" | "none";

export interface ActiveerSelectieModusCmd {
  readonly type: "ActiveerSelectieModus";
  readonly selectieModus: SelectieModus;
}

export interface DeactiveerSelectieModusCmd {
  readonly type: "DeactiveerSelectieModus";
}

export interface ReactiveerSelectieModusCmd {
  readonly type: "ReactiveerSelectieModus";
}

export type HoverModus = "on" | "off";

export interface ActiveerHoverModusCmd {
  readonly type: "ActiveerHoverModus";
  readonly hoverModus: HoverModus;
}

export type HighlightModus = "on" | "off";

export interface ActiveerHighlightModusCmd {
  readonly type: "ActiveerHighlightModus";
  readonly highlightModus: HighlightModus;
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

export interface ZetLaagSelecteerbaarCmd<Msg extends KaartMsg> {
  readonly type: "ZetLaagSelecteerbaar";
  readonly titel: string;
  readonly selecteerbaar: boolean;
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

export interface ToonMeldingCmd {
  readonly type: "ToonMelding";
  readonly meldingen: string[];
}

export interface VoegZoekerToeCmd<Msg extends KaartMsg> {
  readonly type: "VoegZoekerToe";
  readonly zoekerPrioriteit: ZoekerMetWeergaveopties;
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

export interface ZetOffline<Msg extends KaartMsg> {
  readonly type: "ZetOffline";
  readonly titel: string;
  readonly offline: boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ZetFilter<Msg extends KaartMsg> {
  readonly type: "ZetFilter";
  readonly titel: string;
  readonly filter: fltr.Filter;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface ActiveerFilter<Msg extends KaartMsg> {
  readonly type: "ActiveerFilter";
  readonly titel: string;
  readonly actief: boolean;
  readonly wrapper: BareValidationWrapper<Msg>;
}

export interface HaalFilterTotaalOp<Msg extends KaartMsg> {
  readonly type: "HaalFilterTotaalOp";
  readonly titel: string;
  readonly wrapper: BareValidationWrapper<Msg>;
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
  readonly overlays: ol.Overlay[];
}

export interface ToonInfoBoodschapCmd {
  readonly type: "ToonInfoBoodschap";
  readonly boodschap: InfoBoodschap;
}

export interface PublishKaartLocatiesCmd {
  readonly type: "PublishKaartLocaties";
  readonly locaties: KaartLocaties;
}

export interface VerbergInfoBoodschapCmd {
  readonly type: "VerbergInfoBoodschap";
  readonly id: string;
}

export interface ZetGetekendeGeometryCmd {
  readonly type: "ZetGetekendeGeometry";
  readonly geometry: ol.geom.Geometry;
}

export interface UiElementOpties {
  readonly naam: string;
  readonly opties: any;
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
  readonly opties: OptiesRecord;
  readonly initOnly: boolean; // zet enkel indien opties voor deze selector nog niet gezet is
}

export interface ZetDataloadBusyCmd {
  readonly type: "ZetDataloadBusy";
  readonly busy: boolean;
}

export interface ZetForceProgressBarCmd {
  readonly type: "ZetForceProgressBar";
  readonly busy: boolean;
}

export interface RegistreerErrorCmd {
  readonly type: "RegistreerError";
  readonly inError: boolean;
}

// De features zullen "geselecteerd" worden, ook al zouden ze geen onderdeel uitmaken van één van de lagen. Het is dus de
// verantwoordelijkheid van de zender om enkel feature mee te geven die zichtbaar zijn.
// De gegeven features vervangen enkel de eventueel reeds geselecteerde features indien incremental op false staat.
// Indien incremental true is wordt de nieuwe met de bestaande selectie gecombineerd.
export interface SelecteerFeaturesCmd {
  readonly type: "SelecteerFeatures";
  readonly features: ol.Feature[];
  readonly incremental: boolean;
}

export interface DeselecteerFeatureCmd {
  readonly type: "DeselecteerFeature";
  readonly ids: string[];
}

export interface DeselecteerAlleFeaturesCmd {
  readonly type: "DeselecteerAlleFeatures";
}

export interface SluitInfoBoodschapCmd {
  readonly type: "SluitInfoBoodschap";
  readonly id: string;
  readonly sluit: boolean;
  readonly msgGen: () => Option<TypedRecord>;
}

export interface SluitPanelenCmd {
  readonly type: "SluitPanelen";
}

export interface VoegLaagLocatieInformatieServiceToe {
  readonly type: "VoegLaagLocatieInformatieServiceToe";
  readonly titel: string;
  readonly service: LaagLocationInfoService;
  readonly msgGen: BareValidationWrapper<TypedRecord>;
}

// Er kan maar 1 Vectorlaagstijl per keer bewerk worden. Indien meer gewenst, moet een msgGen met daarin handle opgegeven worden.
export interface BewerkVectorlaagstijlCmd {
  readonly type: "BewerkVectorlaagstijl";
  readonly laag: ke.ToegevoegdeVectorLaag;
}

export interface BewerkVectorFilterCmd {
  readonly type: "BewerkVectorFilter";
  readonly laag: ke.ToegevoegdeVectorLaag;
}

export interface StopVectorlaagstijlBewerkingCmd {
  readonly type: "StopVectorlaagstijlBewerking";
}

export interface StopVectorFilterBewerkingCmd {
  readonly type: "StopVectorFilterBewerking";
}

export interface BewerkTransparantieCmd {
  readonly type: "BewerkTransparantie";
  readonly laag: ke.ToegevoegdeLaag;
}

export interface StopTransparantieBewerkingCmd {
  readonly type: "StopTransparantieBewerking";
}

export interface DrawOpsCmd {
  readonly type: "DrawOps";
  readonly ops: DrawOps;
}

export interface VraagCachedFeaturesLookupCmd<Msg extends TypedRecord> {
  readonly type: "VraagCachedFeaturesLookup";
  readonly titel: string;
  readonly msgGen: ValidationWrapper<CachedFeatureLookup, Msg>;
}

export interface MijnLocatieStateChangeCmd {
  readonly type: "MijnLocatieStateChange";
  readonly oudeState: loc.State;
  readonly nieuweState: loc.State;
  readonly event: loc.Event;
}

export interface ZetTabeltoestandCmd {
  readonly type: "ZetTabeltoestand";
  readonly toestand: TabelActiviteit;
}

export interface ZetTransparantieVoorLaagCmd<Msg extends TypedRecord> {
  readonly type: "ZetTransparantieVoorLaag";
  readonly titel: string;
  readonly transparantie: Transparantie;
  readonly msgGen: BareValidationWrapper<Msg>;
}

export interface ZetZoomBereikCmd {
  readonly type: "ZetZoomBereik";
  readonly minZoom: number;
  readonly maxZoom: number;
}

////////////////////////
// constructor functies
//

export function VoegStandaardInteractiesToeCmd<Msg extends KaartMsg>(
  scrollZoomOnFocus: boolean,
  rotatie: boolean,
  wrapper: BareValidationWrapper<Msg>
): VoegStandaardInteractiesToeCmd<Msg> {
  return { type: "VoegStandaardInteractiesToe", scrollZoomOnFocus, rotatie, wrapper };
}

export function VerwijderStandaardInteractiesCmd<Msg extends KaartMsg>(
  wrapper: BareValidationWrapper<Msg>
): VerwijderStandaardInteractiesCmd<Msg> {
  return { type: "VerwijderStandaardInteracties", wrapper };
}

export function VoegLaagToeCmd<Msg extends KaartMsg>(
  positie: number,
  laag: ke.Laag,
  magGetoondWorden: boolean,
  transparantie: Transparantie,
  laaggroep: ke.Laaggroep,
  legende: Option<Legende>,
  stijlInLagenKiezer: Option<string>,
  filterinstellingen: Option<ke.Laagfilterinstellingen>,
  laagtabelinstellingen: Option<Laagtabelinstellingen>,
  wrapper: BareValidationWrapper<Msg>
): VoegLaagToeCmd<Msg> {
  return {
    type: "VoegLaagToe",
    positie,
    laag,
    magGetoondWorden,
    transparantie,
    laaggroep,
    legende,
    stijlInLagenKiezer,
    filterinstellingen,
    laagtabelinstellingen,
    wrapper
  };
}

export function ActiveerCacheVoorLaag<Msg extends KaartMsg>(
  titel: string,
  wrapper: BareValidationWrapper<Msg>
): ActiveerCacheVoorLaag<Msg> {
  return { type: "ActiveerCacheVoorLaag", titel, wrapper };
}

export function VulCacheVoorWMSLaag<Msg extends KaartMsg>(
  titel: string,
  startZoom: number,
  eindZoom: number,
  wkt: string,
  startMetLegeCache: boolean,
  wrapper: BareValidationWrapper<Msg>
): VulCacheVoorWMSLaag<Msg> {
  return { type: "VulCacheVoorWMSLaag", titel, startZoom, eindZoom, wkt: wkt, startMetLegeCache, wrapper };
}

export function VulCacheVoorNosqlLaag<Msg extends KaartMsg>(
  titel: string,
  wkt: string,
  startMetLegeCache: boolean,
  wrapper: BareValidationWrapper<Msg>
): VulCacheVoorNosqlLaag<Msg> {
  return { type: "VulCacheVoorNosqlLaag", titel, wkt, startMetLegeCache, wrapper };
}

export function ZetOffline<Msg extends KaartMsg>(titel: string, offline: boolean, wrapper: BareValidationWrapper<Msg>): ZetOffline<Msg> {
  return { type: "ZetOffline", titel, offline, wrapper };
}

export function VerwijderLaagCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): VerwijderLaagCmd<Msg> {
  return { type: "VerwijderLaag", titel, wrapper };
}

export function VerplaatsLaagCmd<Msg extends KaartMsg>(
  titel: string,
  naarPositie: number,
  wrapper: BareValidationWrapper<Msg>
): VerplaatsLaagCmd<Msg> {
  return { type: "VerplaatsLaag", titel, naarPositie, wrapper };
}

export function VraagSchaalAanCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VraagSchaalAanCmd<Msg> {
  return { type: "VraagSchaalAan", wrapper };
}

export function ZetFilter<Msg extends KaartMsg>(titel: string, filter: fltr.Filter, wrapper: BareValidationWrapper<Msg>): ZetFilter<Msg> {
  return { type: "ZetFilter", titel, filter, wrapper };
}

export function ActiveerFilter<Msg extends KaartMsg>(
  titel: string,
  actief: boolean,
  wrapper: BareValidationWrapper<Msg>
): ActiveerFilter<Msg> {
  return { type: "ActiveerFilter", titel, actief, wrapper };
}

export function HaalFilterTotaalOp<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): HaalFilterTotaalOp<Msg> {
  return { type: "HaalFilterTotaalOp", titel, wrapper };
}

export function VoegSchaalToeCmd<Msg extends KaartMsg>(
  target: Option<Element>,
  wrapper: BareValidationWrapper<Msg>
): VoegSchaalToeCmd<Msg> {
  return { type: "VoegSchaalToe", target, wrapper };
}

export function VerwijderSchaalCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VerwijderSchaalCmd<Msg> {
  return { type: "VerwijderSchaal", wrapper };
}

export function ZetStijlVoorLaagCmd<Msg extends KaartMsg>(
  titel: string,
  stijl: ss.StyleSelector,
  selectieStijl: Option<ss.StyleSelector>,
  wrapper: BareValidationWrapper<Msg>
): ZetStijlVoorLaagCmd<Msg> {
  return { type: "ZetStijlVoorLaag", stijl, selectieStijl, titel, wrapper };
}

export function ZetStijlSpecVoorLaagCmd<Msg extends KaartMsg>(
  titel: string,
  stijlSpec: ss.AwvV0StyleSpec,
  legende: Legende,
  wrapper: BareValidationWrapper<Msg>
): ZetStijlSpecVoorLaagCmd<Msg> {
  return { type: "ZetStijlSpecVoorLaag", stijlSpec, legende, titel, wrapper };
}

export function VeranderMiddelpuntCmd<Msg extends KaartMsg>(
  coordinate: ol.Coordinate,
  animationDuration: Option<number>
): VeranderMiddelpuntCmd {
  return { type: "VeranderMiddelpunt", coordinate, animationDuration };
}

export function VeranderZoomCmd<Msg extends KaartMsg>(zoom: number, wrapper: BareValidationWrapper<Msg>): VeranderZoomCmd<Msg> {
  return { type: "VeranderZoom", zoom, wrapper };
}

export function VeranderRotatieCmd(rotatie: number, animationDuration: Option<number>): VeranderRotatieCmd {
  return { type: "VeranderRotatie", rotatie, animationDuration };
}

export function VeranderExtentCmd(extent: ol.Extent): VeranderExtentCmd {
  return { type: "VeranderExtent", extent };
}

export function VeranderLaagtabelinstellingenCmd(instellingen: Laagtabelinstellingen): VeranderLaagtabelinstellingenCmd {
  return { type: "VeranderLaagtabelinstellingen", instellingen };
}

export function RegistreerErrorCmd(inError: boolean): RegistreerErrorCmd {
  return { type: "RegistreerError", inError };
}

export function ZetDataloadBusyCmd(busy: boolean): ZetDataloadBusyCmd {
  return { type: "ZetDataloadBusy", busy };
}

export function ZetForceProgressBarCmd(busy: boolean): ZetForceProgressBarCmd {
  return { type: "ZetForceProgressBar", busy };
}

export function ZoekGekliktCmd(resultaat: ZoekResultaat): ZoekGekliktCmd {
  return { type: "ZoekGeklikt", resultaat };
}

export function VeranderViewportCmd(size: [number | undefined, number | undefined]): VeranderViewportCmd {
  return { type: "VeranderViewport", size };
}

export function AbortTileLoadingCmd(): AbortTileLoadingCmd {
  return { type: "AbortTileLoading" };
}

export function HighlightFeaturesCmd<Msg extends KaartMsg>(
  titel: string,
  selector: (feature: ol.Feature) => boolean,
  wrapper: BareValidationWrapper<Msg>
): HighlightFeaturesCmd<Msg> {
  return { type: "HighlightFeatures", titel, selector, wrapper };
}

export function VervangFeaturesCmd<Msg extends KaartMsg>(
  titel: string,
  features: ol.Feature[],
  wrapper: BareValidationWrapper<Msg>
): VervangFeaturesCmd<Msg> {
  return { type: "VervangFeatures", titel, features, wrapper };
}

export function ActiveerSelectieModusCmd(selectieModus: SelectieModus): ActiveerSelectieModusCmd {
  return { type: "ActiveerSelectieModus", selectieModus };
}

export function DeactiveerSelectieModusCmd(): DeactiveerSelectieModusCmd {
  return { type: "DeactiveerSelectieModus" };
}

export function ReactiveerSelectieModusCmd(): ReactiveerSelectieModusCmd {
  return { type: "ReactiveerSelectieModus" };
}

export function ActiveerHighlightModusCmd(highlightModus: HighlightModus): ActiveerHighlightModusCmd {
  return { type: "ActiveerHighlightModus", highlightModus };
}

export function ActiveerHoverModusCmd(hoverModus: HoverModus): ActiveerHoverModusCmd {
  return { type: "ActiveerHoverModus", hoverModus };
}

export function ToonMeldingCmd(meldingen: string[]): ToonMeldingCmd {
  return { type: "ToonMelding", meldingen };
}

export function KiesAchtergrondCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): KiesAchtergrondCmd<Msg> {
  return { type: "KiesAchtergrond", titel, wrapper };
}

export function MaakLaagZichtbaarCmd<Msg extends KaartMsg>(titel: string, wrapper: BareValidationWrapper<Msg>): MaakLaagZichtbaarCmd<Msg> {
  return { type: "MaakLaagZichtbaar", titel, wrapper };
}

export function MaakLaagOnzichtbaarCmd<Msg extends KaartMsg>(
  titel: string,
  wrapper: BareValidationWrapper<Msg>
): MaakLaagOnzichtbaarCmd<Msg> {
  return { type: "MaakLaagOnzichtbaar", titel, wrapper };
}

export function ZetLaagSelecteerbaarCmd<Msg extends KaartMsg>(
  titel: string,
  selecteerbaar: boolean,
  wrapper: BareValidationWrapper<Msg>
): ZetLaagSelecteerbaarCmd<Msg> {
  return { type: "ZetLaagSelecteerbaar", titel, selecteerbaar, wrapper };
}

export function ToonAchtergrondKeuzeCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): ToonAchtergrondKeuzeCmd<Msg> {
  return { type: "ToonAchtergrondKeuze", wrapper };
}

export function VerbergAchtergrondKeuzeCmd<Msg extends KaartMsg>(wrapper: BareValidationWrapper<Msg>): VerbergAchtergrondKeuzeCmd<Msg> {
  return { type: "VerbergAchtergrondKeuze", wrapper };
}

export function VoegInteractieToeCmd(interactie: ol.interaction.Pointer): VoegInteractieToeCmd {
  return { type: "VoegInteractieToe", interactie };
}

export function VerwijderInteractieCmd(interactie: ol.interaction.Pointer): VerwijderInteractieCmd {
  return { type: "VerwijderInteractie", interactie };
}

export function VoegOverlayToeCmd(overlay: ol.Overlay): VoegOverlayToeCmd {
  return { type: "VoegOverlayToe", overlay };
}

export function VerwijderOverlaysCmd(overlays: ol.Overlay[]): VerwijderOverlaysCmd {
  return { type: "VerwijderOverlays", overlays };
}

export function SubscribeCmd<Msg extends KaartMsg>(
  subscription: Subscription<Msg>,
  wrapper: ValidationWrapper<SubscriptionResult, Msg>
): SubscribeCmd<Msg> {
  return { type: "Subscription", subscription, wrapper };
}

export function UnsubscribeCmd(subscriptionResult: SubscriptionResult): UnsubscribeCmd {
  return { type: "Unsubscription", subscriptionResult };
}

export function ZetMijnLocatieZoomCmd(doelniveau: Option<number>): ZetMijnLocatieZoomCmd {
  return { type: "ZetMijnLocatieZoomStatus", doelniveau };
}

export function ZetActieveModusCmd(modus: Option<string>): ZetActieveModusCmd {
  return { type: "ZetActieveModus", modus };
}

export function ToonInfoBoodschapCmd<Bdschp extends InfoBoodschap>(boodschap: Bdschp): ToonInfoBoodschapCmd {
  return { type: "ToonInfoBoodschap", boodschap };
}

export function PublishKaartLocatiesCmd(locaties: KaartLocaties): PublishKaartLocatiesCmd {
  return { type: "PublishKaartLocaties", locaties };
}

export function VerbergInfoBoodschapCmd(id: string): VerbergInfoBoodschapCmd {
  return { type: "VerbergInfoBoodschap", id };
}

export function VoegUiElementToe(naam: string): VoegUiElementToe {
  return { type: "VoegUiElementToe", naam };
}

export function VerwijderUiElement(naam: string): VerwijderUiElement {
  return { type: "VerwijderUiElement", naam };
}

export function ZetUiElementOpties(naam: string, opties: OptiesRecord): ZetUiElementOpties {
  return { type: "ZetUiElementOpties", naam, opties, initOnly: false };
}

export function InitUiElementOpties(naam: string, opties: any): ZetUiElementOpties {
  return { type: "ZetUiElementOpties", naam, opties, initOnly: true };
}

export function SelecteerFeaturesCmd(features: ol.Feature[]): SelecteerFeaturesCmd {
  return { type: "SelecteerFeatures", features, incremental: false };
}

export function SelecteerExtraFeaturesCmd(features: ol.Feature[]): SelecteerFeaturesCmd {
  return { type: "SelecteerFeatures", features, incremental: true };
}

export function DeselecteerFeatureCmd(ids: string[]): DeselecteerFeatureCmd {
  return { type: "DeselecteerFeature", ids };
}

export function DeselecteerAlleFeaturesCmd(): DeselecteerAlleFeaturesCmd {
  return { type: "DeselecteerAlleFeatures" };
}

export function SluitInfoBoodschapCmd(id: string, sluit: boolean, msgGen: () => Option<TypedRecord>): SluitInfoBoodschapCmd {
  return { type: "SluitInfoBoodschap", id, sluit, msgGen };
}

export function SluitPanelenCmd(): SluitPanelenCmd {
  return { type: "SluitPanelen" };
}

export function ZetLaagLegendeCmd<Msg extends KaartMsg>(
  titel: string,
  legende: Legende,
  wrapper: BareValidationWrapper<Msg>
): ZetLaagLegendeCmd<Msg> {
  return { type: "ZetLaagLegende", titel, legende, wrapper };
}

export function VoegZoekerToeCmd<Msg extends KaartMsg>(
  zoeker: ZoekerMetWeergaveopties,
  wrapper: BareValidationWrapper<Msg>
): VoegZoekerToeCmd<Msg> {
  return { type: "VoegZoekerToe", zoekerPrioriteit: zoeker, wrapper };
}

export function VoegLaagLocatieInformatieServiceToe(
  titel: string,
  service: LaagLocationInfoService,
  msgGen: BareValidationWrapper<TypedRecord>
): VoegLaagLocatieInformatieServiceToe {
  return { type: "VoegLaagLocatieInformatieServiceToe", titel, service, msgGen };
}

export function BewerkVectorlaagstijlCmd(laag: ke.ToegevoegdeVectorLaag): BewerkVectorlaagstijlCmd {
  return { type: "BewerkVectorlaagstijl", laag };
}

export function BewerkVectorFilterCmd(laag: ke.ToegevoegdeVectorLaag): BewerkVectorFilterCmd {
  return { type: "BewerkVectorFilter", laag };
}

export function StopVectorlaagstijlBewerkingCmd(): StopVectorlaagstijlBewerkingCmd {
  return { type: "StopVectorlaagstijlBewerking" };
}

export function StopVectorFilterBewerkingCmd(): StopVectorFilterBewerkingCmd {
  return { type: "StopVectorFilterBewerking" };
}

export function BewerkTransparantieCmd(laag: ke.ToegevoegdeLaag): BewerkTransparantieCmd {
  return { type: "BewerkTransparantie", laag };
}

export function StopTransparantieBewerkingCmd(): StopTransparantieBewerkingCmd {
  return { type: "StopTransparantieBewerking" };
}

export function DrawOpsCmd(ops: DrawOps): DrawOpsCmd {
  return { type: "DrawOps", ops };
}

export function ZetGetekendeGeometryCmd(geometry: ol.geom.Geometry): ZetGetekendeGeometryCmd {
  return { type: "ZetGetekendeGeometry", geometry };
}

export function VraagCachedFeaturesLookupCmd<Msg extends TypedRecord>(
  titel: string,
  msgGen: ValidationWrapper<CachedFeatureLookup, Msg>
): VraagCachedFeaturesLookupCmd<Msg> {
  return { type: "VraagCachedFeaturesLookup", titel, msgGen };
}

export function MijnLocatieStateChangeCmd(oudeState: loc.State, nieuweState: loc.State, event: loc.Event): MijnLocatieStateChangeCmd {
  return { type: "MijnLocatieStateChange", oudeState, nieuweState, event };
}

export function ZoekCmd<Msg extends KaartMsg>(opdracht: Zoekopdracht, wrapper: BareValidationWrapper<Msg>): ZoekCmd<Msg> {
  return { type: "Zoek", opdracht, wrapper };
}

export function ZetTransparantieVoorLaagCmd<Msg extends TypedRecord>(
  titel: string,
  transparantie: Transparantie,
  msgGen: BareValidationWrapper<Msg>
): ZetTransparantieVoorLaagCmd<Msg> {
  return { type: "ZetTransparantieVoorLaag", titel, transparantie, msgGen };
}

export function ZetZoomBereikCmd(minZoom: number, maxZoom: number): ZetZoomBereikCmd {
  return { type: "ZetZoomBereik", minZoom, maxZoom };
}

export function OpenTabelCmd(): ZetTabeltoestandCmd {
  return { type: "ZetTabeltoestand", toestand: "Opengeklapt" };
}

export function SluitTabelCmd(): ZetTabeltoestandCmd {
  return { type: "ZetTabeltoestand", toestand: "Dichtgeklapt" };
}

export function PlaatsTabelInSluimertoestandCmd(): ZetTabeltoestandCmd {
  return { type: "ZetTabeltoestand", toestand: "Sluimerend" };
}
