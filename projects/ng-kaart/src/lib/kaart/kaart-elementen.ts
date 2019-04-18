import * as array from "fp-ts/lib/Array";
import { Function1, Refinement } from "fp-ts/lib/function";
import { fromPredicate, Option } from "fp-ts/lib/Option";
import { contramap, Setoid, setoidString } from "fp-ts/lib/Setoid";
import { Iso, Lens, Optional } from "monocle-ts";
import * as ol from "openlayers";

import { Filter } from "../filter/filter-model";
import { isNoSqlFsSource, NosqlFsSource } from "../source/nosql-fs-source";
import { mapToOptionalByKey } from "../util/lenses";

import { Legende } from "./kaart-legende";
import { AwvV0StyleSpec, StyleSelector } from "./stijl-selector";
import { VeldProps } from "./stijleditor/model";

export const SingleTileWmsType = "LaagType.SingleTileWms";
export type SingleTileWmsType = typeof SingleTileWmsType;
export const TiledWmsType = "LaagType.TiledWms";
export type TiledWmsType = typeof TiledWmsType;
export const WmtsType = "LaagType.Wmts";
export type WmtsType = typeof WmtsType;
export const VectorType = "LaagType.Vector";
export type VectorType = typeof VectorType;
export const BlancoType = "LaagType.Blanco";
export type BlancoType = typeof BlancoType;
export type LaagType = SingleTileWmsType | TiledWmsType | WmtsType | VectorType | BlancoType;

export type AchtergrondLaag = WmsLaag | WmtsLaag | BlancoLaag;

export type Laaggroep = "Achtergrond" | "Voorgrond.Hoog" | "Voorgrond.Laag" | "Tools";

export type Laag = WmsLaag | WmtsLaag | VectorLaag | BlancoLaag;

export interface WmsLaag {
  readonly type: SingleTileWmsType | TiledWmsType;
  readonly titel: string;
  readonly naam: string;
  readonly backgroundUrl: string;
  readonly urls: Array<string>;
  readonly versie: Option<string>;
  readonly tileSize: Option<number>;
  readonly format: Option<string>;
  readonly opacity: Option<number>;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
}

export interface WmtsCapaConfig {
  readonly type: "Capa";
  readonly url: string;
  readonly wmtsOptions: ol.olx.source.WMTSOptions;
}

export interface WmtsManualConfig {
  readonly type: "Manual";
  readonly urls: Array<string>;
  readonly style: Option<string>;
  readonly matrixIds: string[];
  readonly origin: Option<ol.Coordinate>;
  readonly extent: Option<ol.Extent>;
}

export interface WmtsLaag {
  readonly type: WmtsType;
  readonly titel: string;
  readonly naam: string;
  readonly backgroundUrl: string;
  readonly opacity: Option<number>;
  readonly versie: Option<string>;
  readonly format: Option<string>;
  readonly matrixSet: string;
  readonly config: WmtsCapaConfig | WmtsManualConfig;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
}

export type VeldType = "string" | "integer" | "double" | "geometry" | "date" | "datetime" | "boolean" | "json";

export interface VeldInfo {
  readonly naam: string; // naam zoals gekend in de feature
  readonly label: string; // titel om weer te geven in de UI
  readonly type: VeldType;
  readonly isBasisVeld: boolean;
  readonly constante?: string;
  readonly template?: string;
  readonly html?: string;
  readonly uniekeWaarden?: string[];
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly source: ol.source.Vector;
  readonly titel: string;
  readonly styleSelector: Option<StyleSelector>;
  readonly styleSelectorBron: Option<AwvV0StyleSpec>; // De JSON specificatie die aan de basis ligt van de StyleSelector
  readonly selectieStyleSelector: Option<StyleSelector>;
  readonly hoverStyleSelector: Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly hover: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly velden: Map<string, VeldInfo>;
  readonly offsetveld: Option<string>;
  readonly verwijderd: boolean;
  readonly rijrichtingIsDigitalisatieZin: boolean;
}

export interface BlancoLaag {
  readonly type: BlancoType;
  readonly titel: string;
  readonly backgroundUrl: string;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly verwijderd: boolean;
}

export interface TekenSettings {
  readonly geometryType: ol.geom.GeometryType;
  readonly geometry: Option<ol.geom.Geometry>;
  readonly laagStyle: Option<StyleSelector>;
  readonly drawStyle: Option<StyleSelector>;
  readonly meerdereGeometrieen: boolean;
}

export interface StartTekenen {
  type: "start";
  settings: TekenSettings;
}

export interface StopTekenen {
  type: "stop";
}

export type TekenenCommand = StartTekenen | StopTekenen;

export interface TekenResultaat {
  readonly geometry: ol.geom.Geometry;
  readonly volgnummer: number;
  readonly featureId: number | string;
}

export interface LaagFilterInstellingen {
  readonly spec: Filter;
  readonly actief: boolean;
}

/**
 * Dit is een wrapper rond Laag die naast de laag zelf ook het gebruik van de laag bij houdt.
 */
export interface ToegevoegdeLaag {
  readonly bron: Laag;
  readonly layer: ol.layer.Base;
  readonly titel: string; // copie omdat dit veel gebruikt wordt
  readonly laaggroep: Laaggroep;
  readonly positieInGroep: number;
  readonly magGetoondWorden: boolean;
  readonly legende: Option<Legende>;
  readonly stijlInLagenKiezer: Option<string>; // optionele naam van een CSS klasse om lijn in lagenkiezer individueel te stijlen
}

