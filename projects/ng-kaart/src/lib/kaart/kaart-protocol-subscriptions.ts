import * as array from "fp-ts/lib/Array";
import { Either } from "fp-ts/lib/Either";
import { Curried2, Function1, FunctionN, Predicate } from "fp-ts/lib/function";
import { fromNullable, Option } from "fp-ts/lib/Option";
import { Lens } from "monocle-ts";
import * as ol from "openlayers";

import * as sft from "../stijl/stijl-function-types";
import { Feature } from "../util/feature";
import { ZoekAntwoord, ZoekerMetWeergaveopties, ZoekResultaat } from "../zoeker/zoeker";

import { KaartLocaties } from "./kaart-bevragen/laaginfo.model";
import * as ke from "./kaart-elementen";
import { InfoBoodschap } from "./kaart-with-info-model";
import { LaatsteCacheRefresh, MijnLocatieStateChange, PrecacheLaagProgress, TabelStateChange } from "./model-changes";
import { VeldwaardeKleur } from "./stijleditor/model";

/////////
// Types
//

export type Subscription<Msg> =
  | AchtergrondTitelSubscription<Msg>
  | ActieveModusSubscription<Msg>
  | BusySubscription<Msg>
  | ComponentFoutSubscription<Msg>
  | ExtentSubscription<Msg>
  | GeometryChangedSubscription<Msg>
  | GeselecteerdeFeaturesSubscription<Msg>
  | HoverFeaturesSubscription<Msg>
  | InErrorSubscription<Msg>
  | InfoBoodschappenSubscription<Msg>
  | KaartClickSubscription<Msg>
  | LaagfilterGezetSubscription<Msg>
  | LaagstijlGezetSubscription<Msg>
  | LaagVerwijderdSubscription<Msg>
  | LaatsteCacheRefreshSubscription<Msg>
  | LagenInGroepSubscription<Msg>
  | MiddelpuntSubscription<Msg>
  | MijnLocatieStateChangeSubscription<Msg>
  | PrecacheProgressSubscription<Msg>
  | PublishedKaartLocatiesSubscription<Msg>
  | TabelStateSubscription<Msg>
  | TekenenSubscription<Msg>
  | ForceProgressBarSubscription<Msg>
  | ViewinstellingenSubscription<Msg>
  | ZichtbareFeaturesSubscription<Msg>
  | ZoekersSubscription<Msg>
  | ZoekResultaatSelectieSubscription<Msg>
  | ZoekResultatenSubscription<Msg>
  | ZoomSubscription<Msg>;

export interface Viewinstellingen {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  resolution: number;
  extent: ol.Extent;
  center: ol.Coordinate;
  rotation: number;
}

export interface FeatureSelection {
  features: ol.Collection<ol.Feature>;
  perLaag: Map<string, Set<string>>;
}

export interface GeselecteerdeFeatures {
  readonly geselecteerd: ol.Feature[];
  readonly toegevoegd: ol.Feature[];
  readonly verwijderd: ol.Feature[];
}

export interface HoverFeature {
  hover: Either<ol.Feature, ol.Feature>; // left = unhover, right = hover
}

export type MsgGen<Input, Msg> = Function1<Input, Msg>;

export interface ViewinstellingenSubscription<Msg> {
  readonly type: "Viewinstellingen";
  readonly wrapper: MsgGen<Viewinstellingen, Msg>;
}

export interface ZoomSubscription<Msg> {
  readonly type: "Zoom";
  readonly wrapper: MsgGen<number, Msg>;
}

export interface MiddelpuntSubscription<Msg> {
  readonly type: "Middelpunt";
  readonly wrapper: MsgGen<ol.Coordinate, Msg>;
}

export interface ExtentSubscription<Msg> {
  readonly type: "Extent";
  readonly wrapper: MsgGen<ol.Extent, Msg>;
}

export interface GeselecteerdeFeaturesSubscription<Msg> {
  readonly type: "GeselecteerdeFeatures";
  readonly wrapper: MsgGen<GeselecteerdeFeatures, Msg>;
}

export interface HoverFeaturesSubscription<Msg> {
  readonly type: "HoverFeatures";
  readonly wrapper: MsgGen<HoverFeature, Msg>;
}

export interface ZichtbareFeaturesSubscription<Msg> {
  readonly type: "ZichtbareFeatures";
  readonly wrapper: (zicthbareFeatures: Array<ol.Feature>) => Msg;
}

export interface AchtergrondTitelSubscription<Msg> {
  readonly type: "Achtergrond";
  readonly wrapper: MsgGen<string, Msg>;
}

