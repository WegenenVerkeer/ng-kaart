import { none, Option, some } from "fp-ts/lib/Option";
import { List, OrderedMap } from "immutable";
import * as ol from "openlayers";

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

export interface StaticStyle {
  readonly type: "StaticStyle";
  readonly style: ol.style.Style;
}

export interface DynamicStyle {
  readonly type: "DynamicStyle";
  readonly styleFunction: ol.StyleFunction;
}

export interface Styles {
  readonly type: "Styles";
  readonly styles: Array<ol.style.Style>;
}

export type StyleSelector = StaticStyle | DynamicStyle | Styles;

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

export interface VeldInfo {
  label: string;
  type: string;
  isBasisVeld: boolean;
}

export interface VectorLaag {
  readonly type: VectorType;
  readonly titel: string;
  readonly source: ol.source.Vector;
  readonly styleSelector: Option<StyleSelector>;
  readonly selecteerbaar: boolean;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly velden: OrderedMap<string, VeldInfo>;
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

export function isWmsLaag(laag: Laag): boolean {
  return laag.type === SingleTileWmsType || laag.type === TiledWmsType;
}

export function isBlancoLaag(laag: Laag): boolean {
  return laag.type === BlancoType;
}

export type Stylish = ol.StyleFunction | ol.style.Style | ol.style.Style[];

export function determineStyle(styleSelector: Option<StyleSelector>, defaultStyle: ol.style.Style): Stylish {
  return styleSelector
    .map(selector => {
      switch (selector.type) {
        case "StaticStyle":
          return selector.style;
        case "DynamicStyle":
          return selector.styleFunction;
        case "Styles":
          return selector.styles;
      }
    })
    .getOrElseValue(defaultStyle);
}

export function determineStyleSelector(stp?: Stylish): Option<StyleSelector> {
  if (stp instanceof ol.style.Style) {
    return some(StaticStyle(stp));
  } else if (typeof stp === "function") {
    return some(DynamicStyle(stp as ol.StyleFunction));
  } else if (Array.isArray(stp)) {
    return some(Styles(stp as ol.style.Style[]));
  } else {
    return none;
  }
}

export function StaticStyle(style: ol.style.Style): StyleSelector {
  return {
    type: "StaticStyle",
    style: style
  };
}

export function DynamicStyle(styleFunction: ol.StyleFunction): StyleSelector {
  return {
    type: "DynamicStyle",
    styleFunction: styleFunction
  };
}

export function Styles(styles: Array<ol.style.Style>): StyleSelector {
  return {
    type: "Styles",
    styles: styles
  };
}

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