export interface ToegevoegdeVectorLaag extends ToegevoegdeLaag {
  readonly bron: VectorLaag;
  readonly layer: ol.layer.Vector;
  readonly stijlPositie: number; // We gaan er van uit dat alle vectorlagen in dezelfde groep zitten!
  readonly stijlSel: Option<StyleSelector>;
  readonly stijlSelBron: Option<AwvV0StyleSpec>; // Het JSON document dat aan de basis ligt van de StyleSelector
  readonly selectiestijlSel: Option<StyleSelector>;
  readonly hoverstijlSel: Option<StyleSelector>;
  readonly filterInstellingen: LaagFilterInstellingen;
}

export const isWmsLaag: (laag: Laag) => boolean = laag => laag.type === SingleTileWmsType || laag.type === TiledWmsType;
export const isTiledWmsLaag: (laag: Laag) => boolean = laag => laag.type === TiledWmsType;
export const isBlancoLaag: (laag: Laag) => boolean = laag => laag.type === BlancoType;
export const isVectorLaag: (laag: Laag) => boolean = laag => laag.type === VectorType;
export const isNoSqlFsLaag: (laag: Laag) => boolean = laag => laag.type === VectorType && isNoSqlFsSource(laag.source);
export const asVectorLaag: (laag: Laag) => Option<VectorLaag> = fromPredicate(isVectorLaag) as (_: Laag) => Option<VectorLaag>;
export const asTiledWmsLaag: (laag: Laag) => Option<WmsLaag> = fromPredicate(isTiledWmsLaag) as (_: Laag) => Option<WmsLaag>;
export const isToegevoegdeVectorLaag: Refinement<ToegevoegdeLaag, ToegevoegdeVectorLaag> = (laag): laag is ToegevoegdeVectorLaag =>
  isVectorLaag(laag.bron);
export const asToegevoegdeVectorLaag: (laag: ToegevoegdeLaag) => Option<ToegevoegdeVectorLaag> = laag =>
  fromPredicate<ToegevoegdeLaag>(lg => isVectorLaag(lg.bron))(laag) as Option<ToegevoegdeVectorLaag>;
export const isZichtbaar: (_: number) => (_: ToegevoegdeLaag) => boolean = currentRes => laag =>
  laag.layer.getMinResolution() <= currentRes && laag.layer.getMaxResolution() > currentRes && laag.layer.getVisible();
export const asToegevoegdeNosqlVectorLaag: (laag: ToegevoegdeLaag) => Option<ToegevoegdeVectorLaag> = laag =>
  fromPredicate<ToegevoegdeLaag>(lg => isNoSqlFsLaag(lg.bron))(laag) as Option<ToegevoegdeVectorLaag>;
export const asNosqlSource: (source: ol.source.Vector) => Option<NosqlFsSource> = fromPredicate(isNoSqlFsSource) as (
  _: ol.source.Vector
) => Option<NosqlFsSource>;

///////////////
// Constructors
//

export function TekenSettings(
  geometryType: ol.geom.GeometryType,
  geometry: Option<ol.geom.Geometry>,
  laagStyle: Option<StyleSelector>,
  drawStyle: Option<StyleSelector>,
  meerdereGeometrieen: boolean
): TekenSettings {
  return {
    geometryType: geometryType,
    geometry: geometry,
    laagStyle: laagStyle,
    drawStyle: drawStyle,
    meerdereGeometrieen: meerdereGeometrieen
  };
}

export function StartTekenen(settings: TekenSettings): StartTekenen {
  return {
    type: "start",
    settings: settings
  };
}

export function StopTekenen(): StopTekenen {
  return {
    type: "stop"
  };
}

export function TekenResultaat(geometry: ol.geom.Geometry, volgnummer: number, featureId: number | string): TekenResultaat {
  return {
    volgnummer: volgnummer,
    featureId: featureId,
    geometry: geometry
  };
}

export function LaagFilterInstellingen(spec: Filter, actief: boolean): LaagFilterInstellingen {
  return {
    spec: spec,
    actief: actief
  };
}

////////////////////////////
// Manipulatie en inspectie
//

export namespace ToegevoegdeVectorLaag {
  export const stijlSelBronLens: Optional<ToegevoegdeVectorLaag, AwvV0StyleSpec> = Optional.fromOptionProp<ToegevoegdeVectorLaag>()(
    "stijlSelBron"
  );

  export const veldInfosLens: Lens<ToegevoegdeVectorLaag, VeldInfo[]> = Lens.fromPath<ToegevoegdeVectorLaag, "bron", "velden">([
    "bron",
    "velden"
  ]).composeIso(
    new Iso(
      map => Array.from(map.values()), //
      infos => infos.reduce((m, info) => m.set(info.naam, info), new Map<string, VeldInfo>())
    )
  );

  export const veldInfoOpNaamOptional: Function1<string, Optional<ToegevoegdeVectorLaag, VeldInfo>> = veldnaam =>
    Lens.fromPath<ToegevoegdeVectorLaag, "bron", "velden">(["bron", "velden"]).composeOptional(mapToOptionalByKey(veldnaam));
}

export namespace VeldInfo {
  export const setoidVeldOpNaam: Setoid<VeldInfo> = contramap(vi => vi.naam, setoidString);
}
