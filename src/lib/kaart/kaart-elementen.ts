import { fromPredicate, Option } from "fp-ts/lib/Option";
import { List } from "immutable";
import * as ol from "openlayers";

import { StyleSelector } from "./stijl-selector";

export const SingleTileWmsType = "LaagType.SingleTileWms";
export type SingleTileWmsType = "LaagType.SingleTileWms";
export const TiledWmsType = "LaagType.TiledWms";
export type TiledWmsType = "LaagType.TiledWms";
export const WmtsType = "LaagType.Wmts";
export type WmtsType = "LaagType.Wmts";
export const VectorType = "LaagType.Vector";
export type VectorType = "LaagType.Vector";
export const BlancoType = "LaagType.Blanco";
export type BlancoType = "LaagType.Blanco";
export type LaagType = SingleTileWmsType | TiledWmsType | WmtsType | VectorType | BlancoType;

export type AchtergrondLaag = WmsLaag | WmtsLaag | BlancoLaag;

export type Laaggroep = "Achtergrond" | "Voorgrond.Hoog" | "Voorgrond.Laag" | "Tools";

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
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly titel: string;
  readonly source: ol.source.Vector;
  readonly styleSelector: Option<StyleSelector>;
  readonly selectieStyleSelector: Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly offsetveld: Option<string>;

  getLabel?: (veld: string) => string;
  isBasisInfo?: (veld: string) => boolean;
  getType?: (veld: string) => string;
}

export interface BlancoLaag {
  readonly type: BlancoType;
  readonly titel: string;
  readonly backgroundUrl: string;
  readonly minZoom: number;
  readonly maxZoom: number;
}

export type Laag = WmsLaag | WmtsLaag | VectorLaag | BlancoLaag;

export interface TekenSettings {
  readonly geometryType: ol.geom.GeometryType;
  readonly laagStyle: Option<StyleSelector>;
  readonly drawStyle: Option<StyleSelector>;
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
}

export interface ToegevoegdeVectorLaag extends ToegevoegdeLaag {
  readonly bron: VectorLaag;
  readonly layer: ol.layer.Vector;
  readonly stijlPositie: number; // We gaan er van uit dat alle vectorlagen in dezelfde groep zitten!
  readonly stijlSel: Option<StyleSelector>;
  readonly selectiestijlSel: Option<StyleSelector>;
}

export const isWmsLaag: (laag: Laag) => boolean = laag => laag.type === SingleTileWmsType || laag.type === TiledWmsType;
export const isBlancoLaag: (laag: Laag) => boolean = laag => laag.type === BlancoType;
export const isVectorLaag: (laag: Laag) => boolean = laag => laag.type === VectorType;
export const asVectorLaag: (laag: Laag) => Option<VectorLaag> = fromPredicate(isVectorLaag) as (_: Laag) => Option<VectorLaag>;
export const isToegevoegdeVectorLaag: (laag: ToegevoegdeLaag) => boolean = laag => isVectorLaag(laag.bron);
export const asToegevoegdeVectorLaag: (laag: ToegevoegdeLaag) => Option<ToegevoegdeVectorLaag> = laag =>
  fromPredicate<ToegevoegdeLaag>(lg => isVectorLaag(lg.bron))(laag) as Option<ToegevoegdeVectorLaag>;

export function TekenSettings(
  geometryType: ol.geom.GeometryType,
  laagStyle: Option<StyleSelector>,
  drawStyle: Option<StyleSelector>
): TekenSettings {
  return {
    geometryType: geometryType,
    laagStyle: laagStyle,
    drawStyle: drawStyle
  };
}