export interface LagenInGroepSubscription<Msg> {
  readonly type: "LagenInGroep";
  readonly groep: ke.Laaggroep;
  readonly wrapper: (lagen: Array<ke.ToegevoegdeLaag>) => Msg;
}

export interface LaagVerwijderdSubscription<Msg> {
  readonly type: "LaagVerwijderd";
  readonly wrapper: (laag: ke.ToegevoegdeLaag) => Msg;
}

export interface KaartClickSubscription<Msg> {
  readonly type: "KaartClick";
  readonly wrapper: (coordinaat: ol.Coordinate) => Msg;
}

export interface ZoekResultatenSubscription<Msg> {
  readonly type: "ZoekAntwoord";
  readonly wrapper: MsgGen<ZoekAntwoord, Msg>;
}

export interface ZoekersSubscription<Msg> {
  readonly type: "Zoekers";
  readonly wrapper: MsgGen<ZoekerMetWeergaveopties[], Msg>;
}

export interface ZoekResultaatSelectieSubscription<Msg> {
  readonly type: "ZoekResultaatSelectie";
  readonly wrapper: MsgGen<ZoekResultaat, Msg>;
}

export interface ActieveModusSubscription<Msg> {
  readonly type: "ActieveModus";
  readonly wrapper: (modus: Option<string>) => Msg;
}

export interface GeometryChangedSubscription<Msg> {
  readonly type: "GeometryChanged";
  readonly tekenSettings: ke.TekenSettings;
  readonly wrapper: MsgGen<ke.Tekenresultaat, Msg>;
}

export interface TekenenSubscription<Msg> {
  readonly type: "Tekenen";
  readonly wrapper: (settings: Option<ke.TekenSettings>) => Msg;
}

export interface InfoBoodschappenSubscription<Msg> {
  readonly type: "InfoBoodschap";
  readonly wrapper: (infoBoodschappen: Map<string, InfoBoodschap>) => Msg;
}

export interface ComponentFoutSubscription<Msg> {
  readonly type: "ComponentFout";
  readonly wrapper: MsgGen<string[], Msg>;
}

export interface LaagfilterGezetSubscription<Msg> {
  readonly type: "LaagfilterGezet";
  readonly wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>;
}
export interface LaagstijlGezetSubscription<Msg> {
  readonly type: "LaagstijlGezet";
  readonly wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>;
}

export interface PublishedKaartLocatiesSubscription<Msg> {
  readonly type: "PublishedKaartLocaties";
  readonly wrapper: MsgGen<KaartLocaties, Msg>;
}

export interface PrecacheProgressSubscription<Msg> {
  readonly type: "PrecacheProgress";
  readonly wrapper: (progress: PrecacheLaagProgress) => Msg;
}

export interface LaatsteCacheRefreshSubscription<Msg> {
  readonly type: "LaatsteCacheRefresh";
  readonly wrapper: (progress: LaatsteCacheRefresh) => Msg;
}

export interface MijnLocatieStateChangeSubscription<Msg> {
  readonly type: "MijnLocatieStateChange";
  readonly wrapper: (stateChange: MijnLocatieStateChange) => Msg;
}

export interface TabelStateSubscription<Msg> {
  readonly type: "TabelState";
  readonly wrapper: (state: TabelStateChange) => Msg;
}

export interface BusySubscription<Msg> {
  readonly type: "Busy";
  readonly wrapper: MsgGen<boolean, Msg>;
}

export interface ForceProgressBarSubscription<Msg> {
  readonly type: "ForceProgressBar";
  readonly wrapper: MsgGen<boolean, Msg>;
}

export interface InErrorSubscription<Msg> {
  readonly type: "InError";
  readonly wrapper: MsgGen<boolean, Msg>;
}

//////////
// Helpers

export namespace Viewinstellingen {
  export const visible: Predicate<Viewinstellingen> = vi => vi.zoom >= vi.minZoom && vi.zoom <= vi.maxZoom;
}

///////////////
// Constructors
//

export function ViewinstellingenSubscription<Msg>(wrapper: MsgGen<Viewinstellingen, Msg>): ViewinstellingenSubscription<Msg> {
  return { type: "Viewinstellingen", wrapper: wrapper };
}

export function GeselecteerdeFeaturesSubscription<Msg>(
  wrapper: MsgGen<GeselecteerdeFeatures, Msg>
): GeselecteerdeFeaturesSubscription<Msg> {
  return { type: "GeselecteerdeFeatures", wrapper: wrapper };
}

