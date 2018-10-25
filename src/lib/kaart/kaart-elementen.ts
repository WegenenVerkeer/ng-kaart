import { fromPredicate, Option } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as ol from "openlayers";

import { Legende } from "./kaart-legende";
import { StyleSelector } from "./stijl-selector";

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
  readonly urls: List<string>;
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
  readonly urls: List<string>;
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

export interface VeldInfo {
  label: string;
  type: string;
  isBasisVeld: boolean;
  constante: string;
  template: string;
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly source: ol.source.Vector;
  readonly titel: string;
  readonly styleSelector: Option<StyleSelector>;
  readonly selectieStyleSelector: Option<StyleSelector>;
  readonly hoverStyleSelector: Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly hover: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly velden: OrderedMap<string, VeldInfo>;
  readonly offsetveld: Option<string>;
  readonly verwijderd: boolean;
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
  readonly laagStyle: Option<StyleSelector>;
  readonly drawStyle: Option<StyleSelector>;
  readonly meerdereGeometrieen: boolean;
}

export interface TekenResultaat {
  readonly geometry: ol.geom.Geometry;
  readonly volgnummer: number;
  readonly featureId: number | string;
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
  readonly stijlInLagenKiezer: Option<string>;
}

export interface ToegevoegdeVectorLaag extends ToegevoegdeLaag {
  readonly bron: VectorLaag;
  readonly layer: ol.layer.Vector;
  readonly stijlPositie: number; // We gaan er van uit dat alle vectorlagen in dezelfde groep zitten!
  readonly stijlSel: Option<StyleSelector>;
  readonly selectiestijlSel: Option<StyleSelector>;
  readonly hoverstijlSel: Option<StyleSelector>;
}

export const isWmsLaag: (laag: Laag) => boolean = laag => laag.type === SingleTileWmsType || laag.type === TiledWmsType;
export const isBlancoLaag: (laag: Laag) => boolean = laag => laag.type === BlancoType;
export const isVectorLaag: (laag: Laag) => boolean = laag => laag.type === VectorType;
export const isNoSqlFsLaag: (laag: Laag) => boolean = laag => laag.type === VectorType && laag.source.hasOwnProperty("loadEvent$");
export const asVectorLaag: (laag: Laag) => Option<VectorLaag> = fromPredicate(isVectorLaag) as (_: Laag) => Option<VectorLaag>;
export const isToegevoegdeVectorLaag: (laag: ToegevoegdeLaag) => boolean = laag => isVectorLaag(laag.bron);
export const asToegevoegdeVectorLaag: (laag: ToegevoegdeLaag) => Option<ToegevoegdeVectorLaag> = laag =>
  fromPredicate<ToegevoegdeLaag>(lg => isVectorLaag(lg.bron))(laag) as Option<ToegevoegdeVectorLaag>;
export const isZichtbaar: (_: number) => (_: ToegevoegdeLaag) => boolean = currentRes => laag =>
  laag.layer.getMinResolution() <= currentRes && laag.layer.getMaxResolution() > currentRes && laag.layer.getVisible();

///////////////
// Constructors
//

export function TekenSettings(
  geometryType: ol.geom.GeometryType,
  laagStyle: Option<StyleSelector>,
  drawStyle: Option<StyleSelector>,
  meerdereGeometrieen: boolean
): TekenSettings {
  return {
    geometryType: geometryType,
    laagStyle: laagStyle,
    drawStyle: drawStyle,
    meerdereGeometrieen: meerdereGeometrieen
  };
}

export function TekenResultaat(geometry: ol.geom.Geometry, volgnummer: number, featureId: number | string): TekenResultaat {
  return {
    volgnummer: volgnummer,
    featureId: featureId,
    geometry: geometry
  };
}