export function FeatureSelection(features: ol.Collection<ol.Feature>, perLaag: Map<string, Set<string>>) {
  return { type: "FeatureSelection", features: features, perLaag: perLaag };
}

export namespace FeatureSelection {
  export const isSelected: Curried2<FeatureSelection, ol.Feature, boolean> = featureSelection => feature => {
    const selectedInLaag = featureSelection.perLaag.get(feature.getProperties()["laagnaam"]);
    return fromNullable(selectedInLaag)
      .getOrElse(new Set<string>())
      .has(Feature.propertyIdRequired(feature));
  };

  export const selectedFeaturesIdsInLaag: Curried2<FeatureSelection, string, Set<string>> = featureSelection => laagnaam => {
    const selectedInLaag = featureSelection.perLaag.get(laagnaam);
    return selectedInLaag || new Set<string>();
  };

  export const deselecteerAlleFeatures: FunctionN<[FeatureSelection], FeatureSelection> = featureSelection => {
    featureSelection.features.clear();
    featureSelection.perLaag.clear();

    // TODO CVF nieuwe versie van immutable model returnen
    return featureSelection;
  };

  export const deselecteerFeatures: Curried2<FeatureSelection, Array<ol.Feature>, FeatureSelection> = featureSelection => features => {
    features.forEach(feature => {
      // we doen de manipulatie per feature, omdat ze van verschillende lagen kunnen zijn
      // performantie zou maybe iets beter kunnen als we ze eerst per laag groeperen en dan in batch toevoegen aan de map / set
      const laagnaam = feature.getProperties()["laagnaam"];
      const currentSet = fromNullable(featureSelection.perLaag.get(laagnaam)).getOrElse(new Set<string>());
      currentSet.delete(Feature.propertyIdRequired(feature));
      featureSelection.perLaag.set(laagnaam, currentSet);
      featureSelection.features.remove(feature);
    });

    // TODO CVF nieuwe versie van immutable model returnen
    return featureSelection;
  };

  export const selecteerFeatures: Curried2<FeatureSelection, Array<ol.Feature>, FeatureSelection> = featureSelection => features => {
    features.forEach(f => {
      // we doen de manipulatie per feature, omdat ze van verschillende lagen kunnen zijn
      // performantie zou maybe iets beter kunnen als we ze eerst per laag groeperen en dan in batch toevoegen aan de map / set
      const laagnaam = f.getProperties()["laagnaam"];
      const currentSet = fromNullable(featureSelection.perLaag.get(laagnaam)).getOrElse(new Set<string>());
      featureSelection.perLaag.set(laagnaam, currentSet.add(Feature.propertyIdRequired(f)));
    });

    // TODO CVF nieuwe versie van immutable model returnen
    featureSelection.features.extend(features);
    return featureSelection;
  };

  export const getGeselecteerdeFeaturesInLaag: Curried2<FeatureSelection, string, Array<ol.Feature>> = featureSelection => laagnaam => {
    return featureSelection.features.getArray().filter(r => r.getProperties()["laagnaam"] === laagnaam);
  };
}

export function HoverFeaturesSubscription<Msg>(wrapper: MsgGen<HoverFeature, Msg>): HoverFeaturesSubscription<Msg> {
  return { type: "HoverFeatures", wrapper: wrapper };
}

export function ZichtbareFeaturesSubscription<Msg>(
  msgGen: (zichtbareFeatures: Array<ol.Feature>) => Msg
): ZichtbareFeaturesSubscription<Msg> {
  return { type: "ZichtbareFeatures", wrapper: msgGen };
}

export function ZoomSubscription<Msg>(wrapper: MsgGen<number, Msg>): ZoomSubscription<Msg> {
  return { type: "Zoom", wrapper: wrapper };
}

export function MiddelpuntSubscription<Msg>(wrapper: (center: ol.Coordinate) => Msg): MiddelpuntSubscription<Msg> {
  return { type: "Middelpunt", wrapper: wrapper };
}

export function ExtentSubscription<Msg>(wrapper: (extent: ol.Extent) => Msg): ExtentSubscription<Msg> {
  return { type: "Extent", wrapper: wrapper };
}

export function PublishedKaartLocatiesSubscription<Msg>(
  wrapper: (locaties: KaartLocaties) => Msg
): PublishedKaartLocatiesSubscription<Msg> {
  return { type: "PublishedKaartLocaties", wrapper: wrapper };
}

export function AchtergrondTitelSubscription<Msg>(wrapper: MsgGen<string, Msg>): AchtergrondTitelSubscription<Msg> {
  return { type: "Achtergrond", wrapper: wrapper };
}

export function LagenInGroepSubscription<Msg>(
  groep: ke.Laaggroep,
  msgGen: (lagen: Array<ke.ToegevoegdeLaag>) => Msg
): LagenInGroepSubscription<Msg> {
  return { type: "LagenInGroep", groep: groep, wrapper: msgGen };
}

export function LaagVerwijderdSubscription<Msg>(msgGen: (laag: ke.ToegevoegdeLaag) => Msg): LaagVerwijderdSubscription<Msg> {
  return { type: "LaagVerwijderd", wrapper: msgGen };
}

export function ZoekResultatenSubscription<Msg>(wrapper: MsgGen<ZoekAntwoord, Msg>): ZoekResultatenSubscription<Msg> {
  return { type: "ZoekAntwoord", wrapper: wrapper };
}

export function ZoekersSubscription<Msg>(wrapper: MsgGen<ZoekerMetWeergaveopties[], Msg>): ZoekersSubscription<Msg> {
  return { type: "Zoekers", wrapper: wrapper };
}

export function ZoekResultaatSelectieSubscription<Msg>(wrapper: MsgGen<ZoekResultaat, Msg>): ZoekResultaatSelectieSubscription<Msg> {
  return { type: "ZoekResultaatSelectie", wrapper: wrapper };
}

export function KaartClickSubscription<Msg>(wrapper: (coordinaat: ol.Coordinate) => Msg): Subscription<Msg> {
  return { type: "KaartClick", wrapper: wrapper };
}

export function InfoBoodschappenSubscription<Msg>(wrapper: (boodschappen: Map<string, InfoBoodschap>) => Msg): Subscription<Msg> {
  return { type: "InfoBoodschap", wrapper: wrapper };
}

export function GeometryChangedSubscription<Msg>(
  tekenSettings: ke.TekenSettings,
  wrapper: MsgGen<ke.Tekenresultaat, Msg>
): GeometryChangedSubscription<Msg> {
  return { type: "GeometryChanged", tekenSettings: tekenSettings, wrapper: wrapper };
}

export function TekenenSubscription<Msg>(wrapper: (settings: Option<ke.TekenSettings>) => Msg): TekenenSubscription<Msg> {
  return { type: "Tekenen", wrapper: wrapper };
}

export function ActieveModusSubscription<Msg>(wrapper: (modus: Option<string>) => Msg): ActieveModusSubscription<Msg> {
  return { type: "ActieveModus", wrapper: wrapper };
}

export function ComponentFoutSubscription<Msg>(wrapper: (fouten: Array<string>) => Msg): ComponentFoutSubscription<Msg> {
  return {
    type: "ComponentFout",
    wrapper: wrapper
  };
}

export function LaagfilterGezetSubscription<Msg>(wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>): LaagfilterGezetSubscription<Msg> {
  return { type: "LaagfilterGezet", wrapper: wrapper };
}

export function LaagstijlGezetSubscription<Msg>(wrapper: MsgGen<ke.ToegevoegdeVectorLaag, Msg>): LaagstijlGezetSubscription<Msg> {
  return { type: "LaagstijlGezet", wrapper: wrapper };
}

export function PrecacheProgressSubscription<Msg>(wrapper: (progress: PrecacheLaagProgress) => Msg): PrecacheProgressSubscription<Msg> {
  return { type: "PrecacheProgress", wrapper };
}

export function BusySubscription<Msg>(wrapper: (busy: boolean) => Msg): BusySubscription<Msg> {
  return { type: "Busy", wrapper };
}

export function InErrorSubscription<Msg>(wrapper: (inError: boolean) => Msg): InErrorSubscription<Msg> {
  return { type: "InError", wrapper };
}

export function LaatsteCacheRefreshSubscription<Msg>(
  wrapper: (progress: LaatsteCacheRefresh) => Msg
): LaatsteCacheRefreshSubscription<Msg> {
  return { type: "LaatsteCacheRefresh", wrapper };
}

export function MijnLocatieStateChangeSubscription<Msg>(
  wrapper: (stateChange: MijnLocatieStateChange) => Msg
): MijnLocatieStateChangeSubscription<Msg> {
  return { type: "MijnLocatieStateChange", wrapper };
}

export function TabelStateSubscription<Msg>(wrapper: (stateChange: TabelStateChange) => Msg): TabelStateSubscription<Msg> {
  return { type: "TabelState", wrapper };
}
